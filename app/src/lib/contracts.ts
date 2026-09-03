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

/** Live V5 TWAB vault (Sepolia — beginRound/unsealRound/scoreEntrant, minPeriod 1h). */
export const VAULT_ADDRESS = envAddress(
  import.meta.env.VITE_CONFIPOOL_VAULT_ADDRESS,
  '0x06742409F042B3c5932c6C154B9CE67929076eD0',
);

/**
 * Prior Sepolia demo vault(s). History / Metrics still load their indexed rows so a
 * redeploy does not blank the Global feed — events are keyed by vault_address in Supabase.
 */
export const LEGACY_VAULT_ADDRESSES: Address[] = [
  '0x8559cd3a74B87C4D10786775320462F6a7F9ABb6',
  '0x335339161E31fD94fF5A5d0595eC7526AFe9373F',
];

/** Vaults included in the History Global feed (live + prior demos). */
export const HISTORY_VAULT_ADDRESSES: Address[] = [VAULT_ADDRESS, ...LEGACY_VAULT_ADDRESSES];

/** Sepolia deployment block of the live vault (RPC history fallback). */
export const VAULT_DEPLOYMENT_BLOCK = 11_625_426n;

/** ConfidentialVaultSource adapter (Morpho/Zama batchers + demo rateBps pot). */
export const YIELD_VAULT_ADDRESS = envAddress(
  import.meta.env.VITE_YIELD_VAULT_ADDRESS,
  '0x89A3F09Cc68d89b6825C74392B7563318CcF22D3',
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

/** Soft cap for depositor enumeration (matches vault). */
export const MAX_DEPOSITORS = 256n;

/** DrawStatus enum on ConfidentialPrizeVault. */
export const DRAW_STATUS = {
  None: 0,
  Open: 1,
  Revealed: 2,
  Cancelled: 3,
} as const;

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
    name: 'minPeriod',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint40' }],
  },
  {
    type: 'function',
    name: 'genesis',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint40' }],
  },
  {
    type: 'function',
    name: 'nextRoundAt',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint40' }],
  },
  {
    type: 'function',
    name: 'roundCount',
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
    name: 'MAX_DEPOSITORS',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
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
    name: 'apexPrize',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'tierPrize',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'uint64' }],
  },
  {
    type: 'function',
    name: 'tierK',
    stateMutability: 'view',
    inputs: [{ name: '', type: 'uint256' }],
    outputs: [{ type: 'uint128' }],
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
    name: 'yieldSource',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
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
    name: 'lastTotalPaidRevealHandle',
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
    name: 'confidentialWinningsOf',
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
    name: 'confidentialTotalPrizesPaid',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'roundAt',
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
    name: 'withdraw',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'encryptedAmount', type: 'bytes32' },
      { name: 'inputProof', type: 'bytes' },
    ],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'claim',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'beginRound',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint32' }],
  },
  {
    type: 'function',
    name: 'unsealRound',
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
    name: 'abandonRound',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'drawId', type: 'uint32' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'scoreEntrant',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'user', type: 'address' },
      { name: 'drawId', type: 'uint32' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'scoreEntrants',
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
  {
    type: 'function',
    name: 'setMinDrawsBeforePublicReveal',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'value', type: 'uint256' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'requestTotalPrizesPaidReveal',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'event',
    name: 'Deposited',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint40', indexed: false },
      { name: 'observationIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'Withdrawn',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'timestamp', type: 'uint40', indexed: false },
      { name: 'observationIndex', type: 'uint256', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'PrizeReserveFunded',
    inputs: [{ name: 'newReserveHandle', type: 'bytes32', indexed: true }],
  },
  {
    type: 'event',
    name: 'RoundBegan',
    inputs: [
      { name: 'drawId', type: 'uint32', indexed: true },
      { name: 'periodStart', type: 'uint40', indexed: false },
      { name: 'snapshotAt', type: 'uint40', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'RoundUnsealed',
    inputs: [
      { name: 'drawId', type: 'uint32', indexed: true },
      { name: 'r', type: 'uint64', indexed: false },
      { name: 'totalWeight', type: 'uint128', indexed: false },
    ],
  },
  {
    type: 'event',
    name: 'EntrantScored',
    inputs: [
      { name: 'account', type: 'address', indexed: true },
      { name: 'drawId', type: 'uint32', indexed: true },
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
      { name: 'drawId', type: 'uint32', indexed: true },
      { name: 'totalPaidHandle', type: 'bytes32', indexed: true },
    ],
  },
  { type: 'error', name: 'DepositorLimitReached', inputs: [] },
  { type: 'error', name: 'NothingStaked', inputs: [] },
  { type: 'error', name: 'PreviousDrawUnresolved', inputs: [] },
  { type: 'error', name: 'TooSoon', inputs: [{ name: 'openableAt', type: 'uint40' }] },
  { type: 'error', name: 'DrawNotOpen', inputs: [] },
  { type: 'error', name: 'DrawNotRevealed', inputs: [] },
  { type: 'error', name: 'PrizeTiersNotSet', inputs: [] },
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

/** ConfidentialVaultSource — Morpho/Zama composition adapter. */
export const YIELD_SOURCE_ABI = [
  {
    type: 'function',
    name: 'rateBps',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint16' }],
  },
  {
    type: 'function',
    name: 'controller',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'token',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'depositBatcher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'redeemBatcher',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'address' }],
  },
  {
    type: 'function',
    name: 'joinVault',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    type: 'function',
    name: 'claimShares',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'harvest',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'to', type: 'address' }],
    outputs: [{ type: 'bytes32' }],
  },
] as const;
