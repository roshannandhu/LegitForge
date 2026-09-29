import type { Metadata, Viewport } from 'next';
import { Big_Shoulders_Stencil } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { PAGE_BG } from '@/lib/theme-colors';
import { MotionProvider } from '@/components/motion/motion-provider';
import { MOTION_BOOT_SCRIPT, LITE_BOOT, INTRO_BOOT, CLEAVE_BOOT, THEME_BOOT } from '@/lib/boot';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ForgeCanvas } from '@/components/background/forge-canvas';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { NOINDEX, SITE } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { CompanyProvider } from '@/components/company-context';
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
  ...(NOINDEX ? { robots: { index: false, follow: false } } : {}),
  /** Google Search Console ownership, HTML-tag method. Remove only after DNS verification replaces it. */
  verification: { google: 'qi4K3Bou7813zfme8K7qm-YjQyajIA5nFwSOySDQLJY' },
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
    { media: '(prefers-color-scheme: dark)', color: PAGE_BG.dark },
    { media: '(prefers-color-scheme: light)', color: PAGE_BG.light },
  ],
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Admin → Company: read once here, so every page carries the 'company' tag and re-renders
  // when the details are saved; client components get them from the provider
  const company = await getCompany();
  return (
    <html lang="en" className={`${archivo.variable} ${stencil.variable}`} suppressHydrationWarning>
      <head>
        {/* sets html[data-motion] before first paint so motion-off visitors never see a flash (§5.5) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT + MOTION_BOOT_SCRIPT + LITE_BOOT + INTRO_BOOT + CLEAVE_BOOT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionProvider>
            <CompanyProvider value={{ whatsapp: company.whatsapp, whatsappText: company.whatsappText }}>
              <SmoothScroll />
              <ForgeCanvas />
              <Header />
              <main id="main">{children}</main>
              <Footer company={company} />
              <div className="vt-seam" aria-hidden="true" />
            </CompanyProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
