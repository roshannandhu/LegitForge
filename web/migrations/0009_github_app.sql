-- migrations/0009_github_app.sql: the GitHub App that reads team members' private repos for
-- "Add from GitHub" (lib/admin/github-app.ts). One row: an owner connects it once from Admin →
-- Projects (GitHub's manifest flow); each team member then installs it on their own account and
-- picks the repos. key_enc is the app's private key, AES-GCM encrypted with a key derived from
-- the ADMIN_SESSION_KEY secret, so a copy of the database alone can't use it.

CREATE TABLE github_app (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  app_id       INTEGER NOT NULL,
  slug         TEXT NOT NULL,
  owner        TEXT NOT NULL,
  key_enc      TEXT NOT NULL,
  connected_by TEXT NOT NULL,
  connected_at TEXT NOT NULL DEFAULT (datetime('now'))
);
