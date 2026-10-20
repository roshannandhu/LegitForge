import type { Monitor } from './bot';

/** Admin → WhatsApp → Live (and the Overview's status line): the path of a client's message,
 *  stage by stage, from BotAdmin.monitor(), and whether each stage works right now. */
export type State = 'ok' | 'warn' | 'bad' | 'idle';
export interface Stage { title: string; state: State; detail: string; href?: string; action?: string }

const MIN = 60_000, HOUR = 60 * MIN, IST = 5.5 * HOUR;
export const ago = (iso: string | null | undefined, now: number) => {
  if (!iso) return 'never';
  const d = now - Date.parse(iso);
  return d < MIN ? 'just now' : d < HOUR ? `${Math.round(d / MIN)} min ago` : d < 48 * HOUR ? `${Math.round(d / HOUR)} h ago` : `${Math.round(d / (24 * HOUR))} days ago`;
};
export const istTime = (iso: string) => new Date(Date.parse(iso) + IST).toISOString().slice(11, 16);
const number = (jid: string | null) => (jid ? `+${jid.split('@')[0].split(':')[0]}` : 'the bot’s number');

/** The path of a client's message, stage by stage, and whether each works right now. */
export function stages(m: Monitor, now: number): Stage[] {
  const s = m.store.ok ? m.store : null, h = s?.health, b = m.beats;
  const fresh = (x?: { at: string }) => !!x && now - Date.parse(x.at) < 24 * HOUR;
  const link = m.link;
  const where = m.gateway.where === 'render' ? 'on Render' : m.gateway.where === 'laptop' ? 'on the laptop' : 'the gateway';
  const lastSeen = [b.gw, b.gwdown].filter(Boolean).sort((x, y) => Date.parse(y!.at) - Date.parse(x!.at))[0];
  const wa: Stage = m.transport === 'cloud'
    ? m.keys.metaToken ? { title: 'WhatsApp (Cloud API)', state: 'ok', detail: 'Meta delivers messages to the bot.' }
      : { title: 'WhatsApp (Cloud API)', state: 'bad', detail: 'WA_ACCESS_TOKEN is not set on the bot.' }
    : link.mode === 'baileys' && link.reachable
      ? link.connected ? { title: 'WhatsApp Web', state: 'ok', detail: `Linked as ${number(link.me)}${link.since ? ` since ${ago(link.since, now)}` : ''}, ${where}.`, href: '/admin/whatsapp/connection', action: 'Connection' }
        : { title: 'WhatsApp Web', state: 'bad', detail: `The gateway runs ${where === 'the gateway' ? '' : `${where} `}but no number is linked: scan the QR.`, href: '/admin/whatsapp/connection', action: 'Scan the QR' }
      : { title: 'WhatsApp Web', state: 'bad', detail: `${link.mode === 'baileys' ? link.error : 'Not set up.'}${lastSeen ? ` Last answered ${ago(lastSeen.at, now)}${m.gateway.where === 'laptop' ? ' (is the laptop on?)' : ''}.` : ''}`, href: '/admin/whatsapp/connection', action: 'Connection' };
  const cronOk = !!b.cron && now - Date.parse(b.cron.at) < 10 * MIN;
  const worker: Stage = !m.keys.secret ? { title: 'Bot Worker', state: 'bad', detail: 'WA_APP_SECRET is not set: every message is refused.' }
    : fresh(b.badsig) && (!b.hook || Date.parse(b.badsig!.at) > Date.parse(b.hook.at))
      ? { title: 'Bot Worker', state: 'bad', detail: `Refused a message ${ago(b.badsig!.at, now)}: WA_APP_SECRET differs between the gateway and the bot.` }
      : { title: 'Bot Worker', state: cronOk ? (b.hook ? 'ok' : 'idle') : 'warn',
        detail: `${b.hook ? `Last message ${ago(b.hook.at, now)}` : 'No message received yet'} · background jobs ${b.cron ? `ran ${ago(b.cron.at, now)}` : 'not seen yet'}.` };
  const store: Stage = !s ? { title: 'Supabase', state: 'bad', detail: m.store.ok ? '' : m.store.error }
    : h && h.unhandled ? { title: 'Supabase', state: 'warn', detail: `${h.unhandled} message${h.unhandled === 1 ? '' : 's'} waiting over 5 minutes${h.oldestUnhandled ? ` (oldest ${ago(h.oldestUnhandled, now)})` : ''}.` }
    : { title: 'Supabase', state: fresh(b.sbfail) ? 'warn' : 'ok', detail: fresh(b.sbfail) ? `Supabase refused a message ${ago(b.sbfail!.at, now)} (it is retried).` : 'Every chat is stored first, then answered.' };
  const keys = [m.keys.groq && 'Groq', m.keys.gemini && 'Gemini'].filter(Boolean).join(' + ');
  const ai: Stage = !keys ? { title: 'AI', state: 'warn', detail: 'No AI keys: menus and fixed questions work; free text goes to the team.' }
    : h && h.aiToday >= h.aiCap ? { title: 'AI', state: 'warn', detail: `Today’s cap is reached (${h.aiToday}/${h.aiCap}): fixed text until tomorrow.` }
    : { title: 'AI', state: m.keys.groq && m.keys.gemini ? 'ok' : 'warn', detail: `${keys}${m.keys.groq && m.keys.gemini ? '' : ' only'} · ${h ? `${h.aiToday}/${h.aiCap} requests today` : 'usage unknown'}.` };
  const team: Stage = m.team ? { title: 'Team alerts', state: 'ok', detail: `${m.team} number${m.team === 1 ? '' : 's'} get alerts${h ? ` · ${h.openQuestions} open question${h.openQuestions === 1 ? '' : 's'}` : ''}.`, href: '/admin/whatsapp/questions', action: 'Questions' }
    : { title: 'Team alerts', state: 'bad', detail: 'TEAM_WHATSAPP is not set: nobody gets the alerts.' };
  return [
    { title: 'Client writes', state: h?.lastIn ? 'ok' : 'idle', detail: h?.lastIn ? `Last client message ${ago(h.lastIn, now)} · ${s!.inToday} in, ${s!.outToday} replies today.` : 'No client message yet.' },
    wa, worker, store, ai, team,
    { title: 'Lead in Admin', state: m.leads.month ? 'ok' : 'idle', detail: `${m.leads.today} today · ${m.leads.month} in 30 days.`, href: '/admin/leads', action: 'Leads' },
  ];
}

/** The page's one word: any red stage, then any gold one. */
export const worstOf = (flow: Stage[] | null): State => (!flow ? 'bad' : flow.some((x) => x.state === 'bad') ? 'bad' : flow.some((x) => x.state === 'warn') ? 'warn' : 'ok');
