'use client';

/** The home #work gallery: React Bits AccordionGallery (vendored, components/react-bits) as a row
 *  of portrait, phone-shaped project cards. Nothing is open at first; pointing at a card (a tap
 *  on touch) opens it wider with a heat gradient and its details, leaving the row closes it,
 *  and a click opens the project. Phones: a sideways row of portrait cards. Items come from the
 *  server (Projects), with their details already rendered. */

import AccordionGalleryJs from '@/components/react-bits/accordion-gallery';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export interface GalleryItem {
  image?: string;
  alt?: string;
  initials?: string;
  label: string;
  sublabel?: string;
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
      defaultIndex={-1}
      expandRatio={items.length > 3 ? 0.4 : 0.5}
      trigger="hover"
      reduceMotion={!motionOn}
      className="work-gallery"
    />
  );
}
