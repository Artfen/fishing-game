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
// If the host's game ever proves too small a place to keep everyone's sea in (many players far
// apart), the same snapshots could come from a small simulation server instead: the follower side
// wouldn't change. See ROADMAP.md.

export const SHARE_V = 1;
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
  };
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
  return d;
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
    together.onShared = (data, peer) => this.receive(data, peer);
    together.onAsk = (data, peer) => this.answer(data, peer);
  }

  static freshStats() {
    return { sent: 0, got: 0, rejected: 0, stale: 0, delay: 0, heardAt: null, schools: 0, animals: 0, bytes: 0 };
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
    }
    const follow = role === 'follower';
    this.sealife.follower = follow;
    this.eco.follower = follow;
    if (role !== 'host') return;
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
    return { v: SHARE_V, ep: this.together.epoch || 'solo', sq: ++this.sq, t: this.together.now(), s: this.sealife.capture(), k: this.eco.captureSchools(foci, INTEREST, NEAR, full) };
  }

  send(viewers) {
    const snap = this.snapshot(viewers);
    this.lastBytes = JSON.stringify(snap).length;
    if (this.together.broadcast('eco', snap)) {
      this.stats.sent++;
      this.stats.schools = snap.k.length;
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
    Object.assign(this.stats, { got: this.stats.got + 1, delay: lag, heardAt: T.now(), schools: d.k.length, bytes });
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
    if (data.a !== 'summon' || !SUMMONABLE.has(data.k) || !num(data.x, 1e4) || !num(data.z, 1e4) || !num(data.h, 10)) return;
    const at = peer?.at;
    if (at && Math.hypot(at.x - data.x, at.z - data.z) > 800) return;
    const now = this.together.now();
    if (now - (this.asked.get(peer?.id) ?? -99) < 15) return;
    this.asked.set(peer?.id, now);
    this.sealife.summon(data.k, data.x, data.z, data.h);
  }
}
