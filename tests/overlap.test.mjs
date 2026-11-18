// A friend's boat drawn on top of yours (J1c): found playing the brief's Part J day through
// (docs/PLAYTHROUGH.md). Two friends starting in their rowing boats at the same spot put the
// friend's row, drawn where their game says, right over yours. Every point of her hull inside the
// other's was pushed out from its centreline, back and forth as it crossed it, harder each time,
// until she was flung off (fifty times her weight in a step) and her position stopped being a
// number. Yours now slides clear of a friend's, which can't give, without touching it as she goes
// (apart.js keepClear), and her physics name the stage that first went wrong, if one ever does
// again (hydro.js check). And (B0) every point of her inside another hull goes out the one way, and
// the contacts are solved together as impulses, not sprung (boat.js touch, hydro.js
// contactForces): before, any two hulls found overlapped were kicked apart at up to 35 m/s in a
// quarter of the places tried. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { Boat, EXIT_HYST } = await import('../src/boat.js');
const { keepClear, CLEAR_K } = await import('../src/apart.js');
const { buildHullModel, HydroBody, CONTACT_PUSH, CONTACT_E } = await import('../src/hydro.js');
const { HULLS } = await import('../src/boat.js');

const scene = new THREE.Scene();

// A friend's boat as your game draws her (see visitors.js drawMoored): put where word says, still,
// riding the swell; never stepped by her own physics.
function drawn(b, x, z, h, t) {
  b.pos.set(x, 0, z);
  b.vel.set(0, 0, 0);
  b.heading = h;
  b.group.position.set(x, 0, z);
  b.group.rotation.y = h;
  b.group.updateMatrixWorld(true);
  b.afloat(t);
}

// Yours at the start spot, the friend's drawn (dx, dz) off it and turned dh, for `secs`: how fast
// yours ever went, whether she was lost, where she ended up, how far from the friend's.
function lieTogether(dx, dz, dh, secs, clear = false) {
  const me = new Boat(scene, { kind: 'row' }), friend = new Boat(scene, { kind: 'row' });
  // (A friend's, as visitors.js draws it, when she's sliding clear of it; otherwise any boat.)
  friend.drawn = clear;
  me.place(12, 32, Math.PI);
  friend.place(12 + dx, 32 + dz, Math.PI + dh);
  let t = 10, top = 0, late = 0, lost = false, doneAt = null, touched = false;
  const gap = (me.hull.B + friend.hull.B) * CLEAR_K;
  for (let i = 0; i < secs * 30; i++) {
    t += 1 / 30;
    drawn(friend, 12 + dx, 32 + dz, Math.PI + dh, t);
    me.update(1 / 30, t, 0, 0, 0);
    // (While she slides clear, she isn't touching hers.)
    if (me.clearOf && me._others?.includes(friend)) touched = true;
    if (clear) keepClear([me], [friend], 1 / 30);
    if (!Number.isFinite(me.pos.x + me.pos.z + me.vel.x + me.vel.z)) { lost = true; break; }
    top = Math.max(top, Math.hypot(me.vel.x, me.vel.z));
    if (i >= (secs - 3) * 30) late = Math.max(late, Math.hypot(me.vel.x, me.vel.z));
    if (clear && doneAt == null && i > 0 && !me.clearOf) doneAt = i / 30;
  }
  const d = Math.hypot(me.pos.x - friend.pos.x, me.pos.z - friend.pos.z);
  const out = { top, late, lost, d, gap, doneAt, touched, blow: me.phys.blowFirst || null, nan: me.phys.nanAt || null, friend: [friend.pos.x, friend.pos.z], moved: Math.hypot(me.pos.x - 12, me.pos.z - 32) };
  me.dispose?.();
  friend.dispose?.();
  return out;
}

// (The places the day's two rows were found lying, and a few more: overlapped by a third of her
// beam to more than a beam, square and askew.)
const SPOTS = [[0.4, 0, 0], [0.4, 0.3, 0.1], [0.35, 0.5, 0.3], [0.6, -0.4, -0.2], [0.8, 0.2, 0.5], [1.0, 0, 0], [0, 0, 0], [0.3, 1.5, 0]];

test('a row drawn on top of yours doesn’t fling yours off: the contacts alone part them with one push', () => {
  for (const [dx, dz, dh] of SPOTS) {
    const r = lieTogether(dx, dz, dh, 30);
    const at = JSON.stringify({ dx, dz, dh, top: +r.top.toFixed(2), late: +r.late.toFixed(2), blow: r.blow });
    assert.ok(!r.lost, `never lost: ${at}`);
    // (Before: 5.5 m/s, and 8.8 right on top, with kicks of fifty times her weight, and shaking on
    // at half a metre a second for good.)
    assert.ok(r.top < 4, `one push apart, not flung: ${at}`);
    assert.equal(r.blow, null, `no kick no boat takes: ${at}`);
  }
});

test('and yours slides clear of hers in a moment, gently, hers left where it’s said to be', () => {
  for (const [dx, dz, dh] of SPOTS) {
    const r = lieTogether(dx, dz, dh, 12, true);
    const at = JSON.stringify({ dx, dz, dh, d: +r.d.toFixed(2), doneAt: r.doneAt, top: +r.top.toFixed(2), moved: +r.moved.toFixed(2) });
    assert.ok(!r.lost && r.blow == null, at);
    assert.ok(r.doneAt != null && r.doneAt < 1.5, `clear within a second or so: ${at}`);
    assert.ok(r.d >= r.gap - 0.05, `and still clear: ${at}`);
    // (Before the slide went the whole way, the contacts kicked her the rest of it, askew: 2.9 m/s,
    // spun round 115°.)
    assert.ok(r.top < 1, `slid, not kicked: ${at}`);
    assert.ok(!r.touched, `not touching hers as she slides: ${at}`);
    // (Never further than a boat's length or so: the shortest way out, not all along the line.)
    assert.ok(r.moved < 6, `the short way out: ${at}`);
    assert.deepEqual(r.friend, [12 + dx, 32 + dz], 'the friend’s not moved');
  }
});

test('every point of hers inside another hull goes out the one way: the side her middle is on, or out the end it’s past', () => {
  const me = new Boat(scene, { kind: 'row' }), o = new Boat(scene, { kind: 'row' });
  // (Yours lying off hers to the west, her bow north: your middle on her -x side.)
  me.place(2, 5, 0);
  o.place(5, 5, 0);
  o.group.position.set(5, 0, 5);
  o.group.rotation.y = 0;
  o.body.rotation.set(0, 0, 0);
  o.group.updateMatrixWorld(true);
  me._others = [o];
  me._piers = [];
  me.phys._t = 0;
  const half = o.hull.B * o.hull.hw(0.5) + 0.02;
  const at = (x, z = 0) => { const v = new THREE.Vector3(x, o.hull.D * 0.5, z); o.body.localToWorld(v); return [v.x, v.y, v.z]; };
  const out = (x, z = 0) => { const v = new THREE.Vector3(x, 0, z).transformDirection(o.body.matrixWorld); return [v.x, v.z]; };
  const mid = new THREE.Vector3(me.phys.x[0], me.phys.x[1], me.phys.x[2]);
  o.body.worldToLocal(mid);
  const m = Math.sign(mid.x);
  assert.equal(m, -1, 'her middle on hers’ -x side');
  // (At her skin on your side, as deep as it is: a bump is a bump. Further in, deeper; past her
  // centreline deeper still, and still out your side, never flipping as it crosses it; even at her
  // far side's skin, where before it was pushed on out through her.)
  const [mx, mz] = out(m);
  for (const x of [-(half - 0.1), -0.4, -0.05, 0.05, 0.4, half - 0.1]) {
    const f = me.touch(me.phys, at(x));
    assert.ok(f && f.kind === 'boat', `inside her at ${x}`);
    assert.ok(Math.abs(f.nx - mx) < 1e-6 && Math.abs(f.nz - mz) < 1e-6, `out your middle’s side at ${x}: ${f.nx}, ${f.nz}`);
    const deep = Math.min(0.5, half - x * m);
    assert.ok(Math.abs(f.pen - deep) < 1e-6, `as deep as it is from that side at ${x}: ${f.pen} (${deep})`);
  }
  // (Clear of her: nothing.)
  assert.equal(me.touch(me.phys, at(half + 0.2)), null);
  // (Kept while your middle is only just over her centreline, a step later: a boat lying square on
  // top of another doesn't flip from side to side. Clearly over, it goes out that side.)
  const step = (x, z) => { me.phys._t += 1 / 120; const v = new THREE.Vector3(x, 0, z); o.body.localToWorld(v); me.phys.x[0] = v.x; me.phys.x[2] = v.z; };
  step(half * EXIT_HYST * 0.3, 0);
  let f = me.touch(me.phys, at(0));
  assert.ok(Math.abs(f.nx - mx) < 1e-6 && Math.abs(f.nz - mz) < 1e-6, 'kept, just over');
  step(o.hull.B * 0.4, 0);
  f = me.touch(me.phys, at(0));
  const [px, pz] = out(1);
  assert.ok(Math.abs(f.nx - px) < 1e-6 && Math.abs(f.nz - pz) < 1e-6, `clearly over: out the other side (${f.nx}, ${f.nz})`);
  // (Your middle out past her bow: along her, out over her bow, as deep as it is from there.)
  step(0, o.hull.L / 2 + 1);
  const [bx, bz] = out(0, 1);
  for (const z of [o.hull.L / 2 - 0.2, 0.3]) {
    f = me.touch(me.phys, at(0, z));
    assert.ok(Math.abs(f.nx - bx) < 1e-6 && Math.abs(f.nz - bz) < 1e-6, `out over her bow at ${z}: ${f.nx}, ${f.nz}`);
    assert.ok(Math.abs(f.pen - Math.min(0.5, o.hull.L / 2 - z)) < 1e-6, `from her bow at ${z}: ${f.pen}`);
  }
  me.dispose?.();
  o.dispose?.();
});

// Two hulls found overlapped (seeded, so the same places each run): each kind of each, over and
// askew, from just touching to right on top. How fast yours ever goes, whether she's thrown a kick
// no boat takes, and whether she's still moving at the end.
function overlapped(kinds, n, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  const out = [];
  for (let k = 0; k < n; k++) {
    const dx = rnd() * 1.2, dz = (rnd() - 0.5) * 3, dh = (rnd() - 0.5) * 1.2;
    const me = new Boat(scene, { kind: kinds[0] }), her = new Boat(scene, { kind: kinds[1] });
    me.place(12, 32, Math.PI);
    her.place(12 + dx, 32 + dz, Math.PI + dh);
    let t = 10, top = 0, lost = false;
    const vs = [];
    for (let i = 0; i < 12 * 30; i++) {
      t += 1 / 30;
      drawn(her, 12 + dx, 32 + dz, Math.PI + dh, t);
      me.update(1 / 30, t, 0, 0, 0);
      if (!Number.isFinite(me.pos.x + me.pos.z + me.vel.x + me.vel.z)) { lost = true; break; }
      top = Math.max(top, Math.hypot(me.vel.x, me.vel.z));
      if (i >= 10 * 30) vs.push([me.vel.x, me.vel.z]);
    }
    // (Shaking: how far her velocity strays from its average over the last two seconds.)
    const mx = vs.reduce((a, v) => a + v[0], 0) / vs.length, mz = vs.reduce((a, v) => a + v[1], 0) / vs.length;
    const shake = Math.max(...vs.map((v) => Math.hypot(v[0] - mx, v[1] - mz)));
    out.push({ at: [+dx.toFixed(2), +dz.toFixed(2), +dh.toFixed(2)], top, lost, late: Math.hypot(me.vel.x, me.vel.z), shake, blow: me.phys.blowFirst || null, d: Math.hypot(me.pos.x - her.pos.x, me.pos.z - her.pos.z) });
    me.dispose?.();
    her.dispose?.();
  }
  return out;
}

test('two hulls found overlapped anywhere, of any kinds, part with one easy push: no kick, no spin, nothing left shaking', () => {
  // (Before, the same places: a row on a row kicked apart at up to 35 m/s in a quarter of them, a
  // skiff on a cabin boat in two thirds, and some left shaking for good.)
  for (const [kinds, seed] of [[['row', 'row'], 777], [['rib', 'row'], 99], [['skiff', 'cabin'], 5], [['cabin', 'skiff'], 8]]) {
    for (const r of overlapped(kinds, 6, seed)) {
      const at = JSON.stringify({ kinds, ...r, top: +r.top.toFixed(2), late: +r.late.toFixed(2), shake: +r.shake.toFixed(3) });
      assert.ok(!r.lost && r.blow == null, `no kick: ${at}`);
      // (Eased apart at the contacts' own pace, a touch more as the swell rocks her.)
      assert.ok(r.top < CONTACT_PUSH * 2, `one easy push: ${at}`);
      // (B3) Pushed apart, she glides on as a boat does with nothing driving her, slowing: no
      // faster than the push left her, and her velocity steady, not shaking. (Before B3, the
      // worst of these strayed 0.13 m/s over the last two seconds; now 0.06.)
      assert.ok(r.late <= r.top + 1e-9 && r.shake < 0.15, `nothing left shaking: ${at}`);
    }
  }
});

// How deep the deepest point of one hull's ring is inside another's outline: the shortest way out.
function deepest(me, o) {
  const H = o.hull;
  let d = 0;
  for (const lp of me.phys.model.ring) {
    const p = me.phys.toWorld(lp, [0, 0, 0]), v = new THREE.Vector3(p[0], p[1], p[2]);
    o.body.worldToLocal(v);
    const tt = (v.z + H.L / 2) / H.L;
    if (tt < 0 || tt > 1) continue;
    const half = H.B * H.hw(tt) + 0.02;
    if (Math.abs(v.x) > half || v.y > H.D + 0.3 || v.y < -1) continue;
    d = Math.max(d, Math.min(half - Math.abs(v.x), H.L / 2 - Math.abs(v.z)));
  }
  return d;
}

test('a RIB ramming a rowing boat shoves her off as two boats meeting do, and never goes through her', () => {
  // (Before, each hull met the other as if it were a quay: the RIB bounced off or ploughed on and
  // the row, a fifth of her weight, was nudged off at half a metre a second whatever the speed.
  // Now they meet as two masses do, a hard knock bouncing a little (CONTACT_E): the row goes off at
  // (1 + e)·m₁/(m₁ + m₂) of the RIB's speed, the RIB carries on at (m₁ − e·m₂)/(m₁ + m₂) of it.
  // And her bow is stopped at the row's side, as J1c asked: no point of her ever more than 0.8 m
  // inside the row, 0.68 m at 15 m/s (0.72 before).)
  for (const v of [3, 8, 15]) {
    const me = new Boat(scene, { kind: 'rib' }), row = new Boat(scene, { kind: 'row' });
    me.place(-8, 300, Math.PI / 2);
    row.place(0, 300, 0);
    let t = 10, deep = 0, met = null, prev = 0, ribOn = 0, rowOff = 0;
    for (let i = 0; i < 30 * 6; i++) {
      t += 1 / 30;
      row.update(1 / 30, t, 0, 0, 0);
      me.update(1 / 30, t, 0, 0, 0);
      if (i === 0) { me.phys.v[0] = v; me.phys.v[2] = 0; continue; }
      deep = Math.max(deep, deepest(me, row));
      if (met == null && Math.hypot(row.vel.x, row.vel.z) > 0.3) { met = prev; ribOn = me.vel.x; rowOff = Math.hypot(row.vel.x, row.vel.z); }
      prev = me.vel.x;
    }
    const m1 = me.phys.m, m2 = row.phys.m, e = CONTACT_E;
    const at = JSON.stringify({ v, met: met && +met.toFixed(2), rowOff: +rowOff.toFixed(2), ribOn: +ribOn.toFixed(2), deep: +deep.toFixed(2) });
    assert.ok(met > v * 0.8, `she meets the row near the speed she was sent at: ${at}`);
    assert.ok(Math.abs(rowOff / ((1 + e) * m1 / (m1 + m2) * met) - 1) < 0.1, `the row shoved off as two masses meeting: ${at}`);
    assert.ok(Math.abs(ribOn / ((m1 - e * m2) / (m1 + m2) * met) - 1) < 0.1, `the RIB carrying on as two masses meeting: ${at}`);
    assert.ok(deep < 0.8, `never into her more than her side: ${at}`);
    me.dispose?.();
    row.dispose?.();
  }
});

test('her physics name the stage that first brings in a value that isn’t a number, or a kick no boat takes', () => {
  const env = { t: 0, water: (x, z, t, o) => { o.h = 0; o.vx = o.vy = o.vz = 0; }, ground: () => -100 };
  const M = buildHullModel(HULLS.row);
  const body = () => { const b = new HydroBody(M); b.place(0, 0, 0, 0); return b; };
  // (A weight on her that isn't a number: the outside forces.)
  let b = body();
  b.forces.push({ f: [0, NaN, 0], p: [0, 0, 0] });
  b.step(1 / 30, env);
  assert.equal(b.nanAt?.stage, 'forces', JSON.stringify(b.nanAt));
  assert.equal(b.nanAt.F[1], 'NaN', 'kept as it was, said in words');
  // (The sea under her gone wrong: the water.)
  b = body();
  b.step(1 / 30, { ...env, water: (x, z, t, o) => { o.h = NaN; o.vx = o.vy = o.vz = 0; } });
  assert.equal(b.nanAt?.stage, 'water');
  // (Her own state put wrong from outside: before any of her forces.)
  b = body();
  b.v[2] = NaN;
  b.step(1 / 30, env);
  assert.equal(b.nanAt?.stage, 'state');
  // (A kick of a hundred times her weight from outside her: the first kept, with when.)
  b = body();
  b.step(1 / 30, env);
  assert.equal(b.blowFirst, null, 'lying still: nothing');
  b.forces.push({ f: [b.m * 9.81 * 100, 0, 0], p: [0, 0, 0] });
  b.step(1 / 30, { ...env, t: 3 });
  assert.equal(b.blowFirst?.stage, 'forces', JSON.stringify(b.blowFirst));
  assert.ok(Math.abs(b.blowFirst.t - 3) < 0.05 && b.nanAt == null);
  // (Put back where she was: a clean slate.)
  b.place(0, 0, 0, 0);
  assert.equal(b.blowFirst, null);
  assert.equal(b.blowAt, null);
});
