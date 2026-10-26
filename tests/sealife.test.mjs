// Sea life you don't catch (world/sealife.js, world/seaglow.js): dolphins that come to ride a
// boat's bow wave, whales that surface to breathe and blow and dive again (the sperm whale lifting
// its flukes), gannets plunging onto a shoal by day, grey seals hauled out and a curious one
// coming to look at a quiet boat, and the sea glowing at night where it's stirred. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { buildSeaLife, SEA_LIFE } = await import('../src/world/sealife.js');
const { SeaGlow, nightGlow } = await import('../src/world/seaglow.js');
const { Boat } = await import('../src/boat.js');
const { Effects } = await import('../src/effects.js');
const { SEA_LIFE_KINDS, parseSave, SAVE_VERSION } = await import('../src/save.js');
const { conditions } = await import('../src/world/conditions.js');
const T = await import('../src/world/terrain.js');

const scene = new THREE.Scene();
const calm = () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
};
const ctxFor = (from, extra = {}) => ({ from, boat: null, boatSpeed: 0, daylight: 1, region: 'home', eco: null, diving: false, ...extra });

test('the record of sea life: every kind has a name and a note, and the save keeps only real ones', () => {
  assert.deepEqual(Object.keys(SEA_LIFE).sort(), [...SEA_LIFE_KINDS].sort());
  for (const k of SEA_LIFE_KINDS) assert.ok(SEA_LIFE[k].name && SEA_LIFE[k].note.length > 40, k);
  const seaLife = { bottlenose: { n: 3, day: 2, hour: 11, where: 'the bay mouth' }, kraken: { n: 1 }, seal: { n: 0 }, finwhale: 'yes' };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 4, seaLife } })).state;
  assert.deepEqual(s.seaLife, { bottlenose: { n: 3, day: 2, hour: 11, where: 'the bay mouth' } });
});

test('dolphins come racing to ride the bow of a boat going along briskly, and leave it when it stops', () => {
  calm();
  const life = buildSeaLife(scene);
  const pod = life.pods.find((p) => p.kind === 'bottlenose' && p.sea === 'home');
  const b = new Boat(scene, { kind: 'console' });
  b.place(pod.x - 70, pod.z + 10, Math.atan2(70, -10));
  let t = 0, seen = null;
  life.onSighting = (k) => { if (k === 'bottlenose') seen ??= k; };
  const run = (secs, lever) => {
    for (let i = 0; i < secs * 30; i++) {
      t += 1 / 30;
      b.update(1 / 30, t, lever, 0, 0);
      life.update(1 / 30, t, ctxFor(b.pos, { boat: b, boatSpeed: Math.abs(b.forwardSpeed) }));
    }
  };
  run(12, 0.25);
  assert.equal(pod.mode, 'bow', 'they came to the bow');
  const bow = { x: b.pos.x + b.fwd.x * b.hull.L / 2, z: b.pos.z + b.fwd.z * b.hull.L / 2 };
  const near = pod.members.filter((m) => Math.hypot(m.x - bow.x, m.z - bow.z) < 6).length;
  assert.ok(near >= pod.n - 1, `${near} of ${pod.n} riding the bow wave`);
  assert.ok(pod.members.every((m) => m.mesh.visible));
  assert.equal(seen, 'bottlenose');
  // The boat stops: a few seconds on, they peel away, and don't come straight back.
  run(10, 0);
  assert.equal(pod.mode, 'roam');
  assert.ok(pod.bored > 60);
  conditions.manual = null;
});

test('a whale surfaces to breathe a few times, each breath a blow, then dives for minutes', () => {
  const life = buildSeaLife(scene);
  const w = life.whales.find((x) => x.kind === 'finwhale');
  w.state = 'down';
  w.t = 0.1;
  const blows = [];
  life.onBlow = (x, z, size, kind) => { if (kind === 'finwhale') blows.push(kind); };
  let t = 0, top = -99, states = new Set();
  for (let i = 0; i < 30 * 160 && !(states.has('sound') && w.state === 'down'); i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: w.x + 100, z: w.z }));
    states.add(w.state);
    if (w.state === 'breathe') top = Math.max(top, w.y);
  }
  assert.ok(blows.length >= w.breaths[0] && blows.length <= w.breaths[1], `${blows.length} breaths`);
  assert.ok(blows.every((k) => k === 'finwhale'));
  assert.ok(top > -1.5, `its back at the surface (${top.toFixed(2)})`);
  assert.equal(w.state, 'down');
  assert.ok(w.t >= w.down[0], 'and down for minutes');
});

test('the sperm whale lifts its flukes high as it dives', () => {
  const life = buildSeaLife(scene);
  const w = life.whales.find((x) => x.kind === 'spermwhale');
  w.state = 'sound';
  w.t = 0;
  let t = 0, high = -99;
  for (let i = 0; i < 30 * 9.5; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: w.x + 100, z: w.z }, { region: 'south' }));
    // Where the tail end is, with the body pitched nose-down.
    w.mesh.updateMatrixWorld(true);
    high = Math.max(high, w.mesh.localToWorld(new THREE.Vector3(0, 0, -0.5)).y);
  }
  assert.ok(high > 1.5, `flukes ${high.toFixed(1)} m above the water`);
  assert.equal(w.state, 'down');
});

test('gannets gather over a shoal of small fish near the surface by day and plunge in; none at night', () => {
  const school = { sp: { id: 'sprat' }, x: 60, z: 420, y: -1, home: {} };
  const eco = { schools: [school] };
  const life = buildSeaLife(scene);
  const plunges = [];
  life.onPlunge = (x, z) => plunges.push({ x, z });
  let t = 0;
  for (let i = 0; i < 30 * 40; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor({ x: 20, z: 400 }, { eco }));
  }
  assert.ok(life.feeding || plunges.length, 'a flock came down on it');
  assert.ok(plunges.length >= 3, `${plunges.length} plunges`);
  assert.ok(plunges.every((p) => Math.hypot(p.x - school.x, p.z - school.z) < 8), 'into the shoal');
  const night = buildSeaLife(scene);
  const none = [];
  night.onPlunge = (x, z) => none.push(x);
  for (let i = 0; i < 30 * 20; i++) night.update(1 / 30, i / 30, ctxFor({ x: 20, z: 400 }, { eco, daylight: 0 }));
  assert.equal(none.length, 0);
  assert.ok(!night.feeding);
});

test('grey seals hauled out on Gannet Isle and the Skerries, and a curious one comes to look at a quiet boat', () => {
  const life = buildSeaLife(scene);
  assert.ok(life.ashore.filter((s) => s.H.id === 'gannet').length >= 4);
  assert.ok(life.ashore.filter((s) => s.H.id === 'skerries').length >= 2);
  for (const s of life.ashore) assert.ok(T.heightAt(s.g.position.x, s.g.position.z) > 0, 'on the rocks, out of the water');
  // A boat lying quiet off the Skerries: before long a head comes up a few boat-lengths off.
  const K = T.SKERRIES[0];
  const b = new Boat(scene, { kind: 'row' });
  b.place(K.x + 40, K.z, 0);
  let t = 0, closest = Infinity, seen = false;
  life.onSighting = (k) => { if (k === 'seal') seen = true; };
  for (let i = 0; i < 30 * 90; i++) {
    t += 1 / 30;
    life.update(1 / 30, t, ctxFor(b.pos, { boat: b, boatSpeed: 0 }));
    for (const v of life.visitors) if (v.mode === 'visit' && v.depth < 0.3) closest = Math.min(closest, Math.hypot(v.x - b.pos.x, v.z - b.pos.z));
  }
  assert.ok(closest < 20, `one came to look, ${closest.toFixed(1)} m off`);
  assert.ok(seen);
});

test('the sea glows at night where it’s stirred: in salt water, never in fresh water, never by day', () => {
  const glow = new SeaGlow(scene);
  glow.update(10, 0.8);
  glow.spawn(0, 300, 20, 1);
  assert.ok(glow.live(10.5) >= 15, 'sparks in the bay');
  const lake = { x: T.LAKE.x, z: T.LAKE.z };
  assert.equal(T.waterOf(T.zoneAt(lake.x, lake.z)), 'fresh');
  const before = glow.live(10.5);
  glow.spawn(lake.x, lake.z, 20, 1);
  assert.equal(glow.live(10.5), before, 'none on the lake');
  glow.update(30, 0);
  glow.spawn(0, 300, 20, 1);
  assert.equal(glow.live(30.5), 0, 'none by day');
  // Some nights bright, some faint: the same night always the same.
  const nights = Array.from({ length: 30 }, (_, d) => nightGlow(d));
  assert.ok(Math.max(...nights) > 0.8 && Math.min(...nights) < 0.3);
  assert.equal(nightGlow(7), nightGlow(7));
  // A splash, a ripple and a boat's wake light it.
  const fx = new Effects(scene);
  fx.glow = glow;
  glow.update(40, 0.8);
  fx.splash(0, 0.05, 300, 10, 2, 1);
  assert.ok(glow.live(40.3) >= 6);
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(0, 320, 0);
  b.vel.set(0, 0, 3);
  for (let i = 0; i < 30; i++) {
    b.forwardSpeed = 3;
    fx.updateWake(1 / 30, 40 + i / 30, b);
  }
  assert.ok(glow.live(41) > 30, 'the wake glows');
});
