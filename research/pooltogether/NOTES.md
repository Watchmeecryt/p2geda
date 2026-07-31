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

See full summary in `../../02-POOLTOGETHER-RESEARCH.md`.

Key formulas retained for later comparison to FHE design:

- TWAB cumulative: `cum = lastCum + lastBal * (t - lastT)`
- Average balance between observations from cumulative delta / time delta
- Winner check (simplified): PRN from keccak(drawId, vault, user, tier, prizeIndex, drawRandomNumber); winning zone from tierOdds × userTwab × vaultPortion
