// Live bait: small fish and prawns kept alive in a bait bucket (or, aboard a boat with one, her
// livewell), and fished live for the hunters: a sand smelt or a joey mackerel for a bass or a
// pollack, a minnow or a small roach for a pike or a perch, a prawn netted from a rockpool for
// anything that hunts along the rocks (World depth A2b; see docs/WORLD-DEPTH.md).
//
//  · What goes in: the coast's small fish and the shoal fish's young (LIVE), at the sizes a bait
//    fish is; and prawns from a rockpool's net. From the catch card ("Into the bait bucket") or
//    the rockpool's net.
//  · The bucket holds six; a livewell twelve, and its pump keeps the water sweet.
//  · Standing water goes stale as the fish use it up (the warmer the day, the quicker); stale,
//    they start to die, the least hardy first. Change the water at the water's edge or aboard,
//    and they perk up. (A goby or a shanny is tough; a sand smelt or a sprat isn't.)
//  · On the hook it swims about by itself, the most tempting bait there is to a hunting fish
//    (see appeal); taken by a fish, it's gone from the bucket.
//
// The bucket lives in your gear (state.gear.bucket: { fish: [{ id, size }], water }), so it goes
// where you go.

// The live baits, as tied on (their tackle is in tackle.js: liveprawn and livefish).
export const LIVE_BAITS = ['liveprawn', 'livefish'];

// What goes in the bucket: which bait it makes, how hardy it is in stale water (0 … 1), and the
// biggest that's still a bait (cm).
export const LIVE = {
  prawn: { bait: 'liveprawn', hardy: 0.55, max: 8, name: 'prawn' },
  rockgoby: { bait: 'livefish', hardy: 0.95, max: 13 },
  shanny: { bait: 'livefish', hardy: 1, max: 16 },
  blackgoby: { bait: 'livefish', hardy: 0.9, max: 16 },
  corkwing: { bait: 'livefish', hardy: 0.7, max: 18 },
  minnow: { bait: 'livefish', hardy: 0.8, max: 12 },
  sandsmelt: { bait: 'livefish', hardy: 0.45, max: 14 },
  sprat: { bait: 'livefish', hardy: 0.2, max: 15 },
  sardine: { bait: 'livefish', hardy: 0.25, max: 18 },
  anchovy: { bait: 'livefish', hardy: 0.2, max: 16 },
  mackerel: { bait: 'livefish', hardy: 0.3, max: 26 },
  horsemackerel: { bait: 'livefish', hardy: 0.4, max: 22 },
  chubmackerel: { bait: 'livefish', hardy: 0.3, max: 24 },
  rudd: { bait: 'livefish', hardy: 0.75, max: 15 },
  roach: { bait: 'livefish', hardy: 0.75, max: 15 },
};

// How much each hunter wants a live fish (as sp.food does for other baits; see ecosystem.js
// appeal). A live prawn tempts whatever takes a prawn, a quarter as much again.
export const LIVE_FISH = {
  seabass: 1.7, pollack: 1.7, pike: 1.7, perch: 1.35, trout: 0.9, lmbass: 1.4, mackerel: 0.7,
  conger: 1.2, bluefish: 1.5, meagre: 1.3, dentex: 1.5, garfish: 0.6, bonito: 1.2, littletunny: 1.1,
  tuna: 1.4, barracuda: 1.6, amberjack: 1.6, grouper: 1.4, johndory: 1.6, hake: 1.2, turbot: 1.3,
  squid: 0.7, cuttlefish: 0.6, comber: 1.1, moray: 1.0, blueshark: 1.1, mako: 1.3, hammerhead: 1.1,
  catshark: 0.5, thornback: 0.5, gurnard: 0.5, urta: 0.8,
};
export const LIVE_PRAWN = 1.25;

// How much a fish wants this live bait (0: not a live bait, or not a hunter of it).
export function liveAppeal(sp, item) {
  if (item === 'livefish') return LIVE_FISH[sp.id] ?? 0;
  if (item === 'liveprawn') return (sp.food?.prawn ?? 0) * LIVE_PRAWN;
  return 0;
}

// The bucket and the livewell: how many each holds; how fast still water goes stale (a share an
// hour of the game's clock, on a mild day; a warm one more); below STALE they start to die.
export const BUCKET = { cap: 6, well: 12, stale: 0.06, wellStale: 0.005, warm: 0.6 };
export const STALE = 0.35;

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
export const newBucket = () => ({ fish: [], water: 1 });

// A bucket from a save, made sensible.
export function cleanBucket(raw) {
  const B = newBucket();
  if (!isObj(raw)) return B;
  if (Array.isArray(raw.fish)) {
    for (const f of raw.fish) {
      if (B.fish.length >= BUCKET.well) break;
      if (isObj(f) && LIVE[f.id] && Number.isFinite(f.size) && f.size > 0 && f.size <= LIVE[f.id].max) B.fish.push({ id: f.id, size: Math.round(f.size) });
    }
  }
  B.water = Number.isFinite(raw.water) ? Math.min(1, Math.max(0, raw.water)) : 1;
  return B;
}

// Can this go in as live bait (a kind that makes one, and small enough)?
export const isLiveBait = (id, size) => !!LIVE[id] && size <= LIVE[id].max;
export const capOf = (aerated) => (aerated ? BUCKET.well : BUCKET.cap);

// In it goes. aerated: aboard with a livewell. Returns { ok, why }.
export function addLive(B, id, size, aerated = false) {
  if (!isLiveBait(id, size)) return { ok: false, why: LIVE[id] ? 'Too big for a bait: let it go.' : 'That won’t do as live bait.' };
  if (B.fish.length >= capOf(aerated)) return { ok: false, why: aerated ? 'The livewell is full.' : 'The bait bucket is full (six is plenty: any more and they’d use the water up).' };
  B.fish.push({ id, size: Math.round(size) });
  return { ok: true };
}

// How many of this bait (liveprawn or livefish) are in the bucket.
export const liveCount = (B, bait) => (B?.fish || []).filter((f) => LIVE[f.id].bait === bait).length;

// One taken out for the hook (the liveliest: the hardiest of them). Returns it, or null.
export function takeLive(B, bait) {
  let best = -1;
  B.fish.forEach((f, i) => {
    if (LIVE[f.id].bait === bait && (best < 0 || LIVE[f.id].hardy > LIVE[B.fish[best].id].hardy)) best = i;
  });
  return best < 0 ? null : B.fish.splice(best, 1)[0];
}

// The hours go by: the water goes stale (slowly in a livewell, whose pump keeps it moving; faster
// on a warm day), and in stale water the least hardy die first. warm: 0 … 1 (a hot day). rnd: dice.
// Returns the ones that died.
export function stepBucket(B, hours, { aerated = false, warm = 0 } = {}, rnd = Math.random) {
  if (!B.fish.length || hours <= 0) {
    if (!B.fish.length) B.water = 1;
    return [];
  }
  // (A quarter of an hour at a time, so a long wait, a night or a journey, goes as it would:
  // the water staling first, and only then the dying.)
  const dead = [];
  for (let left = hours; left > 1e-6 && B.fish.length; left -= 0.25) {
    const h = Math.min(0.25, left);
    const rate = (aerated ? BUCKET.wellStale : BUCKET.stale) * (1 + BUCKET.warm * warm) * (0.5 + B.fish.length / BUCKET.cap / 2);
    B.water = Math.max(0, B.water - rate * h);
    if (B.water >= STALE) continue;
    const bad = (STALE - B.water) / STALE;
    for (let i = B.fish.length - 1; i >= 0; i--) {
      const f = B.fish[i];
      if (rnd() < Math.min(1, bad * (1.2 - LIVE[f.id].hardy) * h * 2)) dead.push(...B.fish.splice(i, 1));
    }
  }
  return dead;
}

// Fresh water in (at the water's edge, or aboard).
export function freshen(B) {
  B.water = 1;
}

// The water in words.
export const waterWords = (B) => (B.water > 0.7 ? 'fresh' : B.water > STALE ? 'going stale' : 'stale');
