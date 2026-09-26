import type { Metadata, Viewport } from 'next';
import { Archivo, Big_Shoulders_Stencil } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { MotionProvider } from '@/components/motion/motion-provider';
import { MOTION_BOOT_SCRIPT, INTRO_BOOT, CLEAVE_BOOT } from '@/lib/boot';
import { SmoothScroll } from '@/components/motion/smooth-scroll';
import { ForgeCanvas } from '@/components/background/forge-canvas';
import { Header } from '@/components/layout/header';
import { Footer } from '@/components/layout/footer';
import { SITE } from '@/lib/site';
import './globals.css';
import '@/components/layout/layout.css';

const archivo = Archivo({
  subsets: ['latin'],
  axes: ['wdth'],          // the width axis is our hammer (PLAN §4.3)
  variable: '--font-archivo',
  display: 'swap',
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
    default: 'Legit Forge — websites, apps, WhatsApp automation and n8n workflows',
    template: '%s · Legit Forge',
  },
  description:
    'A two-person studio building fast websites and web apps, quotation and warranty systems, ' +
    'WhatsApp automation and n8n workflows. Fixed quotes, weekly previews, and you own everything we make.',
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
        <script dangerouslySetInnerHTML={{ __html: MOTION_BOOT_SCRIPT + INTRO_BOOT + CLEAVE_BOOT }} />
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
