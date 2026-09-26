import type { Metadata, Viewport } from 'next';
import { Big_Shoulders_Stencil } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { MotionProvider } from '@/components/motion/motion-provider';
import { MOTION_BOOT_SCRIPT, LITE_BOOT, INTRO_BOOT, CLEAVE_BOOT, THEME_BOOT } from '@/lib/boot';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ForgeCanvas } from '@/components/background/forge-canvas';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SITE } from '@/lib/site';
import './globals.css';
import '@/components/layout/layout.css';

/** Archivo, variable in weight (100–900) and width (62–125 %, our hammer: PLAN §4.3). Self-hosted
 *  as ONE subset file (app/fonts/archivo-latin.woff2, 80 KB: ASCII, Latin-1, the site's
 *  punctuation and ₹) instead of Google's two latin + latin-ext files (176 KB). Same glyphs,
 *  same axes, same kerning and figures, so it looks identical; it simply arrives in time for
 *  the first layout far more often, which spares a budget phone a full re-layout on swap.
 *  Regenerate it when copy gains a new symbol: web/README.md "Fonts". */
const archivo = localFont({
  src: './fonts/archivo-latin.woff2',
  weight: '100 900',
  style: 'normal',
  variable: '--font-archivo',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '62% 125%' }],
});

/** The one stamp face: only inside hallmark stamps and ID codes (§4.3). Not preloaded —
 *  stamps sit below the fold and must never compete with the LCP. */
const stencil = Big_Shoulders_Stencil({
  subsets: ['latin'],
  weight: '700',
  variable: '--font-stencil',
  display: 'swap',
  preload: false,
  // next/font has no metrics to size-adjust this face; stamps are small and mostly
  // absolutely positioned, so a plain fallback is safe.
  adjustFontFallback: false,
  fallback: ['system-ui', 'sans-serif'],
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: 'Legit Forge: websites, apps and WhatsApp automation',
    template: '%s · Legit Forge',
  },
  description:
    'Two-person studio building fast websites, web apps, quotation and warranty systems, ' +
    'WhatsApp automation and n8n workflows. Fixed quotes; you own everything.',
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    siteName: SITE.name,
    locale: 'en_IN',
    url: '/',
  },
  twitter: { card: 'summary_large_image' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#151A20' },
    { media: '(prefers-color-scheme: light)', color: '#E8ECEF' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${archivo.variable} ${stencil.variable}`} suppressHydrationWarning>
      <head>
        {/* sets html[data-motion] before first paint so motion-off visitors never see a flash (§5.5) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT + MOTION_BOOT_SCRIPT + LITE_BOOT + INTRO_BOOT + CLEAVE_BOOT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <MotionProvider>
            <SmoothScroll />
            <ForgeCanvas />
            <Header />
            <main id="main">{children}</main>
            <Footer />
            <div className="vt-seam" aria-hidden="true" />
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
