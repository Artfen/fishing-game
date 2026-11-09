// How the harbour's people move, and Willowhaven's passers-by (world/folk.js, world/passersby.js),
// and your own figure's arms and its step aboard (walker.js). Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const F = await import('../src/townsfolk.js');
const { buildCoast } = await import('../src/world/coast.js');
const { seeded } = await import('../src/util.js');
const { Figure, FolkView, chatPairs } = await import('../src/world/folk.js');
const PB = await import('../src/world/passersby.js');
const { Walker, reach, UPPER, FORE } = await import('../src/walker.js');

const coast = buildCoast(new THREE.Scene(), seeded(20261024));
const paths = new F.Paths(coast.obstacles);
const FAIR = { rain: 0, storm: 0, wind: 4, season: 'summer' };
const WET = { rain: 0.8, storm: 0.1, wind: 8, season: 'summer' };
const HOME = { x: 10, z: -95 };

// A figure walked along a straight line at speed (m/s) for secs, from x0.
function walkFigure(fig, speed, secs, { act = 'walk', x0 = 0, dt = 1 / 30 } = {}) {
  const out = [];
  for (let i = 0, x = x0; i * dt < secs; i++, x += speed * dt) {
    fig.update(dt, i * dt, { act, pos: { x, z: 0 }, yaw: Math.PI / 2 }, 0);
    out.push({ phase: fig.phase, y: fig.group.position.y, hip: fig.legs[0].hip.rotation.x, x });
  }
  return out;
}

test('a townsperson walks at their own pace: a stride every metre and a half or so, rising over each step, legs still when they stop', () => {
  const fig = new Figure('mags');
  const slow = walkFigure(fig, 0.8, 4), quick = walkFigure(new Figure('mags'), 1.6, 4);
  // (The stride follows the ground covered, not the clock: twice as fast, twice the strides.)
  const strides = (r) => (r.at(-1).phase - r[30].phase) / (Math.PI * 2) / (r.at(-1).x - r[30].x);
  assert.ok(Math.abs(strides(slow) - 1 / 1.4) < 0.08 && Math.abs(strides(quick) - 1 / 1.4) < 0.08, `${strides(slow)} ${strides(quick)} strides a metre`);
  // Up and down over each step.
  const ys = quick.slice(40).map((r) => r.y);
  assert.ok(Math.max(...ys) - Math.min(...ys) > 0.02, 'bobs as they walk');
  // Stopped: the legs come back under them.
  const stop = walkFigure(fig, 0, 2, { act: 'stand', x0: slow.at(-1).x });
  assert.ok(Math.abs(stop.at(-1).hip) < 0.05, `${stop.at(-1).hip}`);
  // (The clock skipping on, a long jump: no stride for it.)
  const before = fig.phase;
  fig.update(1 / 30, 9, { act: 'walk', pos: { x: 200, z: 0 }, yaw: 0 }, 0);
  assert.ok(fig.phase - before < 0.5);
});

test('stood about, they turn to you when you come close, look your way, and wave the first time in a while', () => {
  const fig = new Figure('bert');
  const at = { act: 'stand', pos: { x: 0, z: 0 }, yaw: 0 };
  let t = 0;
  const step = (from, secs) => {
    for (let i = 0; i < secs * 30; i++, t += 1 / 30) fig.update(1 / 30, t, at, 0, { from });
  };
  step({ x: 20, z: 0 }, 2);
  assert.ok(Math.abs(fig.yaw) < 0.05, 'facing their own way');
  // You walk up beside them (to their left, along +x).
  step({ x: 4, z: 0 }, 0.2);
  assert.ok(fig.waveT > 0, 'a wave as you come within a few metres');
  step({ x: 2, z: 0 }, 3);
  assert.ok(Math.abs(fig.yaw - Math.PI / 2) < 0.2, `turned to you: ${fig.yaw}`);
  // Off and back soon: no second wave; a good while later, another.
  step({ x: 20, z: 0 }, 5);
  step({ x: 3, z: 0 }, 0.2);
  assert.equal(fig.waveT, 0);
  step({ x: 20, z: 0 }, 80);
  step({ x: 3, z: 0 }, 0.2);
  assert.ok(fig.waveT > 0);
});

test('two people stood together talk, facing each other, turn and turn about', () => {
  const people = [
    { id: 'ruth', act: 'stand', pos: { x: 0, z: 0 } },
    { id: 'wenna', act: 'stand', pos: { x: 1.5, z: 0 } },
    { id: 'kit', act: 'walk', pos: { x: 0.5, z: 0.5 } },
    { id: 'ian', act: 'stand', pos: { x: 30, z: 0 } },
  ];
  const c = chatPairs(people, 0);
  assert.ok(c.get('ruth') && c.get('wenna') && !c.get('kit') && !c.get('ian'));
  assert.ok(Math.abs(c.get('ruth').yaw - Math.PI / 2) < 1e-6 && Math.abs(c.get('wenna').yaw + Math.PI / 2) < 1e-6);
  assert.notEqual(c.get('ruth').talking, c.get('wenna').talking);
  const later = chatPairs(people, 4.3);
  assert.notEqual(later.get('ruth').talking, c.get('ruth').talking, 'the other’s turn');
});

test('their work is their own, with what it needs in their hands; walking to it they carry what it takes', () => {
  const show = (id, p) => {
    const fig = new Figure(id);
    for (let i = 0; i < 20; i++) fig.update(1 / 30, i / 30, { pos: { x: 0, z: 0 }, yaw: 0, ...p }, 0);
    return Object.entries(fig.props || {}).filter(([, g]) => g.visible).map(([n]) => n).sort().join(',') + (fig.rod.visible ? ',rod' : '');
  };
  assert.equal(show('ruth', { act: 'work', block: { spot: 'innFront' } }), 'broom');
  assert.equal(show('mags', { act: 'work', block: { spot: 'slab' } }), 'knife');
  assert.equal(show('dougie', { act: 'work', block: { spot: 'pots' } }), 'needle');
  assert.equal(show('hettie', { act: 'walk', block: { spot: 'quayEnd', act: 'fish' } }), 'bucket,rod');
  assert.equal(show('mags', { act: 'walk', block: { spot: 'slab', act: 'work' } }), 'box');
  assert.equal(show('bert', { act: 'stand', block: { spot: 'chair' } }), '');
  // Dougie crouches over his pots.
  const d = new Figure('dougie');
  for (let i = 0; i < 90; i++) d.update(1 / 30, i / 30, { act: 'work', pos: { x: 0, z: 0 }, yaw: 0, block: { spot: 'pots' } }, 0);
  assert.ok(d.group.position.y < -0.2 && d.legs[0].knee.rotation.x > 1.5);
});

test('the townsfolk view passes you to them: they look up as you pass', () => {
  const view = new FolkView(new THREE.Scene());
  const town = new F.Townsfolk({ obstacles: coast.obstacles });
  town.update(5 * 24 + 9, { storm: 0, rain: 0, wind: 5, about: [], activity: {} });
  const m = town.people.mags;
  let noticed = 0;
  for (let i = 0; i < 90; i++) {
    view.update(1 / 30, i / 30, town, { from: { x: m.pos.x + 3, z: m.pos.z } });
    noticed = Math.max(noticed, view.figures.mags.lookK, view.figures.mags.waveT > 0 ? 1 : 0);
  }
  assert.ok(noticed > 0.5);
});

// The passers-by over a stretch of the day (game hours from h0 to h1, a frame a real second with
// the game's clock at 40 s an hour), from where you stand.
function passAt(day, h0, h1, ctx = FAIR, from = HOME) {
  const P = new PB.Passersby(new THREE.Scene(), paths);
  const log = [];
  for (let h = h0; h < h1; h += 1 / 40) {
    P.update(1, h * 40, { day, hour: h, ...ctx, from, home: true });
    log.push({ h, out: P.count, people: P.people.map((p) => ({ id: p.id, out: p.out, act: p.act, x: p.pos.x, z: p.pos.z, shown: p.fig.group.visible })), dog: { ...P.dog.pos, shown: P.dog.group.visible } });
  }
  return { P, log };
}
const summerDay = () => {
  let d = 1;
  while (!(PB.outToday(PB.PASSERS[0], d, 'summer') && PB.outToday(PB.PASSERS[1], d, 'summer') && PB.outToday(PB.PASSERS[3], d, 'summer'))) d++;
  return d;
};

test('Willowhaven’s passers-by: out of a fine day, in at night and in the rain', () => {
  const d = summerDay();
  const day = passAt(d, 13, 15);
  assert.ok(Math.max(...day.log.map((l) => l.out)) >= 3, `${Math.max(...day.log.map((l) => l.out))} out on a fine afternoon`);
  const night = passAt(d, 22, 23);
  assert.equal(Math.max(...night.log.map((l) => l.out)), 0, 'nobody about at night');
  const wet = passAt(d, 13, 14, WET);
  assert.equal(Math.max(...wet.log.map((l) => l.out)), 0, 'in out of the rain');
  // The same people out on the same day, whoever asks.
  assert.equal(PB.outToday(PB.PASSERS[1], d, 'summer'), PB.outToday(PB.PASSERS[1], d, 'summer'));
  // Fewer in winter.
  let summer = 0, winter = 0;
  for (let k = 1; k <= 60; k++) for (const P of PB.PASSERS.filter((q) => q.hours)) {
    summer += PB.outToday(P, k, 'summer');
    winter += PB.outToday(P, k, 'winter');
  }
  assert.ok(winter < summer * 0.75, `${winter} vs ${summer}`);
});

test('they keep to where people can walk, stop at places worth stopping at, the dog at heel, and go in at their door at the end of it', () => {
  const d = summerDay();
  const { P, log } = passAt(d, 7.4, 21);
  let off = 0, dogFar = 0, stood = 0;
  for (const l of log) {
    for (const p of l.people) {
      if (!p.out || p.act === 'inside') continue;
      // (Off the walkable ground by more than one of the paths' half-metre cells, where a path
      // pulled straight clips a corner; a doorstep is where they go in.)
      const home = F.SPOTS[PB.PASSERS.find((q) => q.id === p.id).home], n = paths.snap(p.x, p.z);
      if (Math.hypot(n.x - p.x, n.z - p.z) > 0.6 && Math.hypot(p.x - home.x, p.z - home.z) > 2.5) off++;
      if (p.act === 'stand') stood++;
    }
    const owner = l.people.find((p) => p.id === 'dogwalker');
    if (owner.out && Math.hypot(l.dog.x - owner.x, l.dog.z - owner.z) > 8.5) dogFar++;
  }
  assert.equal(off, 0, 'never off the paths');
  assert.ok(stood > 50, 'they stop a while');
  assert.equal(dogFar, 0, 'the dog keeps near');
  // Evening: all home.
  assert.equal(log.at(-1).out, 0);
  assert.ok(P.people.every((p) => !p.out && p.act === 'inside'));
});

test('they step round you rather than through you (and squeeze past if you won’t budge where there’s no room)', () => {
  const d = summerDay();
  const P = new PB.Passersby(new THREE.Scene(), paths);
  // Each time the walker sets off somewhere, you stand in the way, partway along it; the closest
  // they come on each leg.
  const legs = [];
  let from = HOME, leg = -1, closest = 9, room = false;
  for (let h = 8, i = 0; h < 18.5; h += 1 / 40, i++) {
    const w = P.people[0];
    if (w.out && w.act === 'walk' && w.leg !== leg && w.len > 6) {
      if (leg >= 0) legs.push({ closest, room });
      leg = w.leg;
      closest = 9;
      from = F.along(w.path, w.len * 0.5);
      // (Room to step round you there: walkable ground a stride to one side or the other.)
      const rx = Math.cos(from.yaw), rz = -Math.sin(from.yaw);
      room = [1, -1].some((sd) => [0.4, 0.7, 1.0].every((k) => paths.ok(from.x + rx * sd * k, from.z + rz * sd * k)));
    }
    P.update(1, h * 40, { day: d, hour: h, ...FAIR, from, home: true });
    if (w.out && w.act === 'walk' && w.leg === leg) closest = Math.min(closest, Math.hypot(w.pos.x - from.x, w.pos.z - from.z));
  }
  const roomy = legs.filter((l) => l.room);
  assert.ok(roomy.length >= 3, `${roomy.length} legs with room`);
  // Where there's room, they go round you; where there isn't, they wait, then squeeze by.
  assert.ok(roomy.every((l) => l.closest > 0.55), `closest on each leg: ${legs.map((l) => `${l.closest.toFixed(2)}${l.room ? '' : ' (no room)'}`).join(', ')}`);
});

test('your arms bend at the elbow: the bones keep their length, and a hand too far off is held at arm’s reach', () => {
  const S = new THREE.Vector3(0.22, 1.36, 0), E = new THREE.Vector3();
  for (const T of [new THREE.Vector3(0.27, 0.85, 0.1), new THREE.Vector3(0.1, 1.2, 0.4), new THREE.Vector3(0.0, 1.5, 0.35)]) {
    reach(S, T, new THREE.Vector3(1, -0.7, -0.3), E);
    assert.ok(Math.abs(S.distanceTo(E) - UPPER) < 1e-6 && Math.abs(E.distanceTo(T) - FORE) < 1e-6);
    // (Bent out to the side, the way an elbow goes.)
    assert.ok(E.x > Math.min(S.x, T.x) - 1e-6);
  }
  const far = new THREE.Vector3(2, 1.36, 0);
  reach(S, far, new THREE.Vector3(1, -0.7, -0.3), E);
  assert.ok(Math.abs(S.distanceTo(far) - (UPPER + FORE - 0.005)) < 1e-6);
});

test('stepping aboard: up and over her side to the deck in a moment, the keys doing nothing on the way', () => {
  const w = new Walker(new THREE.Scene());
  w.place(10, -95, 0);
  const start = w.pos.clone(), deck = new THREE.Vector3(11, start.y + 0.6, -94);
  let done = 0, top = -9;
  w.stepTo(() => deck, { dur: 0.8, lift: 0.3 }, () => done++);
  for (let i = 0; i < 60 && w.stepping; i++) {
    w.update(1 / 30, i / 30, { x: 1, z: 0 });
    top = Math.max(top, w.pos.y);
  }
  assert.equal(done, 1);
  assert.ok(w.pos.distanceTo(deck) < 1e-6, 'there, not where the keys pushed');
  assert.ok(top > deck.y + 0.1, 'up and over her side');
  assert.ok(!w.stepping);
});
