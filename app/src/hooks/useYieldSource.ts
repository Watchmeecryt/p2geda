import { useReadContract } from 'wagmi';
import { sepolia } from 'viem/chains';
import {
  YIELD_SOURCE_ABI,
  YIELD_VAULT_ADDRESS,
  YIELD_VAULT_CONFIGURED,
} from '@/lib/contracts';
import { formatRateBps } from '@/lib/yieldComposition';

/** Live adapter rate + wiring for the Yield page. */
export function useYieldSource() {
  const enabled = YIELD_VAULT_CONFIGURED;

  const rate = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_SOURCE_ABI,
    functionName: 'rateBps',
    chainId: sepolia.id,
    query: { enabled, refetchInterval: 30_000 },
  });

  const batcher = useReadContract({
    address: YIELD_VAULT_ADDRESS,
    abi: YIELD_SOURCE_ABI,
    functionName: 'depositBatcher',
    chainId: sepolia.id,
    query: { enabled, refetchInterval: 60_000 },
  });

  const rateBps = rate.data !== undefined ? Number(rate.data) : undefined;

  return {
    configured: enabled,
    rateBps,
    rateLabel: formatRateBps(rateBps),
    depositBatcher: batcher.data,
    isLoading: rate.isLoading,
    refetch: () => {
      void rate.refetch();
      void batcher.refetch();
    },
  };
}
