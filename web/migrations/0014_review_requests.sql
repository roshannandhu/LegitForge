-- WhatsApp bot phase 5 (bot/worker.ts reviews()): a WhatsApp lead marked Won gets one Google
-- review request; this records that it went out.
ALTER TABLE leads ADD COLUMN review_asked_at TEXT;
-- leads won before this: not asked now (a request months later would surprise them)
UPDATE leads SET review_asked_at = datetime('now') WHERE status = 'won';
