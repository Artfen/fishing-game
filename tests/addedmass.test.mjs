// Added mass (B1, docs/WATER.md): the water a hull moves as she heaves, pitches and rolls. Without
// it a light boat bobbed faster than a real one, like a toy. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;
const { Boat, HULLS } = await import('../src/boat.js');
const { buildHullModel } = await import('../src/hydro.js');
const C = await import('../src/world/conditions.js');
const O = await import('../src/world/ocean.js');

const scene = new THREE.Scene();
const flat = () => {
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 0, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 0;
  for (let i = 0; i < 300; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  C.conditions.swellAmps.fill(0);
  C.conditions.sea.swell = C.conditions.sea.chop = 0;
  O.longSea.setWind(0, 0, 0, 0);
};

test('each hull carries the water she moves: one to two times her mass for the light boats, less for the heavy', () => {
  for (const [kind, H] of Object.entries(HULLS)) {
    const M = buildHullModel(H), r = M.addedHeave / M.mass;
    assert.ok(r >= 0.3 && r <= 2, `${kind}: ${r.toFixed(2)} of her mass`);
    assert.ok(M.addedPitch > 0 && M.addedRoll > 0 && M.addedRoll < M.inertia[2] * 0.5, kind);
  }
  const r = (k) => { const M = buildHullModel(HULLS[k]); return M.addedHeave / M.mass; };
  assert.ok(r('row') > 1 && r('skiff') > 1, 'the open boats: more than their own weight of water');
  assert.ok(r('cruiser') < 1 && r('cruiser') < r('cabin') && r('cabin') < r('row'), 'the heavier, the less, for her mass');
});

test('the rowing boat lifted and let go bobs at a boat’s pace, not a toy’s, and settles; at rest she floats as she did', () => {
  flat();
  const b = new Boat(scene, { kind: 'row' });
  b.place(150, 330, 0);
  let t = 0;
  for (let i = 0; i < 300; i++) { t += 1 / 60; b.update(1 / 60, t, 0, 0, 0); }
  const P = b.phys, y0 = P.x[1];
  P.x[1] += 0.1;
  const ys = [];
  for (let i = 0; i < 60 * 6; i++) { t += 1 / 60; b.update(1 / 60, t, 0, 0, 0); ys.push(P.x[1] - y0); }
  // (Her first trough, then the next crest: half a swing.)
  let lo = 1, hi = -1;
  for (let i = 1; i < ys.length - 1; i++) if (ys[i] < ys[i - 1] && ys[i] <= ys[i + 1]) { lo = i; break; }
  for (let i = lo + 1; i < ys.length - 1; i++) if (ys[i] > ys[i - 1] && ys[i] >= ys[i + 1]) { hi = i; break; }
  const period = (2 * (hi - lo)) / 60;
  // (Without the water she moves: about 0.6 s, a toy's bob.)
  assert.ok(period > 0.72 && period < 1.4, `heave period ${period.toFixed(2)} s`);
  const late = Math.max(...ys.slice(-60).map(Math.abs));
  assert.ok(late < 0.01, `settled: ${late.toFixed(3)} m`);
  // (Her added mass changes how she moves, not where she floats.)
  assert.ok(Math.abs(P.x[1] - y0) < 0.005, 'back where she floated');
});

test('out of the water she falls as fast as anything does: no water to move', () => {
  flat();
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(150, 330, 0);
  let t = 0;
  for (let i = 0; i < 120; i++) { t += 1 / 60; b.update(1 / 60, t, 0, 0, 0); }
  const P = b.phys;
  P.x[1] += 3;
  P.v[1] = 0;
  // (A few steps in, still well clear of the water: falling at g.)
  for (let i = 0; i < 6; i++) { t += 1 / 60; b.update(1 / 60, t, 0, 0, 0); }
  const v0 = P.v[1];
  for (let i = 0; i < 6; i++) { t += 1 / 60; b.update(1 / 60, t, 0, 0, 0); }
  const a = (P.v[1] - v0) / (6 / 60);
  assert.ok(Math.abs(a + 9.81) < 0.6, `falling at ${a.toFixed(2)} m/s²`);
});
