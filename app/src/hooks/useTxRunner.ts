import { useCallback, useState } from 'react';
import toast from 'react-hot-toast';
import type { Hex } from 'viem';
import { usePublicClient } from 'wagmi';
import { humanizeError } from '@/lib/errors';

/** Lets a step rename itself mid-flight, e.g. "Encrypting" → "Confirm in your wallet". */
export type ReportProgress = (label: string) => void;

export type TxStep = {
  label: string;
  run: (report: ReportProgress) => Promise<Hex | void>;
};

/** Identifies which flow is in flight so only its own button shows a spinner. */
export type TxAction =
  | 'mint'
  | 'wrap'
  | 'deposit'
  | 'withdraw'
  | 'claim'
  | 'fundReserve'
  | 'beginRound'
  | 'unsealRound'
  | 'scoreEntrant'
  | 'harvest'
  | 'reveal'
  | 'setRevealThreshold';

export type TxRunner = {
  /** True while any flow runs. Use to disable inputs, not to drive a spinner. */
  isRunning: boolean;
  /** The flow currently running, or null when idle. Drives per-button spinners. */
  activeAction: TxAction | null;
  /** Label of the step currently executing, or null when idle. */
  activeStep: string | null;
  lastHash: Hex | null;
  /** Runs steps in order, waiting for each returned hash to confirm. Resolves true on success. */
  run: (action: TxAction, steps: TxStep[], successMessage: string) => Promise<boolean>;
};

/**
 * Sequences the multi-transaction flows (approve → wrap, encrypt → deposit) behind a
 * single toast so the wallet prompts stay legible.
 */
export function useTxRunner(): TxRunner {
  const publicClient = usePublicClient();
  const [activeAction, setActiveAction] = useState<TxAction | null>(null);
  const [activeStep, setActiveStep] = useState<string | null>(null);
  const [lastHash, setLastHash] = useState<Hex | null>(null);

  const run = useCallback(
    async (action: TxAction, steps: TxStep[], successMessage: string) => {
      const toastId = `cp-tx-${Date.now()}`;
      setActiveAction(action);
      try {
        for (const step of steps) {
          const report: ReportProgress = (label) => {
            setActiveStep(label);
            toast.loading(label, { id: toastId });
          };
          report(step.label);

          const hash = await step.run(report);
          if (hash) {
            setLastHash(hash);
            report(`${step.label} — confirming`);
            const receipt = await publicClient?.waitForTransactionReceipt({ hash });
            if (receipt && receipt.status === 'reverted') {
              throw new Error('The transaction reverted onchain.');
            }
          }
        }
        toast.success(successMessage, { id: toastId });
        return true;
      } catch (error) {
        toast.error(humanizeError(error), { id: toastId });
        return false;
      } finally {
        setActiveStep(null);
        setActiveAction(null);
      }
    },
    [publicClient],
  );

  return { isRunning: activeAction !== null, activeAction, activeStep, lastHash, run };
}
