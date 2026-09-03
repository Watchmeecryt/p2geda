import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, DiceIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { formatCountdown, formatConfidential } from '@/lib/format';
import { DRAW_STATUS } from '@/lib/contracts';
import type { PoolStats } from '@/hooks/usePoolData';

/**
 * Public pool facts only. Round begin / unseal / score is keeper-driven
 * (hourly on Sepolia) — reviewers deposit, wait, then decrypt & claim.
 */
export function PoolStatsCard({ stats }: { stats: PoolStats }) {
  const { remaining, awaitingReveal } = useNextOpenRemaining(stats);
  const live = stats.tiersConfigured;
  const period = Number(stats.minPeriod || 3600n);

  const statusLabel =
    awaitingReveal || stats.currentDrawStatus === DRAW_STATUS.Open
      ? 'Keeper unsealing…'
      : stats.currentDrawStatus === DRAW_STATUS.Revealed
        ? 'Keeper scoring…'
        : remaining > 0
          ? `Next round in ${formatCountdown(remaining)}`
          : stats.depositorCount === 0n
            ? 'Waiting for depositors'
            : 'Keeper will begin soon';

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
          label="Next round"
          value={
            stats.isLoading ? (
              <Skeleton className="h-5 w-16" />
            ) : awaitingReveal || stats.currentDrawStatus === DRAW_STATUS.Open ? (
              'Unsealing'
            ) : remaining > 0 ? (
              formatCountdown(remaining)
            ) : (
              statusLabel
            )
          }
        />
        <Row
          icon={<HugeiconsIcon icon={DiceIcon} size={15} aria-hidden />}
          label="Rounds opened"
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

      <p className="mt-5 border-t border-hairline pt-4 text-[0.76rem] leading-relaxed text-hint">
        {statusLabel}. Keeper cadence ~{formatCountdown(period)} (minPeriod). Deposit and withdraw
        anytime — no bot needed for those.
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
      <dd className="numeral text-[0.95rem] font-bold text-right">{value}</dd>
    </div>
  );
}
