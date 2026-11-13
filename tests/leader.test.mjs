// The leader (E3d, see landing.js): the big game from a boat, beaten, comes to the leader and waits
// for someone to take it: you (hold, and let go as it surges: held through a surge, the hook can
// tear out on Natural and Demanding), or a friend aboard, who draws it alongside and lets it run
// as it surges; your game thanks them once it's there, and it's in your catch log. Anything else
// too big for the net is still drawn alongside by itself. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { fishById, weightOf } = await import('../src/fish.js');
const { RODS, TACKLE, lineInUse } = await import('../src/tackle.js');
const { BEHAVIOUR } = await import('../src/behaviour.js');
const { Fishing } = await import('../src/fishing.js');
const { Boat } = await import('../src/boat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { breakReason } = await import('../src/fight.js');
const { LAND_WAYS, leaderRisk, LEADER_OFF } = await import('../src/landing.js');
const { cleanPose, HELPS } = await import('../src/together.js');
const { Teamwork, NET_REACH } = await import('../src/teamwork.js');
const { sanitizeLogEntry } = await import('../src/save.js');

const scene = new THREE.Scene();
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });

// A big fish (a blue shark of `size` cm by default) on the big-game rod from a boat, nearly beaten,
// at the Fish behaviour `levelId`.
function hooked({ levelId = 'natural', sp = 'blueshark', size = 210, kind = 'console', rod = 'biggame', item = 'ballyhoo' } = {}) {
  const words = [], taught = [], lost = [];
  const hooks = new Proxy({ flash: (t) => words.push(t), key: (a) => a, teach: (k) => taught.push(k), canopyAt: () => false, onSnap: (why) => lost.push(why), line: undefined }, { get: (o, k) => (k in o ? o[k] : () => {}) });
  const b = new Boat(scene, { kind });
  b.place(60, 900, 0);
  const eco = new Ecosystem(habitat);
  const f = new Fishing(scene, b, quiet, quiet, eco, hooks);
  f.setRig({ ...RODS[rod], line: lineInUse({}, RODS[rod]) }, TACKLE[item]);
  f.level = BEHAVIOUR[levelId];
  const a = eco.agents.find((q) => q.sp.id === sp) || eco.agents[0];
  a.sp = fishById[sp];
  a.size = size;
  a.weight = weightOf(a.sp, size);
  f.hook.set(b.pos.x + 14, 0, b.pos.z + 14);
  f.agent = a;
  f.state = 'bite';
  f.setHook();
  const F = f.fight;
  Object.assign(F, { stamina: 0, stage: 'beaten', progress: 0.999, phaseT: 50, pulling: false });
  let t = 0;
  const step = (secs, held = false) => {
    for (let i = 0; i < secs * 30 && f.fight === F && f.state === 'reeling'; i++) {
      t += 1 / 30;
      b.update(1 / 30, t, 0, 0, 0);
      f.update(1 / 30, t, b.heading, held);
    }
  };
  return { f, F, b, step, words, taught, lost };
}
const off = (f, b) => Math.hypot(f.fishPos.x - b.pos.x, f.fishPos.z - b.pos.z);
// Wound in the last bit to the leader, then let go (the draw so far forgotten, no surge yet).
function arrive(h) {
  while (!h.F.atNet && h.f.state === 'reeling') h.step(0.1, true);
  Object.assign(h.F, { landT: 0, kickT: 99 });
}

/* ---------- the rules ---------- */

test('the leader: held, not tapped; a surge held through can tear the hook out, more so the looser it’s worn; never on Relaxed', () => {
  assert.equal(LAND_WAYS.leader.tap, false);
  assert.ok(LAND_WAYS.leader.wind > 2 && LAND_WAYS.leader.word && LAND_WAYS.leader.act);
  assert.equal(leaderRisk(0, 0.2), 0, 'Relaxed');
  assert.equal(leaderRisk(0.5, 1), 0.125, 'Natural, a firm hold');
  assert.equal(leaderRisk(1, 1), 0.25, 'Demanding, a firm hold');
  assert.ok(leaderRisk(1, 0.3) > 0.5, 'Demanding, worn loose');
  assert.ok(leaderRisk(0.5, 0.3) > leaderRisk(0.5, 0.9));
});

/* ---------- in the game ---------- */

test('a blue shark beaten from a boat waits at the leader; held while it lies quiet, it’s drawn alongside and lies there', () => {
  const { f, F, b, step, taught } = hooked();
  // (Wound in the last bit: it comes to the leader, and you let go.)
  while (!F.atNet && f.state === 'reeling') step(0.1, true);
  F.landT = 0;
  F.kickT = 99;
  step(1);
  assert.equal(F.atNet, true, 'waiting');
  assert.equal(F.landBy, 'leader');
  assert.equal(f.state, 'reeling', 'not landed by itself');
  assert.ok(taught.includes('leader'), 'and told how');
  assert.equal(f.net.visible, false, 'no landing net for it');
  assert.ok(Math.abs(off(f, b) - LEADER_OFF) < 1.6, `a few metres off: ${off(f, b).toFixed(1)} m`);
  step(3);
  assert.equal(f.state, 'reeling', 'still waiting, untouched');
  assert.equal(F.landT, 0, 'and nothing drawn in');
  // Taken, and drawn in between its surges (it lies quiet: no surge this time).
  const was = off(f, b);
  step(1.5, true);
  assert.ok(off(f, b) < was - 0.5, `coming in: ${was.toFixed(1)} → ${off(f, b).toFixed(1)} m`);
  step(3, true);
  assert.ok(['landing', 'caught'].includes(f.state), f.state);
  assert.equal(F.leadered, true);
  assert.ok(f.bigCatch(), 'lying alongside');
  // (Tapping says how it's done.)
  const g = hooked();
  arrive(g);
  g.f.onDown();
  g.f.onUp();
  assert.equal(g.F.word, 'hold to take the leader');
});

test('a surge takes back some of the leader; let go and it stays on, held through on Demanding with a worn hook it tears out', () => {
  const N = hooked({ levelId: 'demanding' });
  arrive(N);
  N.step(2, true);
  const drawn = N.F.landT;
  assert.ok(drawn > 1.5, `drawn in ${drawn.toFixed(2)} s worth`);
  // A surge, let go: some of the leader back, the fish still on.
  Object.assign(N.F, { kickT: 0.05 });
  N.step(0.3, false);
  assert.equal(N.lost.length, 0);
  assert.ok(N.F.landT < drawn - 0.9, `slipped back to ${N.F.landT.toFixed(2)}`);
  assert.match(N.F.word, /surges/);
  // Held through a surge with the hook worn loose: on Demanding that's nearly always the end.
  const rnd = Math.random;
  Math.random = () => 0.3;
  try {
    const D = hooked({ levelId: 'demanding' });
    arrive(D);
    Object.assign(D.F, { grip: 0.3, kickT: 0.05 });
    D.step(0.3, true);
    assert.deepEqual(D.lost, ['kicked']);
    assert.equal(D.f.fight, null);
    // With a firm hook, the same moment's luck holds it.
    const E = hooked({ levelId: 'demanding' });
    arrive(E);
    Object.assign(E.F, { grip: 1, kickT: 0.05 });
    E.step(0.3, true);
    assert.equal(E.lost.length, 0, 'a firm hook rode that one out');
  } finally {
    Math.random = rnd;
  }
  // The word for it.
  assert.match(breakReason('kicked', fishById.blueshark, RODS.biggame, { landBy: 'leader' }), /surged as you held the leader.*Let go of the leader as it stirs/);
});

test('on Relaxed it’s drawn alongside for you after a moment, surges and all', () => {
  const R = hooked({ levelId: 'relaxed' });
  R.step(1.2, true);
  assert.equal(R.F.landBy, 'leader');
  R.F.kickT = 0.1;
  R.step(4, true);
  assert.equal(R.lost.length, 0);
  assert.ok(['landing', 'caught'].includes(R.f.state), R.f.state);
});

test('a friend aboard takes the leader: drawn alongside without you, surges let run even on Demanding; once only, and only at the leader', () => {
  const H = hooked({ levelId: 'demanding' }), { f, F, step, lost } = H;
  assert.equal(f.friendLeader('Tris'), false, 'not before it’s at the leader');
  arrive(H);
  assert.equal(f.friendLeader('Tris'), true);
  assert.equal(F.leaderBy, 'Tris');
  assert.equal(f.friendLeader('Cass'), false, 'Tris has it');
  assert.match(F.word, /Tris takes the leader/);
  // Surges come and go; Tris lets them run; you're not holding.
  const rnd = Math.random;
  Math.random = () => 0;
  try {
    F.kickT = 0.4;
    step(8);
  } finally {
    Math.random = rnd;
  }
  assert.equal(lost.length, 0, 'never lost to a surge in Tris’s hands');
  assert.ok(['landing', 'caught'].includes(f.state), f.state);
  assert.equal(F.leadered, true);
  assert.equal(F.leaderBy, 'Tris');
  // A net-sized bass from the boat isn't on a leader: no one takes it.
  const bass = hooked({ sp: 'seabass', size: 60, rod: 'sea', item: 'metal' });
  bass.step(1.2, true);
  assert.notEqual(bass.F.landBy, 'leader');
  assert.equal(bass.f.friendLeader('Tris'), false);
});

test('a bluefin too big for the net, on the offshore rod’s heavy leader, comes in the same way', () => {
  const T = hooked({ sp: 'tuna', size: 150, rod: 'offshore', item: 'stickbait' });
  arrive(T);
  assert.equal(T.F.landBy, 'leader');
  assert.equal(T.f.state, 'reeling', 'waiting at the leader');
});

test('anything else too big for the net is still drawn alongside by itself', () => {
  const meagre = hooked({ sp: 'meagre', size: 130, rod: 'sea', item: 'metal', kind: 'skiff' });
  meagre.step(1.2, true);
  assert.equal(meagre.F.atNet, undefined);
  assert.ok(['landing', 'caught'].includes(meagre.f.state), meagre.f.state);
});

/* ---------- playing together ---------- */

test('the pose says it’s waiting at the leader; a friend by it is offered the leader, the angler’s game checks it; the catch log says who took it', () => {
  assert.ok(HELPS.includes('leader'));
  assert.equal(cleanPose({ m: 'boat', k: 'console', x: 1, z: 2, h: 0, o: true, nt: 3 }).nt, 3, 'kept');
  assert.equal(cleanPose({ m: 'boat', k: 'console', x: 1, z: 2, h: 0, o: true, nt: 2 }).nt, 2);
  assert.equal(cleanPose({ m: 'boat', k: 'console', x: 1, z: 2, h: 0, o: true, nt: 7 }).nt, 1, 'junk read as the net, as before');
  // A friend's big fish at the leader, by you: offered as the leader, not the net.
  const peer = { id: 'm', name: 'Mags', pose: { o: true, nt: 3, hk: 42, ex: 10, ez: 10 } };
  const sent = [];
  const together = { active: true, peers: new Map([['m', peer]]), help: (to, e, f, extra) => (sent.push({ to, e, f, extra }), true) };
  const W = new Teamwork({ together, eco: null, lineEnd: () => null });
  const target = W.netTarget({ x: 11, z: 11 });
  assert.equal(target.kind, 'leader');
  assert.ok(W.net(target));
  assert.deepEqual([sent[0].e, sent[0].f], ['leader', 42]);
  peer.pose.nt = 1;
  assert.equal(W.netTarget({ x: 11, z: 11 }).kind, 'net');
  assert.equal(W.netTarget({ x: 11 + NET_REACH + 2, z: 11 }), null, 'out of reach');
  // The angler's side: only their fish, waiting at the leader, untaken, the friend by it.
  const bert = { id: 'b', name: 'Bert', at: { x: 11, z: 11 } }, at = { x: 10, z: 10 };
  const fight = { atNet: true, landBy: 'leader', agent: { id: 42 } };
  assert.equal(W.mayLeader(bert, 42, fight, at), true);
  assert.equal(W.mayLeader(bert, 43, fight, at), false, 'another fish');
  assert.equal(W.mayLeader(bert, 42, { ...fight, landBy: 'net' }, at), false, 'one for the net');
  assert.equal(W.mayLeader(bert, 42, { ...fight, leaderBy: 'Cass' }, at), false, 'already taken');
  assert.equal(W.mayLeader({ ...bert, at: { x: 60, z: 60 } }, 42, fight, at), false, 'nowhere near');
  assert.equal(W.mayNet(bert, 42, fight, at), false, 'and not netted');
  // Thanks, saying how they helped.
  W.thank(bert, 42, 'Blue Shark', 61.5, 'leader');
  assert.equal(sent[1].e, 'thanks');
  assert.equal(sent[1].extra.h, 'leader');
  // The catch log.
  const e = sanitizeLogEntry({ sp: 'blueshark', size: 210, day: 3, hour: 11, from: 'boat', boat: 'console', fight: 600, helper: 'Tris', helped: 'leader' });
  assert.deepEqual([e.helper, e.helped], ['Tris', 'leader']);
});

test('the journal says who took the leader', async () => {
  const { Journal } = await import('../src/journal.js');
  const e = sanitizeLogEntry({ sp: 'blueshark', size: 210, day: 3, hour: 11, kind: 'lure', rod: 'biggame', from: 'boat', boat: 'console', fight: 600, helper: 'Tris', helped: 'leader' });
  assert.match(Journal.howText(e), /from the centre-console boat · fought 10 minutes · Tris took the leader$/);
});
