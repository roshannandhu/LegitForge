import { listProjects } from '@/lib/admin/db';
import { createProjectAction, moveProjectAction, publishProjectAction } from '../actions';
import { ActionButton, ActionForm, Submit } from '../ui';
import { GithubAdd } from './github-add';

export default async function AdminProjects() {
  const rows = await listProjects();
  return (
    <>
      <h1 className="type-h2">Projects</h1>
      <p className="admin-lead">
        Published projects replace the placeholders on the home page and /work, in this order.
        Drafts stay private: open one and use Preview.
      </p>

      <GithubAdd />

      <h2 className="type-h3 admin-subhead">Or start from a title</h2>
      <ActionForm action={createProjectAction} className="admin-form">
        <div className="admin-grid">
          <label className="field"><span>New project title</span><input name="title" required maxLength={120} placeholder="Sweet Crumbs Bakery website" /></label>
          <label className="field"><span>Slug <small>(the web address; blank = from the title)</small></span><input name="slug" maxLength={80} pattern="[a-z0-9]+(-[a-z0-9]+)*" placeholder="sweet-crumbs-bakery" /></label>
        </div>
        <div><Submit>Create and edit</Submit></div>
      </ActionForm>

      <section className="admin-section" aria-labelledby="list-h">
        <h2 id="list-h" className="type-h3">All projects</h2>
        {rows.length === 0 ? (
          <p className="admin-empty">No projects yet. The site shows its placeholders until you publish one.</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead><tr><th>Order</th><th>Project</th><th>Images</th><th>Status</th><th>Actions</th></tr></thead>
              <tbody>
                {rows.map((p, i) => (
                  <tr key={p.id}>
                    <td>
                      <div className="admin-actions">
                        <form action={moveProjectAction.bind(null, p.id, -1)}><button className="btn btn-ghost btn-sm" disabled={i === 0} aria-label={`Move ${p.title} up`}>↑</button></form>
                        <form action={moveProjectAction.bind(null, p.id, 1)}><button className="btn btn-ghost btn-sm" disabled={i === rows.length - 1} aria-label={`Move ${p.title} down`}>↓</button></form>
                      </div>
                    </td>
                    <td><a className="text-link" href={`/admin/projects/${p.id}`}>{p.title}</a><br /><span className="muted">/work/{p.slug}</span></td>
                    <td>{p.image_count ?? 0}</td>
                    <td><span className={`pill${p.is_published ? ' is-on' : ''}`}>{p.is_published ? 'Published' : 'Draft'}</span></td>
                    <td>
                      <div className="admin-actions">
                        <ActionButton action={publishProjectAction.bind(null, p.id, !p.is_published)}>{p.is_published ? 'Unpublish' : 'Publish'}</ActionButton>
                        <a className="btn btn-ghost btn-sm" href={`/admin/preview/${p.slug}`} target="_blank" rel="noopener">Preview</a>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
