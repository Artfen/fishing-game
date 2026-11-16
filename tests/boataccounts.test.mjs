// G8b2, boats of her own: each boat's accounts kept by her id (src/boatid.js): her fuel and
// batteries, her lockers, her fish box, what's on her deck, her papers and registration, her
// paint, name, fittings and engine at the Marine Works. A second boat of a kind ('rib~2') keeps her
// own, apart from the first ('rib'), and every save from before keeps its ids as they were. Run
// with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const B = await import('../src/boatid.js');
const Fu = await import('../src/fuel.js');
const St = await import('../src/stores.js');
const Fb = await import('../src/fishbox.js');
const Ca = await import('../src/cargo.js');
const Pa = await import('../src/papers.js');
const Sy = await import('../src/shipyard.js');
const Ve = await import('../src/vessels.js');

const KINDS = ['row', 'skiff', 'kayak', 'bass', 'cabin', 'sail', 'cruiser', 'console', 'windsurf', 'jetski', 'rib'];

test('an id says which boat she is and what sort of boat she is', () => {
  assert.equal(B.kindOf('rib'), 'rib');
  assert.equal(B.kindOf('rib~2'), 'rib');
  assert.equal(B.idFor('rib'), 'rib', 'the first of a kind: her kind');
  assert.equal(B.idFor('rib', 2), 'rib~2');
  assert.equal(B.nthOf('rib'), 1);
  assert.equal(B.nthOf('rib~3'), 3);
  for (const ok of ['rib', 'rib~2', 'cruiser~9']) assert.ok(B.isBoatId(ok, KINDS), ok);
  for (const bad of ['rib~1', 'rib~10', 'rib~x', 'nonesuch~2', 'RIB', 'r', '', 42, null, 'boat:rib']) assert.ok(!B.isBoatId(bad, KINDS), String(bad));
});

test('her fuel and batteries her own: a second RIB\'s tank apart from the first, the same size', () => {
  const f = Fu.cleanFuel({ boats: { rib: 40, 'rib~2': 120, 'nonesuch~2': 9, 'rib~x': 3 }, troll: { 'rib~2': 0.4 }, elec: { 'skiff~2': 0.5 }, can: { at: 'boat:rib~2', litres: 6 } });
  assert.equal(f.boats.rib, 40);
  assert.equal(f.boats['rib~2'], 120, 'kept, by her id');
  assert.ok(!('nonesuch~2' in f.boats) && !('rib~x' in f.boats), 'nonsense dropped');
  assert.equal(f.troll['rib~2'], 0.4);
  assert.equal(f.elec['skiff~2'], 0.5);
  assert.equal(f.can.at, 'boat:rib~2', 'the jerry can aboard her');
  assert.ok(Fu.isPetrol('rib~2'));
  assert.equal(Fu.room(f, 'rib~2'), Fu.TANKS.rib - 120, 'her tank the RIB\'s size');
  Fu.addFuel(f, 'rib~2', 1000);
  assert.equal(f.boats['rib~2'], Fu.TANKS.rib, 'filled to the RIB\'s tank');
  assert.equal(f.boats.rib, 40, 'the first RIB\'s untouched');
  Fu.burnBoat(f, 'rib~2', 1, 60);
  assert.ok(f.boats['rib~2'] < Fu.TANKS.rib && f.boats.rib === 40, 'running her burns hers');
  assert.match(Fu.tankWords(f, 'rib~2'), new RegExp(`of ${Fu.TANKS.rib} L$`));
  // (A save from before: the same as ever.)
  assert.deepEqual(Fu.cleanFuel({ boats: { rib: 40 } }).boats, { ...Fu.defaultFuel().boats, rib: 40 });
});

test('her lockers, her fish box and her deck her own', () => {
  const state = { stores: St.cleanStores({ cruiser: 2, 'cruiser~2': 5, 'row~2': 1 }), fishbox: Fb.cleanFishbox({ rib: 50, 'rib~2': 90, 'row~2': 9 }), cargo: Ca.newCargo() };
  assert.equal(state.stores['cruiser~2'], 5);
  assert.ok(!('row~2' in state.stores), 'no lockers in a rowing boat');
  assert.equal(St.storesAboard(state, 'cruiser~2').most, St.GALLEY.cruiser, 'a yacht\'s lockers');
  St.draw(state, 'cruiser~2', 1);
  assert.equal(state.stores['cruiser~2'], 4);
  assert.equal(state.stores.cruiser, 2, 'the first yacht\'s untouched');
  assert.ok(Fb.hasBox('rib~2'));
  assert.equal(Fb.boxIceUntil(state, 'rib~2'), 90);
  assert.ok(!('row~2' in state.fishbox));
  Fb.iceBox(state, 'rib~2', 100);
  assert.equal(state.fishbox.rib, 50, 'the first RIB\'s box untouched');
  assert.match(Fb.boxWords(state, 'rib~2', 100), /cool box/);
  // Her deck.
  const c = state.cargo, a = Ca.buy(c, 'stores').item, b = Ca.buy(c, 'case').item;
  Ca.putAboard(c, a.uid, 'rib~2', { x: 0, z: -1 });
  Ca.putAboard(c, b.uid, 'rib', { x: 0, z: -1 });
  assert.deepEqual(Ca.aboard(c, 'rib~2').map((it) => it.uid), [a.uid]);
  assert.deepEqual(Ca.aboard(c, 'rib').map((it) => it.uid), [b.uid]);
  const again = Ca.cleanCargo(JSON.parse(JSON.stringify(c)), KINDS);
  assert.equal(again.items.find((it) => it.uid === a.uid).at, 'boat:rib~2', 'kept aboard her through a save');
  assert.equal(Ca.cleanCargo({ items: [{ ...a, at: 'boat:nonesuch~2' }] }, KINDS).items[0].at, 'ashore', 'no such boat: ashore');
});

test('her papers, paint, name, fittings and engine her own at the Marine Works', () => {
  assert.equal(Pa.regOf('rib'), 'WH 171', 'the first RIB\'s registration as ever');
  assert.equal(Pa.regOf('rib~2'), 'WH 171-2', 'a second of her own');
  const Y = Sy.cleanYard({
    owned: ['row', 'skiff', 'kayak', 'rib', 'rib~2', 'rib~x'],
    looks: { 'rib~2': { name: 'Second Wind', paint: Sy.PAINTS[0].id }, 'nonesuch~2': { name: 'Nobody' } },
    fits: { 'rib~2': ['vhf', 'nonsense'], rib: ['sonar'] },
    engines: { 'rib~2': { model: 'nonsense' } },
  }, KINDS, false, 5);
  assert.deepEqual(Y.owned, ['row', 'skiff', 'kayak', 'rib', 'rib~2']);
  assert.equal(Y.looks['rib~2'].name, 'Second Wind');
  assert.ok(!('nonesuch~2' in Y.looks));
  assert.deepEqual(Y.fits['rib~2'], ['vhf'], 'what fits a RIB, on her');
  assert.equal(Y.vessels['rib~2'].reg, 'WH 171-2', 'her papers made out');
  assert.equal(Y.vessels.rib.reg, 'WH 171');
  assert.ok(Sy.fitEffect(Y, 'rib~2').vhf && !Sy.fitEffect(Y, 'rib~2').sonar, 'her fittings, not the first RIB\'s');
  assert.ok(Sy.fitEffect(Y, 'rib').sonar && !Sy.fitEffect(Y, 'rib').vhf);
  assert.deepEqual(Sy.engineOf(Y, 'rib~2'), Sy.engineOf({}, 'rib'), 'the engine a RIB comes with');
  assert.deepEqual(Sy.fitsFor('rib~2'), Sy.fitsFor('rib'), 'offered what a RIB is');
  // Fitting her out: a RIB's price, on her alone.
  const state = { yard: Y, money: 5000, ledger: [], day: 5 };
  const before = state.money, r = Sy.fitBoat(state, 'rib~2', 'plotter');
  assert.ok(r.ok, r.why);
  assert.equal(before - state.money, Sy.FITS.plotter.price.rib);
  assert.ok(Y.fits['rib~2'].includes('plotter') && !Y.fits.rib.includes('plotter'));
  // (What she is: a RIB.)
  assert.equal(Ve.hullOf('rib~2'), Ve.hullOf('rib'));
});

test('the game hands each boat\'s accounts her id', () => {
  // (A guard on src/main.js: fuel, lockers, fish box, deck, papers and fittings are asked for by
  // her id, not her kind.)
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  for (const [what, re] of [
    ['her fuel', /fuelLevel\((tanks\(\)|f), [a-zA-Z]+\.kind\)/],
    ['her batteries', /(elecLevel|chargeElec|burnElec)\([^)]*?, [a-zA-Z]+\.kind\b/],
    ['her burn', /burnBoat\(f, [a-zA-Z]+\.kind/],
    ['her lockers', /(drawStores|storesAboard|stockUp|storesFor)\(state, [a-zA-Z]+\.kind/],
    ['her fish box', /(boxHoursLeft|boxWords|iceBox)\(state, [a-zA-Z]+\.kind/],
    ['her deck', /syncCargo\([a-zA-Z]+\.kind\)|`boat:\$\{[a-zA-Z]+\.kind\}`/],
    ['her papers', /state\.yard\.vessels\??\.?\[[a-zA-Z]+\.kind\]|vesselLog\([a-zA-Z]+\.kind/],
    ['her fittings', /fitEffect\(state\.yard, [a-zA-Z]+\.kind\)/],
    ['her ownership', /ownsBoat\(state\.yard, [a-zA-Z]+\.kind\)/],
    ['the jobs, the boat she is', /boat: (afloat|!onFoot && !driving) \? boat\.kind/],
  ]) assert.doesNotMatch(src, re, what);
});
