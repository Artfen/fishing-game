// Playing together, one sea for everyone: the whales, dolphins, seals, turtles, the birds working a
// shoal, the shoals themselves, the bait balls and the hunters driving them up are the same on
// every screen in a session.
//
// How (see together.js for the connection, sealife.js and ecosystem.js for the sea itself):
//  · Every screen builds the same sea from the same seeds, so each animal and each shoal has the
//    same identity everywhere: pod 3 is pod 3, shoal 212 is shoal 212.
//  · The host (whoever started the session) is the one whose sea decides. It keeps the sea going
//    round everyone in the session, not just round the host (a friend in another bay, or at Las
//    Brasas, has their own water alive), and answers to all of them: a pod rides whichever boat
//    draws it, birds come down on a shoal near anyone.
//  · Twice a second the host sends what it all is and is doing: every pod (and each animal's breath),
//    whale, seal in the water, turtle and the birds' feeding, which are few; and the shoals within
//    INTEREST of someone, with the ones they're hunting (those beyond NEAR, and those lying still,
//    only every fourth time). Never every fish in the sea. A snapshot is 1-5 KB with friends close
//    together, up to about 9 KB with eight players far apart; past 6 KB it goes once a second.
//  · Everyone else's sea follows that instead of deciding for itself, easing each animal and shoal
//    onto where the host has it (carried on at its speed for the time the word took to arrive). A
//    pod riding a bow, or a seal following a boat, is placed from that boat on each screen, so it
//    stays on it whatever the delay.
//  · Each snapshot carries the host's epoch (a new one each time the host's game starts a session)
//    and a sequence number: an old or repeated one is dropped. A snapshot is the whole account of
//    what it covers, so joining late, a dropped connection got back, or a host's reload never adds a
//    second whale: there is only ever one of each, and the next snapshot says where it is.
//  · What comes in is checked: the shape, every number, every count against this game's own sea (a
//    newer or older version's snapshot doesn't fit, and is left alone), and its size.
//  · Alone (no session), none of this runs: the sea is exactly as it was.
//
//
// And the fish you catch (see ecosystem.js):
//  · Each guest sends their rig to the host while it's in the water, whenever it's changed (at most
//    four times a second) and once a second anyway: where it is, what's on it, how it's moving. The host's water holds everyone's rigs, and the host's fish
//    decide whose to go for, one fish to a rig and one rig to a fish.
//  · The host tells the guest whose rig it is what its fish are doing (it's noticed it, it takes it,
//    it's given up), and the guest's own water shows that fish coming to their rig and taking it,
//    without waiting on the wire for every flick of its tail.
//  · Striking, the guest claims the fish; the host checks it really was taking that guest's rig and
//    makes it theirs (or says it had let go). From then on it's that player's fish: nobody else's
//    rig can have it, everyone sees it fighting at the end of its owner's line, and when it's landed,
//    kept, let go or lost, the guest says so and the host's water (and so everyone's) follows.
//  · The snapshots carry the fish everyone needs to agree on near anyone: those going for a rig,
//    those hooked, every fish caught or kept from the water, and every newcomer that's turned up
//    in its place (so everyone's fish are the same fish, the same size).
//
// If the host's game ever proves too small a place to keep everyone's sea in (many players far
// apart), the same snapshots could come from a small simulation server instead: the follower side
// wouldn't change. See ROADMAP.md.

import { AGENT_STATES } from './world/ecosystem.js';

export const SHARE_V = 1;
const AGENT_STATE_COUNT = AGENT_STATES.length;
export const SEND_EVERY = 0.5;  // seconds between snapshots (a second, when they're big: BIG)
const BIG = 6000;               // bytes: a snapshot this size (many players far apart) halves the rate
export const INTEREST = 260;    // m: the shoals sent are those this near someone (just past the
                                // 240 m the fish are kept going round anyone: see ecosystem.js)
export const NEAR = 130;        // m: those this near someone go in every snapshot, the rest in
const FULL_EVERY = 4;           // every fourth (and straight away when someone joins)
const MAX_BYTES = 60000;        // a snapshot bigger than this is junk
const MAX_SCHOOLS = 400;
// What a guest may ask the host to bring up (a crossing's encounters: see crossing.js).
const SUMMONABLE = new Set(['commondolphin', 'finwhale', 'spermwhale', 'turtle']);
// A guest's rig as it goes to the host (see rigOf): when it's changed (at most four times a second:
// the host carries it on at its speed in between), and once a second anyway while it's in the water.
// (Each word to the session counts once for everyone in it, so a float sitting still costs little.)
const RIG_EVERY = 0.25, RIG_IDLE = 1;
const KINDS = new Set(['float', 'lure', 'ledger', 'bottom', 'fly', 'jig']);
const MOTIONS = new Set(['still', 'slow', 'fast', 'twitch']);
const FLIES = new Set(['dry', 'nymph', 'streamer', 'wet']);
// What the host's fish do about a guest's rig, as it goes to them.
const FISH_EVENTS = new Set(['engage', 'bite', 'leave', 'hooked', 'nohook']);

const num = (v, lim = 1e5) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= lim;
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const ownerOk = (v) => v === '' || (typeof v === 'string' && v.length <= 64 && /^[A-Za-z0-9_-]+$/.test(v));
const rowOk = (r, n, check) => Array.isArray(r) && r.length === n && check(r);
const nums = (r, from, to) => {
  for (let i = from; i < to; i++) if (!num(r[i])) return false;
  return true;
};

// This game's own sea, to check a snapshot against: how many of each there are.
export function countsOf(sealife, eco) {
  return {
    pods: sealife.pods.map((p) => p.members.length),
    whales: sealife.whales.length,
    seals: sealife.visitors.length,
    turtles: sealife.turtles.length,
    schools: eco.schools.length,
    agents: eco.agents.length,
  };
}

// A rig as it goes from a guest to the host: the fields the fish care about, rounded.
export function rigOf(b) {
  const q = (v) => Math.round(v * 100) / 100;
  return {
    x: q(b.x), y: q(b.y), z: q(b.z), vx: q(b.vx || 0), vz: q(b.vz || 0), speed: q(b.speed || 0),
    kind: b.kind, item: b.item, size: b.size ?? 1, fly: b.fly || null, thick: q(b.thick ?? 0.35),
    motion: b.motion, twitch: q(b.twitch || 0), pause: !!b.pause, drag: !!b.drag, fouled: !!b.fouled,
    natural: !!b.natural, nearBottom: !!b.nearBottom, anglerX: q(b.anglerX || 0), anglerZ: q(b.anglerZ || 0),
    towed: !!b.towed, darted: q(b.darted || 0), boost: q(b.boost || 1), surface: !!b.surface, feeder: !!b.feeder,
    sinking: !!b.sinking, fresh: q(Math.max(0, b.fresh || 0)), hook: b.hook ?? null,
  };
}

// A rig as it arrives at the host, checked: a clean copy, or null. items: the tackle there is.
export function cleanRig(r, items = null) {
  if (!r || typeof r !== 'object') return null;
  for (const k of ['x', 'y', 'z', 'vx', 'vz', 'speed', 'thick', 'twitch', 'anglerX', 'anglerZ', 'darted', 'boost', 'fresh']) if (!num(r[k], 1e4)) return null;
  if (!KINDS.has(r.kind) || !MOTIONS.has(r.motion) || typeof r.item !== 'string' || !/^[A-Za-z0-9]{1,24}$/.test(r.item) || (items && !items.includes(r.item))) return null;
  if (r.fly !== null && !FLIES.has(r.fly)) return null;
  if (!num(r.size, 20)) return null;
  const out = {};
  for (const k of ['x', 'y', 'z', 'vx', 'vz', 'speed', 'thick', 'twitch', 'anglerX', 'anglerZ', 'darted', 'boost', 'size', 'fresh']) out[k] = r[k];
  for (const k of ['pause', 'drag', 'fouled', 'natural', 'nearBottom', 'towed', 'surface', 'feeder', 'sinking']) out[k] = !!r[k];
  // (Nothing a guest sends can make a rig more tempting than one of the host's own could be.)
  Object.assign(out, { kind: r.kind, item: r.item, motion: r.motion, fly: r.fly, boost: Math.min(1.5, Math.max(1, r.boost)), fresh: Math.min(4, Math.max(0, r.fresh)) });
  // (The hook's size, for the small fish: a whole number, or none said.)
  out.hook = Number.isInteger(r.hook) && r.hook >= 1 && r.hook <= 30 ? r.hook : null;
  return out;
}

// A snapshot as it arrives, checked: the same object if it's sound, or null.
export function cleanShared(d, counts) {
  if (!d || typeof d !== 'object' || d.v !== SHARE_V) return null;
  if (typeof d.ep !== 'string' || !/^[A-Za-z0-9-]{1,40}$/.test(d.ep) || !int(d.sq, 0, 2 ** 31) || !num(d.t, 1e12)) return null;
  const S = d.s, K = d.k;
  if (!S || typeof S !== 'object' || !Array.isArray(K) || K.length > MAX_SCHOOLS) return null;
  const C = counts;
  if (!Array.isArray(S.p) || S.p.length !== C.pods.length) return null;
  for (let i = 0; i < S.p.length; i++) {
    const r = S.p[i];
    if (!rowOk(r, 10, (q) => nums(q, 0, 5) && int(q[5], 0, 1) && ownerOk(q[6]) && nums(q, 7, 9) && Array.isArray(q[9]) && q[9].length === C.pods[i])) return null;
    for (const m of r[9]) if (!rowOk(m, 2, (q) => num(q[0], 1000) && int(q[1], 0, 1))) return null;
  }
  if (!Array.isArray(S.w) || S.w.length !== C.whales) return null;
  for (const r of S.w) if (!rowOk(r, 9, (q) => nums(q, 0, 3) && int(q[3], 0, 2) && num(q[4], 1e4) && int(q[5], -1, 99) && int(q[6], 0, 2 ** 31) && nums(q, 7, 9))) return null;
  if (!Array.isArray(S.s) || S.s.length !== C.seals) return null;
  for (const r of S.s) if (!rowOk(r, 8, (q) => nums(q, 0, 2) && int(q[2], 0, 2) && int(q[3], 0, 1) && nums(q, 4, 7) && ownerOk(q[7]))) return null;
  if (!Array.isArray(S.u) || S.u.length !== C.turtles) return null;
  for (const r of S.u) if (!rowOk(r, 7, (q) => nums(q, 0, 7))) return null;
  for (const G of [S.g, S.h]) if (G !== null && !rowOk(G, 3, (q) => int(q[0], 0, C.schools - 1) && num(q[1], 1e4) && num(q[2], 1e4))) return null;
  for (const r of K) {
    if (!Array.isArray(r) || (r.length !== 11 && r.length !== 17) || !int(r[0], 0, C.schools - 1) || !nums(r, 1, 11)) return null;
    if (r.length === 17 && !(nums(r, 11, 14) && int(r[14], -1, C.schools - 1) && nums(r, 15, 17))) return null;
  }
  // The fish everyone agrees on (see ecosystem.js captureAgents).
  const A = d.a;
  if (A !== undefined) {
    if (!A || typeof A !== 'object' || !Array.isArray(A.rows) || !Array.isArray(A.gone) || !Array.isArray(A.sizes)) return null;
    if (A.rows.length > 400 || A.gone.length > 5000 || A.sizes.length > 5000) return null;
    for (const r of A.rows) if (!rowOk(r, 7, (q) => int(q[0], 0, C.agents - 1) && nums(q, 1, 5) && int(q[5], 0, AGENT_STATE_COUNT - 1) && ownerOk(q[6]))) return null;
    for (const id of A.gone) if (!int(id, 0, C.agents - 1)) return null;
    for (const r of A.sizes) if (!rowOk(r, 3, (q) => int(q[0], 0, C.agents - 1) && num(q[1], 2000) && q[1] > 0 && int(q[2], 0, 1e6))) return null;
  }
  return d;
}

// A word about a fish from the host to the guest whose rig it is, checked.
export function cleanFishEvent(d, counts) {
  if (!d || typeof d !== 'object' || !FISH_EVENTS.has(d.e) || !ownerOk(d.to) || !int(d.f, 0, counts.agents - 1)) return null;
  if (d.k != null && (typeof d.k !== 'string' || !/^[a-z]{1,12}$/.test(d.k))) return null;
  if (d.s != null && (typeof d.s !== 'string' || !/^[a-z]{1,12}$/.test(d.s))) return null;
  if (d.r != null && (typeof d.r !== 'string' || !/^[a-z]{1,12}$/.test(d.r))) return null;
  if (d.w != null && typeof d.w !== 'string') return null;
  return { e: d.e, to: d.to, f: d.f, k: d.k ?? null, s: d.s ?? null, r: d.r ?? null, w: d.w ? d.w.replace(/[<>\u0000-\u001f]/g, ' ').slice(0, 240) : null };
}

export class SharedWorld {
  // together: the session (together.js); sealife and eco: this screen's sea.
  constructor({ together, sealife, eco, every = SEND_EVERY }) {
    this.together = together;
    this.sealife = sealife;
    this.eco = eco;
    this.every = every;
    this.counts = countsOf(sealife, eco);
    this.acc = 0;
    this.sq = 0;
    this.lastBytes = 0;
    this.ep = null;
    this.lastSq = -1;
    this.role = 'off';
    this.asked = new Map(); // peer id -> when they last asked for something brought up
    this.stats = SharedWorld.freshStats();
    this.items = null;      // the tackle there is (for checking a guest's rig)
    this.rigT = 0;
    this.rigIdle = 0;
    this.rigLast = null;
    this.rigWas = false;
    this.onNoHook = null;   // (id): the host says the fish you struck had let go
    together.onShared = (data, peer) => this.receive(data, peer);
    together.onAsk = (data, peer) => this.answer(data, peer);
    together.onFish = (data, peer) => this.fishEvent(data, peer);
    // (Hosting: what the host's fish do about a guest's rig goes to that guest.)
    eco.onRemote = (evt, a, b, ...args) => this.tellGuest(evt, a, b, ...args);
  }

  static freshStats() {
    return { sent: 0, got: 0, rejected: 0, stale: 0, delay: 0, heardAt: null, schools: 0, animals: 0, bytes: 0, fish: 0, rigs: 0 };
  }

  // Who decides here: 'host' (this screen's sea is everyone's), 'follower' (it follows the host's),
  // or 'off' (alone, or not yet in).
  roleNow() {
    const T = this.together;
    return T.hosting ? 'host' : T.status === 'joined' ? 'follower' : 'off';
  }

  // Every frame. viewers: everyone the sea answers to (see sealife.js), this screen's first.
  update(dt, viewers) {
    const role = this.roleNow();
    if (role !== this.role) {
      this.role = role;
      this.acc = this.every; // (the first word straight away)
      this.lastSq = -1;
      this.ep = null;
      if (role !== 'follower') this.forget();
      // (Hosting: newcomers to the water are sent on; following: your fish's doings go to the host.)
      this.eco.restocked = role === 'host' ? new Map() : null;
      this.eco.onLocal = role === 'follower' ? (evt, a, x, z) => this.tellHost(evt, a, x, z) : null;
      if (role !== 'host') for (const id of [...this.eco.remoteBaits.keys()]) this.eco.setRemoteBait(id, null);
    }
    const follow = role === 'follower';
    this.sealife.follower = follow;
    this.eco.follower = follow;
    if (follow) this.sendRig(dt);
    if (role !== 'host') return;
    this.eco.dropStaleBaits();
    this.acc += dt;
    if (this.acc >= this.every * (this.lastBytes > BIG ? 2 : 1)) {
      this.acc = 0;
      this.send(viewers);
    }
  }

  // Host: the snapshot.
  snapshot(viewers) {
    const foci = viewers.map((v) => v.from);
    // (The farther shoals every few times, and straight away for someone who's just joined.)
    const n = this.together.others?.length ?? 0, full = this.sq % FULL_EVERY === 0 || n > (this.seen ?? 0);
    this.seen = n;
    const A = this.eco.captureAgents(foci, INTEREST, full);
    return { v: SHARE_V, ep: this.together.epoch || 'solo', sq: ++this.sq, t: this.together.now(), s: this.sealife.capture(), k: this.eco.captureSchools(foci, INTEREST, NEAR, full), a: A };
  }

  send(viewers) {
    const snap = this.snapshot(viewers);
    this.lastBytes = JSON.stringify(snap).length;
    if (this.together.broadcast('eco', snap)) {
      this.stats.sent++;
      this.stats.schools = snap.k.length;
      this.stats.fish = snap.a.rows.length;
      this.stats.rigs = this.eco.remoteBaits.size;
      this.stats.animals = this.counts.pods.length + this.counts.whales + this.counts.seals + this.counts.turtles;
    }
  }

  // A guest: the host's word arrives (from together.js, only ever the host's).
  receive(data, peer) {
    if (this.roleNow() !== 'follower') return;
    const bytes = JSON.stringify(data).length;
    const d = bytes <= MAX_BYTES ? cleanShared(data, this.counts) : null;
    if (!d) {
      this.stats.rejected++;
      return;
    }
    if (d.ep !== this.ep) {
      // (A new account of the sea from the host: a reload, or a new session.)
      this.ep = d.ep;
      this.lastSq = -1;
    }
    if (d.sq <= this.lastSq) {
      this.stats.stale++;
      return;
    }
    this.lastSq = d.sq;
    // How old it is: when the host sent it, by the host's clock, against the quickest any word from
    // them has taken lately (see together.js), plus a little for that quickest delivery itself.
    const T = this.together, offset = peer?.offset ?? 0;
    const lag = Math.min(3, Math.max(0, T.now() - d.t - offset) + 0.05);
    this.sealife.apply(d.s, lag, this.eco);
    this.eco.applySchools(d.k, lag);
    if (d.a) this.eco.applyAgents(d.a, T.id);
    Object.assign(this.stats, { got: this.stats.got + 1, delay: lag, heardAt: T.now(), schools: d.k.length, bytes, fish: d.a?.rows.length ?? 0 });
    this.stats.animals = this.counts.pods.length + this.counts.whales + this.counts.seals + this.counts.turtles;
  }

  // Back to deciding for itself (left the session, or now hosting): forget the host's word.
  forget() {
    for (const p of this.sealife.pods) {
      p.net = null;
      p.synced = false;
      for (const m of p.members) m.net = null;
    }
    for (const w of this.sealife.whales) {
      w.net = null;
      w.synced = false;
    }
    for (const s of this.sealife.visitors) s.synced = false;
    for (const T of this.sealife.turtles) {
      T.net = null;
      T.synced = false;
    }
    for (const s of this.eco.schools) {
      s.net = null;
      s.synced = false;
    }
    for (const a of this.eco.agents) {
      a.net = null;
      if (a.remoteHook && a.state === 'hooked') {
        a.remoteHook = null;
        a.state = a.school ? 'school' : 'cruise';
      }
      // (Fish taken while following come back over the next few minutes, as they would have:
      // leaving a session and coming back isn't a way to refill fished-out water at once.)
      if (a.state === 'gone' && a.backAt === Infinity) a.backAt = this.eco.time + 240 + Math.random() * 180;
    }
  }

  /* ---------- the fish you catch ---------- */

  // A guest: your rig to the host while it's in the water (and a word when it's out).
  sendRig(dt) {
    const b = this.eco.bait;
    this.rigT -= dt;
    this.rigIdle -= dt;
    if (b.active) {
      if (this.rigT > 0) return;
      const r = rigOf(b), L = this.rigLast;
      // (Changed: somewhere the host wouldn't have it by now, or worked differently.)
      const age = RIG_IDLE - this.rigIdle;
      const changed = !L || Math.hypot(r.x - (L.x + L.vx * age), r.z - (L.z + L.vz * age)) > 0.4 || Math.abs(r.y - L.y) > 0.3
        || r.kind !== L.kind || r.item !== L.item || r.motion !== L.motion || (r.twitch > 0) !== (L.twitch > 0) || r.pause !== L.pause
        || r.drag !== L.drag || r.fouled !== L.fouled || r.towed !== L.towed || r.nearBottom !== L.nearBottom;
      if (!changed && this.rigIdle > 0) return;
      if (this.together.ask('rig', { r }, 0)) {
        this.rigWas = true;
        this.rigLast = r;
        this.rigT = RIG_EVERY;
        this.rigIdle = RIG_IDLE;
      }
    } else if (this.rigWas) {
      this.rigWas = false;
      this.rigLast = null;
      this.together.ask('rig', { r: null }, 0);
    }
  }

  // Hosting: one of your fish has noticed a guest's rig, taken it, or given up on it: the guest is told.
  tellGuest(evt, a, b, kind, why) {
    const to = b.ownerId;
    if (!to) return;
    if (evt === 'onCurious' || evt === 'onFollow') this.together.broadcast('fish', { to, e: 'engage', f: a.id, k: a.style, s: a.state });
    else if (evt === 'onBite') this.together.broadcast('fish', { to, e: 'bite', f: a.id, k: kind });
    else if (evt === 'onLeave') this.together.broadcast('fish', { to, e: 'leave', f: a.id, r: kind, w: typeof why === 'string' ? why : null });
  }

  // A guest: the host's word about a fish and your rig.
  fishEvent(data, peer) {
    if (this.roleNow() !== 'follower') return;
    const d = cleanFishEvent(data, this.counts);
    if (!d || d.to !== this.together.id) return;
    const a = this.eco.agents[d.f];
    if (!a) return;
    if (d.e === 'engage') this.eco.engageFor(a, d.k, d.s);
    else if (d.e === 'bite') this.eco.takeFor(a, d.k || 'float');
    else if (d.e === 'leave') {
      if (d.w) this.lastWhy = d.w;
      this.eco.leaveFor(a, d.r || 'lost');
    } else if (d.e === 'nohook') this.onNoHook?.(a.id);
  }

  // A guest: what happened to a fish on your line, for the host.
  tellHost(evt, a, x, z) {
    const f = a.id;
    // (Snapshots already on the way don't know yet: they leave this fish be a moment.)
    a.quiet = this.eco.netT + 2.5;
    if (evt === 'released') this.together.ask('released', { f, x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 }, 0);
    else this.together.ask(evt, { f }, 0);
  }

  // Something met on the crossing to bring up near you (see crossing.js): a guest asks the host,
  // whose sea it is; the host (or alone) brings it up itself.
  summon(kind, x, z, heading = 0) {
    if (this.roleNow() === 'follower') {
      this.together.ask('summon', { k: kind, x: Math.round(x), z: Math.round(z), h: Math.round(heading * 100) / 100 }, 5);
      return null;
    }
    return this.sealife.summon(kind, x, z, heading);
  }

  // Host: what a guest asks for, if it's sensible (a crossing's encounter, near where they are, not
  // too often).
  answer(data, peer) {
    if (data.a !== 'summon') return this.answerFish(data, peer);
    if (!SUMMONABLE.has(data.k) || !num(data.x, 1e4) || !num(data.z, 1e4) || !num(data.h, 10)) return;
    const at = peer?.at;
    if (at && Math.hypot(at.x - data.x, at.z - data.z) > 800) return;
    const now = this.together.now();
    if (now - (this.asked.get(peer?.id) ?? -99) < 15) return;
    this.asked.set(peer?.id, now);
    this.sealife.summon(data.k, data.x, data.z, data.h);
  }

  // Host: a guest's rig, a strike, and what became of a fish they hooked, if it all checks out.
  answerFish(data, peer) {
    const id = peer?.id, E = this.eco;
    if (!id) return;
    if (data.a === 'rig') {
      if (data.r === null) return E.setRemoteBait(id, null);
      const r = cleanRig(data.r, this.items);
      // (A rig is near whoever's fishing it.)
      if (!r || (peer.at && Math.hypot(peer.at.x - r.x, peer.at.z - r.z) > 260)) return;
      return E.setRemoteBait(id, r);
    }
    if (!int(data.f, 0, this.counts.agents - 1)) return;
    const a = E.agents[data.f], b = E.remoteBaits.get(id);
    if (data.a === 'hook') {
      // Theirs only if it really was taking their rig just now.
      if (b && a.bait === b && a.state === 'bite') {
        a.hookedBy = id;
        E.hook(a);
        this.together.broadcast('fish', { to: id, e: 'hooked', f: a.id });
      } else this.together.broadcast('fish', { to: id, e: 'nohook', f: a.id });
      return;
    }
    // What became of it: only the one who has it can say.
    const theirs = a.hookedBy === id && (a.state === 'hooked' || a.state === 'caught');
    if (!theirs) return;
    if (data.a === 'caught') E.catchAgent(a);
    else if (data.a === 'kept') {
      if (a.state === 'hooked') E.catchAgent(a);
      E.keep(a);
    } else if (data.a === 'released' && num(data.x, 1e5) && num(data.z, 1e5)) E.release(a, data.x, data.z);
    else if (data.a === 'lost' && a.state === 'hooked') E.lostHooked(a);
    if (b && !b.active && b.owner === null) E.remoteBaits.delete(id);
  }
}
