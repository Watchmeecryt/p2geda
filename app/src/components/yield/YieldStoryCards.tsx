import steakhouseMark from '@/assets/brands/steakhouse.png';
import zamaMark from '@/assets/brands/zama.png';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  BadgeInfoIcon,
  LinkSquare02Icon,
  MoneyBag02Icon,
  SafeIcon,
} from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ExposureStack } from '@/components/yield/ExposureStack';
import {
  CUSDC_MOCK_ADDRESS,
  VAULT_ADDRESS,
  YIELD_VAULT_ADDRESS,
  YIELD_VAULT_CONFIGURED,
} from '@/lib/contracts';
import { SEPOLIA_CONFIDENTIAL_VAULT } from '@/lib/yieldComposition';
import { explorerAddressUrl } from '@/lib/chains';
import { formatConfidential, shortenAddress } from '@/lib/format';
import { cn } from '@/lib/utils';

type EngineProps = {
  rateLabel: string;
  apexPrize: bigint;
  pulsePrize: bigint;
  ripplePrize: bigint;
  canHarvest: boolean;
  harvesting: boolean;
  harvestDisabled: boolean;
  onHarvest?: () => void;
};

/** Left column — how ConfiPool funds the encrypted prize reserve on Sepolia. */
export function YieldEngineCard({
  rateLabel,
  apexPrize,
  pulsePrize,
  ripplePrize,
  canHarvest,
  harvesting,
  harvestDisabled,
  onHarvest,
}: EngineProps) {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-full bg-[#0F6B4C] ring-1 ring-black/10">
            <img
              src={steakhouseMark}
              alt=""
              width={44}
              height={44}
              className="size-11 object-cover mix-blend-screen"
            />
          </span>
          <div className="min-w-0">
            <p className="label-pill">Prize funding</p>
            <h2 className="mt-1 text-[1.15rem] font-bold leading-snug text-ink sm:text-[1.25rem]">
              Adapter → reserve
            </h2>
          </div>
        </div>
        <Badge tone="warning" className="shrink-0">
          Sepolia seed
        </Badge>
      </div>

      <p className="mt-4 text-[0.9rem] leading-relaxed text-muted">
        Idle principal can sit in <code className="text-[0.8rem] text-ink">ConfidentialVaultSource</code>.
        When the keeper calls <code className="text-[0.8rem] text-ink">harvest()</code>, any adapter pot
        lands in the encrypted prize reserve that pays Apex / Pulse / Ripple.
      </p>

      <div className="note-block mt-5 flex gap-3 py-3.5">
        <HugeiconsIcon
          icon={BadgeInfoIcon}
          size={16}
          className="mt-0.5 shrink-0 text-hint"
          aria-hidden
        />
        <p className="text-[0.82rem] leading-relaxed text-muted">
          Sepolia’s Morpho staging vault does not actually drip APY. We still wire the real Zama
          batchers and cShares so the path is honest — then seed prizes with the adapter’s on-chain
          rate plus Admin → Fund reserve. On mainnet the same adapter targets live Steakhouse yield
          instead of a seed.
        </p>
      </div>

      <div className="mt-6 grid gap-x-6 gap-y-5 sm:grid-cols-3">
        <Metric label="On-chain rate" value={rateLabel} hint="Adapter rateBps" />
        <Metric
          label="Tier sizes"
          value={`${formatConfidential(apexPrize)} / ${formatConfidential(pulsePrize)} / ${formatConfidential(ripplePrize)}`}
          hint="Apex · Pulse · Ripple"
        />
        <Metric label="Demo reserve" value="Admin tops up" hint="Not Morpho yield yet" />
      </div>

      <div className="mt-6 space-y-0 border-t border-hairline">
        <LinkRow
          label="Yield adapter"
          href={explorerAddressUrl(YIELD_VAULT_ADDRESS)}
          value={shortenAddress(YIELD_VAULT_ADDRESS)}
        />
        <LinkRow
          label="Prize vault"
          href={explorerAddressUrl(VAULT_ADDRESS)}
          value={shortenAddress(VAULT_ADDRESS)}
        />
        <LinkRow
          label="cUSDC (ERC-7984)"
          href={explorerAddressUrl(CUSDC_MOCK_ADDRESS)}
          value={shortenAddress(CUSDC_MOCK_ADDRESS)}
        />
      </div>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
        <div>
          <p className="text-[0.74rem] font-semibold tracking-wide text-hint uppercase">
            Mainnet exposure preview
          </p>
          <div className="mt-2">
            <ExposureStack allocatedUnderlying={0n} />
          </div>
        </div>
        {canHarvest && onHarvest ? (
          <Button
            variant="secondary"
            loading={harvesting}
            disabled={harvestDisabled}
            onClick={onHarvest}
          >
            Run harvest
          </Button>
        ) : null}
      </div>
    </Card>
  );
}

/** Right column — Zama batchers + encrypted shares this deployment actually uses. */
export function ConfidentialVaultCard() {
  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <img
            src={zamaMark}
            alt=""
            width={44}
            height={44}
            className="size-11 shrink-0 rounded-full object-cover ring-1 ring-black/10"
          />
          <div className="min-w-0">
            <p className="label-pill">On Sepolia today</p>
            <h2 className="mt-1 text-[1.15rem] font-bold leading-snug text-ink sm:text-[1.25rem]">
              Batchers & cShares
            </h2>
          </div>
        </div>
        <Badge tone="success" className="shrink-0">
          Live wiring
        </Badge>
      </div>

      <p className="mt-4 text-[0.9rem] leading-relaxed text-muted">
        This deployment talks to Zama’s published Sepolia confidential-vault addresses — deposit
        batcher, redeem batcher, and the encrypted share token. Users encrypt when they deposit;
        your keeper later pushes already-encrypted idle principal into the batcher — it does not
        re-encrypt amounts.
      </p>

      <ol className="mt-5 space-y-3 text-[0.86rem] leading-relaxed text-muted">
        <Step n={1} body="Depositors wrap faucet USDC → cUSDC and enter the prize vault (browser encrypt + proof)." />
        <Step
          n={2}
          body="The vault can supply that encrypted cUSDC into ConfidentialVaultSource. Your keeper (or anyone) calls joinVault() to send idle principal into Zama’s current deposit batch toward Morpho / Steakhouse."
        />
        <Step
          n={3}
          body="After the batch settles, claimShares() mints encrypted cShares. harvest() folds adapter yield into the prize reserve. Draws keep running on their own schedule."
        />
      </ol>

      <div className="mt-6 space-y-0 border-t border-hairline">
        <LinkRow
          label="Deposit batcher"
          href={explorerAddressUrl(SEPOLIA_CONFIDENTIAL_VAULT.depositBatcher)}
          value={shortenAddress(SEPOLIA_CONFIDENTIAL_VAULT.depositBatcher)}
        />
        <LinkRow
          label="Redeem batcher"
          href={explorerAddressUrl(SEPOLIA_CONFIDENTIAL_VAULT.redeemBatcher)}
          value={shortenAddress(SEPOLIA_CONFIDENTIAL_VAULT.redeemBatcher)}
        />
        <LinkRow
          label="cShare token"
          href={explorerAddressUrl(SEPOLIA_CONFIDENTIAL_VAULT.cShare)}
          value={shortenAddress(SEPOLIA_CONFIDENTIAL_VAULT.cShare)}
        />
        <LinkRow
          label="Staging ERC-4626 vault"
          href={explorerAddressUrl(SEPOLIA_CONFIDENTIAL_VAULT.erc4626UnderlyingVault)}
          value={shortenAddress(SEPOLIA_CONFIDENTIAL_VAULT.erc4626UnderlyingVault)}
        />
        <LinkRow
          label="Official address list"
          href={SEPOLIA_CONFIDENTIAL_VAULT.docsUrl}
          value="Zama docs"
          external
        />
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-xl border border-hairline bg-surface/60 p-3.5">
        <div className="icon-tile size-9 shrink-0">
          <HugeiconsIcon icon={SafeIcon} size={16} aria-hidden />
        </div>
        <div>
          <p className="text-[0.88rem] font-bold text-ink">What changes on mainnet</p>
          <p className="mt-1 text-[0.8rem] leading-relaxed text-muted">
            Keep this adapter. Point it at production Steakhouse / Morpho vault addresses so
            harvest() pulls real yield. Sepolia keeps Admin fundReserve so prize demos still work
            while staging yield is idle.
          </p>
        </div>
      </div>

      {!YIELD_VAULT_CONFIGURED ? (
        <p className="mt-4 flex items-center gap-2 text-[0.8rem] text-hint">
          <HugeiconsIcon icon={MoneyBag02Icon} size={14} aria-hidden />
          Yield adapter address is not set in this build.
        </p>
      ) : null}
    </Card>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="min-w-0 sm:border-l sm:border-hairline sm:pl-5 sm:first:border-l-0 sm:first:pl-0">
      <p className="label-pill">{label}</p>
      <p className="numeral mt-2 break-words text-[1.2rem] leading-snug font-bold text-ink sm:text-[1.35rem]">
        {value}
      </p>
      <p className="mt-1.5 text-[0.74rem] leading-snug text-hint">{hint}</p>
    </div>
  );
}

function Step({ n, body }: { n: number; body: string }) {
  return (
    <li className="flex gap-3">
      <span className="numeral mt-0.5 text-[0.78rem] font-bold text-hint">{n}</span>
      <p>{body}</p>
    </li>
  );
}

function LinkRow({
  label,
  href,
  value,
  external = false,
}: {
  label: string;
  href: string;
  value: string;
  external?: boolean;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex items-center justify-between gap-3 border-b border-hairline py-3 text-[0.84rem] last:border-b-0 hover:text-accent-deep"
    >
      <span className="text-muted">{label}</span>
      <span className="inline-flex items-center gap-1.5 font-semibold text-ink">
        <span className={cn('numeral', external && 'font-sans')}>{value}</span>
        <HugeiconsIcon icon={LinkSquare02Icon} size={13} className="text-hint" aria-hidden />
      </span>
    </a>
  );
}
