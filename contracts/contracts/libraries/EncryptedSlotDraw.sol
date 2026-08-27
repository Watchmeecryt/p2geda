// SPDX-License-Identifier: BSD-3-Clause-Clear
pragma solidity ^0.8.28;

import {FHE, ebool, euint64} from "@fhevm/solidity/lib/FHE.sol";

/// @title EncryptedSlotDraw
/// @notice ConfiPool helper: one onchain `FHE.randEuint64` ticket, then independent
///         per-depositor win checks over encrypted weights. Each depositor owns a public
///         index slot; their encrypted weight is the live fill inside that slot. Settlement
///         work is O(1) per depositor and can be batched, so bus size is not limited by a
///         single sequential cumulative FHE walk.
/// @dev The random ticket handle must never be decrypted — that would reveal the winning index.
library EncryptedSlotDraw {
    function drawTicket(uint32 entrantCount, uint64 slotWidth) internal returns (euint64 ticket) {
        uint64 rawBound = uint64(entrantCount) * slotWidth;
        uint64 bound = _nextPowerOfTwo(rawBound);
        ticket = FHE.randEuint64(bound);
        FHE.allowThis(ticket);
    }

    function _nextPowerOfTwo(uint64 x) private pure returns (uint64 p) {
        require(x > 0, "EncryptedSlotDraw: empty bus");
        p = x - 1;
        p |= p >> 1;
        p |= p >> 2;
        p |= p >> 4;
        p |= p >> 8;
        p |= p >> 16;
        p |= p >> 32;
        unchecked {
            p += 1;
        }
    }

    /// @notice True when `ticket` landed in `[index*slotWidth, index*slotWidth + weight)`.
    function isWinner(
        euint64 ticket,
        uint32 index,
        uint64 slotWidth,
        euint64 weight
    ) internal returns (ebool won) {
        uint64 slotStart = uint64(index) * slotWidth;
        ebool atOrAfterStart = FHE.ge(ticket, slotStart);
        euint64 liveEnd = FHE.add(weight, slotStart);
        ebool beforeLiveEnd = FHE.lt(ticket, liveEnd);
        won = FHE.and(atOrAfterStart, beforeLiveEnd);
    }

    function payoutIfWinner(ebool won, euint64 prize) internal returns (euint64 amount) {
        amount = FHE.select(won, prize, FHE.asEuint64(0));
    }
}
