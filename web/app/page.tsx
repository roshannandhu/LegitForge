import Teardown from '@/components/hero/teardown-view';
import { HeroLog } from '@/components/hero/hero-log';
import { StoryChips } from '@/components/hero/story-chips';
import { HeroStatus } from '@/components/hero/hero-status';
import { HeatDirector } from '@/components/motion/heat-director';
import { TrustStrip } from '@/components/sections/trust-strip';
import { Cleave } from '@/components/motion/cleave';
import { ToolsLoop } from '@/components/sections/tools-strip';
import { TOOL_LOGOS } from '@/components/sections/tools-logos';
import { HydrateWhenNear } from '@/components/motion/hydrate-when-near';
import { Services } from '@/components/sections/services';
import { CtaBand } from '@/components/pages/cta-band';
import { Process } from '@/components/sections/process';
import { Projects } from '@/components/sections/projects';
import { Team } from '@/components/sections/team';
import { Hallmarks } from '@/components/sections/hallmarks';
import { PricingFaq } from '@/components/sections/pricing-faq';
import { Quench } from '@/components/sections/quench';
import { HallmarkStrike } from '@/components/intro/hallmark-strike';
import { HOME_SERVICES, PROCESS } from '@/lib/content';
import type { Metadata } from 'next';
import { getTeam, toCards, type Member } from '@/lib/team';
import { cityNames, fit, joinNames, named, personLd, servedCities, siteKeywords } from '@/lib/team-seo';
import { getProjects } from '@/lib/work';
import { ORG_ID, SITE, activeSocial, shownEmail, waLink, type Company } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { LAYERS } from '@/lib/teardown';
import '@/components/hero/hero.css';
import '@/components/sections/sections.css';
import './pages.css';

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
/** The site, the studio, and the five systems the hero takes apart (PLAN §10.4, SEO plan B). */
const siteLd = [
  { '@context': 'https://schema.org', '@type': 'WebSite', name: SITE.name, url: SITE.url, inLanguage: 'en-IN', publisher: { '@id': ORG_ID } },
  {
    '@context': 'https://schema.org', '@type': 'ItemList', name: 'Services',
    itemListElement: HOME_SERVICES.map((s, i) => ({
      '@type': 'ListItem', position: i + 1, name: s.name, description: s.line,
      url: `${SITE.url}${s.href}`,
    })),
  },
];

/** The studio in structured data, from the saved company details (Admin → Company) and the
 *  people in Admin → Team, so search engines connect each name to the studio. */
const orgLd = (c: Company, team: Member[]) => ({
  '@context': 'https://schema.org',
  '@type': 'ProfessionalService',
  '@id': ORG_ID,
  logo: `${SITE.url}/icon.svg`,
  image: `${SITE.url}/opengraph-image`,
  name: SITE.name,
  url: SITE.url,
  ...(shownEmail(c) ? { email: shownEmail(c) } : {}),
  description:
    'A two-person studio building websites, web apps, quotation and warranty systems, WhatsApp automation and n8n workflows, and running MR Signage, its digital signage app sold by subscription.',
  areaServed: servedCities(c.city),
  ...(c.city || c.country ? { address: { '@type': 'PostalAddress',
    ...(c.city ? { addressLocality: c.city } : {}), ...(c.country ? { addressCountry: c.country } : {}) } } : {}),
  ...(c.whatsapp ? { telephone: `+${c.whatsapp}` } : {}),
  ...(activeSocial(c).length ? { sameAs: activeSocial(c).map((s) => s.url) } : {}),
  ...(named(team).length ? { employee: named(team).map((m) => personLd(m)) } : {}),
  openingHoursSpecification: {
    '@type': 'OpeningHoursSpecification',
    dayOfWeek: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    opens: `${String(SITE.hours.from).padStart(2, '0')}:00`,
    closes: `${String(SITE.hours.to).padStart(2, '0')}:00`,
  },
  hasOfferCatalog: {
    '@type': 'OfferCatalog',
    name: 'Services',
    itemListElement: HOME_SERVICES.map((s) => ({ '@type': 'Offer', itemOffered: { '@type': 'Service', name: s.name, description: s.line } })),
  },
});

/** The title and description name where we work: the city in Admin → Company, with its other
 *  name, and SITE.alsoServes ("…freelance web developers in Calicut and Bangalore"). Keywords
 *  follow Admin → Team and Company. */
export async function generateMetadata(): Promise<Metadata> {
  const [team, { city }] = await Promise.all([getTeam(), getCompany()]);
  const cities = servedCities(city);
  // "Calicut (Kozhikode) and Bangalore (Bengaluru)": each city with the other name people search
  const where = joinNames(cities.map((c) => { const [, also] = cityNames(c); return also && !/^(Kerala|Karnataka)$/.test(also) ? `${c} (${also})` : c; }));
  const about = `Freelance web developers in ${where}: websites, web apps, WhatsApp and AI automation and local SEO for small businesses.`;
  const more = `${about} Fixed quotes; you own it.`;
  const title = `${SITE.name}: freelance web developers in ${joinNames(cities)}`;
  return {
    ...(cities.length ? {
      title: { absolute: title.length <= 70 ? title : `${SITE.name}: freelance web developers in ${cities[0]}` },
      description: more.length <= 160 ? more : fit(about),
    } : {}),
    keywords: siteKeywords(team, city),
  };
}

export default async function Home() {
  const [members, projects, company] = await Promise.all([getTeam(), getProjects(), getCompany()]);
  const team = toCards(members);
  const hasWork = projects.length > 0;
  const wa = waLink(company);
  return (
    <>
      <HallmarkStrike />
      <section className="hero" id="top" data-heat="0.35">
        <div className="wrap hero-grid">
          <div className="copy">
            <h1 className="type-display">We build the thing, and everything behind it.</h1>
            <p className="lead">
              Websites, apps, WhatsApp automation and the systems that run them.
              A two-person studio. See our work, or tell us what you need.
            </p>
            <div className="ctas">
              <a className="btn btn-primary" href={wa}>Chat on WhatsApp</a>
              {hasWork
                ? <a className="btn btn-ghost" href="#work">See our work</a>
                : <a className="btn btn-ghost" href="#services">See what we offer</a>}
            </div>
            <p className="hero-enquiry"><a className="text-link" href="#contact">Prefer a form? Send an enquiry</a></p>
            <HeroStatus />
          </div>
          <StoryChips />
          <Teardown />
          <HeroLog />
        </div>
        <div className="sr-only">
          <p>
            Illustrative customer journey: the phone in the hand comes apart into seven layers. One customer’s
            request runs through each in turn, top to bottom:
          </p>
          <ol>
            {LAYERS.map((l, i) => <li key={l.id}>{l.name} ({l.spec}): {HERO_JOURNEY[i]}</li>)}
          </ol>
        </div>
      </section>

      <Cleave pin={false} cover={<div className="plate-steel"><p className="type-h2">What you can count on.<span>Scroll to open it up</span></p></div>}>
        <TrustStrip compact />
      </Cleave>
      <Projects />
      <Hallmarks testimonialsOnly />
      <Services />
      <HydrateWhenNear><Quench /></HydrateWhenNear>
      <Process steps={PROCESS} />
      <PricingFaq compact />
      {team.length > 0 && <HydrateWhenNear><Team team={team} /></HydrateWhenNear>}
      <section className="tools" data-heat="0.9" aria-labelledby="tools-h">
        <div className="wrap"><h2 id="tools-h" className="tools-h">The tools behind every build</h2></div>
        <HydrateWhenNear><ToolsLoop logos={TOOL_LOGOS} /></HydrateWhenNear>
      </section>
      <CtaBand title="Tell us what you want to build." text="Describe the problem. We’ll suggest a scope and put the quote in writing." />

      <HeatDirector />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([orgLd(company, members), ...siteLd]).replace(/</g, '\\u003c') }}
      />
    </>
  );
}
