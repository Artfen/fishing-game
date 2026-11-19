// Water sports: the windsurf board (sailed standing up, planing in a breeze, catapulting you in
// if you hang on to too much power, back up in a moment) and the jet ski (very quick, steered by
// its jet, leaving the wave crests at speed). Neither is for fishing. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { Boat, BOAT_KINDS } = await import('../src/boat.js');
const { conditions, updateConditions } = await import('../src/world/conditions.js');
const { bestSheet } = await import('../src/sailing.js');
const M = await import('../src/mooring.js');
const F = await import('../src/fuel.js');
const { LEVERS } = await import('../src/throttle.js');
const { G } = await import('../src/hydro.js');

const scene = new THREE.Scene();
let clock = 0;
// A steady wind from the west (from 270°), a settled sea.
function wind(speed, preset = 'moderate', from = 270) {
  conditions.preset = preset;
  conditions.manual = { speed, from: (from * Math.PI) / 180 };
  conditions.wind.speed = conditions.wind.target = speed;
  for (let i = 0; i < 3000; i++) updateConditions(0.1, { rain: 0, cloud: 0.2 });
}
const at = (kind, heading = 0) => {
  const b = new Boat(scene, { kind });
  b.place(0, 400, heading);
  return b;
};
// Sail her a while with the sheet held at `trim` (a function of her sailing), steering `steer`.
function sail(b, secs, trim, lever = 0, steer = 0) {
  let top = 0;
  for (let i = 0; i < secs * 30; i++) {
    clock += 1 / 30;
    conditions.time = clock;
    if (trim && b.sailing) b.sheet = trim(b.sailing);
    b.update(1 / 30, clock, lever, steer, 0);
    top = Math.max(top, b.forwardSpeed);
  }
  return top;
}
const best = (A) => bestSheet(A.awa);

test('the windsurf board ploughs along in light air and planes in a breeze', () => {
  assert.ok(BOAT_KINDS.includes('windsurf'));
  wind(4.5);
  const light = at('windsurf');
  sail(light, 30, best);
  assert.ok(light.forwardSpeed < 3.5 && light.planing < 0.3, `light air: ${light.forwardSpeed.toFixed(1)} m/s`);
  wind(8);
  const fresh = at('windsurf');
  const top = sail(fresh, 30, best);
  assert.ok(top > 6 && fresh.planing > 0.6, `a breeze: up on the plane at ${top.toFixed(1)} m/s`);
  assert.ok(top < 14, 'never absurdly fast');
});

test('hang on to too much power and you’re catapulted in; eased, you hold it; back up in a moment', () => {
  wind(9);
  const eased = at('windsurf');
  let falls = 0;
  eased.onFall = () => falls++;
  sail(eased, 30, best);
  assert.equal(falls, 0, 'trimmed to its best in a fresh breeze: held');
  wind(13);
  const hauled = at('windsurf');
  let fell = 0, up = 0;
  hauled.onFall = () => fell++;
  hauled.onUp = () => up++;
  sail(hauled, 6, () => 0);
  assert.ok(fell >= 1 && hauled.fallen > 0 || up >= 1, 'hauled in hard in a strong wind: in you go');
  assert.ok(hauled.legs.every((L) => !L.thigh.visible) || hauled.fallen === 0);
  sail(hauled, 4, () => 1);
  assert.ok(up >= 1 && hauled.fallen === 0, 'and back on, the rig up');
});

test('the board has no anchor and no fishing; it ties up like any boat', () => {
  const b = at('windsurf');
  assert.equal(M.anchorCheck(b).ok, false);
  assert.ok(b.hull.noFish && b.hull.rig && b.sailUp);
  assert.equal(at('jetski').hull.noFish, true);
});

test('the jet ski: quick, steered by its jet, a light touch on the lever', () => {
  assert.ok(BOAT_KINDS.includes('jetski'));
  wind(2, 'calm');
  const j = at('jetski');
  const top = sail(j, 25, null, 1);
  assert.ok(top > 15 && top < 19, `flat out ${top.toFixed(1)} m/s`);
  // From a standstill, the bars over and no throttle: it barely turns; with the throttle on, it spins.
  const idle = at('jetski');
  const h0 = idle.heading;
  sail(idle, 2, null, 0, 1);
  const powered = at('jetski');
  const h1 = powered.heading;
  sail(powered, 2, null, 0.27, 1);
  assert.ok(Math.abs(idle.heading - h0) < Math.abs(powered.heading - h1) * 0.35, `off the throttle ${Math.abs(idle.heading - h0).toFixed(2)} rad, on it ${Math.abs(powered.heading - h1).toFixed(2)}`);
  assert.deepEqual(LEVERS.jetski.map((n) => n.id), ['R', 'N', '1', '2', '3', 'F']);
  assert.ok(F.isPetrol('jetski'));
  const f = F.defaultFuel();
  F.burnBoat(f, 'jetski', 1, 600);
  assert.ok(f.boats.jetski < F.TANKS.jetski - 10, `ten minutes flat out: ${f.boats.jetski.toFixed(0)} L left`);
});

test('the jet ski leaves the crests at speed in a lively sea, and stays on a calm one', () => {
  // (Heading into the sea, as you would to jump it: the wind from the south-west, she runs
  // south-west into the waves it raises. Across them, she'd ride along their crests.)
  // Flat out from rest for 20 s: her speed each time she leaves the water, her bow-up angle on
  // the water. (From 150 m back along the line from the other tests' spot, so that on the plane
  // she stays in open, deep water: from there the shallows begin 175 m on.)
  const ride = (preset, speed) => {
    wind(speed, preset, 225);
    const j = new Boat(scene, { kind: 'jetski' });
    j.place(106, 294, -Math.PI * 0.25);
    const rec = [];
    for (let i = 0; i < 30 * 20; i++) {
      clock += 1 / 30;
      conditions.time = clock;
      j.update(1 / 30, clock, 1, 0, 0);
      rec.push({ air: j.air, v: j.forwardSpeed, up: (-j.pitch * 180) / Math.PI });
    }
    const jumps = rec.filter((r, i) => r.air && !rec[i - 1]?.air).map((r) => r.v).sort((a, b) => a - b);
    // (Running: on the water and more than a third of a second from leaving it or landing.)
    const running = rec.filter((r, i) => !rec.slice(Math.max(0, i - 10), i + 11).some((q) => q.air));
    return { jumps, up: Math.max(...rec.map((r) => r.up)), running: Math.max(...running.map((r) => r.up)) };
  };
  // Fully on the plane: her speed coefficient on her planing beam, V/√(g·b), at least 3 (where B3
  // has her lift fully at Savitsky's place: hydro.js PLANE_CV; 9.3 m/s for her).
  const planing = 3 * Math.sqrt(G * new Boat(scene, { kind: 'jetski' }).phys.model.planeBeam);
  const lively = ride('lively', 10);
  const say = `${lively.jumps.length} jumps at ${lively.jumps.map((v) => v.toFixed(1)).join(', ')} m/s`;
  assert.ok(lively.jumps.length >= 3, `off the crests: ${say}`);
  // (Her jet's push turned her bow up on its full arm, and a seaway's resistance, as the fleet's
  // rule put it on her, came to more than twice her own hull resistance: she stood on her tail,
  // 30 to 38° up, and hopped along at 6 m/s.)
  assert.ok(lively.jumps[lively.jumps.length >> 1] > planing, `at planing speed (${planing.toFixed(1)} m/s): ${say}`);
  assert.ok(lively.running < 20, `running between the crests, bow up at most ${lively.running.toFixed(0)}°`);
  const calm = ride('calm', 2);
  assert.equal(calm.jumps.length, 0, 'a calm sea: no jumps');
  assert.ok(calm.up < 15, `launched from rest on a calm sea, bow up at most ${calm.up.toFixed(0)}° (it was 27 to 30°)`);
});

test('both are kept in the save, where you left them', async () => {
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const data = { day: 2, hour: 10, vessel: 'windsurf', mode: 'boat', boats: { windsurf: { x: 0, z: 300, heading: 1, sail: 0.4 }, jetski: { x: 20, z: 300, heading: 2 } } };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.vessel, 'windsurf');
  assert.equal(s.boats.jetski.x, 20);
  assert.equal(s.boats.windsurf.sail, 0.4);
});
