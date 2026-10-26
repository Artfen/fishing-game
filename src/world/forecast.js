import { seasonOf } from './season.js';
import { formatClock } from './sky.js';
import { seeded } from '../util.js';

// Gales: the big storms off the Atlantic don't come out of nowhere any more. Each is known about a
// day ahead (the notice board's outlook), comes in over hours (the cloud thickening, then rain,
// then the wind getting up), blows for four to eight hours, and takes a few more to clear. They're
// rare (once a fortnight or so in summer, two or three times a week in winter) and they matter:
// out past the bay it's white water, so you get warnings in time to come in. Sheltered water (the
// estuary, the coves, the bay, the lakes and rivers) is the place to be, and the fish there feed
// hard in a blow and in the coloured water after it, while the open sea goes dead.
// (Only at home: Las Brasas' trade-wind weather hardly knows a gale.)

const CHANCE = { spring: 0.12, summer: 0.07, autumn: 0.22, winter: 0.32 };
const dice = (day, salt) => seeded(Math.imul(day + 7, 0x9e3779b1) ^ (salt * 0x85ebca6b))();

// The gale due on a day, if any: { day, start, end (game hours), } (start between 9 am and 9 pm).
export function galeFor(day) {
  if (dice(day, 13) >= CHANCE[seasonOf(day).name]) return null;
  const start = day * 24 + 9 + dice(day, 17) * 12;
  return { day, start, end: start + 4 + dice(day, 19) * 4 };
}
// The gale near a moment: coming (up to a day ahead), blowing, or clearing (a few hours after).
export function galeNear(abs) {
  const day = Math.floor(abs / 24);
  for (const d of [day - 1, day, day + 1, day + 2]) {
    const g = galeFor(d);
    if (g && abs >= g.start - 30 && abs < g.end + 4) return g;
  }
  return null;
}
// The sky a gale makes of the day around it (or null, and the weather goes its own way): cloud
// building from seven hours before, rain from three and a half, heavy rain the last hour or so,
// the storm itself, then heavy rain and showers as it clears.
export function galeSky(abs) {
  const g = galeNear(abs);
  if (!g) return null;
  const to = g.start - abs, after = abs - g.end;
  if (to > 7) return null;
  if (to > 3.5) return 'overcast';
  if (to > 1.2) return 'light';
  if (to > 0) return 'heavy';
  if (after < 0) return 'storm';
  if (after < 1.5) return 'heavy';
  if (after < 4) return 'light';
  return null;
}

// The outlook, for the board: today's and tomorrow's.
export function outlook(abs) {
  const day = Math.floor(abs / 24), out = [];
  const at = (g) => `from about ${formatClock(g.start % 24)} until ${formatClock(g.end % 24)}`;
  const today = galeFor(day), tomorrow = galeFor(day + 1), last = galeFor(day - 1);
  if (last && abs < last.end) out.push(`Storm warning: a gale is blowing until about ${formatClock(last.end % 24)}. Keep to sheltered water.`);
  if (today && abs < today.end) out.push(abs >= today.start ? `Storm warning: a gale is blowing until about ${formatClock(today.end % 24)}. Keep to sheltered water: the estuary, the coves, the bay, the lakes.` : `Gale warning for today, ${at(today)}. Be within reach of shelter before then.`);
  else if (!last || abs >= last.end) out.push('Today: no gales expected.');
  out.push(tomorrow ? `Tomorrow: a gale ${at(tomorrow)}.` : 'Tomorrow: no gales expected.');
  return out;
}
// How long until the next gale arrives (hours), if one's on the way within a day.
export function hoursToGale(abs) {
  const g = galeNear(abs);
  return g && abs < g.start ? g.start - abs : null;
}

// In a blow, and after: the fish of sheltered water feed hard (the food churned up, the water
// coloured), the open sea's go quiet. zone: the fish's home zone; storming (0 … 1): the storm as it
// is; after (0 … 1): what's left of a blow's after-effect, fading over eight hours.
const SHELTERED = new Set(['bay', 'cove', 'lake', 'stream', 'estuary', 'mere', 'river', 'tarn', 'tideway']);
export function blowFactor(zone, storming = 0, after = 0) {
  const sheltered = SHELTERED.has(zone);
  if (storming > 0.3) return sheltered ? 1.35 : 0.55;
  return 1 + (sheltered ? 0.35 : 0.15) * after;
}
