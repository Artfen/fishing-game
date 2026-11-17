// The haze (W3, docs/WATER.md): the far sea and the far shore fade into the sky's own colour along
// the horizon, the way you look, so the sea meets the sky without a seam: warm towards a low sun
// and bright round it, dusk-blue on the far side, a storm's dark. (Before, the haze was one colour
// for the whole view, taken from the way the camera faced: the far sea began a step darker than the
// sky just above it, 12 levels of 255 at dawn, 6 in a storm, and turning to face a low sun warmed
// all of it at once.) The sky dome's
// colour at the horizon is worked out here as its shader does (sky.js skyFrag at h = 0, a storm's
// torn cloud at its average), and the haze checked against it. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };

const { Environment, HAZE, hazeAt } = await import('../src/world/sky.js');

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(0xffffff, 0.002);
const env = new Environment(scene);
const camera = new THREE.PerspectiveCamera();
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// The dome's colour at the horizon, looking along (dx, dz), as skyFrag works it out.
function domeAt(dx, dz) {
  const su = env.skyUniforms, H = su.uHorizon.value, Z = su.uZenith.value, S = su.uSunColor.value, D = su.uSunDir.value;
  const g = su.uGlow.value, rain = su.uRain.value, storm = su.uStorm.value;
  const l = Math.hypot(dx, dz), sl = Math.hypot(D.x, D.z);
  const toward = ((dx * D.x + dz * D.z) / (l * sl)) * 0.5 + 0.5;
  const sd = Math.max(0, (dx * D.x + dz * D.z) / l), sunVis = sm(-0.12, 0.02, D.y) * (1 - rain * 0.8);
  const w = sm(0.15, 1, toward);
  return ['r', 'g', 'b'].map((k, i) => {
    const away = H[k] + (Z[k] * 1.15 + [0.07, 0.035, 0.09][i] - H[k]) * 0.42 * g, near = H[k] * 1.04 + S[k] * 0.1 * g;
    let c = away + (near - away) * w + S[k] * toward ** 4 * 0.22 * g + S[k] * (sd ** 5 * 0.16 + sd ** 40 * 0.32) * sunVis;
    return c + (H[k] * 0.55 - c) * storm * sm(-0.1, 0.05, 0);
  });
}

const at = (hour, { rain = 0, cloud = 0, storm = 0, dir = [0, -1] } = {}) => {
  env.storm = storm;
  camera.position.set(0, 2, 0);
  camera.lookAt(dir[0], 2, dir[1]);
  camera.updateMatrixWorld(true);
  env.update(1 / 30, 100, hour, rain, new THREE.Vector3(), camera, {}, cloud);
};

test('the haze along the horizon is the sky’s own colour there, whichever way you look: no seam', () => {
  const c = new THREE.Color();
  for (const [hour, w] of [[6.4, {}], [12.5, {}], [19.5, {}], [16, { rain: 0.6, cloud: 0.9 }], [13, { storm: 1, cloud: 1 }], [23, {}]]) {
    at(hour, w);
    for (let a = 0; a < 16; a++) {
      const dx = Math.cos((a / 16) * Math.PI * 2), dz = Math.sin((a / 16) * Math.PI * 2);
      hazeAt(dx, dz, c);
      const d = domeAt(dx, dz);
      const off = Math.max(Math.abs(c.r - d[0]), Math.abs(c.g - d[1]), Math.abs(c.b - d[2]));
      assert.ok(off < 0.004, `at ${hour}h ${JSON.stringify(w)}, looking ${a}/16 round: haze ${c.toArray().map((v) => v.toFixed(3))}, sky ${d.map((v) => v.toFixed(3))}`);
    }
    // (Every hazed thing gets the haze the sky's: under water, it's the water's own instead.)
    assert.equal(HAZE.hazeSun.value[3], 1);
  }
});

test('towards a low sun the haze glows warm, away from it it’s cooler; at noon it’s much the same all round', () => {
  const c = new THREE.Color(), lum = (k) => k.r * 0.3 + k.g * 0.59 + k.b * 0.11;
  for (const hour of [6.4, 19.5]) {
    at(hour);
    const D = env.sunDir, l = Math.hypot(D.x, D.z);
    const to = hazeAt(D.x / l, D.z / l, c.clone()), away = hazeAt(-D.x / l, -D.z / l, c.clone());
    assert.ok(lum(to) > lum(away) * 1.3, `${hour}h: brighter towards the sun (${lum(to).toFixed(3)} against ${lum(away).toFixed(3)})`);
    assert.ok(to.r / to.b > (away.r / away.b) * 1.15, `${hour}h: warmer towards the sun`);
  }
  at(12.5);
  const D = env.sunDir, l = Math.hypot(D.x, D.z);
  const to = hazeAt(D.x / l, D.z / l, c.clone()), away = hazeAt(-D.x / l, -D.z / l, c.clone());
  assert.ok(lum(to) / lum(away) < 1.25, `noon: much the same all round (${lum(to).toFixed(3)} against ${lum(away).toFixed(3)})`);
});

test('the fog’s one colour is the haze straight ahead; under the water, the water’s', () => {
  // (What reads the fog's colour on the CPU, and the water closing over you as you dive, take the
  // haze the way you're looking.)
  for (const dir of [[-1, 0.2], [1, 0], [0.3, 1]]) {
    at(19.5, { dir });
    const ahead = hazeAt(dir[0], dir[1], new THREE.Color());
    assert.ok(Math.abs(scene.fog.color.r - ahead.r) < 1e-6 && Math.abs(scene.fog.color.g - ahead.g) < 1e-6 && Math.abs(scene.fog.color.b - ahead.b) < 1e-6, JSON.stringify(dir));
  }
  // (Under the water the haze is the water's: the sky's share goes, and comes back as you surface.)
  env.setUnder(1, new THREE.Color(0, 0.2, 0.3));
  assert.equal(HAZE.hazeSun.value[3], 0);
  env.setUnder(0.25, new THREE.Color(0, 0.2, 0.3));
  assert.equal(HAZE.hazeSun.value[3], 0.75);
  env.setUnder(0, new THREE.Color(0, 0.2, 0.3));
  assert.equal(HAZE.hazeSun.value[3], 1);
});
