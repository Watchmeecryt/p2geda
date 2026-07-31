import { useState } from 'react';
import type { Hex } from 'viem';
import { useDecryptPublicValues } from '@zama-fhe/react-sdk';
import { HugeiconsIcon } from '@hugeicons/react';
import { Analytics01Icon } from '@hugeicons/core-free-icons';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { humanizeError } from '@/lib/errors';
import { formatConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';

type Props = {
  onClose: () => void;
  drawsCompleted: bigint;
  requiredDraws: bigint;
  /** Handle already marked publicly decryptable by a previous reveal, if any. */
  revealedHandle: Hex | undefined;
  /** Current aggregate handle, which changes after every claim. */
  currentHandle: Hex | undefined;
  busy: boolean;
  onRequestReveal: () => Promise<boolean>;
};

const NO_HANDLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Public decryption needs no EIP-712 signature: once the owner marks the aggregate
 * publicly decryptable onchain, anyone can ask the relayer to open that handle.
 */
export function RevealModal({
  onClose,
  drawsCompleted,
  requiredDraws,
  revealedHandle,
  currentHandle,
  busy,
  onRequestReveal,
}: Props) {
  const [total, setTotal] = useState<bigint | null>(null);
  const { mutateAsync: decryptPublicValues, isPending: decrypting } = useDecryptPublicValues();

  const thresholdMet = drawsCompleted >= requiredDraws;
  const published = Boolean(revealedHandle && revealedHandle !== NO_HANDLE);
  const stale = published && currentHandle !== revealedHandle;

  const readAggregate = async () => {
    if (!revealedHandle) return;
    try {
      const result = await decryptPublicValues([revealedHandle]);
      const clear = result.clearValues[revealedHandle] ?? result.clearValues[revealedHandle.toLowerCase() as Hex];
      setTotal(typeof clear === 'bigint' ? clear : BigInt(String(clear ?? 0)));
    } catch (error) {
      toast.error(humanizeError(error));
    }
  };

  return (
    <Modal
      open
      onClose={onClose}
      size="md"
      dismissible={!busy}
      icon={<HugeiconsIcon icon={Analytics01Icon} size={20} aria-hidden />}
      title="Publish total prizes paid"
      description="The only number ConfiPool ever makes public. It aggregates every claim, so no individual prize can be inferred from it."
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 rounded-sm border border-strong bg-surface px-4 py-3">
          <div>
            <p className="text-[0.8rem] font-semibold">Reveal threshold</p>
            <p className="text-[0.76rem] text-hint">
              Unlocks after {requiredDraws.toString()} draws so a single draw cannot be isolated.
            </p>
          </div>
          <Badge tone={thresholdMet ? 'success' : 'warning'}>
            {drawsCompleted.toString()} / {requiredDraws.toString()}
          </Badge>
        </div>

        {published ? (
          <div className="note-block py-4">
            <p className="label-pill">Published aggregate</p>
            {total === null ? (
              <p className="mt-2 text-[0.84rem] text-muted">
                The handle is public. Decrypting it needs no wallet signature.
              </p>
            ) : (
              <p className="numeral mt-2 text-[2rem] leading-none font-bold text-accent-deep">
                {formatConfidential(total)}
                <span className="ml-2 text-[0.9rem] font-semibold text-muted">
                  {CONFIDENTIAL_SYMBOL}
                </span>
              </p>
            )}
            <Button
              className="mt-4"
              variant="secondary"
              size="sm"
              loading={decrypting}
              onClick={readAggregate}
            >
              {total === null ? 'Decrypt publicly' : 'Refresh'}
            </Button>
            {stale ? (
              <p className="mt-3 text-[0.78rem] text-caution">
                Claims have settled since this snapshot, so the live total is now higher. Publish
                again to refresh it.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="note-block text-[0.82rem] leading-relaxed text-muted">
            Publishing calls <code className="font-mono text-[0.78rem]">FHE.makePubliclyDecryptable</code>{' '}
            on the running total. Individual balances, prizes, and claims stay encrypted.
          </p>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-2 sm:flex-row">
        <Button
          fullWidth
          loading={busy}
          disabled={!thresholdMet || (published && !stale)}
          onClick={async () => {
            if (await onRequestReveal()) setTotal(null);
          }}
        >
          {published ? 'Publish updated total' : 'Publish total'}
        </Button>
        <Button variant="secondary" fullWidth disabled={busy} onClick={onClose}>
          Close
        </Button>
      </div>
    </Modal>
  );
}
