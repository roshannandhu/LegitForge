import { requireAdmin } from '@/lib/admin/auth';
import { adminDb } from '@/lib/admin/db';
import { listAiKeys } from '@/lib/ai/vault';
import { PROVIDER_PRESETS } from '@/lib/ai/types';
import { ConfirmSubmit } from '@/app/admin/ui';
import { deleteAiKeyAction, toggleAiKeyAction } from './actions';
import { TestKeyButton } from './test-button';
import { AddAiKeyForm } from './add-form';

export default async function AdminAiKeysPage() {
  await requireAdmin();
  const db = await adminDb();
  const keys = await listAiKeys(db);

  return (
    <>
      <h1 className="type-h2">AI & API Keys Vault</h1>
      <p className="admin-lead">
        Add multiple credentials for Google Gemini, Groq, OpenRouter, DeepSeek, or custom OpenAI-compatible models.
        Keys are stored with AES-256-GCM authenticated encryption. The WhatsApp bot automatically rotates across healthy
        keys and fails over instantly if a key hits rate limits (429).
      </p>

      <section className="admin-section" aria-labelledby="keys-list-h">
        <h2 id="keys-list-h" className="type-h3">
          Configured Keys ({keys.length})
        </h2>

        {keys.length === 0 ? (
          <div className="admin-empty">
            <p>No AI keys added yet. Add a Gemini, Groq, or OpenRouter key below to activate intelligent WhatsApp customer reasoning.</p>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table is-stacked">
              <thead>
                <tr>
                  <th>Priority</th>
                  <th>Provider</th>
                  <th>Label</th>
                  <th>Masked Key</th>
                  <th>Model</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {keys.map((k) => {
                  const preset = PROVIDER_PRESETS[k.provider];
                  const inCooldown = k.cooldown_until && new Date(k.cooldown_until).getTime() > Date.now();

                  return (
                    <tr key={k.id}>
                      <td data-label="Priority" className="num">
                        #{k.sort_order}
                      </td>
                      <td data-label="Provider">
                        <span className="pill is-on" style={{ textTransform: 'capitalize' }}>
                          {preset?.label || k.provider}
                        </span>
                      </td>
                      <td data-label="Label">
                        <strong>{k.name}</strong>
                      </td>
                      <td data-label="Masked Key">
                        <code style={{ fontSize: '0.8125rem' }}>{k.masked_key}</code>
                      </td>
                      <td data-label="Model">
                        <span className="muted">{k.model || preset?.defaultModel || 'Default'}</span>
                      </td>
                      <td data-label="Status">
                        {k.is_active === 0 ? (
                          <span className="pill is-off">Disabled</span>
                        ) : inCooldown ? (
                          <span className="pill is-off" title={`Rate limited until ${k.cooldown_until}`}>
                            Rate Limited (Cooldown)
                          </span>
                        ) : k.status === 'healthy' ? (
                          <span className="pill is-on">Healthy</span>
                        ) : k.status === 'invalid' ? (
                          <span className="pill is-danger" title={k.last_error || 'Invalid key'}>
                            Invalid
                          </span>
                        ) : (
                          <span className="pill is-danger" title={k.last_error || 'Error'}>
                            Error
                          </span>
                        )}
                      </td>
                      <td data-label="Actions">
                        <div className="admin-actions" style={{ flexWrap: 'nowrap', gap: '0.4rem' }}>
                          <TestKeyButton id={k.id} />
                          <form action={toggleAiKeyAction.bind(null, k.id, k.is_active === 0)}>
                            <button className="btn btn-ghost btn-sm">
                              {k.is_active === 1 ? 'Disable' : 'Enable'}
                            </button>
                          </form>
                          <form action={deleteAiKeyAction.bind(null, k.id)}>
                            <ConfirmSubmit message={`Remove AI Key "${k.name}"?`}>
                              Delete
                            </ConfirmSubmit>
                          </form>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="admin-section" aria-labelledby="add-key-h">
        <h2 id="add-key-h" className="type-h3">
          Add an AI Key
        </h2>
        <AddAiKeyForm />
      </section>
    </>
  );
}
