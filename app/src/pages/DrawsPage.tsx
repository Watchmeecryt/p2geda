import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { HugeiconsIcon } from '@hugeicons/react';
import { DiceIcon, Key01Icon, SquareLock02Icon } from '@hugeicons/core-free-icons';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { ClaimCard } from '@/components/draws/ClaimCard';
import { NextDrawCard } from '@/components/draws/NextDrawCard';
import { DrawTimeline } from '@/components/draws/DrawTimeline';
import { WinnerModal } from '@/components/draws/WinnerModal';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { useMyPrizeClaims } from '@/hooks/usePoolHistory';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { useWinJournal } from '@/hooks/useWinJournal';

const FAIRNESS_POINTS = [
  {
    icon: DiceIcon,
    title: 'Randomness comes from the chain',
    body: 'Each draw calls FHE.randEuint64() inside the contract. There is no offchain RNG, no seed the admin supplies, and no value anyone can observe before the draw settles.',
  },
  {
    icon: SquareLock02Icon,
    title: 'Weighting happens on ciphertexts',
    body: 'The contract walks depositors, adds each encrypted balance to a running total, and selects the first whose cumulative range contains the random ticket. Balances are never decrypted to do it.',
  },
  {
    icon: Key01Icon,
    title: 'Only the winner learns the result',
    body: 'The payout is added to an encrypted claimable balance, readable by that depositor alone. Everyone else adds an encrypted zero, so the transaction pattern gives nothing away.',
  },
];

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
  const { data: claims = [] } = useMyPrizeClaims();

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
        description="At every interval the pool awards its prize to one depositor, weighted by deposit size and selected onchain over encrypted balances."
      />

      {!isConnected ? (
        <div className="mt-8 grid gap-5">
          <NextDrawCard stats={stats} />
          <ConnectPrompt
            title="Connect to see your winnings"
            description="Draws run whether or not you are watching. Connect to reveal your encrypted prize balance and claim it."
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

          <DrawTimeline
            wins={[
              ...journal.wins,
              ...claims
                .filter((claim) => claim.drawId != null)
                .filter((claim) => !journal.wins.some((win) => win.drawId === claim.drawId))
                .map((claim) => ({
                  drawId: claim.drawId!,
                  amount: '0',
                  at: claim.timestamp ?? 0,
                })),
            ]}
          />
        </div>
      )}

      <Card className="mt-5">
        <h3 className="font-bold">How winner selection stays fair</h3>
        <div className="mt-5 grid gap-5 sm:grid-cols-3">
          {FAIRNESS_POINTS.map((point) => (
            <div key={point.title}>
              <div className="icon-tile size-9">
                <HugeiconsIcon icon={point.icon} size={17} aria-hidden />
              </div>
              <p className="mt-3 text-[0.9rem] font-bold">{point.title}</p>
              <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted">
                {point.body}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <WinnerModal
        win={journal.celebrating}
        onClose={journal.dismissCelebration}
        onClaim={claim}
        claiming={actions.activeAction === 'claim'}
      />
    </div>
  );
}
