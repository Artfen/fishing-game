// The rest of the work on the water (src/contracts.js): the easy first job that's always there until
// you've done one (nothing to do with fish), the Marine Trust's dive surveys (finished by logging
// what you find on a dive), the harbour office's calls over the radio (someone to pick up, a buoy
// adrift: never on the board, one at a time, a boat with room needed, paid when you're home), and
// the Gannet Isle expedition, in stages, each done the way its own kind of job is; all paid once
// and safe to give up. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/contracts.js';
import { BOAT_KINDS } from '../src/boat.js';

const PL = { quay: { x: 520, z: -170, name: 'Wend Quay' }, puerto: { x: 0, z: 6300, name: 'Puerto Brasa' }, stream: { x: 0, z: 0, name: 'Fernbeck' }, puffin: { x: -300, z: 900, name: 'Puffin Cove' }, landing: { x: -86, z: -5, name: 'The Landing' }, light: { x: -250, z: 1100, name: 'Gannet Light' }, hound: { x: -196, z: 744, name: 'The Hound' } };
const marks = [{ x: 0, z: 100, name: 'A' }];
const world = (over = {}) => ({
  day: 4, region: 'home', busy: [], dolphins: false, whales: [], birds: false, storm: false, forecastStorm: false, wind: 5, summer: true, canCross: false, places: PL,
  surveyLines: [{ name: 'x', marks }], tempMarks: marks, courses: [{ name: 'x', marks, minutes: 8 }], diveSites: [], usable: ['row', 'skiff', 'kayak'], kinds: BOAT_KINDS,
  diveUnfound: [{ id: 'wreck', name: 'The Kittiwake', x: 300, z: 200, left: 6 }, { id: 'hound', name: 'The Hound', x: -196, z: 744, left: 1, deep: true }], ...over,
});
const rec = (count = 0) => Object.assign(K.newContracts(), { count });
const at = (o = {}) => ({ x: 0, z: 0, now: 0, abs: 0, home: false, boat: 'skiff', dt: 0.5, speed: 0.5, sea: 0.3, ...o });
function take(tpl, count = 20, over = {}) {
  for (let d = 0; d < 300; d++) {
    const C = rec(count), o = K.offers(C, world({ day: d, ...over })).find((x) => x.tpl === tpl);
    if (o) return { C, a: K.accept(C, o.id).contract };
  }
  throw new Error(`no ${tpl}`);
}

test('a first job, easy and close and nothing to do with fish, tops the board until you’ve done one', () => {
  for (let d = 0; d < 20; d++) {
    const top = K.offers(rec(0), world({ day: d }))[0];
    assert.equal(top.tpl, 'firstjob', `day ${d}`);
    assert.equal(top.cat, 'delivery');
    assert.equal(top.difficulty, 1);
    assert.ok(!K.offers(rec(1), world({ day: d })).some((o) => o.tpl === 'firstjob'), 'gone once you’ve done one');
  }
  const C = rec(0), o = K.offers(C, world())[0];
  const a = K.accept(C, o.id).contract;
  // Rowed along the shore to The Landing and stopped: delivered, paid on the spot, once.
  assert.equal(K.tick(C, at({ boat: 'row', at: 'quay' })).done.length, 0);
  const r = K.tick(C, at({ boat: 'row', at: 'landing' }));
  assert.equal(r.done.length, 1);
  assert.ok(a.onSpot);
  assert.equal(K.claim(C, a.id, 4).pay, 12);
  assert.equal(K.claim(C, a.id, 4), null);
  assert.equal(C.count, 1);
  // Tomorrow's board: no first job.
  assert.ok(!K.offers(C, world({ day: 5 })).some((x) => x.tpl === 'firstjob'));
});

test('a dive survey is finished by logging new things on that site, and only there', () => {
  const { C, a } = take('divesurvey');
  assert.equal(a.obj.site, 'wreck', 'only a site with two or more things left to find');
  assert.equal(a.obj.n, 3);
  assert.equal(K.found(C, 'reef').length, 0);
  assert.equal(a.progress.got, 0, 'a find elsewhere doesn’t count');
  K.found(C, 'wreck');
  K.found(C, 'wreck');
  assert.match(K.standing(a), /2 of 3/);
  assert.equal(K.found(C, 'wreck').length, 1);
  assert.ok(a.ready && !a.onSpot);
  assert.equal(K.found(C, 'wreck').length, 0, 'finished once');
  assert.ok(K.claim(C, a.id, 4));
  assert.equal(K.claim(C, a.id, 4), null);
  // Nothing left to find anywhere: no survey.
  for (let d = 0; d < 60; d++) assert.ok(!K.offers(rec(20), world({ day: d, diveUnfound: [{ id: 'wreck', name: 'W', x: 0, z: 0, left: 1 }] })).some((o) => o.tpl === 'divesurvey'));
});

test('calls come over the radio now and then, by themselves, one at a time, never on the board', () => {
  const C = rec(5);
  assert.equal(K.callDue(C, 100), false, 'not in the first hours');
  assert.equal(C.callAt, 103);
  assert.equal(K.callDue(C, 103.5), true);
  const W = world({ abs: 103.5, callSpot: { x: 200, z: 300, where: 'past the Old Jetty' } });
  const o = K.callFor(C, W, () => 0.1);
  assert.ok(o && K.TEMPLATES[o.tpl].call && o.cat === 'rescue', JSON.stringify(o?.tpl));
  assert.match(o.story, /Harbour office/);
  K.callMade(C, 103.5, () => 0.5);
  assert.equal(C.callAt, 103.5 + 7.5);
  assert.ok(K.acceptCall(C, o, 0));
  assert.equal(K.acceptCall(C, o, 0), null, 'the same call taken twice: no');
  // One pickup at a time: no other call while it's on.
  assert.equal(K.callDue(C, 200), false);
  // Nowhere to send you, or a gale: no call.
  assert.equal(K.callFor(rec(), world({ abs: 1 }), () => 0.1), null);
  assert.equal(K.callFor(rec(), world({ abs: 1, storm: true, callSpot: { x: 0, z: 0, where: 'x' } }), () => 0.1), null);
  // Three jobs on already: no call.
  const full = rec(5);
  full.active = [1, 2, 3].map((i) => ({ id: `x${i}`, obj: { kind: 'catch' }, progress: {} }));
  full.callAt = 0;
  assert.equal(K.callDue(full, 10), false);
  assert.equal(K.callFor(full, W), null);
});

test('someone to pick up: alongside slowly, in a boat with a seat; their weight aboard; home, paid there, once', () => {
  const C = rec(2), W = world({ abs: 9, callSpot: { x: 200, z: 300, where: 'off Cove Head' } });
  const a = K.acceptCall(C, K.callFor(C, W, () => 0), 0);
  assert.equal(a.obj.what, 'person');
  assert.deepEqual(K.target(a), { x: 200, z: 300, name: a.title });
  // Racing past: no. In the kayak: no room, said once.
  K.tick(C, at({ x: 202, z: 301, boat: 'skiff', speed: 4 }));
  assert.equal(a.progress.picked, false);
  const r = K.tick(C, at({ x: 202, z: 301, boat: 'kayak', speed: 0.3 }));
  assert.match(r.said[0].text, /no room/);
  assert.equal(K.tick(C, at({ x: 202, z: 301, boat: 'kayak', speed: 0.3 })).said.length, 0);
  // Alongside in the skiff, slowly: aboard, 80 kg.
  assert.equal(K.tick(C, at({ x: 204, z: 296, boat: 'skiff', speed: 0.6 })).boarded.length, 1);
  assert.equal(K.aboardKg(C, 'skiff'), 80);
  assert.equal(K.target(a).home, true);
  // Home: done and paid on the spot, once; the weight gone.
  const d = K.tick(C, at({ home: true, boat: 'skiff', speed: 0 }));
  assert.equal(d.done.length, 1);
  assert.ok(a.onSpot);
  assert.equal(K.aboardKg(C, 'skiff'), 0);
  assert.equal(K.claim(C, a.id, 4).pay, 20);
  assert.equal(K.claim(C, a.id, 4), null);
});

test('a buoy adrift: aboard in a boat that takes its weight; given up with nothing left aboard', () => {
  const C = rec(2), W = world({ abs: 9, callSpot: { x: -50, z: 120, where: 'in the bay' } });
  const a = K.acceptCall(C, K.callFor(C, W, () => 0.9), 0);
  assert.equal(a.obj.what, 'buoy');
  assert.match(K.tick(C, at({ x: -50, z: 121, boat: 'kayak', speed: 0 })).said[0].text, /30 kg/);
  K.tick(C, at({ x: -50, z: 121, boat: 'row', speed: 0 }));
  assert.equal(K.aboardKg(C, 'row'), 40);
  assert.ok(K.abandon(C, a.id));
  assert.equal(K.aboardKg(C, 'row'), 0);
  assert.equal(C.active.length, 0);
  // and the radio carries on
  C.callAt = 0;
  assert.equal(K.callDue(C, 50), true);
});

test('the Gannet Isle expedition: a Skipper’s, in stages, each done for real, paid once', () => {
  // Not offered to a Boatman.
  for (let d = 0; d < 80; d++) assert.ok(!K.offers(rec(3), world({ day: d })).some((o) => o.tpl === 'gannetkit'));
  const { C, a } = take('gannetkit', 8);
  const S = a.obj.stages;
  assert.deepEqual(S.map((s) => s.kind), ['load', 'deliver', 'visit', 'visit', 'home']);
  assert.match(K.standing(a), /Stage 1 of 5: load 300 kg/);
  // 300 kg won't go in the skiff; it goes in the centre console, and weighs in her.
  assert.match(K.tick(C, at({ home: true, boat: 'skiff', speed: 0 })).said[0].text, /200 kg/);
  assert.equal(K.tick(C, at({ home: true, boat: 'console', speed: 0 })).stepped.length, 1);
  assert.equal(K.aboardKg(C, 'console'), 300);
  // Puffin Cove in another boat: no. In her: landed, and the weight's off.
  K.tick(C, at({ at: 'puffin', boat: 'rib' }));
  assert.equal(a.progress.stage, 1);
  K.tick(C, at({ at: 'puffin', boat: 'console' }));
  assert.equal(a.progress.stage, 2);
  assert.equal(K.aboardKg(C, 'console'), 0);
  // Round the light (within 150 m), then the Hound, with the finder on (off, it doesn't count).
  K.tick(C, at({ x: PL.light.x + 120, z: PL.light.z, boat: 'console', speed: 5 }));
  assert.equal(a.progress.stage, 3);
  K.tick(C, at({ x: PL.hound.x, z: PL.hound.z, boat: 'console', sonar: false }));
  assert.equal(a.progress.stage, 3, 'the finder off: no sounding');
  // (half way, saved and loaded: it carries on where it was)
  const back = K.cleanContracts(JSON.parse(JSON.stringify(C)));
  assert.equal(back.active[0].progress.stage, 3);
  K.tick(C, at({ x: PL.hound.x + 10, z: PL.hound.z, boat: 'console', sonar: true }));
  assert.equal(a.progress.stage, 4);
  assert.equal(K.target(a).home, true);
  const r = K.tick(C, at({ home: true, boat: 'console', speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.equal(K.claim(C, a.id, 4).pay, 140);
  assert.equal(K.claim(C, a.id, 4), null);
  // Not in a gale, nor with one forecast.
  for (let d = 0; d < 80; d++) assert.ok(!K.offers(rec(9), world({ day: d, forecastStorm: true })).some((o) => o.tpl === 'gannetkit'));
});
