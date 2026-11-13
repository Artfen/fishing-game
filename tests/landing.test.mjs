// Landing a beaten fish (E2b, see landing.js): the net's limit; a fish too big for it drawn
// alongside a boat, or from the shore beached, taken by the tail or lifted, as the shore allows;
// netting or grabbing as it kicks misses (and can knock a loose hook out) on Natural and Demanding.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// (A stand-in canvas: the fish models paint their fins on one, and the cast's arc its glow.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { fishById, weightOf } = await import('../src/fish.js');
const { RODS, TACKLE, lineInUse } = await import('../src/tackle.js');
const { BEHAVIOUR } = await import('../src/behaviour.js');
const { Fishing } = await import('../src/fishing.js');
const { Boat } = await import('../src/boat.js');
const { Walker } = await import('../src/walker.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { walkHeight, depthAt, waterLevel, zoneAt, SOUTH_Z, JETTY } = await import('../src/world/terrain.js');
const { breakReason } = await import('../src/fight.js');
const { seeded } = await import('../src/util.js');
const { NET, fitsNet, shoreMethod, shoreMethodAt, liftRisk, liftBreakRisk, knockRisk, LAND_WAYS } = await import('../src/landing.js');

const scene = new THREE.Scene();
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
const WORLD = { walkHeight, depthAt, waterLevel, habitat, zoneAt, southZ: SOUTH_Z };

// Places on the real map (found by walking the shore with landing.js shoreMethodAt):
const BEACH = { x: -81, z: -36 }; // the sand of Willow Bay's west shore
const ROCKS = { x: -140, z: -34 }; // a rock ledge low over the lake, rock under the water off it
const PONTOON = { x: -3, z: -45 }; // a pontoon in the harbour, low over 5 m of water
const JETTY_END = { x: JETTY.x, z: 6 }; // on the jetty's deck, 1.15 m up, near its end in 5 m of water

// The way to open water from a spot on the shore: the nearest water deeper than 0.45 m.
function seaward(at) {
  let best = null;
  for (let a = 0; a < 32; a++) {
    const dx = Math.sin((a * Math.PI) / 16), dz = Math.cos((a * Math.PI) / 16);
    for (let d = 0.5; d < 6; d += 0.25) {
      if (depthAt(at.x + dx * d, at.z + dz * d) > 0.45) {
        if (!best || d < best.d) best = { d, dx, dz };
        break;
      }
    }
  }
  return best;
}

// The game's hooks: these few listened to, the rest do nothing; and no worn line.
function hooksFor() {
  const words = [], taught = [], lost = [];
  const hooks = { flash: (t) => words.push(t), key: (a) => a, teach: (k) => taught.push(k), canopyAt: () => false, onSnap: (why) => lost.push(why), line: undefined };
  return { words, taught, lost, hooks: new Proxy(hooks, { get: (o, k) => (k in o ? o[k] : () => {}) }) };
}

// A fish of `sp` at `size` cm on, nearly beaten, at the Fish behaviour `levelId`: from a skiff off
// the harbour, or (at) on foot on the shore, cast out to sea.
function hooked({ levelId = 'natural', sp = 'seabass', size = 66, at = null, rod = 'sea' }) {
  const H = hooksFor();
  let angler, tick;
  if (at) {
    const w = new Walker(scene);
    const s = seaward(at);
    w.place(at.x, at.z, Math.atan2(s.dx, s.dz));
    angler = w;
    angler.cast = s;
    tick = () => {};
  } else {
    const b = new Boat(scene, { kind: 'skiff' });
    b.place(60, 120, 0);
    angler = b;
    tick = (dt, t) => b.update(dt, t, 0, 0, 0);
  }
  const eco = new Ecosystem(habitat);
  const f = new Fishing(scene, angler, quiet, quiet, eco, H.hooks);
  f.setRig({ ...RODS[rod], line: lineInUse({}, RODS[rod]) }, TACKLE.metal);
  f.level = BEHAVIOUR[levelId];
  const a = eco.agents.find((q) => q.sp.id === sp) || eco.agents.find((q) => q.sp.id === 'seabass');
  a.sp = fishById[sp];
  a.size = size;
  a.weight = weightOf(a.sp, size);
  const out = at ? angler.cast : { dx: Math.SQRT1_2, dz: Math.SQRT1_2 };
  f.hook.set(angler.pos.x + out.dx * 16, 0, angler.pos.z + out.dz * 16);
  f.agent = a;
  f.state = 'bite';
  f.setHook();
  const F = f.fight;
  Object.assign(F, { stamina: 0, stage: 'beaten', progress: 0.999, phaseT: 50, pulling: false });
  let t = 0;
  const step = (secs, held = false) => {
    for (let i = 0; i < secs * 30 && f.fight === F && f.state === 'reeling'; i++) {
      t += 1 / 30;
      tick(1 / 30, t);
      f.update(1 / 30, t, angler.heading, held);
    }
  };
  const tap = () => {
    f.onDown();
    f.onUp();
  };
  return { f, F, step, tap, angler, ...H };
}

/* ---------- the rules ---------- */

test('the landing net takes fish up to 110 cm and 16 kg', () => {
  assert.deepEqual(NET, { cm: 110, kg: 16 });
  assert.ok(fitsNet(66, weightOf(fishById.seabass, 66)), 'a good bass');
  assert.ok(fitsNet(105, weightOf(fishById.pike, 105)), 'the biggest pike');
  assert.ok(fitsNet(88, weightOf(fishById.carp, 88)), 'the biggest carp');
  assert.ok(!fitsNet(130, weightOf(fishById.meagre, 130)), 'a big meagre is too long and too heavy');
  assert.ok(!fitsNet(100, 18), 'too heavy, though it’s short enough');
  assert.ok(!fitsNet(115, 6), 'too long, though it’s light enough');
});

test('from the shore: beached on a shelving shore of sand, gravel or mud; taken by the tail where you can reach the water; lifted from higher up', () => {
  const sand = { kind: 'sand' }, gravel = { kind: 'gravel' }, mud = { kind: 'mud' }, rock = { kind: 'rock' }, weed = { kind: 'weed' };
  assert.equal(shoreMethod(0.1, sand, 0.7), 'beach');
  assert.equal(shoreMethod(-0.2, gravel, 0.6), 'beach', 'wading on a gravel bar');
  assert.equal(shoreMethod(0.3, mud, 0.9), 'beach');
  assert.equal(shoreMethod(0.4, rock, 0.7), 'hand', 'no sliding a fish up rock');
  assert.equal(shoreMethod(0.4, weed, 0.7), 'hand', 'nor through weed');
  assert.equal(shoreMethod(0.4, sand, 4), 'hand', 'deep water right off the edge: no shelving shore');
  assert.equal(shoreMethod(1.15, sand, 0.7), 'lift', 'a jetty’s deck: out of reach');
  assert.equal(shoreMethod(2.5, rock, 3), 'lift', 'a high rock');
  // And on the real map: the jetty, Willow Bay's sand and a low rock with deep water off it.
  const at = (spot) => {
    const s = seaward(spot), pos = { x: spot.x, y: walkHeight(spot.x, spot.z), z: spot.z };
    return shoreMethodAt(pos, { x: spot.x + s.dx * (s.d + 0.6), z: spot.z + s.dz * (s.d + 0.6) }, WORLD);
  };
  assert.equal(at(BEACH), 'beach');
  assert.equal(at(ROCKS), 'hand');
  assert.equal(at(PONTOON), 'hand', 'a pontoon: low, the water in reach');
  assert.equal(shoreMethodAt({ x: JETTY_END.x, y: walkHeight(JETTY_END.x, JETTY_END.z), z: JETTY_END.z }, { x: JETTY_END.x + 2.5, z: JETTY_END.z }, WORLD), 'lift');
  // (Standing back up the beach doesn't make it a wall: it's the bank by the water that counts.)
  const s = seaward(BEACH);
  const back = { x: BEACH.x - s.dx * 6, z: BEACH.z - s.dz * 6 };
  assert.equal(shoreMethodAt({ ...back, y: walkHeight(back.x, back.z) }, { x: BEACH.x + s.dx * (s.d + 0.6), z: BEACH.z + s.dz * (s.d + 0.6) }, WORLD), 'beach');
});

test('the risks: none on Relaxed; a lift tears a worn hold out more often than a firm one, and can break a line the fish far outweighs', () => {
  for (const g of [0, 0.5, 1]) {
    assert.equal(liftRisk(0, g, 30), 0);
    assert.equal(knockRisk(0, g), 0);
  }
  assert.equal(liftRisk(1, 1, 30), 0, 'a hold that’s still firm holds');
  assert.ok(liftRisk(1, 0.3, 30) > 3 * liftRisk(1, 0.8, 30));
  assert.ok(liftRisk(1, 0.3, 30) > liftRisk(1, 0.3, 6), 'heavier, more likely');
  assert.ok(liftRisk(1, 0.3, 30) > liftRisk(0.5, 0.3, 30), 'Demanding over Natural');
  assert.equal(liftBreakRisk(1, 16, 9), 0, 'under twice the line’s rating, it holds');
  assert.ok(liftBreakRisk(1, 22, 9) > 0 && liftBreakRisk(1, 22, 9) < 0.5);
  assert.equal(liftBreakRisk(1, 40, 9), 1, 'four times over, it goes');
  assert.equal(liftBreakRisk(0.5, 40, 9), 0.5, 'half as likely on Natural');
  assert.equal(liftBreakRisk(0, 50, 9), 0, 'never on Relaxed');
  assert.ok(knockRisk(1, 0.2) > knockRisk(1, 0.9));
  for (const k of Object.keys(LAND_WAYS)) assert.ok(LAND_WAYS[k].word && LAND_WAYS[k].act, k);
});

/* ---------- from a boat ---------- */

test('from a boat, a fish too big for the net is drawn alongside; one that fits still waits for the net', () => {
  const big = hooked({ sp: 'meagre', size: 130 });
  big.step(1, true);
  assert.equal(big.F.atNet, undefined, 'no net for it');
  assert.ok(big.f.bigCatch(), 'drawn alongside');
  assert.ok(['landing', 'caught'].includes(big.f.state), big.f.state);
  assert.ok(big.taught.includes('alongside'), 'and said why, once');
  const bass = hooked({});
  bass.step(1, true);
  assert.equal(bass.F.atNet, true);
  assert.equal(bass.F.landBy, 'net');
  assert.equal(bass.f.bigCatch(), false);
});

test('netting as it kicks misses on Natural and Demanding (the fish still on, the net tried again once it lies still); on Relaxed it never misses', () => {
  const N = hooked({});
  N.step(1, true);
  Object.assign(N.F, { kickT: 99, grip: 1 });
  N.F.kick = 1;
  N.tap();
  assert.equal(N.f.state, 'reeling', 'missed');
  assert.match(N.F.word, /missed/);
  assert.ok(N.taught.includes('landkick'));
  assert.equal(N.lost.length, 0, 'a firm hold stays in');
  N.step(1.2);
  assert.ok(N.F.kick < 0.3);
  N.tap();
  assert.equal(N.f.state, 'landing', 'netted once it lay still');
  assert.equal(N.f.netted, true);
  const R = hooked({ levelId: 'relaxed' });
  R.step(1, true);
  R.F.kickT = 99;
  R.F.kick = 1;
  R.tap();
  assert.equal(R.f.state, 'landing', 'on Relaxed, netted mid-kick');
});

test('a net swung at a kicking fish knocks a worn hold out now and then, a firm one never', () => {
  let knocked = 0;
  for (let i = 0; i < 60; i++) {
    const D = hooked({ levelId: 'demanding' });
    D.step(1, true);
    Object.assign(D.F, { kickT: 99, grip: 0.2 });
    D.F.kick = 1;
    D.tap();
    if (D.lost.includes('knocked')) knocked++;
  }
  // (0.6 × (1 − 0.2) = 48%.)
  assert.ok(knocked > 15 && knocked < 45, `knocked out ${knocked} of 60`);
  assert.match(breakReason('knocked', fishById.seabass, RODS.sea, { loosened: true }), /rim knocked the hook out: the fight had worn it loose/);
});

test('the stir before each kick: said a moment before, time to let go', () => {
  const N = hooked({});
  N.step(1, true);
  N.F.kickT = 0.9;
  N.step(0.3);
  assert.equal(N.F.word, 'it stirs…');
  assert.equal(N.F.kick, 0, 'not kicking yet');
  N.step(0.7);
  assert.ok(N.F.kick > 0.3, 'and then it kicks');
});

/* ---------- from the shore ---------- */

test('on Willow Bay’s sand, a fish too big for the net is beached: wound steadily up into the shallows while it lies still', () => {
  const B = hooked({ sp: 'meagre', size: 130, at: BEACH });
  B.step(0.5, true);
  assert.equal(B.F.atNet, true);
  assert.equal(B.F.landBy, 'beach');
  assert.ok(B.taught.includes('beach'));
  assert.equal(B.f.net.visible, false, 'no net held out');
  B.F.kickT = 99;
  const from = Math.hypot(B.f.fishPos.x - B.angler.pos.x, B.f.fishPos.z - B.angler.pos.z);
  B.tap();
  assert.equal(B.f.state, 'reeling', 'a tap doesn’t land it');
  B.step(1.2, true);
  const nearer = Math.hypot(B.f.fishPos.x - B.angler.pos.x, B.f.fishPos.z - B.angler.pos.z);
  assert.ok(nearer < from - 0.2, `slid in towards you: ${from.toFixed(2)} to ${nearer.toFixed(2)} m`);
  B.step(1.2, true);
  assert.equal(B.f.state, 'landing');
  assert.equal(B.F.beached, true);
  assert.equal(B.lost.length, 0);
});

test('winding it up the beach through a kick, on a light hold, tears the hook out; letting go as it stirs keeps it on', () => {
  const held = hooked({ sp: 'meagre', size: 130, at: BEACH });
  held.step(0.5, true);
  Object.assign(held.F, { hold: 'light', kickT: 0.4 });
  held.step(0.6, true);
  assert.deepEqual(held.lost, ['kicked']);
  assert.match(breakReason('kicked', fishById.meagre, RODS.sea, { landBy: 'beach' }), /up the beach.*Let go as it stirs/);
  const eased = hooked({ sp: 'meagre', size: 130, at: BEACH });
  eased.step(0.5, true);
  Object.assign(eased.F, { hold: 'light', kickT: 0.4 });
  eased.step(0.6, false);
  assert.equal(eased.lost.length, 0, 'let go, and it’s still on');
  eased.step(1.2, false);
  eased.F.kickT = 99;
  eased.step(2.5, true);
  assert.equal(eased.f.state, 'landing', 'and wound up the beach once it lay still');
});

test('off a low rock ledge, it’s taken by the tail: a tap as it lies still; grab as it kicks and it slips your hand', () => {
  const R = hooked({ sp: 'meagre', size: 130, at: ROCKS });
  R.step(0.5, true);
  assert.equal(R.F.landBy, 'hand');
  assert.ok(R.taught.includes('tail'));
  Object.assign(R.F, { kickT: 99, grip: 1 });
  R.F.kick = 1;
  R.tap();
  assert.equal(R.f.state, 'reeling');
  assert.match(R.F.word, /slipped your hand/);
  R.step(1.2);
  R.tap();
  assert.equal(R.f.state, 'landing');
  assert.equal(R.F.handed, true);
  assert.equal(R.f.netted, false, 'by hand, not the net');
});

test('from the jetty it has to be lifted: a worn hold tears out far more often than a firm one; a line it far outweighs breaks; on Relaxed it comes up', () => {
  const lifted = (grip, levelId = 'demanding', size = 112, rod = 'sea') => {
    const J = hooked({ sp: 'meagre', size, at: JETTY_END, levelId, rod });
    J.step(0.5, true);
    assert.equal(J.F.landBy, 'lift');
    Object.assign(J.F, { kickT: 99, grip, hold: grip < 0.5 ? 'light' : 'solid' });
    J.step(3, true);
    return J;
  };
  const one = lifted(1);
  assert.ok(one.taught.includes('hoist'));
  assert.equal(one.f.state, 'landing', 'a firm hold comes up');
  assert.equal(one.F.hoisted, true);
  // (Seeded dice, so the count is the same every run: 0.75 and 0.15 a lift, see landing.js.)
  const real = Math.random;
  Math.random = seeded(116);
  let worn = 0, firm = 0;
  try {
    for (let i = 0; i < 60; i++) {
      if (lifted(0.25).lost.includes('lifted')) worn++;
      if (lifted(0.85).lost.includes('lifted')) firm++;
    }
  } finally {
    Math.random = real;
  }
  assert.ok(worn > 3 * firm && worn > 35, `worn ${worn}, firm ${firm} of 60`);
  assert.match(breakReason('lifted', fishById.meagre, RODS.sea, { landBy: 'lift' }), /whole weight was on the hook/);
  // A 140 cm meagre (27 kg) lifted on the spinning rod's line (4.5 kg), on Demanding: the line goes.
  const heavy = lifted(1, 'demanding', 140, 'spin');
  assert.deepEqual(heavy.lost, ['hoisted']);
  assert.match(breakReason('hoisted', fishById.meagre, { ...RODS.spin, line: lineInUse({}, RODS.spin) }, {}), /can’t come up a wall on that line/);
  // On Relaxed, nothing is lost.
  for (let i = 0; i < 10; i++) assert.equal(lifted(0.1, 'relaxed', 140, 'spin').lost.length, 0);
});

test('on Relaxed every way of landing it is done for you after a moment', () => {
  for (const at of [BEACH, ROCKS, PONTOON, JETTY_END]) {
    const R = hooked({ sp: 'meagre', size: 130, at, levelId: 'relaxed' });
    R.step(0.5, true);
    R.step(4);
    assert.ok(['landing', 'caught'].includes(R.f.state), `${R.F.landBy}: ${R.f.state}`);
    assert.equal(R.lost.length, 0);
  }
});

/* ---------- playing together ---------- */

test('a friend can net your fish only if it fits the net: one too big for it is landed your own way, and friends see it as such', async () => {
  const { cleanPose } = await import('../src/together.js');
  const { Teamwork } = await import('../src/teamwork.js');
  // (The pose carries how it's landed: 1 waiting for the net, 2 landed another way.)
  const pose = (nt) => cleanPose({ m: 'foot', x: 50, z: 60, h: 0, o: true, a: 'fish', r: 'sea', i: 'metal', ex: 52, ez: 62, hk: 42, nt });
  assert.equal(pose(1).nt, 1);
  assert.equal(pose(2).nt, 2);
  assert.equal(pose(true).nt, 1, 'an older game’s “waiting for the net”');
  assert.equal(pose(0).nt, undefined);
  // A friend nearby is offered the net for the first, not the second.
  const peers = new Map([['mags', { id: 'mags', name: 'Mags', pose: pose(1) }]]);
  const W = new Teamwork({ together: { active: true, peers }, eco: null, lineEnd: () => null });
  assert.ok(W.netTarget({ x: 53, z: 61 }), 'offered the net');
  peers.get('mags').pose = pose(2);
  assert.equal(W.netTarget({ x: 53, z: 61 }), null, 'not for a fish too big for it');
  // And the angler's game won't take a net to one being beached, tailed or lifted.
  const helper = { at: { x: 52, z: 62 } };
  assert.equal(W.mayNet(helper, 42, { atNet: true, landBy: 'net', agent: { id: 42 } }, { x: 52, z: 62 }), true);
  for (const by of ['beach', 'hand', 'lift']) assert.equal(W.mayNet(helper, 42, { atNet: true, landBy: by, agent: { id: 42 } }, { x: 52, z: 62 }), false, by);
});
