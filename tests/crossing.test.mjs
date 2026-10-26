// The crossing to Las Brasas (crossing.js): one sea from home to the island, deep the whole way;
// boats that can sail or motor across it at the helm in about twenty to thirty minutes, the wind
// coming round into the trade as they go; what's met along the way, the same for the same day;
// the fast passage taking the same hours and fuel; and a crossing kept in the save mid-ocean. Run
// with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const X = await import('../src/crossing.js');
const T = await import('../src/world/terrain.js');
const B = await import('../src/world/brasa.js');
const C = await import('../src/world/conditions.js');
const S = await import('../src/sailing.js');
const F = await import('../src/fuel.js');
const { Boat } = await import('../src/boat.js');
const { sanitize } = await import('../src/save.js');
const { noteCrossing, closeDay, dayText } = await import('../src/daybook.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { OCEAN_SHEET } = await import('../src/map.js');

const scene = new THREE.Scene();

test('one sea from home to the island: deep water all the way, in the world, and charted', () => {
  assert.ok(X.CROSS_M > 4000 && X.CROSS_M < 5200, `${X.CROSS_M.toFixed(0)} m of open sea`);
  for (let k = 0; k <= 60; k++) {
    const f = k / 60, x = X.ENDS.home.x + (X.ENDS.south.x - X.ENDS.home.x) * f, z = X.ENDS.home.z + (X.ENDS.south.z - X.ENDS.home.z) * f;
    assert.ok(T.heightAt(x, z) < -20, `deep at ${z.toFixed(0)}`);
    assert.ok(T.inWorld(x, z) && T.inSeas(x, z), `in the world and its sea at ${z.toFixed(0)}`);
  }
  // From the far end round the point to the harbour, still water a boat floats in.
  for (const p of [X.ROUND, X.HARBOUR]) assert.ok(T.heightAt(p.x, p.z) < -3);
  // The open sea's chart covers it, coast to coast.
  assert.ok(OCEAN_SHEET.z < X.ENDS.home.z && OCEAN_SHEET.z + OCEAN_SHEET.h > X.ENDS.south.z);
  // The way: across, round the point, into the harbour.
  assert.equal(X.steerFor('south', 0, 2000).name, 'Las Brasas');
  assert.equal(X.steerFor('south', 600, 5500).name, 'Punta del Faro');
  assert.equal(X.steerFor('south', 600, 6100).name, 'Puerto Brasa');
  assert.equal(X.steerFor('home', 0, 3000).name, 'Gannet Light');
  assert.equal(X.pointWords(X.bearingTo(0, 0, 0, 100)), 'south');
  assert.equal(X.pointWords(X.bearingTo(0, 0, 100, -100)), 'north-east');
});

test('the open sea joins the two: no edge current along the crossing, only to either side of it', () => {
  const b = new Boat(scene, { kind: 'cruiser' });
  b.place(0, 2600, Math.PI);
  for (let i = 0; i < 60; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  assert.ok(Math.hypot(b.vel.x, b.vel.z) < 0.6, `drifting gently, ${Math.hypot(b.vel.x, b.vel.z).toFixed(2)} m/s`);
  // Out past the side of it, the current eases you back.
  const o = new Boat(scene, { kind: 'cruiser' });
  o.place(T.CROSSING.x1 + 60, 2600, 0);
  for (let i = 0; i < 60; i++) o.update(1 / 30, i / 30, 0, 0, 0);
  assert.ok(o.vel.x < -1, 'eased back in');
});

// A helmsman: steering for where the crossing says, tacking when it's too close to the wind,
// the sail trimmed to the wind (or the lever down), the weather as the game keeps it.
function sail(kind, to, wind) {
  const cond = C.conditions;
  Object.assign(cond.wind, { from: wind.from, speed: wind.speed, target: wind.speed, timer: 1e9, turn: 0 });
  Object.assign(cond, { region: 'home', hour: 11, manual: null, preset: 'auto' });
  const b = new Boat(scene, { kind });
  const A = to === 'south' ? X.ENDS.home : X.ENDS.south, E = to === 'south' ? X.ENDS.south : X.ENDS.home;
  b.place(A.x, A.z, Math.atan2(E.x - A.x, E.z - A.z));
  if (kind === 'sail') b.setSail(true);
  const line = Math.atan2(E.x - A.x, E.z - A.z);
  const dt = 1 / 15, weather = { rain: 0, cloud: 0.3, storm: 0 };
  let t = 0, tack = null;
  while (t < 3600) {
    t += dt;
    cond.time = t;
    cond.trade = X.tradeAt(b.pos.z);
    cond.ocean = X.oceanAt(b.pos.z, true);
    cond.region = b.pos.z > B.SOUTH_Z ? 'south' : 'home';
    C.updateConditions(dt, weather);
    b.vmax = kind === 'sail' ? Infinity : X.seaKindly(X.oceanAt(b.pos.z, true), cond.sea.swell);
    const aim = X.steerFor(to, b.pos.x, b.pos.z);
    let want = Math.atan2(aim.x - b.pos.x, aim.z - b.pos.z);
    if (kind === 'sail') {
      const into = Math.atan2(Math.sin(cond.wind.from), -Math.cos(cond.wind.from));
      const off = Math.atan2(Math.sin(want - into), Math.cos(want - into));
      if (Math.abs(off) < 0.87) {
        tack ??= Math.sign(off) || 1;
        const cross = (b.pos.x - A.x) * Math.cos(line) - (b.pos.z - A.z) * Math.sin(line);
        if (Math.abs(cross) > 250 && Math.sign(cross) === tack) tack = -tack;
        want = into + tack * 0.87;
      }
      const w = C.windAt(b.pos.x, b.pos.z, t), ax = w.x - b.vel.x, az = w.z - b.vel.z, V = Math.hypot(ax, az) || 1;
      b.sheet = S.bestSheet(Math.acos(Math.max(-1, Math.min(1, -(ax * b.fwd.x + az * b.fwd.z) / V))));
    }
    const err = Math.atan2(Math.sin(want - b.heading), Math.cos(want - b.heading));
    b.update(dt, t, kind === 'sail' ? 0 : 1, Math.max(-1, Math.min(1, err * 2.5)), 0);
    if (X.arrived(to, b.pos.x, b.pos.z)) break;
  }
  return t / 60;
}

test('about twenty minutes across in the yacht, held to her seakindly speed in the swell; about half an hour in the sailing boat', () => {
  const yS = sail('cruiser', 'south', { from: 3.9, speed: 7 }), yH = sail('cruiser', 'home', { from: 0.8, speed: 9 });
  assert.ok(yS > 16 && yS < 24, `the yacht south: ${yS.toFixed(1)} min`);
  assert.ok(yH > 16 && yH < 24, `the yacht home: ${yH.toFixed(1)} min`);
  const sS = sail('sail', 'south', { from: 3.9, speed: 9.5 }), sH = sail('sail', 'home', { from: 0.8, speed: 9 });
  assert.ok(sS > 20 && sS < 32, `the sailing boat south in a fresh trade wind: ${sS.toFixed(1)} min`);
  assert.ok(sH > 20 && sH < 34, `the sailing boat home: ${sH.toFixed(1)} min`);
  // The fast passage takes the hours the helm would (a day and more by the clock), and the yacht
  // burns what she would.
  assert.ok(X.crossHours('sail') > 30 && X.crossHours('sail') < 45);
  assert.ok(X.crossHours('cruiser') > 25 && X.crossHours('cruiser') < X.crossHours('sail'));
  const burn = X.CROSS_FUEL(F.BOAT_PER_S.cruiser);
  assert.ok(burn > 40 && burn < 70 && burn < F.PASSAGE_FUEL, `${burn} L across; she must have ${F.PASSAGE_FUEL} L aboard`);
  // Out of the swell, nothing holds her back; in it, about six knots.
  assert.equal(X.seaKindly(0), Infinity);
  assert.ok(X.seaKindly(1, 0.4) > 2.5 && X.seaKindly(1, 0.4) < 3.3);
  assert.ok(X.seaKindly(1, 1.6) < X.seaKindly(1, 0.4), 'slower in a big sea');
  assert.ok(X.seaKindly(1, 0.4, true) < X.seaKindly(1, 0.4), 'slower again, eased');
  // Home's Blue Water and the island's are fished as they always were, unless you're crossing.
  assert.equal(X.oceanAt(1100), 0);
  assert.ok(X.oceanAt(1100, true) > 0.3);
  assert.equal(X.oceanAt(5200), 0);
});

test('the wind comes round into the trade through the north as you go south, and the sea breeze is the coast’s', () => {
  const cond = C.conditions;
  Object.assign(cond.wind, { from: 3.9, speed: 6, target: 6, timer: 1e9, turn: 0 });
  Object.assign(cond, { region: 'home', hour: 14, manual: null, trade: null, ocean: 0 });
  const weather = { rain: 0, cloud: 0, storm: 0 };
  const seen = [];
  for (let z = 1500; z <= 4500; z += 150) {
    cond.trade = X.tradeAt(z);
    cond.ocean = X.oceanAt(z, true);
    for (let i = 0; i < 1200; i++) C.updateConditions(1 / 20, weather);
    seen.push(cond.wind.from);
  }
  // From the south-west round by the west and the north to the north-east: never from the south.
  const deg = (a) => ((a * 180) / Math.PI + 360) % 360;
  assert.ok(Math.abs(deg(seen[seen.length - 1]) - 46) < 20, `the trade: ${deg(seen[seen.length - 1]).toFixed(0)}°`);
  assert.ok(seen.every((a) => deg(a) < 120 || deg(a) > 200), seen.map((a) => deg(a).toFixed(0)).join(' '));
  assert.equal(X.tradeAt(1200), 0);
  assert.equal(X.tradeAt(4200), 1);
  cond.trade = null;
  cond.ocean = 0;
});

test('what’s met along the way: the same for the same day, different another day, the warm-water ones in the south', () => {
  const a = X.planCrossing(12, 'south'), b = X.planCrossing(12, 'south'), c = X.planCrossing(13, 'south');
  assert.deepEqual(a, b);
  assert.notDeepEqual(a.map((e) => e.kind + e.z), c.map((e) => e.kind + e.z));
  let kinds = new Set();
  for (let d = 1; d < 40; d++) {
    for (const to of ['south', 'home']) {
      const plan = X.planCrossing(d, to);
      assert.ok(plan.length >= 4 && plan.length <= 5, `${plan.length} on day ${d}`);
      assert.ok(plan.some((e) => e.kind === 'dolphins' || e.kind === 'whale') && plan.some((e) => e.kind === 'boil'));
      for (const e of plan) {
        kinds.add(e.kind);
        if (X.ENCOUNTERS[e.kind].warm) assert.ok(e.z >= 3000, `${e.kind} in the warm water`);
        assert.ok(e.z > X.ENDS.home.z && e.z < X.ENDS.south.z);
      }
      for (let i = 1; i < plan.length; i++) {
        assert.ok(Math.abs(plan[i].z - plan[i - 1].z) > 420, 'quiet water between');
        assert.ok(to === 'south' ? plan[i].z > plan[i - 1].z : plan[i].z < plan[i - 1].z, 'in the order you meet them');
      }
    }
  }
  for (const k of Object.keys(X.ENCOUNTERS)) assert.ok(kinds.has(k), `${k} happens some days`);
});

test('fish to troll for out there: the crossing’s own, the same fish the finder and the hook find', () => {
  const eco = new Ecosystem(createHabitat());
  const out = eco.agents.filter((a) => a.home.crossing);
  const kinds = new Set(out.map((a) => a.sp.id));
  for (const k of ['sprat', 'tuna', 'mackerel', 'sardine', 'littletunny', 'dorado', 'yellowfin', 'albacore']) assert.ok(kinds.has(k), k);
  for (const a of out) {
    assert.ok(X.onCrossing(a.home.x, a.home.z), `${a.sp.id} out on the crossing`);
    assert.ok(a.sp.life.zones.includes(a.home.zone) && a.sp.life.homes.includes(a.home.type), `${a.sp.id} at home there`);
    assert.equal(!!a.home.south, a.home.z > B.SOUTH_Z);
  }
  // The dorado under the weed rafts.
  assert.ok(out.some((a) => a.sp.id === 'dorado' && a.home.weed));
});

test('a crossing kept in the save mid-ocean, the boat where you left her; and an older save has none', () => {
  const st = sanitize({ day: 8, hour: 14 });
  assert.equal(st.crossing, null);
  assert.deepEqual(st.passages, { south: 0, home: 0, fast: 0, best: {} });
  st.crossing = { to: 'south', kind: 'sail', day: 8, abs: 206, secs: 612.5, events: X.planCrossing(8, 'south'), weather: 'carry', eased: true, back: false };
  st.crossing.events[0].done = true;
  st.boats = { sail: { x: 120, z: 2900, heading: 3, sail: 0.6 } };
  st.passages = { south: 2, home: 1, fast: 3, best: { sail: 27.4, cruiser: 19.2 } };
  const back = sanitize(JSON.parse(JSON.stringify(st)));
  assert.deepEqual(back.crossing, st.crossing);
  assert.equal(back.boats.sail.z, 2900, 'her place out on the open sea kept');
  assert.deepEqual(back.passages, st.passages);
  // Junk is thrown out.
  assert.equal(sanitize({ crossing: { to: 'moon', kind: 'sail' } }).crossing, null);
  assert.equal(sanitize({ crossing: { to: 'south', kind: 'skiff' } }).crossing, null, 'only the boats fit for it');
  assert.equal(sanitize({ crossing: { to: 'south', kind: 'sail', events: [{ kind: 'kraken', z: 2000 }] } }).crossing.events.length, 0);
});

test('the crossing in the day book: setting out, landfall at the helm, the fast passage, turning back', () => {
  const st = sanitize({ day: 4, hour: 9 });
  noteCrossing(st.today, { to: 'south', stage: 'out', boat: 'sailing boat' });
  const p1 = closeDay(st, 5);
  assert.ok(p1, 'a day you set out is a page');
  assert.match(dayText(p1), /Set out across the open Atlantic for Las Brasas in the sailing boat\./);
  noteCrossing(st.today, { to: 'south', stage: 'in', boat: 'sailing boat', mins: 27.4 });
  assert.match(dayText(closeDay(st, 6)), /Made landfall at Las Brasas after the crossing: 27 minutes at the helm\./);
  noteCrossing(st.today, { to: 'home', stage: 'in', how: 'fast', boat: 'sport-fishing yacht' });
  noteCrossing(st.today, { to: 'south', stage: 'back', boat: 'sailing boat' });
  const p3 = closeDay(st, 7);
  assert.match(dayText(p3), /Made the passage home to Willow Bay in the sport-fishing yacht\./);
  assert.match(dayText(p3), /Turned back from the crossing to Las Brasas when the weather turned\./);
  // Through a save.
  const s2 = sanitize({ day: 9, days: [p3] });
  assert.deepEqual(s2.days[0].cross, p3.cross);
});
