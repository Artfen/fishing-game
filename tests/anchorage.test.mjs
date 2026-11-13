// A night at anchor (F2a, see anchorage.js): a gale that blows while you sleep aboard, against
// where she lies (sheltered or open) and how she's held (tied up, an ordinary anchor, the heavier
// one); dragging downwind, short of the shallows; and the words on waking. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { galeHoursIn, nightAtAnchor, dragTo, nightWords, DRAG_PER_H, DRAG_MOST, HEAVY } = await import('../src/anchorage.js');
const { galeFor } = await import('../src/world/forecast.js');
const { zoneAt, depthAt } = await import('../src/world/terrain.js');
const { isSheltered } = await import('../src/daybook.js');

// The first gale on the calendar.
let G = null;
for (let d = 1; d < 400 && !G; d++) G = galeFor(d);

test('the hours of gale in a night: all of it, part of it, none', () => {
  assert.ok(G, 'there are gales');
  const len = G.end - G.start;
  assert.ok(Math.abs(galeHoursIn(G.start - 5, G.end + 5) - len) < 1e-9, 'slept right through it');
  assert.ok(Math.abs(galeHoursIn(G.start + 1, G.end + 5) - (len - 1)) < 1e-9, 'turned in an hour after it began');
  assert.equal(galeHoursIn(G.end + 1, G.end + 9), 0, 'after it');
  assert.equal(galeHoursIn(G.start - 12, G.start - 2), 0, 'before it');
});

test('how she rides it: tied up or sheltered she holds; in the open an ordinary anchor drags, the heavier one barely', () => {
  assert.deepEqual(nightAtAnchor({ galeHours: 0 }), { dragged: 0, woke: false, rough: false }, 'a quiet night');
  assert.deepEqual(nightAtAnchor({ galeHours: 6, sheltered: true }), { dragged: 0, woke: false, rough: true }, 'in a cove');
  assert.deepEqual(nightAtAnchor({ galeHours: 6, tied: true }), { dragged: 0, woke: false, rough: true }, 'alongside');
  const open = nightAtAnchor({ galeHours: 6 });
  assert.equal(open.dragged, DRAG_PER_H * 6);
  assert.equal(open.woke, true);
  const heavy = nightAtAnchor({ galeHours: 6, hold: 2.2 });
  assert.equal(heavy.dragged, Math.round(DRAG_PER_H * 6 * HEAVY));
  assert.ok(heavy.dragged < open.dragged / 5);
  assert.equal(nightAtAnchor({ galeHours: 30 }).dragged, DRAG_MOST, 'never further than this');
});

test('dragging downwind stops short of the shallows', () => {
  const deep = () => 10;
  assert.deepEqual(dragTo(0, 0, 1, 0, 40, deep, 1.5), { x: 40, z: 0, m: 40, short: false });
  // A shoal 21 m downwind.
  const shoal = (x) => (x > 21 ? 0.5 : 10);
  const r = dragTo(0, 0, 1, 0, 60, shoal, 1.5);
  assert.equal(r.short, true);
  assert.ok(r.m <= 21 && r.m >= 18, `brought up at ${r.m} m`);
});

test('the words on waking; and where the game counts as sheltered', () => {
  assert.equal(nightWords({ rough: false, dragged: 0 }, 'cabin boat'), null);
  assert.match(nightWords({ rough: true, dragged: 0 }, 'cabin boat'), /Cabin boat snubbed at her rope and held/);
  const w = nightWords({ rough: true, dragged: 84 }, 'yacht', true);
  assert.match(w, /dragged her anchor/);
  assert.match(w, /84 m downwind of where you left her, brought up short of the shallows/);
  assert.match(w, /heavier anchor on chain/);
  // The bay is sheltered; the open water off it isn't.
  assert.equal(isSheltered(zoneAt(4, -40)), true, 'the bay');
  assert.equal(isSheltered(zoneAt(60, 160)), false, 'open water');
  assert.ok(depthAt(60, 160) > 2, 'deep enough to anchor there');
});
