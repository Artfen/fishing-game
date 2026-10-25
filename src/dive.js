import { clamp } from './util.js';

// Diving, the rules (diver.js swims you about; main.js plays it). Two ways in:
//
//  · Freediving, on one breath, with a speargun. The breath lasts about 75 seconds lying still,
//    much less swimming and less again kicking hard, and depth costs you on the way back up: the
//    gauge marks the point to turn for the surface. Back at the surface you breathe up before the
//    next dive. Run it right out and you black out (in real life, why freedivers never dive
//    alone: a buddy at the surface watches every dive).
//  · Scuba, on a tank of air, for exploring and photographing (no speargun: spearfishing with
//    breathing apparatus is banned in France and Spain, as in most places). Air goes faster the
//    deeper you are; the dive computer watches how fast you come up, and after a deeper dive asks
//    for a safety stop near the surface. The tank is filled at the chandlery.
//
// The game's clock runs faster than life (an hour passes in 40 seconds), and so does a tank of
// air: a full one lasts about eight minutes at ten metres, not the better part of an hour; the
// safety stop is half a minute, not three. The proportions are kept: deeper drinks more air,
// effort drinks more breath.

/* ---------------- a held breath ---------------- */

export const BREATH = {
  hold: 75,       // seconds lying still
  swim: 0.6,      // extra, swimming steadily (the stick or keys all the way)
  kick: 1.2,      // extra, kicking hard
  recover: 28,    // seconds at the surface to breathe right up from empty
  ascent: 1.0,    // metres a second coming up steadily
  margin: 0.12,   // spare breath to arrive at the surface with
  low: 0.25,      // below this the edges of your sight darken
};

// The share of a full breath used each second.
export const breathUse = (swim = 0, kick = false) => (1 + BREATH.swim * clamp(swim, 0, 1) + (kick ? BREATH.kick : 0)) / BREATH.hold;
// The share of a breath it takes to swim up from this depth at a steady pace, with a margin:
// the turn point on the gauge.
export const breathToSurface = (depth) => (Math.max(0, depth) / BREATH.ascent) * breathUse(1) + BREATH.margin;
export const recoverRate = () => 1 / BREATH.recover;

/* ---------------- a tank of air ---------------- */

export const SCUBA = {
  full: 200,      // bar
  reserve: 50,    // head up with this much left
  low: 20,        // and with this little, now
  base: 0.104,    // bar a second at the surface, resting
  swim: 0.5,
  kick: 1.0,
  maxAscent: 0.6, // metres a second: faster and the computer warns you
  stopFrom: 10,   // after going this deep…
  stopAt: [3, 6], // …stop between these depths…
  stopFor: 30,    // …for this many seconds
};

// Bar used each second at a depth: the deeper, the denser each breath (1 bar more every 10 m).
export const airUse = (depth, swim = 0, kick = false) => SCUBA.base * (1 + Math.max(0, depth) / 10) * (1 + SCUBA.swim * clamp(swim, 0, 1) + (kick ? SCUBA.kick : 0));
// Minutes of air before the reserve, swimming steadily at this depth (for the dive computer).
export const minutesLeft = (bar, depth) => Math.max(0, bar - SCUBA.reserve) / airUse(depth, 1) / 60;

/* ---------------- fish and a diver ---------------- */

// How close a fish lets a diver come before it bolts, in metres. Wary fish go sooner; a diver
// swimming at them goes further, and kicking hard (thrashing fins, a cloud of noise) furthest.
// Flatfish trust their camouflage and lie still until you're almost on them; an octopus slips
// into a crack.
export function spookRadius(L, speed = 0, kicking = false) {
  if (L.flat) return kicking ? 1.6 : 0.9;
  if (L.benthic) return kicking ? 1.8 : 1.1;
  return 1 + (L.caution ?? 1) * 1.4 + Math.max(0, speed) * 1.6 + (kicking ? 2.2 : 0);
}

// How readily a fish comes to look at a diver who keeps still near the bottom (the old
// spearfisher's way: settle, wait, and let them come). The sea breams and wrasse are the
// inquisitive ones; bass, dentex and pollack will come and look too; mullet hardly ever.
const CURIOUS = {
  wrasse: 0.85, blackbream: 0.75, whitebream: 0.75, twobanded: 0.75, striped: 0.65, gilthead: 0.6,
  pandora: 0.6, redporgy: 0.55, dentex: 0.7, seabass: 0.55, pollack: 0.6, meagre: 0.5, salema: 0.4,
  bogue: 0.45, horsemackerel: 0.4, mullet: 0.25, conger: 0.35, cuttlefish: 0.5, squid: 0.4,
};
export function curiosity(sp) {
  if (sp.life.flat || sp.life.benthic || sp.life.observe) return 0;
  return CURIOUS[sp.id] ?? 0.3;
}

/* ---------------- the speargun ---------------- */

// A band-powered gun of about 90 cm: the shaft flies a little over four metres on its line, and
// is only sure at three or so. After a shot the shaft is pulled back in and the bands loaded.
export const SPEAR = { range: 4.6, sure: 3.2, speed: 16, retrieve: 1.1, load: 1.8 };

// Taken with a speargun, or not: never in fresh water (banned), never a protected fish (the
// eel), never bluefin tuna (strict quotas), and a fish too small is let grow.
export function canSpear(sp, size, water) {
  if (water === 'fresh') return { ok: false, why: 'Spearfishing isn’t allowed in fresh water.' };
  if (sp.life.observe) return { ok: false, why: `The ${sp.name.toLowerCase()} is protected: watch it, never take it.` };
  if (sp.id === 'tuna') return { ok: false, why: 'Bluefin tuna are under strict quotas: never with a speargun here.' };
  if (smallFor(sp, size)) return { ok: false, small: true, why: 'Too small: let it grow.' };
  return { ok: true };
}
// Small for its kind: in the bottom fifth of the sizes it grows to here (about a third of the
// fish you'll meet, since young fish outnumber old ones).
export const smallFor = (sp, size) => size < sp.size[0] + (sp.size[1] - sp.size[0]) * 0.2;
// What a diver would say of its size, at a glance.
export const sizeGuess = (size) => `about ${Math.max(5, Math.round(size / 5) * 5)} cm`;

// The fish a shot meets first: the shaft runs from `from` along `dir` (a unit vector) for `range`
// metres; each fish is a body along its heading, as long as the fish, tapering to the tail.
// Returns { agent, dist, along } (along: 0 at the head, 1 at the tail) or null.
export function spearHit(from, dir, range, agents) {
  let best = null;
  for (const a of agents) {
    if (!a.active || a.state === 'caught' || a.state === 'gone' || a.state === 'hooked') continue;
    const len = Math.max(0.08, a.size / 100);
    // (A quick cull: nowhere near the shaft's path.)
    const ox = a.x - from.x, oy = a.y - from.y, oz = a.z - from.z;
    const s0 = ox * dir.x + oy * dir.y + oz * dir.z;
    if (s0 < -len || s0 > range + len) continue;
    const px = ox - dir.x * s0, py = oy - dir.y * s0, pz = oz - dir.z * s0;
    if (px * px + py * py + pz * pz > (len + 0.2) ** 2) continue;
    const cp = Math.cos(a.pitch || 0);
    const hx = Math.sin(a.yaw) * cp, hy = Math.sin(a.pitch || 0), hz = Math.cos(a.yaw) * cp;
    const c = closest(from, dir, range, a, hx, hy, hz, len);
    // The body: widest a third back from the head, narrow at the tail (with a little allowance
    // for the shaft and the flopper on its tip).
    const r = Math.max(0.03, len * 0.14) * (c.along < 0.7 ? 1 : 0.6) + 0.03;
    if (c.d2 > r * r) continue;
    if (!best || c.s < best.dist) best = { agent: a, dist: c.s, along: c.along };
  }
  return best;
}

// Closest points between the shot (from + dir·s, 0 ≤ s ≤ range) and the fish's body (its middle
// ± half its length along its heading).
function closest(from, dir, range, a, hx, hy, hz, len) {
  const tx = a.x - hx * len / 2, ty = a.y - hy * len / 2, tz = a.z - hz * len / 2; // the tail
  const ux = hx * len, uy = hy * len, uz = hz * len; // tail → head
  const wx = from.x - tx, wy = from.y - ty, wz = from.z - tz;
  const A = 1, B = dir.x * ux + dir.y * uy + dir.z * uz, C = len * len;
  const D = dir.x * wx + dir.y * wy + dir.z * wz, E = ux * wx + uy * wy + uz * wz;
  const den = A * C - B * B;
  let s = den > 1e-9 ? (B * E - C * D) / den : 0;
  s = clamp(s, 0, range);
  let u = clamp((B * s + E) / C, 0, 1);
  s = clamp(B * u - D, 0, range);
  const dx = wx + dir.x * s - ux * u, dy = wy + dir.y * s - uy * u, dz = wz + dir.z * s - uz * u;
  return { s, along: 1 - u, d2: dx * dx + dy * dy + dz * dz };
}

// Where the shaft went in: just behind the head stops a fish at once; through the middle holds
// it; in the tail, a strong fish can tear free (and a decent spearfisher doesn't shoot at tails).
export const shotQuality = (along) => (along < 0.33 ? 'clean' : along < 0.7 ? 'good' : 'poor');
export function tearChance(quality, sp, size) {
  const big = clamp((size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0]), 0, 1);
  const strong = clamp(sp.strength ?? 0.8, 0.3, 1.5) * (0.5 + big * 0.5);
  if (quality === 'clean') return 0;
  if (quality === 'good') return 0.04 + strong * 0.1;
  return 0.3 + strong * 0.3;
}

/* ---------------- the save ---------------- */

// state.dive: the tank (bar) and a few records for the journal.
export function cleanDive(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const n = (v, d, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d);
  return {
    tank: n(r.tank, SCUBA.full, 0, SCUBA.full),
    dives: Math.round(n(r.dives, 0, 0, 1e6)),
    deepest: n(r.deepest, 0, 0, 100),
    longest: n(r.longest, 0, 0, 1000),
    speared: Math.round(n(r.speared, 0, 0, 1e6)),
    blackouts: Math.round(n(r.blackouts, 0, 0, 1e6)),
  };
}
