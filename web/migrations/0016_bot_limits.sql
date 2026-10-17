-- The website chat's limits (bot/worker.ts limited()): counters per chat per minute, per address
-- (a salted hash) and in all per hour, and the chats already seen. The bot purges them after a day.
CREATE TABLE IF NOT EXISTS bot_limits (
  key TEXT PRIMARY KEY,
  n INTEGER NOT NULL DEFAULT 1,
  at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS bot_limits_at ON bot_limits (at);
