// The engine catalogue (src/engines.js), the RIB first: her own engine on its own propeller pushes
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
const { cleanYard, repowerBoat, repropBoat, engineOf, fitsFor } = await import('../src/shipyard.js');
const Fu = await import('../src/fuel.js');
const { wakes } = await import('../src/world/wakes.js');

const { OUTBOARDS, PROPS, PROP_IDS, CATALOGUE, engineSpec, pushAt, KN } = E;
const KINDS = Object.keys(HULLS);
const H = HULLS.rib, C = CATALOGUE.rib;
const spec = (model, prop = 'matched') => engineSpec('rib', H, { model, prop });
const tr = (model, prop = 'matched') => TRIALS.rib[`${model}/${prop}`];
const scene = new THREE.Scene();

test('her own engine on its own propeller: exactly the push she always had', () => {
  const S = spec(C.stock);
  assert.equal(S.thrust, H.motor.thrust);
  assert.equal(S.astern, H.motor.astern);
  assert.ok(S.burn === 1 && S.kg === 0 && S.effort === 1 && S.grip === 0 && S.rpm === 6000);
  assert.equal(S.scale, H.motor.scale);
  // The same push at every speed she reaches on a calm day (and some way past it).
  for (let v = 0; v <= tr(C.stock).top * 1.04; v += 0.25) assert.equal(pushAt(S, v), H.motor.thrust, `${v} m/s`);
  // And on the water: flat out and turning, step for step, as with no catalogue at all. (One at a
  // time, each on water with no wake on it: two boats together would ride each other's wakes.)
  const run = (S) => {
    wakes.tracks.clear();
    const b = new Boat(scene, { kind: 'rib' });
    if (S) b.setMotor(S);
    b.place(150, 330, Math.PI / 2);
    for (let i = 0, t = 0; i < 25 * 30; i++, t += 1 / 30) b.update(1 / 30, t, 1, i > 400 ? 0.6 : 0, 0);
    return b;
  };
  const a = run(S), b = run(null);
  assert.ok(a.pos.distanceTo(b.pos) < 1e-9 && Math.abs(a.forwardSpeed - b.forwardSpeed) < 1e-9, `${a.pos.distanceTo(b.pos)} m apart`);
  // Nothing else has a catalogue yet, and nothing else is touched.
  for (const k of KINDS) if (k !== 'rib') assert.equal(engineSpec(k, HULLS[k], null), null, k);
});

test('the catalogue: four-strokes from 115 to 225 hp as they really are, no maker’s names', () => {
  const list = C.models.map((m) => OUTBOARDS[m]);
  assert.deepEqual(C.models.map((m) => OUTBOARDS[m].hp), [115, 150, 200, 225]);
  assert.ok(list.every((O, i) => !i || (O.kg > list[i - 1].kg && O.lph > list[i - 1].lph && O.price > 0)), 'heavier and thirstier as they grow');
  // About 0.37 litres an hour per horsepower flat out (a tenth of a US gallon), and 1.1 to 1.5 kg a horsepower.
  for (const O of list) {
    assert.ok(Math.abs(O.lph / O.hp - 0.37) < 0.03, `${O.name}: ${O.lph} L/h`);
    assert.ok(O.kg / O.hp > 1.05 && O.kg / O.hp < 1.55, `${O.name}: ${O.kg} kg`);
    assert.ok(O.hp <= C.plate && O.desc && O.layout);
  }
  assert.equal(C.models.includes(C.stock), true);
  for (const id of PROP_IDS) assert.ok(PROPS[id].name && PROPS[id].desc && PROPS[id].price > 0 && [3, 4].includes(PROPS[id].blades), id);
  // Generic, fictional families: no real maker's names anywhere in the catalogue.
  const src = readFileSync(new URL('../src/engines.js', import.meta.url), 'utf8');
  assert.doesNotMatch(src, /yamaha|mercury|suzuki|honda|evinrude|johnson|tohatsu|mariner|selva|volvo|yanmar|verado|parsun/i);
  // Matched pitches in a sensible range (inches), a lower pitch lower.
  for (const m of C.models) {
    const p = spec(m).pitch;
    assert.ok(p >= 13 && p <= 21, `${m}: ${p}-inch`);
    assert.equal(spec(m, 'low').pitch, p - 2);
    assert.equal(spec(m, 'four').pitch, p - 1);
  }
});

test('what the yard measured: more power is quicker and faster; a lower pitch quicker away, better laden, held back by the limiter', () => {
  const tops = C.models.map((m) => tr(m).top), goes = C.models.map((m) => tr(m).t20);
  assert.ok(tops.every((v, i) => !i || v > tops[i - 1]), `flat out: ${tops.map((v) => (v * KN).toFixed(1)).join(', ')} kn`);
  assert.ok(goes.every((v, i) => !i || v <= goes[i - 1]), `0–20 kn: ${goes.join(', ')} s`);
  // Her own: about 35 knots, as ever (the boats' own tests); the 225 some five knots more.
  assert.ok(tr(C.stock).top * KN > 34.5 && tr(C.stock).top * KN < 36.5);
  assert.ok((tr('s225').top - tr(C.stock).top) * KN > 4);
  for (const m of C.models) {
    const M = tr(m), L = tr(m, 'low'), F = tr(m, 'four');
    // The matched propeller is her best flat out; the others are quicker out of the hole.
    assert.ok(M.top > L.top && M.top > F.top, `${m}: matched ${M.top}, low ${L.top}, four ${F.top}`);
    assert.ok(L.t20 < M.t20 && F.t20 <= M.t20, `${m}: 0–20 kn ${M.t20} / ${L.t20} / ${F.t20} s`);
    // With four aboard, the lower pitch beats the matched one.
    assert.ok(L.laden > M.laden && F.laden > M.laden, `${m} laden: ${M.laden} / ${L.laden} / ${F.laden}`);
    // The limiter: the low pitch is held near its propeller's speed, whatever push there is to spare.
    assert.ok(L.top < spec(m, 'low').vd * (E.LIMIT[0] + E.LIMIT[1]), m);
  }
  // The heavier engine is carried in her: what she does with 300 kg more is less than flat out.
  for (const m of C.models) assert.ok(tr(m).laden < tr(m).top - 1, m);
  // The four-bladed propeller grips in a sea.
  assert.ok(spec('f150', 'four').grip > 0.2 && spec('f150').grip === 0);
});

test('the figures are the boat’s own: run again in the simulation, they come out the same', () => {
  for (const [m, p] of [[C.stock, 'matched'], ['s225', 'low']]) {
    const T = trial('rib', { model: m, prop: p }), was = tr(m, p);
    assert.ok(Math.abs(T.top - was.top) / was.top < 0.01, `${m}/${p} top ${T.top} (table ${was.top})`);
    assert.ok(Math.abs(T.t20 - was.t20) <= 0.15, `${m}/${p} 0–20 kn ${T.t20} (table ${was.t20})`);
    assert.ok(Math.abs(T.laden - was.laden) / was.laden < 0.01, `${m}/${p} laden ${T.laden} (table ${was.laden})`);
    assert.ok(Math.abs(T.lph - was.lph) / was.lph < 0.02, `${m}/${p} ${T.lph} L/h (table ${was.lph})`);
  }
  // Her matched propeller is matched to the boat as she runs: her own top speed is its speed.
  assert.ok(Math.abs(tr(C.stock).top - spec(C.stock).vd) / spec(C.stock).vd < 0.01, `${tr(C.stock).top} vs ${spec(C.stock).vd}`);
});

test('fuel follows the work: a lower pitch burns what the matched one does at the same speed; a bigger engine more flat out', () => {
  for (const m of C.models) {
    assert.ok(Math.abs(tr(m, 'low').lph - tr(m).lph) / tr(m).lph < 0.02, `${m}: ${tr(m).lph} / ${tr(m, 'low').lph} L/h at 25 kn`);
    assert.ok(spec(m, 'low').effort > 1 && spec(m).effort === 1);
  }
  // Flat out, as its rating: the 225 half as thirsty again as the 150, the 115 a quarter less.
  assert.ok(Math.abs(spec('s225').burn - 83 / 56) < 1e-9 && spec('f115').burn < 0.8);
  // At a cruise the engines burn much alike, the heavier ones a little more.
  const at25 = C.models.map((m) => tr(m).lph);
  assert.ok(Math.max(...at25) / Math.min(...at25) < 1.15, at25.join(', '));
  assert.ok(tr('s225').lph > tr(C.stock).lph);
  // The burn itself: the effort is taken up to the limiter's share, and no further.
  const f = Fu.defaultFuel();
  f.boats.rib = 100;
  Fu.burnBoat(f, 'rib', 1.3, 10);
  const used = 100 - f.boats.rib;
  assert.ok(Math.abs(used - Fu.BOAT_PER_S.rib * 1.05 ** 1.5 * 10) < 1e-9, `${used} L`);
  // A range at a cruise, from a tank.
  assert.ok(Math.abs(E.rangeAt(tr(C.stock), 150) - (150 / tr(C.stock).lph) * 25) < 1e-9);
});

test('the outboard drawn is the engine fitted: its size, a V6’s taller cowling, the propeller’s blades', () => {
  const b = new Boat(scene, { kind: 'rib' });
  const size = () => new THREE.Box3().setFromObject(b.motorGroups[0]).getSize(new THREE.Vector3());
  const blades = () => b.props[0].children.length;
  const four = size();
  assert.equal(blades(), 3);
  b.setMotor(spec('s225', 'four'));
  const v6 = size();
  assert.ok(v6.y > four.y * 1.04, `the V6 stands taller: ${v6.y.toFixed(3)} vs ${four.y.toFixed(3)}`);
  assert.equal(blades(), 4);
  assert.ok(b.motorGroups[0].scale.x > H.motor.scale);
  b.setMotor(spec('f115'));
  assert.ok(b.motorGroups[0].scale.x < H.motor.scale && blades() === 3);
  b.setMotor(null);
  assert.equal(b.motorGroups[0].scale.x, H.motor.scale);
  const back = size();
  assert.ok(Math.abs(back.y - four.y) < 1e-9, 'and back as she was');
  // Fittings don't undo it.
  b.setMotor(spec('s200'));
  b.setFits(['tank']);
  assert.equal(b.motorGroups[0].scale.x, spec('s200').scale);
});

test('the Marine Works: a new engine or propeller paid for and fitted; older games keep what they paid for', () => {
  const state = { day: 3, hour: 10, money: 2000, ledger: [], yard: cleanYard({ owned: [...KINDS] }, KINDS) };
  assert.deepEqual(engineOf(state.yard, 'rib'), { model: C.stock, prop: 'matched' });
  assert.deepEqual(state.yard.engines, {}, 'her own engine is not written down');
  assert.equal(repowerBoat(state, 'rib', C.stock).ok, false, 'she has it already');
  assert.equal(repowerBoat(state, 'rib', 'v12').ok, false);
  assert.equal(repowerBoat(state, 'console', 's200').ok, false, 'not on the console yet');
  assert.equal(repropBoat(state, 'rib', 'low').ok, true);
  assert.equal(state.money, 2000 - PROPS.low.price);
  assert.equal(repowerBoat(state, 'rib', 's225').ok, true);
  assert.equal(state.money, 2000 - PROPS.low.price - OUTBOARDS.s225.price);
  assert.deepEqual(engineOf(state.yard, 'rib'), { model: 's225', prop: 'low' }, 'a new engine keeps her kind of propeller');
  // Saved and read back: the same.
  assert.deepEqual(cleanYard(JSON.parse(JSON.stringify(state.yard)), KINDS).engines, { rib: { model: 's225', prop: 'low' } });
  // Back to her own: nothing written down.
  repowerBoat(state, 'rib', C.stock);
  repropBoat(state, 'rib', 'matched');
  assert.deepEqual(state.yard.engines, {});
  const poor = { day: 3, hour: 10, money: 5, ledger: [], yard: cleanYard({ owned: ['rib'] }, KINDS) };
  assert.equal(repowerBoat(poor, 'rib', 's200').ok, false, 'not without the money');
  assert.equal(poor.money, 5);
  // Not your boat: nothing.
  const none = { day: 3, hour: 10, money: 5000, ledger: [], yard: cleanYard(null, KINDS) };
  assert.equal(repowerBoat(none, 'rib', 's200').ok, false);
  // A game from before the catalogue: her "Bigger outboard" is the Skua 200, her "Economy tune and
  // prop" the Fulmar 115; the fittings themselves are gone from her list (other boats keep theirs).
  const old = cleanYard({ owned: KINDS, fits: { rib: ['tank', 'power'], console: ['power'] } }, KINDS);
  assert.deepEqual(old.engines.rib, { model: 's200', prop: 'matched' });
  assert.deepEqual(old.fits.rib, ['tank']);
  assert.deepEqual(old.fits.console, ['power']);
  assert.deepEqual(cleanYard({ owned: KINDS, fits: { rib: ['economy'] } }, KINDS).engines.rib, { model: 'f115', prop: 'matched' });
  // And once read, it stays so (a second read changes nothing).
  assert.deepEqual(cleanYard(JSON.parse(JSON.stringify(old)), KINDS), old);
  // Nonsense: her own engine.
  const junk = cleanYard({ owned: KINDS, engines: { rib: { model: 'warp', prop: 'oar' }, row: { model: 's225' } } }, KINDS);
  assert.deepEqual(junk.engines, {});
  assert.ok(!fitsFor('rib').some((id) => id === 'power' || id === 'economy'));
});
