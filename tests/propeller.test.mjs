// (B4) The propeller: its walk going astern, the air it draws down near the surface and how long
// that stays, and the water's speed into it with the waves' own motion. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const Hy = await import('../src/hydro.js');
const { Boat } = await import('../src/boat.js');
const C = await import('../src/world/conditions.js');
const { longSea } = await import('../src/world/ocean.js');

const scene = new THREE.Scene();
const calm = () => {
  C.conditions.wind.speed = C.conditions.wind.target = 0;
  C.conditions.swellAmps.fill(0);
  longSea.setWind(0.5, 0, 0, 0.5);
};

test('prop walk: a right-handed propeller astern walks her stern to port; counter-rotating twins cancel it', () => {
  calm();
  // Its push across its axis (her frame: +x to port), from rest: a right-handed one astern to port,
  // ahead a little to starboard; a left-handed one the other way; less with way on.
  const pushes = [];
  const fake = { dirWorld: (v, o) => (o.splice(0, 3, ...v), o), toWorld: (p, o) => (o.splice(0, 3, ...p), o), forces: pushes };
  const b = new Boat(scene, { kind: 'skiff' });
  const astern = b.propWalk(fake, [0, -0.3, -1.9], [0, 0, 1], -400, 1, 0);
  const ahead = b.propWalk(fake, [0, -0.3, -1.9], [0, 0, 1], 400, 1, 0);
  const left = b.propWalk(fake, [0, -0.3, -1.9], [0, 0, 1], -400, -1, 0);
  const moving = b.propWalk(fake, [0, -0.3, -1.9], [0, 0, 1], -400, 1, 3);
  assert.ok(astern > 0 && pushes[0].f[0] > 0, `astern, to port: ${astern.toFixed(1)} N`);
  assert.ok(ahead < 0 && Math.abs(ahead) < astern / 2, `ahead, a little to starboard: ${ahead.toFixed(1)} N`);
  assert.equal(left, -astern);
  assert.ok(moving > 0 && moving < astern * 0.5, `with way on, less: ${moving.toFixed(1)} N`);
  // From rest, easing astern with the helm amidships for ten seconds: her stern walks to port, so
  // her bow swings to starboard, against the same boat with no walk. The console's two outboards
  // turn opposite ways, and between them walk her hardly at all.
  const swing = (kind, walk) => {
    const s = new Boat(scene, { kind });
    if (!walk) s.propWalk = () => 0;
    s.place(150, 330, Math.PI / 2);
    for (let i = 0; i < 30; i++) s.update(1 / 30, i / 30, 0, 0, 0);
    const h0 = s.heading;
    for (let i = 0; i < 300; i++) s.update(1 / 30, 1 + i / 30, -0.3, 0, 0);
    return (Math.atan2(Math.sin(s.heading - h0), Math.cos(s.heading - h0)) * 180) / Math.PI;
  };
  for (const kind of ['skiff', 'cabin']) {
    const w = swing(kind, true), n = swing(kind, false);
    assert.ok(w - n < -0.5, `${kind}: her bow ${(w - n).toFixed(2)}° further to starboard (${w.toFixed(2)} against ${n.toFixed(2)})`);
  }
  const tw = swing('console', true) - swing('console', false);
  assert.ok(Math.abs(tw) < 0.3, `the console's twins: ${tw.toFixed(2)}°`);
});

test('ventilation: the air comes down as part of the propeller breaks the surface hard driven, and stays until it’s well under or eased', () => {
  const { ventStep, VENT } = Hy;
  const need = 0.1, dt = 1 / 120;
  const run = (a, kg, depth, load, secs) => {
    for (let i = 0; i < secs / dt; i++) a = ventStep(a, kg, depth, need, load, dt);
    return a;
  };
  // Clear of the water: all air. Half out and driven hard: the air's down within half a second.
  assert.equal(ventStep(0, 0, -0.05, need, 1, dt), 1);
  const down = run(0, 0.5, 0.03, 1, 0.5);
  assert.ok(down > 0.9, `half out, driven hard: ${down.toFixed(2)}`);
  // Eased right back, a propeller half out draws no air.
  assert.equal(run(0, 0.5, 0.03, 0.1, 1), 0);
  // Back under, just deep enough to grip but no deeper: the air stays (its memory).
  assert.equal(run(1, 1, need * 1.2, 1, 3), 1);
  // Well under (deeper than it needs by a good margin), it washes out over a second or so.
  const half = run(1, 1, need * 2, 1, 0.4), out = run(1, 1, need * 2, 1, 3);
  assert.ok(half > 0.3 && half < 0.8 && out < 0.01, `washing out: ${half.toFixed(2)} after 0.4 s, ${out.toFixed(3)} after 3`);
  // Or eased off where it is.
  assert.ok(run(1, 1, need * 1.2, 0.1, 3) < 0.01);
  // With the air down most of its push is gone.
  assert.ok(VENT.loss > 0.5 && VENT.loss < 0.9);

  // On a RIB flat out: lifted clear for half a second, then back where she floats, her
  // propeller's grip comes back over a moment as the air washes out, not at once.
  calm();
  const b = new Boat(scene, { kind: 'rib' });
  b.place(150, 330, 0);
  for (let i = 0; i < 60; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  const H = b._phys, y0 = H.x[1], th = { p: [0, b.hull.keel(0) - 0.28, -b.hull.L / 2], d: [0, 0, 1], f: 2000, vent: 0.1, load: 1 };
  const env = { t: 0, water: (x, z, t, o) => { o.h = 0; o.vx = o.vy = o.vz = 0; return o; }, ground: () => -100 };
  const at = (lift, secs) => {
    const ks = [];
    for (let i = 0; i < secs * 120; i++) {
      H.x[1] = y0 + lift;
      H.v[0] = H.v[1] = H.v[2] = 0;
      H.thrusters.length = 0;
      H.thrusters.push(th);
      H.forces.length = 0;
      H.step(1 / 120, { ...env, t: 10 + i / 120 });
      ks.push(th.k);
    }
    return ks;
  };
  const before = at(0, 0.5).at(-1);
  at(1.2, 0.5);
  const back = at(0, 3);
  assert.ok(before > 0.99, `in the water, a full grip: ${before.toFixed(2)}`);
  assert.ok(back[12] < 0.7, `just back in, a tenth of a second on: ${back[12].toFixed(2)}`);
  assert.ok(back.at(-1) > 0.97, `three seconds on, its grip back: ${back.at(-1).toFixed(2)}`);
});

test('the water into her propeller: her way through it, less the waves’ own motion along her there', () => {
  // A swell running: her propeller's inflow is her speed through the water less the waves'
  // motion along her at her propeller's depth (B2's), so it differs from her speed as each wave
  // goes by; in a flat calm it's her speed.
  C.conditions.wind.speed = C.conditions.wind.target = 7;
  C.conditions.wind.from = 3.9;
  C.conditions.sea.swell = 0.6;
  C.conditions.swellAmps.fill(0.3);
  longSea.setWind(7, 3.9, 0.06 ** 2 / 4, 0.5);
  const b = new Boat(scene, { kind: 'rib' });
  b.place(-186, 666, 0);
  const M = b.motorSpec ? { inboard: false } : { inboard: false };
  let most = 0;
  for (let i = 0; i < 30 * 20; i++) {
    C.conditions.time = 100 + i / 30;
    b.update(1 / 30, 100 + i / 30, 0.3, 0, 0);
    const vf = b.forwardSpeed, vin = b.propInflow(vf, M);
    most = Math.max(most, Math.abs(vin - vf));
  }
  assert.ok(most > 0.2, `in a swell the waves move the water into her propeller by up to ${most.toFixed(2)} m/s`);
  calm();
  const c = new Boat(scene, { kind: 'rib' });
  c.place(150, 330, 0);
  for (let i = 0; i < 30 * 5; i++) c.update(1 / 30, 200 + i / 30, 0.3, 0, 0);
  assert.ok(Math.abs(c.propInflow(c.forwardSpeed, M) - c.forwardSpeed) < 0.02, 'in a calm, her speed');
});
