import { requireAdmin } from '@/lib/admin/auth';
import { bot, dashboard, type Count } from '@/lib/admin/bot';
import { replyStats } from '@/lib/admin/lead-delivery';

function Breakdown({ title, rows }: { title: string; rows: Count[] }) {
  return (
    <div className="admin-fieldset">
      <h3 style={{ margin: 0, fontSize: 16 }}>{title}</h3>
      {rows.length ? (
        <table className="admin-table" style={{ minWidth: 0 }}><tbody>
          {rows.map((r) => <tr key={r.label}><td>{r.label}</td><td className="num">{r.n}</td></tr>)}
        </tbody></table>
      ) : <p className="muted">None yet.</p>}
    </div>
  );
}

/** Admin → WhatsApp: enquiries by service, language, source, score, status and page, week on week,
 *  the 2-hour promise, and what clients asked the bot. */
export default async function AdminWhatsApp() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const [d, stats, b] = await Promise.all([dashboard(90), replyStats(), bot()]);
  const ins = b ? await b.insights(30).catch(() => null) : null;
  return (
    <>
      <h1 className="type-h2">WhatsApp bot</h1>
      <p className="admin-lead">
        Enquiries of the last 90 days (website form and WhatsApp), and what clients asked the bot in the last 30.{' '}
        <a className="text-link" href="/admin/whatsapp/answers">What the bot knows</a> · <a className="text-link" href="/admin/whatsapp/settings">Pause, away message, saved replies</a>
      </p>
      <ul className="admin-cards">
        <li><div className="admin-card"><span className="num">{d.total}</span><span>enquiries (90 days)</span></div></li>
        <li><div className="admin-card"><span className="num">{d.won}</span><span>won · {d.lost} lost</span></div></li>
        <li><div className="admin-card"><span className="num">{stats.total ? `${stats.fast}/${stats.total}` : '—'}</span><span>first reply within 2 hours (30 days)</span></div></li>
        {ins && <li><div className="admin-card"><span className="num">{ins.byBot}/{ins.questions}</span><span>questions answered by the bot (30 days)</span></div></li>}
      </ul>

      <section className="admin-section" aria-labelledby="weeks-h">
        <h2 id="weeks-h" className="type-h3">Week on week</h2>
        {d.weeks.length ? (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Week from</th><th>Enquiries</th><th>Won</th></tr></thead><tbody>
            {d.weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td className="num">{w.n}</td><td className="num">{w.won}</td></tr>)}
          </tbody></table></div>
        ) : <p className="admin-empty">No enquiries in the last 8 weeks.</p>}
      </section>

      <section className="admin-section" aria-labelledby="by-h">
        <h2 id="by-h" className="type-h3">Where they come from</h2>
        <div className="admin-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
          <Breakdown title="Service" rows={d.by.service} />
          <Breakdown title="Language" rows={d.by.language} />
          <Breakdown title="Source" rows={d.by.source} />
          <Breakdown title="Which page brought them" rows={d.by.page} />
          <Breakdown title="Lead score" rows={d.by.score} />
          <Breakdown title="Status" rows={d.by.status} />
        </div>
      </section>

      <section className="admin-section" aria-labelledby="top-h">
        <h2 id="top-h" className="type-h3">Top questions (30 days)</h2>
        {!ins ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
          : ins.top.length ? (
            <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Question</th><th>Asked</th><th>Answered by the bot</th></tr></thead><tbody>
              {ins.top.map((x) => <tr key={x.question}><td className="msg">{x.question}</td><td className="num">{x.count}</td><td className="num">{x.byBot}</td></tr>)}
            </tbody></table></div>
          ) : <p className="admin-empty">No questions yet.</p>}
        {ins && <p className="muted">Open now: {ins.open}. Answers the bot knows: {ins.answers.approved} (waiting for approval: {ins.answers.pending}).</p>}
      </section>
    </>
  );
}
