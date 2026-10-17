-- WhatsApp bot phase 4 (bot/worker.ts): who hears about a client first, and who is busy or off.
-- whatsapp: one of the bot's TEAM_WHATSAPP numbers (digits); services: a JSON list of the bot's
-- service keys (lib/wa-services.ts) this person gets first. Edited in Admin → Team; status also by
-- the bot commands "busy", "free" and "off".
CREATE TABLE bot_team (
  whatsapp     TEXT PRIMARY KEY,
  name         TEXT NOT NULL DEFAULT '',
  services     TEXT NOT NULL DEFAULT '[]',
  status       TEXT NOT NULL DEFAULT 'free' CHECK (status IN ('free','busy','off')),
  status_until TEXT,                                -- busy/off ends then (ISO); NULL = until changed
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);
-- Website form enquiries also reach the team through the bot (replaces n8n), and the first human
-- reply to every enquiry (the 2-hour promise, shown in Admin → Leads).
ALTER TABLE leads ADD COLUMN wa_alerted_at TEXT;
ALTER TABLE leads ADD COLUMN first_reply_at TEXT;
-- leads answered before this migration: their last contact is the best record of a first reply
UPDATE leads SET first_reply_at = last_contact_at WHERE last_contact_at IS NOT NULL;
