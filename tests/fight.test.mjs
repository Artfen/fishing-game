// The fight with a hooked fish (src/fight.js), played out thousands of times with a seeded
// dice, by players of different care: does the right play win, and do lines break for the
// reasons the game says? Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFight, stepFight, breakReason, DIFFICULTY } from '../src/fight.js';
import { RODS } from '../src/tackle.js';
import { fishById } from '../src/fish.js';

function dice(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const carp = fishById.carp, pike = fishById.pike, trout = fishById.trout;
const rodOf = (id, drag) => ({ line: RODS[id].line, power: RODS[id].power, drag: drag ?? RODS[id].drag });
const sizeAt = (sp, k) => sp.size[0] + (sp.size[1] - sp.size[0]) * k;

// careful: eases off at the flick and through the surge. human: lets go a reaction time after
// the flick (or the run, if that comes first) and holds again a reaction time after the surge.
// holder: never lets go.
function play(sp, rod, diffId, style, { k = 0.9, cover = false, n = 200, seed = 7 } = {}) {
  const rnd = dice(seed);
  const diff = DIFFICULTY[diffId];
  const out = { landed: 0, n };
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, sizeAt(sp, k), rod, diff, cover, rnd);
    const react = 0.2 + rnd() * 0.25;
    let held = true, cue = 99, calm = 99, was = false, result = null;
    for (let step = 0; step < 9000 && !result; step++) {
      const dt = 1 / 30;
      if (style === 'careful') held = !(F.surgeT > 0 || (F.warned && !F.pulling));
      else if (style === 'human') {
        if (cue > react && cue < 50) held = false;
        if (!held && calm > react && calm < 50) { held = true; cue = 99; calm = 99; }
      } else held = true;
      const ev = stepFight(F, held, dt, diff, rnd);
      if ((ev === 'warn' || ev === 'run') && cue > 50) cue = 0; else cue += dt;
      const surging = F.surgeT > 0;
      if (was && !surging) calm = 0; else calm += dt;
      was = surging;
      if (ev && ev.startsWith('snap:')) result = ev.slice(5);
      else if (F.progress >= 1) result = 'landed';
    }
    out[result || 'timeout'] = (out[result || 'timeout'] || 0) + 1;
  }
  out.rate = out.landed / n;
  return out;
}

test('careful play lands a big carp on the carp rod at every difficulty', () => {
  for (const d of ['relaxed', 'standard', 'realistic']) {
    const r = play(carp, rodOf('carp'), d, 'careful');
    assert.equal(r.rate, 1, `${d}: ${JSON.stringify(r)}`);
  }
});

test('on Standard, watching for the flick lands nearly every big carp and pike', () => {
  assert.ok(play(carp, rodOf('carp'), 'standard', 'human').rate >= 0.9);
  assert.ok(play(pike, rodOf('spin'), 'standard', 'human').rate >= 0.9);
});

test('Realistic asks more of the same player than Standard, and Relaxed less', () => {
  const rel = play(carp, rodOf('carp'), 'relaxed', 'holder').rate;
  const std = play(carp, rodOf('carp'), 'standard', 'human').rate;
  const real = play(carp, rodOf('carp'), 'realistic', 'human').rate;
  assert.ok(real < std, `realistic ${real} vs standard ${std}`);
  assert.ok(real >= 0.4, `realistic should still be winnable: ${real}`);
  assert.equal(rel, 1, 'relaxed forgives even holding on throughout');
});

test('winding through every surge breaks the line on Standard, for the reason it gives', () => {
  const r = play(carp, rodOf('carp'), 'standard', 'holder');
  assert.equal(r.landed, 0);
  assert.equal(r.tension, r.n);
});

test('a locked drag breaks as "drag", not "tension"', () => {
  const r = play(carp, rodOf('float', 5), 'standard', 'careful', { k: 0.6 });
  assert.ok(r.drag > 0, JSON.stringify(r));
  assert.equal(r.tension || 0, 0);
});

test('pike bite through line without a wire trace, never through one', () => {
  const bare = play(pike, rodOf('trout'), 'standard', 'careful', { k: 0.4 });
  const trace = play(pike, rodOf('spin'), 'standard', 'careful', { k: 0.4 });
  assert.ok(bare.teeth > 0, JSON.stringify(bare));
  assert.equal(trace.teeth || 0, 0);
});

test('light line lets a big fish reach the weed; the carp rod turns it', () => {
  const light = play(carp, rodOf('float'), 'standard', 'careful', { k: 0.9, cover: true });
  const heavy = play(carp, rodOf('carp'), 'standard', 'careful', { k: 0.9, cover: true });
  assert.ok(light.snag > 0, JSON.stringify(light));
  assert.equal(heavy.snag || 0, 0);
});

test('a trout on the trout rod is a fair fight even if you hold on', () => {
  assert.equal(play(trout, rodOf('trout'), 'standard', 'holder', { k: 0.8 }).rate, 1);
});

test('every break comes with advice that names the fish', () => {
  for (const cause of ['tension', 'drag', 'snag', 'teeth']) {
    const text = breakReason(cause, carp, RODS.float);
    assert.match(text, new RegExp(carp.name.toLowerCase()));
  }
});
