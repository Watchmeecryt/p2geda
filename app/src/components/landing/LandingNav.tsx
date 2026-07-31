import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { BrandMark } from '@/components/Brand';

const CHIPS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
];

export function LandingNav() {
  return (
    <header className="landing-nav glass-card">
      <div className="landing-nav__inner">
        <Link to="/" className="landing-brand landing-nav__brand">
          <BrandMark size={32} />
          ConfiPool
        </Link>

        <div className="landing-nav__center">
          {CHIPS.map((chip) => (
            <a key={chip.href} href={chip.href} className="landing-nav__chip">
              {chip.label}
            </a>
          ))}
        </div>

        <div className="landing-nav__actions">
          <Link
            to="/app"
            className="btn-butter inline-flex min-h-10 items-center gap-2 rounded-full px-4 text-[0.9375rem] font-semibold transition-opacity hover:opacity-92"
          >
            Launch app
            <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
