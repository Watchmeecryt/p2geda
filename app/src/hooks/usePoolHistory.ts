import { useQuery } from '@tanstack/react-query';
import { parseAbiItem, type Address, type Hex, type Log } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import { VAULT_ADDRESS } from '@/lib/contracts';
import { SEPOLIA_CHAIN_ID } from '@/lib/chains';
import { supabase, supabaseConfigured, type VaultEventRow } from '@/lib/supabase';

/** Block the live V5 vault was deployed in; the RPC fallback starts here. */
export const VAULT_DEPLOYMENT_BLOCK = 11_117_640n;

/** Public RPCs cap eth_getLogs spans, so the fallback scan is chunked. */
const LOG_CHUNK = 45_000n;

/** How many rows the activity feed keeps in memory. */
const FEED_LIMIT = 500;

export type ActivityKind =
  | 'deposit'
  | 'withdrawal'
  | 'draw'
  | 'reveal_draw'
  | 'accrue'
  | 'claim'
  | 'reserve'
  | 'reveal';

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
  account?: Address;
  /** Encrypted amount handle, decryptable only by whoever holds the ACL grant. */
  handle?: Hex;
  drawId?: bigint;
  /** Unix seconds, resolved by the indexer. Undefined on the RPC fallback path. */
  timestamp?: number;
};

/**
 * Activity comes from the Supabase index the `indexer/` worker maintains. Rebuilding
 * the whole log history in the browser on every mount was slow and rate-limited the
 * RPC, so that path now only runs when Supabase has not been configured — or when the
 * configured anon key is rejected (401), so History still works after a key rotation.
 */
export function usePoolActivity() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['confipool', 'activity', VAULT_ADDRESS, supabaseConfigured],
    enabled: supabaseConfigured || Boolean(publicClient),
    refetchInterval: 20_000,
    queryFn: async (): Promise<ActivityEvent[]> => {
      if (supabaseConfigured) {
        try {
          return await fetchIndexedActivity();
        } catch (error) {
          if (!isSupabaseUnavailable(error) || !publicClient) throw error;
          console.warn('[history] Supabase unreachable; falling back to RPC logs.', error);
          return scanActivityFromRpc(publicClient);
        }
      }
      if (!publicClient) return [];
      return scanActivityFromRpc(publicClient);
    },
  });
}

async function fetchIndexedActivity(): Promise<ActivityEvent[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('vault_events')
    .select('event_type,account_address,amount_handle,draw_id,tx_hash,log_index,block_number,block_timestamp')
    .eq('chain_id', SEPOLIA_CHAIN_ID)
    .eq('vault_address', VAULT_ADDRESS.toLowerCase())
    .order('block_number', { ascending: false })
    .order('log_index', { ascending: false })
    .limit(FEED_LIMIT);

  if (error) throw new Error(error.message);
  return (data ?? []).map(rowToEvent);
}

/** Auth failures and unreachable hosts both fall back to RPC log scanning. */
function isSupabaseUnavailable(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /invalid api key|jwt|unauthorized|401|failed to fetch|networkerror|err_name_not_resolved|name_not_resolved|enotfound|fetch failed|load failed|network request failed/i.test(
    message,
  );
}

function rowToEvent(row: VaultEventRow): ActivityEvent {
  const timestamp = row.block_timestamp
    ? Math.floor(new Date(row.block_timestamp).getTime() / 1000)
    : undefined;

  return {
    id: `${row.tx_hash}-${row.log_index}`,
    kind: row.event_type as ActivityKind,
    blockNumber: BigInt(row.block_number),
    txHash: row.tx_hash as Hex,
    logIndex: row.log_index,
    account: (row.account_address as Address | null) ?? undefined,
    handle: (row.amount_handle as Hex | null) ?? undefined,
    drawId: coerceDrawId(row.draw_id),
    timestamp,
  };
}

/* ── RPC fallback ─────────────────────────────────────────────────────────── */

const EVENTS = {
  deposit: parseAbiItem(
    'event Deposited(address indexed account, uint40 timestamp, uint256 observationIndex)',
  ),
  withdrawal: parseAbiItem(
    'event Withdrawn(address indexed account, uint40 timestamp, uint256 observationIndex)',
  ),
  draw: parseAbiItem(
    'event DrawOpened(uint32 indexed drawId, uint40 periodStart, uint40 snapshotAt)',
  ),
  reveal_draw: parseAbiItem(
    'event DrawRevealed(uint32 indexed drawId, uint64 r, uint128 totalWeight)',
  ),
  claim: parseAbiItem('event PrizeClaimed(address indexed account, bytes32 indexed amountHandle)'),
  reserve: parseAbiItem('event PrizeReserveFunded(bytes32 indexed newReserveHandle)'),
  reveal: parseAbiItem(
    'event TotalPrizesPaidRevealRequested(uint32 indexed drawId, bytes32 indexed totalPaidHandle)',
  ),
} as const;

type AnyLog = Log<bigint, number, false> & { args?: Record<string, unknown> };

type RpcClient = NonNullable<ReturnType<typeof usePublicClient>>;

async function scanActivityFromRpc(client: RpcClient): Promise<ActivityEvent[]> {
  const latest = await client.getBlockNumber();

  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  for (let from = VAULT_DEPLOYMENT_BLOCK; from <= latest; from += LOG_CHUNK) {
    const to = from + LOG_CHUNK - 1n;
    ranges.push({ fromBlock: from, toBlock: to > latest ? latest : to });
  }

  const collected = await Promise.all(
    ranges.flatMap((range) =>
      (Object.entries(EVENTS) as Array<[keyof typeof EVENTS, (typeof EVENTS)[keyof typeof EVENTS]]>).map(
        async ([kind, event]) => {
          const logs = await client.getLogs({ address: VAULT_ADDRESS, event, ...range });
          return (logs as AnyLog[]).map((log) => logToEvent(kind, log));
        },
      ),
    ),
  );

  return collected
    .flat()
    .sort((a, b) =>
      a.blockNumber === b.blockNumber
        ? b.logIndex - a.logIndex
        : Number(b.blockNumber - a.blockNumber),
    );
}

function coerceDrawId(value: unknown): bigint | undefined {
  if (typeof value === 'bigint') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return BigInt(value);
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return BigInt(value);
  }
  return undefined;
}

function logToEvent(kind: ActivityKind, log: AnyLog): ActivityEvent {
  const args = log.args ?? {};
  return {
    id: `${log.transactionHash}-${log.logIndex}`,
    kind,
    blockNumber: log.blockNumber,
    txHash: log.transactionHash,
    logIndex: log.logIndex,
    account: args.account as Address | undefined,
    handle: (args.amountHandle ?? args.newReserveHandle ?? args.totalPaidHandle) as
      | Hex
      | undefined,
    drawId: coerceDrawId(args.drawId),
  };
}

/* ── Derived views ────────────────────────────────────────────────────────── */

/** The connected wallet's own deposits, withdrawals and claims, newest first. */
export function useMyActivity() {
  const { address } = useAccount();
  const query = usePoolActivity();

  const mine = address
    ? (query.data ?? []).filter(
        (event) => event.account && event.account.toLowerCase() === address.toLowerCase(),
      )
    : [];

  return { ...query, data: mine };
}

/** Draws are the pool-wide timeline every depositor participates in. */
export function useDrawHistory() {
  const query = usePoolActivity();
  const draws = (query.data ?? []).filter((event) => event.kind === 'draw');
  return { ...query, data: draws };
}

export type PrizeClaim = {
  id: string;
  account: Address;
  handle: Hex;
  drawId: number | null;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
  timestamp?: number;
};

/**
 * Prize claims for the connected wallet. Sourced from the dedicated `prize_claims`
 * table so History can show Draws won even when the browser never decrypted an
 * unclaimed balance before the claim cleared it.
 */
export function useMyPrizeClaims() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ['confipool', 'prize-claims', VAULT_ADDRESS, address, supabaseConfigured],
    enabled: Boolean(address) && (supabaseConfigured || Boolean(publicClient)),
    refetchInterval: 20_000,
    queryFn: async (): Promise<PrizeClaim[]> => {
      if (!address) return [];
      if (supabaseConfigured) {
        try {
          return await fetchIndexedClaims(address);
        } catch (error) {
          if (!isSupabaseUnavailable(error) || !publicClient) throw error;
          console.warn('[history] Supabase unreachable; falling back to RPC claim scan.', error);
          const activity = await scanActivityFromRpc(publicClient);
          return claimsFromActivity(activity, address);
        }
      }
      if (!publicClient) return [];
      const activity = await scanActivityFromRpc(publicClient);
      return claimsFromActivity(activity, address);
    },
  });
}

function claimsFromActivity(activity: ActivityEvent[], address: Address): PrizeClaim[] {
  return activity
    .filter(
      (event) =>
        event.kind === 'claim' &&
        event.account &&
        event.account.toLowerCase() === address.toLowerCase() &&
        event.handle,
    )
    .map((event) => ({
      id: event.id,
      account: event.account!,
      handle: event.handle!,
      drawId: event.drawId === undefined ? null : Number(event.drawId),
      blockNumber: event.blockNumber,
      txHash: event.txHash,
      logIndex: event.logIndex,
      timestamp: event.timestamp,
    }));
}

async function fetchIndexedClaims(address: Address): Promise<PrizeClaim[]> {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('prize_claims')
    .select('account_address,amount_handle,draw_id,tx_hash,log_index,block_number,block_timestamp')
    .eq('chain_id', SEPOLIA_CHAIN_ID)
    .eq('vault_address', VAULT_ADDRESS.toLowerCase())
    .eq('account_address', address.toLowerCase())
    .order('block_number', { ascending: false })
    .order('log_index', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => {
    const timestamp = row.block_timestamp
      ? Math.floor(new Date(row.block_timestamp).getTime() / 1000)
      : undefined;
    return {
      id: `${row.tx_hash}-${row.log_index}`,
      account: row.account_address as Address,
      handle: row.amount_handle as Hex,
      drawId: row.draw_id === null || row.draw_id === undefined ? null : Number(row.draw_id),
      blockNumber: BigInt(row.block_number),
      txHash: row.tx_hash as Hex,
      logIndex: row.log_index as number,
      timestamp,
    };
  });
}
