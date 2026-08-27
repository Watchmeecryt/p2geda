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
import {EncryptedSlotDraw} from "./libraries/EncryptedSlotDraw.sol";

/// @title ConfiPool Confidential Prize Vault
/// @notice No-loss prize savings: ERC-7984 deposits, encrypted balances, onchain
///         `FHE.randEuint64` draws weighted by time-in-bus deposit size, encrypted claims,
///         and principal exits that redeem only the needed clear slice from the yield venue.
/// @dev V2 keeps ConfiPool's single-vault product surface. Gaps filled vs V1:
///      time-in-bus weighting, encrypted slot draws (batched settle, no cumulative HCU wall),
///      and sized yield redeems on allocated withdraws.
contract ConfidentialPrizeVault is
    ZamaEthereumConfig,
    IERC7984Receiver,
    IConfidentialPrizeVault,
    IPrizeReserve,
    Ownable,
    ReentrancyGuard
{
    using SafeERC20 for IERC20;

    /// @notice Max depositors in the registry.
    uint256 public constant MAX_DEPOSITORS = 256;
    /// @notice Max depositors credited in one settle transaction.
    uint256 public constant MAX_SETTLE_PER_TX = 32;
    /// @notice Public slot width per depositor index (also clamps per-user odds).
    uint64 public constant SLOT_WIDTH = 1_000_000_000_000;
    bytes32 public constant RESERVE_DEPOSIT_TAG = keccak256("CONFIPOOL_PRIZE_RESERVE");

    uint256 public minDrawsBeforePublicReveal = 5;
    uint256 public minDepositsBeforePublicTvlReveal = 3;

    IERC7984 private immutable _confidentialToken;
    address private immutable _underlyingToken;
    uint256 private immutable _depositWindowDuration;
    uint256 private immutable _drawInterval;

    mapping(address account => euint64 balance) private _balances;
    mapping(address account => euint64 claimable) private _claimable;
    mapping(address account => bool registered) private _isDepositor;
    mapping(address account => uint64 joinedAt) private _joinedAt;
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

    uint256 public depositWindowOpensAt;
    uint256 public depositWindowClosesAt;

    IERC4626 private _yieldVault;
    uint256 public allocatedUnderlying;
    bytes32 public pendingAllocateUnwrapId;
    bytes32 public lastTotalPrincipalRevealHandle;
    bytes32 public lastPublicTvlRevealHandle;
    bytes32 public lastPrizeReserveRevealHandle;
    uint16 public prizeShareBps = 8000;

    /// @notice Encrypted random ticket for the open draw — never decrypted.
    euint64 private _drawTicket;
    euint64 private _committedPrize;
    uint32 public settledCount;
    bool public drawInFlight;

    mapping(address => euint64) private _pendingWithdraw;
    mapping(address => bytes32) public pendingWithdrawHandle;

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
    error DrawAlreadyInFlight();
    error NoDrawInFlight();
    error BadSettleRange();
    error NoPendingWithdraw();
    error WithdrawPending();

    event WithdrawRevealRequested(address indexed account, bytes32 indexed amountHandle);
    event WithdrawFinalized(address indexed account, uint256 clearAssets);
    event SettleProgress(uint256 indexed drawId, uint32 from, uint32 to);

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

    function depositsOpen() external view returns (bool) {
        return depositWindowClosesAt == 0 || block.timestamp < depositWindowClosesAt;
    }

    function yieldVault() external view returns (address) {
        return address(_yieldVault);
    }

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

    function setPrizePerDraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external override(IConfidentialPrizeVault, IPrizeReserve) onlyOwner {
        _prizePerDraw = FHE.fromExternal(encryptedAmount, inputProof);
        FHE.allowThis(_prizePerDraw);
        FHE.allow(_prizePerDraw, owner());
        prizePerDrawConfigured = true;
        emit PrizePerDrawConfigured(euint64.unwrap(_prizePerDraw));
    }

    /// @notice Withdraw principal. Idle cUSDC pays in one step. If capital is allocated in
    ///         the yield venue, stages an encrypted exit and requires `finalizeWithdraw` so
    ///         only that clear slice is redeemed (not the whole position).
    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external onlyDepositor nonReentrant returns (euint64 transferred) {
        if (pendingWithdrawHandle[msg.sender] != bytes32(0)) revert WithdrawPending();

        euint64 requested = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 current = _balances[msg.sender];
        ebool withinBalance = FHE.le(requested, current);
        euint64 amount = FHE.select(withinBalance, requested, FHE.asEuint64(0));

        if (allocatedUnderlying == 0 || address(_yieldVault) == address(0)) {
            FHE.allowTransient(amount, address(_confidentialToken));
            transferred = _confidentialToken.confidentialTransfer(msg.sender, amount);
            _balances[msg.sender] = FHE.sub(current, transferred);
            _totalPrincipal = FHE.sub(_totalPrincipal, transferred);
            _grantBalancePermissions(msg.sender);
            FHE.allowThis(_totalPrincipal);
            emit WithdrawalRequested(msg.sender, euint64.unwrap(transferred));
            return transferred;
        }

        _pendingWithdraw[msg.sender] = amount;
        FHE.allowThis(amount);
        FHE.allow(amount, msg.sender);
        FHE.makePubliclyDecryptable(amount);
        bytes32 handle = euint64.unwrap(amount);
        pendingWithdrawHandle[msg.sender] = handle;
        transferred = amount;
        emit WithdrawRevealRequested(msg.sender, handle);
        emit WithdrawalRequested(msg.sender, handle);
    }

    function finalizeWithdraw(uint64 clearAssets, bytes calldata /* decryptionProof */) external onlyDepositor nonReentrant {
        if (pendingWithdrawHandle[msg.sender] == bytes32(0)) revert NoPendingWithdraw();

        if (clearAssets == 0) {
            pendingWithdrawHandle[msg.sender] = bytes32(0);
            _pendingWithdraw[msg.sender] = FHE.asEuint64(0);
            return;
        }

        _redeemFromYield(uint256(clearAssets));

        euint64 amount = _pendingWithdraw[msg.sender];
        euint64 current = _balances[msg.sender];
        FHE.allowTransient(amount, address(_confidentialToken));
        euint64 sent = _confidentialToken.confidentialTransfer(msg.sender, amount);

        _balances[msg.sender] = FHE.sub(current, sent);
        _totalPrincipal = FHE.sub(_totalPrincipal, sent);
        _grantBalancePermissions(msg.sender);
        FHE.allowThis(_totalPrincipal);

        pendingWithdrawHandle[msg.sender] = bytes32(0);
        _pendingWithdraw[msg.sender] = FHE.asEuint64(0);
        emit WithdrawFinalized(msg.sender, clearAssets);
    }

    /// @notice Starts an encrypted slot draw (or settles the next batch). Draws one
    ///         `FHE.randEuint64` ticket, then independently checks each depositor's encrypted
    ///         time-in-bus weight. Call again / use `settle` until `settledCount` covers the bus.
    function draw() external {
        _requireDrawReady();
        if (!drawInFlight) {
            _beginDraw();
            // Compact buses finish inside `_beginDraw` (no in-flight settle).
            if (!drawInFlight) return;
        }
        uint32 from = settledCount;
        uint32 to = uint32(_depositors.length);
        if (to > from + uint32(MAX_SETTLE_PER_TX)) {
            to = from + uint32(MAX_SETTLE_PER_TX);
        }
        _settle(from, to);
        if (settledCount == uint32(_depositors.length)) {
            _completeDraw();
        }
    }

    /// @notice Permissionless settle batch after `draw()` opened the round.
    function settle(uint32 from, uint32 to) external {
        if (!drawInFlight) revert NoDrawInFlight();
        if (from != settledCount || to <= from || to > _depositors.length) revert BadSettleRange();
        if (to - from > MAX_SETTLE_PER_TX) revert BadSettleRange();
        _settle(from, to);
        if (settledCount == uint32(_depositors.length)) {
            _completeDraw();
        }
    }

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

    function setPrizeShareBps(uint16 bps) external onlyOwner {
        if (bps == 0 || bps > 10_000) revert InvalidPrizeShareBps();
        prizeShareBps = bps;
        emit PrizeShareBpsUpdated(bps);
    }

    function setMinDrawsBeforePublicReveal(uint256 value) external onlyOwner {
        if (value == 0) revert InvalidRevealThreshold();
        minDrawsBeforePublicReveal = value;
        emit MinDrawsBeforePublicRevealUpdated(value);
    }

    function setMinDepositsBeforePublicTvlReveal(uint256 value) external onlyOwner {
        if (value == 0) revert InvalidRevealThreshold();
        minDepositsBeforePublicTvlReveal = value;
        emit MinDepositsBeforePublicTvlRevealUpdated(value);
    }

    function setYieldVault(address yieldVault_) external onlyOwner {
        if (yieldVault_ == address(0)) revert InvalidAddress();
        if (address(_yieldVault) != address(0)) revert YieldVaultAlreadySet();
        if (IERC4626(yieldVault_).asset() != _underlyingToken) revert YieldVaultAssetMismatch();
        _yieldVault = IERC4626(yieldVault_);
        emit YieldVaultSet(yieldVault_);
    }

    function requestTotalPrincipalReveal() external onlyOwner returns (bytes32 handle) {
        handle = euint64.unwrap(_totalPrincipal);
        if (handle == lastTotalPrincipalRevealHandle) revert RevealAlreadyRequested(handle);
        FHE.makePubliclyDecryptable(_totalPrincipal);
        lastTotalPrincipalRevealHandle = handle;
        emit TotalPrincipalRevealRequested(handle);
    }

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

    function requestPrizeReserveReveal() external onlyOwner returns (bytes32 handle) {
        handle = euint64.unwrap(_prizeReserve);
        if (handle == lastPrizeReserveRevealHandle) revert RevealAlreadyRequested(handle);
        FHE.makePubliclyDecryptable(_prizeReserve);
        lastPrizeReserveRevealHandle = handle;
        emit PrizeReserveRevealRequested(handle);
    }

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

    function harvestClear() external onlyOwner nonReentrant returns (uint256 yieldUnderlying) {
        if (address(_yieldVault) == address(0)) revert YieldVaultNotSet();

        uint256 shares = _yieldVault.balanceOf(address(this));
        uint256 assets = _yieldVault.convertToAssets(shares);
        if (assets <= allocatedUnderlying) revert NoYieldToHarvest();

        yieldUnderlying = assets - allocatedUnderlying;
        _yieldVault.withdraw(yieldUnderlying, msg.sender, address(this));

        emit YieldHarvested(yieldUnderlying);
    }

    function redeemFromYield(uint256 underlyingAmount) external onlyOwner nonReentrant {
        _redeemFromYield(underlyingAmount);
    }

    function _requireDrawReady() private view {
        if (!prizePerDrawConfigured) revert PrizeNotConfigured();
        if (!prizeReserveFunded) revert PrizeReserveNotFunded();
        if (_depositors.length == 0) revert NoDepositors();

        if (depositWindowClosesAt != 0) {
            if (block.timestamp < depositWindowClosesAt) {
                revert DepositWindowStillOpen(depositWindowClosesAt);
            }
        } else if (lastDrawAt == 0) {
            revert DepositWindowNotOpen();
        } else if (msg.sender != owner() && !drawInFlight) {
            revert OwnableUnauthorizedAccount(msg.sender);
        }

        if (!drawInFlight) {
            uint256 dueAt = nextDrawAt();
            if (dueAt == 0 || block.timestamp < dueAt) revert DrawTooEarly(dueAt);
        }
    }

    function _beginDraw() private {
        if (drawInFlight) revert DrawAlreadyInFlight();

        ebool hasPrincipal = FHE.gt(_totalPrincipal, 0);
        ebool reserveIsEnough = FHE.ge(_prizeReserve, _prizePerDraw);
        ebool canAward = FHE.and(hasPrincipal, reserveIsEnough);
        _committedPrize = FHE.select(canAward, _prizePerDraw, FHE.asEuint64(0));
        _prizeReserve = FHE.sub(_prizeReserve, _committedPrize);
        FHE.allowThis(_prizeReserve);
        FHE.allow(_prizeReserve, owner());
        FHE.allowThis(_committedPrize);

        uint32 n = uint32(_depositors.length);
        if (n <= uint32(MAX_SETTLE_PER_TX)) {
            // Compact buses: one-shot cumulative walk over time-in-bus weights (always one winner).
            _drawCompactBus();
            _completeDraw();
            return;
        }

        // Larger buses: encrypted slot ticket + independent per-depositor settle batches.
        _drawTicket = EncryptedSlotDraw.drawTicket(n, SLOT_WIDTH);
        settledCount = 0;
        drawInFlight = true;
    }

    /// @dev Original ConfiPool selection: `FHE.randEuint64` scaled by Σ weights, then cumulative
    ///      encrypted ranges. Used when the whole bus fits one transaction.
    function _drawCompactBus() private {
        euint64 weightSum = FHE.asEuint64(0);
        uint256 n = _depositors.length;
        for (uint256 i = 0; i < n; ++i) {
            weightSum = FHE.add(weightSum, _timeWeightedBalance(_depositors[i]));
        }

        euint64 randomWord = FHE.randEuint64();
        euint128 scaledWide = FHE.mul(FHE.asEuint128(randomWord), FHE.asEuint128(weightSum));
        euint64 ticket = FHE.asEuint64(FHE.shr(scaledWide, 64));

        euint64 cumulative = FHE.asEuint64(0);
        ebool selected = FHE.asEbool(false);
        for (uint256 i = 0; i < n; ++i) {
            address account = _depositors[i];
            cumulative = FHE.add(cumulative, _timeWeightedBalance(account));

            ebool ticketBeforeEnd = FHE.lt(ticket, cumulative);
            ebool winner = FHE.and(FHE.not(selected), ticketBeforeEnd);
            euint64 payout = FHE.select(winner, _committedPrize, FHE.asEuint64(0));

            _claimable[account] = FHE.add(_claimable[account], payout);
            FHE.allowThis(_claimable[account]);
            FHE.allow(_claimable[account], account);
            selected = FHE.or(selected, winner);
        }
    }

    function _settle(uint32 from, uint32 to) private {
        uint64 openTs = uint64(depositWindowOpensAt);
        uint64 endTs = depositWindowClosesAt != 0
            ? uint64(depositWindowClosesAt)
            : uint64(lastDrawAt);
        if (endTs == 0) endTs = uint64(block.timestamp);
        if (openTs == 0) openTs = endTs > 0 ? endTs - 1 : uint64(block.timestamp);
        uint64 window = endTs > openTs ? endTs - openTs : 1;

        euint64 encPrize = _committedPrize;
        FHE.allowThis(encPrize);

        for (uint32 i = from; i < to; ++i) {
            address account = _depositors[i];
            uint64 joined = _joinedAt[account];
            if (joined == 0 || joined < openTs) joined = openTs;
            if (joined > endTs) joined = endTs;
            uint64 held = endTs - joined;

            euint64 weight = FHE.div(FHE.mul(_balances[account], held), window);
            weight = FHE.min(weight, SLOT_WIDTH);

            ebool won = EncryptedSlotDraw.isWinner(_drawTicket, i, SLOT_WIDTH, weight);
            euint64 payout = EncryptedSlotDraw.payoutIfWinner(won, encPrize);

            _claimable[account] = FHE.add(_claimable[account], payout);
            FHE.allowThis(_claimable[account]);
            FHE.allow(_claimable[account], account);
        }

        settledCount = to;
        emit SettleProgress(drawsCompleted + 1, from, to);
    }

    function _timeWeightedBalance(address account) private returns (euint64 weight) {
        uint64 openTs = uint64(depositWindowOpensAt);
        uint64 endTs = depositWindowClosesAt != 0
            ? uint64(depositWindowClosesAt)
            : (lastDrawAt != 0 ? uint64(lastDrawAt) : uint64(block.timestamp));
        if (openTs == 0) {
            openTs = endTs > 0 ? endTs - 1 : uint64(block.timestamp);
        }
        uint64 window = endTs > openTs ? endTs - openTs : 1;

        uint64 joined = _joinedAt[account];
        if (joined == 0 || joined < openTs) joined = openTs;
        if (joined > endTs) joined = endTs;
        uint64 held = endTs - joined;

        weight = FHE.div(FHE.mul(_balances[account], held), window);
    }

    function _completeDraw() private {
        unchecked {
            ++drawsCompleted;
        }
        lastDrawAt = block.timestamp;
        drawInFlight = false;
        settledCount = 0;

        if (depositWindowClosesAt != 0 || depositWindowOpensAt != 0) {
            depositWindowOpensAt = 0;
            depositWindowClosesAt = 0;
            uint256 n = _depositors.length;
            for (uint256 i = 0; i < n; ++i) {
                _joinedAt[_depositors[i]] = 0;
            }
            emit DepositWindowReset(drawsCompleted);
        }
        emit DrawCompleted(drawsCompleted, euint64.unwrap(_committedPrize));
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

        if (_yieldVault.maxWithdraw(address(this)) == 0) {
            allocatedUnderlying = 0;
        }

        IERC7984ERC20Wrapper wrapper = IERC7984ERC20Wrapper(address(_confidentialToken));
        IERC20(_underlyingToken).forceApprove(address(wrapper), amount);
        wrapper.wrap(address(this), amount);

        emit YieldRedeemed(amount, allocatedUnderlying);
    }

    function _recordDeposit(address account, euint64 amount) private {
        if (drawInFlight) revert DrawAlreadyInFlight();
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
            _joinedAt[account] = uint64(block.timestamp);
        } else if (_joinedAt[account] == 0) {
            _joinedAt[account] = uint64(block.timestamp);
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
