import test from 'node:test';
import assert from 'node:assert/strict';
import { openSlots } from '../bot/calendar';
import { inr, rupees } from '../bot/pay';
import { slotTime } from '../bot/worker';
import { LANGS } from '../bot/text';
import { WEEK } from '../lib/admin/bot';

/** India time as a timestamp, e.g. ist('2026-10-15 10:00'). */
const ist = (s: string) => Date.parse(`${s.replace(' ', 'T')}:00+05:30`);
const show = (ts: number[]) => ts.map((t) => new Date(t + 5.5 * 3_600_000).toISOString().slice(5, 16).replace('T', ' '));

test('call slots: half hours in working hours, from 2 hours ahead, at most 3 a day, never over a busy time', () => {
  const wed11 = ist('2026-10-14 11:00');
  assert.deepEqual(show(openSlots(wed11, [])), [
    '10-14 13:00', '10-14 13:30', '10-14 14:00',
    '10-15 10:00', '10-15 10:30', '10-15 11:00',
    '10-16 10:00', '10-16 10:30',
  ]);
  const busy = [{ start: ist('2026-10-15 10:00'), end: ist('2026-10-15 11:15') }];
  assert.deepEqual(show(openSlots(wed11, busy)).slice(3, 6), ['10-15 11:30', '10-15 12:00', '10-15 12:30'], 'a busy 10:00-11:15 blocks 11:00 too');
  // Saturday 6 p.m.: nothing left today, Sunday is closed, Monday from 10.
  assert.deepEqual(show(openSlots(ist('2026-10-17 18:00'), [], 4)), ['10-19 10:00', '10-19 10:30', '10-19 11:00', '10-20 10:00']);
  // The last slot ends at closing (7 p.m.).
  assert.deepEqual(show(openSlots(ist('2026-10-14 16:15'), [], 2)), ['10-14 18:30', '10-15 10:00']);
});

test('payment amounts: what a team member types, and the Indian way of writing it', () => {
  for (const [typed, n] of [['5000', 5000], ['5,000', 5000], ['₹5,000', 5000], ['Rs 1500', 1500], ['1,00,000', 100000], ['2500.50', 2500.5]] as const) assert.equal(rupees(typed), n, typed);
  for (const bad of ['', '0', '-5', 'five thousand', '50,00,00,000', '5000 dollars']) assert.equal(rupees(bad), null, bad);
  assert.equal(inr(100000), '₹1,00,000');
  assert.equal(inr(2500.5), '₹2,500.5');
});

test('call slot rows: a time fits a WhatsApp list row (24 characters) and no two rows read the same, in every language', () => {
  const slots = openSlots(ist('2026-10-14 08:00'), [], 8);
  for (const { key } of LANGS) {
    const titles = slots.map((ms) => slotTime(key).format(new Date(ms)));
    for (const tt of titles) assert.ok(tt.length <= 24, `${key}: ${tt}`);
    assert.equal(new Set(titles).size, titles.length, `${key}: ${titles.join(' | ')}`);
  }
});

test('the dashboard’s weeks: Monday to Sunday go to their Monday (a Monday is its own week)', async () => {
  const sqlite = 'node:sqlite';                        // @types/node 20 has no types for it yet
  const { DatabaseSync } = await import(sqlite);
  const db = new DatabaseSync(':memory:');
  const week = (created_at: string) => (db.prepare(`SELECT ${WEEK} AS w FROM (SELECT ? AS created_at)`).get(created_at) as { w: string }).w;
  assert.equal(week('2026-10-12 10:00:00'), '2026-10-12', 'Monday');
  assert.equal(week('2026-10-13 10:00:00'), '2026-10-12', 'Tuesday');
  assert.equal(week('2026-10-18 23:59:00'), '2026-10-12', 'Sunday');
  assert.equal(week('2026-10-19 00:00:00'), '2026-10-19', 'the next Monday');
});
