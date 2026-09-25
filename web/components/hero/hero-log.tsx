import { ACT_NAMES, DEFAULT_STORY, LAYOUTS, LOG_WAIT, PLATES, STORIES, STORY_IDS } from '@/lib/hero-layout';

/** Build log and act rail (PLAN §6.2b #7). Server-rendered with every story's lines; CSS shows
 *  only the active story's (data-story, set by Machine). Machine reveals one line per plate as
 *  the message reaches it and marks the current act. Without JS or with motion off, CSS shows
 *  the last lines of the default story and the "Become" act: the finished story.
 *  aria-hidden: the hero's sr-only paragraph already tells this story in one sentence. */
export function HeroLog() {
  const onPhone = new Set(LAYOUTS.phone.positions.map((p) => p.id));
  return (
    <div className="hud" data-act="3" data-story={DEFAULT_STORY} aria-hidden="true">
      <ol className="hud-rail">
        {ACT_NAMES.map((a, i) => <li key={a} data-a={i + 1}>{a}</li>)}
      </ol>
      <ol className="hud-log">
        {/* first, so with no JS the last three lines (the finished story) are the ones in view */}
        <li data-step="wait" data-on-phone="1">{LOG_WAIT}</li>
        {/* the default story last, for the same reason */}
        {[...STORY_IDS.filter((s) => s !== DEFAULT_STORY), DEFAULT_STORY].flatMap((sid) => [
          ...PLATES.map((p) => (
            <li key={`${sid}-${p.id}`} data-story={sid} data-step={p.id} data-on-phone={onPhone.has(p.id) ? '1' : '0'}>
              {STORIES[sid].steps[p.id].log}
            </li>
          )),
          <li key={`${sid}-done`} data-story={sid} data-step="done" data-on-phone="1">{STORIES[sid].done}</li>,
        ])}
      </ol>
    </div>
  );
}
