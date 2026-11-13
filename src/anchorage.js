// A night at anchor (F2a). Turning in aboard (the cabin boat's or the yacht's bunk), the night isn't
// skipped over: any gale that blows while you sleep (world/forecast.js) is reckoned against where
// she lies and how she's held.
// - Tied up alongside, or at a mooring: she rides it out.
// - At anchor in sheltered water (the bay, the coves, the estuary, the lakes): an ordinary anchor
//   holds through a gale there, as boat.js's anchor does (it drags only in a storm); a rough night,
//   the rope snubbing, nothing worse.
// - At anchor out in the open (the outer coast, open water, the deep): she drags, DRAG_PER_H metres
//   an hour of gale, downwind, and you're up in the night letting out what rope there is and
//   resetting it. The heavier anchor on chain (anchorHold 2.2, a Marine Works fitting) holds more
//   than twice as hard: HEAVY of that. She brings up short of the shallows (the game moves her no
//   closer than water she floats in), never aground.
// The weather when you wake is the weather then: a gale still blowing is still blowing.

import { galeFor } from './world/forecast.js';

export const DRAG_PER_H = 22;
export const DRAG_MOST = 150;
export const HEAVY = 0.15;

// Hours of gale between two moments (game hours: day * 24 + hour).
export function galeHoursIn(from, to) {
  let h = 0;
  for (let d = Math.floor(from / 24) - 1; d <= Math.floor(to / 24) + 1; d++) {
    const g = galeFor(d);
    if (g) h += Math.max(0, Math.min(to, g.end) - Math.max(from, g.start));
  }
  return h;
}

// The night: { galeHours, sheltered (where she lies), hold (her anchor: 1, or the heavier one's
// 2.2), tied (alongside or moored) } -> { dragged (m), woke (up in the night), rough (a gale blew) }.
export function nightAtAnchor({ galeHours = 0, sheltered = false, hold = 1, tied = false }) {
  if (galeHours <= 0) return { dragged: 0, woke: false, rough: false };
  if (tied || sheltered) return { dragged: 0, woke: false, rough: true };
  const dragged = Math.round(Math.min(DRAG_MOST, DRAG_PER_H * galeHours * (hold >= 2 ? HEAVY : 1)));
  return { dragged, woke: dragged >= 10, rough: true };
}

// Where she fetches up, dragging `m` metres downwind (dx, dz: unit vector) from (x, z), stopping
// short of water shallower than `need` (depthAt from terrain.js): { x, z, m (how far she went),
// short (stopped by the shallows) }.
export function dragTo(x, z, dx, dz, m, depthAt, need) {
  let got = 0;
  for (let s = 2; s <= m; s += 2) {
    if (depthAt(x + dx * s, z + dz * s) < need) return { x: x + dx * got, z: z + dz * got, m: got, short: true };
    got = s;
  }
  return { x: x + dx * got, z: z + dz * got, m: got, short: false };
}

// In words, on waking.
export function nightWords(N, name, short = false) {
  if (!N.rough) return null;
  if (!N.dragged) return `A gale blew through in the night. ${name[0].toUpperCase() + name.slice(1)} snubbed at her rope and held, and you slept through most of it.`;
  return `A gale blew through in the night, and out here in the open she dragged her anchor: you were up at three letting out all the rope there was and setting it again. She's ${N.dragged} m downwind of where you left her${short ? ', brought up short of the shallows' : ''}. Sheltered water (the bay, a cove, the estuary), or the heavier anchor on chain from the Marine Works, and she'd have held.`;
}
