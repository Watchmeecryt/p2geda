import { parseAbiItem } from 'viem';

/**
 * V5 vault event surface. Still no winner address — personal wins stay local decrypts.
 */
export const VAULT_EVENTS = {
  deposit: parseAbiItem(
    'event Deposited(address indexed account, uint40 timestamp, uint256 observationIndex)',
  ),
  withdrawal: parseAbiItem(
    'event Withdrawn(address indexed account, uint40 timestamp, uint256 observationIndex)',
  ),
  reserve: parseAbiItem('event PrizeReserveFunded(bytes32 indexed newReserveHandle)'),
  draw: parseAbiItem(
    'event RoundBegan(uint32 indexed drawId, uint40 periodStart, uint40 snapshotAt)',
  ),
  reveal_draw: parseAbiItem(
    'event RoundUnsealed(uint32 indexed drawId, uint64 r, uint128 totalWeight)',
  ),
  accrue: parseAbiItem('event EntrantScored(address indexed account, uint32 indexed drawId)'),
  claim: parseAbiItem('event PrizeClaimed(address indexed account, bytes32 indexed amountHandle)'),
  reveal: parseAbiItem(
    'event TotalPrizesPaidRevealRequested(uint32 indexed drawId, bytes32 indexed totalPaidHandle)',
  ),
} as const;

export type EventType = keyof typeof VAULT_EVENTS;

export const EVENT_TYPES = Object.keys(VAULT_EVENTS) as EventType[];

export const VAULT_EVENT_LIST = Object.values(VAULT_EVENTS);

export const EVENT_TYPE_BY_NAME = Object.fromEntries(
  Object.entries(VAULT_EVENTS).map(([type, item]) => [item.name, type as EventType]),
) as Record<string, EventType | undefined>;
