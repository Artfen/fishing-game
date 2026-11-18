// A night at anchor (F2a, see anchorage.js): a gale that blows while you sleep aboard, against
// where she lies (sheltered or open) and how she's held (tied up, an ordinary anchor, the heavier
// one); dragging downwind, short of the shallows; and the words on waking. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { galeHoursIn, nightAtAnchor, dragTo, nightWords, DRAG_PER_H, DRAG_MOST } = await import('../src/anchorage.js');
const { anchorBottom, spotDie, ROCK_HOOKS, WEED_THROUGH } = await import('../src/anchoring.js');
// (A spot where the anchor does, or doesn't, get through the weed or hook on the rock.)
const spot = (kind, yes) => {
  for (let x = 0; x < 400; x++) {
    const u = spotDie(x, 7, kind === 'rock' ? 1 : 2);
    if ((u < (kind === 'rock' ? ROCK_HOOKS : WEED_THROUGH)) === yes) return [x, 7];
  }
};
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
  // (B6) An ordinary anchor dug into sand at a good scope drags DRAG_PER_H an hour in the open, as
  // before.
  const open = nightAtAnchor({ galeHours: 6 });
  assert.equal(open.dragged, DRAG_PER_H * 6);
  assert.equal(open.woke, true);
  assert.equal(open.why, 'open');
  // (B6) Her own rode reckoned in, 8 m of water and 40 m of it out (five to one), a tonne of boat:
  // the ordinary anchor about the same; the heavier one on its chain barely moves.
  const ord = nightAtAnchor({ galeHours: 6, depth: 8, out: 40, m: 1000 });
  const heavy = nightAtAnchor({ galeHours: 6, depth: 8, out: 40, m: 1000, hold: 2, rode: 'chain' });
  assert.ok(Math.abs(ord.dragged - open.dragged) < 10, `${ord.dragged} m`);
  assert.ok(heavy.dragged < ord.dragged / 5, `the heavier: ${heavy.dragged} m`);
  assert.equal(nightAtAnchor({ galeHours: 30 }).dragged, DRAG_MOST, 'never further than this');
});

test('(B6) the night reckoned as the live anchor is: a poor bottom drags even in shelter, and so does a short scope in deep water', () => {
  const at = { galeHours: 6, m: 1000, depth: 8, out: 40, sheltered: true };
  assert.equal(nightAtAnchor(at).dragged, 0, 'dug into sand in a cove: she holds');
  // In weed (not through it to the sand) or skidding on rock, she drags even in a cove; in soft
  // mud a little.
  const weed = nightAtAnchor({ ...at, bed: anchorBottom({ kind: 'weed', under: 'sand' }, ...spot('weed', false)) });
  const rock = nightAtAnchor({ ...at, bed: anchorBottom({ kind: 'rock' }, ...spot('rock', false)) });
  const mud = nightAtAnchor({ ...at, bed: anchorBottom({ kind: 'mud' }) });
  assert.ok(weed.dragged > 50 && weed.why === 'bottom' && weed.kind === 'weed', JSON.stringify(weed));
  assert.ok(rock.dragged > 50 && rock.why === 'bottom', JSON.stringify(rock));
  assert.ok(mud.dragged > 0 && mud.dragged < weed.dragged && mud.why === 'bottom', JSON.stringify(mud));
  // Through the weed to the sand (a little weed still in its flukes), she barely moves and you sleep
  // through it; hooked on the rock, she holds.
  const through = nightAtAnchor({ ...at, bed: anchorBottom({ kind: 'weed', under: 'sand' }, ...spot('weed', true)) });
  assert.ok(through.dragged < 5 && !through.woke, `through the weed: ${through.dragged} m`);
  assert.equal(nightAtAnchor({ ...at, bed: anchorBottom({ kind: 'rock' }, ...spot('rock', true)) }).dragged, 0, 'hooked on the rock');
  // In 20 m of water there's only 50 m of rope (two and a half to one): pulled up off the bottom,
  // it drags even in shelter, and further in the open; the heavier anchor on its chain less.
  const deep = { ...at, depth: 20, out: 50 };
  const shelterDeep = nightAtAnchor(deep), openDeep = nightAtAnchor({ ...deep, sheltered: false });
  const heavyDeep = nightAtAnchor({ ...deep, sheltered: false, hold: 2, rode: 'chain' });
  assert.ok(shelterDeep.dragged > 0 && shelterDeep.why === 'scope', JSON.stringify(shelterDeep));
  assert.ok(openDeep.dragged > shelterDeep.dragged && openDeep.why === 'scope');
  assert.ok(heavyDeep.dragged < openDeep.dragged * 0.6, `${heavyDeep.dragged} against ${openDeep.dragged}`);
  // The words say why.
  assert.match(nightWords(weed, 'skiff'), /in weed, poor holding for an anchor.*Sand holds far better \(the fish finder reads the bottom\)/);
  assert.match(nightWords(mud, 'skiff'), /soft mud, that holds less than sand/);
  assert.match(nightWords(shelterDeep, 'skiff'), /in 20 m of water there wasn't rope enough to give it a good scope.*Shallower water/);
  assert.doesNotMatch(nightWords(shelterDeep, 'skiff'), /out here in the open/);
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
