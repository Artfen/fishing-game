// Marine physics C4 (docs/IMPROVEMENTS.md): lines that pull like rope (lines.js): slack, nothing;
// stretched, the pull grows with the stretch, stiffer the shorter the line and the stiffer its
// fibre, damped as it opens; past its breaking load it parts. The towline (mooring.js towStep)
// is one: a steady tow barely stretches it, and nothing pushes; taken up gently it's a fraction of
// its strength; snatched by a boat opening up flat out on a slack line it comes close, and a worn
// line (Realistic) parts; on Relaxed nothing parts.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LINES, STRENGTH, stiffness, tension, loadWords } from '../src/lines.js';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

test('a line pulls like rope: nothing slack, more the more it stretches, stiffer short and in polyester, and parts past its breaking load', () => {
  const T = LINES.towline;
  assert.equal(tension(T, 5, 4.9, 2, 500).T, 0, 'slack: nothing, however fast it opens');
  const a = tension(T, 5, 5.05, 0, 500), b = tension(T, 5, 5.1, 0, 500);
  assert.ok(a.T > 0 && Math.abs(b.T - 2 * a.T) < 1e-6, 'twice the stretch, twice the pull');
  assert.ok(stiffness(T, 2) > stiffness(T, 10), 'a short line is stiffer');
  assert.ok(stiffness(LINES.mooring, 5) > stiffness(LINES.rode, 5) * 0.9 && LINES.mooring.strain < LINES.rode.strain, 'polyester stretches less than nylon');
  // (At its breaking stretch, its breaking load.)
  assert.ok(Math.abs(tension(T, 5, 5 * (1 + T.strain * 0.99), 0, 500).T - T.mbl * 0.99) < 1);
  assert.ok(tension(T, 5, 5.2, 3, 500).T > tension(T, 5, 5.2, 0, 500).T, 'opening fast, it pulls harder (its damping)');
  const over = tension(T, 5, 6.2, 0, 500);
  assert.ok(over.parted && over.T === 0 && over.load > 1, 'past its breaking load: parted');
  const relaxed = tension(T, 5, 6.2, 0, 500, STRENGTH.relaxed);
  assert.ok(!relaxed.parted && relaxed.T > T.mbl, 'on Relaxed it holds');
  // (A worn line, on Realistic: parts at four-fifths of a new one's load.)
  assert.ok(tension(T, 5, 5 * (1 + T.strain * 0.85), 0, 500, STRENGTH.realistic).parted && !tension(T, 5, 5 * (1 + T.strain * 0.85), 0, 500, STRENGTH.standard).parted);
  assert.match(loadWords(2100, T), /^2\.1 kN, taking the strain$/);
  assert.match(loadWords(T.mbl * 0.8, T), /close to parting/);
  // No makers, real sizes.
  for (const L of Object.values(LINES)) assert.ok(L.mm >= 8 && L.mm <= 20 && L.mbl > 10000 && L.strain > 0.05 && L.strain < 0.3);
});

test('towing: a steady tow barely stretches the line and gentle take-up is a fraction of its strength; a flat-out snatch from slack comes close, parts a worn line, and on Relaxed nothing parts', async () => {
  const THREE = await import('three');
  const { Boat } = await import('../src/boat.js');
  const M = await import('../src/mooring.js');
  const scene = new THREE.Scene();
  let clock = 0;
  // The RIB towing the centre console, out in deep water, the line slack to start (her stern half
  // a metre from the console's bow): `lever` the RIB's throttle, `strength` the line's.
  // (Each run in its own water, clear of the last one's boats.)
  let lane = 0;
  const tow = (lever, strength = 1, secs = 12) => {
    const lead = new Boat(scene, { kind: 'rib' }), towed = new Boat(scene, { kind: 'console' }), z = 1200 + 60 * lane++;
    lead.place(400, z, Math.PI / 2);
    towed.place(400 - lead.hull.L / 2 - towed.hull.L / 2 - 0.4, z, Math.PI / 2);
    const out = {};
    let parted = false, peak = 0;
    const steady = [];
    for (let i = 0; i < secs * 30 && !parted; i++) {
      clock += 1 / 30;
      lead.motor = true;
      lead.lever = lever;
      lead.update(1 / 30, clock, lever, 0, 0);
      towed.update(1 / 30, clock, 0, 0, 0);
      M.towStep(lead, towed, 1 / 30, M.TOW.len, out, strength);
      parted = out.parted;
      peak = Math.max(peak, out.load || 0);
      if (i > (secs - 3) * 30) steady.push(out.T);
    }
    return { parted, peak, steadyT: steady.reduce((a, b) => a + b, 0) / Math.max(1, steady.length), towed };
  };
  const gentle = tow(0.05);
  assert.ok(!gentle.parted && gentle.peak < 0.5, `taken up gently: ${Math.round(gentle.peak * 100)} % of its strength at most`);
  assert.ok(gentle.steadyT > 20 && gentle.steadyT < 3000, `a steady tow: ${Math.round(gentle.steadyT)} N`);
  assert.ok(gentle.towed.speed > 0.5, 'the towed boat follows');
  // (A steady pull stretches a 5.5 m nylon line by a few centimetres.)
  const stretch = gentle.steadyT / stiffness(LINES.towline, M.TOW.len);
  assert.ok(stretch > 0 && stretch < 0.06, `${(stretch * 100).toFixed(1)} cm`);
  const snatch = tow(1);
  assert.ok(!snatch.parted && snatch.peak > 0.7, `a new line, snatched flat out from slack: it holds at ${Math.round(snatch.peak * 100)} %`);
  const worn = tow(1, STRENGTH.realistic);
  assert.ok(worn.parted, 'a worn one parts');
  const relaxed = tow(1, STRENGTH.relaxed);
  assert.ok(!relaxed.parted, 'on Relaxed nothing parts');
});
