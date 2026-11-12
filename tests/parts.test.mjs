// Marine physics C5b (docs/IMPROVEMENTS.md): her working parts hurt only by what can hurt them
// (damage.js legStrike, rudderStrike, shake; boat.js propStrike, takeDamage, jolt): her steering
// bent by a strike on the bottom, her outboard's bracket worked loose by a harder one, her battery
// terminal shaken loose by hard landings. What each does to her, what doing them up at sea puts
// right, and the yard's bill. None of it on Relaxed.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat } = await import('../src/boat.js');
const { newEngine, blocker, cutOut, running } = await import('../src/engine.js');
const DM = await import('../src/damage.js');

const scene = new THREE.Scene();
const S = DM.MODES.standard;

test('a strike on the bottom bends her steering only fast, the way the blow pushed it; harder, her bracket works loose; on Relaxed, nothing', () => {
  const D = () => DM.newDamage();
  // Creeping onto a bank: the propeller dings (C3a), the steering doesn't notice.
  assert.equal(DM.legStrike(D(), { speed: 4, side: 0.5 }, S), null);
  const a = D(), r = DM.legStrike(a, { speed: 10, side: 0.8 }, S);
  assert.deepEqual(r.parts, ['steer', 'mount']);
  // (Going sideways to port as it struck: the leg's pushed to starboard, and she pulls that way.)
  assert.ok(a.steer.bend < 0 && a.steer.loss > 0 && a.mount > 0);
  const b = D();
  DM.legStrike(b, { speed: 10, side: -0.8 }, S);
  assert.ok(b.steer.bend > 0, 'the other way, the other way');
  // Between the two: the steering, not the bracket.
  assert.deepEqual(DM.legStrike(D(), { speed: 7, side: 0.2 }, S).parts, ['steer']);
  // Never past what a bent leg can be; Realistic worse than Standard; Relaxed, nothing.
  const many = D();
  for (let i = 0; i < 30; i++) DM.legStrike(many, { speed: 16, side: 1 }, S);
  assert.ok(Math.abs(many.steer.bend) <= DM.PARTS.steer.most + 1e-9 && many.mount <= 1);
  const real = D();
  DM.legStrike(real, { speed: 10, side: 0.8 }, DM.MODES.realistic);
  assert.ok(Math.abs(real.steer.bend) > Math.abs(a.steer.bend) && real.mount > a.mount);
  assert.equal(DM.legStrike(D(), { speed: 16, side: 1 }, DM.MODES.relaxed), null);
  // A rudder's foot is more delicate than a leg: a knock square on at a walking pace bends it.
  assert.equal(DM.rudderStrike(D(), { vn: 1.2, side: 0.3 }, S), null);
  const ru = D();
  assert.deepEqual(DM.rudderStrike(ru, { vn: 2.5, side: 0.3 }, S).parts, ['steer']);
  assert.ok(ru.steer.bend !== 0);
});

test('hard landings shake her battery terminal loose, the harder the faster; soft ones never; loose, the next hard jolt cuts her', () => {
  const D = DM.newDamage();
  // A hundred ordinary landings off the chop: nothing.
  for (let i = 0; i < 100; i++) assert.equal(DM.shake(D, 2.2, S), null);
  assert.equal(D.wiring.shock, 0);
  // Two big ones off a wave: loose.
  assert.equal(DM.shake(D, 5, S), null);
  assert.equal(DM.shake(D, 5, S), 'loose');
  assert.ok(D.wiring.loose);
  // Middling ones take many more.
  const M = DM.newDamage();
  let n = 0;
  while (!M.wiring.loose && n < 100) { DM.shake(M, 3.5, S); n++; }
  assert.ok(n > 8 && n < 40, `${n} landings at 3.5 m/s`);
  // Loose: a hard jolt cuts her, a soft one doesn't.
  assert.equal(DM.shake(D, 1.5, S), null);
  assert.equal(DM.shake(D, 4, S), 'cut');
  // Relaxed: never.
  const R = DM.newDamage();
  for (let i = 0; i < 20; i++) assert.equal(DM.shake(R, 8, DM.MODES.relaxed), null);
  // Done up at sea, for good.
  assert.ok(DM.tighten(D, 'terminal'));
  assert.ok(!D.wiring.loose && D.wiring.shock === 0);
  assert.equal(DM.tighten(D, 'terminal'), false);
});

test('loose, the starter only clicks and the engine cuts out; a pull-start outboard has no terminal to lose', () => {
  const E = newEngine('console');
  E.battery = true;
  E.cord = true;
  E.key = true;
  assert.equal(blocker(E), null);
  E.loose = true;
  assert.equal(blocker(E).id, 'loose');
  for (const e of E.engines) e.run = true;
  assert.ok(cutOut(E));
  assert.ok(!running(E));
  // The skiff's outboard: no battery, nothing to shake loose.
  const K = new Boat(scene, { kind: 'skiff' });
  K.engine = newEngine('skiff');
  K.damage = DM.newDamage();
  for (let i = 0; i < 6; i++) K.jolt(6);
  assert.ok(!K.damage.wiring.loose);
  // The RIB's, as she lands off a wave.
  const B = new Boat(scene, { kind: 'rib' });
  B.engine = newEngine('rib');
  B.damage = DM.newDamage(true);
  const said = [];
  B.onDamage = (bt, r) => said.push(r.wiring);
  for (let i = 0; i < 3; i++) B.jolt(5.2);
  assert.ok(B.damage.wiring.loose);
  assert.deepEqual(said, ['loose', 'cut']);
});

// Driven ahead at `lever` from (x0, z0) heading `heading` for `secs`: her heading change (rad) and
// best speed.
const drive = (kind, prep, { x0 = 400, z0 = 1200, heading = -Math.PI / 2, lever = 0.6, secs = 12 } = {}) => {
  const b = new Boat(scene, { kind });
  b.place(x0, z0, heading);
  const E = (b.engine = newEngine(kind));
  for (const e of E.engines) e.run = true;
  b.damage = DM.newDamage(DM.TUBED.has(kind));
  prep?.(b);
  let vmax = 0;
  for (let i = 0; i < secs * 30; i++) {
    b.motor = true;
    b.lever = lever;
    b.update(1 / 30, i / 30, lever, 0, 0);
    vmax = Math.max(vmax, b.speed);
  }
  let turn = b.heading - heading;
  turn = Math.atan2(Math.sin(turn), Math.cos(turn));
  return { b, turn, vmax };
};

test('bent, she pulls off her course and the wheel sits off centre to hold her; a loose bracket costs her push; sound, as before', () => {
  // (Out at sea, hands off the helm: the little corrections a helmsman makes without thinking hold
  // her near her course (see holdCourse), so a bent leg shows as a wheel held over against it and
  // a few degrees she can't quite make up.)
  const sound = drive('console'), port = drive('console', (b) => { b.damage.steer.bend = 0.05; }), stbd = drive('console', (b) => { b.damage.steer.bend = -0.05; });
  assert.ok(Math.abs(port.turn - sound.turn) > 0.05, `pulled ${(((port.turn - sound.turn) * 180) / Math.PI).toFixed(1)}°`);
  assert.ok(Math.sign(port.turn - sound.turn) === -Math.sign(stbd.turn - sound.turn), 'each its own way');
  assert.ok(Math.abs(port.b.helm - sound.b.helm) > 0.03, `the wheel held over: ${port.b.helm.toFixed(2)} against ${sound.b.helm.toFixed(2)}`);
  assert.ok(Math.sign(port.b.helm - sound.b.helm) === -Math.sign(stbd.b.helm - sound.b.helm));
  const loose = drive('console', (b) => { b.damage.mount = 0.8; }, { lever: 1, secs: 20 }), full = drive('console', null, { lever: 1, secs: 20 });
  assert.ok(loose.vmax < full.vmax * 0.95, `${loose.vmax.toFixed(1)} against ${full.vmax.toFixed(1)} m/s`);
  // No record kept at all, and a sound one: the same to the last digit.
  const none = drive('console', (b) => { b.damage = null; });
  assert.equal(none.turn, sound.turn);
  assert.equal(none.vmax, sound.vmax);
});

test('driven onto the strand flat out, her leg left down: the strike bends her steering and works her bracket; on Relaxed, nothing', () => {
  // (As propulsion.test.mjs: the RIB run west at the strand's shoal, her leg yours to trim.)
  const run = (mode) => drive('rib', (b) => {
    b.engine.trim = 2;
    b.trimAuto = false;
    b.propStrikes = mode === 'relaxed' ? null : 'on';
    b.damageMode = DM.MODES[mode];
  }, { x0: 200, z0: 21, heading: -Math.PI / 2, lever: 1, secs: 14 });
  const std = run('standard');
  assert.ok(Math.abs(std.b.damage.steer.bend) > 0.005, JSON.stringify(std.b.damage.steer));
  assert.ok(std.b.damage.mount > 0.1, `bracket ${std.b.damage.mount}`);
  const rel = run('relaxed');
  assert.ok(!DM.partsHurt(rel.b.damage));
});

test('the record kept, cleaned and shown; done up at sea most of the way; the yard’s bill and its work', () => {
  const D = DM.newDamage();
  D.steer.bend = -0.03;
  D.steer.loss = 0.2;
  D.mount = 0.7;
  D.wiring.loose = true;
  assert.ok(DM.partsHurt(D) && !DM.sound(D));
  const saved = DM.damageSave(D), back = DM.cleanDamage(saved);
  assert.deepEqual(back.steer, D.steer);
  assert.equal(back.mount, 0.7);
  assert.ok(back.wiring.loose);
  // Junk: sound; a bend past what's possible, held to it.
  const junk = DM.cleanDamage({ steer: { bend: 9, loss: 'x' }, mount: -3, wiring: { loose: 'yes' } });
  assert.equal(junk.steer.bend, DM.PARTS.steer.most);
  assert.equal(junk.steer.loss, 0);
  assert.equal(junk.mount, 0);
  assert.equal(junk.wiring.loose, false);
  // What a look finds.
  const what = DM.survey(D, 'console').filter((r) => r.bad > 0.02).map((r) => r.what);
  assert.ok(what.includes('steering') && what.includes('the engine’s bracket') && what.includes('the battery terminal'));
  assert.match(DM.steerWords(D), /pulls to port/);
  // The bracket's bolts done up at sea: most of the way, once.
  assert.ok(DM.tighten(D, 'mount'));
  assert.equal(D.mount, DM.PARTS.mount.tight);
  assert.ok(D.tightened);
  assert.equal(DM.tighten(D, 'mount'), false);
  // The bill: a job for each, priced; done, she's sound.
  const bill = DM.repairs(D, 'console', 1650).map((r) => r.id);
  assert.deepEqual(bill, ['steer', 'mount', 'wiring']);
  DM.mend(D, 'all');
  assert.ok(DM.sound(D));
});
