// (B3, second part) A planing hull's running trim, checked against Savitsky's equations for a
// prismatic planing surface (hydro.js savitskyTrim, savitskyCP): the lift a planing bottom gives
// for its wetted length and trim, where it acts, and the trim at which it carries her weight at
// her centre of gravity. The RIB and the jet ski, running fully on the plane, trim as his
// equations have them; before this they ran 1 to 2 degrees flatter. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const Hy = await import('../src/hydro.js');
const { Boat, HULLS } = await import('../src/boat.js');
const { conditions, updateConditions } = await import('../src/world/conditions.js');

test('Savitsky’s planing equations: the trim and wetted length that carry her weight where her centre of gravity is', () => {
  const { savitskyTrim, savitskyCP, RHO, G } = Hy;
  // Where a planing bottom's lift acts, as a share of its wetted length from the transom: three
  // quarters of it going fast; a third of it (a wedge's buoyancy, deepest at the transom) slow.
  assert.ok(Math.abs(savitskyCP(100, 2) - 0.75) < 0.002);
  assert.ok(Math.abs(savitskyCP(1e-3, 2) - (0.75 - 1 / 2.39)) < 1e-4);
  assert.ok(savitskyCP(4, 2) > savitskyCP(2, 2) && savitskyCP(4, 2) > savitskyCP(4, 3));
  // The solution carries her weight (½ρV²b²·C_Lβ, C_Lβ from C_L0 and her deadrise) and puts the
  // lift at her centre of gravity.
  const boat = { mass: 1250, b: 1.71, deadrise: 24, lcg: 2.42 };
  for (const speed of [8, 12, 16, 20]) {
    const r = savitskyTrim({ ...boat, speed });
    const cl0 = Math.pow(r.tau, 1.1) * (0.012 * Math.sqrt(r.lambda) + (0.0055 * Math.pow(r.lambda, 2.5)) / (r.cv * r.cv));
    const clb = cl0 - 0.0065 * boat.deadrise * Math.pow(cl0, 0.6);
    const lift = 0.5 * RHO * speed * speed * boat.b * boat.b * clb;
    assert.ok(Math.abs(lift / (boat.mass * G) - 1) < 0.005, `${speed} m/s: lift ${lift.toFixed(0)} N for ${(boat.mass * G).toFixed(0)}`);
    assert.ok(Math.abs((r.lambda * savitskyCP(r.cv, r.lambda) * boat.b) / boat.lcg - 1) < 0.005, `${speed} m/s: acting at her centre of gravity`);
    assert.ok(r.tau > 2 && r.tau < 8 && r.lambda > 1 && r.lambda < 4, `${speed} m/s: ${r.tau.toFixed(2)}°, λ ${r.lambda.toFixed(2)}`);
  }
  // As a planing hull goes faster she trims flatter on a shorter wetted length; heavier, or her
  // weight further aft, she trims up more.
  const at = (o) => savitskyTrim({ ...boat, speed: 14, ...o });
  assert.ok(savitskyTrim({ ...boat, speed: 18 }).tau < at({}).tau && at({}).tau < savitskyTrim({ ...boat, speed: 10 }).tau);
  assert.ok(at({ mass: 1600 }).tau > at({}).tau);
  assert.ok(at({ lcg: 2.0 }).tau > at({}).tau);
});

test('running on the plane, the RIB and the jet ski trim as Savitsky’s equations have them, and steadily', () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
  for (let i = 0; i < 3000; i++) updateConditions(0.1, { rain: 0, cloud: 0, storm: 0 });
  const scene = new THREE.Scene();
  // Her running trim: the angle of her bottom to the water (her keel aft, less her pitch, + bow
  // down), steady over ten seconds at each lever, against Savitsky's for her weight, beam at the
  // chine, deadrise, centre of gravity and speed.
  const trial = (kind, lever) => {
    const H = HULLS[kind], b = new Boat(scene, { kind });
    b.place(150, 330, Math.PI / 2);
    const keel = Math.atan2(H.keel(0.4) - H.keel(0.05), 0.35 * H.L);
    let t = 0;
    for (let i = 0; i < 35 * 30; i++) b.update(1 / 30, (conditions.time = t += 1 / 30), lever, 0, 0);
    let v = 0, p = 0, p2 = 0, n = 0;
    for (let i = 0; i < 10 * 30; i++) {
      b.update(1 / 30, (conditions.time = t += 1 / 30), lever, 0, 0);
      v += b.forwardSpeed; p += b.pitch; p2 += b.pitch * b.pitch; n++;
    }
    const M = b.phys.model, speed = v / n, trim = (keel - p / n) * (180 / Math.PI);
    const sav = Hy.savitskyTrim({ mass: b.phys.m, b: M.planeBeam, deadrise: H.planing.deadrise, lcg: H.L / 2 + M.cg[2], speed });
    return { speed, trim, sav: sav.tau, cv: sav.cv, sd: Math.sqrt(Math.max(0, p2 / n - (p / n) ** 2)) * (180 / Math.PI) };
  };
  for (const [kind, levers] of [['rib', [0.7, 0.85, 1]], ['jetski', [0.7, 0.85, 1]]]) {
    for (const lever of levers) {
      const r = trial(kind, lever);
      const say = `${kind} at ${r.speed.toFixed(1)} m/s (Cv ${r.cv.toFixed(1)}): ${r.trim.toFixed(2)}° against Savitsky's ${r.sav.toFixed(2)}° (steady to ${r.sd.toFixed(2)}°)`;
      assert.ok(r.cv > 3.4, `fully on the plane: ${say}`);
      assert.ok(Math.abs(r.trim - r.sav) < 1, say);
      assert.ok(r.sd < 0.5, `no porpoising: ${say}`);
    }
  }
  conditions.manual = null;
});
