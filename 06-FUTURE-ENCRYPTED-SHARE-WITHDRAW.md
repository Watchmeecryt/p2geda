# Future: Encrypted yield shares (post-demo upgrade)

**Status:** Spec only — **do not implement for the Sepolia bounty demo.**  
**When to use:** After winning / production cutover, when we want Morpho-batcher-style behavior: **principal stays in the clear ERC-4626** while a user exits, without emptying the whole pot.

**Today (demo):** [`ConfidentialPrizeVault`](./contracts/contracts/ConfidentialPrizeVault.sol) holds encrypted balances; allocate parks **one shared** clear position in MockYield / Morpho. `withdraw()` calls `_ensureConfidentialLiquidity()` and redeems **all** allocated capital, pays the user confidentially, then the keeper re-allocates leftovers. `claim()` does **not** touch MockYield (pays from reserve cUSDC).

**Goal (this doc):** Each depositor holds an **encrypted share** of the yield position so a principal exit redeems **only their proportional assets** (or a batched sum), not the entire MockYield balance.

Reference patterns: Morpho / Steakhouse confidential USDC vault + deposit batchers that mint confidential claims on a clear ERC-4626; local notes in [`03-CONFIDENTIAL-MAPPING.md`](./03-CONFIDENTIAL-MAPPING.md) §A.

---

## 1. Why the demo empties MockYield on withdraw

| Constraint | Effect |
|------------|--------|
| Withdraw **amount is encrypted** | Contract cannot know “redeem exactly 120 USDC for Alice” in cleartext |
| MockYield / Morpho is **clear ERC-4626** | `withdraw(assets)` needs a clear `assets` argument |
| One shared clear position | Only safe liquidity move without decrypting Alice is: redeem **everything**, pay Alice, leave others as cUSDC on the prize vault |

Two concurrent withdraws still work: first empties MockYield → idle cUSDC on vault; second is paid from that idle balance. Leakage: observers see the **full allocated pot** leave the yield venue when *anyone* exits; they do **not** see Alice’s size.

---

## 2. Target mental model

```text
Users ──cUSDC──► Prize vault (encrypted shares + prize accounting)
                      │
         Keeper: publicDecrypt(Σ shares → assets) or batch
                      ▼
              MockYield / Morpho (clear ERC-4626)  ← stays mostly invested
                      │
         harvestClear → wrap → encrypted prize reserve
                      ▼
                   draw / claim (unchanged idea)

Withdraw Alice:
  burn Alice encrypted shares
  → clear redeem size = f(Alice shares)   [via publicDecrypt or batch]
  → Morpho.withdraw(only that size)
  → wrap → confidentialTransfer to Alice
  → other users’ capital remains in Morpho
```

Depositors still deposit **one asset (cUSDC / USDC)**. Exposures in the UI remain Morpho allocation shape, not a second deposit token.

---

## 3. Contract structure (replace / extend)

Keep prize / draw logic; replace principal accounting + allocate / withdraw.

### 3.1 `ConfidentialPrizeVaultV2` (or evolve V1 behind a new module)

**Immutable / config**

- `cToken` — ERC-7984 (cUSDC)
- `underlying` — USDC
- `yieldVault` — IERC4626 (MockYield → Morpho)
- draw interval, owner, `prizeShareBps` (same as today)

**Encrypted state (per user)**

| Storage | Type | Meaning |
|---------|------|---------|
| `_shares[user]` | `euint64` | User’s encrypted claim on the yield position (and idle buffer) |
| `_totalShares` | `euint64` | Σ shares (weights for `draw()`) |
| `_claimable[user]` | `euint64` | Unclaimed prize (unchanged) |
| `_prizeReserve` / `_prizePerDraw` / `_totalPrizesPaid` | `euint64` | Unchanged prize loop |

**Clear state**

| Storage | Meaning |
|---------|---------|
| `allocatedUnderlying` | Clear USDC (or assets) booked into IERC4626 |
| `idleUnderlying` (optional) | Clear USDC held on vault as a buffer so tiny exits skip Morpho |
| `pendingAllocate*` / unwrap ids | Same RelayerNode allocate pattern if still batching deposits |

**Depositor registry** — keep enumerable `_depositors[]` for encrypted weighted `draw()` (cap unchanged or raised).

### 3.2 New / changed external API

```solidity
// Deposit: receive cUSDC via confidentialTransferAndCall (same as today)
// Book encrypted shares 1:1 with confidential units deposited (or rate-adjusted).

function withdraw(
  externalEuint64 encryptedSharesToBurn,
  bytes calldata inputProof
) external returns (euint64 transferred);
// V2: does NOT call redeem-all. See §4.

function requestWithdrawReveal(...) external returns (bytes32 handle);
// Optional: user (or keeper) publicDecrypt path for single-exit sizing.

function finalizeWithdraw(
  uint64 clearAssets,
  bytes calldata decryptionProof
) external;
// Redeems clearAssets from IERC4626, wraps, confidentialTransfer to msg.sender,
// burns the matching encrypted shares (already pending).

// Allocate: still unwrap aggregate idle cUSDC → IERC4626.deposit
// Harvest / draw / claim: same separation as today (claim never redeems principal)
```

### 3.3 Optional `ConfidentialYieldShareToken` (ERC-7984)

If we want transferable private positions:

- Vault mints ERC-7984 “cyUSDC-share” to users instead of internal `_shares` mapping.
- Draw weights read `confidentialBalanceOf` handles (harder to enumerate) **or** keep internal weights mirrored on deposit/withdraw.
- **Recommendation for V2:** start with **internal `_shares` mapping** (same as today’s balances) + clear IERC4626; add transferable share token only if product needs it.

### 3.4 Keeper (`indexer/src/keeper.ts`) changes

| Step | Demo today | Shares V2 |
|------|------------|-----------|
| Allocate | publicDecrypt Σ principal → unwrap → deposit 4626 | publicDecrypt Σ **unallocated** cUSDC / pending deposits → deposit 4626; mint/credit encrypted shares already done on deposit |
| Accrue | MockYield `accrue` | unchanged on Sepolia; drop on Morpho |
| Harvest | harvestClear → encrypt 100% reserve / prizeShareBps | unchanged |
| Draw | `draw()` | weight by `_shares` (or balances) — same FHE loop |
| After user withdraw | re-allocate leftovers often | usually **no** full re-allocate; only top up if idle buffer low |

---

## 4. Withdraw designs (pick one when implementing)

### Option A — Single-user publicDecrypt (simplest V2)

1. User encrypts `sharesToBurn`, vault stores pending burn + `makePubliclyDecryptable` on derived **asset amount** (or decrypt shares and convert with clear share price).
2. RelayerNode / user `publicDecrypt` → `clearAssets`.
3. `finalizeWithdraw(clearAssets, proof)` → `yieldVault.withdraw(min(clearAssets, maxWithdraw), userViaVault)` → wrap → `confidentialTransfer` → burn encrypted shares.
4. **Leak:** that user’s exit size (and timing). Rest of pot stays in Morpho.

### Option B — Batched exits (closer to Morpho batcher)

1. Users queue encrypted burn intents.
2. Keeper publicDecrypts **sum(clearAssets)** only.
3. One `withdraw(sum)` from Morpho → wrap → confidential payouts per user (FHE select / transfers).
4. **Leak:** batch total and participation set; not per-user sizes inside the batch.

### Option C — Idle buffer (hybrid, can ship with little FHE change)

1. Keep today’s encrypted balances.
2. Maintain `idleUnderlying` / idle cUSDC on the prize vault (e.g. 5–10% of TVL or last harvest padding).
3. `withdraw`: if idle covers the exit, pay without touching MockYield; else redeem **deficit only** (still needs a clear size → combine with A) or redeem-all as fallback.
4. Good interim between demo and full shares.

**Recommended post-win path:** **A** for first mainnet Morpho wiring; **B** if privacy of exit sizes matters more than UX latency.

---

## 5. Share price & accounting rules

- Clear IERC4626 share price is public (same as Morpho UI).
- Encrypted user shares × clear price ≈ user assets; users **userDecrypt** their share handle; optional UI shows “≈ assets” using public price without leaking others.
- On allocate: depositing `A` clear USDC into 4626 credits encrypted shares using the same rate the wrapper uses (`WRAP_RATE = 1` for USDC/cUSDC).
- On harvest: surplus clear USDC leaves 4626 via `harvestClear` → does **not** reduce user `_shares` (prize path separate). Principal shares unchanged.
- Rounding: always `min(amount, maxWithdraw)` (lesson from demo `ERC4626ExceededMaxWithdraw`).

---

## 6. Migration from demo vault

1. Freeze allocate on V1; redeem all from MockYield; let users withdraw/claim.
2. Deploy V2 with Morpho (mainnet) or MockYield (Sepolia rehearsal).
3. Users re-deposit into V2 (no trustless in-place share migration unless we write a one-shot migrator that publicDecrypts V1 totals — out of scope).
4. Point app + keeper env at V2; update README leakage table.

---

## 7. Implementation checklist (when you say “build shares”)

- [ ] Spec freeze: Option A vs B vs C
- [ ] Solidity: `_shares` / `_totalShares`; remove redeem-all from principal withdraw
- [ ] `requestWithdrawReveal` + `finalizeWithdraw` (A) or batch queue (B)
- [ ] Tests: two users deposit → allocate → one withdraws → assert MockYield `totalAssets` only drops by ≈ that user; other user’s encrypted shares unchanged
- [ ] Tests: claim still does not call yield redeem
- [ ] Keeper: stop assuming post-withdraw full re-allocate
- [ ] App: withdraw UX (two-step if A); Yield page copy (capital stays invested)
- [ ] Docs: README leakage table + Morpho mainnet addresses
- [ ] Audit focus: share burn vs assets redeemed consistency; donation/inflation on 4626; ACL on new handles

---

## 8. Explicit non-goals for the current demo

- Do **not** rewrite Sepolia demo vault to shares before submission.
- Do **not** empty MockYield on **claim** (already fixed).
- Demo withdraw may keep redeem-all; document leakage honestly.

---

## 9. Pointer for future you

When ready: open this file and say roughly:

> Implement **Option A** from `06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md` against Morpho / MockYield; keep draw/claim/harvest as in today’s `ConfidentialPrizeVault`.

That is enough context to start without rediscovering the thread.
