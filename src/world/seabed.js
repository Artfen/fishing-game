import * as THREE from 'three';
import { heightAt, zoneAt, waterOf, SOUTH_Z } from './terrain.js';
import { withCaustics } from './caustics.js';
import { jewelGeometry, urchinGeometry, starGeometry, cerianthusGeometry, seaPenGeometry, spongeBlob } from './divesiteWorld.js';
import { anemoneGeometry } from './brasaWorld.js';
import { mergeParts, mat, jitterGeo, hash2, seeded } from '../util.js';

// The small life of the seabed, wherever you dive at home: so the bottom is never bare. Shells
// and scallops on the sand, starfish and brittlestars, a hermit crab dragging its whelk shell,
// worm casts; deeper, burrowing anemones and sea pens; on rock, urchins, dahlia anemones, jewel
// anemones and sponges; in fresh water, stones and mussels. Laid out round the camera only while
// it's under the water, the same things in the same places every time (each spot of seabed rolls
// its own dice), and gathered up again as you swim on.

const CELL = 3;          // metres
const REACH = 27;        // how far round the camera (about as far as you can see down there)
const MAX = 420;         // of each kind at once

// A cockle or a clam: a ribbed half dome.
function shellGeometry(rnd) {
  return mergeParts([{ geo: jitterGeo(new THREE.SphereGeometry(0.05, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), 0.008, rnd), matrix: mat(0, 0, 0, 0, 0, 0, 1, 0.55, 0.85), color: '#ffffff' }], rnd);
}
// A scallop: a flat fan with ribs, its ears at the hinge.
function scallopGeometry() {
  const parts = [{ geo: new THREE.CircleGeometry(0.08, 10, -0.35, Math.PI + 0.7).rotateX(-Math.PI / 2), matrix: mat(0, 0.012, 0.02), color: '#ffffff' }];
  for (let i = 0; i < 7; i++) {
    const a = -0.35 + (i / 6) * (Math.PI + 0.7);
    parts.push({ geo: new THREE.BoxGeometry(0.075, 0.012, 0.008), matrix: mat(Math.cos(a) * 0.04, 0.016, 0.02 - Math.sin(a) * 0.04, 0, a, 0), color: '#e8d8c8' });
  }
  parts.push({ geo: new THREE.BoxGeometry(0.07, 0.01, 0.02), matrix: mat(0, 0.008, 0.025), color: '#d8c8b0' });
  return mergeParts(parts);
}
// A brittlestar: a small disc and five long, thin, wriggling arms.
function brittleGeometry(rnd) {
  const parts = [{ geo: new THREE.CylinderGeometry(0.03, 0.03, 0.012, 8), matrix: mat(0, 0.008, 0), color: '#ffffff' }];
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2;
    let x = 0, z = 0, h = a;
    for (let k = 0; k < 4; k++) {
      h += (rnd() - 0.5) * 0.8;
      const len = 0.05;
      parts.push({ geo: new THREE.BoxGeometry(len, 0.008, 0.009), matrix: mat(x + Math.cos(h) * len * 0.5, 0.006, z - Math.sin(h) * len * 0.5, 0, h, 0), color: '#ffffff' });
      x += Math.cos(h) * len;
      z -= Math.sin(h) * len;
    }
  }
  return mergeParts(parts);
}
// A hermit crab in a whelk shell, its claws out.
function hermitGeometry() {
  return mergeParts([
    { geo: new THREE.ConeGeometry(0.04, 0.11, 7), matrix: mat(0, 0.035, -0.02, -Math.PI / 2 + 0.3, 0, 0), color: '#d8cdb8' },
    { geo: new THREE.SphereGeometry(0.035, 7, 5), matrix: mat(0, 0.03, 0.02), color: '#c9b9a0' },
    { geo: new THREE.SphereGeometry(0.018, 5, 4), matrix: mat(0.025, 0.02, 0.06), color: '#b8603a' },
    { geo: new THREE.SphereGeometry(0.022, 5, 4), matrix: mat(-0.025, 0.02, 0.062), color: '#b8603a' },
  ]);
}
// A stone, or a cobble.
function stoneGeometry(rnd) {
  return mergeParts([{ geo: jitterGeo(new THREE.DodecahedronGeometry(0.1, 0), 0.04, rnd), matrix: mat(0, 0.03, 0, 0, 0, 0, 1.2, 0.55, 1), color: '#ffffff' }], rnd);
}
// A mussel: long, dark and closed.
function musselGeometry() {
  return mergeParts([{ geo: new THREE.SphereGeometry(0.05, 7, 4), matrix: mat(0, 0.012, 0, 0, 0, 0, 0.45, 0.3, 1), color: '#ffffff' }]);
}
// A worm cast: a little coil of sand.
function castGeometry() {
  return mergeParts([{ geo: new THREE.TorusGeometry(0.03, 0.012, 4, 9, Math.PI * 3.2), matrix: mat(0, 0.01, 0, Math.PI / 2, 0, 0), color: '#ffffff' }]);
}

const KINDS = {
  shell: { geo: shellGeometry, colors: ['#e8dcc8', '#d8c0a0', '#f0e8dc', '#c8a888'] },
  scallop: { geo: scallopGeometry, colors: ['#d88a6a', '#e8c0a0', '#c87060', '#e0b090'] },
  star: { geo: starGeometry, colors: ['#e0782e', '#d8672e', '#c86a3a', '#a35a8a'] },
  brittle: { geo: brittleGeometry, colors: ['#a08a7a', '#8a7a8a', '#b09a88'] },
  hermit: { geo: hermitGeometry, colors: ['#ffffff'] },
  stone: { geo: stoneGeometry, colors: ['#8a857a', '#7a756c', '#9a9284', '#6a665e'] },
  cast: { geo: castGeometry, colors: ['#c8b890', '#b8a880'] },
  ceri: { geo: cerianthusGeometry, colors: ['#efe6d6', '#d9a070', '#9a7ab8'] },
  pen: { geo: seaPenGeometry, colors: ['#e8a090', '#f0c0a8'] },
  urchin: { geo: urchinGeometry, colors: ['#c46f8a', '#b45e86', '#d08a8a'] },
  dahlia: { geo: anemoneGeometry, colors: ['#c7404c', '#d8625a', '#e0a07a'] },
  jewel: { geo: jewelGeometry, colors: ['#ef6fa4', '#7fd59a', '#f2a04e', '#b98ae6'] },
  sponge: { geo: spongeBlob, colors: ['#d9b43a', '#e0a83a'] },
  mussel: { geo: musselGeometry, colors: ['#2a2c38', '#30303a'] },
};

// What lies on a spot of seabed (if anything), from what the bottom is there: kind names.
// s: a habitat sample; salt: in the sea; u: a die (0 … 1).
export function seabedKind(s, salt, u) {
  const d = s.depth;
  if (d < 0.8) return null;
  if (!salt) return u < 0.22 ? 'stone' : u < 0.3 ? 'mussel' : null;
  if (s.rock > 0.35) return u < 0.18 ? 'urchin' : u < 0.3 ? 'dahlia' : u < 0.4 && d > 5 ? 'jewel' : u < 0.46 ? 'star' : u < 0.5 ? 'sponge' : u < 0.62 ? 'stone' : null;
  if (s.weed > 0.4) return u < 0.12 ? 'shell' : u < 0.2 ? 'star' : u < 0.26 ? 'urchin' : null;
  // Sand: busier the deeper you go (and out of the surf).
  const k = Math.min(1, 0.45 + d / 30);
  if (u > k) return null;
  const v = u / k;
  if (v < 0.24) return 'shell';
  if (v < 0.34) return 'cast';
  if (v < 0.44) return d > 4 ? 'scallop' : 'shell';
  if (v < 0.54) return 'star';
  if (v < 0.66) return d > 7 ? 'brittle' : 'cast';
  if (v < 0.71) return 'hermit';
  if (v < 0.79) return d > 8 ? 'ceri' : 'stone';
  if (v < 0.86) return d > 13 ? 'pen' : 'shell';
  return 'stone';
}

export class Seabed {
  constructor(scene, habitat) {
    this.habitat = habitat;
    this.cx = Infinity;
    this.cz = Infinity;
    const rnd = seeded(20261027);
    const material = withCaustics(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.meshes = {};
    for (const [k, K] of Object.entries(KINDS)) {
      const m = new THREE.InstancedMesh(K.geo(rnd), material, MAX);
      m.count = 0;
      m.frustumCulled = false;
      m.visible = false;
      m.setColorAt(0, new THREE.Color());
      scene.add(m);
      this.meshes[k] = m;
    }
    this.on = false;
    // Where each kind lies just now: flat [x, y, z, …] (for what you're close to, see kindsNear).
    this.at = {};
  }

  // Each frame: laid out round the camera while it's under the water at home, else put away.
  update(camera, sub) {
    const cp = camera.position;
    const on = sub > 0.02 && cp.z < SOUTH_Z - 400;
    if (on !== this.on) {
      this.on = on;
      for (const m of Object.values(this.meshes)) m.visible = on;
    }
    if (!on) {
      this.cx = Infinity;
      return;
    }
    if (Math.hypot(cp.x - this.cx, cp.z - this.cz) < 4) return;
    this.cx = cp.x;
    this.cz = cp.z;
    this.layOut(cp.x, cp.z);
  }

  layOut(px, pz) {
    const counts = {}, s = {};
    for (const k in this.meshes) {
      counts[k] = 0;
      this.at[k] = [];
    }
    const o = new THREE.Object3D(), c = new THREE.Color();
    const i0 = Math.floor((px - REACH) / CELL), i1 = Math.floor((px + REACH) / CELL);
    const j0 = Math.floor((pz - REACH) / CELL), j1 = Math.floor((pz + REACH) / CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x0 = (i + 0.5) * CELL, z0 = (j + 0.5) * CELL;
        if (Math.hypot(x0 - px, z0 - pz) > REACH) continue;
        // Up to two things in a cell.
        for (let n = 0; n < 2; n++) {
          const u = hash2(i * 7 + n * 131, j * 11 - n * 71);
          if (n === 1 && u > 0.5) break;
          const x = x0 + (hash2(i + 913 * n, j - 37) - 0.5) * CELL, z = z0 + (hash2(i - 59, j + 401 * n) - 0.5) * CELL;
          this.habitat.sample(x, z, s);
          const kind = seabedKind(s, waterOf(zoneAt(x, z)) !== 'fresh', hash2(i * 3 + 17 * n, j * 5 + 3));
          if (!kind || counts[kind] >= MAX) continue;
          const K = KINDS[kind], m = this.meshes[kind], at = counts[kind]++;
          const w = hash2(i + 7, j + 13 * n);
          const tilt = kind === 'pen' || kind === 'ceri' ? 0.08 : 0.25;
          o.position.set(x, heightAt(x, z) - 0.005, z);
          this.at[kind].push(o.position.x, o.position.y, o.position.z);
          o.rotation.set((w - 0.5) * tilt, w * 40, (hash2(j, i) - 0.5) * tilt);
          o.scale.setScalar(0.75 + w * 0.6);
          o.updateMatrix();
          m.setMatrixAt(at, o.matrix);
          c.set(K.colors[Math.floor(w * 977) % K.colors.length]).multiplyScalar(0.9 + hash2(i - j, n) * 0.2);
          m.setColorAt(at, c);
        }
      }
    }
    for (const [k, m] of Object.entries(this.meshes)) {
      m.count = counts[k];
      m.userData.kind = k;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  // The kinds lying within r of p (while you're under the water), into `out`.
  kindsNear(p, r, out = new Set()) {
    if (!this.on) return out;
    for (const [k, a] of Object.entries(this.at)) {
      if (out.has(k)) continue;
      for (let i = 0; i < a.length; i += 3) {
        if (Math.abs(a[i] - p.x) < r && Math.abs(a[i + 2] - p.z) < r && Math.hypot(a[i] - p.x, a[i + 1] - p.y, a[i + 2] - p.z) < r) {
          out.add(k);
          break;
        }
      }
    }
    return out;
  }
}
