import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  CheckmarkCircle02Icon,
  Coins01Icon,
  ShieldEnergyIcon,
} from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { AmountField } from '@/components/ui/AmountField';
import { Badge } from '@/components/ui/Badge';
import { validateConfidentialInput } from '@/lib/errors';
import {
  confidentialToUnderlying,
  formatUnderlying,
  isPositiveAmount,
  parseConfidential,
  underlyingToConfidential,
} from '@/lib/format';
import { CONFIDENTIAL_SYMBOL, UNDERLYING_SYMBOL } from '@/lib/contracts';
import { FAUCET_AMOUNT } from '@/hooks/useConfiPoolActions';
import { cn } from '@/lib/utils';

type Props = {
  underlyingBalance: bigint;
  allowance: bigint;
  /** Any flow is running, so inputs lock. Does not drive the spinners. */
  busy: boolean;
  minting: boolean;
  wrapping: boolean;
  onMint: () => Promise<boolean>;
  onWrap: (amount: bigint, needsApproval: boolean) => Promise<boolean>;
  onDone: () => void;
};

/**
 * Step one of the deposit path: get the public test token, then wrap it into the
 * ERC-7984 confidential token the pool actually custodies.
 */
export function FundingCard({
  underlyingBalance,
  allowance,
  busy,
  minting,
  wrapping,
  onMint,
  onWrap,
  onDone,
}: Props) {
  const [amount, setAmount] = useState('');

  const validation = amount ? validateConfidentialInput(amount) : null;
  const parsed = isPositiveAmount(amount) ? parseConfidential(amount) : 0n;
  const requiredUnderlying = confidentialToUnderlying(parsed);
  const insufficient = parsed > 0n && requiredUnderlying > underlyingBalance;
  const needsApproval = requiredUnderlying > allowance;

  const wrappable = underlyingToConfidential(underlyingBalance);
  const hasTokens = underlyingBalance > 0n;

  const error = validation ?? (insufficient ? `You only hold ${formatUnderlying(underlyingBalance)} ${UNDERLYING_SYMBOL}.` : null);

  return (
    <Card>
      <CardHeader
        title="Get pool-ready tokens"
        description="The pool holds cUSDC, the confidential ERC-7984 wrapper. Mint the public test USDC, then wrap it."
        action={
          hasTokens ? (
            <Badge tone="success">
              <HugeiconsIcon icon={CheckmarkCircle02Icon} size={13} aria-hidden />
              Funded
            </Badge>
          ) : (
            <Badge tone="warning">Start here</Badge>
          )
        }
      />

      <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
        <TokenTile
          icon={<HugeiconsIcon icon={Coins01Icon} size={18} aria-hidden />}
          label={`${UNDERLYING_SYMBOL} · public`}
          value={`${formatUnderlying(underlyingBalance)}`}
          hint="Visible to everyone"
        />
        <HugeiconsIcon
          icon={ArrowRight01Icon}
          size={20}
          aria-hidden
          className="mx-auto hidden text-hint sm:block"
        />
        <TokenTile
          icon={<HugeiconsIcon icon={ShieldEnergyIcon} size={18} aria-hidden />}
          label={`${CONFIDENTIAL_SYMBOL} · confidential`}
          value="encrypted"
          hint="Only you can read it"
          accent
        />
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-hairline pt-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.84rem] text-muted">
            Need test tokens? The faucet mints{' '}
            <span className="font-semibold text-ink">
              {formatUnderlying(FAUCET_AMOUNT)} {UNDERLYING_SYMBOL}
            </span>{' '}
            to your wallet.
          </p>
          <Button
            variant={hasTokens ? 'secondary' : 'primary'}
            size="sm"
            loading={minting}
            disabled={busy}
            onClick={async () => {
              if (await onMint()) onDone();
            }}
          >
            Use faucet
          </Button>
        </div>

        <AmountField
          label="Wrap into cUSDC"
          value={amount}
          onChange={setAmount}
          symbol={CONFIDENTIAL_SYMBOL}
          error={error}
          disabled={busy || !hasTokens}
          hint={`Wrappable: ${formatUnderlying(confidentialToUnderlying(wrappable))} ${UNDERLYING_SYMBOL}`}
          onMax={hasTokens ? () => setAmount(formatWrapMax(wrappable)) : undefined}
        />

        <Button
          fullWidth
          loading={wrapping}
          disabled={busy || !hasTokens || parsed === 0n || Boolean(error)}
          onClick={async () => {
            if (await onWrap(parsed, needsApproval)) {
              setAmount('');
              onDone();
            }
          }}
        >
          {needsApproval && parsed > 0n ? 'Approve and wrap' : 'Wrap'}
        </Button>

        <p className="text-[0.76rem] leading-relaxed text-hint">
          Wrapping is a public ERC-20 action, so the amount you wrap is visible. Everything after
          the wrap — your deposit, your pool balance, your winnings — is encrypted.
        </p>
      </div>
    </Card>
  );
}

/** Confidential units are 6-decimal, so print the exact wrappable figure without grouping. */
function formatWrapMax(amount: bigint): string {
  const whole = amount / 1_000_000n;
  const fraction = amount % 1_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`;
}

function TokenTile({
  icon,
  label,
  value,
  hint,
  accent = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  hint: string;
  accent?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-4 py-3 shadow-separator-inset',
        accent
          ? 'border-[rgba(230,184,0,0.45)] bg-[color-mix(in_srgb,var(--brand-yellow-500)_10%,#fff)]'
          : 'border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--background)_55%,#fff)]',
      )}
    >
      <div className="flex items-center gap-2 text-[0.74rem] font-semibold text-muted">
        {icon}
        {label}
      </div>
      <p className="numeral mt-1.5 truncate text-[1.15rem] font-bold">{value}</p>
      <p className="text-[0.72rem] text-hint">{hint}</p>
    </div>
  );
}
