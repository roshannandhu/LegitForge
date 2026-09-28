-- Company details edited in Admin → Company (lib/company.ts): email, WhatsApp number and
-- greeting, social links with on/off, legal details. One row; the JSON is checked on save.
CREATE TABLE company (
  id         INTEGER PRIMARY KEY CHECK (id = 1),
  data       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
