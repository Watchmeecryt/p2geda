import { useEffect, useState } from 'react';

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

function secondsUntil(target: number): number {
  if (!target) return 0;
  return Math.max(0, target - Math.floor(Date.now() / 1000));
}
