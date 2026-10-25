import { clamp, smoothstep, lerp } from './util.js';

// Sailing: the wind on the sail, as a few honest approximations (no fluid simulation).
//
//  · The sail feels the apparent wind: the true wind less the boat's own motion through the air,
//    so it swings forward and freshens as she picks up speed.
//  · Where that wind comes from, as an angle off the bow (0 dead ahead, π dead astern), and how
//    far the boom is let out (the sheet sets the most it can go; the wind blows it out that far,
//    never past the wind itself) give the sail's angle of attack.
//  · Like a wing, the sail makes lift across the wind and drag along it. Too little angle and it
//    luffs (flaps, no drive: haul in); too much and it stalls (all drag: ease out). Lift peaks a
//    little over twenty degrees. Lift and drag together push her forward and sideways; the
//    centreboard resists the sideways part (leeway), the crew sit out against the heel.
//  · Within about thirty-five degrees of the true wind nothing drives her: in irons. Tack through
//    the wind with way on, or bear away.
//
// Directions: the boat's forward vector (fx, fz) and right vector (rx, rz) as in boat.js; the
// apparent wind (ax, az) is where the air is going, in m/s.

export const SAIL = {
  area: 11,        // m², mainsail and jib together
  mass: 260,       // kg, the boat and you
  rho: 1.2,        // kg/m³, air
  boomMin: 0.12,   // rad: the boom hauled right in, near the centreline
  boomMax: 1.45,   // rad: let right out, against the shroud
  best: 0.38,      // rad: the angle of attack that drives hardest (about 22°)
  sheetRate: 0.42, // of the sheet's travel a second, hauling or easing
};

// Lift and drag coefficients for an angle of attack (rad). A sail luffs below a few degrees,
// lifts most a little over twenty, stalls beyond and is all drag square to the wind.
export function coefficients(alpha) {
  const a = clamp(alpha, 0, Math.PI / 2);
  const cl = a <= SAIL.best
    ? 1.4 * smoothstep(0.05, SAIL.best, a)
    : 1.4 - 0.95 * smoothstep(SAIL.best, 1.45, a);
  const cd = 0.05 + 1.25 * Math.sin(a) ** 2 + (a < 0.1 ? 0.02 : 0); // (a flogging sail drags a little)
  return { cl, cd };
}

// The sheet (0 hauled right in … 1 let right out) as the furthest the boom can go.
export const boomLimit = (sheet) => lerp(SAIL.boomMin, SAIL.boomMax, clamp(sheet, 0, 1));
// And the sheet that would set the boom at a given angle.
export const sheetFor = (boom) => clamp((boom - SAIL.boomMin) / (SAIL.boomMax - SAIL.boomMin), 0, 1);

// The sail's push on the boat (accelerations, m/s²) and how it's drawing.
//   awa: where the apparent wind comes from, off the bow (0 … π); side: +1 wind over the right
//   (starboard) side, −1 over the left; boom: how far out the boom lies (rad, always ≥ 0, to
//   leeward); alpha: the angle of attack; drive: forward; lateral: along the right vector (to
//   leeward, so opposite in sign to side); state: 'irons', 'luffing', 'stalled' or 'drawing'.
const _out = { awa: 0, side: 1, boom: 0, alpha: 0, drive: 0, lateral: 0, speed: 0, state: 'drawing', power: 0 };
// (rig: the sail's area and what it drives, { area, mass }: the sailing boat's by default; a
// windsurf board has its own.)
export function sailForce(ax, az, fx, fz, rx, rz, sheet, out = _out, rig = SAIL) {
  const V = Math.hypot(ax, az);
  out.speed = V;
  if (V < 0.05) {
    out.awa = 0; out.boom = boomLimit(sheet); out.alpha = 0; out.drive = 0; out.lateral = 0; out.state = 'luffing'; out.power = 0;
    return out;
  }
  // In the boat's own frame: along (forward) and across (right), where the air goes.
  const af = (ax * fx + az * fz) / V, ar = (ax * rx + az * rz) / V;
  const awa = Math.acos(clamp(-af, -1, 1));
  // Over the right side, the air goes left (ar < 0).
  const side = ar < 0 ? 1 : -1;
  // The boom goes out as far as the sheet lets it, but never past the wind.
  const boom = Math.min(boomLimit(sheet), Math.max(0, awa - 0.02));
  const alpha = awa - boom;
  const { cl, cd } = coefficients(alpha);
  const q = (0.5 * SAIL.rho * rig.area * V * V) / rig.mass;
  // Drag along the air; lift square to it, towards the leeward side (forward, on a reach).
  const lf = side > 0 ? -ar : ar, lr = side > 0 ? af : -af;
  out.drive = q * (cl * lf + cd * af);
  out.lateral = q * (cl * lr + cd * ar);
  out.awa = awa;
  out.side = side;
  out.boom = boom;
  out.alpha = alpha;
  // How hard the sail is pulling, 0 … 1 (for the telltales, the sheet's creak and the heel), and
  // its whole pull (m/s² on what it drives: what a windsurfer has to hold).
  out.pull = q * Math.hypot(cl, cd);
  out.power = clamp(out.pull / 1.6, 0, 1);
  out.state = awa < 0.42 && alpha < 0.12 ? 'irons'
    : alpha < 0.1 ? 'luffing'
      : alpha > SAIL.best + 0.32 && awa < 2.3 ? 'stalled' : 'drawing';
  return out;
}

// What the telltales say, in words, and which way to go on the sheet (−1 haul in, +1 ease).
export function trimAdvice(f) {
  if (f.state === 'irons') return { words: 'in irons: bear away', sheet: 0 };
  if (f.state === 'luffing') return { words: 'luffing: haul in', sheet: -1 };
  if (f.state === 'stalled') return { words: 'stalled: ease out', sheet: 1 };
  if (f.awa > 2.6) return { words: 'running', sheet: 0 };
  return { words: f.awa < 0.75 ? 'close-hauled' : f.awa < 1.9 ? 'reaching' : 'broad reach', sheet: 0 };
}

// For a light hand on the sheet (the assisted setting): the sheet that would set the sail at its
// best angle for this wind.
export const bestSheet = (awa) => sheetFor(Math.max(SAIL.boomMin, awa - SAIL.best));

// The hull through the water: drag rising steeply as she nears her hull speed (about 3 m/s,
// six knots, for a boat this long), so no wind drives her much past it.
export const hullDrag = (v) => 0.2 + 0.05 * Math.abs(v) + 0.32 * Math.max(0, Math.abs(v) - 2.4) ** 2;
// The centreboard's grip on the water: more the faster she goes.
export const boardGrip = (v) => 2.6 + 2.2 * Math.min(Math.abs(v), 3);
// A windsurf board: slow and draggy while it ploughs along at a walking pace; past about four
// metres a second it climbs onto the plane and slips away (and seldom much past ten).
export const boardDrag = (v) => {
  const a = Math.abs(v), plane = smoothstep(3.2, 4.6, a);
  return lerp(0.35 + 0.08 * a + 0.4 * Math.max(0, a - 2.4) ** 2, 0.22 + 0.03 * a, plane) + 0.05 * Math.max(0, a - 10) ** 2;
};
// Its fin's grip on the water: little when it's slow, a lot once it's going.
export const finGrip = (v) => 3 + 3 * Math.min(Math.abs(v), 4);
// How far she heels for a sideways push (rad), with you sitting out: never over.
export const heelFor = (lateral) => clamp(lateral * 0.24, -0.5, 0.5);
