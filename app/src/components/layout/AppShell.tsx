import { useEffect, useState, type ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  Cancel01Icon,
  ChartIncreaseIcon,
  DiceIcon,
  GiftIcon,
  Menu01Icon,
  SafeIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { BrandMark } from '@/components/Brand';
import { NetworkBanner } from '@/components/layout/NetworkBanner';
import { useIsAdmin, usePoolStats } from '@/hooks/usePoolData';
import { useNextOpenRemaining } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: IconSvgElement; end?: boolean; hint: string };

const NAV: NavItem[] = [
  { to: '/app', label: 'Pool', icon: SafeIcon, end: true, hint: 'Deposit and withdraw' },
  { to: '/app/draws', label: 'Draws', icon: DiceIcon, hint: 'Next draw and claims' },
  { to: '/app/history', label: 'History', icon: Analytics01Icon, hint: 'Global + yours' },
  { to: '/app/metrics', label: 'Metrics', icon: ChartIncreaseIcon, hint: 'Public TVL and prizes' },
];

const YIELD_ITEM: NavItem = {
  to: '/app/yield',
  label: 'Yield',
  icon: GiftIcon,
  hint: 'Mock APR and harvest',
};

const ADMIN_ITEM: NavItem = {
  to: '/app/admin',
  label: 'Admin',
  icon: Settings02Icon,
  hint: 'Reserve and draws',
};

export function AppShell({ children }: { children: ReactNode }) {
  const isAdmin = useIsAdmin();
  const { pathname } = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const items = [...NAV, YIELD_ITEM, ...(isAdmin ? [ADMIN_ITEM] : [])];

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [drawerOpen]);

  return (
    <div className="app-shell app-scope flex min-h-[100dvh] flex-col lg:h-[100dvh] lg:overflow-hidden">
      <header className="app-shell-chrome glass-stroke hidden shrink-0 lg:flex">
        <BrandLink />
        <div className="app-shell-chrome-actions relative z-[1] flex items-center gap-3">
          <DrawPill />
          <ConnectButton
            accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
            chainStatus="icon"
            showBalance={false}
          />
        </div>
      </header>

      {drawerOpen ? (
        <>
          <button
            type="button"
            className="app-shell-drawer-backdrop fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="app-shell-drawer glass-stroke lg:hidden" aria-modal="true" role="dialog">
            <SidebarNav
              items={items}
              showBrand
              showClose
              onClose={() => setDrawerOpen(false)}
              onNavigate={() => setDrawerOpen(false)}
            />
          </aside>
        </>
      ) : null}

      <div className="app-shell-body flex min-h-0 min-w-0 flex-1 flex-col lg:flex-row lg:gap-3">
        <aside className="app-shell-sidebar glass-stroke hidden lg:flex">
          <SidebarNav items={items} showBrand={false} />
        </aside>

        <div className="app-shell-main flex min-w-0 flex-1 flex-col lg:min-h-0 lg:overflow-hidden">
          <header className="app-shell-header sticky top-0 z-[100] flex shrink-0 items-center gap-2 border-b border-[var(--color-border-light)] bg-[var(--glass-strong)]/90 px-3 py-3 shadow-separator-inset backdrop-blur-md sm:px-4 lg:hidden">
            <button
              type="button"
              className="btn-secondary shrink-0 rounded-full p-2"
              onClick={() => setDrawerOpen((open) => !open)}
              aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={drawerOpen}
            >
              <HugeiconsIcon icon={drawerOpen ? Cancel01Icon : Menu01Icon} size={22} />
            </button>
            <BrandLink compact className="min-w-0" />
            <div className="ml-auto flex min-w-0 items-center gap-2">
              <DrawPill compact />
              <ConnectButton
                accountStatus="avatar"
                chainStatus="icon"
                showBalance={false}
              />
            </div>
          </header>

          <main className="flex-1 overflow-x-clip lg:overflow-y-auto">
            <div className="app-shell-content">
              <NetworkBanner />
              <div key={pathname} className="section-reveal">
                {children}
              </div>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function BrandLink({
  onClick,
  className,
  compact = false,
}: {
  onClick?: () => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="ConfiPool home"
      className={cn('app-shell-brand-link', className)}
    >
      <BrandMark size={compact ? 28 : 30} />
      <span className={cn('min-w-0', compact && 'max-[380px]:hidden')}>
        <span className="block text-[17px] leading-tight font-bold tracking-[-0.02em] text-ink">
          ConfiPool
        </span>
        {!compact ? (
          <span className="block text-[11px] leading-tight text-hint">Confidential prize vault</span>
        ) : null}
      </span>
    </Link>
  );
}

function SidebarNav({
  items,
  onNavigate,
  showClose,
  onClose,
  showBrand = true,
}: {
  items: NavItem[];
  onNavigate?: () => void;
  showClose?: boolean;
  onClose?: () => void;
  showBrand?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showBrand ? (
        <div className="app-shell-sidebar-brand flex shrink-0 items-center justify-between gap-2 border-b border-[var(--color-border-light)] px-4 py-4 shadow-separator-inset">
          <BrandLink onClick={onNavigate} />
          {showClose ? (
            <button
              type="button"
              className="btn-secondary shrink-0 rounded-full p-2"
              onClick={onClose}
              aria-label="Close menu"
            >
              <HugeiconsIcon icon={Cancel01Icon} size={20} />
            </button>
          ) : null}
        </div>
      ) : null}

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto p-3"
      >
        {items.map((item) => (
          <RailLink key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="shrink-0 p-3 pt-0">
        <NoLossNote />
      </div>
    </div>
  );
}

function RailLink({ item, onNavigate }: { item: NavItem; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn('app-shell-nav-link', isActive && 'app-shell-nav-link--active')
      }
    >
      {({ isActive }) => (
        <>
          <HugeiconsIcon icon={item.icon} size={20} aria-hidden className="shrink-0 opacity-90" />
          <span className="min-w-0">
            <span className="block text-[14px] leading-tight font-bold">{item.label}</span>
            <span
              className={cn(
                'block truncate text-[11.5px] leading-tight',
                isActive ? 'text-[var(--color-text-tertiary)]' : 'text-hint',
              )}
            >
              {item.hint}
            </span>
          </span>
        </>
      )}
    </NavLink>
  );
}

/** Header countdown toward the next permissionless openDraw. */
function DrawPill({ compact = false }: { compact?: boolean }) {
  const stats = usePoolStats();
  const { remaining, awaitingReveal } = useNextOpenRemaining(stats);

  if (!stats.tiersConfigured || stats.depositorCount === 0n) return null;

  const ready = !awaitingReveal && remaining <= 0;

  return (
    <span
      className={cn(
        'btn-secondary inline-flex items-center gap-2 rounded-full',
        compact ? 'h-9 px-2.5' : 'h-10 px-3',
      )}
    >
      <span className="relative grid size-2 place-items-center">
        <span
          className={cn(
            'absolute size-2 rounded-full',
            ready ? 'status-ping bg-accent' : 'bg-[rgba(0,0,0,0.25)]',
          )}
        />
        <span className={cn('size-2 rounded-full', ready ? 'bg-accent' : 'bg-[rgba(0,0,0,0.25)]')} />
      </span>
      <span className="numeral text-[12px] font-bold text-ink sm:text-[13px]">
        {awaitingReveal ? 'Reveal' : ready ? 'Ready' : formatCountdown(remaining)}
      </span>
      {!compact ? (
        <span className="text-[11px] font-bold text-hint max-xl:hidden">
          {`#${Number(stats.drawCount) + 1}`}
        </span>
      ) : null}
    </span>
  );
}

function NoLossNote() {
  return (
    <div className="glass-gold rounded-xl p-3.5">
      <div className="flex items-center gap-2 text-accent-deep">
        <HugeiconsIcon icon={GiftIcon} size={16} aria-hidden />
        <span className="text-[11px] font-bold tracking-[0.12em] uppercase">No loss</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-body">
        Your principal is withdrawable at any time. Only the yield is ever at stake.
      </p>
    </div>
  );
}
