/**
 * Token / venue icons for ConfiPool UI (served from /icons).
 */
export const TOKEN_ICONS = {
  usdc: '/icons/usdc.svg',
  morpho: '/icons/morpho.jpg',
  weth: '/icons/weth.svg',
  cbbtc: '/icons/cbbtc.svg',
  wsteth: '/icons/wsteth.svg',
} as const;

export type YieldExposure = {
  id: string;
  label: string;
  /** Share of demo Morpho allocation (must sum to 100). */
  pct: number;
  icon: string;
  /** Morpho-style status chip (e.g. idle cash sleeve). */
  badge?: string;
};

/**
 * Display-only Morpho allocation shape for the Yield card.
 * On Sepolia, 100% of real capital sits in MockYield4626 — these weights preview
 * where a Steakhouse-style USDC vault would park funds on mainnet.
 */
export const DEMO_YIELD_EXPOSURES: readonly YieldExposure[] = [
  { id: 'cbbtc', label: 'cbBTC', pct: 61, icon: TOKEN_ICONS.cbbtc },
  { id: 'weth', label: 'WETH', pct: 27, icon: TOKEN_ICONS.weth },
  { id: 'usdc', label: 'USDC', pct: 9, icon: TOKEN_ICONS.usdc, badge: 'Idle' },
  { id: 'wsteth', label: 'wstETH', pct: 3, icon: TOKEN_ICONS.wsteth },
] as const;
