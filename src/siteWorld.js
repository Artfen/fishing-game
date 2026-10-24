import {
  heightAt, walkHeight, pathInfo, coastPathInfo, trailInfo, zoneAt, WORLD, CAMP, LANDING, BRIDGE, PEGS,
  HAVEN_HOUSES, PUNT, SHELTER, DAYMARK, WEND_CAMP, BOATHOUSE, GANNET_CAMP, LIGHT, ZONE_NAMES, STRAND,
} from './world/terrain.js';
import { shelterAt } from './world/conditions.js';

// The ground, as the camp's rules see it (see campsite.js): its height, the decks on it, the
// paths across it, the places to keep clear, and how open it is to the sea. The game adds the
// things standing on it (trees, rocks, buildings) and your camp's own gear.

// Places a tent mustn't go: doorways, the quay and slipway, other camps, landings, bridges.
export const KEEP_OUT = [
  { x: CAMP.x, z: CAMP.z, r: CAMP.r + 5, why: 'That’s the old camp’s clearing: it has its own tent and fire already.' },
  { x: LANDING.x - 3, z: LANDING.z, r: 5, why: 'Keep the landing clear: boats tie up here.' },
  { x: WEND_CAMP.x, z: WEND_CAMP.z, r: WEND_CAMP.r + 6, why: 'Wend Quay’s pitch is here already, and the quay needs to stay clear.' },
  { x: BOATHOUSE.x, z: BOATHOUSE.z, r: 15, why: 'The boathouse needs its doors and jetty clear.' },
  { x: GANNET_CAMP.x, z: GANNET_CAMP.z, r: GANNET_CAMP.r + 5, why: 'Puffin Cove’s bivouac is here already.' },
  { x: LIGHT.x, z: LIGHT.z, r: 12, why: 'Too close to the lighthouse.' },
  { x: BRIDGE.x, z: BRIDGE.z, r: 4.5, why: 'That would block the bridge over Fernbeck.' },
  ...PEGS.map((p) => ({ x: p.x, z: p.z, r: 3.5, why: `Keep ${p.name} clear for fishing from.` })),
  { x: PUNT.x, z: PUNT.z, r: 3.6, why: 'That would be on top of the old punt.' },
  { x: SHELTER.x, z: SHELTER.z, r: 4, why: 'That would block the driftwood shelter.' },
  { x: DAYMARK.x, z: DAYMARK.z, r: 4.5, why: 'The daymark needs walking room round it.' },
];
// Willowhaven: the quay, the slipway and every doorway need the room.
const HAVEN_ZONE = { x0: -42, x1: 48, z0: -124, z1: -88 };
const HAVEN_WHY = 'Not in Willowhaven: the quay, the slipway and the doorways need the room. There’s open grass a little way along the shore.';

export function keepOutAt(x, z, extra = []) {
  if (x > HAVEN_ZONE.x0 && x < HAVEN_ZONE.x1 && z > HAVEN_ZONE.z0 && z < HAVEN_ZONE.z1) {
    // (Only near the buildings and the shore: the hill behind is open country.)
    if (z > -99 || HAVEN_HOUSES.some((b) => Math.hypot(x - b.x, z - b.z) < Math.max(b.w, b.d) / 2 + 4)) return { why: HAVEN_WHY };
  }
  for (const k of KEEP_OUT) if ((x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r) return k;
  for (const k of extra) if ((x - k.x) ** 2 + (z - k.z) ** 2 < k.r * k.r) return k;
  return null;
}

export function pathDistance(x, z) {
  return Math.min(pathInfo(x, z).d, coastPathInfo(x, z).d, x > 400 ? trailInfo(x, z).d : Infinity);
}

// How open the nearby sea is to the swell (0 sheltered … 1 the open coast).
export function exposureAt(x, z) {
  let e = 0;
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2, px = x + Math.cos(a) * 14, pz = z + Math.sin(a) * 14;
    if (heightAt(px, pz) < -0.4) e = Math.max(e, shelterAt(px, pz)[0]);
  }
  return e;
}

const SEA_WORDS = { open: 'the open sea', coast: 'the sea', deep: 'the open sea' };
export function waterNear(x, z) {
  for (const r of [8, 16, 26]) {
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
      if (heightAt(px, pz) < -0.3) {
        const zone = zoneAt(px, pz);
        return SEA_WORDS[zone] || ZONE_NAMES[zone] || 'the water';
      }
    }
  }
  return '';
}

// world for checkSite(): obstacles(x, z, pad) → things standing there; extraKeepOut() → more
// places to keep clear (the game's interaction spots).
export function makeSiteWorld({ obstacles = () => [], extraKeepOut = () => [] } = {}) {
  const near = [];
  return {
    height: heightAt,
    walk: walkHeight,
    inBounds: (x, z) => x > WORLD.x0 + 30 && x < WORLD.x1 - 30 && z > WORLD.z0 + 30 && z < WORLD.z1 - 30,
    obstacles: (x, z, pad) => obstacles(x, z, pad, near),
    keepOut: (x, z) => keepOutAt(x, z, extraKeepOut()),
    path: pathDistance,
    exposure: exposureAt,
    treesNear: (x, z) => obstacles(x, z, 6, near).filter((o) => o.kind === 'tree').length >= 3,
    waterNear,
    ground: (x, z, h) => (h < 1.7 || (Math.abs(x - STRAND.x) < 28 && z > STRAND.z - 8 && z < STRAND.z + 14) ? 'sand' : 'grass'),
  };
}
