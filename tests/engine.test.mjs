// Engines that start like engines (src/engine.js): what each boat needs to start, the one-button
// start doing the same steps, revs and idle, cooling, a dry tank, a flat battery that's never the
// end of a trip, the save, and trim and tilt in the real hull physics.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const E = await import('../src/engine.js');
const { Boat } = await import('../src/boat.js');
const { LEVERS } = await import('../src/throttle.js');
const { cleanSettings } = await import('../src/settings.js');

const seq = (...xs) => { let i = 0; return () => xs[Math.min(i++, xs.length - 1)]; };
const run = (en, secs, ctx = {}, rnd = () => 0.5) => {
  const ev = [];
  for (let i = 0; i < secs * 30; i++) ev.push(...E.stepEngine(en, 1 / 30, { fuel: 50, wet: true, ...ctx }, rnd));
  return ev;
};

test('every motorboat has an engine room; the kayak, the oars, the sails and the board have nothing to start', () => {
  for (const k of ['skiff', 'sail', 'bass', 'cabin', 'console', 'rib', 'cruiser', 'jetski']) assert.ok(E.hasEngine(k), k);
  for (const k of ['row', 'kayak', 'windsurf']) assert.equal(E.hasEngine(k), false, k);
  assert.equal(E.PROFILES.console.engines, 2);
  assert.equal(E.PROFILES.cruiser.engines, 2);
  assert.ok(E.PROFILES.cruiser.diesel && !E.PROFILES.cruiser.trim, 'the yacht: diesels, no outboard leg');
  assert.equal(E.PROFILES.skiff.starter, 'pull');
});

test('the RIB starts the way a real one does: battery, cord, neutral, key, then the starter turns her over and she catches', () => {
  const en = E.newEngine('rib');
  let r = E.act(en, 'start', { lever: 0 });
  assert.equal(r.ok, false);
  assert.match(r.why, /battery switch/);
  E.act(en, 'battery');
  assert.match(E.act(en, 'start', { lever: 0 }).why, /kill cord/);
  E.act(en, 'cord');
  assert.match(E.act(en, 'start', { lever: 0.2 }).why, /neutral/, 'the neutral safety switch');
  assert.match(E.act(en, 'start', { lever: 0 }).why, /key/);
  r = E.act(en, 'key');
  assert.ok(r.events.includes('selftest'), 'the alarm sounds its self-test as the key goes on');
  r = E.act(en, 'start', { lever: 0 });
  assert.ok(r.ok && r.events.includes('crank'));
  assert.ok(E.cranking(en) && !E.running(en));
  const ev = run(en, 2);
  assert.ok(ev.includes('catch') && E.running(en));
  run(en, 3);
  assert.ok(Math.abs(E.rpmOf(en) - E.PROFILES.rib.idle) < 60, `she settles at idle: ${E.rpmOf(en).toFixed(0)} rpm`);
  run(en, 3, { opening: 1 });
  assert.ok(E.rpmOf(en) > 5500, 'and the revs follow the throttle');
  // Unclipping the kill cord stops her; so does the key.
  r = E.act(en, 'cord');
  assert.ok(r.events.includes('stop') && !E.running(en));
});

test('no propulsion with the engine off, half of it on one of twin engines', () => {
  const en = E.newEngine('console');
  assert.equal(E.runShare(en), 0);
  en.engines[0].run = true;
  assert.equal(E.runShare(en), 0.5);
  en.engines[1].run = true;
  assert.equal(E.runShare(en), 1);
  en.temp = 1;
  assert.ok(E.runShare(en) > 0 && E.runShare(en) < 0.5, 'overheated, she runs on gently: never stopped dead');
  assert.equal(E.runShare(null), 1, 'no engine room: as ever');
});

test('the one-button start runs the same steps, one at a time, and ends with her running', () => {
  for (const k of ['rib', 'console', 'cruiser', 'bass', 'jetski', 'cabin']) {
    const en = E.newEngine(k);
    const steps = E.assist(en, { lever: 0 });
    assert.equal(steps.at(-1), 'start', k);
    const ev = run(en, 10, { lever: 0 });
    const did = ev.filter((e) => e.step).map((e) => e.step);
    assert.deepEqual(did, steps, `${k}: did what it said`);
    assert.ok(E.allRunning(en), `${k}: running`);
    assert.equal(en.auto, null);
  }
  // In gear: it knocks her into neutral first (a step the game carries out).
  const en = E.newEngine('rib');
  assert.equal(E.assist(en, { lever: 0.3 }).includes('neutral'), true);
});

test('a cold diesel without its preheat takes a long while to catch; preheated, she goes', () => {
  const cold = E.newEngine('cruiser');
  E.act(cold, 'battery');
  E.act(cold, 'key');
  E.act(cold, 'start', { lever: 0 }, null, () => 0);
  let t = 0;
  while (!E.allRunning(cold) && t < 10) { run(cold, 0.1); t += 0.1; }
  const warm = E.newEngine('cruiser');
  E.act(warm, 'battery');
  E.act(warm, 'key');
  E.act(warm, 'glow');
  run(warm, 3.2);
  assert.equal(warm.glow, 1);
  E.act(warm, 'start', { lever: 0 }, null, () => 0);
  let u = 0;
  while (!E.allRunning(warm) && u < 10) { run(warm, 0.1); u += 0.1; }
  assert.ok(E.allRunning(cold) && E.allRunning(warm), 'both start in the end');
  assert.ok(t > u + 1.5, `cold ${t.toFixed(1)} s, preheated ${u.toFixed(1)} s`);
});

test('the skiff’s pull-start: two or three pulls cold, never more; first pull warm', () => {
  for (let trial = 0; trial < 20; trial++) {
    const en = E.newEngine('skiff');
    E.act(en, 'cord');
    let pulls = 0;
    while (!E.running(en)) {
      E.act(en, 'pull', { lever: 0, fuel: 10 });
      pulls++;
      assert.ok(pulls <= 3);
    }
  }
  const en = E.newEngine('skiff');
  E.act(en, 'cord');
  en.warm = 1;
  E.act(en, 'pull', { lever: 0, fuel: 10 }, null, () => 0.5);
  assert.ok(E.running(en));
});

test('a dry tank: she cranks but won’t catch, and running dry she coughs and stalls', () => {
  const en = E.newEngine('rib');
  E.act(en, 'battery'); E.act(en, 'cord'); E.act(en, 'key');
  E.act(en, 'start', { lever: 0 });
  const ev = run(en, 4, { fuel: 0 });
  assert.ok(ev.includes('dry') && !E.running(en));
  E.act(en, 'start', { lever: 0 });
  run(en, 2);
  assert.ok(E.running(en));
  assert.ok(run(en, 0.2, { fuel: 0 }).includes('stall') && !E.running(en));
});

test('a flat battery only clicks; running charges it again', () => {
  const en = E.newEngine('rib');
  E.act(en, 'battery'); E.act(en, 'cord'); E.act(en, 'key');
  en.charge = 0.05;
  const r = E.act(en, 'start', { lever: 0 });
  assert.equal(r.ok, false);
  assert.ok(r.events.includes('click'));
  assert.match(r.why, /flat/);
  en.charge = 0.3;
  E.act(en, 'start', { lever: 0 });
  run(en, 2);
  const before = en.charge;
  run(en, 20);
  assert.ok(en.charge > before + 0.15, 'the alternator charges it');
});

test('with the cooling intake out of the water she overheats, the alarm goes, and she cools again', () => {
  const en = E.newEngine('rib');
  en.engines[0].run = true; en.battery = en.cord = en.key = true;
  const hot = run(en, 20, { wet: false });
  assert.ok(hot.includes('hot'));
  run(en, 10, { wet: false });
  assert.equal(en.temp, 1);
  assert.ok(E.running(en), 'still running, gently');
  const cool = run(en, 40, { wet: true });
  assert.ok(cool.includes('cool') && en.temp < 0.2);
});

test('trim: in and out within its range under way, tilt right up only when slow', () => {
  const en = E.newEngine('rib');
  for (let i = 0; i < 100; i++) E.trimBy(en, 1, 0.1, 12);
  assert.equal(en.trim, E.TRIM.max, 'at speed it stops at the top of the trim range');
  assert.equal(E.trimBy(en, 1, 0.1, 12), 'fast');
  for (let i = 0; i < 100; i++) E.trimBy(en, 1, 0.1, 0);
  assert.equal(en.trim, E.TRIM.up, 'at rest it tilts on up');
  for (let i = 0; i < 100; i++) E.trimBy(en, -1, 0.1, 0);
  assert.equal(en.trim, E.TRIM.min);
  assert.equal(E.trimBy(E.newEngine('cruiser'), 1, 1, 0), null, 'no leg on the yacht');
  assert.ok(E.bestTrim(0) < 0 && E.bestTrim(15) > 3, 'right in to get onto the plane, out a little once flying');
  const T = E.trimEffect({ ...en, trim: 50 }, 0);
  assert.ok(T.out && T.eff === 0 && !T.wet, 'tilted right up: the propeller is out of the water');
  const auto = E.trimEffect({ ...en, trim: 0 }, 15, true);
  assert.equal(auto.err, 0);
  assert.equal(auto.eff, 1, 'trimming herself: as the game has always driven her');
});

test('in the water: with the engine off she doesn’t go; trimmed right she’s fastest; tilted up she barely moves', () => {
  const scene = new THREE.Scene();
  let clock = 0;
  const drive = (setup, secs = 25) => {
    const b = new Boat(scene, { kind: 'rib' });
    b.place(150, 330, 0);
    setup(b);
    const full = LEVERS.rib.at(-1).v;
    for (let i = 0; i < secs * 30; i++) {
      clock += 1 / 30;
      b.update(1 / 30, clock, full, 0, 0);
    }
    return b.forwardSpeed;
  };
  const on = (trim, auto = false) => (b) => {
    b.engine = E.newEngine('rib');
    b.engine.engines[0].run = true;
    b.engine.trim = trim;
    b.trimAuto = auto;
  };
  const off = drive((b) => { b.engine = E.newEngine('rib'); });
  assert.ok(Math.abs(off) < 0.3, `engine off: ${off.toFixed(2)} m/s`);
  const asEver = drive(() => {});
  const auto = drive(on(0, true));
  assert.ok(Math.abs(auto - asEver) < 0.05, `trimming herself she goes as ever: ${auto.toFixed(2)} vs ${asEver.toFixed(2)} m/s`);
  const right = drive(on(6)), flatIn = drive(on(-4)), tooFar = drive(on(16));
  assert.ok(right > flatIn + 0.4, `trimmed out a little, quicker than tucked right in: ${right.toFixed(2)} vs ${flatIn.toFixed(2)} m/s`);
  assert.ok(right > tooFar + 0.4, `and quicker than trimmed right out, drawing air: ${right.toFixed(2)} vs ${tooFar.toFixed(2)} m/s`);
  const up = drive(on(50), 10);
  assert.ok(up < 0.5, `tilted right up: ${up.toFixed(2)} m/s`);
});

test('the save keeps the switches, the battery and the trim; a running engine comes back off', () => {
  const en = E.newEngine('rib');
  E.act(en, 'battery'); E.act(en, 'cord'); E.act(en, 'key');
  en.engines[0].run = true;
  en.charge = 0.62;
  en.trim = 8;
  const back = E.cleanEngine('rib', JSON.parse(JSON.stringify(E.engineSave(en))));
  assert.deepEqual([back.battery, back.cord, back.charge, back.trim], [true, true, 0.62, 8]);
  assert.equal(E.running(back), false);
  assert.equal(back.key, false);
  const junk = E.cleanEngine('rib', { battery: 'yes', charge: 9, trim: -90 });
  assert.deepEqual([junk.battery, junk.charge, junk.trim], [false, 1, E.TRIM.min]);
  assert.equal(E.cleanEngine('row', {}), null);
});

test('the Start-up setting: three choices, getting in and going unless chosen otherwise', () => {
  assert.equal(cleanSettings({}).controls.start, 'go');
  assert.equal(cleanSettings({ controls: { start: 'full' } }).controls.start, 'full');
  assert.equal(cleanSettings({ controls: { start: 'nope' } }).controls.start, 'go');
  assert.deepEqual(E.START_IDS, ['full', 'simple', 'go']);
});

test('every boat with an engine has an engine room, and nothing without one does', async () => {
  const { HULLS } = await import('../src/boat.js');
  for (const [kind, H] of Object.entries(HULLS)) {
    const engined = !!(H.motor || H.outboard);
    assert.equal(E.hasEngine(kind), engined, `${kind}: ${engined ? 'an engine to start' : 'nothing to start'}`);
    if (!engined) continue;
    // (And she can be started, the one-button way, from cold.)
    const en = E.newEngine(kind);
    E.assist(en, { lever: 0 });
    for (let i = 0; i < 300; i++) E.stepEngine(en, 1 / 30, { fuel: 50, wet: true, lever: 0 }, () => 0.5);
    assert.ok(E.allRunning(en), `${kind} starts`);
  }
});

test('the tilt button: one press right up at rest (not under way), the next back down; the leg travels by itself', () => {
  for (const kind of ['rib', 'console', 'skiff']) {
    const en = E.newEngine(kind);
    assert.deepEqual(E.tiltToggle(en, 4), { why: 'fast' }, `${kind}: not while she's going`);
    assert.deepEqual(E.tiltToggle(en, 0.5), { to: 'up' });
    assert.equal(E.tiltedUp(en), true, 'up (on its way)');
    let secs = 0;
    while (E.stepTilt(en, 1 / 30)) secs += 1 / 30;
    assert.equal(en.trim, E.TRIM.up, `${kind}: right up`);
    assert.ok(secs > 1 && secs < 5, `in ${secs.toFixed(1)} s`);
    assert.ok(E.trimEffect(en, 0).out, 'the propeller out of the water');
    // Pressed again (at any speed): back down, to run.
    assert.deepEqual(E.tiltToggle(en, 4), { to: 'down' });
    while (E.stepTilt(en, 1 / 30));
    assert.equal(en.trim, 0);
    assert.equal(E.tiltedUp(en), false);
    // Pressed again on its way up: it turns round.
    E.tiltToggle(en, 0);
    E.stepTilt(en, 0.5);
    assert.deepEqual(E.tiltToggle(en, 0), { to: 'down' });
  }
  assert.deepEqual(E.tiltToggle(E.newEngine('cruiser'), 0), { why: 'none' }, 'no leg to tilt on the yacht');
  assert.deepEqual(E.tiltToggle(E.newEngine('jetski'), 0), { why: 'none' });
});

test('an outboard tilts up and aft, the propeller out behind the transom, not forward into the boat', () => {
  const scene = new THREE.Scene();
  for (const kind of ['rib', 'console', 'skiff']) {
    const b = new Boat(scene, { kind });
    b.place(150, 330, 0);
    b.engine = E.newEngine(kind);
    const propAt = () => {
      for (let i = 0; i < 60; i++) b.update(1 / 30, i / 30, 0, 0, 0);
      b.body.updateMatrixWorld(true);
      return b.props.map((p) => b.body.worldToLocal(p.getWorldPosition(new THREE.Vector3())));
    };
    const down = propAt();
    b.engine.trim = E.TRIM.up;
    const up = propAt();
    const stern = Math.min(...b.motorGroups.map((g) => g.position.z));
    up.forEach((p, i) => {
      assert.ok(p.z < stern, `${kind}: the propeller behind the transom (${p.z.toFixed(2)} vs ${stern.toFixed(2)})`);
      assert.ok(p.y > down[i].y + 0.4, `${kind}: and well up (${down[i].y.toFixed(2)} → ${p.y.toFixed(2)})`);
      assert.ok(p.z < down[i].z, `${kind}: aft, not forward (${down[i].z.toFixed(2)} → ${p.z.toFixed(2)})`);
    });
  }
});
