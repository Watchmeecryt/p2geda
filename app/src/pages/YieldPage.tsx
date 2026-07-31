import { useMemo, useState } from 'react';
import { useAccount, useReadContracts } from 'wagmi';
import { sepolia } from 'viem/chains';
import { parseUnits } from 'viem';
import { HugeiconsIcon } from '@hugeicons/react';
import { Analytics01Icon, MoneyBag02Icon, SafeIcon } from '@hugeicons/core-free-icons';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { AmountField } from '@/components/ui/AmountField';
import { useConfiPoolActions } from '@/hooks/useConfiPoolActions';
import { useIsAdmin } from '@/hooks/usePoolData';
import {
  ERC20_ABI,
  UNDERLYING_DECIMALS,
  UNDERLYING_SYMBOL,
  VAULT_ADDRESS,
  VAULT_YIELD_ABI,
  YIELD_VAULT_ABI,
  YIELD_VAULT_ADDRESS,
  YIELD_VAULT_CONFIGURED,
  USDC_MOCK_ADDRESS,
} from '@/lib/contracts';
import { DEMO_YIELD_EXPOSURES, TOKEN_ICONS } from '@/lib/tokenIcons';
import { ExposureStack } from '@/components/yield/ExposureStack';
import { explorerAddressUrl } from '@/lib/chains';
import { formatUnderlying, shortenAddress } from '@/lib/format';

export function YieldPage() {
  const { address, isConnected } = useAccount();
  const isAdmin = useIsAdmin();
  const actions = useConfiPoolActions();
  const [allocateInput, setAllocateInput] = useState('100');
  const [accrueInput, setAccrueInput] = useState('10');
  const [directInput, setDirectInput] = useState('10');

  /** OZ ERC-4626: share decimals = underlying decimals when decimalsOffset is 0. */
  const ONE_SHARE = 10n ** BigInt(UNDERLYING_DECIMALS);

  const { data, refetch } = useReadContracts({
    contracts: YIELD_VAULT_CONFIGURED
      ? [
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'aprBps',
          },
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'totalAssets',
          },
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'totalSupply',
          },
          {
            address: VAULT_ADDRESS,
            abi: VAULT_YIELD_ABI,
            chainId: sepolia.id,
            functionName: 'allocatedUnderlying',
          },
          {
            address: VAULT_ADDRESS,
            abi: VAULT_YIELD_ABI,
            chainId: sepolia.id,
            functionName: 'yieldVault',
          },
          {
            address: USDC_MOCK_ADDRESS,
            abi: ERC20_ABI,
            chainId: sepolia.id,
            functionName: 'balanceOf',
            args: address ? [address] : undefined,
          },
          {
            address: USDC_MOCK_ADDRESS,
            abi: ERC20_ABI,
            chainId: sepolia.id,
            functionName: 'allowance',
            args: address ? [address, VAULT_ADDRESS] : undefined,
          },
          {
            address: USDC_MOCK_ADDRESS,
            abi: ERC20_ABI,
            chainId: sepolia.id,
            functionName: 'allowance',
            args: address ? [address, YIELD_VAULT_ADDRESS] : undefined,
          },
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'balanceOf',
            args: address ? [address] : undefined,
          },
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'balanceOf',
            args: [VAULT_ADDRESS],
          },
          {
            address: YIELD_VAULT_ADDRESS,
            abi: YIELD_VAULT_ABI,
            chainId: sepolia.id,
            functionName: 'convertToAssets',
            args: [ONE_SHARE],
          },
        ]
      : [],
    query: { enabled: YIELD_VAULT_CONFIGURED, refetchInterval: 12_000 },
  });

  const readBig = (i: number): bigint =>
    data?.[i]?.status === 'success' ? (data[i].result as bigint) : 0n;
  const readAddr = (i: number): `0x${string}` | undefined =>
    data?.[i]?.status === 'success' ? (data[i].result as `0x${string}`) : undefined;

  const aprRaw = data?.[0]?.status === 'success' ? data[0].result : undefined;
  const aprBps = typeof aprRaw === 'number' ? aprRaw : aprRaw !== undefined ? Number(aprRaw) : undefined;
  const totalAssets = readBig(1);
  const totalSupply = readBig(2);
  const allocated = readBig(3);
  const wiredYield = readAddr(4);
  const walletBal = readBig(5);
  const vaultAllowance = readBig(6);
  const yieldAllowance = readBig(7);
  const myShares = readBig(8);
  const prizeShares = readBig(9);
  const assetsPerShare = readBig(10);

  const prizeAssets =
    totalSupply === 0n || prizeShares === 0n
      ? 0n
      : (totalAssets * prizeShares) / totalSupply;
  const surplus = prizeAssets > allocated ? prizeAssets - allocated : 0n;
  const aprPct = aprBps !== undefined ? (aprBps / 100).toFixed(2) : '—';

  const sharePriceLabel = useMemo(() => {
    // Dust supply (e.g. after redeem + accrue) makes assets/shares look like millions.
    // Treat less than one whole share as an empty vault → neutral 1.00.
    if (totalSupply < ONE_SHARE) return '1.00';
    return formatUnderlying(assetsPerShare, 6);
  }, [ONE_SHARE, assetsPerShare, totalSupply]);

  if (!YIELD_VAULT_CONFIGURED) {
    return (
      <div>
        <PageHeader
          kicker="Yield"
          title="ConfiPool Yield USDC"
          description="Park prize-vault capital in a Morpho-like ERC-4626, accrue a fake APR, then harvest surplus back into the encrypted prize reserve."
        />
        <Card className="mt-8">
          <h2 className="font-bold">Yield stack not wired yet</h2>
          <p className="mt-2 text-[0.88rem] leading-relaxed text-muted">
            Set <code className="font-mono text-[0.8rem]">VITE_YIELD_VAULT_ADDRESS</code> after
            running <code className="font-mono text-[0.8rem]">npm run deploy:yield:sepolia</code> in{' '}
            <code className="font-mono text-[0.8rem]">contracts/</code>, and point{' '}
            <code className="font-mono text-[0.8rem]">VITE_CONFIPOOL_VAULT_ADDRESS</code> at the new
            prize vault.
          </p>
        </Card>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div>
        <PageHeader kicker="Yield" title="ConfiPool Yield USDC" />
        <div className="mt-8">
          <ConnectPrompt
            title="Connect to inspect yield"
            description="Depositors enter on the Pool page. Admin allocate / harvest lives here."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="Yield"
        title="ConfiPool Yield USDC"
        description="Sepolia stand-in for a Morpho USDC vault. Depositors put in cUSDC only — exposure rows show where production Morpho would allocate that USDC."
        action={
          <a
            href={explorerAddressUrl(YIELD_VAULT_ADDRESS)}
            target="_blank"
            rel="noreferrer"
            className="text-[0.8rem] font-semibold text-accent-deep underline underline-offset-2"
          >
            {shortenAddress(YIELD_VAULT_ADDRESS)}
          </a>
        }
      />

      <div className="mt-8 grid gap-5">
        <Card className="p-0">
          <div className="relative overflow-hidden rounded-t-xl border-b border-[var(--color-border-light)] bg-[linear-gradient(135deg,#f7f7f7_0%,#fff8dc_48%,#ffffff_100%)] px-5 py-6 sm:px-6">
            <div className="flex flex-wrap items-start gap-4">
              <div className="relative shrink-0">
                <img
                  src={TOKEN_ICONS.morpho}
                  alt=""
                  className="size-14 rounded-2xl object-cover ring-1 ring-black/10"
                />
                <img
                  src={TOKEN_ICONS.usdc}
                  alt=""
                  className="absolute -right-1 -bottom-1 size-6 rounded-full ring-2 ring-white"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[1.35rem] leading-tight font-extrabold tracking-tight">
                    ConfiPool Yield USDC
                  </h2>
                  <Badge tone="success">ERC-4626</Badge>
                </div>
                <p className="mt-1.5 max-w-xl text-[0.86rem] leading-relaxed text-muted">
                  Morpho Steakhouse–style vault card. On Sepolia, capital sits in MockYield4626 over
                  USDC Mock; on mainnet the same prize vault points at Morpho.
                </p>
                <p className="mt-2 font-mono text-[0.72rem] text-hint">
                  {shortenAddress(YIELD_VAULT_ADDRESS)} · asset {UNDERLYING_SYMBOL}
                </p>
              </div>
              <div className="ml-auto flex flex-col items-end gap-3 text-right">
                <div>
                  <p className="label-pill">Net APR</p>
                  <p className="numeral mt-1 text-[2rem] leading-none font-extrabold tracking-tight">
                    {aprPct}%
                  </p>
                  <p className="mt-1 text-[0.72rem] text-hint">MockYield aprBps (demo)</p>
                </div>
                <ExposureStack allocatedUnderlying={allocated > 0n ? allocated : totalAssets} />
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-5 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            <Stat label="Total assets" value={formatUnderlying(totalAssets)} hint={UNDERLYING_SYMBOL} />
            <Stat
              label="Allocated principal"
              value={formatUnderlying(allocated)}
              hint="Tracked by prize vault"
            />
            <Stat
              label="Harvestable surplus"
              value={formatUnderlying(surplus)}
              hint={
                surplus > 0n
                  ? 'Accrued yield not yet harvested'
                  : '0 after harvest — next keeper accrue brings it back'
              }
            />
            <Stat
              label="Share price"
              value={sharePriceLabel}
              hint={`${UNDERLYING_SYMBOL} per share · vault ${formatShareAmount(prizeShares)} shares`}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-border-light)] px-5 py-3 sm:px-6">
            <Badge tone={wiredYield === YIELD_VAULT_ADDRESS ? 'success' : 'warning'}>
              {wiredYield === YIELD_VAULT_ADDRESS ? 'Prize vault linked' : 'Link mismatch'}
            </Badge>
            <span className="text-[0.78rem] text-muted">
              You hold {formatShareAmount(myShares)} shares
            </span>
            <span className="text-[0.72rem] text-hint">
              · Exposure stack is a Morpho-shaped preview ({DEMO_YIELD_EXPOSURES.map((e) => e.label).join(' / ')})
            </span>
          </div>
        </Card>

        {isAdmin ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <div className="flex items-start gap-3">
                <div className="icon-tile size-9">
                  <HugeiconsIcon icon={SafeIcon} size={17} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">1. Allocate (emergency bootstrap)</h3>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                    Preferred path: the keeper uses RelayerNode to public-decrypt aggregate TVL,
                    encrypt the unwrap, and{' '}
                    <code className="font-mono text-[0.8rem]">finalizeAllocate</code>. This button
                    is an emergency clear-fund bridge only.
                  </p>
                  <div className="mt-4">
                    <AmountField
                      label="Underlying to allocate"
                      value={allocateInput}
                      onChange={setAllocateInput}
                      symbol={UNDERLYING_SYMBOL}
                      hint={`Wallet ${formatUnderlying(walletBal)}`}
                      onMax={() => setAllocateInput(formatUnderlying(walletBal, 6))}
                      disabled={actions.isRunning}
                    />
                  </div>
                  <Button
                    className="mt-4"
                    fullWidth
                    variant="secondary"
                    loading={actions.activeAction === 'bootstrapAllocate'}
                    disabled={actions.isRunning}
                    onClick={async () => {
                      let amount: bigint;
                      try {
                        amount = parseUnits(allocateInput.trim(), UNDERLYING_DECIMALS);
                      } catch {
                        return;
                      }
                      const ok = await actions.bootstrapAllocate(
                        allocateInput,
                        vaultAllowance < amount,
                      );
                      if (ok) void refetch();
                    }}
                  >
                    Emergency bootstrap allocate
                  </Button>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex items-start gap-3">
                <div className="icon-tile size-9">
                  <HugeiconsIcon icon={Analytics01Icon} size={17} aria-hidden />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">2. Accrue → harvest → encrypt prize</h3>
                  <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                    Accrue raises clear share price. Harvest pulls clear yield, encrypts{' '}
                    <strong>100%</strong> into the prize reserve, then sets prize-per-draw to only{' '}
                    <code className="font-mono text-[0.8rem]">prizeShareBps</code> (default 80%).
                    The other ~20% stays encrypted in the reserve as padding. The keeper does the
                    same with RelayerNode.
                  </p>
                  <div className="mt-4">
                    <AmountField
                      label="Yield drip"
                      value={accrueInput}
                      onChange={setAccrueInput}
                      symbol={UNDERLYING_SYMBOL}
                      disabled={actions.isRunning}
                    />
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <Button
                      loading={actions.activeAction === 'accrueYield'}
                      disabled={actions.isRunning || allocated === 0n}
                      onClick={async () => {
                        let amount: bigint;
                        try {
                          amount = parseUnits(accrueInput.trim(), UNDERLYING_DECIMALS);
                        } catch {
                          return;
                        }
                        const ok = await actions.accrueYield(
                          accrueInput,
                          yieldAllowance < amount,
                        );
                        if (ok) void refetch();
                      }}
                    >
                      Accrue
                    </Button>
                    <Button
                      variant="secondary"
                      loading={actions.activeAction === 'fundYieldPrize'}
                      disabled={actions.isRunning || surplus === 0n}
                      onClick={async () => {
                        if (await actions.harvestAndFundPrize()) void refetch();
                      }}
                    >
                      Harvest + encrypt
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : (
          <Card>
            <p className="text-[0.88rem] leading-relaxed text-muted">
              Deposit confidentially on the Pool page. The admin wallet (same key as the keeper)
              allocates capital into this mock yield vault and harvests surplus into the prize
              reserve so draws can pay a winner.
            </p>
          </Card>
        )}

        <Card>
          <div className="flex items-start gap-3">
            <div className="icon-tile size-9">
              <HugeiconsIcon icon={MoneyBag02Icon} size={17} aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-bold">Optional: deposit into MockYield directly</h3>
              <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
                Sanity-check the ERC-4626 alone. Prize-pool capital normally enters via allocate,
                not this path.
              </p>
              <div className="mt-4">
                <AmountField
                  label="Deposit"
                  value={directInput}
                  onChange={setDirectInput}
                  symbol={UNDERLYING_SYMBOL}
                  hint={`Wallet ${formatUnderlying(walletBal)}`}
                  disabled={actions.isRunning}
                />
              </div>
              <Button
                className="mt-4"
                fullWidth
                loading={actions.activeAction === 'yieldDeposit'}
                disabled={actions.isRunning}
                onClick={async () => {
                  let amount: bigint;
                  try {
                    amount = parseUnits(directInput.trim(), UNDERLYING_DECIMALS);
                  } catch {
                    return;
                  }
                  const ok = await actions.yieldDeposit(directInput, yieldAllowance < amount);
                  if (ok) void refetch();
                }}
              >
                Deposit to MockYield
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

function formatShareAmount(shares: bigint): string {
  const oneShare = 10n ** BigInt(UNDERLYING_DECIMALS);
  if (shares === 0n) return '0';
  if (shares < oneShare / 100n) return '<0.01';
  return formatUnderlying(shares, 4);
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <p className="label-pill">{label}</p>
      <p className="numeral mt-2 text-[1.35rem] leading-tight font-bold">{value}</p>
      <p className="mt-1 text-[0.78rem] text-hint">{hint}</p>
    </div>
  );
}
