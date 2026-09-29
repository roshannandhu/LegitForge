import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { MemberCard } from '@/components/team/member-card';
import { ProjectCard } from '@/components/work/project-card';
import { getProjects } from '@/lib/work';
import type { Member } from '@/lib/team';
import { SITE, waLink } from '@/lib/site';
import { fit, personKeywords, personLd } from '@/lib/team-seo';
import { getCompany } from '@/lib/company';
import '@/components/sections/sections.css';
import '@/app/pages.css';

/** A person's page (PLAN §7.3), served at m.path: /<name handle> (app/[member]) or, when the name
 *  gives none, /team/<slug> (app/team/[slug]). */

/** Title, description and keywords from Admin → Team (name, role, skills) and Admin → Company
 *  (city): nothing to edit by hand when someone joins or changes role. */
export async function memberMetadata(m: Member): Promise<Metadata> {
  const { city } = await getCompany();
  const skills = m.skills.slice(0, 4);
  const about = `${m.name}${m.role ? `, ${m.role},` : ''} at ${SITE.name}${city ? ` in ${city}` : ''}.`
    + `${skills.length ? ` Builds with ${skills.join(', ')}.` : ''}`;
  const more = `${about} Projects, skills and how to work together.`;
  return {
    title: m.role ? `${m.name}, ${m.role}` : m.name,
    // the closing sentence only when it fits: search results cut at about 160 characters
    description: more.length <= 160 ? more : fit(about),
    keywords: [...personKeywords(m, city), ...m.skills],
    alternates: { canonical: m.path },
  };
}

export async function MemberProfile({ m }: { m: Member }) {
  const projects = (await getProjects()).filter((p) => p.study.team.some((t) => t.slug === m.slug));
  const wa = waLink(await getCompany(), `Hi, I saw ${m.name}'s portfolio on your site.`);

  return (
    <>
      <div className="wrap member-head">
        <div>
          <PageHead
            crumbs={[{ name: 'Team', href: '/team' }, { name: m.name, href: m.path }]}
            title={m.name}
            lead={m.role}
          />
          {m.bio && <p className="member-bio">{m.bio}</p>}
          <div className="page-actions">
            <a className="btn btn-primary" href={wa}>Work with {m.name}</a>
          </div>
        </div>
        <MemberCard p={{
          id: m.slug, idCode: m.idCode, name: m.name, role: m.role, initials: m.initials, photo: m.photo,
          skills: m.skills, shipped: m.shipped, favorite: m.favorite, building: m.building,
        }} />
      </div>

      <section className="page-block wrap" aria-labelledby="skills-h">
        <h2 id="skills-h" className="type-h3 block-h">Skills and tools</h2>
        <ul className="stack">{[...m.skills, ...m.tools].filter((t, i, a) => a.indexOf(t) === i).map((t) => <li key={t}>{t}</li>)}</ul>
        {m.links.length > 0 && (
          <ul className="builders member-links">
            {m.links.map((l) => <li key={l.href}><a className="text-link" href={l.href} rel="me noopener" target="_blank">{l.label}</a></li>)}
          </ul>
        )}
      </section>

      {projects.length > 0 && (
        <section className="page-block wrap" aria-labelledby="proj-h">
          <h2 id="proj-h" className="type-h3 block-h">Projects {m.name} worked on</h2>
          <ul className="work-grid">{projects.map((p) => <ProjectCard key={p.slug} p={p} />)}</ul>
        </section>
      )}

      <CtaBand title={`Work with ${m.name}`} waText={`Hi, I saw ${m.name}'s portfolio on your site.`} />

      <JsonLd data={personLd(m, true)} />
    </>
  );
}
