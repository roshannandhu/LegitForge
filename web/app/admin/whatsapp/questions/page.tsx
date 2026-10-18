import { requireAdmin } from '@/lib/admin/auth';
import { bot } from '@/lib/admin/bot';
import { ActionForm, Submit } from '../../ui';
import { answerQuestionAction } from '../actions';

const KIND: Record<string, string> = { question: 'Question', price: 'Price (offer a call or a quote)', decision: 'Needs a decision', draft: 'The bot drafted an answer' };

/** Admin → WhatsApp → Questions: what clients asked that the bot passed to the team, oldest first.
 *  An answer here goes to the client in their language, like a team member's reply on WhatsApp. */
export default async function AdminQuestions() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const b = await bot();
  const open = b ? await b.openQuestions().catch(() => null) : null;
  return (
    <>
      <p><a className="text-link" href="/admin/whatsapp">← WhatsApp</a></p>
      <h1 className="type-h2">Open questions</h1>
      <p className="admin-lead">
        Write the answer in English or the client’s language: the bot translates English for them. Never promise a price,
        date or contract here unless it is agreed. A useful answer is kept as a draft in{' '}
        <a className="text-link" href="/admin/whatsapp/answers?show=pending">What the bot knows</a>; the bot uses it only once someone switches it on.
      </p>
      {!open ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
        : !open.length ? <p className="admin-empty">No open questions. 🎉</p>
        : open.map((x) => (
          <div key={x.id} className="admin-fieldset" style={{ marginBottom: 16 }}>
            <p className="muted" style={{ margin: 0 }}>
              #{x.code} {x.name ?? ''} · {KIND[x.kind] ?? x.kind} · {x.created_at.slice(0, 16).replace('T', ' ')} UTC
              {x.lead_id && <> · <a className="text-link" href={`/admin/leads/${x.lead_id}/chat`}>Chat</a></>}
            </p>
            <p style={{ margin: '8px 0' }}><strong>{x.question}</strong>{x.question_en && x.question_en !== x.question ? <><br /><span className="muted">{x.question_en}</span></> : null}</p>
            <ActionForm action={answerQuestionAction.bind(null, x.id)} className="admin-form" resetOnOk>
              <label className="field"><span>Answer</span><textarea name="answer" required maxLength={2000} /></label>
              <div><Submit>Send to #{x.code}</Submit></div>
            </ActionForm>
          </div>
        ))}
    </>
  );
}
