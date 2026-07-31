import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'ink' | 'success' | 'warning' | 'danger';

const TONE_CLASS: Record<Tone, string> = {
  neutral: 'border-[rgba(0,0,0,0.08)] bg-[color-mix(in_srgb,var(--background)_70%,#fff)] text-hint',
  accent: 'border-[rgba(230,184,0,0.5)] bg-accent text-black',
  ink: 'border-transparent bg-ink text-white',
  success: 'border-[rgba(10,148,41,0.22)] bg-positive-bg text-positive',
  warning: 'border-[rgba(180,83,9,0.24)] bg-caution-bg text-caution',
  danger: 'border-[rgba(221,50,50,0.22)] bg-negative-bg text-negative',
};

export function Badge({
  children,
  tone = 'neutral',
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1',
        'text-[11px] font-bold tracking-[0.04em] uppercase',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
