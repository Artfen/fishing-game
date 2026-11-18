// The Las Brasas archipelago (docs/ARCHIPELAGO.md): the islands round Brasa, each where it should
// be with its cove in its lee and cliffs to weather; the channel's sill and its current; the
// seamount; the stacks and the wreck's sand; the coves calm; the places found only there; and a
// chart explored before the islands laid out on the bigger one.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const ctx2d = new Proxy({}, { get: () => () => ({ addColorStop() {}, width: 10, data: [] }), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const T = await import('../src/world/terrain.js');
const B = await import('../src/world/brasa.js');
const C = await import('../src/world/conditions.js');
const { Explored } = await import('../src/map.js');
const X = await import('../src/crossing.js');

const { GAVIOTA, HONDA, ISLANDS, ESTRECHO, BANCO, ROQUETES, VAPOR, SALINAS } = B;
const highest = (I, dx, dz) => {
  let top = -99;
  for (let r = 0; r < 420; r += 3) top = Math.max(top, T.heightAt(I.x + dx * r, I.z + dz * r));
  return top;
};

test('the islands: land where they lie, low hills, higher to weather than in their lee, all inside the southern sea', () => {
  for (const I of ISLANDS) {
    assert.ok(T.heightAt(I.x, I.z) > 3, `${I.id} stands out of the sea`);
    const weather = Math.max(highest(I, 0, -1), highest(I, -0.7, -0.7)), lee = highest(I, 0.7, 0.7);
    assert.ok(weather < 60 && weather > lee, `${I.id}: ${weather.toFixed(0)} m to weather, ${lee.toFixed(0)} m in its lee`);
    const R = B.SOUTH_RECT, M = B.SOUTH_MAP;
    assert.ok(I.x - I.rx > M.x && I.x + I.rx < M.x + M.w && I.z - I.rz > M.z && I.z + I.rz < M.z + M.h, `${I.id} on the chart`);
    assert.ok(I.x + I.rx + 120 < R.x1 && I.z + I.rz + 120 < R.z1, `${I.id} inside the southern sea`);
    // Its own windward and lee: the weather side rough water (lava), the lee calm.
    assert.equal(T.zoneAt(I.x, I.z - I.rz - 60), 'lava', `${I.id}'s weather shore`);
  }
  for (const R of ROQUETES) assert.ok(T.heightAt(R.x, R.z) > 8, 'a stack');
  // Between the stacks, water a boat can pass through.
  for (let i = 0; i < ROQUETES.length - 1; i++) {
    const a = ROQUETES[i], b = ROQUETES[i + 1];
    assert.ok(T.heightAt((a.x + b.x) / 2, (a.z + b.z) / 2) < -2, 'a channel between the stacks');
  }
});

test('the coves: sand at four to nine metres, a pale beach, sheltered in the lee; somewhere to anchor and land', () => {
  const H = {};
  for (const I of ISLANDS) {
    const { x, z } = I.cove, depth = -T.heightAt(x, z);
    assert.ok(depth > 4 && depth < 9, `${I.id}'s cove ${depth.toFixed(1)} m`);
    assert.equal(T.zoneAt(x, z), 'lee');
    B.brasaHabitat(x, z, H);
    assert.ok(H.rock < 0.3, `sand, not rock (${H.rock.toFixed(2)})`);
    assert.ok(B.beachPale(x, z) > 0.7, 'white shell sand');
    const [shelter] = [...C.shelterAt(x, z)];
    const [weather] = [...C.shelterAt(I.x - I.rx * 0.2, I.z - I.rz - 80)];
    assert.ok(shelter < weather, `${I.id}: the cove ${shelter.toFixed(2)}, its weather side ${weather.toFixed(2)}`);
    // Its beach: the land just ashore low and sandy.
    let shore = null;
    for (let r = 0; r < 200; r += 2) {
      const px = x + ((I.x - x) * r) / Math.hypot(I.x - x, I.z - z), pz = z + ((I.z - z) * r) / Math.hypot(I.x - x, I.z - z);
      if (T.heightAt(px, pz) > 0.2) {
        shore = { x: px, z: pz };
        break;
      }
    }
    assert.ok(shore && B.onBeach(shore.x, shore.z) > 0.5 && T.heightAt(shore.x, shore.z) < 3, `${I.id}'s beach`);
    // Slack water there.
    const c = C.currentAt(x, z, 0, {});
    assert.ok(Math.hypot(c.x, c.z) < 0.03, 'slack in the cove');
  }
  // Las Salinas: flat and low behind Bahía Escondida, ashore.
  const s = T.heightAt(SALINAS.x, SALINAS.z);
  assert.ok(s > 0.4 && s < 2, `the salt pans ${s.toFixed(1)} m up`);
});

test('El Estrecho: a sill about thirty metres down between Brasa and Gaviota, the current squeezing through it', () => {
  const mid = { x: (ESTRECHO.x0 + ESTRECHO.x1) / 2, z: (ESTRECHO.z0 + ESTRECHO.z1) / 2 };
  const d = -T.heightAt(mid.x, mid.z);
  assert.ok(d > 22 && d < 38, `the sill ${d.toFixed(0)} m down`);
  const inside = C.currentAt(mid.x, mid.z, 0, {}), outside = C.currentAt(mid.x - 400, mid.z - 400, 0, {});
  assert.ok(Math.hypot(inside.x, inside.z) > Math.hypot(outside.x, outside.z) * 1.4, 'faster through the channel');
  assert.ok(inside.x < 0 && inside.z > 0, 'still south-west');
});

test('El Banco: a seamount up out of the deep to about twenty-four metres, a drop-off of its own far out', () => {
  const top = -T.heightAt(BANCO.x, BANCO.z), round = -T.heightAt(BANCO.x + BANCO.r * 1.3, BANCO.z);
  assert.ok(top > 15 && top < 32, `its top ${top.toFixed(0)} m`);
  assert.ok(round > top + 50, `the deep round it ${round.toFixed(0)} m`);
  assert.equal(T.zoneAt(BANCO.x, BANCO.z), 'veril');
  const H = B.brasaHabitat(BANCO.x, BANCO.z, {});
  assert.ok(H.rock > 0.5, 'rock on its top');
});

test('El Vapor lies on sand in the lee of Los Roquetes, a dive\'s depth down', () => {
  const d = -T.heightAt(VAPOR.x, VAPOR.z);
  assert.ok(d > 8 && d < 20, `${d.toFixed(0)} m`);
  assert.equal(T.zoneAt(VAPOR.x, VAPOR.z), 'lee');
});

test('the crossing still makes for Brasa: its open water deep, its end and its arrival Brasa\'s own coast', () => {
  for (let k = 0; k <= 1; k += 0.01) {
    const x = X.ENDS.home.x + (X.ENDS.south.x - X.ENDS.home.x) * k, z = X.ENDS.home.z + (X.ENDS.south.z - X.ENDS.home.z) * k;
    assert.ok(T.solidHeight(x, z) < -20, `deep at ${z.toFixed(0)}`);
  }
  // Off Gaviota, out to sea, you haven't arrived: Brasa's still ahead.
  assert.equal(X.arrived('south', GAVIOTA.x - 200, GAVIOTA.z - GAVIOTA.rz - 450), false);
  assert.ok(B.brasaSDF(GAVIOTA.x, GAVIOTA.z) < 0 && B.brasaIsleSDF(GAVIOTA.x, GAVIOTA.z) > 300);
});

test('the islands\' places: each found there, and only there', () => {
  const ids = ['gaviota', 'caleta', 'estrecho', 'banco', 'roquetes', 'vapor', 'honda', 'escondida', 'salinas'];
  for (const id of ids) {
    const p = T.PLACES.find((q) => q.id === id);
    assert.ok(p, id);
    const at = id === 'estrecho' ? { x: (ESTRECHO.x0 + ESTRECHO.x1) / 2, z: (ESTRECHO.z0 + ESTRECHO.z1) / 2 } : p;
    assert.ok(p.test(at.x, at.z), `${id} found at its place`);
    assert.ok(!p.test(B.PUERTO.x, B.PUERTO.z) && !p.test(0, -40), `${id} not at Puerto Brasa, nor at home`);
  }
});

test('a chart of the island explored before the archipelago is laid out on the bigger one, where it was', () => {
  const O = B.SOUTH_MAP.old, CELL = 20;
  const old = new Explored('', { x: O.x, z: O.z, w: O.w, h: O.h });
  old.reveal(B.PUERTO.x, B.PUERTO.z, 60);
  const now = new Explored(old.toString(), B.SOUTH_MAP);
  const cell = (E, sheet, x, z) => E.has(Math.floor((x - sheet.x) / CELL), Math.floor((z - sheet.z) / CELL));
  assert.ok(cell(now, B.SOUTH_MAP, B.PUERTO.x, B.PUERTO.z), 'the harbour still seen');
  assert.ok(!cell(now, B.SOUTH_MAP, GAVIOTA.x, GAVIOTA.z), 'Gaviota not yet');
  // A new one round trips as it is.
  now.reveal(GAVIOTA.x, GAVIOTA.z, 100);
  assert.equal(new Explored(now.toString(), B.SOUTH_MAP).toString(), now.toString());
});
