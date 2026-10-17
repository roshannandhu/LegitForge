import { notFound } from 'next/navigation';
import { requireAdmin } from '@/lib/admin/auth';
import { bot, type ChatLine } from '@/lib/admin/bot';

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
      <p><a className="text-link" href="/admin/leads">← Leads</a></p>
      <h1 className="type-h2">{chat ? `#${chat.code} ${chat.name ?? ''}` : 'Conversation'}</h1>
      {chat === undefined ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
        : !chat ? <p className="admin-empty">No WhatsApp conversation for this lead (it may have been deleted, or is older than 90 days).</p>
        : (
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>When (UTC)</th><th>From</th><th>Message</th></tr></thead><tbody>
            {chat.lines.map((l, i) => (
              <tr key={i}><td className="muted">{l.at.slice(0, 16).replace('T', ' ')}</td><td>{WHO[l.who]}</td><td className="msg">{l.body}</td></tr>
            ))}
          </tbody></table></div>
        )}
    </>
  );
}
