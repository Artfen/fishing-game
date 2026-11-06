// What each boat is for (src/vessels.js), and the work that wants the bigger ones (charters and
// freight in src/contracts.js): a boat takes only the people and freight she has room for (eight
// passengers won't go in a RIB, divers won't go in a boat with no ladder, a ton of timber only in the
// yacht); what she carries is real weight in her, and only while it's aboard; passengers want what
// they came for, in the boat they boarded, and home again; a protected reef wants no anchor down;
// a rough trip in an open boat costs the tip; paid once; given up safely, mid-trip, with nothing
// left aboard; and every boat has somewhere for each of the people she's rated to carry to sit.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as K from '../src/contracts.js';
import { VESSELS, fits, smallestFor, misery, KG_PER_PERSON } from '../src/vessels.js';
import { HULLS, BOAT_KINDS } from '../src/boat.js';
import { seatsFor } from '../src/passengers.js';
import { sanitize } from '../src/save.js';

const PL = { quay: { x: 520, z: -170, name: 'Wend Quay' }, puerto: { x: 0, z: 6300, name: 'Puerto Brasa' }, stream: { x: 0, z: 0, name: 'Fernbeck' }, puffin: { x: -300, z: 900, name: 'Puffin Cove' } };
const marks = [{ x: 0, z: 100, name: 'A' }];
const SITES = [{ id: 'reef', name: 'Skerries Reef', x: -128, z: 378, noAnchor: 'a protected reef' }, { id: 'sands', name: 'Anchor Sands', x: 372, z: 604, noAnchor: null }];
const world = (over = {}) => ({
  day: 3, region: 'home', busy: [], dolphins: true, whales: [{ kind: 'finwhale', name: 'Fin whale', where: 'out past Gannet Isle', at: { x: 400, z: 1500 } }],
  birds: true, storm: false, forecastStorm: false, wind: 5, summer: true, canCross: true, places: PL,
  surveyLines: [{ name: 'x', marks }], tempMarks: marks, courses: [{ name: 'x', marks, minutes: 8 }],
  diveSites: SITES, usable: ['row', 'skiff', 'kayak'], kinds: BOAT_KINDS, ...over,
});
// A record with a career behind it (a Master: every charter's offered).
const master = (count = 20) => Object.assign(K.newContracts(), { count });
// A contract of template `tpl` taken (making offers until one turns up).
function take(tpl, over = {}, pick = () => true) {
  for (let d = 0; d < 400; d++) {
    const C = master();
    const o = K.offers(C, world({ day: d, ...over })).find((x) => x.tpl === tpl && pick(x));
    if (o) return { C, a: K.accept(C, o.id).contract };
  }
  throw new Error(`no ${tpl}`);
}
// Out there: the world as tick reads it, half a second at a time.
const at = (o = {}) => ({ x: 0, z: 0, now: 0, abs: 0, home: false, boat: 'rib', dt: 0.5, speed: 3, sea: 0.3, ...o });

test('each boat takes only what she has room for, and an impossible load is refused', () => {
  assert.equal(fits('rib', { pax: 5 }), null);
  assert.match(fits('rib', { pax: 8 }), /seats 5/);
  assert.equal(fits('cruiser', { pax: 8 }), null);
  assert.match(fits('kayak', { pax: 1 }), /nobody/);
  assert.match(fits('cabin', { pax: 2, divers: true }), /divers/, 'no ladder or room for tanks in the cabin boat');
  assert.equal(fits('rib', { pax: 4, divers: true }), null);
  assert.match(fits('skiff', { cargo: 450 }), /200 kg/);
  assert.equal(smallestFor({ cargo: 1200 }), 'cruiser', 'a ton of timber: only the yacht');
  assert.equal(smallestFor({ pax: 2 }), 'skiff');
  assert.equal(smallestFor({ pax: 9 }), null, 'nine passengers: no boat in the game');
  // Rough water: an open boat's passengers mind it before a sheltered one's.
  assert.ok(misery('rib', 1.8) > 0.5 && misery('cruiser', 1.8) === 0);
  assert.equal(misery('skiff', 0.3), 0);
  // Every boat's numbers are there and sensible.
  for (const k of BOAT_KINDS) {
    const V = VESSELS[k];
    assert.ok(V, `${k} has a purpose`);
    assert.ok(V.seats >= 0 && V.cargo >= 0 && V.comfort > 0 && V.name === HULLS[k].name, `${k}'s numbers`);
  }
});

test('charter offers name a boat you have, or one to hire, and never one that can’t do it', () => {
  const seen = new Map();
  for (let d = 0; d < 120; d++) for (const o of K.offers(master(), world({ day: d }))) if (o.cat === 'charter' || o.tpl === 'freight') seen.set(o.tpl, o);
  for (const t of ['whalewatch', 'dolphintrip', 'divecharter', 'fishcharter', 'freight']) assert.ok(seen.has(t), `${t} turns up`);
  for (let d = 0; d < 120; d++) {
    for (const o of K.offers(master(), world({ day: d }))) {
      if (o.obj.kind !== 'charter' && !o.obj.cargo) continue;
      const need = { pax: o.obj.pax || 0, cargo: o.obj.cargo || 0, divers: !!o.obj.divers };
      const mine = smallestFor(need, ['row', 'skiff', 'kayak']);
      if (mine) assert.match(o.boat, new RegExp(`your ${VESSELS[mine].name}`));
      else assert.match(o.boat, /hire her for the day/);
      // (and what it names would really do)
      const named = Object.keys(VESSELS).find((k) => o.boat.includes(`${VESSELS[k].name} `) || o.boat.includes(`${VESSELS[k].name}:`) || o.boat.includes(`${VESSELS[k].name})`));
      assert.ok(named && !fits(named, need), `${o.title}: ${o.boat}`);
    }
  }
  // At the island, and in a gale, no charters.
  for (let d = 0; d < 40; d++) {
    assert.ok(!K.offers(master(), world({ day: d, region: 'south', beenSouth: true })).some((o) => o.cat === 'charter'));
    assert.ok(!K.offers(master(), world({ day: d, storm: true })).some((o) => o.cat === 'charter'));
  }
});

test('passengers board only a boat with room, at Willowhaven; their weight is in her while they’re aboard', () => {
  const { C, a } = take('whalewatch', {}, (o) => o.obj.pax === 8);
  // Out at sea in the RIB: nothing happens (they're waiting at Willowhaven).
  assert.equal(K.tick(C, at({ home: false, boat: 'rib' })).boarded.length, 0);
  // Home in the RIB: eight won't go in her, and it says so once.
  let r = K.tick(C, at({ home: true, boat: 'rib', speed: 0 }));
  assert.equal(r.boarded.length, 0);
  assert.equal(r.said.length, 1);
  assert.match(r.said[0].text, /seats 5/);
  assert.equal(K.tick(C, at({ home: true, boat: 'rib', speed: 0 })).said.length, 0, 'said once');
  assert.equal(a.progress.aboard, false);
  // In the yacht: aboard, and 640 kg of people in her (and in no other boat).
  r = K.tick(C, at({ home: true, boat: 'cruiser', speed: 0 }));
  assert.equal(r.boarded.length, 1);
  assert.equal(K.aboardKg(C, 'cruiser'), 8 * KG_PER_PERSON);
  assert.equal(K.aboardKg(C, 'rib'), 0);
  // A whale seen from the RIB doesn't count (they're in the yacht); from the yacht, it does.
  K.tick(C, at({ boat: 'rib', whale: 50 }));
  assert.equal(a.progress.seen, false);
  assert.equal(K.tick(C, at({ boat: 'cruiser', whale: 400 })).seen.length, 0, 'too far off to see');
  r = K.tick(C, at({ boat: 'cruiser', whale: 180 }));
  assert.equal(r.seen.length, 1);
  assert.match(K.standing(a), /home to Willowhaven/);
  assert.equal(a.ready, false, 'not done till they’re home');
  // Home: done, they step ashore, and the weight goes with them.
  r = K.tick(C, at({ home: true, boat: 'cruiser', speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.equal(K.aboardKg(C, 'cruiser'), 0);
  // Paid once, at the board; never twice.
  const p = K.claim(C, a.id, 3);
  assert.equal(p.pay, a.pay);
  assert.equal(K.claim(C, a.id, 3), null);
  assert.equal(C.active.length, 0);
});

test('before the trip, they move over to another boat at Willowhaven if she has the room', () => {
  const { C, a } = take('dolphintrip', {}, (o) => o.obj.pax === 2);
  K.tick(C, at({ home: true, boat: 'skiff', speed: 0 }));
  assert.equal(a.progress.boat, 'skiff');
  assert.equal(K.aboardKg(C, 'skiff'), 160);
  // (Into the jet ski? One seat: they stay in the skiff.)
  K.tick(C, at({ home: true, boat: 'jetski', speed: 0 }));
  assert.equal(a.progress.boat, 'skiff');
  K.tick(C, at({ home: true, boat: 'rib', speed: 0 }));
  assert.equal(a.progress.boat, 'rib');
  assert.equal(K.aboardKg(C, 'skiff'), 0);
  assert.equal(K.aboardKg(C, 'rib'), 160);
  // Dolphins on the bow, from the RIB: seen.
  assert.equal(K.tick(C, at({ boat: 'rib', bow: true, speed: 6 })).seen.length, 1);
});

test('divers: the boat stays on the site while they’re down; no anchor on a protected reef', () => {
  const { C, a } = take('divecharter', {}, (o) => o.obj.dive.noAnchor && o.obj.pax <= 4);
  const D = a.obj.dive;
  assert.match(a.gear, /Spot-Lock/);
  // The cabin boat has no room for divers' kit.
  assert.match(K.tick(C, at({ home: true, boat: 'cabin', speed: 0 })).said[0].text, /divers/);
  K.tick(C, at({ home: true, boat: 'rib', speed: 0 }));
  assert.ok(a.progress.aboard);
  // On the site but going along: no time counts. Off the site: none either.
  K.tick(C, at({ x: D.x, z: D.z, speed: 2, dt: 10 }));
  K.tick(C, at({ x: D.x + 200, z: D.z, speed: 0, dt: 10 }));
  assert.equal(a.progress.stay, 0);
  // Anchored on the reef: it doesn't count, and they say why (once).
  let r = K.tick(C, at({ x: D.x, z: D.z, speed: 0, anchored: true, dt: 10 }));
  assert.equal(a.progress.stay, 0);
  assert.match(r.said[0].text, /no anchoring/i);
  assert.equal(K.tick(C, at({ x: D.x, z: D.z, speed: 0, anchored: true, dt: 10 })).said.length, 0);
  // Held there (Spot-Lock, or by hand): it counts, up to the dive's length.
  for (let s = 0; s < D.stay - 10; s += 10) K.tick(C, at({ x: D.x + 5, z: D.z - 5, speed: 0.2, dt: 10 }));
  assert.equal(a.progress.seen, false);
  r = K.tick(C, at({ x: D.x, z: D.z, speed: 0.1, dt: 10 }));
  assert.equal(r.seen.length, 1);
  assert.equal(K.tick(C, at({ home: true, boat: 'rib', speed: 0 })).done.length, 1);
  // Where the club doesn't mind an anchor, anchored counts.
  const s = take('divecharter', {}, (o) => !o.obj.dive.noAnchor && o.obj.pax <= 4);
  K.tick(s.C, at({ home: true, boat: 'rib', speed: 0 }));
  K.tick(s.C, at({ x: s.a.obj.dive.x, z: s.a.obj.dive.z, speed: 0, anchored: true, dt: 200 }));
  assert.ok(s.a.progress.seen);
});

test('a fishing charter counts sea fish landed with them aboard, in their boat', () => {
  const { C, a } = take('fishcharter');
  const n = a.obj.fish;
  // A fish before they're aboard: nothing.
  K.caught(C, { sp: 'mackerel', size: 30, sea: true, phase: 'landed', boat: 'console' });
  K.tick(C, at({ home: true, boat: 'console', speed: 0 }));
  assert.equal(a.progress.caught, 0);
  // From another boat, from the shore, a freshwater fish, one let go: none count.
  K.caught(C, { sp: 'mackerel', size: 30, sea: true, phase: 'landed', boat: 'skiff' });
  K.caught(C, { sp: 'mackerel', size: 30, sea: true, phase: 'landed', boat: null });
  K.caught(C, { sp: 'trout', size: 30, sea: false, phase: 'landed', boat: 'console' });
  K.caught(C, { sp: 'mackerel', size: 30, sea: true, phase: 'released', boat: 'console' });
  assert.equal(a.progress.caught, 0);
  for (let i = 0; i < n; i++) K.caught(C, { sp: 'mackerel', size: 30, sea: true, phase: 'landed', boat: 'console' });
  assert.equal(a.progress.caught, n);
  assert.equal(K.tick(C, at({ boat: 'console' })).seen.length, 1);
  assert.equal(K.tick(C, at({ home: true, boat: 'console', speed: 0 })).done.length, 1);
});

test('a rough trip in an open boat costs the tip; the same sea in the yacht doesn’t', () => {
  const rough = take('whalewatch', {}, (o) => o.obj.pax <= 5);
  K.tick(rough.C, at({ home: true, boat: 'rib', speed: 0 }));
  for (let i = 0; i < 70; i++) K.tick(rough.C, at({ boat: 'rib', sea: 1.9, dt: 1 }));
  K.tick(rough.C, at({ boat: 'rib', whale: 100 }));
  assert.match(K.standing(rough.a), /rough trip/);
  K.tick(rough.C, at({ home: true, boat: 'rib', speed: 0 }));
  assert.equal(K.claim(rough.C, rough.a.id, 3).pay, Math.round(rough.a.pay * 0.7));
  const calm = take('whalewatch', {}, (o) => o.obj.pax <= 5);
  K.tick(calm.C, at({ home: true, boat: 'cruiser', speed: 0 }));
  for (let i = 0; i < 70; i++) K.tick(calm.C, at({ boat: 'cruiser', sea: 1.9, dt: 1 }));
  K.tick(calm.C, at({ boat: 'cruiser', whale: 100 }));
  K.tick(calm.C, at({ home: true, boat: 'cruiser', speed: 0 }));
  assert.equal(K.claim(calm.C, calm.a.id, 3).pay, calm.a.pay);
});

test('freight: loaded only into a boat that can carry it, delivered in that boat, paid there once', () => {
  const { C, a } = take('freight', {}, (o) => o.obj.cargo === 1200);
  assert.match(K.tick(C, at({ home: true, boat: 'console', speed: 0 })).said[0].text, /800 kg/);
  assert.equal(a.progress.loaded, false);
  // At Puffin Cove with nothing loaded: nothing delivered.
  assert.equal(K.tick(C, at({ at: 'puffin', boat: 'console' })).done.length, 0);
  assert.equal(K.tick(C, at({ home: true, boat: 'cruiser', speed: 0 })).boarded.length, 1);
  assert.equal(K.aboardKg(C, 'cruiser'), 1200);
  // There in another boat: not delivered. In the yacht: delivered, paid on the spot, once.
  assert.equal(K.tick(C, at({ at: 'puffin', boat: 'rib' })).done.length, 0);
  const r = K.tick(C, at({ at: 'puffin', boat: 'cruiser', speed: 0 }));
  assert.equal(r.done.length, 1);
  assert.ok(a.onSpot);
  assert.equal(K.aboardKg(C, 'cruiser'), 0, 'unloaded');
  assert.ok(K.claim(C, a.id, 3));
  assert.equal(K.claim(C, a.id, 3), null);
});

test('a career: charters come with a passenger ticket, bigger parties and loads with a better one', () => {
  assert.equal(K.career(master(0)).rank.id, 'hand');
  assert.deepEqual([K.career(master(0)).next.id, K.career(master(0)).toGo], ['boatman', 3]);
  assert.equal(K.career(master(3)).rank.id, 'boatman');
  assert.equal(K.career(master(8)).rank.id, 'skipper');
  assert.equal(K.career(master(40)).rank.id, 'master');
  assert.equal(K.career(master(40)).next, null);
  const most = (count) => {
    let pax = 0, kg = 0;
    for (let d = 0; d < 150; d++) {
      for (const o of K.offers(master(count), world({ day: d }))) {
        if (o.obj.kind === 'charter') pax = Math.max(pax, o.obj.pax);
        if (o.obj.cargo) kg = Math.max(kg, o.obj.cargo);
      }
    }
    return { pax, kg };
  };
  assert.deepEqual(most(0), { pax: 0, kg: 250 }, 'no passengers without a ticket');
  assert.deepEqual(most(3), { pax: 3, kg: 450 });
  assert.deepEqual(most(8), { pax: 6, kg: 700 });
  assert.deepEqual(most(20), { pax: 8, kg: 1200 });
  // (A job paid moves you on.)
  const { C, a } = take('dolphintrip', {}, (o) => o.obj.pax === 2);
  C.count = 2;
  K.tick(C, at({ home: true, boat: 'skiff', speed: 0 }));
  K.tick(C, at({ boat: 'skiff', bow: true, speed: 6 }));
  K.tick(C, at({ home: true, boat: 'skiff', speed: 0 }));
  K.claim(C, a.id, 3);
  assert.equal(K.career(C).rank.id, 'boatman');
});

test('given up mid-trip: nothing left aboard, nothing stuck, the next job takes fine', () => {
  const { C, a } = take('whalewatch', {}, (o) => o.obj.pax <= 5);
  K.tick(C, at({ home: true, boat: 'rib', speed: 0 }));
  assert.ok(K.aboardKg(C, 'rib') > 0);
  assert.ok(K.abandon(C, a.id));
  assert.equal(K.aboardKg(C, 'rib'), 0);
  assert.equal(C.active.length, 0);
  assert.equal(K.claim(C, a.id, 3), null, 'nothing to be paid for');
  // A saved game with a charter on keeps it, aboard and all.
  const t = take('dolphintrip', {}, (o) => o.obj.pax === 2);
  K.tick(t.C, at({ home: true, boat: 'skiff', speed: 0 }));
  const back = K.cleanContracts(JSON.parse(JSON.stringify(t.C)));
  assert.equal(K.aboardKg(back, 'skiff'), 160);
  assert.equal(back.active[0].progress.aboard, true);
  // (and through the whole save: the jobs, the career and what's been paid all come back)
  t.C.count = 9;
  t.C.done['3-home-marks'] = 3;
  const loaded = sanitize(JSON.parse(JSON.stringify({ day: 3, contracts: t.C }))).contracts;
  assert.equal(loaded.count, 9);
  assert.equal(K.career(loaded).rank.id, 'skipper');
  assert.equal(loaded.active[0].id, t.a.id);
  assert.ok('3-home-marks' in loaded.done, 'a paid job stays paid after a reload');
  assert.deepEqual(sanitize({}).contracts, K.newContracts(), 'an old save starts with none');
});

test('every boat has a seat for each person she’s rated to carry, clear of the helm and out of the cabin', () => {
  for (const k of BOAT_KINDS) {
    const H = HULLS[k], V = VESSELS[k], s = seatsFor(H, V.seats);
    assert.equal(s.length, V.seats, `${k}: ${s.length} of ${V.seats} seats`);
    const helm = H.standing?.helm ?? [0, H.seatZ ?? 0];
    for (const p of s) {
      assert.ok(Math.abs(p.z) < H.L / 2 && Math.abs(p.x) < H.B, `${k}: inside her`);
      // (The jet ski's passenger rides pillion, right behind you.)
      assert.ok(Math.hypot(p.x - helm[0], p.z - helm[1]) >= (k === 'jetski' ? 0.5 : 0.75), `${k}: clear of the helm`);
      if (H.cabin) assert.ok(p.z < (H.cabin[0] - 0.5) * H.L || p.z > (H.cabin[1] - 0.5) * H.L, `${k}: not in the cabin`);
    }
    // (and no two in the same place)
    for (let i = 0; i < s.length; i++) for (let j = i + 1; j < s.length; j++) assert.ok(Math.hypot(s[i].x - s[j].x, s[i].z - s[j].z) > 0.5, `${k}: room between`);
  }
});

test('passengers put ashore and castaways picked up are given back to the graphics card', async () => {
  const THREE = await import('three');
  const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
  const { Boat } = await import('../src/boat.js');
  const { Passengers } = await import('../src/passengers.js');
  const { PickupView } = await import('../src/world/pickups.js');
  const scene = new THREE.Scene();
  // Everything made for an object: each listens for being given back.
  const watch = (group) => {
    const w = { made: 0, given: 0 };
    group.traverse((o) => {
      for (const x of [o.geometry, o.material]) {
        if (!x || x._watched) continue;
        x._watched = true;
        w.made++;
        x.addEventListener('dispose', () => w.given++);
      }
    });
    return w;
  };
  const boat = new Boat(scene, { kind: 'cabin' });
  const P = new Passengers();
  P.set(boat, [{ id: 'c1', n: 2 }, { id: 'c2', n: 1, divers: true }]);
  assert.equal(P.count, 3);
  const ws = P.figs.map((f) => watch(f.figure.group));
  const parts = boat.body.children.length;
  P.set(boat, []);
  assert.equal(P.count, 0);
  assert.equal(boat.body.children.length, parts - 3, 'out of her');
  for (const w of ws) assert.ok(w.made > 10 && w.given === w.made, `${w.given} of ${w.made}`);
  const V = new PickupView(scene);
  V.sync([{ id: 'p1', what: 'person', x: 10, z: 20 }, { id: 'b1', what: 'buoy', x: 30, z: 20 }]);
  const wp = watch(V.items.get('p1').g), wb = watch(V.items.get('b1').g);
  V.sync([{ id: 'b1', what: 'buoy', x: 30, z: 20 }]);
  assert.ok(wp.made > 10 && wp.given === wp.made && wb.given === 0, 'the castaway, not the buoy');
  V.sync([]);
  assert.ok(wb.made > 3 && wb.given === wb.made && V.count === 0);
});
