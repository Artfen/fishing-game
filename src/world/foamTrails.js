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
    T.head = { x, z, fx, fz, t0: now, k, w0: beam, d: T.d };
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

  // How white and how wide a point is at time now: { a (0 … 1), w (m) }.
  look(p, now) {
    const age = now - p.t0, o = this.o;
    const a = p.k * smooth(0, 0.8, age) * Math.exp(-age / o.fade) * (1 - smooth(o.life * 0.7, o.life, age));
    return { a, w: p.w0 * (1 + Math.min(3.2, age * o.spread)) };
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
  }

  // Draw the tracks (FoamTracks) at time now (s) and t (the waves' time), seen from (cx, cz); light:
  // how lit the foam is (0 … 1: full daylight 1).
  update(tracks, now, t, cx, cz, light = 1) {
    const o = this.o, nP = this.nP, P = this.pos, C = this.col, UV = this.uv;
    this.frame++;
    this.mat.color.setRGB(light, light, Math.min(1, light * 1.03));
    // (The nearest few tracks.)
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
        // The way the trail runs here (between its neighbours), and across it.
        const a = pts[Math.max(off, off + k - 1)], b = pts[Math.min(pts.length - 1, off + k + 1)];
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
        UV[vi * 2] = 0; UV[vi * 2 + 1] = p.d / o.tile;
        UV[vi * 2 + 2] = 1; UV[vi * 2 + 3] = p.d / o.tile;
        // (The newest point, at her transom, starts it softly: the churn right behind her is the
        // water's own, see waterfx.js.)
        const alpha = L.a * 0.85;
        for (let q = 0; q < 2; q++) {
          C[(vi + q) * 4] = C[(vi + q) * 4 + 1] = C[(vi + q) * 4 + 2] = 1;
          C[(vi + q) * 4 + 3] = alpha;
        }
      }
    }
    const g = this.mesh.geometry;
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    g.attributes.uv.needsUpdate = true;
  }
}
