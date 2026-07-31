import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  Alert02Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

const BEFORE = [
  'Anyone can read your deposit size from the explorer',
  'Your win odds are public, so your net worth is too',
  'Payouts tie a prize to a wallet forever',
];

const AFTER = [
  'Deposits are ERC-7984 ciphertext on chain',
  'Odds are computed under encryption, never published',
  'Only the winner can decrypt their own payout',
];

const BENTO = [
  {
    tag: '01',
    title: 'Principal is never at risk',
    body: 'Withdraw the full amount you put in, whenever you want. The prize comes from yield, so losing a draw costs you nothing but time.',
    wide: true,
  },
  {
    tag: '02',
    title: 'Odds without disclosure',
    body: 'Weighting is proportional to your encrypted balance. Bigger deposits mean better odds, and nobody learns either number.',
  },
  {
    tag: '03',
    title: 'Auditable in aggregate',
    body: 'After five draws the operator can publicly decrypt the running prize total, so the pool is provable without exposing a single depositor.',
  },
];

const LEAKS = [
  { surface: 'Deposit amount', transparent: true, confipool: false },
  { surface: 'Running balance', transparent: true, confipool: false },
  { surface: 'Win probability', transparent: true, confipool: false },
  { surface: 'Prize amount received', transparent: true, confipool: false },
  { surface: 'That a draw happened', transparent: true, confipool: true },
  { surface: 'Total prizes paid (after 5 draws)', transparent: true, confipool: true },
];

const FAQ = [
  {
    q: 'Can I lose my deposit?',
    a: 'No. The prize is funded entirely from yield, and your principal sits in the vault as an encrypted balance you can withdraw at any time. Losing a draw means you simply keep what you had.',
  },
  {
    q: 'If balances are encrypted, how are odds calculated?',
    a: 'The draw runs inside the FHE coprocessor. A random value is generated under encryption and compared against the encrypted running total of deposits, so selection is weighted correctly without any value being decrypted.',
  },
  {
    q: 'Who can see that I won?',
    a: 'The contract emits that a draw settled, but the winner and the amount are ciphertext. Only the winner holds the decryption rights to read their own payout.',
  },
  {
    q: 'What is the yield source?',
    a: 'On Sepolia the reserve is funded by the operator so the mechanic can be demonstrated end to end. In production the same interface accepts a real yield adapter — the vault only cares that the reserve receives a confidential transfer.',
  },
  {
    q: 'Which tokens does it use?',
    a: 'The official Sepolia USDC mock and its confidential cUSDC counterpart, so the flow runs against the same contracts the protocol publishes rather than a bespoke test token.',
  },
];

export function LandingWorkflows() {
  return (
    <>
      <section className="landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">The difference</span>
          <h2>A transparent ledger is a leaky one.</h2>
        </div>

        <div className="landing-before-after">
          <article className="landing-panel landing-contrast-card landing-reveal-child">
            <span className="text-[11px] font-bold tracking-[0.14em] text-hint uppercase">
              Transparent prize pool
            </span>
            <h3 className="mt-3 text-[1.35rem] font-semibold text-ink">Everything is readable</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {BEFORE.map((item) => (
                <li key={item} className="flex gap-2.5 text-[0.9rem] leading-relaxed text-body">
                  <HugeiconsIcon
                    icon={Alert02Icon}
                    size={17}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-negative"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </article>

          <article className="landing-panel landing-contrast-card landing-contrast-card--after landing-reveal-child">
            <span className="text-[11px] font-bold tracking-[0.14em] text-accent-deep uppercase">
              ConfiPool
            </span>
            <h3 className="mt-3 text-[1.35rem] font-semibold text-ink">Only you hold the key</h3>
            <ul className="mt-4 flex flex-col gap-2.5">
              {AFTER.map((item) => (
                <li key={item} className="flex gap-2.5 text-[0.9rem] leading-relaxed text-body">
                  <HugeiconsIcon
                    icon={CheckmarkCircle02Icon}
                    size={17}
                    aria-hidden
                    className="mt-0.5 shrink-0 text-positive"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">Why it matters</span>
          <h2>Privacy that still adds up.</h2>
        </div>

        <ul className="landing-bento mt-10">
          {BENTO.map((item) => (
            <li
              key={item.tag}
              className={`landing-panel landing-panel--hover landing-bento__item landing-reveal-child ${
                item.wide ? 'landing-bento__item--wide' : ''
              }`}
            >
              <span>{item.tag}</span>
              <h3>{item.title}</h3>
              <p>{item.body}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">What stays private</span>
          <h2>Exactly what a watcher can learn.</h2>
        </div>

        <div className="landing-panel mx-auto mt-10 max-w-3xl overflow-hidden">
          <div className="data-row data-row--header">
            <span className="flex-1">Surface</span>
            <span className="w-24 text-center">Transparent</span>
            <span className="w-24 text-center">ConfiPool</span>
          </div>
          {LEAKS.map((row) => (
            <div key={row.surface} className="data-row">
              <span className="flex-1 text-[13.5px] font-medium text-ink">{row.surface}</span>
              <span className="flex w-24 justify-center">
                <LeakDot exposed={row.transparent} />
              </span>
              <span className="flex w-24 justify-center">
                <LeakDot exposed={row.confipool} />
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">FAQ</span>
          <h2>The questions worth asking.</h2>
        </div>

        <div className="mx-auto mt-10 flex max-w-3xl flex-col gap-2.5">
          {FAQ.map((item, index) => (
            <FaqRow key={item.q} question={item.q} answer={item.a} defaultOpen={index === 0} />
          ))}
        </div>
      </section>
    </>
  );
}

function LeakDot({ exposed }: { exposed: boolean }) {
  return (
    <span
      title={exposed ? 'Visible' : 'Encrypted'}
      className={`grid size-6 place-items-center rounded-full ${
        exposed ? 'bg-negative-bg text-negative' : 'bg-positive-bg text-positive'
      }`}
    >
      <HugeiconsIcon icon={exposed ? Cancel01Icon : CheckmarkCircle02Icon} size={13} aria-hidden />
      <span className="sr-only">{exposed ? 'Visible' : 'Encrypted'}</span>
    </span>
  );
}

function FaqRow({
  question,
  answer,
  defaultOpen,
}: {
  question: string;
  answer: string;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="landing-panel landing-reveal-child overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-center gap-4 px-5 py-4 text-left"
      >
        <span className="flex-1 text-[1rem] font-semibold text-ink">{question}</span>
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full bg-accent-bg text-accent-deep transition-transform duration-200 ${
            open ? 'rotate-45' : ''
          }`}
        >
          <HugeiconsIcon icon={Add01Icon} size={15} aria-hidden />
        </span>
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
        }`}
      >
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-[0.9rem] leading-relaxed text-body">{answer}</p>
        </div>
      </div>
    </div>
  );
}
