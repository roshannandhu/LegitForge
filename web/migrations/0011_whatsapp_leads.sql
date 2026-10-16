-- WhatsApp bot leads (bot/worker.ts): the language the client chose. Name, phone, service and the
-- English brief (message) use the existing columns; source 'whatsapp' is already allowed (0001).
ALTER TABLE leads ADD COLUMN language TEXT;
