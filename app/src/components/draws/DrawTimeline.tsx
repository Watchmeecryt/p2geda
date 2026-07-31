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

  const winByDraw = new Map(wins.map((win) => [win.drawId, win]));

  return (
    <Card flush>
      <CardSection>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="font-bold text-ink">Draw history</h3>
            <p className="mt-1 text-[0.84rem] text-muted">Every draw is onchain. Who won is not.</p>
          </div>
          <Badge tone="neutral">{draws.length} total</Badge>
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
            const drawId = Number(draw.drawId ?? 0n);
            const win = winByDraw.get(drawId);
            const timestamp = timestampOf(draw.blockNumber);

            return (
              <li key={draw.id} className="data-row flex-wrap">
                <span className="icon-tile size-9 text-[0.8rem] font-bold text-ink">
                  {drawId}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-semibold text-ink">Draw #{drawId}</p>
                  <p className="text-[0.76rem] text-hint">
                    {timestamp ? formatRelativeTime(timestamp) : `block ${draw.blockNumber}`}
                  </p>
                </div>

                {win ? (
                  <Badge tone="accent">
                    <HugeiconsIcon icon={ChampionIcon} size={13} aria-hidden />
                    {win.amount !== '0'
                      ? `You won ${formatConfidential(BigInt(win.amount))}`
                      : 'You won'}
                  </Badge>
                ) : (
                  <Badge tone="neutral">Winner encrypted</Badge>
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
