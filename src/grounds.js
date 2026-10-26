import { fishById } from './fish.js';
import { TACKLE } from './tackle.js';
import { lower, an } from './innTalk.js';
import { clamp } from './util.js';

// Learning the grounds: what the water tells you, and what you've learned from it.
//
//  · Signs: the things you see on the water (birds working, the sea boiling, nervous water, rings,
//    a fish jumping, a flash, carp fizzing) are noted as you see them; catch a fish right where you
//    saw one, soon after, and you find out what it was: "the birds were right: mackerel under
//    them". The journal keeps how often you've seen each and what you found under it.
//  · The grounds: what you've caught at each place, and when it came: on which tide, at what time
//    of day, in which season, in clear or coloured water, on what bait or lure. Only what your own
//    catches show, and only once there are enough of them to say so.
//  · The water's colour: rain and a blow stir up the silt; it settles over most of a day. Bass,
//    conger and the flatfish hunt by smell and feel and feed bolder in coloured water; the fish that
//    hunt by sight (mackerel, garfish, wrasse, pollack, the breams) do worse in it.
//  · The naturalist's notes: the life on the seabed and the reef you've met under the water.

/* ---------------- signs on the water ---------------- */

const whatWas = (sp) => {
  const f = fishById[sp];
  if (!f) return 'fish';
  const name = lower(f.name);
  return f.life.school ? `a shoal of ${name}` : an(name);
};
export const SIGNS = {
  birds: { name: 'Birds working', note: 'Gulls and gannets wheeling and diving over one patch of water.', lesson: (sp) => `The birds were right: ${whatWas(sp)} under them. Where gulls and gannets dive, bait has been driven to the top, and something is driving it.` },
  boil: { name: 'The sea boiling', note: 'White water out in the open, as if it were boiling.', lesson: (sp) => `That boil was ${whatWas(sp)}, crashing through the bait at the top.` },
  nervous: { name: 'Nervous water', note: 'A patch of tiny dimples on calm water, as if a breeze touched only there.', lesson: (sp) => `That nervous water was ${whatWas(sp)}, right under the surface.` },
  rise: { name: 'Rings', note: 'Rings spreading on calm water.', lesson: (sp) => `Those rings were ${whatWas(sp)} rising to feed.` },
  jump: { name: 'A fish jumping', note: 'A fish clean out of the water, and the splash.', lesson: (sp) => `The fish you saw jump was ${whatWas(sp)}.` },
  splash: { name: 'A splash', note: 'Something swirling at the top.', lesson: (sp) => `That splash was ${whatWas(sp)} taking something at the top.` },
  flash: { name: 'A flash', note: 'A wink of silver under the surface.', lesson: (sp) => `The flash was ${whatWas(sp)} turning under the surface, catching the light.` },
  fizz: { name: 'Fizzing bubbles', note: 'Patches of tiny bubbles on still water.', lesson: (sp) => `The fizzing was ${whatWas(sp)} grazing the bottom, stirring up the mud.` },
};
// How near you have to be to see one, and how near a catch has to be to it to tell you what it was.
export const SEEN_AT = { birds: 320, boil: 200, nervous: 45, rise: 50, jump: 70, splash: 50, flash: 25, fizz: 30 };
const READ_AT = { birds: 60, boil: 45 };
const RECENT_H = 0.75; // game hours a sign stays fresh

// A sign you've just seen (if it's a new one, not the same birds again): into the recent list and
// the record. recent: [{ kind, sp, x, z, abs }] (not saved). Returns true if it counted.
export function seeSign(grounds, recent, c, abs, day) {
  if (!SIGNS[c.type]) return false;
  for (let i = recent.length - 1; i >= 0; i--) if (abs - recent[i].abs > RECENT_H) recent.splice(i, 1);
  const same = recent.find((r) => r.kind === c.type && Math.hypot(r.x - c.x, r.z - c.z) < (READ_AT[c.type] || 20) && abs - r.abs < 0.25);
  if (same) {
    // (The same patch going on: it stays fresh, and keeps the latest fish in it.)
    Object.assign(same, { x: c.x, z: c.z, abs, sp: c.sp });
    return false;
  }
  recent.push({ kind: c.type, sp: c.sp, x: c.x, z: c.z, abs });
  if (recent.length > 40) recent.shift();
  const S = (grounds.signs[c.type] ||= { seen: 0, read: 0, sp: {}, first: day });
  S.seen++;
  return true;
}
// A catch: was it under a sign you saw, just now? Then you've read that sign: { kind, sp, first }.
export function readSign(grounds, recent, sp, x, z, abs) {
  let best = null;
  for (const r of recent) {
    if (r.sp !== sp || abs - r.abs > RECENT_H || abs < r.abs - 0.01) continue;
    const d = Math.hypot(r.x - x, r.z - z);
    if (d > (READ_AT[r.kind] || 25)) continue;
    if (!best || r.abs > best.abs) best = r;
  }
  if (!best) return null;
  recent.splice(recent.indexOf(best), 1);
  const S = (grounds.signs[best.kind] ||= { seen: 1, read: 0, sp: {}, first: 1 });
  S.read++;
  S.sp[sp] = (S.sp[sp] || 0) + 1;
  return { kind: best.kind, sp, first: S.read === 1 };
}

/* ---------------- the grounds: what your catches say ---------------- */

const timeOf = (h) => (h >= 4.5 && h < 8 ? 'dawn' : h >= 8 && h < 17.5 ? 'day' : h >= 17.5 && h < 21.5 ? 'dusk' : 'night');
const bump = (o, k) => {
  if (k) o[k] = (o[k] || 0) + 1;
};
// For each place you've caught fish at (most fished first): its kinds (most caught first), each
// with how many, the best, and the tides, times of day, seasons, water and tackle they came on.
export function groundsOf(log) {
  const places = new Map();
  for (const e of log) {
    if (!e.place || !fishById[e.sp]) continue;
    let P = places.get(e.place);
    if (!P) places.set(e.place, (P = { place: e.place, n: 0, kinds: new Map() }));
    P.n++;
    let K = P.kinds.get(e.sp);
    if (!K) P.kinds.set(e.sp, (K = { sp: e.sp, n: 0, best: 0, tide: {}, time: {}, season: {}, colour: {}, item: {} }));
    K.n++;
    K.best = Math.max(K.best, e.size);
    bump(K.tide, e.tide);
    bump(K.time, timeOf(e.hour));
    bump(K.season, e.season);
    bump(K.colour, e.colour || 'clear');
    bump(K.item, e.item);
  }
  return [...places.values()].sort((a, b) => b.n - a.n).map((P) => ({ place: P.place, n: P.n, kinds: [...P.kinds.values()].sort((a, b) => b.n - a.n) }));
}
// The one that stands out, if one does (at least `share` of them, out of three or more).
function standsOut(counts, n, share = 0.6) {
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  return n >= 3 && top && top[1] / n >= share ? top[0] : null;
}
const TIDE_WORDS = { flood: 'on the flood', ebb: 'on the ebb', high: 'around high water', low: 'around low water' };
const TIME_WORDS = { dawn: 'at dawn', day: 'in the day', dusk: 'at dusk', night: 'after dark' };
// One kind at one place, in words: "Atlantic mackerel: 14 (best 38 cm), mostly on the flood, at
// dawn, in summer; most on a string of feathers."
export function groundWords(K) {
  const name = fishById[K.sp] ? lower(fishById[K.sp].name) : K.sp;
  const head = `${name[0].toUpperCase()}${name.slice(1)}: ${K.n}${K.best ? ` (best ${K.best} cm)` : ''}`;
  const when = [];
  const tide = standsOut(K.tide, K.n);
  if (tide) when.push(TIDE_WORDS[tide]);
  const twilight = (K.time.dawn || 0) + (K.time.dusk || 0);
  const time = standsOut(K.time, K.n);
  if (time) when.push(TIME_WORDS[time]);
  else if (K.n >= 3 && twilight / K.n >= 0.6) when.push('at dawn and dusk');
  const season = standsOut(K.season, K.n, 0.7);
  if (season) when.push(`in ${season}`);
  const colour = standsOut(K.colour, K.n, 0.6);
  if (colour === 'coloured' || colour === 'tinged') when.push('in coloured water');
  const item = standsOut(K.item, K.n, 0.45);
  const on = item && TACKLE[item] ? `most on ${TACKLE[item].on}` : '';
  return `${head}${when.length ? `, mostly ${when.join(', ')}` : ''}${on ? `; ${on}` : ''}.`;
}

/* ---------------- the water's colour ---------------- */

// How coloured the sea is (0 clear … 1 thick with silt) after `hours` more of this weather: rain
// and a blow stir it up within an hour or two; it settles over most of a day.
export function stepColour(c, { rain = 0, storm = 0 }, hours) {
  const target = clamp(Math.max(rain * 0.7, storm), 0, 1);
  if (hours <= 0) return c;
  if (target > c) return c + (target - c) * (1 - Math.exp(-hours / 1.5));
  return Math.max(target, c * Math.exp(-hours / 8));
}
export const colourKey = (c) => (c < 0.15 ? 'clear' : c < 0.45 ? 'tinged' : 'coloured');
export const colourWords = (c) => ({ clear: 'clear', tinged: 'a little colour in it', coloured: 'coloured, after the weather' })[colourKey(c)];
const BY_FEEL = new Set(['seabass', 'conger', 'flounder', 'plaice', 'sole', 'sandsole', 'turbot', 'gurnard', 'meagre', 'senegalsole', 'eel']);
const BY_SIGHT = new Set(['mackerel', 'garfish', 'wrasse', 'pollack', 'blackbream', 'whitebream', 'bluefish', 'bonito', 'horsemackerel', 'sardine', 'squid', 'cuttlefish', 'bogue', 'salema']);
export function colourFactor(sp, c) {
  if (!c || sp.water === 'fresh') return 1;
  if (BY_FEEL.has(sp.id)) return 1 + 0.35 * c;
  if (BY_SIGHT.has(sp.id)) return 1 - 0.4 * c;
  return 1;
}

/* ---------------- the naturalist's notes ---------------- */

// The life you meet under the water (besides the fish, which have the field guide): what it is,
// and a line on it. Seen up close (a couple of metres off) while you're diving.
export const NATURE = {
  star: { name: 'Common starfish', latin: 'Asterias rubens', note: 'Five arms, orange to purple, rough with pale spines. It pulls a mussel open with its tube feet and turns its stomach out into it.' },
  brittle: { name: 'Brittlestar', latin: 'Ophiura', note: 'A little disc and five thin, snaking arms. On soft sand they lie in their thousands, arms up to catch what drifts by.' },
  urchin: { name: 'Edible sea urchin', latin: 'Echinus esculentus', note: 'A round test the size of a fist, pink to purple, its spines short. It grazes the rock bare of weed and the tiny animals on it.' },
  scallop: { name: 'King scallop', latin: 'Pecten maximus', note: 'It lies in a hollow in the sand, flat shell up, a row of tiny blue eyes along its edge; it swims away by clapping its shells.' },
  hermit: { name: 'Hermit crab', latin: 'Pagurus bernhardus', note: 'It lives in an empty whelk shell and moves house as it grows. The bigger ones often carry an anemone on the shell.' },
  ceri: { name: 'Burrowing anemone', latin: 'Cerianthus lloydii', note: 'It lives in a slimy tube in the sand, a crown of long fine tentacles spread to catch food; touch it and it whips down out of sight.' },
  pen: { name: 'Phosphorescent sea pen', latin: 'Pennatula phosphorea', note: 'A feathery colony on a stalk, standing out of the soft sand in deeper water. Touched at night it glows green.' },
  cast: { name: 'Lugworm casts', latin: 'Arenicola marina', note: 'The coiled casts of lugworms, each living in a U-shaped burrow under the sand. Anglers dig them for bait.' },
  dahlia: { name: 'Dahlia anemone', latin: 'Urticina felina', note: 'A thick, warty column and a crown of stubby banded tentacles, red, cream and green. It catches shrimps and little fish.' },
  jewel: { name: 'Jewel anemone', latin: 'Corynactis viridis', note: 'Tiny anemones with knobbed tentacle tips, in sheets of one bright colour: pink, green, orange, violet. Each sheet is one anemone, split again and again.' },
  fingers: { name: 'Dead man’s fingers', latin: 'Alcyonium digitatum', note: 'A soft coral: fleshy lobes, white or orange, that put out fluffy feeding polyps when the tide runs. On rock and wrecks.' },
  plumose: { name: 'Plumose anemone', latin: 'Metridium dianthus', note: 'Tall, white or orange, with a feathery crown of fine tentacles; thickest on wrecks and pinnacles where the tide runs hard.' },
  fan: { name: 'Pink sea fan', latin: 'Eunicella verrucosa', note: 'A gorgonian coral, a fan of branches standing across the current to sieve it. Slow-growing: a fan as tall as your hand can be decades old. Protected.' },
  sponge: { name: 'Sponges', latin: 'Porifera', note: 'Yellow and orange cushions on the rock, pumping the water through themselves to filter it.' },
  kelp: { name: 'Kelp', latin: 'Laminaria hyperborea', note: 'A stiff stalk and a broad blade split into fingers. A kelp forest shelters fish, crabs and a crust of life on every stalk.' },
  red: { name: 'Red seaweeds', latin: 'Rhodophyta', note: 'Delicate red weeds under the kelp, where the light is dim: their red pigment uses the blue-green light that reaches down.' },
  lobster: { name: 'European lobster', latin: 'Homarus gammarus', note: 'Blue-black, with two great unequal claws, one for crushing and one for cutting. It lives in a hole under a ledge and comes out at night.' },
  mussel: { name: 'Swan mussel', latin: 'Anodonta cygnea', note: 'A big thin-shelled mussel half buried in the lake mud, filtering the water. Its young ride on the gills of fish.' },
};
export const NATURE_IDS = Object.keys(NATURE);
// Met one: into the notes ({ n, day, hour, where }). Returns true the first time.
export function noteNature(grounds, kind, { day, hour, where = '' }) {
  if (!NATURE[kind]) return false;
  const N = grounds.notes[kind];
  if (N) {
    N.n++;
    return false;
  }
  grounds.notes[kind] = { n: 1, day, hour, where };
  return true;
}

/* ---------------- the save ---------------- */

export const newGrounds = () => ({ signs: {}, notes: {} });
const num = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d);
export function cleanGrounds(raw) {
  const g = newGrounds();
  if (!raw || typeof raw !== 'object') return g;
  for (const [k, v] of Object.entries(raw.signs || {})) {
    if (!SIGNS[k] || !v || typeof v !== 'object') continue;
    const sp = {};
    for (const [id, n] of Object.entries(v.sp || {})) if (fishById[id]) sp[id] = Math.round(num(n, 1, 1, 1e6));
    g.signs[k] = { seen: Math.round(num(v.seen, 0, 0, 1e7)), read: Math.round(num(v.read, 0, 0, 1e7)), sp, first: Math.round(num(v.first, 1, 1, 1e6)) };
  }
  for (const [k, v] of Object.entries(raw.notes || {})) {
    if (!NATURE[k] || !v || typeof v !== 'object') continue;
    g.notes[k] = { n: Math.round(num(v.n, 1, 1, 1e7)), day: Math.round(num(v.day, 1, 1, 1e6)), hour: num(v.hour, 12, 0, 24), where: typeof v.where === 'string' ? v.where.slice(0, 40) : '' };
  }
  return g;
}
