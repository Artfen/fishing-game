// (W4b) The bottom seen through the moving surface: where the eye's ray, bent by the slope of the
// bit of surface it goes through (Snell's law), meets the bottom, against where it would through a
// level surface. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { bottomShift } = await import('../src/world/water.js');

const norm = (v) => {
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
};

test('a level surface moves nothing; a sloping one bends the ray as Snell says', () => {
  // Level: from any way of looking, nothing moves.
  for (const V of [[0, 1, 0], norm([0.5, 1, 0.2]), norm([-1, 0.4, 0.3])]) {
    const s = bottomShift(3, [0, 1, 0], V);
    assert.ok(Math.abs(s[0]) < 1e-12 && Math.abs(s[1]) < 1e-12, `level surface, looking ${V.map((x) => x.toFixed(2))}: ${s}`);
  }
  // Looking straight down through a facet rising towards +x (slope s): the ray meets it at the
  // facet's own tilt, atan(s), and goes on at asin(sin θ / (4/3)) from its normal, so it leans
  // θ − that from straight down, towards +x (away from where the facet faces). d metres down, the
  // bottom it meets is d·tan of that along.
  for (const slope of [0.05, 0.2, 0.5]) {
    const N = norm([-slope, 1, 0]), th = Math.atan(slope), tt = Math.asin(Math.sin(th) * 0.75);
    for (const d of [0.5, 2, 5]) {
      const s = bottomShift(d, N, [0, 1, 0]);
      const want = d * Math.tan(th - tt);
      assert.ok(Math.abs(s[0] - want) < 1e-9 && Math.abs(s[1]) < 1e-12, `slope ${slope}, ${d} m down: ${s[0].toFixed(5)} vs ${want.toFixed(5)}`);
    }
  }
  // (So for gentle slopes, about a quarter of the depth times the slope: 2 m down under a 0.1
  // slope, about 5 cm.)
  const s = bottomShift(2, norm([-0.1, 1, 0]), [0, 1, 0]);
  assert.ok(Math.abs(s[0] - 0.25 * 2 * 0.1) < 0.002, `${s[0].toFixed(4)} m`);
  // Across the other way, and twice as deep, twice as far.
  const a = bottomShift(1, norm([0, 1, 0.15]), norm([0.3, 1, -0.2])), b = bottomShift(2, norm([0, 1, 0.15]), norm([0.3, 1, -0.2]));
  assert.ok(a[1] < 0 && Math.abs(b[0] - 2 * a[0]) < 1e-9 && Math.abs(b[1] - 2 * a[1]) < 1e-9, `${a}, ${b}`);
});

test('the sea shader sees what is under it through its moving surface, with Ocean: Full', () => {
  const src = readFileSync(new URL('../src/world/water.js', import.meta.url), 'utf8');
  // The same bend in the shader as in JS.
  assert.match(src, /vec2 bottomShift\(float d, vec3 N, vec3 V\) \{\n  vec3 T = refract\(-V, N, 0\.75\), T0 = refract\(-V, vec3\(0\.0, 1\.0, 0\.0\), 0\.75\);/);
  // Laid in after the fog, where the blending would have laid the sea over what's below, and only
  // on the detailed sheet (not the far ring).
  const i = src.indexOf('#include <fog_fragment>\n#if DETAIL > 0'), j = src.indexOf('gl_FragColor = vec4(gl_FragColor.rgb + (1.0 - gl_FragColor.a) * below, 1.0);');
  assert.ok(i > 0 && j > i, 'composited after the fog, on the detailed sheet');
  // What's below is copied off the screen just before the sea is drawn, once a frame, only for the
  // view on the screen, only for the detailed sea (not Low's), and only with the short waves on
  // (Ocean: Full).
  assert.match(src, /mesh\.onBeforeRender = \(renderer, scene, camera\) => \{/);
  assert.match(src, /renderer\.copyFramebufferToTexture\(below\.origin, below\.tex\);/);
  assert.match(src, /if \(!below\.want \|\| !\(material\.defines\.DETAIL > 0\) \|\| uniforms\.uUnder\.value > 0\.5 \|\| renderer\.getRenderTarget\(\) !== null\) \{\n      uniforms\.uBelowOn\.value = 0;/);
  assert.match(src, /below\.want = !!shortSea;/);
  assert.match(src, /follow\(pos\) \{\n      below\.done = false;/);
});
