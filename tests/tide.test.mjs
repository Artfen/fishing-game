// The tide (world/tide.js): high water twice a day and about fifty minutes later each day, big
// springs and small neaps; the sea rising and falling with it; the tidal streams running out on
// the ebb, in on the flood, slack at the turn; the sea's fish feeding on a running tide; and the
// tide in the catch log. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Tide = await import('../src/world/tide.js');
const C = await import('../src/world/conditions.js');
const T = await import('../src/world/terrain.js');
const { fishById } = await import('../src/fish.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const { Journal } = await import('../src/journal.js').catch(() => ({}));

test('high water twice a day, about fifty minutes later each day; springs bigger than neaps', () => {
  const t = Tide.turns(10 * 24, 6);
  for (let i = 1; i < t.length; i++) assert.notEqual(t[i].kind, t[i - 1].kind, 'high, low, high, low');
  const highs = t.filter((x) => x.kind === 'high');
  assert.ok(Math.abs(highs[1].at - highs[0].at - Tide.TIDE_HOURS) < 1e-9);
  const tomorrow = Tide.turns(11 * 24, 6).filter((x) => x.kind === 'high')[0].at - 24;
  const later = (tomorrow - highs[0].at + Tide.TIDE_HOURS * 4) % Tide.TIDE_HOURS;
  assert.ok(later > 0.6 && later < 1.0, `${(later * 60).toFixed(0)} minutes later each day`);
  // Springs and neaps.
  let big = 0, small = 9;
  for (let d = 0; d < 16; d++) {
    let hi = -9, lo = 9;
    for (let h = 0; h < 24; h += 0.1) {
      const L = Tide.tideAt(d * 24 + h).level;
      hi = Math.max(hi, L);
      lo = Math.min(lo, L);
    }
    big = Math.max(big, hi - lo);
    small = Math.min(small, hi - lo);
  }
  assert.ok(big > 0.9 && big <= Tide.RANGE.springs + 1e-6, `springs ${big.toFixed(2)} m`);
  assert.ok(small < 0.45, `neaps ${small.toFixed(2)} m`);
  assert.match(Tide.dayTides(12), /^High water .+ and .+; low water .+ and .+ \(/);
});

test('rising is the flood, the streams running in; falling the ebb, running out; slack at the turns', () => {
  const hw = Tide.turns(5 * 24, 2).find((x) => x.kind === 'high').at;
  const before = Tide.tideAt(hw - 3), after = Tide.tideAt(hw + 3), at = Tide.tideAt(hw);
  assert.ok(before.rising && before.flow < -0.3 && before.phase === 'flood');
  assert.ok(!after.rising && after.flow > 0.3 && after.phase === 'ebb');
  assert.equal(at.phase, 'high');
  assert.ok(Math.abs(at.flow) < 0.05);
  assert.match(Tide.tideWords(hw - 3), /^flooding · high water/);
});

test('the streams turn with the tide (the race in Calf Sound runs both ways), the baked field and the exact one agreeing; the sea rises', () => {
  const S = T.CALF_SOUND, x = (S.x0 + S.x1) / 2, z = (S.z0 + S.z1) / 2;
  const was = { ...C.TIDE };
  try {
    C.TIDE.flow = 1;
    const ebb = { ...C.currentAt(x, z) }, ebbF = { ...C.currentFast(x, z) };
    C.TIDE.flow = -1;
    const flood = { ...C.currentAt(x, z) }, floodF = { ...C.currentFast(x, z) };
    C.TIDE.flow = 0;
    const slack = C.currentAt(x, z);
    assert.ok(ebb.x * flood.x + ebb.z * flood.z < 0, 'the flood runs the other way');
    assert.ok(Math.hypot(slack.x, slack.z) < Math.hypot(ebb.x, ebb.z) * 0.4, 'slack water');
    assert.ok(Math.hypot(ebbF.x - ebb.x, ebbF.z - ebb.z) < 0.15 && Math.hypot(floodF.x - flood.x, floodF.z - flood.z) < 0.15);
    // The sea's level, up and down with the tide (the lakes keep their own).
    C.TIDE.level = 0;
    const sea0 = C.waveHeight(60, 140, 0);
    C.TIDE.level = 0.4;
    assert.ok(Math.abs(C.waveHeight(60, 140, 0) - sea0 - 0.4) < 1e-6);
    const lake = { x: T.LAKE.x, z: T.LAKE.z };
    C.TIDE.level = 0;
    const l0 = C.waveHeight(lake.x, lake.z, 0);
    C.TIDE.level = 0.4;
    assert.ok(Math.abs(C.waveHeight(lake.x, lake.z, 0) - l0) < 0.05, 'not on the lake');
  } finally {
    Object.assign(C.TIDE, was);
  }
});

test('the sea’s fish feed best on a running tide (bass on the flood); the lake’s don’t care', () => {
  const run = { flow: -0.8, phase: 'flood' }, slack = { flow: 0.02, phase: 'high' }, ebb = { flow: 0.8, phase: 'ebb' };
  assert.ok(Tide.tideBoost(fishById.pollack, ebb) > Tide.tideBoost(fishById.pollack, slack));
  assert.ok(Tide.tideBoost(fishById.seabass, run) > Tide.tideBoost(fishById.seabass, ebb), 'bass on the flood');
  assert.equal(Tide.tideBoost(fishById.perch, run), 1);
  assert.equal(Tide.tideBoost(fishById.seabass, undefined), 1);
});

test('the catch log keeps the tide each fish was caught on', () => {
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 3, log: [{ id: 'c1', sp: 'seabass', size: 50, day: 3, hour: 6, tide: 'flood', water: 'salt' }, { id: 'c2', sp: 'seabass', size: 40, day: 3, hour: 7, tide: 'sideways' }] } })).state;
  assert.equal(s.log[0].tide, 'flood');
  assert.ok(!('tide' in s.log[1]));
  if (Journal?.conditionsText) assert.match(Journal.conditionsText({ ...s.log[0], kind: 'float', depth: 1, bottom: 3 }), /on the flood/);
});
