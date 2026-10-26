// The beautiful-world and fishing-paradise update: the Ultra and Cinematic graphics levels (what
// each level draws, that Auto never picks them by itself, that the choice is saved and cleaned up,
// that the finishing pass bows out where it can't run), and the quiet places that now have fish of
// their own (the haven, the lake landing, Wend Quay, the Longmere boathouse, Fernbeck's pools):
// in the water, in homes their own rules allow, taking nobody from anywhere else, and caught on the
// tackle the field guide suggests. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const Q = await import('../src/quality.js');
const { POST_MODES, Post } = await import('../src/post.js');
const { cleanSettings } = await import('../src/settings.js');
const T = await import('../src/world/terrain.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { fishWithGuide } = await import('../tools/ecosim.mjs?nomain');

const { PRESETS, CHOICES, LEVELS, AUTO_LEVELS, GROUPS, resolveQuality, lowerLevel, startingLevel } = Q;
const ORDER = ['low', 'medium', 'high', 'ultra', 'cinematic'];

let loads = 0;
const freshSave = () => import(`../src/save.js?paradise=${++loads}`);

/* ---------------- graphics levels ---------------- */

test('Ultra and Cinematic sit above High; the lower levels and Auto are still there', () => {
  assert.deepEqual(CHOICES, ['auto', 'cinematic', 'ultra', 'high', 'medium', 'low']);
  for (const id of ORDER) assert.deepEqual(Object.keys(PRESETS[id]).sort(), Object.keys(PRESETS.high).sort(), `${id} sets everything High does`);
  // Each step up draws at least as much as the one below it, and Ultra and Cinematic each draw
  // more than the level under them in ways you see in play.
  const more = ['pixelRatio', 'minRatio', 'shadowSize', 'shadowSpan', 'waterSegments', 'reflection', 'ripples', 'rippleSpan', 'plants', 'particles', 'mist', 'drawDistance', 'fishNear', 'simRadius'];
  for (let i = 1; i < ORDER.length; i++) {
    const lo = PRESETS[ORDER[i - 1]], hi = PRESETS[ORDER[i]];
    for (const k of more) assert.ok(hi[k] >= lo[k], `${ORDER[i]} ${k} ${hi[k]} ≥ ${ORDER[i - 1]} ${lo[k]}`);
    assert.ok(hi.air <= lo.air, `${ORDER[i]} air no hazier`);
  }
  const better = (a, b) => more.filter((k) => PRESETS[a][k] > PRESETS[b][k]);
  assert.ok(better('ultra', 'high').length >= 6, `Ultra over High: ${better('ultra', 'high')}`);
  assert.ok(better('cinematic', 'ultra').length >= 5, `Cinematic over Ultra: ${better('cinematic', 'ultra')}`);
  // Only the top two have the finishing pass, and each has its own.
  assert.deepEqual(ORDER.map((id) => PRESETS[id].post), [null, null, null, 'ultra', 'cinematic']);
  assert.deepEqual(Object.keys(POST_MODES).sort(), ['cinematic', 'ultra']);
  assert.ok(POST_MODES.cinematic.shafts > 0 && POST_MODES.ultra.shafts === 0, 'shafts of light on Cinematic only');
  // High and below look as they always have: the old haze and draw distance.
  for (const id of ['low', 'medium', 'high']) assert.ok(PRESETS[id].air === 1 && PRESETS[id].drawDistance === 650 && !PRESETS[id].minRatio);
});

test('Auto never picks Ultra or Cinematic by itself, and steps down through every level', () => {
  assert.ok(!AUTO_LEVELS.includes('ultra') && !AUTO_LEVELS.includes('cinematic'));
  for (const touch of [true, false]) assert.ok(AUTO_LEVELS.includes(startingLevel(touch)), `starts at ${startingLevel(touch)}`);
  // Stepping down from wherever it starts only ever goes down.
  for (const start of ['high', 'medium']) {
    const seen = [];
    for (let l = start; l; l = lowerLevel(l)) seen.push(l);
    assert.ok(seen.every((l) => AUTO_LEVELS.includes(l)), seen.join(' → '));
    assert.equal(seen.at(-1), 'low');
  }
  assert.deepEqual(['cinematic', 'ultra', 'high', 'medium', 'low'].map(lowerLevel), ['ultra', 'high', 'medium', 'low', null]);
});

test('parts chosen on their own still mix with the top levels', () => {
  // Cinematic with the water turned down keeps its finishing pass and its far view.
  const a = resolveQuality('cinematic', { water: 'low', shadows: 'off' });
  for (const k of GROUPS.water.keys) assert.equal(a[k], PRESETS.low[k], k);
  assert.equal(a.post, 'cinematic');
  assert.equal(a.drawDistance, PRESETS.cinematic.drawDistance);
  assert.equal(a.shadows, false);
  // High with Ultra vegetation draws Ultra's grass and weed.
  const b = resolveQuality('high', { plants: 'ultra', scale: 0.8 });
  assert.equal(b.plants, PRESETS.ultra.plants);
  assert.equal(b.post, null);
  assert.equal(b.scale, 0.8);
  assert.ok(LEVELS.includes('ultra') && !LEVELS.includes('cinematic'), 'parts go up to Ultra; Cinematic is a preset of its own');
});

test('the graphics choice is saved and restored, and junk falls back to Auto', async () => {
  for (const preset of ['cinematic', 'ultra']) {
    const g = cleanSettings({ graphics: { preset, water: 'ultra', plants: 'cinematic', scale: 0.9, shadows: 'on' } }).graphics;
    assert.equal(g.preset, preset);
    assert.equal(g.water, 'ultra');
    assert.equal(g.plants, 'auto', 'no such vegetation level: back to the preset');
    assert.equal(g.scale, 0.9);
  }
  assert.equal(cleanSettings({ graphics: { preset: 'photoreal' } }).graphics.preset, 'auto');
  // Through a whole save and load.
  const S = await freshSave();
  const s = S.sanitize({ quality: 'cinematic', settings: { graphics: { preset: 'cinematic' } } });
  assert.equal(s.quality, 'cinematic');
  assert.equal(s.settings.graphics.preset, 'cinematic');
  const again = S.sanitize(JSON.parse(JSON.stringify(s)));
  assert.equal(again.settings.graphics.preset, 'cinematic');
  // An older save, from before these levels, loads as it was.
  const old = S.sanitize({ quality: 'medium' });
  assert.equal(old.settings.graphics.preset, 'medium');
});

test('the finishing pass bows out quietly where it can’t run', () => {
  // A browser without WebGL 2: the levels still work, just without the pass.
  const r = { capabilities: { isWebGL2: false } };
  const p = new Post(r);
  p.setMode('cinematic');
  assert.equal(p.on, false);
  p.finish({}, {}); // (does nothing, throws nothing)
  // With WebGL 2 it's on for the top levels only, and off again below them.
  const q = new Post({ capabilities: { isWebGL2: true } });
  q.setMode('ultra');
  assert.equal(q.on, true);
  q.setMode('high');
  assert.equal(q.on, false);
  q.setMode('cinematic');
  assert.equal(q.on, true);
  q.setMode(null);
  assert.equal(q.on, false);
});

/* ---------------- fish in the quiet places ---------------- */

const QUIET = {
  haven: { at: T.HAVEN_QUAY.end, kinds: ['mullet', 'gilthead', 'conger', 'squid', 'sandsmelt'] },
  landing: { at: { x: T.PIERS[1].x1, z: (T.PIERS[1].z0 + T.PIERS[1].z1) / 2 }, kinds: ['sandsmelt', 'gilthead'] },
  quay: { at: T.QUAY.end, kinds: ['mullet', 'seabass'] },
  boathouse: { at: { x: T.BOATHOUSE_PIER.x0, z: T.BOATHOUSE_PIER.z0 }, kinds: ['perch', 'roach', 'pike'] },
};

test('the haven, the lake landing, Wend Quay and the Longmere boathouse have fish of their own', () => {
  const habitat = createHabitat();
  const eco = new Ecosystem(habitat);
  for (const [tag, q] of Object.entries(QUIET)) {
    const spots = habitat.spots.filter((s) => s.hosts?.length && s.tag === tag);
    assert.ok(spots.length, `${tag} has homes of its own`);
    for (const s of spots) {
      assert.ok(s.depth > 1.2, `${tag} ${s.type} in water ${s.depth.toFixed(1)} m deep`);
      assert.ok(Math.hypot(s.x - q.at.x, s.z - q.at.z) < 15, `${tag} ${s.type} within a cast of where you fish from`);
    }
    const here = eco.agents.filter((a) => spots.includes(a.home));
    for (const id of q.kinds) assert.ok(here.some((a) => a.sp.id === id), `${id} at the ${tag}`);
    // Each in a home its own rules allow (the right kind of water, in the right zone), and only
    // the kinds the home is kept for.
    for (const a of here) {
      assert.ok(a.L.homes.includes(a.home.type) && a.L.zones.includes(a.home.zone), `${a.sp.id} in a ${a.home.zone} ${a.home.type}`);
      assert.ok(a.home.hosts.includes(a.sp.id));
    }
  }
  // Home's harbour is busy now: dozens of fish within a cast of the quay's end, of five kinds or
  // more (it had a dozen, of three).
  const A = QUIET.haven.at;
  const near = eco.agents.filter((a) => Math.hypot(a.home.x - A.x, a.home.z - A.z) < 35);
  assert.ok(near.length >= 35, `${near.length} fish by the haven quay`);
  assert.ok(new Set(near.map((a) => a.sp.id)).size >= 5);
});

test('more fish, but not absurdly many; Fernbeck’s pools all hold fish', () => {
  const eco = new Ecosystem(createHabitat());
  // (At home: Las Brasas, far to the south, has its own, see tests/brasas.test.mjs; so do the
  // dive sites, see tests/divesites.test.mjs.)
  const n = eco.agents.filter((a) => !a.home.south && !a.home.site).length;
  assert.ok(n > 2300 && n < 2500, `${n} fish in all`);
  const stream = eco.agents.filter((a) => a.home.zone === 'stream');
  assert.ok(stream.length >= 18, `${stream.length} in the stream`);
  const pools = new Set(stream.map((a) => a.home));
  const all = eco.habitat.spots.filter((s) => s.type === 'pool' && s.zone === 'stream');
  assert.equal(pools.size, all.length, 'a fish in every pool');
  assert.ok(stream.some((a) => a.sp.id === 'trout') && stream.some((a) => a.sp.id === 'grayling'));
  // Never a crowd: no more than a handful in one small pool.
  for (const p of all) assert.ok(stream.filter((a) => a.home === p).length <= 7);
});

test('the tackle the field guide suggests catches the new residents, there (headless ecosystem)', () => {
  const eco = new Ecosystem(createHabitat());
  const at = (id, tag) => eco.bySpecies[id].map((a, i) => [a, i]).filter(([a]) => a.home.hosts && a.home.tag === tag).map(([, i]) => i);
  const failed = [];
  for (const [id, tag] of [['gilthead', 'haven'], ['conger', 'haven'], ['sandsmelt', 'landing'], ['perch', 'boathouse'], ['roach', 'boathouse'], ['seabass', 'quay']]) {
    const homes = at(id, tag).slice(0, 2);
    assert.ok(homes.length, `${id} at the ${tag}`);
    let r = fishWithGuide(eco, id, { homes, tries: 3 });
    // (A wary fish can lose the bait to a quicker neighbour: a second go.)
    if (!r.hits) r = fishWithGuide(eco, id, { homes, tries: 4 });
    if (!r.hits) failed.push(`${id} at the ${tag} on ${r.setup.rod}/${r.setup.item}: ${r.results.join(', ')}`);
  }
  assert.deepEqual(failed, []);
});
