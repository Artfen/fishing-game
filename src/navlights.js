// Lights at sea (F2c). After dark a boat shows what she is and which way she's heading by her
// lights, as at sea anywhere:
// - Under way: a red sidelight to port and a green to starboard, each seen from dead ahead round to
//   two points abaft the beam (112.5°); a white stern light seen from astern (the 135° the
//   sidelights leave); and a powered boat's white masthead light, seen over the sidelights' arc.
//   (Under sail, no masthead light: sidelights and stern light only.) A boat under oars or paddle
//   shows a white light all round: a torch, a lantern.
// - At anchor: one white light all round, where it can be seen best.
// - Tied up alongside or at a mooring in harbour: nothing.
// So a red light over a white one is a boat crossing from your right to your left; red and green
// together, one coming straight at you; a lone white light, a boat you're overtaking or one at
// anchor.
// The game draws every boat's lights, yours, the townsfolk's and your friends', as one cloud of
// points (one draw call), each the same few pixels across at any distance, as a lamp at sea is.
// Your own: a boat with a navigation-lights switch on her dash (dashboard.js) shows them when it's
// on; any other comes on by itself after dark. Under way after dark with them switched off, you're
// told once a night: nobody can see you coming.

import * as THREE from 'three';
import { glowTexture } from './util.js';

export const SIDE_ARC = (112.5 * Math.PI) / 180;
export const RED = 0xff3b30, GREEN = 0x2bd96b, WHITE = 0xfff4dc;
// Boats under oars or paddle (an all-round white light under way).
export const OARS = new Set(['row', 'kayak']);

// What she shows: 'off', 'way' (under way) or 'anchor'. { night (0 … 1), tied (alongside or
// moored), anchored, lit (her switch, where she has one) }. (Not anchored and not made fast, she's
// under way, as the rules have it, stopped or not: drifting over a mark, her sidelights show.)
export function modeFor({ night = 0, tied = false, anchored = false, lit = true }) {
  if (night < 0.3 || tied || !lit) return 'off';
  return anchored ? 'anchor' : 'way';
}

// The lights she has lit in a mode: ids from 'port', 'stbd', 'stern', 'mast' (the masthead light,
// forward) and 'all' (all round).
export function lightsOf(kind, mode, { sailing = false } = {}) {
  if (mode === 'anchor') return ['all'];
  if (mode !== 'way') return [];
  if (OARS.has(kind)) return ['all'];
  return sailing ? ['port', 'stbd', 'stern'] : ['port', 'stbd', 'stern', 'mast'];
}

// Whether a light is seen from a point at `ahead` metres ahead of her and `side` metres to
// starboard (negative: to port).
export function seen(id, ahead, side) {
  const a = Math.atan2(Math.abs(side), ahead); // 0 dead ahead … π dead astern
  if (id === 'all') return true;
  if (id === 'stern') return a >= SIDE_ARC;
  if (id === 'mast') return a <= SIDE_ARC;
  if (id === 'stbd') return side >= -0.05 * Math.hypot(ahead, side) && a <= SIDE_ARC + 0.02;
  if (id === 'port') return side <= 0.05 * Math.hypot(ahead, side) && a <= SIDE_ARC + 0.02;
  return false;
}

// Where each light is on her, in her own space (x to port, y up from her keel, z forward), from
// her hull's size (L long, B half her beam, D deep), for a boat without her own lamps for it.
export function placeOf(id, H, mastY = null) {
  const top = H.D + 0.15;
  if (id === 'port' || id === 'stbd') return [(id === 'port' ? 1 : -1) * H.B * 0.82, top + 0.12, H.L * 0.22];
  if (id === 'stern') return [0, top + 0.35, -H.L / 2 + 0.12];
  if (id === 'mast') return [0, mastY ?? top + Math.max(0.9, H.L * 0.16), H.L * 0.05];
  return [0, mastY ?? top + Math.max(0.8, H.L * 0.14), 0];
}

const COLOR = { port: RED, stbd: GREEN, stern: WHITE, mast: WHITE, all: WHITE };

export class NavLights {
  // dashOf(b): where a boat with a dash (dashboard.js) has her lamps, { side: [port, stbd], stern }
  // in her own space, or null.
  constructor(scene, { max = 192, dashOf = () => null } = {}) {
    this.dashOf = dashOf;
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setDrawRange(0, 0);
    this.mat = new THREE.PointsMaterial({ size: 12, sizeAttenuation: false, map: glowTexture('rgba(255,255,255,1)'), vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
    this.points = new THREE.Points(g, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = 3;
    scene.add(this.points);
    this.n = 0;
    this._v = new THREE.Vector3();
    this._c = new THREE.Color();
  }

  // Each tick starts the cloud afresh; once the town's and your friends' boats have added theirs,
  // mark() keeps the count, and each frame drawn goes back to it (rewind) before your own boats add
  // theirs: however many ticks a frame takes, or frames a tick, no light is counted twice.
  begin() {
    this.n = 0;
    this.base = 0;
  }

  mark() {
    this.base = this.n;
  }

  rewind() {
    this.n = this.base || 0;
  }

  // Her lights in a mode, as seen from `eye` (a world point): b is a Boat (boat.js).
  add(b, mode, eye, { sailing = false } = {}) {
    if (mode === 'off' || !b?.body || !b.group.visible) return;
    const ids = lightsOf(b.kind, mode, { sailing });
    if (!ids.length) return;
    const dx = eye.x - b.pos.x, dz = eye.z - b.pos.z;
    const ahead = dx * b.fwd.x + dz * b.fwd.z, side = dx * b.right.x + dz * b.right.z;
    if (b._navDash === undefined) b._navDash = this.dashOf(b) || null;
    const D = b._navDash;
    for (const id of ids) {
      if (this.n >= this.max || !seen(id, ahead, side)) continue;
      // (Her own lamps where she has them: the mast light on her wheelhouse or hardtop, the
      // lamps by her dash; otherwise where her size puts them.)
      if ((id === 'mast' || id === 'all') && b.mastLight) b.mastLight.getWorldPosition(this._v);
      else {
        const p = D && id !== 'mast' && id !== 'all' ? (id === 'stern' ? D.stern : D.side[id === 'port' ? 0 : 1]) : placeOf(id, b.hull);
        this._v.set(p[0], p[1], p[2]);
        b.body.localToWorld(this._v);
      }
      this.pos.set([this._v.x, this._v.y, this._v.z], this.n * 3);
      this._c.set(COLOR[id]);
      this.col.set([this._c.r, this._c.g, this._c.b], this.n * 3);
      this.n++;
    }
  }

  // Done for the frame: `night` fades them in at dusk; `px` the device's pixel ratio.
  end(night, px = 1) {
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position.needsUpdate = true;
    g.attributes.color.needsUpdate = true;
    this.mat.opacity = Math.min(1, Math.max(0, (night - 0.3) / 0.25));
    this.mat.size = 12 * px;
    this.points.visible = this.n > 0 && this.mat.opacity > 0.01;
  }
}
