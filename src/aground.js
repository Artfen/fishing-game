// G6b of docs/PROGRESSION.md: a boat aground on a falling tide, a harder call on the radio. A little
// cabin boat has run up on one of the bay's sand banks near the top of the tide, and it's falling:
// get a line on her and pull her off into deep water before it leaves her high and dry (then she
// sits there till the flood, and the job's gone).
//
// Nothing here pretends: she's a real hull put down on the real seabed (boat.js place), sitting on
// it as the water leaves her (hydro.js groundForces: the less water under her, the more of her
// weight on the sand and the harder she is to shift), and you pull her off with a real towline.
// What this module does is choose the call fairly:
//  · the time she'll be dry, from the tide itself (tide.js): she's aground now, and the water
//    leaves the sand she's on by then. The tide here is a game's tide (a metre at springs, an hour in forty
//    seconds), so the call only comes when it's falling slowly enough to give a fair window: on
//    the top of the ebb, or at neaps;
//  · where she lies: a spot on a named bank whose seabed is just where the water will be when she
//    dries, level enough along her length to sit on, with deep water within twenty metres on the
//    seaward side to come in from (her bow swung round to it, so a line from her bow leads off the bank).
//
// Pure: the game passes in where you are and the clock, and does the rest (main.js).

import { solidHeight, freshness, zoneAt, FRESH_ZONES, stackHeight, heightAt } from './world/terrain.js';
import { tideAt } from './world/tide.js';

// The bay's banks: sand that covers and uncovers with the tide, each with deep water near.
// (The river's sand, where boats go aground: the bay's beaches shelve too steeply, or too
// unevenly, for a boat to sit on as the water leaves her. She'd slide off on her own, or lie on
// her side.)
export const BANKS = [
  { id: 'wendbar', name: 'the bar at the mouth of the Wend', x: 600, z: 80 },
  { id: 'saltings', name: 'the Saltings bank', x: 532, z: -108 },
];
// Her: the little cabin boat (boat.js HULLS.cabin: she draws 0.38 m).
export const AGROUND = { boat: 'cabin', draft: 0.38, length: 6.2 };
// The window: at least this long (game hours: two of them are eighty seconds of yours) from the
// call until she's dry, and looked for no further ahead than this; and she's aground when the call
// comes (no more water under her than most of what she draws), with some water left under her
// (this much at least).
export const WINDOW = { min: 2, max: 5, step: 0.05, aground: 0.12, most: 0.95 };
// A spot she can lie at (m): how much lower her bow may be than her stern, and one side than the
// other (half her beam out from her keel, each side); and the way in, straight off her bow: this
// much deeper, this far off.
export const SPOT = { along: 0.3, across: 0.12, beam: 0.8, wayIn: 10, deeper: 0.5 };
// How far from you a bank can be for the call (m): near enough to be there in time.
export const REACH = { near: 120, far: 800 };

// The sea's level at a moment (m), where the river freshens it by f (0 … 1: conditions.js damps the
// tide by the water's freshness, up the estuary).
export const levelAt = (abs, f = 0) => tideAt(abs).level * (1 - f);

// When the falling tide leaves the seabed at g (m) dry, where the river's share in the water is f, if
// it gives a fair window from now: she's aground now (some water under her, not most of what she
// draws), the tide falls all the way, and it's dry no sooner than W.min and no later than W.max
// hours from now. { dryAt (abs hours), drop (m: the water under her now) } or null.
export function dryTime(abs, g, f = 0, W = WINDOW, draft = AGROUND.draft) {
  const now = levelAt(abs, f), drop = now - g;
  if (tideAt(abs).rising || drop < W.aground || drop > draft * W.most) return null;
  let prev = now;
  for (let t = abs + W.step; t <= abs + W.max + 1e-9; t += W.step) {
    const l = levelAt(t, f);
    if (l > prev + 1e-6) return null; // (turned, rising again, before it left her)
    if (l <= g) return t - abs >= W.min ? { dryAt: t, drop } : null;
    prev = l;
  }
  return null;
}

// The water under a hull where she lies now (m), with the tide at `level` (conditions.js TIDE.level):
// negative, she's on dry sand.
export const waterUnder = (x, z, level) => level * (1 - freshness(x, z)) - solidHeight(x, z);
// Off the bank: floating clear (none of her on the bottom), in water this much deeper than she
// draws, for this long (s).
export const OFF = { clear: 0.15, secs: 3 };

// The spots on a bank she could lie at, worked out once a bank: a seabed between the tides, salt
// water, sand (not a stack's rock); her heading straight down the bank, gentle along her length and
// level across her beam (so she sits there as the water leaves her, not sliding off on her own);
// deep water straight off her bow within twenty-five metres. [{ x, z, g (the seabed, m), f (the river's share), heading (her bow to the
// deep water) }].
const SPOTS = new Map();
export function bankSpots(B) {
  if (SPOTS.has(B.id)) return SPOTS.get(B.id);
  const out = [], h = AGROUND.length / 2, w = SPOT.beam;
  for (let r = 0; r <= 120; r += 2) {
    const n = r ? Math.max(12, Math.round(r / 2)) : 1;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = Math.round((B.x + Math.sin(a) * r) * 10) / 10, z = Math.round((B.z + Math.cos(a) * r) * 10) / 10;
      const g = solidHeight(x, z);
      if (g > 0.6 || g < -0.6 || FRESH_ZONES.includes(zoneAt(x, z)) || stackHeight(x, z) >= heightAt(x, z) - 0.05) continue;
      // (Her heading: straight down the bank where she lies, so she's level across her beam.)
      const gx = (solidHeight(x + 2, z) - solidHeight(x - 2, z)) / 4, gz = (solidHeight(x, z + 2) - solidHeight(x, z - 2)) / 4, gl = Math.hypot(gx, gz);
      if (gl < 1e-4) continue;
      const dx = -gx / gl, dz = -gz / gl;
      // (Gentle along her and level across her, or as the water leaves her she slides off on her
      // own: bow and stern, and either side.)
      const bow = solidHeight(x + dx * h, z + dz * h), stern = solidHeight(x - dx * h, z - dz * h);
      const port = solidHeight(x - dz * w, z + dx * w), stbd = solidHeight(x + dz * w, z - dx * w);
      if (stern - bow > SPOT.along || Math.abs(port - stbd) > SPOT.across) continue;
      // (The way in: well deeper, straight off her bow, within twenty metres.)
      if (solidHeight(x + dx * SPOT.wayIn, z + dz * SPOT.wayIn) > g - SPOT.deeper) continue;
      out.push({ x, z, g, f: freshness(x, z), heading: Math.atan2(dx, dz) });
    }
  }
  SPOTS.set(B.id, out);
  return out;
}

// The call's spot, if there's a fair one: on the nearest bank within reach, the spot whose own dry
// time gives the window nearest three hours. { x, z, heading, bank, name, dryAt, drop } or null.
export function groundSpot(abs, from, { reach = REACH } = {}) {
  const banks = BANKS.map((B) => ({ B, d: Math.hypot(B.x - from.x, B.z - from.z) })).filter((b) => b.d >= reach.near && b.d <= reach.far).sort((a, b) => a.d - b.d);
  for (const { B } of banks) {
    let best = null;
    for (const s of bankSpots(B)) {
      const w = dryTime(abs, s.g, s.f);
      const e = w && Math.abs(w.dryAt - abs - 3);
      if (w && (!best || e < best.e)) best = { s, w, e };
    }
    if (best) return { x: best.s.x, z: best.s.z, heading: best.s.heading, bank: B.id, name: B.name, dryAt: best.w.dryAt, drop: best.w.drop };
  }
  return null;
}
