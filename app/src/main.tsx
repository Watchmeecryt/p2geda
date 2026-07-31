import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Toaster } from 'react-hot-toast';
import { WalletProvider } from '@/providers/WalletProvider';
import { ZamaSdkProvider } from '@/providers/ZamaSdkProvider';
import App from '@/App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <WalletProvider>
      <ZamaSdkProvider>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 5000,
            style: {
              background: '#ffffff',
              color: '#111111',
              border: '1px solid rgba(0,0,0,0.1)',
              borderRadius: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.07), 0 12px 40px rgba(0,0,0,0.12)',
              maxWidth: 'min(24rem, 92vw)',
              fontSize: '0.86rem',
              fontWeight: 500,
            },
            success: { iconTheme: { primary: '#e6b800', secondary: '#111111' } },
            error: { iconTheme: { primary: '#dd3232', secondary: '#ffffff' } },
          }}
        />
      </ZamaSdkProvider>
    </WalletProvider>
  </StrictMode>,
);
