import { Link } from 'react-router-dom';
import { HugeiconsIcon } from '@hugeicons/react';
import { ArrowRight01Icon } from '@hugeicons/core-free-icons';
import { BrandMark } from '@/components/Brand';

const FOOTER_NAV = [
  {
    title: 'Product',
    links: [
      { label: 'Pool', to: '/app' },
      { label: 'Draws', to: '/app/draws' },
      { label: 'History', to: '/app/history' },
    ],
  },
  {
    title: 'Learn',
    links: [
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Privacy model', href: '#privacy' },
      { label: 'FAQ', href: '#faq' },
    ],
  },
  {
    title: 'Protocol',
    links: [
      { label: 'Zama Protocol', href: 'https://docs.zama.org/protocol/latest' },
      { label: 'ERC-7984', href: 'https://eips.ethereum.org/EIPS/eip-7984' },
    ],
  },
];

/** Band 5 — close + footer. No second eye. */
export function LandingClose() {
  return (
    <>
      <div className="landing-zone__inner">
        <section className="landing-final-cta landing-reveal">
          <span className="landing-section__eyebrow">Live on Sepolia</span>
          <h2>Save privately. Claim when you win.</h2>
          <p>
            Connect a wallet, deposit cUSDC, and let yield fund the draw. Your balance stays
            encrypted — pull principal anytime.
          </p>

          <div className="landing-final-cta__actions !justify-start">
            <Link to="/app" className="landing-btn landing-btn--cream">
              <span className="landing-btn__orb" aria-hidden>
                <HugeiconsIcon icon={ArrowRight01Icon} size={14} />
              </span>
              Enter the pool
            </Link>
            <a href="#privacy" className="landing-btn landing-btn--ghost">
              Review privacy model
            </a>
          </div>
        </section>
      </div>

      <footer className="landing-mega-footer">
        <div className="landing-mega-footer__inner">
          <nav className="landing-mega-footer__nav">
            {FOOTER_NAV.map((column) => (
              <div key={column.title}>
                <p className="landing-mega-footer__col-title">{column.title}</p>
                <ul className="landing-mega-footer__links">
                  {column.links.map((link) => (
                    <li key={link.label}>
                      {'to' in link ? (
                        <Link to={link.to} className="landing-mega-footer__link">
                          {link.label}
                        </Link>
                      ) : (
                        <a
                          href={link.href}
                          target={link.href.startsWith('#') ? undefined : '_blank'}
                          rel="noreferrer"
                          className="landing-mega-footer__link"
                        >
                          {link.label}
                        </a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="flex flex-wrap items-end justify-between gap-6">
            <div className="flex items-center gap-3">
              <BrandMark size={34} onDark />
              <p className="landing-mega-footer__tagline">
                Confidential no-loss prize savings · Zama Protocol
              </p>
            </div>
            <p className="text-[11px] font-semibold tracking-[0.12em] text-white/35 uppercase">
              Testnet demo · not audited
            </p>
          </div>

          <div className="landing-mega-footer__wordmark">
            <strong>ConfiPool</strong>
          </div>
        </div>
      </footer>
    </>
  );
}
