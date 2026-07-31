import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Download01Icon, SquareLock02Icon, Upload01Icon } from '@hugeicons/core-free-icons';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { AmountField } from '@/components/ui/AmountField';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { validateConfidentialInput } from '@/lib/errors';
import { formatConfidential, formatCountdown, isPositiveAmount, parseConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';
import type { PrivateView } from '@/hooks/usePrivateView';
import { useCountdown } from '@/hooks/useCountdown';
import { cn } from '@/lib/utils';

type Mode = 'deposit' | 'withdraw';

type Props = {
  /** Any flow is running, so inputs lock. Does not drive the spinner. */
  busy: boolean;
  depositing: boolean;
  withdrawing: boolean;
  view: PrivateView;
  /** Clear cUSDC wallet balance, or null while still encrypted to the viewer. */
  walletBalance: bigint | null;
  /** Clear vault principal, or null while still encrypted to the viewer. */
  vaultBalance: bigint | null;
  decrypting: boolean;
  isDepositor: boolean;
  /** True while the onchain deposit batch accepts new principal. */
  depositsOpen: boolean;
  /** Unix seconds when the current deposit window closes (0 = idle / waiting for first deposit). */
  depositWindowClosesAt: bigint;
  onDeposit: (amount: bigint) => Promise<boolean>;
  onWithdraw: (amount: bigint) => Promise<boolean>;
  onDone: () => void;
};

export function DepositWithdrawCard({
  busy,
  depositing,
  withdrawing,
  view,
  walletBalance,
  vaultBalance,
  decrypting,
  isDepositor,
  depositsOpen,
  depositWindowClosesAt,
  onDeposit,
  onWithdraw,
  onDone,
}: Props) {
  const [mode, setMode] = useState<Mode>('deposit');
  const [amount, setAmount] = useState('');
  const windowRemaining = useCountdown(depositWindowClosesAt);

  const isDeposit = mode === 'deposit';
  const available = isDeposit ? walletBalance : vaultBalance;
  const depositBlocked = isDeposit && !depositsOpen;

  const validation = amount ? validateConfidentialInput(amount) : null;
  const parsed = isPositiveAmount(amount) ? parseConfidential(amount) : 0n;
  const overAvailable = available !== null && parsed > available;
  const error =
    validation ??
    (depositBlocked
      ? 'Deposit window is closed for this batch. Wait for the next bus after the draw.'
      : overAvailable
        ? isDeposit
          ? 'That is more cUSDC than you hold. Wrap more first.'
          : 'That is more than your pool principal.'
        : null);

  const switchMode = (next: Mode) => {
    setMode(next);
    setAmount('');
  };

  return (
    <Card>
      <div
        role="tablist"
        aria-label="Pool actions"
        className="flex gap-1 rounded-full border border-strong bg-surface p-1"
      >
        <TabButton
          active={isDeposit}
          onClick={() => switchMode('deposit')}
          icon={Download01Icon}
          label="Deposit"
        />
        <TabButton
          active={!isDeposit}
          onClick={() => switchMode('withdraw')}
          icon={Upload01Icon}
          label="Withdraw"
        />
      </div>

      {isDeposit ? (
        <p className="mt-4 rounded-2xl border border-hairline bg-surface px-3.5 py-2.5 text-[0.78rem] leading-relaxed text-muted">
          {depositWindowClosesAt === 0n ? (
            <>
              Deposit window idle. The <span className="font-semibold text-ink">first deposit</span> opens
              a timed batch bus for everyone else.
            </>
          ) : depositsOpen ? (
            <>
              Deposit bus open — closes in{' '}
              <span className="numeral font-semibold text-ink">{formatCountdown(windowRemaining)}</span>.
              After it closes the keeper parks the aggregate in MockYield, then the draw runs.
            </>
          ) : (
            <>
              Deposit window closed for this batch. New deposits open again after the draw.
            </>
          )}
        </p>
      ) : null}

      <div className="mt-5">
        <AmountField
          label={isDeposit ? 'Amount to deposit' : 'Amount to withdraw'}
          value={amount}
          onChange={setAmount}
          symbol={CONFIDENTIAL_SYMBOL}
          error={error}
          disabled={busy || depositBlocked || (!isDeposit && !isDepositor)}
          hint={
            <span className="inline-flex items-center gap-1">
              {isDeposit ? 'Wallet:' : 'In pool:'}
              {available === null ? (
                // Decrypting here rather than sending the reader back to the
                // sidebar: you cannot size a deposit against a hidden balance.
                <button
                  type="button"
                  onClick={() => void view.toggle()}
                  disabled={view.granting || view.decrypting}
                  className="inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 font-semibold text-ink underline decoration-dotted underline-offset-2 transition-colors hover:bg-[color-mix(in_srgb,var(--background)_70%,#fff)] disabled:opacity-60"
                >
                  <HugeiconsIcon icon={SquareLock02Icon} size={12} aria-hidden />
                  {view.granting || view.decrypting ? 'decrypting…' : 'hidden — decrypt'}
                </button>
              ) : (
                <span className="numeral font-semibold text-ink">
                  {formatConfidential(available)}
                </span>
              )}
            </span>
          }
          onMax={
            available !== null && available > 0n
              ? () => setAmount(exactAmount(available))
              : undefined
          }
        />
      </div>

      <div className="mt-4 note-block">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8rem] font-semibold text-muted">
            {isDeposit ? 'Pool principal after' : 'Pool principal after'}
          </span>
          <ConfidentialAmount
            size="sm"
            decrypting={decrypting}
            value={
              vaultBalance === null
                ? null
                : isDeposit
                  ? vaultBalance + parsed
                  : vaultBalance - (parsed > vaultBalance ? vaultBalance : parsed)
            }
          />
        </div>
      </div>

      <Button
        className="mt-4"
        fullWidth
        loading={isDeposit ? depositing : withdrawing}
        disabled={
          busy ||
          parsed === 0n ||
          Boolean(error) ||
          depositBlocked ||
          (!isDeposit && !isDepositor)
        }
        onClick={async () => {
          const ok = isDeposit ? await onDeposit(parsed) : await onWithdraw(parsed);
          if (ok) {
            setAmount('');
            onDone();
          }
        }}
      >
        {isDeposit
          ? depositBlocked
            ? 'Deposits closed'
            : 'Deposit privately'
          : 'Withdraw principal'}
      </Button>

      <p className="mt-3 text-[0.76rem] leading-relaxed text-hint">
        {isDeposit
          ? 'Your amount is encrypted in the browser before it leaves. Onchain, observers see that you deposited — never how much.'
          : 'Principal is withdrawable at any time with no lock and no penalty. Winnings are claimed separately on the Draws page.'}
      </p>
    </Card>
  );
}

/** Prints an exact 6-decimal amount for MAX, avoiding the grouped display format. */
function exactAmount(value: bigint): string {
  const whole = value / 1_000_000n;
  const fraction = value % 1_000_000n;
  if (fraction === 0n) return whole.toString();
  return `${whole}.${fraction.toString().padStart(6, '0').replace(/0+$/, '')}`;
}

function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: Parameters<typeof HugeiconsIcon>[0]['icon'];
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center gap-2 rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors',
        active
          ? 'btn-ink'
          : 'text-muted hover:text-ink',
      )}
    >
      <HugeiconsIcon icon={icon} size={16} aria-hidden />
      {label}
    </button>
  );
}
