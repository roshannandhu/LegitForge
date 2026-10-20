import { isOwner, requireAdmin } from '@/lib/admin/auth';
import { bot, dashboard, type Count, type FeedLine } from '@/lib/admin/bot';
import { replyStats } from '@/lib/admin/lead-delivery';
import { Refresh } from '../ui';
import { istTime, stages, worstOf, type State } from '@/lib/admin/wa-live';


const STEPS: [string, string][] = [
  ['start', 'Said hello'], ['returning', 'Came back'], ['service', 'Choosing a service'], ['language', 'Choosing a language'],
  ['name', 'Name'], ['business', 'Business'], ['need', 'What they need'], ['details', 'Service details'], ['refs', 'Websites they like'],
  ['timeline', 'Timeline'], ['contact', 'Contact'], ['done', 'Brief complete'],
];
const MODES: Record<string, string> = { human: 'with a person', stopped: 'opted out (STOP)', blocked: 'blocked' };
const WHO: Record<FeedLine['who'], string> = { client: 'Client → bot', bot: 'Bot → client', team: 'Team', alert: 'Bot → team' };
const LABEL: Record<State, string> = { ok: 'Working', warn: 'Needs a look', bad: 'Not working', idle: 'Waiting' };

function Breakdown({ title, rows }: { title: string; rows: Count[] }) {
  return (
    <div className="admin-fieldset">
      <h3 className="admin-mini-h">{title}</h3>
      {rows.length ? (
        <ul className="admin-kv">{rows.map((r) => <li key={r.label}><span>{r.label}</span><span className="num">{r.n}</span></li>)}</ul>
      ) : <p className="muted">None yet.</p>}
    </div>
  );
}

/** Admin → WhatsApp → Live: the bot's whole path, live (refreshes every 15 seconds), where clients
 *  are in the brief, the latest messages; then enquiries of the last 90 days and what clients asked. */
export default async function AdminWhatsApp() {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const [d, stats, b, owner] = await Promise.all([dashboard(90), replyStats(), bot(), isOwner(who)]);
  // Promise.resolve().then: `next dev`'s BOT stub throws synchronously when the bot isn't running
  const [m, ins] = b ? await Promise.all([Promise.resolve().then(() => b.monitor()).catch(() => null), Promise.resolve().then(() => b.insights(30)).catch(() => null)]) : [null, null];
  const now = Date.now();
  const flow = m ? stages(m, now) : null;
  const worst = worstOf(flow);
  const s = m?.store.ok ? m.store : null;
  const most = s ? Math.max(1, ...Object.values(s.steps)) : 1;
  return (
    <>
      <Refresh seconds={15} />
      <div className="admin-head">
        <h1 className="type-h2">WhatsApp bot</h1>
        <p className={`wa-status is-${worst}`} role="status">{!flow ? 'Bot not reachable' : worst === 'ok' ? 'Working' : worst === 'warn' ? 'Working, with warnings' : 'Not working'}</p>
      </div>
      <p className="admin-lead">Every client message passes these stages. This page checks each one and refreshes every 15 seconds.</p>

      {!flow ? <p className="admin-empty">The bot is not reachable from here (it needs the bot Worker deployed and the website’s BOT binding).</p> : (
        <ol className="wa-flow" aria-label="How a message travels">
          {flow.map((x) => (
            <li key={x.title} className={`wa-stage is-${x.state}`}>
              <span className="wa-dot" aria-hidden="true" />
              <div className="wa-stage-body">
                <p className="wa-stage-title">{x.title} <span className="wa-state">{LABEL[x.state]}</span></p>
                <p className="wa-stage-detail">{x.detail}</p>
                {x.href && <a className="text-link" href={x.href}>{x.action}</a>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {m?.link.mode === 'baileys' && m.link.reachable && !m.link.connected && (
        <section className="admin-section wa-link" aria-labelledby="qr-h">
          <h2 id="qr-h" className="type-h3">Link the bot’s WhatsApp</h2>
          {!owner ? <p className="admin-lead">An owner links the bot’s number (Connection).</p> : (
            <div className="wa-qr">
              {m.link.qr ? <img src={m.link.qr} alt="QR code to link the bot's WhatsApp number" width={240} height={240} /> : <p className="muted">Waiting for a QR from WhatsApp…</p>}
              <p className="admin-lead">On the bot’s phone: WhatsApp → Settings → Linked devices → Link a device, and scan this. It changes every few seconds; this page follows. No second screen? <a className="text-link" href="/admin/whatsapp/connection">Link with a code</a>.</p>
            </div>
          )}
        </section>
      )}

      {s && (
        <div className="wa-columns">
          <section className="admin-section" aria-labelledby="steps-h">
            <h2 id="steps-h" className="type-h3">Where clients are (30 days)</h2>
            {Object.keys(s.steps).length ? (
              <ul className="wa-bars">
                {STEPS.filter(([k]) => s.steps[k]).map(([k, label]) => (
                  <li key={k} style={{ '--w': `${(s.steps[k] / most) * 100}%` } as React.CSSProperties}><span>{label}</span><span className="num">{s.steps[k]}</span></li>
                ))}
              </ul>
            ) : <p className="admin-empty">No client chats in the last 30 days.</p>}
            {Object.keys(s.modes).length > 0 && <p className="muted">{Object.entries(s.modes).map(([k, n]) => `${n} ${MODES[k] ?? k}`).join(' · ')}</p>}
          </section>
          <section className="admin-section" aria-labelledby="feed-h">
            <h2 id="feed-h" className="type-h3">Latest messages</h2>
            {s.recent.length ? (
              <ol className="wa-feed">
                {s.recent.map((x, i) => (
                  <li key={`${x.at}-${i}`} className={`is-${x.who}`}>
                    <p className="wa-feed-meta"><time dateTime={x.at}>{istTime(x.at)}</time> · {WHO[x.who]}{x.name || x.code ? ` · ${[x.code && `#${x.code}`, x.name].filter(Boolean).join(' ')}` : ''}
                      {x.leadId && <> · <a className="text-link" href={`/admin/leads/${x.leadId}/chat`}>Chat</a></>}</p>
                    <p className="wa-feed-body">{x.body || '—'}</p>
                  </li>
                ))}
              </ol>
            ) : <p className="admin-empty">No messages yet.</p>}
          </section>
        </div>
      )}

      {s && (
        <section className="admin-section" aria-labelledby="now-h">
          <h2 id="now-h" className="type-h3">Needs the team</h2>
          <ul className="admin-cards">
            <li><a className="admin-card" href="/admin/whatsapp/questions"><span className="num">{s.health.openQuestions}</span><span>open questions</span></a></li>
            <li><a className="admin-card" href="/admin/whatsapp/answers?show=pending"><span className="num">{s.health.pendingAnswers}</span><span>answers to approve{s.health.pastReview ? ` · ${s.health.pastReview} past review` : ''}</span></a></li>
            <li><div className="admin-card"><span className="num">{s.health.withPerson}</span><span>chats with a person</span></div></li>
            <li><div className="admin-card"><span className="num">{s.health.aiToday}/{s.health.aiCap}</span><span>AI requests today</span></div></li>
          </ul>
        </section>
      )}

      <section className="admin-section" aria-labelledby="sum-h">
        <h2 id="sum-h" className="type-h3">Enquiries (90 days)</h2>
        <ul className="admin-cards">
          <li><div className="admin-card"><span className="num">{d.total}</span><span>enquiries</span></div></li>
          <li><div className="admin-card"><span className="num">{d.won}</span><span>won · {d.lost} lost</span></div></li>
          <li><div className="admin-card"><span className="num">{stats.total ? `${stats.fast}/${stats.total}` : '—'}</span><span>first reply within 2 hours (30 days)</span></div></li>
          {ins && <li><div className="admin-card"><span className="num">{ins.byBot}/{ins.questions}</span><span>questions answered by the bot (30 days)</span></div></li>}
        </ul>
      </section>

      <section className="admin-section" aria-labelledby="weeks-h">
        <h2 id="weeks-h" className="type-h3">Week on week</h2>
        {d.weeks.length ? (
          <div className="admin-table-wrap"><table className="admin-table admin-table-fit"><thead><tr><th>Week from</th><th className="num">Enquiries</th><th className="num">Won</th></tr></thead><tbody>
            {d.weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td className="num">{w.n}</td><td className="num">{w.won}</td></tr>)}
          </tbody></table></div>
        ) : <p className="admin-empty">No enquiries in the last 8 weeks.</p>}
      </section>

      <section className="admin-section" aria-labelledby="by-h">
        <h2 id="by-h" className="type-h3">Where they come from</h2>
        <div className="admin-breakdowns">
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
        {!ins ? <p className="admin-empty">The bot is not reachable from here yet.</p>
          : ins.top.length ? (
            <div className="admin-table-wrap"><table className="admin-table admin-table-fit"><thead><tr><th>Question</th><th className="num">Asked</th><th className="num">By the bot</th></tr></thead><tbody>
              {ins.top.map((x) => <tr key={x.question}><td className="msg">{x.question}</td><td className="num">{x.count}</td><td className="num">{x.byBot}</td></tr>)}
            </tbody></table></div>
          ) : <p className="admin-empty">No questions yet.</p>}
        {ins && <p className="muted">Open now: {ins.open}. Answers the bot knows: {ins.answers.approved} (waiting for approval: {ins.answers.pending}).</p>}
      </section>
    </>
  );
}
