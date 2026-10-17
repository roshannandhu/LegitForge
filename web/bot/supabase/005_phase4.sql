-- Phase 4 (team workflow) for a project that already ran schema.sql, 002, 003 and 004: run once.
-- Alerts in turns: the first team members get a client's alert at once; `later` get it after
-- next_at if nobody has taken it up (worker.ts passOn()).
create table if not exists public.alerts (
  id bigint generated always as identity primary key,
  wa_id text references public.contacts(wa_id) on delete cascade,   -- null for a website form lead
  lead_id text,                                 -- a form lead (D1 leads.id)
  question_id bigint,
  body text not null,
  link jsonb not null default '{}',
  buttons jsonb,
  later text[] not null default '{}',
  next_at timestamptz,                          -- when `later` get it (null: done)
  created_at timestamptz not null default now()
);
create index if not exists alerts_due on public.alerts (next_at) where next_at is not null;
alter table public.alerts enable row level security;
grant select, insert, update, delete on public.alerts to service_role;
