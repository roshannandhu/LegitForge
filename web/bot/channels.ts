/** More channels (phase 7) for the same bot: the website's chat bubble, Facebook Messenger and
 *  Instagram DMs. A client's id carries its channel ("web:<uuid>", "fb:<psid>", "ig:<igsid>"), so
 *  everything else (the brief, knowledge, languages, the team hand-off) is the WhatsApp code.
 *  io.ts wa() hands their messages here: Messenger and Instagram through Meta's Send API (Page
 *  token), the website chat into Supabase, where the bubble reads them (worker.ts /chat). */

import { CHANNEL_LABEL, type Channel } from '../lib/wa-services';
import { clip, count, type Env } from './io';

export { CHANNEL_LABEL, type Channel };
export const channelOf = (id: string): Channel => (id.startsWith('web:') ? 'web' : id.startsWith('fb:') ? 'fb' : id.startsWith('ig:') ? 'ig' : 'whatsapp');

export interface Option { id: string; title: string }
/** A message as the bubble shows it: text, and the buttons or list rows as tappable options
 *  (and a list's footer: the privacy link). */
export interface Shown { body: string; options: Option[]; footer?: string }

/** What a WhatsApp payload (text, buttons, list, template) says, for the other channels. */
export function shown(payload: Record<string, unknown>): Shown {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = payload as any;
  const options: Option[] = p.interactive?.action?.buttons?.map((b: { reply: Option }) => b.reply)
    ?? p.interactive?.action?.sections?.flatMap((s: { rows: Option[] }) => s.rows.map((r) => ({ id: r.id, title: r.title }))) ?? [];
  const body = p.text?.body ?? p.interactive?.body?.text ?? p.template?.components?.[0]?.parameters?.map((x: { text: string }) => x.text).join(' | ') ?? '';
  return { body: String(body), options, ...(p.interactive?.footer?.text ? { footer: String(p.interactive.footer.text) } : {}) };
}

/** Text cut into messages the channel takes (Instagram 1,000 UTF-8 bytes, Messenger 2,000
 *  characters), at a line break or a space where it can; five at most, the last one clipped. */
export function parts(text: string, ig: boolean): string[] {
  const fits = (s: string) => (ig ? new TextEncoder().encode(s).length <= 1000 : s.length <= 2000);
  const out: string[] = [];
  let rest = text.trim();
  while (rest && !fits(rest) && out.length < 4) {
    let cut = Math.min(rest.length, 2000);
    while (cut > 1 && !fits(rest.slice(0, cut))) cut = Math.floor(cut * 0.9);
    const at = Math.max(rest.lastIndexOf('\n', cut), rest.lastIndexOf(' ', cut));
    const end = at > cut / 2 ? at : cut;
    out.push(rest.slice(0, end).trim());
    rest = rest.slice(end).trim();
  }
  while (rest && !fits(rest)) rest = `${rest.slice(0, Math.floor(rest.length * 0.9))}…`;
  if (rest) out.push(rest);
  return out;
}

/** One message to a Messenger or Instagram client (Meta's Send API with the Page token): text in
 *  as many parts as the channel needs, the options as quick replies on the last (13 at most,
 *  titles 20 characters). Templates have no equivalent there: null, so the caller says it could
 *  not be sent. The id is the last part's; null if any part was refused. */
export async function metaSend(env: Env, to: string, payload: Record<string, unknown>): Promise<string | null> {
  if (payload.type === 'template') return null;
  if (!env.FB_PAGE_TOKEN) { console.error('[meta] FB_PAGE_TOKEN is not set: nothing goes to Messenger or Instagram'); return null; }
  const { body, options, footer } = shown(payload);
  const texts = parts(footer ? `${body}\n\n${footer}` : body, to.startsWith('ig:'));
  let id: string | null = null;
  for (const [i, text] of texts.entries()) {
    const last = i === texts.length - 1;
    count(env);
    try {
      const r = await fetch(`https://graph.facebook.com/${env.GRAPH_VERSION || 'v25.0'}/me/messages`, {
        method: 'POST',
        headers: { authorization: `Bearer ${env.FB_PAGE_TOKEN}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          // a person's reply after 24 hours (within 7 days) goes with Meta's human agent tag
          recipient: { id: to.slice(3) }, ...(payload.tag ? { messaging_type: 'MESSAGE_TAG', tag: payload.tag } : { messaging_type: 'RESPONSE' }),
          message: { text, ...(last && options.length ? { quick_replies: options.slice(0, 13).map((o) => ({ content_type: 'text', title: clip(o.title, 20), payload: o.id })) } : {}) },
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!r.ok) { console.error('[meta] send refused', r.status, (await r.text()).slice(0, 300)); return null; }
      id = ((await r.json()) as { message_id?: string }).message_id ?? null;
    } catch (e) { console.error('[meta] send failed', String(e).slice(0, 200)); return null; }
  }
  return id;
}

/** A Messenger or Instagram webhook (object 'page' / 'instagram') → the bot's inbound rows: text
 *  and quick-reply taps; anything else is "please type". Only messages to our own Page or
 *  Instagram account, never our own echoes. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function metaInbound(body: any, env: Env, now: number) {
  const prefix = body?.object === 'page' ? 'fb' : body?.object === 'instagram' ? 'ig' : null;
  const ours = prefix === 'fb' ? env.FB_PAGE_ID : env.IG_ACCOUNT_ID;
  const rows: { wamid: string; wa_id: string; body: string | null; reply_id: string | null; at: string }[] = [];
  if (!prefix) return rows;
  if (!ours) { console.error(`[meta] a ${prefix === 'fb' ? 'Messenger' : 'Instagram'} webhook, but ${prefix === 'fb' ? 'FB_PAGE_ID' : 'IG_ACCOUNT_ID'} is not set`); return rows; }
  for (const entry of body.entry ?? []) for (const ev of entry?.messaging ?? []) {
    const m = ev?.message, from = ev?.sender?.id;
    // our own echoes, an unsent message, a like (a sticker): nothing to answer
    if (!m?.mid || !from || m.is_echo || m.is_deleted || m.sticker_id) continue;
    if (String(ev?.recipient?.id) !== String(ours)) { console.error(`[meta] a message for ${ev?.recipient?.id}, not ${prefix === 'fb' ? 'FB_PAGE_ID' : 'IG_ACCOUNT_ID'}: check it`); continue; }
    rows.push({
      wamid: String(m.mid), wa_id: `${prefix}:${from}`,
      body: m.text ? clip(String(m.text), 4000) : null,
      reply_id: m.quick_reply?.payload ? String(m.quick_reply.payload) : m.text ? null : `[${m.attachments?.[0]?.type ?? 'unknown'}]`,
      at: new Date(Number(ev.timestamp) || now).toISOString(),
    });
  }
  return rows;
}
