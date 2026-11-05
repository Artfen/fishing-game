// Expert technique (src/technique.js, and the lure, the strike and the fight in fishing.js and
// fight.js): the rod follows your hands; lifting pulls the lure, dropping gives it slack, a snap
// twitches it, a popper pops, a stick bait walks; a hard sweep sets the hook home; pumping gains
// line and a raised rod cushions a surge. Same fish, same lure: nothing here makes a bite.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const T = await import('../src/technique.js');
const { newFight, stepFight, DIFFICULTY } = await import('../src/fight.js');
const { fishById } = await import('../src/fish.js');
const { cleanSettings } = await import('../src/settings.js');

const hold = (R, up, across, secs, dt = 1 / 60) => {
  const out = { pull: 0, slack: 0, twitch: 0, pops: 0, walks: [] };
  for (let t = 0; t < secs; t += dt) {
    T.rodStep(R, up, across, dt);
    const m = T.lureFromRod('walk', R, dt);
    out.pull += m.pull;
    out.slack += m.slack;
    out.twitch = Math.max(out.twitch, m.twitch);
    if (m.walk) out.walks.push(m.walk);
  }
  return out;
};

test('the rod follows the stick: up lifts it, down drops it, let go and it comes back to rest', () => {
  const R = T.newRod();
  hold(R, 1, 0, 0.5);
  assert.ok(R.pitch > 0.95);
  hold(R, -1, 0, 0.5);
  assert.ok(R.pitch < 0.05);
  hold(R, 0, 0, 0.5);
  assert.ok(Math.abs(R.pitch - T.REST) < 0.02);
  hold(R, 0, -1, 0.5);
  assert.ok(R.yaw < -0.95, 'and across sweeps it');
});

test('lifting draws the lure through the water, as far as the tip travels; dropping gives it slack', () => {
  const R = T.newRod();
  const up = hold(R, 1, 0, 0.6);
  assert.ok(Math.abs(up.pull - T.TIP_TRAVEL * (1 - T.REST)) < 0.08, `${up.pull.toFixed(2)} m drawn in`);
  const down = hold(R, -1, 0, 0.6);
  assert.ok(down.slack > 1.5 && down.pull < 0.01);
  // A slow lift draws as far, but no twitch; a snap is seen.
  const slow = T.newRod();
  let tw = 0;
  for (let i = 0; i < 120; i++) {
    T.rodStep(slow, Math.min(1, i / 120), 0, 1 / 60);
    tw = Math.max(tw, T.lureFromRod('wobble', slow, 1 / 60).twitch);
  }
  assert.equal(tw, 0, 'a slow lift: no twitch');
  assert.ok(up.twitch > 0.6, 'a snap: a twitch the fish see');
});

test('a popper pops on a sharp snap down; a stick bait walks on even sweeps, and keeps time', () => {
  const R = T.newRod();
  hold(R, 0.5, 0, 0.4);
  let pops = 0;
  for (let i = 0; i < 12; i++) {
    T.rodStep(R, -1, 0, 1 / 60);
    if (T.lureFromRod('pop', R, 1 / 60).pop) pops++;
  }
  assert.ok(pops >= 1);
  const W = T.newRod();
  const steps = [];
  let rhythm = 0;
  for (let k = 0; k < 8; k++) {
    const side = k % 2 ? 1 : -1;
    for (let i = 0; i < 24; i++) {
      T.rodStep(W, 0, side, 1 / 60);
      const m = T.lureFromRod('walk', W, 1 / 60);
      if (m.walk) steps.push(m.walk);
      rhythm = m.rhythm;
    }
  }
  assert.ok(steps.length >= 6, `${steps.length} steps`);
  assert.ok(steps.every((s, i) => i === 0 || s !== steps[i - 1]), 'each the other way');
  assert.ok(rhythm > 0.5, 'an even rhythm');
});

test('a hard sweep up strikes firmly; a soft one barely; and the strike sets the hold', () => {
  const sweep = (rate) => {
    const R = T.newRod();
    let q = 0;
    for (let i = 0; i < 30; i++) {
      T.rodStep(R, Math.min(1, (i / 60) * rate), 0, 1 / 60);
      q = Math.max(q, T.strikeFrom(R));
    }
    return q;
  };
  assert.ok(sweep(12) > 0.7 && sweep(2) < 0.25);
  assert.equal(T.holdAfterStrike('light', 0.95, 0.1), 'solid');
  assert.equal(T.holdAfterStrike('light', 0.3, 0.1), 'light');
  assert.equal(T.holdAfterStrike('solid', 0.05, 0.1), 'light');
  assert.equal(T.holdAfterStrike('solid', 0.6, 0.1), 'solid');
});

test('playing a fish with the rod: pumping lands it sooner, and a raised rod cushions a surge', () => {
  const sp = fishById.seabass;
  const make = () => newFight(sp, 60, { line: { strength: 8, stretch: 1 }, power: 1, flex: 1, drag: 2 }, DIFFICULTY.standard, false, () => 0.5, { vigour: 1, condition: 1, level: { throwHook: 0, pull: 0, current: 1 }, range: 15 });
  const land = (pumped) => {
    const F = make();
    Object.assign(F, { stamina: 0.1, stage: 'beaten', phaseT: 99, pulling: false });
    let t = 0;
    const R = T.newRod();
    while (F.progress < 1 && t < 60) {
      // Pump: lift the rod for half a second, then lower it winding.
      const up = pumped ? (t % 1 < 0.5 ? 1 : -0.3) : 0;
      T.rodStep(R, up, 0, 1 / 30);
      const fr = T.fightFromRod(R, { running: F.pulling });
      Object.assign(F, { pump: fr.pump, pumpLoad: fr.load, cushion: fr.cushion });
      stepFight(F, true, 1 / 30, DIFFICULTY.standard, () => 0.5);
      t += 1 / 30;
    }
    return t;
  };
  const a = land(false), b = land(true);
  assert.ok(b < a * 0.85, `pumped in ${b.toFixed(1)} s, wound in ${a.toFixed(1)} s`);
  const up = T.fightFromRod({ ...T.newRod(), pitch: 1 }), down = T.fightFromRod({ ...T.newRod(), pitch: 0 });
  assert.ok(up.cushion < down.cushion);
  assert.ok(T.fightFromRod({ ...T.newRod(), pitch: 1 }, { near: true }).high, 'held right up over a fish alongside: high-sticking');
  // (No pumping while it runs: you hold on and let the drag work.)
  assert.equal(T.fightFromRod({ ...T.newRod(), vPitch: 3 }, { running: true }).pump, 0);
});

test('the Technique setting: Assisted unless chosen', () => {
  assert.equal(cleanSettings({}).controls.technique, 'assisted');
  assert.equal(cleanSettings({ controls: { technique: 'expert' } }).controls.technique, 'expert');
  assert.equal(cleanSettings({ controls: { technique: 'wizard' } }).controls.technique, 'assisted');
  assert.deepEqual(T.TECHNIQUE_IDS, ['assisted', 'expert']);
});
