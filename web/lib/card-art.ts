/** Artwork for the 3D lanyard cards and band (PLAN §6.8 steps 6 & 8).
 *
 *  Painted at runtime on a canvas from the live CSS tokens and the page's loaded fonts,
 *  so the cards always match the site, follow the theme, and pick up real names and
 *  photos from content with no image pipeline.
 *  ponytail: runtime canvas instead of the plan's server-rendered atlas + R2 cache. Upgrade
 *  to the /api/cards/[slug]/atlas route when there are real photos worth caching.
 *
 *  card.glb UV layout (measured by React Bits): front face = LEFT half of the atlas,
 *  back face = RIGHT half, both from the top edge down to ~75.5% of the height. */

import { CanvasTexture, SRGBColorSpace, RepeatWrapping } from 'three';

export interface CardPerson {
  id: string;
  idCode: string;
  name: string;
  role: string;
  initials: string;
  skills: string[];
  shipped: string;
  favorite: string;
  /** path under /public, e.g. /team/member-one.jpg; empty = monogram */
  photo?: string;
  visitor?: boolean;
}

const ATLAS = 2048;
const FRONT = { x: 0, y: 0, w: ATLAS / 2, h: Math.round(ATLAS * 0.755) };
const BACK = { x: ATLAS / 2, y: 0, w: ATLAS / 2, h: Math.round(ATLAS * 0.757) };

// the coin seal (CoinMark in components/ui/icons.tsx), same 32×32 geometry
const RING = 'LEGIT FORGE · LEGIT FORGE · ';

type Tokens = Record<'surface' | 'surface2' | 'line' | 'text' | 'muted' | 'accent' | 'accentInk' | 'heatLo' | 'heatHi' | 'heatMid' | 'quench', string>;
type Fonts = { sans: string; stencil: string };

function tokens(): Tokens {
  const s = getComputedStyle(document.documentElement);
  const v = (n: string) => s.getPropertyValue(n).trim();
  return {
    surface: v('--surface'), surface2: v('--surface-2'), line: v('--line'), text: v('--text'),
    muted: v('--text-muted'), accent: v('--accent'), accentInk: v('--accent-ink'),
    heatLo: v('--heat-lo'), heatMid: v('--heat-mid'), heatHi: v('--heat-hi'), quench: v('--quench'),
  };
}

function fonts(): Fonts {
  const s = getComputedStyle(document.documentElement);
  const sans = s.getPropertyValue('--font-archivo').trim() || 'system-ui, sans-serif';
  return { sans, stencil: s.getPropertyValue('--font-stencil').trim() || sans };
}

/** Canvas can only draw faces that are already loaded; wait for every weight we use. */
export async function loadCardFonts() {
  const f = fonts();
  await Promise.all([
    document.fonts.load(`800 96px ${f.sans}`),
    document.fonts.load(`600 44px ${f.sans}`),
    document.fonts.load(`500 44px ${f.sans}`),
    document.fonts.load(`700 56px ${f.stencil}`),
  ]).catch(() => {});
}

/** Decoded photos, one per person (null = none or failed: the card falls back to the
 *  monogram). Same-origin files only, so the canvas never becomes tainted. */
export function loadCardPhotos(people: CardPerson[]) {
  return Promise.all(people.map((p) => {
    if (!p.photo) return null;
    const img = new Image();
    img.decoding = 'async';
    img.src = p.photo;
    return img.decode().then(() => img, () => null);
  }));
}

/* ------------------------------------------------------------------ helpers */
function setFont(ctx: CanvasRenderingContext2D, weight: number, px: number, family: string, stretch: CanvasFontStretch = 'normal') {
  ctx.font = `${weight} ${px}px ${family}`;
  if ('fontStretch' in ctx) ctx.fontStretch = stretch;   // Archivo's width axis; older engines skip it
}

/** Largest size ≤ px at which `text` fits in `max` — long placeholder names never overflow. */
function fitFont(ctx: CanvasRenderingContext2D, text: string, weight: number, px: number, family: string, max: number, stretch?: CanvasFontStretch) {
  let size = px;
  setFont(ctx, weight, size, family, stretch);
  while (size > 24 && ctx.measureText(text).width > max) setFont(ctx, weight, (size -= 4), family, stretch);
  return size;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, max: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The coin logo (CoinMark in components/ui/icons.tsx), same 32×32 geometry. */
function mark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 32, size / 32);
  const gold = ctx.createRadialGradient(12, 10, 0, 12, 10, 24);
  gold.addColorStop(0, '#FFE9A8'); gold.addColorStop(.45, '#E3B452'); gold.addColorStop(1, '#A87424');
  const steel = ctx.createLinearGradient(0, 0, 32, 32);
  steel.addColorStop(0, '#5C6B7A'); steel.addColorStop(.5, '#2E3945'); steel.addColorStop(1, '#1A222B');
  const disc = (r: number, fill: CanvasGradient) => { ctx.beginPath(); ctx.arc(16, 16, r, 0, Math.PI * 2); ctx.fillStyle = fill; ctx.fill(); };
  disc(15.6, gold);
  disc(14.3, steel);
  // LEGIT FORGE round the ring, one letter at a time, reading clockwise from the left
  ctx.fillStyle = '#E6ECF1'; ctx.font = `800 2.7px ${fonts().sans}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  [...RING].forEach((ch, i) => {
    const a = Math.PI + (i / RING.length) * Math.PI * 2;
    ctx.save(); ctx.translate(16 + Math.cos(a) * 12.4, 16 + Math.sin(a) * 12.4); ctx.rotate(a + Math.PI / 2);
    ctx.fillText(ch, 0, 0); ctx.restore();
  });
  disc(10.6, gold);
  ctx.fillStyle = '#6E4A12'; ctx.font = `800 5.1px ${fonts().sans}`; ctx.textBaseline = 'alphabetic';
  ctx.fillText('LEGIT', 16, 15.3);
  ctx.fillText('FORGE', 16, 20.9);
  ctx.restore();
}

/* ------------------------------------------------------------------ faces */
function drawFront(ctx: CanvasRenderingContext2D, r: typeof FRONT, p: CardPerson, t: Tokens, f: Fonts, photo: HTMLImageElement | null) {
  const pad = 80;
  const x0 = r.x + pad;
  const inner = r.w - pad * 2;
  ctx.fillStyle = t.surface;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // header: mark + wordmark, ID code in the stamp face. Top 150px stays clear for the clip.
  mark(ctx, x0, 168, 76);
  ctx.fillStyle = t.text;
  ctx.textBaseline = 'middle';
  setFont(ctx, 800, 44, f.sans, 'semi-expanded');
  ctx.fillText('LEGIT FORGE', x0 + 96, 212);
  ctx.textAlign = 'right';
  ctx.fillStyle = t.muted;
  setFont(ctx, 700, 60, f.stencil);
  ctx.fillText(p.idCode, r.x + r.w - pad, 212);
  ctx.textAlign = 'left';

  // photo frame: the photo, cover-fit, or a monogram until one exists
  const py = 300, ph = 640;
  roundRect(ctx, x0, py, inner, ph, 40);
  if (photo) {
    const s = Math.max(inner / photo.naturalWidth, ph / photo.naturalHeight);
    const w = photo.naturalWidth * s, h = photo.naturalHeight * s;
    ctx.save();
    ctx.clip();
    ctx.drawImage(photo, x0 + (inner - w) / 2, py + (ph - h) / 2, w, h);
    ctx.restore();
    roundRect(ctx, x0, py, inner, ph, 40);
    ctx.lineWidth = 3;
    ctx.strokeStyle = t.line;
    ctx.stroke();
  } else {
    if (p.visitor) {
      ctx.setLineDash([26, 18]);
      ctx.lineWidth = 6;
      ctx.strokeStyle = t.line;
      ctx.stroke();
      ctx.setLineDash([]);
    } else {
      ctx.fillStyle = t.surface2;
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = t.line;
      ctx.stroke();
    }
    ctx.fillStyle = p.visitor ? t.muted : t.quench;
    ctx.textAlign = 'center';
    setFont(ctx, 800, 300, f.sans, 'semi-expanded');
    ctx.fillText(p.initials, r.x + r.w / 2, py + ph / 2 + 8);
    ctx.textAlign = 'left';
  }

  // name + role
  ctx.fillStyle = t.text;
  ctx.textBaseline = 'alphabetic';
  fitFont(ctx, p.name, 800, 104, f.sans, inner, 'semi-expanded');
  ctx.fillText(p.name, x0, 1080);
  ctx.fillStyle = t.muted;
  fitFont(ctx, p.role, 500, 52, f.sans, inner);
  ctx.fillText(p.role, x0, 1156);

  // holographic "LEGIT" seal, bottom right
  const sw = 300, sh = 104, sx = r.x + r.w - pad - sw, sy = r.h - pad - sh - 40;
  const g = ctx.createLinearGradient(sx, sy, sx + sw, sy + sh);
  g.addColorStop(0, t.heatLo);
  g.addColorStop(0.35, t.heatHi);
  g.addColorStop(0.7, t.quench);
  g.addColorStop(1, t.heatMid);
  roundRect(ctx, sx, sy, sw, sh, 18);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.fillStyle = '#151A20';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  setFont(ctx, 700, 62, f.stencil);
  ctx.fillText('LEGIT', sx + sw / 2, sy + sh / 2 + 4);
  ctx.textAlign = 'left';
}

function drawBack(ctx: CanvasRenderingContext2D, r: typeof BACK, p: CardPerson, t: Tokens, f: Fonts) {
  const pad = 80;
  const x0 = r.x + pad;
  const inner = r.w - pad * 2;
  ctx.fillStyle = t.surface;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.textBaseline = 'alphabetic';

  if (p.visitor) {
    ctx.fillStyle = t.text;
    setFont(ctx, 800, 96, f.sans, 'semi-expanded');
    const lines = wrap(ctx, 'Every project starts as a blank card.', inner);
    lines.forEach((l, i) => ctx.fillText(l, x0, 420 + i * 112));
    ctx.fillStyle = t.muted;
    setFont(ctx, 500, 54, f.sans);
    wrap(ctx, 'Tell us what you’re building.', inner).forEach((l, i) =>
      ctx.fillText(l, x0, 440 + lines.length * 112 + 40 + i * 66));
    mark(ctx, x0, r.h - pad - 120, 88);
    return;
  }

  ctx.fillStyle = t.muted;
  setFont(ctx, 600, 40, f.sans);
  ctx.fillText('SKILLS', x0, 260);

  // skill chips, wrapping
  setFont(ctx, 600, 46, f.sans);
  let cx = x0, cy = 300;
  for (const s of p.skills) {
    const w = ctx.measureText(s).width + 64;
    if (cx + w > r.x + r.w - pad) { cx = x0; cy += 108; }
    roundRect(ctx, cx, cy, w, 84, 42);
    ctx.lineWidth = 3;
    ctx.strokeStyle = t.line;
    ctx.stroke();
    ctx.fillStyle = t.text;
    ctx.textBaseline = 'middle';
    ctx.fillText(s, cx + 32, cy + 44);
    cx += w + 20;
  }
  ctx.textBaseline = 'alphabetic';

  // stats
  const stat = (label: string, value: string, y: number) => {
    ctx.fillStyle = t.line;
    ctx.fillRect(x0, y - 70, inner, 3);
    ctx.fillStyle = t.muted;
    setFont(ctx, 500, 44, f.sans);
    ctx.fillText(label, x0, y);
    ctx.fillStyle = t.text;
    ctx.textAlign = 'right';
    fitFont(ctx, value, 800, 56, f.sans, inner * 0.5);
    ctx.fillText(value, x0 + inner, y);
    ctx.textAlign = 'left';
  };
  stat('Projects shipped', p.shipped, cy + 260);
  stat('Favourite build', p.favorite, cy + 400);

  mark(ctx, x0, r.h - pad - 90, 64);
  ctx.fillStyle = t.muted;
  setFont(ctx, 600, 40, f.sans);
  ctx.fillText('legitforge', x0 + 84, r.h - pad - 42);
}

/** One 2048² atlas per card: steel edges, our front on the left, our back on the right. */
export function drawCardAtlas(p: CardPerson, photo: HTMLImageElement | null = null) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = ATLAS;
  const ctx = canvas.getContext('2d')!;
  const t = tokens();
  const f = fonts();
  ctx.fillStyle = t.surface2;                     // the card's thin edges map to the rest
  ctx.fillRect(0, 0, ATLAS, ATLAS);
  drawFront(ctx, FRONT, p, t, f, photo);
  drawBack(ctx, BACK, p, t, f);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.flipY = false;                              // glTF UV convention: v=0 is the image top
  tex.anisotropy = 16;
  return tex;
}

/** The woven strap: accent colour, twill, one mark per repeat (§6.8 step 8). */
export function drawBand() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  const t = tokens();

  ctx.fillStyle = t.accent;
  ctx.fillRect(0, 0, 1024, 256);
  ctx.globalAlpha = 0.14;                          // twill: fine diagonal weave
  ctx.strokeStyle = t.accentInk;
  ctx.lineWidth = 4;
  for (let x = -256; x < 1024 + 256; x += 14) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x + 256, 256);
    ctx.stroke();
  }
  ctx.globalAlpha = 0.35;                          // stitched edges
  ctx.fillStyle = t.accentInk;
  ctx.fillRect(0, 18, 1024, 6);
  ctx.fillRect(0, 232, 1024, 6);
  ctx.globalAlpha = 1;
  mark(ctx, 512 - 64, 64, 128);

  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}
