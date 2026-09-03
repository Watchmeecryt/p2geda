// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {ConfidentialPrizeVault} from "../ConfidentialPrizeVault.sol";

/// @notice Local Hardhat harness: applies a revealed draw without KMS signatures.
/// @dev Production deployments use `ConfidentialPrizeVault` + `unsealRound` with real proofs.
contract ConfidentialPrizeVaultHarness is ConfidentialPrizeVault {
    constructor(
        address confidentialToken_,
        address underlyingToken_,
        uint40 minPeriod_,
        address initialOwner
    ) ConfidentialPrizeVault(confidentialToken_, underlyingToken_, minPeriod_, initialOwner) {}

    function applyReveal(uint32 drawId, uint64 r, uint128 total) external {
        _applyReveal(drawId, r, total);
    }
}
