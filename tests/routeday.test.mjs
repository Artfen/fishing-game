// A route's day (F2d, see routes.js): a route by the game's clock as well as your time at the helm;
// where she is part-way along it; when she's in; where the sunset and a gale due would find her;
// the last sheltered mark before dark; and on the real chart, the bay sheltered and open water not.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { runHours, alongAt, routeDay, lastMarkBefore, passage, HOUR_S, KNOT, NM } = await import('../src/routes.js');
const { HOUR_SECONDS } = await import('../src/world/clock.js');
const { zoneAt } = await import('../src/world/terrain.js');
const { isSheltered } = await import('../src/daybook.js');

const near = (a, b, e = 1e-6) => Math.abs(a - b) < e;

test('a route by the game’s clock: a sea mile at six knots is ten minutes at the helm and fifteen hours of the day', () => {
  assert.equal(HOUR_S, HOUR_SECONDS, 'the game clock’s own hour');
  assert.ok(near(runHours(NM, 6), 15, 1e-9));
  const P = passage([[0, 0], [NM, 0]], { knots: 6, lph: 0, tank: 0 });
  assert.ok(near(P.hours * 60, 10, 1e-9), 'the time at the helm, as the route card had it');
  assert.equal(runHours(100, 0), Infinity);
  assert.ok(near(KNOT, 1852 / 3600));
});

test('where she is along it, and the day it takes', () => {
  // Two legs: 1 nm east, then 1 nm north (−z). At 6 knots, 15 hours each.
  const pts = [[0, 0], [NM, 0], [NM, -NM]];
  const half = alongAt(pts, 6, 7.5);
  assert.ok(near(half.x, NM / 2, 1e-6) && near(half.z, 0) && half.leg === 1 && !half.done, 'halfway down the first leg');
  const second = alongAt(pts, 6, 22.5);
  assert.ok(near(second.x, NM) && near(second.z, -NM / 2, 1e-6) && second.leg === 2);
  assert.deepEqual(alongAt(pts, 6, 40), { x: NM, z: -NM, leg: 2, done: true }, 'in');
  // Leaving at 10 am on day 3 (abs 82), the sun setting at 8 pm (abs 92), a gale at 4 am (abs 100).
  const D = routeDay(pts, 6, 82, { sunset: 92, galeAt: 100 });
  assert.ok(near(D.hours, 30, 1e-9));
  assert.ok(near(D.arrive, 112, 1e-9));
  assert.equal(D.days, 2, 'a day and a quarter: two days begun');
  assert.ok(D.dark && near(D.dark.at, 92) && near(D.dark.x, (NM * 10) / 15, 1e-6) && D.dark.leg === 1, 'at sunset, two-thirds down the first leg');
  assert.ok(D.gale && D.gale.leg === 2 && near(D.gale.z, (-NM * 3) / 15, 1e-6), 'the gale finds her on the second leg');
  // In before dark: nothing to say about the night.
  const short = routeDay([[0, 0], [300, 0]], 6, 82, { sunset: 92, galeAt: 100 });
  assert.equal(short.dark, null);
  assert.equal(short.gale, null);
  assert.equal(short.days, 1);
});

test('the last sheltered mark before dark', () => {
  const pts = [[0, 0], [100, 0], [200, 0], [300, 0]];
  const sheltered = (x) => x === 100 || x === 300;
  // Each 100 m leg at 6 knots: about 0.81 game hours.
  assert.deepEqual(lastMarkBefore(pts, 6, 2, sheltered), { i: 1, x: 100, z: 0 }, 'mark 1 (mark 3 is beyond the dark)');
  assert.deepEqual(lastMarkBefore(pts, 6, 3, sheltered), { i: 3, x: 300, z: 0 });
  assert.equal(lastMarkBefore(pts, 6, 0.5, sheltered), null, 'none before it');
  assert.deepEqual(lastMarkBefore([[0, 0], [100, 0]], 6, 5, (x) => x === 0), { i: 0, x: 0, z: 0 }, 'only where she starts');
});

test('on the chart: the bay is water to lie in for the night; open water and the outer coast are not', () => {
  const sh = (x, z) => isSheltered(zoneAt(x, z));
  assert.equal(sh(4, -40), true, 'the bay');
  assert.equal(sh(60, 160), false, 'open water');
  assert.equal(sh(-260, 520), false, 'the outer coast off Gannet Isle');
});
