import { BaseError, ContractFunctionRevertedError, formatUnits } from 'viem';
import { CONFIDENTIAL_DECIMALS, MAX_DEPOSITORS } from './contracts';
import { formatTimestamp } from './format';

/** Maps the vault's custom errors onto language a depositor can act on. */
function describeVaultError(name: string, args: readonly unknown[]): string {
  switch (name) {
    case 'OnlyDepositor':
      return 'Only accounts with a deposit can do this. Deposit into the pool first.';
    case 'DepositorLimitReached':
      return `This pool is full for the testnet run (${MAX_DEPOSITORS} depositors max).`;
    case 'PrizeNotConfigured':
      return 'The admin has not set a prize per draw yet.';
    case 'PrizeReserveNotFunded':
      return 'The prize reserve is empty. The admin needs to fund it before a draw.';
    case 'NoDepositors':
      return 'Nobody has deposited yet, so there is nothing to draw for.';
    case 'DrawTooEarly': {
      const nextAt = Number(args[0] ?? 0);
      return nextAt
        ? `Too early for the next draw. It unlocks at ${formatTimestamp(nextAt)}.`
        : 'Too early for the next draw.';
    }
    case 'OnlyOwnerMayFundReserve':
      return 'Only the pool admin can fund the prize reserve.';
    case 'RevealThresholdNotMet': {
      const completed = Number(args[0] ?? 0);
      const required = Number(args[1] ?? 0);
      return `The public reveal unlocks after ${required} draws. ${completed} completed so far.`;
    }
    case 'RevealAlreadyRequested':
      return 'This total is already public. It changes again after the next claim.';
    case 'OwnableUnauthorizedAccount':
      return 'That action is restricted to the pool admin.';
    case 'ERC20InsufficientBalance': {
      const balance = args[1];
      const needed = args[2];
      if (typeof balance === 'bigint' && typeof needed === 'bigint') {
        return `Not enough USDC. You hold ${formatUnits(balance, 6)} and need ${formatUnits(needed, 6)}.`;
      }
      return 'Not enough USDC for this amount. Use the faucet first.';
    }
    case 'ERC20InsufficientAllowance':
      return 'The wrapper is not approved for this amount yet. Approve, then wrap.';
    default:
      return '';
  }
}

const PATTERNS: Array<[RegExp, string]> = [
  [/user rejected|user denied|rejected the request|ACTION_REJECTED/i, 'You rejected the request in your wallet.'],
  [/insufficient funds/i, 'Not enough Sepolia ETH to pay for gas. Grab some from a Sepolia faucet.'],
  [/chain mismatch|does not match the target chain|switch.*chain/i, 'Wrong network. Switch your wallet to Sepolia.'],
  [/nonce too low|replacement transaction underpriced/i, 'A previous transaction is still pending. Wait for it to confirm, then retry.'],
  [/relayer|gateway|coprocessor/i, 'The Zama relayer did not respond. Wait a moment and try again.'],
  [/failed to fetch|network ?error|timeout/i, 'Network request failed. Check your connection and try again.'],
  [/signature|eip-?712/i, 'The decryption signature was not completed. Approve the signature to reveal your amounts.'],
];

export function humanizeError(error: unknown): string {
  if (!error) return 'Something went wrong.';

  if (error instanceof BaseError) {
    const reverted = error.walk((e) => e instanceof ContractFunctionRevertedError);
    if (reverted instanceof ContractFunctionRevertedError && reverted.data?.errorName) {
      const described = describeVaultError(reverted.data.errorName, reverted.data.args ?? []);
      if (described) return described;
      return `Transaction reverted: ${reverted.data.errorName}.`;
    }
  }

  const message =
    error instanceof Error ? error.message : typeof error === 'string' ? error : String(error);

  for (const [pattern, friendly] of PATTERNS) {
    if (pattern.test(message)) return friendly;
  }

  const firstLine = message.split('\n')[0]?.trim();
  if (!firstLine) return 'Something went wrong.';
  return firstLine.length > 160 ? `${firstLine.slice(0, 157)}…` : firstLine;
}

/** Confidential amounts are 6-decimal; reject inputs that would silently truncate. */
export function validateConfidentialInput(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return 'Enter an amount.';
  if (!/^\d*\.?\d*$/.test(trimmed)) return 'Amounts must be a plain number.';
  const [, fraction = ''] = trimmed.split('.');
  if (fraction.length > CONFIDENTIAL_DECIMALS) {
    return `cUSDC supports up to ${CONFIDENTIAL_DECIMALS} decimal places.`;
  }
  return null;
}
