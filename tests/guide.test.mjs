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

// (The ecosystem rolls dice: a fixed seed, so a species that bites, bites every run.)
const { seeded } = await import('../src/util.js');
Math.random = seeded(20261025);

const THREE = await import('three');
const { FISH, fishById } = await import('../src/fish.js');
const { RODS, TACKLE, TERMS, fits, checkSetup } = await import('../src/tackle.js');
const { setupsFor, habitsOf } = await import('../src/guide.js');
const { ANATOMY, anatomyGeometry } = await import('../src/anatomy.js');
const { REGISTER, registerFor, LEGACY, FRESHWATER, MACARONESIA, REGIONS, PLAN_AS } = await import('../src/register.js');
const { execFileSync } = await import('node:child_process');
const { fileURLToPath } = await import('node:url');
const { fish, fishWithGuide, SCENARIOS } = await import('../tools/ecosim.mjs?nomain');

const REFERENCE = ['seabass', 'meagre', 'gilthead', 'sole', 'mackerel', 'cuttlefish'];

test('every species in the game has a recommended setup the tackle rules accept', () => {
  for (const sp of FISH) {
    if (sp.retired || sp.life.observe) continue; // (retired fish are gone; protected ones are only watched)
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

test('every other catchable species bites on the guide’s first choice, rigged as it says (headless ecosystem)', async () => {
  const { createHabitat } = await import('../src/world/habitat.js');
  const { Ecosystem } = await import('../src/world/ecosystem.js');
  const eco = new Ecosystem(createHabitat());
  const special = new Set([...REFERENCE, 'squid', 'tuna']);
  const failed = [];
  for (const sp of FISH) {
    if (sp.retired || sp.life.observe || sp.water === 'fresh' || special.has(sp.id)) continue;
    let r = fishWithGuide(eco, sp.id);
    // (A wary fish can lose the bait to quicker neighbours: give it a second chance elsewhere.)
    if (!r.hits) r = fishWithGuide(eco, sp.id, { homes: [1, 3, 7], tries: 3 });
    if (!r.hits) failed.push(`${sp.id} on ${r.setup.rod}/${r.setup.item}: ${r.results.join(', ')}`);
  }
  assert.deepEqual(failed, []);
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

test('every game species is accounted for: in the register, a fictional original, fresh water, or Las Brasas', () => {
  for (const sp of FISH) {
    const ok = registerFor(sp.id) || LEGACY[sp.id] || FRESHWATER[sp.id] || MACARONESIA[sp.id];
    assert.ok(ok, `${sp.id} has no register entry`);
  }
  // Las Brasas' own fish outside the register carry their scientific name, the same in the game.
  for (const [id, m] of Object.entries(MACARONESIA)) {
    assert.ok(fishById[id] && !registerFor(id), `${id}: in the game, and not in the register`);
    assert.match(m.scientific, /^[A-Z][a-z]+ [a-z]+$/, `${id}: scientific name`);
    assert.equal(fishById[id].scientific, m.scientific, id);
    assert.ok(m.note.length > 20, `${id}: note`);
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
  for (const id of ['sturgeon', 'allisshad', 'lamprey']) assert.equal(PLAN_AS[id]?.as, 'observation', id);
  // The eel is in the water to be watched only: it ignores every bait.
  assert.equal(registerFor('eel').status, 'observation');
  assert.ok(fishById.eel.life.observe && !Object.keys(fishById.eel.food).length);
  // The dusky grouper (Las Brasas) is caught and released, never kept; the angelshark and the
  // trumpetfish are only watched.
  assert.equal(registerFor('grouper').status, 'catchable');
  assert.ok(!fishById.grouper.meal && fishById.grouper.keep);
  for (const id of ['angelshark', 'trumpetfish']) assert.ok(fishById[id].life.observe && !Object.keys(fishById[id].food).length, id);
  // And src/registerData.js is what the research compiles to.
  assert.doesNotThrow(() => execFileSync(process.execPath, [fileURLToPath(new URL('../tools/build-register.mjs', import.meta.url)), '--check'], { stdio: 'pipe' }));
});

test('the guide’s habits come from the simulation', () => {
  // The sole is a night feeder; the gilthead feeds by day.
  assert.match(habitsOf(fishById.sole).active, /night/);
  assert.match(habitsOf(fishById.gilthead).active, /day|morning/);
});

// The "why nothing's biting" advice only gives reasons the simulation plays by, and never says
// where a fish is.
test('the advice explains a quiet line with reasons from the simulation', async () => {
  const { diagnose } = await import('../src/advice.js');
  // A spot of open coast that suits bonito, mid-morning.
  const map = { suitableAt: () => true };
  const eco = { activity: { bonito: 1, sole: 1 }, ctx: { hour: 10, night: 0 }, bait: { motion: 'fast', nearBottom: false, thick: 0.2 } };
  const at = (rod, item, extra = {}) => ({
    hook: { x: 0, z: 300 }, item: TACKLE[item], rod: RODS[rod], baitDepth: 2, bottom: 12, status: 'quiet',
    interest: { at: { x: 0, z: 300 }, looks: 0, follows: 0, left: 0 }, ...extra,
  });
  const keys = (r) => r.reasons.map((x) => x.key);
  const bonito = fishById.bonito, sole = fishById.sole;
  // All as it likes it: nothing to fix, and no hint at where the fish are.
  const fine = diagnose(at('sea', 'metal'), eco, map, bonito);
  assert.deepEqual(keys(fine), ['fine']);
  assert.doesNotMatch(fine.reasons[0].text, /\d+ ?m (north|south|east|west)|\b\d{2,} m away/);
  // The wrong thing on the hook.
  assert.ok(keys(diagnose(at('sea', 'sabiki'), eco, map, bonito)).includes('food'));
  // A slowly wound metal for a fish that wants it fast: it follows, and the advice says why it turns away.
  const slow = { ...eco, bait: { ...eco.bait, motion: 'slow' } };
  const follow = at('sea', 'metal', { status: 'follow', interest: { at: { x: 0, z: 300 }, looks: 0, follows: 1, left: 0 } });
  const r = diagnose(follow, slow, map, bonito);
  assert.ok(keys(r).includes('motion') && keys(r).includes('interest'), JSON.stringify(r.reasons));
  assert.match(r.reasons.find((x) => x.key === 'motion').text, /fast/);
  // A bottom feeder and a bait hanging above the bottom.
  assert.ok(keys(diagnose(at('boat', 'rag'), { ...eco, bait: { ...eco.bait, nearBottom: false } }, map, sole)).includes('depth'));
  // Water that doesn't suit it.
  assert.ok(keys(diagnose(at('sea', 'metal'), eco, { suitableAt: () => false }, bonito)).includes('habitat'));
});
