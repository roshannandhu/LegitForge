-- migrations/0001_init.sql

CREATE TABLE testimonials (
  id                   TEXT PRIMARY KEY,
  person_name          TEXT NOT NULL,
  person_role          TEXT,
  company              TEXT,
  quote                TEXT NOT NULL,
  photo_key            TEXT,
  video_key            TEXT,
  permission_confirmed INTEGER NOT NULL DEFAULT 0,
  is_published         INTEGER NOT NULL DEFAULT 0,
  created_at           TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE projects (
  id              TEXT PRIMARY KEY,
  slug            TEXT NOT NULL UNIQUE,
  title           TEXT NOT NULL,
  client_type     TEXT NOT NULL,                 -- "Bakery in [City]"
  category        TEXT NOT NULL CHECK (category IN ('static','dynamic','whatsapp','n8n')),
  summary         TEXT NOT NULL,
  challenge       TEXT,
  solution        TEXT,
  result_value    TEXT,                          -- "+38%"
  result_label    TEXT,                          -- "more enquiries in 60 days"
  stack           TEXT NOT NULL DEFAULT '[]',    -- JSON array
  live_url        TEXT,
  status_stamp    TEXT NOT NULL DEFAULT 'live' CHECK (status_stamp IN ('live','in-use','none')),
  last_checked_at TEXT,
  speed_before    INTEGER,
  speed_after     INTEGER,
  testimonial_id  TEXT REFERENCES testimonials(id),
  is_featured     INTEGER NOT NULL DEFAULT 0,
  is_published    INTEGER NOT NULL DEFAULT 0,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  launched_on     TEXT,                          -- ISO date
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE project_images (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  r2_key      TEXT NOT NULL,
  alt         TEXT NOT NULL,
  kind        TEXT NOT NULL CHECK (kind IN ('cover','gallery','before','after')),
  width       INTEGER,
  height      INTEGER,
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_project_images_project ON project_images (project_id, sort_order);

CREATE TABLE team_members (
  id                  TEXT PRIMARY KEY,
  slug                TEXT NOT NULL UNIQUE,
  name                TEXT NOT NULL,
  role                TEXT NOT NULL,
  id_code             TEXT NOT NULL UNIQUE,      -- "LF-001"
  bio                 TEXT NOT NULL,
  skills              TEXT NOT NULL DEFAULT '[]',
  tools               TEXT NOT NULL DEFAULT '[]',
  photo_key           TEXT,
  card_version        INTEGER NOT NULL DEFAULT 1,
  linkedin_url        TEXT,
  github_url          TEXT,
  website_url         TEXT,
  favorite_project_id TEXT REFERENCES projects(id),
  is_hiring_card      INTEGER NOT NULL DEFAULT 0,
  is_published        INTEGER NOT NULL DEFAULT 1,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE member_projects (
  member_id       TEXT NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  project_id      TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  role_on_project TEXT,
  PRIMARY KEY (member_id, project_id)
);

CREATE TABLE leads (
  id               TEXT PRIMARY KEY,
  source           TEXT NOT NULL CHECK (source IN ('form','whatsapp','demo')),
  name             TEXT,
  phone            TEXT,
  service          TEXT,
  budget           TEXT,
  message          TEXT,
  whatsapp_consent INTEGER NOT NULL DEFAULT 0,
  status           TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','quoted','won','lost')),
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_leads_status ON leads (status, created_at);

CREATE TABLE demo_sessions (
  code        TEXT PRIMARY KEY,                  -- 5 characters, stored without "LF-"
  phone_hash  TEXT,
  status      TEXT NOT NULL DEFAULT 'waiting' CHECK (status IN ('waiting','running','done')),
  created_at  INTEGER NOT NULL,                  -- epoch milliseconds
  expires_at  INTEGER NOT NULL
);
CREATE INDEX idx_demo_phone ON demo_sessions (phone_hash, expires_at);

CREATE TABLE wa_processed (                      -- de-duplicates webhook deliveries
  message_id  TEXT PRIMARY KEY,
  received_at INTEGER NOT NULL
);

CREATE TABLE wa_optouts (                        -- people who replied STOP
  phone_hash  TEXT PRIMARY KEY,
  at          INTEGER NOT NULL
);

CREATE TABLE rate_events (
  key  TEXT NOT NULL,
  at   INTEGER NOT NULL
);
CREATE INDEX idx_rate_events ON rate_events (key, at);

CREATE TABLE site_stats (                        -- 'projects_live', 'median_reply_minutes', 'last_launch'
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE events (                            -- first-party analytics (§14)
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  name     TEXT NOT NULL,
  props    TEXT NOT NULL DEFAULT '{}',
  country  TEXT,
  at       INTEGER NOT NULL
);
CREATE INDEX idx_events_name ON events (name, at);
