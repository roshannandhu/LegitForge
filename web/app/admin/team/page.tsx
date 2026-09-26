import { listMembers } from '@/lib/admin/db';
import { importTeamAction, publishMemberAction } from '../actions';
import { Submit } from '../ui';

export default async function AdminTeam() {
  const rows = await listMembers();
  return (
    <>
      <h1 className="type-h2">Team</h1>
      <p className="admin-lead">Names, roles, bios, skills and photos for the team pages and the ID cards (flip and 3D).</p>
      {rows.length === 0 ? (
        <div className="admin-empty">
          <p style={{ marginTop: 0 }}>The site shows the people written in the code. Import them to edit them here.</p>
          <form action={importTeamAction}><Submit pending="Importing…">Import the current team</Submit></form>
        </div>
      ) : (
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead><tr><th>Card</th><th>Person</th><th>Photo</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="num">{m.id_code}</td>
                  <td><a className="text-link" href={`/admin/team/${m.id}`}>{m.name}</a><br /><span className="muted">{m.role}</span></td>
                  <td>{m.photo_key ? 'Yes' : <span className="muted">Monogram</span>}</td>
                  <td><span className={`pill${m.is_published ? ' is-on' : ''}`}>{m.is_published ? 'On the site' : 'Hidden'}</span></td>
                  <td>
                    <form action={publishMemberAction.bind(null, m.id, !m.is_published)}>
                      <button className="btn btn-ghost btn-sm">{m.is_published ? 'Hide' : 'Show on site'}</button>
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
