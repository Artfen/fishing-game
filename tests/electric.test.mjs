// The skiff's electric outboard (src/engines.js: the Eider 3; src/engine.js setElectric; src/fuel.js
// elec): woken at a button with the kill cord on, no idle and no cooling water, silent until the
// throttle's opened; its own battery for fuel, nothing in neutral, minutes flat out and far longer
// at an easy pace, charged at a jetty and overnight; the slowest of her engines, and what the
// yard quotes for it measured on the boat. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const En = await import('../src/engine.js');
const Fu = await import('../src/fuel.js');
const { MODELS, CATALOGUE, engineSpec, rangeAt, KN } = await import('../src/engines.js');
const { TRIALS } = await import('../src/engineTrials.js');
const { HULLS } = await import('../src/boat.js');
const { passage } = await import('../src/routes.js');

const run = (en, secs, ctx = {}) => {
  const ev = [];
  for (let i = 0; i < secs * 30; i++) ev.push(...En.stepEngine(en, 1 / 30, { fuel: 0.8, wet: true, ...ctx }, () => 0.5));
  return ev;
};
const e3 = engineSpec('skiff', HULLS.skiff, { model: 'e3', prop: 'matched' });

test('woken at a button with the kill cord on: no cord to pull, no idle, no cooling water; flat, it won’t go', () => {
  assert.equal(En.PROFILES.skiff.starter, 'pull', 'her petrol portable, as she came');
  En.setElectric('skiff', e3.rpm);
  try {
    const P = En.profileOf('skiff');
    assert.ok(P.electric && P.starter === 'button' && P.idle === 0 && P.max === 1300 && P.cooling === null && P.cord && !P.battery);
    assert.equal(En.PROFILES.bass.starter, 'key', 'the other boats as they were');
    const en = En.newEngine('skiff');
    assert.deepEqual(En.checklist(en, { lever: 0 }).map((s) => s.id), ['cord', 'neutral', 'start']);
    assert.match(En.act(en, 'start', { lever: 0, fuel: 1 }).why, /kill cord/);
    En.act(en, 'cord');
    assert.match(En.act(en, 'start', { lever: 0.3, fuel: 1 }).why, /neutral/);
    // A flat battery: nothing, and no emergency rope to it.
    let r = En.act(en, 'start', { lever: 0, fuel: 0 });
    assert.ok(!r.ok && /battery is flat/.test(r.why) && r.events.includes('click'), r.why);
    // Charged: on at once, with nothing turning until the throttle's opened.
    const charge = en.charge;
    r = En.act(en, 'start', { lever: 0, fuel: 0.8 });
    assert.ok(r.ok);
    assert.ok(run(en, 0.4).includes('catch') && En.running(en));
    run(en, 2);
    assert.ok(En.rpmOf(en) < 1, `silent at rest: ${En.rpmOf(en)} rpm`);
    run(en, 3, { opening: 1 });
    assert.ok(En.rpmOf(en) > 1200 && En.rpmOf(en) < 1450, `flat out: ${En.rpmOf(en).toFixed(0)} rpm`);
    assert.equal(en.charge, charge, 'no starter motor drew on anything');
    // Out of the water flat out: no water to watch, no alarm.
    const ev = run(en, 30, { opening: 1, wet: false });
    assert.ok(!ev.includes('hot') && en.temp < 0.6);
    // Its battery runs out: it stops.
    assert.ok(run(en, 0.2, { opening: 0.5, fuel: 0 }).includes('stall') && !En.running(en));
    // The one-button start: the cord, then the button.
    const en2 = En.newEngine('skiff');
    assert.deepEqual(En.assist(en2, { lever: 0 }), ['cord', 'start']);
  } finally {
    En.setElectric('skiff', 0);
  }
  assert.ok(En.PROFILES.skiff.starter === 'pull' && En.PROFILES.skiff.idle === 950 && !En.PROFILES.skiff.electric, 'petrol again, as she came');
});

test('its battery: nothing in neutral, minutes flat out, far longer at an easy pace; charged at a jetty and overnight; kept', () => {
  const f = Fu.defaultFuel(), endure = MODELS.e3.endure;
  assert.equal(Fu.elecLevel(f, 'skiff'), 1, 'full, never yet run');
  assert.equal(Fu.burnElec(f, 'skiff', 0, 60, endure), null);
  assert.equal(Fu.elecLevel(f, 'skiff'), 1, 'nothing at all in neutral');
  // Flat out: its endurance, to the second.
  let secs = 0;
  while (Fu.burnElec(f, 'skiff', 1, 1, endure) !== 'flat' && secs < 1e5) secs++;
  assert.ok(Math.abs(secs + 1 - endure) <= 1, `${secs + 1} s flat out`);
  assert.equal(Fu.burnElec(f, 'skiff', 1, 1, endure), null, 'flat stays flat');
  assert.equal(f.boats.skiff, Fu.TANKS.skiff, 'and her petrol untouched');
  // At the lever that holds her at an easy five knots: four times as long and more.
  Fu.chargeElec(f, 'skiff', 24);
  const easy = TRIALS.skiff['e3/matched'].lever;
  secs = 0;
  while (Fu.burnElec(f, 'skiff', easy, 1, endure) !== 'flat' && secs < 1e5) secs++;
  assert.ok(secs > endure * 4, `${secs} s at ${easy}`);
  // Charged at a jetty: half an hour's worth an hour; overnight, full.
  Fu.chargeElec(f, 'skiff', 1);
  assert.equal(Fu.elecLevel(f, 'skiff'), Fu.BATTERY_PER_HOUR);
  assert.equal(Fu.elecWords(f, 'skiff'), 'battery 50%');
  Fu.chargeElec(f, 'skiff', 24);
  assert.equal(Fu.elecLevel(f, 'skiff'), 1);
  // Kept in the save, and nonsense made sensible.
  f.elec.skiff = 0.3;
  assert.deepEqual(Fu.cleanFuel(JSON.parse(JSON.stringify(f))).elec, { skiff: 0.3 });
  assert.deepEqual(Fu.cleanFuel({ elec: { skiff: 7, row: 0.5, rib: -2, bass: 'x' } }).elec, { skiff: 1, rib: 0 });
  assert.deepEqual(Fu.cleanFuel(null).elec, {});
  assert.deepEqual(Fu.cleanFuel({ car: 10 }).elec, {}, 'a game from before it: nothing to say');
});

test('on the water: the slowest of her engines; what the yard quotes, measured on the boat; its range on its battery', () => {
  // As fitted: no petrol, a beat as even as can be, its own revs, a slim leg.
  assert.ok(e3.electric && e3.burn === 0 && e3.rpm === 1300 && e3.endure === MODELS.e3.endure && e3.kw === 3);
  assert.ok(e3.voice.electric && e3.voice.smooth === 1);
  assert.equal(e3.kg, MODELS.e3.kg - MODELS.p10.kg, 'her own engine’s weight off, its own and its battery’s on');
  // The yard's trial: slower than any petrol portable flat out, never quite her 'go' speed, and
  // held at its own easy pace, where it takes its share of the battery an hour.
  const T = TRIALS.skiff['e3/matched'], P6 = TRIALS.skiff['p6/matched'];
  assert.ok(T.top < P6.top && T.top * KN > 7.5 && T.top * KN < 10, `${(T.top * KN).toFixed(1)} kn`);
  assert.equal(T.t20, null);
  assert.ok(T.laden < T.top);
  assert.ok(T.kn === MODELS.e3.cruise && T.bph > 0 && T.lph === undefined);
  assert.ok(!TRIALS.skiff['e3/low'] && !TRIALS.skiff['e3/four'], 'its own propeller only');
  // (As fuel.js burnElec takes it at that lever: the table's lever is rounded, so to a hundredth.)
  const bph = (T.lever ** 1.5 * 3600) / MODELS.e3.endure;
  assert.ok(Math.abs(T.bph - bph) / bph < 0.01, `${T.bph} / ${bph}`);
  // Its range: a couple of nautical miles and more at an easy pace, less than a tank of petrol
  // takes her at her cruise.
  const nm = rangeAt(T, Fu.TANKS.skiff, 'skiff');
  assert.ok(Math.abs(nm - T.kn / T.bph) < 1e-9 && nm > 2 && nm < rangeAt(TRIALS.skiff['p10/matched'], Fu.TANKS.skiff, 'skiff'), `${nm.toFixed(1)} nm`);
  // A route planned for her (main.js routeBoat): its time at that pace, and its share of the
  // battery (in hundredths), cutting it fine past four-fifths of it.
  const pts = [[0, 0], [0, -1852]];
  const p = passage(pts, { knots: T.kn, lph: T.bph * 100, tank: 100 });
  assert.ok(Math.abs(p.hours - 1 / T.kn) < 1e-9 && Math.abs(p.litres - (T.bph * 100) / T.kn) < 1e-9 && !p.fine);
  assert.ok(passage([[0, 0], [0, -1852 * nm * 0.9]], { knots: T.kn, lph: T.bph * 100, tank: 100 }).fine);
  // The skiff alone takes it.
  for (const [k, C] of Object.entries(CATALOGUE)) assert.equal(C.models.includes('e3'), k === 'skiff', k);
});
