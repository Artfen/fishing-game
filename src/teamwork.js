// Helping each other at sea, playing together (see together.js for the session and sharedworld.js
// for the sea everyone shares):
//
//  · Netting a friend's fish. When their fish is beaten and lying alongside waiting for the net
//    (their pose says so: nt), and you're within reach of it, you can net it for them. The word goes
//    to them alone; their game, whose fish it is, checks it's still waiting for the net and that
//    you really are by it, and nets it. The catch is theirs (their log, their creel, their record);
//    the thanks come back to you.
//  · Marking a shoal. Call your friends to a shoal near you: shoals are the same for everyone (the
//    host's sea), so your mark on their screens follows that very shoal as it moves, for ten
//    minutes, or until it's been fished out.
//
// Nothing here is saved: a mark is for now, and a catch goes into the angler's own game as ever.

export const NET_REACH = 3.2;    // m from you to a friend's fish lying alongside
export const NET_SLACK = 10;     // m: how far the angler's game lets a helper be (they're shown a moment behind, and a boat's long)
export const MARK_REACH = 70;    // m: shoals you can mark are this near you
export const MARK_LIFE = 600;    // s a mark lasts

export class Teamwork {
  // together: the session; eco: this screen's fish (the shoals are the host's); lineEnd(id): where a
  // friend's line meets the water as it's drawn here (see visitors.js).
  constructor({ together, eco, lineEnd }) {
    this.together = together;
    this.eco = eco;
    this.lineEnd = lineEnd;
    this.marks = new Map(); // who ('me' or a friend's id) -> { sid, name, at }
  }

  /* ---------- netting a friend's fish ---------- */

  // A friend's beaten fish within reach of `me` ({ x, z }; extra: half your boat's length, afloat):
  // { p, f, e } or null.
  netTarget(me, extra = 0) {
    if (!this.together.active) return null;
    let best = null, bd = NET_REACH + extra;
    for (const p of this.together.peers.values()) {
      const P = p.view || p.pose;
      // (nt 1: waiting for the net. 2: too big for it, landed another way: see landing.js. 3, E3d:
      // their big game at the leader, waiting for someone to take it.)
      if (!p.name || !P?.o || (P.nt !== 1 && P.nt !== 3) || P.hk == null) continue;
      const e = this.lineEnd(p.id) || (P.ex != null ? { x: P.ex, z: P.ez } : null);
      if (!e) continue;
      const d = Math.hypot(e.x - me.x, e.z - me.z);
      if (d <= bd) {
        bd = d;
        best = { p, f: P.hk, e, kind: P.nt === 3 ? 'leader' : 'net' };
      }
    }
    return best;
  }

  // Net it for them (or take the leader): the word goes to them (their game decides). Returns
  // whether it went.
  net(target) {
    return this.together.help(target.p.id, target.kind === 'leader' ? 'leader' : 'net', target.f);
  }

  // The angler's side: may friend p net the fish on your line? fight: yours (see fishing.js); at:
  // where your fish is.
  mayNet(p, f, fight, at) {
    // (Only into the net: a fish too big for it is landed another way, see landing.js.)
    if (!fight?.atNet || (fight.landBy && fight.landBy !== 'net') || fight.agent?.id !== f || !p?.at) return false;
    return Math.hypot(p.at.x - at.x, p.at.z - at.z) <= NET_SLACK;
  }

  // (E3d) The angler's side: may friend p take the leader of the big fish on your line? Only while
  // it's waiting at the leader, and they're by it.
  mayLeader(p, f, fight, at) {
    if (!fight?.atNet || fight.landBy !== 'leader' || fight.leaderBy || fight.agent?.id !== f || !p?.at) return false;
    return Math.hypot(p.at.x - at.x, p.at.z - at.z) <= NET_SLACK;
  }

  // The angler's side, once it's in the net (or alongside on the leader, how: 'leader'): thanks to
  // whoever netted it, with what it was.
  thank(p, f, name, kg, how = 'net') {
    return this.together.help(p.id, 'thanks', f, { sp: name, kg, ...(how === 'leader' ? { h: 'leader' } : {}) });
  }

  /* ---------- marking a shoal ---------- */

  // The shoal nearest `me` worth marking (within MARK_REACH, with fish in it), or null.
  shoalNear(me) {
    let best = null, bd = MARK_REACH;
    for (const s of this.eco.schools) {
      if (!this.alive(s)) continue;
      const d = Math.hypot(s.x - me.x, s.z - me.z);
      if (d < bd) {
        bd = d;
        best = s;
      }
    }
    return best;
  }

  // A shoal with fish still in it (not every one caught or kept).
  alive(s) {
    return !!s && s.members.some((a) => a.state !== 'gone' && a.state !== 'caught');
  }

  // Mark it for your friends (and for you). Returns whether it went.
  mark(s) {
    if (!this.together.markShoal(s.id, s.x, s.z)) return false;
    this.marks.set('me', { sid: s.id, name: 'Your', at: this.together.clock });
    return true;
  }

  // A friend's mark arrives (together.js has checked its shape): kept if it's a shoal there is.
  heard(p, d) {
    const s = this.eco.schools[d.s];
    if (!s || !p?.name) return null;
    this.marks.set(p.id, { sid: d.s, name: `${p.name}’s`, at: this.together.clock });
    return s;
  }

  // The marks still standing, each where its shoal is now: [{ key, name, x, z, sp }].
  live() {
    const now = this.together.clock, out = [];
    for (const [key, m] of this.marks) {
      const s = this.eco.schools[m.sid];
      const friendGone = key !== 'me' && !this.together.peers.has(key);
      if (now - m.at > MARK_LIFE || !this.alive(s) || friendGone || !this.together.active) {
        this.marks.delete(key);
        continue;
      }
      out.push({ key, name: m.name, x: s.x, z: s.z, sp: s.sp.name });
    }
    return out;
  }
}
