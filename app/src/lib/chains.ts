import { sepolia } from 'viem/chains';

export const SEPOLIA_CHAIN_ID = sepolia.id;

const DEFAULT_SEPOLIA_RPC = 'https://ethereum-sepolia-rpc.publicnode.com';

export function sepoliaRpcUrl(): string {
  return import.meta.env.VITE_SEPOLIA_RPC_URL?.trim() || DEFAULT_SEPOLIA_RPC;
}

export function explorerTxUrl(hash: string): string {
  return `https://sepolia.etherscan.io/tx/${hash}`;
}

export function explorerAddressUrl(address: string): string {
  return `https://sepolia.etherscan.io/address/${address}`;
}
