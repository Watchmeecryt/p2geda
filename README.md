# ConfiPool

Confidential **no-loss prize savings** on the [Zama Protocol](https://docs.zama.org/protocol/latest) — a PoolTogether-style loop where deposits stay encrypted onchain (ERC-7984), draws use onchain FHE randomness, and principal is always withdrawable.

| | |
|--|--|
| **Network** | Ethereum Sepolia |
| **GitHub** | [Watchmeecryt/p2geda](https://github.com/Watchmeecryt/p2geda) |
| **Stack** | Vite + React (`app/`) · Hardhat / fhEVM (`contracts/`) · Node indexer + keeper (`indexer/`) |

Connect a wallet on Sepolia → Pool → faucet → wrap → deposit → decrypt your balance → wait for the countdown (or click **Draw winner** when ready) → claim / withdraw.

---

## How the pool and draws work

1. **Faucet / wrap** — Mint official Zama **USDC Mock**, wrap to **cUSDCMock** (ERC-7984).
2. **Deposit** — `confidentialTransferAndCall` into `ConfidentialPrizeVault`. Your principal is an encrypted `euint64` balance.
3. **Deposit bus** — First deposit opens a **120s** window. More deposits join the same bus. After close, the keeper parks aggregate TVL into the yield venue.
4. **Draw** — **60s** after the window closes (and yield has been harvested into the reserve), **anyone** may call `draw()` — the Draws page **Draw winner** button, or the keeper:
   - Onchain `FHE.randEuint64()`
   - Deposit-weighted selection over **encrypted** balances (no plaintext sizes)
   - Winner’s encrypted claimable increases; everyone else gets an encrypted zero
5. **Claim** — Winner (or any depositor — non-winners transfer encrypted zero) claims via confidential transfer; decrypt winnings with **EIP-712**.
6. **Withdraw** — Exit with **full principal** anytime (no loss).

**Who can draw**

| Who | When |
|-----|------|
| **Anyone** (default) | After a **closed deposit bus** + draw interval — click **Draw winner** on Draws |
| **Keeper** | Same bus path; on mainnet this is the usual automation so nobody clicks |
| **Admin** | Idle redraw after `lastDrawAt + interval` with **no** new deposit bus (owner-only) |

Prize size at draw: owner **EIP-712 userDecrypt** of the encrypted prize reserve → set prize-per-draw to **`prizeShareBps`** (default **80%**) → `draw()`. The pot is **not** made publicly decryptable for that step.

```text
depositors ──cUSDC──► prize vault (encrypted balances)
                         │
              publicDecrypt(Σ TVL) → allocate (clear size for ERC-4626)
                         ▼
                   MockYield4626 (clear ERC-4626)
                         │ accrue → harvestClear
                         ▼
         encrypt 100% → prize reserve → EIP-712 userDecrypt → 80% prize/draw
                         ▼
                      draw() → claim / withdraw
```

---

## Confidentiality design

### What stays encrypted

| Surface | How |
|---------|-----|
| Per-user deposit / pool balance | ERC-7984 / `euint64`; EIP-712 **userDecrypt** only for that wallet |
| Per-user claimable winnings | Same |
| Prize reserve & prize-per-draw | Encrypted; owner can userDecrypt (Admin UI / keeper sizing) |
| Winner identity | **Not emitted** onchain; FHE selection stays private |
| Individual odds | Not published (would require plaintext balances) |

### What can leak (documented)

| Surface | Leak | Why / mitigation |
|---------|------|------------------|
| That a draw / deposit / withdraw / claim tx happened | Public logs + tx pattern | Indexing & UX; amounts stay handles |
| Who is in the pool | Enumerable depositor list (cap **256**) | Settlement is batched (`MAX_SETTLE_PER_TX`); sizes stay encrypted |
| Aggregate TVL (Metrics) | After admin `requestPublicTvlReveal` (≥ **3** depositors by default) | Optional public stats |
| Aggregate prizes paid (Metrics) | After admin `requestTotalPrizesPaidReveal` (≥ **5** draws by default) | Optional public stats |
| Aggregate TVL for **allocate** | Keeper `requestTotalPrincipalReveal` + `publicDecrypt` | Clear size required to deposit into ERC-4626 |
| Clear `allocatedUnderlying` | Public uint after allocate | Accounting for how much is parked in MockYield |
| `harvestClear` surplus size | Clear ERC-20 + event | Demo harvest; then re-encrypted 100% into reserve |
| Prize size inference | Public `prizeShareBps` (default 80%) × last clear harvest | Observer can estimate ≈ prize; residual ~20% stays in encrypted reserve as padding |
| Allocated principal exit size | `finalizeWithdraw` clear assets | Needed to redeem only that slice from ERC-4626; idle (unallocated) exits stay fully encrypted |
| Optional pot reveal | Owner may call `requestPrizeReserveReveal` | **Not** used by the keeper; draw sizing uses EIP-712 userDecrypt instead |
| Draw history “addresses” | Tx hashes, not winners | Indexer shows draw txs |

Thresholds for Metrics publishes are admin-updatable (`setMinDepositsBeforePublicTvlReveal` / `setMinDrawsBeforePublicReveal`).

### Winner selection (meets the FHE draw requirement)

Winners are selected **onchain** using FHE randomness, **weighted by time-in-bus deposit size**, over **encrypted balances**:

1. `FHE.randEuint64()` produces an encrypted random ticket (no offchain RNG, no admin seed).
2. Each depositor’s encrypted weight is `balance × secondsHeldInBus / busWindow` (late joiners get less weight).
3. **Compact buses** (≤ `MAX_SETTLE_PER_TX`): one transaction runs ConfiPool’s cumulative encrypted walk and credits exactly one winner via `FHE.select`.
4. **Larger buses**: `EncryptedSlotDraw` issues one encrypted ticket, then `settle` batches independently check each depositor’s encrypted fill — so capacity is not stuck at 32 from sequential HCU depth.

Balances are never decrypted to pick a winner. Individual odds are not published. The registry allows up to **256** depositors; only participation is public.

### Principal withdraw (allocated capital)

- If nothing is parked in MockYield: one-step confidential transfer (unchanged UX).
- If capital is allocated: `withdraw` stages an encrypted amount → publicDecrypt the size → `finalizeWithdraw` redeems **only that clear slice** from the yield venue, wraps, and pays the user. Other depositors’ capital can remain invested.

---

## Yield-source mock

On Sepolia the prize vault’s yield venue is **`MockYield4626`** — an ERC-4626 with a configurable APR drip (`accrue`). It stands in for a Morpho-style USDC vault.

| Mode | What happens |
|------|----------------|
| **A — Admin fund** | Admin encrypts cUSDC into the prize reserve and sets prize-per-draw (no yield needed). |
| **B — Mock yield + keeper** | Allocate idle principal → `accrue` → `harvestClear` → wrap/encrypt **100%** into reserve → size 80% → draw. |

**Mainnet plug-in:** same prize vault + keeper path; point `setYieldVault` at a Morpho USDC vault (e.g. Steakhouse), drop fake `accrue`, keep allocate / harvest / encrypt / draw. Depositors still deposit **one** asset (cUSDC); Morpho “exposures” on the Yield page are narrative only.

---

## Sepolia deployment (live)

| What | Address |
|------|---------|
| Prize vault | [`0xdcD95B91EEadF241B7ce8c899272E164bFc2A4B2`](https://sepolia.etherscan.io/address/0xdcD95B91EEadF241B7ce8c899272E164bFc2A4B2) |
| MockYield4626 | [`0x7f3fFa3d8F80477134b2D9a802c85BAbf50a0187`](https://sepolia.etherscan.io/address/0x7f3fFa3d8F80477134b2D9a802c85BAbf50a0187) |
| USDC Mock (faucet) | [`0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF`](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF) |
| cUSDCMock | [`0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) |
| Admin / owner (demo) | `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9` |

Deposit window **120s** · draw delay **60s** · deploy block **`11404729`**.  
JSON: [`contracts/deployments/sepolia.json`](./contracts/deployments/sepolia.json).

Bus draws are **permissionless** — any wallet can click **Draw winner** on Draws when the countdown is due. No demo private key is published in this repo. Vault owner address (for Admin / idle redraws): `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9`. In-app faucet: Pool → Use faucet.

---

## Deployment scripts

### Contracts (Hardhat)

```bash
cd contracts
cp .env.example .env   # PRIVATE_KEY, SEPOLIA_RPC_URL, token addresses, timings
npm install
npm run compile
npm test

# Vault only (no yield)
npm run deploy:sepolia

# MockYield4626 + prize vault + setYieldVault (current live path)
npm run deploy:yield:sepolia

# Read back live vault state
npm run verify:sepolia
```

Scripts:

- [`contracts/scripts/deploy-sepolia.ts`](./contracts/scripts/deploy-sepolia.ts)
- [`contracts/scripts/deploy-yield-sepolia.ts`](./contracts/scripts/deploy-yield-sepolia.ts)
- [`contracts/scripts/verify-deployment.ts`](./contracts/scripts/verify-deployment.ts)

### Frontend (Netlify / local)

```bash
cd app
cp .env.example .env   # vault / yield / tokens / VITE_RELAYER_WEB_ORIGIN
npm install
npm run dev            # local
npm run build          # production (see netlify.toml → base app/)
```

Config: [`netlify.toml`](./netlify.toml).

### Indexer + keeper (Railway / local)

```bash
cd indexer
cp .env.example .env   # RPC_URL, VAULT_ADDRESS, DEPLOYMENT_BLOCK, Supabase… (+ optional OWNER_PRIVATE_KEY for allocate/harvest)
npm install
npm start              # indexer + keeper together
# or: npm run keeper / npm run keeper:once
```

---

## Quick start (local app)

```bash
cd app && cp .env.example .env && npm install && npm run dev
```

Env pointers (filled for the live Sepolia stack in `.env.example`):

- `VITE_CONFIPOOL_VAULT_ADDRESS` / `VITE_YIELD_VAULT_ADDRESS`
- `VITE_USDC_MOCK_ADDRESS` / `VITE_CUSDC_MOCK_ADDRESS`
- `VITE_RELAYER_WEB_ORIGIN` (browser RelayerWeb proxy)

---

## Repository layout

| Folder | Role |
|--------|------|
| [`app/`](./app) | dApp — Pool, Draws, History, Metrics, Yield, Admin |
| [`contracts/`](./contracts) | `ConfidentialPrizeVault`, `MockYield4626`, deploy scripts |
| [`indexer/`](./indexer) | Event indexer → Supabase + RelayerNode keeper |
| [`supabase/`](./supabase) | SQL migrations for activity |

Design notes: [`APPROACH.md`](./APPROACH.md), [`PROCESS.md`](./PROCESS.md), [`01-BOUNTY-BRIEF.md`](./01-BOUNTY-BRIEF.md), [`06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md`](./06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md).

---

## Mainnet cutover (later)

1. Underlying → Circle USDC; confidential → mainnet `cUSDC`.
2. `setYieldVault` → Morpho VaultV2 (same USDC asset).
3. In `indexer/src/relayer.ts`: `sepolia` → `mainnet` + API key auth.
4. Drop MockYield `accrue`; keep allocate / harvestClear / encrypt / draw.
