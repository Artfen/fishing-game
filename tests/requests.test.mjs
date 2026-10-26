// The harbour's people ask small favours (requests.js): a fish they need, something to carry, a
// catch they bet you can't make, a whale to hear about, a pot buoy adrift; and remember what you've
// been up to. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Q = await import('../src/requests.js');
const { fishById } = await import('../src/fish.js');
const { FOLK } = await import('../src/townsfolk.js');
const { KEEPSAKES } = await import('../src/adventures.js');
const { SEA_LIFE_KINDS, parseSave, SAVE_VERSION } = await import('../src/save.js');
const T = await import('../src/world/terrain.js');

test('every favour is someone’s, about something real: fish you can keep or catch, sea life there is, keepsakes and marks that exist', () => {
  assert.equal(new Set(Q.REQUEST_IDS).size, Q.REQUESTS.length);
  for (const R of Q.REQUESTS) {
    assert.ok(FOLK[R.who], R.id);
    assert.ok(R.ask.length > 60 && R.short.length > 10 && R.thanks.length > 20, R.id);
    if (R.kind === 'bring') assert.ok(fishById[R.species]?.meal, `${R.id}: a fish you can keep`);
    if (R.kind === 'catch' || R.kind === 'photo') assert.ok(fishById[R.species], R.id);
    if (R.min) assert.ok(R.min < fishById[R.species].size[1], `${R.id}: a size that exists`);
    if (R.kind === 'see') for (const k of R.what) assert.ok(SEA_LIFE_KINDS.includes(k), `${R.id}: ${k}`);
    if (R.kind === 'deliver') assert.ok(FOLK[R.to] && R.item, R.id);
    if (R.reward.keepsake) assert.ok(KEEPSAKES[R.reward.keepsake], R.reward.keepsake);
    if (R.reward.pin) {
      const h = T.heightAt(R.reward.pin.x, R.reward.pin.z);
      assert.ok(h < 1.5 && h > -15, `${R.id}: its mark is by the water (${h.toFixed(1)} m)`);
    }
  }
  for (const p of Q.BUOY_DRIFT) assert.ok(T.heightAt(p.x, p.z) < -3, 'the buoy drifts at sea');
  // Something from everyone.
  for (const who of Object.keys(FOLK)) assert.ok(Q.REQUESTS.some((R) => R.who === who), who);
});

test('asking: one at a time from each person, three on the go at most, not again the day you say not now', () => {
  const F = Q.newFavours();
  const r1 = Q.offerFor('mags', F, 3);
  assert.equal(r1.id, 'sole');
  Q.decline(F, 'sole', 3);
  assert.equal(Q.offerFor('mags', F, 3), null);
  assert.equal(Q.offerFor('mags', F, 4).id, 'sole', 'asked again the next day');
  Q.accept(F, 'sole', 4);
  assert.equal(Q.offerFor('mags', F, 4), null, 'one at a time');
  Q.accept(F, 'buoy', 4);
  Q.accept(F, 'whale', 4);
  assert.equal(Q.offerFor('hettie', F, 4), null, 'three is plenty');
  assert.equal(Q.accept(F, 'squid', 4), null);
});

test('bringing a fish: only the right one, big enough and raw (and two, for Dougie’s bait)', () => {
  const F = Q.newFavours();
  Q.accept(F, 'sole', 1);
  assert.equal(Q.businessWith('mags', F, [{ id: 'sole', size: 28 }], 1), null);
  assert.equal(Q.businessWith('mags', F, [{ id: 'sole', size: 33, cooked: true }], 1), null);
  const b = Q.businessWith('mags', F, [{ id: 'plaice', size: 40 }, { id: 'sole', size: 33 }], 1);
  assert.equal(b.act, 'give');
  assert.deepEqual(Q.fishFor([{ id: 'plaice', size: 40 }, { id: 'sole', size: 33 }], b.R), [1]);
  assert.equal(Q.complete(F, 'sole', 2).money, 25);
  assert.equal(F.done.sole, 2);
  assert.equal(Q.offerFor('mags', F, 2), null, 'not two in a day');
  assert.equal(Q.offerFor('mags', F, 3).id, 'dolphins');
  const G = Q.newFavours();
  Q.accept(G, 'bait', 1);
  assert.equal(Q.businessWith('dougie', G, [{ id: 'mackerel', size: 30 }], 1), null);
  assert.equal(Q.businessWith('dougie', G, [{ id: 'mackerel', size: 30 }, { id: 'mackerel', size: 26 }], 1).act, 'give');
});

test('catches, sightings and photographs make a favour ready to tell them about, if they’re the right ones', () => {
  const F = Q.newFavours();
  Q.accept(F, 'squid', 1);
  Q.accept(F, 'pike', 1);
  Q.accept(F, 'whale', 1);
  assert.deepEqual(Q.caught(F, { id: 'squid', size: 20, night: false, shore: true }), [], 'not by day');
  assert.deepEqual(Q.caught(F, { id: 'squid', size: 20, night: true, shore: false }), [], 'not from a boat');
  assert.equal(Q.caught(F, { id: 'squid', size: 20, night: true, shore: true })[0].id, 'squid');
  assert.deepEqual(Q.caught(F, { id: 'pike', size: 70, night: false, shore: true }), [], 'Bert’s record stands');
  assert.equal(Q.caught(F, { id: 'pike', size: 74 })[0].id, 'pike');
  assert.deepEqual(Q.saw(F, 'bottlenose'), []);
  assert.equal(Q.saw(F, 'minkewhale')[0].id, 'whale');
  assert.equal(Q.businessWith('kit', F, [], 2).act, 'tell');
  const G = Q.newFavours();
  Q.accept(G, 'grouper', 1);
  assert.deepEqual(Q.photographed(G, { species: ['parrotfish'] }), []);
  assert.equal(Q.photographed(G, { species: ['parrotfish', 'grouper'] })[0].id, 'grouper');
});

test('carrying something across the harbour, and finding Dougie’s buoy adrift', () => {
  const F = Q.newFavours();
  Q.accept(F, 'hooks', 5);
  assert.equal(Q.businessWith('bert', F, [], 5), null, 'Bert has nothing more for now');
  const b = Q.businessWith('hettie', F, [], 5);
  assert.equal(b.act, 'deliver');
  assert.ok(Q.complete(F, 'hooks', 5).pin);
  assert.equal(F.last.hettie, 5);
  const G = Q.newFavours();
  const e = Q.accept(G, 'buoy', 7);
  assert.deepEqual(e.pos, Q.BUOY_DRIFT[7 % Q.BUOY_DRIFT.length]);
  const at = Q.buoyAt(G, 100);
  assert.ok(Math.hypot(at.x - e.pos.x, at.z - e.pos.z) < 10, 'drifting round where it was lost');
  assert.equal(Q.businessWith('dougie', G, [], 7), null);
  Q.pickUpBuoy(G);
  assert.equal(Q.buoyAt(G, 100), null, 'aboard now');
  assert.equal(Q.businessWith('dougie', G, [], 8).act, 'tell');
  assert.match(Q.standing(G.active[0], { dougie: 'Dougie' }), /take it to Dougie/);
});

test('favours are saved; and the people remember your catch, your trip and where you’ve been', () => {
  const raw = { active: [{ id: 'whale', day: 3, ready: true }, { id: 'nosuch', day: 1 }, { id: 'buoy', day: 4, pos: { x: 60, z: 140 } }], done: { sole: 2, bogus: 1 }, last: { mags: 2 }, declined: { squid: 3 } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 5, favours: raw } })).state;
  assert.deepEqual(s.favours.active.map((a) => a.id), ['whale', 'buoy']);
  assert.deepEqual(s.favours.active[1].pos, { x: 60, z: 140 });
  assert.deepEqual(s.favours.done, { sole: 2 });
  assert.equal(s.favours.declined.squid, 3);
  assert.deepEqual(parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 5 } })).state.favours, Q.newFavours());
  const mem = { day: 9, notable: { name: 'European Seabass', size: 71, day: 9 }, place: null, trip: null };
  assert.match(Q.remember('ruth', mem), /71 cm European seabass/);
  assert.equal(Q.remember('ruth', { ...mem, day: 12 }), '', 'old news by then');
  assert.match(Q.remember('dougie', { day: 9, trip: { name: 'Longmere', total: 6, day: 9 } }), /6 fish/);
  assert.match(Q.remember('kit', { day: 9, place: { name: 'Gannet Isle', day: 9 } }), /Gannet Isle/);
});
