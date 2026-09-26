import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { JsonLd } from '@/components/pages/json-ld';
import { findPost, formatDate, postStats, posts, relatedPosts } from '@/lib/blog';
import { TEAM } from '@/lib/content';
import { SERVICE_PAGES } from '@/lib/pages';
import { SITE } from '@/lib/site';
import '../../pages.css';

export const dynamicParams = false;
export const generateStaticParams = () => posts().map((p) => ({ slug: p.slug }));

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const p = findPost((await params).slug);
  if (!p) return {};
  return {
    title: p.title,
    description: p.description,
    alternates: { canonical: `/blog/${p.slug}` },
    openGraph: { type: 'article', publishedTime: p.date },
    ...(p.draft ? { robots: { index: false, follow: true } } : {}),
  };
}

/** A post (PLAN §7.4): title, date, author, reading time → table of contents for long posts →
 *  the article → the related service → two more posts. */
export default async function BlogPost({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const p = findPost(slug);
  if (!p) notFound();
  const { default: Article } = await import(`@/content/blog/${slug}.mdx`);
  const stats = postStats(slug);
  const author = TEAM.find((m) => m.slug === p.author);
  const service = SERVICE_PAGES.find((s) => s.slug === p.service);
  const more = relatedPosts(slug);
  const toc = stats.toc.length >= 3 ? stats.toc : [];

  return (
    <>
      <PageHead crumbs={[{ name: 'Blog', href: '/blog' }, { name: p.title, href: `/blog/${p.slug}` }]} title={p.title} lead={p.description}>
        <p className="post-byline">
          <time dateTime={p.date}>{formatDate(p.date)}</time>
          {author && <> · by <a className="text-link" href={`/team/${author.slug}`}>{author.name}</a></>}
          {' '}· {stats.minutes} min read
        </p>
      </PageHead>

      <div className={`page-block wrap post-layout${toc.length ? ' has-toc' : ''}`}>
        {toc.length > 0 && (
          <nav className="post-toc" aria-labelledby="toc-h">
            <h2 id="toc-h" className="type-label">On this page</h2>
            <ol>{toc.map((t) => <li key={t.id}><a href={`#${t.id}`}>{t.text}</a></li>)}</ol>
          </nav>
        )}
        <article className="post-body">
          <Article />
          {service && (
            <aside className="post-service" aria-label="Related service">
              <span className="type-label">Related service</span>
              <h2 className="type-h3">{service.name}</h2>
              <p>{service.description}</p>
              <a className="btn btn-ghost" href={`/services/${service.slug}`}>See how we build it</a>
            </aside>
          )}
        </article>
      </div>

      {more.length > 0 && (
        <section className="page-block wrap" aria-labelledby="more-h">
          <h2 id="more-h" className="type-h3 block-h">More from the blog</h2>
          <ol className="post-list">
            {more.map((m) => (
              <li key={m.slug}>
                <a className="tile tile-link post-card" href={`/blog/${m.slug}`}>
                  <span className="post-meta num"><time dateTime={m.date}>{formatDate(m.date)}</time> · {postStats(m.slug).minutes} min read</span>
                  <h3 className="type-h3">{m.title}</h3>
                  <p>{m.description}</p>
                </a>
              </li>
            ))}
          </ol>
        </section>
      )}

      <CtaBand />
      <JsonLd data={{
        '@type': 'BlogPosting',
        headline: p.title,
        description: p.description,
        datePublished: p.date,
        wordCount: stats.words,
        url: `${SITE.url}/blog/${p.slug}`,
        mainEntityOfPage: `${SITE.url}/blog/${p.slug}`,
        author: author ? { '@type': 'Person', name: author.name, url: `${SITE.url}/team/${author.slug}` } : undefined,
        publisher: { '@type': 'Organization', name: SITE.name, url: SITE.url },
      }} />
    </>
  );
}
