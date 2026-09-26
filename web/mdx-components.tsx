import type { MDXComponents } from 'mdx/types';

/** Blog post elements (PLAN §7.4). Headings get ids for the table of contents: slug() must
 *  match scripts/blog-index.mjs. Tables scroll inside their own box on phones. */
const slug = (t: string) => t.toLowerCase().replace(/[*_`"“”‘’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const text = (n: React.ReactNode): string =>
  typeof n === 'string' || typeof n === 'number' ? String(n)
    : Array.isArray(n) ? n.map(text).join('')
      : n && typeof n === 'object' && 'props' in n ? text((n as React.ReactElement<{ children?: React.ReactNode }>).props.children) : '';

const components: MDXComponents = {
  h2: ({ children }) => <h2 id={slug(text(children))} className="type-h3">{children}</h2>,
  h3: ({ children }) => <h3 id={slug(text(children))}>{children}</h3>,
  a: ({ href, children }) => {
    const external = href?.startsWith('http');
    return <a className="text-link" href={href} {...(external ? { target: '_blank', rel: 'noopener' } : {})}>{children}</a>;
  },
  table: ({ children }) => <div className="post-table"><table>{children}</table></div>,
};

export function useMDXComponents(): MDXComponents {
  return components;
}
