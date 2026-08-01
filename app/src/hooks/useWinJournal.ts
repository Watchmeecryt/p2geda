import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

export type WinEntry = {
  /**
   * Draw number when we can attribute the prize to exactly one new draw.
   * `null` when claimable rose across an unknown span (first decrypt / missed draws).
   */
  drawId: number | null;
  /** Prize delta in confidential 6-decimal units, stored as a decimal string. */
  amount: string;
  at: number;
  /** Draws that elapsed while this delta accumulated (when drawId is null). */
  drawSpan?: number;
};

type Journal = {
  address: string | null;
  /** Claimable balance at the last reading, as a decimal string. */
  lastClaimable: string;
  lastDrawId: number;
  wins: WinEntry[];
};

const EMPTY: Journal = { address: null, lastClaimable: '0', lastDrawId: 0, wins: [] };

/**
 * v4: stop pinning a first/late decrypt of the full claimable pile onto the latest draw.
 * Only exact single-draw deltas get a drawId; otherwise the win is unattributed.
 */
function storageKey(address: string): string {
  return `confipool.wins.v4.${address.toLowerCase()}`;
}

function readJournal(address: string | null): Journal {
  if (!address) return EMPTY;
  try {
    const raw = window.localStorage.getItem(storageKey(address));
    if (!raw) return { ...EMPTY, address };
    const parsed = JSON.parse(raw) as Partial<Journal>;
    return {
      address,
      lastClaimable: parsed.lastClaimable ?? '0',
      lastDrawId: parsed.lastDrawId ?? 0,
      wins: Array.isArray(parsed.wins) ? (parsed.wins as WinEntry[]) : [],
    };
  } catch {
    return { ...EMPTY, address };
  }
}

function writeJournal(journal: Journal): void {
  if (!journal.address) return;
  try {
    const { address, ...persisted } = journal;
    window.localStorage.setItem(storageKey(address), JSON.stringify(persisted));
  } catch {
    // Ignore quota / private-mode failures.
  }
}

/**
 * Personal wins are inferred from this wallet’s decrypted claimable only.
 * The vault never emits a winner address (FHE selection stays encrypted), so the
 * indexer cannot mark “YOU WON”. Claiming is not required — decrypting is.
 * Round attribution only works when claimable rises across exactly one new draw.
 */
export function useWinJournal(input: {
  claimable: bigint | null;
  drawsCompleted: number;
  enabled: boolean;
}) {
  const { claimable, drawsCompleted, enabled } = input;
  const { address } = useAccount();
  const currentAddress = address ?? null;

  const [journal, setJournal] = useState<Journal>(() => readJournal(currentAddress));
  const [celebrating, setCelebrating] = useState<WinEntry | null>(null);

  if (journal.address !== currentAddress) {
    setJournal(readJournal(currentAddress));
    setCelebrating(null);
  } else if (enabled && currentAddress && claimable !== null) {
    const next = advance(journal, claimable, drawsCompleted);
    if (next) {
      setJournal(next.journal);
      if (next.win) setCelebrating(next.win);
    }
  }

  useEffect(() => {
    writeJournal(journal);
  }, [journal]);

  const dismissCelebration = useCallback(() => setCelebrating(null), []);

  const totalWon = useMemo(
    () => journal.wins.reduce((sum, win) => sum + BigInt(win.amount), 0n),
    [journal.wins],
  );

  const attributedWins = useMemo(
    () => journal.wins.filter((win) => win.drawId !== null),
    [journal.wins],
  );

  const unattributedWins = useMemo(
    () => journal.wins.filter((win) => win.drawId === null),
    [journal.wins],
  );

  return {
    wins: journal.wins,
    attributedWins,
    unattributedWins,
    totalWon,
    celebrating,
    dismissCelebration,
  };
}

function advance(
  journal: Journal,
  claimable: bigint,
  drawsCompleted: number,
): { journal: Journal; win: WinEntry | null } | null {
  const lastClaimable = claimable.toString();
  if (journal.lastClaimable === lastClaimable && journal.lastDrawId === drawsCompleted) {
    return null;
  }

  const previous = BigInt(journal.lastClaimable);
  const drawGap = Math.max(0, drawsCompleted - journal.lastDrawId);
  const firstDecryptWithPrize =
    journal.lastDrawId === 0 && journal.wins.length === 0 && claimable > 0n;
  const rose = claimable > previous;

  if (!rose && !firstDecryptWithPrize) {
    return { journal: { ...journal, lastClaimable, lastDrawId: drawsCompleted }, win: null };
  }

  const delta = firstDecryptWithPrize && previous === 0n ? claimable : claimable - previous;
  if (delta <= 0n) {
    return { journal: { ...journal, lastClaimable, lastDrawId: drawsCompleted }, win: null };
  }

  // Exact attribution only when we watched claimable rise across a single new draw.
  const exactDraw =
    !firstDecryptWithPrize && rose && journal.lastDrawId > 0 && drawGap === 1
      ? drawsCompleted
      : null;

  const win: WinEntry = {
    drawId: exactDraw,
    amount: delta.toString(),
    at: Math.floor(Date.now() / 1000),
    ...(exactDraw === null && drawGap > 0 ? { drawSpan: firstDecryptWithPrize ? drawsCompleted : drawGap } : {}),
  };

  const remaining =
    exactDraw === null
      ? journal.wins.filter((entry) => entry.drawId !== null)
      : journal.wins.filter((entry) => entry.drawId !== exactDraw);

  return {
    journal: {
      ...journal,
      lastClaimable,
      lastDrawId: drawsCompleted,
      wins: [win, ...remaining].slice(0, 50),
    },
    win,
  };
}
