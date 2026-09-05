import type { ReactNode } from 'react';
import type { DocPageId } from '@/lib/docs/catalog';
import { VaultSourceArticle } from '@/components/docs/vaultSourceArticle';
import {
  DocA,
  DocCallout,
  DocH2,
  DocH3,
  DocLead,
  DocOl,
  DocP,
  DocPre,
  DocSig,
  DocTable,
  DocUl,
} from '@/components/docs/DocPrimitives';

function WhatIs() {
  return (
    <>
      <DocLead>
        ConfiPool is a PoolTogether V5–style prize savings vault on the Zama Protocol. You deposit
        confidential cUSDC, keep the right to withdraw principal anytime, and the pool’s yield (or a
        funded reserve on Sepolia) is paid as Apex, Pulse, or Ripple prizes.
      </DocLead>
      <DocP>
        Nobody else can read your balance, your time-weighted weight, or whether a given{' '}
        <code>scoreEntrant</code> credited you. The draw itself is public: a seed <code>R</code>, a
        pool total weight <code>W</code>, and a published odds schedule.
      </DocP>
      <DocH2>What you do</DocH2>
      <DocOl>
        <li>Wrap Zama USDC Mock into ERC-7984 cUSDCMock.</li>
        <li>
          Deposit into <code>ConfidentialPrizeVault</code>. The vault appends an encrypted TWAB
          observation.
        </li>
        <li>Wait. The keeper opens an hourly round. You do not run draws.</li>
        <li>Decrypt claimable with EIP-712 and <code>claim()</code>, or withdraw principal.</li>
      </DocOl>
      <DocH2>What this is not</DocH2>
      <DocUl>
        <li>Not a lockup. Principal is withdrawable with no penalty.</li>
        <li>Not a hidden casino. Winner math is the official V5 per-prize rule, checkable from public values.</li>
        <li>
          Not the full V5 hyperstructure. One vault, three fixed tiers, one TWAB window per draw. See{' '}
          <DocA to="/app/docs/limitations">Honest limits</DocA>.
        </li>
      </DocUl>
    </>
  );
}

function TrySepolia() {
  return (
    <>
      <DocLead>
        The in-app loop is faucet → wrap → deposit → wait for the keeper → decrypt → claim. You
        need a Sepolia wallet and the app pointed at the live vault.
      </DocLead>
      <DocH2>In the app</DocH2>
      <DocOl>
        <li>
          Open <DocA to="/app">Pool</DocA> on Sepolia.
        </li>
        <li>Use faucet for USDC Mock (6 decimals).</li>
        <li>Wrap to cUSDCMock, then deposit. Amounts stay handles onchain.</li>
        <li>
          Draws run about once an hour. Watch <DocA to="/app/draws">Draws</DocA> for the next open
          and your claimable handle.
        </li>
        <li>
          History is a public feed of actions, not amounts. Metrics can show published aggregates
          after admin reveal gates.
        </li>
      </DocOl>
      <DocCallout tone="note" title="You do not begin or unseal rounds">
        <DocP>
          Reviewer wallets are depositors. The keeper calls <code>beginRound</code>,{' '}
          <code>unsealRound</code>, and <code>scoreEntrants</code>. If a round looks stuck, wait —
          do not assume the UI is broken because you cannot open a draw.
        </DocP>
      </DocCallout>
      <DocH2>Local app</DocH2>
      <DocPre>{`cd app
cp .env.example .env
npm install
npm run dev`}</DocPre>
      <DocP>
        Env already lists the live vault, yield adapter, USDC Mock, cUSDCMock, and relayer origin.
        See <DocA to="/app/docs/live-stack">Live Sepolia</DocA> for addresses.
      </DocP>
    </>
  );
}

function HowDraw() {
  return (
    <>
      <DocLead>
        A draw freezes a TWAB window, samples encrypted randomness, publishes only the aggregates
        needed for public thresholds, then scores every depositor independently.
      </DocLead>
      <DocH2>Lifecycle</DocH2>
      <DocTable
        headers={['Step', 'Who', 'What becomes public']}
        rows={[
          [
            <code key="b">beginRound()</code>,
            'Keeper (permissionless after minPeriod)',
            'That a round opened. R and total weight stay encrypted handles marked publicly decryptable.',
          ],
          [
            <code key="u">unsealRound()</code>,
            'Keeper + KMS signatures',
            'Clear R and W (pool TWAB for this window).',
          ],
          [
            <code key="s">scoreEntrant(user, id)</code>,
            'Keeper, every depositor',
            'That scoring ran. Credit is encrypted. Misses look the same as hits.',
          ],
          [
            <code key="c">claim()</code>,
            'The saver',
            'That a claim tx happened. Amount stays a handle.',
          ],
        ]}
      />
      <DocH2>Timing</DocH2>
      <DocP>
        <code>minPeriod</code> is immutable on the vault. The live Sepolia vault is 3600 seconds
        (one hour). <code>beginRound</code> reverts <code>TooSoon</code> until{' '}
        <code>lastSnapshot + minPeriod</code>. An open round that never unseals can be{' '}
        <code>abandonRound</code> after 24 hours so the pool cannot brick. Where the seed comes
        from is <DocA to="/app/docs/randomness">Randomness</DocA>.
      </DocP>
      <DocCallout tone="honest" title="Same window, all tiers">
        <DocP>
          The weight used for Apex, Pulse, and Ripple is the same odometer delta: last snapshot →
          this snapshot. Official V5 can use a longer lookback for rarer tiers. We do not. Details
          in <DocA to="/app/docs/time-weighted-balance">Time-weighted balance</DocA>.
        </DocP>
      </DocCallout>
    </>
  );
}

function Randomness() {
  return (
    <>
      <DocLead>
        The draw seed is not a keeper number, not a wallet signature, and not Chainlink VRF.
        It is <code>FHE.randEuint64()</code> sampled onchain in the same transaction that
        freezes the TWAB window. Nobody sees it until KMS public-decrypt, and by then weights
        cannot change.
      </DocLead>

      <DocH2>Why this shape</DocH2>
      <DocP>
        Official PoolTogether V5 often sources <code>drawRandomNumber</code> from an RNG auction
        (Witnet, VRF, …). ConfiPool is a confidential vault: the bounty and the Zama stack want
        randomness that is <strong>encrypted at birth</strong> and generated{' '}
        <strong>inside a transaction</strong>. Zama’s rule:{' '}
        <code>FHE.rand*</code> updates PRNG state onchain. You cannot sample it with{' '}
        <code>eth_call</code>. Source:{' '}
        <DocA href="https://docs.zama.org/protocol/solidity-guides/smart-contract/operations/random">
          Zama — random number generation
        </DocA>
        .
      </DocP>

      <DocH2>Step 1 — sample, still encrypted</DocH2>
      <DocPre>{`euint64 r = FHE.randEuint64();
FHE.makePubliclyDecryptable(r);
FHE.makePubliclyDecryptable(totalWeight);`}</DocPre>
      <DocP>
        That sits in <code>beginRound</code> next to the window freeze. One tx does both, so a
        caller cannot freeze yesterday’s weights and attach a seed they already peeked at. The
        handle <code>encR</code> is stored on the draw. Logs say a round opened. They do not
        print <code>R</code>.
      </DocP>
      <DocP>
        We sample a full <code>euint64</code>, not a power-of-two bound. The bound that matters
        for fairness is later: each saver’s PRN is reduced with{' '}
        <code>uniform(PRN, W)</code> (modulo plus bias rejection), which is the V5 squeeze
        against pool total supply. See{' '}
        <DocA to="/app/docs/winner-selection">Winner selection</DocA>.
      </DocP>

      <DocH2>Step 2 — unseal with KMS signatures</DocH2>
      <DocP>
        The keeper asks the relayer to public-decrypt <code>encR</code> and{' '}
        <code>encTotalWeight</code>. It then posts <code>cleartexts</code> and a decryption
        proof:
      </DocP>
      <DocPre>{`FHE.checkSignatures(handles, cleartexts, decryptionProof);
(uint256 r, uint256 total) = abi.decode(cleartexts, (uint256, uint256));`}</DocPre>
      <DocP>
        The vault does not trust the keeper’s integers. If the proof does not match those
        handles, <code>unsealRound</code> reverts. A keeper that skips unseal leaves the draw
        <code>Open</code>; after 24 hours anyone may <code>abandonRound</code> so the pool
        cannot brick. Abandoned rounds do not score.
      </DocP>

      <DocH2>Step 3 — R becomes the V5 drawRandomNumber</DocH2>
      <DocPre>{`PRN = keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, R))`}</DocPre>
      <DocP>
        Once clear, <code>R</code> is public on purpose. Anyone can recompute every threshold.
        That does not let them change who won: the TWAB window was frozen at{' '}
        <code>beginRound</code>, before <code>R</code> was readable. Depositing or withdrawing
        after unseal does not move this draw’s odometer.
      </DocP>

      <DocH2>What the keeper cannot do</DocH2>
      <DocUl>
        <li>Pick <code>R</code>. The coprocessor samples it in <code>beginRound</code>.</li>
        <li>Swap in a different cleartext. <code>FHE.checkSignatures</code> binds the proof to the stored handles.</li>
        <li>Resample after seeing the depositor list. A new <code>R</code> requires a new <code>beginRound</code>, which requires the previous draw revealed or abandoned and <code>minPeriod</code> elapsed — a new window, not a reroll of the last one.</li>
        <li>Score a subset to hide a winner. Identity is not logged; skipping a saver only delays their credit, it does not change thresholds. The product path scores everyone.</li>
      </DocUl>

      <DocCallout tone="honest" title="What we are trusting">
        <DocP>
          This is Zama fhEVM randomness + KMS public-decrypt, not a second VRF. If the
          coprocessor or KMS were dishonest, they could bias the encrypted sample or the
          revealed cleartext. We do not add a committee or commit–reveal on top. Reviewers
          should treat that as the trust base, same as any other fhEVM app using{' '}
          <code>FHE.rand*</code>.
        </DocP>
      </DocCallout>

      <DocH2>What this is not</DocH2>
      <DocUl>
        <li>Not <code>block.prevrandao</code> or a hash of timestamps — those are public before the tx lands.</li>
        <li>Not an off-chain bot rolling a number and posting it.</li>
        <li>Not V5’s start-RNG / finish-RNG Dutch auction. We skipped that factory on purpose.</li>
      </DocUl>
    </>
  );
}

function Twab() {
  return (
    <>
      <DocLead>
        TWAB is a running odometer, not “balance right now.” Weight for a draw is how much
        balance×time you accumulated between two timestamps.
      </DocLead>
      <DocH2>Observation</DocH2>
      <DocPre>{`cumulative = lastCumulative + lastBalance × (now − lastTime)`}</DocPre>
      <DocP>
        That is the PoolTogether V5 cumulative. Deposits and withdraws push a new encrypted
        observation on the user ring and the pool ring.
      </DocP>
      <DocH2>This vault’s window</DocH2>
      <DocP>
        When the keeper opens a round, <code>periodStart</code> is the previous draw’s{' '}
        <code>snapshotAt</code> (or genesis). <code>snapshotAt</code> is now. Pool total:
      </DocP>
      <DocPre>{`W = poolCumulative(snapshotAt) − poolCumulative(periodStart)`}</DocPre>
      <DocP>
        Your ticket is the same span:
      </DocP>
      <DocPre>{`weight = yourCumulative(snapshotAt) − yourCumulative(periodStart)`}</DocPre>
      <DocP>
        Apex, Pulse, and Ripple all compare that one <code>weight</code> to their own threshold.
        They do not look at different stretches of history.
      </DocP>
      <DocH3>Hourly example</DocH3>
      <DocP>
        Last seal 14:00, next open 15:00. Maya held 100 the whole hour. Omar deposited 100 at
        14:50. Maya’s weight is six times Omar’s — on every tier. If Jules withdrew at 13:59,
        that weight this hour is zero. Jules cannot win.
      </DocP>
      <DocH2>What official V5 adds (we did not)</DocH2>
      <DocP>
        V5 can measure grand-prize TWAB over a long duration and daily-prize TWAB over one draw.
        Same person, two weights. We would need extra FHE cumulatives and a public <code>W</code>{' '}
        per duration. The hourly demo does not need a year lookback. See{' '}
        <DocA to="/app/docs/limitations">Honest limits</DocA>.
      </DocP>
    </>
  );
}

function Winner() {
  return (
    <>
      <DocLead>
        Winner selection is the official PoolTogether V5 per-prize test, written so the comparison
        never divides an encrypted TWAB.
      </DocLead>
      <DocH2>Official V5</DocH2>
      <DocPre>{`PRN = keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, drawRandomNumber))
winningZone = tierOdds × userTwab × vaultPortion
userWon = (PRN % vaultTotalAverageSupply) < winningZone`}</DocPre>
      <DocP>
        Source:{' '}
        <DocA href="https://dev.pooltogether.com/protocol/design/">
          PoolTogether protocol design — Winner Eligibility
        </DocA>
        . Each <code>prizeIndex</code> is an independent shot. Tiers add.
      </DocP>
      <DocH2>This contract</DocH2>
      <DocPre>{`PRN = keccak256(abi.encode(drawId, address(this), user, tier, prizeIndex, R))
r   = uniform(PRN, W)
threshold = r × tierK[tier]     // odds = 1 / k
won = encryptedTwab > threshold`}</DocPre>
      <DocP>
        <code>uniform</code> is modulo with the same bias rejection V5 documents.{' '}
        <code>vaultPortion</code> is 1 — there is one vault. Encrypted compare is{' '}
        <code>FHE.gt(weight, threshold)</code>.
      </DocP>
      <DocCallout tone="ok" title="Integer form of the same event">
        <DocP>
          Official: <code>(PRN % W) &lt; twab / k</code>. Ours: <code>twab &gt; (PRN % W) × k</code>.
          FHE cannot divide the private weight, so we multiply the public remainder instead.
        </DocP>
      </DocCallout>
      <DocH2>Independent shots</DocH2>
      <DocP>
        <code>scoreEntrant</code> loops every tier and every <code>prizeIndex</code> and{' '}
        <strong>adds</strong> each win. Winning Apex does not cancel Pulse or Ripple. Demo default
        is one shot per tier (<code>tierPrizeCount = [1, 1, 1]</code>). Owner can raise counts to 4
        with <code>setTierPrizeCounts</code>. Official V5 uses <code>4^t</code>; we cap because each
        shot is an FHE compare.
      </DocP>
      <DocP>
        Tests rebuild the official hash in TypeScript and assert it equals <code>thresholdOf</code>.
        See <DocA to="/app/docs/vault-api">Vault API</DocA> and the README Tests section. The seed{' '}
        <code>R</code> is explained on <DocA to="/app/docs/randomness">Randomness</DocA>.
      </DocP>
    </>
  );
}

function Tiers() {
  return (
    <>
      <DocLead>
        Three public tiers. Higher <code>k</code> is rarer. Prizes must strictly decrease. Ripple{' '}
        <code>k</code> must be 1 so the frequent tier fires every draw.
      </DocLead>
      <DocTable
        headers={['Tier', 'Role', 'Demo prize (6-dec)', 'k', 'Shots']}
        rows={[
          ['Apex', 'Largest, rarest', '100', '100', '1'],
          ['Pulse', 'Mid', '25', '10', '1'],
          ['Ripple', 'Small, frequent', '5', '1', '1'],
        ]}
      />
      <DocP>
        Expected prizes for a saver with share <code>s = twab / W</code>, one shot:{' '}
        <code>s × (1/k) × prize</code>. With the demo board that is about <code>s × 1</code> Apex,{' '}
        <code>s × 2.5</code> Pulse, <code>s × 5</code> Ripple (token units). Raising shot count
        without shrinking prize size multiplies outflow. V5 splits the same tier liquidity into more
        tickets; do the same if you bump <code>tierPrizeCount</code>.
      </DocP>
      <DocH2>Reserve clamp</DocH2>
      <DocP>
        After summing wins, the vault pays <code>min(credit, reserve)</code> with encrypted select.
        If the pot cannot cover the sum, the saver gets encrypted zero for that score. Identity is
        still not logged.
      </DocP>
    </>
  );
}

function PrizeMoney() {
  return (
    <>
      <DocLead>
        Prizes come from an encrypted reserve on the prize vault. Yield is optional plumbing, not
        the Sepolia demo’s real APY.
      </DocLead>
      <DocH2>Paths</DocH2>
      <DocUl>
        <li>
          <strong>Admin fund.</strong> Owner confidential-transfers with{' '}
          <code>RESERVE_DEPOSIT_TAG</code>. This is how Sepolia prizes actually get paid.
        </li>
        <li>
          <strong>harvest().</strong> If a yield source is set, pull adapter yield into the same
          reserve.
        </li>
      </DocUl>
      <DocH2>Yield adapter</DocH2>
      <DocP>
        <code>ConfidentialVaultSource</code> sits between the prize vault and Zama Morpho batchers.
        Deposit into the prize vault can <code>supply</code> into that buffer. Joining the batcher,
        claiming shares, and unwind are keeper/admin operations — not automatic on every user
        deposit. Staging Morpho on Sepolia does not drip meaningful APY. <code>rateBps</code> plus
        Admin → Fund reserve seed the pot.
      </DocP>
      <DocCallout tone="honest" title="Sepolia is a funded demo">
        <DocP>
          Do not read Sepolia prize payouts as live Morpho yield. Mainnet is the same adapter
          pointed at live Steakhouse / Morpho addresses. The adapter surface is on{' '}
          <DocA to="/app/docs/vault-source">Vault source</DocA>.
        </DocP>
      </DocCallout>
    </>
  );
}

function WhyZama() {
  return (
    <>
      <DocLead>
        Balances and the draw comparison have to stay encrypted onchain. That is Zama fhEVM +
        ERC-7984, not a custom mixer.
      </DocLead>
      <DocUl>
        <li>
          <strong>ERC-7984</strong> — confidential token. Deposit is{' '}
          <code>confidentialTransferAndCall</code>.
        </li>
        <li>
          <strong>FHE.randEuint64</strong> — onchain encrypted draw seed at <code>beginRound</code>.
        </li>
        <li>
          <strong>Public decrypt of aggregates</strong> — only <code>R</code> and <code>W</code>, via
          KMS signatures in <code>unsealRound</code>.
        </li>
        <li>
          <strong>userDecrypt</strong> — EIP-712. You open your own handles. The keeper never sees
          them.
        </li>
        <li>
          <strong>RelayerWeb</strong> in the browser; RelayerNode in the keeper. Relayer URL is the
          hosted HTTP API (usually <code>/v2</code>) or a transparent proxy.
        </li>
      </DocUl>
      <DocP>
        Docs:{' '}
        <DocA href="https://docs.zama.org/protocol/latest">Zama Protocol (latest)</DocA>.
      </DocP>
    </>
  );
}

function Privacy() {
  return (
    <>
      <DocLead>
        Privacy is “amounts and outcomes stay handles,” not “nobody knows you used the app.”
      </DocLead>
      <DocTable
        headers={['Encrypted', 'How']}
        rows={[
          ['Deposit / vault balance', 'ERC-7984 / TWAB euint64 · euint128. EIP-712 for that wallet only.'],
          ['Unclaimed winnings', 'Same ACL as the saver.'],
          ['Prize reserve', 'Encrypted. Owner may decrypt.'],
          ['Per-user TWAB weight', 'Never published. Only compared under FHE.'],
          ['Winner identity', 'Not emitted. Every depositor is scored.'],
        ]}
      />
      <DocTable
        headers={['Public on purpose', 'Why']}
        rows={[
          ['That a deposit / draw / claim happened', 'Logs exist. Amounts stay handles.'],
          ['Who is in the pool', 'Enumerable list, cap 256. Sizes stay encrypted.'],
          ['Draw R and total W', 'Needed so anyone can recompute official V5 thresholds.'],
          ['Tier prizes and k', 'Odds schedule is public.'],
          ['Aggregate prizes paid', 'Optional admin reveal after enough draws (default 5).'],
        ]}
      />
      <DocCallout tone="honest" title="Publishing exact W">
        <DocP>
          Official V5 publishes vault totals too. If the pool is tiny and only one address moved
          this window, a careful observer can sometimes infer that mover’s size from the change in{' '}
          <code>W</code>. We still publish <code>W</code> so the winner test matches the V5 docs.
          That is a deliberate trade, not an accident.
        </DocP>
      </DocCallout>
    </>
  );
}

function Limits() {
  return (
    <>
      <DocLead>
        The pick-a-winner rule is V5. The prize factory around it is a confidential, single-vault
        demo. This page is the honest list.
      </DocLead>
      <DocTable
        headers={['V5 piece', 'ConfiPool', 'Why']}
        rows={[
          [
            'Per-tier TWAB duration',
            'One last-snapshot → this-snapshot window',
            'Hourly vault. Extra windows need extra public W and more FHE.',
          ],
          [
            'vaultPortion (many vaults, one pool)',
            'Always 1',
            'One prize vault. The fraction is pointless until a second vault shares the reserve.',
          ],
          [
            'Adaptive tiers + canary',
            'Fixed Apex / Pulse / Ripple',
            'Canaries need public claim counts. That fights hidden winners.',
          ],
          [
            '4^t shots per tier',
            'Loop exists; demo is 1,1,1; max 4',
            'Each shot is an FHE compare. Full 4^t blows the Sepolia compute budget.',
          ],
          [
            'Liquidation + VRGDA claimer',
            'Encrypted reserve + user claim()',
            'How yield becomes prize token and who pays gas. Not the winner formula.',
          ],
        ]}
      />
      <DocP>
        Adding more shots without shrinking prizes empties the reserve faster. Adding{' '}
        <code>vaultPortion</code> changes nothing until there are two vaults. Adaptive tiers would
        make 100 / 25 / 5 unstable — bad for a two-wallet demo.
      </DocP>
    </>
  );
}

function Keeper() {
  return (
    <>
      <DocLead>
        The indexer process runs a RelayerNode keeper. It opens the hourly round, posts KMS
        unseal, and scores the depositor list. It does not replace the yield adapter, and it does
        not invent input proofs for users.
      </DocLead>
      <DocUl>
        <li>
          Polls <code>nextRoundAt</code>. When due, may harvest only if it is about to begin a
          round — it should not harvest-spam.
        </li>
        <li>
          <code>beginRound</code> → wait for public-decrypt → <code>unsealRound</code> →{' '}
          <code>scoreEntrants</code> in batches (max 16).
        </li>
        <li>Depositor cap 256. Enumeration is for the keeper, not a leaderboard of sizes.</li>
      </DocUl>
      <DocP>
        From <code>indexer/</code>: <code>npm start</code> runs History sync plus the keeper.
      </DocP>
    </>
  );
}

function Live() {
  return (
    <>
      <DocLead>
        Addresses the app defaults to. Env vars override them. History still indexes prior demo
        vaults so the Global feed does not go blank after a redeploy.
      </DocLead>
      <DocTable
        headers={['Piece', 'Address']}
        rows={[
          [
            'Prize vault',
            <DocA
              key="v"
              href="https://sepolia.etherscan.io/address/0x06742409F042B3c5932c6C154B9CE67929076eD0"
            >
              0x0674…76eD0
            </DocA>,
          ],
          [
            'ConfidentialVaultSource',
            <DocA
              key="s"
              href="https://sepolia.etherscan.io/address/0x89A3F09Cc68d89b6825C74392B7563318CcF22D3"
            >
              0x89A3…22D3
            </DocA>,
          ],
          [
            'USDC Mock',
            <DocA
              key="u"
              href="https://sepolia.etherscan.io/address/0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF"
            >
              0x9b5C…DFfF
            </DocA>,
          ],
          [
            'cUSDCMock',
            <DocA
              key="c"
              href="https://sepolia.etherscan.io/address/0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639"
            >
              0x7c5B…3639
            </DocA>,
          ],
          ['Owner / keeper', '0xf2fa…6bC9'],
        ]}
      />
      <DocP>
        <code>minPeriod</code> 3600s. Deploy block 11625426. Tiers Apex 100 / Pulse 25 / Ripple 5
        (6-dec).
      </DocP>
    </>
  );
}

function VaultApi() {
  return (
    <>
      <DocLead>
        Surface of <code>ConfidentialPrizeVault</code> a reviewer will actually read. Types are
        Solidity. Encrypted values are FHE handles.
      </DocLead>
      <DocSig
        name="beginRound"
        signature="function beginRound() external returns (uint32 drawId)"
        tags={[
          { kind: 'notice', text: 'Freeze the current TWAB window and sample encrypted R.' },
          { kind: 'dev', text: 'Marks encR and encTotalWeight publicly decryptable. Reverts TooSoon / PreviousDrawUnresolved / NothingStaked.' },
          { kind: 'return', text: 'drawId — newly opened round (1-based).' },
        ]}
      />
      <DocSig
        name="unsealRound"
        signature="function unsealRound(uint32 drawId, bytes cleartexts, bytes decryptionProof) external"
        tags={[
          { kind: 'notice', text: 'Publish clear R and W after KMS signatures.' },
          { kind: 'param', text: 'cleartexts — abi.encode(uint256 r, uint256 totalWeight).' },
        ]}
      />
      <DocSig
        name="thresholdOf"
        signature="function thresholdOf(uint32 drawId, address user, uint8 tier, uint32 prizeIndex) view returns (uint128)"
        tags={[
          { kind: 'notice', text: 'Public V5 winning-zone threshold for one prize index.' },
          { kind: 'dev', text: 'PRN = keccak256(abi.encode(drawId, vault, user, tier, prizeIndex, R)); threshold = uniform(PRN, W) * tierK.' },
        ]}
      />
      <DocSig
        name="scoreEntrant"
        signature="function scoreEntrant(address user, uint32 drawId) public"
        tags={[
          { kind: 'notice', text: 'Add independent Apex / Pulse / Ripple credits for one saver.' },
          { kind: 'dev', text: 'Idempotent per (drawId, user). Pays encrypted zero if reserve cannot cover the sum.' },
        ]}
      />
      <DocSig
        name="setTiers"
        signature="function setTiers(uint64[3] prizes, uint128[3] k) external onlyOwner"
        tags={[
          { kind: 'notice', text: 'Apex / Pulse / Ripple prizes and odds multipliers.' },
          { kind: 'dev', text: 'k[Ripple] must be 1. k and prizes must strictly decrease. Initializes prize counts to 1 if unset.' },
        ]}
      />
      <DocSig
        name="setTierPrizeCounts"
        signature="function setTierPrizeCounts(uint32[3] counts) external onlyOwner"
        tags={[
          { kind: 'notice', text: 'Independent V5-style shots per tier.' },
          { kind: 'dev', text: 'Each count in 1..MAX_PRIZES_PER_TIER (4). Raising count without shrinking prizes increases expected outflow.' },
        ]}
      />
      <DocSig
        name="claim"
        signature="function claim() external returns (euint64 transferred)"
        tags={[
          { kind: 'notice', text: 'Confidential-transfer pending credits to the caller.' },
          { kind: 'dev', text: 'Non-winners may still call. Encrypted zero does not advertise a miss.' },
        ]}
      />
      <DocP>
        Tests: <code>contracts/test/ConfidentialPrizeVault.ts</code> — seven cases, including
        official PRN encoding. Last recorded run: 7 passing.
      </DocP>
    </>
  );
}

function Faq() {
  return (
    <>
      <DocLead>Short answers. Longer versions live on the concept pages.</DocLead>
      <DocH3>Can I lose my deposit?</DocH3>
      <DocP>No. Withdraw principal anytime. Only the reserve / yield is paid as prizes.</DocP>
      <DocH3>Can two tiers pay me in one draw?</DocH3>
      <DocP>Yes. Shots are independent and additive if the reserve covers the sum.</DocP>
      <DocH3>Why is my Apex chance the same window as Ripple?</DocH3>
      <DocP>
        We use one TWAB span per draw. V5’s long grand-prize lookback is not ported. See{' '}
        <DocA to="/app/docs/time-weighted-balance">Time-weighted balance</DocA>.
      </DocP>
      <DocH3>Who opens the draw?</DocH3>
      <DocP>
        The keeper. The function is permissionless after <code>minPeriod</code>, but the product
        path is keeper-driven.
      </DocP>
      <DocH3>Who picks the random number?</DocH3>
      <DocP>
        Nobody in the product path. <code>FHE.randEuint64()</code> runs inside{' '}
        <code>beginRound</code>. The keeper only posts KMS signatures to unseal it. See{' '}
        <DocA to="/app/docs/randomness">Randomness</DocA>.
      </DocP>
      <DocH3>Why publish W if amounts are private?</DocH3>
      <DocP>
        So anyone can recompute the official V5 thresholds. Per-user weight stays encrypted. See{' '}
        <DocA to="/app/docs/what-stays-private">What stays private</DocA>.
      </DocP>
    </>
  );
}

export const DOC_ARTICLES: Record<DocPageId, ReactNode> = {
  'what-is-confipool': <WhatIs />,
  'try-sepolia': <TrySepolia />,
  'how-a-draw-works': <HowDraw />,
  randomness: <Randomness />,
  'time-weighted-balance': <Twab />,
  'winner-selection': <Winner />,
  'prizes-and-tiers': <Tiers />,
  'prize-money': <PrizeMoney />,
  'vault-source': <VaultSourceArticle />,
  'why-zama': <WhyZama />,
  'what-stays-private': <Privacy />,
  limitations: <Limits />,
  'the-keeper': <Keeper />,
  'live-stack': <Live />,
  'vault-api': <VaultApi />,
  faq: <Faq />,
};
