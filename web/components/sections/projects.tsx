import { ExternalIcon } from '@/components/ui/icons';
import { getProjects } from '@/lib/work';
import { WorkGallery, type GalleryItem } from '@/components/work/work-gallery';

/** Projects "Work that's live right now" (PLAN §6.7, plan F step 6): a React Bits Accordion
 *  Gallery. Each panel is a published project: its cover uploaded in Admin → Projects, else a
 *  blueprint panel with its initials. Hover (or tap) opens a panel over its details: result,
 *  before → after, the LIVE / IN USE stamp and the links. Every panel carries
 *  data-project-card and .project-cover, so the Cleave page transition still morphs it into
 *  the case study. /work keeps the full filterable grid. */
export async function Projects() {
  const projects = await getProjects();
  const items: GalleryItem[] = projects.map((p) => ({
    image: p.cover?.src,
    alt: p.cover?.alt,
    initials: p.initials,
    label: p.title,
    link: `/work/${p.slug}`,
    cardProps: { 'data-project-card': '' },
    content: (
      <div className="wg">
        {p.stamp !== 'none' && <span className="stamp stamp-hallmark wg-stamp">{p.stamp === 'live' ? 'Live' : 'In use'}</span>}
        <p className="wg-client">{p.client}</p>
        <h3 className="wg-title">{p.title}</h3>
        <p className="wg-result"><span className="num">{p.resultValue}</span> {p.resultLabel}</p>
        {p.before && p.after && (
          <p className="wg-proof">
            <span className="sr-only">Before: {p.before}. After: {p.after}.</span>
            <s className="num" aria-hidden="true">{p.before}</s>
            <span aria-hidden="true">→</span>
            <b className="num" aria-hidden="true">{p.after}</b>
          </p>
        )}
        <p className="wg-tags">{p.tags.join(' · ')}</p>
        <p className="wg-links">
          <a className="wg-link" href={`/work/${p.slug}`}>Read the case study<span className="sr-only">: {p.title}</span></a>
          {p.liveUrl && (
            <a className="wg-link" href={p.liveUrl} target="_blank" rel="noopener">Visit live site <ExternalIcon className="inline-icon" /></a>
          )}
        </p>
      </div>
    ),
  }));

  return (
    <section id="work" data-heat="1" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Work that’s live right now</h2>
          <p className="type-lead">Real projects, each with the number that mattered to the client.</p>
        </header>

        <WorkGallery items={items} />
        <p className="section-more"><a className="text-link" href="/work">See all projects</a></p>
      </div>
    </section>
  );
}
