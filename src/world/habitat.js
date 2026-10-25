import {
  heightAt, zoneAt, streamFlow, lakeSDF, ISLAND, COVE, STACKS, CHANNEL, JETTY, LAKE, STREAM, SNAG, LILIES,
  RIVER, riverInfo, riverSDF, MARSH, SANDBANKS, QUAY, MERE, MERE_BAYS, HOLM, TIMBER, mereSDF,
  GANNET, PUFFIN_COVE, SKERRIES, SKELLIG, SHOAL, DEEP_Z, WRECK, STRAND, DAYMARK, CALF, CALF_SKERRY, CALF_SOUND,
  HAVEN, HAVEN_QUAY, BOATHOUSE_PIER, waterLevel,
} from './terrain.js';
import { COLDWATER, TARN } from './coldwater.js';
import {
  SOUTH_Z, SOUTH_MAP, brasaHeight, brasaZone, brasaHabitat, brasaSDF, PUERTO, QUAY_S, MOLE, DIQUE, PLAYA, ARCO, ARCHES, FARO, COLADAS, SEBADAL, BAJON, onBajon,
} from './brasa.js';
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
  { id: 'calf', x: -560, z: 90, w: 160, h: 150, cell: 3, grass: 120, kelp: 420 },
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
  // The Kittiwake: her broken hull on the reef is cover like any rock pile, bow to stern.
  for (const k of [-0.38, 0, 0.38]) addCluster(WRECK.x + Math.sin(WRECK.yaw) * WRECK.len * k, WRECK.z + Math.cos(WRECK.yaw) * WRECK.len * k, 5, 'wreck');
  // Ledges under Cove Head.
  addCluster(DAYMARK.x + 10, DAYMARK.z + 22, 5, 'head');
  addCluster(DAYMARK.x - 2, DAYMARK.z + 21, 4, 'head');
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
      // (Las Brasas, far to the south, is described by its own functions: see brasa.js.)
      if (z > SOUTH_Z) return brasaHabitat(x, z, out);
      const fx = (x - HABITAT_RECT.x) / CELL, fz = (z - HABITAT_RECT.z) / CELL;
      if (fx < 0 || fz < 0 || fx >= NX - 1 || fz >= NZ - 1) {
        for (const R of regionGrids) {
          if (R.sample(x, z, out)) return out;
        }
        out.depth = Math.max(0, waterLevel(x, z) - heightAt(x, z));
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
        return Math.max(0, waterLevel(x, z) - heightAt(x, z));
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
      // (The Coldwater keeps its own homes, added after everything else: see coldwaterSpots.)
      if (zone === 'river' || zone === 'tarn' || zone === 'tideway') continue;
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
    // (The Calf's rocks keep only the fish it hosts, so nothing elsewhere moves: see regionSpots.)
    spots.push({ type: c.deep ? 'deep' : 'rock', x: c.x, z: c.z, depth: c.depth, zone: zoneAt(c.x, c.z), r: c.deep ? 10 : 8, tag: c.tag, ...(c.tag === 'calf' ? { hosts: [] } : {}) });
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

  // The cove shore: surf off Shell Strand and under Cove Head, sand beyond the strand, and the
  // wreck itself (reef for the wrasse, and a dark hull for the conger).
  const coastSpot = (type, x, z, r, tag) => {
    const d = habitat.depth(x, z);
    if (d > 0.6) spots.push({ type, x, z, depth: d, zone: zoneAt(x, z), r, tag });
  };
  coastSpot('surf', STRAND.x - 3, STRAND.z + 16, 9, 'strand');
  coastSpot('surf', STRAND.x - 26, STRAND.z + 22, 9, 'strand');
  coastSpot('sand', STRAND.x + 10, STRAND.z + 30, 14, 'strand');
  coastSpot('sand', STRAND.x - 22, STRAND.z + 34, 14, 'strand');
  coastSpot('surf', DAYMARK.x + 2, DAYMARK.z + 20, 9, 'head');
  coastSpot('reef', DAYMARK.x + 10, DAYMARK.z + 22, 8, 'head');
  coastSpot('reef', WRECK.x, WRECK.z, 9, 'wreck');
  coastSpot('rock', WRECK.x - Math.sin(WRECK.yaw) * 6, WRECK.z - Math.cos(WRECK.yaw) * 6, 7, 'wreck');

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
  // The Calf: broken rock all round its foot, the skerry, and the ledges along the Sound.
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2 + 0.3;
    add(CALF.x + Math.cos(a) * (CALF.rx + 7), CALF.z + Math.sin(a) * (CALF.rz + 7), 6 + (k % 3), 'calf');
  }
  add(CALF_SKERRY.x, CALF_SKERRY.z + CALF_SKERRY.r + 4, 6, 'calf');
  add(CALF_SKERRY.x - CALF_SKERRY.r - 4, CALF_SKERRY.z, 5, 'calf');

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
        } else if (R.id === 'gannet' || R.id === 'calf') {
          // Kelp forests on the reefs and round the islands' points.
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
        if ((R.id === 'gannet' || R.id === 'calf') && rock > 0.2) weed = Math.max(weed, rock * 0.8 * smoothstep(2, 4, depth));
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
  // The Calf and its Sound. These homes have fish of their own (hosts, see ecosystem.js), added
  // on top of everything else, so no fish anywhere else moves to fill them: mackerel, garfish
  // and bluefish hunting sandeels in the race; pollack over the kelp off the Calf's west foot
  // and wrasse along its ledges; bass in the white water off the Nose, where the race breaks.
  const host = (type, x, z, r, tag, hosts) => {
    const d = habitat.depth(x, z);
    if (d > 1.2) spots.push({ type, x, z, depth: d, zone: zoneAt(x, z), r, tag, hosts });
  };
  const S = CALF_SOUND;
  host('tide', (S.x0 + S.x1) / 2 - 8, (S.z0 + S.z1) / 2, 14, 'race', ['mackerel', 'garfish', 'bluefish']);
  host('tide', S.x1 - 6, S.z1 + 2, 12, 'race', ['mackerel']);
  host('reef', CALF.x - CALF.rx - 9, CALF.z + 2, 10, 'calf', ['pollack', 'wrasse']);
  host('reef', CALF.x - 4, CALF.z + CALF.rz + 8, 9, 'calf', ['pollack', 'wrasse']);
  host('reef', CALF_SKERRY.x, CALF_SKERRY.z + CALF_SKERRY.r + 5, 8, 'calf', ['wrasse']);
  host('surf', CALF.x + 6, CALF.z - CALF.rz - 4, 9, 'nose', ['seabass']);
  // The places you fish from that were too quiet for how often you're there: they get fish of
  // their own the same way, the kinds that really haunt such places.
  //  · The haven, home: grey mullet cruising the quay wall, gilthead and a conger in its stones,
  //    squid under the lamp after dark, sand smelt in the calm water inside.
  host('quay', HAVEN_QUAY.end.x + 4, HAVEN_QUAY.end.z - 2.5, 7, 'haven', ['mullet', 'gilthead', 'conger']);
  host('cove', HAVEN_QUAY.end.x - 2, HAVEN_QUAY.end.z + 3.5, 9, 'haven', ['squid']);
  host('weed', HAVEN.x + 2, HAVEN.z + 11, 7, 'haven', ['sandsmelt']);
  //  · The lake landing's pier, out into the bay: sand smelt and gilthead off its end.
  host('weed', -72, -9, 8, 'landing', ['sandsmelt', 'gilthead']);
  //  · Wend Quay: mullet along the wall on the flood, a bass or two after them.
  host('quay', QUAY.end.x + 3, QUAY.end.z, 8, 'quay', ['mullet', 'seabass']);
  //  · The Longmere boathouse: perch and roach in its shade, and a pike waiting for them.
  host('weed', BOATHOUSE_PIER.x0 + 7, BOATHOUSE_PIER.z0 - 6, 8, 'boathouse', ['perch', 'roach']);
  host('snag', BOATHOUSE_PIER.x0 - 1, BOATHOUSE_PIER.z0 - 6, 7, 'boathouse', ['pike']);
  coldwaterSpots(habitat, spots);
  southSpots(habitat, spots);
}

// The Coldwater's own fish, last of all (so no fish anywhere else moves): brown trout in every
// pool from the tarn to the Lower Force, grayling in the dale's bigger pools as well, trout round
// Hoar Tarn's shores; and in the tideway below the Force, sea bass, flounder and grey mullet
// that come up on the tide, and an eel or two (protected: to watch). Each home knows its water's
// level, so its fish swim in the pool up the fell and not in the air above the sea.
function coldwaterSpots(habitat, spots) {
  const put = (type, x, z, r, tag, hosts) => {
    const d = habitat.depth(x, z);
    if (d > 0.7) spots.push({ type, x, z, depth: d, zone: zoneAt(x, z), r, tag, hosts, level: waterLevel(x, z) });
  };
  COLDWATER.forEach((n, i) => {
    if (n.l <= 0.05 || n.d < 1.4) return;
    put('pool', n.x, n.z, Math.min(n.w * 0.9, 7), i === 11 || i === 12 ? 'spout' : i < 10 ? 'beck' : i < 19 ? 'gill' : 'dale', n.l < 80 ? ['trout', 'grayling'] : ['trout']);
  });
  for (let k = 0; k < 4; k++) {
    const a = TARN.yaw + (k / 4) * Math.PI * 2 + 0.4;
    const x = TARN.x + Math.cos(a) * TARN.rx * 0.55, z = TARN.z + Math.sin(a) * TARN.rz * 0.55;
    put('pool', x, z, 12, 'tarn', ['trout']);
  }
  const at = (i) => COLDWATER[i];
  // (The Force Pool's fish keep below the fall's churn, in the tide's reach.)
  put('channel', at(33).x + (at(34).x - at(33).x) * 0.45, at(33).z + (at(34).z - at(33).z) * 0.45, 6, 'forcepool', ['seabass', 'eel']);
  put('channel', at(36).x, at(36).z, 9, 'tideway', ['seabass', 'flounder']);
  put('channel', at(38).x, at(38).z, 9, 'tideway', ['flounder', 'eel']);
  put('flats', at(40).x, at(40).z, 9, 'tideway', ['mullet', 'flounder']);
}

// Las Brasas, far to the south: homes of its own (marked south, so the home coast's fish never
// pick them, and its own seed, so nothing at home moves). Reef and boulders round the shore,
// brown weed and seagrass, sand off the beach and over the sebadal, surf on Playa Negra, the
// drop-off's wall and its caves, the arches off the Roque, the tide off the points, and the blue
// water beyond. The fish that live on them are chosen in the ecosystem (see populate).
function southSpots(habitat, spots) {
  const rnd = seeded(6006);
  const S = {};
  const list = [];
  const put = (type, x, z, r, tag) => {
    const depth = Math.max(0, -brasaHeight(x, z));
    if (depth < 0.6) return;
    const o = { type, x, z, depth, zone: brasaZone(x, z), r, tag, south: true };
    list.push(o);
    spots.push(o);
  };
  const clear = (type, x, z, gap) => list.every((p) => p.type !== type || Math.hypot(p.x - x, p.z - z) > gap);
  const M = SOUTH_MAP;
  const near = (x, z, P, r) => Math.hypot(x - P.x, z - P.z) < r;
  for (let z = M.z + 4; z < M.z + M.h; z += 13) {
    for (let x = M.x + 4; x < M.x + M.w; x += 13) {
      const px = x + (rnd() - 0.5) * 9, pz = z + (rnd() - 0.5) * 9;
      const d = brasaSDF(px, pz);
      if (d < 1) continue;
      brasaHabitat(px, pz, S);
      const zone = brasaZone(px, pz), depth = S.depth;
      if (onBajon(px, pz) > 0.2) continue; // (El Bajón's are placed by hand, below)
      const tag = near(px, pz, ARCO, 120) ? 'roque' : near(px, pz, FARO, 160) ? 'faro' : near(px, pz, PLAYA, 190) ? 'playa' : zone === 'harbor' ? 'puerto'
        : zone === 'sebadal' ? 'sebadal' : COLADAS.some((c) => Math.hypot(px - c[2], pz - c[3]) < 150) ? 'coladas' : zone === 'veril' ? 'veril' : null;
      if (zone === 'harbor') continue; // (the harbour's are placed by hand, below)
      if (zone === 'ocean') {
        if (depth > 60 && clear('blue', px, pz, 160)) put('blue', px, pz, 40, 'ocean');
        continue;
      }
      if (zone === 'veril') {
        // The wall: the steep edge, with caves in it; open water above and beyond.
        if (S.rock > 0.55 && depth > 20 && depth < 60 && clear('cave', px, pz, 55)) put('cave', px, pz, 8, tag || 'veril');
        else if (S.rock > 0.4 && depth > 18 && depth < 70 && clear('wall', px, pz, 45)) put('wall', px, pz, 14, tag || 'veril');
        else if (depth > 30 && clear('open', px, pz, 90)) put('open', px, pz, 26, tag || 'veril');
        continue;
      }
      if (tag === 'playa' && depth > 0.8 && depth < 3.2 && clear('surf', px, pz, 24)) put('surf', px, pz, 9, 'playa');
      else if (S.grass > 0.45 && clear('weed', px, pz, 34)) put('weed', px, pz, 12, tag || 'sebadal');
      else if (S.rock > 0.6 && depth > 2 && depth < 20 && clear('reef', px, pz, 30)) put('reef', px, pz, 10, tag);
      else if (S.rock > 0.35 && depth > 0.9 && depth < 8 && clear('rock', px, pz, 26)) put('rock', px, pz, 8, tag);
      else if (S.weed > 0.4 && depth > 1 && depth < 9 && clear('weed', px, pz, 30)) put('weed', px, pz, 9, tag);
      else if (S.rock < 0.25 && S.weed < 0.25 && depth > 3 && depth < 22 && clear('sand', px, pz, 40)) put('sand', px, pz, 12, tag);
      else if (depth > 6 && depth < 30 && (tag === 'faro' || tag === 'roque') && clear('tide', px, pz, 60)) put('tide', px, pz, 18, tag);
    }
  }
  // The harbour: along the quay and the inside of the breakwater, and the middle of the basin.
  for (let x = QUAY_S.x0 + 6; x < QUAY_S.x1; x += 16) put('quay', x, QUAY_S.z1 + 3, 6, 'puerto');
  for (let z = DIQUE.z0 + 10; z < DIQUE.z1 - 6; z += 18) put('quay', DIQUE.x0 - 3, z, 6, 'puerto');
  put('rock', MOLE.x0 + 10, MOLE.z0 - 3, 6, 'puerto');
  put('sand', PUERTO.x - 10, PUERTO.z + 10, 10, 'puerto');
  // Los Arcos: the arches under the water off the Roque, and the caves round it.
  for (const A of ARCHES) {
    put('cave', A.x, A.z, 7, 'arcos');
    put('reef', A.x + Math.cos(A.yaw) * 14, A.z + Math.sin(A.yaw) * 14, 9, 'arcos');
  }
  for (let k = 0; k < 6; k++) {
    const a = (k / 6) * Math.PI * 2 + 0.3, r = ARCO.r + 14;
    put(k % 2 ? 'reef' : 'cave', ARCO.x + Math.cos(a) * r, ARCO.z + Math.sin(a) * r, 8, 'roque');
  }
  // El Bajón: the tops of its pinnacles (rock), their sides (reef), a cave under the biggest, the
  // seaward foot (the wall), and sand in the gullies.
  {
    const c = Math.cos(BAJON.yaw), s = Math.sin(BAJON.yaw);
    const at = (u, v) => ({ x: BAJON.x + u * c + v * s, z: BAJON.z - u * s + v * c });
    BAJON.peaks.forEach((p, i) => {
      const t = at(p.u, p.v);
      put('rock', t.x, t.z, 5, 'bajon');
      const f = at(p.u + 2, p.v + (i % 2 ? 6 : -6));
      put('reef', f.x, f.z, 6, 'bajon');
    });
    for (const [u, v, type] of [[-14, 9, 'cave'], [4, -11, 'cave'], [-30, 0, 'wall'], [32, 4, 'wall'], [0, 14, 'wall'], [-10, -14, 'reef'], [16, 12, 'reef'], [3, 0, 'sand']]) {
      const t = at(u, v);
      put(type, t.x, t.z, type === 'wall' ? 10 : 6, 'bajon');
    }
  }
  // (The middle of the sebadal: sand where the seagrass parts.)
  for (let k = 0; k < 5; k++) put('sand', SEBADAL.x - 160 + k * 80, SEBADAL.z + (k % 2 ? 40 : -30), 14, 'sebadal');
}
