import 'dotenv/config';
import { getAddress, type Address } from 'viem';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

function numeric(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`Environment variable ${name} must be a non-negative number, got "${raw}"`);
  }
  return parsed;
}

export type Config = {
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  chainId: number;
  rpcUrl: string;
  vaultAddress: Address;
  deploymentBlock: bigint;
  logChunk: bigint;
  pollIntervalMs: number;
  confirmations: bigint;
};

export type KeeperConfig = {
  chainId: number;
  rpcUrl: string;
  vaultAddress: Address;
  ownerPrivateKey: `0x${string}`;
  pollIntervalMs: number;
};

export function loadConfig(): Config {
  return {
    supabaseUrl: required('SUPABASE_URL'),
    supabaseServiceRoleKey: required('SUPABASE_SERVICE_ROLE_KEY'),
    chainId: numeric('CHAIN_ID', 11155111),
    rpcUrl: required('RPC_URL'),
    vaultAddress: getAddress(required('VAULT_ADDRESS')),
    deploymentBlock: BigInt(numeric('DEPLOYMENT_BLOCK', 0)),
    // Small by default: strict endpoints refuse anything wider. A chunk the provider
    // still rejects is halved automatically, so this is a starting point, not a cap.
    logChunk: BigInt(numeric('LOG_CHUNK', 10)),
    pollIntervalMs: numeric('POLL_INTERVAL_MS', 15_000),
    confirmations: BigInt(numeric('CONFIRMATIONS', 3)),
  };
}

/**
 * Draw keeper only needs an RPC and the vault owner key. It does not touch Supabase.
 * Reveal uses Node FHE publicDecrypt; openDraw / accrueMany / harvest are plain txs.
 */
export function loadKeeperConfig(): KeeperConfig {
  const key = required('OWNER_PRIVATE_KEY');
  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error('OWNER_PRIVATE_KEY must be a 0x-prefixed 32-byte hex private key');
  }

  return {
    chainId: numeric('CHAIN_ID', 11155111),
    rpcUrl: required('RPC_URL'),
    vaultAddress: getAddress(required('VAULT_ADDRESS')),
    ownerPrivateKey: key as `0x${string}`,
    pollIntervalMs: numeric('KEEPER_POLL_INTERVAL_MS', 30_000),
  };
}
