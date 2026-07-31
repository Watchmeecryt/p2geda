-- Per-wallet prize claims.
--
-- The vault never emits who won a draw (that would break confidentiality). The only
-- durable onchain signal that an address received a prize is PrizeClaimed. This table
-- is that signal, shaped for the History "Draws won" / Wins UI so a claim is visible
-- even when the browser never decrypted the unclaimed balance first.
--
-- amount_handle stays an FHE ciphertext. draw_id is the most recent DrawCompleted at
-- or before the claim — a best-effort label when several wins were claimed together.

create table if not exists public.prize_claims (
  id uuid primary key default gen_random_uuid(),

  chain_id bigint not null,
  vault_address text not null,
  account_address text not null,

  -- FHE handle owned by the confidential token (same as vault_events.claim rows).
  amount_handle text not null,

  -- Most recent draw completed at/before this claim. Null only if a claim somehow
  -- landed before any draw was indexed.
  draw_id bigint,

  tx_hash text not null,
  log_index integer not null,
  block_number bigint not null,
  block_timestamp timestamptz,

  created_at timestamptz not null default now(),

  unique (chain_id, tx_hash, log_index)
);

create index if not exists idx_prize_claims_account
  on public.prize_claims (
    chain_id,
    vault_address,
    lower(account_address),
    block_number desc
  );

create index if not exists idx_prize_claims_draw
  on public.prize_claims (chain_id, vault_address, draw_id desc)
  where draw_id is not null;

comment on table public.prize_claims is
  'Indexed PrizeClaimed rows. Used by History for Draws won; amounts stay encrypted.';

grant select on public.prize_claims to anon, authenticated;
grant select, insert, update, delete on public.prize_claims to service_role;

alter table public.prize_claims enable row level security;

drop policy if exists prize_claims_public_read on public.prize_claims;

create policy prize_claims_public_read
  on public.prize_claims
  for select
  to anon, authenticated
  using (true);

-- Backfill from any claims already sitting in vault_events so applying this migration
-- after a live indexer has been running does not require a full chain rescan.
insert into public.prize_claims (
  chain_id,
  vault_address,
  account_address,
  amount_handle,
  draw_id,
  tx_hash,
  log_index,
  block_number,
  block_timestamp
)
select
  c.chain_id,
  c.vault_address,
  lower(c.account_address),
  c.amount_handle,
  (
    select d.draw_id
    from public.vault_events d
    where d.chain_id = c.chain_id
      and d.vault_address = c.vault_address
      and d.event_type = 'draw'
      and d.draw_id is not null
      and (
        d.block_number < c.block_number
        or (d.block_number = c.block_number and d.log_index < c.log_index)
      )
    order by d.block_number desc, d.log_index desc
    limit 1
  ) as draw_id,
  c.tx_hash,
  c.log_index,
  c.block_number,
  c.block_timestamp
from public.vault_events c
where c.event_type = 'claim'
  and c.account_address is not null
  and c.amount_handle is not null
on conflict (chain_id, tx_hash, log_index) do nothing;
