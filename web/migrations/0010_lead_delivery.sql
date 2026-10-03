-- Admission, idempotent retries and durable website-lead notifications.
-- Existing leads and rate history remain intact; no customer data is auto-deleted.
ALTER TABLE leads ADD COLUMN last_contact_at TEXT;
CREATE TABLE lead_receipts (
  submission_key TEXT PRIMARY KEY NOT NULL,
  request_hash TEXT NOT NULL,
  lead_id TEXT NOT NULL UNIQUE REFERENCES leads(id) ON DELETE CASCADE,
  accepted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX idx_lead_receipts_expiry ON lead_receipts(expires_at);

ALTER TABLE rate_events ADD COLUMN receipt_id TEXT;
CREATE UNIQUE INDEX idx_rate_receipt ON rate_events(receipt_id) WHERE receipt_id IS NOT NULL;

CREATE TABLE lead_alert_outbox (
  lead_id TEXT PRIMARY KEY NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','delivered','dead')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at INTEGER NOT NULL,
  lease_token TEXT,
  lease_until INTEGER NOT NULL DEFAULT 0,
  delivered_at INTEGER,
  last_error TEXT,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_lead_alert_due ON lead_alert_outbox(status,next_attempt_at,lease_until);
