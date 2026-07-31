// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {externalEuint64, euint64} from "@fhevm/solidity/lib/FHE.sol";

interface IPrizeReserve {
    function confidentialPrizeReserve() external view returns (euint64);
    function confidentialPrizePerDraw() external view returns (euint64);
    function setPrizePerDraw(externalEuint64 encryptedAmount, bytes calldata inputProof) external;
}
