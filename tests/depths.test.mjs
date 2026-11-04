// The angling depth release (R4): the thornback ray, the small-spotted catshark, the lesser
// weever, the European hake and the John Dory, each with its own place, season, bite and fight:
// the ray plating on the sand, the catshark rolling in the line, the hake's soft mouth, the
// weever's venom, the dory on the wrecks.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { FISH, fishById } = await import('../src/fish.js');
const { DEPTHS } = await import('../src/atlantic.js');
const { FIGHT_STYLES, newFight, DIFFICULTY } = await import('../src/fight.js');
const { RODS } = await import('../src/tackle.js');
const { PRICES } = await import('../src/market.js');
const { registerFor } = await import('../src/register.js');
const { SEASON_FISH, seasonBoost } = await import('../src/world/season.js');
const { ATLANTIC_ANATOMY } = await import('../src/anatomyAtlantic.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { zoneAt, WRECK } = await import('../src/world/terrain.js');

const IDS = ['thornback', 'catshark', 'weever', 'hake', 'johndory'];

test('five new kinds, joined after every other fish, with real names and models of their own', () => {
  assert.deepEqual(DEPTHS.map((f) => f.id), IDS);
  assert.deepEqual(FISH.slice(-5).map((f) => f.id), IDS, 'last of all, so no fish moves');
  const latin = { thornback: 'Raja clavata', catshark: 'Scyliorhinus canicula', weever: 'Echiichthys vipera', hake: 'Merluccius merluccius', johndory: 'Zeus faber' };
  for (const id of IDS) {
    const sp = fishById[id];
    assert.equal(sp.scientific, latin[id]);
    assert.equal(registerFor(id)?.status, 'catchable', `${id} is catchable in the register`);
    assert.ok(ATLANTIC_ANATOMY[id], `${id} has its anatomical model`);
    assert.ok(sp.note.length > 120 && sp.hint.length > 80, `${id} has its field-guide words`);
  }
});

test('the ray goes back (near threatened) and the weever too (venomous and tiny); the rest are good eating', () => {
  for (const id of ['thornback', 'weever']) {
    assert.equal(fishById[id].meal, undefined, `${id}: no Keep`);
    assert.ok(fishById[id].keep.length > 40);
    assert.equal(PRICES[id], undefined, `${id} isn't sold`);
  }
  assert.equal(fishById.weever.venom, true);
  assert.match(fishById.thornback.keep, /threatened/);
  for (const id of ['catshark', 'hake', 'johndory']) {
    assert.ok(fishById[id].meal?.name, `${id} has a meal`);
    assert.ok(PRICES[id] > 0, `${id} has a price`);
  }
  assert.ok(PRICES.johndory > PRICES.hake && PRICES.hake > PRICES.catshark, 'the dory dearest, the huss cheapest');
});

test('each fights as itself: the ray plating, the catshark rolling, the hake soft-mouthed', () => {
  assert.equal(fishById.thornback.fight, 'plate');
  assert.equal(fishById.catshark.fight, 'roll');
  const P = FIGHT_STYLES.plate, F = FIGHT_STYLES.flat, R = FIGHT_STYLES.roll;
  assert.ok(P.dive >= F.dive && P.sway > F.sway && P.tire < F.tire, 'a ray kites wider, clamps as hard and tires slower than a flatfish');
  assert.ok(R.run < 0.8 && R.surge > 1 && R.tire > 1, 'a catshark rolls in short, jerky bursts and soon tires');
  for (const s of [P, R]) assert.ok(s.words.length > 20 && s.splash === false);
  // The hake's soft mouth: a light hold most of the time (where hooks can pull at all).
  const RB = RODS.boat;
  const rod = { line: { ...RB.lines[0], trace: false }, power: RB.power, flex: RB.flex, drag: RB.drag };
  const level = { pull: 0.5, throwHook: 0.1 };
  let soft = 0, hard = 0;
  let r = 1;
  const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 400; i++) {
    if (newFight(fishById.hake, 60, rod, DIFFICULTY.standard || Object.values(DIFFICULTY)[0], false, rnd, { level }).hold === 'light') soft++;
    if (newFight(fishById.pollack, 60, rod, DIFFICULTY.standard || Object.values(DIFFICULTY)[0], false, rnd, { level }).hold === 'light') hard++;
  }
  assert.ok(soft > 240 && hard < 160, `light holds: hake ${soft}, pollack ${hard} (of 400)`);
  assert.equal(newFight(fishById.hake, 60, rod, DIFFICULTY.standard || Object.values(DIFFICULTY)[0], false, rnd, { level }).soft, true);
  // (On Relaxed, where no hook pulls, nothing changes.)
  assert.equal(newFight(fishById.hake, 60, rod, DIFFICULTY.standard || Object.values(DIFFICULTY)[0], false, rnd, { level: { pull: 0, throwHook: 0 } }).hold, 'solid');
});

test('their seasons: rays in spring, weevers in summer, hake in the dark months, dories late summer', () => {
  const at = (id, season) => SEASON_FISH[id][['spring', 'summer', 'autumn', 'winter'].indexOf(season)];
  assert.ok(at('thornback', 'spring') > at('thornback', 'winter'));
  assert.ok(at('weever', 'summer') > 1 && at('weever', 'winter') < 0.2);
  assert.ok(at('hake', 'winter') > at('hake', 'summer'));
  assert.ok(at('johndory', 'autumn') > at('johndory', 'winter'));
  for (const id of IDS) assert.ok(seasonBoost(fishById[id], 100) > 0);
});

test('where they live: rays and weevers on the sand, hake in the deep, dories round the rocks and wrecks', () => {
  const eco = new Ecosystem(createHabitat());
  const of = (id) => eco.bySpecies[id];
  for (const id of IDS) assert.ok(of(id).length >= 4, `${id}: ${of(id).length} in the water`);
  for (const a of of('thornback')) assert.ok(['sand', 'channel'].includes(a.home.type), a.home.type);
  for (const a of of('weever')) {
    assert.equal(a.home.type, 'sand');
    assert.ok(a.home.depth == null || a.home.depth < 12, `weever at ${a.home.depth}`);
  }
  for (const a of of('hake')) assert.ok(['blue', 'deep'].includes(a.home.type), a.home.type);
  assert.ok(of('hake').every((a) => a.home.depth == null || a.home.depth > 6), 'only in deep holes');
  for (const a of of('johndory')) assert.ok(['reef', 'rock', 'deep', 'wreck'].includes(a.home.type), a.home.type);
  // (Catsharks everywhere on the bottom, the commonest of them.)
  assert.ok(of('catshark').length > of('thornback').length);
});

test('none of them leaps when hooked', async () => {
  const B = await import('../src/behaviour.js');
  for (const id of ['thornback', 'catshark', 'weever', 'johndory']) {
    assert.equal(B.prefsFor(id).jumpy, 0, id);
  }
  assert.ok(B.prefsFor('hake').jumpy <= 0.1);
});
