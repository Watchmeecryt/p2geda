import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { http } from 'wagmi';
import { sepolia } from 'viem/chains';
import { sepoliaRpcUrl } from './chains';

/** Shared fallback so the app still connects when no WalletConnect project id is set. */
const FALLBACK_WALLETCONNECT_PROJECT_ID = 'cf5d11022a642e528f427d4210e992db';

export const wagmiConfig = getDefaultConfig({
  appName: 'ConfiPool',
  projectId:
    import.meta.env.VITE_WALLETCONNECT_PROJECT_ID?.trim() || FALLBACK_WALLETCONNECT_PROJECT_ID,
  chains: [sepolia],
  ssr: false,
  transports: {
    [sepolia.id]: http(sepoliaRpcUrl(), { batch: true }),
  },
});
