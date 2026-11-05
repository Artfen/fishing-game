// Spray from where a hull meets the water (src/spray.js): none from a boat at rest, more the
// faster she goes, from her waterline on both sides alike on a straight run, out across the water,
// and a burst when she drops into the sea.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat } = await import('../src/boat.js');
const { conditions } = await import('../src/world/conditions.js');
const { sprayPoints, sprayRate, sprayVelocity } = await import('../src/spray.js');

const scene = new THREE.Scene();
let clock = 0;
const calm = () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
};
const run = (b, secs, lever = 0) => {
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    b.update(1 / 30, clock, lever, 0, 0);
  }
  return b;
};
const boatAt = (kind) => {
  const b = new Boat(scene, { kind });
  b.place(150, 330, 0);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};
const total = (b) => sprayPoints(b._phys).reduce((a, p) => a + sprayRate(p), 0);

test('no spray from a boat lying still; plenty from one flat out, more the faster she goes', () => {
  calm();
  const rib = run(boatAt('rib'), 4);
  assert.equal(total(rib), 0, 'at rest');
  run(rib, 6, 0.35);
  const slow = total(rib);
  run(rib, 20, 1);
  const fast = total(rib);
  assert.ok(fast > 60 && fast > slow * 2, `slow ${slow.toFixed(0)}/s, flat out ${fast.toFixed(0)}/s`);
  // (A rowing boat at her pace barely disturbs the water.)
  const row = run(boatAt('row'), 20, 1);
  assert.ok(total(row) < fast / 5);
});

test('it comes off her waterline, on both sides alike on a straight run, thrown out across the water', () => {
  calm();
  const b = run(boatAt('console'), 20, 1);
  const pts = sprayPoints(b._phys);
  assert.ok(pts.length >= 6);
  let port = 0, star = 0;
  for (const p of pts) {
    const v = b.body.worldToLocal(new THREE.Vector3(p.x, p.y, p.z));
    // (On the hull: within her length and beam, at the water.)
    assert.ok(Math.abs(v.z) < b.hull.L / 2 + 0.2 && Math.abs(v.x) < b.hull.B + 0.2, `on her: ${v.x.toFixed(2)}, ${v.z.toFixed(2)}`);
    assert.ok(Math.abs(p.y) < 0.6, `at the water: ${p.y.toFixed(2)}`);
    if (v.x > 0) port += p.w; else star += p.w;
    // The drops fly outward (across the water from the hull) and up.
    const d = sprayVelocity(p, b.vel.x, b.vel.z, 0.5, 0.5);
    assert.ok(d[1] > 0);
    assert.ok((d[0] - b.vel.x * 0.3) * p.nx + (d[2] - b.vel.z * 0.3) * p.nz > 0);
  }
  assert.ok(Math.abs(port - star) < 0.35 * (port + star), `port ${port.toFixed(2)}, starboard ${star.toFixed(2)}`);
});

test('a hull dropping into the sea throws a burst', () => {
  calm();
  const b = run(boatAt('rib'), 4);
  // (Lifted clear and falling: she lands flat at 4 m/s.)
  b._phys.x[1] += 0.5;
  b._phys.v[1] = -4;
  let most = 0;
  for (let i = 0; i < 12; i++) {
    run(b, 1 / 30);
    most = Math.max(most, total(b));
  }
  assert.ok(most > 150, `${most.toFixed(0)} drops a second as she lands`);
});
