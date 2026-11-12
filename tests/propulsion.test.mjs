// Marine physics C3a (docs/IMPROVEMENTS.md): an engine's revs follow her propeller's load
// (engine.js loadRpm, propBite), short of its rated revs off the mark and laden; a propeller that
// loses its grip (out of the water, drawing air, bent) lets it race; an outboard you trim
// yourself strikes the bottom over the shallows unless it's tilted up (boat.js propStrike), and a
// bent propeller costs her push; on Relaxed, and when she trims herself, the leg kicks up as ever.
// Her push in deep water is the catalogue's, untouched.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat } = await import('../src/boat.js');
const { newEngine, stepEngine, loadRpm, propBite, HOLE, TRIM, WOT, PROFILES, engineSave, cleanEngine } = await import('../src/engine.js');
const { solidHeight } = await import('../src/world/terrain.js');
const scene = new THREE.Scene();

test('the propeller’s load: short of its rated revs off the mark, climbing to them at the speed it’s pitched for, into the limiter past it', () => {
  const top = 6000, vd = 18;
  assert.equal(loadRpm(top, 0, vd), top * HOLE);
  assert.equal(loadRpm(top, vd, vd), top);
  assert.ok(loadRpm(top, vd * 0.5, vd) > top * HOLE && loadRpm(top, vd * 0.5, vd) < top);
  assert.ok(loadRpm(top, vd * 1.06, vd) > top, 'driven past it, the limiter');
  // (A lower pitch lets it rev higher off the mark.)
  assert.ok(loadRpm(top, 0, vd, 0.75) > loadRpm(top, 0, vd));
  // Every step faster, the same or more revs.
  for (let v = 0; v < vd * 1.1; v += 0.5) assert.ok(loadRpm(top, v + 0.5, vd) >= loadRpm(top, v, vd));
});

// (An engine run at a throttle and a speed, the revs it settles at.)
const settle = (ctx, secs = 6) => {
  const E = newEngine('rib');
  for (const e of E.engines) { e.run = true; e.rpm = PROFILES.rib.idle; }
  Object.assign(E, { battery: true, cord: true, key: true });
  for (let i = 0; i < secs * 30; i++) stepEngine(E, 1 / 30, { fuel: 50, opening: 1, ...ctx });
  return E.engines[0].rpm;
};

test('her revs flat out: labouring off the mark, rated at her best, short of it laden; racing with the propeller out; as before without a propeller’s figures', () => {
  const top = WOT.rib || PROFILES.rib.max, vd = 18.26;
  const off = settle({ speed: 0, vd, inGear: true }), best = settle({ speed: vd, vd, inGear: true }), laden = settle({ speed: 15.8, vd, inGear: true });
  assert.ok(Math.abs(off - top * HOLE) < 60, `off the mark ${Math.round(off)} rpm`);
  assert.ok(Math.abs(best - top) < 60, `at her best ${Math.round(best)} rpm`);
  assert.ok(laden < top - 300 && laden > off, `laden, flat out at 15.8 m/s: ${Math.round(laden)} rpm`);
  // (Out of the water on a crest, or bent: it races towards its free revs.)
  const out = settle({ speed: 6, vd, inGear: true, bite: 0 }), held = settle({ speed: 6, vd, inGear: true });
  assert.ok(out > held + 1000, `prop out ${Math.round(out)} against ${Math.round(held)} rpm`);
  assert.ok(out <= top * 1.08 + 1, 'never past the limiter');
  // (In neutral, or with nothing known of her propeller, the throttle alone, as ever.)
  assert.ok(settle({ speed: 0, vd, inGear: false }) > top * 0.95);
  assert.ok(settle({ speed: 0 }) > top * 0.95);
  // A bent propeller grips less.
  const E = newEngine('rib');
  E.dmg = 0.6;
  assert.ok(propBite(E) < propBite(newEngine('rib')));
});

test('a bent propeller is kept in the save, cleaned, and a good one isn’t written at all', () => {
  const E = newEngine('rib');
  assert.equal(engineSave(E).dmg, undefined);
  E.dmg = 0.456;
  assert.equal(engineSave(E).dmg, 0.46);
  assert.equal(cleanEngine('rib', engineSave(E)).dmg, 0.46);
  assert.equal(cleanEngine('rib', { dmg: 7 }).dmg, 1);
  assert.equal(cleanEngine('rib', { dmg: 'x' }).dmg, 0);
});

// The RIB run west at full throttle from (x0, 21) towards the strand: off it the bottom shoals
// from four metres to a foot in seventeen.
const run = ({ strikes = 'on', trim = 2, lever = 1, x0 = 200, z0 = 21, secs = 14, dmg = 0, own = true, stop = false } = {}) => {
  const b = new Boat(scene, { kind: 'rib' });
  b.place(x0, z0, -Math.PI / 2);
  const E = (b.engine = newEngine('rib'));
  for (const e of E.engines) e.run = true;
  E.trim = trim;
  E.dmg = dmg;
  b.trimAuto = !own;
  b.propStrikes = strikes;
  const hits = [];
  let firstX = null;
  b.onStrike = (bt, s) => {
    hits.push(s);
    firstX ??= bt.pos.x;
  };
  let vmax = 0;
  for (let i = 0; i < secs * 30; i++) {
    // (stop: a skipper easing back to neutral at the first touch.)
    const L = stop && hits.length ? 0 : lever;
    b.motor = true;
    b.lever = L;
    b.update(1 / 30, i / 30, L, 0, 0);
    vmax = Math.max(vmax, b.speed);
  }
  return { b, E, hits, vmax, get firstX() { return firstX; } };
};

test('in deep water her push is the catalogue’s, strikes on or off; a bent propeller costs her speed', () => {
  // (Out at sea, heading west: sixty metres of water under her the whole way.)
  for (let d = 0; d <= 550; d += 25) assert.ok(-solidHeight(400 - d, 1200) > 40);
  const deep = { x0: 400, z0: 1200, secs: 30 };
  const on = run(deep).vmax, off = run({ ...deep, strikes: null }).vmax, bent = run({ ...deep, dmg: 0.5 }).vmax;
  assert.ok(Math.abs(on - off) < 1e-9, `${on} and ${off}`);
  assert.ok(bent < on * 0.92, `bent: ${bent.toFixed(1)} against ${on.toFixed(1)} m/s`);
});

test('over the shallows: her leg down, a strike and a bent propeller; tilted up, creeping, clear; on Relaxed or trimming herself, it kicks up as ever', () => {
  const down = run();
  assert.ok(down.hits.length > 0, 'struck');
  assert.ok(down.hits[0].speed > 8 && down.E.dmg >= 0.4, `at ${down.hits[0].speed.toFixed(1)} m/s, ${Math.round(down.E.dmg * 100)}% bent`);
  // (Creeping in with the leg tilted into its shallow-water range: over the bank without a touch
  // until the hull itself is near aground.)
  // (Creeping in and easing off at the first touch: with the leg down, a touch and little harm;
  // tilted into its shallow-water range, further in before any.)
  const at = (r) => (r.hits.length ? r.firstX : null);
  const tilted = run({ trim: TRIM.shallow, lever: 0.04, x0: 156, secs: 25, stop: true }), creep = run({ trim: 2, lever: 0.04, x0: 156, secs: 25, stop: true });
  assert.ok(creep.hits.length > 0, 'leg down, even creeping, it touches');
  assert.ok(creep.E.dmg < 0.15, `creeping, a touch: ${Math.round(creep.E.dmg * 100)}%`);
  assert.ok(!tilted.hits.length || tilted.firstX < creep.firstX - 1, `tilted, further in before any touch (${at(tilted)} against ${at(creep)})`);
  // Relaxed (no strikes), or the leg hers to trim: no strike, and it kicks up as it always has.
  for (const r of [run({ strikes: null }), run({ own: false })]) {
    assert.equal(r.hits.length, 0);
    assert.equal(r.E.dmg, 0);
    assert.ok(r.b.tilted, 'kicked up');
  }
});

test('lifted clear of the water, her propeller’s grip is gone; afloat, it’s whole', () => {
  const b = new Boat(scene, { kind: 'rib' });
  b.place(600, 21, 0);
  b.engine = newEngine('rib');
  for (const e of b.engine.engines) e.run = true;
  for (let i = 0; i < 60; i++) { b.motor = true; b.lever = 0.5; b.update(1 / 30, i / 30, 0.5, 0, 0); }
  assert.equal(b.propBite, 1);
  b.phys.x[1] += 1.2;
  b.motor = true;
  b.lever = 0.5;
  b.update(1 / 30, 3, 0.5, 0, 0);
  assert.ok(b.propBite < 0.2, `in the air: ${b.propBite}`);
});
