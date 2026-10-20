import 'server-only';
import type { D1Database } from '@cloudflare/workers-types';
import type { AiKeyRecord, AiKeyStatus, AiProvider } from './types';
import { encryptApiKey, maskApiKey } from './crypto';
import { validateEndpointUrl, PROVIDER_PRESETS } from './types';

export interface CreateAiKeyInput {
  provider: AiProvider;
  name: string;
  apiKey: string;
  model?: string;
  baseUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export interface UpdateAiKeyInput {
  name?: string;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  sortOrder?: number;
  isActive?: boolean;
}

export async function listAiKeys(db: D1Database): Promise<AiKeyRecord[]> {
  const { results } = await db
    .prepare('SELECT * FROM ai_keys ORDER BY sort_order ASC, created_at DESC')
    .all<AiKeyRecord>();
  return results || [];
}

export async function getAiKey(db: D1Database, id: string): Promise<AiKeyRecord | null> {
  return await db.prepare('SELECT * FROM ai_keys WHERE id = ?').bind(id).first<AiKeyRecord>();
}

/** Active keys eligible for use (healthy or whose cooldown has expired) */
export async function getActiveAiKeys(db: D1Database): Promise<AiKeyRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT * FROM ai_keys 
       WHERE is_active = 1 
         AND (cooldown_until IS NULL OR datetime(cooldown_until) <= datetime('now'))
       ORDER BY sort_order ASC, created_at ASC`
    )
    .all<AiKeyRecord>();
  return results || [];
}

export async function createAiKey(db: D1Database, input: CreateAiKeyInput, masterSecret?: string): Promise<string> {
  const id = crypto.randomUUID();
  const provider = input.provider;
  const name = input.name.trim();
  const rawKey = input.apiKey.trim();
  if (!name) throw new Error('Key name is required');
  if (!rawKey) throw new Error('API key is required');

  const preset = PROVIDER_PRESETS[provider];
  let baseUrl = (input.baseUrl || preset?.defaultBaseUrl || '').trim();
  const model = (input.model || preset?.defaultModel || '').trim();

  if (baseUrl) {
    const val = validateEndpointUrl(baseUrl);
    if (!val.ok) throw new Error(val.error || 'Invalid base URL');
    baseUrl = val.cleanUrl!;
  }

  const { encrypted, nonce, version } = encryptApiKey(rawKey, masterSecret);
  const masked = maskApiKey(rawKey);
  const sortOrder = input.sortOrder ?? 0;
  const isActive = input.isActive !== false ? 1 : 0;

  await db
    .prepare(
      `INSERT INTO ai_keys (
        id, provider, name, api_key_encrypted, key_nonce, key_version,
        masked_key, model, base_url, is_active, status, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'healthy', ?)`
    )
    .bind(
      id,
      provider,
      name,
      encrypted,
      nonce,
      version,
      masked,
      model,
      baseUrl,
      isActive,
      sortOrder
    )
    .run();

  return id;
}

export async function updateAiKey(
  db: D1Database,
  id: string,
  input: UpdateAiKeyInput,
  masterSecret?: string
): Promise<void> {
  const existing = await getAiKey(db, id);
  if (!existing) throw new Error('Key not found');

  const name = input.name !== undefined ? input.name.trim() : existing.name;
  let baseUrl = input.baseUrl !== undefined ? input.baseUrl.trim() : existing.base_url;
  const model = input.model !== undefined ? input.model.trim() : existing.model;
  const sortOrder = input.sortOrder !== undefined ? input.sortOrder : existing.sort_order;
  const isActive = input.isActive !== undefined ? (input.isActive ? 1 : 0) : existing.is_active;

  if (baseUrl) {
    const val = validateEndpointUrl(baseUrl);
    if (!val.ok) throw new Error(val.error || 'Invalid base URL');
    baseUrl = val.cleanUrl!;
  }

  if (input.apiKey && input.apiKey.trim()) {
    const rawKey = input.apiKey.trim();
    const { encrypted, nonce, version } = encryptApiKey(rawKey, masterSecret);
    const masked = maskApiKey(rawKey);

    await db
      .prepare(
        `UPDATE ai_keys SET
          name = ?, api_key_encrypted = ?, key_nonce = ?, key_version = ?,
          masked_key = ?, model = ?, base_url = ?, is_active = ?, sort_order = ?,
          status = 'healthy', cooldown_until = NULL, last_error = NULL, updated_at = datetime('now')
        WHERE id = ?`
      )
      .bind(name, encrypted, nonce, version, masked, model, baseUrl, isActive, sortOrder, id)
      .run();
  } else {
    await db
      .prepare(
        `UPDATE ai_keys SET
          name = ?, model = ?, base_url = ?, is_active = ?, sort_order = ?,
          updated_at = datetime('now')
        WHERE id = ?`
      )
      .bind(name, model, baseUrl, isActive, sortOrder, id)
      .run();
  }
}

export async function toggleAiKey(db: D1Database, id: string, isActive: boolean): Promise<void> {
  await db
    .prepare('UPDATE ai_keys SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?')
    .bind(isActive ? 1 : 0, id)
    .run();
}

export async function deleteAiKey(db: D1Database, id: string): Promise<void> {
  await db.prepare('DELETE FROM ai_keys WHERE id = ?').bind(id).run();
}

export async function recordKeyHealth(
  db: D1Database,
  id: string,
  status: AiKeyStatus,
  cooldownSeconds = 0,
  lastError?: string
): Promise<void> {
  const cooldownUntil =
    cooldownSeconds > 0
      ? new Date(Date.now() + cooldownSeconds * 1000).toISOString()
      : null;

  await db
    .prepare(
      `UPDATE ai_keys SET
        status = ?,
        cooldown_until = ?,
        last_error = ?,
        last_test_at = datetime('now'),
        updated_at = datetime('now')
      WHERE id = ?`
    )
    .bind(status, cooldownUntil, lastError || null, id)
    .run();
}

export async function recordKeyUsage(db: D1Database, id: string): Promise<void> {
  await db
    .prepare('UPDATE ai_keys SET last_used_at = datetime(\'now\'), status = \'healthy\' WHERE id = ?')
    .bind(id)
    .run();
}
