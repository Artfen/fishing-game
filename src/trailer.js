// The boat trailer (R6): a little two-wheeled trailer for the car, kept beside the garage at home.
// Hitch it up, drive to the water with it, and a small boat comes out of the water onto it (or
// goes in off it) wherever the car can get close: Willowhaven's slipway, the strand, Wend Quay, the
// Mere Boathouse. With the road round the bay, that's the kayak up the Wend's channels or the bass
// boat down to the sea. Plain rules here; the trailer you see is in car.js, the prompts in main.js.

// The boats small enough to go on it.
export const TRAILABLE = ['kayak', 'row', 'skiff', 'bass', 'jetski'];
// Where it stands at home when it isn't hitched: beside the garage's far wall, nose to the drive.
export const TRAILER_HOME = { x: 139, z: -79, yaw: 0 };
// The trailer behind the car: the hitch this far behind the car's middle, the axle this far behind
// the hitch, the bed (what a boat sits on) this long.
export const HITCH = 2.45, TONGUE = 3.0, BED = 4.4;
// A boat comes onto it from within this far of the trailer (she's brought in to the bank and
// winched up), and goes in off it where there's water this deep within LAUNCH_REACH of it.
export const LOAD_REACH = 40, LAUNCH_REACH = 28, LAUNCH_DEPTH = 0.7;

// In the save: { hitched, boat (a kind, or null) }. A boat on it isn't in the water, nor laid up.
export function cleanTrailer(raw, kinds = TRAILABLE) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const boat = TRAILABLE.includes(r.boat) && kinds.includes(r.boat) ? r.boat : null;
  return { hitched: !!r.hitched || !!boat, boat };
}

// Where a boat goes in off the trailer at (x, z) (the way the trailer faces: yaw): the nearest water
// deep enough, looking all round but behind the trailer first; and which way she faces (out, away
// from the land). Or null: no water near enough.
export function launchSpot(depthAt, x, z, yaw, { reach = LAUNCH_REACH, depth = LAUNCH_DEPTH } = {}) {
  let best = null;
  for (let r = 2; r <= reach; r += 1) {
    for (let k = 0; k < 24; k++) {
      // (Behind first: k = 0 is straight back.)
      const a = yaw + Math.PI + (k % 2 ? 1 : -1) * Math.ceil(k / 2) * (Math.PI / 12);
      const px = x + Math.sin(a) * r, pz = z + Math.cos(a) * r;
      if (depthAt(px, pz) < depth) continue;
      // (Clear water round her too, not a puddle in the reeds.)
      if ([0, 1, 2, 3].some((q) => depthAt(px + Math.sin(a + q * Math.PI / 2) * 1.6, pz + Math.cos(a + q * Math.PI / 2) * 1.6) < depth * 0.5)) continue;
      best = { x: px, z: pz, heading: a, r };
      break;
    }
    if (best) break;
  }
  return best;
}

// Which of your boats in the water could come onto the trailer at (x, z): small enough, near
// enough, nobody aboard and not on a tow. boats: [{ kind, pos: { x, z }, aboard, towing }].
export function loadable(boats, x, z, reach = LOAD_REACH) {
  return boats
    .filter((b) => TRAILABLE.includes(b.kind) && !b.aboard && !b.towing && Math.hypot(b.pos.x - x, b.pos.z - z) < reach)
    .sort((a, b) => Math.hypot(a.pos.x - x, a.pos.z - z) - Math.hypot(b.pos.x - x, b.pos.z - z));
}
