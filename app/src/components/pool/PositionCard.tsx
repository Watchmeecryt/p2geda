import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, SafeIcon, Wallet01Icon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { PrivateViewToggle } from '@/components/PrivateViewToggle';
import type { PrivateView } from '@/hooks/usePrivateView';

type Props = {
  view: PrivateView;
  vaultBalance: bigint | null;
  claimable: bigint | null;
  walletBalance: bigint | null;
  isDepositor: boolean;
};

export function PositionCard({
  view,
  vaultBalance,
  claimable,
  walletBalance,
  isDepositor,
}: Props) {
  const hasWinnings = claimable !== null && claimable > 0n;

  return (
    <Card tone="accent">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="label-pill">Your position</p>
          <p className="mt-1 text-[0.82rem] text-muted">
            {isDepositor ? 'Encrypted onchain, readable only by you.' : 'No deposit recorded yet.'}
          </p>
        </div>
        {hasWinnings ? <Badge tone="success">Prize waiting</Badge> : null}
      </div>

      <div className="mt-5">
        <div className="flex items-center gap-2 text-[0.74rem] font-semibold tracking-wide text-hint uppercase">
          <HugeiconsIcon icon={SafeIcon} size={14} aria-hidden />
          Pool principal
        </div>
        <div className="mt-1">
          <ConfidentialAmount size="lg" value={vaultBalance} decrypting={view.decrypting} />
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-[var(--color-border-light)] pt-5 shadow-separator-inset">
        <div>
          <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-wide text-hint uppercase">
            <HugeiconsIcon icon={ChampionIcon} size={13} aria-hidden />
            Unclaimed
          </div>
          <div className="mt-1">
            <ConfidentialAmount size="sm" value={claimable} decrypting={view.decrypting} symbol={false} />
          </div>
        </div>
        <div>
          <div className="flex items-center gap-1.5 text-[0.72rem] font-semibold tracking-wide text-hint uppercase">
            <HugeiconsIcon icon={Wallet01Icon} size={13} aria-hidden />
            In wallet
          </div>
          <div className="mt-1">
            <ConfidentialAmount
              size="sm"
              value={walletBalance}
              decrypting={view.decrypting}
              symbol={false}
            />
          </div>
        </div>
      </div>

      <div className="mt-5">
        <PrivateViewToggle view={view} />
        <p className="mt-2 text-[0.74rem] leading-relaxed text-hint">
          {view.hasPermit
            ? 'Your decryption permit is cached in this browser for 30 days.'
            : 'One EIP-712 signature lets only your wallet decrypt these amounts. No transaction, no gas.'}
        </p>
      </div>
    </Card>
  );
}
