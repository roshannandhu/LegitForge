import Machine from '@/components/hero/machine';
import { HeroStatus } from '@/components/hero/hero-status';
import { HeatDirector } from '@/components/motion/heat-director';
import { Services } from '@/components/sections/services';
import { Quotation } from '@/components/sections/quotation';
import { Compare } from '@/components/sections/compare';
import { LiveTest } from '@/components/sections/live-test';
import { Process } from '@/components/sections/process';
import { Projects } from '@/components/sections/projects';
import { Team } from '@/components/sections/team';
import { Hallmarks } from '@/components/sections/hallmarks';
import { PricingFaq } from '@/components/sections/pricing-faq';
import { Quench } from '@/components/sections/quench';
import { SERVICES } from '@/lib/content';
import { SITE, waLink } from '@/lib/site';
import '@/components/hero/hero.css';
import '@/components/sections/sections.css';

/** Organization + the services we sell, for search engines and AI answers (PLAN §10.4). */
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  name: SITE.name,
  url: SITE.url,
  email: SITE.email,
  description:
    'A two-person studio building websites, web apps, quotation and warranty systems, WhatsApp automation and n8n workflows.',
  areaServed: SITE.city,
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: `${String(SITE.hours.from).padStart(2, '0')}:00`,
    closes: `${String(SITE.hours.to).padStart(2, '0')}:00`,
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services',
    itemListElement: [
      ...SERVICES.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.line } })),
      { '@type': 'Offer', itemOffered: { '@type': 'Service', name: 'Quotation and warranty system',
        description: 'Quotes sent as links or PDFs, and warranty records customers can check by QR code.' } },
    ],
  },
};

export default function Home() {
  const wa = waLink();
  return (
    <>
      <section className="hero" id="top" data-heat="0.35">
        <div className="wrap hero-grid">
          <div className="copy">
            <h1 className="type-display">We build the thing, and everything behind it.</h1>
            <p className="lead">
              Websites, apps, WhatsApp automation and the systems that run them.
              A two-person studio. Scroll and watch what we actually build.
            </p>
            <div className="ctas">
              <a className="btn btn-primary" href={wa}>Chat on WhatsApp</a>
              <a className="btn btn-ghost" href="#work">See our work</a>
            </div>
            <HeroStatus />
          </div>
          <Machine />
        </div>
        <p className="sr-only">
          Diagram: a phone opening into the systems we build — website, app, API, database,
          automation, WhatsApp and AI — then closing again.
        </p>
      </section>

      <Services />
      <Quotation />
      <Compare />
      <LiveTest />
      <Process />
      <Projects />
      <Team />
      <Hallmarks />
      <PricingFaq />
      <Quench />

      <HeatDirector />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd).replace(/</g, '\\u003c') }}
      />
    </>
  );
}
