// Word on the water (F3c). Out on the water the town's anglers and the lobsterman see what you
// don't: when a big feed breaks the top somewhere off out of your sight (birds working, the bait
// balled and hunters crashing through it: world/feeding.js), one of them passes word, by your phone
// along the coast or on her VHF, with where it is. A marker points the way while it lasts. Twice a
// day at most, by day, and never while you're in the middle of something; on the deep water with
// no VHF, nobody reaches you (as for calling for help: safety.js).
//
// state.word: { day, n (words passed today) }.

export const WORD_PER_DAY = 2;
export const NEAR = 300;      // closer than this you can see it for yourself
export const FAR = 2500;      // further than this isn't worth the run
export const MIN_HUNTERS = 3; // (as many as it takes to drive the ball up and break the top: world/feeding.js FEED.drive)
// Who passes word: out on the water by day, with a rod or among their pots.
export const VOICES = [
  { id: 'hettie', name: 'Hettie', from: 'out in her boat' },
  { id: 'dougie', name: 'Dougie', from: 'hauling his pots' },
  { id: 'ian', name: 'Ian', from: 'out in his skiff' },
];

// A feed worth passing word of: broken at the top (phase 1, world/feeding.js UP), big, out of
// sight but not too far, not told already.
export function worthWord(e, px, pz, told) {
  if (!e || e.phase !== 1 || e.done || (e.hunters || 0) < MIN_HUNTERS || told.has(e.id)) return false;
  const d = Math.hypot(e.x - px, e.z - pz);
  return d >= NEAR && d <= FAR;
}

// Can word reach you: by her VHF, or your phone where it has signal ('vhf' | 'phone' | null).
export const heardBy = ({ vhf = false, signal = true } = {}) => (vhf ? 'vhf' : signal ? 'phone' : null);

// Whether there's word left to pass today.
export function wordLeft(W, day) {
  return !W || W.day !== day || W.n < WORD_PER_DAY;
}
export function wordPassed(W, day) {
  if (W.day !== day) Object.assign(W, { day, n: 0 });
  W.n++;
  return W;
}

// The words: who, how, where, and what's under the birds (a fish's name, or null).
export function wordFor({ voice, how, where, fish }) {
  const V = voice || VOICES[0];
  const what = fish ? `${fish} crashing through the bait under them` : 'something big crashing through the bait under them';
  return `${V.name}, ${V.from}, ${how === 'vhf' ? 'on the VHF' : 'on your phone'}: “Birds working ${where}, and ${what}. Worth a look if you’ve a rod with you.”`;
}

export const newWord = () => ({ day: 0, n: 0 });
export function cleanWord(raw) {
  const W = newWord();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return W;
  if (Number.isFinite(raw.day) && raw.day > 0) W.day = Math.min(1e6, Math.floor(raw.day));
  if (Number.isFinite(raw.n) && raw.n > 0) W.n = Math.min(WORD_PER_DAY, Math.floor(raw.n));
  return W;
}
