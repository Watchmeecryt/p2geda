// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";

interface IConfidentialPrizeVault {
    event DepositRecorded(address indexed account, bytes32 indexed newBalanceHandle);
    event WithdrawalRequested(address indexed account, bytes32 indexed amountHandle);
    event PrizeReserveFunded(bytes32 indexed newReserveHandle);
    event PrizePerDrawConfigured(bytes32 indexed prizeHandle);
    event DrawCompleted(uint256 indexed drawId, bytes32 indexed encryptedPrizeHandle);
    event PrizeClaimed(address indexed account, bytes32 indexed amountHandle);
    event TotalPrizesPaidRevealRequested(uint256 indexed drawId, bytes32 indexed totalPaidHandle);
    event PublicTvlRevealRequested(uint256 indexed depositorCount, bytes32 indexed totalPrincipalHandle);
    event YieldVaultSet(address indexed yieldVault);
    event AllocateRequested(bytes32 indexed unwrapRequestId);
    event YieldAllocated(uint256 underlyingAmount, uint256 totalAllocated);
    event YieldHarvested(uint256 underlyingAmount);
    event YieldRedeemed(uint256 underlyingAmount, uint256 totalAllocated);
    event TotalPrincipalRevealRequested(bytes32 indexed handle);
    event PrizeReserveRevealRequested(bytes32 indexed handle);
    event PrizeShareBpsUpdated(uint16 bps);
    event MinDrawsBeforePublicRevealUpdated(uint256 value);
    event MinDepositsBeforePublicTvlRevealUpdated(uint256 value);
    event DepositWindowOpened(uint256 indexed opensAt, uint256 indexed closesAt);
    event DepositWindowReset(uint256 indexed drawId);

    function confidentialToken() external view returns (address);
    function underlyingToken() external view returns (address);
    function depositWindowDuration() external view returns (uint256);
    function depositWindowOpensAt() external view returns (uint256);
    function depositWindowClosesAt() external view returns (uint256);
    function depositsOpen() external view returns (bool);
    function drawInterval() external view returns (uint256);
    function nextDrawAt() external view returns (uint256);
    function drawsCompleted() external view returns (uint256);
    function depositorCount() external view returns (uint256);
    function depositorAt(uint256 index) external view returns (address);
    function yieldVault() external view returns (address);
    function allocatedUnderlying() external view returns (uint256);
    function prizeShareBps() external view returns (uint16);
    function lastPrizeReserveRevealHandle() external view returns (bytes32);

    function confidentialBalanceOf(address account) external view returns (euint64);
    function confidentialClaimableOf(address account) external view returns (euint64);
    function confidentialPrizeReserve() external view returns (euint64);
    function confidentialPrizePerDraw() external view returns (euint64);
    function confidentialTotalPrincipal() external view returns (euint64);
    function confidentialTotalPrizesPaid() external view returns (euint64);

    function setPrizePerDraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external;
    function setPrizeShareBps(uint16 bps) external;
    function setMinDrawsBeforePublicReveal(uint256 value) external;
    function setMinDepositsBeforePublicTvlReveal(uint256 value) external;
    function setYieldVault(address yieldVault_) external;
    function requestTotalPrincipalReveal() external returns (bytes32);
    function requestPublicTvlReveal() external returns (bytes32);
    function requestPrizeReserveReveal() external returns (bytes32);
    function bootstrapAllocate(uint256 underlyingAmount) external;
    function requestAllocate(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (bytes32);
    function finalizeAllocate(uint64 unwrapAmountCleartext, bytes calldata decryptionProof) external returns (uint256);
    function harvestClear() external returns (uint256);
    function redeemFromYield(uint256 underlyingAmount) external;
    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64);
    function draw() external;
    function claim() external returns (euint64);
    function requestTotalPrizesPaidReveal() external returns (bytes32);
}
