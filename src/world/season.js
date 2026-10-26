import { formatClock } from './sky.js';

// The year: spring, summer, autumn and winter, a week of days each (a short year, so a season
// comes round while you're still playing). A new game starts in the middle of spring. What turns
// with it:
//  · the day's length: the sun up before five and down after half past eight at midsummer; up at
//    half past eight and gone by five in midwinter (the sky, the light and the lamps follow it);
//  · the air's warmth (and so how you feel: see comfort.js), a few degrees either way;
//  · which fish are about: mackerel and the summer visitors (bass, mullet, garfish, the tunas) come
//    in with the warm water and are gone in winter; squid crowd inshore in autumn and winter, pike
//    and grayling come into their own as the year turns; the lake's carp and tench go torpid;
//  · the rivers: a winter spate, low summer water;
//  · the leaves: fresh in spring, deep green in summer, gold and rust in autumn, dull and sparse in
//    winter (the pines stay green);
//  · the harbour's people: no cruising boats in winter, no mackerel for Ian, no crabbing for Kit.
// (Las Brasas, far south in the trade wind, has hardly any winter: its fish barely notice.)

export const SEASON_DAYS = 7;
export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];
const YEAR = SEASON_DAYS * 4;
const START = 3.5; // day 1 is half way through spring
const TAU = Math.PI * 2;

// Where in the year a moment is (0 … 1, from the start of spring): abs, the game's clock in hours.
export const yearPhase = (abs) => ((((abs / 24 - 1 + START) / YEAR) % 1) + 1) % 1;
// The season of a day: { name, index, dayOf (1 … 7), year (1, 2 …) }.
export function seasonOf(day) {
  const n = day - 1 + START;
  const index = Math.floor(n / SEASON_DAYS) % 4;
  return { name: SEASONS[index], index, dayOf: Math.floor(n % SEASON_DAYS) + 1, year: Math.floor(n / YEAR) + 1 };
}
// "Early spring", "Midsummer", "Late autumn".
export function seasonWords(day) {
  const S = seasonOf(day);
  if (S.dayOf >= 3 && S.dayOf <= 5) return S.name === 'summer' ? 'Midsummer' : S.name === 'winter' ? 'Midwinter' : `Mid-${S.name}`;
  return `${S.dayOf <= 2 ? 'Early' : 'Late'} ${S.name}`;
}

// Sunrise and sunset (clock hours): a long day at midsummer, a short one at midwinter.
export function sunTimes(abs) {
  const len = 12.4 + 3.8 * Math.cos(TAU * (yearPhase(abs) - 0.375));
  const noon = 12.7;
  return { rise: noon - len / 2, set: noon + len / 2, length: len };
}
// The sun's hour: the clock mapped onto the sky's own day (sunrise 5:36, sunset 19:36), so the
// light, the colours and the stars follow the season.
export function sunHour(hour, abs) {
  const { rise, set } = sunTimes(abs);
  if (hour >= rise && hour <= set) return 5.6 + ((hour - rise) / (set - rise)) * 14;
  const night = 24 - (set - rise), into = (((hour - set) % 24) + 24) % 24;
  return (19.6 + (into / night) * 10) % 24;
}
// How much warmer (or colder) the air is than the year's mean, °C.
export const seasonWarmth = (abs) => 4.5 * Math.cos(TAU * (yearPhase(abs) - 0.42)) - 0.5;
// How full the rivers run (1 as they are; up to half as much again in winter, down by a third in
// summer), before any rain.
export const riverFlow = (abs) => 1.1 + 0.4 * Math.cos(TAU * (yearPhase(abs) - 0.875));

// The leaves' colour, as a tint on their green: [r, g, b] multipliers.
export function leafTint(abs) {
  const P = [[1.04, 1.1, 0.86], [0.92, 0.96, 0.9], [1.85, 0.78, 0.3], [1.0, 0.76, 0.58]];
  return blend(P, abs);
}
function blend(P, abs) {
  // Each season's value at its middle, easing into the next.
  const x = yearPhase(abs) * 4 - 0.5, i = Math.floor(x), f = x - i;
  const a = P[((i % 4) + 4) % 4], b = P[(((i + 1) % 4) + 4) % 4];
  const k = f * f * (3 - 2 * f);
  return a.map((v, j) => v + (b[j] - v) * k);
}

// The fish and the year: how active each kind is in spring, summer, autumn and winter (1 as
// usual). Kinds not listed don't mind.
export const SEASON_FISH = {
  mackerel: [0.5, 1.3, 1.0, 0.12], garfish: [1.1, 1.1, 0.6, 0.15], sardine: [0.6, 1.2, 1.0, 0.4],
  horsemackerel: [0.7, 1.2, 1.0, 0.5], bonito: [0.3, 1.2, 1.0, 0.1], bullet: [0.4, 1.2, 1.0, 0.2],
  albacore: [0.2, 1.3, 0.9, 0.05], tuna: [0.1, 0.9, 1.3, 0.1], blueshark: [0.3, 1.3, 0.9, 0.1], mako: [0.4, 1.3, 0.9, 0.2],
  seabass: [0.9, 1.15, 1.15, 0.35], mullet: [0.8, 1.2, 1.0, 0.5], gilthead: [0.7, 1.2, 1.1, 0.3], meagre: [0.6, 1.2, 1.1, 0.3],
  squid: [0.6, 0.5, 1.3, 1.2], cuttlefish: [1.3, 1.0, 0.7, 0.4],
  plaice: [0.9, 1.1, 1.0, 0.6], sole: [1.0, 1.1, 1.0, 0.6], turbot: [0.8, 1.2, 1.0, 0.5], flounder: [1.0, 0.9, 1.1, 0.8],
  pollack: [0.9, 1.0, 1.2, 1.0], wrasse: [1.0, 1.2, 1.0, 0.4],
  trout: [1.0, 0.8, 1.1, 0.35], grayling: [0.8, 0.9, 1.2, 1.1], perch: [1.0, 1.0, 1.1, 0.8], pike: [0.8, 0.7, 1.3, 1.1],
  carp: [0.8, 1.2, 1.0, 0.25], tench: [0.8, 1.2, 0.9, 0.2], roach: [0.9, 1.1, 1.0, 0.6], rudd: [0.8, 1.2, 1.0, 0.4],
};
export function seasonBoost(sp, abs) {
  const row = SEASON_FISH[sp.id];
  if (!row || abs == null) return 1;
  // (Las Brasas' fish, in the warm south: the year barely touches them.)
  if (sp.life?.southGroups && !sp.life?.zones?.some((z) => !['harbor', 'lee', 'lava', 'sebadal', 'veril', 'ocean'].includes(z))) return 1;
  return blend(row.map((v) => [v]), abs)[0];
}

// For the notice board: "Late spring: sunrise 5:10, sunset 8:30 pm."
export function seasonLine(abs) {
  const t = sunTimes(abs);
  return `${seasonWords(Math.floor(abs / 24))}: sunrise ${formatClock(t.rise)}, sunset ${formatClock(t.set)}.`;
}
