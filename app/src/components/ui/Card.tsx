import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  children: ReactNode;
  className?: string;
  /**
   * `glass` is the translucent blurred panel, `solid` the opaque variant for
   * dense content, `panel` the recessed tray, `accent` the gold-tinted card.
   */
  tone?: 'glass' | 'solid' | 'panel' | 'accent';
  /** Drops the default padding so tables and lists can bleed to the edges. */
  flush?: boolean;
};

const TONE_CLASS = {
  glass: 'glass-card',
  solid: 'glass-solid',
  panel: 'tray',
  accent: 'glass-gold',
} as const;

export function Card({ children, className, tone = 'glass', flush = false }: Props) {
  return (
    <div
      className={cn(
        'rounded-xl',
        TONE_CLASS[tone],
        flush ? 'overflow-hidden' : 'p-5',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex items-start justify-between gap-4', className)}>
      <div className="min-w-0">
        <h3 className="text-[17px] leading-tight font-semibold text-ink">{title}</h3>
        {description ? (
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{description}</p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

/** Section divider inside a flush card: hairline plus the white inset highlight. */
export function CardSection({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'border-b border-[var(--color-border-light)] px-5 py-4 shadow-separator-inset last:border-b-0',
        className,
      )}
    >
      {children}
    </div>
  );
}
