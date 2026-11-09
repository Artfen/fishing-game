// Bow trolling motors as marine equipment (src/trollmount.js, with trolling.js and boat.js): each
// boat's own installation, the RIB's on a platform over her tube nose; stowed along her bow; the
// latch, the slide off the ramps, the swing down past the bow, the lock, the trip down to depth and
// the lower unit turned straight, and all of it backwards to stow; nothing it moves ever touching
// her hull, tubes, rails, cabin, seats, cleat, fairlead or towing eye; no jumps; the propeller dead
// until it's down; the three kinds of motor; and it all carried in the save and to friends.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { Boat, floatDraft } = await import('../src/boat.js');
const { tubeCentre } = await import('../src/hydro.js');
const MT = await import('../src/trollmount.js');
const { TrollMotor, TROLL_TIERS, canTroll } = await import('../src/trolling.js');
const { FITS, fitEffect, fitBoat, fitsFor, cleanYard } = await import('../src/shipyard.js');
const { cleanFuel } = await import('../src/fuel.js');
const { cleanPose } = await import('../src/together.js');
const { conditions } = await import('../src/world/conditions.js');
const { obstacles, hits, sweep } = await import('./trollclear.mjs');

const { mountFor, rigPose, propAt, V, TrollMech, MOUNT_SPECS } = MT;
const scene = new THREE.Scene();
const KINDS = Object.keys(MOUNT_SPECS);
const boatOf = (kind) => {
  const b = new Boat(scene, { kind });
  b.place(150, 330, 0);
  return b;
};
const hw = (H, t) => H.B * H.hw(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;
const tOf = (H, z) => (z + H.L / 2) / H.L;

test('a mount for each boat that takes one, the RIB among them, worked out from her own hull', () => {
  assert.deepEqual(KINDS.sort(), ['bass', 'cabin', 'console', 'rib', 'skiff']);
  for (const k of KINDS) assert.ok(canTroll(k), k);
  const seen = new Set();
  for (const kind of KINDS) {
    const b = boatOf(kind), M = b.trollMount;
    assert.ok(M && M.kind === kind, `${kind}: her own mount`);
    assert.equal(M.side, 1, `${kind}: on the starboard bow, clear of the fairlead and towing eye on the centreline`);
    assert.ok(M.hinge[2] > zAt(b.hull, 0.85), `${kind}: at the bow`);
    seen.add(M.hinge.map((n) => n.toFixed(2)).join());
  }
  assert.equal(seen.size, KINDS.length, 'not one universal mount: each boat’s is her own');
  assert.equal(boatOf('rib').trollMount.platform, 'riser', 'the RIB’s on a raised platform');
  assert.equal(boatOf('console').trollMount.railGap, true, 'the console’s rail open in its forward bay for it');
  for (const kind of ['cruiser', 'sail', 'jetski', 'kayak', 'row', 'windsurf']) assert.equal(boatOf(kind).trollMount, null, kind);
});

test('nothing it moves touches her, all the way down and all the way back up, on every boat and every kind of motor', () => {
  for (const kind of KINDS) {
    const b = boatOf(kind), M = b.trollMount;
    for (const how of ['manual', 'assist', 'powered']) {
      const r = sweep(b, M, how);
      const first = r.hit[0];
      assert.equal(r.hit.length, 0, `${kind}/${how}: ${first ? `${first.part} into the ${first.what} at ${first.p.map((n) => n.toFixed(2))}` : ''}`);
      assert.ok(r.down.ready, `${kind}/${how}: ready at the bottom`);
      assert.ok(r.up.v.latch === 0 && r.up.v.pivot === 0, `${kind}/${how}: back up and latched`);
    }
  }
});

test('the RIB’s platform stands above her tubes and its legs on her foredeck inside them; her tubes are never touched', () => {
  const b = boatOf('rib'), H = b.hull, M = b.trollMount, T = H.tubes;
  // The platform's underside clears every bit of tube under it (its length aft from the hinge).
  const aft = V.norm([M.d0[0], 0, M.d0[2]]);
  for (let s = -0.02; s <= 1.15; s += 0.05) {
    const p = V.add(M.hinge, V.mul(aft, s));
    for (let t = 0.6; t <= T.t1; t += 0.01) {
      const c = tubeCentre(H, t, 1);
      if (Math.abs(c[2] - p[2]) < 0.12 && Math.abs(c[0] - p[0]) < T.r + 0.17) assert.ok(M.base.y - 0.025 > c[1] + T.r + 0.02, `the platform over the tube at ${p[2].toFixed(2)}`);
    }
  }
  // Its legs stand on the foredeck inside the tubes, and nothing of them touches a tube.
  for (const L of M.base.legsTo) {
    const t = tOf(H, L.foot[2]), inner = tubeCentre(H, t, 1)[0] - T.r;
    assert.ok(Math.abs(L.foot[0]) < inner - 0.02, `a leg foot at x ${L.foot[0].toFixed(2)} inside the tube’s inner edge ${inner.toFixed(2)}`);
    assert.ok(t > 0.85 && t < T.t1, 'on the foredeck');
    for (let u = 0; u <= 1.0001; u += 0.1) {
      const p = V.add(L.foot, V.mul(V.sub(L.top, L.foot), u));
      for (let tt = 0.7; tt <= T.t1; tt += 0.01) assert.ok(V.len(V.sub(p, tubeCentre(H, tt, 1))) > T.r + 0.025, 'the leg clear of the tube');
    }
  }
  // The stowed shaft lies on the platform, clear above it.
  const S = rigPose(M, { latch: 0, slide: 0, pivot: 0, lock: 0, ext: 0, turn: 1 }, 0, 0);
  for (let s = 0; s < M.base.len - 0.05; s += 0.1) assert.ok(M.hinge[1] - s * Math.sin(M.spec.droop) - 0.02 > M.base.y, 'above the plate');
  void S;
  // Deployed, the shaft drops in the water ahead of the tube nose, outside the tubes.
  const r = sweep(b, M, 'assist');
  const tubeHits = r.hit.filter((h) => h.what === 'tube');
  assert.equal(tubeHits.length, 0);
  const P = r.down.P, nose = tubeCentre(H, T.t1, 1);
  assert.ok(P.low[2] > nose[2] + T.r, 'the lower unit ahead of the tube’s nose');
});

test('stowed, it lies along the starboard side of her bow: the shaft near level, the head aft over the boat, the lower unit forward on its ramps', () => {
  for (const kind of KINDS) {
    const b = boatOf(kind), M = b.trollMount, H = b.hull;
    const P = rigPose(M, { latch: 0, slide: 0, pivot: 0, lock: 0, ext: 0, turn: 1 }, 0, 0);
    assert.ok(Math.abs(P.d[1]) < Math.sin(0.25), `${kind}: the shaft near level (${(Math.asin(P.d[1]) * 57.3).toFixed(0)}°)`);
    assert.ok(P.d[2] < -0.9, `${kind}: running aft from the hinge`);
    assert.ok(P.low[2] > P.head[2] + 1, `${kind}: the lower unit forward, the head aft`);
    const th = tOf(H, P.head[2]);
    assert.ok(P.head[0] > 0 && P.head[0] < hw(H, th) + 0.2, `${kind}: the head on her starboard side (x ${P.head[0].toFixed(2)}, her side ${hw(H, th).toFixed(2)})`);
    // The lower unit turned sideways, lying across the ramps (its pod level and athwartships).
    assert.ok(Math.abs(P.fwd[1]) < 0.1 && Math.abs(P.fwd[0]) > 0.9, `${kind}: the pod lying across the ramps`);
  }
});

test('down: the shaft vertical, the propeller under her still waterline and clear of her hull, at each depth', () => {
  for (const kind of KINDS) {
    const b = boatOf(kind), M = b.trollMount, H = b.hull;
    for (const id of ['shallow', 'normal', 'deep']) {
      const mech = new TrollMech('manual', M);
      mech.setDepth(id);
      mech.snap(true);
      const P = rigPose(M, mech.v, mech.angle(), 0), prop = propAt(P);
      assert.ok(P.d[1] > Math.cos(0.5 / 57.3), `${kind}: vertical`);
      const under = M.water - prop[1];
      assert.ok(under >= 0.25 && under <= 0.85, `${kind} ${id}: the propeller ${under.toFixed(2)} m down`);
      // (Clear of her bottom: below her keel there, or outside her.)
      const t = tOf(H, prop[2]);
      assert.ok(t > 1 || prop[1] < H.keel(Math.min(1, t)) - 0.05 || Math.abs(prop[0]) > hw(H, Math.min(1, t)), `${kind} ${id}: clear of her hull`);
      // And well forward of her main outboard.
      assert.ok(prop[2] > zAt(H, 0.5), `${kind}: nowhere near her outboard`);
    }
  }
});

test('the motion: latch, slide, swing, lock, down to depth, straight; stowing the same backwards; reversible part-way without a jump', () => {
  const b = boatOf('rib'), M = b.trollMount;
  const mech = new TrollMech('manual', M);
  const starts = [], ends = [];
  mech.deploy(true);
  for (let i = 0; i < 30 * 15 && !(mech.ready && !mech.moving); i++) {
    for (const e of mech.step(1 / 30)) (e.type === 'start' ? starts.push(e.step) : ends.push(e.type));
  }
  assert.deepEqual(starts, ['latch', 'slide', 'pivot', 'lock', 'ext', 'turn']);
  assert.deepEqual(ends, ['unlatched', 'clear', 'vertical', 'locked', 'atDepth', 'straight']);
  starts.length = ends.length = 0;
  mech.deploy(false);
  for (let i = 0; i < 30 * 15 && !mech.stowed; i++) {
    for (const e of mech.step(1 / 30)) (e.type === 'start' ? starts.push(e.step) : ends.push(e.type));
  }
  assert.deepEqual(starts, ['turn', 'ext', 'lock', 'pivot', 'slide', 'latch']);
  assert.deepEqual(ends, ['turned', 'raised', 'unlocked', 'level', 'onRamps', 'latched']);
  // At 120 frames a second nothing moves more than a few centimetres a frame (no jump anywhere),
  // and turned back half-way through the swing it goes back the way it came.
  for (const kind of KINDS) {
    const bb = boatOf(kind), MM = bb.trollMount;
    const m2 = new TrollMech('assist', MM);
    let last = null, worst = 0, steps = 0;
    const pts = () => MT.rigPoints(MM, rigPose(MM, m2.v, m2.angle(), 0)).map((q) => q.p);
    m2.deploy(true);
    const O = obstacles(bb, MM);
    for (let i = 0; i < 120 * 20; i++) {
      if (m2.v.pivot > 0.5 && m2.want && steps === 0) {
        m2.deploy(false);
        steps = 1;
      }
      m2.step(1 / 120);
      const p = pts();
      if (last) p.forEach((q, j) => { worst = Math.max(worst, V.len(V.sub(q, last[j]))); });
      last = p;
      assert.equal(hits(bb, MM, rigPose(MM, m2.v, m2.angle(), 0), O).length, 0, `${kind}: turned back part-way, nothing hit`);
      if (!m2.want && m2.stowed) break;
    }
    assert.ok(steps === 1 && m2.stowed, `${kind}: back up and stowed`);
    assert.ok(worst < 0.035, `${kind}: at most ${(worst * 100).toFixed(1)} cm in a frame`);
  }
});

test('no push until it’s down, locked, straight and at depth; never part-way; a depth set by hand stops it while the collar’s loose', () => {
  const b = boatOf('bass'), M = b.trollMount;
  const m = new TrollMotor('troll', { mount: M });
  const boat = { x: 0, z: 0, vx: 0, vz: 0, heading: 0, mass: 700 };
  m.deploy(true);
  let pushedEarly = false;
  for (let i = 0; i < 30 * 10; i++) {
    m.drive(1, 0);
    const r = m.step(1 / 30, { boat, battery: 1 });
    if (!m.deployed && r.f > 0) pushedEarly = true;
  }
  assert.equal(pushedEarly, false, 'nothing while it swings down');
  assert.ok(m.deployed && m.f > 0, 'pushing once it’s down');
  // Set deeper by hand: stopped while it's moved, pushing again after.
  m.setDepth('deep');
  m.drive(1, 0);
  m.step(1 / 30, { boat, battery: 1 });
  assert.equal(m.deployed, false);
  assert.equal(m.f, 0);
  for (let i = 0; i < 60; i++) {
    m.drive(1, 0);
    m.step(1 / 30, { boat, battery: 1 });
  }
  assert.ok(m.deployed && m.f > 0, 'at the new depth, pushing again');
  // And on the boat: no push from its thruster while it's on its way down.
  const bb = boatOf('console');
  const mm = new TrollMotor('trollgps', { mount: bb.trollMount });
  bb.troll = mm;
  mm.deploy(true);
  mm.drive(1, 0);
  for (let i = 0; i < 20; i++) {
    mm.step(1 / 30, { boat, battery: 1 });
    bb.update(1 / 30, i / 30, 0, 0, 0);
  }
  assert.equal(mm.deployed, false);
  assert.equal(bb.phys.thrusters.filter((q) => q.f > 0).length, 0, 'no thruster pushing');
});

test('the three kinds: by hand; by hand with a lift-assist and GPS from its remote; and one that stows, deploys and trims itself', () => {
  assert.equal(TROLL_TIERS.troll.deploy, 'manual');
  assert.equal(TROLL_TIERS.troll.gps, false);
  assert.equal(TROLL_TIERS.trollgps.deploy, 'assist');
  assert.ok(TROLL_TIERS.trollgps.gps && TROLL_TIERS.trollgps.remote);
  assert.equal(TROLL_TIERS.trollpro.deploy, 'powered');
  assert.equal(TROLL_TIERS.trollpro.trim, 'powered');
  // (Not every GPS motor deploys itself: only the high-thrust one.)
  assert.equal(TROLL_TIERS.trollgps.trim, 'manual');
  const M = boatOf('console').trollMount, boat = { x: 0, z: 0, vx: 0, vz: 0, heading: 0, mass: 2400 };
  const time = (tier) => {
    const m = new TrollMotor(tier, { mount: M });
    m.deploy(true);
    let n = 0;
    while (!m.deployed && n < 30 * 30) {
      m.step(1 / 30, { boat, battery: 1 });
      n++;
    }
    return n / 30;
  };
  const tHand = time('troll'), tAssist = time('trollgps'), tPowered = time('trollpro');
  assert.ok(tAssist < tHand, `the lift-assist makes the swing quicker (${tAssist.toFixed(1)} s against ${tHand.toFixed(1)} s)`);
  assert.ok(tPowered > tHand && tPowered < 25, `the actuator takes its steady time (${tPowered.toFixed(1)} s)`);
  // The power trim moves it between depths and keeps pushing.
  const p = new TrollMotor('trollpro', { mount: M });
  p.down = 1;
  p.drive(1, 0);
  p.setDepth('deep');
  for (let i = 0; i < 10; i++) {
    p.drive(1, 0);
    p.step(1 / 30, { boat, battery: 1 });
  }
  assert.ok(p.deployed && p.f > 0, 'trimming and pushing');
  // The actuator runs on the battery, won't on a flat one, and then it's stowed by hand.
  const q = new TrollMotor('trollpro', { mount: M });
  q.down = 1;
  q.deploy(false);
  const r = q.step(1 / 30, { boat, battery: 0.01 });
  assert.equal(r.why, 'noPower');
  assert.equal(q.mech.v.turn, 0, 'nothing moved');
  q.handStow();
  for (let i = 0; i < 30 * 20 && !q.mech.stowed; i++) q.step(1 / 30, { boat, battery: 0.01 });
  assert.ok(q.mech.stowed, 'stowed by hand');
  const used = new TrollMotor('trollpro', { mount: M });
  used.deploy(true);
  let drawn = 0;
  for (let i = 0; i < 60; i++) drawn += used.step(1 / 30, { boat, battery: 1 }).drawn;
  assert.ok(drawn > 0, 'the actuator draws on the battery');
});

test('the RIB: bought and fitted at the Marine Works, deployed, and holding her on Spot-Lock in a breeze on its battery', () => {
  const state = { money: 5000, yard: { owned: ['row', 'skiff', 'kayak', 'rib'], fits: {}, looks: {}, hired: null }, ledger: [] };
  assert.ok(fitsFor('rib').includes('trollgps'));
  const r = fitBoat(state, 'rib', 'trollgps');
  assert.ok(r.ok, r.why);
  assert.equal(fitEffect(state.yard, 'rib').trollMotor, 'trollgps');
  conditions.manual = { speed: 7, from: Math.PI / 2 };
  conditions.wind.speed = conditions.wind.target = 7;
  conditions.wind.from = Math.PI / 2;
  try {
    const b = boatOf('rib');
    b.place(150, 330, Math.PI / 2);
    const m = new TrollMotor('trollgps', { mount: b.trollMount });
    b.troll = m;
    m.deploy(true);
    b.update(1 / 30, 0, 0, 0, 0);
    let battery = 1, t = 0;
    const st = (n) => {
      for (let i = 0; i < n; i++) {
        t += 1 / 30;
        const q = m.step(1 / 30, { boat: { x: b.pos.x, z: b.pos.z, vx: b.vel.x, vz: b.vel.z, heading: b.heading, mass: b._phys.m }, battery, sea: 0, lever: 0 });
        battery = Math.max(0, battery - q.drawn);
        b.update(1 / 30, t, 0, 0, 0);
      }
    };
    st(30 * 8);
    assert.ok(m.deployed, 'down and locked');
    const spot = { x: b.pos.x, z: b.pos.z };
    assert.equal(m.spotLock(true, spot), null);
    let worst = 0;
    for (let k = 0; k < 40; k++) {
      st(30);
      if (k > 10) worst = Math.max(worst, Math.hypot(b.pos.x - spot.x, b.pos.z - spot.z));
    }
    assert.ok(worst < 6, `held within ${worst.toFixed(1)} m of her spot`);
    assert.ok(m.f > 0 && battery < 1, 'pushing, on its battery');
  } finally {
    conditions.manual = { speed: 0, from: 0 };
    conditions.wind.speed = conditions.wind.target = 0;
  }
});

test('the model shows the mechanism where it is, and goes with her as she pitches and rolls', () => {
  const b = boatOf('rib');
  const m = new TrollMotor('trollgps', { mount: b.trollMount });
  b.troll = m;
  m.deploy(true);
  for (let i = 0; i < 40; i++) {
    m.step(1 / 30, { boat: { x: 0, z: 0, vx: 0, vz: 0, heading: 0, mass: 1250 }, battery: 1 });
    b.update(1 / 30, i / 30, 0, 0, 0);
  }
  const R = b.trollRig;
  assert.ok(R && R.root.visible);
  const check = () => {
    b.body.updateMatrixWorld(true);
    const P = rigPose(b.trollMount, m.mech.v, m.mech.angle(), R.steer);
    const want = b.body.localToWorld(new THREE.Vector3(...P.low));
    const got = R.spinner.getWorldPosition(new THREE.Vector3());
    return want.distanceTo(got);
  };
  assert.ok(check() < 1e-6, 'the lower unit where the mechanism has it');
  // Pitched and rolled: still on her bow, exactly where it was in her frame.
  b.body.rotation.set(0.12, 0, -0.15);
  assert.ok(check() < 1e-6, 'pitching and rolling with her');
  assert.ok(R.root.parent === b.body, 'part of her body');
  // The console's rail bay is left off only with a motor on.
  const c = boatOf('console');
  assert.ok(c.railBay);
  c.update(1 / 30, 0, 0, 0, 0);
  assert.equal(c.railBay.visible, true, 'a full rail with no motor');
  c.troll = new TrollMotor('troll', { mount: c.trollMount });
  c.update(1 / 30, 0, 0, 0, 0);
  assert.equal(c.railBay.visible, false, 'open in the forward bay with one fitted');
});

test('saves keep what was bought: old fittings, the bass boat’s own motor, and the RIB’s battery', () => {
  const kinds = ['row', 'skiff', 'kayak', 'bass', 'cabin', 'console', 'rib', 'cruiser'];
  const Y = cleanYard({ owned: kinds, fits: { bass: ['troll'], console: ['trollpro', 'trollbank'], skiff: ['trollgps'], rib: ['trollgps'] } }, kinds);
  assert.deepEqual(Y.fits.bass, ['troll'], 'a basic motor an older game bought for the bass boat, kept');
  assert.equal(fitEffect(Y, 'console').trollMotor, 'trollpro');
  assert.equal(fitEffect(Y, 'console').trollBank, true);
  assert.equal(fitEffect(Y, 'skiff').trollMotor, 'trollgps');
  assert.equal(fitEffect(Y, 'rib').trollMotor, 'trollgps');
  // The bass boat comes with the basic one: not offered again, there in her fittings' effect.
  const fresh = cleanYard({ owned: kinds }, kinds);
  assert.equal(fitEffect(fresh, 'bass').trollMotor, 'troll');
  assert.equal(fitEffect(fresh, 'bass').trollStandard, true);
  assert.equal(fitsFor('bass').includes('troll'), false);
  assert.equal(fitsFor('bass', ['troll']).includes('troll'), true, 'listed if an old game had it, to take off');
  assert.equal(fitEffect(fresh, 'console').trollMotor, null);
  // Each boat's trolling battery, the RIB's too.
  assert.equal(cleanFuel({ troll: { rib: 0.37 } }).troll.rib, 0.37);
  assert.ok(FITS.trollbank.price.rib > 0);
});

test('friends see it: its state goes over the wire, checked, and their copy of her boat shows it where it is', () => {
  const b = boatOf('bass'), M = b.trollMount;
  const m = new TrollMotor('trollgps', { mount: M });
  m.deploy(true);
  for (let i = 0; i < 25; i++) m.step(1 / 30, { boat: { x: 0, z: 0, vx: 0, vz: 0, heading: 0, mass: 700 }, battery: 1 });
  const wire = MT.trollWire(m.tier, m.mech, m.angle, false);
  const P = cleanPose({ m: 'boat', k: 'bass', x: 1, z: 2, h: 0, tr: wire }, ['bass']);
  assert.deepEqual(P.tr, wire);
  // Junk dropped.
  assert.equal(cleanPose({ m: 'boat', k: 'bass', x: 1, z: 2, h: 0, tr: [1, 2, 'x'] }, ['bass']).tr, undefined);
  assert.equal(cleanPose({ m: 'boat', k: 'bass', x: 1, z: 2, h: 0, tr: Array(10).fill(1e9) }, ['bass']).tr, undefined);
  // A friend's copy of her boat, drawn from it.
  const friend = boatOf('bass');
  friend.trollView = MT.cleanTrollWire(P.tr, friend.trollMount);
  friend.animate(1 / 30, 0, 0, 0, 0);
  const R = friend.trollRig;
  assert.ok(R && R.root.visible && R.look === 'trollgps');
  friend.body.updateMatrixWorld(true);
  const mine = rigPose(M, m.mech.v, m.mech.angle(), 0).low;
  const theirs = friend.body.worldToLocal(R.spinner.getWorldPosition(new THREE.Vector3()));
  assert.ok(theirs.distanceTo(new THREE.Vector3(...mine)) < 0.03, `their lower unit where mine is (${theirs.distanceTo(new THREE.Vector3(...mine)).toFixed(3)} m)`);
  // No motor in the pose: none drawn.
  friend.trollView = null;
  friend.animate(1 / 30, 0, 0, 0, 0);
  assert.equal(friend.trollRig.root.visible, false);
});
