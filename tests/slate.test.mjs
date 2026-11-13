// G2b of docs/PROGRESSION.md: the slate behind Paco's bar at Bar El Muelle (src/contracts.js, the
// south's templates; src/harbourView.js renderSlate): the island's own work, Paco's and the
// fishermen's of Puerto Brasa, offered there and only there, done the way the home board's are,
// paid with the standing you have with them. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/contracts.js';
import { BOAT_KINDS } from '../src/boat.js';

const SPL = {
  puerto: { x: 0, z: 6300, name: 'Puerto Brasa' }, veril: { x: 120, z: 6600, name: 'El Veril' }, sebadal: { x: 300, z: 6200, name: 'El Sebadal' },
  coladas: { x: -480, z: 5640, name: 'Las Coladas' }, bajon: { x: 60, z: 6250, name: 'El Bajón' },
};
const south = (over = {}) => ({
  day: 4, region: 'south', busy: [], whales: [], dolphins: false, birds: false, storm: false, forecastStorm: false, wind: 5, summer: true,
  canCross: true, beenSouth: true, places: SPL, usable: ['row', 'skiff', 'kayak', 'cruiser'], kinds: BOAT_KINDS, diveUnfound: [], ...over,
});
const SOUTH = K.TEMPLATE_IDS.filter((t) => K.TEMPLATES[t].south);
const take = (tpl, C = Object.assign(K.newContracts(), { count: 10 })) => {
  for (let d = 0; d < 200; d++) {
    const o = K.offers(C, south({ day: d })).find((x) => x.tpl === tpl);
    if (o) return { C, a: K.accept(C, o.id, 0).contract };
  }
  throw new Error(`${tpl} never offered`);
};

test('the slate: the island’s work, Paco’s and the fishermen’s, and only there', () => {
  assert.deepEqual(SOUTH.sort(), ['angelote', 'cachalote', 'medregal', 'sondaveril', 'vieja']);
  assert.equal(K.GIVERS.cofradia, 'The fishermen of Puerto Brasa');
  for (const t of SOUTH) assert.ok(['paco', 'cofradia'].includes(K.TEMPLATES[t].giver), t);
  // Over a month of days, every one of them turns up on the slate, and nothing else does.
  const seen = new Set();
  for (let d = 0; d < 30; d++) {
    const offers = K.offers(K.newContracts(), south({ day: d }));
    assert.ok(offers.length >= 1 && offers.length <= 6, `day ${d}: ${offers.length}`);
    for (const o of offers) {
      assert.ok(K.TEMPLATES[o.tpl].south, `day ${d}: ${o.tpl} on the slate`);
      seen.add(o.tpl);
    }
  }
  assert.deepEqual([...seen].sort(), SOUTH);
  // In a gale, no amberjack fishing out at the drop-off, nor sounding it, nor whale-watching.
  for (let d = 0; d < 30; d++) {
    const list = K.offers(K.newContracts(), south({ day: d, storm: true })).map((o) => o.tpl);
    for (const t of ['medregal', 'sondaveril', 'cachalote']) assert.ok(!list.includes(t), `day ${d}: no ${t} in a gale`);
  }
  // The home board and the slate keep their own day's offers (each made afresh as you come to it).
  const C = K.newContracts();
  const a = K.offers(C, south({ day: 7 })).map((o) => o.id);
  K.offers(C, { ...south({ day: 7 }), region: 'home' });
  assert.deepEqual(K.offers(C, south({ day: 7 })).map((o) => o.id), a);
});

test('the island’s jobs, done as the board’s are: a vieja for the grill, an amberjack, El Veril sounded, the whale and the angel shark photographed', () => {
  // A parrotfish big enough: Paco's vieja. Too small, or another fish: not yet.
  let { C, a } = take('vieja');
  assert.equal(a.obj.sp, 'parrotfish');
  K.caught(C, { sp: 'parrotfish', size: a.obj.min - 2, sea: true, phase: 'kept' });
  K.caught(C, { sp: 'triggerfish', size: 40, sea: true, phase: 'kept' });
  assert.equal(a.ready, false);
  assert.equal(K.caught(C, { sp: 'parrotfish', size: a.obj.min + 1, sea: true, phase: 'kept' }).length, 1);
  assert.ok(a.ready);
  const paid = K.claim(C, a.id, 4);
  assert.equal(paid.pay, a.pay);
  assert.equal(K.standingWith(C, 'paco').id, 'new');
  // The amberjack.
  ({ C, a } = take('medregal'));
  assert.equal(K.caught(C, { sp: 'amberjack', size: a.obj.min, sea: true, phase: 'kept' }).length, 1);
  // El Veril sounded: over its edge, the finder on (not without it).
  ({ C, a } = take('sondaveril'));
  const at = (o) => ({ x: 0, z: 0, now: 0, abs: 0, home: false, boat: 'cruiser', dt: 0.5, speed: 2, sea: 0.3, ...o });
  K.tick(C, at({ x: SPL.veril.x + 20, z: SPL.veril.z, sonar: false }));
  assert.equal(a.ready, false);
  K.tick(C, at({ x: SPL.veril.x + 20, z: SPL.veril.z, sonar: true }));
  assert.ok(a.ready);
  // The sperm whale's photograph, and the angel shark's.
  ({ C, a } = take('cachalote'));
  assert.equal(K.photographed(C, { life: ['finwhale'] }).length, 0);
  assert.equal(K.photographed(C, { life: ['spermwhale'] }).length, 1);
  ({ C, a } = take('angelote'));
  assert.equal(K.photographed(C, { species: ['parrotfish'] }).length, 0);
  assert.equal(K.photographed(C, { species: ['angelshark'] }).length, 1);
});

test('standing with the fishermen of Puerto Brasa, as with anyone: their work pays more as they know you', () => {
  const C = Object.assign(K.newContracts(), { count: 10, rep: { cofradia: 8 } });
  assert.equal(K.standingWith(C, 'cofradia').id, 'trusted');
  // A trusting giver's work first on the slate too.
  for (let d = 0; d < 20; d++) {
    const offers = K.offers(Object.assign(K.newContracts(), { count: 10, rep: { cofradia: 8 } }), south({ day: d }));
    if (offers.some((o) => o.giver === 'cofradia')) assert.equal(offers[0].giver, 'cofradia', `day ${d}`);
  }
  const { a } = take('sondaveril', C);
  a.ready = true;
  a.onSpot = false;
  const r = K.claim(C, a.id, 4);
  assert.equal(r.pay, Math.round(a.pay * 1.2));
  // Saved with the rest.
  const back = K.cleanContracts(JSON.parse(JSON.stringify(C)));
  assert.equal(back.rep.cofradia, C.rep.cofradia);
});
