import { useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { useDecryptPublicValues } from '@zama-fhe/react-sdk';
import { HugeiconsIcon } from '@hugeicons/react';
import { Analytics01Icon, ViewIcon } from '@hugeicons/core-free-icons';
import toast from 'react-hot-toast';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { SparkLine } from '@/components/metrics/SparkLine';
import { usePoolActivity } from '@/hooks/usePoolHistory';
import { usePoolStats } from '@/hooks/usePoolData';
import { humanizeError } from '@/lib/errors';
import { formatConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';

const NO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

function isPublished(handle: Hex | undefined): handle is Hex {
  return Boolean(handle && handle !== NO_HANDLE);
}

/** Public aggregates only — never per-user amounts. */
export function MetricsPage() {
  const stats = usePoolStats();
  const activity = usePoolActivity();
  const { mutateAsync: decryptPublicValues, isPending: decrypting } = useDecryptPublicValues();

  const [prizesPaid, setPrizesPaid] = useState<bigint | null>(null);

  const prizesPublished = isPublished(stats.revealedHandle);
  const prizesReady = stats.drawsCompleted >= stats.minDrawsBeforeReveal;

  const depositSeries = useMemo(() => {
    const deposits = (activity.data ?? [])
      .filter((event) => event.kind === 'deposit')
      .slice()
      .reverse();
    let running = 0;
    return deposits.map((event, index) => {
      running += 1;
      return { x: index, y: running, label: event.id };
    });
  }, [activity.data]);

  const drawSeries = useMemo(() => {
    const draws = (activity.data ?? [])
      .filter((event) => event.kind === 'draw')
      .slice()
      .reverse();
    return draws.map((event, index) => ({
      x: index,
      y: Number(event.drawId ?? index + 1),
      label: event.id,
    }));
  }, [activity.data]);

  const decryptPrizes = async () => {
    if (!stats.revealedHandle) return;
    try {
      const handle = stats.revealedHandle;
      const result = await decryptPublicValues([handle]);
      const clear = result.clearValues[handle] ?? result.clearValues[handle.toLowerCase() as Hex];
      setPrizesPaid(typeof clear === 'bigint' ? clear : BigInt(String(clear ?? 0)));
    } catch (error) {
      toast.error(humanizeError(error));
    }
  };

  return (
    <div>
      <PageHeader
        kicker="Metrics"
        title="Public aggregates only"
        description="Total prizes paid stays encrypted until an admin publishes a snapshot. Charts never show who deposited or who won."
      />

      <div className="mt-8 grid gap-5">
        <MetricPanel
          title="Prizes paid so far"
          eyebrow="Claim aggregate"
          badge={
            prizesPublished
              ? 'Published'
              : prizesReady
                ? 'Awaiting admin'
                : `${stats.drawsCompleted}/${stats.minDrawsBeforeReveal} draws`
          }
          tone={prizesPublished ? 'success' : prizesReady ? 'warning' : 'neutral'}
          body={
            prizesPublished
              ? 'Published after enough draws so a single claim cannot be isolated from the running total.'
              : prizesReady
                ? 'Draw threshold met. An admin can publish total prizes paid from Admin.'
                : `Eligible after ${stats.minDrawsBeforeReveal.toString()} draws so winners stay unlinkable from a single payout.`
          }
          value={prizesPaid}
          loading={stats.isLoading}
          decrypting={decrypting}
          canDecrypt={prizesPublished}
          onDecrypt={() => void decryptPrizes()}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={Analytics01Icon} size={17} aria-hidden />
            </div>
            <div>
              <h3 className="font-bold">Depositor count over time</h3>
              <p className="text-[0.78rem] text-muted">Counts only — never amounts</p>
            </div>
          </div>
          <SparkLine points={depositSeries} />
        </Card>
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={ViewIcon} size={17} aria-hidden />
            </div>
            <div>
              <h3 className="font-bold">Draws opened</h3>
              <p className="text-[0.78rem] text-muted">From indexed vault events</p>
            </div>
          </div>
          <SparkLine points={drawSeries} />
        </Card>
      </div>
    </div>
  );
}

function MetricPanel({
  title,
  eyebrow,
  badge,
  tone,
  body,
  value,
  loading,
  decrypting,
  canDecrypt,
  onDecrypt,
}: {
  title: string;
  eyebrow: string;
  badge: string;
  tone: 'success' | 'warning' | 'neutral';
  body: string;
  value: bigint | null;
  loading: boolean;
  decrypting: boolean;
  canDecrypt: boolean;
  onDecrypt: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-pill">{eyebrow}</p>
          <h2 className="mt-1 font-bold">{title}</h2>
        </div>
        <Badge tone={tone}>{badge}</Badge>
      </div>
      <p className="mt-3 text-[0.84rem] leading-relaxed text-muted">{body}</p>
      <div className="mt-5">
        {loading ? (
          <Skeleton className="h-8 w-32" />
        ) : value !== null ? (
          <p className="numeral text-[1.75rem] font-bold">
            {formatConfidential(value)}{' '}
            <span className="text-[0.9rem] font-semibold text-muted">{CONFIDENTIAL_SYMBOL}</span>
          </p>
        ) : (
          <p className="text-[0.9rem] text-hint">Not decrypted yet</p>
        )}
      </div>
      <Button
        className="mt-5"
        variant="secondary"
        disabled={!canDecrypt || decrypting}
        loading={decrypting}
        onClick={onDecrypt}
      >
        Public-decrypt
      </Button>
    </Card>
  );
}
