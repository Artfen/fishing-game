// The fishing experience (roadmap section 3): each kind makes for cover as itself (a pollack for
// the kelp, a mackerel just runs); rock chafes braid through where a leader stands up to it; line
// stretch against the hook-set at range; and the landing net: a fish too heavy to lift on the line
// waits alongside to be netted, and lifting it, or winding hard as it kicks, can lose it.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// (A stand-in canvas: the fish models paint their fins on one, and the cast's arc its glow.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { newFight, stepFight, DIFFICULTY, coverPull, swingLimit, breakReason } = await import('../src/fight.js');
const { fishById, weightOf } = await import('../src/fish.js');
const { RODS, TACKLE, lineInUse, lineNature } = await import('../src/tackle.js');
const { BEHAVIOUR } = await import('../src/behaviour.js');
const { Fishing } = await import('../src/fishing.js');
const { Boat } = await import('../src/boat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');

// A seeded dice, so a run of fights is the same run each time.
const dice = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
// n fights, played carefully (winding between its runs, letting it run): how each ended.
function fights(sp, size, line, cover, n = 160, who = {}) {
  const out = {}, rnd = dice(11), diff = DIFFICULTY.standard;
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, size, { line, power: 1, flex: 1, drag: 2 }, diff, cover, rnd, who);
    let end = 'landed';
    for (let k = 0; k < 30 * 120; k++) {
      const ev = stepFight(F, !F.pulling && F.tension < 0.85, 1 / 30, diff, rnd);
      if (ev && (ev.startsWith('snap:') || ev.startsWith('off:'))) {
        end = ev.split(':')[1];
        break;
      }
      if (F.progress >= 1) break;
    }
    out[end] = (out[end] || 0) + 1;
  }
  return out;
}

test('each kind makes for cover as itself: the pollack and the conger dive for it, the mackerel and the tuna just run', () => {
  for (const id of ['pollack', 'conger', 'wrasse', 'grouper', 'tench']) assert.ok(coverPull(fishById[id]) >= 1.6, id);
  for (const id of ['mackerel', 'tuna', 'garfish', 'bluemarlin']) assert.ok(coverPull(fishById[id]) <= 0.2, id);
  assert.equal(coverPull({ id: 'nothing-special', fight: 'steady' }), 1);
  // On line just too light to turn it, in the same weed: the pollack reaches it far more often.
  const line = { name: '4 lb mono', kg: 1.6, stretch: 1, abrade: 1 };
  const pollack = fights(fishById.pollack, 60, line, 'weed');
  const mackerel = fights(fishById.mackerel, 40, { ...line, kg: 0.42 }, 'weed');
  assert.ok((pollack.snag || 0) > 20, JSON.stringify(pollack));
  assert.ok((pollack.snag || 0) > 3 * (mackerel.snag || 0) + 5, `pollack ${JSON.stringify(pollack)}, mackerel ${JSON.stringify(mackerel)}`);
  // In open water, nothing to reach.
  assert.equal(fights(fishById.pollack, 60, line, false).snag || 0, 0);
});

test('rock chafes braid through; a fluorocarbon leader stands up to it', () => {
  const braid = lineInUse({ line: { spin: 'b20' }, term: { spin: 'none' } }, RODS.spin);
  const leader = lineInUse({ line: { spin: 'b20' }, term: { spin: 'fluoro' } }, RODS.spin);
  const wire = lineInUse({ line: { spin: 'b20' }, term: { spin: 'wire' } }, RODS.spin);
  assert.deepEqual([braid.stretch, braid.abrade], [0, 0.55]);
  assert.ok(leader.abrade > 1 && wire.abrade > leader.abrade);
  assert.deepEqual(lineNature('6 lb mono'), { stretch: 1, abrade: 1 });
  assert.ok(lineNature('4 lb fluorocarbon').stretch < 1 && lineNature('4 lb fluorocarbon').abrade > 1);
  assert.equal(lineInUse({}, RODS.offshore).abrade, 2.5, 'the offshore rod’s shock leader');
  // A wrasse down in the rocks, on line that would hold it in weed: braid alone is cut, the
  // leader holds.
  const kg = 1.6, sp = fishById.wrasse;
  const onBraid = fights(sp, 40, { ...braid, kg }, 'rock'), onLeader = fights(sp, 40, { ...leader, kg }, 'rock');
  assert.ok((onBraid.rock || 0) > 15, JSON.stringify(onBraid));
  assert.ok((onLeader.rock || 0) < (onBraid.rock || 0) / 3, `braid ${JSON.stringify(onBraid)}, leader ${JSON.stringify(onLeader)}`);
  assert.equal(onBraid.snag || 0, 0, 'on rock it chafes; it doesn’t tangle in weed');
  assert.match(breakReason('rock', sp, { line: braid }), /braid cuts on rock/);
  assert.match(breakReason('rock', sp, { line: leader }), /chafed through/);
});

test('the hook-set: stretchy line sets the hook less well at long range; braid sets it home', () => {
  const sp = fishById.seabass, level = BEHAVIOUR.natural, rnd = dice(5);
  const light = (line, range) => {
    let n = 0;
    for (let i = 0; i < 600; i++) if (newFight(sp, 55, { line, power: 1, flex: 1 }, DIFFICULTY.standard, false, rnd, { level, range }).hold === 'light') n++;
    return n / 600;
  };
  const mono = { name: '15 lb mono', kg: 6.8, stretch: 1 }, braid = { name: '20 lb braid', kg: 9, stretch: 0 };
  assert.ok(light(mono, 50) > light(mono, 10) + 0.15, 'mono out at fifty metres');
  assert.ok(light(braid, 50) < light(mono, 50) - 0.2, 'braid at the same range');
  assert.ok(Math.abs(light(mono, 10) - 0.3) < 0.07, 'close in, as it always was');
  // (On Relaxed, no hook ever pulls.)
  assert.equal(newFight(sp, 55, { line: mono, power: 1, flex: 1 }, DIFFICULTY.standard, false, rnd, { level: BEHAVIOUR.relaxed, range: 60 }).hold, 'solid');
});

test('what you can swing in, and what needs the net', () => {
  assert.equal(swingLimit({ kg: 1.8 }), 0.45);
  assert.equal(swingLimit({ kg: 9 }), 2);
  assert.equal(swingLimit({ kg: 36 }), 2, 'however strong the line');
  assert.ok(weightOf(fishById.mackerel, 32) < swingLimit({ kg: 9 }), 'a mackerel comes straight in');
  assert.ok(weightOf(fishById.seabass, 65) > swingLimit({ kg: 9 }), 'a good bass needs the net');
});

/* ---------- the net, in the real fishing system ---------- */

const scene = new THREE.Scene();
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
// An angler in a skiff off the harbour with a fish on, nearly beaten.
function hooked(levelId) {
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(60, 120, 0);
  const eco = new Ecosystem(habitat);
  const words = [], taught = [], lost = [];
  // (The game's hooks: these few listened to, the rest do nothing; and no worn line.)
  const hooks = { flash: (t) => words.push(t), key: (a) => a, teach: (k) => taught.push(k), canopyAt: () => false, onSnap: (why) => lost.push(why), line: undefined };
  const f = new Fishing(scene, b, quiet, quiet, eco, new Proxy(hooks, { get: (o, k) => (k in o ? o[k] : () => {}) }));
  f.setRig({ ...RODS.sea, line: lineInUse({}, RODS.sea) }, TACKLE.metal);
  f.level = BEHAVIOUR[levelId];
  const a = eco.agents.find((q) => q.sp.id === 'seabass');
  a.size = 66;
  a.weight = weightOf(a.sp, 66);
  f.hook.set(b.pos.x + 14, 0, b.pos.z + 14);
  f.agent = a;
  f.state = 'bite';
  f.setHook();
  const F = f.fight;
  Object.assign(F, { stamina: 0, stage: 'beaten', progress: 0.999, phaseT: 50, pulling: false });
  let t = 0;
  const step = (secs, held = false) => {
    for (let i = 0; i < secs * 30 && f.fight === F; i++) {
      t += 1 / 30;
      b.update(1 / 30, t, 0, 0, 0);
      f.update(1 / 30, t, b.heading, held);
    }
  };
  return { f, F, step, words, taught, lost };
}

test('a fish too heavy to lift waits alongside for the net; a tap nets it', () => {
  const { f, F, step, taught } = hooked('natural');
  step(1, true);
  assert.equal(F.atNet, true, 'beaten and alongside');
  assert.equal(f.state, 'reeling');
  assert.ok(taught.includes('net'));
  assert.ok(f.net.visible, 'the net held out');
  step(0.5, false);
  f.onDown();
  f.onUp();
  assert.equal(f.state, 'landing');
  assert.equal(f.netted, true);
  step(0.3);
  assert.ok(f.net.visible, 'coming out in the net');
  step(1);
  assert.equal(f.net.visible, false);
});

test('lifting it out on the line instead can tear the hook out (and on Relaxed it’s netted for you)', () => {
  const nat = hooked('natural');
  nat.step(6, true);
  assert.deepEqual(nat.lost, ['lifted']);
  assert.equal(nat.f.fight, null);
  const easy = hooked('relaxed');
  easy.step(1, true);
  assert.equal(easy.F.atNet, true);
  easy.step(4, true);
  assert.equal(easy.lost.length, 0, 'nothing lost on Relaxed');
  assert.ok(['landing', 'caught'].includes(easy.f.state), easy.f.state);
  assert.ok(easy.words.some((w) => /Too heavy to lift/.test(w)), 'and told how it’s done');
});
