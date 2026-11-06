// Work on the water (src/contracts.js): a board that answers the world (no deliveries in a gale, no
// dolphin pictures without dolphins, the island's own work at the island), the same board all day
// and a new one tomorrow; three jobs at a time; each kind of job finished only by doing it; paid once
// and never twice; and given up safely. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/contracts.js';

const PL = { quay: { x: 520, z: -170, name: 'Wend Quay' }, puerto: { x: 0, z: 6300, name: 'Puerto Brasa' }, stream: { x: 0, z: 0, name: 'Fernbeck' }, visitors: { x: 10, z: -90, name: 'the visitors’ pontoon' } };
const marks = [{ x: 0, z: 100, name: 'A' }, { x: 60, z: 160, name: 'B' }, { x: 0, z: 220, name: 'C' }];
// A quiet day at home, with everything there is to offer (and a version of it to change).
const world = (over = {}) => ({
  day: 12, region: 'home', busy: [{ id: 'seabass', name: 'European Seabass', where: 'off the Skerries', at: { x: 300, z: 600 }, min: 20, max: 80, sea: true }],
  dolphins: true, whales: [{ kind: 'finwhale', name: 'Fin whale', where: 'out past Gannet Isle', at: { x: 400, z: 1500 } }], birds: true,
  storm: false, forecastStorm: false, wind: 5, summer: true, canCross: true, ownsSail: true, places: PL,
  surveyLines: [{ name: 'the bay mouth', marks }], tempMarks: marks, courses: [{ name: 'the bay', marks, minutes: 8 }],
  ...over,
});
const tpls = (list) => list.map((o) => o.tpl).sort();

test('the board answers the world: no deliveries in a gale, no dolphin pictures without dolphins, the island’s own work there', () => {
  // Every template, given a world that calls for it, makes an offer; over many days all turn up.
  const seen = new Set();
  for (let d = 0; d < 60; d++) for (const o of K.offers(K.newContracts(), world({ day: d, beenSouth: true }))) seen.add(o.tpl);
  // (and on days with a gale coming)
  for (let d = 0; d < 40; d++) for (const o of K.offers(K.newContracts(), world({ day: d, storm: true, abs: d * 24 + 9, galeAt: d * 24 + 14 }))) seen.add(o.tpl);
  for (const t of K.TEMPLATE_IDS) assert.ok(seen.has(t), `${t} turns up`);
  // The island's work comes up the board once you've been there (Paco writes).
  const isle = new Set(), never = new Set();
  for (let d = 0; d < 40; d++) {
    for (const o of K.offers(K.newContracts(), world({ day: d, beenSouth: true }))) isle.add(o.tpl);
    for (const o of K.offers(K.newContracts(), world({ day: d, beenSouth: false }))) never.add(o.tpl);
  }
  assert.ok(isle.has('turtle') && isle.has('spares'), 'Paco’s letters, once you’ve been');
  assert.ok(!never.has('turtle') && !never.has('spares'), 'and not before');
  // A board opened at the island has none of the home waters' handling work.
  const southSeen = new Set();
  for (let d = 0; d < 30; d++) for (const o of K.offers(K.newContracts(), world({ day: d, region: 'south', beenSouth: true }))) southSeen.add(o.tpl);
  for (const t of ['berthing', 'marks', 'undersail', 'fly']) assert.equal(southSeen.has(t), false, `no ${t} at the island`);
  // A gale: no deliveries and no racing round the marks.
  for (let d = 0; d < 40; d++) {
    const list = tpls(K.offers(K.newContracts(), world({ day: d, storm: true, forecastStorm: true, wind: 18 })));
    for (const t of ['wendbox', 'spares', 'berthing', 'marks', 'undersail']) assert.equal(list.includes(t), false, `day ${d}: no ${t} in a gale`);
  }
  // No dolphins, no whales, no birds: no pictures of them asked for.
  for (let d = 0; d < 40; d++) {
    const list = tpls(K.offers(K.newContracts(), world({ day: d, dolphins: false, whales: [], birds: false })));
    for (const t of ['bowride', 'whale', 'frenzy']) assert.equal(list.includes(t), false, `day ${d}: no ${t}`);
  }
  // Nothing busy in the sea: no species asked for; no boat for the crossing: no crossing.
  for (let d = 0; d < 40; d++) {
    const list = tpls(K.offers(K.newContracts(), world({ day: d, busy: [], canCross: false, beenSouth: true })));
    for (const t of ['special', 'trophy', 'spares']) assert.equal(list.includes(t), false, `day ${d}: no ${t}`);
  }
  // The species asked for is one that's busy, at a size it grows to.
  for (let d = 0; d < 40; d++) {
    const o = K.offers(K.newContracts(), world({ day: d })).find((x) => x.tpl === 'special');
    if (o) assert.ok(o.obj.sp === 'seabass' && o.obj.min > 20 && o.obj.min < 80);
  }
});

test('the same board all day, a new one tomorrow; and each offer says what it is, who it’s for, what it pays', () => {
  const C = K.newContracts();
  const a = K.offers(C, world()), b = K.offers(C, world());
  assert.equal(a, b, 'the same offers all day');
  const c = K.offers(C, world({ day: 13 }));
  assert.notDeepEqual(tpls(a), tpls(c), 'a different board tomorrow');
  for (const o of [...a, ...c]) {
    assert.ok(o.title && o.story && o.goal, `${o.tpl}: words`);
    assert.ok(o.giver in K.GIVERS, `${o.tpl}: someone offering it`);
    assert.ok(o.cat in K.CATEGORIES);
    assert.ok(o.pay >= 5 && o.difficulty >= 1 && o.difficulty <= 3 && o.minutes > 0);
    assert.equal(typeof o.coop, 'boolean');
  }
});

test('three jobs at a time; taken off the board as they’re taken; the board keeps the rest', () => {
  const C = K.newContracts();
  const list = K.offers(C, world({ day: 20 }));
  assert.ok(list.length >= 4);
  for (let i = 0; i < 3; i++) assert.ok(K.accept(C, list[0].id).contract || K.accept(C, C.board.offers[0].id).contract);
  assert.equal(C.active.length, 3);
  const more = K.accept(C, C.board.offers[0].id);
  assert.ok(more.why && !more.contract, 'not a fourth');
  assert.equal(K.accept(C, 'nonsense').why, 'That job’s gone.');
  for (const a of C.active) assert.equal(C.board.offers.some((o) => o.id === a.id), false, 'off the board');
});

// A contract of a given kind, accepted.
function take(obj, extra = {}) {
  const C = K.newContracts();
  C.board = { day: 1, region: 'home', offers: [{ id: 'job', tpl: 'special', cat: 'fishing', giver: 'ruth', title: 'T', story: 'S', goal: 'G', pay: 20, rep: 1, difficulty: 1, minutes: 10, coop: false, obj, ...extra }] };
  K.accept(C, 'job', 0);
  return C;
}

test('each kind of job is finished only by doing it', () => {
  // A species at a size, on the fly; a trophy photographed and let go; a mixed bag.
  let C = take({ kind: 'catch', sp: 'trout', min: 30, method: 'fly', count: 1 });
  assert.deepEqual(K.caught(C, { sp: 'trout', size: 34, method: 'lure' }), [], 'not on a lure');
  assert.deepEqual(K.caught(C, { sp: 'trout', size: 25, method: 'fly' }), [], 'not too small');
  assert.deepEqual(K.caught(C, { sp: 'perch', size: 40, method: 'fly' }), [], 'not another fish');
  assert.equal(K.caught(C, { sp: 'trout', size: 31, method: 'fly' }).length, 1);
  C = take({ kind: 'catch', sp: 'seabass', min: 50, released: true, photo: true, count: 1 });
  assert.deepEqual(K.caught(C, { sp: 'seabass', size: 60, phase: 'landed', photo: true }), [], 'landed and kept is no good');
  assert.deepEqual(K.caught(C, { sp: 'seabass', size: 60, phase: 'released', photo: false }), [], 'no photograph, no good');
  assert.equal(K.caught(C, { sp: 'seabass', size: 60, phase: 'released', photo: true }).length, 1);
  // (And a plain job counts a fish when it's landed, not again when it's let go.)
  C = take({ kind: 'catch', sp: 'mackerel', count: 2 });
  K.caught(C, { sp: 'mackerel', size: 30, phase: 'landed' });
  K.caught(C, { sp: 'mackerel', size: 30, phase: 'released' });
  assert.equal(C.active[0].progress.got, 1, 'one fish, counted once');
  C = take({ kind: 'catch', distinct: 3, sea: true });
  K.caught(C, { sp: 'mackerel', sea: true });
  K.caught(C, { sp: 'mackerel', sea: true });
  K.caught(C, { sp: 'trout', sea: false });
  K.caught(C, { sp: 'pollack', sea: true });
  assert.equal(C.active[0].ready, false, 'two kinds, a fresh-water one not counting');
  assert.equal(K.caught(C, { sp: 'wrasse', sea: true }).length, 1);
  // Dolphins on your bow, photographed: not dolphins somewhere else.
  C = take({ kind: 'photo', life: ['bottlenose', 'commondolphin'], bow: true });
  assert.deepEqual(K.photographed(C, { life: ['commondolphin'], bow: false }), []);
  assert.deepEqual(K.photographed(C, { life: ['turtle'], bow: true }), []);
  assert.equal(K.photographed(C, { life: ['commondolphin'], bow: true }).length, 1);
  // The marks, in order, with the finder on; at night when it says so.
  C = take({ kind: 'visit', marks, sonar: true, night: true, r: 20 });
  const at = (m, extra = {}) => K.tick(C, { x: m.x, z: m.z, now: 0, sonar: true, night: true, ...extra });
  at(marks[1]);
  assert.equal(C.active[0].progress.next, 0, 'not out of order');
  at(marks[0], { sonar: false });
  assert.equal(C.active[0].progress.next, 0, 'not with the finder off');
  at(marks[0], { night: false });
  assert.equal(C.active[0].progress.next, 0, 'not by day');
  at(marks[0]);
  at(marks[1]);
  assert.equal(at(marks[2]).done.length, 1);
  // A course against the clock: too slow, and it starts again from the first mark.
  C = take({ kind: 'visit', marks, r: 20, limit: 60 });
  K.tick(C, { x: marks[0].x, z: marks[0].z, now: 10 });
  K.tick(C, { x: marks[1].x, z: marks[1].z, now: 30 });
  const late = K.tick(C, { x: 500, z: 500, now: 80 });
  assert.equal(late.reset.length, 1);
  assert.equal(C.active[0].progress.next, 0, 'back to the start, no harm done');
  // Under sail: only with the sail up and the engine off.
  C = take({ kind: 'visit', marks: [marks[0]], r: 20, sail: true });
  assert.equal(K.tick(C, { x: marks[0].x, z: marks[0].z, now: 0, sailing: false }).done.length, 0);
  assert.equal(K.tick(C, { x: marks[0].x, z: marks[0].z, now: 0, sailing: true }).done.length, 1);
  // A whale as it surfaces, close enough; birds working, close enough.
  C = take({ kind: 'observe', what: 'whale', r: 200 });
  assert.equal(K.tick(C, { x: 0, z: 0, whale: 450 }).done.length, 0);
  assert.equal(K.tick(C, { x: 0, z: 0, whale: null, frenzy: 10 }).done.length, 0, 'birds aren’t a whale');
  assert.equal(K.tick(C, { x: 0, z: 0, whale: 150 }).done.length, 1);
  // A delivery, on arrival: done and paid on the spot.
  C = take({ kind: 'deliver', to: 'quay', r: 25 });
  assert.equal(K.tick(C, { x: 0, z: 0, at: 'strand' }).done.length, 0);
  const d = K.tick(C, { x: 0, z: 0, at: 'quay' }).done;
  assert.ok(d.length === 1 && d[0].onSpot);
  // Berthing: a bump on the way in and it starts again; alongside clean and it's done.
  C = take({ kind: 'dock', pier: 'visitors', bumps: 0 });
  assert.equal(K.tick(C, { x: 0, z: 0, bumps: 1, tied: null }).reset.length, 1);
  assert.equal(K.tick(C, { x: 0, z: 0, bumps: 0, tied: 'haven' }).done.length, 0, 'not another pier');
  assert.equal(K.tick(C, { x: 0, z: 0, bumps: 0, tied: 'visitors' }).done.length, 1);
});

test('paid once and only once, only when it’s done; given up safely', () => {
  const C = take({ kind: 'catch', sp: 'mackerel', count: 2 });
  assert.equal(K.claim(C, 'job', 1), null, 'not before it’s done');
  K.caught(C, { sp: 'mackerel', size: 30 });
  assert.equal(K.claim(C, 'job', 1), null, 'one of two is not done');
  K.caught(C, { sp: 'mackerel', size: 30 });
  const paid = K.claim(C, 'job', 1);
  assert.equal(paid.pay, 20);
  assert.equal(C.earned, 20);
  assert.equal(C.rep.ruth, 1);
  assert.equal(K.claim(C, 'job', 1), null, 'never twice');
  assert.equal(C.active.length, 0);
  // Its id is spent: tomorrow's board for the same day and region can't bring it back.
  C.board = null;
  const again = K.offers(C, { ...world(), day: 1 });
  assert.equal(again.some((o) => o.id === 'job'), false);
  // Given up: struck off, nothing paid, and it can't be finished or paid afterwards.
  const G = take({ kind: 'catch', sp: 'mackerel', count: 1 });
  const gone = K.abandon(G, 'job');
  assert.equal(gone.id, 'job');
  assert.deepEqual(K.caught(G, { sp: 'mackerel', size: 30 }), []);
  assert.equal(K.claim(G, 'job', 1), null);
  assert.equal(G.earned, 0);
  assert.equal(K.abandon(G, 'job'), null);
  // A survey pays half as much again with imaging sonar fitted.
  const S = take({ kind: 'visit', marks: [marks[0]], sonar: true, r: 20 }, { cat: 'survey' });
  K.tick(S, { x: marks[0].x, z: marks[0].z, now: 0, sonar: true });
  assert.equal(K.claim(S, 'job', 1, { imaging: true }).pay, 30);
});

test('the record in the save is cleaned: junk dropped, finished jobs kept, old ones let go', () => {
  const C = K.cleanContracts({
    board: { day: 3, region: 'home', offers: [{ id: 'x', tpl: 'nope', obj: {}, pay: 1 }, { id: 'y', tpl: 'mixedbag', obj: { kind: 'catch', distinct: 3 }, pay: 36 }] },
    active: [{ id: 'z', tpl: 'whale', obj: { kind: 'observe', what: 'whale', r: 200 }, pay: 45, progress: {} }, { id: 'bad' }],
    done: { a: 2, b: 'x' }, rep: { ruth: 3, villain: 9 }, earned: 120, count: 4,
  });
  assert.deepEqual(C.board.offers.map((o) => o.id), ['y']);
  assert.deepEqual(C.active.map((a) => a.id), ['z']);
  assert.deepEqual(C.done, { a: 2 });
  assert.deepEqual(C.rep, { ruth: 3 });
  assert.equal(C.earned, 120);
  K.prune(C, 30);
  assert.deepEqual(C.done, {}, 'finished jobs a fortnight old let go (their ids carry their day)');
  assert.deepEqual(K.cleanContracts(null), K.newContracts());
});

test('a gale coming brings the one job that has to beat it, and it lapses harmlessly if it doesn’t', () => {
  // A gale due this afternoon: deliveries off the board but for the one before it.
  let seen = false;
  for (let d = 0; d < 40 && !seen; d++) {
    const list = K.offers(K.newContracts(), world({ day: d, storm: true, abs: d * 24 + 9, galeAt: d * 24 + 14, galeWords: '2:00 pm' }));
    assert.equal(list.some((o) => ['wendbox', 'spares', 'marks', 'berthing'].includes(o.tpl)), false);
    seen = list.some((o) => o.tpl === 'beforegale');
  }
  assert.ok(seen, 'the run to Wend Quay before the gale');
  for (let d = 0; d < 40; d++) assert.equal(K.offers(K.newContracts(), world({ day: d, abs: d * 24 + 9 })).some((o) => o.tpl === 'beforegale'), false, 'not without a gale coming');
  // Taken, and too late: struck off with nothing lost; in time: paid on arrival.
  const late = take({ kind: 'deliver', to: 'quay', r: 25, by: 14 });
  const r = K.tick(late, { x: 0, z: 0, abs: 14.5, at: null });
  assert.equal(r.missed.length, 1);
  assert.equal(late.active.length, 0);
  assert.equal(late.earned, 0);
  const ok = take({ kind: 'deliver', to: 'quay', r: 25, by: 14 });
  assert.equal(K.tick(ok, { x: 0, z: 0, abs: 13, at: 'quay' }).done.length, 1);
});
