'use client';

/** The home #work gallery: React Bits AccordionGallery (JS-CSS, vendored in components/react-bits)
 *  with the owner's settings: expandRatio 0.52, trigger "hover", and every panel the same size
 *  until pointed at (defaultIndex -1, the owner's change to the sample's 2). Laptop: pointing at a
 *  panel extends it, leaving the row makes them equal again, one click opens the project. Touch:
 *  one tap extends a panel, a second tap opens the project. The open panel shows only a brief
 *  description. Items come from the server (Projects), with that description already rendered. */

import AccordionGalleryJs from '@/components/react-bits/accordion-gallery';
import { useMotionEnabled } from '@/components/motion/motion-provider';

export interface GalleryItem {
  image?: string;
  alt?: string;
  initials?: string;
  label: string;
  sublabel?: string;
  link: string;
  linkLabel?: string;
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
      expandRatio={0.52}
      trigger="hover"
      reduceMotion={!motionOn}
      className="work-gallery"
    />
  );
}
