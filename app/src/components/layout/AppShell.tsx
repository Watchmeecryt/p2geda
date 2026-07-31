import type { ReactNode } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  DiceIcon,
  GiftIcon,
  SafeIcon,
  Settings02Icon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
import { BrandMark } from '@/components/Brand';
import { NetworkBanner } from '@/components/layout/NetworkBanner';
import { useIsAdmin, usePoolStats } from '@/hooks/usePoolData';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown } from '@/lib/format';
import { cn } from '@/lib/utils';

type NavItem = { to: string; label: string; icon: IconSvgElement; end?: boolean; hint: string };

const NAV: NavItem[] = [
  { to: '/app', label: 'Pool', icon: SafeIcon, end: true, hint: 'Deposit and withdraw' },
  { to: '/app/draws', label: 'Draws', icon: DiceIcon, hint: 'Next draw and claims' },
  { to: '/app/history', label: 'History', icon: Analytics01Icon, hint: 'Your activity' },
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
  const items = [...NAV, YIELD_ITEM, ...(isAdmin ? [ADMIN_ITEM] : [])];

  return (
    <div className="app-scope min-h-dvh bg-[var(--background)]">
      <header className="glass-strong sticky top-0 z-40 border-b border-[var(--color-border-light)]">
        <div className="flex h-14 items-center gap-3 px-3 sm:h-16 sm:px-5">
          <Link to="/" aria-label="ConfiPool home" className="flex items-center gap-2.5">
            <BrandMark size={30} />
            <span className="text-[17px] font-bold tracking-[-0.02em] text-ink max-sm:hidden">
              ConfiPool
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2.5">
            <DrawPill />
            <ConnectButton
              accountStatus={{ smallScreen: 'avatar', largeScreen: 'address' }}
              chainStatus="icon"
              showBalance={false}
            />
          </div>
        </div>
      </header>

      <aside className="fixed top-16 bottom-0 left-0 z-30 hidden w-60 flex-col border-r border-[var(--color-border-light)] bg-[color-mix(in_srgb,var(--card-solid)_70%,transparent)] px-3 py-5 backdrop-blur-[16px] lg:flex">
        <nav aria-label="Main" className="flex flex-col gap-1">
          {items.map((item) => (
            <RailLink key={item.to} item={item} />
          ))}
        </nav>
        <NoLossNote />
      </aside>

      <main className="relative px-4 pt-6 pb-28 sm:px-6 lg:pb-12 lg:pl-64">
        <div className="mx-auto w-full max-w-6xl">
          <NetworkBanner />
          <div key={pathname} className="section-reveal">
            {children}
          </div>
        </div>
      </main>

      <nav
        aria-label="Main"
        className="glass-strong fixed inset-x-0 bottom-0 z-40 flex items-stretch justify-around border-t border-[var(--color-border-light)] px-2 pb-[env(safe-area-inset-bottom)] lg:hidden"
      >
        {items.map((item) => (
          <BottomLink key={item.to} item={item} />
        ))}
      </nav>
    </div>
  );
}

function RailLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all',
          isActive
            ? 'btn-ink border border-transparent'
            : 'border border-transparent text-body hover:bg-[color-mix(in_srgb,var(--card-solid)_88%,var(--background))] hover:text-ink hover:shadow-separator-inset',
        )
      }
    >
      {({ isActive }) => (
        <>
          <HugeiconsIcon icon={item.icon} size={18} aria-hidden className="shrink-0" />
          <span className="min-w-0">
            <span className="block text-[14px] leading-tight font-bold">{item.label}</span>
            <span
              className={cn(
                'block truncate text-[11.5px] leading-tight',
                isActive ? 'text-white/55' : 'text-hint',
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

function BottomLink({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-bold transition-colors',
          isActive ? 'text-ink' : 'text-hint',
        )
      }
    >
      <HugeiconsIcon icon={item.icon} size={19} aria-hidden />
      {item.label}
    </NavLink>
  );
}

/** Live countdown in the header so the next draw is never more than a glance away. */
function DrawPill() {
  const { nextDrawAt, drawsCompleted } = usePoolStats();
  const remaining = useCountdown(nextDrawAt);

  if (!nextDrawAt) return null;

  const ready = remaining <= 0;

  return (
    <span className="btn-secondary inline-flex h-9 items-center gap-2 rounded-full px-3 max-sm:hidden sm:h-10">
      <span className="relative grid size-2 place-items-center">
        <span
          className={cn(
            'absolute size-2 rounded-full',
            ready ? 'status-ping bg-accent' : 'bg-[rgba(0,0,0,0.25)]',
          )}
        />
        <span className={cn('size-2 rounded-full', ready ? 'bg-accent' : 'bg-[rgba(0,0,0,0.25)]')} />
      </span>
      <span className="numeral text-[13px] font-bold text-ink">
        {ready ? 'Draw ready' : formatCountdown(remaining)}
      </span>
      <span className="text-[11px] font-bold text-hint max-lg:hidden">
        {`#${Number(drawsCompleted) + 1}`}
      </span>
    </span>
  );
}

function NoLossNote() {
  return (
    <div className="glass-gold mt-auto rounded-lg p-3.5">
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
