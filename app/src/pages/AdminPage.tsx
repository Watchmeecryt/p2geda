import { useCallback, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { sepolia } from 'viem/chains';
import type { Hex } from 'viem';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  ChartIncreaseIcon,
  DiceIcon,
  MoneyBag02Icon,
  SafeIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { PrivateViewToggle } from '@/components/PrivateViewToggle';
import { AmountModal } from '@/components/admin/AmountModal';
import { RevealModal } from '@/components/admin/RevealModal';
import { RevealThresholdsCard } from '@/components/admin/RevealThresholdsCard';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { useCountdown } from '@/hooks/useCountdown';
import { useIsAdmin, usePoolStats } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { UNINITIALIZED_HANDLE, VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts';
import { explorerAddressUrl } from '@/lib/chains';
import { formatCountdown, shortenAddress } from '@/lib/format';

type Dialog = 'prize' | 'reserve' | 'draw' | 'reveal' | null;

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
      {
        address: VAULT_ADDRESS,
        abi: VAULT_ABI,
        chainId: sepolia.id,
        functionName: 'confidentialPrizePerDraw',
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
  const prizeHandle = liveHandle(1);

  const view = usePrivateView({
    vaultHandles: [reserveHandle, prizeHandle],
    tokenHandles: [],
  });

  const remaining = useCountdown(stats.nextDrawAt);
  const drawReady =
    stats.nextDrawAt > 0n &&
    remaining === 0 &&
    !stats.depositsOpen &&
    stats.prizeConfigured &&
    stats.reserveFunded &&
    stats.depositorCount > 0n;

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
            description="Prize configuration, reserve funding, draws, and the public reveal are restricted to the vault owner."
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
            can fund the reserve, set the prize, or trigger a draw. Everything a depositor needs
            lives on the Pool and Draws pages.
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
        description="Fund the prize reserve (or harvest mock yield into it), set the prize per draw, and trigger draws. The keeper automates draw + accrue/harvest with the same owner key."
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
              <p className="label-pill">Prize per draw</p>
              <div className="mt-2">
                <ConfidentialAmount
                  value={view.vaultValue(prizeHandle)}
                  decrypting={view.decrypting}
                  symbol={false}
                />
              </div>
              <p className="mt-1 text-[0.78rem] text-hint">
                {stats.prizeConfigured ? 'Configured' : 'Not set yet'}
              </p>
            </div>
            <div>
              <p className="label-pill">Next draw</p>
              <p className="numeral mt-2 text-[1.5rem] leading-tight font-bold">
                {formatCountdown(remaining)}
              </p>
              <p className="mt-1 text-[0.78rem] text-hint">
                {stats.drawsCompleted.toString()} completed · {stats.depositorCount.toString()}{' '}
                depositors
              </p>
            </div>
          </div>
        </Card>

        <div className="grid gap-5 md:grid-cols-2">
          <ActionCard
            icon={MoneyBag02Icon}
            title="Fund the prize reserve"
            body="Sends your cUSDC to the vault with the reserve tag, so the receiver hook books it as prize funding instead of a deposit. Also used as a fallback when yield harvest has not filled the reserve yet."
            cta="Fund reserve"
            status={stats.reserveFunded ? 'Funded' : 'Empty'}
            tone={stats.reserveFunded ? 'success' : 'warning'}
            onClick={() => setDialog('reserve')}
            disabled={actions.isRunning}
          />
          <ActionCard
            icon={SafeIcon}
            title="Set the prize per draw"
            body="The amount committed on each draw, encrypted before it is submitted. A draw pays out only if the reserve still covers it."
            cta={stats.prizeConfigured ? 'Update prize' : 'Set prize'}
            status={stats.prizeConfigured ? 'Configured' : 'Not set'}
            tone={stats.prizeConfigured ? 'success' : 'warning'}
            onClick={() => setDialog('prize')}
            disabled={actions.isRunning}
          />
          <ActionCard
            icon={DiceIcon}
            title="Trigger a draw"
            body="Runs FHE randomness and deposit-weighted selection over encrypted balances. In normal operation the backend keeper calls this when the interval elapses — use this button only for a manual or emergency draw."
            cta="Run draw"
            status={drawReady ? 'Ready' : 'Not ready'}
            tone={drawReady ? 'success' : 'neutral'}
            onClick={() => setDialog('draw')}
            disabled={actions.isRunning}
          />
          <ActionCard
            icon={Analytics01Icon}
            title="Publish total prizes paid"
            body="Marks the aggregate of all claims publicly decryptable. Needs no signature to read, and unlocks only after the draw threshold. Visible on Metrics."
            cta="Open reveal"
            status={`${stats.drawsCompleted}/${stats.minDrawsBeforeReveal} draws`}
            tone={stats.drawsCompleted >= stats.minDrawsBeforeReveal ? 'success' : 'neutral'}
            onClick={() => setDialog('reveal')}
            disabled={actions.isRunning}
          />
          <ActionCard
            icon={ChartIncreaseIcon}
            title="Publish vault TVL"
            body="Marks the encrypted principal total publicly decryptable for Metrics. Unlocks after enough unique depositors so early single-deposit size cannot be inferred."
            cta="Publish TVL"
            status={`${stats.depositorCount}/${stats.minDepositsBeforeTvlReveal} depositors`}
            tone={
              stats.depositorCount >= stats.minDepositsBeforeTvlReveal ? 'success' : 'neutral'
            }
            onClick={() => void actions.requestPublicTvlReveal().then((ok) => ok && refresh())}
            disabled={
              actions.isRunning || stats.depositorCount < stats.minDepositsBeforeTvlReveal
            }
          />
        </div>

        <RevealThresholdsCard
          drawsThreshold={stats.minDrawsBeforeReveal}
          depositsThreshold={stats.minDepositsBeforeTvlReveal}
          busyDraws={actions.activeAction === 'setRevealThreshold'}
          busyDeposits={actions.activeAction === 'setTvlThreshold'}
          disabled={actions.isRunning}
          onSaveDraws={async (value) => {
            const ok = await actions.setMinDrawsBeforePublicReveal(value);
            if (ok) refresh();
            return ok;
          }}
          onSaveDeposits={async (value) => {
            const ok = await actions.setMinDepositsBeforePublicTvlReveal(value);
            if (ok) refresh();
            return ok;
          }}
        />

        <Card>
          <div className="flex items-start gap-3">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={Settings02Icon} size={17} aria-hidden />
            </div>
            <div>
              <h3 className="font-bold">Mock yield path</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                Open the Yield page to bootstrap-allocate USDC into MockYield4626, accrue a
                fake APR, and harvest surplus into this same encrypted reserve. Production swaps
                MockYield4626 for Morpho VaultV2; draw logic stays unchanged.
              </p>
            </div>
          </div>
        </Card>
      </div>

      {dialog === 'reserve' ? (
      <AmountModal
        onClose={() => setDialog(null)}
        title="Fund the prize reserve"
        description="This is the pool's mock yield. It is transferred confidentially, so the reserve size stays private."
        icon={<HugeiconsIcon icon={MoneyBag02Icon} size={20} aria-hidden />}
        fieldLabel="Amount to add to the reserve"
        confirmLabel="Encrypt and fund"
        busy={actions.activeAction === 'fundReserve'}
        note="You need wrapped cUSDC in the admin wallet. Wrap it on the Pool page first."
        onConfirm={async (amount) => {
          if (!stats.reserveTag) return false;
          const ok = await actions.fundReserve(amount, stats.reserveTag);
          if (ok) refresh();
          return ok;
        }}
      />
      ) : null}

      {dialog === 'prize' ? (
      <AmountModal
        onClose={() => setDialog(null)}
        title="Set the prize per draw"
        description="Every draw commits this amount to exactly one depositor, chosen over encrypted balances."
        icon={<HugeiconsIcon icon={SafeIcon} size={20} aria-hidden />}
        fieldLabel="Prize awarded each draw"
        confirmLabel="Encrypt and set"
        busy={actions.activeAction === 'setPrize'}
        note="Keep this well below the reserve. If the reserve ever falls short, the draw still runs but awards an encrypted zero."
        onConfirm={async (amount) => {
          const ok = await actions.setPrizePerDraw(amount);
          if (ok) refresh();
          return ok;
        }}
      />
      ) : null}

      <Modal
        open={dialog === 'draw'}
        onClose={() => setDialog(null)}
        dismissible={actions.activeAction !== 'draw'}
        icon={<HugeiconsIcon icon={DiceIcon} size={20} aria-hidden />}
        title="Run the next draw"
        description="Selection happens entirely onchain over ciphertexts. The keeper normally submits this; use it here only if you need a manual run."
        footer={
          <>
            <Button
              fullWidth
              loading={actions.activeAction === 'draw'}
              disabled={actions.isRunning || !drawReady}
              onClick={async () => {
                if (await actions.triggerDraw()) {
                  refresh();
                  setDialog(null);
                }
              }}
            >
              Run draw
            </Button>
            <Button
              variant="secondary"
              fullWidth
              disabled={actions.isRunning}
              onClick={() => setDialog(null)}
            >
              Cancel
            </Button>
          </>
        }
      >
        <ul className="space-y-2">
          <Requirement met={stats.prizeConfigured} label="Prize per draw is configured" />
          <Requirement met={stats.reserveFunded} label="Prize reserve is funded" />
          <Requirement met={stats.depositorCount > 0n} label="At least one depositor" />
          <Requirement
            met={remaining === 0}
            label={
              remaining === 0
                ? 'Draw interval has elapsed'
                : `Draw interval elapses in ${formatCountdown(remaining)}`
            }
          />
        </ul>
      </Modal>

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

function Requirement({ met, label }: { met: boolean; label: string }) {
  return (
    <li className="flex items-center gap-2.5 text-[0.86rem]">
      <span
        aria-hidden
        className={
          met
            ? 'grid size-5 place-items-center rounded-full bg-ink text-[0.7rem] text-white'
            : 'grid size-5 place-items-center rounded-full border border-strong text-[0.7rem] text-hint'
        }
      >
        {met ? '✓' : '•'}
      </span>
      <span className={met ? 'text-ink' : 'text-muted'}>{label}</span>
    </li>
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
