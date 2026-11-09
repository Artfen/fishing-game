import * as THREE from 'three';
import { Figure, chatPairs } from './folk.js';
import { SPOTS, along } from '../townsfolk.js';
import { HAVEN_MARKET, walkHeight } from './terrain.js';
import { seeded, damp, dampAngle, clamp, smoothstep, wrapAngle } from '../util.js';

// Willowhaven's other people: nobody you'll get to know, but the harbour's never empty of a fine
// day. A man and his dog out along the quay and round by the slipway, morning and afternoon; a
// couple staying at the inn strolling about, stopping to look at the boats and the fish on the
// slab; the girl from the inn carrying fish boxes up from the market; someone out for a run first
// thing; a child down at the slipway with a crab line of a summer afternoon. Each comes out of a
// door when it's their time (most days, some days not, as the dice of the day say), walks from
// one place to the next along the harbour's paths (townsfolk.js), stops a while at each, and goes
// home at the end of it, or sooner if it comes on to rain. Two of them stood together talk. They
// look up at you, and wave, the same as the townsfolk (world/folk.js), and step round you.
//
// Where they stop: places on the harbour with something to look at, and which way they look.
const M = HAVEN_MARKET;
export const STOPS = {
  view: { x: SPOTS.quayEnd.x - 1.6, z: SPOTS.quayEnd.z - 0.4, yaw: 0, why: 'looking out over the bay' },
  view2: { x: SPOTS.quayEnd.x + 0.4, z: SPOTS.quayEnd.z - 3.2, yaw: 0.6, why: 'watching the boats' },
  bench: { x: SPOTS.bench.x + 0.9, z: SPOTS.bench.z + 0.5, yaw: 0, why: 'by the bench' },
  slab: { x: M.x + 0.2, z: M.z + 1.2, yaw: Math.PI, why: 'looking at the fish on the slab' },
  slipway: { x: SPOTS.slipway.x - 0.8, z: SPOTS.slipway.z - 1.2, yaw: 0, why: 'at the top of the slipway' },
  gangway: { x: SPOTS.gangway.x - 1.2, z: SPOTS.gangway.z - 0.4, yaw: 0.2, why: 'looking over the pontoon' },
  innFront: { x: SPOTS.innFront.x - 1.4, z: SPOTS.innFront.z + 0.8, yaw: 0.6, why: 'outside the inn' },
  chandlery: { x: SPOTS.chandlery.x + 0.8, z: SPOTS.chandlery.z + 0.9, yaw: SPOTS.chandlery.yaw, why: 'at the chandlery door' },
  east: { x: SPOTS.east.x - 1.5, z: SPOTS.east.z - 0.5, yaw: Math.PI / 2, why: 'along the east side' },
};
// Who: how they look (see world/folk.js's LOOKS), their door, the hours they're out, how likely on
// a given day (by season), how fast they walk (m/s), where they go, how long they stop (seconds),
// and anything else: a dog at heel, walking with someone (with: their id; they keep beside them),
// carrying a fish box to the slab, a crab line and bucket.
export const PASSERS = [
  {
    id: 'dogwalker', home: 'east', hours: [7.6, 19.2], chance: { spring: 0.95, summer: 0.95, autumn: 0.9, winter: 0.8 }, pace: 1.15, pause: [10, 26],
    stops: ['view', 'gangway', 'slipway', 'bench', 'east', 'view2'], dog: true,
    look: { coat: '#3f6b4a', legs: '#4a4a44', boots: '#3a2b20', skin: '#efc6a2', hat: 'flatcap', hatColor: '#5a5248', idle: 'behind', stoop: 0.05 },
  },
  {
    id: 'stroller', home: 'inn', hours: [10.2, 17.8], chance: { spring: 0.6, summer: 0.9, autumn: 0.45, winter: 0.2 }, pace: 0.95, pause: [12, 30],
    stops: ['gangway', 'slab', 'view', 'chandlery', 'view2', 'bench'],
    look: { coat: '#c9a25a', legs: '#3b4a68', boots: '#4a3a2a', skin: '#f1c7a1', hat: 'bucket', hatColor: '#e8e2cf', idle: 'pockets' },
  },
  {
    id: 'stroller2', home: 'inn', with: 'stroller', pace: 0.95,
    look: { coat: '#8a3a5a', legs: '#2f2a2c', boots: '#2d2a28', skin: '#efc39d', hat: 'bun', hair: '#5a3a28', idle: 'folded' },
  },
  {
    id: 'errand', home: 'inn', hours: [8.4, 16.5], chance: { spring: 0.85, summer: 0.9, autumn: 0.85, winter: 0.7 }, pace: 1.35, pause: [6, 14],
    stops: ['slab', 'innFront', 'slab', 'chandlery'], carry: 'slab',
    look: { coat: '#4a6a8a', legs: '#2f3236', boots: '#2a2a2a', apron: '#efe9dc', skin: '#f3cba6', hat: 'bun', hair: '#c4843a', idle: 'hips' },
  },
  {
    id: 'runner', home: 'east', hours: [6.6, 8.6], chance: { spring: 0.5, summer: 0.6, autumn: 0.4, winter: 0.2 }, pace: 2.8, pause: [2, 6],
    stops: ['view', 'slipway', 'gangway', 'east', 'view2'],
    look: { coat: '#2f8a9a', legs: '#2a2a2e', boots: '#e8e4da', skin: '#c99a72', hat: 'cap', hatColor: '#e8e4da', idle: 'hips' },
  },
  {
    id: 'child', home: 'net', hours: [13.2, 17.6], chance: { spring: 0.35, summer: 0.8, autumn: 0.25, winter: 0 }, pace: 1.7, pause: [16, 40],
    stops: ['slipway', 'view2', 'slipway', 'bench'], crab: true,
    look: { coat: '#e8b820', legs: '#3b5a8a', boots: '#c43b2f', skin: '#f1c7a1', hat: 'hair', hair: '#8a4a2a', idle: 'pockets', scale: 0.62 },
  },
];
const BY_ID = Object.fromEntries(PASSERS.map((P) => [P.id, P]));
// Out of doors only in fair weather: in after this much rain, or wind and storm.
export const fairFor = (ctx) => (ctx.rain ?? 0) < 0.45 && (ctx.storm ?? 0) < 0.3 && (ctx.wind ?? 0) < 12;
// Whether someone's out at all today (the same answer all day, and for everyone who asks).
export const outToday = (P, day, season = 'summer') => seeded(day * 104729 + P.id.length * 977 + P.id.charCodeAt(0) * 31)() < (P.chance?.[season] ?? 0.7);
// When they come out and go in today (a little different each day).
export function hoursToday(P, day) {
  const r = seeded(day * 7919 + P.id.charCodeAt(1) * 131)();
  return [P.hours[0] + r * 0.6, P.hours[1] - (1 - r) * 0.7];
}

// The people out and about (each with a figure, from world/folk.js), and a dog. paths: the
// harbour's (townsfolk.js's Paths), so they keep to where people can walk.
export class Passersby {
  constructor(scene, paths) {
    this.paths = paths;
    // (Each place where they stop, moved onto the nearest bit of the harbour people can walk.)
    this.stops = Object.fromEntries(Object.entries(STOPS).map(([k, S]) => [k, { ...S, ...paths.snap(S.x, S.z) }]));
    this.people = PASSERS.map((P) => {
      const fig = new Figure(`passer:${P.id}`, P.look);
      scene.add(fig.group);
      return { id: P.id, P, fig, out: false, going: false, path: null, s: 0, len: 0, pause: 0, leg: 0, pos: { ...SPOTS[P.home] }, yaw: 0, act: 'inside', block: null, day: -1 };
    });
    this.dog = new Dog();
    scene.add(this.dog.group);
    this.dog.group.visible = false;
  }

  // How many are out of doors just now.
  get count() {
    return this.people.filter((p) => p.out).length;
  }

  // dt, t: seconds; ctx: { day, hour, season, rain, storm, wind, from (where you are), home (you're
  // at Willowhaven, not away south) }.
  update(dt, t, ctx) {
    const { day, hour, from } = ctx;
    const fair = fairFor(ctx);
    for (const p of this.people) {
      const P = p.P;
      if (P.with) continue;
      const [h0, h1] = P.hours ? hoursToday(P, day) : [0, 0];
      const due = fair && hour >= h0 && hour < h1 && outToday(P, day, ctx.season);
      if (due && !p.out) this.start(p, t);
      else if (!due && p.out && !p.going) this.goHome(p);
      if (p.out) this.walk(p, dt, t, from);
    }
    // (Someone walking with someone keeps beside them, a little to one side, and stops with them.)
    for (const p of this.people) {
      if (!p.P.with) continue;
      const q = this.people.find((o) => o.id === p.P.with);
      p.out = q.out;
      if (!p.out) {
        p.act = 'inside';
        continue;
      }
      const side = 0.62, c = Math.cos(q.yaw), s = Math.sin(q.yaw);
      let x = q.pos.x - side * c, z = q.pos.z + side * s;
      if (!this.paths.ok(x, z)) ({ x, z } = this.paths.snap(x, z));
      p.pos = { x, z };
      p.yaw = q.act === 'walk' ? q.yaw : q.yaw + 0.35;
      p.act = q.act === 'inside' ? 'inside' : q.act;
      p.block = q.block;
    }
    // Drawn near you (at Willowhaven), the rest put away.
    const shown = this.people.filter((p) => p.out && p.act !== 'inside' && ctx.home !== false && from && Math.hypot(p.pos.x - from.x, p.pos.z - from.z) < 140);
    const chats = chatPairs(shown, t);
    for (const p of this.people) {
      if (!shown.includes(p)) {
        p.fig.group.visible = false;
        continue;
      }
      p.fig.update(dt, t, p, walkHeight(p.pos.x, p.pos.z), { from, chat: chats.get(p.id) });
    }
    const owner = this.people.find((p) => p.P.dog);
    const dogShown = shown.includes(owner);
    this.dog.group.visible = dogShown;
    if (owner.out) this.dog.update(dt, t, owner, this.paths, dogShown);
  }

  // Out of their door, on the way to the first place.
  start(p, t) {
    p.out = true;
    p.going = false;
    p.leg = 0;
    // (Out of the door onto the street: the nearest bit of it people walk on.)
    p.pos = { ...this.paths.snap(SPOTS[p.P.home].x, SPOTS[p.P.home].z) };
    p.yaw = SPOTS[p.P.home].yaw ?? 0;
    this.next(p);
    this.dog.place(p.pos);
  }

  // Where next: the next of their places (the day's dice choose the order), by the paths.
  next(p) {
    const P = p.P, r = seeded(p.leg * 613 + P.id.charCodeAt(0) * 17 + Math.floor(p.pos.x * 10))();
    let to = P.stops[Math.floor(r * P.stops.length)];
    const S = this.stops;
    if (Math.hypot(S[to].x - p.pos.x, S[to].z - p.pos.z) < 2) to = P.stops[(P.stops.indexOf(to) + 1) % P.stops.length];
    p.leg++;
    this.route(p, S[to], { spot: P.carry === 'slab' && to === 'slab' ? 'slab' : to, act: P.crab && to === 'slipway' ? 'fish' : 'stand', stop: to });
  }

  // Home: back to their door, and in.
  goHome(p) {
    p.going = true;
    this.route(p, SPOTS[p.P.home], { spot: p.P.home, act: 'inside', home: true });
  }

  route(p, to, block) {
    p.path = this.paths.route({ x: p.pos.x, z: p.pos.z }, { x: to.x, z: to.z });
    p.s = 0;
    p.len = 0;
    for (let i = 1; i < p.path.length; i++) p.len += Math.hypot(p.path[i].x - p.path[i - 1].x, p.path[i].z - p.path[i - 1].z);
    p.target = to;
    p.block = block;
    p.act = 'walk';
    p.pause = 0;
  }

  walk(p, dt, t, from) {
    const P = p.P;
    if (p.act === 'walk' && p.path) {
      // Stepping round you, if you're in the way: off to the side away from you as they come up,
      // slowing a little, and back onto their way once past; if there's no room either side, they
      // wait for you.
      const here = along(p.path, p.s), fx = Math.sin(here.yaw), fz = Math.cos(here.yaw), rx = fz, rz = -fx;
      let want = 0, pace = P.pace;
      // (Kept waiting a couple of seconds by someone who won't move, they squeeze past.)
      p.passT = Math.max(0, (p.passT ?? 0) - dt);
      if (from && !(p.passT > 0)) {
        const ox = from.x - here.x, oz = from.z - here.z, ahead = ox * fx + oz * fz, lat = ox * rx + oz * rz;
        if (ahead > -0.7 && ahead < 2.4 && Math.abs(lat) < 1.05) {
          want = (lat >= 0 ? -1 : 1) * (1.1 - Math.abs(lat));
          pace *= 0.65;
        }
      }
      p.side = damp(p.side ?? 0, want, 5, dt);
      const ok = (s) => this.paths.ok(here.x + rx * s, here.z + rz * s);
      if (!ok(p.side) && ok(-p.side)) p.side = -p.side;
      let x = here.x + rx * p.side, z = here.z + rz * p.side;
      if (!ok(p.side)) {
        x = here.x;
        z = here.z;
      }
      // (Too close still: they hold back a moment.)
      if (from && !(p.passT > 0) && Math.hypot(from.x - x, from.z - z) < 0.75) {
        pace = 0;
        p.waitT = (p.waitT ?? 0) + dt;
        if (p.waitT > 2.5) {
          p.passT = 3;
          p.waitT = 0;
        }
      } else p.waitT = 0;
      p.s = Math.min(p.len, p.s + pace * dt);
      p.pos = { x, z };
      p.yaw = here.yaw;
      const at = here;
      if (p.s >= p.len - 1e-3) {
        if (p.block.home) {
          p.out = false;
          p.going = false;
          p.act = 'inside';
          return;
        }
        // There: stop a while, looking at whatever it is.
        p.act = p.block.act;
        p.yaw = p.target.yaw ?? p.yaw;
        const r = seeded(p.leg * 389 + P.id.length * 53)();
        p.pause = P.pause[0] + r * (P.pause[1] - P.pause[0]);
      }
    } else {
      p.pause -= dt;
      if (p.pause <= 0) this.next(p);
    }
  }
}

// A dog: a terrier-ish thing, brown and white, trotting at heel or a little ahead, off to sniff at
// something when they stop, sitting now and then, the tail going.
export class Dog {
  constructor() {
    const brown = new THREE.MeshLambertMaterial({ color: '#8a5a34' }), white = new THREE.MeshLambertMaterial({ color: '#efe9dc' }), dark = new THREE.MeshLambertMaterial({ color: '#2b2522' });
    const g = (this.group = new THREE.Group());
    this.body = new THREE.Group();
    this.body.position.y = 0.34;
    g.add(this.body);
    const trunk = new THREE.Mesh(new THREE.CapsuleGeometry(0.11, 0.32, 4, 8), brown);
    trunk.rotation.x = Math.PI / 2;
    trunk.castShadow = true;
    const chest = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), white);
    chest.position.set(0, -0.03, 0.17);
    this.body.add(trunk, chest);
    this.head = new THREE.Group();
    this.head.position.set(0, 0.1, 0.26);
    this.body.add(this.head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.085, 10, 8), brown);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.06, 0.1), white);
    snout.position.set(0, -0.02, 0.09);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), dark);
    nose.position.set(0, -0.005, 0.145);
    this.head.add(skull, snout, nose);
    for (const s of [1, -1]) {
      const ear = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.07, 0.05), dark);
      ear.position.set(s * 0.055, 0.07, -0.01);
      ear.rotation.z = s * 0.4;
      this.head.add(ear);
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 4), dark);
      eye.position.set(s * 0.035, 0.025, 0.07);
      this.head.add(eye);
    }
    this.tail = new THREE.Group();
    this.tail.position.set(0, 0.06, -0.24);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.02, 0.18, 5).translate(0, 0.09, 0), brown);
    this.tail.add(tail);
    this.tail.rotation.x = -0.7;
    this.body.add(this.tail);
    // Legs: front pair and back pair, each swinging from the shoulder or hip.
    const legGeo = new THREE.CylinderGeometry(0.022, 0.018, 0.26, 5).translate(0, -0.13, 0);
    this.legs = [[0.07, 0.15], [-0.07, 0.15], [0.07, -0.16], [-0.07, -0.16]].map(([x, z], i) => {
      const hip = new THREE.Group();
      hip.position.set(x, -0.04, z);
      hip.add(new THREE.Mesh(legGeo, i < 2 ? white : brown));
      this.body.add(hip);
      return hip;
    });
    this.pos = { x: 0, z: 0 };
    this.yaw = 0;
    this.speed = 0;
    this.phase = 0;
    this.goal = null;
    this.goalT = 0;
    this.sit = 0;
    this.sniff = 0;
  }

  place(at) {
    this.pos = { x: at.x + 0.6, z: at.z };
    this.goal = null;
  }

  update(dt, t, owner, paths, shown) {
    const o = owner.pos, c = Math.cos(owner.yaw), s = Math.sin(owner.yaw);
    let gx, gz, top = 2.6;
    if (owner.act === 'walk') {
      // At heel, a little ahead and to one side.
      gx = o.x + s * 0.7 - c * 0.55;
      gz = o.z + c * 0.7 + s * 0.55;
      this.goal = null;
      this.sit = damp(this.sit, 0, 6, dt);
    } else {
      // Stopped: off to sniff at something within a few metres, back, and sit a while.
      this.goalT -= dt;
      if (!this.goal || this.goalT <= 0) {
        const r = Math.random();
        if (r < 0.3) this.goal = { x: o.x + s * 0.5 + c * 0.4, z: o.z + c * 0.5 - s * 0.4, sit: true };
        else {
          const a = Math.random() * Math.PI * 2, d = 1.2 + Math.random() * 2.2;
          this.goal = { x: o.x + Math.sin(a) * d, z: o.z + Math.cos(a) * d, sit: false };
          if (!paths.ok(this.goal.x, this.goal.z)) this.goal = { x: o.x + 0.6, z: o.z, sit: true };
        }
        this.goalT = 3 + Math.random() * 5;
      }
      gx = this.goal.x;
      gz = this.goal.z;
      top = 1.6;
    }
    const dx = gx - this.pos.x, dz = gz - this.pos.z, d = Math.hypot(dx, dz);
    const want = d > 0.15 ? Math.min(top, d * 2.2) : 0;
    this.speed = damp(this.speed, want, 5, dt);
    if (d > 1e-3) {
      this.pos.x += (dx / d) * this.speed * dt;
      this.pos.z += (dz / d) * this.speed * dt;
    }
    // (Too far behind, or somewhere it shouldn't be: it catches up.)
    if (Math.hypot(this.pos.x - o.x, this.pos.z - o.z) > 8 || !paths.ok(this.pos.x, this.pos.z)) this.pos = paths.snap(o.x + 0.5, o.z);
    if (this.speed > 0.1 && d > 1e-3) this.yaw = dampAngle(this.yaw, Math.atan2(dx, dz), 8, dt);
    else if (owner.act !== 'walk') this.yaw = dampAngle(this.yaw, Math.atan2(o.x - this.pos.x, o.z - this.pos.z), 1.5, dt);
    const settled = owner.act !== 'walk' && d < 0.3;
    this.sit = damp(this.sit, settled && this.goal?.sit ? 1 : 0, 4, dt);
    this.sniff = damp(this.sniff, settled && this.goal && !this.goal.sit ? 1 : 0, 4, dt);
    if (!shown) return;
    // The trot: diagonal pairs of legs together.
    const amt = smoothstep(0.05, 1, this.speed);
    this.phase += dt * (4 + this.speed * 6);
    const sw = Math.sin(this.phase) * 0.55 * amt;
    const [fl, fr, bl, br] = this.legs;
    fl.rotation.x = sw;
    br.rotation.x = sw;
    fr.rotation.x = -sw;
    bl.rotation.x = -sw;
    // Sat: the back end down, the back legs folded, the front ones straight.
    const st = this.sit;
    bl.rotation.x = bl.rotation.x * (1 - st) - 1.3 * st;
    br.rotation.x = br.rotation.x * (1 - st) - 1.3 * st;
    this.body.rotation.x = -0.45 * st + 0.25 * this.sniff;
    this.body.position.y = 0.34 - 0.08 * st - 0.04 * this.sniff + Math.abs(Math.sin(this.phase)) * 0.025 * amt;
    this.head.rotation.x = 0.55 * this.sniff - 0.2 * st + Math.sin(t * 9) * 0.06 * this.sniff;
    this.head.rotation.y = Math.sin(t * 0.7) * 0.4 * (1 - amt) * (1 - this.sniff);
    this.tail.rotation.z = Math.sin(t * (amt > 0.3 ? 14 : 9)) * 0.5;
    this.group.position.set(this.pos.x, walkHeight(this.pos.x, this.pos.z), this.pos.z);
    this.group.rotation.y = this.yaw;
  }
}
