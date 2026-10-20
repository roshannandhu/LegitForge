import test from 'node:test';
import assert from 'node:assert/strict';
import { encryptApiKey, decryptApiKey, maskApiKey } from '../lib/ai/crypto';
import { validateEndpointUrl, PROVIDER_PRESETS } from '../lib/ai/types';
import { classifyAiHttpStatus } from '../lib/ai/adapters';

test('AES-256-GCM encryption and decryption round-trip works with unique nonces', () => {
  const masterKey = 'test-secret-key-for-legitforge-vault-32b';
  const plaintext = 'gsk_super_secret_groq_api_token_12345';

  const enc1 = encryptApiKey(plaintext, masterKey);
  const enc2 = encryptApiKey(plaintext, masterKey);

  // Ciphertext should not match between runs because nonces/IVs are randomly generated per encryption
  assert.notEqual(enc1.encrypted, enc2.encrypted, 'Nonces must ensure ciphertexts differ');
  assert.notEqual(enc1.nonce, enc2.nonce, 'Each encryption must use a fresh random nonce');

  // Both should decrypt back cleanly to original plaintext
  const dec1 = decryptApiKey(enc1.encrypted, enc1.nonce, masterKey);
  const dec2 = decryptApiKey(enc2.encrypted, enc2.nonce, masterKey);

  assert.equal(dec1, plaintext);
  assert.equal(dec2, plaintext);
});

test('AES-256-GCM decryption fails with incorrect master key or tampered ciphertext', () => {
  const masterKey = 'correct-key-1234567890';
  const wrongKey = 'wrong-key-1234567890';
  const plaintext = 'AIzaSySecretGeminiCredential';

  const enc = encryptApiKey(plaintext, masterKey);

  assert.throws(() => {
    decryptApiKey(enc.encrypted, enc.nonce, wrongKey);
  }, /Unsupported state or unable to authenticate data|bad decrypt/i);

  // Tampered ciphertext
  const tampered = enc.encrypted.slice(0, -4) + 'AAAA';
  assert.throws(() => {
    decryptApiKey(tampered, enc.nonce, masterKey);
  });
});

test('maskApiKey masks secrets properly for display without exposing tokens', () => {
  assert.equal(maskApiKey('AIzaSyD-1234567890abcdef4X9Q'), 'AIzaSy••••••••4X9Q');
  assert.equal(maskApiKey('gsk_abcdef1234567890zyxw'), 'gsk_ab••••••••zyxw');
  assert.equal(maskApiKey('short1234'), 'sh••••••••1234');
  assert.equal(maskApiKey('tiny'), '••••••••');
  assert.equal(maskApiKey(''), '••••••••');
});

test('validateEndpointUrl enforces strict SSRF protections on custom AI endpoints', () => {
  // Disallowed: Loopback / localhost
  assert.equal(validateEndpointUrl('http://localhost:8080/v1').ok, false);
  assert.equal(validateEndpointUrl('https://localhost/v1').ok, false);
  assert.equal(validateEndpointUrl('http://127.0.0.1:11434/v1').ok, false);
  assert.equal(validateEndpointUrl('https://127.0.0.1/v1').ok, false);

  // Disallowed: Cloud metadata & link-local
  assert.equal(validateEndpointUrl('http://169.254.169.254/latest/meta-data/').ok, false);
  assert.equal(validateEndpointUrl('https://169.254.1.1/v1').ok, false);

  // Disallowed: RFC 1918 Private networks
  assert.equal(validateEndpointUrl('http://10.0.0.1/v1').ok, false);
  assert.equal(validateEndpointUrl('https://10.254.0.1/v1').ok, false);
  assert.equal(validateEndpointUrl('http://192.168.1.1/v1').ok, false);
  assert.equal(validateEndpointUrl('https://192.168.0.50/v1').ok, false);
  assert.equal(validateEndpointUrl('http://172.16.0.1/v1').ok, false);
  assert.equal(validateEndpointUrl('https://172.31.255.255/v1').ok, false);

  // Disallowed: Plain HTTP
  assert.equal(validateEndpointUrl('http://api.openai.com/v1').ok, false);

  // Disallowed: Non-standard / dangerous protocols
  assert.equal(validateEndpointUrl('file:///etc/passwd').ok, false);
  assert.equal(validateEndpointUrl('ftp://example.com/v1').ok, false);

  // Allowed: Valid public HTTPS endpoints
  assert.equal(validateEndpointUrl('https://api.openai.com/v1').ok, true);
  assert.equal(validateEndpointUrl('https://openrouter.ai/api/v1').ok, true);
  assert.equal(validateEndpointUrl('https://api.deepseek.com/v1').ok, true);
  assert.equal(validateEndpointUrl('https://api.groq.com/openai/v1').ok, true);
  assert.equal(validateEndpointUrl('https://my-legit-cluster.hf.space/v1').ok, true);
});

test('PROVIDER_PRESETS defaults cover all requested providers with verified models', () => {
  const providers = Object.keys(PROVIDER_PRESETS);
  assert.ok(providers.includes('groq'));
  assert.ok(providers.includes('gemini'));
  assert.ok(providers.includes('openrouter'));
  assert.ok(providers.includes('deepseek'));
  assert.ok(providers.includes('custom'));

  assert.equal(PROVIDER_PRESETS.groq.defaultModel, 'llama-3.3-70b-versatile');
  assert.equal(PROVIDER_PRESETS.gemini.defaultModel, 'gemini-2.5-flash');
  assert.equal(PROVIDER_PRESETS.openrouter.defaultModel, 'meta-llama/llama-3.3-70b-instruct:free');
});

test('classifyAiHttpStatus accurately maps HTTP error statuses to operational categories', () => {
  // 401/403 -> invalid_key
  assert.equal(classifyAiHttpStatus(401, 'Unauthorized API key').category, 'invalid_key');
  assert.equal(classifyAiHttpStatus(403, 'Permission denied').category, 'invalid_key');

  // 429 -> rate_limited or quota_exceeded
  assert.equal(classifyAiHttpStatus(429, 'Rate limit reached, please retry later').category, 'rate_limited');
  assert.equal(classifyAiHttpStatus(429, 'You exceeded your current quota').category, 'quota_exceeded');

  // 404 -> model_not_found
  assert.equal(classifyAiHttpStatus(404, 'The model does not exist').category, 'model_not_found');

  // 400 with payment -> billing_required
  assert.equal(classifyAiHttpStatus(400, 'Requires active credit card or billing account').category, 'billing_required');

  // 5xx -> transient
  assert.equal(classifyAiHttpStatus(500, 'Internal Server Error').category, 'transient');
  assert.equal(classifyAiHttpStatus(503, 'Service Temporarily Unavailable').category, 'transient');
});

test('International phone number validation enforces 10–15 digits with country code', () => {
  const clean = (s: string) => s.replace(/\D/g, '');
  const isValid = (s: string) => /^\d{10,15}$/.test(clean(s));

  // Valid numbers
  assert.ok(isValid('+919876543210'));
  assert.ok(isValid('91 98765 43210'));
  assert.ok(isValid('+1 (555) 234-5678'));
  assert.ok(isValid('447123456789'));

  assert.equal(clean('+91 98765 43210'), '919876543210');

  // Invalid numbers
  assert.ok(!isValid(''));
  assert.ok(!isValid('98765')); // Too short (< 10)
  assert.ok(!isValid('12345678901234567')); // Too long (> 15)
  assert.ok(!isValid('abcdefghij')); // Letters
});
