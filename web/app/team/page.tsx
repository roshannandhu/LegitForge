import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { Team } from '@/components/sections/team';
import { JsonLd } from '@/components/pages/json-ld';
import { getTeam, toCards } from '@/lib/team';
import { getCompany } from '@/lib/company';
import { SITE, capacityLine } from '@/lib/site';
import { fit, joinNames, named, personKeywords, personLd } from '@/lib/team-seo';
import '@/components/sections/sections.css';
import '../pages.css';

const LINE = 'The person who answers your first WhatsApp message is the person writing your code.';

/** Names and roles from Admin → Team, so a name search finds this page too. */
export async function generateMetadata(): Promise<Metadata> {
  const [team, { city }] = await Promise.all([getTeam(), getCompany()]);
  const people = named(team);
  const names = joinNames(people.map((m) => m.name));
  return {
    // the layout adds " · Legit Forge": keep the whole title within 70 characters
    title: people.length && names.length <= 50 ? `Team: ${names}` : 'Team',
    description: people.length
      ? fit(`${people.map((m) => (m.role ? `${m.name}, ${m.role}` : m.name)).join('; ')}. ${LINE}`)
      : `Two people, both of whom build. ${LINE}`,
    keywords: [SITE.name, ...people.flatMap((m) => personKeywords(m, city))],
    alternates: { canonical: '/team' },
  };
}

/** /team (PLAN §7.3): the lanyards, then a plain list with bios. */
export default async function TeamIndex() {
  const team = await getTeam();
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Team', href: '/team' }]}
        title="Two people. Both of us build."
        lead={`No account managers, no juniors, no handoffs. The person who answers your first WhatsApp message is the person writing your code.${capacityLine()}`}
      />
      {team.length > 0 && <div className="page-team"><Team team={toCards(team)} head={false} /></div>}

      {team.length > 0 && <section className="page-block wrap" aria-labelledby="bios-h">
        <h2 id="bios-h" className="type-h3 block-h">In our own words</h2>
        <ul className="member-list">
          {team.map((m) => (
            <li key={m.slug} className="tile">
              <span className="num">{m.idCode}</span>
              <h3 className="type-h3">{m.name}</h3>
              <p className="member-role">{m.role}</p>
              <p>{m.bio}</p>
              <a className="text-link member-more" href={m.path}>Open {m.name}’s portfolio</a>
            </li>
          ))}
        </ul>
      </section>}

      <CtaBand title="Talk to the people who’ll build it." />
      {named(team).length > 0 && <JsonLd data={{
        '@type': 'ItemList',
        name: `${SITE.name} team`,
        itemListElement: named(team).map((m, i) => ({ '@type': 'ListItem', position: i + 1, item: personLd(m) })),
      }} />}
    </>
  );
}
