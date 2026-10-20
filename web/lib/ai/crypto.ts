import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/** Master key derivation from environment secret or WA_APP_SECRET */
export function getMasterKey(masterSecret?: string): Buffer {
  const secret = masterSecret || process.env.AI_ENCRYPTION_KEY || process.env.WA_APP_SECRET || '';
  if (!secret) {
    throw new Error('Encryption secret not configured: set AI_ENCRYPTION_KEY or WA_APP_SECRET');
  }
  return createHash('sha256').update(`legitforge-ai-vault:${secret}`).digest();
}

/** AES-256-GCM application-layer authenticated encryption with unique 12-byte IV/nonce */
export function encryptApiKey(
  plaintext: string,
  masterSecret?: string
): { encrypted: string; nonce: string; version: number } {
  if (!plaintext || typeof plaintext !== 'string') {
    throw new Error('API key must be a non-empty string');
  }
  const key = getMasterKey(masterSecret);
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, nonce);
  let ciphertext = cipher.update(plaintext.trim(), 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag().toString('base64');

  return {
    encrypted: `${ciphertext}:${authTag}`,
    nonce: nonce.toString('base64'),
    version: 1,
  };
}

/** AES-256-GCM authenticated decryption */
export function decryptApiKey(
  encryptedPayload: string,
  nonceBase64: string,
  masterSecret?: string
): string {
  if (!encryptedPayload || !nonceBase64) {
    throw new Error('Missing encrypted payload or nonce');
  }
  const parts = encryptedPayload.split(':');
  if (parts.length !== 2) {
    throw new Error('Invalid encrypted payload format');
  }
  const [ciphertext, authTag] = parts;
  const key = getMasterKey(masterSecret);
  const nonce = Buffer.from(nonceBase64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/** Display mask for credentials (e.g. AIza••••••••4X9Q, gsk_••••••••••••1A2B) */
export function maskApiKey(apiKey: string): string {
  const clean = apiKey.trim();
  if (clean.length <= 8) return '••••••••';
  const prefix = clean.slice(0, Math.min(6, Math.floor(clean.length / 4)));
  const suffix = clean.slice(-4);
  return `${prefix}${'•'.repeat(8)}${suffix}`;
}
