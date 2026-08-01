import { getAddress, type Address } from 'viem';

function envAddress(raw: string | undefined, fallback: Address): Address {
  const trimmed = raw?.trim();
  if (!trimmed) return fallback;
  try {
    return getAddress(trimmed);
  } catch {
    return fallback;
  }
}

export const VAULT_ADDRESS = envAddress(
  import.meta.env.VITE_CONFIPOOL_VAULT_ADDRESS,
  '0x1f7B0b56FcaeF3413F2A75bcCDD81E9C0de8b4ce',
);

/** MockYield4626 (Morpho-like). Zero address means the live vault has no yield wired yet. */
export const YIELD_VAULT_ADDRESS = envAddress(
  import.meta.env.VITE_YIELD_VAULT_ADDRESS,
  '0xe827417d40A74f0eE566424079aE0eAe0eBA5728',
);

export const YIELD_VAULT_CONFIGURED =
  YIELD_VAULT_ADDRESS !== '0x0000000000000000000000000000000000000000';

/** Publicly mintable ERC-20 faucet token (Zama USDC Mock), 6 decimals. */
export const USDC_MOCK_ADDRESS = envAddress(
  import.meta.env.VITE_USDC_MOCK_ADDRESS,
  '0x9b5Cd13b8eFbB58Dc25A05CF411D8056058aDFfF',
);

/** ERC-7984 wrapper over USDC Mock (cUSDCMock), 6 decimals. */
export const CUSDC_MOCK_ADDRESS = envAddress(
  import.meta.env.VITE_CUSDC_MOCK_ADDRESS,
  '0x7c5BF43B851c1dff1a4feE8dB225b87f2C223639',
);

export const UNDERLYING_DECIMALS = 6;
export const CONFIDENTIAL_DECIMALS = 6;

/** Underlying units per confidential unit: 10 ** (6 - 6) = 1. */
export const WRAP_RATE = 10n ** BigInt(UNDERLYING_DECIMALS - CONFIDENTIAL_DECIMALS);

export const UNDERLYING_SYMBOL = 'USDC';
export const CONFIDENTIAL_SYMBOL = 'cUSDC';

/** An uninitialized euint64 handle reads back as 32 zero bytes. */
export const UNINITIALIZED_HANDLE =
  '0x0000000000000000000000000000000000000000000000000000000000000000' as const;

export const ERC20_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'allowance',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
    ],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'mint',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'decimals',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint8' }],
  },
] as const;

export const ERC7984_WRAPPER_ABI = [
  {
    type: 'function',
    name: 'wrap',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialTransferAndCall',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
      { name: 'data', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'rate',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

export const VAULT_ABI = [
  {
    type: 'function',
    name: 'owner',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'drawInterval',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'depositWindowDuration',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'depositWindowOpensAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'depositWindowClosesAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'depositsOpen',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'nextDrawAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'lastDrawAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'drawsCompleted',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    name: 'prizePerDrawConfigured',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'prizeReserveFunded',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bool' }],
  },
  {
    type: 'function',
    name: 'lastTotalPaidRevealHandle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'lastPublicTvlRevealHandle',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'minDrawsBeforePublicReveal',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'minDepositsBeforePublicTvlReveal',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'setMinDrawsBeforePublicReveal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'value', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'setMinDepositsBeforePublicTvlReveal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'value', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'MAX_DEPOSITORS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'RESERVE_DEPOSIT_TAG',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialBalanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialClaimableOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialPrizeReserve',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialPrizePerDraw',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialTotalPrincipal',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'confidentialTotalPrizesPaid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'setPrizePerDraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  { type: 'function', name: 'draw', stateMutability: 'nonpayable', inputs: [], outputs: [] },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'requestTotalPrizesPaidReveal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'requestPublicTvlReveal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },

  {
    type: 'event',
    name: 'DepositRecorded',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'newBalanceHandle', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'WithdrawalRequested',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amountHandle', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PrizeReserveFunded',
    inputs: [{ name: 'newReserveHandle', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'PrizePerDrawConfigured',
    inputs: [{ name: 'prizeHandle', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'DrawCompleted',
    inputs: [
      { name: 'drawId', type: 'uint256', indexed: true },
      { name: 'encryptedPrizeHandle', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'PrizeClaimed',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'amountHandle', type: 'bytes32', indexed: true },
    ],
  },
  {
    type: 'event',
    name: 'TotalPrizesPaidRevealRequested',
    inputs: [
      { name: 'drawId', type: 'uint256', indexed: true },
      { name: 'totalPaidHandle', type: 'bytes32', indexed: true },
    ],
  },

  { type: 'error', name: 'DepositorLimitReached', inputs: [] },
  { type: 'error', name: 'PrizeNotConfigured', inputs: [] },
  { type: 'error', name: 'PrizeReserveNotFunded', inputs: [] },
  { type: 'error', name: 'NoDepositors', inputs: [] },
  { type: 'error', name: 'DrawTooEarly', inputs: [{ name: 'nextDrawAt', type: 'uint256' }] },
  { type: 'error', name: 'OnlyDepositor', inputs: [{ name: 'caller', type: 'address' }] },
  {
    type: 'error',
    name: 'OnlyOwnerMayFundReserve',
    inputs: [{ name: 'sender', type: 'address' }],
  },
  {
    type: 'error',
    name: 'RevealThresholdNotMet',
    inputs: [
      { name: 'completed', type: 'uint256' },
      { name: 'required', type: 'uint256' },
    ],
  },
  { type: 'error', name: 'RevealAlreadyRequested', inputs: [{ name: 'handle', type: 'bytes32' }] },
] as const;

/** MockYield4626 (Morpho-like stand-in). */
export const YIELD_VAULT_ABI = [
  {
    type: 'function',
    name: 'asset',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'totalAssets',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'totalSupply',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'balanceOf',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'convertToAssets',
    stateMutability: 'view',
    inputs: [{ name: 'shares', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'previewDeposit',
    stateMutability: 'view',
    inputs: [{ name: 'assets', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'deposit',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'assets', type: 'uint256' },
      { name: 'receiver', type: 'address' },
      { name: 'owner', type: 'address' },
    ],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'accrue',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'amount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'accrueElapsed',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'aprBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'lastAccrualAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
] as const;

/** Yield surface on ConfidentialPrizeVault (post yield redeploy). */
export const VAULT_YIELD_ABI = [
  {
    type: 'function',
    name: 'yieldVault',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'allocatedUnderlying',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'prizeShareBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'bootstrapAllocate',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'underlyingAmount', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'harvestClear',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'requestTotalPrincipalReveal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'redeemFromYield',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'underlyingAmount', type: 'uint256' }],
    outputs: [],
  },
] as const;

