import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, smoothstep, mergeParts, mat, wrapAngle } from './util.js';
import { waveHeight } from './world/water.js';
import { windAt, currentAt, currentScale, conditions } from './world/conditions.js';
import { solidHeight, PIERS, SEA, SOUTH_Z, CROSSING } from './world/terrain.js';
import { SOUTH_RECT } from './world/brasa.js';
import { buildLanternModel, buildRod, bendRod } from './props.js';
import { withSurface } from './world/surface.js';
import { RODS } from './tackle.js';
import { Rope } from './rope.js';
import { reachFor, berthAt } from './mooring.js';
import { Dress } from './dress.js';
import { sailForce, hullDrag, boardGrip, heelFor, SAIL, boardDrag, finGrip } from './sailing.js';

// The boats. Each has its own hull (metres; the bow points along local +z), its own
// way of moving and its own place to sit:
//  · row: the rowing boat you start with. Steady, roomy, quick enough under oars.
//  · skiff: the same hull with an outboard: the boat for the open coast and the far islands.
//  · kayak: narrow, low and slow, but silent, and it floats in a hand's depth of water: the
//    boat for creeping up on fish in the shallows, the saltings and the reeds.
//  · bass: a broad, flat lake boat with a big outboard for getting about, a quiet electric
//    motor for fishing (the lever's first notches), and a steady casting deck with a locker.
//  · cabin: a little wooden cabin boat, slow and steady, with a cuddy forward holding a bunk and
//    a galley stove: a camp that floats (anchor it, or tie up, and go inside).
//  · sail: a little gaff-free sloop of about sixteen feet, tan sails on a wooden mast: she goes
//    where the wind lets her (see sailing.js), steered with the tiller, her mainsheet hauled in
//    and eased by hand. With the sail down, a pair of oars; and a little outboard on a bracket
//    on her quarter for when there's no wind (or to motor in and out of harbour): lowered, it
//    drives her on a throttle lever like the skiff's, and it runs on petrol.
//  · cruiser: a sport-fishing yacht of about thirty feet: twin inboard diesels (two propellers and
//    two rudders under her stern, the exhausts in her transom), a cabin forward (bunks, a galley,
//    standing headroom), and aft of it the helm under a hardtop with outriggers and a rack of rods,
//    then a wide-open cockpit with a fighting chair, rod holders in the gunwales and a tuna door in
//    the transom. You stand at the wheel, and stand in the cockpit to cast and fight a fish, turned
//    whichever way the line goes, off the stern as readily as the side. Quick (about twenty knots
//    flat out), steady in a sea, slow to turn at speed (the twin screws bring her round handily
//    when she's slow); big enough to make the passage south under power, and a camp that floats.
//    (Her id stays 'cruiser', for the saves.)
//  · console: a centre-console boat of about twenty-four feet: twin outboards, the wheel on a
//    console amidships under a T-top, a leaning post behind it, an open deck all round. Fast
//    (about twenty-seven knots), driven standing; you fish from the cockpit aft or the bow,
//    whichever way you're facing when you cast.
//  · windsurf: a board and a rig, sailed standing up: the same sail as the sailing boat's on a
//    smaller scale (see sailing.js), steered by leaning; in a fresh breeze it climbs onto the
//    plane and flies. Hold too much power too long and you're catapulted in; you climb back on
//    and pull the rig up a few seconds later. No fishing from it.
//  · jetski: a sit-down jet ski: very quick (over thirty knots flat out), steered by its jet, so
//    it only turns while the throttle's on; at speed it leaves the wave crests and lands with a
//    smack, throwing a plume of spray behind it. Runs on petrol. No fishing from it.
// The kayak also carries a little electric motor on its stern: lowered, it pushes the kayak along
// slowly and silently (hands free for the rod); raised, you paddle as ever.
// The motorboats run on petrol (and the bass boat's electric motor on its battery: see fuel.js);
// with the tank dry (or the battery flat) the motor is dead, and an oar moves you along, slowly.
const HULLS = {
  row: {
    name: 'rowing boat', L: 3.8, B: 0.8, D: 0.6, draft: 0.2, shallow: 0.35, seatZ: 0, seatY: 0.47, floorY: 0.08,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.17 + 0.83 * t)), 0.75),
    sheer: (t) => 0.26 * Math.pow(t, 2.4) + 0.05 * Math.pow(1 - t, 3),
    keel: (t) => 0.2 * Math.pow(t, 3),
    paint: '#3f7f86', stripe: '#f1e6cc', bottom: '#a2513d', inside: 'wood',
    oars: true, thwarts: true, lantern: [0.42, -1.58], stow: [-0.42, 0.52, -0.25],
    pull: 6.4, back: 3.2, drag: [0.32, 0.075], side: 2.6, turn: 0.85, rate: 0.8, noise: 1, steady: 1,
    windage: 0.0026, ride: 4,
  },
  skiff: {
    name: 'motor skiff', L: 3.8, B: 0.8, D: 0.6, draft: 0.2, shallow: 0.35, seatZ: -1.25, seatY: 0.47, floorY: 0.08,
    paint: '#ece6d8', stripe: '#2f4f7a', bottom: '#7c3a2e', inside: 'wood',
    motor: { thrust: 5.4, astern: 2.4, tilt: 0.75, scale: 1, cowl: '#e9e5dc', band: '#2f4f7a' },
    thwarts: true, oarlocks: true, lantern: [0.3, 1.25], stow: [-0.42, 0.52, -0.25], noise: 1, steady: 1,
    windage: 0.003, ride: 4,
  },
  kayak: {
    name: 'kayak', L: 3.7, B: 0.34, D: 0.3, draft: 0.09, shallow: 0.15, seatZ: -0.15, seatY: 0.1, floorY: 0.06,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.03 + 0.94 * t)), 0.62),
    sheer: (t) => 0.1 * Math.pow(t, 3) + 0.08 * Math.pow(1 - t, 3),
    keel: (t) => 0.06 * (Math.pow(t, 4) + Math.pow(1 - t, 4)),
    paint: '#e8742a', stripe: '#f3d36b', bottom: '#c45a1c', inside: 'plastic',
    decks: [[0, 0.3, 0], [0.6, 1, 0]], paddle: true, lantern: [0, -1.25], stow: [-0.2, 0.33, -1.05],
    pull: 3.0, back: 1.6, drag: [0.36, 0.09], side: 3.4, turn: 1.25, rate: 0.95, noise: 0.4, steady: 0.8,
    // The electric motor: a gentle push (about 1.6 m/s flat out), and a short leg that kicks up
    // in water shallower than tilt.
    emotor: { thrust: 0.82, astern: 0.75, tilt: 0.35 },
    windage: 0.0018, ride: 6, // low and light: it rides every little wave, but offers the wind little
  },
  bass: {
    name: 'bass boat', L: 4.7, B: 1.05, D: 0.55, draft: 0.22, shallow: 0.4, seatZ: -1.55, seatY: 0.78, floorY: 0.27,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.32 + 0.68 * t)), 0.42),
    sheer: (t) => 0.14 * Math.pow(t, 2),
    keel: (t) => 0.16 * Math.pow(t, 3),
    paint: '#7a2430', stripe: '#d9d4c7', bottom: '#2c2f33', inside: 'carpet',
    decks: [[0.6, 1, 0.07], [0, 0.17, 0.07]], floor: true, pedestals: true, locker: true,
    motor: { thrust: 7.6, astern: 3, tilt: 0.85, scale: 1.3, cowl: '#2b2e33', band: '#b8312f', troll: 0.3 },
    lantern: [0.8, -1.95], stow: [-0.72, 0.62, 0.4], noise: 1, steady: 0.45,
    windage: 0.0036, ride: 3, // high-sided: the wind pushes it more; broad and heavy: it rides the swell slowly
  },
  sail: {
    name: 'sailing boat', L: 4.9, B: 0.84, D: 0.66, draft: 0.24, shallow: 0.55, seatZ: -1.45, seatY: 0.45, floorY: 0.09,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.2 + 0.8 * t)), 0.6),
    sheer: (t) => 0.2 * Math.pow(t, 2.2) + 0.07 * Math.pow(1 - t, 3),
    keel: (t) => 0.16 * Math.pow(t, 3),
    paint: '#2f4d63', stripe: '#ece3cf', bottom: '#8a3b2c', inside: 'wood',
    oars: true, thwarts: true, decks: [[0.84, 1, 0]], lantern: [-0.45, -1.95], stow: [-0.5, 0.55, -0.4],
    // Under oars (the sail down): a heavier boat than the rowing boat, a little slower.
    pull: 5.4, back: 2.8, drag: [0.3, 0.07], side: 3.2, turn: 0.75, rate: 0.75, noise: 0.45, steady: 0.8,
    // The rig: mast (at t along the hull), its height, the gooseneck, the boom's length, the jib.
    sail: { mast: 0.76, height: 6.3, gooseneck: 1.6, boom: 2.75, head: 6.15, jibHead: 4.9, jibFoot: 1.55, cloth: '#c4774a', jib: '#cf8a5c' },
    rowZ: 0.05, // where you sit to row
    // The outboard on its bracket, off to one side of the rudder: a small one (about 3 m/s, six
    // knots, flat out).
    outboard: { thrust: 1.5, astern: 0.9, tilt: 0.5, scale: 0.68, cowl: '#e9e5dc', band: '#2f4d63', side: 0.3 },
    windage: 0.0026, ride: 3.6,
  },
  cabin: {
    name: 'cabin boat', L: 6.2, B: 1.0, D: 0.9, draft: 0.38, shallow: 0.75, seatZ: -2.3, seatY: 0.55, floorY: 0.12,
    paint: '#f0ece2', stripe: '#1f4e5f', bottom: '#7c3a2e', inside: 'wood',
    motor: { thrust: 3.8, astern: 2.0, tilt: 1.0, scale: 1.25, cowl: '#2b2e33', band: '#1f4e5f' },
    cabin: [0.44, 0.88], lantern: [0.55, -1.7], stow: [-0.7, 0.62, -1.3], noise: 1, steady: 0.55,
    windage: 0.0042, ride: 2.6, // long and heavy: it bridges the chop, and the cabin catches the wind
  },
  cruiser: {
    name: 'sport-fishing yacht', L: 9.2, B: 1.5, D: 1.6, draft: 0.75, shallow: 1.1, seatZ: -2.28, seatY: 1.73, floorY: 0.85,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * t)), 0.5),
    sheer: (t) => 0.42 * Math.pow(t, 2.2) + 0.04 * Math.pow(1 - t, 3),
    keel: (t) => 0.3 * Math.pow(t, 3),
    paint: '#f2efe8', stripe: '#1d3b56', bottom: '#2a3442', inside: 'plastic',
    // A teak cockpit sole running forward into the cabin; the foredeck ahead of the wheelhouse.
    floor: [0.02, 0.86], floorColor: '#a8784a', decks: [[0.86, 1, 0]],
    // Twin inboards: two shafts and propellers under her stern (twin: how far out each side),
    // turning together on the one lever. (tilt: the depth where the propellers touch bottom.)
    motor: { thrust: 9.5, astern: 3.2, tilt: 1.3, inboard: true, twin: 0.46 },
    drag: [0.3, 0.06], helm: 0.7, fend: 1.45, passage: true,
    cabin: [0.4, 0.86], cabinH: 1.25, cabinRoof: '#e9e5dc', wheel: true, rails: [0.44, 0.57, 0.7, 0.82, 0.92], sportfish: true,
    // You stand: at the wheel (the helm to starboard), or in the cockpit to fish. aft: the middle
    // of where you fish from, how far you go out to the side as you turn, and back to the transom;
    // side: which way round the fighting chair you go between the two.
    standing: { helm: [-0.62, -2.28], aft: [0, -3.6, 0.7, 0.45], side: -1, round: 0.55, chair: [0, -3.0, 0.52] },
    lantern: [1.05, -4.05], stow: null, noise: 1, steady: 0.3,
    windage: 0.005, ride: 1.8, // big and heavy: she shoulders the chop aside, but the wind gets a grip on the hardtop
  },
  console: {
    name: 'centre-console boat', L: 7.4, B: 1.25, D: 1.15, draft: 0.42, shallow: 0.7, seatZ: -0.62, seatY: 1.38, floorY: 0.5,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.32 + 0.68 * t)), 0.45),
    sheer: (t) => 0.36 * Math.pow(t, 2.2) + 0.02,
    keel: (t) => 0.22 * Math.pow(t, 3),
    paint: '#eef0ee', stripe: '#3a8fc4', bottom: '#d9dedd', inside: 'plastic',
    floor: [0.03, 0.88], floorColor: '#dcd8cc', decks: [[0.88, 1, 0]],
    motor: { thrust: 13, astern: 3.2, tilt: 0.9, scale: 1.35, cowl: '#1d2125', band: '#3a8fc4', twin: 0.4 },
    drag: [0.22, 0.05], side: 3, helm: 0.95, fend: 1.2, rails: [0.62, 0.72, 0.82, 0.92],
    console: true,
    // At the wheel behind the console; fishing, in the cockpit aft or up in the bow (whichever
    // way you face as you cast), round the console or the leaning post on the way.
    standing: { helm: [0, -0.62], aft: [0, -2.5, 0.6, 0.55], bow: [0, 1.9, 0.4, 0.3], round: 0.85 },
    lantern: [0.8, -3.2], stow: null, noise: 1.1, steady: 0.45,
    windage: 0.004, ride: 2.6,
  },
  windsurf: {
    name: 'windsurf board', L: 2.6, B: 0.34, D: 0.13, draft: 0.05, shallow: 0.35, seatZ: -0.45, seatY: 1.02, floorY: 0.14,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.1 + 0.9 * t)), 0.4),
    sheer: (t) => 0.05 * Math.pow(t, 4),
    keel: (t) => 0.12 * Math.pow(t, 5),
    paint: '#f4f1e8', stripe: '#1f8fb8', bottom: '#f0ece2', inside: 'plastic',
    decks: [[0, 1, 0]], noFish: true, noLantern: true, stand: true,
    // The rig: the sail's area and what it drives (board and you), the mast foot (t along the
    // board), its height, the wishbone's height and length, and the sail's colours.
    rig: { area: 6, mass: 105, mast: 0.56, height: 4.3, boomY: 1.32, boom: 1.85, cloth: '#f2a32a', panel: '#d9472b', window: '#bfe0ec' },
    drag: [0.35, 0.08], side: 3.4, turn: 1.25, rate: 1, noise: 0.5, steady: 0.9,
    lantern: [0, -0.9], stow: [0, 0.2, -0.6],
    windage: 0.002, ride: 7, // light: it rides every wave
  },
  jetski: {
    name: 'jet ski', L: 3.1, B: 0.58, D: 0.62, draft: 0.22, shallow: 0.3, seatZ: -0.35, seatY: 0.95, floorY: 0.5,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.28 + 0.72 * t)), 0.55),
    sheer: (t) => 0.18 * Math.pow(t, 2) + 0.04,
    keel: (t) => 0.22 * Math.pow(t, 3),
    paint: '#f2f0ea', stripe: '#e8b820', bottom: '#20262c', inside: 'plastic',
    decks: [[0.06, 1, 0]], noFish: true, noLantern: true, astride: true, bars: true, grip: [0.32, 0],
    // The jet: a strong push (about seventeen metres a second, thirty-three knots, flat out); it
    // steers by turning its nozzle, so only under power.
    motor: { thrust: 18, astern: 2.2, tilt: 0.25, scale: 1, jet: true, cowl: '#20262c', band: '#e8b820' },
    drag: [0.2, 0.05], helm: 1.7, jumps: true,
    lantern: [0, -1.2], stow: [0, 0.6, -1],
    noise: 1.2, steady: 0.7, windage: 0.002, ride: 6,
  },
};
for (const id of ['skiff', 'cabin']) Object.assign(HULLS[id], { hw: HULLS.row.hw, sheer: HULLS.row.sheer, keel: HULLS.row.keel });
export const BOAT_KINDS = Object.keys(HULLS);
const OAR_T = 0.56;

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();

// The hull's shape at t (0 stern … 1 bow): half-beam, height of the gunwale, height of the keel.
const hw = (H, t) => H.B * H.hw(t);
const sheer = (H, t) => H.D + H.sheer(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;

function hullSurface(H, inset, colorFor) {
  const NZ = 18, NP = 10, rows = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, w = Math.max(hw(H, t) - inset, 0), s = sheer(H, t), k = H.keel(t) + inset;
    const row = [];
    for (let j = 0; j <= NP; j++) {
      const a = -Math.PI / 2 + Math.PI * (j / NP);
      const sn = Math.sin(a), cs = Math.max(Math.cos(a), 0);
      row.push([w * Math.sign(sn) * Math.pow(Math.abs(sn), 0.65), k + (s - k) * (1 - Math.pow(cs, 0.55)), zAt(H, t)]);
    }
    rows.push(row);
  }
  const pos = [], col = [], c = new THREE.Color();
  const face = (p, q, r, i, j) => {
    pos.push(...p, ...q, ...r);
    colorFor(c, i, j, NP, (p[1] + q[1] + r[1]) / 3);
    for (let n = 0; n < 3; n++) col.push(c.r, c.g, c.b);
  };
  for (let i = 0; i < NZ; i++) {
    for (let j = 0; j < NP; j++) {
      const a = rows[i][j], b = rows[i + 1][j], cc = rows[i + 1][j + 1], d = rows[i][j + 1];
      face(a, b, cc, i, j);
      face(a, cc, d, i, j);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  return { geo, rows };
}

// A deck across the hull between t0 and t1 (a kayak's covered ends, a bass boat's casting
// decks): from gunwale to gunwale, a little below them (drop) and crowned along the middle.
function deckSurface(H, t0, t1, drop) {
  const N = 8, pos = [];
  let prev = null;
  for (let i = 0; i <= N; i++) {
    const t = t0 + (t1 - t0) * (i / N), w = hw(H, t) * 0.98, y = sheer(H, t) - drop, z = zAt(H, t);
    const crown = drop ? 0 : 0.035 * Math.min(1, w / 0.2);
    const cur = [[-w, y, z], [0, y + crown, z], [w, y, z]];
    if (prev) {
      for (const k of [0, 1]) pos.push(...prev[k], ...cur[k], ...cur[k + 1], ...prev[k], ...cur[k + 1], ...prev[k + 1]);
    }
    prev = cur;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}

// Keep the sea out of the boat: the floor sits a little below the waterline, so the water
// surface would show through it. An invisible lid across the hull just above the waterline
// goes into the depth buffer only, after the hull and before the (transparent) water, so the
// water is never drawn inside the boat.
function waterLid(rows, draft) {
  const y = draft + 0.1;
  const mid = (rows[0].length - 1) / 2;
  // Where the inner hull rises through the lid's height on one side of the keel.
  const cross = (row, dir) => {
    for (let j = mid; j >= 0 && j < row.length; j += dir) {
      const a = row[j], b = row[j + dir];
      if (!b) return null;
      if (b[1] >= y) {
        const k = (y - a[1]) / (b[1] - a[1] || 1);
        return [a[0] + (b[0] - a[0]) * k, y, a[2] + (b[2] - a[2]) * k];
      }
    }
    return null;
  };
  const pos = [];
  let prev = null;
  for (const row of rows) {
    const cur = row[mid][1] < y ? [cross(row, -1), cross(row, 1)] : null;
    if (cur && cur[0] && cur[1] && prev) pos.push(...prev[0], ...prev[1], ...cur[1], ...prev[0], ...cur[1], ...cur[0]);
    prev = cur && cur[0] && cur[1] ? cur : null;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const lid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide }));
  lid.renderOrder = 0.5;
  return lid;
}

function setLimb(mesh, a, b, r) {
  _d.subVectors(b, a);
  const len = _d.length() || 0.001;
  mesh.position.copy(a).addScaledVector(_d, 0.5);
  mesh.quaternion.setFromUnitVectors(UP, _d.divideScalar(len));
  mesh.scale.set(r, len, r);
}

// A tube from a to b (radius r0 at a, r1 at b), as a part to merge: shafts, posts, outriggers, rods.
function strut(a, b, r0, r1, color) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length() || 0.001;
  const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.divideScalar(len)), new THREE.Vector3(1, 1, 1));
  return { geo: new THREE.CylinderGeometry(r1, r0, len, 6), matrix: m, color, jitter: 0.02 };
}

// One of the boats in HULLS: the rowing boat, the motor skiff, the kayak or the bass boat.
export class Boat {
  // look: paint and the like over the hull's own (someone else's boat of the same kind).
  constructor(scene, { kind = 'row', look = null } = {}) {
    const H = (this.hull = look ? { ...(HULLS[kind] || HULLS.row), ...look } : HULLS[kind] || HULLS.row);
    this.kind = HULLS[kind] ? kind : 'row';
    this.motor = !!H.motor;
    this.name = H.name;
    this.seatZ = H.seatZ; // where you sit: amidships to row, at the stern to steer
    this.seatY = H.seatY;
    this.noise = H.noise; // how much the fish hear it moving (the kayak hardly at all)
    this.lever = 0;        // motor throttle, -1 (astern) … 1 (full ahead), set a notch at a time (see throttle.js)
    this.power = 0;        // what the motor is actually giving: it follows the lever, a moment behind
    this.lastGear = 0;     // ahead (1) or astern (-1), the last way the propeller turned
    this.shiftT = 0;       // changing gear: a pause in neutral
    this.emotorDown = false; // the kayak's electric motor lowered into the water (else you paddle)
    this.outboardDown = false; // the sailing boat's outboard lowered and running (else sail or oars)
    // Under sail (see sailing.js): the sail up or down, the mainsheet (0 hauled in … 1 let out),
    // what the wind is doing to the sail just now, the heel, and where the boom lies.
    this.sailUp = false;
    this.sheet = 0.5;
    // Out on the crossing (see crossing.js): the sail shortened in a blow (1 full … less, reefed),
    // and the fastest a motor boat can be driven in the ocean's long swell (m/s).
    this.reef = 1;
    this.vmax = Infinity;
    this.sailing = null;
    this.heel = 0;
    this.boomYaw = 0;
    this.sailSide = 1;
    // The windsurf board: in the water after a fall (seconds until you're back up), how long
    // you've been overpowered, and planing (0 … 1). The jet ski: in the air off a wave, and its
    // climb (m/s).
    this.fallen = 0;
    this.overT = 0;
    this.flutter = 0; // (how much a sail is flapping, for its sound: the sailing boat's and the board's)
    this.planing = 0;
    this.air = false;
    this.vy = 0;
    this.lastHc = 0;
    this.lastSv = 0;
    this.onFall = null;     // (the game hears a fall, the climb back up, and a jet ski landing)
    this.onUp = null;
    this.onLand = null;
    this.onGybe = null;     // (the game hears the boom come across)
    this.onTack = null;
    this.kflat = false;    // the kayak's battery flat
    this.dry = false;      // out of petrol (set by the game: see fuel.js)
    this.flat = false;     // the electric motor's battery flat
    this.anchored = false;  // the anchor is out (going down, holding, or being hauled in)
    this.anchor = null;     // { x, z, floor, depth, reach, y, phase: 'drop' | 'set' | 'haul', tension }
    this.anchorPt = new THREE.Vector3();
    this.tie = null;        // tied up alongside a pier: { pier, side, along, heading, x, z, t }
    this.shove = null;      // pushed off from a pier: { x, z, t }
    this.onAnchor = null;   // (the game hears the anchor bite and come up)
    this.drift = new THREE.Vector3(); // the current carrying it (m/s)
    this.tilted = false;   // the motor tips up in shallow water so the propeller can't catch the bottom
    this.onShallow = null;
    this.propSpin = 0;
    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.body.rotation.order = 'YXZ';
    this.group.add(this.body);
    scene.add(this.group);

    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.heading = 0;
    this.omega = 0;
    this.phase = 0;
    this.pitch = 0;
    this.roll = 0;
    this.heave = 0;
    this.fwd = new THREE.Vector3(0, 0, 1);
    this.right = new THREE.Vector3(-1, 0, 0);
    this.forwardSpeed = 0;
    this.onBoat = true;
    this.occupied = true;
    this.rowerParts = [];
    this.hasLantern = false;
    this.lanternLevel = 0;
    this.onStroke = null;
    this.onBump = null;
    this.bumpCooldown = 0;
    // Set by the fishing system each frame.
    // (bendTo: where the line pulls the rod tip, set by the fishing: see bendRod.)
    this.pose = { fishing: 0, rodYaw: 0, rodPitch: 0.85, bend: 0.05, bendVel: 0, bendTo: null, chair: false };
    // In first person (set by the game): where a landed fish is held up in view, and which way
    // you face for it.
    this.viewHold = null;
    this.faceYaw = null;
    this.selfHidden = false;
    // Standing (the yacht, the centre console): you turn to face the way you cast, wherever that
    // is; where you fish from (the cockpit aft, the bow), and where you stand just now.
    this.turns = !!H.standing;
    this.spot = null;
    this.standAt = null;
    this.chairT = 0; // in the fighting chair (0 … 1), fighting a big fish on the yacht

    this.buildHull();
    this.buildCharacter();
    this.oars = H.oars ? [this.buildOar(1), this.buildOar(-1)] : [];
    if (H.paddle) this.buildPaddle();
    if (H.motor || H.outboard) this.buildMotor();
    if (H.cabin) this.buildCabin();
    if (H.sportfish) this.buildSportfish();
    if (H.console) this.buildConsole();
    if (H.rig) {
      this.buildBoardRig();
      this.sailUp = true; // (a board's rig is always up, but for a fall)
      this.standLegs(1);
    }
    if (H.bars) this.buildBars();
    if (H.emotor) this.buildEMotor();
    if (H.sail) this.buildRig();
    this.buildAnchorLine(scene);
    this.buildMooringGear(scene);
    this.buildRods();
    this.buildLantern();
  }

  get speed() {
    return Math.hypot(this.vel.x, this.vel.z);
  }

  // The bass boat's first notches of throttle run the quiet electric motor, not the outboard.
  get trolling() {
    const m = this.hull.motor;
    return !!m?.troll && this.lever > 0.02 && this.lever <= m.troll;
  }

  // Under power with a lever (an outboard, or the kayak's motor lowered).
  get levered() { return this.motor || (!!this.hull.emotor && this.emotorDown); }

  // The sailing boat's outboard, down (the sail comes down: she motors) or up (she sails or rows).
  setOutboard(down) {
    const H = this.hull;
    if (!H.outboard) return;
    this.outboardDown = !!down;
    this.motor = this.outboardDown;
    this.lever = 0;
    this.power = 0;
    if (this.outboardDown && this.sailUp) this.setSail(false);
    for (const oar of this.oars || []) oar.g.visible = !this.sailUp && !this.outboardDown;
    this.setSeat(this.sailUp || this.outboardDown ? H.seatZ : H.rowZ);
  }

  // The kayak's motor, down or up (stopped first: it goes in neutral).
  setEMotor(down) {
    if (!this.hull.emotor) return;
    this.emotorDown = !!down;
    this.lever = 0;
  }

  place(x, z, heading) {
    this.pos.set(x, 0, z);
    this.vel.set(0, 0, 0);
    this.heading = heading;
    this.omega = 0;
    this.power = 0;
  }

  // The motor answers the lever: it takes a moment to build up and to ease off (an electric motor
  // quicker than an outboard), and between ahead and astern it comes back through neutral and
  // pauses there while the gear changes.
  spool(dt, lever, electric) {
    const way = Math.sign(lever);
    let want = lever;
    if (this.power && way && Math.sign(this.power) !== way) want = 0;
    if (!this.power && way && this.lastGear && way !== this.lastGear && this.shiftT <= 0) {
      this.shiftT = electric ? 0.12 : 0.4;
      this.lastGear = way;
    }
    if (this.shiftT > 0) {
      this.shiftT -= dt;
      want = 0;
    }
    const rate = (electric ? 2.5 : 1) * (Math.abs(want) > Math.abs(this.power) ? 0.6 : 1);
    this.power += clamp(want - this.power, -rate * dt, rate * dt);
    if (Math.abs(this.power) < 1e-5) this.power = 0;
    if (this.power) this.lastGear = Math.sign(this.power);
  }

  /* ---------- construction ---------- */

  buildHull() {
    const H = this.hull;
    const PAINT = new THREE.Color(H.paint);
    const STRIPE = new THREE.Color(H.stripe);
    const BOTTOM = new THREE.Color(H.bottom);
    const outer = hullSurface(H, 0, (c, i, j, NP, y) => {
      if (j === 0 || j === NP - 1) c.copy(STRIPE);
      else if (y < H.draft + 0.05) c.copy(BOTTOM);
      else c.copy(PAINT);
      c.multiplyScalar(0.94 + ((i * 7 + j * 3) % 5) * 0.025);
    });
    // Inside: planks in the wooden boats, moulded plastic in the kayak, grey carpet in the bass boat.
    const INSIDE = {
      wood: [new THREE.Color('#c99a63'), new THREE.Color('#b8874f'), new THREE.Color('#a87a48')],
      plastic: [new THREE.Color(H.paint).multiplyScalar(0.8), new THREE.Color(H.paint).multiplyScalar(0.75), new THREE.Color(H.stripe)],
      carpet: [new THREE.Color('#5d6066'), new THREE.Color('#585b61'), new THREE.Color(H.stripe)],
    }[H.inside];
    const inner = hullSurface(H, Math.min(0.045, H.B * 0.1), (c, i, j, NP) => {
      c.copy(j === 0 || j === NP - 1 ? INSIDE[2] : INSIDE[j % 2]);
      c.multiplyScalar(0.95 + ((i * 5 + j) % 4) * 0.03);
    });

    // Transom: a fan closing off the stern.
    const stern = outer.rows[0];
    const tPos = [];
    const cy = (stern[0][1] + stern[5][1]) / 2;
    for (let j = 0; j < stern.length - 1; j++) tPos.push(0, cy, zAt(H, 0), ...stern[j], ...stern[j + 1]);
    const transom = new THREE.BufferGeometry();
    transom.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));

    const railPts = (j) => outer.rows.map((r) => new THREE.Vector3(r[j][0], r[j][1] + 0.02, r[j][2]));
    const NP = outer.rows[0].length - 1;
    const rail = H.inside === 'wood' ? '#7b5434' : H.stripe;
    const parts = [
      { geo: outer.geo, color: '#ffffff', jitter: 0 },
      { geo: inner.geo, color: '#ffffff', jitter: 0 },
      { geo: transom, color: H.paint, jitter: 0.03 },
      { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts(0)), 36, H.paddle ? 0.02 : 0.045, 5), color: rail, jitter: 0.03 },
      { geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(railPts(NP)), 36, H.paddle ? 0.02 : 0.045, 5), color: rail, jitter: 0.03 },
    ];
    if (H.inside === 'wood') {
      parts.push(
        { geo: new THREE.BoxGeometry(hw(H, 0) * 2 + 0.08, 0.07, 0.09), matrix: mat(0, sheer(H, 0) + 0.02, zAt(H, 0)), color: '#7b5434' },
        { geo: new THREE.BoxGeometry(0.5, 0.03, H.L * 0.62), matrix: mat(0, 0.08, 0.05), color: '#a77746' },
      );
    }
    if (H.thwarts) {
      for (const t of [0.1, 0.5, 0.79]) {
        parts.push({ geo: new THREE.BoxGeometry(hw(H, t) * 1.84, 0.05, 0.28), matrix: mat(0, 0.46, zAt(H, t)), color: '#a8743f' });
      }
      for (const sd of [1, -1]) {
        parts.push({ geo: new THREE.CylinderGeometry(0.025, 0.025, 0.1, 5), matrix: mat(sd * (hw(H, OAR_T) + 0.02), sheer(H, OAR_T) + 0.06, zAt(H, OAR_T)), color: '#3b342e' });
      }
    }
    for (const [t0, t1, drop] of H.decks || []) parts.push({ geo: deckSurface(H, t0, t1, drop), color: drop ? '#5d6066' : H.paint, jitter: 0 });
    if (H.paddle) {
      // A moulded seat with a backrest, and a hatch on the stern deck.
      parts.push(
        { geo: new THREE.BoxGeometry(0.42, 0.05, 0.46), matrix: mat(0, H.seatY - 0.02, H.seatZ), color: '#2d3a40' },
        { geo: new THREE.BoxGeometry(0.4, 0.3, 0.05), matrix: mat(0, H.seatY + 0.14, H.seatZ - 0.27, -0.25, 0, 0), color: '#2d3a40' },
        { geo: new THREE.CylinderGeometry(0.15, 0.15, 0.03, 14), matrix: mat(0, sheer(H, 0.18) + 0.03, zAt(H, 0.18)), color: '#26292c' },
      );
    }
    if (Array.isArray(H.floor)) {
      // A flat sole from t0 to t1, in short lengths that narrow with the hull.
      const [f0, f1] = H.floor, n = 12;
      for (let i = 0; i < n; i++) {
        const ta = f0 + ((f1 - f0) * i) / n, tb = f0 + ((f1 - f0) * (i + 1)) / n;
        parts.push({ geo: new THREE.BoxGeometry(Math.min(hw(H, ta), hw(H, tb)) * 1.7, 0.04, zAt(H, tb) - zAt(H, ta) + 0.01), matrix: mat(0, H.floorY - 0.02, (zAt(H, ta) + zAt(H, tb)) / 2), color: H.floorColor });
      }
    } else if (H.floor) {
      // A flat floor between the decks, carpeted like them.
      parts.push({ geo: new THREE.BoxGeometry(hw(H, 0.4) * 1.75, 0.04, H.L * 0.46), matrix: mat(0, H.floorY - 0.02, zAt(H, 0.4)), color: '#5d6066' });
    }
    if (H.pedestals) {
      // Pedestal seats: one at the helm by the tiller, one up on the casting deck.
      for (const [z, base] of [[H.seatZ, H.floorY], [zAt(H, 0.78), sheer(H, 0.78) - 0.07]]) {
        parts.push(
          { geo: new THREE.CylinderGeometry(0.04, 0.05, H.seatY - base - 0.05, 8), matrix: mat(0, (H.seatY + base) / 2 - 0.03, z), color: '#9aa0a6' },
          { geo: new THREE.BoxGeometry(0.42, 0.08, 0.4), matrix: mat(0, H.seatY - 0.02, z), color: '#e7e1d4' },
          { geo: new THREE.BoxGeometry(0.42, 0.32, 0.07), matrix: mat(0, H.seatY + 0.16, z - 0.2, -0.12, 0, 0), color: '#e7e1d4' },
        );
      }
    }
    if (H.locker) {
      // The rod and tackle locker: a lid set into the casting deck.
      const t = 0.68, y = sheer(H, t) - 0.06;
      parts.push({ geo: new THREE.BoxGeometry(hw(H, t) * 1.2, 0.025, 0.7), matrix: mat(0, y, zAt(H, t)), color: '#484b51' });
      parts.push({ geo: new THREE.BoxGeometry(0.16, 0.03, 0.05), matrix: mat(0, y + 0.02, zAt(H, t) - 0.3), color: '#b9bec4' });
    }
    const geo = mergeParts(parts);
    // The two hull surfaces come first in the merge; copy their painted colours back in.
    const colors = geo.attributes.color.array;
    let o = 0;
    for (const g of [outer.geo, inner.geo]) {
      const src = g.attributes.color.array;
      colors.set(src, o);
      o += src.length;
    }
    const surf = H.inside === 'wood' ? withSurface(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'wood', { axis: 'z', seam: 14 })
      : new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: H.inside === 'plastic' ? 0.55 : 0.4, metalness: H.inside === 'carpet' ? 0.15 : 0 });
    const mesh = new THREE.Mesh(geo, surf);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    this.body.add(waterLid(inner.rows, H.draft));
  }

  buildCharacter() {
    const coat = new THREE.MeshLambertMaterial({ color: '#e8b440' });
    const skin = new THREE.MeshLambertMaterial({ color: '#f1c7a1' });
    const hat = new THREE.MeshLambertMaterial({ color: '#35676b' });
    const pants = new THREE.MeshLambertMaterial({ color: '#3b4a68' });
    const boot = new THREE.MeshLambertMaterial({ color: '#5a3d2b' });
    const dark = new THREE.MeshLambertMaterial({ color: '#2b2522' });
    this.selfMats = [coat, skin, hat, pants, boot, dark];
    const cast = (m) => { m.castShadow = true; return m; };

    this.torso = new THREE.Group();
    this.torso.position.set(0, this.seatY, 0.02 + this.seatZ);
    this.body.add(this.torso);
    this.rowerParts.push(this.torso);
    const chest = cast(new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.22, 4, 10), coat));
    chest.position.y = 0.27;
    chest.scale.set(1, 1, 0.85);
    this.torso.add(chest);
    const collar = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.035, 6, 12), coat);
    collar.rotation.x = Math.PI / 2;
    collar.position.y = 0.5;
    this.torso.add(collar);

    this.head = new THREE.Group();
    this.head.position.y = 0.63;
    this.torso.add(this.head);
    this.head.add(cast(new THREE.Mesh(new THREE.SphereGeometry(0.13, 14, 10), skin)));
    for (const s of [1, -1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 6, 4), dark);
      eye.position.set(s * 0.045, 0.015, 0.122);
      this.head.add(eye);
    }
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.022, 6, 4), skin);
    nose.position.set(0, -0.015, 0.13);
    this.head.add(nose);
    const brim = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.25, 0.025, 16), hat));
    brim.position.y = 0.075;
    const crown = cast(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.13, 14), hat));
    crown.position.y = 0.14;
    const hatGroup = new THREE.Group();
    hatGroup.add(brim, crown);
    hatGroup.rotation.set(-0.12, 0, 0.08);
    this.head.add(hatGroup);
    // (What you're wearing, and a shiver when you're cold: set by the game from comfort.js.)
    this.dress = new Dress({ coat, pants, head: this.head, sunHat: hatGroup, mats: this.selfMats });
    this.shiver = 0;

    const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
    const leg = (s) => {
      const thigh = cast(new THREE.Mesh(limbGeo, pants));
      const shin = cast(new THREE.Mesh(limbGeo, pants));
      const z = this.seatZ, y = this.seatY, H = this.hull;
      // Knees up on a seat; in the kayak, legs stretched out along the hull; astride the jet ski,
      // knees out and feet down in its footwells.
      const hip = new THREE.Vector3(s * (H.astride ? 0.13 : 0.09), y + (H.astride ? -0.04 : 0.05), 0.06 + z);
      const knee = H.paddle ? new THREE.Vector3(s * 0.13, y + 0.2, 0.48 + z) : H.astride ? new THREE.Vector3(s * 0.27, y - 0.1, 0.44 + z) : new THREE.Vector3(s * 0.11, y + 0.09, 0.42 + z);
      const foot = H.paddle ? new THREE.Vector3(s * 0.11, y + 0.04, 0.88 + z) : H.astride ? new THREE.Vector3(s * 0.25, sheer(H, 0.45) + 0.04, 0.6 + z) : new THREE.Vector3(s * 0.11, H.floorY + 0.06, 0.5 + z);
      setLimb(thigh, hip, knee, 0.07);
      setLimb(shin, knee, foot, 0.06);
      const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), boot));
      b.position.set(s * 0.11, foot.y - 0.02, foot.z + 0.05);
      if (H.paddle) b.rotation.x = -0.9;
      this.body.add(thigh, shin, b);
      this.rowerParts.push(thigh, shin, b);
      this.legs.push({ s, thigh, shin, boot: b });
    };
    this.legs = [];
    leg(1);
    leg(-1);

    this.arms = [1, -1].map((s) => {
      const arm = cast(new THREE.Mesh(limbGeo, coat));
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), skin);
      this.body.add(arm, hand);
      this.rowerParts.push(arm, hand);
      return { s, arm, hand, shoulder: new THREE.Vector3(s * 0.21, 0.43, 0), target: new THREE.Vector3() };
    });
  }

  // An outboard on the transom: cowling, leg, propeller and a tiller to steer by (two of them on
  // the centre console). The yacht's inboards instead: under her stern two shafts run aft and
  // down through their struts to the propellers, a rudder behind each; the exhausts in the
  // transom.
  buildMotor() {
    const H = this.hull, M = H.motor || H.outboard;
    if (M.inboard) return this.buildInboards();
    const one = (x) => {
      const g = new THREE.Group();
      g.position.set(x, sheer(H, 0) - 0.02, zAt(H, 0) - 0.04);
      // (An outboard that's up starts tilted out of the water.)
      if (!H.motor) g.rotation.x = -1.3;
      g.scale.setScalar(M.scale);
      return g;
    };
    const g = (this.motorGroup = one(M.side || 0));
    if (M.jet) {
      // (A jet ski: no outboard, just its nozzle under the stern, turning to steer.)
      g.position.set(0, 0.12, zAt(H, 0) - 0.02);
      const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.3, 10).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#2b2e33', roughness: 0.5 }));
      nozzle.position.z = -0.1;
      g.add(nozzle);
      this.prop = new THREE.Group();
      g.add(this.prop);
      this.props = [this.prop];
      this.motorGroups = [g];
      this.tillerGrip = new THREE.Vector3(0, 0.3, 0.3);
      this.body.add(g);
      return;
    }
    const parts = [
      { geo: new THREE.BoxGeometry(0.16, 0.14, 0.12), matrix: mat(0, 0, 0.02), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.3, 0.3, 0.42), matrix: mat(0, 0.24, -0.12), color: M.cowl },
      { geo: new THREE.BoxGeometry(0.31, 0.06, 0.43), matrix: mat(0, 0.11, -0.12), color: M.band },
      { geo: new THREE.BoxGeometry(0.09, 0.95, 0.11), matrix: mat(0, -0.42, -0.14), color: '#3a3d42' },
      { geo: new THREE.CylinderGeometry(0.06, 0.05, 0.3, 8), matrix: mat(0, -0.86, -0.16, Math.PI / 2, 0, 0), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.02, 0.14, 0.12), matrix: mat(0, -0.95, -0.1), color: '#3a3d42' },
      // (The tiller: none on a boat steered by a wheel.)
      ...(H.console ? [] : [
        { geo: new THREE.CylinderGeometry(0.018, 0.022, 0.62, 6), matrix: mat(0.04, 0.17, 0.26, Math.PI / 2 - 0.12, 0, 0), color: '#2b2b2b' },
        { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), matrix: mat(0.04, 0.2, 0.55, Math.PI / 2 - 0.12, 0, 0), color: '#c0392b' },
      ]),
    ];
    const geo = mergeParts(parts), shell = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.35 });
    const blade = new THREE.BoxGeometry(0.03, 0.17, 0.012);
    const fit = (grp) => {
      const mesh = new THREE.Mesh(geo, shell);
      mesh.castShadow = true;
      grp.add(mesh);
      const prop = new THREE.Group();
      prop.position.set(0, -0.86, -0.33);
      for (let i = 0; i < 3; i++) {
        const b = new THREE.Mesh(blade, bladeMat);
        b.position.y = 0.07;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 3) * Math.PI * 2;
        b.rotation.y = 0.5;
        arm.add(b);
        prop.add(arm);
      }
      grp.add(prop);
      this.body.add(grp);
      return prop;
    };
    this.prop = fit(g);
    this.tillerGrip = new THREE.Vector3(0.04, 0.2, 0.55); // in the motor's own space
    this.motorGroups = [g];
    this.props = [this.prop];
    if (M.twin) {
      // (A pair: one each side of the middle, counter-rotating.)
      g.position.x = M.twin;
      const g2 = one(-M.twin);
      this.props.push(fit(g2));
      this.motorGroups.push(g2);
    }
    if (M.troll) {
      // The electric trolling motor, clamped to the bow: a shaft down into the water and a
      // little torpedo with a propeller.
      const t = new THREE.Group();
      t.position.set(0.32, sheer(H, 0.97) - 0.02, zAt(H, 0.97) + 0.05);
      const tParts = [
        { geo: new THREE.BoxGeometry(0.14, 0.08, 0.2), matrix: mat(0, 0.04, -0.05), color: '#2b2e33' },
        { geo: new THREE.CylinderGeometry(0.018, 0.018, 1.05, 6), matrix: mat(0, -0.4, 0), color: '#2b2e33' },
        { geo: new THREE.CylinderGeometry(0.045, 0.04, 0.3, 8), matrix: mat(0, -0.9, 0, Math.PI / 2, 0, 0), color: '#2b2e33' },
        { geo: new THREE.BoxGeometry(0.1, 0.12, 0.02), matrix: mat(0, 0.16, -0.12), color: '#b8312f' },
      ];
      const tm = new THREE.Mesh(mergeParts(tParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
      t.add(tm);
      this.trollProp = new THREE.Group();
      this.trollProp.position.set(0, -0.9, -0.17);
      for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.13, 0.01), new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.5 }));
        b.rotation.z = i * Math.PI / 2;
        this.trollProp.add(b);
      }
      t.add(this.trollProp);
      this.body.add(t);
    }
  }

  // The yacht's twin inboards, as you'd see them from the water: a shaft each side angling down
  // and aft from the hull, a strut holding it, a four-bladed propeller, a rudder behind; two
  // exhausts in the transom just above the waterline.
  buildInboards() {
    const H = this.hull, M = H.motor, zs = zAt(H, 0), steel = '#9aa1a8', bronze = '#b08d57';
    const parts = [];
    this.props = [];
    this.rudders = [];
    for (const sd of [1, -1]) {
      const x = sd * M.twin;
      parts.push(
        strut(new THREE.Vector3(x, 0.05, zs + 2.4), new THREE.Vector3(x, -0.3, zs + 0.62), 0.035, 0.035, steel),
        strut(new THREE.Vector3(x, 0.02, zs + 0.9), new THREE.Vector3(x, -0.26, zs + 0.86), 0.025, 0.02, '#3a3d42'),
        { geo: new THREE.CylinderGeometry(0.08, 0.08, 0.04, 12), matrix: mat(x * 1.55, H.draft + 0.2, zs - 0.012, Math.PI / 2, 0, 0), color: '#1d1f22' },
      );
      const prop = new THREE.Group();
      prop.position.set(x, -0.31, zs + 0.56);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.035, 0.12, 8).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: bronze, metalness: 0.6, roughness: 0.35 }));
      prop.add(hub);
      for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.2, 0.012), new THREE.MeshStandardMaterial({ color: bronze, metalness: 0.6, roughness: 0.35 }));
        b.position.y = 0.12;
        b.rotation.y = sd * 0.5;
        const arm = new THREE.Group();
        arm.rotation.z = (i / 4) * Math.PI * 2;
        arm.add(b);
        prop.add(arm);
      }
      this.body.add(prop);
      this.props.push(prop);
      const rudder = new THREE.Group();
      rudder.position.set(x, 0.02, zs + 0.3);
      rudder.add(new THREE.Mesh(mergeParts([
        { geo: new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6), matrix: mat(0, 0.0, 0), color: steel },
        { geo: new THREE.BoxGeometry(0.03, 0.46, 0.34), matrix: mat(0, -0.27, -0.14), color: '#3a3d42' },
      ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0.3 })));
      this.body.add(rudder);
      this.rudders.push(rudder);
    }
    const m = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.35 }));
    m.castShadow = true;
    this.body.add(m);
    this.prop = this.props[0];
  }

  // The cabin boat's cuddy: a cabin over the forward half that follows the hull in, with windows
  // down each side, a doorway at the back, a roof and a stove pipe; and a bench across the stern
  // to sit and steer from. Inside (you can go in: see the game), a V-berth bunk in the bow with a
  // mattress and a blanket, a little galley by the door with a two-burner stove and a kettle, a
  // shelf, a rug and a lamp under the roof. The walls are a shell open at the doorway, and the
  // roof lifts away on its own, so from inside the camera can look down into it (as at home).
  buildCabin() {
    const H = this.hull, [t0, t1] = H.cabin, N = 10;
    const side = (t) => hw(H, t) * 0.86;
    const base = sheer(H, t0) - 0.12, height = H.cabinH || 1.05, wall = 0.05, dt1 = wall / H.L;
    const win = height / 1.05, roofColor = H.cabinRoof || '#2f5d50';
    const zb = zAt(H, t0), zf = zAt(H, t1);
    const ts = (a, b, n = N) => Array.from({ length: n + 1 }, (_, i) => a + (b - a) * (i / n));
    const outline = (grow) => {
      const s = new THREE.Shape();
      ts(t0, t1).forEach((t, i) => (i ? s.lineTo : s.moveTo).call(s, side(t) + grow, -zAt(H, t)));
      for (const t of ts(t1, t0)) s.lineTo(-side(t) - grow, -zAt(H, t));
      return s;
    };
    const slab = (shape, depth, y) => {
      const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false });
      g.rotateX(-Math.PI / 2);
      g.translate(0, y, 0);
      return g;
    };
    // The walls: up the starboard side, across the front and back down the port side, and in
    // again a wall's thickness: a U, open at the back where the doorway is.
    const u = new THREE.Shape();
    ts(t0, t1).forEach((t, i) => (i ? u.lineTo : u.moveTo).call(u, side(t), -zAt(H, t)));
    for (const t of ts(t1, t0)) u.lineTo(-side(t), -zAt(H, t));
    for (const t of ts(t0, t1 - dt1)) u.lineTo(-side(t) + wall, -zAt(H, t));
    for (const t of ts(t1 - dt1, t0)) u.lineTo(side(t) - wall, -zAt(H, t));
    const door = 0.3, doorH = 0.92, back = side(t0);
    const walls = [
      { geo: slab(u, height, base), color: '#e9e3d6', jitter: 0.02 },
      // (A tall cabin: a bulkhead below the doorway's sill too, either side of the steps down.)
      ...(H.cabinH ? [1, -1].map((s) => ({ geo: new THREE.BoxGeometry((back - door) * 0.8, base - H.floorY, wall), matrix: mat(s * (door + (back - door) * 0.4), (base + H.floorY) / 2, zb + wall / 2), color: '#e9e3d6' })) : []),
      // The back wall either side of the doorway, and over it.
      { geo: new THREE.BoxGeometry(back - door, height, wall), matrix: mat((back + door) / 2, base + height / 2, zb + wall / 2), color: '#e9e3d6' },
      { geo: new THREE.BoxGeometry(back - door, height, wall), matrix: mat(-(back + door) / 2, base + height / 2, zb + wall / 2), color: '#e9e3d6' },
      { geo: new THREE.BoxGeometry(door * 2, height - doorH, wall), matrix: mat(0, base + doorH + (height - doorH) / 2, zb + wall / 2), color: '#e9e3d6' },
      // A sill to step over, and a frame round the doorway.
      { geo: new THREE.BoxGeometry(door * 2 + 0.08, 0.06, wall + 0.03), matrix: mat(0, base + 0.03, zb + wall / 2), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.05, doorH, wall + 0.02), matrix: mat(door + 0.02, base + doorH / 2, zb + wall / 2), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.05, doorH, wall + 0.02), matrix: mat(-door - 0.02, base + doorH / 2, zb + wall / 2), color: '#7b5434' },
    ];
    // Windows down each side, set into the slope of the walls (dark glass outside, glowing warm
    // when the lamp's lit after dark; daylight inside); a window at the front.
    const glow = [], glass = [];
    for (const t of [0.52, 0.66, 0.79]) {
      const a = Math.atan2(side(t + 0.02) - side(t - 0.02), zAt(H, t + 0.02) - zAt(H, t - 0.02));
      for (const sd of [1, -1]) {
        glass.push({ geo: new THREE.BoxGeometry(0.03, 0.3 * win, 0.44 * win), matrix: mat(sd * (side(t) + 0.005), base + height * 0.66, zAt(H, t), 0, sd * a, 0), color: '#30434d' });
        glow.push({ geo: new THREE.BoxGeometry(0.008, 0.28 * win, 0.42 * win), matrix: mat(sd * (side(t) - wall - 0.006), base + height * 0.66, zAt(H, t), 0, sd * a, 0), color: '#bcd8e2' });
      }
    }
    glass.push({ geo: new THREE.BoxGeometry(side(t1) * 1.2, 0.3 * win, 0.03), matrix: mat(0, base + height * 0.66, zf + 0.01), color: '#30434d' });
    glow.push({ geo: new THREE.BoxGeometry(side(t1) * 1.1, 0.28 * win, 0.008), matrix: mat(0, base + height * 0.66, zf - wall - 0.008), color: '#bcd8e2' });
    // The bench across the stern, and its back against the motor well (the cruiser has a helm
    // seat instead: see buildHelm).
    if (!H.wheel) walls.push(
      { geo: new THREE.BoxGeometry(hw(H, 0.1) * 1.7, 0.06, 0.42), matrix: mat(0, this.seatY - 0.03, this.seatZ), color: '#a8743f' },
      { geo: new THREE.BoxGeometry(0.06, this.seatY - H.floorY - 0.06, 0.38), matrix: mat(hw(H, 0.1) * 0.8, (this.seatY + H.floorY) / 2 - 0.03, this.seatZ), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.06, this.seatY - H.floorY - 0.06, 0.38), matrix: mat(-hw(H, 0.1) * 0.8, (this.seatY + H.floorY) / 2 - 0.03, this.seatZ), color: '#7b5434' },
    );
    // Inside. The bunk: a platform across the bow (narrowing with the hull), a mattress, a
    // blanket and a pillow at the forward end.
    const tb0 = 0.67, tb1 = t1 - dt1 - 0.01, by = H.floorY + 0.46;
    const berth = (ta, tb, inset, y, h, color) => {
      const w = Math.min(side(ta), side(tb)) - wall - inset;
      return { geo: new THREE.BoxGeometry(w * 2, h, zAt(H, tb) - zAt(H, ta)), matrix: mat(0, y, (zAt(H, ta) + zAt(H, tb)) / 2), color };
    };
    const inside = [
      berth(tb0, 0.77, 0.02, by - 0.04, 0.08, '#8a6040'),
      berth(0.77, tb1, 0.02, by - 0.04, 0.08, '#8a6040'),
      { geo: new THREE.BoxGeometry(0.06, by - H.floorY - 0.08, 0.06), matrix: mat(0, (by + H.floorY) / 2 - 0.08, zAt(H, tb0) + 0.05), color: '#6b4a30' },
      berth(tb0, 0.77, 0.06, by + 0.06, 0.12, '#5b7290'),
      berth(0.77, tb1, 0.06, by + 0.06, 0.12, '#5b7290'),
      berth(tb0 - 0.005, 0.74, 0.04, by + 0.14, 0.05, '#b5523b'),
      { geo: new THREE.BoxGeometry(0.4, 0.09, 0.24), matrix: mat(0, by + 0.17, zAt(H, tb1) - 0.2), color: '#f1ece2' },
      // The galley, to starboard by the door: a counter, a stove with two burners, a kettle.
      { geo: new THREE.BoxGeometry(0.34, 0.72, 0.62), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.36 + 0.12, zAt(H, 0.54)), color: '#a8743f' },
      { geo: new THREE.BoxGeometry(0.36, 0.03, 0.64), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.85, zAt(H, 0.54)), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.26, 0.05, 0.4), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.89, zAt(H, 0.54)), color: '#3a3d42' },
      { geo: new THREE.TorusGeometry(0.06, 0.012, 4, 12), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.92, zAt(H, 0.54) - 0.1, Math.PI / 2, 0, 0), color: '#1d1d1d' },
      { geo: new THREE.TorusGeometry(0.06, 0.012, 4, 12), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.92, zAt(H, 0.54) + 0.1, Math.PI / 2, 0, 0), color: '#1d1d1d' },
      { geo: new THREE.CylinderGeometry(0.06, 0.07, 0.13, 10), matrix: mat(-(side(0.5) - wall - 0.19), H.floorY + 0.99, zAt(H, 0.54) + 0.1), color: '#b8312f' },
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), matrix: mat(-(side(0.5) - wall - 0.19) + 0.07, H.floorY + 1.0, zAt(H, 0.54) + 0.1, 0, 0, -1.0), color: '#b8312f' },
      // A shelf to port with jars and books; a rug on the boards.
      { geo: new THREE.BoxGeometry(0.16, 0.025, 0.7), matrix: mat(side(0.56) - wall - 0.09, base + 0.45, zAt(H, 0.56)), color: '#7b5434' },
      ...[0, 1, 2].map((k) => ({ geo: new THREE.CylinderGeometry(0.035, 0.035, 0.11, 8), matrix: mat(side(0.56) - wall - 0.09, base + 0.52, zAt(H, 0.53) + k * 0.1), color: ['#c9a34a', '#8fb36a', '#d97a4a'][k] })),
      ...[0, 1, 2, 3].map((k) => ({ geo: new THREE.BoxGeometry(0.1, 0.16, 0.035), matrix: mat(side(0.56) - wall - 0.1, base + 0.54, zAt(H, 0.6) + k * 0.04), color: ['#35676b', '#7a2430', '#2f4f7a', '#a8743f'][k] })),
      { geo: new THREE.BoxGeometry(0.46, 0.012, 0.8), matrix: mat(0, H.floorY + 0.01, zAt(H, 0.58)), color: '#9b3b30' },
      { geo: new THREE.BoxGeometry(0.4, 0.013, 0.72), matrix: mat(0, H.floorY + 0.011, zAt(H, 0.58)), color: '#c98a45' },
      // The lamp's short chain from the roof, to port, up out of your eyeline.
      { geo: new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), matrix: mat(side(0.63) * 0.5, base + height - 0.045, zAt(H, 0.63)), color: '#3a3d42' },
    ];
    const lampY = base + height - 0.13, lampX = side(0.63) * 0.5;
    const mesh = new THREE.Mesh(mergeParts([...walls, ...inside]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    // The window panes from inside: daylight by day, dusk-blue at night (see setCabinLight).
    this.cabinPanes = new THREE.Mesh(mergeParts(glow), new THREE.MeshBasicMaterial({ vertexColors: true }));
    this.body.add(this.cabinPanes);
    this.cabinGlass = new THREE.Mesh(mergeParts(glass), new THREE.MeshLambertMaterial({ vertexColors: true, emissive: '#ffb25c', emissiveIntensity: 0 }));
    this.body.add(this.cabinGlass);
    // The lamp: a warm glow under the roof, and a little light of its own that fills the cabin
    // after dark (and while you're inside), so it reads warm and lived-in from in and out.
    this.cabinLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
    this.cabinLamp.position.set(lampX, lampY, zAt(H, 0.63));
    this.body.add(this.cabinLamp);
    this.cabinLight = new THREE.PointLight('#ffc77d', 0, 4.2, 1.5);
    this.cabinLight.position.set(lampX, lampY - 0.08, zAt(H, 0.63));
    this.body.add(this.cabinLight);
    // The roof (and the stove pipe through it): lifted away while you're inside and looking
    // down into the cabin, back on otherwise.
    const roof = (this.cabinRoof = new THREE.Mesh(mergeParts([
      { geo: slab(outline(0.07), 0.07, base + height), color: roofColor, jitter: 0.02 },
      { geo: new THREE.CylinderGeometry(0.045, 0.045, 0.42, 8), matrix: mat(side(0.74) * 0.5, base + height + 0.24, zAt(H, 0.74)), color: '#2b2b2b' },
      { geo: new THREE.CylinderGeometry(0.075, 0.075, 0.05, 8), matrix: mat(side(0.74) * 0.5, base + height + 0.47, zAt(H, 0.74)), color: '#2b2b2b' },
    ]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    roof.castShadow = true;
    this.body.add(roof);
    // The door, hinged on the port side of the doorway: shut, or swung out into the cockpit.
    const hinge = (this.cabinDoor = new THREE.Group());
    hinge.position.set(door, base + 0.02, zb - 0.015);
    const leaf = new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(door * 2 - 0.02, doorH - 0.04, 0.03), matrix: mat(-door + 0.01, (doorH - 0.04) / 2, 0), color: '#7b5434' },
      { geo: new THREE.CylinderGeometry(0.022, 0.022, 0.05, 6), matrix: mat(-door * 2 + 0.12, doorH * 0.5, -0.03, Math.PI / 2, 0, 0), color: '#c9a34a' },
    ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    leaf.castShadow = true;
    hinge.add(leaf);
    this.body.add(hinge);
    this.cabinOpen = 0;
    // Where you stand inside (on the boards, in the boat's own space), and which way you face:
    // the doorway, the galley, the bunk.
    this.cabinStations = [
      { id: 'door', x: 0, z: zb + 0.38, yaw: 0 },
      { id: 'galley', x: -0.08, z: zAt(H, 0.54), yaw: -Math.PI / 2 },
      { id: 'bunk', x: 0, z: zAt(H, tb0) - 0.32, yaw: 0 },
    ];
    this.cabinFloor = H.floorY + 0.02;
    this.cabinRoofY = base + height;
    this.cabinMid = new THREE.Vector3(0, base, (zb + zf) / 2);
  }

  // Stainless rails round the bow: posts up from the gunwale at each t of ts, a rail along their
  // tops either side meeting at the stem.
  bowRails(parts, ts, h = 0.62) {
    const H = this.hull, steel = '#c9cdd0';
    for (const sd of [1, -1]) {
      const pts = [];
      for (const t of ts) {
        const x = sd * (hw(H, t) - 0.05), y = sheer(H, t), zz = zAt(H, t);
        parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.018, h, 5), matrix: mat(x, y + h / 2, zz), color: steel });
        pts.push(new THREE.Vector3(x, y + h, zz));
      }
      pts.push(new THREE.Vector3(sd * 0.12, sheer(H, 0.99) + h, zAt(H, 0.985)));
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 5), color: steel });
    }
    parts.push({ geo: new THREE.CylinderGeometry(0.02, 0.02, h, 5), matrix: mat(0, sheer(H, 0.995) + h / 2, zAt(H, 0.99)), color: steel });
  }

  // A big-game rod standing in a holder: the butt at a, leaning along dir, a gold reel near its foot.
  rackRod(parts, a, dir, len = 1.85) {
    const d = dir.clone().normalize();
    parts.push(
      strut(a.clone().addScaledVector(d, -0.18), a.clone().addScaledVector(d, 0.06), 0.032, 0.032, '#c9cdd0'),
      strut(a, a.clone().addScaledVector(d, len), 0.017, 0.006, '#1d2125'),
      strut(a.clone().addScaledVector(d, 0.2), a.clone().addScaledVector(d, 0.3), 0.055, 0.055, '#c9a34a'),
    );
  }

  // The wheel: its rim, three spokes and a hub, tilted towards you, turning with the helm.
  buildWheel(x, y, z, tilt = -0.55) {
    const w = (this.wheel = new THREE.Group());
    w.position.set(x, y, z);
    w.rotation.x = tilt;
    w.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.TorusGeometry(0.19, 0.018, 6, 20), color: '#2b2e33' },
      { geo: new THREE.CylinderGeometry(0.035, 0.035, 0.08, 8), matrix: mat(0, 0, 0.02, Math.PI / 2, 0, 0), color: '#c9cdd0' },
      ...[0, 1, 2].map((k) => ({ geo: new THREE.BoxGeometry(0.018, 0.17, 0.012), matrix: mat(Math.sin((k / 3) * Math.PI * 2) * 0.09, Math.cos((k / 3) * Math.PI * 2) * 0.09, 0, 0, 0, -(k / 3) * Math.PI * 2), color: '#c9cdd0' })),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.3 })));
    this.body.add(w);
  }

  // The yacht, aft of her cabin: the helm to starboard (a console with the wheel, a throttle for
  // each engine, a compass and a windscreen) under a hardtop carried on from the cabin roof, a
  // rack of rods along its back edge and an outrigger either side; the open cockpit with the
  // fighting chair (facing aft), rods in the gunwale holders, a fish box in the sole and a tuna
  // door in the transom; rails round the foredeck; on the cabin roof, grab rails and a mast with
  // a white light.
  buildSportfish() {
    const H = this.hull, y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.72;
    const steel = '#c9cdd0', white = '#f3f1ea', V = (x, y, z) => new THREE.Vector3(x, y, z);
    const parts = [
      { geo: new THREE.BoxGeometry(0.78, 1.0, 0.5), matrix: mat(hx, y0 + 0.5, cz), color: H.paint },
      { geo: new THREE.BoxGeometry(0.74, 0.04, 0.36), matrix: mat(hx, y0 + 0.98, cz - 0.17, -0.45, 0, 0), color: '#2b2e33' },
      { geo: new THREE.SphereGeometry(0.07, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(hx - 0.2, y0 + 1.03, cz - 0.12), color: '#1d1f22' },
      { geo: new THREE.BoxGeometry(0.8, 0.32, 0.02), matrix: mat(hx, y0 + 1.18, cz + 0.2, -0.3, 0, 0), color: '#9fb4bf' },
      { geo: new THREE.BoxGeometry(0.12, 0.1, 0.12), matrix: mat(hx + 0.28, y0 + 1.0, cz - 0.1), color: '#2b2e33' },
      ...[-0.03, 0.03].map((dx) => ({ geo: new THREE.CylinderGeometry(0.013, 0.013, 0.2, 5), matrix: mat(hx + 0.28 + dx, y0 + 1.12, cz - 0.1, 0.35, 0, 0), color: steel })),
    ];
    this.buildWheel(hx, y0 + 1.06, hz + 0.42);
    // The hardtop, on from the cabin roof over the helm, on two posts aft; the rods racked along
    // its back edge; the outriggers.
    const ry = this.cabinRoofY + 0.02, zf = zAt(H, H.cabin[0]), za = hz - 0.32, wide = 1.3;
    parts.push({ geo: new THREE.BoxGeometry(wide * 2, 0.08, zf - za), matrix: mat(0, ry + 0.04, (zf + za) / 2), color: '#e9e5dc', jitter: 0.02 });
    for (const sd of [1, -1]) {
      parts.push(strut(V(sd * (wide - 0.08), y0, za + 0.08), V(sd * (wide - 0.08), ry, za + 0.08), 0.032, 0.032, steel));
      parts.push(strut(V(sd * (wide - 0.05), ry + 0.08, zf - 0.6), V(sd * 3.3, ry + 4.3, za - 1.6), 0.03, 0.012, steel));
      parts.push(strut(V(sd * (wide - 0.05), ry + 0.02, zf - 0.75), V(sd * (wide - 0.05), ry + 0.22, zf - 0.6), 0.045, 0.04, '#3a3d42'));
    }
    for (const x of [-0.8, -0.4, 0, 0.4, 0.8]) this.rackRod(parts, V(x, ry + 0.12, za + 0.05), V(0, 1, -0.38));
    // The cockpit: rods in the gunwale holders, leaning out and aft.
    for (const t of [0.09, 0.19]) for (const sd of [1, -1]) this.rackRod(parts, V(sd * (hw(H, t) - 0.12), sheer(H, t) + 0.02, zAt(H, t)), V(sd * 0.35, 1, -0.55), 1.75);
    // The fighting chair, facing aft: its pedestal, the seat and back, arms, the footrest and the
    // gimbal at the front of the seat a rod's butt fits into.
    const [, fz] = H.standing.chair;
    parts.push(
      { geo: new THREE.CylinderGeometry(0.22, 0.24, 0.04, 14), matrix: mat(0, y0 + 0.02, fz), color: steel },
      { geo: new THREE.CylinderGeometry(0.09, 0.11, 0.4, 10), matrix: mat(0, y0 + 0.22, fz), color: steel },
      // The fish box in the sole, and the tuna door in the transom (outside and in), port side.
      { geo: new THREE.BoxGeometry(1.1, 0.02, 0.6), matrix: mat(0, y0 + 0.006, -4.0), color: '#8e6640' },
      { geo: new THREE.BoxGeometry(0.2, 0.025, 0.04), matrix: mat(0, y0 + 0.02, -3.74), color: steel },
    );
    // The chair itself swivels on its pedestal to follow a fish (facing aft at rest).
    const chair = (this.chair = new THREE.Group());
    chair.position.set(0, y0, fz);
    chair.rotation.y = Math.PI;
    chair.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(0.58, 0.11, 0.5), matrix: mat(0, 0.47, 0), color: white },
      { geo: new THREE.BoxGeometry(0.58, 0.62, 0.09), matrix: mat(0, 0.8, -0.26, -0.15, 0, 0), color: white },
      { geo: new THREE.BoxGeometry(0.62, 0.05, 0.1), matrix: mat(0, 1.12, -0.31, -0.15, 0, 0), color: '#a8784a' },
      ...[1, -1].map((sd) => ({ geo: new THREE.BoxGeometry(0.07, 0.07, 0.44), matrix: mat(sd * 0.31, 0.66, -0.02), color: '#a8784a' })),
      ...[1, -1].map((sd) => strut(V(sd * 0.12, 0.4, 0.05), V(sd * 0.26, 0.22, 0.66), 0.02, 0.02, steel)),
      { geo: new THREE.BoxGeometry(0.62, 0.05, 0.1), matrix: mat(0, 0.22, 0.68), color: steel },
      { geo: new THREE.CylinderGeometry(0.045, 0.04, 0.16, 8), matrix: mat(0, 0.5, 0.27), color: steel },
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 })));
    chair.children[0].castShadow = true;
    this.body.add(chair);
    const zs = zAt(H, 0), dy = (y0 + sheer(H, 0)) / 2 + 0.02;
    for (const [z, k] of [[zs - 0.016, 1], [zs + 0.016, -1]]) {
      parts.push(
        { geo: new THREE.BoxGeometry(0.64, 0.66, 0.02), matrix: mat(0.55, dy, z), color: '#3a3d42' },
        { geo: new THREE.BoxGeometry(0.58, 0.6, 0.02), matrix: mat(0.55, dy, z - k * 0.006), color: H.paint },
        { geo: new THREE.BoxGeometry(0.05, 0.12, 0.03), matrix: mat(0.32, dy, z - k * 0.016), color: steel },
      );
    }
    this.bowRails(parts, H.rails);
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.15 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    if (this.cabinRoof) {
      // On the roof (so it lifts away with it when you look down inside).
      const [t0, t1] = H.cabin, ry2 = this.cabinRoofY + 0.07, zm = zAt(H, t0 + (t1 - t0) * 0.35);
      const roofParts = [
        ...[1, -1].map((sd) => ({ geo: new THREE.BoxGeometry(0.04, 0.06, H.L * (t1 - t0) * 0.5), matrix: mat(sd * hw(H, (t0 + t1) / 2) * 0.55, ry2 + 0.06, zAt(H, t0 + (t1 - t0) * 0.6)), color: steel })),
        { geo: new THREE.CylinderGeometry(0.035, 0.045, 1.3, 6), matrix: mat(0, ry2 + 0.65, zm), color: '#d8d4ca' },
        { geo: new THREE.BoxGeometry(0.5, 0.03, 0.03), matrix: mat(0, ry2 + 1.0, zm), color: '#d8d4ca' },
      ];
      this.cabinRoof.add(new THREE.Mesh(mergeParts(roofParts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 })));
      this.mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3d6' }));
      this.mastLight.position.set(0, ry2 + 1.34, zm);
      this.cabinRoof.add(this.mastLight);
    }
  }

  // The centre console: the console amidships (the wheel, a throttle for each motor, a screen and a
  // compass behind a windscreen, a cushioned seat on its front); a T-top over it on four legs, two
  // from the console and two from the leaning post, with rods racked along its back edge; the
  // leaning post behind the wheel with a cooler under it; rods in the gunwale holders, a live well
  // in the deck aft; rails round the bow.
  buildConsole() {
    const H = this.hull, y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.75;
    const steel = '#c9cdd0', V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pz = hz - 0.42, ty = y0 + 2.15;
    const parts = [
      { geo: new THREE.BoxGeometry(0.8, 1.0, 0.66), matrix: mat(hx, y0 + 0.5, cz), color: H.paint },
      { geo: new THREE.BoxGeometry(0.76, 0.04, 0.3), matrix: mat(hx, y0 + 0.98, cz - 0.22, -0.5, 0, 0), color: '#2b2e33' },
      { geo: new THREE.BoxGeometry(0.3, 0.2, 0.03), matrix: mat(hx + 0.16, y0 + 1.1, cz - 0.16, -0.4, 0, 0), color: '#111316' },
      { geo: new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), matrix: mat(hx - 0.12, y0 + 1.03, cz - 0.12), color: '#1d1f22' },
      { geo: new THREE.BoxGeometry(0.86, 0.36, 0.02), matrix: mat(hx, y0 + 1.2, cz - 0.02, -0.35, 0, 0), color: '#9fb4bf' },
      { geo: new THREE.BoxGeometry(0.1, 0.09, 0.1), matrix: mat(hx - 0.3, y0 + 1.0, cz - 0.26), color: '#2b2e33' },
      ...[-0.025, 0.025].map((dx) => ({ geo: new THREE.CylinderGeometry(0.012, 0.012, 0.18, 5), matrix: mat(hx - 0.3 + dx, y0 + 1.1, cz - 0.26, 0.35, 0, 0), color: steel })),
      // The seat on the console's front, and the stripe round it.
      { geo: new THREE.BoxGeometry(0.72, 0.12, 0.4), matrix: mat(hx, y0 + 0.45, cz + 0.53), color: '#1f3b56' },
      { geo: new THREE.BoxGeometry(0.72, 0.4, 0.07), matrix: mat(hx, y0 + 0.76, cz + 0.36), color: '#1f3b56' },
      { geo: new THREE.BoxGeometry(0.81, 0.06, 0.67), matrix: mat(hx, y0 + 0.82, cz), color: H.stripe },
      // The leaning post: a cooler to sit on, a bolster to lean against, the frame between.
      { geo: new THREE.BoxGeometry(0.72, 0.45, 0.5), matrix: mat(hx, y0 + 0.225, pz), color: '#e6e2d8' },
      { geo: new THREE.BoxGeometry(0.72, 0.03, 0.5), matrix: mat(hx, y0 + 0.46, pz), color: H.stripe },
      { geo: new THREE.BoxGeometry(0.72, 0.18, 0.2), matrix: mat(hx, y0 + 0.92, pz + 0.08), color: '#1f3b56' },
      ...[1, -1].map((sd) => strut(V(hx + sd * 0.34, y0 + 0.46, pz), V(hx + sd * 0.34, y0 + 0.92, pz + 0.04), 0.02, 0.02, steel)),
      // The T-top.
      { geo: new THREE.BoxGeometry(1.5, 0.06, 1.75), matrix: mat(hx, ty, hz + 0.2), color: '#f2f0ea', jitter: 0.02 },
      { geo: new THREE.BoxGeometry(1.46, 0.02, 1.7), matrix: mat(hx, ty - 0.04, hz + 0.2), color: H.stripe, jitter: 0.02 },
      ...[1, -1].flatMap((sd) => [
        strut(V(hx + sd * 0.36, y0 + 1.0, cz + 0.15), V(hx + sd * 0.55, ty - 0.03, cz + 0.12), 0.025, 0.025, steel),
        strut(V(hx + sd * 0.34, y0 + 0.92, pz), V(hx + sd * 0.55, ty - 0.03, pz - 0.05), 0.025, 0.025, steel),
      ]),
      // The live well hatch in the deck aft.
      { geo: new THREE.BoxGeometry(0.8, 0.02, 0.45), matrix: mat(0, y0 + 0.006, zAt(H, 0.08)), color: '#c9c5ba' },
    ];
    for (const x of [-0.6, -0.2, 0.2, 0.6]) this.rackRod(parts, V(hx + x, ty + 0.05, hz + 0.2 - 0.85), V(0, 1, -0.38));
    for (const t of [0.1, 0.24]) for (const sd of [1, -1]) this.rackRod(parts, V(sd * (hw(H, t) - 0.1), sheer(H, t) + 0.02, zAt(H, t)), V(sd * 0.35, 1, -0.55), 1.75);
    this.bowRails(parts, H.rails, 0.55);
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.12 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    this.buildWheel(hx, y0 + 1.03, hz + 0.36, -0.6);
  }

  // The windsurf board's rig: a mast stepped in the board, a wishbone boom round the sail, and the
  // sail itself (a bright cloth, a darker head panel and a clear window). Two pivots at the mast
  // foot: one leans it to windward against the pull (and lays it flat in a fall), the other swings
  // it out to leeward as the sheet lets it. Under the board, its fin; on the deck, footstraps.
  buildBoardRig() {
    const H = this.hull, R = H.rig;
    const zm = zAt(H, R.mast), y0 = sheer(H, R.mast);
    const rake = (this.rake = new THREE.Group());
    rake.position.set(0, y0, zm);
    const swing = (this.swing = new THREE.Group());
    rake.add(swing);
    const parts = [
      { geo: new THREE.CylinderGeometry(0.022, 0.03, R.height, 8), matrix: mat(0, R.height / 2, 0), color: '#ececec' },
      { geo: new THREE.CylinderGeometry(0.05, 0.06, 0.12, 8), matrix: mat(0, 0.04, 0), color: '#2b2e33' },
    ];
    for (const s of [1, -1]) {
      const pts = [new THREE.Vector3(0, R.boomY, 0.06), new THREE.Vector3(s * 0.21, R.boomY, -R.boom * 0.3), new THREE.Vector3(s * 0.2, R.boomY - 0.02, -R.boom * 0.72), new THREE.Vector3(0, R.boomY - 0.05, -R.boom)];
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, 0.018, 5), color: '#3a3d42' });
    }
    const hard = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.2 }));
    hard.castShadow = true;
    swing.add(hard);
    // The sail, in the rig's own plane: (back along the boom, up the mast) → (0, up, back).
    const sheet = (pts, color, x = 0) => {
      const g = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v))));
      g.rotateY(-Math.PI / 2);
      g.translate(x, 0, 0);
      return { geo: g, color, jitter: 0.02 };
    };
    const Ht = R.height;
    const cloth = [[0.04, 0.22], [0.03, Ht - 0.05], [-0.45, Ht * 0.82], [-0.95, Ht * 0.58], [-R.boom + 0.05, R.boomY + 0.2], [-R.boom * 0.72, 0.42], [-0.3, 0.2]];
    const head = [[0.03, Ht * 0.7], [0.03, Ht - 0.05], [-0.45, Ht * 0.82], [-0.72, Ht * 0.68]];
    const win = [[-0.12, R.boomY - 0.45], [-0.12, R.boomY + 0.65], [-0.7, R.boomY + 0.45], [-0.8, R.boomY - 0.3]];
    const sail = new THREE.Mesh(mergeParts([
      sheet(cloth, R.cloth),
      ...[0.006, -0.006].flatMap((x) => [sheet(head, R.panel, x), sheet(win, R.window, x)]),
    ]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    sail.castShadow = true;
    swing.add(sail);
    this.body.add(rake);
    // The fin, and two pairs of footstraps.
    const under = [{ geo: new THREE.BoxGeometry(0.02, 0.36, 0.2), matrix: mat(0, -0.12, zAt(H, 0.08)), color: '#2b2e33' }];
    for (const t of [0.22, 0.42]) for (const s of [1, -1]) under.push({ geo: new THREE.TorusGeometry(0.07, 0.015, 4, 8, Math.PI), matrix: mat(s * 0.13, sheer(H, t) + 0.01, zAt(H, t), 0, Math.PI / 2, 0), color: '#1f3b56' });
    this.body.add(new THREE.Mesh(mergeParts(under), new THREE.MeshLambertMaterial({ vertexColors: true })));
  }

  // The windsurfer's stance: side-on to the board facing the sail, feet apart along it (the front
  // one by the mast), knees a little bent, hips out over the windward rail. s: the leeward side
  // (+1: the boat's +x). In the water after a fall, the legs are out of sight.
  standLegs(s, down = false) {
    const H = this.hull, z0 = this.seatZ, deck = H.floorY;
    for (const L of this.legs) {
      const foot = new THREE.Vector3(-s * 0.1, deck + 0.04, z0 + L.s * 0.36);
      const hip = new THREE.Vector3(-s * 0.26, H.seatY - 0.02, z0 + L.s * 0.1);
      const knee = new THREE.Vector3(-s * 0.12, (hip.y + foot.y) / 2 + 0.04, z0 + L.s * 0.27);
      setLimb(L.thigh, hip, knee, 0.07);
      setLimb(L.shin, knee, foot, 0.06);
      L.boot.position.set(foot.x, foot.y - 0.02, foot.z + 0.02);
      L.boot.rotation.set(0, Math.PI / 2, 0);
      L.thigh.visible = L.shin.visible = L.boot.visible = !down && this.occupied !== false;
    }
  }

  // Catapulted in (the windsurf board): the rig goes over, you're in the water beside it, and in a
  // few seconds you're back on and pulling it up.
  fall(why = 'catapult') {
    if (!this.hull.rig || this.fallen > 0) return;
    this.fallen = 3.4;
    this.overT = 0;
    this.vel.multiplyScalar(0.3);
    this.standLegs(this.sailSide || 1, true);
    this.onFall?.(this, why);
  }

  // The jet ski's saddle, its hood, and the handlebars (turning with the jet), hands on the grips.
  buildBars() {
    const H = this.hull, z = this.seatZ, y = this.seatY;
    const parts = [
      { geo: new THREE.BoxGeometry(0.42, 0.22, 1.25), matrix: mat(0, y - 0.15, z - 0.05), color: '#1d2125' },
      { geo: new THREE.BoxGeometry(0.66, 0.3, 0.72), matrix: mat(0, sheer(H, 0.74) + 0.08, zAt(H, 0.74), -0.28, 0, 0), color: H.stripe },
      { geo: new THREE.BoxGeometry(0.5, 0.05, 0.4), matrix: mat(0, sheer(H, 0.74) + 0.24, zAt(H, 0.74) - 0.05, -0.28, 0, 0), color: '#20262c' },
      { geo: new THREE.BoxGeometry(0.1, 0.34, 0.1), matrix: mat(0, y + 0.04, z + 0.74, -0.45, 0, 0), color: '#2b2e33' },
    ];
    const m = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.1 }));
    m.castShadow = true;
    this.body.add(m);
    const bars = (this.wheel = new THREE.Group());
    bars.position.set(0, y + 0.2, z + 0.8);
    bars.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(0.7, 0.035, 0.035), color: '#3a3d42' },
      ...[1, -1].map((s) => ({ geo: new THREE.CylinderGeometry(0.025, 0.025, 0.14, 6), matrix: mat(s * 0.32, 0, 0, 0, 0, Math.PI / 2), color: '#111316' })),
    ]), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 })));
    this.body.add(bars);
  }

  // The cabin as you see it: open is how far the door stands open (0 shut … 1 open), roof whether
  // the roof is on.
  setCabin({ open = 0, roof = true } = {}) {
    if (!this.cabinRoof) return;
    this.cabinTarget = open;
    this.cabinRoof.visible = roof;
  }

  // The cabin's light for the hour: night (0 … 1), and whether you're inside.
  setCabinLight(night, inside) {
    if (!this.cabinLight) return;
    const on = Math.max(night, inside ? 0.35 : 0);
    this.cabinLight.intensity = on * (inside ? 2.4 : 1.4);
    this.cabinLamp.material.color.set('#ffd28a').multiplyScalar(0.55 + 0.45 * on);
    this.cabinPanes.material.color.setScalar(0.25 + 0.75 * (1 - night));
    // From outside, the lit cabin glows through its windows: a little home on the water. (The
    // cruiser's white light at the masthead, lit after dark.)
    this.cabinGlass.material.emissiveIntensity = night * 1.1;
    if (this.mastLight) this.mastLight.material.color.set('#fff3d6').multiplyScalar(0.3 + 0.7 * night);
  }

  // A point in the cabin (in the boat's own space) out into the world.
  cabinWorld(x, y, z, out) {
    return this.body.localToWorld(out.set(x, y, z));
  }

  // The kayak's double-bladed paddle, held across the body and dipped left and right.
  buildPaddle() {
    const g = (this.paddleGroup = new THREE.Group());
    g.rotation.order = 'YZX';
    g.position.set(0, this.seatY + 0.36, this.seatZ + 0.38);
    const parts = [{ geo: new THREE.CylinderGeometry(0.016, 0.016, 2.2, 6), matrix: mat(0, 0, 0, 0, 0, Math.PI / 2), color: '#2b2b2b' }];
    for (const sd of [1, -1]) {
      parts.push({ geo: new THREE.BoxGeometry(0.42, 0.16, 0.012), matrix: mat(sd * 1.1, 0, 0, 0, sd * 0.25, 0), color: '#f3d36b' });
      parts.push({ geo: new THREE.CylinderGeometry(0.022, 0.022, 0.1, 6), matrix: mat(sd * 0.3, 0, 0, 0, 0, Math.PI / 2), color: '#3a3d42' });
    }
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    g.add(mesh);
    this.body.add(g);
    this.paddle = { g, blend: 0, wasIn: 0, grips: [new THREE.Vector3(0.3, 0, 0), new THREE.Vector3(-0.3, 0, 0)], blades: [new THREE.Vector3(1.2, 0, 0), new THREE.Vector3(-1.2, 0, 0)] };
  }

  // The kayak's little electric motor, clamped to the stern: a head with its switch, a shaft
  // and a pod with a two-bladed propeller, and its battery in a box on the stern deck behind the
  // seat. Lowered, the shaft hangs straight down into the water; raised, it swings up and back
  // to lie clear of the water, out of the way of the paddle (and of piers and the shore).
  buildEMotor() {
    const H = this.hull;
    const battery = new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(0.2, 0.11, 0.15), matrix: mat(0, sheer(H, 0.25) + 0.05, zAt(H, 0.25)), color: '#26292c' },
      { geo: new THREE.BoxGeometry(0.205, 0.02, 0.155), matrix: mat(0, sheer(H, 0.25) + 0.085, zAt(H, 0.25)), color: '#c0392b' },
      // The lead, along the deck to the motor.
      { geo: new THREE.BoxGeometry(0.015, 0.012, zAt(H, 0.25) - zAt(H, 0.03)), matrix: mat(0.06, sheer(H, 0.1) + 0.012, (zAt(H, 0.25) + zAt(H, 0.03)) / 2), color: '#1d1d1d' },
    ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    battery.castShadow = true;
    this.body.add(battery);
    const g = (this.emotorGroup = new THREE.Group());
    g.position.set(0, sheer(H, 0.02) + 0.03, zAt(H, 0.02));
    const leg = 0.5;
    const parts = [
      { geo: new THREE.BoxGeometry(0.1, 0.05, 0.1), matrix: mat(0, -0.02, 0.03), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.11, 0.1, 0.14), matrix: mat(0, 0.07, -0.02), color: '#2b2e33' },
      { geo: new THREE.BoxGeometry(0.112, 0.02, 0.142), matrix: mat(0, 0.05, -0.02), color: '#f3d36b' },
      { geo: new THREE.CylinderGeometry(0.012, 0.012, leg, 6), matrix: mat(0, -leg / 2, -0.02), color: '#2b2e33' },
      { geo: new THREE.CylinderGeometry(0.032, 0.026, 0.17, 8), matrix: mat(0, -leg, -0.04, Math.PI / 2, 0, 0), color: '#2b2e33' },
      { geo: new THREE.BoxGeometry(0.012, 0.07, 0.08), matrix: mat(0, -leg - 0.05, -0.02), color: '#2b2e33' },
    ];
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5 }));
    mesh.castShadow = true;
    g.add(mesh);
    this.kayakProp = new THREE.Group();
    this.kayakProp.position.set(0, -leg, -0.14);
    for (let i = 0; i < 2; i++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.11, 0.008), new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.5, roughness: 0.4 }));
      b.rotation.z = i * Math.PI;
      b.position.y = 0.04 * (i ? -1 : 1);
      this.kayakProp.add(b);
    }
    g.add(this.kayakProp);
    // (Raised to begin with: it swings up and back over the stern.)
    g.rotation.x = 1.35;
    this.body.add(g);
  }

  // The anchor: stowed on the foredeck, and the same anchor out in the world on its rope (a
  // smaller grapnel on the kayak). Out, it goes down to the seabed from the bow, holds, and comes
  // back up when you haul it in.
  // The sailing boat's rig: a wooden mast stepped through the forward thwart, held by shrouds and
  // a forestay; the boom on its gooseneck with the mainsail above it (triangular, tan cloth); the
  // jib forward of the mast; a little flag at the masthead that streams downwind; a rudder at the
  // transom and its tiller. The sails are cloth: each frame they belly out to leeward as the wind
  // fills them, flap when they luff, and swing across with the boom when she tacks or gybes.
  buildRig() {
    const H = this.hull, R = H.sail;
    const zm = zAt(H, R.mast), wood = '#b98a56';
    this.rig = { zm };
    const spars = [
      { geo: new THREE.CylinderGeometry(0.035, 0.055, R.height, 8), matrix: mat(0, 0.1 + R.height / 2, zm), color: wood },
      // (A cap and a sheave at the masthead, a cleat or two.)
      { geo: new THREE.CylinderGeometry(0.045, 0.04, 0.12, 8), matrix: mat(0, 0.1 + R.height, zm), color: '#3d3a36' },
      { geo: new THREE.BoxGeometry(0.06, 0.12, 0.04), matrix: mat(0.05, 1.1, zm), color: '#3d3a36' },
      // The rudder hung on the transom, and its blade under the water.
      { geo: new THREE.BoxGeometry(0.035, 0.85, 0.32), matrix: mat(0, sheer(H, 0) - 0.42, zAt(H, 0) - 0.18), color: '#2a3a46' },
    ];
    // Shrouds to the gunwales abreast of the mast, and the forestay to the stemhead.
    const wire = (a, b) => {
      const d = new THREE.Vector3().subVectors(b, a), len = d.length();
      const m = new THREE.Matrix4().compose(a.clone().addScaledVector(d, 0.5), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), new THREE.Vector3(1, 1, 1));
      spars.push({ geo: new THREE.CylinderGeometry(0.007, 0.007, len, 4), matrix: m, color: '#8e9396', jitter: 0 });
    };
    const hb = hw(H, R.mast) - 0.03, sy = sheer(H, R.mast);
    wire(new THREE.Vector3(0, R.height * 0.86, zm), new THREE.Vector3(hb, sy, zm - 0.15));
    wire(new THREE.Vector3(0, R.height * 0.86, zm), new THREE.Vector3(-hb, sy, zm - 0.15));
    this.rig.stem = new THREE.Vector3(0, sheer(H, 1) + 0.02, zAt(H, 1) - 0.06);
    this.rig.jibTop = new THREE.Vector3(0, R.jibHead, zm);
    wire(this.rig.jibTop, this.rig.stem);
    const sparMesh = new THREE.Mesh(mergeParts(spars), withSurface(new THREE.MeshLambertMaterial({ vertexColors: true }), 'wood', { axis: 'z' }));
    sparMesh.castShadow = true;
    this.body.add(sparMesh);

    // The boom, on its gooseneck: it swings round the mast.
    const pivot = (this.boomPivot = new THREE.Group());
    pivot.position.set(0, R.gooseneck, zm - 0.06);
    const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.034, R.boom, 7), withSurface(new THREE.MeshLambertMaterial({ color: wood }), 'wood', { axis: 'y' }));
    boom.rotation.x = Math.PI / 2;
    boom.position.z = -R.boom / 2;
    boom.castShadow = true;
    pivot.add(boom);
    // The sail furled along the boom when it's down.
    this.furl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.06, R.boom * 0.9, 8), new THREE.MeshLambertMaterial({ color: R.cloth }));
    this.furl.rotation.x = Math.PI / 2;
    this.furl.position.set(0, 0.08, -R.boom * 0.47);
    pivot.add(this.furl);
    this.body.add(pivot);

    // Sailcloth: a grid of points (chordwise u, up the luff v) set afresh each frame.
    const clothMat = (color) => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, color });
    const makeCloth = (NU, NV, color) => {
      const geo = new THREE.BufferGeometry();
      const n = (NU + 1) * (NV + 1);
      geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(n * 3), 3));
      // Seams: each horizontal panel a shade apart, the cloth a little darker at the leech.
      const col = new Float32Array(n * 3);
      for (let j = 0; j <= NV; j++) {
        for (let i = 0; i <= NU; i++) {
          const k = (j * (NU + 1) + i) * 3, f = (j % 2 ? 0.94 : 1) * (1 - 0.08 * (i / NU));
          col[k] = col[k + 1] = col[k + 2] = f;
        }
      }
      geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
      const idx = [];
      for (let j = 0; j < NV; j++) {
        for (let i = 0; i < NU; i++) {
          const a = j * (NU + 1) + i, b = a + 1, c = a + NU + 1, d = c + 1;
          idx.push(a, c, b, b, c, d);
        }
      }
      geo.setIndex(idx);
      const mesh = new THREE.Mesh(geo, clothMat(color));
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      return { mesh, geo, NU, NV };
    };
    this.main = makeCloth(7, 10, R.cloth);
    pivot.add(this.main.mesh);
    this.jib = makeCloth(5, 8, R.jib);
    this.body.add(this.jib.mesh);
    // The masthead flag, and two telltales on the mainsail's luff.
    this.burgee = new THREE.Group();
    this.burgee.position.set(0, 0.16 + R.height, zm);
    const flag = new THREE.Mesh(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.06, 0), new THREE.Vector3(0, -0.06, 0), new THREE.Vector3(0, 0, 0.42)]), new THREE.MeshBasicMaterial({ color: '#c0392b', side: THREE.DoubleSide }));
    this.burgee.add(flag);
    this.body.add(this.burgee);
    this.telltales = [0.35, 0.62].map((v) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.24).translate(0, -0.12, 0).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color: '#2e6f9e', side: THREE.DoubleSide }));
      pivot.add(m);
      return { m, v };
    });
    // The mainsheet, from the end of the boom down to its block on the stern thwart.
    this.sheetLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: '#e9e2d0' }));
    this.sheetLine.frustumCulled = false;
    this.body.add(this.sheetLine);
    this.sheetBlock = new THREE.Vector3(0, sheer(H, 0.12) - 0.02, zAt(H, 0.12));
    // The tiller, turning with the rudder (one hand on it at the helm).
    this.rudder = new THREE.Group();
    this.rudder.position.set(0, sheer(H, 0) + 0.05, zAt(H, 0) - 0.12);
    const tiller = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.95, 6), new THREE.MeshLambertMaterial({ color: '#8a6440' }));
    tiller.rotation.x = Math.PI / 2 - 0.12;
    tiller.position.set(0, 0.05, 0.47);
    this.rudder.add(tiller);
    this.tillerGrip = new THREE.Vector3(0, 0.1, 0.88); // in the rudder's own space
    this.body.add(this.rudder);
    this.fill = 0;
    this.flutter = 0;
    this.setSail(false);
  }

  // The sail up (you sit at the helm, aft) or down and furled on the boom (you sit at the oars).
  setSail(up) {
    if (!this.hull.sail) return;
    // (Raised, the boom goes out on the side away from the wind as it is now.)
    if (up && !this.sailUp) {
      const air = windAt(this.pos.x, this.pos.z);
      this.sailSide = air.x * this.right.x + air.z * this.right.z < 0 ? 1 : -1;
    }
    this.sailUp = !!up;
    // (Up goes the sail, up comes the outboard: one or the other.)
    if (this.sailUp && this.outboardDown) {
      this.outboardDown = false;
      this.motor = false;
      this.lever = 0;
      this.power = 0;
    }
    this.main.mesh.visible = this.jib.mesh.visible = this.sailUp;
    this.furl.visible = !this.sailUp;
    for (const tt of this.telltales) tt.m.visible = this.sailUp;
    this.sheetLine.visible = this.sailUp;
    // (Under sail, or under power, the oars lie stowed in the bottom of the boat.)
    for (const oar of this.oars || []) oar.g.visible = !this.sailUp && !this.outboardDown;
    this.setSeat(this.sailUp || this.outboardDown ? this.hull.seatZ : this.hull.sail && this.hull.rowZ);
  }

  // Where you sit, fore and aft (the rod comes with you).
  setSeat(z) {
    if (this.seatZ === z) return;
    this.seatZ = z;
    if (this.torso) this.torso.position.z = 0.02 + z;
    for (const rod of Object.values(this.rods || {})) {
      rod.group.position.z = 0.34 + z;
      rod.hold.z = 0.34 + z;
    }
  }

  // Lay the sails out for this frame: the main round the boom, the jib from its tack; bellied to
  // leeward by how full the wind holds them, rippling where they luff.
  shapeSails(t) {
    const R = this.hull.sail, side = this.sailSide, fill = this.fill, fl = this.flutter;
    const M = this.main, mp = M.geo.attributes.position.array;
    const luff = R.head - R.gooseneck - 0.05;
    for (let j = 0; j <= M.NV; j++) {
      const v = j / M.NV, chord = R.boom * 0.97 * (1 - v) + 0.22 * Math.sin(Math.PI * v) * (1 - v);
      for (let i = 0; i <= M.NU; i++) {
        const u = i / M.NU, k = (j * (M.NU + 1) + i) * 3;
        const camber = chord * (0.11 * fill + 0.015) * 4 * u * (1 - u) * (1 - 0.35 * v);
        const ripple = fl * chord * 0.07 * Math.sin(u * 9 + t * 17 + v * 4) * Math.min(1, u * 3) * (0.5 + 0.5 * v);
        mp[k] = side * (camber + ripple);
        mp[k + 1] = 0.06 + v * luff + u * 0.04 * (1 - v);
        mp[k + 2] = -u * chord;
      }
    }
    M.geo.attributes.position.needsUpdate = true;
    M.geo.computeVertexNormals();
    // The jib: luff along the forestay, its clew swung out to leeward with the boom (a little
    // less), bellied the same way.
    const J = this.jib, jp = J.geo.attributes.position.array;
    const top = this.rig.jibTop, stem = this.rig.stem, ja = Math.max(0.08, Math.abs(this.boomYaw) * 0.82);
    const clew = _a.set(side * Math.sin(ja) * R.jibFoot, stem.y + 0.45, stem.z - Math.cos(ja) * R.jibFoot);
    for (let j = 0; j <= J.NV; j++) {
      const v = j / J.NV;
      // Up the luff from the tack to the head; the leech from the clew to the head.
      const lx = stem.x + (top.x - stem.x) * v, ly = stem.y + 0.05 + (top.y - stem.y) * v, lz = stem.z + (top.z - stem.z) * v;
      const cx = clew.x + (top.x - clew.x) * v, cy = clew.y + (top.y - clew.y) * v, cz = clew.z + (top.z - clew.z) * v;
      const chord = Math.hypot(cx - lx, cz - lz);
      for (let i = 0; i <= J.NU; i++) {
        const u = i / J.NU, k = (j * (J.NU + 1) + i) * 3;
        const camber = chord * (0.13 * fill + 0.02) * 4 * u * (1 - u);
        const ripple = fl * chord * 0.09 * Math.sin(u * 8 + t * 19 + v * 3) * Math.min(1, u * 3);
        // (Out to leeward, square to the chord.)
        const nx = (cz - lz) / (chord || 1), nz = -(cx - lx) / (chord || 1), sgn = Math.sign(nx * side || side);
        jp[k] = lx + (cx - lx) * u + nx * sgn * (camber + ripple);
        jp[k + 1] = ly + (cy - ly) * u;
        jp[k + 2] = lz + (cz - lz) * u + nz * sgn * (camber + ripple);
      }
    }
    J.geo.attributes.position.needsUpdate = true;
    J.geo.computeVertexNormals();
    // Telltales on the luff: streaming aft when she's drawing, lifting and twitching when not.
    for (const tt of this.telltales) {
      const y = 0.06 + tt.v * luff, chord = R.boom * (1 - tt.v);
      tt.m.position.set(side * chord * 0.02, y, -0.12 - tt.v * 0.02);
      tt.m.rotation.set(fl * Math.sin(t * 23 + tt.v * 9) * 0.9, side * 0.15 + fl * Math.sin(t * 13 + tt.v) * 0.8, 0);
    }
  }

  buildAnchorLine(scene) {
    const H = this.hull, k = H.paddle ? 0.6 : H.L > 5 ? 1.2 : 1;
    const model = () => {
      const parts = [
        { geo: new THREE.CylinderGeometry(0.018, 0.018, 0.5, 6), matrix: mat(0, 0.25, 0), color: '#4a4d52' },
        { geo: new THREE.TorusGeometry(0.04, 0.012, 5, 10), matrix: mat(0, 0.53, 0), color: '#4a4d52' },
        { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.34, 5), matrix: mat(0, 0.44, 0, 0, 0, Math.PI / 2), color: '#4a4d52' },
        { geo: new THREE.BoxGeometry(0.3, 0.04, 0.03), matrix: mat(0, 0.02, 0), color: '#4a4d52' },
        { geo: new THREE.BoxGeometry(0.08, 0.13, 0.025), matrix: mat(0.15, 0.07, 0, 0, 0, -0.5), color: '#3f4246' },
        { geo: new THREE.BoxGeometry(0.08, 0.13, 0.025), matrix: mat(-0.15, 0.07, 0, 0, 0, 0.5), color: '#3f4246' },
      ];
      const m = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.4 }));
      m.scale.setScalar(k);
      m.castShadow = true;
      return m;
    };
    // Stowed: lying on the foredeck.
    this.anchorStowed = model();
    this.anchorStowed.position.set(0.1, sheer(H, 0.9) + 0.03, zAt(H, 0.86));
    this.anchorStowed.rotation.set(-Math.PI / 2, 0, 0.3);
    this.body.add(this.anchorStowed);
    // Out: in the world, on the end of its rope (the ring at the top).
    this.anchorOut = new THREE.Group();
    this.anchorOut.add(model());
    this.anchorOut.visible = false;
    scene.add(this.anchorOut);
    this.rode = new Rope(scene, { segments: 16, radius: 0.012 * Math.max(1, k) });
    this.fairlead = new THREE.Vector3(0, sheer(H, 1) - 0.04, H.L / 2 - 0.05);
  }

  // Lines and fenders for tying up: a cleat at the bow and the stern, a line from each to the
  // pier, and two fenders hung over the side against it.
  buildMooringGear(scene) {
    const H = this.hull;
    this.cleats = [new THREE.Vector3(0.06, sheer(H, 0.93) + 0.02, zAt(H, 0.92)), new THREE.Vector3(0.06, sheer(H, 0.06) + 0.02, zAt(H, 0.07))];
    this.lines = [new Rope(scene, { segments: 6, radius: 0.011, color: '#e8dcc0' }), new Rope(scene, { segments: 6, radius: 0.011, color: '#e8dcc0' })];
    const fender = new THREE.CylinderGeometry(0.075, 0.075, 0.34, 10);
    const mat2 = new THREE.MeshLambertMaterial({ color: '#f1efe8' });
    this.fenders = [0.3, 0.68].map((t) => {
      const f = new THREE.Mesh(fender, mat2);
      f.userData.t = t;
      f.visible = false;
      this.body.add(f);
      return f;
    });
  }

  // Drop the anchor (on) or haul it in (off). at: where it lies, instant: already on the bottom
  // (a saved game). Hauling in takes a moment: she stays at anchor until it's up.
  setAnchor(on, { at = null, instant = false } = {}) {
    if (!on) {
      if (this.anchor) this.anchor.phase = 'haul';
      return;
    }
    this.lever = 0;
    this.anchored = true;
    if (this.anchor && this.anchor.phase === 'haul') {
      this.anchor.phase = 'set';
      this.anchor.reach = reachFor(this.anchor.depth);
      return;
    }
    const x = at ? at.x : this.pos.x + this.fwd.x * this.hull.L * 0.45, z = at ? at.z : this.pos.z + this.fwd.z * this.hull.L * 0.45;
    const floor = solidHeight(x, z), depth = Math.max(0.3, -floor);
    this.anchor = { x, z, floor, depth, reach: reachFor(depth), y: instant ? floor : this.heave + sheer(this.hull, 1) - this.hull.draft, phase: instant ? 'set' : 'drop', tension: 0 };
    this.anchorPt.set(x, floor, z);
  }

  // Made fast alongside a pier (a berth from mooring.js), or cast off (pushed gently clear: nx, nz
  // the way out).
  tieTo(B) {
    this.tie = { ...B, t: 0 };
    this.lever = 0;
  }

  castOff(nx = 0, nz = 0) {
    this.tie = null;
    // (A shove off with a hand on the pier: a steady push away for a moment, eased off.)
    this.shove = { x: nx, z: nz, t: 2 };
  }

  buildOar(side) {
    const g = new THREE.Group();
    g.rotation.order = 'YZX';
    g.position.set(side * (hw(this.hull, OAR_T) + 0.02), sheer(this.hull, OAR_T) + 0.06, zAt(this.hull, OAR_T));
    const parts = [
      { geo: new THREE.CylinderGeometry(0.028, 0.028, 2.0, 6), matrix: mat(side * 0.4, 0, 0, 0, 0, Math.PI / 2), color: '#c9a16b' },
      { geo: new THREE.CylinderGeometry(0.036, 0.036, 0.26, 6), matrix: mat(side * -0.5, 0, 0, 0, 0, Math.PI / 2), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.42, 0.16, 0.03), matrix: mat(side * 1.55, 0, 0), color: '#3f7f86' },
      { geo: new THREE.BoxGeometry(0.12, 0.16, 0.032), matrix: mat(side * 1.82, 0, 0), color: '#f1e6cc' },
    ];
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshLambertMaterial({ vertexColors: true }));
    mesh.castShadow = true;
    g.add(mesh);
    this.body.add(g);
    return {
      g, side, blend: 0, wasIn: 0,
      handle: new THREE.Vector3(side * -0.55, 0, 0),
      blade: new THREE.Vector3(side * 1.6, 0, 0),
    };
  }

  buildRods() {
    // One of each rod; only the one in use shows. Held at the rower's hands while fishing.
    this.rods = {};
    for (const [id, def] of Object.entries(RODS)) {
      const rod = buildRod(def.look);
      rod.group.position.set(0.05, this.seatY + 0.33, 0.34 + this.seatZ);
      rod.hold = rod.group.position.clone();
      rod.group.visible = false;
      this.body.add(rod.group);
      this.rods[id] = rod;
    }
    this.setRod('float');

    // Stowed rod lying along the starboard side. (The yacht and the centre console have theirs
    // standing in the rod holders.)
    this.rodStowed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.024, 2.4, 5), new THREE.MeshLambertMaterial({ color: '#8a5a34' }));
    this.rodStowed.rotation.set(Math.PI / 2 - 0.06, 0, 0);
    if (this.hull.stow) this.rodStowed.position.set(...this.hull.stow);
    this.body.add(this.rodStowed);
  }

  setRod(id) {
    const next = this.rods[id] || this.rods.float;
    if (this.active === next) return;
    if (this.active) this.active.group.visible = false;
    this.active = next;
    this.rod = next.group;
    this.rodTip = next.tip;
  }

  // Someone stepped ashore (or back in): the rower and their rod come and go.
  setRower(on) {
    this.occupied = on;
    for (const p of this.rowerParts) p.visible = on;
    if (!on) this.rod.visible = false;
  }

  // A point in the boat's own space a little way from you (across, up, ahead): ahead is the way
  // you face, standing.
  fromYou(out, across, up, ahead) {
    const S = this.standAt;
    if (!S) return out.set(across, this.seatY + up, this.seatZ + ahead);
    const c = Math.cos(S.yaw), s = Math.sin(S.yaw);
    return out.set(S.x + across * c + ahead * s, S.y + up, S.z - across * s + ahead * c);
  }

  // The way you face (standing, you turn to face your line).
  get facing() {
    return this.heading + (this.standAt ? this.standAt.yaw : 0);
  }

  // Where a landed fish is held up for a look.
  holdPoint(out) {
    if (this.viewHold) return out.copy(this.viewHold);
    return this.body.localToWorld(this.fromYou(out, -0.15, 0.98, 1.05));
  }

  // Your eyes in first person: where you sit (or stand), rising and rolling with the boat (level:
  // only rising and falling with it, for a steady horizon).
  eyePoint(out, level = false) {
    return (level ? this.group : this.body).localToWorld(this.fromYou(out, 0, 0.81, 0.1));
  }

  // In first person the figure draws nothing on screen, but still casts its shadow.
  setSelfHidden(on) {
    if (on === this.selfHidden) return;
    this.selfHidden = on;
    for (const m of this.selfMats) {
      m.colorWrite = !on;
      m.depthWrite = !on;
    }
  }

  // Where a released fish goes back in: just off the side (standing, over the rail you're facing).
  releasePoint(out) {
    if (this.standAt) {
      this.body.localToWorld(this.fromYou(out, 0, 0, 2.2));
      return out.setY(0);
    }
    return out.set(this.pos.x + this.right.x * 2.2 + this.fwd.x, 0, this.pos.z + this.right.z * 2.2 + this.fwd.z);
  }

  buildLantern() {
    this.lanternRig = new THREE.Group();
    // At the stern of the rowing boat; on the skiff the motor is there, so it goes in the bow.
    const [lx, lz] = this.hull.lantern;
    this.lanternRig.position.set(lx, Math.max(0, sheer(this.hull, 0.5) - 0.65), lz);
    this.lanternRig.visible = false;
    const wood = new THREE.MeshLambertMaterial({ color: '#6b4a30' });
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.032, 1.3, 6), wood);
    pole.position.y = 0.95;
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.4), wood);
    arm.position.set(0, 1.58, -0.18);
    this.lanternRig.add(pole, arm);
    this.lanternHanger = new THREE.Group();
    this.lanternHanger.position.set(0, 1.56, -0.36);
    const model = buildLanternModel();
    this.lanternGlass = model.glassMat;
    this.lanternHanger.add(model.group);
    this.lanternLight = new THREE.PointLight('#ffb15c', 0, 18, 1.6);
    this.lanternLight.position.y = -0.2;
    this.lanternHanger.add(this.lanternLight);
    this.lanternRig.add(this.lanternHanger);
    this.body.add(this.lanternRig);
  }

  setLantern(on) {
    if (this.hull.noLantern) on = false; // (nowhere to hang one on a board or a jet ski)
    this.hasLantern = on;
    this.lanternRig.visible = on;
  }

  lanternWorld(target) {
    return this.lanternLight.getWorldPosition(target);
  }

  /* ---------- per-frame ---------- */

  update(dt, t, throttle, steer, lanternLevel) {
    const fishing = this.pose.fishing > 0.5;
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));

    // The boat moves through the water, and the water itself moves (the current): oars, motor
    // and hull drag all work on the boat's speed through the water; the current carries the lot.
    // The wind pushes on the hull by how fast the air goes past it. (Each counted once.)
    const H0 = this.hull, cs = currentScale();
    const cur = currentAt(this.pos.x, this.pos.z, 0);
    this.drift.set(cur.x * cs, 0, cur.z * cs);
    const air = windAt(this.pos.x, this.pos.z);
    const ax = air.x - this.vel.x, az = air.z - this.vel.z, aw = Math.hypot(ax, az) * (H0.windage ?? 0.003);
    let vf = (this.vel.x - this.drift.x) * this.fwd.x + (this.vel.z - this.drift.z) * this.fwd.z;
    let vr = (this.vel.x - this.drift.x) * this.right.x + (this.vel.z - this.drift.z) * this.right.z;
    const wf = (ax * this.fwd.x + az * this.fwd.z) * aw, wr = (ax * this.right.x + az * this.right.z) * aw;
    // Push and drag, stepped exactly (so a boat drifts and coasts the same at any frame rate).
    const step = (v, push, k) => {
      const e = Math.exp(-k * dt);
      return v * e + (push * (1 - e)) / k;
    };
    let thrust;
    const H = this.hull, M = H.motor || (this.outboardDown ? H.outboard : null);
    const E = H.emotor && this.emotorDown ? H.emotor : null;
    if (M || E) {
      // The throttle lever (throttle here) sets what the motor gives, a moment behind (see spool);
      // the leg tips up in shallow water. (On the bass boat, the first notches run the electric
      // motor at the bow instead: slow, silent, and happy in shallow water. The kayak's motor is
      // electric too, on its stern.)
      const p = this.pos;
      const lever = this.anchored || this.tie ? 0 : throttle;
      const troll = !!M?.troll && lever > 0 && lever <= M.troll;
      this.spool(dt, lever, troll || !!E);
      const pw = this.power;
      // A dead motor (no petrol, or a flat battery for an electric one): an oar, slowly (the
      // kayak's paddle is always there instead: see the game).
      const dead = E ? this.kflat : troll ? this.flat : this.dry;
      const depth = -solidHeight(p.x - this.fwd.x * H.L * 0.45, p.z - this.fwd.z * H.L * 0.45);
      const tilted = depth < (E || M).tilt && !troll;
      if (tilted && !this.tilted && lever > 0.05 && this.onShallow && !dead) this.onShallow();
      this.tilted = tilted;
      if (dead) thrust = E ? 0 : pw * (pw > 0 ? 0.6 : 0.8);
      else if (troll) thrust = 0.45 * (pw / M.troll);
      else thrust = (pw > 0 ? (E || M).thrust * pw : (E || M).astern * pw) * (tilted ? 0.22 : 1);
      const spin = troll || dead || E ? 0 : pw;
      this.propSpin += dt * (6 + Math.abs(spin) * 60) * Math.sign(spin || 1) * (Math.abs(spin) > 0.02 ? 1 : 0.1);
      if (this.trollProp) this.trollProp.rotation.z += dt * (troll && !dead ? 40 * Math.min(1, pw / 0.05) : 0);
      if (this.kayakProp) this.kayakProp.rotation.z += dt * (E && !dead ? 34 * pw : 0);
      const drag = H.drag || [0.26, 0.055];
      vf = step(vf, thrust + wf, drag[0] + drag[1] * Math.abs(vf));
      vr = step(vr, wr, H.side || 3.2);
      // The tiller turns the boat even when slow, more so with the propeller pushing (the
      // trolling motor steers the bow round on the spot; the kayak's rudder needs way on).
      // (A jet steers by turning its jet: off the throttle it hardly turns at all.)
      // (Twin screws bring a big boat round handily when she's slow: one ahead, one astern.)
      const jet = M?.jet ? 0.15 + 0.85 * clamp(Math.abs(pw) * 2.5, 0, 1) : 1;
      const twin = M?.twin && !dead ? 0.45 * (1 - clamp(Math.abs(vf) / 3, 0, 1)) : 0;
      const turnRate = (troll ? 0.9 : E ? 0.5 + 0.6 * clamp(Math.abs(vf) / 1.2, 0, 1) : 0.45 + 0.75 * clamp(Math.abs(vf) / 4, 0, 1) + 0.35 * Math.abs(pw) + twin) * (H.helm ?? 1) * jet;
      this.omega = damp(this.omega, steer * turnRate * (vf < -0.3 ? -1 : 1), 2.6, dt);
    } else if (H.rig) {
      // The windsurf board: the same sail (sailing.js) on a small rig and a light board. Fast
      // enough it planes and slips away; held overpowered too long (hauled in hard in a gust) and
      // you're catapulted in; a few seconds later you're back on and pulling the rig up.
      this.power = 0;
      const down = this.fallen > 0, held = this.anchored || this.tie;
      const A = (this.sailing = sailForce(ax, az, this.fwd.x, this.fwd.z, this.right.x, this.right.z, this.sheet, this.sailing || {}, H.rig));
      thrust = held || down ? 0 : A.drive;
      const lateral = held || down ? 0 : A.lateral;
      vf = step(vf, thrust + wf * 0.3, down ? 1.6 : boardDrag(vf));
      vr = step(vr, lateral + wr * 0.3, down ? 2.5 : finGrip(vf));
      this.planing = damp(this.planing, smoothstep(3.2, 4.6, Math.abs(vf)), 2, dt);
      const bite = 0.3 + 0.9 * clamp(Math.abs(vf) / 4, 0, 1);
      this.omega = damp(this.omega, down ? 0 : steer * bite * H.turn * (vf < -0.3 ? -1 : 1), 3, dt);
      if (down) {
        this.fallen = Math.max(0, this.fallen - dt);
        if (!this.fallen) {
          this.standLegs(this.sailSide || 1);
          this.onUp?.(this);
        }
      } else if (!held) {
        // (More than you can hang on to: hauled in past its best in a strong wind, or simply a
        // gale in the sail. Eased to its best angle it's held in anything short of that.)
        const over = (A.pull > 7 && A.alpha > SAIL.best + 0.12) || A.pull > 13;
        this.overT = over ? this.overT + dt : Math.max(0, this.overT - dt * 0.8);
        if (this.overT > 1.1) this.fall('catapult');
      }
      if (A.side !== this.sailSide && !down) {
        if (A.awa > 1.9 && Math.abs(vf) > 2.5) this.onGybe?.(this, A);
        else this.onTack?.(this, A);
        this.sailSide = A.side;
        this.standLegs(this.sailSide);
      }
    } else if (H.sail && this.sailUp) {
      // Under sail: the apparent wind on the sail (the air's motion less hers, gusts and all)
      // drives her on and pushes her sideways; the centreboard grips the water against the push,
      // you sit out against the heel, and a hard-pressed boat slows and turns up into the wind.
      // The tiller only bites with way on; stopped head to wind, the bow blows off one way or
      // the other.
      this.power = 0;
      const A = (this.sailing = sailForce(ax, az, this.fwd.x, this.fwd.z, this.right.x, this.right.z, this.sheet, this.sailing || {}));
      thrust = this.anchored || this.tie ? 0 : A.drive * this.reef;
      const lateral = this.anchored || this.tie ? 0 : A.lateral * this.reef;
      this.heel = damp(this.heel, heelFor(lateral), 2.2, dt);
      const pressed = smoothstep(0.3, 0.5, Math.abs(this.heel));
      vf = step(vf, thrust * (1 - 0.5 * pressed) + wf * 0.4, hullDrag(vf));
      vr = step(vr, lateral + wr * 0.4, boardGrip(vf));
      const bite = 0.16 + 0.62 * clamp(Math.abs(vf) / 2.2, 0, 1);
      // (Turning up into the wind when pressed; falling off when stopped in irons.)
      const helm = -A.side * pressed * 0.25;
      const blowOff = A.state === 'irons' && Math.abs(vf) < 0.6 ? (steer ? -Math.sign(steer) : A.side) * 0.14 : 0;
      this.omega = damp(this.omega, steer * bite * (vf < -0.3 ? -1 : 1) + helm + blowOff, 2.4, dt);
      // Tacking and gybing: the wind crosses the bow or the stern and the boom comes across.
      if (A.side !== this.sailSide) {
        if (A.awa > 1.9) this.onGybe?.(this, A);
        else this.onTack?.(this, A);
        this.sailSide = A.side;
      }
    } else {
      // Rowing (or paddling) rhythm
      this.power = 0;
      if (H.sail) this.heel = damp(this.heel, 0, 2, dt);
      const rowing = (throttle !== 0 || steer !== 0) && !this.anchored && !this.tie;
      if (rowing) this.phase += dt * Math.PI * 2 * H.rate;
      // A paddle pulls on every half-stroke, left then right; oars once a stroke.
      const sw = H.paddle ? Math.abs(Math.sin(this.phase)) : Math.max(0, Math.sin(this.phase));
      const pulse = 0.5 + 0.5 * sw;
      // Throttle can be partial (touch stick), so it scales the stroke.
      const pull = this.anchored || this.tie ? 0 : throttle;
      thrust = pull > 0 ? H.pull * pulse * pull : pull < 0 ? H.back * pulse * pull : 0;
      vf = step(vf, thrust + wf, H.drag[0] + H.drag[1] * Math.abs(vf));
      vr = step(vr, wr, H.side);
      const turnRate = H.turn + 0.25 * clamp(Math.abs(vf) / 5, 0, 1);
      this.omega = damp(this.omega, steer * turnRate * (fishing ? 0.5 : 1) * (this.anchored ? 0.3 : 1), 2.8, dt);
    }
    // (Fishing without a motor running, the boat settles; under power it goes on, trolling.)
    if (fishing && !this.power) vf *= Math.exp(-0.9 * dt);
    // (In the ocean's long swell, driven harder than she'll take, she slams and slows to it.)
    if (vf > this.vmax) vf = this.vmax + (vf - this.vmax) * Math.exp(-10 * dt);
    this.vel.copy(this.fwd).multiplyScalar(vf).addScaledVector(this.right, vr).add(this.drift);
    if (this.anchor) this.holdAnchor(dt, steer);
    if (this.tie) this.holdTie(dt);
    if (this.shove) {
      const S = this.shove, want = 0.75 * Math.min(1, S.t / 1.2), along = this.vel.x * S.x + this.vel.z * S.z;
      if (along < want) {
        this.vel.x += S.x * (want - along);
        this.vel.z += S.z * (want - along);
      }
      S.t -= dt;
      if (S.t <= 0) this.shove = null;
    }
    this.forwardSpeed = vf;
    this.heading += this.omega * dt;

    this.pos.addScaledVector(this.vel, dt);
    this.collide(dt);

    // Ride the waves: the water under the bow and stern, both sides and the middle, sampled at the
    // hull's own length and beam, so a long boat bridges short chop and only the swell lifts it,
    // while a kayak follows every wavelet. Gentle limits: a boat heaves, pitches and rolls but is
    // never tipped over by a wave.
    const f = this.fwd, r = this.right, p = this.pos;
    const L2 = H.L * 0.42, B2 = Math.max(0.35, H.B * 0.95);
    const hb = waveHeight(p.x + f.x * L2, p.z + f.z * L2, t);
    const hs = waveHeight(p.x - f.x * L2, p.z - f.z * L2, t);
    const hp = waveHeight(p.x - r.x * B2, p.z - r.z * B2, t);
    const hst = waveHeight(p.x + r.x * B2, p.z + r.z * B2, t);
    const hm = waveHeight(p.x, p.z, t);
    const hc = (hb + hs + hp + hst + 2 * hm) / 6;
    // (A broad bass boat sits steadier on the swell than the narrow wooden boats. In a storm's big
    // seas every boat pitches and rolls a good deal more, but none is ever tipped over.)
    const wild = conditions.sea.storm, pl = 0.2 + 0.24 * wild, rl = 0.22 + 0.22 * wild;
    const targetPitch = clamp(-Math.atan2(hb - hs, 2 * L2) - thrust * 0.004, -pl, pl) * (0.5 + 0.5 * H.steady);
    const targetRoll = clamp(Math.atan2(hp - hst, 2 * B2) + this.omega * vf * 0.035, -rl, rl) * H.steady + Math.sin(t * 0.9) * (0.008 + 0.05 * wild) * H.steady + (H.sail ? this.heel : 0);
    const ride = H.ride ?? 4;
    this.pitch = damp(this.pitch, this.air ? -0.12 : targetPitch, ride, dt);
    this.roll = damp(this.roll, targetRoll, ride, dt);
    if (H.jumps && (this.air || Math.abs(vf) > 7)) {
      // The jet ski at speed: up a wave's face and off its top it flies, the water dropping away
      // faster than it falls, and lands a little way on with a smack.
      if (this.air) {
        this.vy -= 9.81 * dt;
        this.heave += this.vy * dt;
        if (this.heave <= hc) {
          const hit = -this.vy;
          this.air = false;
          this.heave = hc;
          this.vy = 0;
          if (hit > 1) this.onLand?.(this, hit);
        }
      } else {
        const was = this.heave;
        this.heave = damp(this.heave, hc, ride + 1, dt);
        this.vy = (this.heave - was) / Math.max(dt, 1e-3);
        // (Over a crest the water falls away under her faster than she can follow, the bow
        // lifting her: she leaves it, a little higher the faster she's going.)
        const surface = (hc - this.lastHc) / Math.max(dt, 1e-3), drop = (surface - this.lastSv) / Math.max(dt, 1e-3);
        this.lastSv = surface;
        if (drop < -3.2 && surface > -0.35 && this.vy > -0.1) {
          this.air = true;
          this.vy = Math.max(this.vy, 0) + 0.25 + 0.75 * smoothstep(7, 17, Math.abs(vf));
        }
      }
    } else {
      this.air = false;
      this.heave = damp(this.heave, hc, ride + 1, dt);
    }
    this.lastHc = hc;

    this.group.position.set(p.x, this.heave - H.draft, p.z);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.roll;

    this.animate(dt, t, throttle, steer, lanternLevel);
    this.group.updateMatrixWorld(true);
    this.updateGear();
  }

  // At anchor. The anchor goes down to the seabed (she drifts a little until it bites); then
  // the rope holds her bow within its reach of it: she drifts back on the wind and tide until it
  // comes tight, lies there head to the anchor, swinging and riding the waves as they come (no
  // more held than that: nothing pins her in place). Hauling in shortens the rope, drawing her up
  // over the anchor, and then it comes up to the bow.
  holdAnchor(dt, steer) {
    const A = this.anchor, H = this.hull;
    const bowY = this.heave + sheer(H, 1) - H.draft;
    if (A.phase === 'drop') {
      A.y = Math.max(A.floor, A.y - Math.max(2.6, A.depth / 3) * dt);
      if (A.y <= A.floor + 0.001) {
        A.phase = 'set';
        this.onAnchor?.('set', this);
      } else return;
    }
    if (A.phase === 'haul') {
      A.reach = Math.max(0, A.reach - 2.4 * dt);
      if (A.reach < 0.8) {
        A.y = Math.min(bowY, A.y + Math.max(2.4, A.depth / 3) * dt);
        if (A.y >= bowY - 0.05) {
          this.anchor = null;
          this.anchored = false;
          this.onAnchor?.('up', this);
          return;
        }
      }
    }
    const bx = this.pos.x + this.fwd.x * H.L * 0.45, bz = this.pos.z + this.fwd.z * H.L * 0.45;
    const dx = bx - A.x, dz = bz - A.z, d = Math.hypot(dx, dz) || 1e-6, reach = Math.max(0.3, A.reach);
    A.tension = clamp((d - reach * 0.8) / (reach * 0.2 + 0.3), 0, 1);
    if (d > reach) {
      const nx = dx / d, nz = dz / d, k = Math.min(1, 4 * dt);
      this.pos.x -= nx * (d - reach) * k;
      this.pos.z -= nz * (d - reach) * k;
      const out = this.vel.x * nx + this.vel.z * nz;
      if (out > 0) {
        this.vel.x -= nx * out;
        this.vel.z -= nz * out;
      }
    }
    // Held by the bow, she swings to lie head to the anchor (the tighter the rope, the surer).
    if (A.tension > 0.05 && Math.abs(steer) < 0.05) this.heading = dampAngle(this.heading, Math.atan2(-dx, -dz), 0.2 + 1.1 * A.tension, dt);
  }

  // Tied up: the lines hold her at her berth, lying along the pier (eased in over a moment as
  // they're made fast), nudged by the waves and the wind but going nowhere.
  holdTie(dt) {
    const T = this.tie;
    T.t += dt;
    const k = T.t < 1.5 ? 3 : 7, c = T.t < 1.5 ? 3 : 5;
    this.vel.x += ((T.x - this.pos.x) * k - this.vel.x * c) * dt;
    this.vel.z += ((T.z - this.pos.z) * k - this.vel.z * c) * dt;
    this.heading = dampAngle(this.heading, T.heading, T.t < 1.5 ? 1.6 : 3, dt);
    this.omega = 0;
  }

  // Where the anchor, its rope, the mooring lines and the fenders are this frame.
  updateGear() {
    const A = this.anchor, H = this.hull;
    this.anchorStowed.visible = !A;
    if (A) {
      const o = this.anchorOut, lying = A.y <= A.floor + 0.05 && A.phase !== 'haul';
      o.visible = true;
      o.position.set(A.x, A.y, A.z);
      // Hanging from its ring on the way down and up; on the bottom it falls over on its side.
      o.rotation.set(lying ? 1.25 : 0, Math.atan2(this.pos.x - A.x, this.pos.z - A.z), 0);
      this.body.localToWorld(_a.copy(this.fairlead));
      // (The rope's made fast to the anchor's ring, wherever that lies.)
      o.updateMatrixWorld(true);
      o.children[0].localToWorld(_b.set(0, 0.53, 0));
      this.rode.rode(_a, _b, A.phase === 'drop' || (A.phase === 'haul' && A.reach < 0.8) ? 1 : A.tension, solidHeight);
    } else {
      this.anchorOut.visible = false;
      this.rode.hide();
    }
    const T = this.tie;
    if (T) {
      const P = PIERS[T.pier], fx = Math.sin(T.heading), fz = Math.cos(T.heading);
      const long = P.x1 - P.x0 >= P.z1 - P.z0;
      // The pier's edge on her side, with a bollard abreast her bow and her stern.
      const edge = (u) => (long
        ? _d.set(clamp(T.x + fx * u, P.x0 + 0.1, P.x1 - 0.1), P.deck + 0.12, T.side < 0 ? P.z0 + 0.05 : P.z1 - 0.05)
        : _d.set(T.side < 0 ? P.x0 + 0.05 : P.x1 - 0.05, P.deck + 0.12, clamp(T.z + fz * u, P.z0 + 0.1, P.z1 - 0.1)));
      for (let i = 0; i < 2; i++) {
        this.body.localToWorld(_a.copy(this.cleats[i]));
        edge(i ? -H.L * 0.55 : H.L * 0.55);
        this.lines[i].lay(_a, _d, { tension: 0.3, sag: 0.35 });
      }
      // The fenders hang on the side towards the pier.
      const px = long ? 0 : -T.side, pz = long ? -T.side : 0;
      const sx = Math.sign(px * Math.cos(this.heading) - pz * Math.sin(this.heading)) || 1;
      for (const f of this.fenders) {
        const t = f.userData.t;
        f.visible = true;
        f.position.set(sx * (hw(H, t) + 0.06), sheer(H, t) - 0.22, zAt(H, t));
      }
    } else {
      for (const l of this.lines) l.hide();
      for (const f of this.fenders) f.visible = false;
    }
  }

  collide(dt) {
    const f = this.fwd, p = this.pos, v = this.vel, H = this.hull;
    let impact = 0;
    // How shallow it can go: a kayak floats in a hand's depth of water.
    const LIM = -H.shallow;
    const k = H.L / 3.8, w = Math.max(0.45, H.B / 0.8);
    for (const [off, rad] of [[1.45 * k, 0.5 * Math.min(w, 1.2)], [0.2 * k, 0.85 * w], [-1.3 * k, 0.75 * w]]) {
      const px = p.x + f.x * off, pz = p.z + f.z * off;
      // Shore and rocks: push back towards deeper water.
      const h = solidHeight(px, pz);
      if (h > LIM) {
        const e = 0.8;
        const gx = solidHeight(px + e, pz) - solidHeight(px - e, pz);
        const gz = solidHeight(px, pz + e) - solidHeight(px, pz - e);
        const gl = Math.hypot(gx, gz) || 1;
        const nx = -gx / gl, nz = -gz / gl;
        const pen = Math.min(h - LIM, 1.5);
        p.x += nx * pen * 0.35;
        p.z += nz * pen * 0.35;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= nx * vn * 1.2;
          v.z -= nz * vn * 1.2;
          impact = Math.max(impact, -vn);
        }
      }
      // The jetties and quays (closer alongside than the rough circles above: no wider than the
      // hull, so she can lie against a pier; tied up, the lines keep her there instead).
      const pr = Math.min(rad, (H.fend ?? H.B * 0.5) + 0.12);
      for (const P of this.tie ? [] : PIERS) {
        const bx0 = P.x0 - 0.1, bx1 = P.x1 + 0.1, bz0 = P.z0 - 0.1, bz1 = P.z1 + 0.1;
        const qx = clamp(px, bx0, bx1), qz = clamp(pz, bz0, bz1);
        const dx = px - qx, dz = pz - qz;
        const dist = Math.hypot(dx, dz);
        if (dist >= pr) continue;
        let nx, nz, pen;
        if (dist < 1e-4) {
          // Centre is inside the pier: push out through the nearest side.
          const ex = Math.min(px - bx0, bx1 - px), ez = Math.min(pz - bz0, bz1 - pz);
          if (ex < ez) { nx = px - bx0 < bx1 - px ? -1 : 1; nz = 0; pen = ex + pr; } else { nx = 0; nz = pz - bz0 < bz1 - pz ? -1 : 1; pen = ez + pr; }
        } else {
          nx = dx / dist;
          nz = dz / dist;
          pen = pr - dist;
        }
        p.x += nx * pen;
        p.z += nz * pen;
        const vn = v.x * nx + v.z * nz;
        if (vn < 0) {
          v.x -= nx * vn * 1.3;
          v.z -= nz * vn * 1.3;
          impact = Math.max(impact, -vn);
        }
      }
    }
    // The open sea goes on forever: near the edge of the map, a gentle current eases you back.
    // (Las Brasas, far to the south, has its own edges; and between the two, the open sea of the
    // crossing joins them, with edges only to either side.)
    const W = p.z > SOUTH_Z ? SOUTH_RECT : SEA, m = 80;
    const across = p.x > CROSSING.x0 && p.x < CROSSING.x1 && p.z > SEA.z1 - m - 20 && p.z < SOUTH_RECT.z0 + m + 20;
    const X0 = across ? CROSSING.x0 : W.x0, X1 = across ? CROSSING.x1 : W.x1;
    const ox = p.x < X0 + m ? X0 + m - p.x : p.x > X1 - m ? X1 - m - p.x : 0;
    const oz = across ? 0 : p.z < W.z0 + m ? W.z0 + m - p.z : p.z > W.z1 - m ? W.z1 - m - p.z : 0;
    v.x += ox * 0.5 * dt;
    v.z += oz * 0.5 * dt;
    this.bumpCooldown -= dt;
    if (impact > 1.2 && this.bumpCooldown <= 0 && this.onBump) {
      this.onBump(impact);
      this.bumpCooldown = 0.6;
    }
  }

  // Standing (the yacht, the centre console): at the wheel; or, with a line out, at the rail you
  // fish from (the cockpit aft, or the console's bow if that's the way you face as you cast),
  // turned to face the way the rod points, off the stern as readily as the side; round the
  // console or the fighting chair on the way between the two, not through it. On the yacht, a
  // big fish on the big-game rod is fought from the fighting chair: you sit, facing aft, the rod
  // butt in the gimbal between your knees and your feet on the footrest, and the chair swings
  // round to follow the fish.
  standUp(fishing, dt) {
    const S = this.hull.standing, u = smoothstep(0, 1, fishing), rod = wrapAngle(this.pose.rodYaw);
    if (fishing < 0.02) this.spot = null;
    else if (!this.spot) this.spot = S.bow && Math.abs(rod) < 1.2 ? S.bow : S.aft;
    this.chairT = damp(this.chairT, S.chair && this.pose.chair ? 1 : 0, 3, dt);
    const k = smoothstep(0, 1, this.chairT);
    // (In the chair you face aft, swinging no more than so far either side.)
    const swing = Math.PI + clamp(wrapAngle(rod - Math.PI), -1.1, 1.1);
    const yaw = lerp(rod * u, swing, k);
    const F = this.spot || S.aft, c = Math.cos(yaw), sn = Math.sin(yaw);
    const fx = F[0] + sn * F[2], fz = F[1] + (F === S.bow ? Math.max(0, c) : Math.min(0, c)) * F[3];
    const side = S.side ?? (Math.sign(sn) || 1);
    if (this.chair) this.chair.rotation.y = lerp(Math.PI, swing, k);
    const A = (this.standAt ||= { x: 0, z: 0, y: this.seatY, yaw: 0 });
    A.x = lerp(lerp(S.helm[0], fx, u) + Math.sin(Math.PI * u) * S.round * side, S.chair?.[0] ?? 0, k);
    A.z = lerp(lerp(S.helm[1], fz, u), S.chair?.[1] ?? 0, k);
    A.y = lerp(this.seatY, this.hull.floorY + (S.chair?.[2] ?? 0) + 0.02, k);
    A.yaw = yaw;
    const T = this.torso;
    T.rotation.order = 'YXZ';
    T.position.set(A.x, A.y, A.z);
    T.rotation.y = yaw;
    // Standing: feet a little apart under the hips, knees soft. Seated: knees up, feet out on the
    // footrest.
    const deck = this.hull.floorY + 0.04 - A.y;
    for (const L of this.legs) {
      this.fromYou(_a, L.s * 0.1, -0.02, lerp(0.02, 0.06, k));
      this.fromYou(_b, L.s * lerp(0.12, 0.15, k), lerp(deck / 2 + 0.02, 0.06, k), lerp(0.09, 0.44, k));
      this.fromYou(_e, L.s * lerp(0.14, 0.2, k), lerp(deck, -0.28, k), lerp(0.02, 0.66, k));
      setLimb(L.thigh, _a, _b, 0.07);
      setLimb(L.shin, _b, _e, 0.06);
      L.boot.position.set(_e.x + sn * 0.05, _e.y - 0.02, _e.z + c * 0.05);
      L.boot.rotation.set(0, yaw, 0);
    }
  }

  animate(dt, t, throttle, steer, lanternLevel) {
    const fishing = this.pose.fishing;
    const rowW = 1 - fishing;

    // Oars: each side has its own effort so turning on the spot sweeps them in opposite directions.
    for (const oar of this.oars) {
      const e = clamp(throttle + (oar.side > 0 ? -steer : steer) * 0.85, -1, 1) * rowW;
      const active = Math.abs(e) > 0.15;
      oar.blend = damp(oar.blend, active ? 1 : 0, 4, dt);
      const dir = e < 0 ? -1 : 1;
      const sweep = Math.cos(this.phase) * 0.55 * dir;
      const inWater = smoothstep(-0.25, 0.35, Math.sin(this.phase));
      const alpha = lerp(-0.95, sweep, oar.blend);
      const beta = lerp(0.2, lerp(0.1, 0.32, inWater), oar.blend);
      oar.g.rotation.y = oar.side > 0 ? -alpha : alpha;
      oar.g.rotation.z = oar.side > 0 ? -beta : beta;
      const isIn = inWater > 0.5 && oar.blend > 0.5 ? 1 : 0;
      if (isIn && !oar.wasIn && this.onStroke) {
        oar.g.updateMatrixWorld(true);
        this.onStroke(oar.g.localToWorld(_a.copy(oar.blade)), oar.side);
      }
      oar.wasIn = isIn;
    }

    // The kayak paddle: a dip on one side, then the other, sweeping back along the hull.
    const P = this.paddle;
    if (P) {
      // (With the motor down, the paddle rests across your knees.)
      const e = this.emotorDown ? 0 : clamp(Math.abs(throttle) + Math.abs(steer), 0, 1) * rowW;
      P.blend = damp(P.blend, e > 0.15 ? 1 : 0, 4, dt);
      const sn = Math.sin(this.phase), dir = throttle < 0 ? -1 : 1;
      // Rest across the knees; at work, the shaft tips down to the stroking side and sweeps.
      P.g.rotation.z = lerp(0, -0.55 * sn, P.blend);
      P.g.rotation.y = lerp(0, 0.45 * Math.cos(this.phase) * dir * Math.sign(sn || 1), P.blend);
      P.g.position.y = this.seatY + lerp(0.22, 0.36, P.blend);
      const isIn = Math.abs(sn) > 0.55 && P.blend > 0.5 ? Math.sign(sn) : 0;
      if (isIn && isIn !== P.wasIn && this.onStroke) {
        P.g.updateMatrixWorld(true);
        this.onStroke(P.g.localToWorld(_a.copy(P.blades[sn > 0 ? 0 : 1])), sn > 0 ? 1 : -1);
      }
      P.wasIn = isIn;
    }

    // The cabin door swings open and shut.
    if (this.cabinDoor) {
      this.cabinOpen = damp(this.cabinOpen, this.cabinTarget || 0, 4, dt);
      this.cabinDoor.rotation.y = -1.75 * this.cabinOpen;
    }
    // The kayak's motor: up out of the water, down, or kicked up in the shallows; it turns a little
    // with the rudder.
    if (this.emotorGroup) {
      const want = !this.emotorDown ? 1.35 : this.tilted ? 0.55 : 0;
      this.emotorGroup.rotation.x = damp(this.emotorGroup.rotation.x, want, 3.5, dt);
      this.emotorGroup.rotation.y = damp(this.emotorGroup.rotation.y, this.emotorDown ? -this.omega * 0.4 : 0, 5, dt);
    }
    // The outboard: propeller spinning, the leg turning with the tiller. (The sailing boat's,
    // when it's up, tilts right out of the water on its bracket.)
    if (this.wheel && !this.hull.bars) this.wheel.rotation.z = damp(this.wheel.rotation.z, -this.omega * 2.2, 6, dt);
    if (this.rudders) {
      // (The yacht's inboards: the propellers turning opposite ways, the rudders with the helm.)
      this.props.forEach((p, i) => (p.rotation.z = i ? -this.propSpin : this.propSpin));
      for (const r of this.rudders) r.rotation.y = damp(r.rotation.y, -steer * 0.5, 6, dt);
    } else if (this.motor) {
      this.props.forEach((p, i) => (p.rotation.z = i ? -this.propSpin : this.propSpin));
      for (const g of this.motorGroups) {
        g.rotation.y = damp(g.rotation.y, -this.omega * 0.35, 6, dt);
        g.rotation.x = damp(g.rotation.x, this.tilted ? -0.5 : 0, 3, dt);
      }
    } else if (this.motorGroup) {
      this.motorGroup.rotation.y = damp(this.motorGroup.rotation.y, 0, 4, dt);
      this.motorGroup.rotation.x = damp(this.motorGroup.rotation.x, -1.3, 3, dt);
    }
    // The rig: the boom swings out to leeward as far as the sheet and the wind let it (quickly
    // across in a gybe, more gently through a tack), the sails fill or flap, the flag streams
    // downwind and the rudder follows the helm.
    if (this.boomPivot) {
      const A = this.sailing;
      const up = this.sailUp && A;
      const want = up ? -this.sailSide * A.boom : 0;
      const across = Math.sign(want) !== Math.sign(this.boomYaw) && Math.abs(this.boomYaw) > 0.05;
      this.boomYaw = damp(this.boomYaw, want, up && A.awa > 1.9 && across ? 9 : 3.2, dt);
      this.boomPivot.rotation.y = this.boomYaw;
      const drawing = up ? smoothstep(0.06, 0.2, A.alpha) * smoothstep(0.4, 2.2, A.speed) : 0;
      this.fill = damp(this.fill, drawing, 3, dt);
      this.flutter = damp(this.flutter, up ? (1 - smoothstep(0.04, 0.14, A.alpha)) * smoothstep(0.8, 3, A.speed) : 0, 4, dt);
      if (this.sailUp) this.shapeSails(t);
      this.rudder.rotation.y = damp(this.rudder.rotation.y, -steer * 0.5, 6, dt);
      // The flag: where the apparent wind goes, in her own frame.
      const air = windAt(this.pos.x, this.pos.z);
      const wx = air.x - this.vel.x, wz = air.z - this.vel.z;
      const lx = wx * Math.cos(this.heading) - wz * Math.sin(this.heading), lz = wx * Math.sin(this.heading) + wz * Math.cos(this.heading);
      if (Math.hypot(lx, lz) > 0.3) this.burgee.rotation.y = Math.atan2(lx, lz) + Math.sin(t * 9) * 0.08;
      if (this.sailUp) {
        const end = _b.set(-Math.sin(this.boomYaw) * this.hull.sail.boom, this.hull.sail.gooseneck - 0.02, this.boomPivot.position.z - Math.cos(this.boomYaw) * this.hull.sail.boom);
        const pts = this.sheetLine.geometry.attributes.position;
        pts.setXYZ(0, end.x, end.y, end.z);
        pts.setXYZ(1, this.sheetBlock.x, this.sheetBlock.y, this.sheetBlock.z);
        pts.needsUpdate = true;
      }
    }
    // Upper body sways with the stroke, and turns towards the line while fishing.
    const blendRow = P ? P.blend : this.oars.length ? (this.oars[0].blend + this.oars[1].blend) / 2 : 0;
    this.torso.rotation.x = 0.12 * Math.cos(this.phase) * blendRow + fishing * 0.08;
    this.torso.rotation.z = Math.sin(t * 38) * 0.018 * this.shiver * (1 - blendRow);
    this.torso.rotation.y = damp(this.torso.rotation.y, this.pose.rodYaw * 0.35 * fishing, 4, dt);
    if (this.swing) {
      // The windsurf rig: swung out to leeward as the sheet and the wind let it, leant to windward
      // against the pull (more the harder it pulls), raked forward a touch when she planes; laid
      // flat on the water in a fall. You stand side-on facing it, hanging back off the boom; or
      // you're in the water beside the board.
      const A = this.sailing, s = this.sailSide || 1, down = this.fallen > 0, pull = A && !down ? clamp(A.pull / 7, 0, 1) : 0;
      this.boomYaw = damp(this.boomYaw, A && !down ? -s * A.boom : 0, 5, dt);
      this.swing.rotation.y = this.boomYaw;
      this.flutter = damp(this.flutter, A && !down ? (1 - smoothstep(0.04, 0.14, A.alpha)) * smoothstep(0.8, 3, A.speed) : 0, 4, dt);
      this.rake.rotation.z = damp(this.rake.rotation.z, down ? -s * 1.45 : s * (0.12 + 0.22 * pull), down ? 4 : 3, dt);
      this.rake.rotation.x = damp(this.rake.rotation.x, down ? 0 : 0.12 * this.planing, 3, dt);
      const T = this.torso;
      T.rotation.order = 'YXZ';
      if (down) {
        T.position.set(-s * 0.75, this.hull.floorY - 0.25, this.seatZ + 0.2);
        T.rotation.set(-1.05, s * Math.PI / 2, 0);
      } else {
        T.position.set(-s * (0.26 + 0.14 * pull), this.hull.seatY, this.seatZ);
        T.rotation.set(-(0.22 + 0.4 * pull), s * Math.PI / 2, 0);
      }
    }
    if (this.hull.astride) {
      // Astride the jet ski: leaning into the speed and into the turns; the bars turn with the jet.
      this.torso.rotation.x = 0.22 + 0.14 * clamp(Math.abs(this.forwardSpeed) / 12, 0, 1);
      this.torso.rotation.z = clamp(-this.omega * 0.3, -0.3, 0.3);
      this.wheel.rotation.y = damp(this.wheel.rotation.y, clamp(this.omega * 0.45, -0.5, 0.5), 8, dt);
    }
    if (this.hull.standing) this.standUp(fishing, dt);
    const look = fishing ? (this.standAt ? 0 : this.pose.rodYaw * 0.45) : Math.sin(t * 0.21) * 0.35 * (1 - blendRow);
    this.head.rotation.y = damp(this.head.rotation.y, look, 2, dt);
    this.head.rotation.x = fishing ? 0.15 : 0;

    // Rod
    this.rod.visible = this.occupied && fishing > 0.02;
    this.rodStowed.visible = !this.rod.visible && !this.hull.noFish && !!this.hull.stow;
    // (In the fighting chair the rod's butt sits in the gimbal at the front of the seat.)
    if (this.standAt) this.fromYou(this.rod.position, 0.05 * (1 - this.chairT), lerp(0.33, 0.06, this.chairT), lerp(0.34, 0.3, this.chairT));
    else this.rod.position.copy(this.active.hold);
    this.rod.rotation.y = this.standAt ? this.standAt.yaw : this.pose.rodYaw;
    this.rod.rotation.x = this.pose.rodPitch;
    bendRod(this.active, this.pose.bend, this.pose.bendTo);

    // Hands go to the oar handles, or to the rod grip.
    this.torso.updateMatrix();
    this.rod.updateMatrix();
    for (const a of this.arms) {
      const shoulder = _a.copy(a.shoulder).applyMatrix4(this.torso.matrix);
      let onOar;
      if (P) {
        P.g.updateMatrix();
        onOar = _b.copy(P.grips[a.s > 0 ? 0 : 1]).applyMatrix4(P.g.matrix);
      } else if (this.swing) {
        // Both hands on the windward arm of the wishbone, a shoulder's width apart.
        this.rake.updateMatrix();
        this.swing.updateMatrix();
        const s2 = this.sailSide || 1;
        onOar = _b.set(-s2 * 0.2, this.hull.rig.boomY, a.s > 0 ? -0.42 : -0.92).applyMatrix4(this.swing.matrix).applyMatrix4(this.rake.matrix);
        if (this.fallen > 0) onOar.set(-s2 * (0.75 + 0.1 * a.s), this.hull.floorY + 0.1, this.seatZ + 0.5 + a.s * 0.15);
      } else if (this.sailUp) {
        // One hand on the tiller, the other on the mainsheet.
        this.rudder.updateMatrix();
        onOar = a.s > 0 ? _b.copy(this.tillerGrip).applyMatrix4(this.rudder.matrix) : _b.set(-0.18, this.seatY + 0.42, 0.42 + this.seatZ);
      } else if (this.wheel && this.motor) {
        // Both hands on the wheel.
        this.wheel.updateMatrix();
        const G = this.hull.grip || [0.17, 0.06];
        onOar = _b.set(a.s > 0 ? G[0] : -G[0], G[1], 0).applyMatrix4(this.wheel.matrix);
      } else if (this.motor) {
        // One hand on the tiller, the other resting on a knee.
        this.motorGroup.updateMatrix();
        onOar = a.s > 0 ? _b.copy(this.tillerGrip).applyMatrix4(this.motorGroup.matrix) : _b.set(-0.12, this.seatY + 0.15, 0.3 + this.seatZ);
      } else {
        const oar = a.s > 0 ? this.oars[0] : this.oars[1];
        oar.g.updateMatrix();
        onOar = _b.copy(oar.handle).applyMatrix4(oar.g.matrix);
      }
      const onRod = _d.set(0, a.s > 0 ? 0.08 : 0.3, 0).applyMatrix4(this.rod.matrix);
      a.target.lerpVectors(onOar, onRod, smoothstep(0, 1, fishing));
      setLimb(a.arm, shoulder, a.target, 0.055);
      a.hand.position.copy(a.target);
    }

    // Lantern sways and glows as evening comes.
    if (this.hasLantern) {
      this.lanternHanger.rotation.x = -this.pitch * 0.8 + Math.sin(t * 1.3) * 0.04;
      this.lanternHanger.rotation.z = -this.roll * 0.8;
      this.lanternLevel = damp(this.lanternLevel, lanternLevel, 1.5, dt);
      const flicker = 1 + Math.sin(t * 11) * 0.03 + Math.sin(t * 7.3) * 0.03;
      this.lanternLight.intensity = this.lanternLevel * 9 * flicker;
      this.lanternGlass.emissiveIntensity = 0.2 + this.lanternLevel * 3.2 * flicker;
    }
  }
}
