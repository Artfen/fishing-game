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
  assert.match(main, /renderer\.compileAsync\(root, camera, scene\)/);
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
