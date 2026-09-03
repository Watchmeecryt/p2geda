import { useMemo, useState } from 'react';
import { useAccount } from 'wagmi';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Analytics01Icon,
  ChampionIcon,
  DiceIcon,
  Download01Icon,
  LinkSquare02Icon,
  MoneyBag02Icon,
  SparklesIcon,
  Upload01Icon,
  ViewIcon,
} from '@hugeicons/core-free-icons';
import type { IconSvgElement } from '@hugeicons/react';
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
import {
  HistoryPagination,
  useHistoryPagination,
} from '@/components/history/HistoryPagination';
import { useBlockTimestamps } from '@/hooks/useBlockTimestamps';
import {
  useDrawHistory,
  useMyActivity,
  useMyPrizeClaims,
  usePoolActivity,
  type ActivityEvent,
  type ActivityKind,
} from '@/hooks/usePoolHistory';
import { usePoolStats, useUserPosition } from '@/hooks/usePoolData';
import { usePrivateView } from '@/hooks/usePrivateView';
import { useWinJournal, type WinEntry } from '@/hooks/useWinJournal';
import { CUSDC_MOCK_ADDRESS, VAULT_ADDRESS } from '@/lib/contracts';
import { explorerTxUrl } from '@/lib/chains';
import {
  formatConfidential,
  formatRelativeTime,
  shortenAddress,
  shortenHash,
} from '@/lib/format';
import { cn } from '@/lib/utils';

type Tab = 'global' | 'mine';

const GLOBAL_META: Record<
  ActivityKind,
  { label: string; icon: IconSvgElement; hint: string }
> = {
  deposit: { label: 'Deposit', icon: Download01Icon, hint: 'Joined / topped up the pool' },
  withdrawal: { label: 'Withdrawal', icon: Upload01Icon, hint: 'Principal exit' },
  draw: { label: 'Draw opened', icon: DiceIcon, hint: 'TWAB window frozen + encrypted R' },
  reveal_draw: {
    label: 'Draw revealed',
    icon: ViewIcon,
    hint: 'R + totalWeight published',
  },
  accrue: {
    label: 'Accrued',
    icon: SparklesIcon,
    hint: 'Tier evaluated — amount stays encrypted (often 0 for non-winners)',
  },
  claim: { label: 'Prize claim', icon: ChampionIcon, hint: 'Encrypted payout claimed' },
  reserve: { label: 'Reserve funded', icon: MoneyBag02Icon, hint: 'Admin prize top-up' },
  reveal: {
    label: 'Prizes-paid published',
    icon: Analytics01Icon,
    hint: 'Public aggregate unlock',
  },
};

const MINE_META = {
  deposit: { label: 'Deposit', icon: Download01Icon, hint: 'Balance after deposit' },
  withdrawal: { label: 'Withdrawal', icon: Upload01Icon, hint: 'Amount returned' },
  claim: { label: 'Prize claim', icon: ChampionIcon, hint: 'Amount claimed' },
} as const;

type MineKind = keyof typeof MINE_META;

function isMineTracked(event: ActivityEvent): event is ActivityEvent & { kind: MineKind } {
  return event.kind in MINE_META;
}

export function HistoryPage() {
  const [tab, setTab] = useState<Tab>('global');
  const { isConnected, address } = useAccount();
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
    enabled: view.revealed && !view.decrypting && isConnected,
  });

  const globalQuery = usePoolActivity();
  const myQuery = useMyActivity();
  const { data: claims = [] } = useMyPrizeClaims();
  const { data: draws = [] } = useDrawHistory();

  const globalRows = globalQuery.data ?? [];
  const mineRows = useMemo(
    () => (myQuery.data ?? []).filter(isMineTracked),
    [myQuery.data],
  );

  const timestampOf = useBlockTimestamps([...globalRows, ...draws, ...mineRows]);

  const hasUnclaimed =
    (claimable !== null && claimable > 0n) || journal.wins.some((win) => win.amount !== '0');

  return (
    <div>
      <PageHeader
        kicker="History"
        title="Pool activity"
        description="Global feed is every indexed vault event. Mine is only your wallet — amounts stay encrypted until you decrypt."
        action={tab === 'mine' && isConnected ? <PrivateViewToggle view={view} size="md" /> : undefined}
      />

      <div
        role="tablist"
        aria-label="History scope"
        className="mt-6 flex gap-1 rounded-full border border-strong bg-surface p-1 sm:max-w-md"
      >
        <TabButton active={tab === 'global'} onClick={() => setTab('global')} label="Global" />
        <TabButton active={tab === 'mine'} onClick={() => setTab('mine')} label="Mine" />
      </div>

      {tab === 'global' ? (
        <GlobalFeed
          key="global"
          rows={globalRows}
          isLoading={globalQuery.isLoading}
          timestampOf={timestampOf}
          myAddress={address}
        />
      ) : !isConnected ? (
        <div className="mt-8">
          <ConnectPrompt
            title="Connect to see your history"
            description="Your deposits, withdrawals, and claims stay tied to this wallet. Amounts are encrypted handles until you decrypt."
          />
        </div>
      ) : (
        <MineFeed
          key="mine"
          view={view}
          position={position}
          claimable={claimable}
          claims={claims}
          draws={draws}
          journal={journal}
          hasUnclaimed={hasUnclaimed}
          rows={mineRows}
          isLoading={myQuery.isLoading}
          timestampOf={timestampOf}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        'inline-flex flex-1 items-center justify-center rounded-full px-4 py-2 text-[0.85rem] font-semibold transition-colors',
        active ? 'btn-ink' : 'text-muted hover:text-ink',
      )}
    >
      {label}
    </button>
  );
}

function GlobalFeed({
  rows,
  isLoading,
  timestampOf,
  myAddress,
}: {
  rows: ActivityEvent[];
  isLoading: boolean;
  timestampOf: (blockNumber: bigint) => number | undefined;
  myAddress: `0x${string}` | undefined;
}) {
  const pagination = useHistoryPagination(rows);
  const pageRows = pagination.slice;

  return (
    <Card flush className="mt-6">
      <CardSection>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-bold text-ink">Indexed vault events</h3>
            <p className="mt-1 text-[0.84rem] text-muted">
              Written by the indexer from onchain logs. Amounts are never plaintext — only
              event type, account, and tx.
            </p>
          </div>
          <Badge tone="neutral" className="shrink-0 whitespace-nowrap">
            {rows.length}
          </Badge>
        </div>
      </CardSection>

      {isLoading && rows.length === 0 ? (
        <div className="space-y-3 p-5">
          {[0, 1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={<HugeiconsIcon icon={Analytics01Icon} size={22} aria-hidden />}
          title="No indexed events yet"
          description="Start the indexer against this vault, then fund / deposit / draw. New rows appear here within a poll."
        />
      ) : (
        <>
          {pageRows.map((event) => {
            const meta = GLOBAL_META[event.kind] ?? {
              label: event.kind,
              icon: Analytics01Icon,
              hint: 'Indexed event',
            };
            const timestamp = event.timestamp ?? timestampOf(event.blockNumber);
            const isMine =
              myAddress &&
              event.account &&
              event.account.toLowerCase() === myAddress.toLowerCase();

            return (
              <div key={event.id} className="data-row flex-wrap">
                <span className="icon-tile size-9">
                  <HugeiconsIcon icon={meta.icon} size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.88rem] font-semibold text-ink">
                    {meta.label}
                    {event.drawId !== undefined ? (
                      <span className="numeral text-muted"> · #{event.drawId.toString()}</span>
                    ) : null}
                    {isMine ? (
                      <Badge tone="accent" className="ml-2 align-middle">
                        You
                      </Badge>
                    ) : null}
                  </p>
                  <p className="text-[0.76rem] text-hint">
                    {timestamp ? formatRelativeTime(timestamp) : `block ${event.blockNumber}`}
                    {event.account ? ` · ${shortenAddress(event.account)}` : ''}
                    {' · '}
                    {meta.hint}
                  </p>
                </div>
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
          })}
          <HistoryPagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            totalItems={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={pagination.setPage}
          />
        </>
      )}
    </Card>
  );
}

function MineFeed({
  view,
  position,
  claimable,
  claims,
  draws,
  journal,
  hasUnclaimed,
  rows,
  isLoading,
  timestampOf,
}: {
  view: ReturnType<typeof usePrivateView>;
  position: ReturnType<typeof useUserPosition>;
  claimable: bigint | null;
  claims: ReturnType<typeof useMyPrizeClaims>['data'];
  draws: ActivityEvent[];
  journal: ReturnType<typeof useWinJournal>;
  hasUnclaimed: boolean;
  rows: Array<ActivityEvent & { kind: MineKind }>;
  isLoading: boolean;
  timestampOf: (blockNumber: bigint) => number | undefined;
}) {
  const claimList = claims ?? [];
  const claimsPagination = useHistoryPagination(claimList);
  const activityPagination = useHistoryPagination(rows);

  return (
    <div className="mt-6 grid gap-5">
      <Card>
        <div className={`grid gap-6 ${claimList.length > 0 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'}`}>
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
          {claimList.length > 0 ? (
            <Stat
              label="Prize claims"
              value={claimList.length.toString()}
              hint="Onchain claims from this wallet"
            />
          ) : null}
        </div>
      </Card>

      {claimList.length > 0 ? (
        <Card flush>
          <CardSection>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-ink">Claimed prizes</h3>
                <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
                  A claim is the durable record that you received a payout — not which draw paid
                  you.
                </p>
              </div>
              <Badge tone="accent" className="shrink-0 whitespace-nowrap">
                {claimList.length}
              </Badge>
            </div>
          </CardSection>
          {claimsPagination.slice.map((claim) => (
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
          <HistoryPagination
            page={claimsPagination.page}
            totalPages={claimsPagination.totalPages}
            totalItems={claimsPagination.total}
            pageSize={claimsPagination.pageSize}
            onPageChange={claimsPagination.setPage}
          />
        </Card>
      ) : hasUnclaimed ? (
        <Card flush>
          <CardSection>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="font-bold text-ink">Unclaimed prize</h3>
                <p className="mt-1 text-[0.84rem] leading-relaxed text-muted">
                  Wins land in your encrypted balance — only you can decrypt and claim.
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
                    <p className="text-[0.76rem] text-hint">Reveal on Draws to claim</p>
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
              <h3 className="font-bold text-ink">Your onchain activity</h3>
              <p className="mt-1 text-[0.84rem] text-muted">
                Deposits, withdrawals, and claims from this wallet. Decrypt to read amounts.
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
            description="Your first deposit will show up here once the indexer (or RPC fallback) sees it."
          />
        ) : (
          <>
            {activityPagination.slice.map((event) => {
              const meta = MINE_META[event.kind];
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
                  {event.handle ? (
                    <HistoryAmount
                      handle={event.handle}
                      contractAddress={contract}
                      hasPermit={view.hasPermit}
                    />
                  ) : (
                    <span className="text-[0.76rem] text-hint">onchain</span>
                  )}
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
            })}
            <HistoryPagination
              page={activityPagination.page}
              totalPages={activityPagination.totalPages}
              totalItems={activityPagination.total}
              pageSize={activityPagination.pageSize}
              onPageChange={activityPagination.setPage}
            />
          </>
        )}
      </Card>
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
