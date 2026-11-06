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

// The drawing: rewritten to make no garbage each frame and to send the graphics card nothing when
// nothing's changed. It draws exactly what it always did.
test('the trails are drawn exactly as before, and nothing is sent when there are none', async () => {
  globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => null }) };
  const THREE = await import('three');
  const { FoamTrailView } = await import('../src/world/foamTrails.js');
  const { waveHeight } = await import('../src/world/water.js');
  // The drawing as it was, for comparison.
  function oldUpdate(tracks, now, t, cx, cz, light = 1) {
    const o = this.o, nP = this.nP, P = this.pos, C = this.col, UV = this.uv;
    this.frame++;
    this.mat.color.setRGB(light, light, Math.min(1, light * 1.03));
    const near = [...tracks.tracks.values()]
      .map((T) => ({ T, d: T.head ? Math.hypot(T.head.x - cx, T.head.z - cz) : T.pts.length ? Math.hypot(T.pts[T.pts.length - 1].x - cx, T.pts[T.pts.length - 1].z - cz) : 1e9 }))
      .sort((a, b) => a.d - b.d)
      .slice(0, o.tracks);
    for (let ti = 0; ti < o.tracks; ti++) {
      const T = near[ti]?.T;
      const pts = T ? (T.head ? [...T.pts, T.head] : T.pts) : [];
      const n = Math.min(pts.length, nP), off = pts.length - n;
      for (let k = 0; k < nP; k++) {
        const vi = (ti * nP + k) * 2;
        if (k >= n) {
          C[vi * 4 + 3] = C[vi * 4 + 7] = 0;
          P[vi * 3 + 1] = P[vi * 3 + 4] = -999;
          continue;
        }
        const p = pts[off + k], L = tracks.look(p, now);
        const a = pts[Math.max(off, off + k - 1)], b = pts[Math.min(pts.length - 1, off + k + 1)];
        let dx = b.x - a.x, dz = b.z - a.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 1e-4) { dx /= dl; dz /= dl; } else { dx = p.fx; dz = p.fz; }
        const rx = -dz, rz = dx, hw = L.w * 0.5;
        const hi = ti * nP + k, far = Math.hypot(p.x - cx, p.z - cz) > 90;
        if (!far || (this.frame + k) % 4 === 0 || this.h[hi] === 0) this.h[hi] = waveHeight(p.x, p.z, t) + 0.05;
        const y = this.h[hi];
        P[vi * 3] = p.x - rx * hw; P[vi * 3 + 1] = y; P[vi * 3 + 2] = p.z - rz * hw;
        P[vi * 3 + 3] = p.x + rx * hw; P[vi * 3 + 4] = y; P[vi * 3 + 5] = p.z + rz * hw;
        UV[vi * 2] = 0; UV[vi * 2 + 1] = p.d / o.tile;
        UV[vi * 2 + 2] = 1; UV[vi * 2 + 3] = p.d / o.tile;
        const alpha = L.a * 0.85;
        for (let q = 0; q < 2; q++) {
          C[(vi + q) * 4] = C[(vi + q) * 4 + 1] = C[(vi + q) * 4 + 2] = 1;
          C[(vi + q) * 4 + 3] = alpha;
        }
      }
    }
  }
  const scene = new THREE.Scene();
  const F = new FoamTracks(), A = new FoamTrailView(scene), B = new FoamTrailView(scene);
  // A dozen boats (more than are drawn) going round at different speeds; some stop, then all go.
  const boats = Array.from({ length: 12 }, (_, i) => ({ key: `b${i}`, x: i * 40 - 200, z: (i % 3) * 60, heading: i, speed: 4 + i * 1.3, rate: (i % 5) * 0.06 - 0.1 }));
  let t = 0;
  const same = () => {
    for (const k of ['pos', 'col', 'uv', 'h']) assert.deepEqual(A[k], B[k], k);
  };
  for (let f = 0; f < 30 * 130; f++) {
    t += 1 / 30;
    for (const b of boats) {
      if (f > 30 * 20 && b.key < 'b4') b.speed = 0;
      if (f > 30 * 40) continue; // (gone home)
      b.heading += b.rate / 30;
      b.x += Math.sin(b.heading) * b.speed / 30;
      b.z += Math.cos(b.heading) * b.speed / 30;
      F.note(b.key, b.x, b.z, b.heading, b.speed, 2, 6.5, b.speed > 6 ? 0.8 : 0, t);
    }
    F.step(t);
    const cx = Math.sin(t * 0.1) * 150, cz = 40;
    A.update(F, t, t, cx, cz, 0.9);
    oldUpdate.call(B, F, t, t, cx, cz, 0.9);
    if (f % 15 === 0) same();
  }
  same();
  // Long after, no trails: nothing more is sent.
  assert.equal(F.tracks.size, 0);
  const g = A.mesh.geometry.attributes, v = [g.position.version, g.color.version, g.uv.version];
  for (let i = 0; i < 10; i++) A.update(F, t + i, t + i, 0, 0, 1);
  assert.deepEqual([g.position.version, g.color.version, g.uv.version], v);
});
