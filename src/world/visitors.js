import * as THREE from 'three';
import { walkHeight } from './terrain.js';
import { waveHeight } from './water.js';
import { Boat, floatDraft, wakeOf } from '../boat.js';
import { wakes } from './wakes.js';
import { Figure } from './folk.js';
import { berthFor } from '../mooring.js';
import { damp, clamp } from '../util.js';
import { RODS, LINE_COLORS } from '../tackle.js';
import { buildFloat } from '../tackleModels.js';
import { buildRod } from '../props.js';

const LINE_N = 18;  // points along a friend's line
const _tip = new THREE.Vector3();

// The friends you're playing with (see together.js), drawn where they are: on foot, a figure of
// their own (walking, standing, fishing or sitting), or in whichever boat they're in, at the helm
// and riding the swell. Diving or driving, only their name shows (see main.js). Each friend has a
// look made from their name (coat, hat, the stripe on their boat), so they look the same to
// everyone, every time. Fishing, they hold the rod they're really using, and their line runs out
// from its tip to where it meets the water (their float, if it's a float rod), slack and sagging,
// or tight and straight to the fish when one's on.

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
      d = { name: p.name, look: lookFor(p.name), figure: null, boats: {}, moored: {}, roll: 0 };
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

  // One of a friend's boats lying where they left her (nobody aboard): her own instance, apart from
  // the one they ride in.
  mooredFor(d, kind) {
    if (d.moored[kind]) return d.moored[kind];
    const b = new Boat(this.scene, { kind, look: { stripe: d.look.coat } });
    b.setRower(false);
    b.group.visible = false;
    d.moored[kind] = b;
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
      for (const b of [...Object.values(d.boats), ...Object.values(d.moored)]) {
        if (b.group.visible && Math.hypot(b.pos.x - x, b.pos.z - z) < r) return b;
      }
    }
    return null;
  }

  // The boat a friend is aboard, as drawn here (for the shared sea: a pod rides the bow you see).
  boatOf(id) {
    const d = this.drawn.get(id);
    if (!d) return null;
    for (const b of Object.values(d.boats)) if (b.group.visible) return b;
    return null;
  }

  // A friend's own colour (their coat), for the map.
  colourOf(name) { return lookFor(name).coat; }

  // On foot, the rod they're really using in the figure's hand (in place of its plain one).
  rodLook(d, f, id) {
    const def = RODS[id];
    if (!def || d.rodId === id) return;
    if (d.rodOn) d.rodOn.group.removeFromParent();
    d.rodId = id;
    d.rodOn = (d.rods ||= {})[id] ||= buildRod(def.look);
    // (Held as the figure holds its own: from the hand, out over the water.)
    d.rodOn.group.position.set(0, 0, 0);
    d.rodOn.group.rotation.set(0, 0, 0);
    f.rod.add(d.rodOn.group);
    f.rod.children[0].visible = false;
  }

  // A friend's line: from their rod tip out to where it meets the water (with their float on it,
  // fishing a float), sagging when it's slack, straight and tight to a fish on.
  drawLine(d, P, tip, dt, t) {
    const on = !!tip && P.ex != null && P.ez != null;
    if (!on) {
      if (d.line) d.line.visible = false;
      if (d.float) d.float.visible = false;
      d.end = null;
      return;
    }
    if (!d.line) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(LINE_N * 3), 3));
      d.line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: '#f5efe2', transparent: true, opacity: 0.75 }));
      d.line.frustumCulled = false;
      this.scene.add(d.line);
    }
    const kind = RODS[P.r]?.kind || 'float';
    d.line.material.color.set(LINE_COLORS[kind] || LINE_COLORS.float);
    d.line.visible = true;
    // (The end glides between their messages rather than hopping.)
    if (!d.end || Math.hypot(d.end.x - P.ex, d.end.z - P.ez) > 12) d.end = { x: P.ex, z: P.ez };
    d.end.x = damp(d.end.x, P.ex, 5, dt);
    d.end.z = damp(d.end.z, P.ez, 5, dt);
    tip.getWorldPosition(_tip);
    const ex = d.end.x, ez = d.end.z, ey = waveHeight(ex, ez, t) + 0.01;
    const span = Math.hypot(ex - _tip.x, ez - _tip.z);
    // Slack, it hangs in a curve from the tip and lies on the water; tight, it's nearly straight.
    const tight = P.o ? clamp(0.35 + (P.tn ?? 0.4), 0, 1) : 0;
    const sag = span * (0.09 - 0.08 * tight);
    const a = d.line.geometry.attributes.position.array;
    for (let i = 0; i < LINE_N; i++) {
      const u = i / (LINE_N - 1);
      const x = _tip.x + (ex - _tip.x) * u, z = _tip.z + (ez - _tip.z) * u;
      let y = _tip.y + (ey - _tip.y) * u - sag * 4 * u * (1 - u);
      if (i > 0) y = Math.max(y, waveHeight(x, z, t) + 0.01);
      a[i * 3] = x;
      a[i * 3 + 1] = y;
      a[i * 3 + 2] = z;
    }
    d.line.geometry.attributes.position.needsUpdate = true;
    // Their float, riding the swell (and dipping under with a fish on).
    if (kind === 'float') {
      if (!d.float) {
        d.float = buildFloat();
        this.scene.add(d.float);
      }
      d.float.visible = true;
      d.float.position.set(ex, ey - (P.o ? 0.12 : 0), ez);
    } else if (d.float) d.float.visible = false;
  }

  // Where a friend's line meets the water (or the fish on it) as it's drawn here, or null.
  lineEnd(id) {
    return this.drawn.get(id)?.end || null;
  }

  // A friend has just landed a fish: on foot, they hold it up for a few seconds.
  holdUp(id, kg) {
    const d = this.drawn.get(id);
    if (!d) return;
    d.lift = 5;
    d.liftKg = kg;
  }

  // A friend's fish fighting at the end of their line, as they see it: the water boiling where it
  // runs, a crash as it leaps, spray as it shakes its head at the top, a wake as it charges or
  // streaks off; nothing at the top while it's deep (diving, sounding, circling below).
  fishAtEnd(d, P, dt, t, fx) {
    if (!fx || !P.o || !d.end) {
      d.mvWas = null;
      return;
    }
    const x = d.end.x, z = d.end.z, mv = P.mv || 'run';
    if (mv !== d.mvWas) {
      d.mvWas = mv;
      if (mv === 'jump') {
        fx.splash(x, 0.05, z, 18, 2.4, 0.8);
        fx.ripple(x, z, 1.8, 1.4, 0.6);
      } else if (mv === 'run' || mv === 'longrun' || mv === 'charge') fx.ripple(x, z, 1.4, 1.2, 0.5);
    }
    d.fishT = (d.fishT || 0) - dt;
    if (d.fishT > 0) return;
    if (mv === 'shake') {
      d.fishT = 0.22;
      fx.splash(x, 0.05, z, 6, 1.5, 0.5);
    } else if (mv === 'run' || mv === 'longrun' || mv === 'charge') {
      d.fishT = 0.12;
      fx.ripple(x, z, 0.5, 0.8, 0.3);
    } else if (mv === 'jump') {
      d.fishT = 0.3;
    } else {
      d.fishT = 1.2;
      if (mv !== 'sound' && mv !== 'dive') fx.ripple(x, z, 0.8, 1, 0.3);
    }
  }

  // Hide (and let go of) someone who has left.
  forget(id) {
    const d = this.drawn.get(id);
    if (!d) return;
    if (d.line) {
      this.scene.remove(d.line);
      d.line.geometry.dispose();
    }
    if (d.float) this.scene.remove(d.float);
    if (d.figure) {
      this.scene.remove(d.figure.group);
      d.figure.group.visible = false;
    }
    // (Boats hold on to their mooring gear in the scene: they're only ever hidden, never rebuilt.)
    for (const b of [...Object.values(d.boats), ...Object.values(d.moored)]) b.group.visible = false;
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
      let tip = null;
      if (onFoot) {
        const f = this.figureFor(d, p.id);
        // (Just landed one: held up for you to see, a few seconds.)
        d.lift = Math.max(0, (d.lift || 0) - dt);
        const act = P.o ? 'fish' : d.lift > 0 && A.v < 0.4 ? 'lift' : P.a === 'walk' || (A.v > 0.4 && P.a !== 'sit') ? 'walk' : P.a;
        f.update(dt, t, { act, pos: A, yaw: A.h }, walkHeight(A.x, A.z));
        // A fish on: the rod up and working, pumping as they play it (bent harder the more load
        // there is on the line).
        if (P.o) {
          f.rod.visible = true;
          f.rod.rotation.x = 2.05 - (P.tn ?? 0.4) * 0.25 + Math.sin(t * 6.5 + d.look.coat.length) * 0.14;
        }
        if (act === 'lift') {
          // (About as big as the fish: its length goes with the cube root of its weight.)
          const k = clamp(Math.cbrt((d.liftKg || 1) / 0.6), 0.6, 3.2);
          f.fish.scale.set(0.05 * k, 0.035 * k, 0.16 * k);
        }
        if (act === 'fish') {
          this.rodLook(d, f, P.r);
          tip = d.rodOn ? d.rodOn.tip : f.rodTip;
          // (Their real line takes over from the figure's own bit of dangling line.)
          f.rodTip.children[0].visible = P.ex == null;
        }
      } else if (afloat) {
        const b = this.boatFor(d, P.k);
        if (P.r) b.setRod(P.r);
        this.drawBoat(d, b, P, A, dt, t, { fx, glow, night });
        if (P.f || P.o) tip = b.rodTip;
      }
      this.drawLine(d, P, tip, dt, t);
      this.fishAtEnd(d, P, dt, t, fx);
      // Their other boats in the water, lying where they left them (not the one they're in).
      const keep = new Set();
      for (const F of p.fleet || []) {
        if ((P.m === 'boat' && F.k === P.k) || Math.hypot(F.x - from.x, F.z - from.z) > 900) continue;
        keep.add(F.k);
        this.drawMoored(this.mooredFor(d, F.k), F, t);
      }
      for (const [k, b] of Object.entries(d.moored)) if (!keep.has(k)) b.group.visible = false;
    }
  }

  // A friend's boat lying where they left her: riding the swell, her lines out if she's alongside,
  // solid to your boats.
  drawMoored(b, F, t) {
    const moved = !b.group.visible || Math.hypot(b.pos.x - F.x, b.pos.z - F.z) > 0.3;
    b.group.visible = true;
    const fw = { x: Math.sin(F.h), z: Math.cos(F.h) };
    b.pos.set(F.x, 0, F.z);
    b.heading = F.h;
    b.fwd.set(fw.x, 0, fw.z);
    b.right.set(-fw.z, 0, fw.x);
    b.vel.set(0, 0, 0);
    b.forwardSpeed = 0;
    const H = b.hull, L2 = H.L * 0.4, w = waveHeight(F.x, F.z, t);
    const fore = waveHeight(F.x + fw.x * L2, F.z + fw.z * L2, t), aft = waveHeight(F.x - fw.x * L2, F.z - fw.z * L2, t);
    b.group.position.set(F.x, w - floatDraft(b.base), F.z);
    b.group.rotation.y = F.h;
    b.body.rotation.x = clamp(Math.atan2(aft - fore, H.L * 0.8), -0.3, 0.3);
    b.body.rotation.z = Math.sin(t * 0.8 + F.x) * 0.03;
    b.animate(0, t, 0, 0, 0);
    b.group.updateMatrixWorld(true);
    if (moved) b.tie = berthFor({ hull: H, pos: { x: F.x, z: F.z }, heading: F.h }, [], { reach: 1.5 });
    b.updateGear();
    b.afloat(t);
  }

  // The friends' boats drawn on the water just now.
  boats(out = (this._boats ||= [])) {
    out.length = 0;
    for (const d of this.drawn.values()) for (const b of [...Object.values(d.boats || {}), ...Object.values(d.moored || {})]) if (b.group.visible) out.push(b);
    return out;
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
    // (Solid to your boats: you bump off a friend's boat as off any other.)
    b.afloat(t);
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
