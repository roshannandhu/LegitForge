import { listBotTeam, type BotMember } from '@/lib/admin/bot-team';
import { SERVICES } from '@/lib/wa-services';
import { ActionForm, ConfirmSubmit, Submit } from '../ui';
import { deleteBotMemberAction, saveBotMemberAction } from './bot-actions';

const picked = (m?: BotMember): Set<string> => {
  try { const v: unknown = JSON.parse(m?.services ?? '[]'); return new Set(Array.isArray(v) ? v.map(String) : []); } catch { return new Set(); }
};

function MemberForm({ m }: { m?: BotMember }) {
  const mine = picked(m);
  return (
    <ActionForm action={saveBotMemberAction} className="admin-form" resetOnOk={!m}>
      <div className="admin-grid">
        <label className="field"><span>WhatsApp number <small>(digits with country code)</small></span>
          <input name="whatsapp" required inputMode="numeric" defaultValue={m?.whatsapp} readOnly={!!m} placeholder="919876543210" /></label>
        <label className="field"><span>Name</span><input name="name" maxLength={60} defaultValue={m?.name} placeholder="Roshan" /></label>
        <label className="field"><span>Status{m?.status_until ? <small> (until {m.status_until.slice(0, 16).replace('T', ' ')} UTC)</small> : null}</span>
          <select name="status" defaultValue={m?.status ?? 'free'}>
            <option value="free">Free</option><option value="busy">Busy: alerted after the others</option><option value="off">Off: not alerted</option>
          </select></label>
      </div>
      <fieldset className="admin-fieldset admin-checks"><legend>Gets these enquiries first</legend>
        {SERVICES.map((s) => (
          <label key={s.key} className="check"><input type="checkbox" name="services" value={s.key} defaultChecked={mine.has(s.key)} /> {s.title}</label>
        ))}
      </fieldset>
      <div className="admin-actions"><Submit>{m ? 'Save' : 'Add number'}</Submit></div>
    </ActionForm>
  );
}

/** Admin → Team → WhatsApp alerts: who the bot tells first about each kind of enquiry. */
export async function BotAlerts() {
  const team = await listBotTeam().catch(() => [] as BotMember[]);      // before migration 0013: just the add form
  return (
    <section className="admin-section bot-alerts" aria-labelledby="bot-alerts">
      <h2 className="type-h3" id="bot-alerts">WhatsApp alerts</h2>
      <p className="admin-lead">
        Who the WhatsApp bot tells first about each kind of enquiry. If nobody replies in 10 minutes, the others get it
        too; upset or urgent clients reach everyone at once.
      </p>
      <details>
        <summary>Commands and limits</summary>
        <p className="muted">Each person can also message the bot “busy”, “busy 2h”, “off” or “free”. Only numbers set in the bot’s TEAM_WHATSAPP are used.</p>
      </details>
      {team.length === 0 ? <p className="admin-empty">No numbers added yet.</p> : (
        <ul className="admin-cards admin-list">
          {team.map((m) => (
            <li key={m.whatsapp} className="admin-card">
              <div className="admin-card-head">
                <strong>{m.name || m.whatsapp}</strong>
                <form action={deleteBotMemberAction.bind(null, m.whatsapp)} className="admin-actions">
                  <ConfirmSubmit message={`Remove ${m.name || m.whatsapp} from the alert routing? They still get alerts as a team member.`}>Remove</ConfirmSubmit>
                </form>
              </div>
              <MemberForm m={m} />
            </li>
          ))}
        </ul>
      )}
      <h3>Add a number</h3>
      <MemberForm />
    </section>
  );
}
