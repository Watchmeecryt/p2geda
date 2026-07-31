import { useState } from 'react';
import type { Address, Hex } from 'viem';
import { useDecryptValues } from '@zama-fhe/react-sdk';
import { HugeiconsIcon } from '@hugeicons/react';
import { SquareLock02Icon, ViewIcon } from '@hugeicons/core-free-icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatConfidential } from '@/lib/format';

type Props = {
  handle: Hex | undefined;
  /** The contract that owns the handle — the relayer checks this pairing. */
  contractAddress: Address;
  /** Permit already covers this contract, so revealing needs no new signature. */
  hasPermit: boolean;
  label?: string;
};

/**
 * Historic handles are decrypted one row at a time rather than in a page-wide batch,
 * so a single handle whose ACL grant does not cover this wallet cannot blank the table.
 */
export function HistoryAmount({ handle, contractAddress, hasPermit, label }: Props) {
  const [revealed, setRevealed] = useState(false);

  const { data, isFetching, error } = useDecryptValues(
    handle && revealed ? [{ encryptedValue: handle, contractAddress }] : [],
    { enabled: Boolean(handle) && revealed, retry: false },
  );

  if (!handle) return <span className="text-[0.82rem] text-hint">—</span>;

  if (!revealed) {
    return (
      <button
        type="button"
        onClick={() => setRevealed(true)}
        disabled={!hasPermit}
        title={
          hasPermit
            ? 'Decrypt this amount with your cached permit'
            : 'Reveal your amounts first to decrypt history'
        }
        className="inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[0.82rem] font-semibold text-muted transition-colors hover:bg-[color-mix(in_srgb,var(--background)_70%,#fff)] hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
      >
        <HugeiconsIcon icon={hasPermit ? ViewIcon : SquareLock02Icon} size={13} aria-hidden />
        {hasPermit ? 'Reveal' : 'Encrypted'}
      </button>
    );
  }

  if (isFetching) return <Skeleton className="h-4 w-16" />;

  if (error) {
    return (
      <span
        className="text-[0.78rem] text-hint"
        title="This handle's decryption grant does not cover your wallet."
      >
        not yours to read
      </span>
    );
  }

  const value = data?.[handle];
  if (value === undefined) {
    return <span className="text-[0.78rem] text-hint">unavailable</span>;
  }

  return (
    <span className="numeral text-[0.88rem] font-bold">
      {label ? <span className="text-hint">{label} </span> : null}
      {formatConfidential(typeof value === 'bigint' ? value : BigInt(String(value)))}
    </span>
  );
}
