// The sea's surface as light sees it (W2, docs/WATER.md): the slopes of the waves too small to
// draw, for the sun's glitter. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;
const { seaSlopeVariance } = await import('../src/world/water.js');

test('the sea’s slopes for the sun’s glitter are Cox and Munk’s, wider along the wind than across it', () => {
  // (Cox and Munk 1954, clean surface: up the wind 3.16e-3 U, across it 0.003 + 1.92e-3 U; together
  // 0.003 + 5.12e-3 U within their scatter.)
  for (const u of [2, 5, 10, 15]) {
    const [up, across] = seaSlopeVariance(u);
    assert.ok(Math.abs(up - 3.16e-3 * u) < 1e-9, `up the wind at ${u} m/s: ${up}`);
    assert.ok(Math.abs(across - (0.003 + 1.92e-3 * u)) < 1e-9, `across it: ${across}`);
    assert.ok(Math.abs(up + across - (0.003 + 5.12e-3 * u)) < 0.002 * u, `together: ${up + across}`);
    if (u > 2) assert.ok(up > across, 'rougher along the wind than across it');
  }
  // (Rougher the fresher it blows; never quite glassy, even in a flat calm.)
  assert.ok(seaSlopeVariance(10)[0] > seaSlopeVariance(5)[0]);
  const calm = seaSlopeVariance(0);
  assert.ok(calm[0] > 0 && calm[1] > 0.003, JSON.stringify(calm));
  assert.deepEqual(seaSlopeVariance(undefined), calm, 'no wind given: a calm');
});
