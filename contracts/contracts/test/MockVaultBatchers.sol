// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import {IERC7984} from "@openzeppelin/confidential-contracts/interfaces/IERC7984.sol";
import {IERC7984Receiver} from "@openzeppelin/confidential-contracts/interfaces/IERC7984Receiver.sol";

/// @notice Local-only deposit batcher: holds cUSDC and pays 1:1 confidential shares on claim.
contract MockDepositBatcher is IERC7984Receiver, ZamaEthereumConfig {
    IERC7984 public immutable fromToken;
    IERC7984 public immutable toToken;
    uint256 public currentBatchId = 1;

    mapping(uint256 => mapping(address => euint64)) private _deposits;

    constructor(IERC7984 fromToken_, IERC7984 toToken_) {
        fromToken = fromToken_;
        toToken = toToken_;
    }

    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata
    ) external returns (ebool) {
        if (msg.sender != address(fromToken)) revert();
        _deposits[currentBatchId][from] = FHE.add(
            FHE.isInitialized(_deposits[currentBatchId][from])
                ? _deposits[currentBatchId][from]
                : FHE.asEuint64(0),
            amount
        );
        FHE.allowThis(_deposits[currentBatchId][from]);
        ebool accepted = FHE.asEbool(true);
        FHE.allowTransient(accepted, msg.sender);
        return accepted;
    }

    function claim(uint256 batchId, address account) external {
        euint64 amount = _deposits[batchId][account];
        _deposits[batchId][account] = FHE.asEuint64(0);
        FHE.allowTransient(amount, address(toToken));
        // Operator must be granted by the share token owner in tests.
        toToken.confidentialTransfer(account, amount);
    }

    function advanceBatch() external {
        unchecked {
            ++currentBatchId;
        }
    }
}

/// @notice Local-only redeem batcher: holds shares and pays 1:1 cUSDC on claim.
contract MockRedeemBatcher is IERC7984Receiver, ZamaEthereumConfig {
    IERC7984 public immutable fromToken;
    IERC7984 public immutable toToken;
    uint256 public currentBatchId = 1;

    mapping(uint256 => mapping(address => euint64)) private _deposits;

    constructor(IERC7984 fromToken_, IERC7984 toToken_) {
        fromToken = fromToken_;
        toToken = toToken_;
    }

    function onConfidentialTransferReceived(
        address,
        address from,
        euint64 amount,
        bytes calldata
    ) external returns (ebool) {
        if (msg.sender != address(fromToken)) revert();
        _deposits[currentBatchId][from] = FHE.add(
            FHE.isInitialized(_deposits[currentBatchId][from])
                ? _deposits[currentBatchId][from]
                : FHE.asEuint64(0),
            amount
        );
        FHE.allowThis(_deposits[currentBatchId][from]);
        ebool accepted = FHE.asEbool(true);
        FHE.allowTransient(accepted, msg.sender);
        return accepted;
    }

    function claim(uint256 batchId, address account) external {
        euint64 amount = _deposits[batchId][account];
        _deposits[batchId][account] = FHE.asEuint64(0);
        FHE.allowTransient(amount, address(toToken));
        toToken.confidentialTransfer(account, amount);
    }

    function advanceBatch() external {
        unchecked {
            ++currentBatchId;
        }
    }
}
