import { HugeiconsIcon } from '@hugeicons/react';
import { SquareLock02Icon } from '@hugeicons/core-free-icons';
import { Skeleton } from '@/components/ui/Skeleton';
import { formatConfidential } from '@/lib/format';
import { CONFIDENTIAL_SYMBOL } from '@/lib/contracts';
import { cn } from '@/lib/utils';

type Props = {
  /** Clear amount, or null while the value is still encrypted to this viewer. */
  value: bigint | null;
  decrypting?: boolean;
  symbol?: string | false;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
};

const SIZE_CLASS = {
  sm: 'text-[15px]',
  md: 'text-[24px]',
  lg: 'text-[34px]',
} as const;

export function ConfidentialAmount({
  value,
  decrypting = false,
  symbol = CONFIDENTIAL_SYMBOL,
  className,
  size = 'md',
}: Props) {
  if (value === null && decrypting) {
    return <Skeleton className={cn('h-7 w-28', size === 'sm' && 'h-5 w-20', className)} />;
  }

  if (value === null) {
    return (
      <span
        className={cn(
          'masked-text inline-flex items-center gap-1.5 font-bold',
          SIZE_CLASS[size],
          className,
        )}
        title="Encrypted onchain. Only you can reveal it."
      >
        <HugeiconsIcon icon={SquareLock02Icon} size={size === 'sm' ? 14 : 18} aria-hidden />
        ••••••
      </span>
    );
  }

  return (
    <span className={cn('numeral font-bold text-ink', SIZE_CLASS[size], className)}>
      {formatConfidential(value)}
      {symbol ? <span className="ml-1.5 text-[0.58em] font-bold text-muted">{symbol}</span> : null}
    </span>
  );
}
