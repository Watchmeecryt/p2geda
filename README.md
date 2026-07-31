# ConfiPool

Confidential no-loss prize savings on [Zama](https://docs.zama.org/protocol/latest). Depositors put **encrypted USDC** into a shared prize vault. Yield funds the prize; draws pick a winner with on-chain FHE randomness; anyone can withdraw their **full principal** at any time.

**Live network:** Sepolia  
**App:** Vite + React (`app/`) · **Contracts:** Hardhat / fhEVM (`contracts/`) · **Keeper + indexer:** Node (`indexer/`)

---

## What you are looking at

ConfiPool is a PoolTogether-style loop with confidential balances:

1. Mint / wrap official Zama **USDC Mock → cUSDCMock**
2. Deposit into `ConfidentialPrizeVault` (amounts stay encrypted)
3. Aggregate TVL is allocated into a clear **ERC-4626** yield venue
4. Harvested yield is re-encrypted into the prize reserve
5. `draw()` awards an encrypted prize; the winner claims; principal stays withdrawable

On Sepolia the yield venue is **MockYield4626** (Morpho-shaped stand-in). On mainnet the same prize vault points at a Morpho USDC vault (e.g. Steakhouse Confidential Prime USDC) — same keeper path, drop the fake `accrue` drip.

Depositors always deposit **one asset (cUSDC)**. Morpho “exposures” (cbBTC / WETH / idle USDC / wstETH) describe where that USDC would be allocated inside Morpho — not a second deposit token. The Yield page shows a Morpho-style stacked exposure preview for that story.

---

## Sepolia deployment

| What | Address |
|------|---------|
| Prize vault | [`0x32A5615195b2a996cF44c14782f87a1aF855EFa0`](https://sepolia.etherscan.io/address/0x32A5615195b2a996cF44c14782f87a1aF855EFa0) |
| MockYield4626 | [`0x66E44187855FFaA0baD1092A5B98EdAbCF3aaf5a`](https://sepolia.etherscan.io/address/0x66E44187855FFaA0baD1092A5B98EdAbCF3aaf5a) |
| USDC Mock (faucet) | [`0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF`](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF) |
| cUSDCMock | [`0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639`](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) |
| Admin / owner (demo) | `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9` |

Deposit window **2 minutes** · draw **3 minutes** after window closes · prize share **80%** of each harvest.  
Live vault JSON: [`contracts/deployments/sepolia.json`](./contracts/deployments/sepolia.json) (redeploy with the demo admin key below before public review).

---

## Demo admin wallet (for reviewers)

Import this **Sepolia-only** key into MetaMask / Rabby so you unlock Admin controls and can run the keeper. Do **not** send mainnet funds to it.

| | |
|--|--|
| Address | `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9` |
| Private key | `0x35273d0406fb4ffc60439748ba596225a7b396d03ac5ae2d328b26fd7c944431` |

Fund this wallet with Sepolia ETH for gas, then use it as `PRIVATE_KEY` / `OWNER_PRIVATE_KEY` when redeploying the vault and running the Railway indexer+keeper. The USDC faucet is in the app (Pool → Use faucet).

---

## Two ways to fund prizes

ConfiPool ships **both** paths so reviewers can test either story.

### Mode A — Admin funds the prize reserve (manual)

Best when you want a short walkthrough without running the keeper.

1. Connect the **demo admin** wallet above.
2. Pool → faucet → wrap → deposit (any wallet can be a depositor).
3. Admin page → fund the encrypted prize reserve and set prize-per-draw.
4. Wait for the draw interval (or trigger draw from Admin), then claim on Draws if you win.

### Mode B — Mock yield + keeper (Morpho path)

Best when you want the full allocate → accrue → harvest → encrypt → draw loop.

1. Depositors deposit cUSDC into the prize vault (encrypted).
2. Run the keeper (see below). It:
   - public-decrypts aggregate TVL → allocates into MockYield4626
   - drips demo APR
   - `harvestClear` → encrypts **100%** into the reserve → sets prize-per-draw to **80%** (20% stays encrypted as padding)
   - calls `draw()` when the interval is due
3. Winner claims on the Draws page.

```bash
cd indexer
cp .env.example .env   # set RPC_URL + OWNER_PRIVATE_KEY (demo key above)
npm run keeper         # continuous
# or: npm run keeper:once
```

The Yield page admin tools (bootstrap allocate / accrue / harvest) are optional overrides. Prefer the keeper for Mode B.

```text
depositors ──cUSDC──► prize vault (encrypted balances)
                         │
              RelayerNode publicDecrypt(Σ) → allocate
                         ▼
                   MockYield4626 (clear ERC-4626)
                         │ accrue → harvestClear
                         ▼
              encrypt 100% → prize reserve (prize/draw = 80%)
                         ▼
                      draw() → claim
```

---

## Quick start (local app)

```bash
# Frontend
cd app
cp .env.example .env
npm install
npm run dev

# Contracts (optional — already deployed on Sepolia)
cd ../contracts
npm install
npm test
```

App env pointers (already filled in `.env.example` for the live Sepolia stack):

- `VITE_CONFIPOOL_VAULT_ADDRESS`
- `VITE_YIELD_VAULT_ADDRESS`
- `VITE_USDC_MOCK_ADDRESS` / `VITE_CUSDC_MOCK_ADDRESS`
- `VITE_RELAYER_WEB_ORIGIN` (browser RelayerWeb proxy)

---

## Repository layout

| Folder | Role |
|--------|------|
| [`app/`](./app) | dApp — Pool, Yield, Draws, Admin, History |
| [`contracts/`](./contracts) | `ConfidentialPrizeVault`, `MockYield4626`, deploy scripts |
| [`indexer/`](./indexer) | Event indexer → Supabase + RelayerNode keeper |
| [`supabase/`](./supabase) | SQL migrations for activity |

Design notes and research live in [`APPROACH.md`](./APPROACH.md), [`PROCESS.md`](./PROCESS.md), [`06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md`](./06-FUTURE-ENCRYPTED-SHARE-WITHDRAW.md) (post-win Morpho-style shares), and the numbered `0*.md` briefs.

---

## Mainnet cutover (later)

1. Underlying → Circle USDC; confidential → mainnet `cUSDC`.
2. `setYieldVault` → Morpho VaultV2 (same USDC asset). `WRAP_RATE` stays `1`.
3. In `indexer/src/relayer.ts`: `sepolia` → `mainnet` + API key auth.
4. Drop MockYield `accrue`; keep allocate / harvestClear / encrypt / draw.

---

## Privacy notes

| Surface | Visibility |
|---------|------------|
| Per-user balances & claimables | Encrypted (user decrypt) |
| Aggregate TVL used for allocate | Publicly decrypted on purpose |
| MockYield / Morpho share price & clear harvest | Public (normal ERC-4626) |
| Prize reserve & prize-per-draw | Encrypted; draw prize is only `prizeShareBps` of harvest |
| Who won | Not emitted; winner sees claimable via decrypt |
