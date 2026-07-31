import { createConfig as createZamaConfig } from '@zama-fhe/react-sdk/wagmi';
import { indexedDBStorage } from '@zama-fhe/sdk';
import { sepolia as fheSepolia, type FheChain } from '@zama-fhe/sdk/chains';
import { web } from '@zama-fhe/sdk/web';
import { SEPOLIA_CHAIN_ID, sepoliaRpcUrl } from './chains';
import { wagmiConfig } from './wagmiConfig';

const DEFAULT_RELAYER_WEB_ORIGIN = 'https://relayer-web-proxy-production.up.railway.app';

/** Matches the SDK's default permit TTL so a permit and its keypair expire together. */
const TRANSPORT_KEY_PAIR_TTL_SECONDS = 2_592_000;

function relayerOrigin(): string {
  const raw = import.meta.env.VITE_RELAYER_WEB_ORIGIN?.trim();
  return (raw || DEFAULT_RELAYER_WEB_ORIGIN).replace(/\/+$/, '');
}

/** Network presets expect the relayer HTTP base to end in /v2. */
function relayerBaseForChain(chainId: number): string {
  const base = `${relayerOrigin()}/api/relayer/${chainId}`;
  return base.endsWith('/v2') ? base : `${base}/v2`;
}

const zamaSepolia = {
  ...fheSepolia,
  relayerUrl: relayerBaseForChain(SEPOLIA_CHAIN_ID),
  network: sepoliaRpcUrl(),
} as const satisfies FheChain;

export const zamaWagmiConfig = createZamaConfig({
  chains: [zamaSepolia],
  wagmiConfig,
  relayers: { [zamaSepolia.id]: web() },
  storage: indexedDBStorage,
  transportKeyPairTTL: TRANSPORT_KEY_PAIR_TTL_SECONDS,
});
