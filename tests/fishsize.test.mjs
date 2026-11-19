// Fish as big as they are (docs/FISH.md): each species' sizes run from a common size to rare
// giants; a school keeps fish of about one size, and now and then a much bigger one rides along;
// every fish is drawn at its true length, as deep and thick as its build, its tail at its size's
// pace; a big fish is drawn in detail a long way off, a speck isn't drawn at all, and a school of
// small fish is drawn as dense as one. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { FISH, fishById, sizeAt, GROW, drawnLength, PROC_LENGTH, scaleOf, girthOf, tempoOf, weightOf, buildFishGeometry, biggest } = await import('../src/fish.js');
const { traits } = await import('../src/behaviour.js');
const { Ecosystem, schoolSizes, memberSize } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { FishRenderer, companionsFor, SEEN, NEAR_LEN } = await import('../src/world/fishRender.js');

const LIVE = FISH.filter((f) => !f.retired);
const eco = new Ecosystem(createHabitat());

test('a species\' sizes: most about a common size, one in fourteen in the top quarter, one in a hundred in the top tenth; one draw each, in range, bigger with the draw', () => {
  const N = 20000, f = { size: [30, 90] };
  let top10 = 0, top25 = 0, prev = 0;
  const all = [];
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N, s = sizeAt(f, u);
    assert.ok(s >= 30 && s <= 90 && s >= prev, `${u}: ${s}`);
    prev = s;
    all.push(s);
    if (s > 84) top10++;
    if (s > 75) top25++;
  }
  const median = all[N / 2];
  assert.ok(median > 50 && median < 54, `the middle fish ${median} cm (36% up the range)`);
  assert.ok(top25 / N > 0.06 && top25 / N < 0.09, `top quarter ${(top25 / N * 100).toFixed(1)}%`);
  assert.ok(top10 / N > 0.006 && top10 / N < 0.016, `top tenth ${(top10 / N * 100).toFixed(2)}%`);
  assert.deepEqual(GROW, [1.3, 2.24]);
  assert.equal(sizeAt(f, 0), 30);
  assert.ok(sizeAt(f, 1) <= 90);
  // In the sea: the fish on their own the same way; the trophies rare.
  const solo = eco.agents.filter((a) => !a.school);
  const big = solo.filter((a) => a.size >= a.sp.size[0] + 0.9 * (a.sp.size[1] - a.sp.size[0])).length;
  assert.ok(big / solo.length < 0.025, `${big} of ${solo.length} in their species' top tenth`);
});

test('every species\' model drawn at its true length: the anatomical ones a unit long, the older ones measured', () => {
  for (const sp of LIVE.filter((f) => !f.creature)) {
    const g = buildFishGeometry(sp, true);
    g.computeBoundingBox();
    const L = g.boundingBox.max.z - g.boundingBox.min.z;
    assert.ok(Math.abs(L - drawnLength(sp)) < 0.01, `${sp.id}: the model ${L.toFixed(3)} long, taken as ${drawnLength(sp)}`);
    // So a fish of its biggest size is drawn exactly that long.
    assert.ok(Math.abs(L * scaleOf(sp, sp.size[1]) - sp.size[1] / 100) < 0.01, sp.id);
  }
  assert.equal(PROC_LENGTH, 1.267);
  // No species is drawn bigger (or smaller) than it is any more.
  assert.deepEqual(LIVE.filter((f) => 'visual' in f).map((f) => f.id), []);
});

test('as deep and thick as its weight: its condition in its girth, a species that fills out as it grows deeper when big', () => {
  const bass = fishById.seabass;
  assert.ok(Math.abs(girthOf(bass, 50, 1.2) - Math.sqrt(1.2)) < 1e-9, 'a plump bass a tenth thicker');
  assert.ok(Math.abs(girthOf(bass, 50, 0.8) - Math.sqrt(0.8)) < 1e-9);
  // The weight of a fish drawn so: its length × girth² against the species' own, as the scales say.
  for (const a of eco.agents.slice(0, 400)) {
    const g = a.girth, mid = (a.sp.size[0] + a.sp.size[1]) / 2, b = a.sp.wtPow ?? 3;
    const drawn = weightOf(a.sp, mid) * Math.pow(a.size / mid, 3) * g * g;
    assert.ok(Math.abs(drawn / a.weight - 1) < 1e-6, `${a.sp.id} ${a.size} cm: drawn ${drawn.toFixed(3)} kg, weighed ${a.weight.toFixed(3)} (b ${b})`);
  }
  // An eel (b 3.2) fills out as it grows: a big one is deeper for its length than a small one.
  assert.ok(girthOf(fishById.eel, 85) > girthOf(fishById.eel, 45) * 1.05);
  // A big fish sweeps its tail slowly, a small one flickers.
  assert.ok(tempoOf(175) < 0.6 && tempoOf(45) === 1 && tempoOf(12) > 1.4);
  assert.deepEqual(Object.keys(traits(bass, 60, 1)).sort(), ['condition', 'girth', 'look', 'temper', 'tempo', 'vigour', 'weight']);
});

test('a school keeps fish of about one size, and one school in three or so has a much bigger fish with it, at its edge and below', () => {
  let withBig = 0;
  for (const s of eco.schools) {
    const [lo, hi] = s.sp.size;
    s.members.forEach((a, k) => {
      if (k === s.bigK) {
        assert.equal(a.size, s.big);
        assert.ok(a.size >= Math.min(biggest(s.sp), s.size * 1.45), `${s.sp.id} school ${s.id}: its big one ${a.size} cm by fish of ${s.size}`);
        assert.ok(a.slot.y === -0.75 && Math.abs(a.slot.x) > 1, 'at the edge, below');
      } else {
        // (Within a tenth either way, but for a centimetre's rounding and the species' sizes, its
        // giants' among them: a school of big tunas may have fish just past the usual range.)
        assert.ok(a.size >= Math.max(lo, Math.floor(s.size * 0.9) - 1) && a.size <= Math.min(biggest(s.sp), Math.ceil(s.size * 1.1) + 1), `${s.sp.id} school ${s.id}: ${a.size} cm by ${s.size}`);
      }
    });
    if (s.bigK >= 0) withBig++;
    // Spaced by their length.
    assert.ok(Math.abs(s.body - Math.min(3, Math.max(0.4, s.size / 45))) < 1e-9);
  }
  const share = withBig / eco.schools.length;
  assert.ok(share > 0.2 && share < 0.4, `${withBig} of ${eco.schools.length} schools`);
  // The same school, the same sizes, on every screen (from who it is, not the dice).
  const s = eco.schools.find((x) => x.bigK >= 0);
  assert.deepEqual(schoolSizes(s.sp, s.id, s.members.length), { size: s.size, body: s.body, big: s.big, bigK: s.bigK });
  // A newcomer to a school: its size, or its big one's again.
  const one = s.members.find((a, k) => k !== s.bigK), bigOne = s.members[s.bigK];
  for (let i = 0; i < 20; i++) {
    eco.restock(one);
    assert.ok(Math.abs(one.size - s.size) <= Math.ceil(s.size * 0.1) + 1);
  }
  eco.restock(bigOne);
  assert.equal(bigOne.size, s.big);
  assert.equal(memberSize(s.sp, null, -1, 0.5), sizeAt(s.sp, 0.5));
});

test('drawn: its true length and its build; a big fish always, in detail a long way off; a speck not at all; a school of small fish dense', () => {
  const scene = new THREE.Scene(), R = new FishRenderer(scene, eco), cam = new THREE.PerspectiveCamera();
  const drawnOf = (sp) => R.sets.find((s) => s.sp.id === sp);
  const at = (x, y, z) => { cam.position.set(x, y, z); cam.updateMatrixWorld(); };
  const run = () => { for (const a of eco.agents) Object.assign(a, { px: a.x, py: a.y, pz: a.z, pyaw: a.yaw }); R.update(1 / 30, cam, 0, true); };
  const scaleIn = (mesh, i) => { const m = new THREE.Matrix4(), p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3(); mesh.getMatrixAt(i, m); m.decompose(p, q, s); return { p, s }; };
  // A tuna school: each drawn its own length long, as thick as its build.
  const S = eco.schools.find((s) => s.sp.id === 'tuna');
  for (const a of S.members) a.state = 'cruise';
  at(S.x + 6, S.y, S.z);
  R.density = 1;
  run();
  const T = drawnOf('tuna');
  assert.ok(T.mesh.count >= S.members.length, `${T.mesh.count} tuna drawn near`);
  const drawn = Array.from({ length: T.mesh.count }, (_, i) => scaleIn(T.mesh, i));
  for (const a of S.members) {
    const d = drawn.find((o) => Math.abs(o.p.x - a.x) < 1e-4 && Math.abs(o.p.z - a.z) < 1e-4);
    assert.ok(d, 'drawn where it is');
    assert.ok(Math.abs(d.s.z - a.size / 100) < 1e-4 && Math.abs(d.s.x - (a.size / 100) * a.girth) < 1e-4, `${a.size} cm: ${d.s.z.toFixed(3)} long`);
  }
  // Seen from 60 m on the lowest setting: a fish a metre and more still drawn, and in detail (a
  // 1.5 m tuna looks as big at 60 m as a 45 cm fish at 18), while the setting thins out the small.
  at(S.x + 55, S.y, S.z);
  R.density = 0;
  R.near = 15;
  run();
  assert.equal(T.mesh.count + (T.far?.mesh.count || 0), S.members.length, 'every tuna drawn');
  assert.equal(T.mesh.count, S.members.filter((a) => (a.size / 100 / NEAR_LEN) * 15 > 55).length, 'in detail as far as it looks big');
  // A sprat 60 m off is a speck: not drawn (unless it's busy with you).
  const sprats = eco.schools.find((s) => s.sp.id === 'sprat');
  for (const a of sprats.members) a.state = 'school';
  at(sprats.x + 50, sprats.y, sprats.z);
  R.density = 1;
  run();
  const P = drawnOf('sprat');
  assert.ok(sprats.members.every((a) => a.size / 100 < SEEN * 50), 'specks at 50 m');
  const nearSprats = eco.bySpecies.sprat.filter((a) => a.active && Math.hypot(a.x - cam.position.x, a.y - cam.position.y, a.z - cam.position.z) * SEEN < a.size / 100).length;
  assert.equal(P.mesh.count + (P.far?.mesh.count || 0), nearSprats * (1 + P.extra), 'only those big enough to see');
  // Beside them, a dense ball: each sprat with its companions, none of them simulated.
  at(sprats.x + 1.5, sprats.y, sprats.z);
  run();
  assert.equal(companionsFor(fishById.sprat), 4);
  assert.equal(companionsFor(fishById.tuna), 0, 'a tuna school is as many tuna as there are');
  const shown = P.mesh.count + (P.far?.mesh.count || 0);
  assert.ok(shown >= sprats.members.length * 5, `${shown} sprats drawn for ${sprats.members.length} in the school`);
  // A sprat that leaves its school (fleeing, hooked) leaves its companions behind.
  for (const a of sprats.members) a.state = 'flee';
  run();
  const alone = P.mesh.count + (P.far?.mesh.count || 0);
  assert.ok(alone <= sprats.members.length + eco.bySpecies.sprat.length - sprats.members.length, `${alone}`);
  for (const a of sprats.members) a.state = 'school';
  for (const a of S.members) a.state = 'school';
});

test('giants: a few of a kind past its usual sizes, most just past, none past the biggest measured (nor the register\'s)', async () => {
  const { GIANTS, biggest } = await import('../src/fish.js');
  const { registerFor } = await import('../src/register.js');
  for (const [id, [share, top]] of Object.entries(GIANTS)) {
    const sp = fishById[id];
    assert.ok(sp && sp.giant, id);
    assert.ok(top > sp.size[1] && biggest(sp) === top, `${id}: ${top} past ${sp.size[1]}`);
    const reg = registerFor(id)?.size;
    if (reg?.max && !reg.unit) assert.ok(top <= reg.max, `${id}: ${top} cm, the register's biggest ${reg.max}`);
    const N = 20000;
    let past = 0, nearTop = 0, prev = 0;
    for (let i = 0; i < N; i++) {
      const s = sizeAt(sp, (i + 0.5) / N);
      assert.ok(s >= prev && s <= top, `${id} ${s}`);
      prev = s;
      if (s > sp.size[1]) past++;
      if (s > sp.size[1] + 0.9 * (top - sp.size[1])) nearTop++;
    }
    assert.ok(Math.abs(past / N - share) < 0.004, `${id}: ${(past / N * 100).toFixed(2)}% giants`);
    assert.ok(nearTop / N < share * 0.03, `${id}: the biggest rare (${nearTop} in ${N})`);
  }
  // In the sea, a giant tuna school or two, and giants beside schools of ordinary ones.
  const giants = eco.agents.filter((a) => a.size > a.sp.size[1]);
  assert.ok(giants.length > 10, `${giants.length} giants in the sea`);
  assert.ok(giants.every((a) => a.size <= biggest(a.sp)));
});

test('a giant fights harder and longer for its bulk, and careful play on the tackle its kind needs still lands it', async () => {
  const { newFight, DIFFICULTY } = await import('../src/fight.js');
  const { play } = await import('../tools/fightsim.mjs?nomain');
  const { RODS, TERMS } = await import('../src/tackle.js');
  const { setupsFor } = await import('../src/guide.js');
  const rodFor = (sp) => { const s = setupsFor(sp)[0], R = RODS[s.rod]; return { line: { ...R.lines.find((l) => l.id === s.line), trace: !!TERMS[s.term].trace }, power: R.power, drag: R.drag }; };
  const tuna = fishById.tuna, rod = rodFor(tuna), one = () => 0.5;
  const usual = newFight(tuna, 175, rod, DIFFICULTY.standard, false, one), giant = newFight(tuna, 262, rod, DIFFICULTY.standard, false, one);
  assert.ok(Math.abs(giant.force / usual.force - Math.pow(262 / 175, 1.5)) < 1e-9, 'its pull by its bulk');
  assert.ok(Math.abs(giant.strength / usual.strength - 262 / 175) < 1e-9, 'its staying power by its length');
  // Up to its usual sizes, the fight is as it was.
  assert.equal(newFight(tuna, 150, rod, DIFFICULTY.standard, false, one).force, tuna.pull * (0.35 + 0.65 * (150 - 95) / 80) * DIFFICULTY.standard.force);
  for (const id of ['tuna', 'bluemarlin', 'seabass', 'pike', 'conger']) {
    const sp = fishById[id], [lo, hi] = sp.size, mid = (hi + sp.giant[1]) / 2;
    const at = (size) => play(sp, rodFor(sp), 'standard', 'careful', { k: (size - lo) / (hi - lo), n: 30 });
    const big = at(hi), g = at(mid);
    assert.ok(g.rate >= 0.95, `${id} at ${mid} cm: ${JSON.stringify(g)}`);
    assert.ok(g.time > big.time, `${id}: a giant ${g.time}s, the biggest usual one ${big.time}s`);
    assert.ok(g.time < 240, `${id}: a giant within four minutes (${g.time}s)`);
  }
});

test('one weight everywhere: a kept fish carries its own weight into the creel, the market and the save; and the records keep its kind\'s heaviest', async () => {
  const { keptKg } = await import('../src/shop.js');
  const { fishValue } = await import('../src/market.js');
  const { sanitize, DEFAULT_STATE } = await import('../src/save.js');
  const bass = fishById.seabass, plump = { id: 'seabass', size: 60, kg: weightOf(bass, 60) * 1.18, at: 0 }, lean = { ...plump, kg: weightOf(bass, 60) * 0.82 };
  assert.equal(keptKg(plump), plump.kg);
  assert.equal(keptKg({ id: 'seabass', size: 60 }), weightOf(bass, 60), 'a fish kept before: its kind\'s weight for its length');
  const at = { day: 1, now: 0 };
  assert.ok(fishValue(plump, at).price > fishValue(lean, at).price, 'the plump one fetches more');
  assert.equal(fishValue(plump, at).kg, plump.kg);
  // Through the save.
  const s = sanitize({ ...structuredClone(DEFAULT_STATE), keep: [plump, { id: 'seabass', size: 50 }], fish: { seabass: { count: 3, best: 66, heaviest: 4.4, firstDay: 1, firstHour: 9, firstZone: 'bay' } } });
  assert.equal(s.keep[0].kg, plump.kg);
  assert.ok(!('kg' in s.keep[1]));
  assert.equal(s.fish.seabass.heaviest, 4.4);
  assert.ok(!('heaviest' in sanitize({ ...structuredClone(DEFAULT_STATE), fish: { seabass: { count: 1, best: 40, firstDay: 1, firstHour: 9, firstZone: 'bay' } } }).fish.seabass));
  // A marlin of 330 cm is kept as long as it was (the save held sizes to 300 before).
  const L = sanitize({ ...structuredClone(DEFAULT_STATE), fish: { bluemarlin: { count: 1, best: 410, firstDay: 1, firstHour: 9, firstZone: 'bay' } } });
  assert.equal(L.fish.bluemarlin.best, 410);
});
