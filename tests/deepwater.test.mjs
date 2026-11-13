// G7 of docs/PROGRESSION.md: deep water. Gannet Deep, a canyon cut into the edge of the shelf
// (src/world/terrain.js CANYON), named on the chart; a deep sounder (src/shipyard.js deepsonar)
// that reads its floor, where the finder otherwise loses the bottom (src/sonar.js DEEP_RANGES);
// and the bait and the tuna at its head (src/world/habitat.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

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

const T = await import('../src/world/terrain.js');
const { FishFinder, RANGES, DEEP_RANGES } = await import('../src/sonar.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { FITS, fitEffect, fitsFor } = await import('../src/shipyard.js');

const habitat = createHabitat();

test('Gannet Deep: a canyon in the edge of the shelf, a hundred and fifty metres down, named on the chart', () => {
  const { CANYON, canyonAxis, canyonAt, heightAt, PLACES } = T;
  // Its floor, all along it from the head out to the edge of the chart.
  for (let z = CANYON.z0 + 100; z <= 1390; z += 50) {
    const x = canyonAxis(z), h = heightAt(x, z);
    assert.ok(h < -130 && h > -165, `on its floor at z ${z}: ${h.toFixed(0)} m`);
    // Its walls: the shelf's sixty metres a little way either side.
    for (const sd of [1, -1]) {
      const out = heightAt(x + sd * CANYON.w * 2.4, z);
      assert.ok(out > -75 && out < -45, `beside it at z ${z}: ${out.toFixed(0)} m`);
    }
  }
  // Its head: past the drop-off, not cut into the shelf inshore.
  assert.ok(heightAt(canyonAxis(CANYON.z0 - 60), CANYON.z0 - 60) > -60);
  assert.equal(canyonAt(canyonAxis(900), 900), 0);
  // Named over it (before the Blue Water around it), and not beside it.
  const name = (x, z) => PLACES.find((p) => p.test?.(x, z))?.name;
  assert.equal(name(canyonAxis(1200), 1200), 'Gannet Deep');
  assert.equal(name(canyonAxis(1200) + 200, 1200), 'The Blue Water');
  const P = PLACES.find((p) => p.id === 'canyon');
  assert.ok(P && P.area && P.test(P.x, P.z), 'its label sits over it');
});

test('the deep sounder: the finder reads the bottom to 200 m with it; past what it reaches, the bottom’s lost', () => {
  // Fitted to the boats that go out there; it does something only in the finder.
  for (const k of ['rib', 'console', 'cabin', 'cruiser']) assert.ok(fitsFor(k, []).includes('deepsonar'), k);
  for (const k of ['skiff', 'bass', 'row', 'kayak']) assert.ok(!fitsFor(k, []).includes('deepsonar'), k);
  assert.equal(fitEffect({ fits: { rib: ['deepsonar'] } }, 'rib').deep, true);
  assert.equal(fitEffect({ fits: { rib: ['sonar'] } }, 'rib').deep, false);
  assert.ok(FITS.deepsonar.kg > 0 && FITS.deepsonar.amps > 0);

  const eco = new Ecosystem(habitat), F = new FishFinder(eco, habitat, {}, {});
  F.visible = true;
  const ping = (x, z) => {
    F.timer = 0;
    F.update(0.1, { x, z, mode: 'boat', moving: 0 }, { active: false });
    return F.read;
  };
  // What each reaches.
  assert.equal(F.reach, 20);
  F.imaging = true;
  assert.equal(F.reach, 40);
  F.deep = true;
  assert.equal(F.reach, 200);
  assert.deepEqual(F.ranges, [...RANGES, ...DEEP_RANGES]);
  // Over the canyon's floor: read with the deep sounder, the range auto to show it.
  const x = T.canyonAxis(1200), z = 1200;
  F.pings.length = 0;
  let r = ping(x, z);
  assert.ok(!r.lost && r.depth > 130, `read: ${r.depth?.toFixed(0)} m`);
  for (let i = 0; i < 3; i++) r = ping(x, z);
  assert.ok(F.range >= r.depth && F.range <= 200, `range ${F.range} m for ${r.depth.toFixed(0)} m`);
  // Without it: lost, and said so.
  F.deep = false;
  F.pings.length = 0;
  r = ping(x, z);
  assert.ok(r.lost && r.depth == null);
  assert.match(F.depthEl.textContent, /no bottom: deeper than 40 m \(a deep sounder reads it\)/);
  // The shelf's sixty metres, out on the Blue Water: lost to the imaging sonar too.
  r = ping(x + 200, z);
  assert.ok(r.lost);
  // In ordinary water, as ever.
  r = ping(150, 330);
  assert.ok(!r.lost && r.depth > 3 && r.depth < 40, `${r.depth} m`);
});

test('the head of Gannet Deep: a home for the bait and the tuna', () => {
  const head = habitat.spots.filter((s) => s.tag === 'canyon');
  assert.equal(head.length, 1);
  const H = head[0];
  assert.equal(H.type, 'blue');
  assert.ok(T.canyonAt(H.x, H.z) > 0.5 && H.depth > 80, `at its head, ${H.depth.toFixed(0)} m down`);
  // The blue-water fish come to it as to the others.
  const eco = new Ecosystem(habitat);
  const there = eco.agents.filter((a) => a.home && Math.hypot(a.home.x - H.x, a.home.z - H.z) < 1);
  assert.ok(there.length > 0, 'fish living at the canyon’s head');
  // (The open-ocean hunters: the tuna among them.)
  assert.ok(there.some((a) => a.sp.id === 'tuna'), there.map((a) => a.sp.id).join(', '));
});
