import { createPublicClient, http, type PublicClient } from 'viem';
import type { SupabaseClient } from '@supabase/supabase-js';
import { sepolia } from 'viem/chains';
import { loadConfig, type Config } from './env.js';
import {
  createDb,
  derivePrizeClaims,
  readCursor,
  readLatestDrawIdBefore,
  upsertEvents,
  upsertPrizeClaims,
  writeCursor,
} from './db.js';
import { scanRange } from './scan.js';

const ONCE = process.argv.includes('--once');
const FROM_DEPLOYMENT = process.argv.includes('--from-deployment');

async function main() {
  const config = loadConfig();
  const db = createDb(config);
  const client: PublicClient = createPublicClient({
    chain: sepolia,
    transport: http(config.rpcUrl),
  });

  log(
    `indexing vault ${config.vaultAddress} on chain ${config.chainId} ` +
      `(chunk ${config.logChunk}, ${config.confirmations} confirmations` +
      `${FROM_DEPLOYMENT ? ', backfill from deployment' : ', live at chain tip'})`,
  );

  if (ONCE) {
    await runOnce(config, db, client);
    return;
  }

  // Keep polling. A failed pass is logged and retried on the next tick rather than
  // crashing the process, so a flaky RPC does not need a container restart.
  for (;;) {
    try {
      await runOnce(config, db, client);
    } catch (error) {
      log(`pass failed: ${describe(error)}`);
    }
    await sleep(config.pollIntervalMs);
  }
}

/**
 * Endpoints refuse an eth_getLogs span for two different reasons and report both as a
 * generic invalid-params error: a plan's block-range cap (Alchemy free allows 10), or a
 * missing archive window (keyless endpoints serve only the last ~100 blocks). Name which
 * one it is rather than making the reader decode the provider's wording.
 */
function describe(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/archive/i.test(message)) {
    return (
      `${message}\n\n` +
      `[hint] The endpoint has no archive window — it only serves logs for roughly the ` +
      `last 100 blocks, so it cannot reach DEPLOYMENT_BLOCK. This is the endpoint, not a ` +
      `bug in the indexer. Point RPC_URL at a provider key (an Alchemy free plan works).`
    );
  }
  if (/exceed|limited to|too many blocks|block range/i.test(message)) {
    return (
      `${message}\n\n` +
      `[hint] The endpoint capped the eth_getLogs span. Lower LOG_CHUNK in .env to the ` +
      `limit named above (Alchemy's free tier allows 10).`
    );
  }
  return message;
}

async function runOnce(config: Config, db: SupabaseClient, client: PublicClient) {
  const tip = await client.getBlockNumber();
  const safeTip = tip > config.confirmations ? tip - config.confirmations : 0n;

  const storedCursor = await readCursor(db, config);
  const fromBlock = resolveFromBlock(config, storedCursor, safeTip, FROM_DEPLOYMENT);

  if (fromBlock > safeTip) {
    log(`live at block ${safeTip} (chain tip ${tip}, ${config.confirmations} confirmations)`);
    return;
  }

  const gap = safeTip - fromBlock + 1n;
  if (gap > 50n && !FROM_DEPLOYMENT) {
    log(`catching up ${gap} block(s) from ${fromBlock} → ${safeTip}…`);
  }

  const startingDrawId = await readLatestDrawIdBefore(db, config, fromBlock);
  const rows = await scanRange(client, config, fromBlock, safeTip);
  const written = await upsertEvents(db, rows);
  const claims = derivePrizeClaims(rows, startingDrawId);
  const claimsWritten = await upsertPrizeClaims(db, claims);
  await writeCursor(db, config, safeTip);

  log(
    `blocks ${fromBlock}-${safeTip}: ${written} event(s) indexed` +
      (claimsWritten > 0 ? `, ${claimsWritten} prize claim(s)` : '') +
      ` · live at ${safeTip}`,
  );
}

/**
 * Live indexer starts at the current safe tip — it does not replay from deployment.
 * Use `npm run backfill` (--from-deployment) when you intentionally want full history.
 */
function resolveFromBlock(
  config: Config,
  cursor: bigint | null,
  safeTip: bigint,
  fromDeployment: boolean,
): bigint {
  if (fromDeployment) return config.deploymentBlock;
  if (cursor !== null) return cursor + 1n;
  return safeTip;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string) {
  console.log(`[confipool-indexer] ${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
  console.error('[confipool-indexer] fatal:', error);
  process.exit(1);
});
