// Where a sound comes from (src/earshot.js): the side it's heard on, how loud and how dull with
// distance and walls, and the water's edge along a quay.
import test from 'node:test';
import assert from 'node:assert/strict';
import { hear, earOf, edgeNear, quayNear, nearestOf, BRIGHT } from '../src/earshot.js';

// Facing north (-z, the way the camera looks by default): east (+x) is on your right.
const north = earOf(0, 0, 0, -1);

test('a sound on your right is heard on the right, and on the left when you turn round', () => {
  assert.ok(hear(north, 20, 0).pan > 0.8);
  assert.ok(hear(north, -20, 0).pan < -0.8);
  const south = earOf(0, 0, 0, 1);
  assert.ok(hear(south, 20, 0).pan < -0.8);
  // Dead ahead or behind: in the middle.
  assert.ok(Math.abs(hear(north, 0, -20).pan) < 1e-9);
  assert.ok(Math.abs(hear(north, 0, 20).pan) < 1e-9);
});

test('close in a sound fills both ears; far off it fades and dulls, and is gone past far', () => {
  assert.ok(Math.abs(hear(north, 0.3, 0).pan) < 0.1);
  const near = hear(north, 2, -1, { near: 3, far: 60 }), mid = hear(north, 20, -10, { near: 3, far: 60 }), farOff = hear(north, 40, -20, { near: 3, far: 60 });
  assert.equal(near.vol, 1);
  assert.ok(mid.vol < near.vol && farOff.vol < mid.vol && farOff.vol > 0);
  assert.ok(mid.lp < BRIGHT && farOff.lp < mid.lp);
  assert.equal(hear(north, 70, 0, { far: 60 }).vol, 0);
});

test('behind you is a little duller than in front; through a wall much quieter and duller', () => {
  assert.ok(hear(north, 0, 15).lp < hear(north, 0, -15).lp);
  const open = hear(north, 10, 0), walled = hear(north, 10, 0, { walls: 1 });
  assert.ok(walled.vol < open.vol * 0.35 && walled.lp <= 700);
});

test('a camera looking straight down falls back on the way you face', () => {
  const e = earOf(5, 5, 0, 0, Math.PI / 2);
  assert.ok(Math.abs(e.fx - 1) < 1e-9 && Math.abs(e.fz) < 1e-9);
});

test('the water’s edge along a quay: from off it, the nearest point; from on it, the nearest side', () => {
  const Q = { x0: 0, x1: 4, z0: 0, z1: 30 };
  assert.deepEqual(edgeNear(Q, 10, 12), { x: 4, z: 12, d: 6 });
  const on = edgeNear(Q, 1, 15);
  assert.equal(on.x, 0);
  assert.equal(on.d, 1);
  assert.equal(quayNear([Q], 100, 100, 45), null);
  assert.equal(quayNear([Q, { x0: 8, x1: 9, z0: 0, z1: 30 }], 7, 5).x, 8);
});

test('the nearest few of a list, within reach, nearest first', () => {
  const L = [{ x: 30, z: 0 }, { x: 5, z: 0 }, { x: 100, z: 0 }, { x: 10, z: 0 }];
  assert.deepEqual(nearestOf(L, 0, 0, 2, 50), [{ x: 5, z: 0 }, { x: 10, z: 0 }]);
  assert.equal(nearestOf(L, 0, 0, 9, 50).length, 3);
});
