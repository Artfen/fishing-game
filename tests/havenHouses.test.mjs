// Willowhaven's buildings (world/havenHouses.js), and the two you can walk into: the chandlery and
// The Lobster Pot. Their floors level; the way in by the door and nowhere else; everything you use
// inside within reach of someone your size; and the roof and the near wall stepping aside while
// you're in. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const H = await import('../src/world/havenHouses.js');
const T = await import('../src/world/terrain.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const RADIUS = 0.3; // the walker's (see walker.js)

// Everywhere someone your size can stand, round a room and a little way out of its door: a flood
// fill over a fine grid, from just inside the door.
function reach(R, { shutDoor = false } = {}) {
  const s = 0.08, pad = 2.5;
  const x0 = R.x0 - pad, z0 = R.z0 - pad, nx = Math.ceil((R.x1 - R.x0 + pad * 2) / s), nz = Math.ceil((R.z1 - R.z0 + pad * 2) / s);
  const near = coast.obstacles.filter((o) => o.x > x0 - 2 && o.x < x0 + nx * s + 2 && o.z > z0 - 2 && o.z < z0 + nz * s + 2);
  const free = (x, z) => {
    if (shutDoor && Math.abs(x - R.doorX) < 0.8 && z > R.z1 - 0.2 && z < R.front + 0.4) return false;
    for (const o of near) if (Math.hypot(x - o.x, z - o.z) < o.r + RADIUS) return false;
    return true;
  };
  const seen = new Uint8Array(nx * nz), out = [];
  const start = [Math.round((R.doorX - x0) / s), Math.round((R.z1 - 0.7 - z0) / s)];
  const q = [start];
  seen[start[1] * nx + start[0]] = 1;
  while (q.length) {
    const [i, k] = q.pop();
    const x = x0 + i * s, z = z0 + k * s;
    out.push({ x, z });
    for (const [di, dk] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const a = i + di, b = k + dk;
      if (a < 0 || b < 0 || a >= nx || b >= nz || seen[b * nx + a]) continue;
      seen[b * nx + a] = 1;
      if (free(x0 + a * s, z0 + b * s)) q.push([a, b]);
    }
  }
  return out;
}

test('the chandlery and the inn stand level, at the quay’s height, inside and round the door', () => {
  for (const R of Object.values(H.HAVEN_ROOMS)) {
    for (let x = R.x0 - 0.5; x <= R.x1 + 0.5; x += 0.3) {
      for (let z = R.z0 - 0.5; z <= R.front + 0.5; z += 0.3) assert.ok(Math.abs(T.heightAt(x, z) - R.y) < 0.01, `${R.id} level at ${x.toFixed(1)}, ${z.toFixed(1)}`);
    }
  }
});

test('in by the door and nowhere else, and everything inside within reach', () => {
  for (const R of Object.values(H.HAVEN_ROOMS)) {
    const cells = reach(R);
    const inside = cells.filter((c) => H.insideHaven(c.x, c.z) === R.id);
    assert.ok(inside.length > 200, `${R.id}: room to move`);
    assert.ok(cells.some((c) => c.z > R.front + 1), `${R.id}: out of the door onto the quay`);
    for (const sp of H.ROOM_SPOTS.filter((q) => q.room === R.id)) {
      assert.ok(inside.some((c) => Math.hypot(c.x - sp.x, c.z - sp.z) < sp.r - 0.05), `${R.id}: you can get to ${sp.name}`);
    }
    // With the door shut, there's no way out: the walls hold all round.
    const shut = reach(R, { shutDoor: true });
    assert.ok(shut.every((c) => c.x > R.x0 - 0.35 && c.x < R.x1 + 0.35 && c.z > R.z0 - 0.35 && c.z < R.z1 + 0.35), `${R.id}: no way through the walls`);
  }
});

test('while you’re inside, the roof lifts away and the wall facing the camera steps aside', () => {
  const houses = coast.houses;
  const R = H.HAVEN_ROOMS.inn, mid = { x: (R.x0 + R.x1) / 2, z: (R.z0 + R.z1) / 2 };
  houses.update(0.1, 1, { from: mid, cam: { x: mid.x, z: R.front + 6 }, cutaway: true });
  const room = houses.rooms.inn;
  assert.equal(room.top.visible, false);
  assert.equal(room.sides.front.visible, false);
  assert.ok(room.sides.back.visible && room.sides.left.visible && room.sides.right.visible);
  // The chandlery, meanwhile, stays as it is.
  assert.ok(houses.rooms.chandlery.top.visible);
  // Looking out through your own eyes (first person), everything stays.
  houses.update(0.1, 1, { from: mid, cam: { x: mid.x, z: mid.z }, cutaway: false });
  assert.ok(room.top.visible && room.sides.front.visible);
  // Outside again: whole.
  houses.update(0.1, 1, { from: { x: R.doorX, z: R.front + 4 }, cam: { x: R.doorX, z: R.front + 10 }, cutaway: true });
  assert.ok(room.top.visible && Object.values(room.sides).every((g) => g.visible));
});

test('every building has a door, and stands clear of the quay’s paths', () => {
  for (const b of T.HAVEN_HOUSES) assert.ok(coast.spots.some((q) => q.kind === 'door' && q.id === b.id), `${b.id}: a door`);
  // The places you're sent: the market, the board, the bench, the fuel pump; none inside a wall.
  for (const q of coast.spots.filter((s) => ['market', 'board', 'bench'].includes(s.kind))) {
    assert.ok(!coast.obstacles.some((o) => o.kind === 'building' && Math.hypot(q.x - o.x, q.z - o.z) < o.r), q.kind);
  }
});
