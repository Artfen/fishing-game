import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, smoothstep, mergeParts, mat } from './util.js';
import { waveHeight } from './world/water.js';
import { windAt, currentAt, currentScale } from './world/conditions.js';
import { solidHeight, PIERS, WORLD } from './world/terrain.js';
import { buildLanternModel, buildRod, bendRod } from './props.js';
import { withSurface } from './world/surface.js';
import { RODS } from './tackle.js';
import { Rope } from './rope.js';
import { reachFor, berthAt } from './mooring.js';

// The five boats. Each has its own hull (metres; the bow points along local +z), its own
// way of moving and its own place to sit:
//  · row: the rowing boat you start with. Steady, roomy, quick enough under oars.
//  · skiff: the same hull with an outboard: the boat for the open coast and the far islands.
//  · kayak: narrow, low and slow, but silent, and it floats in a hand's depth of water: the
//    boat for creeping up on fish in the shallows, the saltings and the reeds.
//  · bass: a broad, flat lake boat with a big outboard for getting about, a quiet electric
//    motor for fishing (the lever's first notches), and a steady casting deck with a locker.
//  · cabin: a little wooden cabin boat, slow and steady, with a cuddy forward holding a bunk and
//    a galley stove: a camp that floats (anchor it, or tie up, and go inside).
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
  cabin: {
    name: 'cabin boat', L: 6.2, B: 1.0, D: 0.9, draft: 0.38, shallow: 0.75, seatZ: -2.3, seatY: 0.55, floorY: 0.12,
    paint: '#f0ece2', stripe: '#1f4e5f', bottom: '#7c3a2e', inside: 'wood',
    motor: { thrust: 3.8, astern: 2.0, tilt: 1.0, scale: 1.25, cowl: '#2b2e33', band: '#1f4e5f' },
    cabin: [0.44, 0.88], lantern: [0.55, -1.7], stow: [-0.7, 0.62, -1.3], noise: 1, steady: 0.55,
    windage: 0.0042, ride: 2.6, // long and heavy: it bridges the chop, and the cabin catches the wind
  },
};
for (const id of ['skiff', 'cabin']) Object.assign(HULLS[id], { hw: HULLS.row.hw, sheer: HULLS.row.sheer, keel: HULLS.row.keel });
export const BOAT_KINDS = Object.keys(HULLS);
const OAR_T = 0.56;

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3();

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

// One of the boats in HULLS: the rowing boat, the motor skiff, the kayak or the bass boat.
export class Boat {
  constructor(scene, { kind = 'row' } = {}) {
    const H = (this.hull = HULLS[kind] || HULLS.row);
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
    this.pose = { fishing: 0, rodYaw: 0, rodPitch: 0.85, bend: 0.05 };
    // In first person (set by the game): where a landed fish is held up in view, and which way
    // you face for it.
    this.viewHold = null;
    this.faceYaw = null;
    this.selfHidden = false;

    this.buildHull();
    this.buildCharacter();
    this.oars = H.oars ? [this.buildOar(1), this.buildOar(-1)] : [];
    if (H.paddle) this.buildPaddle();
    if (H.motor) this.buildMotor();
    if (H.cabin) this.buildCabin();
    if (H.emotor) this.buildEMotor();
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
    if (H.floor) {
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

    const limbGeo = new THREE.CylinderGeometry(1, 1, 1, 7);
    const leg = (s) => {
      const thigh = cast(new THREE.Mesh(limbGeo, pants));
      const shin = cast(new THREE.Mesh(limbGeo, pants));
      const z = this.seatZ, y = this.seatY, H = this.hull;
      // Knees up on a seat; in the kayak, legs stretched out along the hull.
      const hip = new THREE.Vector3(s * 0.09, y + 0.05, 0.06 + z);
      const knee = H.paddle ? new THREE.Vector3(s * 0.13, y + 0.2, 0.48 + z) : new THREE.Vector3(s * 0.11, y + 0.09, 0.42 + z);
      const foot = H.paddle ? new THREE.Vector3(s * 0.11, y + 0.04, 0.88 + z) : new THREE.Vector3(s * 0.11, H.floorY + 0.06, 0.5 + z);
      setLimb(thigh, hip, knee, 0.07);
      setLimb(shin, knee, foot, 0.06);
      const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), boot));
      b.position.set(s * 0.11, foot.y - 0.02, foot.z + 0.05);
      if (H.paddle) b.rotation.x = -0.9;
      this.body.add(thigh, shin, b);
      this.rowerParts.push(thigh, shin, b);
    };
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

  // An outboard on the transom: cowling, leg, propeller and a tiller to steer by.
  buildMotor() {
    const H = this.hull, M = H.motor;
    const g = (this.motorGroup = new THREE.Group());
    g.position.set(0, sheer(H, 0) - 0.02, zAt(H, 0) - 0.04);
    g.scale.setScalar(M.scale);
    const parts = [
      { geo: new THREE.BoxGeometry(0.16, 0.14, 0.12), matrix: mat(0, 0, 0.02), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.3, 0.3, 0.42), matrix: mat(0, 0.24, -0.12), color: M.cowl },
      { geo: new THREE.BoxGeometry(0.31, 0.06, 0.43), matrix: mat(0, 0.11, -0.12), color: M.band },
      { geo: new THREE.BoxGeometry(0.09, 0.95, 0.11), matrix: mat(0, -0.42, -0.14), color: '#3a3d42' },
      { geo: new THREE.CylinderGeometry(0.06, 0.05, 0.3, 8), matrix: mat(0, -0.86, -0.16, Math.PI / 2, 0, 0), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.02, 0.14, 0.12), matrix: mat(0, -0.95, -0.1), color: '#3a3d42' },
      { geo: new THREE.CylinderGeometry(0.018, 0.022, 0.62, 6), matrix: mat(0.04, 0.17, 0.26, Math.PI / 2 - 0.12, 0, 0), color: '#2b2b2b' },
      { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), matrix: mat(0.04, 0.2, 0.55, Math.PI / 2 - 0.12, 0, 0), color: '#c0392b' },
    ];
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 }));
    mesh.castShadow = true;
    g.add(mesh);
    this.prop = new THREE.Group();
    this.prop.position.set(0, -0.86, -0.33);
    const blade = new THREE.BoxGeometry(0.03, 0.17, 0.012);
    for (let i = 0; i < 3; i++) {
      const b = new THREE.Mesh(blade, new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.35 }));
      b.position.y = 0.07;
      const arm = new THREE.Group();
      arm.rotation.z = (i / 3) * Math.PI * 2;
      b.rotation.y = 0.5;
      arm.add(b);
      this.prop.add(arm);
    }
    g.add(this.prop);
    this.tillerGrip = new THREE.Vector3(0.04, 0.2, 0.55); // in the motor's own space
    this.body.add(g);
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

  // The cabin boat's cuddy: a cabin over the forward half that follows the hull in, with windows
  // down each side, a doorway at the back, a roof and a stove pipe; and a bench across the stern
  // to sit and steer from. Inside (you can go in: see the game), a V-berth bunk in the bow with a
  // mattress and a blanket, a little galley by the door with a two-burner stove and a kettle, a
  // shelf, a rug and a lamp under the roof. The walls are a shell open at the doorway, and the
  // roof lifts away on its own, so from inside the camera can look down into it (as at home).
  buildCabin() {
    const H = this.hull, [t0, t1] = H.cabin, N = 10;
    const side = (t) => hw(H, t) * 0.86;
    const base = sheer(H, t0) - 0.12, height = 1.05, wall = 0.05, dt1 = wall / H.L;
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
        glass.push({ geo: new THREE.BoxGeometry(0.03, 0.3, 0.44), matrix: mat(sd * (side(t) + 0.005), base + height * 0.66, zAt(H, t), 0, sd * a, 0), color: '#30434d' });
        glow.push({ geo: new THREE.BoxGeometry(0.008, 0.28, 0.42), matrix: mat(sd * (side(t) - wall - 0.006), base + height * 0.66, zAt(H, t), 0, sd * a, 0), color: '#bcd8e2' });
      }
    }
    glass.push({ geo: new THREE.BoxGeometry(side(t1) * 1.2, 0.3, 0.03), matrix: mat(0, base + height * 0.66, zf + 0.01), color: '#30434d' });
    glow.push({ geo: new THREE.BoxGeometry(side(t1) * 1.1, 0.28, 0.008), matrix: mat(0, base + height * 0.66, zf - wall - 0.008), color: '#bcd8e2' });
    // The bench across the stern, and its back against the motor well.
    walls.push(
      { geo: new THREE.BoxGeometry(hw(H, 0.1) * 1.7, 0.06, 0.42), matrix: mat(0, this.seatY - 0.03, this.seatZ), color: '#a8743f' },
      { geo: new THREE.BoxGeometry(0.06, this.seatY - H.floorY - 0.06, 0.38), matrix: mat(hw(H, 0.1) * 0.8, (this.seatY + H.floorY) / 2 - 0.03, this.seatZ), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.06, this.seatY - H.floorY - 0.06, 0.38), matrix: mat(-hw(H, 0.1) * 0.8, (this.seatY + H.floorY) / 2 - 0.03, this.seatZ), color: '#7b5434' },
    );
    // Inside. The bunk: a platform across the bow (narrowing with the hull), a mattress, a
    // blanket and a pillow at the forward end.
    const tb0 = 0.67, tb1 = t1 - dt1 - 0.01, by = 0.58;
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
      { geo: slab(outline(0.07), 0.07, base + height), color: '#2f5d50', jitter: 0.02 },
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
    // From outside, the lit cabin glows through its windows: a little home on the water.
    this.cabinGlass.material.emissiveIntensity = night * 1.1;
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

    // Stowed rod lying along the starboard side.
    this.rodStowed = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.024, 2.4, 5), new THREE.MeshLambertMaterial({ color: '#8a5a34' }));
    this.rodStowed.rotation.set(Math.PI / 2 - 0.06, 0, 0);
    this.rodStowed.position.set(...this.hull.stow);
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

  // Where a landed fish is held up for a look.
  holdPoint(out) {
    if (this.viewHold) return out.copy(this.viewHold);
    return this.body.localToWorld(out.set(-0.15, this.seatY + 0.98, 1.05 + this.seatZ));
  }

  // Your eyes in first person: where you sit, rising and rolling with the boat (level: only
  // rising and falling with it, for a steady horizon).
  eyePoint(out, level = false) {
    return (level ? this.group : this.body).localToWorld(out.set(0, this.seatY + 0.81, this.seatZ + 0.1));
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

  // Where a released fish goes back in: just off the side.
  releasePoint(out) {
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
    const H = this.hull, M = H.motor;
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
      const turnRate = troll ? 0.9 : E ? 0.5 + 0.6 * clamp(Math.abs(vf) / 1.2, 0, 1) : 0.45 + 0.75 * clamp(Math.abs(vf) / 4, 0, 1) + 0.35 * Math.abs(pw);
      this.omega = damp(this.omega, steer * turnRate * (vf < -0.3 ? -1 : 1), 2.6, dt);
    } else {
      // Rowing (or paddling) rhythm
      this.power = 0;
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
    // (A broad bass boat sits steadier on the swell than the narrow wooden boats.)
    const targetPitch = clamp(-Math.atan2(hb - hs, 2 * L2) - thrust * 0.004, -0.2, 0.2) * (0.5 + 0.5 * H.steady);
    const targetRoll = clamp(Math.atan2(hp - hst, 2 * B2) + this.omega * vf * 0.035, -0.22, 0.22) * H.steady + Math.sin(t * 0.9) * 0.008 * H.steady;
    const ride = H.ride ?? 4;
    this.pitch = damp(this.pitch, targetPitch, ride, dt);
    this.roll = damp(this.roll, targetRoll, ride, dt);
    this.heave = damp(this.heave, hc, ride + 1, dt);

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
      const pr = Math.min(rad, H.B * 0.5 + 0.12);
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
    const W = WORLD, m = 80;
    const ox = p.x < W.x0 + m ? W.x0 + m - p.x : p.x > W.x1 - m ? W.x1 - m - p.x : 0;
    const oz = p.z < W.z0 + m ? W.z0 + m - p.z : p.z > W.z1 - m ? W.z1 - m - p.z : 0;
    v.x += ox * 0.5 * dt;
    v.z += oz * 0.5 * dt;
    this.bumpCooldown -= dt;
    if (impact > 1.2 && this.bumpCooldown <= 0 && this.onBump) {
      this.onBump(impact);
      this.bumpCooldown = 0.6;
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
    // The outboard: propeller spinning, the leg turning with the tiller.
    if (this.motor) {
      this.prop.rotation.z = this.propSpin;
      this.motorGroup.rotation.y = damp(this.motorGroup.rotation.y, -this.omega * 0.35, 6, dt);
      this.motorGroup.rotation.x = damp(this.motorGroup.rotation.x, this.tilted ? -0.5 : 0, 3, dt);
    }
    // Upper body sways with the stroke, and turns towards the line while fishing.
    const blendRow = P ? P.blend : this.oars.length ? (this.oars[0].blend + this.oars[1].blend) / 2 : 0;
    this.torso.rotation.x = 0.12 * Math.cos(this.phase) * blendRow + fishing * 0.08;
    this.torso.rotation.y = damp(this.torso.rotation.y, this.pose.rodYaw * 0.35 * fishing, 4, dt);
    const look = fishing ? this.pose.rodYaw * 0.45 : Math.sin(t * 0.21) * 0.35 * (1 - blendRow);
    this.head.rotation.y = damp(this.head.rotation.y, look, 2, dt);
    this.head.rotation.x = fishing ? 0.15 : 0;

    // Rod
    this.rod.visible = this.occupied && fishing > 0.02;
    this.rodStowed.visible = !this.rod.visible;
    this.rod.position.copy(this.active.hold);
    this.rod.rotation.y = this.pose.rodYaw;
    this.rod.rotation.x = this.pose.rodPitch;
    bendRod(this.active, this.pose.bend);

    // Hands go to the oar handles, or to the rod grip.
    this.torso.updateMatrix();
    this.rod.updateMatrix();
    for (const a of this.arms) {
      const shoulder = _a.copy(a.shoulder).applyMatrix4(this.torso.matrix);
      let onOar;
      if (P) {
        P.g.updateMatrix();
        onOar = _b.copy(P.grips[a.s > 0 ? 0 : 1]).applyMatrix4(P.g.matrix);
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
