import { DEMO_TRANSCRIPTS } from '@/lib/demo-transcripts';
import type { DemoId } from './demos';

/** A demo's steps as text, visually hidden (SEO plan B). */
export function DemoTranscript({ kind }: { kind: DemoId }) {
  const t = DEMO_TRANSCRIPTS[kind];
  return (
    <div className="sr-only">
      <p>{t.title}:</p>
      <ol>{t.steps.map((s) => <li key={s}>{s}</li>)}</ol>
    </div>
  );
}
