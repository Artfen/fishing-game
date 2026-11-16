// J2: diving together from one boat (src/crew.js, src/world/visitors.js, src/together.js, wired in
// main.js). Two friends in one boat at a dive site: the skipper goes over the side and the one
// crewing for them stays aboard her, as she lies at anchor; the crewmate can go over the side of
// her too, and either climbs back aboard. Here: when a friend's boat is still enough to dive from;
// which side you go in; the nearest boat to climb back into; a friend's boat stood in while they're
// diving (drawn where their word says she lies, easing as she swings) and a crewmate stood in her
// on every screen; and word of where your boats lie keeping a second of a kind by her own id.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { stillForDiving, overTheSide, nearestToClimb, DIVE_STILL, CLIMB_REACH } = await import('../src/crew.js');
const { VisitorView } = await import('../src/world/visitors.js');
const { HULLS } = await import('../src/boat.js');
const { Together, cleanFleet } = await import('../src/together.js');
const { Hub } = await import('./fakeRealtime.mjs');

test('a friend’s boat still enough to go over the side of: anchored or tied, barely moving, or lying as they left her to dive', () => {
  assert.equal(stillForDiving({ m: 'boat', n: true }, { v: 3 }), true, 'anchored (swinging)');
  assert.equal(stillForDiving({ m: 'boat' }, { v: DIVE_STILL * 0.5 }), true, 'barely moving');
  assert.equal(stillForDiving({ m: 'boat' }, { v: DIVE_STILL * 2 }), false, 'under way');
  assert.equal(stillForDiving({ m: 'dive' }, { v: 0.4 }), true, 'they’re over the side themselves');
  assert.equal(stillForDiving({ m: 'foot' }, { v: 0 }), false, 'ashore');
  assert.equal(stillForDiving(null, null), false);
});

// A boat drawn heading `h` (as boat.js keeps it: x over z), at (x, z).
const drawnBoat = (kind, x, z, h) => ({
  hull: HULLS[kind], heading: h,
  pos: { x, z }, right: { x: -Math.cos(h), z: Math.sin(h) },
});

test('over the side where there’s water: the side you’re stood on first, else the other; none in the shallows', () => {
  const b = drawnBoat('rib', 0, 0, 0);
  const off = HULLS.rib.B * 0.5 + 0.7;
  const deep = () => 12;
  const R = overTheSide(b, deep, 1), L = overTheSide(b, deep, -1);
  assert.ok(Math.abs(R.x - b.right.x * off) < 1e-9 && Math.abs(R.z - b.right.z * off) < 1e-9, 'her right');
  assert.ok(Math.abs(L.x + b.right.x * off) < 1e-9, 'her left');
  assert.equal(R.heading, 0);
  // (Lying with her right side over a rock: in on her left.)
  const leftOnly = (x) => (x * b.right.x > 0 ? 0.4 : 12);
  const in2 = overTheSide(b, (x) => leftOnly(x), 1);
  assert.ok(in2.x * b.right.x < 0, 'the other side');
  assert.equal(overTheSide(b, () => 1.0, 1), null, 'too shallow either side');
});

test('at the surface, the nearest boat close enough to climb into: yours or a friend’s', () => {
  const mine = { b: drawnBoat('skiff', 0, 0, 0) }, hers = { b: drawnBoat('rib', 12, 0, 0), p: { id: 'mags' } };
  const reach = (c) => c.b.hull.L * 0.45 + CLIMB_REACH;
  assert.equal(nearestToClimb([mine, hers], { x: 12 + reach(hers) - 0.2, z: 0 }), hers);
  assert.equal(nearestToClimb([mine, hers], { x: reach(mine) - 0.2, z: 0 }), mine);
  assert.equal(nearestToClimb([mine, hers], { x: 6, z: 9 }), null, 'neither in reach');
  assert.equal(nearestToClimb([], { x: 0, z: 0 }), null);
});

// A friend on your screen: their pose and where they are, and their boats lying in the water.
const peer = (id, name, pose, fleet = []) => ({ id, name, pose, at: { x: pose.x, z: pose.z, h: pose.h ?? 0, v: 0 }, fleet });

test('a friend over the side diving from her: the boat you’re stood in is hers as she lies, drawn where their word says, easing as she swings', () => {
  const view = new VisitorView(new THREE.Scene());
  const peers = new Map();
  // Mags in her RIB at anchor; Bert stood in her.
  peers.set('mags', peer('mags', 'Mags', { m: 'boat', k: 'rib', x: 100, z: 600, h: 0.3, n: true }));
  let t = 0;
  const tick = (secs = 0.5) => { for (let i = 0; i < secs * 30; i++, t += 1 / 30) view.update(1 / 30, t, peers, { from: { x: 100, z: 600 } }); };
  tick();
  const inHer = view.crewBoat('mags', { x: 100.5, z: 600 });
  assert.ok(inHer && inHer === view.boatOf('mags'), 'the one she’s in');
  // Over the side: her pose is a diver's; her RIB is word of where her boats lie.
  peers.set('mags', peer('mags', 'Mags', { m: 'dive', x: 103, z: 601, h: 0, y: -2 }, [{ k: 'rib', x: 100, z: 600, h: 0.3 }]));
  tick();
  assert.equal(view.boatOf('mags'), null, 'she’s not in a boat');
  const lying = view.crewBoat('mags', { x: 100.5, z: 600 });
  assert.ok(lying, 'the RIB, lying where she left her');
  assert.equal(lying.kind, 'rib');
  assert.ok(Math.hypot(lying.pos.x - 100, lying.pos.z - 600) < 1e-6);
  assert.equal(view.crewBoat('mags', { x: 140, z: 600 }), null, 'not a boat of hers 40 m off');
  assert.equal(view.crewBoat('mags', null), null);
  // Swinging on her anchor, word of 1.2 m on: she eases there rather than jumping.
  peers.get('mags').fleet = [{ k: 'rib', x: 101.2, z: 600, h: 0.4 }];
  view.update(1 / 30, t, peers, { from: { x: 100, z: 600 } });
  const step = lying.pos.x - 100;
  assert.ok(step > 0 && step < 0.2, `eased ${step.toFixed(3)} m in a frame`);
  tick(4);
  assert.ok(Math.abs(lying.pos.x - 101.2) < 0.01, 'and gets there');
  // Somewhere else entirely (moved off in the boat while you weren't looking): straight there.
  peers.get('mags').fleet = [{ k: 'rib', x: 160, z: 600, h: 0.4 }];
  view.update(1 / 30, t, peers, { from: { x: 100, z: 600 } });
  assert.equal(lying.pos.x, 160);
});

test('a crewmate stood in a boat whose skipper is diving: in her on every screen, not on the seabed', () => {
  const view = new VisitorView(new THREE.Scene());
  const peers = new Map();
  peers.set('mags', peer('mags', 'Mags', { m: 'dive', x: 103, z: 601, h: 0, y: -2 }, [{ k: 'rib', x: 100, z: 600, h: 0 }]));
  peers.set('bert', peer('bert', 'Bert', { m: 'foot', x: 100.3, z: 599.5, h: 0, a: 'stand', cr: 'mags', cx: 0.3, cz: -1.2 }));
  for (let i = 0, t = 0; i < 20; i++, t += 1 / 30) view.update(1 / 30, t, peers, { from: { x: 100, z: 600 } });
  const C = view.crewAt(peers.get('bert').pose);
  assert.ok(C, 'stood in her');
  assert.ok(Math.hypot(C.x - 100, C.z - 600) < 2, 'in the RIB');
  assert.ok(C.y > -0.5, `on her sole, ${C.y.toFixed(2)} m, not under water`);
  // (On the skipper's own screen it's their boat, as given: still the one they dived from.)
  const mine = view.crewBoat('mags', { x: 100, z: 600 });
  assert.ok(view.crewAt(peers.get('bert').pose, 'mags', mine));
});

/* ---------- word of where your boats lie: a second of a kind by her own id ---------- */

const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

test('your boats as friends see them: two RIBs lying in the water are two RIBs, each by her own id; and word goes at once when asked', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff', 'rib'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const A = mk('Mags', { newCode: () => '4242' }), B = mk('Bert');
  let fleet = [{ k: 'rib', x: 10, z: 20, h: 0 }, { k: 'rib', i: 'rib~2', x: 14, z: 20, h: 0 }];
  A.fleetSource = () => fleet;
  try {
    await A.host();
    await B.join(A.code);
    await until(() => A.peers.size === 1 && B.peers.size === 1);
    const me = { m: 'boat', k: 'skiff', x: 0, z: 0, h: 0 };
    for (let i = 0; i < 4; i++) {
      A.update(0.2, me);
      B.update(0.2, { m: 'foot', x: 5, z: 5, h: 0, a: 'stand' });
      await wait(20);
    }
    const mags = [...B.peers.values()][0];
    await until(() => (mags.fleet || []).length === 2);
    assert.deepEqual(mags.fleet.map((f) => f.i || f.k), ['rib', 'rib~2'], 'both, each by her id');
    // Asked for at once (just over the side, say): sent at the next tick, not the next round.
    fleet = [...fleet, { k: 'row', x: 2, z: 2, h: 0 }];
    A.fleetSoon();
    A.update(0.05, me);
    await until(() => (mags.fleet || []).length === 3, 1000);
    // (What a friend's game makes of the words, unchanged: a stranger id for another kind is dropped.)
    assert.deepEqual(cleanFleet([{ k: 'rib', i: 'skiff~2', x: 1, z: 1, h: 0 }], ['rib']).map((f) => f.i || f.k), ['rib']);
  } finally {
    A.leave();
    B.leave();
  }
});
