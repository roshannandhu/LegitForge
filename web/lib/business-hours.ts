import { SITE } from './site';

/** Computed in the browser only: pages are cached, so the server can't know "now" (PLAN §6.2). */
export function isOpenNow(now = new Date()) {
  const { days, from, to, timeZone } = SITE.hours;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? '';
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value);
  return (days as readonly number[]).includes(day) && hour >= from && hour < to;
}

export const opensAtLabel = () => {
  const h = SITE.hours.from;
  return `${h > 12 ? h - 12 : h} ${h >= 12 ? 'p.m.' : 'a.m.'}`;
};

/** When we'll reply to something sent right now (plan D #12): within the reply promise during
 *  working hours (never past closing), else that long after the next opening. In the
 *  studio's time zone; browser only, like isOpenNow. e.g. "4:10 p.m." or "12 p.m. tomorrow". */
export function replyByLabel(now = new Date()) {
  return nextLabel(now, (parseFloat(SITE.replyWithin) || 2) * 60, true);
}

/** When the forge next opens (plan D #13), e.g. "10 a.m. tomorrow"; "" while open. */
export function opensNextLabel(now = new Date()) {
  return isOpenNow(now) ? '' : nextLabel(now, 0, false);
}

function nextLabel(now: Date, within: number, whileOpen: boolean) {
  const { days, from, to, timeZone } = SITE.hours;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone, weekday: 'short', hour: 'numeric', minute: 'numeric', hourCycle: 'h23',
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const long = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const day = names.indexOf(get('weekday'));
  const mins = Number(get('hour')) * 60 + Number(get('minute'));
  const works = (d: number) => (days as readonly number[]).includes(d);
  const clock = (m: number) => {
    const h = Math.floor(m / 60), mm = m % 60, h12 = h % 12 || 12;
    return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h >= 12 ? 'p.m.' : 'a.m.'}`;
  };
  if (whileOpen && works(day) && mins >= from * 60 && mins < to * 60) return clock(Math.min(mins + within, to * 60));
  if (works(day) && mins < from * 60) return `${clock(from * 60 + within)} today`;
  for (let k = 1; k <= 7; k++) {
    const d = (day + k) % 7;
    if (works(d)) return `${clock(from * 60 + within)} ${k === 1 ? 'tomorrow' : `on ${long[d]}`}`;
  }
  return clock(from * 60 + within);
}
