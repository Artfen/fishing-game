// Electric trolling motors and GPS Spot-Lock: a bow-mounted electric motor for quiet manoeuvring
// and for holding a spot in water too deep to anchor in. Not trawling: no nets, just a quiet push.
//
// The motor is a real thruster on the boat (see Boat.update): it pushes where it is, under the
// bow, the way its head points, and the hull, the wind, the waves and the current do the rest. It
// never moves the boat itself:
//  · Manual: the push and the head's angle are yours (the movement keys, with the main engine in
//    neutral), for creeping along a reef or round a bait ball.
//  · Heading hold (the GPS motors): you set the push, it keeps her bow on the heading you set.
//  · Spot-Lock (the GPS motors): it notes where she is and pushes back towards it, as a controller
//    would: the further she's drifted and the faster she's going, the harder, up to all it has.
//    She wanders a metre or two as it corrects, more in a breeze; a strong wind or tide, a big sea
//    (the propeller lifting out at the bow), a flat battery or too much boat for the motor and she
//    drags off slowly, and it says so.
// It draws on its own battery (charged at a jetty, and overnight), and switches itself off when the
// main engine's put in gear, when it's stowed, or when the battery's flat.
//
// The yacht is too big for a bow motor; her equivalent is a different kind of thing (dynamic
// positioning on her own engines) and isn't here yet.

// The motors (shipyard.js sells them): push in newtons as the game's hulls feel it, what it draws
// at full push (W), whether it has GPS (heading hold and Spot-Lock).
export const TROLL_TIERS = {
  troll: { name: 'Bow trolling motor', push: 320, watts: 650, gps: false },
  trollgps: { name: 'GPS trolling motor', push: 320, watts: 650, gps: true },
  trollpro: { name: 'High-thrust GPS trolling motor', push: 700, watts: 1300, gps: true },
};
export const TROLL_IDS = Object.keys(TROLL_TIERS);
// The boats a bow mount suits (and how far forward of her middle it sits, as a share of her
// length): not the RIB (her tubes meet in the nose), the yacht (too big), the sailing boat, the
// jet ski, the board or the kayak (which has its own little motor).
export const TROLL_BOATS = { skiff: 0.45, bass: 0.46, cabin: 0.45, console: 0.46 };
export const canTroll = (kind) => kind in TROLL_BOATS;
// The battery for it: watt-hours (a big deep-cycle battery; the bank fitting doubles it).
export const TROLL_WH = 1200;

const LOCK_KP = 0.16;     // 1/s²: how hard Spot-Lock pulls per metre off (as an acceleration of her mass)
const LOCK_KD = 0.85;     // 1/s: how much it damps her drifting speed
const LOCK_EASY = 0.8;    // m: inside this it barely pushes (a real one hunts less than it holds)
const HEAD_RATE = 2.4;    // rad/s the head turns
const DEPLOY_T = 2.2;     // s to swing it down off its mount (and up again)
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

export class TrollMotor {
  // tier: one of TROLL_IDS; bank: the battery bank fitted (twice the watt-hours).
  constructor(tier, { bank = false } = {}) {
    this.tier = tier;
    this.spec = TROLL_TIERS[tier];
    this.wh = TROLL_WH * (bank ? 2 : 1);
    this.down = 0;          // 0 stowed … 1 deployed
    this.want = false;      // deployed, or on its way
    this.mode = 'off';      // 'off', 'manual', 'heading', 'lock'
    this.power = 0;         // manual and heading: the push asked for, -1 … 1 (astern is the head turned round)
    this.steer = 0;         // manual: the head turned (rad, + to port)
    this.angle = 0;         // where the head points now (rad from dead ahead, + to port)
    this.f = 0;             // the push now (N)
    this.lock = null;       // Spot-Lock: { x, z }; heading hold: { heading }
    this.off = 0;           // Spot-Lock: how far she is from her spot now (m)
    this.short = 0;         // 0 … 1: how much of what's wanted it can't give (a strong drift)
  }

  get gps() { return this.spec.gps; }
  get deployed() { return this.down >= 1; }

  deploy(on = !this.want) {
    this.want = !!on;
    if (!on) this.stop();
    return this.want;
  }

  stop() {
    this.mode = 'off';
    this.lock = null;
    this.power = 0;
    this.f = 0;
  }

  // Spot-Lock on where she is now (x, z), or off. Returns why not, or null.
  spotLock(on, at) {
    if (!on) {
      if (this.mode === 'lock') this.stop();
      return null;
    }
    if (!this.gps) return 'no-gps';
    if (!this.deployed) return 'stowed';
    this.mode = 'lock';
    this.lock = { x: at.x, z: at.z };
    return null;
  }

  // Heading hold on her heading now, or off.
  holdHeading(on, heading) {
    if (!on) {
      if (this.mode === 'heading') this.mode = this.power ? 'manual' : 'off';
      return null;
    }
    if (!this.gps) return 'no-gps';
    if (!this.deployed) return 'stowed';
    this.mode = 'heading';
    this.lock = { heading };
    return null;
  }

  // Manual: the push (-1 … 1) and the head (-1 … 1, + to port) asked for.
  drive(power, steer) {
    if (this.mode === 'lock') return;
    this.power = clamp(power, -1, 1);
    this.steer = clamp(steer, -1, 1) * 1.2;
    if (this.mode !== 'heading') this.mode = this.power ? 'manual' : 'off';
  }

  // Once a frame. boat: { x, z, vx, vz, heading, mass }; battery: 0 … 1 (its charge); sea: the wave
  // height where she is (m); lever: the main engine's throttle (anything but neutral turns it off).
  // Returns { f (N), angle (rad, + to port), drawn (charge used, 0 … 1), why (anything it said) }.
  step(dt, { boat, battery = 1, sea = 0, lever = 0 }) {
    let why = null;
    // Down off its mount, or up onto it.
    this.down = clamp(this.down + (this.want ? 1 : -1) * dt / DEPLOY_T, 0, 1);
    if (!this.deployed) {
      if (this.mode !== 'off') this.stop();
      this.f = 0;
      return { f: 0, angle: this.angle, drawn: 0, why };
    }
    if (lever && this.mode !== 'off') {
      this.stop();
      why = 'gear';
    }
    if (battery <= 0 && this.mode !== 'off') {
      this.stop();
      why = 'flat';
    }
    // What it can give: all of it on a good battery, less as it runs down; and in a big sea the
    // bow lifts and the propeller sucks air.
    const fmax = this.spec.push * clamp(battery / 0.2, 0.25, 1) * clamp(1 - (sea - 0.7) / 1.1, 0.15, 1);
    let want = 0, head = this.angle;
    if (this.mode === 'lock') {
      // Back towards the spot: an acceleration of her mass, from how far off she is and how fast
      // she's drifting, turned into a push and the head pointed along it.
      const ex = this.lock.x - boat.x, ez = this.lock.z - boat.z, d = Math.hypot(ex, ez);
      this.off = d;
      const easy = clamp(d / LOCK_EASY, 0, 1);
      const ax = LOCK_KP * ex * easy - LOCK_KD * boat.vx, az = LOCK_KP * ez * easy - LOCK_KD * boat.vz;
      const F = Math.hypot(ax, az) * boat.mass;
      want = Math.min(F, fmax);
      this.short = F > 1 ? clamp((F - fmax) / F, 0, 1) : 0;
      if (want > 1) head = wrap(Math.atan2(ax, az) - boat.heading);
      // (A push straight back past her beam: the head swings round and pulls her stern-first.)
    } else if (this.mode === 'heading') {
      want = Math.abs(this.power) * fmax;
      const err = wrap(this.lock.heading - boat.heading);
      head = clamp(err * 2.2, -1.2, 1.2) + (this.power < 0 ? Math.PI : 0);
    } else if (this.mode === 'manual') {
      want = Math.abs(this.power) * fmax;
      head = this.steer + (this.power < 0 ? Math.PI : 0);
    }
    // The head turns at its own rate; the push comes on as it points the right way.
    const turn = wrap(head - this.angle);
    this.angle = wrap(this.angle + clamp(turn, -HEAD_RATE * dt, HEAD_RATE * dt));
    const lined = Math.max(0, Math.cos(wrap(head - this.angle)));
    this.f = want * lined;
    // The battery: watt-hours at the push asked (propellers draw more than in proportion).
    const share = this.spec.push > 0 ? this.f / this.spec.push : 0;
    const drawn = (this.spec.watts * Math.pow(share, 1.4) * dt) / 3600 / this.wh;
    return { f: this.f, angle: this.angle, drawn, why };
  }
}
