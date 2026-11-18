// (B6) Anchors (see anchoring.js): the rode's catenary, what an anchor holds by its angle and the
// bottom it's in, digging in and dragging; and the live boat on it. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

const THREE = await import('three');
const A = await import('../src/anchoring.js');
const { Boat } = await import('../src/boat.js');
const { solidHeight } = await import('../src/world/terrain.js');
const { conditions } = await import('../src/world/conditions.js');
const { rodeFor } = await import('../src/mooring.js');

const deg = (r) => (r * 180) / Math.PI;

test('the rode hangs as a catenary: lying along the bottom, then up to her bow; pulled hard, lifting at the anchor', () => {
  // An inextensible chain (w N/m), its touchdown level: with H, the length off the bottom is
  // √(h² + 2h·H/w) and her bow is L − Ls + (H/w)·asinh(w·Ls/H) from the anchor.
  const R = { w: 10, EA: 1e12 };
  for (const H of [20, 200, 600]) {
    const h = 5, L = 30, a = H / R.w, Ls = Math.sqrt(h * h + 2 * h * a), X = L - Ls + a * Math.asinh(Ls / a);
    const o = A.rodeShape(X, h, L, R);
    assert.ok(Math.abs(o.H - H) < H * 1e-4, `H ${o.H} for ${H}`);
    assert.ok(Math.abs(o.Ls - Ls) < 1e-3 && Math.abs(o.lying - (L - Ls)) < 1e-3);
    assert.equal(o.theta, 0, 'lying on the bottom, the pull on the anchor is level');
    assert.ok(Math.abs(o.V - R.w * o.Ls) < 1e-9, 'her bow carries the weight of what hangs');
  }
  // Pulled further than it reaches lying, it lifts off the anchor: the pull there is no longer
  // level, and the weight at her bow is what hangs plus what lifts the anchor.
  const R2 = A.rodeOf('chain', 1000), h = 5, L = 25;
  const lift = A.rodeShape(24.8, h, L, R2);
  assert.ok(lift.lying === 0 && lift.Va > 0 && lift.theta > 0, JSON.stringify(lift));
  assert.ok(Math.abs(lift.V - (lift.Va + R2.w * L)) < 1e-6);
  // Her pull grows the further off she is, and the rode stiffens as it comes straight.
  let H0 = -1, k0 = -1;
  for (const X of [21, 23, 24, 24.4, 24.8, 25.2]) {
    const o = A.rodeShape(X, h, L, R2);
    assert.ok(o.H > H0 && o.k >= k0, `X ${X}: H ${o.H.toFixed(1)} k ${o.k.toFixed(0)}`);
    H0 = o.H;
    k0 = o.k;
  }
  // Slack (closer than hanging straight down and lying along the bottom): no pull at all.
  assert.equal(A.rodeShape(10, h, L, R2).H, 0);
  // Drawn: along the bottom from the anchor, then rising to her bow.
  const o = A.rodeShape(22, h, L, R2), pts = A.rodePoints(o, R2, 16);
  assert.ok(pts[0][1] === 0 && pts[4][1] === 0, 'lying on the bottom by the anchor');
  assert.ok(Math.abs(pts[16][1] - h) < 1e-9 && Math.abs(pts[16][0] - 22) < 1e-9, 'up at her bow');
  for (let i = 1; i <= 16; i++) assert.ok(pts[i][1] >= pts[i - 1][1] - 1e-9, 'rising all the way');
});

test('what an anchor holds by its angle: Pat Piper’s scope table and the US Sailing study', () => {
  // A taut rope's angle at the anchor is asin(1/scope). Against 10:1, Piper: 3:1 53%, 5:1 77%, 7:1
  // 91%; US Sailing: 5:1 about 80%.
  const at = (s) => A.uplift(Math.asin(1 / s)) / A.uplift(Math.asin(1 / 10));
  assert.ok(Math.abs(at(3) - 0.53) < 0.03, `3:1 ${at(3).toFixed(3)}`);
  assert.ok(Math.abs(at(5) - 0.785) < 0.03, `5:1 ${at(5).toFixed(3)}`);
  assert.ok(Math.abs(at(7) - 0.91) < 0.03, `7:1 ${at(7).toFixed(3)}`);
  assert.equal(A.uplift(0), 1);
  assert.equal(A.uplift(A.UPLIFT_OUT + 0.01), 0, 'pulled up past 35°, it pulls out');
  // (The game's hold is what an anchor holds at the five to one a skipper pays out.)
  assert.ok(Math.abs(A.UPLIFT_REF - A.uplift(Math.asin(0.2))) < 1e-12);
});

test('what an anchor holds by the bottom, and digging in', () => {
  const sand = A.anchorBottom({ kind: 'sand', under: 'sand' }), mud = A.anchorBottom({ kind: 'mud', under: 'mud' });
  const gravel = A.anchorBottom({ kind: 'gravel', under: 'gravel' });
  // Over many spots: rock hooks about ROCK_HOOKS of the time, the anchor gets through weed about
  // WEED_THROUGH of it; the same spot the same every time.
  let hooked = 0, through = 0, n = 2000, weedOnly = null, skid = null, hook = null, thru = null;
  for (let i = 0; i < n; i++) {
    const r = A.anchorBottom({ kind: 'rock', under: 'rock' }, i * 3, 41), w = A.anchorBottom({ kind: 'weed', under: 'sand' }, i * 3, 41);
    assert.deepEqual(r, A.anchorBottom({ kind: 'rock', under: 'rock' }, i * 3, 41));
    if (r.hooked) { hooked++; hook = r; } else skid = r;
    if (w.through) { through++; thru = w; } else weedOnly = w;
  }
  assert.ok(Math.abs(hooked / n - A.ROCK_HOOKS) < 0.04, `hooked ${hooked / n}`);
  assert.ok(Math.abs(through / n - A.WEED_THROUGH) < 0.04, `through ${through / n}`);
  // Sand best; then mud, gravel, weed, rock it skids over. Hooked on rock, harder than sand;
  // through the weed, nearly what's under it.
  assert.ok(sand.hold > mud.hold && mud.hold > gravel.hold && gravel.hold > weedOnly.hold && weedOnly.hold > skid.hold);
  assert.ok(hook.hold > sand.hold);
  assert.ok(thru.hold > 0.8 * sand.hold && thru.hold < sand.hold);
  // Unknown or no bottom: sand.
  assert.equal(A.anchorBottom(null).kind, 'sand');
  // Digging in: BITE just dropped; dragged its setting distance, 63% of the way to holding fully;
  // sand in about a metre, mud takes a few.
  assert.ok(Math.abs(A.setBy(0, 1) - A.BITE) < 1e-12);
  assert.ok(Math.abs(A.setBy(sand.set, sand.set) - (1 - (1 - A.BITE) / Math.E)) < 1e-12);
  assert.ok(A.setBy(1.5, sand.set) > 0.85 && A.setBy(1.5, mud.set) < 0.6);
});

// The live boat: anchored in open water, under a steady blow from ahead.
const scene = new THREE.Scene();
let clock = 0;
conditions.swellAmps.fill(0.05);
// (Somewhere lo to hi m deep, and about as deep for 60 m to the south, where she'll lie.)
function spotAt(lo, hi) {
  for (let x = -300; x < 400; x += 4) for (let z = 200; z < 1200; z += 4) {
    const d = -solidHeight(x, z);
    if (d > lo && d < hi && [[0, -15], [0, -30], [0, -45], [0, -60], [8, -40], [-8, -40]].every(([a, c]) => Math.abs(-solidHeight(x + a, z + c) - d) < 2.5)) return { x, z, d };
  }
  return null;
}
// Anchored at `at` (the bottom as given), she lying to the south of it about as far as her rode
// reaches (so it soon takes her weight), and blown back on it for secs at push (m/s²): how far the
// anchor went once on the bottom, and its state.
function blow(kind, at, push, secs, { bottom = null, rode = 'rope', hold = 1 } = {}) {
  const was = Boat.bottomAt;
  Boat.bottomAt = bottom ? () => bottom : null;
  const b = new Boat(scene, { kind });
  b.anchorRode = rode;
  b.anchorHold = hold;
  const h = -solidHeight(at.x, at.z), L = rodeFor(h), far = 0.92 * Math.sqrt(L * L - h * h);
  b.place(at.x, at.z - far - b.hull.L * 0.45, 0);
  b.update(1 / 30, clock, 0, 0, 0);
  b.setAnchor(true, { at });
  Boat.bottomAt = was;
  const events = [];
  b.onAnchor = (w) => events.push(w);
  const step = (s, p) => {
    for (let i = 0; i < s * 30; i++) {
      clock += 1 / 30;
      b.vel.z -= p * (1 / 30);
      b.update(1 / 30, clock, 0, 0, 0);
    }
  };
  step(8, 0);
  const x0 = b.anchor.x, z0 = b.anchor.z;
  step(secs, push);
  const An = b.anchor;
  return { moved: Math.hypot(An.x - x0, An.z - z0), set: An.set, hold: An.hold, theta: An.rope.out.theta, events, b };
}

test('live: under the same blow, an anchor dug into sand holds; in weed or skidding on rock it drags', () => {
  const at = spotAt(6, 9);
  assert.ok(at, 'somewhere 6 to 9 m deep');
  // (A blow the skiff's anchor holds in sand at five to one, once it's dug in a metre or two.)
  const push = 0.8;
  const sand = blow('skiff', at, push, 40, { bottom: { kind: 'sand', under: 'sand' } });
  assert.ok(sand.set > 0.85 && sand.moved < 3, `sand: dug in (${sand.set.toFixed(2)}) within ${sand.moved.toFixed(2)} m`);
  assert.ok(sand.events.includes('bite'), sand.events.join());
  // Weed, not through to the sand: it drags, and says so once it had held.
  const weedSpot = (() => { for (let i = 0; i < 400; i++) { const x = at.x + (i % 20), z = at.z + Math.floor(i / 20); if (!A.anchorBottom({ kind: 'weed', under: 'sand' }, x, z).through) return { x, z }; } })();
  const weed = blow('skiff', weedSpot, push, 40, { bottom: { kind: 'weed', under: 'sand' } });
  assert.ok(weed.moved > sand.moved + 4, `weed: dragged ${weed.moved.toFixed(1)} m against ${sand.moved.toFixed(1)}`);
  assert.ok(weed.events.includes('drag'), weed.events.join());
  // Rock it skids over: further still.
  const rockSpot = (() => { for (let i = 0; i < 400; i++) { const x = at.x + (i % 20), z = at.z + Math.floor(i / 20); if (!A.anchorBottom({ kind: 'rock' }, x, z).hooked) return { x, z }; } })();
  const rock = blow('skiff', rockSpot, push, 40, { bottom: { kind: 'rock', under: 'rock' } });
  assert.ok(rock.moved > weed.moved, `rock: dragged ${rock.moved.toFixed(1)} m`);
});

test('an anchor set from a save is already dug in, and holding where it lies (it says it’s dragging only once it’s gone half a metre from there)', () => {
  const at = spotAt(6, 9);
  const b = new Boat(scene, { kind: 'skiff' });
  b.place(at.x, at.z - 20, 0);
  b.update(1 / 30, clock, 0, 0, 0);
  b.setAnchor(true, { at, instant: true });
  const An = b.anchor;
  assert.ok(An.phase === 'set' && An.wasSet && A.setBy(An.dug, 0.8) > 0.999, 'dug in');
  assert.equal(An.heldAt, An.dug, 'holding where it lies');
  const events = [];
  b.onAnchor = (w) => events.push(w);
  for (let i = 0; i < 10 * 30; i++) {
    clock += 1 / 30;
    b.update(1 / 30, clock, 0, 0, 0);
  }
  assert.deepEqual(events, [], events.join());
});

test('live: in deep water the rope runs short and the anchor drags where it held in shallower; the heavier anchor’s chain lies along the bottom and holds', () => {
  const shallow = spotAt(6, 9), deep = spotAt(18, 22);
  assert.ok(shallow && deep, 'somewhere 6 to 9 m deep, and 18 to 22');
  assert.ok(rodeFor(deep.d) / deep.d < 3, 'short of three to one in deep water');
  const push = 0.8;
  const s = blow('skiff', shallow, push, 40), d = blow('skiff', deep, push, 40);
  assert.ok(deg(d.theta) > deg(s.theta) + 4, `pulled up at ${deg(d.theta).toFixed(1)}° against ${deg(s.theta).toFixed(1)}°`);
  assert.ok(s.moved < 3 && d.moved > s.moved + 3, `shallow ${s.moved.toFixed(1)} m, deep ${d.moved.toFixed(1)} m`);
  // The heavier anchor on chain, in the deep water: its chain lies along the bottom, pulling it
  // nearly level, and it holds.
  const c = blow('skiff', deep, push, 40, { rode: 'chain', hold: 2 });
  assert.ok(deg(c.theta) < deg(d.theta) - 5 && c.moved < 1, `chain: ${deg(c.theta).toFixed(1)}°, ${c.moved.toFixed(1)} m`);
});
