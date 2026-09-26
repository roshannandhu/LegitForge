'use client';

/** /work filter (PLAN §7.2). The server renders every project; chips only hide cards in the
 *  browser and mirror the choice in ?service=, so the page stays static and fully crawlable. */

import { useEffect, useState } from 'react';
import { ProjectCard, type Project } from './project-card';
import type { WorkCategory } from '@/lib/pages';

type Filter = 'all' | WorkCategory;
type Item = Project & { category: WorkCategory };

export function WorkGrid({ items, filters, waHref }: {
  items: Item[]; filters: { id: Filter; label: string }[]; waHref: string;
}) {
  const [f, setF] = useState<Filter>('all');

  useEffect(() => {
    const q = new URLSearchParams(location.search).get('service');
    if (q && filters.some((x) => x.id === q)) setF(q as Filter);
  }, [filters]);

  const choose = (id: Filter) => {
    setF(id);
    const url = new URL(location.href);
    if (id === 'all') url.searchParams.delete('service'); else url.searchParams.set('service', id);
    history.replaceState(null, '', url);
  };

  const shown = f === 'all' ? items : items.filter((p) => p.category === f);
  const label = filters.find((x) => x.id === f)?.label ?? '';

  return (
    <>
      <ul className="chips" aria-label="Filter projects by service">
        {filters.map((x) => (
          <li key={x.id}>
            <button type="button" className="chip" aria-pressed={f === x.id} onClick={() => choose(x.id)}>{x.label}</button>
          </li>
        ))}
      </ul>
      <p className="sr-only" aria-live="polite">{shown.length} {shown.length === 1 ? 'project' : 'projects'} shown</p>

      {shown.length > 0 ? (
        <ul className="work-grid">{shown.map((p) => <ProjectCard key={p.slug} p={p} headingLevel={2} />)}</ul>
      ) : (
        <p className="work-empty">
          No {label} projects to show yet.{' '}
          <button type="button" className="text-link link-btn" onClick={() => choose('all')}>See all projects</button>, or{' '}
          <a className="text-link" href={waHref}>ask us about yours on WhatsApp</a>.
        </p>
      )}
    </>
  );
}
