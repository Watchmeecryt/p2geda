import { useCallback } from 'react';
import { useAccount, useReadContract } from 'wagmi';
import { sepolia } from 'viem/chains';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { ClaimCard } from '@/components/draws/ClaimCard';
import { NextDrawCard } from '@/components/draws/NextDrawCard';
import { DrawTimeline } from '@/components/draws/DrawTimeline';
import { WinnerModal } from '@/components/draws/WinnerModal';
import { FheDrawExplainer } from '@/components/pool/HowItWorksCard';
import { Button } from '@/components/ui/Button';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { useWinJournal } from '@/hooks/useWinJournal';
import { DRAW_STATUS, VAULT_ABI, VAULT_ADDRESS } from '@/lib/contracts';

export function DrawsPage() {
  const { address, isConnected } = useAccount();
  const stats = usePoolStats();
  const position = useUserPosition();
  const actions = useConfiPoolActions();

  const awaitingAccrual =
    stats.currentDrawStatus === DRAW_STATUS.Revealed &&
    stats.currentDrawId > 0 &&
    position.isDepositor;

  const { data: alreadyAccruedRaw } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    chainId: sepolia.id,
    functionName: 'accrued',
    args: [stats.currentDrawId, address ?? '0x0'],
    query: {
      enabled: Boolean(address && awaitingAccrual),
      refetchInterval: 12_000,
    },
  });

  const showAccrueFallback = awaitingAccrual && alreadyAccruedRaw === false;

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

  const runOpenDraw = useCallback(async () => {
    if (await actions.openDraw()) {
      stats.refetch();
      position.refetch();
    }
  }, [actions, stats, position]);

  const runAccrue = useCallback(async () => {
    if (stats.currentDrawId <= 0) return;
    if (await actions.accrueSelf(stats.currentDrawId)) {
      position.refetch();
    }
  }, [actions, stats.currentDrawId, position]);

  return (
    <div>
      <PageHeader
        kicker="Draws"
        title="Provably fair, completely private"
        description="Every window awards Apex / Pulse / Ripple over encrypted time-weighted balances. Only R and total weight become public."
      />

      {!isConnected ? (
        <div className="mt-8 grid gap-5">
          <NextDrawCard stats={stats} />
          <FheDrawExplainer />
          <ConnectPrompt
            title="Connect to open or claim"
            description="When the countdown hits zero, any connected wallet can open a draw. Connect to participate and claim privately."
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-5">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
            <NextDrawCard
              stats={stats}
              canOpen
              opening={actions.activeAction === 'openDraw'}
              onOpenDraw={runOpenDraw}
            />
            <div className="grid gap-5">
              <ClaimCard
                view={view}
                claimable={claimable}
                isDepositor={position.isDepositor}
                busy={actions.activeAction === 'claim'}
                onClaim={claim}
              />
              {showAccrueFallback ? (
                <Button
                  variant="secondary"
                  loading={actions.activeAction === 'accrue'}
                  disabled={actions.isRunning}
                  onClick={() => void runAccrue()}
                >
                  Accrue my prizes for draw #{stats.currentDrawId}
                </Button>
              ) : null}
              {awaitingAccrual && alreadyAccruedRaw === true ? (
                <p className="text-center text-[0.78rem] leading-relaxed text-hint">
                  The keeper already accrued draw #{stats.currentDrawId} for your wallet. Reveal
                  amounts to see if you won, then claim.
                </p>
              ) : null}
            </div>
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
