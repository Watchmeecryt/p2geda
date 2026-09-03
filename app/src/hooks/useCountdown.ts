import { useEffect, useState } from 'react';
import { DRAW_STATUS } from '@/lib/contracts';
import type { PoolStats } from '@/hooks/usePoolData';

/** Contract sentinel when the current draw is still Open (awaiting reveal). */
const UINT40_MAX = 2n ** 40n - 1n;
/** Anything past this unix time is not a real countdown (year 2100). */
const FAR_FUTURE_UNIX = 4_102_444_800;

/**
 * Seconds remaining until `targetSeconds`. The value is derived at render time and the
 * interval only forces a re-render, so there is no state to keep in sync.
 */
export function useCountdown(targetSeconds: bigint | number | undefined): number {
  const target = Number(targetSeconds ?? 0);
  const [, forceTick] = useState(0);

  useEffect(() => {
    if (!target || isBlockedOpenableAt(targetSeconds)) return;
    const id = window.setInterval(() => forceTick((tick) => tick + 1), 1000);
    return () => window.clearInterval(id);
  }, [target, targetSeconds]);

  if (isBlockedOpenableAt(targetSeconds)) return 0;
  return secondsUntil(target);
}

/**
 * Countdown toward the next openDraw.
 *
 * While a draw is Open the contract returns `type(uint40).max` — not a unix time.
 * We also treat that sentinel even before `drawAt` has loaded (status still None),
 * otherwise the UI briefly (or stuck) shows ~300M hours.
 */
export function useNextOpenRemaining(
  stats: Pick<PoolStats, 'nextOpenableAt' | 'currentDrawStatus'>,
): { remaining: number; awaitingReveal: boolean } {
  const blockedBySentinel = isBlockedOpenableAt(stats.nextOpenableAt);
  const awaitingReveal =
    stats.currentDrawStatus === DRAW_STATUS.Open || blockedBySentinel;
  const remaining = useCountdown(awaitingReveal ? undefined : stats.nextOpenableAt);
  return { remaining, awaitingReveal };
}

export function isBlockedOpenableAt(value: bigint | number | undefined): boolean {
  if (value === undefined || value === null) return false;
  try {
    const asBig = typeof value === 'bigint' ? value : BigInt(value);
    if (asBig >= UINT40_MAX) return true;
  } catch {
    return false;
  }
  const asNum = Number(value);
  return Number.isFinite(asNum) && asNum >= FAR_FUTURE_UNIX;
}

function secondsUntil(target: number): number {
  if (!target || !Number.isFinite(target)) return 0;
  return Math.max(0, target - Math.floor(Date.now() / 1000));
}
