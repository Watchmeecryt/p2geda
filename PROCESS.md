# Process — Confidential PoolTogether

We go **one phase at a time**. Full approach: **[APPROACH.md](./APPROACH.md)**.

---

## Phase 0 — Understand ✅

- [x] Create `put-together/` lab folder
- [x] Capture bounty brief + fetch PoolTogether / Zama / hooks links
- [x] Map local ERC-7984 / FHE references
- [x] Align scope: **minimal confidential loop**, not full V5 hyperstructure
- [x] Preferences locked: vault + admin reserve; ERC7984-bounty UI; light only; Sepolia + relayer env

**Exit criteria met:** shared understanding of flows and encryption goals.

---

## Phase 1 — Confidentiality design ✅ (locked in APPROACH.md)

| Topic | Decision |
|-------|----------|
| Product name | **ConfiPool** (short: **CPool**) |
| Tokens | Official Sepolia **USDC Mock** + **cUSDCMock** (no custom ERC-20) |
| What stays encrypted | Deposits, balances, draw ticket/weights, individual prizes until winner decrypts; **sum of prizes paid** until admin reveal |
| Admin reveal | After ≥**5** draws: `makePubliclyDecryptable(totalPrizesPaid)` → SDK **publicDecrypt** (no EIP-712) |
| Leakage | Participation, draw times; after reveal, aggregate prizes paid is public |
| Accounting | Vault + euint balances; wrap path via cUSDCMock |
| Weighting | Encrypted **spot** balance at draw (not TWAB) |
| Yield | MockYield4626 (Morpho stand-in) + harvest into encrypted reserve |
| Draw trigger | Admin/keeper tx + Admin UI / script |
| Claim | Confidential credit/transfer + EIP-712 user decrypt (**does not** redeem MockYield) |
| Withdraw | Full principal anytime; demo may redeem **all** allocated yield liquidity then re-allocate (see Phase 5) |
| UI | TokenOps-neat landing; ERC7984 glass app; light only; Hugeicons; USDC/Morpho icons |

---

## Phase 2 — Contracts (complete; live on Sepolia)

- [x] Scaffold `put-together/contracts` (Hardhat + FHEVM)
- [x] Wire official USDC Mock / cUSDCMock addresses (no mock token deploy)
- [x] `IConfidentialPrizeVault` / `IPrizeReserve` interfaces
- [x] `ConfidentialPrizeVault`: ERC-7984 callback deposit, withdrawal, encrypted balances
- [x] Prize reserve fund + `draw()` (`FHE.randEuint64` + scaled encrypted weighting)
- [x] Encrypted `totalPrizesPaid` + public reveal request (≥5 draws)
- [x] Claim path + ACL for user decrypt; public-decrypt path for aggregate
- [x] Yield hooks: allocate / harvestClear / redeem; claim does not empty MockYield
- [x] Redeem caps to ERC-4626 `maxWithdraw` (rounding after accrue)
- [x] Local mocks + FHEVM tests
- [x] Sepolia deploy + `deployments/sepolia.json` (addresses change on each yield redeploy — see JSON)

Reuse: `ERC7984-bounty/contracts`, Zama skills (incl. public decryption).

---

## Phase 3 — Frontend (**ConfiPool**) ✅ (demo)

- [x] Scaffold `put-together/app` — landing + glass app shell
- [x] Pool / Yield / Draws / Admin / History
- [x] RelayerWeb via `VITE_RELAYER_WEB_ORIGIN`
- [x] Morpho-style Yield card + exposure stack; USDC path

---

## Phase 4 — Deploy + submission

- [ ] Public repo + polished README
- [ ] Live Sepolia URL
- [ ] ≤3 min real-person video
- [ ] X thread

---

## Phase 5 — Future (post-win): encrypted yield shares ⏳

**Not for the current demo.** Spec locked in:

→ **[`06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md`](./06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md)**

Summary:

- Today: one shared clear position in MockYield/Morpho; principal `withdraw` may empty that position, pay the user, keeper re-allocates.
- Future: per-user **encrypted shares** of the yield vault (Morpho-batcher style) so an exit redeems **only that user’s assets** (via publicDecrypt of their size, or a batch sum).
- Claim stays on the prize-reserve path (no principal redeem).
- When implementing, start with **Option A** (single-user reveal + finalize) unless product requires batch privacy (**Option B**).

Checklist and Solidity shape live in that file — open it and say “implement Option A from 06” when ready.

---

## How we continue

Next action for demo: walk deposit → keeper → draw → claim on the **latest** vault in [`contracts/deployments/sepolia.json`](./contracts/deployments/sepolia.json) / [`README.md`](./README.md).
