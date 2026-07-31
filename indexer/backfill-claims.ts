/**
 * One-shot: if `prize_claims` already exists, backfill any claim rows still missing
 * from `vault_events`. Prefer applying `002_prize_claims.sql` in the Supabase SQL
 * editor — that migration creates the table and runs this same backfill.
 */
import { loadConfig } from './src/env.js';
import { createDb, derivePrizeClaims, type VaultEventRow } from './src/db.js';

const config = loadConfig();
const db = createDb(config);

const { data: events, error: readError } = await db
  .from('vault_events')
  .select(
    'chain_id,vault_address,event_type,account_address,amount_handle,draw_id,tx_hash,log_index,block_number,block_timestamp',
  )
  .eq('chain_id', config.chainId)
  .eq('vault_address', config.vaultAddress.toLowerCase())
  .order('block_number', { ascending: true })
  .order('log_index', { ascending: true });

if (readError) throw new Error(readError.message);

const claims = derivePrizeClaims((events ?? []) as VaultEventRow[], 0);
if (claims.length === 0) {
  console.log('No claim events to backfill.');
  process.exit(0);
}

const { error } = await db
  .from('prize_claims')
  .upsert(claims, { onConflict: 'chain_id,tx_hash,log_index', ignoreDuplicates: true });

if (error) {
  if (/relation .*prize_claims.* does not exist|Could not find the table/i.test(error.message)) {
    console.error(
      'prize_claims does not exist yet.\n' +
        'Open the Supabase SQL editor and run:\n' +
        '  put-together/supabase/migrations/002_prize_claims.sql\n' +
        'Then re-run: npx tsx backfill-claims.ts',
    );
    process.exit(1);
  }
  throw new Error(error.message);
}

console.log(`Upserted ${claims.length} prize claim(s).`);
for (const claim of claims) {
  console.log(
    `  draw #${claim.draw_id ?? '?'}  ${claim.account_address}  block ${claim.block_number}`,
  );
}
