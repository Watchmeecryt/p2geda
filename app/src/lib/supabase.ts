import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

/**
 * When Supabase is not configured the app falls back to scanning logs over RPC, so a
 * fresh clone still works end-to-end before anyone provisions a project.
 *
 * A malformed URL takes the same path rather than throwing: `createClient` throws
 * synchronously at module load, which would white-screen the entire app over a
 * mistyped environment variable.
 */
function createSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  try {
    return createClient(url, anonKey, { auth: { persistSession: false } });
  } catch (error) {
    console.error(
      `[supabase] VITE_SUPABASE_URL is not a valid URL ("${url}"). Falling back to RPC log scanning.`,
      error,
    );
    return null;
  }
}

export const supabase: SupabaseClient | null = createSupabase();

export const supabaseConfigured = supabase !== null;

/** Row shape written by the indexer; mirrors supabase/migrations/001_vault_events.sql. */
export type VaultEventRow = {
  event_type: string;
  account_address: string | null;
  amount_handle: string | null;
  draw_id: number | string | null;
  tx_hash: string;
  log_index: number;
  block_number: number | string;
  block_timestamp: string | null;
};

/** Row shape for History "Draws won"; mirrors supabase/migrations/002_prize_claims.sql. */
export type PrizeClaimRow = {
  account_address: string;
  amount_handle: string;
  draw_id: number | string | null;
  tx_hash: string;
  log_index: number;
  block_number: number | string;
  block_timestamp: string | null;
};
