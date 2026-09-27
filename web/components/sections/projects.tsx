import { getHomeProjects } from '@/lib/work';
import { WorkGallery, type GalleryItem } from '@/components/work/work-gallery';

/** Projects "Work that's live right now" (PLAN §6.7, plan P): the React Bits AccordionGallery
 *  (WorkGallery). The owner picks the projects in Admin → Projects (★ "Show on the home page", in
 *  admin order); with none starred it shows every published project. Each panel is the project's
 *  screenshot (else a blueprint with its initials); the open one shows a brief description, and
 *  the panel opens the case study (a click; on touch, a tap on the open panel). Every panel
 *  carries data-project-card and .project-cover, so the Cleave page transition still morphs it.
 *  /work keeps the full filterable grid with results and tags. */
export async function Projects() {
  const { projects, total } = await getHomeProjects();
  if (!projects.length) return null;                 // nothing published yet: no section
  const items: GalleryItem[] = projects.map((p) => ({
    image: p.cover?.src,
    alt: p.cover?.alt,
    initials: p.initials,
    label: p.title,
    sublabel: p.client,
    link: `/work/${p.slug}`,
    linkLabel: `${p.title}: view project`,
    cardProps: { 'data-project-card': '' },
    content: (
      <div className="wg">
        <p className="wg-client">{p.client}</p>
        <h3 className="wg-title">{p.title}</h3>
        {p.study.challenge && <p className="wg-brief">{p.study.challenge}</p>}
        <span className="wg-cta" aria-hidden="true">View project →</span>
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
        <p className="section-more"><a className="text-link" href="/work">See all {total === 1 ? 'the project' : `${total} projects`}</a></p>
      </div>
    </section>
  );
}
