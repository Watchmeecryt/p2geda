// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @title MockYield4626
/// @notice Thin Morpho-like ERC-4626 used on Sepolia to stand in for a real yield venue.
/// @dev Share price rises when `accrue` (or time-based `accrueElapsed`) adds underlying into
///      the vault. In production this address is replaced by a Morpho VaultV2; ConfiPool's
///      prize vault only ever sees IERC4626.
contract MockYield4626 is ERC4626, Ownable {
    using SafeERC20 for IERC20;

    /// @notice Annual rate used by `accrueElapsed`, in basis points (500 = 5% APR).
    uint16 public aprBps;
    uint256 public lastAccrualAt;

    error InvalidApr();
    error NothingToAccrue();

    event AprUpdated(uint16 aprBps);
    event YieldAccrued(uint256 amount, address fundedBy);

    constructor(
        IERC20 asset_,
        string memory name_,
        string memory symbol_,
        address initialOwner,
        uint16 aprBps_
    ) ERC20(name_, symbol_) ERC4626(asset_) Ownable(initialOwner) {
        if (aprBps_ == 0 || aprBps_ > 10_000) revert InvalidApr();
        aprBps = aprBps_;
        lastAccrualAt = block.timestamp;
    }

    function setAprBps(uint16 aprBps_) external onlyOwner {
        if (aprBps_ == 0 || aprBps_ > 10_000) revert InvalidApr();
        aprBps = aprBps_;
        emit AprUpdated(aprBps_);
    }

    /// @notice Push `amount` of underlying into the vault as simulated yield (share price up).
    /// @dev Caller must `approve` this contract first, or be the owner funding from a mint.
    function accrue(uint256 amount) external {
        if (amount == 0) revert NothingToAccrue();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        lastAccrualAt = block.timestamp;
        emit YieldAccrued(amount, msg.sender);
    }

    /// @notice Accrue time-based yield at `aprBps`, funded by `msg.sender`'s underlying.
    /// @dev Computes simple interest on current `totalAssets()` over elapsed seconds.
    function accrueElapsed() external returns (uint256 amount) {
        uint256 elapsed = block.timestamp - lastAccrualAt;
        if (elapsed == 0) revert NothingToAccrue();
        uint256 principal = totalAssets();
        if (principal == 0) {
            lastAccrualAt = block.timestamp;
            return 0;
        }
        // principal * aprBps * elapsed / (365 days * 10_000)
        amount = (principal * uint256(aprBps) * elapsed) / (365 days * 10_000);
        if (amount == 0) revert NothingToAccrue();
        IERC20(asset()).safeTransferFrom(msg.sender, address(this), amount);
        lastAccrualAt = block.timestamp;
        emit YieldAccrued(amount, msg.sender);
    }
}
