import * as THREE from 'three';
import { FISH, buildFishMesh } from './fish.js';
import { waveHeight } from './world/water.js';
import { solidHeight, streamFlow } from './world/terrain.js';
import { RODS, TACKLE, castRange, castProfile, splashOf } from './tackle.js';
import { buildTackleModel, buildFloat, buildIndicator, buildLead } from './tackleModels.js';
import { clamp, lerp, damp, rand, smoothstep, wrapAngle, glowTexture } from './util.js';
import { newFight, stepFight, DIFFICULTY, DRAG_LEVELS, DEFAULT_DRAG } from './fight.js';

const LINE_N = 28;
const ARC_N = 24;
const SWING = 2.2; // seconds for the power meter to swing up to full and back down
const TAP = 0.22; // a press shorter than this is a twitch; longer is reeling
const LINE_COLORS = { float: '#f5efe2', lure: '#c3dc98', ledger: '#e9f0e6', fly: '#f0dc7a' };
const _v = new THREE.Vector3();
const _w = new THREE.Vector3();

// The fishing loop:
// idle → aiming (hold, aim, choose distance) → casting → drifting (rig in the water)
//      → bite → reeling → landing → caught → releasing or keeping → idle
// The rod decides how the rig behaves once it lands (this.kind):
//   float  – a bait hanging under a float at the depth you choose (the original Slow Tide way)
//   lure   – a lure you reel back; it dives, wobbles, flashes or hangs depending on the lure
//   ledger – a bait on the bottom with a bite alarm; carp pick it up and run
//   fly    – a fly that drifts with the stream (and drags when the line pulls it), or is stripped back
// Fish come to the rig on their own (see world/ecosystem.js); this file reports what they do
// through the float, the line, the rod and the alarm, and plays the fight.
export class Fishing {
  constructor(scene, angler, fx, audio, eco, hooks) {
    this.scene = scene;
    this.angler = angler;
    this.fx = fx;
    this.audio = audio;
    this.eco = eco;
    this.hooks = hooks;
    this.state = 'idle';
    this.t = 0;
    this.power = 0;
    this.aimT = 0;
    this.release = 1;   // how clean a release would be right now (1 at the top or bottom of the swing)
    this.intended = new THREE.Vector3();
    this.castMiss = null;
    this.wind = { x: 0, z: 0, strength: 0 }; // where the wind blows towards, set by the game
    this.aimOffset = 0;
    this.aimYaw = 0;
    this.castDist = 0;
    this.aimValid = false;
    this.apex = 1;
    this.flight = 1;
    this.held = false;
    this.hold = false;
    this.holdT = 0;
    this.reelSpeed = 0;
    this.relSpeed = 0;
    this.retrieve = 1.0; // lure retrieve speed, remembered between casts
    this.depth = 1.2; // chosen float depth, remembered between casts
    this.baitDepth = 0;
    this.bottom = 5;
    this.dip = 0;
    this.twitchT = 0;
    this.rodBounce = 0;
    this.status = 'quiet';
    this.statusT = 0;
    this.quietT = 0;
    this.hintedQuiet = false;
    this.agent = null;
    this.fight = null;
    this.biteKind = 'float';
    this.steady = 1; // under 1 when you're well fed: steadier hands soften the jolt of a run
    this.diff = DIFFICULTY.standard;
    this.drags = {};  // drag setting for each rod (index into DRAG_LEVELS), kept with your gear
    this.dragStep = 0;
    this.r = {};
    this.flow = { x: 0, z: 0 };
    this.tip = new THREE.Vector3();
    this.bob = new THREE.Vector3();
    this.hook = new THREE.Vector3();
    this.prevHook = new THREE.Vector3();
    this.lastSync = new THREE.Vector3();
    this.frameDt = 1 / 60;
    this.from = new THREE.Vector3();
    this.to = new THREE.Vector3();
    this.fishPos = new THREE.Vector3();

    this.bobber = buildFloat();
    this.bobber.visible = false;
    scene.add(this.bobber);
    this.indicator = buildIndicator();
    this.indicator.visible = false;
    scene.add(this.indicator);
    this.lead = buildLead();
    this.lead.visible = false;
    scene.add(this.lead);
    this.models = {};
    this.model = null;

    const lg = new THREE.BufferGeometry();
    this.linePos = new Float32Array(LINE_N * 3);
    lg.setAttribute('position', new THREE.BufferAttribute(this.linePos, 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: LINE_COLORS.float, transparent: true, opacity: 0.75 }));
    this.line.frustumCulled = false;
    this.line.visible = false;
    scene.add(this.line);

    // The short length of line from the float (or where the line enters the water) to the hook.
    const ldg = new THREE.BufferGeometry();
    this.leaderPos = new Float32Array(6);
    ldg.setAttribute('position', new THREE.BufferAttribute(this.leaderPos, 3));
    this.leader = new THREE.Line(ldg, new THREE.LineBasicMaterial({ color: '#e8f2ee', transparent: true, opacity: 0.5 }));
    this.leader.frustumCulled = false;
    this.leader.visible = false;
    scene.add(this.leader);

    this.aimRing = new THREE.Mesh(
      new THREE.RingGeometry(0.42, 0.52, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.aimRing.renderOrder = 3;
    scene.add(this.aimRing);
    this.arcPos = new Float32Array(ARC_N * 3);
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(this.arcPos, 3));
    this.arc = new THREE.Points(ag, new THREE.PointsMaterial({
      size: 0.42, map: glowTexture(), color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false,
    }));
    this.arc.frustumCulled = false;
    this.arc.renderOrder = 4;
    scene.add(this.arc);

    this.fishMeshes = {};
    for (const f of FISH) {
      const m = buildFishMesh(f);
      scene.add(m);
      this.fishMeshes[f.id] = m;
    }

    eco.listener = {
      onCurious: (a) => this.onCurious(a),
      onFollow: (a) => this.onFollow(a),
      onNibble: (a) => this.onNibble(a),
      onBite: (a, kind) => this.onBite(a, kind),
      onLeave: (a, reason) => this.onLeave(a, reason),
      onSpooked: (a) => this.hooks.spooked?.(a),
    };
    this.setRig(RODS.float, TACKLE.worm);
  }

  get busy() { return this.state !== 'idle'; }
  get aiming() { return this.state === 'aiming'; }
  get lineOut() { return this.state !== 'idle' && this.state !== 'aiming'; }
  get baitInWater() { return this.state === 'drifting' || this.state === 'bite' || this.state === 'reeling'; }
  get pulling() { return !!(this.fight && this.fight.pulling); }
  get holdingFish() { return this.state === 'caught'; }
  get retrieveName() { return this.retrieve < 0.7 ? 'slow' : this.retrieve < 1.4 ? 'steady' : 'fast'; }
  // What the bait-follow camera watches.
  get watchPoint() {
    if (this.state === 'reeling' && this.fight) return this.fishPos;
    if (this.state === 'drifting' || this.state === 'bite') return this.hook;
    return null;
  }

  setAngler(a) {
    this.angler = a;
  }

  // Change rod or tackle. Only between casts.
  setRig(rod, item) {
    if (this.busy) return false;
    this.rod = rod;
    this.item = item;
    this.kind = rod.kind;
    this.line.material.color.set(LINE_COLORS[this.kind]);
    if (this.model) this.model.visible = false;
    this.model = item ? this.modelFor(item) : null;
    return true;
  }

  modelFor(item) {
    if (!this.models[item.id]) {
      const m = buildTackleModel(item);
      m.visible = false;
      this.scene.add(m);
      this.models[item.id] = m;
    }
    return this.models[item.id];
  }

  /* ---------- input ---------- */

  onDown() {
    switch (this.state) {
      case 'idle':
        if (!this.item) {
          this.hooks.flash(`Nothing for the ${this.rod.short.toLowerCase()} in your backpack. Swap tackle with ${this.hooks.key('B')}.`);
          return;
        }
        if (this.angler.onBoat && this.angler.speed > 1.8) {
          this.hooks.flash('Let the boat drift to a stop first');
          return;
        }
        this.state = 'aiming';
        this.t = 0;
        this.power = 0;
        this.aimT = 0;
        this.aimOffset = 0;
        break;
      case 'drifting':
        this.hold = true;
        this.holdT = 0;
        break;
      case 'bite':
        this.setHook();
        break;
      case 'caught':
        if (this.t > 0.5) this.letGo();
        break;
      default:
    }
  }

  onUp() {
    if (this.state === 'aiming') this.cast();
    else if (this.state === 'drifting' && this.hold && this.holdT < TAP) this.twitch();
    this.hold = false;
  }

  // Esc or right-click: put the cast down, or bring the line home.
  cancel() {
    switch (this.state) {
      case 'aiming':
        this.state = 'idle';
        this.hooks.flash('Cast cancelled', 1.6);
        return true;
      case 'drifting':
      case 'bite':
        this.reelIn();
        return true;
      case 'reeling':
        this.eco.lostHooked(this.fight.agent);
        this.hooks.flash('You let the line go slack, and the fish swims free');
        this.fight = null;
        this.agent = null;
        this.reelIn();
        return true;
      default:
        return false;
    }
  }

  // Left/right while aiming swings the cast around, independent of the boat.
  aimBy(dir, dt) {
    if (this.state === 'aiming') this.aimOffset = clamp(this.aimOffset + dir * 1.3 * dt, -Math.PI, Math.PI);
  }

  get dragLevel() { return this.drags[this.rod.id] ?? this.rod.drag ?? DEFAULT_DRAG; }

  // While a fish is on, up/down tightens or loosens the reel's drag, a click at a time.
  dragBy(dir, dt) {
    if (!dir) {
      this.dragStep = 0;
      return;
    }
    this.dragStep -= dt;
    if (this.dragStep > 0) return;
    this.dragStep = 0.35;
    const next = clamp(this.dragLevel + (dir > 0 ? 1 : -1), 0, DRAG_LEVELS.length - 1);
    if (next === this.dragLevel) return;
    this.drags[this.rod.id] = next;
    if (this.fight) this.fight.drag = next;
    this.audio.tick(0.4);
    this.hooks.onDrag?.(next, this.rod);
  }

  // Up/down: how deep the bait hangs under the float, or how fast you reel a lure.
  depthBy(dir, dt) {
    if (this.state === 'reeling') {
      this.dragBy(dir, dt);
      return;
    }
    if (this.state !== 'aiming' && this.state !== 'drifting') return;
    if (this.kind === 'float') {
      const max = this.state === 'drifting' ? Math.max(0.4, this.bottom - 0.15) : 14;
      this.depth = clamp(this.depth - dir * 1.4 * dt, 0.4, max);
    } else if (this.kind === 'lure') {
      this.retrieve = clamp(this.retrieve + dir * 0.9 * dt, 0.35, 2.1);
    }
  }

  get info() {
    return {
      kind: this.kind, depth: this.baitDepth, target: this.depth, bottom: this.bottom, status: this.status,
      reeling: this.reelSpeed > 0.05, power: this.power, dist: this.castDist, valid: this.aimValid,
      retrieve: this.retrieveName, drag: !!this.r.drag, fouled: !!this.r.fouled, settled: !!this.r.settled,
      item: this.item, rod: this.rod,
    };
  }

  /* ---------- casting ---------- */

  landingPoint(power, out) {
    const a = this.angler;
    const [mn, mx] = castRange(this.rod, this.item);
    const dx = Math.sin(this.aimYaw), dz = Math.cos(this.aimYaw);
    const bx = a.pos.x + dx * 0.8, bz = a.pos.z + dz * 0.8;
    // Land it in water a fish could actually reach: very shallow margins don't count.
    const minDepth = this.kind === 'fly' ? 0.3 : 0.6;
    for (let d = mn + power * (mx - mn); d > 2.5; d -= 0.4) {
      const x = bx + dx * d, z = bz + dz * d;
      if (solidHeight(x, z) < -minDepth) {
        out.set(x, 0, z);
        this.castDist = d;
        return true;
      }
    }
    return false;
  }

  // The same arc is drawn while aiming and flown by the rig, so what you see is what you get.
  arcPoint(u, out) {
    out.lerpVectors(this.from, this.to, u);
    out.y += 4 * this.apex * u * (1 - u);
    return out;
  }

  apexFor(d) {
    if (this.kind === 'fly') return 0.5 + d * 0.06;
    if (this.kind === 'ledger') return 1.2 + d * 0.2;
    return 0.8 + d * 0.16;
  }

  cast() {
    if (!this.aimValid) {
      this.state = 'idle';
      this.hooks.flash(this.angler.onBoat ? 'Too close to the shore to cast that way' : 'Aim out over open water to cast');
      return;
    }
    this.aimCast();
    this.state = 'casting';
    this.t = 0;
    this.from.copy(this.tip);
    this.apex = this.apexFor(this.castDist);
    this.flight = this.kind === 'fly' ? 0.75 + this.castDist * 0.04 : 0.5 + this.castDist * 0.03;
    this.audio.cast(this.kind === 'fly' ? 0.5 : 1);
    this.hooks.onCast(this.kind);
  }

  // Where the cast really goes: a clean release flies true; a hurried one strays, and the wind
  // pushes light tackle downwind. It always comes down in fishable water.
  aimCast() {
    const a = this.angler;
    this.intended.copy(this.to);
    const dx = Math.sin(this.aimYaw), dz = Math.cos(this.aimYaw);
    const rx = -dz, rz = dx; // to the angler's right
    const prof = castProfile(this.rod, this.item);
    const d = this.castDist;
    const sloppy = 1 - this.release;
    const spread = prof.scatter * (d / 10) * (0.1 + 2.4 * sloppy) * (this.diff.cast ?? 1);
    const g = () => Math.random() + Math.random() - 1; // -1…1, mostly near 0
    const w = this.wind, push = w.strength * prof.windSens * d * 0.05;
    const wAlong = (w.x * dx + w.z * dz) * push, wAcross = (w.x * rx + w.z * rz) * push;
    const [mn, mx] = castRange(this.rod, this.item);
    let along = g() * spread * 0.8 + wAlong;
    along = clamp(d + along, mn * 0.6, mx * 1.08) - d;
    const across = g() * spread + wAcross;
    _v.set(this.intended.x + dx * along + rx * across, 0, this.intended.z + dz * along + rz * across);
    const minDepth = this.kind === 'fly' ? 0.3 : 0.6;
    let bank = false;
    if (solidHeight(_v.x, _v.z) >= -minDepth) {
      // Off line over the bank: it drops short, into the last water along its way.
      bank = true;
      const sx = a.pos.x, sz = a.pos.z;
      let found = false;
      for (let k = 1; k > 0.15; k -= 0.03) {
        const x = sx + (_v.x - sx) * k, z = sz + (_v.z - sz) * k;
        if (solidHeight(x, z) < -minDepth) {
          _v.set(x, 0, z);
          found = true;
          break;
        }
      }
      if (!found) _v.copy(this.intended);
    }
    this.to.set(_v.x, waveHeight(_v.x, _v.z), _v.z);
    const ox = this.to.x - this.intended.x, oz = this.to.z - this.intended.z;
    this.castMiss = { along: ox * dx + oz * dz, across: ox * rx + oz * rz, wind: Math.hypot(wAlong, wAcross), sloppy, bank };
    this.castDist = Math.hypot(this.to.x - a.pos.x, this.to.z - a.pos.z);
  }

  // A word on how the cast went.
  castFeedback() {
    const m = this.castMiss;
    if (!m) return;
    const miss = Math.hypot(m.along, m.across);
    let text, good = false;
    if (m.bank) text = 'Off line over the bank: it dropped short into the nearest water.';
    else if (miss < 0.8) {
      text = 'Right on the mark!';
      good = true;
    } else {
      const parts = [];
      if (Math.abs(m.along) >= 1) parts.push(m.along < 0 ? `${Math.round(-m.along)} m short` : `${Math.round(m.along)} m long`);
      if (Math.abs(m.across) >= 1) parts.push(`${Math.round(Math.abs(m.across))} m wide ${m.across > 0 ? 'right' : 'left'}`);
      if (!parts.length) parts.push('Just off the mark');
      text = parts.join(', ');
      text = text[0].toUpperCase() + text.slice(1) + '.';
      if (m.wind > 0.8 && m.wind > miss * 0.45) text += ' The wind carried it: aim a little into the wind.';
      else if (m.sloppy > 0.45) text += ' Let go as the meter slows at the top or bottom for a truer cast.';
    }
    this.hooks.castResult?.(text, good);
  }

  land(t) {
    this.castFeedback();
    this.state = 'drifting';
    this.t = 0;
    this.bob.set(this.to.x, waveHeight(this.to.x, this.to.z, t), this.to.z);
    this.hook.copy(this.bob);
    this.prevHook.copy(this.hook);
    this.lastSync.copy(this.hook);
    this.baitDepth = 0;
    this.reelSpeed = 0;
    this.relSpeed = 0;
    this.twitchT = 0;
    this.bottom = Math.max(0.25, -solidHeight(this.to.x, this.to.z));
    const splash = splashOf(this.rod, this.item);
    this.fx.ripple(this.bob.x, this.bob.z, 0.5 + splash * 0.35, 1.4, 0.3 + splash * 0.08);
    this.fx.splash(this.bob.x, 0.05, this.bob.z, Math.round(2 + splash * 3), 0.8 + splash * 0.3, 0.4 + splash * 0.08);
    this.audio.plop(this.kind === 'fly' ? 0.45 : this.kind === 'ledger' ? 1.4 : 1);
    // A splash right on top of fish sends them off; a little further away it draws attention.
    this.eco.startle(this.bob.x, -0.4, this.bob.z, splash, 0.8);
    this.r = {};
    if (this.kind === 'float') this.depth = Math.min(this.depth, Math.max(0.4, this.bottom - 0.15));
    else if (this.kind === 'lure') Object.assign(this.r, { moved: 0, pauseT: 9, wasMoving: false, fouled: false, bumpT: 0 });
    else if (this.kind === 'ledger') this.r.settled = false;
    else if (this.kind === 'fly') Object.assign(this.r, { lineLen: this.castDist + 1.6, drag: false });
    const it = this.item;
    Object.assign(this.eco.bait, {
      active: true, kind: this.kind, item: it.id, size: it.size, fly: it.fly || null, thick: this.rod.line.thick,
      fresh: 4, owner: null, held: false, twitch: 0, speed: 0, motion: 'still', pause: false, drag: false, fouled: false,
    });
    this.syncBait();
    this.agent = null;
    this.setStatus(this.kind === 'ledger' ? 'sinking' : 'quiet');
    this.quietT = 0;
    this.hintedQuiet = false;
  }

  twitch() {
    const b = this.eco.bait;
    const dx = this.tip.x - this.hook.x, dz = this.tip.z - this.hook.z, l = Math.hypot(dx, dz) || 1;
    switch (this.kind) {
      case 'float':
        this.twitchT = 0.5;
        this.dip = 0.1;
        b.twitch = 1.4;
        this.bob.x += (dx / l) * 0.3;
        this.bob.z += (dz / l) * 0.3;
        this.fx.ripple(this.bob.x, this.bob.z, 0.8, 0.9, 0.4);
        this.audio.nibble(0.6);
        break;
      case 'lure':
        this.twitchT = 0.45;
        b.twitch = 1.2;
        if (this.r.fouled && Math.random() < 0.45) {
          this.r.fouled = false;
          this.hooks.flash('You flick the weed off the lure', 2);
        }
        if (this.baitDepth < 0.4) this.fx.ripple(this.hook.x, this.hook.z, 0.5, 0.7, 0.3);
        this.audio.tick(0.8);
        break;
      case 'fly':
        this.twitchT = 0.35;
        b.twitch = 1;
        this.hook.x += (dx / l) * 0.25;
        this.hook.z += (dz / l) * 0.25;
        if (this.item.fly === 'dry') this.fx.ripple(this.hook.x, this.hook.z, 0.35, 0.6, 0.3);
        break;
      default:
        // A carp rig just sits there; a tap does nothing but tighten the line.
        this.rodBounce = 0.15;
    }
  }

  reelIn() {
    this.state = 'retrieving';
    this.t = 0;
    this.from.copy(this.kind === 'float' ? this.bob : this.hook);
    this.from.y = Math.max(this.from.y, waveHeight(this.from.x, this.from.z));
    this.audio.reelIn();
    this.audio.alarmRun?.(false);
    this.endBait();
  }

  endBait() {
    const b = this.eco.bait;
    if (b.owner && b.owner.state !== 'hooked' && b.owner.state !== 'caught') this.eco.disengage(b.owner, 'gone', 4);
    b.active = false;
    b.owner = null;
    b.held = false;
    if (!this.fight) this.agent = null;
    this.setStatus('quiet');
  }

  syncBait() {
    const b = this.eco.bait;
    // Its velocity over the ground (a drifting fly moves even when it's "still" in the water).
    b.vx = clamp((this.hook.x - this.lastSync.x) / this.frameDt, -4, 4);
    b.vz = clamp((this.hook.z - this.lastSync.z) / this.frameDt, -4, 4);
    this.lastSync.copy(this.hook);
    b.x = this.hook.x;
    b.y = this.hook.y;
    b.z = this.hook.z;
    b.anglerX = this.tip.x;
    b.anglerZ = this.tip.z;
    const sp = this.relSpeed;
    b.speed = sp + (this.twitchT > 0 ? 0.5 : 0);
    b.motion = this.twitchT > 0 ? 'twitch' : sp > 1.15 ? 'fast' : sp > 0.15 ? 'slow' : 'still';
    b.pause = !!this.r.pausing;
    b.drag = !!this.r.drag;
    b.fouled = !!this.r.fouled;
    b.nearBottom = this.baitDepth >= this.bottom - 0.7;
  }

  setStatus(s) {
    this.status = s;
    this.statusT = 0;
    if (s !== 'quiet' && s !== 'set') this.quietT = 0;
  }

  /* ---------- what the fish do ---------- */

  onCurious(a) {
    if (this.state !== 'drifting') return;
    this.agent = a;
    this.setStatus(this.kind === 'fly' && this.item.fly === 'dry' ? 'rising' : 'curious');
  }

  onFollow(a) {
    if (this.state !== 'drifting') return;
    this.agent = a;
    this.setStatus('follow');
    this.hooks.teach('follow', 'A fish is following your lure. A twitch or a short pause often makes it strike.');
  }

  onNibble(a) {
    if (this.state !== 'drifting' || a !== this.agent) return;
    if (this.kind === 'ledger') {
      // A single bleep from the alarm: something is moving the line.
      this.audio.alarm?.(1);
      this.rodBounce = 0.25;
      this.setStatus('bleep');
      return;
    }
    this.dip = rand(0.05, 0.09);
    this.fx.ripple(this.bob.x, this.bob.z, 0.6, 0.8, 0.35);
    this.audio.nibble();
    this.setStatus('nibble');
  }

  onBite(a, kind) {
    if (this.state !== 'drifting') return;
    this.state = 'bite';
    this.t = 0;
    this.agent = a;
    this.biteKind = kind;
    const shallow = this.hook.y > -1.3;
    switch (kind) {
      case 'strike':
        // Thump! A predator hits the lure. If you're reeling, it often hooks itself.
        if (shallow) this.fx.splash(this.hook.x, 0.05, this.hook.z, 10, 1.6, 0.6);
        this.fx.ripple(this.hook.x, this.hook.z, 1.4, 1.2, 0.5);
        this.audio.strike?.();
        this.rodBounce = 0.6;
        this.setStatus('strike');
        if (this.hold && this.reelSpeed > 0.15 && Math.random() < 0.75) {
          this.setHook();
          this.hooks.flash('It hit the lure and hooked itself! Keep reeling.', 2.4);
        }
        return;
      case 'run':
        this.audio.alarmRun?.(true);
        this.setStatus('run');
        return;
      case 'sip':
        this.fx.ripple(this.hook.x, this.hook.z, 0.9, 1.1, 0.5);
        this.audio.sip?.();
        this.setStatus('sip');
        return;
      case 'take':
        this.fx.ripple(this.bob.x, this.bob.z, 0.6, 0.8, 0.4);
        this.audio.nibble(1.2);
        this.setStatus('take');
        return;
      default:
        this.fx.splash(this.bob.x, 0.05, this.bob.z, 8, 1.4, 0.5);
        this.fx.ripple(this.bob.x, this.bob.z, 1.5, 1.3, 0.55);
        this.audio.bite();
        this.setStatus('bite');
    }
  }

  onLeave(a, reason) {
    if (a !== this.agent) return;
    const wasBite = this.state === 'bite';
    if (wasBite) {
      this.state = 'drifting';
      this.audio.alarmRun?.(false);
    }
    if (this.state !== 'drifting') return;
    this.agent = null;
    this.setStatus('quiet');
    if (wasBite) {
      const k = this.biteKind;
      this.hooks.flash(k === 'run' ? 'The run stops. It dropped the bait.' : k === 'strike' ? 'It let go of the lure. Too slow!' : k === 'sip' ? 'Too slow: it spat the fly.' : 'It let go of the bait. Another may come.');
    } else if (reason === 'turned') {
      this.hooks.flash('It followed all the way in, then turned away. Try a twitch, or a pause.', 3.6);
    } else if (reason === 'missed') {
      this.hooks.flash('A swirl behind the lure! Something missed it.', 3);
    } else if (reason === 'refused') {
      this.hooks.flash(this.r.drag ? 'A fish rose, looked, and refused it: the fly was dragging.' : 'A fish rose, looked, and refused the fly.', 3.2);
    } else if (reason === 'startled' || reason === 'spooked') this.hooks.flash('Something darted away.', 2);
  }

  setHook() {
    const a = this.agent;
    if (!a) return;
    this.eco.hook(a);
    this.audio.alarmRun?.(false);
    const sp = a.sp;
    // Weed, lilies, rocks or roots nearby give a running fish something to reach.
    const s = this.eco.habitat.sample(this.hook.x, this.hook.z);
    const cover = s.weed > 0.35 || s.rock > 0.4;
    this.fight = Object.assign(newFight(sp, a.size, { line: this.rod.line, power: this.rod.power, drag: this.dragLevel }, this.diff, cover), {
      sp, size: a.size, agent: a, lat: 0, dir: 1, splashT: 0, tickT: 0, slipT: 0, start: this.hook.clone(), end: this.fightEnd(), creaked: false,
    });
    this.state = 'reeling';
    this.t = 0;
    this.audio.hookSet();
    this.fx.splash(this.bob.x, 0.05, this.bob.z, 14, 2.2, 0.7);
    this.fx.ripple(this.bob.x, this.bob.z, 1.8, 1.2, 0.6);
    this.setStatus('hooked');
    this.hooks.onHook(this.fight);
  }

  // Fishing from the bank, the fish is brought to the nearest water deep enough to land it.
  fightEnd() {
    const a = this.angler;
    if (a.onBoat) return null;
    const dx = this.hook.x - a.pos.x, dz = this.hook.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
    for (let d = 0.5; d < l; d += 0.4) {
      const x = a.pos.x + (dx / l) * d, z = a.pos.z + (dz / l) * d;
      if (solidHeight(x, z) < -0.45) return new THREE.Vector3(x + (dx / l) * 0.6, 0, z + (dz / l) * 0.6);
    }
    return this.hook.clone();
  }

  // The line gives way: 'tension', 'drag', 'snag' or 'teeth' (see fight.js).
  snap(why) {
    const F = this.fight;
    this.eco.lostHooked(F.agent);
    this.fight = null;
    this.agent = null;
    this.audio.strain();
    this.hooks.shake(0.35);
    this.hooks.onSnap(why, F.sp, this.rod);
    this.reelIn();
  }

  landFish() {
    const F = this.fight;
    const mesh = this.fishMeshes[F.sp.id];
    this.eco.catchAgent(F.agent);
    this.eco.bait.active = false;
    this.state = 'landing';
    this.t = 0;
    this.from.copy(this.fishPos);
    mesh.visible = true;
    mesh.scale.setScalar(F.agent.scale);
    this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 18, 2.6);
    this.fx.ripple(this.fishPos.x, this.fishPos.z, 2.2, 1.6, 0.6);
    this.audio.splashBig();
  }

  letGo() {
    const mesh = this.fishMeshes[this.fight.sp.id];
    this.state = 'releasing';
    this.t = 0;
    this.from.copy(mesh.position);
    if (this.angler.onBoat) this.angler.releasePoint(this.to);
    else this.to.copy(this.fight.end || this.hook).setY(0);
    this.hooks.onRelease();
  }

  // Keep it for the pot. Returns false (with a note) if it can't be kept.
  keep() {
    if (this.state !== 'caught' || this.t < 0.4) return false;
    const F = this.fight;
    if (!F.sp.meal) {
      this.hooks.flash(F.sp.keep || 'Better to let this one go.', 3);
      return false;
    }
    if (!this.hooks.canKeep()) return false;
    this.state = 'keeping';
    this.t = 0;
    this.from.copy(this.fishMeshes[F.sp.id].position);
    this.eco.keep(F.agent);
    this.hooks.onKeep(F.sp, F.size);
    return true;
  }

  mouthOf(a, out) {
    const cp = Math.cos(a.pitch);
    return out.set(
      a.x + Math.sin(a.yaw) * cp * a.scale * 0.5,
      a.y + Math.sin(a.pitch) * a.scale * 0.5,
      a.z + Math.cos(a.yaw) * cp * a.scale * 0.5,
    );
  }

  /* ---------- per-frame ---------- */

  update(dt, t, camYaw, held) {
    this.t += dt;
    this.frameDt = Math.max(dt, 1e-3);
    this.statusT += dt;
    this.held = held;
    const A = this.angler, pose = A.pose;
    A.rodTip.getWorldPosition(this.tip);
    this.rodBounce = damp(this.rodBounce, 0, 5, dt);

    let rodPitch = this.kind === 'ledger' ? 1.15 : 0.85, bend = 0.05;
    let rodYaw = this.state === 'idle' ? 0 : clamp(wrapAngle(Math.atan2(this.bob.x - A.pos.x, this.bob.z - A.pos.z) - A.heading), -2, 2);
    const fishMesh = this.fight ? this.fishMeshes[this.fight.sp.id] : null;

    switch (this.state) {
      case 'aiming': {
        this.aimYaw = camYaw + this.aimOffset;
        // The meter swings up and back down; it slows at the top and bottom, where a release is cleanest.
        this.aimT += dt;
        const ph = (this.aimT / SWING) * Math.PI * 2;
        this.power = 0.5 - 0.5 * Math.cos(ph);
        this.release = 1 - Math.abs(Math.sin(ph));
        rodYaw = clamp(wrapAngle(this.aimYaw - A.heading), -2, 2);
        rodPitch = lerp(0.5, -0.45, smoothstep(0, 1, this.power));
        this.aimValid = this.landingPoint(this.power, this.to);
        if (this.aimValid) {
          this.to.y = waveHeight(this.to.x, this.to.z, t);
          this.from.copy(this.tip);
          this.apex = this.apexFor(this.castDist);
          for (let i = 0; i < ARC_N; i++) {
            this.arcPoint((i + 1) / ARC_N, _v);
            this.arcPos[i * 3] = _v.x;
            this.arcPos[i * 3 + 1] = _v.y;
            this.arcPos[i * 3 + 2] = _v.z;
          }
          this.arc.geometry.attributes.position.needsUpdate = true;
          this.aimRing.position.set(this.to.x, this.to.y + 0.05, this.to.z);
          const s = 0.7 + this.castDist * 0.03;
          this.aimRing.scale.set(s, 1, s);
        }
        this.bob.copy(this.tip).add(_v.set(0, -0.55, 0));
        break;
      }
      case 'casting': {
        const u = clamp(this.t / this.flight, 0, 1);
        rodPitch = this.t < 0.12 ? lerp(-0.45, 1.25, this.t / 0.12) : lerp(1.25, 0.85, smoothstep(0.12, 0.6, this.t));
        rodYaw = clamp(wrapAngle(this.aimYaw - A.heading), -2, 2);
        this.arcPoint(u, this.bob);
        if (u >= 1) this.land(t);
        break;
      }
      case 'drifting':
        if (this.kind === 'float') {
          rodPitch = 0.8;
          bend = 0.08 + this.reelSpeed * 0.1;
          this.updateFloat(dt, t);
        } else if (this.kind === 'lure') {
          rodPitch = 0.55 + Math.sin(t * 1.3) * 0.02;
          bend = 0.1 + this.reelSpeed * 0.12 + (this.twitchT > 0 ? 0.3 : 0) + (this.r.bumpT > 0 ? Math.sin(t * 40) * 0.04 : 0);
          this.updateLure(dt, t);
        } else if (this.kind === 'ledger') {
          rodPitch = 1.15;
          bend = 0.12 + this.rodBounce;
          this.updateLedger(dt, t);
        } else {
          rodPitch = 0.75;
          bend = 0.06 + this.reelSpeed * 0.06;
          this.updateFly(dt, t);
        }
        if (this.state === 'drifting') this.idleStatus(dt);
        break;
      case 'bite': {
        const a = this.agent;
        if (!a || a.state !== 'bite') {
          this.state = 'drifting';
          this.audio.alarmRun?.(false);
          break;
        }
        this.mouthOf(a, _v);
        const k = this.biteKind;
        this.hook.lerp(_v, 1 - Math.exp(-10 * dt));
        if (k === 'float') {
          rodPitch = 0.8;
          bend = 0.35 + Math.sin(t * 30) * 0.05;
          this.bob.x = damp(this.bob.x, _v.x, 3, dt);
          this.bob.z = damp(this.bob.z, _v.z, 3, dt);
          this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - 0.24 + Math.sin(t * 24) * 0.03;
        } else {
          rodPitch = k === 'run' ? 1.1 : 0.7;
          bend = (k === 'run' ? 0.5 + Math.min(this.t * 0.25, 0.4) : 0.3) + this.rodBounce + Math.sin(t * 28) * 0.04;
          if (k === 'take') this.bob.set(this.hook.x, waveHeight(this.hook.x, this.hook.z, t) - 0.1, this.hook.z);
          else this.surfacePoint(this.bob, t);
        }
        this.syncBait();
        break;
      }
      case 'reeling': {
        this.updateFight(dt, t, held);
        const F = this.fight;
        if (!F) break;
        rodPitch = 0.95 - F.tension * 0.25;
        bend = 0.25 + F.tension * 0.95 + (F.pulling ? Math.sin(t * 22) * 0.06 : 0);
        break;
      }
      case 'landing': {
        const hp = A.holdPoint(_w);
        const u = clamp(this.t / 0.8, 0, 1);
        fishMesh.position.lerpVectors(this.from, hp, smoothstep(0, 1, u));
        fishMesh.position.y += Math.sin(u * Math.PI) * 1.0;
        fishMesh.rotation.set(-1.25 + Math.sin(t * 14) * 0.15, A.heading + Math.PI / 2, 0, 'YXZ');
        fishMesh.userData.swim.set(t * 18, 1);
        rodPitch = 1.1;
        bend = 0.7;
        rodYaw = 0.2;
        if (u >= 1) {
          this.state = 'caught';
          this.t = 0;
          this.hooks.onCatch(this.fight.sp, this.fight.size, this.fight.agent, { rod: this.rod, item: this.item });
        }
        break;
      }
      case 'caught': {
        const hp = A.holdPoint(_w);
        fishMesh.position.copy(hp);
        fishMesh.position.y += Math.sin(t * 2) * 0.03;
        const wig = Math.sin(t * 9) * Math.max(0, Math.sin(t * 1.3)) * 0.25;
        fishMesh.rotation.set(-1.2 + wig * 0.3, A.heading + Math.PI / 2 + wig, 0, 'YXZ');
        fishMesh.userData.swim.set(t * 10, 0.4 * Math.max(0.2, Math.sin(t * 1.3)));
        rodPitch = 1.15;
        bend = 0.6;
        rodYaw = 0.2;
        break;
      }
      case 'releasing': {
        const u = clamp(this.t / 0.65, 0, 1);
        fishMesh.position.lerpVectors(this.from, this.to, u);
        fishMesh.position.y = lerp(this.from.y, -0.3, u) + Math.sin(u * Math.PI) * 0.6;
        fishMesh.rotation.set(lerp(-1.2, 1.3, u), A.heading + Math.PI / 2, 0, 'YXZ');
        rodPitch = 0.9;
        if (u >= 1) {
          fishMesh.visible = false;
          this.fx.splash(this.to.x, 0.05, this.to.z, 12, 2);
          this.fx.ripple(this.to.x, this.to.z, 2, 1.6, 0.6);
          this.audio.plop(1.3);
          this.eco.release(this.fight.agent, this.to.x, this.to.z);
          this.fight = null;
          this.agent = null;
          this.state = 'idle';
        }
        break;
      }
      case 'keeping': {
        // Into the creel on your back (or the bucket in the boat).
        const u = clamp(this.t / 0.5, 0, 1);
        A.holdPoint(_w);
        _w.x -= Math.sin(A.heading) * 0.6;
        _w.z -= Math.cos(A.heading) * 0.6;
        fishMesh.position.lerpVectors(this.from, _w, smoothstep(0, 1, u));
        fishMesh.scale.setScalar(this.fight.agent.scale * (1 - u * 0.9));
        rodPitch = 0.9;
        if (u >= 1) {
          fishMesh.visible = false;
          this.audio.chime?.();
          this.fight = null;
          this.agent = null;
          this.state = 'idle';
        }
        break;
      }
      case 'retrieving': {
        const u = clamp(this.t / 0.45, 0, 1);
        this.bob.lerpVectors(this.from, this.tip, u * u);
        this.bob.y += Math.sin(u * Math.PI) * 0.6;
        this.hook.copy(this.bob);
        if (u >= 1) this.state = 'idle';
        break;
      }
      default:
    }

    pose.fishing = damp(pose.fishing, this.state === 'idle' ? 0 : 1, this.state === 'idle' ? 5 : 9, dt);
    pose.rodYaw = this.state === 'aiming' ? rodYaw : damp(pose.rodYaw, rodYaw, 6, dt);
    pose.rodPitch = damp(pose.rodPitch, rodPitch, 16, dt);
    pose.bend = damp(pose.bend, bend, 10, dt);

    this.updateVisuals(t, dt, fishMesh);
  }

  // Where the line meets the water on its way from the rod tip down to the hook.
  surfacePoint(out, t) {
    const th = Math.max(0.5, this.tip.y - waveHeight(this.tip.x, this.tip.z, t));
    const k = this.baitDepth / (this.baitDepth + th);
    out.lerpVectors(this.hook, this.tip, k);
    out.y = waveHeight(out.x, out.z, t);
    return out;
  }

  idleStatus(dt) {
    if (this.status === 'nibble' && this.statusT > 1.5) this.setStatus(this.agent ? 'curious' : 'quiet');
    if (this.status === 'bleep' && this.statusT > 2.5) this.setStatus(this.agent ? 'curious' : 'set');
    if ((this.status === 'curious' || this.status === 'follow' || this.status === 'rising') && !this.agent) this.setStatus('quiet');
    if (this.status === 'quiet' || this.status === 'set') {
      this.quietT += dt;
      // Carp take patience: give a bottom rig longer before suggesting anything.
      if (this.quietT > (this.kind === 'ledger' ? 75 : 25) && !this.hintedQuiet) {
        this.hintedQuiet = true;
        this.hooks.quiet(this.kind, this.item);
      }
    }
  }

  // The original: a bait hanging under a float.
  updateFloat(dt, t) {
    if (this.hold) this.holdT += dt;
    // Holding reels in: gently at first, then steadily.
    const reeling = this.hold && this.holdT > TAP;
    this.reelSpeed = damp(this.reelSpeed, reeling ? lerp(0.45, 1.9, smoothstep(TAP, 1.8, this.holdT)) : 0, 6, dt);
    this.relSpeed = this.reelSpeed;
    if (this.reelSpeed > 0.01) {
      const dx = this.tip.x - this.bob.x, dz = this.tip.z - this.bob.z, l = Math.hypot(dx, dz);
      if (l < 2.6 || (!this.angler.onBoat && this.bottom < 0.3 && l < 8)) {
        this.reelIn();
        return;
      }
      this.bob.x += (dx / l) * this.reelSpeed * dt;
      this.bob.z += (dz / l) * this.reelSpeed * dt;
      if (Math.random() < dt * 14 * this.reelSpeed) this.audio.tick(0.5);
    } else {
      // A float drifts slowly with the breeze, or with the current in the stream.
      streamFlow(this.bob.x, this.bob.z, this.flow);
      this.bob.x += (0.03 + this.flow.x * 0.8) * dt;
      this.bob.z += this.flow.z * 0.8 * dt;
    }
    this.dip = damp(this.dip, 0, 8, dt);
    this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - this.dip;
    this.bottom = Math.max(0.3, -solidHeight(this.hook.x, this.hook.z));

    // The bait hangs below the float at the chosen depth; reeling lifts it a little.
    let want = Math.min(this.depth, Math.max(0.3, this.bottom - 0.15));
    if (this.reelSpeed > 0.1) want = Math.min(want, lerp(want, 0.6, this.reelSpeed / 2.5));
    const rate = want > this.baitDepth ? 0.7 : 1.1;
    this.baitDepth += clamp(want - this.baitDepth, -rate * dt, rate * dt);
    this.hook.x = damp(this.hook.x, this.bob.x, 1.6, dt);
    this.hook.z = damp(this.hook.z, this.bob.z, 1.6, dt);
    this.hook.y = this.bob.y - this.baitDepth;
    if (this.twitchT > 0) {
      this.twitchT -= dt;
      this.hook.y += Math.sin((this.twitchT / 0.5) * Math.PI) * 0.25;
    }
    // The float rocks gently on the surface and sends out the faintest rings.
    this.idleRingT = (this.idleRingT ?? 1) - dt;
    if (this.idleRingT <= 0) {
      this.idleRingT = 1.3 + Math.random() * 1.8;
      this.fx.ripple(this.bob.x, this.bob.z, 0.3, 1.5, this.reelSpeed > 0.1 ? 0.22 : 0.12);
    }
    this.syncBait();
  }

  // A lure: hold to reel at your chosen speed (W/S), tap to twitch, let go to pause.
  // Crankbaits float up when you stop and dive as you reel; spinners sink while you
  // wait; a jerkbait hangs where it is.
  updateLure(dt, t) {
    const r = this.r, it = this.item;
    if (this.hold) this.holdT += dt;
    const reeling = this.hold && this.holdT > TAP;
    this.reelSpeed = damp(this.reelSpeed, reeling ? this.retrieve : 0, 5, dt);
    const dx = this.tip.x - this.hook.x, dz = this.tip.z - this.hook.z, l = Math.hypot(dx, dz) || 1;
    let move = this.reelSpeed;
    if (this.twitchT > 0) {
      this.twitchT -= dt;
      move += 1.5 * (this.twitchT / 0.45);
    }
    if (move > 0.01) {
      if (l < 2.4 || (!this.angler.onBoat && this.bottom < 0.25 && l < 8)) {
        this.reelIn();
        return;
      }
      this.hook.x += (dx / l) * move * dt;
      this.hook.z += (dz / l) * move * dt;
      r.moved += move * dt;
      if (Math.random() < dt * 14 * this.reelSpeed) this.audio.tick(0.45);
    }
    this.relSpeed = move;
    const moving = this.reelSpeed > 0.12;
    if (moving) {
      r.pauseT = 0;
      r.wasMoving = true;
    } else r.pauseT += dt;
    r.pausing = r.wasMoving && !moving && r.pauseT < 1.4;
    if (!moving && r.pauseT > 1.4) r.wasMoving = false;

    this.bottom = Math.max(0.15, -solidHeight(this.hook.x, this.hook.z));
    let want, rate;
    if (it.action === 'flash') {
      if (moving) { want = clamp(1.8 - this.reelSpeed * 0.8, 0.25, 1.6); rate = 0.6; } else { want = this.bottom; rate = it.sink; }
    } else if (it.action === 'wobble') {
      if (moving) { want = it.dive * smoothstep(0, 5, r.moved) * clamp(0.55 + this.reelSpeed * 0.4, 0.6, 1.15); rate = 0.9; } else { want = 0; rate = 0.22; }
    } else {
      if (this.twitchT > 0) { want = it.suspend + 0.25; rate = 1.2; } else if (moving) { want = it.suspend * 0.9; rate = 0.6; } else { want = it.suspend; rate = 0.15; }
    }
    const cap = this.bottom - 0.08;
    want = Math.min(want, cap);
    this.baitDepth += clamp(want - this.baitDepth, -rate * dt, rate * dt);
    this.baitDepth = clamp(this.baitDepth, 0, Math.max(0, cap));
    // Bumping along the bottom: a crankbait knocking stones is irresistible; weed fouls it.
    r.bumpT = Math.max(0, r.bumpT - dt);
    if (moving && this.baitDepth >= cap - 0.03 && cap > 0.2) {
      if (r.bumpT <= 0 && Math.random() < dt * 4) {
        r.bumpT = 0.25;
        this.audio.tick(0.3);
        const s = this.eco.habitat.sample(this.hook.x, this.hook.z);
        if (s.weed > 0.55 && Math.random() < 0.18 && !r.fouled) {
          r.fouled = true;
          this.hooks.flash('Weed on the lure. Reel it in (or twitch it) to clear it.', 3.2);
        } else if (s.rock > 0.4) this.eco.bait.twitch = 0.4;
      }
    }
    this.hook.y = waveHeight(this.hook.x, this.hook.z, t) - this.baitDepth;
    // A lure working just under the surface leaves a small wake.
    if (moving && this.baitDepth < 0.45) {
      this.wakeT = (this.wakeT ?? 0) - dt;
      if (this.wakeT <= 0) {
        this.wakeT = 0.16;
        this.fx.ripple(this.hook.x, this.hook.z, 0.45, 1.0, 0.2 * (1 - this.baitDepth / 0.45));
      }
    }
    this.surfacePoint(this.bob, t);
    this.syncBait();
  }

  // A carp rig: it sinks to the bottom and stays put. Hold to wind it back in.
  updateLedger(dt, t) {
    const r = this.r;
    if (this.hold) this.holdT += dt;
    const reeling = this.hold && this.holdT > TAP;
    this.reelSpeed = damp(this.reelSpeed, reeling ? 1.3 : 0, 5, dt);
    this.relSpeed = this.reelSpeed;
    if (this.reelSpeed > 0.05) {
      const dx = this.tip.x - this.hook.x, dz = this.tip.z - this.hook.z, l = Math.hypot(dx, dz) || 1;
      if (l < 3 || (!this.angler.onBoat && this.bottom < 0.3 && l < 8)) {
        this.reelIn();
        return;
      }
      this.hook.x += (dx / l) * this.reelSpeed * dt;
      this.hook.z += (dz / l) * this.reelSpeed * dt;
      if (Math.random() < dt * 12 * this.reelSpeed) this.audio.tick(0.5);
    }
    this.bottom = Math.max(0.25, -solidHeight(this.hook.x, this.hook.z));
    if (!r.settled) {
      this.baitDepth = Math.min(this.baitDepth + 2.4 * dt, this.bottom - 0.03);
      if (this.baitDepth >= this.bottom - 0.04) {
        r.settled = true;
        this.audio.alarm?.(0.4);
        this.setStatus('set');
      }
    } else this.baitDepth = this.bottom - 0.03;
    this.hook.y = waveHeight(this.hook.x, this.hook.z, t) - this.baitDepth;
    this.surfacePoint(this.bob, t);
    this.syncBait();
  }

  // A fly. Dry flies and nymphs drift with the current; when the line runs out of slack the
  // fly is dragged across the water, which trout distrust. Hold to strip line back in.
  updateFly(dt, t) {
    const r = this.r, it = this.item;
    if (this.hold) this.holdT += dt;
    const strip = this.hold && this.holdT > TAP;
    this.reelSpeed = strip ? 1 : 0;
    streamFlow(this.hook.x, this.hook.z, this.flow);
    let fx = this.flow.x, fz = this.flow.z;
    if (Math.abs(fx) + Math.abs(fz) < 0.01) fx = 0.02; // a breath of wind on still water
    if (it.fly === 'nymph') { fx *= 0.85; fz *= 0.85; }
    this.prevHook.copy(this.hook);
    if (strip) r.lineLen = Math.max(1, r.lineLen - (it.fly === 'streamer' ? 0.5 + Math.max(0, Math.sin(t * 7)) * 1.4 : 0.8) * dt);
    this.hook.x += fx * dt;
    this.hook.z += fz * dt;
    if (this.twitchT > 0) this.twitchT -= dt;
    const dx = this.hook.x - this.tip.x, dz = this.hook.z - this.tip.z, l = Math.hypot(dx, dz) || 1;
    const flowing = Math.hypot(this.flow.x, this.flow.z) > 0.08;
    r.drag = false;
    if (l > r.lineLen) {
      this.hook.x = this.tip.x + (dx / l) * r.lineLen;
      this.hook.z = this.tip.z + (dz / l) * r.lineLen;
      r.drag = it.fly !== 'streamer' && (flowing || strip);
    }
    if (r.lineLen < 2.4 || l < 2) {
      this.reelIn();
      return;
    }
    // How fast it moves through the water (a fly drifting with the current is "still").
    this.relSpeed = Math.hypot((this.hook.x - this.prevHook.x) / dt - this.flow.x, (this.hook.z - this.prevHook.z) / dt - this.flow.z);
    this.bottom = Math.max(0.2, -solidHeight(this.hook.x, this.hook.z));
    if (it.fly === 'dry') this.baitDepth = 0;
    else {
      const want = Math.min(strip ? it.sink * 0.6 : it.sink, this.bottom - 0.08);
      this.baitDepth += clamp(want - this.baitDepth, -0.4 * dt, (it.fly === 'nymph' ? 0.25 : 0.4) * dt);
    }
    const wy = waveHeight(this.hook.x, this.hook.z, t);
    this.hook.y = it.fly === 'dry' ? wy + 0.005 : wy - this.baitDepth;
    if (it.fly === 'nymph') this.bob.set(this.hook.x - dx / l * 0.4, wy, this.hook.z - dz / l * 0.4);
    else if (it.fly === 'dry') this.bob.copy(this.hook);
    else this.surfacePoint(this.bob, t);
    if (r.drag && it.fly === 'dry' && Math.random() < dt * 5) this.fx.ripple(this.hook.x, this.hook.z, 0.3, 0.5, 0.25);
    if (r.drag && !strip && flowing) this.hooks.teach('drag', 'The fly is dragging across the current, and trout distrust that. Cast upstream of them and let it drift down.');
    this.syncBait();
  }

  updateFight(dt, t, held) {
    const F = this.fight;
    const diff = this.steady < 1 ? { ...this.diff, shock: this.diff.shock * this.steady } : this.diff;
    const ev = stepFight(F, held, dt, diff);
    if (ev && ev.startsWith('snap:')) {
      this.snap(ev.slice(5));
      return;
    }
    if (ev === 'run') {
      F.dir = Math.random() < 0.5 ? -1 : 1;
      F.creaked = false;
    }
    // A flick on the surface just before each run, so it can be read in time.
    if (ev === 'warn') {
      this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 6, 1.6, 0.5);
      this.fx.ripple(this.fishPos.x, this.fishPos.z, 1.0, 0.9, 0.5);
      this.audio.flick();
    }
    // The line creaks when it's close to its limit.
    if (F.tension > 0.86 && !F.creaked) {
      F.creaked = true;
      this.audio.strain();
      this.hooks.shake(0.2);
      this.hooks.flash('The line creaks! Ease off: it’s close to breaking.', 2.4);
    }
    // The drag giving line: a fast ratchet.
    if (F.slipping) {
      F.slipT -= dt;
      if (F.slipT <= 0) {
        this.audio.tick(0.55);
        F.slipT = 0.05;
      }
    }
    if (held) {
      F.tickT -= dt;
      if (F.tickT <= 0) {
        this.audio.tick(F.pulling ? 0.7 : 1);
        F.tickT = F.pulling ? 0.12 : 0.065;
      }
    }

    // The fish swims where the fight takes it, closer to you and the surface as you win.
    const b = this.angler.pos;
    let dx = F.start.x - b.x, dz = F.start.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const e = 1 - Math.pow(1 - F.progress, 1.5);
    const ex = F.end ? F.end.x : b.x + dx * 2.6, ez = F.end ? F.end.z : b.z + dz * 2.6;
    const cx = lerp(F.start.x, ex, e), cz = lerp(F.start.z, ez, e);
    F.lat = damp(F.lat, F.pulling ? F.dir * 2.2 * (1 - F.progress * 0.6) : 0, 1.4, dt);
    const wig = Math.sin(t * 6.5) * 0.15;
    let x = cx - dz * (F.lat + wig), z = cz + dx * (F.lat + wig);
    // Don't let it swim up onto the bank.
    if (solidHeight(x, z) > -0.35) {
      x = cx;
      z = cz;
    }
    const floor = solidHeight(x, z) + 0.3;
    const y = Math.min(Math.max(lerp(F.start.y, -0.35, e) - (F.pulling ? 0.45 : 0), floor), -0.2);
    this.fishPos.set(x, y, z);
    const away = Math.atan2(x - b.x, z - b.z);
    this.eco.placeHooked(F.agent, x, y, z, away + (F.pulling ? F.lat * 0.15 : F.dir * 1.6), F.pulling ? 1 : 0.5);
    this.mouthOf(F.agent, this.hook);
    if (this.kind === 'float' || (this.kind === 'fly' && this.item.fly === 'nymph')) this.bob.set(x, waveHeight(x, z, t) - (F.pulling ? 0.16 : 0.06), z);
    else this.bob.set(x, waveHeight(x, z, t), z);
    if (F.pulling) {
      F.splashT -= dt;
      if (F.splashT <= 0) {
        F.splashT = rand(0.2, 0.4);
        if (y > -1.2) this.fx.splash(x, 0.05, z, 5, 1.6, 0.6);
        this.fx.ripple(x, z, 1.0, 1.0, 0.4);
        this.audio.splashSmall();
      }
    }
    if (F.progress >= 1) this.landFish();
  }

  updateVisuals(t, dt, fishMesh) {
    const s = this.state, kind = this.kind, it = this.item;
    const holdingFish = s === 'landing' || s === 'caught' || s === 'keeping';
    const lineVisible = s !== 'idle' && s !== 'releasing' && s !== 'keeping';
    const inWater = this.baitInWater;
    const flying = s === 'aiming' || s === 'casting' || s === 'retrieving';

    // The float (float rods), the indicator (nymphs), the lead (carp rigs).
    this.bobber.visible = lineVisible && !holdingFish && kind === 'float';
    this.bobber.position.copy(this.bob);
    this.bobber.rotation.z = Math.sin(t * 1.7) * 0.12;
    this.bobber.rotation.x = Math.sin(t * 1.3 + 1) * 0.1;
    this.indicator.visible = lineVisible && !holdingFish && kind === 'fly' && it?.fly === 'nymph' && !flying;
    this.indicator.position.copy(this.bob);
    this.lead.visible = inWater && kind === 'ledger' && s !== 'reeling';
    if (this.lead.visible) this.lead.position.set(this.hook.x + 0.18, this.hook.y + 0.02, this.hook.z + 0.1);

    this.line.visible = lineVisible;
    if (lineVisible) {
      let end = this.bob, sag = 0.35;
      if (holdingFish) {
        end = fishMesh.localToWorld(_v.set(0, 0, 0.5));
        sag = 0.02;
      } else if (s === 'aiming') sag = 0;
      else if (s === 'casting' || s === 'retrieving') sag = 0.12;
      else if (s === 'reeling') sag = (1 - this.fight.tension) * 0.3;
      else if (kind === 'lure' || kind === 'ledger') sag = 0.06 + (this.reelSpeed > 0.1 ? 0 : 0.12);
      else if (kind === 'fly') sag = 0.25 + this.tip.distanceTo(this.bob) * 0.02;
      else sag = 0.35 + this.tip.distanceTo(this.bob) * 0.015;
      if (s === 'bite' && this.biteKind !== 'float') sag = 0.02;
      this.setLine(this.tip, end, sag);
    }

    // Underwater line from the float/indicator, or from where the line enters, to the hook.
    const leader = inWater && s !== 'reeling' && !(kind === 'fly' && it?.fly === 'dry');
    this.leader.visible = leader;
    if (leader) {
      const top = kind === 'float' ? 0.26 : 0.02;
      this.leaderPos.set([this.bob.x, this.bob.y, this.bob.z, this.hook.x, this.hook.y + top, this.hook.z]);
      this.leader.geometry.attributes.position.needsUpdate = true;
    }

    const m = this.model;
    if (m) {
      m.visible = lineVisible && !holdingFish && s !== 'reeling';
      if (inWater) m.position.copy(this.hook);
      else if (kind === 'float') m.position.copy(this.bob).add(_w.set(0, -0.3, 0));
      else m.position.copy(this.bob);
      if (it.type === 'lure' || it.type === 'fly') {
        // Lures and flies face where they're going: towards you as they come in.
        m.rotation.set(0, Math.atan2(this.tip.x - m.position.x, this.tip.z - m.position.z), 0);
        if (it.action === 'wobble') m.rotation.z = Math.sin(t * 22) * 0.35 * Math.min(1, this.relSpeed);
        if (it.action === 'dart' && this.twitchT > 0) m.rotation.y += Math.sin(this.twitchT * 20) * 0.6;
        if (m.userData.spin) m.userData.spin.rotation.z += dt * (6 + this.relSpeed * 30);
      } else m.rotation.set(0, t * 0.6, 0);
    }

    const aimOn = s === 'aiming' && this.aimValid;
    const k = 1 - Math.exp(-10 * dt);
    this.aimRing.material.opacity += ((aimOn ? 0.65 : 0) - this.aimRing.material.opacity) * k;
    this.arc.material.opacity += ((aimOn ? 0.75 : 0) - this.arc.material.opacity) * k;
    this.aimRing.visible = this.aimRing.material.opacity > 0.01;
    this.arc.visible = this.arc.material.opacity > 0.01;
  }

  setLine(a, b, sag) {
    const P = this.linePos;
    for (let i = 0; i < LINE_N; i++) {
      const u = i / (LINE_N - 1);
      P[i * 3] = lerp(a.x, b.x, u);
      P[i * 3 + 1] = lerp(a.y, b.y, u) - sag * 4 * u * (1 - u);
      P[i * 3 + 2] = lerp(a.z, b.z, u);
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
