import { ACT_NAMES, LAYERS, LOG_DONE, LOG_WAIT } from '@/lib/teardown';

/** Build log and act rail for the Teardown (PLAN §6.2b #7, §6.2c). Server-rendered; the
 *  Teardown reveals a line as each layer runs. Without JS or with motion off, CSS shows the
 *  last lines: the finished journey. aria-hidden: the hero's sr-only sentence tells it. */
export function HeroLog() {
  return (
    <div className="hud" data-act="2" aria-hidden="true">
      <ol className="hud-rail">
        {ACT_NAMES.map((a, i) => <li key={a} data-a={i + 1}>{a}</li>)}
      </ol>
      <ol className="hud-log">
        {/* first, so with no JS the last three lines (the finished journey) are in view */}
        <li data-step="wait">{LOG_WAIT}</li>
        {LAYERS.map((l) => <li key={l.id} data-step={l.id}>{l.log}</li>)}
        <li data-step="done">{LOG_DONE}</li>
      </ol>
    </div>
  );
}
