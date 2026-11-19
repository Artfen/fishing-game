// An inside helm for the boats with a wheelhouse (the cabin boat and the sport-fishing yacht):
// steered from in the wheelhouse, out of the weather, the sea ahead through the windscreen, as
// well as from her helm in the cockpit (the cabin boat's tiller, the yacht's wheel under her
// hardtop). Seated to it on the cabin boat, standing on the yacht; your eyes, your hands and your
// figure there, and friends see you there.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS } = await import('../src/boat.js');
const { cleanPose } = await import('../src/together.js');
const { wakes } = await import('../src/world/wakes.js');

const scene = new THREE.Scene();
const KINDS = ['cabin', 'cruiser'];
const meshes = (b) => {
  const out = [];
  b.group.traverse((o) => {
    if (!o.isMesh) return;
    for (let p = o; p; p = p.parent) if (!p.visible) return;
    out.push(o);
  });
  return out;
};
const settle = (b, n = 30, t0 = 0) => {
  for (let i = 0; i < n; i++) b.update(1 / 30, t0 + i / 30, 0, 0, 0);
  b.group.updateMatrixWorld(true);
  return b;
};
const at = (kind) => {
  const b = new Boat(scene, { kind });
  b.place(150, 330, 0);
  return settle(b);
};
const local = (b, v) => b.body.worldToLocal(v.clone());

test('the cabin boat and the yacht each have an inside helm; the other boats none', () => {
  for (const kind of Object.keys(HULLS)) {
    const b = new Boat(scene, { kind });
    if (KINDS.includes(kind)) {
      assert.ok(HULLS[kind].helmInside && b.innerWheel, `${kind}: an inside helm, its wheel drawn`);
      assert.equal(b.setHelmInside(true), true);
      assert.ok(b.helmIn);
    } else {
      assert.ok(!HULLS[kind].helmInside && !b.innerWheel, `${kind}: none`);
      assert.equal(b.setHelmInside(true), false, kind);
      assert.ok(!b.helmIn, kind);
    }
  }
});

test('at her inside helm your eyes are in her wheelhouse, and see out ahead through its windscreen', () => {
  for (const kind of KINDS) {
    const b = at(kind), H = b.hull, out = local(b, b.eyePoint(new THREE.Vector3()));
    b.setHelmInside(true);
    settle(b, 30, 2);
    const eyeW = b.eyePoint(new THREE.Vector3()), eye = local(b, eyeW);
    // In the house: forward of its back, under its roof, inside its walls.
    const zb = -H.L / 2 + H.L * H.cabin[0];
    assert.ok(eye.z > zb + 0.3 && eye.z < -H.L / 2 + H.L * H.cabin[1], `${kind}: eye at z ${eye.z.toFixed(2)}`);
    assert.ok(eye.y > b.cabinFloor + 1.1 && eye.y < b.cabinRoofY - 0.12, `${kind}: eye ${eye.y.toFixed(2)} m up, the roof at ${b.cabinRoofY.toFixed(2)}`);
    assert.ok(Math.abs(eye.x) < 0.6, `${kind}: eye ${eye.x.toFixed(2)} across`);
    // Well forward of where it was outside.
    assert.ok(eye.z - out.z > 2.5, `${kind}: ${out.z.toFixed(2)} → ${eye.z.toFixed(2)}`);
    // A fan of rays ahead and a little down, from your eyes: nothing solid of her in the way (her
    // glass is clear; your own figure and rod don't count) until the water ahead of her bow.
    const q = b.body.getWorldQuaternion(new THREE.Quaternion());
    const own = new Set([...b.selfMats]);
    b.rod?.group?.traverse((o) => o.material && own.add(o.material));
    const solid = meshes(b).filter((m) => !m.material.transparent && !own.has(m.material));
    const ray = new THREE.Raycaster();
    let hits = 0, rays = 0;
    for (const yaw of [-0.12, 0, 0.12]) for (const pitch of [0, -0.04, -0.08]) {
      ray.set(eyeW, new THREE.Vector3(Math.sin(yaw), Math.sin(pitch), Math.cos(yaw)).normalize().applyQuaternion(q));
      ray.far = 6;
      rays++;
      const h = ray.intersectObjects(solid, false)[0];
      if (h) hits++;
    }
    assert.equal(hits, 0, `${kind}: ${hits} of ${rays} lines of sight blocked`);
  }
});

test('her inside helm: the wheel below the windscreen, within the house; the cabin boat’s stool clear of her galley', () => {
  for (const kind of KINDS) {
    const b = at(kind), G = b.hull.helmInside, w = b.innerWheel.position;
    assert.ok(b.insideHelmTop < (kind === 'cabin' ? 1.28 : 2.24), `${kind}: its shelf top ${b.insideHelmTop.toFixed(2)} under the glass`);
    assert.ok(Math.abs(w.x - G.x) < 1e-9 && w.y > b.cabinFloor + 0.8 && w.y < b.insideHelmTop + 0.05, `${kind}: the wheel at ${w.x.toFixed(2)}, ${w.y.toFixed(2)}`);
    // (Ahead of where you are, within reach.)
    assert.ok(w.z - G.z > 0.15 && w.z - G.z < 0.6, `${kind}: the wheel ${(w.z - G.z).toFixed(2)} m ahead of you`);
    // Its face turned up to your eyes, so you see its rim round, not edge on.
    b.setHelmInside(true);
    settle(b, 30, 2);
    const eye = local(b, b.eyePoint(new THREE.Vector3())), face = new THREE.Vector3(0, 0, 1).applyEuler(b.innerWheel.rotation);
    const on = Math.abs(face.dot(eye.sub(w).normalize()));
    assert.ok(on > 0.85, `${kind}: the wheel's face ${on.toFixed(2)} on to your eyes`);
  }
  // All of it inside the house: its shelf's ends, and the throttle's head, within its walls where
  // it's narrowest (forward, and up).
  for (const kind of KINDS) {
    const b = at(kind), B = b.insideHelmBox;
    for (const z of [B.z0, B.z1]) for (const y of [B.y0, B.y1]) {
      const r = B.room(z, y);
      assert.ok(-B.x0 < r && B.x1 < r, `${kind}: the shelf ${B.x0.toFixed(2)} to ${B.x1.toFixed(2)} within ±${r.toFixed(2)} at z ${z.toFixed(2)}, y ${y.toFixed(2)}`);
    }
  }
  // Their galleys are to starboard by the door: clear of where you are (the cabin boat's stool, 0.18
  // round, its back 0.2 behind you and 0.15 either side; the yacht, you standing, 0.2 round).
  for (const kind of KINDS) {
    const b = at(kind), G = b.hull.helmInside, g = b.galleyBox;
    const r = G.sit ? 0.18 : 0.2, cz = G.sit ? G.z - 0.02 : G.z;
    const dx = Math.max(g.x0 - G.x, 0, G.x - g.x1), dz = Math.max(g.z0 - cz, 0, cz - g.z1);
    assert.ok(Math.hypot(dx, dz) > r, `${kind}: ${Math.hypot(dx, dz).toFixed(2)} m from the galley`);
    if (G.sit) assert.ok(G.x + 0.15 < 0.3 && (G.z - 0.2 > g.z1 || G.x - 0.15 > g.x1), `${kind}: the stool's back clear of the galley`);
  }
});

test('at her inside helm your hands are on its wheel, and she steers as from outside; back out, as you were', () => {
  for (const kind of KINDS) {
    // The same turn from either helm.
    const turn = (inside) => {
      // (On a sea without the other run's wake on it.)
      wakes.tracks.clear();
      const b = at(kind);
      b.setHelmInside(inside);
      let t = 2;
      settle(b, 10, t);
      const h0 = b.heading;
      for (let i = 0; i < 30 * 6; i++) b.update(1 / 30, (t += 1 / 30), 0.6, 0.8, 0);
      return { b, turned: b.heading - h0 };
    };
    const a = turn(false), { b, turned } = turn(true);
    assert.ok(Math.abs(a.turned) > 0.3, `${kind}: she turns (${a.turned.toFixed(2)} rad)`);
    assert.ok(Math.abs(turned - a.turned) < 1e-6, `${kind}: from inside ${turned.toFixed(3)}, from outside ${a.turned.toFixed(3)}`);
    b.group.updateMatrixWorld(true);
    const G = b.hull.grip || [0.15, 0.05];
    for (const arm of b.arms) {
      const want = b.innerWheel.localToWorld(new THREE.Vector3(arm.s > 0 ? G[0] : -G[0], G[1], 0));
      assert.ok(arm.hand.getWorldPosition(new THREE.Vector3()).distanceTo(want) < 0.02, `${kind}: a hand on the inside wheel`);
    }
    // Back out: your eyes where they were, and (the cabin boat) your hand on her tiller.
    const ref = at(kind), want = local(ref, ref.eyePoint(new THREE.Vector3()));
    b.setHelmInside(false);
    settle(b, 10, 20);
    assert.ok(!b.helmIn);
    assert.ok(local(b, b.eyePoint(new THREE.Vector3())).distanceTo(want) < 1e-6, `${kind}: back at her helm outside`);
    if (kind === 'cabin') {
      b.group.updateMatrixWorld(true);
      b.motorGroup.updateMatrixWorld(true);
      const tiller = b.motorGroup.localToWorld(b.tillerGrip.clone());
      const port = b.arms.find((x) => x.s > 0);
      assert.ok(port.hand.getWorldPosition(new THREE.Vector3()).distanceTo(tiller) < 0.05, 'a hand back on her tiller');
    }
  }
});

test('walking the yacht’s deck takes you out of her wheelhouse; her fittings stay at her helm outside', () => {
  const b = at('cruiser');
  b.setHelmInside(true);
  assert.ok(b.atHelm);
  assert.ok(b.setDeck(true) && !b.helmIn && b.deck, 'out on deck');
  // The cabin boat's helm fittings (a screen, the VHF) weigh at her tiller, wherever you sit.
  const c = at('cabin'), before = c.loadPlace('helm').slice();
  c.setHelmInside(true);
  assert.deepEqual(c.loadPlace('helm'), before);
});

test('friends see you at her inside helm: it goes in your boat’s pose, and back', () => {
  const pose = { m: 'boat', k: 'cruiser', x: 1, z: 2, h: 0, f: false, s: false, n: false };
  assert.equal(cleanPose({ ...pose, hi: 1 }, ['cruiser']).hi, true);
  assert.equal(cleanPose(pose, ['cruiser']).hi, undefined);
  // (Drawn in their game: see world/visitors.js.)
  const src = readFileSync(new URL('../src/world/visitors.js', import.meta.url), 'utf8');
  assert.match(src, /b\.setHelmInside\?\.\(!!P\.hi && !P\.f && !P\.o\)/);
});

test('the game: the inside helm offered at her helm, under way and still; no casting from it; the dashboard outside', () => {
  const src = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(src, /text: \$t\('Steer from inside the wheelhouse'\), run: \(\) => helmInside\(true\)/);
  assert.match(src, /\$t\('Out to the helm in the cockpit'\) : \$t\('Back out to the tiller'\)/);
  assert.match(src, /const helmBound = !onFoot && boat\.helmIn;/);
  assert.match(src, /if \(!onFoot && boat\.helmIn && !modal && !fishing\.busy\) \{\n\s+hud\.flash\(\$t`From the inside helm you can't cast/);
  assert.match(src, /!cabinIn && !helmBound && !dive/);
  assert.match(src, /cabinIn \|\| boat\.helmIn \|\| !boat\.dash/);
  assert.match(src, /\.\.\.\(boat\.helmIn \? \{ hi: 1 \} : \{\}\)/);
  // (Out of the weather in there.)
  assert.match(src, /const indoors = driving \|\| !!cabinIn \|\| \(!onFoot && boat\.helmIn\)/);
});
