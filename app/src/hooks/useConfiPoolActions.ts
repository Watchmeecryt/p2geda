import { useCallback } from 'react';
import { encodeAbiParameters, keccak256, toBytes, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { useAccount, useWriteContract } from 'wagmi';
import { useEncrypt } from '@zama-fhe/react-sdk';
import {
  CUSDC_MOCK_ADDRESS,
  ERC20_ABI,
  ERC7984_WRAPPER_ABI,
  USDC_MOCK_ADDRESS,
  VAULT_ABI,
  VAULT_ADDRESS,
} from '@/lib/contracts';
import { confidentialToUnderlying } from '@/lib/format';
import { useTxRunner, type TxStep } from './useTxRunner';

const RESERVE_DEPOSIT_TAG = keccak256(toBytes('CONFIPOOL_PRIZE_RESERVE'));

/** Faucet grant per click, in 6-decimal underlying units. */
export const FAUCET_AMOUNT = 10_000n * 10n ** 6n;

export function useConfiPoolActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const { mutateAsync: encrypt } = useEncrypt();
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
  const openDraw = useCallback(
    () =>
      runner.run(
        'openDraw',
        [
          {
            label: 'Opening the encrypted draw',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'openDraw',
              }),
          },
        ],
        'Draw opened. The keeper will reveal and accrue Apex / Pulse / Ripple.',
      ),
    [runner, writeContractAsync],
  );

  const accrueSelf = useCallback(
    (drawId: number) =>
      runner.run(
        'accrue',
        [
          {
            label: 'Accruing your tier prizes',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'accrue',
                args: [requireAddress(), drawId],
              }),
          },
        ],
        'Accrual done. Decrypt your claimable balance to see if you won.',
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
    openDraw,
    /** @deprecated Prefer openDraw — kept for call sites mid-migration. */
    triggerDraw: openDraw,
    accrueSelf,
    harvest,
    requestReveal,
    setMinDrawsBeforePublicReveal,
  };
}
