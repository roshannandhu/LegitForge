/** Advance payment links (phase 5): a Razorpay payment link when the owner has set the Razorpay
 *  keys, else the studio's UPI ID in words. The team approves every amount first (worker.ts). */

import { count, type Env } from './io';

/** A Razorpay payment link for `rupees`, or null (no keys, or Razorpay refused). */
export async function paymentLink(env: Env, rupees: number, o: { code: string; name: string; phone: string | null; reference: string }): Promise<string | null> {
  if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) return null;
  count(env);
  try {
    const r = await fetch('https://api.razorpay.com/v1/payment_links', {
      method: 'POST',
      headers: { authorization: `Basic ${btoa(`${env.RAZORPAY_KEY_ID}:${env.RAZORPAY_KEY_SECRET}`)}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        amount: Math.round(rupees * 100), currency: 'INR', accept_partial: false,
        description: `Legit Forge advance · #${o.code}`, reference_id: o.reference.slice(0, 40),
        customer: { name: o.name.slice(0, 50), ...(o.phone ? { contact: `+${o.phone}` } : {}) },
        notify: { sms: false, email: false }, reminder_enable: false, notes: { code: o.code },
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) { console.error('[pay] Razorpay refused', r.status, (await r.text()).slice(0, 200)); return null; }
    const link = ((await r.json()) as { short_url?: string }).short_url;
    return link && /^https:\/\//.test(link) ? link : null;
  } catch (e) { console.error('[pay] Razorpay failed', String(e).slice(0, 200)); return null; }
}

/** "5000", "5,000", "₹5,000", "Rs 5000" → 5000; anything else (or out of range) → null. */
export function rupees(text: string): number | null {
  const m = /^(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})*|\d+)(?:\.(\d{1,2}))?\s*(?:\/-)?\s*(?:rs\.?|rupees|inr)?\s*(?:\/-)?$/i.exec(text.trim());
  if (!m) return null;
  const n = Number(`${m[1].replace(/,/g, '')}.${m[2] ?? '0'}`);             // in one step: no 1 + 0.14 = 1.1400000000000001
  return n >= 1 && n <= 1_000_000 ? n : null;
}

/** ₹5,000 the Indian way (₹1,00,000). */
export const inr = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
