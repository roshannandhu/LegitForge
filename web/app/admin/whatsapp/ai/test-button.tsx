'use client';

import { useState } from 'react';
import { testAiKeyAction } from './actions';

export function TestKeyButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; latencyMs?: number; modelUsed?: string } | null>(null);

  async function handleTest() {
    setLoading(true);
    setResult(null);
    try {
      const res = await testAiKeyAction(id);
      setResult(res);
    } catch (e: unknown) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Test failed' });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="test-key-wrapper" style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={handleTest}
        disabled={loading}
      >
        {loading ? 'Testing…' : 'Test Key'}
      </button>
      {result && (
        <span
          className={`pill ${result.ok ? 'is-on' : 'is-off'}`}
          style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
          title={result.error || `Connected in ${result.latencyMs}ms (${result.modelUsed})`}
        >
          {result.ok ? `✓ ${result.latencyMs}ms` : `✕ ${result.error?.slice(0, 30) || 'Error'}`}
        </span>
      )}
    </div>
  );
}
