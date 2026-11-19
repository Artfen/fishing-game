// Walking aboard the trawler (L3 of docs/LIVEABOARD.md): her deck plan (src/deckplan.js), its floors,
// walls, doors and furniture; you on it (boat.js walkDeck, placeOnDeck), fishing only from her decks,
// and a friend crewing her walking the same plan (crew.js).
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };
globalThis.innerHeight ??= 800;

const D = await import('../src/deckplan.js');
const { Boat, HULLS } = await import('../src/boat.js');
const { Crew } = await import('../src/crew.js');

const H = HULLS.trawler, plan = D.trawlerPlan(H), P = plan.places, C = D.CLEAR;
// Where her walls are, and how close you stand to them: the house's sides outside (the side decks'
// inner edge), the pilothouse's inside, the aft deck's forward end; the cabins below.
const OUT = P.house + 0.035 + C / 2, PIN = P.pilotW - 0.035 - C, AFT_END = P.saloonAft - 0.035 - C, ROOMS = D.belowRooms(P);
const spot = (id) => plan.spots.find((s) => s.id === id);
const at = (x, z) => ({ x, z, floor: D.floorAt(plan, x, z)?.id });
// Walk from where you are by (dx, dz) in steps of a frame's walking (1.3 m/s at 30 fps).
const walk = (p, dx, dz) => {
  const n = Math.ceil(Math.hypot(dx, dz) / 0.043);
  for (let i = 0; i < n; i++) p = D.step(plan, p, dx / n, dz / n);
  return p;
};

test('a convex shape either way round, and its edges', () => {
  const sq = [[0, 0], [1, 0], [1, 1], [0, 1]];
  assert.ok(D.inPoly(sq, 0.5, 0.5) && D.inPoly([...sq].reverse(), 0.5, 0.5));
  assert.ok(!D.inPoly(sq, 1.2, 0.5) && !D.inPoly(sq, 0.5, -0.01));
});

test('every place aboard her is reachable from her wheel, and back: the aft deck, the platform, the saloon door, the bow', () => {
  const helm = { x: P.helm[0], z: P.helm[1] };
  assert.equal(D.floorAt(plan, helm.x, helm.z).id, 'pilot', 'her wheel is in the pilothouse');
  for (const s of plan.spots) {
    assert.ok(D.reachable(plan, helm, s), `${s.id} from the wheel`);
    assert.ok(D.reachable(plan, s, helm), `the wheel from ${s.id}`);
  }
  assert.ok(D.reachable(plan, helm, { x: 0, z: P.bowEnd - 0.1 }), 'the bow');
  // Each spot stands on its floor.
  for (const s of plan.spots) if (s.floor) assert.equal(D.floorAt(plan, s.x, s.z, s.floor)?.id, s.floor, s.id);
});

test('her walls hold: not through the pilothouse\'s side, the saloon, her bulwarks or her furniture, however long the step', () => {
  // On the port side deck, beside the pilothouse but not at its door: inward, the wall stops you.
  const side = at(OUT + 0.1, 0.0);
  assert.equal(side.floor, 'port');
  for (const dx of [-0.3, -3, -10]) {
    const r = D.step(plan, side, dx, 0);
    assert.ok(r.x >= OUT - 1e-9 && r.floor === 'port', `a step of ${dx} m: at ${r.x.toFixed(2)}`);
  }
  // Nor through the saloon's after end from the aft deck, beside its door: forward, you stop at it.
  const aft = at(-0.6, -5.4);
  assert.equal(aft.floor, 'aft');
  const fwd = D.step(plan, aft, 0, 6);
  assert.ok(fwd.z <= AFT_END + 1e-9, `stopped at ${fwd.z.toFixed(2)}`);
  // Nor over her side: from the side deck, outward, you stop inside her bulwarks.
  const out = D.step(plan, side, 4, 0);
  assert.ok(out.x < H.B && out.x > OUT, `at ${out.x.toFixed(2)}`);
  // Nor into her console from her wheel; nor through the helm chair behind it.
  const helm = at(P.helm[0], P.helm[1]);
  assert.ok(D.step(plan, helm, 0, 2).z <= P.console[1] + 1e-9);
  assert.ok(D.step(plan, helm, 0, -2).z >= P.chair[3] - 1e-9);
  // Walking into a wall at an angle, you slide along it rather than stopping dead.
  const slid = D.step(plan, side, -1, 0.5);
  assert.ok(slid.z > side.z + 0.4 && slid.x >= OUT - 1e-9, 'along the house side');
});

test('up a step into the pilothouse, down through the gate to the platform: never more than a step at a time', () => {
  // The floors' heights: her aft deck is her floor; the pilothouse sole is up; the platform down.
  assert.ok(Math.abs(D.heightOf(D.floorAt(plan, 0, -5.4), 0, -5.4) - H.floorY) < 0.01);
  assert.equal(D.heightOf(D.floorAt(plan, ...P.helm), ...P.helm), H.standing.floor);
  const pl = spot('platform');
  assert.equal(D.heightOf(D.floorAt(plan, pl.x, pl.z), pl.x, pl.z), P.platformY);
  assert.ok(P.platformY > H.draft + 0.2 && P.platformY < H.floorY - 0.4, 'just clear of the water, below her deck');
  // From the wheel out the port door, aft along the side deck, across the aft deck and down through
  // the gate to the platform: each frame's step up or down a short one (stairs and sills, no jumps).
  let p = at(P.helm[0], P.helm[1]), worst = 0, y = D.heightOf(D.floorAt(plan, p.x, p.z), p.x, p.z);
  // (Out of the starboard door: the companionway down is to port of her wheel.)
  const route = [['z', (P.door[0] + P.door[1]) / 2], ['x', -(OUT + 0.1)], ['z', AFT_END - 0.15], ['x', 1.0], ['z', P.platform[1] - 0.5]];
  for (const [ax, v] of route) {
    const dx = ax === 'x' ? v - p.x : 0, dz = ax === 'z' ? v - p.z : 0, n = Math.ceil(Math.hypot(dx, dz) / 0.043);
    for (let i = 0; i < n; i++) {
      p = D.step(plan, p, dx / n, dz / n);
      worst = Math.max(worst, Math.abs(p.y - y));
      y = p.y;
    }
    assert.ok(Math.abs((ax === 'x' ? p.x : p.z) - v) < 1e-6, `${ax} to ${v.toFixed(2)}: at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} on ${p.floor}`);
  }
  assert.equal(p.floor, 'platform', `ended on ${p.floor} at ${p.x.toFixed(2)}, ${p.z.toFixed(2)}`);
  assert.ok(worst < 0.15, `the biggest step ${worst.toFixed(2)} m`);
  // And a fall from the aft deck to the platform isn't a step: not over the bench, only through the gate.
  const bench = D.step(plan, at(0, P.benchFront + 0.3), 0, -3);
  assert.equal(bench.floor, 'aft');
});

test('the nearest place to stand, from a rail or a save: always on a floor, never in a wall', () => {
  for (const [x, z] of [[0, 0], [2.5, -6], [0, 9], [-1.6, 1.0], [0, -6.6]]) {
    const r = D.nearestOn(plan, x, z);
    assert.ok(D.floorAt(plan, r.x, r.z), `${x}, ${z}`);
    assert.equal(r.y, D.heightOf(D.floorAt(plan, r.x, r.z, r.floor), r.x, r.z));
  }
});

const scene = new THREE.Scene();
const trawler = () => {
  const b = new Boat(scene, { kind: 'trawler' });
  b.place(0, 2300, 0);
  b.update(1 / 30, 0, 0, 0, 0);
  return b;
};
// Walk her along legs (across, ahead: her own, + to port) at walking pace, a frame at a time.
const walkBoat = (b, dx, dz) => {
  const n = Math.ceil(Math.hypot(dx, dz) / 0.043);
  for (let i = 0; i < n; i++) {
    b.walkDeck(dx / n, dz / n, 1 / 30);
    b.placeOnDeck(0, 1 / 30);
  }
};

test('aboard her: from the wheel to the aft deck on foot, at each floor\'s height, and fishing only out on deck', () => {
  const b = trawler();
  assert.ok(b.plan && b.hull.standing, 'she has a plan to walk');
  // At her wheel she isn't fished from.
  assert.match(b.fishBlock(), /wheel/);
  // Off the helm, you stand on the pilothouse sole; still inside: not from here either.
  assert.ok(b.setDeck(true));
  b.placeOnDeck(0, 1 / 30);
  assert.equal(b.deck.floor, 'pilot');
  assert.ok(b.indoors && b.atHelm);
  assert.match(b.fishBlock(), /inside/);
  const hip = b.seatY - H.standing.floor;
  assert.ok(Math.abs(b.standAt.y - (H.standing.floor + hip)) < 1e-6);
  // Out of the starboard door, aft down the side deck, onto the aft deck.
  walkBoat(b, 0, (P.door[0] + P.door[1]) / 2 - b.deck.z);
  walkBoat(b, -(OUT + 0.1) - b.deck.x, 0);
  assert.equal(b.deck.floor, 'stbd', 'out on the side deck');
  assert.ok(!b.indoors && !b.atHelm);
  walkBoat(b, 0, AFT_END - 0.15 - b.deck.z);
  walkBoat(b, -b.deck.x, 0);
  walkBoat(b, 0, -5.3 - b.deck.z);
  assert.ok(/^aft/.test(b.deck.floor) && Math.abs(b.deck.z + 5.3) < 1e-6, `on ${b.deck.floor} at ${b.deck.z.toFixed(2)}`);
  assert.equal(b.deckSpot?.id, 'fish');
  assert.equal(b.fishBlock(), null, 'fished from her aft deck');
  // Standing on the aft deck, a step down from the sole.
  assert.ok(Math.abs(b.standAt.y - (H.floorY + hip)) < 0.03, `${b.standAt.y.toFixed(2)}`);
  // The camera's on you, not her middle.
  const w = b.deckWorld(new THREE.Vector3());
  assert.ok(Math.abs(w.z - (b.pos.z - 5.3)) < 0.2, 'aft, where you are');
  // Back at the helm, the deck's done with and her roof is back on.
  b.showRoof(false);
  b.setDeck(false);
  assert.equal(b.deck, null);
  assert.ok(b.roof.visible);
});

test('her pilothouse roof is a mesh of its own, lifted off while you\'re inside it', () => {
  const b = trawler();
  assert.ok(b.roof?.isMesh && b.roof.visible);
  b.showRoof(false);
  assert.equal(b.roof.visible, false);
  b.showRoof(true);
  assert.ok(b.roof.visible);
});

test('a friend crewing her walks the same plan: out of the house by its door, never through its walls', () => {
  const c = new Crew({ together: null });
  c.on = { id: 'trawler', x: 1.0, z: 0 };
  // Straight to port, aft of the doors: the pilothouse side stops them.
  for (let i = 0; i < 90; i++) c.walk(1, 0, H, 1 / 30, plan);
  assert.ok(c.on.x <= PIN + 1e-9, `at ${c.on.x.toFixed(2)}`);
  // Along to the door, then out through it.
  for (let i = 0; i < 90 && c.on.z < P.door[0] + 0.2; i++) c.walk(0, 1, H, 1 / 30, plan);
  for (let i = 0; i < 60; i++) c.walk(1, 0, H, 1 / 30, plan);
  assert.equal(c.on.floor, 'port');
  // (A friend's plan floor gives their height to those who see them: visitors.js crewAt.)
  assert.ok(Math.abs(D.heightOf(D.floorAt(plan, c.on.x, c.on.z), c.on.x, c.on.z) - c.on.y) < 1e-9);
});

// Inside her (L4): the saloon, the steps up, the companionway down, the cabins below.
const route = (p, legs) => {
  let worst = 0, y = p.y ?? D.heightOf(D.floorAt(plan, p.x, p.z, p.floor), p.x, p.z);
  for (const [ax, v] of legs) {
    const dx = ax === 'x' ? v - p.x : 0, dz = ax === 'z' ? v - p.z : 0, n = Math.ceil(Math.hypot(dx, dz) / 0.043);
    for (let i = 0; i < n; i++) {
      p = D.step(plan, p, dx / n, dz / n);
      worst = Math.max(worst, Math.abs(p.y - y));
      y = p.y;
    }
    assert.ok(Math.abs((ax === 'x' ? p.x : p.z) - v) < 1e-6, `${ax} to ${v.toFixed(2)}: at ${p.x.toFixed(2)}, ${p.z.toFixed(2)} on ${p.floor}`);
  }
  return { ...p, worst };
};

test('inside her: through the sliding door into the saloon, up the steps to her wheel, down the companionway to the cabins', () => {
  // From the aft deck, through the doorway (to port of the middle) into the saloon.
  const door = (P.slide[0] + P.slide[1]) / 2;
  let p = route(at(door, -5.2), [['z', -3.0]]);
  assert.equal(p.floor, 'saloon');
  assert.ok(D.floorAt(plan, p.x, p.z, p.floor).inside, 'indoors');
  // Forward along the saloon, up the steps into the pilothouse.
  p = route(p, [['x', 0], ['z', 1.0]]);
  assert.equal(p.floor, 'pilot');
  assert.equal(p.y, H.standing.floor);
  // Round to port of the companionway and down it, to the lobby below.
  p = route(p, [['z', 2.0], ['x', 1.2], ['z', 0.0], ['x', 0.65], ['z', 2.0]]);
  assert.equal(p.floor, 'lobby');
  assert.equal(p.y, P.low);
  assert.ok(D.floorAt(plan, p.x, p.z, p.floor).below, 'below');
  assert.ok(p.worst < 0.15, `no step bigger than ${p.worst.toFixed(2)} m on the way`);
  // Into the owner's cabin forward, and its berth.
  p = route(p, [['x', 0], ['z', 3.3]]);
  assert.equal(p.floor, 'owner');
  assert.equal(D.spotAt(plan, p.x, p.z, p.floor)?.id, 'berth');
});

test('floors one over another are kept apart: the cabins under the pilothouse are found from below, the sole from above', () => {
  // Under the pilothouse's chart table: the lobby at the foot of the companionway.
  assert.equal(D.floorAt(plan, 0.65, 2.0, null, H.standing.floor).id, 'pilot');
  assert.equal(D.floorAt(plan, 0.65, 2.0, null, P.low).id, 'lobby');
  // Walking about the lobby never comes up through the sole; walking the pilothouse never falls
  // through to the cabins.
  let below = { x: 1.2, z: 1.6, floor: 'lobby' }, above = { x: 1.2, z: 1.6, floor: 'pilot' };
  for (let i = 0; i < 40; i++) {
    below = D.step(plan, below, 0, 0.03);
    above = D.step(plan, above, 0, 0.03);
  }
  assert.equal(below.y, P.low);
  assert.equal(above.y, H.standing.floor);
  // The nearest place to stand, asked at a height: the floor at that height.
  assert.equal(D.nearestOn(plan, 0.65, 2.0, P.low).floor, 'lobby');
  assert.equal(D.nearestOn(plan, 0.65, 2.0, H.standing.floor).floor, 'pilot');
});

test('the cabins are rooms: their bulkheads hold, and you go in and out by their doors', () => {
  // From the lobby toward the guest cabin, aft of its door: the bulkhead stops you.
  const lobby = { x: 0.5, z: 1.6, floor: 'lobby' };
  const r = D.step(plan, lobby, -2, 0);
  assert.ok(r.x >= ROOMS.lobby[0] - 1e-9 && r.floor === 'lobby', `at ${r.x.toFixed(2)} on ${r.floor}`);
  // At the door, in.
  const at = route({ x: 0.5, z: 1.95, floor: 'lobby' }, [['x', -0.7]]);
  assert.equal(at.floor, 'guest');
  assert.equal(D.spotAt(plan, at.x, at.z, at.floor)?.id, 'bunks');
  // The heads, through its door off the lobby; and never into it from the stair beside it.
  const heads = route({ x: 1.2, z: 2.0, floor: 'lobby' }, [['z', 0.7]]);
  assert.equal(heads.floor, 'heads');
  const stair = { x: 0.8, z: 0.8, floor: 'stair' }, side = D.step(plan, stair, 0.5, 0);
  assert.equal(side.floor, 'stair');
  assert.ok(side.x <= P.stair[2] + 1e-9);
});

test('aboard her inside: below is below, her roofs lift in the pilothouse and saloon, and her lamp lights the room you\'re in', () => {
  const b = trawler();
  b.setDeck(true);
  b.deck.x = 0.65; b.deck.z = 2.0; b.deck.floor = 'lobby'; b.deck.y = P.low;
  b.placeOnDeck(0, 1 / 30);
  assert.ok(b.below && b.indoors);
  assert.ok(Math.abs(b.standAt.y - (P.low + b.seatY - H.standing.floor)) < 1e-6, 'standing on the cabin sole');
  assert.equal(b.fishBlock(), 'Not from inside: out on deck first.');
  b.setCabinLight(1, true);
  assert.ok(b.cabinLight.intensity > 0 && b.cabinLight.position.y < H.standing.floor, 'the lamp below');
  b.deck.x = 0; b.deck.z = -2.3; b.deck.floor = 'saloon';
  assert.ok(!b.below && b.indoors);
  b.setCabinLight(1, true);
  assert.ok(b.cabinLight.position.y > H.floorY + 1.5, 'the saloon lamp');
  // By day, from outside, her windows are dark; after dark they glow.
  b.setCabinLight(0, false);
  assert.equal(b.cabinGlass.material.emissiveIntensity, 0);
  b.setCabinLight(1, false);
  assert.ok(b.cabinGlass.material.emissiveIntensity > 0.5);
});

test('where you stand inside keeps clear of her walls: your eyes, a hand ahead of you, never come up against one', () => {
  const W = P.below, bb = (id) => {
    const xs = [], zs = [];
    for (const f of plan.floors.filter((g) => g.id === id)) for (const [x, z] of f.poly) xs.push(x), zs.push(z);
    return [Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)];
  };
  const near = C - 1e-9;
  // The saloon and the pilothouse, inside the house's walls (their inner faces).
  const S = bb('saloon'), Pi = bb('pilot');
  assert.ok(P.house - 0.035 - S[2] >= near && S[0] + P.house - 0.035 >= near, 'the saloon sides');
  assert.ok(S[1] - (P.saloonAft + 0.035) >= near && P.pilotAft - 0.035 - S[3] >= near, 'its ends');
  assert.ok(P.pilotW - 0.035 - Pi[2] >= near && P.pilotFront - 0.035 - Pi[3] >= near && Pi[1] - (P.pilotAft + 0.035) >= near, 'the pilothouse');
  // Each cabin, inside its bulkheads (doorways aside).
  const L = bb('lobby'), G = bb('guest'), Hd = bb('heads'), O = bb('owner');
  assert.ok(L[0] - W.guestIn >= near && W.port - L[2] >= near && L[1] - W.headsFront >= near && W.ownerAft - L[3] >= near, 'the lobby');
  assert.ok(W.guestIn - G[2] >= near && G[1] - W.aft >= near && W.ownerAft - G[3] >= near, 'the guest cabin');
  assert.ok(W.headsFront - Hd[3] >= near && Hd[1] - W.aft >= near, 'the heads');
  assert.ok(O[1] - W.ownerAft >= near, "the owner's cabin");
  // And the deckhead over you below is above your eyes.
  const b = trawler(), eye = b.seatY - H.standing.floor + 0.81;
  assert.ok(P.low + eye < H.standing.floor - 0.1, `eyes at ${(P.low + eye).toFixed(2)}, the deckhead at ${(H.standing.floor - 0.075).toFixed(2)}`);
});
