# Encrypted yield shares / sized withdraw

**Status:** Implemented in `ConfidentialPrizeVault` source (V2).

**Live Sepolia demo** still runs the previously deployed bytecode until you choose to redeploy. The dApp env addresses are unchanged on purpose so judges keep using the working demo path.

## What V2 does

| Gap | V2 behavior |
|-----|-------------|
| Time-in-bus weighting | Odds use `balance × timeHeld / busWindow`, not spot balance only |
| Scale past 32 | Registry up to **256**; compact buses use one-shot cumulative FHE pick; larger buses use `EncryptedSlotDraw` + batched `settle` |
| Allocated withdraw | `withdraw` → publicDecrypt size → `finalizeWithdraw` redeems **only that slice** from MockYield / ERC-4626 |

Idle (unallocated) withdraws remain one-step confidential transfers.

See the root [README](./README.md) confidentiality + winner-selection sections for the judge-facing description.
