import { useEffect, useState } from 'react';
import { DRAW_STATUS } from '@/lib/contracts';
import type { PoolStats } from '@/hooks/usePoolData';

/**
 * Seconds remaining until `targetSeconds`. The value is derived at render time and the
 * interval only forces a re-render, so there is no state to keep in sync.
 */
export function useCountdown(targetSeconds: bigint | number | undefined): number {
  const target = Number(targetSeconds ?? 0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!target) return;
    const id = window.setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [target]);

  return secondsUntil(target);
}

/**
 * Countdown toward the next openDraw. While a draw is still open (awaiting reveal),
 * the contract returns uint40.max — not a real unix time — so we surface that as blocked.
 */
export function useNextOpenRemaining(
  stats: Pick<PoolStats, 'nextOpenableAt' | 'currentDrawStatus'>,
): { remaining: number; awaitingReveal: boolean } {
  const awaitingReveal = stats.currentDrawStatus === DRAW_STATUS.Open;
  const remaining = useCountdown(awaitingReveal ? undefined : stats.nextOpenableAt);
  return { remaining, awaitingReveal };
}

function secondsUntil(target: number): number {
  if (!target) return 0;
  return Math.max(0, target - Math.floor(Date.now() / 1000));
}
