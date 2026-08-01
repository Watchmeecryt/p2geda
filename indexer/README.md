# ConfiPool indexer

Polls `ConfidentialPrizeVault` logs on Sepolia and writes them to Supabase, so the dApp
reads its activity feed from one indexed query instead of scanning `eth_getLogs` from the
deployment block on every page load.

## Why this exists

The frontend used to rebuild the whole event history in the browser: seven event types x
every 45k-block chunk since deployment, on every mount, for every visitor. That is slow,
it hammers whatever RPC key is configured, and public providers rate-limit it well before
the pool has any real traffic. One background process doing the scan once is both cheaper
and faster to read.

## What gets stored

Only what the chain already publishes. Every amount column holds an **FHE ciphertext
handle**, never a plaintext value — a handle is useless without an onchain ACL grant, so
indexing it does not weaken the pool's confidentiality. Notably, the vault never emits
who won a draw, so there is nothing here that could reveal a winner.

### Events watched

All seven are emitted by the vault at `VAULT_ADDRESS`; nothing else is subscribed to.

| `event_type` | Solidity event |
| --- | --- |
| `deposit` | `DepositRecorded(address indexed account, bytes32 indexed newBalanceHandle)` |
| `withdrawal` | `WithdrawalRequested(address indexed account, bytes32 indexed amountHandle)` |
| `claim` | `PrizeClaimed(address indexed account, bytes32 indexed amountHandle)` → also written to `prize_claims` |
| `draw` | `DrawCompleted(uint256 indexed drawId, bytes32 indexed encryptedPrizeHandle)` |
| `reserve` | `PrizeReserveFunded(bytes32 indexed newReserveHandle)` |
| `prize_config` | `PrizePerDrawConfigured(bytes32 indexed prizeHandle)` |
| `reveal` | `TotalPrizesPaidRevealRequested(uint256 indexed drawId, bytes32 indexed totalPaidHandle)` |

### Columns

| Column | Notes |
| --- | --- |
| `event_type` | One of the seven above |
| `account_address` | Present on the three per-wallet events; null on pool-wide ones |
| `amount_handle` | `bytes32` FHE handle. Deposit handles belong to the vault, withdrawal/claim handles to the cToken |
| `draw_id` | Set on `draw` and `reveal` |
| `block_timestamp` | Resolved here so the client never calls `eth_getBlock` |

## Setup

1. Apply the schemas in [`../supabase/migrations/`](../supabase/migrations/)
   (`001_vault_events.sql`, then `002_prize_claims.sql`) via the Supabase SQL editor
   or `supabase db push`.
2. Fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env` (Project settings →
   API → `service_role`). This key bypasses RLS and must stay server-side — the browser
   gets the separate anon key via `VITE_SUPABASE_ANON_KEY` in `../app/.env`. Everything
   else in `.env` is already set for the deployed Sepolia vault.
3. Set `RPC_URL` to a provider key. **A free public endpoint will not work**: they
   serve `eth_getLogs` only over the last few hundred blocks and reject anything older
   with `Archive requests require a personal token`. An Alchemy free plan covers this
   comfortably — one poll costs about 85 compute units (`eth_blockNumber` + a single
   `eth_getLogs` covering all seven events), so the default 15s interval runs at roughly
   15M of the 300M monthly units. Raise `POLL_INTERVAL_MS` if you want more headroom.
4. Install and run:

```bash
npm install
npm run backfill        # one pass from DEPLOYMENT_BLOCK, ignoring the stored cursor
npm start               # Railway default: event indexer + keeper together
npm run start:indexer   # event polling only (local)
npm run start:keeper    # yield/draw keeper only (local)
```

### Railway

Point the service **Root Directory** at `indexer`. Nixpacks runs `npm ci` then
`npm start`, which launches **both** the log indexer (`src/run.ts`) and the
keeper (`src/keeper.ts`) under one deployment with the same env vars
(`RPC_URL`, `VAULT_ADDRESS`, Supabase keys, optional `OWNER_PRIVATE_KEY` for allocate/harvest, …).

## Draw keeper

Uses **`@zama-fhe/sdk` RelayerNode** plus the vault owner key for **allocate / harvest /
prize sizing**. Bus **`draw()` is permissionless** — any wallet (or the Draws UI) can
call it when the deposit window and interval have elapsed; idle redraws stay owner-only.

Each tick:

1. **Allocate** (if `allocatedUnderlying == 0`): `requestTotalPrincipalReveal` →
   `publicDecrypt` → encrypt unwrap → `requestAllocate` → `publicDecrypt` burnt
   handle → `finalizeAllocate`
2. **Accrue** fake APR into MockYield4626 (clear venue)
3. **Harvest + encrypt**: `harvestClear` → encrypt **100%** into reserve →
   `setPrizePerDraw` to only `prizeShareBps` (padding stays encrypted in reserve)
4. **Draw** when `nextDrawAt` is due (same permissionless bus path as the UI)

| Knob | Where it lives |
| --- | --- |
| Draw interval | Onchain `DRAW_INTERVAL_SECONDS` at deploy |
| Prize share of each harvest paid per draw | Onchain `prizeShareBps` (default 8000 = 80%; rest stays in encrypted reserve) |
| Poll interval | `KEEPER_POLL_INTERVAL_MS` |
| Signer + RelayerNode identity | `OWNER_PRIVATE_KEY` must match `vault.owner()` (allocate / harvest / idle redraw only) |

```bash
npm run keeper        # forever
npm run keeper:once   # one tick
```

Needs `RPC_URL`, `VAULT_ADDRESS`, and `OWNER_PRIVATE_KEY` for the allocate/harvest legs.
Does **not** need Supabase. Sepolia RelayerNode needs no API key; mainnet cutover is in
`src/relayer.ts`. Bus draws do **not** require publishing an owner key — anyone can call
`draw()` when due.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| `Archive requests require a personal token` | `RPC_URL` is a keyless public endpoint. Those serve logs only for roughly the last 100 blocks, so they can never reach `DEPLOYMENT_BLOCK` — no `LOG_CHUNK` value fixes this. Use a provider key (setup step 3). |
| `you can make eth_getLogs requests with up to a 10 block range` | Alchemy's free tier caps each span at 10 blocks. Set `LOG_CHUNK=10` (the default). The indexer also halves any rejected chunk automatically, so it recovers on its own. |
| Backfill is slow | Each pass costs `blocks / LOG_CHUNK` requests, and the free-tier cap of 10 makes that ~100 requests per 1000 blocks. A paid plan lifts the cap; raise `LOG_CHUNK` to a few thousand. |
| `Missing required environment variable` | `.env` is incomplete — indexer needs `SUPABASE_*`, `RPC_URL`, `VAULT_ADDRESS`; keeper needs `OWNER_PRIVATE_KEY`, `RPC_URL`, `VAULT_ADDRESS`. |
| Rows never appear in Supabase | The service-role key is wrong, or the migration has not been applied. |
| Keeper says owner mismatch | `OWNER_PRIVATE_KEY` is not the wallet that deployed / owns the vault. |
| Keeper always skips | Prize not configured, reserve empty, no depositors, or the interval has not elapsed — check Admin page readiness. |

## Commands

| Command | Behaviour |
| --- | --- |
| `npm start` | **Railway default.** Runs event indexer + keeper together (`src/start-both.ts`). |
| `npm run start:indexer` | Poll forever, every `POLL_INTERVAL_MS`. A failed pass is logged and retried on the next tick. |
| `npm run once` | Single pass from the stored cursor, then exit. Useful for cron. |
| `npm run backfill` | Single pass from `DEPLOYMENT_BLOCK`, re-reading everything. Safe to repeat. |
| `npm run start:keeper` / `npm run keeper` | Poll forever: allocate after deposit window → accrue/harvest → `draw()` when due. |
| `npm run keeper:once` | One tick (yield + maybe one draw), then exit. |
| `npm run typecheck` | `tsc --noEmit` |

## Cursor and reorgs

The resume point lives in `indexer_state`, keyed by `(chain_id, vault_address)`, so
redeploying the container never loses progress and a new vault address starts clean.

Scanning stops `CONFIRMATIONS` blocks behind the tip. Rows upsert on
`(chain_id, tx_hash, log_index)` with `ignoreDuplicates`, so re-reading a range is free
and a shallow reorg is repaired rather than duplicated. A reorg deeper than the
confirmation lag would need `npm run backfill`.

## Deploying to Railway

Set the service root directory to `indexer/`; [`nixpacks.toml`](./nixpacks.toml) handles
the rest. Provide the same variables as `.env.example` in the Railway dashboard.

Run **two** workers if you want both indexing and automated draws:

1. Start command `npm start` — log indexer (needs Supabase + RPC).
2. Start command `npm run keeper` — allocate / harvest keeper (optional `OWNER_PRIVATE_KEY` + RPC; bus draw is permissionless).

Neither process is a web service, so they need no port binding or health check.
