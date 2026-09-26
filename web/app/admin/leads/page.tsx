import { LEAD_STATUSES, listLeads, type LeadStatus } from '@/lib/admin/db';
import { leadStatusAction } from '../actions';

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  const q = (await searchParams).status;
  const status = LEAD_STATUSES.includes(q as LeadStatus) ? (q as LeadStatus) : undefined;
  const leads = await listLeads(status);
  return (
    <>
      <h1 className="type-h2">Leads</h1>
      <div className="admin-actions admin-lead">
        <a className="btn btn-ghost btn-sm" href="/admin/leads" aria-current={!status ? 'page' : undefined}>All</a>
        {LEAD_STATUSES.map((s) => <a key={s} className="btn btn-ghost btn-sm" href={`/admin/leads?status=${s}`} aria-current={status === s ? 'page' : undefined}>{s}</a>)}
        <a className="btn btn-primary btn-sm" href="/admin/leads/export">Export CSV</a>
      </div>
      {leads.length === 0 ? (
        <p className="admin-empty">No leads{status ? ` with status “${status}”` : ''} yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Received</th><th>Who</th><th>Service and budget</th><th>Message</th><th>Status</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{l.created_at.slice(0, 16).replace('T', ' ')}<br />{l.source}</td>
                  <td>{l.name ?? '—'}<br />{l.phone ? <a className="text-link" href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}>{l.phone}</a> : <span className="muted">no phone</span>}
                    {l.whatsapp_consent ? <><br /><span className="pill is-on">WhatsApp OK</span></> : null}</td>
                  <td>{l.service ?? '—'}<br /><span className="muted">{l.budget ?? ''}</span></td>
                  <td className="msg">{l.message ?? ''}</td>
                  <td>
                    <form action={leadStatusAction.bind(null, l.id)} className="admin-inline">
                      <label className="field"><span className="sr-only">Status for {l.name ?? 'this lead'}</span>
                        <select name="status" defaultValue={l.status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                      <button className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
