import { walkHeight } from './terrain.js';
import { waveHeight } from './water.js';
import { Boat, floatDraft, wakeOf } from '../boat.js';
import { wakes } from './wakes.js';
import { Figure } from './folk.js';
import { damp, clamp } from '../util.js';

// The friends you're playing with (see together.js), drawn where they are: on foot, a figure of
// their own (walking, standing, fishing or sitting), or in whichever boat they're in, at the helm
// and riding the swell. Diving or driving, only their name shows (see main.js). Each friend has a
// look made from their name (coat, hat, the stripe on their boat), so they look the same to
// everyone, every time.

const COATS = ['#b8402f', '#2f6f74', '#d08a2e', '#5b4a8a', '#3d6b3a', '#2b4a7a', '#8a3a5a', '#c9a227', '#4a5a66', '#a8572a'];
const LEGS = ['#2f3a4a', '#3b3b3b', '#4a4036', '#2a2a2e', '#3b5a8a'];
const SKINS = ['#f1c7a1', '#e3b48e', '#c99a72', '#b98863', '#8d5f3e', '#efc39d'];
const HATS = ['beanie', 'flatcap', 'bucket', 'cap', 'hair', 'bun'];
const HAT_COLOURS = ['#2c3e50', '#8a7a52', '#c43b2f', '#e8e4da', '#3a2b20', '#2f6f74', '#e2662a'];
const HAIR = ['#2a211c', '#8a4a2a', '#a9a59e', '#d8b46a', '#4a2f22'];

// A small, steady hash of a name (FNV-1a), so a look depends only on the name.
export function nameHash(name) {
  let h = 0x811c9dc5;
  for (const ch of String(name)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

export function lookFor(name) {
  let h = nameHash(name);
  const pick = (list) => {
    const v = list[h % list.length];
    h = Math.floor(h / list.length) ^ 0x9e3779b9;
    h >>>= 0;
    return v;
  };
  const coat = pick(COATS), legs = pick(LEGS), skin = pick(SKINS), hat = pick(HATS), hatColor = pick(HAT_COLOURS), hair = pick(HAIR);
  return { coat, legs, boots: '#2d2a28', skin, hat, hatColor: hat === 'hair' || hat === 'bun' ? hair : hatColor, hair };
}

export class VisitorView {
  constructor(scene) {
    this.scene = scene;
    this.drawn = new Map(); // peer id -> { name, figure, boats: { kind: Boat }, roll }
  }

  entry(p) {
    let d = this.drawn.get(p.id);
    if (d && d.name !== p.name) {
      // A new name is a new look: start them afresh.
      this.forget(p.id);
      d = null;
    }
    if (!d) {
      d = { name: p.name, look: lookFor(p.name), figure: null, boats: {}, roll: 0 };
      this.drawn.set(p.id, d);
    }
    return d;
  }

  boatFor(d, kind) {
    if (d.boats[kind]) return d.boats[kind];
    const b = new Boat(this.scene, { kind, look: { stripe: d.look.coat } });
    const M = b.selfMats, L = d.look;
    M[0].color.set(L.coat);
    M[1].color.set(L.skin);
    M[2].color.set(L.hatColor);
    M[3].color.set(L.legs);
    M[4].color.set(L.boots);
    b.setRower(true);
    b.group.visible = false;
    d.boats[kind] = b;
    return b;
  }

  figureFor(d, id) {
    if (!d.figure) {
      d.figure = new Figure(`visitor:${id}`, d.look);
      this.scene.add(d.figure.group);
    }
    return d.figure;
  }

  // A friend's boat drawn within `r` of (x, z), if any (so a boat of yours lying in the same spot,
  // as boats from the same jetty do, can step aside: see main.js).
  boatNear(x, z, r) {
    for (const d of this.drawn.values()) {
      for (const b of Object.values(d.boats)) {
        if (b.group.visible && Math.hypot(b.pos.x - x, b.pos.z - z) < r) return b;
      }
    }
    return null;
  }

  // A friend's own colour (their coat), for the map.
  colourOf(name) { return lookFor(name).coat; }

  // Hide (and let go of) someone who has left.
  forget(id) {
    const d = this.drawn.get(id);
    if (!d) return;
    if (d.figure) {
      this.scene.remove(d.figure.group);
      d.figure.group.visible = false;
    }
    // (Boats hold on to their mooring gear in the scene: they're only ever hidden, never rebuilt.)
    for (const b of Object.values(d.boats)) b.group.visible = false;
    this.drawn.delete(id);
  }

  // peers: from Together; from: where you are (those far off aren't drawn).
  update(dt, t, peers, { from, fx = null, glow = null, night = 0 } = {}) {
    for (const id of [...this.drawn.keys()]) if (!peers.has(id)) this.forget(id);
    for (const p of peers.values()) {
      if (!p.name || !p.pose || !p.at) continue;
      const d = this.entry(p);
      const P = p.view || p.pose, A = p.at;
      const far = Math.hypot(A.x - from.x, A.z - from.z);
      const onFoot = P.m === 'foot' && far < 400;
      const afloat = P.m === 'boat' && far < 1800;
      if (d.figure) d.figure.group.visible = false;
      for (const [k, b] of Object.entries(d.boats)) if (k !== P.k || !afloat) b.group.visible = false;
      if (onFoot) {
        const f = this.figureFor(d, p.id);
        const act = P.o ? 'fish' : P.a === 'walk' || (A.v > 0.4 && P.a !== 'sit') ? 'walk' : P.a;
        f.update(dt, t, { act, pos: A, yaw: A.h }, walkHeight(A.x, A.z));
        // A fish on: the rod up and working, pumping as they play it.
        if (P.o) {
          f.rod.visible = true;
          f.rod.rotation.x = 2.05 + Math.sin(t * 6.5 + d.look.coat.length) * 0.14;
        }
      } else if (afloat) {
        this.drawBoat(d, this.boatFor(d, P.k), P, A, dt, t, { fx, glow, night });
      }
    }
  }

  // Like the harbour's own boats (see folk.js): she rides the swell where she is, bow up a little
  // under way, her skipper at the helm, a rod out if they're fishing, the sail up if it is.
  drawBoat(d, b, P, A, dt, t, { fx, glow, night }) {
    b.group.visible = true;
    const fw = { x: Math.sin(A.h), z: Math.cos(A.h) };
    const speed = A.v || 0;
    b.pos.set(A.x, 0, A.z);
    b.heading = A.h;
    b.fwd.set(fw.x, 0, fw.z);
    b.right.set(-fw.z, 0, fw.x);
    b.vel.set(P.vx, 0, P.vz);
    b.forwardSpeed = speed;
    const H = b.hull, w = waveHeight(A.x, A.z, t);
    const fore = waveHeight(A.x + fw.x * H.L * 0.4, A.z + fw.z * H.L * 0.4, t), aft = waveHeight(A.x - fw.x * H.L * 0.4, A.z - fw.z * H.L * 0.4, t);
    b.group.position.set(A.x, w - floatDraft(b.base), A.z);
    const wk = (b._wake ||= wakeOf(b.base));
    wakes.trail(b, A.x, A.z, fw.x, fw.z, speed, t, wk.mass, wk.L, wk.fine, P.s ? 0 : Math.min(0.7, speed / 4), H.B);
    b.group.rotation.y = A.h;
    b.body.rotation.x = clamp(Math.atan2(aft - fore, H.L * 0.8) - Math.min(0.08, speed * 0.012), -0.3, 0.3);
    d.roll = damp(d.roll, Math.sin(t * 0.9) * 0.05 + (P.s && !P.n ? 0.12 : 0), 2, dt);
    b.body.rotation.z = d.roll;
    if (!b.occupied) b.setRower(true);
    b.pose.fishing = P.f || P.o ? 1 : 0;
    if (P.f || P.o) {
      b.pose.rodYaw = 1.1;
      // (A fish on: the rod high and bent hard, nodding as it runs.)
      b.pose.rodPitch = P.o ? 1.05 + Math.sin(t * 6.5) * 0.08 : 0.75;
      b.pose.bend = P.o ? 0.55 + Math.sin(t * 9) * 0.1 : 0.12;
    }
    if (H.sail) {
      if (b.sailUp !== !!P.s) b.setSail(!!P.s);
      b.sailing = P.s ? { boom: 0.55, awa: 1.3, alpha: 0.14, speed: 3.5, pull: 3 } : null;
      b.setLantern?.(P.n && night > 0.3);
    }
    b.animate(dt, t, speed > 0.3 && !H.sail ? 0.7 : 0, 0, P.n ? night : 0);
    b.group.updateMatrixWorld(true);
    if (fx && speed > 0.5) {
      d.rippleT = (d.rippleT || 0) - dt;
      if (d.rippleT <= 0) {
        d.rippleT = 0.18;
        fx.ripple(A.x - fw.x * H.L * 0.5, A.z - fw.z * H.L * 0.5, 1.2 + speed * 0.25, 1.8, 0.5);
        glow?.spawn(A.x - fw.x * H.L * 0.5, A.z - fw.z * H.L * 0.5, 6, 0.8, 1, t);
      }
    }
  }
}
