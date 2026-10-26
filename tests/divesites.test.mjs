// The dive sites (world/divesites.js, divesiteWorld.js, seabed.js): five places worth going down
// at, each a different kind of water at its own depth, each with a landmark and fish of its own;
// rock you can't swim through (but an arch you can swim under); the dive log; and the small life
// of the seabed everywhere else. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const D = await import('../src/world/divesites.js');
const T = await import('../src/world/terrain.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { cleanDive, logSite } = await import('../src/dive.js');
const { Seabed, seabedKind } = await import('../src/world/seabed.js');
const { buildDiveSites } = await import('../src/world/divesiteWorld.js');
const { seeded } = await import('../src/util.js');
const FISHMOD = await import('../src/fish.js');
const { currentAt } = await import('../src/world/conditions.js');
const { TIDE } = await import('../src/world/conditions.js');

const depth = (x, z) => -T.heightAt(x, z);

test('five sites, each its own kind of water, at the depths it says', () => {
  assert.deepEqual(D.HOME_SITES.map((s) => s.id), ['reef', 'kelp', 'wreck', 'sands', 'hound']);
  for (const S of D.HOME_SITES) {
    const d = depth(S.x, S.z);
    // (The middle of each within its stated range, give or take a metre.)
    assert.ok(d > S.depth[0] - 1 && d < S.depth[1] + 1.5, `${S.id}: ${d.toFixed(1)} m`);
    assert.ok(S.name && S.sub && S.note && S.first, `${S.id} has its words`);
    // A place on the map, found by passing over it.
    const P = T.PLACES.find((p) => p.id === S.id);
    assert.ok(P && P.dive && P.test(S.x, S.z), `${S.id} is a place`);
    // A buoy over each (the Kittiwake has her own), in water deep enough to float it.
    if (S.buoy) assert.ok(depth(S.buoy.x, S.buoy.z) > 3, `${S.id}'s buoy is afloat`);
  }
  // Far enough apart to be different places.
  for (const a of D.HOME_SITES) for (const b of D.HOME_SITES) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 200, `${a.id}–${b.id}`);
  // The Hound is the deep one: thirty metres at its foot.
  assert.ok(depth(D.siteById.hound.x, D.siteById.hound.z) > 28);
  assert.ok(depth(D.siteById.reef.x, D.siteById.reef.z) < 10);
});

test('the Hound stands from thirty metres to ten; you can’t swim through it, or through a boulder', () => {
  const [H, Pup] = D.PINNACLES;
  assert.ok(-H.bed > 28 && -(H.bed + H.top) > 8 && -(H.bed + H.top) < 12, `top ${-(H.bed + H.top)} m`);
  assert.ok(Pup.top < H.top);
  // Inside its wall: pushed out, and out of it after.
  const p = { x: H.x + 2, y: H.bed + 8, z: H.z };
  assert.ok(D.pushOut(p));
  assert.ok(!D.pushOut({ ...p }, 0.3), 'out of the rock now');
  assert.ok(Math.hypot(p.x - H.x, p.z - H.z) > 5);
  // Over its top: you can sit on it, not in it.
  const q = { x: H.x, y: H.bed + H.top - 0.5, z: H.z };
  D.pushOut(q);
  assert.ok(q.y > H.bed + H.top, 'up onto its crown');
  // Well clear of it: left alone.
  const r = { x: H.x + 40, y: H.bed + 4, z: H.z };
  assert.ok(!D.pushOut(r));
  // A sounder over it reads its top, not the seabed thirty metres down.
  assert.ok(D.rockTopAt(H.x, H.z) > H.bed + H.top - 0.5);
  assert.equal(D.rockTopAt(H.x + 60, H.z), null);
  // Every boulder is solid.
  for (const o of D.ROCKS.slice(0, 30)) {
    const s = { x: o.x + 0.1, y: o.y, z: o.z };
    assert.ok(D.pushOut(s), 'pushed out of a boulder');
  }
});

test('Skerries Reef’s arch: solid piers, and a gap under it you can swim through', () => {
  const A = D.siteById.reef, bed = T.heightAt(A.x, A.z);
  const arch = D.ROCKS.filter((o) => o.arch);
  assert.ok(arch.some((o) => o.lintel) && arch.some((o) => !o.lintel));
  // Through the middle, a metre and a half off the bottom: nothing in the way.
  for (const u of [-1.5, -0.5, 0, 0.5, 1.5]) {
    const p = { x: A.x + u * Math.sin(0.7), y: bed + 1.5, z: A.z + u * Math.cos(0.7) };
    assert.ok(!D.pushOut(p, 0.45), `the gap is open (${u})`);
  }
  // But the lintel's over your head.
  assert.ok(D.pushOut({ x: A.x, y: bed + 3.9, z: A.z }, 0.45));
});

test('each site has fish of its own, and nothing anywhere else moved for them', () => {
  const eco = new Ecosystem(createHabitat());
  for (const S of D.DIVE_SITES) {
    const own = eco.agents.filter((a) => a.home.site === S.id);
    const kinds = new Set(own.map((a) => a.sp.id));
    assert.ok(own.length >= 10 && kinds.size >= 3, `${S.id}: ${own.length} fish, ${[...kinds].join(', ')}`);
    for (const a of own) assert.ok(a.sp.life.zones.includes(a.home.zone), `${a.sp.id} lives in ${a.home.zone}`);
  }
  const want = { reef: ['wrasse', 'octopus'], kelp: ['pollack', 'cuttlefish'], wreck: ['pollack', 'bogue'], sands: ['plaice', 'turbot', 'gurnard'], hound: ['pollack', 'conger', 'redporgy'] };
  for (const [id, list] of Object.entries(want)) {
    const kinds = new Set(eco.agents.filter((a) => a.home.site === id).map((a) => a.sp.id));
    for (const k of list) assert.ok(kinds.has(k), `${k} at ${id}`);
  }
  // The Hound's fish go right down its walls (deeper than they'd keep anywhere else), and none
  // of them starts inside the rock.
  const hound = eco.agents.filter((a) => a.home.site === 'hound' && !a.school);
  assert.ok(hound.some((a) => a.y < -16), 'some deep down');
  for (const a of hound) assert.ok(!D.pushOut({ x: a.x, y: a.y, z: a.z }, 0.2), `${a.sp.id} clear of the rock`);
  // Their homes come after everyone else's (but for the crossing's, out on the open sea, after
  // even theirs).
  const spots = eco.habitat.spots.filter((s) => !s.crossing), first = spots.findIndex((s) => s.site);
  assert.ok(first > 0 && spots.slice(first).every((s) => s.site), 'the dive sites’ homes come last');
  assert.ok(eco.habitat.spots.slice(eco.habitat.spots.findIndex((s) => s.crossing)).every((s) => s.crossing), 'the crossing’s after them');
});

test('the tide runs hard over the Hound, and not at slack water', () => {
  const H = D.siteById.hound;
  const was = TIDE.flow;
  try {
    TIDE.flow = 1;
    const c = currentAt(H.x, H.z, 0);
    assert.ok(Math.hypot(c.x, c.z) > 0.3, `running: ${Math.hypot(c.x, c.z).toFixed(2)} m/s`);
    TIDE.flow = 0;
    const s = currentAt(H.x, H.z, 0);
    assert.ok(Math.hypot(s.x, s.z) < 0.12, `slack: ${Math.hypot(s.x, s.z).toFixed(2)} m/s`);
  } finally {
    TIDE.flow = was;
  }
});

test('the Gannet Drop: a steep slope down to the deep water, not a step', () => {
  for (const x of [-360, -260, -200, -160]) {
    let worst = 0;
    for (let z = 690; z < 735; z += 1) worst = Math.max(worst, Math.abs(depth(x, z + 1) - depth(x, z)));
    assert.ok(worst < 6, `x ${x}: ${worst.toFixed(1)} m in a metre`);
    assert.ok(depth(x, 735) - depth(x, 690) > 8, 'it does go down');
  }
});

test('the dive log: each site you dive, how often, and the deepest you went there', () => {
  const d = cleanDive(null);
  assert.deepEqual(d.sites, {});
  assert.equal(logSite(d, 'hound', 12, 18.24), true, 'the first time');
  assert.equal(logSite(d, 'hound', 13, 27.5), false);
  assert.deepEqual(d.sites.hound, { first: 12, dives: 2, deepest: 27.5 });
  // Through a save, and nonsense thrown out.
  const back = cleanDive(JSON.parse(JSON.stringify({ ...d, sites: { ...d.sites, 'Bad Id!': { dives: 3 }, kelp: 'no' } })));
  assert.deepEqual(Object.keys(back.sites), ['hound']);
  assert.equal(back.sites.hound.deepest, 27.5);
});

test('the seabed is never bare: shells, starfish and the rest, the same each time', () => {
  // What the bottom gives.
  const sand = { depth: 20, rock: 0, weed: 0 }, rock = { depth: 8, rock: 0.8, weed: 0 }, dry = { depth: 0.3, rock: 0, weed: 0 };
  const kinds = new Set();
  for (let u = 0; u < 1; u += 0.01) kinds.add(seabedKind(sand, true, u));
  for (const k of ['shell', 'star', 'brittle', 'pen', 'ceri']) assert.ok(kinds.has(k), `${k} on deep sand`);
  const onRock = new Set();
  for (let u = 0; u < 1; u += 0.01) onRock.add(seabedKind(rock, true, u));
  assert.ok(onRock.has('urchin') && onRock.has('dahlia'));
  assert.equal(seabedKind(dry, true, 0.1), null);
  for (let u = 0; u < 1; u += 0.05) assert.ok([null, 'stone', 'mussel'].includes(seabedKind(sand, false, u)), 'fresh water: stones and mussels');
  // Round a diver thirty metres down in open water: plenty to look at, the same every visit.
  const scene = new THREE.Scene();
  const sb = new Seabed(scene, createHabitat());
  const cam = { position: new THREE.Vector3(-300, -25, 780) };
  sb.update(cam, 1);
  const count = () => Object.values(sb.meshes).reduce((n, m) => n + m.count, 0);
  const first = count(), m0 = new THREE.Matrix4();
  sb.meshes.shell.getMatrixAt(0, m0);
  assert.ok(first > 150, `${first} things on the bottom`);
  // Away and back again: the same things in the same places.
  cam.position.set(0, -10, 400);
  sb.update(cam, 1);
  cam.position.set(-300, -25, 780);
  sb.update(cam, 1);
  const m1 = new THREE.Matrix4();
  sb.meshes.shell.getMatrixAt(0, m1);
  assert.equal(count(), first);
  assert.ok(m0.equals(m1));
  // Above the water it's all put away.
  sb.update(cam, 0);
  assert.ok(Object.values(sb.meshes).every((m) => !m.visible));
});

test('what the sites look like is built, and only drawn near each', () => {
  const scene = new THREE.Scene();
  const W = buildDiveSites(scene, seeded(20261026));
  assert.equal(W.buoys.length, 8, 'a yellow buoy over each site but the Kittiwake (and El Bajón, which has the island’s own)');
  assert.equal(W.towers.length, 2, 'the Hound and its Pup');
  const tris = () => {
    let n = 0;
    W.group.traverse((o) => {
      if (!o.geometry || !o.visible) return;
      const c = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3;
      n += o.isInstancedMesh ? c * o.count : c;
    });
    return n;
  };
  for (const S of D.DIVE_SITES) {
    W.update(0.016, 1, { position: new THREE.Vector3(S.x, -4, S.z) });
    assert.ok(W.anchor.visible === (S.id === 'sands'), `the anchor only at Anchor Sands (${S.id})`);
    assert.ok(tris() < 400000, `${S.id}: ${tris()} triangles`);
  }
  // Far from all of them (up the Wend): only the buoys.
  W.update(0.016, 1, { position: new THREE.Vector3(520, 2, -170) });
  assert.ok(tris() < 5000);
});

test('Las Brasas’ five: each where it says, at its depths, with its buoy and the life it’s known for', () => {
  assert.deepEqual(D.SOUTH_SITES.map((s) => s.id), ['bajon', 'arcos', 'veril', 'sebadal', 'coladas']);
  for (const S of D.SOUTH_SITES) {
    const d = depth(S.x, S.z);
    assert.ok(S.south && S.z > T.SOUTH_Z, S.id);
    assert.ok(d > S.depth[0] - 1 && d < S.depth[1] + 1.5, `${S.id}: ${d.toFixed(1)} m`);
    assert.ok(S.name && S.sub && S.note && S.first, `${S.id} has its words`);
    const P = T.PLACES.find((p) => p.id === S.id);
    assert.ok(P && P.test(S.x, S.z), `${S.id} is a place`);
    if (S.buoy) assert.ok(depth(S.buoy.x, S.buoy.z) > 3, `${S.id}'s buoy is afloat`);
  }
  for (const a of D.SOUTH_SITES) for (const b of D.SOUTH_SITES) if (a !== b) assert.ok(Math.hypot(a.x - b.x, a.z - b.z) > 150, `${a.id}–${b.id}`);
  // Who lives at each, at the depths you can see them: a dive there is never empty.
  const eco = new Ecosystem(createHabitat());
  const at = (id) => eco.agents.filter((a) => a.home.site === id);
  const kinds = (id) => new Set(at(id).map((a) => a.sp.id));
  const expect = {
    bajon: ['chromis', 'parrotfish', 'ornatewrasse', 'comber', 'grouper', 'moray', 'barracuda', 'trumpetfish', 'triggerfish', 'salema'],
    arcos: ['grouper', 'moray', 'comber', 'chromis', 'barracuda', 'amberjack'],
    veril: ['grouper', 'redporgy', 'dentex', 'amberjack', 'sardine'],
    sebadal: ['cuttlefish', 'sandsmelt', 'salema', 'striped', 'angelshark'],
    coladas: ['parrotfish', 'triggerfish', 'moray', 'comber', 'chromis'],
  };
  for (const [id, list] of Object.entries(expect)) {
    const k = kinds(id);
    for (const sp of list) assert.ok(k.has(sp), `${sp} at ${id}`);
    assert.ok(at(id).length > 25, `${id}: ${at(id).length} fish`);
    // Every one of them on a home that suits its kind, in a water it lives in.
    for (const a of at(id)) assert.ok(a.sp.life.homes.includes(a.home.type) && a.sp.life.zones.includes(a.home.zone), `${a.sp.id} at ${id}`);
  }
  // The deep ones go down the wall: El Veril's groupers below twenty metres.
  const deep = at('veril').filter((a) => a.sp.id === 'grouper');
  assert.ok(deep.some((a) => -a.y > 20), 'a grouper down the wall');
});

test('the island’s hunters drive its own shoals up; and the harbour’s full of fish', () => {
  const { fishById } = FISHMOD;
  for (const id of ['barracuda', 'amberjack']) assert.ok([].concat(fishById[id].life.hunter).includes('bogue'), id);
  for (const id of ['bluefish', 'littletunny', 'bullet']) assert.ok(fishById[id].life.hunterSouth?.includes('sardine'), id);
  // (At home they hunt what they always did.)
  assert.deepEqual([].concat(fishById.bluefish.life.hunter), ['sardine', 'anchovy']);
  const eco = new Ecosystem(createHabitat());
  const harbour = eco.agents.filter((a) => a.home.south && a.home.tag === 'puerto');
  const k = new Set(harbour.map((a) => a.sp.id));
  for (const sp of ['mullet', 'ornatewrasse', 'twobanded', 'salema', 'comber', 'chromis', 'octopus', 'sandsmelt', 'bogue', 'horsemackerel']) assert.ok(k.has(sp), `${sp} in the harbour`);
  assert.ok(harbour.length > 80, `${harbour.length} fish in Puerto Brasa`);
  // A barracuda school near El Bajón finds a chromis cloud or a bogue shoal to hunt and drives it.
  const bar = eco.schools.find((s) => s.sp.id === 'barracuda' && s.home.site === 'bajon');
  assert.ok(bar);
  Object.assign(eco.ctx, { hour: 7, daylight: 0.6 });
  eco.activity.barracuda = 1;
  let frenzy = false, boil = false;
  for (let i = 0; i < 30 * 120 && !frenzy; i++) {
    eco.stepSchool(bar, 1 / 30, false);
    if (bar.frenzy > 0) frenzy = true;
  }
  assert.ok(frenzy, 'a frenzy on the bait');
  for (let i = 0; i < 30 * 10; i++) eco.stepSchool(bar, 1 / 30, false);
  for (const c of eco.takeClues()) if (c.type === 'boil' || c.type === 'birds') boil = true;
  assert.ok(boil, 'the sea boils, and the birds come');
});
