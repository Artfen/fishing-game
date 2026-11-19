// Save slots (docs/MODES.md, M2): three games side by side in this browser. The one you're playing
// lives where the one save always did (save.js: its key, with its session backup); the others are
// parked beside it under keys of their own, and swapped in when you choose one. An index keeps a
// line on each for the title screen: which way it's played, its day, its fish, places and purse,
// and when it was last played.
//
// store: { get(k), set(k, v) (may throw when storage is full), remove(k) }. keys: { KEY, BACKUP }.
// Nothing here talks to the page: save.js and main.js do.

export const SLOTS = 3;
export const INDEX_KEY = 'slow-tide-slots';
export const slotKey = (n) => `slow-tide-slot-${n}`;
const okSlot = (n) => Number.isInteger(n) && n >= 1 && n <= SLOTS;

// A game's line, from its state.
export function summaryOf(state, savedAt = Date.now()) {
  const fish = state?.fish || {};
  return {
    play: state?.play === 'free' ? 'free' : 'career',
    day: Math.max(1, Math.round(Number(state?.day) || 1)),
    kinds: Object.keys(fish).length,
    caught: Object.values(fish).reduce((a, f) => a + (Number(f?.count) || 0), 0),
    places: Object.keys(state?.places || {}).length,
    money: Math.round(Number(state?.money) || 0),
    savedAt: Number(savedAt) || 0,
  };
}
function cleanSummary(g) {
  if (!g || typeof g !== 'object') return null;
  const n = (v, lo = 0) => (Number.isFinite(v) ? Math.max(lo, Math.round(v)) : lo);
  return { play: g.play === 'free' ? 'free' : 'career', day: n(g.day, 1), kinds: n(g.kinds), caught: n(g.caught), places: n(g.places), money: n(g.money), savedAt: n(g.savedAt) };
}

// The index: { active (the slot being played), games: { 1…SLOTS: its line, or null } }. A browser
// from before there were slots has none: its one game is Game 1.
export function readIndex(store) {
  let raw = null;
  try {
    raw = JSON.parse(store.get(INDEX_KEY) || 'null');
  } catch { /* unreadable: start the index again (the games themselves are untouched) */ }
  const games = {};
  for (let n = 1; n <= SLOTS; n++) games[n] = cleanSummary(raw?.games?.[n]);
  return { active: okSlot(raw?.active) ? raw.active : 1, games };
}
const writeIndex = (store, I) => store.set(INDEX_KEY, JSON.stringify(I));

// After each save of the game being played: its line brought up to date. (Never fails the save.)
export function noteSaved(store, state, savedAt = Date.now()) {
  const I = readIndex(store);
  I.games[I.active] = summaryOf(state, savedAt);
  try {
    writeIndex(store, I);
  } catch { /* full: the line catches up next time */ }
  return I;
}

// Which slots hold a game: the one being played if it's been saved, and each parked one. (A slot
// whose line says there's a game but has none, a parked one lost, shows as empty.)
export function filled(store, keys, I = readIndex(store)) {
  const out = {};
  for (let n = 1; n <= SLOTS; n++) out[n] = !!(n === I.active ? store.get(keys.KEY) : store.get(slotKey(n)));
  return out;
}

// Over to slot n: the game being played parked in its own slot, n's game put where the save lives
// (or nothing there, so a new game begins), and the session backup cleared, so a damaged save can
// never fall back to another game. All or nothing: if storage won't take it, everything is put
// back as it was. Returns { ok, why }.
export function switchTo(store, keys, n) {
  if (!okSlot(n)) return { ok: false, why: 'There’s no such slot.' };
  const I = readIndex(store), from = I.active, rawIndex = store.get(INDEX_KEY);
  if (n === from) return { ok: true, same: true };
  // (Putting the index back exactly as it was, if a later step can't be made.)
  const restoreIndex = () => {
    try {
      if (rawIndex == null) store.remove(INDEX_KEY);
      else store.set(INDEX_KEY, rawIndex);
    } catch { /* the index is only lines: the games are whole */ }
  };
  const cur = store.get(keys.KEY), next = store.get(slotKey(n));
  const full = { ok: false, why: 'This browser’s storage is too full to keep both games. Nothing has been changed: download a copy of one, or delete a game you don’t need, and try again.' };
  // 1. Park the game being played (nothing changed yet if this fails).
  try {
    if (cur) store.set(slotKey(from), cur);
  } catch {
    return full;
  }
  // 2. The index says n is the one now.
  try {
    writeIndex(store, { ...I, active: n });
  } catch {
    if (cur) store.remove(slotKey(from));
    return full;
  }
  // 3. n's game where the save lives (or none: a new game).
  try {
    if (next) store.set(keys.KEY, next);
    else store.remove(keys.KEY);
  } catch {
    restoreIndex();
    if (cur) store.remove(slotKey(from));
    return full;
  }
  // 4. Its parked copy, and the other game's backup, gone.
  store.remove(slotKey(n));
  if (keys.BACKUP) store.remove(keys.BACKUP);
  return { ok: true };
}

// A parked game's save, as text (for a download before it's deleted), or null.
export const parkedText = (store, n) => (okSlot(n) ? store.get(slotKey(n)) : null);

// Delete a game you're not playing (the one you're playing starts over from the journal instead).
// Returns { ok, why, text (what was deleted, to clean up after it) }.
export function deleteGame(store, n) {
  const I = readIndex(store);
  if (!okSlot(n)) return { ok: false, why: 'There’s no such slot.' };
  if (n === I.active) return { ok: false, why: 'That’s the game you’re playing: start it over from the journal instead.' };
  const text = store.get(slotKey(n));
  store.remove(slotKey(n));
  I.games[n] = null;
  try {
    writeIndex(store, I);
  } catch { /* the line goes next time */ }
  return { ok: true, text };
}
