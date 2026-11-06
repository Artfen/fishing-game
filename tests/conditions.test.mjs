// Wind, waves and currents (src/world/conditions.js), and the boats that ride them: sheltered
// water is calmer, the sea changes smoothly, nothing jumps at an invisible line, the water you
// see and the water boats float on are one function, and a drifting boat goes the same way at
// any frame rate. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const C = await import('../src/world/conditions.js');
const O = await import('../src/world/ocean.js');
const water = await import('../src/world/water.js');
const { Boat } = await import('../src/boat.js');

// Settle the sea for a given setting (sea preset, steady wind).
function settle(preset, speed = null, from = 225) {
  C.conditions.preset = preset;
  C.conditions.manual = speed == null ? null : { speed, from: (from * Math.PI) / 180 };
  if (speed != null) C.conditions.wind.speed = C.conditions.wind.target = speed;
  for (let i = 0; i < 6000; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.3 });
}

test('sheltered water is calmer than the open coast, and the lake barely stirs', () => {
  settle('lively', 10);
  const h = (x, z) => C.waveHeightHere(x, z);
  const bay = h(0, -10), cove = h(140, -16), open = h(0, 200), coast = h(-300, 400), lake = h(-133, -21);
  assert.ok(bay < open * 0.7, `bay ${bay} vs open ${open}`);
  assert.ok(cove < open * 0.6, `cove ${cove} vs open ${open}`);
  assert.ok(coast >= open * 0.9, `coast ${coast} vs open ${open}`);
  assert.ok(lake < 0.05, `lake ${lake}`);
  // And the wind itself is gentler in a cove than out at sea.
  assert.ok(C.windAt(140, -16).speed < C.windAt(0, 300).speed * 0.7);
});

test('the sea changes smoothly: a new wind builds the chop over tens of seconds, the swell over minutes', () => {
  settle('calm', 2);
  const chop0 = C.conditions.sea.chop, swell0 = C.conditions.sea.swell;
  C.conditions.manual = { speed: 11, from: 4 };
  let last = chop0, maxStep = 0;
  for (let i = 0; i < 100; i++) {
    C.updateConditions(0.1, { rain: 0, cloud: 0.3 }); // ten seconds
    maxStep = Math.max(maxStep, Math.abs(C.conditions.sea.chop - last));
    last = C.conditions.sea.chop;
  }
  assert.ok(maxStep < 0.01, `chop jumped ${maxStep} m in a tenth of a second`);
  assert.ok(C.conditions.sea.chop > chop0 && C.conditions.sea.chop < 0.2, 'part-built after ten seconds');
  assert.ok(Math.abs(C.conditions.sea.swell - swell0) < 0.02, 'the swell barely moved in ten seconds');
});

test('nothing jumps at an invisible line: waves and currents vary smoothly across the water', () => {
  settle('lively', 9);
  C.conditions.time = 37;
  // From inside Willow Bay out through its mouth to the open coast, and across the estuary.
  for (const [x0, z0, x1, z1] of [[0, -10, 0, 320], [480, 60, 680, 60], [-400, 560, -120, 560], [140, -30, 150, 70]]) {
    let lastH = null, lastC = null;
    // (Every quarter metre: a steep wind sea's own slope stays well under the limit there, while
    // a seam in the water would still show as a step.)
    const n = Math.round(Math.hypot(x1 - x0, z1 - z0) * 4);
    for (let i = 0; i <= n; i++) {
      const x = x0 + ((x1 - x0) * i) / n, z = z0 + ((z1 - z0) * i) / n;
      const h = C.waveHeight(x, z), c = C.currentAt(x, z, 0);
      if (lastH != null) assert.ok(Math.abs(h - lastH) < 0.08, `wave jump ${Math.abs(h - lastH).toFixed(3)} m at ${x.toFixed(1)},${z.toFixed(1)}`);
      if (lastC) assert.ok(Math.hypot(c.x - lastC.x, c.z - lastC.z) < 0.06, `current jump at ${x.toFixed(0)},${z.toFixed(0)}`);
      lastH = h;
      lastC = { ...c };
    }
  }
});

test('currents run where they should: the river out to sea, faster in the narrows, slack in a cove, slower near the bottom', () => {
  const at = (x, z, d = 0) => ({ ...C.currentAt(x, z, d) }); // (currentAt reuses its result object)
  const river = at(600, -250), estuary = at(570, 70), cove = at(140, -16);
  assert.ok(river.z > 0.3, `the Wend runs south to the sea (${river.z})`);
  assert.ok(Math.hypot(river.x, river.z) > Math.hypot(estuary.x, estuary.z), 'faster in the narrow river than over the estuary');
  assert.ok(Math.hypot(cove.x, cove.z) < 0.05, 'slack in Driftwood Cove');
  const top = at(-170, 560), deep = at(-170, 560, 30);
  assert.ok(Math.hypot(deep.x, deep.z) < Math.hypot(top.x, top.z), 'slower near the seabed');
  // The tide-ready zones turn with the tide.
  C.TIDE.flow = -1;
  const flood = at(-170, 560);
  C.TIDE.flow = 1;
  assert.ok(flood.x * top.x + flood.z * top.z < 0, 'a flood tide runs the other way round Gannet Isle');
});

test('the water you see and the water boats float on are one function', () => {
  assert.equal(water.waveHeight, C.waveHeight);
});

// A boat left to drift in a steady wind and current, simulated at a frame rate.
function drift(kind, fps, seconds, { anchored = false } = {}) {
  settle('moderate', 9, 270);
  const b = new Boat(new THREE.Scene(), { kind });
  b.place(-120, 420, 0);
  if (anchored) b.setAnchor?.(true);
  let maxRoll = 0, maxPitch = 0;
  const dt = 1 / fps;
  for (let i = 0; i < seconds * fps; i++) {
    C.conditions.time = i * dt;
    b.update(dt, i * dt, 0, 0, 0);
    maxRoll = Math.max(maxRoll, Math.abs(b.roll));
    maxPitch = Math.max(maxPitch, Math.abs(b.pitch));
  }
  return { x: b.pos.x, z: b.pos.z, maxRoll, maxPitch, b };
}

test('a drifting boat goes the same way at 15, 30 and 120 frames a second', () => {
  const a = drift('row', 15, 60), b = drift('row', 30, 60), c = drift('row', 120, 60);
  const moved = Math.hypot(c.x + 120, c.z - 420);
  assert.ok(moved > 2, `the wind and current moved it (${moved.toFixed(1)} m in a minute)`);
  // Within a few per cent of the distance drifted (a small boat, a minute of wind and current).
  assert.ok(Math.hypot(a.x - c.x, a.z - c.z) < moved * 0.06, `15 vs 120 fps: ${Math.hypot(a.x - c.x, a.z - c.z).toFixed(2)} m apart in ${moved.toFixed(1)} m`);
  assert.ok(Math.hypot(b.x - c.x, b.z - c.z) < moved * 0.03, `30 vs 120 fps: ${Math.hypot(b.x - c.x, b.z - c.z).toFixed(2)} m apart in ${moved.toFixed(1)} m`);
});

test('boats ride the waves gently and differently: a kayak follows the chop, the bass boat sits steadier', () => {
  const kayak = drift('kayak', 30, 40), bass = drift('bass', 30, 40), row = drift('row', 30, 40);
  for (const [k, r] of [['kayak', kayak], ['bass', bass], ['row', row]]) {
    assert.ok(r.maxRoll < 0.23 && r.maxPitch < 0.21, `${k} rolled ${r.maxRoll.toFixed(2)}, pitched ${r.maxPitch.toFixed(2)}: no wave tips a boat`);
  }
  assert.ok(bass.maxRoll < kayak.maxRoll, `bass boat ${bass.maxRoll.toFixed(3)} vs kayak ${kayak.maxRoll.toFixed(3)}`);
});

test('an anchored boat stays on its rope, and lies to it', () => {
  const r = drift('row', 30, 90, { anchored: true });
  const A = r.b.anchor;
  assert.ok(A && A.phase === 'set', 'the anchor is on the bottom');
  // Her bow no further from the anchor than the rope reaches (it never drags), and once the
  // wind and tide have taken her back on it, lying head to it.
  const bx = r.x + r.b.fwd.x * r.b.hull.L * 0.45, bz = r.z + r.b.fwd.z * r.b.hull.L * 0.45;
  const d = Math.hypot(bx - A.x, bz - A.z);
  assert.ok(d <= A.reach + 0.3, `${d.toFixed(1)} m from the anchor, on a ${A.reach.toFixed(1)} m reach`);
  if (A.tension > 0.5) {
    const to = Math.atan2(A.x - r.x, A.z - r.z), off = Math.abs(Math.atan2(Math.sin(to - r.b.heading), Math.cos(to - r.b.heading)));
    assert.ok(off < 0.5, `head to the anchor (${off.toFixed(2)} rad off)`);
  }
});

test('the Currents setting steadies your boat (the fish still know the water)', () => {
  C.conditions.currents = 'still';
  assert.equal(C.currentScale(), 0);
  C.conditions.currents = 'gentle';
  assert.equal(C.currentScale(), 0.5);
  C.conditions.currents = 'natural';
  assert.ok(Math.hypot(C.currentFast(600, -250).x, C.currentFast(600, -250).z) > 0.2, 'fish still feel the river');
});

/* ---------------- a livelier sea ---------------- */

// The weather left to itself for a while, at a given hour, on a fair day: the sustained wind.
function fairDay(hour, region = 'home', minutes = 40) {
  const save = { region: C.conditions.region, hour: C.conditions.hour };
  C.conditions.preset = 'auto';
  C.conditions.manual = null;
  C.conditions.region = region;
  C.conditions.hour = hour;
  const seen = [];
  for (let i = 0; i < minutes * 60; i++) {
    C.updateConditions(1, { rain: 0, cloud: 0.25, storm: 0 });
    if (i > 300) seen.push(C.conditions.wind.speed);
  }
  Object.assign(C.conditions, save);
  return seen.reduce((a, b) => a + b, 0) / seen.length;
}

test('an Atlantic coast is seldom still: a breeze most days, a sea breeze in the afternoon, the trade wind at Las Brasas', (t) => {
  // (The gusts and the day's wind are dice: the same dice every run, so a rare roll can't fail it.)
  let seed = 42;
  const real = Math.random;
  Math.random = () => ((seed = (Math.imul(seed, 1103515245) + 12345) >>> 0) / 4294967296);
  t.after(() => { Math.random = real; });
  const morning = fairDay(8), afternoon = fairDay(15), night = fairDay(2);
  assert.ok(morning > 4 && morning < 8, `a breeze in the morning: ${morning.toFixed(1)} m/s`);
  assert.ok(afternoon > morning + 2, `fresher in the afternoon: ${afternoon.toFixed(1)} m/s`);
  assert.ok(night < morning, `lighter at night: ${night.toFixed(1)} m/s`);
  const trades = fairDay(15, 'south');
  assert.ok(trades > 8.5 && trades < 14, `the trade wind: ${trades.toFixed(1)} m/s`);
  assert.equal(C.dayWind(null), 0, 'no hour, no daily cycle');
});

test('the wind sea grows longer waves as the wind freshens, and bigger ones', () => {
  // Each band of wavelength's energy in the sea as it's worked out (ocean.js: the long waves
  // here, the short ones the graphics card adds), shortest first.
  const edges = [0, 5.2, 8, 12.5, 19, 29, 44, 1e9];
  const bands = (speed) => {
    settle('auto', speed);
    const W = O.longSea.wind, S = new O.ShortSpectrum();
    O.longSea.patch.setSpectrum(W.u, W.to, W.m0);
    S.update(W.u, W.to, W.m0);
    return O.bandEnergy(S.patch, edges, O.bandEnergy(O.longSea.patch, edges));
  };
  const light = bands(3), fresh = bands(12);
  const peak = (e) => e.indexOf(Math.max(...e)), sum = (e) => e.reduce((a, b) => a + b);
  const show = (e) => e.map((a) => Math.sqrt(a).toFixed(3)).join(', ');
  assert.ok(peak(light) <= 1 && sum(light.slice(3)) < sum(light) * 0.02, `light air: short waves only (${show(light)})`);
  assert.ok(peak(fresh) >= 3 && fresh[3] > fresh[0] * 5, `a fresh breeze: longer waves carry the most (${show(fresh)})`);
  assert.ok(Math.sqrt(sum(fresh)) > Math.sqrt(sum(light)) * 5, 'and bigger');
  // Out in the open in a fresh breeze, about a metre crest to trough, with sharp crests.
  settle('lively', 12);
  const h = C.waveHeightHere(0, 300);
  assert.ok(h > 0.9 && h < 3, `${h.toFixed(2)} m`);
  assert.ok(C.conditions.sea.chopPeak > 1.5 && O.longSea.choppy > 0.6, 'sharp crests');
});

test('the swell grows and steepens running into shallow water, then breaks and is spent', () => {
  assert.ok(C.shoalGrow(3) > 1.6 && C.shoalGrow(12) === 1, 'bigger over the last few metres');
  assert.ok(C.shoalGrow(0.8) < 1.05, 'spent once it has broken');
  assert.ok(C.shoalPeak(2) > 1 && C.shoalPeak(8) === 0, 'and steeper');
});

test('the sea’s height comes out just as it always did, reading the ground and the fresh water once', async () => {
  const T = await import('../src/world/terrain.js');
  const { waterLevel } = await import('../src/world/coldwater.js');
  const { SWELL } = C.WAVE_PARTS;
  // (waveHeight as it was: the ground and the freshness read again by the shore's fade, the
  // shelter's texture read through a little function for each corner.)
  const shelter = (x, z) => [...C.shelterAt(x, z, [0, 0])];
  const { smoothstep } = await import('../src/util.js');
  const fadeOld = (x, z) => smoothstep(0.05, 0.9 + 3.5 * C.conditions.sea.storm, -T.solidHeight(x, z)) * (1 - 0.85 * T.freshness(x, z));
  const old = (x, z, t) => {
    const lvl = waterLevel(x, z);
    if (lvl > 0.05) return null;
    const Cn = C.conditions, sh = shelter(x, z), depth = Math.max(0, -T.solidHeight(x, z));
    let hs = 0;
    const peak = Math.min(Cn.sea.peak + C.shoalPeak(depth), 3.6), grow = C.shoalGrow(depth);
    for (let i = 0; i < SWELL.length; i++) {
      const w = SWELL[i], a = Cn.swellAmps[i] * sh[0] * grow;
      if (a < 1e-5) continue;
      hs += C.swellShape(a, w.k, w.k * (w.dx * x + w.dz * z - w.c * t), peak);
    }
    const fade = fadeOld(x, z);
    const o = { h: 0, vy: 0, vx: 0, vz: 0 };
    const hc = O.longSea.add(x, z, t, (0.15 + 0.85 * sh[1]) * fade, o).h;
    return C.TIDE.level * (1 - T.freshness(x, z)) + hs * fade + hc;
  };
  let n = 0;
  for (let x = -600; x <= 700; x += 13.7) {
    for (let z = -500; z <= 1300; z += 11.3) {
      const want = old(x, z, 50.25);
      if (want == null) continue;
      assert.equal(C.waveHeight(x, z, 50.25), want, `at ${x}, ${z}`);
      n++;
    }
  }
  assert.ok(n > 10000, `${n} points`);
});
