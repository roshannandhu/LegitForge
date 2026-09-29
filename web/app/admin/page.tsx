import { requireAdmin } from '@/lib/admin/auth';
import { overview } from '@/lib/admin/db';
import { refreshSiteAction } from './actions';
import { ActionForm, Submit } from './ui';

export default async function AdminHome() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const o = await overview();
  const cards = [
    { href: '/admin/leads?status=new', n: o.leads.sub, label: `new leads, ${o.leads.total} in all` },
    { href: '/admin/projects', n: o.projects.sub, label: `published projects, ${o.projects.total} in all` },
    { href: '/admin/testimonials', n: o.testimonials.sub, label: `published testimonials, ${o.testimonials.total} in all` },
  ];
  return (
    <>
      <h1 className="type-h2">Admin</h1>
      <p className="admin-lead">Add a project in under two minutes: create it, paste a screenshot, publish. Leads from the contact form land here first.</p>
      <ul className="admin-cards">
        {cards.map((c) => (
          <li key={c.href}><a className="admin-card" href={c.href}><span className="num">{c.n}</span><span>{c.label}</span></a></li>
        ))}
      </ul>

      <section className="admin-section" aria-labelledby="refresh-h">
        <h2 id="refresh-h" className="type-h3">Refresh site content</h2>
        <p className="admin-lead">Saving in the admin already updates the public pages. Use this if a page still shows old content.</p>
        <ActionForm action={refreshSiteAction}><Submit pending="Refreshing…">Refresh site content</Submit></ActionForm>
      </section>
    </>
  );
}
