import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAccount } from 'wagmi';

export type WinEntry = {
  drawId: number;
  /** Prize delta in confidential 6-decimal units, stored as a decimal string. */
  amount: string;
  at: number;
};

type Journal = {
  address: string | null;
  /** Claimable balance at the last reading, as a decimal string. */
  lastClaimable: string;
  lastDrawId: number;
  wins: WinEntry[];
};

const EMPTY: Journal = { address: null, lastClaimable: '0', lastDrawId: 0, wins: [] };

/** v3 drops the stale v1/v2 journals that falsely tagged every draw as “YOU WON 0.7999”. */
function storageKey(address: string): string {
  return `confipool.wins.v3.${address.toLowerCase()}`;
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
      wins: Array.isArray(parsed.wins) ? parsed.wins : [],
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
 * Personal wins are derived only from this wallet’s decrypted claimable balance.
 * The vault never emits a winner address (FHE selection stays encrypted), so the
 * draw feed alone cannot mark “YOU WON”. localStorage is only a watermark.
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

  return { wins: journal.wins, totalWon, celebrating, dismissCelebration };
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
  // A win is only a rise in claimable after at least one new draw settled.
  // First decrypt with a positive claimable also counts (prize landed while away).
  const sawNewDraw = drawsCompleted > journal.lastDrawId;
  const firstDecryptWithPrize =
    journal.lastDrawId === 0 && journal.wins.length === 0 && claimable > 0n;
  const won = claimable > previous && (sawNewDraw || firstDecryptWithPrize);

  if (!won) {
    return { journal: { ...journal, lastClaimable, lastDrawId: drawsCompleted }, win: null };
  }

  const delta = claimable - previous;
  if (delta <= 0n) {
    return { journal: { ...journal, lastClaimable, lastDrawId: drawsCompleted }, win: null };
  }

  const win: WinEntry = {
    drawId: drawsCompleted,
    amount: delta.toString(),
    at: Math.floor(Date.now() / 1000),
  };
  return {
    journal: {
      ...journal,
      lastClaimable,
      lastDrawId: drawsCompleted,
      wins: [win, ...journal.wins.filter((entry) => entry.drawId !== win.drawId)].slice(0, 50),
    },
    win,
  };
}
