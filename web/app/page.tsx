import Teardown from '@/components/hero/teardown-view';
import { HeroLog } from '@/components/hero/hero-log';
import { StoryChips } from '@/components/hero/story-chips';
import { HeroStatus } from '@/components/hero/hero-status';
import { HeatDirector } from '@/components/motion/heat-director';
import { TrustStrip } from '@/components/sections/trust-strip';
import { Cleave } from '@/components/motion/cleave';
import { HydrateWhenNear } from '@/components/motion/hydrate-when-near';
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
import { HallmarkStrike } from '@/components/intro/hallmark-strike';
import { PROCESS, SERVICES } from '@/lib/content';
import { getTeam, toCards } from '@/lib/team';
import { ORG_ID, SITE, waLink } from '@/lib/site';
import { LAYERS } from '@/lib/teardown';
import '@/components/hero/hero.css';
import '@/components/sections/sections.css';

/** What happens at each hero layer, in the words the teardown's screens show (lib/teardown.ts). */
const HERO_JOURNEY = [
  'Priya searches Google for “ac installation kochi” and CoolAir is the top result.',
  'she asks for an AC installation quote on the business website.',
  'the WhatsApp bot replies in seconds and asks her room size.',
  'n8n prices the job and makes the PDF, with no copy-paste.',
  'she opens quote Q-2041 for ₹45,800 and accepts it.',
  'her warranty is issued, checkable by QR code and valid to 2027, with a WhatsApp reminder set.',
  'months later she taps the NFC tag on her AC: her warranty opens and she books a service.',
];
const SERVICE_URL: Record<string, string> = {
  seo: '/services/seo', web: '/services/website-development', wa: '/services/whatsapp-automation',
  n8n: '/services/n8n-automation', nfc: '/services/nfc',
};

/** The site, the studio, and the five systems the hero takes apart (PLAN §10.4, SEO plan B). */
const siteLd = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, inLanguage: 'en-IN', publisher: { '@id': ORG_ID } },
  {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'What we build, layer by layer',
    itemListElement: LAYERS.map((l, i) => ({
      '@type': 'ListItem', position: i + 1, name: l.name, description: `${l.spec}. ${HERO_JOURNEY[i]}`,
      ...(SERVICE_URL[l.id] ? { url: `${SITE.url}${SERVICE_URL[l.id]}` } : {}),
    })),
  },
];

/** Organization + the services we sell, for search engines and AI answers (PLAN §10.4). */
const orgLd = {
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': ORG_ID,
  logo: `${SITE.url}/icon.svg`,
  image: `${SITE.url}/opengraph-image`,
  name: SITE.name,
  url: SITE.url,
  email: SITE.email,
  description:
    'A two-person studio building websites, web apps, quotation and warranty systems, WhatsApp automation and n8n workflows.',
  areaServed: SITE.city,
  address: { '@type': 'PostalAddress', addressLocality: SITE.city, addressCountry: SITE.country },
  ...(SITE.whatsappNumber ? { telephone: `+${SITE.whatsappNumber}` } : {}),
  ...(() => { const same = Object.values(SITE.social).filter(Boolean); return same.length ? { sameAs: same } : {}; })(),
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

export default async function Home() {
  const team = toCards(await getTeam());
  const wa = waLink();
  return (
    <>
      <HallmarkStrike />
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
          <StoryChips />
          <Teardown />
          <HeroLog />
        </div>
        <div className="sr-only">
          <p>
            Diagram: the phone in the hand comes apart into seven working layers. One customer’s
            request runs through each in turn, top to bottom:
          </p>
          <ol>
            {LAYERS.map((l, i) => <li key={l.id}>{l.name} ({l.spec}): {HERO_JOURNEY[i]}</li>)}
          </ol>
        </div>
      </section>

      <Cleave cover={<div className="plate-steel"><p className="type-display">Now, everything behind it.<span>Scroll to open it up</span></p></div>}>
        <TrustStrip />
      </Cleave>
      <Services />
      <Quotation />
      <HydrateWhenNear>
      <Compare facts={{
        static: { price: SERVICES[0].price, time: SERVICES[0].time },
        dynamic: { price: SERVICES[1].price, time: SERVICES[1].time },
      }} />
      </HydrateWhenNear>
      <HydrateWhenNear><LiveTest /></HydrateWhenNear>
      <Process steps={PROCESS} />
      <Projects />
      <HydrateWhenNear><Team team={team} /></HydrateWhenNear>
      <Hallmarks />
      <PricingFaq />
      <HydrateWhenNear><Quench /></HydrateWhenNear>

      <HeatDirector />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([orgLd, ...siteLd]).replace(/</g, '\\u003c') }}
      />
    </>
  );
}
