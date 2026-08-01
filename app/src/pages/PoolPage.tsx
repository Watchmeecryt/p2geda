import { useCallback } from 'react';
import { useAccount } from 'wagmi';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { FundingCard } from '@/components/pool/FundingCard';
import { DepositWithdrawCard } from '@/components/pool/DepositWithdrawCard';
import { PositionCard } from '@/components/pool/PositionCard';
import { PoolStatsCard } from '@/components/pool/PoolStatsCard';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';

export function PoolPage() {
  const { isConnected } = useAccount();
  const stats = usePoolStats();
  const position = useUserPosition();
  const actions = useConfiPoolActions();

  const view = usePrivateView({
    vaultHandles: [position.balanceHandle, position.claimableHandle],
    tokenHandles: [position.walletHandle],
  });

  const refresh = useCallback(() => {
    position.refetch();
    stats.refetch();
  }, [position, stats]);

  const runDraw = useCallback(async () => {
    if (await actions.triggerDraw()) {
      refresh();
    }
  }, [actions, refresh]);

  return (
    <div>
      <PageHeader
        kicker="Pool"
        title="Save privately, win together"
        description="Deposit the confidential test token to enter every draw. Your principal never leaves your control, and your amounts never leave your wallet in the clear."
      />

      {!isConnected ? (
        <div className="mt-8">
          <ConnectPrompt />
        </div>
      ) : (
        <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
          <div className="grid gap-5">
            <FundingCard
              underlyingBalance={position.underlyingBalance}
              allowance={position.allowance}
              busy={actions.isRunning}
              minting={actions.activeAction === 'mint'}
              wrapping={actions.activeAction === 'wrap'}
              onMint={actions.mintFaucet}
              onWrap={actions.wrap}
              onDone={refresh}
            />
            <DepositWithdrawCard
              busy={actions.isRunning}
              depositing={actions.activeAction === 'deposit'}
              withdrawing={actions.activeAction === 'withdraw'}
              view={view}
              walletBalance={view.tokenValue(position.walletHandle)}
              vaultBalance={view.vaultValue(position.balanceHandle)}
              decrypting={view.decrypting}
              isDepositor={position.isDepositor}
              depositsOpen={stats.depositsOpen}
              depositWindowClosesAt={stats.depositWindowClosesAt}
              onDeposit={actions.deposit}
              onWithdraw={actions.withdraw}
              onDone={refresh}
            />
          </div>

          <div className="grid gap-5">
            <PositionCard
              view={view}
              vaultBalance={view.vaultValue(position.balanceHandle)}
              claimable={view.vaultValue(position.claimableHandle)}
              walletBalance={view.tokenValue(position.walletHandle)}
              isDepositor={position.isDepositor}
            />
            <PoolStatsCard
              stats={stats}
              canDraw
              drawing={actions.activeAction === 'draw'}
              onDraw={runDraw}
            />
          </div>
        </div>
      )}
    </div>
  );
}
