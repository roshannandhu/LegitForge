import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { MemberProfile, memberMetadata } from '@/components/team/member-profile';
import { getTeam } from '@/lib/team';

/** legitforge.pages.dev/<name>: each person's page at their own name (lib/team.ts withPaths), for
 *  name searches. The named routes (/blog, /team, …) always win over this one; any other
 *  address that isn't a person's is the 404 page. */

// people added in the admin render on first visit
export const dynamicParams = true;
export const generateStaticParams = async () =>
  (await getTeam()).filter((m) => !m.path.startsWith('/team/')).map((m) => ({ member: m.path.slice(1) }));

const find = async (handle: string) => (await getTeam()).find((m) => m.path === `/${handle}`);

export async function generateMetadata({ params }: { params: Promise<{ member: string }> }): Promise<Metadata> {
  const m = await find((await params).member);
  return m ? memberMetadata(m) : {};
}

export default async function Member({ params }: { params: Promise<{ member: string }> }) {
  const m = await find((await params).member);
  if (!m) notFound();
  return <MemberProfile m={m} />;
}
