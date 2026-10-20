import { requireAdmin } from '@/lib/admin/auth';
import { listMembers } from '@/lib/admin/db';
import { createMemberAction, importTeamAction, moveMemberAction, publishMemberAction } from '../actions';
import { ActionForm, Submit } from '../ui';
import { BotAlerts } from './bot-alerts';

export default async function AdminTeam() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const rows = await listMembers();
  return (
    <>
      <h1 className="type-h2">Team</h1>
      <p className="admin-lead">
        Everyone on the team pages and ID cards, in this order. A new person stays hidden until you fill in their
        profile and choose “Show on site”.
      </p>
      {rows.length === 0 ? (
        <div className="admin-empty">
          <p>The site shows the people written in the code. Import them to edit them here.</p>
          <form action={importTeamAction}><Submit pending="Importing…">Import the current team</Submit></form>
        </div>
      ) : (
        <>
        {rows.some((m) => !m.whatsapp) && (
          <div className="admin-note" role="alert">
            <strong>Incomplete WhatsApp alert setup:</strong> Some team members do not have a WhatsApp phone number configured. Client enquiry alerts and escalations cannot reach them until a valid international number is saved. Edit their details to assign their number.
          </div>
        )}
        <section className="admin-section" aria-labelledby="people-h">
          <h2 id="people-h" className="type-h3">People</h2>
          <div className="admin-table-wrap team-table">
            <table className="admin-table is-stacked">
              <thead><tr><th>Order</th><th>Card</th><th>Person</th><th>Photo</th><th>WhatsApp Alert</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((m, i) => (
                  <tr key={m.id}>
                    <td data-label="Order">
                      <div className="admin-actions">
                        <form action={moveMemberAction.bind(null, m.id, -1)}><button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label={`Move ${m.name} up`}>↑</button></form>
                        <form action={moveMemberAction.bind(null, m.id, 1)}><button className="btn btn-ghost btn-sm" disabled={i === rows.length - 1} aria-label={`Move ${m.name} down`}>↓</button></form>
                      </div>
                    </td>
                    <td className="num" data-label="Card">{m.id_code}</td>
                    <td><div className="admin-cell"><a className="text-link" href={`/admin/team/${m.id}`}>{m.name}</a><span className="muted">{m.role}</span></div></td>
                    <td data-label="Photo"><span className="muted">{m.photo_key ? 'Photo' : 'Monogram'}</span></td>
                    <td data-label="WhatsApp Alert">
                      {m.whatsapp ? (
                        <div className="admin-cell">
                          <span className="mono" style={{ fontSize: '13px' }}>+{m.whatsapp}</span>
                          <span className="pill is-on" style={{ fontSize: '11px', padding: '1px 6px' }}>Alerts on</span>
                        </div>
                      ) : (
                        <span className="pill" style={{ color: 'var(--amber, #f59e0b)', borderColor: 'var(--amber, #f59e0b)' }}>Incomplete</span>
                      )}
                    </td>
                    <td data-label="Status"><span className={`pill${m.is_published ? ' is-on' : ''}`}>{m.is_published ? 'On the site' : 'Hidden'}</span></td>
                    <td>
                      {!m.is_published && !m.bio ? (
                        <a className="btn btn-ghost btn-sm" href={`/admin/team/${m.id}`}>Fill in profile</a>
                      ) : (
                        <form action={publishMemberAction.bind(null, m.id, !m.is_published)}>
                          <button className="btn btn-ghost btn-sm">{m.is_published ? 'Hide' : 'Show on site'}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-section" aria-labelledby="add-h">
          <h2 id="add-h" className="type-h3">Add a person</h2>
          <ActionForm action={createMemberAction} className="admin-form">
            <div className="admin-grid">
              <label className="field"><span>Name</span><input name="name" required maxLength={80} placeholder="Anjali Menon" /></label>
              <label className="field"><span>Role</span><input name="role" required maxLength={80} placeholder="Designer and developer" /></label>
              <label className="field"><span>WhatsApp Phone Number — Required <small>(digits with country code, e.g. +919876543210)</small></span><input name="whatsapp" required type="tel" placeholder="+919876543210" pattern="[\+]?[0-9]{10,15}" /></label>
              <label className="field"><span>Slug <small>(blank = from the name)</small></span><input name="slug" maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="anjali" /></label>
            </div>
            <div><Submit>Add person</Submit></div>
          </ActionForm>
        </section>
        </>
      )}
      <BotAlerts />
    </>
  );
}
