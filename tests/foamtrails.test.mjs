// Foam trails (src/world/foamTrails.js): the white water a boat leaves lies along the way she
// actually went, curving round a turn, lasts a minute or more and fades, and comes only from a
// boat pushing the water about.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FoamTracks, foamOf, TRAIL } from '../src/world/foamTrails.js';

// Drive a boat round: speed (m/s), turning at rate (rad/s), for secs, laying her trail.
const drive = (F, key, s, { speed = 15, rate = 0, secs = 20, x = 0, z = 0, heading = 0, L = 6.5, churn = 1, t0 = 0 } = {}) => {
  let t = t0;
  for (let i = 0; i < secs * 30; i++) {
    t += 1 / 30;
    heading += rate / 30;
    x += Math.sin(heading) * speed / 30;
    z += Math.cos(heading) * speed / 30;
    F.note(key, x, z, heading, speed, 1.5, L, churn, t);
    F.step(t);
    s.push({ x, z, t });
  }
  return { x, z, heading, t };
};

test('a planing boat leaves a bright trail; a rowing boat next to none', () => {
  assert.ok(foamOf(18, 6.5, 1) > 0.95);
  assert.ok(foamOf(9.5, 9.2, 0.9) > 0.8, 'the yacht near her hull speed');
  assert.ok(foamOf(1.5, 3.8, 0) < 0.02, 'the rowing boat');
  assert.ok(foamOf(1.2, 3.7, 0) < 0.02, 'the kayak');
  const F = new FoamTracks();
  drive(F, 'row', [], { speed: 1.5, L: 3.8, churn: 0 });
  assert.equal(F.tracks.size, 0);
});

test('the trail follows the way she went, round a turn too', () => {
  const F = new FoamTracks(), path = [];
  drive(F, 'rib', path, { speed: 15, rate: 0.3, secs: 15 });
  const T = F.tracks.get('rib');
  assert.ok(T.pts.length > 40, `${T.pts.length} points`);
  // Every point lies on her path (within a metre of where she was).
  for (const p of T.pts) assert.ok(path.some((q) => Math.hypot(q.x - p.x, q.z - p.z) < 1), 'on her path');
  // (A circle at 15 m/s turning 0.3 rad/s: radius 50 m. Its points curve round, not cut across.)
  const far = Math.max(...T.pts.map((p) => Math.hypot(p.x - T.pts[0].x, p.z - T.pts[0].z)));
  assert.ok(far > 80 && far < 101, `${far.toFixed(0)} m across her turning circle`);
});

test('it lasts a minute or more, fading and spreading as it ages, then it’s gone', () => {
  const F = new FoamTracks(), path = [];
  const end = drive(F, 'rib', path, { speed: 15, secs: 10 });
  const T = F.tracks.get('rib');
  const first = T.pts[0];
  const at = (dt) => F.look(first, end.t + dt);
  assert.ok(at(0).a > 0.6, 'bright behind her');
  assert.ok(at(50).a > 0.05 && at(50).a < at(0).a * 0.5, `still there after a minute: ${at(50).a.toFixed(2)}`);
  assert.ok(at(50).w > at(0).w * 2, 'spread wide');
  // She stops; long after, the trail's gone, and so is her track.
  let t = end.t;
  for (let i = 0; i < (TRAIL.life + 5) * 2; i++) {
    t += 0.5;
    F.note('rib', end.x, end.z, end.heading, 0, 1.5, 6.5, 0, t);
    F.step(t);
  }
  assert.equal(F.tracks.get('rib')?.pts.length ?? 0, 0);
});

test('a boat moved far in a moment starts a fresh trail, not a line across the chart', () => {
  const F = new FoamTracks(), path = [];
  const end = drive(F, 'rib', path, { speed: 15, secs: 5 });
  F.note('rib', end.x + 500, end.z, end.heading, 15, 1.5, 6.5, 1, end.t + 0.05);
  const T = F.tracks.get('rib');
  assert.ok(T.pts.every((p) => Math.abs(p.x - (end.x + 500)) < 1));
});
