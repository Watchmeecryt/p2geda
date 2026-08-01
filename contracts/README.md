# ConfiPool contracts

Hardhat/FHEVM contracts for the Sepolia ConfiPool demo.

## What is implemented

- ERC-7984 `transferAndCall` deposits into `ConfidentialPrizeVault`
- encrypted per-user principal and total principal
- encrypted admin-funded prize reserve and prize-per-draw
- deposit-weighted winner selection using `FHE.randEuint64`
- encrypted per-user claimable prizes
- principal withdrawal at any time
- encrypted cumulative prizes-paid accounting
- admin public-reveal request after five completed draws

The production demo uses Zama's existing Sepolia mock pair:

| Asset | Address |
|---|---|
| USDC Mock (underlying) | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| cUSDCMock (ERC-7984) | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |

`MockZama` and `MockConfidentialZama` under `contracts/test/` exist only for local tests (6-decimal USDC stand-ins). The Sepolia deployment script does not deploy replacements.

## Setup

```bash
npm install
npm run compile
npm run typecheck
npm test
```

Hardhat 2 warns on unsupported Node versions. Use Node 20 or 22 LTS for deployment; the local suite has also passed in this workspace under Node 25.

## Sepolia environment

Copy/fill `.env`:

```dotenv
PRIVATE_KEY=0x...
SEPOLIA_RPC_URL=https://ethereum-sepolia-rpc.publicnode.com
USDC_MOCK_ADDRESS=0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF
CUSDC_MOCK_ADDRESS=0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639
DRAW_INTERVAL_SECONDS=300
YIELD_APR_BPS=8000
```

Never commit `.env`. It is ignored; `.env.example` is safe to commit.

Deploy:

```bash
npm run deploy:sepolia
```

The script checks that both official token addresses contain contract code, deploys the vault, writes `deployments/sepolia.json`, and prints:

```dotenv
VITE_CONFIPOOL_VAULT_ADDRESS=0x...
```

### Current deployment

| Field | Value |
|---|---|
| Vault | [`0x6E20A73be3e2913b964a2e5a2E4DB46140E8824A`](https://sepolia.etherscan.io/address/0x6E20A73be3e2913b964a2e5a2E4DB46140E8824A) |
| MockYield4626 | [`0x5303086C213e6B5703Db77ba87c030De019dA6BE`](https://sepolia.etherscan.io/address/0x5303086C213e6B5703Db77ba87c030De019dA6BE) |
| Owner / admin | `0xf2fa17aAbA2a45Dc1184Bf212c7AA3b923f36bC9` |
| Deposit window / draw delay | 120s / 240s |
| Deploy block | `11397960` |

Read live vault state (owner, tokens, draw count, reserve flags) without a wallet:

```bash
npm run verify:sepolia
```

## Interaction model

### Deposit principal

The user calls `cUSDCMock.confidentialTransferAndCall`:

- recipient: deployed vault
- encrypted amount/proof: encrypted for cUSDCMock and the user
- data: `0x`

The callback records the actual transferred amount as encrypted principal.

### Fund prize reserve

The owner calls the same ERC-7984 function, but passes:

```solidity
abi.encode(vault.RESERVE_DEPOSIT_TAG())
```

Only the owner may use that tag. This is the **mock yield source** for the Sepolia demo: an admin-funded prize pot. Principal is never spent as the prize. See the root [README](../README.md#mock-yield-source-and-how-a-real-one-would-plug-in) for how a real yield adapter would credit the same `_prizeReserve` path.

### Configure / draw / claim

1. Owner calls `setPrizePerDraw(encryptedAmount, proof)`.
2. After a closed deposit bus + draw interval, **anyone** may call `draw()` (Draws UI **Draw winner**, or the keeper). Idle redraw with no open bus stays **owner-only**. `draw()` has no encrypted inputs — FHE randomness and weighting run onchain (see [`../indexer`](../indexer#draw-keeper)).
3. Every depositor may call `claim()`. The encrypted amount is zero for non-winners, so a claim transaction alone does not prove who won.

The random ticket is computed as:

```text
floor(random_64_bit × encrypted_total_principal / 2^64)
```

This maps the FHE random word into the encrypted cumulative-balance range without decrypting balances or dividing by an encrypted value.

### Public aggregate reveal

After **five completed draws**, the owner calls:

```solidity
requestTotalPrizesPaidReveal()
```

After **three depositors**, the owner can also publish vault TVL for Metrics:

```solidity
requestPublicTvlReveal()
```

Each call marks the current encrypted aggregate publicly decryptable. The frontend Metrics page uses SDK `publicDecrypt` (no EIP-712). Later claims / deposits create a new handle, so another snapshot can be published.

Keeper allocate still uses ungated `requestTotalPrincipalReveal()` so operations are not blocked by the Metrics deposit threshold.

## Test coverage

`test/ConfidentialPrizeVault.ts` proves:

1. confidential deposits and user-authorized balance decryption
2. principal withdrawal and encrypted over-withdrawal rejection (zero transfer)
3. exactly one prize committed across depositors per funded draw
4. five draws, confidential claims, and public aggregate decryption
5. non-owner reserve funding rejection

Current result:

```text
5 passing
```
