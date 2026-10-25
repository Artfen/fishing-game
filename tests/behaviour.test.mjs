// Fish as individuals, and the fight and line that follow: every fish has its own build (the
// same every time), each kind answers the current, the weather, the light and a disturbance its
// own way and says why it turned away; a hooked fish leaps, turns and tires, side pressure turns
// it, a soft rod cushions it, and on Relaxed it never comes off; the line hangs slack, comes
// tight under load and drifts with the current; the rod bends towards the line; and the Fish
// behaviour setting and the reel's volume are kept. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const B = await import('../src/behaviour.js');
const { fishById, weightOf } = await import('../src/fish.js');
const { newFight, stepFight, DIFFICULTY } = await import('../src/fight.js');
const { RODS } = await import('../src/tackle.js');
const { FishLine } = await import('../src/fishline.js');
const { buildRod, bendRod } = await import('../src/props.js');

function dice(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
const rodOf = (id, drag) => ({ line: { ...RODS[id].lines[0] }, power: RODS[id].power, flex: RODS[id].flex, drag: drag ?? RODS[id].drag });

/* ---------------- individuals ---------------- */

test('every fish has its own build, the same every time: condition, vigour, temper and weight', () => {
  const trout = fishById.trout;
  const a = B.traits(trout, 40, 1234), b = B.traits(trout, 40, 1234);
  assert.deepEqual(a, b, 'the same fish, the same build');
  const all = Array.from({ length: 400 }, (_, i) => B.traits(trout, 40, i));
  const conds = all.map((x) => x.condition);
  assert.ok(Math.min(...conds) >= 0.8 && Math.max(...conds) <= 1.2);
  assert.ok(Math.max(...conds) - Math.min(...conds) > 0.2, 'fish differ');
  for (const x of all) {
    assert.ok(Math.abs(x.weight - weightOf(trout, 40) * x.condition) < 1e-9, 'a fat fish weighs more for its length');
    assert.ok(x.vigour >= 0.78 && x.vigour <= 1.28 && x.temper >= 0.6 && x.temper <= 1.5);
  }
  // (Most about average.)
  const mid = conds.filter((c) => c > 0.92 && c < 1.08).length;
  assert.ok(mid > all.length * 0.55, `${mid} of ${all.length} about average`);
  assert.equal(B.conditionWords(1.15), 'fat and deep-bodied');
  assert.equal(B.conditionWords(0.82), 'thin');
});

test('each kind answers the water its own way: a trout likes a current a carp avoids', () => {
  const env = (o) => ({ current: 0, waves: 0, light: 0.5, disturb: 0, storm: 0, ...o });
  const fish = (id) => ({ sp: fishById[id], temper: 1 });
  const N = B.BEHAVIOUR.natural;
  const troutRun = B.mood(fish('trout'), env({ current: 0.5 }), N).m, troutStill = B.mood(fish('trout'), env({ current: 0 }), N).m;
  const carpRun = B.mood(fish('carp'), env({ current: 0.5 }), N).m, carpStill = B.mood(fish('carp'), env({ current: 0 }), N).m;
  assert.ok(troutRun > troutStill, `trout ${troutRun.toFixed(2)} in a current, ${troutStill.toFixed(2)} in still water`);
  assert.ok(carpStill > carpRun, `carp ${carpStill.toFixed(2)} in still water, ${carpRun.toFixed(2)} in a current`);
  // A storm puts most down; the surf hunters (sea bass) less so.
  const calm = B.mood(fish('perch'), env(), N).m, storm = B.mood(fish('perch'), env({ storm: 1 }), N);
  assert.ok(storm.m < calm * 0.8 && storm.worst === 'storm');
  assert.ok(B.mood(fish('seabass'), env({ storm: 1, waves: 2.5 }), N).m >= B.mood(fish('seabass'), env(), N).m * 0.95);
  // A bright sun puts a shy trout off; a disturbance puts anything off, the more so on Demanding.
  assert.equal(B.mood(fish('trout'), env({ light: 1, current: 0.45 }), N).worst, 'bright');
  const dist = (lv) => B.mood(fish('trout'), env({ disturb: 0.8 }), B.BEHAVIOUR[lv]).m;
  assert.ok(dist('demanding') < dist('natural') && dist('natural') < dist('relaxed'));
  // On Relaxed the water matters much less.
  const R = B.BEHAVIOUR.relaxed;
  assert.ok(B.mood(fish('carp'), env({ current: 0.8 }), R).m > B.mood(fish('carp'), env({ current: 0.8 }), N).m);
  // And a bold fish comes more readily than a shy one.
  assert.ok(B.mood({ sp: fishById.perch, temper: 1.4 }, env(), N).m > B.mood({ sp: fishById.perch, temper: 0.7 }, env(), N).m);
});

test('a fish that turns away says why, in words you can act on', () => {
  const cases = [
    [{ size: true, lure: true }, 'turned', 'size'],
    [{ drag: true }, 'refused', 'drag'],
    [{ line: true }, 'turned', 'line'],
    [{ depth: true, above: true }, 'lost', 'depth'],
    [{ motion: 'fast' }, 'turned', 'motion'],
    [{ mood: 'bright' }, 'lost', 'bright'],
    [{ mood: 'disturbed' }, 'lost', 'spooked'],
    [{ fast: true }, 'startled', 'fast'],
    [{}, 'turned', 'fussy'],
  ];
  for (const [parts, reason, code] of cases) {
    const [c, text] = B.whyRejected(parts, reason);
    assert.equal(c, code, JSON.stringify(parts));
    assert.ok(text.length > 20 && /[.!]$/.test(text));
  }
  assert.match(B.whyRejected({ depth: true, above: true }, 'lost')[1], /deeper/);
  assert.match(B.whyRejected({ depth: true, above: false }, 'lost')[1], /shallower/);
});

test('in the ecosystem: a dragging fly or a thick line is forgiven more on Relaxed, and a disturbance lingers then fades', async () => {
  const { createHabitat } = await import('../src/world/habitat.js');
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const eco = new Ecosystem(createHabitat());
  const a = eco.bySpecies.trout[0];
  assert.ok(a.condition && a.weight > 0 && a.vigour, 'every fish in the water has its build');
  const bait = { item: 'dry', size: 0.5, fly: 'dry', drag: true, thick: 0.9, natural: false, motion: 'still', nearBottom: true };
  const parts = {};
  eco.level = B.BEHAVIOUR.relaxed;
  const relaxed = eco.appeal(a, bait, parts);
  eco.level = B.BEHAVIOUR.demanding;
  const demanding = eco.appeal(a, bait);
  assert.ok(relaxed > demanding * 2, `relaxed ${relaxed.toFixed(3)} vs demanding ${demanding.toFixed(3)}`);
  assert.ok(parts.drag, 'and it knows why');
  // A splash here makes the water warier for a while.
  eco.time = 100;
  eco.disturb(10, 10, 0.6);
  const now = eco.disturbAt(10, 10);
  assert.ok(now > 0.4 && eco.disturbAt(80, 80) === 0);
  eco.time = 300;
  assert.ok(eco.disturbAt(10, 10) < now * 0.1, 'it fades');
});

/* ---------------- the fight ---------------- */

function fightOf(sp, { level = B.BEHAVIOUR.relaxed, jumpy = 0, rod = 'spin', seed = 3, who = {} } = {}) {
  return newFight(sp, sp.size[1], rodOf(rod), DIFFICULTY.standard, false, dice(seed), { jumpy, level, ...who });
}

test('a leaping fish never throws the hook on Relaxed; on Demanding a slack line in the leap loses some', () => {
  const sp = fishById.seabass;
  const play = (level, held) => {
    let thrown = 0, jumps = 0;
    for (let s = 1; s <= 60; s++) {
      const F = fightOf(sp, { level, jumpy: 1, seed: s });
      const rnd = dice(s * 7);
      for (let i = 0; i < 3000; i++) {
        // (held: keep the line tight through it all; otherwise drop the rod as it runs.)
        const ev = stepFight(F, held || !F.pulling, 1 / 30, DIFFICULTY.standard, rnd);
        if (ev === 'jump') jumps++;
        if (ev === 'off:thrown') thrown++;
        if (ev && (ev.startsWith('off:') || ev.startsWith('snap:'))) break;
        if (F.progress >= 1) break;
      }
    }
    return { thrown, jumps };
  };
  const relaxed = play(B.BEHAVIOUR.relaxed, false), demanding = play(B.BEHAVIOUR.demanding, false);
  assert.ok(relaxed.jumps > 20 && demanding.jumps > 20, 'jumpy fish leap');
  assert.equal(relaxed.thrown, 0);
  assert.ok(demanding.thrown > 0, `${demanding.thrown} thrown of ${demanding.jumps} leaps`);
});

test('on a run it turns now and then, tires, and is beaten in the end', () => {
  const F = fightOf(fishById.carp, { rod: 'carp' });
  const seen = new Set();
  const rnd = dice(11);
  for (let i = 0; i < 9000 && F.progress < 1; i++) {
    const ev = stepFight(F, !(F.surgeT > 0 || (F.warned && !F.pulling)), 1 / 30, DIFFICULTY.standard, rnd);
    if (ev) seen.add(ev);
  }
  for (const e of ['run', 'turn', 'tiring', 'beaten']) assert.ok(seen.has(e), `${e}: ${[...seen].join(', ')}`);
  assert.ok(F.progress >= 1, 'landed');
});

test('side pressure against a run tires the fish sooner; a fitter fish lasts longer', () => {
  const run = (sideAgainst, who = {}) => {
    const F = fightOf(fishById.carp, { rod: 'carp', who });
    const rnd = dice(5);
    let t = 0;
    while (F.stamina > 0.3 && t < 400) {
      F.side = sideAgainst && F.pulling ? -F.dir : 0;
      stepFight(F, !(F.surgeT > 0 || (F.warned && !F.pulling)), 1 / 30, DIFFICULTY.standard, rnd);
      t += 1 / 30;
    }
    return t;
  };
  const plain = run(false), side = run(true);
  assert.ok(side < plain * 0.95, `tired in ${side.toFixed(0)} s with side pressure, ${plain.toFixed(0)} s without`);
  assert.ok(run(false, { vigour: 1.25, condition: 1.15 }) > run(false, { vigour: 0.8, condition: 0.85 }), 'a fit fish lasts');
});

test('a soft rod cushions a surge; a stiff one passes it to the line', () => {
  const peak = (flex) => {
    const F = newFight(fishById.carp, fishById.carp.size[1], { ...rodOf('carp'), flex }, DIFFICULTY.standard, false, dice(9));
    const rnd = dice(9);
    let most = 0;
    for (let i = 0; i < 900; i++) {
      stepFight(F, true, 1 / 30, DIFFICULTY.standard, rnd);
      if (F.surgeT > 0) most = Math.max(most, F.tension);
    }
    return most;
  };
  assert.ok(peak(0.6) < peak(1.4), `soft ${peak(0.6).toFixed(2)}, stiff ${peak(1.4).toFixed(2)}`);
});

test('a light hold tears free under a drag set too tight, never with a sensible drag, and never on Relaxed', () => {
  // A big carp on the carp rod, played carefully, with the drag at `drag`: how many of 40
  // lightly hooked fish pull free.
  const pulled = (level, drag) => {
    let n = 0;
    for (let s = 1; s <= 40; s++) {
      const F = newFight(fishById.carp, fishById.carp.size[1], rodOf('carp', drag), DIFFICULTY.standard, false, dice(s), { level });
      F.hold = 'light';
      const rnd = dice(s * 3);
      for (let i = 0; i < 9000 && F.progress < 1; i++) {
        const ev = stepFight(F, !(F.surgeT > 0 || (F.warned && !F.pulling)), 1 / 30, DIFFICULTY.standard, rnd);
        if (ev === 'off:pulled') n++;
        if (ev && (ev.startsWith('off:') || ev.startsWith('snap:'))) break;
      }
    }
    return n;
  };
  assert.equal(pulled(B.BEHAVIOUR.relaxed, 4), 0);
  assert.ok(pulled(B.BEHAVIOUR.demanding, 4) > 10, `tight drag: ${pulled(B.BEHAVIOUR.demanding, 4)} of 40 pulled free`);
  assert.ok(pulled(B.BEHAVIOUR.demanding, 1) <= 2, `light drag: ${pulled(B.BEHAVIOUR.demanding, 1)} of 40 pulled free`);
});

/* ---------------- the line and the rod ---------------- */

const flat = { surface: () => 0, wind: (x, z, o) => { o.x = 0; o.z = 0; }, flow: (x, z, o) => { o.x = 0; o.z = 0; } };
const lengthOf = (L) => {
  let s = 0;
  for (let i = 0; i < L.n - 1; i++) s += Math.hypot(L.p[i * 3 + 3] - L.p[i * 3], L.p[i * 3 + 4] - L.p[i * 3 + 1], L.p[i * 3 + 5] - L.p[i * 3 + 2]);
  return s;
};

test('slack line sags from the tip and lies on the water; drawn tight it runs straight', () => {
  const tip = new THREE.Vector3(0, 2.5, 0), end = new THREE.Vector3(0, 0, 20);
  const L = new FishLine(30);
  const straight = tip.distanceTo(end);
  for (let i = 0; i < 300; i++) L.step(tip, end, straight * 1.06, 1 / 60, flat);
  assert.ok(L.sag > 1, `slack: sags ${L.sag.toFixed(2)} m`);
  let onWater = 0;
  for (let i = 1; i < L.n - 1; i++) if (Math.abs(L.p[i * 3 + 1]) < 0.06) onWater++;
  assert.ok(onWater >= 5, `${onWater} points lie on the water`);
  for (let i = 0; i < L.n * 3; i++) assert.ok(Number.isFinite(L.p[i]));
  assert.ok(lengthOf(L) < straight * 1.06 * 1.02, 'never longer than the line out');
  // Tight: no longer than the distance, and pulled taut.
  for (let i = 0; i < 120; i++) {
    L.step(tip, end, straight, 1 / 60, flat);
    L.straighten(tip, end, 0.3);
  }
  assert.ok(L.sag < 0.15, `tight: sags ${L.sag.toFixed(2)} m`);
});

test('slack line on the water drifts with the current; in the air it bellies downwind', () => {
  const tip = new THREE.Vector3(0, 2.5, 0), end = new THREE.Vector3(0, 0, 20);
  const stream = { ...flat, flow: (x, z, o) => { o.x = 0.6; o.z = 0; } };
  const L = new FishLine(30);
  for (let i = 0; i < 400; i++) L.step(tip, end, 22, 1 / 60, stream);
  const mid = L.p[15 * 3];
  assert.ok(mid > 0.5, `the middle is carried ${mid.toFixed(2)} m downstream`);
  const windy = { ...flat, surface: () => -50, wind: (x, z, o) => { o.x = -4; o.z = 0; } };
  const W = new FishLine(30);
  const hi = new THREE.Vector3(0, 10, 20);
  for (let i = 0; i < 400; i++) W.step(tip, hi, 21, 1 / 60, windy);
  assert.ok(W.p[15 * 3] < -0.5, 'blown downwind');
});

test('the rod bends towards the line: a fish off to one side bends it that way', () => {
  const rod = buildRod(RODS.spin.look);
  const tipAt = () => {
    rod.group.updateMatrixWorld(true);
    return rod.tip.getWorldPosition(new THREE.Vector3());
  };
  const straight = tipAt();
  // (Pulled straight along the rod it keeps its usual way: towards +z.)
  for (let i = 0; i < 40; i++) bendRod(rod, 1, new THREE.Vector3(0, 30, 0.01));
  const usual = tipAt();
  assert.ok(usual.z > straight.z + 0.3 && Math.abs(usual.x) < 0.05, `usual way ${usual.x.toFixed(2)}, ${usual.z.toFixed(2)}`);
  for (let i = 0; i < 40; i++) bendRod(rod, 1, new THREE.Vector3(20, 2, 0));
  const right = tipAt();
  assert.ok(right.x > 0.3 && Math.abs(right.z) < 0.2, `towards +x: ${right.x.toFixed(2)}, ${right.z.toFixed(2)}`);
  assert.ok(rod.guides.length === 5 && rod.lineFrom && rod.spool, 'guides, the reel and where the line leaves it');
});

/* ---------------- settings ---------------- */

test('the Fish behaviour setting and the reel’s volume are kept, Relaxed and on by default', async () => {
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const { cleanSettings, DEFAULT_SETTINGS } = await import('../src/settings.js');
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data });
  assert.equal(parseSave(wrap({ day: 2, behaviour: 'demanding' })).state.behaviour, 'demanding');
  assert.equal(parseSave(wrap({ day: 2 })).state.behaviour, 'relaxed');
  assert.equal(parseSave(wrap({ day: 2, behaviour: 'brutal' })).state.behaviour, 'relaxed');
  assert.equal(DEFAULT_SETTINGS.audio.reel, 0.9);
  assert.equal(cleanSettings({ audio: { reel: 0.3 } }).audio.reel, 0.3);
  assert.equal(cleanSettings({ audio: { reel: 7 } }).audio.reel, 1);
});
