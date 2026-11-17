// Whitecaps (src/world/ocean.js ageFoam): found inspecting the water closely. Whenever the wind was
// too light for whitecaps (under about 4.5 m/s, as at most starts), the pinch the caps break at was
// left at minus infinity, and every cell of foam became "not a number"; nothing ever cleared it, so
// from then on no whitecap was drawn, in a fresh breeze or a gale. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const O = await import('../src/world/ocean.js');

// The long sea in a wind of u m/s for `secs` from `t`, as conditions.js sets it (its spectrum's
// size and the crests' sharpness for that wind: see conditions.js).
function blow(S, u, t, secs) {
  S.setWind(u, 0.7, 0.0004 * u * u, Math.min(0.93, 0.15 + u * 0.06));
  for (const end = t + secs; t < end; t += 0.05) S.at(t);
  return t;
}
const cover = (S) => {
  let bad = 0, white = 0;
  for (const v of S.foam) {
    if (!Number.isFinite(v)) bad++;
    else if (v > 0.5) white++;
  }
  return { bad, white: white / S.foam.length };
};

test('whitecaps come with a fresh breeze after light air, and go again when it drops', () => {
  const S = new O.LongSea();
  let t = blow(S, 2, 0, 6);
  let c = cover(S);
  assert.equal(c.bad, 0, 'light air leaves the foam as numbers');
  assert.equal(c.white, 0, 'and no whitecaps');
  // (A fresh breeze: about 1% of the sea breaking at once, Monahan's; each patch of foam lingers a
  // few seconds as it fades, so a little more is white at any moment.)
  t = blow(S, 11, t, 10);
  c = cover(S);
  assert.equal(c.bad, 0);
  assert.ok(c.white > 0.002 && c.white < 0.06, `whitecaps in a fresh breeze: ${(c.white * 100).toFixed(1)}% white`);
  // (A gale: far more.)
  t = blow(S, 20, t, 10);
  const gale = cover(S);
  assert.ok(gale.white > c.white * 2, `more in a gale: ${(gale.white * 100).toFixed(1)}%`);
  // (The wind drops: the foam fades away within a few of its fading times.)
  t = blow(S, 2, t, 15);
  c = cover(S);
  assert.equal(c.bad, 0);
  assert.equal(c.white, 0, 'gone when the wind drops');
});

test('foam that has gone wrong mends itself', () => {
  const S = new O.LongSea();
  let t = blow(S, 11, 0, 3);
  S.foam.fill(NaN);
  t = blow(S, 11, t, 6);
  const c = cover(S);
  assert.equal(c.bad, 0, 'every cell a number again');
  assert.ok(c.white > 0.002, `and whitecaps: ${(c.white * 100).toFixed(1)}%`);
  S.foam.fill(NaN);
  blow(S, 2, t, 1);
  assert.equal(cover(S).bad, 0, 'in light air too');
});
