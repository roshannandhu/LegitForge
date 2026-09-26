import 'server-only';
import { unstable_cache } from 'next/cache';
import { TESTIMONIALS } from './content';
import { getEnv } from './cf';

/** Testimonials for the Hallmarks wall (plan D #10): published rows from Admin → Testimonials,
 *  only ones the client gave written permission for, else TESTIMONIALS in lib/content.ts.
 *  Same rules as lib/work.ts: not at build, tagged 'testimonials' for the admin's updateTag. */

export type Testimonial = { quote: string; name: string; role: string; company: string; date?: string };

async function fromDb(): Promise<Testimonial[] | null> {
  if (process.env.NEXT_PHASE === 'phase-production-build') return null;
  const db = (await getEnv())?.DB;
  if (!db) return null;
  try {
    const { results } = await db.prepare(
      `SELECT person_name, person_role, company, quote, created_at FROM testimonials
        WHERE is_published = 1 AND permission_confirmed = 1 ORDER BY created_at DESC LIMIT 6`,
    ).all<{ person_name: string; person_role: string | null; company: string | null; quote: string; created_at: string }>();
    return results.map((r) => ({
      quote: r.quote, name: r.person_name, role: r.person_role ?? '', company: r.company ?? '',
      date: new Date(`${r.created_at.replace(' ', 'T')}Z`).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' }),
    }));
  } catch (e) {
    console.error('[testimonials] D1 read failed', e);
    return null;
  }
}

export const getTestimonials = unstable_cache(
  async (): Promise<Testimonial[]> => {
    const rows = await fromDb();
    return rows && rows.length ? rows : TESTIMONIALS;
  },
  ['testimonials'],
  { tags: ['testimonials'] },
);
