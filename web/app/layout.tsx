import type { Metadata, Viewport } from 'next';
import { Big_Shoulders_Stencil } from 'next/font/google';
import localFont from 'next/font/local';
import { ThemeProvider } from 'next-themes';
import { PAGE_BG } from '@/lib/theme-colors';
import { MotionProvider } from '@/components/motion/motion-provider';
import { MOTION_BOOT_SCRIPT, LITE_BOOT, INTRO_BOOT, CLEAVE_BOOT, THEME_BOOT, CV_BOOT } from '@/lib/boot';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ForgeCanvas } from '@/components/background/forge-canvas';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { NOINDEX, SITE, shownEmail } from '@/lib/site';
import { Analytics } from '@/components/analytics';
import { getCompany } from '@/lib/company';
import { CompanyProvider } from '@/components/company-context';
import './globals.css';
import '@/components/layout/layout.css';

/** Anybody, variable in weight (400–900) and width (88–112 %, our hammer: PLAN §4.3; it replaced
 *  Archivo on 2026-09-29, the owner's call for a less common face). Self-hosted as ONE subset
 *  file (app/fonts/anybody-latin.woff2, 44 KB, only the axis ranges we use: ASCII, Latin-1, the site's punctuation and ₹)
 *  instead of Google's latin + latin-ext files, so it arrives in time for the first layout far
 *  more often, which spares a budget phone a full re-layout on swap.
 *  Regenerate it when copy gains a new symbol: web/README.md "Fonts". */
const sans = localFont({
  src: './fonts/anybody-latin.woff2',
  weight: '400 900',
  style: 'normal',
  variable: '--font-body',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Arial',
  declarations: [{ prop: 'font-stretch', value: '88% 112%' }],
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
    <html lang="en" className={`${sans.variable} ${stencil.variable}`} suppressHydrationWarning>
      <head>
        {/* sets html[data-motion] before first paint so motion-off visitors never see a flash (§5.5) */}
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT + MOTION_BOOT_SCRIPT + LITE_BOOT + INTRO_BOOT + CLEAVE_BOOT + CV_BOOT }} />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <MotionProvider>
            <CompanyProvider value={{ whatsapp: company.whatsapp, whatsappText: company.whatsappText, contactEmail: shownEmail(company) }}>
              <Analytics />
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
