// A living world, together (docs/IMPROVEMENTS.md): a guest's market keeps the hour everyone sees;
// friends crewing for you help with the jobs the board says they can; leaving a session doesn't
// refill fished-out water at once; a hire lasts a day from when you took her; the big ocean fish
// fetch more than a turbot; and the animals don't pop in, teleport or move as a rigid block. Run
// with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { seeded } = await import('../src/util.js');
function withDice(seed, fn) {
  const was = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = was;
  }
}

test('a guest’s market and kitchen keep the hour everyone sees, not their own clock', async () => {
  const { HarbourSheet } = await import('../src/harbourView.js');
  const sheet = (own, world) => Object.assign(Object.create(HarbourSheet.prototype), { state: { hour: own, day: 4 }, hooks: { worldHour: world == null ? undefined : () => world }, where: 'market' });
  // The host at noon, the guest's own clock at nine at night: Mags is at her slab, and open.
  assert.equal(sheet(21, 12).marketOpen, true);
  assert.equal(sheet(12, 21).marketOpen, false, 'and the other way about');
  // Alone (no world clock hook, or the same hour): your own clock, as ever.
  assert.equal(sheet(12).marketOpen, true);
  assert.equal(sheet(21).marketOpen, false);
});

test('a friend crewing for you: their fish count for your fishing charter, and nothing else of yours', async () => {
  const { caught } = await import('../src/contracts.js');
  const C = {
    active: [
      { id: 'ch', obj: { kind: 'charter', fish: 2 }, progress: { aboard: true, boat: 'rib', caught: 0 }, ready: false },
      { id: 'mk', obj: { kind: 'catch', count: 1 }, progress: { got: 0 }, ready: false },
    ],
  };
  const done = caught(C, { sp: 'mackerel', sea: true, phase: 'landed', boat: 'rib', crew: true });
  assert.deepEqual(done, []);
  assert.equal(C.active[0].progress.caught, 1, 'the charter counts it');
  assert.equal(C.active[1].progress.got, 0, 'your own catch job doesn’t: it isn’t your fish');
  // (Another boat's charter: not this one.)
  caught(C, { sp: 'mackerel', sea: true, phase: 'landed', boat: 'console', crew: true });
  assert.equal(C.active[0].progress.caught, 1);
});

test('dolphins on the skipper’s bow count for the crew’s photograph', async () => {
  const { buildSeaLife } = await import('../src/world/sealife.js');
  const life = buildSeaLife(new THREE.Scene());
  const pod = life.pods[0];
  pod.mode = 'bow';
  pod.owner = 'skipper';
  const at = { x: pod.members[0].x, z: pod.members[0].z };
  for (const m of pod.members) {
    m.x = at.x;
    m.z = at.z;
    m.y = 0;
    if (m.mesh) m.mesh.visible = true;
  }
  const cam = new THREE.PerspectiveCamera(60, 1, 0.1, 500);
  cam.position.set(at.x, 3, at.z - 20);
  cam.lookAt(at.x, 0, at.z);
  cam.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const c = { x: at.x, z: at.z - 20 };
  assert.equal(life.inFrame(frustum, c, 'crewman').bow, false, 'someone else’s bow, on your own');
  assert.equal(life.inFrame(frustum, c, ['crewman', 'skipper']).bow, true, 'crewing her: her bow is yours too');
  assert.equal(life.inFrame(frustum, c, 'skipper').bow, true, 'the skipper’s own, as ever');
});

test('leaving a session: fish taken while following come back over minutes, not all at once', async () => {
  const { SharedWorld } = await import('../src/sharedworld.js');
  const restocked = [];
  const gone = { state: 'gone', backAt: Infinity, size: 30 }, swimming = { state: 'cruise', backAt: 0, size: 30 };
  const S = Object.assign(Object.create(SharedWorld.prototype), {
    sealife: { pods: [], whales: [], visitors: [], turtles: [] },
    eco: { schools: [], agents: [gone, swimming], time: 1000, restock: (a) => restocked.push(a) },
  });
  S.forget();
  assert.deepEqual(restocked, [], 'nothing refilled at once');
  assert.ok(gone.backAt >= 1240 && gone.backAt <= 1420, `back in ${(gone.backAt - 1000).toFixed(0)} s`);
  assert.equal(swimming.backAt, 0, 'the rest left alone');
});

test('a hire lasts a day from when you took her; an older game’s hire still ends with its day', async () => {
  const { cleanYard, hireBoat, usable, hirePrice } = await import('../src/shipyard.js');
  const { BOAT_KINDS } = await import('../src/boat.js');
  const s = { money: 500, day: 6, hour: 20, ledger: [], yard: cleanYard(undefined, BOAT_KINDS) };
  assert.equal(hireBoat(s, 'rib').ok, true);
  assert.equal(s.money, 500 - hirePrice('rib'));
  const at = (day, hour) => usable(s.yard, 'rib', day, day * 24 + hour);
  assert.equal(at(6, 23.9), true, 'still yours at midnight');
  assert.equal(at(7, 19.5), true, 'and the next evening');
  assert.equal(at(7, 20.5), false, 'a day on, back to the yard');
  assert.equal(hireBoat(s, 'console').ok, false, 'one at a time, while she’s on hire');
  // Kept in the save.
  const again = cleanYard(JSON.parse(JSON.stringify(s.yard)), BOAT_KINDS);
  assert.equal(again.hired.until, 6 * 24 + 20 + 24);
  // An older game's hire (no until): the day decides, as it did.
  const old = cleanYard({ owned: ['row', 'skiff', 'kayak'], hired: { kind: 'rib', day: 6 } }, BOAT_KINDS);
  assert.equal(usable(old, 'rib', 6, 6 * 24 + 23), true);
  assert.equal(usable(old, 'rib', 7, 7 * 24 + 1), false);
  // Over, another can be hired.
  s.day = 7;
  s.hour = 21;
  assert.equal(hireBoat(s, 'console').ok, true);
});

test('the big ocean fish fetch more than a turbot can', async () => {
  const M = await import('../src/market.js');
  const { fishById } = await import('../src/fish.js');
  const sp = fishById.yellowfin;
  const place = M.buyers.haven(sp) ? 'haven' : 'muelle';
  assert.ok(M.buyers[place](sp), 'someone buys it');
  const v = M.fishValue({ id: 'yellowfin', size: sp.size[1], at: 30 }, { day: 1, now: 30, place });
  assert.ok(v.price > M.MAX_PRICE, `£${v.price} for ${v.kg.toFixed(0)} kg of tuna`);
  assert.ok(v.price <= M.BIG_MAX_PRICE);
  assert.ok(M.fishValue({ id: 'turbot', size: 80, at: 30 }, { day: 1, now: 30 }).price <= M.MAX_PRICE, 'the ordinary limit for the rest');
});

test('the animals: an otter walks back to the water, a heron flies home, oystercatchers move as birds', async () => {
  const W = await import('../src/world/wildlife.js');
  const ctxAt = (x, z, extra = {}) => ({ from: { x, z }, onFoot: true, speed: 0, daylight: 0.8, hour: 7, season: 'summer', tideLevel: 0, region: 'home', ...extra });
  withDice(5, () => {
    const w = W.buildWildlife(new THREE.Scene());
    // An otter done eating on the bank: no jump to the water, a walk.
    const o = w.otters[0], p = o.B.path.find((q) => q.bx != null), i = o.B.path.indexOf(p);
    Object.assign(o, { state: 'eat', t: 0, x: p.bx, z: p.bz, i });
    let step = 0, n = 0;
    for (; n < 200 && o.state !== 'swim'; n++) {
      const x = o.x, z = o.z;
      w.update(0.1, n * 0.1, ctxAt(p.x + 60, p.z));
      step = Math.max(step, Math.hypot(o.x - x, o.z - z));
    }
    assert.equal(o.state, 'swim', `back in the water after ${(n * 0.1).toFixed(1)} s`);
    assert.ok(step < 0.2, `never more than ${step.toFixed(2)} m in a tenth of a second`);
    // A heron gone over the hill: it flies back in rather than appearing at its shallows.
    const H = w.herons[0], home = H.S[H.spot];
    Object.assign(H, { state: 'away', t: 0, fly: null, x: home.x + 520, z: home.z });
    w.update(0.1, 30, ctxAt(home.x - 200, home.z));
    assert.ok(H.fly, 'on its way home');
    assert.ok(Math.hypot(H.x - home.x, H.z - home.z) > 400, 'from where it went, not already there');
    // Oystercatchers wander while they feed, and land in a new scatter.
    const F = w.flocks[0], before = F.birds.map((b) => [b.ox, b.oz]);
    for (let k = 0; k < 300; k++) w.update(0.1, 40 + k * 0.1, ctxAt(F.x + 200, F.z));
    const moved = F.birds.filter((b, j) => Math.hypot(b.ox - before[j][0], b.oz - before[j][1]) > 0.2).length;
    assert.ok(moved >= 3, `${moved} of ${F.birds.length} walked about`);
  });
});
