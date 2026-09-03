import type { Address } from 'viem';

/**
 * Official Zama confidential-vault Sepolia staging addresses.
 * @see contracts/deployments/sepolia-confidential-vault.json
 * @see https://docs.zama.org/protocol/confidential-vault/reference/addresses
 *
 * Staging Morpho share price does not drip yield — ConfiPool’s adapter still joins
 * the real deposit/redeem batchers and holds real cShares; prizes on Sepolia are
 * funded via adapter rateBps seed + Admin → Fund reserve.
 */
export const SEPOLIA_CONFIDENTIAL_VAULT = {
  depositBatcher: '0x48758559c14d4d92b4C74A99660B6a8dbe85F53b' as Address,
  redeemBatcher: '0xe94E9afdDd43a19C2914739e9279cb6Fe287BEb0' as Address,
  /** Encrypted vault shares minted after a successful join batch. */
  cShare: '0x7E93d5c150A2178B1fCde0278582Acf59478eA5f' as Address,
  /** ERC-4626 Morpho/Steakhouse-shaped underlying vault on staging. */
  erc4626UnderlyingVault: '0x6AB54988261AEC573a2CA13cF802d3B1114f864C' as Address,
  whitelistGate: '0x0C7c3830B16B65FF90f96F88a9ad2dCaB9434e74' as Address,
  docsUrl: 'https://docs.zama.org/protocol/confidential-vault/reference/addresses',
} as const;

export function formatRateBps(bps: number | bigint | undefined): string {
  if (bps === undefined) return '—';
  const n = Number(bps);
  if (!Number.isFinite(n)) return '—';
  const pct = n / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}
