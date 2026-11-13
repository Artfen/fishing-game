// Watching over the seasons (G3 of docs/PROGRESSION.md). Each sighting of a kind of sea life (a
// counted one: see main.js seeSeaLife) is noted against the season it came in and the place, so
// over a year or two the journal's notes show when each one is about and where it's mostly seen:
// the gannets diving in summer off the Kelp Forest, the seals hauled out on Gull Rock all winter.
// And the photographs (see photos.js) make a collection of their own: every kind you have a
// picture of, marked on the journal's species pages, and a goal.

import { SEASONS, seasonOf } from './world/season.js';

export const AT_KEPT = 6;

// A sighting of a kind (R: its record in state.seaLife) on `day`, at `where` (a place's name, or
// nothing).
export function noteSighting(R, { day, where = '' }) {
  if (!R) return R;
  R.s = Array.isArray(R.s) && R.s.length === 4 ? R.s : [0, 0, 0, 0];
  R.s[seasonOf(day).index]++;
  const w = typeof where === 'string' ? where.slice(0, 60) : '';
  if (w) {
    R.at = R.at && typeof R.at === 'object' ? R.at : {};
    R.at[w] = (R.at[w] || 0) + 1;
    // (Only the places it's most often seen: the odd one-off drops away.)
    const keys = Object.keys(R.at);
    if (keys.length > AT_KEPT) {
      const least = keys.reduce((a, k) => (R.at[k] < R.at[a] ? k : a), keys[0]);
      delete R.at[least];
    }
  }
  return R;
}

// When it's about, in words: "mostly in summer (7); in spring (3) and autumn (1) too", or null
// before any season's been noted.
export function seasonsWords(R) {
  const s = Array.isArray(R?.s) ? R.s : null;
  if (!s || !s.some((n) => n > 0)) return null;
  const order = [0, 1, 2, 3].filter((i) => s[i] > 0).sort((a, b) => s[b] - s[a] || a - b);
  const [top, ...rest] = order;
  const one = (i) => `${SEASONS[i]} (${s[i]})`;
  if (!rest.length) return `only in ${one(top)} so far`;
  const tail = rest.map(one);
  return `mostly in ${one(top)}; in ${tail.length > 1 ? `${tail.slice(0, -1).join(', ')} and ${tail[tail.length - 1]}` : tail[0]} too`;
}

// Where it's mostly seen, in words: "mostly off the Kelp Forest, and at Gull Rock", or null.
export function placesWords(R) {
  const at = R?.at && typeof R.at === 'object' ? Object.entries(R.at).filter(([, n]) => n > 0) : [];
  if (!at.length) return null;
  const top = at.sort((a, b) => b[1] - a[1]).slice(0, 3).map(([w]) => w.replace(/^The /, 'the '));
  return top.length === 1 ? top[0] : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;
}

// What a save holds of it (beside n, day, hour, where, heard): the seasons and the places.
export function cleanWatch(r) {
  const out = {};
  if (Array.isArray(r?.s) && r.s.length === 4 && r.s.every((n) => Number.isFinite(n))) out.s = r.s.map((n) => Math.max(0, Math.min(9999, Math.floor(n))));
  if (r?.at && typeof r.at === 'object' && !Array.isArray(r.at)) {
    const at = Object.entries(r.at).filter(([w, n]) => typeof w === 'string' && w.length <= 60 && Number.isFinite(n) && n > 0).sort((a, b) => b[1] - a[1]).slice(0, AT_KEPT);
    if (at.length) out.at = Object.fromEntries(at.map(([w, n]) => [w.replace(/[<>]/g, ''), Math.min(9999, Math.floor(n))]));
  }
  return out;
}

// Every kind with a photograph of it, from the album's subjects: 'fish:<id>', 'sea:<kind>' (sea
// life, birds and shore wildlife) and 'nature:<id>' (the shore's small life).
export function photographed(photos = []) {
  const out = new Set();
  for (const p of photos) {
    const S = p?.subjects;
    if (!S) continue;
    for (const id of S.species || []) out.add(`fish:${id}`);
    for (const k of [...(S.sea || []), ...(S.life || [])]) out.add(`sea:${k}`);
    for (const k of S.nature || []) out.add(`nature:${k}`);
  }
  return out;
}
// The wildlife among them (not the fish): what the collection's goal counts.
export const wildPhotographed = (photos) => [...photographed(photos)].filter((k) => !k.startsWith('fish:')).length;
export const WILD_GOAL = 20;
