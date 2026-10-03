import { requireAdmin } from '@/lib/admin/auth';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/admin/db';
import { leadPage } from '@/lib/admin/lead-delivery';
import { getEnv } from '@/lib/cf';
import { alertsConfigured } from '@/lib/server/lead-delivery';
import { markLeadContactedAction, retryLeadAlertAction } from './delivery-actions';
import { deleteLeadAction, leadStatusAction } from '../actions';
import { ConfirmSubmit } from '../ui';

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const params = await searchParams;
  const q = params.status;
  const status = LEAD_STATUSES.includes(q as LeadStatus) ? (q as LeadStatus) : undefined;
  const requestedPage = Number(params.page);
  const { leads, page, pages, total } = await leadPage(status, Number.isSafeInteger(requestedPage) ? requestedPage : 1);
  const notifications = alertsConfigured(await getEnv());
  const pageUrl = (n: number) => `/admin/leads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(n) })}`;
  return (
    <>
      <h1 className="type-h2">Leads</h1>
      <p className="muted">{total} saved enquiries. Alert delivery is separate from enquiry storage.</p>
      {!notifications && <p role="status">Alerts not configured. Review new enquiries here; saved enquiries remain available.</p>}
      <div className="admin-actions admin-lead admin-leads-filter">
        <a className="btn btn-ghost btn-sm" href="/admin/leads" aria-current={!status ? 'page' : undefined}>All</a>
        {LEAD_STATUSES.map((s) => <a key={s} className="btn btn-ghost btn-sm" href={`/admin/leads?status=${s}`} aria-current={status === s ? 'page' : undefined}>{s}</a>)}
        <a className="btn btn-primary btn-sm" href="/admin/leads/export">Export CSV</a>
      </div>
      {leads.length === 0 ? (
        <p className="admin-empty">No leads{status ? ` with status “${status}”` : ''} yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Received</th><th>Who</th><th>Service and budget</th><th>Message</th><th>Status</th><th>Notification and contact</th></tr></thead>
            <tbody>
              {leads.map((l) => (
                <tr key={l.id}>
                  <td className="muted">{l.created_at.slice(0, 16).replace('T', ' ')}<br />{l.source}
                    {/* first column: on a phone the table scrolls sideways, and this stays in view */}
                    <form action={deleteLeadAction.bind(null, l.id)} className="admin-inline admin-lead-delete">
                      <ConfirmSubmit message={`Delete the lead from ${l.name ?? 'this person'}? This can't be undone (Export CSV first to keep a copy).`}>Delete</ConfirmSubmit>
                    </form></td>
                  <td>{l.name ?? '—'}<br />{l.phone ? <a className="text-link" href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}>{l.phone}</a> : <span className="muted">no phone</span>}
                    {l.whatsapp_consent ? <><br /><span className="pill is-on">WhatsApp OK</span></> : null}</td>
                  <td>{l.service ?? '—'}<br /><span className="muted">{l.budget ?? ''}</span></td>
                  <td className="msg">{l.message ?? ''}</td>
                  <td>
                    {/* keyed by the saved status: React resets a form after its action, and without a new key it
                        would snap back to the old status even though the new one was saved */}
                    <form key={l.status} action={leadStatusAction.bind(null, l.id)} className="admin-inline">
                      <label className="field"><span className="sr-only">Status for {l.name ?? 'this lead'}</span>
                        <select name="status" defaultValue={l.status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
                      <button className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td>
                    <span>{l.delivery_status === 'delivered' ? 'Delivered' : l.delivery_status === 'dead' ? 'Failed' : l.delivery_status === 'pending' ? 'Pending' : 'Not queued'}</span>
                    {l.attempts != null && <><br /><span className="muted">{l.attempts} attempts{l.last_error ? ` · ${l.last_error}` : ''}</span></>}
                    {notifications && l.delivery_status !== 'delivered' && <form action={retryLeadAlertAction.bind(null, l.id)} className="admin-inline"><button className="btn btn-ghost btn-sm">Retry alert</button></form>}
                    <p className="muted">Last contact: {l.last_contact_at?.slice(0, 16) ?? 'Not recorded'}</p>
                    <form action={markLeadContactedAction.bind(null, l.id)} className="admin-inline"><button className="btn btn-ghost btn-sm">Record contact today</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && <nav className="admin-actions" aria-label="Enquiry pages">
        {page > 1 && <a className="btn btn-ghost btn-sm" href={pageUrl(page - 1)}>Previous</a>}
        <span>Page {page} of {pages}</span>
        {page < pages && <a className="btn btn-ghost btn-sm" href={pageUrl(page + 1)}>Next</a>}
      </nav>}
    </>
  );
}
