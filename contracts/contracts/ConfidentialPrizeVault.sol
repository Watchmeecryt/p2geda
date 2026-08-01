// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/interfaces/IERC7984ERC20Wrapper.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IConfidentialPrizeVault} from "./interfaces/IConfidentialPrizeVault.sol";
import {IPrizeReserve} from "./interfaces/IPrizeReserve.sol";

/// @title ConfiPool Confidential Prize Vault
/// @notice No-loss prize savings vault using ERC-7984 custody, encrypted balances,
///         deposit-weighted FHE randomness, and encrypted prize claims.
/// @dev Deposits and reserve funding enter through ERC-7984 transfer-and-call.
contract ConfidentialPrizeVault is
    ZamaEthereumConfig,
    IERC7984Receiver,
    IConfidentialPrizeVault,
    IPrizeReserve,
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    uint256 public constant MAX_DEPOSITORS = 32;
    bytes32 public constant RESERVE_DEPOSIT_TAG = keccak256("CONFIPOOL_PRIZE_RESERVE");

    /// @notice Draws required before owner may publish total prizes paid (admin-updatable).
    uint256 public minDrawsBeforePublicReveal = 5;
    /// @notice Depositors required before owner may publish aggregate TVL (admin-updatable).
    uint256 public minDepositsBeforePublicTvlReveal = 3;

    IERC7984 private immutable _confidentialToken;
    address private immutable _underlyingToken;
    /// @notice How long the deposit bus stays open after the first deposit of a batch.
    uint256 private immutable _depositWindowDuration;
    /// @notice Seconds after the deposit window closes before `draw()` may run.
    uint256 private immutable _drawInterval;

    mapping(address account => euint64 balance) private _balances;
    mapping(address account => euint64 claimable) private _claimable;
    mapping(address account => bool registered) private _isDepositor;
    address[] private _depositors;

    euint64 private _totalPrincipal;
    euint64 private _prizeReserve;
    euint64 private _prizePerDraw;
    euint64 private _totalPrizesPaid;

    bool public prizePerDrawConfigured;
    bool public prizeReserveFunded;
    uint256 public lastDrawAt;
    uint256 public drawsCompleted;
    bytes32 public lastTotalPaidRevealHandle;

    /// @notice When the current batch's deposit window opened (0 = idle, waiting for first deposit).
    uint256 public depositWindowOpensAt;
    /// @notice When the current batch stops accepting deposits (0 = idle).
    uint256 public depositWindowClosesAt;

    /// @notice Plain ERC-4626 that holds invested underlying (MockYield4626 on Sepolia).
    IERC4626 private _yieldVault;
    /// @notice Clear underlying units currently marked as principal inside `yieldVault`.
    uint256 public allocatedUnderlying;
    /// @notice Pending unwrap request used by the allocate flow.
    bytes32 public pendingAllocateUnwrapId;
    bytes32 public lastTotalPrincipalRevealHandle;
    /// @notice Last principal handle published for public metrics (gated by deposit threshold).
    bytes32 public lastPublicTvlRevealHandle;
    /// @notice Last handle made publicly decryptable for `_prizeReserve` (keeper sizes draw prize).
    bytes32 public lastPrizeReserveRevealHandle;
    /// @notice Share of each harvested yield that becomes prize-per-draw (rest stays encrypted
    ///         in `_prizeReserve` as padding so clear harvest ≠ draw prize ≠ winner claim).
    ///         Default 8000 = 80% paid per draw; 20% remains in the encrypted reserve.
    uint16 public prizeShareBps = 8000;

    error InvalidAddress();
    error InvalidDrawInterval();
    error InvalidDepositWindow();
    error InvalidReceiverData();
    error OnlyConfidentialToken(address caller);
    error OnlyDepositor(address caller);
    error OnlyOwnerMayFundReserve(address sender);
    error DepositorLimitReached();
    error PrizeNotConfigured();
    error PrizeReserveNotFunded();
    error DrawTooEarly(uint256 nextDrawAt);
    error NoDepositors();
    error DepositWindowClosed(uint256 closedAt);
    error DepositWindowStillOpen(uint256 closesAt);
    error DepositWindowNotOpen();
    error RevealThresholdNotMet(uint256 completed, uint256 required);
    error RevealAlreadyRequested(bytes32 handle);
    error YieldVaultNotSet();
    error YieldVaultAlreadySet();
    error YieldVaultAssetMismatch();
    error AllocateInFlight();
    error NoPendingAllocate();
    error NoYieldToHarvest();
    error InsufficientYieldLiquidity();
    error InvalidRevealThreshold();
    error InvalidPrizeShareBps();

    constructor(
        address confidentialToken_,
        address underlyingToken_,
        uint256 depositWindowDuration_,
        uint256 drawInterval_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (confidentialToken_ == address(0) || underlyingToken_ == address(0) || initialOwner == address(0)) {
            revert InvalidAddress();
        }
        if (depositWindowDuration_ == 0) revert InvalidDepositWindow();
        if (drawInterval_ == 0) revert InvalidDrawInterval();

        _confidentialToken = IERC7984(confidentialToken_);
        _underlyingToken = underlyingToken_;
        _depositWindowDuration = depositWindowDuration_;
        _drawInterval = drawInterval_;
    }

    modifier onlyDepositor() {
        if (!_isDepositor[msg.sender]) revert OnlyDepositor(msg.sender);
        _;
    }

    function confidentialToken() external view returns (address) {
        return address(_confidentialToken);
    }

    function underlyingToken() external view returns (address) {
        return _underlyingToken;
    }

    function drawInterval() external view returns (uint256) {
        return _drawInterval;
    }

    function depositWindowDuration() external view returns (uint256) {
        return _depositWindowDuration;
    }

    /// @notice True while the vault accepts user principal deposits for the current batch.
    /// @dev Idle (`depositWindowClosesAt == 0`) counts as open so the first deposit can start the bus.
    function depositsOpen() external view returns (bool) {
        return depositWindowClosesAt == 0 || block.timestamp < depositWindowClosesAt;
    }

    function yieldVault() external view returns (address) {
        return address(_yieldVault);
    }

    /// @notice Draw due time.
    /// @dev With an open batch: `depositWindowClosesAt + drawInterval`.
    ///      Idle after a prior draw: `lastDrawAt + drawInterval` so yield-funded redraws
    ///      do not require a new deposit bus. `0` means nothing is scheduled.
    function nextDrawAt() public view returns (uint256) {
        if (depositWindowClosesAt != 0) {
            return depositWindowClosesAt + _drawInterval;
        }
        if (_depositors.length == 0 || lastDrawAt == 0) return 0;
        return lastDrawAt + _drawInterval;
    }

    function depositorCount() external view returns (uint256) {
        return _depositors.length;
    }

    function depositorAt(uint256 index) external view returns (address) {
        return _depositors[index];
    }

    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balances[account];
    }

    function confidentialClaimableOf(address account) external view returns (euint64) {
        return _claimable[account];
    }

    function confidentialPrizeReserve() external view override(IConfidentialPrizeVault, IPrizeReserve) returns (euint64) {
        return _prizeReserve;
    }

    function confidentialPrizePerDraw() external view override(IConfidentialPrizeVault, IPrizeReserve) returns (euint64) {
        return _prizePerDraw;
    }

    function confidentialTotalPrincipal() external view returns (euint64) {
        return _totalPrincipal;
    }

    function confidentialTotalPrizesPaid() external view returns (euint64) {
        return _totalPrizesPaid;
    }

    /// @notice Receives confidential deposits from cUSDCMock.
    /// @dev Empty data records user principal. `abi.encode(RESERVE_DEPOSIT_TAG)`
    ///      records an owner-funded prize reserve deposit.
    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata data
    ) external returns (ebool) {
        if (msg.sender != address(_confidentialToken)) revert OnlyConfidentialToken(msg.sender);

        if (data.length == 0) {
            _recordDeposit(from, amount);
        } else {
            if (data.length != 32 || abi.decode(data, (bytes32)) != RESERVE_DEPOSIT_TAG) {
                revert InvalidReceiverData();
            }
            if (from != owner()) revert OnlyOwnerMayFundReserve(from);
            _recordPrizeReserve(amount);
        }

        ebool accepted = FHE.asEbool(true);
        FHE.allowTransient(accepted, msg.sender);
        return accepted;
    }

    /// @notice Sets the encrypted prize amount committed by each draw.
    function setPrizePerDraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override(IConfidentialPrizeVault, IPrizeReserve) onlyOwner {
        _prizePerDraw = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(_prizePerDraw);
        // The owner set this value, so letting them read it back leaks nothing new
        // and lets the admin UI confirm the live configuration.
        FHE.allow(_prizePerDraw, owner());
        prizePerDrawConfigured = true;
        emit PrizePerDrawConfigured(euint64.unwrap(_prizePerDraw));
    }

    /// @notice Withdraws principal back to the caller as cUSDCMock.
    /// @dev Pulls any allocated capital out of the yield venue first so the vault holds
    ///      cUSDCMock to pay. Accounting debits only what was actually transferred — if the
    ///      token has no liquidity, the user keeps their encrypted balance (no silent burn).
    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyDepositor nonReentrant returns (euint64 transferred) {
        _ensureConfidentialLiquidity();

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 current = _balances[msg.sender];
        ebool withinBalance = FHE.le(requested, current);
        euint64 amount = FHE.select(withinBalance, requested, FHE.asEuint64(0));

        FHE.allowTransient(amount, address(_confidentialToken));
        transferred = _confidentialToken.confidentialTransfer(msg.sender, amount);

        _balances[msg.sender] = FHE.sub(current, transferred);
        _totalPrincipal = FHE.sub(_totalPrincipal, transferred);
        _grantBalancePermissions(msg.sender);
        FHE.allowThis(_totalPrincipal);

        emit WithdrawalRequested(msg.sender, euint64.unwrap(transferred));
    }

    /// @notice Runs one encrypted, deposit-weighted draw.
    /// @dev After a deposit bus closes, due at `closesAt + drawInterval`. After a draw, if no
    ///      new bus opens, another draw is due at `lastDrawAt + drawInterval` so accrued yield
    ///      can keep funding prizes without waiting for fresh deposits.
    function draw() external onlyOwner {
        if (!prizePerDrawConfigured) revert PrizeNotConfigured();
        if (!prizeReserveFunded) revert PrizeReserveNotFunded();
        if (_depositors.length == 0) revert NoDepositors();

        if (depositWindowClosesAt != 0) {
            if (block.timestamp < depositWindowClosesAt) {
                revert DepositWindowStillOpen(depositWindowClosesAt);
            }
        } else if (lastDrawAt == 0) {
            revert DepositWindowNotOpen();
        }

        uint256 dueAt = nextDrawAt();
        if (dueAt == 0 || block.timestamp < dueAt) revert DrawTooEarly(dueAt);

        ebool hasPrincipal = FHE.gt(_totalPrincipal, 0);
        ebool reserveIsEnough = FHE.ge(_prizeReserve, _prizePerDraw);
        ebool canAward = FHE.and(hasPrincipal, reserveIsEnough);
        euint64 committedPrize = FHE.select(canAward, _prizePerDraw, FHE.asEuint64(0));
        _prizeReserve = FHE.sub(_prizeReserve, committedPrize);
        FHE.allowThis(_prizeReserve);
        // Each draw produces a fresh handle, so re-grant the owner or the admin view
        // of the remaining reserve goes dark after the first draw.
        FHE.allow(_prizeReserve, owner());

        euint64 randomWord = FHE.randEuint64();
        euint128 scaledWide = FHE.mul(FHE.asEuint128(randomWord), FHE.asEuint128(_totalPrincipal));
        euint64 ticket = FHE.asEuint64(FHE.shr(scaledWide, 64));

        euint64 cumulative = FHE.asEuint64(0);
        ebool selected = FHE.asEbool(false);
        for (uint256 i = 0; i < _depositors.length; ++i) {
            address account = _depositors[i];
            cumulative = FHE.add(cumulative, _balances[account]);

            ebool ticketBeforeEnd = FHE.lt(ticket, cumulative);
            ebool winner = FHE.and(FHE.not(selected), ticketBeforeEnd);
            euint64 payout = FHE.select(winner, committedPrize, FHE.asEuint64(0));

            _claimable[account] = FHE.add(_claimable[account], payout);
            FHE.allowThis(_claimable[account]);
            FHE.allow(_claimable[account], account);
            selected = FHE.or(selected, winner);
        }

        unchecked {
            ++drawsCompleted;
        }
        lastDrawAt = block.timestamp;
        if (depositWindowClosesAt != 0 || depositWindowOpensAt != 0) {
            depositWindowOpensAt = 0;
            depositWindowClosesAt = 0;
            emit DepositWindowReset(drawsCompleted);
        }
        emit DrawCompleted(drawsCompleted, euint64.unwrap(committedPrize));
    }

    /// @notice Transfers the caller's encrypted accumulated winnings.
    /// @dev Every depositor may call; non-winners transfer encrypted zero, so the
    ///      transaction itself does not prove who won. Pays from cUSDC already held
    ///      for the encrypted prize reserve (funded by harvest/admin) — does **not**
    ///      redeem MockYield principal. Pulling the whole yield allocation is only
    ///      needed for principal `withdraw()`.
    function claim() external onlyDepositor nonReentrant returns (euint64 transferred) {
        euint64 amount = _claimable[msg.sender];
        FHE.allowTransient(amount, address(_confidentialToken));
        transferred = _confidentialToken.confidentialTransfer(msg.sender, amount);

        _claimable[msg.sender] = FHE.sub(amount, transferred);
        FHE.allowThis(_claimable[msg.sender]);
        FHE.allow(_claimable[msg.sender], msg.sender);

        _totalPrizesPaid = FHE.add(_totalPrizesPaid, transferred);
        FHE.allowThis(_totalPrizesPaid);

        emit PrizeClaimed(msg.sender, euint64.unwrap(transferred));
    }

    /// @notice Marks the current aggregate paid-prize handle publicly decryptable.
    /// @dev Public decryption needs no user EIP-712 signature. A later claim creates
    ///      a new aggregate handle, which may be revealed in a later snapshot.
    function requestTotalPrizesPaidReveal() external onlyOwner returns (bytes32 handle) {
        if (drawsCompleted < minDrawsBeforePublicReveal) {
            revert RevealThresholdNotMet(drawsCompleted, minDrawsBeforePublicReveal);
        }

        handle = euint64.unwrap(_totalPrizesPaid);
        if (handle == lastTotalPaidRevealHandle) revert RevealAlreadyRequested(handle);

        FHE.makePubliclyDecryptable(_totalPrizesPaid);
        lastTotalPaidRevealHandle = handle;
        emit TotalPrizesPaidRevealRequested(drawsCompleted, handle);
    }

    /// @notice Fraction of the encrypted prize reserve paid as prize-per-draw.
    /// @dev Keeper funds 100% of each clear harvest into `_prizeReserve`, then before each
    ///      draw reveals the reserve and sets prize-per-draw to this fraction of the pot.
    function setPrizeShareBps(uint16 bps) external onlyOwner {
        if (bps == 0 || bps > 10_000) revert InvalidPrizeShareBps();
        prizeShareBps = bps;
        emit PrizeShareBpsUpdated(bps);
    }

    /// @notice Update how many draws must complete before prizes-paid can be published.
    function setMinDrawsBeforePublicReveal(uint256 value) external onlyOwner {
        if (value == 0) revert InvalidRevealThreshold();
        minDrawsBeforePublicReveal = value;
        emit MinDrawsBeforePublicRevealUpdated(value);
    }

    /// @notice Update how many depositors must join before TVL can be published.
    function setMinDepositsBeforePublicTvlReveal(uint256 value) external onlyOwner {
        if (value == 0) revert InvalidRevealThreshold();
        minDepositsBeforePublicTvlReveal = value;
        emit MinDepositsBeforePublicTvlRevealUpdated(value);
    }

    /// @notice Wire the Morpho-like ERC-4626 once. Asset must be this vault's underlying.
    function setYieldVault(address yieldVault_) external onlyOwner {
        if (yieldVault_ == address(0)) revert InvalidAddress();
        if (address(_yieldVault) != address(0)) revert YieldVaultAlreadySet();
        if (IERC4626(yieldVault_).asset() != _underlyingToken) revert YieldVaultAssetMismatch();
        _yieldVault = IERC4626(yieldVault_);
        emit YieldVaultSet(yieldVault_);
    }

    /// @notice Make `_totalPrincipal` publicly decryptable so the keeper can size an allocate.
    /// @dev Leaks aggregate TVL only — not per-depositor amounts. Operational path (no deposit gate).
    function requestTotalPrincipalReveal() external onlyOwner returns (bytes32 handle) {
        handle = euint64.unwrap(_totalPrincipal);
        if (handle == lastTotalPrincipalRevealHandle) revert RevealAlreadyRequested(handle);
        FHE.makePubliclyDecryptable(_totalPrincipal);
        lastTotalPrincipalRevealHandle = handle;
        emit TotalPrincipalRevealRequested(handle);
    }

    /// @notice Publish aggregate TVL for the Metrics page after enough depositors have joined.
    /// @dev Separate from the keeper allocate reveal so the UI only surfaces admin-published snapshots.
    function requestPublicTvlReveal() external onlyOwner returns (bytes32 handle) {
        uint256 count = _depositors.length;
        if (count < minDepositsBeforePublicTvlReveal) {
            revert RevealThresholdNotMet(count, minDepositsBeforePublicTvlReveal);
        }

        handle = euint64.unwrap(_totalPrincipal);
        if (handle == lastPublicTvlRevealHandle) revert RevealAlreadyRequested(handle);

        FHE.makePubliclyDecryptable(_totalPrincipal);
        lastPublicTvlRevealHandle = handle;
        emit PublicTvlRevealRequested(count, handle);
    }

    /// @notice Make `_prizeReserve` publicly decryptable so the keeper can size prize-per-draw.
    /// @dev Leaks aggregate reserve only — not the winner or per-user amounts.
    function requestPrizeReserveReveal() external onlyOwner returns (bytes32 handle) {
        handle = euint64.unwrap(_prizeReserve);
        if (handle == lastPrizeReserveRevealHandle) revert RevealAlreadyRequested(handle);
        FHE.makePubliclyDecryptable(_prizeReserve);
        lastPrizeReserveRevealHandle = handle;
        emit PrizeReserveRevealRequested(handle);
    }

    /// @notice Emergency/ops bridge only: owner supplies clear underlying without unwrapping vault cUSDCMock.
    /// @dev Prefer `requestAllocate` / `finalizeAllocate` (RelayerNode public-decrypt + encrypt).
    function bootstrapAllocate(uint256 underlyingAmount) external onlyOwner nonReentrant {
        _requireDepositWindowClosed();
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();
        if (underlyingAmount == 0) revert InsufficientYieldLiquidity();

        IERC20(_underlyingToken).safeTransferFrom(msg.sender, address(this), underlyingAmount);
        IERC20(_underlyingToken).forceApprove(address(_yieldVault), underlyingAmount);
        _yieldVault.deposit(underlyingAmount, address(this));
        allocatedUnderlying += underlyingAmount;

        emit YieldAllocated(underlyingAmount, allocatedUnderlying);
    }

    /// @notice Step 1 of allocate: unwrap encrypted cUSDCMock held by this vault.
    /// @dev Only after the deposit window closes. Keeper encrypts the idle confidential-unit delta.
    function requestAllocate(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyOwner returns (bytes32 unwrapRequestId) {
        _requireDepositWindowClosed();
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();
        if (pendingAllocateUnwrapId != bytes32(0)) revert AllocateInFlight();

        IERC7984ERC20Wrapper wrapper = IERC7984ERC20Wrapper(address(_confidentialToken));
        unwrapRequestId = wrapper.unwrap(address(this), address(this), encryptedAmount, inputProof);
        pendingAllocateUnwrapId = unwrapRequestId;
        emit AllocateRequested(unwrapRequestId);
    }

    /// @notice Step 2 of allocate: finalize unwrap and deposit clear underlying into `yieldVault`.
    function finalizeAllocate(
        uint64 unwrapAmountCleartext,
        bytes calldata decryptionProof
    ) external onlyOwner nonReentrant returns (uint256 underlyingAmount) {
        if (pendingAllocateUnwrapId == bytes32(0)) revert NoPendingAllocate();
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();

        bytes32 requestId = pendingAllocateUnwrapId;
        pendingAllocateUnwrapId = bytes32(0);

        IERC7984ERC20Wrapper wrapper = IERC7984ERC20Wrapper(address(_confidentialToken));
        wrapper.finalizeUnwrap(requestId, unwrapAmountCleartext, decryptionProof);

        underlyingAmount = uint256(unwrapAmountCleartext) * wrapper.rate();
        IERC20 underlying = IERC20(_underlyingToken);
        underlying.forceApprove(address(_yieldVault), underlyingAmount);
        _yieldVault.deposit(underlyingAmount, address(this));
        allocatedUnderlying += underlyingAmount;

        emit YieldAllocated(underlyingAmount, allocatedUnderlying);
    }

    /// @notice Pull surplus share value out of the yield vault as **clear** underlying to the owner.
    /// @dev Does not touch `_prizeReserve`. The keeper encrypts **100%** of this amount into the
    ///      reserve, then sets prize-per-draw to only `prizeShareBps` so padding stays confidential.
    ///      Clear harvest size is intentionally public (ERC-4626 venue); encrypted prize size is not.
    function harvestClear() external onlyOwner nonReentrant returns (uint256 yieldUnderlying) {
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();

        uint256 shares = _yieldVault.balanceOf(address(this));
        uint256 assets = _yieldVault.convertToAssets(shares);
        if (assets <= allocatedUnderlying) revert NoYieldToHarvest();

        yieldUnderlying = assets - allocatedUnderlying;
        _yieldVault.withdraw(yieldUnderlying, msg.sender, address(this));

        emit YieldHarvested(yieldUnderlying);
    }

    /// @notice Bring principal back from the yield vault as cUSDCMock liquidity for withdraws/claims.
    function redeemFromYield(uint256 underlyingAmount) external onlyOwner nonReentrant {
        _redeemFromYield(underlyingAmount);
    }

    /// @dev If capital is parked in the ERC-4626, bring it back (capped by maxWithdraw) and wrap
    ///      to cUSDCMock so confidentialTransfer in withdraw/claim can pay users.
    ///      After yield accrues, share-price rounding can make maxWithdraw slightly less than
    ///      `allocatedUnderlying` — withdrawing the full allocated amount reverts with
    ///      ERC4626ExceededMaxWithdraw and blocks claims. Cap to maxWithdraw instead.
    function _ensureConfidentialLiquidity() private {
        if (address(_yieldVault) == address(0)) return;

        uint256 shares = _yieldVault.balanceOf(address(this));
        if (shares == 0) {
            allocatedUnderlying = 0;
            return;
        }
        if (allocatedUnderlying == 0) return;

        uint256 maxOut = _yieldVault.maxWithdraw(address(this));
        if (maxOut == 0) return;

        _redeemFromYield(allocatedUnderlying);
    }

    function _redeemFromYield(uint256 underlyingAmount) private {
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();
        if (underlyingAmount == 0) revert InsufficientYieldLiquidity();

        uint256 amount = underlyingAmount;
        if (amount > allocatedUnderlying) amount = allocatedUnderlying;

        uint256 maxOut = _yieldVault.maxWithdraw(address(this));
        if (amount > maxOut) amount = maxOut;
        if (amount == 0) revert InsufficientYieldLiquidity();

        _yieldVault.withdraw(amount, address(this), address(this));
        allocatedUnderlying -= amount;

        // Dust shares can remain after rounding; clear accounting when nothing withdrawable is left.
        if (_yieldVault.maxWithdraw(address(this)) == 0) {
            allocatedUnderlying = 0;
        }

        IERC7984ERC20Wrapper wrapper = IERC7984ERC20Wrapper(address(_confidentialToken));
        IERC20(_underlyingToken).forceApprove(address(wrapper), amount);
        wrapper.wrap(address(this), amount);

        emit YieldRedeemed(amount, allocatedUnderlying);
    }

    function _recordDeposit(address account, euint64 amount) private {
        if (depositWindowClosesAt != 0 && block.timestamp >= depositWindowClosesAt) {
            revert DepositWindowClosed(depositWindowClosesAt);
        }
        if (depositWindowClosesAt == 0) {
            depositWindowOpensAt = block.timestamp;
            depositWindowClosesAt = block.timestamp + _depositWindowDuration;
            emit DepositWindowOpened(depositWindowOpensAt, depositWindowClosesAt);
        }

        if (!_isDepositor[account]) {
            if (_depositors.length >= MAX_DEPOSITORS) revert DepositorLimitReached();
            _isDepositor[account] = true;
            _depositors.push(account);
        }

        _balances[account] = FHE.add(_balances[account], amount);
        _totalPrincipal = FHE.add(_totalPrincipal, amount);
        _grantBalancePermissions(account);
        FHE.allowThis(_totalPrincipal);
        emit DepositRecorded(account, euint64.unwrap(_balances[account]));
    }

    function _requireDepositWindowClosed() private view {
        if (depositWindowClosesAt == 0) revert DepositWindowNotOpen();
        if (block.timestamp < depositWindowClosesAt) {
            revert DepositWindowStillOpen(depositWindowClosesAt);
        }
    }

    function _recordPrizeReserve(euint64 amount) private {
        _prizeReserve = FHE.add(_prizeReserve, amount);
        FHE.allowThis(_prizeReserve);
        FHE.allow(_prizeReserve, owner());
        prizeReserveFunded = true;
        emit PrizeReserveFunded(euint64.unwrap(_prizeReserve));
    }

    function _grantBalancePermissions(address account) private {
        FHE.allowThis(_balances[account]);
        FHE.allow(_balances[account], account);
    }
}
