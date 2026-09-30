/** Placeholder content (PLAN §0): anything in [square brackets] is a stand-in for a real fact.
 *  Public pages never print one. The demo projects and team show only with SHOW_PLACEHOLDERS=1
 *  (set at build time: pages are prerendered), for local design work and `npm run check`. */

export const isPh = (s: string | null | undefined) => !!s && /\[[^\]]+\]/.test(s);
export const SHOW_PH = process.env.SHOW_PLACEHOLDERS === '1';
/** A price is printed only once it is real. A subscription says so ("Monthly plans, quoted per
 *  screen"); anything else is "Quoted per project". */
export const priceText = (p: string, unset = 'Quoted per project') => (isPh(p) ? unset : p);
