import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';

/**
 * Band 1 — one composition: brand, headline, lead, CTAs.
 * The privacy eye lives only in the privacy band.
 */
export function LandingHero() {
  return (
    <section id="landing-hero" className="landing-hero landing-reveal landing-reveal--hero">
      <p className="landing-kicker">ConfiPool</p>

      <h1>
        <span className="landing-hero__line">Win the prize.</span>
        <span className="landing-hero__line">Keep the ledger dark.</span>
      </h1>

      <p className="landing-hero__lead">
        Confidential no-loss prize savings. Deposits, odds, and payouts stay encrypted — your
        principal stays withdrawable.
      </p>

      <div className="landing-hero__actions">
        <Link to="/app" className="landing-btn landing-btn--accent">
          <span className="landing-btn__orb" aria-hidden>
            <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
          </span>
          Enter the pool
        </Link>
        <a href="#how-it-works" className="landing-btn landing-btn--ink">
          How it works
        </a>
      </div>

      <ul className="landing-hero__meta">
        <li>ERC-7984</li>
        <li>FHE draw</li>
        <li>No-loss principal</li>
        <li>Sepolia live</li>
      </ul>
    </section>
  );
}
