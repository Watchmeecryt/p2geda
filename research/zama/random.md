# Zama FHE — random number generation (fetched 2026-07-30)

Source: https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random

## Rules

- Generate **during a transaction** only (PRNG state updates onchain). Cannot use `eth_call`.
- Numbers are encrypted and cryptographically oriented for confidentiality.

## API surface

```solidity
ebool rb = FHE.randEbool();
euint8 r8 = FHE.randEuint8();
euint16 r16 = FHE.randEuint16();
euint32 r32 = FHE.randEuint32();
euint64 r64 = FHE.randEuint64();
euint128 r128 = FHE.randEuint128();
euint256 r256 = FHE.randEuint256();
```

Bounded (upper bound **power of 2**; range `[0, upperBound)`):

```solidity
euint8 r8 = FHE.randEuint8(32);       // 0..31
euint16 r16 = FHE.randEuint16(512);   // 0..511
euint32 r32 = FHE.randEuint32(65536); // 0..65535
```

## Relevance to confidential PoolTogether

Draw winner selection must call these inside `draw()` (or equivalent) onchain, then combine with encrypted balances via FHE compares / `FHE.select` — never offchain RNG and never plaintext balances for weighting.
