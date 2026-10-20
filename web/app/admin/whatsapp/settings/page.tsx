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

      <section className="admin-section" aria-labelledby="away-h">
        <h2 id="away-h" className="type-h3">Pause and away messages</h2>
        <ActionForm action={saveBotSettingsAction} className="admin-form">
          <label className="check"><input type="checkbox" name="paused" defaultChecked={s.paused} /> Pause the bot (a holiday)
            <small>It stops answering, sends the away message at most every 12 hours, and passes every message to the team.</small></label>
          <label className="field"><span>Away message</span>
            <textarea name="away" maxLength={600} defaultValue={s.away} placeholder="e.g. We are on leave until 2 November and will reply as soon as we are back." /></label>
          <label className="field"><span>After-hours message <small>(instead of the usual “we will reply after 10 a.m.”; blank = the usual)</small></span>
            <textarea name="after_hours" maxLength={600} defaultValue={s.afterHours} /></label>
          <div><Submit>Save</Submit></div>
        </ActionForm>
      </section>

      <section className="admin-section wa-block" aria-labelledby="replies-h">
        <h2 id="replies-h" className="type-h3">Saved replies</h2>
        <p className="admin-lead">Send one to a client from WhatsApp with “#CODE /code”, e.g. “#K7Q2 /portfolio”. “#CODE /list” shows them all.</p>
        {!replies.length ? <p className="admin-empty">No saved replies yet.</p> : (
          <ul className="admin-cards admin-list">
            {replies.map((r) => (
              <li key={r.key} className="admin-card">
                <div className="admin-card-head">
                  <strong>/{r.key}</strong>
                  <form action={deleteReplyAction.bind(null, r.key)} className="admin-actions"><ConfirmSubmit message={`Delete the saved reply /${r.key}?`}>Delete</ConfirmSubmit></form>
                </div>
                <ActionForm action={saveReplyAction} className="admin-form">
                  <input type="hidden" name="key" value={r.key} />
                  <label className="field"><span>Reply</span><textarea name="text" required maxLength={1500} defaultValue={r.text} /></label>
                  <div><Submit>Save</Submit></div>
                </ActionForm>
              </li>
            ))}
          </ul>
        )}
        <ActionForm action={saveReplyAction} className="admin-form" resetOnOk>
          <fieldset className="admin-fieldset">
            <legend>Add a saved reply</legend>
            <label className="field is-short"><span>Short code</span><input name="key" required maxLength={25} pattern="/?[a-zA-Z0-9\-]{2,24}" placeholder="e.g. portfolio" /></label>
            <label className="field"><span>Reply</span><textarea name="text" required maxLength={1500} placeholder="e.g. Here is some of our recent work: https://legitforge.pages.dev/work" /></label>
            <div><Submit>Add saved reply</Submit></div>
          </fieldset>
        </ActionForm>
      </section>

      <section className="admin-section wa-block" aria-labelledby="phrases-h">
        <h2 id="phrases-h" className="type-h3">Regional phrases</h2>
        <p className="admin-lead">
          Words the bot misread, with what they mean (e.g. Manglish “ethra aakum” = how much will it cost). The AI is told the
          meaning when a message holds one: a reading hint, never a company fact or price. In WhatsApp: “phrase mg: ethra aakum = how much will it cost”.
        </p>
        {!phrases.length ? <p className="admin-empty">No phrases yet.</p> : (
          <div className="admin-table-wrap"><table className="admin-table is-stacked"><thead><tr><th>Language</th><th>Phrase</th><th>Meaning</th><th><span className="sr-only">Delete</span></th></tr></thead><tbody>
            {phrases.map((p) => (
              <tr key={p.id}><td data-label="Language">{BOT_LANGS.find((l) => l.key === p.lang)?.name ?? p.lang}</td><td data-label="Phrase">{p.phrase}</td><td className="msg" data-label="Meaning">{p.meaning}</td>
                <td><form action={deletePhraseAction.bind(null, p.id)}><ConfirmSubmit message={`Delete “${p.phrase}”?`}>Delete</ConfirmSubmit></form></td></tr>
            ))}
          </tbody></table></div>
        )}
        <ActionForm action={savePhraseAction} className="admin-form" resetOnOk>
          <fieldset className="admin-fieldset">
            <legend>Add a phrase</legend>
            <div className="admin-grid admin-grid-3">
              <label className="field"><span>Language</span>
                <select name="lang" defaultValue="mg">{BOT_LANGS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
              <label className="field"><span>Phrase</span><input name="phrase" required maxLength={60} placeholder="e.g. ethra aakum" /></label>
              <label className="field"><span>Meaning (English)</span><input name="meaning" required maxLength={200} placeholder="e.g. how much will it cost" /></label>
            </div>
            <div><Submit>Add phrase</Submit></div>
          </fieldset>
        </ActionForm>
      </section>
    </>
  );
}
