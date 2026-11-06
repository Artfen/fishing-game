// The fish everyone in a session is fishing for (src/sharedworld.js with world/ecosystem.js): a
// guest's rig in the host's water, one fish to a rig and one rig to a fish however many are cast at
// a shoal, a strike checked by the host, a friend's fight seen by everyone, a fish caught gone for
// everyone, a newcomer the same fish everywhere, a guest leaving mid-fight, and junk turned away.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { buildSeaLife } = await import('../src/world/sealife.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { SharedWorld, cleanShared, cleanRig, cleanFishEvent, countsOf, rigOf, SHARE_V } = await import('../src/sharedworld.js');
const { Together } = await import('../src/together.js');
const { Hub } = await import('./fakeRealtime.mjs');
const { conditions } = await import('../src/world/conditions.js');

conditions.manual = { speed: 0, from: 0 };
conditions.wind.speed = conditions.wind.target = 0;
const habitat = createHabitat();
const freshEco = () => {
  const e = new Ecosystem(habitat);
  e.populate();
  return e;
};
const env = { hour: 11, daylight: 1, night: 0, abs: 24 * 60, tide: { flow: 0.5 }, rain: 0, cloud: 0.2 };
const ecoCtx = (focus, foci = null) => ({ env, focus, foci, boat: { x: focus.x, z: focus.z, speed: 0 }, walker: null, lantern: null, lights: [] });
const wire = (v) => JSON.parse(JSON.stringify(v));
const BAIT_STATES = new Set(['approach', 'investigate', 'nibble', 'bite', 'follow', 'lunge', 'inspect', 'sip']);

// A rig in the water at (x, z), as fishing.js would have it (a float with bait, sitting still).
function castAt(bait, x, z, angler = { x: x + 12, z }) {
  Object.assign(bait, {
    active: true, kind: 'float', item: 'worm', size: 1, fly: null, thick: 0.3, fresh: 4, owner: null, held: false, twitch: 0,
    speed: 0, motion: 'still', pause: false, drag: false, fouled: false, feeder: false, surface: false, sinking: false, darted: 0,
    natural: true, boost: 1, x, y: -0.6, z, vx: 0, vz: 0, anglerX: angler.x, anglerZ: angler.z, towed: false, nearBottom: false,
  });
}

// A free fish of the sea, out on its own (not in a shoal), somewhere with water under it.
function loneFish(eco, not = new Set()) {
  return eco.agents.find((a) => a.active && !a.school && a.state !== 'gone' && !not.has(a.id) && a.sp.water !== 'fresh' && habitat.depth(a.x, a.z) > 2);
}

test('two rigs cast at the same shoal: every fish goes for one rig, no rig has two fish, and the guest’s fish are told to the guest', () => {
  const eco = freshEco();
  const school = eco.schools.find((s) => s.members.length >= 8 && habitat.depth(s.x, s.z) > 3);
  assert.ok(school, 'a shoal to fish');
  const told = [];
  eco.onRemote = (evt, a, b) => told.push([evt, a.id, b.ownerId]);
  eco.listener = {};
  castAt(eco.bait, school.x, school.z);
  eco.setRemoteBait('guest1', wire(rigOf({ ...eco.bait, x: school.x + 1.5, z: school.z + 1 })));
  eco.setRemoteBait('guest2', wire(rigOf({ ...eco.bait, x: school.x - 1, z: school.z - 1.5 })));
  const baits = eco.baitsList();
  assert.equal(baits.length, 3);
  let engagedSeen = 0;
  for (let i = 0; i < 30 * 40; i++) {
    eco.update(1 / 30, ecoCtx({ x: school.x, z: school.z }, [{ x: school.x, z: school.z }]));
    for (const id of ['guest1', 'guest2']) {
      const b = eco.remoteBaits.get(id);
      if (b) b.heard = eco.netT; // (still being sent)
    }
    // One fish to a rig, one rig to a fish.
    const owners = new Map();
    for (const a of eco.agents) {
      if (!BAIT_STATES.has(a.state)) continue;
      engagedSeen++;
      assert.ok(a.bait, `fish ${a.id} going for a rig knows whose`);
      assert.equal(a.bait.owner, a, `fish ${a.id} is its rig's only fish`);
      assert.ok(!owners.has(a.bait), 'no rig with two fish');
      owners.set(a.bait, a);
    }
  }
  assert.ok(engagedSeen > 0, 'the fish took an interest');
  assert.ok(told.length > 0, 'what the fish did about the guests’ rigs went to the guests');
  assert.ok(told.every(([, , who]) => who === 'guest1' || who === 'guest2'));
});

test('what comes over the wire about fish is checked: rigs, fish words and the fish in a snapshot', () => {
  const eco = freshEco(), life = buildSeaLife(new THREE.Scene()), counts = countsOf(life, eco);
  const bait = {};
  castAt(bait, 40, 700);
  const r = wire(rigOf(bait));
  assert.ok(cleanRig(r, ['worm', 'spinner']));
  assert.equal(cleanRig({ ...r, item: 'gold' }, ['worm']), null, 'tackle that isn’t in the game');
  assert.equal(cleanRig({ ...r, kind: 'dynamite' }), null);
  assert.equal(cleanRig({ ...r, x: 'x' }), null);
  assert.equal(cleanRig({ ...r, x: 1e9 }), null);
  assert.equal(cleanRig({ ...r, motion: '<b>' }), null);
  assert.equal(cleanRig(null), null);
  assert.equal(cleanRig({ ...r, boost: 9, fresh: 99 }).boost, 1.5, 'no rig more tempting than one of the host’s own');
  assert.equal(cleanRig({ ...r, boost: 9, fresh: 99 }).fresh, 4);
  // A fish word to a guest.
  assert.ok(cleanFishEvent({ to: 'abc', e: 'bite', f: 3, k: 'strike' }, counts));
  assert.equal(cleanFishEvent({ to: 'abc', e: 'explode', f: 3 }, counts), null);
  assert.equal(cleanFishEvent({ to: 'abc', e: 'bite', f: counts.agents + 5 }, counts), null);
  assert.equal(cleanFishEvent({ to: '<x>', e: 'bite', f: 3 }, counts), null);
  assert.equal(cleanFishEvent({ to: 'abc', e: 'leave', f: 3, w: '<script>bad</script>' }, counts).w.includes('<'), false);
  // The fish in a snapshot.
  const a0 = loneFish(eco);
  castAt(eco.bait, a0.x, a0.z);
  eco.engage(a0);
  const snap = wire({ v: SHARE_V, ep: 'abc', sq: 1, t: 1, s: life.capture(), k: [], a: eco.captureAgents([{ x: a0.x, z: a0.z }]) });
  assert.equal(snap.a.rows.length, 1, 'a fish going for a rig goes across');
  assert.ok(cleanShared(snap, counts));
  const bad = (f) => {
    const d = wire(snap);
    f(d);
    return cleanShared(d, counts);
  };
  assert.equal(bad((d) => { d.a.rows[0][0] = 99999; }), null, 'a fish that isn’t one');
  assert.equal(bad((d) => { d.a.rows[0][5] = 77; }), null, 'a state there isn’t');
  assert.equal(bad((d) => { d.a.rows[0][6] = '<img>'; }), null, 'markup for an owner');
  assert.equal(bad((d) => { d.a.gone.push('x'); }), null);
  assert.equal(bad((d) => { d.a.sizes.push([1, -4, 1]); }), null);
  assert.equal(bad((d) => { d.a = 'fish'; }), null);
});

/* ---------- through a session (a stand-in for Supabase Realtime) ---------- */

const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 4000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

// A host and two guests, each with their own sea, all fishing near one spot.
async function session() {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const T = [mk('Mags', { newCode: () => '7171' }), mk('Bert'), mk('Cass')];
  const eco = T.map(() => freshEco());
  const S = T.map((t, i) => new SharedWorld({ together: t, sealife: buildSeaLife(new THREE.Scene()), eco: eco[i] }));
  await T[0].host();
  await T[1].join('7171');
  await T[2].join('7171');
  await until(() => T.every((t) => t.others.length === 2));
  const spot = (() => {
    const a = loneFish(eco[0]);
    return { x: a.x, z: a.z };
  })();
  const at = [{ x: spot.x - 10, z: spot.z }, { x: spot.x + 10, z: spot.z }, { x: spot.x, z: spot.z + 12 }];
  const poses = at.map((p) => ({ m: 'foot', x: p.x, z: p.z, h: 0, a: 'fish' }));
  const viewers = () => T.map((t, i) => ({ id: t.id, from: at[i], boat: null, boatSpeed: 0, region: 'home' }));
  const frames = async (secs) => {
    for (let i = 0; i < secs * 30; i++) {
      clock.t += 1 / 30;
      T.forEach((t, k) => t.update(1 / 30, poses[k]));
      S.forEach((s) => s.update(1 / 30, viewers()));
      eco.forEach((e, k) => e.update(1 / 30, ecoCtx(at[k], k === 0 ? at : null)));
      if (i % 10 === 0) await wait(2);
    }
    await wait(20);
  };
  const end = async () => {
    T.forEach((t) => t.leave());
    await until(() => hub.sockets.size === 0);
  };
  return { T, eco, S, spot, at, poses, frames, end, clock };
}

test('a guest’s fish: their rig in the host’s water, the take told to them, the strike checked, the fight seen by everyone, the catch gone for everyone', async () => {
  const { T, eco, S, spot, at, poses, frames, end } = await session();
  const [H, B, C] = eco;
  for (const e of eco) e.listener = {};
  // Bert casts. His rig turns up in the host's water.
  castAt(B.bait, spot.x + 1, spot.z, at[1]);
  await frames(1);
  const rig = H.remoteBaits.get(T[1].id);
  assert.ok(rig?.active, 'the guest’s rig is in the host’s water');
  assert.ok(Math.hypot(rig.x - (spot.x + 1), rig.z - spot.z) < 0.5, 'where the guest has it');
  // A fish in the host's water takes it: the host tells Bert, and on Bert's screen that fish takes his rig.
  const fish = H.agents.find((a) => a.active && !a.school && a.state !== 'gone' && Math.hypot(a.x - spot.x, a.z - spot.z) < 60) || loneFish(H);
  H.engage(fish, rig);
  H.startBite(fish, 'float');
  await until(() => B.agents[fish.id].state === 'bite');
  assert.equal(B.bait.owner, B.agents[fish.id], 'on Bert’s screen it’s his rig it has');
  assert.equal(C.agents[fish.id].state === 'bite' && C.bait.owner === C.agents[fish.id], false, 'not Cass’s');
  // Bert strikes. The host checks it was taking his rig and makes it his.
  B.hook(B.agents[fish.id]);
  await until(() => fish.state === 'hooked' && fish.hookedBy === T[1].id);
  // Bert's fight: his pose says which fish is on, and everyone's water agrees it's his.
  poses[1] = { ...poses[1], o: true, ex: spot.x + 3, ez: spot.z + 1, tn: 0.5, mv: 'run', hk: fish.id };
  await frames(1.5);
  assert.equal(C.agents[fish.id].state, 'hooked', 'Cass sees it hooked');
  assert.equal(C.agents[fish.id].remoteHook, T[1].id, 'by Bert');
  assert.equal(T[2].peers.get(T[1].id).pose.hk, fish.id, 'Bert’s pose says which fish');
  // Nobody else's rig can have it meanwhile.
  castAt(H.bait, fish.x, fish.z, at[0]);
  for (let i = 0; i < 60; i++) H.update(1 / 30, ecoCtx(at[0], at));
  assert.notEqual(H.bait.owner, fish, 'the host’s rig can’t have Bert’s fish');
  H.bait.active = false;
  // Cass claims it too (she never had a bite): turned down.
  let refused = null;
  S[2].onNoHook = (id) => { refused = id; };
  T[2].ask('hook', { f: fish.id }, 0);
  await until(() => refused === fish.id);
  assert.equal(fish.hookedBy, T[1].id, 'still Bert’s');
  // Cass says it got away: not hers to say.
  T[2].ask('lost', { f: fish.id }, 0);
  await frames(0.3);
  assert.equal(fish.state, 'hooked');
  // Bert lands it and keeps it: gone from the water, for everyone.
  poses[1] = { ...poses[1], o: false, hk: undefined };
  B.catchAgent(B.agents[fish.id]);
  B.keep(B.agents[fish.id]);
  B.bait.active = false;
  await frames(1.5);
  assert.equal(fish.state, 'gone', 'gone from the host’s water');
  assert.equal(C.agents[fish.id].state, 'gone', 'and Cass’s');
  assert.equal(B.agents[fish.id].state, 'gone', 'and Bert’s');
  assert.equal(H.remoteBaits.has(T[1].id), false, 'Bert’s rig out of the water');
  // In its place, a newcomer: the same fish on every screen.
  H.restock(fish);
  await frames(1.5);
  for (const e of [B, C]) {
    const f = e.agents[fish.id];
    assert.notEqual(f.state, 'gone', 'the newcomer’s there');
    assert.equal(f.size, fish.size, 'the same size');
    assert.equal(f.gen, fish.gen, 'the same build');
  }
  await end();
});

test('two guests strike the same fish at once: one gets it; a guest who leaves mid-fight lets it go', async () => {
  const { T, eco, frames, spot, at, poses, end } = await session();
  const [H, B, C] = eco;
  for (const e of eco) e.listener = {};
  castAt(B.bait, spot.x + 1, spot.z, at[1]);
  castAt(C.bait, spot.x - 1, spot.z, at[2]);
  await frames(1);
  const rigB = H.remoteBaits.get(T[1].id), rigC = H.remoteBaits.get(T[2].id);
  assert.ok(rigB && rigC, 'both rigs in the host’s water');
  // A fish takes Bert's. Both claim it in the same moment.
  const fish = loneFish(H);
  H.engage(fish, rigB);
  H.startBite(fish, 'float');
  await until(() => B.agents[fish.id].state === 'bite');
  const SC = { got: null };
  const was = T[2].onFish;
  T[2].onFish = (d, p) => {
    if (d.to === T[2].id && d.e === 'nohook') SC.got = d.f;
    was(d, p);
  };
  T[1].ask('hook', { f: fish.id }, 0);
  T[2].ask('hook', { f: fish.id }, 0);
  await until(() => SC.got === fish.id && fish.state === 'hooked');
  assert.equal(fish.hookedBy, T[1].id, 'Bert’s, whose rig it took');
  // Bert's fight goes on... and then Bert's gone (closed the game).
  poses[1] = { ...poses[1], o: true, ex: spot.x + 2, ez: spot.z, mv: 'run', hk: fish.id };
  await frames(0.5);
  T[1].leave();
  // (His rig stops arriving; a few seconds on, the host takes it he's gone.)
  await frames(4);
  assert.notEqual(fish.state, 'hooked', 'the fish is off');
  assert.equal(fish.hookedBy, null);
  assert.equal(H.remoteBaits.has(T[1].id), false);
  await end();
});
