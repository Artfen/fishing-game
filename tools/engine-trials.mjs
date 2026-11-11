// Runs each engine and propeller in the engine catalogue (src/engines.js) on the boat herself, in
// the game's own simulation, and writes what she does to src/engineTrials.js: the figures the
// Marine Works shows when you choose an engine. Nothing in them is estimated: each is measured
// on the hull, in open water, on a calm day, as the boat tests do.
//
//   node --import ./tests/setup.mjs tools/engine-trials.mjs          update src/engineTrials.js
//   node --import ./tests/setup.mjs tools/engine-trials.mjs --check  exit with an error if it's out of date
//
// For each engine and propeller (the speeds and the load for each boat are in engines.js
// CATALOGUE: go, cruise, laden):
//   top    her best speed flat out (m/s), from rest, 40 s of it (as the boat tests run her);
//   t20    seconds from rest to her 'go' speed (20 knots for the RIB), flat out (null: never);
//   laden  her best speed flat out with her load aboard (four people and their gear on the RIB);
//   lever  the throttle that holds her at her cruise (held there by hand, as a skipper would);
//   lph    the litres an hour she burns there (the game's own burn: see fuel.js).
// (Range at a cruise, on whatever tank she has, follows from lph: see rangeAt in engines.js.)
//
//   node --import ./tests/setup.mjs tools/engine-trials.mjs --calibrate
// runs each boat on her own engine with no limiter and prints the drag factor for CATALOGUE.

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const THREE = await import('three');
const { Boat, HULLS } = await import('../src/boat.js');
const { CATALOGUE, MODELS, engineSpec, propsFor } = await import('../src/engines.js');
const { BOAT_PER_S } = await import('../src/fuel.js');
const { wakes } = await import('../src/world/wakes.js');

const root = join(fileURLToPath(import.meta.url), '..', '..');
const out = join(root, 'src', 'engineTrials.js');

// Open water well clear of anything (as the boat tests use: south of the bay, past the shoal).
const OPEN = { x: 150, z: 330 }, DT = 1 / 30, KNOT = 0.514444, SECS = 40;
const scene = new THREE.Scene();
const r = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// (Each run on water with no wake on it: the last run's would still be spreading.)
function boatWith(kind, S, extra = 0) {
  wakes.tracks.clear();
  const b = new Boat(scene, { kind });
  b.setMotor(S);
  b.payload = S.kg + extra;
  b.place(OPEN.x, OPEN.z, Math.PI / 2);
  return b;
}

// One engine and propeller on her: the five figures.
// Flat out from rest: her best speed, and when she reached a speed (null: never).
function flatOut(kind, S, extra = 0, at = Infinity) {
  const b = boatWith(kind, S, extra);
  let t = 0, top = 0, when = null;
  for (let i = 0; i < SECS / DT; i++) {
    b.update(DT, (t += DT), 1, 0, 0);
    top = Math.max(top, b.forwardSpeed);
    if (when == null && b.forwardSpeed >= at) when = t;
  }
  return { top, when };
}

export function trial(kind, choice) {
  const C = CATALOGUE[kind], S = engineSpec(kind, HULLS[kind], choice), O = MODELS[S.model];
  const { top, when: t20 } = flatOut(kind, S, 0, C.go * KNOT);
  const laden = flatOut(kind, S, C.laden).top;
  // Held at a cruise: the lever eased up and down to keep her there, then what it settles at.
  // (An electric at its own easy pace.)
  const b = boatWith(kind, S);
  const want = (O.electric ? O.cruise : C.cruise) * KNOT;
  let lever = 0.6, sum = 0, n = 0, t = 0;
  for (let i = 0; i < 60 / DT; i++) {
    b.update(DT, (t += DT), lever, 0, 0);
    if (t > 8) lever = Math.min(1, Math.max(0.05, lever + DT * 0.12 * (want - b.forwardSpeed)));
    if (t > 40) {
      sum += lever;
      n++;
    }
  }
  const held = sum / n;
  const base = { top: r(top), t20: t20 == null ? null : r(t20, 1), laden: r(laden), lever: r(held, 3) };
  // (An electric: the share of its battery an hour there, as fuel.js burnElec takes it.)
  if (O.electric) return { ...base, kn: O.cruise, bph: r((Math.min(1, held * S.effort) ** 1.5 * 3600) / S.endure, 3) };
  const lph = BOAT_PER_S[kind] * S.burn * Math.min(1.05, held * S.effort) ** 1.5 * 3600;
  return { ...base, lph: r(lph, 1) };
}

// Her drag as the game runs her, over her hull's own curve (her own engine, no limiter, flat
// out), and her top speed with each engine in her catalogue, no limiter (what its matched
// propeller is pitched for).
export function calibrate(kind) {
  const H = HULLS[kind], C = CATALOGUE[kind];
  const free = (model) => flatOut(kind, { ...engineSpec(kind, H, { model }), vd: 1e9 }).top;
  const top = free(C.stock);
  const own = H.resist || ((v) => (H.drag?.[0] ?? 0.26) * v + (H.drag?.[1] ?? 0.055) * v * v);
  const tops = Object.fromEntries(C.models.map((m) => [m, Math.round((m === C.stock ? top : free(m)) * 1000) / 1000]));
  return { top, drag: Math.round((H.motor.thrust / own(top)) * 1e4) / 1e4, tops };
}

// (--kinds bass,skiff: run only those boats, keeping the rest of the table as it is.)
async function build() {
  const only = process.argv.includes('--kinds') ? process.argv[process.argv.indexOf('--kinds') + 1].split(',') : null;
  const was = only ? (await import('../src/engineTrials.js')).TRIALS : {};
  const T = {};
  for (const [kind, C] of Object.entries(CATALOGUE)) {
    if (only && !only.includes(kind) && was[kind]) {
      T[kind] = was[kind];
      continue;
    }
    T[kind] = {};
    for (const model of C.models) for (const prop of propsFor(kind, model)) T[kind][`${model}/${prop}`] = trial(kind, { model, prop });
  }
  const rows = Object.entries(T).map(([kind, t]) => `  ${kind}: {\n${Object.entries(t).map(([id, v]) => `    '${id}': ${JSON.stringify(v).replace(/"(\w+)":/g, '$1: ').replace(/,/g, ', ')},`).join('\n')}\n  },`);
  return `// Generated by tools/engine-trials.mjs from the boat simulation itself: do not edit by hand.
// Each engine and propeller in the catalogue (engines.js), run on the boat in open water on a
// calm day: top (m/s, flat out), t20 (s from rest to her 'go' speed), laden (m/s flat out with
// her load aboard), lever (the throttle that holds her at her cruise), lph (litres an hour there;
// an electric outboard is held at its own easy pace, kn, and bph is the share of its battery an
// hour there).
export const TRIALS = {
${rows.join('\n')}
};
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  if (process.argv.includes('--calibrate')) {
    for (const kind of Object.keys(CATALOGUE)) console.log(kind, JSON.stringify(calibrate(kind)), 'now', CATALOGUE[kind].drag);
    process.exit(0);
  }
  const text = await build();
  if (process.argv.includes('--check')) {
    const was = readFileSync(out, 'utf8');
    if (was !== text) {
      console.error('src/engineTrials.js is out of date: run node --import ./tests/setup.mjs tools/engine-trials.mjs');
      process.exit(1);
    }
    console.log('src/engineTrials.js is up to date.');
  } else {
    writeFileSync(out, text);
    console.log(text);
  }
}
