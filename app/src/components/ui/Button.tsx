import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Variant = 'primary' | 'accent' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md' | 'lg';

/**
 * `primary` is the black gradient and carries almost every action. `accent` is
 * the butter-yellow fill, reserved for the prize-facing moments so the yellow
 * keeps its meaning instead of coating the whole product.
 */
const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn-ink',
  accent: 'btn-butter',
  secondary: 'btn-secondary',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
};

const SIZE_CLASS: Record<Size, string> = {
  sm: 'min-h-[30px] gap-1.5 px-3 py-1 text-[12px]',
  md: 'min-h-[37px] gap-2 px-3.5 py-1.5 text-[14px]',
  lg: 'min-h-[44px] gap-2 px-5 py-2 text-[15px]',
};

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  fullWidth?: boolean;
  /** Pills read better in nav chrome; panels use the default rounded rect. */
  pill?: boolean;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  fullWidth = false,
  pill = false,
  className,
  disabled,
  children,
  ...rest
}: Props) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'inline-flex min-w-0 items-center justify-center font-semibold whitespace-nowrap',
        'transition-[opacity,transform] duration-[var(--dur)] active:scale-[0.98]',
        'disabled:pointer-events-none disabled:opacity-50',
        pill ? 'rounded-full' : 'rounded-lg',
        VARIANT_CLASS[variant],
        SIZE_CLASS[size],
        fullWidth && 'w-full',
        className,
      )}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'spin-loop inline-block size-4 shrink-0 rounded-full border-2 border-current border-t-transparent opacity-70',
        className,
      )}
    />
  );
}
