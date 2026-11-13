// E1, the advanced sonar (src/sonarRead.js, src/sonar.js): everything on its screen comes from the
// world. What the bottom is and how hard it sends the ping back (the same split the divers' seabed
// uses), the summer's thermocline where the water has one, every echo a real fish in the beam (its
// echoes joined into one arch as it crosses), a bait ball's cloud, and what it shows noted so a
// catch soon after can teach you what an arch was.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// (A stand-in page for the fish finder's panel: it draws on a canvas nobody sees.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : () => {}), set: () => true });
const el = () => ({
  addEventListener() {}, setAttribute() {}, querySelector: () => null, getContext: () => ctx2d,
  classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, style: {}, hidden: false, textContent: '',
  width: 0, height: 0, offsetWidth: 300, offsetHeight: 200, getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 200 }),
});
const els = new Map();
globalThis.document ??= { getElementById: (id) => els.get(id) || (els.set(id, el()), els.get(id)), querySelectorAll: () => [], querySelector: () => null, body: { classList: { toggle() {} } } };
globalThis.innerWidth ??= 1280;
globalThis.innerHeight ??= 800;
globalThis.requestAnimationFrame ??= () => 0;

const { bottomOf, bottomWords, layers, sediment } = await import('../src/sonarRead.js');
const { FishFinder } = await import('../src/sonar.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { seaTemp } = await import('../src/world/seatemp.js');
const { seabedKind } = await import('../src/world/seabed.js');
const { zoneAt } = await import('../src/world/terrain.js');
const { seeSign, readSign, SIGNS } = await import('../src/grounds.js');
const { seeded } = await import('../src/util.js');

const habitat = createHabitat();
const withDice = (fn, seed = 3) => {
  const r = Math.random;
  Math.random = seeded(seed);
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};

test('the bottom: rock, gravel, sand, mud or weed, from the world’s own seabed, the same split the divers see', () => {
  assert.equal(bottomOf({ depth: 8, rock: 0.8, weed: 0 }, 'coast').kind, 'rock');
  assert.equal(bottomOf({ depth: 5, rock: 0, weed: 0 }, 'coast').kind, 'sand');
  assert.equal(bottomOf({ depth: 40, rock: 0, weed: 0 }, 'deep').kind, 'mud');
  assert.equal(bottomOf({ depth: 4, rock: 0, weed: 0 }, 'estuary').kind, 'mud');
  assert.equal(bottomOf({ depth: 1, rock: 0, weed: 0 }, 'stream').kind, 'gravel');
  assert.equal(bottomOf({ depth: 1.5, rock: 0, weed: 0 }, 'lake').kind, 'sand');
  assert.equal(bottomOf({ depth: 6, rock: 0, weed: 0 }, 'lake').kind, 'mud');
  const weed = bottomOf({ depth: 4, rock: 0, weed: 0.7 }, 'bay');
  assert.equal(bottomWords(weed), 'weed over sand');
  // How hard: rock hardest, then gravel, sand, mud; weed softens what it grows on.
  const H = (kind) => bottomOf(kind === 'rock' ? { depth: 8, rock: 0.8, weed: 0 } : { depth: kind === 'mud' ? 40 : 5, rock: 0, weed: 0 }, kind === 'gravel' ? 'river' : 'coast').hard;
  assert.ok(H('rock') > H('gravel') && H('gravel') > H('sand') && H('sand') > H('mud'), 'rock > gravel > sand > mud');
  assert.ok(weed.hard < bottomOf({ depth: 4, rock: 0, weed: 0 }, 'bay').hard, 'weed softens it');
  // Over the real seabed: wherever the divers find rock life, the sonar reads rock; on open sand, sand.
  let n = 0;
  const s = {};
  for (let x = -400; x <= 600; x += 23) for (let z = -300; z <= 900; z += 23) {
    habitat.sample(x, z, s);
    if (s.depth < 1) continue;
    const zone = zoneAt(x, z), salt = !['lake', 'stream', 'mere', 'river', 'tarn'].includes(zone);
    const b = bottomOf(s, zone);
    const life = seabedKind(s, salt, 0.05);
    if (salt && s.rock > 0.35) assert.ok(b.kind === 'rock' && ['urchin', 'dahlia', 'star', 'jewel', 'sponge', 'stone'].includes(life), `rock at ${x},${z}`);
    if (salt && s.rock <= 0.35 && s.weed <= 0.4) assert.ok(['sand', 'mud'].includes(b.kind), `sea floor at ${x},${z}: ${b.kind}`);
    n++;
  }
  assert.ok(n > 300, `${n} spots checked`);
  assert.equal(sediment({ depth: 30 }, 'coast', true), 'sand', 'Las Brasas: sand deeper down');
});

test('the water’s layers: a thermocline in the summer sea, none in winter, in fresh water, or over shallow ground', () => {
  const at = (day, zone) => (d) => seaTemp({ abs: day * 24 + 12, zone, depth: d });
  // Late summer, over 30 m of open sea: warm on top, cold below, the change steepest in the middle.
  // (The game's year is four seven-day seasons; day 10 is late summer, day 24 late winter.)
  const summer = layers(at(10, 'open'), 30);
  assert.ok(summer.cline > 10 && summer.cline < 22, `thermocline at ${summer.cline} m`);
  assert.ok(summer.top - summer.bottom > 4, `${summer.top}°C on top, ${summer.bottom}°C at the bottom`);
  // Late winter: mixed top to bottom.
  const winter = layers(at(24, 'open'), 30);
  assert.equal(winter.cline, null, 'winter: none');
  assert.ok(Math.abs(winter.top - winter.bottom) < 1);
  assert.equal(layers(at(10, 'lake'), 12).cline, null, 'fresh water: none');
  assert.equal(layers(at(10, 'open'), 6).cline, null, 'over 6 m: above any layer');
});

// A fish finder on the real ecosystem, with a boat at (x, z).
const finderOn = (eco, sighted = () => {}) => {
  const state = {};
  const F = new FishFinder(eco, habitat, state, { sighted });
  F.visible = true;
  return F;
};
const ping = (F, src) => {
  F.timer = 0;
  F.update(0.1, src, { active: false });
};

test('every echo is a real fish in the beam, and a fish crossing the beam draws one arch', () => {
  const eco = new Ecosystem(habitat);
  // Open water about 10 m deep, clear of fish but one.
  let x = 0, z = 0;
  const s = {};
  for (let i = 0; i < 4000; i++) {
    x = -300 + (i % 70) * 13;
    z = 200 + Math.floor(i / 70) * 13;
    habitat.sample(x, z, s);
    if (s.depth > 9 && s.depth < 14 && s.rock < 0.2 && s.weed < 0.2) break;
  }
  for (const a of eco.agents) if (Math.hypot(a.x - x, a.z - z) < 30) a.active = false;
  const fish = eco.agents.find((a) => !a.school && a.scale > 0.5 && !a.L.observe);
  Object.assign(fish, { active: true, state: 'cruise', y: -5 });
  const F = finderOn(eco);
  // It swims across under the boat: the echo's depth (the slant range) dips as it nears the middle
  // of the beam and rises as it leaves: an arch.
  const depths = [];
  withDice(() => {
    for (let k = -8; k <= 8; k++) {
      fish.x = x + k * 0.25;
      fish.z = z;
      ping(F, { x, z, mode: 'boat', moving: 0 });
      const p = F.pings[F.pings.length - 1];
      for (const e of p.fish) assert.equal(e.id, fish.id, 'only the one fish there is');
      const e = p.fish.find((q) => q.id === fish.id);
      if (e) depths.push(e.depth);
    }
  }, 9);
  assert.ok(depths.length >= 10, `${depths.length} echoes of it`);
  const mid = Math.min(...depths), ends = [depths[0], depths[depths.length - 1]];
  assert.ok(ends.every((d) => d > mid + 0.05), `an arch: ${ends.map((d) => d.toFixed(2))} at the edges, ${mid.toFixed(2)} in the middle`);
  // One fish, one symbol, its echoes joined ping to ping (the same id).
  const labels = F.pings.flatMap((p) => p.labels || []);
  assert.equal(labels.length, 1);
  // Holding still under a still boat: a flat line.
  const flat = [];
  withDice(() => {
    for (let k = 0; k < 8; k++) {
      Object.assign(fish, { x, z, y: -5 });
      ping(F, { x, z, mode: 'boat', moving: 0 });
      const e = F.pings[F.pings.length - 1].fish.find((q) => q.id === fish.id);
      if (e) flat.push(e.depth);
    }
  }, 4);
  assert.ok(flat.length >= 6 && Math.max(...flat) - Math.min(...flat) < 0.4, 'a flat line');
});

test('a bait ball shows as a cloud from its top to its bottom', () => {
  const eco = new Ecosystem(habitat);
  const S = eco.forage.find((f) => f.sp.id === 'sprat' && habitat.depth(f.home.x, f.home.z) > 8);
  const x = S.home.x, z = S.home.z;
  S.members.forEach((m, i) => Object.assign(m, { x: x + ((i % 3) - 1) * 0.4, z: z + (Math.floor(i / 3) % 3 - 1) * 0.4, y: -3 - (i % 4) * 0.4, active: true, state: 'school' }));
  const F = finderOn(eco);
  withDice(() => ping(F, { x, z, mode: 'boat', moving: 0 }), 2);
  const p = F.pings[F.pings.length - 1];
  assert.ok(p.ball, 'a bait ball');
  assert.ok(p.ballTop >= 2.5 && p.ballBot <= 5.5 && p.ballBot > p.ballTop, `its cloud from ${p.ballTop.toFixed(1)} to ${p.ballBot.toFixed(1)} m`);
  assert.ok(F.read.ball && /bait below/.test(document.getElementById('sonar-depth').textContent));
});

test('what the sonar shows is noted for the game: each arch with what it was (never on screen), a bait ball, the thermocline, rock, a drop-off', () => {
  const eco = new Ecosystem(habitat);
  const seen = [];
  const F = finderOn(eco, (kind, i) => seen.push({ kind, ...i }));
  // Over the thermocline in late summer (the game's water temperature at each depth).
  const tempAt = (d) => seaTemp({ abs: 10 * 24 + 12, zone: 'open', depth: d });
  const fish = eco.agents.find((a) => !a.school && a.scale > 0.5 && !a.L.observe);
  // Somewhere 25 m deep, then a step onto rock, then off the edge.
  const s = {};
  let deep = null, rocky = null;
  for (let x = -600; x < 900 && !(deep && rocky); x += 11) for (let z = -400; z < 1400 && !(deep && rocky); z += 11) {
    habitat.sample(x, z, s);
    if (!deep && s.depth > 24 && s.depth < 40 && s.rock < 0.2) deep = { x, z };
    if (!rocky && s.rock > 0.6 && s.depth > 3) rocky = { x, z };
  }
  for (const a of eco.agents) if (Math.hypot(a.x - deep.x, a.z - deep.z) < 30) a.active = false;
  Object.assign(fish, { active: true, state: 'cruise', x: deep.x, z: deep.z, y: -12 });
  withDice(() => {
    for (let k = 0; k < 4; k++) ping(F, { x: deep.x, z: deep.z, mode: 'boat', moving: 0, tempAt });
  }, 5);
  const arch = seen.find((e) => e.kind === 'arch');
  assert.ok(arch && arch.sp === fish.sp.id, 'an arch, with what it really was');
  assert.ok(seen.some((e) => e.kind === 'cline' && e.depth > 10 && e.depth < 22), 'the thermocline');
  assert.ok(F.pings[F.pings.length - 1].cline != null);
  assert.ok(/below \d+ m/.test(document.getElementById('sonar-depth').textContent), 'and the readout gives the cold below');
  // Onto rock.
  ping(F, { x: rocky.x, z: rocky.z, mode: 'boat', moving: 1 });
  assert.ok(seen.some((e) => e.kind === 'rock'), 'rock under you');
  // A drop-off: shallow, then twenty pings on, deep (moving).
  const F2 = finderOn(eco, (kind, i) => seen.push({ kind: `2${kind}`, ...i }));
  for (let k = 0; k < 20; k++) ping(F2, { x: rocky.x, z: rocky.z, mode: 'boat', moving: 2 });
  ping(F2, { x: deep.x, z: deep.z, mode: 'boat', moving: 2 });
  assert.ok(seen.some((e) => e.kind === '2drop' && e.to > e.from + 2), 'the bottom falling away');
  // (Nothing on the screen ever names a fish.)
  assert.ok(!/[a-z]{3,}/i.test(F.read.fish.join(' ')), 'depths only');
});

test('reading an arch: catch that fish soon after, near where its arch showed, and you find out what it was', () => {
  assert.ok(SIGNS.arch.lesson('pollack').includes('ollack'));
  const grounds = { signs: {} }, recent = [];
  assert.ok(seeSign(grounds, recent, { type: 'arch', x: 100, z: 200, sp: 'pollack' }, 10, 3));
  // A bass caught there: that arch wasn't a bass.
  assert.equal(readSign(grounds, recent, 'seabass', 104, 198, 10.1), null);
  // The pollack, a little off, a few minutes on: read.
  const r = readSign(grounds, recent, 'pollack', 115, 210, 10.1);
  assert.deepEqual(r, { kind: 'arch', sp: 'pollack', first: true });
  assert.equal(grounds.signs.arch.read, 1);
  // Too far off, or too long after: not that arch.
  seeSign(grounds, recent, { type: 'arch', x: 300, z: 200, sp: 'pollack' }, 20, 3);
  assert.equal(readSign(grounds, recent, 'pollack', 360, 200, 20.1), null, '60 m off');
  assert.equal(readSign(grounds, recent, 'pollack', 300, 200, 21), null, 'an hour after');
});
