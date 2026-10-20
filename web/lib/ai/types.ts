/** Multi-Provider AI Engine types, provider presets, and SSRF security validators. */

export type AiProvider = 'gemini' | 'groq' | 'openrouter' | 'deepseek' | 'custom';

export type AiKeyStatus = 'healthy' | 'rate_limited' | 'invalid' | 'error';

export interface AiKeyRecord {
  id: string;
  provider: AiProvider;
  name: string;
  api_key_encrypted: string;
  key_nonce: string;
  key_version: number;
  masked_key: string;
  model: string;
  base_url: string;
  is_active: number;
  status: AiKeyStatus;
  cooldown_until: string | null;
  last_used_at: string | null;
  last_test_at: string | null;
  last_error: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProviderPreset {
  provider: AiProvider;
  label: string;
  defaultBaseUrl: string;
  defaultModel: string;
  recommendedModels: { id: string; name: string; freeTier: boolean }[];
  placeholderKey: string;
  docsUrl: string;
}

export const PROVIDER_PRESETS: Record<AiProvider, ProviderPreset> = {
  gemini: {
    provider: 'gemini',
    label: 'Google Gemini',
    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    defaultModel: 'gemini-2.5-flash',
    recommendedModels: [
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash (Fast & Capable)', freeTier: true },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Reliable)', freeTier: true },
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro (Deep Reasoning)', freeTier: true },
    ],
    placeholderKey: 'AIzaSy...',
    docsUrl: 'https://aistudio.google.com/app/apikey',
  },
  groq: {
    provider: 'groq',
    label: 'Groq',
    defaultBaseUrl: 'https://api.groq.com/openai/v1/chat/completions',
    defaultModel: 'llama-3.3-70b-versatile',
    recommendedModels: [
      { id: 'llama-3.3-70b-versatile', name: 'Llama 3.3 70B (Ultra-fast, Superior)', freeTier: true },
      { id: 'mixtral-8x7b-32768', name: 'Mixtral 8x7B (Long Context)', freeTier: true },
      { id: 'llama-3.1-8b-instant', name: 'Llama 3.1 8B Instant (Lightweight)', freeTier: true },
    ],
    placeholderKey: 'gsk_...',
    docsUrl: 'https://console.groq.com/keys',
  },
  openrouter: {
    provider: 'openrouter',
    label: 'OpenRouter',
    defaultBaseUrl: 'https://openrouter.ai/api/v1/chat/completions',
    defaultModel: 'meta-llama/llama-3.3-70b-instruct:free',
    recommendedModels: [
      { id: 'meta-llama/llama-3.3-70b-instruct:free', name: 'Llama 3.3 70B (Free)', freeTier: true },
      { id: 'google/gemini-2.0-flash-exp:free', name: 'Gemini 2.0 Flash Exp (Free)', freeTier: true },
      { id: 'deepseek/deepseek-r1:free', name: 'DeepSeek R1 (Free)', freeTier: true },
    ],
    placeholderKey: 'sk-or-v1-...',
    docsUrl: 'https://openrouter.ai/keys',
  },
  deepseek: {
    provider: 'deepseek',
    label: 'DeepSeek',
    defaultBaseUrl: 'https://api.deepseek.com/chat/completions',
    defaultModel: 'deepseek-chat',
    recommendedModels: [
      { id: 'deepseek-chat', name: 'DeepSeek V3 (Chat)', freeTier: false },
      { id: 'deepseek-reasoner', name: 'DeepSeek R1 (Reasoner)', freeTier: false },
    ],
    placeholderKey: 'sk-...',
    docsUrl: 'https://platform.deepseek.com/api_keys',
  },
  custom: {
    provider: 'custom',
    label: 'Custom OpenAI-Compatible',
    defaultBaseUrl: '',
    defaultModel: '',
    recommendedModels: [],
    placeholderKey: 'Key or token',
    docsUrl: '',
  },
};

/** Strict SSRF prevention for custom and external AI endpoints. */
export function validateEndpointUrl(urlStr: string): { ok: boolean; error?: string; cleanUrl?: string } {
  if (!urlStr || typeof urlStr !== 'string') return { ok: false, error: 'Endpoint URL is required.' };
  let parsed: URL;
  try {
    parsed = new URL(urlStr.trim());
  } catch {
    return { ok: false, error: 'Invalid URL format.' };
  }

  if (parsed.protocol !== 'https:') {
    return { ok: false, error: 'Only secure HTTPS endpoints are allowed.' };
  }

  const hostname = parsed.hostname.toLowerCase();

  // Prohibit local, private, link-local, loopback, or metadata addresses
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    hostname.endsWith('.lan') ||
    hostname === '127.0.0.1' ||
    hostname === '0.0.0.0' ||
    hostname === '::1' ||
    hostname === '169.254.169.254' || // AWS / GCP / Azure metadata service
    hostname === 'metadata.google.internal' ||
    hostname === '100.100.100.200'
  ) {
    return { ok: false, error: 'Requests to private, loopback, or metadata addresses are prohibited.' };
  }

  // IPv4 Private Range Check
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const [, a, b] = ipv4.map(Number);
    if (
      a === 10 || // 10.0.0.0/8
      a === 127 || // 127.0.0.0/8
      a === 0 || // 0.0.0.0/8
      (a === 172 && b >= 16 && b <= 31) || // 172.16.0.0/12
      (a === 192 && b === 168) || // 192.168.0.0/16
      (a === 169 && b === 254) // 169.254.0.0/16
    ) {
      return { ok: false, error: 'Requests to private IP addresses are prohibited.' };
    }
  }

  // Ensure path ends with completions if path is root
  return { ok: true, cleanUrl: parsed.toString() };
}
