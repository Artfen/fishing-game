// The tender (L1 of docs/LIVEABOARD.md): a little rigid inflatable of about eleven feet over her
// tubes, on a tiller outboard, sold at the Marine Works on her own and, later, carried by the
// liveaboard to go ashore in. Built as a boat of her own here: her hull and how she goes, and every
// list in the game a boat of a kind is kept in. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat, BOAT_KINDS, HULLS, floatDraft } = await import('../src/boat.js');
const { tubeCentre } = await import('../src/hydro.js');
const { conditions, updateConditions } = await import('../src/world/conditions.js');
const Th = await import('../src/throttle.js');

const scene = new THREE.Scene();
const OPEN = { x: 150, z: 330 };
const KN = 1 / 0.514444;
let clock = 0;
const boatAt = (kind, heading = 0) => {
  const b = new Boat(scene, { kind });
  b.place(OPEN.x, OPEN.z, heading);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};
const run = (b, secs, lever = 0, steer = 0, each = null) => {
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    conditions.time = clock;
    b.update(1 / 30, clock, lever, steer, 0);
    each?.(i / 30);
  }
  return b;
};
const calm = () => {
  conditions.manual = { speed: 0, from: 0 };
  conditions.wind.speed = conditions.wind.target = 0;
  for (let i = 0; i < 400; i++) updateConditions(0.25, { rain: 0, cloud: 0 });
};

test('built as a little RIB: about eleven feet over her tubes, a metre and two-thirds across, a 17° V, tubes in the water aft, a tiller outboard and a bench to steer from', () => {
  assert.ok(BOAT_KINDS.includes('tender'));
  const H = HULLS.tender, T = H.tubes;
  const b = boatAt('tender');
  assert.equal(b.name, 'tender');
  // Her length over the tubes: her hull, the cones aft of the transom and the nose.
  const over = H.L + T.r * 1.9 + T.r * 0.55;
  assert.ok(over > 3.2 && over < 3.5, `${over.toFixed(2)} m over her tubes`);
  const mid = tubeCentre(H, 0.3, 1), beam = 2 * (mid[0] + T.r);
  assert.ok(beam > 1.55 && beam < 1.75, `beam ${beam.toFixed(2)} m`);
  assert.ok(2 * T.r > 0.38 && 2 * T.r < 0.46, 'tubes about 42 cm across');
  const dr = (Math.atan(H.vee.rise) * 180) / Math.PI;
  assert.ok(Math.abs(dr - H.planing.deadrise) < 1, `her V (${dr.toFixed(1)}°) as her planing figure says`);
  // Lying still, the tubes' undersides at the stern are in the water and clear of it at the bow.
  const draft = floatDraft(b.base), stern = tubeCentre(H, 0, 1)[1] - T.r, bow = tubeCentre(H, 0.9, 1)[1] - T.r;
  assert.ok(stern < draft && draft - stern < 0.12, `tubes ${(draft - stern).toFixed(2)} m into the water at the stern`);
  assert.ok(bow - draft > 0.12, `and clear at the bow (${(bow - draft).toFixed(2)} m: a little boat's, the RIB's stand higher)`);
  // A tiller outboard (no console, no wheel, no inboard), sat at: you don't stand to steer her.
  assert.ok(b.motor && !H.motor.inboard && !H.console && !H.wheel && !H.standing);
  assert.ok(b.motorGroup && b.tillerGrip, 'her outboard has its tiller');
  assert.ok(!b.turns, 'sat at her tiller');
  // Her short-shaft leg: the propeller drawn a little under her keel, where its push is taken.
  assert.ok(b.prop.position.y * H.motor.scale + b.motorGroup.position.y > -0.5, 'a short shaft for her low transom');
});

test('quick and light: onto the plane in a few seconds, about twenty-two knots alone on her own engine, and handy in a turn', () => {
  calm();
  const b = boatAt('tender');
  let t15 = null;
  run(b, 40, 1, 0, (t) => { if (t15 == null && b.forwardSpeed * KN > 15) t15 = t; });
  const kn = b.forwardSpeed * KN;
  assert.ok(kn > 20.5 && kn < 24, `${kn.toFixed(1)} knots flat out`);
  assert.ok(t15 != null && t15 < 4.5, `fifteen knots ${t15?.toFixed(1)} s from rest`);
  assert.ok(Math.abs(b.pitch) < 0.09, `levelled out on the plane: ${(-b.pitch * 57.3).toFixed(1)}°`);
  // Hard over at speed she comes round and keeps going, banked into it, never tripped over.
  const h0 = b.heading;
  let roll = 0;
  run(b, 4, 1, 1, () => { roll = Math.max(roll, Math.abs(b.roll)); });
  assert.ok(Math.abs(b.heading - h0) > 1.5, `turned ${((b.heading - h0) * 57.3).toFixed(0)}° in four seconds`);
  assert.ok(roll < 0.35 && b.forwardSpeed * KN > 14, `banked ${(roll * 57.3).toFixed(0)}°, still going`);
  // Slow, she turns in about her own length.
  b.place(OPEN.x, OPEN.z, 0);
  run(b, 6, 0.25);
  let path = 0, x = b.pos.x, z = b.pos.z;
  const hs = b.heading;
  run(b, 3, 0.25, 1, () => { path += Math.hypot(b.pos.x - x, b.pos.z - z); x = b.pos.x; z = b.pos.z; });
  const radius = path / Math.abs(b.heading - hs);
  assert.ok(radius < 1.5 * HULLS.tender.L, `a turning radius of ${radius.toFixed(1)} m`);
});

test('steady enough to step about in: someone on her tube heels her about ten degrees, and her tubes take it', () => {
  calm();
  const b = boatAt('tender');
  run(b, 4);
  assert.ok(Math.abs(b.roll) < 0.03, 'level at rest');
  b.setLoads([{ kg: 80, p: [0.7, 0.6, 0], what: 'test' }]);
  run(b, 6);
  const heel = Math.abs(b.roll) * 57.3;
  assert.ok(heel > 5 && heel < 12, `${heel.toFixed(1)}° with someone sat on her tube`);
  b.setLoads([]);
});

test('in a sea: a following sea throws her about but her skipper keeps her off her end, and a head sea costs her speed', () => {
  const watch = (heading, secs = 60) => {
    const b = boatAt('tender', heading);
    let up = 0, v = 0, n = 0;
    run(b, secs, 1, 0, (t) => {
      if (t > 15) { up = Math.max(up, -b.pitch); v += b.forwardSpeed; n++; }
    });
    return { up, v: v / n };
  };
  calm();
  const still = watch(0, 30).v;
  // A fresh breeze from astern, flat out: a light boat rears up the backs of the seas and off their
  // crests now and then, but her skipper's lean keeps it short of standing her on her end.
  conditions.manual = { speed: 7, from: Math.PI };
  for (let i = 0; i < 2400; i++) updateConditions(0.25, { rain: 0, cloud: 0.5 });
  const F = watch(0);
  assert.ok(F.up < 0.5, `bow up at most ${(F.up * 57.3).toFixed(0)}° in a fresh following sea`);
  assert.ok(F.v < still, 'slower than in a calm');
  // Into a rough sea: thrown about less, and slower still (a short hull meets every sea).
  conditions.manual = { speed: 11, from: 0 };
  for (let i = 0; i < 2400; i++) updateConditions(0.25, { rain: 0, cloud: 0.5 });
  const R = watch(0);
  assert.ok(R.up < 0.35, `bow up at most ${(R.up * 57.3).toFixed(0)}° into a rough sea`);
  assert.ok(R.v < F.v, `slower again: ${(R.v * KN).toFixed(1)} knots`);
  conditions.manual = null;
});

test('her lever: dead slow creeps, slow trolls, half gets somewhere, the cruise is on the plane', () => {
  calm();
  const L = Th.levers('tender');
  assert.deepEqual(L.map((n) => n.id), ['R', 'N', '1', '2', '3', 'C', 'F']);
  const speed = (id) => run(boatAt('tender', Math.PI / 2), 25, L.find((n) => n.id === id).v).forwardSpeed;
  const [s1, s2, s3, sc] = ['1', '2', '3', 'C'].map(speed);
  assert.ok(s1 > 0.5 && s1 < 1.3, `dead slow ${s1.toFixed(2)} m/s`);
  assert.ok(s2 > 1.1 && s2 < Th.CAST_SPEED, `slow ${s2.toFixed(2)} m/s`);
  assert.ok(s3 > 4, `half ${s3.toFixed(2)} m/s`);
  assert.ok(sc * KN > 14 && sc * KN < 17, `cruising ${(sc * KN).toFixed(1)} knots`);
  assert.ok(run(boatAt('tender'), 6, L[0].v).forwardSpeed < -0.8, 'astern goes backwards');
});

test('a boat of her own everywhere a boat is kept: the Marine Works, her engines, fuel, papers, tubes, the trailer and the save', async () => {
  const Sy = await import('../src/shipyard.js');
  const E = await import('../src/engines.js');
  const { PROFILES } = await import('../src/engine.js');
  const Fu = await import('../src/fuel.js');
  const { regOf } = await import('../src/papers.js');
  const D = await import('../src/damage.js');
  const { TRAILABLE } = await import('../src/trailer.js');
  const { VESSELS, fits } = await import('../src/vessels.js');
  const { HOMES } = await import('../src/fleet.js');
  const { CRUISE } = await import('../src/offshore.js');
  const { TRIALS } = await import('../src/engineTrials.js');
  const { goalsOf } = await import('../src/goals.js');
  const { sanitize } = await import('../src/save.js');
  // Bought or hired at the Marine Works, a second to a harbour berth like the RIB.
  assert.equal(Sy.PRICES.tender, 520);
  assert.ok(Sy.hirePrice('tender') > 0 && Sy.SECOND.includes('tender'));
  assert.equal(HOMES.tender, 'harbour');
  // Her engines: the Petrel 20 as she comes, from the Petrel 15 to the Tern 30 her plate allows (all
  // of them onto the plane), each measured on her (engineTrials.js); a pull start, a kill cord,
  // tilted by hand.
  const C = E.CATALOGUE.tender;
  assert.equal(C.stock, 'p20');
  assert.deepEqual(C.models, ['p15', 'p20', 't30']);
  for (const m of C.models) assert.ok(TRIALS.tender[`${m}/matched`], `${m} trialled on her`);
  assert.ok(E.MODELS.t30.hp <= C.plate);
  assert.equal(PROFILES.tender.starter, 'pull');
  assert.ok(PROFILES.tender.cord && !PROFILES.tender.battery);
  assert.ok(TRIALS.tender['t30/matched'].top > TRIALS.tender['p20/matched'].top, 'the bigger engine quicker');
  // Petrol in a portable tank; a cruise on the plane for the offshore planner.
  assert.equal(Fu.TANKS.tender, 20);
  assert.ok(Fu.PETROL.includes('tender') && Fu.BOAT_PER_S.tender > 0);
  assert.ok(CRUISE.tender.v > 7 && CRUISE.tender.lever < 0.6);
  // Her papers, her aluminium and her tube chambers kept with her hull's record.
  assert.equal(regOf('tender'), 'WH 232');
  assert.equal(regOf('tender~2'), 'WH 232-2');
  assert.equal(D.materialOf('tender').name, 'aluminium');
  assert.equal(D.cleanDamage(null, D.TUBED.has('tender')).tubes.length, D.CHAMBERS.length);
  assert.ok(TRAILABLE.includes('tender'), 'on the car\'s trailer');
  // What she's for: you and two, a little gear, a diver over her tubes; not a charter of three.
  assert.ok(VESSELS.tender && !VESSELS.tender.shelter);
  assert.equal(fits('tender', { pax: 2, divers: true }), null);
  assert.match(fits('tender', { pax: 3 }), /seats 2/);
  // Every boat at the Marine Works, her among them.
  assert.equal(goalsOf({ yard: { owned: BOAT_KINDS } }).find((g) => g.id === 'boats').of, BOAT_KINDS.length);
  // Kept by the save: owned, where she lies, the one you're in, her fuel and tubes.
  const s = sanitize({
    day: 3, hour: 10, money: 100, vessel: 'tender', mode: 'boat',
    yard: { owned: ['row', 'skiff', 'kayak', 'tender', 'tender~2'] },
    boats: { tender: { x: 12, z: -60, heading: 1 }, 'tender~2': { x: 16, z: -60, heading: 1 } },
    stored: ['row', 'kayak', 'skiff'],
    fuel: { boats: { tender: 14 } },
    damage: { tender: { tubes: [{ air: 0.6, leak: 0 }, { air: 1, leak: 0 }, { air: 1, leak: 0 }, { air: 1, leak: 0 }] } },
  });
  assert.deepEqual(s.yard.owned, ['row', 'skiff', 'kayak', 'tender', 'tender~2']);
  assert.equal(s.vessel, 'tender');
  assert.equal(s.boats.tender.x, 12);
  assert.ok(s.boats['tender~2']);
  assert.equal(s.fuel.boats.tender, 14);
  assert.ok(s.damage.tender?.tubes?.[0].air < 1, 'a soft tube kept');
});
