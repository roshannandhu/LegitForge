import { ExternalIcon } from '@/components/ui/icons';
import { getHomeProjects } from '@/lib/work';
import { ProjectRail } from '@/components/work/project-rail';

/** Projects "Work that's live right now" (PLAN §6.7, plan N): the rail of portrait project cards
 *  (ProjectRail). The owner picks them in Admin → Projects (★ "Show on the home page", in admin
 *  order); with none starred it shows every published project. Each card is the project's
 *  screenshot (else a blueprint with its initials); pointing at it, or it reaching the middle,
 *  shows the heat gradient and the details, and the whole card opens the case study. Every card
 *  carries data-project-card and .project-cover, so the Cleave page transition still morphs it.
 *  The rail ends on "See all N projects". /work keeps the full filterable grid. */
export async function Projects() {
  const { projects, total } = await getHomeProjects();

  return (
    <section id="work" data-heat="1" className="section">
      <ProjectRail
        count={projects.length}
        head={(
          <div className="wrap">
            <header className="section-head">
              <h2 className="type-h2">Work that’s live right now</h2>
              <p className="type-lead">Real projects, each with the number that mattered to the client.</p>
            </header>
          </div>
        )}
      >
        {projects.map((p, i) => (
          <li key={p.slug} className="rail-card" data-project-card="" style={{ '--i': i } as React.CSSProperties}>
            <a className="rail-link" href={`/work/${p.slug}`}>
              <span className="rail-cover project-cover">
                {p.cover ? (
                  // eslint-disable-next-line @next/next/no-img-element -- uploaded covers, already sized
                  <img src={p.cover.src} alt={p.cover.alt} width={p.cover.width} height={p.cover.height} loading="lazy" decoding="async"
                    style={{ backgroundColor: p.cover.color ?? undefined }} />
                ) : (
                  <span className="rail-blueprint" aria-hidden="true"><span>{p.initials}</span></span>
                )}
              </span>
              <span className="rail-shade" aria-hidden="true" />
              <span className="rail-num num" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span>
              {p.stamp !== 'none' && <span className="stamp stamp-hallmark rail-stamp">{p.stamp === 'live' ? 'Live' : 'In use'}</span>}
              <span className="rail-info">
                <span className="rail-client">{p.client}</span>
                <span className="rail-title">{p.title}</span>
                <span className="rail-more">
                  {p.resultValue && <span className="rail-result"><b className="num">{p.resultValue}</b> {p.resultLabel}</span>}
                  {p.before && p.after && (
                    <span className="rail-proof">
                      <span className="sr-only">Before: {p.before}. After: {p.after}.</span>
                      <s className="num" aria-hidden="true">{p.before}</s> <span aria-hidden="true">→</span> <b className="num" aria-hidden="true">{p.after}</b>
                    </span>
                  )}
                  {p.tags.length > 0 && <span className="rail-tags">{p.tags.join(' · ')}</span>}
                  <span className="rail-cta">Read the case study →</span>
                </span>
              </span>
            </a>
            {p.liveUrl && (
              <a className="rail-live" href={p.liveUrl} target="_blank" rel="noopener">Live site <ExternalIcon className="inline-icon" /><span className="sr-only">: {p.title}</span></a>
            )}
          </li>
        ))}
        <li className="rail-card rail-all">
          <a className="rail-link" href="/work">
            <span className="rail-all-n num">{total}</span>
            <span className="rail-all-t">See all {total === 1 ? 'the project' : `${total} projects`} →</span>
            <span className="rail-all-s">Every build, filterable by what we made.</span>
          </a>
        </li>
      </ProjectRail>
    </section>
  );
}
