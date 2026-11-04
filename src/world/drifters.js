import * as THREE from 'three';
import { heightAt, zoneAt, waterOf, SOUTH_Z } from './terrain.js';
import { yearPhase } from './season.js';
import { mergeParts, mat, hash2, seeded, clamp } from '../util.js';

// The life of the open water between the fish's haunts, so the water's never empty when you're
// down in it: jellyfish drifting and pulsing (moon jellies and compass jellies at home in the
// warm months, the odd mauve stinger at Las Brasas all year), and shoals of small fry (sand smelt
// at home over the shallow sand and weed, silversides over the island's reef) that wheel about
// and scatter as you come close. Like the seabed's (seabed.js), laid out round the camera while
// it's under the water, the same in the same places for the same week, and gathered up again as
// you swim on. Nothing here bites: it's the sea's own life, for the eye (and the naturalist's
// notes, see grounds.js).

const CELL = 14;        // metres
const REACH = 42;       // round the camera
const MAX_JELLY = 40;
const SHOALS = 6;       // shoals of fry at once
const FRY = 28;         // in each

// How likely a jellyfish in a cell is, by the time of year (0 … 1 through it; see season.js).
// Moon jellies come with the warm water (summer into autumn), compass jellies at summer's end.
export function jellyChance(kind, phase) {
  if (kind === 'stinger') return 0.06;
  const warm = Math.max(0, Math.cos(Math.PI * 2 * (phase - 0.45)));
  return kind === 'moonjelly' ? 0.16 * warm * warm : 0.07 * Math.max(0, Math.cos(Math.PI * 2 * (phase - 0.52))) ** 3;
}

function bellGeometry(rnd, rings) {
  const parts = [{ geo: new THREE.SphereGeometry(0.16, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(0, 0, 0, 0, 0, 0, 1, 0.55, 1), color: '#ffffff' }];
  // (Four pale rings: a moon jelly's gonads; a compass jelly's marks are its colour.)
  if (rings) for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2;
    parts.push({ geo: new THREE.TorusGeometry(0.03, 0.007, 4, 10), matrix: mat(Math.cos(a) * 0.05, 0.06, Math.sin(a) * 0.05, Math.PI / 2, 0, 0), color: '#f4d6e8' });
  }
  // Tentacles and oral arms, hanging.
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2, len = 0.18 + rnd() * 0.25;
    parts.push({ geo: new THREE.CylinderGeometry(0.003, 0.002, len, 3).translate(0, -len / 2, 0), matrix: mat(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12), color: '#ffffff' });
  }
  return mergeParts(parts, rnd);
}

function fryGeometry() {
  return mergeParts([
    { geo: new THREE.ConeGeometry(0.012, 0.075, 4), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0, 1, 1, 1), color: '#ffffff' },
    { geo: new THREE.BoxGeometry(0.002, 0.016, 0.02), matrix: mat(0, 0, -0.045), color: '#ffffff' },
  ]);
}

const JELLIES = {
  moonjelly: { colour: '#d8e8f4', rings: true, size: [0.8, 1.4] },
  compass: { colour: '#f0dcc4', rings: false, size: [0.9, 1.5] },
  stinger: { colour: '#d8a8d8', rings: false, size: [0.45, 0.7] },
};

export class Drifters {
  constructor(scene, habitat) {
    this.habitat = habitat;
    const rnd = seeded(20261104);
    const mk = (geo, max, opacity) => {
      const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide }), max);
      m.count = 0;
      m.frustumCulled = false;
      m.visible = false;
      m.setColorAt(0, new THREE.Color());
      scene.add(m);
      return m;
    };
    this.jellyMesh = { moonjelly: mk(bellGeometry(rnd, true), MAX_JELLY, 0.45), compass: mk(bellGeometry(rnd, false), MAX_JELLY, 0.6), stinger: mk(bellGeometry(rnd, false), MAX_JELLY, 0.6) };
    this.fryMesh = mk(fryGeometry(), SHOALS * FRY, 0.95);
    this.fryMesh.material.transparent = false;
    this.fryMesh.material.depthWrite = true;
    this.jellies = [];  // { kind, x, y, z, size, phase, spin }
    this.shoals = [];   // { kind, x, y, z, r, fry: [{ a, h, rr, sp }], fleeX, fleeZ, scare }
    this.cx = Infinity;
    this.cz = Infinity;
    this.week = -1;
    this.on = false;
    this.at = {};       // kind -> [x, y, z, …] (for the notes: kindsNear)
    this._o = new THREE.Object3D();
    this._c = new THREE.Color();
  }

  // Each frame. sub: how far under the water the camera is (0 … 1); abs: the world's time.
  update(dt, t, camera, sub, abs) {
    const cp = camera.position;
    const on = sub > 0.02;
    if (on !== this.on) {
      this.on = on;
      for (const m of [...Object.values(this.jellyMesh), this.fryMesh]) m.visible = on;
    }
    if (!on) {
      this.cx = Infinity;
      return;
    }
    const week = Math.floor(abs / (24 * 7));
    if (Math.hypot(cp.x - this.cx, cp.z - this.cz) > 6 || week !== this.week) {
      this.cx = cp.x;
      this.cz = cp.z;
      this.week = week;
      this.layOut(cp.x, cp.z, abs);
    }
    this.animate(dt, t, cp);
  }

  layOut(px, pz, abs) {
    const south = pz > SOUTH_Z, phase = yearPhase(abs), wk = this.week;
    const s = {};
    this.jellies = [];
    const shoals = [];
    const i0 = Math.floor((px - REACH) / CELL), i1 = Math.floor((px + REACH) / CELL);
    const j0 = Math.floor((pz - REACH) / CELL), j1 = Math.floor((pz + REACH) / CELL);
    for (let j = j0; j <= j1; j++) {
      for (let i = i0; i <= i1; i++) {
        const x = (i + hash2(i + 3, j - 5)) * CELL, z = (j + hash2(i - 11, j + 7)) * CELL;
        if (Math.hypot(x - px, z - pz) > REACH) continue;
        if (!south && waterOf(zoneAt(x, z)) === 'fresh') continue;
        this.habitat.sample(x, z, s);
        if (s.depth < 1.2) continue;
        // (Each week a cell rolls new dice: the jellies drift on, the shoals move about.)
        const u = hash2(i * 13 + wk * 101, j * 17 - wk * 37), v = hash2(i * 5 - wk * 7, j * 3 + wk * 11);
        const kinds = south ? ['stinger'] : ['moonjelly', 'compass'];
        for (const kind of kinds) {
          if (this.jellies.length >= MAX_JELLY * 2 || u > jellyChance(kind, phase)) continue;
          const J = JELLIES[kind];
          this.jellies.push({ kind, x, z, y: -Math.min(s.depth - 0.6, 0.6 + v * Math.min(8, s.depth)), size: J.size[0] + v * (J.size[1] - J.size[0]), phase: u * 40, spin: v * 6 });
          break;
        }
        // Fry: over the shallows (sand and weed at home, the reef's edge at Las Brasas).
        const fryHere = south ? s.depth < 14 && (s.rock > 0.2 || s.weed > 0.2) : s.depth < 7 && s.rock < 0.4;
        const fryChance = south ? 0.18 : 0.12 * (0.35 + 0.65 * Math.max(0, Math.cos(Math.PI * 2 * (phase - 0.4))));
        if (fryHere && v < fryChance) shoals.push({ kind: 'fry', x, z, y: -Math.min(s.depth * 0.55, 3), floor: heightAt(x, z), d: Math.hypot(x - px, z - pz), seed: i * 31 + j * 17 });
      }
    }
    // The nearest few shoals (they're the ones you'd see).
    shoals.sort((a, b) => a.d - b.d);
    const keep = new Map(this.shoals.map((S) => [S.seed, S]));
    this.shoals = shoals.slice(0, SHOALS).map((S) => {
      const old = keep.get(S.seed);
      if (old) return old;
      const r = seeded(S.seed + 7);
      return {
        ...S, cx: S.x, cz: S.z, scare: 0,
        fry: Array.from({ length: FRY }, () => ({ a: r() * Math.PI * 2, h: (r() - 0.5) * 0.8, rr: 0.35 + r() * 0.9, sp: 0.6 + r() * 0.6 })),
      };
    });
    // Where they are, for the naturalist's notes.
    this.at = {};
    for (const J of this.jellies) (this.at[J.kind] ||= []).push(J.x, J.y, J.z);
    for (const S of this.shoals) (this.at.fry ||= []).push(S.x, S.y, S.z);
  }

  animate(dt, t, cp) {
    const o = this._o, c = this._c;
    // Jellyfish: pulsing slowly, drifting a little, turning.
    const counts = { moonjelly: 0, compass: 0, stinger: 0 };
    for (const J of this.jellies) {
      const m = this.jellyMesh[J.kind], k = counts[J.kind];
      if (k >= MAX_JELLY) continue;
      counts[J.kind]++;
      const pulse = Math.sin(t * 1.6 + J.phase);
      o.position.set(J.x + Math.sin(t * 0.05 + J.phase) * 1.5, J.y + Math.sin(t * 0.3 + J.phase) * 0.25 + Math.max(0, pulse) * 0.05, J.z + Math.cos(t * 0.04 + J.spin) * 1.5);
      o.rotation.set(0.15 * Math.sin(t * 0.2 + J.spin), t * 0.05 + J.spin, 0.12 * Math.cos(t * 0.17 + J.phase));
      o.scale.set(J.size * (1 + 0.08 * pulse), J.size * (1 - 0.12 * pulse), J.size * (1 + 0.08 * pulse));
      o.updateMatrix();
      m.setMatrixAt(k, o.matrix);
      m.setColorAt(k, c.set(JELLIES[J.kind].colour));
    }
    for (const [kind, m] of Object.entries(this.jellyMesh)) {
      m.count = counts[kind];
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Fry: each shoal wheels round its centre; come within a few metres and it bolts away from you,
    // then drifts back.
    let n = 0;
    for (const S of this.shoals) {
      const dx = S.cx - cp.x, dz = S.cz - cp.z, d = Math.hypot(dx, dz);
      if (d < 4 && Math.abs(S.y - cp.y) < 3) S.scare = 1;
      S.scare = Math.max(0, S.scare - dt * 0.25);
      if (S.scare > 0.5 && d > 0.01) {
        S.cx += (dx / d) * dt * 2.5;
        S.cz += (dz / d) * dt * 2.5;
      } else {
        S.cx += (S.x - S.cx) * clamp(dt * 0.15, 0, 1);
        S.cz += (S.z - S.cz) * clamp(dt * 0.15, 0, 1);
      }
      const tight = 1 - 0.45 * S.scare;
      for (const f of S.fry) {
        if (n >= SHOALS * FRY) break;
        const a = f.a + t * f.sp * (1 + S.scare * 2);
        const r = f.rr * tight;
        o.position.set(S.cx + Math.cos(a) * r * 1.4, Math.max(S.floor + 0.3, S.y + f.h * tight + Math.sin(t * 0.9 + f.a) * 0.08), S.cz + Math.sin(a) * r);
        o.rotation.set(0, -a, 0);
        o.scale.setScalar(1);
        o.updateMatrix();
        this.fryMesh.setMatrixAt(n, o.matrix);
        this.fryMesh.setColorAt(n, c.setRGB(0.8, 0.86, 0.9));
        n++;
      }
    }
    this.fryMesh.count = n;
    this.fryMesh.instanceMatrix.needsUpdate = true;
    if (this.fryMesh.instanceColor) this.fryMesh.instanceColor.needsUpdate = true;
  }

  // The kinds within r of p (for the notes), into `out`.
  kindsNear(p, r, out = new Set()) {
    if (!this.on) return out;
    for (const [k, a] of Object.entries(this.at)) {
      if (out.has(k)) continue;
      for (let i = 0; i < a.length; i += 3) {
        if (Math.hypot(a[i] - p.x, a[i + 1] - p.y, a[i + 2] - p.z) < r) {
          out.add(k);
          break;
        }
      }
    }
    return out;
  }
}
