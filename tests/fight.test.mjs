// The fight with a hooked fish (src/fight.js), played out thousands of times with a seeded
// dice, by players of different care: does the right play win, and do lines break for the
// reasons the game says? Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFight, stepFight, breakReason, DIFFICULTY } from '../src/fight.js';
import { RODS, TERMS } from '../src/tackle.js';
import { fishById } from '../src/fish.js';

function dice(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

const carp = fishById.carp, pike = fishById.pike, trout = fishById.trout;
// A rod with its first (default) line, and its default leader (the spinning rod's wire trace).
const rodOf = (id, drag, line = 0) => ({ line: { ...RODS[id].lines[line], trace: !!TERMS[RODS[id].terms[0]].trace }, power: RODS[id].power, flex: RODS[id].flex, drag: drag ?? RODS[id].drag });
const sizeAt = (sp, k) => sp.size[0] + (sp.size[1] - sp.size[0]) * k;

// careful: eases off at the flick and through the surge. human: lets go a reaction time after
// the flick (or the run, if that comes first) and holds again a reaction time after the surge.
// creak: ignores the flick, but eases off a reaction time after the line creaks.
// holder: never lets go.
function play(sp, rod, diffId, style, { k = 0.9, cover = false, n = 200, seed = 7 } = {}) {
  const rnd = dice(seed);
  const diff = DIFFICULTY[diffId];
  const out = { landed: 0, n, time: 0 };
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, sizeAt(sp, k), rod, diff, cover, rnd);
    const react = 0.2 + rnd() * 0.25;
    let held = true, cue = 99, calm = 99, was = false, result = null, creakT = 99;
    for (let step = 0; step < 9000 && !result; step++) {
      const dt = 1 / 30;
      if (style === 'careful') held = !(F.surgeT > 0 || (F.warned && !F.pulling));
      else if (style === 'human') {
        if (cue > react && cue < 50) held = false;
        if (!held && calm > react && calm < 50) { held = true; cue = 99; calm = 99; }
      } else if (style === 'creak') {
        if (F.tension > 0.9 && creakT > react + 1.6) creakT = 0;
        else creakT += dt;
        held = !(creakT > react && creakT < react + 1 + (F.pulling ? 0.5 : 0));
      } else held = true;
      const ev = stepFight(F, held, dt, diff, rnd);
      if ((ev === 'warn' || ev === 'run') && cue > 50) cue = 0; else cue += dt;
      const surging = F.surgeT > 0;
      if (was && !surging) calm = 0; else calm += dt;
      was = surging;
      if (ev && ev.startsWith('snap:')) result = ev.slice(5);
      else if (F.progress >= 1) {
        result = 'landed';
        out.time += F.time;
      }
    }
    out[result || 'timeout'] = (out[result || 'timeout'] || 0) + 1;
  }
  out.rate = out.landed / n;
  out.time = out.landed ? out.time / out.landed : 0; // average length of a landed fight, in seconds
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
  const std = play(carp, rodOf('carp'), 'standard', 'creak').rate;
  const real = play(carp, rodOf('carp'), 'realistic', 'creak').rate;
  assert.ok(real < std, `realistic ${real} vs standard ${std}`);
  assert.ok(play(carp, rodOf('carp'), 'realistic', 'human').rate >= 0.85, 'realistic is winnable by watching for the flick');
  assert.equal(rel, 1, 'relaxed forgives even holding on throughout');
});

test('on Standard the creak is a real warning: easing off then lands nearly every big carp', () => {
  assert.ok(play(carp, rodOf('carp'), 'standard', 'creak').rate >= 0.85);
});

test('winding through every surge on Standard loses some big carp, always for the reason it gives', () => {
  const r = play(carp, rodOf('carp'), 'standard', 'holder');
  assert.ok(r.rate > 0.3 && r.rate < 0.9, JSON.stringify(r));
  assert.equal(r.landed + (r.tension || 0), r.n);
  // A firm drag leaves no margin for a surge at all.
  const firm = play(carp, rodOf('carp', 3), 'standard', 'holder');
  assert.ok(firm.rate < r.rate, JSON.stringify(firm));
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
    const text = breakReason(cause, carp, { ...RODS.float, line: RODS.float.lines[0] });
    assert.match(text, new RegExp(carp.name.toLowerCase()));
  }
});

test('every new fish can be landed with careful play on the rod its setup brings', () => {
  const pairs = [['seabass', 'sea'], ['mackerel', 'sea'], ['mullet', 'float'], ['wrasse', 'boat'], ['flounder', 'boat'], ['plaice', 'boat'],
    ['squid', 'squid'], ['tuna', 'offshore'], ['lmbass', 'spin'], ['tench', 'float'], ['roach', 'float']];
  for (const [id, rod] of pairs) {
    const r = play(fishById[id], rodOf(rod), 'standard', 'careful', { n: 80 });
    assert.ok(r.rate >= 0.95, `${id} on the ${rod} rod: ${JSON.stringify(r)}`);
    assert.ok(r.time < 50, `${id} takes ${r.time}s: big fish shouldn't be an endurance chore`);
  }
});

test('every catchable sea species can be landed with careful play on the setup the guide recommends', async () => {
  const { setupsFor } = await import('../src/guide.js');
  const { FISH } = await import('../src/fish.js');
  const failed = [];
  for (const sp of FISH) {
    if (sp.retired || sp.life.observe || sp.water === 'fresh') continue;
    const s = setupsFor(sp)[0], R = RODS[s.rod];
    const rod = { line: { ...R.lines.find((l) => l.id === s.line), trace: !!TERMS[s.term].trace }, power: R.power, drag: R.drag };
    const r = play(sp, rod, 'standard', 'careful', { n: 60 });
    // (The big game of the open ocean fights longer, up to a couple of minutes; the rest under one.)
    if (r.rate < 0.95 || r.time >= (sp.life.big ? 120 : 60)) failed.push(`${sp.id} on ${s.rod} (${s.line}): ${JSON.stringify(r)}`);
  }
  assert.deepEqual(failed, []);
});

test('the big game fights longest: a marlin outlasts a tuna, and a tuna a dorado', async () => {
  const { setupsFor } = await import('../src/guide.js');
  const time = (id) => {
    const sp = fishById[id], s = setupsFor(sp)[0], R = RODS[s.rod];
    return play(sp, { line: { ...R.lines.find((l) => l.id === s.line), trace: !!TERMS[s.term].trace }, power: R.power, drag: R.drag }, 'standard', 'careful', { n: 40 }).time;
  };
  const marlin = time('bluemarlin'), tuna = time('tuna'), dorado = time('dorado');
  assert.ok(marlin > tuna * 1.3 && tuna > dorado, `marlin ${marlin} s, tuna ${tuna} s, dorado ${dorado} s`);
  assert.equal(setupsFor(fishById.bluemarlin)[0].rod, 'biggame', 'the marlin on the big-game rod');
});

test('fish of different kinds fight differently: squid jet in short pulses, tuna run long and deep', () => {
  const runs = (id) => {
    const F = newFight(fishById[id], fishById[id].size[1], rodOf(id === 'squid' ? 'squid' : 'offshore'), DIFFICULTY.standard, false, dice(3));
    let n = 0, len = 0, cur = 0;
    for (let i = 0; i < 30 * 20; i++) {
      const was = F.pulling;
      stepFight(F, false, 1 / 30, DIFFICULTY.standard, dice(i + 1));
      if (F.pulling) cur += 1 / 30;
      if (was && !F.pulling) { n++; len += cur; cur = 0; }
    }
    return len / Math.max(1, n);
  };
  assert.ok(runs('squid') < runs('tuna') * 0.5, `squid ${runs('squid')} s vs tuna ${runs('tuna')} s`);
});
