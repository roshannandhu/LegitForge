-- The upgrade after phase 7 for a project that already ran schema.sql and 002-007: run once.
-- A contact step (the website chat, Messenger and Instagram give no number), and four more reply
-- languages: Hinglish (hg), Kanglish (kg), Tamil (ta), Tanglish (tg).
alter table public.contacts drop constraint if exists contacts_step_check;
alter table public.contacts add constraint contacts_step_check
  check (step in ('start','returning','service','language','name','business','need','details','refs','timeline','contact','done'));
alter table public.contacts drop constraint if exists contacts_lang_check;
alter table public.contacts add constraint contacts_lang_check
  check (lang in ('en','ml','mg','hi','hg','kn','kg','ta','tg'));
