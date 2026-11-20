// How an engine sounds at a given throttle (docs/HUMAN-TOUCH.md, H3): the numbers audio.js sets its
// engine voice to, yours and one heard across the water, kept here so they're in one place and can
// be checked (tests/jetski.test.mjs).
//
// The voice is two oscillators (a sawtooth, and a second a little above it) through a low-pass
// filter, an amplitude "putter" at the firing rate, a slow wander in pitch, and a hiss of water.
//   level: 0 … 1, the throttle (or the revs); voice: '' an outboard, 'inboard' the yacht's and the
//   trawler's diesels, 'jet' the jet ski; tone: an outboard of its own from the catalogue
//   ({ pitch, its note against her own engine's; smooth, how much less it putters }).
// Returns { rpm (Hz, the first oscillator), ratio (the second's, to it), wave2 (its shape),
// lfoHz and lfoDepth (the putter), cutoff and q (the filter), gain, water and waterHz (the
// hiss of water and the intake, and where it sits), drift (cents of slow wander) }.
export function engineVoice(level, voice = '', tone = null) {
  const L = Math.max(0, Math.min(1, level || 0)), on = L > 0.001;
  const pitch = tone?.pitch ?? 1, smooth = tone?.smooth ?? 0, brighten = 0.85 + 0.15 * pitch;
  if (voice === 'jet') {
    // The jet ski: a smooth drone, not a rasp. Lower than it was (it peaked a third higher), its
    // filter well under half as bright and with no resonant peak, a putter only at idle that's
    // gone by half throttle, a little wander in pitch as she rides the waves, the water and the
    // intake rushing under it, and quieter at full throttle than an outboard: the hiss carries
    // the speed, not the whine.
    const rpm = (50 + L * 120) * pitch;
    return {
      rpm, ratio: 2, wave2: 'triangle',
      lfoHz: rpm / 2.2, lfoDepth: 0.4 * (1 - Math.min(1, L * 2)) ** 2,
      cutoff: (340 + L * 1000) * brighten, q: 0.7,
      gain: on ? 0.028 + L * 0.04 : 0,
      water: on ? 0.006 + L * 0.034 : 0, waterHz: 420 + L * 560,
      drift: 10 + L * 18,
    };
  }
  if (voice === 'inboard') {
    const rpm = (24 + L * 38) * pitch;
    return { rpm, ratio: 1.006, wave2: 'square', lfoHz: rpm / 3, lfoDepth: 0.45 * (1 - smooth), cutoff: (170 + L * 520) * brighten, q: 2, gain: on ? 0.05 + L * 0.08 : 0, water: 0, waterHz: 600, drift: 0 };
  }
  const rpm = (34 + L * 58) * pitch;
  return { rpm, ratio: 2.02, wave2: 'square', lfoHz: rpm / 2.2, lfoDepth: 0.45 * (1 - smooth), cutoff: (260 + L * 900) * brighten, q: 2, gain: on ? 0.035 + L * 0.07 : 0, water: 0, waterHz: 600, drift: 0 };
}

// What kind of voice a boat has: the jet ski's own, a diesel's, or an outboard's.
export const voiceOfHull = (hull, kind = '') => (hull?.motor?.jet || kind === 'jetski' ? 'jet' : hull?.motor?.inboard || kind === 'cabin' ? 'inboard' : '');
