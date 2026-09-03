import { useAccount } from 'wagmi';
import { PageHeader } from '@/components/layout/PageHeader';
import {
  ConfidentialVaultCard,
  YieldEngineCard,
} from '@/components/yield/YieldStoryCards';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { useIsAdmin, usePoolStats } from '@/hooks/usePoolData';
import { useYieldSource } from '@/hooks/useYieldSource';

/**
 * Yield story for demos: adapter + Zama batch composition on Sepolia, honest about
 * idle staging Morpho, and clear that mainnet uses the same path with real Steakhouse yield.
 */
export function YieldPage() {
  const { isConnected } = useAccount();
  const isAdmin = useIsAdmin();
  const stats = usePoolStats();
  const actions = useConfiPoolActions();
  const yieldSource = useYieldSource();

  return (
    <div>
      <PageHeader
        kicker="Yield"
        title="How prizes get funded"
        description="Sepolia uses Zama’s live confidential-vault batchers and cShares. Staging Morpho does not pay APY yet, so we seed the reserve for demos — mainnet keeps the same adapter on real Steakhouse yield."
      />

      <div className="mt-8 grid gap-5 xl:grid-cols-2 xl:items-start">
        <YieldEngineCard
          rateLabel={yieldSource.rateLabel}
          apexPrize={stats.apexPrize}
          pulsePrize={stats.pulsePrize}
          ripplePrize={stats.ripplePrize}
          canHarvest={Boolean(isConnected && isAdmin)}
          harvesting={actions.activeAction === 'harvest'}
          harvestDisabled={actions.isRunning || !stats.yieldSource}
          onHarvest={() => void actions.harvest()}
        />
        <ConfidentialVaultCard />
      </div>
    </div>
  );
}
