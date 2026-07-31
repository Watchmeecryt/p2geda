import { parseAbiItem } from 'viem';

/**
 * The vault's full event surface. Deliberately absent: anything naming a winner.
 * The contract never emits it, which is why the app derives personal win history
 * from the wallet's own decrypted balance rather than from this feed.
 */
export const VAULT_EVENTS = {
  deposit: parseAbiItem(
    'event DepositRecorded(address indexed account, bytes32 indexed newBalanceHandle)',
  ),
  withdrawal: parseAbiItem(
    'event WithdrawalRequested(address indexed account, bytes32 indexed amountHandle)',
  ),
  reserve: parseAbiItem('event PrizeReserveFunded(bytes32 indexed newReserveHandle)'),
  prize_config: parseAbiItem('event PrizePerDrawConfigured(bytes32 indexed prizeHandle)'),
  draw: parseAbiItem(
    'event DrawCompleted(uint256 indexed drawId, bytes32 indexed encryptedPrizeHandle)',
  ),
  claim: parseAbiItem('event PrizeClaimed(address indexed account, bytes32 indexed amountHandle)'),
  reveal: parseAbiItem(
    'event TotalPrizesPaidRevealRequested(uint256 indexed drawId, bytes32 indexed totalPaidHandle)',
  ),
} as const;

export type EventType = keyof typeof VAULT_EVENTS;

export const EVENT_TYPES = Object.keys(VAULT_EVENTS) as EventType[];

/**
 * All seven events in one array so a scan can issue a single `eth_getLogs` with an
 * OR'd topic0 instead of one request per event type. On a metered RPC that is the
 * difference between 7 billable calls per poll and 1.
 */
export const VAULT_EVENT_LIST = Object.values(VAULT_EVENTS);

/** Maps the Solidity event name viem returns back to our stored `event_type`. */
export const EVENT_TYPE_BY_NAME = Object.fromEntries(
  Object.entries(VAULT_EVENTS).map(([type, item]) => [item.name, type as EventType]),
) as Record<string, EventType | undefined>;
