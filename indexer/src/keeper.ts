import type { ZamaSDK } from '@zama-fhe/sdk';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { loadKeeperConfig, type KeeperConfig } from './env.js';
import { getSdk, publicDecryptHandles } from './relayer.js';

/**
 * ConfiPool V5 keeper — Node FHE + owner wallet.
 *
 * Each tick:
 *   1. harvest() — fold ConfidentialVaultSource pot into encrypted reserve (may be 0 on Sepolia).
 *   2. openDraw() when minPeriod elapsed and previous draw resolved.
 *   3. revealDraw() — publicDecrypt encR + encTotalWeight, submit cleartexts + proof.
 *   4. accrueMany() — batch depositors for the latest revealed draw.
 *
 * Sepolia demos: admin fundReserve from the UI so prizes pay even when Morpho staging is idle.
 * Same OWNER_PRIVATE_KEY as vault.owner().
 */

const VAULT_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'nextOpenableAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint40' }],
  },
  {
    type: 'function',
    name: 'drawCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'depositorCount',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'depositorAt',
    stateMutability: 'view',
    inputs: [{ name: 'index', type: 'uint256' }],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'MAX_ACCRUE_BATCH',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'tiersConfigured',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'yieldSource',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'drawAt',
    stateMutability: 'view',
    inputs: [{ name: 'drawId', type: 'uint32' }],
    outputs: [
      { name: 'periodStart', type: 'uint40' },
      { name: 'snapshotAt', type: 'uint40' },
      { name: 'status', type: 'uint8' },
      { name: 'encR', type: 'bytes32' },
      { name: 'encTotalWeight', type: 'bytes32' },
      { name: 'r', type: 'uint64' },
      { name: 'totalWeight', type: 'uint128' },
    ],
  },
  {
    type: 'function',
    name: 'accrued',
    stateMutability: 'view',
    inputs: [
      { name: 'drawId', type: 'uint32' },
      { name: 'account', type: 'address' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'openDraw',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'revealDraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'drawId', type: 'uint32' },
      { name: 'cleartexts', type: 'bytes' },
      { name: 'decryptionProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'accrueMany',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'users', type: 'address[]' },
      { name: 'drawId', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'harvest',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
] as const;

const DRAW_OPEN = 1;
const DRAW_REVEALED = 2;
const ZERO = '0x0000000000000000000000000000000000000000000000000000000000000000' as const;
const ONCE = process.argv.includes('--once');

type Wallet = ReturnType<typeof createWalletClient>;

async function main() {
  const config = loadKeeperConfig();
  const account = privateKeyToAccount(config.ownerPrivateKey);
  const transport = http(config.rpcUrl);
  const publicClient: PublicClient = createPublicClient({
    chain: sepolia,
    transport,
  });
  const walletClient = createWalletClient({
    account,
    chain: sepolia,
    transport,
  });

  const onchainOwner = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'owner',
  })) as `0x${string}`;

  if (onchainOwner.toLowerCase() !== account.address.toLowerCase()) {
    throw new Error(
      `OWNER_PRIVATE_KEY is ${account.address}, but vault owner is ${onchainOwner}`,
    );
  }

  const sdk = await getSdk({ rpcUrl: config.rpcUrl, account });

  log(
    `keeper ready for vault ${config.vaultAddress} as ${account.address}` +
      ` · poll every ${config.pollIntervalMs}ms`,
  );
  log('legs each tick: harvest → openDraw → revealDraw → accrueMany');

  if (ONCE) {
    await tick(config, publicClient, walletClient, sdk);
    return;
  }

  for (;;) {
    try {
      await tick(config, publicClient, walletClient, sdk);
    } catch (error) {
      log(`tick failed: ${describe(error)}`);
    }
    await sleep(config.pollIntervalMs);
  }
}

async function tick(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  sdk: ZamaSDK,
) {
  await maybeHarvest(config, publicClient, walletClient);
  await maybeOpenDraw(config, publicClient, walletClient);
  await maybeReveal(config, publicClient, walletClient, sdk);
  await maybeAccrue(config, publicClient, walletClient);
}

async function maybeHarvest(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
) {
  const source = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'yieldSource',
  })) as `0x${string}`;

  if (!source || source === ZERO) {
    log('harvest: skip — no yieldSource (admin fundReserve is the demo path)');
    return;
  }

  try {
    await publicClient.simulateContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'harvest',
      account: walletClient.account!.address,
    });
  } catch (error) {
    log(`harvest: skip — ${describe(error)}`);
    return;
  }

  const hash = await walletClient.writeContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'harvest',
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log(`harvest: submitted ${hash}`);
}

async function maybeOpenDraw(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
) {
  const vault = { address: config.vaultAddress, abi: VAULT_ABI } as const;
  const [nextOpenableAt, drawCount, depositorCount, tiersConfigured] = await Promise.all([
    publicClient.readContract({ ...vault, functionName: 'nextOpenableAt' }),
    publicClient.readContract({ ...vault, functionName: 'drawCount' }),
    publicClient.readContract({ ...vault, functionName: 'depositorCount' }),
    publicClient.readContract({ ...vault, functionName: 'tiersConfigured' }),
  ]);

  if (!tiersConfigured) {
    log('openDraw: skip — tiers not configured');
    return;
  }
  if (depositorCount === 0n) {
    log('openDraw: skip — no depositors');
    return;
  }

  const count = Number(drawCount);
  if (count > 0) {
    const draw = (await publicClient.readContract({
      ...vault,
      functionName: 'drawAt',
      args: [count],
    })) as unknown as readonly [number, number, number, Hex, Hex, bigint, bigint];
    if (Number(draw[2]) === DRAW_OPEN) {
      log(`openDraw: skip — draw #${count} still open (awaiting reveal)`);
      return;
    }
  }

  const now = BigInt(Math.floor(Date.now() / 1000));
  const openable = BigInt(nextOpenableAt);
  if (now < openable) {
    log(`openDraw: skip — next in ${Number(openable - now)}s`);
    return;
  }

  try {
    const hash = await walletClient.writeContract({
      ...vault,
      functionName: 'openDraw',
      account: walletClient.account!,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash });
    const newCount = await publicClient.readContract({ ...vault, functionName: 'drawCount' });
    log(`openDraw: #${newCount} confirmed (${hash})`);
  } catch (error) {
    if (isSoftSkip(error)) {
      log(`openDraw: soft skip — ${describe(error)}`);
      return;
    }
    throw error;
  }
}

async function maybeReveal(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  sdk: ZamaSDK,
) {
  const vault = { address: config.vaultAddress, abi: VAULT_ABI } as const;
  const drawCount = Number(
    await publicClient.readContract({ ...vault, functionName: 'drawCount' }),
  );
  if (drawCount === 0) {
    log('reveal: skip — no draws');
    return;
  }

  const draw = (await publicClient.readContract({
    ...vault,
    functionName: 'drawAt',
    args: [drawCount],
  })) as unknown as readonly [number, number, number, Hex, Hex, bigint, bigint];

  if (Number(draw[2]) !== DRAW_OPEN) {
    log(`reveal: skip — draw #${drawCount} status=${draw[2]}`);
    return;
  }

  const encR = draw[3];
  const encTotal = draw[4];
  if (!encR || !encTotal || encR === ZERO || encTotal === ZERO) {
    log('reveal: skip — missing encrypted handles');
    return;
  }

  log(`reveal: publicDecrypt R + totalWeight for draw #${drawCount}…`);
  const decrypted = await publicDecryptHandles(sdk, [encR, encTotal]);
  log(
    `reveal: clear R=${decrypted.values[0]} totalWeight=${decrypted.values[1]} — submitting…`,
  );

  const hash = await walletClient.writeContract({
    ...vault,
    functionName: 'revealDraw',
    args: [drawCount, decrypted.cleartexts, decrypted.decryptionProof],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log(`reveal: draw #${drawCount} revealed (${hash})`);
}

async function maybeAccrue(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
) {
  const vault = { address: config.vaultAddress, abi: VAULT_ABI } as const;
  const drawCount = Number(
    await publicClient.readContract({ ...vault, functionName: 'drawCount' }),
  );
  if (drawCount === 0) {
    log('accrue: skip — no draws');
    return;
  }

  const draw = (await publicClient.readContract({
    ...vault,
    functionName: 'drawAt',
    args: [drawCount],
  })) as unknown as readonly [number, number, number, Hex, Hex, bigint, bigint];

  if (Number(draw[2]) !== DRAW_REVEALED) {
    log(`accrue: skip — draw #${drawCount} not revealed`);
    return;
  }

  const [depositorCount, batchSize] = await Promise.all([
    publicClient.readContract({ ...vault, functionName: 'depositorCount' }),
    publicClient.readContract({ ...vault, functionName: 'MAX_ACCRUE_BATCH' }),
  ]);

  const maxBatch = Number(batchSize);
  const pending: `0x${string}`[] = [];

  for (let i = 0; i < Number(depositorCount); i++) {
    const user = (await publicClient.readContract({
      ...vault,
      functionName: 'depositorAt',
      args: [BigInt(i)],
    })) as `0x${string}`;
    const done = (await publicClient.readContract({
      ...vault,
      functionName: 'accrued',
      args: [drawCount, user],
    })) as boolean;
    if (!done) pending.push(user);
    if (pending.length >= maxBatch) break;
  }

  if (pending.length === 0) {
    log(`accrue: draw #${drawCount} fully accrued`);
    return;
  }

  log(`accrue: batch ${pending.length} of draw #${drawCount}…`);
  const hash = await walletClient.writeContract({
    ...vault,
    functionName: 'accrueMany',
    args: [pending, drawCount],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });
  log(`accrue: confirmed ${hash}`);
}

function isSoftSkip(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /TooSoon|NothingStaked|PreviousDrawUnresolved|PrizeTiersNotSet|DrawNotOpen|DrawNotRevealed/i.test(
    message,
  );
}

function describe(error: unknown): string {
  if (error instanceof Error) {
    return error.message.split('\n')[0] ?? error.message;
  }
  return String(error);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function log(message: string) {
  console.log(`[confipool-keeper] ${new Date().toISOString()} ${message}`);
}

main().catch((error) => {
  console.error('[confipool-keeper] fatal:', error);
  process.exit(1);
});
