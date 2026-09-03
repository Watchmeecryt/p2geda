import { useCallback, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { sepolia } from 'viem/chains';
import type { Hex } from 'viem';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  MoneyBag02Icon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { PrivateViewToggle } from '@/components/PrivateViewToggle';
import { AmountModal } from '@/components/admin/AmountModal';
import { RevealModal } from '@/components/admin/RevealModal';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { useIsAdmin, usePoolStats } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { UNINITIALIZED_HANDLE, VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts';
import { explorerAddressUrl } from '@/lib/chains';
import { formatConfidential, formatCountdown, shortenAddress } from '@/lib/format';

type Dialog = 'reserve' | 'reveal' | null;

export function AdminPage() {
  const { isConnected } = useAccount();
  const isAdmin = useIsAdmin();
  const stats = usePoolStats();
  const actions = useConfiPoolActions();
  const [dialog, setDialog] = useState<Dialog>(null);

  const { data: adminHandles, refetch: refetchHandles } = useReadContracts({
    contracts: [
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        chainId: sepolia.id,
        functionName: 'confidentialPrizeReserve',
      },
    ],
    query: { enabled: isAdmin, refetchInterval: 12_000 },
  });

  const liveHandle = (index: number): Hex | undefined => {
    const entry = adminHandles?.[index];
    if (entry?.status !== 'success') return undefined;
    const raw = entry.result as Hex;
    return raw === UNINITIALIZED_HANDLE ? undefined : raw;
  };

  const reserveHandle = liveHandle(0);

  const view = usePrivateView({
    vaultHandles: [reserveHandle],
    tokenHandles: [],
  });

  const { remaining, awaitingReveal } = useNextOpenRemaining(stats);

  const refresh = useCallback(() => {
    stats.refetch();
    void refetchHandles();
  }, [stats, refetchHandles]);

  if (!isConnected) {
    return (
      <div>
        <PageHeader kicker="Admin" title="Pool operations" />
        <div className="mt-8">
          <ConnectPrompt
            title="Connect the admin wallet"
            description="Prize reserve funding and public reveal controls are restricted to the vault owner."
          />
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div>
        <PageHeader kicker="Admin" title="Pool operations" />
        <Card className="mt-8">
          <h2 className="font-bold">This wallet is not the pool admin</h2>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">
            Only{' '}
            <a
              href={stats.owner ? explorerAddressUrl(stats.owner) : '#'}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-accent-deep underline underline-offset-2"
            >
              {stats.owner ? shortenAddress(stats.owner) : 'the owner'}
            </a>{' '}
            can fund the reserve. Depositors use Pool and Draws.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Admin"
        title="Pool operations"
        description="For Sepolia demos, fund the encrypted prize reserve yourself (bounty allows an admin-funded yield source). The keeper runs beginRound → unsealRound → scoreEntrants about once an hour."
        action={<PrivateViewToggle view={view} size="md" />}
      />

      <div className="mt-8 grid gap-5">
        <Card>
          <div className="grid gap-6 sm:grid-cols-3">
            <div>
              <p className="label-pill">Prize reserve</p>
              <div className="mt-2">
                <ConfidentialAmount
                  value={view.vaultValue(reserveHandle)}
                  decrypting={view.decrypting}
                  symbol={false}
                />
              </div>
              <p className="mt-1 text-[0.78rem] text-hint">Readable by you only</p>
            </div>
            <div>
              <p className="label-pill">Tier prizes</p>
              <p className="numeral mt-2 text-[1.05rem] font-bold leading-snug">
                {formatConfidential(stats.apexPrize)} / {formatConfidential(stats.pulsePrize)} /{' '}
                {formatConfidential(stats.ripplePrize)}
              </p>
              <p className="mt-1 text-[0.78rem] text-hint">Apex / Pulse / Ripple (set at deploy)</p>
            </div>
            <div>
              <p className="label-pill">Next beginRound</p>
              <p className="numeral mt-2 text-[1.5rem] leading-tight font-bold">
                {awaitingReveal ? 'Keeper unsealing…' : formatCountdown(remaining)}
              </p>
              <p className="mt-1 text-[0.78rem] text-hint">
                {stats.drawCount.toString()} opened · {stats.depositorCount.toString()} depositors
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <ActionCard
            icon={MoneyBag02Icon}
            title="Fund the prize reserve"
            body="Mint/wrap cUSDC on Pool, then send it here with the reserve tag. This is the easy Sepolia demo path — testers see prizes pay without waiting on Morpho staging yield."
            cta="Fund reserve"
            status="Admin only"
            tone="warning"
            onClick={() => setDialog('reserve')}
            disabled={actions.isRunning}
          />
          <ActionCard
            icon={MoneyBag02Icon}
            title="Harvest yield source"
            body="Pulls any ConfidentialVaultSource harvest pot into the encrypted reserve. On Sepolia staging Morpho is idle — prefer Fund reserve for demos."
            cta="Harvest"
            status={stats.yieldSource ? 'Wired' : 'No source'}
            tone={stats.yieldSource ? 'success' : 'warning'}
            onClick={() => void actions.harvest().then((ok) => ok && refresh())}
            disabled={actions.isRunning || !stats.yieldSource}
          />
          <ActionCard
            icon={Analytics01Icon}
            title="Publish total prizes paid"
            body="Marks the aggregate of all claims publicly decryptable after enough draws."
            cta="Open reveal"
            status={`${stats.drawsCompleted}/${stats.minDrawsBeforeReveal} draws`}
            tone={stats.drawsCompleted >= stats.minDrawsBeforeReveal ? 'success' : 'neutral'}
            onClick={() => setDialog('reveal')}
            disabled={actions.isRunning}
          />
        </div>

        <Card>
          <div className="flex items-start gap-3">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={Settings02Icon} size={17} aria-hidden />
            </div>
            <div>
              <h3 className="font-bold">Demo vs mainnet yield</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                Sepolia: fund the reserve from Admin (this page). Optional: call harvest if the
                adapter pot has accrued. Mainnet: swap ConfidentialVaultSource to live Morpho
                batchers — deposits still go vault → source → vault shares; harvest fills the same
                reserve. Draw logic does not change.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {dialog === 'reserve' ? (
        <AmountModal
          onClose={() => setDialog(null)}
          title="Fund the prize reserve"
          description="Encrypted top-up so Apex / Pulse / Ripple can pay during the demo."
          icon={<HugeiconsIcon icon={MoneyBag02Icon} size={20} aria-hidden />}
          fieldLabel="Amount to add to the reserve"
          confirmLabel="Encrypt and fund"
          busy={actions.activeAction === 'fundReserve'}
          note="Wrap cUSDC on the Pool page first. Suggested demo: 500–2000 cUSDC so Ripple (5) and Pulse (25) pay several rounds."
          onConfirm={async (amount) => {
            const ok = await actions.fundReserve(amount, stats.reserveTag);
            if (ok) refresh();
            return ok;
          }}
        />
      ) : null}

      {dialog === 'reveal' ? (
        <RevealModal
          onClose={() => setDialog(null)}
          drawsCompleted={stats.drawsCompleted}
          requiredDraws={stats.minDrawsBeforeReveal}
          revealedHandle={stats.revealedHandle}
          currentHandle={stats.totalPrizesPaidHandle}
          busy={actions.activeAction === 'reveal'}
          onRequestReveal={async () => {
            const ok = await actions.requestReveal();
            if (ok) refresh();
            return ok;
          }}
        />
      ) : null}
    </div>
  );
}

function ActionCard({
  icon,
  title,
  body,
  cta,
  status,
  tone,
  onClick,
  disabled,
}: {
  icon: IconSvgElement;
  title: string;
  body: string;
  cta: string;
  status: string;
  tone: 'success' | 'warning' | 'neutral';
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div className="icon-tile size-10">
          <HugeiconsIcon icon={icon} size={19} aria-hidden />
        </div>
        <Badge tone={tone}>{status}</Badge>
      </div>
      <h3 className="mt-4 font-bold">{title}</h3>
      <p className="mt-1.5 flex-1 text-[0.84rem] leading-relaxed text-muted">{body}</p>
      <Button className="mt-5" variant="secondary" disabled={disabled} onClick={onClick}>
        {cta}
      </Button>
    </Card>
  );
}
