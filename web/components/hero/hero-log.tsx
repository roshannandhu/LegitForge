import { ACT_NAMES, LAYOUTS, LOG_DONE, LOG_WAIT, PLATES, STORY } from '@/lib/hero-layout';

/** Build log and act rail (PLAN §6.2b #7). Server-rendered; Machine reveals one line per
 *  plate as the message reaches it and marks the current act. Without JS or with motion off,
 *  CSS shows the last lines and the "Become" act: the finished story.
 *  aria-hidden: the hero's sr-only paragraph already tells this story in one sentence. */
export function HeroLog() {
  const onPhone = new Set(LAYOUTS.phone.positions.map((p) => p.id));
  return (
    <div className="hud" data-act="3" aria-hidden="true">
      <ol className="hud-rail">
        {ACT_NAMES.map((a, i) => <li key={a} data-a={i + 1}>{a}</li>)}
      </ol>
      <ol className="hud-log">
        {/* first, so with no JS the last three lines (the finished story) are the ones in view */}
        <li data-step="wait" data-on-phone="1">{LOG_WAIT}</li>
        {PLATES.map((p) => (
          <li key={p.id} data-step={p.id} data-on-phone={onPhone.has(p.id) ? '1' : '0'}>{STORY[p.id].log}</li>
        ))}
        <li data-step="done" data-on-phone="1">{LOG_DONE}</li>
      </ol>
    </div>
  );
}
