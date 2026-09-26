import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { ProjectCard } from '@/components/work/project-card';
import { CheckIcon, ExternalIcon } from '@/components/ui/icons';
import { TEAM } from '@/lib/content';
import { SITE } from '@/lib/site';
import type { WorkProject } from '@/lib/work';

/** Case study (PLAN §7.2): header → cover → challenge → what we built → results with sources →
 *  stack → who built it → next project. Shared by /work/[slug] and the admin's draft preview. */
export function CaseStudy({ p, next }: { p: WorkProject; next?: WorkProject }) {
  const c = p.study;
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
        {p.cover ? (
          <div className="case-cover" style={{ backgroundColor: p.cover.color ?? undefined }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- R2 image, already sized */}
            <img className="cover-img" src={p.cover.src} alt={p.cover.alt} width={p.cover.width} height={p.cover.height} />
            {p.stamp !== 'none' && <span className="stamp stamp-hallmark">{p.stamp === 'live' ? 'Live' : 'In use'}</span>}
          </div>
        ) : (
        <div className="case-cover" role="img" aria-label={`${p.title} cover (screenshot coming soon)`}>
          <span className="cover-grid" aria-hidden="true" />
          <span className="cover-initials" aria-hidden="true">{p.initials}</span>
          {p.stamp !== 'none' && <span className="stamp stamp-hallmark">{p.stamp === 'live' ? 'Live' : 'In use'}</span>}
        </div>
        )}
      </div>

      <section className="page-block wrap split" aria-label="The challenge and what we built">
        <div className="prose">
          <h2 className="type-h3 block-h">The challenge</h2>
          <p>{c.challenge}</p>
        </div>
        {c.built.length > 0 && <div>
          <h2 className="type-h3 block-h">What we built</h2>
          <ul className="ticks">{c.built.map((b) => <li key={b}><CheckIcon /><span>{b}</span></li>)}</ul>
        </div>}
      </section>

      {c.results.length > 0 && <section className="page-block wrap" aria-labelledby="res-h">
        <h2 id="res-h" className="type-h3 block-h">Results</h2>
        <ul className="results">
          {c.results.map((r) => (
            <li key={r.label}>
              <span className="result-value num">{r.value}</span> {r.label}
              <span className="src">{r.source}</span>
            </li>
          ))}
        </ul>
      </section>}

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

      {next && next.slug !== p.slug && (
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
