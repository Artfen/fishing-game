// Lines (marine physics C4): what a rope does when it's pulled, as numbers, for the towline, the
// anchor's rode and the mooring lines (boat.js, mooring.js; drawn by rope.js).
//
// A rope is a spring that only pulls: slack, nothing; past its length it stretches, and the pull
// grows with the stretch, as stiff as its fibre and thickness make it and the stiffer the shorter
// it is (EA over its length); it soaks up a snatch with its own damping; and past its breaking
// load it parts. Nylon stretches a fifth of its length before it parts (it's what towlines and
// anchor rodes are made of, for that: a wave's snatch is taken up in the rope, not the cleats);
// polyester an eighth (mooring lines, which should hold her where she is).
//
// Figures typical of three-strand line of each size, rounded; the breaking loads are new rope's.

export const G = 9.81;

// mbl: minimum breaking load (N); strain: the stretch at that load, as a share of its length;
// zeta: its damping, as a share of critical for the mass it's holding; mm: its diameter.
export const LINES = {
  towline: { name: 'towline', fibre: 'nylon', mm: 12, mbl: 30000, strain: 0.2, zeta: 0.5 },
  rode: { name: 'anchor rode', fibre: 'nylon', mm: 12, mbl: 32000, strain: 0.2, zeta: 0.6 },
  mooring: { name: 'mooring line', fibre: 'polyester', mm: 12, mbl: 30000, strain: 0.12, zeta: 0.7 },
};

// Its stiffness (N per metre of stretch) at a length (m).
export const stiffness = (spec, len) => spec.mbl / (spec.strain * Math.max(0.5, len));

// The pull in a line of length `len` whose ends are `d` apart and opening at `rate` (m/s, + apart),
// holding `mass` (kg: the two ends' masses combined as one, m1·m2 / (m1 + m2), for its damping):
// { T (N), parted, load (T over what it holds) }. `strength`: what share of a new line's breaking
// load this one holds (STRENGTH: by difficulty); Infinity, it never parts. The pull is the same.
export function tension(spec, len, d, rate, mass, strength = 1) {
  const stretch = d - len;
  if (stretch <= 0) return { T: 0, parted: false, load: 0 };
  const k = stiffness(spec, len), c = 2 * spec.zeta * Math.sqrt(k * Math.max(1, mass));
  // (Anything but a positive number for its strength: a sound line.)
  const T = Math.max(0, k * stretch + c * rate), holds = spec.mbl * (strength > 0 ? strength : 1);
  const parted = T > holds;
  return { T: parted ? 0 : T, parted, load: T / Math.min(holds, spec.mbl * 4) };
}
// What a line holds, by difficulty: on Relaxed it never parts; on Standard it's a sound line; on
// Realistic, one that's seen some seasons (four-fifths of a new one's strength).
export const STRENGTH = { relaxed: Infinity, standard: 1, realistic: 0.8 };

// In words for the screen: "2.1 kN, a twentieth of what it holds".
export function loadWords(T, spec) {
  const kN = T / 1000, share = T / spec.mbl;
  const how = share >= 0.75 ? 'close to parting' : share >= 0.5 ? 'bar-tight' : share >= 0.2 ? 'working hard' : share > 0.02 ? 'taking the strain' : 'slack';
  return `${kN < 10 ? kN.toFixed(1) : Math.round(kN)} kN, ${how}`;
}
