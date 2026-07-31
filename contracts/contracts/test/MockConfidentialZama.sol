// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC7984} from "@openzeppelin/confidential-contracts/token/ERC7984/ERC7984.sol";
import {ERC7984ERC20Wrapper} from "@openzeppelin/confidential-contracts/token/ERC7984/extensions/ERC7984ERC20Wrapper.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @notice Local-only equivalent of the official Sepolia cUSDCMock wrapper.
contract MockConfidentialZama is ZamaEthereumConfig, ERC7984ERC20Wrapper {
    constructor(
        address underlyingToken
    )
        ERC7984("Confidential USDC (Mock)", "cUSDCMock", "ipfs://confipool/local-cusdc")
        ERC7984ERC20Wrapper(IERC20(underlyingToken))
    {}
}
