import { requireAdmin } from '@/lib/admin/auth';
import { overview } from '@/lib/admin/db';
import { refreshSiteAction } from './actions';
import { ActionForm, Submit } from './ui';
import { getEnv } from '@/lib/cf';
import { analyticsSummary } from '@/lib/analytics';
import { bot } from '@/lib/admin/bot';
import { stages, worstOf } from '@/lib/admin/wa-live';

const SAY = { ok: 'Working', warn: 'Working, with warnings', bad: 'Not working', idle: 'Working' } as const;

export default async function AdminHome() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const o = await overview();
  const db = (await getEnv())?.DB;
  const b = await bot();
  // Promise.resolve().then: `next dev`'s BOT stub throws synchronously when the bot isn't running
  const [events, m] = await Promise.all([db ? analyticsSummary(db).catch(() => null) : null, b ? Promise.resolve().then(() => b.monitor()).catch(() => null) : null]);
  const flow = m ? stages(m, Date.now()) : null, worst = worstOf(flow);
  const red = flow?.filter((x) => x.state === 'bad').map((x) => x.title) ?? [];
  const cards = [
    { href: '/admin/leads?status=new', n: o.leads.sub, label: `new leads, ${o.leads.total} in all` },
    { href: '/admin/projects', n: o.projects.sub, label: `published projects, ${o.projects.total} in all` },
    { href: '/admin/testimonials', n: o.testimonials.sub, label: `published testimonials, ${o.testimonials.total} in all` },
  ];
  return (
    <>
      <div className="admin-head">
        <h1 className="type-h2">Admin</h1>
        <a className="btn btn-primary btn-sm" href="/admin/projects">Add a project</a>
      </div>
      <p className={`wa-status is-${worst} admin-bot-line`} role="status">
        <span>WhatsApp bot: {flow ? SAY[worst] : 'not reachable'}{red.length ? ` (${red.join(', ')})` : ''}</span>
        <a className="text-link" href="/admin/whatsapp">See it live</a>
      </p>
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
      <ActionForm action={refreshSiteAction} className="admin-section admin-actions">
        <Submit className="btn btn-ghost btn-sm" pending="Refreshing…">Refresh site content</Submit>
        <span className="muted">Saving already updates the public pages; use this only if one still shows old content.</span>
      </ActionForm>
    </>
  );
}
