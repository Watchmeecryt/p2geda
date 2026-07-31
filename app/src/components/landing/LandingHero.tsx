import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';

const TRUST = ['ERC-7984 confidential token', 'FHE draw randomness', 'No-loss principal', 'Sepolia live'];

export function LandingHero() {
  return (
    <section id="landing-hero" className="landing-hero landing-reveal landing-reveal--hero">
      <p className="landing-kicker">ConfiPool · confidential prize savings</p>

      <h1>
        <span className="landing-hero__line">Win the prize,</span>
        <span className="landing-hero__line landing-hero__line--accent">never the exposure.</span>
      </h1>

      <p className="landing-hero__lead">
        A no-loss prize pool where deposits, odds and payouts stay encrypted end to end. Your
        principal is always withdrawable — only the yield is ever at stake, and nobody can read your
        balance while it waits.
      </p>

      <div className="landing-hero__actions">
        <Link
          to="/app"
          className="btn-butter inline-flex min-h-[42px] items-center gap-2 rounded-full px-[18px] text-[0.9375rem] font-semibold transition-opacity hover:opacity-92"
        >
          Enter the pool
          <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
        </Link>
        <a
          href="#how-it-works"
          className="btn-secondary inline-flex min-h-[42px] items-center gap-2 rounded-full px-[18px] text-[0.9375rem] font-semibold transition-opacity"
        >
          See how it works
        </a>
      </div>

      <div className="landing-trust-row">
        {TRUST.map((item) => (
          <span key={item} className="landing-trust-row__item">
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
