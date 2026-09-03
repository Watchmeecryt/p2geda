import dns from 'node:dns';
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

dns.setServers(['8.8.8.8', '1.1.1.1']);

const root = dirname(fileURLToPath(import.meta.url));
const envPath = join(root, '..', '.env');
const envText = readFileSync(envPath, 'utf8');
const env = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}

const url = env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY');

const db = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  const probe = {
    chain_id: 11155111,
    vault_address: '0x335339161e31fd94ff5a5d0595ec7526afe9373f',
    event_type: 'reveal_draw',
    account_address: null,
    amount_handle: null,
    draw_id: null,
    tx_hash: `0x${'ab'.repeat(32)}`,
    log_index: 987654321,
    block_number: 1,
    block_timestamp: null,
  };

  const { error } = await db.from('vault_events').upsert(probe, {
    onConflict: 'chain_id,tx_hash,log_index',
  });

  if (error) {
    console.log('CONSTRAINT_NEEDS_MIGRATION');
    console.log(error.message);
    process.exitCode = 2;
    return;
  }

  await db
    .from('vault_events')
    .delete()
    .eq('tx_hash', probe.tx_hash)
    .eq('log_index', probe.log_index);

  console.log('V5_EVENT_TYPES_OK');
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
