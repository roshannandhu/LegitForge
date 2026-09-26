import { listMembers } from '@/lib/admin/db';
import { createMemberAction, importTeamAction, moveMemberAction, publishMemberAction } from '../actions';
import { ActionForm, Submit } from '../ui';

export default async function AdminTeam() {
  const rows = await listMembers();
  return (
    <>
      <h1 className="type-h2">Team</h1>
      <p className="admin-lead">
        Names, roles, bios, skills and photos for the team pages and the ID cards (flip and 3D). Add as many people as
        you like: the cards scroll sideways on every screen, in this order. A new person stays hidden until you fill in
        their profile and choose “Show on site”.
      </p>
      {rows.length === 0 ? (
        <div className="admin-empty">
          <p style={{ marginTop: 0 }}>The site shows the people written in the code. Import them to edit them here.</p>
          <form action={importTeamAction}><Submit pending="Importing…">Import the current team</Submit></form>
        </div>
      ) : (
        <>
        <ActionForm action={createMemberAction} className="admin-form">
          <div className="admin-grid">
            <label className="field"><span>Name</span><input name="name" required maxLength={80} placeholder="Anjali Menon" /></label>
            <label className="field"><span>Role</span><input name="role" required maxLength={80} placeholder="Designer and developer" /></label>
            <label className="field"><span>Slug <small>(their page: /team/…; blank = from the name)</small></span><input name="slug" maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="anjali" /></label>
          </div>
          <div><Submit>Add person</Submit></div>
        </ActionForm>
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Order</th><th>Card</th><th>Person</th><th>Photo</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((m, i) => (
                <tr key={m.id}>
                  <td>
                    <div className="admin-actions">
                      <form action={moveMemberAction.bind(null, m.id, -1)}><button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label={`Move ${m.name} up`}>↑</button></form>
                      <form action={moveMemberAction.bind(null, m.id, 1)}><button className="btn btn-ghost btn-sm" disabled={i === rows.length - 1} aria-label={`Move ${m.name} down`}>↓</button></form>
                    </div>
                  </td>
                  <td className="num">{m.id_code}</td>
                  <td><a className="text-link" href={`/admin/team/${m.id}`}>{m.name}</a><br /><span className="muted">{m.role}</span></td>
                  <td>{m.photo_key ? 'Yes' : <span className="muted">Monogram</span>}</td>
                  <td><span className={`pill${m.is_published ? ' is-on' : ''}`}>{m.is_published ? 'On the site' : 'Hidden'}</span></td>
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
        </>
      )}
    </>
  );
}
