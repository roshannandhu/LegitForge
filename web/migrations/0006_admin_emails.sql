-- migrations/0006_admin_emails.sql: who may sign in to /admin with Google, besides the owners in
-- the ADMIN_EMAILS secret (lib/admin/auth.ts). Added and removed in Admin → Access.

CREATE TABLE admin_emails (
  email    TEXT PRIMARY KEY NOT NULL CHECK (email = lower(email)),
  added_by TEXT NOT NULL,
  added_at TEXT NOT NULL DEFAULT (datetime('now'))
);
