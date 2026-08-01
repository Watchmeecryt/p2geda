import type { ZamaSDK } from '@zama-fhe/sdk';
import {
  createPublicClient,
  createWalletClient,
  decodeEventLog,
  encodeAbiParameters,
  http,
  keccak256,
  parseAbi,
  toBytes,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { sepolia } from 'viem/chains';
import { loadKeeperConfig, type KeeperConfig } from './env.js';
import {
  encryptEuint64,
  getSdk,
  publicDecryptHandle,
} from './relayer.js';

/**
 * ConfiPool keeper — Node FHE (`node()` RelayerNode pool) + owner wallet.
 *
 * YIELD LEG (requires Node encrypt / publicDecrypt)
 *   1. Accrue fake APR into MockYield4626 (clear ERC-4626 — share price is public).
 *   2. If nothing allocated yet: public-decrypt aggregate principal → encrypt unwrap
 *      amount → requestAllocate → publicDecrypt burnt handle → finalizeAllocate.
 *   3. harvestClear() → clear surplus to owner (leaked on purpose).
 *   4. Encrypt **100%** of harvested yield into `_prizeReserve`, then setPrizePerDraw to
 *      only `prizeShareBps` (default 80%). The leftover ~20% stays encrypted in the reserve
 *      as padding so clear harvest size ≠ prize-per-draw ≠ winner claim.
 *
 * DRAW LEG
 *   draw() when interval due — no FHE inputs.
 *
 * Same OWNER_PRIVATE_KEY as vault.owner(). Mainnet: swap sepolia → mainnet + API key
 * in relayer.ts; point VAULT_ADDRESS / yield at Morpho.
 */

const RESERVE_DEPOSIT_TAG = keccak256(toBytes('CONFIPOOL_PRIZE_RESERVE'));

/** USDC Mock 6 decimals → cUSDCMock 6 decimals (rate = 1). */
const WRAP_RATE = 1n;

const VAULT_ABI = parseAbi([
  'function nextDrawAt() view returns (uint256)',
  'function prizePerDrawConfigured() view returns (bool)',
  'function prizeReserveFunded() view returns (bool)',
  'function depositorCount() view returns (uint256)',
  'function drawsCompleted() view returns (uint256)',
  'function owner() view returns (address)',
  'function yieldVault() view returns (address)',
  'function allocatedUnderlying() view returns (uint256)',
  'function prizeShareBps() view returns (uint16)',
  'function confidentialToken() view returns (address)',
  'function underlyingToken() view returns (address)',
  'function confidentialTotalPrincipal() view returns (bytes32)',
  'function confidentialPrizeReserve() view returns (bytes32)',
  'function lastTotalPrincipalRevealHandle() view returns (bytes32)',
  'function lastPrizeReserveRevealHandle() view returns (bytes32)',
  'function pendingAllocateUnwrapId() view returns (bytes32)',
  'function depositWindowClosesAt() view returns (uint256)',
  'function depositWindowOpensAt() view returns (uint256)',
  'function depositsOpen() view returns (bool)',
  'function RESERVE_DEPOSIT_TAG() view returns (bytes32)',
  'function draw()',
  'function harvestClear() returns (uint256)',
  'function requestTotalPrincipalReveal() returns (bytes32)',
  'function requestPrizeReserveReveal() returns (bytes32)',
  'function requestAllocate(bytes32 encryptedAmount, bytes inputProof) returns (bytes32)',
  'function finalizeAllocate(uint64 unwrapAmountCleartext, bytes decryptionProof) returns (uint256)',
  'function setPrizePerDraw(bytes32 encryptedAmount, bytes inputProof)',
  'event AllocateRequested(bytes32 indexed unwrapRequestId)',
  'event TotalPrincipalRevealRequested(bytes32 indexed handle)',
  'event PrizeReserveRevealRequested(bytes32 indexed handle)',
]);

const YIELD_ABI = parseAbi([
  'function accrue(uint256 amount)',
  'function totalAssets() view returns (uint256)',
  'function asset() view returns (address)',
  'function aprBps() view returns (uint16)',
  'function lastAccrualAt() view returns (uint256)',
  'function deposit(uint256 assets, address receiver) returns (uint256)',
]);

const ERC20_ABI = parseAbi([
  'function mint(address to, uint256 amount)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function balanceOf(address account) view returns (uint256)',
]);

const ERC7984_ABI = parseAbi([
  'function wrap(address to, uint256 amount) returns (bytes32)',
  'function rate() view returns (uint256)',
  'function confidentialTransferAndCall(address to, bytes32 encryptedAmount, bytes inputProof, bytes data) returns (bytes32)',
  'event UnwrapRequested(address indexed receiver, uint256 indexed expiryTimeStamp, bytes32 amount)',
]);

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

  const yieldVault = await readYieldVault(publicClient, config);
  const sdk = await getSdk({ rpcUrl: config.rpcUrl, account });

  log(
    `keeper ready for vault ${config.vaultAddress} as ${account.address}` +
      (yieldVault ? ` · yield ${yieldVault}` : ' · yield not set') +
      ` · ZamaSDK node() RelayerNode (poll every ${config.pollIntervalMs}ms)`,
  );
  log(
    'legs each tick: (1) allocate after deposit window closes  (2) accrue  (3) harvest→encrypt 100% reserve  (4) before draw set prize=prizeShareBps of reserve  (5) draw when due',
  );

  if (ONCE) {
    await tick(config, publicClient, walletClient, yieldVault, sdk);
    return;
  }

  for (;;) {
    try {
      await tick(config, publicClient, walletClient, yieldVault, sdk);
    } catch (error) {
      log(`tick failed: ${describe(error)}`);
    }
    await sleep(config.pollIntervalMs);
  }
}

async function readYieldVault(
  publicClient: PublicClient,
  config: KeeperConfig,
): Promise<`0x${string}` | null> {
  try {
    const addr = (await publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'yieldVault',
    })) as `0x${string}`;
    if (!addr || addr === ZERO) return null;
    return addr;
  } catch {
    return null;
  }
}

async function tick(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  yieldVault: `0x${string}` | null,
  sdk: ZamaSDK,
) {
  if (yieldVault) {
    await maybeAllocateWithRelayer(config, publicClient, walletClient, sdk);
    await maybeAccrue(config, publicClient, walletClient, yieldVault);
    await maybeHarvestAndEncryptReserve(
      config,
      publicClient,
      walletClient,
      yieldVault,
      sdk,
    );
  } else {
    log('yield: skip (no yieldVault — run deploy:yield:sepolia)');
  }

  await maybeDraw(config, publicClient, walletClient, sdk);
}

/**
 * Custody-correct allocate: after the deposit window closes, decrypt aggregate TVL,
 * unwrap only the idle delta not already in MockYield, and finalize.
 */
async function maybeAllocateWithRelayer(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  sdk: ZamaSDK,
) {
  const [windowClosesAt, depositsStillOpen] = (await Promise.all([
    publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'depositWindowClosesAt',
    }),
    publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'depositsOpen',
    }),
  ])) as [bigint, boolean];

  if (windowClosesAt === 0n) {
    log('yield.allocate: skip — no deposit batch open yet (waiting for first deposit)');
    return;
  }
  if (depositsStillOpen) {
    const remaining = Number(windowClosesAt) - Math.floor(Date.now() / 1000);
    log(
      `yield.allocate: skip — deposit window still open (${remaining > 0 ? `${remaining}s left` : 'closing…'})`,
    );
    return;
  }

  const allocated = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'allocatedUnderlying',
  })) as bigint;

  const cToken = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'confidentialToken',
  })) as `0x${string}`;

  // After withdraw, `_totalPrincipal` is a *new* ciphertext handle (often 0) while
  // `lastTotalPrincipalRevealHandle` can still point at the pre-withdraw value.
  const [currentPrincipalHandle, lastRevealHandle] = (await Promise.all([
    publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'confidentialTotalPrincipal',
    }),
    publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'lastTotalPrincipalRevealHandle',
    }),
  ])) as [Hex, Hex];

  let principalHandle: Hex = lastRevealHandle;
  if (
    !currentPrincipalHandle ||
    currentPrincipalHandle === ZERO ||
    currentPrincipalHandle.toLowerCase() !== (lastRevealHandle ?? ZERO).toLowerCase()
  ) {
    log(
      `yield.allocate: principal handle changed (${lastRevealHandle} → ${currentPrincipalHandle}); requesting reveal…`,
    );
    try {
      const hash = await walletClient.writeContract({
        address: config.vaultAddress,
        abi: VAULT_ABI,
        functionName: 'requestTotalPrincipalReveal',
        account: walletClient.account!,
        chain: sepolia,
      });
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      principalHandle =
        parsePrincipalRevealHandle(receipt) ??
        ((await publicClient.readContract({
          address: config.vaultAddress,
          abi: VAULT_ABI,
          functionName: 'lastTotalPrincipalRevealHandle',
        })) as Hex);
      log(`yield.allocate: reveal submitted ${hash}`);
    } catch (error) {
      if (!/RevealAlreadyRequested/i.test(describe(error))) throw error;
      principalHandle = (await publicClient.readContract({
        address: config.vaultAddress,
        abi: VAULT_ABI,
        functionName: 'lastTotalPrincipalRevealHandle',
      })) as Hex;
      log('yield.allocate: current principal already publicly decryptable');
    }
  } else {
    log('yield.allocate: reusing current principal reveal handle');
  }

  if (!principalHandle || principalHandle === ZERO) {
    log('yield.allocate: skip — no principal reveal handle');
    return;
  }

  log(`yield.allocate: publicDecrypt ${principalHandle}…`);
  const decrypted = await publicDecryptHandle(sdk, principalHandle);
  const principalConf = decrypted.cleartext;
  if (principalConf === 0n) {
    log('yield.allocate: skip — aggregate principal is 0 (nothing to park in MockYield)');
    return;
  }

  const alreadyAllocatedConf = allocated / WRAP_RATE;
  if (principalConf <= alreadyAllocatedConf) {
    log(
      `yield.allocate: skip — principal ${principalConf} already covered by allocatedUnderlying ${allocated}`,
    );
    return;
  }
  const idleConf = principalConf - alreadyAllocatedConf;
  log(
    `yield.allocate: batch closed — park idle ${idleConf} confidential units (principal ${principalConf}, already allocated ${alreadyAllocatedConf})`,
  );

  const encrypted = await encryptEuint64(sdk, {
    amount: idleConf,
    contractAddress: cToken,
    userAddress: config.vaultAddress,
  });

  log('yield.allocate: requestAllocate (unwrap)…');
  const reqHash = await walletClient.writeContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'requestAllocate',
    args: [encrypted.handle, encrypted.inputProof],
    account: walletClient.account!,
    chain: sepolia,
  });
  const reqReceipt = await publicClient.waitForTransactionReceipt({ hash: reqHash });
  const burntHandle =
    parseUnwrapBurntHandle(reqReceipt, cToken) ??
    ((await publicClient.readContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'pendingAllocateUnwrapId',
    })) as Hex);

  log(`yield.allocate: publicDecrypt burnt handle ${burntHandle}…`);
  const burnt = await publicDecryptHandle(sdk, burntHandle);
  const clearU64 =
    burnt.cleartext <= 0xffff_ffff_ffff_ffffn ? burnt.cleartext : 0n;

  const finHash = await walletClient.writeContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'finalizeAllocate',
    args: [clearU64, burnt.decryptionProof],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: finHash });

  const newAllocated = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'allocatedUnderlying',
  })) as bigint;
  if (newAllocated === allocated) {
    log(
      `yield.allocate: warn — allocatedUnderlying unchanged at ${newAllocated} after finalize (${finHash})`,
    );
    return;
  }
  log(`yield.allocate: done — allocatedUnderlying=${newAllocated} (${finHash})`);
}

async function maybeHarvestAndEncryptReserve(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  _yieldVault: `0x${string}`,
  sdk: ZamaSDK,
) {
  const owner = walletClient.account!.address;

  try {
    await publicClient.simulateContract({
      address: config.vaultAddress,
      abi: VAULT_ABI,
      functionName: 'harvestClear',
      account: owner,
    });
  } catch (error) {
    log(`yield.harvest: skip — ${describe(error)}`);
    return;
  }

  const before = (await publicClient.readContract({
    address: await readUnderlying(publicClient, config),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint;

  const hash = await walletClient.writeContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'harvestClear',
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash });

  const after = (await publicClient.readContract({
    address: await readUnderlying(publicClient, config),
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [owner],
  })) as bigint;

  const harvested = after > before ? after - before : 0n;
  if (harvested === 0n) {
    log('yield.harvest: clear amount 0 after harvestClear');
    return;
  }
  log(`yield.harvest: clear surplus ${harvested} underlying (${hash}) — this size is public`);

  // Align full harvest to confidential units (floor dust stays with owner).
  const reserveConf = harvested / WRAP_RATE;
  if (reserveConf === 0n) {
    log('yield.harvest: harvested below one confidential unit');
    return;
  }
  const wrapAmount = reserveConf * WRAP_RATE;

  log(
    `yield.harvest: encrypt 100% reserve=${reserveConf} conf units (prize-per-draw sized at draw time from full pot)`,
  );

  const cToken = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'confidentialToken',
  })) as `0x${string}`;
  const underlying = await readUnderlying(publicClient, config);

  const approveWrap = await walletClient.writeContract({
    address: underlying,
    abi: ERC20_ABI,
    functionName: 'approve',
    args: [cToken, wrapAmount],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveWrap });

  const wrapHash = await walletClient.writeContract({
    address: cToken,
    abi: ERC7984_ABI,
    functionName: 'wrap',
    args: [owner, wrapAmount],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: wrapHash });
  log(`yield.harvest: wrapped ${wrapAmount} → cToken (${wrapHash})`);

  // Encrypt 100% of harvest into the prize reserve. Do NOT overwrite prize-per-draw here —
  // that is sized from the full reserve immediately before draw().
  const encReserve = await encryptEuint64(sdk, {
    amount: reserveConf,
    contractAddress: cToken,
    userAddress: owner,
  });
  const fundHash = await walletClient.writeContract({
    address: cToken,
    abi: ERC7984_ABI,
    functionName: 'confidentialTransferAndCall',
    args: [
      config.vaultAddress,
      encReserve.handle,
      encReserve.inputProof,
      encodeAbiParameters([{ type: 'bytes32' }], [RESERVE_DEPOSIT_TAG]),
    ],
    account: walletClient.account!,
    chain: sepolia,
  });
  await publicClient.waitForTransactionReceipt({ hash: fundHash });
  log(`yield.harvest: encrypted reserve funded 100% of harvest (${fundHash})`);
}

async function readUnderlying(
  publicClient: PublicClient,
  config: KeeperConfig,
): Promise<`0x${string}`> {
  return (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'underlyingToken',
  })) as `0x${string}`;
}

async function maybeDraw(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  sdk: ZamaSDK,
) {
  const vault = { address: config.vaultAddress, abi: VAULT_ABI } as const;
  const owner = walletClient.account!.address;

  const [nextDrawAt, reserveFunded, depositorCount, drawsCompleted, prizeShareBps] =
    await Promise.all([
      publicClient.readContract({ ...vault, functionName: 'nextDrawAt' }),
      publicClient.readContract({ ...vault, functionName: 'prizeReserveFunded' }),
      publicClient.readContract({ ...vault, functionName: 'depositorCount' }),
      publicClient.readContract({ ...vault, functionName: 'drawsCompleted' }),
      publicClient.readContract({ ...vault, functionName: 'prizeShareBps' }),
    ]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  if (!reserveFunded) {
    log('draw: skip — prize reserve not funded');
    return;
  }
  if (depositorCount === 0n) {
    log('draw: skip — no depositors');
    return;
  }
  // Idle after a draw: `nextDrawAt` is lastDrawAt + interval (repeat draws without a
  // new deposit bus). `0` means nothing is scheduled (no depositors / never drawn).
  if (nextDrawAt === 0n) {
    log('draw: skip — no deposit batch open (waiting for next first deposit)');
    return;
  }
  if (now < nextDrawAt) {
    log(`draw: skip — next draw in ${Number(nextDrawAt - now)}s (draw #${drawsCompleted + 1n})`);
    return;
  }

  try {
    // Size prize-per-draw as prizeShareBps of the *full* encrypted reserve (not the last drip).
    const [currentReserveHandle, lastRevealHandle] = (await Promise.all([
      publicClient.readContract({ ...vault, functionName: 'confidentialPrizeReserve' }),
      publicClient.readContract({ ...vault, functionName: 'lastPrizeReserveRevealHandle' }),
    ])) as [Hex, Hex];

    let reserveHandle: Hex = lastRevealHandle;
    if (
      !currentReserveHandle ||
      currentReserveHandle === ZERO ||
      currentReserveHandle.toLowerCase() !== (lastRevealHandle ?? ZERO).toLowerCase()
    ) {
      log('draw: requesting prize-reserve reveal to size prize-per-draw…');
      try {
        const revealHash = await walletClient.writeContract({
          ...vault,
          functionName: 'requestPrizeReserveReveal',
          account: walletClient.account!,
          chain: sepolia,
        });
        const revealReceipt = await publicClient.waitForTransactionReceipt({ hash: revealHash });
        reserveHandle =
          parsePrizeReserveRevealHandle(revealReceipt) ??
          ((await publicClient.readContract({
            ...vault,
            functionName: 'lastPrizeReserveRevealHandle',
          })) as Hex);
        log(`draw: reserve reveal submitted ${revealHash}`);
      } catch (error) {
        if (!/RevealAlreadyRequested/i.test(describe(error))) throw error;
        reserveHandle = (await publicClient.readContract({
          ...vault,
          functionName: 'lastPrizeReserveRevealHandle',
        })) as Hex;
        log('draw: prize reserve already publicly decryptable');
      }
    }

    if (!reserveHandle || reserveHandle === ZERO) {
      log('draw: skip — no prize-reserve reveal handle');
      return;
    }

    log(`draw: publicDecrypt reserve ${reserveHandle}…`);
    const decrypted = await publicDecryptHandle(sdk, reserveHandle);
    const reserveConf = decrypted.cleartext;
    if (reserveConf === 0n) {
      log('draw: skip — prize reserve is 0');
      return;
    }

    const prizeConf = (reserveConf * BigInt(prizeShareBps as number)) / 10_000n;
    if (prizeConf === 0n) {
      log(`draw: skip — prizeShareBps rounds prize to 0 (reserve=${reserveConf})`);
      return;
    }
    log(
      `draw: sizing prize-per-draw=${prizeConf} (${prizeShareBps} bps of reserve ${reserveConf})`,
    );

    const encPrize = await encryptEuint64(sdk, {
      amount: prizeConf,
      contractAddress: config.vaultAddress,
      userAddress: owner,
    });
    const prizeHash = await walletClient.writeContract({
      ...vault,
      functionName: 'setPrizePerDraw',
      args: [encPrize.handle, encPrize.inputProof],
      account: walletClient.account!,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: prizeHash });
    log(`draw: setPrizePerDraw confirmed (${prizeHash})`);

    log(`draw: submitting #${drawsCompleted + 1n}…`);
    const hash = await walletClient.writeContract({
      ...vault,
      functionName: 'draw',
      account: walletClient.account!,
      chain: sepolia,
    });
    log(`draw: submitted ${hash}`);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    if (receipt.status === 'reverted') throw new Error(`draw reverted in ${hash}`);
    const completed = await publicClient.readContract({
      ...vault,
      functionName: 'drawsCompleted',
    });
    log(`draw: #${completed} confirmed in block ${receipt.blockNumber}`);
  } catch (error) {
    if (isSoftSkip(error)) {
      log(`draw: soft skip — ${describe(error)}`);
      return;
    }
    throw error;
  }
}

async function maybeAccrue(
  config: KeeperConfig,
  publicClient: PublicClient,
  walletClient: Wallet,
  yieldVault: `0x${string}`,
) {
  const allocated = (await publicClient.readContract({
    address: config.vaultAddress,
    abi: VAULT_ABI,
    functionName: 'allocatedUnderlying',
  })) as bigint;

  if (allocated === 0n) {
    log('yield.accrue: skip — nothing allocated yet');
    return;
  }

  const [aprBps, lastAccrualAt, asset] = await Promise.all([
    publicClient.readContract({ address: yieldVault, abi: YIELD_ABI, functionName: 'aprBps' }),
    publicClient.readContract({
      address: yieldVault,
      abi: YIELD_ABI,
      functionName: 'lastAccrualAt',
    }),
    publicClient.readContract({ address: yieldVault, abi: YIELD_ABI, functionName: 'asset' }),
  ]);

  const now = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = now > (lastAccrualAt as bigint) ? now - (lastAccrualAt as bigint) : 0n;
  const cappedElapsed = elapsed > 3600n ? 3600n : elapsed;
  if (cappedElapsed === 0n) {
    log('yield.accrue: skip — accrued this second already');
    return;
  }

  const amountRaw =
    (allocated * BigInt(aprBps as number) * cappedElapsed) / (365n * 24n * 60n * 60n * 10_000n);
  // Sepolia demo: real APR math on ~100 tokens over minutes is dust (< 1e-8). Floor to
  // 1 full underlying unit so Harvestable surplus / encrypt prize is visible in the UI.
  const minDemoDrip = 10n ** 6n;
  const amount = amountRaw < minDemoDrip ? minDemoDrip : amountRaw;
  if (amountRaw < minDemoDrip) {
    log(
      `yield.accrue: APR math gave ${amountRaw} wei (dust) — using demo floor ${minDemoDrip} (1 token)`,
    );
  }

  const owner = walletClient.account!.address;
  const assetAddr = asset as `0x${string}`;

  try {
    try {
      const mintHash = await walletClient.writeContract({
        address: assetAddr,
        abi: ERC20_ABI,
        functionName: 'mint',
        args: [owner, amount],
        account: walletClient.account!,
        chain: sepolia,
      });
      await publicClient.waitForTransactionReceipt({ hash: mintHash });
    } catch {
      const bal = (await publicClient.readContract({
        address: assetAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [owner],
      })) as bigint;
      if (bal < amount) {
        log(`yield.accrue: skip — need ${amount} underlying, wallet has ${bal}`);
        return;
      }
    }

    const approveHash = await walletClient.writeContract({
      address: assetAddr,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [yieldVault, amount],
      account: walletClient.account!,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveHash });

    const accrueHash = await walletClient.writeContract({
      address: yieldVault,
      abi: YIELD_ABI,
      functionName: 'accrue',
      args: [amount],
      account: walletClient.account!,
      chain: sepolia,
    });
    await publicClient.waitForTransactionReceipt({ hash: accrueHash });
    log(`yield.accrue: dripped ${amount} underlying (${accrueHash})`);
  } catch (error) {
    if (isSoftSkip(error)) {
      log(`yield.accrue: soft skip — ${describe(error)}`);
      return;
    }
    throw error;
  }
}

function parsePrincipalRevealHandle(receipt: TransactionReceipt): Hex | null {
  for (const logItem of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: VAULT_ABI,
        data: logItem.data,
        topics: logItem.topics,
      });
      if (decoded.eventName === 'TotalPrincipalRevealRequested' && decoded.args.handle) {
        return decoded.args.handle as Hex;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

function parsePrizeReserveRevealHandle(receipt: TransactionReceipt): Hex | null {
  for (const logItem of receipt.logs) {
    try {
      const decoded = decodeEventLog({
        abi: VAULT_ABI,
        data: logItem.data,
        topics: logItem.topics,
      });
      if (decoded.eventName === 'PrizeReserveRevealRequested' && decoded.args.handle) {
        return decoded.args.handle as Hex;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

function parseUnwrapBurntHandle(
  receipt: TransactionReceipt,
  cToken: `0x${string}`,
): Hex | null {
  const tokenLower = cToken.toLowerCase();
  for (const logItem of receipt.logs) {
    if (logItem.address.toLowerCase() !== tokenLower) continue;
    try {
      const decoded = decodeEventLog({
        abi: ERC7984_ABI,
        data: logItem.data,
        topics: logItem.topics,
      });
      if (decoded.eventName === 'UnwrapRequested' && decoded.args.amount) {
        return decoded.args.amount as Hex;
      }
    } catch {
      /* next */
    }
  }
  return null;
}

function isSoftSkip(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /DrawTooEarly|PrizeNotConfigured|PrizeReserveNotFunded|NoDepositors|NoYieldToHarvest|YieldVaultNotSet|NothingToAccrue|RevealAlreadyRequested|AllocateInFlight|DepositWindowStillOpen|DepositWindowNotOpen|DepositWindowClosed/i.test(
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
