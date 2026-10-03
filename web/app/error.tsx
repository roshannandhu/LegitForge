'use client';

import { useCompany } from '@/components/company-context';
import { waLink } from '@/lib/site';

export default function PageError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const company = useCompany();
  return (
    <section className="page-block wrap" role="alert">
      <h1 className="type-h2">We couldn’t load this page.</h1>
      <p>Please try again in a moment.</p>
      <div className="admin-actions">
        <button className="btn btn-primary" onClick={reset}>Try again</button>
        {company.whatsapp && <a className="btn btn-ghost" href={waLink(company)}>Contact us on WhatsApp</a>}
        {company.contactEmail && <a className="btn btn-ghost" href={`mailto:${company.contactEmail}`}>Email us</a>}
      </div>
    </section>
  );
}
