// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {FHE, ebool, euint64, euint128} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";

/// @notice Minimal surface of Zama's confidential deposit batcher (cUSDC → vault shares).
interface IConfidentialDepositBatcher {
    function currentBatchId() external view returns (uint256);
    function claim(uint256 batchId, address account) external;
    function toToken() external view returns (address);
}

/// @notice Minimal surface of Zama's confidential redeem batcher (vault shares → cUSDC).
interface IConfidentialRedeemBatcher {
    function currentBatchId() external view returns (uint256);
    function claim(uint256 batchId, address account) external;
    function fromToken() external view returns (address);
    function toToken() external view returns (address);
}

/// @title ConfidentialVaultSource
/// @notice ConfiPool yield adapter: parks principal via Zama confidential batchers into a
///         Morpho / Steakhouse-shaped ERC-4626, keeps a cUSDC liquidity buffer for exits,
///         and harvests prize yield into the prize vault.
/// @dev On Sepolia the batchers and confidential share token are real; share-price yield on
///      the staging vault is often zero, so `harvest` uses this adapter's configured rate
///      against encrypted principal (seed the adapter with spare cUSDC for the pot). On
///      mainnet the same shape points at Steakhouse Confidential Prime USDC batchers.
contract ConfidentialVaultSource is IYieldSource, ZamaEthereumConfig {
    IERC7984 public immutable token;
    IConfidentialDepositBatcher public immutable depositBatcher;
    IConfidentialRedeemBatcher public immutable redeemBatcher;
    IERC7984 public immutable shareToken;

    /// @notice Annualised replica rate in basis points (used when the underlying vault does not drip).
    uint64 public immutable rateBps;
    address public immutable controller;

    uint40 public lastAccrual;
    euint64 private _principal;
    euint64 private _pending;
    /// @notice Principal already committed into the deposit batcher / shares (encrypted).
    euint64 private _inVault;

    uint256[] private _openBatches;
    uint256[] private _openRedeems;

    uint256 private constant BPS = 10_000;
    uint256 private constant YEAR = 365 days;

    event JoinedVault(uint256 indexed batchId, uint40 at);
    event ClaimedShares(uint256 indexed batchId, uint40 at);
    event RequestedUnwind(uint256 indexed batchId, uint40 at);
    event ClaimedUnwound(uint256 indexed batchId, uint40 at);

    error OnlyController();
    error InvalidRate();
    error BatcherMismatch();

    modifier onlyController() {
        if (msg.sender != controller) revert OnlyController();
        _;
    }

    constructor(
        IERC7984 token_,
        IConfidentialDepositBatcher depositBatcher_,
        IConfidentialRedeemBatcher redeemBatcher_,
        uint64 rateBps_,
        address controller_
    ) {
        if (rateBps_ == 0 || rateBps_ > 10_000) revert InvalidRate();
        address share = depositBatcher_.toToken();
        if (redeemBatcher_.fromToken() != share) revert BatcherMismatch();
        if (redeemBatcher_.toToken() != address(token_)) revert BatcherMismatch();

        token = token_;
        depositBatcher = depositBatcher_;
        redeemBatcher = redeemBatcher_;
        shareToken = IERC7984(share);
        rateBps = rateBps_;
        controller = controller_;
        lastAccrual = uint40(block.timestamp);
    }

    function asset() external view returns (address) {
        return address(token);
    }

    function principal() external view returns (euint64) {
        return _principal;
    }

    function pending() external view returns (euint64) {
        return _pending;
    }

    function inVault() external view returns (euint64) {
        return _inVault;
    }

    function openBatches() external view returns (uint256[] memory) {
        return _openBatches;
    }

    function openRedeems() external view returns (uint256[] memory) {
        return _openRedeems;
    }

    /// @inheritdoc IYieldSource
    function supply(euint64 amount) external onlyController returns (euint64 supplied) {
        _settle();
        FHE.allowTransient(amount, address(token));
        supplied = token.confidentialTransferFrom(msg.sender, address(this), amount);
        _principal = FHE.add(_principal, supplied);
        FHE.allowThis(_principal);
        FHE.allow(_principal, controller);
        FHE.allow(supplied, msg.sender);
    }

    /// @inheritdoc IYieldSource
    /// @dev Pays from the cUSDC buffer. If liquidity is thin, the token clamps; call
    ///      `requestUnwind` so shares can return via the redeem batcher.
    function redeem(euint64 amount, address to) external onlyController returns (euint64 sent) {
        _settle();
        FHE.allowTransient(amount, address(token));
        sent = token.confidentialTransfer(to, amount);
        ebool ok = FHE.ge(_principal, sent);
        _principal = FHE.select(ok, FHE.sub(_principal, sent), _principal);
        FHE.allowThis(_principal);
        FHE.allow(_principal, controller);
        FHE.allow(sent, msg.sender);
    }

    /// @inheritdoc IYieldSource
    function harvest(address to) external returns (euint64 harvested) {
        _settle();
        euint64 owed = _pending;
        if (!FHE.isInitialized(owed)) {
            harvested = FHE.asEuint64(0);
            FHE.allowThis(harvested);
            FHE.allow(harvested, msg.sender);
            return harvested;
        }
        FHE.allowTransient(owed, address(token));
        harvested = token.confidentialTransfer(to, owed);
        _pending = FHE.sub(owed, harvested);
        FHE.allowThis(_pending);
        FHE.allowThis(harvested);
        FHE.allow(harvested, msg.sender);
    }

    /// @notice Sends half of still-idle principal into Zama's current deposit batch.
    /// @dev Keeps a buffer so most withdraws stay same-tx. Permissionless.
    function joinVault() external returns (uint256 batchId) {
        euint64 principalBal = FHE.isInitialized(_principal) ? _principal : FHE.asEuint64(0);
        euint64 alreadyIn = FHE.isInitialized(_inVault) ? _inVault : FHE.asEuint64(0);

        ebool enough = FHE.ge(principalBal, alreadyIn);
        euint64 remaining = FHE.select(enough, FHE.sub(principalBal, alreadyIn), FHE.asEuint64(0));
        euint64 amount = FHE.shr(remaining, 1);

        _inVault = FHE.add(alreadyIn, amount);
        FHE.allowThis(_inVault);

        batchId = depositBatcher.currentBatchId();
        FHE.allowTransient(amount, address(token));
        token.confidentialTransferAndCall(address(depositBatcher), amount, "");
        _openBatches.push(batchId);
        emit JoinedVault(batchId, uint40(block.timestamp));
    }

    /// @notice Collects confidential vault shares after a deposit batch settles.
    function claimShares(uint256 batchId) external {
        depositBatcher.claim(batchId, address(this));
        emit ClaimedShares(batchId, uint40(block.timestamp));
    }

    /// @notice Sends all confidential shares through Zama's redeem batcher.
    function requestUnwind() external returns (uint256 batchId) {
        euint64 shares = shareToken.confidentialBalanceOf(address(this));
        batchId = redeemBatcher.currentBatchId();
        FHE.allowTransient(shares, address(shareToken));
        shareToken.confidentialTransferAndCall(address(redeemBatcher), shares, "");
        _openRedeems.push(batchId);
        emit RequestedUnwind(batchId, uint40(block.timestamp));
    }

    /// @notice Claims cUSDC from a settled redeem batch and reduces `_inVault` by what returned.
    function claimUnwound(uint256 batchId) external {
        euint64 beforeBal = token.confidentialBalanceOf(address(this));
        redeemBatcher.claim(batchId, address(this));
        euint64 afterBal = token.confidentialBalanceOf(address(this));

        ebool grew = FHE.ge(afterBal, beforeBal);
        euint64 returned = FHE.select(grew, FHE.sub(afterBal, beforeBal), FHE.asEuint64(0));
        euint64 alreadyIn = FHE.isInitialized(_inVault) ? _inVault : FHE.asEuint64(0);
        ebool enough = FHE.ge(alreadyIn, returned);
        _inVault = FHE.select(enough, FHE.sub(alreadyIn, returned), FHE.asEuint64(0));
        FHE.allowThis(_inVault);

        emit ClaimedUnwound(batchId, uint40(block.timestamp));
    }

    function _settle() private {
        uint256 elapsed = block.timestamp - lastAccrual;
        lastAccrual = uint40(block.timestamp);
        if (elapsed == 0 || !FHE.isInitialized(_principal)) return;
        _pending = FHE.add(
            FHE.isInitialized(_pending) ? _pending : FHE.asEuint64(0),
            _accrued(elapsed)
        );
        FHE.allowThis(_pending);
    }

    function _accrued(uint256 elapsed) private returns (euint64) {
        euint128 numerator = FHE.mul(
            FHE.asEuint128(_principal),
            uint128(uint256(rateBps) * elapsed)
        );
        return FHE.asEuint64(FHE.div(numerator, uint128(BPS * YEAR)));
    }
}
