'use client';

/** "Watch it handle:" — pick which layer of the Teardown leads (PLAN §6.2c). The default
 *  rotates per visit. Choosing one tells the Teardown (LEAD_EVENT): the phone ends on that
 *  layer, and the page glides to the moment it runs (phones: the row scrolls to it). */

import { useEffect, useState } from 'react';
import { DEFAULT_LEAD, LAYERS, LEAD_EVENT, LAYER_IDS, isLayerId, type LayerId } from '@/lib/teardown';

const KEY = 'lf-lead-visit';

function firstLead(): LayerId {
  const q = new URLSearchParams(location.search).get('lead');
  if (isLayerId(q)) return q;
  try {
    const n = Number(localStorage.getItem(KEY) ?? '-1') + 1;
    localStorage.setItem(KEY, String(n));
    return LAYER_IDS[((n % LAYER_IDS.length) + LAYER_IDS.length) % LAYER_IDS.length];
  } catch {
    return DEFAULT_LEAD;                              // storage blocked: the default is fine
  }
}

export function StoryChips() {
  const [lead, setLead] = useState<LayerId>(DEFAULT_LEAD);

  const announce = (id: LayerId, replay: boolean) => {
    const hero = document.getElementById('top');
    if (hero) hero.dataset.lead = id;
    window.dispatchEvent(new CustomEvent(LEAD_EVENT, { detail: { id, replay } }));
  };

  useEffect(() => {
    const id = firstLead();
    setLead(id);
    announce(id, false);
  }, []);

  return (
    <div className="story-chips">
      <p className="story-label" id="story-label">Watch it handle:</p>
      <ul aria-labelledby="story-label">
        {LAYERS.map((l) => (
          <li key={l.id}>
            <button
              type="button" className="story-chip" aria-pressed={lead === l.id} aria-label={`${l.num} ${l.name}`}
              onClick={() => { setLead(l.id); announce(l.id, true); }}
            >
              {l.chip}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
