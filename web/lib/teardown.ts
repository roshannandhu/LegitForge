/** The Teardown (PLAN §6.2c, plan F): the phone in the hand comes apart into seven live glass
 *  layers, one per thing we build, telling one customer's journey from top to bottom:
 *  Priya finds CoolAir on Google, asks for a quote on the website, WhatsApp finds out what she
 *  needs, n8n prices it, the quote is accepted, the warranty is issued, and months later she
 *  taps the NFC tag on her AC to check it and book a service.
 *
 *  Geometry lives in one fixed design space (780 × 760), scaled to fit like the old machine.
 *  Every position is server-rendered as CSS variables, so the no-JS frame is exact. */

export type LayerId = 'seo' | 'web' | 'wa' | 'n8n' | 'quote' | 'warranty' | 'nfc';

export interface Layer {
  id: LayerId;
  num: string;
  name: string;        // real text: the service, crawlable
  spec: string;        // the technical-drawing callout line
  chip: string;        // the story chip that leads with this layer
  log: string;         // build-log line when it runs (<= 36 chars: one line on a 375 px phone)
}

/** Top of the stack first: the journey runs downward, into the phone. */
export const LAYERS: Layer[] = [
  { id: 'seo',      num: '01', name: 'SEO',                 spec: 'Top result on Google',        chip: 'SEO',        log: 'google: CoolAir found, #1' },
  { id: 'web',      num: '02', name: 'Static website',      spec: 'Loads in 0.9 s · score 99',   chip: 'Website',    log: 'site: quote request sent' },
  { id: 'wa',       num: '03', name: 'WhatsApp automation', spec: 'Replies in seconds, 24/7',    chip: 'WhatsApp',   log: 'whatsapp: room size asked ✓✓' },
  { id: 'n8n',      num: '04', name: 'n8n automation',      spec: '4 steps, no copy-paste',      chip: 'Automation', log: 'n8n: priced and PDF made' },
  { id: 'quote',    num: '05', name: 'Quotation system',    spec: 'Sent, opened, accepted',      chip: 'Quote',      log: 'quote: Q-2041 accepted' },
  { id: 'warranty', num: '06', name: 'Warranty system',     spec: 'QR check · valid to 2027',    chip: 'Warranty',   log: 'warranty: issued, valid 2027' },
  { id: 'nfc',      num: '07', name: 'NFC tags and cards',  spec: 'One tap: warranty, service',  chip: 'NFC',        log: 'nfc: tap → service booked' },
];
export const LOG_WAIT = 'waiting for a customer…';
export const LOG_DONE = 'done: one customer, zero typing.';
export const DEFAULT_LEAD: LayerId = 'wa';
export const LAYER_IDS = LAYERS.map((l) => l.id);
export const isLayerId = (v: unknown): v is LayerId => LAYER_IDS.includes(v as LayerId);
/** Fired on window by the chips; the teardown re-leads and glides to that layer. */
export const LEAD_EVENT = 'lf:lead';

/* ------------------------------------------------------------------ geometry */
export const DESIGN = { w: 780, h: 760 } as const;
/** Phones show 610 of the 780 design px, from x = 170: the callout column is cropped (hero.css). */
export const PHONE_CROP = 610;
/** The hand-held phone, and its screen inside the photo (measured from the 1200 × 1653 cut-out). */
export const PHONE = { cx: 652, cy: 444, w: 240, aspect: 1.3775 } as const;
const phoneLeft = PHONE.cx - PHONE.w / 2;
const phoneTop = PHONE.cy - (PHONE.w * PHONE.aspect) / 2;
export const SCREEN = {
  x: phoneLeft + PHONE.w * 0.3628,
  y: phoneTop + PHONE.w * PHONE.aspect * 0.0202,
  w: PHONE.w * 0.5346,
  h: PHONE.w * PHONE.aspect * 0.8304,
};
export const SCREEN_C = { x: SCREEN.x + SCREEN.w / 2, y: SCREEN.y + SCREEN.h / 2 };

/** The exploded stack: layers lying tilted, one above another like floors, on the left of the
 *  stage (an exploded product drawing), with a slight lean. Index = LAYERS order (top first). */
export const SLOTS = LAYERS.map((_, i) => ({ x: 382 - i * 6, y: 92 + i * 86 }));
/** Where a layer comes to be read: lifted out of the stack toward the viewer, flat. */
export const FOCUS = { x: 382, y: 384, s: 1.5 } as const;
/** Callouts on the left of each floor, right-aligned, like a technical data sheet. */
export const CALLOUTS = SLOTS.map((s) => ({ x: 14, y: s.y - 22 }));
export const CALLOUT_W = 184;
export const ISO_SCALE = 0.72;

/** Scroll story (desktop and tablet): the pin, and the windows on its 0..1 timeline. */
export const PIN_END = '+=270%';
export const RUN = { start: 0.26, each: 0.084 } as const;   // 7 windows: 0.26 -> 0.848
export const ACT_NAMES = ['Tear down', 'Run', 'Snap back'] as const;
export const actIndex = (p: number) => (p < RUN.start ? 0 : p < RUN.start + RUN.each * LAYERS.length ? 1 : 2);
