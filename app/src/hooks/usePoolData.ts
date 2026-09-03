import { useAccount, useReadContract, useReadContracts } from 'wagmi';
import { sepolia } from 'viem/chains';
import type { Address, Hex } from 'viem';
import {
  CUSDC_MOCK_ADDRESS,
  DRAW_STATUS,
  ERC20_ABI,
  ERC7984_WRAPPER_ABI,
  MAX_DEPOSITORS,
  UNINITIALIZED_HANDLE,
  USDC_MOCK_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
} from '@/lib/contracts';

const POLL_MS = 12_000;

export type PoolStats = {
  owner: Address | undefined;
  /** Minimum seconds between consecutive draw windows (demo = 120). */
  minPeriod: bigint;
  genesis: bigint;
  /** Unix seconds when the next openDraw is allowed. */
  nextOpenableAt: bigint;
  /** Alias used by countdown UI — same as nextOpenableAt. */
  nextDrawAt: bigint;
  drawCount: bigint;
  /** Alias for drawCount. */
  drawsCompleted: bigint;
  depositorCount: bigint;
  maxDepositors: bigint;
  tiersConfigured: boolean;
  /** Alias — tiers live means draws can award prizes. */
  prizeConfigured: boolean;
  apexPrize: bigint;
  pulsePrize: bigint;
  ripplePrize: bigint;
  reserveTag: Hex | undefined;
  yieldSource: Address | undefined;
  minDrawsBeforeReveal: bigint;
  revealedHandle: Hex | undefined;
  totalPrizesPaidHandle: Hex | undefined;
  currentDrawId: number;
  currentDrawStatus: number;
  currentDrawEncR: Hex | undefined;
  currentDrawEncTotalWeight: Hex | undefined;
  isLoading: boolean;
  refetch: () => void;
};

const VAULT_CONTRACT = { address: VAULT_ADDRESS, abi: VAULT_ABI, chainId: sepolia.id } as const;

export function usePoolStats(): PoolStats {
  const { data, isLoading, refetch } = useReadContracts({
    contracts: [
      { ...VAULT_CONTRACT, functionName: 'owner' },
      { ...VAULT_CONTRACT, functionName: 'minPeriod' },
      { ...VAULT_CONTRACT, functionName: 'genesis' },
      { ...VAULT_CONTRACT, functionName: 'nextRoundAt' },
      { ...VAULT_CONTRACT, functionName: 'roundCount' },
      { ...VAULT_CONTRACT, functionName: 'depositorCount' },
      { ...VAULT_CONTRACT, functionName: 'tiersConfigured' },
      { ...VAULT_CONTRACT, functionName: 'apexPrize' },
      { ...VAULT_CONTRACT, functionName: 'tierPrize', args: [1n] },
      { ...VAULT_CONTRACT, functionName: 'tierPrize', args: [2n] },
      { ...VAULT_CONTRACT, functionName: 'RESERVE_DEPOSIT_TAG' },
      { ...VAULT_CONTRACT, functionName: 'yieldSource' },
      { ...VAULT_CONTRACT, functionName: 'minDrawsBeforePublicReveal' },
      { ...VAULT_CONTRACT, functionName: 'lastTotalPaidRevealHandle' },
      { ...VAULT_CONTRACT, functionName: 'confidentialTotalPrizesPaid' },
    ],
    query: { refetchInterval: POLL_MS },
  });

  const value = <T,>(index: number, fallback: T): T =>
    (data?.[index]?.status === 'success' ? (data[index].result as T) : fallback);

  const drawCount = value<number | bigint>(4, 0);
  const drawCountBig = typeof drawCount === 'bigint' ? drawCount : BigInt(drawCount);
  const currentDrawId = Number(drawCountBig);

  const { data: drawData, refetch: refetchDraw } = useReadContract({
    ...VAULT_CONTRACT,
    functionName: 'roundAt',
    args: [currentDrawId > 0 ? currentDrawId : 0],
    query: {
      enabled: currentDrawId > 0,
      refetchInterval: POLL_MS,
    },
  });

  const nextOpenableAt = BigInt(value<number | bigint>(3, 0));

  let currentDrawStatus: number = DRAW_STATUS.None;
  let currentDrawEncR: Hex | undefined;
  let currentDrawEncTotalWeight: Hex | undefined;
  if (drawData && currentDrawId > 0) {
    const row = drawData as
      | readonly [
          number | bigint,
          number | bigint,
          number | bigint,
          Hex,
          Hex,
          number | bigint,
          number | bigint,
        ]
      | {
          periodStart: number | bigint;
          snapshotAt: number | bigint;
          status: number | bigint;
          encR: Hex;
          encTotalWeight: Hex;
          r: number | bigint;
          totalWeight: number | bigint;
        };

    const status =
      typeof row === 'object' && row !== null && 'status' in row ? row.status : row[2];
    const encR =
      typeof row === 'object' && row !== null && 'encR' in row ? row.encR : row[3];
    const encTotal =
      typeof row === 'object' && row !== null && 'encTotalWeight' in row
        ? row.encTotalWeight
        : row[4];

    currentDrawStatus = Number(status);
    currentDrawEncR = encR === UNINITIALIZED_HANDLE ? undefined : encR;
    currentDrawEncTotalWeight = encTotal === UNINITIALIZED_HANDLE ? undefined : encTotal;
  }

  return {
    owner: value<Address | undefined>(0, undefined),
    minPeriod: BigInt(value<number | bigint>(1, 0)),
    genesis: BigInt(value<number | bigint>(2, 0)),
    nextOpenableAt,
    nextDrawAt: nextOpenableAt,
    drawCount: drawCountBig,
    drawsCompleted: drawCountBig,
    depositorCount: value(5, 0n),
    maxDepositors: MAX_DEPOSITORS,
    tiersConfigured: value(6, false),
    prizeConfigured: value(6, false),
    apexPrize: BigInt(value<number | bigint>(7, 0)),
    pulsePrize: BigInt(value<number | bigint>(8, 0)),
    ripplePrize: BigInt(value<number | bigint>(9, 0)),
    reserveTag: value<Hex | undefined>(10, undefined),
    yieldSource: value<Address | undefined>(11, undefined),
    minDrawsBeforeReveal: value(12, 5n),
    revealedHandle: value<Hex | undefined>(13, undefined),
    totalPrizesPaidHandle: value<Hex | undefined>(14, undefined),
    currentDrawId,
    currentDrawStatus,
    currentDrawEncR,
    currentDrawEncTotalWeight,
    isLoading,
    refetch: () => {
      void refetch();
      void refetchDraw();
    },
  };
}

export type UserPosition = {
  balanceHandle: Hex | undefined;
  claimableHandle: Hex | undefined;
  walletHandle: Hex | undefined;
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
