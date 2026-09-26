'use client';

/** The home #work gallery (plan F step 6): React Bits AccordionGallery with the site's motion
 *  switch. Items come from the server (Projects), with their details already rendered. */

import AccordionGalleryJs from '@/components/react-bits/accordion-gallery';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export interface GalleryItem {
  image?: string;
  alt?: string;
  initials?: string;
  label: string;
  link: string;
  content?: React.ReactNode;
  cardProps?: Record<string, string>;
}

/** Typed boundary for the vendored JS component: exactly the props this page passes. */
const AccordionGallery = AccordionGalleryJs as unknown as React.ComponentType<{
  items: GalleryItem[]; defaultIndex?: number; expandRatio?: number; trigger?: 'hover' | 'click'; reduceMotion?: boolean; className?: string;
}>;

export function WorkGallery({ items }: { items: GalleryItem[] }) {
  const motionOn = useMotionEnabled();
  return (
    <AccordionGallery
      items={items}
      defaultIndex={Math.min(2, items.length - 1)}
      expandRatio={0.52}
      trigger="hover"
      reduceMotion={!motionOn}
      className="work-gallery"
    />
  );
}
