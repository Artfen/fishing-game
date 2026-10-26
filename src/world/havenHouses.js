import * as THREE from 'three';
import { heightAt, HAVEN_HOUSES } from './terrain.js';
import { mergeParts, mat, pick, glowTexture, clamp, smoothstep } from '../util.js';
import { withSurface } from './surface.js';

// Willowhaven's buildings, one by one and each its own: the chandlery (green weatherboard, a shop
// window, buoys on the wall), The Lobster Pot (whitewashed, a black plinth, sash windows, its sign,
// lanterns and hanging baskets, benches out front), the net store (tarred black boards, red double
// doors, nets drying), and three cottages up the slope (colour-washed, shutters, window boxes,
// a porch hood over the door). Every face you can see has its windows; every building stands on a
// stone plinth, with quoins at the corners, a roof with real thickness, fascias and a ridge, and
// chimneys with pots. The ones that stand at the harbour's level are cut into the bank behind
// them, with dry-stone walls holding it back.
//
// Two you can walk into: the chandlery (Bert's counter, the shelves and the rod rack, bait and
// ice, the dive compressor) and The Lobster Pot (Ruth's bar, the fire, the tables, the kitchen
// behind its pass). Like the house at home, while you're inside the roof lifts away (and the
// upstairs, and the wall between you and the camera), so you can see what you're doing.
//
// Everything is made here from simple shapes and canvas pictures.

const T = 0.24;             // wall thickness
const DOOR_W = 1.2, DOOR_H = 2.1;
export const ROOM_H = 2.75; // the ground floor's ceiling, in the two you can walk into
const LAMPS = ['#ffe8c8', '#ffe0b8', '#fff0d8'];
const STONE = ['#a59d90', '#9a9286', '#b0a898', '#8f887d'];
const ROOF = ['#4d5157', '#565b62', '#474b50'];
const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const wood = () => withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' });
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);

function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}
function textTexture(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = (...a) => {
    draw(c.getContext('2d'), w, h, ...a);
    tex.needsUpdate = true;
  };
  paint();
  document.fonts?.ready?.then(() => paint()).catch(() => {});
  return { tex, canvas: c, paint };
}
const signPainter = (bg, edge, ink, title, sub, titleSize = 54) => (ctx, w, h) => {
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = edge;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, w - 16, h - 16);
  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${titleSize}px Kalam, Caveat, cursive`;
  ctx.fillText(title, w / 2, h * 0.42);
  ctx.font = '600 24px Kalam, Caveat, cursive';
  ctx.fillText(sub, w / 2, h * 0.79);
};

/* ---------------- the two you can walk into ---------------- */

const byId = (id) => HAVEN_HOUSES.find((b) => b.id === id);
// Each room: the inside faces of its walls, its floor, and its front door (x of its middle).
export const HAVEN_ROOMS = Object.fromEntries(['chandlery', 'inn'].map((id) => {
  const b = byId(id);
  return [id, { id, x0: b.x - b.w / 2 + T, x1: b.x + b.w / 2 - T, z0: b.z - b.d / 2 + T, z1: b.z + b.d / 2 - T, y: b.pad, doorX: b.x + (b.doorX ?? 0), front: b.z + b.d / 2 }];
}));
// Which of them (x, z) is inside, if either.
export function insideHaven(x, z) {
  for (const R of Object.values(HAVEN_ROOMS)) if (x > R.x0 - 0.05 && x < R.x1 + 0.05 && z > R.z0 - 0.05 && z < R.z1 + 0.05) return R.id;
  return null;
}
const CH = HAVEN_ROOMS.chandlery, INN = HAVEN_ROOMS.inn;
// The things inside you use (where you stand for each, and a word).
export const ROOM_SPOTS = [
  { id: 'counter', room: 'chandlery', x: CH.x0 + 4.6, z: CH.z0 + 2.75, r: 1.0, name: 'Bert’s counter' },
  { id: 'tackle', room: 'chandlery', x: CH.x0 + 0.95, z: CH.z0 + 2.2, r: 1.0, name: 'the tackle' },
  { id: 'air', room: 'chandlery', x: CH.x1 - 0.95, z: CH.z1 - 1.05, r: 0.9, name: 'the dive compressor' },
  { id: 'bar', room: 'inn', x: INN.x0 + 3.85, z: INN.z0 + 2.15, r: 1.0, name: 'the bar' },
  { id: 'pass', room: 'inn', x: INN.x1 - 2.6, z: INN.z0 + 2.75, r: 0.9, name: 'the kitchen pass' },
  // (The east chair at the west table, facing across it to the window; the fire end of the settle.)
  { id: 'tableW', room: 'inn', x: INN.x0 + 2.55, z: INN.z1 - 1.2, r: 0.8, name: 'a table by the window', seat: { x: INN.x0 + 2.3, z: INN.z1 - 0.8, heading: -Math.PI / 2 } },
  { id: 'fire', room: 'inn', x: INN.x0 + 1.15, z: INN.z0 + 1.6, r: 0.8, name: 'the settle by the fire', seat: { x: INN.x0 + 1.62, z: INN.z0 + 1.75, heading: -Math.PI / 2 } },
];
// Where the harbour's people stand or sit inside (see townsfolk.js), and the way in from the
// door: via [outside the door, just inside it].
// (inner: the way round the furniture from just inside the door: behind the counter and the bar by
// their far ends, round the tables to the chairs on their far side.)
const viaOf = (R) => [{ x: R.doorX, z: R.front + 1.2 }, { x: R.doorX, z: R.z1 - 0.6 }];
export const ROOM_WAY = { chandlery: viaOf(CH), inn: viaOf(INN) };
const behind = (R, endX, farX, z) => [{ x: (endX + farX) / 2, z: R.z0 + 2.3 }, { x: (endX + farX) / 2, z }];
export const ROOM_PLACES = {
  shopCounter: { x: CH.x0 + 4.6, z: CH.z0 + 0.65, yaw: 0, via: ROOM_WAY.chandlery, inner: behind(CH, CH.x0 + 6.05, CH.x1, CH.z0 + 0.65) },
  innBar: { x: INN.x0 + 3.6, z: INN.z0 + 0.55, yaw: 0, via: ROOM_WAY.inn, inner: behind(INN, INN.x0 + 5.3, INN.x1 - 1.95, INN.z0 + 0.55) },
  innBarFront: { x: INN.x0 + 2.75, z: INN.z0 + 2.05, yaw: Math.PI, via: ROOM_WAY.inn, inner: [{ x: INN.x0 + 2.75, z: INN.z0 + 2.9 }] },
  innTableW: { x: INN.x0 + 0.8, z: INN.z1 - 0.8, yaw: Math.PI / 2, via: ROOM_WAY.inn, inner: [{ x: INN.x0 + 1.55, z: INN.z1 - 1.65 }, { x: INN.x0 + 0.8, z: INN.z1 - 1.65 }] },
  innTableE: { x: INN.x1 - 0.85, z: INN.z1 - 0.8, yaw: -Math.PI / 2, via: ROOM_WAY.inn, inner: [{ x: INN.x1 - 1.6, z: INN.z1 - 1.65 }, { x: INN.x1 - 0.85, z: INN.z1 - 1.65 }] },
  innSettle: { x: INN.x0 + 1.62, z: INN.z0 + 2.4, yaw: -Math.PI / 2, via: ROOM_WAY.inn, inner: [{ x: INN.x0 + 1.15, z: INN.z0 + 3.2 }] },
};

/* ---------------- a building's parts, in its own frame ---------------- */

// lx across the front (to the right as you face it), ly up from its floor, lz out of the front.
function frame(b, y0) {
  // (The building's turn goes on last, so a part tilted in its own frame stays tilted in it.)
  const turn = new THREE.Matrix4().makeRotationY(b.yaw);
  const at = (lx, ly, lz, rx = 0, ry = 0, rz = 0, sx = 1, sy = sx, sz = sx) => {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    const m = turn.clone().multiply(mat(0, 0, 0, rx, ry, rz, sx, sy, sz));
    return m.setPosition(b.x + lx * c + lz * s, y0 + ly, b.z - lx * s + lz * c);
  };
  const world = (lx, lz) => {
    const c = Math.cos(b.yaw), s = Math.sin(b.yaw);
    return { x: b.x + lx * c + lz * s, z: b.z - lx * s + lz * c };
  };
  // A box lying flat on a side's face: u along the wall, y up, out from the face (outward +).
  const face = (side, u, y, out, ww, hh, dd, color, extra = {}) => {
    const hw = b.w / 2, hd = b.d / 2;
    const p = side === 'front' ? [u, hd + out] : side === 'back' ? [u, -hd - out] : side === 'left' ? [-hw - out, u] : [hw + out, u];
    return { geo: box(ww, hh, dd), matrix: at(p[0], y, p[1], 0, side === 'left' || side === 'right' ? Math.PI / 2 : 0, 0), color, ...extra };
  };
  return { at, world, face };
}

// The wall of one side, in pieces round its openings ({ a, b, bottom, top } along it).
function wallSide(F, b, side, openings, color, y0, y1) {
  const P = [];
  const along = side === 'front' || side === 'back' ? b.w : b.d;
  const piece = (u0, u1, v0, v1) => {
    if (u1 - u0 < 0.01 || v1 - v0 < 0.01) return;
    P.push(F.face(side, (u0 + u1) / 2, (v0 + v1) / 2, -T / 2, u1 - u0, v1 - v0, T, color));
  };
  const ops = openings.filter((o) => o.top > y0 && o.bottom < y1).sort((p, q) => p.a - q.a);
  let u = -along / 2;
  for (const o of ops) {
    piece(u, o.a, y0, y1);
    piece(o.a, o.b, y0, Math.max(y0, o.bottom));
    piece(o.a, o.b, Math.min(y1, o.top), y1);
    u = o.b;
  }
  piece(u, along / 2, y0, y1);
  return P;
}
// A window in a side: its frame and glazing bars (trim), a sill and a stone lintel, shutters on
// the cottages, and its glass (set back a little) into `glass`.
function windowParts(F, side, o, { trim = '#f1ece2', lintel = '#b9b1a3', shutters = null, sill = '#cfc8bb', bars = 'cross' } = {}, glass) {
  const P = [], w = o.b - o.a, h = o.top - o.bottom, u = (o.a + o.b) / 2, y = (o.bottom + o.top) / 2;
  P.push(F.face(side, u, o.top + 0.04, 0.02, w + 0.12, 0.08, 0.08, trim));
  P.push(F.face(side, u, o.bottom - 0.03, 0.02, w + 0.12, 0.06, 0.08, trim));
  P.push(F.face(side, o.a - 0.02, y, 0.02, 0.08, h + 0.1, 0.08, trim));
  P.push(F.face(side, o.b + 0.02, y, 0.02, 0.08, h + 0.1, 0.08, trim));
  if (bars === 'cross' || bars === 'sash') {
    P.push(F.face(side, u, y, -0.02, 0.05, h, 0.05, trim));
    P.push(F.face(side, u, bars === 'sash' ? y : y + h * 0.12, -0.02, w, 0.06, 0.06, trim));
  } else if (bars === 'shop') {
    for (const k of [-1, 1]) P.push(F.face(side, u + (k * w) / 6, y, -0.02, 0.05, h, 0.05, trim));
    P.push(F.face(side, u, o.bottom + h * 0.72, -0.02, w, 0.05, 0.05, trim));
  }
  P.push(F.face(side, u, o.bottom - 0.08, 0.06, w + 0.3, 0.07, 0.2, sill));
  if (lintel) P.push(F.face(side, u, o.top + 0.15, 0.03, w + 0.34, 0.16, 0.08, lintel));
  if (shutters) for (const k of [-1, 1]) P.push(F.face(side, u + k * (w / 2 + 0.06 + w / 4), y, 0.04, w / 2, h + 0.06, 0.04, shutters, { jitter: 0.04 }));
  glass.push(F.face(side, u, y, -0.09, w, h, 0.02, LAMPS[(Math.abs(Math.round(u * 7 + y * 3))) % LAMPS.length]));
  return P;
}
// A door's frame, step and (static) leaf with its panels.
function doorParts(F, side, o, { trim = '#f1ece2', leaf = '#3a4a4a', step = '#9a9286', fan = false, leafToo = true } = {}, glass) {
  const P = [], w = o.b - o.a, u = (o.a + o.b) / 2;
  P.push(F.face(side, u, o.top + 0.06, 0.02, w + 0.24, 0.12, 0.1, trim));
  P.push(F.face(side, o.a - 0.05, o.top / 2, 0.02, 0.1, o.top, 0.1, trim));
  P.push(F.face(side, o.b + 0.05, o.top / 2, 0.02, 0.1, o.top, 0.1, trim));
  P.push(F.face(side, u, -0.06, 0.25, w + 0.5, 0.14, 0.5, step, { jitter: 0.03 }));
  if (fan) glass.push(F.face(side, u, o.top - 0.22, -0.05, w - 0.1, 0.32, 0.02, '#fff0d8'));
  if (leafToo) {
    P.push(F.face(side, u, (o.top - (fan ? 0.42 : 0)) / 2, -0.06, w - 0.04, o.top - (fan ? 0.42 : 0), 0.06, leaf));
    for (const k of [-1, 1]) {
      P.push(F.face(side, u + (k * w) / 4.4, o.top * 0.3, -0.02, w * 0.32, o.top * 0.32, 0.02, leaf, { jitter: 0.06 }));
      P.push(F.face(side, u + (k * w) / 4.4, o.top * 0.66, -0.02, w * 0.32, o.top * 0.26, 0.02, leaf, { jitter: 0.06 }));
    }
    P.push(F.face(side, u + w * 0.36, 1.0, 0.0, 0.05, 0.05, 0.08, '#c9a65a'));
  }
  return P;
}
// The gable roof: two slopes with real thickness, a ridge cap, fascias along the eaves and
// bargeboards up the gables; and the gable-end triangles of wall under it.
function roofParts(F, b, wallH, rise, { roof = '#4d5157', trim = '#efe9df', wall }) {
  const R = [], W = [];
  const ox = 0.3, oz = 0.35, hd = b.d / 2, pitch = Math.atan2(rise, hd);
  const ye = wallH - oz * Math.tan(pitch), L = Math.hypot(hd + oz, rise + oz * Math.tan(pitch)), th = 0.13;
  for (const s of [-1, 1]) {
    const mz = (s * (hd + oz)) / 2, my = (ye + wallH + rise) / 2;
    R.push({ geo: box(b.w + 2 * ox, th, L), matrix: F.at(0, my + th / 2 * Math.cos(pitch), mz + (s * th) / 2 * Math.sin(pitch), s * pitch, 0, 0), color: roof, jitter: 0.04 });
    R.push({ geo: box(b.w + 2 * ox, 0.2, 0.05), matrix: F.at(0, ye - 0.04, s * (hd + oz + 0.02)), color: trim });
    for (const g of [-1, 1]) R.push({ geo: box(0.05, 0.2, L), matrix: F.at(g * (b.w / 2 + ox + 0.01), my - 0.02, mz, s * pitch, 0, 0), color: trim });
  }
  R.push({ geo: box(b.w + 2 * ox + 0.04, 0.12, 0.26), matrix: F.at(0, wallH + rise + 0.1, 0), color: '#3e4146' });
  // The gable ends, flush with the side walls.
  for (const g of [-1, 1]) {
    const geo = new THREE.BufferGeometry();
    const x = g * (b.w / 2) - g * 0.001;
    const v = g > 0 ? [x, 0, hd, x, 0, -hd, x, rise, 0] : [x, 0, -hd, x, 0, hd, x, rise, 0];
    geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    W.push({ geo, matrix: F.at(0, wallH, 0), color: wall, jitter: 0.03 });
  }
  return { roof: R, gables: W };
}
// A chimney stack on the ridge line (at lx), with its cap course and pots.
function chimneyParts(F, lx, lz, base, h, n = 2) {
  return [
    { geo: box(0.7, h, 0.62), matrix: F.at(lx, base + h / 2, lz), color: '#8d8478', jitter: 0.04 },
    { geo: box(0.82, 0.12, 0.74), matrix: F.at(lx, base + h + 0.06, lz), color: '#a59d90' },
    ...Array.from({ length: n }, (_, i) => ({ geo: cyl(0.09, 0.11, 0.4, 8), matrix: F.at(lx + (i - (n - 1) / 2) * 0.28, base + h + 0.32, lz), color: '#b0613e' })),
  ];
}
// The plinth round the foot (hiding where the walls meet the ground) and quoins up the corners.
// (`low`: where the ground is lowest round the foot, down a slope, so the plinth always meets it.)
function plinthParts(F, b, color, h = 0.5, low = 0) {
  const P = [], y0 = Math.min(-0.6, low - 0.3), mid = (h + y0) / 2, hh = h - y0;
  for (const side of ['front', 'back']) P.push(F.face(side, 0, mid, 0.04, b.w + 0.1, hh, 0.1, color, { jitter: 0.03 }));
  for (const side of ['left', 'right']) P.push(F.face(side, 0, mid, 0.04, b.d + 0.1, hh, 0.1, color, { jitter: 0.03 }));
  return P;
}
function quoinParts(F, b, wallH, color, rnd) {
  const P = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    for (let y = 0.6, k = 0; y < wallH - 0.2; y += 0.32, k++) {
      const long = k % 2 === 0, l = long ? 0.42 : 0.26;
      P.push({ geo: box(long ? l : 0.1, 0.27, long ? 0.1 : l), matrix: F.at(sx * (b.w / 2 + 0.03) - sx * (long ? l / 2 - 0.05 : 0), y, sz * (b.d / 2 + 0.03) - sz * (long ? 0 : l / 2 - 0.05)), color, jitter: 0.05 });
      P.push({ geo: box(long ? 0.1 : l, 0.27, long ? l : 0.1), matrix: F.at(sx * (b.w / 2 + 0.03) - sx * (long ? 0 : l / 2 - 0.05), y, sz * (b.d / 2 + 0.03) - sz * (long ? l / 2 - 0.05 : 0)), color, jitter: 0.05 });
    }
  }
  return P;
}
// Weatherboard: the board edges, a shadow line every few inches, on clad walls.
function boardLines(F, b, side, wallH, color, openings) {
  const P = [], along = side === 'front' || side === 'back' ? b.w : b.d;
  for (let y = 0.45; y < wallH; y += 0.22) {
    let u = -along / 2;
    for (const o of [...openings].filter((q) => q.bottom < y && q.top > y).sort((p, q) => p.a - q.a)) {
      if (o.a - u > 0.05) P.push(F.face(side, (u + o.a) / 2, y, 0.012, o.a - u, 0.025, 0.02, color));
      u = o.b;
    }
    if (along / 2 - u > 0.05) P.push(F.face(side, (u + along / 2) / 2, y, 0.012, along / 2 - u, 0.025, 0.02, color));
  }
  return P;
}
// Dry-stone walls holding the bank back behind and beside a building cut into the slope, their
// tops following the ground (with coping), never stepped.
function retainingWalls(b, y, rnd, obstacles) {
  const P = [], m = (b.margin ?? 0.8) + 0.3;
  const F = frame(b, 0);
  const groundTop = (lx, lz, nx, nz) => {
    const p = F.world(lx + nx * 2.2, lz + nz * 2.2);
    return Math.max(y + 0.45, heightAt(p.x, p.z) - 0.15);
  };
  const run = (lx0, lz0, lx1, lz1, nx, nz) => {
    const len = Math.hypot(lx1 - lx0, lz1 - lz0), n = Math.max(2, Math.round(len / 1.1));
    for (let i = 0; i < n; i++) {
      const k0 = i / n, k1 = (i + 1) / n;
      const a = [lx0 + (lx1 - lx0) * k0, lz0 + (lz1 - lz0) * k0], c = [lx0 + (lx1 - lx0) * k1, lz0 + (lz1 - lz0) * k1];
      const t0 = groundTop(a[0], a[1], nx, nz), t1 = groundTop(c[0], c[1], nx, nz);
      if (Math.max(t0, t1) < y + 0.5) continue;
      // A segment with a sloping top: a box whose upper corners follow the ground.
      const geo = box(1, 1, 1), pos = geo.attributes.position;
      for (let v = 0; v < pos.count; v++) {
        const along = pos.getX(v) > 0 ? 1 : 0, top = pos.getY(v) > 0;
        const lx = a[0] + (c[0] - a[0]) * along, lz = a[1] + (c[1] - a[1]) * along;
        const off = pos.getZ(v) * 0.6;
        const w = F.world(lx + nx * off, lz + nz * off);
        pos.setXYZ(v, w.x, top ? (along ? t1 : t0) : y - 0.4, w.z);
      }
      geo.computeVertexNormals();
      P.push({ geo, color: pick(STONE, rnd), jitter: 0.05 });
      const cg = box(1, 1, 1), cp = cg.attributes.position;
      for (let v = 0; v < cp.count; v++) {
        const along = cp.getX(v) > 0 ? 1 : 0, top = cp.getY(v) > 0;
        const lx = a[0] + (c[0] - a[0]) * along, lz = a[1] + (c[1] - a[1]) * along;
        const off = cp.getZ(v) * 0.76;
        const w = F.world(lx + nx * off, lz + nz * off);
        cp.setXYZ(v, w.x, (along ? t1 : t0) + (top ? 0.12 : 0), w.z);
      }
      cg.computeVertexNormals();
      P.push({ geo: cg, color: '#b9b2a4', jitter: 0.03 });
      const mid = F.world((a[0] + c[0]) / 2, (a[1] + c[1]) / 2);
      obstacles.push({ x: mid.x, z: mid.z, r: 0.55, top: Math.max(t0, t1) + 0.1, kind: 'building', name: 'a stone wall' });
    }
  };
  run(-b.w / 2 - m, -b.d / 2 - m, b.w / 2 + m, -b.d / 2 - m, 0, -1);
  for (const sx of [-1, 1]) run(sx * (b.w / 2 + m), -b.d / 2 - m, sx * (b.w / 2 + m), b.d / 2 - 0.4, sx, 0);
  return P;
}

/* ---------------- each building ---------------- */

// What each building is like: its walls' height, its roof's rise, colours, and its openings on
// each side (u along the side, from the left as you face that side's outside).
function styleOf(b) {
  const W = b.w, D = b.d;
  if (b.kind === 'inn') {
    const dx = b.doorX ?? 0;
    return {
      wallH: 4.7, rise: 2.0, wall: b.color, trim: '#f4f0e6', plinth: '#2e2f31', quoin: '#9d968b', roof: '#454a50', door: b.door, sash: true,
      open: {
        front: [{ a: dx - DOOR_W / 2 - 0.1, b: dx + DOOR_W / 2 + 0.1, bottom: 0, top: DOOR_H + 0.25, door: true }, { a: -3.4, b: -1.8, bottom: 0.85, top: 2.2 }, { a: 1.8, b: 3.4, bottom: 0.85, top: 2.2 },
          { a: -3.25, b: -2.35, bottom: 3.2, top: 4.15 }, { a: -0.45, b: 0.45, bottom: 3.2, top: 4.15 }, { a: 2.35, b: 3.25, bottom: 3.2, top: 4.15 }],
        left: [{ a: 0.4, b: 1.4, bottom: 3.2, top: 4.1 }],
        right: [{ a: -0.9, b: 0.2, bottom: 1.0, top: 2.1 }, { a: -0.5, b: 0.5, bottom: 3.2, top: 4.1 }],
        back: [{ a: -1.2, b: -0.3, bottom: 3.3, top: 4.1 }],
      },
      chimneys: [-W / 2 + 0.45, W / 2 - 0.45],
    };
  }
  if (b.kind === 'chandlery') {
    const dx = b.doorX ?? 0;
    return {
      wallH: 2.85, rise: 1.45, wall: '#5f7f7c', trim: '#efe6d2', plinth: '#6f6a62', roof: '#3f4448', door: '#30484c', clad: '#4b6663',
      open: {
        front: [{ a: dx - DOOR_W / 2, b: dx + DOOR_W / 2, bottom: 0, top: DOOR_H, door: true }, { a: 0.0, b: 2.6, bottom: 0.7, top: 2.2, shop: true }],
        left: [{ a: -0.6, b: 0.4, bottom: 1.0, top: 2.0 }],
        right: [{ a: -1.2, b: -0.2, bottom: 1.0, top: 2.0 }],
        back: [],
      },
      chimneys: [W / 2 - 0.5],
    };
  }
  if (b.kind === 'store') {
    return {
      wallH: 2.7, rise: 1.25, wall: '#2b2724', trim: '#3a3330', plinth: '#55504a', roof: '#3a3a38', door: '#7a3a2a', clad: '#1f1c1a',
      open: {
        front: [{ a: -1.1, b: 1.1, bottom: 0, top: 2.2, door: true, double: true }],
        left: [{ a: -0.3, b: 0.5, bottom: 1.2, top: 1.9 }],
        right: [{ a: -0.4, b: 0.4, bottom: 1.2, top: 1.9 }],
        back: [],
      },
      chimneys: [],
    };
  }
  // A cottage: door in the middle, a window either side and one above; small ones on the ends
  // and at the back.
  return {
    wallH: 3.2, rise: 1.75, wall: b.color, trim: '#f4f0e6', plinth: '#7d776d', quoin: '#c9c1b2', roof: ROOF[Math.abs(Math.round(b.x)) % ROOF.length], door: b.door, shutters: b.door,
    open: {
      front: [{ a: -0.55, b: 0.55, bottom: 0, top: DOOR_H, door: true }, { a: -W / 2 + 0.85, b: -W / 2 + 1.85, bottom: 0.95, top: 2.1 }, { a: W / 2 - 1.85, b: W / 2 - 0.85, bottom: 0.95, top: 2.1 },
        { a: -0.45, b: 0.45, bottom: 2.35, top: 3.0 }],
      left: [{ a: -0.45, b: 0.45, bottom: 1.1, top: 2.0 }],
      right: [{ a: -0.4, b: 0.4, bottom: 1.1, top: 2.0 }],
      back: [{ a: -0.9, b: 0.0, bottom: 1.1, top: 1.9 }],
    },
    chimneys: [W / 2 - 0.6],
  };
}

export function buildHavenHouses(rnd, group, obstacles, spots) {
  const glass = [], solidParts = [], woodParts = [], roofParts_ = [], darkParts = [];
  const lampMat = new THREE.MeshBasicMaterial({ vertexColors: true, color: '#2e3c46' });
  const glowSprites = [];
  const glowTex = glowTexture('rgba(255,200,120,1)');
  const addGlow = (x, y, z, s = 1.3, parent = group) => {
    const g = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
    g.position.set(x, y, z);
    g.scale.setScalar(s);
    parent.add(g);
    glowSprites.push(g);
    return g;
  };
  const lanterns = [];
  const lanternMat = new THREE.MeshBasicMaterial({ color: '#8a7a60' });
  const rooms = {};
  const signs = {};

  for (const b of HAVEN_HOUSES) {
    const S = styleOf(b), walk = b.id === 'chandlery' || b.id === 'inn';
    // A cottage on the slope stands level with the ground at its door; down the slope its plinth
    // goes down to meet the ground (and up it, the bank comes up its back wall).
    const F0 = frame(b, 0), doorAt = F0.world(0, b.d / 2 + 0.3);
    const y = b.pad ?? heightAt(doorAt.x, doorAt.z) - 0.03;
    const F = frame(b, y);
    const low = Math.min(...[[-1, -1], [1, -1], [-1, 1], [1, 1], [0, 1], [-1, 0], [1, 0]].map(([sx, sz]) => {
      const p = F.world(sx * (b.w / 2 + 0.1), sz * (b.d / 2 + 0.1));
      return heightAt(p.x, p.z) - y;
    }));
    // The walls (in pieces round their openings). The two you can walk into keep each side
    // apart (and their upper storey) so the one between you and the camera can step aside.
    const sides = { front: [], back: [], left: [], right: [] }, upper = [];
    // (In the two you walk into, each side keeps its own glass, and the upstairs windows theirs,
    // so they go with their wall when it steps aside.)
    const sideGlass = { front: [], back: [], left: [], right: [] }, topGlass = [];
    const wallMat = walk || b.kind === 'cottage' ? 'plain' : 'wood';
    for (const side of Object.keys(sides)) {
      const ops = S.open[side];
      const lo = wallSide(F, b, side, ops, S.wall, -0.4, walk ? ROOM_H : S.wallH);
      sides[side].push(...lo);
      if (walk && S.wallH > ROOM_H) upper.push(...wallSide(F, b, side, ops, S.wall, ROOM_H, S.wallH));
      for (const o of ops) {
        const into = walk && o.bottom >= ROOM_H ? upper : sides[side];
        const gl = !walk ? glass : o.bottom >= ROOM_H ? topGlass : sideGlass[side];
        if (o.door) {
          into.push(...doorParts(F, side, o, { trim: S.trim, leaf: S.door, fan: b.kind === 'inn', leafToo: !walk, step: '#8f887d' }, gl));
          if (o.double) into.push(F.face(side, (o.a + o.b) / 2, o.top / 2, -0.02, 0.05, o.top, 0.07, '#4a2418'));
        } else into.push(...windowParts(F, side, o, { trim: S.trim, shutters: o.bottom < 2.2 ? S.shutters : null, bars: o.shop ? 'shop' : S.sash ? 'sash' : 'cross', lintel: b.kind === 'store' ? null : '#b9b1a3' }, gl));
      }
      if (S.clad) sides[side].push(...boardLines(F, b, side, walk ? ROOM_H : S.wallH, S.clad, ops));
    }
    const plinth = plinthParts(F, b, S.plinth, 0.5, low);
    const quoins = S.quoin ? quoinParts(F, b, S.wallH, S.quoin, rnd) : [];
    const { roof, gables } = roofParts(F, b, S.wallH, S.rise, { roof: S.roof, trim: b.kind === 'store' ? '#2a2522' : S.trim, wall: S.wall });
    const chim = S.chimneys.flatMap((lx) => chimneyParts(F, lx, -0.25, S.wallH + S.rise * 0.35, S.rise * 0.65 + 0.9, b.kind === 'inn' ? 3 : 2));

    if (!walk) {
      // One mesh for the walls (clad or washed), the rest into the shared lists.
      const all = [...sides.front, ...sides.back, ...sides.left, ...sides.right, ...gables];
      (wallMat === 'wood' ? woodParts : solidParts).push(...all);
      solidParts.push(...plinth, ...quoins, ...chim);
      roofParts_.push(...roof);
      // Solid to walk into, and the door to stand at.
      for (let lx = -b.w / 2 + 0.9; lx <= b.w / 2 - 0.9 + 0.01; lx += Math.max(1.2, (b.w - 1.8) / Math.max(1, Math.round((b.w - 1.8) / 1.6)))) {
        for (let lz = -b.d / 2 + 0.9; lz <= b.d / 2 - 0.9 + 0.01; lz += Math.max(1.2, (b.d - 1.8) / Math.max(1, Math.round((b.d - 1.8) / 1.6)))) {
          const p = F.world(lx, lz);
          obstacles.push({ x: p.x, z: p.z, r: 1.3, top: y + S.wallH + S.rise, kind: 'building', name: b.kind === 'cottage' ? 'a cottage' : 'the net store' });
        }
      }
      const door = F.world(0, b.d / 2 + 1.2);
      spots.push({ kind: 'door', name: b.kind === 'cottage' ? 'a cottage door' : 'the net store door', x: door.x, z: door.z, r: 2.4, id: b.id });
    } else {
      // Each side a mesh of its own; the upper storey, the gables, the roof and the chimneys
      // together (they all lift away while you're inside).
      const R = rooms[b.id] = { b, sides: {}, top: new THREE.Group(), y, doors: [] };
      for (const [side, parts] of Object.entries(sides)) {
        const g = new THREE.Group();
        g.add(mesh(mergeParts(parts, rnd), wallMat === 'wood' ? wood() : plain()));
        if (sideGlass[side].length) g.add(new THREE.Mesh(mergeParts(sideGlass[side], rnd), lampMat));
        group.add(g);
        R.sides[side] = g;
      }
      R.top.add(mesh(mergeParts([...upper, ...gables, ...chim], rnd), plain()), mesh(mergeParts(roof, rnd), plain()));
      if (topGlass.length) R.top.add(new THREE.Mesh(mergeParts(topGlass, rnd), lampMat));
      group.add(R.top);
      solidParts.push(...plinth, ...quoins);
    }
    if (b.pad != null) solidParts.push(...retainingWalls(b, y, rnd, obstacles));

    // Each one's own things. (What hangs on the front wall of the two you walk into goes with it:
    // `onFront`, and `fp`, the group it hangs in.)
    const front = b.d / 2, onFront = walk ? [] : darkParts, fp = walk ? rooms[b.id].sides.front : group;
    if (b.kind === 'inn') {
      // The sign over the door, a lantern either side of it, hanging baskets of flowers, and a
      // pair of benches and tables out on the setts.
      const t = textTexture(512, 112, signPainter('#5a2620', '#d8b46a', '#f3e6c4', 'The Lobster Pot', 'inn · fresh fish · ale', 52));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.79), new THREE.MeshLambertMaterial({ map: t.tex }));
      const sp = F.world(0, front + 0.06);
      sign.position.set(sp.x, y + 2.78, sp.z);
      sign.rotation.y = b.yaw;
      fp.add(sign);
      onFront.push({ geo: box(3.8, 0.94, 0.05), matrix: F.at(0, 2.78, front + 0.03), color: '#2a1c18' });
      for (const s of [-1, 1]) {
        onFront.push({ geo: box(0.05, 0.05, 0.32), matrix: F.at(s * 1.05, 2.3, front + 0.16), color: '#2a2d30' });
        const p = F.world(s * 1.05, front + 0.3);
        const lantern = new THREE.Mesh(box(0.18, 0.26, 0.18), lanternMat);
        lantern.position.set(p.x, y + 2.12, p.z);
        fp.add(lantern);
        lanterns.push(lantern);
        addGlow(p.x, y + 2.12, p.z, 1.3, fp);
        // Hanging baskets either side, further out.
        const hb = F.world(s * 2.6, front + 0.35);
        onFront.push({ geo: box(0.04, 0.04, 0.4), matrix: F.at(s * 2.6, 2.75, front + 0.18), color: '#2a2d30' });
        onFront.push({ geo: new THREE.SphereGeometry(0.26, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matrix: mat(hb.x, y + 2.42, hb.z), color: '#6a503b' });
        for (let k = 0; k < 7; k++) {
          const a = (k / 7) * Math.PI * 2;
          onFront.push({ geo: new THREE.IcosahedronGeometry(0.1, 0), matrix: mat(hb.x + Math.cos(a) * 0.2, y + 2.45 + (k % 2) * 0.05, hb.z + Math.sin(a) * 0.2), color: pick(['#c8413f', '#e9a1b3', '#f2e6a2', '#7f9a5a', '#c84a7a'], rnd) });
        }
      }
      for (const lx of [-3.0, 3.1]) {
        const p = F.world(lx, front + 2.2);
        woodParts.push(...picnicBench(p.x, y, p.z, b.yaw, rnd));
        obstacles.push({ x: p.x, z: p.z, r: 0.95, top: y + 0.8, kind: 'harbour', name: 'a bench' });
      }
      // A chalkboard by the door.
      const cb = F.world(1.2, front + 0.35);
      woodParts.push({ geo: box(0.55, 0.85, 0.04), matrix: mat(cb.x, y + 0.5, cb.z, -0.18, b.yaw, 0), color: '#2b2f2e' });
      woodParts.push({ geo: box(0.6, 0.9, 0.03), matrix: mat(cb.x, y + 0.5, cb.z - 0.03, -0.18, b.yaw, 0), color: '#6a503b' });
      signs.inn = sign;
    } else if (b.kind === 'chandlery') {
      const t = textTexture(512, 128, signPainter('#26383b', '#d8c48f', '#efe2bd', 'Chandlery', 'tackle · bait · charts · advice'));
      const sign = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.8), new THREE.MeshLambertMaterial({ map: t.tex }));
      const sp = F.world(1.3, front + 0.05);
      sign.position.set(sp.x, y + 2.55, sp.z);
      sign.rotation.y = b.yaw;
      fp.add(sign);
      signs.chandlery = sign;
      // Buoys and a lifebuoy on the wall, oars leaning by the door, a board on the setts.
      for (const [lx, ly, c] of [[-2.7, 2.2, '#e8742a'], [-3.15, 1.85, '#e8c234'], [-2.5, 1.65, '#e7e2d6']]) onFront.push({ geo: new THREE.SphereGeometry(0.17, 10, 8), matrix: F.at(lx, ly, front + 0.18), color: c });
      onFront.push({ geo: new THREE.TorusGeometry(0.3, 0.07, 8, 16), matrix: F.at(-0.3, 1.7, front + 0.08), color: '#e8e2d6' });
      for (const k of [0, 1, 2, 3]) onFront.push({ geo: box(0.08, 0.075, 0.09), matrix: F.at(-0.3 + Math.cos((k * Math.PI) / 2) * 0.3, 1.7 + Math.sin((k * Math.PI) / 2) * 0.3, front + 0.12), color: '#c23b2e' });
      for (const k of [0, 1]) onFront.push({ geo: cyl(0.03, 0.03, 2.4, 6), matrix: F.at(-3.3 + k * 0.18, 1.15, front + 0.25, -0.12, 0, 0.05 * (k ? 1 : -1)), color: '#a07a4a' });
      const sb = F.world(3.3, front + 0.9);
      for (const s of [-1, 1]) woodParts.push({ geo: box(0.6, 0.9, 0.04), matrix: mat(sb.x, y + 0.45, sb.z, s * 0.22, b.yaw, 0), color: '#2b2f2e' });
      obstacles.push({ x: sb.x, z: sb.z, r: 0.35, kind: 'harbour', name: 'the sandwich board' });
    } else if (b.kind === 'store') {
      // Nets hung to dry on poles beside the store (on the level ground by its west end), floats
      // along the top line.
      for (const lx of [-b.w / 2 - 0.8, -b.w / 2 - 3.0]) {
        const p = F.world(lx, 1.2);
        woodParts.push({ geo: cyl(0.05, 0.06, 2.4, 6), matrix: mat(p.x, y + 1.2, p.z), color: '#6a503b' });
        obstacles.push({ x: p.x, z: p.z, r: 0.2, kind: 'harbour', name: 'the net poles' });
      }
      const p = F.world(-b.w / 2 - 1.9, 1.2), py = y;
      darkParts.push({ geo: new THREE.PlaneGeometry(2.2, 1.6, 6, 4), matrix: mat(p.x, py + 1.3, p.z, 0, b.yaw, 0), color: '#4f6a5a', jitter: 0.15 });
      for (let k = 0; k < 5; k++) darkParts.push({ geo: new THREE.SphereGeometry(0.06, 6, 4), matrix: mat(p.x - 0.9 + k * 0.45, py + 2.08, p.z), color: '#c9a65a' });
      const sign = textTexture(256, 64, signPainter('#1f1c1a', '#8a7a5e', '#d8cbb0', 'NET STORE', '', 34));
      const sm = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.35), new THREE.MeshLambertMaterial({ map: sign.tex }));
      const q = F.world(0, front + 0.03);
      sm.position.set(q.x, y + 2.45, q.z);
      sm.rotation.y = b.yaw;
      group.add(sm);
    } else {
      // A cottage: a porch hood over the door on brackets, window boxes of flowers, a pot by
      // the step.
      roofParts_.push({ geo: box(1.6, 0.08, 0.55), matrix: F.at(0, DOOR_H + 0.35, front + 0.27, 0.2, 0, 0), color: S.roof });
      for (const s of [-1, 1]) darkParts.push({ geo: box(0.06, 0.32, 0.4), matrix: F.at(s * 0.7, DOOR_H + 0.18, front + 0.2), color: S.trim });
      for (const o of S.open.front.filter((q) => !q.door && q.bottom < 2)) {
        const u = (o.a + o.b) / 2;
        woodParts.push({ geo: box(o.b - o.a + 0.1, 0.18, 0.22), matrix: F.at(u, o.bottom - 0.2, front + 0.14), color: S.door });
        for (let k = 0; k < 5; k++) darkParts.push({ geo: new THREE.IcosahedronGeometry(0.08, 0), matrix: F.at(u - 0.4 + k * 0.2, o.bottom - 0.06 + (k % 2) * 0.04, front + 0.16), color: pick(['#c8413f', '#e9a1b3', '#f4f0e6', '#7f9a5a', '#7a5ab8', '#e8c234'], rnd) });
      }
      const pot = F.world(0.95, front + 0.4);
      darkParts.push({ geo: cyl(0.16, 0.12, 0.3, 8), matrix: mat(pot.x, y + 0.15, pot.z), color: '#b0613e' });
      darkParts.push({ geo: new THREE.IcosahedronGeometry(0.2, 0), matrix: mat(pot.x, y + 0.42, pot.z, 0, 0, 0, 1, 0.8, 1), color: '#5f7f4a' });
    }
    if (walk && onFront.length) fp.add(mesh(mergeParts(onFront, rnd), plain()));
  }

  /* ---------- inside the chandlery ---------- */
  const inside = { chandlery: [], inn: [] }, beams = { chandlery: [], inn: [] };
  {
    const R = CH, y = rooms.chandlery.y, P = inside.chandlery;
    const put = (geo, x, yy, z, color, rx = 0, ry = 0, rz = 0) => P.push({ geo, matrix: mat(x, y + yy, z, rx, ry, rz), color });
    const solid = (x, z, r, name) => obstacles.push({ x, z, r, top: y + 1.2, kind: 'building', name });
    // Floor: worn boards. A lining of cream boards inside the green.
    put(box(R.x1 - R.x0, 0.05, R.z1 - R.z0), (R.x0 + R.x1) / 2, 0.025, (R.z0 + R.z1) / 2, '#9a7a56');
    // The counter (Bert's side towards the back), its top worn darker; the till, a bell, a jar.
    const cx = R.x0 + 4.6, cz = R.z0 + 1.5;
    put(box(2.9, 1.0, 0.62), cx, 0.5, cz, '#7a5a3c');
    put(box(3.0, 0.06, 0.72), cx, 1.03, cz, '#5a4030');
    put(box(0.38, 0.22, 0.3), cx + 0.8, 1.17, cz - 0.05, '#3a3d40');
    put(cyl(0.05, 0.07, 0.06, 10), cx - 0.9, 1.09, cz + 0.1, '#c9a65a');
    put(cyl(0.09, 0.09, 0.24, 10), cx - 0.3, 1.18, cz + 0.05, '#cfe3e6');
    for (let x = cx - 1.2; x <= cx + 1.21; x += 0.8) solid(x, cz, 0.42, 'the counter');
    // The shelves behind him: boxes of hooks and swivels, spools of line, reels.
    for (const sy of [1.05, 1.55, 2.05]) {
      put(box(3.2, 0.04, 0.38), cx, sy, R.z0 + 0.2, '#6a503b');
      for (let x = cx - 1.45; x < cx + 1.5; x += 0.26) {
        const r = rnd();
        if (r < 0.45) put(box(0.18, 0.14, 0.24), x, sy + 0.09, R.z0 + 0.22, pick(['#c23b2e', '#2f6f8a', '#e8c234', '#3c7a52', '#e7e2d6'], rnd));
        else if (r < 0.8) put(cyl(0.08, 0.08, 0.1, 10), x, sy + 0.1, R.z0 + 0.22, pick(['#2a6f9a', '#c9a65a', '#2a2d30', '#e8742a'], rnd), Math.PI / 2, 0, 0);
        else put(box(0.14, 0.22, 0.18), x, sy + 0.13, R.z0 + 0.22, '#3a3d40');
      }
    }
    // The rod rack down the left wall, the rods standing in it; a pegboard of lures above.
    put(box(0.12, 0.08, 3.0), R.x0 + 0.12, 0.35, R.z0 + 2.4, '#6a503b');
    put(box(0.12, 0.08, 3.0), R.x0 + 0.12, 1.6, R.z0 + 2.4, '#6a503b');
    for (let z = R.z0 + 1.05; z < R.z0 + 3.85; z += 0.3) put(cyl(0.012, 0.025, 2.3, 5), R.x0 + 0.22, 1.2, z, pick(['#2f3640', '#5a3a2a', '#2a4a3a', '#c9a65a'], rnd), 0, 0, 0.05);
    put(box(0.04, 0.9, 1.6), R.x0 + 0.03, 2.05, R.z0 + 1.3, '#c9b48a');
    for (let k = 0; k < 18; k++) put(box(0.03, 0.12, 0.05), R.x0 + 0.07, 1.7 + (k % 3) * 0.25, R.z0 + 0.65 + Math.floor(k / 3) * 0.24, pick(['#c23b2e', '#e8c234', '#9fb6c2', '#e8742a', '#7f9a5a', '#e8e2d6'], rnd));
    solid(R.x0 + 0.3, R.z0 + 1.6, 0.35, 'the rod rack');
    solid(R.x0 + 0.3, R.z0 + 3.0, 0.35, 'the rod rack');
    // Bait and ice: a white chest freezer by the back wall.
    put(box(1.0, 0.85, 0.62), R.x0 + 1.1, 0.43, R.z0 + 0.4, '#e8e6e0');
    put(box(1.02, 0.05, 0.64), R.x0 + 1.1, 0.87, R.z0 + 0.4, '#c9ccc8');
    solid(R.x0 + 1.1, R.z0 + 0.45, 0.5, 'the bait freezer');
    // In the shop window: a display shelf with reels and a model boat.
    put(box(2.4, 0.08, 0.45), R.x1 - 1.6, 0.66, R.z1 - 0.25, '#6a503b');
    put(box(0.6, 0.18, 0.16), R.x1 - 2.2, 0.82, R.z1 - 0.25, '#b5532f');
    put(cyl(0.012, 0.012, 0.4, 4), R.x1 - 2.2, 1.05, R.z1 - 0.25, '#e8e2d6');
    for (const dx of [-0.8, -0.3, 0.2]) put(cyl(0.09, 0.09, 0.07, 12), R.x1 - 1.2 + dx, 0.78, R.z1 - 0.25, '#c9cdd0', Math.PI / 2, 0, 0);
    // Creels stacked by the door; a coil of rope; floats hung from the beams.
    for (let k = 0; k < 3; k++) put(cyl(0.24, 0.2, 0.32, 10), R.x0 + 0.45, 0.17 + k * 0.33, R.z1 - 0.55, '#b08a54');
    solid(R.x0 + 0.45, R.z1 - 0.55, 0.32, 'the creels');
    put(new THREE.TorusGeometry(0.22, 0.06, 6, 14), R.x0 + 0.5, 0.06, R.z1 - 1.3, '#c9b48a', Math.PI / 2, 0, 0);
    for (let k = 0; k < 6; k++) put(new THREE.SphereGeometry(0.12, 8, 6), R.x0 + 1.4 + k * 0.85, 2.35 - (k % 2) * 0.12, R.z0 + 2.9 + Math.sin(k) * 0.4, pick(['#e8742a', '#e8c234', '#e7e2d6', '#c23b2e'], rnd));
    for (let x = R.x0 + 0.8; x < R.x1; x += 1.6) beams.chandlery.push({ geo: box(0.12, 0.14, R.z1 - R.z0), matrix: mat(x, y + ROOM_H - 0.1, (R.z0 + R.z1) / 2), color: '#5a4030' });
    // The dive compressor and two tanks in the front right corner.
    put(box(0.6, 0.55, 0.45), R.x1 - 0.42, 0.28, R.z1 - 0.45, '#c23b2e');
    put(cyl(0.12, 0.12, 0.5, 10), R.x1 - 0.42, 0.6, R.z1 - 0.45, '#3a3d40', 0, 0, Math.PI / 2);
    for (const k of [0, 1]) put(cyl(0.09, 0.09, 0.7, 10), R.x1 - 0.2 - k * 0.22, 0.35, R.z1 - 1.0, '#e8c234');
    solid(R.x1 - 0.42, R.z1 - 0.6, 0.45, 'the compressor');
    // A chart of the coast on the back wall, left of the shelves.
    put(box(1.1, 0.75, 0.02), R.x0 + 2.35, 1.75, R.z0 + 0.02, '#e9dcbc');
    put(box(0.6, 0.35, 0.025), R.x0 + 2.25, 1.8, R.z0 + 0.03, '#9fbfc8');
  }

  /* ---------- inside The Lobster Pot ---------- */
  let kitchenTex = null;
  {
    const R = INN, y = rooms.inn.y, P = inside.inn;
    const put = (geo, x, yy, z, color, rx = 0, ry = 0, rz = 0) => P.push({ geo, matrix: mat(x, y + yy, z, rx, ry, rz), color });
    const solid = (x, z, r, name, top = 1.1) => obstacles.push({ x, z, r, top: y + top, kind: 'building', name });
    // Flagstones; low beams; plaster walls warm in the lamplight.
    for (let x = R.x0 + 0.4; x < R.x1; x += 0.8) for (let z = R.z0 + 0.4; z < R.z1; z += 0.8) put(box(0.78, 0.05, 0.78), x, 0.025, z, pick(['#8d8478', '#968d80', '#857d72', '#9c9386'], rnd));
    for (let x = R.x0 + 0.9; x < R.x1; x += 1.4) beams.inn.push({ geo: box(0.16, 0.18, R.z1 - R.z0), matrix: mat(x, y + ROOM_H - 0.12, (R.z0 + R.z1) / 2), color: '#4a3426' });
    // The bar: a long counter of dark wood, a brass rail, three pumps; the back bar of bottles;
    // the stuffed bass in its case over it; three stools.
    const bx = R.x0 + 3.6, bz = R.z0 + 1.15;
    put(box(3.4, 1.05, 0.62), bx, 0.53, bz, '#4a3426');
    put(box(3.5, 0.07, 0.74), bx, 1.08, bz, '#2e2018');
    put(cyl(0.025, 0.025, 3.3, 6), bx, 0.22, bz + 0.42, '#c9a65a', 0, 0, Math.PI / 2);
    for (const dx of [-0.6, 0, 0.6]) {
      put(cyl(0.035, 0.04, 0.26, 8), bx + dx, 1.25, bz - 0.05, '#c9a65a');
      put(box(0.05, 0.22, 0.05), bx + dx, 1.48, bz - 0.05, pick(['#2a2d30', '#6a3a2a', '#e8e2d6'], rnd));
    }
    for (let x = bx - 1.2; x <= bx + 1.21; x += 0.8) solid(x, bz, 0.42, 'the bar');
    for (const sy of [1.25, 1.75]) {
      put(box(3.0, 0.04, 0.3), bx, sy, R.z0 + 0.16, '#5a4030');
      for (let x = bx - 1.35; x < bx + 1.4; x += 0.16) put(cyl(0.035, 0.04, 0.26, 6), x, sy + 0.15, R.z0 + 0.17, pick(['#3a5a3a', '#6a2a2a', '#c9a65a', '#e7e2d6', '#2a3a5a', '#7a5a2a'], rnd));
    }
    put(box(1.1, 0.45, 0.22), bx, 2.25, R.z0 + 0.13, '#2a1c18');
    put(box(1.0, 0.36, 0.2), bx, 2.25, R.z0 + 0.15, '#9fb6c2');
    P.push({ geo: new THREE.SphereGeometry(1, 8, 5), matrix: mat(bx, y + 2.25, R.z0 + 0.22, 0, 0, 0, 0.36, 0.09, 0.05), color: '#8e9a8a' });
    for (const dx of [-1.1, -0.1, 0.9]) {
      put(cyl(0.17, 0.17, 0.05, 12), bx + dx, 0.7, bz + 0.75, '#6a3a2a');
      put(cyl(0.03, 0.04, 0.68, 6), bx + dx, 0.34, bz + 0.75, '#2a2d30');
    }
    // The fire, in a stone surround on the west gable; a settle facing it.
    const fz = R.z0 + 1.4;
    put(box(0.55, 1.5, 1.7), R.x0 + 0.2, 0.75, fz, '#8d8478');
    put(box(0.6, 0.12, 1.9), R.x0 + 0.25, 1.52, fz, '#6a503b');
    put(box(0.34, 0.7, 0.9), R.x0 + 0.34, 0.4, fz, '#1c1a18');
    put(box(0.7, 0.06, 1.3), R.x0 + 0.45, 0.03, fz, '#5a5650');
    for (const dz of [-0.15, 0.12]) put(cyl(0.06, 0.06, 0.5, 6), R.x0 + 0.36, 0.14, fz + dz, '#4a3426', 0, 0.4, Math.PI / 2);
    put(box(0.12, 0.2, 0.12), R.x0 + 0.3, 1.66, fz - 0.6, '#c9a65a');
    put(box(0.3, 0.16, 0.08), R.x0 + 0.3, 1.66, fz + 0.4, '#3a5a7a');
    for (const dz of [-0.55, 0, 0.55]) solid(R.x0 + 0.25, fz + dz, 0.32, 'the fireplace', 1.6);
    // The settle: a high-backed bench facing the fire (solid along its back).
    put(box(0.4, 0.07, 1.3), R.x0 + 1.64, 0.45, R.z0 + 2.05, '#5a4030');
    put(box(0.08, 1.15, 1.3), R.x0 + 1.88, 0.62, R.z0 + 2.05, '#5a4030');
    for (let z = R.z0 + 1.5; z <= R.z0 + 2.61; z += 0.275) solid(R.x0 + 1.9, z, 0.2, 'the settle');
    // Two tables by the front windows, with chairs; a candle on each.
    for (const [tx, tz] of [[R.x0 + 1.55, R.z1 - 0.8], [R.x1 - 1.6, R.z1 - 0.8]]) {
      put(box(1.0, 0.05, 0.75), tx, 0.74, tz, '#6a4a32');
      put(box(0.08, 0.72, 0.08), tx, 0.36, tz, '#4a3426');
      put(box(0.5, 0.04, 0.5), tx, 0.02, tz, '#4a3426');
      put(cyl(0.03, 0.03, 0.1, 8), tx, 0.82, tz, '#f2ecd8');
      for (const s of [-1, 1]) {
        put(box(0.4, 0.05, 0.4), tx + s * 0.75, 0.45, tz, '#5a4030');
        put(box(0.05, 0.5, 0.4), tx + s * 0.95, 0.72, tz, '#5a4030');
        for (const [lx, lz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) put(box(0.04, 0.45, 0.04), tx + s * 0.75 + lx, 0.22, tz + lz, '#4a3426');
      }
      solid(tx, tz, 0.55, 'a table', 0.8);
    }
    // The kitchen behind its pass at the east end: the half wall and the pass shelf, the range
    // with a kettle and a pot on it, a shelf of pans; the board of what the kitchen wants.
    const kx = R.x1 - 1.95;
    put(box(0.12, 1.1, 2.3), kx, 0.55, R.z0 + 1.15, '#d8cfbf');
    put(box(0.5, 0.06, 2.35), kx, 1.12, R.z0 + 1.15, '#6a4a32');
    for (let z = R.z0 + 0.3; z < R.z0 + 2.3; z += 0.4) obstacles.push({ x: kx, z, r: 0.22, top: y + 1.2, kind: 'building', name: 'the pass' });
    put(box(0.7, 0.9, 1.1), R.x1 - 0.38, 0.45, R.z0 + 0.95, '#2a2d30');
    put(box(0.72, 0.04, 1.12), R.x1 - 0.38, 0.92, R.z0 + 0.95, '#4a4d50');
    put(cyl(0.12, 0.14, 0.2, 10), R.x1 - 0.4, 1.04, R.z0 + 0.7, '#c9cdd0');
    put(cyl(0.18, 0.18, 0.22, 12), R.x1 - 0.4, 1.05, R.z0 + 1.2, '#5a5f66');
    put(box(1.2, 0.04, 0.26), R.x1 - 0.14, 1.7, R.z0 + 1.0, '#6a503b', 0, Math.PI / 2, 0);
    for (let k = 0; k < 4; k++) put(cyl(0.1, 0.1, 0.03, 10), R.x1 - 0.08, 1.45, R.z0 + 0.55 + k * 0.3, '#4a4d50', 0, 0, Math.PI / 2);
    put(box(0.6, 0.85, 0.5), R.x1 - 1.2, 0.43, R.z0 + 0.3, '#d8d4cc');
    obstacles.push({ x: R.x1 - 0.5, z: R.z0 + 0.95, r: 0.55, top: y + 1, kind: 'building', name: 'the range' });
    kitchenTex = textTexture(256, 192, (ctx, w, h) => {
      ctx.fillStyle = '#2b2f2e';
      ctx.fillRect(0, 0, w, h);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshLambertMaterial({ map: kitchenTex.tex }));
    board.position.set(kx - 0.075, y + 1.62, R.z0 + 1.55);
    board.rotation.y = -Math.PI / 2;
    group.add(board);
    inside.innBoard = board;
    put(box(0.04, 0.52, 0.68), kx - 0.05, 1.62, R.z0 + 1.55, '#6a503b');
  }

  // The doors you walk through (swinging open as you come to them).
  const doorMat = plain();
  const doors = [];
  for (const id of ['chandlery', 'inn']) {
    const R = HAVEN_ROOMS[id], b = byId(id), S = styleOf(b);
    const pivot = new THREE.Group();
    const hinge = R.doorX - DOOR_W / 2 + 0.06;
    pivot.position.set(hinge, rooms[id].y, R.front - 0.12);
    const leaf = mesh(mergeParts([
      { geo: box(DOOR_W - 0.12, DOOR_H - 0.04, 0.06), matrix: mat((DOOR_W - 0.12) / 2, DOOR_H / 2, 0), color: S.door },
      { geo: box(0.05, 0.05, 0.12), matrix: mat(DOOR_W - 0.32, 1.0, 0), color: '#c9a65a' },
      ...[0.35, 0.7].map((v) => ({ geo: box(DOOR_W * 0.75, DOOR_H * 0.25, 0.08), matrix: mat((DOOR_W - 0.12) / 2, DOOR_H * v, 0), color: S.door, jitter: 0.06 })),
    ], rnd), doorMat);
    pivot.add(leaf);
    group.add(pivot);
    doors.push({ id, pivot, x: R.doorX, z: R.front, open: 0, was: false });
    rooms[id].doors.push(doors[doors.length - 1]);
    // The walls as rows of small circles you can't walk through, with a gap for the door.
    const line = (x0, z0, x1, z1, gap = null) => {
      const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.3);
      for (let i = 0; i <= n; i++) {
        const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k;
        if (gap && Math.abs(x - gap) < DOOR_W / 2 - 0.05) continue;
        obstacles.push({ x, z, r: 0.2, kind: 'building', name: id === 'inn' ? 'The Lobster Pot' : 'the chandlery' });
      }
    };
    const X0 = b.x - b.w / 2 + 0.12, X1 = b.x + b.w / 2 - 0.12, Z0 = b.z - b.d / 2 + 0.12, Z1 = b.z + b.d / 2 - 0.12;
    line(X0, Z1, X1, Z1, R.doorX);
    line(X0, Z0, X1, Z0);
    line(X0, Z0, X0, Z1);
    line(X1, Z0, X1, Z1);
    // (A spot by the door outside, for the harbour's people and the old prompts.)
    spots.push({ kind: 'door', name: id === 'inn' ? 'The Lobster Pot' : 'the chandlery door', x: R.doorX, z: R.front + 1.2, r: 1.6, id });
  }
  for (const id of ['chandlery', 'inn']) {
    const m = mesh(mergeParts(inside[id], rnd), plain());
    rooms[id].inside = m;
    group.add(m);
    // (The ceiling beams lift away with the roof, so you can see down into the room.)
    rooms[id].top.add(mesh(mergeParts(beams[id], rnd), plain()));
  }

  group.add(mesh(mergeParts(solidParts, rnd), plain()));
  group.add(mesh(mergeParts(woodParts, rnd), wood()));
  group.add(mesh(mergeParts(roofParts_, rnd), plain()));
  if (darkParts.length) group.add(mesh(mergeParts(darkParts, rnd), plain()));
  const glassMesh = new THREE.Mesh(mergeParts(glass, rnd), lampMat);
  group.add(glassMesh);

  // Inside: one warm light for whichever room you're in or nearest, and the fire's glow.
  const light = new THREE.PointLight('#ffc98a', 0, 9, 1.6);
  group.add(light);
  const fireGlow = addGlow(INN.x0 + 0.5, rooms.inn.y + 0.5, INN.z0 + 1.4, 1.1);

  return {
    signs, rooms, doors,
    paintKitchen: (draw) => {
      if (!kitchenTex) return;
      draw(kitchenTex.canvas.getContext('2d'), kitchenTex.canvas.width, kitchenTex.canvas.height);
      kitchenTex.tex.needsUpdate = true;
    },
    // from: where you are; cam: the camera; cutaway: lift the roof and the wall facing the camera.
    update(dt, t, { night = 0, from = null, cam = null, cutaway = true, onDoor = null } = {}) {
      lampMat.color.setRGB(0.18 + night * 1.02, 0.24 + night * 0.44, 0.28 + night * 0.02);
      lanternMat.color.setRGB(0.54 + night * 0.46, 0.48 + night * 0.36, 0.38 + night * 0.12);
      for (const g of glowSprites) if (g !== fireGlow) g.material.opacity = 0.7 * night;
      if (!from) return;
      const room = insideHaven(from.x, from.z);
      const camRoom = !room && cutaway && cam ? insideHaven(cam.x, cam.z) : null;
      const open = room || camRoom;
      for (const [id, R] of Object.entries(rooms)) {
        const lift = open === id && cutaway;
        R.top.visible = !lift;
        const H = HAVEN_ROOMS[id], cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
        for (const [side, g] of Object.entries(R.sides)) {
          let show = true;
          if (lift) {
            const out = room ? cam : from, n = side === 'front' ? [0, 1] : side === 'back' ? [0, -1] : side === 'left' ? [-1, 0] : [1, 0];
            const reach = n[0] ? (H.x1 - H.x0) / 2 : (H.z1 - H.z0) / 2;
            if ((out.x - cx) * n[0] + (out.z - cz) * n[1] > reach - 0.4) show = false;
          }
          g.visible = show;
        }
        const near = Math.hypot(from.x - cx, from.z - cz) < 60;
        R.inside.visible = near;
      }
      for (const d of doors) {
        const near = Math.hypot(from.x - d.x, from.z - d.z) < 1.9;
        if (near !== d.was) {
          d.was = near;
          onDoor?.(near);
        }
        d.open = clamp(d.open + (near ? dt : -dt) * 2.5, 0, 1);
        d.pivot.rotation.y = -1.6 * smoothstep(0, 1, d.open);
        d.pivot.visible = rooms[d.id].sides.front.visible;
      }
      // The light in whichever you're in (or nearest the door you're at), warmer at night; the
      // fire flickering in the grate.
      const which = room || (Math.hypot(from.x - INN.doorX, from.z - INN.front) < Math.hypot(from.x - CH.doorX, from.z - CH.front) ? 'inn' : 'chandlery');
      const H = HAVEN_ROOMS[which], dNear = Math.min(...Object.values(HAVEN_ROOMS).map((q) => Math.hypot(from.x - (q.x0 + q.x1) / 2, from.z - (q.z0 + q.z1) / 2)));
      light.position.set((H.x0 + H.x1) / 2, rooms[which].y + 2.3, (H.z0 + H.z1) / 2);
      const flick = which === 'inn' ? 0.85 + 0.15 * Math.sin(t * 9.3) * Math.sin(t * 5.7 + 1) : 1;
      light.intensity = dNear < 30 ? (room ? 5 + night * 3 : night * 4) * flick : 0;
      fireGlow.material.opacity = (0.55 + 0.25 * Math.sin(t * 7.1) * Math.sin(t * 3.3)) * (dNear < 40 ? 1 : 0);
    },
  };
}

// A pub bench: a table with benches either side, all of a piece.
function picnicBench(x, y, z, yaw, rnd) {
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const at = (lx, ly, lz, rz = 0) => mat(x + lx * c + lz * s, y + ly, z - lx * s + lz * c, 0, yaw, rz);
  const col = pick(['#8a6a4a', '#7a5a3c'], rnd);
  return [
    { geo: box(1.7, 0.06, 0.7), matrix: at(0, 0.74, 0), color: col },
    { geo: box(1.7, 0.05, 0.28), matrix: at(0, 0.44, 0.62), color: col },
    { geo: box(1.7, 0.05, 0.28), matrix: at(0, 0.44, -0.62), color: col },
    ...[-0.65, 0.65].flatMap((lx) => [
      { geo: box(0.06, 0.95, 0.06), matrix: at(lx, 0.4, 0.32, 0), color: '#5a4030' },
      { geo: box(0.06, 0.95, 0.06), matrix: at(lx, 0.4, -0.32, 0), color: '#5a4030' },
      { geo: box(0.08, 0.06, 1.5), matrix: at(lx, 0.38, 0), color: '#5a4030' },
    ]),
  ];
}
