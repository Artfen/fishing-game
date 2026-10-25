// Holding a boat still: the anchor (down to the seabed, holding her on its rope in the wind and
// waves, hauled in again), tying up alongside each jetty and quay (and casting off, only into
// open water), one boat towing another, and all of it kept with the save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Boat } = await import('../src/boat.js');
const M = await import('../src/mooring.js');
const { PIERS, solidHeight } = await import('../src/world/terrain.js');

const { conditions } = await import('../src/world/conditions.js');
// (A little swell running, as on most days out there.)
conditions.swellAmps.fill(0.12);
conditions.chopAmps.fill(0.03);
const scene = new THREE.Scene();
const OPEN = { x: 150, z: 330 };
let clock = 0;
const run = (b, secs, lever = 0, steer = 0) => {
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    b.update(1 / 30, clock, lever, steer, 0);
  }
  return b;
};
const boatAt = (kind, x, z, heading = 0) => {
  const b = new Boat(scene, { kind });
  b.place(x, z, heading);
  b.update(1 / 30, clock, 0, 0, 0);
  return b;
};

test('the anchor needs the right depth: not so shallow she’d sit on the bottom, not deeper than its rope', () => {
  const ok = boatAt('skiff', OPEN.x, OPEN.z);
  const c = M.anchorCheck(ok);
  assert.ok(c.ok && c.depth > 2 && c.depth < M.ANCHOR.maxDepth, `${c.depth}`);
  // The open sea, far out past the shelf.
  const deep = boatAt('skiff', 0, 1150);
  const d = M.anchorCheck(deep);
  assert.ok(!d.ok && /Too deep/.test(d.why) && /30 m/.test(d.why), d.why);
  // Right in by a beach.
  let shallow = null;
  for (let z = 30; z < 70 && !shallow; z += 0.5) {
    if (solidHeight(100, z) < -0.3 && solidHeight(100, z) > -0.7) shallow = boatAt('row', 100, z - 1.6, 0);
  }
  assert.ok(shallow);
  const s = M.anchorCheck(shallow);
  assert.ok(!s.ok && /Too shallow/.test(s.why), s.why);
  // Under way: slow down first.
  run(ok, 4, 1);
  assert.ok(!M.anchorCheck(ok).ok);
  // The rope's reach: two and a half times the depth paid out, never more than the rope.
  assert.ok(M.rodeFor(5) === 12.5 && M.rodeFor(20) === M.ANCHOR.rope);
  assert.ok(M.reachFor(5) > 7 && M.reachFor(5) < 12.5);
  assert.ok(M.reachFor(2) > 2 && M.reachFor(2) < 5, 'close in, in shallow water');
});

// Somewhere about 4 m deep in open water.
function fourMetres() {
  for (let x = -150; x < 300; x += 3) for (let z = -60; z < 400; z += 3) {
    const d = -solidHeight(x, z);
    if (d > 3.5 && d < 4.5 && [[6, 0], [-6, 0], [0, 6], [0, -6], [0, -14]].every(([a, c]) => -solidHeight(x + a, z + c) > 2.5)) return { x, z };
  }
  return null;
}

test('anchored: it goes down to the seabed, holds her on its rope in wind and current, and she lies head to it', () => {
  const at = fourMetres();
  assert.ok(at, 'a 4 m anchorage');
  const b = boatAt('skiff', at.x, at.z, 0);
  const sets = [];
  b.onAnchor = (what) => sets.push(what);
  b.setAnchor(true);
  assert.ok(b.anchored && b.anchor.phase === 'drop');
  run(b, 0.2);
  assert.ok(b.anchorOut.visible && b.rode.mesh.visible, 'the anchor and its rope are out');
  assert.ok(!b.anchorStowed.visible, 'not on the foredeck any more');
  run(b, 12);
  assert.deepEqual(sets, ['set']);
  assert.ok(Math.abs(b.anchor.y - b.anchor.floor) < 0.01, 'on the bottom');
  // A steady push from ahead and a little to one side (a breeze, standing in for the weather):
  // she drifts back until the rope comes tight, then holds there, head to the anchor.
  const A = b.anchor;
  for (let i = 0; i < 30 * 60; i++) {
    clock += 1 / 30;
    b.vel.x += 0.06 * (1 / 30);
    b.vel.z -= 0.35 * (1 / 30);
    b.update(1 / 30, clock, 0, 0, 0);
  }
  const bow = M.bowOf(b), d = Math.hypot(bow.x - A.x, bow.z - A.z);
  assert.ok(d > A.reach * 0.85 && d < A.reach + 0.6, `lying back on her rope: ${d.toFixed(1)} of ${A.reach.toFixed(1)} m`);
  const toAnchor = Math.atan2(A.x - b.pos.x, A.z - b.pos.z), off = Math.abs(Math.atan2(Math.sin(toAnchor - b.heading), Math.cos(toAnchor - b.heading)));
  assert.ok(off < 0.35, `head to the anchor (${off.toFixed(2)} rad off)`);
  assert.ok(A.tension > 0.5, 'the rope is tight');
  // Haul it in: she's drawn up over the anchor, it comes up, and she's free (in seconds).
  b.setAnchor(false);
  let secs = 0;
  while (b.anchor && secs < 20) {
    run(b, 0.1);
    secs += 0.1;
  }
  assert.ok(!b.anchored && !b.anchor, `up in ${secs.toFixed(1)} s`);
  assert.ok(secs < 16);
  assert.deepEqual(sets, ['set', 'up']);
  assert.ok(b.anchorStowed.visible && !b.anchorOut.visible && !b.rode.mesh.visible, 'back on the foredeck');
  // And she motors off normally.
  const v = run(b, 4, 0.4).forwardSpeed;
  assert.ok(v > 2);
});

test('anchored, she doesn’t sit pinned: the waves still lift her, and nothing snaps her about when it’s set from a save', () => {
  const b = boatAt('row', OPEN.x, OPEN.z, 1);
  const at = { x: OPEN.x + Math.sin(1) * 8, z: OPEN.z + Math.cos(1) * 8 };
  b.setAnchor(true, { at, instant: true });
  assert.equal(b.anchor.phase, 'set');
  const p0 = b.pos.clone();
  run(b, 0.1);
  assert.ok(b.pos.distanceTo(p0) < 0.05, 'set from a save: she stays where she was');
  const heave = [];
  for (let i = 0; i < 90; i++) {
    run(b, 1 / 30);
    heave.push(b.group.position.y);
  }
  assert.ok(Math.max(...heave) - Math.min(...heave) > 0.005, 'still riding the swell');
});

test('every jetty and quay has a berth alongside; she lies along it and stays there', () => {
  const names = ['the old jetty', 'the landing', 'Wend Quay', 'the boathouse jetty', 'the Puffin Cove pier', 'Willowhaven quay', 'the Calf’s landing'];
  // Which boats can get to each (the bass boat lives on Longmere; the others on the sea).
  const sea = ['row', 'skiff', 'kayak', 'cabin'];
  const who = [sea, sea, sea, ['bass', 'kayak'], sea, sea, sea];
  PIERS.forEach((P, i) => {
    const long = P.x1 - P.x0 >= P.z1 - P.z0;
    for (const kind of who[i] || sea) {
      // (Where piers meet, as a pontoon's fingers do, the nearest berth may be on the next one.)
      let b = null, B = null;
      for (const side of [-1, 1]) for (let u = 0.15; u <= 0.85 && !B; u += 0.1) {
        const x = long ? P.x0 + (P.x1 - P.x0) * u : (side < 0 ? P.x0 - 2.4 : P.x1 + 2.4);
        const z = long ? (side < 0 ? P.z0 - 2.4 : P.z1 + 2.4) : P.z0 + (P.z1 - P.z0) * u;
        b = boatAt(kind, x, z, long ? Math.PI / 2 : 0);
        if (solidHeight(x, z) > -(b.hull.draft + 0.2)) continue;
        B = M.berthFor(b, []);
      }
      assert.ok(B, `${kind} has a berth at ${names[i] || `pier ${i}`}`);
      // Tied up, she eases in alongside and stays: lying along the pier, clear of it but close.
      b.tieTo(B);
      run(b, 6);
      assert.ok(Math.hypot(b.pos.x - B.x, b.pos.z - B.z) < 0.25, `${kind} at ${names[i]}: on her berth`);
      assert.ok(Math.abs(Math.atan2(Math.sin(b.heading - B.heading), Math.cos(b.heading - B.heading))) < 0.05, 'lying along it');
      const Q = PIERS[B.pier], along = Q.x1 - Q.x0 >= Q.z1 - Q.z0;
      const gap = along ? Math.min(Math.abs(b.pos.z - Q.z0), Math.abs(b.pos.z - Q.z1)) : Math.min(Math.abs(b.pos.x - Q.x0), Math.abs(b.pos.x - Q.x1));
      assert.ok(gap > b.hull.B * 0.5 && gap < b.hull.B * 0.5 + 0.4, `alongside, fenders between (${(gap - b.hull.B * 0.5).toFixed(2)} m)`);
      assert.ok(b.lines.every((l) => l.mesh.visible) && b.fenders.every((f) => f.visible), 'lines and fenders out');
      // The motor and the oars don't move her while she's tied.
      const before = b.pos.clone();
      run(b, 3, 1);
      assert.ok(b.pos.distanceTo(before) < 0.3);
      // Cast off: out into open water, lines in.
      const c = M.castOffCheck(b, []);
      assert.ok(c.ok, `${kind} can cast off at ${names[i]}: ${c.why}`);
      b.castOff(c.nx, c.nz);
      run(b, 3);
      assert.ok(!b.tie && b.lines.every((l) => !l.mesh.visible) && b.fenders.every((f) => !f.visible));
      const out = along ? Math.min(Math.abs(b.pos.z - Q.z0), Math.abs(b.pos.z - Q.z1)) : Math.min(Math.abs(b.pos.x - Q.x0), Math.abs(b.pos.x - Q.x1));
      assert.ok(out > gap, 'she drifts clear of the pier');
    }
  });
});

test('no berth when she’s too far off or the place is taken, and no casting off into another boat', () => {
  const P = PIERS[5]; // Willowhaven quay
  const far = boatAt('skiff', P.x1 + 12, (P.z0 + P.z1) / 2, 0);
  assert.equal(M.berthFor(far, []), null, 'too far off');
  const a = boatAt('skiff', P.x1 + 2, P.z0 + 9, 0);
  const B = M.berthFor(a, []);
  assert.ok(B);
  // Another boat already lying right there.
  const other = boatAt('row', B.x, B.z, B.heading);
  const B2 = M.berthFor(a, [a, other]);
  assert.ok(!B2 || Math.hypot(B2.x - B.x, B2.z - B.z) > (a.hull.B + other.hull.B) * 1.3, 'not on top of her');
  // Tied up with a boat lying right outside her: no room to cast off.
  a.tieTo(B);
  run(a, 3);
  const P2 = PIERS[B.pier], long = P2.x1 - P2.x0 >= P2.z1 - P2.z0;
  const ox = long ? 0 : B.side, oz = long ? B.side : 0;
  const blocker = boatAt('row', B.x + ox * (a.hull.B + 1.4), B.z + oz * (a.hull.B + 1.4), B.heading);
  // (With a boat lying outside her, she goes off along the quay instead, never into her.)
  const c = M.castOffCheck(a, [a, blocker]);
  assert.ok(c.ok && Math.abs(c.nx * ox + c.nz * oz) < 0.01, 'off along the quay, not into the other boat');
  // Boxed in ahead, astern and outside: no room at all.
  const fx = Math.sin(B.heading), fz = Math.cos(B.heading), reach = a.hull.L * 0.5 + 1.5;
  const ahead = boatAt('row', B.x + fx * reach, B.z + fz * reach, B.heading), astern = boatAt('kayak', B.x - fx * reach, B.z - fz * reach, B.heading);
  const c2 = M.castOffCheck(a, [a, blocker, ahead, astern]);
  assert.ok(!c2.ok && /No room to cast off/.test(c2.why), c2.why);
});

test('towing: the line pulls (never pushes), the towed boat follows her leader, and a small boat can’t tow a big one', () => {
  const lead = boatAt('skiff', OPEN.x, OPEN.z, Math.PI / 2);
  const towed = boatAt('row', OPEN.x - 7, OPEN.z + 1.5, 0.3);
  assert.ok(M.canTow(lead, towed).ok);
  assert.ok(!M.canTow(boatAt('kayak', 0, 0), towed).ok, 'the kayak tows nothing bigger');
  assert.ok(!M.canTow(boatAt('row', 0, 0), boatAt('cabin', 3, 0)).ok, 'the rowing boat can’t tow the cabin boat');
  // Motor away: the line comes tight and she follows, bow to the line, at the leader's speed.
  let tight = 0;
  for (let i = 0; i < 30 * 20; i++) {
    clock += 1 / 30;
    lead.update(1 / 30, clock, 0.14, 0, 0);
    towed.update(1 / 30, clock, 0, 0, 0);
    tight = M.towStep(lead, towed, 1 / 30);
  }
  const stern = { x: lead.pos.x - lead.fwd.x * lead.hull.L / 2, z: lead.pos.z - lead.fwd.z * lead.hull.L / 2 };
  const bow = { x: towed.pos.x + towed.fwd.x * towed.hull.L / 2, z: towed.pos.z + towed.fwd.z * towed.hull.L / 2 };
  const d = Math.hypot(stern.x - bow.x, stern.z - bow.z);
  assert.ok(d <= M.TOW.len + 0.05 && d > M.TOW.len * 0.9, `on the end of the line (${d.toFixed(2)} m)`);
  assert.ok(tight > 0.5);
  assert.ok(Math.abs(towed.speed - lead.speed) < 0.3 && towed.speed > 1, `following at ${towed.speed.toFixed(2)} m/s`);
  const off = Math.abs(Math.atan2(Math.sin(towed.heading - lead.heading), Math.cos(towed.heading - lead.heading)));
  assert.ok(off < 0.25, 'in line astern');
  // Towing slows the leader a little: she's pulling a boat.
  const solo = boatAt('skiff', OPEN.x, OPEN.z - 60, Math.PI / 2);
  run(solo, 20, 0.14);
  assert.ok(lead.speed < solo.speed, `${lead.speed.toFixed(2)} < ${solo.speed.toFixed(2)} m/s`);
  // Backing down on her: the line goes slack, and nothing pushes.
  for (let i = 0; i < 30 * 3; i++) {
    clock += 1 / 30;
    lead.update(1 / 30, clock, -0.3, 0, 0);
    towed.update(1 / 30, clock, 0, 0, 0);
    tight = M.towStep(lead, towed, 1 / 30);
  }
  assert.ok(tight < 0.2, 'slack');
});

test('the save keeps where the anchor lies, the berth she’s tied up at, and a tow; junk is dropped', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await import('../src/save.js?moor=1');
  const s = S.loadGame().state;
  s.boats.skiff = { x: 150, z: 330, heading: 1, anchored: true, anchor: { x: 152, z: 338 } };
  s.boats.cabin = { x: 14.2, z: -83, heading: 0, anchored: false, tie: { pier: 5, side: 1, along: -88, heading: 0 } };
  s.tow = { lead: 'skiff', towed: 'row' };
  assert.ok(S.saveGame(s));
  const back = (await import('../src/save.js?moor=2')).loadGame().state;
  assert.deepEqual(back.boats.skiff.anchor, { x: 152, z: 338 });
  assert.deepEqual(back.boats.cabin.tie, { pier: 5, side: 1, along: -88, heading: 0 });
  assert.deepEqual(back.tow, { lead: 'skiff', towed: 'row' });
  const junk = S.sanitize({ boats: { skiff: { x: 1, z: 2, anchor: { x: 'far' }, tie: { pier: -3, side: 2 } } }, tow: { lead: 'skiff', towed: 'skiff' } });
  assert.equal(junk.boats.skiff.anchor, undefined);
  assert.equal(junk.boats.skiff.tie, undefined);
  assert.equal(junk.tow, null);
  // An older save: none of it, and nothing else changed.
  const old = S.sanitize({ boats: { row: { x: 5, z: 6, heading: 1, anchored: true } } });
  assert.deepEqual(old.boats.row, { x: 5, z: 6, heading: 1, anchored: true });
  assert.equal(old.tow, null);
  // A saved berth is found again exactly (the boat is put back where she was, held at once).
  const b = boatAt('cabin', 0, 0);
  const B = M.berthAt(b, 5, 1, -88, 0);
  const again = M.berthAt(b, 5, 1, -88, 0);
  assert.deepEqual(B, again);
});
