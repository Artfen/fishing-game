// The field guide and the species behind it: every species marked catchable can be caught with
// the setup the guide recommends (in the real ecosystem, headless), recommendations obey the
// tackle rules, the reference species' models carry their distinguishing anatomy, and the
// register stays honest. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, {
  get: (t, k) => (k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : typeof k === 'string' ? () => {} : undefined),
  set: () => true,
});
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const { FISH, fishById } = await import('../src/fish.js');
const { RODS, TACKLE, TERMS, fits, checkSetup } = await import('../src/tackle.js');
const { setupsFor, habitsOf } = await import('../src/guide.js');
const { ANATOMY, anatomyGeometry } = await import('../src/anatomy.js');
const { REGISTER, registerFor, LEGACY, FRESHWATER, REGIONS, PLAN_AS } = await import('../src/register.js');
const { execFileSync } = await import('node:child_process');
const { fileURLToPath } = await import('node:url');
const { fish, SCENARIOS } = await import('../tools/ecosim.mjs?nomain');

const REFERENCE = ['seabass', 'meagre', 'gilthead', 'sole', 'mackerel', 'cuttlefish'];

test('every species in the game has a recommended setup the tackle rules accept', () => {
  for (const sp of FISH) {
    const list = setupsFor(sp);
    assert.ok(list.length, `${sp.id}: no setup`);
    for (const s of list) {
      const rod = RODS[s.rod], it = TACKLE[s.item], term = TERMS[s.term];
      assert.ok(fits(rod, it), `${sp.id}: ${s.item} on ${s.rod}`);
      assert.ok(rod.terms.includes(s.term), `${sp.id}: ${s.term} on ${s.rod}`);
      assert.ok(rod.lines.some((l) => l.id === s.line), `${sp.id}: ${s.line} on ${s.rod}`);
      assert.deepEqual(checkSetup(rod, it, term).filter((p) => p.level === 'block'), [], `${sp.id}: blocked`);
      if (sp.life.bottom && it.type === 'bait') assert.ok(['bottom', 'ledger'].includes(rod.kind), `${sp.id}: a bottom feeder offered a ${rod.kind} rig`);
      if (it.type === 'lure') assert.ok(sp.life.strike?.lure, `${sp.id}: offered a lure it never chases`);
    }
  }
});

test('the reference species bite on the setups the guide recommends (headless ecosystem)', () => {
  const cases = { meagre: 'meagreShad', gilthead: 'gilthead', sole: 'soleNight', cuttlefish: 'cuttlefish', seabass: 'seabass', mackerel: 'mackerel' };
  for (const [id, sc] of Object.entries(cases)) {
    const scenario = SCENARIOS[sc]();
    const top = setupsFor(fishById[id]).map((s) => s.item);
    assert.ok(top.includes(scenario.item), `${id}: the scenario's ${scenario.item} is among the guide's setups`);
    const results = fish(scenario, { tries: 3, limit: 200 });
    assert.ok(results.some((r) => r.startsWith(id)), `${id}: ${results.join(', ')}`);
  }
});

test('the other real species bite on the guide’s first choice, rigged as it says (headless ecosystem)', async () => {
  const { createHabitat } = await import('../src/world/habitat.js');
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const eco = new Ecosystem(createHabitat());
  for (const id of ['mullet', 'wrasse', 'flounder', 'plaice', 'sprat']) {
    const sp = fishById[id], s = setupsFor(sp)[0], rod = RODS[s.rod], d = habitsOf(sp).depth;
    // At the hour it's keenest, at the depth the guide says for a float.
    const env = (h) => ({ hour: h, rain: 0, cloud: 0.3, daylight: h >= 7 && h < 19 ? 1 : 0.1, night: h >= 21 || h < 5 ? 1 : 0, lanternNear: false, hatch: 0.5 });
    const hour = [7, 12, 20, 23].reduce((a, h) => (sp.life.activity(env(h)) > sp.life.activity(env(a)) ? h : a), 12);
    const depth = rod.kind === 'float' ? Math.max(1, Math.round(d[0])) + 1 : 0;
    const results = [];
    for (const idx of [0, 5]) {
      const a = eco.bySpecies[id][idx];
      results.push(...fish({ kind: rod.kind === 'ledger' ? 'ledger' : rod.kind, item: s.item, depth, x: a.home.x, z: a.home.z, ax: a.home.x + 12, az: a.home.z + 10, hour, thick: 0.3, eco }, { tries: 2, limit: 200 }));
    }
    assert.ok(results.some((r) => r.startsWith(`${id} `)), `${id} on ${s.rod}/${s.item}: ${results.join(', ')}`);
  }
  // The squid at night under a light, and the tuna in a boil, have their own scenarios.
  for (const [id, sc] of [['squid', 'squidNight'], ['tuna', 'tuna']]) {
    const scenario = SCENARIOS[sc]();
    assert.equal(setupsFor(fishById[id])[0].item, scenario.item, id);
    const results = fish(scenario, { tries: 3, limit: 200 });
    assert.ok(results.some((r) => r.startsWith(id)), `${id}: ${results.join(', ')}`);
  }
});

test('the reference models carry their distinguishing anatomy', () => {
  const size = (id) => {
    const g = anatomyGeometry(id, true);
    g.computeBoundingBox();
    return g.boundingBox.getSize(new THREE.Vector3());
  };
  const dorsals = (id) => ANATOMY[id].fins.filter((f) => f.kind === 'dorsal');
  // Sea bass: two separate dorsal fins, the first spiny.
  assert.equal(dorsals('seabass').length, 2);
  assert.ok(dorsals('seabass')[1].t0 > dorsals('seabass')[0].t1, 'a gap between the bass’s dorsal fins');
  assert.equal(dorsals('seabass')[0].shape, 'spiny');
  // Mackerel: five finlets above and below, and a deeply forked tail.
  assert.equal(ANATOMY.mackerel.fins.find((f) => f.kind === 'finlets').count, 5);
  assert.ok(ANATOMY.mackerel.fins.find((f) => f.kind === 'caudal').fork >= 0.5);
  // Meagre: a truncate tail; gilthead: one continuous dorsal (spiny then soft), deep body.
  assert.equal(ANATOMY.meagre.fins.find((f) => f.kind === 'caudal').shape, 'truncate');
  assert.equal(dorsals('gilthead')[1].t0, dorsals('gilthead')[0].t1);
  const gs = size('gilthead'), ms = size('mackerel');
  assert.ok(gs.y / gs.z > (ms.y / ms.z) * 1.5, 'the gilthead is much deeper-bodied than the mackerel');
  // Sole: a flatfish with both eyes on one side (the top); cuttlefish: its own body plan.
  assert.equal(ANATOMY.sole.plan, 'flat');
  assert.ok(ANATOMY.sole.eyes.length === 2 && ANATOMY.sole.eyes.every((e) => e.x >= 0));
  assert.equal(ANATOMY.cuttlefish.plan, 'cuttle');
  assert.equal(ANATOMY.cuttlefish.eye.pupil, 'W');
  // No two reference species share a body: their outlines differ.
  const shapes = REFERENCE.map((id) => JSON.stringify([ANATOMY[id].top, ANATOMY[id].width]));
  assert.equal(new Set(shapes).size, REFERENCE.length);
});

test('every game species is accounted for: in the register, a fictional original, or fresh water', () => {
  for (const sp of FISH) {
    const ok = registerFor(sp.id) || LEGACY[sp.id] || FRESHWATER[sp.id];
    assert.ok(ok, `${sp.id} has no register entry`);
  }
  for (const id of REFERENCE) assert.ok(registerFor(id), `${id} is in the register`);
});

test('the register is sourced, and honest about what is in the game', () => {
  const ids = new Set();
  for (const r of REGISTER) {
    assert.ok(!ids.has(r.id), `duplicate ${r.id}`);
    ids.add(r.id);
    // The binomial alone (its author apart), and the game's fish called by the same name.
    assert.match(r.scientific, /^[A-Z][a-z]+ [a-z]+( [a-z]+)?$/, `${r.id}: scientific name`);
    if (fishById[r.game]) assert.equal(fishById[r.game].scientific, r.scientific);
    // (French, Spanish and Portuguese names only where a source gives them: none are made up.)
    assert.ok(r.names?.en, `${r.id}: English name`);
    assert.ok(Array.isArray(r.sources) && r.sources.length && r.sources.every((s) => /^https?:\/\//.test(s.url)), `${r.id}: sources`);
    // Every region has a status and a confidence, and says what they rest on.
    for (const reg of REGIONS) {
      const d = r.regions?.[reg.id];
      assert.ok(d, `${r.id}: no ${reg.id} entry`);
      assert.ok(['resident', 'seasonal', 'occasional', 'absent', 'unknown'].includes(d.status), `${r.id} ${reg.id}: status`);
      assert.ok(['high', 'medium', 'low'].includes(d.confidence), `${r.id} ${reg.id}: confidence`);
      assert.ok(d.basis.length > 10, `${r.id} ${reg.id}: no basis`);
    }
    if (r.status === 'catchable') assert.ok(fishById[r.game], `${r.id} is marked catchable but isn't in the game`);
    if (!fishById[r.id]) assert.notEqual(r.status, 'catchable', `${r.id} is not in the game`);
  }
  // Protected species are planned only as ones to watch.
  for (const id of ['sturgeon', 'eel', 'allisshad', 'lamprey']) assert.equal(PLAN_AS[id]?.as, 'observation', id);
  // And src/registerData.js is what the research compiles to.
  assert.doesNotThrow(() => execFileSync(process.execPath, [fileURLToPath(new URL('../tools/build-register.mjs', import.meta.url)), '--check'], { stdio: 'pipe' }));
});

test('the guide’s habits come from the simulation', () => {
  // The sole is a night feeder; the gilthead feeds by day.
  assert.match(habitsOf(fishById.sole).active, /night/);
  assert.match(habitsOf(fishById.gilthead).active, /day|morning/);
});
