# PoolTogether — fetched notes

## Introduction (2026-07-30)

Source: https://dev.pooltogether.com/protocol/introduction

- Prize savings: pool yield for a chance to win; principal withdrawable anytime.
- Any yield-bearing token (LP, aTokens, cTokens, etc.) can integrate.
- V5 liquidates yield to a chain-local prize token pool (e.g. WETH).
- Principles: autonomous, permissionless, incentivized keepers/bots.
- DX: ERC-4626 vault templates; customize yield liquidation and claiming.

## Protocol design (2026-07-30)

Source: https://dev.pooltogether.com/protocol/design/

Key formulas:

- TWAB cumulative: `cum = lastCum + lastBal * (t - lastT)`
- Average balance between observations: cumulative delta / time delta
- Winner check (official):

```text
PRN = keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, drawRandomNumber))
winningZone = tierOdds * userTwab * vaultPortion
userWon = (PRN % vaultTotalAverageSupply) < winningZone
```

Independent shots per `prizeIndex`. TWAB is measured over a **tier-specific** accrual duration. Adaptive tier count, canary tiers, `4^t` prize counts, and `vaultPortion` (multi-vault liquidity share) are the rest of the hyperstructure.

## ConfiPool vs official

| Piece | Official PT V5 | ConfiPool source (this repo) |
|-------|----------------|------------------------------|
| PRN | `keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, R))` | Same encoding |
| Reduce | `PRN % W` (modulo-bias aware) | Same rejection sampling |
| Win test | `(PRN % W) < odds × twab × vaultPortion` | `twab > (PRN % W) × k` with `odds = 1/k`, `vaultPortion = 1` |
| Multi-prize | Independent `prizeIndex` loop, `4^t` shots | Independent `prizeIndex` loop; demo `count = [1,1,1]`, max 4 |
| Multi-tier | Additive | Additive |
| Publish `W` | Yes (public TWAB controller) | Yes — `unsealRound` publishes exact `W` |
| Per-tier TWAB window | Yes | Same last-snapshot → this-snapshot window for all tiers |
| Adaptive / canary | Yes | No |

ConfiPool source uses the official PRN and independent shots, and publishes `W` the way PT does.

What we still omit on purpose (FHE / single-vault demo): `4^t` adaptive tiers, canary, liquidation/VRGDA claimer, per-tier accrual durations, `vaultPortion`.

See also the README [Winner selection](../../README.md#winner-selection) section.
