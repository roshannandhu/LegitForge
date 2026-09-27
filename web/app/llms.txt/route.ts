import { getProjects } from '@/lib/work';
import { SERVICE_PAGES } from '@/lib/pages';
import { published } from '@/lib/blog';
import { SITE } from '@/lib/site';

/** /llms.txt (llmstxt.org): the site's structure in Markdown for AI crawlers and assistants.
 *  Static like the sitemap; published projects join when the admin's updateTag('projects') runs. */
export async function GET() {
  const u = (path: string) => `${SITE.url}${path}`;
  const projects = await getProjects();
  const posts = published();
  const lines = [
    `# ${SITE.name}`,
    '',
    '> A two-person studio that builds websites, web apps, quotation and warranty systems, WhatsApp automation, n8n workflows, local SEO and NFC cards. Fixed quotes, weekly previews, and the client owns everything.',
    '',
    `Contact: ${SITE.email}${SITE.whatsappNumber ? `, WhatsApp +${SITE.whatsappNumber}` : ''}. Replies within ${SITE.replyWithin} (${SITE.hours.label}).`,
    '',
    '## Services',
    `- [All services](${u('/services')}): what we build, and how long each takes`,
    ...SERVICE_PAGES.map((s) => `- [${s.name}](${u(`/services/${s.slug}`)}): ${s.description}`),
    ...(projects.length ? ['', '## Work', `- [All projects](${u('/work')})`,
      ...projects.map((p) => `- [${p.title}](${u(`/work/${p.slug}`)}): ${p.client}${p.resultValue ? `, ${p.resultValue} ${p.resultLabel}` : ''}`)] : []),
    ...(posts.length ? ['', '## Blog', ...posts.map((p) => `- [${p.title}](${u(`/blog/${p.slug}`)}): ${p.description}`)] : []),
    '',
    '## About',
    `- [Team](${u('/team')}): the two people who build every project`,
    `- [Contact](${u('/contact')}): WhatsApp or the project form`,
    '',
    '## Optional',
    `- [Privacy policy](${u('/privacy')})`,
    `- [Terms](${u('/terms')})`,
    `- [Sitemap](${u('/sitemap.xml')})`,
    '',
  ];
  return new Response(lines.join('\n'), { headers: { 'content-type': 'text/markdown; charset=utf-8' } });
}
