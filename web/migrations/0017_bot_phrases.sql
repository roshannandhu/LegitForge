-- Regional phrases the team confirmed (bot/worker.ts phrasesOf; "phrase mg: ethra aakum = how much
-- will it cost" in WhatsApp, or Admin → WhatsApp → Settings). The AI is told the meaning of those a
-- message holds. Hints for reading, never company facts or prices.
CREATE TABLE IF NOT EXISTS bot_phrases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lang TEXT NOT NULL CHECK (lang IN ('en','ml','mg','hi','hg','kn','kg','ta','tg')),
  phrase TEXT NOT NULL CHECK (length(phrase) BETWEEN 2 AND 60),
  meaning TEXT NOT NULL CHECK (length(meaning) BETWEEN 2 AND 200),
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (lang, phrase)
);
