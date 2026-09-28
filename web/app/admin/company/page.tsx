import { isOwner, requireAdmin } from '@/lib/admin/auth';
import { readCompany } from '@/lib/company';
import { COMPANY_DEFAULTS, SOCIALS } from '@/lib/site';
import { saveCompanyAction } from '../actions';
import { ActionForm, Submit } from '../ui';

/** Admin → Company: the details every page prints (lib/company.ts). Owners edit, other admins
 *  read: the WhatsApp number is where every customer chat goes. */
export default async function AdminCompany() {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const [owner, saved] = await Promise.all([isOwner(who), readCompany()]);
  const c = saved ?? COMPANY_DEFAULTS;
  return (
    <>
      <h1 className="type-h2">Company</h1>
      <p className="admin-lead">What the site prints about the company: in the footer, on the contact and legal pages and for search engines. Switch anything off to hide it. Saving updates every page on its next visit.</p>
      {!owner && <p className="admin-empty">Only the owners can change these details.</p>}

      <ActionForm action={saveCompanyAction} className="admin-form">
        <fieldset className="admin-fieldset" disabled={!owner}>
          <legend>Contact</legend>
          <div className="admin-grid">
            <label className="field"><span>Email</span>
              <input name="email" type="email" defaultValue={c.email} maxLength={254} autoComplete="off" spellCheck={false} /></label>
            <label className="check"><input type="checkbox" name="showEmail" defaultChecked={c.showEmail} /> Show the email on the site</label>
          </div>
          <label className="field"><span>WhatsApp number <small>(country code first, digits only, like 919876543210)</small></span>
            <input name="whatsapp" inputMode="tel" defaultValue={c.whatsapp} maxLength={24} placeholder="919876543210" autoComplete="off" /></label>
          <p className="muted">
            Every “Chat on WhatsApp” button on the site opens this number; empty, they go to the contact section instead.
            If a WhatsApp bot answers for you (WhatsApp Cloud API or n8n), connect the same number there.
          </p>
          <label className="field"><span>WhatsApp greeting <small>(the message a chat starts with)</small></span>
            <input name="whatsappText" defaultValue={c.whatsappText} maxLength={200} /></label>
        </fieldset>

        <fieldset className="admin-fieldset" disabled={!owner}>
          <legend>Social links</legend>
          {SOCIALS.map((s) => (
            <div key={s.key} className="social-row">
              <label className="field"><span>{s.label}</span>
                <input name={`social_${s.key}`} type="url" defaultValue={c.social[s.key].url} maxLength={300} placeholder={`https://${s.hosts[0]}/…`} spellCheck={false} /></label>
              <label className="check"><input type="checkbox" name={`social_${s.key}_on`} defaultChecked={c.social[s.key].on} /> Show</label>
            </div>
          ))}
        </fieldset>

        <fieldset className="admin-fieldset" disabled={!owner}>
          <legend>Business details (optional; empty ones are hidden)</legend>
          <div className="admin-grid">
            <label className="field"><span>Legal name</span><input name="legalName" defaultValue={c.legalName} maxLength={120} /></label>
            <label className="field"><span>GSTIN or tax ID</span><input name="taxId" defaultValue={c.taxId} maxLength={30} spellCheck={false} /></label>
            <label className="field"><span>City</span><input name="city" defaultValue={c.city} maxLength={80} /></label>
            <label className="field"><span>Country</span><input name="country" defaultValue={c.country} maxLength={80} /></label>
          </div>
        </fieldset>

        {owner && <div><Submit>Save company details</Submit></div>}
      </ActionForm>
    </>
  );
}
