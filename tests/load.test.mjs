// Marine physics C1 (docs/IMPROVEMENTS.md): what a boat carries, each weight where it is
// (boat.js setLoads, loadPlace, loadForces; main.js loadsOf): she sits lower for it, trims to a
// weight forward or aft and heels to one at her side, through her own buoyancy; you walking her
// deck trim her as you go; her inertia grows with her load; and with nothing aboard she floats
// exactly as before. Starting with the RIB.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS } = await import('../src/boat.js');

const scene = new THREE.Scene();
// (Afloat in still water out in the bay, settled for a while: her trim (pitch, + bow down) and
// heel (roll), degrees, and her centre of gravity's height.)
const afloat = (kind, loads, prep) => {
  const b = new Boat(scene, { kind });
  b.place(300, 900, 0);
  b.setLoads(loads?.(b) || []);
  prep?.(b);
  for (let i = 0; i < 360; i++) b.update(1 / 30, i / 30, 0, 0, 0);
  return { pitch: (b.pitch * 180) / Math.PI, roll: (b.roll * 180) / Math.PI, y: b.phys.x[1], b };
};

test('the RIB trims to a weight forward or aft, heels to one at her side, and sits lower for it', () => {
  const H = HULLS.rib, none = afloat('rib');
  const bow = afloat('rib', (b) => [{ kg: 120, p: b.loadPlace('bow') }]);
  const aft = afloat('rib', (b) => [{ kg: 120, p: b.loadPlace('engine') }]);
  const port = afloat('rib', () => [{ kg: 80, p: [H.B * 0.8, H.floorY + 0.4, 0] }]);
  assert.ok(bow.pitch > none.pitch + 0.4, `bow-down with 120 kg forward: ${none.pitch.toFixed(2)}° → ${bow.pitch.toFixed(2)}°`);
  assert.ok(aft.pitch < none.pitch - 0.4, `stern-down with 120 kg aft: ${aft.pitch.toFixed(2)}°`);
  assert.ok(Math.abs(port.roll - none.roll) > 0.8, `heeled with 80 kg to one side: ${port.roll.toFixed(2)}°`);
  // (Port is +x: the heel's sign is the one a weight to port gives; the other way, the other.)
  const star = afloat('rib', () => [{ kg: 80, p: [-H.B * 0.8, H.floorY + 0.4, 0] }]);
  assert.ok(Math.sign(port.roll - none.roll) === -Math.sign(star.roll - none.roll));
  // Lower in the water for the weight, and only a sensible few degrees for any of it.
  assert.ok(bow.y < none.y && aft.y < none.y);
  for (const r of [bow, aft, port, star]) assert.ok(Math.abs(r.pitch) < 4 && Math.abs(r.roll) < 4);
});

test('you walking forward on her deck dip her bow; back at the wheel she’s as she was', () => {
  const H = HULLS.rib, zAt = (t) => -H.L / 2 + H.L * t;
  const helm = afloat('rib', null, (b) => b.setDeck(true));
  const fwd = afloat('rib', null, (b) => {
    b.setDeck(true);
    b.deck.x = 0;
    b.deck.z = zAt(0.82);
  });
  assert.ok(fwd.pitch > helm.pitch + 0.2, `${helm.pitch.toFixed(2)}° at the wheel, ${fwd.pitch.toFixed(2)}° forward`);
  const none = afloat('rib');
  assert.ok(Math.abs(helm.pitch - none.pitch) < 0.05, 'at the wheel: as with no one walking');
});

test('her inertia grows with her load, her payload is its sum, and with nothing aboard she floats as before', () => {
  const b = new Boat(scene, { kind: 'rib' }), I0 = [...b.phys.model.inertia];
  b.setLoads([{ kg: 100, p: b.loadPlace('bow') }, { kg: 40, p: b.loadPlace('battery') }, { kg: NaN, p: [0, 0, 0] }, null]);
  assert.equal(b.payload, 140);
  assert.ok(b.phys.I.every((v, i) => v > I0[i]), 'more inertia every way');
  assert.deepEqual(b.phys.model.inertia, I0, 'her model’s own untouched');
  // A part-empty standard tank: lighter than built (a weight below zero).
  b.setLoads([{ kg: -15, p: b.loadPlace('fuel') }]);
  assert.equal(b.payload, -15);
  // Nothing aboard: the same as a boat never given a load.
  const a = afloat('rib', () => []), c = (() => {
    const x = new Boat(scene, { kind: 'rib' });
    x.place(300, 900, 0);
    for (let i = 0; i < 360; i++) x.update(1 / 30, i / 30, 0, 0, 0);
    return { pitch: (x.pitch * 180) / Math.PI, roll: (x.roll * 180) / Math.PI, y: x.phys.x[1] };
  })();
  assert.ok(Math.abs(a.pitch - c.pitch) < 1e-9 && Math.abs(a.roll - c.roll) < 1e-9 && Math.abs(a.y - c.y) < 1e-9);
});

test('every boat has a place for each kind of weight, inside her', () => {
  for (const [kind, H] of Object.entries(HULLS)) {
    const b = new Boat(scene, { kind });
    for (const id of ['engine', 'fuel', 'cockpit', 'helm', 'bow', 'battery', 'livewell', 'anchor', 'sonar', 'troll', 'tank']) {
      const p = b.loadPlace(id);
      assert.ok(p.every(Number.isFinite), `${kind} ${id}`);
      assert.ok(Math.abs(p[2]) <= H.L / 2 + 0.4, `${kind} ${id}: ${p[2].toFixed(2)} along her`);
    }
  }
});
