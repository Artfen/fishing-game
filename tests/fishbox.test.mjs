// The fish box (F2b, see fishbox.js): which boats have one, three days of ice in it, your catch
// on that ice while you're aboard her (and not when you're ashore, or in a boat without one), and
// kept through a save. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { FISHBOX, BOX_HOURS, BOX_PRICE, hasBox, boxIceUntil, iceBox, iceUntilHere, boxHoursLeft, boxWords, cleanFishbox } = await import('../src/fishbox.js');
const { chill, ICE } = await import('../src/shop.js');
const { freshness } = await import('../src/market.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');

test('the boats built for days away have a box for the catch; the small boats don’t', () => {
  for (const k of ['cabin', 'cruiser', 'sail', 'console', 'rib']) assert.equal(hasBox(k), true, k);
  for (const k of ['row', 'skiff', 'kayak', 'bass', 'jet', 'toString']) assert.equal(hasBox(k), false, k);
  assert.equal(FISHBOX.cruiser, 'fish hold');
  assert.ok(BOX_HOURS === 3 * ICE.hours, 'three times a bag of ice in your creel');
  assert.ok(BOX_PRICE > ICE.price);
});

test('three days of ice in her box, told in words as it goes', () => {
  const S = {};
  assert.equal(boxWords(S, 'cabin', 10), 'no ice in her fish box');
  assert.equal(iceBox(S, 'skiff', 10), false, 'no box to ice');
  assert.equal(iceBox(S, 'cabin', 10), true);
  assert.equal(boxIceUntil(S, 'cabin'), 10 + BOX_HOURS);
  assert.equal(boxWords(S, 'cabin', 10), 'her fish box iced for 3 days more');
  assert.equal(boxWords(S, 'cabin', 60), 'her fish box iced for a day more');
  assert.equal(boxWords(S, 'cabin', 81), 'her fish box iced for 1 hour more');
  assert.equal(boxWords(S, 'cabin', 83), 'no ice in her fish box');
  assert.equal(boxHoursLeft(S, 'cabin', 70), 12);
  assert.equal(boxHoursLeft(S, 'sail', 70), 0, 'each boat her own');
});

test('aboard her, the catch is on her ice: fresh after two and a half days, where a creel’s day of ice wouldn’t do', () => {
  const caught = () => ({ keep: [{ id: 'bass', size: 50, at: 0 }], shop: { creel: 0, iceUntil: ICE.hours, baitDay: 0, wear: {} } });
  // In the creel only: a day on ice, then a day and a half losing freshness.
  const A = caught();
  chill(A, 0, 60, iceUntilHere(A, A.shop.iceUntil, null));
  const inCreel = freshness(A.keep[0].at, 60);
  // Aboard the cabin boat with her box iced.
  const B = caught();
  iceBox(B, 'cabin', 0);
  chill(B, 0, 60, iceUntilHere(B, B.shop.iceUntil, 'cabin'));
  assert.equal(freshness(B.keep[0].at, 60), 1, 'as fresh as when it came aboard');
  assert.ok(inCreel < 0.75, `in the creel alone: ${inCreel}`);
  // Aboard a boat without a box, or ashore, her ice is nothing to them.
  const C = caught();
  iceBox(C, 'cabin', 0);
  assert.equal(iceUntilHere(C, C.shop.iceUntil, 'skiff'), ICE.hours);
  assert.equal(iceUntilHere(C, C.shop.iceUntil, null), ICE.hours);
  // chill with no ice given is the creel's, as before.
  const D = caught();
  chill(D, 0, 60);
  assert.equal(D.keep[0].at, A.keep[0].at);
});

test('kept through a save; an older save’s boxes are empty', () => {
  assert.deepEqual(cleanFishbox(undefined), {});
  assert.deepEqual(cleanFishbox({ cabin: 300, skiff: 50, rib: NaN, sail: -4, console: '80', cruiser: 1e9 }), { cabin: 300, cruiser: 1e7 });
  assert.deepEqual(cleanFishbox([1, 2]), {});
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data });
  assert.deepEqual(parseSave(wrap({ day: 3, fishbox: { cabin: 130 } })).state.fishbox, { cabin: 130 });
  assert.deepEqual(parseSave(wrap({ day: 3 })).state.fishbox, {});
});
