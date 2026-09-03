import { HugeiconsIcon } from '@hugeicons/react';
import { ChampionIcon, DiceIcon, LinkSquare02Icon } from '@hugeicons/core-free-icons';
import { Card, CardSection } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { useBlockTimestamps } from '@/hooks/useBlockTimestamps';
import { useDrawHistory } from '@/hooks/usePoolHistory';
import type { WinEntry } from '@/hooks/useWinJournal';
import { explorerTxUrl } from '@/lib/chains';
import { formatConfidential, formatRelativeTime, shortenHash } from '@/lib/format';

export function DrawTimeline({ wins }: { wins: WinEntry[] }) {
  const { data: draws, isLoading } = useDrawHistory();
  const timestampOf = useBlockTimestamps(draws);

  const winByDraw = new Map(
    wins
      .filter((win) => win.drawId !== null && win.amount !== '0')
      .map((win) => [win.drawId as number, win]),
  );

  return (
    <Card flush>
      <CardSection>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-ink">Draw history</h3>
            <p className="mt-1 text-[0.84rem] text-muted">
              Draw IDs are public. Winners are not — for privacy, no draw is linked to an address.
              If you win, the prize is added to your encrypted balance and only you can decrypt it.
            </p>
          </div>
          <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
            {draws.length} draws
          </Badge>
        </div>
      </CardSection>

      {isLoading && draws.length === 0 ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2].map((row) => (
            <Skeleton key={row} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : draws.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={DiceIcon} size={22} aria-hidden />}
          title="No draws yet"
          description="Once the admin funds the prize reserve and the interval elapses, the first draw runs and will appear here."
        />
      ) : (
        <ol>
          {draws.map((draw) => {
            const drawId =
              draw.drawId === undefined || draw.drawId === null
                ? null
                : Number(draw.drawId);
            const win = drawId !== null ? winByDraw.get(drawId) : undefined;
            const timestamp = draw.timestamp ?? timestampOf(draw.blockNumber);
            const label = drawId !== null ? String(drawId) : '—';

            return (
              <li key={draw.id} className="data-row flex-wrap">
                <span className="icon-tile size-9 text-[0.8rem] font-bold text-ink">
                  {label}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-semibold text-ink">Draw #{label}</p>
                  <p className="text-[0.76rem] text-hint">
                    {timestamp ? formatRelativeTime(timestamp) : `block ${draw.blockNumber}`}
                  </p>
                </div>

                {win ? (
                  <Badge tone="accent" className="shrink-0 whitespace-nowrap">
                    <HugeiconsIcon icon={ChampionIcon} size={13} aria-hidden />
                    You won {formatConfidential(BigInt(win.amount))}
                  </Badge>
                ) : (
                  <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                    Winner encrypted
                  </Badge>
                )}

                <a
                  href={explorerTxUrl(draw.txHash)}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.74rem] font-semibold text-muted hover:text-accent-deep"
                >
                  {shortenHash(draw.txHash)}
                  <HugeiconsIcon icon={LinkSquare02Icon} size={13} aria-hidden />
                </a>
              </li>
            );
          })}
        </ol>
      )}
    </Card>
  );
}
