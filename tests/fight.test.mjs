// The fight with a hooked fish (src/fight.js), played out thousands of times with a seeded
// dice, by players of different care: does the right play win, and do lines break for the
// reasons the game says? Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFight, stepFight, breakReason, DIFFICULTY, spoolFor } from '../src/fight.js';
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

// careful: eases off at the flick and through the surge, and answers each signature move as the
// game says (winds through a charge, side strain for a headshake or a dive, pumps a sounding fish
// in strokes, winds a circling fish as it comes up). human: lets go a reaction time after
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
    let held = true, cue = 99, calm = 99, was = false, result = null, creakT = 99, pumpT = 0;
    for (let step = 0; step < 9000 && !result; step++) {
      const dt = 1 / 30;
      if (style === 'careful') {
        held = !(F.surgeT > 0 || (F.warned && !F.pulling));
        F.side = F.shakeT > 0 || (F.pulling && F.move === 'dive') ? -F.dir : 0;
        if (F.move === 'charge') held = true;
        if (F.move === 'sound') held = (pumpT += dt) % 1 < 0.6;
        if (F.move === 'circle' && !F.pulling) held = F.coming;
      }
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

// Signature moves (see the top of fight.js). A player who answers each move: winds through a
// charge, swings the rod low to the side for a headshake or a dive, pumps a sounding fish in
// strokes, and winds a circling fish only as it comes up. ignore: any one of those answers left out.
const natural = { throwHook: 0.12, pull: 0.5 };
function playMoves(id, rod, { n = 60, seed = 5, ignore = null, level = natural, k = 0.9, cover = false, drag, chase = 0 } = {}) {
  const sp = fishById[id], rnd = dice(seed), diff = DIFFICULTY.standard;
  const { prefsFor } = behaviour;
  const out = { n, landed: 0, time: 0, moves: {}, ends: {}, extra: 0, turned: 0, lifted: 0, shakeSum: 0, shakeN: 0 };
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, sizeAt(sp, k), drag != null ? { ...rod, drag } : rod, diff, cover, rnd, { jumpy: prefsFor(id).jumpy, level, range: 35 });
    let end = null, clock = 0;
    for (let s = 0; s < 30 * 300 && !end; s++) {
      const dt = 1 / 30;
      let held = !(F.surgeT > 0 || (F.warned && !F.pulling));
      F.side = 0;
      F.chase = chase;
      if (F.move === 'charge') held = ignore !== 'charge';
      if ((F.shakeT > 0 && ignore !== 'headshake') || (F.pulling && F.move === 'dive' && ignore !== 'dive')) F.side = -F.dir;
      if (F.move === 'sound') held = ignore === 'sound' ? true : (clock += dt) % 1 < 0.6;
      if (F.move === 'circle' && !F.pulling) held = ignore === 'circle' ? true : F.coming;
      const ev = stepFight(F, held, dt, diff, rnd);
      if (F.shakeT > 0) {
        out.shakeSum += Math.abs(F.shakeOff);
        out.shakeN++;
      }
      if (ev === 'turned') out.turned++;
      if (ev === 'lifted') out.lifted++;
      out.extra = Math.max(out.extra, F.extra);
      if (ev && (ev.startsWith('snap:') || ev.startsWith('off:'))) end = ev;
      else if (F.progress >= 1) {
        end = 'landed';
        out.landed++;
        out.time += F.time;
      }
    }
    out.ends[end || 'timeout'] = (out.ends[end || 'timeout'] || 0) + 1;
    for (const [m, c] of Object.entries(F.moves)) out.moves[m] = (out.moves[m] || 0) + c;
  }
  out.rate = out.landed / n;
  out.time = out.landed ? out.time / out.landed : 0;
  out.shake = out.shakeSum / Math.max(1, out.shakeN);
  return out;
}
const behaviour = await import('../src/behaviour.js');
const guideRod = async (id) => {
  const { setupsFor } = await import('../src/guide.js');
  const s = setupsFor(fishById[id])[0], R = RODS[s.rod];
  return { line: { ...R.lines.find((l) => l.id === s.line), trace: !!TERMS[s.term].trace }, power: R.power, flex: R.flex, drag: R.drag };
};

test('a sea bass, a trout and a tuna are three different fights, not one fight of three lengths', async () => {
  const { signatureOf } = await import('../src/fight.js');
  assert.deepEqual(signatureOf(fishById.trout), ['charge']);
  assert.deepEqual(signatureOf(fishById.seabass), ['headshake', 'dive', 'lastdash']);
  assert.deepEqual(signatureOf(fishById.tuna), ['longrun', 'sound', 'circle']);
  const trout = playMoves('trout', rodOf('trout')), bass = playMoves('seabass', await guideRod('seabass')), tuna = playMoves('tuna', await guideRod('tuna'));
  // The trout charges at you; the bass shakes its head, dives and makes a last dash; the tuna runs
  // far, sounds and circles. None of them does the others' moves.
  assert.ok(trout.moves.charge > trout.n, JSON.stringify(trout.moves));
  assert.ok(!trout.moves.longrun && !trout.moves.headshake && !trout.moves.sound, JSON.stringify(trout.moves));
  assert.ok(bass.moves.headshake > bass.n && bass.moves.dive > bass.n * 0.5 && bass.moves.lastdash > bass.n * 0.5, JSON.stringify(bass.moves));
  assert.ok(!bass.moves.charge && !bass.moves.longrun && !bass.moves.sound, JSON.stringify(bass.moves));
  assert.equal(tuna.moves.longrun >= tuna.n && tuna.moves.sound >= tuna.n * 0.9 && tuna.moves.circle >= tuna.n * 0.9, true, JSON.stringify(tuna.moves));
  assert.ok(!tuna.moves.charge && !tuna.moves.headshake && !tuna.moves.dive, JSON.stringify(tuna.moves));
  // The tuna's run takes line far past where it was hooked; a trout or a bass on a sensible drag
  // takes a few metres past it at most.
  assert.ok(tuna.extra > 40 && trout.extra < 8 && bass.extra < 8, `tuna ${tuna.extra} m, trout ${trout.extra} m, bass ${bass.extra} m`);
  // Answered, every one of them comes in.
  for (const r of [trout, bass, tuna]) assert.ok(r.rate >= 0.95, JSON.stringify(r.ends));
});

test('a charge: wind to keep up and you win line; stop winding and the slack can lose it', () => {
  const kept = playMoves('trout', rodOf('trout'), { n: 120, seed: 9 }), slack = playMoves('trout', rodOf('trout'), { n: 120, seed: 9, ignore: 'charge' });
  assert.ok((slack.ends['off:thrown'] || 0) > (kept.ends['off:thrown'] || 0) + 5, `${JSON.stringify(kept.ends)} vs ${JSON.stringify(slack.ends)}`);
  assert.ok(kept.time < slack.time, `${kept.time} s vs ${slack.time} s`);
  // On Relaxed no fish ever throws the hook, whatever you do.
  const relaxed = playMoves('trout', rodOf('trout'), { n: 60, ignore: 'charge', level: { throwHook: 0, pull: 0 } });
  assert.equal(relaxed.ends['off:thrown'] || 0, 0);
});

test('a headshake: the rod low to one side keeps the line steady; without it the hook can come out', async () => {
  const rod = await guideRod('seabass');
  const low = playMoves('seabass', rod, { n: 120, seed: 4 }), up = playMoves('seabass', rod, { n: 120, seed: 4, ignore: 'headshake' });
  assert.ok((up.ends['off:thrown'] || 0) > (low.ends['off:thrown'] || 0) + 8, `${JSON.stringify(low.ends)} vs ${JSON.stringify(up.ends)}`);
  assert.ok(up.shake > low.shake * 2.5, `each shake snatches at the line by ${up.shake.toFixed(2)} without, ${low.shake.toFixed(2)} with`);
  assert.ok(low.rate >= 0.95, JSON.stringify(low.ends));
});

test('a dive for the rocks: side strain turns its head', () => {
  const pollack = fishById.pollack;
  assert.ok(pollack.fight === 'dogged');
  const rod = rodOf('sea', 1, 0);
  const turned = playMoves('pollack', rod, { n: 80, cover: 'rock' }), not = playMoves('pollack', rod, { n: 80, cover: 'rock', ignore: 'dive' });
  assert.ok(turned.turned > 20 && not.turned === 0, `${turned.turned} turned`);
  assert.ok(turned.rate > not.rate || (not.ends['snap:rock'] || 0) >= (turned.ends['snap:rock'] || 0), `${JSON.stringify(turned.ends)} vs ${JSON.stringify(not.ends)}`);
});

test('sounding: pumping it up in strokes lifts it; winding steadily barely moves it', async () => {
  const rod = await guideRod('tuna');
  const pump = playMoves('tuna', rod, { n: 60 }), crank = playMoves('tuna', rod, { n: 60, ignore: 'sound' });
  assert.ok(pump.lifted > crank.lifted * 2 + 10, `lifted ${pump.lifted} times pumping, ${crank.lifted} cranking`);
  assert.ok(pump.time < crank.time, `${pump.time.toFixed(1)} s vs ${crank.time.toFixed(1)} s`);
  // A shark sounds too (with no long run first), and pumping beats it sooner.
  const shark = await guideRod('blueshark');
  assert.ok(playMoves('blueshark', shark, { n: 40 }).time < playMoves('blueshark', shark, { n: 40, ignore: 'sound' }).time * 0.8);
});

test('the circles: winding as it comes up beats winding all the way round', async () => {
  const rod = await guideRod('tuna');
  const timed = playMoves('tuna', rod, { n: 60, seed: 3 }), always = playMoves('tuna', rod, { n: 60, seed: 3, ignore: 'circle' });
  assert.ok(timed.time < always.time, `${timed.time.toFixed(1)} s vs ${always.time.toFixed(1)} s`);
});

test('a long run: line pours off past the hook, a drag far too light empties a small spool, and following it with the boat wins it back', async () => {
  // A big tuna on the light spinning rod's reel (a small spool) with the drag right off.
  const light = { ...rodOf('sea'), spool: 120 };
  const off = playMoves('tuna', light, { n: 30, drag: 0 });
  assert.ok((off.ends['snap:spool'] || 0) > 5, JSON.stringify(off.ends));
  assert.match(breakReason('spool', fishById.tuna, light), /every metre of line/);
  // On its own tackle it never comes near, and following it with the boat brings it back sooner.
  const rod = await guideRod('tuna');
  const stay = playMoves('tuna', rod, { n: 40 }), follow = playMoves('tuna', rod, { n: 40, chase: 2 });
  assert.equal(stay.ends['snap:spool'] || 0, 0);
  assert.ok(follow.time < stay.time, `${follow.time.toFixed(1)} s following vs ${stay.time.toFixed(1)} s`);
});

// Line off the reel: any fish that outpulls the drag swims off with line, past where it was hooked
// if it keeps going; how far and how fast is down to the drag, the fish and the water it has.
// (Played carefully, each move answered, with no hook ever thrown: this is about the line. firstRun:
// stop when its first run ends, to time a fresh fish's run.)
function lineTaken(id, rod, { drag, n = 40, seed = 13, room = Infinity, k = 0.9, firstRun = false } = {}) {
  const sp = fishById[id], rnd = dice(seed), diff = DIFFICULTY.standard;
  const out = { n, landed: 0, time: 0, ends: {}, extra: 0, speed: 0, slips: 0, edges: 0, windSlip: 0 };
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, sizeAt(sp, k), { ...rod, drag: drag ?? rod.drag }, diff, false, rnd, { level: { throwHook: 0, pull: 0 }, range: 30 });
    F.room = room;
    let end = null, clock = 0, ran = false;
    for (let s = 0; s < 30 * 400 && !end; s++) {
      const dt = 1 / 30;
      let held = !(F.surgeT > 0 || (F.warned && !F.pulling));
      F.side = F.shakeT > 0 || (F.pulling && F.move === 'dive') ? -F.dir : 0;
      if (F.move === 'charge') held = true;
      if (F.move === 'sound') held = (clock += dt) % 1 < 0.6;
      if (F.move === 'circle' && !F.pulling) held = F.coming;
      const o0 = F.dist * (1 - F.progress) + F.extra;
      const ev = stepFight(F, held, dt, diff, rnd);
      const o1 = F.dist * (1 - F.progress) + F.extra;
      if (F.pulling) ran = true;
      else if (firstRun && ran) end = 'first run';
      if (F.slipping && F.extra > 0 && o1 > o0) {
        out.speed += (o1 - o0) / dt;
        out.slips++;
      }
      if (ev === 'edge') out.edges++;
      out.windSlip = Math.max(out.windSlip, F.windSlip);
      out.extra = Math.max(out.extra, F.extra);
      if (ev && (ev.startsWith('snap:') || ev.startsWith('off:'))) end = ev;
      else if (F.progress >= 1) {
        end = 'landed';
        out.landed++;
        out.time += F.time;
      }
    }
    out.ends[end || 'timeout'] = (out.ends[end || 'timeout'] || 0) + 1;
  }
  out.rate = out.landed / n;
  out.time = out.landed ? out.time / out.landed : 0;
  out.speed = out.slips ? out.speed / out.slips : 0;
  return out;
}

test('on a drag far too light any fish takes line past where it was hooked; the right drag keeps it close', () => {
  // (Before, only the long-running kinds could: a carp or a pike never got further off than where
  // it took the bait, however light the drag.)
  for (const [id, rod] of [['carp', rodOf('carp')], ['pike', rodOf('spin')], ['trout', rodOf('trout')]]) {
    const off = lineTaken(id, rod, { drag: 0 }), set = lineTaken(id, rod), firm = lineTaken(id, rod, { drag: 4 });
    assert.ok(off.extra > 5 && off.extra > set.extra * 1.5 && set.extra >= firm.extra, `${id}: ${off.extra.toFixed(1)} m off, ${set.extra.toFixed(1)} m set, ${firm.extra.toFixed(1)} m firm`);
    // And it still comes in, slower: the drag that light doesn't tire it or stop its runs.
    assert.ok(off.rate >= 0.95 && off.time > set.time, `${id}: ${JSON.stringify(off.ends)} ${off.time.toFixed(1)} s vs ${set.time.toFixed(1)} s`);
  }
  // A big carp on a float rod's light line with the drag right off: tens of metres.
  assert.ok(lineTaken('carp', rodOf('float'), { drag: 0 }).extra > 30);
});

test('line goes out as fast as the fish can swim against the drag: faster on a lighter drag, and a tuna faster than a carp', async () => {
  // (A fresh fish's first run, timed on each drag.)
  const carp0 = lineTaken('carp', rodOf('carp'), { drag: 0, firstRun: true }), carp2 = lineTaken('carp', rodOf('carp'), { drag: 2, firstRun: true });
  assert.ok(carp0.speed > carp2.speed * 1.1, `${carp0.speed.toFixed(2)} vs ${carp2.speed.toFixed(2)} m/s`);
  const tuna = lineTaken('tuna', await guideRod('tuna'), { firstRun: true });
  assert.ok(tuna.speed > carp0.speed * 1.5, `tuna ${tuna.speed.toFixed(2)} m/s, carp ${carp0.speed.toFixed(2)} m/s`);
  // (Within reason: a carp's run a couple of metres a second, a tuna's several.)
  assert.ok(carp0.speed > 1 && carp0.speed < 4 && tuna.speed < 12, `${carp0.speed} ${tuna.speed}`);
});

test('a drag far too light: winding against a resting fish only slips the spool, but a beaten one comes in', async () => {
  const { slipK } = await import('../src/fight.js');
  // Far lighter than drawing it in takes: most of what you wind slips; a sensible drag, none.
  assert.ok(slipK(0.3, 1.4) < 0.5 && slipK(0.55, 1.0) === 1 && slipK(0.42, 0.6) === 1);
  const off = lineTaken('carp', rodOf('carp'), { drag: 0 });
  assert.ok(off.windSlip > 0.2, `${off.windSlip} m/s slipped`);
  assert.equal(lineTaken('carp', rodOf('carp')).windSlip, 0);
  // A drag right off on a fish far too strong for the line: it still comes in once it's beaten.
  assert.ok(lineTaken('carp', rodOf('float'), { drag: 0, n: 20 }).rate >= 0.95);
});

test('a bank or the shallows stops a run: it turns, and takes no more line than the water allows', () => {
  const r = lineTaken('carp', rodOf('carp'), { drag: 0, room: 6 });
  assert.ok(r.extra <= 6 + 1e-9 && r.edges > 10, `${r.extra} m, turned ${r.edges} times`);
  assert.ok(r.rate >= 0.95);
});

test('any fish can empty a spool that small on a drag that light', () => {
  const r = lineTaken('carp', { ...rodOf('carp'), spool: 45 }, { drag: 0 });
  assert.ok((r.ends['snap:spool'] || 0) > 5, JSON.stringify(r.ends));
  // The big-game reels hold far more: a marlin on its own tackle never comes near.
  assert.ok(spoolFor({ kg: 36 }) >= 600 && spoolFor({ kg: 23 }) >= 400 && spoolFor({ kg: 2 }) >= 100);
});
