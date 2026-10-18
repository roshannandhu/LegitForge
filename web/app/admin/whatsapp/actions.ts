'use server';

/** Admin → WhatsApp writes. Each action checks requireAdmin() itself: Server Actions are public
 *  POST endpoints. Answers go through the bot (lib/admin/bot.ts: it embeds them); settings and
 *  saved replies are D1. */

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { BOT_LANGS, bot, deletePhrase, deleteReply, savePhrase, saveBotSettings, saveReply } from '@/lib/admin/bot';
import type { FormState } from '../actions';

const str = (f: FormData, k: string, max: number) => String(f.get(k) ?? '').trim().slice(0, max);
const NO_BOT = 'The WhatsApp bot is not reachable from here (it needs the bot deployed and the BOT binding).';

export async function saveAnswerAction(_: FormState, f: FormData): Promise<FormState> {
  const who = await requireAdmin();
  const b = await bot();
  if (!b) return { error: NO_BOT };
  const id = Number(f.get('id')) || undefined;
  const r = await b.saveAnswer({ id, question_en: str(f, 'question', 200), answer_en: str(f, 'answer', 700), by: who, review_at: str(f, 'review_at', 10) || null }).catch(() => ({ error: NO_BOT }));
  if ('error' in r) return { error: r.error };
  revalidatePath('/admin/whatsapp/answers');
  return { ok: id ? 'Saved: the bot uses the new words from now on.' : 'Added: the bot answers this itself from now on.' };
}

export async function setAnswerAction(id: number, on: boolean, _: FormState): Promise<FormState> {
  const who = await requireAdmin();
  const r = await (await bot())?.setAnswer(id, on, who).catch(() => null);
  if (!r || 'error' in r) return { error: r && 'error' in r ? r.error : NO_BOT };   // shown on the page, never the error page
  revalidatePath('/admin/whatsapp/answers');
  return { ok: on ? 'In use again.' : 'Switched off: the bot no longer uses it.' };
}

export async function saveBotSettingsAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  if (f.get('paused') === 'on' && !str(f, 'away', 600)) return { error: 'Write the away message clients get while the bot is paused.' };
  await saveBotSettings({ paused: f.get('paused') === 'on', away: str(f, 'away', 600), afterHours: str(f, 'after_hours', 600) });
  revalidatePath('/admin/whatsapp/settings');
  return { ok: f.get('paused') === 'on' ? 'Saved. The bot is paused: clients get your away message and the team gets every message.' : 'Saved.' };
}

export async function saveReplyAction(_: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const key = str(f, 'key', 25).toLowerCase().replace(/^\//, '');
  const text = str(f, 'text', 1500);
  if (!/^[a-z0-9-]{2,24}$/.test(key)) return { error: 'The short code is 2–24 letters, numbers or hyphens, e.g. portfolio.' };
  if (key === 'list') return { error: '"/list" shows all the saved replies in WhatsApp: choose another code.' };
  if (!text) return { error: 'Write the reply.' };
  await saveReply({ key, text });
  revalidatePath('/admin/whatsapp/settings');
  return { ok: `Saved. In WhatsApp: "#CODE /${key}".` };
}

export async function deleteReplyAction(key: string) {
  await requireAdmin();
  await deleteReply(key);
  revalidatePath('/admin/whatsapp/settings');
}

export async function archiveAnswerAction(id: number, _: FormState): Promise<FormState> {
  const who = await requireAdmin();
  const r = await (await bot())?.archive(id, who).catch(() => null);
  if (!r || 'error' in r) return { error: r && 'error' in r ? r.error : NO_BOT };
  revalidatePath('/admin/whatsapp/answers');
  return { ok: 'Archived: kept for the record, never used.' };
}

export async function answerQuestionAction(id: number, _: FormState, f: FormData): Promise<FormState> {
  const who = await requireAdmin();
  const r = await (await bot())?.answerQuestion(id, str(f, 'answer', 2000), who).catch(() => null);
  if (!r || 'error' in r) return { error: r && 'error' in r ? r.error : NO_BOT };
  revalidatePath('/admin/whatsapp/questions');
  return { ok: `${r.note} The answer waits in “What the bot knows” until someone switches it on.` };
}

export async function setModeAction(leadId: string, mode: 'human' | 'bot', _: FormState): Promise<FormState> {
  await requireAdmin();
  const r = await (await bot())?.setMode(leadId, mode).catch(() => null);
  if (!r || 'error' in r) return { error: r && 'error' in r ? r.error : NO_BOT };
  revalidatePath(`/admin/leads/${leadId}/chat`);
  return { ok: mode === 'human' ? 'Taken over: the bot stays quiet and every message goes to the team.' : 'Handed back to the bot.' };
}

export async function setLangAction(leadId: string, _: FormState, f: FormData): Promise<FormState> {
  await requireAdmin();
  const lang = str(f, 'lang', 4);
  if (!BOT_LANGS.some((l) => l.key === lang)) return { error: 'Pick a language from the list.' };
  const r = await (await bot())?.setLang(leadId, lang).catch(() => null);
  if (!r || 'error' in r) return { error: r && 'error' in r ? r.error : NO_BOT };
  revalidatePath(`/admin/leads/${leadId}/chat`);
  return { ok: 'Saved: the bot writes in that language from now on.' };
}

export async function savePhraseAction(_: FormState, f: FormData): Promise<FormState> {
  const who = await requireAdmin();
  const lang = str(f, 'lang', 4), phrase = str(f, 'phrase', 60).toLowerCase().replace(/\s+/g, ' '), meaning = str(f, 'meaning', 200);
  if (!BOT_LANGS.some((l) => l.key === lang)) return { error: 'Pick the language the phrase is in.' };
  if (phrase.length < 2 || meaning.length < 2) return { error: 'Write the phrase and what it means.' };
  if (/₹|rs\.?\s*\d|rupee|\d{4,}|\d+\s*%/i.test(meaning)) return { error: 'A meaning never holds a price or amount: write what the phrase means.' };
  await savePhrase({ lang, phrase, meaning, by: who });
  revalidatePath('/admin/whatsapp/settings');
  return { ok: `Saved. The AI reads “${phrase}” that way from now on.` };
}

export async function deletePhraseAction(id: number) {
  await requireAdmin();
  await deletePhrase(id);
  revalidatePath('/admin/whatsapp/settings');
}
