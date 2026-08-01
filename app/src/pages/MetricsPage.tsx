import { useMemo, useState } from 'react';
import type { Hex } from 'viem';
import { useDecryptPublicValues } from '@zama-fhe/react-sdk';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  ChartIncreaseIcon,
  SquareLock02Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
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

/**
 * Public aggregates only — never per-user amounts.
 * TVL publish needs ≥3 depositors; prizes-paid publish needs ≥5 draws (admin).
 */
export function MetricsPage() {
  const stats = usePoolStats();
  const activity = usePoolActivity();
  const { mutateAsync: decryptPublicValues, isPending: decrypting } = useDecryptPublicValues();

  const [tvl, setTvl] = useState<bigint | null>(null);
  const [prizesPaid, setPrizesPaid] = useState<bigint | null>(null);

  const tvlPublished = isPublished(stats.publicTvlHandle);
  const prizesPublished = isPublished(stats.revealedHandle);
  const tvlReady = stats.depositorCount >= stats.minDepositsBeforeTvlReveal;
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

  const volumeSeries = useMemo(() => {
    const points: Array<{ x: number; y: number }> = [];
    if (tvl !== null) points.push({ x: 0, y: Number(tvl) / 1e6 });
    if (prizesPaid !== null) points.push({ x: 1, y: Number(prizesPaid) / 1e6 });
    if (points.length === 1) points.push({ x: 1, y: points[0].y });
    return points;
  }, [tvl, prizesPaid]);

  const decrypt = async (handle: Hex, kind: 'tvl' | 'prizes') => {
    try {
      const result = await decryptPublicValues([handle]);
      const clear = result.clearValues[handle] ?? result.clearValues[handle.toLowerCase() as Hex];
      const value = typeof clear === 'bigint' ? clear : BigInt(String(clear ?? 0));
      if (kind === 'tvl') setTvl(value);
      else setPrizesPaid(value);
    } catch (error) {
      toast.error(humanizeError(error));
    }
  };

  return (
    <div>
      <PageHeader
        kicker="Metrics"
        title="Public aggregates only"
        description="TVL and total prizes paid stay encrypted until an admin publishes a snapshot. Charts never show who deposited or who won."
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <MetricPanel
          title="Total value locked"
          eyebrow="Principal aggregate"
          badge={
            tvlPublished ? 'Published' : tvlReady ? 'Awaiting admin' : `${stats.depositorCount}/${stats.minDepositsBeforeTvlReveal} depositors`
          }
          tone={tvlPublished ? 'success' : tvlReady ? 'warning' : 'neutral'}
          body={
            tvlPublished
              ? 'An admin published the vault’s encrypted principal total. Anyone can public-decrypt this snapshot — no EIP-712.'
              : tvlReady
                ? 'Deposit threshold met. An admin can publish TVL from the Admin page so every participant can verify pool size.'
                : `TVL becomes eligible for public decrypt after ${stats.minDepositsBeforeTvlReveal.toString()} depositors have joined. Until then the aggregate stays dark.`
          }
          value={tvl}
          loading={stats.isLoading}
          decrypting={decrypting}
          canDecrypt={tvlPublished}
          onDecrypt={() => void decrypt(stats.publicTvlHandle!, 'tvl')}
        />

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
                ? 'Draw threshold met. An admin can publish total prizes paid so everyone can verify volume without seeing who won.'
                : `Total prizes paid becomes eligible after ${stats.minDrawsBeforeReveal.toString()} draws. That delay protects winners from being linked to one payout.`
          }
          value={prizesPaid}
          loading={stats.isLoading}
          decrypting={decrypting}
          canDecrypt={prizesPublished}
          onDecrypt={() => void decrypt(stats.revealedHandle!, 'prizes')}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={ChartIncreaseIcon} size={16} aria-hidden />
            </div>
            <div>
              <p className="label-pill">Depositors over time</p>
              <p className="text-[0.78rem] text-hint">Clear activity count — not amounts</p>
            </div>
          </div>
          {activity.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SparkLine points={depositSeries} emptyLabel="No deposits indexed yet" />
          )}
        </Card>

        <Card>
          <div className="mb-4 flex items-center gap-2">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={Analytics01Icon} size={16} aria-hidden />
            </div>
            <div>
              <p className="label-pill">Draws completed</p>
              <p className="text-[0.78rem] text-hint">Onchain draw ids from the indexer</p>
            </div>
          </div>
          {activity.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : (
            <SparkLine points={drawSeries} emptyLabel="No draws indexed yet" />
          )}
        </Card>
      </div>

      <Card className="mt-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="icon-tile size-9">
            <HugeiconsIcon icon={SquareLock02Icon} size={16} aria-hidden />
          </div>
          <div>
            <p className="label-pill">Published volume (cUSDC)</p>
            <p className="text-[0.78rem] text-hint">
              Orange series appears only after you decrypt published TVL / prizes snapshots above
            </p>
          </div>
        </div>
        <SparkLine
          points={volumeSeries}
          emptyLabel="Decrypt a published snapshot to plot volume"
        />
      </Card>
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
          <h3 className="mt-1 text-[1.05rem] font-bold text-ink">{title}</h3>
        </div>
        <Badge tone={tone}>{badge}</Badge>
      </div>

      {loading ? (
        <Skeleton className="mt-5 h-20 w-full" />
      ) : (
        <div className="mt-5 rounded-lg border border-hairline bg-surface px-4 py-4">
          {value === null ? (
            <p className="text-[0.84rem] leading-relaxed text-muted">{body}</p>
          ) : (
            <p className="numeral text-[1.85rem] leading-none font-bold text-accent-deep">
              {formatConfidential(value)}
              <span className="ml-2 text-[0.85rem] font-semibold text-muted">
                {CONFIDENTIAL_SYMBOL}
              </span>
            </p>
          )}
          {canDecrypt ? (
            <Button
              className="mt-4"
              variant="secondary"
              size="sm"
              loading={decrypting}
              onClick={onDecrypt}
            >
              <HugeiconsIcon icon={ViewIcon} size={15} aria-hidden />
              {value === null ? 'Decrypt publicly' : 'Refresh'}
            </Button>
          ) : null}
        </div>
      )}
    </Card>
  );
}
