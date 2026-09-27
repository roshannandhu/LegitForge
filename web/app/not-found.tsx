import type { Metadata } from 'next';
import { HeatDirector } from '@/components/motion/heat-director';

export const metadata: Metadata = {
  title: 'Page not found',
  description: 'This page doesn’t exist. It may have moved, or the link has a typo.',
  alternates: { canonical: null },
  robots: { index: false },
};

/** PLAN §7.7. Next serves this with HTTP 404. The forge runs cold here (heat 0.1). */
export default function NotFound() {
  return (
    <section className="legal wrap not-found" data-heat="0.1">
      <p className="type-lead num" aria-hidden="true">404</p>
      <h1 className="type-h2">This page doesn’t exist.</h1>
      <p className="type-lead">It may have moved, or the link has a typo.</p>
      <div className="ctas">
        <a className="btn btn-primary" href="/">Go to the homepage</a>
        <a className="btn btn-ghost" href="/services">See our services</a>
      </div>
      <HeatDirector />
    </section>
  );
}
