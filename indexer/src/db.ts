import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './env.js';
import type { EventType } from './abi.js';

export type VaultEventRow = {
  chain_id: number;
  vault_address: string;
  event_type: EventType;
  account_address: string | null;
  amount_handle: string | null;
  draw_id: number | null;
  tx_hash: string;
  log_index: number;
  block_number: number;
  block_timestamp: string | null;
};

export type PrizeClaimRow = {
  chain_id: number;
  vault_address: string;
  account_address: string;
  amount_handle: string;
  draw_id: number | null;
  tx_hash: string;
  log_index: number;
  block_number: number;
  block_timestamp: string | null;
};

export function createDb(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resume point for this (chain, vault). A missing row means live mode: the caller
 * starts at the current safe tip. Use `--from-deployment` / `npm run backfill` for history.
 */
export async function readCursor(
  db: SupabaseClient,
  config: Config,
): Promise<bigint | null> {
  const { data, error } = await db
    .from('indexer_state')
    .select('last_indexed_block')
    .eq('chain_id', config.chainId)
    .eq('vault_address', config.vaultAddress.toLowerCase())
    .maybeSingle();

  if (error) throw new Error(`Failed to read indexer cursor: ${error.message}`);
  if (!data) return null;
  return BigInt(data.last_indexed_block as number | string);
}

export async function writeCursor(
  db: SupabaseClient,
  config: Config,
  block: bigint,
): Promise<void> {
  const { error } = await db.from('indexer_state').upsert(
    {
      chain_id: config.chainId,
      vault_address: config.vaultAddress.toLowerCase(),
      last_indexed_block: Number(block),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'chain_id,vault_address' },
  );

  if (error) throw new Error(`Failed to write indexer cursor: ${error.message}`);
}

/**
 * Idempotent by (chain_id, tx_hash, log_index), so re-scanning a range — which the
 * confirmation lag makes routine — costs nothing and silently repairs a shallow reorg.
 */
export async function upsertEvents(
  db: SupabaseClient,
  rows: VaultEventRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  // Update on conflict so a backfill can repair rows that were written with null
  // draw_id / handles (e.g. when uint32 args were decoded as number, not bigint).
  const { error } = await db
    .from('vault_events')
    .upsert(rows, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: false });

  if (error) throw new Error(`Failed to upsert ${rows.length} event(s): ${error.message}`);
  return rows.length;
}

/**
 * Highest draw_id completed strictly before `beforeBlock`. Used so a claim indexed
 * alone in a later poll still inherits the correct draw label.
 */
export async function readLatestDrawIdBefore(
  db: SupabaseClient,
  config: Config,
  beforeBlock: bigint,
): Promise<number> {
  const { data, error } = await db
    .from('vault_events')
    .select('draw_id')
    .eq('chain_id', config.chainId)
    .eq('vault_address', config.vaultAddress.toLowerCase())
    .eq('event_type', 'draw')
    .lt('block_number', Number(beforeBlock))
    .not('draw_id', 'is', null)
    .order('draw_id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`Failed to read latest draw id: ${error.message}`);
  return data?.draw_id == null ? 0 : Number(data.draw_id);
}

/**
 * Walks a chronologically sorted event batch and emits one prize_claims row per
 * PrizeClaimed, stamped with the most recent draw seen so far.
 */
export function derivePrizeClaims(
  rows: VaultEventRow[],
  startingDrawId: number,
): PrizeClaimRow[] {
  let drawId = startingDrawId;
  const claims: PrizeClaimRow[] = [];

  for (const row of rows) {
    if (row.event_type === 'draw' && row.draw_id != null) {
      drawId = Number(row.draw_id);
    }
    if (row.event_type === 'claim' && row.account_address && row.amount_handle) {
      claims.push({
        chain_id: row.chain_id,
        vault_address: row.vault_address,
        account_address: row.account_address.toLowerCase(),
        amount_handle: row.amount_handle,
        draw_id: drawId > 0 ? drawId : null,
        tx_hash: row.tx_hash,
        log_index: row.log_index,
        block_number: row.block_number,
        block_timestamp: row.block_timestamp,
      });
    }
  }

  return claims;
}

export async function upsertPrizeClaims(
  db: SupabaseClient,
  rows: PrizeClaimRow[],
): Promise<number> {
  if (rows.length === 0) return 0;

  const { error } = await db
    .from('prize_claims')
    .upsert(rows, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: true });

  if (error) throw new Error(`Failed to upsert ${rows.length} prize claim(s): ${error.message}`);
  return rows.length;
}
