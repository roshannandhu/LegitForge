-- Phase 1 (safe start) for a project that already ran schema.sql: run once in the SQL editor.
-- Blocked chats, the "same project or new?" step, and draft replies the team sends with one tap.
alter table public.contacts drop constraint if exists contacts_mode_check;
alter table public.contacts add constraint contacts_mode_check check (mode in ('bot','human','stopped','blocked'));
alter table public.contacts drop constraint if exists contacts_step_check;
alter table public.contacts add constraint contacts_step_check
  check (step in ('start','returning','service','language','name','business','need','timeline','done'));
alter table public.questions add column if not exists kind text not null default 'question';
alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check check (kind in ('question','draft','decision','price'));
alter table public.questions add column if not exists draft text;
alter table public.questions add column if not exists draft_en text;
