import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { sepolia } from 'viem/chains';
import type { Address, Hex } from 'viem';
import {
  CUSDC_MOCK_ADDRESS,
  ERC20_ABI,
  ERC7984_WRAPPER_ABI,
  UNINITIALIZED_HANDLE,
  MAX_DEPOSITORS,
  VAULT_ABI,
  VAULT_ADDRESS,
  USDC_MOCK_ADDRESS,
} from '@/lib/contracts';

const POLL_MS = 12_000;

export type PoolStats = {
  owner: Address | undefined;
  drawInterval: bigint;
  depositWindowDuration: bigint;
  depositWindowOpensAt: bigint;
  depositWindowClosesAt: bigint;
  depositsOpen: boolean;
  nextDrawAt: bigint;
  lastDrawAt: bigint;
  drawsCompleted: bigint;
  depositorCount: bigint;
  maxDepositors: bigint;
  minDrawsBeforeReveal: bigint;
  minDepositsBeforeTvlReveal: bigint;
  prizeConfigured: boolean;
  reserveFunded: boolean;
  reserveTag: Hex | undefined;
  revealedHandle: Hex | undefined;
  publicTvlHandle: Hex | undefined;
  totalPrizesPaidHandle: Hex | undefined;
  totalPrincipalHandle: Hex | undefined;
  isLoading: boolean;
  refetch: () => void;
};

const VAULT_CONTRACT = { address: VAULT_ADDRESS, abi: VAULT_ABI, chainId: sepolia.id } as const;

export function usePoolStats(): PoolStats {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...VAULT_CONTRACT, functionName: 'owner' },
      { ...VAULT_CONTRACT, functionName: 'drawInterval' },
      { ...VAULT_CONTRACT, functionName: 'depositWindowDuration' },
      { ...VAULT_CONTRACT, functionName: 'depositWindowOpensAt' },
      { ...VAULT_CONTRACT, functionName: 'depositWindowClosesAt' },
      { ...VAULT_CONTRACT, functionName: 'depositsOpen' },
      { ...VAULT_CONTRACT, functionName: 'nextDrawAt' },
      { ...VAULT_CONTRACT, functionName: 'lastDrawAt' },
      { ...VAULT_CONTRACT, functionName: 'drawsCompleted' },
      { ...VAULT_CONTRACT, functionName: 'depositorCount' },
      { ...VAULT_CONTRACT, functionName: 'minDrawsBeforePublicReveal' },
      { ...VAULT_CONTRACT, functionName: 'prizePerDrawConfigured' },
      { ...VAULT_CONTRACT, functionName: 'prizeReserveFunded' },
      { ...VAULT_CONTRACT, functionName: 'RESERVE_DEPOSIT_TAG' },
      { ...VAULT_CONTRACT, functionName: 'lastTotalPaidRevealHandle' },
      { ...VAULT_CONTRACT, functionName: 'confidentialTotalPrizesPaid' },
      { ...VAULT_CONTRACT, functionName: 'minDepositsBeforePublicTvlReveal' },
      { ...VAULT_CONTRACT, functionName: 'lastPublicTvlRevealHandle' },
      { ...VAULT_CONTRACT, functionName: 'confidentialTotalPrincipal' },
    ],
    query: { refetchInterval: POLL_MS },
  });

  const value = <T,>(index: number, fallback: T): T =>
    (data?.[index]?.status === 'success' ? (data[index].result as T) : fallback);

  return {
    owner: value<Address | undefined>(0, undefined),
    drawInterval: value(1, 0n),
    depositWindowDuration: value(2, 0n),
    depositWindowOpensAt: value(3, 0n),
    depositWindowClosesAt: value(4, 0n),
    depositsOpen: value(5, true),
    nextDrawAt: value(6, 0n),
    lastDrawAt: value(7, 0n),
    drawsCompleted: value(8, 0n),
    depositorCount: value(9, 0n),
    maxDepositors: MAX_DEPOSITORS,
    minDrawsBeforeReveal: value(10, 5n),
    prizeConfigured: value(11, false),
    reserveFunded: value(12, false),
    reserveTag: value<Hex | undefined>(13, undefined),
    revealedHandle: value<Hex | undefined>(14, undefined),
    totalPrizesPaidHandle: value<Hex | undefined>(15, undefined),
    minDepositsBeforeTvlReveal: value(16, 3n),
    publicTvlHandle: value<Hex | undefined>(17, undefined),
    totalPrincipalHandle: value<Hex | undefined>(18, undefined),
    isLoading,
    refetch: () => void refetch(),
  };
}

export type UserPosition = {
  /** Encrypted vault principal handle for the connected account. */
  balanceHandle: Hex | undefined;
  /** Encrypted unclaimed winnings handle. */
  claimableHandle: Hex | undefined;
  /** Encrypted cUSDC wallet balance handle. */
  walletHandle: Hex | undefined;
  /** True once the account has any recorded deposit, which gates withdraw/claim. */
  isDepositor: boolean;
  underlyingBalance: bigint;
  allowance: bigint;
  isLoading: boolean;
  refetch: () => void;
};

export function useUserPosition(): UserPosition {
  const { address } = useAccount();
  const enabled = Boolean(address);

  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...VAULT_CONTRACT, functionName: 'confidentialBalanceOf', args: [address ?? '0x0'] },
      { ...VAULT_CONTRACT, functionName: 'confidentialClaimableOf', args: [address ?? '0x0'] },
      {
        address: CUSDC_MOCK_ADDRESS,
        abi: ERC7984_WRAPPER_ABI,
        chainId: sepolia.id,
        functionName: 'confidentialBalanceOf',
        args: [address ?? '0x0'],
      },
      {
        address: USDC_MOCK_ADDRESS,
        abi: ERC20_ABI,
        chainId: sepolia.id,
        functionName: 'balanceOf',
        args: [address ?? '0x0'],
      },
      {
        address: USDC_MOCK_ADDRESS,
        abi: ERC20_ABI,
        chainId: sepolia.id,
        functionName: 'allowance',
        args: [address ?? '0x0', CUSDC_MOCK_ADDRESS],
      },
    ],
    query: { enabled, refetchInterval: POLL_MS },
  });

  const handle = (index: number): Hex | undefined => {
    const entry = data?.[index];
    if (entry?.status !== 'success') return undefined;
    const raw = entry.result as Hex;
    return raw === UNINITIALIZED_HANDLE ? undefined : raw;
  };

  const balanceHandle = handle(0);

  return {
    balanceHandle,
    claimableHandle: handle(1),
    walletHandle: handle(2),
    // The vault only initialises a balance handle after a recorded deposit.
    isDepositor: Boolean(balanceHandle),
    underlyingBalance:
      data?.[3]?.status === 'success' ? (data[3].result as bigint) : 0n,
    allowance: data?.[4]?.status === 'success' ? (data[4].result as bigint) : 0n,
    isLoading,
    refetch: () => void refetch(),
  };
}

export function useIsAdmin(): boolean {
  const { address } = useAccount();
  const { data: owner } = useReadContract({
    ...VAULT_CONTRACT,
    functionName: 'owner',
  });
  if (!address || !owner) return false;
  return address.toLowerCase() === (owner as Address).toLowerCase();
}
