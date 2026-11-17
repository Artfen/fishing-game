// Boats kept apart (src/apart.js): found playing the brief's Part J day through (docs/PLAYTHROUGH.md).
// One boat's position gone wrong (not a number) used to spread to every boat it was compared with,
// anywhere, in the same frame: the RIB, out at sea or on the beach, suddenly nowhere, and the game
// stopped on the next sound it set from where she was. Now a pair is only pushed apart if their
// distance is a real number and less than their beams allow; and a boat left nowhere is put back
// where she last was. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { keepApart, keepFinite, APART_K } = await import('../src/apart.js');

const boat = (x, z, B = 1, vx = 0, vz = 0) => ({ pos: { x, z }, vel: { x: vx, z: vz }, hull: { B } });

test('two hulls too close are pushed apart half each, and lose their speed towards each other', () => {
  const A = boat(0, 0, 1, 2, 0), B = boat(1, 0, 1, -1, 0);
  keepApart([A, B]);
  const gap = 2 * APART_K;
  assert.ok(Math.abs(B.pos.x - A.pos.x - gap) < 1e-9, 'apart by the gap');
  assert.ok(Math.abs(A.pos.x + B.pos.x - 1) < 1e-9, 'each moved half');
  assert.equal(A.vel.x, 0, 'no speed towards her');
  assert.equal(B.vel.x, 0);
  // (Speed away from each other kept.)
  const C = boat(0, 0, 1, -2, 0), D = boat(1, 0, 1, 3, 0);
  keepApart([C, D]);
  assert.deepEqual([C.vel.x, D.vel.x], [-2, 3]);
});

test('boats far enough apart, or exactly on top of each other, are left as they are', () => {
  const A = boat(0, 0), B = boat(10, 0);
  keepApart([A, B]);
  assert.deepEqual([A.pos.x, B.pos.x], [0, 10]);
  const C = boat(5, 5), D = boat(5, 5);
  keepApart([C, D]);
  assert.deepEqual([C.pos.x, C.pos.z, D.pos.x, D.pos.z], [5, 5, 5, 5]);
});

test('one boat whose position has gone wrong doesn’t take the others with it', () => {
  const lost = boat(NaN, NaN), rib = boat(40, -55), skiff = boat(-76, -4), near = boat(41, -55);
  keepApart([lost, rib, skiff, near]);
  for (const b of [rib, skiff, near]) assert.ok(Number.isFinite(b.pos.x) && Number.isFinite(b.pos.z), JSON.stringify(b.pos));
  assert.ok(Number.isFinite(rib.vel.x) && Number.isFinite(near.vel.x));
  // (And the two good ones still kept apart from each other.)
  assert.ok(Math.hypot(near.pos.x - rib.pos.x, near.pos.z - rib.pos.z) >= 2 * APART_K - 1e-9);
  // (A beam that isn't a number is the same: left alone.)
  const odd = { pos: { x: 40.5, z: -55 }, vel: { x: 0, z: 0 }, hull: {} };
  const R = boat(40, -55);
  keepApart([odd, R]);
  assert.deepEqual([R.pos.x, R.pos.z], [40, -55]);
});

test('a boat left nowhere is put back where she last was; the rest are let be', () => {
  const rib = { ...boat(40, -55), heading: 1.2 }, skiff = { ...boat(-76, -4), heading: 0.3 };
  const lost = [];
  const put = (b, at) => lost.push([b, at && { ...at }]);
  keepFinite([rib, skiff], put);
  assert.equal(lost.length, 0, 'all where they should be');
  // (The skiff's gone wrong this frame.)
  skiff.pos.x = NaN;
  keepFinite([rib, skiff], put);
  assert.equal(lost.length, 1);
  assert.equal(lost[0][0], skiff);
  assert.deepEqual(lost[0][1], { x: -76, z: -4, h: 0.3 }, 'where she last was');
  // (A heading that's gone wrong is the same.)
  rib.heading = Infinity;
  keepFinite([rib], put);
  assert.equal(lost[1][0], rib);
  assert.deepEqual(lost[1][1], { x: 40, z: -55, h: 1.2 });
  // (Never anywhere at all: nowhere to put her back to, said as null.)
  const fresh = { ...boat(NaN, NaN), heading: 0 };
  keepFinite([fresh], put);
  assert.equal(lost[2][1], null);
});
