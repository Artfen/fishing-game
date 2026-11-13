// A fouled cooling intake (F3b, see engine.js): weed or a bag over it, and the heat she runs to
// with it, cool at dead slow and hot opened up; the alarm on and off with the throttle; cleared at
// sea; how often (never on Relaxed, more in weed and after a gale); kept through a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { newEngine, stepEngine, intakeHeat, foulChance, foul, clearIntake, engineSave, cleanEngine, FOUL_S, BLOCK_LO, BLOCK_HI, NEED_IDLE } = await import('../src/engine.js');

test('the heat she runs to: lightly fouled, hot only flat out; badly fouled, hot even at dead slow', () => {
  assert.equal(intakeHeat(0, 1), 0, 'a clean intake never heats her');
  assert.ok(intakeHeat(0.6, 0.5) < 0.6 && intakeHeat(0.6, 1) >= 0.6, 'lightly: the alarm only flat out');
  assert.ok(intakeHeat(0.75, 0.12) < 0.6 && intakeHeat(0.75, 0.5) >= 0.6, 'half covered: dead slow keeps her cool; half throttle doesn’t');
  assert.ok(intakeHeat(0.9, 0.12) >= 0.6 && intakeHeat(0.9, 0) < 0.6, 'badly: only idling keeps the alarm off');
  assert.ok(NEED_IDLE > 0 && NEED_IDLE < 0.5);
});

const runningEngine = (kind) => {
  const E = newEngine(kind);
  E.engines.forEach((e) => { e.run = true; e.rpm = 2000; });
  E.battery = true;
  E.cord = true;
  E.key = true;
  return E;
};
const run = (E, secs, opening) => {
  const ev = [];
  for (let t = 0; t < secs; t += 0.1) ev.push(...stepEngine(E, 0.1, { opening, power: opening, fuel: 20, wet: true, speed: 4 }).filter((x) => typeof x === 'string'));
  return ev;
};

test('in the engine: opened up the alarm goes, eased back it stops; cleared, she cools right down', () => {
  const E = runningEngine('rib');
  E.blocked = 0.75;
  assert.ok(run(E, 60, 1).includes('hot'), 'flat out with the intake half covered: the alarm');
  assert.ok(E.temp >= 0.6);
  assert.ok(run(E, 90, 0.1).includes('cool'), 'eased back to dead slow, it stops');
  assert.ok(E.temp < 0.6);
  E.blocked = 0.75;
  run(E, 60, 1);
  assert.equal(clearIntake(E), true);
  assert.equal(E.blocked, 0);
  run(E, 90, 1);
  assert.ok(E.temp < 0.05, `cleared, she runs cool flat out: ${E.temp}`);
  assert.equal(clearIntake(E), false, 'nothing on it to clear');
});

test('how often: never on Relaxed; more in weed, after a gale and on Realistic; most of the intake covered', () => {
  assert.equal(foulChance(1, { difficulty: 'relaxed', weedy: true, afterGale: true }), 0);
  const base = foulChance(1, { difficulty: 'standard' });
  assert.ok(Math.abs(base - 1 / FOUL_S) < 1e-12, 'about once in half an hour of motoring');
  assert.ok(Math.abs(foulChance(1, { difficulty: 'realistic' }) - 2 * base) < 1e-12);
  assert.ok(Math.abs(foulChance(1, { weedy: true, afterGale: true }) - 6 * base) < 1e-12);
  const E = newEngine('cabin');
  const by = foul(E, () => 0.3);
  assert.ok(by === 'weed' || by === 'bag');
  assert.ok(E.blocked >= BLOCK_LO && E.blocked <= BLOCK_HI);
  assert.equal(foul(E), null, 'fouled once is enough');
  assert.equal(foul(newEngine('jetski')), null, 'a jet ski has no intake of this kind');
});

test('kept through a save; an older save’s intakes are clear', () => {
  const E = newEngine('cruiser');
  E.blocked = 0.82;
  const S = engineSave(E);
  assert.equal(S.blocked, 0.82);
  assert.equal(cleanEngine('cruiser', S).blocked, 0.82);
  assert.equal(cleanEngine('cruiser', { battery: true }).blocked, 0, 'an older save');
  assert.equal(cleanEngine('cruiser', { blocked: 7 }).blocked, 1);
  assert.equal(engineSave(newEngine('rib')).blocked, undefined, 'nothing saved for a clear intake');
  assert.equal(cleanEngine('jetski', { blocked: 0.5 }).blocked, 0);
});
