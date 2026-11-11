// The engine catalogue (src/engines.js): every motorboat's own engine on its own propeller pushes
// her exactly as she always was pushed; more power is quicker and faster, a lower pitch quicker
// away and better with a load but held back by the limiter; the heavier engine is carried in
// her; fuel follows the work the engine does; the Marine Works' figures are what the boat herself
// does in the simulation; the outboard drawn follows the engine; and a game from before the
// catalogue keeps what it paid for. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat, HULLS } = await import('../src/boat.js');
const E = await import('../src/engines.js');
const { TRIALS } = await import('../src/engineTrials.js');
const { trial } = await import('../tools/engine-trials.mjs');
const { cleanYard, repowerBoat, repropBoat, engineOf, fitsFor, FITS } = await import('../src/shipyard.js');
const Fu = await import('../src/fuel.js');
const { wakes } = await import('../src/world/wakes.js');

const { MODELS, PROPS, CATALOGUE, engineSpec, pushAt, KN } = E;
const KINDS = Object.keys(HULLS), BOATS = Object.keys(CATALOGUE);
const spec = (kind, model, prop = 'matched') => engineSpec(kind, HULLS[kind], { model, prop });
const tr = (kind, model, prop = 'matched') => TRIALS[kind][`${model}/${prop}`];
const scene = new THREE.Scene();

test('every boat’s own engine on its own propeller: exactly the push she always had', () => {
  assert.deepEqual(BOATS.sort(), ['bass', 'cabin', 'console', 'cruiser', 'rib', 'skiff']);
  for (const k of BOATS) {
    const H = HULLS[k], C = CATALOGUE[k], S = engineSpec(k, H, null);
    assert.equal(S.thrust, H.motor.thrust, k);
    assert.equal(S.astern, H.motor.astern, k);
    assert.ok(S.burn === 1 && S.kg === 0 && S.effort === 1 && S.grip === 0 && S.look === null && S.voice === null, k);
    assert.equal(S.rpm, MODELS[C.stock].rpm, k);
    assert.equal(S.scale, H.motor.scale ?? 1, k);
    // The same push at every speed she reaches on a calm day (and some way past it).
    for (let v = 0; v <= tr(k, C.stock).top * 1.04; v += 0.25) assert.equal(pushAt(S, v), H.motor.thrust, `${k} at ${v} m/s`);
  }
  // And on the water: flat out and turning, step for step, as with no catalogue at all (one engine,
  // a pair of outboards, a pair of diesels). (One at a time, each on water with no wake on it: two
  // boats together would ride each other's wakes.)
  for (const k of ['rib', 'console', 'cruiser']) {
    const run = (S) => {
      wakes.tracks.clear();
      const b = new Boat(scene, { kind: k });
      if (S) b.setMotor(S);
      b.place(150, 330, Math.PI / 2);
      for (let i = 0, t = 0; i < 25 * 30; i++, t += 1 / 30) b.update(1 / 30, t, 1, i > 400 ? 0.6 : 0, 0);
      return b;
    };
    const a = run(engineSpec(k, HULLS[k], null)), b = run(null);
    assert.ok(a.pos.distanceTo(b.pos) < 1e-9 && Math.abs(a.forwardSpeed - b.forwardSpeed) < 1e-9, `${k}: ${a.pos.distanceTo(b.pos)} m apart`);
  }
  // The rest (the jet ski, the sailing boat's outboard, the paddled and rowed boats) are as they were.
  for (const k of KINDS) if (!CATALOGUE[k]) assert.equal(engineSpec(k, HULLS[k], null), null, k);
});

test('the catalogue: portables to big diesels, as they really are; no maker’s names', () => {
  for (const [id, O] of Object.entries(MODELS)) {
    // Petrol about 0.37 litres an hour per horsepower flat out (a tenth of a US gallon); a diesel
    // about half that.
    const per = O.lph / O.hp;
    if (O.inboard) assert.ok(per > 0.17 && per < 0.22, `${O.name}: ${O.lph} L/h`);
    else assert.ok(Math.abs(per - 0.37) < 0.035, `${O.name}: ${O.lph} L/h`);
    // A small engine weighs more for its power than a big one; none is a feather.
    assert.ok(O.kg / O.hp > 1 && O.kg / O.hp < 5, `${O.name}: ${O.kg} kg`);
    assert.ok(O.desc && O.layout && O.price > 0 && O.rpm > 2500, id);
  }
  for (const k of BOATS) {
    const C = CATALOGUE[k], list = C.models.map((m) => MODELS[m]);
    assert.ok(C.models.includes(C.stock), k);
    assert.ok(list.every((O, i) => !i || (O.hp > list[i - 1].hp && O.kg >= list[i - 1].kg && O.lph > list[i - 1].lph)), `${k}: heavier and thirstier as they grow`);
    if (C.plate) assert.ok(list.every((O) => O.hp <= C.plate), k);
    // Matched pitches in a sensible range (inches), a lower pitch lower.
    for (const m of C.models) {
      const p = spec(k, m).pitch;
      assert.ok(p >= 6 && p <= 26, `${k} ${m}: ${p}-inch`);
      assert.ok(spec(k, m, 'low').pitch < p, `${k} ${m} low`);
      if (C.props.includes('four')) assert.ok(spec(k, m, 'four').pitch <= p && spec(k, m, 'four').pitch >= spec(k, m, 'low').pitch, `${k} ${m} four`);
    }
  }
  // An inboard's propellers are four-bladed whatever; the stainless four-blade is an outboard's.
  assert.ok(!CATALOGUE.cruiser.props.includes('four') && spec('cruiser', 'd320').blades === 4);
  for (const id of Object.keys(PROPS)) assert.ok(PROPS[id].name && PROPS[id].desc && PROPS[id].price > 0, id);
  // Generic, fictional families: no real maker's names anywhere in the catalogue.
  const src = readFileSync(new URL('../src/engines.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /yamaha|mercury|suzuki|honda|evinrude|johnson|tohatsu|mariner|selva|volvo|yanmar|verado|parsun|cummins|caterpillar|mtu\b|nanni|perkins/i);
});

test('what the yard measured, on every boat: more power is quicker and faster; a lower pitch quicker away, better laden, held back by the limiter', () => {
  for (const k of BOATS) {
    const C = CATALOGUE[k];
    const tops = C.models.map((m) => tr(k, m).top);
    assert.ok(tops.every((v, i) => !i || v > tops[i - 1]), `${k} flat out: ${tops.map((v) => (v * KN).toFixed(1)).join(', ')} kn`);
    const goes = C.models.map((m) => tr(k, m).t20 ?? Infinity);
    assert.ok(goes.every((v, i) => !i || v <= goes[i - 1]), `${k} 0–${C.go} kn: ${goes.join(', ')} s`);
    for (const m of C.models) {
      const M = tr(k, m), L = tr(k, m, 'low');
      // The matched propeller is her best flat out; a lower pitch is quicker away and better laden.
      assert.ok(M.top > L.top, `${k} ${m}: matched ${M.top}, low ${L.top}`);
      if (M.t20 != null) assert.ok(L.t20 != null && L.t20 <= M.t20, `${k} ${m}: 0–${C.go} kn ${M.t20} / ${L.t20} s`);
      assert.ok(L.laden > M.laden, `${k} ${m} laden: ${M.laden} / ${L.laden}`);
      // The limiter: the low pitch is held near its propeller's speed, whatever push there is to spare.
      assert.ok(L.top < spec(k, m, 'low').vd * (E.LIMIT[0] + E.LIMIT[1]), `${k} ${m}`);
      // Her load costs her speed.
      assert.ok(M.laden < M.top, `${k} ${m}`);
      // (The four-blade is a little short of her best, or level with it: each boat's matching is
      // calibrated at her own engine's speed, so a bigger engine's matched pitch is a hair off it.)
      if (C.props.includes('four')) {
        const F = tr(k, m, 'four');
        assert.ok(F.top <= M.top * 1.01 && F.laden > M.laden, `${k} ${m} four: ${F.top} / ${F.laden}`);
      }
    }
    // Her matched propeller is matched to the boat as she runs: her own top speed is its speed.
    assert.ok(Math.abs(tr(k, C.stock).top - spec(k, C.stock).vd) / spec(k, C.stock).vd < 0.015, `${k}: ${tr(k, C.stock).top} vs ${spec(k, C.stock).vd}`);
  }
  // The RIB on her own: about 35 knots, as ever (the boats' own tests); the 225 some five knots more.
  assert.ok(tr('rib', 'f150').top * KN > 34.5 && tr('rib', 'f150').top * KN < 36.5);
  assert.ok((tr('rib', 's225').top - tr('rib', 'f150').top) * KN > 4);
  // The four-bladed propeller grips in a sea.
  assert.ok(spec('rib', 'f150', 'four').grip > 0.2 && spec('rib', 'f150').grip === 0);
});

test('the figures are the boat’s own: run again in the simulation, they come out the same', () => {
  for (const [k, m, p] of [['rib', 'f150', 'matched'], ['rib', 's225', 'low'], ['console', 'f115', 'matched']]) {
    const T = trial(k, { model: m, prop: p }), was = tr(k, m, p);
    assert.ok(Math.abs(T.top - was.top) / was.top < 0.01, `${k} ${m}/${p} top ${T.top} (table ${was.top})`);
    assert.ok(Math.abs(T.t20 - was.t20) <= 0.15, `${k} ${m}/${p} 0–${CATALOGUE[k].go} kn ${T.t20} (table ${was.t20})`);
    assert.ok(Math.abs(T.laden - was.laden) / was.laden < 0.01, `${k} ${m}/${p} laden ${T.laden} (table ${was.laden})`);
    assert.ok(Math.abs(T.lph - was.lph) / was.lph < 0.02, `${k} ${m}/${p} ${T.lph} L/h (table ${was.lph})`);
  }
});

test('fuel follows the work: a lower pitch burns what the matched one does at the same speed; a bigger engine more flat out', () => {
  for (const k of BOATS) {
    const C = CATALOGUE[k];
    for (const m of C.models) {
      assert.ok(Math.abs(tr(k, m, 'low').lph - tr(k, m).lph) / tr(k, m).lph < 0.03, `${k} ${m}: ${tr(k, m).lph} / ${tr(k, m, 'low').lph} L/h at ${C.cruise} kn`);
      assert.ok(spec(k, m, 'low').effort > 1 && spec(k, m).effort === 1);
      assert.equal(spec(k, m).burn, MODELS[m].lph / MODELS[C.stock].lph);
    }
  }
  // At a cruise the RIB's engines burn much alike, the heavier ones a little more.
  const at25 = CATALOGUE.rib.models.map((m) => tr('rib', m).lph);
  assert.ok(Math.max(...at25) / Math.min(...at25) < 1.15, at25.join(', '));
  assert.ok(tr('rib', 's225').lph > tr('rib', 'f150').lph);
  // The burn itself: the effort is taken up to the limiter's share, and no further.
  const f = Fu.defaultFuel();
  f.boats.rib = 100;
  Fu.burnBoat(f, 'rib', 1.3, 10);
  const used = 100 - f.boats.rib;
  assert.ok(Math.abs(used - Fu.BOAT_PER_S.rib * 1.05 ** 1.5 * 10) < 1e-9, `${used} L`);
  // A range at her cruise, from a tank.
  assert.ok(Math.abs(E.rangeAt(tr('rib', 'f150'), 150, 'rib') - (150 / tr('rib', 'f150').lph) * 25) < 1e-9);
  assert.ok(Math.abs(E.rangeAt(tr('skiff', 'p10'), 20, 'skiff') - (20 / tr('skiff', 'p10').lph) * 10) < 1e-9);
});

test('the outboard drawn is the engine fitted: its size, a V6’s taller cowling, the propeller’s blades; a pair alike', () => {
  const b = new Boat(scene, { kind: 'rib' }), H = HULLS.rib;
  const size = () => new THREE.Box3().setFromObject(b.motorGroups[0]).getSize(new THREE.Vector3());
  const blades = () => b.props[0].children.length;
  const four = size();
  assert.equal(blades(), 3);
  b.setMotor(spec('rib', 's225', 'four'));
  const v6 = size();
  assert.ok(v6.y > four.y * 1.04, `the V6 stands taller: ${v6.y.toFixed(3)} vs ${four.y.toFixed(3)}`);
  assert.equal(blades(), 4);
  assert.ok(b.motorGroups[0].scale.x > H.motor.scale);
  b.setMotor(spec('rib', 'f115'));
  assert.ok(b.motorGroups[0].scale.x < H.motor.scale && blades() === 3);
  b.setMotor(null);
  assert.equal(b.motorGroups[0].scale.x, H.motor.scale);
  assert.ok(Math.abs(size().y - four.y) < 1e-9, 'and back as she was');
  // Fittings don't undo it.
  b.setMotor(spec('rib', 's200'));
  b.setFits(['tank']);
  assert.equal(b.motorGroups[0].scale.x, spec('rib', 's200').scale);
  // The console's pair, both alike; the skiff's little portable smaller still.
  const c = new Boat(scene, { kind: 'console' });
  c.setMotor(spec('console', 's200', 'four'));
  assert.equal(c.motorGroups.length, 2);
  assert.ok(c.motorGroups.every((g) => g.scale.x === spec('console', 's200').scale) && c.props.every((p) => p.children.length === 4));
  const s = new Boat(scene, { kind: 'skiff' });
  s.setMotor(spec('skiff', 'p6'));
  assert.ok(s.motorGroups[0].scale.x < 1);
  // The yacht's diesels are below decks: nothing to redraw, and nothing breaks.
  const y = new Boat(scene, { kind: 'cruiser' });
  y.setMotor(spec('cruiser', 'd440'));
  assert.equal(y.motorSpec.model, 'd440');
});

test('the Marine Works: a new engine or propeller paid for and fitted; older games keep what they paid for', () => {
  const state = { day: 3, hour: 10, money: 9000, ledger: [], yard: cleanYard({ owned: [...KINDS] }, KINDS) };
  assert.deepEqual(engineOf(state.yard, 'rib'), { model: 'f150', prop: 'matched' });
  assert.deepEqual(state.yard.engines, {}, 'her own engine is not written down');
  assert.equal(repowerBoat(state, 'rib', 'f150').ok, false, 'she has it already');
  assert.equal(repowerBoat(state, 'rib', 'v12').ok, false);
  assert.equal(repowerBoat(state, 'rib', 'p6').ok, false, 'not a portable on a RIB');
  assert.equal(repowerBoat(state, 'jetski', 's200').ok, false, 'the jet ski has no catalogue');
  assert.equal(repropBoat(state, 'cruiser', 'four').ok, false, 'no stainless four-blade on a shaft');
  let m = state.money;
  assert.equal(repropBoat(state, 'rib', 'low').ok, true);
  assert.equal(state.money, m - PROPS.low.price);
  m = state.money;
  assert.equal(repowerBoat(state, 'rib', 's225').ok, true);
  assert.equal(state.money, m - MODELS.s225.price);
  assert.deepEqual(engineOf(state.yard, 'rib'), { model: 's225', prop: 'low' }, 'a new engine keeps her kind of propeller');
  // A pair costs twice one.
  m = state.money;
  assert.equal(repowerBoat(state, 'console', 's200').ok, true);
  assert.equal(state.money, m - 2 * MODELS.s200.price);
  // Saved and read back: the same.
  assert.deepEqual(cleanYard(JSON.parse(JSON.stringify(state.yard)), KINDS).engines, { rib: { model: 's225', prop: 'low' }, console: { model: 's200', prop: 'matched' } });
  // Back to her own: nothing written down.
  repowerBoat(state, 'rib', 'f150');
  repropBoat(state, 'rib', 'matched');
  repowerBoat(state, 'console', 'f115');
  assert.deepEqual(state.yard.engines, {});
  const poor = { day: 3, hour: 10, money: 5, ledger: [], yard: cleanYard({ owned: ['rib'] }, KINDS) };
  assert.equal(repowerBoat(poor, 'rib', 's200').ok, false, 'not without the money');
  assert.equal(poor.money, 5);
  const none = { day: 3, hour: 10, money: 5000, ledger: [], yard: cleanYard(null, KINDS) };
  assert.equal(repowerBoat(none, 'rib', 's200').ok, false, 'not your boat');
  // A game from before the catalogue: each boat's "Bigger outboard" is its bigger engine now, its
  // "Economy tune and prop" its lighter one; the fittings themselves are gone.
  const old = cleanYard({ owned: KINDS, fits: { rib: ['tank', 'power'], console: ['power'], skiff: ['economy'], bass: ['power', 'sonar'], cabin: ['economy'] } }, KINDS);
  assert.deepEqual(old.engines, {
    rib: { model: 's200', prop: 'matched' }, console: { model: 'f150', prop: 'matched' }, skiff: { model: 'p6', prop: 'matched' },
    bass: { model: 't90', prop: 'matched' }, cabin: { model: 't30', prop: 'matched' },
  });
  assert.deepEqual(old.fits.rib, ['tank']);
  assert.deepEqual(old.fits.bass, ['sonar']);
  assert.ok(!old.fits.console && !old.fits.skiff);
  // And once read, it stays so (a second read changes nothing).
  assert.deepEqual(cleanYard(JSON.parse(JSON.stringify(old)), KINDS), old);
  // Nonsense: her own engine.
  const junk = cleanYard({ owned: KINDS, engines: { rib: { model: 'warp', prop: 'oar' }, row: { model: 's225' }, cruiser: { model: 'd440', prop: 'four' } } }, KINDS);
  assert.deepEqual(junk.engines, { cruiser: { model: 'd440', prop: 'matched' } });
  // The old engine fittings are gone from the yard for good.
  assert.ok(!FITS.power && !FITS.economy);
  for (const k of KINDS) assert.ok(!fitsFor(k).some((id) => id === 'power' || id === 'economy'), k);
});
