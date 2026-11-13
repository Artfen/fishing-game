// Fish escaping into structure (E2c, see fight.js stuckStep and fishing.js seekCover): a fish that
// reaches the weed or the rocks with line pouring off is caught fast in them, not lost there and
// then. Slack lets it swim out (on Relaxed always), a new angle pulls it free, steady pressure works
// it out of weed but saws the line on rock, force breaks the line, and left in there on Natural and
// Demanding it may shed the hook. In the game, a hooked fish makes for real weed or rock near it.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// (A stand-in canvas: the fish models paint their fins on one, and the cast's arc its glow.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { newFight, stepFight, breakReason, DIFFICULTY, STUCK, DRAG_LEVELS } = await import('../src/fight.js');
const { fishById, weightOf } = await import('../src/fish.js');
const { RODS, TACKLE, lineInUse } = await import('../src/tackle.js');
const { BEHAVIOUR } = await import('../src/behaviour.js');
const { Fishing } = await import('../src/fishing.js');
const { Boat } = await import('../src/boat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { seeded } = await import('../src/util.js');

const dice = (seed) => {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
};
const diff = DIFFICULTY.standard;
const mono = { name: '4 lb mono', kg: 1.6, stretch: 1, abrade: 1 };
const braid = { name: '20 lb braid', kg: 1.6, stretch: 0, abrade: 0.55 };
const leader = { name: '20 lb braid with a fluorocarbon leader', kg: 1.6, stretch: 0, abrade: 1.6 };

// A pollack on line too light to turn it, out at the far end on a run, beside weed or rock.
function running(cover = 'weed', line = mono, level = BEHAVIOUR.natural, seed = 3, drag = 2) {
  const rnd = dice(seed);
  const F = newFight(fishById.pollack, 60, { line, power: 1, flex: 1, drag }, diff, cover, rnd, { level });
  Object.assign(F, { pulling: true, phaseT: 99, progress: 0.02, move: null });
  return { F, rnd };
}
// Run it until it's caught fast (winding against the run, the line pouring off).
function stuckIn(cover, line, level, seed, drag) {
  const r = running(cover, line, level, seed, drag);
  for (let i = 0; i < 30 * 30 && !r.F.stuck; i++) {
    const ev = stepFight(r.F, true, 1 / 30, diff, r.rnd);
    assert.ok(!ev || !ev.includes(':'), `ended before it stuck: ${ev}`);
    if (!r.F.stuck) Object.assign(r.F, { phaseT: 99, pulling: true });
  }
  assert.ok(r.F.stuck, 'caught fast');
  return r;
}
// Or just caught fast already (as stepFight leaves it): for a line it couldn't have reached the
// cover on, to see what that line does once it's in there.
function stuckAs(kind, line, level, seed, drag = 2) {
  const r = running(kind, line, level, seed, drag);
  Object.assign(r.F, { stuck: kind, stuckT: 0, workT: 0, slackT: 0, angle: 0, pulling: false, slipping: false, tension: 0.3 });
  return r;
}
// Then play it for up to `secs`: held or not each step (held(F, t)). How it went.
function play({ F, rnd }, held, secs = 60) {
  let t = 0;
  for (; t < secs; t += 1 / 30) {
    const ev = stepFight(F, held(F, t), 1 / 30, diff, rnd);
    if (ev === 'unstuck') return { out: true, by: F.unstuckBy, t, F };
    if (ev && ev.includes(':')) return { end: ev, t, F };
  }
  return { t, F };
}

/* ---------- the rules (fight.js) ---------- */

test('reaching the weed or the rocks with line pouring off, it’s caught fast in them, not lost there and then', () => {
  const W = stuckIn('weed', mono, BEHAVIOUR.natural, 3);
  assert.equal(W.F.stuck, 'weed');
  assert.equal(W.F.pulling, false);
  const progress = W.F.progress;
  // (Winding doesn't bring it in.)
  for (let i = 0; i < 30; i++) stepFight(W.F, true, 1 / 30, diff, W.rnd);
  assert.equal(W.F.progress, progress, 'it doesn’t come in');
  const R = stuckIn('rock', mono, BEHAVIOUR.natural, 4);
  assert.equal(R.F.stuck, 'rock');
  // (A line that stands up to rock turns it before it gets there, as ever.)
  const L = running('rock', leader, BEHAVIOUR.natural, 4);
  for (let i = 0; i < 30 * 30 && !L.F.stuck; i++) {
    stepFight(L.F, true, 1 / 30, diff, L.rnd);
    if (!L.F.stuck) Object.assign(L.F, { phaseT: 99, pulling: true });
  }
  assert.equal(L.F.stuck, null, 'a leader turns it short of the rock');
});

test('slack lets it swim out: out of weed sooner than from under a rock; on Relaxed always, in a few seconds', () => {
  const times = (cover, line) => {
    const out = [];
    for (let s = 1; s <= 60; s++) {
      const r = play(stuckIn(cover, line, BEHAVIOUR.relaxed, 100 + s), () => false, 120);
      // (Relaxed: never shed, so it always comes out.)
      assert.ok(r.out, `${cover} ${s}: ${JSON.stringify({ end: r.end, t: r.t })}`);
      assert.equal(r.by, 'slack');
      out.push(r.t);
    }
    return out;
  };
  const weed = times('weed', mono), rock = times('rock', mono);
  const mean = (a) => a.reduce((p, q) => p + q, 0) / a.length;
  assert.ok(Math.max(...weed) <= STUCK.relaxed + 0.05 && Math.max(...rock) <= STUCK.relaxed + 0.05, 'on Relaxed, out within three seconds of slack');
  // On Natural it takes its own time: weed sooner than rock.
  const nat = (cover, line) => {
    const out = [];
    for (let s = 1; s <= 80; s++) {
      const r = play(stuckIn(cover, line, BEHAVIOUR.natural, 300 + s), () => false, 120);
      if (r.out) out.push(r.t);
    }
    return out;
  };
  const w = nat('weed', mono), r = nat('rock', mono);
  assert.ok(w.length > 60, `weed: out ${w.length} of 80`);
  assert.ok(mean(w) < mean(r), `weed ${mean(w).toFixed(1)} s, rock ${mean(r).toFixed(1)} s`);
  assert.ok(mean(weed) <= mean(w) + 0.5, 'quicker still on Relaxed');
});

test('a new angle pulls it free at once', () => {
  const W = stuckIn('rock', mono, BEHAVIOUR.demanding, 7);
  W.F.angle = 0.3;
  assert.equal(stepFight(W.F, true, 1 / 30, diff, W.rnd) === 'unstuck', false, 'a little isn’t enough');
  W.F.angle = STUCK.angle + 0.1;
  assert.equal(stepFight(W.F, true, 1 / 30, diff, W.rnd), 'unstuck');
  assert.equal(W.F.unstuckBy, 'angle');
  assert.equal(W.F.stuck, null);
});

test('steady pressure works a tired fish out of weed in a few seconds, a fresh one on light line only slowly, with little harm to the line; on rock it saws braid through, while a leader stands it', () => {
  const tired = stuckIn('weed', mono, BEHAVIOUR.relaxed, 9);
  tired.F.stamina = 0.1;
  const w = play(tired, () => true, 60);
  assert.equal(w.by, 'worked');
  assert.ok(w.t < 8, `a tired fish worked out in ${w.t.toFixed(1)} s`);
  assert.ok(w.F.chafe < 0.3, `chafe ${w.F.chafe.toFixed(2)}`);
  const fresh = play(stuckIn('weed', mono, BEHAVIOUR.relaxed, 9), () => true, 60);
  assert.equal(fresh.by, 'worked');
  assert.ok(fresh.t > 2 * w.t, `a fresh one on light line: ${fresh.t.toFixed(1)} s against ${w.t.toFixed(1)}`);
  // (On rock, a tired fish too: braid is sawn through before it comes, a leader lasts.)
  const tiredAs = (line) => {
    const r = stuckAs('rock', line, BEHAVIOUR.relaxed, 9, 3);
    r.F.stamina = 0.1;
    return r;
  };
  const b = play(tiredAs(braid), () => true, 60);
  assert.equal(b.end, 'snap:rock', JSON.stringify({ by: b.by, t: b.t }));
  const l = play(tiredAs(leader), () => true, 60);
  assert.equal(l.by, 'worked', JSON.stringify({ end: l.end, t: l.t }));
  assert.ok(l.F.chafe > w.F.chafe, 'but even a leader takes some chafe on rock');
  assert.match(breakReason('rock', fishById.pollack, { line: braid }, { stuck: true }), /sawed the 20 lb braid through.*braid fastest/);
});

test('pulling hard on a weeded fish, the drag locked, breaks the line on the stems; the reason says what would have saved it', () => {
  const r = play(stuckIn('weed', mono, BEHAVIOUR.natural, 11, DRAG_LEVELS.length - 1), () => true, 30);
  assert.equal(r.end, 'snap:snag');
  assert.match(breakReason('snag', fishById.pollack, { line: mono }, { stuck: true }), /fast in the weed.*slack.*new angle/);
  assert.match(breakReason('snag', fishById.pollack, { line: mono }, {}), /Heavier line or a firmer drag/, 'a fish that cut the line on its way in: as before');
});

test('left in there on Natural and Demanding, it may work the hook out; more readily from a light hold, more on Demanding, never on Relaxed', () => {
  // (Held lightly against it, the drag slipping: it neither comes out nor goes slack.)
  const shed = (level, hold) => {
    let n = 0;
    for (let s = 1; s <= 80; s++) {
      const S = stuckAs('rock', leader, level, 500 + s, 0);
      S.F.hold = hold;
      // (Neither slack nor pressure enough to work it: the drag set right off.)
      const r = play(S, () => true, 30);
      if (r.end === 'off:weeded') n++;
    }
    return n;
  };
  const dLight = shed(BEHAVIOUR.demanding, 'light'), dSolid = shed(BEHAVIOUR.demanding, 'solid'), nSolid = shed(BEHAVIOUR.natural, 'solid');
  assert.equal(shed(BEHAVIOUR.relaxed, 'light'), 0);
  assert.ok(dLight > dSolid && dSolid > nSolid, `Demanding light ${dLight}, solid ${dSolid}; Natural solid ${nSolid}`);
  assert.ok(nSolid > 0);
  assert.match(breakReason('weeded', fishById.pollack, { line: leader }, { kind: 'rock' }), /wedged under the rocks.*slack straight away/);
  assert.match(breakReason('weeded', fishById.pollack, { line: mono }, { kind: 'weed' }), /clump of weed/);
});

test('out again, it has a few seconds’ grace before it can be caught up again', () => {
  const W = stuckIn('weed', mono, BEHAVIOUR.relaxed, 13);
  W.F.angle = 1;
  assert.equal(stepFight(W.F, false, 1 / 30, diff, W.rnd), 'unstuck');
  W.F.angle = 0;
  let again = false;
  for (let t = 0; t < STUCK.grace - 0.2; t += 1 / 30) {
    Object.assign(W.F, { pulling: true, phaseT: 99 });
    if (stepFight(W.F, true, 1 / 30, diff, W.rnd) === 'stuck') again = true;
  }
  assert.equal(again, false);
});

/* ---------- in the game (fishing.js) ---------- */

const scene = new THREE.Scene();
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
// Real places (found with the habitat: rock and weed beds with open water beside them):
const ROCK = { x: -96, z: 68 }; // rock 8 m down; open water south of it

function onLine(at, level = 'natural') {
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(at.x, at.z + 30, Math.PI);
  const eco = new Ecosystem(habitat);
  const words = [], lost = [], flashes = [];
  const hooks = { flash: (t) => flashes.push(t), key: (a) => a, teach: (k) => words.push(k), canopyAt: () => false, onSnap: (why) => lost.push(why), line: undefined };
  const f = new Fishing(scene, b, quiet, quiet, eco, new Proxy(hooks, { get: (o, k) => (k in o ? o[k] : () => {}) }));
  // (On 2 lb line: too light to turn a good pollack short of the rock.)
  f.setRig({ ...RODS.float, line: { ...lineInUse({}, RODS.float), name: '2 lb mono', kg: 0.9 } }, TACKLE.worm);
  f.level = BEHAVIOUR[level];
  const a = eco.agents.find((q) => q.sp.id === 'pollack');
  a.size = 60;
  a.weight = weightOf(a.sp, 60);
  f.hook.set(at.x, -1, at.z + 14);
  // (The rod tip where it is in the boat, so the line's length is the real one.)
  b.update(1 / 30, 0, 0, 0, 0);
  b.group.updateMatrixWorld(true);
  b.rodTip.getWorldPosition(f.tip);
  f.agent = a;
  f.state = 'bite';
  f.setHook();
  let t = 0;
  // (held: true, false, or (fight) => whether to wind this step.)
  const step = (secs, held = false, each = () => {}) => {
    for (let i = 0; i < secs * 30 && f.fight; i++) {
      t += 1 / 30;
      b.update(1 / 30, t, 0, 0, 0);
      each(f.fight);
      f.update(1 / 30, t, b.heading, typeof held === 'function' ? held(f.fight) : held);
    }
  };
  return { f, b, step, words, lost, flashes };
}

test('a hooked fish knows the rock near it and makes for it on a run; caught fast there, it stays put, and the boat over the top frees it', (t) => {
  // (The world's own dice, seeded, so the run is the same every time.)
  const real = Math.random;
  Math.random = seeded(117);
  t.after(() => (Math.random = real));
  const G = onLine(ROCK);
  const F = G.f.fight;
  G.step(0.6);
  assert.ok(F.haven, 'the rock found');
  assert.equal(F.haven.kind, 'rock');
  const before = Math.hypot(G.f.fishPos.x - ROCK.x, G.f.fishPos.z - ROCK.z);
  // A long run, out at the far end, winding against it: it makes for the rock and is caught fast.
  // (Then let go: winding on, the rock would saw the line.)
  G.step(20, (q) => !q.stuck, (q) => {
    if (!q.stuck) Object.assign(q, { pulling: true, phaseT: 99, progress: Math.min(q.progress, 0.05), extra: 0, stamina: Math.max(q.stamina, 0.8) });
  });
  assert.ok(G.f.fight, `still on: ${G.lost}`);
  assert.equal(F.stuck, 'rock', `cover ${F.coverKind}, ${Math.hypot(G.f.fishPos.x - ROCK.x, G.f.fishPos.z - ROCK.z).toFixed(1)} m from it (was ${before.toFixed(1)})`);
  assert.ok(G.words.includes('weeded'), 'told what to do');
  assert.ok(G.flashes.some((w) => /wedged under the rocks/.test(w)));
  const at = { ...F.stuckAt };
  G.step(0.5, true);
  assert.ok(Math.hypot(G.f.fishPos.x - at.x, G.f.fishPos.z - at.z) < 0.01, 'it stays put');
  // The boat brought over the top of it: free.
  G.b.place(at.x, at.z + 1, Math.PI);
  G.step(0.2);
  assert.equal(F.stuck, null);
  assert.equal(F.unstuckBy, 'angle');
});
