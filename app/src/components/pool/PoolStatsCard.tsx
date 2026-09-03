import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, DiceIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { formatCountdown, formatConfidential } from '@/lib/format';
import { DRAW_STATUS } from '@/lib/contracts';
import type { PoolStats } from '@/hooks/usePoolData';

export function PoolStatsCard({
  stats,
  canOpen = false,
  opening = false,
  onOpenDraw,
}: {
  stats: PoolStats;
  canOpen?: boolean;
  opening?: boolean;
  onOpenDraw?: () => void;
}) {
  const { remaining, awaitingReveal } = useNextOpenRemaining(stats);
  const live = stats.tiersConfigured;
  const openReady =
    stats.depositorCount > 0n &&
    remaining === 0 &&
    live &&
    stats.currentDrawStatus !== DRAW_STATUS.Open;

  const statusLabel =
    awaitingReveal
      ? 'Awaiting reveal'
      : stats.currentDrawStatus === DRAW_STATUS.Revealed
        ? 'Revealed — accrue'
        : openReady
          ? 'Ready to open'
          : remaining > 0
            ? `Opens in ${formatCountdown(remaining)}`
            : 'Waiting for depositors';

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-pill">The pool</p>
          <p className="mt-1 text-[0.82rem] text-muted">Public facts. No amounts, ever.</p>
        </div>
        {stats.isLoading ? null : (
          <Badge tone={live ? 'success' : 'warning'}>
            {live ? 'Tiers live' : 'Tiers not set'}
          </Badge>
        )}
      </div>

      <dl className="mt-5 space-y-4">
        <Row
          icon={<HugeiconsIcon icon={Clock01Icon} size={15} aria-hidden />}
          label="Next openDraw"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : openReady ? (
              'Ready now'
            ) : awaitingReveal ? (
              'Awaiting reveal'
            ) : remaining > 0 ? (
              formatCountdown(remaining)
            ) : (
              statusLabel
            )
          }
        />
        <Row
          icon={<HugeiconsIcon icon={DiceIcon} size={15} aria-hidden />}
          label="Draws opened"
          value={stats.isLoading ? <Skeleton className="h-5 w-8" /> : stats.drawCount.toString()}
        />
        <Row
          icon={<HugeiconsIcon icon={UserGroupIcon} size={15} aria-hidden />}
          label="Depositors"
          value={
            stats.isLoading ? <Skeleton className="h-5 w-12" /> : stats.depositorCount.toString()
          }
        />
        <Row
          icon={<HugeiconsIcon icon={DiceIcon} size={15} aria-hidden />}
          label="Tiers (Apex / Pulse / Ripple)"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-24" />
            ) : (
              `${formatConfidential(stats.apexPrize)} / ${formatConfidential(stats.pulsePrize)} / ${formatConfidential(stats.ripplePrize)}`
            )
          }
        />
      </dl>

      {onOpenDraw ? (
        <div className="mt-5 border-t border-hairline pt-4">
          <Button
            variant="accent"
            fullWidth
            size="lg"
            className="h-[3.75rem] text-[1.05rem] font-bold shadow-cta-soft sm:h-16 sm:text-[1.15rem]"
            disabled={!canOpen || !openReady}
            loading={opening}
            onClick={onOpenDraw}
          >
            <HugeiconsIcon icon={DiceIcon} size={22} aria-hidden />
            {openReady ? 'Open draw' : statusLabel}
          </Button>
          <p className="mt-3 text-center text-[0.76rem] leading-relaxed text-hint">
            Opening freezes TWAB weight and draws encrypted randomness. The keeper reveals and
            accrues Apex / Pulse / Ripple in the background.
          </p>
        </div>
      ) : (
        <p className="mt-5 border-t border-hairline pt-4 text-[0.76rem] leading-relaxed text-hint">
          Demo cadence: {Number(stats.minPeriod)}s between draws. Deposits stay open — no timed bus.
        </p>
      )}
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
      <dd className="numeral text-[0.95rem] font-bold text-right">{value}</dd>
    </div>
  );
}
