import { SITE, orgRef } from './site';
import { SERVICE_PAGES } from './pages';
import { isPh } from './placeholder';
import { shortName, type Member } from './team';

/** The team in search data (titles, descriptions, keywords, structured data, llms.txt), always
 *  built from Admin → Team: a person added, renamed or given a new role shows up everywhere on
 *  the next render (updateTag('team')), with nothing to edit by hand. */

/** One id per person, so the studio's `employee` list and their own page describe the same node. */
export const personId = (m: Member) => `${SITE.url}${m.path}#person`;

/** Only people with a real name; "[Name]" placeholders never reach search data. */
export const named = (team: Member[]) => team.filter((m) => m.name && !isPh(m.name));

/** A person for JSON-LD. `full` adds what only their own page carries (photo, bio, skills). */
export function personLd(m: Member, full = false) {
  const alt = shortName(m.name);
  return {
    '@type': 'Person',
    '@id': personId(m),
    name: m.name,
    ...(alt !== m.name ? { alternateName: alt } : {}),
    ...(m.role ? { jobTitle: m.role } : {}),
    url: `${SITE.url}${m.path}`,
    // LinkedIn, GitHub, website: how search engines tell this person from others with the same name
    ...(m.links.length ? { sameAs: m.links.map((l) => l.href) } : {}),
    ...(full ? {
      ...(m.photo ? { image: `${SITE.url}${m.photo}` } : {}),
      ...(m.bio ? { description: m.bio } : {}),
      ...(m.skills.length || m.tools.length ? { knowsAbout: [...new Set([...m.skills, ...m.tools])] } : {}),
      worksFor: orgRef,
    } : {}),
  };
}

/** "A", "A and B", "A, B and C". */
export const joinNames = (names: string[]) =>
  names.length < 2 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names.at(-1)}`;

/** Search results show about 160 characters: cut at a word, never mid-word. */
export function fit(text: string, max = 160) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:.\s]+$/, '')}…`;
}

const unique = (words: string[]) => {
  const seen = new Set<string>();
  return words.map((w) => w.trim()).filter((w) => w && !isPh(w) && !seen.has(w.toLowerCase()) && seen.add(w.toLowerCase()));
};

/** A person's search phrases: full and short name, with the studio, their role and the city. */
export function personKeywords(m: Member, city = '') {
  const n = shortName(m.name);
  return unique([
    m.name, n, `${n} ${SITE.name}`,
    ...(m.role ? [m.role, `${n} ${m.role}`] : []),
    ...(city ? [`${n} ${city}`] : []),
  ]);
}

/** Other names people search a Kerala city by, and the state: "Calicut" → Kozhikode, Kerala. */
const CITY_ALSO: Record<string, string[]> = {
  calicut: ['Kozhikode', 'Kerala'], kozhikode: ['Calicut', 'Kerala'],
  kochi: ['Cochin', 'Ernakulam', 'Kerala'], cochin: ['Kochi', 'Kerala'], ernakulam: ['Kochi', 'Kerala'],
  thiruvananthapuram: ['Trivandrum', 'Kerala'], trivandrum: ['Thiruvananthapuram', 'Kerala'],
  thrissur: ['Kerala'], kannur: ['Kerala'], malappuram: ['Kerala'], kollam: ['Kerala'], palakkad: ['Kerala'],
};

/** The city from Admin → Company, then its other names: ['Calicut', 'Kozhikode', 'Kerala']. */
export const cityNames = (city: string) => (city ? [city, ...(CITY_ALSO[city.trim().toLowerCase()] ?? [])] : []);

/** Each phrase alone and with each city name: "website design", "website design Calicut", … */
export const withCity = (phrases: string[], city = '') =>
  unique(phrases.flatMap((p) => [p, ...cityNames(city).map((c) => `${p} ${c}`)]));

/** The studio's phrases (name, every service's keywords with the city) plus every named person's. */
export function siteKeywords(team: Member[], city = '') {
  return unique([
    SITE.name, 'LegitForge', ...cityNames(city).map((c) => `${SITE.name} ${c}`),
    ...withCity(['freelance web developer', 'freelance developers'], city),
    ...withCity(SERVICE_PAGES.map((s) => s.keywords[0]!), city),
    ...named(team).flatMap((m) => personKeywords(m, city)),
  ]);
}
