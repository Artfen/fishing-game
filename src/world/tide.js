import { formatClock } from './sky.js';

// The tide: the sea rises and falls twice a day, high water coming about fifty minutes later each
// day; and over a fortnight the tides grow from small neaps to big springs and back. What it
// changes:
//  · the sea's level (the water rises up the beaches and the slipway, the boats with it: a modest
//    range in the game, about a metre at springs, a third of that at neaps);
//  · the tidal streams (see conditions.js: TIDE.flow): running out on the ebb, in on the flood,
//    strongest at half tide and on springs, slack at high and low water; and the lower Wend, which
//    the flood pushes back up its estuary;
//  · the fish of the sea, which feed best on a running tide, and some kinds best on the flood.
// One clock for both seas (it's the same moon).

export const TIDE_HOURS = 12.42;       // high water to high water
export const SPRING_DAYS = 14.77;      // springs to springs
export const RANGE = { springs: 1.0, neaps: 0.35 }; // metres, low water to high
const HW0 = 3.1;                       // the first high water, on day 0
const TAU = Math.PI * 2;

// How big the tides are today: 1 at springs, 0 at neaps.
export const springs = (abs) => 0.5 + 0.5 * Math.cos((TAU * (abs / 24 - 1)) / SPRING_DAYS);

// The tide at a moment (abs: the game's clock in hours, day × 24 + hour): { level (m, above the
// mean), flow (+1 running out at full strength on the ebb … −1 running in on the flood; 0 slack),
// rising, phase ('high' | 'ebb' | 'low' | 'flood'), springs (0 … 1) }.
export function tideAt(abs) {
  const sp = springs(abs), A = (RANGE.neaps + (RANGE.springs - RANGE.neaps) * sp) / 2;
  const th = (TAU * (abs - HW0)) / TIDE_HOURS;
  const level = A * Math.cos(th), s = Math.sin(th), c = Math.cos(th);
  // (Full strength at springs; at neaps the streams run at about half.)
  const strength = 0.45 + 0.55 * sp;
  const flow = s * strength;
  const slack = Math.abs(s) < 0.26;
  const phase = slack ? (c > 0 ? 'high' : 'low') : s > 0 ? 'ebb' : 'flood';
  return { level, flow, rising: s < 0, phase, springs: sp };
}

// The next high and low waters after `abs`: [{ kind: 'high' | 'low', at (abs hours) }].
export function turns(abs, n = 4) {
  const out = [];
  const k0 = Math.floor((abs - HW0) / (TIDE_HOURS / 2));
  for (let k = k0; out.length < n; k++) {
    const at = HW0 + k * (TIDE_HOURS / 2);
    if (at <= abs) continue;
    out.push({ kind: ((k % 2) + 2) % 2 === 0 ? 'high' : 'low', at });
  }
  return out;
}

// In words, for the conditions panel: "flooding · high water 2:32 pm".
export function tideWords(abs) {
  const T = tideAt(abs);
  // (At the turn, the next turn of the other kind.)
  const next = turns(abs, 2).find((x) => x.kind !== T.phase);
  const when = formatClock(next.at % 24);
  const now = T.phase === 'high' ? 'high water now' : T.phase === 'low' ? 'low water now' : T.phase === 'flood' ? 'flooding' : 'ebbing';
  return `${now} · ${next.kind} water ${when}`;
}
// Springs or neaps, in words.
export const sizeWords = (abs) => {
  const s = springs(abs);
  return s > 0.75 ? 'springs: big tides' : s < 0.25 ? 'neaps: small tides' : s > 0.5 ? 'tides growing towards springs' : 'middling tides';
};
// The day's tides, for the notice board: "High water 4:12 am and 4:37 pm; low water 10:25 am and
// 10:50 pm (springs: big tides)".
export function dayTides(day) {
  const start = day * 24;
  const all = turns(start - 0.001, 6).filter((t) => t.at < start + 24);
  const list = (kind) => all.filter((t) => t.kind === kind).map((t) => formatClock(t.at - start)).join(' and ');
  return `High water ${list('high')}; low water ${list('low')} (${sizeWords(start + 12)}).`;
}

// The fish of the sea, and the tide: a running tide brings the food to them, slack water quietens
// them; these few feed hardest on the flood, pushing up over ground the ebb left dry.
const FLOOD_FEEDERS = new Set(['seabass', 'mullet', 'flounder', 'plaice', 'sole', 'gilthead', 'meagre', 'senegalsole', 'sandsole', 'gurnard', 'baila']);
export function tideBoost(sp, tide) {
  if (!tide || sp.water === 'fresh' || sp.life?.big) return 1;
  const moving = Math.min(1, Math.abs(tide.flow) / 0.6);
  let k = 0.8 + 0.35 * moving;
  if (FLOOD_FEEDERS.has(sp.id) && tide.flow < -0.15) k += 0.15;
  return k;
}
