import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  symbol: string;
  hint?: ReactNode;
  error?: string | null;
  disabled?: boolean;
  onMax?: () => void;
  id?: string;
};

export function AmountField({
  label,
  value,
  onChange,
  placeholder = '0.00',
  symbol,
  hint,
  error,
  disabled,
  onMax,
  id,
}: Props) {
  const inputId = id ?? `amount-${label.toLowerCase().replace(/\s+/g, '-')}`;

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={inputId} className="text-[13px] font-semibold text-body">
          {label}
        </label>
        {hint ? <span className="text-[12px] text-hint">{hint}</span> : null}
      </div>

      <div
        className={cn(
          'field-input mt-2 flex items-center gap-2',
          error && 'shadow-[0_0_0_1px_rgba(221,50,50,0.55)]',
          disabled && 'opacity-60',
        )}
      >
        <input
          id={inputId}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d.]/g, ''))}
          className="numeral min-w-0 flex-1 bg-transparent text-[22px] font-bold outline-none placeholder:font-medium placeholder:text-hint"
        />
        {onMax ? (
          <button
            type="button"
            onClick={onMax}
            disabled={disabled}
            className="btn-secondary rounded-full px-2 py-0.5 text-[11px] font-bold tracking-[0.06em] uppercase transition-opacity hover:opacity-80"
          >
            Max
          </button>
        ) : null}
        <span className="shrink-0 text-[13px] font-semibold text-hint">{symbol}</span>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 text-[12.5px] font-semibold text-negative">
          {error}
        </p>
      ) : null}
    </div>
  );
}
