import { cn } from '@/lib/utils';

/** Butter-yellow disc carrying the ConfiPool initial, matching the ConfiDrop mark. */
export function BrandMark({
  size = 32,
  className,
  onDark = false,
}: {
  size?: number;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span
      aria-hidden
      className={cn('brand-mark', onDark && 'brand-mark--dark', className)}
      style={{ height: size, width: size, fontSize: size * 0.44 }}
    >
      C
    </span>
  );
}

export function BrandLockup({
  size = 32,
  className,
  onDark = false,
}: {
  size?: number;
  className?: string;
  onDark?: boolean;
}) {
  return (
    <span className={cn('landing-brand', className)}>
      <BrandMark size={size} onDark={onDark} />
      <span className={cn('text-[1rem] font-bold', onDark ? 'text-white' : 'text-ink')}>
        ConfiPool
      </span>
    </span>
  );
}
