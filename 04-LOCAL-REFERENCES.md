# 04 — Local repo references (reuse, don’t reinvent)

Root workspace: `E:/Cusdt`. These are the nearby folders we should lean on for the confidential PoolTogether build.

---

## ERC-7984 / confidential token patterns

### `ERC7984-bounty/`

| Path | Why it matters |
|------|----------------|
| `contracts/contracts/ConfidentialTokenWrapper.sol` | Thin OZ `ERC7984ERC20Wrapper` + `ZamaEthereumConfig` — wrap underlying → confidential token |
| `contracts/contracts/rfq/**` | Full FHE protocol (ConfidentialSwap): encrypted intents, escrow, ACL, upgradeable Zama config — pattern for complex encrypted state machines |
| `contracts-rfq/protocol/**` | Alternate / etherscan-synced RFQ sources (`IERC7984`, FHE libs) |
| `contracts/contracts/test/MockUSDC.sol` (and other mocks) | Faucet-style test ERC-20s |
| `frontend/` | Production-minded RelayerWeb UI: shield/unshield/send/decrypt, errors, Sepolia |
| `relayer-web-proxy/` | Browser → hosted relayer `/v2` proxy pattern |
| `README.md` | Live URL, SDK v3 notes, registry, submission checklist style |

**Live reference app:** https://ct-7984-chriswilder.netlify.app/

### `mainnet-app/`

| Path | Why |
|------|-----|
| `contracts/contracts/ConfidentialTokenWrapper.sol` | Same wrapper archetype |
| `src/hooks/useWrapToken.ts`, `useUnwrapToken.ts`, `useConfidentialTransfer.ts`, `useFhevmDecrypt.ts`, `useFhevmEncrypt.ts` | Hook shapes for deposit/encrypt/decrypt |
| `src/providers/FhevmProvider.tsx` | Provider wiring |

---

## Consumer payment / decrypt UX

| Folder | Useful for |
|--------|------------|
| `zpayy-react/` | Privy + Zama shell, confidential transfer, balance decrypt, activity, Sepolia UX |
| `zpayy-relayer-web/` | RelayerWeb-oriented twin |
| `relayer-web-proxy/` | Shared proxy approach for API keys / CORS |

These are closer to **consumer DeFi UX** than the RFQ market-maker UI.

---

## Zama agent skills (authoritative local playbook)

`zama-agent-skills-bounty/skills/` — start at **`zama-fhevm-developer-hub`**.

Highest priority for this bounty:

1. `zama-fhevm-architecture`  
2. `zama-erc7984-confidential-tokens`  
3. `zama-fhevm-solidity-operations` (esp. `FHE.select`, comparisons)  
4. `zama-fhevm-access-control`  
5. `zama-fhevm-input-proofs`  
6. `zama-fhevm-user-decryption-eip712`  
7. `zama-fhevm-frontend-integration` + `zama-react-zama-sdk`  
8. `zama-relayer-integration-hub`  
9. `zama-fhevm-anti-patterns`  
10. `zama-hardhat-fhevm-contracts` (wrapper / MockUSDC excerpts)

Workspace rule also points at `md-files/` when present; currently **no `md-files/`** at repo root — use skills + [docs.zama.org/protocol/latest](https://docs.zama.org/protocol/latest).

---

## Adjacent experiments

| Folder | Note |
|--------|------|
| `Raffle/` | Present in root listing; no Solidity matched in quick scan — re-check if it gains FHE raffle logic |
| `Confidential-safe/` | Multisig + FHE ACL patterns if vault needs Safe ops |
| `zwallet/` | Wallet UX patterns if relevant |

---

## What to copy vs rewrite

| Reuse as-is (patterns) | Build new |
|------------------------|-----------|
| ERC-7984 wrapper + mocks | Confidential prize vault + draw engine |
| RelayerWeb + proxy | Weighted FHE winner selection |
| Encrypt / decrypt / transfer hooks | Deposit-weighted draw UI + keeper flow |
| Error handling (chain, allowance) | Prize reserve mock + README leakage section |

---

## External PoolTogether code (study only)

- npm: `@generationsoftware/hyperstructure-react-hooks`  
- GitHub: [GenerationSoftware/pooltogether-client-monorepo](https://github.com/GenerationSoftware/pooltogether-client-monorepo)  
- Contracts (for mental model): `pt-v5-prize-pool`, `pt-v5-vault`, `pt-v5-twab-controller` (linked from PT docs / hooks README)

We are **not** forking V5 into FHE blindly; we recreate the **mechanic** with encrypted balances.
