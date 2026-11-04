// Willowhaven's marina, lived in (townsfolk.js, world/folk.js): Wenna the harbourmaster's day,
// the locals' boats on their berths, the Sea Wren's morning out with a party, the Halcyon calling
// at the visitors' pontoon, and the kayaks round the west of the bay. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const F = await import('../src/townsfolk.js');
const T = await import('../src/world/terrain.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');
const { FolkView } = await import('../src/world/folk.js');
const { capsule, gap } = await import('../src/world/skipper.js');
const { wakes } = await import('../src/world/wakes.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const FAIR = { storm: 0, rain: 0, wind: 5, season: 'summer', about: [], activity: {} };
const inPier = (x, z, m = 0) => T.PIERS.some((P) => x > P.x0 - m && x < P.x1 + m && z > P.z0 - m && z < P.z1 + m);

test('Wenna the harbourmaster: in the office by day, down at the gangway twice, lunch at the inn, a word for you', () => {
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  const at = (h) => town.update(5 * 24 + h, FAIR) || town.people.wenna;
  assert.equal(at(9).block.spot, 'office');
  assert.equal(at(9).act, 'inside');
  assert.equal(at(10.3).block.spot, 'gangway');
  assert.equal(at(12.8).block.spot, 'innTableE');
  assert.equal(at(16.3).block.spot, 'gangway');
  assert.equal(at(19.8).block.spot, 'bench');
  assert.equal(at(23).block.spot, 'innUp');
  const p = at(16.4);
  assert.match(F.sayTo(p, { hour: 16.4 }), /finger with your name/);
});

test('the locals’ boats lie on their berths at the pontoon: alongside, clear of each other and of your finger, in deep water', () => {
  const placed = [];
  const SIZE = { cabin: [6.2, 1.0], skiff: [3.8, 0.8], sail: [4.9, 0.84], cruiser: [9.2, 1.5], console: [7.4, 1.25] };
  const all = [...Object.entries(F.LOCAL_BOATS).map(([id, L]) => ({ id, kind: L.kind, at: L.at })), { id: 'wren', kind: 'console', at: F.CHARTER.mooring }, { id: 'halcyon', kind: 'cruiser', at: F.CALLER.berth }];
  for (const b of all) {
    const [L, B] = SIZE[b.kind];
    for (const u of [-0.4, 0, 0.4]) {
      const x = b.at.x + Math.sin(b.at.heading) * u * L, z = b.at.z + Math.cos(b.at.heading) * u * L;
      assert.ok(T.solidHeight(x, z) < -1.2, `${b.id}: deep enough`);
      assert.ok(!inPier(x, z), `${b.id}: not on a pier`);
    }
    // Not on your finger (that's yours), and not overlapping each other.
    const F2 = T.OWN_FINGER;
    assert.ok(!(b.at.x > F2.x0 - 1 && b.at.x < F2.x1 + 1 && b.at.z > F2.z0 - 4 && b.at.z < F2.z1 + 4), `${b.id} keeps off your finger`);
    for (const o of placed) assert.ok(gap(capsule(b.at.x, b.at.z, b.at.heading, L, B, 0), capsule(o.at.x, o.at.z, o.at.heading, o.L, o.B, 0)).d > 0.3, `${b.id} clear of ${o.id}`);
    placed.push({ ...b, L, B });
  }
});

// A day of the marina's boats, drawn, with their skippers: never across a pier or into another.
function watch(fromH, toH, ids) {
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(5 * 24 + fromH - 2, FAIR);
  const dt = 1 / 15;
  let h = fromH, t = 0, closest = Infinity, onPier = null;
  const seen = new Set();
  while (h < toH) {
    h += dt / F.HOUR_SECONDS;
    t += dt;
    town.update(5 * 24 + h, FAIR);
    view.update(dt, t, town, { from: { x: 15, z: -60 } });
    for (const id of ids) {
      const B = town.boats[id], k = view.skippers[id];
      if (!B.present || !k.on) continue;
      seen.add(`${id}:${B.leg}`);
      // (Her middle and her ends never over a pier's deck, except lying right alongside one.)
      for (const u of [-0.4, 0, 0.4]) {
        const x = k.x + Math.sin(k.heading) * u * k.L, z = k.z + Math.cos(k.heading) * u * k.L;
        if (inPier(x, z, -0.05) && !onPier) onPier = `${id} at ${x.toFixed(1)}, ${z.toFixed(1)} (${B.leg}, ${h.toFixed(2)} h)`;
      }
      for (const [oid, o] of Object.entries(view.skippers)) {
        if (oid === id || !o.on || !town.boats[oid].present) continue;
        closest = Math.min(closest, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(o.x, o.z, o.heading, o.L, o.B, 0)).d);
      }
    }
  }
  for (const b of Object.values(view.boats)) wakes.forget(b);
  return { closest, onPier, seen, view, town };
}

test('the Sea Wren goes out astern off her berth with a party, fishes off Gull Rock and comes home bow first, touching nothing', () => {
  let day = 1;
  while (!(seeded(day * 7919 + 51)() < F.CHARTER.chance)) day++;
  assert.ok(F.CHARTER_HOURS > 3 && F.CHARTER_HOURS < 8);
  // (Her route in water deep enough for her, clear of the pontoon but for her own berth.)
  for (const R of [F.CHARTER.route, F.CHARTER.drift]) {
    const L = F.pathLength(R);
    for (let s = 0; s <= L; s += 1) {
      const q = F.along(R, s);
      assert.ok(T.heightAt(q.x, q.z) < -1.5, `aground at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    }
  }
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(day * 24 + 8.5, FAIR);
  town.update(day * 24 + 9.5, FAIR);
  assert.ok(town.boats.wren.aboard && ['back', 'go'].includes(town.boats.wren.leg), 'out of a fair morning');
  assert.ok(town.news(9.5).some((l) => l.includes('Sea Wren')));
});

test('the drawn boats of the marina come and go without crossing a pier or touching each other', () => {
  // The Sea Wren's way out (astern off her berth, then away), on a day she goes.
  let day = 1;
  while (!(seeded(day * 7919 + 51)() < F.CHARTER.chance)) day++;
  const scene = new THREE.Scene();
  const view = new FolkView(scene);
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(day * 24 + 8.8, FAIR);
  const dt = 1 / 15;
  let h = 8.8, t = 0, closest = Infinity, onPier = null, outAt = null;
  while (h < 10.4) {
    h += dt / F.HOUR_SECONDS;
    t += dt;
    town.update(day * 24 + h, FAIR);
    view.update(dt, t, town, { from: { x: 15, z: -60 } });
    const k = view.skippers.wren;
    if (!k.on) continue;
    for (const u of [-0.4, 0, 0.4]) {
      const x = k.x + Math.sin(k.heading) * u * k.L, z = k.z + Math.cos(k.heading) * u * k.L;
      if (inPier(x, z, -0.05) && !onPier) onPier = `${x.toFixed(1)}, ${z.toFixed(1)} at ${h.toFixed(2)} h (${town.boats.wren.leg})`;
    }
    for (const [oid, o] of Object.entries(view.skippers)) {
      if (oid === 'wren' || !o.on || !town.boats[oid].present) continue;
      closest = Math.min(closest, gap(capsule(k.x, k.z, k.heading, k.L, k.B, 0), capsule(o.x, o.z, o.heading, o.L, o.B, 0)).d);
    }
    if (outAt == null && k.x > 30) outAt = h;
  }
  assert.equal(onPier, null, `never over a pier (${onPier})`);
  assert.ok(closest > 0.2, `clear of the moored boats (${closest.toFixed(2)} m)`);
  assert.ok(outAt != null, 'out past the end of the fingers');
  // The locals' boats lie tied up, their lines out.
  assert.ok(view.boats.bluebell.group.visible && view.boats.bluebell.tie, 'the Bluebell tied up');
  for (const b of Object.values(view.boats)) wakes.forget(b);
});

test('the Halcyon calls at the visitors’ pontoon: in alongside the end row, lies there the night, astern off and away next morning', () => {
  let day = 1;
  while (!(seeded(day * 7919 + 61)() < F.CALLER.chance)) day++;
  const L = F.pathLength(F.CALLER.route);
  for (let s = 0; s <= L; s += 1) {
    const q = F.along(F.CALLER.route, s);
    assert.ok(T.heightAt(q.x, q.z) < -2, `aground at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    assert.ok(!inPier(q.x, q.z, 1.6), `across a pier at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
  }
  assert.ok(T.VISITOR_FINGERS.some((V) => Math.abs(F.CALLER.berth.z - (V.z1 + 1.75)) < 0.01 && F.CALLER.berth.x > V.x0 && F.CALLER.berth.x < V.x1), 'alongside the visitors’ row');
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(day * 24 + 15, FAIR);
  town.update(day * 24 + 16, FAIR);
  assert.equal(town.boats.halcyon.leg, 'in');
  town.update(day * 24 + 21, FAIR);
  assert.equal(town.boats.halcyon.leg, 'berthed');
  assert.ok(town.news(21).some((l) => l.includes('Halcyon')));
  town.update((day + 1) * 24 + 9.5, FAIR);
  assert.equal(town.boats.halcyon.leg, 'out');
  assert.equal(town.boats.halcyon.heading, F.CALLER.berth.heading, 'astern off, her bow where it was');
  town.update((day + 1) * 24 + 13, FAIR);
  assert.ok(!town.boats.halcyon.present, 'gone on round the coast');
});

test('the kayaks paddle round the west of the bay on a fine summer afternoon, clear of the pontoon; not in winter', () => {
  const L = F.pathLength(F.PADDLE.loop);
  for (let s = 0; s <= L; s += 1) {
    const q = F.along(F.PADDLE.loop, s);
    assert.ok(T.heightAt(q.x, q.z) < -0.4, `aground at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
    assert.ok(!inPier(q.x, q.z, 3), `by the pontoon at ${q.x.toFixed(0)}, ${q.z.toFixed(0)}`);
  }
  let day = 1;
  while (!(seeded(day * 7919 + 71)() < F.PADDLE.chance)) day++;
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(day * 24 + 15.2, FAIR);
  assert.ok(town.boats.kay1.present && town.boats.kay2.present, 'two kayaks out');
  assert.ok(Math.hypot(town.boats.kay1.x - town.boats.kay2.x, town.boats.kay1.z - town.boats.kay2.z) > 2, 'one behind the other');
  const winter = new F.Townsfolk({ obstacles: coast.obstacles });
  winter.update(day * 24 + 15.2, { ...FAIR, season: 'winter' });
  assert.ok(!winter.boats.kay1.present, 'not in winter');
});
