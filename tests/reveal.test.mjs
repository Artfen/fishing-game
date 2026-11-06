// The catch reveal (src/reveal.js, and the camera in src/camera.js): the balance's needle swinging
// past the weight and settling on it exactly, the stamp for what the fish means, its place in your
// tally, and the camera coming round in front of you for a look at it and going back after.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { needle, COUNT, HOLD, ordinal, lifetimeOf, verdictOf, heroDistance } = await import('../src/reveal.js');
const { fishById } = await import('../src/fish.js');
const { goalsOf } = await import('../src/goals.js');

test('the balance: the needle swings up past the weight, back, and settles on it exactly', () => {
  const kg = 3.4;
  assert.equal(needle(kg, 0), 0);
  let peak = 0, dipped = false;
  for (let t = 0; t < COUNT; t += 0.01) {
    const w = needle(kg, t);
    peak = Math.max(peak, w);
    if (peak > kg && w < kg) dipped = true;
  }
  assert.ok(peak > kg * 1.05 && peak < kg * 1.25, `it swings past (${peak.toFixed(2)} kg)`);
  assert.ok(dipped, 'and back under');
  assert.ok(Math.abs(needle(kg, COUNT * 0.97) - kg) < kg * 0.02, 'nearly still by the end');
  assert.equal(needle(kg, COUNT), kg);
  assert.equal(needle(kg, 99), kg);
  assert.ok(HOLD >= 0.6 && HOLD <= 1.5, 'a moment to see it, not a wait');
});

test('a fish of a lifetime is the journal’s, and the stamp is the biggest news', () => {
  const bass = fishById.seabass, top = bass.size[1];
  assert.ok(lifetimeOf(bass, top) && !lifetimeOf(bass, bass.size[0]));
  // The same rule as the journal's goal.
  for (const size of [bass.size[0], Math.round(top * 0.85), top - 1, top]) {
    const goal = goalsOf({ fish: { seabass: { best: size, count: 1 } } }).find((g) => g.id === 'lifetime');
    assert.equal(goal.n === 1, lifetimeOf(bass, size), `${size} cm`);
  }
  // A lifetime fish beats a first, which beats a record; an ordinary one has no stamp.
  assert.equal(verdictOf(bass, top, { isNew: true }).stamp, 'lifetime');
  assert.equal(verdictOf(bass, 40, { isNew: true }).stamp, 'new');
  assert.equal(verdictOf(bass, 50, { record: true, count: 3, best: 45 }).stamp, 'record');
  assert.equal(verdictOf(bass, 40, { count: 4, best: 55 }).stamp, null);
  // (A tiny kind never makes a fish of a lifetime: no stamp for the biggest sprat.)
  const small = Object.values(fishById).find((f) => f.size[1] < 30 && !f.retired);
  assert.equal(lifetimeOf(small, small.size[1]), false);
});

test('its place in your tally', () => {
  assert.deepEqual([1, 2, 3, 4, 11, 12, 13, 21, 22, 101, 111].map(ordinal), ['1st', '2nd', '3rd', '4th', '11th', '12th', '13th', '21st', '22nd', '101st', '111th']);
  const bass = fishById.seabass;
  assert.equal(verdictOf(bass, 40, { isNew: true }).tally, 'Your first european seabass');
  assert.equal(verdictOf(bass, 40, { count: 4, best: 55 }).tally, 'Your 4th european seabass · your best is 55 cm');
  assert.match(verdictOf(bass, 60, { record: true, count: 5, best: 55 }).tally, /^Your 5th european seabass, and your biggest: the best was 55 cm$/);
});

test('the camera comes round in front of you for a look at the fish, and goes back after', async () => {
  const { CameraRig } = await import('../src/camera.js');
  const { Walker } = await import('../src/walker.js');
  const { Boat } = await import('../src/boat.js');
  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(55, 1.6, 0.1, 4000);
  const rig = new CameraRig(cam);
  const w = new Walker(scene);
  w.place(102.5, 28.5, 0);
  rig.setHome(true, 0);
  const boat = new Boat(scene, { kind: 'row' });
  boat.place(150, 330, 0);
  // Standing facing +z (north) with a fish held up just in front of you.
  const held = new THREE.Vector3(102.5, w.pos.y + 1.3, 29.1);
  const fishing = { busy: true, lineOut: false, state: 'caught', bob: new THREE.Vector3(), revealing: false, faceYaw: 0, revealDist: 2.8, revealPoint: (o) => o.copy(held) };
  let t = 10;
  const go = (secs) => { for (let i = 0; i < secs * 30; i++) rig.update(1 / 30, (t += 1 / 30), { boat, walker: w, started: true, fishing, baitFocus: null }); };
  rig.views.foot.yaw = 0; // (looking the way you face: from behind you)
  rig.lastManual = 1e9;
  go(3);
  assert.ok(cam.position.z < w.pos.z, 'behind you to start with');
  fishing.revealing = true;
  go(3);
  const d = cam.position.distanceTo(held);
  assert.ok(cam.position.z > held.z, `in front of you now (z ${cam.position.z.toFixed(2)})`);
  assert.ok(d > 1.5 && d < 4, `and close in (${d.toFixed(2)} m)`);
  // (Looking at the fish.)
  const look = new THREE.Vector3(0, 0, -1).applyQuaternion(cam.quaternion), to = held.clone().sub(cam.position).normalize();
  assert.ok(look.dot(to) > 0.95, `looking at it (${look.dot(to).toFixed(3)})`);
  fishing.revealing = false;
  fishing.busy = false;
  go(4);
  assert.ok(cam.position.z < w.pos.z, 'and back behind you after');
  // A bigger fish, a step further off; never so close it fills the screen or so far it's lost.
  assert.ok(heroDistance(120) > heroDistance(40) && heroDistance(10) >= 2 && heroDistance(400) <= 4.2 && heroDistance(400, true) <= 7.5);
});
