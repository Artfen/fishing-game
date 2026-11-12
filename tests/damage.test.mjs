// Marine physics C5a (docs/IMPROVEMENTS.md): damage from what she hits (damage.js; boat.js
// takeDamage; hydro.js's record of each step's hardest knock and fastest slide, and a RIB's tube
// chambers). Nothing breaks on its own: a knock's harm is its speed square on, against what it was,
// past what she's built to take; sand does nothing, rock most; on Relaxed, scuffs only. A RIB's
// punctured chamber goes soft and holds her up no more; the pump puts the air back; the yard mends
// it all, at a price.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat } = await import('../src/boat.js');
const { newEngine } = await import('../src/engine.js');
const DM = await import('../src/damage.js');
const { sanitize } = await import('../src/save.js');

const scene = new THREE.Scene();

test('a knock’s harm is its speed square on, against what it was, past what she’s built to take', () => {
  const grp = DM.MATERIALS.grp, S = DM.MODES.standard;
  const hit = (vn, surface, mat = grp, mode = S, section = 'bow') => {
    const D = DM.newDamage();
    DM.knock(D, mat, { section, vn, surface, chamber: -1 }, mode);
    return D.hull[section];
  };
  // Gently alongside a quay, onto sand at speed, against her fenders: nothing.
  assert.equal(hit(1.5, 'pier'), 0);
  assert.equal(hit(4.5, 'sand'), 0);
  assert.equal(hit(8, 'fender'), 0);
  // Harder, more; rock worse than a quay, a quay worse than another boat's side.
  assert.ok(hit(3, 'pier') > 0 && hit(5, 'pier') > hit(3, 'pier'));
  assert.ok(hit(3, 'rock') > hit(3, 'pier') && hit(3, 'pier') > hit(3, 'boat'));
  // Tougher stuff takes more: polyethylene (the kayak) shrugs off what cracks glassfibre.
  assert.ok(hit(3, 'rock', DM.MATERIALS.pe) < hit(3, 'rock'));
  assert.ok(hit(3, 'rock', DM.MATERIALS.aluminium) < hit(3, 'rock'));
  // By difficulty: Relaxed scuffs only, however hard; Realistic a little worse than Standard.
  assert.ok(hit(20, 'rock', grp, DM.MODES.relaxed) <= DM.MODES.relaxed.cap);
  assert.ok(hit(4, 'rock', grp, DM.MODES.realistic) > hit(4, 'rock'));
  // Never past cracked through, and it builds up knock on knock.
  const D = DM.newDamage();
  for (let i = 0; i < 40; i++) DM.knock(D, grp, { section: 'port', vn: 6, surface: 'rock', chamber: -1 }, S);
  assert.equal(D.hull.port, 1);
  // Dragged over rock she's scored; over sand, nothing.
  const R = DM.newDamage(), Sd = DM.newDamage();
  for (let i = 0; i < 30; i++) {
    DM.scrape(R, grp, { section: 'bottom', speed: 8, surface: 'rock', chamber: -1 }, 1 / 30, S);
    DM.scrape(Sd, grp, { section: 'bottom', speed: 8, surface: 'sand', chamber: -1 }, 1 / 30, S);
  }
  assert.ok(R.hull.bottom > 0.02 && Sd.hull.bottom === 0);
  // Where on her: forward is her bow, below the waterline her bottom, aft her stern, else a side.
  assert.equal(DM.sectionAt(0, 0.2, 3, 6.5, 0.95, 0.34), 'bow');
  assert.equal(DM.sectionAt(0.1, 0.05, 0, 6.5, 0.95, 0.34), 'bottom');
  assert.equal(DM.sectionAt(0.9, 0.5, 0, 6.5, 0.95, 0.34), 'port');
  assert.equal(DM.sectionAt(-0.9, 0.5, 0, 6.5, 0.95, 0.34), 'stbd');
  assert.equal(DM.sectionAt(0.5, 0.5, -3.2, 6.5, 0.95, 0.34), 'stern');
});

test('a tube punctures only on something sharp, met hard: a hole goes soft in minutes, a tear in seconds; the pump puts the air back', () => {
  const S = DM.MODES.standard, mat = DM.MATERIALS.aluminium;
  const D = DM.newDamage(true);
  // Another boat's side, or a quay met gently: it bounces.
  assert.equal(DM.knock(D, mat, { chamber: 0, vn: 6, surface: 'boat' }, S), null);
  assert.equal(DM.knock(D, mat, { chamber: 0, vn: 3, surface: 'pier' }, S), null);
  // Rock at a few metres a second: a hole. Harder: torn.
  const r = DM.knock(D, mat, { chamber: 1, vn: 3.2, surface: 'rock' }, S);
  assert.ok(r?.punctured && !r.torn);
  assert.ok(DM.knock(D, mat, { chamber: 2, vn: 7, surface: 'rock' }, S)?.torn);
  // On Relaxed, never.
  assert.equal(DM.knock(DM.newDamage(true), mat, { chamber: 1, vn: 12, surface: 'rock' }, DM.MODES.relaxed), null);
  // The air going: soft after a few minutes from a hole, half a minute from a tear.
  const soft = (leak) => {
    const T = DM.newDamage(true);
    T.tubes[0].leak = leak;
    let s = 0;
    while (T.tubes[0].air >= 0.55 && s < 3600) { DM.stepTubes(T, 1); s++; }
    return s;
  };
  const hole = soft(DM.TUBE.leak), tear = soft(DM.TUBE.torn);
  assert.ok(hole > 90 && hole < 400, `a hole: soft in ${hole} s`);
  assert.ok(tear < 40, `a tear: soft in ${tear} s`);
  // Firm until it's well down, then it slumps.
  assert.equal(DM.firmness(1), 1);
  assert.ok(DM.firmness(0.6) > 0.9 && DM.firmness(0.1) < 0.1 && DM.firmness(0) === 0);
  // The foot pump: flat to firm in under a minute's pumping.
  const P = DM.newDamage(true);
  P.tubes[3].air = 0;
  for (let s = 0; s < 45; s++) DM.pump(P, 1);
  assert.equal(P.tubes[3].air, 1);
});

test('the record is kept in the save, cleaned; a sound boat writes nothing; the yard’s bill, and its work', () => {
  const D = DM.newDamage(true);
  assert.equal(DM.damageSave(D), null);
  assert.ok(DM.sound(D));
  D.hull.bottom = 0.4321;
  D.tubes[2].air = 0.3;
  D.tubes[2].leak = DM.TUBE.leak;
  const saved = DM.damageSave(D);
  assert.deepEqual(saved.hull, { bottom: 0.432 });
  assert.equal(DM.cleanDamage(saved, true).tubes[2].air, 0.3);
  // Junk: sound. A boat that isn't one: dropped.
  assert.deepEqual(DM.cleanDamage({ hull: { bow: 'x', port: 9 }, tubes: 'no' }, true).hull, { bow: 0, port: 1, stbd: 0, stern: 0, bottom: 0 });
  const all = DM.cleanDamages({ rib: saved, zeppelin: saved, row: null }, ['rib', 'row']);
  assert.deepEqual(Object.keys(all), ['rib']);
  // Through the whole save.
  const s = sanitize({ damage: { rib: saved, console: { hull: { bow: 0.5 } }, bogus: { hull: { bow: 1 } } } });
  assert.deepEqual(Object.keys(s.damage).sort(), ['console', 'rib']);
  assert.deepEqual(sanitize({}).damage, {});
  // The bill: a job for each part that's hurt, worse costing more, a patch for a holed tube.
  const bill = DM.repairs(D, 'rib', 1200);
  assert.deepEqual(bill.map((r) => r.id), ['hull:bottom', 'tube:2']);
  assert.ok(bill.every((r) => r.price > 0 && Number.isInteger(r.price)));
  const worse = DM.newDamage(true);
  worse.hull.bottom = 0.9;
  assert.ok(DM.repairs(worse, 'rib', 1200)[0].price > bill[0].price);
  // Done one job at a time, or all of it.
  DM.mend(D, 'tube:2');
  assert.equal(D.tubes[2].air, 1);
  assert.equal(D.tubes[2].leak, 0);
  DM.mend(D, 'all');
  assert.ok(DM.sound(D));
});

// Afloat in still water out in the bay, settled: her heel and trim (degrees) and her height.
const afloat = (prep) => {
  const b = new Boat(scene, { kind: 'rib' });
  b.place(300, 900, 0);
  prep?.(b);
  for (let i = 0; i < 360; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  return { roll: (b.roll * 180) / Math.PI, pitch: (b.pitch * 180) / Math.PI, y: b.phys.x[1], b };
};

test('a RIB with a chamber flat sits lower on that side; firm, she floats exactly as a boat with no record kept', () => {
  const none = afloat(), firm = afloat((b) => { b.damage = DM.newDamage(true); });
  assert.equal(firm.roll, none.roll);
  assert.equal(firm.pitch, none.pitch);
  assert.equal(firm.y, none.y);
  // The aft chambers are in the water lying still: one flat, she lists to it and sits lower.
  const port = afloat((b) => { b.damage = DM.newDamage(true); b.damage.tubes[0].air = 0; });
  const stbd = afloat((b) => { b.damage = DM.newDamage(true); b.damage.tubes[2].air = 0; });
  assert.ok(Math.abs(port.roll - none.roll) > 0.6, `port aft flat: ${port.roll.toFixed(2)}°`);
  assert.ok(Math.sign(port.roll - none.roll) === -Math.sign(stbd.roll - none.roll), 'each to its own side');
  assert.ok(port.y < none.y && stbd.y < none.y);
  // (And only a few degrees: the other chambers and her hull hold her up.)
  assert.ok(Math.abs(port.roll) < 4 && Math.abs(stbd.roll) < 4);
  // Drawn so: the flat chamber's tube slumps; patched, it's as built.
  const T = port.b.tubeMesh, base = T.geometry.userData.base, P = T.geometry.attributes.position.array;
  let moved = 0;
  for (let i = 0; i < P.length; i += 3) if (Math.abs(P[i + 1] - base[i + 1]) > 0.02) moved++;
  assert.ok(moved > 50, `${moved} vertices slumped`);
  DM.mend(port.b.damage, 'all');
  port.b.sagTubes();
  for (let i = 0; i < P.length; i++) assert.equal(P[i], base[i]);
});

// A boat driven ahead at `lever` from (x0, z0) on `heading` for `secs`, her damage kept: what it did.
const drive = (kind, x0, z0, heading, lever, secs, difficulty = 'standard') => {
  const b = new Boat(scene, { kind });
  b.place(x0, z0, heading);
  const E = (b.engine = newEngine(kind));
  for (const e of E?.engines || []) e.run = true;
  b.damage = DM.newDamage(DM.TUBED.has(kind));
  b.damageMode = DM.MODES[difficulty];
  const events = [];
  b.onDamage = (bt, r, ev) => events.push({ r, ev });
  for (let i = 0; i < secs * 30; i++) {
    b.motor = true;
    b.lever = lever;
    b.update(1 / 30, i / 30, lever, 0, 0);
  }
  return { b, D: b.damage, events };
};

test('driven into the jetty: nudged, nothing; at a run, her bow is hurt, and harder worse', () => {
  // (The jetty runs north and south at x 2.75 … 5.25; she comes at it from the east.)
  const nudge = drive('console', 55, 0, -Math.PI / 2, 0.05, 16);
  assert.ok(DM.sound(nudge.D), JSON.stringify(nudge.D.hull));
  const run = drive('console', 55, 0, -Math.PI / 2, 0.3, 16), hard = drive('console', 55, 0, -Math.PI / 2, 0.6, 16);
  assert.ok(run.D.hull.bow > 0.2, `at a run: ${run.D.hull.bow}`);
  assert.ok(hard.D.hull.bow > run.D.hull.bow);
  assert.equal(run.events[0].ev.surface, 'pier');
});

test('onto sand at full speed: no harm to her hull; into a rock stack, her bow stove and a tube punctured; on Relaxed, scuffs only', () => {
  // (Off the strand the bottom shoals to a foot of sand; the RIB runs up it flat out.)
  const sand = drive('rib', 200, 21, -Math.PI / 2, 1, 14);
  assert.ok(DM.SECTIONS.every((s) => sand.D.hull[s] === 0), JSON.stringify(sand.D.hull));
  // (The big stack south of the island, from seventy metres off.)
  const rock = drive('rib', -58, 40, 0, 0.5, 16);
  assert.ok(rock.D.hull.bow > 0.5, JSON.stringify(rock.D.hull));
  assert.ok(rock.D.tubes.some((c) => c.leak > 0), 'a tube punctured');
  assert.ok(rock.events.every(({ ev }) => ev.surface === 'rock'));
  const relaxed = drive('rib', -58, 40, 0, 0.5, 16, 'relaxed');
  assert.ok(DM.SECTIONS.every((s) => relaxed.D.hull[s] <= DM.MODES.relaxed.cap));
  assert.ok(relaxed.D.tubes.every((c) => c.leak === 0));
  // A gouged bottom roughens the water: her resistance is up, by no more than a tenth or so.
  assert.ok(rock.b.phys.rough > 1 && rock.b.phys.rough < 1.15);
});
