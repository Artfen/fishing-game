// The jet ski (docs/HUMAN-TOUCH.md, H3): its engine voice, comfortable to listen to for an hour
// (a smooth drone with the water rushing under it, not a rasp), the others' unchanged; and engines
// on a volume of their own. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { engineVoice, voiceOfHull } from '../src/enginevoice.js';
import { cleanSettings } from '../src/settings.js';

test('the jet ski\'s voice: no rasp at speed, a filter well under half as bright, no resonant peak', () => {
  const full = engineVoice(1, 'jet'), idle = engineVoice(0.1, 'jet'), half = engineVoice(0.5, 'jet');
  assert.ok(full.cutoff <= 1600, `its filter at full throttle: ${full.cutoff} Hz (it was 2880)`);
  assert.ok(full.q <= 1, 'no resonant peak');
  assert.ok(full.rpm <= 175, `its note at full throttle: ${full.rpm} Hz (it was 220)`);
  // The putter (an amplitude flutter at the firing rate, 50–100 Hz at speed: the rasp) only at idle.
  assert.ok(idle.lfoDepth > 0.2, 'a putter at idle');
  assert.equal(half.lfoDepth, 0, 'gone by half throttle');
  assert.equal(full.lfoDepth, 0);
  // Softer at full throttle than an outboard; the water carries the speed.
  assert.ok(full.gain < engineVoice(1, '').gain * 0.75, `${full.gain} against an outboard's ${engineVoice(1, '').gain}`);
  assert.ok(full.water > idle.water * 3, 'the water and the intake rush louder with speed');
  assert.ok(full.drift > 0, 'a little wander in pitch, as she rides the waves');
  // Off: silent, water and all.
  const off = engineVoice(0, 'jet');
  assert.equal(off.gain, 0);
  assert.equal(off.water, 0);
});

test('the outboards and the diesels sound just as they did', () => {
  for (const L of [0.12, 0.5, 1]) {
    const o = engineVoice(L, '');
    assert.equal(o.rpm, 34 + L * 58);
    assert.equal(o.cutoff, 260 + L * 900);
    assert.equal(o.gain, 0.035 + L * 0.07);
    assert.equal(o.lfoDepth, 0.45);
    assert.equal(o.water, 0);
    assert.equal(o.drift, 0);
    const d = engineVoice(L, 'inboard');
    assert.equal(d.rpm, 24 + L * 38);
    assert.equal(d.ratio, 1.006);
    assert.equal(d.gain, 0.05 + L * 0.08);
  }
  // A catalogue outboard's own note and smoothness, as before.
  const v6 = engineVoice(0.5, '', { pitch: 0.8, smooth: 0.5 });
  assert.ok(Math.abs(v6.rpm - (34 + 0.5 * 58) * 0.8) < 1e-9);
  assert.ok(Math.abs(v6.lfoDepth - 0.225) < 1e-9);
});

test('a friend\'s jet ski is heard as a jet ski, a friend\'s cabin boat as a diesel', () => {
  assert.equal(voiceOfHull({ motor: { jet: true } }, 'jetski'), 'jet');
  assert.equal(voiceOfHull(null, 'jetski'), 'jet', 'even before her hull is known');
  assert.equal(voiceOfHull({ motor: { inboard: true } }, 'trawler'), 'inboard');
  assert.equal(voiceOfHull({ motor: {} }, 'cabin'), 'inboard');
  assert.equal(voiceOfHull({ motor: {} }, 'skiff'), '');
});

test('engines have a volume of their own; a game from before keeps them where its boat sounds were', () => {
  assert.equal(cleanSettings({}).audio.engines, 1);
  assert.equal(cleanSettings({ audio: { effects: 0.4 } }).audio.engines, 0.4, 'nothing gets louder');
  assert.equal(cleanSettings({ audio: { effects: 0.4, engines: 0.7 } }).audio.engines, 0.7);
  assert.equal(cleanSettings({ audio: { engines: 3 } }).audio.engines, 1);
  assert.equal(cleanSettings({ audio: { engines: 'loud' } }).audio.engines, 1);
});

// Anchoring her (H3b): no full anchor; the beach in the shallows; a folding grapnel, if fitted, in
// water to 5 m; and plainly why not.
const THREE = await import('three');
const { anchorCheck, rodeFor, GRAPNEL, ANCHOR, noAnchor } = await import('../src/mooring.js');
const { solidHeight } = await import('../src/world/terrain.js');
const { FITS, fitEffect } = await import('../src/shipyard.js');
const { sanitize } = await import('../src/save.js');
const { Boat } = await import('../src/boat.js');
// (Water lo to hi m deep at a point, south of the harbour, where the bay shelves.)
function spot(lo, hi) {
  for (let x = -300; x < 400; x += 3) for (let z = 150; z < 1200; z += 3) {
    const d = -solidHeight(x, z);
    if (d > lo && d < hi) return { x, z, d };
  }
  return null;
}
// A stand-in jet ski (or skiff), her bow at (x, z).
const craft = (at, { kind = 'jetski', grapnel = false, speed = 0 } = {}) => ({
  kind, grapnel, speed, hull: { draft: 0.3, L: 3.2, motor: kind === 'jetski' ? { jet: true } : {} },
  pos: { x: at.x, z: at.z - 3.2 * 0.45 }, fwd: { x: 0, z: 1 },
});

test('a jet ski carries no anchor: in open water it says so, and what to do instead', () => {
  const deep = spot(3, 4.5);
  assert.ok(deep, 'somewhere 3–4.5 m deep');
  const c = anchorCheck(craft(deep));
  assert.equal(c.ok, false);
  assert.match(c.why, /no anchor/);
  assert.match(c.why, /beach|shallows/);
  assert.match(c.why, /grapnel/);
  // The skiff there anchors as she always did.
  assert.equal(anchorCheck(craft(deep, { kind: 'skiff' })).ok, true);
  assert.ok(noAnchor({ kind: 'jetski', hull: {} }) && !noAnchor({ kind: 'skiff', hull: { motor: {} } }));
});

test('her folding grapnel holds her in water to 5 m, on its 10 m line; deeper, it says why', () => {
  const ok = anchorCheck(craft(spot(3, 4.5), { grapnel: true }));
  assert.equal(ok.ok, true);
  assert.equal(ok.grapnel, true);
  const deep = spot(7, 12), no = anchorCheck(craft(deep, { grapnel: true }));
  assert.equal(no.ok, false);
  assert.match(no.why, /Too deep for her grapnel/);
  // Its line: never more than 10 m out; a boat's rope as it was.
  for (const d of [1, 3, 5]) assert.ok(rodeFor(d, GRAPNEL.rope) <= GRAPNEL.rope && rodeFor(d, GRAPNEL.rope) >= d);
  for (const d of [2, 8, 20]) assert.equal(rodeFor(d), Math.min(Math.max(d * ANCHOR.scope, d + 2.5), ANCHOR.rope));
  // Fitted at the Marine Works, for the jet ski alone; it holds less than an anchor.
  assert.deepEqual(Object.keys(FITS.grapnel.price), ['jetski']);
  const e = fitEffect({ owned: ['jetski'], fits: { jetski: ['grapnel'] } }, 'jetski');
  assert.equal(e.grapnel, true);
  assert.ok(e.hold < 1);
  assert.equal(fitEffect({ owned: ['jetski'], fits: {} }, 'jetski').grapnel, false);
});

test('in the shallows she\'s beached (sand, shingle, mud), not on rock', () => {
  const shallow = spot(0.1, 0.5);
  assert.ok(shallow, 'somewhere under half a metre deep');
  const c = anchorCheck(craft(shallow));
  assert.equal(c.ok, true);
  assert.equal(c.beach, true);
  const rock = anchorCheck(craft(shallow), () => ({ kind: 'rock' }));
  assert.equal(rock.ok, false);
  assert.match(rock.why, /hole her/);
  assert.equal(anchorCheck(craft(shallow), () => ({ kind: 'gravel' })).beach, true, 'shingle will do');
  assert.match(anchorCheck(craft(shallow, { speed: 3 })).why, /Slow down/);
});

test('beached, she lies where she is through a blow, until the throttle\'s opened', () => {
  const at = spot(0.3, 0.6);
  const b = new Boat(new THREE.Scene(), { kind: 'jetski' });
  b.place(at.x, at.z, 0);
  let clock = 0;
  b.update(1 / 30, clock, 0, 0, 0);
  b.beached = { x: b.pos.x, z: b.pos.z, heading: b.heading };
  const x0 = b.pos.x, z0 = b.pos.z;
  for (let i = 0; i < 300; i++) {
    clock += 1 / 30;
    b.vel.z -= 1.5 / 30; // (a steady push, as a breeze would)
    b.update(1 / 30, clock, 0, 0, 0);
  }
  assert.ok(Math.hypot(b.pos.x - x0, b.pos.z - z0) < 0.05, `still where she was: ${Math.hypot(b.pos.x - x0, b.pos.z - z0).toFixed(3)} m`);
  assert.ok(b.beached);
  b.update(1 / 30, clock, 0.5, 0, 0);
  assert.equal(b.beached, null, 'the throttle pushes her off');
});

test('a jet ski left on the beach is still there when the game is loaded; nothing else says beached', () => {
  const S = sanitize({ boats: { jetski: { x: 10, z: 300, heading: 1, beached: true }, skiff: { x: 12, z: 300, heading: 0, beached: 'yes' } } });
  assert.equal(S.boats.jetski.beached, true);
  assert.equal(S.boats.skiff.beached, undefined);
});
