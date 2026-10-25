// The sailing boat: the sail's physics (no drive in irons, luffing when let out past the wind,
// stalled when hauled in on a run, fastest across the wind, never far past hull speed, pushed to
// leeward), a boat that sails, heels, swings her boom to leeward, tacks and gybes, and rows with the
// sail down; the sail kept in the save; and the wind lines that only show when there's wind and
// you want them. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// (The boat's lantern and the wind lines' textures want a canvas: a stand-in will do.)
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : () => {}) });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }) };

const THREE = await import('three');
const S = await import('../src/sailing.js');
const { Boat } = await import('../src/boat.js');
const { conditions } = await import('../src/world/conditions.js');
const { WindLines } = await import('../src/world/windlines.js');

// The sail's push on a boat heading +z (forward 0,0,1; right −1,0,0), with the wind coming from
// `deg` off her bow (over her left side) at v m/s.
const force = (deg, v, sheet) => {
  // (Apparent: the air's motion less hers.)
  const [wx, wz] = [-Math.sin((deg * Math.PI) / 180) * v, -Math.cos((deg * Math.PI) / 180) * v];
  return S.sailForce(wx, wz, 0, 1, -1, 0, sheet, {});
};

// Steady speed through the water for a true wind angle (deg) and speed, trimming at best.
function steady(deg, tws) {
  const twa = (deg * Math.PI) / 180;
  const wx = -Math.sin(twa) * tws, wz = -Math.cos(twa) * tws;
  let vf = 0, vr = 0, f = null;
  for (let i = 0; i < 2400; i++) {
    const dt = 1 / 60, ax = wx + vr, az = wz - vf;
    f = S.sailForce(ax, az, 0, 1, -1, 0, S.bestSheet(Math.acos(Math.max(-1, Math.min(1, -az / Math.hypot(ax, az))))), {});
    const k = S.hullDrag(vf), e = Math.exp(-k * dt);
    vf = vf * e + (f.drive * (1 - e)) / k;
    const g = S.boardGrip(vf), e2 = Math.exp(-g * dt);
    vr = vr * e2 + (f.lateral * (1 - e2)) / g;
  }
  return { vf, f };
}

test('head to wind nothing drives her: in irons', () => {
  for (const deg of [0, 8, 15]) {
    const f = force(deg, 6, 0);
    assert.ok(f.drive <= 0.01, `${deg}°: drive ${f.drive.toFixed(3)}`);
  }
  assert.equal(force(5, 6, 0).state, 'irons');
});

test('let out past the wind the sail luffs; hauled in tight on a run it stalls', () => {
  const luff = force(60, 6, 1);
  assert.equal(luff.state, 'luffing');
  assert.ok(luff.drive < force(60, 6, S.bestSheet((60 * Math.PI) / 180)).drive);
  const stall = force(110, 6, 0);
  assert.equal(stall.state, 'stalled');
  assert.ok(stall.drive < force(110, 6, S.bestSheet((110 * Math.PI) / 180)).drive);
  // Trimmed right, she's drawing.
  for (const deg of [45, 70, 90, 120]) assert.equal(force(deg, 6, S.bestSheet((deg * Math.PI) / 180)).state, 'drawing', `${deg}°`);
});

test('the sail pushes her forward, and to leeward with the wind forward of the beam', () => {
  for (const deg of [40, 60, 90, 130, 170]) {
    const f = force(deg, 6, S.bestSheet((deg * Math.PI) / 180));
    assert.ok(f.drive > 0, `${deg}° drives`);
    assert.equal(f.side, -1);
    // (Pushed away from the side the wind comes over; further aft, lift and drag all but cancel
    // across her.)
    if (deg <= 90) assert.ok(f.lateral * f.side < 0, `${deg}°: lateral ${f.lateral.toFixed(3)}`);
    else assert.ok(Math.abs(f.lateral) < f.drive * 0.5, `${deg}°: lateral ${f.lateral.toFixed(3)}`);
  }
  // Close-hauled the push sideways is bigger than forward: that's what the centreboard is for.
  const close = force(40, 6, S.bestSheet((40 * Math.PI) / 180));
  assert.ok(Math.abs(close.lateral) > close.drive);
});

test('she sails fastest across the wind, slower close-hauled and dead downwind, and never far past hull speed', () => {
  const close = steady(45, 5).vf, beam = steady(90, 5).vf, run = steady(180, 5).vf;
  assert.ok(beam > close && beam > run, `close ${close.toFixed(2)} beam ${beam.toFixed(2)} run ${run.toFixed(2)}`);
  assert.ok(beam > 2 && beam < 3.2, `beam reach in a gentle breeze ${beam.toFixed(2)} m/s`);
  assert.ok(close > 1.2, 'she makes way upwind');
  for (const deg of [60, 90, 120, 150, 180]) assert.ok(steady(deg, 14).vf < 4.4, `${deg}° in a strong breeze`);
  // No wind, no way.
  assert.ok(steady(90, 0).vf < 0.01);
});

test('the sheet and the boom: one sets the other, and the best trim is where she draws', () => {
  for (const s of [0, 0.3, 0.7, 1]) assert.ok(Math.abs(S.sheetFor(S.boomLimit(s)) - s) < 1e-9);
  assert.ok(S.boomLimit(0) < 0.2 && S.boomLimit(1) > 1.3);
  assert.equal(S.trimAdvice({ state: 'luffing', awa: 1 }).sheet, -1);
  assert.equal(S.trimAdvice({ state: 'stalled', awa: 1 }).sheet, 1);
});

/* ---------------- the boat ---------------- */

const scene = new THREE.Scene();
function sailing(fromDeg, tws, sheet) {
  const b = new Boat(scene, { kind: 'sail' });
  b.place(60, 330, 0);
  b.setSail(true);
  b.sheet = sheet;
  // (The wind's compass bearing: from the east is π/2; she heads south, +z.)
  conditions.manual = { speed: tws, from: Math.PI - (fromDeg * Math.PI) / 180 };
  conditions.wind.speed = conditions.wind.target = tws;
  conditions.wind.from = conditions.manual.from;
  return b;
}

test('under sail she picks up speed, heels to leeward and lays her boom out on the leeward side', () => {
  const b = sailing(90, 6, S.bestSheet(1.2));
  for (let i = 0; i < 1500; i++) b.update(1 / 60, i / 60, 0, 0, 0);
  assert.ok(b.forwardSpeed > 1, `${b.forwardSpeed.toFixed(2)} m/s`);
  const A = b.sailing;
  assert.equal(A.state, 'drawing');
  // Heeled away from the wind, and the boom out the same way.
  assert.ok(Math.sign(b.heel) === -Math.sign(A.side * -1) || Math.abs(b.heel) > 0.02);
  assert.ok(Math.abs(b.boomYaw) > 0.2, `boom ${b.boomYaw.toFixed(2)}`);
  // The boom's end is on the leeward side: away from where the wind comes from.
  const end = -Math.sin(b.boomYaw);
  assert.equal(Math.sign(end), A.side);
  b.group.removeFromParent();
});

test('she tacks through the wind with way on, and the boom comes across', () => {
  const b = sailing(60, 6, S.bestSheet(0.75));
  let tacks = 0;
  b.onTack = () => tacks++;
  for (let i = 0; i < 900; i++) b.update(1 / 60, i / 60, 0, 0, 0);
  const side = b.sailing.side;
  // Put the helm over towards the wind until she's through it.
  const steer = side > 0 ? -1 : 1;
  let t = 15;
  for (let i = 0; i < 600 && b.sailing.side === side; i++, t += 1 / 60) b.update(1 / 60, t, 0, steer, 0);
  assert.notEqual(b.sailing.side, side, 'through the wind');
  assert.equal(tacks, 1);
  for (let i = 0; i < 240; i++, t += 1 / 60) b.update(1 / 60, t, 0, 0, 0);
  assert.equal(Math.sign(-Math.sin(b.boomYaw)), b.sailing.side, 'the boom across to the new leeward side');
  b.group.removeFromParent();
});

test('with the sail down she rows, and the sail feels nothing', () => {
  const b = sailing(90, 8, 0.3);
  b.setSail(false);
  for (let i = 0; i < 600; i++) b.update(1 / 60, i / 60, 1, 0, 0);
  assert.ok(b.forwardSpeed > 0.8, `rowing ${b.forwardSpeed.toFixed(2)} m/s`);
  assert.ok(b.oars.every((o) => o.g.visible));
  b.setSail(true);
  assert.ok(b.oars.every((o) => !o.g.visible), 'oars stowed under sail');
  b.group.removeFromParent();
  conditions.manual = null;
});

test('the sail, and how far her sheet was eased, are kept in the save', async () => {
  const { parseSave, SAVE_VERSION } = await import('../src/save.js');
  const data = { day: 3, hour: 10, boats: { sail: { x: 5, z: -80, heading: 0, sail: 0.35 }, row: { x: 0, z: 0, heading: 0, sail: 'up' } }, vessel: 'sail' };
  const s = parseSave(JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1000, data })).state;
  assert.equal(s.vessel, 'sail');
  assert.equal(s.boats.sail.sail, 0.35);
  assert.equal(s.boats.row?.sail, undefined, 'junk is dropped');
});

/* ---------------- wind lines ---------------- */

test('wind lines show only with a wind to show, and only when wanted', () => {
  const W = new WindLines(scene, 24);
  const cam = { position: new THREE.Vector3(0, 6, 40) };
  const at = new THREE.Vector3(0, 0, 60);
  conditions.wind.speed = 0;
  for (let i = 0; i < 120; i++) W.update(1 / 60, i / 60, at, true, cam);
  assert.equal(W.mesh.visible, false, 'flat calm: none');
  conditions.wind.speed = 9;
  for (let i = 0; i < 240; i++) W.update(1 / 60, 2 + i / 60, at, true, cam);
  assert.ok(W.mesh.visible && W.lines.filter((l) => l.alive).length > 6, 'a fresh breeze: plenty');
  for (let i = 0; i < 400; i++) W.update(1 / 60, 6 + i / 60, at, false, cam);
  assert.equal(W.mesh.visible, false, 'switched off: they fade away');
  assert.ok(W.pos.every(Number.isFinite));
});

test('a gybe never stops the game: the camera’s shake is an amount to set, not a function to call', async () => {
  // (Calling it as one crashed the game the first time the boom came across.)
  const { readFileSync } = await import('node:fs');
  const main = readFileSync('src/main.js', 'utf8');
  assert.ok(!/rig\.shake\??\.?\(/.test(main), 'rig.shake(…) called');
  const { readFileSync: read } = await import('node:fs');
  assert.ok(/this\.shake = 0/.test(read('src/camera.js', 'utf8')), 'the camera keeps shake as a number');
});
