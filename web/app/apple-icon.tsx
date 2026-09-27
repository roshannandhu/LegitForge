import { sealIcon } from '@/lib/og';

/** The iOS / Android home-screen icon: the coin seal (lib/og.tsx), static like every share image. */
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return sealIcon(180);
}
