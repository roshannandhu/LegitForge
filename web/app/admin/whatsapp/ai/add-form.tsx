'use client';

import { useState } from 'react';
import { PROVIDER_PRESETS, type AiProvider } from '@/lib/ai/types';
import { ActionForm, Submit } from '@/app/admin/ui';
import { addAiKeyAction } from './actions';

export function AddAiKeyForm() {
  const [provider, setProvider] = useState<AiProvider>('gemini');
  const preset = PROVIDER_PRESETS[provider];
  const [model, setModel] = useState(preset.defaultModel);
  const [baseUrl, setBaseUrl] = useState(preset.defaultBaseUrl);

  function handleProviderChange(newProvider: AiProvider) {
    setProvider(newProvider);
    const p = PROVIDER_PRESETS[newProvider];
    setModel(p.defaultModel);
    setBaseUrl(p.defaultBaseUrl);
  }

  return (
    <ActionForm action={addAiKeyAction} className="admin-form" resetOnOk>
      <div className="admin-grid admin-grid-3">
        <label className="field">
          <span>Provider</span>
          <select
            name="provider"
            value={provider}
            onChange={(e) => handleProviderChange(e.target.value as AiProvider)}
          >
            <option value="gemini">Google Gemini (Free tier eligible)</option>
            <option value="groq">Groq (Ultra-fast, Llama 3.3)</option>
            <option value="openrouter">OpenRouter (Multi-model & Free)</option>
            <option value="deepseek">DeepSeek (V3 / R1)</option>
            <option value="custom">Custom OpenAI-Compatible</option>
          </select>
        </label>

        <label className="field">
          <span>Key Label</span>
          <input
            name="name"
            required
            maxLength={80}
            placeholder={`e.g. ${preset.label} Primary`}
          />
        </label>

        <label className="field">
          <span>
            API Key{' '}
            {preset.docsUrl && (
              <small>
                <a
                  href={preset.docsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-link"
                >
                  (Get Key ↗)
                </a>
              </small>
            )}
          </span>
          <input
            name="api_key"
            type="password"
            autoComplete="new-password"
            required
            placeholder={preset.placeholderKey}
          />
        </label>
      </div>

      <div className="admin-grid admin-grid-3">
        <label className="field">
          <span>Model Name</span>
          <input
            name="model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder={preset.defaultModel || 'e.g. gpt-4o-mini, llama-3.3-70b'}
          />
        </label>

        <label className="field">
          <span>
            Base Endpoint URL{' '}
            <small>(HTTPS required)</small>
          </span>
          <input
            name="base_url"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="https://..."
          />
        </label>

        <label className="field">
          <span>
            Priority Order{' '}
            <small>(0 = highest)</small>
          </span>
          <input
            name="sort_order"
            type="number"
            defaultValue="0"
            min="0"
            max="100"
          />
        </label>
      </div>

      {preset.recommendedModels.length > 0 && (
        <div style={{ marginTop: '0.25rem', marginBottom: '0.75rem' }}>
          <span className="muted" style={{ fontSize: '0.8125rem' }}>
            Recommended models for {preset.label}:{' '}
          </span>
          <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: '0.35rem' }}>
            {preset.recommendedModels.map((m) => (
              <button
                key={m.id}
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem' }}
                onClick={() => setModel(m.id)}
              >
                {m.id} {m.freeTier ? '(free)' : ''}
              </button>
            ))}
          </span>
        </div>
      )}

      <div>
        <Submit pending="Encrypting & Saving…">Save & Encrypt AI Key</Submit>
      </div>
    </ActionForm>
  );
}
