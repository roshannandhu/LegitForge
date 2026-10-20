import { requireAdmin } from '@/lib/admin/auth';
import { listTestimonials } from '@/lib/admin/db';
import { deleteTestimonialAction, publishTestimonialAction, saveTestimonialAction } from '../actions';
import { ActionButton, ActionForm, ConfirmSubmit, Submit } from '../ui';

function Fields({ t }: { t?: Awaited<ReturnType<typeof listTestimonials>>[number] }) {
  return (
    <>
      {t && <input type="hidden" name="id" value={t.id} />}
      <div className="admin-grid admin-grid-3">
        <label className="field"><span>Name</span><input name="person_name" defaultValue={t?.person_name} required maxLength={120} /></label>
        <label className="field"><span>Role</span><input name="person_role" defaultValue={t?.person_role ?? ''} maxLength={120} placeholder="Owner" /></label>
        <label className="field"><span>Business</span><input name="company" defaultValue={t?.company ?? ''} maxLength={120} /></label>
      </div>
      <label className="field"><span>Quote <small>(their words, unedited)</small></span><textarea name="quote" defaultValue={t?.quote} required maxLength={1000} /></label>
      <label className="check"><input type="checkbox" name="permission_confirmed" defaultChecked={!!t?.permission_confirmed} /> Client gave written permission to publish this</label>
    </>
  );
}

/** The Edit line's preview: about 90 characters, cut at a word. */
const short = (s: string, n = 90) => (s.length <= n ? s : `${s.slice(0, n + 1).replace(/\s+\S*$/, '')}…`);

export default async function AdminTestimonials() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const rows = await listTestimonials();
  return (
    <>
      <h1 className="type-h2">Testimonials</h1>
      <p className="admin-lead">Client quotes for the home page. Nothing shows on the site until you publish one. Only publish a quote the client agreed to in writing: publishing is refused until the permission box is ticked.</p>
      <section className="admin-section admin-t-add" aria-labelledby="t-new">
        <h2 id="t-new" className="type-h3">Add a testimonial</h2>
        <ActionForm action={saveTestimonialAction} className="admin-form" resetOnOk>
          <Fields />
          <div><Submit>Add testimonial</Submit></div>
        </ActionForm>
      </section>

      <section className="admin-section" aria-labelledby="t-h">
        <h2 id="t-h" className="type-h3">All testimonials</h2>
        {rows.length === 0 ? <p className="admin-empty">None yet.</p> : (
          <ul className="admin-cards admin-list admin-t-list">
            {rows.map((t) => (
              <li key={t.id} className="admin-card">
                <div className="admin-card-head">
                  {/* published implies permission (the server refuses otherwise), so one status says it all */}
                  <span className={`pill${t.is_published ? ' is-on' : ''}`}>{t.is_published ? 'Published' : t.permission_confirmed ? 'Ready to publish' : 'Needs written permission'}</span>
                  <div className="admin-actions">
                    {t.is_published || t.permission_confirmed
                      ? <ActionButton action={publishTestimonialAction.bind(null, t.id, !t.is_published)}>{t.is_published ? 'Unpublish' : 'Publish'}</ActionButton>
                      : null}
                    <form action={deleteTestimonialAction.bind(null, t.id)}><ConfirmSubmit message={`Delete ${t.person_name}’s testimonial? This can't be undone.`}>Delete</ConfirmSubmit></form>
                  </div>
                </div>
                <details>
                  <summary>Edit “{short(t.quote)}” — {t.person_name}</summary>
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
