// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @notice Local-only stand-in for Zama's publicly mintable Sepolia USDC Mock.
/// @dev Mirrors the deployed token: 6 decimals, open `mint`. The cUSDCMock wrapper
///      is also 6 decimals, so wrapping applies rate = 1.
contract MockZama is ERC20 {
    constructor() ERC20("USD Coin (Mock)", "USDCMock") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
