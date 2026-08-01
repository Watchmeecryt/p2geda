import { useEffect, useState } from 'react';
import { HugeiconsIcon } from '@hugeicons/react';
import { Settings02Icon } from '@hugeicons/core-free-icons';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

type Props = {
  drawsThreshold: bigint;
  depositsThreshold: bigint;
  busyDraws: boolean;
  busyDeposits: boolean;
  disabled: boolean;
  onSaveDraws: (value: bigint) => Promise<boolean>;
  onSaveDeposits: (value: bigint) => Promise<boolean>;
};

/** Admin-updatable Metrics publish gates (prizes-paid draws / TVL depositors). */
export function RevealThresholdsCard({
  drawsThreshold,
  depositsThreshold,
  busyDraws,
  busyDeposits,
  disabled,
  onSaveDraws,
  onSaveDeposits,
}: Props) {
  const [draws, setDraws] = useState(drawsThreshold.toString());
  const [deposits, setDeposits] = useState(depositsThreshold.toString());

  useEffect(() => {
    if (!busyDraws) setDraws(drawsThreshold.toString());
  }, [drawsThreshold, busyDraws]);

  useEffect(() => {
    if (!busyDeposits) setDeposits(depositsThreshold.toString());
  }, [depositsThreshold, busyDeposits]);

  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="icon-tile size-9">
          <HugeiconsIcon icon={Settings02Icon} size={17} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-bold">Metrics reveal thresholds</h3>
          <p className="mt-1.5 text-[0.85rem] leading-relaxed text-muted">
            Control when TVL and total prizes paid may be published for public decrypt. Higher
            values make it harder to link a single deposit or claim to the aggregate.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <ThresholdField
              label="Draws before prizes-paid publish"
              hint="Default 5. Affects Admin → Publish total prizes paid."
              value={draws}
              onChange={setDraws}
              busy={busyDraws}
              disabled={disabled}
              onSave={() => {
                const next = BigInt(draws || '0');
                if (next === 0n) return Promise.resolve(false);
                return onSaveDraws(next);
              }}
            />
            <ThresholdField
              label="Depositors before TVL publish"
              hint="Default 3. Affects Admin → Publish vault TVL."
              value={deposits}
              onChange={setDeposits}
              busy={busyDeposits}
              disabled={disabled}
              onSave={() => {
                const next = BigInt(deposits || '0');
                if (next === 0n) return Promise.resolve(false);
                return onSaveDeposits(next);
              }}
            />
          </div>
        </div>
      </div>
    </Card>
  );
}

function ThresholdField({
  label,
  hint,
  value,
  onChange,
  busy,
  disabled,
  onSave,
}: {
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
  busy: boolean;
  disabled: boolean;
  onSave: () => Promise<boolean>;
}) {
  const parsed = /^\d+$/.test(value) ? BigInt(value) : 0n;

  return (
    <div className="rounded-lg border border-hairline bg-surface px-4 py-4">
      <p className="text-[0.8rem] font-semibold text-ink">{label}</p>
      <p className="mt-1 text-[0.74rem] leading-relaxed text-hint">{hint}</p>
      <div className="mt-3 flex gap-2">
        <input
          type="number"
          min={1}
          step={1}
          inputMode="numeric"
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/[^\d]/g, ''))}
          disabled={disabled || busy}
          className="min-h-[37px] min-w-0 flex-1 rounded-lg border border-strong bg-white px-3 text-[0.9rem] font-semibold text-ink outline-none focus:border-accent"
        />
        <Button
          size="sm"
          loading={busy}
          disabled={disabled || busy || parsed === 0n}
          onClick={() => void onSave()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
