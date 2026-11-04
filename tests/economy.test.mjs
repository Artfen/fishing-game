// The harbour's economy (R5), deepened rather than widened: the seasons move prices (plenty in
// season, scarce out of it), a prime fish fetches more by the kilo, a sale comes with a receipt,
// the kitchen remembers its suppliers (and pays a fine fish a bonus), and the chandlery says what's
// worth going after today and how to rig for it. None of it makes fishing a grind.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const M = await import('../src/market.js');
const { fishById, weightOf } = await import('../src/fish.js');
const { setupsFor } = await import('../src/guide.js');

// (The year runs 28 days from mid-spring: summer about days 5-11, winter about days 19-25.)
const at = (day) => day * 24 + 12;

test('the seasons move prices: a glut in season, scarce out of it, and no further than that', () => {
  const mack = fishById.mackerel;
  assert.ok(M.seasonPrice(mack, at(9)) < 1, 'mackerel in summer: plenty');
  assert.ok(M.seasonPrice(mack, at(23)) > 1.1, 'mackerel in winter: scarce');
  assert.ok(M.seasonPrice(fishById.hake, at(23)) < M.seasonPrice(fishById.hake, at(9)), 'hake in the dark months');
  for (let d = 1; d <= 28; d++) {
    for (const sp of [mack, fishById.seabass, fishById.sole, fishById.parrotfish]) {
      const k = M.seasonPrice(sp, at(d));
      assert.ok(k >= 0.85 && k <= 1.2, `${sp.id} day ${d}: ${k}`);
    }
  }
  assert.equal(M.seasonPrice(mack, undefined), 1);
  assert.match(M.seasonWord(0.9), /in season/);
  assert.match(M.seasonWord(1.15), /scarce/);
  assert.equal(M.seasonWord(1), '');
});

test('a prime fish fetches more by the kilo, a small one a little less', () => {
  const sp = fishById.seabass, [lo, hi] = sp.size;
  assert.equal(M.sizePrice(sp, hi), 1.15);
  assert.equal(M.sizePrice(sp, lo), 0.9);
  assert.equal(M.sizePrice(sp, Math.round((lo + hi) / 2)), 1);
  const day = 9, now = at(day);
  const big = M.fishValue({ id: 'seabass', size: hi - 1, at: now - 1 }, { day, now });
  const mid = M.fishValue({ id: 'seabass', size: Math.round((lo + hi) / 2), at: now - 1 }, { day, now });
  assert.equal(big.prime, true);
  assert.equal(mid.prime, false);
  assert.ok(big.each > mid.each);
  // (Still capped: no one fish breaks the bank.)
  assert.ok(M.fishValue({ id: 'turbot', size: 70, at: now }, { day, now }).price <= M.MAX_PRICE);
});

test('a sale comes with a receipt: weight, price by the kilo and why, and the total', () => {
  const day = 9, now = at(day);
  const f = { id: 'seabass', size: 60, at: now - 30 };
  const v = M.fishValue(f, { day, now });
  const L = M.receiptLine(f, v);
  assert.equal(L.name, fishById.seabass.name);
  assert.equal(L.size, 60);
  assert.equal(L.price, v.price);
  assert.ok(Math.abs(L.kg - weightOf(fishById.seabass, 60)) < 0.01);
  assert.ok(L.why.some((w) => /fresh/.test(w)), 'an older fish says how fresh it is');
});

test('the kitchen remembers its suppliers, and pays more for a fine fish', () => {
  assert.equal(M.standingOf(0).tier, 0);
  assert.equal(M.standingOf(2).tier, 0);
  assert.equal(M.standingOf(3).tier, 1);
  assert.equal(M.standingOf(8).tier, 2);
  assert.equal(M.standingOf(80).tier, 2);
  assert.equal(M.standingOf(0).next, 3);
  assert.equal(M.standingOf(9).next, null);
  const o = { id: 'seabass', min: 40, reward: 20 };
  const just = M.orderPay(o, { size: 41 }, 0), fine = M.orderPay(o, { size: 75 }, 0), regular = M.orderPay(o, { size: 41 }, 3), own = M.orderPay(o, { size: 75 }, 9);
  assert.deepEqual([just.pay, just.fine], [20, false]);
  assert.deepEqual([fine.pay, fine.fine], [25, true]);
  assert.equal(regular.pay, 22);
  assert.equal(own.pay, 30);
  // (Never runaway: a ceiling on any one order.)
  assert.ok(M.orderPay({ id: 'seabass', min: 40, reward: M.MAX_REWARD }, { size: 80 }, 99).pay <= Math.round(M.MAX_REWARD * 1.3));
});

test('worth going after: a fish the market or the kitchen wants, in season, with a rig that works', () => {
  let found = 0;
  for (let day = 1; day <= 28; day++) {
    const W = M.worthGoingAfter(day, at(day));
    if (!W) continue;
    found++;
    const D = M.demandFor(day), O = M.ordersFor(day);
    assert.ok(D.wanted.includes(W.id) || O.some((o) => o.id === W.id), `day ${day}: ${W.id} is wanted`);
    assert.ok(W.boost >= 0.6, 'and in season');
    assert.ok(setupsFor(fishById[W.id])[0], `and the guide has a rig for ${W.id}`);
  }
  assert.ok(found >= 24, `a tip most days (${found} of 28)`);
});
