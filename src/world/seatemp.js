import { yearPhase } from './season.js';
import { clamp, smoothstep } from '../util.js';

// The water's temperature (°C), for the conditions panel, the fish finder and the catch log.
//
// The sea at home follows the year a month or so behind the air: coldest at the end of winter
// (about 12°C), warmest at the end of summer (about 21°C). In summer the sun warms the top of it
// and the warm layer floats on colder water below, so the deep stays nearer 12-13°C (a
// thermocline from about eight metres down); the winter's gales mix it the same top to bottom.
// Fresh water swings further: the lakes from about 3°C to 21°C, the running rivers and streams
// cooler in summer, the tarn on the fell colder still; the estuary and the tideway between sea and
// river. At Las Brasas, in the trade wind far to the south, the sea runs from about 18.5°C to
// 23.5°C, and out on the crossing it changes from one to the other. On a still afternoon the
// shallows warm a little more.
//
// The season's effect on each kind of fish (season.js) already follows the water's warmth; this
// lets you read it.

const TAU = Math.PI * 2;
const FRESH_STILL = new Set(['lake', 'mere']);
const FRESH_RUNNING = new Set(['stream', 'river']);
const BRACKISH = new Set(['estuary', 'tideway']);

const homeSea = (p) => 16.5 + 4.5 * Math.cos(TAU * (p - 0.5));
const southSea = (p) => 21 + 2.5 * Math.cos(TAU * (p - 0.55));
const lake = (p) => 12 + 9 * Math.cos(TAU * (p - 0.45));
const running = (p) => 10 + 6 * Math.cos(TAU * (p - 0.45));
// How strongly the summer's warm top layer floats on the cold below (0 in winter … 1 in summer).
const layered = (p) => Math.max(0, Math.cos(TAU * (p - 0.4)));

// abs: the world's time (game hours); zone: zoneAt() where you are; depth: metres down;
// south: 0 at home … 1 at Las Brasas (in between on the crossing); hour: the time of day.
export function seaTemp({ abs, zone = 'open', depth = 0, south = 0, hour = 12 }) {
  const p = yearPhase(abs);
  let t;
  if (zone === 'tarn') t = lake(p) - 3;
  else if (FRESH_STILL.has(zone)) t = lake(p);
  else if (FRESH_RUNNING.has(zone)) t = running(p);
  else {
    const sea = homeSea(p) * (1 - south) + southSea(p) * south;
    t = BRACKISH.has(zone) ? (sea + running(p)) / 2 : sea;
    // Below the summer's warm layer, colder (at Las Brasas the warm layer runs much deeper).
    const deep = south > 0.5 ? smoothstep(40, 140, depth) * 3 : smoothstep(8, 25, depth) * layered(p) * (t - 12.5);
    t -= deep;
  }
  // A still afternoon warms the shallows (the top few metres) a little.
  const sun = Math.max(0, Math.sin(Math.PI * (hour - 8) / 12));
  t += 0.7 * sun * clamp(1 - depth / 4, 0, 1) * (FRESH_STILL.has(zone) ? 1.4 : 1);
  return Math.round(t * 10) / 10;
}

// In words, for the conditions panel: "16°C".
export const tempWords = (t) => `${Math.round(t)}°C`;
