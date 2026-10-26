// Life on the coast: pitching your own camp wherever the ground allows (and nowhere it doesn't),
// keeping it just as you left it, packing and moving it without losing anything, the save that
// carries it, the adventures (found in any order), and the harbour board telling only the truth.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const C = await import('../src/campsite.js');
const W = await import('../src/siteWorld.js');
const T = await import('../src/world/terrain.js');

// The ground as the game sees it, with a few things standing on it for the tests.
const things = [];
const world = W.makeSiteWorld({
  obstacles: (x, z, pad, out) => {
    out.length = 0;
    for (const o of things) if (Math.hypot(x - o.x, z - o.z) < o.r + pad) out.push(o);
    return out;
  },
});
beforeEach(() => { things.length = 0; });

// A good, level spot on Shell Strand's shelf, and one on the east arm's grass.
const STRAND = { x: 99, z: 16 }, GRASS = { x: 110, z: -20 };

test('a camp fits on the strand’s sand and on gentle grass, and says what the spot is like', () => {
  const a = C.checkSite(STRAND.x, STRAND.z, 0, world);
  assert.ok(a.ok, a.reason);
  assert.match(a.words, /sand/);
  assert.match(a.words, /sea/);
  const b = C.checkSite(GRASS.x, GRASS.z, 0.4, world);
  assert.ok(b.ok, b.reason);
  assert.match(b.words, /grass/);
  assert.ok(b.rise > 0.05, 'it is a slope, and that is fine');
});

test('a camp won’t go in the water, at the wave-washed edge, on steep ground, on a pier or off the world', () => {
  assert.equal(C.checkSite(101, 45, 0, world).code, 'water');
  assert.equal(C.checkSite(-133, -21, 0, world).code, 'water', 'not in the lake either');
  assert.equal(C.checkSite(101, 28, 0, world).code, 'wet');
  assert.equal(C.checkSite(60, -110, 0, world).code, 'steep');
  assert.equal(C.checkSite(T.LANDING.x + 6, T.LANDING.z, Math.PI / 2, world).ok, false, 'not on the landing’s pier');
  assert.equal(C.checkSite(1090, 0, 0, world).code, 'bounds');
});

test('the whole footprint counts, not just the middle: a tent whose corner reaches the water edge doesn’t fit, turned round it does', () => {
  // Walk down the strand until the middle is still dry but the back of the tent reaches the beach.
  let z = STRAND.z;
  while (z < 40 && C.checkSite(STRAND.x, z + 0.25, Math.PI, world).ok) z += 0.25;
  const edge = z + 0.25;
  const facingSea = C.checkSite(STRAND.x, edge, Math.PI, world);
  assert.equal(facingSea.ok, false);
  assert.ok(T.heightAt(STRAND.x, edge) > 0.45, 'its middle is on dry sand');
  assert.ok(facingSea.bad.length > 0, 'the spots in the way are marked for the preview');
  // (The footprint isn't square: the tent's back goes further than its door.)
  assert.ok(C.checkSite(STRAND.x, edge, 0, world).ok, 'turned the other way it fits');
});

test('trees, rocks and buildings are in the way, and so are paths, doorways and other camps', () => {
  things.push({ x: GRASS.x + 1, z: GRASS.z + 0.5, r: 0.3, kind: 'tree', name: 'a tree' });
  const t = C.checkSite(GRASS.x, GRASS.z, 0, world);
  assert.equal(t.code, 'blocked');
  assert.match(t.reason, /tree/);
  things.length = 0;
  things.push({ x: GRASS.x - 1.5, z: GRASS.z, r: 0.9, kind: 'rock', name: 'rocks' });
  assert.match(C.checkSite(GRASS.x, GRASS.z, 0, world).reason, /Rocks/);
  things.length = 0;
  assert.equal(C.checkSite(100, 3, 0, world).code, 'path', 'across the strand path');
  assert.equal(C.checkSite(T.HAVEN.x, T.HAVEN.z, 0, world).code, 'keep', 'not in Willowhaven');
  assert.equal(C.checkSite(T.CAMP.x, T.CAMP.z, 0, world).code, 'keep', 'not on the old camp');
  assert.equal(C.checkSite(T.DAYMARK.x + 1, T.DAYMARK.z + 2, 0, world).code, 'keep', 'not round the daymark');
  const other = { id: 'camp-other', name: 'Other camp', x: GRASS.x + 4, z: GRASS.z };
  assert.equal(C.checkSite(GRASS.x, GRASS.z, 0, world, { others: [other] }).code, 'camp');
  assert.ok(C.checkSite(GRASS.x, GRASS.z, 0, world, { others: [other], ignore: 'camp-other' }).ok, 'moving a camp ignores where it stands now');
});

test('you never have to be pixel-perfect: a spot a step from a tree settles where it fits, open water doesn’t', () => {
  things.push({ x: GRASS.x + 1.2, z: GRASS.z + 1.1, r: 0.3, kind: 'tree', name: 'a tree' });
  assert.equal(C.checkSite(GRASS.x, GRASS.z, 0, world).ok, false);
  const f = C.findSite(GRASS.x, GRASS.z, 0, world);
  assert.ok(f.check.ok && f.moved, 'it found a fit nearby');
  assert.ok(Math.hypot(f.x - GRASS.x, f.z - GRASS.z) <= 1.9, 'within a couple of steps');
  assert.ok(C.findSite(101, 45, 0, world).none, 'nothing to settle on at sea');
});

test('a camp on ground that has changed is moved to the nearest safe ground, with everything in it', () => {
  const camp = C.newCamp({ x: 101, z: 30, yaw: 0, name: 'Wet feet' });
  camp.store.fish.push({ id: 'seabass', size: 44, logId: null });
  assert.equal(C.checkSite(camp.x, camp.z, camp.yaw, world).ok, false);
  const near = C.nearestSite(camp.x, camp.z, camp.yaw, world, 60);
  assert.ok(near && near.check.ok);
  C.moveCamp(camp, near.x, near.z, near.yaw, 3, 9);
  assert.ok(C.checkSite(camp.x, camp.z, camp.yaw, world).ok);
  assert.equal(camp.store.fish.length, 1);
  assert.ok(near.dist < 20, `moved ${near.dist} m`);
});

/* ---------------- what's in it ---------------- */

const creel = (...ids) => ids.map((id, i) => ({ id, size: 30 + i, logId: `c${i}` }));
const count = (s, camp) => s.keep.length + (camp ? camp.store.fish.length + camp.store.meals.length + (camp.cooking ? 1 : 0) : 0);

test('fish move between your creel and the cool box, never past either’s room, never lost or doubled', () => {
  const state = { keep: creel('seabass', 'mackerel'), camps: [] };
  const camp = C.newCamp({ x: 1, z: 1, yaw: 0, name: 'Test' });
  state.camps.push(camp);
  const before = count(state, camp);
  assert.ok(C.stow(state, camp, 0).ok);
  assert.equal(count(state, camp), before);
  camp.store.fish.push(...creel('wrasse', 'pollack', 'plaice', 'sole', 'flounder').slice(0, C.COOLBOX - camp.store.fish.length));
  const full = C.stow(state, camp, 0);
  assert.equal(full.ok, false);
  assert.match(full.why, /full/);
  // (The creel holds fish by weight: a big meagre fills it.)
  state.keep.push({ id: 'meagre', size: 118, logId: 'big' });
  assert.equal(C.take(state, camp, 0).ok, false, 'a full creel takes no more');
});

test('packing up empties the cool box into your creel; if it won’t fit it says so and drops nothing', () => {
  // (A creel nearly full by weight: 15 kg, and a big meagre in it already.)
  const state = { keep: [...creel('mackerel', 'gilthead', 'sole'), { id: 'meagre', size: 112, logId: 'm' }], camps: [] };
  const camp = C.newCamp({ x: 1, z: 1, yaw: 0, name: 'Full camp' });
  camp.store.fish = creel('seabass', 'pollack', 'wrasse');
  state.camps.push(camp);
  const plan = C.packPlan(state, camp);
  assert.equal(plan.fits, false);
  assert.equal(plan.over, 2);
  const no = C.packUp(state, camp);
  assert.equal(no.ok, false);
  assert.equal(state.camps.length, 1, 'still pitched');
  assert.equal(count(state, camp), 7, 'nothing lost');
  const yes = C.packUp(state, camp, { release: [0, 2] });
  assert.ok(yes.ok);
  assert.equal(state.camps.length, 0);
  assert.equal(state.keep.length, 5);
  assert.deepEqual(yes.released.map((f) => f.id), ['seabass', 'wrasse']);
  assert.equal(C.kitsFree(state), 1, 'the kit is back in your backpack');
});

test('cooking waits for its half hour, and a camp keeps it while you’re away', () => {
  const state = { keep: creel('seabass'), camps: [] };
  const camp = C.newCamp({ x: 1, z: 1, yaw: 0, name: 'Stove' });
  assert.ok(C.startCooking(state, camp, 'creel', 0, 100).ok);
  assert.equal(C.startCooking(state, camp, 'creel', 0, 100).ok, false, 'one pan');
  assert.equal(C.settleCooking(camp, 100.3), null);
  assert.equal(C.packUp({ keep: [], camps: [camp] }, camp).ok, false, 'not while it cooks');
  assert.equal(C.settleCooking(camp, 100.5).id, 'seabass');
  assert.equal(camp.store.meals.length, 1);
  assert.equal(camp.cooking, null);
});

test('moving a camp keeps it the same camp: its id, name and cool box', () => {
  const camp = C.newCamp({ x: 1, z: 1, yaw: 0, name: 'Wanderer' });
  camp.store.fish = creel('seabass');
  const id = camp.id;
  C.moveCamp(camp, 50, 60, 1.2, 4, 18);
  assert.equal(camp.id, id);
  assert.equal(camp.name, 'Wanderer');
  assert.equal(camp.store.fish[0].id, 'seabass');
  assert.deepEqual([camp.x, camp.z, camp.yaw], [50, 60, 1.2]);
});

/* ---------------- the save ---------------- */

let loads = 0;
const freshSave = () => import(`../src/save.js?coast=${++loads}`);
beforeEach(() => { globalThis.localStorage = new MemoryStorage(); });

test('your camp, marks, photographs and adventures come back exactly as saved', async () => {
  let S = await freshSave();
  const { state } = S.loadGame();
  const camp = C.newCamp({ x: 99, z: 16, yaw: 2.9, name: 'Sanderling Camp', day: 3, hour: 18.5 });
  Object.assign(camp, { tent: 'rust', lantern: 'on', deco: { bunting: true, rug: false, chimes: true, deckchair: false } });
  camp.store.fish.push({ id: 'seabass', size: 48, logId: 'c1' });
  camp.store.meals.push({ id: 'mackerel', size: 31, logId: 'c2' });
  camp.cooking = { id: 'pollack', size: 40, logId: 'c3', start: 90.2, dur: 0.5 };
  state.camps.push(camp);
  state.keep.push({ id: 'gilthead', size: 30, logId: 'c4', cooked: true });
  state.pins.push({ id: 'pin-a1', x: 120, z: 40, title: 'Bass ledge', note: 'dusk, sandeel', fav: true, day: 3, hour: 19 });
  state.photos.push({ id: 'ph-a1', title: 'Cuttlefish', at: 5, day: 3, hour: 11, x: 140, z: -16, place: 'Driftwood Cove', sky: 'clear', subjects: { species: ['cuttlefish'], places: ['cove'], birds: false } });
  state.adventures.kittiwake = { clue: { day: 3, hour: 9 }, steps: { found: { day: 3, hour: 10 } }, done: null };
  state.keepsakes.notebook = { day: 2, hour: 8 };
  state.unlocks.deckchair = true;
  state.wallPhoto = 'ph-a1';
  assert.ok(S.saveGame(state));
  S = await freshSave();
  const back = S.loadGame().state;
  assert.deepEqual(back.camps, state.camps);
  assert.deepEqual(back.keep, state.keep);
  assert.deepEqual(back.pins, state.pins);
  assert.deepEqual(back.photos, state.photos);
  assert.deepEqual(back.adventures, state.adventures);
  assert.deepEqual(back.keepsakes, state.keepsakes);
  assert.equal(back.unlocks.deckchair, true);
  assert.equal(back.wallPhoto, 'ph-a1');
});

test('a version 4 save upgrades with its progress intact, your kit in your backpack and an empty album', async () => {
  const S = await freshSave();
  const v4 = {
    hour: 7, day: 5, fish: { seabass: { count: 3, best: 62, firstDay: 2, firstHour: 9, firstZone: 'coast', firstRain: false } },
    places: { bay: { day: 1, hour: 14 }, camp: { day: 1, hour: 15 } }, log: [{ id: 'c1', sp: 'seabass', size: 62, day: 2, hour: 9, zone: 'coast', kind: 'lure', rod: 'sea', item: 'sandeel', from: 'shore' }],
    keep: [{ id: 'mackerel', size: 30 }], camp: { fireUntil: 130, cooking: null, ready: [] }, trip: null, trips: [], observed: { eel: { count: 1, day: 3, hour: 22, zone: 'estuary' } },
  };
  localStorage.setItem('slow-tide-save', JSON.stringify({ game: 'slow-tide', version: 4, savedAt: 1, data: v4 }));
  const { state, outcome } = S.loadGame();
  assert.equal(outcome, 'loaded');
  assert.equal(state.fish.seabass.best, 62);
  assert.equal(state.log.length, 1);
  assert.equal(state.keep[0].id, 'mackerel');
  assert.equal(state.observed.eel.count, 1);
  assert.deepEqual(state.camps, []);
  assert.equal(C.kitsFree(state), 1);
  assert.deepEqual(state.photos, []);
  assert.deepEqual(state.pins, []);
  assert.deepEqual(state.adventures, {});
});

test('junk in camps, marks and photographs is cleaned up, never trusted, and a camp is never doubled', async () => {
  const S = await freshSave();
  const good = C.newCamp({ x: 99, z: 16, yaw: 0, name: 'Good' });
  const raw = {
    camps: [good, { ...good }, { id: 'camp-x2', x: 'far', z: 3 }, { ...C.newCamp({ x: 5, z: 5, yaw: 0, name: '<b>Second</b>' }), tent: 'polka' }],
    pins: [{ id: 'pin-1', x: 1, z: 2, title: 'ok' }, { id: '../../etc', x: 1, z: 2 }, { id: 'pin-2', x: Infinity, z: 2 }],
    photos: [{ id: 'ph-1', subjects: { species: ['seabass', 'dragon'], places: ['cove'] } }, { id: 'ph-1' }, 'nonsense'],
    adventures: { kittiwake: { clue: { day: 2, hour: 3 }, steps: { found: { day: 'x' }, ok: { day: 2, hour: 4 } } }, 'bad id!': {} },
  };
  const s = S.sanitize(raw);
  assert.equal(s.camps.length, C.CAMP_KITS, 'one kit, one camp');
  assert.equal(s.camps[0].id, good.id);
  assert.deepEqual(s.pins.map((p) => p.id), ['pin-1']);
  assert.equal(s.photos.length, 1);
  assert.deepEqual(s.photos[0].subjects.species, ['seabass']);
  assert.deepEqual(Object.keys(s.adventures), ['kittiwake']);
  assert.equal(s.adventures.kittiwake.steps.found.day, 1, 'a bad step is put right');
  // A camp's name can't carry markup.
  assert.equal(C.cleanCamp({ ...good, name: '<b>Bold</b>' }).name, 'bBold/b');
});

test('combining two saves keeps every mark, photograph and adventure step from both', async () => {
  const S = await freshSave();
  const a = S.sanitize({ pins: [{ id: 'pin-a', x: 1, z: 1 }], photos: [{ id: 'ph-a', at: 1 }], adventures: { kittiwake: { clue: { day: 2, hour: 1 }, steps: {} } } });
  const b = S.sanitize({ pins: [{ id: 'pin-b', x: 2, z: 2 }], photos: [{ id: 'ph-b', at: 2 }], adventures: { kittiwake: { clue: { day: 3, hour: 1 }, steps: { found: { day: 3, hour: 2 } } } }, keepsakes: { feather: { day: 3, hour: 4 } }, unlocks: { birdMarks: true } });
  const m = S.mergeStates(a, b);
  assert.deepEqual(m.pins.map((p) => p.id).sort(), ['pin-a', 'pin-b']);
  assert.deepEqual(m.photos.map((p) => p.id), ['ph-a', 'ph-b']);
  assert.equal(m.adventures.kittiwake.clue.day, 2, 'the earlier clue');
  assert.ok(m.adventures.kittiwake.steps.found);
  assert.ok(m.keepsakes.feather && m.unlocks.birdMarks);
});

/* ---------------- adventures ---------------- */

const A = await import('../src/adventures.js');
const advState = () => ({ day: 4, hour: 10, adventures: {}, keepsakes: {}, unlocks: {} });
const quiet = () => {
  const notes = [];
  return { notes, hooks: { note: (t, x, id) => notes.push(id || t), toast: () => {}, save: () => {} } };
};

test('an adventure found the other way round: steps done before the clue count when you find it', () => {
  const st = advState(), q = quiet(), adv = new A.Adventures(st, q.hooks);
  const at = { onFoot: false, player: { x: 0, z: 0 }, boat: { x: T.WRECK.x + 5, z: T.WRECK.z }, underwater: true, cam: { x: T.WRECK.x, z: T.WRECK.z + 3 }, flocks: [] };
  adv.check(at);
  assert.equal(adv.status('kittiwake'), 'unknown', 'not an adventure yet');
  assert.ok(st.adventures.kittiwake.steps.found && st.adventures.kittiwake.steps.seen, 'but remembered');
  assert.equal(q.notes.length, 0);
  adv.clue('kittiwake');
  assert.equal(adv.status('kittiwake'), 'done');
  assert.ok(st.keepsakes.chart);
  assert.deepEqual(q.notes, ['kittiwake']);
  adv.check(at);
  adv.clue('kittiwake');
  assert.equal(q.notes.length, 1, 'finished once, and only once');
});

test('Ada’s pages can be found in any order, and the notebook finishes on the last', () => {
  for (const order of [['punt', 'head', 'strand'], ['strand', 'punt', 'head']]) {
    const st = advState(), q = quiet(), adv = new A.Adventures(st, q.hooks);
    for (const [i, id] of order.entries()) {
      const r = adv.page(id);
      assert.equal(r.first, i === 0);
      assert.equal(r.count, i + 1);
    }
    assert.equal(adv.status('notebook'), 'done');
    assert.ok(st.keepsakes.notebook);
    assert.equal(adv.page(order[0]).count, 3, 'reading one again adds nothing');
  }
});

test('the gulls count only near a real flock; the wall wants a real photograph of a cuttlefish', () => {
  const st = advState(), q = quiet(), adv = new A.Adventures(st, q.hooks);
  adv.clue('gulls');
  assert.equal(adv.caught('mackerel', 300, 300, []), null, 'no birds, no gulls');
  adv.check({ onFoot: false, player: { x: 50, z: 50 }, boat: { x: 50, z: 50 }, underwater: false, cam: { x: 50, z: 50 }, flocks: [{ x: 60, z: 60, t: 5 }] });
  assert.equal(adv.status('gulls'), 'progress');
  assert.equal(adv.caught('mackerel', 70, 55, [{ x: 60, z: 60, t: 5 }]), 'Atlantic Mackerel');
  assert.equal(adv.status('gulls'), 'done');
  assert.ok(st.unlocks.birdMarks);
  adv.photographed({ subjects: { species: ['wrasse'] } });
  assert.equal(st.adventures.wall, undefined);
  adv.photographed({ subjects: { species: ['cuttlefish'] } });
  adv.clue('wall');
  assert.equal(adv.status('wall'), 'progress', 'still to pin it up');
  adv.step('wall', 'pinned');
  assert.equal(adv.status('wall'), 'done');
  assert.ok(st.unlocks.deckchair);
});

/* ---------------- the harbour board ---------------- */

test('the board’s fish are real: sea fish living near the harbour, busy at this hour', async () => {
  const { createHabitat } = await import('../src/world/habitat.js');
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const H = await import('../src/harbour.js');
  const eco = new Ecosystem(createHabitat());
  for (const hour of [6, 13, 20]) {
    eco.ctx.hour = hour;
    eco.update(0.1, { env: { hour, rain: 0, cloud: 0.3, daylight: hour > 6 && hour < 20 ? 1 : 0.2, night: hour > 20 ? 1 : 0, hatch: 0 }, focus: { x: 0, z: 0 }, boat: { x: 0, z: 0, speed: 0 }, walker: null, lantern: null, lights: [] });
    const list = H.whatsAbout(eco);
    for (const e of list) {
      assert.ok(e.sp.water !== 'fresh', `${e.sp.id} is a sea fish`);
      assert.ok((eco.activity[e.sp.id] ?? 0) >= 0.45, `${e.sp.id} is busy at ${hour}`);
      const homes = eco.agents.filter((a) => a.sp === e.sp && Math.hypot(a.home.x - T.HAVEN.x, a.home.z - T.HAVEN.z) < 380);
      assert.ok(homes.length >= 2, `${e.sp.id} really lives near the harbour`);
    }
  }
});
