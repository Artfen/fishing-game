// The showcase reef and kelp (world depth A3): fish that go round the rock of the dive sites rather
// than through it (the shared fish, world/ecosystem.js; the reef's own small fish, world/drifters.js;
// the rock itself, world/divesites.js pushOut); the crevices of Skerries Reef with their crabs and
// lobsters, its shallow rock tops with barnacles and mussels, richer in the arch's shelter (world/
// divesiteWorld.js); and all of it in the naturalist's notes and the journal's tree.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const THREE = await import('three');
const D = await import('../src/world/divesites.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { Drifters } = await import('../src/world/drifters.js');
const { buildDiveSites } = await import('../src/world/divesiteWorld.js');
const { NATURE } = await import('../src/grounds.js');
const T = await import('../src/taxonomy.js');
const { seeded } = await import('../src/util.js');
const { heightAt } = await import('../src/world/terrain.js');
const habitat = createHabitat();

test('every boulder of the dive sites is solid to anything that asks, quickly (the rock by cells)', () => {
  for (const o of D.ROCKS) {
    const p = { x: o.x + o.r * 0.4, y: o.y, z: o.z };
    assert.ok(D.pushOut(p, 0.2), `inside the rock at ${o.x.toFixed(0)}, ${o.z.toFixed(0)}`);
    // (Out of it, and out of any boulder it leans on: asked again, nothing moves it.)
    assert.ok(!D.pushOut({ ...p }, 0.05), `out to the face at ${o.x.toFixed(0)}, ${o.z.toFixed(0)}`);
  }
  assert.equal(D.pushOut({ x: 0, y: -2, z: 0 }), false, 'nothing far from any site');
});

test('the shared fish go round the rock at Skerries Reef, not through it', () => {
  const eco = new Ecosystem(habitat);
  const S = D.siteById.reef;
  const ctx = { env: { hour: 11, rain: 0, cloud: 0.3, daylight: 1, night: 0, hatch: 0 }, focus: { x: S.x, z: S.z }, boat: { x: S.x + 30, z: S.z, speed: 0 }, walker: null, lights: [] };
  let inside = 0, n = 0;
  for (let i = 0; i < 30 * 30; i++) {
    eco.update(1 / 30, ctx);
    if (i % 10) continue;
    for (const a of eco.agents) {
      if (Math.hypot(a.x - S.x, a.z - S.z) > 60) continue;
      n++;
      if (D.pushOut({ x: a.x, y: a.y, z: a.z }, 0)) inside++;
    }
  }
  // (Before: 0.65% of the time inside a boulder, swimming through it.)
  assert.ok(n > 5000 && inside / n < 0.002, `${inside} of ${n} looks inside the rock`);
});

test('the reef’s own small fish go round the boulders too (and the arch, and the Hound)', () => {
  let inside = 0, n = 0;
  const m = new THREE.Matrix4(), p = new THREE.Vector3();
  for (const id of ['reef', 'kelp', 'hound']) {
    const S = D.siteById[id];
    const Dr = new Drifters(new THREE.Scene(), habitat);
    const cam = { position: new THREE.Vector3(S.x, -4, S.z) };
    Dr.update(1 / 30, 0, cam, 1, 140 * 24 + 12);
    for (let i = 0; i < 120; i++) {
      Dr.animate(1 / 30, i / 30, cam.position);
      if (i % 10) continue;
      for (const R of Object.values(Dr.reefMesh)) {
        if (!R) continue;
        for (let k = 0; k < R.m.count; k++) {
          R.m.getMatrixAt(k, m);
          p.setFromMatrixPosition(m);
          n++;
          if (D.pushOut({ x: p.x, y: p.y, z: p.z }, 0)) inside++;
        }
      }
    }
  }
  // (Before: 3% of them inside a boulder at any moment.)
  assert.ok(n > 5000 && inside / n < 0.002, `${inside} of ${n}`);
});

test('Skerries Reef’s crevices: crabs and lobsters at the foot of the boulders; barnacles and mussels on the shallow tops', () => {
  const W = buildDiveSites(new THREE.Scene(), seeded(20261026));
  const S = D.siteById.reef;
  const found = W.kindsNear({ x: S.x, y: -5, z: S.z }, 40);
  for (const k of ['ediblecrab', 'velvetcrab', 'barnacle', 'bluemussel', 'lobster']) assert.ok(found.has(k), `${k} at Skerries Reef`);
  for (const k of ['ediblecrab', 'velvetcrab', 'barnacle', 'bluemussel']) {
    assert.ok(NATURE[k]?.note.length > 60, `${k}: in the notes`);
    const e = T.species().find((x) => x.key === `nature:${k}`);
    assert.ok(e && e.sci && T.FAMILIES[e.family] && T.ORDERS[e.order] && T.CLASSES[e.cls], `${k}: in the tree`);
  }
  assert.equal(T.species().find((x) => x.key === 'nature:barnacle').cls, 'thecostraca');
});
