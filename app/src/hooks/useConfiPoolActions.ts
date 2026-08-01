import { useCallback } from 'react';
import { encodeAbiParameters, keccak256, parseUnits, toBytes, type Hex } from 'viem';
import { sepolia } from 'viem/chains';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { useEncrypt } from '@zama-fhe/react-sdk';
import {
  CUSDC_MOCK_ADDRESS,
  ERC20_ABI,
  ERC7984_WRAPPER_ABI,
  UNDERLYING_DECIMALS,
  VAULT_ABI,
  VAULT_ADDRESS,
  VAULT_YIELD_ABI,
  WRAP_RATE,
  YIELD_VAULT_ABI,
  YIELD_VAULT_ADDRESS,
  USDC_MOCK_ADDRESS,
} from '@/lib/contracts';
import { confidentialToUnderlying } from '@/lib/format';
import { useTxRunner, type TxStep } from './useTxRunner';

const RESERVE_DEPOSIT_TAG = keccak256(toBytes('CONFIPOOL_PRIZE_RESERVE'));

/** Faucet grant per click, in 6-decimal underlying units. */
export const FAUCET_AMOUNT = 10_000n * 10n ** 6n;

export function useConfiPoolActions() {
  const { address } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient({ chainId: sepolia.id });
  const { mutateAsync: encrypt } = useEncrypt();
  const runner = useTxRunner();

  /** Encrypts one euint64 bound to `contractAddress` and the connected wallet. */
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

  /**
   * Wraps public USDC Mock into confidential cUSDC. `amount` is in confidential
   * 6-decimal units; the ERC-20 leg is scaled by the wrapper rate (1 for USDC).
   */
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

  /**
   * Deposits with an ERC-7984 transfer-and-call: the vault's receiver hook records the
   * encrypted principal, so there is no separate deposit transaction.
   */
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

  const setPrizePerDraw = useCallback(
    (amount: bigint) =>
      runner.run(
        'setPrize',
        [
          {
            label: 'Encrypting the prize',
            run: async (report) => {
              const encrypted = await encryptAmount(VAULT_ADDRESS, amount);
              report('Setting prize per draw');
              return writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'setPrizePerDraw',
                args: [encrypted.handle, encrypted.inputProof],
              });
            },
          },
        ],
        'Prize per draw updated.',
      ),
    [runner, writeContractAsync, encryptAmount],
  );

  /** Reserve funding reuses transfer-and-call, tagged so the hook routes it to the reserve. */
  const fundReserve = useCallback(
    (amount: bigint, reserveTag: Hex) =>
      runner.run(
        'fundReserve',
        [
          {
            label: 'Encrypting the reserve top-up',
            run: async (report) => {
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
                  encodeAbiParameters([{ type: 'bytes32' }], [reserveTag]),
                ],
              });
            },
          },
        ],
        'Prize reserve funded.',
      ),
    [runner, writeContractAsync, encryptAmount],
  );

  const triggerDraw = useCallback(
    () =>
      runner.run(
        'draw',
        [
          {
            label: 'Running the encrypted draw',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'draw',
              }),
          },
        ],
        'Draw complete. The winner was picked over encrypted balances.',
      ),
    [runner, writeContractAsync],
  );

  const requestReveal = useCallback(
    () =>
      runner.run(
        'reveal',
        [
          {
            label: 'Publishing the aggregate',
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

  const requestPublicTvlReveal = useCallback(
    () =>
      runner.run(
        'revealTvl',
        [
          {
            label: 'Publishing vault TVL',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'requestPublicTvlReveal',
              }),
          },
        ],
        'Vault TVL is now publicly decryptable on Metrics.',
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

  const setMinDepositsBeforePublicTvlReveal = useCallback(
    (value: bigint) =>
      runner.run(
        'setTvlThreshold',
        [
          {
            label: 'Updating TVL reveal threshold',
            run: () =>
              writeContractAsync({
                address: VAULT_ADDRESS,
                abi: VAULT_ABI,
                chainId: sepolia.id,
                functionName: 'setMinDepositsBeforePublicTvlReveal',
                args: [value],
              }),
          },
        ],
        'TVL reveal threshold updated.',
      ),
    [runner, writeContractAsync],
  );

  /**
   * Emergency bridge only — prefer RelayerNode allocate in the keeper
   * (publicDecrypt aggregate → encrypt unwrap → finalizeAllocate).
   */
  const bootstrapAllocate = useCallback(
    (underlyingHuman: string, needsApproval: boolean) => {
      const amount = parseUnits(underlyingHuman.trim(), UNDERLYING_DECIMALS);
      const steps: TxStep[] = [];
      if (needsApproval) {
        steps.push({
          label: 'Approving the prize vault',
          run: () =>
            writeContractAsync({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              chainId: sepolia.id,
              functionName: 'approve',
              args: [VAULT_ADDRESS, amount],
            }),
        });
      }
      steps.push({
        label: 'Bootstrap allocate (emergency)',
        run: () =>
          writeContractAsync({
            address: VAULT_ADDRESS,
            abi: VAULT_YIELD_ABI,
            chainId: sepolia.id,
            functionName: 'bootstrapAllocate',
            args: [amount],
          }),
      });
      return runner.run(
        'bootstrapAllocate',
        steps,
        'Bootstrap allocate done. Prefer the RelayerNode allocate path in the keeper.',
      );
    },
    [runner, writeContractAsync],
  );

  /**
   * harvestClear → encrypt 100% into reserve → setPrizePerDraw to prizeShareBps only.
   * Mirrors the keeper RelayerNode path (browser uses RelayerWeb; keeper uses RelayerNode).
   */
  const harvestAndFundPrize = useCallback(() => {
    if (!publicClient) throw new Error('RPC client not ready.');
    return runner.run(
      'fundYieldPrize',
      [
        {
          label: 'Harvesting clear yield',
          run: async (report) => {
            const owner = requireAddress();
            const before = (await publicClient.readContract({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [owner],
            })) as bigint;

            const harvestHash = await writeContractAsync({
              address: VAULT_ADDRESS,
              abi: VAULT_YIELD_ABI,
              chainId: sepolia.id,
              functionName: 'harvestClear',
            });
            await publicClient.waitForTransactionReceipt({ hash: harvestHash });

            const after = (await publicClient.readContract({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              functionName: 'balanceOf',
              args: [owner],
            })) as bigint;
            const harvested = after > before ? after - before : 0n;
            if (harvested === 0n) throw new Error('No clear yield harvested.');

            const reserveConf = harvested / WRAP_RATE;
            if (reserveConf === 0n) throw new Error('Harvested below one confidential unit.');
            const wrapAmount = reserveConf * WRAP_RATE;

            const prizeShareBps = Number(
              await publicClient.readContract({
                address: VAULT_ADDRESS,
                abi: VAULT_YIELD_ABI,
                functionName: 'prizeShareBps',
              }),
            );
            const prizeConf = (reserveConf * BigInt(prizeShareBps)) / 10_000n;
            if (prizeConf === 0n) throw new Error('Prize-per-draw rounds to zero.');

            report('Wrapping full harvest');
            const a2 = await writeContractAsync({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              chainId: sepolia.id,
              functionName: 'approve',
              args: [CUSDC_MOCK_ADDRESS, wrapAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: a2 });
            const w1 = await writeContractAsync({
              address: CUSDC_MOCK_ADDRESS,
              abi: ERC7984_WRAPPER_ABI,
              chainId: sepolia.id,
              functionName: 'wrap',
              args: [owner, wrapAmount],
            });
            await publicClient.waitForTransactionReceipt({ hash: w1 });

            report('Encrypting 100% into prize reserve');
            const encReserve = await encryptAmount(CUSDC_MOCK_ADDRESS, reserveConf);
            const f1 = await writeContractAsync({
              address: CUSDC_MOCK_ADDRESS,
              abi: ERC7984_WRAPPER_ABI,
              chainId: sepolia.id,
              functionName: 'confidentialTransferAndCall',
              args: [
                VAULT_ADDRESS,
                encReserve.handle,
                encReserve.inputProof,
                encodeAbiParameters([{ type: 'bytes32' }], [RESERVE_DEPOSIT_TAG]),
              ],
            });
            await publicClient.waitForTransactionReceipt({ hash: f1 });

            report('Encrypting prize per draw (prizeShareBps only)');
            const encPrize = await encryptAmount(VAULT_ADDRESS, prizeConf);
            return writeContractAsync({
              address: VAULT_ADDRESS,
              abi: VAULT_ABI,
              chainId: sepolia.id,
              functionName: 'setPrizePerDraw',
              args: [encPrize.handle, encPrize.inputProof],
            });
          },
        },
      ],
      'Harvest encrypted into reserve; prize-per-draw set to prizeShareBps only.',
    );
  }, [runner, writeContractAsync, publicClient, encryptAmount, requireAddress]);

  /** Push clear underlying into MockYield4626 as simulated APR drip (admin/demo). */
  const accrueYield = useCallback(
    (underlyingHuman: string, needsApproval: boolean) => {
      const amount = parseUnits(underlyingHuman.trim(), UNDERLYING_DECIMALS);
      const steps: TxStep[] = [];
      if (needsApproval) {
        steps.push({
          label: 'Approving MockYield4626',
          run: () =>
            writeContractAsync({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              chainId: sepolia.id,
              functionName: 'approve',
              args: [YIELD_VAULT_ADDRESS, amount],
            }),
        });
      }
      steps.push({
        label: 'Accruing mock yield',
        run: () =>
          writeContractAsync({
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'accrue',
            args: [amount],
          }),
      });
      return runner.run('accrueYield', steps, 'Share price rose — harvest when ready.');
    },
    [runner, writeContractAsync],
  );

  /** Direct deposit of USDC Mock into MockYield4626 (sanity check the 4626 alone). */
  const yieldDeposit = useCallback(
    (underlyingHuman: string, needsApproval: boolean) => {
      const amount = parseUnits(underlyingHuman.trim(), UNDERLYING_DECIMALS);
      const steps: TxStep[] = [];
      if (needsApproval) {
        steps.push({
          label: 'Approving MockYield4626',
          run: () =>
            writeContractAsync({
              address: USDC_MOCK_ADDRESS,
              abi: ERC20_ABI,
              chainId: sepolia.id,
              functionName: 'approve',
              args: [YIELD_VAULT_ADDRESS, amount],
            }),
        });
      }
      steps.push({
        label: 'Depositing into MockYield4626',
        run: () =>
          writeContractAsync({
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'deposit',
            args: [amount, requireAddress()],
          }),
      });
      return runner.run('yieldDeposit', steps, 'Deposited into the mock yield vault.');
    },
    [runner, writeContractAsync, requireAddress],
  );

  return {
    ...runner,
    mintFaucet,
    wrap,
    deposit,
    withdraw,
    claim,
    setPrizePerDraw,
    fundReserve,
    triggerDraw,
    requestReveal,
    requestPublicTvlReveal,
    setMinDrawsBeforePublicReveal,
    setMinDepositsBeforePublicTvlReveal,
    bootstrapAllocate,
    harvestAndFundPrize,
    accrueYield,
    yieldDeposit,
  };
}
