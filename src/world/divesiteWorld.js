import * as THREE from 'three';
import { heightAt, WRECK } from './terrain.js';
import { waveHeight } from './water.js';
import { withCaustics } from './caustics.js';
import { fanGeometry, anemoneGeometry } from './brasaWorld.js';
import { plantMaterial, bladeClump } from './underwater.js';
import { DIVE_SITES, siteById, PINNACLES, ROCKS, pinnacleRadius, crownAt } from './divesites.js';
import { mergeParts, mat, jitterGeo, pick, fbm, clamp, lerp, smoothstep } from '../util.js';

// What the dive sites look like (where they are and what's solid: divesites.js). All of it from
// simple shapes, with a seed of its own, so building it moves nothing else:
//  · the yellow buoys over them;
//  · Skerries Reef's boulders and arch, kelp on their tops, jewel and dahlia anemones, urchins and
//    starfish on them, red weed between;
//  · the Kelp Forest's tall kelp, the boulder in its clearing and the lost pot against it;
//  · the Kittiwake's growth: plumose anemones and dead man's fingers on her boiler and posts,
//    jewel anemones, and a lobster in the mouth of her boiler;
//  · Anchor Sands' ripples, the old anchor and its chain, burrowing anemones and sea pens;
//  · the Hound and its Pup: rock towers grown over, pink sea fans standing off the walls, jewel
//    anemones in sheets, dead man's fingers and plumose anemones on the ledges, kelp on the top.

const UP = new THREE.Vector3(0, 1, 0);
const _o = new THREE.Object3D(), _n = new THREE.Vector3(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _c = new THREE.Color();
const plain = () => withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true }));
const soft = () => withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));

// Lay copies of a shape: each { x, y, z, s, nx, ny, nz (which way is up for it), spin, color }.
function lay(geo, material, list, rnd, { tint = 0.1, sx = 1, sy = 1 } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.count = list.length;
  list.forEach((t, i) => {
    _n.set(t.nx ?? 0, t.ny ?? 1, t.nz ?? 0).normalize();
    _q.setFromUnitVectors(UP, _n);
    _q2.setFromAxisAngle(UP, t.spin ?? rnd() * Math.PI * 2);
    _o.quaternion.copy(_q).multiply(_q2);
    _o.position.set(t.x, t.y, t.z);
    _o.scale.set(t.s * (t.sx ?? sx), t.s * (t.sy ?? sy), t.s * (t.sx ?? sx));
    _o.updateMatrix();
    m.setMatrixAt(i, _o.matrix);
    _c.set(t.color || '#ffffff');
    const v = 1 - tint + rnd() * tint * 2;
    _c.multiplyScalar(v);
    m.setColorAt(i, _c);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.computeBoundingSphere();
  m.userData.total = list.length;
  return m;
}

/* ---------------- the shapes ---------------- */

// Jewel anemones: a patch of tiny bright anemones packed together, a hand's breadth across.
export function jewelGeometry(rnd) {
  const parts = [{ geo: new THREE.CircleGeometry(0.17, 8).rotateX(-Math.PI / 2), matrix: mat(0, 0.005, 0), color: '#d8d0c8' }];
  for (let i = 0; i < 12; i++) {
    const a = rnd() * Math.PI * 2, r = Math.sqrt(rnd()) * 0.15;
    parts.push({ geo: new THREE.OctahedronGeometry(0.034, 0), matrix: mat(Math.cos(a) * r, 0.02, Math.sin(a) * r, 0, rnd() * 3, 0, 1, 0.7, 1), color: '#ffffff' });
  }
  return mergeParts(parts, rnd);
}
// Dead man's fingers: a soft coral, a fist of fat lobes.
function fingersGeometry(rnd) {
  const parts = [{ geo: new THREE.SphereGeometry(0.07, 6, 4), matrix: mat(0, 0.03, 0, 0, 0, 0, 1.3, 0.6, 1.3), color: '#ffffff' }];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + rnd(), lean = 0.25 + rnd() * 0.35, h = 0.14 + rnd() * 0.12;
    const x = Math.cos(a) * 0.04, z = Math.sin(a) * 0.04;
    const m = mat(x + Math.cos(a) * h * 0.5 * lean, h / 2, z + Math.sin(a) * h * 0.5 * lean, Math.sin(a) * lean, 0, -Math.cos(a) * lean);
    parts.push({ geo: new THREE.CapsuleGeometry(0.035, h, 2, 6), matrix: m, color: '#ffffff' });
  }
  return mergeParts(parts, rnd);
}
// A plumose anemone: a tall pale column with a fluffy crown.
function plumoseGeometry(rnd) {
  return mergeParts([
    { geo: new THREE.CylinderGeometry(0.06, 0.08, 0.3, 8), matrix: mat(0, 0.15, 0), color: '#f4efe8' },
    { geo: jitterGeo(new THREE.SphereGeometry(0.13, 9, 6), 0.05, rnd), matrix: mat(0, 0.36, 0, 0, 0, 0, 1, 0.75, 1), color: '#ffffff' },
  ], rnd);
}
// An edible sea urchin: a round test with short spines, pink to purple.
export function urchinGeometry(rnd) {
  return mergeParts([{ geo: jitterGeo(new THREE.IcosahedronGeometry(0.12, 2), 0.03, rnd), matrix: mat(0, 0.09, 0, 0, 0, 0, 1, 0.85, 1), color: '#ffffff', jitter: 0.1 }], rnd);
}
// A starfish: five arms, flat on the rock or the sand.
export function starGeometry() {
  const shape = new THREE.Shape();
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.045 : 0.16;
    if (i === 0) shape.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else shape.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return mergeParts([{ geo: g, color: '#ffffff' }]);
}
// A boring sponge: a lumpy yellow cushion.
export function spongeBlob(rnd) {
  return mergeParts([{ geo: jitterGeo(new THREE.IcosahedronGeometry(0.16, 1), 0.07, rnd), matrix: mat(0, 0.04, 0, 0, 0, 0, 1.4, 0.45, 1.1), color: '#ffffff' }], rnd);
}
// A kelp plant (Laminaria): a stiff stalk and, from its top, a broad blade split into long
// fingers that stream away down the current (along +x), drooping at their ends. One unit tall at
// most; it sways (plantMaterial). Laid with the current's heading, so a forest streams together.
function kelpGeometry(rnd) {
  const pos = [], col = [];
  const stalk = new THREE.Color('#4e4020'), blade = new THREE.Color('#6a5826'), tip = new THREE.Color('#9a8240');
  const quad = (a, b, c, d, ca, cb) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d);
    for (const k of [ca, ca, cb, ca, cb, ca]) col.push(k.r, k.g, k.b);
  };
  // The stalk: a square tube, thick at the holdfast, leaning a little down the current.
  const H = 0.55, lean = 0.04 + rnd() * 0.06;
  for (let j = 0; j < 4; j++) {
    const a0 = (j / 4) * Math.PI * 2 + 0.4, a1 = ((j + 1) / 4) * Math.PI * 2 + 0.4, w0 = 0.032, w1 = 0.018;
    const p = (a, w, y) => [Math.cos(a) * w + lean * y, y, Math.sin(a) * w];
    quad(p(a0, w0, 0), p(a1, w0, 0), p(a1, w1, H), p(a0, w1, H), stalk, stalk);
  }
  // The blade: its fingers fanning a little either side of the stream, each a long strap.
  const n = 4 + Math.floor(rnd() * 3), head = [lean * H, H, 0];
  for (let i = 0; i < n; i++) {
    const a = (i / (n - 1) - 0.5) * 0.9 + (rnd() - 0.5) * 0.2, len = 0.42 + rnd() * 0.18, w = 0.05 + rnd() * 0.025;
    const lift = 0.05 + rnd() * 0.08, ca = Math.cos(a), sa = Math.sin(a);
    let prev = null;
    for (let k = 0; k <= 5; k++) {
      const t = k / 5, r = t * len, y = head[1] + Math.sin(t * Math.PI * 0.6) * lift - t * t * 0.22;
      const cx = head[0] + ca * r, cz = head[2] + sa * r, ww = w * (0.55 + 0.45 * Math.sin(Math.min(1, t * 1.6 + 0.1) * Math.PI * 0.5)) * (1 - t * 0.35);
      // (Each finger twisted a little along its length, so the light catches it.)
      const tw = (i % 2 ? 1 : -1) * t * 0.5, px = -sa * Math.cos(tw), pz = ca * Math.cos(tw), py = Math.sin(tw);
      const L = [cx - px * ww, y - py * ww, cz - pz * ww], R = [cx + px * ww, y + py * ww, cz + pz * ww];
      if (prev) quad(prev.L, prev.R, R, L, blade.clone().lerp(tip, t - 0.2), blade.clone().lerp(tip, t));
      prev = { L, R };
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  return g;
}
// A European lobster: dark blue, its big claws held out in front, long red antennae.
function lobsterGeometry() {
  const blue = '#1f2c4a', dark = '#18223a', red = '#9a4a3a';
  const parts = [
    { geo: new THREE.CapsuleGeometry(0.06, 0.16, 4, 8), matrix: mat(0, 0.07, 0.04, Math.PI / 2, 0, 0), color: blue },
    { geo: new THREE.CylinderGeometry(0.05, 0.035, 0.2, 7), matrix: mat(0, 0.06, -0.15, Math.PI / 2, 0, 0), color: dark },
    { geo: new THREE.BoxGeometry(0.12, 0.015, 0.06), matrix: mat(0, 0.05, -0.27), color: dark },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.015, 0.015, 0.14, 5), matrix: mat(s * 0.07, 0.06, 0.17, Math.PI / 2, 0, s * 0.5), color: blue });
    parts.push({ geo: new THREE.CapsuleGeometry(0.04, 0.12, 3, 7), matrix: mat(s * 0.1, 0.06, 0.3, Math.PI / 2, 0, s * 0.25), color: blue });
    parts.push({ geo: new THREE.CylinderGeometry(0.004, 0.006, 0.42, 4), matrix: mat(s * 0.05, 0.1, 0.33, Math.PI / 2 - 0.15, 0, s * 0.35), color: red });
    for (let k = 0; k < 3; k++) parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.008, 0.12, 4), matrix: mat(s * 0.07, 0.03, 0.02 - k * 0.05, 0, 0, s * 1.1), color: dark });
  }
  return mergeParts(parts);
}
// A lobster pot, lost: a slatted base, three hoops and the ropes, gone green.
function potGeometry() {
  const frame = '#3b3a2f', rope = '#9a9068';
  const parts = [{ geo: new THREE.BoxGeometry(0.62, 0.04, 0.9), matrix: mat(0, 0.02, 0), color: '#4a4232' }];
  for (const z of [-0.38, 0, 0.38]) parts.push({ geo: new THREE.TorusGeometry(0.3, 0.015, 5, 14, Math.PI), matrix: mat(0, 0.03, z), color: frame });
  for (const x of [-0.21, 0, 0.21]) parts.push({ geo: new THREE.CylinderGeometry(0.008, 0.008, 0.8, 4), matrix: mat(x, 0.03 + Math.sqrt(0.09 - x * x), 0, Math.PI / 2, 0, 0), color: frame });
  parts.push({ geo: new THREE.TorusGeometry(0.09, 0.012, 4, 10), matrix: mat(0, 0.18, 0.4), color: rope });
  for (let k = 0; k < 3; k++) parts.push({ geo: new THREE.TorusGeometry(0.22 - k * 0.04, 0.012, 4, 14), matrix: mat(0.55, 0.012 + k * 0.022, 0.1, -Math.PI / 2, 0, 0), color: rope });
  return mergeParts(parts);
}
// An Admiralty anchor lying on the sand: the shank along x, its ring at +x with the stock across
// it, the crown at -x with one arm up and its fluke in the air, the other down in the sand.
function anchorGeometry() {
  const iron = '#5e4433', stock = '#3f3328';
  const parts = [
    { geo: new THREE.CylinderGeometry(0.1, 0.13, 3.2, 8), matrix: mat(0, 0, 0, 0, 0, Math.PI / 2), color: iron },
    { geo: new THREE.TorusGeometry(0.28, 0.05, 6, 14), matrix: mat(1.85, 0, 0), color: iron },
    { geo: new THREE.CylinderGeometry(0.1, 0.07, 3.4, 8), matrix: mat(1.35, 0, 0, Math.PI / 2, 0, 0), color: stock },
    { geo: new THREE.SphereGeometry(0.11, 8, 6), matrix: mat(1.35, 0, 1.72), color: stock },
    { geo: new THREE.SphereGeometry(0.11, 8, 6), matrix: mat(1.35, 0, -1.72), color: stock },
    { geo: new THREE.SphereGeometry(0.17, 8, 6), matrix: mat(-1.6, 0, 0), color: iron },
  ];
  for (const s of [-1, 1]) {
    parts.push({ geo: new THREE.CylinderGeometry(0.09, 0.11, 1.3, 7), matrix: mat(-1.25, s * 0.5, 0, 0, 0, s * 0.6), color: iron });
    parts.push({ geo: new THREE.BoxGeometry(0.42, 0.52, 0.07), matrix: mat(-0.8, s * 0.95, 0, 0, 0, s * 0.6 + Math.PI / 2), color: iron });
  }
  return mergeParts(parts);
}
// A burrowing anemone: a long tube in the sand and a wide crown of long, fine tentacles.
export function cerianthusGeometry() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.03, 0.035, 0.12, 7), matrix: mat(0, 0.06, 0), color: '#6e5a44' }];
  for (let ring = 0; ring < 2; ring++) {
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2 + ring * 0.2, c = Math.cos(a), s = Math.sin(a), tilt = ring ? 0.5 : 1.0;
      parts.push({ geo: new THREE.ConeGeometry(0.008, ring ? 0.16 : 0.26, 3), matrix: mat(c * 0.06, 0.18, s * 0.06, s * tilt, 0, -c * tilt), color: '#ffffff' });
    }
  }
  return mergeParts(parts);
}
// A sea pen: a feathery quill standing up out of the sand.
export function seaPenGeometry() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.012, 0.018, 0.4, 5), matrix: mat(0, 0.2, 0), color: '#e9c2b2' }];
  for (let k = 0; k < 9; k++) {
    for (const s of [-1, 1]) parts.push({ geo: new THREE.BoxGeometry(0.07 - k * 0.004, 0.012, 0.03), matrix: mat(s * 0.035, 0.14 + k * 0.03, 0, 0, 0, s * 0.5), color: '#ffffff' });
  }
  return mergeParts(parts);
}
// A link of chain.
function linkGeometry() {
  return mergeParts([{ geo: new THREE.TorusGeometry(0.1, 0.032, 5, 10), matrix: mat(0, 0, 0, 0, 0, 0, 1.5, 1, 1), color: '#5a3f2e' }]);
}

/* ---------------- the Hound and its Pup ---------------- */

// A rock tower: rings of the wall from just under the sand to the top, then the crown.
function pinnacleGeometry(P) {
  const NT = 72, NH = 64, NC = 4;
  const pos = [], col = [], idx = [];
  const rock = new THREE.Color('#5d5950'), pale = new THREE.Color('#7f786a'), pink = new THREE.Color('#b0808a'), dark = new THREE.Color('#2e2c29'), cream = new THREE.Color('#c9b98e');
  // Jewel anemones grow in sheets, a wall of one colour, then another.
  const SHEETS = ['#d0708f', '#6fae80', '#d08a4a', '#9a7ac0', '#e0d4c0'].map((h) => new THREE.Color(h));
  const shade = (h, a, r, x, z) => {
    const r0 = P.crown + (P.base - P.crown) * Math.pow(1 - clamp(h / P.top, 0, 1), 1.35);
    _c.copy(rock).lerp(pale, clamp(h / P.top, 0, 1) * 0.5 + fbm(x * 0.9, z * 0.9 + h, 2) * 0.25);
    // Coralline pink near the top, where the light's best; dark in the cracks; patches of sponge;
    // and the jewel anemones' sheets down the walls.
    _c.lerp(pink, smoothstep(P.top - 7, P.top - 1, h) * (0.5 + 0.5 * fbm(x * 0.4, z * 0.4 + h * 0.3, 2)));
    const js = fbm(x * 0.22 + 7, z * 0.22 + h * 0.16, 3);
    if (js > 0.18 && h < P.top - 0.5) _c.lerp(SHEETS[Math.floor((fbm(x * 0.05 + 3, z * 0.05 + h * 0.04, 2) * 0.5 + 0.5) * 9) % SHEETS.length], smoothstep(0.18, 0.4, js) * 0.65);
    _c.lerp(dark, clamp((r0 * 0.98 - r) / 1.6, 0, 0.75));
    if (fbm(x * 0.6 + 40, z * 0.6 + h * 0.5, 2) > 0.45) _c.lerp(cream, 0.45);
    return [_c.r, _c.g, _c.b];
  };
  for (let j = 0; j <= NH; j++) {
    const h = -1.5 + (j / NH) * (P.top + 1.5);
    for (let i = 0; i < NT; i++) {
      const a = (i / NT) * Math.PI * 2, r = pinnacleRadius(P, h, a);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      pos.push(x, h, z);
      col.push(...shade(h, a, r, x + P.x, z + P.z));
    }
  }
  // The crown: rings closing in to the top.
  for (let k = 1; k <= NC; k++) {
    const f = 1 - k / (NC + 1);
    for (let i = 0; i < NT; i++) {
      const a = (i / NT) * Math.PI * 2, R = pinnacleRadius(P, P.top, a), d = R * f;
      const x = Math.cos(a) * d, z = Math.sin(a) * d;
      pos.push(x, crownAt(P, d, a), z);
      col.push(...shade(P.top + 1, a, R, x + P.x, z + P.z));
    }
  }
  const rows = NH + 1 + NC;
  for (let j = 0; j < rows - 1; j++) {
    for (let i = 0; i < NT; i++) {
      const a = j * NT + i, b = j * NT + ((i + 1) % NT), c = (j + 1) * NT + i, d = (j + 1) * NT + ((i + 1) % NT);
      idx.push(a, c, b, b, c, d);
    }
  }
  const top = pos.length / 3;
  pos.push(0, crownAt(P, 0, 0), 0);
  col.push(...shade(P.top + 1, 0, P.crown, P.x, P.z));
  for (let i = 0; i < NT; i++) idx.push((rows - 1) * NT + i, top, (rows - 1) * NT + ((i + 1) % NT));
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}
// A point on a pinnacle's wall, and which way it faces: { x, y, z, nx, ny, nz }.
function onWall(P, h, a, out = 0.02) {
  const r = pinnacleRadius(P, h, a), dr = (pinnacleRadius(P, h + 0.4, a) - pinnacleRadius(P, h - 0.4, a)) / 0.8;
  const c = Math.cos(a), s = Math.sin(a);
  return { x: P.x + c * (r + out), y: P.bed + h, z: P.z + s * (r + out), nx: c, ny: -dr, nz: s };
}

/* ---------------- building it all ---------------- */

export function buildDiveSites(scene, rnd) {
  const group = new THREE.Group();
  group.name = 'divesites';
  // What grows at each site, kind by kind (each site's drawn only when you're near it).
  const KINDS = ['jewel', 'fingers', 'plumose', 'dahlia', 'urchin', 'star', 'sponge', 'kelp', 'red', 'fan', 'lobster', 'ceri', 'pen', 'link'];
  const bySite = Object.fromEntries(DIVE_SITES.map((S) => [S.id, Object.fromEntries(KINDS.map((k) => [k, []]))]));
  let L = bySite.reef;
  const JEWEL = ['#ef6fa4', '#ef6fa4', '#7fd59a', '#f2a04e', '#b98ae6', '#f4e6c8', '#e8505a'];
  const bed = (x, z) => heightAt(x, z);
  // Which way the kelp streams: a turn about the vertical, taking its blade (along local +x) the
  // way the tide sets, give or take.
  const STREAM = () => -0.25 + (rnd() - 0.5) * 0.7;
  const onRock = (o, minUp = 0.15) => {
    let nx, ny, nz;
    do {
      nx = rnd() * 2 - 1;
      ny = rnd();
      nz = rnd() * 2 - 1;
    } while (ny < minUp || Math.hypot(nx, ny, nz) > 1);
    const l = Math.hypot(nx, ny, nz);
    nx /= l;
    ny /= l;
    nz /= l;
    const R = o.r * 0.86;
    return { x: o.x + nx * R, y: o.y + ny * R, z: o.z + nz * R, nx, ny, nz };
  };
  const onBed = (S, rMin, rMax, minDepth = 1.2) => {
    for (let k = 0; k < 20; k++) {
      const a = rnd() * Math.PI * 2, d = rMin + Math.sqrt(rnd()) * (rMax - rMin);
      const x = S.x + Math.cos(a) * d, z = S.z + Math.sin(a) * d, y = bed(x, z);
      if (-y < minDepth) continue;
      return { x, y: y + 0.01, z };
    }
    return null;
  };
  const near = (S, o) => Math.hypot(o.x - S.x, o.z - S.z) < S.r + 8;

  // Rock: the boulders and the arch, as the solid spheres are (divesites.js).
  const rockGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 1), 0.28, rnd), color: '#ffffff', jitter: 0.16 }], rnd);
  const rockList = ROCKS.map((o) => ({ x: o.x, y: o.y, z: o.z, s: o.r, sx: 1.05, sy: o.lintel ? 0.8 : 0.82, color: pick(['#8d887c', '#7f7a6e', '#968e7e', '#7d8466', '#8a7f6a', '#9a8486'], rnd), nx: (rnd() - 0.5) * 0.4, ny: 1, nz: (rnd() - 0.5) * 0.4 }));
  const rocks = lay(rockGeo, plain(), rockList, rnd, { tint: 0.12 });
  rocks.castShadow = false;
  rocks.receiveShadow = true;
  group.add(rocks);

  /* Skerries Reef */
  const A = siteById.reef;
  for (const o of ROCKS) {
    if (!near(A, o)) continue;
    const n = Math.round(o.r * 5);
    for (let k = 0; k < n; k++) {
      const p = onRock(o, 0.1), r = rnd();
      if (p.ny > 0.75 && r < 0.3) L.kelp.push({ ...p, s: 0.9 + rnd() * 0.9, nx: p.nx * 0.3, nz: p.nz * 0.3, spin: STREAM() });
      else if (r < 0.55) L.jewel.push({ ...p, s: 0.8 + rnd() * 0.7, color: pick(JEWEL, rnd) });
      else if (r < 0.68) L.dahlia.push({ ...p, s: 1.2 + rnd() * 0.8, color: pick(['#c7404c', '#d8625a', '#b8364a', '#e0a07a'], rnd) });
      else if (r < 0.8) L.urchin.push({ ...p, s: 0.8 + rnd() * 0.5, color: pick(['#c46f8a', '#b45e86', '#d08a8a'], rnd) });
      else if (r < 0.88) L.star.push({ ...p, s: 0.9 + rnd() * 0.6, color: pick(['#e0782e', '#d8672e', '#a35a8a'], rnd) });
      else if (r < 0.95) L.sponge.push({ ...p, s: 0.8 + rnd() * 0.8, color: pick(['#d9b43a', '#e0a83a', '#c98a3a'], rnd) });
      else L.fingers.push({ ...p, s: 1 + rnd() * 0.6, color: pick(['#f0e6da', '#e8964a'], rnd) });
    }
  }
  for (let k = 0; k < 220; k++) {
    const p = onBed(A, 0, A.r + 4);
    if (!p) continue;
    const r = rnd();
    if (r < 0.6) L.red.push({ ...p, s: 0.35 + rnd() * 0.4, color: pick(['#ffffff', '#f0d0d0'], rnd) });
    else if (r < 0.8) L.urchin.push({ ...p, s: 0.8 + rnd() * 0.5, color: pick(['#c46f8a', '#b45e86'], rnd) });
    else L.star.push({ ...p, s: 0.9 + rnd() * 0.5, color: pick(['#e0782e', '#d8672e'], rnd) });
  }
  {
    // A lobster at the foot of the arch's western pier.
    const pier = ROCKS.find((o) => o.arch);
    const a = Math.atan2(A.z - pier.z, A.x - pier.x);
    const x = pier.x + Math.cos(a) * pier.r * 0.95, z = pier.z + Math.sin(a) * pier.r * 0.95;
    L.lobster.push({ x, y: bed(x, z) + 0.02, z, s: 1.1, spin: -a + Math.PI / 2, color: '#ffffff' });
  }

  /* The Kelp Forest */
  L = bySite.kelp;
  const K = siteById.kelp, mare = ROCKS.find((o) => o.mare);
  for (let i = 0, n = 0; i < 9000 && n < 2300; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * (K.r + 6);
    const x = K.x + Math.cos(a) * d, z = K.z + Math.sin(a) * d * 1.35, y = bed(x, z);
    if (-y < 2.6 || -y > 12) continue;
    if (Math.hypot(x - mare.x, z - mare.z) < 6.5) continue; // (the clearing)
    L.kelp.push({ x, y: y - 0.05, z, s: Math.min(1.8 + rnd() * 1.4, -y * 0.5), nx: (rnd() - 0.5) * 0.15, nz: (rnd() - 0.5) * 0.15, spin: STREAM() });
    n++;
    if (rnd() < 0.5) L.red.push({ x: x + (rnd() - 0.5) * 1.5, y: y + 0.01, z: z + (rnd() - 0.5) * 1.5, s: 0.35 + rnd() * 0.35, color: '#ffffff' });
    if (rnd() < 0.05) L.urchin.push({ x: x + 0.4, y: y + 0.01, z, s: 0.8 + rnd() * 0.4, color: '#c46f8a' });
    if (rnd() < 0.03) L.star.push({ x: x - 0.4, y: y + 0.01, z, s: 1, color: '#e0782e' });
  }
  for (const o of ROCKS) {
    if (!near(K, o)) continue;
    for (let k = 0; k < Math.round(o.r * 4); k++) {
      const p = onRock(o, 0.2), r = rnd();
      if (r < 0.4) L.jewel.push({ ...p, s: 0.8 + rnd() * 0.6, color: pick(JEWEL, rnd) });
      else if (r < 0.6) L.dahlia.push({ ...p, s: 1.2 + rnd() * 0.7, color: pick(['#c7404c', '#d8625a'], rnd) });
      else if (r < 0.8) L.urchin.push({ ...p, s: 0.8 + rnd() * 0.5, color: '#c46f8a' });
      else L.star.push({ ...p, s: 0.9 + rnd() * 0.5, color: '#e0782e' });
    }
  }
  const pot = new THREE.Mesh(potGeometry(), plain());
  {
    const a = 2.2, x = mare.x + Math.cos(a) * (mare.r + 0.5), z = mare.z + Math.sin(a) * (mare.r + 0.5);
    pot.position.set(x, bed(x, z) + 0.02, z);
    pot.rotation.set(0.12, -a, 0.05);
    group.add(pot);
  }

  /* The Kittiwake */
  L = bySite.wreck;
  {
    const W = WRECK, by = bed(W.x, W.z), c = Math.cos(W.yaw), s = Math.sin(W.yaw);
    const at = (lx, ly, lz) => ({ x: W.x + lx * c + lz * s, y: by + ly, z: W.z - lx * s + lz * c });
    // The boiler: a drum a metre round lying along her, from 1.3 to 3.7 m aft of her middle.
    for (let k = 0; k < 46; k++) {
      const u = -3.6 + rnd() * 2.2, th = (rnd() - 0.5) * Math.PI * 1.3;
      const lx = 0.2 + Math.sin(th) * 1.0, ly = 1.0 + Math.cos(th) * 1.0;
      const p = at(lx, ly, u), nx = Math.sin(th) * c, nz = -Math.sin(th) * s;
      const r = rnd();
      const q = { ...p, nx, ny: Math.cos(th), nz };
      if (r < 0.35) L.plumose.push({ ...q, s: 0.9 + rnd() * 0.7, color: pick(['#f4efe6', '#f4efe6', '#efa15a'], rnd) });
      else if (r < 0.7) L.jewel.push({ ...q, s: 0.8 + rnd() * 0.6, color: pick(JEWEL, rnd) });
      else if (r < 0.85) L.fingers.push({ ...q, s: 1 + rnd() * 0.5, color: pick(['#f0e6da', '#e8964a'], rnd) });
      else L.dahlia.push({ ...q, s: 1.3, color: '#c7404c' });
    }
    // Her keel: growth all along it.
    for (let k = 0; k < 30; k++) {
      const u = (rnd() - 0.5) * W.len * 0.9, p = at((rnd() - 0.5) * 0.3, 0.46, u);
      const r = rnd();
      if (r < 0.4) L.fingers.push({ ...p, s: 0.9 + rnd() * 0.5, color: pick(['#f0e6da', '#e8964a'], rnd) });
      else if (r < 0.7) L.plumose.push({ ...p, s: 0.7 + rnd() * 0.6, color: '#f4efe6' });
      else L.jewel.push({ ...p, s: 0.8, color: pick(JEWEL, rnd) });
    }
    // A lobster in the mouth of the boiler, its claws out.
    const lb = at(0.2, 0.25, -1.15);
    L.lobster.push({ ...lb, s: 1.15, spin: W.yaw, color: '#ffffff' });
    for (let k = 0; k < 24; k++) {
      const p = onBed({ x: W.x, z: W.z }, 3, 12);
      if (!p) continue;
      if (rnd() < 0.5) L.star.push({ ...p, s: 0.9 + rnd() * 0.5, color: pick(['#e0782e', '#a35a8a'], rnd) });
      else L.red.push({ ...p, s: 0.3 + rnd() * 0.3, color: '#ffffff' });
    }
  }

  /* Anchor Sands */
  L = bySite.sands;
  const N = siteById.sands;
  const ripple = buildRipples(N, rnd);
  group.add(ripple);
  const anchor = new THREE.Mesh(anchorGeometry(), plain());
  {
    const yaw = 0.6, x = N.x - 2, z = N.z + 1;
    anchor.position.set(x, bed(x, z) + 0.12, z);
    anchor.rotation.set(0, yaw, 0.04);
    group.add(anchor);
    // Growth on it: a few anemones and fingers along its shank and stock.
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let k = 0; k < 16; k++) {
      const u = -1.4 + rnd() * 3.0, lx = u * c, lz = -u * s;
      const p = { x: x + lx, y: anchor.position.y + 0.11, z: z + lz };
      const r = rnd();
      if (r < 0.4) L.plumose.push({ ...p, s: 0.6 + rnd() * 0.5, color: pick(['#f4efe6', '#efa15a'], rnd) });
      else if (r < 0.75) L.jewel.push({ ...p, s: 0.6 + rnd() * 0.3, color: pick(JEWEL, rnd) });
      else L.fingers.push({ ...p, s: 0.8, color: '#f0e6da' });
    }
    // The chain from its ring, wandering away over the sand, half buried.
    let px = x + 1.85 * c, pz = z - 1.85 * s, h = yaw + 0.3;
    for (let k = 0; k < 46; k++) {
      h += (rnd() - 0.5) * 0.35;
      px += Math.cos(h) * 0.24;
      pz -= Math.sin(h) * 0.24;
      const sink = 0.03 - smoothstep(10, 40, k) * 0.06;
      L.link.push({ x: px, y: bed(px, pz) + sink, z: pz, s: 1, nx: k % 2 ? Math.sin(h) : 0, ny: k % 2 ? 0 : 1, nz: k % 2 ? Math.cos(h) : 0, spin: -h, color: '#ffffff' });
    }
  }
  for (let k = 0; k < 110; k++) {
    const p = onBed(N, 2, N.r + 6, 8);
    if (!p) continue;
    const r = rnd();
    if (r < 0.35) L.ceri.push({ ...p, s: 1 + rnd() * 0.8, color: pick(['#efe6d6', '#d9a070', '#9a7ab8', '#e8d8b0'], rnd) });
    else if (r < 0.6) L.pen.push({ ...p, s: 0.9 + rnd() * 0.7, color: pick(['#e8a090', '#f0c0a8'], rnd) });
    else if (r < 0.8) L.star.push({ ...p, s: 0.8 + rnd() * 0.6, color: pick(['#e0782e', '#c86a3a'], rnd) });
    else L.urchin.push({ ...p, s: 0.6 + rnd() * 0.3, color: '#c99a7a' });
  }

  /* The Hound and its Pup */
  L = bySite.hound;
  const pinMat = plain();
  const towers = PINNACLES.map((P) => {
    const m = new THREE.Mesh(pinnacleGeometry(P), pinMat);
    m.position.set(P.x, P.bed, P.z);
    m.receiveShadow = true;
    group.add(m);
    return m;
  });
  for (const P of PINNACLES) {
    const big = P.id === 'hound' ? 1 : 0.45;
    // Sea fans, standing off the wall across the current, thickest on the ledges.
    for (let k = 0; k < 90 * big; k++) {
      const onLedge = rnd() < 0.55, h = onLedge ? P.top * pick([0.3, 0.62], rnd) - 0.05 : 1 + rnd() * (P.top - 3);
      const p = onWall(P, h, rnd() * Math.PI * 2, -0.1);
      L.fan.push({ ...p, nx: p.nx * 0.35, ny: 1, nz: p.nz * 0.35, s: 0.9 + rnd() * 0.8, spin: 0.5 + (rnd() - 0.5) * 0.5, color: pick(['#e895a8', '#ef9fb0', '#f0b6c0', '#f0ece2'], rnd) });
    }
    // Jewel anemones in sheets down the walls; fingers, plumose anemones and sponges.
    for (let k = 0; k < 520 * big; k++) {
      const h = rnd() * (P.top - 0.5), a = rnd() * Math.PI * 2, p = onWall(P, h, a), r = rnd();
      // (In sheets: the same colour over a stretch of wall.)
      const sheet = JEWEL[Math.floor((fbm(Math.cos(a) * 3 + P.seed, Math.sin(a) * 3 + h * 0.2, 2) * 0.5 + 0.5) * JEWEL.length) % JEWEL.length];
      if (r < 0.62) L.jewel.push({ ...p, s: 1 + rnd() * 0.7, color: sheet });
      else if (r < 0.78) L.fingers.push({ ...p, ny: p.ny + 0.6, s: 1.1 + rnd() * 0.7, color: pick(['#f0e6da', '#f0e6da', '#e8964a', '#efb36a'], rnd) });
      else if (r < 0.88) L.plumose.push({ ...p, ny: p.ny + 1.2, s: 1 + rnd() * 0.8, color: pick(['#f4efe6', '#f4efe6', '#efa15a'], rnd) });
      else if (r < 0.95) L.sponge.push({ ...p, s: 1 + rnd() * 0.8, color: pick(['#d9b43a', '#e07a3a', '#c9a03a'], rnd) });
      else L.star.push({ ...p, s: 1, color: pick(['#e0782e', '#a35a8a'], rnd) });
    }
    // The top: kelp, urchins, starfish and dahlias.
    for (let k = 0; k < 70 * big; k++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * pinnacleRadius(P, P.top, a) * 0.85;
      const x = P.x + Math.cos(a) * d, z = P.z + Math.sin(a) * d, y = P.bed + crownAt(P, d, a);
      const r = rnd();
      if (r < 0.5 && P.id === 'hound') L.kelp.push({ x, y: y - 0.05, z, s: 1.2 + rnd() * 0.8, spin: STREAM() });
      else if (r < 0.7) L.urchin.push({ x, y, z, s: 0.9 + rnd() * 0.4, color: '#c46f8a' });
      else if (r < 0.85) L.dahlia.push({ x, y, z, s: 1.3 + rnd() * 0.6, color: pick(['#c7404c', '#d8625a'], rnd) });
      else L.star.push({ x, y, z, s: 1, color: '#e0782e' });
    }
  }
  {
    // A lobster under the Hound's lowest ledge, a conger's neighbour.
    const P = PINNACLES[0], a = 2.6, p = onWall(P, 0.05, a, 0.35);
    L.lobster.push({ ...p, y: P.bed + 0.03, nx: 0, ny: 1, nz: 0, s: 1.3, spin: -a - Math.PI / 2, color: '#ffffff' });
    // Boulders at the foot: growth on their tops.
    for (const o of ROCKS) {
      if (Math.hypot(o.x - P.x, o.z - P.z) > 36) continue;
      for (let k = 0; k < Math.round(o.r * 4); k++) {
        const q = onRock(o, 0.3), r = rnd();
        if (r < 0.5) L.jewel.push({ ...q, s: 0.9, color: pick(JEWEL, rnd) });
        else if (r < 0.75) L.fingers.push({ ...q, s: 1.1, color: pick(['#f0e6da', '#e8964a'], rnd) });
        else L.plumose.push({ ...q, s: 1, color: '#f4efe6' });
      }
    }
  }

  // All the life: for each site, one instanced mesh for each kind it has.
  const plants = plantMaterial(), mats = { plain: plain(), soft: soft() };
  const shapes = {
    jewel: [jewelGeometry(rnd), mats.plain, { tint: 0.08 }],
    fingers: [fingersGeometry(rnd), mats.plain],
    plumose: [plumoseGeometry(rnd), mats.plain],
    dahlia: [anemoneGeometry(), mats.plain],
    urchin: [urchinGeometry(rnd), mats.plain],
    star: [starGeometry(), mats.plain],
    sponge: [spongeBlob(rnd), mats.plain],
    kelp: [kelpGeometry(rnd), plants, { tint: 0.15 }],
    red: [bladeClump(rnd, 8, 0.1, 0.45, '#6e2430', '#c4505a'), plants, { tint: 0.15 }],
    fan: [fanGeometry(rnd, 5), mats.soft, { tint: 0.06 }],
    lobster: [lobsterGeometry(), mats.plain, { tint: 0 }],
    ceri: [cerianthusGeometry(), mats.soft],
    pen: [seaPenGeometry(), mats.plain],
    link: [linkGeometry(), mats.plain, { tint: 0.15 }],
  };
  const life = [];
  const siteParts = DIVE_SITES.map((S) => {
    const parts = [];
    for (const k of KINDS) {
      const list = bySite[S.id][k];
      if (!list.length) continue;
      const [geo, material, opts] = shapes[k];
      const m = lay(geo, material, list, rnd, opts);
      group.add(m);
      parts.push(m);
      life.push(m);
    }
    return { S, parts };
  });
  siteParts.find((p) => p.S.id === 'kelp').parts.push(pot);
  siteParts.find((p) => p.S.id === 'sands').parts.push(anchor, ripple);
  siteParts.find((p) => p.S.id === 'hound').parts.push(...towers);

  // The buoys: yellow special marks (a yellow cross on top), nodding on the swell.
  const buoyGeo = mergeParts([
    { geo: new THREE.CylinderGeometry(0.45, 0.55, 1.0, 12), matrix: mat(0, 0.1, 0), color: '#e8c234' },
    { geo: new THREE.ConeGeometry(0.45, 0.5, 12), matrix: mat(0, 0.85, 0), color: '#e8c234' },
    { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), matrix: mat(0, 1.4, 0), color: '#3a3d40' },
    { geo: new THREE.BoxGeometry(0.46, 0.08, 0.08), matrix: mat(0, 1.8, 0, 0, 0, 0.78), color: '#e8c234' },
    { geo: new THREE.BoxGeometry(0.46, 0.08, 0.08), matrix: mat(0, 1.8, 0, 0, 0, -0.78), color: '#e8c234' },
    { geo: new THREE.CylinderGeometry(0.57, 0.57, 0.14, 12), matrix: mat(0, -0.36, 0), color: '#2b2e33' },
    // (Its chain down to the sinker.)
    { geo: new THREE.CylinderGeometry(0.02, 0.02, 3, 4), matrix: mat(0, -1.9, 0), color: '#4a3a2c' },
  ], rnd);
  const buoyMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  const buoys = DIVE_SITES.filter((S) => S.buoy).map((S) => {
    const m = new THREE.Mesh(buoyGeo, buoyMat);
    m.castShadow = true;
    m.position.set(S.buoy.x, 0, S.buoy.z);
    m.userData = { ph: rnd() * 6 };
    group.add(m);
    return m;
  });

  scene.add(group);

  return {
    group, buoys, towers, anchor, pot,
    // What grows within r of p, kind by kind (at the site you're at), into `out`.
    kindsNear(p, r, out = new Set()) {
      for (const S of DIVE_SITES) {
        if (Math.hypot(p.x - S.x, p.z - S.z) > S.r + 30) continue;
        for (const [k, list] of Object.entries(bySite[S.id])) {
          if (out.has(k)) continue;
          for (const t of list) {
            if (Math.abs(t.x - p.x) < r && Math.abs(t.z - p.z) < r && Math.hypot(t.x - p.x, t.y - p.y, t.z - p.z) < r) {
              out.add(k);
              break;
            }
          }
        }
      }
      return out;
    },
    setQuality(q) {
      for (const m of life) m.count = Math.max(Math.min(m.userData.total, 120), Math.floor(m.userData.total * Math.max(0.5, q.plants)));
    },
    update(dt, t, camera) {
      for (const b of buoys) {
        const p = b.position;
        p.y = waveHeight(p.x, p.z, t) - 0.3;
        b.rotation.set(Math.sin(t * 0.9 + b.userData.ph) * 0.07, 0, Math.sin(t * 0.7 + b.userData.ph + 1) * 0.06);
      }
      // (Out of sight, out of the way: none of a site is drawn from far off.)
      if (camera) {
        const cp = camera.position;
        let any = false;
        for (const { S, parts } of siteParts) {
          const near = Math.hypot(S.x - cp.x, S.z - cp.z) < 230;
          any ||= near;
          for (const m of parts) m.visible = near;
        }
        rocks.visible = any;
      }
    },
  };
}

// Anchor Sands' ripples: a round patch of sand ridged by the tide, fading out at its edge.
function buildRipples(S, rnd) {
  const N = 150, R = S.r + 8;
  const pos = [], col = [], idx = [];
  const sand = new THREE.Color('#b9a57c'), crest = new THREE.Color('#cdbb92');
  const dir = 0.9, c = Math.cos(dir), s = Math.sin(dir);
  for (let j = 0; j <= N; j++) {
    for (let i = 0; i <= N; i++) {
      const x = S.x + (i / N - 0.5) * 2 * R, z = S.z + (j / N - 0.5) * 2 * R;
      const d = Math.hypot(x - S.x, z - S.z), fade = smoothstep(R, R * 0.6, d);
      const u = (x - S.x) * c + (z - S.z) * s;
      // (Ridges a metre and a half apart, wandering a little; their crests paler.)
      const wave = Math.sin(u * 4.2 + fbm(x * 0.12, z * 0.12, 2) * 4);
      // (Lifted clear of the seabed's own triangles, which sit a little off the true height.)
      const y = heightAt(x, z) + 0.17 + wave * 0.035 * fade - (1 - fade) * 0.12;
      pos.push(x, y, z);
      _c.copy(sand).lerp(crest, clamp(wave * 0.5 + 0.5, 0, 1) * 0.45);
      col.push(_c.r, _c.g, _c.b, fade);
    }
  }
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const a = j * (N + 1) + i, b = a + 1, d = a + N + 1, e = d + 1;
      idx.push(a, d, b, b, d, e);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, depthWrite: false })));
  m.receiveShadow = true;
  m.renderOrder = 1;
  return m;
}
