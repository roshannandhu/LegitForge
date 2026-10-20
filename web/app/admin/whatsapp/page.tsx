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
const MODES: Record<string, string> = { human: 'with a human agent', stopped: 'opted out (STOP)', blocked: 'blocked' };
const LABEL: Record<State, string> = { ok: 'Operational', warn: 'Needs Attention', bad: 'Offline / Error', idle: 'Standby' };

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

/** Admin → WhatsApp Command Center: Real-time operational monitoring, multi-stage health,
 *  customer pipeline funnel, live conversation feed with human takeover, and business analytics. */
export default async function AdminWhatsApp() {
  const who = await requireAdmin();
  const [d, stats, b, owner] = await Promise.all([dashboard(90), replyStats(), bot(), isOwner(who)]);
  const [m, ins] = b ? await Promise.all([Promise.resolve().then(() => b.monitor()).catch(() => null), Promise.resolve().then(() => b.insights(30)).catch(() => null)]) : [null, null];
  const now = Date.now();
  const flow = m ? stages(m, now) : null;
  const worst = worstOf(flow);
  const s = m?.store.ok ? m.store : null;
  const most = s ? Math.max(1, ...Object.values(s.steps)) : 1;

  return (
    <>
      <Refresh seconds={15} />

      {/* Top Operations Command Header */}
      <div className="wa-ops-header">
        <div className="wa-ops-title">
          <div>
            <h1 className="type-h2" style={{ margin: 0 }}>WhatsApp AI Command Center</h1>
            <p className="muted" style={{ margin: '4px 0 0', fontSize: '14px' }}>
              Real-time message routing, AI intelligence pipeline, and customer hand-off (Auto-refresh: 15s)
            </p>
          </div>
          <p className={`wa-status is-${worst}`} role="status">
            {!flow ? 'Bot unreachable' : worst === 'ok' ? 'All Systems Operational' : worst === 'warn' ? 'Operational with Warnings' : 'Action Required'}
          </p>
        </div>
        <div className="wa-ops-actions">
          <a className="btn btn-ghost btn-sm" href="/admin/whatsapp/ai">AI Key Vault</a>
          <a className="btn btn-ghost btn-sm" href="/admin/team">Team Roster</a>
          <a className="btn btn-ghost btn-sm" href="/admin/whatsapp/questions">
            Questions {s && s.health.openQuestions > 0 && <span className="pill is-hot" style={{ marginLeft: '4px' }}>{s.health.openQuestions}</span>}
          </a>
          <a className="btn btn-ghost btn-sm" href="/admin/whatsapp/connection">Connection</a>
        </div>
      </div>

      {/* Pipeline Stage Architecture */}
      {!flow ? (
        <p className="admin-empty">The bot Worker is not reachable from this environment. Verify Cloudflare Worker deployment and BOT service binding.</p>
      ) : (
        <ol className="wa-flow" aria-label="End-to-end messaging pipeline">
          {flow.map((x) => (
            <li key={x.title} className={`wa-stage is-${x.state}`}>
              <span className="wa-dot" aria-hidden="true" />
              <div className="wa-stage-body">
                <p className="wa-stage-title">
                  {x.title} <span className="wa-state">{LABEL[x.state]}</span>
                </p>
                <p className="wa-stage-detail">{x.detail}</p>
                {x.href && <a className="text-link" href={x.href}>{x.action} →</a>}
              </div>
            </li>
          ))}
        </ol>
      )}

      {/* QR Code link when Baileys is awaiting phone scan */}
      {m?.link.mode === 'baileys' && m.link.reachable && !m.link.connected && (
        <section className="admin-section wa-link" aria-labelledby="qr-h">
          <h2 id="qr-h" className="type-h3">Link the bot’s WhatsApp</h2>
          {!owner ? <p className="admin-lead">An owner links the bot’s number (Connection).</p> : (
            <div className="wa-qr">
              {m.link.qr ? <img src={m.link.qr} alt="QR code to link the bot's WhatsApp number" width={240} height={240} /> : <p className="muted">Waiting for a QR from WhatsApp…</p>}
              <p className="admin-lead">On the bot’s phone: WhatsApp → Settings → Linked devices → Link a device, and scan this. It changes every few seconds; this page follows. No second screen? <a className="text-link" href="/admin/whatsapp/connection">Link with a pairing code</a>.</p>
            </div>
          )}
        </section>
      )}

      {/* Real-time KPI Metric Cards */}
      {s && (
        <div className="wa-kpi-grid">
          <div className="wa-kpi-card">
            <span className="wa-kpi-num">{m ? `${m.leads.today} / ${m.leads.month}` : '—'}</span>
            <span className="wa-kpi-label">Leads (Today / 30 Days)</span>
          </div>
          <div className="wa-kpi-card">
            <span className="wa-kpi-num">{s.inToday} in · {s.outToday} out</span>
            <span className="wa-kpi-label">Messages Today</span>
          </div>
          <div className="wa-kpi-card">
            <span className="wa-kpi-num">{s.health.aiToday} / {s.health.aiCap}</span>
            <span className="wa-kpi-label">AI Quota Used Today</span>
          </div>
          <div className="wa-kpi-card">
            <span className="wa-kpi-num">{s.health.openQuestions} open · {s.health.pendingAnswers} draft</span>
            <span className="wa-kpi-label">Pending Team Escalations</span>
          </div>
          <div className="wa-kpi-card">
            <span className="wa-kpi-num">{s.health.withPerson}</span>
            <span className="wa-kpi-label">Active Human Takeovers</span>
          </div>
        </div>
      )}

      {/* Main Workspace: Live Stream & Pipeline Funnel */}
      {s && (
        <div className="wa-columns" style={{ marginTop: '24px' }}>
          {/* Customer Pipeline & Requirements Funnel */}
          <section className="admin-section" style={{ marginTop: 0 }} aria-labelledby="steps-h">
            <h2 id="steps-h" className="type-h3">Customer Journey & Funnel (30 Days)</h2>
            {Object.keys(s.steps).length ? (
              <ul className="wa-bars">
                {STEPS.filter(([k]) => s.steps[k]).map(([k, label]) => (
                  <li key={k} style={{ '--w': `${(s.steps[k] / most) * 100}%` } as React.CSSProperties}>
                    <span>{label}</span>
                    <span className="num">{s.steps[k]}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="admin-empty">No client chats in the last 30 days.</p>}
            {Object.keys(s.modes).length > 0 && (
              <p className="muted" style={{ marginTop: '12px' }}>
                Active Handling Modes: {Object.entries(s.modes).map(([k, n]) => `${n} ${MODES[k] ?? k}`).join(' · ')}
              </p>
            )}
          </section>

          {/* Real-time Message Stream */}
          <section className="admin-section" style={{ marginTop: 0 }} aria-labelledby="feed-h">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
              <h2 id="feed-h" className="type-h3" style={{ margin: 0 }}>Live Activity Feed</h2>
              <span className="muted" style={{ fontSize: '13px' }}>Latest {s.recent.length} events</span>
            </div>
            {s.recent.length ? (
              <div className="wa-feed" style={{ maxHeight: '680px', overflowY: 'auto' }}>
                {s.recent.map((x, i) => (
                  <div key={`${x.at}-${i}`} className="wa-feed-item">
                    <div className="wa-feed-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {x.who === 'client' && <span className="wa-pill wa-pill-client">Client</span>}
                        {x.who === 'bot' && <span className="wa-pill wa-pill-bot">Bot AI</span>}
                        {x.who === 'team' && <span className="wa-pill wa-pill-team">Team</span>}
                        {x.who === 'alert' && <span className="wa-pill wa-pill-alert">Alert</span>}
                        <strong style={{ color: 'var(--text)' }}>
                          {[x.code && `#${x.code}`, x.name].filter(Boolean).join(' ') || (x.who === 'bot' ? 'LegitForge Assistant' : 'Unknown')}
                        </strong>
                      </div>
                      <time dateTime={x.at}>{istTime(x.at)}</time>
                    </div>
                    <p className="wa-feed-text">{x.body || '—'}</p>
                    {x.leadId && (
                      <div className="wa-feed-actions">
                        <a className="text-link" style={{ fontSize: '13px' }} href={`/admin/leads/${x.leadId}/chat`}>
                          Open Chat & Live Takeover →
                        </a>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ) : <p className="admin-empty">No messages received yet.</p>}
          </section>
        </div>
      )}

      {/* Intelligence & Analytics Sections */}
      <section className="admin-section" aria-labelledby="sum-h">
        <h2 id="sum-h" className="type-h3">Enquiries Performance (90 days)</h2>
        <ul className="admin-cards">
          <li><div className="admin-card"><span className="num">{d.total}</span><span>Total Enquiries</span></div></li>
          <li><div className="admin-card"><span className="num">{d.won}</span><span>Won ({d.lost} Lost)</span></div></li>
          <li><div className="admin-card"><span className="num">{stats.total ? `${stats.fast}/${stats.total}` : '—'}</span><span>First reply &lt; 2h (30 days)</span></div></li>
          {ins && <li><div className="admin-card"><span className="num">{ins.byBot}/{ins.questions}</span><span>Bot Answered Questions</span></div></li>}
        </ul>
      </section>

      <section className="admin-section" aria-labelledby="weeks-h">
        <h2 id="weeks-h" className="type-h3">Week on Week Trajectory</h2>
        {d.weeks.length ? (
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-fit">
              <thead><tr><th>Week starting</th><th className="num">New Enquiries</th><th className="num">Won Deals</th></tr></thead>
              <tbody>
                {d.weeks.map((w) => <tr key={w.week}><td>{w.week}</td><td className="num">{w.n}</td><td className="num">{w.won}</td></tr>)}
              </tbody>
            </table>
          </div>
        ) : <p className="admin-empty">No enquiries in the last 8 weeks.</p>}
      </section>

      <section className="admin-section" aria-labelledby="by-h">
        <h2 id="by-h" className="type-h3">Traffic & Lead Distribution</h2>
        <div className="admin-breakdowns">
          <Breakdown title="Service Category" rows={d.by.service} />
          <Breakdown title="Customer Language" rows={d.by.language} />
          <Breakdown title="Channel Source" rows={d.by.source} />
          <Breakdown title="Landing Page" rows={d.by.page} />
          <Breakdown title="Lead Intent Score" rows={d.by.score} />
          <Breakdown title="Enquiry Status" rows={d.by.status} />
        </div>
      </section>

      <section className="admin-section" aria-labelledby="top-h">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '16px' }}>
          <h2 id="top-h" className="type-h3" style={{ margin: 0 }}>Top Customer Questions (30 Days)</h2>
          <a className="text-link" href="/admin/whatsapp/answers">Manage Approved Knowledge →</a>
        </div>
        {!ins ? <p className="admin-empty">Bot insights unavailable.</p>
          : ins.top.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table admin-table-fit">
                <thead><tr><th>Customer Question</th><th className="num">Times Asked</th><th className="num">Answered by AI</th></tr></thead>
                <tbody>
                  {ins.top.map((x) => <tr key={x.question}><td className="msg">{x.question}</td><td className="num">{x.count}</td><td className="num">{x.byBot}</td></tr>)}
                </tbody>
              </table>
            </div>
          ) : <p className="admin-empty">No questions logged in the last 30 days.</p>}
        {ins && (
          <p className="muted" style={{ marginTop: '12px' }}>
            Open questions needing team answer: {ins.open} · Approved knowledge entries: {ins.answers.approved} ({ins.answers.pending} pending review).
          </p>
        )}
      </section>
    </>
  );
}
