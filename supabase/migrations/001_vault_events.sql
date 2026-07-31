-- ConfiPool vault activity index.
-- Run in the Supabase SQL editor (or `supabase db push`) against a PostgreSQL 14+ database.
--
-- The frontend reads this table with the anon key so it never has to scan Sepolia logs
-- itself; only the indexer, holding the service-role key, writes to it.
--
-- Nothing here is a plaintext amount. Every value column is an FHE ciphertext handle,
-- and the handle is worthless without an onchain ACL grant, so public read access does
-- not weaken the pool's confidentiality.

create extension if not exists "pgcrypto";

-- ─── Events ──────────────────────────────────────────────────────────────────

create table if not exists public.vault_events (
  id uuid primary key default gen_random_uuid(),

  chain_id bigint not null,
  vault_address text not null,

  event_type text not null check (
    event_type in (
      'deposit',
      'withdrawal',
      'draw',
      'claim',
      'reserve',
      'prize_config',
      'reveal'
    )
  ),

  -- Present on deposit / withdrawal / claim; null on pool-wide events.
  account_address text,

  -- FHE handle (bytes32 hex). Which contract owns it depends on event_type:
  -- deposit handles belong to the vault, withdrawal/claim handles to the cToken.
  amount_handle text,

  -- Set on draw and reveal rows.
  draw_id bigint,

  tx_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  block_timestamp timestamptz,

  created_at timestamptz not null default now(),

  unique (chain_id, tx_hash, log_index)
);

create index if not exists idx_vault_events_feed
  on public.vault_events (chain_id, vault_address, block_number desc, log_index desc);

create index if not exists idx_vault_events_account
  on public.vault_events (chain_id, vault_address, lower(account_address), block_number desc)
  where account_address is not null;

create index if not exists idx_vault_events_draws
  on public.vault_events (chain_id, vault_address, draw_id desc)
  where event_type = 'draw';

comment on table public.vault_events is
  'Indexed ConfiPool vault events. Amount columns hold FHE handles, never plaintext.';

-- ─── Indexer cursor ──────────────────────────────────────────────────────────

create table if not exists public.indexer_state (
  chain_id bigint not null,
  vault_address text not null,
  last_indexed_block bigint not null,
  updated_at timestamptz not null default now(),

  primary key (chain_id, vault_address)
);

comment on table public.indexer_state is
  'Resume point per (chain, vault). The indexer restarts from last_indexed_block + 1.';

-- ─── Data API: explicit grants + RLS ─────────────────────────────────────────
-- Frontend uses the anon key and only reads. The indexer uses the service-role key,
-- which bypasses RLS, so no write policy is defined for anon/authenticated.

grant select on public.vault_events to anon, authenticated;
grant select, insert, update, delete on public.vault_events to service_role;

grant select, insert, update, delete on public.indexer_state to service_role;

alter table public.vault_events enable row level security;
alter table public.indexer_state enable row level security;

drop policy if exists vault_events_public_read on public.vault_events;

create policy vault_events_public_read
  on public.vault_events
  for select
  to anon, authenticated
  using (true);

-- indexer_state is deliberately unreadable by clients: it is operational state,
-- not application data, and service_role bypasses RLS to maintain it.
