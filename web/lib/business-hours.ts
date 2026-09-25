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
