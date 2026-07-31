# 05 — Links index

Fetched / referenced during Phase 0. Prefer opening these when continuing research.

---

## Bounty & product goal

| Link | Role |
|------|------|
| (User paste in chat) | Full Confidential PoolTogether bounty text → captured in `01-BOUNTY-BRIEF.md` |

---

## PoolTogether protocol

| Link | Status | Notes |
|------|--------|-------|
| https://dev.pooltogether.com/protocol/introduction | Fetched | Prize savings UX + design principles |
| https://dev.pooltogether.com/protocol/introduction/ | Same | Trailing slash duplicate |
| https://dev.pooltogether.com/protocol/design/ | Fetched | V5 hyperstructure, TWAB, liquidation, draws, eligibility math |
| https://dev.pooltogether.com/protocol/design/overview | 404 | Do not use |
| https://dev.pooltogether.com/protocol/reference/prize-vault/ | Indexed | Vault factory / ERC-4626 entry |
| https://dev.pooltogether.com/protocol/reference/twab-controller/ | Indexed | TWAB balance tracking |
| https://dev.pooltogether.com/protocol/design/draw-auction | Indexed | RNG start/finish auctions (cleartext V5) |
| https://dev.pooltogether.com/protocol/guides/bots/ | Indexed | Liquidation / claim / RNG bots |

---

## PoolTogether client / hooks

| Link | Status | Notes |
|------|--------|-------|
| https://www.npmjs.com/package/@generationsoftware/hyperstructure-react-hooks | Fetched | v1.28.4; vault/prize/tx hooks; wagmi+viem |
| https://github.com/GenerationSoftware/pooltogether-client-monorepo | Fetched | Hyperstructure apps/packages |
| https://github.com/GenerationSoftware/pt-v5-prize-pool | Linked from hooks README | Prize pool contract |
| https://github.com/GenerationSoftware/pt-v5-vault | Linked from hooks README | Vault contract |
| https://github.com/generationsoftware/pt-v5-twab-controller | Linked from PT docs | TWAB |

---

## Zama / FHEVM

| Link | Status | Notes |
|------|--------|-------|
| https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random | Fetched | `FHE.randEuint*`, bounds = power of 2, tx-only |
| https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random.md | Same | Markdown variant |
| https://docs.zama.org/protocol/latest | Authority | Prefer latest protocol docs for SDK shapes |
| https://docs.zama.org/protocol/llms.txt | Index | Docs index for agents |
| https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia | Fetched | **cUSDCMock** + USDC Mock + registry |
| https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia.md | Fetched | Markdown variant |
| https://docs.zama.org/protocol/protocol-apps/addresses/testnet/sepolia#wrappers-registry | From ERC7984 README | Sepolia wrappers registry |
| https://docs.zama.org/protocol/sdk/migration/migrate-v2-to-v3 | From ERC7984 README | SDK migration |

### ConfiPool token addresses (Sepolia mocks)

| Token | Address |
|-------|---------|
| USDC Mock (underlying, public mint ≤1M) | `0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF` |
| cUSDCMock (ERC-7984) | `0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639` |
| Wrappers Registry | `0x2f0750Bbb0A246059d80e94c454586a7F27a128e` |

Local snapshot: `ERC7984-bounty/config/official-sepolia.json`

---

## Local live apps (ours)

| Link | Project |
|------|---------|
| https://ct-7984-chriswilder.netlify.app/ | ERC-7984 registry / shield-unshield (`ERC7984-bounty`) |

---

## npm packages we expect to pin later (verify with `npm view`)

- `@zama-fhe/sdk`
- `@zama-fhe/react-sdk`
- `@zama-fhe/relayer-sdk`
- `@fhevm/solidity`
- `@fhevm/hardhat-plugin`
- `@openzeppelin/confidential-contracts`
- (optional study) `@generationsoftware/hyperstructure-react-hooks`

---

## Fetch backlog (next research sessions)

- [ ] PoolTogether prize eligibility deep-dive → save worked examples under `research/pooltogether/`
- [ ] Zama docs: comparisons + `FHE.select` for winner pick
- [ ] Zama docs: user decryption EIP-712 current schema
- [ ] Skim monorepo app UX screenshots / routes for deposit-claim flows
- [ ] Scan `Raffle/` again if it gains confidential raffle code
