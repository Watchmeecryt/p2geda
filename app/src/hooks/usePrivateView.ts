import { useCallback, useMemo, useState } from 'react';
import type { Address, Hex } from 'viem';
import { useAccount } from 'wagmi';
import { useDecryptValues, useGrantPermit, useHasPermit } from '@zama-fhe/react-sdk';
import { CUSDC_MOCK_ADDRESS, VAULT_ADDRESS } from '@/lib/contracts';

/** Contracts whose encrypted state the connected wallet may reveal to itself. */
const PERMIT_CONTRACTS: Address[] = [VAULT_ADDRESS, CUSDC_MOCK_ADDRESS];

export type PrivateView = {
  /** A cached EIP-712 permit already covers the pool contracts. */
  hasPermit: boolean;
  permitLoading: boolean;
  granting: boolean;
  /** Clear amounts are currently on screen. */
  revealed: boolean;
  decrypting: boolean;
  error: Error | null;
  reveal: () => Promise<void>;
  hide: () => void;
  toggle: () => Promise<void>;
  /** Clear value for a vault handle: 0n when uninitialised, null while hidden or in flight. */
  vaultValue: (handle: Hex | undefined) => bigint | null;
  /** Clear value for a cUSDC handle. */
  tokenValue: (handle: Hex | undefined) => bigint | null;
};

function asBigInt(value: unknown): bigint {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'boolean') return value ? 1n : 0n;
  if (typeof value === 'number' || typeof value === 'string') {
    try {
      return BigInt(value);
    } catch {
      return 0n;
    }
  }
  return 0n;
}

function uniqueHandles(handles: Array<Hex | undefined>): Hex[] {
  return Array.from(new Set(handles.filter((handle): handle is Hex => Boolean(handle))));
}

/**
 * One EIP-712 signature unlocks every encrypted amount this wallet owns across the
 * vault and the confidential token. Handles are decrypted against the contract that
 * owns them, since the relayer verifies each handle/contract pair.
 */
export function usePrivateView(input: {
  vaultHandles: Array<Hex | undefined>;
  tokenHandles: Array<Hex | undefined>;
}): PrivateView {
  const { address } = useAccount();
  const [hidden, setHidden] = useState(false);

  const { data: hasPermitRaw, isLoading: permitLoading } = useHasPermit(
    { contractAddresses: PERMIT_CONTRACTS },
    { enabled: Boolean(address) },
  );
  const hasPermit = Boolean(address && hasPermitRaw === true);
  const revealed = hasPermit && !hidden;

  const { mutateAsync: grantPermit, isPending: granting } = useGrantPermit();

  const vaultHandles = useMemo(() => uniqueHandles(input.vaultHandles), [input.vaultHandles]);
  const tokenHandles = useMemo(() => uniqueHandles(input.tokenHandles), [input.tokenHandles]);

  const vaultInputs = useMemo(
    () =>
      revealed
        ? vaultHandles.map((handle) => ({ encryptedValue: handle, contractAddress: VAULT_ADDRESS }))
        : [],
    [revealed, vaultHandles],
  );

  const tokenInputs = useMemo(
    () =>
      revealed
        ? tokenHandles.map((handle) => ({
            encryptedValue: handle,
            contractAddress: CUSDC_MOCK_ADDRESS,
          }))
        : [],
    [revealed, tokenHandles],
  );

  const vaultQuery = useDecryptValues(vaultInputs, { enabled: vaultInputs.length > 0 });
  const tokenQuery = useDecryptValues(tokenInputs, { enabled: tokenInputs.length > 0 });

  const reveal = useCallback(async () => {
    if (!address) return;
    if (!hasPermit) {
      await grantPermit(PERMIT_CONTRACTS);
    }
    setHidden(false);
  }, [address, hasPermit, grantPermit]);

  const hide = useCallback(() => setHidden(true), []);

  const toggle = useCallback(async () => {
    if (revealed) {
      hide();
      return;
    }
    await reveal();
  }, [revealed, hide, reveal]);

  const vaultValue = useCallback(
    (handle: Hex | undefined): bigint | null => {
      if (!handle) return 0n;
      if (!revealed) return null;
      const value = vaultQuery.data?.[handle];
      return value === undefined ? null : asBigInt(value);
    },
    [revealed, vaultQuery.data],
  );

  const tokenValue = useCallback(
    (handle: Hex | undefined): bigint | null => {
      if (!handle) return 0n;
      if (!revealed) return null;
      const value = tokenQuery.data?.[handle];
      return value === undefined ? null : asBigInt(value);
    },
    [revealed, tokenQuery.data],
  );

  return {
    hasPermit,
    permitLoading,
    granting,
    revealed,
    decrypting: vaultQuery.isFetching || tokenQuery.isFetching,
    error: (vaultQuery.error as Error | null) ?? (tokenQuery.error as Error | null) ?? null,
    reveal,
    hide,
    toggle,
    vaultValue,
    tokenValue,
  };
}
