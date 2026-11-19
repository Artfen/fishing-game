// A night at anchor (F2a). Turning in aboard (the cabin boat's or the yacht's bunk), the night isn't
// skipped over: any gale that blows while you sleep (world/forecast.js) is reckoned against where
// she lies and how she's held.
// - Tied up alongside, or at a mooring: she rides it out.
// - At anchor: (B6) the gale's steady pull on her (PULL: in sheltered water, the bay, the coves, the
//   estuary, the lakes, less than half of what an ordinary anchor holds dug into sand; out in the
//   open, the outer coast, open water, the deep, 1.45 times it) against what her anchor holds there,
//   as the live anchor reckons it (anchoring.js): the bottom it's in, the angle the rode pulls it at
//   (a short scope in deep water, or a chain lying along the bottom), and the anchor (the heavier
//   one, a Marine Works fitting, twice as hard). Where that's past what it holds she drags,
//   downwind, at dragRate, and you're up in the night letting out what rope there is and resetting
//   it. She brings up short of the shallows (the game moves her no closer than water she floats
//   in), never aground.
//   With an ordinary anchor in sand at a good scope, as before B6: she rides out a gale in shelter,
//   and drags DRAG_PER_H metres an hour of it in the open.
// The weather when you wake is the weather then: a gale still blowing is still blowing.

import { galeFor } from './world/forecast.js';
import { ANCHOR_HOLD, SCOPE_REF, UPLIFT_REF, uplift, liftAngle, rodeOf } from './anchoring.js';
import { $t } from './i18n.js';

export const DRAG_PER_H = 22;
export const DRAG_MOST = 150;
// (B6) A gale's steady pull on her, sheltered or in the open, as a share of what an ordinary anchor
// holds dug into sand at a good scope (ANCHOR_HOLD of her weight). In the open, the live anchor's:
// the game's storm on the open coast, its steadied pull's peak over three minutes against that
// hold, 1.25 to 2.6 (cabin boat, skiff 1.44, centre console 1.48, rowing boat). In the bay its pull
// was too small to measure in three minutes (the land takes its wind and its seas); less than half,
// ours.
export const PULL = { sheltered: 0.45, open: 1.45 };
// How fast she drags (m an hour) with the pull r times what her anchor holds: not at all to half
// of it, DRAG_PER_H in the open with an ordinary anchor dug into sand at a good scope.
export const dragRate = (r) => DRAG_PER_H * Math.max(0, (r - 0.5) / (PULL.open - 0.5));
// (The rode's fairlead above the water, for its angle.)
const BOW = 0.8;

// What her anchor holds through the night against an ordinary one dug into sand at a good scope:
// { share, bottom (the bottom's own share), lift (the angle's) }. hold: the anchor (1, or the
// heavier one's 2); bed: what it's in (anchoring.js anchorBottom: sand if not given); rode, depth
// (m), out (m of rode), m (kg): her rode's angle under that pull (without them, a good scope).
export function holdShare({ hold = 1, bed = null, rode = 'rope', depth = 0, out = 0, m = 0 }, pull = PULL.open) {
  const bottom = bed?.hold ?? 1;
  const theta = depth > 0 && out > 0 && m > 0 ? liftAngle(pull * ANCHOR_HOLD * m * 9.81, depth + BOW, out, rodeOf(rode, m)) : Math.asin(1 / SCOPE_REF);
  const lift = uplift(theta) / UPLIFT_REF;
  return { share: hold * bottom * lift, bottom, lift };
}

// Hours of gale between two moments (game hours: day * 24 + hour).
export function galeHoursIn(from, to) {
  let h = 0;
  for (let d = Math.floor(from / 24) - 1; d <= Math.floor(to / 24) + 1; d++) {
    const g = galeFor(d);
    if (g) h += Math.max(0, Math.min(to, g.end) - Math.max(from, g.start));
  }
  return h;
}

// The night: { galeHours, sheltered (where she lies), tied (alongside or moored), and her anchor
// (holdShare's: hold, bed, rode, depth, out, m) } -> { dragged (m), woke (up in the night), rough
// (a gale blew), why (when she dragged: 'open', 'bottom' (a poor one), or 'scope' (deep water, the
// rode pulling it up)), kind (the bottom), depth }.
export function nightAtAnchor({ galeHours = 0, sheltered = false, tied = false, ...anchor }) {
  if (galeHours <= 0) return { dragged: 0, woke: false, rough: false };
  if (tied) return { dragged: 0, woke: false, rough: true };
  const pull = sheltered ? PULL.sheltered : PULL.open;
  const H = holdShare(anchor, pull);
  const dragged = Math.round(Math.min(DRAG_MOST, dragRate(pull / H.share) * galeHours));
  const N = { dragged, woke: dragged >= 10, rough: true };
  if (!dragged) return N;
  // (What to blame: in shelter, whichever of the bottom and the scope fell shorter; in the open, a
  // poor bottom, then a short scope, else being out in the open at all.)
  N.why = sheltered ? (H.bottom <= H.lift ? 'bottom' : 'scope') : H.bottom < 0.8 ? 'bottom' : H.lift < 0.85 ? 'scope' : 'open';
  N.kind = anchor.bed?.kind || 'sand';
  N.depth = anchor.depth || 0;
  return N;
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
  if (!N.dragged) return $t`A gale blew through in the night. ${name[0].toUpperCase() + name.slice(1)} snubbed at her rope and held, and you slept through most of it.`;
  const up = $t`you were up at three letting out all the rope there was and setting it again. She's ${N.dragged} m downwind of where you left her${short ? $t(', brought up short of the shallows') : ''}.`;
  const bed = N.kind === 'mud' ? $t('soft mud, that holds less than sand') : N.kind === 'sand' ? $t('sand, but not dug in well') : $t`${N.kind}, poor holding for an anchor`;
  if (N.why === 'bottom') return $t`A gale blew through in the night, and she dragged her anchor: it was in ${bed}, and ${up} Sand holds far better (the fish finder reads the bottom), and the heavier anchor on chain from the Marine Works better still.`;
  if (N.why === 'scope') return $t`A gale blew through in the night, and she dragged her anchor: in ${Math.round(N.depth)} m of water there wasn't rope enough to give it a good scope, and the pull lifted it off the bottom. ${up[0].toUpperCase() + up.slice(1)} Shallower water, or the heavier anchor on chain from the Marine Works, and she'd have held.`;
  return $t`A gale blew through in the night, and out here in the open she dragged her anchor: ${up} Sheltered water (the bay, a cove, the estuary), or the heavier anchor on chain from the Marine Works, and she'd have held.`;
}
