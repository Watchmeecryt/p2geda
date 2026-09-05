import {
  DocA,
  DocCallout,
  DocH2,
  DocH3,
  DocLead,
  DocP,
  DocPre,
  DocSig,
  DocTable,
  DocUl,
} from '@/components/docs/DocPrimitives';
import { YIELD_VAULT_ADDRESS } from '@/lib/contracts';
import { MAINNET_CONFIDENTIAL_VAULT, SEPOLIA_CONFIDENTIAL_VAULT } from '@/lib/yieldComposition';
import { shortenAddress } from '@/lib/format';

export function VaultSourceArticle() {
  return (
    <>
      <DocLead>
        The prize vault never talks to Morpho itself. It talks to one adapter,{' '}
        <code>ConfidentialVaultSource</code>, behind <code>IYieldSource</code>. Swap the adapter
        with <code>setYieldSource</code> and the deposit / draw / claim surface stays the same.
      </DocLead>

      <DocH2>The interface</DocH2>
      <DocPre>{`interface IYieldSource {
    function asset() external view returns (address);
    function supply(euint64 amount) external returns (euint64 supplied);
    function redeem(euint64 amount, address to) external returns (euint64 sent);
    function harvest(address to) external returns (euint64 harvested);
    function principal() external view returns (euint64);
}`}</DocPre>
      <DocP>
        <code>supply</code> / <code>redeem</code> are controller-only (the prize vault).{' '}
        <code>harvest</code> is permissionless and moves whatever the adapter has already settled
        into <code>to</code> as a confidential transfer. The prize vault adds that ciphertext to
        the encrypted reserve — it does not book a plaintext number the adapter reported.
      </DocP>
      <DocSig
        name="ConfidentialPrizeVault.harvest"
        signature="function harvest() external"
        tags={[
          { kind: 'notice', text: 'Pull adapter yield into the encrypted prize reserve.' },
          { kind: 'dev', text: 'No-op if yieldSource is unset. Adds yieldSource.harvest(this) to _reserve. Emits Harvested.' },
        ]}
      />

      <DocH2>What the adapter actually holds</DocH2>
      <DocP>
        Three encrypted pots live on <code>ConfidentialVaultSource</code>:
      </DocP>
      <DocUl>
        <li>
          <code>_principal</code> — idle + allocated cUSDC the prize vault supplied.
        </li>
        <li>
          <code>_inVault</code> — the slice already sent toward the deposit batcher / cShares.
        </li>
        <li>
          <code>_pending</code> — accrued harvest credits from <code>rateBps × principal × time</code>.
        </li>
      </DocUl>
      <DocP>
        Accrual is <code>principal × rateBps × elapsed / (10_000 × 365 days)</code>. That rate is
        the Sepolia seed. It is not Morpho APY. On mainnet the same function still exists as a
        backstop; real growth is supposed to arrive as extra cUSDC after redeem, then get harvested
        the same way.
      </DocP>

      <DocH2>Sepolia today</DocH2>
      <DocP>
        Live adapter:{' '}
        <DocA href={`https://sepolia.etherscan.io/address/${YIELD_VAULT_ADDRESS}`}>
          {shortenAddress(YIELD_VAULT_ADDRESS)}
        </DocA>
        . It is wired to Zama’s published Sepolia confidential-vault addresses. Zama’s own docs
        call the staging ERC-4626 an idle-only VaultV2 with no yield adapter. So:
      </DocP>
      <DocTable
        headers={['Venue', 'Why it does not fund Sepolia prizes']}
        rows={[
          ['Staging Morpho / Steakhouse vault', 'Idle-only. Share price does not drip.'],
          ['Aave / Compound on Sepolia', 'Not wired. They also do not take Zama’s mock USDC as a yield market.'],
          ['Adapter rateBps', 'On-chain seed against encrypted principal. Displayed on Yield.'],
          ['Admin → Fund reserve', 'How demo Apex / Pulse / Ripple actually get paid.'],
        ]}
      />
      <DocCallout tone="honest" title="Prizes on Sepolia are funded, not earned">
        <DocP>
          Every unit that lands in the reserve was a confidential transfer — admin tag or{' '}
          <code>harvest</code> of the rate pot. Do not read a Sepolia win as live Morpho yield.
        </DocP>
      </DocCallout>

      <DocH2>Batchers — why principal is not a public ERC-4626 deposit</DocH2>
      <DocP>
        An ERC-4626 only accepts a public amount. One saver depositing alone would publish their
        size. Zama’s confidential vault sits a batcher in front: many encrypted joins, decrypt
        only the <em>sum</em>, one public deposit, confidential shares back out. Observers see who
        participated, not how much each sent — unless a batch has a single participant, in which
        case the sum is that one amount.
      </DocP>
      <DocPre>{`cUSDC ──joinVault──► deposit batcher ──sum──► ERC-4626
                                              │
cShare ◄──claimShares─────────────────────────┘
cShare ──requestUnwind──► redeem batcher ──► cUSDC buffer
harvest() ──confidentialTransfer──► prize vault reserve`}</DocPre>
      <DocH3>Adapter calls (permissionless except supply/redeem)</DocH3>
      <DocTable
        headers={['Call', 'Does']}
        rows={[
          [<code key="j">joinVault()</code>, 'Sends half of still-idle principal into the current deposit batch. Keeps a cUSDC buffer so most exits stay same-tx.'],
          [<code key="c">claimShares(batchId)</code>, 'Collects encrypted cShares after the batch settles.'],
          [<code key="u">requestUnwind()</code>, 'Sends all cShares through the redeem batcher.'],
          [<code key="w">claimUnwound(batchId)</code>, 'Pulls returned cUSDC and reduces _inVault by what came back.'],
          [<code key="h">harvest(to)</code>, 'Transfers settled _pending to the prize vault.'],
        ]}
      />
      <DocP>
        Users never build those proofs. They encrypt once at deposit. The keeper later moves
        already-encrypted handles. <code>joinVault</code> / unwind are not automatic on every
        deposit — if the keeper is quiet, principal can sit idle in the adapter buffer and draws
        still run on the admin-funded reserve.
      </DocP>

      <DocH2>Published Sepolia batchers</DocH2>
      <DocP>
        From{' '}
        <DocA href={SEPOLIA_CONFIDENTIAL_VAULT.docsUrl}>
          Zama confidential vault addresses
        </DocA>
        , chain 11155111.
      </DocP>
      <DocTable
        headers={['Contract', 'Address']}
        rows={[
          ['Deposit batcher', SEPOLIA_CONFIDENTIAL_VAULT.depositBatcher],
          ['Redeem batcher', SEPOLIA_CONFIDENTIAL_VAULT.redeemBatcher],
          ['cUSDCMock', '0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639'],
          ['cShare', SEPOLIA_CONFIDENTIAL_VAULT.cShare],
          ['Idle ERC-4626', SEPOLIA_CONFIDENTIAL_VAULT.erc4626UnderlyingVault],
          ['Whitelist gate', SEPOLIA_CONFIDENTIAL_VAULT.whitelistGate],
        ]}
      />

      <DocH2>Mainnet — same adapter, live Steakhouse</DocH2>
      <DocP>
        Point the constructor at production batchers. Yield source: Morpho “Steakhouse Confidential
        Prime USDC” VaultV2, gated so the deposit batcher is the vault’s only depositor. Addresses
        from the same Zama reference, chain 1.
      </DocP>
      <DocTable
        headers={['Contract', 'Address']}
        rows={[
          ['Deposit batcher', MAINNET_CONFIDENTIAL_VAULT.depositBatcher],
          ['Redeem batcher', MAINNET_CONFIDENTIAL_VAULT.redeemBatcher],
          ['cUSDC', MAINNET_CONFIDENTIAL_VAULT.cUsdc],
          ['cShare', MAINNET_CONFIDENTIAL_VAULT.cShare],
          ['Steakhouse ERC-4626', MAINNET_CONFIDENTIAL_VAULT.erc4626UnderlyingVault],
          ['USDC', MAINNET_CONFIDENTIAL_VAULT.usdc],
        ]}
      />
      <DocCallout tone="note" title="What plugging it in actually means">
        <DocP>
          Harvest stays a single confidential transfer. The keeper must run redeem ahead of time
          (join → wait → claimShares, and later unwind → claimUnwound) so cUSDC is sitting in the
          adapter when <code>harvest</code> runs. The prize vault never waits on a batch.
        </DocP>
      </DocCallout>

      <DocH2>Risks we inherit</DocH2>
      <DocUl>
        <li>
          <strong>Vault risk.</strong> cShares track a third-party ERC-4626. If that vault loses
          value, the parked slice loses value. “No loss” for a saver’s withdrawable principal
          assumes the adapter buffer plus successful unwinds cover exits. That is why{' '}
          <code>joinVault</code> only sends half of idle principal.
        </li>
        <li>
          <strong>Batch confidentiality, not magic.</strong> A one-depositor batch reveals that
          amount when the sum is decrypted. Harvest size is also a transfer the reserve can see
          after unseal of aggregates — we do not pretend the batcher hides prize funding.
        </li>
        <li>
          <strong>Owner of the batcher is Zama’s, not ours.</strong> They can tune batch age,
          pause joins, set slippage bounds. They cannot decrypt your handles or upgrade our vault.
        </li>
      </DocUl>

      <DocH2>What this page does not claim</DocH2>
      <DocP>
        It does not benchmark Steakhouse APY. It does not say Sepolia Morpho is paying. The Yield
        tab is the live wiring card; this page is the contract story. See also{' '}
        <DocA to="/app/docs/prize-money">Where prizes come from</DocA> and{' '}
        <DocA to="/app/yield">Yield</DocA>.
      </DocP>
    </>
  );
}
