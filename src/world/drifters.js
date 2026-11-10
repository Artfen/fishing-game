import * as THREE from 'three';
import { heightAt, zoneAt, waterOf, SOUTH_Z } from './terrain.js';
import { yearPhase } from './season.js';
import { mergeParts, mat, hash2, seeded, clamp, dampAngle, wrapAngle, damp } from '../util.js';
import { FISH, buildFishGeometry, fishMaterial } from '../fish.js';
import { siteById, PINNACLES, pinnacleRadius } from './divesites.js';

// The life of the open water between the fish's haunts, so the water's never empty when you're
// down in it: jellyfish drifting and pulsing (moon jellies and compass jellies at home in the
// warm months, the odd mauve stinger at Las Brasas all year), and shoals of small fry (sand smelt
// at home over the shallow sand and weed, silversides over the island's reef) that wheel about
// and scatter as you come close. Like the seabed's (seabed.js), laid out round the camera while
// it's under the water, the same in the same places for the same week, and gathered up again as
// you swim on. Nothing here bites: it's the sea's own life, for the eye (and the naturalist's
// notes, see grounds.js).
//
// And the reef's small fish: the everyday life a diver swims among, which nobody fishes for here
// (the fish you catch are the ecosystem's, a different matter: see ecosystem.js). By what's
// below: wrasse hanging over the rocks, two-banded bream and young pollack round them, salema
// grazing over the weed, a shoal of bogue in the open water, horse mackerel passing over deeper
// ground, grey mullet over the shallow sand; at Las Brasas, clouds of chromis over the reef,
// ornate wrasse and parrotfish. Drawn with the fish's own shapes and colours (fish.js), each
// shoal milling about its patch, shy of you (come close and it moves off, then drifts back),
// laid out the same in the same places for the week, more of them on higher graphics.

const CELL = 14;        // metres
const REACH = 42;       // round the camera
const MAX_JELLY = 40;
const SHOALS = 10;      // shoals of fry at once
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

// The reef's fish, by sea: which kind, how likely a patch of seabed (CELL square) has a group of
// them (from what's there: rock, weed, depth), how many in it, how they move (hover: each alone,
// near the bottom by the rocks; shoal: together round a centre a little above it; mid: a shoal in
// the open water), how big (a share of the kind's size range), and whether it comes to look at a
// diver who keeps still (curious: wrasse and bream do).
export const REEF = {
  home: [
    { sp: 'wrasse', chance: (s) => 0.85 * s.rock, n: [1, 3], mode: 'hover', size: [0.3, 0.8], curious: true },
    { sp: 'twobanded', chance: (s) => 0.7 * s.rock, n: [4, 9], mode: 'shoal', size: [0.2, 0.7], curious: true },
    { sp: 'pollack', chance: (s) => (s.depth > 4 ? 0.45 * s.rock : 0), n: [3, 6], mode: 'shoal', size: [0.1, 0.4] },
    { sp: 'salema', chance: (s) => 0.8 * s.weed, n: [6, 16], mode: 'shoal', size: [0.2, 0.7] },
    { sp: 'blackbream', chance: (s) => 0.35 * Math.max(s.rock, s.weed), n: [3, 8], mode: 'shoal', size: [0.2, 0.7], curious: true },
    { sp: 'bogue', chance: (s) => (s.depth > 3 ? 0.22 : 0.06), n: [8, 20], mode: 'mid', size: [0.2, 0.8] },
    { sp: 'mullet', chance: (s) => (s.depth < 6 ? 0.25 * (1 - s.rock) : 0), n: [3, 6], mode: 'shoal', size: [0.2, 0.7] },
    { sp: 'horsemackerel', chance: (s) => (s.depth > 6 ? 0.07 : 0), n: [12, 26], mode: 'mid', size: [0, 0.4] },
    { sp: 'sandsmelt', chance: (s) => (s.depth < 10 ? 0.3 * (1 - s.rock) : 0.05), n: [14, 30], mode: 'mid', size: [0.2, 1] },
    { sp: 'gurnard', chance: (s) => 0.12 * (1 - s.rock) * (1 - s.weed), n: [1, 2], mode: 'hover', size: [0.1, 0.5] },
  ],
  south: [
    { sp: 'chromis', chance: (s) => 0.9 * s.rock, n: [10, 24], mode: 'shoal', size: [0.3, 1], curious: true },
    { sp: 'ornatewrasse', chance: (s) => 0.8 * s.rock, n: [1, 3], mode: 'hover', size: [0.3, 0.9], curious: true },
    { sp: 'parrotfish', chance: (s) => 0.45 * s.rock, n: [2, 4], mode: 'hover', size: [0.3, 0.8] },
    { sp: 'salema', chance: (s) => 0.7 * s.weed, n: [6, 16], mode: 'shoal', size: [0.2, 0.7] },
    { sp: 'twobanded', chance: (s) => 0.45 * s.rock, n: [4, 9], mode: 'shoal', size: [0.2, 0.7], curious: true },
    { sp: 'bogue', chance: (s) => (s.depth > 3 ? 0.2 : 0.05), n: [8, 20], mode: 'mid', size: [0.2, 0.8] },
  ],
};
const REEF_CELL = 7;     // metres: the reef's fish are laid out finer, and nearer,
const REEF_REACH = 24;   // than the jellies (you only see so far down there)
const REEF_GROUPS = 64;  // the nearest this many groups are kept (they're the ones you'd see)
const REEF_MAX = 160;    // of any one kind at once

// Turning a fish (or a whole shoal, o.heading) towards a heading: easing in at `rate`, never faster
// than `most` rad/s. o.wind keeps how far round it has come since it last settled; with `unwind`, a
// turn that would carry it on past half a turn the same way goes back round the way it came instead,
// so a fish that turned away from you and comes back to what it was doing never makes a full circle
// of it. (Settled, facing where it wants to within a few degrees, it starts counting afresh.)
function turnTo(o, key, to, rate, most, dt, unwind = false) {
  let d = wrapAngle(to - o[key]);
  const w = o.wind || 0;
  if (unwind && Math.sign(d) === Math.sign(w) && Math.abs(w + d) > Math.PI) d -= Math.sign(d) * Math.PI * 2;
  const step = clamp(d * (1 - Math.exp(-rate * dt)), -most * dt, most * dt);
  o[key] = wrapAngle(o[key] + step);
  o.wind = Math.abs(d) < 0.15 ? 0 : clamp(w + step, -Math.PI * 2, Math.PI * 2);
}

// What the dive sites are, for their fish: their rock and kelp are their own (divesiteWorld.js),
// not in the habitat's map, so Skerries Reef reads as rock, the Kelp Forest as weed with boulders
// under it, the Kittiwake as rock (fish hang over a wreck as over a reef) and the Hound as rock,
// fading out over the last few metres of each.
const SITE_LIFE = [
  { id: 'reef', rock: 0.95, weed: 0.35 },
  { id: 'kelp', rock: 0.3, weed: 0.95 },
  { id: 'wreck', rock: 0.9, weed: 0 },
  { id: 'hound', rock: 0.9, weed: 0.1 },
];
export function siteLife(x, z, s) {
  for (const L of SITE_LIFE) {
    const S = siteById[L.id];
    if (!S) continue;
    const f = clamp((S.r + 4 - Math.hypot(x - S.x, z - S.z)) / 8, 0, 1);
    if (f <= 0) continue;
    s.rock = Math.max(s.rock, L.rock * f);
    s.weed = Math.max(s.weed, L.weed * f);
  }
  return s;
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
    // The reef's fish: an instanced mesh for each kind, swimming with the fish's own tail beat
    // (each made the first time that kind is wanted, down in the water).
    this.scene = scene;
    this.reefMesh = {};
    this.reef = [];     // groups: { sp, mode, x, z, floor, top, y, fish: [...], cx, cz, shy, seed }
    this.density = 1;   // (the graphics setting's: fewer fish on lower settings)
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

  // Each frame. sub: how far under the water the camera is (0 … 1); abs: the world's time; diver:
  // where the diver is, when you're diving (it's the diver the fish are shy of, and come to look at,
  // not the camera following a few metres behind).
  update(dt, t, camera, sub, abs, diver = null) {
    const cp = camera.position;
    const on = sub > 0.02;
    if (on !== this.on) {
      this.on = on;
      for (const m of [...Object.values(this.jellyMesh), this.fryMesh]) m.visible = on;
      if (!on) for (const R of Object.values(this.reefMesh)) if (R) R.m.visible = false;
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
    this.animate(dt, t, diver || cp);
  }

  layOut(px, pz, abs) {
    const south = pz > SOUTH_Z, phase = yearPhase(abs), wk = this.week;
    const s = {};
    this.jellies = [];
    const shoals = [], reef = [];
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
        const fryHere = south ? s.depth < 14 && (s.rock > 0.2 || s.weed > 0.2) : s.depth < 9 && s.rock < 0.75;
        const fryChance = south ? 0.3 : 0.32 * (0.5 + 0.5 * Math.max(0, Math.cos(Math.PI * 2 * (phase - 0.4))));
        if (fryHere && v < fryChance) shoals.push({ kind: 'fry', x, z, y: -Math.min(s.depth * 0.55, 3), floor: heightAt(x, z), d: Math.hypot(x - px, z - pz), seed: i * 31 + j * 17 });
      }
    }
    // The reef's fish: on a finer grid nearer you, each kind that suits each patch, by its dice.
    const ri0 = Math.floor((px - REEF_REACH) / REEF_CELL), ri1 = Math.floor((px + REEF_REACH) / REEF_CELL);
    const rj0 = Math.floor((pz - REEF_REACH) / REEF_CELL), rj1 = Math.floor((pz + REEF_REACH) / REEF_CELL);
    for (let j = rj0; j <= rj1; j++) {
      for (let i = ri0; i <= ri1; i++) {
        const x = (i + 0.5) * REEF_CELL, z = (j + 0.5) * REEF_CELL;
        if (Math.hypot(x - px, z - pz) > REEF_REACH) continue;
        if (!south && waterOf(zoneAt(x, z)) === 'fresh') continue;
        this.habitat.sample(x, z, s);
        if (s.depth < 1.5) continue;
        if (!south) siteLife(x, z, s);
        (south ? REEF.south : REEF.home).forEach((R, k) => {
          const w = hash2(i * 19 + k * 7 + wk * 13, j * 23 - k * 5 + wk * 29);
          if (w < R.chance(s) * this.density) reef.push({ R, x: x + (hash2(i + k, j - k) - 0.5) * REEF_CELL * 0.8, z: z + (hash2(i - k, j + k) - 0.5) * REEF_CELL * 0.8, depth: s.depth, d: Math.hypot(x - px, z - pz), seed: (i * 73856093) ^ (j * 19349663) ^ (k * 83492791) });
        });
      }
    }
    this.layReef(reef);
    // The nearest few shoals (they're the ones you'd see).
    shoals.sort((a, b) => a.d - b.d);
    const keep = new Map(this.shoals.map((S) => [S.seed, S]));
    this.shoals = shoals.slice(0, SHOALS).map((S) => {
      const old = keep.get(S.seed);
      if (old) return old;
      const r = seeded(S.seed + 7);
      return {
        ...S, cx: S.x, cz: S.z, scare: 0, heading: r() * Math.PI * 2, ph: r() * Math.PI * 2,
        fry: Array.from({ length: FRY }, () => ({ a: r() * Math.PI * 2, h: (r() - 0.5) * 0.8, rr: 0.35 + r() * 0.9, sp: 0.6 + r() * 0.6, yaw: 0 })),
      };
    });
    // Where they are, for the naturalist's notes.
    this.at = {};
    for (const J of this.jellies) (this.at[J.kind] ||= []).push(J.x, J.y, J.z);
    for (const S of this.shoals) (this.at.fry ||= []).push(S.x, S.y, S.z);
  }

  // A kind's mesh (made the first time it's wanted), or null if the game has no such fish.
  reefMeshFor(id) {
    if (id in this.reefMesh) return this.reefMesh[id];
    const sp = FISH.find((f) => f.id === id && !f.retired);
    if (!sp) return (this.reefMesh[id] = null);
    const geo = buildFishGeometry(sp, false).clone();
    // (Phase, effort and bend: see fishRender.js.)
    const swim = new THREE.InstancedBufferAttribute(new Float32Array(REEF_MAX * 3), 3);
    swim.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('aSwim', swim);
    const m = new THREE.InstancedMesh(geo, fishMaterial(sp, true), REEF_MAX);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    m.visible = false;
    this.scene.add(m);
    return (this.reefMesh[id] = { m, swim, sp });
  }

  // The reef's groups: the nearest kept (those already about stay as they are), each given its
  // fish.
  layReef(found) {
    found.sort((a, b) => a.d - b.d);
    const keep = new Map(this.reef.map((G) => [G.seed, G]));
    this.reef = found.slice(0, REEF_GROUPS).map((F) => {
      const old = keep.get(F.seed);
      if (old) return old;
      const R = F.R, r = seeded((F.seed >>> 0) + 11), floor = heightAt(F.x, F.z);
      // (Its patch, where it actually is, has to have water enough over it.)
      if (floor > -1.4) return null;
      const sp = this.reefMeshFor(R.sp)?.sp;
      if (!sp) return null;
      const n = R.n[0] + Math.floor(r() * (R.n[1] - R.n[0] + 1));
      // How high: hovering just off the bottom, a shoal a little above it, or out in the open water.
      const top = -0.6, low = floor + 0.35;
      // (Out in the open water a shoal may be anywhere between the bottom and the top: some up near
      // you as you swim along the surface.)
      let y = R.mode === 'hover' ? low + 0.4 : R.mode === 'shoal' ? Math.min(top, floor + 1 + r() * 1.6) : Math.min(top, floor + 1.5 + r() * Math.max(0, -floor - 2.3));
      let x = F.x, z = F.z, ground = low, wall = false;
      // By the Hound or its Pup, the rock's fish keep to the walls, at any height up them (on the
      // ledges and in the cracks, not down on the sand thirty metres under), just off the rock.
      if (R.mode !== 'mid') {
        for (const P of PINNACLES) {
          const a = Math.atan2(F.z - P.z, F.x - P.x);
          if (Math.hypot(F.x - P.x, F.z - P.z) > P.base * 1.5) continue;
          const h = 1 + r() * Math.max(0, Math.min(P.top, -P.bed - 2.5) - 1);
          // (Far enough off that their circling doesn't take them into it, and staying put.)
          const w = pinnacleRadius(P, h, a) + 3.2;
          x = P.x + Math.cos(a) * w;
          z = P.z + Math.sin(a) * w;
          y = Math.min(top, P.bed + h);
          ground = Math.min(y, P.bed + h - 1.2);
          wall = true;
          break;
        }
      }
      const range = (u) => sp.size[0] + (sp.size[1] - sp.size[0]) * (R.size[0] + (R.size[1] - R.size[0]) * u);
      return {
        sp: R.sp, mode: R.mode, curious: !!R.curious, x, z, floor, low: ground, top, y, cx: x, cz: z, shy: 0, look: 0, seed: F.seed,
        wander: wall ? 0.6 : 1.5 + r() * (R.mode === 'mid' ? 5 : 2.5), w1: 0.04 + r() * 0.05, w2: 0.03 + r() * 0.05, p1: r() * 6.3, p2: r() * 6.3,
        fish: Array.from({ length: n }, () => ({
          a: r() * Math.PI * 2, rr: (R.mode === 'hover' ? 0.8 : 0.5) + r() * (R.mode === 'hover' ? 2.2 : 1.6), h: (r() - 0.5) * (R.mode === 'hover' ? 0.6 : 1.2),
          sp: (0.15 + r() * 0.25) * (r() < 0.5 ? -1 : 1), phase: r() * 20, beat: 0.25 + r() * 0.3, scale: (range(r()) / 100) * (sp.visual ?? 1),
          wob: r() * 6.3,
        })),
      };
    }).filter(Boolean);
  }

  // The reef's fish swimming: each shoal drifting slowly about its patch, all its fish facing the
  // way it's going, each keeping its place in it, tail beating; a fish hovering by the rock faces
  // its own way. Shy of you within a few metres: they turn away together and move off. (They used
  // to go round and round their places, and spun on the spot when a diver came through.)
  animateReef(dt, t, cp) {
    const o = this._o, counts = {};
    // (How still you are: a diver hanging quietly in the water gets visited.)
    if (this.was && dt > 0) this.still = Math.hypot(cp.x - this.was.x, cp.y - this.was.y, cp.z - this.was.z) / dt < 0.35 ? (this.still || 0) + dt : 0;
    this.was = { x: cp.x, y: cp.y, z: cp.z };
    const still = this.still > 2;
    for (const G of this.reef) {
      // (Its patch, wandering a little.)
      let gx = G.x + Math.sin(t * G.w1 + G.p1) * G.wander, gz = G.z + Math.cos(t * G.w2 + G.p2) * G.wander;
      const dx = G.cx - cp.x, dz = G.cz - cp.z, d = Math.hypot(dx, dz);
      // Curious kinds come to look at a diver keeping still, near enough (to a few metres off), and
      // drift back to their patch when you move on.
      const near = Math.hypot(G.x - cp.x, G.z - cp.z) < 12 && Math.abs(G.y - cp.y) < 6;
      G.look = Math.max(0, Math.min(1, G.look + dt * (G.curious && still && near && G.shy < 0.1 ? 0.25 : -0.4)));
      if (G.look > 0 && d > 0.01) {
        const stand = 2.6 + (G.seed & 3) * 0.4;
        gx = gx * (1 - G.look) + (cp.x + (dx / d) * stand) * G.look;
        gz = gz * (1 - G.look) + (cp.z + (dz / d) * stand) * G.look;
      }
      if (d < 3.5 && Math.abs(G.y - cp.y) < 3) G.shy = Math.min(1, G.shy + dt * 2);
      else G.shy = Math.max(0, G.shy - dt * 0.2);
      if (G.shy > 0 && d > 0.01) {
        gx += (dx / d) * G.shy * 4;
        gz += (dz / d) * G.shy * 4;
      }
      G.cx += (gx - G.cx) * clamp(dt * (0.6 + G.shy * 2), 0, 1);
      G.cz += (gz - G.cz) * clamp(dt * (0.6 + G.shy * 2), 0, 1);
      const R = this.reefMesh[G.sp];
      if (!R) continue;
      // Which way the group faces: away from you when you come too close; towards you when
      // they've come to look; otherwise the way its patch is drifting (the patch's own slow path,
      // not the jitter of its centre), holding its heading while the drift is too slow to show, and
      // never coming round faster than a slow swing: a calm shoal doesn't wheel. (yaw 0 faces +z,
      // as the ecosystem's fish do.)
      const away = Math.atan2(G.cx - cp.x, G.cz - cp.z);
      const vx = Math.cos(t * G.w1 + G.p1) * G.w1 * G.wander, vz = -Math.sin(t * G.w2 + G.p2) * G.w2 * G.wander;
      G.heading ??= Math.hypot(vx, vz) > 0.02 ? Math.atan2(vx, vz) : G.p1;
      if (G.shy > 0.3) {
        // (Turned away once, and kept that way while you're behind them; only turning again if you
        // get round in front of them: a diver passing alongside doesn't swing them round with it.)
        if (G.flee == null || Math.abs(wrapAngle(away - G.flee)) > Math.PI / 2) G.flee = away;
        turnTo(G, 'heading', G.flee, 4, 3, dt);
      } else if (G.look > 0.4) {
        G.flee = null;
        turnTo(G, 'heading', away + Math.PI, 1.2, 0.8, dt);
        G.wind = 0;
      } else {
        G.flee = null;
        turnTo(G, 'heading', Math.hypot(vx, vz) > 0.08 ? Math.atan2(vx, vz) : G.heading, 0.5, 0.3, dt, true);
      }
      const sh = Math.sin(G.heading), ch = Math.cos(G.heading), tight = 1 - 0.3 * G.shy;
      for (const f of G.fish) {
        const k = counts[G.sp] || 0;
        if (k >= REEF_MAX) break;
        counts[G.sp] = k + 1;
        // Each in its own place in the group, drifting about it a little. A shoal faces the way the
        // group does; a fish hovering by the rock faces its own way, swinging slowly round and
        // back, until you come close or it comes to look.
        const along = Math.sin(f.a) * f.rr * tight + Math.sin(t * 0.3 + f.wob) * 0.25;
        const across = Math.cos(f.a) * f.rr * tight + Math.cos(t * 0.23 + f.wob * 2) * 0.2;
        const x = G.cx + sh * along + ch * across, z = G.cz + ch * along - sh * across;
        const y = clamp(G.y + (cp.y - G.y) * 0.6 * G.look + f.h + Math.sin(t * 0.5 + f.wob) * 0.15, G.low, G.top);
        const own = G.mode === 'hover' && G.shy < 0.3 && G.look < 0.4;
        const aim = own ? f.a + Math.sin(t * 0.05 * (1 + Math.abs(f.sp)) + f.wob) * 1.1 : G.heading + Math.sin(t * 0.6 + f.wob) * 0.12;
        const was = (f.yaw ??= aim);
        // (A fish hovering on its own goes back to facing its own way slowly, the way it came round.)
        if (own) turnTo(f, 'yaw', aim, 1, 0.6, dt, true);
        else {
          f.yaw = dampAngle(was, aim, 3, dt);
          f.wind = clamp((f.wind || 0) + wrapAngle(f.yaw - was), -Math.PI * 2, Math.PI * 2);
        }
        // (Turning, its body curves into the turn, as the ecosystem's fish do: see fishRender.js.)
        f.bend = damp(f.bend || 0, clamp((wrapAngle(f.yaw - was) / Math.max(dt, 1e-3)) * 0.14, -0.45, 0.45), 8, dt);
        o.position.set(x, y, z);
        o.rotation.set(Math.sin(t * 0.7 + f.wob) * 0.08, f.yaw, 0, 'YXZ');
        o.scale.setScalar(f.scale);
        o.updateMatrix();
        R.m.setMatrixAt(k, o.matrix);
        f.phase += dt * (3 + f.beat * 11) * (1 + G.shy);
        R.swim.setXYZ(k, f.phase, f.beat * (1 + G.shy), f.bend);
      }
    }
    for (const [id, R] of Object.entries(this.reefMesh)) {
      if (!R) continue;
      R.m.count = counts[id] || 0;
      R.m.visible = R.m.count > 0;
      R.m.instanceMatrix.needsUpdate = true;
      R.swim.needsUpdate = true;
    }
  }

  // How many of the reef's fish are about just now (for the notes, and the tests).
  get reefCount() {
    let n = 0;
    for (const G of this.reef) n += G.fish.length;
    return n;
  }

  animate(dt, t, cp) {
    this.animateReef(dt, t, cp);
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
    // Fry: each shoal swims as one, all facing the same way, milling on a slow, wide loop round its
    // home; come within a few metres and it turns away from you together and darts off, packed
    // tighter, then drifts back. (They used to go round and round their centre, and spun on the
    // spot when you came close.)
    let n = 0;
    for (const S of this.shoals) {
      const dx = S.cx - cp.x, dz = S.cz - cp.z, d = Math.hypot(dx, dz);
      if (d < 4 && Math.abs(S.y - cp.y) < 3) S.scare = 1;
      S.scare = Math.max(0, S.scare - dt * 0.25);
      const fleeing = S.scare > 0.5 && d > 0.01;
      const loop = t * 0.1 + (S.ph || 0), tx = S.x + Math.cos(loop) * 3, tz = S.z + Math.sin(loop) * 3;
      const want = fleeing ? Math.atan2(dx, dz) : Math.atan2(tx - S.cx, tz - S.cz);
      S.heading = dampAngle(S.heading ?? want, want, fleeing ? 5 : 0.6, dt);
      const speed = fleeing ? 2.5 : 0.3 * clamp(Math.hypot(tx - S.cx, tz - S.cz) / 2, 0.15, 1);
      S.cx += Math.sin(S.heading) * speed * dt;
      S.cz += Math.cos(S.heading) * speed * dt;
      const tight = 1 - 0.45 * S.scare, sh = Math.sin(S.heading), ch = Math.cos(S.heading);
      for (const f of S.fry) {
        if (n >= SHOALS * FRY) break;
        // (Each in its place in the shoal, which is longer than it's wide, with a little wobble.)
        const along = Math.sin(f.a) * f.rr * 1.4 * tight + Math.sin(t * f.sp + f.a) * 0.1;
        const across = Math.cos(f.a) * f.rr * tight + Math.cos(t * f.sp * 0.8 + f.a * 2) * 0.08;
        f.yaw = S.heading + Math.sin(t * f.sp * 0.7 + f.a) * 0.12;
        o.position.set(S.cx + sh * along + ch * across, Math.max(S.floor + 0.3, S.y + f.h * tight + Math.sin(t * 0.9 + f.a) * 0.08), S.cz + ch * along - sh * across);
        o.rotation.set(0, f.yaw, 0);
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
