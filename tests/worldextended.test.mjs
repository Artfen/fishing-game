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

// W3: far coordinates kept in range.
test('every sea, its tiles and its charts lie where the shaders keep home\'s precision', async () => {
  const T = await import('../src/world/terrain.js');
  const { SOUTH_RECT, SOUTH_MAP } = await import('../src/world/brasa.js');
  const N = await import('../src/world/north.js');
  const { NORTH_TILES } = await import('../src/world/world.js');
  const { SHEET, OCEAN_SHEET, WORLD_SHEET } = await import('../src/map.js');
  // (The water's finest noise works on about 5.3 times the absolute position, in 32-bit floats: below
  // 65,536 it keeps the same steps it has at home, which is within about 12.4 km of the middle.)
  const LIMIT = 65536 / 5.3;
  const corners = (R) => (R.x0 != null ? [[R.x0, R.z0], [R.x1, R.z0], [R.x0, R.z1], [R.x1, R.z1]] : [[R.x, R.z], [R.x + R.w, R.z], [R.x, R.z + R.h], [R.x + R.w, R.z + R.h]]);
  const all = { WORLD: T.WORLD, SEA: T.SEA, CROSSING: T.CROSSING, SOUTH_RECT, SOUTH_MAP, NORTH_RECT: N.NORTH_RECT, NORTH_WATER: N.NORTH_WATER, COAST_SHEET: N.COAST_SHEET, ISLES_MAP: N.ISLES_MAP, SHEET, OCEAN_SHEET, WORLD_SHEET };
  NORTH_TILES.forEach((R, i) => { all[`tile ${i}`] = R; });
  for (const [name, R] of Object.entries(all)) {
    for (const [x, z] of corners(R)) assert.ok(Math.abs(x) < LIMIT && Math.abs(z) < LIMIT, `${name}: (${x}, ${z}) in range`);
  }
  // A vertex out there still resolves to a millimetre.
  for (const v of [-8160, 7680, -4800]) assert.notEqual(Math.fround(v + 0.001), Math.fround(v), `${v}`);
  // And the whole chart takes in every other sheet.
  const inWorld = (R) => corners(R).every(([x, z]) => x >= WORLD_SHEET.x && x <= WORLD_SHEET.x + WORLD_SHEET.w && z >= WORLD_SHEET.z && z <= WORLD_SHEET.z + WORLD_SHEET.h);
  for (const R of [SHEET, OCEAN_SHEET, SOUTH_MAP, N.COAST_SHEET, N.ISLES_MAP]) assert.ok(inWorld(R), 'on the whole chart');
  for (const k of ['w', 'h']) assert.equal(WORLD_SHEET[k] % WORLD_SHEET.grid, 0, 'a whole number of its grid');
});
