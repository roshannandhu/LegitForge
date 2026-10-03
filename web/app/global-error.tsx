'use client';

/** A root-layout data failure happens outside app/error.tsx's boundary. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="en"><body><main style={{ maxWidth: 640, margin: '12vh auto', padding: 24, fontFamily: 'sans-serif' }}>
    <h1>We couldn’t load this page</h1>
    <p>The site is temporarily unavailable. Please try again in a moment.</p>
    <button onClick={reset}>Try again</button>
  </main></body></html>;
}
