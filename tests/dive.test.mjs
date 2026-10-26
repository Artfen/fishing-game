// Diving: freediving on a breath with a speargun, and scuba with the camera. The breath and the
// air (how long they last, the turn mark, the reserve), what may be speared and how a shot meets
// a fish, the swimmer (never through the seabed, up the beach or out of the water), how fish
// take to a diver (bolting from one who rushes them, coming to look at one who waits), the
// Kittiwake's bell, and that a dive's catches and records survive a save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const V = await import('../src/dive.js');
const { Diver } = await import('../src/diver.js');
const T = await import('../src/world/terrain.js');
const { waveHeight } = await import('../src/world/conditions.js');
const { fishById, FISH } = await import('../src/fish.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const A = await import('../src/adventures.js');
const { KIND_NAMES } = await import('../src/tackle.js');

let loads = 0;
const freshSave = () => import(`../src/save.js?dive=${++loads}`);
const env = { hour: 12, rain: 0, cloud: 0.3, daylight: 1, night: 0, hatch: 0 };

/* ---------------- breath and air ---------------- */

test('a held breath: about 75 s lying still, much less swimming, less again kicking hard', () => {
  const last = (swim, kick) => 1 / V.breathUse(swim, kick);
  assert.ok(Math.abs(last(0, false) - 75) < 0.5);
  assert.ok(last(1, false) > 40 && last(1, false) < 55, `${last(1, false)} s swimming`);
  assert.ok(last(1, true) > 20 && last(1, true) < 32, `${last(1, true)} s kicking hard`);
  // The turn mark: deeper needs more breath to get back up; at the surface, only the margin.
  assert.equal(V.breathToSurface(0), V.BREATH.margin);
  assert.ok(V.breathToSurface(10) > V.breathToSurface(5) && V.breathToSurface(5) > V.breathToSurface(1));
  // From the turn mark at 10 m, swimming steadily up, you arrive with the margin to spare.
  const used = (10 / V.BREATH.ascent) * V.breathUse(1);
  assert.ok(Math.abs(V.breathToSurface(10) - used - V.BREATH.margin) < 1e-9);
  // Breathing up from empty takes about half a minute.
  assert.ok(Math.abs(1 / V.recoverRate() - V.BREATH.recover) < 1e-9);
});

test('a tank of air: deeper drinks more, a full tank lasts about eight minutes at ten metres', () => {
  assert.ok(V.airUse(20, 1) > V.airUse(10, 1) && V.airUse(10, 1) > V.airUse(0, 1));
  assert.ok(Math.abs(V.airUse(10, 0) / V.airUse(0, 0) - 2) < 1e-9, 'twice the air at 10 m (2 bar)');
  assert.ok(V.airUse(10, 1, true) > V.airUse(10, 1));
  const mins = V.minutesLeft(V.SCUBA.full, 10);
  assert.ok(mins > 6.5 && mins < 9.5, `${mins.toFixed(1)} minutes to the reserve at 10 m`);
  assert.equal(V.minutesLeft(V.SCUBA.reserve, 10), 0);
  assert.ok(V.SCUBA.reserve > V.SCUBA.low && V.SCUBA.low > 0);
});

/* ---------------- the speargun ---------------- */

test('what may be speared: never in fresh water, never the eel or bluefin, and small fish are let grow', () => {
  const bass = fishById.seabass, big = bass.size[1] - 5, small = bass.size[0] + 1;
  assert.ok(V.canSpear(bass, big, 'salt').ok);
  assert.ok(V.canSpear(bass, big, 'brackish').ok, 'in the estuary too');
  assert.equal(V.canSpear(bass, big, 'fresh').ok, false);
  assert.equal(V.canSpear(fishById.pike, 90, 'fresh').ok, false);
  const small_ = V.canSpear(bass, small, 'salt');
  assert.equal(small_.ok, false);
  assert.ok(small_.small);
  assert.equal(V.canSpear(fishById.eel, 80, 'salt').ok, false);
  assert.equal(V.canSpear(fishById.tuna, 200, 'salt').ok, false);
  // Most fish you'll meet are big enough: young fish outnumber old, but not overwhelmingly.
  const eco = new Ecosystem(createHabitat());
  const sea = eco.agents.filter((a) => a.sp.water !== 'fresh' && !a.sp.life.observe && a.sp.id !== 'tuna');
  const ok = sea.filter((a) => V.canSpear(a.sp, a.size, 'salt').ok).length / sea.length;
  assert.ok(ok > 0.5 && ok < 0.8, `${Math.round(ok * 100)}% of sea fish are big enough to take`);
});

test('a shot meets the first fish on its line, and where it goes in matters', () => {
  const fish = (x, z, yaw, size = 40) => ({ active: true, state: 'rest', x, y: -5, z, yaw, pitch: 0, size });
  const from = new THREE.Vector3(0, -5, 0), along = new THREE.Vector3(0, 0, 1);
  // Side on, three metres ahead: hit, through the middle.
  const side = fish(0, 3, Math.PI / 2);
  const hit = V.spearHit(from, along, V.SPEAR.range, [side]);
  assert.ok(hit && hit.agent === side);
  assert.ok(Math.abs(hit.dist - 3) < 0.15 && hit.along > 0.3 && hit.along < 0.7);
  assert.equal(V.shotQuality(hit.along), 'good');
  // A hand's width to the side of a small fish: a miss. Out of range: a miss. Behind: a miss.
  assert.equal(V.spearHit(from, along, V.SPEAR.range, [fish(0.25, 3, Math.PI / 2, 20)]), null);
  assert.equal(V.spearHit(from, along, V.SPEAR.range, [fish(0, 7, Math.PI / 2)]), null);
  assert.equal(V.spearHit(from, along, V.SPEAR.range, [fish(0, -3, Math.PI / 2)]), null);
  // Two in line: the nearer one.
  const near = fish(0, 2, Math.PI / 2), far = fish(0, 3.5, Math.PI / 2);
  assert.equal(V.spearHit(from, along, V.SPEAR.range, [far, near]).agent, near);
  // Aim just behind the head (a fish swimming across, head to the right): a clean shot; the tail: poor.
  const crossing = fish(0, 3, Math.PI / 2, 50); // heading +x
  const head = V.spearHit(from, new THREE.Vector3(0.14, 0, 3).normalize(), V.SPEAR.range, [crossing]);
  const tail = V.spearHit(from, new THREE.Vector3(-0.2, 0, 3).normalize(), V.SPEAR.range, [crossing]);
  assert.equal(V.shotQuality(head.along), 'clean');
  assert.equal(V.shotQuality(tail.along), 'poor');
  // A fish already speared, caught or gone isn't there to hit.
  for (const st of ['hooked', 'caught', 'gone']) assert.equal(V.spearHit(from, along, 5, [{ ...side, state: st }]), null);
  // A clean shot always holds; a tail shot often doesn't, the more so on a big, strong fish.
  const pollack = fishById.pollack;
  assert.equal(V.tearChance('clean', pollack, 70), 0);
  assert.ok(V.tearChance('good', pollack, 70) < V.tearChance('poor', pollack, 70));
  assert.ok(V.tearChance('poor', pollack, 75) > V.tearChance('poor', pollack, 35));
});

/* ---------------- the swimmer ---------------- */

test('the diver stays in the water: never above the surface, through the seabed, or up the beach', () => {
  const d = new Diver(new THREE.Scene());
  const at = { x: T.WRECK_BUOY.x - 3, z: T.WRECK_BUOY.z - 3 };
  d.enter('free', at.x, -0.3, at.z, 0);
  const input = { fwd: 1, up: 0, kick: false, dir: new THREE.Vector3(0, -1, 0.3).normalize() };
  let t = 0;
  for (let i = 0; i < 30 * 20; i++) {
    d.update(1 / 30, (t += 1 / 30), input);
    assert.ok(d.pos.y >= T.heightAt(d.pos.x, d.pos.z) + 0.3 - 1e-6, 'above the seabed');
  }
  assert.ok(d.depth > 6, `down at ${d.depth.toFixed(1)} m`);
  input.dir.set(0, 1, 0);
  for (let i = 0; i < 30 * 20; i++) {
    d.update(1 / 30, (t += 1 / 30), input);
    assert.ok(d.pos.y <= waveHeight(d.pos.x, d.pos.z, t) - 0.27, 'never out of the water');
  }
  assert.ok(d.atSurface(t), 'back at the surface');
  // Swimming at the beach of Shell Strand: you stop in the shallows (and can stand up).
  d.enter('free', T.STRAND.x, -0.3, T.STRAND.z + 30, Math.PI);
  input.dir.set(0, 0, -1);
  input.kick = true;
  for (let i = 0; i < 30 * 40; i++) d.update(1 / 30, (t += 1 / 30), input);
  assert.ok(T.heightAt(d.pos.x, d.pos.z) < waveHeight(d.pos.x, d.pos.z, t) - 0.5, 'still in the water');
  assert.ok(d.aground, 'up against the beach');
});

test('deep down a freediver sinks of their own weight; a scuba diver stays where they are', () => {
  const deep = (() => {
    for (let x = -400; x < 400; x += 20) for (let z = 600; z < 1000; z += 20) if (T.heightAt(x, z) < -18) return { x, z };
    return null;
  })();
  assert.ok(deep, 'somewhere 18 m deep');
  const still = { fwd: 0, up: 0, kick: false, dir: new THREE.Vector3(0, 0, 1) };
  const run = (kit) => {
    const d = new Diver(new THREE.Scene());
    d.enter(kit, deep.x, -15, deep.z, 0);
    for (let i = 0; i < 30 * 10; i++) d.update(1 / 30, i / 30, still);
    return -d.pos.y;
  };
  assert.ok(run('free') > 15.2, 'the freediver sinks');
  assert.ok(Math.abs(run('scuba') - 15) < 0.6, 'the scuba diver stays put (bar the current)');
});

/* ---------------- fish and a diver ---------------- */

const diverAt = (x, y, z, v = { x: 0, y: 0, z: 0 }, kicking = false, still = 0) => ({ x, y, z, vx: v.x, vy: v.y, vz: v.z, speed: Math.hypot(v.x, v.y, v.z), kicking, still });
const step = (eco, diver, secs) => {
  for (let i = 0; i < secs * 30; i++) eco.update(1 / 30, { env, focus: { x: diver.x, z: diver.z }, boat: { x: 0, z: 0, speed: 0 }, walker: null, diver, lights: [] });
};

test('fish bolt from a diver kicking straight at them, and let one drifting by come close', () => {
  const eco = new Ecosystem(createHabitat());
  const fish = eco.agents.find((a) => !a.school && a.sp.id === 'pollack');
  const near = (a, d) => {
    a.state = 'rest';
    a.t = 0;
    a.dur = 60;
    a.wary = 0;
    return d;
  };
  // Kicking hard straight at it from three metres: it's off.
  near(fish, 0);
  const dx = 3;
  step(eco, diverAt(fish.x - dx, fish.y, fish.z, { x: 1.6, y: 0, z: 0 }, true), 1);
  assert.equal(fish.state, 'flee');
  // Drifting slowly past, not towards it, a couple of metres off: it stays.
  const other = eco.agents.find((a) => !a.school && a.sp.id === 'wrasse');
  near(other, 0);
  step(eco, diverAt(other.x - 2.2, other.y, other.z, { x: 0, y: 0, z: 0.25 }), 1);
  assert.notEqual(other.state, 'flee');
  // A flatfish lies tight until you're almost on it.
  const flat = eco.agents.find((a) => a.L.flat);
  flat.state = 'rest';
  flat.t = 0;
  flat.dur = 60;
  step(eco, diverAt(flat.x - 1.5, flat.y + 0.4, flat.z, { x: 0.3, y: 0, z: 0 }), 0.5);
  assert.notEqual(flat.state, 'flee', 'still lying there at a metre and a half');
});

test('wait still near the bottom and the curious fish come over to look', () => {
  // By the Kittiwake: wrasse, bream and pollack about.
  const spot = { x: 97, z: 73 };
  const bottom = -createHabitat().depth(spot.x, spot.z);
  const close = (eco, D) => eco.agents.filter((a) => a.active && a.state !== 'gone' && Math.hypot(a.x - D.x, a.y - D.y, a.z - D.z) < 4.5).length;
  const run = (still) => {
    const eco = new Ecosystem(createHabitat());
    const D = diverAt(spot.x, bottom + 1.2, spot.z, { x: 0, y: 0, z: 0 }, false, still ? 10 : 0);
    // (Moving: swimming slowly round in circles, never settled.)
    let n = 0;
    for (let s = 0; s < 25; s++) {
      if (!still) {
        D.vx = Math.cos(s) * 0.6;
        D.vz = Math.sin(s) * 0.6;
        D.speed = 0.6;
        D.still = 0;
      }
      step(eco, D, 1);
      if (s >= 15) n += close(eco, D);
    }
    return n / 10;
  };
  const waiting = run(true), swimming = run(false);
  assert.ok(waiting > swimming + 1.5, `waiting: ${waiting.toFixed(1)} fish within 4.5 m; swimming about: ${swimming.toFixed(1)}`);
  assert.ok(V.curiosity(fishById.twobanded) > V.curiosity(fishById.mullet));
  assert.equal(V.curiosity(fishById.plaice), 0);
});

/* ---------------- the Kittiwake's bell ---------------- */

test('the Kittiwake’s bell lies on the sand by her bow, and photographing it finishes the adventure', () => {
  const B = T.WRECK_BELL, W = T.WRECK;
  const d = Math.hypot(B.x - W.x, B.z - W.z);
  assert.ok(d > W.len / 2 && d < W.len / 2 + 3, `${d.toFixed(1)} m from her middle`);
  assert.ok(-T.heightAt(B.x, B.z) > 6, 'down in the water by her');
  const st = { day: 4, hour: 10, adventures: {}, keepsakes: {}, unlocks: {} }, notes = [];
  const adv = new A.Adventures(st, { note: (t, x, id) => notes.push(id || t), toast() {}, save() {}, keepsake: (k) => { st.keepsakes[k] = { day: 4, hour: 10 }; } });
  adv.clue('bell');
  // Snorkelling over her isn't enough; diving down to her is.
  const ctx = (diving, depth) => ({ onFoot: true, player: { x: W.x + 3, z: W.z }, boat: { x: 0, z: 0 }, underwater: true, cam: { x: W.x, z: W.z }, flocks: [], diving, depth });
  adv.check(ctx(true, 0.3));
  assert.equal(adv.status('bell') === 'done', false);
  adv.check(ctx(true, 7));
  assert.ok(st.adventures.bell.steps.down);
  adv.photographed({ subjects: { species: [], places: ['wreck'], birds: false } });
  assert.ok(!st.adventures.bell.steps.photo, 'the wreck alone is not her bell');
  adv.photographed({ subjects: { species: [], places: ['wreck'], birds: false, bell: true } });
  assert.ok(st.adventures.bell.done, 'done');
  assert.ok(A.KEEPSAKES.bell, 'and a keepsake to show for it');
  assert.ok(A.ADVENTURE_BY_ID.bell.where.includes('notice board'), 'the card is on the notice board');
});

/* ---------------- the save ---------------- */

test('a dive’s catches and records survive a save; old saves start with a full tank', async () => {
  const S = await freshSave();
  const s = S.sanitize({
    dive: { tank: 123.4, dives: 7, deepest: 12.3, longest: 48, speared: 2, blackouts: 1, sites: { hound: { first: 3, dives: 2, deepest: 24.5 } } },
    log: [{ id: 'c1', sp: 'redporgy', size: 43, kind: 'spear', rod: 'speargun', from: 'dive', outcome: 'kept', depth: 7.7, bottom: 8.6 }],
  });
  assert.deepEqual(s.dive, { tank: 123.4, dives: 7, deepest: 12.3, longest: 48, speared: 2, blackouts: 1, sites: { hound: { first: 3, dives: 2, deepest: 24.5 } } });
  const e = s.log[0];
  assert.equal(e.kind, 'spear');
  assert.equal(e.rod, 'speargun');
  assert.equal(e.from, 'dive');
  assert.equal(e.outcome, 'kept');
  assert.equal(KIND_NAMES.spear, 'Spearfishing');
  // Junk is cleaned; an older save (no dive record) starts with a full tank.
  assert.deepEqual(S.sanitize({ dive: { tank: 9e9, dives: -3, deepest: 'deep' } }).dive, { tank: V.SCUBA.full, dives: 0, deepest: 0, longest: 0, speared: 0, blackouts: 0, sites: {} });
  assert.equal(S.sanitize({}).dive.tank, V.SCUBA.full);
  // A photograph of the bell keeps it.
  const p = S.sanitize({ photos: [{ id: 'p1abc', subjects: { species: [], places: ['wreck'], bell: true } }] }).photos[0];
  assert.equal(p?.subjects.bell, true);
});

test('every live sea fish has a curiosity, a spook distance, and a speargun answer', () => {
  for (const sp of FISH) {
    if (sp.retired || sp.water === 'fresh') continue;
    const c = V.curiosity(sp);
    assert.ok(c >= 0 && c <= 1, sp.id);
    const r = V.spookRadius(sp.life, 0, false), rk = V.spookRadius(sp.life, 1.6, true);
    assert.ok(r > 0.5 && rk > r, `${sp.id}: ${r.toFixed(1)} m still, ${rk.toFixed(1)} m kicking at it`);
    const big = V.canSpear(sp, sp.size[1], 'salt');
    assert.ok(typeof big.ok === 'boolean' && (big.ok || big.why), sp.id);
  }
});

test('on a controller: the stick swims, A and RB rise (A climbs out), LB sinks, RT shoots', async () => {
  const { MAPS, buttonFor } = await import('../src/gamepad.js');
  const M = MAPS.dive;
  assert.equal(M.A, 'interact');
  assert.equal(M.RB, 'interact');
  assert.equal(M.LB, 'tackle');
  assert.equal(M.RT, 'cast');
  assert.equal(M.L3, 'jog');
  assert.equal(buttonFor('dive', 'cast'), 'RT');
  assert.equal(buttonFor('dive', 'tackle'), 'LB');
  assert.equal(buttonFor('dive', 'forward'), 'L-stick');
});
