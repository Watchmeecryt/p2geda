import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClaimCard } from '@/components/draws/ClaimCard';
import { NextDrawCard } from '@/components/draws/NextDrawCard';
import { DrawTimeline } from '@/components/draws/DrawTimeline';
import { WinnerModal } from '@/components/draws/WinnerModal';
import { FheDrawExplainer } from '@/components/pool/HowItWorksCard';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { useWinJournal } from '@/hooks/useWinJournal';

export function DrawsPage() {
  const { isConnected } = useAccount();
  const stats = usePoolStats();
  const position = useUserPosition();
  const actions = useConfiPoolActions();

  const view = usePrivateView({
    vaultHandles: [position.balanceHandle, position.claimableHandle],
    tokenHandles: [position.walletHandle],
  });

  const claimable = view.vaultValue(position.claimableHandle);

  const journal = useWinJournal({
    claimable,
    drawsCompleted: Number(stats.drawsCompleted),
    enabled: view.revealed && !view.decrypting,
  });

  const claim = useCallback(async () => {
    if (await actions.claim()) {
      journal.dismissCelebration();
      position.refetch();
    }
  }, [actions, journal, position]);

  return (
    <div>
      <PageHeader
        kicker="Draws"
        title="Provably fair, completely private"
        description="The keeper opens a round about once an hour. Only R and total weight become public; decrypt your claimable to see if you won."
      />

      {!isConnected ? (
        <div className="mt-8 grid gap-5">
          <NextDrawCard stats={stats} />
          <FheDrawExplainer />
          <ConnectPrompt
            title="Connect to claim"
            description="Deposit on Pool anytime. After the keeper runs a round, connect here to decrypt claimable and claim privately."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
            <NextDrawCard stats={stats} />
            <ClaimCard
              view={view}
              claimable={claimable}
              isDepositor={position.isDepositor}
              busy={actions.activeAction === 'claim'}
              onClaim={claim}
            />
          </div>

          <DrawTimeline wins={journal.wins} />
          <FheDrawExplainer />
        </div>
      )}

      <WinnerModal
        win={journal.celebrating}
        onClose={journal.dismissCelebration}
        onClaim={() => void claim()}
        claiming={actions.activeAction === 'claim'}
      />
    </div>
  );
}
