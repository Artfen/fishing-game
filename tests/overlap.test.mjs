// A friend's boat drawn on top of yours (J1c): found playing the brief's Part J day through
// (docs/PLAYTHROUGH.md). Two friends starting in their rowing boats at the same spot put the
// friend's row, drawn where their game says, right over yours. Every point of her hull inside the
// other's was pushed out from its centreline, back and forth as it crossed it, harder each time,
// until she was flung off (fifty times her weight in a step) and her position stopped being a
// number. Now a point deep inside the other hull goes out on the side her own middle is on, so all
// of her goes out the one way (boat.js touch), and yours slides clear of a friend's, which can't
// give, without touching it as she goes (apart.js keepClear). And her physics now name the stage that
// first went wrong, if one ever does again (hydro.js check). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { Boat, CONTACT_SKIN } = await import('../src/boat.js');
const { keepClear, CLEAR_K } = await import('../src/apart.js');
const { buildHullModel, HydroBody } = await import('../src/hydro.js');
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

test('a point at another hull’s skin is pushed out that side; one deep inside her, out the side her middle is on', () => {
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
  const half = o.hull.B * o.hull.hw(0.5) + 0.02;
  const at = (x) => { const v = new THREE.Vector3(x, o.hull.D * 0.5, 0); o.body.localToWorld(v); return [v.x, v.y, v.z]; };
  const out = (x) => { const v = new THREE.Vector3(x, 0, 0).transformDirection(o.body.matrixWorld); return [v.x, v.z]; };
  const mid = new THREE.Vector3(me.phys.x[0], me.phys.x[1], me.phys.x[2]);
  o.body.worldToLocal(mid);
  const m = Math.sign(mid.x);
  assert.equal(m, -1, 'her middle on hers’ -x side');
  // (At her skin, either side: out that side, as deep as it is, as ever: a bump is a bump.)
  for (const s of [1, -1]) {
    const f = me.touch(me.phys, at(s * (half - 0.1)));
    assert.ok(f && f.kind === 'boat', `at her skin (${s})`);
    assert.ok(Math.abs(f.pen - 0.1) < 1e-6, `as deep as it is: ${f.pen}`);
    const [nx, nz] = out(s);
    assert.ok(Math.abs(f.nx - nx) < 1e-6 && Math.abs(f.nz - nz) < 1e-6, `out her side: ${f.nx}, ${f.nz}`);
  }
  // (Deep inside her, on either side of her centreline: out the side your middle is on, never
  // flipping as it crosses it. Past her centreline, it's deeper still from that side.)
  const [mx, mz] = out(m);
  for (const x of [0.4, 0.05, -0.05, -0.4, half - CONTACT_SKIN - 0.05]) {
    const f = me.touch(me.phys, at(x));
    assert.ok(f && f.kind === 'boat', `deep inside at ${x}`);
    assert.ok(Math.abs(f.nx - mx) < 1e-6 && Math.abs(f.nz - mz) < 1e-6, `out your middle’s side at ${x}: ${f.nx}, ${f.nz}`);
    const deep = Math.min(0.5, x * m > 0 ? half - Math.abs(x) : half + Math.abs(x));
    assert.ok(Math.abs(f.pen - deep) < 1e-6, `as deep as it is from that side at ${x}: ${f.pen} (${deep})`);
  }
  // (Clear of her: nothing.)
  assert.equal(me.touch(me.phys, at(half + 0.2)), null);
  me.dispose?.();
  o.dispose?.();
});

test('a fast ram is still stopped where it comes in: the RIB at 15 m/s into the side of your row', () => {
  // (Points deep inside the other no longer go out their own side, but a ram's come in at her
  // skin. As before: her bow 0.31 m into the row's side at 8 m/s, 0.67 at 15 (0.73 now). Had deep
  // points simply been let be, as first tried, her bow went on through, nearly 2 m in.)
  for (const v of [8, 15]) {
    const me = new Boat(scene, { kind: 'rib' }), row = new Boat(scene, { kind: 'row' });
    me.place(-8, 300, Math.PI / 2);
    row.place(0, 300, 0);
    let t = 10, bow = -1e9, through = false;
    for (let i = 0; i < 30 * 6; i++) {
      t += 1 / 30;
      row.update(1 / 30, t, 0, 0, 0);
      me.update(1 / 30, t, 0, 0, 0);
      if (i === 0) { me.phys.v[0] = v; me.phys.v[2] = 0; continue; }
      bow = Math.max(bow, me.pos.x + Math.sin(me.heading) * me.hull.L / 2 - (row.pos.x - row.hull.B));
      if (me.pos.x > row.pos.x) through = true;
    }
    assert.ok(bow < 1 && !through, `stopped at her side: bow ${bow.toFixed(2)} m in at ${v} m/s`);
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
