import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export function Stat({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-[0.12em] text-hint uppercase">
        {icon}
        {label}
      </div>
      <div className="numeral mt-2 truncate text-[24px] leading-tight font-bold text-ink">
        {value}
      </div>
      {hint ? <div className="mt-1 text-[12.5px] text-muted">{hint}</div> : null}
    </div>
  );
}
