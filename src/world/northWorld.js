import * as THREE from 'three';
import { clamp, smoothstep, fbm, mergeParts, mat, jitterGeo } from '../util.js';
import { northAt, heightAt } from './terrain.js';
import { withCaustics } from './caustics.js';
import { TERN, RAVEN, inSound, inBothyBay, lochAt, HALVIG_PIER, HALVIG_FUEL, HALVIG_SHOP, CROFTS, PHONE_BOX, RAVEN_LIGHT, BROCH, STONES, NORTH_BOTHY, HERRING, SEAL_CAVE, SULA, NORTH_DOORS } from './north.js';
import { fuelPumpParts } from '../props.js';
import { $t } from '../i18n.js';

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
        obstacles.push({ x, z, r: 0.3 * s, kind: 'tree', name: $t('a rowan') });
      } else if (h < 220 && rnd() < 0.6 && heather.length < 2600) heather.push({ x, y: h - 0.08, z, s: 0.7 + rnd() * 0.8, sy: 0.6 + rnd() * 0.6, r: rnd() * 6.28 });
    }
    group.add(instanced(boulderGeo, boulders, rockMat, rnd, { tint: 0.18, tilt: 0.8 }));
    group.add(instanced(geos.heather, heather, plantMat, rnd, { tint: 0.15, shadows: false }));
    if (rowans.length) group.add(instanced(geos.rowan, rowans, plantMat, rnd, { tint: 0.12 }));
    if (marram.length) group.add(instanced(geos.marram, marram, plantMat, rnd, { tint: 0.1, shadows: false }));
  }
  const P = buildPlaces(group, obstacles, rnd);
  // (The doors you can go in at: Halvig Stores and the Loch Bothy. See main.js.)
  spots.push({ kind: 'halvigstores', name: $t('Halvig Stores'), x: NORTH_DOORS.shop.x, z: NORTH_DOORS.shop.z, r: 2 });
  spots.push({ kind: 'lochbothy', name: $t('the Loch Bothy'), x: NORTH_DOORS.bothy.x, z: NORTH_DOORS.bothy.z, r: 2.2 });
  scene.add(group);
  return {
    group, obstacles, spots, boxes,
    setQuality() {},
    update(dt, t, env) {
      const night = clamp((env.lantern ?? env.night ?? 0) * 1.2, 0, 1);
      // Raven Head: three flashes every fifteen seconds after dark (a glimmer of the lamp by day).
      const ph = t % 15, on = ph < 0.35 || (ph > 1.2 && ph < 1.55) || (ph > 2.4 && ph < 2.75);
      P.lamp.material.opacity = on ? 0.25 + 0.75 * night : 0.12 + 0.1 * night;
      P.windows.material.emissiveIntensity = 0.9 * night;
    },
  };
}

/* ---------------- Halvig, the light, and the things to find (N3) ---------------- */

// A matrix placing a part in a frame at (x, y, z) turned by yaw (local +z along the yaw).
function placed(x, y, z, yaw, lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  return mat(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, rx, yaw + ry, rz, sx, sy, sz);
}
// A gable roof (a triangular prism) over a w × d box, eaves at 0, ridge along local x.
function gable(w, d, rise) {
  const hw = w / 2 + 0.3, hd = d / 2 + 0.35;
  const g = new THREE.BufferGeometry();
  const Pt = [[-hw, 0, -hd], [hw, 0, -hd], [hw, rise, 0], [-hw, rise, 0], [-hw, rise, 0], [hw, rise, 0], [hw, 0, hd], [-hw, 0, hd]];
  const v = [];
  const quad = (a, b, c, d) => v.push(...Pt[a], ...Pt[b], ...Pt[c], ...Pt[a], ...Pt[c], ...Pt[d]);
  quad(0, 3, 2, 1);
  quad(4, 7, 6, 5);
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function gableEnds(w, d, rise) {
  const hw = w / 2, hd = d / 2;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([-hw, 0, -hd, -hw, 0, hd, -hw, rise, 0, hw, 0, hd, hw, 0, -hd, hw, rise, 0], 3));
  g.computeVertexNormals();
  return g;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);

// A croft house (and the shop, a croft with a bigger window and a board over its door): white
// harled walls, a slate roof, a chimney at each gable, a door and windows on its front.
function cottage(walls, roofs, glass, B, ground, rnd, { shop = false, wall = '#ece8de' } = {}) {
  const { x, z, yaw, w, d } = B, y = ground(x, z), H = 3.1, rise = 2.3;
  walls.push({ geo: box(w, H + 0.3, d), matrix: placed(x, y - 0.3, z, yaw, 0, H / 2, 0), color: wall });
  walls.push({ geo: gableEnds(w, d, rise), matrix: placed(x, y + H, z, yaw, 0, 0, 0), color: wall });
  roofs.push({ geo: gable(w, d, rise), matrix: placed(x, y + H, z, yaw, 0, 0, 0), color: '#4a4f56' });
  for (const sx of [-1, 1]) roofs.push({ geo: box(0.8, 1.4, 0.7), matrix: placed(x, y + H + rise - 0.3, z, yaw, sx * (w / 2 - 0.35), 0.6, 0), color: '#d9d4c8' });
  // (The front faces +z in its own frame.)
  walls.push({ geo: box(0.95, 2, 0.12), matrix: placed(x, y, z, yaw, shop ? -1.2 : 0, 1, d / 2 + 0.03), color: shop ? '#2f5d4c' : pickOf(['#7a2e2a', '#2f4f6a', '#3d5a3a'], rnd) });
  for (const lx of shop ? [1.6, -3.1] : [-w / 2 + 1.3, w / 2 - 1.3]) glass.push({ geo: box(shop && lx > 0 ? 2.2 : 0.95, 1.05, 0.1), matrix: placed(x, y, z, yaw, lx, 1.7, d / 2 + 0.03), color: '#8fa3ad' });
  if (shop) walls.push({ geo: box(3.6, 0.55, 0.1), matrix: placed(x, y, z, yaw, -0.2, 2.75, d / 2 + 0.06), color: '#2f5d4c' });
}
const pickOf = (list, rnd) => list[Math.floor(rnd() * list.length)];

export function buildPlaces(group, obstacles, rnd) {
  const ground = (x, z) => heightAt(x, z);
  const stone = [], white = [], roofs = [], glass = [], iron = [], wood = [], dark = [];
  // Halvig's pier: dressed stone from the bottom up, its deck a little lighter, bollards along it.
  {
    const Q = HALVIG_PIER, cx = (Q.x0 + Q.x1) / 2, cz = (Q.z0 + Q.z1) / 2, L = Q.x1 - Q.x0, W = Q.z1 - Q.z0;
    stone.push({ geo: box(L, Q.deck + 13, W), matrix: mat(cx, Q.deck - (Q.deck + 13) / 2, cz), color: '#7d7a72' });
    stone.push({ geo: box(L + 0.1, 0.25, W + 0.1), matrix: mat(cx, Q.deck - 0.1, cz), color: '#99958b' });
    for (let u = 4; u < L; u += 8) {
      for (const side of [Q.z0 + 0.5, Q.z1 - 0.5]) {
        dark.push({ geo: new THREE.CylinderGeometry(0.2, 0.24, 0.6, 8), matrix: mat(Q.x0 + u, Q.deck + 0.3, side), color: '#25272a' });
        obstacles.push({ x: Q.x0 + u, z: side, r: 0.25, top: Q.deck + 0.6 });
      }
    }
    // An iron ladder down its head.
    for (const dz of [-0.35, 0.35]) iron.push({ geo: box(0.06, 4, 0.06), matrix: mat(Q.x1 + 0.05, Q.deck - 2, cz + dz), color: '#3a3d42' });
  }
  // The pump at the pier's root, and the shop, the crofts and the phone box on the shelf.
  const F = HALVIG_FUEL;
  dark.push(...fuelPumpParts(F.x, ground(F.x, F.z), F.z, F.yaw));
  obstacles.push({ x: F.x, z: F.z, r: 0.42, kind: 'harbour', name: $t('the fuel pump') });
  cottage(white, roofs, glass, HALVIG_SHOP, ground, rnd, { shop: true });
  for (const C of CROFTS) cottage(white, roofs, glass, C, ground, rnd, { wall: pickOf(['#ece8de', '#e4dfd2', '#efece4'], rnd) });
  for (const B of [HALVIG_SHOP, ...CROFTS]) {
    const c = Math.cos(B.yaw), sn = Math.sin(B.yaw);
    for (const u of [-B.w / 4, B.w / 4]) obstacles.push({ x: B.x + u * c, z: B.z - u * sn, r: Math.max(B.w / 4, B.d / 2) + 0.2, kind: 'building', name: B === HALVIG_SHOP ? $t('Halvig Stores') : 'a croft' });
  }
  {
    const B = PHONE_BOX, y = ground(B.x, B.z);
    white.push({ geo: box(0.95, 2.45, 0.95), matrix: placed(B.x, y, B.z, B.yaw, 0, 1.22, 0), color: '#b8231f' });
    white.push({ geo: box(1.05, 0.25, 1.05), matrix: placed(B.x, y, B.z, B.yaw, 0, 2.55, 0), color: '#a51f1b' });
    glass.push({ geo: box(0.7, 1.4, 0.98), matrix: placed(B.x, y, B.z, B.yaw, 0, 1.35, 0), color: '#c9d6d8' });
    obstacles.push({ x: B.x, z: B.z, r: 0.6, kind: 'building', name: $t('the phone box') });
  }
  // The light on Raven Head: a white tower, its gallery and lantern, and the lamp (flashing: see
  // update).
  let lamp;
  {
    const { x, z } = RAVEN_LIGHT, y = ground(x, z);
    white.push({ geo: new THREE.CylinderGeometry(1.7, 2.2, 11, 16), matrix: mat(x, y + 5.5, z), color: '#f2efe8' });
    dark.push({ geo: new THREE.CylinderGeometry(2.4, 2.4, 0.3, 16), matrix: mat(x, y + 11.1, z), color: '#2a2c2f' });
    glass.push({ geo: new THREE.CylinderGeometry(1.3, 1.3, 1.8, 12), matrix: mat(x, y + 12.2, z), color: '#e8e2c4' });
    dark.push({ geo: new THREE.ConeGeometry(1.5, 1.2, 12), matrix: mat(x, y + 13.7, z), color: '#2a2c2f' });
    white.push({ geo: box(5, 3, 4), matrix: mat(x - 5.5, y + 1.5, z + 2), color: '#ece8de' });
    roofs.push({ geo: gable(5, 4, 1.4), matrix: mat(x - 5.5, y + 3, z + 2), color: '#4a4f56' });
    lamp = new THREE.Mesh(new THREE.SphereGeometry(0.75, 12, 10), new THREE.MeshBasicMaterial({ color: '#fff4d6', transparent: true, opacity: 0.2 }));
    lamp.position.set(x, y + 12.2, z);
    group.add(lamp);
    obstacles.push({ x, z, r: 2.4, kind: 'building', name: $t('the lighthouse') }, { x: x - 5.5, z: z + 2, r: 2.6, kind: 'building', name: $t('the keeper’s store') });
  }
  // The broch: a ring of dry stone, its double wall broken off at different heights, a doorway
  // on its seaward side.
  {
    const { x, z, r } = BROCH, y = ground(x, z), N = 26;
    for (let i = 0; i < N; i++) {
      const a = (i / N) * Math.PI * 2, door = Math.abs(Math.atan2(Math.sin(a - 0.4), Math.cos(a - 0.4))) < 0.15;
      const h = door ? 0 : 3.2 + 3.4 * (0.5 + 0.5 * fbm(i * 0.4, 7.7, 2)) - (i % 7 === 3 ? 1.6 : 0);
      if (h > 0) stone.push({ geo: box(2.25, h, 3), matrix: mat(x + Math.cos(a) * (r - 1.5), y + h / 2 - 0.3, z + Math.sin(a) * (r - 1.5), 0, -a + Math.PI / 2, 0), color: pickOf(['#8a8376', '#7f7a6e', '#948d80'], rnd), jitter: 0.06 });
      if (h > 0) obstacles.push({ x: x + Math.cos(a) * (r - 1.5), z: z + Math.sin(a) * (r - 1.5), r: 1.4, kind: 'building', name: $t('the broch') });
    }
    // Tumbled stone round its foot.
    for (let i = 0; i < 26; i++) {
      const a = rnd() * 6.28, d = r + 0.5 + rnd() * 3;
      stone.push({ geo: box(0.6 + rnd() * 0.6, 0.4, 0.5 + rnd() * 0.5), matrix: mat(x + Math.cos(a) * d, ground(x + Math.cos(a) * d, z + Math.sin(a) * d) + 0.1, z + Math.sin(a) * d, rnd() * 0.4, rnd() * 6, 0), color: '#857e72' });
    }
  }
  // The standing stones.
  {
    const { x, z, r, n } = STONES;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + rnd() * 0.2, sx = x + Math.cos(a) * r, sz = z + Math.sin(a) * r, h = 2.6 + rnd() * 1.6;
      stone.push({ geo: box(1.1 + rnd() * 0.4, h, 0.45 + rnd() * 0.2), matrix: mat(sx, ground(sx, sz) + h / 2 - 0.3, sz, (rnd() - 0.5) * 0.12, -a, (rnd() - 0.5) * 0.12), color: pickOf(['#8e8c86', '#7d7b75', '#9a978f'], rnd), jitter: 0.08 });
      obstacles.push({ x: sx, z: sz, r: 0.7, kind: 'stone', name: $t('a standing stone') });
    }
  }
  // The bothy above Bothy Bay: rough stone, a slate roof, a door and a little window.
  {
    const { x, z, yaw } = NORTH_BOTHY, y = ground(x, z), w = 6, d = 4.2;
    stone.push({ geo: box(w, 2.6, d), matrix: placed(x, y - 0.2, z, yaw, 0, 1.1, 0), color: '#86827a', jitter: 0.04 });
    stone.push({ geo: gableEnds(w, d, 1.8), matrix: placed(x, y + 2.4, z, yaw, 0, 0, 0), color: '#86827a' });
    roofs.push({ geo: gable(w, d, 1.8), matrix: placed(x, y + 2.4, z, yaw, 0, 0, 0), color: '#454a50' });
    roofs.push({ geo: box(0.7, 1.2, 0.6), matrix: placed(x, y + 3.6, z, yaw, w / 2 - 0.4, 0.3, 0), color: '#86827a' });
    // (Its front faces the bay: +z is the shore's way.)
    dark.push({ geo: box(0.9, 1.9, 0.1), matrix: placed(x, y, z, yaw, -1, 0.95, d / 2 + 0.03), color: '#2c2a27' });
    glass.push({ geo: box(0.7, 0.6, 0.1), matrix: placed(x, y, z, yaw, 1.4, 1.5, d / 2 + 0.03), color: '#8fa3ad' });
    for (const u of [-1.6, 1.6]) obstacles.push({ x: x + u * Math.cos(yaw), z: z - u * Math.sin(yaw), r: 2.2, kind: 'building', name: $t('the bothy') });
  }
  // The herring station: roofless walls of its curing sheds, and its pier's stumps running out
  // into the loch.
  {
    const { x, z, yaw } = HERRING, c = Math.cos(yaw), sn = Math.sin(yaw);
    const at = (u, v) => ({ x: x + u * c + v * sn, z: z - u * sn + v * c });
    for (const [u0, v0, w, d] of [[-9, -6, 12, 7], [5, -5, 8, 6]]) {
      for (const [a, b, len, along] of [[u0, v0, w, 'u'], [u0, v0 + d, w, 'u'], [u0, v0, d, 'v'], [u0 + w, v0, d, 'v']]) {
        for (let k = 0; k < len; k += 2) {
          if (rnd() < 0.18) continue;
          const p = along === 'u' ? at(a + k + 1, b) : at(a, b + k + 1), h = 0.8 + rnd() * 2.6;
          stone.push({ geo: box(along === 'u' ? 2 : 0.6, h, along === 'u' ? 0.6 : 2), matrix: mat(p.x, ground(p.x, p.z) + h / 2 - 0.2, p.z, 0, yaw, 0), color: '#857f74', jitter: 0.05 });
          obstacles.push({ x: p.x, z: p.z, r: 0.9, kind: 'building', name: $t('the herring station') });
        }
      }
    }
    // (The loch lies north of it: its pier ran out to -z.)
    for (let k = 0; k < 9; k++) {
      for (const v of [-1.2, 1.2]) {
        const p = { x: x + v * c + 4, z: z - 12 - k * 3 }, bed = ground(p.x, p.z), top = 0.4 + rnd() * 1.1;
        wood.push({ geo: new THREE.CylinderGeometry(0.16, 0.2, top - bed, 6), matrix: mat(p.x, (top + bed) / 2, p.z, (rnd() - 0.5) * 0.15, 0, (rnd() - 0.5) * 0.15), color: '#3d342b' });
      }
    }
  }
  // The Seal Cave: its dark mouth at the foot of the cliffs, an overhang of rock above it.
  {
    const { x, z } = SEAL_CAVE, mouth = new THREE.Mesh(new THREE.CircleGeometry(4.2, 16, 0, Math.PI), new THREE.MeshBasicMaterial({ color: '#0d0f10' }));
    mouth.position.set(x + 2.5, -0.6, z);
    mouth.rotation.y = -Math.PI / 2;
    mouth.scale.set(1.2, 1.15, 1);
    group.add(mouth);
    stone.push({ geo: jitterGeo(new THREE.DodecahedronGeometry(4, 0), 0.6, rnd), matrix: mat(x + 2, 5.6, z, 0, rnd() * 6, 0, 1.6, 0.7, 1.4), color: '#5f5e5a' });
  }
  // The Sula: a steel trawler on the bottom in the kelp, listing, her wheelhouse still on her.
  {
    const { x, z, yaw, len } = SULA, bed = ground(x, z), list = 0.26;
    const on = (u, h, v, w, H, D, color, rx = 0, rz = 0) => iron.push({ geo: box(w, H, D), matrix: placed(x, bed, z, yaw, u, h, v, rx, 0, list + rz), color });
    on(0, 1.6, 0, 6.2, 3.2, len, '#5b3426');
    on(0, 3.25, 0, 6.4, 0.2, len - 1, '#4a4038');
    on(0, 1.4, len / 2 + 2.6, 3.6, 2.8, 5.2, '#5b3426', 0.35);
    on(0.6, 5, 4, 3.4, 3.2, 4, '#7a6b5e');
    on(0.6, 6.7, 4, 3.6, 0.2, 4.4, '#4a4038');
    on(0, 5.4, -len / 2 + 2.2, 0.3, 4.5, 0.3, '#3a3a38');
    on(0, 7.4, -len / 2 + 2.2, 5, 0.3, 0.3, '#3a3a38');
    on(-1.5, 4, -6, 2.2, 1.6, 2.2, '#3f4b4a');
    for (let k = -3; k <= 3; k++) on(3.2, 1.5, k * 3.2, 0.12, 2.6, 0.5, '#6e4a36');
  }
  const lamb = (o = {}) => new THREE.MeshLambertMaterial({ vertexColors: true, ...o });
  const add = (parts, material, shadows = true) => {
    if (!parts.length) return null;
    const m = new THREE.Mesh(mergeParts(parts, rnd), material);
    m.castShadow = shadows;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  add(stone, withCaustics(lamb()));
  add(white, lamb());
  add(roofs, lamb());
  add(dark, lamb());
  add(wood, withCaustics(lamb()));
  add(iron, withCaustics(lamb()), false);
  const windows = add(glass, lamb({ emissive: new THREE.Color('#ffcf7a'), emissiveIntensity: 0 }), false);
  return { lamp, windows };
}
