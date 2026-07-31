# APPROACH — How we build **ConfiPool**

**Product name:** **ConfiPool** (short mark: **CPool**) — confidential no-loss prize pool.  
Parallel naming to TokenOps’ **ConfiDrop**: clear, specific, not generic “Confidential PoolTogether clone.”

**Status:** Decisions locked (updated 2026-07-30). Enough to build.  
**Network:** Sepolia only.  
**Asset:** Official Zama registry pair **USDC Mock** + **cUSDCMock** (no custom ERC-20 deploy).  
**Yield:** MockYield4626 on Sepolia (Morpho stand-in); mainnet → Morpho Steakhouse Confidential Prime USDC.  
**Post-win principal exits:** see [`06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md`](./06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md) (encrypted shares so withdraw does not empty the yield venue).  
**UI:** Light-only · glassy · rounded · Telegraf · Hugeicons · TokenOps-neat landing · ERC7984 glass system with zWallet teal-emerald (`#0b6e4f`) replacing black.

---

## 1. The product in one picture

```text
┌──────────────────────────────────────────────────────────────────┐
│  ConfiPool APP (Vite + React)                                    │
│  Landing (TokenOps-clean) · Faucet · Deposit · Decrypt · Draw    │
│  Claim · Withdraw · Admin (reserve, draw, public-decrypt totals) │
│  RelayerWeb ← VITE_RELAYER_WEB_ORIGIN · Sepolia RPC in .env      │
└────────────────────────────┬─────────────────────────────────────┘
                             │
┌────────────────────────────▼─────────────────────────────────────┐
│  OUR CONTRACTS (deploy)                                          │
│  ConfidentialPrizeVault (+ interfaces)                           │
│    · encrypted user balances (euint)                             │
│    · deposit / withdraw (no-loss)                                │
│    · admin prize reserve                                         │
│    · draw() FHE.rand + deposit-weighted winner                   │
│    · encrypted totalPrizesPaid + admin makePubliclyDecryptable   │
│                                                                  │
│  EXISTING ON SEPOLIA (do not redeploy)                           │
│  USDC Mock (underlying, public mint 1M)                          │
│  cUSDCMock (ERC-7984 wrapper)                                    │
│  Wrappers Registry 0x2f0750Bbb0A246059d80e94c454586a7F27a128e  │
└──────────────────────────────────────────────────────────────────┘
```

**Yes — we create a vault** (`ConfidentialPrizeVault`). Users put **USDC Mock / cUSDCMock** into the shared prize vault; balances stay encrypted; yield harvest + admin fund the prize reserve; draws award yield with onchain FHE randomness.

We are **not** rebuilding PoolTogether V5. Bounty loop only:

> **Deposit → hold confidential balance → draw → claim → withdraw principal**  
> **(+ admin: after ≥5 draws, publicly decrypt total prizes paid)**

---

## 2. Product name

| | |
|--|--|
| **Name** | **ConfiPool** |
| **Short** | **CPool** |
| **Tagline** | No-loss prize savings — deposits encrypted, odds private, principal always yours |
| **Why** | Specific to confidential pooling; sits next to **ConfiDrop** in our portfolio; not a generic “PoolTogether FHE” label |

(If you prefer another mark later — e.g. **CloakPot** — we only rename UI strings.)

---

## 3. Token pair (official Sepolia mocks)

From [Zama Sepolia addresses](https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia) and our snapshot `ERC7984-bounty/config/official-sepolia.json`:

| Role | Symbol | Address |
|------|--------|---------|
| Underlying ERC-20 | **USDC Mock** | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| Confidential ERC-7984 | **cUSDCMock** | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |
| Wrappers registry | — | `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` |

**Faucet for judges:** call underlying `mint(to, amount)` — public, max **1,000,000** tokens per call (Zama docs). Both legs are **6 decimals** (`WRAP_RATE = 1`).

**UI branding:** USDC / Morpho icons under `app/public/icons/` + Hugeicons for nav/actions.

### Deposit path (locked)

1. **Faucet** — mint **USDC Mock**  
2. **Wrap** — `approve` + wrap into **cUSDCMock** (official ERC-7984)  
3. **Deposit** — move confidential balance into the vault (confidential transfer / vault deposit with encrypted accounting)  
4. **Hold** — vault tracks encrypted pool share / balance; EIP-712 **user decrypt** for “my balance”  
5. **Withdraw** — exit to cUSDC / unwrap to underlying — **full principal, no loss**

Admin prize reserve is funded via yield harvest (preferred) or confidential transfer with the reserve tag.

---

## 4. User + admin loops

### Users (judges)

| Step | Action |
|------|--------|
| 0 | Faucet USDC Mock |
| 1 | Wrap → cUSDCMock |
| 2 | Deposit into ConfiPool vault |
| 3 | Decrypt my pool balance (EIP-712) |
| 4 | After a draw: claim prize if winner (decrypt winnings) |
| 5 | Withdraw principal anytime |

### Admin / keeper

| Step | Action |
|------|--------|
| A | Fund prize reserve |
| B | Trigger `draw()` on interval |
| C | After **≥ 5 draws** completed: `requestRevealTotalPrizesPaid()` → mark encrypted accumulator **publicly decryptable** |
| D | Admin UI runs **publicDecrypt** (SDK, **no EIP-712**) and shows total prizes paid so far |

Threshold **5** is configurable in contract (constant or admin-set); default **5**.

---

## 5. Contracts we create

Hardhat FHEVM package under `put-together/contracts/` (same stack as `ERC7984-bounty/contracts`).

```text
contracts/
  contracts/
    vault/ConfidentialPrizeVault.sol
    interfaces/IConfidentialPrizeVault.sol
    interfaces/IPrizeReserve.sol   # if split; else methods on vault
  scripts/deploy-sepolia.ts
  test/
```

**We do not deploy** USDC Mock / cUSDCMock — wire addresses in config/env.

| Surface | Responsibility |
|---------|----------------|
| **ConfidentialPrizeVault** | Custody + encrypted balances; deposit/withdraw; reserve; draw; claim; prize accumulator |
| **Interfaces** | Clean ABI for app + README |

### Encrypted prize accumulator + public decrypt (your request)

On each successful prize payout:

```solidity
// conceptual
totalPrizesPaidEncrypted = FHE.add(totalPrizesPaidEncrypted, prizeAmountEncrypted);
drawsCompleted += 1;
```

Admin reveal (only when `drawsCompleted >= REVEAL_AFTER_DRAWS` e.g. 5):

```solidity
function requestRevealTotalPrizesPaid() external onlyAdmin {
  require(drawsCompleted >= REVEAL_AFTER_DRAWS, "too early");
  require(!totalPrizesPaidPubliclyDecryptable, "already");
  FHE.makePubliclyDecryptable(totalPrizesPaidEncrypted); // exact API per @fhevm/solidity version
  totalPrizesPaidPubliclyDecryptable = true;
  // emit handle for frontend
}
```

Frontend Admin panel:

1. Call `requestRevealTotalPrizesPaid` if needed  
2. `sdk` / RelayerWeb **`publicDecrypt`** on the handle — **no wallet EIP-712**  
3. Display cleartext total rewards paid to winners  

Document leakage: after reveal, **anyone** can public-decrypt that aggregate (intentional transparency of total yield distributed, not per-user deposits).

Skill refs: `zama-fhevm-public-decryption`, `zama-fhevm-user-decryption-eip712`.

### Confidentiality table

| Encrypted until… | Public / leaky |
|------------------|----------------|
| Per-user deposits & balances | Address interacted with vault |
| Draw ticket & weights | Draw id / time |
| Individual prize amounts (winner user-decrypts) | Optional winner address on claim — document |
| **Sum of prizes paid** | Encrypted until admin reveal (≥5 draws); then publicly decryptable |

**Weighting:** encrypted spot balance at draw (not TWAB).  
**Draw trigger:** admin/keeper tx + Admin UI.

---

## 6. Draw design (unchanged core)

Inside `draw()` (transaction only):

1. Interval elapsed + reserve funded  
2. `FHE.randEuint*(powerOfTwoBound)`  
3. Deposit-weighted select over encrypted balances (`FHE.le` / `lt` / `select`)  
4. Credit encrypted prize; `FHE.add` into `totalPrizesPaidEncrypted`  
5. Minimal events (no amounts)

Cap depositor set for Sepolia gas; document cap.

---

## 7. Frontend approach

### Visual direction

| Source | Take |
|--------|------|
| **`tokenops/tokenops-x`** | Neat landing / illustrated hero / short copy that sells the product; sparse layout; Telegraf; yellow accent |
| **`ERC7984-bounty/frontend`** | Glass cards, sidebar radius, RelayerWeb wiring, Hugeicons usage |
| **`zwallet/brand/tokens.css`** | Teal-emerald brand palette — the accent we adopt wholesale |
| **This app** | **Light mode only** (no dark toggle); every pure-black CTA/active state becomes **teal-emerald**; rounded + glassy; not crazy |

### Accent palette (from `zwallet/brand/tokens.css`, light values only)

We reuse zWallet's teal-emerald as the ConfiPool accent, renamed to a `--cp-*` prefix so the two products stay independent. Emerald is for interaction only — buttons, active nav, focus rings, selected rows, the hero wash. Body copy stays ink, and success/danger/warning keep their own semantic colors rather than being recolored green.

| ConfiPool token | Value | Use |
|-----------------|-------|-----|
| `--cp-accent` | `#0b6e4f` | Primary brand, filled controls (replaces black) |
| `--cp-accent-bright` | `#12966c` | Hover / brighter CTA |
| `--cp-accent-deep` | `#085a40` | Pressed, gradient end |
| `--cp-accent-mint` | `#9fe8c9` | Soft highlight, glass strokes, glow |
| `--cp-accent-soft` | `rgba(11,110,79,.10)` | Selected rows, chips, glass tint |
| `--cp-accent-glow` | `rgba(11,110,79,.22)` | Shadow under primary buttons |
| `--cp-on-accent` | `#f4fbef` | Text/icons on an emerald fill |
| `--cp-canvas` | `#eef3f2` | Page background |
| `--cp-panel` | `#f6faf9` | Soft panels / alt bands |
| `--cp-elevated` | `#ffffff` | Glass cards, sheets, menus |
| `--cp-hero-band` | `#d9ebe3` | Landing hero band |
| `--cp-ink` / `--cp-muted` / `--cp-dim` | `#0c1a16` / `#4a5f58` / `#7a8e86` | Text ramp |
| `--cp-line` / `--cp-line-soft` | `rgba(12,26,22,.12)` / `rgba(12,26,22,.06)` | Borders, hairlines |
| `--cp-success` / `--cp-danger` / `--cp-warning` | `#0a9429` / `#dd3232` / `#c9850a` | Semantic, never rebranded |

Primary button fill: `linear-gradient(180deg, #12966c 0%, #0b6e4f 100%)` with shadow `0 0 0 1px #0b6e4f, 0 4px 8px rgba(11,110,79,.2), 0 12px 32px -8px rgba(11,110,79,.28)`. Radii follow zWallet: `0.5rem` / `0.75rem` / `1.35rem` / pill.

### Icons & assets

- **Hugeicons** (`@hugeicons/react` + `@hugeicons/core-free-icons` — same family as ERC7984 / ConfiDrop)  
- **USDC / Morpho marks:** `app/public/icons/usdc.svg`, `morpho.jpg`, exposure icons

### Screens

1. **Landing** — brand **ConfiPool**, one headline, one sentence, one CTA (TokenOps-neat, not a dashboard)  
2. **App shell** — Faucet · Deposit · Balance (decrypt) · Withdraw · Draw/Claim · Admin  
3. **Admin** — fund reserve · trigger draw · reveal + public-decrypt total prizes paid  

### Stack

- Vite + React + wagmi + viem  
- `@zama-fhe/react-sdk` + `@zama-fhe/sdk`  
- `VITE_RELAYER_WEB_ORIGIN`, `VITE_SEPOLIA_RPC_URL`, vault address, token addresses  

---

## 8. Folder plan

```text
put-together/
  APPROACH.md   ← this file
  PROCESS.md
  README.md
  01-…05-… research
  contracts/    ← Phase 2
  app/          ← Phase 3 (ConfiPool UI)
```

---

## 9. Build order

1. Scaffold `contracts/` (Hardhat FHEVM) — vault + interfaces (no mock token contract)  
2. Deposit / withdraw against **USDC Mock / cUSDCMock** addresses  
3. Reserve + draw + claim + **encrypted totalPrizesPaid** + **requestRevealTotalPrizesPaid**  
4. Tests / Sepolia deploy script  
5. Scaffold `app/` — TokenOps-neat landing + ERC7984 glass shell, light-only  
6. Hooks: mint, wrap, deposit, userDecrypt, draw, claim, withdraw, publicDecrypt totals  
7. README for judges: tokens, faucet, mock yield, leakage, admin reveal  

---

## 10. Locked checklist

- [x] Vault yes  
- [x] Admin prize reserve (mock yield)  
- [x] Official **cUSDCMock** + **USDC Mock** (Morpho-ready asset)  
- [x] Admin public decrypt of **cumulative prizes paid** after ≥5 draws  
- [x] User balances / winnings = EIP-712 user decrypt  
- [x] Aggregate paid = public decrypt (no EIP-712) after admin marks decryptable  
- [x] Name **ConfiPool** / CPool  
- [x] Landing TokenOps-neat; app glass + Hugeicons + USDC/Morpho icons; light only  
- [x] Sepolia + relayer env pattern  

---

## 11. Mental model

> **ConfiPool** is a no-loss jar of **USDC**: you wrap to **cUSDC**, deposit without revealing size, yield harvest (and admin fallback) funds prizes, encrypted draws pick winners fairly, winners decrypt claims, you can leave with full principal — and after five draws the admin can publish the **total prizes paid** for anyone to public-decrypt.
