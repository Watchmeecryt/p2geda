# 03 — Cleartext PoolTogether → confidential (Zama) mapping

This is a **working sketch**, not final architecture. It translates bounty + PoolTogether research into FHEVM / ERC-7984 building blocks we already know how to ship.

Official randomness docs: [Generate random numbers](https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random)  
(also saved under `research/zama/random.md` summary).

---

## Core invariant

| Must remain true | How (confidential) |
|------------------|--------------------|
| Principal never lost | Track withdrawable principal; withdraw burns encrypted share / returns underlying |
| Odds ∝ deposit size | Compare encrypted cumulative weights to encrypted random ticket |
| Fair randomness | `FHE.randEuint*` inside a **transaction** (not `eth_call`) |
| User can see own state | EIP-712 **user decryption** of balance / prize handles |
| Observers cannot see deposits | Store `euint` / ERC-7984 balances; never emit clear amounts |

---

## Suggested flow (minimal bounty-complete loop)

```text
1. DEPOSIT
   ERC20.approve(vault)
   vault.deposit(amountClear) OR deposit(encryptedAmount, proof)
        → underlying locked
        → userEncryptedBalance = FHE.add(prev, amount)
        → totalEncryptedSupply = FHE.add(total, amount)
        → ACL: allow user + vault on new handles

2. HOLD
   confidentialBalanceOf(user) → handle
   Frontend: useUserDecrypt / RelayerWeb EIP-712 → show user only

3. YIELD (mock)
   admin.fundPrizeReserve(prizeToken, amount)
   README: “real world = ERC-4626 harvest → contribute prize liquidity”

4. DRAW (keeper)
   require(drawInterval elapsed)
   ticket = FHE.randEuint*(bound)  // or rand then reduce vs total supply
   walk depositors OR use encrypted cumulative ranges:
        winner = select user where cumulative_i-1 <= ticket < cumulative_i
        using FHE.le / FHE.lt / FHE.select over euints
   store encrypted prize credit for winner OR confidentialTransfer prize

5. CLAIM
   winner claims confidential prize to wallet
   userDecrypt(prize handle)

6. WITHDRAW
   vault.withdraw(encryptedAmount, proof) or full exit
   → principal returned; balance decreased with FHE.sub
```

---

## ERC-7984 vs custom `euint` accounting

Two viable patterns (can combine):

### A. ERC-7984 confidential token as pool shares

- Wrap underlying → confidential shares held by users (or vault mints ERC-7984 shares).
- Prize paid via `confidentialTransfer`.
- Strong alignment with bounty wording (“ERC-7984 confidential token”).
- Local refs: `ConfidentialTokenWrapper` in `ERC7984-bounty` / `mainnet-app`.

### B. Vault-internal `mapping(address => euint64)` balances

- Vault holds clear ERC-20; balances encrypted in vault storage.
- Simpler for weighted draw over an enumerable depositor set.
- Still “encrypted-integer accounting” per bounty.

**Likely approach:** vault holds underlying + encrypted balances for weights; prizes may be paid as ERC-7984 or clear prize token after controlled decrypt — decide in Phase 1 with leakage table.

---

## FHE randomness notes (from Zama docs)

- Must run in a **transaction** (PRNG state mutates onchain).
- APIs: `FHE.randEbool`, `FHE.randEuint8/16/32/64/128/256`.
- Bounded: upper bound must be **power of 2**; result in `[0, upperBound)`.
- Values stay encrypted until allowed decrypt.

**Implication for weighted selection:**  
Classic `random % totalSupply` is awkward when `totalSupply` is encrypted and modulus needs clear bound. Common FHE patterns:

1. Maintain encrypted **cumulative weights**; generate random in a known power-of-two range large enough; map via comparisons.  
2. Or keep a **clear total supply** (leaks TVL) while keeping **per-user** balances encrypted — **document as leakage** if used.  
3. Or public-decrypt total only at draw time (leaks TVL at draw) — also document.

Bounty asks to document leakage; judges expect honesty here.

---

## Weighted winner selection (conceptual)

Given depositors `u1..un` with encrypted balances `b_i`:

```solidity
// Pseudocode — types/ACL omitted
euint64 acc = 0;
euint64 ticket = FHE.randEuint64(/* power-of-two bound */);
address winner;
for each user i {
  euint64 next = FHE.add(acc, b_i);
  ebool inRange = /* ticket >= acc && ticket < next */;
  // select winner address via encrypted flags + careful reveal strategy
  acc = next;
}
```

Challenges to solve in Phase 1–2:

- **Gas / n users:** O(n) FHE ops per draw — cap depositors or use tree of cumulatives for demo.  
- **Revealing winner:** public decrypt of winner index vs only winner learns via private claim.  
- **Empty pool / zero balances.**  
- **Multiple winners** (bounty allows “one or more”).

---

## EIP-712 user decryption (balances & winnings)

Reuse existing app patterns:

- `zpayy-react` / `zpayy-relayer-web` decrypt hooks  
- `ERC7984-bounty` frontend decrypt  
- Skill: `zama-fhevm-user-decryption-eip712`  
- SDK: `@zama-fhe/react-sdk` `useUserDecrypt` / RelayerWeb  

Flow: handle → prepare typed data → wallet sign → relayer complete → cleartext for **that user only**.

---

## Leakage draft (to refine)

| Data | Likely visibility | Mitigation / note |
|------|-------------------|-------------------|
| User deposited at all | Public (tx from address) | Unavoidable without stealth addresses |
| Deposit amount | Encrypted | Core win |
| Pool share / balance | Encrypted handle | User decrypt only |
| Total value locked | Maybe public or encrypted | Document choice |
| Draw time / that a draw happened | Public | OK |
| Winner address | Public if claim emits Transfer | Prefer claim without broadcasting amount; document |
| Prize amount | Encrypted until winner decrypts | Target |
| Odds exact | Hidden if balances hidden | If TVL public, coarse inference possible |

---

## Mock yield plug-in story (README later)

**Now:** `PrizeReserve.fund(amount)` by admin; `draw()` pays from reserve.  

**Later / real:** Prize vault sits on ERC-4626; harvested yield → `contribute(prizeAmount)` same as PoolTogether liquidation output, without needing TPDA for the bounty demo.

---

## Skills / docs to open when we implement

| Concern | Skill folder under `zama-agent-skills-bounty/skills/` |
|---------|------------------------------------------------------|
| Orientation | `zama-fhevm-developer-hub` |
| Types / ops / select | `zama-fhevm-solidity-types`, `zama-fhevm-solidity-operations` |
| ACL | `zama-fhevm-access-control` |
| Input proofs | `zama-fhevm-input-proofs` |
| ERC-7984 | `zama-erc7984-confidential-tokens`, `zama-openzeppelin-confidential-contracts` |
| User decrypt | `zama-fhevm-user-decryption-eip712` |
| Frontend / relayer | `zama-fhevm-frontend-integration`, `zama-relayer-integration-hub`, `zama-react-zama-sdk` |
| Anti-patterns | `zama-fhevm-anti-patterns` |
