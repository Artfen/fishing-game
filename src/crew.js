// Crewing for a friend, playing together: riding in their boat, and taking the helm while they fish
// (or to follow a big fish on a run). See together.js for the session, teamwork.js for netting.
//
// Riding: in your game you're on foot, carried at a spot in your friend's boat as it's drawn here
// (visitors.js), walking about inside her, fishing from her, watching your sonar, netting their
// fish. Your pose names whose boat and where in it (cr, cx, cz), so every screen draws you in that
// boat rather than a moment behind it.
//
// The helm: you ask; if your friend is away from the wheel (fishing, or walking the deck) their
// game hands it to you. From then your wheel and lever go to their game a few times a second, and
// it steers their boat with them as if they were at the wheel. Their boat stays theirs, physics and
// all, in their game; the moment they touch the controls at the wheel it's back with them. If your
// word stops coming the wheel goes slack and the lever stays where it was.
//
// Nothing here is saved: crewing ends with the session, and a save made while crewing puts you
// back where you stepped aboard from (main.js).

export const CREW_REACH = 2.5;    // m beyond a boat's half-length you can step aboard from
export const CREW_SLOW = 1.2;     // m/s: a boat going faster than this can't be stepped onto
export const WHEEL_EVERY = 0.15;  // s between words from the wheel while it's moving
export const WHEEL_IDLE = 0.8;    // s between words while it isn't
export const WHEEL_STALE = 1.5;   // s without a word: the wheel goes slack
export const CREW_WORDS = ['helm', 'yes', 'no', 'back', 'wheel'];
const WALK = 1.1;                 // m/s about the boat

// Where crew stand in a boat (boat-local metres, x across, z fore and aft): clear of the helm.
export function crewSpot(hull) {
  const aft = (hull.seatZ ?? 0) - 1.1, room = hull.L / 2 - 0.6;
  const z = aft > -room ? aft : Math.min(room, (hull.seatZ ?? 0) + 1.1);
  return { x: Math.min(0.3, Math.max(0, hull.B - 0.45)), z };
}

export class Crew {
  constructor({ together }) {
    this.together = together;
    this.on = null;      // crewing: { id (whose boat), x, z (where in her), helm }
    this.given = null;   // your boat, someone else at the helm: { id, ti, si, at }
    this.wheelT = 0;
    this.idleT = 0;
    this.sent = null;
  }

  /* ---------- crewing ---------- */

  // Step aboard friend `id`'s boat (hull: hers), at the crew's spot.
  board(id, hull) {
    const s = crewSpot(hull);
    this.on = { id, x: s.x, z: s.z, helm: false };
  }

  // Step off (the helm goes back first, if you had it).
  leave() {
    if (this.on?.helm) this.together.crewWord(this.on.id, 'back');
    this.on = null;
    this.sent = null;
  }

  // Walking about inside her: (ax, az) a boat-local direction, kept off her sides and ends.
  walk(ax, az, hull, dt) {
    const O = this.on;
    if (!O) return;
    const m = Math.hypot(ax, az);
    if (m < 0.05) return;
    const k = (WALK * dt) / Math.max(1, m);
    const xs = Math.max(0.05, hull.B - 0.35), zs = Math.max(0.2, hull.L / 2 - 0.5);
    O.x = Math.max(-xs, Math.min(xs, O.x + ax * k));
    O.z = Math.max(-zs, Math.min(zs, O.z + az * k));
  }

  askHelm() {
    return !!this.on && !this.on.helm && this.together.crewWord(this.on.id, 'helm');
  }

  handBack() {
    if (!this.on?.helm) return false;
    this.on.helm = false;
    this.sent = null;
    return this.together.crewWord(this.on.id, 'back');
  }

  // At the helm: your wheel (si, -1 … 1, +1 to port as the game's keys give it) and throttle
  // or lever keys (ti), to your friend's game, when they change and now and then anyway.
  sendWheel(dt, ti, si) {
    if (!this.on?.helm) return;
    this.wheelT -= dt;
    this.idleT -= dt;
    if (this.wheelT > 0) return;
    const q = (v) => Math.round(Math.max(-1, Math.min(1, v || 0)) * 20) / 20;
    const w = { ti: q(ti), si: q(si) }, S = this.sent;
    const changed = !S || S.ti !== w.ti || S.si !== w.si;
    if (!changed && this.idleT > 0) return;
    if (this.together.crewWord(this.on.id, 'wheel', w)) {
      this.sent = w;
      this.wheelT = WHEEL_EVERY;
      this.idleT = WHEEL_IDLE;
    }
  }

  /* ---------- your boat, a friend crewing ---------- */

  // Whether friend p's pose says they're aboard your boat.
  aboard(p) {
    return !!p && (p.view || p.pose)?.cr === this.together.id;
  }

  grant(p) {
    if (!this.together.crewWord(p.id, 'yes')) return false;
    this.given = { id: p.id, ti: 0, si: 0, at: this.together.clock };
    return true;
  }

  deny(p, why) {
    return this.together.crewWord(p.id, 'no', { w: why });
  }

  // The helm back with you (you touched the controls, or they left): they're told.
  takeBack() {
    const g = this.given;
    if (!g) return null;
    this.given = null;
    if (this.together.peers.has(g.id)) this.together.crewWord(g.id, 'back');
    return g.id;
  }

  // Your crew's wheel and lever just now ({ ti, si }), slack if their word's stopped coming, or
  // null if nobody else has your helm (or they've stepped off or gone).
  wheel() {
    const g = this.given;
    if (!g) return null;
    const p = this.together.peers.get(g.id);
    if (!p || !this.aboard(p)) {
      this.given = null;
      return null;
    }
    if (this.together.clock - g.at > WHEEL_STALE) return { ti: 0, si: 0, slack: true };
    return g;
  }

  /* ---------- words ---------- */

  // A crew word from friend p (together.js has checked its shape). Returns what it means for the
  // game: 'granted', 'refused' (with d.w), 'returned' (the helm's back with them), 'asked' (they'd
  // like your helm: grant or deny), 'handed' (they've handed yours back), or null.
  heard(p, d) {
    const O = this.on;
    if (O && p.id === O.id) {
      if (d.e === 'yes' && !O.helm) {
        O.helm = true;
        this.sent = null;
        this.wheelT = 0;
        return 'granted';
      }
      if (d.e === 'no') return 'refused';
      if (d.e === 'back' && O.helm) {
        O.helm = false;
        return 'returned';
      }
      return null;
    }
    if (!this.aboard(p)) return null;
    if (d.e === 'helm') return 'asked';
    if (d.e === 'wheel' && this.given?.id === p.id) {
      Object.assign(this.given, { ti: d.ti, si: d.si, at: this.together.clock });
      return null;
    }
    if (d.e === 'back' && this.given?.id === p.id) {
      this.given = null;
      return 'handed';
    }
    return null;
  }
}
