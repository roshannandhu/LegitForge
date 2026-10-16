/** Gives the bot the website's own service FAQs as approved answers (Supabase `knowledge`,
 *  source 'site'), so it can answer common questions from day one. Safe to re-run: it replaces
 *  the previous 'site' rows and leaves the team's learned answers alone.
 *
 *    GEMINI_API_KEY=… SUPABASE_SECRET_KEY=… npx tsx bot/seed.ts      (from web/)
 *
 *  Only lib/pages.ts FAQs: lib/content.ts's FAQ still contradicts it on website timelines. */

import { SERVICE_PAGES } from '../lib/pages';
import { embed, sb, vec, type Env } from './io';

const env = {
  SUPABASE_URL: process.env.SUPABASE_URL || 'https://htnkzplobqoghnuvmyup.supabase.co',
  SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY ?? '',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY,
  EMBED_MODEL: process.env.EMBED_MODEL,
} as Env;
if (!env.SUPABASE_SECRET_KEY || !env.GEMINI_API_KEY) throw new Error('Set SUPABASE_SECRET_KEY and GEMINI_API_KEY');

async function main() {
  const rows = [];
  for (const page of SERVICE_PAGES) for (const { q, a } of page.faq) {
    const question = `${page.name}: ${q}`;
    const v = await embed(env, question);
    if (!v) throw new Error(`Embedding failed for "${question}" (rate limit? run again in a minute)`);
    rows.push({ question_en: question, answer_en: a, embedding: vec(v), status: 'approved', source: 'site', decided_by: 'seed', decided_at: new Date().toISOString() });
  }
  await sb(env, 'DELETE', 'knowledge?source=eq.site', undefined, 'return=minimal');
  await sb(env, 'POST', 'knowledge', rows, 'return=minimal');
  console.log(`Seeded ${rows.length} approved answers from the service pages.`);
}
main().catch((e) => { console.error(e instanceof Error ? e.message : e); process.exitCode = 1; });
