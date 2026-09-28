import { ownerEmails, requireAdmin } from '@/lib/admin/auth';
import { listAdminEmails } from '@/lib/admin/db';
import { addAdminEmailAction, removeAdminEmailAction } from '../actions';
import { ActionForm, ConfirmSubmit, Submit } from '../ui';

/** Admin → Access: the Google accounts that may sign in (lib/admin/auth.ts). Owners come from
 *  the ADMIN_EMAILS secret and can't be removed here; everyone else is a D1 admin_emails row. */
export default async function AdminAccess() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const [owners, added] = await Promise.all([ownerEmails(), listAdminEmails()]);
  return (
    <>
      <h1 className="type-h2">Access</h1>
      <p className="admin-lead">The Google accounts that can sign in to this admin. Anyone else is turned away at the sign-in page. Removing an account ends its access on its next click.</p>
      <ActionForm action={addAdminEmailAction} className="admin-form" resetOnOk>
        <label className="field"><span>Google account email <small>(exactly as the account signs in)</small></span>
          <input name="email" type="email" required maxLength={254} autoComplete="off" spellCheck={false} placeholder="name@gmail.com" />
        </label>
        <div><Submit pending="Adding…">Add account</Submit></div>
      </ActionForm>

      <section className="admin-section" aria-labelledby="a-h">
        <h2 id="a-h" className="type-h3">Who can sign in</h2>
        <ul className="admin-cards" style={{ gridTemplateColumns: '1fr' }}>
          {owners.map((e) => (
            <li key={e} className="admin-card admin-access">
              <strong>{e}</strong>
              <span className="pill is-on">Owner</span>
            </li>
          ))}
          {added.map((a) => (
            <li key={a.email} className="admin-card admin-access">
              <strong>{a.email}</strong>
              <span className="muted">Added by {a.added_by}, {a.added_at.slice(0, 10)}</span>
              <form action={removeAdminEmailAction.bind(null, a.email)}>
                <ConfirmSubmit message={`Remove ${a.email}? It can't sign in again until someone adds it back.`}>Remove</ConfirmSubmit>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
