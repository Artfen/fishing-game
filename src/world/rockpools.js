import * as THREE from 'three';
import { heightAt } from './terrain.js';
import { mergeParts, mat, seeded, clamp } from '../util.js';
import { fishById, buildFishGeometry, fishMaterial } from '../fish.js';

// Rockpools: on three stretches of rocky shore between the tide marks (east of Willowhaven, the
// rocks in Willow Bay, Puffin Cove's), little basins in the rock that the ebb leaves full of sea.
// At low water you can walk out to them and look in; the flood covers them again. What lives in
// them is what lives in the rockpools of this coast: beadlet and snakelocks anemones on the
// sides, limpets and periwinkles on the rock, a cushion star, common prawns flicking about the
// weed, a shore crab and the pool's fish (a rock goby, a shanny) hidden under the stones until
// you turn one over. The lower pools, uncovered only at the bottom of the tide, hold the most.
//
// Pools, and everything in them, are laid out the same in every game (from each site's seed);
// what you turn over and net comes back by itself after a few hours. Nothing here is kept: you
// look, net, photograph and put it back (see main.js, the rockpool view).

// The sites: on gently sloping shore within the tide's reach, chosen where the shore is rock
// rather than steep beach (see tests/rockpools.test.mjs: every pool is between the tide marks).
export const POOL_SITES = [
  { id: 'havenrocks', name: 'the rocks east of Willowhaven', x: 68, z: -52, r: 22, seed: 1101 },
  { id: 'bayrocks', name: 'the rocks in Willow Bay', x: 66, z: 33, r: 16, seed: 1202 },
  { id: 'puffinrocks', name: 'the rocks at Puffin Cove', x: -296, z: 504, r: 24, seed: 1303 },
];

// What lives in them. side: on the pool's walls; rim: on the rock round it; floor: on the bottom;
// weed: among the weed, swimming; under: hidden under a stone, mostly. net: can be caught in a
// hand net (and let go again). fish: a species in fish.js; the rest are in the naturalist's notes.
export const POOL_LIFE = {
  beadlet: { where: 'side', n: [1, 4], low: 0.2 },
  snakelocks: { where: 'side', n: [0, 3], low: 0.6 },
  limpet: { where: 'rim', n: [3, 8], low: 0 },
  periwinkle: { where: 'floor', n: [2, 6], low: 0.1 },
  cushionstar: { where: 'under', n: [1, 1], low: 0.6, chance: 0.5 },
  prawn: { where: 'weed', n: [1, 5], low: 0.3, net: 0.6 },
  shorecrab: { where: 'under', n: [1, 2], low: 0.1, net: 0.7, chance: 0.8 },
  rockgoby: { where: 'under', n: [1, 2], low: 0.4, net: 0.45, fish: true, chance: 0.65 },
  shanny: { where: 'under', n: [1, 2], low: 0.3, net: 0.4, fish: true, chance: 0.6 },
};
export const POOL_KINDS = Object.keys(POOL_LIFE);
export const POOL_FISH = POOL_KINDS.filter((k) => POOL_LIFE[k].fish);
const BACK_HOURS = 3; // what you've netted is back in the pool after this long (or put back)

// The pools of one site, laid out from its seed: up to six on ground between the tide marks,
// each with a rim (its water's surface: a few tens of centimetres above the ground in it), three
// loose stones and what lives there.
export function layPools(site) {
  const rnd = seeded(site.seed);
  const pools = [];
  for (let tries = 0; tries < 900 && pools.length < 6; tries++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * site.r;
    const x = site.x + Math.cos(a) * d, z = site.z + Math.sin(a) * d;
    const g = heightAt(x, z);
    if (g < -0.34 || g > 0.28) continue;
    const slope = Math.hypot(heightAt(x + 1, z) - heightAt(x - 1, z), heightAt(x, z + 1) - heightAt(x, z - 1)) / 2;
    if (slope > 0.3) continue;
    const r = 0.7 + rnd() * 0.65;
    if (pools.some((p) => Math.hypot(p.x - x, p.z - z) < p.r + r + 1.6)) continue;
    const water = 0.2 + rnd() * 0.18;
    const rim = g + water;
    // (A basin, not a slope: the ground all round inside it is under the water.)
    let level = true;
    for (let k = 0; k < 10 && level; k++) {
      const ka = (k / 10) * Math.PI * 2;
      if (heightAt(x + Math.cos(ka) * r * 0.9, z + Math.sin(ka) * r * 0.9) > rim - 0.04) level = false;
    }
    if (!level) continue;
    // How low on the shore: 1 at the bottom of the spring ebb, 0 high up.
    const low = clamp((0.4 - rim) / 0.75, 0, 1);
    const p = { id: `${site.id}-${pools.length}`, site: site.id, x, z, r, ground: g, rim, low, stones: [], life: [] };
    for (let k = 0; k < 3; k++) {
      const sa = (k / 3) * Math.PI * 2 + rnd() * 1.2, sd = r * (0.3 + rnd() * 0.4);
      p.stones.push({ x: x + Math.cos(sa) * sd, z: z + Math.sin(sa) * sd, s: 0.08 + rnd() * 0.05, yaw: rnd() * 6.3, turned: false });
    }
    for (const kind of POOL_KINDS) {
      const L = POOL_LIFE[kind];
      // Richer the lower the pool (some kinds only low down).
      if (L.low > 0 && rnd() > 0.25 + low * 1.1 - L.low * 0.5) continue;
      if (L.chance && rnd() > L.chance) continue;
      const n = Math.min(L.n[1], L.n[0] + Math.floor(rnd() * (L.n[1] - L.n[0] + 1) * (0.6 + 0.6 * low)));
      for (let i = 0; i < n; i++) {
        const la = rnd() * Math.PI * 2;
        const lr = L.where === 'rim' ? r * (1.0 + rnd() * 0.25) : L.where === 'side' ? r * (0.82 + rnd() * 0.14) : r * Math.sqrt(rnd()) * 0.8;
        const sp = L.fish ? fishById[kind] : null;
        const size = sp ? Math.round(sp.size[0] + (sp.size[1] - sp.size[0]) * Math.pow(rnd(), 1.6) * 0.8) : 0;
        const under = L.where === 'under' ? Math.floor(rnd() * 3) : null;
        p.life.push({ kind, x: x + Math.cos(la) * lr, z: z + Math.sin(la) * lr, yaw: rnd() * 6.3, phase: rnd() * 10, size, under, gone: -1e9, a: la });
      }
    }
    pools.push(p);
  }
  return pools;
}

export const POOLS = POOL_SITES.flatMap(layPools);
export const poolById = Object.fromEntries(POOLS.map((p) => [p.id, p]));

// Is the pool uncovered (its rim above the sea) at this sea level? (A few centimetres of margin:
// the swell slops over a pool long before the level reaches its rim.)
export const poolOpen = (p, level) => level < p.rim - 0.05;

// The pool beside you (within reach of its edge), or null; open: only one the tide has left.
export function poolNear(x, z, level, { open = true, reach = 1.6 } = {}) {
  let best = null, bd = Infinity;
  for (const p of POOLS) {
    const d = Math.hypot(p.x - x, p.z - z) - p.r;
    if (d > reach || d >= bd) continue;
    if (open && !poolOpen(p, level)) continue;
    best = p;
    bd = d;
  }
  return best;
}

// What's to be seen in the pool now: everything not hidden under a stone (or one you've turned)
// and not netted lately. abs: the game's clock (hours).
export function visibleLife(p, abs) {
  return p.life.filter((c) => abs - c.gone > BACK_HOURS && (c.under == null || p.stones[c.under].turned));
}

// Turn the next stone over: what was under it. (Put back as you found it, it covers them again
// when you leave: see settle.)
export function turnStone(p) {
  const s = p.stones.find((q) => !q.turned);
  if (!s) return null;
  s.turned = true;
  const i = p.stones.indexOf(s);
  return { stone: i, found: p.life.filter((c) => c.under === i) };
}
// Leaving the pool: the stones are put back, so whatever was under them is hidden again.
export function settle(p) {
  for (const s of p.stones) s.turned = false;
}

// Sweep the hand net: try for one netable creature in view (the kind asked for, or any). rnd: a
// dice roll (0 … 1). Returns { ok, creature } (creature: what you went for).
export function netIn(p, abs, kind = null, rnd = Math.random) {
  const can = visibleLife(p, abs).filter((c) => POOL_LIFE[c.kind].net && (!kind || c.kind === kind));
  if (!can.length) return { ok: false, creature: null };
  const c = can[Math.floor(rnd() * can.length)];
  const ok = rnd() < POOL_LIFE[c.kind].net;
  return { ok, creature: c };
}
// Netted, looked at and let go: it shelters for a few hours (back under the weed or a stone).
export function letGo(c, abs) {
  c.gone = abs;
}

/* ---------------- drawing ---------------- */

const _o = new THREE.Object3D();
const _v = new THREE.Vector3();

function rockGeometry() {
  const g = new THREE.IcosahedronGeometry(1, 2);
  const p = g.attributes.position, rnd = seeded(77);
  for (let i = 0; i < p.count; i++) {
    const k = 0.9 + rnd() * 0.14;
    p.setXYZ(i, p.getX(i) * k, p.getY(i) * k * 0.7, p.getZ(i) * k);
  }
  g.computeVertexNormals();
  return g;
}
// The creatures, each a little merged model (about life size: metres).
function creatureGeometry(kind) {
  const P = [];
  const add = (geo, matrix, color, jitter = 0.08) => P.push({ geo, matrix, color, jitter });
  switch (kind) {
    case 'beadlet': // a glossy red dome, tentacles drawn in or a short crown out
      add(new THREE.SphereGeometry(0.025, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), mat(0, 0, 0, 0, 0, 0, 1, 1.1, 1), '#a3161c');
      for (let k = 0; k < 10; k++) add(new THREE.ConeGeometry(0.003, 0.018, 4), mat(Math.cos(k * 0.63) * 0.012, 0.03, Math.sin(k * 0.63) * 0.012, Math.sin(k * 0.63) * 0.6, 0, -Math.cos(k * 0.63) * 0.6), '#c8343a');
      break;
    case 'snakelocks': // long waving green tentacles with purple tips
      add(new THREE.CylinderGeometry(0.014, 0.018, 0.015, 8), mat(0, 0.007, 0), '#6a7a3a');
      for (let k = 0; k < 16; k++) {
        const a = k * 0.39, t = 0.6 + (k % 3) * 0.2;
        add(new THREE.CylinderGeometry(0.0015, 0.0025, 0.05, 4), mat(Math.cos(a) * 0.02, 0.035, Math.sin(a) * 0.02, Math.sin(a) * t, 0, -Math.cos(a) * t), k % 2 ? '#7aa04a' : '#8ab05a');
        add(new THREE.SphereGeometry(0.003, 4, 3), mat(Math.cos(a) * 0.042, 0.055, Math.sin(a) * 0.042), '#a05a9a');
      }
      break;
    case 'limpet': // a ribbed grey cone
      add(new THREE.ConeGeometry(0.022, 0.016, 12), mat(0, 0.008, 0), '#8a8676', 0.15);
      break;
    case 'periwinkle': // a dark spiral shell
      add(new THREE.SphereGeometry(0.011, 8, 6), mat(0, 0.009, 0, 0, 0, 0, 1, 0.85, 1.15), '#3a3430');
      add(new THREE.ConeGeometry(0.007, 0.012, 8), mat(0, 0.016, -0.006, -0.6, 0, 0), '#4a4038');
      break;
    case 'cushionstar': // a little five-sided star, plump and blunt
      for (let k = 0; k < 5; k++) add(new THREE.SphereGeometry(0.012, 6, 4), mat(Math.cos(k * 1.257) * 0.011, 0.004, Math.sin(k * 1.257) * 0.011, 0, -k * 1.257, 0, 1.3, 0.45, 0.8), '#c8783a');
      add(new THREE.SphereGeometry(0.013, 8, 5), mat(0, 0.005, 0, 0, 0, 0, 1, 0.5, 1), '#b8683a');
      break;
    case 'prawn': // a translucent curved body, striped, with long feelers
      add(new THREE.CapsuleGeometry(0.004, 0.03, 4, 8), mat(0, 0.008, 0, Math.PI / 2, 0, 0), '#d8c8b0');
      for (let k = 0; k < 4; k++) add(new THREE.TorusGeometry(0.0042, 0.0007, 4, 8), mat(0, 0.008, -0.012 + k * 0.007), '#8a6a5a');
      for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.0004, 0.0004, 0.05, 3), mat(s * 0.004, 0.012, 0.035, Math.PI / 2 - 0.2, 0, s * 0.25), '#c0a890');
      break;
    case 'shorecrab': // a green-brown shell, claws and legs
      add(new THREE.SphereGeometry(0.03, 10, 6), mat(0, 0.012, 0, 0, 0, 0, 1.15, 0.38, 1), '#4a5a2a', 0.12);
      for (const s of [-1, 1]) {
        add(new THREE.SphereGeometry(0.009, 6, 4), mat(s * 0.022, 0.012, 0.03, 0, 0, 0, 1.3, 0.8, 1), '#5a6a32');
        for (let k = 0; k < 4; k++) add(new THREE.CylinderGeometry(0.0022, 0.0018, 0.035, 4), mat(s * 0.038, 0.008, -0.018 + k * 0.011, 0, 0, s * 1.2), '#4a5228');
      }
      break;
    default:
      add(new THREE.SphereGeometry(0.01, 6, 4), mat(), '#888');
  }
  return mergeParts(P, seeded(kind.length * 7));
}

const MAX = 48; // of any one kind near you at once

export class Rockpools {
  constructor(scene) {
    this.group = new THREE.Group();
    this.group.name = 'rockpools';
    scene.add(this.group);
    const rockMat = new THREE.MeshStandardMaterial({ color: '#7a7466', roughness: 0.95 });
    // Every rock round every pool, and the loose stones, in one mesh.
    const rocks = [];
    for (const p of POOLS) {
      const rnd = seeded(p.x * 13 + p.z * 7);
      const n = Math.round(12 + p.r * 9);
      for (let k = 0; k < n; k++) {
        const a = (k / n) * Math.PI * 2 + rnd() * 0.3, s = 0.14 + rnd() * 0.16;
        const rr = p.r + s * 0.6;
        rocks.push({ x: p.x + Math.cos(a) * rr, z: p.z + Math.sin(a) * rr, y: p.rim - s * 0.25, s, yaw: rnd() * 6.3 });
      }
    }
    this.rocks = new THREE.InstancedMesh(rockGeometry(), rockMat, rocks.length);
    rocks.forEach((r, i) => {
      _o.position.set(r.x, r.y, r.z);
      _o.rotation.set(0, r.yaw, 0);
      _o.scale.setScalar(r.s);
      _o.updateMatrix();
      this.rocks.setMatrixAt(i, _o.matrix);
    });
    this.rocks.frustumCulled = false;
    this.group.add(this.rocks);
    // The loose stones (three a pool): lifted and tipped back when turned.
    this.stones = new THREE.InstancedMesh(rockGeometry(), new THREE.MeshStandardMaterial({ color: '#8a8272', roughness: 0.9 }), POOLS.length * 3);
    this.stones.frustumCulled = false;
    this.group.add(this.stones);
    // The pools' floors (dark, weedy) and their water, one disc each, scaled to each pool.
    this.floor = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 20), new THREE.MeshStandardMaterial({ color: '#46503a', roughness: 1 }), POOLS.length);
    this.water = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24), new THREE.MeshStandardMaterial({ color: '#4f8a86', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.42, depthWrite: false }), POOLS.length);
    for (const m of [this.floor, this.water]) {
      m.frustumCulled = false;
      m.renderOrder = m === this.water ? 2 : 0;
      this.group.add(m);
    }
    POOLS.forEach((p, i) => {
      _o.position.set(p.x, p.ground + 0.012, p.z);
      _o.rotation.set(-Math.PI / 2, 0, 0);
      _o.scale.set(p.r * 0.98, p.r * 0.98, 1);
      _o.updateMatrix();
      this.floor.setMatrixAt(i, _o.matrix);
    });
    // The creatures, one instanced mesh a kind (the fish wear their own models).
    this.kinds = {};
    const lifeMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, flatShading: true });
    for (const kind of POOL_KINDS) {
      let m;
      if (POOL_LIFE[kind].fish) {
        const sp = fishById[kind];
        const geo = buildFishGeometry(sp, false).clone();
        const swim = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3), 3);
        geo.setAttribute('aSwim', swim);
        m = new THREE.InstancedMesh(geo, fishMaterial(sp, true), MAX);
        m.userData.swim = swim;
      } else m = new THREE.InstancedMesh(creatureGeometry(kind), kind === 'prawn' ? new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, transparent: true, opacity: 0.7, flatShading: true }) : lifeMat, MAX);
      m.frustumCulled = false;
      m.count = 0;
      this.group.add(m);
      this.kinds[kind] = m;
    }
    this.level = 0;
  }

  // Each frame: the water in each pool (shown while the tide has left it), and the life of the
  // pools near you. level: the sea's level; at: where you are; abs: the game's clock.
  update(dt, t, at, level, abs) {
    this.level = level;
    const near = at ? POOLS.filter((p) => Math.hypot(p.x - at.x, p.z - at.z) < 70) : [];
    this.group.visible = near.length > 0;
    if (!near.length) return;
    POOLS.forEach((p, i) => {
      const open = poolOpen(p, level);
      _o.position.set(p.x, p.rim - 0.02, p.z);
      _o.rotation.set(-Math.PI / 2, 0, 0);
      _o.scale.set(open ? p.r : 0.0001, open ? p.r : 0.0001, 1);
      _o.updateMatrix();
      this.water.setMatrixAt(i, _o.matrix);
      p.stones.forEach((s, k) => {
        // (Turned: lifted aside and tipped up on its edge.)
        const lift = s.turned ? 1 : 0;
        _o.position.set(s.x + lift * 0.18, p.ground + s.s * 0.35 + lift * 0.05, s.z);
        _o.rotation.set(lift * 1.2, s.yaw, 0);
        _o.scale.setScalar(s.s);
        _o.updateMatrix();
        this.stones.setMatrixAt(i * 3 + k, _o.matrix);
      });
    });
    this.water.instanceMatrix.needsUpdate = true;
    this.stones.instanceMatrix.needsUpdate = true;
    const counts = {};
    for (const p of near) {
      for (const c of visibleLife(p, abs)) {
        const m = this.kinds[c.kind], k = counts[c.kind] || 0;
        if (k >= MAX) continue;
        counts[c.kind] = k + 1;
        const L = POOL_LIFE[c.kind];
        let x = c.x, z = c.z, y = p.ground + 0.01, yaw = c.yaw, s = 1;
        if (L.where === 'side') y = p.ground + (p.rim - p.ground) * 0.55;
        else if (L.where === 'rim') y = p.rim + 0.02;
        if (c.kind === 'prawn') {
          // Flicking about among the weed, now and then darting off.
          const w = t * 0.6 + c.phase, dart = Math.max(0, Math.sin(t * 0.37 + c.phase * 3)) ** 8;
          x += Math.sin(w) * 0.12 + dart * 0.15;
          z += Math.cos(w * 0.8) * 0.12;
          y = p.ground + 0.04 + Math.sin(t * 2 + c.phase) * 0.01;
          yaw = Math.atan2(Math.cos(w) * 0.12, -Math.sin(w * 0.8) * 0.1);
        } else if (c.kind === 'shorecrab') {
          x += Math.sin(t * 0.21 + c.phase) * 0.08;
          yaw = c.yaw + Math.sin(t * 0.13 + c.phase) * 0.6;
        } else if (L.fish) {
          // Still on the bottom, then a dart to another spot.
          const hop = Math.floor((t + c.phase * 3) / 7), f = ((t + c.phase * 3) % 7) / 7, k2 = Math.min(1, f * 12);
          const a0 = c.a + hop * 1.9, a1 = c.a + (hop + 1) * 1.9;
          const ra = p.r * 0.45;
          x = p.x + Math.cos(a0 + (a1 - a0) * k2) * ra;
          z = p.z + Math.sin(a0 + (a1 - a0) * k2) * ra;
          y = p.ground + 0.025;
          yaw = Math.atan2(Math.cos(a1) - Math.cos(a0), Math.sin(a1) - Math.sin(a0)) + Math.PI / 2;
          s = (c.size / 100) * fishById[c.kind].visual;
          m.userData.swim.setXYZ(k, t * 6 + c.phase, k2 < 1 ? 0.8 : 0.15, 0);
        } else if (c.kind === 'beadlet' || c.kind === 'snakelocks') {
          // Turned to face into the pool, swaying a little in the slop.
          yaw = Math.atan2(p.x - x, p.z - z);
          s = 1 + Math.sin(t * 1.3 + c.phase) * 0.06;
        }
        _o.position.set(x, y, z);
        _o.rotation.set(0, yaw, 0);
        _o.scale.setScalar(s);
        _o.updateMatrix();
        m.setMatrixAt(k, _o.matrix);
      }
    }
    for (const kind of POOL_KINDS) {
      const m = this.kinds[kind];
      m.count = counts[kind] || 0;
      m.instanceMatrix.needsUpdate = true;
      if (m.userData.swim) m.userData.swim.needsUpdate = true;
    }
  }

  // What of the pools' life is in the picture (for photographs): { fish: [species ids], nature:
  // [kinds] } within a few metres of the camera and in its view.
  inFrame(frustum, cam, abs) {
    const fish = new Set(), nature = new Set();
    for (const p of POOLS) {
      if (Math.hypot(p.x - cam.x, p.z - cam.z) > 6 || !poolOpen(p, this.level)) continue;
      for (const c of visibleLife(p, abs)) {
        if (!frustum.containsPoint(_v.set(c.x, p.ground + 0.03, c.z))) continue;
        (POOL_LIFE[c.kind].fish ? fish : nature).add(c.kind);
      }
    }
    return { fish: [...fish], nature: [...nature] };
  }
}
