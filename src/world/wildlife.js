import * as THREE from 'three';
import { heightAt, waterLevel, depthAt, RIVER, MARSH, SANDBANKS, LAKE, STRAND, BAY, STACKS, SKERRIES, CALF_SKERRY } from './terrain.js';
import { COLDWATER } from './coldwater.js';
import { waveHeight } from './water.js';
import { clamp, lerp, damp, dampAngle, smoothstep, wrapAngle, mergeParts, mat, seeded } from '../util.js';

// The quieter wildlife of the home coast, there to be watched (see sealife.js for the whales,
// dolphins, seals and gannets):
//
//  · Otters on the quiet waters: the Coldwater's tideway below the Lower Force, the upper Wend
//    above the quay, and the channels of the Saltings. Busiest at dawn and dusk. A long brown back
//    and a tail along the far bank, a dive (the tail flips up), a few seconds under, and up again
//    further on, now and then with a fish it takes onto the bank to eat. Shy: walk up on one, or
//    come at it fast, and it's gone; keep still, or drift down quietly, and you can watch.
//  · Grey herons in the shallows of Reedmere, on the Wend's sandbanks and round the Saltings:
//    standing like posts, stalking, a jab of the bill and now and then a little fish. Come too
//    close and one lifts off with a harsh "fraank", neck folded, slow deep wingbeats, and settles
//    again further off.
//  · Cormorants on Gull Rock's stacks, the Skerries and the Calf's skerry: black, standing with
//    their wings spread out to dry, and others low in the water, diving for half a minute at a
//    time and coming up a long way off.
//  · Terns in spring and summer, over the bay and off Shell Strand: white, buoyant, black-capped;
//    they hover, then plunge in after sand smelt and sandeels, with a grating "kee-arr".
//  · Oystercatchers along Shell Strand and on the Wend's sandbanks when the tide's down: black
//    and white, with long orange bills, probing the sand; come close and the flock goes off low
//    along the shore, piping, and lands again further on.
//
// The game hears what you see (onSighting) for its record, the calls for their sounds (onCall),
// and the moments worth a word (onMoment). Only at home: Las Brasas has its own sea life.

export const WILD_KINDS = ['otter', 'heron', 'cormorant', 'tern', 'oystercatcher'];

const rnd0 = seeded(20261103);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
const litBoth = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const _f = new THREE.Vector3();

/* ---------------- the animals' shapes ---------------- */

// An otter: a long, low brown body, a broad flat head with a pale chin, small ears, a thick tail
// tapering to a point, and short legs (seen when it's out on the bank). Along +z; about 1.1 m.
function otterModel() {
  const g = new THREE.Group();
  const brown = '#4b3524', dark = '#3a281b', pale = '#9a8466';
  const body = new THREE.Mesh(mergeParts([
    { geo: new THREE.CapsuleGeometry(0.11, 0.42, 4, 10), matrix: mat(0, 0, 0, Math.PI / 2, 0, 0), color: brown, jitter: 0.04 },
    { geo: new THREE.SphereGeometry(0.075, 8, 6), matrix: mat(0, -0.03, 0.18, 0, 0, 0, 1, 0.7, 1.4), color: pale },
  ]), lit);
  const head = new THREE.Group();
  head.position.set(0, 0.02, 0.33);
  head.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.085, 10, 8), matrix: mat(0, 0, 0.03, 0, 0, 0, 1.1, 0.85, 1.15), color: brown },
    { geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: mat(0, -0.02, 0.11, 0, 0, 0, 1.2, 0.8, 1), color: pale },
    { geo: new THREE.SphereGeometry(0.014, 6, 4), matrix: mat(0, 0, 0.15), color: '#16110d' },
    { geo: new THREE.SphereGeometry(0.018, 6, 4), matrix: mat(0.06, 0.06, -0.01), color: dark },
    { geo: new THREE.SphereGeometry(0.018, 6, 4), matrix: mat(-0.06, 0.06, -0.01), color: dark },
  ]), lit));
  const tail = new THREE.Group();
  tail.position.set(0, 0, -0.32);
  tail.add(new THREE.Mesh(mergeParts([{ geo: new THREE.ConeGeometry(0.06, 0.42, 8), matrix: mat(0, 0, -0.2, -Math.PI / 2, 0, 0), color: dark }]), lit));
  const legs = new THREE.Mesh(mergeParts([[-1, 1], [1, 1], [-1, -1], [1, -1]].map(([sx, sz]) => ({ geo: new THREE.CylinderGeometry(0.03, 0.035, 0.12, 6), matrix: mat(sx * 0.07, -0.1, sz * 0.17), color: dark }))), lit);
  g.add(body, head, tail, legs);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { g, body, head, tail, legs };
}

// Wings for the birds: a flat wing each side, pivoting at the shoulder (rotation.z), white or
// coloured inner, darker tip. span: one wing's length.
function wings(g, span, chord, inner, tip, y = 0.04) {
  const make = (s) => {
    const geo = new THREE.BufferGeometry();
    const p = [0, 0, chord * 0.5, 0, 0, -chord * 0.5, span * 0.6 * s, 0, chord * 0.35, span * 0.6 * s, 0, chord * 0.35, 0, 0, -chord * 0.5, span * 0.6 * s, 0, -chord * 0.4,
      span * 0.6 * s, 0, chord * 0.35, span * 0.6 * s, 0, -chord * 0.4, span * s, 0, -chord * 0.55];
    const a = new THREE.Color(inner), b = new THREE.Color(tip), c = [];
    for (let i = 0; i < 6; i++) c.push(a.r, a.g, a.b);
    for (let i = 0; i < 3; i++) c.push(b.r, b.g, b.b);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, litBoth);
    // (Turned flat-side-forward first, then raised: a cormorant's wings hung out to dry.)
    m.rotation.order = 'ZYX';
    m.position.set(0.04 * s, y, 0.02);
    g.add(m);
    return m;
  };
  return { wl: make(1), wr: make(-1) };
}

// A grey heron: a grey body, a long neck (drawn in or stretched out), a white head with a black
// crest stripe and a dagger of a yellow bill, long legs. Its wings show in flight.
function heronModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.2, 8, 6), matrix: mat(0, 0.95, 0, 0, 0, 0, 0.8, 0.9, 1.5), color: '#9aa2a6' },
    { geo: new THREE.ConeGeometry(0.1, 0.3, 5), matrix: mat(0, 0.9, -0.38, -Math.PI / 2 - 0.3, 0, 0, 1, 1, 0.5), color: '#7f878b' },
  ]), lit));
  const neck = new THREE.Group();
  neck.position.set(0, 1.05, 0.2);
  neck.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.CylinderGeometry(0.032, 0.045, 0.5, 6), matrix: mat(0, 0.25, 0), color: '#c4c9c9' },
  ]), lit));
  const head = new THREE.Group();
  head.position.set(0, 0.5, 0);
  head.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.06, 8, 6), matrix: mat(0, 0, 0, 0, 0, 0, 1, 0.9, 1.3), color: '#eef0ec' },
    { geo: new THREE.BoxGeometry(0.02, 0.015, 0.12), matrix: mat(0, 0.04, -0.06), color: '#1c1d1f' },
    { geo: new THREE.ConeGeometry(0.022, 0.22, 4), matrix: mat(0, -0.005, 0.16, Math.PI / 2, 0, 0), color: '#d9b04a' },
  ]), lit));
  neck.add(head);
  const legs = new THREE.Mesh(mergeParts([-0.06, 0.06].map((x) => ({ geo: new THREE.CylinderGeometry(0.012, 0.012, 0.8, 4), matrix: mat(x, 0.4, 0), color: '#7b6a4e' }))), lit);
  g.add(neck, legs);
  const w = wings(g, 0.85, 0.42, '#8f979b', '#3a3e42', 0.98);
  w.wl.visible = w.wr.visible = false;
  return { g, neck, head, legs, ...w };
}

// A cormorant: black with a bronze sheen, a long neck, a hooked bill and a white cheek; wings that
// it holds out to dry.
function cormorantModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.16, 8, 6), matrix: mat(0, 0.32, 0, 0, 0, 0, 0.8, 1.3, 0.9), color: '#1c1e1d' },
    { geo: new THREE.ConeGeometry(0.06, 0.26, 5), matrix: mat(0, 0.08, -0.12, Math.PI + 0.4, 0, 0), color: '#151615' },
  ]), lit));
  const neck = new THREE.Group();
  neck.position.set(0, 0.5, 0.04);
  neck.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.CylinderGeometry(0.035, 0.05, 0.24, 6), matrix: mat(0, 0.1, 0.02, 0.2, 0, 0), color: '#1e201f' },
    { geo: new THREE.SphereGeometry(0.055, 8, 6), matrix: mat(0, 0.24, 0.05), color: '#202221' },
    { geo: new THREE.SphereGeometry(0.03, 6, 4), matrix: mat(0, 0.22, 0.09), color: '#e8e4da' },
    { geo: new THREE.ConeGeometry(0.016, 0.12, 4), matrix: mat(0, 0.24, 0.15, Math.PI / 2, 0, 0), color: '#4a4236' },
  ]), lit));
  g.add(neck);
  const w = wings(g, 0.55, 0.3, '#1e2020', '#141515', 0.4);
  return { g, neck, ...w };
}

// A tern: small and white, a black cap, a red bill, a forked tail, long narrow wings.
function ternModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.07, 8, 6), matrix: mat(0, 0, 0, 0, 0, 0, 0.8, 0.75, 2.0), color: '#f4f4f0' },
    { geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: mat(0, 0.02, 0.14), color: '#f2f2ee' },
    { geo: new THREE.SphereGeometry(0.047, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(0, 0.025, 0.14), color: '#141414' },
    { geo: new THREE.ConeGeometry(0.012, 0.08, 4), matrix: mat(0, 0.015, 0.21, Math.PI / 2, 0, 0), color: '#c8402e' },
    { geo: new THREE.ConeGeometry(0.02, 0.16, 3), matrix: mat(0.025, 0, -0.18, -Math.PI / 2, 0, 0.2), color: '#ececea' },
    { geo: new THREE.ConeGeometry(0.02, 0.16, 3), matrix: mat(-0.025, 0, -0.18, -Math.PI / 2, 0, -0.2), color: '#ececea' },
  ]), lit));
  return { g, ...wings(g, 0.4, 0.13, '#dfe3e5', '#9aa2a8', 0.01) };
}

// An oystercatcher: black above, white below, a long orange-red bill, pink legs.
function oysterModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(mergeParts([
    { geo: new THREE.SphereGeometry(0.08, 8, 6), matrix: mat(0, 0.2, 0, 0, 0, 0, 0.9, 0.8, 1.5), color: '#1a1a1a' },
    { geo: new THREE.SphereGeometry(0.075, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matrix: mat(0, 0.19, 0, 0, 0, 0, 0.92, 0.85, 1.45), color: '#f2f0ea' },
    { geo: new THREE.SphereGeometry(0.045, 8, 6), matrix: mat(0, 0.27, 0.11), color: '#161616' },
    { geo: new THREE.ConeGeometry(0.012, 0.12, 4), matrix: mat(0, 0.255, 0.21, Math.PI / 2 + 0.25, 0, 0), color: '#e2622a' },
    { geo: new THREE.CylinderGeometry(0.008, 0.008, 0.13, 4), matrix: mat(0.025, 0.07, 0), color: '#e2a49a' },
    { geo: new THREE.CylinderGeometry(0.008, 0.008, 0.13, 4), matrix: mat(-0.025, 0.07, 0), color: '#e2a49a' },
  ]), lit));
  const w = wings(g, 0.38, 0.14, '#202020', '#f0f0ea', 0.22);
  w.wl.visible = w.wr.visible = false;
  return { g, ...w };
}

/* ---------------- where they live ---------------- */

// A path along one bank of a river: { x, z, bx, bz (the bank beside it, for eating on), lvl }.
function bankPath(centre, side) {
  const out = [];
  for (let i = 0; i < centre.length - 1; i++) {
    const a = centre[i], b = centre[i + 1], L = Math.hypot(b.x - a.x, b.z - a.z);
    const nx = -(b.z - a.z) / L, nz = (b.x - a.x) / L;
    for (let s = 0; s < L; s += 5) {
      const k = s / L, cx = a.x + (b.x - a.x) * k, cz = a.z + (b.z - a.z) * k, hw = a.hw + (b.hw - a.hw) * k;
      let off = hw * 0.6, x = cx, z = cz;
      for (; off > 0.5; off -= 0.5) {
        x = cx + nx * off * side;
        z = cz + nz * off * side;
        if (depthAt(x, z) > 0.45) break;
      }
      if (depthAt(x, z) < 0.35) continue;
      let bx = null, bz = null;
      for (let o = off; o < off + 14; o += 0.5) {
        const px = cx + nx * o * side, pz = cz + nz * o * side, h = heightAt(px, pz) - waterLevel(px, pz);
        if (h > 0.06) {
          if (h < 0.9) [bx, bz] = [px, pz];
          break;
        }
      }
      out.push({ x, z, bx, bz, lvl: waterLevel(x, z) });
    }
  }
  return out;
}
// A path round an island of the Saltings, in the channel just off its edge.
function ringPath(M) {
  const out = [];
  for (let k = 0; k < 28; k++) {
    const a = (k / 28) * Math.PI * 2;
    let best = null;
    for (let r = M.r + 1; r < M.r + 12; r += 0.5) {
      const x = M.x + Math.cos(a) * r, z = M.z + Math.sin(a) * r;
      if (depthAt(x, z) > 0.4) {
        const bx = M.x + Math.cos(a) * (r - 2.5), bz = M.z + Math.sin(a) * (r - 2.5), h = heightAt(bx, bz) - waterLevel(bx, bz);
        best = { x, z, bx: h > 0.06 && h < 0.9 ? bx : null, bz, lvl: waterLevel(x, z) };
        break;
      }
    }
    if (best) out.push(best);
  }
  return out;
}
// Shallow water round a place for a heron to stand in: depth between lo and hi.
function shallows(cx, cz, r0, r1, n, lo = 0.08, hi = 0.4) {
  const out = [];
  for (let i = 0; i < n * 40 && out.length < n; i++) {
    const a = rnd0() * Math.PI * 2, r = r0 + rnd0() * (r1 - r0), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const d = depthAt(x, z);
    if (d > lo && d < hi && out.every((p) => Math.hypot(p.x - x, p.z - z) > 6)) out.push({ x, z });
  }
  return out;
}
// Dry sand or mud just above the water, for the oystercatchers: [x, z, height].
function strandline(cx, cz, r0, r1, n, top = 0.8) {
  const out = [];
  for (let i = 0; i < n * 60 && out.length < n; i++) {
    const a = rnd0() * Math.PI * 2, r = r0 + rnd0() * (r1 - r0), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const h = heightAt(x, z);
    if (h > 0.02 && h < top && out.every((p) => Math.hypot(p.x - x, p.z - z) > 14)) out.push({ x, z, h });
  }
  return out;
}

export const OTTER_BEATS = (() => {
  const cold = COLDWATER.slice(34, 42).map((n) => ({ x: n.x, z: n.z, hw: n.w * 0.5 }));
  const wend = RIVER.slice(0, 4).map(([x, z, hw]) => ({ x, z, hw }));
  return [
    { id: 'coldwater', name: 'the Coldwater', path: bankPath(cold, 1) },
    { id: 'wend', name: 'the upper Wend', path: bankPath(wend, -1) },
    { id: 'saltings', name: 'the Saltings', path: [...ringPath(MARSH[0]), ...ringPath(MARSH[1])] },
  ].filter((B) => B.path.length > 6);
})();
export const HERON_SPOTS = [
  shallows(LAKE.x, LAKE.z, LAKE.rz * 0.7, LAKE.rx * 1.2, 6),
  [...SANDBANKS.flatMap((S) => shallows(S.x, S.z, S.rz, S.rx + 6, 2)), ...MARSH.flatMap((M) => shallows(M.x, M.z, M.r, M.r + 8, 2))],
];
export const PERCHES = [
  // (On the guano-whitened cap of each smaller stack: it stands a little proud of the stack's height.)
  ...STACKS.slice(1).map((s) => ({ x: s.x, z: s.z, y: s.h + 0.27 * s.r, high: true })),
  ...SKERRIES.slice(0, 3).map((k) => ({ x: k.x, z: k.z, y: Math.max(0.4, heightAt(k.x, k.z)) + 0.02 })),
  { x: CALF_SKERRY.x, z: CALF_SKERRY.z, y: Math.max(0.4, heightAt(CALF_SKERRY.x, CALF_SKERRY.z)) + 0.02 },
];
export const SHORES = [
  strandline(STRAND.x, STRAND.z, 4, 34, 6, 0.9),
  [...SANDBANKS.slice(0, 3).flatMap((S) => strandline(S.x, S.z, 0, S.rx, 2, 0.6))],
];

/* ---------------- building them, and their days ---------------- */

export function buildWildlife(scene) {
  const events = { onSighting: null, onCall: null, onMoment: null, onRipple: null, onSplash: null };
  const sight = (kind, x, z) => events.onSighting?.(kind, x, z);
  const call = (kind, x, z) => events.onCall?.(kind, x, z);
  const moment = (kind, text) => events.onMoment?.(kind, text);
  const add = (m) => {
    m.g.visible = false;
    scene.add(m.g);
    return m;
  };

  /* ---------- otters ---------- */
  const otters = OTTER_BEATS.slice(0, 3).map((B) => ({ ...add(otterModel()), B, state: 'away', t: rand(5, 40), i: Math.floor(Math.random() * B.path.length), dir: Math.random() < 0.5 ? 1 : -1, x: 0, y: 0, z: 0, heading: 0, fish: false, seen: false, ph: Math.random() * 10 }));
  const otterActive = (h) => 0.35 + 0.65 * Math.max(smoothstep(3.5, 5.5, h) * (1 - smoothstep(8, 10, h)), smoothstep(17.5, 19.5, h) * (1 - smoothstep(22.5, 24, h)));
  const stepOtters = (dt, t, ctx) => {
    for (const o of otters) {
      const P = o.B.path, d = Math.hypot(ctx.from.x - o.x, ctx.from.z - o.z);
      o.t -= dt;
      // Too close, or coming on too fast: under, and gone.
      const spook = o.state !== 'away' && o.state !== 'gone' && (d < (ctx.onFoot ? 14 : 9) || (d < 30 && ctx.speed > (ctx.onFoot ? 2.6 : 2.2)));
      if (spook) {
        if (o.state === 'swim' || o.state === 'eat') {
          events.onSplash?.(o.x, o.z, 0.3);
          if (d < 60) moment('otterGone', 'A swirl and a flip of a tail, and the otter’s gone. They don’t let you get close if they hear you coming.');
        }
        o.state = 'gone';
        o.t = rand(150, 320);
      }
      if (o.state === 'away' || o.state === 'gone') {
        o.g.visible = false;
        if (o.t > 0) continue;
        // Out again, when it's a good hour for it and you're somewhere about.
        const near = Math.hypot(ctx.from.x - P[o.i].x, ctx.from.z - P[o.i].z) < 600;
        if (near && Math.random() < otterActive(ctx.hour)) {
          o.i = Math.floor(Math.random() * P.length);
          Object.assign(o, { state: 'swim', t: rand(12, 30), x: P[o.i].x, z: P[o.i].z, fish: false });
        } else o.t = rand(30, 90);
        continue;
      }
      if (o.state === 'swim' || o.state === 'dive') {
        // Along the bank, a path point at a time.
        const next = P[(o.i + o.dir + P.length) % P.length];
        const dx = next.x - o.x, dz = next.z - o.z, l = Math.hypot(dx, dz);
        const sp = o.state === 'dive' ? 1.4 : 0.75;
        if (l < 0.6) {
          o.i = (o.i + o.dir + P.length) % P.length;
          if (o.i === 0 || o.i === P.length - 1) o.dir *= -1;
        } else {
          o.x += (dx / l) * sp * dt;
          o.z += (dz / l) * sp * dt;
          o.heading = dampAngle(o.heading, Math.atan2(dx, dz), 3, dt);
        }
      }
      if (o.state === 'swim' && o.t <= 0) {
        // Under: the tail flips up and it's gone for a while.
        o.state = 'dive';
        o.t = rand(8, 18);
        events.onSplash?.(o.x, o.z, 0.15);
      } else if (o.state === 'dive' && o.t <= 0) {
        // Up again; sometimes with a fish, and off to the bank with it.
        o.fish = Math.random() < 0.35;
        const p = P[o.i];
        if (o.fish && p.bx != null) {
          Object.assign(o, { state: 'toBank', t: 4, tx: p.bx, tz: p.bz });
        } else Object.assign(o, { state: 'swim', t: rand(10, 25) });
      } else if (o.state === 'toBank') {
        const dx = o.tx - o.x, dz = o.tz - o.z, l = Math.hypot(dx, dz);
        if (l < 0.3 || o.t <= 0) {
          Object.assign(o, { state: 'eat', t: rand(18, 35) });
          if (d < 70 && ctx.daylight > 0.08) moment('otterEat', 'An otter has hauled out on the bank with a fish, and is eating it, crunching, head on one side. Keep still and you can watch.');
        } else {
          o.x += (dx / l) * 0.9 * dt;
          o.z += (dz / l) * 0.9 * dt;
          o.heading = dampAngle(o.heading, Math.atan2(dx, dz), 4, dt);
        }
      } else if (o.state === 'eat' && o.t <= 0) {
        Object.assign(o, { state: 'swim', t: rand(10, 25), fish: false });
        const p = P[o.i];
        o.x = p.x;
        o.z = p.z;
        events.onSplash?.(o.x, o.z, 0.2);
      }
      // Drawn: low in the water swimming, a hump and the tail going under in a dive, up on its
      // haunches on the bank to eat.
      const show = d < 350 && o.state !== 'dive';
      o.g.visible = show;
      if (!show) continue;
      const onBank = o.state === 'eat' || (o.state === 'toBank' && heightAt(o.x, o.z) > waterLevel(o.x, o.z));
      const lvl = waterLevel(o.x, o.z);
      o.y = onBank ? heightAt(o.x, o.z) + 0.14 : lvl - 0.06 + Math.sin(t * 2 + o.ph) * 0.01;
      o.g.position.set(o.x, o.y, o.z);
      o.g.rotation.set(o.state === 'eat' ? -0.55 : -0.04, o.heading, 0);
      o.legs.visible = onBank;
      o.head.rotation.x = o.state === 'eat' ? 0.5 + Math.sin(t * 7) * 0.12 : Math.sin(t * 1.3 + o.ph) * 0.06;
      o.head.rotation.y = o.state === 'eat' ? Math.sin(t * 0.8) * 0.35 : 0;
      o.tail.rotation.y = Math.sin(t * 3 + o.ph) * (o.state === 'swim' ? 0.35 : 0.1);
      if (o.state === 'swim' && Math.random() < dt * 2) events.onRipple?.(o.x - Math.sin(o.heading) * 0.5, o.z - Math.cos(o.heading) * 0.5, lvl);
      if (d < (ctx.daylight > 0.1 ? 90 : 30)) {
        sight('otter', o.x, o.z);
        if (!o.seen) {
          o.seen = true;
          if (d < 90) moment('otter', `An otter, along the bank of ${o.B.name}: a long brown back, a flat head, a thick tail. It hasn’t seen you. Keep still.`);
        }
      }
      if (Math.random() < dt * 0.01 && d < 60) call('otter', o.x, o.z);
    }
  };

  /* ---------- herons ---------- */
  const herons = HERON_SPOTS.filter((S) => S.length > 1).map((S) => {
    const h = add(heronModel());
    const s = S[0];
    return { ...h, S, spot: 0, state: 'stand', t: rand(5, 15), x: s.x, z: s.z, y: 0, heading: Math.random() * 6.28, neckOut: 0, strike: 0, fly: null };
  });
  const stepHerons = (dt, t, ctx) => {
    for (const H of herons) {
      const d = Math.hypot(ctx.from.x - H.x, ctx.from.z - H.z);
      H.t -= dt;
      // Too close: it's off, croaking, to another of its shallows.
      const flush = !H.fly && H.state !== 'away' && (d < (ctx.onFoot ? (ctx.speed > 0.4 ? 32 : 20) : ctx.speed > 2 ? 45 : 22));
      if (flush) {
        // Somewhere well away from you; or, on a small water with nowhere far enough, right away
        // over the hill, back when you've gone.
        const far = H.S.map((p, i) => ({ p, i })).filter(({ p }) => Math.hypot(p.x - H.x, p.z - H.z) > 15 && Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) > 45);
        let to = far.length ? pick(far) : null;
        if (!to) {
          const a = Math.atan2(H.x - ctx.from.x, H.z - ctx.from.z);
          to = { p: { x: H.x + Math.sin(a) * 140, z: H.z + Math.cos(a) * 140 }, i: -1 };
        }
        H.fly = { fx: H.x, fz: H.z, tx: to.p.x, tz: to.p.z, i: to.i, k: 0, len: Math.hypot(to.p.x - H.x, to.p.z - H.z) };
        H.heading = Math.atan2(to.p.x - H.x, to.p.z - H.z);
        if (d < 120) call('heron', H.x, H.z);
      }
      if (H.fly) {
        const F = H.fly;
        F.k = Math.min(1, F.k + (dt * 5.5) / Math.max(20, F.len));
        H.x = lerp(F.fx, F.tx, F.k);
        H.z = lerp(F.fz, F.tz, F.k);
        H.y = Math.sin(F.k * Math.PI) * Math.min(14, F.len * 0.12) + (heightAt(H.x, H.z) > 0 ? heightAt(H.x, H.z) : 0);
        if (F.k >= 1) {
          H.fly = null;
          H.state = F.i < 0 ? 'away' : 'stand';
          H.t = F.i < 0 ? rand(150, 300) : rand(8, 20);
          if (F.i >= 0) H.spot = F.i;
        }
      } else if (H.state === 'away') {
        // (Gone over the hill; back to its shallows once you've moved on.)
        H.g.visible = false;
        const home = H.S[H.spot];
        if (H.t <= 0 && Math.hypot(ctx.from.x - home.x, ctx.from.z - home.z) > 70) {
          Object.assign(H, { x: home.x, z: home.z, state: 'stand', t: rand(8, 20) });
        }
        continue;
      } else {
        H.y = Math.max(heightAt(H.x, H.z), waterLevel(H.x, H.z) - 0.35);
        if (H.t <= 0) {
          const r = Math.random();
          if (H.state === 'stand') {
            H.state = r < 0.4 ? 'stalk' : 'strike';
            H.t = H.state === 'stalk' ? rand(3, 7) : 1.2;
          } else {
            if (H.state === 'strike' && Math.random() < 0.3 && d < 70 && ctx.daylight > 0.2) moment('heronFish', 'A heron, motionless all this time, jabs into the water and comes up with a little fish crosswise in its bill. A toss of the head, and it’s gone down.');
            H.state = 'stand';
            H.t = rand(6, 18);
          }
        }
        if (H.state === 'stalk') {
          // A slow step or two along the edge.
          const nx = H.x + Math.sin(H.heading) * 0.25 * dt, nz = H.z + Math.cos(H.heading) * 0.25 * dt;
          if (depthAt(nx, nz) < 0.45) {
            H.x = nx;
            H.z = nz;
          } else H.heading += 1.5;
        }
      }
      const show = d < 500;
      H.g.visible = show;
      if (!show) continue;
      H.g.position.set(H.x, H.y, H.z);
      H.g.rotation.set(H.fly ? 0.15 : 0, H.heading, 0);
      // Neck drawn in standing and flying, stretched forward stalking, jabbed down to strike.
      const strike = H.state === 'strike' && !H.fly ? Math.sin(clamp(1 - H.t / 1.2, 0, 1) * Math.PI) : 0;
      H.neck.rotation.x = H.fly ? 1.3 : H.state === 'stalk' ? 0.6 : 0.15 + strike * 1.6;
      H.neck.scale.y = H.fly ? 0.45 : H.state === 'stand' ? 0.75 : 1;
      H.head.rotation.x = H.fly ? -1.2 : -0.3 - strike * 0.5;
      H.legs.rotation.x = H.fly ? -1.4 : 0;
      H.wl.visible = H.wr.visible = !!H.fly;
      if (H.fly) {
        const f = Math.sin(t * 4.2) * 0.55;
        H.wl.rotation.z = f;
        H.wr.rotation.z = -f;
      }
      if (d < 140 && ctx.daylight > 0.15) sight('heron', H.x, H.z);
    }
  };

  /* ---------- cormorants ---------- */
  const cormorants = [];
  PERCHES.forEach((P, k) => {
    for (let n = 0; n < (P.high ? 2 : 1); n++) {
      const c = add(cormorantModel());
      cormorants.push({ ...c, P, kind: 'perch', dry: n === 0 && Math.random() < 0.7, x: P.x + (n ? 0.45 : 0), z: P.z + (n ? 0.2 : 0), y: P.y - (n ? 0.12 : 0), heading: rand(0, 6.28), t: rand(20, 60), fly: null, ph: Math.random() * 10, said: false });
    }
    if (k % 2 === 0) {
      const c = add(cormorantModel());
      cormorants.push({ ...c, P, kind: 'swim', x: P.x + 20, z: P.z + 12, y: 0, heading: 0, t: rand(5, 15), under: false, fly: null, ph: Math.random() * 10 });
    }
  });
  const stepCormorants = (dt, t, ctx) => {
    for (const C of cormorants) {
      const d = Math.hypot(ctx.from.x - C.x, ctx.from.z - C.z);
      C.t -= dt;
      if (C.kind === 'perch') {
        // Off the rock if you come at it fast and close; round in a loop and back again.
        if (!C.fly && d < (ctx.onFoot ? 15 : ctx.speed > 2.5 ? 35 : 14)) C.fly = { k: 0, a: Math.random() * 6.28 };
        if (C.fly) {
          C.fly.k += dt / 40;
          const a = C.fly.a + C.fly.k * Math.PI * 2, r = 60 * Math.sin(Math.min(1, C.fly.k) * Math.PI);
          const nx = C.P.x + Math.cos(a) * r, nz = C.P.z + Math.sin(a) * r;
          C.heading = Math.atan2(nx - C.x, nz - C.z);
          C.x = nx;
          C.z = nz;
          C.y = lerp(C.P.y, 4, Math.sin(Math.min(1, C.fly.k) * Math.PI));
          if (C.fly.k >= 1) {
            C.fly = null;
            Object.assign(C, { x: C.P.x, z: C.P.z, y: C.P.y });
          }
        } else if (C.t <= 0) {
          C.dry = !C.dry && Math.random() < 0.6;
          C.t = rand(30, 90);
        }
        if (C.dry && !C.fly && d < 90 && !C.said && ctx.daylight > 0.3) {
          C.said = true;
          moment('cormorantDry', 'A cormorant stands on the rock with its wings held wide open, hung out to dry like washing: their feathers soak through, which is how they dive so well.');
        }
      } else {
        // Fishing: low in the water, under for half a minute, up again a long way off.
        if (C.t <= 0) {
          C.under = !C.under;
          C.t = C.under ? rand(18, 35) : rand(8, 20);
          if (!C.under) {
            const a = Math.random() * 6.28, r = rand(12, 40);
            const nx = C.P.x + Math.cos(a) * r, nz = C.P.z + Math.sin(a) * r;
            if (depthAt(nx, nz) > 2) {
              C.x = nx;
              C.z = nz;
            }
            C.heading = rand(0, 6.28);
          } else events.onSplash?.(C.x, C.z, 0.12);
        }
        if (!C.under) {
          C.x += Math.sin(C.heading) * 0.35 * dt;
          C.z += Math.cos(C.heading) * 0.35 * dt;
          C.y = waveHeight(C.x, C.z, t) - 0.3;
        }
      }
      const show = d < 600 && ctx.daylight > 0.05 && !(C.kind === 'swim' && C.under);
      C.g.visible = show;
      if (!show) continue;
      C.g.position.set(C.x, C.y, C.z);
      C.g.rotation.set(C.fly ? 0.25 : 0, C.heading, 0);
      const drying = C.dry && !C.fly;
      const open = C.fly ? Math.sin(t * 9 + C.ph) * 0.5 : drying ? 0.35 + Math.sin(t * 0.7 + C.ph) * 0.06 : 0;
      C.wl.visible = C.wr.visible = !!C.fly || C.dry;
      C.wl.rotation.set(drying ? 1.35 : 0, 0, open);
      C.wr.rotation.set(drying ? 1.35 : 0, 0, -open);
      C.neck.rotation.x = C.kind === 'swim' ? -0.3 : C.fly ? 1.2 : Math.sin(t * 0.3 + C.ph) * 0.1;
      if (d < 160) sight('cormorant', C.x, C.z);
    }
  };

  /* ---------- terns (spring and summer) ---------- */
  const ternHomes = [{ x: BAY.x + 10, z: BAY.z + 20, r: 40 }, { x: STRAND.x + 10, z: STRAND.z + 30, r: 35 }];
  const terns = [];
  for (const H of ternHomes) for (let i = 0; i < 3; i++) terns.push({ ...add(ternModel()), H, a: Math.random() * 6.28, r: rand(10, H.r), y: rand(6, 10), sp: (Math.random() < 0.5 ? -1 : 1) * rand(6, 8), state: 'fly', t: rand(4, 12), ph: Math.random() * 10, x: H.x, z: H.z });
  const stepTerns = (dt, t, ctx) => {
    const season = ctx.season === 'spring' || ctx.season === 'summer';
    for (const T of terns) {
      const d = Math.hypot(ctx.from.x - T.x, ctx.from.z - T.z);
      const show = season && ctx.daylight > 0.3 && d < 450;
      T.g.visible = show;
      if (!show) continue;
      T.t -= dt;
      if (T.state === 'fly') {
        T.a += (T.sp / T.r) * dt;
        T.x = T.H.x + Math.cos(T.a) * T.r;
        T.z = T.H.z + Math.sin(T.a) * T.r;
        T.y = damp(T.y, 8 + Math.sin(t * 0.5 + T.ph) * 2, 1, dt);
        const dir = Math.sign(T.sp);
        T.g.rotation.set(0, Math.atan2(-Math.sin(T.a) * dir, Math.cos(T.a) * dir), -0.3 * dir);
        const f = Math.sin(t * 7 + T.ph) * 0.6;
        T.wl.rotation.z = f;
        T.wr.rotation.z = -f;
        if (T.t <= 0) {
          T.state = depthAt(T.x, T.z) > 1 ? 'hover' : 'fly';
          T.t = rand(1.2, 2.6);
          if (Math.random() < 0.4 && d < 150) call('tern', T.x, T.z);
        }
      } else if (T.state === 'hover') {
        T.g.rotation.x = -0.6;
        const f = Math.sin(t * 22 + T.ph) * 0.7;
        T.wl.rotation.z = f;
        T.wr.rotation.z = -f;
        if (T.t <= 0) {
          T.state = 'plunge';
          T.vy = 0;
        }
      } else if (T.state === 'plunge') {
        T.vy += 25 * dt;
        T.y -= T.vy * dt;
        T.g.rotation.x = 1.2;
        T.wl.rotation.z = 1.4;
        T.wr.rotation.z = -1.4;
        const s = waveHeight(T.x, T.z, t);
        if (T.y <= s) {
          events.onSplash?.(T.x, T.z, 0.1);
          if (d < 90) moment('ternDive', 'A tern hangs in the air over the shallows, flickering, and then drops like a stone into the water and is up again with a sand smelt.');
          T.state = 'rise';
          T.y = s;
          T.t = 1.5;
        }
      } else if (T.state === 'rise') {
        T.y += 4 * dt;
        T.g.rotation.x = -0.4;
        const f = Math.sin(t * 9 + T.ph) * 0.6;
        T.wl.rotation.z = f;
        T.wr.rotation.z = -f;
        if (T.t <= 0) {
          T.state = 'fly';
          T.t = rand(6, 16);
        }
      }
      T.g.position.set(T.x, T.y, T.z);
      if (d < 160) sight('tern', T.x, T.z);
    }
  };

  /* ---------- oystercatchers ---------- */
  const flocks = SHORES.filter((S) => S.length).map((S) => {
    const birds = [];
    for (let i = 0; i < 6; i++) birds.push({ ...add(oysterModel()), ox: rand(-3, 3), oz: rand(-3, 3), heading: rand(0, 6.28), probe: 0, ph: Math.random() * 10 });
    const s = S[0];
    return { S, i: 0, x: s.x, z: s.z, fly: null, birds };
  });
  const stepOysters = (dt, t, ctx) => {
    for (const F of flocks) {
      const d = Math.hypot(ctx.from.x - F.x, ctx.from.z - F.z);
      const spot = F.S[F.i];
      // (Their spot under water, with the tide up? Off to one that isn't.)
      const awash = !F.fly && heightAt(spot.x, spot.z) < (ctx.tideLevel || 0) + 0.04;
      const flush = !F.fly && (awash || d < (ctx.onFoot ? 24 : ctx.speed > 1.5 ? 35 : 18));
      if (flush) {
        // (Dry ground away from you: the furthest, if nowhere's far enough.)
        const dry = F.S.map((p, i) => ({ p, i, away: Math.hypot(p.x - ctx.from.x, p.z - ctx.from.z) })).filter(({ p, i }) => i !== F.i && heightAt(p.x, p.z) > (ctx.tideLevel || 0) + 0.06);
        const far = dry.filter((o) => o.away > 30);
        const to = far.length ? pick(far) : dry.sort((a, b) => b.away - a.away)[0] || null;
        if (to) {
          F.fly = { fx: F.x, fz: F.z, tx: to.p.x, tz: to.p.z, i: to.i, k: 0, len: Math.hypot(to.p.x - F.x, to.p.z - F.z) };
          if (d < 120) {
            call('oystercatcher', F.x, F.z);
            if (!awash) moment('oysterFly', 'The oystercatchers go up all at once and away low along the shore, piping, black and white wings flashing.');
          }
        }
      }
      if (F.fly) {
        const L = F.fly;
        L.k = Math.min(1, L.k + (dt * 9) / Math.max(20, L.len));
        F.x = lerp(L.fx, L.tx, L.k);
        F.z = lerp(L.fz, L.tz, L.k);
        if (Math.random() < dt * 1.5 && d < 150) call('oystercatcher', F.x, F.z);
        if (L.k >= 1) {
          F.i = L.i;
          F.fly = null;
        }
      }
      const show = d < 400 && ctx.daylight > 0.1;
      const heading = F.fly ? Math.atan2(F.fly.tx - F.fly.fx, F.fly.tz - F.fly.fz) : 0;
      for (const b of F.birds) {
        b.g.visible = show;
        if (!show) continue;
        const fy = F.fly ? 2 + Math.sin(F.fly.k * Math.PI) * 3 : 0;
        const x = F.x + b.ox, z = F.z + b.oz, gy = Math.max(heightAt(x, z), waterLevel(x, z) - 0.05);
        if (!F.fly) {
          // A few steps and a probe into the sand.
          b.probe = Math.max(0, Math.sin(t * 1.7 + b.ph * 3));
          b.heading = dampAngle(b.heading, b.heading + Math.sin(t * 0.3 + b.ph) * 0.4, 1, dt);
          b.g.position.set(x, gy, z);
          b.g.rotation.set(b.probe * 0.6, b.heading, 0);
          b.wl.visible = b.wr.visible = false;
        } else {
          b.g.position.set(x, gy + fy + b.oz * 0.1, z);
          b.g.rotation.set(0, heading, 0);
          b.wl.visible = b.wr.visible = true;
          const f = Math.sin(t * 12 + b.ph) * 0.6;
          b.wl.rotation.z = f;
          b.wr.rotation.z = -f;
        }
      }
      if (show && d < 130) sight('oystercatcher', F.x, F.z);
    }
  };

  const all = () => [...otters.map((o) => ({ kind: 'otter', g: o.g, r: 45 })), ...herons.map((h) => ({ kind: 'heron', g: h.g, r: 90 })), ...cormorants.map((c) => ({ kind: 'cormorant', g: c.g, r: 90 })), ...terns.map((t) => ({ kind: 'tern', g: t.g, r: 70 })), ...flocks.flatMap((f) => f.birds.map((b) => ({ kind: 'oystercatcher', g: b.g, r: 60 })))];

  return {
    ...events, otters, herons, cormorants, terns, flocks,
    // The kinds in a photograph: in frame, and near enough to make out.
    inFrame(frustum, cam) {
      const out = new Set();
      for (const A of all()) {
        if (!A.g.visible || out.has(A.kind)) continue;
        A.g.getWorldPosition(_f);
        if (_f.distanceTo(cam) < A.r && frustum.containsPoint(_f)) out.add(A.kind);
      }
      return [...out];
    },
    // ctx: { from, onFoot, speed (how fast you're moving), daylight, hour, season, tideLevel,
    // region }.
    update(dt, t, ctx) {
      for (const k of Object.keys(events)) events[k] = this[k];
      if (ctx.region === 'south') {
        for (const A of all()) A.g.visible = false;
        return;
      }
      stepOtters(dt, t, ctx);
      stepHerons(dt, t, ctx);
      stepCormorants(dt, t, ctx);
      stepTerns(dt, t, ctx);
      stepOysters(dt, t, ctx);
    },
  };
}
