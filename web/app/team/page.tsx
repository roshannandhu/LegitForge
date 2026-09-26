import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { Team } from '@/components/sections/team';
import { getTeam, toCards } from '@/lib/team';
import { SITE } from '@/lib/site';
import '@/components/sections/sections.css';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Team',
  description: 'Two people, both of whom build. The person who answers your first WhatsApp message is the person writing your code.',
  alternates: { canonical: '/team' },
};

/** /team (PLAN §7.3): the lanyards, then a plain list with bios. */
export default async function TeamIndex() {
  const team = await getTeam();
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Team', href: '/team' }]}
        title="Two people. Both of us build."
        lead={`No account managers, no juniors, no handoffs. The person who answers your first WhatsApp message is the person writing your code. We take ${SITE.projectsAtATime} projects at a time, which is why we can tell you exactly what you’ll get and when.`}
      />
      <div className="page-team"><Team team={toCards(team)} head={false} /></div>

      <section className="page-block wrap" aria-labelledby="bios-h">
        <h2 id="bios-h" className="type-h3 block-h">In our own words</h2>
        <ul className="member-list">
          {team.map((m) => (
            <li key={m.slug} className="tile">
              <span className="num">{m.idCode}</span>
              <h3 className="type-h3">{m.name}</h3>
              <p className="member-role">{m.role}</p>
              <p>{m.bio}</p>
              <a className="text-link member-more" href={`/team/${m.slug}`}>Open {m.name}’s portfolio</a>
            </li>
          ))}
        </ul>
      </section>

      <CtaBand title="Talk to the people who’ll build it." />
    </>
  );
}
