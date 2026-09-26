import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { MemberCard } from '@/components/team/member-card';
import { ProjectCard } from '@/components/work/project-card';
import { TEAM } from '@/lib/content';
import { getProjects } from '@/lib/work';
import { MEMBER_DETAILS } from '@/lib/pages';
import { SITE, waLink } from '@/lib/site';
import '@/components/sections/sections.css';
import '../../pages.css';

export const dynamicParams = false;
export const generateStaticParams = () => TEAM.map((m) => ({ slug: m.slug }));

const find = (slug: string) => TEAM.find((m) => m.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = find((await params).slug);
  if (!m) return {};
  return {
    title: `${m.name}, ${m.role}`,
    description: `${m.name} builds ${m.skills.join(', ')} at ${SITE.name}. Projects, skills and how to work together.`,
    alternates: { canonical: `/team/${m.slug}` },
  };
}

/** Member portfolio (PLAN §7.3). */
export default async function Member({ params }: { params: Promise<{ slug: string }> }) {
  const m = find((await params).slug);
  if (!m) notFound();
  const d = MEMBER_DETAILS[m.slug];
  const projects = (await getProjects()).filter((p) => p.study.team.some((t) => t.slug === m.slug));
  const wa = waLink(`Hi, I saw ${m.name}'s portfolio on your site.`);

  return (
    <>
      <div className="wrap member-head">
        <div>
          <PageHead
            crumbs={[{ name: 'Team', href: '/team' }, { name: m.name, href: `/team/${m.slug}` }]}
            title={m.name}
            lead={m.role}
          />
          {d?.bio && <p className="member-bio">{d.bio}</p>}
          <div className="page-actions">
            <a className="btn btn-primary" href={wa}>Work with {m.name}</a>
          </div>
        </div>
        <MemberCard p={{
          id: m.slug, idCode: m.idCode, name: m.name, role: m.role, initials: m.initials, photo: m.photo,
          skills: m.skills, shipped: m.shipped, favorite: m.favorite,
        }} />
      </div>

      <section className="page-block wrap" aria-labelledby="skills-h">
        <h2 id="skills-h" className="type-h3 block-h">Skills and tools</h2>
        <ul className="stack">{[...m.skills, ...(d?.tools ?? [])].filter((t, i, a) => a.indexOf(t) === i).map((t) => <li key={t}>{t}</li>)}</ul>
        {d && d.links.length > 0 && (
          <ul className="builders member-links">
            {d.links.map((l) => <li key={l.href}><a className="text-link" href={l.href} rel="me noopener" target="_blank">{l.label}</a></li>)}
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

      <JsonLd data={{
        '@type': 'Person',
        name: m.name,
        jobTitle: m.role,
        url: `${SITE.url}/team/${m.slug}`,
        knowsAbout: m.skills,
        worksFor: { '@type': 'Organization', name: SITE.name, url: SITE.url },
      }} />
    </>
  );
}
