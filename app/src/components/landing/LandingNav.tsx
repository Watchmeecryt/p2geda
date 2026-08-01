import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { BrandMark } from '@/components/Brand';

const CHIPS = [
  { href: '#how-it-works', label: 'How it works' },
  { href: '#privacy', label: 'Privacy' },
  { href: '#faq', label: 'FAQ' },
];

export function LandingNav() {
  return (
    <header className="landing-nav">
      <div className="landing-nav__inner">
        <Link to="/" className="landing-brand landing-nav__brand">
          <BrandMark size={28} />
          <span>ConfiPool</span>
        </Link>

        <nav className="landing-nav__center" aria-label="Landing">
          {CHIPS.map((chip) => (
            <a key={chip.href} href={chip.href} className="landing-nav__chip">
              {chip.label}
            </a>
          ))}
        </nav>

        <div className="landing-nav__actions">
          <Link to="/app" className="landing-btn landing-btn--ink landing-btn--sm">
            Launch app
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </header>
  );
}
