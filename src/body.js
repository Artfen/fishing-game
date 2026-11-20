// The shapes people are made of (docs/HUMAN-TOUCH.md, H4): one set of parts for you on foot
// (walker.js), you in a boat (boat.js), your friends and the townsfolk (world/folk.js), so they're
// all the same kind of person. Each figure keeps its own joints and the way it moves; these are
// only what's hung on them:
//
//  · a head with a jaw and a chin, ears, a nose, eyes under brows and a mouth, and hair round the
//    back and sides (it shows under a hat);
//  · a neck;
//  · a body that's broad at the shoulders, in at the waist and out again at the hips, rather than
//    an egg;
//  · arms and legs that taper, wrist and ankle narrower than shoulder and hip, rounded at the ends;
//  · hands with a thumb, and boots with a toe and a heel.
//
// The head's parts are joined into one shape per colour (skin; eyes and mouth; hair and brows), so
// a better face costs no more to draw than the old ball, two dots and a nose did.
import * as THREE from 'three';

// Join shapes (each moved by its matrix) into one: positions and normals, no index.
export function joinShapes(parts) {
  const pos = [], nor = [], n = new THREE.Matrix3();
  for (const [geo, m] of parts) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const P = g.attributes.position, N = g.attributes.normal, v = new THREE.Vector3();
    n.getNormalMatrix(m);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(m);
      pos.push(v.x, v.y, v.z);
      v.fromBufferAttribute(N, i).applyMatrix3(n).normalize();
      nor.push(v.x, v.y, v.z);
    }
    if (g !== geo) g.dispose();
    geo.dispose();
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  out.computeBoundingSphere();
  return out;
}
const M4 = (x = 0, y = 0, z = 0, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(sx, sy, sz));

// A limb, one unit long and one in radius at its wide end: tapering to 0.78 at the other, with a
// rounded cap at each end so the joints don't show gaps. (Shapes are made once and shared.)
function limb(top, bottom) {
  const parts = [[new THREE.CylinderGeometry(top, bottom, 1, 10, 1, true), M4()]];
  // (The caps squashed along the limb: it's stretched to its length, and they shouldn't be.)
  parts.push([new THREE.SphereGeometry(top, 10, 4, 0, Math.PI * 2, 0, Math.PI / 2), M4(0, 0.5, 0, 1, 0.16, 1)]);
  parts.push([new THREE.SphereGeometry(bottom, 10, 4, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M4(0, -0.5, 0, 1, 0.16, 1)]);
  return joinShapes(parts);
}
let shared = null;
function shapes() {
  if (shared) return shared;
  shared = {
    // From its joint downwards (a hip to a knee, a shoulder to an elbow): wide at the top, its
    // joint at 0 and its end at −1. (folk.js, walker.js's legs.)
    limbDown: limb(1, 0.78).translate(0, -0.5, 0),
    // Between two points, centred (boat.js's and walker.js's setLimb: its +y end the far one, the
    // elbow or the wrist, the knee or the ankle): narrower there.
    limbSpan: limb(0.78, 1),
    hand: hand(),
    boot: boot(),
    torso: torso(),
    neck: new THREE.CylinderGeometry(0.052, 0.06, 0.12, 10),
  };
  return shared;
}
export const bodyShapes = () => shapes();

// A hand: the palm and fingers together, a mitten, with the thumb out to the side, for a hand of
// about the old ball's size (radius 0.045), hanging fingers down.
function hand() {
  return joinShapes([
    [new THREE.SphereGeometry(0.045, 10, 8), M4(0, -0.008, 0, 0.82, 1.18, 0.56)],
    [new THREE.SphereGeometry(0.016, 8, 6), M4(0.032, 0.01, 0.012, 1, 1.5, 1, 0, 0, -0.5)],
  ]);
}

// A boot: a rounded toe, the heel, and the ankle, about as big as the old box (0.12 × 0.1 × 0.24),
// toes towards +z.
function boot() {
  return joinShapes([
    [new THREE.CapsuleGeometry(0.052, 0.13, 4, 10).rotateX(Math.PI / 2), M4(0, -0.012, 0.012, 1.08, 0.82, 1)],
    [new THREE.CylinderGeometry(0.05, 0.055, 0.07, 10), M4(0, 0.03, -0.045)],
  ]);
}

// The body, from the hips up to the base of the neck, centred where the old capsule was (its
// middle 0.27 above the torso's pivot): a turned profile, broad at the shoulders and in at the
// waist, a little flattened front to back.
const PROFILE = [[0, -0.04], [0.13, -0.035], [0.162, 0.02], [0.165, 0.09], [0.15, 0.2], [0.158, 0.3], [0.172, 0.39], [0.178, 0.45], [0.16, 0.51], [0.11, 0.56], [0.06, 0.585], [0, 0.59]];
const TORSO_SCALE = [1.06, 1, 0.78], TORSO_LIFT = -0.27;
function torso() {
  const g = new THREE.LatheGeometry(PROFILE.map(([r, y]) => new THREE.Vector2(r, y)), 18);
  g.scale(...TORSO_SCALE);
  g.translate(0, TORSO_LIFT, 0);
  g.computeVertexNormals();
  return g;
}
// The body's radius at a height of its profile (y from −0.04 at the hips to 0.59 at the neck).
function radiusAt(y) {
  for (let i = 1; i < PROFILE.length; i++) {
    const [r0, y0] = PROFILE[i - 1], [r1, y1] = PROFILE[i];
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / Math.max(1e-6, y1 - y0);
  }
  return 0;
}
// (H4b) A band of something worn over the body: from y0 to y1 of its profile, standing off it by
// grow, in the torso's own space (so it goes on as a child of the chest mesh).
function band(y0, y1, grow = 1.06, steps = 6) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const y = y0 + ((y1 - y0) * i) / steps;
    pts.push(new THREE.Vector2(radiusAt(y) * grow + 0.004, y));
  }
  const g = new THREE.LatheGeometry(pts, 18);
  g.scale(...TORSO_SCALE);
  g.translate(0, TORSO_LIFT, 0);
  g.computeVertexNormals();
  return g;
}
// Where the front of the body is at a height of its profile, in the torso's space (for pockets).
const frontAt = (y, grow = 1) => [radiusAt(y) * grow * TORSO_SCALE[2], y + TORSO_LIFT];

// (H4b) What you can wear over all that (Settings → You), the same on every figure: the colours
// it puts on (a top: coat, jumper and shirt alike; the trousers; the boots), from your look where
// it's yours to colour, and what it adds over the body. 'weather' is as before: the raincoat,
// the jumper or the shirt as the weather has it.
export const OUTFITS = ['weather', 'oilskins', 'vest', 'lifejacket', 'hoodie', 'waders', 'wetsuit'];
export function outfitColours(outfit, L) {
  switch (outfit) {
    case 'oilskins': return { top: L.coat, legs: '#d9552b', boots: '#27352a' };
    case 'hoodie': return { top: L.jumper };
    case 'waders': return { legs: '#4a5240', boots: '#3c4334' };
    case 'wetsuit': return { top: '#1d2226', legs: '#1d2226', boots: '#1d2226' };
    default: return {};
  }
}
// The pieces it adds, to go on the chest mesh: [mesh…]. top: the top's material (a hood and a
// pocket in the hoodie's colour follow it); L: the look (a wetsuit's stripe in the raincoat's).
export function outfitParts(outfit, top, L) {
  const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
  const out = [], put = (geo, m) => {
    const o = new THREE.Mesh(geo, m);
    o.castShadow = true;
    o.name = `outfit:${outfit}`;
    out.push(o);
  };
  const braces = (c) => {
    // (Over each shoulder, from the bib at the front to the back.)
    const parts = [];
    for (const s of [1, -1]) {
      const [zf, yf] = frontAt(0.4, 1.06), [zs, ys] = frontAt(0.47, 1.08);
      parts.push([new THREE.BoxGeometry(0.035, 0.012, 0.2), M4(s * 0.09, ys + 0.03, 0, 1, 1, 1, 0, 0, 0)]);
      parts.push([new THREE.BoxGeometry(0.035, yf > 0 ? ys - yf + 0.04 : 0.1, 0.012), M4(s * 0.09, (ys + yf) / 2, zf + 0.005)]);
      parts.push([new THREE.BoxGeometry(0.035, ys - yf + 0.04, 0.012), M4(s * 0.09, (ys + yf) / 2, -zs + 0.01)]);
    }
    put(joinShapes(parts), lam(c));
  };
  const pocket = (x, y, w, h, grow) => {
    const [z, yy] = frontAt(y, grow);
    return [new THREE.BoxGeometry(w, h, 0.022), M4(x, yy, z + 0.006)];
  };
  switch (outfit) {
    case 'vest': {
      put(joinShapes([[band(0.17, 0.53, 1.075), M4()], pocket(0.065, 0.27, 0.07, 0.07, 1.075), pocket(-0.065, 0.27, 0.07, 0.07, 1.075), pocket(0.07, 0.4, 0.06, 0.05, 1.075), pocket(-0.07, 0.4, 0.06, 0.05, 1.075)]), lam('#7a7a52'));
      break;
    }
    case 'lifejacket': {
      put(joinShapes([[band(0.22, 0.54, 1.2), M4()], [new THREE.TorusGeometry(0.085, 0.035, 8, 16).rotateX(Math.PI / 2), M4(0, 0.555 + TORSO_LIFT, 0, 1.06, 1, 0.9)]]), lam('#e8642a'));
      put(band(0.27, 0.305, 1.24), lam('#2b2b2b'));
      break;
    }
    case 'hoodie': {
      const [z, y] = frontAt(0.18, 1.02);
      put(joinShapes([[new THREE.SphereGeometry(0.1, 12, 8), M4(0, 0.54 + TORSO_LIFT, -0.1, 1.35, 0.7, 0.85)], [new THREE.BoxGeometry(0.19, 0.08, 0.025), M4(0, y, z + 0.008)]]), top);
      break;
    }
    case 'waders':
    case 'oilskins': {
      put(band(-0.035, 0.41, 1.05), lam(outfit === 'waders' ? '#4a5240' : '#d9552b'));
      braces(outfit === 'waders' ? '#2f3428' : '#a83e1e');
      if (outfit === 'oilskins') put(new THREE.SphereGeometry(0.1, 12, 8).applyMatrix4(M4(0, 0.54 + TORSO_LIFT, -0.1, 1.35, 0.7, 0.85)), top);
      break;
    }
    case 'wetsuit': {
      put(band(0.36, 0.43, 1.02), lam(L.coat));
      break;
    }
    default:
  }
  return out;
}

// The head (for a head of radius R, 0.13 for you; the old ball's size), facing +z, its middle
// at 0: { group, skin, dark, hair } (the meshes, for their materials; group goes where the old
// ball did). hair: its material (the hair's colour: brows and the hair round the back and sides).
export function buildHead(skinMat, darkMat, hairMat, R = 0.13) {
  const group = new THREE.Group();
  const skull = M4(0, 0.006, 0, 0.93, 1.04, 0.98);
  const skin = new THREE.Mesh(joinShapes([
    [new THREE.SphereGeometry(R, 20, 14), skull],
    // (The jaw and chin: a little narrower than the skull, and forward.)
    [new THREE.SphereGeometry(R * 0.74, 16, 10), M4(0, -R * 0.36, R * 0.2, 0.96, 0.82, 0.92)],
    // (The ears.)
    [new THREE.SphereGeometry(R * 0.26, 8, 6), M4(R * 0.9, -R * 0.02, -R * 0.04, 0.42, 1, 0.72)],
    [new THREE.SphereGeometry(R * 0.26, 8, 6), M4(-R * 0.9, -R * 0.02, -R * 0.04, 0.42, 1, 0.72)],
    // (The nose: smaller and more of a nose than the old ball.)
    [new THREE.SphereGeometry(R * 0.15, 8, 6), M4(0, -R * 0.06, R * 0.98, 0.62, 0.95, 1.05)],
  ]), skinMat);
  skin.castShadow = true;
  const fz = (x, y) => Math.sqrt(Math.max(0, R * R - x * x - y * y)) * 0.97;
  const dark = new THREE.Mesh(joinShapes([
    // (The eyes, set into the face, and a line of a mouth.)
    [new THREE.SphereGeometry(R * 0.085, 8, 6), M4(R * 0.33, R * 0.1, fz(R * 0.33, R * 0.1), 1, 1.1, 0.6)],
    [new THREE.SphereGeometry(R * 0.085, 8, 6), M4(-R * 0.33, R * 0.1, fz(R * 0.33, R * 0.1), 1, 1.1, 0.6)],
    [new THREE.BoxGeometry(R * 0.34, R * 0.045, R * 0.06), M4(0, -R * 0.42, R * 0.86)],
  ]), darkMat);
  const hair = new THREE.Mesh(joinShapes([
    // (Round the back and sides, the hairline high at the front: under a hat it shows below it.)
    [new THREE.SphereGeometry(R * 1.045, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.56), M4(0, R * 0.04, -R * 0.05, 0.95, 1.04, 1, -0.42)],
    // (The brows.)
    [new THREE.BoxGeometry(R * 0.3, R * 0.07, R * 0.08), M4(R * 0.34, R * 0.3, fz(R * 0.34, R * 0.3), 1, 1, 1, 0, 0, -0.12)],
    [new THREE.BoxGeometry(R * 0.3, R * 0.07, R * 0.08), M4(-R * 0.34, R * 0.3, fz(R * 0.34, R * 0.3), 1, 1, 1, 0, 0, 0.12)],
  ]), hairMat);
  hair.castShadow = true;
  group.add(skin, dark, hair);
  return { group, skin, dark, hair };
}

// A beard round the jaw (short: stubble-close; full: down over the chin), in the hair's colour,
// for a head of radius R: it follows the jaw as buildHead makes it.
export function beardShape(kind, R = 0.13) {
  const full = kind === 'full';
  return joinShapes([
    // (Round the jaw, from ear to ear across the chin.)
    // (Short: close along the jawline and under the chin, the mouth clear; full: up the cheeks and
    // over the chin.)
    full
      ? [new THREE.SphereGeometry(R * 0.79, 16, 8, Math.PI * 0.08, Math.PI * 0.84, Math.PI * 0.45, Math.PI * 0.4), M4(0, -R * 0.33, R * 0.2, 0.98, 0.98, 0.97)]
      : [new THREE.SphereGeometry(R * 0.765, 16, 6, Math.PI * 0.1, Math.PI * 0.8, Math.PI * 0.6, Math.PI * 0.3), M4(0, -R * 0.36, R * 0.2, 0.98, 0.9, 0.97)],
    // (The moustache.)
    [new THREE.CapsuleGeometry(R * (full ? 0.06 : 0.045), R * 0.2, 2, 6).rotateZ(Math.PI / 2), M4(0, -R * 0.3, R * 0.9, 1, 1, 0.8)],
    ...(full ? [[new THREE.SphereGeometry(R * 0.36, 10, 8), M4(0, -R * 0.68, R * 0.5, 1, 1.05, 0.8)]] : []),
  ]);
}

// (H4) Where the elbow goes for a hand at T from a shoulder at S: an upper arm of 0.3 and a forearm
// of 0.29 meeting at the elbow, bent towards pole (a direction: out to the side and down, for most
// things a hand holds). A hand further off than the arm reaches (an oar's handle at the end of a
// stroke) has the arm straightened and stretched that little bit, rather than the hand let go of
// it. Writes the elbow into out.
const _ik = new THREE.Vector3(), _pole = new THREE.Vector3();
export const ARM = { upper: 0.3, fore: 0.29 };
export function elbowFor(S, T, pole, out) {
  _ik.subVectors(T, S);
  let d = _ik.length();
  if (d < 1e-5) return out.copy(S).addScaledVector(pole, ARM.upper);
  _ik.divideScalar(d);
  const k = Math.max(1, d / ((ARM.upper + ARM.fore) * 0.985)), U = ARM.upper * k, F = ARM.fore * k;
  d = Math.max(d, Math.abs(U - F) + 0.02);
  const along = (U * U - F * F + d * d) / (2 * d), h = Math.sqrt(Math.max(0, U * U - along * along));
  _pole.copy(pole).addScaledVector(_ik, -pole.dot(_ik));
  if (_pole.lengthSq() < 1e-8) _pole.set(0, -1, 0).addScaledVector(_ik, _ik.y);
  _pole.normalize();
  return out.copy(S).addScaledVector(_ik, along).addScaledVector(_pole, h);
}
