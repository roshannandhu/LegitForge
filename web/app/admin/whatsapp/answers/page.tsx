import { requireAdmin } from '@/lib/admin/auth';
import { bot, type Answer } from '@/lib/admin/bot';
import { ActionForm, Submit } from '../../ui';
import { saveAnswerAction, setAnswerAction } from '../actions';

function AnswerForm({ a }: { a?: Answer }) {
  return (
    <ActionForm action={saveAnswerAction} className="admin-form" resetOnOk={!a}>
      {a && <input type="hidden" name="id" value={a.id} />}
      <label className="field"><span>Question (English)</span><input name="question" required maxLength={200} defaultValue={a?.question_en} placeholder="Do you build websites in Malayalam?" /></label>
      <label className="field"><span>Answer (English: the bot translates it for each client)</span><textarea name="answer" required maxLength={700} defaultValue={a?.answer_en} /></label>
      <div className="admin-actions"><Submit>{a ? 'Save' : 'Add answer'}</Submit></div>
    </ActionForm>
  );
}

const LABEL: Record<Answer['status'], string> = { approved: 'In use', pending: 'Waiting for approval', rejected: 'Off' };

/** Admin → WhatsApp → Answers: what the bot may say by itself. Edit, switch off or on, or add. */
export default async function AdminAnswers({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const show = (await searchParams).show;
  const status = show === 'pending' || show === 'approved' || show === 'rejected' ? show : undefined;
  const b = await bot();
  const answers = b ? await b.answers(status).catch(() => null) : null;
  return (
    <>
      <h1 className="type-h2">What the bot knows</h1>
      <p className="admin-lead">
        Answers the bot sends by itself when a client asks something close (it also learns new ones when the team taps
        Approve in WhatsApp). Answers never name prices or dates: those always go to the team. A change here is used at once.
      </p>
      <div className="admin-actions admin-leads-filter">
        <a className="btn btn-ghost btn-sm" href="/admin/whatsapp/answers" aria-current={!status ? 'page' : undefined}>All</a>
        {(['approved', 'pending', 'rejected'] as const).map((s) => (
          <a key={s} className="btn btn-ghost btn-sm" href={`/admin/whatsapp/answers?show=${s}`} aria-current={status === s ? 'page' : undefined}>{LABEL[s]}</a>
        ))}
      </div>
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
            </p>
            <AnswerForm a={a} />
            <ActionForm action={setAnswerAction.bind(null, a.id, a.status !== 'approved')}>
              <Submit className="btn btn-ghost btn-sm" pending="…">{a.status === 'approved' ? 'Switch off' : 'Use it'}</Submit>
            </ActionForm>
          </div>
        ))}
    </>
  );
}
