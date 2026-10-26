import { CROSSING, LIGHT } from './world/terrain.js';
import { SOUTH_Z, ISLE, FARO, PUERTO, brasaSDF } from './world/brasa.js';
import { clamp, lerp, smoothstep, seeded } from './util.js';

// The crossing: Las Brasas lies across the open Atlantic to the south of Willow Bay, in the same
// world, and you can sail there (or motor, in the yacht) the whole way, at the helm: out past
// Gannet Light, four and a half kilometres of open sea (about twenty-five minutes in the sailing
// boat, under twenty in the yacht: by the game's clock, a day or a day and a half at sea, through
// a night), and in round the island to Puerto Brasa. Or take the fast passage, as before: the same hours, the same fuel, and
// you're there.
//
//  · The route: from the home coast's open water off Gannet Light to the island's north-east
//    corner, then round Punta del Faro into the lee. A marker shows the way; the chart has a sheet
//    of its own for the open sea, with both coasts on it.
//  · The weather goes over from home's to the island's as you go: the wind backs into the
//    north-east trade over the middle of the crossing, and out in the middle the long Atlantic
//    swell runs bigger than either coast's.
//  · In that swell a motor boat can't be driven flat out: above a seakindly speed she pounds, so
//    you hold her there (the yacht makes about six knots out there; the sailing boat’s speed is
//    the wind's).
//  · Only a boat fit for it goes: the sailing boat, or the sport-fishing yacht with the fuel for
//    it. Anything smaller is turned back at the edge of the home chart.
//  · Along the way, seeded by the day and the way you're going: dolphins coming to the bow, a
//    whale's blow, flying fish off the bow in the warm water, birds working over tuna on the bait
//    (troll a lure past the edge of it), a turtle, a squall, with quiet stretches between. If the
//    weather turns, you choose: shorten sail (or ease her back) and carry on, turn back while you
//    can, or heave to and let it pass.

// The two ends: the home coast's open water off Gannet Light, and the island's north-east corner,
// off the coast before you round Punta del Faro.
export const ENDS = {
  home: { x: LIGHT.x + 180, z: LIGHT.z + 300, name: 'Gannet Light' },
  south: { x: 420, z: 5420, name: 'Las Brasas' },
};
// (Then round the point to the harbour.)
export const ROUND = { x: FARO.x + 160, z: FARO.z + 60 };
export const HARBOUR = { x: PUERTO.x + 20, z: PUERTO.z + 100 };
const DX = ENDS.south.x - ENDS.home.x, DZ = ENDS.south.z - ENDS.home.z;
export const CROSS_M = Math.hypot(DX, DZ); // metres of open sea, end to end

// How far across, 0 (off Gannet Light) to 1 (off the island), along the line between the ends.
export function crossProgress(x, z) {
  return clamp(((x - ENDS.home.x) * DX + (z - ENDS.home.z) * DZ) / (CROSS_M * CROSS_M), 0, 1);
}
// Out on the crossing's open water (between the coasts), not in either's own waters.
export function onCrossing(x, z) {
  return z > ENDS.home.z && z < ENDS.south.z && x > CROSSING.x0 && x < CROSSING.x1 && !(z > SOUTH_Z && brasaSDF(x, z) < 600);
}
// Past the edge of the home chart (or the island's), out into the open Atlantic between them.
export const inOcean = (x, z) => z > CROSSING.z0 && z < CROSSING.z1 && x > CROSSING.x0 && x < CROSSING.x1;
// Arrived: in the island's waters (south), or back in the home coast's (home).
export function arrived(to, x, z) {
  return to === 'south' ? z > ENDS.south.z || (z > SOUTH_Z && brasaSDF(x, z) < 650) : z < ENDS.home.z;
}

// The weather over the crossing: how far into the north-east trade wind (0 home's own weather …
// 1 the trades), and how far out into the open Atlantic (0 near either coast … 1 mid-ocean), where
// the long swell runs bigger.
export const tradeAt = (z) => smoothstep(2300, 3700, z);
// (Inside either chart, only once you've set out on the crossing: off Gannet Light it's the open
// Atlantic then. Otherwise home's Blue Water and the island's are fished as they always were.)
export const oceanAt = (z, crossing = false) => (crossing
  ? smoothstep(ENDS.home.z, ENDS.home.z + 400, z) * (1 - smoothstep(4700, 5000, z))
  : smoothstep(CROSSING.z0, CROSSING.z0 + 400, z) * (1 - smoothstep(CROSSING.z1, CROSSING.z1 + 400, z)));
// The fastest a motor boat goes comfortably out there (m/s): about six knots in the usual long
// swell (her hull speed: above it she climbs the backs of the seas and slams down off them), less
// as the sea gets up; near either coast, no limit (Infinity).
export function seaKindly(ocean, swell = 0.3, eased = false) {
  if (ocean <= 0.01) return Infinity;
  const cap = (2.8 - 0.7 * smoothstep(0.6, 1.6, swell)) * (eased ? 0.8 : 1);
  return lerp(14, cap, ocean);
}

// The boats that can make it, and how fast each goes on average across (for the fast passage's
// hours and fuel, matching what the helm would take: the sailing boat in the trade wind on the
// quarter, the yacht at her seakindly speed in the middle and flat out near the coasts).
export const LONG_RANGE = ['sail', 'cruiser'];
export const AVG_SPEED = { sail: 3.0, cruiser: 3.9 };
export const HOUR_S = 40; // real seconds in a game hour (see townsfolk.js HOUR_SECONDS)
export const crossSeconds = (kind) => CROSS_M / (AVG_SPEED[kind] || 3);
export const crossHours = (kind) => crossSeconds(kind) / HOUR_S;
// The yacht's diesel for it: what she burns with the lever down the whole way, and what she must
// have aboard to set out (a margin over that).
export const CROSS_FUEL = (perSecond) => Math.round(crossSeconds('cruiser') * perSecond);
export const NEED_FUEL = (perSecond) => Math.round(CROSS_FUEL(perSecond) * 1.4 + 10);

// Words for a bearing (compass radians: 0 north, -z; π south, +z).
const POINTS = ['north', 'north by east', 'north-north-east', 'north-east by north', 'north-east', 'north-east by east', 'east-north-east', 'east by north', 'east', 'east by south', 'east-south-east', 'south-east by east', 'south-east', 'south-east by south', 'south-south-east', 'south by east', 'south', 'south by west', 'south-south-west', 'south-west by south', 'south-west', 'south-west by west', 'west-south-west', 'west by south', 'west', 'west by north', 'west-north-west', 'north-west by west', 'north-west', 'north-west by north', 'north-north-west', 'north by west'];
export function bearingTo(fx, fz, tx, tz) {
  const b = Math.atan2(tx - fx, -(tz - fz));
  return (b + Math.PI * 2) % (Math.PI * 2);
}
export const pointWords = (b) => POINTS[Math.round((b / (Math.PI * 2)) * 32) % 32];
// Where to steer for now: across to the far end, then (going south) round the point to the harbour.
export function steerFor(to, x, z) {
  if (to === 'home') return { x: ENDS.home.x, z: ENDS.home.z - 200, name: 'Gannet Light' };
  if (z < ENDS.south.z - 150 && brasaSDF(x, z) > 650) return { x: ENDS.south.x, z: ENDS.south.z, name: 'Las Brasas' };
  if (z < ROUND.z - 40) return { x: ROUND.x, z: ROUND.z, name: 'Punta del Faro' };
  return { x: HARBOUR.x, z: HARBOUR.z, name: 'Puerto Brasa' };
}

// What happens along the way: seeded by the day you set out and the way you're going, so the
// same day's crossing is the same crossing (and a different day's, different). Each at a point
// across (z), with quiet water between.
export const ENCOUNTERS = {
  dolphins: { warm: false, words: 'dolphins' },
  whale: { warm: false, words: 'a whale' },
  boil: { warm: false, words: 'birds working over tuna' },
  flyingfish: { warm: true, words: 'flying fish' },
  turtle: { warm: true, words: 'a loggerhead turtle' },
  squall: { warm: false, words: 'a squall' },
};
export function planCrossing(day, to) {
  const r = seeded(Math.imul(day + 11, 0x9e3779b1) ^ (to === 'south' ? 0x1234567 : 0x7654321));
  const pick = (a) => a[Math.floor(r() * a.length) % a.length];
  // Always something big (dolphins or a whale), birds over tuna, and in the warm half flying fish;
  // then one or two of the rest.
  const kinds = [pick(['dolphins', 'whale', 'dolphins']), 'boil', 'flyingfish'];
  const rest = ['dolphins', 'whale', 'turtle', 'squall', 'turtle'].filter((k) => !kinds.includes(k));
  kinds.push(pick(rest));
  if (r() < 0.6) kinds.push(pick(rest.filter((k) => !kinds.includes(k))));
  // Where: spread across the crossing, the warm-water ones in its southern half, never two close.
  // (Of a few places the dice offer for each, the one furthest from the rest.)
  // (Never past where you'd make landfall: the island's waters start well short of the far end.)
  const z0 = ENDS.home.z + 350, z1 = 4750, warmFrom = 3000;
  const out = [];
  for (const kind of [...kinds].sort((a, b) => ENCOUNTERS[b].warm - ENCOUNTERS[a].warm)) {
    const lo = ENCOUNTERS[kind].warm ? warmFrom : z0;
    let best = null, gap = -1;
    for (let k = 0; k < 24; k++) {
      const z = lo + r() * (z1 - lo), g = Math.min(Infinity, ...out.map((e) => Math.abs(e.z - z)));
      if (g > gap) {
        gap = g;
        best = z;
      }
    }
    if (gap > 420) out.push({ kind, z: Math.round(best), done: false });
  }
  // In the order you'll meet them.
  return out.sort((a, b) => (to === 'south' ? a.z - b.z : b.z - a.z));
}

// A crossing under way, kept in the save: where to, in what, when you set out, how long at the
// helm so far (real seconds), what's happened along the way, and how the weather was answered.
export function cleanCrossing(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (raw.to !== 'south' && raw.to !== 'home') return null;
  if (!LONG_RANGE.includes(raw.kind)) return null;
  const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
  const events = Array.isArray(raw.events) ? raw.events.filter((e) => e && ENCOUNTERS[e.kind]).slice(0, 8).map((e) => ({ kind: e.kind, z: num(e.z, 3000, CROSSING.z0 - 600, CROSSING.z1 + 900), done: !!e.done })) : [];
  return {
    to: raw.to, kind: raw.kind, day: Math.round(num(raw.day, 1, 1, 1e6)), abs: num(raw.abs, 24, 0, 1e7), secs: num(raw.secs, 0, 0, 1e6),
    events, weather: ['carry', 'back', 'wait', null].includes(raw.weather) ? raw.weather : null, eased: !!raw.eased, back: !!raw.back,
  };
}
// Your crossings: how many each way, and the quickest at the helm (minutes) in each boat.
export function cleanPassages(raw) {
  const out = { south: 0, home: 0, fast: 0, best: {} };
  if (!raw || typeof raw !== 'object') return out;
  const int = (v) => (Number.isFinite(v) ? Math.max(0, Math.min(9999, Math.round(v))) : 0);
  out.south = int(raw.south);
  out.home = int(raw.home);
  out.fast = int(raw.fast);
  if (raw.best && typeof raw.best === 'object') for (const k of LONG_RANGE) if (Number.isFinite(raw.best[k]) && raw.best[k] > 0) out.best[k] = Math.round(raw.best[k] * 10) / 10;
  return out;
}

// The island seen from the crossing (for the words when it comes up over the horizon).
export const ISLAND_SEEN = ISLE.z - ISLE.rz - 2600;
