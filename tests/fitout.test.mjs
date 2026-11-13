// G5 of docs/PROGRESSION.md: fit-outs that change the work a boat can take (shipyard.js FITS'
// work, vessels.js vesselOf), and her engine's service (service.js): an engine run on past its
// hundred hours slowly loses a little push and burns more, starts harder cold, and is herself
// again once the Marine Works has serviced it. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const { FITS, fitEffect, fitsFor, cleanYard } = await import('../src/shipyard.js');
const V = await import('../src/vessels.js');
const { openSea, seaFor, offshorePlan } = await import('../src/offshore.js');
const S = await import('../src/service.js');
const { cleanVessels, newVessel, addRun } = await import('../src/papers.js');
const En = await import('../src/engine.js');
const { Boat, HULLS } = await import('../src/boat.js');
const { wakes } = await import('../src/world/wakes.js');

const scene = new THREE.Scene();
const yardWith = (fits) => ({ fits });
const hook = (yard) => V.setFitOut((k) => {
  const e = fitEffect(yard, k);
  return e.seats || e.comfort || e.divers ? { seats: e.seats, comfort: e.comfort, divers: e.divers } : null;
});

test('fit-outs change the work she can take: seats, divers, and her people in a rougher sea', () => {
  // Each is offered only where it means something: a ladder where there's no room for divers, a
  // dodger on an open boat, seats on a boat with a cockpit to put them in.
  for (const k of Object.keys(FITS.ladder.price)) assert.equal(V.VESSELS[k].divers, false, k);
  for (const k of Object.keys(FITS.dodger.price)) assert.equal(V.VESSELS[k].shelter, false, k);
  for (const k of Object.keys(FITS.seating.price)) assert.ok(FITS.seating.work.seats[k] >= 1, k);
  for (const id of ['seating', 'ladder', 'dodger']) for (const k of Object.keys(FITS[id].price)) assert.ok(fitsFor(k, []).includes(id), `${id} on the ${k}`);
  const e = fitEffect(yardWith({ skiff: ['seating', 'ladder', 'dodger'] }), 'skiff');
  assert.deepEqual([e.seats, e.comfort, e.divers], [1, 0.4, true]);
  assert.equal(e.kg, FITS.seating.kg + FITS.ladder.kg + FITS.dodger.kg, 'each weighs what it weighs');
  // (Nothing for a fitting she doesn't take, or none at all.)
  const none = fitEffect(yardWith({ bass: ['seating'] }), 'bass');
  assert.deepEqual([none.seats, none.comfort, none.divers], [0, 0, false]);

  // Without the game's word (or with nothing fitted), every boat is as she was built.
  V.setFitOut(null);
  assert.equal(V.vesselOf('skiff'), V.VESSELS.skiff);
  const yard = yardWith({ skiff: ['ladder'], rib: ['seating', 'dodger'], cabin: ['seating', 'ladder'] });
  hook(yard);
  try {
    // A dive job: the skiff couldn't take it; with the ladder she can (two divers, her two seats).
    assert.equal(V.fits('skiff', { pax: 2, divers: true }), null);
    assert.equal(V.fits('cabin', { pax: 6, divers: true }), null, 'the cabin boat: four seats and two more, and a ladder');
    assert.match(V.fits('cabin', { pax: 7 }), /seats 6/);
    assert.equal(V.vesselOf('rib').seats, 7);
    // (The record itself is never changed: the hull's figures stay as built.)
    assert.equal(V.VESSELS.rib.seats, 5);
    assert.equal(V.hullOf('rib').seats, 5);
    // The smallest boat for a job counts what she's fitted with.
    assert.equal(V.smallestFor({ pax: 2, divers: true }, ['skiff', 'rib']), 'skiff');

    // The dodger: her people happy in 40 cm more sea; her hull no more seaworthy.
    assert.equal(V.vesselOf('rib').comfort, 1.5);
    assert.ok(V.misery('rib', 1.5) === 0 && V.hullMisery('rib', 1.5) > 0);
    assert.equal(seaFor('rib', 1.4), 'fine');
    yard.fits.skiff = ['dodger'];
    assert.equal(V.vesselOf('skiff').comfort, 1);
    assert.equal(openSea('skiff'), false, 'a skiff with a dodger is still an inshore boat');
    assert.ok(offshorePlan({ placeName: 'The Blue Water', dist: 5000, kind: 'skiff' }).some((l) => !l.ok && /inshore boat: a sea over 0\.6 m/.test(l.text)));
    // A sea that's dangerous for her hull is dangerous with or without the canvas.
    for (let sea = 0; sea <= 3; sea += 0.05) {
      if (V.hullMisery('skiff', sea) >= 1) assert.equal(seaFor('skiff', sea), 'dangerous', `${sea.toFixed(2)} m`);
      else assert.notEqual(seaFor('skiff', sea), 'dangerous', `${sea.toFixed(2)} m`);
    }
  } finally {
    V.setFitOut(null);
  }

  // A save keeps them, and they're taken off like any other.
  const Y = cleanYard({ owned: ['skiff', 'rib'], fits: { skiff: ['ladder', 'dodger', 'nonsense'], rib: ['seating', 'ladder'] } }, Object.keys(V.VESSELS));
  assert.deepEqual(Y.fits.skiff, ['ladder', 'dodger']);
  assert.deepEqual(Y.fits.rib, ['seating'], 'the RIB takes no ladder: she has room for divers already');
});

test('her engine’s service: due every hundred hours, worn a little past it, herself again after', () => {
  const P = newVessel('rib', 1);
  assert.equal(P.serviced, 0);
  assert.equal(S.wearOf(P), 0);
  assert.equal(S.serviceRow(P, 'rib'), null, 'not due yet');
  assert.match(S.serviceWords(P), /next is due in 100/);
  addRun(P, { hours: 95 });
  assert.match(S.serviceWords(P), /Due a service in 5 engine hours/);
  const row = S.serviceRow(P, 'rib');
  assert.equal(row.id, 'service');
  assert.equal(row.price, S.SERVICE_PRICE.rib);
  assert.equal(S.wearOf(P), 0, 'due is not worn');
  // Overdue: a step at a time, up to a tenth down on power and a seventh more fuel.
  addRun(P, { hours: 55 });
  assert.equal(S.wearOf(P), 0.5);
  assert.match(S.serviceWords(P), /50 engine hours overdue.*down on power and thirsty/);
  addRun(P, { hours: 500 });
  assert.equal(S.wearOf(P), 1);
  const fx = S.wearFx(1);
  assert.ok(Math.abs(fx.thrust - 0.9) < 1e-9 && Math.abs(fx.burn - 1.15) < 1e-9);
  assert.deepEqual(S.wearFx(0), { thrust: 1, burn: 1, start: 0 });
  // Serviced: the hours start again from there.
  assert.ok(S.serviceDone(P));
  assert.equal(S.sinceService(P), 0);
  assert.equal(S.wearOf(P), 0);
  // The twin-engined boats cost twice; an electric outboard and a boat with no engine have none.
  assert.equal(S.SERVICE_PRICE.console, 2 * 55);
  addRun(P, { hours: 200 });
  assert.equal(S.serviceRow(P, 'rib', { electric: true }), null);
  assert.equal(S.serviceRow(P, 'row'), null);
  assert.match(S.serviceWords(P, { electric: true }), /nothing to service/);
  for (const k of Object.keys(S.SERVICE_PRICE)) assert.ok(En.hasEngine(k), `${k} has an engine to service`);
  for (const k of Object.keys(En.PROFILES)) assert.ok(S.SERVICE_PRICE[k] > 0, `${k}'s service has a price`);

  // A save keeps it; a game from before services counts from now (nothing suddenly overdue).
  const kept = cleanVessels({ rib: { ...P, serviced: 150 }, skiff: { hours: 340, nm: 2, log: [] }, cabin: { hours: 10, serviced: 99 } }, ['rib', 'skiff', 'cabin'], 5);
  assert.equal(kept.rib.serviced, 150);
  assert.equal(kept.skiff.serviced, 340);
  assert.equal(S.wearOf(kept.skiff), 0);
  assert.equal(kept.cabin.serviced, 10, 'never past her own hours');
});

test('a worn engine starts harder cold, and pushes her a touch less: never fails for it', () => {
  // The pull-start: the first pull catches less often; never more than three, worn or not.
  const firstPull = (wear) => {
    let caught = 0;
    for (let i = 0; i < 400; i++) {
      const en = En.newEngine('skiff');
      En.act(en, 'cord');
      en.wear = wear;
      En.act(en, 'pull', { lever: 0, fuel: 10 }, null, () => (i + 0.5) / 400);
      if (En.running(en)) caught++;
    }
    return caught / 400;
  };
  assert.ok(Math.abs(firstPull(0) - 0.45) < 0.01 && Math.abs(firstPull(1) - 0.25) < 0.01, `${firstPull(0)} vs ${firstPull(1)}`);
  for (let trial = 0; trial < 20; trial++) {
    const en = En.newEngine('skiff');
    En.act(en, 'cord');
    en.wear = 1;
    let pulls = 0;
    while (!En.running(en)) {
      En.act(en, 'pull', { lever: 0, fuel: 10 });
      assert.ok(++pulls <= 3);
    }
  }
  // The key: more turning over before she catches, cold.
  const crank = (wear) => {
    const en = En.newEngine('rib');
    en.wear = wear;
    En.act(en, 'battery'); En.act(en, 'cord'); En.act(en, 'key');
    En.act(en, 'start', { lever: 0, fuel: 10 }, null, () => 0);
    let t = 0;
    while (!En.running(en) && t < 10) { En.stepEngine(en, 0.05, { lever: 0, fuel: 10 }, () => 0); t += 0.05; }
    return t;
  };
  assert.ok(crank(1) > crank(0) + 0.7 && crank(1) < 5, `${crank(0).toFixed(2)} s, worn ${crank(1).toFixed(2)} s`);

  // On the water: the same boat, the same lever, a tenth down on push is slower; tune 1 is exactly
  // as she always was.
  const run = (tune) => {
    wakes.tracks.clear();
    const b = new Boat(scene, { kind: 'skiff' });
    if (tune != null) b.tune = tune;
    b.place(150, 330, Math.PI / 2);
    for (let i = 0, t = 0; i < 15 * 30; i++, t += 1 / 30) b.update(1 / 30, t, 1, 0, 0);
    return b;
  };
  const as = run(null), fresh = run(1), worn = run(0.9);
  assert.ok(as.pos.distanceTo(fresh.pos) < 1e-9, 'serviced: exactly as before');
  assert.ok(worn.forwardSpeed < fresh.forwardSpeed * 0.99 && worn.forwardSpeed > fresh.forwardSpeed * 0.85, `${fresh.forwardSpeed.toFixed(2)} vs ${worn.forwardSpeed.toFixed(2)} m/s`);
});

test('the fit-outs on her: a bench, a ladder over the stern into the water, a dodger you see over', () => {
  for (const id of ['seating', 'ladder', 'dodger']) {
    for (const k of Object.keys(FITS[id].price)) {
      const b = new Boat(scene, { kind: k });
      b.setFits([id]);
      const meshes = [];
      b.fitGroup.traverse((o) => o.isMesh && meshes.push(o));
      assert.ok(meshes.length >= 1, `${id} on the ${k}`);
      const box = new THREE.Box3();
      for (const m of meshes) box.expandByObject(m);
      assert.ok(Number.isFinite(box.min.y) && box.max.y - box.min.y > 0.05, `${id} on the ${k}: something to see`);
      // (Inside her beam: nothing sticking out over the side.)
      assert.ok(Math.max(Math.abs(box.min.x), Math.abs(box.max.x)) < HULLS[k].B + 0.05, `${id} on the ${k}: within her beam`);
      if (id === 'ladder') assert.ok(box.min.y < HULLS[k].keel(0.02), `the ladder on the ${k} reaches into the water`);
      if (id === 'dodger') {
        const win = meshes.find((m) => m.name === 'dodger window');
        assert.ok(win && win.material.transparent && win.material.opacity < 0.5, `the ${k}'s dodger has a clear window`);
        // Standing at a console, you see over it.
        const helm = HULLS[k].standing?.helm;
        if (helm) assert.ok(box.max.y < (HULLS[k].floorY ?? 0.1) + 1.45, `the ${k}'s dodger is below a standing eye`);
      }
      let freed = 0;
      for (const m of meshes) {
        m.geometry.addEventListener('dispose', () => freed++);
        m.material.addEventListener('dispose', () => freed++);
      }
      const g = b.fitGroup;
      b.setFits([]);
      assert.ok(g.parent === null && freed === meshes.length * 2, `${id} on the ${k}: taken off, and its geometry and materials freed`);
    }
  }
});
