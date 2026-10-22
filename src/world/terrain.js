import * as THREE from 'three';
import { clamp, lerp, smoothstep, fbm } from '../util.js';

// The whole archipelago is one signed-distance function: negative on land, positive on water.
// World axes: +x east, -z north. Water level is y = 0.

export const BAY = { x: 0, z: -10, r: 80 };
export const ISLAND = { x: 8, z: -24, r: 15 };
export const COVE = { x: 140, z: -16, r: 18 };
export const CHANNEL = [
  [140, -4, 151, 14, 4.8],
  [151, 14, 146, 52, 5.2],
];
export const ISLETS = [
  { x: -150, z: 150, r: 11 },
  { x: 95, z: 185, r: 14 },
  { x: 215, z: 110, r: 9 },
  { x: -212, z: 62, r: 12 },
];
export const STACKS = [
  { x: -58, z: 108, r: 4.6, h: 14 },
  { x: -46, z: 117, r: 3.3, h: 10 },
  { x: -66, z: 121, r: 2.7, h: 7 },
];
export const JETTY = { x: 4, z0: -14, z1: 9, halfW: 1.25, deck: 1.15 };
export const START = { x: 12, z: 32, heading: Math.PI };
export const WATER_RECT = { x: -360, z: -390, w: 720, h: 720 };
export const MAP_RECT = { x: -135, z: -105, w: 330, h: 250 };

const sdCircle = (x, z, cx, cz, r) => Math.hypot(x - cx, z - cz) - r;

function sdCapsule(x, z, ax, az, bx, bz, r) {
  const pax = x - ax, paz = z - az, bax = bx - ax, baz = bz - az;
  const h = clamp((pax * bax + paz * baz) / (bax * bax + baz * baz), 0, 1);
  return Math.hypot(pax - bax * h, paz - baz * h) - r;
}

function sdEllipse(x, z, cx, cz, rx, rz) {
  const px = x - cx, pz = z - cz;
  const k0 = Math.hypot(px / rx, pz / rz);
  const k1 = Math.hypot(px / (rx * rx), pz / (rz * rz));
  return (k0 * (k0 - 1)) / Math.max(k1, 1e-6);
}

function smin(a, b, k) {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return lerp(b, a, h) - k * h * (1 - h);
}
const smax = (a, b, k) => -smin(-a, -b, k);

export function landSDF(x, z) {
  const n1 = fbm(x * 0.021, z * 0.021, 3);
  const n2 = fbm(x * 0.08 + 5.2, z * 0.08 - 3.1, 2);
  // Mainland that wraps around the bay
  let d = sdEllipse(x, z, 0, -95, 235, 150) + n1 * 12 + n2 * 2;
  // The bay itself, open to the south
  d = smax(d, -(sdCircle(x, z, BAY.x, BAY.z, BAY.r) + n1 * 7 + n2 * 1.5), 10);
  // Little island with the jetty
  d = smin(d, sdCircle(x, z, ISLAND.x, ISLAND.z, ISLAND.r) + n2 * 2.2, 5);
  // Far islets on the horizon
  for (const s of ISLETS) d = smin(d, sdCircle(x, z, s.x, s.z, s.r) + n2 * 2.5, 4);
  // Hidden cove behind the eastern headland, reached by a winding channel
  d = smax(d, -(sdCircle(x, z, COVE.x, COVE.z, COVE.r) + n2 * 1.4), 6);
  for (const c of CHANNEL) d = smax(d, -(sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) + n2 * 0.5), 3);
  return d;
}

export function heightAt(x, z) {
  const d = landSDF(x, z);
  if (d >= 0) {
    let h = -0.6 - 9 * (1 - Math.exp(-d / 13));
    h -= 7 * smoothstep(25, 90, d);
    h += fbm(x * 0.06, z * 0.06, 2) * 0.5 * smoothstep(0, 5, d);
    return h;
  }
  const inland = -d;
  let h = -0.6 + 2.2 * smoothstep(0, 9, inland);
  const hill = smoothstep(4, 50, inland);
  const n = fbm(x * 0.011 + 3.1, z * 0.011 - 1.7, 4) * 0.5 + 0.5;
  h += hill * (4 + 30 * n * n + 5 * fbm(x * 0.045, z * 0.045, 3));
  // a soft hump in the middle of the jetty island
  const di = Math.hypot(x - ISLAND.x, z - ISLAND.z);
  h += 2.2 * smoothstep(ISLAND.r + 2, 0, di);
  return h;
}

export function stackHeight(x, z) {
  let h = -100;
  for (const s of STACKS) h = Math.max(h, 2.5 - (Math.hypot(x - s.x, z - s.z) - s.r) * 1.1);
  return h;
}

// Height including the sea stacks, used for collisions and the water shader.
export const solidHeight = (x, z) => Math.max(heightAt(x, z), stackHeight(x, z));

export function zoneAt(x, z) {
  if (Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 4) return 'cove';
  for (const c of CHANNEL) if (sdCapsule(x, z, c[0], c[1], c[2], c[3], c[4]) < -1) return 'cove';
  if (Math.hypot(x - BAY.x, z - BAY.z) < BAY.r + 4) return 'bay';
  return 'open';
}

export const ZONE_NAMES = { bay: 'Willow Bay', cove: 'Driftwood Cove', open: 'open water' };

export const PLACES = [
  {
    id: 'bay', name: 'Willow Bay', sub: 'home waters',
    note: 'Home waters. Calm and sheltered, with sunperch flashing in the shallows.',
    x: -38, z: -30, area: true,
    test: (x, z) => zoneAt(x, z) === 'bay',
  },
  {
    id: 'jetty', name: 'The Old Jetty', sub: 'someone used to tie up here',
    note: 'Weathered planks on the little island. One board is missing, and the lamp still comes on at dusk.',
    x: JETTY.x, z: JETTY.z1,
    test: (x, z) => Math.hypot(x - JETTY.x, z - (JETTY.z0 + JETTY.z1) / 2) < 22,
  },
  {
    id: 'cove', name: 'Driftwood Cove', sub: 'a quiet place, out of the wind',
    note: 'Tucked behind the eastern headland. Bleached logs, shells, and a deep hush.',
    x: COVE.x, z: COVE.z,
    test: (x, z) => Math.hypot(x - COVE.x, z - COVE.z) < COVE.r + 2,
  },
  {
    id: 'gull', name: 'Gull Rock', sub: 'where the water turns deep',
    note: 'Sea stacks past the bay mouth. The water goes dark blue here, and the gulls never stop talking.',
    x: STACKS[0].x, z: STACKS[0].z,
    test: (x, z) => Math.hypot(x - STACKS[0].x, z - STACKS[0].z) < 34,
  },
];

// Walk outward from a point until the ground rises above minH.
export function findShore(cx, cz, angle, minH = 0.3, maxR = 80) {
  const dx = Math.cos(angle), dz = Math.sin(angle);
  for (let r = 0; r < maxR; r += 0.25) {
    const x = cx + dx * r, z = cz + dz * r;
    if (heightAt(x, z) > minH) return { x, z, r };
  }
  return null;
}

export function bakeHeightTexture(size = 512, rect = WATER_RECT) {
  const data = new Uint16Array(size * size);
  for (let j = 0; j < size; j++) {
    const z = rect.z + ((j + 0.5) / size) * rect.h;
    for (let i = 0; i < size; i++) {
      const x = rect.x + ((i + 0.5) / size) * rect.w;
      data[j * size + i] = THREE.DataUtils.toHalfFloat(clamp(solidHeight(x, z), -60, 60));
    }
  }
  const tex = new THREE.DataTexture(data, size, size, THREE.RedFormat, THREE.HalfFloatType);
  tex.magFilter = THREE.LinearFilter;
  tex.minFilter = THREE.LinearFilter;
  tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  return tex;
}
