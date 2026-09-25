import { ProjectCard } from '@/components/work/project-card';
import { PROJECTS } from '@/lib/content';
import { ProjectTrack } from '@/components/work/project-track';

/** Projects "Forged work" (PLAN §6.7). Every card carries a number (§4). Up to three cards
 *  are a grid on desktop; four or more become a sideways track the section pins to scroll
 *  (ProjectTrack). */
export function Projects() {
  return (
    <section id="work" data-heat="1" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Work that’s live right now</h2>
          <p className="type-lead">Real projects, each with the number that mattered to the client.</p>
        </header>

        <ul className="projects" aria-label="Projects" data-track={PROJECTS.length > 3 ? '' : undefined}>
          {PROJECTS.map((p) => <ProjectCard key={p.slug} p={p} />)}
        </ul>
        <p className="swipe-hint" aria-hidden="true">Swipe to see more</p>
        <p className="section-more"><a className="text-link" href="/work">See all projects</a></p>
      </div>
      <ProjectTrack />
    </section>
  );
}
