/** Structured data (PLAN §10.4). `<` is escaped so no string can close the script tag. */
export function JsonLd({ data }: { data: object }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c') }}
    />
  );
}
