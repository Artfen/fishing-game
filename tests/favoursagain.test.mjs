// G9c of docs/PROGRESSION.md (item 12: "favours run out"): favours that come round again
// (src/requests.js). Once someone's first favours are done, one of theirs is asked again every few
// days: a bream for Mags's customer at the Grange, Hettie's tackle order, two pollack for Ruth's pie,
// another of Dougie's buoys, Hettie's bet, dolphins for Kit's book, a wrasse for Ian's talk, the
// tide tables up to Bryn, caballas for Paco, the loggerhead for Chano, the spotted dolphins for
// Nayra, bogues for Agustín's racks, Bryn's samphire down to Ruth, and Fen's counts to Wenna.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const Q = await import('../src/requests.js');
const { FOLK } = await import('../src/townsfolk.js');
const { fishById } = await import('../src/fish.js');
const { SEA_LIFE_KINDS, parseSave, SAVE_VERSION } = await import('../src/save.js');

const AGAIN = Q.REQUESTS.filter((R) => R.again);
const firstOf = (who) => Q.REQUESTS.filter((R) => R.who === who && !R.again);
// Everyone's first favours done (on `day`), as if you'd worked through them.
const allFirstDone = (day) => {
  const F = Q.newFavours();
  for (const R of Q.REQUESTS) if (!R.again) F.done[R.id] = day;
  return F;
};

test('one favour of everyone’s comes round again: after their first ones, every few days, for money or a meal', () => {
  for (const who of Object.keys(FOLK)) {
    const mine = Q.REQUESTS.filter((R) => R.who === who);
    const again = mine.filter((R) => R.again);
    assert.equal(again.length, 1, `${who}: one that comes round again`);
    assert.equal(mine[mine.length - 1], again[0], `${who}: asked after their first ones`);
    assert.ok(firstOf(who).length >= 1, `${who}: something first`);
  }
  for (const R of AGAIN) {
    assert.ok(R.again >= 3 && R.again <= 7, `${R.id}: every ${R.again} days`);
    // (Nothing that can only be given once: no marks on the map, no keepsakes.)
    assert.ok(!R.reward.pin && !R.reward.keepsake, `${R.id}: money or a meal`);
    assert.ok(R.reward.money > 0 || R.reward.dish?.fill > 0, R.id);
    // (Words for any week: nothing that only happens once.)
    assert.doesNotMatch(R.ask, /eightieth|wedding|record|1984|first time/i, R.id);
    if (R.kind === 'bring') assert.ok(fishById[R.species]?.meal && (!R.min || R.min < fishById[R.species].size[1]), R.id);
    if (R.kind === 'see') for (const k of R.what) assert.ok(SEA_LIFE_KINDS.includes(k), `${R.id}: ${k}`);
    if (R.kind === 'deliver') assert.ok(FOLK[R.to] && R.to !== R.who, R.id);
  }
});

test('asked only once their first ones are done; then not again until it’s due; not now waits a day', () => {
  const F = Q.newFavours();
  // Mags: her sole first, then the dolphins, and only then the bream.
  assert.equal(Q.offerFor('mags', F, 1).id, 'sole');
  F.done.sole = 1;
  assert.equal(Q.offerFor('mags', F, 2).id, 'dolphins');
  F.done.dolphins = 2;
  assert.equal(Q.offerFor('mags', F, 3).id, 'bream');
  assert.ok(Q.accept(F, 'bream', 3));
  assert.equal(Q.offerFor('mags', F, 3), null, 'one at a time');
  Q.complete(F, 'bream', 4);
  assert.equal(F.done.bream, 4);
  assert.equal(F.times.bream, 1);
  // Not again the same day, nor until five days have gone by.
  for (const d of [4, 5, 6, 7, 8]) assert.equal(Q.offerFor('mags', F, d), null, `day ${d}`);
  assert.equal(Q.accept(F, 'bream', 8), null, 'not before it’s due');
  assert.equal(Q.offerFor('mags', F, 9).id, 'bream', 'five days on');
  // Not now: asked again the next day.
  Q.decline(F, 'bream', 9);
  assert.equal(Q.offerFor('mags', F, 9), null);
  assert.equal(Q.offerFor('mags', F, 10).id, 'bream');
  Q.accept(F, 'bream', 10);
  Q.complete(F, 'bream', 11);
  assert.equal(F.times.bream, 2, 'twice now');
  assert.equal(F.done.bream, 11, 'the last time');
  // The ones that don't come round again never do.
  assert.equal(Q.accept(F, 'sole', 30), null);
  assert.equal(Q.accept(F, 'dolphins', 30), null);
  // Still three at most on the go.
  const G = allFirstDone(1);
  for (const id of ['bream', 'piefish', 'buoy2']) assert.ok(Q.accept(G, id, 5), id);
  assert.equal(Q.offerFor('hettie', G, 5), null, 'three is plenty');
});

test('everyone has one to ask, once their first ones are done, and on the day it’s due', () => {
  const F = allFirstDone(1);
  for (const who of Object.keys(FOLK)) {
    const R = AGAIN.find((x) => x.who === who);
    assert.equal(Q.offerFor(who, F, 2)?.id, R.id, `${who}: ${R.id}`);
  }
  for (const R of AGAIN) F.done[R.id] = 10;
  for (const R of AGAIN) {
    assert.equal(Q.offerFor(R.who, F, 10 + R.again - 1), null, `${R.id}: not yet`);
    assert.equal(Q.offerFor(R.who, F, 10 + R.again)?.id, R.id, `${R.id}: due`);
  }
});

test('carrying things along the coast: Wenna’s tables up to Bryn, Bryn’s samphire down to Ruth, Fen’s counts to Wenna, Bert’s order to Hettie', () => {
  const pairs = { tides: ['wenna', 'bryn'], samphire: ['bryn', 'ruth'], counts: ['fen', 'wenna'], order: ['bert', 'hettie'] };
  for (const [id, [from, to]] of Object.entries(pairs)) {
    const R = Q.requestById[id];
    assert.deepEqual([R.who, R.to, R.kind], [from, to, 'deliver'], id);
    const F = allFirstDone(1);
    const e = Q.accept(F, id, 3);
    assert.ok(e?.ready, `${id}: carried from the start`);
    assert.equal(Q.businessWith(from, F, [], 3), null, `${id}: nothing more from ${from} for now`);
    assert.equal(Q.businessWith(to, F, [], 3)?.act, 'deliver', `${id}: handed to ${to}`);
    assert.ok(Q.complete(F, id, 3).money > 0);
    assert.equal(F.last[from], 3);
    assert.equal(F.last[to], 3);
    assert.match(Q.standing({ id, day: 3, ready: true }, { [to]: FOLK[to].short }), new RegExp(`find ${FOLK[to].short}`));
  }
});

test('the other kinds work as their first ones do: a catch after dark, a sighting, a photograph, another buoy, fish brought', () => {
  const F = allFirstDone(1);
  Q.accept(F, 'nightbass', 2);
  Q.accept(F, 'tortuga', 2);
  Q.accept(F, 'wrassephoto', 2);
  assert.deepEqual(Q.caught(F, { id: 'seabass', size: 50, night: false, shore: true }), [], 'not by day');
  assert.deepEqual(Q.caught(F, { id: 'seabass', size: 40, night: true, shore: true }), [], 'not that small');
  assert.equal(Q.caught(F, { id: 'seabass', size: 50, night: true, shore: true })[0].id, 'nightbass');
  assert.equal(Q.saw(F, 'turtle')[0].id, 'tortuga');
  assert.equal(Q.photographed(F, { species: ['wrasse'] })[0].id, 'wrassephoto');
  const G = allFirstDone(1);
  const e = Q.accept(G, 'buoy2', 6);
  assert.deepEqual(e.pos, Q.BUOY_DRIFT[6 % Q.BUOY_DRIFT.length]);
  assert.ok(Q.buoyAt(G, 0));
  Q.pickUpBuoy(G);
  assert.equal(Q.businessWith('dougie', G, [], 7).act, 'tell');
  const H = allFirstDone(1);
  Q.accept(H, 'salpreso', 2);
  assert.equal(Q.businessWith('agustin', H, [{ id: 'bogue', size: 20 }, { id: 'bogue', size: 18 }], 2), null, 'three of them');
  assert.equal(Q.businessWith('agustin', H, [{ id: 'bogue', size: 20 }, { id: 'bogue', size: 18 }, { id: 'bogue', size: 16 }], 2).act, 'give');
});

test('kept through a save: how many times, and the last; and a save from before loads as ever', () => {
  const raw = { active: [], done: { sole: 2, bream: 9, piefish: 12 }, last: {}, declined: {}, times: { bream: 3, piefish: 0, sole: 4, nosuch: 2, buoy2: 5 } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 14, favours: raw } })).state;
  // (Only for ones that come round again and have been done; a count of at least one.)
  assert.deepEqual(s.favours.times, { bream: 3 });
  assert.equal(s.favours.done.bream, 9);
  const old = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 14, favours: { active: [], done: { sole: 2 } } } })).state;
  assert.deepEqual(old.favours.times, {});
  assert.deepEqual(old.favours.done, { sole: 2 });
  // The journal says how many times.
  assert.match(readFileSync(new URL('../src/memories.js', import.meta.url), 'utf8'), /F\.times\?\.\[id\] \|\| 1/);
});
