-- The upgrade after phase 7 for a project that already ran schema.sql and 002-007: run once.
-- A contact step (the website chat, Messenger and Instagram give no number), and four more reply
-- languages: Hinglish (hg), Kanglish (kg), Tamil (ta), Tanglish (tg).
alter table public.contacts drop constraint if exists contacts_step_check;
alter table public.contacts add constraint contacts_step_check
  check (step in ('start','returning','service','language','name','business','need','details','refs','timeline','contact','done'));
alter table public.contacts drop constraint if exists contacts_lang_check;
alter table public.contacts add constraint contacts_lang_check
  check (lang in ('en','ml','mg','hi','hg','kn','kg','ta','tg'));

-- Knowledge with a history: an edit of an approved answer is a new version and the old one is
-- superseded (kept, never used; Admin → Answers can switch it back on); an answer can be archived;
-- one past its review date is not used until someone checks it again. Approving an answer for
-- (nearly) the same question supersedes the earlier one, so two answers never compete.
alter table public.knowledge drop constraint if exists knowledge_status_check;
alter table public.knowledge add constraint knowledge_status_check
  check (status in ('pending','approved','rejected','superseded','archived'));
alter table public.knowledge add column if not exists version int not null default 1;
alter table public.knowledge add column if not exists supersedes bigint references public.knowledge(id) on delete set null;
alter table public.knowledge add column if not exists review_at timestamptz;
create or replace function public.match_knowledge(query_embedding extensions.vector(768), match_threshold float, match_count int)
returns table (id bigint, question_en text, answer_en text, translations jsonb, translations_ok boolean, wins int, similarity float)
language sql stable set search_path = '' as $$
  select k.id, k.question_en, k.answer_en, k.translations, k.translations_ok, k.wins,
    1 - (k.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge k
  where k.status = 'approved' and k.embedding is not null and (k.review_at is null or k.review_at > now())
    and 1 - (k.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by k.embedding operator(extensions.<=>) query_embedding
  limit match_count
$$;
