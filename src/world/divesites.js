import { heightAt, WRECK, WRECK_BELL, DIVE_MARKS, PLACES } from './terrain.js';
import { BAJON } from './brasa.js';
import { fbm, seeded, clamp } from '../util.js';

// The dive sites of the home coast: five places worth going down at, each different, each with a
// landmark you can find and life at the depths you can reach (what they look like is built in
// divesiteWorld.js; the fish of their own are hosted homes, see habitat.js and ecosystem.js).
//
//  · Skerries Reef, a shallow reef (3 to 9 m): boulders and gullies under the black rocks, an arch
//    to swim through, wrasse and pollack, an octopus in the cracks, jewel anemones and urchins.
//  · The Kelp Forest, off Gannet Isle's west shore (5 to 10 m): tall kelp standing like trees, the
//    light coming down green between them; pollack in the stalks, cuttlefish and bream on the
//    floor, and a big boulder in a clearing with a lost lobster pot against it.
//  · The Kittiwake, the wooden drifter on the reef off Shell Strand (9 to 10 m): her ribs and
//    boiler grown over with anemones, a conger in her hull, pollack and bogue over her.
//  · Anchor Sands, south of Long Shoal (17 m): open sand, rippled and quiet, where an old
//    Admiralty anchor lies with its chain; flatfish lie in the sand all round, gurnards walk it.
//  · The Hound, offshore beyond Gannet Light: a rock pinnacle standing from the seabed at thirty
//    metres to ten under the surface, at the foot of the Gannet Drop. Pink sea fans and jewel
//    anemones on its walls, dead man's fingers and plumose anemones on its ledges, kelp on its
//    top; pollack hanging off it right down, conger and red porgy at its foot, mackerel over it.
//    The tide runs hard over it: dive it at slack water.
//
// Each has a yellow buoy over it (a special mark: yellow, with a yellow cross on top), except the
// Kittiwake, which has her own black and red one.
//
// And Las Brasas' five, far to the south (south: true), in water clear enough to see the whole
// reef from its top:
//
//  · El Bajón, off the harbour mouth (3 to 20 m): lava pinnacles under the yellow buoy, sea fans
//    and sponges on their sides; clouds of chromis over the tops, parrotfish and ornate wrasse
//    grazing, combers on every ledge, morays in the cracks, a grouper in the cave at the foot,
//    barracuda hanging over it all.
//  · Los Arcos, off Roque del Arco (4 to 16 m): arches of old lava to swim through, groupers and
//    morays in the caves round them, barracuda and amberjack passing.
//  · El Veril, south-east of the harbour (20 to 40 m, and the blue below): the wall where the shelf
//    drops away, groupers in its caves, red porgy and dentex on the ledges, amberjack along it.
//  · El Sebadal (8 to 14 m): the seagrass meadow; striped bream and salema grazing, cuttlefish,
//    sand smelt over it, and the angel sharks buried in the sand between (to be left in peace).
//    Its buoy is a mooring: no anchoring in the seagrass.
//  · Las Coladas, on the windward north-west (4 to 14 m): the lava tongues broken into a reef,
//    parrotfish, triggerfish and salema; the swell works over it, so dive it on a calm day.

const M = DIVE_MARKS;
const place = (id) => PLACES.find((p) => p.id === id);
export const DIVE_SITES = [
  {
    id: 'reef', x: M.reef.x, z: M.reef.z, r: 26, buoy: M.reef.buoy, depth: [3, 9],
    first: 'Skerries Reef: boulders and gullies under the black rocks, kelp on their tops, and somewhere among them a rock arch to swim through. Look in the cracks: there’s an octopus about.',
  },
  {
    id: 'kelp', x: M.kelp.x, z: M.kelp.z, r: 30, buoy: M.kelp.buoy, depth: [4, 10],
    first: 'The Kelp Forest: the stalks stand round you like trees, the light coming down green between them, pollack hanging among them. Somewhere in here there’s a clearing with a big boulder in it.',
  },
  {
    id: 'wreck', x: WRECK.x, z: WRECK.z, r: 22, buoy: null, depth: [8, 10],
    first: 'The Kittiwake: her ribs and boiler grown over with anemones, a conger in her hull, pollack and bogue hanging over her. Her bell lies in the sand by her bow.',
  },
  {
    id: 'sands', x: M.sands.x, z: M.sands.z, r: 28, buoy: M.sands.buoy, depth: [16, 18],
    first: 'Anchor Sands: open sand, rippled by the tide, and it looks empty until you look closely. The flatfish lie half buried, only their eyes showing. The old anchor is here somewhere.',
  },
  {
    id: 'hound', x: M.hound.x, z: M.hound.z, r: 40, buoy: M.hound.buoy, depth: [10, 30],
    first: 'The Hound: the pinnacle rises out of the blue, its walls covered in pink sea fans and jewel anemones, pollack hanging off it all the way down. Watch your air: it’s thirty metres at its foot.',
  },
  // Las Brasas (see world/brasa.js): El Bajón's yellow buoy is the island's own (brasaWorld.js).
  {
    id: 'bajon', south: true, x: BAJON.x, z: BAJON.z, r: 40, buoy: null, depth: [3, 20],
    first: 'El Bajón: the pinnacles rise out of the blue under you, sea fans and sponges up their sides, a cloud of chromis over every top. Combers watch from the ledges, a moray from a crack. Look in the cave at the foot of the biggest for the grouper.',
  },
  {
    id: 'arcos', south: true, x: -440, z: 6537, r: 32, buoy: { x: -446, z: 6522 }, depth: [4, 16],
    first: 'Los Arcos: arches of old lava standing off the Roque, the light coming through them in shafts. Swim through, slowly. Groupers and morays live in the caves round their feet, and barracuda hang off the outer one.',
  },
  {
    id: 'veril', south: true, x: 120, z: 6578, r: 32, buoy: { x: 120, z: 6556 }, depth: [20, 40],
    first: 'El Veril: the shelf ends and the wall drops away beneath you into the blue. Groupers in the caves of the wall, red porgy and dentex on its ledges, amberjack cruising along it. Watch your depth and your air: it never stops going down.',
  },
  {
    id: 'sebadal', south: true, x: 430, z: 6490, r: 60, buoy: { x: 430, z: 6490 }, depth: [8, 14],
    first: 'El Sebadal: a meadow of seagrass under clear water, bending with the swell. Striped bream and salema graze it, cuttlefish hover over it, and somewhere in the sand between lies an angel shark, buried to its eyes. Leave it be.',
  },
  {
    id: 'coladas', south: true, x: -500, z: 5620, r: 36, buoy: { x: -505, z: 5612 }, depth: [4, 14],
    first: 'Las Coladas: the old lava broken into a reef of black blocks and gullies, the swell surging through them. Parrotfish grazing, triggerfish cruising over, a moray in every other hole. Keep off the rocks when a big one comes through.',
  },
].map((S) => ({ ...S, name: place(S.id).name, sub: place(S.id).sub, note: place(S.id).note }));
// The home coast's five (the challenge on the board is for these), and Las Brasas'.
export const HOME_SITES = DIVE_SITES.filter((S) => !S.south);
export const SOUTH_SITES = DIVE_SITES.filter((S) => S.south);
export const siteById = Object.fromEntries(DIVE_SITES.map((s) => [s.id, s]));

// The dive site at a point, if any.
export function siteAt(x, z, pad = 0) {
  for (const s of DIVE_SITES) if (Math.hypot(x - s.x, z - s.z) < s.r + pad) return s;
  return null;
}

/* ---------------- the Hound: its shape ---------------- */

// Two stacks of rock: the Hound itself, and its Pup a stone's throw to the south-east. Each is
// a tapering tower, its walls broken by ledges and cracks: radius(h, a) is how far its wall
// stands from its axis at height h above the seabed, the way a; top, the height of its crown.
export const PINNACLES = [
  { id: 'hound', x: -196, z: 744, top: 20.4, base: 15, crown: 4.2, seed: 3.1 },
  { id: 'pup', x: -172, z: 766, top: 10.5, base: 8, crown: 2.6, seed: 8.7 },
];
for (const P of PINNACLES) P.bed = heightAt(P.x, P.z);
const LEDGES = [0.3, 0.62];
export function pinnacleRadius(P, h, a) {
  const k = clamp(h / P.top, 0, 1);
  let r = P.crown + (P.base - P.crown) * Math.pow(1 - k, 1.35);
  // Ledges: the wall steps out a little under each.
  for (const L of LEDGES) r += 0.9 * Math.max(0, 1 - Math.abs(k - L + 0.04) / 0.07) * (P.base / 15);
  const c = Math.cos(a), s = Math.sin(a);
  const n = fbm(c * 1.7 + h * 0.09 + P.seed, s * 1.7 - h * 0.06 + P.seed, 3);
  const crack = fbm(c * 4.2 + P.seed * 2, s * 4.2 + h * 0.05, 2);
  // (Bedded rock: little steps and overhangs every couple of metres up the wall.)
  const strata = 0.28 * Math.sin(h * 2.6 + n * 4 + P.seed) * (P.base / 15);
  return Math.max(0.6, r * (1 + 0.3 * n) + strata - Math.max(0, crack - 0.25) * 2.4);
}
// The crown's height over its axis: a rounded top, higher in the middle.
export const crownAt = (P, d, a) => P.top + 0.9 * (1 - clamp(d / pinnacleRadius(P, P.top, a), 0, 1) ** 2) + fbm(Math.cos(a) * 3 + P.seed, Math.sin(a) * 3, 2) * 0.35;

/* ---------------- solid rock: keeping a diver out of it ---------------- */

// The arch on Skerries Reef and the boulders round the sites: rocks as spheres (what the world
// draws is built from these). Each: { x, y, z, r }.
export const ROCKS = (() => {
  const rnd = seeded(20261026);
  const out = [];
  const bed = (x, z) => heightAt(x, z);
  // The arch: two piers of piled rock and a long one laid across them, a gap you can swim
  // through under it (three metres wide, two and a half high).
  const A = siteById.reef, ax = A.x, az = A.z, yaw = 0.7;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (u, v) => ({ x: ax + u * c + v * s, z: az - u * s + v * c });
  for (const side of [-1, 1]) {
    const p = at(side * 2.9, 0), b = bed(p.x, p.z);
    out.push({ x: p.x, y: b + 0.9, z: p.z, r: 1.5, arch: true });
    out.push({ x: p.x + side * 0.2, y: b + 2.3, z: p.z + 0.15, r: 1.2, arch: true });
    out.push({ x: p.x - side * 0.1, y: b + 3.3, z: p.z - 0.1, r: 1.05, arch: true });
  }
  {
    const b = bed(ax, az);
    for (const u of [-2.2, -0.75, 0.75, 2.2]) {
      const p = at(u, 0);
      out.push({ x: p.x, y: b + 3.9 + (Math.abs(u) > 1 ? -0.1 : 0.15), z: p.z, r: 0.95, arch: true, lintel: true });
    }
  }
  // Boulders round the reef, the kelp forest's clearing and the foot of the Hound.
  const scatter = (S, n, r0, r1, inner = 0) => {
    for (let i = 0, k = 0; i < n * 6 && k < n; i++) {
      const a = rnd() * Math.PI * 2, d = inner + Math.sqrt(rnd()) * (S.r - inner);
      const x = S.x + Math.cos(a) * d, z = S.z + Math.sin(a) * d;
      const depth = -bed(x, z);
      if (depth < 1.6) continue;
      const r = r0 + rnd() * rnd() * (r1 - r0);
      if (out.some((o) => Math.hypot(o.x - x, o.z - z) < o.r + r * 0.6)) continue;
      out.push({ x, y: bed(x, z) + r * 0.25, z, r: Math.min(r, depth * 0.45) });
      k++;
    }
  };
  scatter(A, 46, 0.7, 2.6, 4.5);
  const K = siteById.kelp;
  {
    // The clearing's boulder, and a few more under the kelp.
    const b = bed(K.x + 4, K.z + 6);
    out.push({ x: K.x + 4, y: b + 1.1, z: K.z + 6, r: 2.3, mare: true });
    scatter(K, 46, 0.5, 1.7, 6);
  }
  const H = siteById.hound;
  scatter({ ...H, r: 30 }, 40, 0.8, 2.8, 15);
  return out;
})();

// (All of it lies in here.)
const BOX = (() => {
  const b = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  for (const o of [...ROCKS, ...PINNACLES.map((P) => ({ x: P.x, z: P.z, r: P.base * 1.6 }))]) {
    b.x0 = Math.min(b.x0, o.x - o.r - 2);
    b.x1 = Math.max(b.x1, o.x + o.r + 2);
    b.z0 = Math.min(b.z0, o.z - o.r - 2);
    b.z1 = Math.max(b.z1, o.z + o.r + 2);
  }
  return b;
})();
// (The boulders by 12 m cells, so a point only tries the few near it: fish ask this every frame.)
const CELL_R = 12;
const ROCK_CELLS = (() => {
  const m = new Map();
  for (const o of ROCKS) {
    const R = o.r + 1.5;
    for (let i = Math.floor((o.x - R) / CELL_R); i <= Math.floor((o.x + R) / CELL_R); i++) {
      for (let j = Math.floor((o.z - R) / CELL_R); j <= Math.floor((o.z + R) / CELL_R); j++) {
        const k = `${i},${j}`;
        if (!m.has(k)) m.set(k, []);
        m.get(k).push(o);
      }
    }
  }
  return m;
})();
const NONE = [];
const rocksAt = (x, z) => ROCK_CELLS.get(`${Math.floor(x / CELL_R)},${Math.floor(z / CELL_R)}`) || NONE;
// Push a point out of the rock: the boulders and the arch's stones, the Hound and its Pup.
// p: { x, y, z } (changed in place); pad: how far to keep from it. Returns true if it moved.
export function pushOut(p, pad = 0.4) {
  let moved = false;
  if (p.x < BOX.x0 || p.x > BOX.x1 || p.z < BOX.z0 || p.z > BOX.z1) return false;
  for (const P of PINNACLES) {
    const dx = p.x - P.x, dz = p.z - P.z, d = Math.hypot(dx, dz);
    if (d > P.base * 1.6 + pad) continue;
    const h = p.y - P.bed, a = Math.atan2(dz, dx);
    if (h > P.top + 1.4 + pad || h < -1) continue;
    const top = crownAt(P, d, a);
    const R = pinnacleRadius(P, Math.min(h, P.top), a);
    if (d >= R + pad || h >= top + pad) continue;
    // Out the nearest way: up onto its crown, or out from its wall.
    if (top + pad - h < R + pad - d) p.y = P.bed + top + pad;
    else {
      p.x = P.x + Math.cos(a) * (R + pad);
      p.z = P.z + Math.sin(a) * (R + pad);
    }
    moved = true;
  }
  // (Where boulders lean on one another, out of one can be into the next: a few passes, until
  // nothing moves.)
  for (let pass = 0; pass < 4; pass++) {
    let again = false;
    for (const o of rocksAt(p.x, p.z)) {
      const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z;
      const R = o.r * 0.92 + pad;
      if (Math.abs(dx) > R || Math.abs(dz) > R || Math.abs(dy) > R) continue;
      const d = Math.hypot(dx, dy, dz);
      if (d >= R) continue;
      const k = R / Math.max(d, 1e-3);
      p.x = o.x + dx * k;
      p.y = o.y + dy * k;
      p.z = o.z + dz * k;
      moved = again = true;
    }
    if (!again) break;
  }
  return moved;
}
// The top of anything solid at (x, z) above the seabed (for a sounder looking down): the Hound's
// crown, or null.
export function rockTopAt(x, z) {
  for (const P of PINNACLES) {
    const d = Math.hypot(x - P.x, z - P.z);
    if (d > P.base + 3) continue;
    const a = Math.atan2(z - P.z, x - P.x);
    // (The widest the wall gets at this distance: the highest point on it there.)
    let h = null;
    for (let y = P.top; y >= 0; y -= 0.5) {
      if (pinnacleRadius(P, y, a) >= d) {
        h = y >= P.top ? crownAt(P, d, a) : y;
        break;
      }
    }
    if (h != null) return P.bed + h;
  }
  return null;
}

/* ---------------- what there is to find ---------------- */

// For a diver who looks closely: the details of a site, each where it lies (x, y, z), found by
// coming within reach of it (r, metres) with it in view. The Kittiwake has the most: her bell,
// her boiler, her propeller, the steam capstan, the name on her bow and the bottles from her
// galley; the other sites at home, the thing their first words promise is there somewhere.
const WK = WRECK, wc = Math.cos(WK.yaw), ws = Math.sin(WK.yaw), wbed = heightAt(WK.x, WK.z);
// (In her own frame: across her, up from the bed by her middle, along her from the middle, bow +.)
export const onWreck = (lx, ly, lz) => ({ x: WK.x + lx * wc + lz * ws, y: wbed + ly, z: WK.z - lx * ws + lz * wc });
const onBed = (x, z, up = 0.25) => ({ x, y: heightAt(x, z) + up, z });
const galley = onWreck(-3.3, 0, 1.6);
// (Her stern lies up the slope of the reef: the propeller stands clear of the bed there.)
const prop = onWreck(0, 0.75, -WK.len / 2 - 0.35);
prop.y = Math.max(prop.y, heightAt(prop.x, prop.z) + 0.8);
const reef = siteById.reef, kelp = siteById.kelp, sands = siteById.sands;
export const SITE_DETAILS = {
  wreck: [
    { id: 'bell', name: 'her bell', r: 2.6, ...onBed(WRECK_BELL.x, WRECK_BELL.z),
      note: 'Her bell, on its side in the sand by her bow: bronze gone green, KITTIWAKE raised round the rim. Leave it where it lies.' },
    { id: 'boiler', name: 'her boiler', r: 3.4, ...onWreck(0.2, 1.0, -2.5),
      note: 'Her boiler: a drum of riveted iron as long as you are tall, white and orange with plumose anemones and dead man’s fingers, and a lobster in the mouth of the firebox, claws out.' },
    { id: 'propeller', name: 'her propeller', r: 2.8, ...prop,
      note: 'Her propeller, still on its shaft under the stern post: three iron blades, one snapped off short, dead man’s fingers growing on the hub.' },
    { id: 'capstan', name: 'her steam capstan', r: 2.8, ...onWreck(-0.4, 0.9, 7.0),
      note: 'The steam capstan on her foredeck, that hauled in a mile of drift net every night she fished: an iron barrel on its side now, the groove the warp wore in it still bright.' },
    { id: 'name', name: 'her name', r: 2.4, ...onWreck(2.5, 0.8, 8.3),
      note: 'Her name, on a board on her bow, the paint long gone and the letters cut deep: KITTIWAKE, and under it her number, WH 27.' },
    { id: 'bottles', name: 'the bottles from her galley', r: 2.4, ...onBed(galley.x, galley.z, 0.15),
      note: 'Stoneware bottles from her galley, half buried in the sand where they spilled: ginger beer, the potter’s stamp still sharp on them. Leave them where they lie.' },
  ],
  reef: [
    { id: 'arch', name: 'the arch', r: 4.5, ...onBed(reef.x, reef.z, 2.0),
      note: 'The arch: two piers of piled rock and a slab laid over them, a gap three metres wide to swim through, the light green on the far side.' },
  ],
  kelp: [
    { id: 'boulder', name: 'the clearing’s boulder', r: 5, ...onBed(kelp.x + 4, kelp.z + 6, 2.2),
      note: 'The clearing in the kelp, and its boulder, as big as a cottage, the stalks standing round it like a hedge. Pollack hang in its shadow.' },
  ],
  sands: [
    { id: 'anchor', name: 'the old anchor', r: 3.2, ...onBed(sands.x - 2, sands.z + 1, 0.3),
      note: 'The old anchor, on its own in the sand: longer than you are, its stock grown over with anemones and its chain running off under the ripples. Whose it was, nobody knows.' },
  ],
  hound: [
    { id: 'crown', name: 'the crown of the Hound', r: 6, x: PINNACLES[0].x, y: PINNACLES[0].bed + PINNACLES[0].top, z: PINNACLES[0].z,
      note: 'The crown of the Hound, ten metres down: the top of the pinnacle, pink sea fans standing out into the tide, and the blue falling away on every side.' },
    { id: 'pup', name: 'the Pup', r: 5, x: PINNACLES[1].x, y: PINNACLES[1].bed + PINNACLES[1].top, z: PINNACLES[1].z,
      note: 'The Pup, the Hound’s little tower a stone’s throw to the south-east, its top twenty metres down, with a shoal of bib round it and a conger’s head out of a crack.' },
  ],
};
// What's within reach of a diver at p ({ x, y, z }) at a site, not yet found (found: ids).
export function detailsNear(siteId, p, found = []) {
  return (SITE_DETAILS[siteId] || []).filter((d) => !found.includes(d.id) && Math.hypot(d.x - p.x, d.y - p.y, d.z - p.z) < d.r);
}
// How much of a site you've found, in words: "her bell and her boiler (2 of 6)".
export function foundWords(siteId, found = []) {
  const all = SITE_DETAILS[siteId] || [];
  const got = all.filter((d) => found.includes(d.id)).map((d) => d.name);
  if (!all.length || !got.length) return '';
  const list = got.length === 1 ? got[0] : `${got.slice(0, -1).join(', ')} and ${got[got.length - 1]}`;
  return all.length === 1 ? list : `${list} (${got.length} of ${all.length})`;
}
