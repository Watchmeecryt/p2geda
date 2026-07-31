import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, LockPasswordIcon, SafeIcon, ViewOffSlashIcon } from '@hugeicons/core-free-icons';

const ROWS = [
  { label: 'Deposit', when: '2 min ago', value: '••••••' },
  { label: 'Prize funded', when: '1 hr ago', value: '••••••' },
  { label: 'Draw #12 settled', when: 'Yesterday', value: '••••••' },
  { label: 'Withdrawal', when: '3 days ago', value: '••••••' },
];

/**
 * Static mock of the product surface. It sits below the hero rather than inside
 * it so the headline gets the full viewport, matching the ConfiDrop layout.
 */
export function LandingPreview() {
  return (
    <section className="landing-section landing-section--tight landing-reveal">
      <div className="landing-section__header landing-section__header--center">
        <span className="landing-section__eyebrow">Inside the app</span>
        <h2>Everything on screen is encrypted.</h2>
        <p>
          Balances, prize reserve and payouts are ciphertext on chain. Only you can decrypt your own
          row, and only you ever see a real number.
        </p>
      </div>

      <div className="preview-frame mx-auto mt-10 w-full max-w-4xl">
        <div className="preview-chrome">
          <span />
          <span />
          <span />
          <div className="ml-2 flex-1 rounded-full bg-[rgba(0,0,0,0.05)] px-3 py-1 text-[11px] font-semibold text-hint">
            confipool.app/app
          </div>
        </div>

        <div className="grid gap-4 p-5 sm:grid-cols-3">
          <StatTile icon={SafeIcon} label="Your deposit" />
          <StatTile icon={ChampionIcon} label="Prize reserve" />
          <StatTile icon={LockPasswordIcon} label="Win odds" />
        </div>

        <div className="mx-5 mb-8 overflow-hidden rounded-lg border border-[var(--color-border-light)] bg-white/70">
          <div className="data-row data-row--header">
            <span className="flex-1">Activity</span>
            <span>Amount</span>
          </div>
          {ROWS.map((row) => (
            <div key={row.label} className="data-row">
              <span className="grid size-7 shrink-0 place-items-center rounded-full bg-accent-bg text-accent-deep">
                <HugeiconsIcon icon={ViewOffSlashIcon} size={13} aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13px] font-semibold text-ink">{row.label}</span>
                <span className="block text-[11.5px] text-hint">{row.when}</span>
              </span>
              <span className="masked-text text-[13px] font-bold">{row.value}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function StatTile({ icon, label }: { icon: typeof SafeIcon; label: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border-light)] bg-white/70 p-4">
      <span className="flex items-center gap-2 text-[11px] font-bold tracking-[0.12em] text-hint uppercase">
        <HugeiconsIcon icon={icon} size={14} aria-hidden />
        {label}
      </span>
      <span className="masked-text mt-2.5 block text-[26px] leading-none font-bold">••••••</span>
      <span className="mt-2 block text-[11.5px] text-hint">Tap to decrypt</span>
    </div>
  );
}
