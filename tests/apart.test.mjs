// Boats kept apart (src/apart.js): found playing the brief's Part J day through (docs/PLAYTHROUGH.md).
// One boat's position gone wrong (not a number) used to spread to every boat it was compared with,
// anywhere, in the same frame: the RIB, out at sea or on the beach, suddenly nowhere, and the game
// stopped on the next sound it set from where she was. Now a pair is only pushed apart if their
// distance is a real number and less than their beams allow; and a boat left nowhere is put back
// where she last was. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { keepApart, keepFinite, keepClear, APART_K, CLEAR_K } = await import('../src/apart.js');

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

// (J1c) Yours eased clear of a friend's boat, which only their game moves (and see
// tests/overlap.test.mjs: the physics of it).
test('yours slides clear of a friend’s boat drawn on top of her, all of the way; theirs isn’t moved', () => {
  const mine = boat(0.4, 0, 0.8, -1, 0.5), theirs = boat(0, 0, 0.8);
  const gap = 1.6 * CLEAR_K;
  let n = 0;
  while (Math.hypot(mine.pos.x - theirs.pos.x, mine.pos.z - theirs.pos.z) < gap - 1e-3 && n < 300) {
    keepClear([mine], [theirs], 1 / 30);
    n++;
  }
  assert.ok(n > 3 && n < 40, `slid out over a moment, not jumped: ${n} frames`);
  assert.ok(Math.abs(mine.pos.z) < 1e-9 && mine.pos.x > 0, 'along the line between them');
  assert.deepEqual([theirs.pos.x, theirs.pos.z, theirs.vel.x], [0, 0, 0], 'theirs left where it’s said to be');
  assert.deepEqual([mine.vel.x, mine.vel.z], [0, 0.5], 'her speed towards theirs gone; the rest kept');
  // (Moving away already: her speed kept.)
  const away = boat(0.4, 0, 0.8, 2, 0);
  keepClear([away], [theirs], 1 / 30);
  assert.equal(away.vel.x, 2);
  // (Clear: never pulled closer.)
  const clear = boat(gap + 0.5, 0, 0.8);
  keepClear([clear], [theirs], 1 / 30);
  assert.deepEqual([clear.pos.x, clear.pos.z], [gap + 0.5, 0]);
});

test('a boat with a body is moved with it; exactly on top, she goes out some way', () => {
  const moved = [];
  const mine = { ...boat(0.3, 0.2, 0.8), shift(dx, dz) { moved.push([dx, dz]); this.pos.x += dx; this.pos.z += dz; } };
  const theirs = boat(0, 0, 0.8);
  keepClear([mine], [theirs], 1 / 30);
  assert.equal(moved.length, 1, 'through her own shift');
  for (let i = 0; i < 60; i++) keepClear([mine], [theirs], 1 / 30);
  assert.ok(Math.hypot(mine.pos.x, mine.pos.z) >= 1.6 * CLEAR_K - 1e-3);
  // (Exactly on top: out to some side, any, and clear in the end.)
  const top = boat(0, 0, 0.8);
  for (let i = 0; i < 60; i++) keepClear([top], [theirs], 1 / 30);
  assert.ok(Math.hypot(top.pos.x, top.pos.z) >= 1.6 * CLEAR_K - 1e-3, JSON.stringify(top.pos));
});

test('boats lying side by side at a pontoon, one tied up, or one lost are left be', () => {
  const theirs = boat(0, 0, 0.95);
  // (Side by side as main.js freeOwnBerth lays them: their two half-beams and a little.)
  const along = boat(0, (0.8 + 0.95) * 1.05, 0.8);
  keepClear([along], [theirs], 1 / 30);
  assert.deepEqual([along.pos.x, along.pos.z], [0, (0.8 + 0.95) * 1.05]);
  // (Tied up: held by her lines, not strained against them.)
  const tied = { ...boat(0.3, 0, 0.8), tie: { pier: 0 } };
  keepClear([tied], [theirs], 1 / 30);
  assert.deepEqual([tied.pos.x, tied.pos.z], [0.3, 0]);
  // (One whose position isn't a number: left for keepFinite, the friend's left alone.)
  const lost = boat(NaN, NaN, 0.8);
  keepClear([lost], [theirs], 1 / 30);
  assert.deepEqual([theirs.pos.x, theirs.pos.z], [0, 0]);
  assert.ok(Number.isNaN(lost.pos.x));
  // (Her own boat in both lists: not eased clear of herself.)
  const self = boat(1, 1, 0.8);
  keepClear([self], [self], 1 / 30);
  assert.deepEqual([self.pos.x, self.pos.z], [1, 1]);
});

test('once started, she slides on until clear of all of hers, then touches as ever; one gone is let go', () => {
  // (Two long narrow hulls, side by side, half a beam over each other: begun inside their two
  // half-beams, she goes on past it until clear, not stopping there with them still overlapped.)
  const hull = { B: 0.8, L: 3.8, hw: () => 1 };
  const theirs = { pos: { x: 0, z: 0 }, vel: { x: 0, z: 0 }, hull, heading: 0 };
  const mine = { pos: { x: 0.8, z: 0.4 }, vel: { x: 0, z: 0 }, hull, heading: 0.4 };
  keepClear([mine], [theirs], 1 / 30);
  assert.equal(mine.clearOf, theirs, 'begun: she’s not touching hers');
  let n = 0;
  while (mine.clearOf && n < 200) { keepClear([mine], [theirs], 1 / 30); n++; }
  assert.equal(mine.clearOf, null, 'done');
  assert.ok(n < 45, `in a second or so: ${n} frames`);
  // (Clear: her near corner beyond hers. Turned 0.4, her beam's corner reaches out 1.9 sin 0.4 + 0.8 cos 0.4.)
  const reach = 0.8 + 3.8 / 2 * Math.sin(0.4) + 0.8 * Math.cos(0.4);
  assert.ok(Math.abs(mine.pos.x) >= reach - 0.15, `out past hers: ${mine.pos.x.toFixed(2)} of ${reach.toFixed(2)}`);
  // (Hers gone from the water while she slides: let go.)
  const again = { pos: { x: 0.2, z: 0 }, vel: { x: 0, z: 0 }, hull, heading: 0 };
  keepClear([again], [theirs], 1 / 30);
  assert.equal(again.clearOf, theirs);
  keepClear([again], [], 1 / 30);
  assert.equal(again.clearOf, null);
  keepClear([again], undefined, 1 / 30);
  assert.equal(again.clearOf, null);
});
