// Storms: a gale and big seas build over a minute or two and die away more slowly; the seas stand
// up in peaks without changing the sea's level; the bay stays a refuge and the shallows calm; a
// boat is thrown about more but never over; lightning flashes and its thunder follows, later the
// further off; and a storm in the sky is kept in the save. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const C = await import('../src/world/conditions.js');
const { Boat } = await import('../src/boat.js');
const { Storm } = await import('../src/world/storm.js');
const { WEATHER_IDS } = await import('../src/settings.js');

const FAIR = { rain: 0, cloud: 0.3, storm: 0 };
const STORM = { rain: 1, cloud: 1, storm: 1 };
function run(seconds, weather, dt = 0.5) {
  for (let i = 0; i < seconds / dt; i++) {
    C.updateConditions(dt, weather);
    C.conditions.time += dt;
  }
}
function calm() {
  C.conditions.preset = 'auto';
  C.conditions.manual = null;
  Object.assign(C.conditions.sea, { swell: 0.1, chop: 0.05, storm: 0, peak: 1 });
  Object.assign(C.conditions.wind, { speed: 3, target: 3, timer: 50 });
  run(2, FAIR);
}

test('a storm builds a gale and big seas over a minute or two, and dies away more slowly', () => {
  calm();
  run(30, STORM);
  const early = C.conditions.sea.storm;
  assert.ok(early > 0.1 && early < 0.6, `half a minute in: ${early.toFixed(2)}`);
  run(240, STORM);
  const S = C.conditions.sea, W = C.conditions.wind;
  assert.ok(S.storm > 0.95, `storm ${S.storm.toFixed(2)}`);
  assert.ok(S.swell > 1.8, `swell ${S.swell.toFixed(2)} m`);
  assert.ok(W.speed > 12, `wind ${W.speed.toFixed(1)} m/s`);
  assert.equal(C.windWords(18), 'gale');
  assert.ok(S.peak > 3, 'the seas stand up in peaks');
  // Back to fair weather: it eases off, more slowly than it came.
  run(30, FAIR);
  assert.ok(C.conditions.sea.storm > 0.7, `still stormy half a minute later: ${C.conditions.sea.storm.toFixed(2)}`);
  run(600, FAIR);
  assert.ok(C.conditions.sea.storm < 0.05 && C.conditions.sea.swell < 0.5, 'gone in the end');
});

test('storm seas peak: steep crests, long troughs, and the same sea level', () => {
  const a = 1.4, k = (2 * Math.PI) / 78, peak = 3.4;
  let mean = 0, max = -Infinity, min = Infinity;
  for (let i = 0; i < 1000; i++) {
    const h = C.swellShape(a, k, (i / 1000) * 2 * Math.PI, peak);
    mean += h / 1000;
    max = Math.max(max, h);
    min = Math.min(min, h);
  }
  assert.ok(Math.abs(mean) < 1e-6, `mean ${mean}`);
  assert.ok(max > -min * 1.2, `crest ${max.toFixed(2)} vs trough ${min.toFixed(2)}`);
  // In fair weather (peak 1) barely different from a plain swell.
  assert.ok(Math.abs(C.swellShape(0.15, k, 1, 1) - 0.15 * Math.sin(1)) < 0.002);
});

test('in a storm the bay is a refuge and the shallows stay calm', async () => {
  calm();
  run(400, STORM);
  const open = C.waveHeightHere(250, 950), bay = C.waveHeightHere(-30, -20);
  assert.ok(open > 3, `open sea ${open.toFixed(1)} m`);
  assert.ok(bay < open * 0.4, `the bay ${bay.toFixed(1)} m`);
  // In a metre of water off an exposed shore the big seas have spent themselves.
  const T = await import('../src/world/terrain.js');
  let spot = null;
  for (let x = -400; x < 700 && !spot; x += 6) {
    for (let z = -100; z < 700 && !spot; z += 6) {
      const d = -T.solidHeight(x, z);
      if (d > 0.8 && d < 1.2 && C.shelterAt(x, z)[0] > 0.6) spot = [x, z];
    }
  }
  assert.ok(spot, 'an exposed shallow');
  let worst = 0;
  for (let t = 0; t < 60; t += 0.7) worst = Math.max(worst, Math.abs(C.waveHeight(spot[0], spot[1], t)));
  assert.ok(worst < 0.35, `in the shallows at ${spot} ${worst.toFixed(2)} m`);
});

test('a boat in a storm is thrown about, but never over', () => {
  calm();
  run(400, STORM);
  for (const kind of ['kayak', 'row', 'sail', 'cabin']) {
    const b = new Boat(new THREE.Scene(), { kind });
    b.place(260, 900, 1);
    let roll = 0, pitch = 0;
    for (let i = 0; i < 1800; i++) {
      C.conditions.time = 1000 + i / 60;
      b.update(1 / 60, C.conditions.time, kind === 'row' ? 0.5 : 0, 0, 0);
      roll = Math.max(roll, Math.abs(b.roll));
      pitch = Math.max(pitch, Math.abs(b.pitch));
    }
    assert.ok(Number.isFinite(b.pos.x) && Number.isFinite(b.heave), kind);
    assert.ok(roll < 0.75 && pitch < 0.5, `${kind}: roll ${roll.toFixed(2)} pitch ${pitch.toFixed(2)}`);
    assert.ok(roll + pitch > 0.12, `${kind} moves with the seas`);
  }
});

test('lightning in a storm, and its thunder arriving later the further off it struck', () => {
  const scene = new THREE.Scene(), env = { flash: 0, storm: 0, flashDir: new THREE.Vector3() };
  const S = new Storm(scene), camera = { position: new THREE.Vector3(250, 3, 950) };
  const heard = [];
  let flashes = 0, wasLit = false, t = 0;
  // Calm: nothing.
  for (let i = 0; i < 1800; i++, t += 1 / 30) S.update(1 / 30, t, { storm: 0, camera, env, onThunder: () => heard.push(t) });
  assert.equal(heard.length, 0);
  assert.equal(env.flash, 0);
  // Two minutes of storm.
  const strikes = [];
  for (let i = 0; i < 3600; i++, t += 1 / 30) {
    S.update(1 / 30, t, { storm: 1, camera, env, onThunder: (d) => heard.push({ t, d }) });
    if (env.flash > 0.05 && !wasLit) {
      flashes++;
      strikes.push({ t, d: S.thunders.at(-1)?.dist });
    }
    wasLit = env.flash > 0.05;
  }
  assert.ok(flashes >= 3, `${flashes} strikes`);
  assert.ok(heard.length >= 2);
  for (const h of heard) {
    const s = strikes.filter((x) => x.t <= h.t).at(-1);
    if (s) assert.ok(h.t - s.t >= h.d / 343 - 0.6, 'the thunder comes after the flash');
  }
  assert.ok(S.sp.every(Number.isFinite));
});

test('with reduced motion the sky never flashes, though the thunder still rolls', () => {
  const env = { flash: 0, storm: 0, flashDir: new THREE.Vector3() };
  const S = new Storm(new THREE.Scene()), camera = { position: new THREE.Vector3(0, 3, 600) };
  let most = 0, heard = 0, t = 0;
  for (let i = 0; i < 3600; i++, t += 1 / 30) {
    S.update(1 / 30, t, { storm: 1, camera, env, onThunder: () => heard++, flashes: false });
    most = Math.max(most, env.flash);
  }
  assert.equal(most, 0);
  assert.ok(heard >= 2);
});

test('a storm can be chosen in Settings, and one in the sky is kept in the save', async () => {
  assert.ok(WEATHER_IDS.includes('storm'));
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const data = { day: 3, hour: 10, sky: { state: 'storm', cloud: 1, rain: 1, storm: 0.8, timer: 100 } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.sky.state, 'storm');
  assert.equal(s.sky.storm, 0.8);
});
