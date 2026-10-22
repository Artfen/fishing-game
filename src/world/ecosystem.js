import { FISH } from '../fish.js';
import { zoneAt } from './terrain.js';
import { clamp, lerp, damp, rand, smoothstep, wrapAngle, seeded } from '../util.js';

// Every fish in the world lives here. The renderer draws these fish, the fish finder
// pings these fish, surface clues come from these fish, and the fish that takes your
// bait is one of these fish. Movement runs on a fixed 30 Hz step, independent of frame rate.

const STEP = 1 / 30;
const FAR_EVERY = 6; // fish beyond the active radius update at 5 Hz
const FAR_RADIUS = 240;
const BITE_WINDOW = 2.6; // seconds you have to set the hook once a fish takes the bait
const ENGAGEABLE = new Set(['cruise', 'rest', 'feed', 'school']);
const BAIT_STATES = new Set(['approach', 'investigate', 'nibble', 'bite']);
const _s = {};
const _g = { x: 0, z: 0 };

export class Ecosystem {
  constructor(habitat) {
    this.habitat = habitat;
    this.agents = [];
    this.schools = [];
    this.bySpecies = Object.fromEntries(FISH.map((f) => [f.id, []]));
    this.clues = [];
    this.acc = 0;
    this.alpha = 0;
    this.tick = 0;
    this.time = 0;
    this.density = 1;
    this.simRadius = 110;
    this.ctx = { hour: 12, rain: 0, daylight: 1, night: 0, lanternNear: false };
    this.focus = { x: 0, z: 0 };
    this.boat = { x: 0, z: 0, speed: 0 };
    this.lantern = null;
    this.activity = {};
    this.startleT = 0;
    // The one bait in the water, written by the fishing system each frame.
    this.bait = { active: false, x: 0, y: 0, z: 0, speed: 0, twitch: 0, fresh: 0, nearBottom: false, owner: null, held: false };
    this.listener = {};
    this.populate();
  }

  /* ---------- population ---------- */

  populate() {
    let rnd = seeded(77);
    const pickHomes = (L, n, gap, nearJetty) => {
      const cands = this.habitat.spots.filter((s) => L.homes.includes(s.type) && L.zones.includes(s.zone));
      for (let i = cands.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [cands[i], cands[j]] = [cands[j], cands[i]];
      }
      if (nearJetty) cands.sort((a, b) => (b.tag === 'jetty') - (a.tag === 'jetty'));
      const out = [];
      for (const s of cands) {
        if (out.length >= n) break;
        if (out.some((o) => Math.hypot(o.x - s.x, o.z - s.z) < gap)) continue;
        out.push(s);
      }
      return out;
    };
    FISH.forEach((sp, i) => {
      // Each species gets its own seed, so tuning one never reshuffles the others.
      rnd = seeded(77 + i * 1013);
      const L = sp.life;
      if (L.school) {
        for (const home of pickHomes(L, L.schools, L.spacing ?? 22, true)) this.addSchool(sp, home, rnd);
      } else {
        for (const home of pickHomes(L, L.groups, L.spacing ?? 18, sp.id === 'sunperch')) {
          const n = L.group[0] + Math.floor(rnd() * (L.group[1] - L.group[0] + 1));
          for (let k = 0; k < n; k++) this.addAgent(sp, home, rnd);
        }
      }
    });
  }

  addAgent(sp, home, rnd, school = null) {
    const L = sp.life;
    const size = Math.round(lerp(sp.size[0], sp.size[1], Math.pow(rnd(), 1.7)));
    const a = {
      id: this.agents.length, sp, L, size, scale: (size / 100) * sp.visual, home, school, slot: null,
      x: home.x + (rnd() - 0.5) * home.r, y: -1, z: home.z + (rnd() - 0.5) * home.r,
      px: 0, py: 0, pz: 0, pyaw: 0,
      yaw: rnd() * Math.PI * 2, pitch: 0, bank: 0, speed: 0, wantSpeed: 0, turnRate: 0,
      tx: 0, ty: 0, tz: 0, state: 'rest', t: 0, dur: rnd() * 4, rank: rnd(), active: true,
      wary: 0, flashCD: 2 + rnd() * 6, clueCD: 2 + rnd() * 8, interestCD: rnd() * 0.5, retarget: 0,
      nibbles: 0, maxNibbles: 1, nibbleT: 0, invT: 0, biteT: 0, vy: 0, jumpSpeed: 0,
      phase: rnd() * 10, beat: 0.3, caught: 0, faceBait: false, risen: false,
    };
    if (this.habitat.depth(a.x, a.z) < 0.8) {
      a.x = home.x;
      a.z = home.z;
    }
    const band = L.depth(this.ctx);
    const depth = Math.max(this.habitat.depth(a.x, a.z), 0.8);
    a.y = -clamp(lerp(band[0], band[1], rnd()), 0.3, depth - 0.3);
    a.tx = a.x;
    a.ty = a.y;
    a.tz = a.z;
    a.px = a.x;
    a.py = a.y;
    a.pz = a.z;
    a.pyaw = a.yaw;
    this.agents.push(a);
    this.bySpecies[sp.id].push(a);
    return a;
  }

  addSchool(sp, home, rnd) {
    const L = sp.life;
    const s = {
      id: this.schools.length, sp, L, home, members: [], scale: 0,
      x: home.x, y: -0.9, z: home.z, yaw: rnd() * Math.PI * 2, pitch: 0, bank: 0,
      speed: 0, wantSpeed: 0, turnRate: 0, tx: home.x, ty: -0.9, tz: home.z,
      t: 99, dur: 0, scatterT: 0, sx: 0, sy: 0, sz: 0, spread: 1.4 + rnd() * 0.8, clueCD: 1, flashCD: 3,
    };
    const n = L.members[0] + Math.floor(rnd() * (L.members[1] - L.members[0] + 1));
    for (let k = 0; k < n; k++) {
      const a = this.addAgent(sp, home, rnd, s);
      a.state = 'school';
      a.slot = { x: (rnd() - 0.5) * 2, y: (rnd() - 0.5) * 0.8, z: (rnd() - 0.5) * 2.6, seed: rnd() * 10, idx: k };
      a.x = s.x + a.slot.x;
      a.z = s.z + a.slot.z;
      a.y = s.y;
      a.px = a.x;
      a.pz = a.z;
      a.py = a.y;
      s.members.push(a);
    }
    this.schools.push(s);
  }

  setDensity(d) {
    this.density = d;
    for (const a of this.agents) a.active = a.rank < d || a.state === 'hooked' || BAIT_STATES.has(a.state);
  }

  /* ---------- main loop ---------- */

  update(dt, ctx) {
    Object.assign(this.ctx, ctx.env);
    this.focus = ctx.focus;
    this.boat = ctx.boat;
    this.lantern = ctx.lantern;
    for (const sp of FISH) this.activity[sp.id] = sp.life.activity(this.ctx);
    const b = this.bait;
    if (b.fresh > 0) b.fresh -= dt;
    if (b.twitch > 0) b.twitch -= dt;

    this.acc += Math.min(dt, 0.2);
    let n = 0;
    while (this.acc >= STEP && n < 5) {
      this.stepWorld(STEP);
      this.acc -= STEP;
      n++;
    }
    if (n === 5) this.acc = 0;
    this.alpha = this.acc / STEP;
  }

  stepWorld(h) {
    this.tick++;
    this.time += h;
    const fx = this.focus.x, fz = this.focus.z;
    const near2 = this.simRadius * this.simRadius, far2 = FAR_RADIUS * FAR_RADIUS;
    for (const s of this.schools) {
      const d2 = (s.x - fx) ** 2 + (s.z - fz) ** 2;
      if (d2 < near2) this.stepSchool(s, h, false);
      else if (d2 < far2 && (this.tick + s.id) % FAR_EVERY === 0) this.stepSchool(s, h * FAR_EVERY, true);
    }
    for (const a of this.agents) {
      a.px = a.x;
      a.py = a.y;
      a.pz = a.z;
      a.pyaw = a.yaw;
      if (!a.active || a.state === 'caught' || a.state === 'hooked') continue;
      const d2 = (a.x - fx) ** 2 + (a.z - fz) ** 2;
      if (d2 < near2) this.stepAgent(a, h, false);
      else if (d2 < far2 && (this.tick + a.id) % FAR_EVERY === 0) this.stepAgent(a, h * FAR_EVERY, true);
    }
    this.boatStartle(h);
  }

  /* ---------- individual fish ---------- */

  stepAgent(a, h, coarse) {
    a.t += h;
    if (a.wary > 0) a.wary -= h;
    a.flashCD -= h;
    a.clueCD -= h;
    if (a.state === 'jump') return this.stepJump(a, h);

    switch (a.state) {
      case 'school': this.followSchool(a); break;
      case 'rest':
      case 'feed':
        // A warm light arriving overhead can draw a resting Duskfin up early.
        if (a.L.lantern && this.lantern && a.t > 3 && this.activity[a.sp.id] > 0.5 && Math.random() < h * 0.2) this.decide(a);
        else if (a.state === 'feed') this.feed(a, h);
        else if (a.t > a.dur) this.decide(a);
        break;
      case 'cruise':
        if (a.t > a.dur || this.near(a, 1.2)) this.decide(a);
        break;
      case 'rise': this.rise(a); break;
      case 'flee':
        if (a.t > a.dur) this.afterFlee(a);
        break;
      default:
        if (BAIT_STATES.has(a.state)) this.baitBehaviour(a, h);
    }
    if (!coarse && ENGAGEABLE.has(a.state)) {
      a.interestCD -= h;
      if (a.interestCD <= 0) {
        a.interestCD = 0.5;
        this.considerBait(a);
      }
    }
    this.steer(a, h);
    this.integrate(a, h);
    if (!coarse) this.emitClues(a);
  }

  near(a, r) {
    return Math.abs(a.tx - a.x) < r && Math.abs(a.tz - a.z) < r && Math.abs(a.ty - a.y) < r;
  }

  decide(a) {
    if (a.school) {
      a.state = 'school';
      return;
    }
    const L = a.L;
    const act = this.activity[a.sp.id];
    // Duskfin drift up towards the warm lantern light after dark.
    if (L.lantern && act > 0.5 && this.lantern && Math.hypot(a.x - this.lantern.x, a.z - this.lantern.z) < 40 && Math.random() < 0.85) {
      a.state = 'cruise';
      a.t = 0;
      a.dur = 12;
      a.tx = this.lantern.x + rand(-3, 3);
      a.tz = this.lantern.z + rand(-3, 3);
      a.ty = -rand(0.8, 2.2);
      a.wantSpeed = L.speed * 0.7;
      return;
    }
    if (act > 0.3 && Math.random() < L.rises(this.ctx) * 0.12) return this.startRise(a);
    if (act < 0.25) return this.startState(a, 'rest', rand(10, 22));
    const r = Math.random();
    if (r < 0.45) return this.startState(a, 'cruise');
    if (r < 0.75) return this.startState(a, 'feed', rand(4, 9));
    return this.startState(a, 'rest', rand(3, 8));
  }

  startState(a, state, dur) {
    a.state = state;
    a.t = 0;
    a.dur = dur ?? 25;
    this.pickPoint(a, state);
    a.wantSpeed = state === 'cruise' ? a.L.speed * rand(0.75, 1.1) : state === 'feed' ? a.L.speed * 0.35 : 0.06;
  }

  // Choose somewhere to go within the fish's home range, preferring cover for resting and feeding.
  pickPoint(a, mode) {
    const L = a.L, home = a.home, R = home.r * (L.range || 1);
    const band = L.depth(this.ctx);
    let bx = home.x, bz = home.z, bd = Math.max(this.habitat.depth(home.x, home.z), 0.8), best = -Infinity;
    for (let i = 0; i < 8; i++) {
      const ang = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
      const x = home.x + Math.cos(ang) * r, z = home.z + Math.sin(ang) * r;
      const s = this.habitat.sample(x, z, _s);
      if (s.depth < Math.max(0.6, band[0] + 0.3)) continue;
      if (!L.zones.includes(zoneAt(x, z))) continue;
      const cover = L.cover === 'weed' ? s.weed : L.cover === 'rock' ? s.rock : L.cover === 'open' ? 0 : Math.max(s.weed, s.rock);
      let score = Math.random() * 0.4 + (mode === 'cruise' ? 0 : cover * 1.2);
      if (L.bottom) score += smoothstep(band[0], band[0] + 6, s.depth);
      if (score > best) {
        best = score;
        bx = x;
        bz = z;
        bd = s.depth;
      }
    }
    let y;
    if (L.bottom || mode === 'rest' || mode === 'feed') y = -bd + rand(0.35, mode === 'feed' ? 0.8 : 1.3);
    else y = -rand(band[0], Math.max(band[0], Math.min(band[1], bd - 0.4)));
    y = clamp(y, -band[1], -band[0]);
    y = Math.min(Math.max(y, -bd + 0.3), -0.3);
    a.tx = bx;
    a.ty = y;
    a.tz = bz;
  }

  feed(a, h) {
    if (a.t > a.dur) return this.decide(a);
    a.retarget -= h;
    if (a.retarget <= 0 || this.near(a, 0.4)) {
      // short darts close to the bottom, picking at weeds and sand
      a.retarget = rand(1, 2.5);
      const x = a.x + rand(-1.6, 1.6), z = a.z + rand(-1.6, 1.6);
      const d = this.habitat.depth(x, z);
      if (d > 0.6) {
        a.tx = x;
        a.tz = z;
        a.ty = Math.min(-d + rand(0.25, 0.7), -0.3);
      }
    }
    a.wantSpeed = a.L.speed * 0.35;
  }

  startRise(a) {
    a.state = 'rise';
    a.t = 0;
    a.dur = 12;
    a.risen = false;
    a.tx = a.x + rand(-2, 2);
    a.tz = a.z + rand(-2, 2);
    a.ty = -0.25;
    a.wantSpeed = a.L.speed * 0.9;
  }

  rise(a) {
    if (!a.risen && a.y > -0.45) {
      a.risen = true;
      if (Math.random() < a.L.jumps) return this.startJump(a);
      this.clue('rise', a);
      a.ty = a.y - rand(1, 2.5);
      a.t = 0;
      a.dur = 2;
    } else if (a.t > a.dur) this.decide(a);
  }

  startJump(a, small = false) {
    a.state = 'jump';
    a.vy = small ? rand(1.4, 2.0) : rand(2.4, 3.3);
    a.jumpSpeed = Math.max(a.speed, small ? 1.2 : 1.6);
    this.clue('jump', a);
  }

  stepJump(a, h) {
    a.vy -= 9.8 * h;
    a.y += a.vy * h;
    a.x += Math.sin(a.yaw) * a.jumpSpeed * h;
    a.z += Math.cos(a.yaw) * a.jumpSpeed * h;
    a.pitch = clamp(Math.atan2(a.vy, a.jumpSpeed), -1.2, 1.2);
    a.beat = 1;
    if (a.vy < 0 && a.y < -0.15) {
      this.clue('splash', a);
      a.y = -0.35;
      a.pitch = -0.4;
      a.speed = 1.1;
      if (a.school) a.state = 'school';
      else this.startState(a, 'cruise');
    }
  }

  flee(a, x, y, z, dur, speedMul) {
    if (BAIT_STATES.has(a.state)) this.disengage(a, 'spooked', 8);
    const dx = a.x - x, dz = a.z - z, l = Math.hypot(dx, dz) || 1;
    a.state = 'flee';
    a.t = 0;
    a.dur = dur;
    a.tx = a.x + (dx / l) * 6;
    a.tz = a.z + (dz / l) * 6;
    a.ty = a.y - 1.5;
    a.wantSpeed = a.L.speed * speedMul;
    a.speed = Math.max(a.speed, a.wantSpeed * 0.6);
    a.wary = Math.max(a.wary, 4);
  }

  afterFlee(a) {
    if (a.school) a.state = 'school';
    else this.decide(a);
  }

  /* ---------- schools ---------- */

  stepSchool(s, h, coarse) {
    s.t += h;
    s.clueCD -= h;
    s.flashCD -= h;
    if (s.scatterT > 0) s.scatterT -= h;
    const act = this.activity[s.sp.id];
    if (s.t > s.dur || this.near(s, 1.5)) {
      const mode = act < 0.3 ? 'rest' : Math.random() < 0.65 ? 'cruise' : 'feed';
      this.pickPoint(s, mode);
      s.t = 0;
      s.dur = mode === 'cruise' ? 25 : rand(8, 16);
      s.wantSpeed = mode === 'cruise' ? s.L.speed * 0.8 : 0.18;
      s.spread = act < 0.3 ? 0.75 : rand(1.3, 2.2);
    }
    this.steer(s, h);
    this.integrate(s, h);
    // Nervous water: a school near the surface keeps dimpling it.
    if (!coarse && s.y > -1.1 && this.ctx.daylight > 0.25 && s.clueCD <= 0) {
      s.clueCD = rand(0.6, 1.4);
      const m = s.members[Math.floor(Math.random() * s.members.length)];
      if (m && m.active && m.state === 'school') this.clue('nervous', m);
    }
    // When a shallow school wheels around, a few silver sides catch the light at once.
    if (!coarse && s.flashCD <= 0 && s.y > -2.2 && (Math.abs(s.turnRate) > 0.5 || s.scatterT > 0) && this.ctx.daylight > 0.3) {
      s.flashCD = rand(4, 9);
      const m = s.members[Math.floor(Math.random() * s.members.length)];
      if (m && m.active && m.state === 'school') this.clue('flash', m);
    }
  }

  followSchool(a) {
    const s = a.school, o = a.slot;
    if (s.scatterT > 0) {
      a.tx = a.x + (a.x - s.sx) * 2;
      a.ty = a.y - 0.4;
      a.tz = a.z + (a.z - s.sz) * 2;
      a.wantSpeed = a.L.speed * 3;
      return;
    }
    const w = this.time * 0.35 + o.seed;
    const ox = (o.x + Math.sin(w) * 0.3) * s.spread, oz = (o.z + Math.cos(w * 0.8) * 0.3) * s.spread;
    const cy = Math.cos(s.yaw), sy = Math.sin(s.yaw);
    const sx = s.x + ox * cy + oz * sy, sz = s.z - ox * sy + oz * cy;
    a.tx = sx + sy * s.speed * 0.5;
    a.tz = sz + cy * s.speed * 0.5;
    a.ty = s.y + o.y * s.spread * 0.4;
    const d = Math.hypot(sx - a.x, sz - a.z);
    a.wantSpeed = clamp(s.speed + d * 0.9, 0.05, a.L.speed * 2.4);
    const m = s.members;
    for (let k = 1; k <= 3; k++) {
      const n = m[(o.idx + k * 5) % m.length];
      if (n === a) continue;
      const dx = a.x - n.x, dy = a.y - n.y, dz = a.z - n.z;
      if (dx * dx + dy * dy + dz * dz < 0.09) {
        a.tx += dx * 2;
        a.tz += dz * 2;
      }
    }
  }

  /* ---------- steering ---------- */

  steer(a, h) {
    let dx = a.tx - a.x, dz = a.tz - a.z;
    const dy = a.ty - a.y;
    const dh = Math.hypot(dx, dz);
    if (a.faceBait) {
      dx = this.bait.x - a.x;
      dz = this.bait.z - a.z;
    }
    // Look ahead: if the water ahead is too shallow for this fish, turn towards deeper water.
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    const ahead = this.habitat.depth(a.x + fx * 2.5, a.z + fz * 2.5);
    if (ahead < Math.max(0.5, -a.y + 0.25)) {
      this.habitat.deeper(a.x, a.z, _g);
      dx = _g.x;
      dz = _g.z;
    }
    const want = Math.atan2(dx, dz);
    const maxTurn = a.L.turn * h;
    const turn = clamp(wrapAngle(want - a.yaw), -maxTurn, maxTurn);
    a.yaw += turn;
    a.turnRate = turn / h;
    a.pitch = damp(a.pitch, clamp(Math.atan2(dy, Math.max(dh, 0.6)), -0.5, 0.5), 3, h);
    let speed = a.wantSpeed;
    // Settle gently onto resting and investigating spots instead of overshooting.
    if (a.state !== 'cruise' && a.state !== 'flee' && a.state !== 'school' && dh < 1.5) speed *= Math.max(dh / 1.5, 0.3);
    a.speed = damp(a.speed, speed, 1.6, h);
  }

  integrate(a, h) {
    const cp = Math.cos(a.pitch);
    a.x += Math.sin(a.yaw) * cp * a.speed * h;
    a.z += Math.cos(a.yaw) * cp * a.speed * h;
    a.y += Math.sin(a.pitch) * a.speed * h;
    // Hovering fish still adjust their depth with their fins.
    if (a.speed < 0.3) a.y = damp(a.y, a.ty, 0.6, h);
    const depth = this.habitat.depth(a.x, a.z);
    if (depth < 0.35) {
      this.habitat.deeper(a.x, a.z, _g);
      a.x += _g.x * h * 1.5;
      a.z += _g.z * h * 1.5;
    }
    const floor = -depth + 0.18 + a.scale * 0.15;
    if (a.y < floor) a.y = floor;
    if (a.y > -0.2) a.y = -0.2;
    a.bank = damp(a.bank, clamp(-a.turnRate * 0.25, -0.5, 0.5), 4, h);
    if (a.L) a.beat = damp(a.beat, clamp(a.speed / (a.L.speed * 1.6) + Math.abs(a.turnRate) * 0.15, 0.1, 1), 3, h);
  }

  /* ---------- the bait ---------- */

  considerBait(a) {
    const b = this.bait;
    if (!b.active || b.owner || b.held || a.wary > 0) return;
    const L = a.L;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    const per = L.perception * (this.ctx.night > 0.6 && !L.lantern ? 0.75 : 1);
    if (d > per) return;
    const dv = Math.abs(dy);
    if (dv > L.depthTol * 2.2) return;
    if (L.bottom && !b.nearBottom) return;
    const motion = b.twitch > 0 ? 'twitch' : b.speed > 0.15 ? 'slow' : 'still';
    let p = this.activity[a.sp.id] * L.likes[motion]
      * (1 - smoothstep(L.depthTol * 0.6, L.depthTol * 2.2, dv))
      * Math.pow(1 - d / per, 0.6) * 0.35;
    if (b.fresh > 0) p *= 1.6;
    if (a.caught > 0) p *= 0.6;
    if (Math.random() < p) this.engage(a);
  }

  engage(a) {
    this.bait.owner = a;
    a.state = 'approach';
    a.t = 0;
    a.invT = 0;
    a.nibbles = 0;
    a.maxNibbles = 1 + Math.floor(Math.random() * 3);
    this.listener.onCurious?.(a);
  }

  baitBehaviour(a, h) {
    const b = this.bait, L = a.L;
    if (!b.active || b.owner !== a) return this.disengage(a, 'gone', 4);
    const dx = a.x - b.x, dy = a.y - b.y, dz = a.z - b.z;
    const d = Math.hypot(dx, dy, dz);
    const hl = Math.hypot(dx, dz) || 1;
    switch (a.state) {
      case 'approach':
        a.faceBait = false;
        a.tx = b.x + (dx / hl) * 0.7;
        a.ty = b.y;
        a.tz = b.z + (dz / hl) * 0.7;
        a.wantSpeed = clamp(d * 0.5, 0.25, L.speed * 1.1);
        if (d < 1.0) {
          a.state = 'investigate';
          a.dur = rand(1.6, 3.4) * L.caution;
          a.nibbleT = rand(0.6, 1.3);
        } else if (a.t > 18 || d > L.perception * 1.6) this.disengage(a, 'lost', 5);
        break;
      case 'investigate': {
        a.invT += h;
        a.faceBait = true;
        const side = Math.sin(this.time * 1.3 + a.id) * 0.25;
        a.tx = b.x + (dx / hl) * 0.6 - (dz / hl) * side;
        a.ty = b.y + Math.sin(this.time * 0.9 + a.id) * 0.08;
        a.tz = b.z + (dz / hl) * 0.6 + (dx / hl) * side;
        a.wantSpeed = 0.12;
        a.nibbleT -= h;
        if (b.speed > 1.0 && L.likes.slow < 1) this.disengage(a, 'startled', 6);
        else if (a.nibbleT <= 0 && a.nibbles < a.maxNibbles) {
          a.state = 'nibble';
          a.t = 0;
          a.nibbled = false;
        } else if (a.invT > a.dur && a.nibbles >= 1) {
          const eager = L.bite * (b.twitch > 0 ? 1.15 : 1) * (0.7 + this.activity[a.sp.id] * 0.4);
          if (Math.random() < eager) this.startBite(a);
          else this.disengage(a, 'lost', 6);
        }
        break;
      }
      case 'nibble':
        a.invT += h;
        a.faceBait = true;
        a.tx = b.x;
        a.ty = b.y;
        a.tz = b.z;
        a.wantSpeed = 0.5;
        if (!a.nibbled && (d < 0.4 || a.t > 0.3)) {
          a.nibbled = true;
          a.nibbles++;
          this.listener.onNibble?.(a);
        }
        if (a.t > 0.55) {
          a.state = 'investigate';
          a.nibbleT = rand(0.7, 1.5);
        }
        break;
      case 'bite':
        a.faceBait = false;
        a.biteT -= h;
        a.tx = a.biteX;
        a.ty = a.biteY;
        a.tz = a.biteZ;
        a.wantSpeed = L.speed * 0.6;
        if (a.biteT <= 0) this.disengage(a, 'spat', 12);
        break;
      default:
    }
  }

  startBite(a) {
    const b = this.bait;
    a.state = 'bite';
    a.t = 0;
    a.biteT = BITE_WINDOW + (a.L.caution > 1.5 ? 0.6 : 0);
    // It swims off slowly with the bait, away from the boat.
    const dx = b.x - this.boat.x, dz = b.z - this.boat.z, l = Math.hypot(dx, dz) || 1;
    a.biteX = b.x + (dx / l) * 1.6;
    a.biteZ = b.z + (dz / l) * 1.6;
    a.biteY = Math.max(b.y - 0.3, -this.habitat.depth(b.x, b.z) + 0.4);
    b.held = true;
    this.listener.onBite?.(a);
  }

  disengage(a, reason, wary) {
    const b = this.bait;
    if (b.owner === a) {
      b.owner = null;
      b.held = false;
    }
    a.wary = Math.max(a.wary, wary);
    a.faceBait = false;
    if (a.school) a.state = 'school';
    else this.startState(a, 'cruise');
    this.listener.onLeave?.(a, reason);
  }

  // Called by fishing: the player set the hook.
  hook(a) {
    a.state = 'hooked';
    a.faceBait = false;
    this.bait.held = true;
    this.startle(a.x, a.y, a.z, 5, 0.8);
  }

  placeHooked(a, x, y, z, yaw, beat) {
    a.x = a.px = x;
    a.y = a.py = y;
    a.z = a.pz = z;
    a.yaw = a.pyaw = yaw;
    a.pitch = 0;
    a.bank = 0;
    a.beat = beat;
    a.speed = 1;
  }

  catchAgent(a) {
    a.state = 'caught';
    const b = this.bait;
    if (b.owner === a) {
      b.owner = null;
      b.held = false;
    }
  }

  // Back into the water: the same fish, a little wiser for a while.
  release(a, x, z) {
    a.x = a.px = x;
    a.z = a.pz = z;
    a.y = a.py = -0.5;
    a.caught++;
    a.wary = 120;
    a.state = 'flee';
    a.t = 0;
    a.dur = 3;
    const depth = this.habitat.depth(x, z);
    this.habitat.deeper(x, z, _g);
    a.tx = x + _g.x * 6;
    a.tz = z + _g.z * 6;
    a.ty = -Math.min(3, Math.max(depth - 0.5, 0.4));
    a.yaw = Math.atan2(_g.x, _g.z);
    a.speed = 1;
    a.wantSpeed = a.L.speed * 2.2;
  }

  lostHooked(a) {
    if (this.bait.owner === a) {
      this.bait.owner = null;
      this.bait.held = false;
    }
    a.state = 'flee';
    a.t = 0;
    a.dur = 3;
    a.wary = 60;
    a.tx = a.x + rand(-5, 5);
    a.tz = a.z + rand(-5, 5);
    a.ty = a.y - 1.5;
    a.wantSpeed = a.L.speed * 2.4;
  }

  /* ---------- disturbances ---------- */

  startle(x, y, z, radius, strength = 1) {
    const r2 = radius * radius;
    const schools = new Set();
    for (const a of this.agents) {
      if (!a.active || a.state === 'caught' || a.state === 'hooked' || a.state === 'jump') continue;
      const dx = a.x - x, dy = (a.y - y) * 0.7, dz = a.z - z;
      if (dx * dx + dy * dy + dz * dz > r2) continue;
      if (a.school) {
        schools.add(a.school);
        if (BAIT_STATES.has(a.state)) this.disengage(a, 'spooked', 8);
        continue;
      }
      if (a.L.bottom && strength < 1.5) continue; // the big old fish don't spook easily
      this.flee(a, x, y, z, rand(1.2, 2.4) * strength, 2.6);
    }
    for (const s of schools) {
      s.scatterT = 1.3 * strength;
      s.sx = x;
      s.sy = y;
      s.sz = z;
      for (const m of s.members) {
        if (m.state === 'school' && m.active && m.y > -0.9 && Math.random() < 0.1) this.startJump(m, true);
      }
    }
  }

  boatStartle(h) {
    this.startleT -= h;
    const bt = this.boat;
    if (this.startleT > 0 || bt.speed < 1.4) return;
    this.startleT = 0.3;
    this.startle(bt.x, -0.6, bt.z, 4 + bt.speed * 0.8, 1);
  }

  /* ---------- clues & queries ---------- */

  clue(type, a) {
    if (this.clues.length < 64) this.clues.push({ type, x: a.x, y: a.y, z: a.z, size: a.scale, sp: a.sp.id });
  }

  emitClues(a) {
    // A fish turning sharply near the surface in daylight catches the light.
    // (Schools flash together, from stepSchool, rather than every member on its own.)
    if (!a.school && a.flashCD <= 0 && a.y > -2.4 && Math.abs(a.turnRate) > 1.2 && a.speed > 0.2 && this.ctx.daylight > 0.3) {
      this.clue('flash', a);
      a.flashCD = rand(8, 18);
    }
    if (a.L.bubbles && a.clueCD <= 0) {
      a.clueCD = rand(6, 14);
      if (Math.random() < 0.5) this.clue('bubbles', a);
    }
  }

  takeClues() {
    const c = this.clues;
    this.clues = [];
    return c;
  }

  // Fish inside a downward sonar cone. Echo depth uses slant range, so fish passing
  // through the edge of the cone read a little deeper: the classic fish-finder arch.
  queryCone(x, z, tanA, out) {
    for (const a of this.agents) {
      if (!a.active || a.state === 'caught' || a.y > -0.15) continue;
      const depth = -a.y;
      const r = Math.hypot(a.x - x, a.z - z);
      const cone = tanA * depth + 0.6;
      if (r > cone) continue;
      out.push({ depth: Math.hypot(depth, r * 0.6), size: a.scale, strength: 1 - r / cone });
    }
    return out;
  }
}

