// The fishing line between the rod tip and whatever is on the end of it: a string of light
// points (verlet), as long as the line out, that hangs, blows and floats. Slack line sags in a
// curve from the tip, bellies downwind, lies on the water and is carried by the current; drawn
// tight by a fish it comes straight, from the tip down into the water towards it. Cheap enough to
// run every frame (one line, a few dozen points).

export class FishLine {
  constructor(n = 30) {
    this.n = n;
    this.p = new Float32Array(n * 3);
    this.q = new Float32Array(n * 3); // where each point was a step ago
    this.ready = false;
    this.length = 1;
  }

  // Lay it straight from a to b (a fresh cast, or when the ends jump).
  reset(a, b) {
    const { n, p, q } = this;
    for (let i = 0; i < n; i++) {
      const u = i / (n - 1);
      p[i * 3] = q[i * 3] = a.x + (b.x - a.x) * u;
      p[i * 3 + 1] = q[i * 3 + 1] = a.y + (b.y - a.y) * u;
      p[i * 3 + 2] = q[i * 3 + 2] = a.z + (b.z - a.z) * u;
    }
    this.ready = true;
  }

  // One step: the ends pinned at a (the rod tip) and b (float, lure, fish); `length` the line out.
  // world: { surface(x, z) → the water's height there, wind(x, z, out) → the air's velocity,
  // flow(x, z, out) → the water's }.
  step(a, b, length, dt, world) {
    const { n, p, q } = this;
    // (A fresh start when the ends jump, or if anything ever went wrong.)
    if (!this.ready || !(Math.abs(p[0] - a.x) + Math.abs(p[2] - a.z) <= 6) || !(Math.abs(p[(n - 1) * 3] - b.x) + Math.abs(p[(n - 1) * 3 + 2] - b.z) <= 6) || !Number.isFinite(p[(n >> 1) * 3 + 1])) this.reset(a, b);
    const straight = Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
    this.length = Math.max(length, straight);
    const h = Math.min(dt, 1 / 30);
    // (No time passing, nothing moves: just keep it on its ends.)
    if (!(h > 1e-5)) {
      this.constrain(a, b, 2);
      return;
    }
    const air = world.wind, water = world.flow, w = _w, c = _c;
    for (let i = 1; i < n - 1; i++) {
      const o = i * 3;
      const x = p[o], y = p[o + 1], z = p[o + 2];
      let vx = (x - q[o]) / h, vy = (y - q[o + 1]) / h, vz = (z - q[o + 2]) / h;
      const surf = world.surface(x, z);
      if (y < surf + 0.02) {
        // On or in the water: carried by the current, floating up to lie on the surface.
        water(x, z, c);
        const k = 1 - Math.exp(-5 * h);
        vx += (c.x - vx) * k;
        vz += (c.z - vz) * k;
        vy = vy * Math.exp(-8 * h) + (surf - y) * 3;
      } else {
        // In the air: falling, and blown along by the wind (a light line catches it).
        air(x, z, w);
        const k = 1 - Math.exp(-1.6 * h);
        vx += (w.x - vx) * k;
        vz += (w.z - vz) * k;
        vy -= 9.8 * h;
        vx *= 0.995;
        vz *= 0.995;
      }
      q[o] = x;
      q[o + 1] = y;
      q[o + 2] = z;
      p[o] = x + vx * h;
      p[o + 1] = y + vy * h;
      p[o + 2] = z + vz * h;
    }
    this.constrain(a, b, 12);
  }

  // The line can't stretch: each piece no longer than its share of the line out (it can go slack).
  constrain(a, b, iterations = 4) {
    const { n, p } = this;
    const seg = this.length / (n - 1);
    for (let it = 0; it < iterations; it++) {
      p[0] = a.x; p[1] = a.y; p[2] = a.z;
      const e = (n - 1) * 3;
      p[e] = b.x; p[e + 1] = b.y; p[e + 2] = b.z;
      for (let i = 0; i < n - 1; i++) {
        const o = i * 3, o2 = o + 3;
        const dx = p[o2] - p[o], dy = p[o2 + 1] - p[o + 1], dz = p[o2 + 2] - p[o + 2];
        const d = Math.hypot(dx, dy, dz);
        if (d <= seg || d < 1e-6) continue;
        const k = (d - seg) / d;
        // (The pinned ends don't move; the rest share the correction.)
        const wa = i === 0 ? 0 : i + 1 === n - 1 ? 1 : 0.5, wb = i === 0 ? 1 : i + 1 === n - 1 ? 0 : 0.5;
        p[o] += dx * k * wa; p[o + 1] += dy * k * wa; p[o + 2] += dz * k * wa;
        p[o2] -= dx * k * wb; p[o2 + 1] -= dy * k * wb; p[o2 + 2] -= dz * k * wb;
      }
    }
    p[0] = a.x; p[1] = a.y; p[2] = a.z;
    const e = (n - 1) * 3;
    p[e] = b.x; p[e + 1] = b.y; p[e + 2] = b.z;
  }

  // Drawn taut by a load: each point pulled a share k (0 … 1) of the way onto the straight line
  // between the ends (as the rod and the fish stretch it, quicker than the points could settle),
  // and its sway damped by as much.
  straighten(a, b, k) {
    const { n, p, q } = this;
    for (let i = 1; i < n - 1; i++) {
      const u = i / (n - 1);
      for (let c = 0; c < 3; c++) {
        const o = i * 3 + c, ax = c === 0 ? a.x : c === 1 ? a.y : a.z, bx = c === 0 ? b.x : c === 1 ? b.y : b.z;
        const v = p[o] - q[o];
        p[o] += (ax + (bx - ax) * u - p[o]) * k;
        q[o] = p[o] - v * (1 - k);
      }
    }
  }

  // How far the line sags below the straight line between its ends, at most (m): for tests and
  // for telling slack from tight.
  get sag() {
    const { n, p } = this;
    const ax = p[0], ay = p[1], az = p[2], e = (n - 1) * 3, bx = p[e], by = p[e + 1], bz = p[e + 2];
    let most = 0;
    for (let i = 1; i < n - 1; i++) {
      const u = i / (n - 1), o = i * 3;
      most = Math.max(most, Math.hypot(p[o] - (ax + (bx - ax) * u), p[o + 1] - (ay + (by - ay) * u), p[o + 2] - (az + (bz - az) * u)));
    }
    return most;
  }
}
const _w = { x: 0, z: 0 }, _c = { x: 0, z: 0 };
