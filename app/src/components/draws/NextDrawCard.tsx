import { HugeiconsIcon } from '@hugeicons/react';
import { DiceIcon, SparklesIcon } from '@hugeicons/core-free-icons';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import type { PoolStats } from '@/hooks/usePoolData';
import { cn } from '@/lib/utils';

/**
 * The one dark surface in the product. The countdown is the page's headline number,
 * so it gets the contrast rather than competing with the cards around it.
 */
export function NextDrawCard({ stats }: { stats: PoolStats }) {
  const remaining = useCountdown(stats.nextDrawAt);
  const windowRemaining = useCountdown(stats.depositWindowClosesAt);
  const interval = Number(stats.drawInterval || 1n);
  const windowSecs = Number(stats.depositWindowDuration || 1n);
  const totalCycle = windowSecs + interval;
  const waitingForBus = stats.nextDrawAt === 0n;
  const windowOpen = stats.depositsOpen && stats.depositWindowClosesAt > 0n;
  const idleRedraw = !waitingForBus && stats.depositWindowClosesAt === 0n && stats.lastDrawAt > 0n;
  const elapsed = waitingForBus
    ? 0
    : idleRedraw
      ? Math.min(1, Math.max(0, (interval - remaining) / interval))
      : Math.min(1, Math.max(0, (totalCycle - (windowOpen ? windowRemaining + interval : remaining)) / totalCycle));
  const live = stats.prizeConfigured && stats.reserveFunded;
  const ready = !waitingForBus && remaining === 0 && live;
  const stalled = !waitingForBus && remaining === 0 && !live;

  return (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-ink p-6 shadow-[0_24px_60px_rgba(0,0,0,0.28)] sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-28 -right-16 size-80 rounded-full bg-[radial-gradient(circle,rgba(255,108,47,0.34),transparent_65%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.22] [background-image:repeating-linear-gradient(90deg,rgba(255,108,47,0.14)_0_1px,transparent_1px_9px)] [mask-image:linear-gradient(180deg,#000,transparent_70%)]"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-5">
        <div>
          <p className="label-pill text-white/50">Next draw</p>
          <p className="numeral mt-2.5 text-[clamp(2.25rem,6vw,3.25rem)] leading-none font-medium text-white">
            {waitingForBus
              ? 'Awaiting bus'
              : ready
                ? 'Ready'
                : stalled
                  ? 'On hold'
                  : formatCountdown(remaining)}
          </p>
          <p className="mt-3 text-[13.5px] text-white/55">
            {waitingForBus
              ? `First deposit opens a ${formatCountdown(windowSecs)} bus; draw is due ${formatCountdown(interval)} after it closes.`
              : windowOpen
                ? `Deposit bus still open (${formatCountdown(windowRemaining)} left). Draw follows ${formatCountdown(interval)} after close.`
                : idleRedraw
                  ? `No new bus — yield can keep funding the reserve. Next draw due in ${formatCountdown(remaining)}.`
                  : `Deposit bus closed. Draw due in ${formatCountdown(remaining)}.`}
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
            {live ? 'Prize funded' : 'Waiting on admin'}
          </span>
          <span className="numeral text-[13px] text-white/45">
            {stats.drawsCompleted.toString()} completed
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
          aria-label="Time until the next draw"
        >
          <div
            className="h-full rounded-full bg-accent-bright transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.round(elapsed * 100)}%` }}
          />
        </div>
        <p className="mt-3 text-[12.5px] text-white/45">
          {waitingForBus
            ? 'No batch is open yet. Deposit to start the next bus.'
            : ready
              ? idleRedraw
                ? 'Interval elapsed — admin or keeper can run another draw without a new deposit.'
                : 'The batch timer has elapsed — the keeper can run the draw now.'
              : stalled
                ? 'The timer has elapsed, but the prize reserve still needs funding before a draw can run.'
                : idleRedraw
                  ? 'Depositors stay entered. Accrued yield can fund the next prize without a fresh deposit bus.'
                  : 'Every depositor in this batch is entered automatically. There is nothing to opt into.'}
        </p>
      </div>
    </div>
  );
}
