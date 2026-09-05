import { Link } from 'react-router-dom';
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
        description="Sepolia uses Zama’s live confidential-vault batchers and cShares. Staging Morpho does not pay APY yet, so we seed the reserve for demos — mainnet keeps the same adapter on real Steakhouse yield. Full adapter story in Docs → Vault source."
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

      <p className="mt-6 text-[0.86rem] leading-relaxed text-muted">
        Interface, harvest booking, batcher stages, and mainnet addresses:{' '}
        <Link to="/app/docs/vault-source" className="font-bold text-ink underline underline-offset-2">
          Docs → Vault source
        </Link>
        .
      </p>
    </div>
  );
}
