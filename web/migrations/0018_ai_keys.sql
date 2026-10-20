-- Migration 0018: Secure AI Key Vault, Multi-Provider Engine & Compulsory Team WhatsApp Numbers
-- Phase 3 & 4: Unlimited configurable AI keys with AES-256-GCM encryption, provider adapters and rotation
-- Phase 6: Compulsory WhatsApp phone numbers on team members synchronized to bot_team routing

CREATE TABLE IF NOT EXISTS ai_keys (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('gemini', 'groq', 'openrouter', 'deepseek', 'custom')),
  name TEXT NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  api_key_encrypted TEXT NOT NULL,
  key_nonce TEXT NOT NULL,
  key_version INTEGER NOT NULL DEFAULT 1,
  masked_key TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT '',
  base_url TEXT NOT NULL DEFAULT '',
  is_active INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  status TEXT NOT NULL DEFAULT 'healthy' CHECK (status IN ('healthy', 'rate_limited', 'invalid', 'error')),
  cooldown_until TEXT,
  last_used_at TEXT,
  last_test_at TEXT,
  last_error TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_ai_keys_active ON ai_keys (is_active, provider, sort_order);

-- Team members canonical WhatsApp phone number for bot alert routing
ALTER TABLE team_members ADD COLUMN whatsapp TEXT;

-- Backfill whatsapp for existing team members where names match in bot_team
UPDATE team_members
   SET whatsapp = (SELECT b.whatsapp FROM bot_team b WHERE lower(b.name) = lower(team_members.name) LIMIT 1)
 WHERE whatsapp IS NULL;
