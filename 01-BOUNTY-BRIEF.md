# 01 — Bounty brief: Build the Confidential PoolTogether App

Source: user paste (Zama / protocol bounty). Deadline: **September 5th, 23:59 AOE**.

---

## Objective

Build a **production-ready** dApp that recreates the core PoolTogether mechanic — **no-loss prize savings** — with confidentiality powered by the **Zama Protocol**.

When a user opens the app and connects a wallet, they should be able to:

| Action | Requirement |
|--------|-------------|
| **Deposit** | Put a test ERC-20 into the shared prize pool; deposited amount **encrypted onchain** (ERC-7984 / encrypted integers). |
| **Hold confidential balance** | No observer can see individual deposit sizes or pool shares. |
| **Win prizes** | At regular draw intervals, the pool’s accrued yield is awarded to one or more depositors. Winner selection runs **onchain** over **encrypted balances**, weighted by deposit size, using **FHE randomness**. |
| **Claim** | Decrypt and claim winnings via the **EIP-712 user-decryption** flow. |
| **Withdraw** | Exit with **full principal** at any time — **no loss**. |

A **mock yield source** on Sepolia is acceptable (e.g. admin-funded prize reserve), as long as the README documents how it works and how a real yield source would plug in.

---

## Why this matters

On a transparent chain, a prize-savings protocol leaks:

- how much every user has saved  
- each wallet’s odds of winning  
- who won every draw  

That exposes wealth, makes large depositors targets, and discourages participation.

FHE removes the trade-off: deposits/balances stay encrypted, draws stay provably fair and deposit-weighted, and ideally only the winner learns sensitive outcome details. A strong submission shows confidential tokens + encrypted randomness composing into a consumer-grade DeFi primitive.

---

## Hard requirements

Submission should:

1. Be a **web dApp** with a **public live URL** (judges connect wallet and try every feature).
2. Support full cycle **onchain**: deposit → draw → claim → withdraw.
3. Keep individual deposit amounts and balances **encrypted onchain** (ERC-7984 or encrypted-integer accounting).
4. Select winners **onchain** using FHE randomness (e.g. `FHE.randEuint`), weighted by deposit size over encrypted balances — **no offchain RNG**, **no plaintext balances**. Document design and any leakage.
5. Guarantee **no loss**: principal withdrawable anytime.
6. **Automate draws**, or document a keeper/admin flow to trigger them.
7. Support **user decryption (EIP-712)** of the connected wallet’s pool balance and winnings.
8. Provide a **faucet** or clear instructions for the test token.
9. Be **open source** in a public GitHub repository.

---

## Topics README + dApp must demonstrate

- Confidential deposit: ERC-20 approval → deposit/wrap → confirmation  
- Encrypted balance accounting (`euint` / ERC-7984)  
- Draw mechanics: onchain FHE randomness + deposit-weighted winner selection  
- Prize distribution via confidential transfer; winner-only decryption  
- EIP-712 user decryption of balances and winnings  
- Frontend integration with Zama SDK / relayer  
- Sensible errors: missing approvals, insufficient balance, network mismatch, unsupported tokens  

---

## Submission checklist

### 1. GitHub (public)

- Full app source  
- README: live URL, how pool/draws work, confidentiality design (encrypted vs leaks), yield-source mock, deployment scripts  

### 2. Live deployment

- Public URL; every feature on **Sepolia**  

### 3. Demo video

- Max **3 minutes**  
- Real person only (no AI voice/video); normal speed  
- Show: deposit, decrypt pool balance, trigger draw, claim prize, withdraw principal  
- Briefly explain fair + confidential winner selection  

### 4. Distribution

- Thread or article on **X** introducing the project  

---

## Judging criteria

| Criterion | Question judges ask |
|-----------|---------------------|
| **Correctness** | Do deposit, draw, claim, withdraw work onchain? EIP-712 correct? |
| **Confidentiality design** | What stays encrypted? Fair + deposit-weighted? Leakage minimal and documented? |
| **UX** | Pleasant? Approvals/errors graceful? |
| **Code quality** | Clean, typed, documented? |
| **Production-readiness** | Stable on Sepolia? Would a real user trust it today? |

---

## Implied architecture (from requirements — not yet decided)

```text
User wallet
    │
    ├─ approve MockERC20
    ├─ deposit → encrypt amount → encrypted pool share / euint balance
    ├─ userDecrypt(balance handle) via EIP-712 + relayer
    │
Keeper / admin
    ├─ fund prize reserve (mock yield)
    └─ triggerDraw() → FHE.rand* + weighted select over encrypted balances
            │
Winner
    ├─ claim → confidential prize transfer
    └─ userDecrypt(winnings)
    │
Any depositor
    └─ withdraw principal (no-loss)
```

---

## Non-goals for Phase 0

- Cloning every PoolTogether V5 auction / liquidation / multi-tier canary system  
- Mainnet production yield integration (document the plug-in only)  
