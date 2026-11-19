// No freeze the first time something comes into view (docs/PERFORMANCE.md, "Stutter"): the scene's
// point lights are a fixed few, lent to the lamps that are lit and shown, so the light count
// three.js builds its shaders for never changes; and the game builds its shaders while it loads,
// and those of anything built later as it's built. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const THREE = await import('three');
const { Lamp, LampPool, POOL, allLamps } = await import('../src/lamps.js');
const root = new URL('..', import.meta.url).pathname;

// The lights three.js counts: point lights in visible parts of the scene.
const counted = (scene) => {
  let n = 0;
  const walk = (o) => { if (!o.visible) return; if (o.isPointLight) n++; for (const c of o.children) walk(c); };
  walk(scene);
  return n;
};

test('the lights three.js counts never change, whatever lamps are shown, hidden, lit or put out', () => {
  const scene = new THREE.Scene(), pool = new LampPool(scene), cam = new THREE.PerspectiveCamera();
  const boat = new THREE.Group(), house = new THREE.Group();
  scene.add(boat, house);
  const cabin = new Lamp('#ffc77d', 0, 4.2, 1.5), lantern = new Lamp('#ffb15c', 0, 18, 1.6), window = new Lamp('#ffc98a', 6, 9, 1.6);
  boat.add(cabin, lantern);
  house.add(window);
  const n0 = counted(scene);
  assert.equal(n0, POOL);
  const states = [
    () => { cabin.intensity = 2.4; },
    () => { boat.visible = false; },
    () => { boat.visible = true; lantern.intensity = 9; },
    () => { house.visible = false; },
    () => { scene.remove(boat); },
    () => { scene.add(boat); house.visible = true; },
  ];
  for (const s of states) {
    s();
    pool.update(cam);
    assert.equal(counted(scene), n0, 'the same number of lights, always');
  }
  // What they're lit with: each shown, lit lamp's own light, where it is.
  boat.position.set(10, 0, 0);
  pool.update(cam);
  const on = pool.lights.filter((L) => L.intensity > 0);
  assert.equal(on.length, 3);
  const c = on.find((L) => L.intensity === 2.4);
  assert.ok(c && c.position.x === 10 && c.distance === 4.2 && c.decay === 1.5 && c.color.equals(cabin.color));
  // A lamp hidden (its boat out of the scene, its house hidden) lights nothing; one put out, nothing.
  house.visible = false;
  lantern.intensity = 0;
  pool.update(cam);
  assert.equal(pool.lights.filter((L) => L.intensity > 0).length, 1);
});

test('more lamps lit than lights: the nearest have them', () => {
  const scene = new THREE.Scene(), pool = new LampPool(scene, 3), cam = new THREE.PerspectiveCamera();
  const lamps = [];
  for (let i = 0; i < 6; i++) {
    const L = new Lamp('#ffffff', 1, 5, 2);
    L.position.set(i * 10, 0, 0);
    scene.add(L);
    lamps.push(L);
  }
  cam.position.set(52, 0, 0);
  pool.update(cam);
  assert.deepEqual(pool.lights.map((L) => L.position.x).sort((a, b) => a - b), [30, 40, 50]);
  assert.equal(pool.lit, 6);
  for (const L of lamps) L.dispose();
  assert.ok(!allLamps().some((L) => lamps.includes(L)));
});

test('no other point lights in the game: every lamp a Lamp', () => {
  const files = [];
  const walk = (d) => { for (const f of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, f.name); if (f.isDirectory()) walk(p); else if (f.name.endsWith('.js')) files.push(p); } };
  walk(path.join(root, 'src'));
  // (The studio views, the field guide's and the boat yard's, draw on renderers of their own.)
  const own = new Set(['lamps.js', 'gearView.js', 'boatPreview.js']);
  const found = files.filter((f) => !own.has(path.basename(f)) && /new THREE\.PointLight\(/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(found.map((f) => path.relative(root, f)), []);
  for (const f of ['src/boat.js', 'src/campView.js', 'src/world/world.js', 'src/world/coast.js', 'src/world/shore.js', 'src/world/home.js', 'src/world/havenHouses.js']) {
    assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /new Lamp\(/, f);
  }
});

test('the shaders built while the game loads, and anything built later as it is built', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(main, /const lampPool = new LampPool\(scene\);/);
  assert.match(main, /lampPool\.update\(camera\);/);
  assert.match(main, /renderer\.compile\(root, camera, scene\)/);
  assert.match(main, /renderer\.properties\.get\(m\)\?\.currentProgram/, "a freed material let go, not an error");
  // The loading screen stays until they're built (or 25 s), then the game starts.
  assert.match(main, /warmShaders\(\)\.finally\(\(\) => \{\s*\$\('loading'\)\?\.remove\(\);/);
  assert.match(main, /world\.onBuilt = \(o\) => warmShaders\(o\);/);
  const world = fs.readFileSync(path.join(root, 'src/world/world.js'), 'utf8');
  for (const what of ['built?.(L.mesh)', 'built?.(north.group)', 'built?.(brasa.group)']) assert.ok(world.includes(what), what);
});

test('a big or ultrawide screen drawn sharp, but never more than a 4K screen\'s worth of pixels; never fewer than the screen has', async () => {
  const { budgetRatio, PIXEL_BUDGET, PRESETS } = await import('../src/quality.js');
  assert.equal(PIXEL_BUDGET, 3840 * 2160);
  // An ultrawide (3440 × 1440): Ultra (1.25 a side) is within it, Cinematic (1.5) brought back to it.
  assert.equal(budgetRatio(PRESETS.ultra.minRatio, 3440, 1440), 1.25);
  const c = budgetRatio(PRESETS.cinematic.minRatio, 3440, 1440);
  assert.ok(Math.abs(3440 * 1440 * c * c - PIXEL_BUDGET) < 1 && c > 1.25 && c < 1.5, `${c}`);
  // An ordinary 1080p screen on Cinematic: as it was.
  assert.equal(budgetRatio(1.5, 1920, 1080), 1.5);
  // A 4K screen: its own pixels, no more; a 5K one, not fewer than its own.
  assert.equal(budgetRatio(1.5, 3840, 2160), 1);
  assert.equal(budgetRatio(1.25, 5120, 2880), 1);
  assert.equal(budgetRatio(0.8, 5120, 2880), 0.8, 'a lower render scale left alone');
});

test('where things are worked out for what\'s shown, as three.js would, and for anything hidden the moment it\'s shown again', async () => {
  const { updateShown, onlyShown } = await import('../src/shown.js');
  const build = () => {
    const scene = new THREE.Scene(), boat = new THREE.Group(), cabin = new THREE.Group(), lamp = new THREE.Mesh(), town = new THREE.Group(), folk = new THREE.Mesh();
    scene.add(boat, town);
    boat.add(cabin);
    cabin.add(lamp);
    town.add(folk);
    boat.position.set(10, 0, 5);
    boat.rotation.y = 0.7;
    cabin.position.set(0, 1, -2);
    lamp.position.set(0.3, 0.5, 0);
    town.position.set(-40, 2, 9);
    folk.position.set(1, 0, 1);
    return { scene, boat, cabin, lamp, town, folk };
  };
  // Everything shown: the same matrices three.js works out.
  const A = build(), B = build();
  A.scene.updateMatrixWorld();
  updateShown(B.scene);
  for (const k of ['boat', 'cabin', 'lamp', 'town', 'folk']) assert.deepEqual(B[k].matrixWorld.elements, A[k].matrixWorld.elements, k);
  // The town hidden, and moved while it was: left alone, then right the moment it's shown.
  B.town.visible = false;
  B.town.position.x = -80;
  B.boat.position.z = 12;
  updateShown(B.scene);
  assert.equal(B.folk.matrixWorld.elements[12], -39, 'not worked out while hidden');
  assert.equal(B.lamp.getWorldPosition(new THREE.Vector3()).z > 5, true, 'what\'s shown moved with its boat');
  // (Asked where it is, a hidden thing works it out itself.)
  assert.equal(B.folk.getWorldPosition(new THREE.Vector3()).x, -79);
  B.town.visible = true;
  updateShown(B.scene);
  A.town.position.x = -80;
  A.boat.position.z = 12;
  A.scene.updateMatrixWorld();
  for (const k of ['boat', 'cabin', 'lamp', 'town', 'folk']) assert.deepEqual(B[k].matrixWorld.elements, A[k].matrixWorld.elements, k);
  // A static thing (matrix set by hand) under a hidden parent that moved: right when shown again.
  const C = build();
  C.folk.matrixAutoUpdate = false;
  C.folk.updateMatrix();
  updateShown(C.scene);
  C.town.visible = false;
  C.town.position.y = 7;
  updateShown(C.scene);
  C.town.visible = true;
  updateShown(C.scene);
  assert.equal(C.folk.matrixWorld.elements[13], 7);
  // A camera in the scene keeps its view.
  const cam = new THREE.PerspectiveCamera();
  C.boat.add(cam);
  updateShown(C.scene);
  assert.deepEqual(cam.matrixWorldInverse.elements, cam.matrixWorld.clone().invert().elements);
  // And the scene draws this way.
  onlyShown(C.scene);
  assert.equal(C.scene.matrixWorldAutoUpdate, false);
  C.boat.position.x = 33;
  C.scene.onBeforeRender();
  assert.equal(C.boat.matrixWorld.elements[12], 33);
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  assert.match(main, /onlyShown\(scene\);/);
});

test('the warm-up covers the water\'s reflection, every picture and every model shown', () => {
  const main = fs.readFileSync(path.join(root, 'src/main.js'), 'utf8');
  // The reflection draws into a picture of its own: its shaders built with a picture bound, for
  // what its camera shows.
  assert.match(main, /renderer\.setRenderTarget\(warmTarget\);/);
  assert.match(main, /o\.layers\.test\(seen\)/);
  assert.match(main, /renderer\.compile\(\{ traverse: \(f\) => shown\.forEach\(f\), traverseVisible\(\) \{\} \}, camera, scene\)/);
  // Every picture sent to the graphics card.
  assert.match(main, /renderer\.initTexture\(p\)/);
  // The whole of what's shown drawn once behind the loading screen, behind you as well as before.
  assert.match(main, /o\.frustumCulled = false;[\s\S]{0,120}renderer\.render\(scene, camera\);/);
});
