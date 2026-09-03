import { HugeiconsIcon } from '@hugeicons/react';
import {
  Clock01Icon,
  DiceIcon,
  Key01Icon,
  SquareLock02Icon,
  UserGroupIcon,
} from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';

const STEPS = [
  {
    icon: SquareLock02Icon,
    title: 'Deposit anytime',
    body: 'Wrap faucet USDC into cUSDC, then deposit. No timed bus — join or leave whenever you want.',
  },
  {
    icon: Clock01Icon,
    title: 'Earn time-weighted odds',
    body: 'Bigger deposits and longer stake earn more TWAB weight. On Sepolia the keeper runs a round about once an hour.',
  },
  {
    icon: DiceIcon,
    title: 'Keeper begin → unseal → score',
    body: 'The bot freezes the window, public-decrypts R + total weight, then scores Apex / Pulse / Ripple. Deposit and withdraw anytime without the bot.',
  },
  {
    icon: Key01Icon,
    title: 'Claim privately',
    body: 'Winnings land in your encrypted claimable balance. Only you can decrypt and claim them as cUSDC.',
  },
] as const;

export function HowItWorksCard() {
  return (
    <Card>
      <h3 className="font-bold">How it works</h3>
      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted">
        ConfiPool is no-loss prize savings: your principal stays yours; yield (or an admin-funded
        reserve on Sepolia) pays Apex / Pulse / Ripple prizes.
      </p>
      <ol className="mt-5 grid gap-4 sm:grid-cols-2">
        {STEPS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="numeral mt-0.5 text-[0.78rem] font-bold text-hint">{i + 1}</span>
            <div>
              <div className="icon-tile size-8">
                <HugeiconsIcon icon={step.icon} size={15} aria-hidden />
              </div>
              <p className="mt-2 text-[0.88rem] font-bold">{step.title}</p>
              <p className="mt-1 text-[0.78rem] leading-relaxed text-muted">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </Card>
  );
}

export function FheDrawExplainer() {
  return (
    <Card>
      <h3 className="font-bold">How the FHE draw works</h3>
      <div className="mt-5 grid gap-5 sm:grid-cols-3">
        <Point
          icon={DiceIcon}
          title="Encrypted randomness"
          body="beginRound freezes a TWAB window and draws an encrypted ticket R with FHE.randEuint64(). Nobody sees R yet."
        />
        <Point
          icon={SquareLock02Icon}
          title="Public decrypt of aggregates"
          body="Only R and totalWeight are made publicly decryptable. The keeper posts KMS signatures via unsealRound. Individual balances stay private."
        />
        <Point
          icon={UserGroupIcon}
          title="Apex / Pulse / Ripple"
          body="After unseal, the keeper runs scoreEntrants for depositors. Rare Apex, mid Pulse, frequent Ripple — paid from the encrypted reserve if funded."
        />
      </div>
    </Card>
  );
}

function Point({
  icon,
  title,
  body,
}: {
  icon: typeof DiceIcon;
  title: string;
  body: string;
}) {
  return (
    <div>
      <div className="icon-tile size-9">
        <HugeiconsIcon icon={icon} size={17} aria-hidden />
      </div>
      <p className="mt-3 text-[0.9rem] font-bold">{title}</p>
      <p className="mt-1.5 text-[0.82rem] leading-relaxed text-muted">{body}</p>
    </div>
  );
}
