// Foam trails: the white water a boat leaves on the sea behind her, lying along the way she
// actually went (round a turn, it curves) and fading slowly, so a fast boat's track stays on the
// water for a minute or more, hundreds of metres back, the way it does at sea. Close behind her
// the ripple field draws the churned wash into the water itself (see waterfx.js, wakes.js); this
// is the long trail beyond it, drawn wherever the boat has been, however far off.
//
// How much she leaves follows how hard she's pushing the water about: next to nothing from a boat
// gliding along at a walking pace, a bright churned lane from a planing hull or a propeller
// working hard, and in between a displacement boat pushed near her hull speed, her bow wave
// breaking. It starts as wide as her beam and spreads as it ages, breaking up into lace.

import * as THREE from 'three';
import { waveHeight } from './water.js';
import { hideFromReflection } from './waterfx.js';

export const TRAIL = {
  life: 80,     // s: how long any trail lasts
  fade: 28,     // s: its whiteness falls by e in this long
  points: 140,  // per boat
  tracks: 8,    // boats drawn at once (the nearest)
  spread: 0.1,  // how fast it widens, beams a second
  tile: 14,     // m along the trail for the foam's pattern to repeat
};

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const smooth = (a, b, x) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};

// How much white water a hull leaves (0 … 1) at speed (m/s), length L (m) and churn (0 … 1: her
// propeller working). (Her bow wave starts breaking past about a third of her hull speed's Froude
// number; it's a bright lane on the plane; a hard-working propeller churns its own.)
export function foamOf(speed, L, churn = 0) {
  const fn = speed / Math.sqrt(9.81 * Math.max(L, 1));
  const k = smooth(0.3, 1.0, fn) * smooth(1.2, 5, speed) + churn * 0.35 * smooth(0.5, 3, speed);
  return clamp(k, 0, 1);
}

// The trails' points, a track for each boat (keyed by the boat itself): what the drawing reads.
export class FoamTracks {
  constructor(opts = {}) {
    this.o = { ...TRAIL, ...opts };
    this.tracks = new Map();
  }

  // A boat at (x, z) (her transom), heading, speed (m/s), beam (m), length (m), churn, at time now
  // (s). A point is laid every few metres she goes (further apart the faster she is), and at
  // least each second while she's leaving any.
  note(key, x, z, heading, speed, beam, L, churn, now) {
    const k = foamOf(speed, L, churn);
    let T = this.tracks.get(key);
    if (!T) {
      if (k < 0.02) return;
      T = { pts: [], d: 0, head: null };
      this.tracks.set(key, T);
    }
    const fx = Math.sin(heading), fz = Math.cos(heading);
    // (Her transom as it is now: the same object each frame, filled in afresh.)
    const hd = (T.head ||= { x: 0, z: 0, fx: 0, fz: 0, t0: 0, k: 0, w0: 0, d: 0 });
    hd.x = x; hd.z = z; hd.fx = fx; hd.fz = fz; hd.t0 = now; hd.k = k; hd.w0 = beam; hd.d = T.d;
    const last = T.pts[T.pts.length - 1];
    if (last) {
      const gap = Math.hypot(x - last.x, z - last.z);
      // (Moved far in a moment: a fresh trail, not a line across the chart.)
      if (gap > 60) {
        T.pts.length = 0;
        T.d = 0;
      } else if (gap < Math.max(1.2, speed * 0.3) && now - last.t0 < 1) return;
      else T.d += gap;
      T.head.d = T.d;
    }
    if (k < 0.02 && (!last || last.k < 0.02)) return;
    T.pts.push({ x, z, fx, fz, t0: now, k, w0: beam, d: T.d });
    if (T.pts.length > this.o.points) T.pts.shift();
  }

  // Old points gone; a boat's track gone once all of it has.
  step(now) {
    for (const [key, T] of this.tracks) {
      while (T.pts.length && now - T.pts[0].t0 > this.o.life) T.pts.shift();
      if (!T.pts.length && (!T.head || now - T.head.t0 > 2)) this.tracks.delete(key);
    }
  }

  // How white and how wide a point is at time now: { a (0 … 1), w (m) } (into out, if given).
  look(p, now, out = { a: 0, w: 0 }) {
    const age = now - p.t0, o = this.o;
    out.a = p.k * smooth(0, 0.8, age) * Math.exp(-age / o.fade) * (1 - smooth(o.life * 0.7, o.life, age));
    out.w = p.w0 * (1 + Math.min(3.2, age * o.spread));
    return out;
  }
}

// The foam itself: a lacy white, bubbly at its heart and broken into patches and threads at its
// edges, drawn once on a canvas (u across the trail, v along it, repeating).
function foamTexture() {
  const W = 128, H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g || !g.createImageData) return null;
  const img = g.createImageData(W, H), d = img.data;
  // A little value noise, tiled across both edges.
  const hash = (x, y) => {
    const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const noise = (x, y, px, py) => {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const h = (a, b) => hash(((a % px) + px) % px, ((b % py) + py) % py);
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    return (h(xi, yi) * (1 - u) + h(xi + 1, yi) * u) * (1 - v) + (h(xi, yi + 1) * (1 - u) + h(xi + 1, yi + 1) * u) * v;
  };
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const u = x / W, across = 1 - Math.abs(u * 2 - 1);
      // (Bubbles and lace: the thin contours of two noise fields, and a coarser patchiness.)
      const n1 = noise(u * 10, (y / H) * 20, 10, 20), n2 = noise(u * 22 + 3, (y / H) * 44 + 7, 22, 44);
      const web = Math.max(1 - Math.abs(n1 - 0.5) * 9, 1 - Math.abs(n2 - 0.5) * 7) * 0.8;
      const patch = noise(u * 4 + 11, (y / H) * 8, 4, 8);
      const heart = smooth(0.35, 0.95, across) * (0.55 + 0.45 * patch);
      const edge = smooth(0.0, 0.4, across) * smooth(0.45, 0.75, patch) * 0.8;
      const a = clamp(Math.max(heart * (0.45 + 0.55 * web), edge * web), 0, 1);
      const i = (y * W + x) * 4;
      d[i] = d[i + 1] = d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// The drawing: a ribbon along each track, laid on the waves (the nearest few tracks).
export class FoamTrailView {
  constructor(scene, opts = {}) {
    this.o = { ...TRAIL, ...opts };
    const nT = this.o.tracks, nP = this.o.points + 1;
    this.nP = nP;
    const nv = nT * nP * 2;
    this.pos = new Float32Array(nv * 3);
    this.col = new Float32Array(nv * 4);
    this.uv = new Float32Array(nv * 2);
    this.h = new Float32Array(nT * nP);
    const idx = [];
    for (let t = 0; t < nT; t++) {
      for (let k = 0; k < nP - 1; k++) {
        const a = (t * nP + k) * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 4));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv, 2));
    this.mat = new THREE.MeshBasicMaterial({ map: foamTexture(), vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(g, this.mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 2;
    scene.add(this.mesh);
    hideFromReflection(this.mesh);
    this.frame = 0;
    // (Kept from frame to frame: the nearest tracks and how far off each is, how many points of
    // each slot were drawn last frame, and the point being looked at.)
    this._near = new Array(nT).fill(null);
    this._nearD = new Float64Array(nT);
    this._drawn = new Int32Array(nT).fill(nP);
    this._look = { a: 0, w: 0 };
  }

  // Draw the tracks (FoamTracks) at time now (s) and t (the waves' time), seen from (cx, cz); light:
  // how lit the foam is (0 … 1: full daylight 1).
  update(tracks, now, t, cx, cz, light = 1) {
    const o = this.o, nP = this.nP, P = this.pos, C = this.col, UV = this.uv;
    this.frame++;
    this.mat.color.setRGB(light, light, Math.min(1, light * 1.03));
    // (The nearest few tracks, nearest first; tracks as far off as each other in the order they
    // came.)
    const near = this._near, nearD = this._nearD, nT = o.tracks;
    let count = 0;
    for (const T of tracks.tracks.values()) {
      const e = T.head || T.pts[T.pts.length - 1];
      const d = e ? Math.hypot(e.x - cx, e.z - cz) : 1e9;
      let i = Math.min(count, nT);
      while (i > 0 && nearD[i - 1] > d) i--;
      if (i >= nT) continue;
      for (let j = Math.min(count, nT - 1); j > i; j--) {
        near[j] = near[j - 1];
        nearD[j] = nearD[j - 1];
      }
      near[i] = T;
      nearD[i] = d;
      count++;
    }
    let moved = false, uvMoved = false;
    for (let ti = 0; ti < nT; ti++) {
      const T = ti < count ? near[ti] : null;
      near[ti] = null;
      // (Her points, and her transom after them: pts[i], or the head past the end.)
      const pts = T ? T.pts : null, np = pts ? pts.length : 0, len = np + (T?.head ? 1 : 0);
      const n = Math.min(len, nP), off = len - n;
      // (Slots drawn last frame and empty now are hidden; ones already hidden are left be.)
      const was = this._drawn[ti];
      this._drawn[ti] = n;
      if (n || was) moved = true;
      for (let k = 0; k < nP; k++) {
        const vi = (ti * nP + k) * 2;
        if (k >= n) {
          if (k >= was) break;
          C[vi * 4 + 3] = C[vi * 4 + 7] = 0;
          P[vi * 3 + 1] = P[vi * 3 + 4] = -999;
          continue;
        }
        const ip = off + k, p = ip < np ? pts[ip] : T.head, L = tracks.look(p, now, this._look);
        // The way the trail runs here (between its neighbours), and across it.
        const ia = Math.max(off, ip - 1), ib = Math.min(len - 1, ip + 1);
        const a = ia < np ? pts[ia] : T.head, b = ib < np ? pts[ib] : T.head;
        let dx = b.x - a.x, dz = b.z - a.z;
        const dl = Math.hypot(dx, dz);
        if (dl > 1e-4) { dx /= dl; dz /= dl; } else { dx = p.fx; dz = p.fz; }
        const rx = -dz, rz = dx, hw = L.w * 0.5;
        // (Its height on the waves: every frame close by, a quarter as often further off.)
        const hi = ti * nP + k, far = Math.hypot(p.x - cx, p.z - cz) > 90;
        if (!far || (this.frame + k) % 4 === 0 || this.h[hi] === 0) this.h[hi] = waveHeight(p.x, p.z, t) + 0.05;
        const y = this.h[hi];
        P[vi * 3] = p.x - rx * hw; P[vi * 3 + 1] = y; P[vi * 3 + 2] = p.z - rz * hw;
        P[vi * 3 + 3] = p.x + rx * hw; P[vi * 3 + 4] = y; P[vi * 3 + 5] = p.z + rz * hw;
        // (Along the trail, the foam's pattern stays put on the water: it changes only as the
        // points do.)
        const v = p.d / o.tile;
        if (UV[vi * 2] !== 0 || UV[vi * 2 + 1] !== v || UV[vi * 2 + 2] !== 1 || UV[vi * 2 + 3] !== v) {
          UV[vi * 2] = 0; UV[vi * 2 + 1] = v;
          UV[vi * 2 + 2] = 1; UV[vi * 2 + 3] = v;
          uvMoved = true;
        }
        // (The newest point, at her transom, starts it softly: the churn right behind her is the
        // water's own, see waterfx.js.)
        const alpha = L.a * 0.85;
        for (let q = 0; q < 2; q++) {
          C[(vi + q) * 4] = C[(vi + q) * 4 + 1] = C[(vi + q) * 4 + 2] = 1;
          C[(vi + q) * 4 + 3] = alpha;
        }
      }
    }
    // (Sent to the graphics card only when something's changed: nothing at all, with no trails
    // about.)
    const g = this.mesh.geometry;
    if (moved) {
      g.attributes.position.needsUpdate = true;
      g.attributes.color.needsUpdate = true;
    }
    if (uvMoved) g.attributes.uv.needsUpdate = true;
  }
}
