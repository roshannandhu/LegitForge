-- Admin sign-in security (lib/admin/auth.ts, app/api/admin/session/route.ts).

-- One row per successful Google sign-in. The Google token's nonce is the key, so each token signs
-- in once only: a copied token can't be replayed. Also the sign-in log on Admin → Access.
CREATE TABLE admin_sign_ins (
  nonce TEXT PRIMARY KEY NOT NULL,
  email TEXT NOT NULL,
  at    TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX admin_sign_ins_at ON admin_sign_ins (at);

-- "Sign out everywhere" (Admin → Access): sessions issued at or before this moment (ms since the
-- epoch) are refused.
CREATE TABLE admin_security (
  id             INTEGER PRIMARY KEY CHECK (id = 1),
  sessions_after INTEGER NOT NULL DEFAULT 0
);
INSERT INTO admin_security (id, sessions_after) VALUES (1, 0);
