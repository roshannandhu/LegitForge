import { requireAdmin } from '@/lib/admin/auth';
import { overview } from '@/lib/admin/db';
import { refreshSiteAction } from './actions';
import { ActionForm, Submit } from './ui';
import { getEnv } from '@/lib/cf';
import { analyticsSummary } from '@/lib/analytics';

export default async function AdminHome() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const o = await overview();
  const db = (await getEnv())?.DB;
  const events = db ? await analyticsSummary(db).catch(() => null) : null;
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

      <section className="admin-section" aria-labelledby="analytics-h">
        <h2 id="analytics-h" className="type-h3">Website actions in the last 30 days</h2>
        <p className="admin-lead">Aggregate actions, with no visitor profiles. Clicks are not confirmed conversations; saved enquiries count only after storage succeeds.</p>
        {events ? <ul className="admin-cards">{events.map((e) => <li key={e.name}><div className="admin-card"><span className="num">{e.n}</span><span>{e.label}</span></div></li>)}</ul>
          : <p className="admin-empty">Action counts are temporarily unavailable.</p>}
      </section>
      <section className="admin-section" aria-labelledby="refresh-h">
        <h2 id="refresh-h" className="type-h3">Refresh site content</h2>
        <p className="admin-lead">Saving in the admin already updates the public pages. Use this if a page still shows old content.</p>
        <ActionForm action={refreshSiteAction}><Submit pending="Refreshing…">Refresh site content</Submit></ActionForm>
      </section>
    </>
  );
}
