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
    ],
  },
  {
    title: 'Protocol',
    links: [
      { label: 'Zama Protocol', href: 'https://docs.zama.org/protocol/latest' },
      { label: 'ERC-7984', href: 'https://eips.ethereum.org/EIPS/eip-7984' },
    ],
  },
  {
    title: 'Network',
    links: [
      { label: 'Sepolia testnet', href: 'https://sepolia.etherscan.io' },
      { label: 'PoolTogether', href: 'https://pooltogether.com' },
    ],
  },
];

export function LandingClose() {
  return (
    <>
      <div className="landing-zone__inner">
        <section className="landing-final-cta landing-reveal">
          <div className="landing-final-cta__watermark" aria-hidden>
            <ShieldGlyph />
          </div>

          <span className="landing-section__eyebrow">Live on Sepolia</span>
          <h2>Save privately. Win publicly optional.</h2>
          <p>
            Connect a wallet, deposit cUSDC, and let the yield play for you. Your balance stays
            encrypted the whole way through — and you can pull your principal out whenever you like.
          </p>

          <div className="landing-final-cta__actions !justify-start">
            <Link
              to="/app"
              className="btn-butter inline-flex min-h-[42px] items-center gap-2 rounded-full px-[18px] text-[0.9375rem] font-semibold transition-opacity hover:opacity-92"
            >
              Enter the pool
              <HugeiconsIcon icon={ArrowRight01Icon} size={16} aria-hidden />
            </Link>
            <a
              href="https://docs.zama.org/protocol/latest"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-[42px] items-center gap-2 rounded-full border border-white/20 bg-white/5 px-[18px] text-[0.9375rem] font-semibold text-white/85 transition-colors hover:bg-white/10 hover:text-white"
            >
              Read the protocol docs
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
                Confidential no-loss prize savings, powered by the Zama Protocol
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

function ShieldGlyph() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.1} aria-hidden>
      <path d="M12 2.5 4.5 5.5v6c0 4.6 3.1 8.8 7.5 10 4.4-1.2 7.5-5.4 7.5-10v-6L12 2.5Z" />
      <path d="M9 12.2 11.2 14.4 15.4 10.2" />
    </svg>
  );
}
