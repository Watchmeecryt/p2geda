import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';

type Timestamped = { blockNumber: bigint; timestamp?: number };

/**
 * Resolves a unix timestamp for each rendered event. The indexer already stores one,
 * so this only falls back to `eth_getBlock` for events that arrived over the RPC path.
 */
export function useBlockTimestamps(events: Timestamped[]) {
  const publicClient = usePublicClient();

  const known = new Map<string, number>();
  const missing: string[] = [];
  for (const event of events) {
    const key = event.blockNumber.toString();
    if (event.timestamp !== undefined) {
      known.set(key, event.timestamp);
    } else if (!missing.includes(key)) {
      missing.push(key);
    }
  }
  missing.sort();

  const query = useQuery({
    queryKey: ['confipool', 'block-times', missing],
    enabled: Boolean(publicClient) && missing.length > 0,
    staleTime: Infinity,
    queryFn: async () => {
      if (!publicClient) return {};
      const entries = await Promise.all(
        missing.map(async (block) => {
          const { timestamp } = await publicClient.getBlock({ blockNumber: BigInt(block) });
          return [block, Number(timestamp)] as const;
        }),
      );
      return Object.fromEntries(entries) as Record<string, number>;
    },
  });

  return (blockNumber: bigint): number | undefined => {
    const key = blockNumber.toString();
    return known.get(key) ?? query.data?.[key];
  };
}
