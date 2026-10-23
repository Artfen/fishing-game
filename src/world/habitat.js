import {
  heightAt, zoneAt, streamFlow, lakeSDF, ISLAND, COVE, STACKS, CHANNEL, JETTY, LAKE, STREAM, SNAG, LILIES,
  RIVER, riverInfo, riverSDF, MARSH, SANDBANKS, QUAY, MERE, MERE_BAYS, HOLM, TIMBER, mereSDF,
  GANNET, PUFFIN_COVE, SKERRIES, SKELLIG, SHOAL, DEEP_Z,
} from './terrain.js';
import { fbm, seeded, smoothstep, clamp } from '../util.js';

// The underwater map every system shares: water depth, weed beds, rocks, and the
// "homes" fish live around. Plants and rocks are placed from it, fish choose where
// to swim from it, and the fish finder reads the bottom and weeds from it.

const CELL = 2;
export const HABITAT_RECT = { x: -240, z: -170, w: 520, h: 420 };
const NX = HABITAT_RECT.w / CELL + 1;
const NZ = HABITAT_RECT.h / CELL + 1;

// Beyond the bay, each area has its own, coarser map: weed, rock and depth, sampled the same way.
// plants: how many weed clumps to grow there (scaled by the graphics setting).
export const REGIONS = [
  { id: 'estuary', x: 380, z: -420, w: 400, h: 720, cell: 3, grass: 1200, kelp: 100 },
  { id: 'mere', x: 100, z: -680, w: 500, h: 300, cell: 3, grass: 1700, kelp: 400 },
  { id: 'gannet', x: -440, z: 280, w: 420, h: 420, cell: 4, grass: 700, kelp: 900 },
  { id: 'shoal', x: 120, z: 420, w: 380, h: 220, cell: 5, grass: 200, kelp: 0 },
  { id: 'deep', x: -300, z: 860, w: 900, h: 440, cell: 10, grass: 0, kelp: 0 },
];

// Hand-placed rock piles; each becomes cover for fish. [x, z, radius]
const BAY_ROCKS = [[-34, -40, 7], [38, -46, 6], [-48, 14, 6], [30, 24, 5], [-14, 30, 5], [52, -8, 5], [-60, -22, 6], [16, 8, 4]];
const OPEN_REEFS = [[40, 78, 6], [-18, 92, 5], [96, 62, 7], [-96, 70, 6], [70, 130, 6]];

export function createHabitat() {
  const rnd = seeded(4242);
  const depthG = new Float32Array(NX * NZ);
  const weedG = new Float32Array(NX * NZ);
  const rockG = new Float32Array(NX * NZ);
  const clusters = [];
  const addCluster = (x, z, r, tag = 'rock') => {
    const d = -heightAt(x, z);
    if (d > 0.9) clusters.push({ x, z, r, depth: d, deep: d >= 8, tag });
  };

  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.4;
    addCluster(ISLAND.x + Math.cos(a) * (ISLAND.r + 9), ISLAND.z + Math.sin(a) * (ISLAND.r + 9), 4.5);
  }
  for (const [x, z, r] of BAY_ROCKS) addCluster(x, z, r);
  for (const [x, z, r] of OPEN_REEFS) addCluster(x, z, r);
  for (const s of STACKS) {
    for (let k = 0; k < 3; k++) {
      const a = rnd() * Math.PI * 2, d = s.r + 4 + rnd() * 5;
      addCluster(s.x + Math.cos(a) * d, s.z + Math.sin(a) * d, 4 + rnd() * 2, 'stack');
    }
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3;
    addCluster(COVE.x + Math.cos(a) * (COVE.r - 6), COVE.z + Math.sin(a) * (COVE.r - 6), 3.5, 'cove');
  }
  for (const c of CHANNEL) {
    for (let k = 1; k < 4; k++) {
      const t = k / 4, side = k % 2 ? 1 : -1;
      const x = c[0] + (c[2] - c[0]) * t, z = c[1] + (c[3] - c[1]) * t;
      const len = Math.hypot(c[2] - c[0], c[3] - c[1]);
      addCluster(x + (-(c[3] - c[1]) / len) * side * 2.5, z + ((c[2] - c[0]) / len) * side * 2.5, 2.5, 'channel');
    }
  }
  // The deepest places in the bay get a big rock pile: home of the largest fish.
  const deepCandidates = [];
  for (let x = -60; x <= 60; x += 6) {
    for (let z = -70; z <= 45; z += 6) {
      if (Math.hypot(x - ISLAND.x, z - ISLAND.z) < ISLAND.r + 14) continue;
      deepCandidates.push({ x, z, d: -heightAt(x, z) });
    }
  }
  deepCandidates.sort((a, b) => b.d - a.d);
  const deepPicked = [];
  for (const c of deepCandidates) {
    if (deepPicked.length >= 2) break;
    if (deepPicked.some((p) => Math.hypot(p.x - c.x, p.z - c.z) < 40)) continue;
    deepPicked.push(c);
    addCluster(c.x, c.z, 8, 'deep');
  }

  // Fill the grid
  for (let j = 0; j < NZ; j++) {
    const z = HABITAT_RECT.z + j * CELL;
    for (let i = 0; i < NX; i++) {
      const x = HABITAT_RECT.x + i * CELL;
      const k = j * NX + i;
      const depth = Math.max(0, -heightAt(x, z));
      depthG[k] = depth;
      if (depth <= 0.2) continue;
      const zone = zoneAt(x, z);
      const shelter = zone === 'cove' ? 0.28 : zone === 'bay' ? 0.1 : zone === 'lake' ? 0.2 : zone === 'stream' ? -0.7 : -0.22;
      // Fish love the shade of the old jetty: always a weed bed around its posts.
      const jetty = smoothstep(16, 4, Math.hypot(x - JETTY.x, z - (JETTY.z0 + JETTY.z1) / 2));
      const band = smoothstep(0.6, 1.4, depth) * (1 - smoothstep(5.5, 8.5, depth));
      const n = fbm(x * 0.035 + 40, z * 0.035 - 12, 3);
      const lilies = smoothstep(LILIES.r + 3, LILIES.r * 0.4, Math.hypot(x - LILIES.x, z - LILIES.z));
      weedG[k] = clamp(band * smoothstep(0.0, 0.3, n + shelter) + jetty * band * 0.8 + lilies * 0.8 * smoothstep(0.3, 0.8, depth), 0, 1);
      let rock = 0;
      for (const c of clusters) {
        const dx = x - c.x, dz = z - c.z;
        if (Math.abs(dx) > c.r || Math.abs(dz) > c.r) continue;
        rock = Math.max(rock, smoothstep(c.r, c.r * 0.35, Math.hypot(dx, dz)));
      }
      rockG[k] = rock;
    }
  }
  // Steep underwater slopes read as rocky too.
  for (let j = 1; j < NZ - 1; j++) {
    for (let i = 1; i < NX - 1; i++) {
      const k = j * NX + i;
      if (depthG[k] < 0.5) continue;
      const gx = (depthG[k + 1] - depthG[k - 1]) / (2 * CELL), gz = (depthG[k + NX] - depthG[k - NX]) / (2 * CELL);
      const slope = Math.hypot(gx, gz);
      rockG[k] = Math.max(rockG[k], smoothstep(0.55, 1.0, slope) * 0.6);
    }
  }

  const regionGrids = buildRegions(clusters, rnd);
  const habitat = {
    rect: HABITAT_RECT,
    regions: [{ id: 'home', ...HABITAT_RECT, grass: 5200, kelp: 1200 }, ...REGIONS],
    clusters,
    spots: [],
    // Bilinear lookup of depth, weed and rock at any point.
    sample(x, z, out = {}) {
      const fx = (x - HABITAT_RECT.x) / CELL, fz = (z - HABITAT_RECT.z) / CELL;
      if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) {
        for (const R of regionGrids) {
          if (R.sample(x, z, out)) return out;
        }
        out.depth = Math.max(0, -heightAt(x, z));
        out.weed = 0;
        out.rock = 0;
        return out;
      }
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const k = j * NX + i;
      const bl = (g) => (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + NX] * (1 - u) + g[k + NX + 1] * u) * v;
      out.depth = bl(depthG);
      out.weed = bl(weedG);
      out.rock = bl(rockG);
      return out;
    },
    depth(x, z) {
      const fx = (x - HABITAT_RECT.x) / CELL, fz = (z - HABITAT_RECT.z) / CELL;
      if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) {
        for (const R of regionGrids) {
          const d = R.depth(x, z);
          if (d >= 0) return d;
        }
        return Math.max(0, -heightAt(x, z));
      }
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j;
      const k = j * NX + i;
      return (depthG[k] * (1 - u) + depthG[k + 1] * u) * (1 - v) + (depthG[k + NX] * (1 - u) + depthG[k + NX + 1] * u) * v;
    },
    // The stream's current at a point (zero everywhere else).
    flow(x, z, out = { x: 0, z: 0 }) {
      return streamFlow(x, z, out);
    },
    // Unit direction towards deeper water, for fish steering away from the shore.
    deeper(x, z, out = { x: 0, z: 0 }) {
      const e = 1.5;
      const gx = this.depth(x + e, z) - this.depth(x - e, z);
      const gz = this.depth(x, z + e) - this.depth(x, z - e);
      const l = Math.hypot(gx, gz) || 1;
      out.x = gx / l;
      out.z = gz / l;
      return out;
    },
  };

  // Homes for fish, spaced out so activity gathers in clusters with quiet water between.
  const spots = habitat.spots;
  const s = {};
  const far = (x, z, type, min) => spots.every((p) => p.type !== type || Math.hypot(p.x - x, p.z - z) > min);
  for (let z = HABITAT_RECT.z + 5; z < HABITAT_RECT.z + HABITAT_RECT.h; z += 9) {
    for (let x = HABITAT_RECT.x + 5; x < HABITAT_RECT.x + HABITAT_RECT.w; x += 9) {
      const px = x + (rnd() - 0.5) * 6, pz = z + (rnd() - 0.5) * 6;
      habitat.sample(px, pz, s);
      const zone = zoneAt(px, pz);
      if (s.weed > 0.5 && s.depth > 0.9 && s.depth < 6.5 && far(px, pz, 'weed', 16)) {
        spots.push({ type: 'weed', x: px, z: pz, depth: s.depth, zone, r: 9 });
      } else if (s.depth > 0.8 && s.depth < 2.8 && s.weed < 0.3 && zone !== 'open' && far(px, pz, 'sand', 20)) {
        spots.push({ type: 'sand', x: px, z: pz, depth: s.depth, zone, r: 10 });
      } else if (zone === 'open' && s.depth > 5 && s.depth < 17 && far(px, pz, 'open', 30)) {
        spots.push({ type: 'open', x: px, z: pz, depth: s.depth, zone, r: 22 });
      }
    }
  }
  for (const c of clusters) {
    spots.push({ type: c.deep ? 'deep' : 'rock', x: c.x, z: c.z, depth: c.depth, zone: zoneAt(c.x, c.z), r: c.deep ? 10 : 8, tag: c.tag });
  }
  // Reedmere: lily pads by camp, the fallen alder, the silty south-west shelf.
  const lakeSpot = (type, x, z, r, tag) => spots.push({ type, x, z, depth: habitat.depth(x, z), zone: 'lake', r, tag });
  lakeSpot('pads', LILIES.x, LILIES.z, 7, 'lilies');
  lakeSpot('pads', LILIES.x - 6, LILIES.z + 4, 6, 'lilies');
  const sdx = Math.sin(SNAG.yaw), sdz = Math.cos(SNAG.yaw);
  lakeSpot('snag', SNAG.x + sdx * 2.5, SNAG.z + sdz * 2.5, 6, 'snag');
  lakeSpot('snag', SNAG.x + sdx * 5, SNAG.z + sdz * 5, 6, 'snag');
  for (let z = LAKE.z - LAKE.rz; z < LAKE.z + LAKE.rz; z += 3) {
    for (let x = LAKE.x - LAKE.rx; x < LAKE.x + 4; x += 3) {
      if (z < LAKE.z - 3 || lakeSDF(x, z) > -2) continue;
      const d = habitat.depth(x, z);
      if (d < 0.8 || d > 2.4) continue;
      if (spots.some((p) => p.type === 'margin' && Math.hypot(p.x - x, p.z - z) < 8)) continue;
      lakeSpot('margin', x, z, 7);
    }
  }
  // Fernbeck: every deep run along the stream is a pool a fish can hold in.
  for (let i = 0; i < STREAM.length - 1; i++) {
    const a = STREAM[i], b = STREAM[i + 1];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    for (let d = 0; d < len; d += 1.5) {
      const x = a[0] + ((b[0] - a[0]) * d) / len, z = a[1] + ((b[1] - a[1]) * d) / len;
      if (lakeSDF(x, z) < 2) continue;
      if (habitat.depth(x, z) < 0.72) continue;
      if (spots.some((p) => p.type === 'pool' && Math.hypot(p.x - x, p.z - z) < 4.5)) continue;
      spots.push({ type: 'pool', x, z, depth: habitat.depth(x, z), zone: 'stream', r: 3 });
    }
  }

  // A named spot right by the jetty, so there is always life near the start.
  const jz = JETTY.z1 - 3;
  spots.push({ type: 'weed', x: JETTY.x + 2.5, z: jz, depth: habitat.depth(JETTY.x + 2.5, jz), zone: 'bay', r: 8, tag: 'jetty' });

  regionSpots(habitat, rnd);
  return habitat;
}

/* ---------------- beyond the bay ---------------- */

// One coarser grid per region (depth, weed, rock), built the same way as the home map.
function buildRegions(clusters, rnd) {
  const add = (x, z, r, tag, min = 0.9) => {
    const d = -heightAt(x, z);
    if (d > min) clusters.push({ x, z, r, depth: d, deep: d >= 8, tag });
  };
  // Reef and kelp round Gannet Isle and its points, the Skerries, Little Skellig.
  for (let k = 0; k < 14; k++) {
    const a = (k / 14) * Math.PI * 2 + 0.2;
    add(GANNET.x + Math.cos(a) * (GANNET.r + 14), GANNET.z + Math.sin(a) * (GANNET.r * 0.8 + 14), 7 + (k % 3) * 2, 'reef');
  }
  for (const k of SKERRIES) for (let i = 0; i < 2; i++) add(k.x + (rnd() - 0.5) * 16, k.z + (rnd() - 0.5) * 16, 6, 'reef');
  for (let k = 0; k < 4; k++) add(SKELLIG.x + Math.cos(k * 1.6) * 24, SKELLIG.z + Math.sin(k * 1.6) * 24, 7, 'reef');
  // Drowned oaks and the steep north shore of Longmere; stones along the quay.
  for (const t of TIMBER) add(t.x + Math.sin(t.yaw) * 6, t.z + Math.cos(t.yaw) * 6, 7, 'snag', 0.6);
  for (let k = 0; k < 5; k++) add(QUAY.end.x + 4 + k * 3, QUAY.end.z + (k % 2 ? 6 : -6), 3, 'quay', 0.6);

  return REGIONS.map((R) => {
    const NXr = Math.round(R.w / R.cell) + 1, NZr = Math.round(R.h / R.cell) + 1;
    const depthG = new Float32Array(NXr * NZr), weedG = new Float32Array(NXr * NZr), rockG = new Float32Array(NXr * NZr);
    for (let j = 0; j < NZr; j++) {
      const z = R.z + j * R.cell;
      for (let i = 0; i < NXr; i++) {
        const x = R.x + i * R.cell;
        const k = j * NXr + i;
        const depth = Math.max(0, -heightAt(x, z));
        depthG[k] = depth;
        if (depth <= 0.2) continue;
        const n = fbm(x * 0.035 + 40, z * 0.035 - 12, 3);
        let weed = 0;
        if (R.id === 'estuary') {
          // Eelgrass in the shallow, sheltered margins; bare sand and mud in the channel.
          const r = riverInfo(x, z);
          const margin = smoothstep(0.4, 0.95, r.d / r.hw);
          weed = smoothstep(0.3, 1.0, depth) * (1 - smoothstep(2.2, 3, depth)) * margin * smoothstep(-0.1, 0.25, n);
        } else if (R.id === 'mere') {
          // Weed beds in the bays and the shallows; lily pads at the bays' heads.
          const band = smoothstep(0.5, 1.2, depth) * (1 - smoothstep(4, 6, depth));
          const bay = MERE_BAYS.some((b) => Math.hypot((x - b.x) / b.rx, (z - b.z) / b.rz) < 1.1) ? 0.35 : 0;
          weed = clamp(band * smoothstep(-0.05, 0.3, n + bay), 0, 1);
        } else if (R.id === 'gannet') {
          // Kelp forests on the reefs and round the island's points.
          weed = smoothstep(1.5, 3, depth) * (1 - smoothstep(10, 14, depth)) * smoothstep(0.05, 0.35, n + 0.1);
        } else if (R.id === 'shoal') {
          weed = smoothstep(2.5, 4, depth) * (1 - smoothstep(6, 9, depth)) * smoothstep(0.2, 0.45, n) * 0.5;
        }
        let rock = 0;
        for (const c of clusters) {
          const dx = x - c.x, dz = z - c.z;
          if (Math.abs(dx) > c.r || Math.abs(dz) > c.r) continue;
          rock = Math.max(rock, smoothstep(c.r, c.r * 0.35, Math.hypot(dx, dz)));
        }
        if (R.id === 'gannet' && rock > 0.2) weed = Math.max(weed, rock * 0.8 * smoothstep(2, 4, depth));
        weedG[k] = weed;
        rockG[k] = rock;
      }
    }
    const inside = (x, z) => {
      const fx = (x - R.x) / R.cell, fz = (z - R.z) / R.cell;
      return fx >= 0 && fz >= 0 && fx < NXr - 1 && fz < NZr - 1 ? [fx, fz] : null;
    };
    const bl = (g, fx, fz) => {
      const i = Math.floor(fx), j = Math.floor(fz), u = fx - i, v = fz - j, k = j * NXr + i;
      return (g[k] * (1 - u) + g[k + 1] * u) * (1 - v) + (g[k + NXr] * (1 - u) + g[k + NXr + 1] * u) * v;
    };
    return {
      id: R.id,
      sample(x, z, out) {
        const f = inside(x, z);
        if (!f) return false;
        out.depth = bl(depthG, f[0], f[1]);
        out.weed = bl(weedG, f[0], f[1]);
        out.rock = bl(rockG, f[0], f[1]);
        return true;
      },
      depth(x, z) {
        const f = inside(x, z);
        return f ? bl(depthG, f[0], f[1]) : -1;
      },
    };
  });
}

// Homes for fish beyond the bay, each with a type the species choose by (see fish.js homes).
function regionSpots(habitat, rnd) {
  const spots = habitat.spots;
  const s = {};
  const put = (type, x, z, r, tag) => {
    const zone = zoneAt(x, z);
    spots.push({ type, x, z, depth: habitat.depth(x, z), zone, r, tag });
  };
  const far = (x, z, type, min) => spots.every((p) => p.type !== type || Math.hypot(p.x - x, p.z - z) > min);
  // The estuary: the deep channel, the sandy and muddy flats, the reedy margins, the quay.
  for (let i = 1; i < RIVER.length; i++) {
    const a = RIVER[i - 1], b = RIVER[i];
    for (let k = 0; k < 1; k += 0.25) {
      const x = a[0] + (b[0] - a[0]) * k, z = a[1] + (b[1] - a[1]) * k;
      const d = habitat.depth(x, z);
      if (d > 1.6 && far(x, z, 'channel', 26)) put('channel', x, z, 14);
    }
  }
  for (let i = 0; i < 2600; i++) {
    const x = 400 + rnd() * 360, z = -380 + rnd() * 640;
    if (riverSDF(x, z) > 2 || z > 175) continue;
    habitat.sample(x, z, s);
    if (s.depth > 0.5 && s.depth < 1.8 && s.weed < 0.3 && far(x, z, 'flats', 24)) put('flats', x, z, 12);
    else if (s.weed > 0.4 && s.depth > 0.5 && far(x, z, 'reeds', 26)) put('reeds', x, z, 10);
  }
  for (const m of MARSH) put('reeds', m.x + m.r + 4, m.z, 9, 'saltings');
  put('quay', QUAY.end.x + 3, QUAY.end.z, 9, 'quay');
  for (const b of SANDBANKS) {
    // The sandy slope off each bank, where it's shallow enough for flounder.
    for (const [dx, dz] of [[0.9, 1.6], [-0.9, -1.6], [1.4, 0], [-1.4, 0]]) {
      const x = b.x + b.rx * dx, z = b.z + b.rz * dz, d = habitat.depth(x, z);
      if (d > 0.5 && d < 3) {
        put('flats', x, z, 12, 'sandbank');
        break;
      }
    }
  }
  // Longmere: weed beds, the drowned oaks, the drop-off, the deep middle, round the holm, the bays.
  for (let i = 0; i < 4000; i++) {
    const x = MERE.x - 230 + rnd() * 460, z = MERE.z - 120 + rnd() * 240;
    if (mereSDF(x, z) > -2) continue;
    habitat.sample(x, z, s);
    if (s.weed > 0.45 && s.depth > 0.8 && s.depth < 4 && far(x, z, 'weed', 20)) put('weed', x, z, 10);
    else if (s.depth > 10 && far(x, z, 'deep', 45)) put('deep', x, z, 18);
    else if (s.depth > 3 && s.depth < 8 && z < MERE.z - 25 && far(x, z, 'dropoff', 26)) put('dropoff', x, z, 10);
    else if (s.depth > 0.6 && s.depth < 1.8 && s.weed < 0.35 && far(x, z, 'shallows', 30)) put('shallows', x, z, 12);
  }
  for (const t of TIMBER) put('snag', t.x + Math.sin(t.yaw) * 5, t.z + Math.cos(t.yaw) * 5, 8, 'oaks');
  for (let k = 0; k < 4; k++) {
    const a = k * 1.57 + 0.4;
    put('holm', HOLM.x + Math.cos(a) * (HOLM.r + 7), HOLM.z + Math.sin(a) * (HOLM.r + 7), 8, 'holm');
  }
  for (const b of MERE_BAYS) put('pads', b.x + (rnd() - 0.5) * b.rx, b.z + (rnd() - 0.5) * b.rz * 0.6, 9, 'lilies');
  // The coast: reefs and kelp, surf on the points, sandy patches, Puffin Cove, the open tide.
  for (const c of habitat.clusters) if (c.tag === 'reef') put('reef', c.x, c.z, 10, 'reef');
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    const x = GANNET.x + Math.cos(a) * (GANNET.r + 4), z = GANNET.z + Math.sin(a) * (GANNET.r * 0.78 + 4);
    const d = habitat.depth(x, z);
    if (d > 0.8 && d < 4.5) put('surf', x, z, 9, 'points');
  }
  put('surf', -480, 140, 12, 'heron');
  put('cove', PUFFIN_COVE.x, PUFFIN_COVE.z, 12, 'puffin');
  put('cove', PUFFIN_COVE.x + 6, PUFFIN_COVE.z - 18, 10, 'puffin');
  put('cove', 4, -8, 10, 'jetty'); // squid come to the old jetty's lamp
  for (let i = 0; i < 900; i++) {
    const x = -440 + rnd() * 420, z = 280 + rnd() * 420;
    habitat.sample(x, z, s);
    if (s.depth > 4 && s.depth < 14 && s.rock < 0.1 && s.weed < 0.2 && far(x, z, 'sand', 45)) put('sand', x, z, 14);
    else if (s.depth > 10 && far(x, z, 'tide', 70)) put('tide', x, z, 26);
  }
  // Long Shoal: sand for plaice, open tide above for mackerel.
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    put('sand', SHOAL.x + Math.cos(a) * SHOAL.rx * 0.5, SHOAL.z + Math.sin(a) * SHOAL.rz * 0.4, 16, 'shoal');
  }
  for (let i = 0; i < 4; i++) put('tide', SHOAL.x - 80 + i * 55, SHOAL.z + (i % 2 ? 50 : -55), 30, 'shoal');
  put('tide', 60, 300, 30);
  put('tide', 360, 260, 30);
  // The deep water: wide-roaming bait shoals and the tuna that follow them.
  for (let i = 0; i < 5; i++) put('blue', -120 + i * 140, DEEP_Z + 120 + (i % 2) * 110, 60, 'blue');
}
