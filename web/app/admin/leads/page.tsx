import { requireAdmin } from '@/lib/admin/auth';
import { BOT_LANGS } from '@/lib/admin/bot';
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

/** "quoted" → "Quoted" (labels only; values and URLs keep the key). */
const cap = (s: string) => s[0].toUpperCase() + s.slice(1);
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
      <div className="admin-head">
        <h1 className="type-h2">Leads</h1>
        <a className="btn btn-ghost btn-sm" href="/admin/leads/export">Export CSV</a>
      </div>
      <p className="admin-lead">Every enquiry from the website form and the WhatsApp bot lands here ({total} so far). Each one is saved first, then an alert is sent, so a failed alert never loses an enquiry. WhatsApp enquiries fill in as the client answers the bot.</p>
      {stats.total > 0 && <p className="admin-intro">Last 30 days: {stats.fast} of {stats.total} enquiries got a first reply within the 2-hour promise (working hours, from when the team was told; replies through the bot, or “Record contact today”).</p>}
      {!notifications && <p role="status" className="admin-note">n8n alerts are not configured: form enquiries reach the team through the WhatsApp bot instead (once it is live). Saved enquiries remain available here.</p>}
      <nav aria-label="Filter by status" className="admin-actions admin-leads-filter">
        <a className="btn btn-ghost btn-sm" href="/admin/leads" aria-current={!status ? 'page' : undefined}>All</a>
        {LEAD_STATUSES.map((s) => <a key={s} className="btn btn-ghost btn-sm" href={`/admin/leads?status=${s}`} aria-current={status === s ? 'page' : undefined}>{cap(s)}</a>)}
      </nav>
      {leads.length === 0 ? (
        <p className="admin-empty">No leads{status ? ` with status “${status}”` : ''} yet.</p>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table is-stacked">
            <thead><tr><th>Received (UTC)</th><th>Who</th><th>Service and budget</th><th>Message</th><th>Status</th><th>Notification and contact</th></tr></thead>
            <tbody>
              {leads.map((l) => {
                const files = keys(l.files);
                return (
                <tr key={l.id}>
                  <td data-label="Received (UTC)" className="muted"><div className="admin-cell">
                    <span>{l.created_at.slice(0, 16).replace('T', ' ')}</span>
                    <span>{l.source}{l.language ? ` · ${BOT_LANGS.find((x) => x.key === l.language)?.name ?? l.language}` : ''}</span>
                    {l.score && <span className={`pill${l.score === 'hot' ? ' is-hot' : ''}`}>{l.score === 'hot' ? '🔥 hot' : l.score}</span>}
                    {l.page && l.page !== l.source && <span>{l.page}</span>}
                    {l.source === 'whatsapp' && <a className="text-link" href={`/admin/leads/${l.id}/chat`}>Chat</a>}
                  </div></td>
                  <td data-label="Who"><div className="admin-cell">
                    <span>{l.name ?? '—'}</span>
                    {l.phone ? <a className="text-link" href={`https://wa.me/${l.phone.replace(/\D/g, '')}`}>{l.phone}</a> : <span className="muted">no phone</span>}
                    {l.whatsapp_consent ? <span className="pill is-on">WhatsApp OK</span> : null}
                  </div></td>
                  <td data-label="Service and budget"><div className="admin-cell">
                    <span>{l.service ?? '—'}</span>
                    {l.budget && <span className="muted">{l.budget}</span>}
                  </div></td>
                  {/* left empty when there is nothing, so the phone card hides it */}
                  <td data-label="Message" className="msg">{(l.message || l.brief || files.length > 0) && <div className="admin-cell">
                    {l.message && <span>{l.message}</span>}
                    {l.brief && <details><summary>Brief</summary>{l.brief}</details>}
                    {files.map((k) => <a key={k} className="text-link" href={`/admin/leads/files/${k}`}>📎 {k.split('/').pop()}</a>)}
                  </div>}</td>
                  <td data-label="Status">
                    {/* keyed by the saved status: React resets a form after its action, and without a new key it
                        would snap back to the old status even though the new one was saved */}
                    <form key={l.status} action={leadStatusAction.bind(null, l.id)} className="admin-inline">
                      <label className="field"><span className="sr-only">Status for {l.name ?? 'this lead'}</span>
                        <select name="status" defaultValue={l.status}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{cap(s)}</option>)}</select></label>
                      <button className="btn btn-ghost btn-sm">Save</button>
                    </form>
                  </td>
                  <td data-label="Notification and contact"><div className="admin-cell">
                    {/* the bot alerts the team on WhatsApp itself; the n8n outbox is for form leads */}
                    {l.source === 'whatsapp' ? <span className="muted">The bot alerts the team on WhatsApp</span> : <>
                      <span>Alert: {l.delivery_status === 'delivered' ? 'delivered' : l.delivery_status === 'dead' ? 'failed' : l.delivery_status === 'pending' ? 'pending' : 'not queued'}</span>
                      {l.attempts != null && <span className="muted">{l.attempts} attempts{l.last_error ? ` · ${l.last_error}` : ''}</span>}
                      {notifications && l.delivery_status !== 'delivered' && <form action={retryLeadAlertAction.bind(null, l.id)} className="admin-inline"><button className="btn btn-ghost btn-sm">Retry alert</button></form>}
                    </>}
                    {l.source === 'form' && l.wa_alerted_at && <p className="muted">Team alerted on WhatsApp {l.wa_alerted_at.slice(0, 16)}</p>}
                    <ReplyTime l={l} />
                    <p className="muted">Last contact: {l.last_contact_at?.slice(0, 16) ?? 'Not recorded'}</p>
                    <div className="admin-actions">
                      <form action={markLeadContactedAction.bind(null, l.id)} className="admin-inline"><button className="btn btn-ghost btn-sm">Record contact today</button></form>
                      <form action={deleteLeadAction.bind(null, l.id)} className="admin-inline">
                        <ConfirmSubmit message={`Delete the lead from ${l.name ?? 'this person'}? This can't be undone (Export CSV first to keep a copy).`}>Delete</ConfirmSubmit>
                      </form>
                    </div>
                  </div></td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && <nav className="admin-actions admin-pager" aria-label="Enquiry pages">
        {page > 1 && <a className="btn btn-ghost btn-sm" href={pageUrl(page - 1)}>Previous</a>}
        <span>Page {page} of {pages}</span>
        {page < pages && <a className="btn btn-ghost btn-sm" href={pageUrl(page + 1)}>Next</a>}
      </nav>}
    </>
  );
}
