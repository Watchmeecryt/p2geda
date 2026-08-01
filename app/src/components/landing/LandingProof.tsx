import { useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Add01Icon,
  CheckmarkCircle02Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons';

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
    a: 'No. The prize is funded from yield. Your principal sits encrypted in the vault and stays withdrawable at any time.',
  },
  {
    q: 'If balances are encrypted, how are odds calculated?',
    a: 'The draw runs inside the FHE coprocessor. A random value is compared against encrypted deposits, so weighting stays correct without decrypting anyone’s balance.',
  },
  {
    q: 'Who can see that I won?',
    a: 'The chain records that a draw settled. Winner and amount stay ciphertext — only the winner can decrypt their payout.',
  },
];

/** Band 4 — one proof table + short FAQ. No before/after or bento. */
export function LandingProof() {
  return (
    <>
      <section className="landing-section landing-section--first landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">What a watcher learns</span>
          <h2>Exactly this. Nothing more.</h2>
        </div>

        <div className="landing-panel landing-leak-table mx-auto mt-10 max-w-3xl overflow-hidden">
          <div className="data-row data-row--header">
            <span className="flex-1">Surface</span>
            <span className="w-24 text-center">Public pool</span>
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

      <section id="faq" className="landing-section landing-reveal">
        <div className="landing-section__header landing-section__header--center">
          <span className="landing-section__eyebrow">FAQ</span>
          <h2>Three questions that matter.</h2>
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
