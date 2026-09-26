import { notFound } from 'next/navigation';
import { CaseStudy } from '@/components/work/case-study';
import { getProjectForPreview } from '@/lib/work';
import '@/components/sections/sections.css';
import '../../../pages.css';

/** Draft preview (PLAN §7.8): the case study exactly as /work/<slug> will show it, drafts
 *  included. It lives under /admin so Cloudflare Access guards it too, and the public
 *  /work pages stay static. */
export default async function Preview({ params }: { params: Promise<{ slug: string }> }) {
  const p = await getProjectForPreview((await params).slug);
  if (!p) notFound();
  return (
    <div className="admin-preview">
      <p className="admin-msg">{p.published ? 'Published' : 'Draft'}: preview only, not public.</p>
      <CaseStudy p={p} />
    </div>
  );
}
