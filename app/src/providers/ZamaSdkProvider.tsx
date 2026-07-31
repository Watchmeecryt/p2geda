import type { ReactNode } from 'react';
import { ZamaProvider } from '@zama-fhe/react-sdk';
import { zamaWagmiConfig } from '@/lib/zamaConfig';

export function ZamaSdkProvider({ children }: { children: ReactNode }) {
  return <ZamaProvider config={zamaWagmiConfig}>{children}</ZamaProvider>;
}
