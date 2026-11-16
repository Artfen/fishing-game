// G2c of docs/PROGRESSION.md: passengers and freight from Puerto Brasa (src/contracts.js, the
// island's charters on the slate at Bar El Muelle): divers and visitors aboard at Puerto Brasa and
// back to it, a drifting buoy brought in there, and the cofradía's salt fish loaded there and
// carried across to Willowhaven; offered only for a boat of yours on the island; paid at the slate
// (or on the spot, for freight and the buoy). And Willowhaven's dive club no longer sends you to
// the island's reefs. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as K from '../src/contracts.js';

const SPL = {
  puerto: { x: 0, z: 6300, name: 'Puerto Brasa' }, veril: { x: 120, z: 6600, name: 'El Veril' }, sebadal: { x: 300, z: 6200, name: 'El Sebadal' },
  coladas: { x: -480, z: 5640, name: 'Las Coladas' }, bajon: { x: 60, z: 6250, name: 'El Bajón' }, haven: { x: 0, z: 0, name: 'Willowhaven' },
};
const DIVES = [{ id: 'bajon', name: 'El Bajón', x: -100, z: 6432, noAnchor: 'the reef’s a marine reserve' }, { id: 'arcos', name: 'Los Arcos', x: -440, z: 6537, noAnchor: null }];
// The slate's world: the boats of yours on the island are what it can offer for (usable and kinds
// alike: there's none to hire there).
const south = (here, over = {}) => ({
  day: 4, region: 'south', busy: [], whales: [], dolphins: false, birds: false, storm: false, forecastStorm: false, wind: 5, summer: true,
  canCross: true, beenSouth: true, places: SPL, usable: here, kinds: here, diveSites: DIVES, diveUnfound: [], ...over,
});
const ISLAND = ['buceo', 'avistamiento', 'boya', 'salazon'];
const skipper = () => Object.assign(K.newContracts(), { count: 10 });
const seenOn = (here, over = {}, C = skipper) => {
  const seen = new Map();
  for (let d = 0; d < 120; d++) for (const o of K.offers(C(), south(here, { day: d, ...over }))) if (ISLAND.includes(o.tpl)) seen.set(o.tpl, o);
  return seen;
};
function take(tpl, here = ['cruiser'], pick = () => true) {
  for (let d = 0; d < 400; d++) {
    const C = skipper();
    const o = K.offers(C, south(here, { day: d })).find((x) => x.tpl === tpl && pick(x));
    if (o) return { C, a: K.accept(C, o.id, 0).contract };
  }
  throw new Error(`no ${tpl}`);
}
const at = (o = {}) => ({ x: 0, z: 0, now: 0, abs: 0, home: false, puerto: false, boat: 'cruiser', dt: 0.5, speed: 3, sea: 0.3, ...o });

test('the island’s charters and freight: on the slate only for a boat of yours there, never one to hire', () => {
  // With the yacht at the island: all four, each from Puerto Brasa, naming her.
  const all = seenOn(['cruiser']);
  assert.deepEqual([...all.keys()].sort(), [...ISLAND].sort());
  for (const o of all.values()) {
    assert.ok(K.TEMPLATES[o.tpl].south, o.tpl);
    assert.equal(o.obj.base, 'puerto', `${o.tpl}: from Puerto Brasa`);
    assert.match(o.boat, /your sport-fishing yacht will do/, o.tpl);
    assert.doesNotMatch(o.boat, /hire/, `${o.tpl}: nothing to hire on the island`);
  }
  assert.equal(K.GIVERS[all.get('buceo').giver], 'Buceo Las Brasas, the dive school');
  // No boat of yours at the island: none of them.
  assert.equal(seenOn([]).size, 0);
  // The sailing boat alone: no divers (no ladder, no room for tanks), but visitors, the buoy and the
  // salt fish, which she can carry across.
  const sail = seenOn(['sail']);
  assert.ok(!sail.has('buceo'), 'no divers in the sailing boat');
  for (const t of ['avistamiento', 'boya', 'salazon']) assert.ok(sail.has(t), `${t} in the sailing boat`);
  // A RIB shipped across: divers and visitors, but the salt fish only goes in a boat that makes
  // the crossing.
  const rib = seenOn(['rib']);
  assert.ok(rib.has('buceo') && !rib.has('salazon'));
  // Charters want a passenger ticket, as at home; the buoy doesn't.
  const hand = seenOn(['cruiser'], {}, () => K.newContracts());
  assert.ok(!hand.has('buceo') && !hand.has('avistamiento') && hand.has('boya'));
  // In a gale, none of it; and the salt fish waits for a clear forecast.
  assert.equal(seenOn(['cruiser'], { storm: true, wind: 18 }).size, 0);
  assert.ok(!seenOn(['cruiser'], { forecastStorm: true }).has('salazon'));
  // On the home board, never.
  for (let d = 0; d < 60; d++) {
    const home = K.offers(skipper(), { ...south(['cruiser'], { day: d }), region: 'home' });
    assert.ok(!home.some((o) => ISLAND.includes(o.tpl)), `day ${d}`);
  }
});

test('divers aboard at Puerto Brasa, the dive, and back to Puerto Brasa: not Willowhaven', () => {
  const { C, a } = take('buceo', ['cruiser'], (o) => !o.obj.dive.noAnchor);
  const D = a.obj.dive;
  // Where to go, and what's waiting: Puerto Brasa.
  assert.deepEqual({ home: K.target(a).home, base: K.target(a).base }, { home: true, base: 'puerto' });
  assert.match(K.target(a).name, /pick them up at Puerto Brasa/);
  assert.match(K.standing(a), /waiting at Puerto Brasa/);
  // Stopped in Willowhaven's harbour: nobody there to board.
  assert.equal(K.tick(C, at({ home: true, speed: 0 })).boarded.length, 0);
  // In the kayak at Puerto Brasa: they won't fit, and say so once.
  let r = K.tick(C, at({ puerto: true, boat: 'kayak', speed: 0 }));
  assert.equal(r.boarded.length, 0);
  assert.equal(r.said.length, 1);
  // In the yacht at Puerto Brasa: aboard.
  r = K.tick(C, at({ puerto: true, speed: 0 }));
  assert.equal(r.boarded.length, 1);
  assert.equal(a.progress.boat, 'cruiser');
  // Kept through a save as the island's job, aboard at Puerto Brasa.
  const back = K.cleanContracts(JSON.parse(JSON.stringify(C)));
  assert.equal(back.active[0].obj.base, 'puerto');
  assert.equal(back.active[0].progress.aboard, true);
  // On the site, stopped, while they're down.
  for (let i = 0; i < D.stay * 2 + 2; i++) r = K.tick(C, at({ x: D.x, z: D.z, speed: 0.2 }));
  assert.ok(a.progress.seen);
  assert.match(K.standing(a), /back to Puerto Brasa/);
  assert.equal(K.target(a).base, 'puerto');
  // Back at Willowhaven: not done (it's the island's job).
  assert.equal(K.tick(C, at({ home: true, speed: 0 })).done.length, 0);
  // Back at Puerto Brasa: done, to be paid at the slate.
  r = K.tick(C, at({ puerto: true, speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.ok(a.ready && !a.onSpot);
  assert.equal(K.paidAt(a), 'Paco’s slate at Bar El Muelle');
  assert.match(K.standing(a), /back to Paco’s slate at Bar El Muelle to be paid/);
  assert.equal(K.claim(C, a.id, 4).pay, a.pay);
  assert.equal(K.standingWith(C, 'buceo').n, a.rep);
  assert.equal(K.cleanContracts(JSON.parse(JSON.stringify(C))).rep.buceo, a.rep, 'the dive school’s standing, saved');
});

test('visitors out of Puerto Brasa to see the sperm whale or the dolphins, and back there', () => {
  for (const see of ['whale', 'dolphins']) {
    const { C, a } = take('avistamiento', ['cruiser'], (o) => o.obj.see === see);
    assert.equal(a.coop, true);
    K.tick(C, at({ puerto: true, speed: 0 }));
    assert.ok(a.progress.aboard);
    // Out there: a whale up at a distance, or dolphins on the bow.
    K.tick(C, at(see === 'whale' ? { whale: 600 } : { bow: false }));
    assert.ok(!a.progress.seen);
    const r = K.tick(C, at(see === 'whale' ? { whale: 180 } : { bow: true }));
    assert.equal(r.seen.length, 1);
    assert.equal(K.tick(C, at({ home: true, speed: 0 })).done.length, 0);
    assert.equal(K.tick(C, at({ puerto: true, speed: 0 })).done.length, 1);
  }
});

test('the drifting buoy: hauled aboard out there, paid as it comes into Puerto Brasa', () => {
  const { C, a } = take('boya');
  assert.equal(a.obj.what, 'buoy');
  // Alongside, slowly: aboard.
  let r = K.tick(C, at({ x: a.obj.at.x + 3, z: a.obj.at.z, speed: 0.5 }));
  assert.equal(r.boarded.length, 1);
  assert.equal(K.target(a).base, 'puerto');
  assert.match(K.standing(a), /into Puerto Brasa/);
  // Into Willowhaven: no; into Puerto Brasa in the same boat: paid there and then.
  assert.equal(K.tick(C, at({ home: true, speed: 0 })).done.length, 0);
  assert.equal(K.tick(C, at({ puerto: true, speed: 0, boat: 'rib' })).done.length, 0, 'not in another boat');
  r = K.tick(C, at({ puerto: true, speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.ok(a.onSpot);
});

test('the cofradía’s salt fish: loaded at Puerto Brasa, carried across, paid at Willowhaven', () => {
  const { C, a } = take('salazon', ['sail', 'cruiser']);
  assert.ok([120, 180, 240].includes(a.obj.cargo));
  assert.match(a.boat, /your sailing boat will do/, 'the smaller of the two that make the crossing');
  assert.match(K.target(a).name, /load at Puerto Brasa/);
  assert.match(K.standing(a), /waiting on Puerto Brasa quay/);
  // Not at Willowhaven: it's on the island's quay.
  assert.equal(K.tick(C, at({ home: true, speed: 0 })).boarded.length, 0);
  // At Puerto Brasa in a boat that can't take it: says so once.
  let r = K.tick(C, at({ puerto: true, speed: 0, boat: 'kayak' }));
  assert.equal(r.said.length, 1);
  // In the yacht: loaded, and its weight is in her.
  r = K.tick(C, at({ puerto: true, speed: 0 }));
  assert.equal(r.boarded.length, 1);
  assert.equal(K.aboardKg(C, 'cruiser'), a.obj.cargo);
  assert.equal(K.target(a).base, 'home');
  assert.match(K.target(a).name, /into Willowhaven/);
  // Not done back at Puerto Brasa, nor at Wend Quay: at Willowhaven, in her, paid on the spot.
  assert.equal(K.tick(C, at({ puerto: true, speed: 0 })).done.length, 0);
  assert.equal(K.tick(C, at({ at: 'quay', speed: 0 })).done.length, 0);
  r = K.tick(C, at({ home: true, speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.ok(a.onSpot);
  assert.equal(K.aboardKg(C, 'cruiser'), 0);
});

test('Willowhaven’s jobs still start and end at Willowhaven, and are paid at its board', () => {
  const C = Object.assign(K.newContracts(), { count: 20 });
  const W = { day: 3, region: 'home', busy: [], dolphins: true, whales: [{ kind: 'finwhale', name: 'Fin whale', where: 'out', at: { x: 400, z: 1500 } }], birds: true, storm: false, forecastStorm: false, wind: 5, summer: true, canCross: true, places: SPL, surveyLines: [], tempMarks: [], courses: [], diveSites: [{ id: 'reef', name: 'Skerries Reef', x: -128, z: 378, noAnchor: null }], usable: ['rib'], kinds: ['rib'] };
  let a = null;
  for (let d = 0; d < 200 && !a; d++) {
    const o = K.offers(C, { ...W, day: d }).find((x) => x.tpl === 'whalewatch');
    if (o) a = K.accept(C, o.id, 0).contract;
  }
  assert.ok(a && !a.obj.base);
  assert.equal(K.target(a).base, 'home');
  assert.match(K.standing(a), /waiting at Willowhaven/);
  assert.equal(K.tick(C, at({ puerto: true, boat: 'rib', speed: 0 })).boarded.length, 0, 'not at Puerto Brasa');
  assert.equal(K.tick(C, at({ home: true, boat: 'rib', speed: 0 })).boarded.length, 1);
  assert.equal(K.paidAt(a), 'the notice board at Willowhaven');
});

test('the game: Puerto Brasa’s harbour for the jobs, the boats on the island for the slate, and Willowhaven’s dive club at home', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  // Afloat and stopped in Puerto Brasa's harbour, beside Willowhaven's.
  assert.match(src, /const puerto = afloat && boat\.speed < 0\.8 && Math\.hypot\(P\.x - PUERTO_AT\.x, P\.z - PUERTO_AT\.z\) < 75;/);
  assert.match(src, /home, puerto, boat: afloat \? boat\.id : null/);
  // The slate's world: the boats of yours on the island, in the water, and nothing to hire; the
  // island's dive sites.
  const sw = src.slice(src.indexOf('function southWorld()'), src.indexOf('function renderSlate('));
  assert.match(sw, /regionOf\(BOATS\[id\]\) === 'south'/);
  assert.match(sw, /!isStored\(id\)/);
  assert.match(sw, /usable: here, kinds: here/);
  assert.match(sw, /diveSites: SOUTH_DIVES/);
  // Willowhaven's board: its own dive sites, not the island's.
  assert.match(src, /diveSites: PLACES\.filter\(\(p\) => p\.dive && !p\.south\)/);
  // The map's mark for the job's harbour, and its words.
  assert.match(src, /at\.base === 'puerto' \? 'puerto' : 'haven'/);
  assert.match(src, /Back to \$\{Con\.paidAt\(a\)\} to be paid\./);
  assert.match(src, /a\.obj\.base === 'puerto' \? 'Back to Puerto Brasa\.' : 'Home to Willowhaven\.'/);
});
