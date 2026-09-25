import { ExternalIcon } from '@/components/ui/icons';
import { PROJECTS } from '@/lib/content';

/** Projects "Forged work" (PLAN §6.7). Every card carries a number (§4). Covers keep a
 *  fixed 4:5 ratio (no CLS) and fall back to a blueprint placeholder with the project's
 *  initials — never a broken image. Stamps are honest status, set daily by n8n (§9.7). */
export function Projects() {
  return (
    <section id="work" data-heat="1" className="section">
      <div className="wrap">
        <header className="section-head">
          <h2 className="type-h2">Work that’s live right now</h2>
          <p className="type-lead">Real projects, each with the number that mattered to the client.</p>
        </header>

        <ul className="projects" aria-label="Projects">
          {PROJECTS.map((p) => (
            <li key={p.slug} className="project">
              <div className="project-cover">
                <span className="cover-grid" aria-hidden="true" />
                <span className="cover-initials" aria-hidden="true">{p.initials}</span>
                {p.stamp !== 'none' && (
                  <span className="stamp stamp-hallmark">{p.stamp === 'live' ? 'Live' : 'In use'}</span>
                )}
              </div>
              <div className="project-body">
                <h3 className="project-title">{p.title}</h3>
                <p className="project-client">{p.client}</p>
                <p className="project-result"><span className="result-value num">{p.resultValue}</span> {p.resultLabel}</p>
                <ul className="project-tags" aria-label="Services">
                  {p.tags.map((t) => <li key={t}>{t}</li>)}
                </ul>
                {p.liveUrl && (
                  <a className="text-link project-live" href={p.liveUrl} target="_blank" rel="noopener">
                    Visit live site <ExternalIcon className="inline-icon" />
                  </a>
                )}
              </div>
            </li>
          ))}
        </ul>
        <p className="swipe-hint" aria-hidden="true">Swipe to see more</p>
      </div>
    </section>
  );
}
