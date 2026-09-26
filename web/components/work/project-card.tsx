import { ExternalIcon } from '@/components/ui/icons';
import type { PROJECTS } from '@/lib/content';

/** An uploaded cover (admin, §7.8): served from R2 by app/media, sized so the card never shifts. */
export type Cover = { src: string; alt: string; width: number; height: number; color: string | null };
export type Project = (typeof PROJECTS)[number] & { cover?: Cover };

/** One project card (PLAN §6.7), shared by the home track, /work and the case-study footer.
 *  Covers keep a fixed 4:5 ratio (no CLS): the uploaded image over its dominant colour, or a
 *  blueprint placeholder with the project's initials — never a broken image. Stamps are honest status, set daily by n8n (§9.7). */
export function ProjectCard({ p, as: Tag = 'li', headingLevel = 3 }: {
  p: Project; as?: 'li' | 'div'; headingLevel?: 2 | 3;
}) {
  const H = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <Tag className="project" data-project-card>
      <div className="project-cover">
        {p.cover ? (
          // eslint-disable-next-line @next/next/no-img-element -- R2 image, already sized; next/image has no loader on Workers here
          <img className="cover-img" src={p.cover.src} alt={p.cover.alt} width={p.cover.width} height={p.cover.height}
            loading="lazy" decoding="async" style={{ backgroundColor: p.cover.color ?? undefined }} />
        ) : (
          <>
            <span className="cover-grid" aria-hidden="true" />
            <span className="cover-initials" aria-hidden="true">{p.initials}</span>
          </>
        )}
        {p.stamp !== 'none' && (
          <span className="stamp stamp-hallmark" data-stamp>{p.stamp === 'live' ? 'Live' : 'In use'}</span>
        )}
      </div>
      <div className="project-body">
        <H className="project-title">{p.title}</H>
        <p className="project-client">{p.client}</p>
        <p className="project-result"><span className="result-value num">{p.resultValue}</span> {p.resultLabel}</p>
        <ul className="project-tags" aria-label="Services">
          {p.tags.map((t) => <li key={t}>{t}</li>)}
        </ul>
        <div className="project-links">
          <a className="text-link" href={`/work/${p.slug}`}>
            Read the case study<span className="sr-only">: {p.title}</span>
          </a>
          {p.liveUrl && (
            <a className="text-link" href={p.liveUrl} target="_blank" rel="noopener">
              Visit live site <ExternalIcon className="inline-icon" />
            </a>
          )}
        </div>
      </div>
    </Tag>
  );
}
