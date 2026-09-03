-- V5 vault events: open/reveal/accrue lifecycle (plus keep legacy prize_config).
-- Run in Supabase SQL Editor if the CLI is not linked.

alter table public.vault_events drop constraint if exists vault_events_event_type_check;

alter table public.vault_events
  add constraint vault_events_event_type_check check (
    event_type in (
      'deposit',
      'withdrawal',
      'draw',
      'reveal_draw',
      'accrue',
      'claim',
      'reserve',
      'prize_config',
      'reveal'
    )
  );

comment on constraint vault_events_event_type_check on public.vault_events is
  'ConfiPool V5 event kinds indexed from ConfidentialPrizeVault logs.';
