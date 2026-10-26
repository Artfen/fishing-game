// The year (world/season.js): four seasons of a week each, the day's length and the light, the
// warmth, the fish of each season, the rivers' flow, the leaves, and the harbour's people.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../src/world/season.js');
const { fishById } = await import('../src/fish.js');
const { airTemp } = await import('../src/comfort.js');
const C = await import('../src/world/conditions.js');
const T = await import('../src/world/terrain.js');
const F = await import('../src/townsfolk.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');

const mid = (season) => {
  for (let d = 1; d < 40; d++) if (S.seasonOf(d).name === season && S.seasonOf(d).dayOf === 4) return d * 24 + 12;
  return null;
};

test('a year of four week-long seasons; a new game starts in mid-spring', () => {
  assert.equal(S.seasonOf(1).name, 'spring');
  assert.equal(S.seasonWords(1), 'Mid-spring');
  const names = [];
  for (let d = 1; d <= 28; d++) names.push(S.seasonOf(d).name);
  for (const s of S.SEASONS) assert.equal(names.filter((n) => n === s).length, 7, s);
  assert.deepEqual(S.seasonOf(29), { ...S.seasonOf(1), year: 2 });
  assert.equal(S.seasonWords(mid('summer') / 24 | 0), 'Midsummer');
});

test('long summer days and short winter ones; the sky’s own hour follows the sun', () => {
  const su = S.sunTimes(mid('summer')), wi = S.sunTimes(mid('winter'));
  assert.ok(su.length - wi.length > 6, `${su.length.toFixed(1)} h and ${wi.length.toFixed(1)} h of daylight`);
  assert.ok(su.rise < 5 && su.set > 20.5 && wi.rise > 8 && wi.set < 17.2);
  for (const abs of [mid('summer'), mid('winter'), mid('spring')]) {
    const t = S.sunTimes(abs);
    assert.ok(Math.abs(S.sunHour(t.rise, abs) - 5.6) < 1e-9);
    assert.ok(Math.abs(S.sunHour(t.set, abs) - 19.6) < 1e-9);
    let last = -1;
    for (let h = t.rise; h <= t.set; h += 0.25) {
      const sh = S.sunHour(h, abs);
      assert.ok(sh > last);
      last = sh;
    }
  }
  assert.ok(S.sunHour(7, mid('winter')) < 5.6, 'still dark at seven in midwinter');
});

test('warmer in summer, colder in winter (hardly so in the south)', () => {
  const su = S.seasonWarmth(mid('summer')), wi = S.seasonWarmth(mid('winter'));
  assert.ok(su > 3 && wi < -4);
  const base = { hour: 14, cloud: 0.3 };
  assert.ok(airTemp({ ...base, warmth: su }) - airTemp({ ...base, warmth: wi }) > 7);
  assert.ok(airTemp({ ...base, south: true, warmth: su }) - airTemp({ ...base, south: true, warmth: wi }) < 3);
});

test('each kind of fish has its seasons: mackerel in summer, squid in winter; the south’s barely notice', () => {
  const b = (id, s) => S.seasonBoost(fishById[id], mid(s));
  assert.ok(b('mackerel', 'summer') > 1.1 && b('mackerel', 'winter') < 0.2);
  assert.ok(b('squid', 'winter') > b('squid', 'summer'));
  assert.ok(b('pike', 'autumn') > b('pike', 'summer'));
  assert.ok(b('tuna', 'autumn') > 1 && b('tuna', 'spring') < 0.3);
  assert.equal(S.seasonBoost(fishById.parrotfish, mid('winter')), 1);
  assert.equal(S.seasonBoost(fishById.plaice, null), 1);
});

test('the rivers run fuller in winter and lower in summer; the leaves turn', () => {
  assert.ok(S.riverFlow(mid('winter')) > 1.4 && S.riverFlow(mid('summer')) < 0.8);
  const p = T.STREAM[Math.floor(T.STREAM.length / 2)];
  const was = C.conditions.riverScale;
  try {
    C.conditions.riverScale = 1;
    const a = Math.hypot(...Object.values(C.currentAt(p[0], p[1])));
    C.conditions.riverScale = 1.5;
    const b = Math.hypot(...Object.values(C.currentAt(p[0], p[1])));
    assert.ok(a > 0.05 && Math.abs(b / a - 1.5) < 0.05, `${a.toFixed(2)} then ${b.toFixed(2)} m/s`);
  } finally {
    C.conditions.riverScale = was;
  }
  const au = S.leafTint(mid('autumn')), su = S.leafTint(mid('summer'));
  assert.ok(au[0] > 1.3 && au[2] < 0.6, 'gold and rust');
  assert.ok(Math.abs(su[0] - 1) < 0.1 && Math.abs(su[1] - 1) < 0.1);
});

test('the harbour’s people keep the seasons: no cruising boats, no mackerel trips and no crabbing in winter', () => {
  assert.equal(F.puffinChance('winter'), 0);
  assert.ok(F.puffinChance('summer') > F.puffinChance('autumn'));
  const winter = { storm: 0, rain: 0, wind: 4, season: 'winter' };
  assert.ok(!F.calmSea(winter) && F.calmSea({ ...winter, season: 'summer' }));
  assert.notEqual(F.blockFor('kit', 10, winter, 5).act, 'crab');
  assert.equal(F.blockFor('kit', 10, { ...winter, season: 'summer' }, 5).act, 'crab');
});

test('the catch log keeps the season', () => {
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 3, log: [{ id: 'c1', sp: 'mackerel', size: 30, day: 3, hour: 6, season: 'summer' }, { id: 'c2', sp: 'mackerel', size: 30, day: 3, hour: 7, season: 'monsoon' }] } })).state;
  assert.equal(s.log[0].season, 'summer');
  assert.ok(!('season' in s.log[1]));
});
