import type { Address, Hex, PublicClient } from 'viem';
import { EVENT_TYPE_BY_NAME, VAULT_EVENT_LIST, type EventType } from './abi.js';
import type { Config } from './env.js';
import type { VaultEventRow } from './db.js';

type RawLog = {
  blockNumber: bigint;
  transactionHash: Hex;
  logIndex: number;
  eventName?: string;
  args?: Record<string, unknown>;
};

/** Every event carries exactly one handle, under a name that varies by event. */
function handleOf(args: Record<string, unknown>): string | null {
  const handle =
    args.amountHandle ??
    args.newReserveHandle ??
    args.totalPaidHandle;
  return typeof handle === 'string' ? handle : null;
}

export function chunkRanges(from: bigint, to: bigint, size: bigint) {
  const ranges: Array<{ fromBlock: bigint; toBlock: bigint }> = [];
  const step = size > 0n ? size : 1n;
  for (let start = from; start <= to; start += step) {
    const end = start + step - 1n;
    ranges.push({ fromBlock: start, toBlock: end > to ? to : end });
  }
  return ranges;
}

/**
 * Providers reject an oversized `eth_getLogs` span in wildly different ways — a range
 * cap, a result cap, or (on free public endpoints) a bogus "archive request" error.
 * They all mean the same thing to us, so match loosely.
 */
function isRangeError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /archive|exceed|too large|too many|limited to|block range|range is too|more than|query returned/i.test(
    message,
  );
}

/**
 * Fetches one span, halving it on a range rejection until the provider accepts it or
 * we are down to a single block. This lets the indexer work against a strict endpoint
 * without the operator having to guess the right LOG_CHUNK by hand.
 */
async function getLogsSplitting(
  client: PublicClient,
  config: Config,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<RawLog[]> {
  try {
    return (await client.getLogs({
      address: config.vaultAddress as Address,
      events: VAULT_EVENT_LIST,
      fromBlock,
      toBlock,
    })) as unknown as RawLog[];
  } catch (error) {
    if (fromBlock >= toBlock || !isRangeError(error)) throw error;
    const mid = fromBlock + (toBlock - fromBlock) / 2n;
    return [
      ...(await getLogsSplitting(client, config, fromBlock, mid)),
      ...(await getLogsSplitting(client, config, mid + 1n, toBlock)),
    ];
  }
}

/**
 * Reads every vault event in `[fromBlock, toBlock]` and shapes it into database rows.
 *
 * One `eth_getLogs` per chunk covers all seven events via an OR'd topic0, and chunks
 * run sequentially so a long backfill does not burst past a provider's rate limit.
 * A chunk the provider still refuses is halved and retried rather than failing the pass.
 * Block timestamps are fetched once per distinct block rather than once per log.
 */
export async function scanRange(
  client: PublicClient,
  config: Config,
  fromBlock: bigint,
  toBlock: bigint,
): Promise<VaultEventRow[]> {
  const flat: Array<{ eventType: EventType; log: RawLog }> = [];

  for (const range of chunkRanges(fromBlock, toBlock, config.logChunk)) {
    const logs = await getLogsSplitting(client, config, range.fromBlock, range.toBlock);

    for (const log of logs) {
      const eventType = log.eventName ? EVENT_TYPE_BY_NAME[log.eventName] : undefined;
      if (eventType) flat.push({ eventType, log });
    }
  }

  if (flat.length === 0) return [];

  const timestamps = await fetchBlockTimestamps(
    client,
    Array.from(new Set(flat.map((entry) => entry.log.blockNumber))),
  );

  return flat
    .map(({ eventType, log }) => toRow(config, eventType, log, timestamps))
    .sort((a, b) =>
      a.block_number === b.block_number
        ? a.log_index - b.log_index
        : a.block_number - b.block_number,
    );
}

/** viem returns uint32 as number and larger ints as bigint — accept both. */
function asDrawId(value: unknown): number | null {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
    return Number(value);
  }
  return null;
}

function toRow(
  config: Config,
  eventType: EventType,
  log: RawLog,
  timestamps: Map<bigint, number>,
): VaultEventRow {
  const args = log.args ?? {};
  const account = typeof args.account === 'string' ? args.account.toLowerCase() : null;
  const drawId = asDrawId(args.drawId);
  const timestamp = timestamps.get(log.blockNumber);

  return {
    chain_id: config.chainId,
    vault_address: config.vaultAddress.toLowerCase(),
    event_type: eventType,
    account_address: account,
    amount_handle: handleOf(args),
    draw_id: drawId,
    tx_hash: log.transactionHash.toLowerCase(),
    log_index: log.logIndex,
    block_number: Number(log.blockNumber),
    block_timestamp: timestamp ? new Date(timestamp * 1000).toISOString() : null,
  };
}

async function fetchBlockTimestamps(
  client: PublicClient,
  blocks: bigint[],
): Promise<Map<bigint, number>> {
  const entries = await Promise.all(
    blocks.map(async (blockNumber) => {
      const block = await client.getBlock({ blockNumber });
      return [blockNumber, Number(block.timestamp)] as const;
    }),
  );
  return new Map(entries);
}
