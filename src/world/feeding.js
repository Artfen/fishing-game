// The living ocean D4 (docs/ECOLOGY.md): feeding events. Not a feeding animation put on the sea,
// but what the sea's own animals do when enough hunters find one shoal of small fish at once:
//  1. The bait concentrates. Hunters pressing a shoal (its fear, D2) make it ball up, tight and
//     holding its ground, and they drive it up towards the top.
//  2. The hunters close in. The fish-eaters near come in under it (bass, pollack, cod, garfish;
//     pike and perch in the lakes: the ecosystem's own fish), and so does a hunting shoal near
//     (mackerel, tuna) that's keen and not resting (see ecosystem.js hunt).
//  3. The top breaks. The sea boils where they crash through it, the small fish spray out, and
//     now and then a hunter clears the water.
//  4. The birds dive. By day the gulls come down on it, and the gannets (in the south the
//     shearwaters: see sealife.js).
//  5. It's seen from far off: the birds from most of a kilometre, the boils from a couple of
//     hundred metres (see main.js handleClues).
//  6. The fish in it take a lure. Hunters in a feed are keen and careless: a lure, a fly or a bait
//     among them is taken far more readily (see ecosystem.js considerOne).
//  7. It disperses, when the hunters have fed (in time, or once the ball's down to what it can
//     spare), or lose interest (the light going), or a boat runs through it. The ball breaks and
//     goes deep, the hunters drift off fed, and the birds hang about a little and go.
// Then quiet: the water a feed was in stays quiet for eight to twenty minutes before another can
// start there, and one starts only where hunters really are pressing a shoal. Most of the time,
// most of the sea is empty.
//
// A feed whose hunters are too few to drive the ball up stays down, and shows nothing at the top.
//
// Far from everyone, where nothing's kept going in detail (beyond 240 m, see ecosystem.js), the
// fish can't press a shoal, so a feed starts there by chance instead, by how keen the hunters
// living about that shoal are just now; it runs on without the fish taking part, until someone
// comes near and they do. (The brief's "aggregate behaviour for distant groups".)
//
// Playing together: the host decides each feed, and what it's doing goes to everyone in the
// snapshot (capture, apply: see sharedworld.js): which shoal, how far on, how many hunters, and
// which kind they mostly are. Each screen shows the top of it from that. The ball is the host's
// shoal, which everyone's already follows.

import { FISH } from '../fish.js';
import { FRESH_ZONES } from './terrain.js';
import { rand, clamp, damp } from '../util.js';
// How long a hunting shoal rests after a frenzy (s), unless its kind says (see ecosystem.js hunt):
// four to ten minutes, so water with hunters in it has its quiet spells.
export const HUNT_REST = [240, 600];

export const GATHER = 0, UP = 1, OVER = 2;
const FRESH = new Set(FRESH_ZONES);
const FISH_IX = new Map(FISH.map((f, i) => [f.id, i]));

export const FEED = {
  press: 1.8,          // a shoal's fear (D2) that can start one: about four hunters at it lately
  pressFor: 6,         // ... on this many looks running
  chance: 0.1,         // ... and then this chance at each look
  look: 2,             // s between looks
  reach: 70,           // m: the hunters this near come in (in fresh water, reachFresh)
  reachFresh: 35,
  most: 16,            // hunters drawn in to one feed at most
  drive: 3,            // hunters it takes to drive the ball up
  top: -2.2,           // m: up to here, it's at the top
  life: [100, 260],    // s: how long the hunters keep at it, if nothing ends it sooner
  none: 20,            // s with no hunters at it and it's over
  linger: 40,          // s: the dispersal, before it's gone
  full: [900, 2400],   // s: a hunter that's fed leaves the small fish alone this long
  quiet: [600, 1500],  // s: the water stays quiet this long after a feed
  quietR: 300,         // m: ... this far round it
  apart: 400,          // m: no two feeds nearer than this
  max: 3,              // feeds at once
  sight: 900,          // m: no feed starts further than this from everyone
  farKeen: 0.7,        // far off: the hunters about a shoal must be this keen
  farChance: 0.00015,  // ... and then this chance at each look, times how keen
  boatR: 9,            // m: a boat running through it this near, over boatV m/s, breaks it up
  boatV: 3,
};

const alive = (s) => {
  let n = 0;
  for (const m of s.members) if (m.state === 'school' && m.active) n++;
  return n;
};

export class Feeding {
  // eco: the ecosystem; far: the radius (m) round everyone the fish are kept going within;
  // engageable: the states a fish can be called away from.
  constructor(eco, far, engageable) {
    this.eco = eco;
    this.far = far;
    this.engageable = engageable;
    this.events = [];
    this.quiet = [];       // [{ x, z, until }]: water a feed was in lately
    this.lookT = 1;
    this.pullT = 0;
    this.started = 0;
    this.onEvent = null;   // (what, feed): 'start', 'up', 'over'
    // The lone fish-eaters, and the hunting shoals.
    this.eaters = eco.agents.filter((a) => a.eater && !a.school);
    this.hunters = eco.schools.filter((s) => s.L.hunter || s.L.hunterSouth);
    // Each shoal of small fish: the fish-eating kinds that live about it (for a feed far off).
    for (const s of eco.forage) {
      const kinds = new Set();
      for (const a of this.eaters) {
        if (a.home.south !== s.home.south || !a.L.zones.includes(s.home.zone)) continue;
        if ((a.home.x - s.home.x) ** 2 + (a.home.z - s.home.z) ** 2 < 150 * 150) kinds.add(a.sp.id);
      }
      for (const h of this.hunters) {
        const prey = [].concat(s.home.south ? h.L.hunterSouth || h.L.hunter : h.L.hunter);
        if (prey.includes(s.sp.id) && (h.home.x - s.home.x) ** 2 + (h.home.z - s.home.z) ** 2 < 400 * 400) kinds.add(h.sp.id);
      }
      s.eaterKinds = [...kinds];
      s.feed = null;
      s.pressN = 0;
    }
  }

  get follower() {
    return this.eco.follower;
  }

  // The feed a shoal is in, if it's going on (not dispersing).
  live(s) {
    const e = s?.feed;
    return e && e.phase < OVER ? e : null;
  }

  // Each step: the host decides; everyone shows the top of it.
  step(h) {
    if (!this.follower) {
      if ((this.lookT -= h) <= 0) {
        this.lookT = FEED.look;
        this.look();
      }
      const pull = (this.pullT -= h) <= 0;
      if (pull) this.pullT = 1;
      for (const e of this.events) this.advance(e, h, pull);
      if (this.events.some((e) => e.done)) this.events = this.events.filter((e) => !e.done);
      if (this.quiet.length && pull) this.quiet = this.quiet.filter((q) => q.until > this.eco.time);
    } else {
      for (const e of this.events) e.t += h;
    }
    for (const e of this.events) this.show(e, h);
  }

  // Where a feed might start.
  look() {
    const eco = this.eco;
    // A hunting shoal in a frenzy on a shoal of small fish: that's a feed.
    for (const H of this.hunters) {
      const p = H.prey;
      if (p && p.forage && H.frenzy > 0 && !p.feed && this.events.length < FEED.max && this.room(p, false)) this.start(p, 'shoal');
    }
    if (this.events.length >= FEED.max) return;
    const far2 = this.far * this.far, sight2 = FEED.sight * FEED.sight;
    for (const s of eco.forage) {
      if (s.feed) continue;
      const d2 = eco.d2near(s.x, s.z);
      if (d2 > sight2) {
        s.pressN = 0;
        continue;
      }
      let cause;
      if (d2 < far2) {
        // Near someone: the hunters pressing it, for a while.
        s.pressN = eco.fearOf(s) >= FEED.press ? s.pressN + 1 : 0;
        if (s.pressN < FEED.pressFor || Math.random() >= FEED.chance) continue;
        cause = 'hunters';
      } else {
        // Far off: by chance, by how keen the hunters about it are.
        const k = this.keenAbout(s);
        if (k < FEED.farKeen || Math.random() >= FEED.farChance * k || this.eco.bandOf(s)[0] > 6) continue;
        // (Only where there are hunters enough about it to drive it up.)
        if (this.huntersAbout(s) < FEED.drive) continue;
        cause = 'far';
      }
      if (!this.room(s, true)) continue;
      this.start(s, cause);
      if (this.events.length >= FEED.max) return;
    }
  }

  // How many keen hunters there are within reach of a shoal (a hunting shoal near counting for four).
  huntersAbout(s) {
    const eco = this.eco, zone = s.home.zone, R = FRESH.has(zone) ? FEED.reachFresh : FEED.reach, T = eco.time;
    let n = 0;
    for (const a of this.eaters) {
      if (!a.active || a.bait || !this.engageable.has(a.state) || a.fullUntil > T || (eco.activity[a.sp.id] ?? 0) < 0.3 || !a.L.zones.includes(zone)) continue;
      if ((a.x - s.x) ** 2 + (a.z - s.z) ** 2 < R * R && ++n >= FEED.most) break;
    }
    for (const H of this.hunters) {
      const prey = [].concat(H.home.south ? H.L.hunterSouth || H.L.hunter : H.L.hunter), L = H.L;
      if (!prey.includes(s.sp.id) || H.rest > 0 || H.frenzy > 0 || (eco.activity[H.sp.id] ?? 0) <= (L.hunt?.keen ?? 0.4)) continue;
      if (L.hunt && s.home.zone && !L.zones.includes(s.home.zone)) continue;
      if (Math.hypot(H.x - s.x, H.z - s.z) < (L.hunt?.range ?? 380)) n += 4;
    }
    return n;
  }

  // How keen the hunters living about a shoal are just now (0 … 1).
  keenAbout(s) {
    let k = 0;
    for (const id of s.eaterKinds) k = Math.max(k, this.eco.activity[id] ?? 0);
    return k;
  }

  // Whether there's room for a feed on this shoal: water enough, and (quiet: unless it's a
  // hunting shoal's frenzy, which keeps its own rests) not where one was lately, nor near another.
  room(s, quiet) {
    if (this.eco.habitat.depth(s.x, s.z) < (FRESH.has(s.home.zone) ? 1.5 : 2.5)) return false;
    // (A shoal already thinned by the hunters (D3) has nothing left to give a feed.)
    if (alive(s) <= Math.ceil((s.members.length * 2) / 3) + 2) return false;
    for (const e of this.events) if ((e.s.x - s.x) ** 2 + (e.s.z - s.z) ** 2 < FEED.apart * FEED.apart) return false;
    if (quiet) for (const q of this.quiet) if ((q.x - s.x) ** 2 + (q.z - s.z) ** 2 < FEED.quietR * FEED.quietR) return false;
    return true;
  }

  start(s, cause) {
    const e = {
      s, id: s.id, phase: GATHER, t: 0, life: rand(FEED.life[0], FEED.life[1]), ax: s.x, az: s.z, x: s.x, z: s.z, cause,
      hunters: 0, sp: -1, lone: 0, upAt: 0, overAt: 0, why: '', done: false,
      boilCD: 0, sprayCD: 0, flashCD: 0, jumpCD: rand(3, 8), birdCD: 0,
    };
    s.feed = e;
    s.pressN = 0;
    this.events.push(e);
    this.started++;
    this.onEvent?.('start', e);
    return e;
  }

  // The host's feed, going on: the hunters coming in, and how it ends.
  advance(e, h, pull) {
    e.t += h;
    const s = e.s, eco = this.eco;
    e.x = s.x;
    e.z = s.z;
    if (e.phase === OVER) {
      if (e.t - e.overAt > FEED.linger) this.end(e);
      return;
    }
    if (pull) this.converge(e);
    // (Far off, nobody's keeping the shoal going: the ball's driven up all the same.)
    if (eco.d2near(s.x, s.z) > this.far * this.far) {
      s.spread = 0.55;
      if (e.hunters >= FEED.drive) s.y = damp(s.y, -0.8, 0.05, h);
    }
    let why = '';
    if (e.t > e.life) why = 'fed';
    else if (e.cause !== 'far' && alive(s) <= Math.ceil((s.members.length * 2) / 3)) why = 'eaten';
    else if (e.hunters === 0 && (e.lone += h) > FEED.none) why = 'gone';
    if (e.hunters > 0) e.lone = 0;
    if (why) return this.disperse(e, why);
    if (e.phase === GATHER && s.y > FEED.top && e.hunters >= FEED.drive) {
      e.phase = UP;
      e.upAt = e.t;
      this.onEvent?.('up', e);
    }
  }

  // The hunters near come in: the lone fish-eaters under it, and a hunting shoal near that's keen
  // and rested. Counts them, and which kind there's most of.
  converge(e) {
    const s = e.s, eco = this.eco, zone = s.home.zone, R = FRESH.has(zone) ? FEED.reachFresh : FEED.reach;
    const depth = eco.habitat.depth(s.x, s.z), T = eco.time;
    let n = 0;
    const kinds = new Map();
    for (const a of this.eaters) {
      if (n >= FEED.most) break;
      if (!a.active || a.bait || !this.engageable.has(a.state) || a.fullUntil > T) continue;
      const dx = a.x - s.x, dz = a.z - s.z;
      if (dx * dx + dz * dz > R * R || !a.L.zones.includes(zone) || (eco.activity[a.sp.id] ?? 0) < 0.3) continue;
      n++;
      kinds.set(a.sp.id, (kinds.get(a.sp.id) || 0) + 1);
      if (a.shoal === s && a.state === 'cruise' && a.t < a.dur - 1) continue;
      // In under the ball, quick.
      const ang = Math.random() * Math.PI * 2, r = rand(1, 6), cool = eco.coolTop(a);
      a.state = 'cruise';
      a.t = 0;
      a.dur = rand(10, 18);
      a.feedSpot = null;
      a.shoal = s;
      a.atPrey = true;
      a.tx = s.x + Math.cos(ang) * r;
      a.tz = s.z + Math.sin(ang) * r;
      a.ty = clamp(s.y - rand(0.3, 1.8), -(depth - 0.3), -0.3);
      if (cool > 0) a.ty = Math.min(a.ty, -(cool - 3));
      a.wantSpeed = a.L.speed * 1.4;
    }
    for (const H of this.hunters) {
      const prey = [].concat(H.home.south ? H.L.hunterSouth || H.L.hunter : H.L.hunter);
      if (!prey.includes(s.sp.id)) continue;
      const on = H.prey === s && (H.frenzy > 0 || Math.hypot(H.x - s.x, H.z - s.z) < 60);
      if (on) {
        n += 4;
        kinds.set(H.sp.id, (kinds.get(H.sp.id) || 0) + 4);
        continue;
      }
      const L = H.L, act = eco.activity[H.sp.id] ?? 0;
      if (H.rest > 0 || H.frenzy > 0 || act <= (L.hunt?.keen ?? 0.4)) continue;
      if (L.hunt && s.home.zone && !L.zones.includes(s.home.zone)) continue;
      if (Math.hypot(H.x - s.x, H.z - s.z) > (L.hunt?.range ?? 380)) continue;
      H.prey = s;
      H.huntT = 4;
      n += 4;
      kinds.set(H.sp.id, (kinds.get(H.sp.id) || 0) + 4);
    }
    e.hunters = n;
    let best = -1, bn = 0;
    for (const [id, c] of kinds) if (c > bn) {
      bn = c;
      best = FISH_IX.get(id) ?? -1;
    }
    e.sp = best;
  }

  // Holding the ball (the host's shoal, in its own step): tight, holding its ground, and driven up
  // if there are hunters enough.
  hold(s, h) {
    const e = s.feed, eco = this.eco;
    s.tx = e.ax;
    s.tz = e.az;
    const depth = eco.habitat.depth(s.x, s.z);
    s.ty = e.hunters >= FEED.drive ? Math.max(-(depth - 0.6), Math.min(-0.8, s.y + 0.1 + 0.02 * Math.min(e.hunters, 10))) : s.y;
    s.spread = 0.55;
    s.wantSpeed = 0.12;
    s.t = 0;
    s.dur = 9;
    s.fled = true;
    s.soundT = 0;
  }

  // A boat running through a feed breaks it up (the host's boat, as only it scatters a shoal).
  boatThrough(x, z, speed) {
    if (this.follower || speed < FEED.boatV) return;
    for (const e of this.events) {
      if (e.phase === OVER) continue;
      if ((e.s.x - x) ** 2 + (e.s.z - z) ** 2 < FEED.boatR * FEED.boatR) this.disperse(e, 'boat');
    }
  }

  // It's over: the ball breaks and goes deep, the hunters drift off fed, the birds go in a while;
  // and the water stays quiet.
  disperse(e, why) {
    const s = e.s, eco = this.eco, T = eco.time;
    e.phase = OVER;
    e.overAt = e.t;
    e.why = why;
    s.scatterT = Math.max(s.scatterT || 0, 2.5);
    s.sx = s.x;
    s.sy = s.y + 1;
    s.sz = s.z;
    // (Down and away a while, loose; then about its own business again, wary still: D2.)
    const depth = eco.habitat.depth(s.x, s.z);
    s.tx = s.x + rand(-15, 15);
    s.tz = s.z + rand(-15, 15);
    s.ty = -Math.max(0.8, Math.min(depth - 0.6, Math.max(4, -s.y + 3)));
    s.t = 0;
    s.dur = rand(20, 40);
    s.spread = 2;
    s.wantSpeed = s.L.speed;
    s.fled = true;
    for (const a of this.eaters) {
      if (a.shoal !== s) continue;
      a.shoal = null;
      a.atPrey = false;
      a.fullUntil = T + rand(FEED.full[0], FEED.full[1]);
      a.strikeT = Math.max(a.strikeT || 0, rand(60, 120));
      if (a.state === 'cruise') a.t = a.dur + 1;
    }
    for (const H of this.hunters) {
      if (H.prey !== s) continue;
      const Rr = H.L.hunt?.rest || HUNT_REST;
      H.prey = null;
      H.frenzy = 0;
      H.rest = Math.max(H.rest || 0, rand(Rr[0], Rr[1]));
    }
    this.quiet.push({ x: s.x, z: s.z, until: T + FEED.linger + rand(FEED.quiet[0], FEED.quiet[1]) });
    this.onEvent?.('over', e);
  }

  end(e) {
    e.done = true;
    if (e.s.feed === e) e.s.feed = null;
  }

  // The top of it, on every screen: the boils where the hunters crash through, the small fish
  // spraying out and flashing, now and then a hunter clearing the water, and by day the birds.
  // (Each screen's own splashes from the host's feed: where and how hard are the same everywhere.)
  show(e, h) {
    const eco = this.eco;
    // (Following the host: its shoal, if the host's spoken of it lately; else where the host's feed
    // says it is, far off.)
    const s = !this.follower || (e.s.net && eco.netT - e.s.net.t0 < 3) ? e.s : e;
    const settling = e.phase === OVER && e.t - e.overAt < 8;
    if (e.phase !== UP && !settling) return;
    const day = (eco.ctx.daylight ?? 1) > 0.3, k = clamp(e.hunters / 6, 0.4, 2);
    const hunter = e.sp >= 0 ? FISH[e.sp] : null;
    if ((e.boilCD -= h) <= 0) {
      e.boilCD = rand(0.6, 1.6) / (settling ? 0.3 : k);
      this.at('boil', s, 3, 0.6, hunter?.id);
    }
    if ((e.sprayCD -= h) <= 0) {
      e.sprayCD = rand(0.25, 0.6);
      this.at('nervous', s, 2.5, 0.1);
    }
    if (day && (e.flashCD -= h) <= 0) {
      e.flashCD = rand(1, 2.5);
      this.at('flash', s, 2.5, 0.12);
    }
    if (hunter && !settling && (e.jumpCD -= h) <= 0) {
      e.jumpCD = rand(6, 16) / k;
      this.at('jump', s, 3, 0.6, hunter.id);
    }
    if (day && !settling && (e.birdCD -= h) <= 0) {
      e.birdCD = rand(5, 9);
      this.at('birds', s, 1, 0, e.s.sp.id, true);
    }
  }

  at(type, s, r, size, sp = s.sp?.id ?? s.s.sp.id, big = false) {
    const C = this.eco.clues;
    if (C.length >= 64) return;
    const ang = Math.random() * Math.PI * 2, d = Math.sqrt(Math.random()) * r * Math.max(0.6, s.spread || 1);
    C.push({ type, x: s.x + Math.cos(ang) * d, y: -0.3, z: s.z + Math.sin(ang) * d, size, sp, feed: true, big });
  }

  /* ---------- playing together ---------- */

  // The host's feeds, for the snapshot: [shoal id, phase, t, life, hunters, kind (index, or -1), x, z].
  capture() {
    const q = (v) => Math.round(v * 10) / 10;
    return this.events.map((e) => [e.id, e.phase, q(e.t), q(e.life), Math.min(64, e.hunters), e.sp, q(e.x), q(e.z)]);
  }

  // Following the host: its feeds, as they are; any it no longer speaks of are over.
  apply(rows) {
    const seen = new Set();
    for (const [id, phase, t, life, hunters, sp, x, z] of rows) {
      const s = this.eco.schools[id];
      if (!s) continue;
      let e = s.feed;
      if (!e) {
        e = { s, id, phase, t, life, ax: x, az: z, x, z, cause: 'host', hunters, sp, lone: 0, upAt: 0, overAt: 0, why: '', done: false, boilCD: 0, sprayCD: 0, flashCD: 0, jumpCD: rand(2, 6), birdCD: 0 };
        s.feed = e;
        this.events.push(e);
      }
      if (phase === OVER && e.phase !== OVER) e.overAt = t;
      Object.assign(e, { phase, t, life, hunters, x, z, sp: sp >= 0 && sp < FISH.length ? sp : -1 });
      seen.add(e);
    }
    for (const e of this.events) if (!seen.has(e)) this.end(e);
    this.events = this.events.filter((e) => !e.done);
  }
}
