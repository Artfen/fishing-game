// Controller vibration (src/haptics.js): the mix of steady feelings and short ones, the strength
// setting, never anything left buzzing, and what's sent to the controller.
import test from 'node:test';
import assert from 'node:assert/strict';
import { Haptics, PULSES, STRENGTHS, STRENGTH_IDS, engineFeel, lineFeel, slamFeel, knockFeel } from '../src/haptics.js';
import { cleanSettings as sanitizeSettings } from '../src/settings.js';

const run = (h, secs, dt = 1 / 60) => {
  for (let t = 0; t < secs; t += dt) h.update(dt);
};
const recorder = () => {
  const sent = [];
  const out = (strong, weak, lt, rt, ms) => sent.push({ strong, weak, lt, rt, ms });
  return { sent, out };
};

test('a pulse is felt, then fades to nothing and the controller is told to stop', () => {
  const { sent, out } = recorder();
  const h = new Haptics(out);
  h.pulse('hookset');
  h.update(1 / 60);
  assert.ok(sent.length === 1 && sent[0].strong > 0.8 && sent[0].rt > 0.8, 'the hook going home is a hard thump, in the reel trigger too');
  run(h, 0.5);
  const last = sent[sent.length - 1];
  assert.deepEqual([last.strong, last.weak, last.lt, last.rt, last.ms], [0, 0, 0, 0, 0]);
  assert.equal(h.pulses.length, 0);
});

test('a steady feeling stays while it is set each frame, and dies away once it is not', () => {
  const h = new Haptics(() => {});
  for (let i = 0; i < 60; i++) {
    h.hold('engine', 0.1, 0.2);
    h.update(1 / 60);
  }
  assert.ok(h.mix.weak > 0.15, 'the engine is felt while it runs');
  run(h, 1);
  assert.equal(h.mix.weak + h.mix.strong, 0, 'and not a moment after it stops');
  assert.equal(h.steady.size, 0);
});

test('feelings add up without ever passing full strength', () => {
  const h = new Haptics(() => {});
  h.pulse('snap');
  h.pulse('hookset');
  h.pulse('strike');
  h.hold('line', 1, 1, { rt: 1 });
  h.update(1 / 60);
  for (const k of ['strong', 'weak', 'lt', 'rt']) assert.ok(h.mix[k] <= 1 && h.mix[k] >= 0, k);
  const a = new Haptics(() => {});
  a.pulse('run');
  a.update(1 / 60);
  const b = new Haptics(() => {});
  b.pulse('run');
  b.hold('line', 0.3, 0.1);
  b.update(1 / 60);
  assert.ok(b.mix.strong > a.mix.strong, 'a run on top of the weight on the line is felt more than either');
});

test('the strength setting scales everything, and Off sends nothing at all', () => {
  const feelAt = (id) => {
    const h = new Haptics(() => {});
    h.setStrength(id);
    h.pulse('bite');
    h.update(1 / 60);
    return h.mix.strong;
  };
  assert.ok(feelAt('light') < feelAt('normal') && feelAt('normal') < feelAt('strong'));
  const { sent, out } = recorder();
  const off = new Haptics(out);
  off.setStrength('off');
  off.pulse('hookset');
  off.hold('engine', 1, 1);
  run(off, 0.5);
  assert.equal(sent.length, 0);
  assert.deepEqual(STRENGTH_IDS, Object.keys(STRENGTHS));
});

test('in a menu, or with the controller put down, everything stops at once', () => {
  const { sent, out } = recorder();
  const h = new Haptics(out);
  h.hold('engine', 0.2, 0.3);
  h.pulse('thunder');
  h.update(1 / 60);
  assert.ok(sent.at(-1).strong > 0);
  h.live = false;
  h.update(1 / 60);
  assert.equal(sent.at(-1).strong + sent.at(-1).weak, 0);
  assert.equal(h.pulses.length + h.steady.size, 0);
});

test('a smooth hum is sent now and then; a rattle (the drag, the starter) often enough to feel', () => {
  const count = (hold) => {
    const { sent, out } = recorder();
    const h = new Haptics(out);
    for (let i = 0; i < 60; i++) {
      hold(h);
      h.update(1 / 60);
    }
    return sent.length;
  };
  const hum = count((h) => h.hold('engine', 0.1, 0.2));
  const rattle = count((h) => h.hold('drag', 0, 0.5, { rt: 0.5, buzz: 10 }));
  assert.ok(hum <= 14, `a hum: ${hum} sends a second`);
  assert.ok(rattle >= 18, `a rattle: ${rattle} sends a second (on and off ten times a second)`);
  // (Each effect outlasts the gap to the next, so a steady feeling never stutters.)
  const { sent, out } = recorder();
  const h = new Haptics(out);
  for (let i = 0; i < 30; i++) {
    h.hold('engine', 0.1, 0.2);
    h.update(1 / 60);
  }
  assert.ok(sent.every((s) => s.ms === 0 || s.ms >= 100));
});

test('every pulse is a sensible recipe', () => {
  for (const [name, P] of Object.entries(PULSES)) {
    for (const k of ['strong', 'weak', 'lt', 'rt']) assert.ok((P[k] ?? 0) >= 0 && (P[k] ?? 0) <= 1, `${name}.${k}`);
    assert.ok(P.ms > 0 && P.ms <= 2000, name);
    assert.ok(['thump', 'swell', 'flat'].includes(P.shape), name);
  }
  assert.ok(PULSES.hookset.strong > PULSES.bite.strong && PULSES.bite.strong > PULSES.nibble.strong, 'a nibble, a bite, the hook going home: each harder than the last');
});

test('the engine builds with the revs; a fish on is felt by its weight, and the drag buzzes as it slips', () => {
  const idle = engineFeel(0), full = engineFeel(1);
  assert.ok(idle.weak > 0 && full.weak > idle.weak && full.strong > idle.strong);
  assert.ok(engineFeel(1, { inboard: true }).strong > full.strong, 'the big inboards are heavier');
  assert.ok(engineFeel(1, { electric: true }).weak < idle.weak + 0.1, 'an electric motor barely');
  assert.deepEqual(engineFeel(1, { running: false }), { strong: 0, weak: 0 });
  const light = lineFeel(0.2), heavy = lineFeel(0.9);
  assert.ok(heavy.weight.strong > light.weight.strong * 2 && heavy.weight.rt > light.weight.rt);
  assert.equal(light.drag, null);
  const slip = lineFeel(0.6, true, 0.8);
  assert.ok(slip.drag.buzz > 0 && slip.drag.weak > 0.3);
  assert.equal(slamFeel(1), 0);
  assert.ok(slamFeel(3) > 0 && slamFeel(10) === 1);
  assert.ok(knockFeel(6) > knockFeel(1.5));
});

test('the Vibration setting: four strengths, and an old on/off choice kept', () => {
  assert.equal(sanitizeSettings({}).controls.vibration, 'normal');
  assert.equal(sanitizeSettings({ controls: { rumble: false } }).controls.vibration, 'off');
  assert.equal(sanitizeSettings({ controls: { rumble: true } }).controls.vibration, 'normal');
  assert.equal(sanitizeSettings({ controls: { vibration: 'strong' } }).controls.vibration, 'strong');
  assert.equal(sanitizeSettings({ controls: { vibration: 'max!!' } }).controls.vibration, 'normal');
});
