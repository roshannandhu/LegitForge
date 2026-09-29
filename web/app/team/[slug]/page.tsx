import type { Metadata } from 'next';
import { notFound, permanentRedirect } from 'next/navigation';
import { MemberProfile, memberMetadata } from '@/components/team/member-profile';
import { getTeam } from '@/lib/team';

// members added in the admin render on first visit
export const dynamicParams = true;
export const generateStaticParams = async () => (await getTeam()).map((m) => ({ slug: m.slug }));

const find = async (slug: string) => (await getTeam()).find((m) => m.slug === slug);

/** /team/<slug>: the page itself only for a person whose name gives no root address (lib/team.ts
 *  withPaths); everyone else is permanently redirected to /<name>, so old links keep working
 *  and search engines keep one address per person. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const m = await find((await params).slug);
  return m && m.path === `/team/${m.slug}` ? memberMetadata(m) : {};
}

export default async function TeamMember({ params }: { params: Promise<{ slug: string }> }) {
  const m = await find((await params).slug);
  if (!m) notFound();
  if (m.path !== `/team/${m.slug}`) permanentRedirect(m.path);
  return <MemberProfile m={m} />;
}
