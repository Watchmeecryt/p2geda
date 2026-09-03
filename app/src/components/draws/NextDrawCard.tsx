import { HugeiconsIcon } from '@hugeicons/react';
import { DiceIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import type { PoolStats } from '@/hooks/usePoolData';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

export function NextDrawCard({
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
  const period = Number(stats.minPeriod || 120n);
  const live = stats.tiersConfigured;
  const unresolvedOpen = awaitingReveal;
  const openReady =
    stats.depositorCount > 0n && remaining === 0 && live && !unresolvedOpen;
  const elapsed =
    remaining <= 0 || period <= 0 ? 1 : Math.min(1, Math.max(0, 1 - remaining / period));

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,108,47,0.34),transparent_65%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="label-pill text-white/50">Next draw window</p>
          <p className="numeral mt-2.5 text-[clamp(2.25rem,6vw,3.25rem)] leading-none font-medium text-white">
            {unresolvedOpen
              ? 'Open'
              : openReady
                ? 'Ready'
                : stats.depositorCount === 0n
                  ? 'Deposit'
                  : formatCountdown(remaining)}
          </p>
          <p className="mt-3 text-[13.5px] text-white/55">
            {unresolvedOpen
              ? 'Draw is open — waiting for KMS reveal + accrue (keeper).'
              : openReady
                ? 'minPeriod elapsed. Anyone can open the next encrypted draw.'
                : stats.depositorCount === 0n
                  ? 'Deposit cUSDC so the pool has TWAB weight to draw over.'
                  : `Continuous deposits. Next openDraw in ${formatCountdown(remaining)} (minPeriod ${formatCountdown(period)}).`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2.5">
          <span
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold tracking-[0.04em] uppercase',
              live ? 'bg-accent text-accent-ink' : 'bg-white/10 text-white/70',
            )}
          >
            <HugeiconsIcon icon={live ? SparklesIcon : DiceIcon} size={13} aria-hidden />
            {live ? 'Apex · Pulse · Ripple' : 'Tiers unset'}
          </span>
          <span className="numeral text-[13px] text-white/45">
            {stats.drawCount.toString()} opened
          </span>
        </div>
      </div>

      <div className="relative mt-7">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(elapsed * 100)}
          aria-label="Progress toward next openDraw"
        >
          <div
            className="h-full rounded-full bg-accent-bright transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(elapsed * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-white/45">
          Admin funds the prize reserve for Sepolia demos. On mainnet, Morpho yield via the
          confidential vault source fills the same reserve.
        </p>
      </div>

      {onOpenDraw ? (
        <div className="relative mt-7">
          <Button
            variant="accent"
            fullWidth
            size="lg"
            className="h-[4.25rem] text-[1.2rem] font-bold tracking-[-0.01em] shadow-cta-soft sm:h-[4.75rem] sm:text-[1.35rem]"
            disabled={!canOpen || !openReady}
            loading={opening}
            onClick={onOpenDraw}
          >
            <HugeiconsIcon icon={DiceIcon} size={26} aria-hidden />
            {openReady ? 'Open draw' : unresolvedOpen ? 'Awaiting reveal' : `Opens in ${formatCountdown(remaining)}`}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
