import { useCallback } from 'react';
import { encodeAbiParameters, keccak256, toBytes, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { useAccount, useWriteContract } from 'wagmi';
import { useDecryptPublicValues, useEncrypt } from '@zama-fhe/react-sdk';
import {
  CUSDC_MOCK_ADDRESS,
  ERC20_ABI,
  ERC7984_WRAPPER_ABI,
  USDC_MOCK_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
} from '@/lib/contracts';
import { confidentialToUnderlying } from '@/lib/format';
import { useTxRunner, type ReportProgress, type TxStep } from './useTxRunner';

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

const RESERVE_DEPOSIT_TAG = keccak256(toBytes('CONFIPOOL_PRIZE_RESERVE'));

/** Faucet grant per click, in 6-decimal underlying units. */
export const FAUCET_AMOUNT = 10_000n * 10n ** 6n;

export function useConfiPoolActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { mutateAsync: encrypt } = useEncrypt();
  const { mutateAsync: decryptPublicValues } = useDecryptPublicValues();
  const runner = useTxRunner();

  const encryptAmount = useCallback(
    async (contractAddress: `0x${string}`, amount: bigint) => {
      if (!address) throw new Error('Connect a wallet first.');
      const { encryptedValues, inputProof } = await encrypt({
        contractAddress,
        userAddress: address,
        values: [{ value: amount, type: 'euint64' }],
      });
      return { handle: encryptedValues[0] as Hex, inputProof: inputProof as Hex };
    },
    [address, encrypt],
  );

  const requireAddress = useCallback(() => {
    if (!address) throw new Error('Connect a wallet first.');
    return address;
  }, [address]);

  const mintFaucet = useCallback(
    () =>
      runner.run(
        'mint',
        [
          {
            label: 'Minting test USDC',
            run: () =>
              writeContractAsync({
                address: USDC_MOCK_ADDRESS,
                abi: ERC20_ABI,
                chainId: sepolia.id,
                functionName: 'mint',
                args: [requireAddress(), FAUCET_AMOUNT],
              }),
          },
        ],
        'Test tokens are in your wallet.',
      ),
    [runner, writeContractAsync, requireAddress],
  );

  const wrap = useCallback(
    (amount: bigint, needsApproval: boolean) => {
      const underlyingAmount = confidentialToUnderlying(amount);
      const steps: TxStep[] = [];

      if (needsApproval) {
        steps.push({
          label: 'Approving the wrapper',
          run: () =>
            writeContractAsync({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              chainId: sepolia.id,
              functionName: 'approve',
              args: [CUSDC_MOCK_ADDRESS, underlyingAmount],
            }),
        });
      }

      steps.push({
        label: 'Wrapping into cUSDC',
        run: () =>
          writeContractAsync({
            address: CUSDC_MOCK_ADDRESS,
            abi: ERC7984_WRAPPER_ABI,
            chainId: sepolia.id,
            functionName: 'wrap',
            args: [requireAddress(), underlyingAmount],
          }),
      });

      return runner.run('wrap', steps, 'Your balance is confidential now.');
    },
    [runner, writeContractAsync, requireAddress],
  );

  const deposit = useCallback(
    (amount: bigint) =>
      runner.run(
        'deposit',
        [
          {
            label: 'Encrypting your deposit',
            run: async (report) => {
              const encrypted = await encryptAmount(CUSDC_MOCK_ADDRESS, amount);
              report('Depositing into the pool');
              return writeContractAsync({
                address: CUSDC_MOCK_ADDRESS,
                abi: ERC7984_WRAPPER_ABI,
                chainId: sepolia.id,
                functionName: 'confidentialTransferAndCall',
                args: [VAULT_ADDRESS, encrypted.handle, encrypted.inputProof, '0x'],
              });
            },
          },
        ],
        'You are in the pool. Your amount stays encrypted.',
      ),
    [runner, writeContractAsync, encryptAmount],
  );

  const withdraw = useCallback(
    (amount: bigint) =>
      runner.run(
        'withdraw',
        [
          {
            label: 'Encrypting your withdrawal',
            run: async (report) => {
              const encrypted = await encryptAmount(VAULT_ADDRESS, amount);
              report('Withdrawing principal');
              return writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'withdraw',
                args: [encrypted.handle, encrypted.inputProof],
              });
            },
          },
        ],
        'Principal returned to your wallet as cUSDC.',
      ),
    [runner, writeContractAsync, encryptAmount],
  );

  const claim = useCallback(
    () =>
      runner.run(
        'claim',
        [
          {
            label: 'Claiming winnings',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'claim',
              }),
          },
        ],
        'Claim settled. Only you can read the amount.',
      ),
    [runner, writeContractAsync],
  );

  /** Admin: tag a confidential transfer so the vault books it as prize funding. */
  const fundReserve = useCallback(
    (amount: bigint, reserveTag?: Hex) =>
      runner.run(
        'fundReserve',
        [
          {
            label: 'Encrypting the reserve top-up',
            run: async (report) => {
              const tag = reserveTag ?? RESERVE_DEPOSIT_TAG;
              const encrypted = await encryptAmount(CUSDC_MOCK_ADDRESS, amount);
              report('Funding the prize reserve');
              return writeContractAsync({
                address: CUSDC_MOCK_ADDRESS,
                abi: ERC7984_WRAPPER_ABI,
                chainId: sepolia.id,
                functionName: 'confidentialTransferAndCall',
                args: [
                  VAULT_ADDRESS,
                  encrypted.handle,
                  encrypted.inputProof,
                  encodeAbiParameters([{ type: 'bytes32' }], [tag]),
                ],
              });
            },
          },
        ],
        'Prize reserve funded.',
      ),
    [runner, writeContractAsync, encryptAmount],
  );

  /** Permissionless: freeze TWAB window + encrypted randomness. */
  const beginRound = useCallback(
    () =>
      runner.run(
        'beginRound',
        [
          {
            label: 'Beginning the encrypted round',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'beginRound',
              }),
          },
        ],
        'Round began. Next: Unseal R + total weight (anyone can run it).',
      ),
    [runner, writeContractAsync],
  );

  /**
   * Public-decrypt encR + encTotalWeight, then post KMS proof onchain.
   * Permissionless — reviewers run this from the Draws page (no keeper required).
   */
  const unsealRound = useCallback(
    (drawId: number, encR: Hex, encTotalWeight: Hex) =>
      runner.run(
        'unsealRound',
        [
          {
            label: 'Public-decrypting R + total weight',
            run: async (report: ReportProgress) => {
              const attempts = 10;
              let lastError: unknown;
              for (let i = 0; i < attempts; i++) {
                try {
                  report(
                    i === 0
                      ? 'Asking the KMS for a public decrypt…'
                      : `KMS still catching up — retry ${i + 1}/${attempts}`,
                  );
                  const result = await decryptPublicValues([encR, encTotalWeight]);
                  const cleartexts = result.abiEncodedClearValues;
                  const decryptionProof = result.decryptionProof;
                  if (!cleartexts || !decryptionProof) {
                    throw new Error('Public decrypt returned an incomplete proof.');
                  }
                  report('Confirm unsealRound in your wallet');
                  return writeContractAsync({
                    address: VAULT_ADDRESS,
                    abi: VAULT_ABI,
                    chainId: sepolia.id,
                    functionName: 'unsealRound',
                    args: [drawId, cleartexts, decryptionProof],
                  });
                } catch (error) {
                  lastError = error;
                  if (i < attempts - 1) await sleep(2_500);
                }
              }
              throw lastError instanceof Error
                ? lastError
                : new Error('Public decrypt failed after several attempts.');
            },
          },
        ],
        'Round unsealed. Next: Score your Apex / Pulse / Ripple prizes.',
      ),
    [runner, writeContractAsync, decryptPublicValues],
  );

  const scoreSelf = useCallback(
    (drawId: number) =>
      runner.run(
        'scoreEntrant',
        [
          {
            label: 'Scoring your tier prizes',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'scoreEntrant',
                args: [requireAddress(), drawId],
              }),
          },
        ],
        'Scored. Decrypt claimable to see if you won — next round opens after minPeriod (~2 min).',
      ),
    [runner, writeContractAsync, requireAddress],
  );

  const harvest = useCallback(
    () =>
      runner.run(
        'harvest',
        [
          {
            label: 'Harvesting yield into the reserve',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'harvest',
              }),
          },
        ],
        'Any available yield was folded into the encrypted prize reserve.',
      ),
    [runner, writeContractAsync],
  );

  const requestReveal = useCallback(
    () =>
      runner.run(
        'reveal',
        [
          {
            label: 'Publishing total prizes paid',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'requestTotalPrizesPaidReveal',
              }),
          },
        ],
        'Total prizes paid is now publicly decryptable.',
      ),
    [runner, writeContractAsync],
  );

  const setMinDrawsBeforePublicReveal = useCallback(
    (value: bigint) =>
      runner.run(
        'setRevealThreshold',
        [
          {
            label: 'Updating prizes-paid reveal threshold',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'setMinDrawsBeforePublicReveal',
                args: [value],
              }),
          },
        ],
        'Prizes-paid reveal threshold updated.',
      ),
    [runner, writeContractAsync],
  );

  return {
    ...runner,
    mintFaucet,
    wrap,
    deposit,
    withdraw,
    claim,
    fundReserve,
    beginRound,
    /** @deprecated Prefer beginRound. */
    openDraw: beginRound,
    triggerDraw: beginRound,
    unsealRound,
    scoreSelf,
    /** @deprecated Prefer scoreSelf. */
    accrueSelf: scoreSelf,
    harvest,
    requestReveal,
    setMinDrawsBeforePublicReveal,
  };
}
