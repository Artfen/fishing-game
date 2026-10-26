// The day book (daybook.js): each day out written up as a page when it ends (where you went and
// how, the weather, what you caught, your firsts and your biggest yet, dives, sea life, a gale),
// your record, and the harbour's challenges with their badges; and all of it through a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const B = await import('../src/daybook.js');
const { sanitize } = await import('../src/save.js');
const { remember } = await import('../src/requests.js');

const catchOf = (day, hour, sp, size, extra = {}) => ({ id: `c${Math.random().toString(36).slice(2, 8)}`, day, hour, sp, size, zone: 'coast', outcome: 'released', ...extra });
function aDay() {
  const state = sanitize({ day: 5, hour: 20 });
  state.log.push(
    catchOf(4, 9, 'mackerel', 31, { outcome: 'kept' }),
    catchOf(5, 9, 'mackerel', 30, { outcome: 'kept' }),
    catchOf(5, 9.5, 'mackerel', 33),
    catchOf(5, 11, 'pollack', 70, { outcome: 'kept', place: 'The Hound' }),
    catchOf(5, 15, 'seabass', 55, { zone: 'bay', sky: 'storm' }),
  );
  state.fish = { mackerel: { count: 9, best: 33, firstDay: 2 }, pollack: { count: 1, best: 70, firstDay: 5 }, seabass: { count: 3, best: 55, firstDay: 1 } };
  state.places = { haven: { day: 1, hour: 9 }, hound: { day: 5, hour: 10 } };
  state.dive.sites = { hound: { first: 5, dives: 1, deepest: 27.4 } };
  state.seaLife = { commondolphin: { n: 1, day: 5, hour: 12, where: '' } };
  const T = state.today;
  B.noteMove(T, 'boat', 9400, 7.2);
  for (const [id, h] of [['haven', 7.2], ['skerries', 8], ['gannet', 9], ['hound', 10], ['haven', 18]]) B.notePlace(T, id, h);
  B.noteBoat(T, 'motor skiff');
  B.noteDive(T, 'hound', 18);
  B.noteDive(T, 'hound', 27.4);
  B.noteSeen(T, 'commondolphin');
  B.noteSky(T, 'clear');
  B.noteSky(T, 'clear');
  B.noteSky(T, 'storm');
  B.noteGale(T, 'out');
  B.noteGale(T, 'shelter');
  B.noteRecord(T, 'seabass', 55);
  B.noteMove(T, 'foot', 800, 19);
  return state;
}

test('a day out is written up as a page: where, how, the weather, the catch, firsts, dives, the gale', () => {
  const state = aDay();
  assert.equal(state.today.day, 5);
  const p = B.closeDay(state, 6);
  assert.ok(p);
  assert.equal(state.days.length, 1);
  assert.equal(state.today.day, 6, 'a fresh page for the new day');
  assert.equal(p.caught, 4, 'only the day’s own catches');
  assert.equal(p.kept, 2);
  assert.deepEqual(p.kinds, { mackerel: 2, pollack: 1, seabass: 1 });
  assert.deepEqual(p.best, { sp: 'pollack', size: 70 });
  assert.deepEqual(p.firsts.fish, ['pollack']);
  assert.deepEqual(p.firsts.places, ['hound']);
  assert.deepEqual(p.firsts.sites, ['hound']);
  assert.deepEqual(p.records, [{ sp: 'seabass', size: 55 }]);
  assert.deepEqual(p.dives, [{ site: 'hound', deepest: 27.4 }]);
  assert.equal(p.gale, 'out', 'caught out once is caught out');
  assert.deepEqual(p.sky, ['clear', 'storm']);
  const text = B.dayText(p);
  for (const bit of ['Out from Willowhaven by the motor skiff to the Skerries, Gannet Isle and the Hound, and back', '9.4 km on the water', 'Caught 4', '2 Atlantic mackerel', 'a pollack', 'Kept 2, let 2 go', 'Your first pollack', 'Your biggest European seabass yet: 55 cm', 'Dived the Hound (down to 27 m)', 'Saw common dolphins', 'Found the Hound', 'A gale caught you out']) {
    assert.ok(text.includes(bit), `"${bit}" in: ${text}`);
  }
  assert.match(B.dayLine(p), /^Day 5 is written up in your journal: 4 fish, a new kind, a dive, a new place and common dolphins\.$/);
});

test('a day with nothing in it isn’t written; the book keeps the last sixty', () => {
  const state = sanitize({ day: 3 });
  B.noteSky(state.today, 'clear');
  assert.equal(B.closeDay(state, 4), null);
  assert.equal(state.days.length, 0);
  for (let d = 4; d < 80; d++) {
    state.log.push(catchOf(d, 10, 'mackerel', 30));
    B.closeDay(state, d + 1);
  }
  assert.equal(state.days.length, 60);
  assert.equal(state.days[59].day, 79);
});

test('the day book, the days and the badges survive a save; junk is thrown out', () => {
  const state = aDay();
  B.closeDay(state, 6);
  state.day = 6;
  B.notePlace(state.today, 'strand', 8);
  B.checkChallenges(state);
  const back = sanitize(JSON.parse(JSON.stringify(state)));
  assert.deepEqual(back.days, state.days);
  assert.deepEqual(back.today, state.today);
  assert.deepEqual(back.badges, state.badges);
  // An older save: no day book yet, a fresh page for its day.
  const old = sanitize({ day: 9 });
  assert.equal(old.today.day, 9);
  assert.deepEqual(old.days, []);
  assert.deepEqual(old.badges, {});
  // A page left over from another day starts afresh; nonsense is cleaned.
  assert.equal(sanitize({ day: 9, today: { day: 4, places: ['x'] } }).today.places.length, 0);
  const junk = sanitize({ day: 9, days: [{ day: 2, kinds: { nofish: 3, mackerel: 2 }, dives: [{ site: 'atlantis', deepest: 900 }], gale: 'wild', seen: ['unicorn'] }, 'nope'], badges: { slam: { day: 3 }, bogus: { day: 1 } } });
  assert.deepEqual(junk.days[0].kinds, { mackerel: 2 });
  assert.deepEqual(junk.days[0].dives, [{ site: null, deepest: 100 }]);
  assert.equal(junk.days[0].gale, null);
  assert.deepEqual(junk.days[0].seen, []);
  assert.deepEqual(Object.keys(junk.badges), ['slam']);
});

test('the harbour’s challenges: each can be done, and a badge comes once', () => {
  const state = aDay();
  const done = B.checkChallenges(state).map((c) => c.id);
  assert.ok(done.includes('slam'), 'bass, pollack and mackerel on day 5');
  assert.ok(done.includes('gale'), 'a bass from the bay in a storm');
  assert.ok(!done.includes('bayten'));
  assert.deepEqual(B.checkChallenges(state), [], 'not twice');
  const id = (c) => B.challengeById[c];
  // Ten kinds from the bay.
  const kinds = ['seabass', 'mullet', 'flounder', 'plaice', 'sole', 'gilthead', 'cuttlefish', 'sandsmelt', 'garfish', 'wrasse'];
  const s2 = sanitize({});
  s2.log = kinds.map((k, i) => catchOf(1, 10, k, 30, { zone: i % 2 ? 'bay' : 'cove' }));
  assert.deepEqual(id('bayten').check(s2), { n: 10, of: 10 });
  // Every water.
  s2.log = [catchOf(1, 9, 'mackerel', 30, { zone: 'coast' }), catchOf(1, 9, 'mullet', 40, { zone: 'estuary' }), catchOf(1, 9, 'perch', 20, { zone: 'mere' }), catchOf(1, 9, 'trout', 25, { zone: 'stream' })];
  assert.deepEqual(id('waters').check(s2), { n: 4, of: 4 });
  // After midnight; Las Brasas; fifty let go; a week out.
  assert.equal(id('night').check({ log: [catchOf(1, 2.5, 'squid', 20)] }).n, 1);
  assert.equal(id('south').check({ log: [catchOf(1, 10, 'vieja', 30, { zone: 'lava' })] }).n, 1);
  assert.equal(id('release').check({ log: Array.from({ length: 50 }, () => catchOf(1, 10, 'mackerel', 30)) }).n, 50);
  assert.equal(id('week').check({ log: [1, 2, 3, 4, 5, 6, 7].map((d) => catchOf(d, 10, 'mackerel', 30)) }).n, 7);
  // A specimen: the top tenth of the sizes it grows to here.
  assert.equal(id('specimen').check({ log: [catchOf(1, 10, 'pollack', 50)] }).n, 0);
  assert.equal(id('specimen').check({ log: [catchOf(1, 10, 'pollack', 200)] }).n, 1);
  // The dives.
  assert.equal(id('sites').check({ dive: { sites: { reef: { dives: 1 }, kelp: { dives: 1 }, wreck: { dives: 2 }, sands: { dives: 1 }, hound: { dives: 1 } } } }).n, 5);
  assert.equal(id('thirty').check({ dive: { deepest: 29 } }).n, 1);
  // Every challenge has what the board and the badge need.
  for (const c of B.CHALLENGES) assert.ok(c.name && c.text && /^#[0-9a-f]{6}$/i.test(c.color) && c.mark, c.id);
});

test('your record: the totals, your best of each kind, the fish to remember', () => {
  const state = aDay();
  B.closeDay(state, 6);
  const C = B.careerOf(state);
  assert.equal(C.days, 1);
  assert.equal(C.fish, 5);
  assert.equal(C.kept, 3);
  assert.equal(C.released, 2);
  assert.equal(C.kinds, 3);
  assert.equal(C.sites, 1);
  assert.equal(C.bests[0].sp, 'pollack', 'best for its kind first');
  assert.ok(C.notable.every((e) => B.rel(e) >= 0.8));
});

test('the harbour remembers your dives and your badges', () => {
  const mem = { day: 6, dive: { site: 'the Hound', day: 5 }, badge: null };
  assert.match(remember('hettie', mem), /the Hound/);
  assert.match(remember('ruth', { day: 6, badge: { name: 'The coast slam', day: 6 } }), /The coast slam/);
  assert.equal(remember('ruth', { day: 9, badge: { name: 'The coast slam', day: 6 } }), '', 'old news by then');
});
