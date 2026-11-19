// Step 5's last (docs/NORTH.md, "Not done", now done): a white-tailed eagle over Loch Skarn and
// another over Raven Isle, fishing; Arctic terns nesting on Tern Isle and at the head of anyone who
// walks among the nests, and fishing off its shores; Halvig Stores' door (stores and ice for her)
// and the Loch Bothy's (its stove, its sleeping platform, its book). Every bird already in the world
// keeps its place and its dice. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const THREE = await import('three');
const T = await import('../src/world/terrain.js');
const N = await import('../src/world/north.js');
const { buildBirds, BIRD_LOOK } = await import('../src/world/birds.js');
const { BIRDS } = await import('../src/birdData.js');
const TX = await import('../src/taxonomy.js');
const depth = (x, z) => T.waterLevel(x, z) - T.heightAt(x, z);

function rig() {
  const B = buildBirds(new THREE.Scene());
  const ev = { splash: [], calls: 0, moments: [] };
  B.onSplash = (x, z, k) => ev.splash.push({ x, z, k, depth: depth(x, z) });
  B.onCall = (kind) => { if (kind === 'arctictern') ev.calls++; };
  B.onMoment = (k) => ev.moments.push(k);
  let t = 0;
  const run = (secs, ctx, dt = 1 / 20) => {
    for (let i = 0; i < secs / dt; i++, t += dt) B.update(dt, t, { daylight: 1, season: 'summer', region: 'home', near: true, ...ctx });
  };
  return { B, ev, run };
}

test('every bird that was already there keeps its place and its dice; the new ones come after', () => {
  const { B } = rig();
  // (The 311 birds before these, as they were: kind, how, where, and each one's dice.)
  const old = B.birds.slice(0, 311).map((b) => [b.kind, b.how, b.x.toFixed(3), b.y.toFixed(3), b.z.toFixed(3), b.a.toFixed(6), b.dir, b.ph.toFixed(6), b.t.toFixed(6)].join(','));
  let h = 2166136261 >>> 0;
  for (const r of old) for (const c of r) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  assert.equal(h, 889780788);
  assert.deepEqual([...new Set(B.birds.slice(311).map((b) => b.kind))], ['wteagle', 'arctictern']);
  assert.deepEqual(B.colonies.slice(-4).map((c) => `${c.kind}:${c.how}`), ['wteagle:soar', 'wteagle:soar', 'arctictern:nest', 'arctictern:plunge']);
});

test('the eagle and the Arctic tern: bodies, names, notes, families, the north their home', () => {
  for (const k of ['wteagle', 'arctictern']) {
    const D = BIRDS[k];
    assert.ok(BIRD_LOOK[k] && D.note.length > 200 && D.look.includes('coast'), k);
    assert.ok(TX.FAMILIES[D.family], `${k}: its family`);
    assert.ok(TX.IUCN[D.iucn], `${k}: its status`);
  }
  assert.equal(BIRDS.wteagle.sci, 'Haliaeetus albicilla');
  assert.equal(BIRDS.arctictern.sci, 'Sterna paradisaea');
  assert.deepEqual(BIRDS.arctictern.when, ['spring', 'summer'], 'away in the Antarctic for our winter');
  assert.ok(!BIRDS.wteagle.when, 'the eagles stay all year');
  assert.ok(BIRD_LOOK.wteagle.span > 2.2 && BIRD_LOOK.wteagle.far > 1000, 'a barn door, seen from far off');
});

test('the eagles: one over Loch Skarn, one high over Raven Isle; now and then down to the water for a fish, and back up', () => {
  const { B, ev, run } = rig();
  const [loch, raven] = B.birds.filter((b) => b.kind === 'wteagle');
  assert.ok(Math.hypot(loch.home.x - N.BOTHY_BAY.x, loch.home.z - N.BOTHY_BAY.z) < 200, 'over the loch by Bothy Bay');
  assert.ok(Math.hypot(raven.home.x - N.RAVEN.x, raven.home.z - N.RAVEN.z) < 300 && raven.home.y > T.heightAt(raven.home.x, raven.home.z) + 50, 'well above Raven Isle');
  // Seen from a long way off: the loch's from the bothy's door, Raven Isle's from Halvig.
  run(2, { from: N.NORTH_DOORS.shop });
  assert.ok(raven.g.visible, 'Raven Isle’s eagle from Halvig');
  const from = N.NORTH_DOORS.bothy;
  run(2, { from });
  assert.ok(loch.g.visible, 'the loch’s from the bothy');
  assert.ok(!raven.g.visible, 'not drawn from the far side of the sound');
  // Not straight away: circling first.
  assert.equal(loch.mode, 'circle');
  loch.t = 0.05;
  let low = Infinity, back = false;
  for (let s = 0; s < 240 && !back; s++) {
    run(1, { from });
    low = Math.min(low, loch.y);
    back = ev.splash.length > 0 && loch.mode === 'circle';
  }
  const catchSplash = ev.splash.find((s) => s.k === 0.5);
  assert.ok(catchSplash, 'a fish taken with a splash');
  assert.ok(catchSplash.depth > 3, 'from deep water, not the shore');
  assert.ok(low < T.waterLevel(catchSplash.x, catchSplash.z) + 1.5, 'right down to the surface');
  assert.ok(back && loch.y > loch.home.y - 6, 'and back up to its circle');
  assert.ok(ev.moments.includes('eagleFish'));
  // At night, roosting: not drawn.
  run(1, { from, daylight: 0.05 });
  assert.ok(!loch.g.visible);
});

test('Arctic terns nest on Tern Isle\'s machair in spring and summer, and go for your head when you walk among the nests', () => {
  const { B, ev, run } = rig();
  const nests = B.birds.filter((b) => b.how === 'nest');
  assert.ok(nests.length >= 20);
  for (const b of nests) {
    const h = T.heightAt(b.home.x, b.home.z);
    assert.ok(h >= 2.5 && h <= 8.5 && Math.abs(b.home.y - h) < 0.01, 'on the dry turf, not the beach or the top');
    assert.ok(Math.hypot(b.home.x - N.TERN.x, b.home.z - N.TERN.z) < 320, 'on Tern Isle');
  }
  const n0 = nests[0].home;
  // Walking along the beach well away: they sit tight.
  const far = { x: n0.x + 200, z: n0.z };
  run(3, { from: far });
  assert.ok(nests.every((b) => b.g.visible));
  const sitting = nests.filter((b) => b.state === 'stand').length;
  // Among the nests: up, round and over you, calling, now and then down at your head.
  const you = { x: n0.x + 1, z: n0.z };
  run(6, { from: you });
  const up = nests.filter((b) => b.state === 'mob');
  assert.ok(up.length >= 2, `the colony up round you (${up.length})`);
  for (const b of up) {
    assert.ok(Math.hypot(b.x - you.x, b.z - you.z) < 12, 'right over you');
    assert.ok(b.y - T.heightAt(b.x, b.z) > 1.5 && b.y - T.heightAt(b.x, b.z) < 8, 'about head height and a little over');
  }
  assert.ok(ev.calls > 3, 'screaming');
  assert.equal(ev.moments.filter((m) => m === 'ternMob').length, 1, 'said once');
  // Walk on to the beach and they settle again.
  run(30, { from: far });
  assert.equal(nests.filter((b) => b.state === 'stand').length, nests.length);
  assert.ok(sitting <= nests.length);
  // Gone in the autumn and winter.
  run(1, { from: you, season: 'winter' });
  assert.ok(!B.birds.some((b) => b.kind === 'arctictern' && b.g.visible));
});

test('…and fish round its shores: hovering, then a plunge into the water, and up again', () => {
  const { B, ev, run } = rig();
  const fishers = B.birds.filter((b) => b.how === 'plunge');
  assert.ok(fishers.length >= 4);
  for (const b of fishers) assert.ok(depth(b.home.x, b.home.z) > 1.5, 'over the water');
  run(60, { from: { x: fishers[0].home.x, z: fishers[0].home.z } });
  const dives = ev.splash.filter((s) => s.k < 0.2);
  assert.ok(dives.length >= 3, `dives (${dives.length})`);
  assert.ok(dives.every((s) => s.depth > 0.5), 'into the water, never onto the sand');
});

test('Halvig Stores\' door and the Loch Bothy\'s: outside each, on dry ground, where the game finds them', async () => {
  const D = N.NORTH_DOORS;
  for (const [door, B, place] of [[D.shop, N.HALVIG_SHOP, 'halvig'], [D.bothy, { ...N.NORTH_BOTHY, w: 6, d: 4.2 }, 'lochbothy']]) {
    // In the building's own frame: in front of its door, a metre or so out.
    const c = Math.cos(B.yaw), s = Math.sin(B.yaw), dx = door.x - B.x, dz = door.z - B.z;
    const u = dx * c - dz * s, w = dx * s + dz * c;
    assert.ok(Math.abs(u) < B.w / 2 && w > B.d / 2 + 0.5 && w < B.d / 2 + 2, `${place}: in front of the door (${u.toFixed(1)}, ${w.toFixed(1)})`);
    assert.ok(T.heightAt(door.x, door.z) > 1, `${place}: on dry ground`);
    const P = N.NORTH_PLACES.find((p) => p.id === place);
    assert.ok(Math.hypot(door.x - P.x, door.z - P.z) < P.r, `${place}: within the place`);
  }
  // Built with the north's things: the two doors among its spots, clear of every obstacle.
  const { buildNorth } = await import('../src/world/northWorld.js');
  const { seeded } = await import('../src/util.js');
  const R = buildNorth(new THREE.Scene(), seeded(7));
  const spot = (k) => R.spots.find((q) => q.kind === k);
  assert.ok(spot('halvigstores') && spot('lochbothy'));
  assert.ok(Math.hypot(spot('halvigstores').x - D.shop.x, spot('halvigstores').z - D.shop.z) < 0.01);
  assert.ok(Math.hypot(spot('lochbothy').x - D.bothy.x, spot('lochbothy').z - D.bothy.z) < 0.01);
  for (const q of [spot('halvigstores'), spot('lochbothy')]) {
    for (const o of R.obstacles) assert.ok(Math.hypot(q.x - o.x, q.z - o.z) > o.r, `${q.name}: you can stand there (clear of ${o.name || o.kind})`);
  }
});

test('the bothy book is remembered in the save', async () => {
  const { sanitize, DEFAULT_STATE } = await import('../src/save.js');
  const s = sanitize({ ...structuredClone(DEFAULT_STATE), tips: { lochBook: true, lochBothyTip: true, halvigTip: true } });
  assert.equal(s.tips.lochBook, true);
  assert.equal(s.tips.halvigTip, true);
});
