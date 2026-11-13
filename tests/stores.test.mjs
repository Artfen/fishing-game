// Stores aboard (F1a, see stores.js): food and water for days away, in her lockers and in stores
// crates; drawn on by the galley, waking aboard and the crossing; stocked for a price; kept through
// a save; and the crossing card's words. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { GALLEY, CRATE_DAYS, MEAL, FILL, WATCH, DAY_PRICE, newStores, cleanStores, storesAboard, draw, stockUp, daysWords, storesFor } = await import('../src/stores.js');
const { cleanCargo, weightOf, buy, CARGO } = await import('../src/cargo.js');
const { crossHours } = await import('../src/crossing.js');

const crate = (uid, kind, days) => ({ uid, id: 'stores', at: kind ? `boat:${kind}` : 'ashore', x: 0, z: 0, secured: true, full: true, ...(days != null ? { days } : {}) });
const world = (stores = newStores(), items = []) => ({ stores, cargo: { items } });

test('her lockers: the cabin boat, the yacht and the sailing boat carry stores; an open boat only in a crate', () => {
  assert.deepEqual(GALLEY, { cabin: 3, cruiser: 6, sail: 3 });
  const S = world();
  assert.deepEqual(storesAboard(S, 'cruiser'), { galley: 6, crates: 0, days: 6, most: 6 });
  assert.equal(storesAboard(S, 'skiff').most, 0, 'nothing in the skiff');
  S.cargo.items.push(crate('c1', 'skiff'));
  assert.deepEqual(storesAboard(S, 'skiff'), { galley: 0, crates: 1, days: CRATE_DAYS, most: CRATE_DAYS }, 'a crate in her: three days');
  S.cargo.items.push(crate('c2', 'sail', 1.5), crate('c3', null));
  assert.deepEqual(storesAboard(S, 'sail'), { galley: 3, crates: 1, days: 4.5, most: 6 }, 'a part-eaten crate keeps what’s left; one ashore isn’t aboard');
});

test('drawn on: the galley first, then the crates; nothing taken if there isn’t enough, unless it’s the last of it', () => {
  const S = world({ ...newStores(), sail: 0.5 }, [crate('c1', 'sail', 1)]);
  assert.equal(draw(S, 'sail', MEAL), MEAL);
  assert.ok(Math.abs(S.stores.sail - (0.5 - MEAL)) < 0.01, 'out of the lockers first');
  assert.equal(draw(S, 'sail', 0.5), 0.5);
  assert.equal(S.stores.sail, 0, 'the lockers empty…');
  assert.ok(Math.abs(S.cargo.items[0].days - (1.5 - MEAL - 0.5)) < 0.02, '…and the rest from the crate');
  const left = storesAboard(S, 'sail').days;
  assert.equal(draw(S, 'sail', 2), 0, 'not enough for a whole two days: nothing taken');
  assert.equal(storesAboard(S, 'sail').days, left);
  assert.ok(Math.abs(draw(S, 'sail', 2, true) - left) < 0.01, 'the crossing takes what’s left');
  assert.equal(storesAboard(S, 'sail').days, 0);
  assert.equal(draw(S, 'skiff', FILL), 0, 'nothing in a boat with none');
  // Over a crossing in the sailing boat, fully stocked: a watch every six hours, all the way.
  const C = world();
  let fed = 0;
  for (let h = 6; h <= crossHours('sail'); h += 6) if (draw(C, 'sail', WATCH, true) >= WATCH - 1e-6) fed++;
  assert.equal(fed, Math.floor(crossHours('sail') / 6), 'fed at every watch');
  assert.ok(storesAboard(C, 'sail').days > 1, 'and over a day left at the far side');
});

test('stocked: the lockers and the crates aboard filled, for a price by the day; nothing to pay when she’s full', () => {
  const S = world({ ...newStores(), cruiser: 1 }, [crate('c1', 'cruiser', 0)]);
  const q = stockUp(S, 'cruiser', 'gentle', true);
  assert.deepEqual(q, { days: 5 + CRATE_DAYS, price: (5 + CRATE_DAYS) * DAY_PRICE.gentle });
  assert.equal(storesAboard(S, 'cruiser').days, 1, 'a quote takes nothing aboard');
  assert.equal(stockUp(S, 'cruiser', 'authentic', true).price, (5 + CRATE_DAYS) * DAY_PRICE.authentic, 'dearer on Authentic');
  stockUp(S, 'cruiser', 'gentle');
  assert.equal(storesAboard(S, 'cruiser').days, 6 + CRATE_DAYS);
  assert.deepEqual(stockUp(S, 'cruiser', 'gentle', true), { days: 0, price: 0 });
});

test('the words, and the crossing card: enough for the passage with half a day to spare, or short', () => {
  assert.equal(daysWords(0), 'nothing');
  assert.equal(daysWords(MEAL), '1 meal');
  assert.equal(daysWords(0.6), '2 meals');
  assert.equal(daysWords(1), '1 day');
  assert.equal(daysWords(2.4), '2½ days');
  const full = storesFor(world(), 'sail', crossHours('sail'), 'sailing boat');
  assert.equal(full.ok, true, 'the sailing boat, stocked, has enough to cross');
  assert.match(full.text, /food and water for 3 days aboard, and the passage takes about 1½ days/);
  const low = storesFor(world({ ...newStores(), sail: 1 }), 'sail', crossHours('sail'), 'sailing boat');
  assert.equal(low.ok, false);
  assert.match(low.text, /Short: stock her up/);
  assert.equal(storesFor(world(), 'cruiser', crossHours('cruiser'), 'yacht').ok, true);
});

test('kept through a save: her lockers, and what’s left in each crate; an older save comes stocked', () => {
  assert.deepEqual(cleanStores(undefined), newStores(), 'an older save: full');
  assert.deepEqual(cleanStores({ cabin: 1.25, cruiser: 'lots', sail: -4, skiff: 9 }), { cabin: 1.25, cruiser: 6, sail: 0 }, 'junk dropped, clamped, no lockers for the skiff');
  const c = cleanCargo({ items: [crate('c1', 'skiff', 1.5), crate('c2', 'cabin', 'x'), crate('c3', null, 99)] });
  assert.deepEqual(c.items.map((it) => it.days), [1.5, CRATE_DAYS, CRATE_DAYS], 'a crate keeps what’s left in it; junk reads as full');
  // A crate weighs what's in it, and comes full from the chandlery.
  const C = CARGO.stores;
  assert.equal(weightOf({ id: 'stores', days: CRATE_DAYS }), C.kg);
  assert.equal(weightOf({ id: 'stores', days: 0 }), C.empty);
  assert.ok(Math.abs(weightOf({ id: 'stores', days: 1.5 }) - (C.empty + C.kg) / 2) < 0.01);
  const bought = buy(cleanCargo(null), 'stores');
  assert.equal(bought.item.days, CRATE_DAYS);
});
