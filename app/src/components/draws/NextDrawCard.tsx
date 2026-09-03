import { HugeiconsIcon } from '@hugeicons/react';
import { DiceIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import type { PoolStats } from '@/hooks/usePoolData';
import { DRAW_STATUS } from '@/lib/contracts';
import { cn } from '@/lib/utils';

/**
 * Countdown + status for the keeper-driven round. Reviewers do not begin / unseal /
 * score from the UI — the bot runs those on minPeriod (hourly on Sepolia).
 */
export function NextDrawCard({ stats }: { stats: PoolStats }) {
  const { remaining, awaitingReveal } = useNextOpenRemaining(stats);
  const period = Number(stats.minPeriod || 3600n);
  const live = stats.tiersConfigured;
  const status = stats.currentDrawStatus;
  const drawId = stats.currentDrawId;
  const isOpen = status === DRAW_STATUS.Open || awaitingReveal;
  const isRevealed = status === DRAW_STATUS.Revealed;
  const elapsed =
    remaining <= 0 || period <= 0 ? 1 : Math.min(1, Math.max(0, 1 - remaining / period));

  const headline = isOpen
    ? 'Unsealing'
    : isRevealed
      ? 'Scoring'
      : stats.depositorCount === 0n
        ? 'Deposit'
        : remaining > 0
          ? formatCountdown(remaining)
          : 'Soon';

  const blurb = isOpen
    ? `Round #${drawId} is open. The keeper public-decrypts R + total weight, then scores depositors.`
    : isRevealed
      ? `Round #${drawId} is unsealed. The keeper is scoring Apex / Pulse / Ripple for depositors.`
      : stats.depositorCount === 0n
        ? 'Deposit cUSDC so the pool has TWAB weight. The keeper opens a round about once an hour.'
        : `Continuous deposits. Next keeper beginRound in ${formatCountdown(remaining)} (minPeriod ${formatCountdown(period)}).`;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,108,47,0.34),transparent_65%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="label-pill text-white/50">Next round window</p>
          <p className="numeral mt-2.5 text-[clamp(2.25rem,6vw,3.25rem)] leading-none font-medium text-white">
            {headline}
          </p>
          <p className="mt-3 max-w-xl text-[13.5px] text-white/55">{blurb}</p>
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
          aria-label="Progress toward next keeper beginRound"
        >
          <div
            className="h-full rounded-full bg-accent-bright transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(elapsed * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-white/45">
          Deposit and withdraw anytime. The keeper runs beginRound → unsealRound → scoreEntrants
          about every {formatCountdown(period)}. Admin funds the prize reserve for Sepolia demos.
        </p>
      </div>
    </div>
  );
}
