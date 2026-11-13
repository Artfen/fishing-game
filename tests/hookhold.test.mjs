// E2, the hook-hold and the line's wear (src/fight.js, src/shop.js): how firmly the hook is set is a
// grip that a fight wears (head-shakes, leaps, long heavy pressure), so a solid hold can work loose;
// a hold only nicked in or worn loose is thrown more readily on a slack line; and where the line
// rubs on rock or weed, or is nicked by teeth, the damage stays, weakening it for the rest of the
// fight and after it until it's respooled. None of it on Relaxed.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newFight, stepFight, breakReason, DIFFICULTY } from '../src/fight.js';
import { RODS, TERMS } from '../src/tackle.js';
import { fishById } from '../src/fish.js';
import { BEHAVIOUR } from '../src/behaviour.js';
import { wearFrom, wornLine } from '../src/shop.js';

const dice = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
const rodOf = (id, line = 0) => ({ line: { ...RODS[id].lines[line], trace: !!TERMS[RODS[id].terms[0]].trace }, power: RODS[id].power, flex: RODS[id].flex, drag: RODS[id].drag });
const bass = fishById.seabass, std = DIFFICULTY.standard;
const fightOf = (level, rnd = dice(3), sp = bass, rod = rodOf('sea')) => newFight(sp, sp.size[0] + (sp.size[1] - sp.size[0]) * 0.8, rod, std, false, rnd, { level, jumpy: sp.life?.jumps ?? 0, range: 25 });

test('the grip: a light hold 0.2-0.45, a solid one 0.6-1, from the same roll; on Relaxed always solid and never worn', () => {
  const rnd = dice(17);
  let light = 0, solid = 0;
  for (let i = 0; i < 400; i++) {
    const F = fightOf(BEHAVIOUR.natural, rnd);
    if (F.hold === 'light') {
      light++;
      assert.ok(F.grip >= 0.2 && F.grip <= 0.45, `light ${F.grip}`);
    } else {
      solid++;
      assert.ok(F.grip >= 0.6 && F.grip <= 1, `solid ${F.grip}`);
    }
  }
  assert.ok(light > 40 && solid > 200, `${light} light, ${solid} solid`);
  // Relaxed: solid, full grip, and a fight's worth of leaps and shakes leaves it so.
  const R = fightOf(BEHAVIOUR.relaxed);
  assert.equal(R.hold, 'solid');
  assert.equal(R.grip, 1);
  const rnd2 = dice(5);
  for (let k = 0; k < 30 * 120 && R.progress < 1; k++) stepFight(R, !(R.surgeT > 0), 1 / 30, std, rnd2);
  assert.equal(R.grip, 1, 'never worn on Relaxed');
});

test('a leap on a slack line wrenches the hold more than one on a tight line', () => {
  const leap = (slack) => {
    const F = fightOf(BEHAVIOUR.demanding);
    Object.assign(F, { hold: 'solid', grip: 0.9, jumping: 0.01, jumpSlack: slack, tension: 0.5, phaseT: 5, surgeT: 0 });
    stepFight(F, true, 1 / 30, std, () => 0.99);
    return 0.9 - F.grip;
  };
  const slack = leap(true), tight = leap(false);
  assert.ok(slack > tight * 2 && tight > 0, `slack ${slack.toFixed(3)}, tight ${tight.toFixed(3)}`);
});

test('worn below half, a solid hold is a light one: said once, and then a heavy hand pulls it out, the reason saying it wore loose', () => {
  const F = fightOf(BEHAVIOUR.demanding);
  Object.assign(F, { hold: 'solid', grip: 0.52, jumping: 0.01, jumpSlack: true, tension: 0.5, phaseT: 5, surgeT: 0 });
  const ev = stepFight(F, true, 1 / 30, std, () => 0.99);
  assert.equal(ev, 'loosened');
  assert.ok(F.hold === 'light' && F.loosened);
  // A heavy hand from here: held tight, the drag locked, it pulls free.
  Object.assign(F, { drag: 5, phaseT: 99, pulling: true, stage: 'fresh', progress: 0.5 });
  let end = null;
  for (let k = 0; k < 30 * 20 && !end; k++) {
    F.tension = Math.max(F.tension, 0.9);
    const e = stepFight(F, true, 1 / 30, std, () => 0.99);
    if (e && e.startsWith('off:')) end = e;
  }
  assert.equal(end, 'off:pulled');
  assert.match(breakReason('pulled', bass, rodOf('sea'), { loosened: true }), /wore the hold loose/);
  assert.match(breakReason('pulled', bass, rodOf('sea'), {}), /only had a light hold/);
});

test('head-shakes wear a heavy hand’s hold far more than a careful one’s, and the heavy hand loses more bass for it', () => {
  // The same 300 bass on Demanding: the careful angler keeps the rod low to the side through the
  // shakes; the heavy hand keeps it high, straight, and eases only through the surge.
  const play = (careful) => {
    const rnd = dice(11);
    const out = { landed: 0, thrown: 0, loosened: 0, wear: 0 };
    for (let i = 0; i < 300; i++) {
      const F = fightOf(BEHAVIOUR.demanding, rnd);
      const g0 = F.grip;
      let res = null;
      for (let k = 0; k < 9000 && !res; k++) {
        let held;
        if (careful) {
          held = !(F.surgeT > 0 || (F.warned && !F.pulling));
          F.side = F.shakeT > 0 || (F.pulling && F.move === 'dive') ? -F.dir : 0;
          if (F.move === 'charge') held = true;
          if (F.move === 'sound') held = ((k / 30) % 1) < 0.6;
          if (F.move === 'circle' && !F.pulling) held = F.coming;
          F.rodHigh = false;
        } else {
          F.side = 0;
          F.rodHigh = true;
          held = !(F.surgeT > 0);
        }
        const ev = stepFight(F, held, 1 / 30, std, rnd);
        if (ev === 'loosened') out.loosened++;
        if (ev && ev.startsWith('off:')) res = 'thrown';
        else if (ev && ev.startsWith('snap:')) res = 'snap';
        else if (F.progress >= 1) res = 'landed';
      }
      out.wear += g0 - F.grip;
      if (res === 'landed') out.landed++;
      if (res === 'thrown') out.thrown++;
    }
    return out;
  };
  const careful = play(true), heavy = play(false);
  assert.ok(heavy.wear > careful.wear * 3, `grip worn: careful ${careful.wear.toFixed(1)}, heavy ${heavy.wear.toFixed(1)}`);
  assert.ok(heavy.loosened > careful.loosened + 20, `loosened: careful ${careful.loosened}, heavy ${heavy.loosened}`);
  assert.equal(careful.landed, 300, 'the careful angler lands them all');
  assert.ok(heavy.thrown > 150, `the heavy hand loses ${heavy.thrown} of 300 (150 before the hold could wear)`);
});

test('the line chafed on rock stays chafed, and is weaker for it; teeth nick a leader but not a wire trace', () => {
  // A big pollack on braid, out at the far end with line pouring off, over rock.
  const pollack = fishById.pollack;
  const braid = rodOf('boat', RODS.boat.lines.findIndex((l) => /braid/i.test(l.name)) >= 0 ? RODS.boat.lines.findIndex((l) => /braid/i.test(l.name)) : 0);
  const F = newFight(pollack, pollack.size[1], braid, std, 'rock', dice(2), { level: BEHAVIOUR.natural });
  F.coverK = Math.max(F.coverK, 0.6);
  for (let k = 0; k < 30 && F.chafe === 0; k++) {
    Object.assign(F, { slipping: true, progress: 0.05, pulling: true, move: 'dive', ratio: 9, tension: 0.8 });
    // (Only this step's rubbing: everything else the step does is beside the point here.)
    const keep = { progress: 0.05 };
    stepFight(F, true, 1 / 30, std, () => 0.99);
    Object.assign(F, keep);
  }
  assert.ok(F.chafe > 0, 'chafed in among the rock');
  const c = F.chafe;
  // Out of it: the snag timer eases off, but the chafe stays.
  for (let k = 0; k < 60; k++) {
    Object.assign(F, { progress: 0.6, slipping: false });
    stepFight(F, true, 1 / 30, std, () => 0.99);
  }
  assert.ok(F.chafe >= c, 'still chafed');
  // Weaker: at 0.9 of its rating a sound line doesn't strain; a chafed one does.
  const strainAt = (chafe) => {
    const G = newFight(pollack, pollack.size[0], braid, std, false, dice(9), { level: BEHAVIOUR.natural });
    Object.assign(G, { chafe, strain: 0, phaseT: 99 });
    for (let k = 0; k < 30; k++) {
      G.tension = 0.92;
      stepFight(G, true, 1 / 30, std, () => 0.99);
    }
    return G.strain;
  };
  assert.equal(strainAt(0), 0, 'sound line: no strain at 0.92');
  assert.ok(strainAt(0.5) > 0, 'chafed line: strains');
  // Teeth: a pike on a fluorocarbon leader nicks it on its runs; on a wire trace, never.
  const pike = fishById.pike;
  const fluoro = { line: { ...RODS.spin.lines[0], trace: false }, power: RODS.spin.power, flex: RODS.spin.flex, drag: RODS.spin.drag };
  const wire = { ...fluoro, line: { ...fluoro.line, trace: true } };
  const runs = (rod) => {
    const P = newFight(pike, pike.size[0] + 10, rod, std, false, dice(4), { level: BEHAVIOUR.natural });
    for (let k = 0; k < 30 * 60 && P.progress < 1; k++) if ((stepFight(P, !(P.surgeT > 0), 1 / 30, std, dice(k + 1)) || '').startsWith('snap')) break;
    return P;
  };
  assert.ok(runs(fluoro).chafe > 0, 'nicked by the pike’s teeth');
  assert.equal(runs(wire).chafe, 0, 'the wire trace: no nicks');
});

test('after the fight the chafe stays on the rod’s line until it’s respooled', () => {
  const quiet = { time: 30, peak: 0.6, chafe: 0 }, rubbed = { time: 30, peak: 0.6, chafe: 0.4 };
  assert.ok(wearFrom(rubbed) > wearFrom(quiet) + 0.2, `${wearFrom(quiet).toFixed(2)} without chafe, ${wearFrom(rubbed).toFixed(2)} with`);
  const line = RODS.sea.lines[0];
  assert.ok(wornLine(line, wearFrom(rubbed)).kg < wornLine(line, wearFrom(quiet)).kg, 'and the line breaks more easily');
});
