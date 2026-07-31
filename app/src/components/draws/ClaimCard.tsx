import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, SquareLock02Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { PrivateViewToggle } from '@/components/PrivateViewToggle';
import type { PrivateView } from '@/hooks/usePrivateView';

type Props = {
  view: PrivateView;
  claimable: bigint | null;
  isDepositor: boolean;
  busy: boolean;
  onClaim: () => void;
};

export function ClaimCard({ view, claimable, isDepositor, busy, onClaim }: Props) {
  const nothingToClaim = claimable !== null && claimable === 0n;

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="icon-tile icon-tile--accent size-10">
          <HugeiconsIcon icon={ChampionIcon} size={19} aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="font-bold">Your winnings</h3>
          <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
            Prizes accrue to an encrypted balance. Reveal it with your permit, then claim.
          </p>
        </div>
      </div>

      <div className="note-block mt-5 py-4">
        <p className="text-[0.74rem] font-semibold tracking-wide text-hint uppercase">
          Unclaimed
        </p>
        <div className="mt-1.5">
          <ConfidentialAmount size="lg" value={claimable} decrypting={view.decrypting} />
        </div>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          variant="accent"
          fullWidth
          loading={busy}
          disabled={!isDepositor || nothingToClaim}
          onClick={onClaim}
        >
          Claim winnings
        </Button>
        <PrivateViewToggle view={view} size="md" fullWidth />
      </div>

      {!isDepositor ? (
        <p className="mt-3 text-[0.78rem] text-hint">
          Deposit into the pool first — only depositors can claim.
        </p>
      ) : (
        <p className="mt-3 flex items-start gap-1.5 text-[0.76rem] leading-relaxed text-hint">
          <HugeiconsIcon icon={SquareLock02Icon} size={13} className="mt-0.5 shrink-0" aria-hidden />
          Every depositor can call claim, and a non-winner simply transfers an encrypted zero. That
          is what stops the claim transaction itself from revealing who won.
        </p>
      )}
    </Card>
  );
}
