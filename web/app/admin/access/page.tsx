import { isOwner, ownerEmails, requireAdmin } from '@/lib/admin/auth';
import { listAdminEmails, listSignIns } from '@/lib/admin/db';
import { addAdminEmailAction, removeAdminEmailAction, signOutEverywhereAction } from '../actions';
import { ActionForm, ConfirmSubmit, Submit } from '../ui';

/** Admin → Access: the Google accounts that may sign in (lib/admin/auth.ts), and the sign-in log.
 *  Owners come from the ADMIN_EMAILS secret and can't be removed here; everyone else is a D1
 *  admin_emails row. Only owners can change the list or sign everyone out. */
export default async function AdminAccess() {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const [owner, owners, added, signIns] = await Promise.all([isOwner(who), ownerEmails(), listAdminEmails(), listSignIns()]);
  return (
    <>
      <h1 className="type-h2">Access</h1>
      <p className="admin-lead">The Google accounts that can sign in to this admin. Anyone else is turned away at the sign-in page. Removing an account ends its access on its next click.</p>
      {owner ? (
        <ActionForm action={addAdminEmailAction} className="admin-form" resetOnOk>
          <label className="field"><span>Google account email <small>(exactly as the account signs in)</small></span>
            <input name="email" type="email" required maxLength={254} autoComplete="off" spellCheck={false} placeholder="name@gmail.com" />
          </label>
          <div><Submit pending="Adding…">Add account</Submit></div>
        </ActionForm>
      ) : <p className="admin-empty">Only the owners can add or remove accounts.</p>}

      <section className="admin-section" aria-labelledby="a-h">
        <h2 id="a-h" className="type-h3">Who can sign in</h2>
        <ul className="admin-cards" style={{ gridTemplateColumns: '1fr' }}>
          {owners.map((e) => (
            <li key={e} className="admin-card admin-access">
              <strong>{e}</strong>
              <span className="pill is-on">Owner</span>
            </li>
          ))}
          {added.filter((a) => !owners.includes(a.email)).map((a) => (   // an owner also added here shows once
            <li key={a.email} className="admin-card admin-access">
              <strong>{a.email}</strong>
              <span className="muted">Added by {a.added_by}, {a.added_at.slice(0, 10)}</span>
              {owner && (
                <form action={removeAdminEmailAction.bind(null, a.email)}>
                  <ConfirmSubmit message={`Remove ${a.email}? It can't sign in again until someone adds it back.`}>Remove</ConfirmSubmit>
                </form>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="admin-section" aria-labelledby="s-h">
        <h2 id="s-h" className="type-h3">Recent sign-ins</h2>
        <p className="admin-lead">Every Google sign-in of the last 90 days. One you don&rsquo;t recognise? Remove that account, or sign everyone out.</p>
        {signIns.length === 0 ? <p className="admin-empty">None yet.</p> : (
          <ul className="admin-signins">
            {signIns.map((s, i) => <li key={i}><strong>{s.email}</strong> <span className="muted">{s.at} UTC</span></li>)}
          </ul>
        )}
        {owner && (
          <form action={signOutEverywhereAction} className="admin-subhead">
            <ConfirmSubmit message="Sign out every admin on every device, you included? Everyone signs in with Google again.">Sign out everywhere</ConfirmSubmit>
          </form>
        )}
      </section>
    </>
  );
}
