import { runShare, trimEffect } from './engine.js';
import { pushAt } from './engines.js';
import { Dashboard, DASHES } from './dashboard.js';
import { canMount, mountFor, rigPose, propAt } from './trollmount.js';
import * as THREE from 'three';
import { clamp, lerp, damp, dampAngle, smoothstep, mergeParts, mat, wrapAngle } from './util.js';
import { waveHeight } from './world/water.js';
import { windAt, currentAt, currentScale, conditions, waveSampler, sampleWaves, shelterAt } from './world/conditions.js';
import { buildHullModel, HydroBody, G, RHO, tubeCentre, section } from './hydro.js';
import { wakes } from './world/wakes.js';
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
// mass: each one as she goes out, kg (the boat, her engine and fuel, you and your gear): she floats
// as deep as that weighs, and it's what the helm, the waves and a knock have to move.
const HULLS = {
  row: {
    name: 'rowing boat', mass: 230, L: 3.8, B: 0.8, D: 0.6, draft: 0.2, shallow: 0.35, seatZ: 0, seatY: 0.47, floorY: 0.08,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.17 + 0.83 * t)), 0.75),
    sheer: (t) => 0.26 * Math.pow(t, 2.4) + 0.05 * Math.pow(1 - t, 3),
    keel: (t) => 0.2 * Math.pow(t, 3),
    paint: '#3f7f86', stripe: '#f1e6cc', bottom: '#a2513d', inside: 'wood',
    oars: true, thwarts: true, lantern: [0.42, -1.58], stow: [-0.42, 0.52, -0.25],
    pull: 6.4, back: 3.2, drag: [0.32, 0.075], side: 2.6, turn: 0.85, rate: 0.8, noise: 1, steady: 1,
    windage: 0.0026, ride: 4,
  },
  skiff: {
    name: 'motor skiff', mass: 290, L: 3.8, B: 0.8, D: 0.6, draft: 0.2, shallow: 0.35, seatZ: -1.25, seatY: 0.47, floorY: 0.08,
    paint: '#ece6d8', stripe: '#2f4f7a', bottom: '#7c3a2e', inside: 'wood',
    motor: { thrust: 5.4, astern: 2.4, tilt: 0.75, scale: 1, cowl: '#e9e5dc', band: '#2f4f7a' },
    surge: 0.5,
    thwarts: true, oarlocks: true, lantern: [0.3, 1.25], stow: [-0.42, 0.52, -0.25], noise: 1, steady: 1, hump: 0.18,
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
  // A modern bass boat (docs/BOAT-ART-DIRECTION.md): drawn as a hard-chined planing V with a pad
  // (form: see buildFormedHull) over her physics envelope (hw, sheer, keel: unchanged); flush
  // casting decks fore and aft with a rod locker, hatches and pedestal seats; a cockpit with a
  // driver's console to starboard (the wheel, a graph, a windscreen), a passenger's to port and
  // two bucket seats; a jack-plated outboard. You sit at the wheel (seatX: to starboard).
  bass: {
    name: 'bass boat', mass: 700, L: 4.7, B: 1.05, D: 0.55, draft: 0.22, shallow: 0.4, seatX: -0.44, seatZ: -0.66, seatY: 0.69, floorY: 0.27,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.32 + 0.68 * t)), 0.42),
    sheer: (t) => 0.14 * Math.pow(t, 2),
    keel: (t) => 0.16 * Math.pow(t, 3),
    paint: '#9b2333', stripe: '#d9d4c7', bottom: '#4a4f56', inside: 'carpet',
    // (Her hull as drawn: chine as a share of her half-beam, the chine's flat, the pad's
    // half-width aft, the bottom's rise (tan of the deadrise) aft and at the bow, the stem's rake,
    // stations; where the decks end (z), the jack plate's setback.)
    form: { kind: 'bass', chine: 0.92, flat: 0.03, pad: 0.1, rise: [0.24, 0.85], rake: 0.38, stations: 30, rear: -1.45, front: 0.33, jack: 0.12, wheel: true },
    // (Her casting decks fore and aft, as t along her and how far below her sheer: where you
    // stand on them; see trollmount.js deckY.)
    decks: [[0.57, 1, 0.045], [0, 0.19, 0.045]], floor: true, pedestals: true, locker: true,
    motor: { thrust: 7.6, astern: 3, tilt: 0.85, scale: 1.3, cowl: '#2b2e33', band: '#b8312f', troll: 0.3 },
    surge: 0.45, carve: 0.3, // (a planing V: she banks into a turn at speed: see carve in update)
    // (Her rods when you're not fishing: two strapped to the casting deck, part of her; see
    // buildFormedHull.)
    lantern: [0.8, -1.95], stow: null, noise: 1, steady: 0.45, hump: 0.22,
    windage: 0.0036, ride: 3, // high-sided: the wind pushes it more; broad and heavy: it rides the swell slowly
  },
  sail: {
    name: 'sailing boat', mass: SAIL.mass, L: 4.9, B: 0.84, D: 0.66, draft: 0.24, shallow: 0.55, seatZ: -1.45, seatY: 0.45, floorY: 0.09,
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
    // (Her hull's resistance, the same curve sailing.js gives her under sail.)
    resist: (v) => hullDrag(v) * v, calV: [1, 3.2],
    // The outboard on its bracket, off to one side of the rudder: a small one (about 3 m/s, six
    // knots, flat out).
    outboard: { thrust: 1.5, astern: 0.9, tilt: 0.5, scale: 0.68, cowl: '#e9e5dc', band: '#2f4d63', side: 0.3 },
    windage: 0.0026, ride: 3.6,
  },
  cabin: {
    name: 'cabin boat', mass: 1500, L: 6.2, B: 1.0, D: 0.9, draft: 0.38, shallow: 0.75, seatZ: -2.3, seatY: 0.55, floorY: 0.12,
    paint: '#f0ece2', stripe: '#1f4e5f', bottom: '#7c3a2e', inside: 'wood',
    motor: { thrust: 3.8, astern: 2.0, tilt: 1.0, scale: 1.25, cowl: '#2b2e33', band: '#1f4e5f' },
    surge: 0.22,
    cabin: [0.44, 0.88], lantern: [0.55, -1.7], stow: [-0.7, 0.62, -1.3], noise: 1, steady: 0.55,
    windage: 0.0042, ride: 2.6, // long and heavy: it bridges the chop, and the cabin catches the wind
    // (Her wheelhouse as drawn, see buildWheelhouse: where it ends and the forepeak's low trunk
    // begins (t), her side decks' width, the trunk's height over the deck, the windscreen's rake
    // (run over rise), how far the walls lean in, the roof's colour. Her short foredeck, flush
    // with her capping: where the trolling motor's plate goes.)
    wheelhouse: { front: 0.73, deck: 0.2, trunk: 0.18, rake: 0.42, lean: 0.07, roof: '#2f5d50' },
    decks: [[0.88, 1, 0.005]],
  },
  cruiser: {
    name: 'sport-fishing yacht', mass: 9000, L: 9.2, B: 1.5, D: 1.6, draft: 0.75, shallow: 1.1, seatZ: -2.28, seatY: 1.73, floorY: 0.85,
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * t)), 0.5),
    sheer: (t) => 0.42 * Math.pow(t, 2.2) + 0.04 * Math.pow(1 - t, 3),
    keel: (t) => 0.3 * Math.pow(t, 3),
    paint: '#f2efe8', stripe: '#1d3b56', bottom: '#2a3442', inside: 'plastic',
    // A teak cockpit sole running forward into the cabin; the foredeck ahead of the wheelhouse.
    floor: [0.02, 0.86], floorColor: '#a8784a', decks: [[0.86, 1, 0]],
    // Twin inboards: two shafts and propellers under her stern (twin: how far out each side),
    // turning together on the one lever. (tilt: the depth where the propellers touch bottom.)
    motor: { thrust: 9.5, astern: 3.2, tilt: 1.3, inboard: true, twin: 0.46 },
    drag: [0.3, 0.06], helm: 0.7, fend: 1.45, passage: true, surge: 0.12,
    cabin: [0.4, 0.86], cabinH: 1.25, cabinRoof: '#e9e5dc', wheel: true, rails: [0.44, 0.57, 0.7, 0.82, 0.92], sportfish: true,
    // You stand: at the wheel (the helm to starboard), or in the cockpit to fish. aft: the middle
    // of where you fish from, how far you go out to the side as you turn, and back to the transom;
    // side: which way round the fighting chair you go between the two.
    standing: { helm: [-0.62, -2.28], aft: [0, -3.6, 0.7, 0.45], side: -1, round: 0.55, chair: [0, -3.0, 0.52] },
    lantern: [1.05, -4.05], stow: null, noise: 1, steady: 0.3,
    windage: 0.005, ride: 1.8, // big and heavy: she shoulders the chop aside, but the wind gets a grip on the hardtop
  },
  console: {
    name: 'centre-console boat', mass: 2400, L: 7.4, B: 1.25, D: 1.15, draft: 0.42, shallow: 0.7, seatZ: -0.62, seatY: 1.38, floorY: 0.5,
    carve: 0.4, // (a deep V: she banks into a hard turn at speed, on the inside of her V: see carve in update)
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.32 + 0.68 * t)), 0.45),
    sheer: (t) => 0.36 * Math.pow(t, 2.2) + 0.02,
    keel: (t) => 0.22 * Math.pow(t, 3),
    paint: '#eef0ee', stripe: '#3a8fc4', bottom: '#d9dedd', inside: 'plastic',
    floor: [0.03, 0.88], floorColor: '#dcd8cc', decks: [[0.88, 1, 0]],
    motor: { thrust: 13, astern: 3.2, tilt: 0.9, scale: 1.35, cowl: '#1d2125', band: '#3a8fc4', twin: 0.4, spool: 0.32 },
    hump: 0.22, drag: [0.22, 0.05], side: 3, helm: 0.95, fend: 1.2, rails: [0.62, 0.72, 0.82, 0.92], surge: 0.3,
    console: true,
    // At the wheel behind the console; fishing, in the cockpit aft or up in the bow (whichever
    // way you face as you cast), round the console or the leaning post on the way.
    standing: { helm: [0, -0.62], aft: [0, -2.5, 0.6, 0.55], bow: [0, 1.9, 0.4, 0.3], round: 0.85 },
    lantern: [0.8, -3.2], stow: null, noise: 1.1, steady: 0.45,
    windage: 0.004, ride: 2.6,
  },
  // A rigid inflatable of about twenty-one feet, built the way the aluminium-hulled fishing RIBs
  // are: a deep-V hull (24° of deadrise to a hard chine) in powder-coated aluminium, and on top of
  // it, sitting right down on its edge, the tubes: half a metre across, grey Hypalon with a black
  // rubbing strake, a few centimetres off the water at the stern, sweeping up to a pointed nose,
  // their ends standing out past the transom as cones. The tubes are her sides: the deck is sunk
  // inside them (you sit on them), with a bow locker seat, a stand-up console with a stainless
  // rail round its screen, a jockey seat behind it, and a stainless roll bar over the stern. One
  // big outboard: quick (about thirty-five knots), dry and steady in a sea; driven standing,
  // fished from anywhere, as the centre console. (Out of the water lying still, the tubes stand
  // her up as she heels, bank her into a turn and soften her landings: see hydro.js.)
  rib: {
    name: 'RIB', mass: 1250, L: 6.5, B: 0.95, D: 0.5, draft: 0.34, shallow: 0.6, seatZ: -0.3, seatY: 1.25, floorY: 0.4,
    carve: 0.45, // (a deep V: she banks into a hard turn at speed, on the inside of her V: see carve in update)
    hw: (t) => Math.pow(Math.sin(Math.PI * (0.3 + 0.7 * t)), 0.5),
    sheer: (t) => 0.5 * Math.pow(t, 2.3),
    keel: (t) => 0.25 * Math.pow(t, 3),
    vee: { chine: 0.6, wc: 0.9, rise: 0.445 },
    paint: '#b7bdc2', stripe: '#b7bdc2', bottom: '#9aa1a7', inside: 'plastic',
    floor: [0.03, 0.87], floorColor: '#4a4f55', decks: [[0.87, 1, 0]],
    tubes: { r: 0.27, out: 0.35, drop: -0.12, t1: 0.94, color: '#5f656b', strake: '#1d2023' },
    motor: { thrust: 22, astern: 3.2, tilt: 0.85, scale: 1.45, cowl: '#1d2125', band: '#9aa1a7', spool: 0.28 },
    drag: [0.21, 0.05], side: 3, helm: 0.8, fend: 1.35, surge: 0.3,
    // (Her weight low in her: the deck sits down inside the tubes, so she banks into a turn.)
    hump: 0.25, cgY: 0.45, console: true, rib: true,
    standing: { helm: [0, -0.35], aft: [0, -2.2, 0.55, 0.5], bow: [0, 1.95, 0.3, 0.25], round: 0.7 },
    lantern: [0.7, -2.75], stow: null, noise: 1.1, steady: 0.5,
    windage: 0.0033, ride: 2.8,
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
    // (A board and you: about a hundred kilos, low down as far as the board feels it, since you
    // stand balancing on it; and the board's resistance, ploughing and then planing.)
    mass: 105, cgY: 0.12, resist: (v) => boardDrag(v) * v, calV: [1.5, 7],
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
    drag: [0.2, 0.05], helm: 1.7, jumps: true, surge: 0.6, carve: 0.6,
    lantern: [0, -1.2], stow: [0, 0.6, -1],
    noise: 1.2, steady: 0.7, windage: 0.002, ride: 6,
  },
};
for (const id of ['skiff', 'cabin']) Object.assign(HULLS[id], { hw: HULLS.row.hw, sheer: HULLS.row.sheer, keel: HULLS.row.keel });
// The fleet's visual rebuild goes a boat at a time (docs/FLEET-AUDIT.md); until a rebuilt boat is
// accepted, ?classic=bass (several: ?classic=bass,cabin) in the address brings her back as she was
// drawn before, for side-by-side judging. (Her physics never changed: only how she's drawn and
// where you sit.)
const CLASSIC = {
  bass: { form: null, seatX: 0, seatZ: -1.55, seatY: 0.78, stow: [-0.72, 0.62, 0.4], paint: '#7a2430', bottom: '#2c2f33', decks: [[0.6, 1, 0.07], [0, 0.17, 0.07]] },
  cabin: { wheelhouse: null, decks: null },
};
for (const k of (globalThis.location?.search?.match(/[?&]classic=([a-z,]+)/)?.[1] || '').split(',')) if (CLASSIC[k]) Object.assign(HULLS[k], CLASSIC[k]);
export const BOAT_KINDS = Object.keys(HULLS);
export { HULLS, formHalf, formRows };
const OAR_T = 0.56;

const UP = new THREE.Vector3(0, 1, 0);
const _a = new THREE.Vector3(), _b = new THREE.Vector3(), _d = new THREE.Vector3(), _e = new THREE.Vector3();

// The hull's shape at t (0 stern … 1 bow): half-beam, height of the gunwale, height of the keel.
const hw = (H, t) => H.B * H.hw(t);
const sheer = (H, t) => H.D + H.sheer(t);
const zAt = (H, t) => -H.L / 2 + H.L * t;

function hullSurface(H, inset, colorFor, split = null) {
  const NZ = 18, NP = 10, rows = [];
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, w = Math.max(hw(H, t) - inset, 0), s = sheer(H, t), k = H.keel(t) + inset;
    const row = [];
    for (let j = 0; j <= NP; j++) {
      const [x, y] = section(H, w, s, k, -Math.PI / 2 + Math.PI * (j / NP));
      row.push([x, y, zAt(H, t)]);
    }
    rows.push(row);
  }
  return { geo: surfaceFromRows(rows, colorFor, split), rows };
}

// A hull surface from its sections (rows from stern to bow, each across her from one gunwale to
// the other): two triangles a quad, coloured by colorFor(c, i, j, NP, y), and (split) every face
// that crosses that height cut along it, so a painted line there runs straight.
function surfaceFromRows(rows, colorFor, split = null) {
  const NZ = rows.length - 1, NP = rows[0].length - 1;
  const pos = [], col = [], c = new THREE.Color();
  const tri = (p, q, r, i, j) => {
    pos.push(...p, ...q, ...r);
    colorFor(c, i, j, NP, (p[1] + q[1] + r[1]) / 3);
    for (let n = 0; n < 3; n++) col.push(c.r, c.g, c.b);
  };
  // (Cut along a level line, if asked, so a painted waterline runs straight: each face that
  // crosses it is split into the part below and the part above. Several lines, for a band: a
  // boot-top's top and bottom.)
  const levels = split == null ? [] : [].concat(split);
  const cut = (a, b, y) => {
    const k = (y - a[1]) / (b[1] - a[1]);
    return [a[0] + (b[0] - a[0]) * k, y, a[2] + (b[2] - a[2]) * k];
  };
  const face = (p, q, r, i, j, l = 0) => {
    if (l >= levels.length) return tri(p, q, r, i, j);
    const y = levels[l], v = [p, q, r], below = v.map((x) => x[1] < y), n = below.filter(Boolean).length;
    if (n === 0 || n === 3) return face(p, q, r, i, j, l + 1);
    // The odd one out (alone on its side of the line), and the other two in winding order.
    const o = below.findIndex((x) => (n === 1 ? x : !x));
    const A = v[o], B = v[(o + 1) % 3], C = v[(o + 2) % 3];
    const ab = cut(A, B, y), ac = cut(A, C, y);
    face(A, ab, ac, i, j, l + 1);
    face(ab, B, C, i, j, l + 1);
    face(ab, C, ac, i, j, l + 1);
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
  return geo;
}

// A built planing hull's sections (H.form; docs/BOAT-ART-DIRECTION.md): at each station from the
// transom to the stem, across her from her port gunwale to her starboard one: the gunwale, a band
// under it, the topside (a little flare), the chine's flat, the chine, a running strake, the pad
// either side of the keel, the keel. Her half-beam, sheer and keel line are her physics hull's
// (hw, sheer, keel), so everything placed by them sits on her as before; only the shape between
// differs: a V bottom rising to a hard chine (deadrise from rise[0] aft to rise[1] at the bow)
// instead of a round bilge, and the forefoot cut back under a raked stem. (FORM_SIDE: the points
// a side, gunwale to pad.)
const FORM_SIDE = 8;
function formRows(H, F) {
  const N = F.stations || 28, rows = [];
  for (let i = 0; i <= N; i++) {
    // (Stations closer together towards the bow, where she curves fastest.)
    const u = i / N, t = 1 - Math.pow(1 - u, 1.3);
    const w = hw(H, t), s = sheer(H, t), k = H.keel(t);
    const small = Math.min(1, w / 0.45);
    const rise = lerp(F.rise[0], F.rise[1], smoothstep(0.45, 1, t));
    const pad = F.pad * (1 - smoothstep(0.45, 0.85, t)) * small;
    const wc = w * F.chine, yc = Math.min(k + rise * Math.max(0, wc - pad), k + 0.82 * (s - k));
    const f = F.flat * small, xs = pad + (wc - pad) * 0.5, ys = k + rise * (xs - pad);
    const band = 0.08 * small, flare = 0.006 * small;
    // (One side, gunwale to keel; the other mirrors it.)
    const side = [
      [w, s],
      [w - 0.004 * small, s - band],
      [lerp(wc + f, w, 0.5) + flare, lerp(yc, s - band, 0.5)],
      [wc + f, yc + 0.008 * small],
      [wc, yc],
      [xs + 0.02 * small, ys + 0.004 * small],
      [xs, ys - 0.006 * small],
      [pad, k],
    ];
    const row = [];
    const rake = F.rake * smoothstep(0.84, 1, t);
    const at = (x, y) => {
      // (The stem raked: low down she ends further aft than at her gunwale.)
      const h = clamp((y - k) / Math.max(0.01, s - k), 0, 1);
      return [x, y, zAt(H, t) - rake * Math.pow(1 - h, 1.4)];
    };
    for (const [x, y] of side) row.push(at(x, y));
    row.push(at(0, k));
    for (let j = side.length - 1; j >= 0; j--) row.push(at(-side[j][0], side[j][1]));
    rows.push(row);
  }
  return rows;
}
// Her half-width at height y at t along her (formRows' section, without its strake): what her
// cockpit, seats and consoles must keep inside, since a V is narrow low down.
function formHalf(H, F, t, y) {
  const w = hw(H, t), s = sheer(H, t), k = H.keel(t), small = Math.min(1, w / 0.45);
  const rise = lerp(F.rise[0], F.rise[1], smoothstep(0.45, 1, t));
  const pad = F.pad * (1 - smoothstep(0.45, 0.85, t)) * small;
  const wc = w * F.chine, yc = Math.min(k + rise * Math.max(0, wc - pad), k + 0.82 * (s - k));
  if (y <= k) return 0;
  if (y < yc) return pad + (wc - pad) * ((y - k) / Math.max(1e-6, yc - k));
  return lerp(wc, w, clamp((y - yc) / Math.max(1e-6, s - yc), 0, 1));
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

// The physics (see hydro.js): one hull model for each kind of boat, shared; every boat afloat, so
// they can bump into each other; and a few small helpers.
const MODELS = new Map();
function hullModel(H) {
  let M = MODELS.get(H);
  if (!M) MODELS.set(H, (M = buildHullModel(H)));
  return M;
}
// How deep she floats, still, with her own weight aboard (a little less than her design draft
// when she's light): where her bottom paint ends, and where a boat moved by hand sits.
export function floatDraft(H) {
  return hullModel(H).restDraft;
}
// What makes her wake (see wakes.js): her weight, length and fineness.
export function wakeOf(H) {
  const M = hullModel(H);
  return { mass: M.mass, L: H.L, fine: H.L / Math.cbrt(M.mass / RHO) };
}
const ALL = [];
const SEQ = { n: 0 }; // every boat's update, counted: which ones are out on the water now
const ORIGIN = [0, 0, 0];
const CREW = 80; // kg, you
// The sailing boat's sail pushes about here: well up the mast, and (her rig balanced over the
// centreboard, as a well-set-up dinghy is) about over the board, so she holds her course with the
// helm amidships and only rounds up a little when she heels.
const SAIL_CE_Y = 2.1, SAIL_CE_AFT = 1.55;
// (What an ordinary anchor holds, steadily, as a share of her weight: see holdAnchor.)
const ANCHOR_HOLD = 0.12;
// (How hard a sailing boat laid over in a gust gripes up into the wind: N·m per kg of her for each
// (m/s)² of her speed. See the sail's overpowered.)
const ROUND_UP = 0.35;
const _w3 = [0, 0, 0], _w4 = [0, 0, 0];
const _qt = new THREE.Quaternion(), _eu = new THREE.Euler(0, 0, 0, 'YXZ'), _v3 = new THREE.Vector3();
const _tx = new THREE.Vector3(), _ty = new THREE.Vector3(), _tz = new THREE.Vector3(), _m4 = new THREE.Matrix4();
const _ta = new THREE.Vector3(), _tb = new THREE.Vector3(), _tc = new THREE.Vector3();
// The bow trolling motors' looks, by kind: the basic one (and the bass boat's own) in black
// composite; the GPS one in saltwater white with its lift-assist strut; the high-thrust one white,
// a size up, with the actuator that stows and deploys it.
const TROLL_LOOKS = {
  troll: { shaft: '#1d2125', pod: '#26292d', head: '#3a3f45', trim: '#b8312f', housing: '#2b2f33', big: 1 },
  trollgps: { shaft: '#d6d9d5', pod: '#e8ebe7', head: '#eef0ec', trim: '#2c6fb0', housing: '#5d646b', big: 1.05, strut: true },
  trollpro: { shaft: '#d6d9d5', pod: '#e8ebe7', head: '#eef0ec', trim: '#1d2125', housing: '#3a3f45', big: 1.18, actuator: true },
};
// One colour all over a geometry, for a mesh on a vertex-coloured material.
function paint(geo, color) {
  const c = new THREE.Color(color), n = geo.attributes.position.count, a = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3);
  geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return geo;
}
// A direction in her own frame, turned by an angle (rad) from straight ahead towards port.
const dirAt = (a) => [Math.sin(a), 0, Math.cos(a)];
// How much of an outboard's depth below her centre of gravity turns her bow up as it pushes (see
// HydroBody.thrusters' lever): the game's push is bigger than a real propeller's (it makes up for
// the hull resistance the game gives her), so its turning arm is scaled to a real one's. At full
// lever a fast boat stood on her tail in a sea; at this she runs as a real one does.
const PROP_LEVER = 0.3;
// The resistance a seaway adds (per kg, per m/s of speed): as the square of the local wave height
// (the waves' energy), over her length (the same sea slows a little boat more than a big one; a
// low swell hardly at all).
const SEAWAY = 8.3;
// (A propeller blade: see setBlades.)
const BLADE = new THREE.BoxGeometry(0.03, 0.17, 0.012);
// How long (s) a boat tied up or at anchor lies still before she can rest out of your way (see
// update: settled at her berth, done swinging to her lines).
const SETTLED = 3;
// A pure turning push (N·m about the vertical, + turns her to port): two equal and opposite
// pushes either side of her middle.
function yawCouple(b, tq) {
  const a = 1, f = tq / (2 * a), x = b.x;
  return [{ f: [0, 0, -f], p: [x[0] + a, x[1], x[2]] }, { f: [0, 0, f], p: [x[0] - a, x[1], x[2]] }];
}
// The open sea goes on forever: near the edge of the map, how far in from the edge she should
// be (Las Brasas, far to the south, has its own edges; and between the two, the open sea of the
// crossing joins them, with edges only to either side).
const _edge = { x: 0, z: 0 };
function edgePush(p) {
  const W = p.z > SOUTH_Z ? SOUTH_RECT : SEA, m = 80;
  const across = p.x > CROSSING.x0 && p.x < CROSSING.x1 && p.z > SEA.z1 - m - 20 && p.z < SOUTH_RECT.z0 + m + 20;
  const X0 = across ? CROSSING.x0 : W.x0, X1 = across ? CROSSING.x1 : W.x1;
  _edge.x = p.x < X0 + m ? X0 + m - p.x : p.x > X1 - m ? X1 - m - p.x : 0;
  _edge.z = across ? 0 : p.z < W.z0 + m ? W.z0 + m - p.z : p.z > W.z1 - m ? W.z1 - m - p.z : 0;
  return _edge;
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
    // (A boat painted her own way is still her kind of boat underneath: the same physics hull.)
    this.base = HULLS[kind] || HULLS.row;
    const H = (this.hull = look ? { ...this.base, ...look } : this.base);
    this.kind = HULLS[kind] ? kind : 'row';
    this.motor = !!H.motor;
    this.name = H.name;
    this.seatZ = H.seatZ; // where you sit: amidships to row, at the stern to steer
    this.seatX = H.seatX ?? 0; // (and across her: the bass boat's helm is to starboard)
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
    // (sheetHelp: a hand on the sheet besides yours, easing it in the gusts and when she won't
    // answer her helm, as on the Helped sail trim; without it, the sheet is all yours, and held in
    // too hard in a blow she's overpowered and rounds up into the wind. overpowered: how badly,
    // 0 … 1, just now.)
    this.sheetHelp = true;
    this.overpowered = 0;
    this.payload = 0;       // kg carried beyond her own weight (fittings, extra fuel: see the game)
    // The engine on her transom and its propeller, where she has a choice of them (see
    // engines.js and setMotor): null, her motor as the hull has it.
    this.motorSpec = null;
    this.anchorHold = 1;    // how hard her anchor holds (a heavier one: more; see holdAnchor)
    // Out on the crossing (see crossing.js): the sail shortened in a blow (1 full … less, reefed),
    // and the fastest a motor boat can be driven in the ocean's long swell (m/s).
    this.reef = 1;
    this.vmax = Infinity;
    this.sailing = null;
    this.heel = 0;
    this.boomYaw = 0;
    this.sailSide = 1;
    this.helm = 0;          // where the tiller, wheel or bars actually are (-1 … 1; see helmTo)
    this.slam = 0;          // how hard her bow's meeting the water (m/s down into it)
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
    if (H.tubes) this.buildTubes();
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
    ALL.push(this);
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
    this.heave = Math.max(waveHeight(x, z), this.restHeight(x, z, heading));
    if (this._phys) {
      this._phys.place(x, z, heading, this.heave);
      this.syncFromPhys();
    }
  }

  // A new coat of paint (a colour from the Marine Works' chart: see shipyard.js), or back to how
  // she came (null). Every face of her topsides in her paint takes the new colour with its own
  // shading kept; the stripe, the bottom paint and the fittings stay as they are.
  repaint(hex) {
    const to = new THREE.Color(hex || this.hull.paint);
    const from = this.paintNow || new THREE.Color(this.hull.paint);
    if (to.equals(from)) return;
    const f2 = from.r * from.r + from.g * from.g + from.b * from.b || 1e-6;
    this.group.traverse((o) => {
      const c = o.userData?.hull && o.geometry?.attributes?.color;
      if (!c) return;
      const a = c.array;
      for (let i = 0; i < a.length; i += 3) {
        // (Her paint, a little lighter or darker: the same colour scaled.)
        const k = (a[i] * from.r + a[i + 1] * from.g + a[i + 2] * from.b) / f2;
        if (k < 0.88 || k > 1.1) continue;
        const dr = a[i] - k * from.r, dg = a[i + 1] - k * from.g, db = a[i + 2] - k * from.b;
        if (dr * dr + dg * dg + db * db > 0.0009 * f2) continue;
        a[i] = to.r * k;
        a[i + 1] = to.g * k;
        a[i + 2] = to.b * k;
      }
      c.needsUpdate = true;
    });
    this.paintNow = to;
    if (this.boatName) this.setName(this.boatName);
  }

  // Recolour what's this colour on her meshes tagged tag (userData), its shading kept: her stripe
  // on her hull, a RIB's tubes. Returns the colour now.
  recolor(tag, fromHex, toHex) {
    const to = new THREE.Color(toHex), from = new THREE.Color(fromHex);
    if (to.equals(from)) return to;
    const f2 = from.r * from.r + from.g * from.g + from.b * from.b || 1e-6;
    this.group.traverse((o) => {
      const c = o.userData?.[tag] && o.geometry?.attributes?.color;
      if (!c) return;
      const a = c.array;
      for (let i = 0; i < a.length; i += 3) {
        const k = (a[i] * from.r + a[i + 1] * from.g + a[i + 2] * from.b) / f2;
        if (k < 0.88 || k > 1.1) continue;
        const dr = a[i] - k * from.r, dg = a[i + 1] - k * from.g, db = a[i + 2] - k * from.b;
        if (dr * dr + dg * dg + db * db > 0.0009 * f2) continue;
        a[i] = to.r * k;
        a[i + 1] = to.g * k;
        a[i + 2] = to.b * k;
      }
      c.needsUpdate = true;
    });
    return to;
  }

  // Her stripe in a colour of your own (hex, or null: as she came). Not on a hull whose stripe is
  // her paint (the RIB's: her tubes are her second colour, see retube).
  restripe(hex) {
    const H = this.hull;
    if (new THREE.Color(H.stripe).equals(new THREE.Color(H.paint))) return;
    const to = hex || H.stripe;
    this.stripeNow = '#' + this.recolor('hull', this.stripeNow || H.stripe, to).getHexString();
  }
  // A RIB's tubes in a colour of your own (hex, or null: as she came).
  retube(hex) {
    const T = this.hull.tubes;
    if (!T) return;
    this.tubesNow = '#' + this.recolor('tubes', this.tubesNow || T.color, hex || T.color).getHexString();
  }

  // A flag at her stern (see papers.js FLAGS; null: none): on a short staff off to one side of
  // the transom, clear of the outboard, stirring in the breeze.
  setFlag(flag, own = null) {
    if (this.flag) {
      this.flag.parent?.remove(this.flag);
      this.flag.traverse((o) => {
        o.geometry?.dispose();
        o.material?.map?.dispose();
        o.material?.dispose();
      });
      this.flag = null;
    }
    this.flagId = flag?.id || null;
    if (!flag || !document?.createElement) return;
    const H = this.hull, g = new THREE.Group();
    const side = (H.tubes ? H.B * 0.7 : H.B * 0.55) * (H.motor?.twin || H.motor?.side ? 0 : 1);
    const zs = zAt(H, 0.03), y0 = sheer(H, 0.03) + (H.tubes ? H.tubes.r * 0.8 : 0.02);
    g.position.set(H.motor?.twin ? 0 : -side, y0, zs);
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.01, 0.9, 6), new THREE.MeshStandardMaterial({ color: '#c9cdd0', metalness: 0.6, roughness: 0.35 }));
    staff.position.y = 0.45;
    g.add(staff);
    const cv = document.createElement('canvas');
    cv.width = 64;
    cv.height = 40;
    const ctx = cv.getContext('2d');
    const [a, b] = flag.colors || [own?.paint || H.paint, own?.stripe || H.stripe];
    if (ctx && ctx.fillRect) {
      ctx.clearRect(0, 0, 64, 40);
      ctx.fillStyle = a;
      ctx.beginPath();
      if (flag.shape === 'pennant') {
        ctx.moveTo(0, 0); ctx.lineTo(64, 20); ctx.lineTo(0, 40);
      } else {
        ctx.moveTo(0, 0); ctx.lineTo(64, 0); ctx.lineTo(44, 20); ctx.lineTo(64, 40); ctx.lineTo(0, 40);
      }
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = b;
      if (flag.id === 'alpha') ctx.fillRect(32, 0, 32, 40);
      else if (flag.shape === 'pennant') ctx.fillRect(4, 14, 22, 12);
      else ctx.fillRect(0, 14, 50, 12);
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.26), new THREE.MeshStandardMaterial({ map: tex, transparent: true, side: THREE.DoubleSide, roughness: 0.9 }));
    cloth.position.set(0, 0.76, -0.21);
    cloth.rotation.y = Math.PI / 2;
    g.add(cloth);
    this.flag = g;
    this.flagCloth = cloth;
    this.body.add(g);
  }

  // Her name, sign-written on both sides of the bow (or none).
  setName(name) {
    for (const m of this.nameBoards || []) {
      m.parent?.remove(m);
      m.material.map?.dispose();
      m.material.dispose();
      m.geometry.dispose();
    }
    this.nameBoards = [];
    this.boatName = name || '';
    if (!name || typeof document === 'undefined' || !document.createElement) return;
    const H = this.hull, c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const ctx = c.getContext('2d');
    if (!ctx?.fillText) return;
    const paint = this.paintNow || new THREE.Color(H.paint);
    const light = paint.r * 0.3 + paint.g * 0.59 + paint.b * 0.11 > 0.5;
    ctx.clearRect(0, 0, 512, 96);
    ctx.font = 'italic 700 64px Georgia, "Times New Roman", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineWidth = 6;
    ctx.strokeStyle = light ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
    ctx.fillStyle = light ? '#1d2a3a' : '#f6efdf';
    ctx.strokeText(name, 256, 50);
    ctx.fillText(name, 256, 50);
    const w = Math.min(1.6, H.L * 0.26), h = w * (96 / 512);
    const t = 0.76, z = zAt(H, t);
    const T = H.tubes;
    const y = T ? tubeCentre(H, t, 1)[1] : sheer(H, t) - h * 0.75 - 0.04;
    const x = T ? tubeCentre(H, t, 1)[0] + T.r + 0.012 : hw(H, t) + 0.012;
    // (Following her bow round as it narrows.)
    const slope = Math.atan2(hw(H, t + 0.04) - hw(H, t - 0.04), H.L * 0.08);
    for (const sd of [1, -1]) {
      const tex = new THREE.CanvasTexture(c);
      tex.colorSpace = THREE.SRGBColorSpace;
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.position.set(sd * x, y, z);
      m.rotation.y = sd * (Math.PI / 2 + slope);
      (this.body || this.group).add(m);
      this.nameBoards.push(m);
    }
  }

  // Put down in shallow water or on the sand, she sits on the bottom rather than in it: the
  // water level she'd need to float clear here (the highest the ground comes under her keel, plus
  // her draft).
  restHeight(x, z, heading) {
    const H = this.hull, fx = Math.sin(heading), fz = Math.cos(heading);
    let need = -Infinity;
    for (const t of [0.05, 0.3, 0.5, 0.7, 0.95]) {
      const u = zAt(H, t);
      need = Math.max(need, solidHeight(x + fx * u, z + fz * u) - H.keel(t) + H.draft + 0.01);
    }
    return need;
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
    // (A big outboard on a light planing hull builds its push over a few seconds, as the hull
    // climbs over its own bow wave and onto the plane: motor.spool, the rate it opens up at.)
    const up = electric ? 0.6 : this.hull.motor?.spool ?? 0.6;
    const rate = (electric ? 2.5 : 1) * (Math.abs(want) > Math.abs(this.power) ? up : 1);
    this.power += clamp(want - this.power, -rate * dt, rate * dt);
    if (Math.abs(this.power) < 1e-5) this.power = 0;
    if (this.power) this.lastGear = Math.sign(this.power);
  }

  /* ---------- construction ---------- */

  buildHull() {
    const H = this.hull;
    if (H.form) return this.buildFormedHull();
    const PAINT = new THREE.Color(H.paint);
    const STRIPE = new THREE.Color(H.stripe);
    const BOTTOM = new THREE.Color(H.bottom);
    // (Her bottom paint comes up to just above where she floats, in a clean straight line.)
    const boot = floatDraft(this.base) + 0.06;
    // (The cabin boat's livery, drawn as a classic launch's: her topsides all her paint, a stripe
    // along her sheer and a boot-top in her stripe's colour over her bottom paint; see the trim
    // below. Every other boat: her stripe on the upper strake.)
    const WH = !!H.wheelhouse, top = WH ? boot + 0.045 : null;
    const outer = hullSurface(H, 0, (c, i, j, NP, y) => {
      if (WH) c.copy(y < boot ? BOTTOM : y < top ? STRIPE : PAINT);
      else if (j === 0 || j === NP - 1) c.copy(STRIPE);
      else if (y < boot) c.copy(BOTTOM);
      else c.copy(PAINT);
      c.multiplyScalar(0.94 + ((i * 7 + j * 3) % 5) * 0.025);
    }, WH ? [boot, top] : boot);
    this.hullRows = outer.rows;
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
    this.innerRows = inner.rows;

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
    for (const [t0, t1, drop] of H.decks || []) parts.push({ geo: deckSurface(H, t0, t1, drop), color: WH ? '#c9b58f' : drop ? '#5d6066' : H.paint, jitter: WH ? 0.03 : 0 });
    if (WH) parts.push(...this.launchTrim(outer.rows));
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
    mesh.userData.hull = true; // (her topsides: what a repaint repaints; see repaint)
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    this.body.add(waterLid(inner.rows, H.draft));
  }

  // A built hull (H.form, see formRows) and her fit-out, in three meshes: her shell (paint, a
  // band under the gunwale and an accent along the chine in her stripe, bottom paint up to just
  // above where she floats), the carpet (decks, cockpit sole and sides), and everything else
  // merged (gunwale cap, consoles, seats, hatches, fittings). The rubbing strake round her sheer is
  // in the fit-out. Her paint and stripe stay the Marine Works' to change: both meshes it touches
  // are tagged hull.
  buildFormedHull() {
    const H = this.hull, F = H.form, L = H.L;
    const PAINT = new THREE.Color(H.paint), STRIPE = new THREE.Color(H.stripe), BOTTOM = new THREE.Color(H.bottom);
    const boot = floatDraft(this.base) + 0.035;
    const rows = formRows(H, F), NP = rows[0].length - 1;
    // (Each face by which part of her section it's in, gunwale down: 0 the band, 1 and 2 the
    // topside, 3 the chine's flat, then the bottom.)
    const shell = surfaceFromRows(rows, (c, i, j, n, y) => {
      const seg = j < FORM_SIDE ? j : n - 1 - j;
      if (y < boot) c.copy(BOTTOM);
      else if (seg === 0 || seg === 3) c.copy(STRIPE);
      else c.copy(PAINT);
      c.multiplyScalar(0.95 + ((i * 7 + j * 3) % 5) * 0.022);
    }, boot);
    // The transom: a fan across her stern section, in her paint.
    const stern = rows[0], mid = (NP / 2) | 0, cy = (stern[0][1] + stern[mid][1]) / 2, tPos = [];
    for (let j = 0; j < NP; j++) tPos.push(0, cy, stern[0][2], ...stern[j + 1], ...stern[j]);
    const transom = new THREE.BufferGeometry();
    transom.setAttribute('position', new THREE.Float32BufferAttribute(tPos, 3));
    const shellGeo = mergeParts([{ geo: shell, color: '#ffffff', jitter: 0 }, { geo: transom, color: H.paint, jitter: 0.02 }]);
    shellGeo.attributes.color.array.set(shell.attributes.color.array, 0);
    // (A bass boat's gelcoat has a metal flake in it: a little sheen.)
    const hullMesh = new THREE.Mesh(shellGeo, new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.32, metalness: 0.1 }));
    hullMesh.userData.hull = true;
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    this.body.add(hullMesh);
    this.body.add(waterLid(rows, H.draft));

    const carpet = [], fit = [], glow = [];
    if (F.kind === 'bass') this.fitBass(carpet, fit, glow);
    const carpetMesh = new THREE.Mesh(mergeParts(carpet), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 }));
    carpetMesh.receiveShadow = true;
    carpetMesh.castShadow = true;
    const fitMesh = new THREE.Mesh(mergeParts(fit), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.12 }));
    fitMesh.userData.hull = true; // (her consoles are her paint, her piping her stripe: see repaint)
    fitMesh.castShadow = true;
    fitMesh.receiveShadow = true;
    this.body.add(carpetMesh, fitMesh);
    // (Her graphs' displays, lit from within: they read by day and glow after dark.)
    if (glow.length) this.body.add((this.screens = new THREE.Mesh(mergeParts(glow), new THREE.MeshBasicMaterial({ vertexColors: true }))));
    if (F.wheel && this.wheelAt) this.buildWheel(this.seatX, ...this.wheelAt);
  }

  // The bass boat's fit-out (H.form.kind 'bass'), into the carpet and the fit-out parts: flush
  // casting decks aft and forward of a carpeted cockpit; in the cockpit a seat box with two bucket
  // seats, the driver's console to starboard (dash, gauges, graph, windscreen, throttle; the wheel
  // is its own, see buildWheel) and a passenger's console to port with a grab rail; on the front
  // deck the rod locker, two storage hatches, the pedestal seat, the trolling motor's foot pedal,
  // a second graph and two rods strapped down; on the rear deck the livewell and battery hatches,
  // a pedestal seat and the stern light; round her the gunwale cap and a black rubbing strake,
  // pop-up cleats, the bow light and bow eye; on the transom a jack plate for the outboard.
  // (Starboard is -x.)
  fitBass(carpet, fit, glow) {
    const H = this.hull, F = H.form, L = H.L, V = (x, y, z) => new THREE.Vector3(x, y, z);
    const T = (z) => clamp((z + L / 2) / L, 0, 1), W = (z) => hw(H, T(z)), S = (z) => sheer(H, T(z));
    const y0 = H.floorY, zR = F.rear, zF = F.front, zStern = -L / 2, zBow = L / 2;
    const CARPET = '#575c64', LID = '#464b53', CAP = '#dcd7cc', STEEL = '#c9cdd0', BLACK = '#1d2125', DARK = '#383d44', GLASS = '#5d7381', VINYL = '#33393f';
    const box = (to, sx, sy, sz, x, y, z, color, rx = 0, ry = 0, rz = 0, jitter = 0.03) => to.push({ geo: new THREE.BoxGeometry(sx, sy, sz), matrix: mat(x, y, z, rx, ry, rz), color, jitter });
    const cyl = (to, r0, r1, h, x, y, z, color, rx = 0, ry = 0, rz = 0, n = 8) => to.push({ geo: new THREE.CylinderGeometry(r0, r1, h, n), matrix: mat(x, y, z, rx, ry, rz), color, jitter: 0.02 });
    // A graph (a fish finder with a chart): a black case w by h, its face aft towards whoever
    // uses it, leaning back by lean; on the face a split screen, the chart to port (sea, a shore,
    // your track) and the sonar to starboard (the water column, a school, the bottom's bright
    // return over the seabed), into glow (lit: see buildFormedHull).
    const graph = (w, h, x, y, z, lean) => {
      box(fit, w, h, 0.05, x, y, z, BLACK, lean, 0, 0);
      const m = mat(x, y, z, lean, 0, 0), fz = -0.027, iw = w - 0.035, ih = h - 0.035, half = iw / 2;
      const px = (u, v, sw, sh, color, dz = 0) => glow.push({ geo: new THREE.BoxGeometry(sw, sh, 0.002).translate(u, v, fz - dz), matrix: m, color, jitter: 0 });
      // (Starboard is -x, and the face looks aft: the chart, to port, is at +x.)
      px(half / 2, 0, half - 0.004, ih, '#2b6d9e');
      px(half * 0.8, ih * 0.22, half * 0.4, ih * 0.5, '#c9b373', 0.001);
      px(half * 0.35, -ih * 0.05, half * 0.5, 0.006, '#f2f0ea', 0.001);
      px(-half / 2, 0, half - 0.004, ih, '#0f2c4c');
      px(-half / 2, -ih * 0.36, half - 0.004, ih * 0.28, '#7a3f22', 0.001);
      px(-half / 2, -ih * 0.22, half - 0.004, 0.008, '#f0b030', 0.002);
      px(-half * 0.62, ih * 0.08, 0.03, 0.012, '#f2d24b', 0.001);
      px(-half * 0.36, ih * 0.16, 0.025, 0.01, '#f2d24b', 0.001);
      px(0, ih / 2 - 0.006, iw, 0.012, '#24415e', 0.002);
    };
    // Her half-width inside her skin at z and height y (a V is narrow low down: see formHalf).
    const HF = (z, y) => Math.max(0, formHalf(H, F, T(z), y) - 0.035);
    // A surface across her between z0 and z1, inset from her sides, at height y(z): a deck or a sole.
    const plate = (to, z0, z1, inset, y, color, step = 0.12) => {
      const pos = [];
      const n = Math.max(2, Math.ceil((z1 - z0) / step));
      let prev = null;
      for (let i = 0; i <= n; i++) {
        const z = lerp(z0, z1, i / n), yy = y(z), w = Math.max(0, Math.min(W(z) - inset, HF(z, yy)));
        const cur = [[-w, yy, z], [w, yy, z]];
        if (prev) pos.push(...prev[0], ...cur[0], ...cur[1], ...prev[0], ...cur[1], ...prev[1]);
        prev = cur;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      to.push({ geo: g, color, jitter: 0.025 });
    };
    // Her sides inside (the cockpit's liner), from ya(z) up to yb(z), between z0 and z1, following
    // her skin up the V and the topside to under the gunwale cap.
    const sides = (to, z0, z1, inset, ya, yb, color, step = 0.15) => {
      const pos = [];
      const n = Math.max(2, Math.ceil((z1 - z0) / step)), K = 4;
      for (const sd of [1, -1]) {
        let prev = null;
        for (let i = 0; i <= n; i++) {
          const z = lerp(z0, z1, i / n), cur = [];
          for (let k = 0; k <= K; k++) {
            const y = lerp(ya(z), yb(z), k / K);
            cur.push([sd * Math.min(W(z) - inset, HF(z, y)), y, z]);
          }
          if (prev) for (let k = 0; k < K; k++) pos.push(...prev[k], ...cur[k], ...cur[k + 1], ...prev[k], ...cur[k + 1], ...prev[k + 1]);
          prev = cur;
        }
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      to.push({ geo: g, color, jitter: 0.025 });
    };
    // A block across her from x0 to x1 (null: out to her side) between z0 and z1, ya to yb, its
    // outboard faces following her skin: a bulkhead, a seat box, a console. (Six faces.)
    const block = (to, x0, x1, z0, z1, ya, yb, color, jitter = 0.03) => {
      // (Each corner out to her skin where it is: she narrows towards her ends.)
      const out = (y, z, sd) => sd * Math.min(W(z) - 0.07, HF(z, y));
      const xa = (y, z) => (x0 == null ? out(y, z, -1) : x0), xb = (y, z) => (x1 == null ? out(y, z, 1) : x1);
      const v = [];
      for (const y of [ya, yb]) for (const z of [z0, z1]) v.push([xa(y, z), y, z], [xb(y, z), y, z]);
      // (v: [y][z][a|b]: 0 ya z0 a, 1 ya z0 b, 2 ya z1 a, 3 ya z1 b, 4 yb z0 a, 5 yb z0 b, 6 yb z1 a, 7 yb z1 b.)
      const quads = [[4, 5, 7, 6], [0, 2, 3, 1], [0, 1, 5, 4], [2, 6, 7, 3], [0, 4, 6, 2], [1, 3, 7, 5]];
      const pos = [];
      for (const [a, b2, c, d] of quads) pos.push(...v[a], ...v[b2], ...v[c], ...v[a], ...v[c], ...v[d]);
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      to.push({ geo: g, color, jitter });
    };
    // Across her at z, from ya to yb, out to her sides: a bulkhead's face.
    const across = (to, z, ya, yb, inset, color) => block(to, null, null, z - 0.015, z + 0.015, ya, yb, color);
    const yDeck = (z) => S(z) - 0.045, inset = 0.085;

    // The decks and the cockpit, carpeted; the cockpit's sides; the decks' faces where you step
    // up onto them.
    plate(carpet, zStern + 0.03, zR, 0.03, yDeck, CARPET);
    plate(carpet, zF, zBow - 0.04, 0.03, yDeck, CARPET, 0.1);
    plate(carpet, zR, zF, inset, () => y0, CARPET);
    sides(carpet, zR, zF, inset, () => y0, (z) => S(z) - 0.03, CARPET);
    across(carpet, zR, y0, yDeck(zR), inset, CARPET);
    across(carpet, zF, y0, yDeck(zF), inset, CARPET);
    // A step up onto the casting deck, in the walk-through between the consoles.
    box(carpet, 0.42, 0.17, 0.12, 0, y0 + 0.085, zF - 0.06, CARPET);

    // The gunwale cap all round, a strip on her sheer stepping down to the decks inside it; the
    // rubbing strake outside it, black, from her transom round to her stem.
    const capPts = [], strake = [[], []];
    for (let i = 0; i <= 40; i++) {
      const z = lerp(zStern, zBow - 0.02, i / 40), w = W(z), s = S(z);
      capPts.push([z, w, s]);
      strake[0].push(V(w + 0.014, s - 0.03, z));
      strake[1].push(V(-(w + 0.014), s - 0.03, z));
    }
    const capPos = [];
    for (let i = 0; i < capPts.length - 1; i++) {
      const [za, wa, sa] = capPts[i], [zb, wb, sb] = capPts[i + 1];
      for (const sd of [1, -1]) {
        const ow = 0.06, A = [sd * wa, sa + 0.012, za], B2 = [sd * wb, sb + 0.012, zb], C = [sd * Math.max(0, wb - ow), sb + 0.012, zb], D = [sd * Math.max(0, wa - ow), sa + 0.012, za];
        capPos.push(...A, ...B2, ...C, ...A, ...C, ...D);
        // (Its inner edge, down to the deck.)
        const Cl = [C[0], sb - 0.05, zb], Dl = [D[0], sa - 0.05, za];
        capPos.push(...D, ...C, ...Cl, ...D, ...Cl, ...Dl);
      }
    }
    const capGeo = new THREE.BufferGeometry();
    capGeo.setAttribute('position', new THREE.Float32BufferAttribute(capPos, 3));
    fit.push({ geo: capGeo, color: CAP, jitter: 0.02 });
    for (const pts of strake) {
      pts.push(V(0, S(zBow) - 0.03, zBow + 0.012));
      fit.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 48, 0.022, 5), color: BLACK, jitter: 0.02 });
    }
    // The transom's cap, and a jack plate carrying the outboard aft of it.
    box(fit, W(zStern) * 2 - 0.06, 0.035, 0.07, 0, S(zStern) + 0.012, zStern + 0.02, CAP);
    const jy = S(zStern) - 0.15;
    box(fit, 0.24, 0.32, F.jack, 0, jy, zStern - F.jack / 2 - 0.01, '#a9aeb2');
    for (const sd of [1, -1]) box(fit, 0.02, 0.32, F.jack + 0.04, sd * 0.13, jy, zStern - F.jack / 2 - 0.01, '#8f9499');
    // The livewell's outlets in her transom.
    for (const sd of [1, -1]) cyl(fit, 0.03, 0.03, 0.02, sd * 0.42, 0.42, zStern - 0.008, BLACK, Math.PI / 2, 0, 0, 10);

    // The rear deck: the livewell and battery hatches, a pedestal seat, the stern light.
    const hatch = (x, z, sx, sz, y) => {
      box(fit, sx + 0.03, 0.012, sz + 0.03, x, y + 0.004, z, '#5a5f66');
      box(fit, sx, 0.018, sz, x, y + 0.012, z, LID);
      box(fit, 0.08, 0.01, 0.025, x, y + 0.024, z + sz / 2 - 0.04, STEEL);
    };
    for (const sd of [1, -1]) hatch(sd * 0.45, -1.88, 0.42, 0.42, yDeck(-1.88));
    const pedestal = (z, y, back = true) => {
      cyl(fit, 0.09, 0.09, 0.015, 0, y + 0.008, z, STEEL, 0, 0, 0, 12);
      cyl(fit, 0.032, 0.032, 0.3, 0, y + 0.16, z, STEEL);
      box(fit, 0.36, 0.075, 0.3, 0, y + 0.345, z, VINYL);
      box(fit, 0.37, 0.02, 0.31, 0, y + 0.31, z, H.stripe);
      if (back) box(fit, 0.34, 0.16, 0.05, 0, y + 0.44, z - 0.15, VINYL, -0.15, 0, 0);
    };
    pedestal(-1.62, yDeck(-1.62));
    {
      const z = -2.18, x = W(z) - 0.05, s = S(z);
      cyl(fit, 0.012, 0.012, 0.75, x, s + 0.375, z, STEEL, 0, 0, 0, 6);
      cyl(fit, 0.03, 0.03, 0.06, x, s + 0.78, z, '#f1efe8', 0, 0, 0, 10);
    }

    // The seat box across the cockpit, and the two bucket seats on it (the driver's at the
    // wheel, where you sit: seatX, seatZ).
    const zs = H.seatZ, boxTop = H.seatY - 0.09;
    block(carpet, null, null, zs - 0.31, zs + 0.25, y0, boxTop, CARPET);
    for (const x of [H.seatX, -H.seatX]) {
      const yc = H.seatY - 0.02;
      cyl(fit, 0.13, 0.13, 0.03, x, boxTop + 0.015, zs, '#5a5f66', 0, 0, 0, 12);
      box(fit, 0.46, 0.08, 0.44, x, yc, zs, VINYL);
      box(fit, 0.47, 0.02, 0.45, x, yc - 0.035, zs, H.stripe);
      box(fit, 0.44, 0.42, 0.07, x, yc + 0.22, zs - 0.22, VINYL, -0.16, 0, 0);
      box(fit, 0.45, 0.025, 0.08, x, yc + 0.43, zs - 0.25, H.stripe, -0.16, 0, 0);
      for (const sd of [1, -1]) box(fit, 0.06, 0.3, 0.2, x + sd * 0.235, yc + 0.17, zs - 0.15, VINYL, -0.1, sd * 0.35, 0);
    }

    // The consoles: the driver's to starboard (body in her paint, dash, gauges, graph, windscreen,
    // throttle), the passenger's to port (glovebox, grab rail); the walk-through between.
    const zc0 = zF - 0.4, zc1 = zF - 0.02, cz = (zc0 + zc1) / 2, cd = zc1 - zc0;
    const consoleBody = (x0, x1, top) => {
      // (Her side of it follows her skin down to the sole; its top and dash run out to the liner.)
      const sd = Math.sign(x0 + x1), xo = sd * Math.min(W(zc1) - 0.07, HF(zc1, top)), xi = sd > 0 ? x0 : x1;
      block(fit, sd > 0 ? xi : null, sd > 0 ? null : xi, zc0, zc1, y0, top, H.paint, 0.02);
      x0 = Math.min(xi, xo);
      x1 = Math.max(xi, xo);
      const cx = (x0 + x1) / 2, cw = Math.abs(x1 - x0);
      box(fit, cw + 0.01, 0.025, cd + 0.01, cx, top - 0.06, cz, H.stripe);
      // (The dash: a face sloping up and away from you, then a flat top to the windscreen.)
      const rise = 0.17, run = 0.2, len = Math.hypot(rise, run), a = Math.atan2(rise, run);
      box(fit, cw, 0.035, len, cx, top + rise / 2, zc0 + run / 2, DARK, -a, 0, 0);
      box(fit, cw, 0.04, cd - run, cx, top + rise, zc0 + run + (cd - run) / 2, H.paint);
      // The windscreen, smoked, raked back, a bright trim along its top.
      const ws = 0.17, wa = 0.55;
      box(fit, cw - 0.04, ws, 0.012, cx, top + rise + Math.cos(wa) * ws / 2, zc1 - 0.04 - Math.sin(wa) * ws / 2, GLASS, -wa, 0, 0, 0.01);
      box(fit, cw - 0.02, 0.014, 0.018, cx, top + rise + Math.cos(wa) * ws, zc1 - 0.04 - Math.sin(wa) * ws, STEEL, -wa, 0, 0);
      return { cx, cw, top: top + rise };
    };
    const xIn = 0.21, xOut = W(cz) - inset;
    const D = consoleBody(-xOut, -xIn, 0.72), P = consoleBody(xIn, xOut, 0.66);
    // The driver's gauges on the dash, the graph on top, the throttle beside the wheel.
    for (const dx of [-0.17, 0.17]) cyl(fit, 0.04, 0.04, 0.025, H.seatX + dx, 0.79, zc0 + 0.075, '#e9e5dc', -1.0, 0, 0, 12);
    // (The graph leans back to face your eyes at the wheel.)
    graph(0.28, 0.18, D.cx - 0.04, D.top + 0.13, zc0 + 0.27, 0.5);
    cyl(fit, 0.02, 0.025, 0.06, D.cx - 0.04, D.top + 0.03, zc0 + 0.29, BLACK);
    box(fit, 0.07, 0.06, 0.12, -xOut + 0.06, D.top - 0.13, zc0 + 0.06, DARK);
    {
      const a = V(-xOut + 0.06, D.top - 0.1, zc0 + 0.04), b = V(-xOut + 0.06, D.top + 0.08, zc0 - 0.06);
      fit.push(strut(a, b, 0.012, 0.012, STEEL));
      cyl(fit, 0.028, 0.028, 0.07, b.x, b.y, b.z, BLACK, 0, 0, Math.PI / 2, 8);
    }
    // The passenger's glovebox and grab rail.
    box(fit, P.cw - 0.16, 0.16, 0.02, P.cx, 0.5, zc0 - 0.008, DARK);
    {
      const y = P.top + 0.02;
      fit.push(strut(V(P.cx - 0.18, y - 0.02, zc0 + 0.12), V(P.cx - 0.18, y + 0.1, zc0 + 0.12), 0.012, 0.012, STEEL));
      fit.push(strut(V(P.cx + 0.18, y - 0.02, zc0 + 0.12), V(P.cx + 0.18, y + 0.1, zc0 + 0.12), 0.012, 0.012, STEEL));
      fit.push(strut(V(P.cx - 0.18, y + 0.1, zc0 + 0.12), V(P.cx + 0.18, y + 0.1, zc0 + 0.12), 0.012, 0.012, STEEL));
    }
    this.wheelAt = [0.84, zc0 - 0.06, -0.62];

    // The casting deck: the rod locker down the middle, a storage hatch either side, the pedestal
    // seat forward, the trolling motor's foot pedal, a graph at the bow, two rods strapped down.
    {
      const z0 = zF + 0.14, z1 = 1.36, y = yDeck((z0 + z1) / 2);
      hatch(0, (z0 + z1) / 2, 0.4, z1 - z0, y);
      for (const sd of [1, -1]) hatch(sd * 0.48, zF + 0.4, 0.36, 0.42, yDeck(zF + 0.4));
    }
    pedestal(1.6, yDeck(1.6), false);
    box(fit, 0.16, 0.035, 0.26, 0.28, yDeck(1.3) + 0.03, 1.3, DARK, -0.12, 0, 0);
    {
      const z = 1.98, y = yDeck(z), x = 0.14;
      cyl(fit, 0.05, 0.05, 0.015, x, y + 0.008, z, BLACK, 0, 0, 0, 10);
      cyl(fit, 0.015, 0.015, 0.1, x, y + 0.06, z, BLACK, 0, 0, 0, 6);
      graph(0.2, 0.13, x, y + 0.15, z, 0.35);
    }
    for (const [x0, x1] of [[-0.62, -0.3], [-0.5, -0.2]]) {
      const a = V(x0, yDeck(zF + 0.12) + 0.03, zF + 0.12), b = V(x1, yDeck(2.0) + 0.02, 2.0);
      fit.push(strut(a, b, 0.012, 0.005, '#1d2125'));
      const d = b.clone().sub(a).normalize();
      fit.push(strut(a.clone().addScaledVector(d, 0.2), a.clone().addScaledVector(d, 0.27), 0.035, 0.035, '#5a5f66'));
      for (const k of [0.45, 1.3]) {
        const p = a.clone().addScaledVector(d, k);
        box(fit, 0.06, 0.012, 0.03, p.x, p.y - 0.004, p.z, BLACK);
      }
    }

    // Pop-up cleats at her bow and stern quarters, the bow light, the bow eye.
    for (const z of [1.72, -2.1]) {
      for (const sd of [1, -1]) {
        const x = sd * (W(z) - 0.035), y = S(z) + 0.022;
        box(fit, 0.16, 0.02, 0.035, x, y + 0.02, z, STEEL, 0, sd * 0.25, 0);
        for (const dz of [-0.04, 0.04]) cyl(fit, 0.01, 0.01, 0.025, x, y + 0.006, z + dz, STEEL, 0, 0, 0, 6);
      }
    }
    {
      const z = zBow - 0.2, y = S(z) + 0.01;
      box(fit, 0.08, 0.04, 0.07, 0, y + 0.02, z, BLACK);
      box(fit, 0.012, 0.035, 0.06, 0.03, y + 0.035, z + 0.005, '#c0392b');
      box(fit, 0.012, 0.035, 0.06, -0.03, y + 0.035, z + 0.005, '#2e8b57');
    }
    {
      const k = H.keel(1), s = S(zBow), y = 0.34, h = clamp((y - k) / (s - k), 0, 1);
      fit.push({ geo: new THREE.TorusGeometry(0.028, 0.008, 5, 10), matrix: mat(0, y, zBow - F.rake * Math.pow(1 - h, 1.4) + 0.012), color: STEEL, jitter: 0.02 });
    }
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
    this.torso.position.set(this.seatX, this.seatY, 0.02 + this.seatZ);
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
      // (Across her where you sit: see seatX.)
      for (const p of [hip, knee, foot]) p.x += this.seatX;
      setLimb(thigh, hip, knee, 0.07);
      setLimb(shin, knee, foot, 0.06);
      const b = cast(new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.22), boot));
      b.position.set(foot.x, foot.y - 0.02, foot.z + 0.05);
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
      // (On a jack plate, if she has one, that much further aft: see form.jack.)
      g.position.set(x, sheer(H, 0) - 0.02, zAt(H, 0) - 0.04 - (H.form?.jack || 0));
      // (An outboard that's up starts tilted out of the water.)
      // (Tilting swings the leg up and aft, the propeller out behind the transom: + about x.)
      if (!H.motor) g.rotation.x = 1.3;
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
    const geo = this.outboardGeo(), shell = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.1 });
    const bladeMat = new THREE.MeshStandardMaterial({ color: '#9aa1a8', metalness: 0.6, roughness: 0.35 });
    this.motorMeshes = [];
    this.bladeMats = { alloy: bladeMat, steel: new THREE.MeshStandardMaterial({ color: '#c9ced3', metalness: 0.9, roughness: 0.18 }) };
    const fit = (grp) => {
      const mesh = new THREE.Mesh(geo, shell);
      mesh.castShadow = true;
      grp.add(mesh);
      this.motorMeshes.push(mesh);
      const prop = new THREE.Group();
      prop.position.set(0, -0.86, -0.33);
      this.setBlades(prop, 3, bladeMat);
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
    // (The bass boat's electric bow motor, that her first notches run, is her bow trolling motor's
    // rig: see buildTroll, and main.js, which gives her one.)
  }

  // The outboard's shell, in one piece: its cowling and band (look: { cowl, band, tall }, the
  // hull's own colours if none; tall: a V6's taller cowling), leg, gearcase and tiller.
  outboardGeo(look = null) {
    const H = this.hull, M = H.motor || H.outboard, tall = look?.tall ?? 1, ch = 0.3 * tall;
    const parts = [
      { geo: new THREE.BoxGeometry(0.16, 0.14, 0.12), matrix: mat(0, 0, 0.02), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.3, ch, 0.42), matrix: mat(0, 0.09 + ch / 2, -0.12), color: look?.cowl ?? M.cowl },
      { geo: new THREE.BoxGeometry(0.31, 0.06, 0.43), matrix: mat(0, 0.11, -0.12), color: look?.band ?? M.band },
      { geo: new THREE.BoxGeometry(0.09, 0.95, 0.11), matrix: mat(0, -0.42, -0.14), color: '#3a3d42' },
      { geo: new THREE.CylinderGeometry(0.06, 0.05, 0.3, 8), matrix: mat(0, -0.86, -0.16, Math.PI / 2, 0, 0), color: '#3a3d42' },
      { geo: new THREE.BoxGeometry(0.02, 0.14, 0.12), matrix: mat(0, -0.95, -0.1), color: '#3a3d42' },
      // (The tiller: none on a boat steered by a wheel.)
      ...(H.console || H.form?.wheel ? [] : [
        { geo: new THREE.CylinderGeometry(0.018, 0.022, 0.62, 6), matrix: mat(0.04, 0.17, 0.26, Math.PI / 2 - 0.12, 0, 0), color: '#2b2b2b' },
        { geo: new THREE.CylinderGeometry(0.03, 0.03, 0.14, 8), matrix: mat(0.04, 0.2, 0.55, Math.PI / 2 - 0.12, 0, 0), color: '#c0392b' },
      ]),
    ];
    return mergeParts(parts);
  }

  // A propeller's blades (n of them, evenly round its hub), in place of any it had.
  setBlades(prop, n, material) {
    for (const c of [...prop.children]) prop.remove(c);
    for (let i = 0; i < n; i++) {
      const b = new THREE.Mesh(BLADE, material);
      b.position.y = 0.07;
      const arm = new THREE.Group();
      arm.rotation.z = (i / n) * Math.PI * 2;
      b.rotation.y = 0.5;
      arm.add(b);
      prop.add(arm);
    }
  }

  // Her engine and propeller from the catalogue (see engines.js engineSpec; null: as the hull has
  // it): what pushes her (see update), and the outboard drawn as it is: its size, its cowling and
  // colours, and the propeller's blades.
  setMotor(spec) {
    const was = this.motorSpec;
    this.motorSpec = spec || null;
    if (!this.motorMeshes?.length) return;
    const look = spec?.look || null;
    if ((was?.look || null) !== look) {
      const geo = this.outboardGeo(look);
      for (const mesh of this.motorMeshes) {
        mesh.geometry.dispose();
        mesh.geometry = geo;
      }
    }
    const n = spec?.blades ?? 3, steel = !!spec?.steel;
    if ((was?.blades ?? 3) !== n || !!was?.steel !== steel) for (const p of this.props) this.setBlades(p, n, steel ? this.bladeMats.steel : this.bladeMats.alloy);
    const M = this.hull.motor || this.hull.outboard;
    for (const mg of this.motorGroups) mg.scale.setScalar(spec?.scale ?? M?.scale ?? 1);
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
    if (this.hull.wheelhouse) return this.buildWheelhouse();
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

  // The cabin boat's hull trim, as a classic wooden launch's (H.wheelhouse; into her hull's mesh,
  // so her stripe stays the Marine Works' to change): a stripe along her sheer, a varnished
  // rubbing strake over it, a bronze band up her stem, and her side decks either side of the
  // wheelhouse. rows: her outer hull's sections (hullSurface), starboard gunwale first.
  launchTrim(rows) {
    const H = this.hull, W = H.wheelhouse, [t0, t1] = H.cabin, NP = rows[0].length - 1, out = [];
    // Where her side is at height y on station i, on side sd (+1 port, -1 starboard): along her
    // topside, the straight run from the gunwale (j 0, or NP) to the next point down.
    const at = (i, y, sd, off = 0) => {
      const r = rows[i], a = sd < 0 ? r[0] : r[NP], b = sd < 0 ? r[1] : r[NP - 1];
      const k = clamp((a[1] - y) / (a[1] - b[1]), 0, 1), x = a[0] + (b[0] - a[0]) * k;
      return [x + sd * off, y, a[2]];
    };
    for (const sd of [1, -1]) {
      // The stripe: a band 6.5 to 13.5 cm under her sheer, following it.
      const pos = [];
      for (let i = 0; i < rows.length - 1; i++) {
        const s0 = rows[i][0][1], s1 = rows[i + 1][0][1];
        const a = at(i, s0 - 0.065, sd, 0.003), b = at(i + 1, s1 - 0.065, sd, 0.003), c = at(i + 1, s1 - 0.135, sd, 0.003), d = at(i, s0 - 0.135, sd, 0.003);
        pos.push(...a, ...b, ...c, ...a, ...c, ...d);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
      out.push({ geo: g, color: H.stripe, jitter: 0.02 });
      // The rubbing strake, half-round, varnished, just above it.
      const strake = rows.slice(0, -1).map((r, i) => new THREE.Vector3(...at(i, r[0][1] - 0.045, sd, 0.008)));
      out.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(strake), 40, 0.02, 5), color: '#7b5434', jitter: 0.03 });
      // The side deck between her capping and the wheelhouse's side, flush with the capping.
      const dp = [], N = 14;
      for (let n = 0; n < N; n++) {
        const ta = t0 + ((t1 - t0) * n) / N, tb = t0 + ((t1 - t0) * (n + 1)) / N;
        const edge = (t) => [sd * (hw(H, t) - 0.02), sheer(H, t) - 0.005, zAt(H, t)];
        const wall = (t) => [sd * Math.max(0.12, hw(H, t) - W.deck), sheer(H, t) - 0.005, zAt(H, t)];
        dp.push(...edge(ta), ...edge(tb), ...wall(tb), ...edge(ta), ...wall(tb), ...wall(ta));
      }
      const dg = new THREE.BufferGeometry();
      dg.setAttribute('position', new THREE.Float32BufferAttribute(dp, 3));
      out.push({ geo: dg, color: '#c9b58f', jitter: 0.03 });
    }
    // The stem band, bronze, from her stem head down to her forefoot.
    const stem = rows.at(-1).slice(0, Math.floor(NP / 2) + 1).map((p) => new THREE.Vector3(0, p[1], p[2] + 0.012));
    out.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(stem), 12, 0.016, 5), color: '#b08d57', jitter: 0.02 });
    return out;
  }

  // The cabin boat's wheelhouse (H.wheelhouse; her old cuddy is buildCabin, ?classic=cabin): a
  // little wooden launch's. The house stands in from her sides on side decks, its walls leaning in
  // a little, with standing room inside under a cambered roof that runs back over the door; a
  // raked windscreen of three panes; long windows down each side; a window either side of the door
  // and one in it, so from her tiller you see forward through the house and out of the windscreen;
  // forward of it a low trunk over the forepeak, with a hatch and a port each side; then a short
  // foredeck with a samson post and cleats. On the roof, grab rails, the stove's chimney and a
  // little mast with an all-round light; her sidelights on the house's sides. Inside, as in the
  // old cuddy: the bunk, the galley, the shelf, the rug, the lamp. The glass is glass: you see in,
  // and out. In her cockpit, floorboards, a bench along each side on knees and the helm bench
  // across her stern (its locker holds her battery). (Her hull's trim: launchTrim.)
  buildWheelhouse() {
    const H = this.hull, W = H.wheelhouse, [t0, t1] = H.cabin, tf = W.front, L = H.L, V3 = (x, y, z) => new THREE.Vector3(x, y, z);
    const WALL = '#ece6d8', LINING = '#f1ece1', VARNISH = '#7b5434', TEAK = '#a8784a', SOLE = '#a77746', STEEL = '#c9cdd0', BRONZE = '#b08d57', DARK = '#2b2b2b', NAVY = '#1f3b56';
    const deckAt = (t) => sheer(H, t) - 0.005, side = (t) => Math.max(0.12, hw(H, t) - W.deck);
    const floor = H.floorY, cabinFloor = floor + 0.02, yTop = cabinFloor + 1.74, yTrunk = deckAt(tf) + W.trunk;
    const run = (yTop - yTrunk) * W.rake, tw = tf - run / L, lean = W.lean / (yTop - deckAt(t0));
    // The house's side (its outer face) at t and height y: in from the deck's edge as it rises.
    const wallX = (t, y) => side(t) - lean * Math.max(0, y - deckAt(t));
    // How high the house's side goes at t: the roof over the wheelhouse, down the windscreen's
    // rake, then the trunk's roof forward.
    const topAt = (t) => (t <= tw ? yTop : t >= tf ? yTrunk : yTop + ((yTrunk - yTop) * (t - tw)) / (tf - tw));
    const zb = zAt(H, t0), zt = zAt(H, t1), base = sheer(H, t0) - 0.12, wall = 0.04;
    const parts = [], roof = [], glass = [], inside = [];
    const tri = (to, pts, color, jitter = 0.02) => {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(pts.flat(), 3));
      to.push({ geo: g, color, jitter });
    };
    const quad = (to, a, b, c, d, color, jitter) => tri(to, [a, b, c, a, c, d], color, jitter);
    const box = (to, sx, sy, sz, x, y, z, color, rx = 0, ry = 0, rz = 0, jitter = 0.03) => to.push({ geo: new THREE.BoxGeometry(sx, sy, sz), matrix: mat(x, y, z, rx, ry, rz), color, jitter });
    const cyl = (to, r0, r1, h, x, y, z, color, rx = 0, ry = 0, rz = 0, n = 8) => to.push({ geo: new THREE.CylinderGeometry(r0, r1, h, n), matrix: mat(x, y, z, rx, ry, rz), color, jitter: 0.02 });
    // A rounded rectangle (x0, y0)-(x1, y1), corners r, as a path (a shape, or a hole in one).
    const rrect = (P, x0, y0, x1, y1, r) => {
      P.moveTo(x0 + r, y0);
      P.lineTo(x1 - r, y0);
      P.absarc(x1 - r, y0 + r, r, -Math.PI / 2, 0);
      P.lineTo(x1, y1 - r);
      P.absarc(x1 - r, y1 - r, r, 0, Math.PI / 2);
      P.lineTo(x0 + r, y1);
      P.absarc(x0 + r, y1 - r, r, Math.PI / 2, Math.PI);
      P.lineTo(x0, y0 + r);
      P.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5);
      return P;
    };
    // A window, in the plane given by its centre and axes (u along it, v up it, n out of it), w by
    // h: its frame, a rounded ring standing proud of the wall round the opening (covering the
    // opening's square corners), and its glass, set back in it.
    const windowAt = (C, u, v, n, w, h, r, frame, color) => {
      const m = new THREE.Matrix4().makeBasis(u, v, n).setPosition(C);
      const ring = rrect(new THREE.Shape(), -w / 2 - frame, -h / 2 - frame, w / 2 + frame, h / 2 + frame, r + frame);
      ring.holes.push(rrect(new THREE.Path(), -w / 2 + 0.01, -h / 2 + 0.01, w / 2 - 0.01, h / 2 - 0.01, r));
      const rg = new THREE.ExtrudeGeometry(ring, { depth: 0.028, bevelEnabled: false, curveSegments: 3 });
      rg.translate(0, 0, -0.012);
      parts.push({ geo: rg, matrix: m, color, jitter: 0.02 });
      const pane = new THREE.ShapeGeometry(rrect(new THREE.Shape(), -w / 2 + 0.01, -h / 2 + 0.01, w / 2 - 0.01, h / 2 - 0.01, r), 3);
      pane.translate(0, 0, -0.004);
      glass.push({ geo: pane, matrix: m, color: '#ffffff', jitter: 0 });
    };

    // The house's sides: the wheelhouse's with its windows, a grid with the openings left out;
    // then the windscreen's rake and the trunk's low side.
    const WIN = [[0.49, 0.6], [0.62, 0.68]], w0 = cabinFloor + 1.16, w1 = cabinFloor + 1.48;
    const lin = (a, b, n) => Array.from({ length: n + 1 }, (_, i) => a + ((b - a) * i) / n);
    const sorted = (xs) => [...new Set(xs.map((x) => +x.toFixed(5)))].sort((a, b) => a - b);
    const stA = sorted([...lin(t0, tw, 8), ...WIN.flat()]), stB = sorted([...lin(tw, t1, 9), tf]);
    const P = (sd, t, y) => [sd * wallX(t, y), y, zAt(H, t)];
    for (const sd of [1, -1]) {
      for (let i = 0; i < stA.length - 1; i++) {
        const ta = stA[i], tb = stA[i + 1], open = WIN.some(([a, b]) => ta >= a - 1e-6 && tb <= b + 1e-6);
        const lv = (t) => [deckAt(t), w0, w1, yTop];
        for (let k = 0; k < 3; k++) {
          if (k === 1 && open) continue;
          quad(parts, P(sd, ta, lv(ta)[k]), P(sd, tb, lv(tb)[k]), P(sd, tb, lv(tb)[k + 1]), P(sd, ta, lv(ta)[k + 1]), WALL);
        }
      }
      for (let i = 0; i < stB.length - 1; i++) {
        const ta = stB[i], tb = stB[i + 1];
        quad(parts, P(sd, ta, deckAt(ta)), P(sd, tb, deckAt(tb)), P(sd, tb, topAt(tb)), P(sd, ta, topAt(ta)), WALL);
      }
      // The windows' frames (varnished) and glass, in the plane of the wall at each.
      for (const [ta, tb] of WIN) {
        const ym = (w0 + w1) / 2, A = V3(...P(sd, ta, ym)), B = V3(...P(sd, tb, ym));
        const u = B.clone().sub(A).normalize(), up = V3(-sd * lean, 1, 0).normalize();
        const v = up.clone().addScaledVector(u, -up.dot(u)).normalize(), n = new THREE.Vector3().crossVectors(u, v);
        if (n.x * sd < 0) n.negate(), u.negate();
        windowAt(A.clone().add(B).multiplyScalar(0.5), u, v, n, A.distanceTo(B), (w1 - w0) * Math.hypot(1, lean), 0.07, 0.04, VARNISH);
      }
      // A round port in the trunk's side, bronze.
      {
        const t = 0.8, y = (deckAt(t) + yTrunk) / 2, x = sd * (wallX(t, y) + 0.004), a = Math.atan2(side(t + 0.02) - side(t - 0.02), zAt(H, t + 0.02) - zAt(H, t - 0.02));
        parts.push({ geo: new THREE.TorusGeometry(0.055, 0.012, 5, 14), matrix: mat(x, y, zAt(H, t), 0, sd * (Math.PI / 2 - a), 0), color: BRONZE, jitter: 0.02 });
        parts.push({ geo: new THREE.CircleGeometry(0.05, 14), matrix: mat(x + sd * 0.002, y, zAt(H, t), 0, sd * (Math.PI / 2 - a), 0), color: '#2e3f49', jitter: 0 });
      }
      // Her sidelight on the house's side near its front: red to port, green to starboard.
      {
        const t = tw + 0.016, y = w0 + 0.2, x = sd * (wallX(t, y) + 0.03);
        box(parts, 0.05, 0.1, 0.16, x, y, zAt(H, t), DARK);
        box(parts, 0.012, 0.07, 0.11, x + sd * 0.027, y, zAt(H, t) + 0.01, sd > 0 ? '#c0392b' : '#2e8b57', 0, 0, 0, 0);
      }
    }
    // The trunk's front, bowed a little.
    {
      const U = [-1, -0.6, -0.2, 0.2, 0.6, 1], F = (u, y) => [u * wallX(t1, y), y, zt + 0.06 * (1 - u * u)];
      for (let i = 0; i < U.length - 1; i++) quad(parts, F(U[i], deckAt(t1)), F(U[i], yTrunk), F(U[i + 1], yTrunk), F(U[i + 1], deckAt(t1)), WALL);
    }
    // The windscreen: three panes in a raked front, frames in the house's colour, a varnished sill.
    {
      const at = (u, v) => {
        const y = yTrunk + v * (yTop - yTrunk), t = tf - v * (tf - tw);
        return [u * wallX(t, y), y, zAt(H, t)];
      };
      const Us = [-1, -0.95, -0.37, -0.31, 0.31, 0.37, 0.95, 1], Vs = [0, 0.12, 0.86, 1];
      const panes = [[-0.95, -0.37], [-0.31, 0.31], [0.37, 0.95]];
      for (let i = 0; i < Us.length - 1; i++) {
        for (let k = 0; k < Vs.length - 1; k++) {
          if (k === 1 && panes.some(([a, b]) => Us[i] >= a - 1e-6 && Us[i + 1] <= b + 1e-6)) continue;
          quad(parts, at(Us[i], Vs[k]), at(Us[i + 1], Vs[k]), at(Us[i + 1], Vs[k + 1]), at(Us[i], Vs[k + 1]), WALL);
        }
      }
      const back = new THREE.Vector3(0, run, yTop - yTrunk).normalize().multiplyScalar(-0.012);
      for (const [a, b] of panes) {
        const g = [at(a, 0.12), at(b, 0.12), at(b, 0.86), at(a, 0.86)].map((p) => [p[0], p[1] + back.y, p[2] + back.z]);
        quad(glass, g[0], g[1], g[2], g[3], '#ffffff', 0);
      }
      const s0 = at(-1, 0), s1 = at(1, 0);
      box(parts, s1[0] - s0[0] + 0.04, 0.035, 0.07, 0, yTrunk + 0.012, zAt(H, tf) + 0.01, VARNISH);
    }
    // The back of the house, down to her floorboards: the door's opening in the middle, a window
    // either side of it; below the side decks it fills her hull to its planking.
    const door = 0.3, doorTop = floor + 1.62;
    {
      const halfAt = (y) => (y <= deckAt(t0) ? this.innerHalf(t0, y) - 0.005 : wallX(t0, y));
      const S = new THREE.Shape(), ys = lin(floor, deckAt(t0), 6);
      S.moveTo(door, floor);
      for (const y of ys) S.lineTo(halfAt(y), y);
      S.lineTo(wallX(t0, deckAt(t0) + 0.001), deckAt(t0) + 0.001);
      S.lineTo(wallX(t0, yTop), yTop);
      S.lineTo(-wallX(t0, yTop), yTop);
      S.lineTo(-wallX(t0, deckAt(t0) + 0.001), deckAt(t0) + 0.001);
      for (const y of [...ys].reverse()) S.lineTo(-halfAt(y), y);
      S.lineTo(-door, floor);
      S.lineTo(-door, doorTop);
      S.lineTo(door, doorTop);
      S.lineTo(door, floor);
      const wx0 = door + 0.08, wx1 = wallX(t0, w1) - 0.08;
      for (const sd of [1, -1]) S.holes.push(rrect(new THREE.Path(), sd > 0 ? wx0 : -wx1, w0 + 0.04, sd > 0 ? wx1 : -wx0, w1, 0.06));
      parts.push({ geo: new THREE.ShapeGeometry(S, 4), matrix: mat(0, 0, zb), color: WALL, jitter: 0.02 });
      for (const sd of [1, -1]) windowAt(V3(sd * (wx0 + wx1) / 2, (w0 + 0.04 + w1) / 2, zb), V3(1, 0, 0), V3(0, 1, 0), V3(0, 0, 1), wx1 - wx0, w1 - w0 - 0.04, 0.06, 0.035, VARNISH);
      // The doorway's frame and sill, varnished; a grab handle either side of it.
      box(parts, 0.05, doorTop - floor, 0.06, door + 0.025, (doorTop + floor) / 2, zb, VARNISH);
      box(parts, 0.05, doorTop - floor, 0.06, -door - 0.025, (doorTop + floor) / 2, zb, VARNISH);
      box(parts, door * 2 + 0.1, 0.05, 0.06, 0, doorTop + 0.025, zb, VARNISH);
      box(parts, door * 2, 0.06, 0.08, 0, floor + 0.03, zb, VARNISH);
      for (const sd of [1, -1]) {
        const x = sd * (door + 0.09), ya = floor + 0.7, yb = w0 - 0.06;
        parts.push(strut(V3(x, ya, zb - 0.06), V3(x, yb, zb - 0.06), 0.014, 0.014, VARNISH));
        for (const y of [ya, yb]) box(parts, 0.025, 0.025, 0.06, x, y, zb - 0.03, VARNISH);
      }
    }

    // The roofs: the wheelhouse's, cambered, overhanging aft over the door and forward over the
    // windscreen, with a varnished fascia and a lining underneath; the trunk's, low, with its
    // hatch. (All in the roof, which lifts away when you look down into the cabin.)
    const camber = (u, c) => c * (1 - u * u);
    const roofSlab = (z0, z1, half, y0, c, color) => {
      const Z = lin(z0, z1, 10), U = lin(-1, 1, 8);
      const top = (z, u) => [u * half(z), y0 + 0.04 + camber(u, c), z];
      for (let i = 0; i < Z.length - 1; i++) {
        for (let k = 0; k < U.length - 1; k++) {
          quad(roof, top(Z[i], U[k]), top(Z[i], U[k + 1]), top(Z[i + 1], U[k + 1]), top(Z[i + 1], U[k]), color, 0.02);
          quad(roof, [U[k] * half(Z[i]), y0, Z[i]], [U[k] * half(Z[i + 1]), y0, Z[i + 1]], [U[k + 1] * half(Z[i + 1]), y0, Z[i + 1]], [U[k + 1] * half(Z[i]), y0, Z[i]], LINING, 0.01);
        }
        // The fascia either side.
        for (const sd of [1, -1]) quad(roof, [sd * half(Z[i]), y0, Z[i]], [sd * half(Z[i + 1]), y0, Z[i + 1]], top(Z[i + 1], sd), top(Z[i], sd), VARNISH, 0.02);
      }
      // And fore and aft.
      for (const z of [z0, z1]) for (let k = 0; k < U.length - 1; k++) quad(roof, [U[k] * half(z), y0, z], [U[k + 1] * half(z), y0, z], top(z, U[k + 1]), top(z, U[k]), VARNISH, 0.02);
      return (u, z) => top(z, u)[1];
    };
    const tOfZ = (z) => clamp((z + L / 2) / L, 0, 1);
    const roofColor = W.roof || '#2f5d50';
    const wheelRoof = roofSlab(zb - 0.32, zAt(H, tw) + 0.1, (z) => wallX(tOfZ(Math.max(z, zb)), yTop) + 0.05, yTop, 0.06, roofColor);
    roofSlab(zAt(H, tf) - 0.04, zt + 0.1, (z) => wallX(tOfZ(Math.min(z, zt)), yTrunk) + 0.035, yTrunk, 0.02, roofColor);
    // The forehatch on the trunk: a varnished frame, a smoked lid.
    {
      // (Low: from her tiller you look forward over it.)
      const z = (zAt(H, tf) + zt) / 2, y = yTrunk + 0.04 + 0.02;
      box(roof, 0.42, 0.035, 0.42, 0, y + 0.0, z, VARNISH);
      box(roof, 0.36, 0.01, 0.36, 0, y + 0.018, z, '#34444d', 0, 0, 0, 0);
    }
    // Grab rails along the roof, varnished, on three feet each.
    for (const sd of [1, -1]) {
      const za = zb + 0.12, zc = zAt(H, tw) - 0.15, at = (z) => {
        const half = wallX(tOfZ(z), yTop) + 0.05, x = sd * (half - 0.14);
        return V3(x, wheelRoof(x / half, z), z);
      };
      const A = at(za).add(V3(0, 0.07, 0)), B = at(zc).add(V3(0, 0.07, 0));
      roof.push(strut(A, B, 0.016, 0.016, VARNISH));
      for (const k of [0, 0.5, 1]) {
        const z = za + (zc - za) * k, F = at(z);
        roof.push(strut(F, F.clone().add(V3(0, 0.08, 0)), 0.014, 0.014, VARNISH));
      }
    }
    // The stove's chimney over the galley, with its cap; the little mast aft, its light at the top.
    const gx = -(side(0.5) - wall - 0.19 - lean * 0.2), gz = zAt(H, 0.54);
    {
      const y = wheelRoof(gx / (wallX(tOfZ(gz), yTop) + 0.05), gz);
      cyl(roof, 0.045, 0.045, 0.36, gx, y + 0.17, gz + 0.1, DARK);
      cyl(roof, 0.075, 0.06, 0.07, gx, y + 0.37, gz + 0.1, DARK);
      const my = wheelRoof(0, zb + 0.3);
      cyl(roof, 0.03, 0.035, 0.9, 0, my + 0.45, zb + 0.3, VARNISH);
      cyl(roof, 0.06, 0.06, 0.03, 0, my + 0.015, zb + 0.3, VARNISH);
      roof.push({ geo: new THREE.OctahedronGeometry(0.09), matrix: mat(0, my + 0.6, zb + 0.3, 0, Math.PI / 4, 0), color: STEEL, jitter: 0.04 });
      this.mastLightY = my + 0.95;
    }

    // Forward: the samson post on her foredeck, a cleat either side, a fairlead each bow.
    {
      const t = 0.925, y = sheer(H, t);
      box(parts, 0.09, 0.24, 0.09, 0, y + 0.1, zAt(H, t), VARNISH);
      cyl(parts, 0.012, 0.012, 0.2, 0, y + 0.16, zAt(H, t), STEEL, 0, 0, Math.PI / 2, 6);
      for (const sd of [1, -1]) {
        const tc = 0.895, x = sd * (hw(H, tc) - 0.1), yc = sheer(H, tc), zc = zAt(H, tc);
        box(parts, 0.03, 0.04, 0.05, x, yc + 0.02, zc - 0.05, STEEL);
        box(parts, 0.03, 0.04, 0.05, x, yc + 0.02, zc + 0.05, STEEL);
        box(parts, 0.035, 0.025, 0.22, x, yc + 0.05, zc, STEEL);
      }
    }
    // Aft: a cleat on each quarter, on her capping.
    for (const sd of [1, -1]) {
      const t = 0.06, x = sd * (hw(H, t) - 0.03), y = sheer(H, t) + 0.06, z = zAt(H, t);
      box(parts, 0.03, 0.04, 0.05, x, y + 0.01, z - 0.05, STEEL);
      box(parts, 0.03, 0.04, 0.05, x, y + 0.01, z + 0.05, STEEL);
      box(parts, 0.035, 0.025, 0.2, x, y + 0.04, z, STEEL);
    }

    // Her cockpit: floorboards (and on into the cabin), a bench along each side on knees, the helm
    // bench across her stern.
    {
      const zs0 = zAt(H, 0.02), zs1 = zAt(H, 0.67), n = 9;
      for (let i = 0; i < n; i++) {
        const za = zs0 + ((zs1 - zs0) * i) / n, zb2 = zs0 + ((zs1 - zs0) * (i + 1)) / n, half = Math.min(this.innerHalf(tOfZ(za), floor + 0.01), this.innerHalf(tOfZ(zb2), floor + 0.01)) - 0.01;
        for (let k = 0; k < 5; k++) {
          const x0 = -half + (2 * half * k) / 5, x1 = -half + (2 * half * (k + 1)) / 5;
          box(parts, x1 - x0 - 0.012, 0.025, zb2 - za - 0.004, (x0 + x1) / 2, floor - 0.0125, (za + zb2) / 2, k % 2 ? SOLE : '#9c6d40', 0, 0, 0, 0.04);
        }
      }
      // The side benches: a varnished plank from her side to the lantern's post, on three knees.
      const bz0 = H.seatZ + 0.36, bz1 = zb - 0.18, by = 0.62, inner = 0.5;
      for (const sd of [1, -1]) {
        const segs = 3;
        for (let i = 0; i < segs; i++) {
          const za = bz0 + ((bz1 - bz0) * i) / segs, zc = bz0 + ((bz1 - bz0) * (i + 1)) / segs;
          const outA = this.innerHalf(tOfZ(za), by) - 0.005, outC = this.innerHalf(tOfZ(zc), by) - 0.005;
          tri(parts, [[sd * inner, by, za], [sd * outA, by, za], [sd * outC, by, zc], [sd * inner, by, za], [sd * outC, by, zc], [sd * inner, by, zc]], TEAK, 0.03);
          tri(parts, [[sd * inner, by - 0.03, za], [sd * inner, by - 0.03, zc], [sd * outC, by - 0.03, zc], [sd * inner, by - 0.03, za], [sd * outC, by - 0.03, zc], [sd * outA, by - 0.03, za]], TEAK, 0.03);
          quad(parts, [sd * inner, by - 0.03, za], [sd * inner, by, za], [sd * inner, by, zc], [sd * inner, by - 0.03, zc], VARNISH, 0.02);
        }
        for (const k of [0.1, 0.5, 0.9]) {
          const z = bz0 + (bz1 - bz0) * k, o = this.innerHalf(tOfZ(z), by - 0.15) - 0.03;
          box(parts, 0.04, 0.2, 0.04, sd * o, by - 0.13, z, VARNISH);
          parts.push(strut(V3(sd * (o - 0.02), by - 0.05, z), V3(sd * Math.max(inner + 0.03, o - 0.26), by - 0.05, z), 0.018, 0.018, VARNISH));
        }
      }
      // The helm bench across her stern: a locker (her battery's in it) under a varnished top and
      // a navy cushion; you sit on it to steer by the tiller.
      const sz = H.seatZ, top = this.seatY - 0.07, t = tOfZ(sz);
      const half = this.innerHalf(t, top) - 0.005, halfF = this.innerHalf(tOfZ(sz + 0.21), floor + 0.02) - 0.005;
      box(parts, half * 2, 0.04, 0.44, 0, top - 0.02, sz, TEAK);
      box(parts, half * 2 - 0.06, 0.07, 0.4, 0, this.seatY - 0.035, sz - 0.01, NAVY, 0, 0, 0, 0.02);
      tri(parts, [[-halfF, floor, sz + 0.21], [halfF, floor, sz + 0.21], [half, top - 0.04, sz + 0.21], [-halfF, floor, sz + 0.21], [half, top - 0.04, sz + 0.21], [-half, top - 0.04, sz + 0.21]], WALL, 0.02);
      box(parts, 0.3, 0.2, 0.012, 0, (floor + top) / 2, sz + 0.215, VARNISH);
    }

    // Inside (as in the old cuddy). The bunk across the bow, narrowing with her, a mattress, a
    // blanket and a pillow; the galley by the door to starboard; the shelf to port; a rug.
    const sideIn = (t) => side(t) - lean * 0.2;
    const tb0 = 0.67, tb1 = t1 - wall / L - 0.01, by = floor + 0.46;
    const berth = (ta, tb, inset, y, h, color) => {
      const w = Math.min(sideIn(ta), sideIn(tb)) - wall - inset;
      return { geo: new THREE.BoxGeometry(w * 2, h, zAt(H, tb) - zAt(H, ta)), matrix: mat(0, y, (zAt(H, ta) + zAt(H, tb)) / 2), color };
    };
    const gxx = -(sideIn(0.5) - wall - 0.19), shelfX = wallX(0.56, base + 0.45) - wall - 0.09;
    inside.push(
      berth(tb0, 0.77, 0.02, by - 0.04, 0.08, '#8a6040'),
      berth(0.77, tb1, 0.02, by - 0.04, 0.08, '#8a6040'),
      { geo: new THREE.BoxGeometry(0.06, by - floor - 0.08, 0.06), matrix: mat(0, (by + floor) / 2 - 0.08, zAt(H, tb0) + 0.05), color: '#6b4a30' },
      berth(tb0, 0.77, 0.06, by + 0.06, 0.12, '#5b7290'),
      berth(0.77, tb1, 0.06, by + 0.06, 0.12, '#5b7290'),
      berth(tb0 - 0.005, 0.74, 0.04, by + 0.14, 0.05, '#b5523b'),
      { geo: new THREE.BoxGeometry(0.4, 0.09, 0.24), matrix: mat(0, by + 0.17, zAt(H, tb1) - 0.2), color: '#f1ece2' },
      { geo: new THREE.BoxGeometry(0.34, 0.84, 0.62), matrix: mat(gxx, floor + 0.42, zAt(H, 0.54)), color: '#a8743f' },
      { geo: new THREE.BoxGeometry(0.36, 0.03, 0.64), matrix: mat(gxx, floor + 0.85, zAt(H, 0.54)), color: '#7b5434' },
      { geo: new THREE.BoxGeometry(0.26, 0.05, 0.4), matrix: mat(gxx, floor + 0.89, zAt(H, 0.54)), color: '#3a3d42' },
      { geo: new THREE.TorusGeometry(0.06, 0.012, 4, 12), matrix: mat(gxx, floor + 0.92, zAt(H, 0.54) - 0.1, Math.PI / 2, 0, 0), color: '#1d1d1d' },
      { geo: new THREE.TorusGeometry(0.06, 0.012, 4, 12), matrix: mat(gxx, floor + 0.92, zAt(H, 0.54) + 0.1, Math.PI / 2, 0, 0), color: '#1d1d1d' },
      { geo: new THREE.CylinderGeometry(0.06, 0.07, 0.13, 10), matrix: mat(gxx, floor + 0.99, zAt(H, 0.54) + 0.1), color: '#b8312f' },
      { geo: new THREE.CylinderGeometry(0.012, 0.012, 0.1, 5), matrix: mat(gxx + 0.07, floor + 1.0, zAt(H, 0.54) + 0.1, 0, 0, -1.0), color: '#b8312f' },
      { geo: new THREE.BoxGeometry(0.16, 0.025, 0.7), matrix: mat(shelfX, base + 0.45, zAt(H, 0.56)), color: '#7b5434' },
      ...[0, 1, 2].map((k) => ({ geo: new THREE.CylinderGeometry(0.035, 0.035, 0.11, 8), matrix: mat(shelfX, base + 0.52, zAt(H, 0.53) + k * 0.1), color: ['#c9a34a', '#8fb36a', '#d97a4a'][k] })),
      ...[0, 1, 2, 3].map((k) => ({ geo: new THREE.BoxGeometry(0.1, 0.16, 0.035), matrix: mat(shelfX - 0.01, base + 0.54, zAt(H, 0.6) + k * 0.04), color: ['#35676b', '#7a2430', '#2f4f7a', '#a8743f'][k] })),
      { geo: new THREE.BoxGeometry(0.46, 0.012, 0.8), matrix: mat(0, floor + 0.006, zAt(H, 0.58)), color: '#9b3b30' },
      { geo: new THREE.BoxGeometry(0.4, 0.013, 0.72), matrix: mat(0, floor + 0.007, zAt(H, 0.58)), color: '#c98a45' },
      { geo: new THREE.CylinderGeometry(0.006, 0.006, 0.09, 4), matrix: mat(side(0.63) * 0.5, yTop - 0.045, zAt(H, 0.63)), color: '#3a3d42' },
    );

    const mesh = (this.cabinMesh = new THREE.Mesh(mergeParts([...parts, ...inside]), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    // The glass: clear (tinted a little), the lamp's warmth glowing in it after dark (see
    // setCabinLight). Shared by the door's.
    const glassMat = new THREE.MeshStandardMaterial({ color: '#7f9aa6', transparent: true, opacity: 0.32, roughness: 0.05, metalness: 0.1, emissive: '#ffb25c', emissiveIntensity: 0, depthWrite: false, side: THREE.DoubleSide });
    this.cabinGlass = new THREE.Mesh(mergeParts(glass), glassMat);
    this.cabinGlass.renderOrder = 2;
    this.body.add(this.cabinGlass);
    this.cabinPanes = null;
    // The lamp under the roof, to port, and its light.
    const lampY = yTop - 0.13, lampX = side(0.63) * 0.5;
    this.cabinLamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), new THREE.MeshBasicMaterial({ color: '#ffd28a' }));
    this.cabinLamp.position.set(lampX, lampY, zAt(H, 0.63));
    this.body.add(this.cabinLamp);
    this.cabinLight = new THREE.PointLight('#ffc77d', 0, 4.2, 1.5);
    this.cabinLight.position.set(lampX, lampY - 0.08, zAt(H, 0.63));
    this.body.add(this.cabinLight);
    // The roofs, the chimney, the mast (and its light), the rails: lifted away when you look down
    // into the cabin.
    this.cabinRoof = new THREE.Mesh(mergeParts(roof), new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }));
    this.cabinRoof.castShadow = true;
    this.cabinRoof.receiveShadow = true;
    this.body.add(this.cabinRoof);
    this.mastLight = new THREE.Mesh(new THREE.SphereGeometry(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: '#fff3d6' }));
    this.mastLight.position.set(0, this.mastLightY, zb + 0.3);
    this.cabinRoof.add(this.mastLight);
    // The door, hinged on the doorway's port side, swinging out into the cockpit: varnished, with
    // a window in its upper half and a brass knob.
    const hinge = (this.cabinDoor = new THREE.Group());
    hinge.position.set(door, floor + 0.06, zb - 0.035);
    const dw = door * 2 - 0.02, dh = doorTop - floor - 0.08, gy0 = 1.0 - floor, gy1 = w1 - floor - 0.06;
    const leafShape = new THREE.Shape();
    leafShape.moveTo(-dw, 0).lineTo(0, 0).lineTo(0, dh).lineTo(-dw, dh).lineTo(-dw, 0);
    leafShape.holes.push(rrect(new THREE.Path(), -dw + 0.1, gy0, -0.1, gy1, 0.05));
    const leafGeo = new THREE.ExtrudeGeometry(leafShape, { depth: 0.035, bevelEnabled: false, curveSegments: 3 });
    leafGeo.translate(0, 0, -0.0175);
    const leaf = new THREE.Mesh(mergeParts([
      { geo: leafGeo, color: VARNISH, jitter: 0.02 },
      { geo: new THREE.CylinderGeometry(0.022, 0.022, 0.06, 6), matrix: mat(-dw + 0.07, dh * 0.5, -0.04, Math.PI / 2, 0, 0), color: '#c9a34a' },
    ]), new THREE.MeshLambertMaterial({ vertexColors: true }));
    leaf.castShadow = true;
    hinge.add(leaf);
    const pane = new THREE.ShapeGeometry(rrect(new THREE.Shape(), -dw + 0.1, gy0, -0.1, gy1, 0.05), 3);
    hinge.add(new THREE.Mesh(pane, glassMat));
    this.body.add(hinge);
    this.cabinOpen = 0;
    // Where you stand inside, and which way you face: the doorway, the galley, the bunk.
    this.cabinStations = [
      { id: 'door', x: 0, z: zb + 0.38, yaw: 0 },
      { id: 'galley', x: -0.08, z: zAt(H, 0.54), yaw: -Math.PI / 2 },
      { id: 'bunk', x: 0, z: zAt(H, tb0) - 0.32, yaw: 0 },
    ];
    this.cabinFloor = cabinFloor;
    this.cabinRoofY = yTop;
    this.cabinMid = new THREE.Vector3(0, base, (zb + zt) / 2);
    // (For the Marine Works' fittings: the back of the house, where her screens and floodlights go.)
    this.houseBack = { z: zb, top: yTop, door, window: [door + 0.08, wallX(t0, w1) - 0.08, w0] };
  }

  // Her inner hull's half-width at t and height y (from her inner sections: see buildHull).
  innerHalf(t, y) {
    const R = this.innerRows, NP = R[0].length - 1, f = clamp(t, 0, 1) * (R.length - 1), i = Math.min(R.length - 2, Math.floor(f)), k = f - i;
    const half = (row) => {
      if (y >= row[0][1]) return Math.abs(row[0][0]);
      for (let j = 0; j < NP / 2; j++) {
        const a = row[j], b = row[j + 1];
        if (y <= a[1] && y >= b[1]) return Math.abs(a[0] + ((b[0] - a[0]) * (a[1] - y)) / (a[1] - b[1] || 1));
      }
      return 0;
    };
    return half(R[i]) * (1 - k) + half(R[i + 1]) * k;
  }

  // Stainless rails round the bow: posts up from the gunwale at each t of ts, a rail along their
  // tops either side meeting at the stem.
  // (bay: if given, the starboard rail's forward bay goes in it instead, so it can be left off: a
  // trolling-motor rail, open there when one's fitted for its shaft to swing through.)
  bowRails(parts, ts, h = 0.62, bay = null) {
    const H = this.hull, steel = '#c9cdd0';
    for (const sd of [1, -1]) {
      const pts = [];
      for (const t of ts) {
        const x = sd * (hw(H, t) - 0.05), y = sheer(H, t), zz = zAt(H, t);
        parts.push({ geo: new THREE.CylinderGeometry(0.018, 0.018, h, 5), matrix: mat(x, y + h / 2, zz), color: steel });
        pts.push(new THREE.Vector3(x, y + h, zz));
      }
      pts.push(new THREE.Vector3(sd * 0.12, sheer(H, 0.99) + h, zAt(H, 0.985)));
      if (bay && sd === 1) {
        parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.slice(0, -1)), 20, 0.02, 5), color: steel });
        bay.push({ geo: new THREE.TubeGeometry(new THREE.LineCurve3(pts.at(-2), pts.at(-1)), 4, 0.02, 5), color: steel });
      } else parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.02, 5), color: steel });
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
      // (The gauges, the screen, the switches and the throttles are the dashboard's: see dashboard.js.)
      { geo: new THREE.BoxGeometry(0.8, 0.32, 0.02), matrix: mat(hx, y0 + 1.18, cz + 0.2, -0.3, 0, 0), color: '#9fb4bf' },
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
    if (DASHES[this.kind]) this.dash = new Dashboard(this);
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
    if (this.hull.rib) return this.buildRibConsole();
    const H = this.hull, y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.75;
    const steel = '#c9cdd0', V = (x, y, z) => new THREE.Vector3(x, y, z);
    const pz = hz - 0.42, ty = y0 + 2.15;
    const parts = [
      { geo: new THREE.BoxGeometry(0.8, 1.0, 0.66), matrix: mat(hx, y0 + 0.5, cz), color: H.paint },
      { geo: new THREE.BoxGeometry(0.76, 0.04, 0.3), matrix: mat(hx, y0 + 0.98, cz - 0.22, -0.5, 0, 0), color: '#2b2e33' },
      // (The screen, the gauges, the switches and the throttle are the dashboard's: see dashboard.js.)
      { geo: new THREE.BoxGeometry(0.86, 0.36, 0.02), matrix: mat(hx, y0 + 1.2, cz - 0.02, -0.35, 0, 0), color: '#9fb4bf' },
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
    const bay = this.trollMount?.railGap ? [] : null;
    this.bowRails(parts, H.rails, 0.55, bay);
    if (bay?.length) {
      this.railBay = new THREE.Mesh(mergeParts(bay), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.12 }));
      this.body.add(this.railBay);
    }
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.12 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    this.buildWheel(hx, y0 + 1.03, hz + 0.36, -0.6);
    if (DASHES[this.kind]) this.dash = new Dashboard(this);
  }

  // A RIB's tubes: one along each side and round the bow, the two meeting in a pointed nose with a
  // towing eye; their ends running out past the transom and tapering to rounded cones; a broad
  // black rubbing strake round the outside, low; a grab line along the top on D-ring patches.
  buildTubes() {
    const H = this.hull, T = H.tubes, r = T.r, V = (p) => new THREE.Vector3(p[0], p[1], p[2]);
    const t0 = -0.02, nose = tubeCentre(H, T.t1, 1);
    // The centreline of the tube: port side forward, round the nose, starboard side aft.
    const side = (sd, from, to, step) => {
      const q = [];
      for (let t = from; sd < 0 ? t <= to + 1e-6 : t >= to - 1e-6; t += step) q.push(V(tubeCentre(H, t, sd)));
      return q;
    };
    const tip = new THREE.Vector3(0, nose[1] + r * 0.35, zAt(H, 1) + r * 0.55);
    const pts = [...side(-1, t0, T.t1, 0.03), tip, ...side(1, T.t1, t0, -0.03)];
    const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
    const parts = [{ geo: new THREE.TubeGeometry(curve, 200, r, 22), color: T.color, jitter: 0 }];
    // The cones: the tube running on past the transom, tapering, with a rounded end.
    const coneLen = r * 1.9;
    for (const sd of [1, -1]) {
      const c = tubeCentre(H, t0, sd);
      const prof = [];
      for (let i = 0; i <= 10; i++) {
        const u = i / 10, rr = r * (1 - 0.45 * u * u);
        prof.push(new THREE.Vector2(rr, -u * coneLen));
      }
      for (let i = 1; i <= 6; i++) {
        const a = (i / 6) * (Math.PI / 2), rr = r * 0.55;
        prof.push(new THREE.Vector2(rr * Math.cos(a), -coneLen - rr * 0.8 * Math.sin(a)));
      }
      // (Drawn from its rounded end back to the tube, so the lathe's faces look outward: drawn
      // the other way they face inward, and the cones vanish from outside.)
      const g = new THREE.LatheGeometry(prof.reverse(), 22).rotateX(Math.PI / 2);
      parts.push({ geo: g, matrix: mat(c[0], c[1], c[2]), color: T.color, jitter: 0 });
      // (The strake carries on round the cone a little way.)
      parts.push({ geo: new THREE.CylinderGeometry(0.055, 0.05, coneLen * 0.7, 6).rotateX(Math.PI / 2), matrix: mat(c[0] + sd * r * 0.82, c[1] - r * 0.45, c[2] - coneLen * 0.35), color: T.strake });
    }
    // Along the outside of the tube, round the nose: the rubbing strake low down, the grab line on top.
    const band = (dx, dy, rad, color, from, to, through = true) => {
      const q = [...side(-1, from, to, 0.04).map((v) => v.add(new THREE.Vector3(-r * dx, r * dy, 0)))];
      if (through) q.push(tip.clone().add(new THREE.Vector3(0, r * dy * 0.6, r * dx * 0.9)));
      q.push(...side(1, to, from, -0.04).map((v) => v.add(new THREE.Vector3(r * dx, r * dy, 0))));
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(q, false, 'centripetal'), 140, rad, 6), color, jitter: 0 });
    };
    band(0.93, -0.32, 0.06, T.strake, t0, T.t1);
    // (The grab line, sagging a little between its D-rings; the patches themselves.)
    for (const sd of [1, -1]) {
      const q = [];
      for (let t = 0.12; t <= 0.84 + 1e-6; t += 0.12) {
        const c = tubeCentre(H, t, sd);
        q.push(new THREE.Vector3(c[0] + sd * r * 0.28, c[1] + r * 0.98, c[2]));
        parts.push({ geo: new THREE.BoxGeometry(0.06, 0.02, 0.1), matrix: mat(c[0] + sd * r * 0.28, c[1] + r * 0.97, c[2]), color: T.strake });
        if (t < 0.84) {
          const n = tubeCentre(H, t + 0.06, sd);
          q.push(new THREE.Vector3(n[0] + sd * r * 0.42, n[1] + r * 0.82, n[2]));
        }
      }
      parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(q), 80, 0.011, 5), color: '#2b2f33', jitter: 0 });
    }
    // The towing eye on the nose, and a keel guard down the bow.
    parts.push({ geo: new THREE.TorusGeometry(0.05, 0.012, 6, 12), matrix: mat(0, tip.y - r * 0.4, tip.z + 0.02), color: '#c9cdd0' });
    const k0 = [];
    for (let t = 0.6; t <= 1.001; t += 0.05) k0.push(new THREE.Vector3(0, H.keel(t) - 0.01, zAt(H, t)));
    parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(k0), 20, 0.025, 5), color: '#2b2f33', jitter: 0 });
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.82, metalness: 0.02 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.tubes = true; // (what a new colour for her tubes recolours: see retube)
    this.body.add(mesh);
  }

  // A RIB's deck: the bow locker seat forward (a cushion on its lid), the stand-up console (the
  // wheel, the throttle and a screen on its face, a tall raked windscreen with a stainless rail
  // round it), the jockey seat behind it to lean on or straddle, and the stainless roll bar over
  // the stern with the all-round light, a whip aerial and rods in its holders.
  buildRibConsole() {
    const H = this.hull, y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.7;
    const steel = '#c9cdd0', V = (x, y, z) => new THREE.Vector3(x, y, z);
    const jz = hz - 0.5, az = zAt(H, 0.05), ah = 1.85;
    const bz0 = zAt(H, 0.66), bz1 = zAt(H, 0.76), bw = Math.min(hw(H, 0.66), hw(H, 0.76)) * 1.25;
    const parts = [
      // The console: white, a dark face, the screen and the throttle, a tall raked windscreen.
      { geo: new THREE.BoxGeometry(0.72, 1.02, 0.62), matrix: mat(hx, y0 + 0.51, cz), color: '#eeece6' },
      { geo: new THREE.BoxGeometry(0.68, 0.04, 0.3), matrix: mat(hx, y0 + 1.0, cz - 0.2, -0.5, 0, 0), color: '#2b2e33' },
      // (The screen, the gauges, the switches and the throttle are the dashboard's: see dashboard.js.)
      { geo: new THREE.BoxGeometry(0.76, 0.5, 0.02), matrix: mat(hx, y0 + 1.27, cz - 0.02, -0.28, 0, 0), color: '#a9bcc6' },
      { geo: new THREE.BoxGeometry(0.73, 0.05, 0.63), matrix: mat(hx, y0 + 0.86, cz), color: '#2b2e33' },
      // The jockey seat: a padded saddle with a back roll on a stainless pedestal, a box under it.
      { geo: new THREE.BoxGeometry(0.52, 0.42, 0.5), matrix: mat(hx, y0 + 0.21, jz), color: '#e6e2d8' },
      strut(V(hx, y0 + 0.42, jz), V(hx, y0 + 0.72, jz), 0.06, 0.06, steel),
      { geo: new THREE.BoxGeometry(0.46, 0.16, 0.66), matrix: mat(hx, y0 + 0.8, jz), color: '#2a2e33' },
      { geo: new THREE.BoxGeometry(0.46, 0.22, 0.12), matrix: mat(hx, y0 + 0.95, jz - 0.3), color: '#2a2e33' },
      ...[1, -1].map((sd) => strut(V(hx + sd * 0.25, y0 + 0.82, jz + 0.25), V(hx + sd * 0.25, y0 + 0.98, jz + 0.36), 0.012, 0.012, steel)),
      // The bow locker seat: a box across the bow with a cushion on its lid.
      { geo: new THREE.BoxGeometry(bw, 0.38, bz1 - bz0), matrix: mat(0, y0 + 0.19, (bz0 + bz1) / 2), color: '#e6e2d8' },
      { geo: new THREE.BoxGeometry(bw * 0.96, 0.09, (bz1 - bz0) * 0.96), matrix: mat(0, y0 + 0.43, (bz0 + bz1) / 2), color: '#2a2e33' },
      // The roll bar over the stern: two legs up from the deck inside the tubes, and the bar.
      ...[1, -1].map((sd) => strut(V(sd * (hw(H, 0.05) - 0.22), y0, az), V(sd * 0.62, y0 + ah, az + 0.3), 0.032, 0.032, steel)),
      ...[1, -1].map((sd) => strut(V(sd * (hw(H, 0.05) - 0.22), y0 + 0.9, az + 0.12), V(sd * (hw(H, 0.05) - 0.22), y0 + 0.9, az + 0.75), 0.02, 0.02, steel)),
      strut(V(-0.65, y0 + ah, az + 0.3), V(0.65, y0 + ah, az + 0.3), 0.034, 0.034, steel),
      { geo: new THREE.CylinderGeometry(0.05, 0.05, 0.12, 8), matrix: mat(0, y0 + ah + 0.1, az + 0.3), color: '#eae6da' },
      strut(V(0.45, y0 + ah, az + 0.3), V(0.5, y0 + ah + 1.4, az + 0.2), 0.008, 0.004, '#1d2125'),
    ];
    // The stainless rail round the windscreen's top and sides.
    const rail = [V(hx - 0.42, y0 + 0.9, cz + 0.24), V(hx - 0.42, y0 + 1.36, cz - 0.08), V(hx - 0.3, y0 + 1.55, cz - 0.16), V(hx + 0.3, y0 + 1.55, cz - 0.16), V(hx + 0.42, y0 + 1.36, cz - 0.08), V(hx + 0.42, y0 + 0.9, cz + 0.24)];
    parts.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rail), 40, 0.016, 6), color: steel, jitter: 0 });
    // Rods in the holders on the roll bar, and two in holders on the console's sides.
    for (const x of [-0.4, 0.4]) this.rackRod(parts, V(x, y0 + ah + 0.02, az + 0.27), V(x * 0.35, 1, -0.45), 1.8);
    for (const sd of [1, -1]) this.rackRod(parts, V(hx + sd * 0.38, y0 + 0.7, cz + 0.1), V(sd * 0.2, 1, -0.3), 1.75);
    const mesh = new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.12 }));
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.body.add(mesh);
    this.buildWheel(hx, y0 + 1.05, hz + 0.33, -0.6);
    if (DASHES[this.kind]) this.dash = new Dashboard(this);
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
    if (this._phys) {
      this._phys.v[0] *= 0.3;
      this._phys.v[2] *= 0.3;
      this._vx = this.vel.x;
      this._vz = this.vel.z;
    }
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
  // Her fittings from the Marine Works, to see (see shipyard.js): screens at the helm, a whip
  // aerial, a battery box, floodlights, a livewell, rod holders on the gunwale, a bimini top, a
  // heavier anchor on the bow, a bigger outboard. list: the fitting ids.
  setFits(list = []) {
    const key = [...list].sort().join(',');
    if (key === this.fitKey) return;
    this.fitKey = key;
    if (this.fitGroup) {
      this.fitGroup.traverse((o) => o.geometry?.dispose());
      this.fitGroup.removeFromParent();
    }
    const H = this.hull, g = (this.fitGroup = new THREE.Group()), parts = [];
    const has = (id) => list.includes(id);
    const y0 = H.floorY ?? 0.1, helm = H.standing?.helm, hx = helm ? helm[0] : 0, hz = helm ? helm[1] : (H.seatZ ?? -H.L * 0.25);
    const tOf = (z) => clamp((z + H.L / 2) / H.L, 0.02, 0.98);
    const V = (x, y, z) => new THREE.Vector3(x, y, z);
    const box = (w, h, d, x, y, z, color, rx = 0) => parts.push({ geo: new THREE.BoxGeometry(w, h, d), matrix: mat(x, y, z, rx, 0, 0), color });
    // (Screens on a little pod ahead of the helm: the sounder's and the plotter's.)
    const screen = (x, glow) => {
      box(0.24, 0.16, 0.04, x, y0 + 1.02, hz + 0.42, '#15181c', -0.5);
      box(0.2, 0.12, 0.005, x, y0 + 1.03, hz + 0.398, glow, -0.5);
    };
    // (A built hull has these built in: a bass boat's graphs on her console and her bow, her
    // livewell under her rear deck's hatch, her batteries below decks. See buildFormedHull.)
    const built = !!H.form;
    // (The cabin boat's wheelhouse: her screens on the back of the house below its windows, where
    // you see them from the tiller, facing aft; see buildWheelhouse.)
    const HB = this.houseBack;
    if (HB) {
      const x = (HB.window[0] + HB.window[1]) / 2, y = HB.window[2] - 0.2;
      for (const [id, sd, glow] of [['sonar', -1, '#1d4f9a'], ['plotter', 1, '#2f7a5a']]) {
        if (!has(id)) continue;
        box(0.24, 0.16, 0.04, sd * x, y, HB.z - 0.03, '#15181c');
        box(0.2, 0.12, 0.005, sd * x, y, HB.z - 0.052, glow);
      }
    }
    if (has('sonar')) {
      if (!built && !HB) screen(hx + 0.2, '#1d4f9a');
      box(0.14, 0.06, 0.2, 0.22, H.keel(0.03) + 0.04, zAt(H, 0.01) + 0.08, '#1b1d20');
    }
    if (has('plotter') && !built && !HB) screen(hx - 0.2, '#2f7a5a');
    if (has('vhf')) {
      const t = tOf(hz) + 0.04, x = -(hw(H, t) - 0.08);
      parts.push(strut(V(x, sheer(H, t), zAt(H, t)), V(x, sheer(H, t) + 2.3, zAt(H, t) - 0.15), 0.012, 0.005, '#f1efe8'));
    }
    if (has('battery') && !built) box(0.36, 0.24, 0.26, 0.28, y0 + 0.13, zAt(H, 0.12), '#24272b');
    if (has('livewell') && !built) {
      box(0.62, 0.36, 0.42, -0.26, y0 + 0.19, zAt(H, 0.3), '#f2f0ea');
      box(0.5, 0.03, 0.32, -0.26, y0 + 0.385, zAt(H, 0.3), '#d9d6cc');
    }
    if (has('holders')) {
      for (const sd of [1, -1]) for (const t of [0.16, 0.3]) {
        const x = sd * (hw(H, t) - 0.06), y = sheer(H, t), z = zAt(H, t);
        this.rackRod(parts, V(x, y - 0.12, z), V(sd * 0.35, 1, -0.55), 1.7);
      }
    }
    if (has('bimini')) {
      // (Its frame stands beside and behind the helm, out of your view ahead, on a boat you sit
      // at a console to steer (a built hull), the canopy reaching forward over the console; on
      // others, posts either side, behind you and ahead.)
      const t1 = tOf(hz - 0.55), t2 = tOf(hz + (built ? 0.05 : 0.75)), top = y0 + 1.95;
      for (const t of [t1, t2]) for (const sd of [1, -1]) parts.push(strut(V(sd * (hw(H, t) - 0.06), sheer(H, t), zAt(H, t)), V(sd * 0.7 * hw(H, t), top, zAt(H, t)), 0.016, 0.016, '#c9cdd0'));
      const w = 1.4 * Math.min(hw(H, t1), hw(H, t2)), z0 = zAt(H, t1) - 0.1, z1 = built ? hz + 0.85 : zAt(H, t2) + 0.1;
      box(w, 0.05, z1 - z0, 0, top + 0.02, (z0 + z1) / 2, '#2f4f63');
    }
    if (has('anchor')) box(0.16, 0.12, 0.3, 0, sheer(H, 0.97) + 0.07, zAt(H, 0.965), '#2a2c30');
    if (has('lights')) {
      // (Under the wheelhouse roof's overhang, shining aft over her cockpit; otherwise over the helm.)
      for (const sd of [1, -1]) {
        if (HB) {
          box(0.12, 0.08, 0.06, sd * 0.32, HB.top - 0.05, HB.z - 0.2, '#1d2125');
          box(0.1, 0.06, 0.005, sd * 0.32, HB.top - 0.05, HB.z - 0.232, '#fff6dc');
          continue;
        }
        box(0.12, 0.08, 0.06, sd * 0.32, y0 + 1.82, hz + 0.1, '#1d2125');
        box(0.1, 0.06, 0.005, sd * 0.32, y0 + 1.82, hz + 0.135, '#fff6dc');
      }
    }
    if (parts.length) g.add(new THREE.Mesh(mergeParts(parts), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.15 })));
    // The floods themselves: a light over the deck, off until it's dark (see setDeckLights).
    this.deckLight = null;
    if (has('lights')) {
      const L = (this.deckLight = new THREE.PointLight('#fff4dd', 0, 16, 1.6));
      if (HB) L.position.set(0, HB.top - 0.2, HB.z - 0.8);
      else L.position.set(0, y0 + 1.75, hz + 0.6);
      g.add(L);
    }
    // (The outboard as big as it is: one from the engine catalogue, see setMotor; both of a pair
    // alike.)
    const M = this.hull.motor || this.hull.outboard;
    for (const mg of this.motorGroups || []) mg.scale.setScalar(this.motorSpec?.scale ?? M?.scale ?? 1);
    this.body.add(g);
  }

  // The deck floodlights on or off (see setFits).
  // The bow trolling motor's mount for her (see trollmount.js), worked out once; null if she
  // can't take one.
  get trollMount() {
    if (this._trollMount === undefined) this._trollMount = canMount(this.kind) ? mountFor(this.kind, this.hull, floatDraft(this.base)) : null;
    return this._trollMount;
  }

  // The bow trolling motor's model, for her mount and the motor's kind (look: 'troll', 'trollgps'
  // or 'trollpro'). The parts that stay put: the mount plate (on the RIB, a raised platform on legs
  // over her tube nose), the bracket's cheeks and hinge, the shaft's rest, the power cable into the
  // deck. The parts that move (see updateTrollRig): the fall-away ramps and the stow/deploy lever;
  // the arm swinging on the hinge with the steering housing and the lock pin; the shaft sliding and
  // turning through the housing, with the lower unit (its fin, the transducer, the propeller) at
  // its foot and the control head on top, the depth collar on it and the coil cord down from the
  // head; on the GPS motor its lift-assist strut, on the high-thrust one its stow actuator.
  buildTroll(look = 'troll') {
    this.disposeTroll();
    const M = this.trollMount;
    if (!M) return;
    const L = TROLL_LOOKS[look] || TROLL_LOOKS.troll, big = L.big;
    const V3 = (a) => new THREE.Vector3(a[0], a[1], a[2]);
    const mt = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0.3 });
    const root = new THREE.Group();
    root.name = 'trolling motor';
    const C = V3(M.hinge), d0 = V3(M.d0), k = V3(M.k);
    const aft = new THREE.Vector3(d0.x, 0, d0.z).normalize();
    const yaw = Math.atan2(aft.x, aft.z);
    const st = [], metal = '#3b4046', steel = '#c9cdd0', by = M.base.y;
    // The mount plate, along the stowed shaft, its front at the hinge; the bracket's two cheeks up
    // to the hinge pin.
    const plateLen = M.platform === 'riser' ? M.base.len : 0.46, plateW = M.platform === 'riser' ? 0.34 : 0.26;
    const pc = C.clone().addScaledVector(aft, plateLen / 2 - 0.04).setY(by - 0.0125);
    st.push({ geo: new THREE.BoxGeometry(plateW, 0.025, plateLen), matrix: mat(pc.x, pc.y, pc.z, 0, yaw, 0), color: M.platform === 'riser' ? '#9aa1a7' : metal });
    for (const sd of [-1, 1]) {
      const c = C.clone().addScaledVector(k, sd * 0.07);
      st.push({ geo: new THREE.BoxGeometry(0.014, C.y - by + 0.04, 0.15), matrix: mat(c.x, (C.y + by) / 2, c.z + aft.z * 0.03, 0, yaw, 0), color: metal });
    }
    st.push(strut(C.clone().addScaledVector(k, -0.085), C.clone().addScaledVector(k, 0.085), 0.016, 0.016, steel));
    if (M.platform === 'riser') {
      // The RIB's platform: two legs on its inboard side down to her foredeck inside the tubes,
      // braced to each other and out under the plate (its outboard edge overhangs the tube, its
      // front stands out beyond the tube's nose).
      const L2 = M.base.legsTo.map((l) => ({ top: V3(l.top), foot: V3(l.foot) }));
      for (const l of L2) {
        st.push(strut(l.foot, l.top, 0.022, 0.02, steel));
        st.push({ geo: new THREE.CylinderGeometry(0.045, 0.045, 0.012, 10), matrix: mat(l.foot.x, l.foot.y + 0.006, l.foot.z), color: metal });
        // (A knee out under the plate's middle.)
        st.push(strut(l.top.clone().lerp(l.foot, 0.4), l.top.clone().addScaledVector(k, 0.15), 0.012, 0.012, steel));
      }
      st.push(strut(L2[0].top.clone().lerp(L2[0].foot, 0.55), L2[1].top.clone().lerp(L2[1].foot, 0.55), 0.012, 0.012, steel));
      st.push(strut(L2[0].top, L2[1].top, 0.016, 0.016, steel));
    }
    if (M.rest) {
      // The rest the stowed shaft lies in: a rubber-lined cradle on a short post.
      const top = V3(M.rest.at), foot = M.rest.foot;
      st.push(strut(new THREE.Vector3(top.x, foot, top.z), new THREE.Vector3(top.x, top.y - 0.035, top.z), 0.02, 0.016, steel));
      st.push({ geo: new THREE.BoxGeometry(0.09, 0.03, 0.06), matrix: mat(top.x, top.y - 0.035, top.z, 0, yaw, 0), color: '#1d2125' });
      for (const sd of [-1, 1]) st.push({ geo: new THREE.BoxGeometry(0.012, 0.05, 0.06), matrix: mat(top.x + k.x * sd * 0.04, top.y - 0.01, top.z + k.z * sd * 0.04, 0, yaw, 0), color: '#1d2125' });
    }
    // The power cable from the bracket, along the plate and down into the deck.
    {
      const a = C.clone().addScaledVector(aft, 0.12).setY(by + 0.01), b = C.clone().addScaledVector(aft, 0.32).setY(by + 0.008);
      const c = b.clone().addScaledVector(aft, 0.08).addScaledVector(k, -0.06).setY(by - 0.02);
      st.push({ geo: new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a, b, c]), 10, 0.009, 5), color: '#16181b', jitter: 0 });
    }
    if (L.actuator) {
      // The stow-and-deploy actuator: its motor housing on the mount, beside the hinge.
      const a = C.clone().addScaledVector(k, -0.12).addScaledVector(aft, 0.12);
      st.push({ geo: new THREE.BoxGeometry(0.09, 0.08, 0.2), matrix: mat(a.x, by + 0.04, a.z, 0, yaw, 0), color: '#2b2f33' });
    }
    const fixed = new THREE.Mesh(mergeParts(st), mt);
    fixed.castShadow = true;
    root.add(fixed);
    // The fall-away ramps: two plates the lower unit lies across stowed, hinged along their outer
    // edges, falling away as the latch lets go.
    const low0 = C.clone().addScaledVector(d0, -M.uStow);
    const ramps = [];
    const rampBasis = new THREE.Matrix4().makeBasis(aft, new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(aft, new THREE.Vector3(0, 1, 0)));
    for (const sd of [-1, 1]) {
      const g = new THREE.Group();
      g.position.copy(low0).addScaledVector(k, sd * 0.12).setY(by + 0.005);
      g.quaternion.setFromRotationMatrix(rampBasis);
      const plate = new THREE.Group();
      plate.add(new THREE.Mesh(mergeParts([
        { geo: new THREE.BoxGeometry(0.14, 0.012, 0.07), matrix: mat(0, 0.04, -sd * 0.03, sd * 0.55, 0, 0), color: '#1d2125' },
        { geo: new THREE.BoxGeometry(0.03, 0.05, 0.02), matrix: mat(0.08, 0.02, 0, 0, 0, 0), color: metal },
      ]), mt));
      g.add(plate);
      root.add(g);
      ramps.push({ plate, sd });
    }
    // The stow/deploy lever, on the outboard cheek.
    const lever = new THREE.Group();
    lever.position.copy(C).addScaledVector(k, 0.085);
    lever.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(k, new THREE.Vector3(0, 1, 0), new THREE.Vector3().crossVectors(k, new THREE.Vector3(0, 1, 0))));
    lever.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(0.012, 0.012, 0.14), matrix: mat(0.008, 0.02, 0.06), color: metal },
      { geo: new THREE.BoxGeometry(0.03, 0.025, 0.04), matrix: mat(0.008, 0.02, 0.13), color: L.trim },
    ]), mt));
    root.add(lever);
    // The arm on the hinge: x along the pin, y up the shaft, z the lower unit's straight-ahead.
    const arm = new THREE.Group();
    arm.position.copy(C);
    root.add(arm);
    arm.add(new THREE.Mesh(mergeParts([
      // The steering housing round the shaft, its motor to one side.
      { geo: new THREE.CylinderGeometry(0.052 * big, 0.052 * big, 0.12, 14), matrix: mat(0, 0.02, 0), color: L.housing },
      { geo: new THREE.BoxGeometry(0.07 * big, 0.08, 0.09), matrix: mat(0, 0.02, -0.07), color: L.housing },
      // The swing plates from the pin to the housing.
      ...[1, -1].map((sd) => ({ geo: new THREE.BoxGeometry(0.01, 0.1, 0.08), matrix: mat(sd * 0.06, 0.01, 0), color: metal })),
    ]), mt));
    const lockPin = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.06, 6).rotateZ(Math.PI / 2), mt);
    paint(lockPin.geometry, steel);
    lockPin.position.set(0, 0.06, 0.055);
    arm.add(lockPin);
    // The shaft and all that's on it: slides along the arm's y, turns about it.
    const slider = new THREE.Group();
    arm.add(slider);
    const spinner = new THREE.Group();
    slider.add(spinner);
    const S = M.shaft, pod = 0.062 * big;
    spinner.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.CylinderGeometry(0.017, 0.017, S - 0.05, 10), matrix: mat(0, (S + 0.05) / 2, 0), color: L.shaft },
      // The lower unit: the motor pod, its nose cone, the fin under it and the transducer's bump.
      { geo: new THREE.CapsuleGeometry(pod, 0.24 * big, 6, 14).rotateX(Math.PI / 2), matrix: mat(0, 0, 0.0), color: L.pod },
      { geo: new THREE.ConeGeometry(pod * 0.9, 0.08, 14).rotateX(Math.PI / 2), matrix: mat(0, 0, 0.19 * big), color: L.pod },
      { geo: new THREE.BoxGeometry(0.012, 0.1, 0.12), matrix: mat(0, -0.09, -0.03), color: L.pod },
      { geo: new THREE.SphereGeometry(0.03, 10, 8), matrix: mat(0, -pod * 0.75, 0.08, 0, 0, 0, 1, 0.6, 1.3), color: '#2b2f33' },
      { geo: new THREE.CylinderGeometry(0.024, 0.03, 0.06, 10), matrix: mat(0, 0.06, 0), color: L.pod },
      // The control head on top: its body, the sloped cover, a coloured band.
      { geo: new THREE.BoxGeometry(0.13 * big, 0.11, 0.2 * big), matrix: mat(0, S + 0.04, 0.02), color: L.head },
      { geo: new THREE.BoxGeometry(0.125 * big, 0.04, 0.17 * big), matrix: mat(0, S + 0.105, 0.0, -0.22, 0, 0), color: L.head },
      { geo: new THREE.BoxGeometry(0.135 * big, 0.018, 0.205 * big), matrix: mat(0, S + 0.0, 0.02), color: L.trim },
    ]), mt));
    // The depth collar, where it rests on the housing at the depth set (moved when the depth is).
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.035, 12), mt);
    paint(collar.geometry, L.trim);
    spinner.add(collar);
    // The propeller, aft of the pod: two weedless blades and a hub nut.
    const prop = new THREE.Group();
    prop.position.set(0, 0, -0.205 * big);
    prop.add(new THREE.Mesh(mergeParts([
      { geo: new THREE.BoxGeometry(0.2 * big, 0.04, 0.012), matrix: mat(0, 0, 0, 0, 0.35, 0.25), color: '#2b2f33' },
      { geo: new THREE.BoxGeometry(0.04, 0.2 * big, 0.012), matrix: mat(0, 0, 0, 0.35, 0, -0.25), color: '#2b2f33' },
      { geo: new THREE.ConeGeometry(0.02, 0.05, 8).rotateX(-Math.PI / 2), matrix: mat(0, 0, -0.03), color: '#9aa1a8' },
    ]), mt));
    spinner.add(prop);
    // The coil cord, from the head down to the housing: a spring of cable round the shaft, stretched
    // to fit as the shaft slides.
    // (A slim coiled cable hanging just aft of the shaft, not wound round it.)
    const helix = [];
    for (let i = 0; i <= 240; i++) {
      const a = (i / 240) * Math.PI * 2 * 26;
      helix.push(new THREE.Vector3(0.03 + Math.cos(a) * 0.011, i / 240, -0.032 + Math.sin(a) * 0.011));
    }
    const coil = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(helix), 480, 0.0035, 4), mt);
    paint(coil.geometry, '#16181b');
    slider.add(coil);
    // The lift-assist strut, from the mount to the arm (the GPS motor's).
    let assist = null;
    if (L.strut) {
      assist = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1, 8), mt);
      paint(assist.geometry, '#9aa1a8');
      root.add(assist);
    }
    for (const m of [fixed, lockPin, collar, coil, ...arm.children, ...spinner.children]) if (m.isMesh) m.castShadow = true;
    this.body.add(root);
    this.trollRig = { root, look, M, mt, ramps, lever, arm, slider, spinner, prop, collar, coil, assist, lockPin, aft, k, C };
  }

  // Her trolling motor, on her own mount (a motor handed to her with a plain one takes hers).
  trollHere() {
    const T = this.troll;
    if (T && this.trollMount && T.mech.mount !== this.trollMount) T.setMount(this.trollMount);
    return T;
  }

  disposeTroll() {
    const R = this.trollRig;
    if (!R) return;
    R.root.removeFromParent();
    R.root.traverse((o) => o.geometry?.dispose());
    R.mt.dispose();
    this.trollRig = null;
  }

  // The trolling motor's model, posed: your own motor's state (this.troll), or the state a
  // friend's game sends for theirs (this.trollView: { look, v, theta, steer, f, depthU }).
  updateTrollRig(dt) {
    const T = this.trollHere();
    // (On the bass boat, her first notches drive it too: then it's the lever's push and the helm's
    // steer that show.)
    const notch = T && this.bowNotch > 0 && T.deployed && T.mode === 'off';
    const view = T ? { look: T.tier, v: T.mech.v, theta: T.mech.angle(), steer: notch ? this.bowSteer || 0 : T.angle, f: notch ? 60 * this.bowNotch : T.f, depthU: T.mech.mount.uPivot + T.mech.depthWant } : this.trollView;
    if (this.railBay) this.railBay.visible = !(view && this.trollMount?.railGap);
    if (!view || !this.trollMount) {
      if (this.trollRig) this.trollRig.root.visible = false;
      return;
    }
    if (!this.trollRig || this.trollRig.look !== view.look) this.buildTroll(view.look);
    const R = this.trollRig;
    if (!R) return;
    R.root.visible = true;
    // (The head's turn, eased: a new steer from the helm, or a friend's over the network, swings it
    // round rather than snapping it.)
    R.steer = R.steer == null ? view.steer : dampAngle(R.steer, view.steer, 10, dt);
    const P = rigPose(R.M, view.v, view.theta, R.steer);
    _tx.set(P.k[0], P.k[1], P.k[2]);
    _ty.set(P.d[0], P.d[1], P.d[2]);
    _tz.crossVectors(_tx, _ty);
    _m4.makeBasis(_tx, _ty, _tz);
    R.arm.quaternion.setFromRotationMatrix(_m4);
    R.slider.position.y = -P.u;
    R.spinner.rotation.y = P.spin;
    R.lockPin.position.x = 0.05 * (1 - view.v.lock);
    for (const r of R.ramps) r.plate.rotation.x = r.sd * view.v.latch * 1.1;
    R.lever.rotation.x = -view.v.latch * 0.9;
    // (The depth collar sits on the housing when she's at the depth set: on the shaft, that's
    // where the housing is then.)
    R.collar.position.y = (view.depthU ?? P.u) + 0.08;
    const coilFrom = P.u + 0.08, coilTo = R.M.shaft - 0.04;
    R.coil.visible = coilTo - coilFrom > 0.05;
    R.coil.position.y = coilFrom;
    R.coil.scale.y = Math.max(0.05, coilTo - coilFrom);
    R.prop.rotation.z += dt * 38 * Math.min(1, (view.f || 0) / 60);
    if (R.assist) {
      // From a lug on the plate behind the hinge to one on the arm below the housing.
      _ta.copy(R.C).addScaledVector(R.aft, 0.3).setY(R.M.base.y + 0.02);
      _tb.set(P.C[0], P.C[1], P.C[2]).addScaledVector(_ty, -0.02).addScaledVector(_tz, -0.09);
      _tc.subVectors(_tb, _ta);
      const len = _tc.length();
      R.assist.position.copy(_ta).addScaledVector(_tc, 0.5);
      R.assist.quaternion.setFromUnitVectors(UP, _tc.normalize());
      R.assist.scale.set(1, len, 1);
    }
  }

  setDeckLights(on) {
    if (!this.deckLight) return;
    const want = on ? 3.2 : 0;
    if (this.deckLight.intensity !== want) this.deckLight.intensity = want;
  }

  setCabinLight(night, inside) {
    if (!this.cabinLight) return;
    const on = Math.max(night, inside ? 0.35 : 0);
    this.cabinLight.intensity = on * (inside ? 2.4 : 1.4);
    this.cabinLamp.material.color.set('#ffd28a').multiplyScalar(0.55 + 0.45 * on);
    this.cabinPanes?.material.color.setScalar(0.25 + 0.75 * (1 - night));
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
    // (A shove off with a hand on the pier: a steady push away for a moment, eased off. Sent off
    // along it, ahead or astern, you still push her bow or stern off it as she goes.)
    const T = this.tie, Q = T && PIERS[T.pier];
    let ox = 0, oz = 0;
    if (Q && Math.abs(nx * (T.x - clamp(T.x, Q.x0, Q.x1)) + nz * (T.z - clamp(T.z, Q.z0, Q.z1))) < 0.05) {
      ox = T.x - clamp(T.x, Q.x0, Q.x1);
      oz = T.z - clamp(T.z, Q.z0, Q.z1);
      const l = Math.hypot(ox, oz) || 1;
      ox /= l;
      oz /= l;
    }
    this.tie = null;
    this.shove = { x: nx, z: nz, ox, oz, t: 2 };
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
      rod.group.position.set(this.seatX + 0.05, this.seatY + 0.33, 0.34 + this.seatZ);
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
    if (!S) return out.set(this.seatX + across, this.seatY + up, this.seatZ + ahead);
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

  // Her physics hull (see hydro.js), made the first time she moves: a townsman's boat, placed by
  // hand each frame, never needs one.
  get phys() {
    if (!this._phys) {
      const H = this.hull, b = (this._phys = new HydroBody(hullModel(this.base)));
      b.windage = H.windage ?? 0.003;
      // (The wind gets its grip on her topsides, and higher on a cabin, a hardtop or a mast.)
      b.windageAt = [0, sheer(H, 0.5) + (H.sail ? 1.4 : H.cabin || H.console ? 0.7 : 0.15), 0.06 * H.L];
      b.place(this.pos.x, this.pos.z, this.heading, Math.max(waveHeight(this.pos.x, this.pos.z), this.restHeight(this.pos.x, this.pos.z, this.heading)));
      this.syncFromPhys();
    }
    return this._phys;
  }

  // Read her pose back from the physics: where she is, which way she heads, her pitch and roll,
  // how fast she goes. (The rest of the game reads these, as it always has.)
  syncFromPhys() {
    const b = this._phys, H = this.hull;
    b.updateR();
    const o = b.toWorld(ORIGIN, _w3);
    this.pos.set(o[0], 0, o[2]);
    this.heave = o[1] + H.draft;
    _qt.set(b.q[0], b.q[1], b.q[2], b.q[3]);
    _eu.setFromQuaternion(_qt, 'YXZ');
    // (The heading carries on round, never jumping at ±π.)
    this.heading += wrapAngle(_eu.y - this.heading);
    this.pitch = _eu.x;
    this.roll = _eu.z;
    this.vel.set(b.v[0], 0, b.v[2]);
    this.vy = b.v[1];
    this.omega = b.w[1];
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));
    this._vx = this.vel.x;
    this._vz = this.vel.z;
  }

  // far: a long way from anyone looking (the game says so). A boat lying still out there rests:
  // she rides the waves at her mooring without her whole hull being worked out, and wakes the
  // moment you come near or anything moves her. (far 'moored': not so far, but out of your way;
  // she rests there too if she's tied up or riding to her anchor, and has lain still a while.)
  update(dt, t, throttle, steer, lanternLevel, far = false) {
    const fishing = this.pose.fishing > 0.5;
    const phys = this.phys;
    // (What she carries beyond her own weight: her fittings, and the fuel in a long-range tank.
    // She sits lower and goes a little slower for it; her engine is no stronger.)
    phys.m0 ??= phys.m;
    phys.m = phys.m0 + (this.payload || 0);
    const b = phys, H = this.hull, m = b.m;
    if (dt <= 0) return;
    const still = Math.hypot(b.v[0], b.v[2]) < 0.15 && Math.abs(b.w[1]) < 0.05 && !throttle && !steer && !this.shove && !this.air && this.vel.x === this._vx && this.vel.z === this._vz;
    this._stillT = still ? (this._stillT || 0) + dt : 0;
    const rests = far === 'moored' ? (!!this.tie || this.anchor?.phase === 'set') && this._stillT > SETTLED : !!far;
    if (rests && still && !(this.anchor && this.anchor.phase !== 'set')) {
      this.rest(dt, t, lanternLevel);
      return;
    }
    if (this._resting) {
      // (Waking: afloat where she lay, as the water is now.)
      this._resting = false;
      b.place(this.pos.x, this.pos.z, this.heading, Math.max(waveHeight(this.pos.x, this.pos.z, t), this.restHeight(this.pos.x, this.pos.z, this.heading)));
    }
    // (Anything that nudged her speed since last frame, a hand on the gunwale or the edge of the
    // chart holding her back, nudges the hull.)
    if (this.vel.x !== this._vx || this.vel.z !== this._vz) {
      b.v[0] += this.vel.x - this._vx;
      b.v[2] += this.vel.z - this._vz;
    }
    this.fwd.set(Math.sin(this.heading), 0, Math.cos(this.heading));
    this.right.set(-Math.cos(this.heading), 0, Math.sin(this.heading));

    // The water moves (the current) and the air moves (the wind, gusts and all): she feels both
    // through her hull and topsides. Her speed through the water is what her motor, oars or sail
    // work against.
    const cs = currentScale();
    const cur = currentAt(this.pos.x, this.pos.z, 0);
    this.drift.set(cur.x * cs, 0, cur.z * cs);
    const air = windAt(this.pos.x, this.pos.z);
    const vf = (this.vel.x - this.drift.x) * this.fwd.x + (this.vel.z - this.drift.z) * this.fwd.z;
    // (The sail feels the air less her motion: mostly her way ahead; her leeway, slipping
    // sideways, takes only a little off it.)
    const vg = this.vel.x * this.fwd.x + this.vel.z * this.fwd.z, vs = this.vel.x * this.right.x + this.vel.z * this.right.z;
    const ax = air.x - this.fwd.x * vg - this.right.x * vs * 0.3, az = air.z - this.fwd.z * vg - this.right.z * vs * 0.3;
    b.thrusters.length = 0;
    b.forces.length = 0;
    b.ropes.length = 0;
    b.rudder = -steer;
    b.legDown = false;
    b.balance = 0;
    b.pitchBalance = 0;
    b.trimBias = 0;
    b.heelMoment = 0;
    b.current[0] = this.drift.x;
    b.current[1] = this.drift.z;
    b.wind[0] = air.x;
    b.wind[1] = air.z;
    const held = this.anchored || this.tie;
    let thrust = 0; // (what's pushing her on, as an acceleration: for the motor's sound and the wake)
    const M = H.motor || (this.outboardDown ? H.outboard : null);
    const E = H.emotor && this.emotorDown ? H.emotor : null;
    if (M || E) {
      // The throttle lever (throttle here) sets what the motor gives, a moment behind (see spool);
      // the leg tips up in shallow water. (On the bass boat, the first notches run the electric
      // motor at the bow instead: slow, silent, and happy in shallow water. The kayak's motor is
      // electric too, on its stern.)
      const p = this.pos;
      const lever0 = held ? 0 : throttle;
      const troll = !!M?.troll && lever0 > 0 && lever0 <= M.troll;
      // A dead motor (no petrol, or a flat battery for an electric one): an oar, slowly (the
      // kayak's paddle is always there instead: see the game).
      const dead = E ? this.kflat : troll ? this.flat : this.dry;
      // The engine room (see engine.js): with the engine stopped the lever does nothing (bar the
      // oar when the tank's dry, and the bass boat's electric motor, which has its own battery);
      // one of twin engines running gives half her push. Trim tips the push up or down and costs
      // speed when it's wrong; tilted right up the propeller's out of the water. (No engine room,
      // as on the townsfolk's boats or in a test: she runs and trims herself, as ever.)
      const sys = M && !troll && !dead ? this.engine : null;
      const share = sys ? runShare(sys) : 1;
      const TE = sys && !M.inboard && !M.jet ? trimEffect(sys, vf, this.trimAuto !== false) : null;
      // (The leg stays where it's trimmed or tilted, running or not: a dry tank doesn't drop it.)
      const legOf = M && !troll && this.engine && !M.inboard && !M.jet ? (TE || trimEffect(this.engine, vf, this.trimAuto !== false)) : null;
      this.legAngle = legOf ? legOf.angle : 0;
      this.intakeWet = TE ? TE.wet && !this.air : !this.air;
      const lever = share > 0 ? lever0 : 0;
      this.spool(dt, lever, troll || !!E);
      const pw = this.power;
      const depth = -solidHeight(p.x - this.fwd.x * H.L * 0.45, p.z - this.fwd.z * H.L * 0.45);
      const tilted = depth < (E || M).tilt && !troll;
      if (tilted && !this.tilted && lever > 0.05 && this.onShallow && !dead) this.onShallow();
      this.tilted = tilted;
      b.legDown = !!M && !M.inboard && !M.jet && !tilted && !TE?.out;
      if (dead) thrust = E ? 0 : pw * (pw > 0 ? 0.6 : 0.8);
      // (Her electric bow motor has to be down to push: see trollmount.js. A boat with no rig, the
      // townsfolk's or a test's, runs it as ever.)
      else if (troll) thrust = this.troll && this.trollMount && !this.troll.deployed ? 0 : 0.45 * (pw / M.troll);
      // (Her engine from the catalogue, if she has one: its push falls away at its limiter, past
      // the speed its propeller's pitched for. See engines.js.)
      else {
        const S = !E && this.motorSpec;
        thrust = (pw > 0 ? (S ? pushAt(S, vf) : (E || M).thrust) * pw : (S ? S.astern : (E || M).astern) * pw) * (tilted ? 0.22 : 1) * share * (TE ? TE.eff : 1);
      }
      const spin = troll || dead || E ? 0 : pw;
      this.propSpin += dt * (6 + Math.abs(spin) * 60) * Math.sign(spin || 1) * (Math.abs(spin) > 0.02 ? 1 : 0.1);
      this.bowNotch = troll && !dead ? Math.min(1, pw / 0.05) : 0;
      if (this.kayakProp) this.kayakProp.rotation.z += dt * (E && !dead ? 34 * pw : 0);
      // (Hands off the helm under way, the course held.) The helm itself goes over at a hand's
      // pace, and only a little way at speed: see helmTo.
      const hold = this.holdCourse(steer, !held && Math.abs(pw) > 0.02 && Math.abs(vf) > 0.6);
      const helm = this.helmTo(steer || -hold * (vf < 0 ? -1 : 1), dt, vf);
      b.rudder = -helm;
      // (Astride a jet ski you balance it with your weight; at the wheel of a fast boat, the
      // driver's trim keeps her from walking from chine to chine.)
      b.balance = M?.jet ? 0.8 : M ? 0.25 * smoothstep(4, 10, Math.abs(vf)) : 0;
      b.pitchBalance = M?.jet ? smoothstep(4, 8, Math.abs(vf)) : 0;
      // (And on a jet ski you lean into a turn, as on a motorbike, so her V carves round it
      // instead of skidding: as far over as the turn wants, up to thirty degrees or so.)
      b.trimBias = M?.jet ? clamp(-Math.atan((vf * this.omega) / G) * 0.9, -0.5, 0.5) : 0;
      // A planing V-hull at speed carves into a turn: she banks onto the inside of her V (the outer
      // side lifts, the inner digs in), rather than being shoved over outward the way a slow,
      // round-bilged boat is. carve: what share of a fully banked turn's angle (the one a motorbike
      // leans to, atan(v·ω / g)) she settles at, at full planing speed; held there as firmly as
      // the water holds her, which grows with her speed squared. (The slower boats lean as their
      // hulls and propellers take them.)
      if (H.carve && M && !M.jet && !dead) {
        const k = smoothstep(4.5, 10, Math.abs(vf));
        if (k > 0) {
          const bank = clamp(-Math.atan((vf * this.omega) / G) * H.carve, -0.3, 0.3) * k;
          b.trimBias = bank;
          b.balance = Math.max(b.balance, k * (0.6 + 0.012 * vf * vf));
        }
      } else if (M?.jet) b.balance = 0.8 + 0.01 * vf * vf;
      // (Out in the ocean's long swell, a skipper eases her back to what she'll take.)
      const gov = vf > this.vmax ? Math.exp(-(vf - this.vmax) * 2.5) : 1;
      // (Her momentum under way, see hydro.js surgeShare.)
      b.surge = M && !troll && !dead ? H.surge ?? 1 : 1;
      const f = thrust * b.m0 * gov;
      // Climbing onto the plane: through the hump (her speed about her own bow wave's, a Froude
      // number near one) her stern settles into the trough behind it and her bow rears up, then
      // she climbs over it and levels out on the plane. (H.hump: how far she rears, as a share of
      // her weight acting at her length; driven hard through it she rears more.)
      if (H.hump && !dead && !troll && !E && vf > 0.5) {
        const fn = vf / Math.sqrt(G * H.L), k = Math.exp(-(((fn - 0.85) / 0.32) ** 2)) * clamp(Math.abs(pw) * 3, 0, 1);
        if (k > 0.01) {
          const F = H.hump * m * G * k, cg = b.model.cg;
          b.forces.push({ f: [0, F, 0], p: b.toWorld([0, cg[1], zAt(H, 0.85)], [0, 0, 0]) }, { f: [0, -F, 0], p: b.toWorld([0, cg[1], zAt(H, 0.15)], [0, 0, 0]) });
        }
      }
      // A seaway slows her: meeting the seas, slamming and the propeller breaking out on the
      // crests all cost speed, the more the bigger the waves where she is (the bays' shelter
      // counts). Without it a fast boat would go quicker in a sea than in a calm.
      if (!dead && !troll && !E && Math.abs(vf) > 3) {
        const sh = shelterAt(this.pos.x, this.pos.z), Hs = conditions.sea.swell * sh[0] + conditions.sea.chop * sh[1];
        // (Only once she's going fast enough to slam: trolling and creeping along, waves cost little.)
        // (A four-bladed propeller grips better as she pitches through it: see engines.js.)
        const seaway = SEAWAY * ((Hs * Hs) / H.L) * vf * m * smoothstep(3, 9, Math.abs(vf)) * (1 - (this.motorSpec?.grip || 0));
        if (seaway) b.forces.push({ f: [-this.fwd.x * seaway, 0, -this.fwd.z * seaway], p: b.toWorld(b.model.cg, [0, 0, 0]) });
      }
      const keel0 = H.keel(0), stern = zAt(H, 0);
      if (dead) {
        // (An oar over the stern: a gentle push, a little steer.)
        b.thrusters.push({ p: [0, H.draft, stern + 0.2], d: dirAt(b.rudder * 0.5), f, vent: 0 });
      } else if (troll) {
        // The bow's electric motor pulls her along and swings her bow round on the spot: from its
        // propeller, where its rig has it, steered by turning its head.
        this.bowSteer = -b.rudder * 0.9;
        const R = this.troll && this.trollMount ? propAt(rigPose(this.trollMount, this.troll.mech.v, this.troll.mech.angle(), this.bowSteer)) : [0, H.keel(1) - 0.35, zAt(H, 0.97)];
        b.thrusters.push({ p: R, d: dirAt(this.bowSteer), f, vent: 0.08 });
      } else if (E) {
        // The kayak's: a fixed push from its stern; its little rudder steers (once she has way on).
        b.thrusters.push({ p: [0, H.keel(0.02) - 0.18, zAt(H, 0.02)], d: [0, 0, 1], f, vent: 0.05 });
      } else if (M.jet) {
        // A jet: it steers by turning its nozzle, so it only turns while it's pushing.
        b.thrusters.push({ p: [0, keel0 - 0.03, stern + 0.3], d: dirAt(b.rudder * 0.55), f, vent: 0.04 });
      } else if (M.inboard) {
        // Twin screws under her stern, rudders behind them; slow, one ahead and one astern bring
        // her round on the spot (the skipper easing the inside one back as far as it balances the
        // other, so she turns where she is rather than going on).
        const tw = M.twin ?? 0.4, slow = 1 - clamp(Math.abs(vf) / 3, 0, 1);
        const diff = dead ? 0 : helm * slow * m * 2.5;
        const ahead = f * (1 - Math.abs(helm) * slow * 0.9);
        for (const sd of [1, -1]) {
          b.thrusters.push({ p: [sd * tw, keel0 - 0.22, stern + 0.45], d: [0, 0, 1], f: ahead / 2 - sd * diff, vent: 0.1,
            foil: { p: [sd * tw, keel0 - 0.3, stern + 0.25], d: dirAt(b.rudder * 0.6), area: 0.16, disk: 0.35 } });
        }
      } else {
        // Outboards: the whole motor turns with the tiller (or the wheel), so the push turns her.
        const tw = M.twin ?? 0, legs = tw ? [tw, -tw] : [M.side || 0];
        const slow = M.twin ? 1 - clamp(Math.abs(vf) / 3, 0, 1) : 0;
        // (Trimmed out of true, the push tips down, lifting her bow; trimmed in, up, pressing it down.)
        const tip = TE ? (TE.err * Math.PI) / 180 : 0, ct = Math.cos(tip);
        for (const x of legs) {
          const diff = M.twin && !dead ? -Math.sign(x) * helm * slow * m * 1.2 : 0;
          const d = dirAt(b.rudder * 0.7);
          if (tip) d.splice(0, 3, d[0] * ct, -Math.sin(tip), d[2] * ct);
          b.thrusters.push({ p: [x, keel0 - 0.28, stern - 0.18], d, f: f / legs.length + diff, vent: 0.1, lever: PROP_LEVER });
        }
      }
    } else if (H.rig) {
      // The windsurf board: the same sail (sailing.js) on a small rig and a light board, its pull
      // coming down through the mast foot and your feet. Fast enough it planes and slips away;
      // held overpowered too long (hauled in hard in a gust) and you're catapulted in; a few
      // seconds later you're back on and pulling the rig up. You steer by raking the rig: forward
      // to bear away, back to head up.
      this.power = 0;
      const down = this.fallen > 0;
      const A = (this.sailing = sailForce(ax, az, this.fwd.x, this.fwd.z, this.right.x, this.right.z, this.sheet, this.sailing || {}, H.rig));
      // (Trimmed right and hit by a gust, or surfing down a wave face with the wind coming ahead,
      // you open the rig a touch and spill the excess; hauled in hard, you can't.)
      const trimmed = A.alpha <= SAIL.best + 0.12;
      const spill = trimmed && A.pull > 10 ? (10 + (A.pull - 10) * 0.35) / A.pull : 1;
      this.rigPull = A.pull * spill;
      thrust = held || down ? 0 : A.drive * spill;
      const lateral = held || down ? 0 : A.lateral * spill;
      // (Raked so its pull sits over the fin and the board's own grip, the board runs straight;
      // see the steering below.)
      if (thrust || lateral) b.forces.push({ f: [(this.fwd.x * thrust + this.right.x * lateral) * m, 0, (this.fwd.z * thrust + this.right.z * lateral) * m], p: b.toWorld([0, H.floorY + 0.1, zAt(H, 0.2)], [0, 0, 0]) });
      b.balance = down ? 0 : 1;
      // (And fore and aft, your feet working the board over the chop.)
      b.pitchBalance = down ? 0 : smoothstep(2, 5, Math.abs(vf));
      // (Not steering, you hold your line, raking the rig against any turn.)
      const hold = this.holdCourse(steer, !down && !held);
      if (hold) b.forces.push(...yawCouple(b, -hold * m * 6));
      // (Raking the rig takes a moment, and at speed a little rake goes a long way.)
      const rake = this.helmTo(down ? 0 : steer, dt, vf);
      if (!down && rake) {
        const bite = 0.3 + 0.9 * clamp(Math.abs(vf) / 4, 0, 1);
        const tq = rake * bite * H.turn * (vf < -0.3 ? -1 : 1) * m * 0.9;
        b.forces.push(...yawCouple(b, tq));
      }
      this.planing = damp(this.planing, smoothstep(3.2, 4.6, Math.abs(vf)), 2, dt);
      if (down) {
        this.fallen = Math.max(0, this.fallen - dt);
        if (!this.fallen) {
          this.standLegs(this.sailSide || 1);
          this.onUp?.(this);
        }
      } else if (!held) {
        // (More than you can hang on to: hauled in past its best in a strong wind, or simply a
        // gale in the sail. Eased to its best angle it's held in anything short of that.)
        const over = (A.pull > 7 && !trimmed) || this.rigPull > 13;
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
      // drives her on and pushes her sideways, high up the mast, so she heels; the centreboard
      // grips the water against the push, you sit out against the heel, and the rudder bites
      // with way on. Stopped head to wind, nothing drives her: she falls off one way or the other.
      this.power = 0;
      const A = (this.sailing = sailForce(ax, az, this.fwd.x, this.fwd.z, this.right.x, this.right.z, this.sheet, this.sailing || {}));
      // (Hard pressed, heeling past fifteen degrees or so, you spill wind from the sail in the
      // gusts, easing the sheet a touch and feathering up, rather than let her lie over.)
      // (And with the helm hard over against her griping up, you ease the sheet till she answers.)
      // (Trimming by hand, nobody eases it for you but you: you still sit out and feather her a
      // little, but the sheet stays where you hold it.)
      const feather = this.sheetHelp ? 1 : 0.75, ease = this.sheetHelp ? 1 : 0.25;
      const spill = (1 - 0.7 * feather * smoothstep(0.26, 0.5, Math.abs(this.roll))) * (1 - 0.6 * ease * smoothstep(0.6, 1, Math.abs(this._holding || 0)));
      thrust = held ? 0 : A.drive * this.reef * spill;
      const lateral = held ? 0 : A.lateral * this.reef * spill;
      if (thrust || lateral) {
        const S = H.sail;
        b.forces.push({ f: [(this.fwd.x * thrust + this.right.x * lateral) * m, 0, (this.fwd.z * thrust + this.right.z * lateral) * m], p: b.toWorld([0, SAIL_CE_Y, zAt(H, S.mast) - SAIL_CE_AFT], [0, 0, 0]) });
      }
      // Helm amidships, you still hold her course: little touches of the tiller against her
      // turning (the sail and her heel both want to swing her one way or the other).
      // (Only while the sail draws: in irons, or through the wind mid-tack, she's let fall off.)
      // (Through the wind and the helm let go, you finish the tack, as anyone would: the tiller
      // kept over the way she was turning until the sail fills on the new side.)
      const fin = this._finish;
      let tiller = steer;
      if (fin && (steer || held || fin.t > 4 || (A.awa > 0.75 && A.state === 'drawing'))) this._finish = null;
      else if (fin) {
        fin.t += dt;
        tiller = fin.s * 0.8;
      }
      if (steer) this._lastSteer = { s: Math.sign(steer), t };
      const hold = this.holdCourse(steer, !held && !this._finish && A.state !== 'irons' && A.awa > 0.6 && (thrust > 0.05 || Math.abs(vf) > 0.5));
      this._holding = hold;
      if (hold) tiller = -hold;
      // Overpowered: laid right over in a gust with the sail still pulling hard, her rudder lifts
      // and draws air and loses its grip, and her heeled hull (the lee bow dug in, the weather
      // quarter lifted) and the sail's push, out over the water to leeward, swing her up into
      // the wind. She rounds up until the sail luffs and she stands up again; ease the sheet and
      // she won't. (Top speed is had trimmed right and sailed upright, not hauled in and laid over.)
      // (On the Helped trim, the hand besides yours eases her as she goes over: she barely gripes.)
      const over = smoothstep(0.48, 0.72, Math.abs(this.roll)) * smoothstep(0.25, 0.6, A.power) * smoothstep(0.8, 2, Math.abs(vf)) * (this.sheetHelp ? 0.25 : 1);
      this.overpowered = over;
      b.rudder = -this.helmTo(tiller, dt, vf) * (1 - 0.9 * over);
      if (over > 0.01 && !held) {
        // (Towards the wind: where it comes from, across her bow. The heeled hull's turning moment
        // grows with the square of her speed through the water, as any hull force does.)
        const wfx = -ax, wfz = -az, cross = this.fwd.z * wfx - this.fwd.x * wfz;
        if (Math.abs(cross) > 0.02) b.forces.push(...yawCouple(b, Math.sign(cross) * over * m * ROUND_UP * vf * vf));
      }
      // You sit out on the windward side against the heel, as far as a person can lean. (Once
      // she heels past five degrees or so: your weight, three-quarters of a metre out.)
      b.heelMoment = -Math.sign(this.roll) * smoothstep(0.08, 0.3, Math.abs(this.roll)) * CREW * G * 0.75;
      this.heel = this.roll;
      // Stopped in irons, you push the boom out against the wind (backing the sail) to make her
      // fall off: on the side you steer for, or else onto the tack she was going for.
      if (A.state === 'irons' && Math.abs(vf) < 0.6) {
        const backed = 0.5 * SAIL.rho * SAIL.area * A.speed * A.speed * 0.6 * 1.2;
        b.forces.push(...yawCouple(b, (steer ? Math.sign(steer) : A.side) * backed * smoothstep(0.6, 0.2, Math.abs(vf))));
      }
      // Tacking and gybing: the wind crosses the bow or the stern and the boom comes across.
      if (A.side !== this.sailSide) {
        if (A.awa > 1.9) this.onGybe?.(this, A);
        else {
          this.onTack?.(this, A);
          const ls = this._lastSteer;
          if (ls && t - ls.t < 0.6) this._finish = { s: ls.s, t: 0 };
        }
        this.sailSide = A.side;
      }
    } else {
      // Rowing (or paddling): each oar pulls at its oarlock as it goes through the water, the two
      // working against each other to turn her; a paddle pulls on one side and then the other.
      this.power = 0;
      if (H.sail) this.heel = this.roll;
      const rowing = (throttle !== 0 || steer !== 0) && !held;
      // (Sat low in a kayak, you keep her upright with your hips as the chop rolls under her.)
      if (H.paddle) b.balance = 0.06;
      if (rowing) this.phase += dt * Math.PI * 2 * H.rate;
      const pull = held ? 0 : throttle;
      // (Pulling straight, a little more on one oar keeps her straight.)
      const hold = this.holdCourse(steer, !held && Math.abs(pull) > 0.05);
      const turn = held ? 0 : steer || -hold * 0.6 * Math.sign(pull);
      if (H.paddle) {
        const sn = Math.sin(this.phase), side = sn >= 0 ? 1 : -1;
        const e = clamp(pull + (side > 0 ? -turn : turn) * 0.85, -1, 1);
        const pulse = rowing ? 0.5 + 0.5 * Math.abs(sn) : 0;
        const fz = (e > 0 ? H.pull : H.back) * pulse * e * m;
        thrust = H.pull * pulse * pull;
        if (fz) b.thrusters.push({ p: [side * 0.42, H.draft * 0.5, H.seatZ + 0.35], d: [0, 0, 1], f: fz, vent: 0 });
      } else {
        const sw = Math.max(0, Math.sin(this.phase)), pulse = rowing ? 0.5 + 0.5 * sw : 0;
        const z = this.hull.oars ? zAt(H, OAR_T) : 0, x = hw(H, OAR_T) + 0.02;
        for (const side of [1, -1]) {
          const e = clamp(pull + (side > 0 ? -turn : turn) * 0.85, -1, 1);
          const fz = (e > 0 ? H.pull : H.back) * pulse * e * m * 0.5;
          if (fz) b.thrusters.push({ p: [side * x, sheer(H, OAR_T), z], d: [0, 0, 1], f: fz, vent: 0 });
        }
        thrust = H.pull * pulse * pull;
      }
    }
    // (Fishing without a motor running, you take your hands off the oars and she settles.)
    if (fishing && !this.power) {
      const k = 0.9 * m;
      b.forces.push({ f: [-(this.vel.x - this.drift.x) * k, 0, -(this.vel.z - this.drift.z) * k], p: b.x });
    }
    // The open sea goes on forever: near the edge of the map, a gentle current eases you back.
    const edge = edgePush(this.pos);
    if (edge.x || edge.z) b.forces.push({ f: [edge.x * 0.5 * m, 0, edge.z * 0.5 * m], p: b.x });
    if (this.anchor) this.holdAnchor(dt, steer);
    if (this.tie) this.holdTie(dt);
    if (this.shove) {
      const S = this.shove, want = 0.75 * Math.min(1, S.t / 1.2), along = this.vel.x * S.x + this.vel.z * S.z;
      if (along < want) b.forces.push({ f: [S.x * m * 1.6, 0, S.z * m * 1.6], p: b.x });
      const off = this.vel.x * S.ox + this.vel.z * S.oz;
      if ((S.ox || S.oz) && off < want * 0.7) b.forces.push({ f: [S.ox * m * 1.6, 0, S.oz * m * 1.6], p: b.x });
      S.t -= dt;
      if (S.t <= 0) this.shove = null;
    }

    // The water she floats on, sampled for her hull this frame (see conditions.js waveSampler),
    // and everything she might touch.
    this._ws = waveSampler(this.pos.x, this.pos.z, this._ws);
    // (And other boats' wakes running past her: see wakes.js.)
    this._wk = wakes.context(this, this.pos.x, this.pos.z, t, H.L, this._wk);
    const env = (this._env ||= {
      t: 0,
      water: (x, z, tt, o) => {
        sampleWaves(this._ws, x, z, tt, o);
        if (this._wk.length) wakes.sample(this._wk, x, z, tt, o);
        return o;
      },
      ground: solidHeight,
      contact: null,
    });
    // A bow trolling motor (see trolling.js): its push under the bow, the way its head points. (It
    // lifts out in a big sea as her bow does, and pushes nothing while it's out: vent.)
    // (At its propeller, wherever her mount puts it: off to starboard, forward of her bow.)
    if (this.trollHere()?.f > 0 && this.troll.deployed && this.trollMount) {
      const T = this.troll, P = rigPose(this.trollMount, T.mech.v, T.mech.angle(), T.angle);
      b.thrusters.push({ p: propAt(P), d: dirAt(T.angle), f: T.f, vent: 0.12 });
    }
    env.t = t - dt;
    this.lastT = t;
    this.lastSeq = ++SEQ.n;
    env.contact = this.nearby(t) ? this._touch : null;
    const wasAir = this.air, airVy = this.vy;
    b.step(dt, env);
    this.syncFromPhys();
    this.forwardSpeed = (this.vel.x - this.drift.x) * this.fwd.x + (this.vel.z - this.drift.z) * this.fwd.z;
    this.thrustNow = thrust;
    // Her own wake, left behind her.
    // (With the white water her propeller churns up: how hard it's working, prop or jet.)
    if (!this.air) wakes.trail(this, this.pos.x, this.pos.z, this.fwd.x, this.fwd.z, this.forwardSpeed, t, b.m, H.L, H.L / Math.cbrt(b.m / RHO), Math.min(1, Math.abs(this.power) * 1.2), H.B);
    // How hard her bow is meeting the water just now (m/s down into it), for the spray.
    {
      const bp = b.toWorld([0, H.draft, zAt(H, 0.88)], _w3);
      b.pointVel(bp, _w4);
      this.slam = bp[1] < waveHeight(bp[0], bp[2], t) + 0.12 ? Math.max(0, -_w4[1]) : 0;
    }
    // Clear of the water (a jet ski off a crest): in the air, and the smack of landing.
    this.air = b.dryT > 0.06;
    if (wasAir && !this.air && -airVy > 1) this.onLand?.(this, -airVy);
    if (!this.air) this._airVy = 0;
    // Knocks and scrapes: against a pier, another boat or the bottom.
    this.bumpCooldown -= dt;
    if (b.impact > 1.2 && this.bumpCooldown <= 0) {
      this.onBump?.(b.impact);
      this.bumpCooldown = 0.6;
      b.impact = 0;
    }
    this.grounded = b.grounded;
    if (b.scrape > 0.3 && b.grounded > 0) this.onScrape?.(b.scrape, b.grounded);

    this.group.position.set(this.pos.x, this.heave - H.draft, this.pos.z);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.roll;

    this.animate(dt, t, throttle, steer, lanternLevel);
    this.group.updateMatrixWorld(true);
    this.updateGear();
  }

  // Hands off the helm while she's being driven, you still hold the heading you let go at: the
  // little corrections anyone at a tiller, a wheel or a pair of oars makes without thinking.
  // Returns the correction (-1 … 1, + to starboard), or 0 when you're steering yourself.
  // Out on the water this moment, though not worked out here (a townsperson's boat, a friend's):
  // other boats feel her as solid, and bump off her.
  afloat(t) {
    this.lastT = t;
    this.lastSeq = ++SEQ.n;
  }

  // Resting, far off: she lies where she is, lifted and tipped by the waves under her, no more.
  rest(dt, t, lanternLevel) {
    const H = this.hull, p = this.pos, f = this.fwd, r = this.right, L2 = H.L * 0.4, B2 = Math.max(0.3, H.B * 0.9);
    const hm = waveHeight(p.x, p.z, t);
    const hb = waveHeight(p.x + f.x * L2, p.z + f.z * L2, t), hs = waveHeight(p.x - f.x * L2, p.z - f.z * L2, t);
    const hp = waveHeight(p.x + r.x * B2, p.z + r.z * B2, t), hq = waveHeight(p.x - r.x * B2, p.z - r.z * B2, t);
    const k = 1 - Math.exp(-dt * 3);
    this.heave += ((hm + hb + hs) / 3 + H.draft - floatDraft(this.base) - this.heave) * k;
    this.pitch += (Math.atan2(hs - hb, 2 * L2) - this.pitch) * k;
    this.roll += (Math.atan2(hq - hp, 2 * B2) * 0.8 - this.roll) * k;
    this.vel.set(0, 0, 0);
    this._vx = this._vz = 0;
    this.forwardSpeed = 0;
    this.omega = 0;
    this._resting = true;
    this.lastT = t;
    this.group.position.set(p.x, this.heave - H.draft, p.z);
    this.group.rotation.y = this.heading;
    this.body.rotation.x = this.pitch;
    this.body.rotation.z = this.roll;
    this.animate(dt, t, 0, 0, lanternLevel);
    this.group.updateMatrixWorld(true);
    this.updateGear();
  }

  // The helm (tiller, wheel or the jet ski's bars) moves towards where you're steering at the pace
  // a hand turns it, not in an instant; and going fast you only ever put on a little of it (as
  // anyone driving a fast boat does: hard over at speed, a jet ski spins out and a skiff trips
  // over its chine). Returns where it is, -1 … 1 (+: to starboard, as steer).
  helmTo(want, dt, vf) {
    const H = this.hull, M = H.motor;
    // (How far over it goes at full speed, from what speed on, and how quickly it turns: bars
    // and tillers quickest, a big boat's wheel slowest.)
    const spec = M?.jet ? [0.5, 3, 13, 3.5] : M?.inboard ? [0.55, 2, 9, 1.6] : H.rig ? [0.5, 3, 9, 3] : H.cabin ? [0.3, 1.5, 5, 1.8] : H.wheel ? [0.3, 2, 8, 2.2] : M ? [0.3, 2, 8, 6] : [0.7, 1.5, 4, 3];
    const fast = smoothstep(spec[1], spec[2], Math.abs(vf));
    const most = 1 - (1 - spec[0]) * fast;
    const target = clamp(want, -1, 1) * most;
    // (Back towards amidships a little quicker than over: let go, and it comes back.)
    const rate = spec[3] * (Math.abs(target) < Math.abs(this.helm) ? 1.5 : 1);
    this.helm += clamp(target - this.helm, -rate * dt, rate * dt);
    if (Math.abs(this.helm) < 1e-4) this.helm = 0;
    return this.helm;
  }

  // Hands off the helm under way: you let her swing settle (a touch of opposite helm, no more),
  // then hold her on the course she settles on, rather than hauling her back to wherever she was
  // pointing when you let go. Returns a rudder angle (as b.rudder: + turns her to port).
  holdCourse(steer, driven) {
    if (Math.abs(steer) > 0.05 || !driven) {
      this._held = null;
      return 0;
    }
    if (this._held == null) {
      if (Math.abs(this.omega) > 0.06) return clamp(1.5 * this.omega, -0.6, 0.6);
      this._held = this.heading;
    }
    return clamp(1.6 * wrapAngle(this.heading - this._held) + 2 * this.omega, -0.8, 0.8);
  }

  // At anchor. The anchor goes down to the seabed (she drifts a little until it bites); then the
  // rope holds her bow: she drifts back on the wind and tide until it comes tight and lies there
  // head to it, swinging and riding the waves as they come (no more held than that: nothing pins
  // her in place). Hauling in shortens the rope, drawing her up over the anchor, and then it comes
  // up to the bow.
  holdAnchor(dt, steer) {
    const A = this.anchor, H = this.hull, b = this._phys;
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
    // The rope: from the fairlead at the bow to the anchor on the bottom, as long as what's paid
    // out (it lies along the bottom first, so the pull on her is nearly level), a little elastic
    // (nylon: it gives a few centimetres under a wave's snatch, and springs her back).
    const len = Math.hypot(Math.max(0.3, A.reach), bowY - A.floor);
    // (Moved far off her anchor by hand: it drags along the bottom after her.)
    const ad = Math.hypot(this.pos.x - A.x, this.pos.z - A.z), most = len + H.L + 4;
    if (ad > most) {
      A.x = this.pos.x + ((A.x - this.pos.x) * most) / ad;
      A.z = this.pos.z + ((A.z - this.pos.z) * most) / ad;
    }
    const m = b.m, k = m * 8, c = 2 * Math.sqrt(k * m) * 0.7;
    // In a real blow the anchor drags: once the steady pull on it (not a wave's snatch, which it
    // rides) passes what it holds, it ploughs slowly across the bottom after her. An ordinary
    // anchor holds through a gale, give or take, and drags in a storm; a heavier one on chain
    // (anchorHold: see the Marine Works) holds more than twice as hard.
    if (A.phase === 'set' && A.rope) {
      const pull = A.rope.out.tension || 0;
      A.steady = (A.steady ?? pull) + (pull - (A.steady ?? pull)) * Math.min(1, dt / 3);
      const hold = ANCHOR_HOLD * (this.anchorHold || 1) * m * G;
      const over = (A.steady - hold) / hold;
      if (over > 0 && ad > 0.5) {
        const v = Math.min(0.8, 0.5 * over) * dt;
        A.x += ((this.pos.x - A.x) / ad) * v;
        A.z += ((this.pos.z - A.z) / ad) * v;
        if (!A.dragging) this.onAnchor?.('drag', this);
        A.dragging = true;
      } else if (over < -0.15) A.dragging = false;
    }
    const to = (A.to ||= [0, 0, 0]);
    to[0] = A.x; to[1] = A.floor + 0.05; to[2] = A.z;
    const rope = (A.rope ||= { p: [this.fairlead.x, this.fairlead.y, this.fairlead.z], to, len, k, c, out: { tension: 0 } });
    rope.len = len;
    b.ropes.push(rope);
    const f = b.toWorld(rope.p, _w3);
    const d = Math.hypot(f[0] - A.x, f[1] - A.floor, f[2] - A.z);
    A.tension = clamp((d - len * 0.92) / (len * 0.08 + 0.15), 0, 1);
    // (Hands on the oars, you can still swing her a little on her rope.)
    if (steer) b.forces.push(...yawCouple(b, steer * m * 0.25));
  }

  // Tied up: a line from her bow and her stern to the pier hold her at her berth, lying along it
  // (eased in over a moment as they're made fast), nudged by the waves and the wind but going
  // nowhere.
  holdTie(dt) {
    const T = this.tie, b = this._phys, m = b.m;
    // (Moved off her berth by hand, too far for her lines to reach: they're let go.)
    if (Math.hypot(this.pos.x - T.x, this.pos.z - T.z) > this.hull.L + 6) {
      this.tie = null;
      return;
    }
    T.t += dt;
    const k = m * (T.t < 1.5 ? 2.5 : 6), c = 2 * Math.sqrt(k * m) * 0.9;
    const fx = Math.sin(T.heading), fz = Math.cos(T.heading);
    for (let i = 0; i < 2; i++) {
      const cl = this.cleats[i];
      const p = b.toWorld([cl.x, cl.y, cl.z], _w3);
      // Where this cleat lies when she's on her berth.
      const lx = cl.x, lz = cl.z;
      const tx = T.x + lx * fz + lz * fx, tz = T.z - lx * fx + lz * fz;
      b.pointVel(p, _w4);
      let fxw = (tx - p[0]) * k - _w4[0] * c, fzw = (tz - p[2]) * k - _w4[2] * c;
      // (Hauled in hand over hand: no line pulls harder than a person can.)
      const f = Math.hypot(fxw, fzw), most = m * 1.5 + 400;
      if (f > most) {
        fxw *= most / f;
        fzw *= most / f;
      }
      b.forces.push({ f: [fxw, 0, fzw], p: [p[0], p[1], p[2]] });
    }
  }

  // What's within reach of her hull this frame: piers and quays, and the other boats.
  nearby(t) {
    const r = this.hull.L * 0.6 + 2;
    const P = (this._piers ||= []), O = (this._others ||= []);
    P.length = 0;
    O.length = 0;
    for (const Q of PIERS) {
      if (this.pos.x > Q.x0 - r && this.pos.x < Q.x1 + r && this.pos.z > Q.z0 - r && this.pos.z < Q.z1 + r) P.push(Q);
    }
    for (const o of ALL) {
      // (Only boats out on the water with her just now: afloat, moved a moment ago, on the same clock.)
      if (o === this || !o.group.visible || SEQ.n - (o.lastSeq ?? -1e9) > 40 || !(Math.abs((o.lastT ?? -1e9) - t) < 0.5)) continue;
      const d = Math.hypot(o.pos.x - this.pos.x, o.pos.z - this.pos.z);
      // (Not one lying right on top of her: no two hulls ever get there, so it isn't really there.)
      if (d < r + o.hull.L * 0.6 && d > 0.3) O.push(o);
    }
    if (!this._touch) this._touch = (body, p) => this.touch(body, p);
    return P.length > 0 || O.length > 0;
  }

  // A point on her hull (world p) pressed into a pier or another boat: which way it's pushed out,
  // and how far it's in (null: it isn't).
  touch(body, p) {
    let best = null;
    const out = (this._tc ||= { nx: 0, ny: 0, nz: 0, pen: 0, k: 0, c: 0, mu: 0.25, vn: 0 });
    for (const Q of this._piers) {
      if (p[1] > Q.deck + 0.15) continue;
      if (p[0] < Q.x0 || p[0] > Q.x1 || p[2] < Q.z0 || p[2] > Q.z1) continue;
      const d0 = p[0] - Q.x0, d1 = Q.x1 - p[0], d2 = p[2] - Q.z0, d3 = Q.z1 - p[2];
      const pen = Math.min(d0, d1, d2, d3);
      if (best && pen <= best.pen) continue;
      out.nx = pen === d0 ? -1 : pen === d1 ? 1 : 0;
      out.nz = out.nx ? 0 : pen === d2 ? -1 : 1;
      out.ny = 0;
      out.pen = Math.min(pen, 0.5);
      // (Fenders over the side, tied up: a soft cushion.)
      out.k = body.m * (this.tie ? 60 : 500);
      out.c = 2 * Math.sqrt(out.k * body.m) * 0.35;
      out.mu = 0.3;
      out.vn = 0;
      best = out;
    }
    for (const o of this._others) {
      const H = o.hull;
      _v3.set(p[0], p[1], p[2]);
      o.body.worldToLocal(_v3);
      const tt = (_v3.z + H.L / 2) / H.L;
      if (tt < 0 || tt > 1) continue;
      const half = hw(H, tt) + 0.02;
      if (Math.abs(_v3.x) > half || _v3.y > sheer(H, tt) + 0.05 || _v3.y < H.keel(tt) - 0.05) continue;
      const pen = Math.min(half - Math.abs(_v3.x), 0.5);
      if (best && pen <= best.pen) continue;
      // Pushed out sideways from her centreline (or along her, off the very ends).
      const side = Math.sign(_v3.x) || 1;
      _v3.set(side, 0, 0).transformDirection(o.body.matrixWorld);
      out.nx = _v3.x; out.ny = 0; out.nz = _v3.z;
      const nl = Math.hypot(out.nx, out.nz) || 1;
      out.nx /= nl; out.nz /= nl;
      out.pen = pen;
      out.k = Math.min(body.m, o._phys ? o._phys.m : body.m) * 300;
      out.c = 2 * Math.sqrt(out.k * body.m) * 0.3;
      out.mu = 0.2;
      out.vn = o.vel.x * out.nx + o.vel.z * out.nz;
      best = out;
    }
    return best;
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
        // (A RIB's tubes are her fenders.)
        f.visible = !H.tubes;
        f.position.set(sx * (hw(H, t) + 0.06), sheer(H, t) - 0.22, zAt(H, t));
      }
    } else {
      for (const l of this.lines) l.hide();
      for (const f of this.fenders) f.visible = false;
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
    // Walking the deck (see walkDeck): you're where your feet have taken you, facing your line if
    // it's out, the way you're walking if not.
    if (this.deck) return this.placeOnDeck(fishing, dt);
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

  // Walking about the deck of a boat you stand in (the RIB, the centre console, the yacht): on
  // (true) at the wheel, or off. Where you are is in her own space, so you go where she goes.
  setDeck(on) {
    if (!this.hull.standing) return false;
    if (on && !this.deck) {
      // (From where you stand: at the wheel, or at the rail you've been fishing from.)
      const [hx, hz] = this.hull.standing.helm, A = this.standAt;
      this.deck = { x: A ? A.x : hx, z: A ? A.z : hz, yaw: A ? A.yaw : 0, step: 0, moving: 0 };
    } else if (!on) this.deck = null;
    return true;
  }

  // Where on her deck you can stand at z (her own space): inside her sides (the tubes, the
  // gunwales) and clear of the console or the wheelhouse. Returns the half-width there, or 0
  // off her ends.
  deckRoom(z) {
    const H = this.hull, t = (z + H.L / 2) / H.L;
    if (t < 0.06 || t > 0.9) return 0;
    const inside = H.tubes ? hw(H, t) - 0.05 : hw(H, t) - 0.22;
    return Math.max(0, inside * (t > 0.75 ? 1 - (t - 0.75) * 2.5 : 1));
  }

  // A step about the deck: (across, ahead) in her own space, metres; the console (or the
  // wheelhouse round the helm) is walked round, not through. Returns how far you went.
  walkDeck(across, ahead, dt) {
    const D = this.deck;
    if (!D) return 0;
    const H = this.hull, [hx, hz] = H.standing.helm;
    let nx = D.x + across, nz = D.z + ahead;
    // (Her ends and sides.)
    nz = clamp(nz, -H.L / 2 + H.L * 0.07, -H.L / 2 + H.L * 0.88);
    const room = this.deckRoom(nz);
    nx = clamp(nx, -room, room);
    // (The console, or the yacht's wheelhouse, ahead of the helm: round it, by whichever side is nearer.)
    const cx0 = hx - 0.42, cx1 = hx + 0.42, cz0 = hz + 0.3, cz1 = hz + (H.cabin || H.passage ? 2.6 : 1.15);
    if (nx > cx0 && nx < cx1 && nz > cz0 && nz < cz1) {
      if (D.z <= cz0 || D.z >= cz1) {
        // (Walking into its front or back: you sidestep along it towards the nearer side, and on round.)
        const step = Math.max(Math.abs(ahead), Math.abs(across)), edge = D.x < hx ? cx0 - 0.02 : cx1 + 0.02;
        nz = D.z;
        nx = clamp(D.x + clamp(edge - D.x, -step, step), -room, room);
      } else nx = nx < hx ? cx0 : cx1;
    }
    const went = Math.hypot(nx - D.x, nz - D.z);
    if (went > 1e-4) D.yaw = dampAngle(D.yaw, Math.atan2(nx - D.x, nz - D.z), 10, dt);
    D.x = nx;
    D.z = nz;
    D.moving = damp(D.moving, went / Math.max(dt, 1e-3) > 0.2 ? 1 : 0, 8, dt);
    D.step += went * 5.5;
    return went;
  }

  // Back at the wheel? (Near enough to take her again.)
  get atHelm() {
    const D = this.deck, S = this.hull.standing;
    return !D || Math.hypot(D.x - S.helm[0], D.z - S.helm[1]) < 0.5;
  }

  placeOnDeck(fishing, dt) {
    const D = this.deck, A = (this.standAt ||= { x: 0, z: 0, y: this.seatY, yaw: 0 });
    // (With a line out you turn to face it; otherwise the way you've been walking.)
    const yaw = fishing > 0.3 ? wrapAngle(this.pose.rodYaw) : D.yaw;
    A.x = D.x;
    A.z = D.z;
    A.y = this.seatY;
    A.yaw = dampAngle(A.yaw, yaw, 8, dt);
    const T = this.torso;
    T.rotation.order = 'YXZ';
    T.position.set(A.x, A.y + Math.abs(Math.sin(D.step)) * 0.025 * D.moving, A.z);
    T.rotation.y = A.yaw;
    // Walking: a stride either side; standing: feet a little apart, knees soft.
    const deck = this.hull.floorY + 0.04 - A.y, c = Math.cos(A.yaw), sn = Math.sin(A.yaw);
    for (const L of this.legs) {
      const stride = Math.sin(D.step + (L.s > 0 ? 0 : Math.PI)) * 0.22 * D.moving;
      this.fromYou(_a, L.s * 0.1, -0.02, 0.02);
      this.fromYou(_b, L.s * 0.12, deck / 2 + 0.02 + Math.max(0, stride) * 0.15, 0.09 + stride * 0.5);
      this.fromYou(_e, L.s * 0.14, deck + Math.max(0, stride) * 0.06, 0.02 + stride);
      setLimb(L.thigh, _a, _b, 0.07);
      setLimb(L.shin, _b, _e, 0.06);
      L.boot.position.set(_e.x + sn * 0.05, _e.y - 0.02, _e.z + c * 0.05);
      L.boot.rotation.set(0, A.yaw, 0);
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
    // The bow trolling motor: on its mount, swinging down into the water or up again, its head
    // turning (see trollmount.js, trolling.js).
    if (this.troll || this.trollView || this.trollRig) this.updateTrollRig(dt);
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
        // (Trimmed and tilted: the leg's angle, as the engine room has it, out and up behind the
        // transom (trimmed in, a little under her); kicked up in the shallows.)
        const a = ((this.legAngle || 0) * Math.PI) / 180, lean = this.tilted ? Math.max(0.5, a) : a;
        g.rotation.x = damp(g.rotation.x, lean, this.engine ? 5 : 3, dt);
      }
    } else if (this.motorGroup) {
      this.motorGroup.rotation.y = damp(this.motorGroup.rotation.y, 0, 4, dt);
      this.motorGroup.rotation.x = damp(this.motorGroup.rotation.x, 1.3, 3, dt);
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
      } else if (this.deck && !this.atHelm) {
        // Away from the wheel, walking the deck: arms at your sides, swinging as you walk.
        const sw = Math.sin(this.deck.step + (a.s > 0 ? Math.PI : 0)) * 0.12 * this.deck.moving;
        onOar = this.fromYou(_b, a.s * 0.24, 0.28, 0.04 + sw);
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
