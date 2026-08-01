import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';
import { Confetti } from '@/components/ui/Confetti';
import { Modal } from '@/components/ui/Modal';
import { formatConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';
import type { WinEntry } from '@/hooks/useWinJournal';

type Props = {
  win: WinEntry | null;
  onClose: () => void;
  onClaim: () => void;
  claiming: boolean;
};

export function WinnerModal({ win, onClose, onClaim, claiming }: Props) {
  if (!win) return null;

  return (
    <>
      <Confetti />
      <Modal
        open
        onClose={onClose}
        size="sm"
        title={win.drawId !== null ? `You won draw #${win.drawId}` : 'You have unclaimed winnings'}
        description={
          win.drawId !== null
            ? 'The pool picked your ticket over encrypted balances. Nobody else can see this amount.'
            : 'A prize was added to your encrypted balance. Draw winners are never published — only you can decrypt what you have accrued.'
        }
      >
        <div className="flex flex-col items-center py-2">
          <div className="relative grid size-24 place-items-center">
            <span
              aria-hidden
              className="halo absolute inset-0 rounded-full bg-mint"
            />
            <span className="trophy-pop relative grid size-20 place-items-center rounded-full bg-accent text-accent-ink shadow-cta-soft">
              <HugeiconsIcon icon={ChampionIcon} size={38} aria-hidden />
            </span>
          </div>

          <p className="label-pill mt-6">Prize won</p>
          <p className="numeral mt-1 text-[2.4rem] leading-none font-bold text-accent-deep">
            {formatConfidential(BigInt(win.amount))}
          </p>
          <p className="mt-1 text-[0.85rem] font-semibold text-muted">
            {CONFIDENTIAL_SYMBOL}
          </p>

          <p className="mt-5 max-w-xs text-center text-[0.8rem] leading-relaxed text-hint">
            Your principal is untouched — this is pure upside. Claim whenever you like; the prize
            keeps accruing in your encrypted balance until you do.
          </p>
        </div>

        <div className="mt-2 flex flex-col gap-2 sm:flex-row">
          <Button fullWidth loading={claiming} onClick={onClaim}>
            Claim now
          </Button>
          <Button variant="secondary" fullWidth onClick={onClose} disabled={claiming}>
            Later
          </Button>
        </div>
      </Modal>
    </>
  );
}
