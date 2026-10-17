-- Phase 7 (more channels) for a project that already ran schema.sql and 002-006: run once.
-- The buttons and list rows of the bot's messages, for the website's chat bubble.
alter table public.messages add column if not exists options jsonb;
