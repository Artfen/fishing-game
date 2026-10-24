// Home & the garage: where your outing gear is (one record, nothing in two places), the car's
// boot, loadouts, the check before you leave, the save's new version, and the car itself driving
// the lanes to every car park without getting into trouble.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// The car and home models paint a few canvas textures: a stand-in canvas is enough here.
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const O = await import('../src/outing.js');
const { RODS, TACKLE, ROD_IDS, ITEM_IDS, PACK, SETUPS, defaultGear } = await import('../src/tackle.js');
const { CAR_PARKS, LANES, heightAt } = await import('../src/world/terrain.js');

const KEY = 'slow-tide-save';
let loads = 0;
const freshSave = () => import(`../src/save.js?out=${++loads}`);

// A game state with just what the outing rules look at.
function state({ camps = [], kit = 'home' } = {}) {
  const s = { gear: defaultGear(), camps, keep: [], fish: {}, places: {}, log: [], photos: [], keepsakes: {} };
  s.equip = O.defaultEquip(kit);
  return s;
}
const camp = (id = 'camp-test1', extra = {}) => ({ id, name: 'Test Camp', x: 101, z: 15, yaw: 0, store: { fish: [], meals: [] }, cooking: null, ...extra });

// Every piece of camping gear in exactly one place; rods and tackle never both carried and loaded.
function sound(s) {
  for (const k of O.KIT_IDS) assert.match(s.equip.kit[k], /^(home|car|pack|camp:.+)$/);
  for (const r of s.equip.car.rods) assert.ok(!s.gear.pack.rods.includes(r), `${r} is both carried and in the car`);
  for (const i of s.equip.car.items) assert.ok(!s.gear.pack.items.includes(i), `${i} is both carried and in the car`);
  assert.equal(new Set(s.equip.car.rods).size, s.equip.car.rods.length);
  assert.equal(new Set(s.equip.car.items).size, s.equip.car.items.length);
  assert.ok(s.equip.car.rods.length <= O.CAR_HOLD.rods && s.equip.car.items.length <= O.CAR_HOLD.items);
  assert.ok(s.gear.pack.rods.length >= 1 && s.gear.pack.rods.length <= PACK.rods && s.gear.pack.items.length <= PACK.items);
}

test('camping gear moves between the garage, the car and your backpack, never doubling or vanishing', () => {
  const s = state();
  for (const k of O.KIT_IDS) assert.equal(O.statusOf(s, 'kit', k).state, 'stored');
  assert.ok(O.moveKit(s, 'tent', 'car').ok);
  assert.ok(O.moveKit(s, 'stove', 'pack').ok);
  assert.equal(O.statusOf(s, 'kit', 'tent').state, 'loaded');
  assert.equal(O.statusOf(s, 'kit', 'stove').state, 'carried');
  assert.ok(O.moveKit(s, 'tent', 'tent-shelf').ok === false);
  sound(s);
  // Pitched: the tent stays with its camp; a cool box with fish in it waits to be emptied.
  const c = camp();
  s.camps = [c];
  s.equip.kit.tent = `camp:${c.id}`;
  s.equip.kit.coolbox = `camp:${c.id}`;
  c.store.fish.push({ id: 'pollack', size: 40, logId: null });
  assert.equal(O.moveKit(s, 'tent', 'pack').ok, false);
  assert.equal(O.moveKit(s, 'coolbox', 'pack').ok, false);
  c.store.fish.length = 0;
  assert.ok(O.moveKit(s, 'coolbox', 'pack').ok);
  sound(s);
});

test('the boot holds four rods and twelve tackle, and anything in it is out of your backpack', () => {
  const s = state();
  const spare = ROD_IDS.filter((r) => !s.gear.pack.rods.includes(r));
  for (const r of spare.slice(0, 4)) assert.ok(O.moveToCar(s, 'rod', r, true).ok);
  const fifth = O.moveToCar(s, 'rod', spare[4], true);
  assert.equal(fifth.ok, false);
  assert.match(fifth.why, /holds 4/);
  // A carried rod goes into the car out of the backpack (but you always keep one).
  s.equip.car.rods = [];
  const [a, b] = s.gear.pack.rods;
  assert.ok(O.moveToCar(s, 'rod', a, true).ok);
  assert.equal(s.gear.pack.rods.includes(a), false);
  assert.equal(O.moveToCar(s, 'rod', b, true).ok, false);
  sound(s);
  // Packing a setup takes its pieces out of the car.
  const coastal = SETUPS.find((x) => x.id === 'coastal');
  s.equip.car.rods = ['sea'];
  s.equip.car.items = ['metal', 'crab'];
  O.packSetup(s, coastal);
  assert.ok(s.gear.pack.rods.includes('sea'));
  assert.equal(s.equip.car.rods.includes('sea'), false);
  assert.equal(s.equip.car.items.includes('metal'), false);
  assert.ok(s.equip.car.items.includes('crab'));
  sound(s);
  // Unloading: everything back in the garage.
  s.equip.kit.tent = 'car';
  const u = O.unloadCar(s);
  assert.deepEqual(u.kit, ['tent']);
  assert.equal(s.equip.car.rods.length + s.equip.car.items.length, 0);
  assert.equal(s.equip.kit.tent, 'home');
});

test('hundreds of transfers in any order keep everything in one place', () => {
  const s = state();
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const pick = (xs) => xs[Math.floor(rnd() * xs.length)];
  for (let i = 0; i < 600; i++) {
    const op = Math.floor(rnd() * 6);
    if (op === 0) O.moveKit(s, pick(O.KIT_IDS), pick(['home', 'car', 'pack']));
    else if (op === 1) O.moveToCar(s, 'rod', pick(ROD_IDS), rnd() < 0.6);
    else if (op === 2) O.moveToCar(s, 'item', pick(ITEM_IDS), rnd() < 0.6);
    else if (op === 3) O.packSetup(s, pick(SETUPS));
    else if (op === 4) O.loadSetup(s, pick(SETUPS));
    else O.unloadCar(s);
    sound(s);
  }
});

test('a loadout names your gear and puts it back as it was; a pitched tent or an absent car is explained', () => {
  const s = state();
  O.packSetup(s, SETUPS.find((x) => x.id === 'reef'));
  O.loadSetup(s, SETUPS.find((x) => x.id === 'flatfish'));
  O.moveKit(s, 'tent', 'car');
  O.moveKit(s, 'stove', 'pack');
  const lo = O.cleanLoadout(O.snapshot(s, 'Reef trip'));
  assert.equal(lo.name, 'Reef trip');
  // Change everything, then restore.
  O.packSetup(s, SETUPS.find((x) => x.id === 'carp'));
  O.unloadCar(s);
  O.unpackKit(s);
  const r = O.applyLoadout(s, lo, { carHome: true });
  assert.deepEqual(r.notes, []);
  assert.deepEqual(s.gear.pack.rods, lo.pack.rods);
  assert.deepEqual(s.equip.car.items, lo.car.items);
  assert.equal(s.equip.kit.tent, 'car');
  assert.equal(s.equip.kit.stove, 'pack');
  sound(s);
  // The tent pitched at a camp, and the car away: both said, nothing forced.
  const c = camp();
  s.camps = [c];
  s.equip.kit.tent = `camp:${c.id}`;
  O.unloadCar(s);
  const r2 = O.applyLoadout(s, lo, { carHome: false });
  assert.ok(r2.notes.some((n) => /tent is at Test Camp/.test(n)));
  assert.ok(r2.notes.some((n) => /car isn’t here/.test(n)));
  assert.equal(s.equip.kit.tent, `camp:${c.id}`);
  sound(s);
  // A loadout from an old or edited save is cleaned, not trusted.
  assert.equal(O.cleanLoadout({ pack: { rods: ['nope'] } }), null);
  const junk = O.cleanLoadout({ name: '<b>x</b>', pack: { rods: ['sea', 'sea', 'float', 'boat'], items: ['metal', 'x'] }, car: { rods: ['sea', 'fly'], items: ['metal'] }, kit: { tent: 'moon' } });
  assert.deepEqual(junk.pack.rods, ['sea', 'float']);
  assert.deepEqual(junk.car.rods, ['fly']);
  assert.deepEqual(junk.car.items, []);
  assert.equal(junk.kit.tent, 'home');
});

test('the check before you leave says what’s missing without ever stopping you', () => {
  const s = state();
  const plan = { ...O.defaultPlan(), dest: 'strand', camp: true, target: { sp: 'seabass' } };
  // The tent still at home: a warning (camping), and the essentials put it in the car.
  let lines = O.departureCheck(s, plan, { carHome: true, campDest: () => null });
  assert.ok(lines.some((l) => l.level === 'warn' && /tent is still in the garage/.test(l.text)));
  assert.ok(!('blocked' in lines));
  const changes = O.essentials(s, plan, { carHome: true, campDest: () => null });
  assert.ok(changes.some((c) => /tent/.test(c)));
  lines = O.departureCheck(s, plan, { carHome: true, campDest: () => null });
  assert.equal(lines.filter((l) => l.level === 'warn').length, 0, JSON.stringify(lines));
  sound(s);
  // Already pitched at the destination: no need to take it.
  const c = camp();
  s.camps = [c];
  s.equip.kit.tent = `camp:${c.id}`;
  lines = O.departureCheck(s, plan, { carHome: true, campDest: () => 'strand' });
  assert.ok(lines.some((l) => l.level === 'ok' && /already pitched/.test(l.text)));
  lines = O.departureCheck(s, { ...plan, dest: 'haven' }, { carHome: true, campDest: () => 'strand' });
  assert.ok(lines.some((l) => l.level === 'warn' && /pitched at Test Camp/.test(l.text)));
  // A rod with nothing to fish with, and fresh-water bait for the sea.
  s.gear.pack.rods = ['float', 'fly'];
  s.gear.pack.items = ['corn', 'maggot'];
  lines = O.departureCheck(s, { ...O.defaultPlan(), dest: 'strand' }, { carHome: true });
  assert.ok(lines.some((l) => /fly rod has nothing to fish with/.test(l.text)));
  assert.ok(lines.some((l) => /for fresh water/.test(l.text)));
  // Just a walk: no tackle at all is fine (a note, not a warning).
  s.gear.pack.items = [];
  lines = O.departureCheck(s, { ...O.defaultPlan(), fish: false, explore: true, dest: 'head' }, { carHome: true });
  assert.equal(lines.filter((l) => l.level === 'warn').length, 0, JSON.stringify(lines));
});

test('suggestions come from the field guide’s own recommendations and the place’s water', () => {
  const s = state();
  const sea = O.suggestions(s, { ...O.defaultPlan(), dest: 'head', target: { sp: 'seabass' } });
  assert.ok(sea.length);
  assert.ok(sea[0].rods.some((r) => ['sea', 'boat'].includes(r)), sea[0].name);
  const lake = O.suggestions(s, { ...O.defaultPlan(), dest: 'boathouse' });
  assert.ok(lake[0].items.every((i) => TACKLE[i].water !== 'salt'), lake[0].name);
});

test('saves move to version 6 with your camping kit exactly where it was, and the car on the drive', async () => {
  const env = (version, data) => ({ game: 'slow-tide', version, savedAt: 1000, data });
  // A camp pitched: the tent, stove and cool box stay at it.
  localStorage.setItem(KEY, JSON.stringify(env(5, { day: 4, camps: [{ id: 'camp-abc1', name: 'Sanderling Camp', x: 101, z: 15, yaw: 0 }], log: [] })));
  let S = await freshSave();
  let { state: st } = S.loadGame();
  assert.equal(st.version ?? 6, 6);
  for (const k of O.KIT_IDS) assert.equal(st.equip.kit[k], 'camp:camp-abc1');
  assert.equal(st.car.at, 'home');
  assert.equal(st.camps[0].name, 'Sanderling Camp');
  assert.equal(st.outing.intro, false);
  // No camp: the kit was rolled up in your backpack, and stays there.
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify(env(5, { day: 2, camps: [] })));
  S = await freshSave();
  st = S.loadGame().state;
  for (const k of O.KIT_IDS) assert.equal(st.equip.kit[k], 'pack');
  // A new game: everything in the garage at home.
  globalThis.localStorage = new MemoryStorage();
  S = await freshSave();
  st = S.loadGame().state;
  for (const k of O.KIT_IDS) assert.equal(st.equip.kit[k], 'home');
  assert.deepEqual([st.car.x, st.car.z], [CAR_PARKS.home.x, CAR_PARKS.home.z]);
  // Junk is cleaned: gear at a camp that's gone comes home; the car never holds what you carry.
  globalThis.localStorage = new MemoryStorage();
  localStorage.setItem(KEY, JSON.stringify(env(6, {
    gear: { pack: { rods: ['sea', 'float'], items: ['metal'] }, rod: 'sea' },
    equip: { kit: { tent: 'camp:camp-gone', stove: 'moon', coolbox: 'car' }, car: { rods: ['sea', 'boat', 'boat', 'zzz'], items: ['metal', 'crab'] } },
    car: { x: 'x' }, outing: { plan: { dest: 'nowhere', target: { sp: 'nessie' } }, travel: { to: 'strand' } },
  })));
  S = await freshSave();
  st = S.loadGame().state;
  assert.equal(st.equip.kit.tent, 'home');
  assert.equal(st.equip.kit.stove, 'home');
  assert.equal(st.equip.kit.coolbox, 'car');
  assert.deepEqual(st.equip.car.rods, ['boat']);
  assert.deepEqual(st.equip.car.items, ['crab']);
  assert.equal(st.car.at, 'home');
  assert.equal(st.outing.plan.dest, null);
  assert.equal(st.outing.plan.target, null);
  assert.equal(st.outing.travel.to, 'strand'); // (finished on the next load: see main.js)
  // A round trip keeps it all.
  st.equip.kit.tent = 'car';
  st.outing.loadouts.push(O.snapshot(st, 'Mine'));
  S.saveGame(st);
  const again = (await freshSave()).loadGame().state;
  assert.equal(again.equip.kit.tent, 'car');
  assert.equal(again.outing.loadouts[0].name, 'Mine');
});

/* ---------------- the car on the lanes ---------------- */

const THREE = await import('three');
const { Car } = await import('../src/car.js');
const { buildHome } = await import('../src/world/home.js');
const { seeded } = await import('../src/util.js');
const scene = new THREE.Scene();
const home = buildHome(scene, seeded(20261101));
// The things a car can hit near the lanes: home's walls and garden, as the world has them.
const solids = {
  near(x, z, pad, out = []) {
    out.length = 0;
    for (const o of home.obstacles) if ((x - o.x) ** 2 + (z - o.z) ** 2 < (o.r + pad) ** 2) out.push(o);
    return out;
  },
};

test('every car park is level, dry and clear for the car', () => {
  const car = new Car(scene);
  for (const [id, p] of Object.entries(CAR_PARKS)) {
    assert.equal(car.blocked(p.x, p.z, p.yaw, solids), null, id);
    assert.ok(heightAt(p.x, p.z) > 0.8, id);
  }
});

test('the lanes are drivable end to end: no step, no steep pitch, no water', () => {
  const car = new Car(scene);
  for (const [n, L] of LANES.entries()) {
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az);
      const yaw = Math.atan2(bx - ax, bz - az);
      for (let s = 0; s <= len; s += 0.5) {
        const x = ax + (bx - ax) * (s / len), z = az + (bz - az) * (s / len);
        const g = car.ground(x, z, yaw);
        assert.ok(g.steep <= 1, `lane ${n} too steep at ${x.toFixed(1)}, ${z.toFixed(1)} (${g.steep.toFixed(2)})`);
        assert.ok(g.low > 0.35, `lane ${n} at the water at ${x.toFixed(1)}, ${z.toFixed(1)}`);
      }
    }
  }
});

// Drive with the controls a player has (throttle, steer, brake), following the route as a line
// (a point a few metres ahead on it), the way you'd follow the gravel.
function drive(car, route, { limit = 4000 } = {}) {
  const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
  // The route's points every half metre.
  const pts = [];
  for (let i = 0; i < route.length - 1; i++) {
    const [ax, az] = route[i], [bx, bz] = route[i + 1], n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.5));
    for (let k = 0; k < n; k++) pts.push([ax + ((bx - ax) * k) / n, az + ((bz - az) * k) / n]);
  }
  pts.push(route[route.length - 1]);
  let at = 0, reverse = 0, revSteer = 0, reverses = 0, wp = 0;
  for (let i = 0; i < limit; i++) {
    // Where you are along it (looking a little way on from last time), and a point 4 m ahead.
    let best = at, bd = Infinity;
    for (let k = at; k < Math.min(pts.length, at + 40); k++) {
      const d = Math.hypot(pts[k][0] - car.pos.x, pts[k][1] - car.pos.z);
      if (d < bd) { bd = d; best = k; }
    }
    at = best;
    const end = pts[pts.length - 1], dEnd = Math.hypot(end[0] - car.pos.x, end[1] - car.pos.z);
    if (dEnd < 1.6 || (at >= pts.length - 2 && dEnd < 3)) { wp = route.length; break; }
    const [tx, tz] = pts[Math.min(pts.length - 1, at + 8)], d = Math.hypot(tx - car.pos.x, tz - car.pos.z);
    const last = at + 8 >= pts.length - 1;
    const diff = wrap(Math.atan2(tx - car.pos.x, tz - car.pos.z) - car.heading);
    let ctl;
    if (reverse > 0) {
      reverse -= 1 / 30;
      ctl = { throttle: car.speed > -2 ? -1 : 0, steer: revSteer, brake: 0 };
      // (Backed into something too: forward again.)
      if (car.stuckT > 0.4) { reverse = 0; car.stuckT = 0; }
    } else {
      const want = last && dEnd < 12 ? 2.5 : Math.abs(diff) > 0.5 ? 2.5 : 8;
      ctl = { throttle: car.speed < want ? 1 : 0, steer: diff > 0.06 ? 1 : diff < -0.06 ? -1 : 0, brake: car.speed > want + 1.2 ? 1 : 0 };
      if (car.stuckT > 0.6) { reverse = 1.4; revSteer = -Math.sign(diff) || 1; reverses++; car.stuckT = 0; }
    }
    car.update(1 / 30, i / 30, ctl, solids, { live: true });
    assert.ok(heightAt(car.pos.x, car.pos.z) > 0.3, `the car reached the water at ${car.pos.x.toFixed(1)}, ${car.pos.z.toFixed(1)}`);
  }
  return { arrived: wp >= route.length, reverses };
}

test('from the drive at home, the car reaches Shell Strand, Willowhaven and Cove Head, and comes home', () => {
  const car = new Car(scene);
  const H = CAR_PARKS.home;
  const down = [[131.5, -58], [137.5, -57], [141.2, -54.2], [142.4, -50.6], [142, -47.6]];
  const routes = {
    strand: [...down, [136, -49], [118, -49], [108, -49.5], [100, -48], [98.5, -38], [98, -32], [99, -14], [100, -7]],
    haven: [...down, [136, -49], [118, -49], [100, -50], [84, -57], [70, -70], [55, -84], [42, -91], [36, -91.5]],
    head: [...down, [150, -45.5], [157, -41.5]],
  };
  for (const [id, route] of Object.entries(routes)) {
    car.place(H.x, H.z, H.yaw);
    const r = drive(car, route);
    assert.ok(r.arrived, `didn't reach ${id} (stopped at ${car.pos.x.toFixed(1)}, ${car.pos.z.toFixed(1)})`);
    assert.equal(O.parkNear(car.pos.x, car.pos.z, 9), id);
    // And back up the lane to the drive (round the car park first, the way you'd turn there).
    const turn = { haven: [[31.5, -93.5], [34, -97], [39, -97], [42, -93.5]], strand: [], head: [] }[id];
    const back = [...turn, ...[...route].reverse().slice(1)].concat([[131, -60], [H.x, H.z]]);
    const b = drive(car, back);
    assert.ok(b.arrived, `didn't get home from ${id} (stopped at ${car.pos.x.toFixed(1)}, ${car.pos.z.toFixed(1)})`);
  }
});

test('the car won’t drive into the sea, and a stuck car goes back on the lane', () => {
  const car = new Car(scene);
  // Straight off the end of the strand car park towards the water.
  car.place(CAR_PARKS.strand.x, CAR_PARKS.strand.z, 0);
  for (let i = 0; i < 900; i++) car.update(1 / 30, i / 30, { throttle: 1, steer: 0 }, solids, { live: true });
  assert.ok(heightAt(car.pos.x, car.pos.z) > 0.3);
  assert.ok(car.stuckT > 1, 'it stopped and stayed stopped');
  assert.ok(car.resetToLane(solids));
  const li = (car.pos.x - CAR_PARKS.strand.x) ** 2 + (car.pos.z - CAR_PARKS.strand.z) ** 2;
  assert.ok(Number.isFinite(li));
  assert.equal(car.blocked(car.pos.x, car.pos.z, car.heading, solids), null);
});
