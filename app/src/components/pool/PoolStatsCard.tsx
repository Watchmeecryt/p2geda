import { HugeiconsIcon } from '@hugeicons/react';
import { Clock01Icon, DiceIcon, UserGroupIcon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import type { PoolStats } from '@/hooks/usePoolData';

export function PoolStatsCard({
  stats,
  canDraw = false,
  drawing = false,
  onDraw,
}: {
  stats: PoolStats;
  /** Connected wallet may call permissionless bus `draw()` when due. */
  canDraw?: boolean;
  drawing?: boolean;
  onDraw?: () => void;
}) {
  const drawRemaining = useCountdown(stats.nextDrawAt);
  const windowRemaining = useCountdown(stats.depositWindowClosesAt);
  const live = stats.prizeConfigured && stats.reserveFunded;
  const windowIdle = stats.depositWindowClosesAt === 0n;
  const windowOpen = stats.depositsOpen && !windowIdle;
  /** Idle after a draw: contract still exposes nextDrawAt for admin, but the keeper will not run it. */
  const idleNoBus = windowIdle && stats.lastDrawAt > 0n;
  const busDrawPending = !idleNoBus && stats.nextDrawAt > 0n;
  const ready = busDrawPending && drawRemaining === 0 && live;
  const stalled = busDrawPending && drawRemaining === 0 && !live;

  const drawLabel = ready
    ? 'Draw winner'
    : stalled
      ? 'Prize not funded'
      : busDrawPending
        ? `Draw in ${formatCountdown(drawRemaining)}`
        : idleNoBus
          ? 'Draw after next deposit'
          : 'Draw after deposit bus';

  const drawHint = ready
    ? 'Anyone can run this — it picks a winner onchain over encrypted balances. On mainnet a keeper usually handles it.'
    : stalled
      ? 'The timer has elapsed, but the prize reserve still needs funding before a draw can run.'
      : busDrawPending
        ? 'This stays inactive until the countdown hits zero. Then anyone can click it to pick a winner.'
        : idleNoBus
          ? 'No open deposit bus. A new deposit restarts the public draw cycle; idle redraws stay admin-only.'
          : 'Deposit to open a bus. When the window closes and the draw delay elapses, this button unlocks for anyone.';

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
            ) : idleNoBus ? (
              'After next deposit'
            ) : stats.nextDrawAt === 0n ? (
              'After next deposit bus'
            ) : ready ? (
              'Ready now'
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

      {onDraw ? (
        <div className="mt-5 border-t border-hairline pt-4">
          <Button
            variant="accent"
            fullWidth
            size="lg"
            className="h-[3.75rem] text-[1.05rem] font-bold shadow-cta-soft sm:h-16 sm:text-[1.15rem]"
            disabled={!canDraw || !ready}
            loading={drawing}
            onClick={onDraw}
          >
            <HugeiconsIcon icon={DiceIcon} size={22} aria-hidden />
            {drawLabel}
          </Button>
          <p className="mt-3 text-center text-[0.76rem] leading-relaxed text-hint">{drawHint}</p>
        </div>
      ) : (
        <p className="mt-5 border-t border-hairline pt-4 text-[0.76rem] leading-relaxed text-hint">
          Each batch: {Number(stats.depositWindowDuration)}s deposit window, then capital parks in
          MockYield and the draw is due {Number(stats.drawInterval)}s after close. When ready,{' '}
          <span className="font-semibold text-ink">anyone</span> can run the draw here (or the
          keeper does). Idle redraws without a new bus stay admin-only.
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
      <dd className="numeral text-[0.95rem] font-bold">{value}</dd>
    </div>
  );
}
