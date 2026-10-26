// The chandlery's counter (shop.js): bigger creels, ice that stops a catch's freshness clock, a
// cool-lined creel that slows it, fresh bait that fish find from further off, and line that wears
// in hard fights (a little weaker, never more than a fifth) until it's respooled. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const S = await import('../src/shop.js');
const { freshness } = await import('../src/market.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const { RODS } = await import('../src/tackle.js');
const { newFight } = await import('../src/fight.js');
const { fishById, weightOf } = await import('../src/fish.js');

const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 3, ...data } });

test('creels hold fish by weight: thirty-odd mackerel, or one big fish on its own; 15, 25 and 40 kg', () => {
  assert.deepEqual(S.CREELS.map((c) => c.kg), [15, 25, 40]);
  assert.equal(S.creelKg({}), 15);
  assert.ok(S.CREELS[2].price > S.CREELS[1].price);
  // Mackerel after mackerel, until it's full.
  const state = { keep: [] };
  let n = 0;
  while (S.creelFits(state, weightOf(fishById.mackerel, 32))) {
    state.keep.push({ id: 'mackerel', size: 32 });
    n++;
  }
  assert.ok(n >= 30 && n < S.CREEL_MAX, `${n} mackerel`);
  // A yellowfin on its own fills it, however heavy; nothing more after.
  const tuna = { keep: [] };
  const kg = weightOf(fishById.yellowfin, 120);
  assert.ok(kg > 15);
  assert.ok(S.creelFits(tuna, kg), 'an empty creel takes one big fish');
  tuna.keep.push({ id: 'yellowfin', size: 120 });
  assert.ok(!S.creelFits(tuna, weightOf(fishById.mackerel, 30)));
  // The list shows them kind by kind.
  const g = S.creelGroups([...state.keep.slice(0, 3), { id: 'seabass', size: 50 }, { id: 'mackerel', size: 36 }]);
  assert.equal(g.length, 2);
  assert.equal(g[0].n, 4);
  assert.equal(g[0].first, 4, 'the biggest first');
  assert.equal(S.groupWords('Atlantic Mackerel', g[0]), 'Atlantic Mackerel ×4, 32–36 cm');
  // Saves keep them all (well, up to a very generous number), and the creel you bought.
  const many = Array.from({ length: 30 }, (_, i) => ({ id: 'mackerel', size: 30 + (i % 5), logId: `c${i}` }));
  const big = parseSave(wrap({ keep: many, shop: { creel: 2, iceUntil: 90, baitDay: 3, wear: { spin: 0.7, nosuchrod: 0.5, float: 'x' } } })).state;
  assert.equal(big.keep.length, 30);
  assert.equal(S.creelKg(big), 40);
  assert.deepEqual(big.shop, { creel: 2, iceUntil: 90, baitDay: 3, wear: { spin: 0.7 } });
  assert.deepEqual(parseSave(wrap({})).state.shop, S.newShop());
});

test('ice stops the freshness clock for a day; a cool-lined creel slows it; cooked fish and the future are left alone', () => {
  const state = { day: 2, keep: [{ id: 'seabass', size: 40, at: 48 }, { id: 'sole', size: 30, at: 50, cooked: true }], shop: { ...S.newShop(), iceUntil: 48 + 24 } };
  // Thirty hours on: the first twenty-four on ice.
  S.chill(state, 48, 78);
  assert.equal(state.keep[0].at, 72);
  assert.equal(freshness(state.keep[0].at, 78), 1, 'six hours old, as far as the market is concerned');
  assert.equal(state.keep[1].at, 50);
  // Without ice, an ordinary creel: the clock runs.
  const plain = { day: 2, keep: [{ id: 'seabass', size: 40, at: 48 }], shop: S.newShop() };
  S.chill(plain, 48, 78);
  assert.equal(plain.keep[0].at, 48);
  // The cool-lined creel: half speed.
  const cool = { day: 2, keep: [{ id: 'seabass', size: 40, at: 48 }], shop: { ...S.newShop(), creel: 2 } };
  S.chill(cool, 48, 68);
  assert.equal(cool.keep[0].at, 58);
  // A fish never comes out fresher than when it was caught.
  const iced = { day: 2, keep: [{ id: 'seabass', size: 40, at: 60 }], shop: { ...S.newShop(), iceUntil: 200 } };
  S.chill(iced, 50, 61);
  assert.ok(iced.keep[0].at <= 61);
  assert.ok(S.onIce(iced, 100) && !S.onIce(iced, 201));
});

test('line wears with long, hard fights, at most a fifth weaker; fresh line puts it right', () => {
  assert.ok(S.wearFrom({ time: 10, peak: 0.4 }) < S.wearFrom({ time: 60, peak: 0.4 }));
  assert.ok(S.wearFrom({ time: 60, peak: 0.3 }) < S.wearFrom({ time: 60, peak: 0.95 }));
  assert.ok(S.wearFrom({ time: 600, peak: 1 }) <= 0.45, 'even a marathon only frays it so much');
  assert.ok(S.wearFrom({ time: 8, peak: 0.5 }) < 0.05, 'a little fish hardly at all');
  const state = { shop: S.newShop() };
  for (let i = 0; i < 6; i++) S.addWear(state, 'biggame', S.wearFrom({ time: 160, peak: 0.9 }));
  assert.equal(S.wearOf(state, 'biggame'), 1);
  assert.equal(S.wearWords(1), 'frayed');
  const line = RODS.spin.lines[0];
  const worn = S.wornLine(line, 1);
  assert.ok(Math.abs(worn.kg / line.kg - (1 - S.WEAR_MAX_LOSS)) < 1e-9);
  assert.equal(S.wornLine(line, 0), line);
  assert.equal(line.kg, RODS.spin.lines[0].kg, 'the rod’s own line is untouched');
  // In a fight, the same fish pulls harder against a worn line.
  const diff = { force: 1, tire: 1, strain: 1, teeth: 1, snag: 1, light: 0.8 };
  const fresh = newFight(fishById.seabass, 60, { line, power: 1, flex: 1, drag: 1 }, diff, false, () => 0.5);
  const tired = newFight(fishById.seabass, 60, { line: worn, power: 1, flex: 1, drag: 1 }, diff, false, () => 0.5);
  assert.ok(Math.abs(tired.ratio / fresh.ratio - 1 / (1 - S.WEAR_MAX_LOSS)) < 1e-9);
  assert.ok(S.respoolPrice(RODS.float.lines[0]) < S.respoolPrice(RODS.biggame.lines[0]));
});

test('fresh bait: a fish finds a natural bait from further off, and a lure no further', async () => {
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const { createHabitat } = await import('../src/world/habitat.js');
  const eco = new Ecosystem(createHabitat());
  const a = eco.agents.find((x) => x.sp.id === 'flounder' && x.active !== false) || eco.agents.find((x) => x.sp.id === 'flounder');
  assert.ok(a, 'a flounder to try it on');
  const real = Math.random;
  Math.random = () => 0;
  eco.appeal = () => 1;
  eco.activity[a.sp.id] = 1;
  let engaged = false;
  eco.engage = () => { engaged = true; };
  const reach = (boost, natural = true) => {
    let far = 0;
    for (let d = 0.25; d < 40; d += 0.25) {
      Object.assign(eco.bait, { active: true, owner: null, held: false, kind: natural ? 'bottom' : 'lure', natural, nearBottom: true, boost, towed: false, fresh: 0, x: a.x + d, y: a.y, z: a.z });
      a.wary = 0;
      engaged = false;
      eco.considerBait(a);
      if (engaged) far = d;
    }
    return far;
  };
  try {
    const plain = reach(1), boosted = reach(S.BAIT.boost);
    assert.ok(plain > 0, 'it notices a bait nearby');
    assert.ok(Math.abs(boosted / plain - S.BAIT.boost) < 0.12, `${plain} m, then ${boosted} m`);
    assert.equal(reach(S.BAIT.boost, false), reach(1, false), 'a lure isn’t bait');
  } finally {
    Math.random = real;
  }
});
