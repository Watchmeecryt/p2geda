import { HugeiconsIcon } from '@hugeicons/react';
import {
  ArrowRight01Icon,
  ChampionIcon,
  DiceIcon,
  LockPasswordIcon,
  SafeIcon,
} from '@hugeicons/core-free-icons';

const STEPS = [
  {
    n: '01',
    title: 'Deposit confidentially',
    body: 'Wrap cUSDC into the vault. The transfer is an ERC-7984 confidential transfer, so the amount never appears in the clear.',
  },
  {
    n: '02',
    title: 'Yield builds the prize',
    body: 'Deposits earn yield that is routed into a single encrypted prize reserve instead of being paid out per depositor.',
  },
  {
    n: '03',
    title: 'The draw runs on FHE',
    body: 'A random value is generated inside the FHE coprocessor and weighted against encrypted balances. Nobody — including us — sees the inputs.',
  },
  {
    n: '04',
    title: 'The winner claims privately',
    body: 'Only the winner can decrypt their own payout. Everyone else sees a settled draw and nothing more.',
  },
];

const PROOF = [
  { value: 'ERC-7984', label: 'Confidential token standard, not a wrapper hack' },
  { value: '0', label: 'Plaintext balances written to chain, ever' },
  { value: '1 tx', label: 'To deposit, and your principal stays withdrawable' },
];

const FLOW = [
  { icon: SafeIcon, title: 'Depositors', body: 'Encrypted balances enter the vault' },
  { icon: LockPasswordIcon, title: 'Encrypted pool', body: 'One ciphertext total, no per-user leak', hub: true },
  { icon: DiceIcon, title: 'FHE draw', body: 'Weighted random selection under encryption' },
  { icon: ChampionIcon, title: 'Winner', body: 'Decrypts their prize alone', pulse: true },
];

export function LandingStory() {
  return (
    <>
      <section id="how-it-works" className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">How it works</span>
          <h2>Four steps. No leaks.</h2>
          <p>
            PoolTogether's no-loss mechanic, rebuilt so the ledger everyone can read stops being a
            list of who has how much.
          </p>
        </div>

        <ol className="landing-timeline">
          {STEPS.map((step) => (
            <li key={step.n} className="landing-panel landing-panel--hover landing-reveal-child">
              <span>{step.n}</span>
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="landing-reveal">
        <div className="landing-proof-strip">
          {PROOF.map((item) => (
            <div key={item.value}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      </section>

      <section id="privacy" className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">The flow</span>
          <h2>Encrypted from deposit to payout.</h2>
        </div>

        <ol className="landing-flow-map">
          {FLOW.map((node) => (
            <li
              key={node.title}
              className={`landing-panel landing-flow-node landing-reveal-child ${
                node.pulse ? 'landing-flow-node--pulse' : ''
              }`}
            >
              <span
                className={`mx-auto grid size-12 place-items-center rounded-full ${
                  node.hub
                    ? 'landing-flow-node__hub bg-accent text-black shadow-[0_10px_32px_rgba(255,210,8,0.4)]'
                    : 'bg-accent-bg text-accent-deep'
                }`}
              >
                <HugeiconsIcon icon={node.icon} size={22} aria-hidden />
              </span>
              <h3 className="mt-3.5 text-[1.05rem] font-semibold text-ink">{node.title}</h3>
              <p className="mt-1.5 text-[0.875rem] leading-relaxed text-body">{node.body}</p>
              <HugeiconsIcon
                icon={ArrowRight01Icon}
                size={16}
                aria-hidden
                className="absolute top-1/2 -right-3 hidden -translate-y-1/2 text-accent-deep [li:last-child_&]:hidden lg:block"
              />
            </li>
          ))}
        </ol>
      </section>
    </>
  );
}
