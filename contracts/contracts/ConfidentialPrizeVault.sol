// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {FHE, ebool, euint64, euint128, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IConfidentialPrizeVault} from "./interfaces/IConfidentialPrizeVault.sol";
import {IYieldSource} from "./interfaces/IYieldSource.sol";

/// @title ConfiPool Confidential Prize Vault
/// @notice Confidential no-loss prize savings with PoolTogether V5-style TWAB weighting
///         and independent Apex / Pulse / Ripple prize tiers.
/// @dev Deposits stay encrypted (ERC-7984). Each draw freezes a time-weighted window,
///      publishes aggregate randomness + total weight via KMS public-decrypt, then awards
///      each participant independently against plaintext thresholds. Yield funds the reserve
///      through `IYieldSource` (mock on Sepolia, Morpho adapter on mainnet).
contract ConfidentialPrizeVault is
    ZamaEthereumConfig,
    IERC7984Receiver,
    IConfidentialPrizeVault,
    Ownable,
    ReentrancyGuard
{
    /// @notice Max tracked depositors (enumeration for keeper accrual batches).
    uint256 public constant MAX_DEPOSITORS = 256;
    /// @notice Max accounts processed in one `scoreEntrants` call.
    uint256 public constant MAX_ACCRUE_BATCH = 16;
    /// @notice Three ConfiPool tiers: Apex (rarest), Pulse (mid), Ripple (most frequent).
    uint8 public constant TIERS = 3;
    uint8 public constant TIER_APEX = 0;
    uint8 public constant TIER_PULSE = 1;
    uint8 public constant TIER_RIPPLE = 2;
    /// @notice PoolTogether V5 gives `4^t` shots per tier; we cap FHE compares per saver.
    uint32 public constant MAX_PRIZES_PER_TIER = 4;

    bytes32 public constant RESERVE_DEPOSIT_TAG = keccak256("CONFIPOOL_PRIZE_RESERVE");

    /// @notice How long an opened draw may sit before anyone may cancel it.
    uint40 public constant CANCEL_AFTER = 24 hours;

    IERC7984 private immutable _confidentialToken;
    address private immutable _underlyingToken;
    /// @notice Minimum seconds between consecutive draw windows (short on Sepolia demos).
    uint40 public immutable minPeriod;
    uint40 public immutable genesis;

    struct Observation {
        uint40 timestamp;
        euint64 balance;
        euint128 cumulative;
    }

    enum DrawStatus {
        None,
        Open,
        Revealed,
        Cancelled
    }

    struct Draw {
        uint40 periodStart;
        uint40 snapshotAt;
        DrawStatus status;
        euint64 encR;
        euint128 encTotalWeight;
        uint64 r;
        uint128 totalWeight;
    }

    mapping(address => Observation[]) private _userObs;
    Observation[] private _totalObs;

    mapping(address => bool) private _isDepositor;
    address[] private _depositors;

    euint64 private _reserve;
    euint64 private _totalPrizesPaid;
    mapping(address => euint64) private _pending;
    mapping(address => euint64) private _winnings;
    mapping(uint32 => mapping(address => bool)) public accrued;
    mapping(uint32 => mapping(address => euint128)) private _cumAt;

    uint32 public roundCount;
    mapping(uint32 => Draw) private _draws;

    uint64[TIERS] public tierPrize;
    uint128[TIERS] public tierK;
    /// @notice Independent shots per tier (PoolTogether `prizeIndex` count). Demo default is 1.
    uint32[TIERS] public tierPrizeCount;
    uint64 public apexPrize;
    bool public tiersConfigured;

    IYieldSource public yieldSource;
    uint256 public minDrawsBeforePublicReveal = 5;
    bytes32 public lastTotalPaidRevealHandle;

    error InvalidAddress();
    error InvalidPeriod();
    error InvalidReceiverData();
    error OnlyConfidentialToken(address caller);
    error OnlyOwnerMayFundReserve(address sender);
    error DepositorLimitReached();
    error NothingStaked();
    error PreviousDrawUnresolved();
    error TooSoon(uint40 openableAt);
    error DrawNotOpen();
    error DrawNotRevealed();
    error PrizeTiersNotSet();
    error BadTierShape();
    error NotStale(uint40 cancellableAt);
    error InvalidBatchSize();
    error RevealThresholdNotMet(uint256 completed, uint256 required);
    error RevealAlreadyRequested(bytes32 handle);
    error NoObservations();
    error TimestampInFuture();

    event Deposited(address indexed account, uint40 timestamp, uint256 observationIndex);
    event Withdrawn(address indexed account, uint40 timestamp, uint256 observationIndex);
    event PrizeReserveFunded(bytes32 indexed newReserveHandle);
    event YieldSourceSet(address indexed source);
    event Harvested(uint40 timestamp);
    event TiersConfigured(uint64[TIERS] prizes, uint128[TIERS] k);
    event RoundBegan(uint32 indexed drawId, uint40 periodStart, uint40 snapshotAt);
    event RoundUnsealed(uint32 indexed drawId, uint64 r, uint128 totalWeight);
    event RoundAbandoned(uint32 indexed drawId, uint40 at);
    event EntrantScored(address indexed account, uint32 indexed drawId);
    event PrizeClaimed(address indexed account, bytes32 indexed amountHandle);
    event TotalPrizesPaidRevealRequested(uint32 indexed drawId, bytes32 indexed totalPaidHandle);
    event MinDrawsBeforePublicRevealUpdated(uint256 value);

    constructor(
        address confidentialToken_,
        address underlyingToken_,
        uint40 minPeriod_,
        address initialOwner
    ) Ownable(initialOwner) {
        if (confidentialToken_ == address(0) || underlyingToken_ == address(0)) revert InvalidAddress();
        if (minPeriod_ == 0) revert InvalidPeriod();
        _confidentialToken = IERC7984(confidentialToken_);
        _underlyingToken = underlyingToken_;
        minPeriod = minPeriod_;
        genesis = uint40(block.timestamp);

        _reserve = FHE.asEuint64(0);
        _totalPrizesPaid = FHE.asEuint64(0);
        FHE.allowThis(_reserve);
        FHE.allowThis(_totalPrizesPaid);
        FHE.allow(_reserve, initialOwner);
    }

    // -------------------------------------------------------------------------
    // views
    // -------------------------------------------------------------------------

    function confidentialToken() external view returns (address) {
        return address(_confidentialToken);
    }

    function underlyingToken() external view returns (address) {
        return _underlyingToken;
    }

    function depositorCount() external view returns (uint256) {
        return _depositors.length;
    }

    function depositorAt(uint256 index) external view returns (address) {
        return _depositors[index];
    }

    function confidentialBalanceOf(address account) external view returns (euint64) {
        return _balanceOf(_userObs[account]);
    }

    function confidentialClaimableOf(address account) external view returns (euint64) {
        return _pending[account];
    }

    function confidentialWinningsOf(address account) external view returns (euint64) {
        return _winnings[account];
    }

    function confidentialPrizeReserve() external view returns (euint64) {
        return _reserve;
    }

    function confidentialTotalPrizesPaid() external view returns (euint64) {
        return _totalPrizesPaid;
    }

    function observationCount(address account) external view returns (uint256) {
        return _userObs[account].length;
    }

    function roundAt(uint32 drawId) external view returns (Draw memory) {
        return _draws[drawId];
    }

    function nextRoundAt() public view returns (uint40) {
        if (roundCount == 0) return genesis + minPeriod;
        Draw storage last = _draws[roundCount];
        if (last.status == DrawStatus.Cancelled) {
            return last.periodStart + minPeriod;
        }
        if (last.status == DrawStatus.Revealed) {
            return last.snapshotAt + minPeriod;
        }
        return type(uint40).max;
    }

    // -------------------------------------------------------------------------
    // deposit / withdraw (ERC-7984 receiver + explicit withdraw)
    // -------------------------------------------------------------------------

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

    function withdraw(
        externalEuint64 encryptedAmount,
        bytes calldata inputProof
    ) external nonReentrant returns (euint64 sent) {
        euint64 amount = FHE.fromExternal(encryptedAmount, inputProof);
        euint64 balance = _balanceOf(_userObs[msg.sender]);

        ebool within = FHE.le(amount, balance);
        euint64 request = FHE.select(within, amount, FHE.asEuint64(0));
        euint64 decreased = FHE.select(within, FHE.sub(balance, amount), balance);

        if (address(yieldSource) != address(0)) {
            FHE.allowTransient(request, address(yieldSource));
            sent = yieldSource.redeem(request, msg.sender);
        } else {
            FHE.allowTransient(request, address(_confidentialToken));
            sent = _confidentialToken.confidentialTransfer(msg.sender, request);
        }

        euint64 refund = FHE.sub(request, sent);
        euint64 newUser = FHE.add(decreased, refund);
        euint64 newTotal = FHE.sub(_balanceOf(_totalObs), sent);

        _push(_userObs[msg.sender], newUser, msg.sender);
        _push(_totalObs, newTotal, address(0));

        emit Withdrawn(msg.sender, uint40(block.timestamp), _userObs[msg.sender].length - 1);
    }

    function claim() external nonReentrant returns (euint64 transferred) {
        euint64 amount = _pending[msg.sender];
        FHE.allowTransient(amount, address(_confidentialToken));
        transferred = _confidentialToken.confidentialTransfer(msg.sender, amount);

        _pending[msg.sender] = FHE.sub(amount, transferred);
        FHE.allowThis(_pending[msg.sender]);
        FHE.allow(_pending[msg.sender], msg.sender);

        _totalPrizesPaid = FHE.add(_totalPrizesPaid, transferred);
        FHE.allowThis(_totalPrizesPaid);

        emit PrizeClaimed(msg.sender, euint64.unwrap(transferred));
    }

    // -------------------------------------------------------------------------
    // admin / yield
    // -------------------------------------------------------------------------

    function setYieldSource(IYieldSource source) external onlyOwner {
        yieldSource = source;
        if (address(source) != address(0)) {
            _confidentialToken.setOperator(address(source), type(uint48).max);
        }
        emit YieldSourceSet(address(source));
    }

    function harvest() external {
        if (address(yieldSource) == address(0)) return;
        euint64 got = yieldSource.harvest(address(this));
        _reserve = FHE.add(_reserve, got);
        FHE.allowThis(_reserve);
        FHE.allow(_reserve, owner());
        emit Harvested(uint40(block.timestamp));
    }

    /// @notice Configures Apex / Pulse / Ripple prizes and odds multipliers.
    /// @dev `k[TIER_RIPPLE]` must be 1. Higher `k` = rarer tier. Prizes must strictly decrease.
    function setTiers(uint64[TIERS] calldata prizes, uint128[TIERS] calldata k) external onlyOwner {
        if (k[TIER_RIPPLE] != 1) revert BadTierShape();
        for (uint8 t = 0; t + 1 < TIERS; ++t) {
            if (k[t] <= k[t + 1]) revert BadTierShape();
            if (prizes[t] <= prizes[t + 1]) revert BadTierShape();
        }
        for (uint8 t = 0; t < TIERS; ++t) {
            tierPrize[t] = prizes[t];
            tierK[t] = k[t];
            if (tierPrizeCount[t] == 0) tierPrizeCount[t] = 1;
        }
        apexPrize = prizes[TIER_APEX];
        tiersConfigured = true;
        emit TiersConfigured(prizes, k);
    }

    /// @notice Sets how many independent PoolTogether-style shots each tier offers (1..4).
    function setTierPrizeCounts(uint32[TIERS] calldata counts) external onlyOwner {
        for (uint8 t = 0; t < TIERS; ++t) {
            if (counts[t] == 0 || counts[t] > MAX_PRIZES_PER_TIER) revert BadTierShape();
            tierPrizeCount[t] = counts[t];
        }
    }

    function setMinDrawsBeforePublicReveal(uint256 value) external onlyOwner {
        minDrawsBeforePublicReveal = value;
        emit MinDrawsBeforePublicRevealUpdated(value);
    }

    function requestTotalPrizesPaidReveal() external onlyOwner returns (bytes32 handle) {
        if (roundCount < minDrawsBeforePublicReveal) {
            revert RevealThresholdNotMet(roundCount, minDrawsBeforePublicReveal);
        }
        handle = euint64.unwrap(_totalPrizesPaid);
        if (handle == lastTotalPaidRevealHandle) revert RevealAlreadyRequested(handle);
        FHE.makePubliclyDecryptable(_totalPrizesPaid);
        lastTotalPaidRevealHandle = handle;
        emit TotalPrizesPaidRevealRequested(roundCount, handle);
    }

    // -------------------------------------------------------------------------
    // draws
    // -------------------------------------------------------------------------

    /// @notice Freezes the current TWAB window and draws encrypted randomness in one tx.
    function beginRound() external returns (uint32 drawId) {
        if (
            roundCount != 0 &&
            _draws[roundCount].status != DrawStatus.Revealed &&
            _draws[roundCount].status != DrawStatus.Cancelled
        ) {
            revert PreviousDrawUnresolved();
        }
        if (_totalObs.length == 0) revert NothingStaked();

        uint40 previous;
        if (roundCount == 0) {
            previous = genesis;
        } else if (_draws[roundCount].status == DrawStatus.Cancelled) {
            previous = _draws[roundCount].periodStart;
        } else {
            previous = _draws[roundCount].snapshotAt;
        }
        if (block.timestamp < uint256(previous) + minPeriod) {
            revert TooSoon(previous + minPeriod);
        }

        uint40 periodStart = previous;
        uint40 snapshotAt = uint40(block.timestamp);

        euint128 total = FHE.sub(
            _cumulativeAt(_totalObs, snapshotAt),
            _cumulativeAt(_totalObs, periodStart)
        );
        euint64 r = FHE.randEuint64();

        FHE.allowThis(total);
        FHE.allowThis(r);
        FHE.makePubliclyDecryptable(total);
        FHE.makePubliclyDecryptable(r);

        drawId = ++roundCount;
        _draws[drawId] = Draw({
            periodStart: periodStart,
            snapshotAt: snapshotAt,
            status: DrawStatus.Open,
            encR: r,
            encTotalWeight: total,
            r: 0,
            totalWeight: 0
        });

        emit RoundBegan(drawId, periodStart, snapshotAt);
    }

    /// @notice Publishes R and total weight after KMS public-decrypt signatures.
    function unsealRound(
        uint32 drawId,
        bytes calldata cleartexts,
        bytes calldata decryptionProof
    ) external {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Open) revert DrawNotOpen();

        bytes32[] memory handles = new bytes32[](2);
        handles[0] = euint64.unwrap(d.encR);
        handles[1] = euint128.unwrap(d.encTotalWeight);
        FHE.checkSignatures(handles, cleartexts, decryptionProof);

        (uint256 r, uint256 total) = abi.decode(cleartexts, (uint256, uint256));
        _applyReveal(drawId, uint64(r), uint128(total));
    }

    /// @notice Abandons a stale open draw so the pool cannot brick.
    function abandonRound(uint32 drawId) external {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Open) revert DrawNotOpen();
        uint40 at = d.snapshotAt + CANCEL_AFTER;
        if (block.timestamp < at) revert NotStale(at);
        d.status = DrawStatus.Cancelled;
        emit RoundAbandoned(drawId, uint40(block.timestamp));
    }

    /// @notice Prize-0 threshold (legacy name). Prefer `thresholdOf`.
    function thresholdFor(uint32 drawId, address user, uint8 tier) public view returns (uint128) {
        return thresholdOf(drawId, user, tier, 0);
    }

    /// @notice Public PoolTogether V5 winning-zone threshold for one prize index.
    /// @dev Official rule: `userWon = (PRN % W) < (odds * twab)` with
    ///      `PRN = keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, R))`
    ///      and `odds = 1 / tierK`. Encrypted compare is `twab > (PRN % W) * tierK`.
    function thresholdOf(
        uint32 drawId,
        address user,
        uint8 tier,
        uint32 prizeIndex
    ) public view returns (uint128) {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Revealed) revert DrawNotRevealed();
        if (tier >= TIERS) revert BadTierShape();
        uint32 shots = tierPrizeCount[tier];
        if (shots == 0) shots = 1;
        if (prizeIndex >= shots) revert BadTierShape();

        uint256 supply = uint256(d.totalWeight);
        if (supply == 0) return 0;

        uint256 prn = uint256(
            keccak256(abi.encode(drawId, address(this), user, tier, prizeIndex, d.r))
        );
        uint256 r = _uniform(prn, supply);
        uint256 threshold = r * uint256(tierK[tier]);
        if (threshold > type(uint128).max) return type(uint128).max;
        return uint128(threshold);
    }

    /// @notice Awards independent Apex / Pulse / Ripple credits (PoolTogether V5 shots).
    function scoreEntrant(address user, uint32 drawId) public {
        Draw storage d = _draws[drawId];
        if (d.status != DrawStatus.Revealed) revert DrawNotRevealed();
        if (!tiersConfigured || apexPrize == 0) revert PrizeTiersNotSet();
        if (accrued[drawId][user]) return;
        accrued[drawId][user] = true;

        euint128 weight = FHE.sub(
            _snapshotCumulative(user, drawId, d.snapshotAt),
            _windowStart(user, drawId, d)
        );

        euint64 zero = FHE.asEuint64(0);
        euint64 credit = zero;
        for (uint8 t = 0; t < TIERS; ++t) {
            euint64 prize = FHE.asEuint64(tierPrize[t]);
            uint32 shots = tierPrizeCount[t];
            if (shots == 0) shots = 1;
            for (uint32 idx = 0; idx < shots; ++idx) {
                ebool won = FHE.gt(weight, thresholdOf(drawId, user, t, idx));
                credit = FHE.add(credit, FHE.select(won, prize, zero));
            }
        }

        ebool funded = FHE.ge(_reserve, credit);
        euint64 paid = FHE.select(funded, credit, FHE.asEuint64(0));
        _reserve = FHE.select(funded, FHE.sub(_reserve, credit), _reserve);
        FHE.allowThis(_reserve);
        FHE.allow(_reserve, owner());

        _pending[user] = FHE.add(_pending[user], paid);
        _winnings[user] = FHE.add(_winnings[user], paid);
        FHE.allowThis(_pending[user]);
        FHE.allow(_pending[user], user);
        FHE.allowThis(_winnings[user]);
        FHE.allow(_winnings[user], user);

        emit EntrantScored(user, drawId);
    }

    /// @notice Batched accrual with deterministic address order (not caller-chosen).
    function scoreEntrants(address[] calldata users, uint32 drawId) external {
        uint256 n = users.length;
        if (n == 0 || n > MAX_ACCRUE_BATCH) revert InvalidBatchSize();

        address[] memory ordered = new address[](n);
        for (uint256 i = 0; i < n; ++i) ordered[i] = users[i];
        for (uint256 i = 1; i < n; ++i) {
            address key = ordered[i];
            bytes32 keyHash = keccak256(abi.encode(drawId, key));
            uint256 j = i;
            while (j > 0 && uint256(keccak256(abi.encode(drawId, ordered[j - 1]))) > uint256(keyHash)) {
                ordered[j] = ordered[j - 1];
                unchecked {
                    --j;
                }
            }
            ordered[j] = key;
        }

        for (uint256 i = 0; i < n; ++i) {
            scoreEntrant(ordered[i], drawId);
        }
    }

    // -------------------------------------------------------------------------
    // internal: reveal hook (overridable for local Hardhat harness)
    // -------------------------------------------------------------------------

    function _applyReveal(uint32 drawId, uint64 r, uint128 total) internal virtual {
        Draw storage d = _draws[drawId];
        d.r = r;
        d.totalWeight = total;
        d.status = DrawStatus.Revealed;
        emit RoundUnsealed(drawId, r, total);
    }

    // -------------------------------------------------------------------------
    // internal: TWAB record
    // -------------------------------------------------------------------------

    function _recordDeposit(address account, euint64 amount) private {
        if (!_isDepositor[account]) {
            if (_depositors.length >= MAX_DEPOSITORS) revert DepositorLimitReached();
            _isDepositor[account] = true;
            _depositors.push(account);
        }

        if (address(yieldSource) != address(0)) {
            FHE.allowTransient(amount, address(yieldSource));
            amount = yieldSource.supply(amount);
        }

        euint64 newUser = FHE.add(_balanceOf(_userObs[account]), amount);
        euint64 newTotal = FHE.add(_balanceOf(_totalObs), amount);
        _push(_userObs[account], newUser, account);
        _push(_totalObs, newTotal, address(0));

        emit Deposited(account, uint40(block.timestamp), _userObs[account].length - 1);
    }

    function _recordPrizeReserve(euint64 amount) private {
        _reserve = FHE.add(_reserve, amount);
        FHE.allowThis(_reserve);
        FHE.allow(_reserve, owner());
        emit PrizeReserveFunded(euint64.unwrap(_reserve));
    }

    function _push(Observation[] storage obs, euint64 newBalance, address reader) private {
        uint40 nowTs = uint40(block.timestamp);
        euint128 cumulative;

        if (obs.length == 0) {
            cumulative = FHE.asEuint128(0);
        } else {
            Observation storage last = obs[obs.length - 1];
            uint128 dt = uint128(nowTs - last.timestamp);
            cumulative = FHE.add(last.cumulative, FHE.mul(FHE.asEuint128(last.balance), dt));
        }

        FHE.allowThis(newBalance);
        FHE.allowThis(cumulative);
        if (reader != address(0)) {
            FHE.allow(newBalance, reader);
            FHE.allow(cumulative, reader);
        }

        obs.push(Observation({timestamp: nowTs, balance: newBalance, cumulative: cumulative}));
    }

    function _balanceOf(Observation[] storage obs) private view returns (euint64) {
        if (obs.length == 0) return euint64.wrap(0);
        return obs[obs.length - 1].balance;
    }

    function _indexAt(Observation[] storage obs, uint40 target) private view returns (uint256) {
        uint256 len = obs.length;
        if (len == 0 || obs[0].timestamp > target) revert NoObservations();
        uint256 lo = 0;
        uint256 hi = len - 1;
        while (lo < hi) {
            uint256 mid = (lo + hi + 1) / 2;
            if (obs[mid].timestamp <= target) lo = mid;
            else hi = mid - 1;
        }
        return lo;
    }

    function _cumulativeAt(Observation[] storage obs, uint40 target) private returns (euint128) {
        if (obs.length == 0 || obs[0].timestamp > target) return FHE.asEuint128(0);
        Observation storage o = obs[_indexAt(obs, target)];
        return FHE.add(o.cumulative, FHE.mul(FHE.asEuint128(o.balance), uint128(target - o.timestamp)));
    }

    function _snapshotCumulative(address user, uint32 drawId, uint40 snapshotAt) private returns (euint128) {
        euint128 cached = _cumAt[drawId][user];
        if (FHE.isInitialized(cached)) return cached;
        euint128 value = _cumulativeAt(_userObs[user], snapshotAt);
        _cumAt[drawId][user] = value;
        FHE.allowThis(value);
        return value;
    }

    function _windowStart(address user, uint32 drawId, Draw storage d) private returns (euint128) {
        if (drawId > 1 && _draws[drawId - 1].status == DrawStatus.Revealed) {
            return _snapshotCumulative(user, drawId - 1, _draws[drawId - 1].snapshotAt);
        }
        return _cumulativeAt(_userObs[user], d.periodStart);
    }

    function _uniform(uint256 entropy, uint256 upperBound) private pure returns (uint256) {
        if (upperBound == 0) return 0;
        uint256 min = (type(uint256).max - upperBound + 1) % upperBound;
        uint256 random = entropy;
        while (random < min) {
            random = uint256(keccak256(abi.encode(random)));
        }
        return random % upperBound;
    }
}
