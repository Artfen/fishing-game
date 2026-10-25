import * as THREE from 'three';
import { windAt } from './conditions.js';
import { clamp, smoothstep } from '../util.js';

// Wind lines: thin white streaks drawn in the air round you, carried along by the wind itself
// (gusts and lulls and all, from conditions.js), so you can see which way it blows and how hard,
// the way a sailor reads the wind on the water. Each is born upwind of you, drifts past with a
// lazy wobble (some curl over in a loop on the way), and fades out after a few seconds. More of
// them, and brighter, the stronger the wind; none in a flat calm.
//
// Each streak is a short ribbon traced through the points its head has passed, turned to face
// the camera and kept a few pixels wide whatever the distance, its tail fading to nothing.
//
// In a strong wind they don't race past at its full speed (at 20 m/s they'd shoot across the
// view as long white bars): above a moderate breeze they drift faster only a little, keep short
// tails, live shorter and stay up off the water, and grow a little fainter, a sense of the gale
// rather than a streak of it.

const N = 18; // points along each streak
const SAMPLE = 0.05; // seconds between points (shorter in a strong wind, so the tails stay short)
// How fast a streak is carried, for a wind of `sp` m/s: the wind's own speed in light air, then
// more and more slowly.
const carried = (sp) => (sp < 4 ? sp : 4 + (sp - 4) * 0.35);

export class WindLines {
  constructor(scene, count = 56) {
    this.count = count;
    this.lines = Array.from({ length: count }, (_, i) => ({ pts: new Float32Array(N * 3), n: 0, age: 0, life: 0, alive: false, seed: i * 1.37, curl: false, since: 0 }));
    const verts = count * N * 2;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(verts * 3);
    this.col = new Float32Array(verts * 4);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('color', new THREE.BufferAttribute(this.col, 4).setUsage(THREE.DynamicDrawUsage));
    const idx = [];
    for (let l = 0; l < count; l++) {
      for (let i = 0; i < N - 1; i++) {
        const a = (l * N + i) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    geo.setIndex(idx);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: true }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 4;
    this.mesh.visible = false;
    scene.add(this.mesh);
    this.strength = 0;
    this.gale = 0;
  }

  // Each frame: around `center` (where you are), shown or not (`on`), seen from `camera`.
  update(dt, t, center, on, camera) {
    const ws = windAt(center.x, center.z).speed;
    this.gale = smoothstep(10, 18, ws);
    this.strength += ((on ? smoothstep(0.8, 6, ws) : 0) - this.strength) * Math.min(1, dt * 1.5);
    this.mesh.visible = this.strength > 0.01;
    if (!this.mesh.visible) {
      for (const L of this.lines) L.alive = false;
      return;
    }
    const want = Math.round(this.count * clamp(0.18 + this.strength * 0.37, 0, 1));
    let live = 0;
    for (const L of this.lines) if (L.alive) live++;
    const cam = camera.position;
    for (let li = 0; li < this.lines.length; li++) {
      const L = this.lines[li];
      if (!L.alive) {
        if (live >= want || Math.random() > dt * 6) continue;
        this.spawn(L, center, t);
        live++;
      }
      L.age += dt;
      if (L.age > L.life) {
        L.alive = false;
        continue;
      }
      // The head drifts with the wind where it is, wobbling across and up and down; a curling
      // streak loops over once in the middle of its life.
      const hx = L.pts[0], hy = L.pts[1], hz = L.pts[2];
      const w = windAt(hx, hz, t);
      const sp0 = Math.max(0.5, w.speed), dx = w.x / sp0, dz = w.z / sp0, sp = carried(sp0);
      const wob = Math.sin(t * 2.1 + L.seed) * 0.35 * sp * 0.18;
      let vx = dx * sp - dz * wob, vy = Math.sin(t * 1.6 + L.seed * 2.3) * 0.22, vz = dz * sp + dx * wob;
      const k = L.age / L.life;
      if (L.curl && k > 0.3 && k < 0.7) {
        const ph = ((k - 0.3) / 0.4) * Math.PI * 2, r = 1.6 * Math.PI * 2 / (L.life * 0.4);
        vx += -Math.sin(ph) * r * dx - dx * sp * 0.6;
        vz += -Math.sin(ph) * r * dz - dz * sp * 0.6;
        vy += Math.cos(ph) * r;
      }
      L.since += dt;
      if (L.since >= SAMPLE * clamp(3.5 / sp, 0.35, 1)) {
        L.since = 0;
        L.pts.copyWithin(3, 0, (N - 1) * 3);
        L.n = Math.min(N, L.n + 1);
      }
      L.pts[0] = hx + vx * dt;
      L.pts[1] = hy + vy * dt;
      L.pts[2] = hz + vz * dt;
    }
    this.write(cam);
  }

  spawn(L, c, t) {
    const w = windAt(c.x, c.z, t), sp = Math.max(0.5, w.speed), dx = w.x / sp, dz = w.z / sp;
    const up = 4 + Math.random() * 22, across = (Math.random() - 0.5) * 40;
    const x = c.x - dx * up - dz * across, z = c.z - dz * up + dx * across, y = c.y + 1.4 + Math.random() * 5;
    for (let i = 0; i < N; i++) {
      L.pts[i * 3] = x;
      L.pts[i * 3 + 1] = y;
      L.pts[i * 3 + 2] = z;
    }
    L.n = 1;
    L.age = 0;
    L.life = (2.4 + Math.random() * 2.2) * clamp(6 / carried(sp), 0.55, 1);
    L.since = 0;
    L.curl = Math.random() < 0.22 * (1 - this.gale); // (no lazy loops in a gale)
    L.alive = true;
  }

  // The ribbons: each point split into two, across the line and square to the view.
  write(cam) {
    const P = this.pos, C = this.col, S = this.strength * (1 - 0.35 * this.gale);
    for (let li = 0; li < this.lines.length; li++) {
      const L = this.lines[li], base = li * N * 2;
      const fade = L.alive ? Math.sin(Math.PI * clamp(L.age / L.life, 0, 1)) : 0;
      for (let i = 0; i < N; i++) {
        const j = Math.min(i, Math.max(0, L.n - 1)), p = j * 3;
        const x = L.pts[p], y = L.pts[p + 1], z = L.pts[p + 2];
        // (Along the streak: towards the next point back, or from the one before at its tail.)
        const q = (j + 1 < L.n ? j + 1 : Math.max(0, j - 1)) * 3;
        const tx = L.pts[q] - x, ty = L.pts[q + 1] - y, tz = L.pts[q + 2] - z;
        const vx = cam.x - x, vy = cam.y - y, vz = cam.z - z, dist = Math.hypot(vx, vy, vz) || 1;
        // across = tangent × view, a few pixels wide at any distance
        let ax = ty * vz - tz * vy, ay = tz * vx - tx * vz, az = tx * vy - ty * vx;
        const al = Math.hypot(ax, ay, az) || 1, wdt = clamp(dist * 0.0028, 0.012, 0.09);
        ax = (ax / al) * wdt; ay = (ay / al) * wdt; az = (az / al) * wdt;
        const o = (base + i * 2) * 3;
        P[o] = x - ax; P[o + 1] = y - ay; P[o + 2] = z - az;
        P[o + 3] = x + ax; P[o + 4] = y + ay; P[o + 5] = z + az;
        // White, brightest at the head, gone at the tail; fading in and out over its life, and
        // where it's very near or far.
        const a = (i < L.n ? (1 - i / N) ** 1.4 : 0) * fade * S * 0.6 * smoothstep(1.5, 4, dist) * (1 - smoothstep(26, 40, dist));
        const c = (base + i * 2) * 4;
        C[c] = C[c + 1] = C[c + 2] = C[c + 4] = C[c + 5] = C[c + 6] = 1;
        C[c + 3] = C[c + 7] = a;
      }
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
    this.mesh.geometry.attributes.color.needsUpdate = true;
  }
}
