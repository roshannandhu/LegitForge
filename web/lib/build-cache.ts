import 'server-only';
import { unstable_cache } from 'next/cache';

/** For `next build`: `value` (the placeholders or nothing) through unstable_cache, which TAGS the
 *  prerendered page with `tag`. Without it the built pages carry no data tag, and the admin's
 *  updateTag('projects' | 'team' | 'testimonials') never re-renders them (they kept the build's
 *  data forever). The key is the value itself, so an entry left in .next/cache by an earlier
 *  build can't differ, and it never reads D1 or a runtime entry (local test rows). */
export const atBuild = <T,>(tag: string, value: T): Promise<T> =>
  unstable_cache(async () => value, [`build:${tag}`, JSON.stringify(value)], { tags: [tag] })();
