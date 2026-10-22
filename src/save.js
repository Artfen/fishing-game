const KEY = 'slow-tide-save-v1';

export const DEFAULT_STATE = {
  hour: 14.5,
  day: 1,
  fish: {},   // id -> { count, best, firstDay, firstHour, firstZone, firstRain }
  places: {}, // id -> { day, hour }
  items: {},  // lantern: true
  tips: {},   // which gentle hints have already been shown
  boat: null, // { x, z, heading }
  mode: 'boat',  // 'boat' or 'foot'
  walker: null,  // { x, z, heading } while on foot
  gear: null,    // rods and tackle in the backpack, and what's tied on (see tackle.js)
  keep: [],      // fish in the creel: { id, size }
  food: null,    // { full, wellFedUntil }
  camp: null,    // { fireUntil, cooking, ready }
  caughtOn: {},  // species id -> { tackle id: count }
  finder: null,  // { x, y } as fractions of the screen, and { size }
  music: true,
  quality: 'auto', // 'auto' | 'high' | 'medium' | 'low'
  sonar: false,    // fish finder shown
  volumes: { master: 1, nature: 1, music: 0.8 },
};

export function loadState() {
  const state = JSON.parse(JSON.stringify(DEFAULT_STATE));
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) Object.assign(state, JSON.parse(raw));
  } catch {
    // Storage can be unavailable (private windows, previews). The game just starts fresh.
  }
  return state;
}

export function saveState(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Ignore: progress simply won't persist in this browser.
  }
}

export function clearState() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // nothing to clear
  }
}
