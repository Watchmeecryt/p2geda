import { ZamaSDK, memoryStorage } from '@zama-fhe/sdk';
import { createConfig } from '@zama-fhe/sdk/viem';
import { node, sepolia, type FheChain } from '@zama-fhe/sdk/node';
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PrivateKeyAccount,
} from 'viem';
import { sepolia as viemSepolia } from 'viem/chains';

export type EncryptedEuint64 = {
  handle: Hex;
  inputProof: Hex;
};

export type PublicDecryptResult = {
  cleartext: bigint;
  decryptionProof: Hex;
};

let sdkPromise: Promise<ZamaSDK> | null = null;

/**
 * Node FHE transport (`node()` → RelayerNode worker pool) via ZamaSDK.
 * Sepolia: no API key. Mainnet cutover: spread `mainnet` + `auth: { __type: 'ApiKeyHeader', value }`.
 */
export function getSdk(params: {
  rpcUrl: string;
  account: PrivateKeyAccount;
}): Promise<ZamaSDK> {
  if (!sdkPromise) {
    sdkPromise = (async () => {
      const publicClient = createPublicClient({
        chain: viemSepolia,
        transport: http(params.rpcUrl),
      });
      const walletClient = createWalletClient({
        account: params.account,
        chain: viemSepolia,
        transport: http(params.rpcUrl),
      });

      const chain = {
        ...sepolia,
        network: params.rpcUrl,
      } as const satisfies FheChain;

      const config = createConfig({
        chains: [chain],
        publicClient,
        walletClient,
        storage: memoryStorage,
        relayers: { [chain.id]: node() },
      });

      const sdk = new ZamaSDK(config);
      // Warm the node worker pool / ACL lookup.
      await sdk.relayer.fetchFheEncryptionKeyBytes();
      return sdk;
    })();
  }
  return sdkPromise;
}

/** Encrypt one euint64 for an onchain `fromExternal` / confidential transfer. */
export async function encryptEuint64(
  sdk: ZamaSDK,
  params: {
    amount: bigint;
    contractAddress: `0x${string}`;
    userAddress: `0x${string}`;
  },
): Promise<EncryptedEuint64> {
  const out = await sdk.encrypt({
    values: [{ value: params.amount, type: 'euint64' }],
    contractAddress: params.contractAddress,
    userAddress: params.userAddress,
  });
  const handle = out.encryptedValues[0];
  if (handle == null) throw new Error('sdk.encrypt returned no encrypted value');
  return {
    handle: handle as Hex,
    inputProof: out.inputProof as Hex,
  };
}

/** Public-decrypt a handle previously marked with `FHE.makePubliclyDecryptable`. */
export async function publicDecryptHandle(
  sdk: ZamaSDK,
  handle: Hex,
  opts?: { attempts?: number; delayMs?: number },
): Promise<PublicDecryptResult> {
  const attempts = opts?.attempts ?? 10;
  const delayMs = opts?.delayMs ?? 2_500;
  let lastError: unknown;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await sdk.decryption.decryptPublicValues([handle]);
      const clearValues = result.clearValues as Record<string, bigint | number | string>;
      const key = Object.keys(clearValues).find((k) => k.toLowerCase() === handle.toLowerCase());
      if (!key) throw new Error(`decryptPublicValues did not return cleartext for ${handle}`);
      const raw = clearValues[key];
      const cleartext = typeof raw === 'bigint' ? raw : BigInt(raw as string | number);
      return {
        cleartext,
        decryptionProof: result.decryptionProof as Hex,
      };
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) await sleep(delayMs);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`publicDecrypt failed after ${attempts} attempts`);
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}
