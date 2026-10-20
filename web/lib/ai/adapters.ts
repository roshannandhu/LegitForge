import type { AiKeyRecord, AiKeyStatus } from './types';
import { PROVIDER_PRESETS } from './types';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface CompletionRequest {
  system: string;
  user: string;
  schema?: Record<string, unknown>;
  name?: string;
  timeoutMs?: number;
}

export interface CompletionResult {
  ok: boolean;
  content: string | null;
  rawJson?: unknown;
  status: AiKeyStatus;
  httpStatus?: number;
  error?: string;
  latencyMs: number;
  retryAfterSec?: number;
}

/** Determines headers for provider */
export function getProviderHeaders(provider: string, secretKey: string): Record<string, string> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
  };
  if (provider === 'gemini') {
    // Gemini OpenAI-compat endpoint supports Bearer token or x-goog-api-key
    headers['authorization'] = `Bearer ${secretKey}`;
    headers['x-goog-api-key'] = secretKey;
  } else {
    headers['authorization'] = `Bearer ${secretKey}`;
  }
  return headers;
}

export function classifyAiHttpStatus(status: number, errText = ''): {
  category: 'rate_limited' | 'invalid_key' | 'quota_exceeded' | 'model_not_found' | 'billing_required' | 'transient' | 'error';
  status: AiKeyStatus;
} {
  const lower = errText.toLowerCase();
  if (status === 401 || status === 403) {
    return { category: 'invalid_key', status: 'invalid' };
  }
  if (status === 429) {
    if (lower.includes('quota')) {
      return { category: 'quota_exceeded', status: 'rate_limited' };
    }
    return { category: 'rate_limited', status: 'rate_limited' };
  }
  if (status === 404) {
    return { category: 'model_not_found', status: 'invalid' };
  }
  if (status === 400 && (lower.includes('billing') || lower.includes('credit') || lower.includes('payment'))) {
    return { category: 'billing_required', status: 'invalid' };
  }
  if (status >= 500) {
    return { category: 'transient', status: 'error' };
  }
  return { category: 'error', status: 'error' };
}

/** Executes completion against an AI provider with error classification and JSON schema support */
export async function executeAiCompletion(
  record: AiKeyRecord,
  secretKey: string,
  req: CompletionRequest
): Promise<CompletionResult> {
  const t0 = Date.now();
  const preset = PROVIDER_PRESETS[record.provider];
  const url = record.base_url || preset?.defaultBaseUrl;
  const model = record.model || preset?.defaultModel;

  if (!url) {
    return {
      ok: false,
      content: null,
      status: 'invalid',
      error: 'Missing API endpoint URL',
      latencyMs: 0,
    };
  }

  const messages: ChatMessage[] = [
    { role: 'system', content: req.system },
    { role: 'user', content: req.user },
  ];

  // Prepare body: attempt structured output or json_object
  const bodyPayload: Record<string, unknown> = {
    model,
    messages,
  };

  if (req.schema && req.name) {
    bodyPayload.response_format = {
      type: 'json_schema',
      json_schema: { name: req.name, strict: true, schema: req.schema },
    };
  } else {
    bodyPayload.response_format = { type: 'json_object' };
  }

  const timeoutMs = req.timeoutMs || 15_000;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: getProviderHeaders(record.provider, secretKey),
      body: JSON.stringify(bodyPayload),
      signal: AbortSignal.timeout(timeoutMs),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      let retryAfter = 60; // default 1 minute cooldown
      const headerRetry = res.headers.get('retry-after');
      if (headerRetry) {
        const parsed = Number(headerRetry);
        if (!isNaN(parsed) && parsed > 0) retryAfter = Math.min(parsed, 600);
      }

      const classified = classifyAiHttpStatus(res.status, errText);

      if (res.status === 429) {
        return {
          ok: false,
          content: null,
          status: classified.status,
          httpStatus: 429,
          error: `Rate limit reached (429): ${errText.slice(0, 150)}`,
          latencyMs,
          retryAfterSec: retryAfter,
        };
      }

      if (res.status === 401 || res.status === 403) {
        return {
          ok: false,
          content: null,
          status: classified.status,
          httpStatus: res.status,
          error: `Invalid credentials or unauthorized (${res.status}): ${errText.slice(0, 150)}`,
          latencyMs,
        };
      }

      // If json_schema failed because provider doesn't support structured output, try with json_object
      if (res.status === 400 && req.schema && /json_schema|response_format/i.test(errText)) {
        try {
          const fallbackBody = {
            model,
            messages: [
              {
                role: 'system',
                content: `${req.system}\n\nRespond ONLY in valid JSON matching this schema: ${JSON.stringify(req.schema)}`,
              },
              { role: 'user', content: req.user },
            ],
            response_format: { type: 'json_object' },
          };
          const fbRes = await fetch(url, {
            method: 'POST',
            headers: getProviderHeaders(record.provider, secretKey),
            body: JSON.stringify(fallbackBody),
            signal: AbortSignal.timeout(timeoutMs),
          });
          if (fbRes.ok) {
            const data = (await fbRes.json()) as { choices?: { message?: { content?: string } }[] };
            const content = data.choices?.[0]?.message?.content || null;
            return {
              ok: true,
              content,
              status: 'healthy',
              latencyMs: Date.now() - t0,
            };
          }
        } catch {
          // ignore fallback error and report original
        }
      }

      return {
        ok: false,
        content: null,
        status: 'error',
        httpStatus: res.status,
        error: `Provider HTTP error ${res.status}: ${errText.slice(0, 150)}`,
        latencyMs,
      };
    }

    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = data.choices?.[0]?.message?.content || null;

    return {
      ok: true,
      content,
      status: 'healthy',
      latencyMs,
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - t0;
    const msg = err instanceof Error ? err.message : String(err);
    const isTimeout = /timeout|aborted/i.test(msg);
    return {
      ok: false,
      content: null,
      status: 'error',
      error: isTimeout ? `Request timed out after ${timeoutMs}ms` : `Connection failed: ${msg.slice(0, 150)}`,
      latencyMs,
      retryAfterSec: isTimeout ? 30 : 15,
    };
  }
}

/** Performs a fast, bounded validation test on a configured key */
export async function testAiKeyConnection(
  record: AiKeyRecord,
  secretKey: string
): Promise<{ ok: boolean; latencyMs: number; status: AiKeyStatus; error?: string; modelUsed?: string }> {
  const preset = PROVIDER_PRESETS[record.provider];
  const model = record.model || preset?.defaultModel || 'default';

  const res = await executeAiCompletion(record, secretKey, {
    system: 'You are an API validation tester. Respond strictly with JSON: {"status": "ok"}',
    user: 'Ping test. Output JSON.',
    schema: {
      type: 'object',
      properties: { status: { type: 'string', enum: ['ok'] } },
      required: ['status'],
    },
    name: 'test_ping',
    timeoutMs: 12_000,
  });

  return {
    ok: res.ok,
    latencyMs: res.latencyMs,
    status: res.status,
    error: res.error,
    modelUsed: model,
  };
}
