import * as THREE from 'three';
import { heightAt, waterLevel, STACKS, SKERRIES, CALF, CALF_SKERRY, GANNET, PUFFIN_COVE, MARSH, SANDBANKS, STRAND, COVE, DAYMARK, LAKE, MERE, STREAM, RIVER } from './terrain.js';
import { COLDWATER } from './coldwater.js';
import { waveHeight } from './water.js';
import { VILLAGE, PUERTO, MOLE, FARO_POINT, ARCO, ROJA, ISLE, PLAYA, GAVIOTA, HONDA } from './brasa.js';
import { SKARV, RAVEN, SELKIE, BOTHY_BAY, TERN } from './north.js';
import { BIRDS } from '../birdData.js';
import { clamp, damp, dampAngle, wrapAngle, mergeParts, mat, seeded } from '../util.js';

// The birds of the coast (see birdData.js for who they are): each where it really lives, doing
// what it really does.
//
//  · Gannet Isle's cliffs: guillemots packed on the ledges and razorbills among them, puffins on
//    the turf over Puffin Cove (all three rafted on the sea below, in spring and summer), fulmars
//    gliding the cliff face on stiff wings, a peregrine high over it all.
//  · Gull Rock: kittiwakes on the stacks' ledges and wheeling round them in spring and summer,
//    fulmars along the faces, shags at the foot.
//  · The Skerries and the Calf's skerry: shags and great black-backed gulls on the rocks, eiders
//    rafted on the water. Round the Calf's cliff tops a pair of choughs tumbling, ravens above.
//  · Cove Head: a kestrel hovering over the grass. Shell Strand: turnstones working the tideline,
//    a rock pipit in the rocks at the cove end.
//  · The Saltings and the Wend's sandbanks: redshanks, curlews and little egrets on the mud.
//  · The Fernbeck and the upper Wend: a kingfisher on a perch by the water, dashing off low and
//    blue; dippers bobbing on the stones of the Fernbeck and the Coldwater.
//  · Reedmere and Longmere: mute swans and mallards.
//  · Out at sea past the bay mouth, in spring and summer: Manx shearwaters skimming the waves.
//  · Las Brasas: yellow-legged gulls round the harbour and on the mole, an osprey over the west
//    cliffs, a kestrel over the Roja, whimbrels and turnstones on the Faro point's rocks, little
//    egrets by the harbour, Berthelot's pipits and canaries round the village, plain swifts
//    screaming over it, and at night Bulwer's petrels low over the sea.
//  · Up the coast, the Selkie Isles: guillemots and kittiwakes on Skarv Stack, puffins and
//    razorbills off Raven Isle, a peregrine and ravens over its cliffs, eiders in the sound; a
//    white-tailed eagle soaring over Loch Skarn and another over Raven Isle, each now and then
//    gliding down to snatch a fish from the water; Arctic terns nesting on Tern Isle's machair in
//    spring and summer (walk among the nests and they're up and at your head) and fishing the
//    shallows off its beaches, hovering and plunging.
//
// Birds that stand or swim go up if you come too close, fly round, and settle again. Only the
// colonies near you are drawn. The game hears what you've seen up close (seenNear) and what's in
// the middle of the binoculars (spot).

const lit = new THREE.MeshLambertMaterial({ vertexColors: true });
const litBoth = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
const ACTIVE = 650;   // m: colonies further than this aren't drawn
const _v = new THREE.Vector3();

// Each kind's body: length and wingspan (m), colours, bill, legs, how it stands and flies.
// fly: glide (soaring, a few flaps), flap (steady wingbeats), whirr (auks: fast, low), skim (low
// over the waves, tilting), hover, dash (low and straight along the water), flit (small, bounding),
// tumble (choughs), swift. stand: 'upright' (auks, shags), 'wade' (long legs), or level.
const LOOK = {
  fulmar: { len: 0.47, span: 1.07, back: '#a7aeb3', belly: '#f2f2ee', head: '#f4f4f0', bill: '#cbb985', legs: '#c9b8a0', tip: '#8a9196', chord: 0.15, fly: 'glide', flap: 0.12, sp: 9 },
  kittiwake: { len: 0.4, span: 1.0, back: '#b6bcc1', belly: '#f6f6f2', head: '#f6f6f2', bill: '#e3cd47', legs: '#151515', tip: '#111111', chord: 0.17, fly: 'glide', flap: 0.55, sp: 8 },
  shag: { len: 0.72, span: 1.0, back: '#1d2622', belly: '#1f2924', head: '#1b2420', bill: '#2a2a24', gape: '#e8c64a', legs: '#151515', tip: '#141a18', chord: 0.2, stand: 'upright', neck: 0.24, fly: 'flap', sp: 13 },
  puffin: { len: 0.29, span: 0.53, back: '#141414', belly: '#f4f4f0', head: '#141414', face: '#e6e6e2', bill: '#e3622a', billDeep: true, legs: '#f08a3a', tip: '#141414', chord: 0.16, stand: 'upright', fly: 'whirr', sp: 14 },
  razorbill: { len: 0.4, span: 0.66, back: '#121212', belly: '#f4f4f0', head: '#121212', bill: '#121212', billDeep: true, legs: '#202020', tip: '#121212', chord: 0.16, stand: 'upright', fly: 'whirr', sp: 14 },
  guillemot: { len: 0.4, span: 0.68, back: '#3a2c24', belly: '#f4f4f0', head: '#3a2c24', bill: '#1a1a1a', legs: '#2a2a2a', tip: '#3a2c24', chord: 0.16, stand: 'upright', fly: 'whirr', sp: 14 },
  gbbgull: { len: 0.7, span: 1.6, back: '#202224', belly: '#f4f4f0', head: '#f4f4f0', bill: '#e3c44a', legs: '#d8b8b0', tip: '#141414', chord: 0.17, fly: 'glide', flap: 0.35, sp: 9 },
  peregrine: { len: 0.42, span: 1.0, back: '#4a5866', belly: '#e8e2d4', head: '#1e2228', bill: '#3a3a3a', legs: '#e3c44a', tip: '#2a323a', chord: 0.18, fly: 'glide', flap: 0.3, sp: 14 },
  chough: { len: 0.4, span: 0.8, back: '#101012', belly: '#121214', head: '#101012', bill: '#d02e28', billLen: 1.5, legs: '#d02e28', tip: '#0a0a0c', chord: 0.24, fly: 'tumble', flap: 0.6, sp: 9 },
  raven: { len: 0.62, span: 1.3, back: '#0c0c0e', belly: '#0e0e10', head: '#0c0c0e', bill: '#0c0c0e', billDeep: true, legs: '#0c0c0e', tip: '#060608', chord: 0.24, fly: 'glide', flap: 0.4, sp: 10, tail: 'wedge' },
  kestrel: { len: 0.34, span: 0.75, back: '#a8643a', belly: '#e6d0a6', head: '#8a8e96', bill: '#3a3a3a', legs: '#e3c44a', tip: '#2a2420', chord: 0.19, fly: 'hover', sp: 6 },
  manx: { len: 0.33, span: 0.8, back: '#141416', belly: '#f4f4f0', head: '#141416', bill: '#2a2a2a', legs: '#d8c8c0', tip: '#0e0e10', chord: 0.13, fly: 'skim', sp: 11 },
  eider: { len: 0.6, span: 0.95, back: '#f2f0ea', belly: '#141414', head: '#f2f0ea', cap: '#141414', nape: '#9ec09a', bill: '#a8b098', legs: '#6a6a50', tip: '#141414', chord: 0.2, fly: 'flap', sp: 12 },
  redshank: { len: 0.28, span: 0.6, back: '#7a6a58', belly: '#d8cfc0', head: '#7a6a58', bill: '#c4402a', billLen: 1.3, legs: '#e4502a', stand: 'wade', legLen: 1.5, tip: '#3a3028', chord: 0.18, fly: 'flap', sp: 11 },
  turnstone: { len: 0.23, span: 0.5, back: '#7a4a2a', belly: '#f2f0ea', head: '#f2f0ea', bill: '#141414', legs: '#e4822a', stand: 'wade', legLen: 0.9, tip: '#141414', chord: 0.18, fly: 'flap', sp: 11 },
  egret: { len: 0.6, span: 0.95, back: '#f8f8f6', belly: '#f8f8f6', head: '#f8f8f6', bill: '#141414', billLen: 1.6, legs: '#141414', feet: '#e3cd47', stand: 'wade', legLen: 2.4, neck: 0.3, tip: '#f0f0ee', chord: 0.24, fly: 'flap', flapSlow: true, sp: 7 },
  curlew: { len: 0.55, span: 0.9, back: '#8a7254', belly: '#d8c8a8', head: '#8a7254', bill: '#3a3028', billLen: 2.6, billCurve: true, legs: '#7a8288', stand: 'wade', legLen: 1.5, tip: '#3a3028', chord: 0.2, fly: 'flap', sp: 11 },
  rockpipit: { len: 0.17, span: 0.25, back: '#6a6a58', belly: '#c8c4a8', head: '#6a6a58', bill: '#2a2a24', legs: '#3a3028', tip: '#3a3a30', chord: 0.24, fly: 'flit', sp: 7 },
  kingfisher: { len: 0.17, span: 0.25, back: '#1d8fd6', belly: '#e8782a', head: '#1a6aa8', bill: '#141414', billLen: 1.9, legs: '#d8402a', tip: '#145a90', chord: 0.24, fly: 'dash', sp: 13 },
  dipper: { len: 0.18, span: 0.28, back: '#3a2c24', belly: '#f4f4f0', head: '#5a3a28', bill: '#2a2a24', legs: '#6a5a4a', tip: '#2a201a', chord: 0.24, fly: 'dash', sp: 9 },
  muteswan: { len: 1.5, span: 2.2, back: '#f8f8f6', belly: '#f8f8f6', head: '#f8f8f6', bill: '#e3782a', legs: '#141414', neck: 0.55, tip: '#f0f0ee', chord: 0.22, fly: 'flap', flapSlow: true, sp: 14 },
  mallard: { len: 0.58, span: 0.9, back: '#8a8478', belly: '#c8c8c4', head: '#1a5a3a', collar: '#f4f4f0', bill: '#e3cd47', legs: '#e4822a', tip: '#4a5a8a', chord: 0.2, fly: 'flap', sp: 14 },
  ylgull: { len: 0.6, span: 1.4, back: '#8e969c', belly: '#f6f6f2', head: '#f6f6f2', bill: '#e3c44a', legs: '#e3c44a', tip: '#141414', chord: 0.17, fly: 'glide', flap: 0.4, sp: 9 },
  osprey: { len: 0.57, span: 1.6, back: '#4a3828', belly: '#f2f0ea', head: '#f2f0ea', mask: '#3a2a20', bill: '#1a1a1a', legs: '#c8d0c8', tip: '#2a2018', chord: 0.2, fly: 'glide', flap: 0.3, sp: 9 },
  bulwer: { len: 0.27, span: 0.7, back: '#2a2420', belly: '#2a2420', head: '#2a2420', bill: '#141414', legs: '#c8b8b0', tip: '#1a1612', chord: 0.15, fly: 'skim', sp: 10, tail: 'wedge' },
  whimbrel: { len: 0.42, span: 0.8, back: '#7a6650', belly: '#d8ccb4', head: '#7a6650', cap: '#3a3028', bill: '#2a2420', billLen: 2.0, billCurve: true, legs: '#6a7278', stand: 'wade', legLen: 1.5, tip: '#3a3028', chord: 0.2, fly: 'flap', sp: 11 },
  bpipit: { len: 0.14, span: 0.23, back: '#8a8a80', belly: '#e8e4d8', head: '#8a8a80', bill: '#3a3a30', legs: '#c8b8a0', tip: '#4a4a40', chord: 0.24, fly: 'flit', sp: 7 },
  canary: { len: 0.13, span: 0.22, back: '#9aa04a', belly: '#d6d64a', head: '#c6c64a', bill: '#c8b89a', legs: '#a89a8a', tip: '#4a4a30', chord: 0.24, fly: 'flit', sp: 7 },
  plainswift: { len: 0.15, span: 0.4, back: '#2a2622', belly: '#2a2622', head: '#2a2622', bill: '#141414', legs: '#141414', tip: '#1a1612', chord: 0.12, fly: 'swift', sp: 18, tail: 'fork' },
  // (Up the coast.) The eagle: broad "barn door" wings, a pale head, a heavy yellow bill, a short
  // white wedge of a tail; seen from a long way off. The Arctic tern: pale grey, black cap, red bill
  // and legs, long white tail streamers.
  wteagle: { len: 0.86, span: 2.3, back: '#5a4431', belly: '#4b3727', head: '#cbbd9b', bill: '#e6c048', billDeep: true, billLen: 1.2, legs: '#e6c048', tip: '#241a12', tailColor: '#f1eee4', chord: 0.27, fly: 'glide', flap: 0.08, sp: 11, tail: 'wedge', far: 1400, carry: true },
  arctictern: { len: 0.34, span: 0.78, back: '#c3cad0', belly: '#e9ecee', head: '#f2f2ef', cap: '#121212', bill: '#c8302a', billLen: 1.4, legs: '#c8302a', tip: '#8c959c', tailColor: '#f2f2ef', chord: 0.15, fly: 'glide', flap: 0.75, sp: 8, tail: 'fork' },
};
// How near you can come before it goes up (m).
const FLUSH = { puffin: 12, razorbill: 14, guillemot: 14, shag: 16, gbbgull: 22, eider: 25, redshank: 30, curlew: 40, egret: 30, turnstone: 10, rockpipit: 8, kingfisher: 15, dipper: 10, muteswan: 8, mallard: 12, ylgull: 10, whimbrel: 25, bpipit: 6, canary: 6, kittiwake: 10, arctictern: 28 };
// (A tern comes up with the rest of the colony if its nest is within MOB_JOIN of you, and keeps at
// you until you're MOB_TILL from its nest, m.)
const MOB_JOIN = 55, MOB_TILL = 70;

// One bird's shape, nose along +z: body, head, bill, tail, legs; wings that pivot at the shoulder.
function buildBird(kind) {
  const L = LOOK[kind], s = L.len;
  const g = new THREE.Group();
  g.rotation.order = 'YXZ';
  const body = new THREE.Group();
  g.add(body);
  const legH = L.stand === 'wade' ? s * 0.32 * (L.legLen || 1) : s * 0.12;
  const parts = [
    { geo: new THREE.SphereGeometry(s * 0.2, 8, 6), matrix: mat(0, legH + s * 0.12, 0, 0, 0, 0, 0.85, 0.8, 1.55), color: L.back },
    { geo: new THREE.SphereGeometry(s * 0.19, 8, 6, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), matrix: mat(0, legH + s * 0.115, 0, 0, 0, 0, 0.88, 0.85, 1.5), color: L.belly },
  ];
  // The neck and head: forward, up a little (a long neck for the swan and the egret).
  const nk = L.neck || 0;
  const hx = 0, hy = legH + s * (0.2 + nk * 1.2), hz = s * (0.3 + (L.stand === 'upright' ? -0.08 : 0)) + nk * s * 0.2;
  if (nk) parts.push({ geo: new THREE.CylinderGeometry(s * 0.045, s * 0.07, nk * s * 1.6, 6), matrix: mat(0, legH + s * 0.12 + nk * s * 0.7, s * 0.24, 0.35, 0, 0), color: L.head });
  const hr = s * 0.11;
  parts.push({ geo: new THREE.SphereGeometry(hr, 8, 6), matrix: mat(hx, hy, hz), color: L.head });
  if (L.cap) parts.push({ geo: new THREE.SphereGeometry(hr * 1.04, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2.2), matrix: mat(hx, hy, hz), color: L.cap });
  if (L.face) parts.push({ geo: new THREE.SphereGeometry(hr * 0.75, 7, 5), matrix: mat(0, hy - hr * 0.1, hz + hr * 0.4, 0, 0, 0, 1.3, 1, 0.6), color: L.face });
  if (L.mask) parts.push({ geo: new THREE.BoxGeometry(hr * 2.1, hr * 0.35, hr * 1.4), matrix: mat(0, hy + hr * 0.1, hz), color: L.mask });
  if (L.nape) parts.push({ geo: new THREE.SphereGeometry(hr * 0.7, 6, 5), matrix: mat(0, hy, hz - hr * 0.6), color: L.nape });
  if (L.collar) parts.push({ geo: new THREE.TorusGeometry(hr * 0.9, hr * 0.15, 4, 10), matrix: mat(0, hy - hr * 0.9, hz - hr * 0.3, Math.PI / 2 - 0.3, 0, 0), color: L.collar });
  // The bill: a cone (deep for the auks and the raven, long for the waders, curved for curlews).
  const bl = s * 0.11 * (L.billLen || 1), bw = hr * (L.billDeep ? 0.55 : 0.28);
  if (L.billCurve) {
    for (let i = 0; i < 3; i++) parts.push({ geo: new THREE.CylinderGeometry(bw * (0.8 - i * 0.2), bw * (1 - i * 0.2), bl / 3, 4), matrix: mat(0, hy - hr * 0.2 - i * i * bl * 0.06, hz + hr + bl * (i + 0.5) / 3, Math.PI / 2 + 0.25 + i * 0.22, 0, 0), color: L.bill });
  } else parts.push({ geo: new THREE.ConeGeometry(bw, bl, 4), matrix: mat(0, hy - hr * 0.15, hz + hr + bl * 0.45, Math.PI / 2, 0, 0, 1, 1, L.billDeep ? 1.8 : 1), color: L.bill });
  if (L.gape) parts.push({ geo: new THREE.SphereGeometry(hr * 0.25, 5, 4), matrix: mat(0, hy - hr * 0.25, hz + hr * 0.8), color: L.gape });
  // The tail: a short fan, a wedge, or a fork.
  const tl = s * (L.tail === 'wedge' ? 0.32 : L.tail === 'fork' ? 0.3 : 0.24);
  if (L.tail === 'fork') {
    for (const sd of [1, -1]) parts.push({ geo: new THREE.ConeGeometry(s * 0.04, tl, 3), matrix: mat(sd * s * 0.04, legH + s * 0.12, -s * 0.3 - tl * 0.4, -Math.PI / 2, 0, sd * 0.25), color: L.tailColor || L.back });
  } else parts.push({ geo: new THREE.ConeGeometry(s * (L.tail === 'wedge' ? 0.1 : 0.08), tl, 4), matrix: mat(0, legH + s * 0.13, -s * 0.3 - tl * 0.35, -Math.PI / 2, 0, 0, 1.4, 1, 0.35), color: L.tailColor || L.tip });
  body.add(new THREE.Mesh(mergeParts(parts), lit));
  // (The eagle's catch, held under it on the way up: hidden until it has one.)
  let fish = null;
  if (L.carry) {
    fish = new THREE.Mesh(mergeParts([
      { geo: new THREE.SphereGeometry(s * 0.09, 7, 5), matrix: mat(0, 0, 0, 0, 0, 0, 0.55, 0.7, 2.4), color: '#b8c2c6' },
      { geo: new THREE.ConeGeometry(s * 0.06, s * 0.12, 3), matrix: mat(0, 0, -s * 0.27, -Math.PI / 2, 0, 0, 1, 1, 0.3), color: '#8a969b' },
    ]), lit);
    fish.position.set(0, legH - s * 0.06, s * 0.04);
    fish.visible = false;
    body.add(fish);
  }
  // Legs (and the egret's yellow feet), shown standing and wading.
  const legs = new THREE.Mesh(mergeParts([1, -1].flatMap((sd) => [
    { geo: new THREE.CylinderGeometry(s * 0.015, s * 0.015, legH, 4), matrix: mat(sd * s * 0.05, legH / 2, 0), color: L.legs },
    ...(L.feet ? [{ geo: new THREE.BoxGeometry(s * 0.06, s * 0.01, s * 0.08), matrix: mat(sd * s * 0.05, 0.005, s * 0.02), color: L.feet }] : []),
  ])), lit);
  body.add(legs);
  // Wings: one each side, inner and tip, the tip darker; narrow for the gliders and the swift.
  const span = L.span / 2, chord = L.span * L.chord;
  const wing = (sd) => {
    const geo = new THREE.BufferGeometry();
    const sw = L.fly === 'swift' ? 0.35 : 0;
    const p = [0, 0, chord * 0.5, 0, 0, -chord * 0.5, span * 0.55 * sd, 0, chord * 0.3 - sw * span * 0.3, span * 0.55 * sd, 0, chord * 0.3 - sw * span * 0.3, 0, 0, -chord * 0.5, span * 0.55 * sd, 0, -chord * 0.45 - sw * span * 0.3,
      span * 0.55 * sd, 0, chord * 0.3 - sw * span * 0.3, span * 0.55 * sd, 0, -chord * 0.45 - sw * span * 0.3, span * sd, 0, -chord * 0.4 - sw * span];
    const a = new THREE.Color(L.back), b = new THREE.Color(L.tip), c = [];
    for (let i = 0; i < 6; i++) c.push(a.r, a.g, a.b);
    for (let i = 0; i < 3; i++) c.push(b.r, b.g, b.b);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, litBoth);
    m.position.set(sd * s * 0.06, legH + s * 0.17, s * 0.04);
    body.add(m);
    return m;
  };
  return { g, body, legs, wl: wing(1), wr: wing(-1), legH, fish };
}

/* ---------------- where they live ---------------- */

// Points round (cx, cz) between r0 and r1 that pass test(x, z, h) (which gives the y to stand at,
// or null): steady from one game to the next.
function spots(rnd, cx, cz, r0, r1, n, test, tries = 60) {
  const out = [];
  for (let i = 0; i < n * tries && out.length < n; i++) {
    const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
    const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
    const y = test(x, z, heightAt(x, z));
    if (y != null) out.push({ x, y, z, face: Math.atan2(cx - x, cz - z) + Math.PI });
  }
  return out;
}
// A ledge: up off the water, the ground falling away beside it (drop m within 4 m).
const ledge = (lo, hi, drop = 2.2) => (x, z, h) => {
  if (h < lo || h > hi) return null;
  let low = h;
  for (let k = 0; k < 6; k++) low = Math.min(low, heightAt(x + Math.cos(k) * 4, z + Math.sin(k) * 4));
  return low < h - drop ? h : null;
};
// The ledges of Gull Rock's stacks (see world.js buildStacks: five rough layers, each a little
// narrower, from below the water to the top, and a white cap): on the outside of each step, and
// one on the cap.
function stackLedges(rnd, S, n) {
  const out = [], hgt = (S.h + 5) / 5;
  for (let i = 0; i < n; i++) {
    // (Near the top of a layer, on its rough outer face: the faces are jagged by up to a fifth of
    // their width, so a little out from the middle of them.)
    const L = 1 + Math.floor(rnd() * 3), y = -5 + (L + 0.9) * hgt;
    const r = S.r * 1.15 * 0.88 ** L * 1.06, a = rnd() * Math.PI * 2;
    out.push({ x: S.x + Math.cos(a) * r, y, z: S.z + Math.sin(a) * r, face: Math.atan2(Math.cos(a), Math.sin(a)) });
  }
  return out;
}
const rock = (lo, hi) => (x, z, h) => (h >= lo && h <= hi ? h : null);
const mud = (lo = -0.25, hi = 0.45) => (x, z, h) => (h >= lo && h <= hi && waterLevel(x, z) <= 0.5 ? Math.max(h, 0) : null);
const water = (min = 0.8) => (x, z, h) => (waterLevel(x, z) - h > min ? waterLevel(x, z) : null);
const ground = (lo, hi) => (x, z, h) => (h >= lo && h <= hi ? h : null);
// Points along a river's banks (nodes: [x, z, half-width, …]): on the bank edge, the water beside.
function banks(rnd, nodes, n, from = 0, to = nodes.length - 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const k = Math.min(to - 1, from + Math.floor(rnd() * (to - from)));
    const a = nodes[k], b = nodes[k + 1], u = rnd();
    const x = a[0] + (b[0] - a[0]) * u, z = a[1] + (b[1] - a[1]) * u, w = (a[2] + (b[2] - a[2]) * u) * 0.9;
    const dx = b[0] - a[0], dz = b[1] - a[1], len = Math.hypot(dx, dz) || 1, sd = rnd() < 0.5 ? 1 : -1;
    const px = x + (-dz / len) * w * sd, pz = z + (dx / len) * w * sd;
    out.push({ x: px, y: Math.max(heightAt(px, pz), waterLevel(px, pz)) + 0.3, z: pz, face: Math.atan2(dx, dz), along: Math.atan2(dx, dz) });
  }
  return out;
}

// The colonies: kind, where, how many, and what they do there ('glide' over a centre, 'perch' on
// ledges or rocks, 'swim', 'wade', 'skim' the sea, 'hover', 'dash' along a river, 'flit').
function colonies(rnd) {
  const C = [];
  const add = (kind, how, at, extra = {}) => { if (at.length) C.push({ kind, how, at, ...extra }); };
  const G = GANNET, S0 = STACKS[0];
  // Gannet Isle's cliffs and Puffin Cove.
  // (The island's rocky edge, just up from the water: it has no high cliffs.)
  add('guillemot', 'perch', spots(rnd, G.x, G.z, G.r * 0.5, G.r * 1.0, 12, ledge(1.2, 6, 1.2)));
  add('razorbill', 'perch', spots(rnd, G.x, G.z, G.r * 0.5, G.r * 1.0, 6, ledge(1.2, 6, 1.2)));
  add('guillemot', 'swim', spots(rnd, G.x, G.z, G.r * 1.05, G.r * 1.5, 6, water(3)));
  add('razorbill', 'swim', spots(rnd, G.x, G.z, G.r * 1.05, G.r * 1.5, 4, water(3)));
  add('puffin', 'perch', spots(rnd, PUFFIN_COVE.x, PUFFIN_COVE.z, 15, 70, 8, ground(2, 12)));
  add('puffin', 'swim', spots(rnd, PUFFIN_COVE.x, PUFFIN_COVE.z, 0, PUFFIN_COVE.r + 10, 8, water(1.5)));
  add('fulmar', 'glide', [{ x: G.x, y: 22, z: G.z, r: G.r * 0.95 }, { x: G.x - 20, y: 30, z: G.z + 30, r: G.r * 0.8 }, { x: G.x + 10, y: 16, z: G.z - 20, r: G.r * 1.05 }]);
  add('peregrine', 'glide', [{ x: G.x, y: 75, z: G.z, r: 60 }]);
  // Gull Rock.
  add('kittiwake', 'perch', STACKS.flatMap((S) => stackLedges(rnd, S, 3)));
  add('kittiwake', 'glide', [{ x: S0.x, y: 12, z: S0.z, r: 22 }, { x: S0.x + 6, y: 16, z: S0.z + 8, r: 16 }, { x: S0.x - 4, y: 9, z: S0.z + 4, r: 30 }]);
  add('fulmar', 'glide', [{ x: S0.x, y: 18, z: S0.z, r: 34 }, { x: S0.x + 10, y: 14, z: S0.z + 12, r: 26 }]);
  add('shag', 'perch', STACKS.slice(0, 2).map((S) => ({ x: S.x + S.r * 1.25, y: -5 + (S.h + 5) / 5 + 0.1, z: S.z, face: Math.PI / 2 })));
  // The Skerries and the Calf.
  add('shag', 'perch', SKERRIES.flatMap((S) => spots(rnd, S.x, S.z, 0, S.r + 1, 1, rock(0.15, 5))));
  add('gbbgull', 'perch', [...spots(rnd, SKERRIES[0].x, SKERRIES[0].z, 0, SKERRIES[0].r, 2, rock(0.15, 6)), ...spots(rnd, CALF_SKERRY.x, CALF_SKERRY.z, 0, CALF_SKERRY.r, 1, rock(0.3, 6))]);
  add('shag', 'perch', spots(rnd, CALF_SKERRY.x, CALF_SKERRY.z, 0, CALF_SKERRY.r + 1, 2, rock(0.3, 5)));
  add('eider', 'swim', spots(rnd, SKERRIES[0].x, SKERRIES[0].z, 18, 60, 8, water(1.5)));
  add('chough', 'glide', [{ x: CALF.x, y: 14, z: CALF.z, r: 28 }, { x: CALF.x + 6, y: 18, z: CALF.z - 4, r: 22 }]);
  add('raven', 'glide', [{ x: CALF.x + 40, y: 55, z: CALF.z - 30, r: 50 }, { x: CALF.x + 48, y: 60, z: CALF.z - 22, r: 46 }]);
  // Cove Head and Shell Strand.
  add('kestrel', 'hover', spots(rnd, DAYMARK.x, DAYMARK.z, 6, 40, 1, ground(3, 40)).map((p) => ({ ...p, y: p.y + 14 })));
  add('turnstone', 'wade', spots(rnd, STRAND.x, STRAND.z, 0, 40, 5, mud(-0.2, 0.6)));
  add('rockpipit', 'flit', spots(rnd, COVE.x, COVE.z, COVE.r * 0.8, COVE.r + 24, 2, rock(0.3, 3)));
  // The Saltings and the sandbanks.
  for (const M of MARSH) {
    add('redshank', 'wade', spots(rnd, M.x, M.z, 0, M.r + 14, 2, mud()));
    add('curlew', 'wade', spots(rnd, M.x, M.z, 0, M.r + 14, 1, mud()));
  }
  add('egret', 'wade', spots(rnd, MARSH[1].x, MARSH[1].z, 0, MARSH[1].r + 14, 2, mud()));
  add('redshank', 'wade', spots(rnd, SANDBANKS[0].x, SANDBANKS[0].z, 0, SANDBANKS[0].rx + 6, 3, mud()));
  // Rivers and lakes.
  add('kingfisher', 'dash', banks(rnd, STREAM, 3));
  add('kingfisher', 'dash', banks(rnd, RIVER, 3, 0, Math.min(5, RIVER.length - 1)));
  add('dipper', 'dash', banks(rnd, STREAM, 3));
  add('dipper', 'dash', banks(rnd, COLDWATER.map((n) => [n.x ?? n[0], n.z ?? n[1], n.w ?? n[2] ?? 2]), 3, 0, Math.min(8, COLDWATER.length - 1)));
  add('muteswan', 'swim', spots(rnd, LAKE.x, LAKE.z, 0, LAKE.rx * 0.8, 2, water(0.8)));
  add('mallard', 'swim', spots(rnd, LAKE.x, LAKE.z, 0, LAKE.rx * 0.9, 4, water(0.5)));
  add('muteswan', 'swim', spots(rnd, MERE.x, MERE.z, 0, MERE.rx * 0.8, 3, water(0.8)));
  add('mallard', 'swim', spots(rnd, MERE.x + 80, MERE.z - 20, 0, 60, 6, water(0.5)));
  // Out at sea.
  add('manx', 'skim', [{ x: 0, y: 1.5, z: 620, r: 230 }, { x: 60, y: 1.2, z: 700, r: 180 }, { x: -60, y: 1.8, z: 560, r: 200 }, { x: 30, y: 1.4, z: 640, r: 260 }, { x: -20, y: 1.6, z: 680, r: 210 }, { x: 10, y: 1.3, z: 600, r: 240 }]);
  // Las Brasas.
  add('ylgull', 'glide', [{ x: PUERTO.x, y: 20, z: PUERTO.z, r: 50 }, { x: PUERTO.x + 20, y: 26, z: PUERTO.z + 10, r: 40 }, { x: PUERTO.x - 10, y: 16, z: PUERTO.z - 10, r: 60 }]);
  add('ylgull', 'perch', Array.from({ length: 4 }, () => { const x = MOLE.x0 + rnd() * (MOLE.x1 - MOLE.x0); return { x, y: MOLE.deck, z: (MOLE.z0 + MOLE.z1) / 2, face: Math.PI / 2 }; }));
  add('osprey', 'glide', [{ x: ARCO.x, y: 40, z: ARCO.z, r: 80 }]);
  add('kestrel', 'hover', spots(rnd, ROJA.x, ROJA.z, 30, ROJA.r * 0.8, 1, ground(20, 150)).map((p) => ({ ...p, y: p.y + 14 })));
  const fx = FARO_POINT.x0 + (FARO_POINT.x1 - FARO_POINT.x0) * 0.6, fz = FARO_POINT.z0 + (FARO_POINT.z1 - FARO_POINT.z0) * 0.6;
  add('whimbrel', 'wade', spots(rnd, fx, fz, 20, 90, 2, rock(0.2, 2.5)));
  add('turnstone', 'wade', spots(rnd, fx, fz, 20, 90, 3, rock(0.2, 2)));
  add('egret', 'wade', spots(rnd, PLAYA.x, PLAYA.z, 30, 120, 2, rock(0.2, 2)));
  add('bpipit', 'flit', spots(rnd, VILLAGE.x, VILLAGE.z, VILLAGE.r, VILLAGE.r + 80, 3, ground(4, 60)));
  add('canary', 'flit', spots(rnd, VILLAGE.x, VILLAGE.z, 20, VILLAGE.r + 30, 4, ground(3, 40)));
  add('plainswift', 'skim', Array.from({ length: 8 }, (_, i) => ({ x: VILLAGE.x + (rnd() - 0.5) * 60, y: 30 + rnd() * 20, z: VILLAGE.z - 40 + (rnd() - 0.5) * 60, r: 60 + i * 9 })));
  // (The archipelago) Isla Gaviota's gulls: a colony on the ledges of its weather cliffs, and more
  // wheeling over them; and terns and waders on Isla Honda's sand.
  add('ylgull', 'perch', spots(rnd, GAVIOTA.x - 40, GAVIOTA.z - 60, 60, 190, 26, ledge(6, 40, 3)));
  add('ylgull', 'glide', Array.from({ length: 5 }, (_, i) => ({ x: GAVIOTA.x - 60 + (rnd() - 0.5) * 120, y: 30 + rnd() * 18, z: GAVIOTA.z - 90 + (rnd() - 0.5) * 80, r: 50 + i * 12 })));
  add('turnstone', 'wade', spots(rnd, HONDA.cove.x, HONDA.cove.z, HONDA.cove.r, HONDA.cove.r + 40, 3, rock(0.2, 1.6)));
  add('whimbrel', 'wade', spots(rnd, HONDA.x, HONDA.z, 80, 220, 2, rock(0.2, 2)));
  add('bulwer', 'skim', Array.from({ length: 5 }, (_, i) => ({ x: ISLE.x + (rnd() - 0.5) * 200, y: 1.2, z: ISLE.z + ISLE.rz + 120 + i * 30, r: 260 + i * 40 })));
  // (The north, up the coast: docs/NORTH.md) Skarv Stack's colony, guillemots and kittiwakes packed on
  // its ledges, fulmars round it, shags at its foot; puffins on Raven Isle's north-west slopes and
  // rafting off them, razorbills; a peregrine and the ravens the island's named for over its
  // cliffs; eiders in the sound and off the Selkie Rocks.
  // (Skarv's ledges: on its sheer face, from a few metres up to near its top, facing out.)
  const skarvLedges = (n) => Array.from({ length: n }, () => {
    const a = rnd() * Math.PI * 2, y = 8 + rnd() * (SKARV.h - 14), r = SKARV.r + 0.8;
    return { x: SKARV.x + Math.cos(a) * r, y, z: SKARV.z + Math.sin(a) * r, face: Math.atan2(Math.cos(a), Math.sin(a)) };
  });
  add('guillemot', 'perch', skarvLedges(22));
  add('kittiwake', 'perch', skarvLedges(14));
  add('guillemot', 'swim', spots(rnd, SKARV.x, SKARV.z, SKARV.r + 8, SKARV.r + 70, 10, water(4)));
  add('fulmar', 'glide', [{ x: SKARV.x, y: 50, z: SKARV.z, r: 45 }, { x: SKARV.x + 20, y: 40, z: SKARV.z + 15, r: 60 }, { x: RAVEN.x - RAVEN.rx, y: 60, z: RAVEN.z - 300, r: 90 }]);
  add('kittiwake', 'glide', [{ x: SKARV.x, y: 30, z: SKARV.z, r: 40 }, { x: SKARV.x - 15, y: 22, z: SKARV.z + 10, r: 55 }]);
  add('shag', 'perch', spots(rnd, SKARV.x, SKARV.z, SKARV.r, SKARV.r + 12, 4, rock(0.2, 4)));
  add('puffin', 'perch', spots(rnd, RAVEN.x - 300, RAVEN.z - 520, 20, 140, 12, ground(10, 70)));
  add('puffin', 'swim', spots(rnd, RAVEN.x - 380, RAVEN.z - 600, 0, 120, 12, water(3)));
  add('razorbill', 'swim', spots(rnd, RAVEN.x - 420, RAVEN.z - 520, 0, 140, 6, water(3)));
  add('peregrine', 'glide', [{ x: RAVEN.x - 380, y: 110, z: RAVEN.z - 200, r: 80 }]);
  add('raven', 'glide', [{ x: RAVEN.x - 250, y: 120, z: RAVEN.z, r: 90 }, { x: RAVEN.x - 240, y: 128, z: RAVEN.z + 12, r: 84 }]);
  add('eider', 'swim', spots(rnd, SELKIE[0].x, SELKIE[0].z, 30, 120, 10, water(1.5)));
  add('eider', 'swim', spots(rnd, BOTHY_BAY.x, BOTHY_BAY.z, 0, BOTHY_BAY.r, 6, water(1.2)));
  // (Step 5's last: docs/NORTH.md.) A white-tailed eagle over Loch Skarn by Bothy Bay and another
  // high over Raven Isle, each a colony of its own (drawn from far off); Arctic terns nesting on
  // Tern Isle's machair and fishing round its shores. With dice of their own, after everything
  // else: no other bird moves for them.
  const own = seeded(20261119);
  add('wteagle', 'soar', [{ x: BOTHY_BAY.x + 60, y: 150, z: BOTHY_BAY.z + 90, r: 150 }]);
  add('wteagle', 'soar', [{ x: RAVEN.x - 100, y: 240, z: RAVEN.z + 150, r: 160 }]);
  add('arctictern', 'nest', spots(own, TERN.x, TERN.z, 60, 300, 26, ground(2.6, 8)));
  add('arctictern', 'plunge', spots(own, TERN.x, TERN.z, 360, 470, 6, water(1.5)).map((p, i) => ({ ...p, y: 8 + (i % 3), r: 18 + (i % 4) * 6 })));
  // (Each colony's middle, for drawing only those near you.)
  for (const c of C) {
    c.cx = c.at.reduce((s, p) => s + p.x, 0) / c.at.length;
    c.cz = c.at.reduce((s, p) => s + p.z, 0) / c.at.length;
    c.reach = Math.max(...c.at.map((p) => Math.hypot(p.x - c.cx, p.z - c.cz) + (p.r || 0)));
    c.south = c.cz > 4000;
  }
  return C;
}

export function buildBirds(scene, { seed = 20261110 } = {}) {
  const rnd = seeded(seed);
  const C = colonies(rnd);
  const birds = [];
  for (const c of C) {
    c.birds = [];
    for (const p of c.at) {
      const m = buildBird(c.kind);
      m.g.visible = false;
      scene.add(m.g);
      const b = { ...m, kind: c.kind, how: c.how, home: p, colony: c, L: LOOK[c.kind], x: p.x, y: p.y, z: p.z, heading: p.face || 0, a: rnd() * Math.PI * 2, dir: rnd() < 0.5 ? 1 : -1, ph: rnd() * 10, t: 2 + rnd() * 30, state: c.how === 'perch' || c.how === 'wade' || c.how === 'flit' || c.how === 'dash' || c.how === 'nest' ? 'stand' : c.how === 'swim' ? 'swim' : 'fly', vx: 0, vz: 0, tx: p.x, tz: p.z };
      c.birds.push(b);
      birds.push(b);
    }
  }
  const pose = (b) => {
    b.g.position.set(b.x, b.y, b.z);
    b.g.rotation.y = b.heading;
  };
  const showWings = (b, on) => {
    b.wl.visible = b.wr.visible = on;
    b.legs.visible = !on || b.L.stand === 'wade';
  };
  const flapWings = (b, t, amp, rate) => {
    const f = Math.sin(t * rate + b.ph) * amp;
    b.wl.rotation.z = f;
    b.wr.rotation.z = -f;
  };
  const seaY = (x, z, t) => (z > 4000 || Math.abs(waterLevel(x, z)) < 0.05 ? waveHeight(x, z, t) : waterLevel(x, z));

  // Water deep enough to take a fish from, somewhere round (x, z) within r: { x, z } or null.
  const fishingWater = (x, z, r0, r1, depth) => {
    for (let k = 0; k < 16; k++) {
      const a = Math.random() * Math.PI * 2, d = r0 + Math.random() * (r1 - r0);
      const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
      if (waterLevel(px, pz) - heightAt(px, pz) > depth) return { x: px, z: pz };
    }
    return null;
  };
  // Round and round its circle (the gliders, the eagle between stoops, a tern between dives).
  const circle = (b, dt, t, r, sp, y) => {
    b.a += ((sp / Math.max(3, r)) * dt) * b.dir;
    b.x = b.home.x + Math.cos(b.a) * r;
    b.z = b.home.z + Math.sin(b.a) * r;
    b.y = y;
    b.heading = Math.atan2(-Math.sin(b.a) * b.dir, Math.cos(b.a) * b.dir);
  };

  // The eagle: wide circles high up, hardly a wingbeat; every few minutes a long shallow glide
  // down to the water, feet swung forward at the last, a fish snatched from the surface with a
  // splash, and heavy wingbeats back up with it.
  function soar(b, dt, t, from) {
    const L = b.L, h = b.home;
    if (!b.mode) Object.assign(b, { mode: 'circle', t: 30 + Math.random() * 150 });
    b.t -= dt;
    showWings(b, true);
    if (b.mode === 'circle') {
      circle(b, dt, t, h.r * (1 + 0.12 * Math.sin(t * 0.04 + b.ph)), L.sp, h.y + Math.sin(t * 0.3 + b.ph) * 4);
      b.g.rotation.z = -0.22 * b.dir;
      b.body.rotation.x = 0;
      flapWings(b, t, ((t * 0.13 + b.ph) % 1) < L.flap ? 0.35 : 0.04, 3.2);
      b.legs.visible = false;
      if (b.fish && b.t < 0) b.fish.visible = false;
      if (b.t < 0) {
        const to = fishingWater(h.x, h.z, 60, h.r + 420, 3);
        b.t = 90 + Math.random() * 120;
        if (to) Object.assign(b, { mode: 'stoop', tx: to.x, tz: to.z, sy: b.y, sd: Math.max(1, Math.hypot(to.x - b.x, to.z - b.z)), t: 120 });
      }
    } else if (b.mode === 'stoop') {
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      const sea = seaY(b.tx, b.tz, t), v = 16;
      if (d > 0.01) {
        const st = Math.min(d, v * dt);
        b.x += (dx / d) * st;
        b.z += (dz / d) * st;
        b.heading = dampAngle(b.heading, Math.atan2(dx, dz), 2, dt);
      }
      // (A straight glide down: the last thirty metres flattening out a metre over the water.)
      const k = clamp(d / b.sd, 0, 1);
      b.y = sea + 1 + (b.sy - sea - 1) * k * (k < 0.08 ? k / 0.08 : 1);
      b.g.rotation.z = 0;
      b.body.rotation.x = d > 20 ? 0.18 : -0.25;
      flapWings(b, t, 0.08, 2);
      b.legs.visible = d < 25;
      if (d < 1 || b.t < 0) {
        b.y = sea + 0.6;
        Object.assign(b, { mode: 'climb', t: 0 });
        if (b.fish) b.fish.visible = true;
        out.onSplash?.(b.x, b.z, 0.5);
        if (Math.hypot(from.x - b.x, from.z - b.z) < 500) out.onMoment?.('eagleFish', 'A white-tailed eagle comes down the loch in one long glide, swings its feet forward and snatches a fish from the surface in a burst of spray, then labours back up into the sky with it.');
      }
    } else {
      // Back up: slow, heavy wingbeats, out to its circle and up to its height.
      const r = h.r, ax = h.x + Math.cos(b.a) * r, az = h.z + Math.sin(b.a) * r;
      const dx = ax - b.x, dz = az - b.z, d = Math.hypot(dx, dz);
      if (d > 1) {
        const st = Math.min(d, 9 * dt);
        b.x += (dx / d) * st;
        b.z += (dz / d) * st;
        b.heading = dampAngle(b.heading, Math.atan2(dx, dz), 1.5, dt);
      }
      b.y = Math.min(h.y, b.y + 3 * dt);
      b.g.rotation.z = 0;
      b.body.rotation.x = -0.1;
      flapWings(b, t, 0.5, 4);
      b.legs.visible = true;
      if (b.y >= h.y - 4 && d < 8) {
        b.a = Math.atan2(b.z - h.z, b.x - h.x);
        // (A few minutes up there before the next.)
        Object.assign(b, { mode: 'circle', t: 150 + Math.random() * 200 });
      }
    }
  }

  // An Arctic tern on its nest on the machair: sitting tight, until you walk among the nests. Then
  // it's up and over your head with the rest, screaming, swooping at you, until you've gone on
  // (MOB_TILL from its nest), when it drops back to the nest.
  function nest(b, dt, t, from, near) {
    const L = b.L, h = b.home;
    const fromNest = Math.hypot(from.x - h.x, from.z - h.z);
    if (b.state === 'stand') {
      Object.assign(b, { x: h.x, y: h.y, z: h.z });
      b.body.rotation.x = Math.max(0, Math.sin(t * 0.7 + b.ph)) * 0.15;
      b.g.rotation.z = 0;
      showWings(b, false);
      // (One that sees you close puts the whole colony up round you.)
      const alarm = t - (b.colony.alarm ?? -1e9) < 0.5 && fromNest < MOB_JOIN;
      if (near && (fromNest < FLUSH.arctictern || alarm)) {
        Object.assign(b, { state: 'mob', mr: 3.5 + Math.random() * 5, my: 3 + Math.random() * 3, t: 1 + Math.random() * 3, a: Math.random() * Math.PI * 2, call: Math.random() * 2 });
        b.body.rotation.x = 0;
        if (!alarm) out.onMoment?.('ternMob', 'The terns are up all round you, screaming, and one swoops at your head: you’re among their nests. Walk on to the beach and they’ll settle again.');
      }
    } else if (b.state === 'mob') {
      // Round and over you, each at its own height and distance; now and then a dive at your head.
      b.t -= dt;
      b.call -= dt;
      b.colony.alarm = t;
      b.a += (L.sp / b.mr) * dt * b.dir;
      const swoop = b.t < 0 ? Math.max(0, 1 - Math.abs(b.t + 0.6) / 0.6) : 0;
      if (b.t < -1.2) b.t = 2 + Math.random() * 4;
      const r = b.mr * (1 - swoop * 0.8);
      const tx = from.x + Math.cos(b.a) * r, tz = from.z + Math.sin(b.a) * r;
      const ground = Math.max(heightAt(tx, tz), waterLevel(tx, tz));
      b.x = damp(b.x, tx, 4, dt);
      b.z = damp(b.z, tz, 4, dt);
      b.y = damp(b.y, ground + b.my - swoop * (b.my - 2.1), 4, dt);
      b.heading = Math.atan2(-Math.sin(b.a) * b.dir, Math.cos(b.a) * b.dir);
      b.g.rotation.z = -0.4 * b.dir;
      showWings(b, true);
      flapWings(b, t, 0.6, 11);
      if (b.call < 0) {
        b.call = 0.8 + Math.random() * 2.5;
        out.onCall?.(b.kind, b.x, b.z);
      }
      if (!near || fromNest > MOB_TILL) b.state = 'home';
    } else {
      // Back down onto its nest.
      const dx = h.x - b.x, dz = h.z - b.z, d = Math.hypot(dx, dz);
      if (d > 0.05) {
        const st = Math.min(d, 9 * dt);
        b.x += (dx / d) * st;
        b.z += (dz / d) * st;
        b.heading = Math.atan2(dx, dz);
      }
      b.y = damp(b.y, h.y + Math.min(4, d * 0.3), 3, dt);
      showWings(b, true);
      flapWings(b, t, 0.6, 11);
      b.g.rotation.z = 0;
      if (d < 0.3) {
        Object.assign(b, { state: 'stand', x: h.x, y: h.y, z: h.z, heading: h.face ?? b.heading });
      } else if (near && fromNest < MOB_JOIN && t - (b.colony.alarm ?? -1e9) < 0.5) b.state = 'mob';
    }
  }

  // An Arctic tern fishing: flying its beat over the shallows, a pause to hover with wings a blur,
  // then a plunge straight in after a sandeel, and up again.
  function plunge(b, dt, t, from) {
    const L = b.L, h = b.home;
    b.mode ??= 'fly';
    b.t -= dt;
    showWings(b, true);
    if (b.mode === 'fly') {
      circle(b, dt, t, h.r, L.sp, damp(b.y, h.y + Math.sin(t * 0.5 + b.ph) * 1.5, 1, dt));
      b.g.rotation.z = -0.3 * b.dir;
      b.body.rotation.x = 0;
      flapWings(b, t, 0.6, 8);
      if (b.t < 0) {
        const deep = waterLevel(b.x, b.z) - heightAt(b.x, b.z) > 0.8;
        Object.assign(b, deep ? { mode: 'hover', t: 1.2 + Math.random() * 1.6 } : { t: 2 + Math.random() * 4 });
        if (deep && Math.random() < 0.5) out.onCall?.(b.kind, b.x, b.z);
      }
    } else if (b.mode === 'hover') {
      b.body.rotation.x = -0.6;
      b.g.rotation.z = 0;
      flapWings(b, t, 0.7, 22);
      if (b.t < 0) Object.assign(b, { mode: 'dive', vy: 0 });
    } else if (b.mode === 'dive') {
      b.vy += 25 * dt;
      b.y -= b.vy * dt;
      b.body.rotation.x = 1.2;
      b.wl.rotation.z = 1.4;
      b.wr.rotation.z = -1.4;
      const sea = seaY(b.x, b.z, t);
      if (b.y <= sea) {
        b.y = sea;
        out.onSplash?.(b.x, b.z, 0.08);
        if (Math.hypot(from.x - b.x, from.z - b.z) < 90) out.onMoment?.('arcticternDive', 'An Arctic tern hangs over the water off the beach, wings a blur, then folds and drops straight in, and is up again with a sandeel crossways in its bill.');
        Object.assign(b, { mode: 'rise', t: 1.5 });
      }
    } else {
      b.y += 4 * dt;
      b.body.rotation.x = -0.4;
      flapWings(b, t, 0.6, 9);
      if (b.t < 0) Object.assign(b, { mode: 'fly', t: 5 + Math.random() * 10 });
    }
  }

  // One bird's step. from: where you are (for flushing).
  function step(b, dt, t, from, near) {
    const L = b.L, h = b.home;
    const flushR = FLUSH[b.kind] || 12;
    const close = near && Math.hypot(from.x - b.x, from.z - b.z) < flushR;
    if (b.how === 'soar') soar(b, dt, t, from);
    else if (b.how === 'nest') nest(b, dt, t, from, near);
    else if (b.how === 'plunge') plunge(b, dt, t, from);
    else if (b.how === 'glide' || b.how === 'skim') {
      // Round and round the centre (the swifts and the choughs more wildly).
      const r = h.r * (1 + 0.15 * Math.sin(t * 0.05 + b.ph));
      const sp = L.sp * (b.how === 'skim' && L.fly === 'swift' ? 1 + 0.4 * Math.sin(t * 0.7 + b.ph) : 1);
      b.a += ((sp / r) * dt) * b.dir;
      b.x = h.x + Math.cos(b.a) * r;
      b.z = h.z + Math.sin(b.a) * r;
      const bob = L.fly === 'tumble' ? Math.sin(t * 1.3 + b.ph) * 4 : L.fly === 'swift' ? Math.sin(t * 0.9 + b.ph) * 8 : Math.sin(t * 0.4 + b.ph) * 2;
      b.y = b.how === 'skim' ? seaY(b.x, b.z, t) + h.y + Math.abs(Math.sin(t * 0.6 + b.ph)) * (L.fly === 'swift' ? 10 : 1.2) : h.y + bob;
      b.heading = Math.atan2(-Math.sin(b.a) * b.dir, Math.cos(b.a) * b.dir);
      // Banking: into the turn; the shearwaters tilt from side to side, the choughs roll.
      b.g.rotation.z = b.how === 'skim' && L.fly !== 'swift' ? Math.sin(t * 1.4 + b.ph) * 0.9 : L.fly === 'tumble' ? Math.sin(t * 2 + b.ph) * 0.7 : -0.25 * b.dir;
      showWings(b, true);
      const flapping = L.fly === 'swift' || L.fly === 'tumble' || ((t * 0.17 + b.ph) % 1) < (L.flap ?? 0.5);
      flapWings(b, t, flapping ? 0.55 : 0.06, L.fly === 'swift' ? 16 : L.fly === 'skim' ? 9 : 7);
    } else if (b.how === 'hover') {
      // Hovering into the wind: head still, wings and tail working; now and then on a little way.
      b.t -= dt;
      if (b.t < 0) {
        b.t = 8 + Math.random() * 14;
        b.tx = h.x + (Math.random() - 0.5) * 50;
        b.tz = h.z + (Math.random() - 0.5) * 50;
      }
      b.x = damp(b.x, b.tx, 0.3, dt);
      b.z = damp(b.z, b.tz, 0.3, dt);
      b.y = damp(b.y, h.y + Math.sin(t * 0.3 + b.ph) * 1.5, 1, dt);
      b.heading = dampAngle(b.heading, Math.atan2(b.tx - b.x, b.tz - b.z), 1, dt);
      b.g.rotation.z = 0;
      showWings(b, true);
      flapWings(b, t, 0.45, 18);
    } else if (b.how === 'swim') {
      // Paddling about near its place; up and away a little way if you come too close.
      if (close) {
        b.tx = h.x + (b.x - from.x) * 1.5;
        b.tz = h.z + (b.z - from.z) * 1.5;
      } else if ((b.t -= dt) < 0) {
        b.t = 6 + Math.random() * 12;
        b.tx = h.x + (Math.random() - 0.5) * 16;
        b.tz = h.z + (Math.random() - 0.5) * 16;
      }
      const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
      const v = d > 0.3 ? Math.min(close ? 2.5 : 0.35, d) : 0;
      if (v) {
        b.x += (dx / d) * v * dt;
        b.z += (dz / d) * v * dt;
        b.heading = dampAngle(b.heading, Math.atan2(dx, dz), 2, dt);
      }
      b.y = seaY(b.x, b.z, t) - L.len * 0.08 - b.legH;
      b.g.rotation.z = 0;
      showWings(b, close && d > 4);
      if (close && d > 4) flapWings(b, t, 0.6, 10);
    } else {
      // Standing (perched, wading, a pipit on the ground): pecking about; up if you come close,
      // or now and then, a loop out and back (a dash along the river for the kingfisher).
      if (b.state === 'stand') {
        b.t -= dt;
        if (b.how === 'wade' && Math.random() < dt * 0.15) {
          b.tx = h.x + (Math.random() - 0.5) * 8;
          b.tz = h.z + (Math.random() - 0.5) * 8;
        }
        const dx = b.tx - b.x, dz = b.tz - b.z, d = Math.hypot(dx, dz);
        if (b.how === 'wade' && d > 0.2) {
          const v = Math.min(0.35, d);
          b.x += (dx / d) * v * dt;
          b.z += (dz / d) * v * dt;
          b.heading = dampAngle(b.heading, Math.atan2(dx, dz), 3, dt);
          b.y = Math.max(heightAt(b.x, b.z), 0);
        }
        // (Upright on a ledge; pecking, bobbing.)
        const peck = b.how === 'wade' || b.how === 'flit' ? Math.max(0, Math.sin(t * 2.2 + b.ph)) * 0.5 : 0;
        b.body.rotation.x = (L.stand === 'upright' ? -1.05 : 0) + peck + (b.kind === 'dipper' ? Math.max(0, Math.sin(t * 5 + b.ph)) * 0.3 : 0);
        b.g.rotation.z = 0;
        showWings(b, false);
        if (close || b.t < 0) {
          b.state = 'fly';
          b.t = (b.how === 'dash' ? 2.5 : b.how === 'flit' ? 2 : 7 + Math.random() * 6);
          b.a = Math.atan2(b.z - h.z, b.x - h.x) + (Math.random() - 0.5);
          b.r = b.how === 'dash' ? 0 : b.how === 'flit' ? 4 + Math.random() * 6 : 10 + Math.random() * 18;
          b.lift = b.how === 'flit' || b.how === 'dash' ? 1.5 : 5 + Math.random() * 8;
          // (A kingfisher or a dipper: off low along the river to another of its perches.)
          if (b.how === 'dash') {
            const next = b.colony.at[Math.floor(Math.random() * b.colony.at.length)];
            b.home = next;
          }
          b.body.rotation.x = 0;
        }
      } else {
        // A loop out and back to its place (or on to the next perch along the river).
        b.t -= dt;
        const H = b.home;
        if (b.how === 'dash') {
          const dx = H.x - b.x, dz = H.z - b.z, d = Math.hypot(dx, dz);
          const v = Math.min(L.sp, d / Math.max(0.2, b.t));
          if (d > 0.2) {
            b.x += (dx / d) * v * dt;
            b.z += (dz / d) * v * dt;
            b.heading = Math.atan2(dx, dz);
          }
          b.y = damp(b.y, H.y + (d > 1 ? 0.3 : 0), 4, dt);
          if (d < 0.3 || b.t < -3) b.state = 'land';
        } else {
          b.a += ((L.sp / Math.max(3, b.r)) * dt) * b.dir;
          const k = clamp(b.t / 1.5, 0, 1), back = 1 - clamp((b.t - 1.5) / 3, 0, 1);
          const r = b.r * (b.t > 1.5 ? 1 : k);
          const tx = H.x + Math.cos(b.a) * r, tz = H.z + Math.sin(b.a) * r;
          b.heading = Math.atan2(tx - b.x, tz - b.z) || b.heading;
          b.x = damp(b.x, tx, 3, dt);
          b.z = damp(b.z, tz, 3, dt);
          b.y = damp(b.y, H.y + b.lift * (b.t > 1.5 ? 1 : k), 2, dt);
          b.g.rotation.z = -0.3 * b.dir * (1 - back * 0.5);
          if (b.t <= 0) b.state = 'land';
        }
        showWings(b, true);
        flapWings(b, t, 0.6, b.L.fly === 'whirr' || b.L.fly === 'dash' || b.L.fly === 'flit' ? 20 : b.L.flapSlow ? 5 : 9);
        if (b.state === 'land') {
          b.state = 'stand';
          b.x = H.x;
          b.y = H.y;
          b.z = H.z;
          b.tx = H.x;
          b.tz = H.z;
          b.heading = H.face ?? b.heading;
          b.t = (b.how === 'dash' ? 6 : b.how === 'flit' ? 5 : 25) + Math.random() * 40;
        }
      }
    }
    pose(b);
  }

  const out = {
    birds,
    colonies: C,
    // (The game hears of the eagle's and the terns' splashes, the terns' calls, and the moments
    // worth a word: see main.js.)
    onSplash: null, onCall: null, onMoment: null,
    // ctx: { from (you), daylight, season ('spring' …), region ('home' | 'south'), near (on foot or
    // close: birds go up) }.
    update(dt, t, ctx) {
      const { from, daylight = 1, season = 'summer', region = 'home', near = true } = ctx;
      for (const c of C) {
        const B = BIRDS[c.kind] || {};
        // (A small bird isn't drawn from as far off as a big one: you couldn't see it anyway.)
        const range = LOOK[c.kind].far || clamp(LOOK[c.kind].span * 350, 150, ACTIVE);
        const live = (c.south ? region === 'south' : region !== 'south')
          && Math.hypot(c.cx - from.x, c.cz - from.z) < range + c.reach
          && (B.night ? daylight < 0.15 : daylight > 0.15)
          && (!B.when || B.when.includes(season));
        for (const b of c.birds) {
          // (Out of sight, a bird that was up is back on its place by the time you return.)
          if (!live && b.g.visible && b.how === 'nest' && b.state !== 'stand') Object.assign(b, { state: 'stand', x: b.home.x, y: b.home.y, z: b.home.z });
          if (!live && b.g.visible && b.state === 'fly' && b.how !== 'glide' && b.how !== 'skim' && b.how !== 'hover' && b.how !== 'soar' && b.how !== 'plunge') {
            b.home = b.colony.at.includes(b.home) ? b.home : b.colony.at[0];
            Object.assign(b, { state: 'stand', x: b.home.x, y: b.home.y, z: b.home.z, tx: b.home.x, tz: b.home.z, t: 10 + Math.random() * 30 });
            b.body.rotation.x = 0;
          }
          b.g.visible = live;
          if (live) step(b, dt, t, from, near);
        }
      }
    },
    // The kinds you've seen up close: within a few lengths of its wingspan, and in view.
    seenNear(frustum, cam) {
      const kinds = new Set();
      for (const b of birds) {
        if (!b.g.visible || kinds.has(b.kind)) continue;
        const range = clamp(b.L.span * 28, 12, 60);
        _v.set(b.x, b.y + b.L.len * 0.3, b.z);
        if (_v.distanceTo(cam) < range && frustum.containsPoint(_v)) kinds.add(b.kind);
      }
      return [...kinds];
    },
    // What's in the middle of the binoculars: the bird nearest the line of sight (within how wide
    // it looks, or a little more), out to `far`. { kind, d, off, tol } or null.
    spot(cam, dir, far = 700) {
      let best = null, score = Infinity;
      for (const b of birds) {
        if (!b.g.visible) continue;
        _v.set(b.x - cam.x, b.y + b.L.len * 0.3 - cam.y, b.z - cam.z);
        const d = _v.length();
        if (d > far || d < 1) continue;
        const off = Math.acos(clamp(_v.dot(dir) / d, -1, 1));
        const tol = Math.max(0.012, Math.atan2(b.L.span * 0.7, d));
        if (off < tol && off / tol < score) {
          score = off / tol;
          best = { kind: b.kind, d, off, tol };
        }
      }
      return best;
    },
    // For a photograph: the kinds in the frame, near enough to make out.
    inFrame(frustum, cam) {
      const kinds = new Set();
      for (const b of birds) {
        if (!b.g.visible) continue;
        _v.set(b.x, b.y, b.z);
        if (_v.distanceTo(cam) < clamp(b.L.span * 40, 15, 90) && frustum.containsPoint(_v)) kinds.add(b.kind);
      }
      return [...kinds];
    },
  };
  return out;
}

export const BIRD_LOOK = LOOK;
