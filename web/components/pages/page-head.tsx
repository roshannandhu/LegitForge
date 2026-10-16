import { SITE } from '@/lib/site';
import { JsonLd } from './json-ld';
import './crumbs.css';

type Crumb = { name: string; href: string };

/** Breadcrumb nav (from Home) with its BreadcrumbList data. The last crumb is the current page
 *  and is not a link. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  const trail = [{ name: 'Home', href: '/' }, ...crumbs];
  return (
    <>
      <nav aria-label="Breadcrumb">
        <ol className="crumbs">
          {trail.map((c, i) => (
            <li key={c.href}>
              {i < trail.length - 1 ? <a href={c.href}>{c.name}</a> : <span aria-current="page">{c.name}</span>}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={{
        '@type': 'BreadcrumbList',
        itemListElement: trail.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.name, item: `${SITE.url}${c.href === '/' ? '' : c.href}` })),
      }} />
    </>
  );
}

/** Inner-page header: breadcrumbs, H1, lead, optional actions, and an optional aside (a service's
 *  demo) beside them on laptops, under them on phones. */
export function PageHead({ crumbs, title, lead, children, aside }: {
  crumbs: Crumb[]; title: string; lead?: string; children?: React.ReactNode; aside?: React.ReactNode;
}) {
  const copy = <>
    <Breadcrumbs crumbs={crumbs} />
    <h1 className="type-h2 page-title">{title}</h1>
    {lead && <p className="type-lead page-lead">{lead}</p>}
    {children && <div className="page-actions">{children}</div>}
  </>;
  return aside
    ? <header className="page-head has-aside wrap"><div>{copy}</div><div className="page-head-aside">{aside}</div></header>
    : <header className="page-head wrap">{copy}</header>;
}
