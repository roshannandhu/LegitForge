-- Phase 3 (the full requirement) for a project that already ran schema.sql, 002 and 003: run once.
-- Two new brief steps (the service's own question, websites they like) and the one reminder
-- after 3 quiet hours.
alter table public.contacts drop constraint if exists contacts_step_check;
alter table public.contacts add constraint contacts_step_check
  check (step in ('start','returning','service','language','name','business','need','details','refs','timeline','done'));
alter table public.contacts add column if not exists nudged_at timestamptz;
