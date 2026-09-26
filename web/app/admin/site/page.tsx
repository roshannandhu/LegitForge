import { listStats, STAT_KEYS } from '@/lib/admin/db';
import { refreshSiteAction, saveStatAction } from '../actions';
import { ActionForm, Submit } from '../ui';

export default async function AdminSite() {
  const stats = await listStats();
  const keys = [...new Set([...STAT_KEYS, ...stats.map((s) => s.key)])];
  return (
    <>
      <h1 className="type-h2">Site</h1>
      <p className="admin-lead">The numbers n8n keeps up to date. Override one here if it is wrong; the next n8n run may set it again.</p>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Key</th><th>Value</th><th>Updated</th><th>Change</th></tr></thead>
          <tbody>
            {keys.map((k) => {
              const s = stats.find((x) => x.key === k);
              return (
                <tr key={k}>
                  <td><code>{k}</code></td>
                  <td>{s?.value ?? <span className="muted">not set</span>}</td>
                  <td className="muted">{s?.updated_at ?? '—'}</td>
                  <td>
                    <ActionForm action={saveStatAction} className="admin-inline">
                      <input type="hidden" name="key" value={k} />
                      <label className="field"><span className="sr-only">New value for {k}</span><input name="value" defaultValue={s?.value ?? ''} maxLength={200} /></label>
                      <Submit className="btn btn-ghost btn-sm">Save</Submit>
                    </ActionForm>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <section className="admin-section" aria-labelledby="refresh-h">
        <h2 id="refresh-h" className="type-h3">Refresh site content</h2>
        <p className="admin-lead">Saving in the admin already updates the pages. Use this if a page still shows old content.</p>
        <ActionForm action={refreshSiteAction}><Submit pending="Refreshing…">Refresh site content</Submit></ActionForm>
      </section>
    </>
  );
}
