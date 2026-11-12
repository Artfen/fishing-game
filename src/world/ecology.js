import { seaTemp } from './seatemp.js';
import { smoothstep } from '../util.js';

// The living ocean's connections (D1): what the water's warmth and the food in it do to where
// the fish go and how keen they are. The one ecosystem (ecosystem.js) reads these; there's no
// second simulation. (The light, the tide, people's disturbance and the fishing pressure already
// reached the fish's mood; ecosystem.js pickPoint now has them move the fish too. See
// docs/ECOLOGY.md for every driver and what it does.)

/* ---------- the water's warmth ---------- */

// The warm end of what each kind is comfortable in (°C), in the game's own sea (seatemp.js: about
// 12°C at the end of winter, 21°C at the top at the end of summer, the deep nearer 12-13°C under a
// warm layer from about eight metres down in summer). Past it, it keeps below that warm layer if
// the water's deep enough to, and is sluggish if it can't. These are the cool-water fish of the
// home coast (and the trout of a tarn on a hot afternoon); the rest don't mind what their own water
// does through the year (season.js already has each kind's year, and in autumn, when the warm
// layer's mixed down, these only just feel it).
export const WARM_LIMIT = {
  pollack: 18, // off the rocks in winter; in late summer, 15 m down below the warm layer
  hake: 17,
  conger: 19,
  johndory: 19,
  plaice: 18,
  thornback: 19,
  catshark: 19.5,
  trout: 18,
  grayling: 17,
};

// The water's warmth at a depth in a fish's own water (its home's zone; Las Brasas' if south).
export const tempAt = (ctx, zone, south, depth) => seaTemp({ abs: ctx.abs, zone, depth, south: south ? 1 : 0, hour: ctx.hour ?? 12 });

// The shallowest depth (m) where the water's no warmer than `limit`: 0 if the top's fine, and
// DEEPEST (as deep as it can go: the coolest there is) if not within it. (The sea cools with depth
// below the warm layer, so a binary search; the shallows' afternoon warmth only adds near the top.)
export const DEEPEST = 60;
export function coolDepth(limit, ctx, zone, south) {
  if (ctx.abs == null) return 0;
  if (tempAt(ctx, zone, south, 0) <= limit) return 0;
  if (tempAt(ctx, zone, south, DEEPEST) > limit) return DEEPEST;
  let lo = 0, hi = DEEPEST;
  while (hi - lo > 0.25) {
    const mid = (lo + hi) / 2;
    if (tempAt(ctx, zone, south, mid) > limit) lo = mid;
    else hi = mid;
  }
  return hi;
}

// How much warmer than it likes the water is where a fish is (0 … 1, at four degrees over).
export function warmStress(id, T) {
  const lim = WARM_LIMIT[id];
  return lim == null ? 0 : smoothstep(lim, lim + 4, T);
}

/* ---------- the food in it ---------- */

// The small shoaling fish the hunters live on: the sea's baitfish (sprat, sardine, anchovy),
// the sand smelt and glass minnows of the bays, bogue, horse and chub mackerel, the reef's
// chromis, and the roach, rudd and minnows of the fresh water.
export const FORAGE = new Set(['sprat', 'sardine', 'anchovy', 'sandsmelt', 'glassminnow', 'bogue', 'horsemackerel', 'chubmackerel', 'chromis', 'roach', 'rudd', 'minnow']);

// The baits and lures that are a small fish (or pass for one): a kind that takes them well eats
// fish.
const FISHY = ['sandeel', 'shad', 'strip', 'metal', 'popper', 'spinner', 'stickbait', 'ballyhoo', 'skirt', 'tspin', 'crankS', 'crankD', 'mjig', 'minnow', 'streamer', 'spoon', 'jerk', 'microjig'];
const eaters = new Map();
// Whether a kind hunts small fish: the hunters of shoals (tuna, bluefish, barracuda…), and any
// kind that takes a fish, or something like one, well (bass, pollack, pike, perch, mackerel…),
// but not the forage itself.
export function fishEater(sp) {
  let e = eaters.get(sp.id);
  if (e === undefined) {
    const L = sp.life || {}, food = sp.food || {};
    e = !FORAGE.has(sp.id) && !L.observe && (!!(L.hunter || L.hunterSouth) || FISHY.some((k) => (food[k] || 0) >= 0.9));
    eaters.set(sp.id, e);
  }
  return e;
}
