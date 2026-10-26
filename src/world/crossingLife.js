import * as THREE from 'three';
import { waveHeight } from './water.js';
import { mergeParts, mat, clamp } from '../util.js';
import { CROSSING_HOMES } from './habitat.js';

// What you see out on the crossing to Las Brasas besides the fish, dolphins and whales (see
// crossing.js): rafts of floating sargassum weed in the warm water, golden-brown mats drifting in
// lines with the wind, where the dorado lurk underneath (the same fish that live there: see
// habitat.js CROSSING_HOMES); and flying fish bursting out ahead of a boat going along, gliding low
// over the waves on their long clear fins and dropping back in.

const rand = (a, b) => a + Math.random() * (b - a);

// A mat of sargassum: a ragged patch of golden-brown weed with its little air bladders, flat on
// the water, a few metres across.
function weedGeometry(seed) {
  const parts = [];
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let k = 0; k < 26; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 4.2;
    parts.push({ geo: new THREE.CircleGeometry(0.6 + r() * 0.9, 6), matrix: mat(Math.cos(a) * d * 1.6, 0.02 + r() * 0.03, Math.sin(a) * d, -Math.PI / 2, 0, r() * 6), color: ['#9a7a2e', '#b08a36', '#7e6626', '#a8873e'][k % 4] });
  }
  for (let k = 0; k < 40; k++) {
    const a = r() * Math.PI * 2, d = Math.sqrt(r()) * 4.6;
    parts.push({ geo: new THREE.IcosahedronGeometry(0.07, 0), matrix: mat(Math.cos(a) * d * 1.6, 0.06, Math.sin(a) * d), color: '#c8a248' });
  }
  return mergeParts(parts);
}

// A flying fish: a slim blue-backed body and long clear wing-fins.
function flyerGeometry() {
  return mergeParts([
    { geo: new THREE.SphereGeometry(0.05, 8, 5), matrix: mat(0, 0, 0, 0, 0, 0, 0.8, 0.7, 3.4), color: '#2f5f9a' },
    { geo: new THREE.SphereGeometry(0.045, 8, 5), matrix: mat(0, -0.012, 0, 0, 0, 0, 0.7, 0.5, 3.2), color: '#d8e4ec' },
    { geo: new THREE.PlaneGeometry(0.5, 0.12), matrix: mat(0, 0.01, 0.03, -Math.PI / 2, 0, 0), color: '#b8d0e0' },
    { geo: new THREE.ConeGeometry(0.05, 0.14, 4), matrix: mat(0, 0, -0.22, -Math.PI / 2, 0, 0, 1.2, 1, 0.4), color: '#2f5f9a' },
  ]);
}

export function buildCrossingLife(scene) {
  const group = new THREE.Group();
  group.name = 'crossing-life';
  scene.add(group);
  const plain = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  // The weed rafts: one at each home with dorado under it, drifting a little round it.
  const weeds = CROSSING_HOMES.filter((h) => h.weed).map((h, i) => {
    const m = new THREE.Mesh(weedGeometry(1234 + i * 97), plain);
    m.position.set(h.x, 0, h.z);
    m.rotation.y = i * 1.7;
    m.visible = false;
    group.add(m);
    return { m, h, ph: i * 2.1 };
  });
  // The flyers: a few at a time, launched from ahead of the bow.
  const flyGeo = flyerGeometry();
  const flyers = Array.from({ length: 10 }, () => {
    const m = new THREE.Mesh(flyGeo, plain);
    m.rotation.order = 'YXZ';
    m.visible = false;
    group.add(m);
    return { m, t: 0, dur: 0, x0: 0, z0: 0, dx: 0, dz: 0, len: 0, h: 0, live: false };
  });
  let flyT = 0, flyUntil = 0;
  const events = { onSighting: null, onPlop: null };

  return {
    group, weeds, flyers, events,
    // A while of flying fish ahead of the boat (seconds), from the crossing's encounters.
    flyingFish(secs) {
      flyUntil = Math.max(flyUntil, secs);
      flyT = 0.5;
    },
    get flying() { return flyUntil > 0; },
    // ctx: { from, boat (aboard, under way, or null), boatSpeed, crossing (out on it) }
    update(dt, t, ctx) {
      // The weed, near enough to see.
      for (const W of weeds) {
        const d = Math.hypot(W.h.x - ctx.from.x, W.h.z - ctx.from.z);
        W.m.visible = d < 700;
        if (!W.m.visible) continue;
        const x = W.h.x + Math.sin(t * 0.02 + W.ph) * 6, z = W.h.z + Math.cos(t * 0.017 + W.ph) * 6;
        W.m.position.set(x, waveHeight(x, z, t) - 0.03, z);
      }
      flyUntil = Math.max(0, flyUntil - dt);
      // A boat going along at a fair clip puts them up: a few at a time, off either bow, gliding
      // ahead and away.
      const B = ctx.boat, sp = ctx.boatSpeed || 0;
      if (flyUntil > 0 && B && sp > 1.8) {
        flyT -= dt;
        if (flyT <= 0) {
          flyT = rand(1.2, 4);
          const n = 1 + Math.floor(Math.random() * 4);
          for (let k = 0; k < n; k++) {
            const f = flyers.find((q) => !q.live);
            if (!f) break;
            const side = Math.random() < 0.5 ? -1 : 1, ahead = rand(4, 10);
            const a = Math.atan2(B.fwd.x, B.fwd.z) + side * rand(0.3, 0.9);
            Object.assign(f, {
              live: true, t: 0, dur: rand(1.4, 2.6), len: rand(14, 32), h: rand(0.4, 1.2),
              x0: B.pos.x + B.fwd.x * ahead + B.right.x * side * rand(1, 4), z0: B.pos.z + B.fwd.z * ahead + B.right.z * side * rand(1, 4),
              dx: Math.sin(a), dz: Math.cos(a),
            });
            events.onPlop?.(f.x0, f.z0, 0.5);
          }
          events.onSighting?.('flyingfish', B.pos.x, B.pos.z);
        }
      }
      for (const f of flyers) {
        if (!f.live) {
          f.m.visible = false;
          continue;
        }
        f.t += dt;
        const u = clamp(f.t / f.dur, 0, 1);
        const x = f.x0 + f.dx * f.len * u, z = f.z0 + f.dz * f.len * u;
        const s = waveHeight(x, z, t);
        // Up out of the water, a long flat glide just over the crests, and down.
        const y = s + f.h * Math.min(1, u * 6) * Math.min(1, (1 - u) * 5) + Math.sin(u * 9) * 0.05;
        f.m.position.set(x, y, z);
        f.m.rotation.set(-0.05, Math.atan2(f.dx, f.dz), Math.sin(t * 20) * 0.1);
        f.m.visible = true;
        if (u >= 1) {
          f.live = false;
          events.onPlop?.(x, z, 0.35);
        }
      }
    },
  };
}
