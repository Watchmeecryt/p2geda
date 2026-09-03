<div align="center">

# ConfiPool

Confidential no-loss prize savings on the [Zama Protocol](https://docs.zama.org/protocol/latest).

Deposits stay encrypted onchain (ERC-7984). Draws use FHE randomness + TWAB weighting.
Principal is always yours.

[![Sepolia][sepolia-shield]][sepolia-url]
[![Zama][zama-shield]][zama-url]
[![ERC-7984][erc7984-shield]][erc7984-url]
[![License][license-shield]][license-url]

[Live vault](https://sepolia.etherscan.io/address/0x335339161E31fD94fF5A5d0595eC7526AFe9373F) · [Repo](https://github.com/Watchmeecryt/p2geda)

</div>

---

## Table of contents

- [About](#about)
- [Built with](#built-with)
- [How it works](#how-it-works)
- [What stays private](#what-stays-private)
- [Yield path](#yield-path)
- [Live Sepolia](#live-sepolia)
- [Getting started](#getting-started)
- [Repository layout](#repository-layout)
- [Mainnet](#mainnet)

---

## About

ConfiPool is a PoolTogether V5–style prize pool: people deposit anytime, stay as long as they want, and the keeper runs rounds on a timer (~hourly on Sepolia). Yield (or an admin-funded reserve on Sepolia) pays **Apex / Pulse / Ripple**. Nobody else can see how much you put in, or whether you won.

**60-second loop (Sepolia demo)**

Connect on Sepolia → Pool → faucet → wrap → deposit → wait for the hourly keeper round → decrypt claimable → claim or withdraw.

---

## Built with

| Layer | Stack |
|-------|--------|
| App | Vite, React, wagmi, `@zama-fhe/react-sdk` |
| Contracts | Hardhat, `@fhevm/solidity`, ERC-7984 |
| Indexer + keeper | Node, viem, RelayerNode, Supabase |

---

## How it works

1. **Faucet / wrap** — Mint Zama USDC Mock, wrap to cUSDCMock (ERC-7984).
2. **Deposit** — `confidentialTransferAndCall` into `ConfidentialPrizeVault`. The vault appends a TWAB observation (encrypted balance + encrypted cumulative).
3. **Hold** — No deposit bus. Optional `IYieldSource` parks principal; `harvest()` folds yield into the encrypted prize reserve. On Sepolia, Admin → Fund reserve seeds that pot.
4. **Draw** — After `minPeriod` (120s on this vault):
   - `beginRound()` freezes TWAB weight and draws encrypted `R` + encrypted total weight
   - `unsealRound()` publishes clear `R` and `totalWeight` (KMS signatures) — not your personal weight
   - `scoreEntrant` / `scoreEntrants` evaluates **Apex / Pulse / Ripple** per depositor against plaintext thresholds from `keccak256(R, drawId, user, tier)`
5. **Claim** — `claim()` confidential-transfers pending credits. Decrypt with EIP-712. Non-winners can still claim (encrypted zero), so the tx does not advertise winners.
6. **Withdraw** — Encrypted principal out anytime. No lock, no penalty.

### Tiers

| Tier | Role | Odds |
|------|------|------|
| **Apex** | Largest, rarest | High `k` |
| **Pulse** | Mid prize | Medium `k` |
| **Ripple** | Small, frequent (`k = 1`) | ~1 winner per draw — demo-friendly with two wallets |

```text
depositors ──cUSDC──► prize vault (encrypted balances + TWAB)
                         │ optional IYieldSource.supply
                         ▼
              ConfidentialVaultSource → Zama batchers → Morpho / Steakhouse
                         │ harvest → prize reserve
                         ▼
         beginRound → unsealRound → scoreEntrant (Apex / Pulse / Ripple) → claim
                         │
                      withdraw principal
```

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

## What stays private

| Encrypted | How |
|-----------|-----|
| Your deposit / pool balance | ERC-7984 / TWAB `euint64` · `euint128` — EIP-712 userDecrypt for that wallet only |
| Unclaimed winnings | Same |
| Prize reserve | Encrypted; owner can decrypt |
| Per-user TWAB weight | Never published |
| Winner identity | Not emitted — scoreEntrant runs for every depositor |

| Public on purpose | Why |
|-------------------|-----|
| That a deposit / draw / claim happened | Logs exist; amounts stay handles |
| Who is in the pool | Enumerable list (cap 256); sizes stay encrypted |
| Draw `R` + total TWAB weight | Needed for independent plaintext thresholds |
| Tier sizes and `k` | Odds schedule is public |
| Aggregate prizes paid | Optional, after admin reveal (≥ 5 draws by default) |

Winner selection: `beginRound` uses onchain `FHE.randEuint64()`. After reveal, each account is checked independently. Best tier wins (Apex > Pulse > Ripple). If the reserve cannot cover it, the credit is encrypted zero.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

## Yield path

| Contract | Role |
|----------|------|
| `IYieldSource` | Vault ↔ adapter |
| `ConfidentialVaultSource` | Parks principal via Zama deposit / redeem batchers; buffer for exits; harvest into the prize reserve |

```text
User → prize vault
         │ supply(cUSDC)
         ▼
ConfidentialVaultSource
         │ joinVault() → half of idle principal
         ▼
Zama deposit batcher ──aggregate──► Morpho / Steakhouse ERC-4626
         │
         ▼ claimShares → encrypted cShares
         │
         ▼ requestUnwind / claimUnwound → cUSDC buffer
         │
         ▼ harvest() → prize reserve
```

Users encrypt when they deposit. The keeper later calls `joinVault` / `claimShares` / `harvest` — it moves already-encrypted balances; it does not invent new input proofs.

- Individual sizes stay encrypted; only the **batch aggregate** is decrypted for the ERC-4626 route.
- Most exits pay from the cUSDC buffer; if thin, unwind shares through the redeem batcher (async).
- **Sepolia:** staging Morpho does not drip APY — `rateBps` + Admin → Fund reserve seed prizes.
- **Mainnet:** same adapter, live Steakhouse / Morpho yield via `harvest()`.

Official Zama addresses: [`sepolia-confidential-vault.json`](./contracts/deployments/sepolia-confidential-vault.json), [`mainnet-confidential-vault.json`](./contracts/deployments/mainnet-confidential-vault.json) — from [Zama confidential vault addresses](https://docs.zama.org/protocol/confidential-vault/reference/addresses).

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

## Live Sepolia

| Piece | Address |
|-------|---------|
| Prize vault | [`0x3353…373F`](https://sepolia.etherscan.io/address/0x335339161E31fD94fF5A5d0595eC7526AFe9373F) |
| ConfidentialVaultSource | [`0xf015…8923`](https://sepolia.etherscan.io/address/0xf0150cC2297065f28f41D9cf481F3aE9D6028923) |
| USDC Mock (faucet) | [`0x9b5C…DFfF`](https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF) |
| cUSDCMock | [`0x7c5B…3639`](https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639) |
| Admin / owner | `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9` |

- **minPeriod:** 120s · **tiers:** Apex 100 / Pulse 25 / Ripple 5 · deploy block `11621678`
- Deployment JSON: [`contracts/deployments/sepolia.json`](./contracts/deployments/sepolia.json)
- `beginRound` is permissionless after `minPeriod`. In-app faucet: Pool → Use faucet.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

## Getting started

### App

```bash
cd app
cp .env.example .env
npm install
npm run dev
```

Env (already filled in `.env.example` for the live stack):

- `VITE_CONFIPOOL_VAULT_ADDRESS` / `VITE_YIELD_VAULT_ADDRESS`
- `VITE_USDC_MOCK_ADDRESS` / `VITE_CUSDC_MOCK_ADDRESS`
- `VITE_RELAYER_WEB_ORIGIN`

Production build: `npm run build` (see [`netlify.toml`](./netlify.toml)).

### Contracts

```bash
cd contracts
cp .env.example .env   # PRIVATE_KEY, SEPOLIA_RPC_URL, MIN_PERIOD_SECONDS=120
npm install
npm run compile
npm test
npm run deploy:sepolia
VAULT_ADDRESS=0x… npm run deploy:vault-source:sepolia
```

Scripts: [`deploy-sepolia.ts`](./contracts/scripts/deploy-sepolia.ts), [`deploy-yield-sepolia.ts`](./contracts/scripts/deploy-yield-sepolia.ts), [`verify-deployment.ts`](./contracts/scripts/verify-deployment.ts).

### Indexer + keeper

```bash
cd indexer
cp .env.example .env
npm install
npm start              # indexer + keeper
# or: npm run start:indexer   /   npm run keeper
```

`npm start` is what you want for a demo: History stays current, and the keeper runs rounds about once an hour.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

## Repository layout

| Folder | Role |
|--------|------|
| [`app/`](./app) | dApp — Pool, Draws, History, Yield, Admin |
| [`contracts/`](./contracts) | `ConfidentialPrizeVault`, `ConfidentialVaultSource`, tests |
| [`indexer/`](./indexer) | Event indexer → Supabase + RelayerNode keeper |
| [`supabase/`](./supabase) | SQL migrations for activity |


---

## Mainnet

1. Underlying → Circle USDC; confidential → mainnet `cUSDC`.
2. Deploy the vault with a longer `minPeriod` (day / week).
3. Point `ConfidentialVaultSource` at live Steakhouse / Morpho addresses.
4. In `indexer/src/relayer.ts`: `sepolia` → `mainnet` + API key auth. Keeper still runs `joinVault` / `harvest` / `beginRound` / `unsealRound` / `scoreEntrants`.

<p align="right">(<a href="#table-of-contents">back to top</a>)</p>

---

<!-- Badge / link refs (Best-README-Template style — keeps the body readable) -->

[sepolia-shield]: https://img.shields.io/badge/network-Sepolia-11155111?style=for-the-badge&labelColor=111111
[sepolia-url]: https://sepolia.etherscan.io/address/0x335339161E31fD94fF5A5d0595eC7526AFe9373F
[zama-shield]: https://img.shields.io/badge/protocol-Zama%20fhEVM-FFD209?style=for-the-badge&labelColor=111111
[zama-url]: https://docs.zama.org/protocol/latest
[erc7984-shield]: https://img.shields.io/badge/token-ERC--7984-FF6C2F?style=for-the-badge&labelColor=111111
[erc7984-url]: https://eips.ethereum.org/EIPS/eip-7984
[license-shield]: https://img.shields.io/badge/license-BSD--3--Clause--Clear-4B5563?style=for-the-badge&labelColor=111111
[license-url]: https://github.com/Watchmeecryt/p2geda
