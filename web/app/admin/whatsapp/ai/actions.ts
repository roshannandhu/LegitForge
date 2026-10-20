'use server';

import { requireAdmin } from '@/lib/admin/auth';
import { adminDb } from '@/lib/admin/db';
import { getEnv } from '@/lib/cf';
import { revalidatePath } from 'next/cache';
import type { FormState } from '@/app/admin/actions';
import type { AiProvider } from '@/lib/ai/types';
import {
  createAiKey,
  deleteAiKey,
  getAiKey,
  listAiKeys,
  recordKeyHealth,
  toggleAiKey,
  updateAiKey,
} from '@/lib/ai/vault';
import { decryptApiKey } from '@/lib/ai/crypto';
import { testAiKeyConnection, normalizeAiModel } from '@/lib/ai/adapters';

const str = (f: FormData, k: string, max = 200) => String(f.get(k) ?? '').trim().slice(0, max);

export async function addAiKeyAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const db = await adminDb();
  const provider = str(f, 'provider') as AiProvider;
  const name = str(f, 'name', 80);
  const apiKey = str(f, 'api_key', 500);
  const rawModel = str(f, 'model', 100);
  const model = normalizeAiModel(provider, rawModel);
  const baseUrl = str(f, 'base_url', 300);
  const sortOrder = Number(str(f, 'sort_order')) || 0;

  if (!provider || !name || !apiKey) {
    return { error: 'Provider, key label, and API key are required.' };
  }

  const env = (await getEnv()) as (CloudflareEnv & { AI_ENCRYPTION_KEY?: string; WA_APP_SECRET?: string }) | undefined;
  const masterSecret = env?.AI_ENCRYPTION_KEY || env?.WA_APP_SECRET;

  try {
    await createAiKey(
      db,
      {
        provider,
        name,
        apiKey,
        model,
        baseUrl,
        sortOrder,
        isActive: true,
      },
      masterSecret
    );
    revalidatePath('/admin/whatsapp/ai');
    return { ok: `AI Key "${name}" created and securely encrypted.` };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `Failed to save key: ${msg}` };
  }
}

export async function toggleAiKeyAction(id: string, active: boolean) {
  await requireAdmin();
  const db = await adminDb();
  await toggleAiKey(db, id, active);
  revalidatePath('/admin/whatsapp/ai');
}

export async function deleteAiKeyAction(id: string) {
  await requireAdmin();
  const db = await adminDb();
  await deleteAiKey(db, id);
  revalidatePath('/admin/whatsapp/ai');
}

export async function testAiKeyAction(id: string): Promise<{
  ok: boolean;
  latencyMs?: number;
  status?: string;
  error?: string;
  modelUsed?: string;
}> {
  await requireAdmin();
  const db = await adminDb();
  const record = await getAiKey(db, id);
  if (!record) return { ok: false, error: 'Key not found.' };

  const env = (await getEnv()) as (CloudflareEnv & { AI_ENCRYPTION_KEY?: string; WA_APP_SECRET?: string }) | undefined;
  const masterSecret = env?.AI_ENCRYPTION_KEY || env?.WA_APP_SECRET;

  let secretKey: string;
  try {
    secretKey = decryptApiKey(record.api_key_encrypted, record.key_nonce, masterSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    await recordKeyHealth(db, id, 'invalid', 0, `Decryption error: ${msg}`);
    revalidatePath('/admin/whatsapp/ai');
    return { ok: false, error: `Failed to decrypt key: ${msg}` };
  }

  const res = await testAiKeyConnection(record, secretKey);
  if (res.ok && res.modelUsed && res.modelUsed !== record.model) {
    await db.prepare('UPDATE ai_keys SET model = ? WHERE id = ?').bind(res.modelUsed, id).run();
  }
  await recordKeyHealth(db, id, res.status, res.status === 'rate_limited' ? 60 : 0, res.error);
  revalidatePath('/admin/whatsapp/ai');

  return {
    ok: res.ok,
    latencyMs: res.latencyMs,
    status: res.status,
    error: res.error,
    modelUsed: res.modelUsed,
  };
}
