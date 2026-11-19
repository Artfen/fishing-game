import * as THREE from 'three';
import { clamp, smoothstep, fbm, mergeParts, mat, jitterGeo } from '../util.js';
import { northAt, heightAt } from './terrain.js';
import { withCaustics } from './caustics.js';
import { TERN, RAVEN, inSound, inBothyBay, lochAt } from './north.js';

// The north's look (docs/NORTH.md): the colours of its ground and seabed, and (N2, N3) what
// stands on it. Cold and northern: grass and heather on the fells, grey crags and scree, cliffs
// of grey rock to the west; green machair and white shell sand on Tern Isle; under the water,
// dark kelp on every rocky shore, grey-green sand, mud in the loch's deep.
const NC = {
  grass: new THREE.Color('#7f914f'),
  grassDark: new THREE.Color('#5b6b3b'),
  machair: new THREE.Color('#93a95c'),
  heather: new THREE.Color('#6d5a5d'),
  bracken: new THREE.Color('#87693d'),
  scree: new THREE.Color('#999488'),
  crag: new THREE.Color('#6b6963'),
  cliff: new THREE.Color('#5f5e5a'),
  shingle: new THREE.Color('#8a877f'),
  shellSand: new THREE.Color('#e4dcc6'),
  wetShell: new THREE.Color('#bdb59f'),
  wetShingle: new THREE.Color('#5d5a52'),
  sand: new THREE.Color('#a39c80'),
  bed: new THREE.Color('#7f7c66'),
  kelp: new THREE.Color('#4a4526'),
  mud: new THREE.Color('#4c4a3f'),
  rock: new THREE.Color('#57564f'),
  deep: new THREE.Color('#2c3536'),
};

// The ground's colour at a point of the north (for the terrain's triangles).
export function northColor(c, h, ny, x, z, r) {
  const S = northAt(x, z), n = fbm(x * 0.02 + 3, z * 0.02 - 8, 3), n2 = fbm(x * 0.09 - 1, z * 0.09 + 6, 2);
  const steep = smoothstep(0.82, 0.58, ny);
  // (What's needed of the shape, kept: S is shared.)
  const isle = S.isle < S.main ? S.I : null, d = S.d, loch = S.loch;
  const tern = isle === TERN, terny = tern ? -Math.cos(Math.atan2(z - TERN.z, x - TERN.x)) : 0;
  if (h < -0.3) {
    // The seabed: sand going grey-green with depth, kelp on the rock in the shallows, mud in the
    // loch's basin, the deep dark; white sand off Tern Isle's beach and in Bothy Bay.
    const depth = -h;
    c.copy(NC.bed).lerp(NC.sand, smoothstep(14, 4, depth) * 0.6).lerp(NC.deep, smoothstep(18, 70, depth));
    if (tern && terny < -0.2) c.lerp(NC.wetShell, smoothstep(-0.2, -0.7, terny) * smoothstep(14, 3, depth) * 0.8);
    const sandy = Math.max(inSound(x, z) * smoothstep(8, 14, depth), tern ? smoothstep(-0.2, -0.6, terny) : 0, inBothyBay(x, z) ? 1 : 0);
    const kelp = (1 - sandy) * smoothstep(110, 40, Math.max(0, d)) * smoothstep(0.6, 2, depth) * (1 - smoothstep(13, 18, depth)) * clamp(0.6 + n2, 0, 1);
    c.lerp(NC.kelp, kelp * 0.85);
    if (loch < 0) c.lerp(NC.mud, smoothstep(20, 45, depth) * 0.8);
    c.lerp(NC.rock, steep * 0.7);
    c.multiplyScalar(0.95 + r * 0.1);
    return;
  }
  // The shore: white shell sand on Tern Isle's east; shingle and rock elsewhere, wet below the tide.
  const shore = smoothstep(2.4, 0.8, h);
  if (tern) {
    // Tern Isle: machair (short green turf over sand), white sand on its beach side.
    c.copy(NC.machair).lerp(NC.grass, clamp(0.4 + n, 0, 1) * 0.5);
    const beach = smoothstep(-0.1, -0.6, terny);
    c.lerp(h < 0.7 ? NC.wetShell : NC.shellSand, Math.max(shore, beach * smoothstep(5, 1.5, h)));
    c.multiplyScalar(0.96 + r * 0.08);
    return;
  }
  // The fells (and Raven Isle): grass low down, heather and bracken higher, scree high, crags on the
  // steep, grey cliffs on the weather side.
  if (h > 150) c.copy(NC.heather).lerp(NC.bracken, clamp(0.5 + n * 1.3, 0, 1) * 0.6).lerp(NC.scree, smoothstep(200, 280, h) * 0.6);
  else c.copy(NC.grass).lerp(NC.grassDark, clamp(0.5 + n * 1.2, 0, 1)).lerp(NC.heather, smoothstep(40, 140, h) * clamp(0.5 + n2, 0, 1) * 0.7).lerp(NC.bracken, clamp(n2 * 1.4 - 0.2, 0, 0.5) * smoothstep(20, 80, h));
  c.lerp(isle === RAVEN || d > -400 ? NC.cliff : NC.crag, steep * 0.9);
  c.lerp(h < 0.6 ? NC.wetShingle : NC.shingle, shore * (1 - steep * 0.5));
  c.multiplyScalar(0.96 + r * 0.08);
}

/* ---------------- what stands on it ---------------- */

// The scatter, area by area (each its own meshes, so an area out of view is left out): boulders
// along the shores and on the scree, heather on the slopes, rowans in Loch Skarn's sheltered
// glens, marram on Tern Isle's dunes.
export const NORTH_AREAS = [
  { id: 'raven', x0: -3780, x1: -2480, z0: -7180, z1: -5600, n: 9000 },
  { id: 'tern', x0: -4180, x1: -3340, z0: -5600, z1: -4920, n: 4000 },
  { id: 'loch', x0: -2300, x1: -600, z0: -6150, z1: -5200, n: 9000 },
  { id: 'sound', x0: -2700, x1: -2000, z0: -7300, z1: -5200, n: 4000 },
];
function instanced(geo, list, material, rnd, { tint = 0.12, tilt = 0, shadows = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.count = list.length;
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set((rnd() - 0.5) * tilt, t.r || 0, (rnd() - 0.5) * tilt);
    o.scale.set(t.s, t.sy ?? t.s, t.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    const v = 1 - tint + rnd() * tint * 2;
    c.setRGB(v * (0.97 + rnd() * 0.06), v, v * (0.95 + rnd() * 0.08));
    m.setColorAt(i, c);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadows;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}
const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
function heatherGeometry(rnd) {
  return mergeParts([
    { geo: new THREE.IcosahedronGeometry(0.55, 0), matrix: mat(0, 0.18, 0, 0, 0, 0, 1.2, 0.5, 1.1), color: '#6a5560', jitter: 0.1 },
    { geo: new THREE.IcosahedronGeometry(0.4, 0), matrix: mat(0.35, 0.16, 0.2, 0, 0, 0, 1, 0.55, 1), color: '#7c6170', jitter: 0.1 },
    { geo: new THREE.IcosahedronGeometry(0.35, 0), matrix: mat(-0.3, 0.14, -0.15, 0, 0, 0, 1, 0.5, 1), color: '#5d6a3a', jitter: 0.1 },
  ], rnd);
}
function rowanGeometry(rnd) {
  return mergeParts([
    { geo: new THREE.CylinderGeometry(0.1, 0.17, 2.6, 5), matrix: mat(0, 1.3, 0, 0.05, 0, 0.04), color: '#6f6658' },
    { geo: new THREE.IcosahedronGeometry(1.25, 0), matrix: mat(0.1, 3.0, 0, 0, 0, 0, 1, 0.85, 1), color: '#5f7a3a', jitter: 0.1 },
    { geo: new THREE.IcosahedronGeometry(0.85, 0), matrix: mat(-0.55, 2.55, 0.35), color: '#6d863f', jitter: 0.1 },
    { geo: new THREE.IcosahedronGeometry(0.75, 0), matrix: mat(0.6, 2.4, -0.3), color: '#55702f', jitter: 0.1 },
  ], rnd);
}
function marramGeometry(rnd) {
  const parts = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * 6.28, r = rnd() * 0.25;
    parts.push({ geo: new THREE.ConeGeometry(0.035, 0.7 + rnd() * 0.4, 3), matrix: mat(Math.cos(a) * r, 0.35, Math.sin(a) * r, (rnd() - 0.5) * 0.6, 0, (rnd() - 0.5) * 0.6), color: '#b8b07a' });
  }
  return mergeParts(parts, rnd);
}

// The north's things (built the first time you come near: see world.js buildNorth), all at once…
export function buildNorth(scene, rnd) {
  const g = northSteps(scene, rnd);
  let r;
  while (!(r = g.next()).done);
  return r.value;
}
// …or a slice at a time (a generator: each yield a slice; its value at the end, the north's things).
export function* northSteps(scene, rnd) {
  const group = new THREE.Group();
  group.name = 'north';
  const obstacles = [], spots = [], boxes = [];
  const slope = (x, z) => Math.abs(heightAt(x + 1.5, z) - heightAt(x - 1.5, z)) + Math.abs(heightAt(x, z + 1.5) - heightAt(x, z - 1.5));
  const boulderGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.4, rnd), color: '#5d5b55', jitter: 0.08 }], rnd);
  const geos = { heather: heatherGeometry(rnd), rowan: rowanGeometry(rnd), marram: marramGeometry(rnd) };
  const rockMat = withCaustics(plain()), plantMat = plain();
  for (const A of NORTH_AREAS) {
    const boulders = [], heather = [], rowans = [], marram = [];
    for (let i = 0; i < A.n; i++) {
      if (i % 300 === 299) yield;
      const x = A.x0 + rnd() * (A.x1 - A.x0), z = A.z0 + rnd() * (A.z1 - A.z0);
      const h = heightAt(x, z), S = northAt(x, z), d = S.d, tern = S.isle < S.main && S.I === TERN, loch = S.loch;
      if (h < -4 || h > 260) continue;
      const sl = slope(x, z);
      // Boulders along every shore, on the scree high up and at the foot of the cliffs.
      if ((d > -14 && d < 4 && boulders.length < 900 && !tern) || (sl > 2.2 && sl < 4.5 && h > 60 && rnd() < 0.25)) {
        if (d > -14 && d < 4 && rnd() < 0.5) {
          const s = 0.5 + rnd() * 1.6;
          boulders.push({ x, y: h - s * 0.35, z, s, r: rnd() * 6.28 });
        } else if (h > 60) boulders.push({ x, y: h - 0.4, z, s: 0.6 + rnd() * 1.1, r: rnd() * 6.28 });
        continue;
      }
      if (h < 1.5 || sl > 2.4) continue;
      if (tern) {
        // Marram on the dunes behind the beach, the machair beyond it bare turf.
        if (h < 6 && rnd() < 0.5 && marram.length < 1400) marram.push({ x, y: h - 0.05, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28 });
        continue;
      }
      // Rowans in the loch's glens, low down out of the wind; heather everywhere else that's not too
      // steep or high.
      const glen = loch < 260 && h < 70 && h > 3;
      if (glen && rnd() < 0.28 && rowans.length < 240) {
        const s = 0.8 + rnd() * 0.5;
        rowans.push({ x, y: h - 0.1, z, s, r: rnd() * 6.28 });
        obstacles.push({ x, z, r: 0.3 * s, kind: 'tree', name: 'a rowan' });
      } else if (h < 220 && rnd() < 0.6 && heather.length < 2600) heather.push({ x, y: h - 0.08, z, s: 0.7 + rnd() * 0.8, sy: 0.6 + rnd() * 0.6, r: rnd() * 6.28 });
    }
    group.add(instanced(boulderGeo, boulders, rockMat, rnd, { tint: 0.18, tilt: 0.8 }));
    group.add(instanced(geos.heather, heather, plantMat, rnd, { tint: 0.15, shadows: false }));
    if (rowans.length) group.add(instanced(geos.rowan, rowans, plantMat, rnd, { tint: 0.12 }));
    if (marram.length) group.add(instanced(geos.marram, marram, plantMat, rnd, { tint: 0.1, shadows: false }));
  }
  scene.add(group);
  return {
    group, obstacles, spots, boxes,
    setQuality() {},
    update() {},
  };
}
