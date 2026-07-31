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

function storageKey(address: string): string {
  return `confipool.wins.${address.toLowerCase()}`;
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
    // A full or blocked localStorage only costs the local journal, never onchain state.
  }
}

/**
 * Per-draw win history cannot come from onchain logs: the vault deliberately never emits
 * who won, and every depositor's claim transfers an encrypted amount. So the app derives
 * it from the wallet's own decrypted claimable balance — a rise between draws is a win.
 *
 * The journal persists to localStorage because the watermark has to survive reloads to
 * catch a prize that landed while the tab was closed. Detection happens during render
 * (adjusting state on changed input) and the effect only mirrors the result to storage.
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

/**
 * Folds a fresh claimable reading into the journal. Returns `null` when nothing moved so
 * the caller can skip the state update and avoid a render loop.
 */
function advance(
  journal: Journal,
  claimable: bigint,
  drawsCompleted: number,
): { journal: Journal; win: WinEntry | null } | null {
  const lastClaimable = claimable.toString();
  if (journal.lastClaimable === lastClaimable && journal.lastDrawId === drawsCompleted) {
    return null;
  }

  // Claimable only ever rises inside draw() and is zeroed by claim(), so a positive
  // balance on the very first reading is necessarily an unclaimed prize. Treating that
  // reading as a mere baseline would hide a draw won before this browser first decrypted.
  const firstReading = journal.lastDrawId === 0 && journal.wins.length === 0;
  const previous = firstReading ? 0n : BigInt(journal.lastClaimable);
  const won = claimable > previous && drawsCompleted > journal.lastDrawId;

  // A falling balance just means the wallet claimed, so the watermark rebases silently.
  if (!won) {
    return { journal: { ...journal, lastClaimable, lastDrawId: drawsCompleted }, win: null };
  }

  const win: WinEntry = {
    drawId: drawsCompleted,
    amount: (claimable - previous).toString(),
    at: Math.floor(Date.now() / 1000),
  };
  return {
    journal: {
      ...journal,
      lastClaimable,
      lastDrawId: drawsCompleted,
      wins: [win, ...journal.wins].slice(0, 50),
    },
    win,
  };
}
