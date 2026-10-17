/** Calls on the team's Google Calendar (phase 5): free half-hour slots in working hours, and the
 *  booked call as an event (with a Google Meet link when the client wants Meet). Plain fetch with
 *  the owner's OAuth refresh token (calendar.events + freebusy for legitforge@gmail.com); without
 *  the secrets the bot still arranges calls, by asking the team. */

import { SITE } from '../lib/site';
import { count, type Env } from './io';

const TIMEOUT = 8000;
const SLOT = 30 * 60_000;
const IST = 5.5 * 3_600_000;

export const calendarOn = (env: Env) => !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_REFRESH_TOKEN);
const calendarId = (env: Env) => encodeURIComponent(env.CALENDAR_ID || 'primary');

async function token(env: Env): Promise<string | null> {
  if (!calendarOn(env)) return null;
  count(env);
  try {
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: env.GOOGLE_CLIENT_ID!, client_secret: env.GOOGLE_CLIENT_SECRET!, refresh_token: env.GOOGLE_REFRESH_TOKEN!, grant_type: 'refresh_token' }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) { console.error('[calendar] token refused', r.status); return null; }
    return ((await r.json()) as { access_token?: string }).access_token ?? null;
  } catch (e) { console.error('[calendar] token failed', String(e).slice(0, 200)); return null; }
}

/** Half-hour starts in working hours (lib/site.ts SITE.hours, India time) over the next working
 *  days, from 2 hours after `now`, that do not touch a busy time; at most `max`, at most 3 a day. */
export function openSlots(now: number, busy: { start: number; end: number }[], max = 8, days = 3): number[] {
  const out: number[] = [], { days: open, from, to } = SITE.hours;
  const earliest = now + 2 * 3_600_000;
  let day = Math.floor((now + IST) / 86_400_000) * 86_400_000 - IST;                       // today 00:00 IST
  for (let d = 0, used = 0; d < 14 && used < days && out.length < max; d++, day += 86_400_000) {
    if (!(open as readonly number[]).includes(new Date(day + IST).getUTCDay())) continue;
    let today = 0;
    for (let t = day + from * 3_600_000; t + SLOT <= day + to * 3_600_000 && today < 3 && out.length < max; t += SLOT) {
      if (t < earliest || busy.some((b) => t < b.end && t + SLOT > b.start)) continue;
      out.push(t); today++;
    }
    if (today) used++;
  }
  return out;
}

/** Free slots from the calendar, or null when it can't be read (the team arranges the call). */
export async function freeSlots(env: Env, now: number): Promise<number[] | null> {
  const access = await token(env);
  if (!access) return null;
  count(env);
  try {
    const r = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST',
      headers: { authorization: `Bearer ${access}`, 'content-type': 'application/json' },
      body: JSON.stringify({ timeMin: new Date(now).toISOString(), timeMax: new Date(now + 14 * 86_400_000).toISOString(), items: [{ id: env.CALENDAR_ID || 'primary' }] }),
      signal: AbortSignal.timeout(TIMEOUT),
    });
    if (!r.ok) { console.error('[calendar] free/busy refused', r.status); return null; }
    const cal = Object.values(((await r.json()) as { calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: unknown[] }> }).calendars ?? {})[0];
    if (!cal || cal.errors?.length) return null;
    return openSlots(now, (cal.busy ?? []).map((b) => ({ start: Date.parse(b.start), end: Date.parse(b.end) })));
  } catch (e) { console.error('[calendar] free/busy failed', String(e).slice(0, 200)); return null; }
}

/** An event id from our own key (base32hex: Google's rule), so a retried booking finds its event. */
const eventId = (key: string) => `lf${[...key].map((ch) => ch.charCodeAt(0).toString(16).padStart(2, '0')).join('')}`.slice(0, 1000);
type Booked = { id: string; meet: string | null; link: string | null };
const asBooked = (ev: { id?: string; hangoutLink?: string; htmlLink?: string }): Booked | null =>
  ev.id ? { id: ev.id, meet: ev.hangoutLink ?? null, link: ev.htmlLink ?? null } : null;

async function getEvent(env: Env, access: string, id: string) {
  count(env);
  const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId(env)}/events/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(TIMEOUT),
  });
  if (r.status === 404 || r.status === 410) return 'gone' as const;
  if (!r.ok) return null;
  const ev = (await r.json()) as { id?: string; status?: string; hangoutLink?: string; htmlLink?: string; start?: { dateTime?: string } };
  return ev.status === 'cancelled' ? ('gone' as const) : ev;
}

/** A booked call as the calendar has it now (moved or cancelled there?): its start, 'gone', or
 *  null when the calendar can't be read (the stored time stands). */
export async function callEvent(env: Env, id: string): Promise<{ start: number } | 'gone' | null> {
  const access = await token(env);
  if (!access) return null;
  try {
    const ev = await getEvent(env, access, id);
    if (!ev || ev === 'gone') return ev;
    const start = Date.parse(ev.start?.dateTime ?? '');
    return Number.isFinite(start) ? { start } : null;
  } catch { return null; }
}

/** The call as a calendar event (a Meet link when `meet`); 'taken' when the half hour is busy
 *  there, null when it could not be made. `key` names the event, so a retry finds the one it made. */
export async function bookCall(env: Env, start: number, o: { title: string; description: string; meet: boolean; key: string }) {
  const access = await token(env);
  if (!access) return null;
  const auth = { authorization: `Bearer ${access}`, 'content-type': 'application/json' }, id = eventId(o.key);
  const made = async () => { const ev = await getEvent(env, access, id).catch(() => null); return ev && ev !== 'gone' ? asBooked(ev) : null; };
  try {
    const before = await made();
    if (before) return before;                                               // made by an earlier try
    count(env);
    const fb = await fetch('https://www.googleapis.com/calendar/v3/freeBusy', {
      method: 'POST', headers: auth, signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({ timeMin: new Date(start).toISOString(), timeMax: new Date(start + SLOT).toISOString(), items: [{ id: env.CALENDAR_ID || 'primary' }] }),
    });
    if (!fb.ok) return null;                                                 // unreadable is not "taken"
    const cal = Object.values(((await fb.json()) as { calendars?: Record<string, { busy?: unknown[]; errors?: unknown[] }> }).calendars ?? {})[0];
    if (!cal || cal.errors?.length) return null;
    if ((cal.busy ?? []).length) return 'taken' as const;
    count(env);
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId(env)}/events?conferenceDataVersion=1&sendUpdates=none`, {
      method: 'POST', headers: auth, signal: AbortSignal.timeout(TIMEOUT),
      body: JSON.stringify({
        id, summary: o.title, description: o.description,
        start: { dateTime: new Date(start).toISOString(), timeZone: SITE.hours.timeZone },
        end: { dateTime: new Date(start + SLOT).toISOString(), timeZone: SITE.hours.timeZone },
        ...(o.meet ? { conferenceData: { createRequest: { requestId: id, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
      }),
    });
    if (r.status === 409) return made();                                     // it exists already (an earlier try)
    if (!r.ok) { console.error('[calendar] event refused', r.status, (await r.text()).slice(0, 200)); return null; }
    return asBooked((await r.json()) as { id?: string; hangoutLink?: string; htmlLink?: string });
  } catch (e) {
    console.error('[calendar] booking failed', String(e).slice(0, 200));
    return made();                                                           // a timeout may still have made it
  }
}

/** A booked call taken off the calendar (the client cancelled, or asked for another time). */
export async function cancelCall(env: Env, eventId: string) {
  const access = await token(env);
  if (!access) return false;
  count(env);
  try {
    const r = await fetch(`https://www.googleapis.com/calendar/v3/calendars/${calendarId(env)}/events/${encodeURIComponent(eventId)}?sendUpdates=none`, {
      method: 'DELETE', headers: { authorization: `Bearer ${access}` }, signal: AbortSignal.timeout(TIMEOUT),
    });
    return r.ok || r.status === 404 || r.status === 410;
  } catch { return false; }
}
