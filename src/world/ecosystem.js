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
const BAIT_STATES = new Set(['approach', 'investigate', 'nibble', 'bite', 'follow', 'lunge', 'inspect', 'sip']);
// How long you have to strike, by how the fish took it.
const WINDOWS = { strike: 1.15, sip: 1.0, take: 1.35, run: 4.2 };
const _f = { x: 0, z: 0 };
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
    this.ctx = { hour: 12, rain: 0, daylight: 1, night: 0, lanternNear: false, hatch: 0.5 };
    this.focus = { x: 0, z: 0 };
    this.boat = { x: 0, z: 0, speed: 0 };
    this.walker = null;
    this.walkT = 0;
    // Handfuls of loose bait thrown in for the carp: { x, z, amount }.
    this.feedSpots = [];
    this.lantern = null;
    this.activity = {};
    this.startleT = 0;
    // The one rig in the water, written by the fishing system each frame. `kind` is how it is
    // fished (float, lure, ledger, fly) and `item` what is on the hook (tackle.js).
    this.bait = {
      active: false, kind: 'float', item: 'worm', size: 1, fly: null, thick: 0.35,
      x: 0, y: 0, z: 0, speed: 0, motion: 'still', twitch: 0, pause: false, drag: false, fouled: false,
      fresh: 0, nearBottom: false, anglerX: 0, anglerZ: 0, owner: null, held: false,
    };
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

  // A handful of loose bait thrown in: carp nearby will come and graze for a while.
  addFeed(x, z, amount = 1) {
    const near = this.feedSpots.find((f) => Math.hypot(f.x - x, f.z - z) < 4);
    if (near) near.amount = Math.min(near.amount + amount, 2.5);
    else this.feedSpots.push({ x, z, amount });
    if (this.feedSpots.length > 4) this.feedSpots.shift();
  }

  // After a long sleep: everyone picks up where the new hour finds them.
  settle() {
    for (const a of this.agents) {
      if (a.state === 'caught' || a.state === 'hooked' || a.state === 'gone') continue;
      a.wary = 0;
      a.faceBait = false;
      if (a.school) a.state = 'school';
      else this.decide(a);
      const band = a.L.depth(this.ctx);
      const depth = Math.max(this.habitat.depth(a.x, a.z), 0.8);
      a.y = a.py = -clamp(lerp(band[0], band[1], Math.random()), 0.3, depth - 0.3);
    }
    for (const s of this.schools) s.t = 99;
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
    this.walker = ctx.walker;
    this.lantern = ctx.lantern;
    for (const f of this.feedSpots) f.amount -= dt * 0.002;
    if (this.feedSpots.length && this.feedSpots[0].amount <= 0) this.feedSpots = this.feedSpots.filter((f) => f.amount > 0);
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
      if (a.state === 'gone') {
        if (this.time > a.backAt) this.restock(a);
        continue;
      }
      if (!a.active || a.state === 'caught' || a.state === 'hooked') continue;
      const d2 = (a.x - fx) ** 2 + (a.z - fz) ** 2;
      if (d2 < near2) this.stepAgent(a, h, false);
      else if (d2 < far2 && (this.tick + a.id) % FAR_EVERY === 0) this.stepAgent(a, h * FAR_EVERY, true);
    }
    this.boatStartle(h);
    this.walkerStartle(h);
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
      case 'escort': this.escort(a); break;
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
    // Carp find loose bait thrown in nearby and graze there.
    if (L.grazer) {
      const spot = this.feedSpots.find((f) => f.amount > 0.05 && Math.hypot(f.x - a.x, f.z - a.z) < 45);
      if (spot && Math.random() < 0.8) {
        this.startState(a, 'feed', rand(14, 26));
        a.feedSpot = spot;
        a.tx = spot.x + rand(-2, 2);
        a.tz = spot.z + rand(-2, 2);
        a.ty = -this.habitat.depth(a.tx, a.tz) + 0.4;
        a.wantSpeed = L.speed;
        return;
      }
    }
    // Pike lie still in the weed most of the time.
    if (L.lurk) return Math.random() < 0.75 ? this.startState(a, 'rest', rand(10, 30)) : this.startState(a, 'cruise', rand(10, 18));
    const r = Math.random();
    if (r < 0.45) return this.startState(a, 'cruise');
    if (r < 0.75) return this.startState(a, 'feed', rand(4, 9));
    return this.startState(a, 'rest', rand(3, 8));
  }

  startState(a, state, dur) {
    a.state = state;
    a.feedSpot = null;
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
    if (a.feedSpot) a.feedSpot.amount -= h * 0.004;
    if (a.retarget <= 0 || this.near(a, 0.4)) {
      // short darts close to the bottom, picking at weeds and sand (or at the loose bait)
      a.retarget = rand(1, 2.5);
      const cx = a.feedSpot ? a.feedSpot.x : a.x, cz = a.feedSpot ? a.feedSpot.z : a.z;
      const x = cx + rand(-1.8, 1.8), z = cz + rand(-1.8, 1.8);
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
    let want = Math.atan2(dx, dz);
    // Stream fish hold station facing into the current.
    if (a.L.stream && dh < 1.2 && !a.faceBait && a.state !== 'flee') {
      this.habitat.flow(a.x, a.z, _f);
      if (Math.abs(_f.x) + Math.abs(_f.z) > 0.08) want = Math.atan2(-_f.x, -_f.z);
    }
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

  // How tempting the rig in the water is to this fish, or 0 if it ignores it completely.
  // Everything a fish cares about lives here: what's on the hook, how it moves, its size,
  // whether a dry fly matches the hatch or drags, and how thick the line looks.
  appeal(a, b) {
    const sp = a.sp, L = a.L;
    let f = sp.food?.[b.item] ?? 0;
    if (f <= 0 || b.fouled) return 0;
    if (L.bottom && !b.nearBottom) return 0;
    if (b.size > (sp.mouth ?? 2)) f *= 0.1;
    if (b.fly === 'dry') {
      f *= 0.25 + (this.ctx.hatch ?? 0.5);
      if (b.drag) f *= 0.07;
    } else if (b.drag) f *= 0.55;
    if (L.lineShy && b.thick > L.lineShy) f *= 0.3;
    f *= L.likes[b.motion] ?? 0.5;
    return f;
  }

  considerBait(a) {
    const b = this.bait;
    if (!b.active || b.owner || b.held || a.wary > 0) return;
    const L = a.L;
    const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
    const d = Math.hypot(dx, dy, dz);
    const per = L.perception * (this.ctx.night > 0.6 && !L.lantern ? 0.75 : 1) * (L.lurk ? 0.75 : 1);
    if (d > per) return;
    const dv = Math.abs(dy);
    if (dv > L.depthTol * 2.2) return;
    const ap = this.appeal(a, b);
    if (ap <= 0) return;
    let p = this.activity[a.sp.id] * ap
      * (1 - smoothstep(L.depthTol * 0.6, L.depthTol * 2.2, dv))
      * Math.pow(1 - d / per, 0.6) * 0.35;
    if (b.fresh > 0) p *= 1.6;
    if (a.caught > 0) p *= 0.6;
    if (L.grazer && this.feedSpots.some((f) => f.amount > 0.05 && Math.hypot(f.x - b.x, f.z - b.z) < 6)) p *= 2;
    if (Math.random() < p) this.engage(a);
  }

  // The way a fish goes about taking this particular rig.
  styleFor(a, b) {
    const s = a.L.strike || {};
    if (b.kind === 'lure') return s.lure || 'chase';
    if (b.kind === 'fly') {
      if (b.fly === 'dry') return s.dry || 'rise';
      if (b.fly === 'streamer') return s.streamer || 'chase';
      return s.nymph || 'take';
    }
    if (b.kind === 'ledger') return s.ledger || 'nibble';
    return s.float || 'nibble';
  }

  engage(a) {
    const b = this.bait;
    b.owner = a;
    a.style = this.styleFor(a, b);
    a.t = 0;
    a.invT = 0;
    a.nibbles = 0;
    a.followT = 0;
    a.strikeCD = 0.6;
    a.maxNibbles = a.style === 'take' ? 1 : 1 + Math.floor(Math.random() * 3);
    if (a.style === 'ambush') {
      // No warning: it simply goes.
      a.state = 'lunge';
      return;
    }
    if (a.style === 'chase') {
      a.state = 'follow';
      this.listener.onFollow?.(a);
      if (a.L.pack) this.callPack(a);
      return;
    }
    if (a.style === 'rise') {
      a.state = 'inspect';
      a.dur = rand(1.4, 3) * a.L.caution;
      this.listener.onCurious?.(a);
      return;
    }
    a.state = 'approach';
    this.listener.onCurious?.(a);
  }

  // Perch hunt in packs: when one follows a lure, its friends tag along for a look.
  callPack(a) {
    for (const o of this.bySpecies[a.sp.id]) {
      if (o === a || !o.active || !ENGAGEABLE.has(o.state) || o.wary > 0) continue;
      if (Math.abs(o.x - a.x) > 7 || Math.abs(o.z - a.z) > 7) continue;
      o.state = 'escort';
      o.t = 0;
      o.dur = rand(2.5, 6);
      o.slotSide = Math.random() < 0.5 ? -1 : 1;
    }
  }

  escort(a) {
    const b = this.bait;
    if (!b.active || a.t > a.dur || b.kind !== 'lure') return this.startState(a, 'cruise');
    const dx = b.anglerX - b.x, dz = b.anglerZ - b.z, l = Math.hypot(dx, dz) || 1;
    a.tx = b.x - (dx / l) * 1.4 - (dz / l) * a.slotSide * 0.7;
    a.ty = b.y - 0.2;
    a.tz = b.z - (dz / l) * 1.4 + (dx / l) * a.slotSide * 0.7;
    a.wantSpeed = clamp(b.speed * 1.1 + 0.3, 0.2, a.L.speed * 2);
    if (Math.hypot(b.x - b.anglerX, b.z - b.anglerZ) < 3.5) this.startState(a, 'cruise');
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
          a.dur = rand(1.6, 3.4) * L.caution * (a.style === 'take' ? 0.4 : 1);
          a.nibbleT = rand(0.6, 1.3) * (a.style === 'take' ? 0.5 : 1);
        } else if (a.t > 18 || d > L.perception * 1.6) this.disengage(a, 'lost', 5);
        break;
      case 'investigate': {
        a.invT += h;
        a.faceBait = true;
        const side = Math.sin(this.time * 1.3 + a.id) * 0.25;
        a.tx = b.x + (dx / hl) * 0.6 - (dz / hl) * side;
        a.ty = b.y + Math.sin(this.time * 0.9 + a.id) * 0.08;
        a.tz = b.z + (dz / hl) * 0.6 + (dx / hl) * side;
        a.wantSpeed = 0.12 + b.speed * 0.9;
        a.nibbleT -= h;
        if (b.speed > 1.0 && L.likes.slow < 1) this.disengage(a, 'startled', 6);
        else if (this.appeal(a, b) <= 0) this.disengage(a, 'lost', 6);
        else if (a.nibbleT <= 0 && a.nibbles < a.maxNibbles) {
          a.state = 'nibble';
          a.t = 0;
          a.nibbled = false;
        } else if (a.invT > a.dur && a.nibbles >= 1) {
          const eager = L.bite * (b.twitch > 0 ? 1.15 : 1) * (0.7 + this.activity[a.sp.id] * 0.4);
          if (Math.random() < eager) this.startBite(a, a.style === 'run' ? 'run' : a.style === 'take' ? 'take' : 'float');
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
        a.wantSpeed = 0.5 + b.speed;
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
      case 'follow': {
        // Right behind the lure as it comes in. A twitch or a pause is often what makes it hit.
        const tx = b.anglerX - b.x, tz = b.anglerZ - b.z, tl = Math.hypot(tx, tz) || 1;
        a.faceBait = true;
        a.followT += h;
        a.tx = b.x - (tx / tl) * 0.7;
        a.ty = b.y;
        a.tz = b.z - (tz / tl) * 0.7;
        a.wantSpeed = clamp(b.speed * 1.1 + d * 0.8, 0.2, L.speed * 2.3);
        if (tl < 3.2) return this.disengage(a, 'turned', 10);
        if (a.followT > 11 || d > L.perception * 1.4) return this.disengage(a, 'lost', 6);
        if (this.appeal(a, b) <= 0) return this.disengage(a, 'lost', 6);
        a.strikeCD -= h;
        if (a.strikeCD <= 0 && d < 1.8) {
          a.strikeCD = 0.3;
          let p = 0.06 * (L.likes[b.motion] ?? 0.5) * L.bite;
          if (b.twitch > 0) p *= 4;
          if (b.pause) p *= 3.5;
          if (b.motion === 'still' && !b.pause) p *= 0.3;
          if (Math.random() < p) {
            a.state = 'lunge';
            a.t = 0;
          }
        }
        break;
      }
      case 'lunge':
        // A burst straight at it. Pike come out of nowhere.
        a.faceBait = true;
        a.tx = b.x;
        a.ty = b.y;
        a.tz = b.z;
        a.wantSpeed = L.speed * (L.burst || 2.6);
        a.speed = Math.max(a.speed, a.wantSpeed * 0.75);
        if (d < 0.4) this.startBite(a, 'strike');
        else if (a.t > 1.5) this.disengage(a, 'missed', 12);
        break;
      case 'inspect':
        // Drifts up under the fly, looking.
        a.faceBait = true;
        a.invT += h;
        a.tx = b.x;
        a.ty = Math.min(b.y - 0.35, -0.3);
        a.tz = b.z;
        a.wantSpeed = clamp(b.speed + d * 0.9, 0.15, L.speed * 1.6);
        if (d > L.perception * 1.5) return this.disengage(a, 'lost', 6);
        if (a.invT > a.dur) {
          const yes = clamp(L.bite * this.appeal(a, b), 0, 0.95);
          if (Math.random() < yes) {
            a.state = 'sip';
            a.t = 0;
          } else this.disengage(a, 'refused', 15);
        }
        break;
      case 'sip':
        a.faceBait = true;
        a.tx = b.x;
        a.ty = b.y;
        a.tz = b.z;
        a.wantSpeed = L.speed;
        if (d < 0.35 || a.t > 0.8) {
          this.clue('rise', a);
          this.startBite(a, 'sip');
        }
        break;
      case 'bite':
        a.faceBait = false;
        a.biteT -= h;
        a.tx = a.biteX;
        a.ty = a.biteY;
        a.tz = a.biteZ;
        a.wantSpeed = L.speed * (a.biteKind === 'run' ? 2.4 : 0.6);
        if (a.biteT <= 0) this.disengage(a, 'spat', 12);
        break;
      default:
    }
  }

  startBite(a, kind = 'float') {
    const b = this.bait;
    a.state = 'bite';
    a.t = 0;
    a.biteKind = kind;
    a.biteT = WINDOWS[kind] ?? BITE_WINDOW + (a.L.caution > 1.5 ? 0.6 : 0);
    // It swims off with the bait, away from you (a long way, if it's a carp on a run).
    const dx = b.x - b.anglerX, dz = b.z - b.anglerZ, l = Math.hypot(dx, dz) || 1;
    const go = kind === 'run' ? 9 : kind === 'strike' || kind === 'sip' ? 0.8 : 1.6;
    a.biteX = b.x + (dx / l) * go;
    a.biteZ = b.z + (dz / l) * go;
    a.biteY = Math.max(b.y - 0.3, -this.habitat.depth(a.biteX, a.biteZ) + 0.4);
    b.held = true;
    this.listener.onBite?.(a, kind);
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

  // Kept for the pot: gone for a while, then another fish of its kind turns up at its home.
  keep(a) {
    a.state = 'gone';
    a.backAt = this.time + rand(240, 420);
  }

  restock(a) {
    const sp = a.sp;
    a.size = Math.round(lerp(sp.size[0], sp.size[1], Math.pow(Math.random(), 1.7)));
    a.scale = (a.size / 100) * sp.visual;
    a.caught = 0;
    a.wary = 0;
    a.x = a.px = a.home.x;
    a.z = a.pz = a.home.z;
    a.y = a.py = -Math.min(1.5, Math.max(this.habitat.depth(a.x, a.z) - 0.4, 0.3));
    if (a.school) a.state = 'school';
    else this.startState(a, 'rest', 5);
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
      if (!a.active || a.state === 'caught' || a.state === 'hooked' || a.state === 'jump' || a.state === 'gone') continue;
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

  // Heavy footsteps on the bank send shy fish (trout, carp in the shallows) darting off.
  // Standing still or creeping up slowly is fine.
  walkerStartle(h) {
    this.walkT -= h;
    const w = this.walker;
    if (!w || this.walkT > 0) return;
    this.walkT = 0.35;
    if (w.speed < 1.6) return;
    const jog = w.speed > 4;
    for (const a of this.agents) {
      if (!a.active || !a.L.spooky || a.state === 'flee' || a.state === 'caught' || a.state === 'hooked' || a.state === 'gone') continue;
      const dx = a.x - w.x, dz = a.z - w.z;
      // Trout feel a jogger from well back; walking, you have to come right up to the bank.
      const r = a.L.spooky > 2 ? a.L.spooky * (jog ? 0.9 : 0.4) : jog ? 4.5 : 2.5;
      if (dx * dx + dz * dz > r * r) continue;
      if (a.L.spooky <= 2 && this.habitat.depth(a.x, a.z) > a.L.spooky) continue;
      this.flee(a, w.x, a.y, w.z, rand(2, 3.5), 2.6);
      a.wary = Math.max(a.wary, 25);
      this.listener.onSpooked?.(a);
    }
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
    if (a.L.grazer && a.state === 'feed' && a.clueCD <= 0) {
      // Feeding carp send up patches of fizzing bubbles: the surest sign of them.
      a.clueCD = rand(1.5, 4);
      this.clue('fizz', a);
    } else if (a.L.bubbles && a.clueCD <= 0) {
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
      if (!a.active || a.state === 'caught' || a.state === 'gone' || a.y > -0.15) continue;
      const depth = -a.y;
      const r = Math.hypot(a.x - x, a.z - z);
      const cone = tanA * depth + 0.6;
      if (r > cone) continue;
      out.push({ depth: Math.hypot(depth, r * 0.6), size: a.scale, strength: 1 - r / cone });
    }
    return out;
  }
}

