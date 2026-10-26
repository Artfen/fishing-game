import * as THREE from 'three';
import { ATLANTIC_ANATOMY } from './anatomyAtlantic.js';
import { SOUTH_ANATOMY } from './anatomySouth.js';
import { BIG_ANATOMY } from './anatomyBig.js';

// Anatomical models of aquatic animals, one recipe per species, built in code (no external
// assets). Three body plans share the machinery where the animals really are alike:
//  · fish   – a lofted body (dorsal and ventral profiles, width, cross-section), separate fins
//             (spiny and soft dorsals, anal, paired pectorals and pelvics, caudal, finlets,
//             keels), a mouth cleft, gill-cover edge and real eyes, painted with the species'
//             markings over a fine scale texture;
//  · flat   – a flatfish lying on its blind side: an oval disc with both eyes on top, a fringe
//             of dorsal and anal fin joined round the tail, mottled above and white beneath;
//  · cuttle – a cuttlefish: a flattened mantle with a fin fringe all round, a head with W-pupil
//             eyes, and eight arms.
// Every model faces +z (nose at z = +0.5, about 1 unit long overall) with its back along +y, so
// it can be instanced and scaled to a fish's length in the world, shown in the field guide and
// photographed for the catch card from the same recipe.
//
// Each model is one geometry with three groups (body, fins, eyes) for three materials, and a
// low-detail version for distant fish.

/* ---------------- curves ---------------- */

// A smooth curve through [t, value] points (Catmull-Rom).
function spline(pts) {
  const n = pts.length;
  return (t) => {
    if (t <= pts[0][0]) return pts[0][1];
    if (t >= pts[n - 1][0]) return pts[n - 1][1];
    let i = 1;
    while (pts[i][0] < t) i++;
    const p0 = pts[Math.max(0, i - 2)], p1 = pts[i - 1], p2 = pts[i], p3 = pts[Math.min(n - 1, i + 1)];
    const h = p2[0] - p1[0], k = (t - p1[0]) / h;
    const m1 = ((p2[1] - p0[1]) / Math.max(1e-6, p2[0] - p0[0])) * h, m2 = ((p3[1] - p1[1]) / Math.max(1e-6, p3[0] - p1[0])) * h;
    const k2 = k * k, k3 = k2 * k;
    return (2 * k3 - 3 * k2 + 1) * p1[1] + (k3 - 2 * k2 + k) * m1 + (-2 * k3 + 3 * k2) * p2[1] + (k3 - k2) * m2;
  };
}
const sgnPow = (v, p) => Math.sign(v) * Math.pow(Math.abs(v), p);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------------- shared textures ---------------- */

const TEX = new Map();
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

// Scales: offset rows of little arcs, used as a bump map so light catches each scale.
function scaleTexture() {
  if (TEX.has('scales')) return TEX.get('scales');
  const c = canvas(128, 128), x = c.getContext('2d');
  x.fillStyle = '#808080';
  x.fillRect(0, 0, 128, 128);
  const r = 16;
  for (let row = -1; row < 9; row++) {
    for (let col = -1; col < 9; col++) {
      const cx = col * r + (row % 2 ? r / 2 : 0), cy = row * r * 0.9;
      const g = x.createRadialGradient(cx - r * 0.2, cy, 1, cx, cy, r * 0.75);
      g.addColorStop(0, '#a8a8a8');
      g.addColorStop(0.8, '#7a7a7a');
      g.addColorStop(1, '#5e5e5e');
      x.fillStyle = g;
      x.beginPath();
      x.arc(cx, cy, r * 0.72, -Math.PI / 2, Math.PI / 2);
      x.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX.set('scales', t);
  return t;
}

// Fin rays: one ray per tile across, fading out towards the fin's edge.
function finTexture() {
  if (TEX.has('fin')) return TEX.get('fin');
  const c = canvas(32, 128), x = c.getContext('2d');
  const img = x.createImageData(32, 128);
  for (let j = 0; j < 128; j++) {
    const v = j / 127; // 0 at the edge, 1 at the base (canvas is flipped into uv)
    for (let i = 0; i < 32; i++) {
      const d = Math.abs(i / 31 - 0.5) * 2;
      const ray = Math.exp(-d * d * 30);
      const o = (j * 32 + i) * 4;
      const shade = 0.78 + ray * 0.22;
      img.data[o] = img.data[o + 1] = img.data[o + 2] = Math.round(255 * shade);
      img.data[o + 3] = Math.round(255 * clamp(0.38 + ray * 0.45 + v * 0.25, 0, 1));
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.RepeatWrapping;
  TEX.set('fin', t);
  return t;
}

// An eye: iris and pupil (round, or the W of a cuttlefish) seen down the eye's own axis.
function eyeTexture(iris, pupil = 'round') {
  const key = `eye|${iris}|${pupil}`;
  if (TEX.has(key)) return TEX.get(key);
  const S = 64, c = canvas(S, S), x = c.getContext('2d');
  const img = x.createImageData(S, S), col = new THREE.Color(iris);
  for (let j = 0; j < S; j++) {
    for (let i = 0; i < S; i++) {
      // Sphere uv: u round the pole, v from the pole (the centre of the eye) outwards.
      const u = i / S, v = j / S;
      const a = u * Math.PI * 2;
      let r, g, b;
      let inPupil;
      if (pupil === 'bar') {
        // An octopus's pupil: a horizontal slot.
        const px = Math.cos(a) * v, py = Math.sin(a) * v;
        inPupil = Math.abs(py) < 0.045 && Math.abs(px) < 0.24;
      } else if (pupil === 'W') {
        // A W lying across the eye: dark where the wave says so.
        const px = Math.cos(a) * v, py = Math.sin(a) * v;
        const w = 0.06 + 0.05 * Math.cos(px * 26);
        inPupil = Math.abs(py + 0.03 * Math.cos(px * 13)) < w && Math.abs(px) < 0.3;
      } else inPupil = v < 0.13;
      if (inPupil) [r, g, b] = [8, 8, 10];
      else if (v < 0.36) {
        const k = 0.75 + 0.25 * Math.sin(a * 18) * (v - 0.13) * 3;
        [r, g, b] = [col.r * 255 * k, col.g * 255 * k, col.b * 255 * k];
      } else [r, g, b] = [30, 28, 26];
      const o = (j * S + i) * 4;
      img.data[o] = r;
      img.data[o + 1] = g;
      img.data[o + 2] = b;
      img.data[o + 3] = 255;
    }
  }
  x.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  TEX.set(key, t);
  return t;
}

/* ---------------- the painter's helpers ---------------- */

// Paint a species' skin onto a canvas laid out like the body: u (x) from snout (0) to tail
// (1), v (y) from the back (top of the canvas) down to the belly (bottom).
export const SKIN_W = 512, SKIN_H = 256;
function paintSkin(A) {
  const c = canvas(SKIN_W, SKIN_H), x = c.getContext('2d');
  const W = SKIN_W, H = SKIN_H;
  const col = A.colors;
  // Back to belly.
  const g = x.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, col.back);
  g.addColorStop(col.split ?? 0.38, col.flank);
  g.addColorStop(0.8, col.belly);
  g.addColorStop(1, col.belly);
  x.fillStyle = g;
  x.fillRect(0, 0, W, H);
  const P = {
    x, W, H,
    u: (u) => u * W,
    v: (v) => (1 - v) * H, // v: 0 belly … 1 back
    line(pts, width, color, alpha = 1) {
      x.save();
      x.globalAlpha = alpha;
      x.strokeStyle = color;
      x.lineWidth = width;
      x.lineCap = 'round';
      x.beginPath();
      pts.forEach(([u, v], i) => (i ? x.lineTo(u * W, (1 - v) * H) : x.moveTo(u * W, (1 - v) * H)));
      x.stroke();
      x.restore();
    },
    blob(u, v, ru, rv, color, alpha = 1, soft = 0.5) {
      x.save();
      x.globalAlpha = alpha;
      const gg = x.createRadialGradient(u * W, (1 - v) * H, 0, u * W, (1 - v) * H, Math.max(ru * W, rv * H));
      gg.addColorStop(0, color);
      gg.addColorStop(1 - soft * 0.6, color);
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gg;
      x.beginPath();
      x.ellipse(u * W, (1 - v) * H, ru * W, rv * H, 0, 0, Math.PI * 2);
      x.fill();
      x.restore();
    },
    band(v0, v1, color, alpha = 1, u0 = 0, u1 = 1) {
      x.save();
      x.globalAlpha = alpha;
      x.fillStyle = color;
      x.fillRect(u0 * W, (1 - v1) * H, (u1 - u0) * W, (v1 - v0) * H);
      x.restore();
    },
    noise(seed, count, color, alpha, sizeU, sizeV, vMin = 0, vMax = 1) {
      let s = seed;
      const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      x.save();
      x.fillStyle = color;
      for (let i = 0; i < count; i++) {
        x.globalAlpha = alpha * (0.4 + rnd() * 0.6);
        const u = rnd(), v = vMin + rnd() * (vMax - vMin);
        x.beginPath();
        x.ellipse(u * W, (1 - v) * H, sizeU * W * (0.5 + rnd()), sizeV * H * (0.5 + rnd()), rnd() * 3, 0, Math.PI * 2);
        x.fill();
      }
      x.restore();
    },
  };
  // Fine scale rows drawn faintly into the colour too, so they read even without the bump map.
  if (A.scaleRows) {
    x.save();
    x.globalAlpha = 0.07;
    x.strokeStyle = '#000';
    x.lineWidth = 1;
    const nu = A.scaleRows[0], nv = A.scaleRows[1];
    for (let j = 0; j < nv; j++) {
      for (let i = 0; i < nu; i++) {
        const cx = ((i + (j % 2) * 0.5) / nu) * W, cy = (j / nv) * H;
        x.beginPath();
        x.arc(cx, cy, (W / nu) * 0.62, -Math.PI / 2.2, Math.PI / 2.2);
        x.stroke();
      }
    }
    x.restore();
  }
  // Where a body point (t along, y up) falls on the skin, for marks that follow the anatomy.
  if (A.plan === 'fish') {
    const top = spline(A.top), bot = spline(A.bottom), n = A.round ?? 2.3;
    P.vAt = (t, y) => {
      const yt = top(t), yb = bot(t), yc = (yt + yb) / 2, hu = Math.max(0.0015, (yt - yb) / 2);
      return (sgnPow(clamp((y - yc) / hu, -1, 1), n / 2) + 1) / 2;
    };
    // The gape of the mouth, drawn dark, with a paler lip line below.
    if (A.mouth) {
      const m = A.mouth, pts = [];
      for (let k = 0; k <= 8; k++) {
        const t = (k / 8) * m.len;
        pts.push([t, P.vAt(t, m.y + m.slope * t)]);
      }
      P.line(pts, 3, '#1e1a18', 0.85);
      P.line(pts.map(([u, v]) => [u, v - 0.035]), 2, '#ffffff', 0.18);
    }
    // The gill cover's edge, a soft dark curve, lighter just behind it.
    if (A.gill) {
      const g2 = A.gill, pts = [];
      for (let k = 0; k <= 10; k++) {
        const sv = k / 10 * 2 - 1;
        pts.push([g2.t + g2.curve * sv * sv, (sv + 1) / 2]);
      }
      P.line(pts.filter(([, v]) => v > 0.12 && v < 0.9), 2.5, '#000000', 0.22);
      P.line(pts.filter(([, v]) => v > 0.12 && v < 0.9).map(([u, v]) => [u + 0.006, v]), 2, '#ffffff', 0.12);
    }
    // A little darker over the head.
    x.save();
    const hg = x.createLinearGradient(0, 0, 0.25 * W, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0.16)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = hg;
    x.fillRect(0, 0, 0.25 * W, H * 0.45);
    x.restore();
  }
  A.paint?.(P);
  // A dark corner for small marks on other parts (the sole's pectoral tip).
  if (A.pectoralSpot) {
    x.fillStyle = A.pectoralSpot;
    x.fillRect(W - 8, 0, 8, 8);
  }
  if (A.pectoralRing) {
    x.fillStyle = A.pectoralRing;
    x.fillRect(W - 8, 8, 8, 8);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

/* ---------------- geometry assembly ---------------- */

class Builder {
  // finColor: the colour fins take unless one is given its own (vertex colours on the fins).
  constructor(finColor = '#ffffff') {
    this.parts = [[], [], []]; // body, fins, eyes: { pos, nor, uv, idx, col }
    this.finColor = new THREE.Color(finColor);
  }

  add(group, pos, uv, idx, nor = null, col = null) {
    this.parts[group].push({ pos, uv, idx, nor, col });
  }

  build() {
    const pos = [], uv = [], nor = [], idx = [], groups = [], col = [];
    let base = 0;
    const normalsFor = [];
    for (let g = 0; g < 3; g++) {
      const start = idx.length;
      for (const p of this.parts[g]) {
        for (const v of p.pos) pos.push(v);
        for (const v of p.uv) uv.push(v);
        const n = p.pos.length / 3, c = g === 1 ? this.finColor : WHITE;
        if (p.col) for (const v of p.col) col.push(v);
        else for (let i = 0; i < n; i++) col.push(c.r, c.g, c.b);
        for (const i of p.idx) idx.push(i + base);
        normalsFor.push({ base, count: p.pos.length / 3, nor: p.nor });
        base += p.pos.length / 3;
      }
      groups.push([start, idx.length - start, g]);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    for (const [s, c, m] of groups) if (c) geo.addGroup(s, c, m);
    geo.computeVertexNormals();
    // Parts with their own normals (fins) keep them.
    const n = geo.attributes.normal;
    for (const f of normalsFor) if (f.nor) for (let i = 0; i < f.count; i++) n.setXYZ(f.base + i, f.nor[i * 3], f.nor[i * 3 + 1], f.nor[i * 3 + 2]);
    geo.computeBoundingSphere();
    return geo;
  }
}

const WHITE = new THREE.Color('#ffffff');
const _ca = new THREE.Color(), _cb = new THREE.Color();

// A flat fin from an outline in its own plane: pts are [along, across] pairs (metres in model
// units), mapped into the world by place(along, across) → [x, y, z]. uvOf gives each point's
// fin texture coordinates (u counts rays). tint, if given, colours this fin: { base, edge,
// edgeOf(along, across) → 0 at the fin's base … 1 at its edge }.
function finMesh(B, outline, place, uvOf, tint = null) {
  const shape = new THREE.Shape(outline.map(([a, c]) => new THREE.Vector2(a, c)));
  const sg = new THREE.ShapeGeometry(shape, 6);
  const p = sg.attributes.position;
  const pos = [], uv = [], col = tint ? [] : null;
  if (tint) {
    _ca.set(tint.base);
    _cb.set(tint.edge || tint.base);
  }
  for (let i = 0; i < p.count; i++) {
    const a = p.getX(i), c = p.getY(i);
    pos.push(...place(a, c));
    uv.push(...uvOf(a, c));
    if (tint) {
      const k = tint.edge ? clamp((tint.edgeOf(a, c) - (tint.from ?? 0.55)) / (1 - (tint.from ?? 0.55)), 0, 1) : 0;
      col.push(_ca.r + (_cb.r - _ca.r) * k, _ca.g + (_cb.g - _ca.g) * k, _ca.b + (_cb.b - _ca.b) * k);
    }
  }
  const idx = Array.from(sg.index.array);
  sg.dispose();
  B.add(1, pos, uv, idx, null, col);
}

// An eye: a glossy dome facing out along `dir`, its pole (uv v = 0) at the centre of the pupil.
function eyeMesh(B, center, dir, r, flat = 0.45, seg = 14) {
  const s = new THREE.SphereGeometry(r, seg, Math.max(6, seg >> 1), 0, Math.PI * 2, 0, Math.PI * 0.62);
  // Turn the sphere so its pole (+y) faces along dir, and flatten it against the head.
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  const m = new THREE.Matrix4().compose(new THREE.Vector3(...center), q, new THREE.Vector3(1, flat, 1));
  s.applyMatrix4(m);
  B.add(2, Array.from(s.attributes.position.array), Array.from(s.attributes.uv.array), Array.from(s.index.array));
  s.dispose();
}

/* ---------------- body plan: fish ---------------- */

function buildFish(A, detail) {
  const B = new Builder(A.colors.fin);
  const L = A.bodyLen, z0 = 0.5;
  const top = spline(A.top), bot = spline(A.bottom), wid = spline(A.width);
  const n = A.round ?? 2.3;
  // (Small fish seen in shoals get fewer rings and sides close up: lod < 1.)
  const lod = A.lod ?? 1, long = A.long ?? 1;
  const NS = detail ? Math.round(46 * lod * long) : Math.round(14 * long), NR = detail ? Math.max(14, Math.round(32 * lod)) : 12;
  // A fin's own colours, if it has any: { color, edge }.
  const tintOf = (f, edgeOf, from) => (f.color || f.edge ? { base: f.color || A.colors.fin, edge: f.edge, edgeOf, from } : null);
  const zOf = (t) => z0 - t * L;
  // Where a point on the skin is, from t (along) and a (round: 0 belly, 0.25 right side, 0.5
  // back, 0.75 left side).
  const at = (t, a) => {
    const yt = top(t), yb = bot(t), w = Math.max(0.0015, wid(t)), yc = (yt + yb) / 2, hu = Math.max(0.0015, (yt - yb) / 2);
    const th = Math.PI * 2 * a - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
    return [w * sgnPow(c, 2 / n), yc + hu * sgnPow(s, 2 / n), s];
  };
  const pos = [], uv = [], idx = [];
  const mouth = A.mouth, gill = A.gill;
  for (let i = 0; i <= NS; i++) {
    // More rings at the head, where the shape changes fastest.
    const t = Math.pow(i / NS, 1.25);
    for (let j = 0; j <= NR; j++) {
      const a = j / NR;
      let [x, y, s] = at(t, a);
      let z = zOf(t);
      // The mouth: a cleft along the jaw line, from the snout back to the corner of the mouth.
      if (detail && mouth && t < mouth.len) {
        const ym = mouth.y + mouth.slope * t;
        const d = Math.abs(y - ym);
        const k = (1 - t / mouth.len) * Math.exp(-d * d / (mouth.gape * mouth.gape));
        x *= 1 - 0.35 * k;
        y = y + (y > ym ? 1 : -1) * k * mouth.gape * 0.3;
        // Thick, fleshy lips (grunts, mullet): the skin swells either side of the gape.
        if (mouth.lips) {
          const kl = (1 - t / mouth.len) * Math.exp(-d * d / (4 * mouth.gape * mouth.gape)) * (1 - k);
          x *= 1 + mouth.lips * kl;
          y += (y > ym ? 1 : -1) * mouth.lips * kl * mouth.gape * 0.6;
        }
      }
      // The edge of the gill cover: a slight step in the skin.
      if (detail && gill && Math.abs(t - (gill.t + gill.curve * (s * s))) < 0.012) { x *= 1.025; }
      pos.push(x, y, z);
      uv.push(t, (s + 1) / 2);
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j, b = a + NR + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  B.add(0, pos, uv, idx);
  // A broad front closed too (the hammerhead's head).
  if (A.capNose) {
    const ring = [], uvs = [], ix = [];
    ring.push(0, (top(0) + bot(0)) / 2, zOf(0) + 0.002);
    uvs.push(0, 0.5);
    for (let j = 0; j <= NR; j++) {
      const [x, y] = at(0, j / NR);
      ring.push(x, y, zOf(0));
      uvs.push(0, 0.5);
    }
    for (let j = 1; j <= NR; j++) ix.push(0, j, j + 1);
    B.add(0, ring, uvs, ix);
  }
  // The end of the tail stalk, closed.
  {
    const t = 1, ring = [], uvs = [], ix = [];
    const c = [0, (top(t) + bot(t)) / 2, zOf(t)];
    ring.push(...c);
    uvs.push(1, 0.5);
    for (let j = 0; j <= NR; j++) {
      const [x, y] = at(t, j / NR);
      ring.push(x, y, zOf(t));
      uvs.push(1, 0.5);
    }
    for (let j = 1; j <= NR; j++) ix.push(0, j + 1, j);
    B.add(0, ring, uvs, ix);
  }

  // Fins.
  const median = (f, sideSign) => {
    // A dorsal or anal fin in the body's mid-plane: outline from [d, h] (d along the body
    // from the fin's start, as a fraction of body length; h up from the back, or down from
    // the belly).
    const base = (d) => (sideSign > 0 ? top(f.t0 + d) : bot(f.t0 + d));
    const span = f.t1 - f.t0;
    let out;
    if (f.shape === 'spiny') {
      out = [[0, -0.004]];
      const N = f.spines;
      for (let k = 0; k < N; k++) {
        const d = (k / (N - 1)) * span;
        const hk = f.h * (f.profile ? spline(f.profile)(k / (N - 1)) : 1);
        out.push([d - span * 0.02, hk * 0.68], [d, hk], [d + span * 0.01, hk * 0.72]);
      }
      out.push([span, f.h * 0.12], [span, -0.004]);
    } else {
      const prof = spline(f.profile || [[0, 0.6], [0.2, 1], [0.6, 0.75], [1, 0.25]]);
      out = [[0, -0.004]];
      for (let k = 0; k <= 10; k++) out.push([(k / 10) * span, f.h * prof(k / 10)]);
      out.push([span, -0.004]);
    }
    const rays = f.rays || (f.shape === 'spiny' ? f.spines : 14);
    finMesh(B, out, (d, h) => [0, base(clamp(d, 0, span)) + sideSign * (h - 0.002), zOf(f.t0 + d)],
      (d, h) => [(d / span) * rays, clamp(h / f.h, 0, 1)], tintOf(f, (d, h) => clamp(h / (f.h * (f.profile ? spline(f.profile)(d / span) : 1) || 1), 0, 1)));
  };
  const paired = (f, side) => {
    // Pectoral or pelvic fin: an outline from the base along the fin's own length, set at
    // (t, y) on the flank and splayed out from the body.
    const [bx, by] = at(f.t, f.a ?? 0.18);
    const len = f.len, wd = f.w ?? len * 0.45;
    const prof = spline(f.profile || [[0, 0.3], [0.3, 0.9], [0.7, 0.7], [1, 0.05]]);
    const out = [[0, -wd * 0.5]];
    for (let k = 0; k <= 10; k++) out.push([(k / 10) * len, -wd * 0.5 + wd * prof(k / 10)]);
    out.push([len * 0.7, -wd * 0.5], [0, -wd * 0.5]);
    const splay = f.splay ?? 0.55, droop = f.droop ?? 0.35;
    const dir = new THREE.Vector3(side * Math.sin(splay), -Math.sin(droop), -Math.cos(splay) * Math.cos(droop)).normalize();
    // Most paired fins stand edge-up from the body; a gurnard's spread out flat, like wings.
    const across = f.spread ? new THREE.Vector3(-dir.z * side, 0.15, dir.x * side).normalize() : new THREE.Vector3(side * Math.cos(splay) * 0.3, 1, 0).normalize();
    finMesh(B, out, (l, c) => [bx * side * 0.98 + dir.x * l + across.x * c, by + dir.y * l + across.y * c, zOf(f.t) + dir.z * l + across.z * c],
      (l, c) => [((c + wd * 0.5) / wd) * (f.rays || 10), 1 - l / len], tintOf(f, (l) => l / len, f.edgeFrom));
  };
  for (const f of A.fins) {
    if (f.kind === 'dorsal') median(f, 1);
    else if (f.kind === 'anal') median(f, -1);
    else if (f.kind === 'pectoral' || f.kind === 'pelvic') {
      if (!detail && f.kind === 'pelvic') continue;
      paired(f, 1);
      paired(f, -1);
    } else if (f.kind === 'finlets') {
      // A row of little triangular finlets above and below the tail stalk.
      for (let k = 0; k < f.count; k++) {
        const t0 = f.t0 + k * f.step;
        for (const s of [1, -1]) {
          const base = (d) => (s > 0 ? top(t0 + d) : bot(t0 + d));
          finMesh(B, [[0, 0], [f.step * 0.15, f.h], [f.step * 0.85, f.h * 0.7], [f.step * 0.9, 0]],
            (d, h) => [0, base(d) + s * h, zOf(t0 + d)], (d, h) => [d / f.step * 2, h / f.h], tintOf(f, (d, h) => h / f.h));
        }
      }
    } else if (f.kind === 'keel' && detail) {
      for (const s of [1, -1]) {
        finMesh(B, [[0, 0], [f.len * 0.5, f.h], [f.len, 0]],
          (d, h) => [s * (wid(f.t + d) + h), (top(f.t + d) + bot(f.t + d)) / 2, zOf(f.t + d)], (d, h) => [d / f.len, h / f.h]);
      }
    } else if (f.kind === 'caudal') {
      // The tail: forked, emarginate, truncate or rounded, from the end of the stalk.
      const zb = zOf(1) + 0.003, yb = (top(1) + bot(1)) / 2, hb = (top(1) - bot(1)) / 2 + 0.004;
      const len = 0.5 + zb, H = f.h; // reaches the very end (z = -0.5)
      const fork = f.fork ?? 0;
      let out;
      // An eel's tail: the dorsal and anal fins meeting round a pointed tip.
      if (f.shape === 'eel') out = [[0, -hb - H * 0.7], [len * 0.55, -H * 0.55], [len, 0], [len * 0.55, H * 0.55], [0, hb + H * 0.7]];
      // A shark's: the upper lobe long and swept up, the lower one short.
      else if (f.shape === 'shark') out = [[0, -hb], [len * 0.26, -H * 0.4], [len * 0.36, -H * 0.5], [len * 0.33, -H * 0.16], [len * 0.62, H * 0.1], [len, H * 0.6], [len * 0.9, H * 0.72], [len * 0.45, H * 0.42], [0, hb]];
      // A tuna's: a narrow, stiff crescent on a slim stalk.
      else if (f.shape === 'lunate') out = [[0, -hb], [len * 0.35, -H * 0.3], [len * 0.85, -H * 0.85], [len, -H], [len * 0.62, -H * 0.42], [len * 0.5, 0], [len * 0.62, H * 0.42], [len, H], [len * 0.85, H * 0.85], [len * 0.35, H * 0.3], [0, hb]];
      else if (f.shape === 'rounded') out = [[0, -hb], [len * 0.4, -H * 0.85], [len * 0.85, -H * 0.6], [len, 0], [len * 0.85, H * 0.6], [len * 0.4, H * 0.85], [0, hb]];
      else if (f.shape === 'truncate') out = [[0, -hb], [len * 0.55, -H * 0.85], [len * 0.97, -H], [len, -H * 0.3], [len * 1.0, H * 0.3], [len * 0.97, H], [len * 0.55, H * 0.85], [0, hb]];
      else out = [[0, -hb], [len * 0.5, -H * 0.55], [len, -H], [len * (1 - fork) + len * 0.08, -H * 0.2], [len * (1 - fork), 0], [len * (1 - fork) + len * 0.08, H * 0.2], [len, H], [len * 0.5, H * 0.55], [0, hb]];
      // (Dark-tipped lobes: the edge colour by distance from the stalk and from the middle.)
      finMesh(B, out, (d, h) => [0, yb + h, zb - d], (d, h) => [(h / H + 1) * 0.5 * (f.rays || 18), 1 - d / len],
        tintOf(f, (d, h) => (f.tips ? Math.max(d / len, Math.abs(h) / H) * (Math.abs(h) / H) : d / len), f.edgeFrom));
    } else if (f.kind === 'rays' && detail) {
      // Free fin rays, like fingers, below the pectoral fin (a gurnard walks on them).
      const [bx, by] = at(f.t, f.a ?? 0.08);
      for (const side of [1, -1]) {
        for (let k = 0; k < (f.count ?? 3); k++) {
          const z = zOf(f.t + k * 0.012), w = 0.0035;
          finMesh(B, [[0, -w], [f.len * 0.6, -w * 0.8], [f.len, 0], [f.len * 0.6, w * 0.8], [0, w]],
            (l, c) => [side * (bx + l * 0.35), by - l * 0.9, z + c - l * 0.15], (l) => [0.5, 1 - l / f.len], f.color ? { base: f.color, edgeOf: () => 0 } : null);
        }
      }
    }
  }
  // Eyes.
  const e = A.eye;
  {
    const t = e.t, yt = top(t), yb = bot(t), yc = (yt + yb) / 2, hu = (yt - yb) / 2;
    const s = clamp((e.y - yc) / hu, -0.95, 0.95);
    const sp = sgnPow(s, n / 2);
    const c = Math.sqrt(Math.max(0, 1 - sp * sp));
    const x = wid(t) * Math.pow(c, 2 / n);
    for (const side of [1, -1]) eyeMesh(B, [side * (x - e.r * 0.15), e.y, zOf(t)], new THREE.Vector3(side, e.up ?? 0.05, e.fwd ?? 0.1), e.r, 0.42, detail ? 16 : 8);
  }
  return B.build();
}

/* ---------------- body plan: flatfish ---------------- */

function buildFlat(A, detail) {
  const B = new Builder(A.colors.fin);
  const L = A.bodyLen, z0 = 0.5;
  const wid = spline(A.width), thick = spline(A.thick);
  const NS = detail ? 40 : 12, NA = detail ? 20 : 8;
  const zOf = (t) => z0 - t * L;
  // Top (eyed side, +y) and bottom (blind side) surfaces of a lens-shaped disc.
  for (const face of [1, -1]) {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const t = i / NS, w = Math.max(0.002, wid(t)), th = thick(t);
      for (let j = 0; j <= NA; j++) {
        const q = (j / NA) * 2 - 1; // -1 … 1 across
        const lens = Math.pow(Math.max(0, 1 - q * q), 0.75);
        const y = face > 0 ? th * lens : -th * (A.belly ?? 0.35) * lens;
        pos.push(q * w, y, zOf(t));
        uv.push(t * 0.97, face > 0 ? 0.5 + (q + 1) * 0.25 : (q + 1) * 0.25); // (clear of the dark corner)
      }
    }
    for (let i = 0; i < NS; i++) {
      for (let j = 0; j < NA; j++) {
        const a = i * (NA + 1) + j, b = a + NA + 1;
        if (face > 0) idx.push(a, a + 1, b, b, a + 1, b + 1);
        else idx.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }
    B.add(0, pos, uv, idx);
  }
  // The fin fringe round both edges, and the tail.
  if (A.fringe) {
    const F = A.fringe;
    // Narrow at the snout, full along the body, and still wide at the end, where the dorsal
    // and anal fins run into the tail.
    const fringeW = (s) => F.w * (0.25 + 0.75 * Math.min(1, s / 0.15)) * (1 - 0.3 * Math.max(0, (s - 0.8) / 0.2));
    for (const side of [1, -1]) {
      const pos = [], uv = [], idx = [];
      const N = detail ? 36 : 10;
      for (let i = 0; i <= N; i++) {
        const t = F.t0 + (i / N) * (1 - F.t0);
        const w = Math.max(0.002, wid(t)), fw = fringeW((t - F.t0) / (1 - F.t0));
        pos.push(side * (w - 0.002), 0, zOf(t), side * (w + fw), 0.004, zOf(t) - fw * 0.15);
        uv.push(i * 1.2, 1, i * 1.2, 0);
      }
      for (let i = 0; i < N; i++) {
        const a = i * 2;
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      }
      B.add(1, pos, uv, idx);
    }
    // A rounded tail, as wide where it starts as the body and fringe it joins.
    const zb = zOf(1), len = 0.5 + zb, H = wid(1) + fringeW(1);
    finMesh(B, [[0, -H], [len * 0.35, -H * 1.08], [len * 0.8, -H * 0.85], [len, -H * 0.35], [len, H * 0.35], [len * 0.8, H * 0.85], [len * 0.35, H * 1.08], [0, H]],
      (d, h) => [h, 0.002, zb - d], (d, h) => [(h / H + 1) * 8, 1 - d / len]);
  }
  // The pectoral fin of the eyed side, lying back over the body.
  if (A.pectoral && detail) {
    const p = A.pectoral;
    finMesh(B, [[0, -0.008], [p.len * 0.45, -0.019], [p.len * 0.85, -0.014], [p.len, 0], [p.len * 0.85, 0.014], [p.len * 0.45, 0.019], [0, 0.008]],
      (l, c) => [p.x + c, thick(p.t) * 0.8 + 0.004, zOf(p.t) - l], (l, c) => [((c + 0.019) / 0.038) * 6, 1 - l / p.len]);
    if (A.pectoralSpot) {
      // Its black mark: an oval over the outer part of the fin (larger on some soles, ringed
      // with yellow and white on the sand sole), coloured from the skin's corners (painted there
      // for it).
      const k = A.pectoralSpotSize ?? 1;
      const disc = (r, lift, u, v, at) => {
        const d = new THREE.CircleGeometry(r * k, 14);
        d.rotateX(-Math.PI / 2);
        d.scale(1, 1, 1.6);
        d.translate(p.x, thick(p.t) * 0.8 + lift, zOf(p.t) - p.len * at);
        const uv = [];
        for (let i = 0; i < d.attributes.position.count; i++) uv.push(u, v);
        B.add(0, Array.from(d.attributes.position.array), uv, Array.from(d.index.array));
        d.dispose();
      };
      if (A.pectoralRing) disc(0.016, 0.005, 0.995, 0.953, 0.6);
      disc(0.012, 0.0055, 0.995, 0.995, A.pectoralRing ? 0.6 : 0.74);
    }
  }
  // Both eyes on the top, close together.
  for (const e of A.eyes) {
    const t = e.t, th = thick(t);
    eyeMesh(B, [e.x, th * 0.92, zOf(t)], new THREE.Vector3(e.x * 2, 1, 0.15), e.r, 0.55, detail ? 14 : 8);
  }
  return B.build();
}

/* ---------------- body plan: cuttlefish ---------------- */

function buildCuttle(A, detail) {
  const B = new Builder(A.colors.fin);
  const NS = detail ? 36 : 12, NR = detail ? 28 : 10;
  // Head and mantle as one loft: arms forward at +z, the rounded end of the mantle at -z.
  const L = 0.78, z0 = 0.28;
  const zOf = (t) => z0 - t * L;
  const wid = spline(A.width), top = spline(A.top), bot = spline(A.bottom);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    for (let j = 0; j <= NR; j++) {
      const a = j / NR, th = Math.PI * 2 * a - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      const w = Math.max(0.002, wid(t)), yt = top(t), yb = bot(t), yc = (yt + yb) / 2, hu = Math.max(0.002, (yt - yb) / 2);
      pos.push(w * sgnPow(c, 0.9), yc + hu * sgnPow(s, 0.9), zOf(t));
      uv.push(t, (s + 1) / 2);
    }
  }
  for (let i = 0; i < NS; i++) {
    for (let j = 0; j < NR; j++) {
      const a = i * (NR + 1) + j, b = a + NR + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  B.add(0, pos, uv, idx);
  // The fin: a narrow frill all along both sides of the mantle.
  for (const side of [1, -1]) {
    const fp = [], fu = [], fi = [];
    const N = detail ? 30 : 10, t0 = A.fin.t0, t1 = A.fin.t1;
    for (let i = 0; i <= N; i++) {
      const t = t0 + (i / N) * (t1 - t0);
      const w = wid(t), y = (top(t) + bot(t)) / 2 - 0.006;
      const fw = A.fin.w * Math.sin(Math.PI * (0.06 + 0.88 * (i / N)));
      fp.push(side * (w - 0.004), y, zOf(t), side * (w + fw), y - 0.004, zOf(t));
      fu.push(i * 0.8, 1, i * 0.8, 0);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      if (side > 0) fi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else fi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    B.add(1, fp, fu, fi);
  }
  // Eight arms in a crown at the front, gathered and slightly curled down; the body skin covers them.
  {
    const t = 0;
    const base = new THREE.Vector3(0, (top(t) + bot(t)) / 2 - 0.004, zOf(t));
    for (let k = 0; k < 8; k++) {
      const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
      const ox = Math.cos(ang) * 0.034, oy = Math.sin(ang) * 0.02;
      const len = A.arm * (k === 0 || k === 7 ? 0.8 : k === 3 || k === 4 ? 1.05 : 1);
      const pts = [];
      for (let i = 0; i <= 6; i++) {
        const u = i / 6;
        pts.push(new THREE.Vector3(base.x + ox * (1 - u * 0.5), base.y + oy * (1 - u * 0.4) - u * u * 0.03, base.z + u * len));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      const tg = new THREE.TubeGeometry(curve, detail ? 10 : 4, 0.011, detail ? 6 : 4, false);
      const p = tg.attributes.position;
      // Taper to a point.
      for (let i = 0; i < p.count; i++) {
        const seg = Math.floor(i / ((detail ? 6 : 4) + 1)) / (detail ? 10 : 4);
        const c = curve.getPointAt(Math.min(1, seg));
        const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(c).multiplyScalar(1 - seg * 0.85);
        p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
      }
      const u = [];
      for (let i = 0; i < p.count; i++) u.push(0.05, 0.78);
      B.add(0, Array.from(p.array), u, Array.from(tg.index.array));
      tg.dispose();
    }
  }
  // Eyes high on the sides of the head.
  {
    const t = A.eye.t, w = wid(t);
    for (const side of [1, -1]) eyeMesh(B, [side * (w - 0.006), A.eye.y, zOf(t)], new THREE.Vector3(side, 0.35, 0.1), A.eye.r, 0.55, detail ? 16 : 8);
  }
  return B.build();
}

/* ---------------- body plan: squid ---------------- */

// A long-finned squid (Loligo): a slender mantle tapering to a point, a pair of rhombic fins
// along its rear half that meet at the tip, a head with big eyes, eight short arms and two long
// tentacles ending in clubs, all pointing forward (+z).
function buildSquid(A, detail) {
  const B = new Builder(A.colors.fin);
  const NS = detail ? 34 : 12, NR = detail ? 20 : 8;
  const L = A.bodyLen, z0 = 0.5 - A.armLen; // the head end of the body (arms run forward of it)
  const zOf = (t) => z0 - t * L;
  const wid = spline(A.width), ht = spline(A.height ?? A.width);
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= NS; i++) {
    const t = i / NS;
    for (let j = 0; j <= NR; j++) {
      const th = Math.PI * 2 * (j / NR) - Math.PI / 2, c = Math.cos(th), s = Math.sin(th);
      pos.push(Math.max(0.0015, wid(t)) * c, Math.max(0.0015, ht(t)) * s, zOf(t));
      uv.push(t, (s + 1) / 2);
    }
  }
  for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) {
    const a = i * (NR + 1) + j, b = a + NR + 1;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  B.add(0, pos, uv, idx);
  // The fins: one each side, widest a little behind their middle, joined at the tip.
  const F = A.fin, prof = spline(F.profile);
  for (const side of [1, -1]) {
    const fp = [], fu = [], fi = [], N = detail ? 24 : 8;
    for (let i = 0; i <= N; i++) {
      const u = i / N, t = F.t0 + u * (1 - F.t0), w = wid(t), fw = F.w * prof(u);
      fp.push(side * (w * 0.9), 0, zOf(t), side * (w + fw), -0.002, zOf(t) + fw * 0.12);
      fu.push(i * 0.7, 1, i * 0.7, 0);
    }
    for (let i = 0; i < N; i++) {
      const a = i * 2;
      if (side > 0) fi.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
      else fi.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    B.add(1, fp, fu, fi);
  }
  // Arms and tentacles.
  const limb = (ox, oy, len, r, club, droop, uvAt) => {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      pts.push(new THREE.Vector3(ox * (1 - u * 0.4), oy * (1 - u * 0.3) - u * u * droop, z0 + 0.004 + u * len));
    }
    const curve = new THREE.CatmullRomCurve3(pts), SEG = detail ? 12 : 4, RAD = detail ? 6 : 4;
    const tg = new THREE.TubeGeometry(curve, SEG, r, RAD, false), p = tg.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / (RAD + 1)) / SEG, c = curve.getPointAt(Math.min(1, seg));
      // Tapering to a point, or swelling into a club at the end of a tentacle.
      const k = club ? (seg > 0.78 ? 1.5 - Math.abs(seg - 0.9) * 4 : 0.55) : 1 - seg * 0.85;
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(c).multiplyScalar(k);
      p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
    }
    const u = [];
    for (let i = 0; i < p.count; i++) u.push(...uvAt);
    B.add(0, Array.from(p.array), u, Array.from(tg.index.array));
    tg.dispose();
  };
  const w0 = wid(0) * 0.8, h0 = ht(0) * 0.8;
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2 + Math.PI / 8;
    limb(Math.cos(ang) * w0, Math.sin(ang) * h0, A.armLen * (k === 2 || k === 5 ? 0.75 : 1), 0.006, false, 0.012, [0.02, 0.5]);
  }
  if (detail) for (const s of [1, -1]) limb(s * w0 * 0.4, -h0 * 0.6, A.armLen * A.tentacle, 0.0035, true, 0.02, [0.02, 0.4]);
  // Big eyes on the sides of the head.
  const e = A.eye, t = e.t;
  for (const side of [1, -1]) eyeMesh(B, [side * (wid(t) - 0.002), e.y, zOf(t)], new THREE.Vector3(side, 0.1, 0.15), e.r, 0.55, detail ? 16 : 8);
  return B.build();
}

/* ---------------- body plan: octopus ---------------- */

// An octopus crawling over the seabed: a soft mantle bag behind and above the head, eyes on
// raised turrets, and eight arms spreading from beneath the head in a loose star, curling at the
// tips (the side arms longest).
function buildOctopus(A, detail) {
  const B = new Builder(A.colors.fin);
  const NU = detail ? 24 : 10, NV = detail ? 18 : 8;
  // The mantle: a stretched, slightly drooping sphere leaning back from the head.
  const M = A.mantle;
  {
    const pos = [], uv = [], idx = [];
    for (let i = 0; i <= NV; i++) {
      const v = i / NV, ph = v * Math.PI;
      for (let j = 0; j <= NU; j++) {
        const u = j / NU, th = u * Math.PI * 2;
        const sx = Math.sin(ph) * Math.cos(th), sy = Math.cos(ph), sz = Math.sin(ph) * Math.sin(th);
        // ph from the top; th round: the bag is longer towards the back (-z) and sags a little.
        const back = sz < 0 ? 1 + 0.35 * -sz : 1;
        let x = sx * M.w, y = sy * M.h, z = sz * M.l * back;
        y -= (1 - sy) * 0.006 * back;
        pos.push(x, M.y + y + (-z) * M.lean, M.z + z);
        uv.push(0.2 + (0.5 - z / (M.l * 2.7)) * 0.6, (sy + 1) / 2);
      }
    }
    for (let i = 0; i < NV; i++) for (let j = 0; j < NU; j++) {
      const a = i * (NU + 1) + j, b = a + NU + 1;
      idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    B.add(0, pos, uv, idx);
  }
  // Eight arms from under the head, spreading and curling.
  const SEG = detail ? 18 : 6, RAD = detail ? 7 : 4;
  for (let k = 0; k < 8; k++) {
    const ang = (k / 8) * Math.PI * 2 + Math.PI / 8; // round the head, from the front
    const len = A.arm * [0.82, 0.95, 1.05, 1, 1, 1.05, 0.95, 0.82][k] * (A.armVar ? 1 + 0.08 * Math.sin(k * 2.3) : 1);
    const curl = (k % 2 ? 1 : -1) * (0.9 + 0.3 * Math.sin(k * 1.7));
    const pts = [];
    for (let i = 0; i <= 10; i++) {
      const u = i / 10, r = 0.03 + u * len, a2 = ang + curl * u * u * 0.9;
      const lift = Math.sin(u * Math.PI) * 0.025 + (u > 0.8 ? (u - 0.8) * 0.12 : 0);
      pts.push(new THREE.Vector3(Math.sin(a2) * r, A.base + lift - u * 0.01, A.headZ + Math.cos(a2) * r * 0.9));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const tg = new THREE.TubeGeometry(curve, SEG, A.armR, RAD, false), p = tg.attributes.position;
    // Skin from the arm's base to its tip: brown above, the pale suckers beneath.
    const u = [];
    for (let i = 0; i < p.count; i++) {
      const seg = Math.floor(i / (RAD + 1)) / SEG, c = curve.getPointAt(Math.min(1, seg));
      const v = new THREE.Vector3(p.getX(i), p.getY(i), p.getZ(i)).sub(c);
      const under = v.y < -A.armR * 0.35;
      // Thick at the base, tapering to a fine tip, flattened a little against the seabed.
      v.multiplyScalar(1 - Math.pow(seg, 0.8) * 0.88);
      v.y *= 0.8;
      p.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
      u.push(0.62 + seg * 0.36, under ? 0.08 : 0.62);
    }
    B.add(0, Array.from(p.array), u, Array.from(tg.index.array));
    tg.dispose();
  }
  // The web between the arms' bases, and the head: a low dome where the arms meet.
  {
    const s = new THREE.SphereGeometry(A.head, detail ? 18 : 8, detail ? 10 : 5, 0, Math.PI * 2, 0, Math.PI * 0.62);
    s.scale(1, 0.6, 1);
    s.translate(0, A.base + 0.006, A.headZ);
    const u = [];
    for (let i = 0; i < s.attributes.position.count; i++) u.push(0.55, 0.6);
    B.add(0, Array.from(s.attributes.position.array), u, Array.from(s.index.array));
    s.dispose();
  }
  // Eyes on raised bumps either side of the head.
  for (const side of [1, -1]) {
    eyeMesh(B, [side * A.eye.x, A.eye.y, A.eye.z], new THREE.Vector3(side, 0.55, 0.25), A.eye.r, 0.6, detail ? 14 : 8);
  }
  return B.build();
}

/* ---------------- recipes ---------------- */

// Built from FishBase/DORIS descriptions of each species (see register.js for sources): body
// depth and shape, fin counts and positions, tail shape, mouth, eye, and the marks that tell it
// from its look-alikes.
export const ANATOMY = {
  // European sea bass, Dicentrarchus labrax: elongate and moderately compressed; two separate
  // dorsal fins (the first spiny); slightly forked tail; large terminal mouth; two flat spines on
  // the gill cover with a dark spot on its upper edge; silver with a grey-blue back.
  seabass: {
    plan: 'fish', bodyLen: 0.8, round: 2.3, mode: 0,
    top: [[0, 0.006], [0.04, 0.028], [0.1, 0.05], [0.2, 0.085], [0.35, 0.112], [0.55, 0.1], [0.75, 0.06], [0.9, 0.036], [1, 0.032]],
    bottom: [[0, -0.01], [0.04, -0.026], [0.1, -0.05], [0.2, -0.078], [0.4, -0.092], [0.6, -0.08], [0.78, -0.048], [0.92, -0.032], [1, -0.028]],
    width: [[0, 0.004], [0.08, 0.034], [0.25, 0.058], [0.45, 0.06], [0.7, 0.04], [0.9, 0.018], [1, 0.012]],
    mouth: { len: 0.13, y: -0.004, slope: -0.09, gape: 0.012 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.085, y: 0.026, r: 0.019, iris: '#cdbf90' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.47, h: 0.095, spines: 9, profile: [[0, 0.75], [0.25, 1], [1, 0.45]] },
      { kind: 'dorsal', t0: 0.52, t1: 0.72, h: 0.075, profile: [[0, 0.85], [0.2, 1], [0.8, 0.55], [1, 0.3]], rays: 13 },
      { kind: 'anal', t0: 0.6, t1: 0.75, h: 0.06, profile: [[0, 0.8], [0.3, 1], [1, 0.35]], rays: 12 },
      { kind: 'pectoral', t: 0.25, a: 0.16, len: 0.1, splay: 0.45, droop: 0.2 },
      { kind: 'pelvic', t: 0.3, a: 0.04, len: 0.065, splay: 0.3, droop: 0.45, profile: [[0, 0.4], [0.4, 0.9], [1, 0.1]] },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.22, rays: 17 },
    ],
    colors: { back: '#3e4e5c', flank: '#b9c3ca', belly: '#f1f3f1', fin: '#8d979f', split: 0.42 },
    scaleRows: [70, 18], metal: 0.28, sheen: 0.45,
    paint: (P) => {
      // Darker head top, the lateral line, and the dark spot on the gill cover.
      P.line([[0.22, 0.7], [0.35, 0.74], [0.6, 0.72], [0.85, 0.6], [1, 0.55]], 2, '#4d5a64', 0.6);
      P.blob(0.205, 0.72, 0.014, 0.07, '#2c3238', 0.85, 0.4);
      P.line([[0.215, 0.82], [0.2, 0.62], [0.215, 0.4], [0.235, 0.3]], 2, '#6f7a82', 0.6);
      P.noise(11, 60, '#ffffff', 0.12, 0.012, 0.02, 0.2, 0.6);
    },
  },

  // Meagre, Argyrosomus regius: a big, elongate sciaenid; first dorsal spiny and triangular, the
  // second long and soft, joined by a deep notch; tail truncate to slightly diamond-shaped; large
  // head and mouth with a golden-yellow inside; the lateral line clear and running out onto the
  // tail; silver-grey with a bronze sheen, fins reddish-brown.
  meagre: {
    plan: 'fish', bodyLen: 0.82, round: 2.4, mode: 0,
    top: [[0, 0.01], [0.03, 0.035], [0.08, 0.055], [0.18, 0.085], [0.32, 0.1], [0.5, 0.095], [0.72, 0.065], [0.9, 0.034], [1, 0.03]],
    bottom: [[0, -0.012], [0.03, -0.03], [0.08, -0.05], [0.2, -0.08], [0.4, -0.09], [0.6, -0.078], [0.78, -0.05], [0.92, -0.03], [1, -0.027]],
    width: [[0, 0.004], [0.08, 0.036], [0.25, 0.058], [0.45, 0.058], [0.7, 0.038], [0.9, 0.017], [1, 0.012]],
    mouth: { len: 0.13, y: -0.006, slope: -0.1, gape: 0.014 }, gill: { t: 0.24, curve: 0.035 },
    eye: { t: 0.08, y: 0.028, r: 0.016, iris: '#c9a35a' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.43, h: 0.075, spines: 9, profile: [[0, 0.7], [0.3, 1], [1, 0.3]] },
      { kind: 'dorsal', t0: 0.44, t1: 0.8, h: 0.05, profile: [[0, 0.6], [0.1, 1], [0.85, 0.85], [1, 0.4]], rays: 26 },
      { kind: 'anal', t0: 0.68, t1: 0.78, h: 0.05, profile: [[0, 0.9], [0.4, 1], [1, 0.35]], rays: 8 },
      { kind: 'pectoral', t: 0.26, a: 0.16, len: 0.11, splay: 0.4, droop: 0.25 },
      { kind: 'pelvic', t: 0.31, a: 0.04, len: 0.07, splay: 0.3, droop: 0.45 },
      { kind: 'caudal', shape: 'truncate', h: 0.085, rays: 17 },
    ],
    colors: { back: '#5f5c50', flank: '#c4c3bb', belly: '#efece6', fin: '#8f5e48', split: 0.45 },
    scaleRows: [60, 15], metal: 0.22, sheen: 0.4,
    paint: (P) => {
      // Bronze back, and the lateral line arching over the pectoral then running straight out.
      P.band(0.78, 1, '#7a6440', 0.28);
      P.line([[0.24, 0.72], [0.35, 0.78], [0.5, 0.74], [0.7, 0.6], [0.9, 0.52], [1, 0.5]], 3, '#3e3a30', 0.75);
      P.blob(0.27, 0.43, 0.02, 0.06, '#3a2a22', 0.55, 0.5); // dark axil of the pectoral fin
      P.line([[0.0, 0.42], [0.12, 0.38]], 3, '#d9b34a', 0.7); // golden mouth lining showing at the lips
      P.noise(23, 80, '#d8b88a', 0.1, 0.01, 0.02, 0.35, 0.75);
    },
  },

  // Gilthead seabream, Sparus aurata: oval, deep and strongly compressed; a steep, curved head;
  // a golden band between the eyes; a dark blotch where the lateral line begins, on the upper
  // gill cover; a reddish patch low on the gill cover; thin dark lines along the flanks; one long
  // dorsal fin; deeply forked tail with dark tips.
  gilthead: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0,
    top: [[0, -0.004], [0.04, 0.03], [0.12, 0.1], [0.25, 0.16], [0.42, 0.17], [0.62, 0.13], [0.82, 0.06], [1, 0.035]],
    bottom: [[0, -0.016], [0.06, -0.06], [0.18, -0.11], [0.35, -0.13], [0.55, -0.115], [0.75, -0.07], [0.9, -0.038], [1, -0.03]],
    width: [[0, 0.005], [0.08, 0.03], [0.25, 0.045], [0.45, 0.044], [0.7, 0.03], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.07, y: -0.012, slope: -0.05, gape: 0.01 }, gill: { t: 0.24, curve: 0.04 },
    eye: { t: 0.11, y: 0.038, r: 0.019, iris: '#d8c070' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.28, t1: 0.58, h: 0.08, spines: 11, profile: [[0, 0.6], [0.2, 1], [1, 0.75]] },
      { kind: 'dorsal', t0: 0.58, t1: 0.8, h: 0.06, profile: [[0, 0.95], [0.3, 1], [1, 0.4]], rays: 13 },
      { kind: 'anal', t0: 0.6, t1: 0.8, h: 0.055, profile: [[0, 0.9], [0.3, 1], [1, 0.4]], rays: 11 },
      { kind: 'pectoral', t: 0.28, a: 0.14, len: 0.15, splay: 0.35, droop: 0.15, profile: [[0, 0.3], [0.25, 0.9], [0.7, 0.55], [1, 0.02]] },
      { kind: 'pelvic', t: 0.33, a: 0.04, len: 0.065, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'forked', h: 0.13, fork: 0.32, rays: 17 },
    ],
    colors: { back: '#55606a', flank: '#c3c8cb', belly: '#f0f0ec', fin: '#7d8a94', split: 0.4 },
    scaleRows: [46, 16], metal: 0.3, sheen: 0.45,
    paint: (P) => {
      // Thin dark longitudinal lines along the flanks.
      for (let k = 0; k < 7; k++) {
        const v = 0.35 + k * 0.08;
        P.line([[0.25, v], [0.5, v + 0.02], [0.8, v - 0.04], [1, v - 0.08]], 1.4, '#59636b', 0.35);
      }
      // The gold band across the forehead between the eyes, edged dark.
      P.band(0.86, 1, '#2f3438', 0.35, 0.08, 0.16);
      P.line([[0.12, 1], [0.11, 0.92], [0.1, 0.84], [0.095, 0.8]], 13, '#e3b53a', 0.95);
      // The dark blotch at the start of the lateral line, and the reddish patch below it.
      P.blob(0.235, 0.76, 0.02, 0.07, '#24282c', 0.9, 0.35);
      P.blob(0.22, 0.52, 0.018, 0.07, '#b0503a', 0.55, 0.6);
    },
    finEdge: '#2a2f33',
  },

  // Atlantic mackerel, Scomber scombrus: fusiform, round in section, pointed snout; two dorsal
  // fins far apart; five finlets above and below the tail stalk; small keels; deeply forked tail;
  // green-blue back with dark wavy bars down to about the lateral line, silvery-white below with
  // no spots (the chub mackerel has spots on its lower flanks).
  mackerel: {
    plan: 'fish', bodyLen: 0.82, round: 2.05, mode: 0,
    top: [[0, 0.002], [0.06, 0.03], [0.2, 0.06], [0.38, 0.068], [0.6, 0.05], [0.8, 0.026], [0.94, 0.016], [1, 0.016]],
    bottom: [[0, -0.004], [0.07, -0.03], [0.22, -0.055], [0.42, -0.06], [0.62, -0.045], [0.8, -0.024], [0.94, -0.015], [1, -0.015]],
    width: [[0, 0.003], [0.08, 0.03], [0.3, 0.054], [0.55, 0.048], [0.8, 0.024], [1, 0.012]],
    mouth: { len: 0.11, y: -0.004, slope: -0.04, gape: 0.008 }, gill: { t: 0.2, curve: 0.03 },
    eye: { t: 0.075, y: 0.016, r: 0.016, iris: '#d7d1c0' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.42, h: 0.055, spines: 11, profile: [[0, 0.85], [0.3, 1], [1, 0.25]] },
      { kind: 'dorsal', t0: 0.6, t1: 0.67, h: 0.035, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 10 },
      { kind: 'anal', t0: 0.62, t1: 0.69, h: 0.03, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 10 },
      { kind: 'finlets', t0: 0.7, step: 0.045, count: 5, h: 0.018 },
      { kind: 'keel', t: 0.93, len: 0.06, h: 0.006 },
      { kind: 'pectoral', t: 0.22, a: 0.2, len: 0.07, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.26, a: 0.05, len: 0.05, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.12, fork: 0.55, rays: 20 },
    ],
    colors: { back: '#2f5f63', flank: '#c8d2d2', belly: '#f6f7f4', fin: '#6f7d74', split: 0.48 },
    scaleRows: null, metal: 0.38, sheen: 0.7,
    paint: (P) => {
      // Iridescent blue-green on the back, and the dark wavy bars.
      P.band(0.62, 1, '#2b6a74', 0.45);
      const x = P.x;
      x.save();
      x.strokeStyle = '#122226';
      x.lineWidth = 4.5;
      x.globalAlpha = 0.9;
      for (let k = 0; k < 30; k++) {
        const u0 = 0.17 + k * 0.028;
        x.beginPath();
        for (let s = 0; s <= 10; s++) {
          const v = 1 - s * 0.05;
          const u = u0 + Math.sin(s * 1.3 + k) * 0.01 + s * 0.006;
          const px = u * P.W, py = (1 - v) * P.H;
          s ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      x.restore();
      P.band(0.5, 0.62, '#9ab8b0', 0.25);
      P.line([[0.2, 0.62], [0.6, 0.58], [1, 0.52]], 1.5, '#3a5a58', 0.6);
    },
  },

  // Common sole, Solea solea: an oblong oval flatfish with both eyes on its right side (the top
  // as it lies); greyish to dark brown with darker blotches; the pectoral fin on the eyed side has
  // a black patch at its tip; the dorsal fin starts on the head ahead of the eyes, and dorsal
  // and anal fins are joined to the tail by a membrane.
  sole: {
    plan: 'flat', bodyLen: 0.89, mode: 1, belly: 0.4,
    width: [[0, 0.02], [0.06, 0.09], [0.2, 0.15], [0.45, 0.165], [0.7, 0.135], [0.9, 0.075], [1, 0.04]],
    thick: [[0, 0.01], [0.1, 0.026], [0.35, 0.034], [0.7, 0.026], [0.92, 0.01], [1, 0.002]],
    fringe: { t0: 0.02, w: 0.035 },
    pectoral: { t: 0.2, x: 0.07, len: 0.065 },
    eyes: [{ t: 0.07, x: 0.018, r: 0.011 }, { t: 0.105, x: 0.035, r: 0.011 }],
    eye: { iris: '#c9b07a' },
    colors: { back: '#6b5843', flank: '#7b6650', belly: '#efe9dc', fin: '#5e4a36' },
    metal: 0.04, sheen: 0.18, finOpacity: 0.97,
    paint: (P) => {
      // Upper half of the canvas is the eyed side: mottled brown with darker blotches.
      P.band(0.5, 1, '#7a6550', 1);
      P.noise(5, 160, '#4e3d2c', 0.45, 0.025, 0.04, 0.52, 0.98);
      P.noise(9, 90, '#9a8468', 0.35, 0.02, 0.035, 0.52, 0.98);
      // The black patch on the tip of the eyed-side pectoral fin is painted on its fin.
      P.band(0, 0.5, '#efe9dc', 1);
      P.noise(13, 40, '#e2dacb', 0.5, 0.02, 0.03, 0.02, 0.48);
      P.line([[0.0, 0.62], [0.05, 0.58]], 3, '#3a2e22', 0.6); // the small curved mouth
    },
    pectoralSpot: '#121010',
  },

  // Common cuttlefish, Sepia officinalis: an oval, flattened mantle fringed by a narrow fin all
  // round; a broad head with large eyes and W-shaped pupils; eight short arms (the two long
  // tentacles stay hidden in their pockets); mottled brown with pale spots, and in mature males
  // a zebra pattern of dark bands across the back.
  cuttlefish: {
    plan: 'cuttle', mode: 3,
    width: [[0, 0.04], [0.06, 0.085], [0.14, 0.09], [0.2, 0.12], [0.45, 0.165], [0.75, 0.13], [0.92, 0.07], [1, 0.012]],
    top: [[0, 0.03], [0.1, 0.05], [0.2, 0.055], [0.45, 0.075], [0.75, 0.06], [0.95, 0.025], [1, 0.006]],
    bottom: [[0, -0.02], [0.1, -0.035], [0.2, -0.035], [0.45, -0.045], [0.75, -0.035], [0.95, -0.012], [1, -0.004]],
    fin: { t0: 0.22, t1: 0.99, w: 0.04 },
    arm: 0.16,
    eye: { t: 0.1, y: 0.03, r: 0.03, iris: '#d6c08a', pupil: 'W' },
    colors: { back: '#5a4636', flank: '#9a7a5c', belly: '#ebe0d0', fin: '#d8c8b0', split: 0.35 },
    metal: 0.02, sheen: 0.25,
    paint: (P) => {
      // Zebra bands across the back of the mantle, pale spots, and the white line along the fin.
      const x = P.x;
      x.save();
      x.strokeStyle = '#2a1e16';
      x.lineWidth = 5;
      x.globalAlpha = 0.75;
      for (let k = 0; k < 16; k++) {
        const u = 0.24 + k * 0.045;
        x.beginPath();
        for (let s = 0; s <= 8; s++) {
          const v = 0.6 + s * 0.05;
          const px = (u + Math.sin(s * 1.4 + k) * 0.012) * P.W, py = (1 - v) * P.H;
          s ? x.lineTo(px, py) : x.moveTo(px, py);
        }
        x.stroke();
      }
      x.restore();
      P.noise(31, 70, '#f2e6cc', 0.5, 0.008, 0.016, 0.55, 0.95);
      P.band(0.47, 0.53, '#f2eadc', 0.6, 0.22, 1);
    },
  },
};

/* ---------------- materials and the swim ---------------- */

// How each body plan swims (in model space, z along the body):
//  0 fish: a travelling wave down the body, growing towards the tail
//  1 flatfish: an up-and-down ripple, with the fin fringe fluttering
//  2 eel: a long wave along the whole body, head included
//  3 cuttlefish: the fin frill rippling along its length, the arms swaying a little
//  4 tuna: a stiff body, the beat all in the tail stalk and crescent tail
//  5 squid: the fins rippling and flapping at the rear, the arms trailing
//  6 octopus: the arms rippling and curling as it crawls, the mantle breathing
const SWIM = {
  2: `float bend = 0.35 + 0.65 * smoothstep(0.45, -0.5, position.z);
      transformed.x += sin(sw.x - position.z * 13.0) * bend * (0.02 + sw.y * 0.045);`,
  4: `float bend = smoothstep(-0.02, -0.55, position.z);
      transformed.x += sin(sw.x - position.z * 4.0) * bend * bend * (0.03 + sw.y * 0.12);`,
  5: `float fin = smoothstep(0.03, 0.06, abs(position.x)) * step(position.z, 0.05);
      transformed.y += sin(sw.x * 1.4 + position.z * 18.0) * fin * (0.01 + sw.y * 0.03);
      float arm = smoothstep(0.26, 0.4, position.z);
      transformed.x += sin(sw.x * 0.9 + position.z * 10.0) * arm * 0.012;
      transformed.y += cos(sw.x * 0.8 + position.z * 8.0) * arm * 0.008;`,
  6: `float r = length(position.xz);
      float arm = smoothstep(0.07, 0.28, r) * (1.0 - smoothstep(0.02, 0.06, position.y));
      float ang = atan(position.x, position.z);
      transformed.y += sin(sw.x * 0.9 - r * 16.0 + ang * 2.0) * arm * (0.008 + sw.y * 0.02);
      transformed.xz += normalize(position.xz + vec2(1e-4)) * sin(sw.x * 0.7 + ang * 3.0) * arm * 0.012;
      float bag = smoothstep(0.03, 0.07, position.y);
      transformed *= 1.0 + bag * sin(sw.x * 0.45) * 0.03;`,
  0: `float bend = smoothstep(0.32, -0.6, position.z);
      transformed.x += sin(sw.x - position.z * 5.5) * bend * (0.025 + sw.y * 0.09);`,
  1: `float bend = smoothstep(0.35, -0.5, position.z);
      transformed.y += sin(sw.x - position.z * 5.0) * bend * (0.02 + sw.y * 0.05);
      transformed.y += sin(sw.x * 1.3 + position.z * 11.0) * 0.012 * smoothstep(0.11, 0.17, abs(position.x));`,
  3: `float frill = smoothstep(0.11, 0.17, abs(position.x)) * step(position.z, 0.12);
      transformed.y += sin(sw.x * 1.6 + position.z * 26.0) * frill * (0.012 + sw.y * 0.02);
      float arm = smoothstep(0.28, 0.42, position.z);
      transformed.x += sin(sw.x * 0.8 + position.z * 9.0) * arm * 0.012;
      transformed.y += cos(sw.x * 0.7 + position.z * 7.0) * arm * 0.01;`,
};

function patch(m, mode, instanced, sheen, key, swim) {
  m.userData.swim = swim;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uSwimU = m.userData.swim;
    shader.uniforms.uSheen = { value: sheen };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        ${instanced ? 'attribute vec2 aSwim;' : 'uniform vec2 uSwimU;'}`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec2 sw = ${instanced ? 'aSwim' : 'uSwimU'};
        ${SWIM[mode]}`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform float uSheen;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        // A soft sheen at glancing angles, and a little self-light so fish read underwater.
        float rim = pow(1.0 - clamp(dot(normalize(normal), normalize(vViewPosition)), 0.0, 1.0), 3.0);
        totalEmissiveRadiance += diffuseColor.rgb * (0.06 + rim * uSheen);`);
  };
  m.customProgramCacheKey = () => `anatomy-${key}-${mode}-${instanced ? 'i' : 's'}`;
  return m;
}

const SKINS = new Map();
// The three materials (body, fins, eyes) for a species.
export function anatomyMaterials(id, instanced) {
  const A = ANATOMY[id];
  if (!SKINS.has(id)) SKINS.set(id, paintSkin(A));
  const map = SKINS.get(id);
  const bump = scaleTexture().clone();
  bump.needsUpdate = true;
  bump.repeat.set(A.scaleRows ? A.scaleRows[0] / 4 : 1, A.scaleRows ? A.scaleRows[1] / 4 : 1);
  const body = new THREE.MeshStandardMaterial({
    map, roughness: A.plan === 'fish' || A.plan === 'flat' ? 0.36 : 0.6, metalness: A.metal ?? 0.2,
    bumpMap: A.scaleRows ? bump : null, bumpScale: A.scaleRows ? 0.35 : 0, side: THREE.FrontSide,
  });
  if (A.plan !== 'fish') body.side = THREE.DoubleSide;
  // (The fins' colours are in the geometry: each fin can have its own, and its edge another.)
  const fins = new THREE.MeshStandardMaterial({
    color: '#ffffff', vertexColors: true, map: finTexture(), transparent: true, opacity: A.finOpacity ?? 0.88, side: THREE.DoubleSide,
    depthWrite: false, roughness: 0.55, metalness: 0,
  });
  const eyes = new THREE.MeshStandardMaterial({ map: eyeTexture(A.eye?.iris || '#c9b37a', A.eye?.pupil), roughness: 0.08, metalness: 0.15 });
  // One swim phase for all three, so fins and eyes move with the body.
  const swim = { value: new THREE.Vector2(0, 0.3) };
  return [patch(body, A.mode, instanced, A.sheen ?? 0.35, `${id}-b`, swim), patch(fins, A.mode, instanced, 0.1, 'f', swim), patch(eyes, A.mode, instanced, 0.2, 'e', swim)];
}

const GEOS = new Map();
// The geometry for a species ('high' near, 'low' far); built once and shared.
export function anatomyGeometry(id, detail = true) {
  const key = `${id}|${detail ? 'h' : 'l'}`;
  if (GEOS.has(key)) return GEOS.get(key);
  const A = ANATOMY[id];
  const geo = { flat: buildFlat, cuttle: buildCuttle, squid: buildSquid, octopus: buildOctopus }[A.plan]?.(A, detail) ?? buildFish(A, detail);
  GEOS.set(key, geo);
  return geo;
}

export const hasAnatomy = (id) => !!ANATOMY[id];

// The Atlantic roster's recipes live in their own module, and so do Las Brasas' fish and the
// big game of the open ocean.
Object.assign(ANATOMY, ATLANTIC_ANATOMY, SOUTH_ANATOMY, BIG_ANATOMY);
