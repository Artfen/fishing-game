import * as THREE from 'three';
import { heightAt, fellPathInfo, coastPathInfo } from './terrain.js';
import { BOTHY, SUMMIT_CAIRN, FOOTBRIDGE, FELL_PATH, FELL_PATH_SEGS, FELL_PATH_LENGTH, COLDWATER, inColdwater } from './coldwater.js';
import { mergeParts, mat, pick, jitterGeo, smoothstep, glowTexture } from '../util.js';
import { withSurface } from './surface.js';

// Up the Coldwater: the footbridge that carries the coast path over the river's mouth, the
// fingerpost where the fell path leaves it, the bothy above Spout Pool (an old stone hut kept
// open for walkers: a stove, a bunk, a shelf of tackle), boulders along the beck and scree high
// on the fell, and the cairn on Hoarfell's top.
//
// All of it made here from simple shapes (no outside models or images).

const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const wood = () => withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' });
function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}
const STONE = ['#8c877d', '#9a958b', '#7f7a70', '#a39d90', '#868176'];
const TIMBER = ['#8a6a4c', '#7d5f44', '#94735a', '#735740'];

/* ---------------- the bothy ---------------- */

const B = BOTHY;
const W = 6.2, D = 4.6, T = 0.55, EAVES = 2.1, PEAK = 1.6; // across, deep, walls, to the eaves, gable rise
// Its own frame: x across the front, z out of the door.
const RX = Math.cos(B.yaw), RZ = -Math.sin(B.yaw), FX = Math.sin(B.yaw), FZ = Math.cos(B.yaw);
const toWorld = (lx, lz) => ({ x: B.x + RX * lx + FX * lz, z: B.z + RZ * lx + FZ * lz });
const _q = new THREE.Quaternion(), _e = new THREE.Euler();
const at = (lx, y, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
  // (Tilted in the hut's own frame, then turned to face the way it does.)
  const p = toWorld(lx, lz);
  return new THREE.Matrix4().compose(new THREE.Vector3(p.x, B.level + y, p.z), _q.setFromEuler(_e.set(rx, B.yaw + ry, rz, 'YXZ')), new THREE.Vector3(sx, sy, sz));
};

// Where you stand at the bothy's door (the game's interaction spot, and where you wake).
export const BOTHY_DOOR = { ...toWorld(0, D / 2 + 1.3), r: 1.8 };

function buildBothy(rnd, obstacles, spots) {
  const stone = [];
  const COURSE = 0.3;
  const course = (y0, len, along, k, skip) => {
    // A course of rough blocks along a wall (along: 'x' for the front and back, 'z' for the ends).
    let s = -len / 2 + (k % 2 ? 0.35 : 0);
    while (s < len / 2 - 0.05) {
      const l = Math.min(0.55 + rnd() * 0.4, len / 2 - s);
      const c = s + l / 2;
      if (!skip?.(c, y0)) {
        const geo = new THREE.BoxGeometry(along === 'x' ? l - 0.03 : T, COURSE * 0.95, along === 'x' ? T : l - 0.03);
        stone.push({ geo, c, l, y0, color: pick(STONE, rnd), jitter: 0.05 });
      }
      s += l;
    }
  };
  const walls = [];
  // Front (the door and a window) and back (one small window), then the two ends with their gables.
  for (let k = 0; k * COURSE < EAVES; k++) {
    const y = k * COURSE + COURSE / 2;
    for (const side of [1, -1]) {
      const n0 = stone.length;
      course(y, W, 'x', k, (c, yy) => (side > 0 && Math.abs(c) < 0.55 && yy < 1.9) || (side > 0 && c > 1.35 && c < 2.15 && yy > 0.85 && yy < 1.5) || (side < 0 && c < -1.2 && c > -1.8 && yy > 1.0 && yy < 1.45));
      for (let i = n0; i < stone.length; i++) walls.push([stone[i], stone[i].c, side * (D / 2 - T / 2), 'x']);
    }
    for (const side of [1, -1]) {
      const n0 = stone.length;
      course(y, D - T * 2, 'z', k + 1);
      for (let i = n0; i < stone.length; i++) walls.push([stone[i], side * (W / 2 - T / 2), stone[i].c, 'z']);
    }
  }
  // The gables: courses narrowing up to the ridge.
  for (let k = 0; k * COURSE < PEAK; k++) {
    const y = EAVES + k * COURSE + COURSE / 2, half = (D / 2) * (1 - (k * COURSE + COURSE) / PEAK) + 0.25;
    for (const side of [1, -1]) {
      const n0 = stone.length;
      course(y, half * 2, 'z', k);
      for (let i = n0; i < stone.length; i++) walls.push([stone[i], side * (W / 2 - T / 2), stone[i].c, 'z']);
    }
  }
  const parts = walls.map(([p, lx, lz]) => ({ geo: p.geo, matrix: at(lx, p.y0, lz, 0, (rnd() - 0.5) * 0.03, 0), color: p.color, jitter: p.jitter }));
  // Lintels over the door and windows, a doorstep, quoins on the corners.
  parts.push({ geo: new THREE.BoxGeometry(1.5, 0.26, T + 0.04), matrix: at(0, 1.98, D / 2 - T / 2), color: '#77726a' });
  parts.push({ geo: new THREE.BoxGeometry(1.1, 0.22, T + 0.04), matrix: at(1.75, 1.58, D / 2 - T / 2), color: '#77726a' });
  parts.push({ geo: new THREE.BoxGeometry(0.9, 0.2, T + 0.04), matrix: at(-1.5, 1.53, -D / 2 + T / 2), color: '#77726a' });
  parts.push({ geo: new THREE.BoxGeometry(1.3, 0.18, 0.7), matrix: at(0, 0.02, D / 2 + 0.3), color: '#858076' });
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    for (let k = 0; k < 7; k++) parts.push({ geo: new THREE.BoxGeometry(0.62, 0.3, 0.62), matrix: at(sx * (W / 2 - 0.28), k * 0.3 + 0.15, sz * (D / 2 - 0.28), 0, (k % 2) * 0.05, 0), color: '#a8a296', jitter: 0.04 });
  }
  // The chimney on the left-hand gable, with a pot.
  parts.push({ geo: new THREE.BoxGeometry(0.75, 1.5, 0.75), matrix: at(-W / 2 + 0.38, EAVES + PEAK + 0.15, 0), color: '#8a857b' });
  parts.push({ geo: new THREE.CylinderGeometry(0.12, 0.14, 0.32, 8), matrix: at(-W / 2 + 0.38, EAVES + PEAK + 1.05, 0), color: '#8b5a42' });
  const walled = mesh(mergeParts(parts, rnd), withSurface(plain(), 'ground'));

  // The roof: slates on two slopes, a ridge, and the door and window frames in old green paint.
  const slope = Math.atan2(PEAK, D / 2 + 0.3), run = Math.hypot(D / 2 + 0.35, PEAK) + 0.1;
  const roof = [];
  for (const side of [1, -1]) {
    for (let r = 0; r < 9; r++) {
      const v = (r + 0.5) / 9, lz = side * (D / 2 + 0.35) * v, y = EAVES + PEAK * (1 - v) + 0.14;
      roof.push({ geo: new THREE.BoxGeometry(W + 0.5, 0.07, run / 9 + 0.1), matrix: at(0, y + 0.02 * (r % 2), lz, side * slope, 0, 0), color: pick(['#454b52', '#3d434a', '#4d5359', '#40464c'], rnd), jitter: 0.05 });
    }
  }
  roof.push({ geo: new THREE.BoxGeometry(W + 0.55, 0.14, 0.26), matrix: at(0, EAVES + PEAK + 0.2, 0), color: '#555a5f' });
  const slates = mesh(mergeParts(roof, rnd), plain());

  const joinery = [];
  joinery.push({ geo: new THREE.BoxGeometry(0.95, 1.82, 0.07), matrix: at(0, 0.93, D / 2 - T + 0.12), color: '#3e5b4a', jitter: 0.03 });
  for (let i = 0; i < 4; i++) joinery.push({ geo: new THREE.BoxGeometry(0.02, 1.78, 0.02), matrix: at(-0.36 + i * 0.24, 0.93, D / 2 - T + 0.16), color: '#33493c' });
  joinery.push({ geo: new THREE.BoxGeometry(0.06, 0.06, 0.08), matrix: at(0.34, 0.95, D / 2 - T + 0.18), color: '#2b2a28' });
  joinery.push({ geo: new THREE.BoxGeometry(0.82, 0.68, 0.06), matrix: at(1.75, 1.17, D / 2 - T + 0.14), color: '#3e5b4a' });
  joinery.push({ geo: new THREE.BoxGeometry(0.62, 0.48, 0.06), matrix: at(-1.5, 1.22, -D / 2 + T - 0.14), color: '#3e5b4a' });
  // A woodpile under the eaves by the door, and a bench of a plank on two stones.
  for (let i = 0; i < 18; i++) {
    const row = Math.floor(i / 6), k = i % 6;
    joinery.push({ geo: new THREE.CylinderGeometry(0.075, 0.075, 0.55, 6), matrix: at(-2.35 + k * 0.155 + (row % 2) * 0.07, 0.08 + row * 0.14, D / 2 + 0.35, 0, 0, Math.PI / 2), color: pick(['#8b6a4a', '#7a5a3c', '#9a7a58'], rnd), jitter: 0.05 });
  }
  joinery.push({ geo: new THREE.BoxGeometry(1.5, 0.07, 0.34), matrix: at(1.75, 0.45, D / 2 + 0.45), color: '#8e6f50' });
  for (const sx of [-0.55, 0.55]) joinery.push({ geo: new THREE.BoxGeometry(0.3, 0.42, 0.3), matrix: at(1.75 + sx, 0.21, D / 2 + 0.45), color: '#8a857b' });
  const timbers = mesh(mergeParts(joinery, rnd), wood());

  // The windows: dark glass, a candle's glow after dark.
  const glass = new THREE.MeshLambertMaterial({ color: '#59666b', emissive: '#ffb45c', emissiveIntensity: 0 });
  const panes = new THREE.Mesh(mergeParts([
    { geo: new THREE.BoxGeometry(0.62, 0.5, 0.02), matrix: at(1.75, 1.17, D / 2 - T + 0.18), color: '#ffffff', jitter: 0 },
    { geo: new THREE.BoxGeometry(0.46, 0.34, 0.02), matrix: at(-1.5, 1.22, -D / 2 + T - 0.18), color: '#ffffff', jitter: 0 },
  ], rnd), glass);

  const group = new THREE.Group();
  group.add(walled, slates, timbers, panes);
  for (const lx of [-2, 0, 2]) {
    const p = toWorld(lx, 0);
    obstacles.push({ x: p.x, z: p.z, r: 2.45, kind: 'building', name: 'the bothy' });
  }
  const pile = toWorld(-2, D / 2 + 0.35), bench = toWorld(1.75, D / 2 + 0.45);
  obstacles.push({ x: pile.x, z: pile.z, r: 0.5, top: B.level + 0.5, kind: 'thing', name: 'the woodpile' });
  obstacles.push({ x: bench.x, z: bench.z, r: 0.55, top: B.level + 0.5, kind: 'thing', name: 'the bench' });
  spots.push({ kind: 'bothy', name: 'the bothy', ...BOTHY_DOOR });

  // Peat smoke from the chimney, drifting off.
  const smoke = [];
  const tex = glowTexture();
  const top = toWorld(-W / 2 + 0.38, 0);
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, color: '#c9c6c0', transparent: true, depthWrite: false, opacity: 0, fog: true }));
    s.userData = { k: i / 7 };
    group.add(s);
    smoke.push(s);
  }
  return { group, glass, smoke, chimney: { x: top.x, y: B.level + EAVES + PEAK + 1.25, z: top.z } };
}

/* ---------------- the footbridge and the fingerpost ---------------- */

function buildFootbridge(rnd, obstacles) {
  const F = FOOTBRIDGE, hx = F.len / 2;
  const ux = Math.cos(F.yaw), uz = -Math.sin(F.yaw); // along the bridge
  const vx = Math.sin(F.yaw), vz = Math.cos(F.yaw); // across it
  const deckAt = (u) => F.deck + F.arch * (1 - (u / hx) ** 2);
  const tilt = (u) => Math.atan((-2 * F.arch * u) / (hx * hx));
  const P = (u, y, v, rz = 0, sx = 1, sy = 1, sz = 1) => mat(F.x + ux * u + vx * v, y, F.z + uz * u + vz * v, 0, F.yaw, rz, sx, sy, sz);
  const parts = [];
  // Planks across, following the arch.
  for (let u = -hx + 0.12; u < hx; u += 0.26) {
    parts.push({ geo: new THREE.BoxGeometry(0.24, 0.07, F.w), matrix: P(u, deckAt(u) - 0.035, 0, tilt(u)), color: pick(TIMBER, rnd), jitter: 0.05 });
  }
  // Two beams under the deck, in short straight pieces along the curve.
  const N = 12;
  for (let i = 0; i < N; i++) {
    const u0 = -hx + (i / N) * F.len, u1 = u0 + F.len / N, um = (u0 + u1) / 2;
    const len = Math.hypot(u1 - u0, deckAt(u1) - deckAt(u0)) + 0.05;
    for (const v of [-F.w / 2 + 0.12, F.w / 2 - 0.12]) {
      parts.push({ geo: new THREE.BoxGeometry(len, 0.22, 0.16), matrix: P(um, deckAt(um) - 0.18, v, tilt(um)), color: '#6c5038' });
    }
  }
  // Handrails: posts, and a rail along their tops.
  const posts = [];
  for (let u = -hx + 0.15; u <= hx; u += F.len / 10) posts.push(Math.min(u, hx - 0.15));
  for (const v of [-F.w / 2 + 0.05, F.w / 2 - 0.05]) {
    for (const u of posts) parts.push({ geo: new THREE.BoxGeometry(0.1, 1.05, 0.1), matrix: P(u, deckAt(u) + 0.5, v), color: '#6e5238' });
    for (let i = 0; i < posts.length - 1; i++) {
      const u0 = posts[i], u1 = posts[i + 1], um = (u0 + u1) / 2;
      const len = Math.hypot(u1 - u0, deckAt(u1) - deckAt(u0));
      parts.push({ geo: new THREE.BoxGeometry(len, 0.08, 0.09), matrix: P(um, deckAt(um) + 1.0, v, Math.atan2(deckAt(u1) - deckAt(u0), u1 - u0)), color: '#7a5a3e' });
      parts.push({ geo: new THREE.BoxGeometry(len, 0.05, 0.04), matrix: P(um, deckAt(um) + 0.55, v, Math.atan2(deckAt(u1) - deckAt(u0), u1 - u0)), color: '#735538' });
    }
  }
  // Trestles standing in the channel, and stone abutments at the ends.
  for (const u of [-5.2, 0, 5.2]) {
    for (const v of [-F.w / 2 - 0.05, F.w / 2 + 0.05]) {
      const x = F.x + ux * u + vx * v, z = F.z + uz * u + vz * v, bed = heightAt(x, z) - 0.3, top = deckAt(u) - 0.25;
      if (top - bed < 0.3) continue;
      parts.push({ geo: new THREE.CylinderGeometry(0.11, 0.13, top - bed, 6), matrix: mat(x, (top + bed) / 2, z), color: '#5a4430' });
      obstacles.push({ x, z, r: 0.2, kind: 'thing', name: 'the footbridge' });
    }
    parts.push({ geo: new THREE.BoxGeometry(0.16, 0.16, F.w + 0.5), matrix: P(u, deckAt(u) - 0.33, 0), color: '#5f4834' });
  }
  const stones = [];
  for (const s of [-1, 1]) {
    for (let k = 0; k < 8; k++) {
      const u = s * (hx - 0.6 - (k % 4) * 0.5), v = (Math.floor(k / 4) - 0.5) * 1.1;
      const x = F.x + ux * u + vx * v, z = F.z + uz * u + vz * v, g = heightAt(x, z);
      stones.push({ geo: new THREE.BoxGeometry(0.6, Math.max(0.3, deckAt(u) - g - 0.1), 0.7), matrix: P(u, (deckAt(u) + g - 0.1) / 2 - 0.05, v), color: pick(STONE, rnd), jitter: 0.06 });
    }
  }
  const group = new THREE.Group();
  group.add(mesh(mergeParts(parts, rnd), wood()), mesh(mergeParts(stones, rnd), plain()));
  return group;
}

// Where the fell path leaves the coast path, just east of the footbridge (in the angle between
// the two, clear of both), and the distances on its arm (km, along the path).
export const FINGERPOST = { x: -34, z: -95.5, r: 1.6 };
export const FELL_SIGN = (() => {
  let s = 0, best = Infinity, at = 0;
  for (const g of FELL_PATH_SEGS) {
    const bx = g.bx - g.ax, bz = g.bz - g.az, u = Math.max(0, Math.min(1, ((BOTHY_DOOR.x - g.ax) * bx + (BOTHY_DOOR.z - g.az) * bz) / (g.len * g.len)));
    const d = Math.hypot(BOTHY_DOOR.x - g.ax - bx * u, BOTHY_DOOR.z - g.az - bz * u);
    if (d < best) {
      best = d;
      at = s + g.len * u;
    }
    s += g.len;
  }
  return { bothy: at / 1000, summit: FELL_PATH_LENGTH / 1000 };
})();

function buildFingerpost(rnd, obstacles, spots) {
  const F = FINGERPOST, g = heightAt(F.x, F.z) - 0.1;
  const [x0, z0] = FELL_PATH[0], [x1, z1] = FELL_PATH[3];
  const up = Math.atan2(x1 - x0, z1 - z0); // up the fell path (yaw of +z)
  const parts = [
    { geo: new THREE.BoxGeometry(0.13, 2.1, 0.13), matrix: mat(F.x, g + 1.05, F.z), color: '#6f5d48' },
    { geo: new THREE.ConeGeometry(0.11, 0.16, 4), matrix: mat(F.x, g + 2.18, F.z, 0, Math.PI / 4, 0), color: '#5f4f3d' },
  ];
  // Arms: up the fell, west over the bridge, east to Willowhaven. Each a board with a pointed end.
  const arm = (yaw, y) => {
    const ax = Math.sin(yaw), az = Math.cos(yaw);
    parts.push({ geo: new THREE.BoxGeometry(0.05, 0.17, 0.75), matrix: mat(F.x + ax * 0.42, g + y, F.z + az * 0.42, 0, yaw, 0), color: '#e7e0cf', jitter: 0.03 });
    parts.push({ geo: new THREE.BoxGeometry(0.05, 0.12, 0.12), matrix: mat(F.x + ax * 0.82, g + y, F.z + az * 0.82, Math.PI / 4, yaw, 0), color: '#e7e0cf', jitter: 0.03 });
  };
  arm(up, 1.85);
  arm(FOOTBRIDGE.yaw - Math.PI / 2, 1.6);
  arm(FOOTBRIDGE.yaw + Math.PI / 2, 1.38);
  obstacles.push({ x: F.x, z: F.z, r: 0.2, kind: 'thing', name: 'the fingerpost' });
  spots.push({ kind: 'fingerpost', name: 'the fingerpost', ...F });
  return mesh(mergeParts(parts, rnd), wood());
}

/* ---------------- the cairn ---------------- */

function buildCairn(rnd, obstacles, spots) {
  const C = SUMMIT_CAIRN, g = heightAt(C.x, C.z) - 0.15;
  const rock = jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.35, rnd);
  const parts = [];
  // Rings of stones, smaller and narrower going up: a cone about as tall as you.
  for (let ring = 0; ring < 8; ring++) {
    const y = ring * 0.24, r = 1.45 * (1 - ring / 8.5), n = Math.max(1, Math.round(r * 5));
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + ring * 0.7 + rnd() * 0.3, s = 0.22 + rnd() * 0.12 + (8 - ring) * 0.012;
      parts.push({ geo: rock, matrix: mat(C.x + Math.sin(a) * r * 0.85, g + y + s * 0.5, C.z + Math.cos(a) * r * 0.85, rnd() * 3, rnd() * 3, rnd() * 3, s * 1.2, s * 0.8, s), color: pick(['#8f8b83', '#9d988e', '#7c7871', '#a9a49a'], rnd), jitter: 0.06 });
    }
  }
  obstacles.push({ x: C.x, z: C.z, r: 1.5, top: g + 2, kind: 'thing', name: 'the cairn' });
  spots.push({ kind: 'cairn', name: 'the cairn on Hoarfell', x: C.x, z: C.z, r: 3 });
  return mesh(mergeParts(parts, rnd), plain());
}

/* ---------------- boulders and scree ---------------- */

function buildBoulders(rnd) {
  const rock = jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.4, rnd);
  const beck = [], scree = [];
  const near = (x, z) => fellPathInfo(x, z).d < 3.5 || Math.hypot(x - BOTHY.x, z - BOTHY.z) < 11 || coastPathInfo(x, z).d < 3;
  // Along the river from the tarn to the Lower Force: boulders at the water's edge and in the
  // quick, shallow runs (never in the pools, where the fish lie).
  for (let i = 0; i < 33; i++) {
    const a = COLDWATER[i], b = COLDWATER[i + 1], len = Math.hypot(b.x - a.x, b.z - a.z);
    const tx = (b.x - a.x) / len, tz = (b.z - a.z) / len;
    for (let d = rnd() * 6; d < len; d += 3 + rnd() * 6) {
      const k = d / len, w = a.w + (b.w - a.w) * k, side = rnd() < 0.5 ? -1 : 1;
      const mid = rnd() < 0.3 && a.d < 1.2;
      const off = mid ? (rnd() - 0.5) * w * 1.2 : side * (w + 0.3 + rnd() * 2.5);
      const x = a.x + tx * d - tz * off, z = a.z + tz * d + tx * off;
      if (near(x, z)) continue;
      const s = mid ? 0.35 + rnd() * 0.45 : 0.45 + rnd() * 0.9, h = heightAt(x, z);
      beck.push({ geo: rock, matrix: mat(x, h + s * 0.15, z, rnd() * 0.6, rnd() * 6, rnd() * 0.6, s * (1 + rnd() * 0.4), s * (0.6 + rnd() * 0.3), s), color: pick(['#7d7a72', '#8a857b', '#6e6b64', '#94907f'], rnd), jitter: 0.07 });
    }
  }
  // High on the fell: scree on the steep ground and blocks fallen from the crags, above the
  // last of the trees.
  for (let i = 0; i < 2600 && scree.length < 420; i++) {
    const x = -1240 + rnd() * 560, z = -1720 + rnd() * 520;
    const h = heightAt(x, z);
    if (h < 300 || near(x, z) || inColdwater(x, z, 2)) continue;
    const gx = heightAt(x + 2, z) - heightAt(x - 2, z), gz = heightAt(x, z + 2) - heightAt(x, z - 2), g = Math.hypot(gx, gz) / 4;
    if (g < 0.55 && rnd() > 0.15) continue;
    const s = 0.3 + rnd() * rnd() * 1.6;
    scree.push({ geo: rock, matrix: mat(x, h + s * 0.1, z, rnd() * 0.8, rnd() * 6, rnd() * 0.8, s * 1.2, s * 0.7, s), color: pick(['#86837b', '#928e84', '#76736c', '#a19c91'], rnd), jitter: 0.08 });
  }
  return { beck: mesh(mergeParts(beck, rnd), plain()), scree: mesh(mergeParts(scree, rnd), plain()) };
}

/* ---------------- all of it ---------------- */

export function buildFell(scene, rnd) {
  const obstacles = [], spots = [];
  const bothy = buildBothy(rnd, obstacles, spots);
  const bridge = buildFootbridge(rnd, obstacles);
  const post = buildFingerpost(rnd, obstacles, spots);
  const cairn = buildCairn(rnd, obstacles, spots);
  const rocks = buildBoulders(rnd);
  scene.add(bothy.group, bridge, post, cairn, rocks.beck, rocks.scree);
  // (The far ones go undrawn when you're nowhere near.)
  const distant = [rocks.beck, rocks.scree, cairn];
  for (const o of bothy.group.children) if (o.isMesh) distant.push(o);
  return {
    obstacles, spots, distant,
    // The tackle shelf in the bothy, for the backpack.
    boxes: [{ place: 'bothy', x: BOTHY_DOOR.x, z: BOTHY_DOOR.z }],
    update(dt, t, env, cp) {
      // A candle in the window after dark; smoke from the stove, when you're near enough to see it.
      bothy.glass.emissiveIntensity = smoothstep(0.2, 0.7, env.night) * 0.9;
      const near = cp && Math.hypot(cp.x - BOTHY.x, cp.z - BOTHY.z) < 450;
      for (const s of bothy.smoke) {
        s.visible = !!near;
        if (!near) continue;
        const k = (s.userData.k + t * 0.05) % 1;
        s.position.set(bothy.chimney.x + k * 4 + Math.sin(t * 0.4 + s.userData.k * 9) * 0.4, bothy.chimney.y + k * 5, bothy.chimney.z + k * 1.5);
        s.scale.setScalar(0.6 + k * 2.6);
        s.material.opacity = 0.22 * Math.sin(k * Math.PI) * (1 - env.night * 0.5);
      }
    },
  };
}
