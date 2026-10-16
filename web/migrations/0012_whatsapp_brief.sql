-- WhatsApp bot phase 3 (bot/worker.ts): the one-page English brief written when a client's brief
-- is complete, and the files they sent: a JSON list of R2 keys under leads/<lead id>/ in the
-- MEDIA bucket, served only to admins (app/admin/leads/files/[...key]/route.ts).
ALTER TABLE leads ADD COLUMN brief TEXT;
ALTER TABLE leads ADD COLUMN files TEXT;
