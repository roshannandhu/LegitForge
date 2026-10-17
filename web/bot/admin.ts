/** The admin's window on the bot (phase 6): an RPC entrypoint the website's service binding calls
 *  (web/wrangler.jsonc BOT → BotAdmin). An entrypoint is reachable only through a binding, never
 *  from the internet, so the website holds no Supabase key. The website checks the admin first
 *  (requireAdmin); every call here is bounded. */

import { WorkerEntrypoint } from 'cloudflare:workers';
import { clip, clock, embed, q, sb, sbCount, vec, type Env } from './io';
import { MONEY } from './text';

export type Speaker = 'client' | 'bot' | 'team' | 'alert';
export interface ChatLine { at: string; who: Speaker; body: string }
export interface Answer {
  id: number; question_en: string; answer_en: string; status: 'pending' | 'approved' | 'rejected'; source: 'site' | 'team';
  wins: number; translations_ok: boolean; created_at: string;
}
export interface Insights {
  days: number; questions: number; byBot: number; byTeam: number; open: number;
  top: { question: string; count: number; byBot: number }[];
  answers: { approved: number; pending: number; rejected: number };
}

type Row = Record<string, unknown>;
const NO_MONEY = 'The bot never sends an answer with prices, amounts, percentages or long numbers (those are the team’s to give): leave this one to the team, or write it without them.';
const KEY = (s: string) => s.trim().toLowerCase().replace(/[?.!\s]+$/, '');

export class BotAdmin extends WorkerEntrypoint<Env> {
  /** The WhatsApp conversation behind a lead (this enquiry or an earlier one), oldest first:
   *  the client, the bot's replies, the team's messages and the bot's alerts to the team. */
  async chat(leadId: string): Promise<{ code: string; name: string | null; lines: ChatLine[] } | null> {
    const env = this.env;
    const fields = 'wa_id,code,profile_name,fields';
    let [c] = await sb<Row>(env, 'GET', `contacts?lead_id=eq.${q(leadId)}&select=${fields}`);
    if (!c) [c] = await sb<Row>(env, 'GET', `contacts?fields->prev_leads=cs.${q(JSON.stringify([leadId]))}&select=${fields}`);
    if (!c) return null;
    // the newest 500, oldest first (a long chat keeps its latest messages)
    const rows = (await sb<Row>(env, 'GET', `messages?wa_id=eq.${q(String(c.wa_id))}&order=at.desc,wamid.desc&limit=500&select=at,dir,team,body,reply_id`)).reverse();
    const lines: ChatLine[] = [];
    for (const r of rows) {
      const line: ChatLine = {
        at: String(r.at),
        who: r.team ? (r.dir === 'in' ? 'team' : 'alert') : r.dir === 'in' ? 'client' : r.reply_id === 'team' ? 'team' : 'bot',
        body: clip(String(r.body ?? (String(r.reply_id ?? '').startsWith('media:') ? '📎 a file or voice note' : r.reply_id ?? '')), 4000),
      };
      const before = lines.findLast((l) => l.who === 'alert');                 // the same alert to each member: shown once
      if (line.who === 'alert' && before?.body === line.body && Date.parse(line.at) - Date.parse(before.at) < 60_000) continue;
      lines.push(line);
    }
    return { code: String(c.code), name: ((c.fields as Row)?.name as string) || (c.profile_name as string) || null, lines };
  }

  /** What the bot knows (newest first), optionally one status. */
  async answers(status?: Answer['status']): Promise<Answer[]> {
    const only = status && ['pending', 'approved', 'rejected'].includes(status) ? `&status=eq.${status}` : '';
    return sb<Answer>(this.env, 'GET', `knowledge?select=id,question_en,answer_en,status,source,wins,translations_ok,created_at&order=created_at.desc&limit=300${only}`);
  }

  /** A new or corrected answer, approved at once (the admin wrote it). A changed answer drops its
   *  approved translations: the bot then translates it for each client as it goes. */
  async saveAnswer(v: { id?: number; question_en: string; answer_en: string; by: string }): Promise<{ ok: true; id: number } | { error: string }> {
    const question = clip(v.question_en.trim(), 200), answer = clip(v.answer_en.trim(), 700);
    if (question.length < 5 || answer.length < 2) return { error: 'Write the question and the answer.' };
    if (MONEY.test(answer)) return { error: NO_MONEY };
    const [old] = v.id ? await sb<{ answer_en: string }>(this.env, 'GET', `knowledge?id=eq.${Number(v.id)}&select=answer_en`) : [];
    if (v.id && !old) return { error: 'That answer is gone.' };
    const e = await embed(this.env, question);
    if (!e) return { error: 'The AI is busy (embedding); try again in a minute.' };
    const row = { question_en: question, answer_en: answer, embedding: vec(e), status: 'approved', decided_by: clip(v.by, 120), decided_at: new Date(clock.now()).toISOString(),
      ...(old?.answer_en === answer ? {} : { translations: {}, translations_ok: false }) };
    if (v.id) {
      const [k] = await sb<{ id: number }>(this.env, 'PATCH', `knowledge?id=eq.${Number(v.id)}`, row);
      return k ? { ok: true, id: k.id } : { error: 'That answer is gone.' };
    }
    const [k] = await sb<{ id: number }>(this.env, 'POST', 'knowledge', { ...row, source: 'team' });
    return { ok: true, id: k.id };
  }

  /** Switch an answer off (rejected: never used) or on again (approved; embedded if it never was). */
  async setAnswer(id: number, on: boolean, by: string): Promise<{ ok: true } | { error: string }> {
    const [k] = await sb<{ id: number; question_en: string; answer_en: string; embedding: string | null }>(this.env, 'GET', `knowledge?id=eq.${Number(id)}&select=id,question_en,answer_en,embedding`);
    if (!k) return { error: 'That answer is gone.' };
    if (on && MONEY.test(k.answer_en)) return { error: NO_MONEY };
    let embedding: string | undefined;
    if (on && !k.embedding) {
      const e = await embed(this.env, k.question_en);
      if (!e) return { error: 'The AI is busy (embedding); try again in a minute.' };
      embedding = vec(e);
    }
    await sb(this.env, 'PATCH', `knowledge?id=eq.${k.id}`, { status: on ? 'approved' : 'rejected', ...(embedding ? { embedding } : {}), decided_by: clip(by, 120), decided_at: new Date(clock.now()).toISOString() }, 'return=minimal');
    return { ok: true };
  }

  /** The last `days` of questions: how many, who answered, the most asked (from the latest
   *  1,000, Supabase's page), and the answers' state. Counts are exact, however many there are. */
  async insights(days = 30): Promise<Insights> {
    const env = this.env, since = new Date(clock.now() - Math.min(Math.max(days, 1), 365) * 86_400_000).toISOString(), window = `questions?created_at=gt.${q(since)}`;
    const [questions, byBot, open, approved, pending, rejected] = await Promise.all([
      sbCount(env, window), sbCount(env, `${window}&kind=eq.auto`), sbCount(env, `${window}&status=eq.pending`),
      sbCount(env, 'knowledge?status=eq.approved'), sbCount(env, 'knowledge?status=eq.pending'), sbCount(env, 'knowledge?status=eq.rejected'),
    ]);
    const qs = await sb<{ kind: string; status: string; question_en: string }>(env, 'GET', `${window}&select=kind,status,question_en&order=created_at.desc&limit=1000`);
    const tally = new Map<string, { question: string; count: number; byBot: number }>();
    for (const x of qs) {
      const t = tally.get(KEY(x.question_en)) ?? { question: x.question_en.trim(), count: 0, byBot: 0 };
      t.count++; if (x.kind === 'auto') t.byBot++;
      tally.set(KEY(x.question_en), t);
    }
    return {
      days, questions, byBot, byTeam: questions - byBot, open,
      top: [...tally.values()].sort((a, b) => b.count - a.count).slice(0, 10),
      answers: { approved, pending, rejected },
    };
  }
}
