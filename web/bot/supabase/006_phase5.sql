-- Phase 5 (calls and sales) for a project that already ran schema.sql and 002-005: run once.
-- Calls booked on the team's Google Calendar (phase 5): reminded 30 minutes before.
create table if not exists public.calls (
  id bigint generated always as identity primary key,
  wa_id text not null references public.contacts(wa_id) on delete cascade,
  event_id text,                                -- the Google Calendar event (cancelled on DELETE MY DATA)
  start_at timestamptz not null,
  how text not null check (how in ('wa','ph','meet')),
  meet text,                                    -- the Google Meet link
  reminded boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists calls_due on public.calls (start_at) where not reminded;
create unique index if not exists calls_slot on public.calls (start_at);   -- one call per half hour: the booking's claim
alter table public.calls enable row level security;
grant select, insert, update, delete on public.calls to service_role;
-- A quote's reply passed to the team, the review request and its referral ask, the one revival
-- template, and the last payment link (a double tap sends one).
alter table public.contacts add column if not exists quote_at timestamptz;
alter table public.contacts add column if not exists review_at timestamptz;
alter table public.contacts add column if not exists referred_at timestamptz;
alter table public.contacts add column if not exists revived_at timestamptz;
alter table public.contacts add column if not exists pay_at timestamptz;
