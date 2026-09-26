import { listTestimonials } from '@/lib/admin/db';
import { deleteTestimonialAction, publishTestimonialAction, saveTestimonialAction } from '../actions';
import { ActionButton, ActionForm, Submit } from '../ui';

function Fields({ t }: { t?: Awaited<ReturnType<typeof listTestimonials>>[number] }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="admin-grid">
        <label className="field"><span>Name</span><input name="person_name" defaultValue={t?.person_name} required maxLength={120} /></label>
        <label className="field"><span>Role</span><input name="person_role" defaultValue={t?.person_role ?? ''} maxLength={120} placeholder="Owner" /></label>
        <label className="field"><span>Business</span><input name="company" defaultValue={t?.company ?? ''} maxLength={120} /></label>
      </div>
      <label className="field"><span>Quote <small>(their words, unedited)</small></span><textarea name="quote" defaultValue={t?.quote} required maxLength={1000} /></label>
      <label className="check"><input type="checkbox" name="permission_confirmed" defaultChecked={!!t?.permission_confirmed} /> Client gave written permission to publish this</label>
    </>
  );
}

export default async function AdminTestimonials() {
  const rows = await listTestimonials();
  return (
    <>
      <h1 className="type-h2">Testimonials</h1>
      <p className="admin-lead">Only publish a quote the client agreed to in writing. Publishing is refused until the permission box is ticked.</p>
      <ActionForm action={saveTestimonialAction} className="admin-form">
        <Fields />
        <div><Submit>Add testimonial</Submit></div>
      </ActionForm>

      <section className="admin-section" aria-labelledby="t-h">
        <h2 id="t-h" className="type-h3">All testimonials</h2>
        {rows.length === 0 ? <p className="admin-empty">None yet.</p> : (
          <ul className="admin-cards" style={{ gridTemplateColumns: '1fr' }}>
            {rows.map((t) => (
              <li key={t.id} className="admin-card">
                <div className="admin-actions">
                  <span className={`pill${t.is_published ? ' is-on' : ''}`}>{t.is_published ? 'Published' : 'Not published'}</span>
                  <span className={`pill${t.permission_confirmed ? ' is-on' : ''}`}>{t.permission_confirmed ? 'Permission given' : 'No permission yet'}</span>
                  <ActionButton action={publishTestimonialAction.bind(null, t.id, !t.is_published)}>{t.is_published ? 'Unpublish' : 'Publish'}</ActionButton>
                  <form action={deleteTestimonialAction.bind(null, t.id)}><button className="btn btn-ghost btn-sm btn-danger">Delete</button></form>
                </div>
                <details>
                  <summary className="check">Edit “{t.quote.slice(0, 60)}{t.quote.length > 60 ? '…' : ''}” — {t.person_name}</summary>
                  <ActionForm action={saveTestimonialAction} className="admin-form"><Fields t={t} /><div><Submit>Save</Submit></div></ActionForm>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
