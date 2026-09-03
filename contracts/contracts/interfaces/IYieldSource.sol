// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @notice Where ConfiPool parks idle principal and harvests yield into the prize reserve.
/// @dev Sepolia ships a fixed-rate mock. Mainnet swaps this for a Morpho / Steakhouse adapter
///      without changing the prize vault's deposit / draw / claim surface.
interface IYieldSource {
    function asset() external view returns (address);

    /// @notice Pulls principal from the caller (must already be an ERC-7984 operator).
    function supply(euint64 amount) external returns (euint64 supplied);

    /// @notice Returns principal to `to`. Returns the amount actually transferred.
    function redeem(euint64 amount, address to) external returns (euint64 sent);

    /// @notice Moves accrued yield to `to`. Permissionless.
    function harvest(address to) external returns (euint64 harvested);

    function principal() external view returns (euint64);
}
