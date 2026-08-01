const STEPS = [
  {
    n: '01',
    title: 'Deposit',
    body: 'Move cUSDC into the vault with an ERC-7984 confidential transfer. The amount never appears in the clear.',
  },
  {
    n: '02',
    title: 'Yield → prize',
    body: 'Earned yield feeds one encrypted prize reserve — not a public per-depositor payout.',
  },
  {
    n: '03',
    title: 'FHE draw',
    body: 'Selection runs under encryption against encrypted balances. Nobody sees the inputs.',
  },
  {
    n: '04',
    title: 'Private claim',
    body: 'Only the winner can decrypt their payout. Everyone else sees a settled draw.',
  },
];

const PROOF = [
  { value: 'ERC-7984', label: 'Confidential token standard' },
  { value: '0', label: 'Plaintext balances on chain' },
  { value: 'No-loss', label: 'Principal always withdrawable' },
];

/** Band 2 — how the pool works. One job only. */
export function LandingStory() {
  return (
    <section id="how-it-works" className="landing-section landing-section--first landing-reveal">
      <div className="landing-section__header landing-section__header--center">
        <span className="landing-section__eyebrow">How it works</span>
        <h2>Four steps. No leaks.</h2>
        <p>
          PoolTogether’s no-loss mechanic, rebuilt so the public ledger stops listing who has how
          much.
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

      <div className="landing-proof-strip landing-reveal-child">
        {PROOF.map((item) => (
          <div key={item.value}>
            <strong>{item.value}</strong>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
