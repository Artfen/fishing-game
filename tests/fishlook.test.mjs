// Each fish's own looks (docs/FISH.md, "Looks"): its shade, its spots, its scars and, now and then,
// a rare colour morph; from who it is, so the same fish looks the same everywhere and on every
// screen; drawn by its shader from one attribute; a morph only a look, and remembered when caught.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { FISH, fishById, fishMaterial, buildFishMesh, setLook } = await import('../src/fish.js');
const { lookOf, morphOf, morphsFor, MORPHS, MORPH_WORDS, LOOKS, lookRuleValues } = await import('../src/fishlook.js');
const { traits } = await import('../src/behaviour.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { FishRenderer } = await import('../src/world/fishRender.js');

const LIVE = FISH.filter((f) => !f.retired);

test('a fish\'s look is its own, the same every time it\'s made: its shade about its kind\'s, its spots where its seed puts them', () => {
  const bass = fishById.seabass;
  assert.deepEqual(lookOf(bass, 60, 1234), lookOf(bass, 60, 1234));
  assert.notDeepEqual(lookOf(bass, 60, 1234), lookOf(bass, 60, 1235));
  // Its build carries it, and a newcomer in its place (a new generation) has its own.
  assert.deepEqual(traits(bass, 60, 77).look, lookOf(bass, 60, 77));
  assert.notDeepEqual(traits(bass, 60, 77).look, traits(bass, 60, 77 + 7919).look);
  // Most fish about their kind's shade (a hump in the middle), none past it.
  let mid = 0;
  for (let i = 0; i < 5000; i++) {
    const [shade, seed, morph, marks] = lookOf(bass, 50, i);
    assert.ok(shade >= -1 && shade <= 1 && seed >= 0 && seed < 1 && marks >= 0 && marks <= 1 && MORPHS[morph] !== undefined);
    if (Math.abs(shade) < 0.5) mid++;
  }
  assert.ok(mid / 5000 > 0.7, `${mid} of 5000 near the middle`);
});

test('rare colour morphs, as each kind has them: none for the tunas and billfish (their colour is their colour), golden trout and pike likelier, piebald flatfish, pale sharks', () => {
  const count = (sp, n = 200000) => {
    const c = {};
    for (let i = 0; i < n; i++) {
      const m = morphOf(lookOf(sp, sp.size[0], i));
      if (m) c[m] = (c[m] || 0) + 1;
    }
    return c;
  };
  for (const id of ['tuna', 'yellowfin', 'bluemarlin', 'sailfish', 'mackerel', 'dorado']) assert.deepEqual(count(fishById[id], 20000), {}, id);
  for (const sp of LIVE.filter((f) => f.creature)) assert.deepEqual(morphsFor(sp), {}, sp.id);
  const bass = count(fishById.seabass), N = 200000;
  for (const [m, p] of Object.entries(morphsFor(fishById.seabass))) assert.ok(Math.abs(bass[m] / N - p) < p * 0.25 + 0.0002, `${m}: ${bass[m]} in ${N}, meant ${p}`);
  assert.ok(!bass.piebald, 'no piebald bass');
  assert.ok(count(fishById.trout).xanthic / N > 1 / 600, 'golden trout likelier');
  assert.ok(count(fishById.plaice).piebald > 0 && morphsFor(fishById.blueshark).leucistic && !morphsFor(fishById.blueshark).melanistic);
  // All told rare: about one fish in two hundred is any morph, an albino one in thousands.
  const all = Object.values(bass).reduce((a, b) => a + b, 0) / N;
  assert.ok(all > 0.002 && all < 0.008, `${(all * 100).toFixed(2)}% morphs among bass`);
  assert.ok((bass.albino || 0) / N < 0.0005);
  // Every morph has words, plain and short, for the card and the journal.
  for (const m of MORPHS.filter(Boolean)) assert.ok(MORPH_WORDS[m].name && MORPH_WORDS[m].card('bass').includes('bass'), m);
  // And a morph is only a look: its build otherwise as any other fish's of its size.
  const t = traits(fishById.trout, 40, 5);
  assert.deepEqual(Object.keys(t).sort(), ['condition', 'girth', 'look', 'temper', 'tempo', 'vigour', 'weight']);
});

test('scars: more often on a big fish, and on the kinds that get them (tunas, billfish, sharks)', () => {
  const scarred = (sp, size) => { let n = 0; for (let i = 0; i < 20000; i++) if (lookOf(sp, size, i)[3] > 0) n++; return n / 20000; };
  const tuna = fishById.tuna;
  assert.ok(scarred(tuna, tuna.size[1]) > scarred(tuna, tuna.size[0]) * 2, 'the big ones');
  assert.ok(scarred(tuna, tuna.size[1]) > scarred(fishById.seabass, fishById.seabass.size[1]) * 3, 'tunas more than bass');
});

test('drawn by the fish\'s own shader: every kind\'s materials take its look, its spots where its kind has them; one attribute a fish, no more draws', () => {
  for (const sp of LIVE) {
    for (const instanced of [true, false]) {
      const mats = [fishMaterial(sp, instanced)].flat();
      for (const m of mats) {
        const shader = { uniforms: {}, vertexShader: '#include <common>\n#include <begin_vertex>', fragmentShader: '#include <common>\n#include <color_fragment>\n#include <emissivemap_fragment>' };
        m.onBeforeCompile(shader);
        assert.match(shader.vertexShader, instanced ? /attribute vec4 aLook;/ : /uniform vec4 uLook;/, sp.id);
        assert.match(shader.vertexShader, /vObj = position;/);
        assert.match(shader.fragmentShader, /diffuseColor\.rgb = lc;/, sp.id);
        assert.ok(shader.uniforms.uSpot && shader.uniforms.uLookShade, sp.id);
        if (!instanced) assert.ok(m.userData.look, 'a single fish\'s own look');
      }
    }
    const v = lookRuleValues(sp, 0);
    assert.equal(v.spot[0] > 0, !!LOOKS[sp.id]?.spots, sp.id);
  }
  // A single fish drawn alone takes its look onto every part of it.
  const m = buildFishMesh(fishById.trout), look = [0.5, 0.25, 3, 0];
  setLook(m, look);
  for (const mat of [m.material].flat()) assert.deepEqual([...mat.userData.look.value], look);
  // The renderer: each fish drawn with its own look, from the attribute.
  const eco = new Ecosystem(createHabitat()), scene = new THREE.Scene(), R = new FishRenderer(scene, eco), cam = new THREE.PerspectiveCamera();
  const a = eco.agents.find((x) => x.sp.id === 'seabass' && !x.school);
  a.look = [0.7, 0.3, MORPHS.indexOf('xanthic'), 0.4];
  a.state = 'cruise';
  for (const x of eco.agents) Object.assign(x, { px: x.x, py: x.y, pz: x.z, pyaw: x.yaw });
  cam.position.set(a.x + 2, a.y, a.z);
  R.update(1 / 30, cam, 0, true);
  const S = R.sets.find((s) => s.sp.id === 'seabass'), mesh = new THREE.Matrix4(), p = new THREE.Vector3();
  let found = false;
  for (const into of [S, S.far].filter(Boolean)) {
    for (let i = 0; i < into.mesh.count; i++) {
      into.mesh.getMatrixAt(i, mesh);
      p.setFromMatrixPosition(mesh);
      if (Math.hypot(p.x - a.x, p.z - a.z) < 1e-4) {
        assert.deepEqual([0, 1, 2, 3].map((k) => +into.look.array[i * 4 + k].toFixed(4)), a.look.map((v) => +v.toFixed(4)));
        found = true;
      }
    }
  }
  assert.ok(found, 'drawn');
});

test('a morph caught: in your log, in your record of its kind, and kept through the save', async () => {
  const { sanitize, DEFAULT_STATE } = await import('../src/save.js');
  const base = structuredClone(DEFAULT_STATE);
  const s = sanitize({ ...base, fish: { trout: { count: 2, best: 41, firstDay: 1, firstHour: 9, firstZone: 'beck', morphs: ['xanthic', 'xanthic', 'purple'] } }, log: [{ id: 'c1', at: 1, sp: 'trout', size: 41, day: 1, hour: 9, zone: 'beck', morph: 'xanthic', weight: 0.9 }, { id: 'c2', at: 2, sp: 'trout', size: 30, day: 1, hour: 10, zone: 'beck', morph: 'tartan' }] });
  assert.deepEqual(s.fish.trout.morphs, ['xanthic']);
  assert.equal(s.log.find((e) => e.id === 'c1').morph, 'xanthic');
  assert.ok(!('morph' in s.log.find((e) => e.id === 'c2')));
  // And the game writes them: the log entry, the record, the card's words.
  const fs = await import('node:fs');
  const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /\.\.\.\(morphOf\(agent\.look\) \? \{ morph: morphOf\(agent\.look\) \} : \{\}\)/);
  assert.match(main, /if \(morph\) rec\.morphs = /);
  assert.match(main, /MORPH_WORDS\[morph\]\.card\(/);
});
