import { getCloudflareContext } from '@opennextjs/cloudflare';

/** The Worker's bindings and secrets, or null where there are none (`next build`, `next start`).
 *  Every caller must work without them. */
export async function getEnv(): Promise<CloudflareEnv | null> {
  try {
    return (await getCloudflareContext({ async: true })).env;
  } catch {
    return null;
  }
}
