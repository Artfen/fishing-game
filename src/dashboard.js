// The helm's dashboard as part of the boat (the RIB first, then the other consoles): the battery
// switch, the key, the kill cord and its lanyard, the glow plugs, the navigation lights and the
// horn as real things on the console that move when they're worked; the throttle lever, with its
// trim rocker, leaning with the lever; and the gauges and the chartplotter as screens that show
// the engine room as it is (see engine.js, the one engine there is: nothing here keeps its own).
//
// It's only the dashboard: it draws, it says what's under a ray (pick) and what's next to what
// (neighbour, for a controller), and the game does whatever a control is for (see dashcontrol.js
// and main.js).
//
// Coordinates: each dashboard is laid out on its console's face (DASHES), in the face's own frame:
// x across (to port +), z up the face away from the helmsman, y out of it.

import * as THREE from 'three';
import { PROFILES, TRIM } from './engine.js';
import { canTroll } from './trolling.js';

const KNOTS = 1.9438;
// (Controls a little larger to hit than they look.)
const HIT = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });

// What's on each kind of dashboard, and where (see the class for what each control does).
// face: the console's face in the boat's frame ([x, y, z], its tilt back, its width and depth);
// screen: the chartplotter's screen (raised on its own mount); throttle: the lever's box.
export const DASHES = {
  rib: (H) => {
    const y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.7;
    return {
      // (Raised a little clear of the console's top, tilted back towards the helm.)
      face: { at: [hx, y0 + 1.09, cz - 0.2], tilt: -0.45, w: 0.7, d: 0.3 },
      // Stood up on the face's far half: the chartplotter to port, the gauges to starboard.
      screen: { at: [0.17, 0.08], w: 0.3, h: 0.18, lean: 1.0 },
      gauges: { at: [-0.17, 0.08], w: 0.3, h: 0.15, lean: 1.0 },
      // On the near half, clear of the wheel: the switches to port, the ignition to starboard.
      switches: { battery: [0.28, -0.08], lights: [0.21, -0.08], horn: [0.14, -0.08], glow: [0.07, -0.08], key: [-0.15, -0.08], key0: [-0.12, -0.08], key1: [-0.19, -0.08], cord: [-0.25, -0.08] },
      // The throttle on its bracket on the console's starboard side.
      throttle: { at: [hx - 0.43, y0 + 0.95, cz - 0.2] },
      lights: { side: [[0.33, y0 + 0.92, cz + 0.28], [-0.33, y0 + 0.92, cz + 0.28]], stern: [0, y0 + 2.0, -H.L / 2 + 0.6] },
    };
  },
  // The yacht: twin diesels on the one pair of levers to port, glow plugs, no kill cord, no leg.
  cruiser: (H) => {
    const y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.72;
    return {
      face: { at: [hx, y0 + 1.06, cz - 0.17], tilt: -0.45, w: 0.76, d: 0.34 },
      screen: { at: [-0.19, 0.08], w: 0.3, h: 0.17, lean: 1.0 },
      gauges: { at: [0.08, 0.08], w: 0.26, h: 0.15, lean: 1.0 },
      switches: { battery: [0.12, -0.1], lights: [0.05, -0.1], horn: [-0.02, -0.1], glow: [-0.09, -0.1], key0: [-0.18, -0.1], key1: [-0.25, -0.1] },
      throttle: { at: [hx + 0.29, y0 + 1.04, cz - 0.11] },
      lights: { side: [[H.B - 0.15, y0 + 1.75, cz + 0.6], [-(H.B - 0.15), y0 + 1.75, cz + 0.6]], stern: [0, y0 + 2.3, -H.L / 2 + 0.5] },
    };
  },
  console: (H) => {
    const y0 = H.floorY, [hx, hz] = H.standing.helm, cz = hz + 0.75;
    return {
      face: { at: [hx, y0 + 1.07, cz - 0.22], tilt: -0.45, w: 0.78, d: 0.3 },
      // (Kept low enough to clear her windscreen.)
      screen: { at: [0.19, 0.05], w: 0.32, h: 0.165, lean: 1.1 },
      gauges: { at: [-0.19, 0.05], w: 0.34, h: 0.145, lean: 1.1 },
      switches: { battery: [0.32, -0.08], lights: [0.25, -0.08], horn: [0.18, -0.08], troll: [0.11, -0.08], lock: [0.05, -0.08], key: [-0.17, -0.08], key0: [-0.14, -0.08], key1: [-0.21, -0.08], cord: [-0.29, -0.08] },
      throttle: { at: [hx - 0.47, y0 + 0.93, cz - 0.22] },
      lights: { side: [[0.37, y0 + 0.88, cz + 0.3], [-0.37, y0 + 0.88, cz + 0.3]], stern: [0, y0 + 2.25, hz + 0.2 - 0.85] },
    };
  },
};

// The kinds of control: tap (once), hold (while pressed), lever (moved up and down).
const CONTROLS = {
  battery: { name: 'Battery switch', kind: 'tap' },
  key: { name: 'Ignition key', kind: 'hold' },
  cord: { name: 'Kill cord', kind: 'tap' },
  glow: { name: 'Glow plugs', kind: 'hold' },
  lights: { name: 'Navigation lights', kind: 'tap' },
  horn: { name: 'Horn', kind: 'hold' },
  screen: { name: 'Chartplotter', kind: 'tap' },
  throttle: { name: 'Throttle and gear', kind: 'lever' },
  trimUp: { name: 'Trim up', kind: 'hold' },
  trimDown: { name: 'Trim down', kind: 'hold' },
  troll: { name: 'Trolling motor', kind: 'tap' },
  lock: { name: 'Spot-Lock', kind: 'tap' },
};
export const CONTROL_NAMES = Object.fromEntries(Object.entries(CONTROLS).map(([k, v]) => [k, v.name]));

// What there is on a boat's dashboard: its engine room's switches, and what every dash has.
export function controlsFor(kind) {
  const P = PROFILES[kind];
  if (!P || !DASHES[kind]) return [];
  const out = [];
  if (P.battery) out.push('battery');
  if (P.starter === 'key') {
    if (P.engines > 1) for (let i = 0; i < P.engines; i++) out.push(`key${i}`);
    else out.push('key');
  }
  if (P.cord) out.push('cord');
  if (P.diesel) out.push('glow');
  out.push('lights', 'horn', 'screen', 'throttle');
  if (P.trim === 'power') out.push('trimUp', 'trimDown');
  // (The bow trolling motor's switches, on a boat that can take one: there only once it's fitted.)
  if (canTroll(kind) && DASHES[kind]) out.push('troll', 'lock');
  return out;
}
// What turning the key does (E: the engine room, see engine.js; which: an engine's index on twin
// engines; mode: the start-up setting). On the full procedure: 'key' (on, the gauges waking and
// testing their lamps), then 'start' (turned and held to start), and once she runs, 'stop'. On
// the one-button start, 'assist' (the same steps done for you) or 'stop'; on get in and go, 'go'
// (she runs whenever you're at the helm: nothing to do).
export function keyStep(E, which = null, mode = 'full') {
  if (mode === 'go') return 'go';
  const list = which == null ? E.engines : [E.engines[which]].filter(Boolean);
  const busy = list.some((e) => e.run || e.crank > 0);
  if (mode === 'simple') return busy || E.auto ? 'stop' : 'assist';
  if (!E.key) return 'key';
  return busy ? 'stop' : 'start';
}

// A control's own kind: 'key0' and 'key1' are keys.
export const baseOf = (id) => (/^key\d$/.test(id) ? 'key' : id);
export const whichOf = (id) => (/^key\d$/.test(id) ? Number(id[3]) : null);

const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.45, metalness: 0.15, ...extra });
const canDraw = () => typeof document !== 'undefined' && !!document.createElement;

export class Dashboard {
  // boat: a Boat (boat.js) with a console in DASHES.
  constructor(boat) {
    this.boat = boat;
    this.kind = boat.kind;
    this.L = DASHES[boat.kind](boat.hull);
    this.P = PROFILES[boat.kind];
    this.ids = controlsFor(boat.kind);
    this.controls = new Map(); // id -> { id, base, which, name, kind, group, hit, nav: [x, z], ring }
    this.group = new THREE.Group();
    this.group.name = 'dashboard';
    boat.body.add(this.group);
    const F = this.L.face;
    this.face = new THREE.Group();
    this.face.position.set(...F.at);
    this.face.rotation.x = F.tilt;
    this.group.add(this.face);
    this.anim = { battery: 0, key: [0, 0], cord: 1, lights: 0, horn: 0, lever: 0, trim: 0, glow: 0 };
    this.drawT = 0;
    this.lastKey = '';
    this.highlight = null;
    this.guide = null;
    this.build();
  }

  /* ---------- building ---------- */

  build() {
    const F = this.L.face;
    // The face itself: a dark panel the gauges stand on and the switches are set in.
    const panel = new THREE.Mesh(new THREE.BoxGeometry(F.w, 0.03, F.d), mat('#202327'));
    panel.position.y = -0.012;
    this.face.add(panel);
    this.buildGauges();
    this.buildScreen();
    this.buildThrottle();
    for (const id of this.ids) {
      const at = this.L.switches[id];
      if (at) this.buildSwitch(id, at[0], at[1], 0.004);
    }
    this.buildNavLights();
    // The rings that say what's picked (and, on the guided start, what's next).
    this.ring = this.makeRing('#ffd36a');
    this.guideRing = this.makeRing('#7fd8ff');
  }

  // A panel stood up on the face (the gauges, the chartplotter), leaning back towards the helm.
  board(spec) {
    const g = new THREE.Group();
    g.position.set(spec.at[0], 0, spec.at[1]);
    g.rotation.x = spec.lean;
    const box = new THREE.Mesh(new THREE.BoxGeometry(spec.w + 0.02, spec.h + 0.02, 0.03), mat('#111316'));
    box.position.set(0, spec.h / 2 + 0.01, 0.016);
    g.add(box);
    return g;
  }

  // A screen on a board: drawn on a canvas, read the right way up from the helm.
  screenOn(g, spec, w, h) {
    const cv = canDraw() ? Object.assign(document.createElement('canvas'), { width: w, height: h }) : null;
    const tex = cv ? new THREE.CanvasTexture(cv) : null;
    if (tex) tex.colorSpace = THREE.SRGBColorSpace;
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(spec.w, spec.h).rotateY(Math.PI), tex ? new THREE.MeshBasicMaterial({ map: tex, toneMapped: false }) : mat('#07080a'));
    plane.position.set(0, spec.h / 2 + 0.01, -0.0005);
    g.add(plane);
    return { cv, tex };
  }

  makeRing(color) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.0045, 6, 24).rotateX(Math.PI / 2), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95, depthTest: false }));
    r.renderOrder = 5;
    r.visible = false;
    this.group.add(r);
    return r;
  }

  // A control: its group (what moves) on the face (or on a mount), and a box to hit.
  add(id, group, at, hitSize, nav, parent = this.face) {
    group.position.set(...at);
    parent.add(group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(...hitSize), HIT);
    hit.userData.control = id;
    group.add(hit);
    const base = baseOf(id), C = CONTROLS[base];
    const c = { id, base, which: whichOf(id), name: C.name + (whichOf(id) != null ? (whichOf(id) ? ' (starboard engine)' : ' (port engine)') : ''), kind: C.kind, group, hit, nav };
    this.controls.set(id, c);
    return c;
  }

  buildSwitch(id, x, z, y) {
    const base = baseOf(id), g = new THREE.Group();
    const m = { dark: mat('#1b1d20'), steel: mat('#c9cdd0', { metalness: 0.6, roughness: 0.3 }), red: mat('#c4362c'), yellow: mat('#e8c33a'), black: mat('#0d0e10') };
    const add = (geo, material, px = 0, py = 0, pz = 0) => {
      const mesh = new THREE.Mesh(geo, material);
      mesh.position.set(px, py, pz);
      g.add(mesh);
      return mesh;
    };
    if (base === 'battery') {
      // A red rotary switch on a round plate: the bar across for off, along for on.
      add(new THREE.CylinderGeometry(0.03, 0.03, 0.006, 20), m.dark, 0, 0.003, 0);
      const knob = new THREE.Group();
      knob.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.02, 0.014, 16), m.red).translateY(0.012));
      knob.add(new THREE.Mesh(new THREE.BoxGeometry(0.046, 0.016, 0.01), m.red).translateY(0.024));
      g.add(knob);
      g.userData.knob = knob;
    } else if (base === 'key') {
      // The ignition: a steel barrel and the key in it, turning off, on and start.
      add(new THREE.CylinderGeometry(0.016, 0.018, 0.012, 16), m.steel, 0, 0.006, 0);
      const key = new THREE.Group();
      key.add(new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.004), m.steel).translateY(0.02));
      key.add(new THREE.Mesh(new THREE.BoxGeometry(0.022, 0.016, 0.006), m.black).translateY(0.04));
      key.add(new THREE.Mesh(new THREE.TorusGeometry(0.008, 0.002, 4, 10), m.steel).translateY(0.054));
      g.add(key);
      g.userData.key = key;
    } else if (base === 'cord') {
      // The kill switch: a red cap with the lanyard's clip on it, the coil hanging away.
      add(new THREE.CylinderGeometry(0.015, 0.017, 0.012, 14), m.black, 0, 0.006, 0);
      const clip = new THREE.Group();
      clip.add(new THREE.Mesh(new THREE.BoxGeometry(0.026, 0.008, 0.02), m.red).translateY(0.016));
      const coil = [];
      for (let i = 0; i <= 40; i++) {
        const u = i / 40, a = u * Math.PI * 14;
        coil.push(new THREE.Vector3(0.006 * Math.cos(a), 0.012 - u * 0.03, -0.012 - u * 0.09 + 0.006 * Math.sin(a)));
      }
      clip.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coil), 80, 0.0018, 4), m.red));
      g.add(clip);
      g.userData.clip = clip;
    } else if (base === 'glow') {
      // A push button with an amber lamp in it.
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.01, 14), m.dark, 0, 0.005, 0);
      g.userData.lamp = add(new THREE.CylinderGeometry(0.01, 0.01, 0.008, 14), mat('#5a3a10', { emissive: '#000000' }), 0, 0.012, 0);
    } else if (base === 'lights') {
      // A toggle: a little steel lever on a black boot, a green lamp beside it when they're on.
      add(new THREE.BoxGeometry(0.03, 0.006, 0.036), m.dark, 0, 0.003, 0);
      const lever = new THREE.Group();
      lever.add(new THREE.Mesh(new THREE.CylinderGeometry(0.003, 0.004, 0.026, 6), m.steel).translateY(0.013));
      g.add(lever);
      g.userData.lever = lever;
      g.userData.lamp = add(new THREE.SphereGeometry(0.004, 8, 6), mat('#0f3a12', { emissive: '#000000' }), 0.012, 0.006, 0.012);
    } else if (base === 'troll' || base === 'lock') {
      // The trolling motor's toggle (a blue lamp while it's down) and Spot-Lock's button (green).
      add(new THREE.CylinderGeometry(0.014, 0.014, 0.008, 14), m.dark, 0, 0.004, 0);
      g.userData.lamp = add(new THREE.CylinderGeometry(0.009, 0.009, 0.008, 14), mat(base === 'troll' ? '#10243a' : '#0f3a12', { emissive: '#000000' }), 0, 0.011, 0);
    } else if (base === 'horn') {
      // A big black push button.
      add(new THREE.CylinderGeometry(0.017, 0.017, 0.006, 16), m.dark, 0, 0.003, 0);
      g.userData.cap = add(new THREE.CylinderGeometry(0.013, 0.013, 0.01, 16), m.black, 0, 0.011, 0);
    }
    const nav = [x, z];
    return this.add(id, g, [x, y, z], [0.05, 0.05, 0.05], nav);
  }

  buildGauges() {
    const G = this.L.gauges, g = this.board(G);
    this.face.add(g);
    const { cv, tex } = this.screenOn(g, G, 512, 256);
    this.gaugeCanvas = cv;
    this.gaugeTex = tex;
  }

  buildScreen() {
    const S = this.L.screen, g = this.board(S);
    const { cv, tex } = this.screenOn(g, S, 384, 256);
    this.screenCanvas = cv;
    this.screenTex = tex;
    const c = this.add('screen', g, [S.at[0], 0, S.at[1]], [S.w + 0.02, S.h + 0.02, 0.04], [0.17, 0.12]);
    c.hit.position.set(0, S.h / 2 + 0.01, 0.01);
  }

  buildThrottle() {
    const T = this.L.throttle, g = new THREE.Group();
    g.add(new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 0.12), mat('#2b2e33')));
    // (Its bracket back to the console's side.)
    const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.08), mat('#c9cdd0', { metalness: 0.6, roughness: 0.3 }));
    bracket.position.set(0.07, -0.01, 0);
    g.add(bracket);
    // The lever on its pivot at the top of the box, the handle across its top, the trim rocker on it.
    const pivot = new THREE.Group();
    pivot.position.y = 0.045;
    g.add(pivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.011, 0.17, 8), mat('#c9cdd0', { metalness: 0.6, roughness: 0.3 }));
    arm.position.y = 0.085;
    pivot.add(arm);
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.075, 12).rotateZ(Math.PI / 2), mat('#16181b'));
    handle.position.set(0.02, 0.17, 0);
    pivot.add(handle);
    this.anim.pivot = pivot;
    const tc = this.add('throttle', g, T.at, [0.12, 0.3, 0.14], [-0.42, -0.05], this.group);
    tc.hit.position.y = 0.1;
    if (this.P.trim === 'power') {
      // The rocker on the handle's inboard end: press its top to trim out (up), its bottom in.
      const rocker = new THREE.Group();
      rocker.position.set(0.062, 0.17, 0);
      rocker.add(new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.034, 0.014), mat('#3a3f46')));
      pivot.add(rocker);
      this.anim.rocker = rocker;
      for (const [id, dy] of [['trimUp', 0.01], ['trimDown', -0.01]]) {
        const h = new THREE.Group();
        this.add(id, h, [0.062, 0.17 + dy, 0], [0.03, 0.02, 0.03], [-0.36, id === 'trimUp' ? 0.03 : -0.01], pivot);
      }
    }
  }

  buildNavLights() {
    const L = this.L.lights;
    if (!L) return;
    const lamp = (color, at) => {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), new THREE.MeshStandardMaterial({ color: '#222', emissive: color, emissiveIntensity: 0 }));
      m.position.set(...at);
      this.group.add(m);
      return m;
    };
    this.navLamps = [lamp('#ff2a1a', L.side[0]), lamp('#19ff5a', L.side[1]), lamp('#fff4d8', L.stern)];
  }

  /* ---------- each frame ---------- */

  // S: the engine room and the boat as they are (see main.js: dashState). t: the time.
  update(dt, S, t = 0) {
    const A = this.anim, k = (r) => 1 - Math.exp(-r * dt);
    const c = (id) => this.controls.get(id)?.group.userData;
    // The battery knob a quarter-turn on; the key off, on, and over to start while it cranks.
    if (c('battery')?.knob) {
      A.battery += ((S.battery ? 1 : 0) - A.battery) * k(14);
      c('battery').knob.rotation.y = -A.battery * Math.PI / 2;
    }
    for (let i = 0; i < 2; i++) {
      const u = c(this.P.engines > 1 ? `key${i}` : i ? null : 'key');
      if (!u?.key) continue;
      const want = !S.key ? 0 : S.crank?.[i] ? 1.1 : 0.6;
      A.key[i] += (want - A.key[i]) * k(16);
      u.key.rotation.y = -A.key[i];
    }
    // The lanyard's clip on the switch, or off it and hanging.
    if (c('cord')?.clip) {
      A.cord += ((S.cord ? 1 : 0) - A.cord) * k(10);
      const clip = c('cord').clip;
      clip.position.set(0, (A.cord - 1) * 0.02, (1 - A.cord) * -0.05);
      clip.rotation.x = (1 - A.cord) * 1.2;
    }
    if (c('glow')?.lamp) c('glow').lamp.material.emissive.set(S.glow ? '#ff9a2a' : S.glowReady && S.key ? '#6a3a08' : '#000000');
    if (c('lights')?.lever) {
      A.lights += ((S.lights ? 1 : 0) - A.lights) * k(18);
      c('lights').lever.rotation.x = 0.5 - A.lights;
      c('lights').lamp.material.emissive.set(S.lights && S.powered ? '#2aff5a' : '#000000');
    }
    // The trolling motor's switches: only once one's fitted; lit while it's down, and while it holds.
    for (const id of ['troll', 'lock']) {
      const C = this.controls.get(id);
      if (!C) continue;
      const shown = !!S.troll?.fitted && (id === 'troll' || S.troll.gps);
      C.group.visible = shown;
      C.hidden = !shown;
      const lit = id === 'troll' ? S.troll?.down : S.troll?.lock;
      C.group.userData.lamp.material.emissive.set(lit && S.powered ? (id === 'troll' ? '#3a9cff' : '#2aff5a') : '#000000');
    }
    if (c('horn')?.cap) {
      A.horn += ((S.horn ? 1 : 0) - A.horn) * k(30);
      c('horn').cap.position.y = 0.011 - A.horn * 0.005;
    }
    // The lever leans with the throttle (forward ahead, back astern); the rocker with the trim switch.
    if (A.pivot) {
      A.lever += ((S.lever || 0) - A.lever) * k(12);
      A.pivot.rotation.x = A.lever * 0.62;
    }
    if (A.rocker) {
      A.trim += ((S.trimDir || 0) - A.trim) * k(20);
      A.rocker.rotation.z = A.trim * 0.3;
    }
    if (this.navLamps) {
      const on = S.lights && S.powered ? 1 : 0;
      for (const l of this.navLamps) l.material.emissiveIntensity = on * (S.night > 0.3 ? 2.2 : 0.8);
    }
    // The rings: what's picked, and on the guided start, the next thing to do (pulsing).
    this.placeRing(this.ring, this.highlight, 1);
    this.placeRing(this.guideRing, this.guide && this.guide !== this.highlight ? this.guide : null, 0.75 + 0.25 * Math.sin(t * 5));
    // The screens, a few times a second (and at once when something changes).
    this.drawT -= dt;
    const key = this.stateKey(S);
    if (this.drawT <= 0 || key !== this.lastKey) {
      this.drawT = 0.15;
      this.lastKey = key;
      this.drawGauges(S);
      this.drawScreen(S);
    }
  }

  placeRing(ring, id, s) {
    const C = id && this.controls.get(id);
    if (!C) {
      ring.visible = false;
      return;
    }
    ring.visible = true;
    C.hit.updateWorldMatrix(true, false);
    const box = C.hit.geometry.parameters;
    // (In the dashboard's own frame: the ring lies flat on the face round the control.)
    const p = new THREE.Vector3().setFromMatrixPosition(C.hit.matrixWorld);
    this.group.worldToLocal(p);
    ring.position.copy(p);
    ring.quaternion.copy(this.face.quaternion);
    ring.scale.setScalar(s * Math.max(1, Math.max(box.width, box.depth) / 0.06));
  }

  stateKey(S) {
    return [S.powered, S.key, S.cord, S.battery, S.lights, S.glow, S.crank?.join(), Math.round((S.rpm?.[0] || 0) / 50), Math.round((S.rpm?.[1] || 0) / 50), Math.round(S.knots * 2), Math.round(S.fuel * 100), Math.round(S.volts * 10), Math.round(S.temp * 20), Math.round(S.trim), S.selftest > 0, S.page].join('|');
  }

  /* ---------- the gauges ---------- */

  drawGauges(S) {
    const cv = this.gaugeCanvas;
    if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    if (!g?.fillRect) return;
    g.fillStyle = '#0a0b0d';
    g.fillRect(0, 0, W, H);
    const lit = S.powered && S.key;
    const test = S.selftest > 0;
    const ink = lit ? '#e8eef2' : '#2a2e33', dim = lit ? '#7d8a94' : '#1c1f23';
    // Round gauges: the revs (one per engine), the speed.
    const dial = (cx, cy, r, frac, label, value, warnFrom = 2) => {
      g.lineWidth = 3;
      g.strokeStyle = dim;
      g.beginPath();
      g.arc(cx, cy, r, Math.PI * 0.75, Math.PI * 2.25);
      g.stroke();
      if (warnFrom < 1) {
        g.strokeStyle = lit ? '#b8342a' : '#2a1614';
        g.beginPath();
        g.arc(cx, cy, r, Math.PI * (0.75 + 1.5 * warnFrom), Math.PI * 2.25);
        g.stroke();
      }
      for (let i = 0; i <= 10; i++) {
        const a = Math.PI * (0.75 + 0.15 * i);
        g.beginPath();
        g.moveTo(cx + Math.cos(a) * r * 0.86, cy + Math.sin(a) * r * 0.86);
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
        g.stroke();
      }
      const a = Math.PI * (0.75 + 1.5 * Math.max(0, Math.min(1, test ? 1 : frac)));
      g.strokeStyle = lit ? '#ff6a2a' : '#2a1a14';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(cx, cy);
      g.lineTo(cx + Math.cos(a) * r * 0.9, cy + Math.sin(a) * r * 0.9);
      g.stroke();
      g.fillStyle = ink;
      g.textAlign = 'center';
      g.font = `600 ${Math.round(r * 0.36)}px sans-serif`;
      g.fillText(value, cx, cy + r * 0.62);
      g.fillStyle = dim;
      g.font = `${Math.round(r * 0.22)}px sans-serif`;
      g.fillText(label, cx, cy + r * 0.92);
    };
    const n = this.P.engines, rpm = S.rpm || [0];
    const r = n > 1 ? 52 : 64;
    for (let i = 0; i < n; i++) {
      const cx = n > 1 ? 70 + i * 120 : 90;
      dial(cx, 96, r, (rpm[i] || 0) / (this.P.max * 1.1), n > 1 ? (i ? 'STBD RPM' : 'PORT RPM') : 'RPM ×1000', lit ? ((rpm[i] || 0) / 1000).toFixed(1) : '', 0.9);
    }
    dial(n > 1 ? 330 : 240, 96, 60, S.knots / 40, 'KNOTS', lit ? S.knots.toFixed(0) : '');
    // Bars: fuel, battery volts, temperature, trim.
    const bar = (x, y, label, frac, text, warn) => {
      g.fillStyle = dim;
      g.font = '15px sans-serif';
      g.textAlign = 'left';
      g.fillText(label, x, y);
      g.strokeStyle = dim;
      g.lineWidth = 2;
      g.strokeRect(x, y + 6, 104, 12);
      g.fillStyle = !lit ? '#15181b' : warn ? '#e0453a' : '#9fd6ff';
      g.fillRect(x + 2, y + 8, 100 * Math.max(0, Math.min(1, test ? 1 : frac)), 8);
      g.fillStyle = ink;
      g.textAlign = 'right';
      g.fillText(lit ? text : '', x + 104, y);
    };
    const bx = n > 1 ? 396 : 336;
    bar(bx, 24, 'FUEL', S.fuel, `${Math.round(S.fuel * 100)}%`, S.fuel < 0.12);
    bar(bx, 70, 'VOLTS', (S.volts - 11) / 3.5, S.volts.toFixed(1), S.volts < 12.0);
    bar(bx, 116, 'TEMP', S.temp, S.temp >= 0.6 ? 'HOT' : 'OK', S.temp >= 0.6);
    if (this.P.trim) {
      const tf = (S.trim - TRIM.min) / (TRIM.up - TRIM.min);
      bar(bx, 162, 'TRIM', tf, S.trim > TRIM.max ? (S.trim >= TRIM.out ? 'UP' : 'TILT') : `${Math.round(S.trim)}°`, S.trim >= TRIM.out && S.running);
    }
    // The warning lamps along the bottom: each lit while it's true (all of them in the self-test).
    // (Only the lamps this engine room has: no kill cord or leg on the yacht, glow plugs only on diesels.)
    const lamps = [
      ['BATT', S.volts < 12.0 && S.powered],
      ['HOT', S.temp >= 0.6],
      ...(this.P.cord ? [['CORD', !S.cord]] : []),
      ['FUEL', S.fuel < 0.12],
      ...(this.P.trim ? [['LEG', S.trim >= TRIM.out && S.running]] : []),
      ...(this.P.diesel ? [['GLOW', S.glow]] : []),
      ...(S.troll?.gps ? [['LOCK', S.troll.lock]] : []),
    ];
    lamps.forEach(([label, on], i) => {
      const x = 22 + i * 58, y = 222;
      g.fillStyle = lit && (on || test) ? (label === 'GLOW' ? '#ffae3a' : label === 'LOCK' ? '#3aff6a' : '#ff4a3a') : '#1d1012';
      g.beginPath();
      g.arc(x, y, 8, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = dim;
      g.font = '13px sans-serif';
      g.textAlign = 'left';
      g.fillText(label, x + 12, y + 5);
    });
    if (this.gaugeTex) this.gaugeTex.needsUpdate = true;
  }

  /* ---------- the chartplotter ---------- */

  drawScreen(S) {
    const cv = this.screenCanvas;
    if (!cv) return;
    const g = cv.getContext('2d'), W = cv.width, H = cv.height;
    if (!g?.fillRect) return;
    if (!S.powered) {
      g.fillStyle = '#030405';
      g.fillRect(0, 0, W, H);
      if (this.screenTex) this.screenTex.needsUpdate = true;
      return;
    }
    // The fish finder's own screen, when it's showing (its picture, as on the head unit).
    if (S.page === 'sonar' && S.sonar?.width) {
      g.drawImage(S.sonar, 0, 0, W, H);
    } else {
      // The chart: north up, your track behind you, your heading, speed and the depth.
      g.fillStyle = '#0b2a3d';
      g.fillRect(0, 0, W, H);
      g.strokeStyle = 'rgba(160, 210, 240, 0.12)';
      g.lineWidth = 1;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo((W * i) / 6, 0);
        g.lineTo((W * i) / 6, H);
        g.moveTo(0, (H * i) / 6);
        g.lineTo(W, (H * i) / 6);
        g.stroke();
      }
      const cx = W / 2, cy = H / 2 + 20, sc = 0.25;
      if (S.track?.length) {
        g.strokeStyle = '#ffd36a';
        g.lineWidth = 2;
        g.beginPath();
        S.track.forEach(([dx, dz], i) => (i ? g.lineTo(cx + dx * sc, cy - dz * sc) : g.moveTo(cx + dx * sc, cy - dz * sc)));
        g.stroke();
      }
      g.save();
      g.translate(cx, cy);
      g.rotate(S.heading || 0);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.moveTo(0, -12);
      g.lineTo(7, 9);
      g.lineTo(-7, 9);
      g.closePath();
      g.fill();
      g.restore();
    }
    // The data bar along the top.
    g.fillStyle = 'rgba(0, 0, 0, 0.55)';
    g.fillRect(0, 0, W, 40);
    g.fillStyle = '#e8eef2';
    g.font = '600 22px sans-serif';
    g.textAlign = 'left';
    g.fillText(`${S.knots.toFixed(1)} kn`, 10, 28);
    g.textAlign = 'center';
    g.fillText(`${String(Math.round(((((S.heading || 0) * 180) / Math.PI) % 360 + 360) % 360)).padStart(3, '0')}°`, W / 2, 28);
    g.textAlign = 'right';
    g.fillText(S.depth != null ? `${S.depth.toFixed(1)} m` : '–', W - 10, 28);
    if (this.screenTex) this.screenTex.needsUpdate = true;
  }

  /* ---------- picking and moving round ---------- */

  // The control under a ray (a THREE.Raycaster), or null.
  pick(ray) {
    const hits = ray.intersectObjects([...this.controls.values()].filter((c) => !c.hidden).map((c) => c.hit), false);
    return hits.length ? this.controls.get(hits[0].object.userData.control) : null;
  }

  // The control next to `id` in a direction ('left', 'right', 'up', 'down': as the helmsman sees
  // them), for moving round with a controller; or the first one.
  neighbour(id, dir) {
    const list = [...this.controls.values()].filter((c) => !c.hidden);
    const from = this.controls.get(id);
    if (!from) return list[0] || null;
    // (Port is to the helmsman's left: x grows to the left; z grows away, which is up.)
    const want = { left: [1, 0], right: [-1, 0], up: [0, 1], down: [0, -1] }[dir];
    let best = null, bd = Infinity;
    for (const c of list) {
      if (c === from) continue;
      const dx = c.nav[0] - from.nav[0], dz = c.nav[1] - from.nav[1];
      const along = dx * want[0] + dz * want[1];
      if (along <= 0.005) continue;
      const across = Math.abs(dx * want[1] - dz * want[0]);
      const d = along + across * 2.5;
      if (d < bd) {
        bd = d;
        best = c;
      }
    }
    return best || from;
  }

  // Where a control is in the world (for a camera to look at, or a label).
  worldOf(id, out = new THREE.Vector3()) {
    const C = this.controls.get(id);
    if (!C) return null;
    C.hit.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(C.hit.matrixWorld);
  }

  // The middle of the dashboard in the world.
  centre(out = new THREE.Vector3()) {
    this.face.updateWorldMatrix(true, false);
    return out.setFromMatrixPosition(this.face.matrixWorld);
  }
}
