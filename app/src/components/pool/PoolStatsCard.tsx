import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, DiceIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import type { PoolStats } from '@/hooks/usePoolData';

export function PoolStatsCard({ stats }: { stats: PoolStats }) {
  const drawRemaining = useCountdown(stats.nextDrawAt);
  const windowRemaining = useCountdown(stats.depositWindowClosesAt);
  const live = stats.prizeConfigured && stats.reserveFunded;
  const windowIdle = stats.depositWindowClosesAt === 0n;
  const windowOpen = stats.depositsOpen && !windowIdle;

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-pill">The pool</p>
          <p className="mt-1 text-[0.82rem] text-muted">
            Public facts. No amounts, ever.
          </p>
        </div>
        {stats.isLoading ? null : (
          <Badge tone={live ? 'success' : 'warning'}>{live ? 'Draws live' : 'Awaiting prize'}</Badge>
        )}
      </div>

      <dl className="mt-5 space-y-4">
        <Row
          icon={<HugeiconsIcon icon={Clock01Icon} size={15} aria-hidden />}
          label="Deposit bus"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : windowIdle ? (
              'Waiting for first deposit'
            ) : windowOpen ? (
              formatCountdown(windowRemaining)
            ) : (
              'Closed — allocate & draw'
            )
          }
        />
        <Row
          icon={<HugeiconsIcon icon={Clock01Icon} size={15} aria-hidden />}
          label="Next draw"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : stats.nextDrawAt === 0n ? (
              'After next deposit bus'
            ) : (
              formatCountdown(drawRemaining)
            )
          }
        />
        <Row
          icon={<HugeiconsIcon icon={DiceIcon} size={15} aria-hidden />}
          label="Draws completed"
          value={stats.isLoading ? <Skeleton className="h-5 w-8" /> : stats.drawsCompleted.toString()}
        />
        <Row
          icon={<HugeiconsIcon icon={UserGroupIcon} size={15} aria-hidden />}
          label="Depositors"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-12" />
            ) : (
              `${stats.depositorCount} / ${stats.maxDepositors}`
            )
          }
        />
      </dl>

      <p className="mt-5 border-t border-hairline pt-4 text-[0.76rem] leading-relaxed text-hint">
        Each batch: {Number(stats.depositWindowDuration)}s deposit window, then the keeper parks
        the aggregate in MockYield; draw is due {Number(stats.drawInterval)}s after the window
        closes. Odds stay proportional to your encrypted deposit.
      </p>
    </Card>
  );
}

function Row({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="flex items-center gap-2 text-[0.84rem] text-muted">
        {icon}
        {label}
      </dt>
      <dd className="numeral text-[0.95rem] font-bold">{value}</dd>
    </div>
  );
}
