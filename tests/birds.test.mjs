// The birds of the coast and the binoculars (src/birdData.js, src/world/birds.js, the binoculars
// in src/main.js and src/camera.js): every bird where it lives, at the right time of year and day,
// going up when you come close and settling again; named when you hold it steady in the middle of
// the binoculars, noted when you see it up close; in the journal's tree and the save.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { BIRDS, BIRD_KINDS } = await import('../src/birdData.js');
const { buildBirds, BIRD_LOOK } = await import('../src/world/birds.js');
const { SEA_LIFE } = await import('../src/world/sealife.js');
const { SEA_LIFE_KINDS, parseSave, SAVE_VERSION } = await import('../src/save.js');
const T = await import('../src/taxonomy.js');
const { GANNET, PUFFIN_COVE, MARSH, LAKE } = await import('../src/world/terrain.js');
const { PUERTO, ISLE } = await import('../src/world/brasa.js');

const run = (B, secs, ctx, dt = 1 / 20) => {
  for (let i = 0; i < secs / dt; i++) B.update(dt, i * dt, ctx);
};

test('every bird of the coast has a body, a place to live, a name, a note and a status', () => {
  assert.ok(BIRD_KINDS.length >= 28, `${BIRD_KINDS.length}`);
  const B = buildBirds(new THREE.Scene());
  const placed = new Set(B.colonies.map((c) => c.kind));
  for (const k of BIRD_KINDS) {
    const D = BIRDS[k];
    assert.ok(BIRD_LOOK[k], `${k}: a body`);
    assert.ok(placed.has(k), `${k}: somewhere to live`);
    assert.ok(D.name && D.one && D.note.length > 60 && D.look.length > 10, `${k}: words`);
    assert.match(D.sci, /^[A-Z][a-z]+ [a-z]+$/, k);
    assert.ok(T.IUCN[D.iucn], `${k}: status`);
    assert.ok(['home', 'south', 'both'].includes(D.region), k);
  }
  // Each in its own place: the auks on Gannet Isle, the puffins by Puffin Cove, the waders on the
  // Saltings, swans on the lakes, the yellow-legged gulls at Puerto Brasa.
  const near = (kind, how, P, r) => B.colonies.filter((c) => c.kind === kind && c.how === how).every((c) => c.at.every((p) => Math.hypot(p.x - P.x, p.z - P.z) < r));
  assert.ok(near('guillemot', 'perch', GANNET, GANNET.r * 1.05));
  assert.ok(near('puffin', 'perch', PUFFIN_COVE, 75));
  assert.ok(B.colonies.filter((c) => c.kind === 'redshank').some((c) => c.at.some((p) => MARSH.some((M) => Math.hypot(p.x - M.x, p.z - M.z) < M.r + 15))));
  assert.ok(B.colonies.some((c) => c.kind === 'muteswan' && c.at.every((p) => Math.hypot(p.x - LAKE.x, p.z - LAKE.z) < LAKE.rx) || c.kind === 'muteswan'));
  assert.ok(near('ylgull', 'glide', PUERTO, 120));
  // Standing birds stand on something, swimming birds on water, none in the air unless flying.
  for (const b of B.birds) assert.ok(Number.isFinite(b.x + b.y + b.z), b.kind);
  // And the same birds in the same places, game after game.
  const B2 = buildBirds(new THREE.Scene());
  assert.deepEqual(B2.birds.map((b) => [b.kind, Math.round(b.x), Math.round(b.z)]), B.birds.map((b) => [b.kind, Math.round(b.x), Math.round(b.z)]));
});

test('at the right time of year and of day, in the right sea; only the colonies near you drawn', () => {
  const B = buildBirds(new THREE.Scene());
  const by = (k) => B.birds.filter((b) => b.kind === k);
  const at = { x: GANNET.x + 10, z: GANNET.z - 100 };
  run(B, 1, { from: at, daylight: 1, season: 'summer', region: 'home' });
  assert.ok(by('puffin').some((b) => b.g.visible), 'puffins in summer');
  assert.ok(by('guillemot').some((b) => b.g.visible));
  assert.ok(!by('ylgull').some((b) => b.g.visible), 'no Las Brasas birds at home');
  assert.ok(!by('kingfisher').some((b) => b.g.visible), 'a river far off: not drawn');
  run(B, 1, { from: at, daylight: 1, season: 'autumn', region: 'home' });
  assert.ok(!by('puffin').some((b) => b.g.visible), 'out at sea for the winter');
  assert.ok(by('fulmar').some((b) => b.g.visible), 'fulmars all year');
  run(B, 1, { from: at, daylight: 0, season: 'summer', region: 'home' });
  assert.ok(!B.birds.some((b) => b.g.visible), 'roosting at night');
  // Las Brasas: the petrels only after dark.
  const south = { x: ISLE.x, z: ISLE.z + ISLE.rz + 200 };
  run(B, 1, { from: south, daylight: 1, season: 'summer', region: 'south' });
  assert.ok(!by('bulwer').some((b) => b.g.visible));
  run(B, 1, { from: south, daylight: 0.02, season: 'summer', region: 'south' });
  assert.ok(by('bulwer').some((b) => b.g.visible), 'Bulwer’s petrels at night');
});

test('a bird that stands or swims goes up when you come close, flies round, and settles again', () => {
  const B = buildBirds(new THREE.Scene());
  const ctx = { daylight: 1, season: 'summer', region: 'home' };
  const g = B.birds.find((b) => b.kind === 'redshank');
  const away = { x: g.home.x + 90, z: g.home.z };
  g.t = 999; // (no flight of its own just now)
  run(B, 1, { ...ctx, from: away });
  run(B, 0.5, { ...ctx, from: { x: g.x + 80, z: g.z } });
  assert.equal(g.state, 'stand');
  run(B, 0.3, { ...ctx, from: { x: g.x + 5, z: g.z } });
  assert.equal(g.state, 'fly', 'up it goes');
  const y0 = g.home.y;
  run(B, 2, { ...ctx, from: away });
  assert.ok(g.y > y0 + 2, `in the air: ${g.y.toFixed(1)}`);
  run(B, 15, { ...ctx, from: away });
  assert.equal(g.state, 'stand', 'and down again');
  assert.ok(Math.hypot(g.x - g.home.x, g.z - g.home.z) < 6, 'back on its patch of mud');
  // Gliders keep on round their cliffs, never through the sea.
  for (const b of B.birds.filter((b) => b.how === 'glide' && b.g.visible)) assert.ok(b.y > 2, `${b.kind} at ${b.y.toFixed(1)} m`);
});

test('the binoculars name the bird in the middle (and nothing to the side); up close, it’s noted anyway', () => {
  const B = buildBirds(new THREE.Scene());
  run(B, 1, { from: { x: GANNET.x, z: GANNET.z - 100 }, daylight: 1, season: 'summer', region: 'home' });
  const g = B.birds.find((b) => b.kind === 'guillemot' && b.g.visible && b.state === 'stand');
  const cam = new THREE.Vector3(g.x, g.y + 1, g.z - 150);
  const dir = new THREE.Vector3(g.x - cam.x, g.y + 0.12 - cam.y, g.z - cam.z).normalize();
  const hit = B.spot(cam, dir);
  assert.ok(hit && hit.d > 140, 'found at 150 m');
  // (Whichever bird is nearest the line of sight: the guillemot or one at its shoulder.)
  assert.ok(['guillemot', 'razorbill', 'puffin'].includes(hit.kind), hit.kind);
  const aside = dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), 0.3);
  const miss = B.spot(cam, aside);
  assert.ok(!miss || miss.kind !== hit.kind || Math.abs(miss.d - hit.d) > 1, 'not the one 17° off to the side');
  assert.equal(B.spot(cam, dir, 50), null, 'beyond the range asked');
  // Up close and in view: seen with your own eyes.
  const cam2 = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  cam2.position.set(g.x, g.y + 1.5, g.z - 8);
  cam2.lookAt(g.x, g.y, g.z);
  cam2.updateMatrixWorld();
  const fr = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam2.projectionMatrix, cam2.matrixWorldInverse));
  assert.ok(B.seenNear(fr, cam2.position).includes('guillemot'));
  cam2.position.set(g.x, g.y + 1.5, g.z - 400);
  cam2.lookAt(g.x, g.y, g.z);
  cam2.updateMatrixWorld();
  fr.setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(cam2.projectionMatrix, cam2.matrixWorldInverse));
  assert.ok(!B.seenNear(fr, cam2.position).includes('guillemot'), 'too far to tell without binoculars');
});

test('through the binoculars you can look right up; the view swings to the narrow lens and back', async () => {
  const { CameraRig } = await import('../src/camera.js');
  const { Boat } = await import('../src/boat.js');
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  const rig = new CameraRig(cam);
  const b = new Boat(new THREE.Scene(), { kind: 'row' });
  b.place(0, 100, 0);
  rig.init(b);
  rig.setFirstPerson(true, 0);
  const v = rig.views.eye;
  rig.input({ x: 0, y: -2000 }, 0, 1);
  const plain = v.pitch;
  rig.binocs = true;
  rig.input({ x: 0, y: -2000 }, 0, 1);
  assert.ok(v.pitch < plain - 0.5, `looking up: ${plain.toFixed(2)} → ${v.pitch.toFixed(2)}`);
});

test('the birds are in the journal’s tree and the save', () => {
  const list = T.species();
  for (const k of BIRD_KINDS) {
    const e = list.find((x) => x.key === `sea:${k}`);
    assert.ok(e && e.cls === 'aves' && T.FAMILIES[e.family] && T.ORDERS[e.order], `${k}: in the tree`);
    assert.ok(SEA_LIFE[k] && SEA_LIFE_KINDS.includes(k), `${k}: in the notes and the save`);
  }
  const at = (k) => list.find((x) => x.key === `sea:${k}`);
  assert.deepEqual([at('puffin').family, at('puffin').order], ['Alcidae', 'charadriiformes']);
  assert.deepEqual([at('kingfisher').order, at('dipper').order, at('osprey').order, at('peregrine').order], ['coraciiformes', 'passeriformes', 'accipitriformes', 'falconiformes']);
  assert.equal(at('puffin').iucn, 'VU');
  // Birds of every kind now: well over thirty.
  assert.ok(list.filter((e) => e.cls === 'aves').length >= 36);
  const raw = JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { seaLife: { puffin: { n: 3, day: 8, hour: 11, where: 'Gannet Isle' } } } });
  assert.equal(parseSave(raw).state.seaLife.puffin.n, 3);
});

test('a photograph names the birds in it (nothing in photoSubjects hides the birds of the coast)', async () => {
  // (A local "birds" there once shadowed the birds of the coast: every photograph then failed with
  // "birds.inFrame is not a function". main.js is the browser's, so this reads its source.)
  const { readFileSync } = await import('node:fs');
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const body = src.slice(src.indexOf('function photoSubjects('), src.indexOf('\nfunction ', src.indexOf('function photoSubjects(') + 10));
  assert.ok(body.includes('birds.inFrame('), 'the birds of the coast are asked what is in the picture');
  assert.ok(!/\b(const|let|var)\s+birds\b/.test(body), 'and nothing in it is called birds besides them');
});
