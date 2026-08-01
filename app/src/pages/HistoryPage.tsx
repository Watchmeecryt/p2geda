import { useAccount } from 'wagmi';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  ChampionIcon,
  Download01Icon,
  LinkSquare02Icon,
  Upload01Icon,
} from '@hugeicons/core-free-icons';
import { ConnectPrompt } from '@/components/layout/ConnectPrompt';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardSection } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { Skeleton } from '@/components/ui/Skeleton';
import { Stat } from '@/components/ui/Stat';
import { ConfidentialAmount } from '@/components/ConfidentialAmount';
import { PrivateViewToggle } from '@/components/PrivateViewToggle';
import { HistoryAmount } from '@/components/history/HistoryAmount';
import { useBlockTimestamps } from '@/hooks/useBlockTimestamps';
import {
  useDrawHistory,
  useMyActivity,
  useMyPrizeClaims,
  type ActivityEvent,
} from '@/hooks/usePoolHistory';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { useWinJournal, type WinEntry } from '@/hooks/useWinJournal';
import { CUSDC_MOCK_ADDRESS, VAULT_ADDRESS } from '@/lib/contracts';
import { explorerTxUrl } from '@/lib/chains';
import { formatConfidential, formatRelativeTime, shortenHash } from '@/lib/format';

const KIND_META = {
  deposit: { label: 'Deposit', icon: Download01Icon, hint: 'Balance after deposit' },
  withdrawal: { label: 'Withdrawal', icon: Upload01Icon, hint: 'Amount returned' },
  claim: { label: 'Prize claim', icon: ChampionIcon, hint: 'Amount claimed' },
} as const;

type TrackedKind = keyof typeof KIND_META;

function isTracked(event: ActivityEvent): event is ActivityEvent & { kind: TrackedKind } {
  return event.kind in KIND_META;
}

export function HistoryPage() {
  const { isConnected } = useAccount();
  const stats = usePoolStats();
  const position = useUserPosition();

  const view = usePrivateView({
    vaultHandles: [position.balanceHandle, position.claimableHandle],
    tokenHandles: [position.walletHandle],
  });

  const claimable = view.vaultValue(position.claimableHandle);
  const journal = useWinJournal({
    claimable,
    drawsCompleted: Number(stats.drawsCompleted),
    enabled: view.revealed && !view.decrypting,
  });

  const { data: activity, isLoading } = useMyActivity();
  const { data: claims = [] } = useMyPrizeClaims();
  const { data: draws = [] } = useDrawHistory();
  const rows = activity.filter(isTracked);
  const timestampOf = useBlockTimestamps([...rows, ...draws]);

  const hasUnclaimed =
    (claimable !== null && claimable > 0n) || journal.wins.some((win) => win.amount !== '0');

  if (!isConnected) {
    return (
      <div>
        <PageHeader
          kicker="History"
          title="Your positions and prizes"
          description="Every deposit, withdrawal, and claim you have made, with the encrypted amounts only your wallet can open."
        />
        <div className="mt-8">
          <ConnectPrompt
            title="Connect to see your history"
            description="History is built from your wallet's own onchain events. The indexer only ever stores encrypted handles, so amounts stay unreadable until you decrypt them here."
          />
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        kicker="History"
        title="Your positions and prizes"
        description="Every deposit, withdrawal, and claim you have made, with the encrypted amounts only your wallet can open."
        action={<PrivateViewToggle view={view} size="md" />}
      />

      <div className="mt-8 grid gap-5">
        <Card>
          <div className={`grid gap-6 ${claims.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
            <Stat
              label="Pool principal"
              value={
                <ConfidentialAmount
                  value={view.vaultValue(position.balanceHandle)}
                  decrypting={view.decrypting}
                  symbol={false}
                />
              }
              hint="Withdrawable at any time"
            />
            <Stat
              label="Unclaimed prizes"
              value={<ConfidentialAmount value={claimable} decrypting={view.decrypting} symbol={false} />}
              hint="Accrues privately when you win — claim from Draws"
            />
            {claims.length > 0 ? (
              <Stat
                label="Prize claims"
                value={claims.length.toString()}
                hint="Onchain claims from this wallet"
              />
            ) : null}
          </div>
        </Card>

        {claims.length > 0 ? (
          <Card flush>
            <CardSection>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-ink">Claimed prizes</h3>
                  <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
                    Draw winners stay private onchain. A claim is the durable record that you
                    received a payout — not which draw paid you.
                  </p>
                </div>
                <Badge tone="accent" className="shrink-0 whitespace-nowrap">
                  {claims.length}
                </Badge>
              </div>
            </CardSection>

            {claims.map((claim) => (
              <div key={claim.id} className="data-row">
                <span className="icon-tile icon-tile--accent size-9">
                  <HugeiconsIcon icon={ChampionIcon} size={17} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-semibold text-ink">Prize claimed</p>
                  <p className="text-[0.76rem] text-hint">
                    {claim.timestamp
                      ? formatRelativeTime(claim.timestamp)
                      : timestampOf(claim.blockNumber)
                        ? formatRelativeTime(timestampOf(claim.blockNumber)!)
                        : `block ${claim.blockNumber}`}
                  </p>
                </div>
                <HistoryAmount
                  handle={claim.handle}
                  contractAddress={CUSDC_MOCK_ADDRESS}
                  hasPermit={view.hasPermit}
                  label="+"
                />
              </div>
            ))}
          </Card>
        ) : hasUnclaimed ? (
          <Card flush>
            <CardSection>
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-ink">Unclaimed prize</h3>
                  <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
                    For privacy, draws are never linked to a winner address. When you win, the
                    amount is added to your encrypted balance — only you can decrypt and claim it.
                  </p>
                </div>
                <Badge tone="accent" className="shrink-0 whitespace-nowrap">
                  Private
                </Badge>
              </div>
            </CardSection>

            {journal.wins.length > 0
              ? journal.wins.map((win) => (
                  <JournalWinRow
                    key={`${win.drawId ?? 'agg'}-${win.at}`}
                    win={win}
                    draws={draws}
                    timestampOf={timestampOf}
                  />
                ))
              : claimable !== null && claimable > 0n ? (
                  <div className="data-row">
                    <span className="icon-tile icon-tile--accent size-9">
                      <HugeiconsIcon icon={ChampionIcon} size={17} aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.88rem] font-semibold text-ink">Encrypted prize balance</p>
                      <p className="text-[0.76rem] text-hint">
                        {(() => {
                          const latest = draws[0];
                          if (!latest) return 'Reveal on Draws to claim';
                          const at = latest.timestamp ?? timestampOf(latest.blockNumber);
                          return at ? formatRelativeTime(at) : 'From indexed draws';
                        })()}
                      </p>
                    </div>
                    <span className="numeral font-bold text-accent-deep">
                      +{formatConfidential(claimable)}
                    </span>
                  </div>
                ) : null}
          </Card>
        ) : null}

        <Card flush>
          <CardSection>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-ink">Onchain activity</h3>
                <p className="mt-1 text-[0.84rem] text-muted">
                  Public events from your wallet. The amounts stay encrypted until you open them.
                </p>
              </div>
              <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
                {rows.length}
              </Badge>
            </div>
          </CardSection>

          {isLoading && rows.length === 0 ? (
            <div className="space-y-3 p-5">
              {[0, 1, 2].map((row) => (
                <Skeleton key={row} className="h-14 w-full rounded-lg" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <EmptyState
              icon={<HugeiconsIcon icon={Analytics01Icon} size={22} aria-hidden />}
              title="Nothing here yet"
              description="Your first deposit will show up here within a block or two."
            />
          ) : (
            rows.map((event) => {
              const meta = KIND_META[event.kind];
              const timestamp = event.timestamp ?? timestampOf(event.blockNumber);
              const contract = event.kind === 'deposit' ? VAULT_ADDRESS : CUSDC_MOCK_ADDRESS;

              return (
                <div key={event.id} className="data-row flex-wrap">
                  <span className="icon-tile size-9">
                    <HugeiconsIcon icon={meta.icon} size={16} aria-hidden />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="text-[0.88rem] font-semibold text-ink">{meta.label}</p>
                    <p className="text-[0.76rem] text-hint">
                      {timestamp ? formatRelativeTime(timestamp) : `block ${event.blockNumber}`}
                      {' · '}
                      {meta.hint}
                    </p>
                  </div>

                  <HistoryAmount
                    handle={event.handle}
                    contractAddress={contract}
                    hasPermit={view.hasPermit}
                  />

                  <a
                    href={explorerTxUrl(event.txHash)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[0.74rem] font-semibold text-muted hover:text-accent-deep"
                  >
                    {shortenHash(event.txHash)}
                    <HugeiconsIcon icon={LinkSquare02Icon} size={13} aria-hidden />
                  </a>
                </div>
              );
            })
          )}
        </Card>
      </div>
    </div>
  );
}

function JournalWinRow({
  win,
  draws,
  timestampOf,
}: {
  win: WinEntry;
  draws: ActivityEvent[];
  timestampOf: (blockNumber: bigint) => number | undefined;
}) {
  const matched =
    win.drawId !== null
      ? draws.find((draw) => Number(draw.drawId ?? 0n) === win.drawId)
      : draws[0];
  const timestamp =
    matched?.timestamp ?? (matched ? timestampOf(matched.blockNumber) : undefined);

  return (
    <div className="data-row">
      <span className="icon-tile icon-tile--accent size-9">
        <HugeiconsIcon icon={ChampionIcon} size={17} aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[0.88rem] font-semibold text-ink">
          {win.drawId !== null ? `Won draw #${win.drawId}` : 'Encrypted prize balance'}
        </p>
        <p className="text-[0.76rem] text-hint">
          {timestamp ? formatRelativeTime(timestamp) : 'From indexed draws'}
        </p>
      </div>
      <span className="numeral font-bold text-accent-deep">
        +{formatConfidential(BigInt(win.amount))}
      </span>
    </div>
  );
}
