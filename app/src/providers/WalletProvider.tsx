import type { ReactNode } from 'react';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WagmiProvider } from 'wagmi';
import { wagmiConfig } from '@/lib/wagmiConfig';
import '@rainbow-me/rainbowkit/styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 10_000 } },
});

const confipoolRainbowTheme = lightTheme({
  accentColor: '#ffd208',
  accentColorForeground: '#000000',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
});

export function WalletProvider({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider
          theme={confipoolRainbowTheme}
          modalSize="compact"
          appInfo={{ appName: 'ConfiPool' }}
        >
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
