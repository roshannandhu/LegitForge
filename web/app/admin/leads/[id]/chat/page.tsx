import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { BOT_LANGS, bot, type ChatLine } from '@/lib/admin/bot';
import { ActionForm, Submit } from '../../../ui';
import { setLangAction, setModeAction } from '../../../whatsapp/actions';

const WHO: Record<ChatLine['who'], string> = { client: 'Client', bot: 'Bot', team: 'Team', alert: 'Bot → team' };

/** Admin → Leads → a WhatsApp lead's whole conversation (kept 90 days): the client, the bot's
 *  replies, the team's messages and the bot's alerts to the team. */
export default async function LeadChat({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();                            // each page checks too: a layout can be skipped
  const id = (await params).id;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const b = await bot();
  const chat = b ? await b.chat(id).catch(() => undefined) : undefined;   // undefined: the bot could not be asked
  return (
    <>
      <a className="text-link admin-back" href="/admin/leads">← Leads</a>
      <div className="admin-head">
        <h1 className="type-h2">{chat ? `#${chat.code} ${chat.name ?? ''}` : 'Conversation'}</h1>
        {chat && (chat.mode === 'bot' || chat.mode === 'human') && <span className={`pill${chat.mode === 'human' ? ' is-on' : ''}`}>{chat.mode === 'human' ? 'Team is replying' : 'Bot is replying'}</span>}
      </div>
      {chat && (chat.mode === 'bot' || chat.mode === 'human') && (
        <div className="admin-chat-bar">
          <ActionForm action={setModeAction.bind(null, id, chat.mode === 'human' ? 'bot' : 'human')}>
            <Submit className="btn btn-ghost btn-sm" pending="…">{chat.mode === 'human' ? 'Hand back to the bot' : 'Take over (the bot stays quiet)'}</Submit>
          </ActionForm>
          <ActionForm action={setLangAction.bind(null, id)} className="admin-form">
            <label className="field"><span>Reply language</span>
              <select name="lang" defaultValue={chat.lang ?? 'en'}>{BOT_LANGS.map((l) => <option key={l.key} value={l.key}>{l.name}</option>)}</select></label>
            <Submit className="btn btn-ghost btn-sm">Save</Submit>
          </ActionForm>
        </div>
      )}
      {chat === undefined ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
        : !chat ? <p className="admin-empty">No WhatsApp conversation for this lead (it may have been deleted, or is older than 90 days).</p>
        : (
          <div className="admin-table-wrap"><table className="admin-table is-stacked admin-chat"><thead><tr><th>When (UTC)</th><th>From</th><th>Message</th></tr></thead><tbody>
            {chat.lines.map((l, i) => (
              <tr key={i}><td className="muted">{l.at.slice(0, 16).replace('T', ' ')}</td><td><span className={`pill${l.who === 'client' ? ' is-on' : ''}`}>{WHO[l.who]}</span></td><td className="msg">{l.body}</td></tr>
            ))}
          </tbody></table></div>
        )}
    </>
  );
}
