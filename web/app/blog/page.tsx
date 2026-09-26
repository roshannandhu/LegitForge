import type { Metadata } from 'next';
import { PageHead } from '@/components/pages/page-head';
import { CtaBand } from '@/components/pages/cta-band';
import { formatDate, postStats, posts, published } from '@/lib/blog';
import '../pages.css';

export const metadata: Metadata = {
  title: 'Blog',
  description: 'Plain answers about websites, web apps, WhatsApp automation and n8n workflows for small businesses.',
  alternates: { canonical: '/blog' },
  // indexed once the first post is out of draft
  ...(published().length ? {} : { robots: { index: false, follow: true } }),
};

/** /blog (PLAN §7.4): newest first. */
export default function BlogIndex() {
  const list = posts();
  return (
    <>
      <PageHead
        crumbs={[{ name: 'Blog', href: '/blog' }]}
        title="Notes from the forge"
        lead="Plain answers to the questions clients ask us before they start: what to build, what it costs to run, and what to skip."
      />
      <section className="page-block wrap" aria-label="Posts">
        <ol className="post-list">
          {list.map((p) => (
            <li key={p.slug}>
              <a className="tile tile-link post-card" href={`/blog/${p.slug}`}>
                <span className="post-meta num"><time dateTime={p.date}>{formatDate(p.date)}</time> · {postStats(p.slug).minutes} min read</span>
                <h2 className="type-h3">{p.title}</h2>
                <p>{p.description}</p>
                <span className="text-link" aria-hidden="true">Read the post</span>
              </a>
            </li>
          ))}
        </ol>
      </section>
      <CtaBand />
    </>
  );
}
