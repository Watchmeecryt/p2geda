import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { cn } from '@/lib/utils';

type Props = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  /** Blocks backdrop and Escape dismissal while a transaction is in flight. */
  dismissible?: boolean;
};

const SIZE_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
} as const;

export function Modal({
  open,
  onClose,
  title,
  description,
  icon,
  children,
  footer,
  size = 'md',
  dismissible = true,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissible) onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, dismissible]);

  if (!open) return null;

  return createPortal(
    <div
      className="overlay"
      role="presentation"
      onClick={() => {
        if (dismissible) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        onClick={(event) => event.stopPropagation()}
        className={cn('dialog glass-solid w-full overflow-hidden', SIZE_CLASS[size])}
      >
        <div className="flex items-start gap-3.5 border-b border-[var(--color-border-light)] px-5 py-4">
          {icon ? (
            <div className="icon-tile size-10">
              {icon}
            </div>
          ) : null}
          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] leading-tight font-semibold text-ink">{title}</h2>
            {description ? (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-body">{description}</p>
            ) : null}
          </div>
          {dismissible ? (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="btn-secondary -mt-0.5 -mr-1 grid size-8 shrink-0 place-items-center rounded-full transition-opacity hover:opacity-80"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={16} />
            </button>
          ) : null}
        </div>

        {children ? <div className="px-5 py-5">{children}</div> : null}
        {footer ? (
          <div className="flex flex-col gap-2 border-t border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--background)_55%,#fff)] px-5 py-4 shadow-separator-inset sm:flex-row">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
