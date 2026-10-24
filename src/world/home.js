import * as THREE from 'three';
import { HOME_PAD, HOUSE, GARAGE, CAR_PARKS, LANES, PLACES, heightAt } from './terrain.js';
import { RODS, ROD_IDS } from '../tackle.js';
import { mergeParts, mat, pick, clamp, smoothstep, glowTexture } from '../util.js';
import { withSurface } from './surface.js';

// Home: a small whitewashed cottage and its garage on a level shoulder of the east arm, looking
// south over Shell Strand to the sea. You can walk in: the cottage is one room (a bed, a desk with
// your journal, a kitchen corner, a wood stove, and a wall for photographs, a keepsake and the
// record of a catch); a door in the shared wall leads into the garage, where a workbench with a
// map, the rod rack, the tackle wall, a shelf for the camping gear, boots and bags wait by the
// open door and the drive. The rack and the shelf show what's actually there (the rods you carry
// or have loaded in the car leave a gap). While you're inside, the roof lifts away (and the wall
// between you and the camera), so you can see what you're doing.
//
// Everything is made here from simple shapes and canvas pictures (no outside models or images).

const Y = HOME_PAD.h;              // the level of the pad, the floors and the drive
const WALL_H = 2.6, T = 0.22;      // wall height and thickness
const DOOR_W = 1.4, DOOR_H = 2.15; // a door wide enough to walk through comfortably

const plain = () => new THREE.MeshLambertMaterial({ vertexColors: true });
const wood = () => withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'x' });

function mesh(geo, material, shadows = true) {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = shadows;
  m.receiveShadow = true;
  return m;
}
const box = (w, h, d) => new THREE.BoxGeometry(w, h, d);
const cyl = (r0, r1, h, n = 10) => new THREE.CylinderGeometry(r0, r1, h, n);

function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const paint = (...a) => {
    draw(c.getContext('2d'), w, h, ...a);
    tex.needsUpdate = true;
  };
  return { tex, canvas: c, paint };
}

// A wall along x (at z) or along z (at x), from a to b, with openings { a, b, bottom, top }: the
// solid parts as boxes (below a window, above it, either side).
function wallParts(axis, at, a, b, openings, color, h = WALL_H) {
  const P = [];
  const piece = (u0, u1, y0, y1) => {
    if (u1 - u0 < 0.01 || y1 - y0 < 0.01) return;
    const u = (u0 + u1) / 2, y = Y + (y0 + y1) / 2;
    P.push(axis === 'x'
      ? { geo: box(u1 - u0, y1 - y0, T), matrix: mat(u, y, at), color }
      : { geo: box(T, y1 - y0, u1 - u0), matrix: mat(at, y, u), color });
  };
  const ops = [...openings].sort((p, q) => p.a - q.a);
  let u = a;
  for (const o of ops) {
    piece(u, o.a, 0, h);
    piece(o.a, o.b, 0, o.bottom);
    piece(o.a, o.b, o.top, h);
    u = o.b;
  }
  piece(u, b, 0, h);
  return P;
}

// A window's frame and glass in an opening (in a wall along `axis`).
function windowParts(axis, at, o, frame = '#f3efe6') {
  const P = [], w = o.b - o.a, h = o.top - o.bottom, u = (o.a + o.b) / 2, y = Y + (o.bottom + o.top) / 2;
  const put = (geo, du, dy, color) => P.push({ geo, matrix: axis === 'x' ? mat(u + du, y + dy, at) : mat(at, y + dy, u + du), color });
  const bar = (len, horiz) => (axis === 'x' ? (horiz ? box(len, 0.07, T + 0.04) : box(0.07, len, T + 0.04)) : (horiz ? box(T + 0.04, 0.07, len) : box(T + 0.04, len, 0.07)));
  put(bar(w + 0.1, true), 0, h / 2, frame);
  put(bar(w + 0.1, true), 0, -h / 2, frame);
  put(bar(h, false), -w / 2, 0, frame);
  put(bar(h, false), w / 2, 0, frame);
  put(bar(h, false), 0, 0, frame);
  put(bar(w, true), 0, 0, frame);
  // The sill.
  P.push({ geo: axis === 'x' ? box(w + 0.3, 0.06, T + 0.22) : box(T + 0.22, 0.06, w + 0.3), matrix: axis === 'x' ? mat(u, Y + o.bottom - 0.03, at) : mat(at, Y + o.bottom - 0.03, u), color: '#cfc8bb' });
  return P;
}
function glassGeo(axis, at, o) {
  const w = o.b - o.a, h = o.top - o.bottom, u = (o.a + o.b) / 2, y = Y + (o.bottom + o.top) / 2;
  const g = axis === 'x' ? box(w, h, 0.02) : box(0.02, h, w);
  g.applyMatrix4(axis === 'x' ? mat(u, y, at) : mat(at, y, u));
  return g;
}

// A gable roof over [x0,x1] × [z0,z1], ridge along `along` ('x' or 'z'), eaves at height eave.
function roofGeo(x0, x1, z0, z1, eave, rise, along, over = 0.35) {
  const g = new THREE.BufferGeometry();
  const v = [];
  const tri = (a, b, c) => v.push(...a, ...b, ...c);
  const y0 = Y + eave, y1 = y0 + rise;
  if (along === 'x') {
    const a = x0 - over, b = x1 + over, f = z1 + over, k = z0 - over, m = (z0 + z1) / 2;
    tri([a, y0, f], [b, y0, f], [b, y1, m]); tri([a, y0, f], [b, y1, m], [a, y1, m]);
    tri([b, y0, k], [a, y0, k], [a, y1, m]); tri([b, y0, k], [a, y1, m], [b, y1, m]);
  } else {
    const a = z0 - over, b = z1 + over, f = x1 + over, k = x0 - over, m = (x0 + x1) / 2;
    tri([f, y0, b], [f, y0, a], [m, y1, a]); tri([f, y0, b], [m, y1, a], [m, y1, b]);
    tri([k, y0, a], [k, y0, b], [m, y1, b]); tri([k, y0, a], [m, y1, b], [m, y1, a]);
  }
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}
function gableEndGeo(axis, at, u0, u1, eave, rise) {
  const g = new THREE.BufferGeometry(), m = (u0 + u1) / 2, y0 = Y + eave, y1 = y0 + rise;
  const p = axis === 'x' ? [u0, y0, at, u1, y0, at, m, y1, at] : [at, y0, u0, at, y0, u1, at, y1, m];
  g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  g.computeVertexNormals();
  return g;
}

// The things in the house and the garage you can use: where you stand to use them, and a word.
export const HOME_SPOTS = [
  { id: 'bed', x: 113.6, z: -79.2, r: 1.5, name: 'the bed' },
  { id: 'desk', x: 116.9, z: -79.3, r: 1.3, name: 'the desk' },
  { id: 'display', x: 121, z: -79.3, r: 1.6, name: 'the wall of photographs' },
  { id: 'kitchen', x: 124.3, z: -73.9, r: 1.5, name: 'the kitchen' },
  { id: 'bench', x: 130.9, z: -79.1, r: 1.6, name: 'the workbench' },
  { id: 'tackle', x: 127.4, z: -79.2, r: 1.3, name: 'the tackle wall' },
  { id: 'rack', x: 134.2, z: -77.6, r: 1.4, name: 'the rod rack' },
  { id: 'shelf', x: 134.1, z: -73, r: 1.4, name: 'the camping shelf' },
];

export const insideHome = (x, z) => (x > HOUSE.x0 && x < HOUSE.x1 && z > HOUSE.z0 && z < HOUSE.z1 ? 'house'
  : x > GARAGE.x0 && x < GARAGE.x1 && z > GARAGE.z0 && z < GARAGE.z1 ? 'garage' : null);

export function buildHome(scene, rnd) {
  const group = new THREE.Group();
  group.name = 'home';
  scene.add(group);
  const obstacles = [];
  // Walls as rows of small circles you can't walk through (with gaps for the doors).
  const wallLine = (x0, z0, x1, z1, gaps = []) => {
    const len = Math.hypot(x1 - x0, z1 - z0), n = Math.ceil(len / 0.3);
    for (let i = 0; i <= n; i++) {
      const k = i / n, x = x0 + (x1 - x0) * k, z = z0 + (z1 - z0) * k, u = x0 === x1 ? z : x;
      if (gaps.some(([a, b]) => u > a && u < b)) continue;
      obstacles.push({ x, z, r: 0.2, kind: 'building', name: 'the house' });
    }
  };
  const solid = (x, z, r, name = 'furniture', top = 2) => obstacles.push({ x, z, r, top: Y + top, kind: 'building', name });

  const H = HOUSE, G = GARAGE, WHITE = '#efe9df', STONE = '#b9b1a3';
  // ---- the walls, one mesh per side (so the one between you and the camera can step aside) ----
  const walls = {};
  const addWall = (key, parts, room, normal) => {
    const m = mesh(mergeParts(parts, rnd), plain());
    // (extra: what's on the wall, and goes when it steps aside: its glass, its door…)
    m.userData = { room, normal, extra: [] };
    group.add(m);
    walls[key] = m;
  };
  const hdoor = { a: H.door - DOOR_W / 2, b: H.door + DOOR_W / 2, bottom: 0, top: DOOR_H };
  const idoor = { a: G.inner - DOOR_W / 2, b: G.inner + DOOR_W / 2, bottom: 0, top: DOOR_H };
  const hwinS = [{ a: 112.5, b: 114.1, bottom: 0.95, top: 2.05 }, { a: 120.6, b: 122.4, bottom: 0.95, top: 2.05 }];
  const hwinW = [{ a: -77.6, b: -75.8, bottom: 0.95, top: 2.05 }];
  const hwinN = [{ a: 117.6, b: 118.8, bottom: 1.25, top: 2.05 }];
  const gwinE = [{ a: -74.4, b: -72.6, bottom: 1.1, top: 2.0 }];
  const gdoor = { a: G.door[0], b: G.door[1], bottom: 0, top: 2.3 };
  addWall('hS', [...wallParts('x', H.z1, H.x0, H.x1, [hdoor, ...hwinS], WHITE), ...hwinS.flatMap((o) => windowParts('x', H.z1, o)), ...windowParts('x', H.z1, { ...hdoor, bottom: 0 }).slice(0, 1)], 'house', [0, 1]);
  addWall('hN', [...wallParts('x', H.z0, H.x0, H.x1, hwinN, WHITE), ...hwinN.flatMap((o) => windowParts('x', H.z0, o))], 'house', [0, -1]);
  addWall('hW', [...wallParts('z', H.x0, H.z0, H.z1, hwinW, WHITE), ...hwinW.flatMap((o) => windowParts('z', H.x0, o))], 'house', [-1, 0]);
  addWall('mid', wallParts('z', G.x0, H.z0, H.z1, [idoor], '#e7e0d4'), 'both', [1, 0]);
  addWall('gS', wallParts('x', G.z1, G.x0, G.x1, [gdoor], '#e4ddd0'), 'garage', [0, 1]);
  addWall('gN', wallParts('x', G.z0, G.x0, G.x1, [], '#e4ddd0'), 'garage', [0, -1]);
  addWall('gE', [...wallParts('z', G.x1, G.z0, G.z1, gwinE, '#e4ddd0'), ...gwinE.flatMap((o) => windowParts('z', G.x1, o))], 'garage', [1, 0]);
  addWall('gW', wallParts('z', G.x0, H.z1, G.z1, [], '#e4ddd0'), 'garage', [-1, 0]);
  // A low stone plinth round the house, outside.
  const plinth = [];
  for (const [x0, z0, x1, z1] of [[H.x0, H.z1, H.x1, H.z1], [H.x0, H.z0, G.x1, H.z0], [H.x0, H.z0, H.x0, H.z1], [G.x1, G.z0, G.x1, G.z1]]) {
    const w = Math.max(0.3, Math.abs(x1 - x0) + 0.3), d = Math.max(0.3, Math.abs(z1 - z0) + 0.3);
    plinth.push({ geo: box(w, 0.35, d), matrix: mat((x0 + x1) / 2, Y + 0.12, (z0 + z1) / 2), color: STONE });
  }
  group.add(mesh(mergeParts(plinth, rnd), plain()));
  // Glass in the windows (a little sheen; glowing warm after dark).
  const glassMat = new THREE.MeshLambertMaterial({ color: '#9fb6c2', emissive: '#ffb860', emissiveIntensity: 0, transparent: true, opacity: 0.45 });
  for (const [key, geos] of [['hS', hwinS.map((o) => glassGeo('x', H.z1, o))], ['hN', hwinN.map((o) => glassGeo('x', H.z0, o))], ['hW', hwinW.map((o) => glassGeo('z', H.x0, o))], ['gE', gwinE.map((o) => glassGeo('z', G.x1, o))]]) {
    const glass = new THREE.Mesh(mergeParts(geos.map((geo) => ({ geo, color: '#ffffff' })), rnd), glassMat);
    group.add(glass);
    walls[key].userData.extra.push(glass);
  }

  // Floors: boards in the cottage, concrete in the garage.
  const floorH = mesh(mergeParts([{ geo: box(H.x1 - H.x0, 0.06, H.z1 - H.z0), matrix: mat((H.x0 + H.x1) / 2, Y + 0.03, (H.z0 + H.z1) / 2), color: '#a8825c' }], rnd), wood(), false);
  const floorG = mesh(mergeParts([{ geo: box(G.x1 - G.x0, 0.05, G.z1 - G.z0), matrix: mat((G.x0 + G.x1) / 2, Y + 0.025, (G.z0 + G.z1) / 2), color: '#a9a69e' }], rnd), plain(), false);
  group.add(floorH, floorG);

  // Roofs: slate over the cottage (ridge along x), and a lower pitched roof over the garage.
  const roofMat = new THREE.MeshLambertMaterial({ color: '#4f555c', side: THREE.DoubleSide });
  const roofs = new THREE.Group();
  roofs.add(mesh(roofGeo(H.x0, H.x1, H.z0, H.z1, WALL_H, 1.7, 'x'), roofMat));
  roofs.add(mesh(roofGeo(G.x0, G.x1, G.z0, G.z1, WALL_H, 1.1, 'z'), roofMat));
  const endMat = new THREE.MeshLambertMaterial({ color: WHITE, side: THREE.DoubleSide });
  roofs.add(mesh(gableEndGeo('z', H.x0, H.z0, H.z1, WALL_H, 1.7), endMat));
  roofs.add(mesh(gableEndGeo('z', H.x1, H.z0, H.z1, WALL_H, 1.7), endMat));
  roofs.add(mesh(gableEndGeo('x', G.z1, G.x0, G.x1, WALL_H, 1.1), endMat));
  roofs.add(mesh(gableEndGeo('x', G.z0, G.x0, G.x1, WALL_H, 1.1), endMat));
  // The chimney, and ceilings (seen from inside in first person; they lift with the roof).
  roofs.add(mesh(mergeParts([
    { geo: box(0.7, 2.6, 0.7), matrix: mat(124.6, Y + 3.3, -79.4), color: '#b4aa9a' },
    { geo: box(0.85, 0.12, 0.85), matrix: mat(124.6, Y + 4.62, -79.4), color: '#8d8579' },
    { geo: box(H.x1 - H.x0, 0.05, H.z1 - H.z0), matrix: mat((H.x0 + H.x1) / 2, Y + WALL_H - 0.02, (H.z0 + H.z1) / 2), color: '#efe9df' },
    { geo: box(G.x1 - G.x0, 0.05, G.z1 - G.z0), matrix: mat((G.x0 + G.x1) / 2, Y + WALL_H - 0.02, (G.z0 + G.z1) / 2), color: '#dcd5c8' },
  ], rnd), plain()));
  group.add(roofs);

  // Wall lines you bump into.
  wallLine(H.x0, H.z1, H.x1, H.z1, [[hdoor.a, hdoor.b]]);
  wallLine(H.x0, H.z0, G.x1, G.z0);
  wallLine(H.x0, H.z0, H.x0, H.z1);
  wallLine(G.x0, H.z0, G.x0, H.z1, [[idoor.a, idoor.b]]);
  wallLine(G.x0, H.z1, G.x0, G.z1);
  wallLine(G.x0, G.z1, G.door[0], G.z1);
  wallLine(G.door[1], G.z1, G.x1, G.z1);
  wallLine(G.x1, G.z0, G.x1, G.z1);

  // ---- doors that swing open as you come to them ----
  const doors = [];
  const doorMat = plain();
  const makeDoor = (hx, hz, len, axis, color, swing) => {
    const pivot = new THREE.Group();
    pivot.position.set(hx, Y, hz);
    const leaf = mesh(mergeParts([
      { geo: box(axis === 'x' ? len : 0.06, DOOR_H - 0.04, axis === 'x' ? 0.06 : len), matrix: mat(axis === 'x' ? len / 2 : 0, DOOR_H / 2, axis === 'x' ? 0 : len / 2), color },
      { geo: cyl(0.03, 0.03, 0.1, 6), matrix: mat(axis === 'x' ? len - 0.12 : 0.06, 1.0, axis === 'x' ? 0.06 : len - 0.12, Math.PI / 2, 0, 0), color: '#c9a34a' },
    ], rnd), doorMat);
    pivot.add(leaf);
    group.add(pivot);
    doors.push({ pivot, x: hx + (axis === 'x' ? len / 2 : 0), z: hz + (axis === 'x' ? 0 : len / 2), open: 0, swing, was: false });
    return pivot;
  };
  walls.hS.userData.extra.push(makeDoor(hdoor.a, H.z1, DOOR_W, 'x', '#3e6b6f', -1.45));
  walls.mid.userData.extra.push(makeDoor(G.x0, idoor.a, DOOR_W, 'z', '#8a6a48', 1.45));

  // The garage door, rolled up into the roof space (an up-and-over door, left open; it lifts away
  // with the roof while you're inside).
  roofs.add(mesh(mergeParts([
    { geo: box(G.door[1] - G.door[0], 0.06, 2.2), matrix: mat((G.door[0] + G.door[1]) / 2, Y + 2.38, G.z1 - 1.2), color: '#6f7d84' },
    { geo: box(0.08, 0.08, 2.4), matrix: mat(G.door[0] + 0.05, Y + 2.33, G.z1 - 1.2), color: '#4a4f54' },
    { geo: box(0.08, 0.08, 2.4), matrix: mat(G.door[1] - 0.05, Y + 2.33, G.z1 - 1.2), color: '#4a4f54' },
  ], rnd), plain()));

  // ---- inside the cottage ----
  const H_PARTS = [];
  const put = (geo, x, y, z, color, rx = 0, ry = 0, rz = 0) => H_PARTS.push({ geo, matrix: mat(x, Y + y, z, rx, ry, rz), color });
  // The bed in the north-west corner: frame, mattress, a blue quilt, pillows, and a bedside table.
  put(box(1.45, 0.3, 2.1), 112.05, 0.25, -79.75, '#7a5a3c');
  put(box(1.35, 0.18, 2.0), 112.05, 0.49, -79.75, '#f1ece2');
  put(box(1.4, 0.08, 1.4), 112.05, 0.6, -79.35, '#3f5f86');
  put(box(0.55, 0.12, 0.35), 111.75, 0.63, -80.5, '#ffffff');
  put(box(0.55, 0.12, 0.35), 112.4, 0.63, -80.5, '#ffffff');
  put(box(1.45, 0.75, 0.08), 112.05, 0.55, -80.82, '#6b4e34');
  put(box(0.45, 0.55, 0.42), 113.2, 0.28, -80.6, '#7a5a3c');
  put(cyl(0.05, 0.09, 0.28, 8), 113.2, 0.7, -80.6, '#d8cfb8');
  solid(112.05, -79.4, 0.75, 'the bed');
  solid(112.05, -80.2, 0.75, 'the bed');
  solid(113.2, -80.6, 0.3, 'the bedside table');
  // The desk under the north window, a chair, the journal open on it and a lamp.
  put(box(1.5, 0.05, 0.6), 117.2, 0.76, -80.55, '#8a6a48');
  for (const [dx, dz] of [[-0.68, -0.25], [0.68, -0.25], [-0.68, 0.25], [0.68, 0.25]]) put(box(0.05, 0.74, 0.05), 117.2 + dx, 0.37, -80.55 + dz, '#6b4e34');
  put(box(0.42, 0.03, 0.3), 117.0, 0.795, -80.5, '#e9dfc6');
  put(box(0.02, 0.035, 0.31), 117.0, 0.8, -80.5, '#7c5a3a');
  put(cyl(0.015, 0.015, 0.4, 6), 117.75, 0.98, -80.65, '#2f2f2f');
  put(cyl(0.05, 0.12, 0.14, 10), 117.75, 1.2, -80.6, '#c9b27a');
  put(box(0.45, 0.04, 0.45), 117.2, 0.46, -79.95, '#7a5a3c');
  put(box(0.45, 0.5, 0.04), 117.2, 0.72, -79.73, '#7a5a3c');
  solid(117.2, -80.55, 0.5, 'the desk');
  // The display wall: a shelf under three frames (the frames' pictures are their own meshes).
  put(box(2.4, 0.05, 0.24), 121, 1.12, -80.75, '#7a5a3c');
  for (const dx of [-0.95, 0, 0.95]) put(box(0.78, 0.6, 0.03), 121 + dx, 1.72, -80.86, '#3d2f22');
  put(box(0.5, 0.36, 0.03), 122.7, 1.25, -80.86, '#e9dfc6');
  // The wood stove in the north-east corner, on a hearth.
  put(box(1.0, 0.06, 0.9), 124.6, 0.03, -80.2, '#8d8579');
  put(box(0.6, 0.62, 0.5), 124.6, 0.38, -80.25, '#2c2d2f');
  put(cyl(0.08, 0.08, 1.7, 8), 124.6, 1.55, -80.35, '#2c2d2f');
  solid(124.6, -80.2, 0.55, 'the stove');
  // The kitchen along the shared wall: a counter, a sink, a little cooker, a shelf of jars.
  put(box(0.62, 0.9, 3.4), 125.5, 0.45, -73.9, '#d9d2c4');
  put(box(0.66, 0.04, 3.44), 125.5, 0.92, -73.9, '#7a5a3c');
  put(box(0.4, 0.12, 0.5), 125.45, 0.88, -72.9, '#b8c0c4');
  put(box(0.5, 0.05, 0.6), 125.45, 0.95, -74.9, '#2c2d2f');
  put(box(0.24, 0.04, 1.4), 125.75, 1.6, -73.9, '#7a5a3c');
  for (let i = 0; i < 4; i++) put(cyl(0.05, 0.05, 0.14, 8), 125.75, 1.69, -74.4 + i * 0.32, pick(['#c87c3c', '#e3c25a', '#9cb07a', '#d7d0c0'], rnd));
  solid(125.5, -72.8, 0.45, 'the kitchen');
  solid(125.5, -73.9, 0.45, 'the kitchen');
  solid(125.5, -75.0, 0.45, 'the kitchen');
  // An armchair on a rug by the stove, a little table, and coats and boots by the door.
  put(box(2.4, 0.015, 1.7), 120.2, 0.07, -76.4, '#b0573f');
  put(box(0.85, 0.4, 0.8), 121.8, 0.3, -77.8, '#5f7a5a');
  put(box(0.85, 0.55, 0.15), 121.8, 0.75, -78.15, '#5f7a5a');
  put(box(0.15, 0.25, 0.8), 121.42, 0.62, -77.8, '#5f7a5a');
  put(box(0.15, 0.25, 0.8), 122.18, 0.62, -77.8, '#5f7a5a');
  put(cyl(0.3, 0.3, 0.04, 14), 120.4, 0.55, -77.3, '#7a5a3c');
  put(cyl(0.04, 0.04, 0.5, 6), 120.4, 0.28, -77.3, '#6b4e34');
  solid(121.8, -77.8, 0.55, 'the armchair');
  solid(120.4, -77.3, 0.35, 'the table');
  put(box(0.8, 0.06, 0.06), 114.7, 1.7, -71.65, '#6b4e34');
  put(box(0.42, 0.75, 0.18), 114.55, 1.3, -71.72, '#c8a44a');
  put(box(0.26, 0.2, 0.32), 115.05, 0.12, -71.9, '#2f3d34');
  put(box(0.26, 0.2, 0.32), 115.35, 0.12, -71.9, '#2f3d34');
  group.add(mesh(mergeParts(H_PARTS, rnd), wood()));

  // The display: three photographs, a record card, and the keepsakes on the shelf.
  const frames = [-0.95, 0, 0.95].map((dx) => {
    const ct = canvasTex(256, 192, (ctx, w, h, img) => {
      ctx.fillStyle = '#f4efe4';
      ctx.fillRect(0, 0, w, h);
      if (img) {
        const k = Math.max(w / img.width, h / img.height);
        ctx.drawImage(img, (w - img.width * k) / 2, (h - img.height * k) / 2, img.width * k, img.height * k);
      } else {
        ctx.fillStyle = '#d8d0bf';
        ctx.fillRect(16, 16, w - 32, h - 32);
      }
    });
    ct.paint(null);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.52), new THREE.MeshLambertMaterial({ map: ct.tex }));
    m.position.set(121 + dx, Y + 1.72, -80.84);
    group.add(m);
    return { mesh: m, ...ct, shown: undefined };
  });
  const card = canvasTex(256, 184, (ctx, w, h, lines) => {
    ctx.fillStyle = '#efe6cf';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#3a2a1c';
    ctx.textAlign = 'center';
    ctx.font = '700 26px Kalam, Caveat, cursive';
    ctx.fillText(lines?.[0] || 'Best catch', w / 2, 38);
    ctx.font = '22px Kalam, Caveat, cursive';
    (lines?.slice(1) || ['Nothing yet: room for one.']).forEach((t, i) => ctx.fillText(t, w / 2, 78 + i * 32));
  });
  card.paint(null);
  const cardMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.33), new THREE.MeshLambertMaterial({ map: card.tex }));
  cardMesh.position.set(122.7, Y + 1.25, -80.84);
  group.add(cardMesh);
  // Keepsakes on the shelf (shown only once you have them).
  const keep = {};
  const keepMesh = (parts) => {
    const m = mesh(mergeParts(parts, rnd), plain());
    m.visible = false;
    group.add(m);
    return m;
  };
  keep.chart = keepMesh([{ geo: box(0.22, 0.17, 0.02), matrix: mat(120.1, Y + 1.24, -80.78, -0.15, 0, 0), color: '#3d2f22' }, { geo: box(0.18, 0.13, 0.025), matrix: mat(120.1, Y + 1.24, -80.775, -0.15, 0, 0), color: '#8a7a5e' }]);
  keep.notebook = keepMesh([{ geo: box(0.16, 0.03, 0.22), matrix: mat(121.0, Y + 1.16, -80.72), color: '#34558a' }, { geo: box(0.15, 0.025, 0.21), matrix: mat(121.0, Y + 1.19, -80.72, 0, 0.12, 0), color: '#e8dfc8' }]);
  keep.feather = keepMesh([{ geo: box(0.02, 0.008, 0.2), matrix: mat(121.6, Y + 1.16, -80.7, 0, 0.6, 0), color: '#f2f2ef' }, { geo: box(0.05, 0.006, 0.12), matrix: mat(121.62, Y + 1.165, -80.69, 0, 0.6, 0), color: '#a7adb2' }]);

  // ---- inside the garage ----
  const G_PARTS = [];
  const gput = (geo, x, y, z, color, rx = 0, ry = 0, rz = 0) => G_PARTS.push({ geo, matrix: mat(x, Y + y, z, rx, ry, rz), color });
  // The workbench along the back wall: a thick top, legs, a shelf under it, a vice and tools.
  gput(box(4.2, 0.08, 0.75), 130.9, 0.9, -80.45, '#a07a52');
  for (const dx of [-2, 2]) for (const dz of [-0.3, 0.3]) gput(box(0.08, 0.88, 0.08), 130.9 + dx, 0.44, -80.45 + dz, '#7a5a3c');
  gput(box(4.0, 0.04, 0.6), 130.9, 0.25, -80.45, '#8a6a48');
  gput(box(0.22, 0.14, 0.18), 129.2, 1.0, -80.2, '#3a4a5c');
  gput(box(0.5, 0.06, 0.12), 131.7, 0.97, -80.3, '#c64a2e');
  gput(box(0.3, 0.12, 0.2), 132.6, 1.0, -80.4, '#3c6b4c');
  // A pegboard over the bench, with a few tools.
  gput(box(4.0, 1.0, 0.03), 130.9, 1.75, -80.86, '#c8b58e');
  for (let i = 0; i < 7; i++) gput(box(0.04, 0.3 + rnd() * 0.2, 0.03), 129.1 + i * 0.22, 1.7, -80.82, pick(['#5a5f66', '#7a5a3c', '#c64a2e'], rnd));
  solid(129.6, -80.45, 0.6, 'the workbench');
  solid(130.9, -80.45, 0.6, 'the workbench');
  solid(132.2, -80.45, 0.6, 'the workbench');
  // The tackle wall: a cabinet of shallow drawers, lure cards on a board, tackle boxes on top.
  gput(box(0.55, 1.05, 2.0), 126.45, 0.52, -79.5, '#6f5a44');
  for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) gput(box(0.02, 0.13, 0.85), 126.74, 0.15 + i * 0.16, -80.0 + j * 0.95, '#8a7258');
  gput(box(0.03, 0.9, 2.0), 126.14, 1.7, -79.5, '#c8b58e');
  for (let i = 0; i < 18; i++) gput(box(0.03, 0.1, 0.07), 126.17, 1.35 + Math.floor(i / 6) * 0.28, -80.35 + (i % 6) * 0.34, pick(['#d64933', '#f0c040', '#3f8fc4', '#7ab35a', '#e8e3d6', '#c47ad0'], rnd));
  gput(box(0.45, 0.16, 0.7), 126.45, 1.13, -80.0, '#3c6b4c');
  gput(box(0.4, 0.12, 0.55), 126.45, 1.12, -79.1, '#b3402e');
  solid(126.5, -80.1, 0.45, 'the tackle wall');
  solid(126.5, -79.0, 0.45, 'the tackle wall');
  // The rod rack on the east wall (the rods themselves are below, one mesh each).
  gput(box(0.1, 0.1, 4.6), 135.25, 0.25, -77.7, '#7a5a3c');
  gput(box(0.1, 0.1, 4.6), 135.25, 1.65, -77.7, '#7a5a3c');
  solid(135.0, -79.0, 0.35, 'the rod rack');
  solid(135.0, -76.4, 0.35, 'the rod rack');
  // The camping shelf: two deep shelves for the tent, the stove and the cool box.
  for (const y of [0.1, 0.95]) gput(box(0.75, 0.05, 3.0), 135.0, y, -73.0, '#8a6a48');
  for (const dz of [-1.45, 1.45]) gput(box(0.75, 1.0, 0.05), 135.0, 0.5, -73.0 + dz, '#7a5a3c');
  solid(135.0, -72.4, 0.45, 'the shelf');
  solid(135.0, -73.6, 0.45, 'the shelf');
  // Boots, waders, a rucksack, a coil of rope and a net by the inner door.
  gput(box(0.26, 0.3, 0.34), 126.5, 0.15, -72.6, '#2f3d34');
  gput(box(0.26, 0.3, 0.34), 126.5, 0.15, -72.25, '#2f3d34');
  gput(box(0.1, 1.1, 0.4), 126.2, 1.0, -71.6, '#3a4a3c');
  gput(box(0.32, 0.55, 0.3), 126.35, 1.3, -72.9, '#8a5a36');
  gput(new THREE.TorusGeometry(0.22, 0.05, 6, 14), 126.25, 1.55, -73.5, '#c9b27a', 0, Math.PI / 2, 0);
  gput(cyl(0.015, 0.015, 1.5, 5), 126.3, 1.0, -74.1, '#7a5a3c', 0.25, 0, 0);
  gput(new THREE.TorusGeometry(0.22, 0.015, 4, 12), 126.32, 1.78, -74.3, '#4a4f54', 0, Math.PI / 2, 0);
  solid(126.45, -72.4, 0.35, 'the boots');
  // The storm lantern on its hook by the door (it goes camping with you only in spirit).
  gput(box(0.04, 0.04, 0.12), 126.2, 1.9, -71.3, '#2f2f2f');
  gput(cyl(0.08, 0.1, 0.22, 8), 126.3, 1.66, -71.3, '#3a3f44');
  gput(cyl(0.06, 0.06, 0.12, 8), 126.3, 1.5, -71.3, '#ffd28a');
  // A loading mat at the door, where the car's boot comes to.
  gput(box(3.2, 0.012, 1.4), 130.8, 0.06, -70.9, '#4a4f54');
  group.add(mesh(mergeParts(G_PARTS, rnd), wood()));

  // The map pinned over the bench: the coast as the lanes see it (drawn once).
  // (Drawn the first time you're near: it reads the ground a few thousand times.)
  const mapTex = canvasTex(512, 300, (ctx, w, h) => drawCoastMap(ctx, w, h));
  let mapDrawn = false;
  const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.88), new THREE.MeshLambertMaterial({ map: mapTex.tex }));
  mapMesh.position.set(130.9, Y + 1.78, -80.83);
  group.add(mapMesh);

  // The rods on the rack, each its own little mesh (shown when it's at home).
  const rodMeshes = {};
  ROD_IDS.forEach((id, i) => {
    const r = RODS[id], len = Math.min(2.25, 1.2 + r.look.len * 0.3);
    const z = -79.8 + i * (4.2 / Math.max(1, ROD_IDS.length - 1));
    const parts = [
      { geo: cyl(0.012, 0.022, len, 6), matrix: mat(0, len / 2, 0), color: r.look.color },
      { geo: cyl(0.03, 0.03, 0.42, 8), matrix: mat(0, 0.24, 0), color: r.look.handle },
      { geo: r.look.reel === 'fly' ? cyl(0.06, 0.06, 0.04, 12) : box(0.07, 0.08, 0.06), matrix: mat(-0.06, 0.48, 0, 0, 0, r.look.reel === 'fly' ? Math.PI / 2 : 0), color: '#3a3f44' },
    ];
    const m = mesh(mergeParts(parts, rnd), plain());
    m.position.set(135.12, Y + 0.08, z);
    m.rotation.z = 0.06;
    group.add(m);
    rodMeshes[id] = m;
  });
  // The camping gear on its shelf.
  const kitMesh = {};
  const kmesh = (parts) => {
    const m = mesh(mergeParts(parts, rnd), plain());
    group.add(m);
    return m;
  };
  kitMesh.tent = kmesh([
    { geo: cyl(0.2, 0.2, 0.75, 12), matrix: mat(135.0, Y + 0.33, -73.9, Math.PI / 2, 0, 0), color: '#4f6b3a' },
    { geo: cyl(0.21, 0.21, 0.05, 12), matrix: mat(135.0, Y + 0.33, -73.55, Math.PI / 2, 0, 0), color: '#2f3d24' },
    { geo: cyl(0.15, 0.15, 0.6, 10), matrix: mat(135.0, Y + 0.28, -72.7, Math.PI / 2, 0, 0), color: '#3f5f86' },
  ]);
  kitMesh.stove = kmesh([
    { geo: box(0.42, 0.3, 0.42), matrix: mat(135.0, Y + 1.13, -73.9), color: '#b3402e' },
    { geo: box(0.3, 0.06, 0.3), matrix: mat(135.0, Y + 1.31, -73.9), color: '#5f6366' },
  ]);
  kitMesh.coolbox = kmesh([
    { geo: box(0.6, 0.38, 0.42), matrix: mat(135.0, Y + 1.17, -72.6, 0, Math.PI / 2, 0), color: '#3f7fa8' },
    { geo: box(0.62, 0.07, 0.44), matrix: mat(135.0, Y + 1.39, -72.6, 0, Math.PI / 2, 0), color: '#eef0ec' },
  ]);

  // ---- outside ----
  const O = [];
  const oput = (geo, x, y, z, color, rx = 0, ry = 0, rz = 0) => O.push({ geo, matrix: mat(x, y, z, rx, ry, rz), color });
  // A dry-stone wall along the front of the garden (a gap for the drive and the path).
  for (let x = HOME_PAD.x0 + 1; x < HOME_PAD.x1 - 1; x += 1.1) {
    if (x > 129.4) continue; // the drive
    if (x > 115.5 && x < 117.6) continue; // the garden gate
    const z = HOME_PAD.z1 - 0.6, y = heightAt(x, z);
    oput(box(1.15, 0.55 + rnd() * 0.15, 0.55), x, y + 0.25, z, pick(['#a59d90', '#9a9286', '#b0a898'], rnd), 0, rnd() * 0.08, 0);
  }
  // A bench in the garden looking out to sea, tubs of flowers by the door, a woodpile.
  oput(box(1.5, 0.06, 0.4), 120, Y + 0.45, -66.5, '#8a6a48');
  oput(box(1.5, 0.4, 0.06), 120, Y + 0.68, -66.72, '#8a6a48');
  for (const dx of [-0.65, 0.65]) oput(box(0.06, 0.45, 0.4), 120 + dx, Y + 0.22, -66.5, '#6b4e34');
  for (const dx of [-1.2, 1.2]) {
    oput(cyl(0.28, 0.22, 0.42, 10), H.door + dx, Y + 0.21, H.z1 + 0.45, '#9a6b4a');
    oput(new THREE.IcosahedronGeometry(0.3, 0), H.door + dx, Y + 0.55, H.z1 + 0.45, pick(['#d64979', '#e8b23a', '#a35ad0'], rnd));
  }
  for (let i = 0; i < 14; i++) oput(cyl(0.11, 0.11, 0.9, 7), 110.5 - (i % 2) * 0.05, Y + 0.12 + Math.floor(i / 7) * 0.22, -79.5 + (i % 7) * 0.24, '#8a6a48', 0, 0, Math.PI / 2);
  // The front door: a little slate canopy on two brackets, a worn doormat, and the porch lantern
  // beside it (its glass lights up in the evening: see update()).
  const FRONT = [];
  const fput = (geo, x, y, z, color, rx = 0) => FRONT.push({ geo, matrix: mat(x, y, z, rx, 0, 0), color });
  fput(box(DOOR_W + 0.7, 0.07, 0.75), H.door, Y + DOOR_H + 0.3, H.z1 + 0.36, '#4f555c', 0.14);
  for (const dx of [-(DOOR_W / 2 + 0.2), DOOR_W / 2 + 0.2]) fput(box(0.05, 0.3, 0.5), H.door + dx, Y + DOOR_H + 0.12, H.z1 + 0.32, '#3a3f44');
  fput(box(0.05, 0.05, 0.22), H.door + 1.02, Y + 2.02, H.z1 + 0.21, '#2d2f31');
  fput(box(0.17, 0.05, 0.17), H.door + 1.02, Y + 2.02, H.z1 + 0.32, '#2d2f31');
  fput(box(0.15, 0.04, 0.15), H.door + 1.02, Y + 1.76, H.z1 + 0.32, '#2d2f31');
  fput(box(0.7, 0.54, 0.04), H.door - 1.55, Y + 1.45, H.z1 + T / 2 + 0.02, '#6b4e34'); // (the chalkboard's frame)
  const front = mesh(mergeParts(FRONT, rnd), plain());
  group.add(front);
  walls.hS.userData.extra.push(front);
  oput(box(1.05, 0.03, 0.6), H.door, Y + 0.02, H.z1 + 0.45, '#7a5c3c');
  oput(box(0.86, 0.035, 0.44), H.door, Y + 0.025, H.z1 + 0.45, '#5b432b');
  // The letterbox by the drive, with the house's name.
  oput(cyl(0.05, 0.05, 1.1, 6), 129.6, heightAt(129.6, -57.2) + 0.55, -57.2, '#5a5f66');
  oput(box(0.42, 0.28, 0.22), 129.6, heightAt(129.6, -57.2) + 1.2, -57.2, '#a5482f');
  group.add(mesh(mergeParts(O, rnd), plain()));
  const porchGlass = new THREE.Mesh(box(0.12, 0.2, 0.12), new THREE.MeshLambertMaterial({ color: '#d9cfae', emissive: '#ffbf6a', emissiveIntensity: 0 }));
  porchGlass.position.set(H.door + 1.02, Y + 1.89, H.z1 + 0.32);
  group.add(porchGlass);
  const porchGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,205,140,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  porchGlow.scale.setScalar(1.3);
  porchGlow.position.copy(porchGlass.position);
  group.add(porchGlow);
  walls.hS.userData.extra.push(porchGlass, porchGlow);
  // A chalkboard by the front door: the tally of what you've actually caught (see showTally).
  const tally = canvasTex(256, 192, (ctx, w, h, lines) => {
    ctx.fillStyle = '#2b3530';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(240,240,232,0.12)';
    ctx.lineWidth = 18;
    ctx.strokeRect(20, 30, w - 40, h - 60); // (old chalk, rubbed out)
    ctx.fillStyle = 'rgba(244,242,232,0.92)';
    ctx.textAlign = 'center';
    ctx.font = '700 30px Kalam, Caveat, cursive';
    ctx.fillText(lines ? 'The tally' : 'Gone fishing', w / 2, 44);
    ctx.font = '23px Kalam, Caveat, cursive';
    (lines || ['(back soon)']).forEach((t, i) => ctx.fillText(t, w / 2, 86 + i * 34));
  });
  tally.paint(null);
  const tallyMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.46), new THREE.MeshLambertMaterial({ map: tally.tex }));
  tallyMesh.position.set(H.door - 1.55, Y + 1.45, H.z1 + T / 2 + 0.045);
  group.add(tallyMesh);
  walls.hS.userData.extra.push(tallyMesh);
  // Indoors, a soft ring on the floor where you stand to use something (the bed, the bench…).
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.4, 0.52, 32), new THREE.MeshBasicMaterial({ color: '#ffd68c', transparent: true, opacity: 0, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  group.add(ring);
  obstacles.push({ x: 120, z: -66.5, r: 0.8, kind: 'building', name: 'the garden bench' });
  obstacles.push({ x: 110.6, z: -78.7, r: 0.6, kind: 'building', name: 'the woodpile' });
  obstacles.push({ x: 129.6, z: -57.2, r: 0.25, kind: 'building', name: 'the letterbox' });
  for (let x = HOME_PAD.x0 + 1; x < HOME_PAD.x1 - 1; x += 1.1) {
    if (x > 129.4 || (x > 115.5 && x < 117.6)) continue;
    obstacles.push({ x, z: HOME_PAD.z1 - 0.6, r: 0.45, top: heightAt(x, HOME_PAD.z1 - 0.6) + 0.7, kind: 'building', name: 'the garden wall' });
  }

  // ---- light ----
  // One warm light, in whichever room you're in (or the garage, when you're outside nearby).
  const light = new THREE.PointLight('#ffc98a', 0, 9, 1.6);
  light.position.set(130.6, Y + 2.2, -76);
  group.add(light);
  const bulbGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture('rgba(255,210,150,1)'), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0 }));
  bulbGlow.scale.setScalar(0.9);
  bulbGlow.position.set(126.4, Y + 1.5, -71.3);
  group.add(bulbGlow);

  const all = [...Object.values(walls)];
  return {
    group, obstacles, spots: HOME_SPOTS, doors, rodMeshes, kitMesh, frames, keep,
    // Show the gear as it is: which rods are on the rack, which camping gear is on the shelf.
    showGear(rodsHome, kitHome) {
      for (const id of ROD_IDS) rodMeshes[id].visible = rodsHome.has(id);
      for (const k of Object.keys(kitMesh)) kitMesh[k].visible = !!kitHome[k];
    },
    showKeepsakes(have) {
      for (const k of Object.keys(keep)) keep[k].visible = !!have[k];
    },
    // imgs: up to three images (or null) for the frames; lines: the record card.
    showPictures(imgs) {
      frames.forEach((f, i) => {
        const img = imgs[i] || null;
        if (f.shown === img) return;
        f.shown = img;
        f.paint(img);
      });
    },
    showRecord(lines) {
      const key = JSON.stringify(lines);
      if (card.key === key) return;
      card.key = key;
      card.paint(lines);
    },
    // The chalkboard by the door (null: nothing caught yet).
    showTally(lines) {
      const key = JSON.stringify(lines);
      if (tally.key === key) return;
      tally.key = key;
      tally.paint(lines);
    },
    // Each frame: who's where, and what's open. from: where you are; cam: the camera position;
    // cutaway: lift the roof and the wall facing the camera (not in first person).
    update(dt, t, { from, cam, night, cutaway, onDoor }) {
      const room = insideHome(from.x, from.z);
      // Outside with your back to a wall, the camera behind you can end up in a room: that room
      // opens up the same way, its roof lifted and the wall between it and you stepping aside.
      const camRoom = !room && cutaway && cam.y < Y + WALL_H + 1.8 ? insideHome(cam.x, cam.z) : null;
      const open = room || camRoom;
      const lift = !!open && cutaway;
      roofs.visible = !lift;
      for (const w of all) {
        const { room: r, normal } = w.userData;
        let show = true;
        if (lift && (r === open || r === 'both')) {
          // The wall's outward side (for the open room): hide it if whoever's outside the room
          // (the camera, or you) is beyond it.
          const out = room ? cam : from;
          const sgn = r === 'both' && open === 'garage' ? -1 : 1;
          const nx = normal[0] * sgn, nz = normal[1] * sgn;
          const cx = r === 'both' ? GARAGE.x0 : (open === 'house' ? (HOUSE.x0 + HOUSE.x1) / 2 : (GARAGE.x0 + GARAGE.x1) / 2);
          const cz = open === 'house' ? (HOUSE.z0 + HOUSE.z1) / 2 : (GARAGE.z0 + GARAGE.z1) / 2;
          const dx = out.x - cx, dz = out.z - cz;
          const reach = r === 'both' ? 0 : Math.abs(normal[0]) ? (open === 'house' ? (HOUSE.x1 - HOUSE.x0) / 2 : (GARAGE.x1 - GARAGE.x0) / 2) : (open === 'house' ? (HOUSE.z1 - HOUSE.z0) / 2 : (GARAGE.z1 - GARAGE.z0) / 2);
          if (dx * nx + dz * nz > reach - 0.5) show = false;
        }
        w.visible = show;
        for (const e of w.userData.extra) e.visible = show;
      }
      // Doors swing open as you come to them, and closed behind you.
      for (const d of doors) {
        const near = Math.hypot(from.x - d.x, from.z - d.z) < 1.9;
        if (near !== d.was) {
          d.was = near;
          onDoor?.(near);
        }
        d.open = clamp(d.open + (near ? dt : -dt) * 2.5, 0, 1);
        d.pivot.rotation.y = d.swing * smoothstep(0, 1, d.open);
      }
      // The light: warm in the room you're in; the windows glow after dark.
      const near = Math.hypot(from.x - 124, from.z + 75) < 60;
      if (near && !mapDrawn) {
        mapDrawn = true;
        mapTex.paint();
      }
      const inGarage = room === 'garage' || (!room && Math.hypot(from.x - 130.8, from.z - 72) < 14);
      light.position.set(inGarage ? 130.6 : 119, Y + 2.25, inGarage ? -76 : -76.5);
      light.intensity = near ? (room ? 4.5 + night * 3 : night * 5) : 0;
      bulbGlow.material.opacity = near ? 0.3 + night * 0.6 : 0;
      glassMat.emissiveIntensity = night * 0.55;
      // The porch lantern comes on as the evening draws in (you can see it from down the coast).
      const dusk = smoothstep(0.05, 0.5, night);
      porchGlass.material.emissiveIntensity = dusk * 1.4;
      porchGlow.material.opacity = dusk * 0.85;
      // The ring: under the nearest thing you could use, brighter once you're there.
      let spot = null, sd = Infinity;
      if (room) {
        for (const s of HOME_SPOTS) {
          const d = Math.hypot(from.x - s.x, from.z - s.z) - s.r;
          if (d < sd) { sd = d; spot = s; }
        }
      }
      const want = spot && sd < 1.4 ? (sd < 0 ? 0.5 : 0.22) : 0;
      ring.material.opacity += (want - ring.material.opacity) * Math.min(1, dt * 6);
      ring.visible = ring.material.opacity > 0.01;
      if (spot && want) ring.position.set(spot.x, Y + 0.075, spot.z);
    },
  };
}

// The workbench's map: the coast round the bay, the lanes, home and the places you can drive to.
// (The shape of the land is the real one, from the height map.)
function drawCoastMap(ctx, w, h) {
  const x0 = -40, x1 = 200, z0 = -130, z1 = 50, k = Math.min(w / (x1 - x0), h / (z1 - z0));
  const X = (x) => (x - x0) * k + (w - (x1 - x0) * k) / 2, Z = (z) => (z - z0) * k + (h - (z1 - z0) * k) / 2;
  ctx.fillStyle = '#e9dcbc';
  ctx.fillRect(0, 0, w, h);
  const step = 3;
  for (let py = 0; py < h; py += step) {
    for (let px = 0; px < w; px += step) {
      const x = x0 + (px - (w - (x1 - x0) * k) / 2) / k, z = z0 + (py - (h - (z1 - z0) * k) / 2) / k;
      const hh = heightAt(x, z);
      ctx.fillStyle = hh < -4 ? '#9fbfc8' : hh < 0 ? '#bcd5d6' : hh < 3 ? '#e6d8b0' : hh < 9 ? '#d9cc9c' : '#cbbd8a';
      ctx.fillRect(px, py, step, step);
    }
  }
  ctx.strokeStyle = '#8a5a36';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  for (const L of LANES) {
    ctx.beginPath();
    L.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
    ctx.stroke();
  }
  ctx.fillStyle = '#3a2a1c';
  ctx.font = '700 15px Kalam, Caveat, cursive';
  ctx.textAlign = 'center';
  const label = (x, z, t, dy = -8) => ctx.fillText(t, X(x), Z(z) + dy);
  for (const [id, c] of Object.entries(CAR_PARKS)) {
    if (c.x < x0 || c.x > x1 || c.z < z0 || c.z > z1) continue;
    ctx.beginPath();
    ctx.arc(X(c.x), Z(c.z), id === 'home' ? 5 : 4, 0, Math.PI * 2);
    ctx.fillStyle = id === 'home' ? '#a5482f' : '#3a2a1c';
    ctx.fill();
  }
  ctx.fillStyle = '#3a2a1c';
  label(CAR_PARKS.home.x, CAR_PARKS.home.z - 12, 'Home');
  for (const id of ['haven', 'strand', 'head']) {
    const p = PLACES.find((q) => q.id === id);
    if (p) label(p.x, p.z + (id === 'strand' ? 18 : 14), p.name, 0);
  }
  ctx.font = '13px Kalam, Caveat, cursive';
  ctx.fillText('Wend Quay & Longmere: by road →', w - 120, 22);
  ctx.strokeStyle = 'rgba(58,42,28,0.5)';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
}

// The gravel: a ribbon along each lane, a round of it at each car park, the drive and apron in
// front of the garage, and flagstones from the garden gate to the front door. Laid just above the
// ground (which the lanes have already levelled).
export function buildGravel(rnd) {
  const pos = [], col = [];
  const c = new THREE.Color();
  const tone = () => c.set(pick(['#b9ad95', '#b2a68d', '#bfb39b', '#aca087'], rnd));
  const quad = (a, b, d, e) => {
    for (const p of [a, e, b, a, d, e]) {
      pos.push(p[0], p[1], p[2]);
      tone();
      col.push(c.r, c.g, c.b);
    }
  };
  const at = (x, z) => [x, heightAt(x, z) + 0.05, z];
  const HW = 1.75;
  for (const L of LANES) {
    for (let i = 0; i < L.length - 1; i++) {
      const [ax, az] = L[i], [bx, bz] = L[i + 1], len = Math.hypot(bx - ax, bz - az), n = Math.ceil(len / 1.2);
      const nx = -(bz - az) / len, nz = (bx - ax) / len;
      for (let k = 0; k < n; k++) {
        const u0 = k / n, u1 = (k + 1) / n;
        const x0 = ax + (bx - ax) * u0, z0 = az + (bz - az) * u0, x1 = ax + (bx - ax) * u1, z1 = az + (bz - az) * u1;
        quad(at(x0 - nx * HW, z0 - nz * HW), at(x1 - nx * HW, z1 - nz * HW), at(x0 + nx * HW, z0 + nz * HW), at(x1 + nx * HW, z1 + nz * HW));
      }
    }
  }
  for (const [id, p] of Object.entries(CAR_PARKS)) {
    if (id === 'home') continue;
    const n = 18;
    for (let k = 0; k < n; k++) {
      const a0 = (k / n) * Math.PI * 2, a1 = ((k + 1) / n) * Math.PI * 2;
      for (const [r0, r1] of [[0, p.r * 0.5], [p.r * 0.5, p.r]]) {
        quad(at(p.x + Math.cos(a0) * r0, p.z + Math.sin(a0) * r0), at(p.x + Math.cos(a1) * r0, p.z + Math.sin(a1) * r0),
          at(p.x + Math.cos(a0) * r1, p.z + Math.sin(a0) * r1), at(p.x + Math.cos(a1) * r1, p.z + Math.sin(a1) * r1));
      }
    }
  }
  // The drive and apron in front of the garage (on the level pad).
  for (let z = -69.9; z < HOME_PAD.z1 - 0.2; z += 1.2) {
    for (let x = 126.6; x < 135.2; x += 1.2) quad(at(x, z), at(x + 1.2, z), at(x, z + 1.2), at(x + 1.2, z + 1.2));
  }
  // Stepping stones worn across the grass from the drive to the front door.
  for (let i = 0; i < 6; i++) {
    const k = (i + 0.5) / 6, x = 125.8 + (HOUSE.door + 1.2 - 125.8) * k, z = -66.9 + (HOUSE.z1 + 1.6 + 66.9) * k + (rnd() - 0.5) * 0.2;
    quad(at(x - 0.38, z + 0.3), at(x + 0.36, z + 0.32), at(x - 0.34, z - 0.3), at(x + 0.38, z - 0.28));
  }
  // Flagstones from the gate to the front door.
  for (let z = HOME_PAD.z1 - 1.2; z > HOUSE.z1 + 0.3; z -= 0.9) {
    const x = HOUSE.door + (rnd() - 0.5) * 0.15;
    quad(at(x - 0.45, z), at(x + 0.4, z), at(x - 0.4, z - 0.7), at(x + 0.45, z - 0.7));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.computeVertexNormals();
  const m = new THREE.Mesh(g, withSurface(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 'ground'));
  m.receiveShadow = true;
  return m;
}
