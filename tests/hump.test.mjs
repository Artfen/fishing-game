// (B3, the hump region) Getting onto the plane: the console, the bass boat and the skiff, from
// a speed coefficient of about 1 to their top speeds, trim as Savitsky's equations have them
// (hydro.js savitskyTrim), within 1.75°. Before this the console and the bass boat ran up to
// 2.7° flatter through a speed coefficient of about 2: the planing hull's lift was moved to where
// Savitsky puts it only from 1.5 to 3, and her bottom held her up by all the water it pushed
// aside, where on the plane it's about half (PLANE_BUOY). And the bass boat floated on a rounded
// section, flat at the keel, not the V she's drawn with, and still ran up to 1.9° flat (1.5° root
// mean square); now she floats on her V (hydro.js veeAt). And held at the hump in a head sea,
// the bass boat, the skiff and the console no longer stand on their tails. Run with
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
const { waveHeight } = await import('../src/world/water.js');

test('on the plane her bottom holds her up by about half the water it pushes aside, as Savitsky’s buoyant lift has it', () => {
  // Savitsky's buoyant lift coefficient, 0.0055·λ^2.5·τ^1.1/Cv² (τ in degrees), against a flat
  // wedge's own displacement, λ²·τ/Cv² (τ in radians), over the wetted lengths and trims a
  // planing hull runs at.
  const r = [];
  for (const lam of [1.5, 2, 2.5, 3]) for (const tau of [3, 4, 5, 6]) r.push((0.0055 * lam ** 2.5 * tau ** 1.1) / (lam * lam * tau * (Math.PI / 180)));
  const mean = r.reduce((a, b) => a + b, 0) / r.length;
  assert.ok(Math.min(...r) > 0.4 && Math.max(...r) < 0.66, r.map((x) => x.toFixed(2)).join(' '));
  assert.ok(Math.abs(mean - Hy.PLANE_BUOY) < 0.08, `${mean.toFixed(2)} against ${Hy.PLANE_BUOY}`);
  // (From a speed coefficient of 1.2, all of it by 2.4: Savitsky's equations hold from about 0.6.)
  assert.ok(Hy.PLANE_CV[0] >= 0.6 && Hy.PLANE_CV[1] <= 3);
});

test('getting onto the plane, the console, the bass boat and the skiff trim as Savitsky’s equations have them', () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
  for (let i = 0; i < 3000; i++) updateConditions(0.1, { rain: 0, cloud: 0, storm: 0 });
  const scene = new THREE.Scene();
  // Her running trim at each lever, steady over ten seconds, against Savitsky's for her weight,
  // beam at the chine, deadrise, centre of gravity and speed (as tests/planing.test.mjs).
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
  for (const kind of ['console', 'bass', 'skiff']) {
    const runs = [0.4, 0.55, 0.7, 0.85, 1].map((lever) => trial(kind, lever));
    const say = runs.map((r) => `Cv ${r.cv.toFixed(2)}: ${r.trim.toFixed(2)}° against ${r.sav.toFixed(2)}° (steady to ${r.sd.toFixed(2)}°)`).join('; ');
    // From below the hump to her top speed.
    assert.ok(runs[0].cv < 1.7 && runs[4].cv > 1.8, `${kind}: ${say}`);
    for (const r of runs) {
      assert.ok(Math.abs(r.trim - r.sav) < 1.75, `${kind}, within 1.75°: ${say}`);
      assert.ok(r.sd < 0.6, `${kind}, no porpoising: ${say}`);
    }
    const rms = Math.sqrt(runs.reduce((a, r) => a + (r.trim - r.sav) ** 2, 0) / runs.length);
    assert.ok(rms < 1.2, `${kind}, ${rms.toFixed(2)}° root mean square: ${say}`);
  }
  conditions.manual = null;
});

test('held at the hump in a head sea, the bass boat, the skiff and the console rear on their own wave, not on their tails', () => {
  // A lively sea (the wind 10 m/s from the south-west, a metre's significant height), and each
  // flat out into it from rest, as tests/watersports.test.mjs runs the jet ski: a seaway holds her
  // at the hump, where its rearing (H.hump) is at its most. Eased off from 12° up on the water
  // about her (boat.js HUMP_EASE), her bow goes no more than about 21° beyond the sea's own slope
  // along her (at most 9°); without it, it stood them on their tails, the bass boat's bow up to 41°
  // beyond it, the console's 42° and the skiff's 46°.
  const was = conditions.preset;
  conditions.preset = 'lively';
  conditions.manual = { speed: 10, from: (225 * Math.PI) / 180 };
  conditions.wind.speed = conditions.wind.target = 10;
  for (let i = 0; i < 3000; i++) updateConditions(0.1, { rain: 0, cloud: 0.2 });
  const scene = new THREE.Scene();
  for (const kind of ['bass', 'skiff', 'console']) {
    const H = HULLS[kind];
    for (const start of [0, 60, 120]) {
      let t = 1000 + start, beyond = 0, up = 0;
      const b = new Boat(scene, { kind });
      b.place(106, 294, -Math.PI * 0.25);
      for (let i = 0; i < 25 * 30; i++) {
        b.update(1 / 30, (conditions.time = t += 1 / 30), 1, 0, 0);
        if (i < 150) continue;
        // (The sea's own slope along her, over her length.)
        const r = H.L / 2, fx = b.fwd.x * r, fz = b.fwd.z * r;
        const sea = Math.atan2(waveHeight(b.pos.x + fx, b.pos.z + fz) - waveHeight(b.pos.x - fx, b.pos.z - fz), H.L);
        up = Math.max(up, -b.pitch);
        beyond = Math.max(beyond, -b.pitch - sea);
      }
      const say = `${kind}, sea ${start}: bow up ${(up * 57.3).toFixed(1)}°, ${(beyond * 57.3).toFixed(1)}° beyond the sea's slope`;
      assert.ok(beyond < 27 / 57.3, say);
      assert.ok(up < 28 / 57.3, say);
    }
  }
  conditions.manual = null;
  conditions.preset = was;
});
