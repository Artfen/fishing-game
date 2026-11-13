// Regional trade (G2): each quay pays well for what it can't get for itself (the home coast's
// prized fish at Bar El Muelle, the island's at Willowhaven), so a fish box of iced fish is worth
// carrying over the sea; and the island's fuel, shipped in, is dearer. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../src/market.js');
const { fishById } = await import('../src/fish.js');
const { fuelPrice, fuelQuote, ISLAND_FUEL_K, ECONOMY_IDS } = await import('../src/economy.js');

test('each quay buys what the other has, and pays well for it: not in the day’s dice, and said on the receipt', () => {
  // Every import is something the quay couldn't buy before (none of its own waters' fish), and a fish.
  for (const [place, ids] of Object.entries(M.IMPORTS)) {
    for (const id of ids) {
      const sp = fishById[id];
      assert.ok(sp, id);
      assert.ok(M.imported(sp, place), `${id} is brought to ${place} from over the sea`);
      assert.ok(M.buyers[place](sp), `${place} buys ${id}`);
    }
  }
  // (And nothing the quay already had becomes an import.)
  assert.equal(M.imported(fishById.mackerel, 'haven'), false);
  // The same fish, just caught, on a day the home quay neither wants it nor has plenty: dear at Bar El Muelle.
  const day = Array.from({ length: 60 }, (_, i) => i + 1).find((d) => ![...M.demandFor(d, 'haven').wanted, ...M.demandFor(d, 'haven').plenty].includes('sole'));
  const sole = { id: 'sole', size: 40, at: 100 };
  const home = M.fishValue(sole, { day, now: 100, place: 'haven' }), south = M.fishValue(sole, { day, now: 100, place: 'muelle' });
  assert.equal(home.imported, false);
  assert.equal(south.imported, true);
  assert.ok(Math.abs(south.each / (home.each / home.season) - M.IMPORT_K) < 0.02, `£${home.each}/kg at home, £${south.each}/kg at Bar El Muelle`);
  assert.deepEqual(M.receiptLine(sole, south).why.slice(0, 1), ['brought over the sea: dear here']);
  // Not in the day's dice: never 'wanted' or 'plenty' at the quay it's brought to.
  for (let d = 1; d <= 60; d++) {
    const D = M.demandFor(d, 'muelle');
    assert.ok(![...D.wanted, ...D.plenty].some((id) => M.IMPORTS.muelle.includes(id)), `day ${d}`);
  }
  // A wahoo at Willowhaven, two days old: worth less than fresh (ice it in the fish box).
  const wahoo = { id: 'wahoo', size: 120, at: 100 };
  const fresh = M.fishValue(wahoo, { day, now: 100, place: 'haven' }), old = M.fishValue(wahoo, { day, now: 148, place: 'haven' });
  assert.ok(fresh.imported && old.price < fresh.price, `£${fresh.price} fresh, £${old.price} two days old`);
});

test('the island’s fuel is dearer: shipped in', () => {
  for (const profile of ECONOMY_IDS) {
    const home = fuelPrice(profile), island = fuelPrice(profile, 'brasa');
    assert.ok(Math.abs(island - home * ISLAND_FUEL_K) < 0.01, `${profile}: £${home} at home, £${island} on the island`);
  }
  const q = fuelQuote(20, 'gentle', 1000, 'brasa');
  assert.ok(Math.abs(q.price - 20 * fuelPrice('gentle', 'brasa')) < 0.01);
  assert.equal(fuelQuote(20, 'gentle', 1000).price < q.price, true, 'the same at home costs less');
});
