// G6b of docs/PROGRESSION.md: a boat aground on a falling tide (src/aground.js; the call in
// src/contracts.js, the stray in src/main.js). The call comes only when the tide gives a fair
// window; she's put down on a real bank where the water will leave her by the time it says; she
// sits on the sand, harder the lower the water, and a real towline pulls her off; off, it's done;
// dry, it's gone. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const A = await import('../src/aground.js');
const K = await import('../src/contracts.js');
const { tideAt } = await import('../src/world/tide.js');
const { solidHeight, freshness, zoneAt, FRESH_ZONES } = await import('../src/world/terrain.js');

// Daytime moments over a fortnight, every ten minutes of the game's clock.
const MOMENTS = [];
for (let abs = 24; abs < 24 + 15 * 24; abs += 1 / 6) if (abs % 24 > 7.5 && abs % 24 < 19) MOMENTS.push(abs);
const HARBOUR = { x: 0, z: -150 };

test('the window: only on a falling tide, at least two hours, and she’s aground when the call comes', () => {
  let n = 0;
  for (const abs of MOMENTS) for (const under of [0.15, 0.25, 0.35]) {
    const g = A.levelAt(abs) - under, w = A.dryTime(abs, g, 0);
    if (!w) continue;
    n++;
    assert.equal(tideAt(abs).rising, false, 'never on a rising tide');
    assert.ok(w.dryAt - abs >= A.WINDOW.min - 1e-9 && w.dryAt - abs <= A.WINDOW.max + 1e-9, `${(w.dryAt - abs).toFixed(2)} h`);
    // (Some water under her now, not most of what she draws.)
    assert.ok(w.drop >= A.WINDOW.aground && w.drop <= A.AGROUND.draft * A.WINDOW.most + 1e-9, `${w.drop.toFixed(2)} m`);
    // (The water reaches her sand then, and not a step sooner; falling all the way.)
    assert.ok(A.levelAt(w.dryAt) <= g + 1e-9 && A.levelAt(w.dryAt - A.WINDOW.step) > g);
    for (let t = abs; t + 0.25 <= w.dryAt + 1e-9; t += 0.25) assert.ok(A.levelAt(t + 0.25) <= A.levelAt(t) + 1e-9);
  }
  assert.ok(n > 0, `${n} fair windows`);
  // Too much water under her (not aground), or too little (she's all but dry already): none.
  for (const abs of MOMENTS) {
    assert.equal(A.dryTime(abs, A.levelAt(abs) - A.AGROUND.draft, 0), null);
    assert.equal(A.dryTime(abs, A.levelAt(abs) - 0.05, 0), null);
  }
  // Up the estuary the river damps the tide (conditions.js): it falls more slowly there, so a
  // window is more often fair.
  const fair = (f) => MOMENTS.filter((abs) => A.dryTime(abs, A.levelAt(abs, f) - 0.2, f)).length;
  assert.ok(fair(0.5) > fair(0), `${fair(0.5)} up the estuary, ${fair(0)} on the open coast`);
});

test('the banks: spots on real sand between the tides, down the bank, level across her, deep water off her bow', () => {
  for (const B of A.BANKS) {
    const spots = A.bankSpots(B);
    assert.ok(spots.length >= 5, `${B.id}: ${spots.length} spots`);
    for (const s of spots) {
      assert.ok(!FRESH_ZONES.includes(zoneAt(s.x, s.z)), `${B.id}: salt water`);
      assert.ok(s.g > -0.6 && s.g < 0.6, `${B.id}: between the tides (${s.g.toFixed(2)})`);
      const fx = Math.sin(s.heading), fz = Math.cos(s.heading), h = A.AGROUND.length / 2, w = A.SPOT.beam;
      // (Her bow down the bank, gently; level across her beam; well deeper straight off her bow.)
      const bow = solidHeight(s.x + fx * h, s.z + fz * h), stern = solidHeight(s.x - fx * h, s.z - fz * h);
      assert.ok(stern - bow <= A.SPOT.along + 1e-9, `${B.id}: gentle along her (${(stern - bow).toFixed(2)})`);
      assert.ok(Math.abs(solidHeight(s.x - fz * w, s.z + fx * w) - solidHeight(s.x + fz * w, s.z - fx * w)) <= A.SPOT.across + 1e-9, `${B.id}: level across her`);
      assert.ok(solidHeight(s.x + fx * A.SPOT.wayIn, s.z + fz * A.SPOT.wayIn) <= s.g - A.SPOT.deeper + 1e-9, `${B.id}: deep water off her bow`);
      assert.ok(Math.abs(s.f - freshness(s.x, s.z)) < 1e-9);
    }
  }
});

test('the call’s spot: on a named bank near you, dry when it says, aground now', () => {
  let found = 0;
  for (const abs of MOMENTS) {
    const S = A.groundSpot(abs, HARBOUR);
    if (!S) continue;
    found++;
    const B = A.BANKS.find((b) => b.id === S.bank);
    assert.equal(S.name, B.name);
    const d = Math.hypot(B.x - HARBOUR.x, B.z - HARBOUR.z);
    assert.ok(d >= A.REACH.near && d <= A.REACH.far, `${S.bank}: ${d.toFixed(0)} m off`);
    const f = freshness(S.x, S.z), g = solidHeight(S.x, S.z);
    assert.ok(A.levelAt(S.dryAt, f) <= g + 1e-9 && A.levelAt(S.dryAt - A.WINDOW.step, f) > g, `dry at ${S.dryAt.toFixed(2)}`);
    const now = A.levelAt(abs, f) - g;
    assert.ok(now >= A.WINDOW.aground - 1e-9 && now < A.AGROUND.draft, `${now.toFixed(2)} m of water under her now: aground`);
    assert.ok(S.dryAt - abs >= A.WINDOW.min - 1e-9 && S.dryAt - abs <= A.WINDOW.max + 1e-9);
  }
  assert.ok(found > MOMENTS.length * 0.02 && found < MOMENTS.length * 0.5, `found ${found} of ${MOMENTS.length}`);
  // Nowhere near a bank (out at sea, the far west of the bay, or at the island): no call.
  for (const from of [{ x: 0, z: 2200 }, { x: -600, z: 100 }, { x: 40, z: 6352 }]) assert.equal(MOMENTS.filter((abs) => A.groundSpot(abs, from)).length, 0, JSON.stringify(from));
});

test('real hulls: she sits on the sand, harder the lower the water, and a towline pulls her off', async () => {
  const { Boat } = await import('../src/boat.js');
  const C = await import('../src/world/conditions.js');
  const O = await import('../src/world/ocean.js');
  const M = await import('../src/mooring.js');
  const scene = new THREE.Scene();
  C.conditions.preset = 'calm';
  C.conditions.manual = { speed: 0, from: 0 };
  C.conditions.wind.speed = C.conditions.wind.target = 0;
  for (let i = 0; i < 300; i++) C.updateConditions(0.1, { rain: 0, cloud: 0.2 });
  C.conditions.swellAmps.fill(0);
  C.conditions.sea.swell = C.conditions.sea.chop = 0;
  O.longSea.setWind(0, 0, 0, 0);
  const abs = MOMENTS.find((t) => A.groundSpot(t, HARBOUR));
  const S = A.groundSpot(abs, HARBOUR);
  // Put down on the bank with the tide at `at`, a moment to settle; then a RIB off her bow on a
  // towline, slow ahead, then more, for 20 s.
  const pull = (at) => {
    C.TIDE.level = tideAt(at).level;
    const her = new Boat(scene, { kind: A.AGROUND.boat });
    her.setRower?.(false);
    her.place(S.x, S.z, S.heading);
    let t = 0;
    // (How much of her weight the sand bears, over the last second of settling.)
    let sat = 0;
    for (let i = 0; i < 90; i++, t += 1 / 30) {
      her.update(1 / 30, t, 0, 0, 0);
      if (i >= 60) sat += her.groundLoad / 30;
    }
    const from = { x: her.pos.x, z: her.pos.z };
    // (Standing off in the deep water off her bow, within a heaving line's throw: where the spot
    // promises it.)
    const rib = new Boat(scene, { kind: 'rib' }), fx = Math.sin(S.heading), fz = Math.cos(S.heading), gap = A.SPOT.wayIn;
    rib.place(S.x + fx * gap, S.z + fz * gap, S.heading);
    rib.update(1 / 30, t, 0, 0, 0);
    assert.ok(M.canTow(rib, her).ok, 'a RIB can pull a cabin boat');
    const r0 = { x: rib.pos.x, z: rib.pos.z };
    const len = M.towLineFor(rib, her), out = {};
    let off = null, parted = false, clear = 0;
    for (let i = 0; i < 30 * 20 && !parted; i++, t += 1 / 30) {
      // (A moment to take her line, the strain taken up gently, then more if she won't come.)
      rib.update(1 / 30, t, i < 30 ? 0 : i < 150 ? 0.3 : 0.6, 0, 0);
      her.update(1 / 30, t, 0, 0, 0);
      M.towStep(rib, her, 1 / 30, len, out, 1);
      parted = !!out.parted;
      // (Off, as the game reads it: floating clear in deep enough water, for a few seconds.)
      clear = !(her.grounded > 0) && A.waterUnder(her.pos.x, her.pos.z, C.TIDE.level) > A.AGROUND.draft + A.OFF.clear ? clear + 1 / 30 : 0;
      if (off == null && clear >= A.OFF.secs) off = i / 30;
    }
    return { sat, moved: Math.hypot(her.pos.x - from.x, her.pos.z - from.z), off, parted, ribMoved: Math.hypot(rib.pos.x - r0.x, rib.pos.z - r0.z), ribLoad: rib.groundLoad };
  };
  const now = pull(abs), half = pull((abs + S.dryAt) / 2), dry = pull(S.dryAt);
  if (process.env.AGROUND_DEBUG) console.log(JSON.stringify({ S, abs, now, half, dry }));
  // Left alone from the call until the dry time, the tide falling as it does (an hour of the
  // game's in forty seconds): she stays where she is, and more and more of her weight goes on the
  // sand.
  const { HOUR_SECONDS } = await import('../src/world/clock.js');
  const her = new Boat(scene, { kind: A.AGROUND.boat });
  C.TIDE.level = tideAt(abs).level;
  her.place(S.x, S.z, S.heading);
  let t = 0, early = null, late = 0;
  const secs = (S.dryAt - abs) * HOUR_SECONDS;
  for (let i = 0; t < secs; i++, t += 1 / 15) {
    C.TIDE.level = tideAt(abs + t / HOUR_SECONDS).level;
    her.update(1 / 15, t, 0, 0, 0);
    if (i === 60) early = her.groundLoad;
    if (t > secs - 1) late = her.groundLoad;
  }
  const crept = Math.hypot(her.pos.x - S.x, her.pos.z - S.z);
  assert.ok(crept < 2, `left alone ${secs.toFixed(0)} s, she stays on the bank (${crept.toFixed(1)} m)`);
  assert.ok(late > 0.5 && late > early + 0.2, `her weight on the sand: ${(early * 100).toFixed(0)}% → ${(late * 100).toFixed(0)}% by the dry time`);
  assert.ok(now.sat > 0.02, `when the call comes she’s on the sand (${(now.sat * 100).toFixed(0)}% of her weight)`);
  assert.ok(half.sat > now.sat && dry.sat > half.sat, `more of her weight on it as the water leaves her: ${(now.sat * 100).toFixed(0)}%, ${(half.sat * 100).toFixed(0)}%, ${(dry.sat * 100).toFixed(0)}%`);
  assert.ok(now.off != null && now.off < 15 && !now.parted, `pulled off at ${now.off?.toFixed(1)} s, the line held`);
  assert.ok(dry.moved < now.moved / 4, `dry, the same pull shifts her ${dry.moved.toFixed(1)} m against ${now.moved.toFixed(1)} m`);
  C.conditions.manual = null;
});

test('the call: on the radio only when there’s a bank and a tide for it, and for a skipper the harbour office knows', () => {
  const W = { day: 5, region: 'home', storm: false, wind: 5, abs: 100, callSpot: { x: 0, z: 300, where: 'off the bay' }, rank: K.CAREER[2] };
  const spot = { x: 600, z: 80, heading: 1, bank: 'wendbar', name: 'the bar at the mouth of the Wend', dryAt: 103.2, drop: 0.25, dryWords: '7:12 am' };
  const known = Object.assign(K.newContracts(), { count: 10, rep: { wenna: 5 } }), stranger = Object.assign(K.newContracts(), { count: 10 });
  assert.ok(K.callPool(known, { ...W, groundSpot: spot }).includes('aground'));
  assert.ok(!K.callPool(known, W).includes('aground'), 'no bank and tide for it: never');
  assert.ok(!K.callPool(stranger, { ...W, groundSpot: spot }).includes('aground'), 'not for a stranger');
  assert.ok(!K.callPool(known, { ...W, groundSpot: spot, offshore: { km: 3 } }).includes('aground'), 'not out on the Blue Water');
  const o = K.TEMPLATES.aground.make({ ...W, groundSpot: spot }, () => 0.3);
  assert.equal(o.obj.kind, 'tow');
  assert.equal(o.obj.aground, true);
  assert.equal(o.obj.boat, 'cabin');
  assert.equal(o.obj.by, spot.dryAt, 'gone when she’s dry');
  assert.equal(o.obj.heading, spot.heading);
  assert.match(o.story, /run up on the bar at the mouth of the Wend, and the tide’s falling/);
  assert.match(o.story, /high and dry by about 7:12 am/);
  // (The boats that can: the bass boat's and the sailing boat's engines can't shift her.)
  assert.match(o.boat, /the RIB, or the centre-console boat/);
  assert.equal(K.TEMPLATES.aground.make({ ...W, groundSpot: spot, storm: true }, () => 0.3), null);
  assert.equal(K.TEMPLATES.aground.make({ ...W, groundSpot: spot, wind: 15 }, () => 0.3), null);
});

test('the job: on your line, off and paid on the spot; or the tide leaves her and it’s gone', () => {
  const W = { day: 5, region: 'home', storm: false, wind: 5, abs: 100, callSpot: { x: 0, z: 300, where: 'off the bay' }, groundSpot: { x: 600, z: 80, heading: 1, bank: 'wendbar', name: 'the bar', dryAt: 103.2, drop: 0.25, dryWords: '7:12 am' } };
  const take = () => {
    const C = Object.assign(K.newContracts(), { count: 10, rep: { wenna: 5 } });
    const o = K.callFor(C, W, () => 0.999);
    const pool = K.callPool(C, W);
    const a = K.acceptCall(C, { ...K.TEMPLATES.aground.make(W, () => 0.3), id: 'x-aground', tpl: 'aground', cat: 'rescue', giver: 'wenna' }, 0);
    return { C, a, o, pool };
  };
  let { C, a } = take();
  const x = (strays, abs = 101) => ({ x: 600, z: 80, now: 0, abs, boat: 'rib', dt: 0.5, strays });
  assert.match(K.standing(a), /Aground, and the tide falling/);
  assert.deepEqual([K.target(a).x, K.target(a).z], [600, 80]);
  // Aground, not yet on your line: nothing.
  assert.equal(K.tick(C, x({ [a.id]: { towed: false, home: false, off: false } })).boarded.length, 0);
  // On your line: said once.
  assert.equal(K.tick(C, x({ [a.id]: { towed: true, home: false, off: false } })).boarded.length, 1);
  assert.equal(K.tick(C, x({ [a.id]: { towed: true, home: false, off: false } })).boarded.length, 0);
  assert.match(K.standing(a), /ease her off into deep water/);
  // (Brought into Willowhaven's harbour isn't what's asked: off the bank is.)
  assert.equal(K.tick(C, x({ [a.id]: { towed: true, home: true, off: false } })).done.length, 0);
  // Off: done, paid on the spot.
  const r = K.tick(C, x({ [a.id]: { towed: true, home: false, off: true } }));
  assert.equal(r.done.length, 1);
  assert.ok(a.onSpot);
  // Left too long: the tide's left her, and the job's gone.
  ({ C, a } = take());
  const late = K.tick(C, x({ [a.id]: { towed: false, home: false, off: false } }, 103.3));
  assert.equal(late.missed.length, 1);
  assert.equal(late.missed[0].why, 'dry');
  assert.equal(C.active.length, 0);
  // Kept through a save, the way she lies.
  ({ C, a } = take());
  a.progress.at = { x: 601, z: 81, h: 1.2 };
  const back = K.cleanContracts(JSON.parse(JSON.stringify(C)));
  assert.equal(back.active[0].obj.aground, true);
  assert.deepEqual(back.active[0].progress.at, { x: 601, z: 81, h: 1.2 });
});

test('the game: the bank for the call, the stray put down on it, off read from her hull, and the words', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /const g = !blue && boat\.pos\.z < SOUTH_Z \? findGroundSpot\(clock\.abs, boat\.pos\) : null;/);
  assert.match(src, /Con\.callFor\(C, \{ \.\.\.jobWorld\(\), callSpot: spot, groundSpot, offshore/);
  assert.match(src, /b\.place\(p\.x, p\.z, p\.h \?\? a\.obj\.heading \?\? b\.heading \?\? 0\);/);
  assert.match(src, /const clear = !\(b\.grounded > 0\) && waterUnder\(b\.pos\.x, b\.pos\.z, TIDE\.level\) > AGROUND\.draft \+ AGROUND_OFF\.clear;/);
  assert.match(src, /off = b\._offT >= AGROUND_OFF\.secs;/);
  assert.match(src, /a\.why === 'dry' \? `\$\{a\.title\}: the tide’s left her, high and dry/);
  assert.match(src, /r\.contract\.obj\.aground \? 'off and afloat/);
  // (Her people heave you a line: within its throw of her will do, not alongside.)
  assert.match(src, /if \(d < \(b\.aground \? Math\.max\(reach, HEAVE\) : reach\) && d < near && b\.speed < 1\.2\)/);
  assert.match(src, /b\.aground = !!a\.obj\.aground;/);
  // (Never resting on the waves out of sight: she sits on the sand as the tide leaves her.)
  assert.match(src, /!b\.damage && !b\.aground && Math\.hypot\(b\.pos\.x - camera\.position\.x/);
});
