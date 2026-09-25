/** The Phone Becomes the Machine — PLAN §6.2a
 *
 *  Seven plates. Each carries a technical label in acts 1-2 and a service name
 *  in act 3. `Database` and `CRM` are merged: they are one layer to a client,
 *  and seven is the most that stays readable.
 *
 *  Desktop and phone are two first-class layouts (§4.8), not one squeezed:
 *  7 plates on desktop, 4 on a phone, and never a pin below 768px.
 *  All seven stay in the DOM at every size, so every service name is
 *  crawlable copy in the highest-value block on the site.
 */

export type PlateId = 'web' | 'app' | 'api' | 'db' | 'n8n' | 'wa' | 'ai';

export interface Plate {
  id: PlateId;
  num: string;
  tech: string;
  service: string;
}

/** Pipeline order. Act 2 wires them in exactly this sequence. */
export const PLATES: Plate[] = [
  { id: 'web', num: '01', tech: 'Website / UI',      service: 'Websites' },
  { id: 'app', num: '02', tech: 'App shell',         service: 'Mobile Apps' },
  { id: 'api', num: '03', tech: 'API',               service: 'Custom Business Systems' },
  { id: 'db',  num: '04', tech: 'Database / CRM',    service: 'Dashboards' },
  { id: 'n8n', num: '05', tech: 'n8n',               service: 'Automations' },
  { id: 'wa',  num: '06', tech: 'WhatsApp',          service: 'WhatsApp Bots' },
  { id: 'ai',  num: '07', tech: 'AI / Integrations', service: 'AI Systems' },
];

export interface Pos { id: PlateId; x: number; y: number; z: number }

export interface Layout {
  /** fixed design space; scaled to fit its container so all coords stay predictable */
  w: number;
  h: number;
  origin: { x: number; y: number };
  /** phone width in design units */
  phone: number;
  pin: boolean;
  end: string;
  positions: Pos[];
}

export const LAYOUTS: Record<'desktop' | 'phone', Layout> = {
  desktop: {
    w: 780, h: 760, origin: { x: 390, y: 360 }, phone: 300, pin: true, end: '+=260%',
    positions: [
      { id: 'web', x: 120, y: 250, z:  120 },
      { id: 'app', x: 190, y: 118, z:   60 },
      { id: 'api', x: 390, y:  60, z:    0 },
      { id: 'db',  x: 590, y: 118, z:  -60 },
      { id: 'n8n', x: 660, y: 250, z: -120 },
      { id: 'wa',  x: 648, y: 436, z:  -60 },
      { id: 'ai',  x: 132, y: 436, z:   60 },
    ],
  },
  /** Sized to render at ~1:1 on a 375px phone (343px content box), so the 14px labels
   *  stay 14px on screen (§4.8). 150px plates, centres at 75 / 255 = flush to both edges. */
  phone: {
    w: 330, h: 520, origin: { x: 165, y: 260 }, phone: 150, pin: false, end: '+=120%',
    positions: [
      { id: 'web', x:  75, y:  80, z:  70 },
      { id: 'n8n', x: 255, y:  80, z: -70 },
      { id: 'wa',  x: 255, y: 440, z: -70 },
      { id: 'ai',  x:  75, y: 440, z:  70 },
    ],
  },
};

/** Act boundaries on the 0..1 timeline. Act 3 holds longest: it is the frame that sells. */
export const ACTS = { explode: 0, wire: 0.35, become: 0.6, collapse: 0.85 } as const;

export const actLabel = (p: number) =>
  p < ACTS.wire ? '1 explode' : p < ACTS.become ? '2 wire' : p < ACTS.collapse ? '3 become' : '4 collapse';
