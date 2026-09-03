# ConfiPool contracts

Hardhat / fhEVM contracts for confidential no-loss prize savings (PoolTogether V5–style).

## Contracts that ship

| Contract | Role |
|----------|------|
| **`ConfidentialPrizeVault`** | The pool: deposits, TWAB, Apex/Pulse/Ripple draws, claims, withdraws |
| **`ConfidentialVaultSource`** | Yield adapter: parks cUSDC via Zama batchers into Morpho/Steakhouse-shaped shares |
| **`IYieldSource`** | Interface between vault and adapter |
| **`IConfidentialPrizeVault`** | Vault surface for integrators |

**Test-only** (not deployed to Sepolia): `MockZama`, `MockConfidentialZama`, `MockVaultBatchers`, `ConfidentialPrizeVaultHarness`.

## Why two live contracts?

- **Prize vault** = product rules (who deposited, TWAB weights, who wins Apex/Pulse/Ripple, claims).
- **Vault source** = where principal **earns** (Zama confidential batchers → Morpho-shaped ERC-4626 → encrypted shares). The vault does not talk to Morpho directly; it calls `IYieldSource`.

```text
User cUSDC ──► ConfidentialPrizeVault ──supply──► ConfidentialVaultSource
                                                      │ joinVault
                                                      ▼
                                              Zama deposit batcher
                                                      │
                                                      ▼
                                              Morpho / Steakhouse ERC-4626
                                                      │
                                                      ▼
                                              encrypted shares (+ cUSDC buffer)
                                                      │ harvest
                                                      ▼
                                              prize reserve → draws
```

## Setup

```bash
npm install
npm run compile
npm test
```

## Sepolia deploy

```dotenv
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
CUSDC_MOCK_ADDRESS=0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639
USDC_MOCK_ADDRESS=0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
MIN_PERIOD_SECONDS=120
RATE_BPS=500
```

```bash
npm run deploy:sepolia
VAULT_ADDRESS=0x... npm run deploy:vault-source:sepolia
```

Batcher addresses (official docs only):
[`deployments/sepolia-confidential-vault.json`](./deployments/sepolia-confidential-vault.json) ·
[`deployments/mainnet-confidential-vault.json`](./deployments/mainnet-confidential-vault.json)
— [Zama confidential vault addresses](https://docs.zama.org/protocol/confidential-vault/reference/addresses).

## Official Sepolia tokens

| Asset | Address |
|-------|---------|
| USDC Mock | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| cUSDCMock | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |
