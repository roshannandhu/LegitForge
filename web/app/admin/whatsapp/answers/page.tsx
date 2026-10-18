import { requireAdmin } from '@/lib/admin/auth';
import { bot, type Answer } from '@/lib/admin/bot';
import { ActionForm, Submit } from '../../ui';
import { archiveAnswerAction, saveAnswerAction, setAnswerAction } from '../actions';

function AnswerForm({ a }: { a?: Answer }) {
  return (
    <ActionForm action={saveAnswerAction} className="admin-form" resetOnOk={!a}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="field"><span>Question (English)</span><input name="question" required maxLength={200} defaultValue={a?.question_en} placeholder="Do you build websites in Malayalam?" /></label>
      <label className="field"><span>Answer (English: the bot translates it for each client)</span><textarea name="answer" required maxLength={700} defaultValue={a?.answer_en} /></label>
      <label className="field"><span>Check again by <small>(optional: after this date the bot asks the team instead, until it is saved again)</small></span>
        <input type="date" name="review_at" defaultValue={a?.review_at?.slice(0, 10) ?? ''} /></label>
      <div className="admin-actions"><Submit>{a ? 'Save' : 'Add answer'}</Submit></div>
    </ActionForm>
  );
}

const LABEL: Record<Answer['status'], string> = { approved: 'In use', pending: 'Waiting for approval', rejected: 'Off', superseded: 'Replaced', archived: 'Archived' };
const SHOWN = ['approved', 'pending', 'rejected', 'superseded', 'archived'] as const;

/** Admin → WhatsApp → Answers: what the bot may say by itself. Edit, switch off or on, or add. */
export default async function AdminAnswers({ searchParams }: { searchParams: Promise<{ show?: string; history?: string }> }) {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const sp = await searchParams;
  const status = SHOWN.find((s) => s === sp.show);
  const b = await bot();
  const answers = b ? await b.answers(status).catch(() => null) : null;
  const history = b && Number(sp.history) ? await b.history(Number(sp.history)).catch(() => null) : null;
  return (
    <>
      <h1 className="type-h2">What the bot knows</h1>
      <p className="admin-lead">
        Answers the bot sends by itself when a client asks something close (it also learns new ones when the team taps
        Approve in WhatsApp). Answers never name prices or dates: those always go to the team. A change here is used at once.
      </p>
      <div className="admin-actions admin-leads-filter">
        <a className="btn btn-ghost btn-sm" href="/admin/whatsapp/answers" aria-current={!status ? 'page' : undefined}>All</a>
        {SHOWN.map((s) => (
          <a key={s} className="btn btn-ghost btn-sm" href={`/admin/whatsapp/answers?show=${s}`} aria-current={status === s ? 'page' : undefined}>{LABEL[s]}</a>
        ))}
      </div>
      {history && history.length > 0 && (
        <section className="admin-section" aria-labelledby="hist-h">
          <h2 id="hist-h" className="type-h3">History of “{history[0].question_en}”</h2>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Version</th><th>State</th><th>Answer</th><th>Decided</th></tr></thead><tbody>
            {history.map((h) => <tr key={h.id}><td className="num">{h.version ?? 1}</td><td>{LABEL[h.status]}</td><td className="msg">{h.answer_en}</td>
              <td className="muted">{h.decided_at ? `${h.decided_at.slice(0, 10)} · ${h.decided_by ?? ''}` : '—'}</td></tr>)}
          </tbody></table></div>
        </section>
      )}
      <h2 className="type-h3 admin-subhead">Add an answer</h2>
      <AnswerForm />
      <h2 className="type-h3 admin-subhead">Answers</h2>
      {!answers ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
        : !answers.length ? <p className="admin-empty">No answers{status ? ` (${LABEL[status].toLowerCase()})` : ''} yet.</p>
        : answers.map((a) => (
          <div key={a.id} className="admin-fieldset" style={{ marginBottom: 16 }}>
            <p className="muted" style={{ margin: 0 }}>
              <span className={`pill${a.status === 'approved' ? ' is-on' : ''}`}>{LABEL[a.status]}</span>{' '}
              {a.source === 'site' ? 'From the website FAQ' : 'Learned from the team'}{a.wins ? ` · used in ${a.wins} won deal${a.wins > 1 ? 's' : ''}` : ''}
              {a.translations_ok ? ' · translations approved' : ''}
              {(a.version ?? 1) > 1 || a.supersedes ? <> · version {a.version ?? 1} · <a className="text-link" href={`/admin/whatsapp/answers?history=${a.id}`}>history</a></> : null}
              {a.review_at ? ` · ${Date.parse(a.review_at) < Date.now() ? 'past its review date (not used)' : `check again by ${a.review_at.slice(0, 10)}`}` : ''}
            </p>
            {a.status === 'superseded' || a.status === 'archived' ? <p className="msg">{a.answer_en}</p> : <AnswerForm a={a} />}
            <div className="admin-actions">
              {a.status !== 'archived' && (
                <ActionForm action={setAnswerAction.bind(null, a.id, a.status !== 'approved')}>
                  <Submit className="btn btn-ghost btn-sm" pending="…">{a.status === 'approved' ? 'Switch off' : 'Use it'}</Submit>
                </ActionForm>
              )}
              {a.status !== 'archived' && (
                <ActionForm action={archiveAnswerAction.bind(null, a.id)}>
                  <Submit className="btn btn-ghost btn-sm" pending="…">Archive</Submit>
                </ActionForm>
              )}
            </div>
          </div>
        ))}
    </>
  );
}
