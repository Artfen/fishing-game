// G6 of docs/PROGRESSION.md: harder assistance calls. A skiff taking water (src/contracts.js leak:
// she really fills, through a plank sprung below her waterline, and swamped before she's on your
// line she's lost to you), offered once the harbour office knows you; and out on the Blue Water,
// the coastguard's call relayed over a VHF (farTow: a sailing boat to tow all the way home, paid
// by how far out). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const K = await import('../src/contracts.js');
const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { newDamage } = await import('../src/damage.js');
const { SWAMPED } = await import('../src/flooding.js');
const { wakes } = await import('../src/world/wakes.js');

const scene = new THREE.Scene();
const world = (over = {}) => ({
  day: 4, region: 'home', busy: [], dolphins: false, whales: [], birds: false, storm: false, forecastStorm: false, wind: 5, summer: true, canCross: false, places: {},
  surveyLines: [], tempMarks: [], courses: [], diveSites: [], usable: ['row', 'skiff', 'kayak'], kinds: BOAT_KINDS, diveUnfound: [],
  abs: 9, callSpot: { x: 300, z: 300, where: 'off Shell Strand' }, ...over,
});
const rec = (rep = {}) => Object.assign(K.newContracts(), { count: 4, rep });
const at = (o = {}) => ({ x: 0, z: 0, now: 0, abs: 0, home: false, boat: 'rib', dt: 0.5, speed: 0.5, sea: 0.3, ...o });
const callOf = (C, W, tpl) => {
  const ids = K.callPool(C, W);
  return K.callFor(C, W, () => (ids.indexOf(tpl) + 0.5) / ids.length);
};

test('who gets which calls: the everyday ones, the harder ones once the harbour office knows you, and far out only the coastguard’s', () => {
  const W = world();
  // Someone new to the harbour office: the everyday calls, as ever.
  assert.deepEqual(K.callPool(rec(), W), ['castaway', 'breakdown', 'driftbuoy']);
  assert.deepEqual(K.callPool(rec({ wenna: 2 }), W), ['castaway', 'breakdown', 'driftbuoy']);
  // Known to them (standing 3): a skiff taking water too, now and then.
  assert.deepEqual(K.callPool(rec({ wenna: 3 }), W), ['castaway', 'breakdown', 'driftbuoy', 'leak']);
  // (Another giver's standing doesn't count.)
  assert.ok(!K.callPool(rec({ trust: 20 }), W).includes('leak'));
  // Out on the Blue Water: only the far call, known or not.
  const far = world({ offshore: { km: 2.4 } });
  assert.deepEqual(K.callPool(rec(), far), ['farTow']);
  assert.deepEqual(K.callPool(rec({ wenna: 20 }), far), ['farTow']);
  // The far call never comes inshore, and none in a gale or a strong wind.
  assert.equal(K.TEMPLATES.farTow.make({ ...W, rank: K.CAREER[0] }, () => 0), null);
  for (const tpl of ['leak', 'farTow']) {
    assert.equal(K.TEMPLATES[tpl].make({ ...far, storm: true, rank: K.CAREER[0] }, () => 0), null, tpl);
    assert.equal(K.TEMPLATES[tpl].make({ ...far, wind: 13, rank: K.CAREER[0] }, () => 0), null, tpl);
  }
  // Never on the board.
  for (let d = 0; d < 60; d++) assert.ok(!K.offers(rec({ wenna: 20 }), world({ day: d })).some((o) => o.tpl === 'leak' || o.tpl === 'farTow'));

  // The coastguard's: a sailing boat to tow home, paid by how far out she is.
  const C = rec(), o = callOf(C, far, 'farTow');
  assert.equal(o.tpl, 'farTow');
  assert.match(o.story, /coastguard, relayed by the harbour office on the VHF/);
  assert.match(o.story, /out on the Blue Water 2\.4 km from the harbour/);
  assert.equal(o.obj.kind, 'tow');
  assert.equal(o.obj.boat, 'sail');
  const pay = (km) => callOf(rec(), world({ offshore: { km } }), 'farTow').pay;
  assert.ok(pay(4) > pay(2) && pay(2) > K.TEMPLATES.breakdown.make({ ...W, rank: K.CAREER[0] }, () => 0).pay, `${pay(2)} … ${pay(4)}`);
  // (Becalmed in a light wind; in a breeze, her sail split.)
  assert.match(callOf(rec(), world({ wind: 2, offshore: { km: 2 } }), 'farTow').story, /becalmed/);
  assert.match(callOf(rec(), world({ wind: 8, offshore: { km: 2 } }), 'farTow').story, /dead in the water, her engine gone and her mainsail split/);
});

test('taking water: lost if she’s swamped before your line is on her; on it, she’s yours to bring in, paid there', () => {
  const C = rec({ wenna: 4 }), W = world();
  const a = K.acceptCall(C, callOf(C, W, 'leak'), 0);
  assert.equal(a.tpl, 'leak');
  assert.ok(a.obj.leak > 0.85 && a.obj.leak < 1);
  assert.match(a.story, /taking water .*plank’s sprung/);
  const S = (s) => at({ strays: { [a.id]: { towed: false, home: false, swamped: false, sink: 0, ...s } } });
  // Filling: said at half way and nearly there, each once.
  assert.equal(K.tick(C, S({ sink: 0.3 })).said.length, 0);
  assert.match(K.tick(C, S({ sink: 0.55 })).said[0].text, /half way to swamped/);
  assert.equal(K.tick(C, S({ sink: 0.6 })).said.length, 0);
  assert.match(K.tick(C, S({ sink: 0.8 })).said[0].text, /nearly swamped/);
  // Swamped before she's on your line: the job's gone, and why.
  const r = K.tick(C, S({ sink: 1, swamped: true }));
  assert.equal(r.missed.length, 1);
  assert.equal(r.missed[0].why, 'swamped');
  assert.equal(C.active.length, 0);
  assert.equal(K.claim(C, a.id, 4), null, 'nothing to be paid');

  // Again, in time: on your line, she's helped, and swamped or not after that she's yours to bring in.
  const D = rec({ wenna: 4 }), b = K.acceptCall(D, callOf(D, W, 'leak'), 0);
  const T = (s) => at({ strays: { [b.id]: { towed: true, home: false, swamped: false, sink: 0.4, ...s } } });
  assert.equal(K.tick(D, T()).boarded.length, 1);
  assert.ok(b.progress.helped);
  assert.equal(K.tick(D, T({ sink: 1, swamped: true })).missed.length, 0);
  assert.equal(D.active.length, 1);
  const done = K.tick(D, T({ home: true, swamped: true }));
  assert.equal(done.done.length, 1);
  assert.equal(K.claim(D, b.id, 4).pay, Math.round(40 * K.standingWith({ rep: { wenna: 4 } }, 'wenna').k));
  // Kept through a save: the leak, the water in her, helped.
  const E = rec({ wenna: 4 }), c = K.acceptCall(E, callOf(E, W, 'leak'), 0);
  c.progress.water = [120, 40];
  c.progress.helped = true;
  const back = K.cleanContracts(JSON.parse(JSON.stringify(E)));
  assert.equal(back.active[0].obj.leak, c.obj.leak);
  assert.deepEqual(back.active[0].progress.water, [120, 40]);
  assert.equal(back.active[0].progress.helped, true);
});

test('the leak is real water: untouched she swamps in a few minutes; a rag in the plank and a bucket going slow it right down', () => {
  const sim = (helped, secs) => {
    wakes.tracks.clear();
    const b = new Boat(scene, { kind: 'skiff' });
    b.setRower(false);
    b.damage = newDamage(false);
    b.damage.hull.bottom = 0.9;
    if (helped) {
      b.damage.plugs.bottom = 'rag';
      b.bailing = true;
    }
    b.place(150, 330, 0);
    let t = 0, swampedAt = null;
    const dt = 1 / 15;
    for (let i = 0; i < secs / dt; i++, t += dt) {
      b.update(dt, t, 0, 0, 0);
      if (swampedAt == null && b.flooding?.swamped) swampedAt = t;
    }
    return { b, swampedAt, sink: Math.min(1, (b.flooding?.fill || 0) / SWAMPED) };
  };
  const left = sim(false, 420);
  assert.ok(left.swampedAt != null && left.swampedAt > 150 && left.swampedAt < 400, `untouched, swamped at ${left.swampedAt?.toFixed(0)} s`);
  // She sits lower for it: the water's weight is in her.
  assert.ok(left.b.waterKg > 300, `${left.b.waterKg?.toFixed(0)} kg of water in her`);
  const helped = sim(true, 420);
  assert.equal(helped.swampedAt, null, 'helped: not swamped in the same time');
  assert.ok(helped.sink < 0.6, `helped: ${(helped.sink * 100).toFixed(0)}% of the way to swamped`);
});

test('taken in tow from alongside, as the job says: the line paid out to suit, not parted on the spot', async () => {
  const M = await import('../src/mooring.js');
  const run = (lineFor) => {
    wakes.tracks.clear();
    const lead = new Boat(scene, { kind: 'rib' }), towed = new Boat(scene, { kind: 'skiff' });
    towed.setRower(false);
    // Side by side, the same way, 4.5 m apart: her bow well forward of your stern.
    lead.place(400, 300, Math.PI / 2);
    towed.place(400, 300 - 4.5, Math.PI / 2);
    // (A step for each to settle on the water, as they would have.)
    lead.update(1 / 30, 0, 0, 0, 0);
    towed.update(1 / 30, 0, 0, 0, 0);
    const len = lineFor(lead, towed), out = {};
    let parted = false, peak = 0, clock = 0;
    for (let i = 0; i < 30 * 20 && !parted; i++, clock += 1 / 30) {
      // (A moment to take it, then slow ahead.)
      lead.update(1 / 30, clock, i > 60 ? 0.25 : 0, 0, 0);
      towed.update(1 / 30, clock, 0, 0, 0);
      M.towStep(lead, towed, 1 / 30, len, out, 1);
      parted = out.parted;
      peak = Math.max(peak, out.load || 0);
    }
    return { len, parted, peak, gap: M.towGap(lead, towed), towedSpeed: towed.speed };
  };
  const fixed = run(() => M.TOW.len), paid = run(M.towLineFor);
  // (A line of the usual length starts stretched well past it, and goes at once.)
  assert.ok(fixed.parted, 'the usual length, from alongside: parted');
  assert.ok(!paid.parted && paid.len > M.TOW.len, `paid out to ${paid.len.toFixed(1)} m: held (peak ${(paid.peak * 100).toFixed(0)}% of what it holds)`);
  assert.ok(paid.towedSpeed > 0.5, `she follows: ${paid.towedSpeed.toFixed(2)} m/s`);
  // From astern, where she'd be anyway, it's the usual length.
  const a = new Boat(scene, { kind: 'rib' }), b = new Boat(scene, { kind: 'skiff' });
  a.place(0, 0, 0);
  b.place(0, -a.hull.L / 2 - b.hull.L / 2 - 1, 0);
  a.update(1 / 30, 0, 0, 0, 0);
  b.update(1 / 30, 0, 0, 0, 0);
  assert.equal(M.towLineFor(a, b), M.TOW.len);
});
