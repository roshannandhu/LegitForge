import { isOwner, requireAdmin } from '@/lib/admin/auth';
import { bot } from '@/lib/admin/bot';
import { ActionForm, Submit } from '../../ui';
import { logoutWhatsAppAction, pairWhatsAppAction } from '../actions';
import { Refresh } from './refresh';

export const dynamic = 'force-dynamic';

const number = (jid: string | null) => (jid ? `+${jid.split('@')[0].split(':')[0]}` : 'this number');

/** Admin → WhatsApp → Connection: which WhatsApp the bot answers on. With WhatsApp Web (the
 *  gateway, WA_TRANSPORT=baileys) an owner links the bot's number here by QR or by code. */
export default async function AdminWhatsAppConnection() {
  const who = await requireAdmin();                // each page checks too: a layout can be skipped
  const [b, owner] = await Promise.all([bot(), isOwner(who)]);
  const link = b ? await b.whatsapp().catch(() => null) : null;
  return (
    <>
      <p><a className="text-link" href="/admin/whatsapp">← WhatsApp</a></p>
      <h1 className="type-h2">WhatsApp connection</h1>
      {!link ? <p className="admin-empty">The bot is not reachable from here yet (it needs the bot deployed and the BOT binding).</p>
        : link.mode === 'cloud' ? (
          <p className="admin-lead">The bot uses Meta&rsquo;s WhatsApp Cloud API: the number is linked in Meta&rsquo;s dashboard, not here. (WhatsApp Web through the gateway: SETUP.md step 13.)</p>
        ) : !link.reachable ? <p className="admin-empty">{link.error}</p>
        : link.connected ? (
          <>
            <p className="admin-lead">Linked ✅ as {number(link.me)}{link.since ? ` since ${link.since.slice(0, 16).replace('T', ' ')} UTC` : ''}. Clients&rsquo; messages reach the bot through WhatsApp Web.</p>
            {owner && (
              <ActionForm action={logoutWhatsAppAction}>
                <Submit className="btn btn-ghost btn-sm btn-danger" pending="…">Log out (to link another number)</Submit>
              </ActionForm>
            )}
          </>
        ) : (
          <>
            <Refresh />
            {!owner ? <p className="admin-lead">Not linked. An owner links the bot&rsquo;s number here.</p> : (
              <>
                <p className="admin-lead">Not linked. On the bot&rsquo;s phone: WhatsApp → Settings → Linked devices → Link a device, and scan this (it changes every few seconds):</p>
                {link.qr ? <img src={link.qr} alt="QR code to link the bot's WhatsApp number" width={320} height={320} />
                  : <p className="muted">Waiting for a QR from WhatsApp…</p>}
                <h2 className="type-h3 admin-subhead">Or link with a code</h2>
                <p className="admin-lead">When this page is open on the bot&rsquo;s own phone (no second screen to scan from).</p>
                <ActionForm action={pairWhatsAppAction} className="admin-form">
                  <label className="field"><span>The bot&rsquo;s number, with the country code</span>
                    <input name="phone" required inputMode="tel" maxLength={20} placeholder="919847012345" /></label>
                  <div><Submit>Get a code</Submit></div>
                </ActionForm>
              </>
            )}
          </>
        )}
    </>
  );
}
