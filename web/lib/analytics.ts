/** Small, bounded first-party events. No visitor IDs or personal fields are stored. */
export const EVENT_NAMES = ['whatsapp_click', 'service_open', 'project_open', 'form_submit'] as const;
export type EventName = typeof EVENT_NAMES[number];
export const EVENT_LABELS: Record<EventName, string> = {
  whatsapp_click: 'WhatsApp clicks', service_open: 'Service detail opens',
  project_open: 'Project opens', form_submit: 'Saved enquiries',
};
export const EVENT_LOCATIONS = ['hero', 'header', 'contact', 'footer', 'service', 'work', 'team', 'closing', 'other'] as const;
export type EventProps = { location?: string; slug?: string; service?: string };

export const eventCountry = (country?: string | null) => /^[A-Z]{2}$/.test(country ?? '') ? country! : null;

/** Drop unknown fields instead of persisting arbitrary browser-supplied strings. */
export function publicEvent(raw: unknown, serviceSlugs: readonly string[]): { name: EventName; props: EventProps } | null {
  if (!raw || typeof raw !== 'object') return null;
  const { name, props: value } = raw as { name?: unknown; props?: unknown };
  if (name !== 'whatsapp_click' && name !== 'service_open' && name !== 'project_open') return null;
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const props: EventProps = {};
  if (typeof input.location === 'string' && (EVENT_LOCATIONS as readonly string[]).includes(input.location)) props.location = input.location;
  if (name === 'service_open') {
    if (typeof input.slug !== 'string' || !serviceSlugs.includes(input.slug)) return null;
    props.slug = input.slug;
  }
  if (name === 'project_open') {
    if (typeof input.slug !== 'string' || !/^[a-z0-9-]{1,80}$/.test(input.slug)) return null;
    props.slug = input.slug;
  }
  return { name, props };
}

/** Atomic best-effort admission prevents event floods without keeping an IP or visitor ID. */
export async function storePublicEvent(db: D1Database, event: { name: EventName; props: EventProps }, key: string, country?: string | null, at = Date.now()) {
  return db.batch([
    db.prepare('INSERT INTO rate_events (key, at) SELECT ?, ? WHERE (SELECT COUNT(*) FROM rate_events WHERE key = ? AND at > ?) < 120')
      .bind(key, at, key, at - 3600_000),
    db.prepare('INSERT INTO events (name, props, country, at) SELECT ?, ?, ?, ? WHERE changes() = 1')
      .bind(event.name, JSON.stringify(event.props), eventCountry(country), at),
  ]);
}

/** Form submissions call this only after storage succeeds, outside the lead transaction. */
export async function recordEvent(db: D1Database, name: EventName, props: EventProps = {}, country?: string | null) {
  await db.prepare('INSERT INTO events (name, props, country, at) VALUES (?, ?, ?, ?)')
    .bind(name, JSON.stringify(props), eventCountry(country), Date.now()).run();
}

export async function analyticsSummary(db: D1Database) {
  const { results } = await db.prepare('SELECT name, COUNT(*) AS n FROM events WHERE at >= ? GROUP BY name')
    .bind(Date.now() - 30 * 24 * 3600_000).all<{ name: string; n: number }>();
  return EVENT_NAMES.map((name) => ({ name, label: EVENT_LABELS[name], n: results.find((r) => r.name === name)?.n ?? 0 }));
}

export function analyticsCutoff(now = Date.now()) {
  const cutoff = new Date(now);
  const day = cutoff.getUTCDate();
  cutoff.setUTCDate(1);
  cutoff.setUTCMonth(cutoff.getUTCMonth() - 13);
  const lastDay = new Date(Date.UTC(cutoff.getUTCFullYear(), cutoff.getUTCMonth() + 1, 0)).getUTCDate();
  cutoff.setUTCDate(Math.min(day, lastDay));
  return cutoff.getTime();
}
