import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DEMO_YIELD_EXPOSURES } from '@/lib/tokenIcons';
import { formatUnderlying } from '@/lib/format';
import { cn } from '@/lib/utils';

type Props = {
  /** Clear USDC (6-dec) parked / allocated — used to size the demo $ rows. */
  allocatedUnderlying: bigint;
  className?: string;
};

type PanelPos = { top: number; left: number; openDown: boolean };

/**
 * Morpho-style exposure affordance: overlapping token icons; hover/focus opens a
 * compact breakdown via a portal so parent overflow / stacking never clips it.
 */
export function ExposureStack({ allocatedUnderlying, className }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<PanelPos | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const panelId = useId();
  const base =
    allocatedUnderlying > 0n
      ? allocatedUnderlying
      : 12_480n * 10n ** 6n; /* ~$12.4k placeholder so the popover never looks empty */

  const rows = DEMO_YIELD_EXPOSURES.map((row, index) => {
    const amount = (base * BigInt(row.pct)) / 100n;
    return { ...row, amount, active: index === 0 };
  });

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const show = () => {
    clearClose();
    setOpen(true);
  };

  const hideSoon = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  useEffect(() => () => clearClose(), []);

  const placePanel = () => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const panelWidth = Math.min(296, window.innerWidth - 16);
    const estimatedHeight = 280;
    const gap = 10;
    const spaceBelow = window.innerHeight - rect.bottom;
    const openDown = spaceBelow >= estimatedHeight || spaceBelow >= rect.top;
    let left = rect.right - panelWidth;
    left = Math.max(8, Math.min(left, window.innerWidth - panelWidth - 8));
    const top = openDown ? rect.bottom + gap : rect.top - gap - estimatedHeight;
    setPos({ top, left, openDown });
  };

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    placePanel();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => placePanel();
    window.addEventListener('scroll', onReposition, true);
    window.addEventListener('resize', onReposition);
    return () => {
      window.removeEventListener('scroll', onReposition, true);
      window.removeEventListener('resize', onReposition);
    };
  }, [open]);

  const panel =
    open && pos
      ? createPortal(
          <div
            id={panelId}
            role="region"
            aria-label="Yield exposures"
            className={cn(
              'fixed z-[9999] w-[min(18.5rem,calc(100vw-1rem))] rounded-2xl border border-white/10 bg-[#1a1a1a] p-2 text-white',
              'shadow-[0_18px_40px_rgba(0,0,0,0.35)]',
            )}
            style={{ top: pos.top, left: pos.left }}
            onMouseEnter={show}
            onMouseLeave={hideSoon}
          >
            <p className="px-2 pt-1 pb-2 text-[0.68rem] leading-snug text-white/55">
              Mainnet Steakhouse / Morpho shape. Sepolia capital joins the real Zama batch — staging
              yield is idle.
            </p>
            <ul className="grid gap-0.5">
              {rows.map((row) => (
                <li
                  key={row.id}
                  className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-white/[0.06]"
                >
                  <img
                    src={row.icon}
                    alt=""
                    className="size-6 rounded-full bg-white object-cover"
                  />
                  <div className="flex min-w-0 items-center gap-1.5">
                    <span className="truncate text-[0.84rem] font-semibold">{row.label}</span>
                    {row.badge ? (
                      <span className="shrink-0 rounded-full bg-white/12 px-1.5 py-0.5 text-[0.62rem] font-bold tracking-wide text-white/70 uppercase">
                        {row.badge}
                      </span>
                    ) : null}
                  </div>
                  <span className="numeral text-[0.84rem] font-bold tabular-nums">
                    ${formatUnderlying(row.amount, 2)}
                  </span>
                  <span
                    className={cn(
                      'size-2.5 rounded-full',
                      row.active ? 'bg-[#3b82f6]' : 'border border-white/25 bg-transparent',
                    )}
                    aria-hidden
                  />
                </li>
              ))}
            </ul>
          </div>,
          document.body,
        )
      : null;

  return (
    <div
      ref={rootRef}
      className={cn('relative inline-flex', open && 'z-50', className)}
      onMouseEnter={show}
      onMouseLeave={hideSoon}
      onFocus={show}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) hideSoon();
      }}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label="Show yield exposures"
        className="flex items-center rounded-full py-0.5 pr-1 pl-0.5 outline-none focus-visible:ring-2 focus-visible:ring-accent-ring"
      >
        <span className="flex items-center">
          {DEMO_YIELD_EXPOSURES.map((row, i) => (
            <img
              key={row.id}
              src={row.icon}
              alt=""
              className={cn(
                'relative size-7 rounded-full bg-white object-cover ring-2 ring-white',
                i > 0 && '-ml-2.5',
              )}
              style={{ zIndex: DEMO_YIELD_EXPOSURES.length - i }}
            />
          ))}
        </span>
        <span className="ml-2 text-[0.72rem] font-bold tracking-[0.04em] text-hint uppercase">
          Exposures
        </span>
      </button>
      {panel}
    </div>
  );
}
