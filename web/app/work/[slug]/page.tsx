import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { ProjectCard } from '@/components/work/project-card';
import { CheckIcon, ExternalIcon } from '@/components/ui/icons';
import { PROJECTS, TEAM } from '@/lib/content';
import { CASE_STUDIES } from '@/lib/pages';
import { SITE } from '@/lib/site';
import '@/components/sections/sections.css';
import '../../pages.css';

export const dynamicParams = false;
export const generateStaticParams = () => PROJECTS.map((p) => ({ slug: p.slug }));

const find = (slug: string) => PROJECTS.find((p) => p.slug === slug);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = find((await params).slug);
  if (!p) return {};
  return {
    title: `${p.title} — case study`,
    description: `${p.title} for ${p.client}: ${p.resultValue} ${p.resultLabel}.`,
    alternates: { canonical: `/work/${p.slug}` },
  };
}

/** Case study (PLAN §7.2): header → cover → challenge → what we built → results with sources →
 *  stack → who built it → next project. */
export default async function CaseStudy({ params }: { params: Promise<{ slug: string }> }) {
  const p = find((await params).slug);
  const c = p && CASE_STUDIES[p.slug];
  if (!p || !c) notFound();
  const i = PROJECTS.indexOf(p);
  const next = PROJECTS[(i + 1) % PROJECTS.length];
  const builders = c.team.map((t) => ({ ...t, m: TEAM.find((m) => m.slug === t.slug) })).filter((b) => b.m);

  return (
    <>
      <PageHead
        crumbs={[{ name: 'Work', href: '/work' }, { name: p.title, href: `/work/${p.slug}` }]}
        title={p.title}
        lead={`${p.client}. ${p.resultValue} ${p.resultLabel}.`}
      >
        {p.liveUrl && (
          <a className="btn btn-primary" href={p.liveUrl} target="_blank" rel="noopener">
            Visit live site <ExternalIcon className="inline-icon" />
          </a>
        )}
      </PageHead>

      <div className="page-block wrap">
        <div className="case-cover" role="img" aria-label={`${p.title} cover (screenshot coming soon)`}>
          <span className="cover-grid" aria-hidden="true" />
          <span className="cover-initials" aria-hidden="true">{p.initials}</span>
          {p.stamp !== 'none' && <span className="stamp stamp-hallmark">{p.stamp === 'live' ? 'Live' : 'In use'}</span>}
        </div>
      </div>

      <section className="page-block wrap split" aria-label="The challenge and what we built">
        <div className="prose">
          <h2 className="type-h3 block-h">The challenge</h2>
          <p>{c.challenge}</p>
        </div>
        <div>
          <h2 className="type-h3 block-h">What we built</h2>
          <ul className="ticks">{c.built.map((b) => <li key={b}><CheckIcon /><span>{b}</span></li>)}</ul>
        </div>
      </section>

      <section className="page-block wrap" aria-labelledby="res-h">
        <h2 id="res-h" className="type-h3 block-h">Results</h2>
        <ul className="results">
          {c.results.map((r) => (
            <li key={r.label}>
              <span className="result-value num">{r.value}</span> {r.label}
              <span className="src">{r.source}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="page-block wrap split" aria-label="Stack and team">
        <div>
          <h2 className="type-h3 block-h">Stack</h2>
          <ul className="stack">{c.stack.map((t) => <li key={t}>{t}</li>)}</ul>
        </div>
        <div>
          <h2 className="type-h3 block-h">Who built it</h2>
          <ul className="builders">
            {builders.map((b) => (
              <li key={b.slug}>
                <a className="text-link" href={`/team/${b.slug}`}>{b.m!.name}</a>
                <span>{b.role}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {next.slug !== p.slug && (
        <section className="page-block wrap" aria-labelledby="next-h">
          <h2 id="next-h" className="type-h3 block-h">Next project</h2>
          <div className="work-grid"><ProjectCard p={next} as="div" /></div>
        </section>
      )}

      <CtaBand title="Want a result like this?" />

      <JsonLd data={{
        '@type': 'CreativeWork',
        name: p.title,
        url: `${SITE.url}/work/${p.slug}`,
        about: p.client,
        creator: { '@type': 'Organization', name: SITE.name, url: SITE.url },
        keywords: c.stack.join(', '),
      }} />
    </>
  );
}
