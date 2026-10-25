import * as THREE from 'three';
import { mergeParts, mat, fbm, clamp, lerp, smoothstep, jitterGeo, pick, glowTexture } from '../util.js';
import { withSurface } from './surface.js';
import { withCaustics } from './caustics.js';
import {
  brasaHeight, brasaSDF, brasaHabitat, lavaRough, onBeach, windward, ISLE, PICO, ROJA, FARO, PUERTO, PLAYA, ARCO, ARCHES,
  VILLAGE, QUAY_S, DIQUE, MOLE, POSADA, QUAY_STEPS, SEBADAL, SOUTH_MAP, PONTOON_S, FINGERS_S, PONTOON_STEPS, FUEL_S, BAJON, onBajon,
} from './brasa.js';
import { fuelPumpParts, pontoonParts } from '../props.js';

// What Las Brasas looks like (its shape is in brasa.js): the colours of its ground and seabed,
// and everything built on it or grown on it. Built the first time you come near (see world.js),
// with seeds of its own, so nothing at home changes.
//
//  · Puerto Brasa: a stone quay, a breakwater of big concrete blocks round the basin with a
//    harbour light on its end, a floating pontoon with finger berths and a fuel pump at its root, little wooden boats pulled up and moored, white flat-roofed houses
//    stepping up the slope with coloured doors and shutters, a church with a bell gable and dark
//    stone corners, palms in the square, and Bar El Muelle on the waterfront, where there's a room.
//  · The island: black lava, red cinder on the cones, ochre tuff, grey-green tabaiba scrub and the
//    candelabras of cardón, Canary pines high on the volcano's flanks; the lighthouse on Punta del
//    Faro; Roque del Arco with the sea running through its arch.
//  · Under the water: black lava boulders, the long-spined urchins that graze the rock bare, brown
//    weed in the shallows, seagrass on the sebadal, and the arches off the Roque. Below the surge,
//    the reef's own colour, as on the real islands' reefs: sea fans (yellow, orange and red
//    gorgonians) standing across the current, sponges, orange sun coral under the overhangs,
//    anemones, and the pale bushes of black coral down the walls. Thickest of all on El Bajón, the
//    reef off the harbour mouth, which has a yellow buoy over it.

/* ---------------- colours ---------------- */

const BC = {
  lava: new THREE.Color('#3b393b'),
  lavaLight: new THREE.Color('#57524f'),
  lavaBrown: new THREE.Color('#5e4c40'),
  tuff: new THREE.Color('#a8885c'),
  tuffPale: new THREE.Color('#c2a67a'),
  cinder: new THREE.Color('#8e402c'),
  cinderDark: new THREE.Color('#5d2a22'),
  scrub: new THREE.Color('#7f8d5e'),
  scrubDry: new THREE.Color('#9c9564'),
  pineFloor: new THREE.Color('#6a6440'),
  blackSand: new THREE.Color('#2f2c2b'),
  wetBlack: new THREE.Color('#1f1d1e'),
  paving: new THREE.Color('#cdbfa6'),
  bedSand: new THREE.Color('#8f897c'),
  bedPale: new THREE.Color('#cdc4a3'),
  bedRock: new THREE.Color('#3a3d42'),
  seagrass: new THREE.Color('#4c6a38'),
  algae: new THREE.Color('#62653a'),
  deep: new THREE.Color('#2a3038'),
};
const _hb = {};

// The ground's colour at a point of the far south (for the terrain's triangles).
export function brasaColor(c, h, ny, x, z, r) {
  const n = fbm(x * 0.03 + 7, z * 0.03 - 2, 2), n2 = fbm(x * 0.11 - 3, z * 0.11 + 5, 2);
  if (h < -0.3) {
    // The seabed: black sand and lava near the shore, paler sand further out and on the sebadal,
    // seagrass and weed where they grow, bare rock on the reef and the wall, dark far down.
    const H = brasaHabitat(x, z, _hb), d = -h;
    const sb = smoothstep(1.2, 0.8, Math.hypot((x - SEBADAL.x) / SEBADAL.rx, (z - SEBADAL.z) / SEBADAL.rz));
    c.copy(BC.blackSand).lerp(BC.bedSand, smoothstep(1, 9, d)).lerp(BC.bedPale, sb * 0.85);
    c.lerp(BC.bedRock, clamp(H.rock * 1.1 + n2 * 0.2, 0, 1));
    c.lerp(BC.seagrass, H.grass * 0.75).lerp(BC.algae, clamp(H.weed - H.grass, 0, 1) * 0.6);
    c.lerp(BC.deep, smoothstep(30, 90, d));
  } else {
    const beach = onBeach(x, z);
    const steep = smoothstep(0.85, 0.6, ny);
    const rough = lavaRough(x, z);
    // Old lava low down and on the steep; ochre tuff and scrub on the gentler slopes of the lee;
    // red cinder round the cones; pine needles high on the volcano's flanks.
    c.copy(BC.lava).lerp(BC.lavaBrown, clamp(0.45 + n * 0.9, 0, 1));
    const lee = 1 - windward(x, z);
    const gentle = smoothstep(0.75, 0.92, ny) * smoothstep(6, 25, h);
    c.lerp(BC.tuff, gentle * lee * clamp(0.5 + n * 1.2, 0, 1) * (1 - smoothstep(170, 240, h)));
    c.lerp(BC.scrubDry, gentle * clamp(0.35 + n2, 0, 1) * 0.55 * (1 - smoothstep(150, 220, h)));
    c.lerp(BC.scrub, gentle * clamp(n2 * 1.4, 0, 1) * 0.5);
    const dp = Math.hypot(x - PICO.x, z - PICO.z), dr = Math.hypot(x - ROJA.x, z - ROJA.z);
    c.lerp(BC.cinder, smoothstep(ROJA.r * 0.9, ROJA.r * 0.35, dr) * (0.7 + 0.3 * n));
    c.lerp(BC.cinderDark, smoothstep(70, 20, dp) * 0.8 + smoothstep(32, 8, dr) * 0.4);
    c.lerp(BC.pineFloor, smoothstep(120, 170, h) * smoothstep(260, 200, h) * smoothstep(0.7, 0.85, ny) * clamp(0.3 + n2, 0, 1) * 0.7);
    c.lerp(BC.lavaLight, steep * (0.5 + rough * 0.3));
    // Black sand, wet at the water's edge.
    if (beach > 0.02) c.lerp(h < 0.9 ? BC.wetBlack : BC.blackSand, beach * smoothstep(5, 1, h));
    // The rim of boulders at the shore.
    if (h < 2.2 && beach < 0.5) c.lerp(BC.lava, smoothstep(2.2, 0.8, h) * 0.6);
    // The village's paving and whitewashed walls round the houses.
    const dv = Math.hypot(x - VILLAGE.x, z - VILLAGE.z);
    if (dv < VILLAGE.r + 10) c.lerp(BC.paving, smoothstep(VILLAGE.r + 10, VILLAGE.r * 0.6, dv) * (0.55 + 0.2 * n2));
  }
  c.multiplyScalar(0.95 + r * 0.1);
}

/* ---------------- shapes ---------------- */

const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}
function instanced(geo, list, material, rnd, { tint = 0.12, tilt = 0, shadows = true } = {}) {
  const m = new THREE.InstancedMesh(geo, material, Math.max(1, list.length));
  m.count = list.length;
  const o = new THREE.Object3D(), c = new THREE.Color();
  list.forEach((t, i) => {
    o.position.set(t.x, t.y, t.z);
    o.rotation.set((rnd() - 0.5) * tilt + (t.rx || 0), t.r || 0, (rnd() - 0.5) * tilt);
    o.scale.set(t.sx ?? t.s, t.sy ?? t.s, t.sz ?? t.s);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    if (t.color) c.set(t.color);
    else {
      const v = 1 - tint + rnd() * tint * 2;
      c.setRGB(v * (0.97 + rnd() * 0.06), v, v * (0.95 + rnd() * 0.08));
    }
    m.setColorAt(i, c);
  });
  m.instanceMatrix.needsUpdate = true;
  if (m.instanceColor) m.instanceColor.needsUpdate = true;
  m.castShadow = shadows;
  m.receiveShadow = true;
  m.computeBoundingSphere();
  return m;
}

// A Canary palm: a thick, slightly leaning trunk and a full crown of arching fronds.
function palmGeometry(rnd) {
  const parts = [];
  const H = 7;
  for (let k = 0; k < 7; k++) {
    const y0 = (k / 7) * H, h = H / 7 + 0.05;
    parts.push({ geo: new THREE.CylinderGeometry(0.42 - k * 0.02, 0.47 - k * 0.02, h, 7), matrix: mat(k * 0.03, y0 + h / 2, 0), color: k % 2 ? '#7d6a52' : '#8a765c' });
  }
  parts.push({ geo: new THREE.SphereGeometry(0.62, 7, 5), matrix: mat(0.21, H + 0.1, 0, 0, 0, 0, 1, 0.75, 1), color: '#8f8a52' });
  // Fronds: a strip of quads arching out and down.
  const frond = (yaw, lift, len, color) => {
    const pos = [];
    const seg = 5, w = 0.55;
    let prev = null;
    for (let j = 0; j <= seg; j++) {
      const t = j / seg;
      const along = t * len, up = Math.sin(lift) * along - 1.6 * t * t * len * 0.35;
      const hw = w * Math.sin(Math.PI * Math.min(1, t * 1.15 + 0.08)) * 0.5;
      const L = [-hw, up, along], R = [hw, up, along];
      if (prev) pos.push(...prev.L, ...prev.R, ...R, ...prev.L, ...R, ...L);
      prev = { L, R };
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.computeVertexNormals();
    parts.push({ geo: g, matrix: mat(0.21, H + 0.15, 0, 0, yaw, 0), color });
  };
  for (let k = 0; k < 16; k++) frond((k / 16) * Math.PI * 2 + rnd() * 0.2, 0.35 + rnd() * 0.5 + (k % 2) * 0.25, 3.6 + rnd() * 1.1, pick(['#4f7a3a', '#5b8642', '#46703a'], rnd));
  return mergeParts(parts, rnd);
}

// Tabaiba: a low, rounded grey-green bush; cardón: a candelabra of grey-green columns.
function tabaibaGeometry(rnd) {
  return mergeParts([
    { geo: jitterGeo(new THREE.IcosahedronGeometry(0.7, 1), 0.18, rnd), matrix: mat(0, 0.3, 0, 0, 0, 0, 1, 0.6, 1), color: '#8a9a6a' },
    { geo: jitterGeo(new THREE.IcosahedronGeometry(0.45, 0), 0.12, rnd), matrix: mat(0.45, 0.32, 0.15, 0, 0, 0, 1, 0.7, 1), color: '#94a271' },
    { geo: jitterGeo(new THREE.IcosahedronGeometry(0.4, 0), 0.12, rnd), matrix: mat(-0.4, 0.28, -0.2, 0, 0, 0, 1, 0.7, 1), color: '#7f9061' },
  ], rnd);
}
function cardonGeometry(rnd) {
  const parts = [];
  for (let k = 0; k < 13; k++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * 0.9;
    const h = 1.1 + rnd() * 1.4 * (1 - d * 0.5);
    parts.push({ geo: new THREE.CylinderGeometry(0.13, 0.15, h, 6), matrix: mat(Math.cos(a) * d, h / 2, Math.sin(a) * d), color: pick(['#6f8a55', '#7a9460', '#64804f'], rnd) });
  }
  return mergeParts(parts, rnd);
}
function pineGeometry() {
  return mergeParts([
    { geo: new THREE.CylinderGeometry(0.16, 0.26, 3.4, 5), matrix: mat(0, 1.7, 0), color: '#6b4c36' },
    { geo: new THREE.ConeGeometry(1.4, 2.4, 7), matrix: mat(0, 3.6, 0), color: '#4a6f45' },
    { geo: new THREE.ConeGeometry(1.15, 2.1, 7), matrix: mat(0, 4.7, 0, 0, 0.4, 0), color: '#527a4b' },
    { geo: new THREE.ConeGeometry(0.75, 1.7, 7), matrix: mat(0, 5.7, 0, 0, 0.9, 0), color: '#5b8452' },
  ]);
}
// A long-spined urchin: a black ball bristling with spines.
function urchinGeometry() {
  const parts = [{ geo: new THREE.IcosahedronGeometry(0.06, 0), color: '#151416' }];
  const ico = new THREE.IcosahedronGeometry(1, 0), p = ico.attributes.position;
  const seen = new Set();
  const up = new THREE.Vector3(0, 1, 0), v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i).normalize();
    const key = v.toArray().map((x) => x.toFixed(2)).join();
    if (seen.has(key)) continue;
    seen.add(key);
    const q = new THREE.Quaternion().setFromUnitVectors(up, v);
    const m = new THREE.Matrix4().compose(v.clone().multiplyScalar(0.11), q, new THREE.Vector3(1, 1, 1));
    parts.push({ geo: new THREE.ConeGeometry(0.008, 0.2, 3), matrix: m, color: '#1d1b20' });
  }
  return mergeParts(parts);
}
// A sea fan (a gorgonian): a flat fan of branches forking from a short stem, about two thirds of a
// metre tall at scale 1, in the x-y plane (it stands across the current). White: each is tinted.
function fanGeometry(rnd, depth = 5) {
  const pos = [];
  const strip = (x0, y0, x1, y1, w) => {
    const L = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / L) * w, ny = ((x1 - x0) / L) * w;
    pos.push(x0 - nx, y0 - ny, 0, x1 - nx, y1 - ny, 0, x1 + nx, y1 + ny, 0, x0 - nx, y0 - ny, 0, x1 + nx, y1 + ny, 0, x0 + nx, y0 + ny, 0);
  };
  const grow = (x, y, a, len, w, n) => {
    const x1 = x + Math.sin(a) * len, y1 = y + Math.cos(a) * len;
    strip(x, y, x1, y1, w);
    if (n === 0) return;
    for (const s of [-1, 1]) grow(x1, y1, a + s * (0.26 + rnd() * 0.32), len * (0.74 + rnd() * 0.16), w * 0.8, n - 1);
  };
  grow(0, 0, (rnd() - 0.5) * 0.2, 0.17, 0.022, depth);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(pos.length).fill(1), 3));
  g.computeVertexNormals();
  return g;
}
// Black coral: a pale, bushy colony (two fans crossed).
function blackCoralGeometry(rnd) {
  return mergeParts([{ geo: fanGeometry(rnd, 5), color: '#ffffff', jitter: 0.04 }, { geo: fanGeometry(rnd, 5), matrix: mat(0, 0, 0, 0, Math.PI / 2, 0, 0.85), color: '#f2efe4', jitter: 0.04 }], rnd);
}
// A cluster of tube sponges, open at the top (dark inside).
function spongeGeometry(rnd) {
  const parts = [];
  const n = 3 + Math.floor(rnd() * 3);
  for (let i = 0; i < n; i++) {
    const h = 0.16 + rnd() * 0.3, r = 0.04 + rnd() * 0.045, a = rnd() * 6.28, d = i ? 0.06 + rnd() * 0.07 : 0;
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    parts.push({ geo: new THREE.CylinderGeometry(r, r * 1.2, h, 7, 1, true), matrix: mat(x, h / 2, z), color: '#ffffff' });
    parts.push({ geo: new THREE.CircleGeometry(r * 0.92, 7), matrix: mat(x, h - 0.02, z, -Math.PI / 2, 0, 0), color: '#4a3326' });
  }
  return mergeParts(parts, rnd);
}
// Orange sun coral: a low cushion of little cup polyps, in the shade of overhangs.
function sunCoralGeometry(rnd) {
  const parts = [{ geo: jitterGeo(new THREE.SphereGeometry(0.15, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0.025, rnd), matrix: mat(0, 0, 0, 0, 0, 0, 1, 0.6, 1), color: '#ffffff' }];
  for (let i = 0; i < 10; i++) {
    const a = rnd() * 6.28, r = Math.sqrt(rnd()) * 0.12;
    parts.push({ geo: new THREE.CylinderGeometry(0.02, 0.016, 0.035, 6), matrix: mat(Math.cos(a) * r, 0.085 - r * 0.45, Math.sin(a) * r), color: '#fff3c4' });
  }
  return mergeParts(parts, rnd);
}
// An anemone: a short column and a ring of tentacles.
function anemoneGeometry() {
  const parts = [{ geo: new THREE.CylinderGeometry(0.05, 0.07, 0.1, 8), matrix: mat(0, 0.05, 0), color: '#e8d6cc' }];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
    parts.push({ geo: new THREE.ConeGeometry(0.011, 0.13, 4), matrix: mat(c * 0.06, 0.15, s * 0.06, s * 0.7, 0, -c * 0.7), color: '#ffffff' });
  }
  return mergeParts(parts);
}

// A little wooden fishing boat, open, pulled up or lying at a mooring (bow along +z): a hull
// that narrows to a pointed bow and in towards the keel, a band of colour under the gunwale,
// thwarts across it.
function hullGeometry(L, B, D, inset = 0) {
  const g = new THREE.BoxGeometry(B - inset, D, L - inset, 1, 1, 6);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const u = z / (L / 2); // −1 stern … 1 bow
    const taper = u > 0 ? 1 - 0.92 * u * u : 1 - 0.18 * u * u;
    const keel = y < 0 ? 0.55 : 1;
    p.setXYZ(i, x * taper * keel, y + (u > 0.6 ? (u - 0.6) * 0.25 : 0), z);
  }
  g.computeVertexNormals();
  return g;
}
function boatGeometry(rnd, color) {
  const parts = [];
  parts.push({ geo: hullGeometry(3.8, 1.5, 0.62), matrix: mat(0, 0.3, 0), color: '#f1ede4' });
  parts.push({ geo: hullGeometry(3.84, 1.54, 0.14), matrix: mat(0, 0.55, 0), color });
  parts.push({ geo: hullGeometry(3.86, 1.56, 0.08), matrix: mat(0, 0.04, 0), color: '#6d3b2c' });
  // (The inside, a shade darker, just below the gunwale.)
  parts.push({ geo: hullGeometry(3.5, 1.25, 0.05), matrix: mat(0, 0.6, -0.05), color: '#c9b79a' });
  for (const z of [-0.9, 0.2, 1.0]) parts.push({ geo: new THREE.BoxGeometry(1.25 * (z > 0.5 ? 0.75 : 1), 0.06, 0.26), matrix: mat(0, 0.66, z), color: '#8a6a4a' });
  return mergeParts(parts, rnd);
}

/* ---------------- the build ---------------- */

export function buildBrasa(scene, rnd) {
  const group = new THREE.Group();
  const obstacles = [], spots = [], boxes = [];
  const white = [], stone = [], plainParts = [], wood = [];
  const H = brasaHeight;

  /* ---------- the harbour ---------- */
  {
    // The quay: courses of dark basalt down to the bed, a pale concrete deck, bollards.
    const Q = QUAY_S, cz = (Q.z0 + Q.z1) / 2;
    for (let x = Q.x0 + 0.6; x < Q.x1; x += 1.2) {
      const bottom = Math.min(H(x, Q.z1 + 1), 0) - 0.6;
      for (let y = bottom; y < Q.deck - 0.3; y += 0.55) stone.push({ geo: new THREE.BoxGeometry(1.18, 0.54, 1.2), matrix: mat(x + (rnd() - 0.5) * 0.04, y + 0.27, Q.z1 - 0.6), color: pick(['#3d3c3e', '#46443f', '#353436'], rnd), jitter: 0.03 });
    }
    plainParts.push({ geo: new THREE.BoxGeometry(Q.x1 - Q.x0, 0.3, Q.z1 - Q.z0), matrix: mat((Q.x0 + Q.x1) / 2, Q.deck - 0.15, cz), color: '#c9c3b6' });
    for (let x = Q.x0 + 4; x < Q.x1 - 2; x += 9) {
      plainParts.push({ geo: new THREE.CylinderGeometry(0.17, 0.22, 0.55, 8), matrix: mat(x, Q.deck + 0.27, Q.z1 - 0.5), color: '#2f2e30' });
      obstacles.push({ x, z: Q.z1 - 0.5, r: 0.24, top: Q.deck + 0.55 });
    }
    // Steps down to the water at the quay's west end.
    for (let k = 0; k < 4; k++) stone.push({ geo: new THREE.BoxGeometry(1.4, 0.3, 0.6), matrix: mat(QUAY_STEPS.x, Q.deck - 0.3 - k * 0.38, Q.z1 + 0.3 + k * 0.6), color: '#5a5754' });
    // The breakwater (the dique down the east side, the mole across the south): big pale blocks,
    // a walkway along the top and a tall wall on the seaward side.
    const wall = (B, along) => {
      const len = along === 'z' ? B.z1 - B.z0 : B.x1 - B.x0;
      const cx = (B.x0 + B.x1) / 2, cz2 = (B.z0 + B.z1) / 2;
      for (let u = 1; u < len; u += 2.2) {
        const x = along === 'z' ? cx : B.x0 + u, z = along === 'z' ? B.z0 + u : cz2;
        const bottom = Math.min(H(x, z), 0) - 1;
        for (let y = bottom; y < B.deck - 0.4; y += 1.1) plainParts.push({ geo: new THREE.BoxGeometry(along === 'z' ? B.x1 - B.x0 : 2.15, 1.08, along === 'z' ? 2.15 : B.z1 - B.z0), matrix: mat(x, y + 0.54, z, 0, (rnd() - 0.5) * 0.04, 0), color: pick(['#b6b2a8', '#c0bcb2', '#aaa69c'], rnd), jitter: 0.05 });
      }
      plainParts.push({ geo: new THREE.BoxGeometry(B.x1 - B.x0, 0.35, B.z1 - B.z0), matrix: mat(cx, B.deck - 0.17, cz2), color: '#cbc6ba' });
      // (The seaward wall: east of the dique, south of the mole.)
      if (along === 'z') plainParts.push({ geo: new THREE.BoxGeometry(1.2, 1.4, len), matrix: mat(B.x1 - 0.6, B.deck + 0.7, cz2), color: '#bdb8ad' });
      else plainParts.push({ geo: new THREE.BoxGeometry(len, 1.4, 1.2), matrix: mat(cx, B.deck + 0.7, B.z1 - 0.6), color: '#bdb8ad' });
      // Tumbled blocks along its outer foot, where the sea breaks.
      for (let u = 2; u < len; u += 3.5) {
        const x = along === 'z' ? B.x1 + 2 + rnd() * 2 : B.x0 + u, z = along === 'z' ? B.z0 + u : B.z1 + 2 + rnd() * 2;
        plainParts.push({ geo: jitterGeo(new THREE.BoxGeometry(2.4, 2.4, 2.4), 0.3, rnd), matrix: mat(x, Math.min(H(x, z), 0) + 0.6, z, rnd(), rnd(), rnd()), color: pick(['#a9a59b', '#b4b0a6'], rnd) });
      }
    };
    wall(DIQUE, 'z');
    wall(MOLE, 'x');
    for (const B of [DIQUE, MOLE]) {
      const along = B === DIQUE ? 'z' : 'x';
      const len = along === 'z' ? B.z1 - B.z0 : B.x1 - B.x0;
      for (let u = 1; u < len; u += 3) obstacles.push({ x: along === 'z' ? B.x1 - 0.6 : B.x0 + u, z: along === 'z' ? B.z0 + u : B.z1 - 0.6, r: 0.8, top: B.deck + 1.4 });
    }
  }
  // The pontoon (see props.js), its fingers and the gangway down from the quay; the fuel pump on
  // the quay at its root.
  {
    const P = pontoonParts({ walk: PONTOON_S, fingers: FINGERS_S, steps: PONTOON_STEPS, from: QUAY_S.deck }, H, rnd);
    wood.push(...P.wood);
    plainParts.push(...P.metal);
    obstacles.push(...P.obstacles);
    // The fuel pump, and a lifebuoy on a post beside it.
    const F = FUEL_S;
    plainParts.push(...fuelPumpParts(F.x, QUAY_S.deck, F.z, F.yaw));
    obstacles.push({ x: F.x, z: F.z, r: 0.42, kind: 'harbour', name: 'the fuel pump' });
    plainParts.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 1.3, 6), matrix: mat(F.x + 2.2, QUAY_S.deck + 0.65, F.z + 0.4), color: '#d8d4ca' });
    plainParts.push({ geo: new THREE.TorusGeometry(0.3, 0.07, 6, 14), matrix: mat(F.x + 2.2, QUAY_S.deck + 1.05, F.z + 0.5), color: '#e2552f' });
    obstacles.push({ x: F.x + 2.2, z: F.z + 0.4, r: 0.15, kind: 'harbour', name: 'the lifebuoy' });
  }
  // The harbour light: a little green tower on the end of the mole.
  const harbourLight = new THREE.Group();
  {
    const x = MOLE.x0 + 1.5, z = (MOLE.z0 + MOLE.z1) / 2, y = MOLE.deck;
    plainParts.push({ geo: new THREE.CylinderGeometry(0.55, 0.7, 3.2, 10), matrix: mat(x, y + 1.6, z), color: '#2f8f55' });
    plainParts.push({ geo: new THREE.CylinderGeometry(0.62, 0.62, 0.18, 10), matrix: mat(x, y + 3.3, z), color: '#e9e6dc' });
    obstacles.push({ x, z, r: 0.8 });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(120,255,160,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.setScalar(2.4);
    harbourLight.add(glow);
    harbourLight.position.set(x, y + 3.6, z);
    harbourLight.userData.glow = glow;
    group.add(harbourLight);
  }

  /* ---------- the village ---------- */
  const windows = [];
  const DOORS = ['#2f6b4f', '#2c5d8a', '#7a3d2e', '#3f7f86', '#6b4a2f'];
  const WALLS = ['#f4f1e8', '#efe9dc', '#f6efe2', '#f2ede4', '#e9cf98', '#d9e3e6'];
  const houses = [];
  const house = (x, z, w, d, storeys, yaw = 0, walls = pick(WALLS, rnd), door = pick(DOORS, rnd)) => {
    const y = H(x, z) - 0.15, h = 3.1 * storeys;
    const c = Math.cos(yaw), s = Math.sin(yaw);
    const at = (lx, ly, lz) => [x + lx * c + lz * s, y + ly, z - lx * s + lz * c];
    white.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(...at(0, h / 2, 0), 0, yaw, 0), color: walls });
    // A low parapet round the flat roof, and sometimes a water tank or a little roof room.
    white.push({ geo: new THREE.BoxGeometry(w + 0.12, 0.45, d + 0.12), matrix: mat(...at(0, h + 0.2, 0), 0, yaw, 0), color: walls });
    plainParts.push({ geo: new THREE.BoxGeometry(w - 0.3, 0.05, d - 0.3), matrix: mat(...at(0, h + 0.03, 0), 0, yaw, 0), color: '#a99d88' });
    if (rnd() < 0.35) plainParts.push({ geo: new THREE.CylinderGeometry(0.45, 0.45, 0.9, 8), matrix: mat(...at(w * 0.25, h + 0.5, -d * 0.2)), color: '#7f8a8f' });
    // The door (on the side facing the sea, +z) and its shutters and windows.
    plainParts.push({ geo: new THREE.BoxGeometry(1.0, 2.1, 0.08), matrix: mat(...at(-w * 0.2, 1.05, d / 2 + 0.03), 0, yaw, 0), color: door });
    for (let k = 0; k < storeys; k++) {
      for (const wx of k === 0 ? [w * 0.25] : [-w * 0.25, w * 0.25]) {
        if (Math.abs(wx) > w / 2 - 0.6) continue;
        windows.push({ geo: new THREE.BoxGeometry(0.8, 1.0, 0.06), matrix: mat(...at(wx, 1.7 + k * 3.1, d / 2 + 0.03), 0, yaw, 0), color: '#2c2f33' });
        for (const sx of [-0.55, 0.55]) plainParts.push({ geo: new THREE.BoxGeometry(0.3, 1.05, 0.06), matrix: mat(...at(wx + sx, 1.7 + k * 3.1, d / 2 + 0.05), 0, yaw, 0), color: door });
      }
    }
    obstacles.push({ x, z, r: Math.max(w, d) * 0.55, kind: 'building', name: 'a house' });
    houses.push({ x, z, w, d });
  };
  // The church, on the little square at the west end of the waterfront: a white nave, a bell
  // gable over the door, dark basalt on its corners.
  const CH = { x: -26, z: 6262 };
  {
    const y = H(CH.x, CH.z) - 0.15;
    white.push({ geo: new THREE.BoxGeometry(8, 6, 14), matrix: mat(CH.x, y + 3, CH.z), color: '#f5f2ea' });
    white.push({ geo: new THREE.BoxGeometry(8.2, 0.5, 14.2), matrix: mat(CH.x, y + 6.2, CH.z), color: '#f5f2ea' });
    white.push({ geo: new THREE.BoxGeometry(4.2, 4.2, 0.9), matrix: mat(CH.x, y + 8.2, CH.z + 6.6), color: '#f5f2ea' });
    windows.push({ geo: new THREE.BoxGeometry(1.2, 1.5, 1.0), matrix: mat(CH.x, y + 8.6, CH.z + 6.6), color: '#2b2a2c' });
    plainParts.push({ geo: new THREE.CylinderGeometry(0.35, 0.45, 0.6, 8), matrix: mat(CH.x, y + 8.4, CH.z + 6.6), color: '#9a7a3c' });
    plainParts.push({ geo: new THREE.BoxGeometry(1.6, 2.8, 0.1), matrix: mat(CH.x, y + 1.4, CH.z + 7.05), color: '#5a3b26' });
    for (const [dx, dz] of [[-4, -7], [4, -7], [-4, 7], [4, 7]]) stone.push({ geo: new THREE.BoxGeometry(0.5, 6.2, 0.5), matrix: mat(CH.x + dx, y + 3.1, CH.z + dz), color: '#3c3a3a' });
    stone.push({ geo: new THREE.BoxGeometry(2.6, 3.4, 0.25), matrix: mat(CH.x, y + 1.7, CH.z + 7.02), color: '#3c3a3a' });
    obstacles.push({ x: CH.x, z: CH.z, r: 5.5, kind: 'building', name: 'the church' });
  }
  // Bar El Muelle: on the waterfront, two storeys, blue shutters, an awning and tables.
  {
    const P = POSADA, y = H(P.x, P.z) - 0.15;
    white.push({ geo: new THREE.BoxGeometry(9, 6.2, 7), matrix: mat(P.x, y + 3.1, P.z), color: '#f6f2e9' });
    white.push({ geo: new THREE.BoxGeometry(9.12, 0.45, 7.12), matrix: mat(P.x, y + 6.4, P.z), color: '#f6f2e9' });
    plainParts.push({ geo: new THREE.BoxGeometry(1.2, 2.2, 0.08), matrix: mat(P.x - 2, y + 1.1, P.z + 3.53), color: '#2c5d8a' });
    for (const wx of [1.2, 3.2]) windows.push({ geo: new THREE.BoxGeometry(1.2, 1.3, 0.06), matrix: mat(P.x + wx, y + 1.8, P.z + 3.53), color: '#2c2f33' });
    for (const wx of [-2.6, 0, 2.6]) {
      windows.push({ geo: new THREE.BoxGeometry(0.9, 1.1, 0.06), matrix: mat(P.x + wx, y + 4.6, P.z + 3.53), color: '#2c2f33' });
      for (const sx of [-0.6, 0.6]) plainParts.push({ geo: new THREE.BoxGeometry(0.32, 1.15, 0.06), matrix: mat(P.x + wx + sx, y + 4.6, P.z + 3.56), color: '#2c5d8a' });
    }
    // The awning, the sign, three tables with chairs.
    plainParts.push({ geo: new THREE.BoxGeometry(8.6, 0.08, 2.2), matrix: mat(P.x, y + 2.75, P.z + 4.6, 0.18, 0, 0), color: '#c64a3c' });
    plainParts.push({ geo: new THREE.BoxGeometry(3.2, 0.7, 0.1), matrix: mat(P.x - 1.5, y + 3.4, P.z + 3.56), color: '#e9dfc8' });
    for (const tx of [-3, 0, 3]) {
      const x = P.x + tx, z = P.z + 6.2;
      wood.push({ geo: new THREE.CylinderGeometry(0.45, 0.45, 0.05, 10), matrix: mat(x, y + 0.75, z), color: '#e8e2d4' });
      wood.push({ geo: new THREE.CylinderGeometry(0.05, 0.05, 0.75, 5), matrix: mat(x, y + 0.37, z), color: '#4a4a4a' });
      for (const cx of [-0.7, 0.7]) wood.push({ geo: new THREE.BoxGeometry(0.4, 0.45, 0.4), matrix: mat(x + cx, y + 0.23, z), color: '#6a5038' });
      obstacles.push({ x, z, r: 0.75, top: 0.8 });
    }
    obstacles.push({ x: P.x, z: P.z, r: 4.6, kind: 'building', name: 'Bar El Muelle' });
    // (Where you stand at its door: the room upstairs, its kitchen, and a shelf of tackle.)
    spots.push({ kind: 'posada', name: 'Bar El Muelle', x: P.x - 2, z: P.z + 4.6, r: 2.2 });
    boxes.push({ place: 'puerto', x: P.x - 2, z: P.z + 4.6 });
  }
  // The houses: rows along the terraces above the waterfront, gaps for the lanes.
  const free = (x, z, r) => Math.hypot(x - CH.x, z - CH.z) > r + 7 && Math.hypot(x - POSADA.x, z - POSADA.z) > r + 6 && houses.every((h) => Math.hypot(x - h.x, z - h.z) > r + Math.max(h.w, h.d) * 0.5 + 1.4);
  for (let row = 0; row < 6; row++) {
    const z = VILLAGE.z + 26 - row * 16 + (rnd() - 0.5) * 2;
    for (let x = VILLAGE.x - 80 + (row % 2) * 5; x < VILLAGE.x + 95; x += 9 + rnd() * 4) {
      if (rnd() < 0.18) continue; // (a lane, a garden)
      const w = 5.5 + rnd() * 3, d = 5 + rnd() * 2.5;
      if (Math.hypot(x - VILLAGE.x, z - VILLAGE.z) > VILLAGE.r + 5 || brasaSDF(x, z) > -6 || !free(x, z, Math.max(w, d) * 0.5)) continue;
      house(x, z, w, d, rnd() < 0.3 ? 2 : 1, (rnd() - 0.5) * 0.12);
    }
  }
  // A few farmhouses and huts scattered up the slopes.
  for (let i = 0; i < 400 && houses.length < 46; i++) {
    const x = ISLE.x - 380 + rnd() * 820, z = ISLE.z - 120 + rnd() * 420;
    if (brasaSDF(x, z) > -25 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r + 20) continue;
    const h = H(x, z);
    if (h > 110 || Math.abs(H(x + 4, z) - h) > 2 || Math.abs(H(x, z + 4) - h) > 2) continue;
    if (!free(x, z, 4)) continue;
    house(x, z, 5 + rnd() * 2, 4.5 + rnd() * 1.5, 1, rnd() * Math.PI);
  }

  /* ---------- Punta del Faro ---------- */
  const lightBeam = new THREE.Group();
  {
    const x = FARO.x, z = FARO.z, gy = H(x, z);
    plainParts.push({ geo: new THREE.CylinderGeometry(2.2, 2.6, 1.2, 12), matrix: mat(x, gy + 0.4, z), color: '#3f3d3d' });
    white.push({ geo: new THREE.CylinderGeometry(1.2, 1.7, 13, 12), matrix: mat(x, gy + 7.4, z), color: '#f3f0e8' });
    plainParts.push({ geo: new THREE.CylinderGeometry(1.22, 1.3, 1.6, 12), matrix: mat(x, gy + 10.5, z), color: '#b8423a' });
    plainParts.push({ geo: new THREE.CylinderGeometry(1.7, 1.7, 0.22, 12), matrix: mat(x, gy + 14, z), color: '#333' });
    plainParts.push({ geo: new THREE.CylinderGeometry(0.8, 0.8, 1.3, 10), matrix: mat(x, gy + 14.8, z), color: '#e8f2f6' });
    plainParts.push({ geo: new THREE.ConeGeometry(1.0, 1.0, 10), matrix: mat(x, gy + 15.9, z), color: '#b8423a' });
    // The keeper's house beside it.
    white.push({ geo: new THREE.BoxGeometry(7, 3.2, 5), matrix: mat(x - 7.5, H(x - 7.5, z) + 1.5, z), color: '#f1ede4' });
    obstacles.push({ x, z, r: 2.4, kind: 'building', name: 'the lighthouse' }, { x: x - 7.5, z, r: 4, kind: 'building', name: 'the keeper’s house' });
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,236,190,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glow.scale.setScalar(7);
    lightBeam.position.set(x, gy + 14.8, z);
    lightBeam.add(glow);
    const beamGeo = new THREE.ConeGeometry(2.6, 70, 12, 1, true).translate(0, -35, 0).rotateZ(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: '#ffe9b8', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: true });
    for (const r of [0, Math.PI]) {
      const b = new THREE.Mesh(beamGeo, beamMat);
      b.rotation.y = r;
      lightBeam.add(b);
    }
    lightBeam.userData = { glow, beamMat };
    group.add(lightBeam);
  }

  /* ---------- Roque del Arco and Los Arcos ---------- */
  const rockMat = withCaustics(withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'ground'));
  {
    const arch = (x, y, z, yaw, R, tube, color) => {
      const g = jitterGeo(new THREE.TorusGeometry(R, tube, 6, 14, Math.PI), tube * 0.35, rnd);
      plainParts.push({ geo: g, matrix: mat(x, y, z, 0, yaw, 0), color });
    };
    // The sea arch: from the Roque's south-west foot out to a pillar of rock in the sea.
    const ax = ARCO.x - 26, az = ARCO.z + 30;
    arch(ax, -2, az, 0.8, 11, 4.2, '#3a3838');
    plainParts.push({ geo: jitterGeo(new THREE.CylinderGeometry(3.6, 5, 16, 7), 1, rnd), matrix: mat(ax - Math.cos(0.8) * 11, 4, az + Math.sin(0.8) * 11), color: '#353334' });
    for (const A of ARCHES) {
      const bed = H(A.x, A.z), tube = 2.2, R = Math.max(3, A.top - bed - tube);
      arch(A.x, bed, A.z, A.yaw, R, tube, '#38393c');
    }
  }

  /* ---------- plants, rocks and boats ---------- */
  const palms = [], tabaiba = [], cardon = [], pines = [], boulders = [], urchins = [], rocksUnder = [];
  // Palms round the square, along the waterfront and behind the beach.
  for (const [x, z] of [[-14, 6250], [-12, 6276], [-38, 6276], [2, 6286], [46, 6284], [70, 6286], [92, 6280], [-50, 6262]]) palms.push({ x, y: H(x, z) - 0.1, z, s: 0.85 + rnd() * 0.35, r: rnd() * 6.28 });
  for (let i = 0; i < 40; i++) {
    const x = PLAYA.x - PLAYA.len * 0.8 + rnd() * PLAYA.len * 1.6, z = PLAYA.z - 40 - rnd() * 40;
    const h = H(x, z);
    if (h < 2 || h > 14 || onBeach(x, z) > 0.4) continue;
    palms.push({ x, y: h - 0.1, z, s: 0.7 + rnd() * 0.45, r: rnd() * 6.28 });
  }
  // Scrub over the island: tabaiba thick in the lee low down, cardón on the rocky slopes; pines high
  // on the volcano.
  for (let i = 0; i < 26000 && tabaiba.length < 2600; i++) {
    const x = ISLE.x - 720 + rnd() * 1440, z = ISLE.z - 460 + rnd() * 900;
    const d = brasaSDF(x, z);
    if (d > -8) continue;
    const h = H(x, z);
    if (h > 230 || onBeach(x, z) > 0.2 || Math.hypot(x - VILLAGE.x, z - VILLAGE.z) < VILLAGE.r || Math.hypot(x - ARCO.x, z - ARCO.z) < ARCO.r + 6) continue;
    if (Math.abs(H(x + 2, z) - h) > 2.6) continue;
    const lee = 1 - windward(x, z), n = fbm(x * 0.02 + 9, z * 0.02, 2);
    if (rnd() > (0.25 + 0.5 * lee) * smoothstep(-0.3, 0.3, n)) continue;
    const pine = h > 130 && h < 260 && rnd() < 0.55;
    if (pine && pines.length < 380) pines.push({ x, y: h - 0.3, z, s: 0.9 + rnd() * 0.6, r: rnd() * 6.28 });
    else if (rnd() < 0.12) cardon.push({ x, y: h - 0.1, z, s: 0.8 + rnd() * 0.7, r: rnd() * 6.28 });
    else tabaiba.push({ x, y: h - 0.05, z, s: 0.7 + rnd() * 0.8, r: rnd() * 6.28 });
  }
  // Lava boulders along the shore, and the reef's boulders and urchins under the water.
  for (let i = 0; i < 30000 && (boulders.length < 1400 || rocksUnder.length < 1500); i++) {
    const x = SOUTH_MAP.x + rnd() * SOUTH_MAP.w, z = SOUTH_MAP.z + rnd() * SOUTH_MAP.h;
    const d = brasaSDF(x, z);
    if (Math.abs(d) > 120) continue;
    const h = H(x, z);
    if (Math.hypot(x - PUERTO.x, z - PUERTO.z) < PUERTO.r + 25 || onBeach(x, z) > 0.3) continue;
    // (Not on a steep face, where they'd seem stuck to the cliff.)
    if (d < 0 && d > -10 && boulders.length < 1400) {
      if (Math.abs(H(x + 1.2, z) - H(x - 1.2, z)) + Math.abs(H(x, z + 1.2) - H(x, z - 1.2)) < 2.2) boulders.push({ x, y: h - 0.2, z, s: 0.5 + rnd() * 1.4, r: rnd() * 6.28 });
    }
    else if (d > 0 && h < -1 && h > -26 && rocksUnder.length < 1500) {
      const hb = brasaHabitat(x, z, _hb);
      if (hb.rock < 0.45) continue;
      const s = 0.6 + rnd() * 1.8;
      rocksUnder.push({ x, y: h - s * 0.3, z, s, r: rnd() * 6.28 });
      // The urchins graze the rock bare round them, in their dozens.
      if (h > -16 && rnd() < 0.8) for (let k = 0; k < 4 && urchins.length < 3200; k++) {
        const ux = x + (rnd() - 0.5) * 3.5, uz = z + (rnd() - 0.5) * 3.5;
        urchins.push({ x: ux, y: H(ux, uz) + 0.04, z: uz, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28 });
      }
    }
  }
  // El Bajón's rock: big blocks and boulders of lava piled on the pinnacles and round their feet,
  // so they stand up broken and cragged (with the fans and sponges among them, below).
  {
    const c = Math.cos(BAJON.yaw), s = Math.sin(BAJON.yaw);
    for (let i = 0, n = 0; i < 1400 && n < 220; i++) {
      const u = (rnd() - 0.5) * (BAJON.len + 8), v = (rnd() - 0.5) * (BAJON.w + 4);
      const x = BAJON.x + u * c + v * s, z = BAJON.z - u * s + v * c;
      if (onBajon(x, z) < 0.35) continue;
      const h = H(x, z), sc = 0.35 + rnd() * rnd() * 1.4;
      rocksUnder.push({ x, y: h - sc * 0.55, z, s: sc, r: rnd() * 6.28 });
      n++;
    }
  }
  // The reef's colour below the surge (see the top): on El Bajón above all, round the Roque's
  // arches, and on the rock reefs and down El Veril's wall elsewhere.
  const fans = [], blacks = [], sponges = [], suns = [], anemones = [];
  {
    const FAN = ['#e8bf38', '#e8bf38', '#e9782c', '#e9782c', '#c9392d', '#a8325a', '#e8e2d2'];
    const SPONGE = ['#e8722a', '#e6c23a', '#c43a2e', '#7a3a6a', '#e88a3a'];
    const across = Math.atan2(-0.72, 0.69); // (fans stand across the current, which runs south-west)
    const tryAt = (x, z, dense) => {
      const h = H(x, z), depth = -h;
      if (depth < 3 || depth > 42) return;
      const bj = onBajon(x, z), hb = brasaHabitat(x, z, _hb);
      if (bj < 0.3 && hb.rock < 0.55) return;
      const slope = Math.abs(H(x + 0.8, z) - H(x - 0.8, z)) + Math.abs(H(x, z + 0.8) - H(x, z - 0.8));
      const r = rnd();
      if (depth > 22 && r < 0.35) blacks.push({ x, y: h - 0.05, z, s: 0.8 + rnd() * 1.1, r: rnd() * 6.28 });
      else if (depth > 5 && r < (dense ? 0.42 : 0.38)) fans.push({ x, y: h - 0.04, z, s: 0.55 + rnd() * (dense ? 1.1 : 0.8), r: across + (rnd() - 0.5) * 0.5, color: pick(FAN, rnd) });
      else if (r < 0.66) sponges.push({ x, y: h - 0.03, z, s: 0.8 + rnd() * 0.9, r: rnd() * 6.28, color: pick(SPONGE, rnd) });
      else if (slope > 1.2 && depth > 4 && r < 0.86) suns.push({ x, y: h - 0.02, z, s: 0.7 + rnd() * 0.8, r: rnd() * 6.28, color: '#f07a1e' });
      else if (depth < 20) anemones.push({ x, y: h - 0.01, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, color: pick(['#f2c3b8', '#efe6d4', '#e9a9a0'], rnd) });
    };
    // El Bajón: thick with it.
    const c = Math.cos(BAJON.yaw), s = Math.sin(BAJON.yaw);
    for (let i = 0; i < 2600; i++) {
      const u = (rnd() - 0.5) * (BAJON.len + 10), v = (rnd() - 0.5) * (BAJON.w + 6);
      tryAt(BAJON.x + u * c + v * s, BAJON.z - u * s + v * c, true);
    }
    // Round the Roque and its arches, and over the rest of the island's rock.
    for (let i = 0; i < 900; i++) tryAt(ARCO.x + (rnd() - 0.5) * 220, ARCO.z + 20 + (rnd() - 0.5) * 200, true);
    for (let i = 0; i < 26000 && fans.length + sponges.length < 3400; i++) {
      const x = SOUTH_MAP.x + rnd() * SOUTH_MAP.w, z = SOUTH_MAP.z + rnd() * SOUTH_MAP.h, d = brasaSDF(x, z);
      if (d < 8 || d > 260) continue;
      tryAt(x, z, false);
    }
  }
  // The yellow buoy over El Bajón's shallowest pinnacle, nodding on the swell.
  const buoy = new THREE.Group();
  {
    const yellow = '#e8c234';
    const g = mergeParts([
      { geo: new THREE.CylinderGeometry(0.42, 0.5, 0.9, 12), matrix: mat(0, 0.1, 0), color: yellow },
      { geo: new THREE.ConeGeometry(0.42, 0.45, 12), matrix: mat(0, 0.78, 0), color: yellow },
      { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.9, 6), matrix: mat(0, 1.3, 0), color: '#3a3d40' },
      { geo: new THREE.BoxGeometry(0.42, 0.07, 0.07), matrix: mat(0, 1.68, 0, 0, 0, 0.78), color: yellow },
      { geo: new THREE.BoxGeometry(0.42, 0.07, 0.07), matrix: mat(0, 1.68, 0, 0, 0, -0.78), color: yellow },
      { geo: new THREE.CylinderGeometry(0.52, 0.52, 0.12, 12), matrix: mat(0, -0.32, 0), color: '#2b2e33' },
    ], rnd);
    const m = new THREE.Mesh(g, plain());
    m.castShadow = true;
    buoy.add(m);
    buoy.position.set(BAJON.buoy.x, -0.15, BAJON.buoy.z);
    group.add(buoy);
  }
  // Little boats: two pulled up at the west end of the waterfront, three at moorings in the basin.
  const boats = [];
  const boatCols = ['#2c5d8a', '#b8423a', '#2f8f55', '#d9a032', '#3f7f86'];
  for (const [x, z, yaw, afloat] of [[-6, 6296, 0.3, false], [-11, 6294, -0.2, false], [20, 6330, 1.4, true], [26, 6362, 2.2, true], [8, 6360, 0.9, true]]) {
    const g = new THREE.Mesh(boatGeometry(rnd, pick(boatCols, rnd)), plain());
    g.position.set(x, afloat ? -0.25 : H(x, z) - 0.05, z);
    g.rotation.y = yaw;
    g.castShadow = true;
    g.userData = { afloat, ph: rnd() * 6 };
    group.add(g);
    boats.push(g);
    if (!afloat) obstacles.push({ x, z, r: 1.6, top: 1 });
  }

  const sway = plain();
  group.add(instanced(palmGeometry(rnd), palms, sway, rnd));
  group.add(instanced(tabaibaGeometry(rnd), tabaiba, plain(), rnd, { tint: 0.15 }));
  group.add(instanced(cardonGeometry(rnd), cardon, plain(), rnd, { tint: 0.1 }));
  group.add(instanced(pineGeometry(), pines, plain(), rnd, { tint: 0.1 }));
  const boulderGeo = mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(1, 0), 0.4, rnd), color: '#3a3839', jitter: 0.08 }], rnd);
  group.add(instanced(boulderGeo, boulders, rockMat, rnd, { tint: 0.18, tilt: 0.8 }));
  const under = instanced(boulderGeo, rocksUnder, rockMat, rnd, { tint: 0.2, tilt: 0.9, shadows: false });
  group.add(under);
  const urch = instanced(urchinGeometry(), urchins, plain(), rnd, { tint: 0.05, shadows: false });
  group.add(urch);
  // (The reef's colour thins out with the Vegetation setting: El Bajón's, placed first, stay longest.)
  const soft = withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
  const reefLife = [
    instanced(fanGeometry(rnd), fans, soft, rnd, { shadows: false }),
    instanced(blackCoralGeometry(rnd), blacks, soft, rnd, { tint: 0.08, shadows: false }),
    instanced(spongeGeometry(rnd), sponges, soft, rnd, { tilt: 0.25, shadows: false }),
    instanced(sunCoralGeometry(rnd), suns, withCaustics(plain()), rnd, { tilt: 0.5, shadows: false }),
    instanced(anemoneGeometry(), anemones, withCaustics(plain()), rnd, { shadows: false }),
  ];
  for (const m of reefLife) {
    m.userData.total = m.count;
    group.add(m);
  }
  for (const p of palms) obstacles.push({ x: p.x, z: p.z, r: 0.45 * p.s, kind: 'tree', name: 'a palm' });
  for (const c of cardon) obstacles.push({ x: c.x, z: c.z, r: 0.85 * c.s, kind: 'tree', name: 'a cardón' });
  for (const p of pines) obstacles.push({ x: p.x, z: p.z, r: 0.3 * p.s, kind: 'tree', name: 'a pine' });

  group.add(mesh(mergeParts(white, rnd), plain()));
  group.add(mesh(mergeParts(stone, rnd), withCaustics(withSurface(plain(), 'ground'))));
  group.add(mesh(mergeParts(plainParts, rnd), withCaustics(plain())));
  group.add(mesh(mergeParts(wood, rnd), plain()));
  // Windows that light up after dark.
  const glass = new THREE.MeshLambertMaterial({ vertexColors: true, emissive: new THREE.Color('#ffcf7a'), emissiveIntensity: 0 });
  const win = mesh(mergeParts(windows, rnd), glass, false);
  group.add(win);
  scene.add(group);

  return {
    group, obstacles, spots, boxes,
    setQuality(q) {
      for (const m of reefLife) m.count = Math.max(Math.min(m.userData.total, 200), Math.floor(m.userData.total * q.plants));
    },
    lights: [{ x: POSADA.x, z: POSADA.z + 8 }, { x: MOLE.x0 + 1.5, z: MOLE.z0 }],
    update(dt, t, env) {
      const night = clamp(env.lantern * 1.2, 0, 1);
      lightBeam.rotation.y = t * ((Math.PI * 2) / 10);
      lightBeam.userData.beamMat.opacity = 0.12 * night;
      lightBeam.userData.glow.material.opacity = 0.2 + 0.8 * night;
      // The harbour light flashes green every four seconds.
      harbourLight.userData.glow.material.opacity = night * (Math.sin(t * Math.PI * 0.5) > 0.6 ? 1 : 0.1);
      glass.emissiveIntensity = smoothstep(0.15, 0.6, env.night) * 0.8;
      buoy.position.y = -0.15 + Math.sin(t * 1.3) * 0.07;
      buoy.rotation.set(Math.sin(t * 0.9) * 0.06, 0, Math.sin(t * 1.1 + 1) * 0.06);
      for (const b of boats) {
        if (!b.userData.afloat) continue;
        b.position.y = -0.25 + Math.sin(t * 1.1 + b.userData.ph) * 0.05;
        b.rotation.z = Math.sin(t * 0.9 + b.userData.ph) * 0.04;
      }
    },
  };
}
