// The boats under power and the camera round them: the throttle lever's notches and how the motor
// answers them; casting and trolling from a moving boat; the kayak's electric motor and its
// battery; the cabin boat's cabin; the camera tilting down under the water; and the controls
// that drive it all. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

// (A stand-in canvas: the fish models paint their fins on one.)
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const Th = await import('../src/throttle.js');
const { Boat } = await import('../src/boat.js');
const Fu = await import('../src/fuel.js');
const { CameraRig } = await import('../src/camera.js');
const { Walker } = await import('../src/walker.js');
const { Fishing } = await import('../src/fishing.js');
const { RODS, TACKLE } = await import('../src/tackle.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { waveHeight } = await import('../src/world/water.js');
const { heightAt, PIERS } = await import('../src/world/terrain.js');
const { ACTIONS, defaultBindings } = await import('../src/input.js');
const P = await import('../src/gamepad.js');

const scene = new THREE.Scene();
// Open water well clear of anything (south of the bay, past the shoal's edge).
const OPEN = { x: 150, z: 330 };
const run = (b, lever, secs, steer = 0, t0 = 0) => {
  for (let i = 0; i < secs * 30; i++) b.update(1 / 30, t0 + i / 30, lever, steer, 0);
  return b;
};
const fresh = (kind, heading = Math.PI / 2) => {
  const b = new Boat(scene, { kind });
  b.place(OPEN.x, OPEN.z, heading);
  return b;
};

test('each motorboat’s lever: astern, neutral and speeds ahead that mean something on the water', () => {
  // Calm-water speed at each forward notch (m/s): dead slow about 1, slow about 2 (trolling), half 4 or more.
  for (const kind of ['skiff', 'cabin', 'bass']) {
    const L = Th.levers(kind);
    assert.equal(L.find((n) => n.id === 'N').v, 0);
    assert.ok(L[0].v < 0 && L[0].id === 'R');
    assert.deepEqual([...L].sort((a, b) => a.v - b.v), L, `${kind}: in order`);
    const speeds = L.filter((n) => n.v > 0).map((n) => run(fresh(kind), n.v, 25).forwardSpeed);
    for (let i = 1; i < speeds.length; i++) assert.ok(speeds[i] > speeds[i - 1] + 0.3, `${kind}: each notch faster (${speeds.map((v) => v.toFixed(1))})`);
    assert.ok(speeds[0] > 0.5 && speeds[0] < 1.3, `${kind}: the first notch creeps (${speeds[0].toFixed(2)})`);
    assert.ok(speeds[1] > 1.1 && speeds[1] < Th.CAST_SPEED, `${kind}: the second notch trolls (${speeds[1].toFixed(2)})`);
    assert.ok(run(fresh(kind), L[0].v, 6).forwardSpeed < -0.8, `${kind}: astern goes backwards`);
  }
  // The bass boat's first notches are its quiet electric motor.
  const bass = fresh('bass');
  bass.lever = Th.levers('bass')[2].v;
  assert.ok(bass.trolling);
});

test('the lever moves a notch at a time, and what’s allowed depends on the line and the fish', () => {
  const L = Th.levers('skiff'), N = Th.neutralIndex('skiff');
  let v = 0;
  v = Th.step('skiff', v, 1).v;
  assert.equal(v, L[N + 1].v);
  v = Th.step('skiff', v, 1).v;
  assert.equal(Th.leverWords('skiff', v), 'slow ahead');
  // With a line out: no faster than trolling speed.
  const capped = Th.step('skiff', v, 1, 'line');
  assert.ok(capped.capped);
  assert.equal(capped.v, v);
  assert.equal(Th.within('skiff', 1, 'line'), Th.levers('skiff')[Th.capIndex('skiff', 'line')].v);
  // A fish on: dead slow at most.
  assert.equal(Th.within('skiff', v, 'fight'), L[N + 1].v);
  // Down through neutral and into astern, and never off the end.
  assert.equal(Th.step('skiff', 0, -1).v, L[0].v);
  assert.equal(Th.step('skiff', L[0].v, -1).v, L[0].v);
  assert.equal(Th.setIndex('skiff', 99).v, 1);
  for (const kind of Object.keys(Th.LEVERS)) {
    const cap = Th.levers(kind)[Th.capIndex(kind, 'line')];
    assert.ok(cap.v > 0, `${kind}: you can troll`);
  }
});

test('the motor answers the lever like a real one: it builds up, eases off, changes gear through neutral, and the boat coasts', () => {
  const b = fresh('skiff');
  b.update(1 / 30, 0, 1, 0, 0);
  assert.ok(b.power > 0 && b.power < 0.1, 'not full in an instant');
  run(b, 1, 3);
  assert.equal(b.power, 1);
  const v0 = b.forwardSpeed;
  // Neutral: the motor stops pushing at once, but the boat coasts on and slows gradually.
  run(b, 0, 2);
  assert.equal(b.power, 0);
  assert.ok(b.forwardSpeed > 1 && b.forwardSpeed < v0 * 0.7, `coasting ${b.forwardSpeed.toFixed(2)} m/s`);
  run(b, 0, 15);
  assert.ok(b.forwardSpeed < 0.5);
  // Ahead straight to astern: through neutral, a pause while the gear changes, then astern.
  const c = run(fresh('skiff'), 0.4, 6);
  let paused = 0;
  for (let i = 0; i < 90; i++) {
    c.update(1 / 30, i / 30, -0.3, 0, 0);
    if (c.power === 0) paused += 1 / 30;
  }
  assert.ok(paused > 0.25, `a pause in neutral (${paused.toFixed(2)} s)`);
  assert.ok(c.power < 0);
  // At dead slow she still turns well (for piers and moorings).
  const d = run(fresh('skiff'), Th.levers('skiff')[2].v, 4);
  const h0 = d.heading;
  run(d, Th.levers('skiff')[2].v, 3, 1);
  assert.ok(Math.abs(d.heading - h0) > 1, `turned ${(d.heading - h0).toFixed(2)} rad in 3 s`);
});

test('the kayak’s electric motor: quieter and slower than the paddle, on its own battery, and never a way to get stuck', () => {
  const k = fresh('kayak');
  assert.equal(k.levered, false);
  k.setEMotor(true);
  assert.ok(k.levered && k.emotorDown);
  const motor = run(k, 1, 20).forwardSpeed;
  k.setEMotor(false);
  k.place(OPEN.x, OPEN.z, Math.PI / 2);
  const paddle = run(k, 1, 20).forwardSpeed;
  assert.ok(motor > 1.2 && motor < paddle * 0.7, `motor ${motor.toFixed(2)} m/s, paddle ${paddle.toFixed(2)} m/s`);
  // Flat: the motor gives nothing (the game then raises it, and you paddle).
  k.setEMotor(true);
  k.kflat = true;
  k.place(OPEN.x, OPEN.z, Math.PI / 2);
  assert.ok(Math.abs(run(k, 1, 5).forwardSpeed) < 0.3);
  // The battery: a quarter of an hour flat out, charged at a jetty and overnight.
  const f = Fu.defaultFuel();
  assert.equal(f.kayak, 1);
  assert.equal(Fu.burnKayak(f, 1, 60), null);
  assert.ok(Math.abs(f.kayak - (1 - 60 * Fu.KAYAK_PER_S)) < 1e-9);
  assert.ok(1 / Fu.KAYAK_PER_S > 12 * 60);
  f.kayak = 0.0005;
  assert.equal(Fu.burnKayak(f, 1, 1), 'flat');
  assert.equal(Fu.burnKayak(f, 1, 1), null);
  Fu.chargeBattery(f, 1, 'kayak');
  assert.equal(f.kayak, Fu.BATTERY_PER_HOUR);
  assert.equal(f.battery, 1, 'the bass boat’s battery is its own');
  // A save from before the motor: a full battery.
  assert.equal(Fu.cleanFuel({ car: 10 }).kayak, 1);
  assert.equal(Fu.cleanFuel({ kayak: 0.3 }).kayak, 0.3);
  assert.equal(Fu.cleanFuel({ kayak: 'lots' }).kayak, 1);
});

test('the kayak’s motor setting and battery keep with the save; an older save has it raised', async () => {
  globalThis.localStorage = new MemoryStorage();
  const S = await import('../src/save.js?boats=1');
  const s = S.loadGame().state;
  s.boats.kayak = { x: 10, z: 20, heading: 1, anchored: false, motor: true };
  s.boats.row = { x: 5, z: 6, heading: 0, anchored: true };
  s.fuel.kayak = 0.4;
  assert.ok(S.saveGame(s));
  const back = (await import('../src/save.js?boats=2')).loadGame().state;
  assert.equal(back.boats.kayak.motor, true);
  assert.equal(back.fuel.kayak, 0.4);
  assert.deepEqual(back.boats.row, { x: 5, z: 6, heading: 0, anchored: true }, 'other boats unchanged');
  // An old record without the field, or with junk in it: raised.
  const old = JSON.parse(localStorage.getItem(S.SAVE_KEY));
  old.data.boats.kayak = { x: 10, z: 20, heading: 1, anchored: false, motor: 'yes' };
  delete old.data.fuel.kayak;
  localStorage.setItem(S.SAVE_KEY, JSON.stringify(old));
  const older = (await import('../src/save.js?boats=3')).loadGame().state;
  assert.equal(older.boats.kayak.motor, undefined);
  assert.equal(older.fuel.kayak, 1);
});

// A headless angler: the real fishing system on a real boat, with a real ecosystem.
const habitat = createHabitat();
const quiet = new Proxy({}, { get: () => () => {} });
function angler(kind = 'skiff') {
  const b = fresh(kind);
  const eco = new Ecosystem(habitat);
  const words = [];
  const f = new Fishing(scene, b, quiet, quiet, eco, { flash: (t) => words.push(t), key: (a) => a, teach() {}, shake() {}, cue() {}, onCast() {}, castResult: (t) => words.push(t), quiet() {}, canopyAt: () => false });
  // (Rigged as the game rigs it: the rod with the line on its reel.)
  f.setRig({ ...RODS.sea, line: RODS.sea.lines[0] }, TACKLE.metal);
  let t = 0;
  const step = (secs, lever, held = false) => {
    for (let i = 0; i < secs * 30; i++) {
      t += 1 / 30;
      b.update(1 / 30, t, lever, 0, 0);
      eco.update(1 / 30, { env: { hour: 12, rain: 0, cloud: 0.3, daylight: 1, night: 0, hatch: 0 }, focus: b.pos, boat: { x: b.pos.x, z: b.pos.z, speed: b.speed }, walker: null, lights: [] });
      f.update(1 / 30, t, b.heading, held);
    }
  };
  return { b, f, eco, words, step };
}

test('casting from a moving boat: the cast carries the boat’s way, and a boat that’s too fast doesn’t cast', () => {
  const { b, f, words, step } = angler();
  const slow = Th.levers('skiff')[3].v;
  step(5, slow);
  assert.ok(b.speed > 1.5 && b.speed < Th.CAST_SPEED);
  f.onDown();
  assert.equal(f.state, 'aiming');
  step(0.6, slow, true);
  const plan = f.planCast(f.power, {});
  assert.ok(plan.ok && plan.carry > 1, `carried ${plan.carry?.toFixed(2)} m`);
  // The landing point is shifted along the way the boat is going.
  const still = { ...b.vel };
  b.vel.set(0, 0, 0);
  const at = f.planCast(f.power, {});
  b.vel.set(still.x, 0, still.z);
  const along = (plan.x - at.x) * b.fwd.x + (plan.z - at.z) * b.fwd.z;
  assert.ok(along > 1, `${along.toFixed(2)} m on, in the boat's direction`);
  f.onUp();
  assert.equal(f.state, 'casting');
  step(3, slow);
  assert.equal(f.state, 'drifting');
  assert.ok(words.some((w) => /way carried it/.test(w)), words.join(' | '));
  // Far too fast (and nobody to ease the throttle): no cast.
  const fast = angler();
  fast.step(8, 1);
  assert.ok(fast.b.speed > Th.CAST_SPEED + 2);
  fast.f.onDown();
  assert.equal(fast.f.state, 'idle');
  assert.ok(fast.words.some((w) => /Too fast to cast/.test(w)));
});

test('trolling: a boat under way tows its lure on the line that’s out, and the lure swims as if reeled', () => {
  const { b, f, step } = angler();
  // Stopped, cast out astern-ish (aim back over the stern), then motor away at trolling speed.
  f.onDown();
  f.aimOffset = Math.PI * 0.9;
  step(0.5, 0, true);
  f.onUp();
  step(3, 0);
  assert.equal(f.state, 'drifting');
  const len = f.lineLen;
  assert.ok(len > 8, `line out ${len.toFixed(1)} m`);
  const slow = Th.levers('skiff')[3].v;
  step(15, slow);
  if (f.state !== 'drifting') return; // (a fish took it: that's trolling too)
  const d = Math.hypot(f.hook.x - f.tip.x, f.hook.z - f.tip.z);
  assert.ok(d <= f.lineLen + 0.05 && f.lineLen > len - 0.5, `the lure trails at the line's length (${d.toFixed(1)} of ${f.lineLen.toFixed(1)} m)`);
  assert.ok(f.towSpeed > 1.2, `towed at ${f.towSpeed.toFixed(2)} m/s`);
  assert.ok(f.relSpeed > 1.2, 'it swims through the water (fish see it moving)');
  // Passing back over the lure leaves the line slack: it isn't wound in by itself.
  const before = f.lineLen;
  step(2, 0);
  assert.ok(f.lineLen >= before - 0.01);
});

test('the cabin boat’s cabin: a doorway, room to stand, a galley and a bunk inside its walls', () => {
  const b = fresh('cabin');
  assert.equal(b.cabinStations.map((s) => s.id).join(','), 'door,galley,bunk');
  const H = b.hull, zAt = (t) => -H.L / 2 + H.L * t;
  const [t0, t1] = H.cabin;
  for (const s of b.cabinStations) {
    assert.ok(s.z > zAt(t0) && s.z < zAt(t1), `${s.id} is inside the cabin`);
    assert.ok(Math.abs(s.x) < 0.3, `${s.id} is on the boards, clear of the sides`);
  }
  // Standing room: from the boards to the roof, enough for you (the eyes under the roof).
  assert.ok(b.cabinRoofY - b.cabinFloor > 1.7, `headroom ${(b.cabinRoofY - b.cabinFloor).toFixed(2)} m`);
  // The lamp hangs to one side, out of your eyeline looking forward.
  assert.ok(Math.abs(b.cabinLamp.position.x) > 0.25);
  // Looking in from above: the roof lifts away, the door opens; out again, both come back.
  b.setCabin({ open: 1, roof: false });
  run(b, 0, 2);
  assert.equal(b.cabinRoof.visible, false);
  assert.ok(b.cabinOpen > 0.9 && Math.abs(b.cabinDoor.rotation.y) > 1.4);
  b.setCabin({ open: 0, roof: true });
  run(b, 0, 2);
  assert.equal(b.cabinRoof.visible, true);
  assert.ok(b.cabinOpen < 0.1);
  // After dark the lamp lights it; by day it's off unless you're in.
  b.setCabinLight(1, false);
  assert.ok(b.cabinLight.intensity > 0.5);
  b.setCabinLight(0, false);
  assert.equal(b.cabinLight.intensity, 0);
  b.setCabinLight(0, true);
  assert.ok(b.cabinLight.intensity > 0);
  // Every other boat has no cabin to go into.
  assert.equal(fresh('skiff').cabinStations, undefined);
});

test('the camera turns right round, and tilting down past the water looks beneath it (never half in, half out)', () => {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  const rig = new CameraRig(cam);
  const b = run(fresh('skiff'), 0, 1);
  rig.init(b);
  const fishing = { busy: false, lineOut: false, state: 'idle', bob: new THREE.Vector3() };
  const go = (secs) => { for (let i = 0; i < secs * 30; i++) rig.update(1 / 30, 10 + i / 30, { boat: b, walker: null, started: true, fishing, baitFocus: null }); };
  go(2);
  const band = (p) => { const w = waveHeight(p.x, p.z, 12); return p.y > w - 0.38 && p.y < w + 0.58; };
  // All the way round, above.
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 2) {
    rig.views.boat.yaw = a;
    rig.lastManual = 1e9; // (looking round yourself: it doesn't drift back behind the boat)
    go(2);
    assert.ok(cam.position.y > 1, `above at yaw ${a.toFixed(2)}`);
  }
  // Dragging up sinks the view: below the surface, looking up at the hull.
  rig.input({ x: 0, y: -400 }, 0, 20);
  go(2);
  assert.ok(rig.views.boat.pitch < -0.5);
  assert.ok(rig.below && cam.position.y < -1, `under the water (${cam.position.y.toFixed(2)} m)`);
  assert.ok(cam.position.y > heightAt(cam.position.x, cam.position.z), 'above the seabed');
  // Every tilt in between lands clearly on one side of the surface or the other.
  for (let p = -0.7; p <= 1.2; p += 0.05) {
    rig.views.boat.pitch = p;
    go(1.5);
    assert.ok(!band(cam.position), `pitch ${p.toFixed(2)}: camera at ${cam.position.y.toFixed(2)} m`);
  }
  // Reset: back above, behind the boat.
  rig.reset(b, 30);
  go(2);
  assert.ok(!rig.below && rig.views.boat.pitch > 0.3);
});

test('on foot by the shore the camera skims the ground rather than dive into it', () => {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  const rig = new CameraRig(cam);
  const w = new Walker(scene);
  w.place(102.5, 28.5, Math.PI);
  rig.setHome(true, 0);
  const fishing = { busy: false, lineOut: false, state: 'idle', bob: new THREE.Vector3() };
  const go = (secs) => { for (let i = 0; i < secs * 30; i++) rig.update(1 / 30, 10 + i / 30, { boat: run(fresh('row'), 0, 0.1), walker: w, started: true, fishing, baitFocus: null }); };
  for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
    rig.views.foot.yaw = a;
    rig.views.foot.pitch = -0.5;
    rig.lastManual = 1e9;
    go(2.5);
    const p = cam.position, s = waveHeight(p.x, p.z, 12);
    assert.ok(p.y > heightAt(p.x, p.z) + 0.3, `yaw ${a.toFixed(2)}: above the ground`);
    assert.ok(!(p.y > s - 0.38 && p.y < s + 0.58), `yaw ${a.toFixed(2)}: not at the surface (${p.y.toFixed(2)})`);
  }
});

test('inside the cabin the camera looks down into it from above, turning with the boat', () => {
  const cam = new THREE.PerspectiveCamera(50, 1.5, 0.1, 2000);
  const rig = new CameraRig(cam);
  const b = run(fresh('cabin'), 0, 1);
  rig.init(b);
  rig.setCabin(true, 0);
  assert.equal(rig.mode, 'cabin');
  b.cabinWorld(0, b.cabinFloor + 0.9, b.cabinMid.z, rig.cabinFocus);
  const fishing = { busy: false, lineOut: false, state: 'idle', bob: new THREE.Vector3() };
  const go = (secs) => { for (let i = 0; i < secs * 30; i++) rig.update(1 / 30, i / 30, { boat: b, walker: null, started: true, fishing, baitFocus: null }); };
  go(3);
  assert.ok(cam.position.y > rig.cabinFocus.y + 1.5, 'from above');
  assert.ok(Math.hypot(cam.position.x - rig.cabinFocus.x, cam.position.z - rig.cabinFocus.z) < 4, 'close in');
  rig.input({ x: 0, y: 900 }, 0, 5);
  assert.ok(rig.views.cabin.pitch <= 1.42);
  rig.input({ x: 0, y: -9000 }, 0, 5);
  assert.ok(rig.views.cabin.pitch >= 0.88, 'never low enough to look through a wall');
  // Out on deck again: the boat view.
  rig.setCabin(false, 6);
  assert.equal(rig.mode, 'boat');
});

test('the controls: the throttle, neutral and the kayak motor on the keys and the controller', () => {
  const ids = ACTIONS.map((a) => a.id);
  for (const id of ['throttleUp', 'throttleDown', 'neutral', 'motor']) assert.ok(ids.includes(id), id);
  // No key does two things.
  const seen = new Map();
  for (const [id, codes] of Object.entries(defaultBindings())) for (const c of codes) {
    assert.ok(!seen.has(c), `${c} is on ${seen.get(c)} and ${id}`);
    seen.set(c, id);
  }
  // On a controller: B stops at the helm, L3 lowers the kayak's motor, the D-pad works the
  // throttle with a line out (where the stick works the lure), and the stick still steps it at the helm.
  assert.equal(P.buttonFor('helm', 'neutral'), 'B');
  assert.equal(P.buttonFor('helm', 'motor'), 'L3');
  assert.equal(P.buttonFor('troll', 'throttleUp'), 'D-pad ↑');
  assert.equal(P.buttonFor('troll', 'throttleDown'), 'D-pad ↓');
  assert.equal(P.MAPS.troll.B, 'cancel', 'B still reels in with a line out');
  assert.equal(P.MAPS.helm.A, 'interact');
  // And every pier still lets a boat alongside (nothing new in the way).
  assert.ok(PIERS.length > 4);
});
