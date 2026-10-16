-- Phase 2 (self-learning) for a project that already ran schema.sql and 002_phase1.sql: run once.
-- Answers the bot sent by itself (kind 'auto', with the answer used), approved translations per
-- language, wins from won deals, and a settings table for the team's tone guide.
alter table public.questions drop constraint if exists questions_kind_check;
alter table public.questions add constraint questions_kind_check check (kind in ('question','draft','decision','price','auto'));
alter table public.questions add column if not exists knowledge_id bigint;
alter table public.knowledge add column if not exists translations jsonb not null default '{}';
alter table public.knowledge add column if not exists translations_ok boolean not null default false;
alter table public.knowledge add column if not exists wins int not null default 0;
alter table public.contacts add column if not exists won_counted boolean not null default false;

create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);
alter table public.settings enable row level security;
grant select, insert, update, delete on public.settings to service_role;

-- The search now also returns the approved translations and wins (a new return type: drop first).
drop function if exists public.match_knowledge(extensions.vector, float, int);
create function public.match_knowledge(query_embedding extensions.vector(768), match_threshold float, match_count int)
returns table (id bigint, question_en text, answer_en text, translations jsonb, translations_ok boolean, wins int, similarity float)
language sql stable set search_path = '' as $$
  select k.id, k.question_en, k.answer_en, k.translations, k.translations_ok, k.wins,
    1 - (k.embedding operator(extensions.<=>) query_embedding) as similarity
  from public.knowledge k
  where k.status = 'approved' and k.embedding is not null
    and 1 - (k.embedding operator(extensions.<=>) query_embedding) > match_threshold
  order by k.embedding operator(extensions.<=>) query_embedding
  limit match_count
$$;
revoke all on function public.match_knowledge(extensions.vector, float, int) from public, anon, authenticated;
grant execute on function public.match_knowledge(extensions.vector, float, int) to service_role;
