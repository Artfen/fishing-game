import * as THREE from 'three';
import { FISH, buildFishMesh } from './fish.js';
import { waveHeight } from './world/water.js';
import { currentAt, windAt, currentScale } from './world/conditions.js';
import { solidHeight, depthAt, waterLevel } from './world/terrain.js';
import { RODS, TACKLE, TERMS, LINE_COLORS, castRange, windSensitivity, splashOf, checkSetup, castWeight } from './tackle.js';
import { buildTackleModel, buildFloat, buildIndicator, buildLead } from './tackleModels.js';
import { clamp, lerp, damp, rand, smoothstep, wrapAngle, glowTexture } from './util.js';
import { newFight, stepFight, DIFFICULTY, DRAG_LEVELS, DEFAULT_DRAG } from './fight.js';
import { CAST_SPEED } from './throttle.js';
import { FishLine } from './fishline.js';
import { BEHAVIOUR, prefsFor } from './behaviour.js';

// The line as drawn: from the reel up through the rod's guides to its tip (ROD_PTS), then out
// to the float, lure or fish as a light string that hangs, blows and floats (LINE_PTS, see
// fishline.js).
const ROD_PTS = 6;
const LINE_PTS = 30;
const LINE_N = ROD_PTS + LINE_PTS;
const STRAINED = new THREE.Color('#ff6a3d'); // the line's colour as it nears its breaking strain
const ARC_N = 24;
const TAP = 0.22; // a press shorter than this is a twitch; longer is reeling
const SWEET_HOLD = 0.4; // manual casting: how long the rod stays fully loaded before it overloads
const OVERLOAD = 0.9;   // …and how long more until the cast collapses completely
const FLY_CYCLE = 1.15; // one back-and-forward false cast with the fly rod
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
    this.assist = true;  // assisted casting (set from Settings): no overload, the wind allowed for
    this.sweet = false;  // manual casting: the rod is fully loaded, a release now flies furthest
    this.overload = 0;   // manual casting: held too long, the cast collapses (0…1)
    this.flyLine = 0;    // fly casting: line out in the false casts
    this.flyPhase = 0;
    this.deliver = false; // assisted fly cast: let go, and it goes out on the next forward stroke
    this.plan = { ok: false };   // where a release right now would land, and why
    this.intended = new THREE.Vector3();
    this.drift = new THREE.Vector3();
    this.castMiss = null;
    this.wind = { x: 0, z: 0, strength: 0 }; // where the wind blows towards, set by the game
    this.aimOffset = 0;
    this.aimYaw = 0;
    this.castDist = 0;
    this.aimValid = false;
    this.apex = 1;
    this.flight = 1;
    this.lineLen = 0;    // line out from the rod tip to the rig (a moving boat tows the rig on it)
    this.towSpeed = 0;   // how fast the boat is towing the rig through the water
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
    // First person (set by the game): the camera position, so the float can be drawn a little
    // larger far away and stay readable from eye height, and how long you hold a landed fish
    // up in front of you before the card.
    this.viewer = null;
    this.admire = 0;
    this.lineEnd = new THREE.Vector3();
    // How fussy the fish are, and whether a hooked one can come off (the Fish behaviour setting).
    this.level = BEHAVIOUR.relaxed;
    // Side pressure while a fish is on: the rod swung to your left (−1) or right (+1).
    this.side = 0;
    // The line out, hanging, blowing and floating (fishline.js), how slack it is, and how much it
    // thrums near its breaking strain; where it pulls the rod tip (the rod bends that way).
    this.fishLine = new FishLine(LINE_PTS);
    this.waveT = 0;
    this.lineWorld = {
      surface: (x, z) => Math.max(waveHeight(x, z, this.waveT), solidHeight(x, z) + 0.03),
      wind: (x, z, out) => {
        const w = windAt(x, z);
        out.x = w.x * 0.45;
        out.z = w.z * 0.45;
      },
      flow: (x, z, out) => {
        const c = currentAt(x, z, 0), k = currentScale();
        out.x = c.x * k;
        out.z = c.z * k;
      },
    };
    this.lineBuzz = 0;
    this.bendAt = new THREE.Vector3();
    // What the reel and line are doing, for the sound and the turning spool: line going out
    // against the drag (m/s), line being wound in (m/s), the load (0 … 1 of the breaking strain),
    // the drag setting (0 … 1), and the line singing as it nears breaking (0 … 1).
    this.reelFx = { payout: 0, wind: 0, load: 0, drag: 0, sing: 0, free: false };

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
    this.ghostRing = new THREE.Mesh(
      new THREE.RingGeometry(0.46, 0.5, 36).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: '#fff6e0', transparent: true, opacity: 0, depthWrite: false }),
    );
    this.ghostRing.renderOrder = 3;
    scene.add(this.ghostRing);
    this.ghostShow = false;
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
      onLeave: (a, reason, why) => this.onLeave(a, reason, why),
      onSpooked: (a) => this.hooks.spooked?.(a),
    };
    this.setRig({ ...RODS.float, line: { ...RODS.float.lines[0], trace: false } }, TACKLE.worm, TERMS.waggler);
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

  // Change rod or tackle. Only between casts. rod carries the line in use (see lineInUse),
  // term the float, rig, leader or tippet.
  setRig(rod, item, term = TERMS[rod.terms?.[0]] || TERMS.none) {
    if (this.busy) return false;
    this.rod = rod;
    this.item = item;
    this.term = term;
    this.kind = rod.kind;
    this.problems = checkSetup(rod, item, term);
    this.lineColor = new THREE.Color(LINE_COLORS[this.kind]);
    this.line.material.color.copy(this.lineColor);
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
      case 'idle': {
        // An impossible setup is explained before the cast, not after.
        const block = this.problems.find((p) => p.level === 'block');
        if (block) {
          this.hooks.flash(`${block.text} ${this.hooks.key('pack')} opens your backpack.`, 4);
          return;
        }
        // From a moving boat: fine up to about trolling speed. Faster, the game may ease the
        // throttle back for you (and you aim while she slows); otherwise, slow down first.
        const eased = this.angler.onBoat && this.hooks.easeForCast?.();
        if (this.angler.onBoat && this.angler.speed > CAST_SPEED && !eased) {
          this.hooks.flash('Too fast to cast from here: slow down (or let her drift down) first');
          return;
        }
        this.state = 'aiming';
        this.t = 0;
        this.power = 0;
        this.aimT = 0;
        this.aimOffset = 0;
        this.overload = 0;
        this.sweet = false;
        this.deliver = false;
        this.flyLine = Math.max(4, this.rod.cast[0]);
        this.flyPhase = 0;
        const warn = this.problems.find((p) => p.level === 'warn');
        if (warn) this.hooks.flash(warn.text, 3.5);
        break;
      }
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
    if (this.state === 'aiming') {
      if (this.kind === 'fly') this.releaseFly();
      else this.cast();
    } else if (this.state === 'drifting' && this.hold && this.holdT < TAP) this.twitch();
    this.hold = false;
  }

  // Esc or right-click: put the cast down, or bring the line home.
  cancel() {
    switch (this.state) {
      case 'aiming':
        this.state = 'idle';
        this.deliver = false;
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

  // Where a cast released right now would land, and why. The rod and what it carries set the
  // range; how long you held sets the distance; in manual casting, letting go while the rod is
  // fully loaded adds a little, holding on past that overloads it and the cast collapses short
  // and to the right; the wind pushes light tackle (assisted casting allows for it). Banks
  // and branches along the way stop the cast. No dice: the same release lands the same place.
  planCast(power, out = this.plan) {
    const a = this.angler;
    const [mn, mx] = castRange(this.rod, this.item, this.term);
    const dx = Math.sin(this.aimYaw), dz = Math.cos(this.aimYaw);
    const rx = -dz, rz = dx; // to the angler's right
    const fly = this.kind === 'fly';
    const manual = !this.assist;
    let d = fly ? this.flyLine : mn + power * (mx - mn);
    const aimD = d;
    const bonus = manual && !fly && this.sweet ? 0.06 : 0;
    const collapse = manual ? (fly ? this.flyCollapse ?? 0 : this.overload) : 0;
    d *= (1 + bonus) * (1 - 0.4 * collapse);
    // The wind on the rig in flight: more on light tackle, a longer cast and a stronger wind (the
    // wind where you stand, gusts and all: the preview moves with it, so what you see is what you get).
    const w = this.wind, push = w.strength * windSensitivity(this.rod, this.item, this.term) * (this.diff.cast ?? 1) * d * 0.085;
    const wAlong = (w.x * dx + w.z * dz) * push, wAcross = (w.x * rx + w.z * rz) * push;
    const veer = collapse * d * 0.12 * (this.diff.cast ?? 1);
    const along = d + (manual ? wAlong : 0), across = (manual ? wAcross : 0) + veer;
    const bx = a.pos.x + dx * 0.8, bz = a.pos.z + dz * 0.8;
    let x = bx + dx * along + rx * across, z = bz + dz * along + rz * across;
    // From a moving boat the rig leaves the rod with the boat's way on it, and keeps most of it
    // through the air: it lands carried along in the direction the boat is going (the preview
    // shows it).
    let carry = 0;
    if (a.onBoat && a.vel) {
      const flight = fly ? 0.75 + d * 0.04 : 0.5 + d * 0.03;
      x += a.vel.x * flight * 0.85;
      z += a.vel.z * flight * 0.85;
      carry = Math.hypot(a.vel.x, a.vel.z) * flight * 0.85;
    }
    const minDepth = fly ? 0.3 : 0.6;
    const wet = (px, pz) => depthAt(px, pz) > minDepth;
    // (The flight comes down to the water where it lands: the sea, or a pool up the Coldwater.)
    const landY = waveHeight(x, z);
    let obstruct = null;
    // Along the flight: a hill or high bank in the way, or a tree's crown.
    this.from.copy(this.tip);
    const apex = this.apexFor(Math.hypot(x - a.pos.x, z - a.pos.z));
    for (let i = 1; i < 20; i++) {
      const u = i / 20;
      const px = lerp(this.from.x, x, u), pz = lerp(this.from.z, z, u);
      const py = lerp(this.from.y, landY, u) + 4 * apex * u * (1 - u);
      const ground = solidHeight(px, pz);
      const tree = u > 0.06 && this.hooks.canopyAt?.(px, py, pz);
      if (ground > py - 0.15 || tree) {
        obstruct = tree ? 'tree' : 'bank';
        x = px;
        z = pz;
        break;
      }
    }
    // Over land, or into water too shallow for a fish: it drops into the last good water
    // along its way.
    let bank = false;
    if (!wet(x, z)) {
      bank = true;
      let found = false;
      const sx = a.pos.x, sz = a.pos.z;
      for (let k = 1; k > 0.05; k -= 0.02) {
        const px = sx + (x - sx) * k, pz = sz + (z - sz) * k;
        if (wet(px, pz) && Math.hypot(px - sx, pz - sz) > 2.5) {
          x = px;
          z = pz;
          found = true;
          break;
        }
      }
      if (!found) {
        out.ok = false;
        return out;
      }
    }
    const dist = Math.hypot(x - a.pos.x, z - a.pos.z);
    out.ok = dist > 2.5;
    out.x = x;
    out.z = z;
    out.d = dist;
    out.aimX = bx + dx * aimD;
    out.aimZ = bz + dz * aimD;
    out.short = Math.max(0, aimD - d);
    out.bonus = bonus;
    out.collapse = collapse;
    out.wind = manual ? Math.hypot(wAlong, wAcross) : 0;
    out.windAllowed = manual ? 0 : Math.hypot(wAlong, wAcross);
    out.windSide = wAcross > 0 ? 'right' : 'left';
    out.windAlong = wAlong;
    out.bank = bank;
    out.obstruct = obstruct;
    out.max = mx;
    out.carry = carry;
    return out;
  }

  // The same arc is drawn while aiming and flown by the rig, so what you see is what you get.
  arcPoint(u, out) {
    out.lerpVectors(this.from, this.to, u);
    out.y += 4 * this.apex * u * (1 - u);
    return out;
  }

  apexFor(d) {
    if (this.kind === 'fly') return 0.5 + d * 0.06;
    if (this.kind === 'ledger' || this.kind === 'bottom') return 1.2 + d * 0.2;
    return 0.8 + d * 0.16;
  }

  // The fly rod: false casting builds line; let go as the rod comes forward to lay it out.
  // Assisted casting waits for the next forward stroke; letting go on the back cast without
  // it piles the line up short.
  get flyForward() { return this.flyPhase > 0.45 && this.flyPhase < 0.86; }

  releaseFly() {
    if (this.flyForward) {
      this.flyCollapse = 0;
      this.cast();
    } else if (this.assist) {
      this.deliver = true;
    } else {
      this.flyCollapse = 0.6;
      this.cast();
      this.flyCollapse = 0;
    }
  }

  cast() {
    // (Still tearing along as you let go: the cast is put down, and you try again in a moment.)
    if (this.angler.onBoat && this.angler.speed > CAST_SPEED + 2.4) {
      this.state = 'idle';
      this.deliver = false;
      this.hooks.flash('Too fast to cast: she’s still slowing down. Try again in a moment.', 2.6);
      return;
    }
    this.planCast(this.power, this.plan);
    if (!this.plan.ok) {
      this.state = 'idle';
      this.deliver = false;
      this.hooks.flash(this.angler.onBoat ? 'Too close to the shore to cast that way' : 'Aim out over open water to cast');
      return;
    }
    const P = this.plan;
    this.castMiss = { ...P, tailed: this.kind === 'fly' && P.collapse > 0 };
    this.to.set(P.x, waveHeight(P.x, P.z), P.z);
    this.intended.set(P.aimX, 0, P.aimZ);
    this.castDist = P.d;
    this.state = 'casting';
    this.t = 0;
    this.deliver = false;
    this.from.copy(this.tip);
    this.apex = this.apexFor(this.castDist);
    this.flight = this.kind === 'fly' ? 0.75 + this.castDist * 0.04 : 0.5 + this.castDist * 0.03;
    this.audio.cast(this.kind === 'fly' ? 0.5 : 1);
    this.hooks.onCast(this.kind);
  }

  // A word on how the cast went, and why: always the real reason.
  castFeedback() {
    const m = this.castMiss;
    if (!m) return;
    let text = '', good = false;
    const r = (v) => Math.max(1, Math.round(v));
    if (m.obstruct === 'tree') text = 'It caught a branch and dropped short. Move clear of the trees, or cast lower and shorter.';
    else if (m.obstruct === 'bank') text = 'The bank was in the way: it dropped short. Cast from higher up, or further out.';
    else if (m.bank) text = 'That would have landed on the bank, so it dropped into the last good water.';
    else if (m.tailed) text = 'You let go on the back cast: the line piled up short. Let go as the rod comes forward.';
    else if (m.collapse > 0.05) text = `Held on too long: the rod overloaded and the cast fell ${r(m.short)} m short and to the right. Let go as the rod is fully loaded.`;
    else if (m.bonus) {
      text = 'A perfect cast: let go just as the rod was fully loaded.';
      good = true;
    }
    if (!m.obstruct && !m.bank && m.carry > 1.5) text += `${text ? ' ' : ''}The boat’s way carried it ${Math.round(m.carry)} m on as it flew.`;
    if (!m.obstruct && !m.bank && m.wind > 0.8) {
      const side = Math.abs(m.windAlong) > m.wind * 0.7 ? (m.windAlong > 0 ? 'further' : 'shorter') : `${r(m.wind)} m ${m.windSide}`;
      text += `${text ? ' ' : ''}The wind carried it ${side}: aim a little into it.`;
    }
    const weight = this.problems.find((p) => p.level === 'warn');
    if (!text && weight && this.castDist > m.max * 0.85) text = weight.text;
    if (!text && this.assist && m.windAllowed > 1.2) this.hooks.teach?.('assistWind', 'Assisted casting allowed for the wind. (In Settings you can switch to manual casting and judge it yourself.)', 6);
    if (text) this.hooks.castResult?.(text, good);
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
    this.bottom = Math.max(0.25, depthAt(this.to.x, this.to.z));
    // The line out: what reached the rig (a float gets a little more, to drift on).
    this.lineLen = Math.hypot(this.to.x - this.tip.x, this.to.z - this.tip.z) * (this.kind === 'float' ? 1.15 : 1) + (this.kind === 'float' ? 4 : 0.5);
    this.towSpeed = 0;
    const splash = splashOf(this.rod, this.item, this.term) * (this.castMiss?.tailed ? 2.2 : 1);
    this.fx.ripple(this.bob.x, this.bob.z, 0.5 + splash * 0.35, 1.4, 0.3 + splash * 0.08);
    this.fx.splash(this.bob.x, 0.05, this.bob.z, Math.round(2 + splash * 3), 0.8 + splash * 0.3, 0.4 + splash * 0.08);
    this.audio.plop(this.kind === 'fly' ? 0.45 : this.kind === 'ledger' || this.kind === 'bottom' ? 1.4 : 1);
    // A splash right on top of fish sends them off; a little further away it draws attention.
    this.eco.startle(this.bob.x, -0.4, this.bob.z, splash, 0.8);
    this.r = {};
    // A float lands on its side and cocks upright as the shot sinks.
    if (this.kind === 'float') {
      this.depth = Math.min(this.depth, Math.max(0.4, this.bottom - 0.15));
      this.r.cock = 1;
    } else if (this.kind === 'lure') Object.assign(this.r, { moved: 0, pauseT: 9, wasMoving: false, fouled: false, bumpT: 0, hop: 0 });
    else if (this.kind === 'ledger' || this.kind === 'bottom') this.r.settled = false;
    else if (this.kind === 'fly') Object.assign(this.r, { lineLen: this.castDist + 1.6, drag: false });
    else if (this.kind === 'jig') Object.assign(this.r, { lift: 0, sinking: true, onBottom: false, darted: 0 });
    const it = this.item;
    Object.assign(this.eco.bait, {
      active: true, kind: this.kind, item: it.id, size: it.size, fly: it.fly || null, thick: this.rod.line.thick,
      fresh: 4, owner: null, held: false, twitch: 0, speed: 0, motion: 'still', pause: false, drag: false, fouled: false,
      feeder: !!this.term?.feeder, surface: !!it.floats && (it.action === 'pop' || it.action === 'walk'), sinking: false, darted: 0,
      natural: it.type === 'bait',
    });
    this.syncBait();
    this.agent = null;
    this.setStatus(this.kind === 'ledger' || this.kind === 'bottom' || this.kind === 'jig' ? 'sinking' : 'quiet');
    this.quietT = 0;
    this.hintedQuiet = false;
    // What the fish make of this cast, for advice when nothing bites (see advice.js).
    this.interest = { looks: 0, follows: 0, nibbles: 0, turned: 0, refused: 0, spooked: 0, left: 0, kinds: {}, at: { x: this.bob.x, z: this.bob.z }, t: 0, why: null };
    this.whyT = 0;
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
      case 'lure': {
        const act = this.item.action;
        this.twitchT = act === 'crawl' ? 0.3 : 0.45;
        b.twitch = 1.2;
        if (this.r.fouled && Math.random() < 0.45) {
          this.r.fouled = false;
          this.hooks.flash('You flick the weed off the lure', 2);
        }
        if (act === 'crawl') this.r.hop = 0.45; // a hop off the bottom
        if (act === 'pop' || act === 'walk') {
          // Spit and splash on the surface.
          this.fx.splash(this.hook.x, 0.05, this.hook.z, act === 'pop' ? 6 : 4, 1.2, 0.45);
          this.fx.ripple(this.hook.x, this.hook.z, act === 'pop' ? 0.9 : 0.6, 1.0, 0.45);
          this.audio.splashSmall(act === 'pop' ? 0.45 : 0.3);
        } else if (this.baitDepth < 0.4) this.fx.ripple(this.hook.x, this.hook.z, 0.5, 0.7, 0.3);
        this.audio.tick(0.8);
        break;
      }
      case 'jig':
        // A sharp lift: the jig darts up a metre, then glides back down.
        this.r.lift = 0.42;
        this.r.darted = 4;
        this.twitchT = 0.4;
        b.twitch = 1.4;
        this.rodBounce = 0.25;
        this.audio.tick(0.9);
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
    // (The fish reckon heights from their own water's surface: see ecosystem.js.)
    b.x = this.hook.x;
    b.y = this.hook.y - waterLevel(this.hook.x, this.hook.z);
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

  // (Counted for advice: who came, and how it went.)
  noteInterest(a, what) {
    const I = this.interest;
    if (!I) return;
    I[what]++;
    I.kinds[a.sp.id] = (I.kinds[a.sp.id] || 0) + 1;
  }

  onCurious(a) {
    if (this.state !== 'drifting') return;
    this.noteInterest(a, 'looks');
    this.agent = a;
    this.setStatus(this.kind === 'fly' && this.item.fly === 'dry' ? 'rising' : 'curious');
  }

  onFollow(a) {
    if (this.state !== 'drifting') return;
    this.noteInterest(a, 'follows');
    this.agent = a;
    this.setStatus('follow');
    this.hooks.teach('follow', 'A fish is following your lure. A twitch or a short pause often makes it strike.');
  }

  onNibble(a) {
    if (this.state !== 'drifting' || a !== this.agent) return;
    this.noteInterest(a, 'nibbles');
    if (this.kind === 'bottom') {
      // Little rattles on the rod tip: a flatfish worrying at the bait. Not yet.
      this.rodBounce = 0.22;
      this.audio.tick(0.6);
      this.setStatus('rattle');
      return;
    }
    if (this.kind === 'jig') {
      this.rodBounce = 0.12;
      this.audio.tick(0.4);
      this.setStatus('touch');
      return;
    }
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
    const shallow = this.hook.y - waterLevel(this.hook.x, this.hook.z) > -1.3;
    // Sea bottom rigs and squid jigs need a strike too: the rod tip pulls round, or the jig
    // stops sinking under a squid's weight. One gentle ring.
    if (this.kind === 'bottom' && kind !== 'strike') {
      this.biteKind = 'tip';
      this.rodBounce = 0.55;
      this.audio.biteAlert?.('strike');
      this.setStatus('tip');
      return;
    }
    if (this.kind === 'jig') {
      this.biteKind = 'grab';
      this.rodBounce = 0.3;
      this.audio.biteAlert?.('strike');
      this.setStatus('grab');
      return;
    }
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
      case 'tap':
        // A quick tap on the line: a fish nipping at the lure's tail as it crawls or pauses. It
        // lets go almost at once: strike straight away (if you're winding, now and then it hooks
        // itself).
        this.fx.ripple(this.hook.x, this.hook.z, 0.8, 1, 0.4);
        this.audio.knock?.(0.6);
        this.rodBounce = 0.4;
        this.setStatus('tap');
        if (this.hold && this.reelSpeed > 0.15 && Math.random() < 0.25) {
          this.setHook();
          this.hooks.flash('It tapped the lure and hooked itself! Keep reeling.', 2.4);
        } else this.hooks.teach('tap', 'A tap on the line: a fish nipped at the lure. Strike at once: these are gone in a moment. A slow or twitched lure gets more of them.', 6);
        return;
      case 'run':
        // A carp rig is self-hooking: the hook is set as the fish bolts with the bait, so this
        // is a hooked fish, not a bite to strike. One pleasant ring says so.
        this.audio.biteAlert?.('fishon');
        this.setHook(true);
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
        // The float goes under: a real bite that still needs striking. A gentle ring, once.
        this.fx.splash(this.bob.x, 0.05, this.bob.z, 8, 1.4, 0.5);
        this.fx.ripple(this.bob.x, this.bob.z, 1.5, 1.3, 0.55);
        this.audio.bite();
        this.audio.biteAlert?.('strike');
        this.setStatus('bite');
    }
  }

  // why: the reason it gave up on the rig, as [code, a sentence to act on] (see behaviour.js).
  onLeave(a, reason, why = null) {
    if (a !== this.agent) return;
    if (this.interest && this.state === 'drifting') {
      this.interest.left++;
      if (reason === 'turned') this.interest.turned++;
      else if (reason === 'refused') this.interest.refused++;
      else if (reason === 'startled' || reason === 'spooked') this.interest.spooked++;
      if (why && why[0] !== 'fussy') this.interest.why = why[1];
    }
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
      this.hooks.flash(k === 'run' ? 'The run stops. It dropped the bait.' : k === 'strike' ? 'It let go of the lure. Too slow!' : k === 'tap' ? 'Gone: a tap is over in a moment. Strike straight away.' : k === 'sip' ? 'Too slow: it spat the fly.' : 'It let go of the bait. Another may come.');
    } else if (why && why[0] !== 'fussy' && (reason !== 'lost' || this.t > this.whyT)) {
      // It says why it turned away (a fish that just drifted off says so less often).
      this.whyT = this.t + 14;
      this.hooks.flash(why[1], 4);
    } else if (reason === 'turned') {
      this.hooks.flash('It followed all the way in, then turned away. Try a twitch, or a pause.', 3.6);
    } else if (reason === 'missed') {
      this.hooks.flash('A swirl behind the lure! Something missed it.', 3);
    } else if (reason === 'refused') {
      this.hooks.flash(this.r.drag ? 'A fish rose, looked, and refused it: the fly was dragging.' : 'A fish rose, looked, and refused the fly.', 3.2);
    } else if (reason === 'startled' || reason === 'spooked') this.hooks.flash('Something darted away.', 2);
  }

  // selfHooked: the fish hooked itself on a self-hooking rig (no strike needed).
  setHook(selfHooked = false) {
    const a = this.agent;
    if (!a) return;
    this.eco.hook(a);
    this.audio.alarmRun?.(false);
    const sp = a.sp;
    // Weed, lilies, rocks or roots nearby give a running fish something to reach.
    const s = this.eco.habitat.sample(this.hook.x, this.hook.z);
    const cover = s.weed > 0.35 || s.rock > 0.4;
    // The fish fights as itself (its vigour and condition, how jumpy its kind is), against this
    // rod (its power and how soft it is) and the Fish behaviour setting.
    const who = { vigour: a.vigour, condition: a.condition, jumpy: prefsFor(sp.id).jumpy, level: this.level };
    this.fight = Object.assign(newFight(sp, a.size, { line: this.rod.line, power: this.rod.power, flex: this.rod.flex, drag: this.dragLevel }, this.diff, cover, Math.random, who), {
      sp, size: a.size, agent: a, lat: 0, splashT: 0, start: this.hook.clone(), end: this.fightEnd(), creaked: false,
      selfHooked, pickedUp: !selfHooked,
      // How far off it was hooked (m), so the line it takes and gives back can be told in metres;
      // a leap under way; what was last said (so a turn or the tiring is named, not shouted).
      dist: Math.max(3, this.tip.distanceTo(this.hook)), leapT: 0, roll: 0, word: '', wordT: 0,
    });
    this.fishPos.copy(this.hook);
    this.side = 0;
    this.state = 'reeling';
    this.t = 0;
    if (!selfHooked) this.audio.hookSet();
    this.fx.splash(this.bob.x, 0.05, this.bob.z, selfHooked ? 6 : 14, 2.2, 0.7);
    this.fx.ripple(this.bob.x, this.bob.z, 1.8, 1.2, 0.6);
    this.setStatus(selfHooked ? 'fishon' : 'hooked');
    if (selfHooked) this.hooks.flash('Fish on! It hooked itself on the rig. Pick up the rod: hold to play it.', 3.5);
    this.hooks.onHook(this.fight);
  }

  // Fishing from the bank, the fish is brought to the nearest water deep enough to land it.
  fightEnd() {
    const a = this.angler;
    if (a.onBoat) return null;
    const dx = this.hook.x - a.pos.x, dz = this.hook.z - a.pos.z, l = Math.hypot(dx, dz) || 1;
    for (let d = 0.5; d < l; d += 0.4) {
      const x = a.pos.x + (dx / l) * d, z = a.pos.z + (dz / l) * d;
      if (depthAt(x, z) > 0.45) return new THREE.Vector3(x + (dx / l) * 0.6, 0, z + (dz / l) * 0.6);
    }
    return this.hook.clone();
  }

  // The fish comes off with the line whole: 'thrown' (it leapt on a slack line and threw the
  // hook) or 'pulled' (a light hold tore free under heavy pressure). See fight.js.
  lose(why) {
    const F = this.fight;
    this.eco.lostHooked(F.agent);
    this.fight = null;
    this.agent = null;
    this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 8, 1.8, 0.6);
    this.audio.splashSmall();
    this.hooks.onSnap(why, F.sp, this.rod);
    this.reelIn();
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
    // A squid or cuttlefish comes out squirting ink.
    if (F.sp.creature) {
      this.fx.ink(this.fishPos.x, this.fishPos.z);
      this.audio.splashSmall(0.6);
    }
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
      a.y + (a.lvl || 0) + Math.sin(a.pitch) * a.scale * 0.5,
      a.z + Math.cos(a.yaw) * cp * a.scale * 0.5,
    );
  }

  /* ---------- per-frame ---------- */

  update(dt, t, camYaw, held) {
    this.t += dt;
    this.frameDt = Math.max(dt, 1e-3);
    this.statusT += dt;
    this.held = held;
    this.waveT = t;
    const A = this.angler, pose = A.pose;
    const R = this.reelFx;
    R.payout = R.wind = R.load = R.sing = 0;
    R.free = false;
    A.rodTip.getWorldPosition(this.tip);
    this.rodBounce = damp(this.rodBounce, 0, 5, dt);

    let rodPitch = this.kind === 'ledger' ? 1.15 : 0.85, bend = 0.05;
    let rodYaw = this.state === 'idle' ? 0 : clamp(wrapAngle(Math.atan2(this.bob.x - A.pos.x, this.bob.z - A.pos.z) - A.heading), -2, 2);
    const fishMesh = this.fight ? this.fishMeshes[this.fight.sp.id] : null;
    const face = A.faceYaw ?? A.heading; // the way you face to look at a fish in your hands

    switch (this.state) {
      case 'aiming': {
        this.aimYaw = camYaw + this.aimOffset;
        this.aimT += dt;
        rodYaw = clamp(wrapAngle(this.aimYaw - A.heading), -2, 2);
        if (this.kind === 'fly') {
          // False casting: each forward stroke shoots a little more line out.
          const prev = this.flyPhase;
          this.flyPhase = (this.aimT % FLY_CYCLE) / FLY_CYCLE;
          const max = castRange(this.rod, this.item, this.term)[1];
          if (prev < 0.86 && this.flyPhase >= 0.86 && !this.deliver) {
            const grown = Math.min(max, this.flyLine + 2.6);
            if (grown > this.flyLine) this.audio.cast?.(0.22);
            this.flyLine = grown;
          }
          this.power = clamp((this.flyLine - this.rod.cast[0]) / Math.max(1, max - this.rod.cast[0]), 0, 1);
          const ph = this.flyPhase;
          rodPitch = ph < 0.45 ? lerp(0.95, -0.4, smoothstep(0, 0.45, ph)) : lerp(-0.4, 0.95, smoothstep(0.45, 0.86, ph));
          bend = 0.15 + Math.abs(Math.sin(ph * Math.PI * 2)) * 0.25;
          if (this.deliver && this.flyForward) {
            this.flyCollapse = 0;
            this.cast();
            break;
          }
        } else {
          // Holding loads the rod: the distance grows smoothly to the rod's full range. In manual
          // casting it then stays fully loaded for a moment (the sweet spot) before it overloads.
          const T = this.rod.build ?? 1.4;
          // The ring moves out at an even pace, so it's easy to stop where you want it.
          const u = clamp(this.aimT / T, 0, 1);
          this.power = u;
          const over = this.assist ? 0 : Math.max(0, this.aimT - T - SWEET_HOLD);
          this.overload = clamp(over / OVERLOAD, 0, 1);
          this.sweet = !this.assist && u >= 0.95 && this.overload === 0;
          rodPitch = lerp(0.5, -0.45, this.power) + (this.overload > 0 ? Math.sin(t * 30) * 0.03 * this.overload : 0);
          bend = 0.1 + this.power * 0.35 + this.overload * 0.2;
        }
        this.planCast(this.power, this.plan);
        this.aimValid = this.plan.ok;
        if (this.aimValid) {
          this.to.set(this.plan.x, waveHeight(this.plan.x, this.plan.z, t), this.plan.z);
          this.castDist = this.plan.d;
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
          const sc = 0.7 + this.castDist * 0.03;
          this.aimRing.scale.set(sc, 1, sc);
          // Manual casting: a faint ring where you're aiming, so you can see the wind's drift.
          const gx = this.plan.aimX, gz = this.plan.aimZ;
          this.ghostShow = !this.assist && !this.plan.obstruct && !this.plan.bank && Math.hypot(gx - this.to.x, gz - this.to.z) > 0.6;
          if (this.ghostShow) {
            this.ghostRing.position.set(gx, waveHeight(gx, gz, t) + 0.05, gz);
            this.ghostRing.scale.set(sc, 1, sc);
          }
          // An amber ring: the cast will drop short of where you're aiming (bank, branch, overload).
          this.aimRing.material.color.set(this.plan.obstruct || this.plan.bank || this.plan.collapse > 0.05 ? '#ffc477' : this.plan.bonus ? '#bff2c8' : '#fff6e0');
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
        } else if (this.kind === 'ledger' || this.kind === 'bottom') {
          rodPitch = 1.15;
          bend = 0.12 + this.rodBounce + (this.status === 'rattle' ? Math.sin(t * 38) * 0.04 : 0);
          this.updateLedger(dt, t);
        } else if (this.kind === 'jig') {
          rodPitch = 0.75 + (this.r.lift > 0 ? 0.35 : 0);
          bend = 0.1 + this.rodBounce + this.reelSpeed * 0.1;
          this.updateJig(dt, t);
        } else {
          rodPitch = 0.75;
          bend = 0.06 + this.reelSpeed * 0.06;
          this.updateFly(dt, t);
        }
        // A moving boat tows the rig along behind on the line that's out (trolling).
        if (this.state === 'drifting' && this.kind !== 'fly') {
          this.tow(this.kind === 'float' ? this.bob : this.hook, dt);
          if (this.kind !== 'lure') this.relSpeed += this.towSpeed;
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
        // Swung low to one side for side pressure (a positive yaw swings it to your left).
        rodYaw = clamp(rodYaw - this.side * 0.75, -2.2, 2.2);
        rodPitch -= Math.abs(this.side) * 0.2;
        // The load bends it (a soft rod further), and it kicks as the fish shakes on a run.
        bend = (0.25 + F.tension * 0.95) / Math.sqrt(this.rod.flex ?? 1) + (F.pulling ? Math.sin(t * 22) * 0.06 * (0.4 + F.tension) : 0) + this.rodBounce;
        break;
      }
      case 'landing': {
        const hp = A.holdPoint(_w);
        const u = clamp(this.t / 0.8, 0, 1);
        if (u < 1) {
          fishMesh.position.lerpVectors(this.from, hp, smoothstep(0, 1, u));
          fishMesh.position.y += Math.sin(u * Math.PI) * 1.0;
          fishMesh.rotation.set(-1.25 + Math.sin(t * 14) * 0.15, face + Math.PI / 2, 0, 'YXZ');
          fishMesh.userData.swim.set(t * 18, 1);
        } else this.holdUp(fishMesh, t, face);
        rodPitch = 1.1;
        bend = 0.7;
        rodYaw = 0.2;
        // In first person you hold it up for a good look before the card comes.
        if (this.t >= 0.8 + this.admire) {
          this.state = 'caught';
          this.t = 0;
          this.hooks.onCatch(this.fight.sp, this.fight.size, this.fight.agent, { rod: this.rod, item: this.item });
        }
        break;
      }
      case 'caught': {
        this.holdUp(fishMesh, t, face);
        rodPitch = 1.15;
        bend = 0.6;
        rodYaw = 0.2;
        break;
      }
      case 'releasing': {
        const u = clamp(this.t / 0.65, 0, 1);
        fishMesh.position.lerpVectors(this.from, this.to, u);
        fishMesh.position.y = lerp(this.from.y, waterLevel(this.to.x, this.to.z) - 0.3, u) + Math.sin(u * Math.PI) * 0.6;
        fishMesh.rotation.set(lerp(-1.2, 1.3, u), face + Math.PI / 2, 0, 'YXZ');
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
        _w.x -= Math.sin(face) * 0.6;
        _w.z -= Math.cos(face) * 0.6;
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
        R.wind = 3;
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
    // The blank springs towards the bend the line asks of it, and back as the load comes off,
    // swinging a little past (a soft rod slower and further, a stiff one quick).
    {
      const K = 150 * (this.rod.flex ?? 1), C = 2 * Math.sqrt(K) * 0.5;
      for (let left = Math.min(dt, 0.1); left > 1e-5; left -= 1 / 60) {
        const h = Math.min(left, 1 / 60);
        pose.bendVel = (pose.bendVel || 0) + ((bend - pose.bend) * K - (pose.bendVel || 0) * C) * h;
        pose.bend += pose.bendVel * h;
      }
      pose.bend = clamp(pose.bend, -0.6, 1.9);
    }

    // Line out from a fishing reel: the drag clicking as a fish takes line, the handle turning
    // as you wind, and the line singing as it nears breaking.
    if (this.state === 'drifting' && this.reelSpeed > 0.05) {
      R.wind = this.reelSpeed;
      R.load = this.kind === 'lure' || this.kind === 'jig' ? 0.15 : 0.08;
    }
    R.drag = this.dragLevel / (DRAG_LEVELS.length - 1);
    if (this.state === 'casting') {
      // (Line pouring off the reel as the cast flies out: the bail's open, so no clicks.)
      R.payout = Math.min(14, this.castDist / Math.max(0.3, this.flight));
      R.free = true;
    }
    this.updateVisuals(t, dt, fishMesh);
    this.turnReel(dt);
    this.audio.reel?.(R);
  }

  // The reel's spool turns as line goes out (and on a centrepin or fly reel as you wind it back,
  // since the drum is the spool), and its handle as you wind.
  turnReel(dt) {
    const rod = this.angler.active, R = this.reelFx;
    if (!rod?.spool) return;
    const drum = !rod.handle;
    const r = drum ? 0.045 : 0.037;
    // (Past a few turns a second it's a blur: a wheel in a film seems to stand still or turn back.)
    rod.spool.rotation.y += clamp((R.payout - (drum ? R.wind : 0)) / r, -22, 22) * dt;
    if (rod.handle) rod.handle.rotation.x -= clamp(R.wind * 9, 0, 16) * dt;
  }

  // A landed fish held up in your hands, wriggling now and then.
  holdUp(fishMesh, t, face) {
    this.angler.holdPoint(fishMesh.position);
    fishMesh.position.y += Math.sin(t * 2) * 0.03;
    const wig = Math.sin(t * 9) * Math.max(0, Math.sin(t * 1.3)) * 0.25;
    fishMesh.rotation.set(-1.2 + wig * 0.3, face + Math.PI / 2 + wig, 0, 'YXZ');
    fishMesh.userData.swim.set(t * 10, 0.4 * Math.max(0.2, Math.sin(t * 1.3)));
  }

  // In first person the rod moves with the camera, which settles after this update: catch the
  // line (and a fish held up in front of you) up with it, so nothing trails a frame behind.
  afterView(t) {
    const A = this.angler, s = this.state;
    A.rodTip.getWorldPosition(this.tip);
    const mesh = this.fight ? this.fishMeshes[this.fight.sp.id] : null;
    if (mesh && (s === 'caught' || (s === 'landing' && this.t >= 0.8))) {
      this.holdUp(mesh, t, A.faceYaw ?? A.heading);
      mesh.updateMatrixWorld();
    }
    if (!this.line.visible) return;
    if (this.holdingLine && mesh) mesh.localToWorld(this.lineEnd.set(0, 0, 0.5));
    // (Pin it to where the tip is now.)
    this.fishLine.constrain(this.tip, this.lineEnd, 3);
    this.drawLine(t);
  }

  // The water moving a rig: the current at its depth (by the Currents setting), plus a share of
  // the wind for what stands above the surface. k: how freely it goes with the water.
  carry(p, depth, dt, k, windShare) {
    const c = currentAt(p.x, p.z, depth), cs = currentScale() * k;
    let dx = c.x * cs, dz = c.z * cs;
    if (windShare) {
      const w = windAt(p.x, p.z);
      dx += w.x * windShare;
      dz += w.z * windShare;
    }
    p.x += dx * dt;
    p.z += dz * dt;
  }

  // The rig can only be as far from the rod tip as the line that's out: a boat moving away from
  // it (under power, or drifting on the wind and tide) tows it along behind. Reeling in takes line
  // in; passing over it leaves the line slack in the water, until it comes tight again astern.
  tow(p, dt) {
    const dx = p.x - this.tip.x, dz = p.z - this.tip.z, d = Math.hypot(dx, dz);
    if (!this.lineLen) this.lineLen = d;
    if (this.reelSpeed > 0.05) this.lineLen = Math.min(this.lineLen, d + 0.5);
    if (d > this.lineLen && d > 0.01) {
      const k = this.lineLen / d, nx = this.tip.x + dx * k, nz = this.tip.z + dz * k;
      this.towSpeed = damp(this.towSpeed, Math.hypot(nx - p.x, nz - p.z) / Math.max(dt, 1e-3), 8, dt);
      p.x = nx;
      p.z = nz;
    } else this.towSpeed = damp(this.towSpeed, 0, 6, dt);
  }

  // A drifting float can only go as far as the line lets it: past that the line comes tight.
  keepOnLine(p) {
    const max = (this.castDist || 10) * 1.15 + 4;
    const dx = p.x - this.tip.x, dz = p.z - this.tip.z, d = Math.hypot(dx, dz);
    if (d > max) {
      p.x = this.tip.x + (dx / d) * max;
      p.z = this.tip.z + (dz / d) * max;
    }
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
      // A float goes with the water it sits in (the current), and its tip catches a little wind.
      this.carry(this.bob, 0, dt, 1, 0.012);
      this.keepOnLine(this.bob);
    }
    this.dip = damp(this.dip, 0, 8, dt);
    this.bob.y = waveHeight(this.bob.x, this.bob.z, t) - this.dip;
    this.bottom = Math.max(0.3, depthAt(this.hook.x, this.hook.z));

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
    // (Through the water: the current carries it too; a moving boat tows it.)
    this.relSpeed = move + this.towSpeed;
    // (A floating plug at rest also catches a little wind.)
    this.carry(this.hook, this.baitDepth, dt, 0.9, it.floats && this.reelSpeed < 0.12 ? 0.006 : 0);
    // Swimming: reeled in, or trolled behind a moving boat (it works the same either way).
    const swim = Math.max(this.reelSpeed, this.towSpeed);
    const moving = swim > 0.12;
    if (moving) {
      r.pauseT = 0;
      r.wasMoving = true;
    } else r.pauseT += dt;
    r.pausing = r.wasMoving && !moving && r.pauseT < 1.4;
    if (!moving && r.pauseT > 1.4) r.wasMoving = false;

    this.bottom = Math.max(0.15, depthAt(this.hook.x, this.hook.z));
    let want, rate;
    const act = it.action;
    r.hop = Math.max(0, (r.hop || 0) - dt);
    if (act === 'flash') {
      if (moving) { want = clamp(1.8 - swim * 0.8, 0.25, 1.6); rate = 0.6; } else { want = this.bottom; rate = it.sink; }
    } else if (act === 'wobble') {
      if (moving) { want = it.dive * smoothstep(0, 5, r.moved) * clamp(0.55 + swim * 0.4, 0.6, 1.15); rate = 0.9; } else { want = 0; rate = 0.22; }
    } else if (act === 'swim') {
      // A soft swimbait: counts down while you wait, holds its depth on a slow retrieve, rises when fast.
      if (moving) { want = clamp(this.baitDepth - (swim - 0.6) * 0.6, 0.3, this.bottom); rate = 0.3; } else { want = this.bottom; rate = it.sink; }
    } else if (act === 'crawl') {
      // On the bottom; a twitch hops it up, and it falls back.
      want = r.hop > 0 ? this.bottom - 0.4 : this.bottom;
      rate = r.hop > 0 ? 1.6 : it.sink;
    } else if (act === 'pop' || act === 'walk') {
      want = 0;
      rate = 1;
    } else if (act === 'flutter') {
      // A heavy metal: drops fast, climbs as you reel, flutters down on a twitch.
      if (this.twitchT > 0) { want = Math.max(0.3, this.baitDepth - 1); rate = 2.4; } else if (moving) { want = clamp(2.6 - swim * 1.2, 0.4, 3); rate = 0.8; } else { want = this.bottom; rate = it.sink; }
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
    // A surface lure skating across the top: a V of ripples and little splashes.
    if (moving && (act === 'walk' || act === 'pop')) {
      this.wakeT = (this.wakeT ?? 0) - dt;
      if (this.wakeT <= 0) {
        this.wakeT = act === 'walk' ? 0.28 : 0.4;
        this.fx.ripple(this.hook.x, this.hook.z, 0.7, 1.0, 0.35);
        if (act === 'walk') this.fx.splash(this.hook.x, 0.05, this.hook.z, 2, 0.9, 0.3);
      }
    } else if (moving && this.baitDepth < 0.45) {
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
    // Sinking, it's carried by the water it falls through; on the bottom, the lead holds unless
    // the current there is stronger than its weight can stand, and then it creeps downstream.
    if (!r.settled) this.carry(this.hook, this.baitDepth, dt, 0.8, 0);
    else if (this.reelSpeed <= 0.05) {
      const hold = 0.12 + (this.term?.weight ?? 85) / 350; // m/s of current a lead stays put in
      const c = currentAt(this.hook.x, this.hook.z, this.bottom), cs = currentScale();
      const v = Math.hypot(c.x, c.z) * cs;
      r.rolling = v > hold;
      if (r.rolling) {
        const k = ((v - hold) * 0.6) / v;
        this.hook.x += c.x * cs * k * dt;
        this.hook.z += c.z * cs * k * dt;
        if (Math.random() < dt * 0.6) this.rodBounce = Math.max(this.rodBounce || 0, 0.05);
      }
    }
    this.bottom = Math.max(0.25, depthAt(this.hook.x, this.hook.z));
    if (!r.settled) {
      this.baitDepth = Math.min(this.baitDepth + 2.4 * dt, this.bottom - 0.03);
      if (this.baitDepth >= this.bottom - 0.04) {
        r.settled = true;
        if (this.kind === 'ledger') this.audio.alarm?.(0.4);
        else this.rodBounce = 0.1;
        this.setStatus('set');
      }
    } else this.baitDepth = this.bottom - 0.03;
    this.hook.y = waveHeight(this.hook.x, this.hook.z, t) - this.baitDepth;
    this.surfacePoint(this.bob, t);
    this.syncBait();
  }

  // A squid jig: it sinks at its own rate; a tap darts it up a metre, holding reels it slowly
  // back and up, and letting go lets it glide down again. Squid follow the dart and grab the
  // jig as it sinks.
  updateJig(dt, t) {
    const r = this.r, it = this.item;
    if (this.hold) this.holdT += dt;
    const reeling = this.hold && this.holdT > TAP;
    this.reelSpeed = damp(this.reelSpeed, reeling ? 0.55 : 0, 5, dt);
    const dx = this.tip.x - this.hook.x, dz = this.tip.z - this.hook.z, l = Math.hypot(dx, dz) || 1;
    let move = this.reelSpeed;
    if (r.lift > 0) move += 1.1;
    if (move > 0.01) {
      if (l < 2.4 || (!this.angler.onBoat && this.bottom < 0.25 && l < 8)) {
        this.reelIn();
        return;
      }
      this.hook.x += (dx / l) * move * dt;
      this.hook.z += (dz / l) * move * dt;
      if (reeling && Math.random() < dt * 10) this.audio.tick(0.4);
    }
    if (this.twitchT > 0) this.twitchT -= dt;
    r.darted = Math.max(0, r.darted - dt);
    if (!r.onBottom) this.carry(this.hook, this.baitDepth, dt, 0.9, 0);
    this.bottom = Math.max(0.2, depthAt(this.hook.x, this.hook.z));
    const floor = Math.max(0.2, this.bottom - 0.3);
    if (r.lift > 0) {
      r.lift -= dt;
      this.baitDepth = Math.max(0.15, this.baitDepth - 2.6 * dt);
      r.sinking = false;
    } else if (reeling) {
      this.baitDepth = Math.max(0.3, this.baitDepth - 0.3 * dt);
      r.sinking = false;
    } else {
      const was = this.baitDepth;
      this.baitDepth = Math.min(floor, this.baitDepth + it.sink * dt);
      r.sinking = this.baitDepth < floor - 0.005;
      if (!r.onBottom && !r.sinking && was < floor && this.status !== 'grab') {
        r.onBottom = true;
        this.rodBounce = 0.08;
        this.setStatus('jigbottom');
      }
    }
    if (this.baitDepth < floor - 0.25) r.onBottom = false;
    if (this.status === 'sinking' && !r.sinking) this.setStatus('quiet');
    this.relSpeed = move;
    this.hook.y = waveHeight(this.hook.x, this.hook.z, t) - this.baitDepth;
    this.surfacePoint(this.bob, t);
    this.syncBait();
    const b = this.eco.bait;
    b.sinking = r.sinking;
    b.darted = r.darted;
  }

  // A fly. Dry flies and nymphs drift with the current; when the line runs out of slack the
  // fly is dragged across the water, which trout distrust. Hold to strip line back in.
  updateFly(dt, t) {
    const r = this.r, it = this.item;
    if (this.hold) this.holdT += dt;
    const strip = this.hold && this.holdT > TAP;
    this.reelSpeed = strip ? 1 : 0;
    const c = currentAt(this.hook.x, this.hook.z, 0), cs = currentScale();
    this.flow.x = c.x * cs;
    this.flow.z = c.z * cs;
    let fx = this.flow.x, fz = this.flow.z;
    // On still water, a breath of the wind moves a floating fly along.
    if (Math.abs(fx) + Math.abs(fz) < 0.01) {
      const w = windAt(this.hook.x, this.hook.z);
      fx = w.x * 0.004;
      fz = w.z * 0.004;
    }
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
    this.bottom = Math.max(0.2, depthAt(this.hook.x, this.hook.z));
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
    const b = this.angler.pos;
    // The current along the line: running away from you it helps the fish (and tows it), running
    // towards you it helps you. And the rod swung to one side: side pressure.
    {
      const fx = this.fishPos.x - b.x, fz = this.fishPos.z - b.z, l = Math.hypot(fx, fz) || 1;
      const c = currentAt(this.fishPos.x, this.fishPos.z, Math.max(0, waterLevel(this.fishPos.x, this.fishPos.z) - this.fishPos.y));
      F.flow = ((c.x * fx + c.z * fz) / l) * currentScale();
    }
    F.side = this.side;
    const before = F.progress;
    const ev = stepFight(F, held, dt, diff);
    if (ev && ev.startsWith('snap:')) {
      this.snap(ev.slice(5));
      return;
    }
    if (ev && ev.startsWith('off:')) {
      this.lose(ev.slice(4));
      return;
    }
    // What it's doing, said briefly beside the meter (see the game's fight meter).
    const say = (w, secs = 1.4) => {
      F.word = w;
      F.wordT = secs;
    };
    F.wordT -= dt;
    if (ev === 'run' || ev === 'jump') {
      F.creaked = false;
      this.hooks.cue?.('run');
      if (F.time > 6 && F.sizeK > 0.35 && !F.toldSide) {
        F.toldSide = true;
        this.hooks.teach('side', `A big fish runs hard. Swing the rod low to the side against its run (${this.hooks.key('left')} or ${this.hooks.key('right')}): side pressure turns it and tires it sooner.`, 7);
      }
    }
    // A flick on the surface just before each run, so it can be read in time; the rod tip
    // nods with it.
    if (ev === 'warn') {
      this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 6, 1.6, 0.5);
      this.fx.ripple(this.fishPos.x, this.fishPos.z, 1.0, 0.9, 0.5);
      this.audio.flick();
      this.rodBounce = 0.3;
      this.hooks.cue?.('warn');
    }
    // A leap: out of the water and back with a crash. Slack line now can lose it.
    if (ev === 'jump') {
      F.leapT = 0.75;
      this.fx.splash(this.fishPos.x, 0.05, this.fishPos.z, 16, 2.4, 0.7);
      this.audio.splashSmall(1.3);
      say('jumping!', 1.2);
      if (this.level.throwHook > 0) this.hooks.flash('It leaps! Keep the line tight: rod up, and wind.', 1.8);
    }
    if (ev === 'turn') {
      // It turns on its run: a swirl where it swings round.
      this.fx.ripple(this.fishPos.x, this.fishPos.z, 0.9, 1.0, 0.4);
      say('it turns', 1);
    }
    if (ev === 'tiring') {
      say('tiring', 2.5);
      this.hooks.flash('It’s tiring: its runs are getting shorter. Keep a steady pressure on it.', 2.6);
    }
    if (ev === 'beaten') {
      say('beaten', 3);
      this.hooks.flash('It’s beaten, rolling on its side. Wind it in gently.', 2.6);
    }
    if (held) F.pickedUp = true;
    // The line creaks when it's at its limit, and keeps creaking while it strains: easing off
    // now saves it (see fight.js).
    if (F.tension > 0.9 && !F.creaked) {
      F.creaked = true;
      this.audio.strain();
      this.hooks.shake(0.2);
      this.hooks.flash('The line creaks! Ease off: it’s at its limit.', 2.4);
    } else if (F.tension > 0.97) {
      F.strainT = (F.strainT ?? 0) - dt;
      if (F.strainT <= 0) {
        F.strainT = 0.45;
        this.audio.strain();
      }
    }
    // The reel: line going out against the drag on a run (m/s), and coming in as you wind; the
    // handle turns whenever you wind, even into a run (the spool slips under it).
    const R = this.reelFx, gain = ((F.progress - before) * F.dist) / Math.max(dt, 1e-3);
    R.payout = F.slipping ? Math.max(0.3, -gain) : 0;
    R.wind = held ? Math.max(0.5, gain) : 0;
    R.load = F.tension;
    R.sing = smoothstep(0.78, 0.98, F.tension);

    // The fish swims where the fight takes it, closer to you and the surface as you win.
    let dx = F.start.x - b.x, dz = F.start.z - b.z;
    const dl = Math.hypot(dx, dz) || 1;
    dx /= dl;
    dz /= dl;
    const e = 1 - Math.pow(1 - F.progress, 1.5);
    const ex = F.end ? F.end.x : b.x + dx * 2.6, ez = F.end ? F.end.z : b.z + dz * 2.6;
    const cx = lerp(F.start.x, ex, e), cz = lerp(F.start.z, ez, e);
    // How it moves on a run depends on how it fights: darting wide, plodding, flat on the
    // bottom, deep and circling, or jetting back in pulses (F.dir +1 is off to your right, as you
    // face it). Side pressure swings it back.
    const St = F.style;
    F.lat = damp(F.lat, F.pulling ? F.dir * St.sway * (1 - F.progress * 0.6) * (1 - 0.5 * F.turn) : 0, 1.4, dt);
    const wig = Math.sin(t * 6.5) * 0.15 * (F.stage === 'beaten' ? 0.3 : 1);
    let x = cx - dz * (F.lat + wig), z = cz + dx * (F.lat + wig);
    // Don't let it swim up onto the bank.
    if (depthAt(x, z) < 0.35) {
      x = cx;
      z = cz;
    }
    const floor = solidHeight(x, z) + 0.3, lv = waterLevel(x, z);
    let y = Math.min(Math.max(lerp(F.start.y, lv - 0.35, e) - (F.pulling ? St.dive * (1 - e * 0.5) : 0), floor), lv - 0.2);
    // In a leap it clears the water, nose up, and falls back in.
    let pitch = 0;
    if (F.leapT > 0) {
      F.leapT -= dt;
      const u = 1 - clamp(F.leapT / 0.75, 0, 1);
      y = Math.max(y, lv + Math.sin(u * Math.PI) * (0.35 + F.sizeK * 0.6) - 0.15);
      pitch = lerp(0.9, -0.9, u);
      if (F.leapT <= 0) {
        this.fx.splash(x, 0.05, z, 18, 2.2, 0.8);
        this.fx.ripple(x, z, 1.8, 1.4, 0.6);
        this.audio.splashSmall(1.2);
      }
    }
    this.fishPos.set(x, y, z);
    const away = Math.atan2(x - b.x, z - b.z);
    this.eco.placeHooked(F.agent, x, y, z, away + (F.pulling ? F.lat * 0.15 : F.dir * 1.6), F.pulling ? 1 : F.stage === 'beaten' ? 0.2 : 0.5);
    // Beaten, it rolls on its side; in a leap, it's nose up.
    F.roll = damp(F.roll, F.stage === 'beaten' && !F.pulling ? 1.25 : 0, 2, dt);
    F.agent.bank = F.roll;
    F.agent.pitch = pitch;
    this.mouthOf(F.agent, this.hook);
    if (this.kind === 'float' || (this.kind === 'fly' && this.item.fly === 'nymph')) this.bob.set(x, waveHeight(x, z, t) - (F.pulling ? 0.16 : 0.06), z);
    else this.bob.set(x, waveHeight(x, z, t), z);
    if (F.pulling) {
      F.splashT -= dt;
      if (F.splashT <= 0) {
        F.splashT = rand(0.2, 0.4);
        if (St.splash && y > -1.2) {
          this.fx.splash(x, 0.05, z, 5, 1.6, 0.6);
          this.audio.splashSmall();
        }
        this.fx.ripple(x, z, St.splash ? 1.0 : 0.7, 1.0, St.splash ? 0.4 : 0.25);
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
    // From eye height a float at casting range is a speck: let it grow a little with distance.
    const far = this.viewer ? clamp(this.viewer.distanceTo(this.bob) / 9, 1, 2.4) : 1;
    this.bobber.scale.setScalar(far);
    this.indicator.scale.setScalar(far);
    if (this.r.cock > 0 && inWater) this.r.cock = Math.max(0, this.r.cock - dt * 1.1);
    const lie = inWater ? smoothstep(0, 1, this.r.cock || 0) * 1.35 : 0;
    this.bobber.rotation.z = Math.sin(t * 1.7) * 0.12 + lie;
    this.bobber.rotation.x = Math.sin(t * 1.3 + 1) * 0.1;
    this.indicator.visible = lineVisible && !holdingFish && kind === 'fly' && it?.fly === 'nymph' && !flying;
    this.indicator.position.copy(this.bob);
    this.lead.visible = inWater && (kind === 'ledger' || kind === 'bottom') && s !== 'reeling';
    if (this.lead.visible) this.lead.position.set(this.hook.x + 0.18, this.hook.y + 0.02, this.hook.z + 0.1);

    this.line.visible = lineVisible;
    this.pullingTip = false;
    if (lineVisible) {
      // How much more line is out than the straight distance to the end of it: slack line sags
      // from the rod tip, lies on the water and drifts with the current; tight line runs straight
      // from the tip down into the water.
      let end = this.bob, slack = 0.05, tight = 0;
      const floatOn = kind === 'float' || (kind === 'fly' && it?.fly === 'nymph');
      if (holdingFish) {
        end = fishMesh.localToWorld(_v.set(0, 0, 0.5));
        slack = 0.08;
      } else if (s === 'aiming') slack = 0.02;
      else if (s === 'casting' || s === 'retrieving') slack = 0.03;
      else if (s === 'reeling') {
        // On a fish: as tight as the fight makes it, slack when it eases (or leaps at you).
        const F = this.fight;
        if (!floatOn) end = this.hook;
        const loose = F.leapT > 0 && F.tension < 0.2;
        slack = loose ? 0.06 : 0.001 + Math.pow(1 - F.tension, 3) * 0.02;
        tight = loose ? 0 : 0.15 + 0.85 * smoothstep(0.08, 0.6, F.tension);
        this.pullingTip = true;
      } else if (s === 'bite') {
        slack = this.biteKind === 'float' ? 0.02 : 0.002;
        tight = this.biteKind === 'float' ? 0 : 0.6;
        this.pullingTip = this.biteKind !== 'float';
      } else if (kind === 'lure' || kind === 'jig') {
        slack = this.reelSpeed > 0.1 ? 0.004 : 0.03;
        tight = this.reelSpeed > 0.1 ? 0.5 : 0;
      } else if (kind === 'ledger' || kind === 'bottom') {
        slack = 0.012;
        tight = 0.3;
      } else if (kind === 'fly') slack = this.reelSpeed > 0.05 ? 0.01 : 0.05;
      else slack = this.reelSpeed > 0.1 ? 0.01 : 0.05;
      this.holdingLine = holdingFish;
      this.lineEnd.copy(end);
      const straight = this.tip.distanceTo(end);
      this.fishLine.step(this.tip, end, straight * (1 + slack) + 0.02, dt, this.lineWorld);
      if (tight > 0) this.fishLine.straighten(this.tip, end, 1 - Math.exp(-tight * 18 * dt));
      // Near its breaking strain the line hums taut, thrumming, and glows a warning colour.
      const load = s === 'reeling' ? this.fight.tension : 0;
      this.lineBuzz = smoothstep(0.8, 1, load) * 0.012;
      this.line.material.color.copy(this.lineColor).lerp(STRAINED, smoothstep(0.78, 0.97, load));
      this.line.material.opacity = 0.75 + 0.25 * smoothstep(0.78, 0.97, load);
      this.drawLine(t);
      // (Where it pulls the tip: a little way out along it.)
      const P = this.fishLine.p, o = 4 * 3;
      this.bendAt.set(P[o], P[o + 1], P[o + 2]);
    }
    this.angler.pose.bendTo = this.pullingTip ? this.bendAt : null;

    // Underwater line from the float/indicator, or from where the line enters, to the hook.
    const leader = inWater && (s !== 'reeling' || kind === 'float' || (kind === 'fly' && it?.fly === 'nymph')) && !(kind === 'fly' && it?.fly === 'dry');
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
    this.ghostRing.material.opacity += ((aimOn && this.ghostShow ? 0.3 : 0) - this.ghostRing.material.opacity) * k;
    this.ghostRing.visible = this.ghostRing.material.opacity > 0.01;
    this.aimRing.material.opacity += ((aimOn ? 0.65 : 0) - this.aimRing.material.opacity) * k;
    this.arc.material.opacity += ((aimOn ? 0.75 : 0) - this.arc.material.opacity) * k;
    this.aimRing.visible = this.aimRing.material.opacity > 0.01;
    this.arc.visible = this.arc.material.opacity > 0.01;
  }

  // The line as drawn: from the reel up through the guides to the rod tip, then the line out.
  drawLine(t) {
    const P = this.linePos, rod = this.angler.active;
    let n = 0;
    const put = (v) => {
      P[n++] = v.x;
      P[n++] = v.y;
      P[n++] = v.z;
    };
    if (rod?.lineFrom && rod.guides?.length) {
      put(rod.lineFrom.getWorldPosition(_w));
      for (let i = 0; i < ROD_PTS - 1; i++) put((rod.guides[i] || rod.tip).getWorldPosition(_w));
    } else for (let i = 0; i < ROD_PTS; i++) put(this.tip);
    const L = this.fishLine.p, buzz = this.lineBuzz;
    for (let i = 0; i < LINE_PTS; i++) {
      const o = i * 3;
      // (Thrumming near breaking: a quick shiver along it, most in the middle.)
      const k = buzz ? Math.sin(t * 95 + i * 2.3) * buzz * Math.sin((Math.PI * i) / (LINE_PTS - 1)) : 0;
      P[n++] = L[o] + k * 0.5;
      P[n++] = L[o + 1] + k;
      P[n++] = L[o + 2];
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
