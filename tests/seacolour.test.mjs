// The water's colour from light in water (W4, docs/WATER.md): seen from above, the seabed and all
// under the sea is seen through the water, each colour taken up along the light's way down and back
// up, the water's glow in its place (sky.js fog chunk, water.js seaLight). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };

const { seaSigma, SEA_SIGMA, refractedCos } = await import('../src/world/water.js');
const { HAZE } = await import('../src/world/sky.js');

test('this coast’s water is coastal water: red gone first, green kept longest; Las Brasas’ is clear and blue', () => {
  const [r, g, b] = seaSigma(0, 0, 0);
  assert.ok(r > b && b > g, `coastal: red, then blue (taken by what comes off the land), then green: ${[r, g, b]}`);
  // (Its Secchi depth, about 1.7 over the clearest colour's attenuation: eight to twelve metres in
  // summer here, as off south-west Britain and Brittany.)
  const secchi = 1.7 / Math.min(r, g, b);
  assert.ok(secchi > 8 && secchi < 12, `coastal Secchi depth ${secchi.toFixed(1)} m`);
  const [cr, cg, cb] = seaSigma(1, 0, 0);
  assert.ok(cr > cg && cg > cb, `clear: blue kept longest: ${[cr, cg, cb]}`);
  const clearSecchi = 1.7 / Math.min(cr, cg, cb);
  assert.ok(clearSecchi > 25 && clearSecchi < 45, `clear Secchi depth ${clearSecchi.toFixed(1)} m (the Canaries' summer, 25 m or more)`);
  // (Silt after a blow, and a storm's churn, take every colour faster; silt not in the clear water.)
  const silty = seaSigma(0, 1, 0), stormy = seaSigma(0, 0, 1);
  for (let i = 0; i < 3; i++) {
    assert.ok(silty[i] > SEA_SIGMA.coastal[i] * 2, `silt, colour ${i}`);
    assert.ok(stormy[i] > SEA_SIGMA.coastal[i], `storm, colour ${i}`);
  }
  assert.deepEqual(seaSigma(1, 1, 0).map((v) => +v.toFixed(6)), SEA_SIGMA.clear.map((v) => +v.toFixed(6)));
});

test('light into the water is bent towards the vertical (Snell): straight down stays straight; from the horizon, 48.6° at most', () => {
  assert.ok(Math.abs(refractedCos(1) - 1) < 1e-9);
  assert.ok(Math.abs(Math.acos(refractedCos(0)) * 180 / Math.PI - 48.6) < 0.1, `${Math.acos(refractedCos(0)) * 180 / Math.PI}`);
  for (const c of [0.1, 0.3, 0.6, 0.9]) assert.ok(refractedCos(c) > c, 'always nearer the vertical in the water');
});

test('everything hazed takes the sea’s light from the same shared values, and the water’s own surface isn’t tinted by it', async () => {
  for (const k of ['hazeSea', 'hazeSigma', 'hazeWater']) {
    assert.ok(HAZE[k].value instanceof Float32Array, `${k} is shared as it is`);
    assert.equal(THREE.UniformsLib.fog[k], HAZE[k]);
    assert.equal(THREE.ShaderLib.lambert.uniforms[k], HAZE[k]);
  }
  const chunk = THREE.ShaderChunk.fog_fragment;
  assert.ok(/#ifndef NO_WATER_TINT/.test(chunk) && /hazeSigma/.test(chunk), 'the fog chunk sees through the sea');
  assert.ok(/PREMULTIPLIED_ALPHA/.test(chunk), 'and hazes premultiplied light as light');
  // (The sea's own surface, and the rivers', are their own water: not seen through it again.)
  const src = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/world/water.js', import.meta.url), 'utf8'));
  assert.equal((src.match(/NO_WATER_TINT: 1/g) || []).length, 2, 'the near sheet and the far ring');
  assert.equal((src.match(/premultipliedAlpha: true/g) || []).length, 2);
  const river = await import('node:fs').then((fs) => fs.readFileSync(new URL('../src/world/riverwater.js', import.meta.url), 'utf8'));
  assert.ok(/NO_WATER_TINT: 1/.test(river), 'the rivers');
});
