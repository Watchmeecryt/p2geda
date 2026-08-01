const BEATS = [
  { label: 'Encrypted principal', detail: 'Never written in the clear' },
  { label: 'Hidden odds', detail: 'Weighted under FHE' },
  { label: 'Private claim', detail: 'Only the winner decrypts' },
];

/**
 * Band 3 — the single privacy motif. Full orange plane + crossed eye.
 */
export function LandingPrivacy() {
  return (
    <section id="privacy" className="landing-privacy landing-reveal">
      <div className="landing-privacy__stage">
        <img
          src="/icons/bitkey/privacy-eye.svg"
          alt=""
          aria-hidden
          className="landing-privacy__eye"
        />
      </div>

      <div className="landing-privacy__copy">
        <p className="landing-privacy__eyebrow">Privacy model</p>
        <h2>
          Your deposit stays protected by private encryption, while the ledger stays in the dark.
        </h2>
        <p className="landing-privacy__lead">
          Watchers can see that a draw happened. They cannot see how much you deposited, what your
          odds were, or how much you won.
        </p>

        <ul className="landing-privacy__pixels">
          {BEATS.map((item) => (
            <li key={item.label}>
              <span className="landing-privacy__pixel-mark" aria-hidden />
              <span>
                <strong>{item.label}</strong>
                <em>{item.detail}</em>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
