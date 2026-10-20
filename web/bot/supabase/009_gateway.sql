-- The WhatsApp Web gateway (web/gateway) on Render's free plan or the laptop: its login (Baileys'
-- creds and signal keys, "wa:…") and the bot's open polls ("poll:<id>"), kept here so a restart or a
-- move to the other machine keeps the link (no new QR). For a project that already ran 002–008.
create table if not exists public.wa_auth (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.wa_auth enable row level security;
grant select, insert, update, delete on public.wa_auth to service_role;
