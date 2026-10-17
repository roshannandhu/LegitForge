import { requireAdmin } from '@/lib/admin/auth';
import { LEAD_STATUSES, type LeadStatus } from '@/lib/admin/db';
import { d1Time, leadPage, promise, replyStart, replyStats, type DeliveryLead } from '@/lib/admin/lead-delivery';
import { getEnv } from '@/lib/cf';
import { alertsConfigured } from '@/lib/server/lead-delivery';
import { markLeadContactedAction, retryLeadAlertAction } from './delivery-actions';
import { deleteLeadAction, leadStatusAction } from '../actions';
import { ConfirmSubmit } from '../ui';

/** The files a WhatsApp client sent (R2 keys the bot stored on the lead). */
const keys = (files?: string | null): string[] => {
  try { const v: unknown = JSON.parse(files ?? '[]'); return Array.isArray(v) ? v.filter((k): k is string => typeof k === 'string' && k.startsWith('leads/')) : []; }
  catch { return []; }
};

/** "2 h 05 min". */
const span = (ms: number) => { const m = Math.max(0, Math.round(ms / 60_000)); return m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`; };
/** The 2-hour promise (in working hours, from the team's first alert) for one enquiry. */
function ReplyTime({ l }: { l: DeliveryLead }) {
  const kept = promise(l);
  if (l.first_reply_at) {
    return <p><span className={`pill${kept === 'met' ? ' is-on' : ''}`}>First reply after {span(d1Time(l.first_reply_at) - replyStart(l))}{kept === 'missed' ? ' (late)' : ''}</span></p>;
  }
  return kept === 'missed' && l.status === 'new' ? <p className="muted">No reply recorded yet: past the 2-hour promise</p> : null;
}

export default async function AdminLeads({ searchParams }: { searchParams: Promise<{ status?: string; page?: string }> }) {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const params = await searchParams;
  const q = params.status;
  const status = LEAD_STATUSES.includes(q as LeadStatus) ? (q as LeadStatus) : undefined;
  const requestedPage = Number(params.page);
  const { leads, page, pages, total } = await leadPage(status, Number.isSafeInteger(requestedPage) ? requestedPage : 1);
  const notifications = alertsConfigured(await getEnv());
  const stats = await replyStats();
  const pageUrl = (n: number) => `/admin/leads?${new URLSearchParams({ ...(status ? { status } : {}), page: String(n) })}`;
  return (
    <>
      <h1 className="type-h2">Leads</h1>
      <p className="muted">Every enquiry from the website form and the WhatsApp bot lands here ({total} so far). Each one is saved first, then an alert is sent, so a failed alert never loses an enquiry. WhatsApp enquiries fill in as the client answers the bot.</p>
      {stats.total > 0 && <p className="muted">Last 30 days: {stats.fast} of {stats.total} enquiries got a first reply within the 2-hour promise (working hours, from when the team was told; replies through the bot, or “Record contact today”).</p>}
      {!notifications && <p role="status">n8n alerts are not configured: form enquiries reach the team through the WhatsApp bot instead (once it is live). Saved enquiries remain available here.</p>}
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
                  <td className="muted">{l.created_at.slice(0, 16).replace('T', ' ')}<br />{l.source}{l.language ? ` · ${l.language}` : ''}
                    {/* first column: on a phone the table scrolls sideways, and this stays in view */}
                    <form action={deleteLeadAction.bind(null, l.id)} className="admin-inline admin-lead-delete">
                      <ConfirmSubmit message={`Delete the lead from ${l.name ?? 'this person'}? This can't be undone (Export CSV first to keep a copy).`}>Delete</ConfirmSubmit>
                    </form></td>
                  <td>{l.name ?? '—'}<br />{l.phone ? <a className="text-link" href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}>{l.phone}</a> : <span className="muted">no phone</span>}
                    {l.whatsapp_consent ? <><br /><span className="pill is-on">WhatsApp OK</span></> : null}</td>
                  <td>{l.service ?? '—'}<br /><span className="muted">{l.budget ?? ''}</span></td>
                  <td className="msg">{l.message ?? ''}
                    {l.brief && <details><summary>Brief</summary>{l.brief}</details>}
                    {keys(l.files).map((k) => <span key={k}><br /><a className="text-link" href={`/admin/leads/files/${k}`}>📎 {k.split('/').pop()}</a></span>)}</td>
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
                    {/* the bot alerts the team on WhatsApp itself; the n8n outbox is for form leads */}
                    {l.source === 'whatsapp' ? <span className="muted">WhatsApp chat: the bot alerts the team on WhatsApp when the brief is complete or a person is asked for</span> : <>
                      <span>{l.delivery_status === 'delivered' ? 'Delivered' : l.delivery_status === 'dead' ? 'Failed' : l.delivery_status === 'pending' ? 'Pending' : 'Not queued'}</span>
                      {l.attempts != null && <><br /><span className="muted">{l.attempts} attempts{l.last_error ? ` · ${l.last_error}` : ''}</span></>}
                      {notifications && l.delivery_status !== 'delivered' && <form action={retryLeadAlertAction.bind(null, l.id)} className="admin-inline"><button className="btn btn-ghost btn-sm">Retry alert</button></form>}
                    </>}
                    {l.source === 'form' && l.wa_alerted_at && <p className="muted">Team alerted on WhatsApp {l.wa_alerted_at.slice(0, 16)}</p>}
                    <ReplyTime l={l} />
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
