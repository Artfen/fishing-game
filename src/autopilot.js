// The trawler's autopilot (L2 of docs/LIVEABOARD.md): it holds the course you set at the revs she's
// at, so you can let go of the wheel; and its alarms, for shallow water or land on her course and a
// boat closing on her. It isn't a crew: it steers, it doesn't keep a lookout or change course for
// anything, and it never steers her out of trouble; it sounds the alarm, and the rest is yours.
//
// Pure: the game passes in where she is and what's round her (main.js), and steers her with what
// steerFor returns, as the helm would.

// Steering: how hard it puts the helm over for each radian she's off her course, and for each
// radian a second she's swinging (it eases the helm off as she comes round, so she settles on her
// course instead of swinging through it), and the most helm it uses. The law is the boats' own
// hands-off course hold (Boat.holdCourse), firmer, for seventeen tonnes: in a fresh breeze on her
// beam it holds her within about two degrees, three at worst, as a good autopilot does
// (tests/trawler.test.mjs). turn: how fast the wheel turns the course it holds (rad/s).
import { $t } from './i18n.js';
export const PILOT = { kp: 5, kd: 8, most: 0.9, turn: 0.12 };
// The alarms: how far ahead she looks (seconds of her speed, never less than lookMin metres), the
// step it looks in, the water she wants under her keel beyond her draft (m), and for a boat closing,
// how near to look (m), how near a pass counts as close (m), and how soon (s).
export const WATCH = { secs: 90, lookMin: 80, step: 8, margin: 1.2, range: 260, cpa: 25, within: 90 };

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// { on, set (the course it holds, rad, as her heading), alarm (what it's sounding for: 'land',
// 'shallow' or 'boat', or null) }
export const newPilot = () => ({ on: false, set: 0, alarm: null });
export function engage(P, heading) {
  P.on = true;
  P.set = wrap(heading);
  P.alarm = null;
}
export function release(P) {
  P.on = false;
  P.alarm = null;
}
// The wheel (steer: -1 … 1, as the game's: + to port, the left key, her heading growing) turns the
// course it holds, a little at a time, the way you'd turn its knob: held hard over, about seven
// degrees a second.
export function nudge(P, steer, dt) {
  if (Math.abs(steer) > 0.05) P.set = wrap(P.set + steer * PILOT.turn * dt);
}
// The helm it puts on (-1 … 1, as the game's steer), from her heading and how fast she's turning
// (rad/s, + to port): off to port of her course, a touch of starboard helm, eased as she comes back.
export function steerFor(P, heading, omega) {
  const err = wrap(heading - P.set);
  return -clamp(PILOT.kp * err + PILOT.kd * omega, -PILOT.most, PILOT.most);
}
// Her course in degrees on the compass (0 … 359).
export const degrees = (a) => Math.round((((a * 180) / Math.PI) % 360) + 360) % 360;

// What lies ahead on her course: { what: 'land' | 'shallow', d (m), depth } for the first of it,
// or null. at: { x, z, fx, fz (her heading as a unit vector), speed }; depthAt(x, z): the water's
// depth there (m; land, zero or less); draft: hers (m, to the bottom of her keel).
export function lookAhead(at, depthAt, draft) {
  const far = Math.max(WATCH.lookMin, at.speed * WATCH.secs);
  for (let d = WATCH.step; d <= far; d += WATCH.step) {
    const x = at.x + at.fx * d, z = at.z + at.fz * d, depth = depthAt(x, z);
    if (!(depth > 0)) return { what: 'land', d };
    if (depth < draft + WATCH.margin) return { what: 'shallow', d, depth };
  }
  return null;
}

// The boat closing on her soonest, if any will pass close: own and others are { x, z, vx, vz }
// (others with a name). Returns { name, d (m now), t (s to her closest), cpa (m then), side
// ('port' | 'starboard': where she lies from her bow) } or null. fx, fz: her heading.
export function closing(own, fx, fz, others) {
  let best = null;
  for (const o of others) {
    const rx = o.x - own.x, rz = o.z - own.z, d = Math.hypot(rx, rz);
    if (d > WATCH.range || d < 1) continue;
    const vx = o.vx - own.vx, vz = o.vz - own.vz, v2 = vx * vx + vz * vz;
    if (v2 < 0.01) continue;
    const t = -(rx * vx + rz * vz) / v2;
    if (t <= 0 || t > WATCH.within) continue;
    const cpa = Math.hypot(rx + vx * t, rz + vz * t);
    if (cpa > WATCH.cpa || (best && t >= best.t)) continue;
    // (Port, her left, is (fz, -fx) from her heading (fx, fz): at heading 0 her bow is along +z and
    // port along +x, as boat.js has her.)
    const across = rx * fz - rz * fx;
    best = { name: o.name || $t('a boat'), d, t, cpa, side: across > 0 ? 'port' : 'starboard' };
  }
  return best;
}
