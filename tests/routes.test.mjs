// Routes and the chart's layers (src/routes.js, map.js): a passage planned mark by mark, each
// leg's course and distance, its time and fuel for the boat from what she does at her cruise; the
// plotter following it, moving on as each mark is rounded; the routes kept in the save; the
// buoys, harbours and anchorages charted. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const R = await import('../src/routes.js');
const { parseSave, envelope } = await import('../src/save.js');
const { MARKS } = await import('../src/chartMarks.js');
const { depthAt, solidHeight } = await import('../src/world/terrain.js');
const { TRIALS } = await import('../src/engineTrials.js');
const { CATALOGUE, KN } = await import('../src/engines.js');

test('a course and a distance for each leg, the whole passage in time and fuel', () => {
  assert.equal(R.courseTo(0, 0, 0, -100), 0, 'north is up the chart');
  assert.equal(R.courseTo(0, 0, 100, 0), 90);
  assert.equal(R.courseTo(0, 0, 0, 100), 180);
  assert.equal(R.courseTo(0, 0, -100, 0), 270);
  const pts = [[0, 0], [0, -1852], [1852, -1852]];
  const { legs, m } = R.legsOf(pts);
  assert.deepEqual(legs.map((l) => l.course), [0, 90]);
  assert.ok(Math.abs(m - 2 * 1852) < 1e-9);
  // Two sea miles at the RIB's cruise, with what she burns there.
  const T = TRIALS.rib['f150/matched'];
  const P = R.passage(pts, { knots: CATALOGUE.rib.cruise, lph: T.lph, tank: 150 });
  assert.ok(Math.abs(P.nm - 2) < 1e-9 && Math.abs(P.hours - 2 / 25) < 1e-9);
  assert.ok(Math.abs(P.litres - (2 / 25) * T.lph) < 1e-9 && P.spare > 0 && !P.fine);
  // A long way on a small tank: cutting it fine.
  assert.equal(R.passage([[0, 0], [0, -1852 * 50]], { knots: 25, lph: T.lph, tank: 150 }).fine, true);
  assert.equal(R.timeWords(0.5), '30 min');
  assert.equal(R.timeWords(1.25), '1 h 15');
  assert.equal(R.rangeWords(240), '240 m');
  assert.equal(R.rangeWords(1852 * 2.5), '2.5 nm');
  assert.equal(R.courseWords(7), '007°');
});

test('following a route: the course and distance to the next mark, on to the next as each is rounded', () => {
  const route = { id: 'r1', name: 'Round the Skerries', pts: [[0, 0], [0, -500], [400, -500], [400, 0]] };
  let f = R.follow(route, 1, 0, -10);
  assert.ok(f.leg === 1 && f.course === 0 && Math.abs(f.m - 490) < 1e-9 && !f.done);
  // Within a boat's length or two of the mark: rounded, on to the next.
  f = R.follow(route, 1, 5, -480);
  assert.ok(f.leg === 2 && f.rounded && Math.abs(f.course - 90) <= 3, JSON.stringify(f));
  f = R.follow(route, 3, 400, -10);
  assert.ok(f.done, 'the last mark: home');
});

test('kept in the save: your routes and the one you’re following; nonsense dropped', () => {
  const routes = [
    { id: 'r1', name: 'To the Hound', pts: [[10.4, 20], [300, -400], [800, -900]] },
    { id: 'r2', name: '', pts: [[0, 0], [5, 5]] },
    { id: 'BAD ID', name: 'x', pts: [[0, 0], [1, 1]] },
    { id: 'r3', name: 'one point', pts: [[0, 0]] },
    { id: 'r1', name: 'duplicate', pts: [[0, 0], [1, 1]] },
    { id: 'r4', name: 'junk points', pts: [[0, 0], ['a', 2], [NaN, 1], [3, 3]] },
  ];
  const clean = R.cleanRoutes(routes);
  assert.deepEqual(clean.map((r) => r.id), ['r1', 'r2', 'r4']);
  assert.deepEqual(clean[0].pts[0], [10, 20]);
  assert.equal(clean[1].name, 'Route 2');
  assert.deepEqual(clean[2].pts, [[0, 0], [3, 3]]);
  assert.deepEqual(R.cleanActive({ id: 'r1', leg: 9 }, clean), { id: 'r1', leg: 2 });
  assert.equal(R.cleanActive({ id: 'gone', leg: 1 }, clean), null);
  // Through the whole save, and back.
  const s = parseSave(JSON.stringify(envelope({ day: 4, routes: clean, route: { id: 'r1', leg: 1 } }))).state;
  assert.deepEqual(s.routes, clean);
  assert.deepEqual(s.route, { id: 'r1', leg: 1 });
  const fresh = parseSave(JSON.stringify(envelope({ day: 1 }))).state;
  assert.deepEqual(fresh.routes, []);
  assert.equal(fresh.route, null);
});

test('the chart’s marks: the buoys in the water, the harbours and anchorages, each where it is', () => {
  const kinds = new Set(MARKS.map((m) => m.kind));
  for (const k of ['port', 'starboard', 'special', 'harbour', 'anchorage']) assert.ok(kinds.has(k), k);
  for (const m of MARKS) {
    assert.ok(m.name && Number.isFinite(m.x) && Number.isFinite(m.z), m.name);
    // Buoys float in water; anchorages are over water.
    if (m.kind !== 'harbour') assert.ok(depthAt(m.x, m.z) > 0.5, `${m.name}: ${depthAt(m.x, m.z).toFixed(1)} m of water`);
  }
});
