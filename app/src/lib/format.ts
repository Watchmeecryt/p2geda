import { formatUnits, parseUnits } from 'viem';
import { CONFIDENTIAL_DECIMALS, UNDERLYING_DECIMALS, WRAP_RATE } from './contracts';

/** Trims trailing zeros so 12.500000 reads as 12.5 without losing precision. */
function trimTrailingZeros(value: string): string {
  if (!value.includes('.')) return value;
  return value.replace(/\.?0+$/, '');
}

export function formatConfidential(value: bigint, maxFractionDigits = 4): string {
  const raw = formatUnits(value, CONFIDENTIAL_DECIMALS);
  const [whole, fraction = ''] = raw.split('.');
  const grouped = BigInt(whole).toLocaleString('en-US');
  if (!fraction) return grouped;
  const clipped = trimTrailingZeros(`.${fraction.slice(0, maxFractionDigits)}`);
  return clipped === '.' || clipped === '' ? grouped : `${grouped}${clipped}`;
}

export function formatUnderlying(value: bigint, maxFractionDigits = 2): string {
  const raw = formatUnits(value, UNDERLYING_DECIMALS);
  const [whole, fraction = ''] = raw.split('.');
  const grouped = BigInt(whole).toLocaleString('en-US');
  if (!fraction) return grouped;
  const clipped = trimTrailingZeros(`.${fraction.slice(0, maxFractionDigits)}`);
  return clipped === '.' || clipped === '' ? grouped : `${grouped}${clipped}`;
}

export function parseConfidential(input: string): bigint {
  return parseUnits(input.trim(), CONFIDENTIAL_DECIMALS);
}

/** Confidential units are 6-decimal; underlying uses the same scale when WRAP_RATE = 1. */
export function confidentialToUnderlying(amount: bigint): bigint {
  return amount * WRAP_RATE;
}

export function underlyingToConfidential(amount: bigint): bigint {
  return amount / WRAP_RATE;
}

export function isPositiveAmount(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed) return false;
  if (!/^\d*\.?\d*$/.test(trimmed)) return false;
  try {
    return parseConfidential(trimmed) > 0n;
  } catch {
    return false;
  }
}

export function shortenAddress(address: string, size = 4): string {
  if (address.length <= size * 2 + 2) return address;
  return `${address.slice(0, size + 2)}…${address.slice(-size)}`;
}

export function shortenHash(hash: string): string {
  return `${hash.slice(0, 10)}…${hash.slice(-6)}`;
}

export function formatCountdown(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return 'ready now';
  // Guard against uint40.max / bad targets leaking into the label.
  if (seconds > 7 * 24 * 3600) return 'awaiting reveal';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  if (minutes > 0) return `${minutes}m ${String(rest).padStart(2, '0')}s`;
  return `${rest}s`;
}

export function formatTimestamp(seconds: number): string {
  return new Date(seconds * 1000).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatRelativeTime(seconds: number): string {
  const deltaSeconds = Math.floor(Date.now() / 1000) - seconds;
  if (deltaSeconds < 60) return 'just now';
  const minutes = Math.floor(deltaSeconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}
