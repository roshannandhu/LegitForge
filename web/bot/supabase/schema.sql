-- Legit Forge WhatsApp bot: run once in Supabase → SQL editor (project in Mumbai).
-- The bot Worker (web/bot) reads and writes these tables through Supabase's REST API with a
-- secret key. Leads themselves live in the website's D1 database (Admin → Leads).
-- Row level security is on with no policies: only the secret key (service_role) can read them.

create extension if not exists vector with schema extensions;

-- One row per client (WhatsApp id). `code` is the team's handle for the client ("#K7Q2 take").
create table if not exists public.contacts (
  wa_id text primary key,
  phone text,                                   -- digits; empty when the client uses a WhatsApp username
  profile_name text,
  code text not null unique,
  lead_id text not null,                        -- the D1 leads.id for this enquiry; a new one after 30 quiet days
  lead_saved boolean not null default false,    -- inserted into D1 once; later turns only update (an admin delete lasts)
  won_counted boolean not null default false,   -- this chat's answers got their win (lead marked Won)
  nudged_at timestamptz,                        -- the one reminder after 3 quiet hours mid-brief
  step text not null default 'start' check (step in ('start','returning','service','language','name','business','need','details','refs','timeline','done')),
  mode text not null default 'bot' check (mode in ('bot','human','stopped','blocked')),
  taken_by text,                                -- team number chatting in person ("take")
  lang text check (lang in ('en','ml','mg','hi','kn')),
  service text,
  fields jsonb not null default '{}',           -- name, business, need, timeline, notes
  alerted_at timestamptz,
  busy_until timestamptz,                       -- one turn at a time per client
  turns int not null default 0,                 -- AI calls today (capped per client)
  turns_day date,
  last_in_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- Every message in and every team message out. wamid = WhatsApp's id: dedupes Meta's retries.
-- Team copies link a swipe-reply back to the client, question or answer they were about.
create table if not exists public.messages (
  wamid text primary key,
  wa_id text,                                   -- the client
  team text,                                    -- the team member (team messages only)
  dir text not null check (dir in ('in','out')),
  body text,
  reply_id text,                                -- menu / button id, or "[audio]" etc.
  ctx_id text,                                  -- the message this one replies to
  profile text,
  question_id bigint,
  knowledge_id bigint,
  handled_at timestamptz,
  at timestamptz not null default now()
);
create index if not exists messages_client on public.messages (wa_id, at);
create index if not exists messages_team on public.messages (team, at) where team is not null;
create index if not exists messages_unhandled on public.messages (at) where handled_at is null and dir = 'in';

-- Questions the bot asked the team.
create table if not exists public.questions (
  id bigint generated always as identity primary key,
  wa_id text not null references public.contacts(wa_id) on delete cascade,
  wamid text unique,                            -- the client message it came from (a retried turn reuses the row)
  question text not null,
  question_en text not null,
  status text not null default 'pending' check (status in ('pending','answered')),
  kind text not null default 'question' check (kind in ('question','draft','decision','price','auto')),   -- auto: the bot answered itself
  knowledge_id bigint,                          -- the approved answer an 'auto' reply used
  draft text,                                   -- the bot's suggested reply (client's language), sent on [Send]
  draft_en text,
  answer text,
  answered_by text,
  answered_at timestamptz,
  client_told_at timestamptz,                   -- the 10-minute "team will reply" message
  created_at timestamptz not null default now()
);
create index if not exists questions_pending on public.questions (created_at) where status = 'pending';

-- What the bot may answer by itself. Team answers start as 'pending' and are used only once a
-- team member taps Approve. source 'site' = seeded from the website's FAQ (bot/seed.ts).
create table if not exists public.knowledge (
  id bigint generated always as identity primary key,
  question_en text not null,
  answer_en text not null,
  embedding extensions.vector(768),
  translations jsonb not null default '{}',     -- ml, mg, hi, kn: the same answer, once
  translations_ok boolean not null default false, -- the team approved those translations
  wins int not null default 0,                  -- chats that used it became won deals
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  source text not null check (source in ('site','team')),
  question_id bigint references public.questions(id) on delete set null,
  decided_by text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
-- ponytail: no vector index; a full scan is instant at a few hundred answers (add HNSW past ~10k)

-- The team's tone guide ('tone'), refreshed weekly.
create table if not exists public.settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

create or replace function public.match_knowledge(query_embedding extensions.vector(768), match_threshold float, match_count int)
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

alter table public.contacts enable row level security;
alter table public.messages enable row level security;
alter table public.questions enable row level security;
alter table public.knowledge enable row level security;
alter table public.settings enable row level security;

-- Supabase no longer exposes new tables to the REST API by default (from 30 Oct 2026): grant
-- the secret key's role explicitly, and nobody else.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.contacts, public.messages, public.questions, public.knowledge, public.settings to service_role;
grant usage, select on all sequences in schema public to service_role;
revoke all on function public.match_knowledge(extensions.vector, float, int) from public, anon, authenticated;
grant execute on function public.match_knowledge(extensions.vector, float, int) to service_role;
