'use client';

/** "Watch it handle:" — pick which job the hero machine does (PLAN §6.2b #10, by story).
 *  The default rotates per visit, so returning visitors see something new. Choosing a chip
 *  tells Machine (STORY_EVENT), which re-labels the chip, the log and the phone screen and
 *  glides the page through the story. With motion off it swaps the still frame instead. */

import { useEffect, useState } from 'react';
import { DEFAULT_STORY, STORIES, STORY_EVENT, STORY_IDS, isStoryId, type StoryId } from '@/lib/hero-layout';

const KEY = 'lf-story-visit';

function firstStory(): StoryId {
  const q = new URLSearchParams(location.search).get('story');
  if (isStoryId(q)) return q;
  try {
    const n = Number(localStorage.getItem(KEY) ?? '-1') + 1;
    localStorage.setItem(KEY, String(n));
    return STORY_IDS[((n % STORY_IDS.length) + STORY_IDS.length) % STORY_IDS.length];
  } catch {
    return DEFAULT_STORY;                             // storage blocked: the default is fine
  }
}

export function StoryChips() {
  const [story, setStory] = useState<StoryId>(DEFAULT_STORY);

  const announce = (id: StoryId, replay: boolean) => {
    const hero = document.getElementById('top');
    if (hero) hero.dataset.story = id;
    window.dispatchEvent(new CustomEvent(STORY_EVENT, { detail: { id, replay } }));
  };

  useEffect(() => {
    const id = firstStory();
    setStory(id);
    announce(id, false);
  }, []);

  return (
    <div className="story-chips">
      <p className="story-label" id="story-label">Watch it handle:</p>
      <ul aria-labelledby="story-label">
        {STORY_IDS.map((id) => (
          <li key={id}>
            <button
              type="button"
              className="story-chip"
              aria-pressed={story === id}
              aria-label={STORIES[id].label}
              onClick={() => { setStory(id); announce(id, true); }}
            >
              {STORIES[id].short}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
