// What the fish finder makes of the water under it (E1, see sonar.js), from the world's own data
// only: what the bottom is and how hard it sends the ping back, and where the summer's warm top
// layer gives way to the cold below. Nothing here invents anything: the habitat's rock and weed,
// the zone's water, the depth, and the water's temperature at each depth (world/seatemp.js).

// The bottom under a habitat sample s ({ depth, rock, weed }) in a zone (terrain.js zoneAt), and
// south (at Las Brasas). { kind: 'rock' | 'gravel' | 'sand' | 'mud' | 'weed', under: what the weed
// grows on, hard: 0 … 1 (how strongly it sends the ping back) }.
// (The same split the divers' seabed uses, world/seabed.js: rock from 0.35, weed from 0.4, sand
// elsewhere in the sea; and what fresh water lies on.)
const RUNNING = new Set(['stream', 'river']);
const STILL = new Set(['lake', 'mere']);
const BRACKISH = new Set(['estuary', 'tideway']);
const HARD = { rock: 0.85, gravel: 0.62, sand: 0.45, mud: 0.18 };

export function sediment(s, zone, south = false) {
  const d = s.depth;
  if (RUNNING.has(zone) || zone === 'tarn') return 'gravel';
  if (STILL.has(zone)) return d < 2 ? 'sand' : 'mud';
  if (BRACKISH.has(zone)) return d < 1.5 ? 'sand' : 'mud';
  // The sea: sand, out to where it's deep and still enough for the silt to settle.
  return d < (south ? 45 : 25) ? 'sand' : 'mud';
}

export function bottomOf(s, zone, south = false) {
  if (s.rock > 0.35) return { kind: 'rock', under: 'rock', hard: Math.min(1, HARD.rock + 0.3 * (s.rock - 0.35)) };
  const under = sediment(s, zone, south);
  // (Weed softens the return: its fronds take some of the ping before it reaches the bottom.)
  if (s.weed > 0.4) return { kind: 'weed', under, hard: HARD[under] * 0.75 };
  // Scattered rock on sand or mud hardens it a little.
  return { kind: under, under, hard: Math.min(1, HARD[under] + s.rock * 0.5) };
}

// In words, for the readout and a mark: "rock", "gravel", "sand", "mud", "weed over sand".
export const bottomWords = (b) => (b.kind === 'weed' ? `weed over ${b.under}` : b.kind);

// The water column's temperature layers, from tempAt(depth) (°C) down to the bottom (m):
// { top, bottom, cline } where cline is the depth (m) where it cools fastest, if it cools by at
// least a quarter of a degree a metre there (a thermocline a sonar can show at high gain), else
// null, as it is when the top's less than 1.5°C warmer than the bottom. (Only where the world's
// water has one: the sea in summer; the winter's gales mix it.)
export function layers(tempAt, bottom) {
  const top = tempAt(0), deepest = Math.max(0.5, bottom);
  let cline = null, steepest = 0.25, prev = top;
  for (let d = 0.5; d <= deepest + 1e-6; d += 0.5) {
    const t = tempAt(d), g = (prev - t) / 0.5;
    if (g > steepest) {
      steepest = g;
      cline = d - 0.25;
    }
    prev = t;
  }
  // (A band for less than a degree and a half top to bottom would be a guess: none.)
  const bottomT = tempAt(deepest);
  if (top - bottomT < 1.5) cline = null;
  return { top, bottom: bottomT, cline, drop: cline != null ? steepest : 0 };
}
