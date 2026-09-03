// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {euint64, externalEuint64} from "@fhevm/solidity/lib/FHE.sol";
import {IYieldSource} from "./IYieldSource.sol";

interface IConfidentialPrizeVault {
    function confidentialToken() external view returns (address);
    function underlyingToken() external view returns (address);
    function minPeriod() external view returns (uint40);
    function genesis() external view returns (uint40);
    function drawCount() external view returns (uint32);
    function depositorCount() external view returns (uint256);
    function depositorAt(uint256 index) external view returns (address);
    function yieldSource() external view returns (IYieldSource);
    function tiersConfigured() external view returns (bool);
    function apexPrize() external view returns (uint64);
    function nextOpenableAt() external view returns (uint40);

    function confidentialBalanceOf(address account) external view returns (euint64);
    function confidentialClaimableOf(address account) external view returns (euint64);
    function confidentialWinningsOf(address account) external view returns (euint64);
    function confidentialPrizeReserve() external view returns (euint64);
    function confidentialTotalPrizesPaid() external view returns (euint64);

    function setYieldSource(IYieldSource source) external;
    function harvest() external;
    function setTiers(uint64[3] calldata prizes, uint128[3] calldata k) external;
    function setMinDrawsBeforePublicReveal(uint256 value) external;

    function withdraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external returns (euint64);
    function claim() external returns (euint64);

    function openDraw() external returns (uint32 drawId);
    function revealDraw(uint32 drawId, bytes calldata cleartexts, bytes calldata decryptionProof) external;
    function cancelDraw(uint32 drawId) external;
    function thresholdFor(uint32 drawId, address user, uint8 tier) external view returns (uint128);
    function accrue(address user, uint32 drawId) external;
    function accrueMany(address[] calldata users, uint32 drawId) external;
    function requestTotalPrizesPaidReveal() external returns (bytes32);
}
