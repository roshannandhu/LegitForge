import { getProjects } from '@/lib/work';
import { SERVICE_PAGES } from '@/lib/pages';
import { published } from '@/lib/blog';
import { SITE, shownEmail } from '@/lib/site';
import { getCompany } from '@/lib/company';
import { getTeam } from '@/lib/team';
import { joinNames, named } from '@/lib/team-seo';

/** /llms.txt (llmstxt.org): the site's structure in Markdown for AI crawlers and assistants.
 *  Static like the sitemap; published projects and people join when the admin's updateTag('projects')
 *  or updateTag('team') runs. */
export async function GET() {
  const company = await getCompany();
  const email = shownEmail(company);
  const u = (path: string) => `${SITE.url}${path}`;
  const projects = await getProjects();
  const posts = published();
  const team = named(await getTeam());
  const lines = [
    `# ${SITE.name}`,
    '',
    '> A two-person studio that builds websites, web apps, quotation and warranty systems, WhatsApp automation, n8n workflows, local SEO and NFC cards. Fixed quotes, weekly previews, and the client owns everything.',
    '',
    ...(company.city || SITE.alsoServes.length ? [[company.city ? `Based in ${company.city}, ${company.country || 'India'}.` : '',
      SITE.alsoServes.length ? `Also works with clients in ${joinNames(SITE.alsoServes)}.` : ''].filter(Boolean).join(' '), ''] : []),
    `Contact: ${[email, company.whatsapp ? `WhatsApp +${company.whatsapp}` : ''].filter(Boolean).join(', ') || 'WhatsApp, via the site'}. Replies within ${SITE.replyWithin} (${SITE.hours.label}).`,
    '',
    '## Services',
    `- [All services](${u('/services')}): what we build, and how long each takes`,
    ...SERVICE_PAGES.map((s) => `- [${s.name}](${u(`/services/${s.slug}`)}): ${s.description}`),
    ...(projects.length ? ['', '## Work', `- [All projects](${u('/work')})`,
      ...projects.map((p) => `- [${p.title}](${u(`/work/${p.slug}`)}): ${p.client}${p.resultValue ? `, ${p.resultValue} ${p.resultLabel}` : ''}`)] : []),
    ...(posts.length ? ['', '## Blog', ...posts.map((p) => `- [${p.title}](${u(`/blog/${p.slug}`)}): ${p.description}`)] : []),
    '',
    ...(team.length ? ['## Team', ...team.map((m) => `- [${m.name}](${u(m.path)})${m.role ? `: ${m.role}` : ''}`
      + (m.links.length ? ` (${m.links.map((l) => `[${l.label}](${l.href})`).join(', ')})` : '')), ''] : []),
    '## About',
    `- [Team](${u('/team')}): the people who build every project`,
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
