-- WhatsApp bot phase 6 (Admin → WhatsApp): the bot's switch and away messages, the team's saved
-- replies ("#CODE /portfolio"), each lead's score (hot / warm / cold) and the page that brought it.
CREATE TABLE bot_settings (
  key        TEXT PRIMARY KEY,                     -- paused ('1' or ''), away, after_hours
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE bot_replies (
  key        TEXT PRIMARY KEY CHECK (length(key) BETWEEN 2 AND 24 AND key NOT GLOB '*[^a-z0-9-]*'),
  text       TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
ALTER TABLE leads ADD COLUMN score TEXT CHECK (score IN ('hot', 'warm', 'cold'));
ALTER TABLE leads ADD COLUMN page TEXT;              -- the site page whose button or form it came from
