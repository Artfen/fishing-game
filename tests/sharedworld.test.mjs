// One sea for everyone in a session (src/sharedworld.js, with world/sealife.js and
// world/ecosystem.js): the host's whales, dolphins, seals, turtles, birds, shoals and bait balls
// going across, and a guest's sea following them: the same whale surfacing and blowing for both,
// a pod riding a guest's bow on the guest's screen, the same frenzy on the same bait ball, a late
// joiner and a reconnect seeing what's there now with nothing doubled, a friend at Las Brasas
// having their own sea alive, and junk turned away. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { buildSeaLife } = await import('../src/world/sealife.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { SharedWorld, cleanShared, countsOf, SHARE_V } = await import('../src/sharedworld.js');
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
const lifeCtx = (from, viewers, extra = {}) => ({ from, boat: null, boatSpeed: 0, daylight: 1, hour: 11, region: 'home', eco: null, diving: false, viewers, ...extra });
// A boat as the sea needs one (the sea only reads where it is, which way it faces, and its length).
const proxyBoat = (x, z, heading) => ({ pos: { x, z }, heading, fwd: { x: Math.sin(heading), z: Math.cos(heading) }, right: { x: -Math.cos(heading), z: Math.sin(heading) }, hull: { L: 6 } });
const moveBoat = (b, v, dt) => {
  b.pos.x += b.fwd.x * v * dt;
  b.pos.z += b.fwd.z * v * dt;
};
// Over the wire: a snapshot goes through JSON, as it would through the connection.
const wire = (snap) => JSON.parse(JSON.stringify(snap));

test('every screen builds the same sea: the same pods, whales, seals, turtles and shoals, in the same places', () => {
  const a = buildSeaLife(new THREE.Scene()), b = buildSeaLife(new THREE.Scene());
  assert.deepEqual(a.pods.map((p) => [p.x, p.z, p.heading, p.members.map((m) => m.slot)]), b.pods.map((p) => [p.x, p.z, p.heading, p.members.map((m) => m.slot)]));
  assert.deepEqual(a.whales.map((w) => [w.x, w.z, w.t]), b.whales.map((w) => [w.x, w.z, w.t]));
  assert.deepEqual(a.visitors.map((s) => [s.a, s.r]), b.visitors.map((s) => [s.a, s.r]));
  assert.deepEqual(a.turtles.map((s) => [s.x, s.z]), b.turtles.map((s) => [s.x, s.z]));
  const e1 = freshEco(), e2 = freshEco();
  assert.equal(e1.schools.length, e2.schools.length);
  assert.deepEqual(e1.schools.slice(0, 40).map((s) => [s.x, s.z, s.members.length]), e2.schools.slice(0, 40).map((s) => [s.x, s.z, s.members.length]));
});

test('what comes over the wire is checked: a real snapshot passes, junk and another version’s sea do not', () => {
  const life = buildSeaLife(new THREE.Scene()), eco = freshEco();
  const counts = countsOf(life, eco);
  const snap = wire({ v: SHARE_V, ep: 'abc123', sq: 1, t: 12.5, s: life.capture(), k: eco.captureSchools([{ x: 60, z: 120 }]) });
  assert.ok(snap.k.length > 0, 'shoals near you go across');
  assert.ok(cleanShared(snap, counts));
  const bad = (f) => {
    const d = wire(snap);
    f(d);
    return cleanShared(d, counts);
  };
  assert.equal(bad((d) => { d.v = 99; }), null, 'another version');
  assert.equal(bad((d) => { d.s.p.pop(); }), null, 'a pod missing');
  assert.equal(bad((d) => { d.s.w[0][0] = 'x'; }), null, 'not a number');
  assert.equal(bad((d) => { d.s.w[0][0] = 1e9; }), null, 'out of the world');
  assert.equal(bad((d) => { d.k.push([999999, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]); }), null, 'a shoal that isn’t one');
  assert.equal(bad((d) => { d.k[0] = d.k[0].slice(0, 9); }), null, 'a shoal cut short');
  assert.equal(bad((d) => { d.s.p[0][6] = '<script>'; }), null, 'markup for an owner');
  assert.equal(bad((d) => { d.ep = ''; }), null, 'no epoch');
  assert.equal(cleanShared(null, counts), null);
});

// A host and a guest, each with their own sea, the guest's following the host's through the wire
// (every half second, a fifth of a second late).
function pair({ lag = 0.2 } = {}) {
  const host = buildSeaLife(new THREE.Scene()), guest = buildSeaLife(new THREE.Scene());
  guest.follower = true;
  const queue = [];
  let t = 0, acc = 0;
  const step = (secs, viewers, extra = {}) => {
    for (let i = 0; i < secs * 30; i++) {
      t += 1 / 30;
      acc += 1 / 30;
      host.update(1 / 30, t, lifeCtx(viewers[0].from, viewers, extra));
      if (acc >= 0.5) {
        acc = 0;
        queue.push({ at: t + lag, snap: wire(host.capture()) });
      }
      while (queue.length && queue[0].at <= t) guest.apply(queue.shift().snap, lag);
      guest.update(1 / 30, t, lifeCtx(viewers[1]?.from ?? viewers[0].from, viewers, extra));
    }
  };
  return { host, guest, step };
}

test('a whale surfaces, blows and dives for both of you, at the same place and the same moment', () => {
  const { host, guest, step } = pair();
  const W = host.whales.find((w) => w.sea === 'home'), w2 = guest.whales[host.whales.indexOf(W)];
  // Both on the same shore, looking out where it is.
  const viewers = [{ id: 'A', from: { x: W.x - 300, z: W.z }, boat: null, boatSpeed: 0, region: 'home' }, { id: 'B', from: { x: W.x - 290, z: W.z + 5 }, boat: null, boatSpeed: 0, region: 'home' }];
  const blows = { A: [], B: [] };
  let t = 0;
  host.onBlow = (x, z, size, kind) => { if (kind === W.kind) blows.A.push({ x, z, t }); };
  guest.onBlow = (x, z, size, kind) => { if (kind === W.kind) blows.B.push({ x, z, t }); };
  W.state = 'down';
  W.t = 3; // (up to breathe in a moment)
  for (let k = 0; k < 120; k++) {
    step(1, viewers);
    t += 1;
  }
  assert.ok(blows.A.length >= 2, `the host saw ${blows.A.length} blows`);
  assert.equal(blows.B.length, blows.A.length, 'the guest saw the same breaths');
  for (let i = 0; i < blows.A.length; i++) {
    const a = blows.A[i], b = blows.B[i];
    assert.ok(Math.hypot(a.x - b.x, a.z - b.z) < 12, `breath ${i}: ${Math.hypot(a.x - b.x, a.z - b.z).toFixed(1)} m apart`);
    assert.ok(Math.abs(a.t - b.t) <= 1, `breath ${i}: within a second`);
  }
  assert.ok(Math.hypot(W.x - w2.x, W.z - w2.z) < 10, 'and it’s where the host has it now');
  assert.equal(w2.state, W.state);
});

test('dolphins come to ride the guest’s bow, and on the guest’s screen they’re on it', () => {
  const { host, guest, step } = pair();
  const pod = host.pods.find((p) => p.kind === 'bottlenose' && p.sea === 'home'), gpod = guest.pods[pod.id];
  // The host ashore far off; the guest's boat coming past the pod at a good clip. Each screen has
  // its own view of the guest's boat (the guest's own, and the host's drawing of it): the same here.
  const heading = Math.atan2(70, -10);
  const guestBoat = proxyBoat(pod.x - 70, pod.z + 10, heading);
  const viewers = () => [{ id: 'A', from: { x: pod.x + 900, z: pod.z }, boat: null, boatSpeed: 0, region: 'home' }, { id: 'B', from: guestBoat.pos, boat: guestBoat, boatSpeed: 6, region: 'home' }];
  for (let k = 0; k < 14 * 30; k++) {
    moveBoat(guestBoat, 6, 1 / 30);
    step(1 / 30, viewers());
  }
  assert.equal(pod.mode, 'bow');
  assert.equal(pod.owner, 'B', 'on the guest’s bow');
  assert.equal(gpod.mode, 'bow');
  const bow = { x: guestBoat.pos.x + guestBoat.fwd.x * 3, z: guestBoat.pos.z + guestBoat.fwd.z * 3 };
  const riding = gpod.members.filter((m) => Math.hypot(m.x - bow.x, m.z - bow.z) < 7).length;
  assert.ok(riding >= gpod.n - 1, `${riding} of ${gpod.n} on the guest’s bow, on the guest’s screen`);
});

test('a seal follows the guest’s slow boat, astern of it on the guest’s screen', () => {
  const { host, guest, step } = pair();
  const S = host.visitors[0], H = S.H;
  const heading = 0.4, b = proxyBoat(H.x + 60, H.z + 60, heading);
  const viewers = () => [{ id: 'A', from: { x: H.x + 1500, z: H.z }, boat: null, boatSpeed: 0, region: 'home' }, { id: 'B', from: b.pos, boat: b, boatSpeed: 2, region: 'home' }];
  // (Taking to following is now and then: make it now.)
  S.mode = 'follow';
  S.owner = 'B';
  S.left = 120;
  S.down = false;
  S.t = 10;
  for (let k = 0; k < 20 * 30; k++) {
    moveBoat(b, 2, 1 / 30);
    step(1 / 30, viewers());
  }
  const g = guest.visitors[0];
  assert.equal(g.mode, 'follow');
  assert.equal(g.owner, 'B');
  const astern = (g.x - b.pos.x) * b.fwd.x + (g.z - b.pos.z) * b.fwd.z;
  assert.ok(astern < -5 && astern > -20, `astern of the guest’s boat (${astern.toFixed(1)} m)`);
});

test('the same bait ball, the same hunters crashing through it, the sea boiling in the same place', () => {
  const host = freshEco(), guest = freshEco();
  guest.follower = true;
  // A tuna shoal on a sprat shoal, close by and mid-frenzy.
  const hunter = host.schools.find((s) => s.L.hunter && s.sp.id === 'tuna');
  const preyIds = [].concat(hunter.L.hunter);
  const prey = host.schools.find((s) => preyIds.includes(s.sp.id));
  Object.assign(hunter, { x: prey.x + 8, z: prey.z, y: -1, prey, frenzy: 60, rest: 0, huntT: 99 });
  hunter.activityOverride = 1;
  const focus = { x: prey.x, z: prey.z };
  const boils = [];
  const run = (secs) => {
    for (let i = 0; i < secs * 30; i++) {
      host.update(1 / 30, ecoCtx(focus, [focus]));
      // (A tuna shoal hunts when it's feeding: keep it at it for the test.)
      host.activity[hunter.sp.id] = 1;
      if (i % 15 === 0) guest.applySchools(wire(host.captureSchools([focus])), 0.1);
      guest.update(1 / 30, ecoCtx(focus));
      for (const c of guest.takeClues()) if (c.type === 'boil') boils.push(c);
    }
  };
  run(8);
  const gh = guest.schools[hunter.id], gp = guest.schools[prey.id];
  assert.equal(gh.prey, gp, 'the guest’s hunters are on the same bait ball');
  assert.ok(gh.frenzy > 0, 'in the same frenzy');
  assert.ok(Math.hypot(gh.x - hunter.x, gh.z - hunter.z) < 6, `hunters ${Math.hypot(gh.x - hunter.x, gh.z - hunter.z).toFixed(1)} m from the host’s`);
  assert.ok(Math.hypot(gp.x - prey.x, gp.z - prey.z) < 6, `bait ball ${Math.hypot(gp.x - prey.x, gp.z - prey.z).toFixed(1)} m from the host’s`);
  assert.ok(boils.length > 0, 'the guest sees the sea boil');
  assert.ok(boils.every((c) => Math.hypot(c.x - prey.x, c.z - prey.z) < 30), 'where the bait ball is');
});

test('joining late, or getting a dropped connection back, shows what’s there now, and nothing twice', () => {
  const host = buildSeaLife(new THREE.Scene());
  const viewers = [{ id: 'A', from: { x: 0, z: 600 }, boat: null, boatSpeed: 0, region: 'home' }];
  for (let i = 0; i < 30 * 120; i++) host.update(1 / 30, i / 30, lifeCtx(viewers[0].from, viewers));
  const late = buildSeaLife(new THREE.Scene());
  late.follower = true;
  const n = (L) => [L.pods.length, L.whales.length, L.visitors.length, L.turtles.length, L.pods.reduce((m, p) => m + p.members.length, 0)];
  const counts = n(late);
  late.apply(wire(host.capture()), 0);
  late.update(1 / 30, 120, lifeCtx(viewers[0].from, viewers));
  for (let i = 0; i < host.whales.length; i++) assert.ok(Math.hypot(host.whales[i].x - late.whales[i].x, host.whales[i].z - late.whales[i].z) < 2, `whale ${i} where the host has it`);
  for (let i = 0; i < host.pods.length; i++) assert.ok(Math.hypot(host.pods[i].x - late.pods[i].x, host.pods[i].z - late.pods[i].z) < 2, `pod ${i} where the host has it`);
  // Dropped and back: the same again, nothing added.
  for (let k = 0; k < 3; k++) late.apply(wire(host.capture()), 0);
  assert.deepEqual(n(late), counts, 'still one of each');
});

test('a friend at Las Brasas has their own sea alive: the island’s turtles and birds go on round them', () => {
  const host = buildSeaLife(new THREE.Scene());
  const T0 = host.turtles.map((T) => [T.x, T.z]);
  // The host at home; a friend in the lee at Las Brasas.
  const viewers = [{ id: 'A', from: { x: 0, z: 600 }, boat: null, boatSpeed: 0, region: 'home' }, { id: 'B', from: { x: 200, z: 6500 }, boat: null, boatSpeed: 0, region: 'south' }];
  for (let i = 0; i < 30 * 60; i++) host.update(1 / 30, i / 30, lifeCtx(viewers[0].from, viewers, { region: 'home' }));
  const moved = host.turtles.filter((T, i) => Math.hypot(T.x - T0[i][0], T.z - T0[i][1]) > 5).length;
  assert.ok(moved >= 2, `${moved} turtles going about their day round the friend`);
  // Alone at home, the island's turtles wait.
  const alone = buildSeaLife(new THREE.Scene()), A0 = alone.turtles.map((T) => [T.x, T.z]);
  for (let i = 0; i < 30 * 60; i++) alone.update(1 / 30, i / 30, lifeCtx({ x: 0, z: 600 }, null));
  assert.ok(alone.turtles.every((T, i) => Math.hypot(T.x - A0[i][0], T.z - A0[i][1]) < 0.01));
});

/* ---------- through a session (a stand-in for Supabase Realtime) ---------- */

const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
async function until(fn, ms = 3000) {
  const end = Date.now() + ms;
  while (!fn()) {
    if (Date.now() > end) throw new Error('timed out waiting');
    await wait(5);
  }
}

test('through a session: the host’s sea reaches the guest, an old word is dropped, and a crossing’s whale asked for comes up', async () => {
  const hub = new Hub();
  const clock = { t: 100 };
  const mk = (name, extra = {}) => new Together({ config: () => CFG, name: () => name, kinds: ['row', 'skiff'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...extra });
  const A = mk('Mags', { newCode: () => '7070' }), B = mk('Bert');
  const lifeA = buildSeaLife(new THREE.Scene()), lifeB = buildSeaLife(new THREE.Scene());
  const ecoA = freshEco(), ecoB = freshEco();
  const SA = new SharedWorld({ together: A, sealife: lifeA, eco: ecoA }), SB = new SharedWorld({ together: B, sealife: lifeB, eco: ecoB });
  await A.host();
  await B.join('7070');
  await until(() => A.others.length === 1 && B.others.length === 1);
  assert.ok(A.epoch, 'the host’s sea has an epoch');
  const vA = [{ id: A.id, from: { x: 0, z: 600 }, boat: null, boatSpeed: 0, region: 'home' }, { id: B.id, from: { x: 10, z: 600 }, boat: null, boatSpeed: 0, region: 'home' }];
  let t = 0;
  const frame = (secs) => {
    for (let i = 0; i < secs * 30; i++) {
      t += 1 / 30;
      clock.t += 1 / 30;
      A.update(1 / 30, { m: 'foot', x: 0, z: 600, h: 0, a: 'stand' });
      B.update(1 / 30, { m: 'foot', x: 10, z: 600, h: 0, a: 'stand' });
      SA.update(1 / 30, vA);
      SB.update(1 / 30, vA);
      lifeA.update(1 / 30, t, lifeCtx(vA[0].from, vA));
      lifeB.update(1 / 30, t, lifeCtx(vA[1].from, vA));
    }
  };
  assert.equal(SA.roleNow(), 'host');
  assert.equal(SB.roleNow(), 'follower');
  for (let k = 0; k < 6; k++) {
    frame(0.5);
    await wait(10);
  }
  await until(() => SB.stats.got >= 3);
  assert.equal(lifeB.follower, true);
  assert.equal(lifeA.follower, false);
  for (let i = 0; i < lifeA.whales.length; i++) assert.ok(Math.hypot(lifeA.whales[i].x - lifeB.whales[i].x, lifeA.whales[i].z - lifeB.whales[i].z) < 10, `whale ${i}`);
  assert.ok(SA.stats.sent >= 3 && SB.stats.delay >= 0 && SB.stats.delay < 3);
  // An old word (a repeated sequence number) is dropped; a junk one is turned away.
  const stale = SB.stats.stale, rejected = SB.stats.rejected;
  const old = SA.snapshot(vA);
  old.sq = 1;
  SB.receive(wire(old), B.peers.get(A.id));
  assert.equal(SB.stats.stale, stale + 1);
  SB.receive({ v: 1, ep: 'x', sq: 9999, t: 0, s: {}, k: [] }, B.peers.get(A.id));
  assert.equal(SB.stats.rejected, rejected + 1);
  // The guest meets a fin whale on the crossing: asked of the host, it comes up in the host's sea
  // (and so everyone's).
  const fin = lifeA.whales.find((w) => w.sea === 'crossing' && w.kind === 'finwhale');
  SB.summon('finwhale', 20, 900, 1.2);
  await until(() => Math.hypot(fin.x - 20, fin.z - 900) < 30);
  // Leaving: the guest's sea decides for itself again.
  B.leave();
  frame(0.1);
  assert.equal(SB.roleNow(), 'off');
  assert.equal(lifeB.follower, false);
  A.leave();
  await until(() => hub.sockets.size === 0);
});
