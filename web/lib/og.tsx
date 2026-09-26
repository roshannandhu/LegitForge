/** Share images (PLAN §22.4 step 1): one 1200 × 630 card design for every page type.
 *  Forge Night tokens (app/globals.css, .dark) on the blueprint grid, the coin seal (CoinMark
 *  in components/ui/icons.tsx, drawn in boxes: Satori has no curved text, so the rim is
 *  reeded like app/icon.svg), a label, the title and the domain.
 *
 *  Every route that uses this is static, so the font files are read at build time only; the
 *  Worker never renders an image. Archivo is OFL (assets/og/OFL.txt). */

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SITE } from './site';

export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const T = {
  bg: '#151A20', surface: '#1D242C', line: '#33404C', text: '#EDE6DA', muted: '#9AA3AB',
  lo: '#C8321E', mid: '#F0701E', hi: '#FFC24A',
  grid: 'rgba(51,64,76,.6)',    // --line at the site's grid strength
};
const GOLD = 'radial-gradient(circle at 38% 32%, #FFE9A8 0%, #E3B452 45%, #A87424 100%)';
const STEEL = 'linear-gradient(135deg, #5C6B7A 0%, #2E3945 50%, #1A222B 100%)';

let fonts: Promise<{ name: string; data: Buffer; weight: 600 | 800; style: 'normal' }[]> | undefined;
function loadFonts() {
  const dir = join(process.cwd(), 'assets/og');
  return (fonts ??= Promise.all([
    readFile(join(dir, 'Archivo-SemiExpanded-ExtraBold.ttf')).then((data) => ({ name: 'Archivo', data, weight: 800 as const, style: 'normal' as const })),
    readFile(join(dir, 'Archivo-SemiExpanded-SemiBold.ttf')).then((data) => ({ name: 'Archivo', data, weight: 600 as const, style: 'normal' as const })),
  ]));
}

function Seal({ d }: { d: number }) {
  const ring = d * 0.917, centre = d * 0.68;
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: d, height: d, borderRadius: d, backgroundImage: GOLD, boxShadow: '0 12px 32px rgba(0,0,0,.45)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: ring, height: ring, borderRadius: ring, backgroundImage: STEEL }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: d * 0.8, height: d * 0.8, borderRadius: d, border: `${Math.round(d * 0.035)}px dashed rgba(201,210,219,.6)` }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: centre, height: centre, borderRadius: centre, backgroundImage: GOLD, border: '2px solid #7A5418', color: '#6E4A12', fontSize: d * 0.135, fontWeight: 800, lineHeight: 1.05 }}>
            <span>LEGIT</span>
            <span>FORGE</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/** label: "Service", "Case study", "Blog", or empty for the site card. */
export async function ogImage({ label, title }: { label?: string; title: string }) {
  const titleSize = title.length > 70 ? 56 : title.length > 44 ? 66 : 78;
  const domain = SITE.url.replace(/^https?:\/\//, '');
  return new ImageResponse(
    (
      <div style={{
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: '100%', height: '100%',
        padding: '64px 72px', backgroundColor: T.bg, color: T.text, fontFamily: 'Archivo',
        backgroundImage: `linear-gradient(${T.grid} 1px, transparent 1px), linear-gradient(90deg, ${T.grid} 1px, transparent 1px)`,
        backgroundSize: '32px 32px',
      }}>
        {/* the heat along the top edge */}
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 8, display: 'flex', backgroundImage: `linear-gradient(90deg, ${T.lo}, ${T.mid} 55%, ${T.hi})` }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <Seal d={84} />
          <span style={{ fontSize: 40, fontWeight: 800 }}>Legit Forge</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24, maxWidth: 1000 }}>
          {label && (
            <div style={{ display: 'flex' }}>
              <span style={{ padding: '8px 20px', border: `2px solid ${T.mid}`, borderRadius: 999, color: T.hi, fontSize: 26, fontWeight: 600, backgroundColor: 'rgba(21,26,32,.85)' }}>{label}</span>
            </div>
          )}
          <div style={{ display: 'flex', fontSize: titleSize, fontWeight: 800, lineHeight: 1.08, letterSpacing: -1 }}>{title}</div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 26, fontWeight: 600, color: T.muted }}>
          <span>Websites · WhatsApp automation · n8n workflows</span>
          <span style={{ color: T.text }}>{domain}</span>
        </div>
      </div>
    ),
    { ...size, fonts: await loadFonts() },
  );
}
