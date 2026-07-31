/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_RELAYER_WEB_ORIGIN?: string;
  readonly VITE_SEPOLIA_RPC_URL?: string;
  readonly VITE_WALLETCONNECT_PROJECT_ID?: string;
  readonly VITE_CONFIPOOL_VAULT_ADDRESS?: string;
  readonly VITE_YIELD_VAULT_ADDRESS?: string;
  readonly VITE_USDC_MOCK_ADDRESS?: string;
  readonly VITE_CUSDC_MOCK_ADDRESS?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
