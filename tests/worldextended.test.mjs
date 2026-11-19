// The world extended (docs/WORLD.md): W1, a far sea's things let go and made again the same when
// you come back; W2, the passage speed-up; W3, far coordinates kept in range.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { seeded } = await import('../src/util.js');
// A fingerprint of everything a far sea's builder makes: every mesh's vertices and every instance's
// place.
function print(group) {
  let h = 2166136261;
  const mix = (v) => { const s = v.toFixed(2); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } };
  const m = new THREE.Matrix4();
  group.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position.array;
    for (let i = 0; i < p.length; i += 97) mix(p[i]);
    if (o.isInstancedMesh) for (let i = 0; i < o.count; i += 7) { o.getMatrixAt(i, m); mix(m.elements[12]); mix(m.elements[14]); }
  });
  return h;
}

test('a far sea\'s things, let go and made again, come back the same: Las Brasas\' and the north\'s', async () => {
  const { buildBrasa } = await import('../src/world/brasaWorld.js');
  const { buildNorth } = await import('../src/world/northWorld.js');
  for (const [name, build, seed] of [['Las Brasas', buildBrasa, 20261025], ['the north', buildNorth, 20261118]]) {
    const a = build(new THREE.Scene(), seeded(seed)), b = build(new THREE.Scene(), seeded(seed));
    assert.equal(print(a.group), print(b.group), `${name}: the same things in the same places`);
    assert.deepEqual(a.obstacles.map((o) => [o.x, o.z, o.r]), b.obstacles.map((o) => [o.x, o.z, o.r]), `${name}: the same obstacles`);
  }
});

test('their obstacles taken back out: none left behind, none doubled when they come back', async () => {
  const { ObstacleGrid } = await import('../src/world/world.js');
  const G = new ObstacleGrid();
  const home = G.add(10, 10, 1, Infinity, -Infinity, 'tree', 'an oak');
  const far = [G.add(500, 6300, 2, Infinity, -Infinity, 'building', 'a house'), G.add(503, 6301, 0.5, Infinity, -Infinity, 'tree', 'a palm')];
  assert.equal(G.near(501, 6300, 4).length, 2);
  for (const o of far) G.remove(o);
  assert.equal(G.near(501, 6300, 4).length, 0, 'gone');
  assert.deepEqual(G.near(10, 10, 2).map((o) => o.name), ['an oak'], 'home\'s untouched');
  // Back again: the same once, not twice.
  const again = [G.add(500, 6300, 2), G.add(503, 6301, 0.5)];
  assert.equal(G.near(501, 6300, 4).length, 2);
  for (const o of again) G.remove(o);
  G.remove(home);
  assert.equal(G.cells.size, 0, 'nothing left in the grid');
});
