// The moment a fish comes out of the water (see showCatch in main.js, and camera.js): you see it
// held up (or drawn alongside a big boat) for a moment before the catch card, the camera coming
// round in front of you and in close; then on the card its weight comes up on the spring balance,
// the needle swinging past and settling; and a stamp for what it means: new in your journal, your
// biggest yet of its kind, or a fish of a lifetime. All plain numbers here, so it can be tested.

const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

export const HOLD = 1.0;   // seconds you see it held up before the card comes (seen from outside)
export const COUNT = 1.1;  // seconds the balance takes to settle

// A fish of a lifetime: within a tenth of the biggest its kind grows to (the same as the journal's
// goal, see goals.js), for kinds that grow to a decent size at all.
export const lifetimeOf = (sp, size) => sp.size[1] >= 30 && size >= sp.size[0] + (sp.size[1] - sp.size[0]) * 0.9;

// The spring balance: what the needle reads t seconds after the fish goes on it. It swings up past
// the weight, back under, and settles, as a spring balance does (a damped swing), and from COUNT
// on reads the weight exactly.
export function needle(kg, t) {
  if (!(t > 0)) return 0;
  if (t >= COUNT) return kg;
  const u = t / COUNT;
  return kg * (1 - Math.exp(-5 * u) * Math.cos(8 * u));
}

// 1st, 2nd, 3rd, 4th … 11th, 12th, 13th, 21st.
export function ordinal(n) {
  const t = n % 100;
  return `${n}${t >= 11 && t <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'}`;
}

// What the card says beyond its size: its stamp (the biggest news first: a fish of a lifetime,
// new in your journal, your biggest yet) and its place in your tally. count: how many of its kind
// you've had, this one included; best: your best before this one (cm).
export function verdictOf(sp, size, { isNew = false, record = false, count = 1, best = 0 } = {}) {
  const lifetime = lifetimeOf(sp, size);
  const stamp = lifetime ? 'lifetime' : isNew ? 'new' : record ? 'record' : null;
  const name = sp.name.toLowerCase();
  const unit = sp.creature ? 'cm mantle' : 'cm';
  const tally = isNew ? `Your first ${name}` : record ? `Your ${ordinal(count)} ${name}, and your biggest: the best was ${best} ${unit}` : `Your ${ordinal(count)} ${name} · your best is ${best} ${unit}`;
  return { stamp, lifetime, tally };
}

// How far the camera stands off for a good look: further for a bigger fish (m).
export const heroDistance = (size, big = false) => clamp(1.3 + (size / 100) * 1.4, 2, big ? 7.5 : 4.2);
