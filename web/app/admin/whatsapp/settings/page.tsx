import { requireAdmin } from '@/lib/admin/auth';
import { BOT_LANGS, botSettings, listPhrases, listReplies } from '@/lib/admin/bot';
import { ActionForm, ConfirmSubmit, Submit } from '../../ui';
import { deletePhraseAction, deleteReplyAction, savePhraseAction, saveBotSettingsAction, saveReplyAction } from '../actions';

/** Admin → WhatsApp → Settings: pause the bot, the away and after-hours messages, saved replies. */
export default async function AdminBotSettings() {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const [s, replies, phrases] = await Promise.all([botSettings(), listReplies(), listPhrases()]);
  return (
    <>
      <h1 className="type-h2">Bot settings</h1>
      <p className="admin-lead">Write the messages in English: the bot translates them into each client’s language.</p>
      <ActionForm action={saveBotSettingsAction} className="admin-form">
        <label className="check"><input type="checkbox" name="paused" defaultChecked={s.paused} /> Pause the bot (a holiday): it stops answering, sends the away message at most every 12 hours, and passes every message to the team</label>
        <label className="field"><span>Away message</span>
          <textarea name="away" maxLength={600} defaultValue={s.away} placeholder="We are on leave until 2 November and will reply as soon as we are back." /></label>
        <label className="field"><span>After-hours message <small>(instead of the usual “we will reply after 10 a.m.”; blank = the usual)</small></span>
          <textarea name="after_hours" maxLength={600} defaultValue={s.afterHours} /></label>
        <div><Submit>Save</Submit></div>
      </ActionForm>

      <h2 className="type-h3 admin-subhead">Saved replies</h2>
      <p className="admin-lead">Send one to a client from WhatsApp with “#CODE /code”, e.g. “#K7Q2 /portfolio”. “#CODE /list” shows them all.</p>
      {replies.map((r) => (
        <div key={r.key} className="admin-fieldset" style={{ marginBottom: 16 }}>
          <ActionForm action={saveReplyAction} className="admin-form">
            <label className="field"><span>Short code</span><input name="key" readOnly defaultValue={r.key} /></label>
            <label className="field"><span>Reply</span><textarea name="text" required maxLength={1500} defaultValue={r.text} /></label>
            <div><Submit>Save</Submit></div>
          </ActionForm>
          <form action={deleteReplyAction.bind(null, r.key)}><ConfirmSubmit message={`Delete the saved reply /${r.key}?`}>Delete</ConfirmSubmit></form>
        </div>
      ))}
      <ActionForm action={saveReplyAction} className="admin-form" resetOnOk>
        <label className="field"><span>Short code</span><input name="key" required maxLength={25} pattern="/?[a-zA-Z0-9\-]{2,24}" placeholder="portfolio" /></label>
        <label className="field"><span>Reply</span><textarea name="text" required maxLength={1500} placeholder="Here is some of our recent work: https://legitforge.pages.dev/work" /></label>
        <div><Submit>Add saved reply</Submit></div>
      </ActionForm>

      <h2 className="type-h3 admin-subhead">Regional phrases</h2>
      <p className="admin-lead">
        Words the bot misread, with what they mean (e.g. Manglish “ethra aakum” = how much will it cost). The AI is told the
        meaning when a message holds one: a reading hint, never a company fact or price. In WhatsApp: “phrase mg: ethra aakum = how much will it cost”.
      </p>
      {phrases.length > 0 && (
        <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Language</th><th>Phrase</th><th>Meaning</th><th /></tr></thead><tbody>
          {phrases.map((p) => (
            <tr key={p.id}><td>{BOT_LANGS.find((l) => l.key === p.lang)?.name ?? p.lang}</td><td>{p.phrase}</td><td className="msg">{p.meaning}</td>
              <td><form action={deletePhraseAction.bind(null, p.id)}><ConfirmSubmit message={`Delete “${p.phrase}”?`}>Delete</ConfirmSubmit></form></td></tr>
          ))}
        </tbody></table></div>
      )}
      <ActionForm action={savePhraseAction} className="admin-form" resetOnOk>
        <label className="field"><span>Language</span>
          <select name="lang" defaultValue="mg">{BOT_LANGS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
        <label className="field"><span>Phrase</span><input name="phrase" required maxLength={60} placeholder="ethra aakum" /></label>
        <label className="field"><span>Meaning (English)</span><input name="meaning" required maxLength={200} placeholder="how much will it cost" /></label>
        <div><Submit>Add phrase</Submit></div>
      </ActionForm>
    </>
  );
}
