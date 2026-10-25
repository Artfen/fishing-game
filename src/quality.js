// Graphics presets. "auto" starts from a sensible guess for the device and
// steps down a level if the frame rate keeps struggling.
// The underwater world scales too: how many fish swim (fishDensity), how dense the weed
// beds are (plants), drifting particles, light shafts, caustics and the active fish radius.
// Two levels sit above High, for computers with a capable graphics card:
//  · Ultra: the best that still plays smoothly on a good computer. Rendered a little sharper than
//    the screen (even on an ordinary monitor), sharper and further-reaching shadows, finer water
//    with a full-resolution mirror and a finer ripple field, more weed and grass, further to the
//    horizon, and a light finishing pass: a soft glow round the brightest light (lamps, the sun
//    on the water) and the colours of the hour graded a little.
//  · Cinematic: the richest look, for powerful computers and photographs. Everything Ultra has,
//    rendered sharper still, the clearest air and longest view, the most mist, weed and drifting
//    specks underwater, and a fuller finishing pass: a stronger glow, shafts of light from a low
//    sun, and a gentle vignette. It can run at a lower frame rate; nothing that matters to
//    fishing changes with it.
// (What the browser can draw is still a stylised, low-poly world: these make it cleaner, deeper
// and warmer, not photographic.)
// pixelRatio: the most pixels per screen pixel; minRatio: at least this many (above 1 it draws
// more than the screen has and smooths it down); shadowSpan: metres the sharp shadows reach round
// you; drawDistance: how far off things are drawn; air: haze (1 = the usual); fishNear: how close
// fish are drawn in full anatomical detail; post: the finishing pass (see post.js).
export const PRESETS = {
  cinematic: {
    label: 'Cinematic', pixelRatio: 2.5, minRatio: 1.5, shadows: true, shadowSize: 4096, shadowSpan: 70, waterSegments: 440, rain: 2400,
    fishDensity: 1, fishNear: 40, plants: 1, particles: 1400, rays: 10, caustics: 1.7, simRadius: 150,
    reflection: 1, reflectEvery: 1, ripples: 2048, rippleSpan: 140, waterDetail: 2, mist: 5, surfaceDetail: 1,
    drawDistance: 1100, air: 0.8, post: 'cinematic',
  },
  ultra: {
    label: 'Ultra', pixelRatio: 2, minRatio: 1.25, shadows: true, shadowSize: 4096, shadowSpan: 70, waterSegments: 360, rain: 1800,
    fishDensity: 1, fishNear: 32, plants: 0.85, particles: 1000, rays: 8, caustics: 1.5, simRadius: 130,
    reflection: 0.75, reflectEvery: 1, ripples: 2048, rippleSpan: 120, waterDetail: 2, mist: 4, surfaceDetail: 1,
    drawDistance: 850, air: 0.9, post: 'ultra',
  },
  high: {
    label: 'High', pixelRatio: 1.75, minRatio: 0, shadows: true, shadowSize: 2048, shadowSpan: 55, waterSegments: 300, rain: 1400,
    fishDensity: 1, fishNear: 22, plants: 0.67, particles: 700, rays: 6, caustics: 1.35, simRadius: 110,
    reflection: 0.5, reflectEvery: 1, ripples: 1024, rippleSpan: 96, waterDetail: 2, mist: 3, surfaceDetail: 1,
    drawDistance: 650, air: 1, post: null,
  },
  medium: {
    label: 'Medium', pixelRatio: 1.25, minRatio: 0, shadows: true, shadowSize: 1024, shadowSpan: 55, waterSegments: 200, rain: 900,
    fishDensity: 0.75, fishNear: 18.5, plants: 0.43, particles: 400, rays: 3, caustics: 1, simRadius: 90,
    reflection: 0.33, reflectEvery: 2, ripples: 512, rippleSpan: 72, waterDetail: 1, mist: 2, surfaceDetail: 1,
    drawDistance: 650, air: 1, post: null,
  },
  low: {
    label: 'Low', pixelRatio: 1, minRatio: 0, shadows: false, shadowSize: 1024, shadowSpan: 55, waterSegments: 120, rain: 500,
    fishDensity: 0.5, fishNear: 15, plants: 0.23, particles: 150, rays: 0, caustics: 0, simRadius: 70,
    reflection: 0, reflectEvery: 1, ripples: 0, rippleSpan: 72, waterDetail: 0, mist: 1, surfaceDetail: 0,
    drawDistance: 650, air: 1, post: null,
  },
};
// reflection: resolution of the mirrored view (fraction of the screen; 0 = sky colours only),
// reflectEvery: refresh it every n frames, ripples: ripple field texture size (0 = drawn rings),
// waterDetail: extra wave layers and sun glints, mist: layers of morning mist,
// surfaceDetail: grain on sand, wood and rods, plants: the share of the grass and weed drawn.

export const CHOICES = ['auto', 'cinematic', 'ultra', 'high', 'medium', 'low'];
export const LEVELS = ['low', 'medium', 'high', 'ultra'];
// The levels Auto chooses between (it never picks Ultra or Cinematic by itself).
export const AUTO_LEVELS = ['low', 'medium', 'high'];

// The parts of a preset that Settings lets you choose on their own. Each one can follow the
// preset ('auto') or be set to low, medium, high or ultra; shadows are simply on or off.
export const GROUPS = {
  water: { label: 'Water and reflections', keys: ['waterSegments', 'reflection', 'reflectEvery', 'ripples', 'rippleSpan', 'waterDetail'],
    desc: 'How finely the water moves, and how clearly it mirrors the sky and shore. The biggest cost on most devices.' },
  plants: { label: 'Vegetation', keys: ['plants'],
    desc: 'How dense the grass, reeds and underwater weed beds are drawn. Fish still find the same weed beds.' },
  particles: { label: 'Particles and rain drops', keys: ['rain', 'particles', 'mist'],
    desc: 'Raindrops, drifting specks underwater and layers of morning mist.' },
  underwater: { label: 'Underwater effects', keys: ['rays', 'caustics'],
    desc: 'Light shafts and dancing light on the seabed.' },
  life: { label: 'Visible fish', keys: ['fishDensity', 'fishNear', 'simRadius'],
    desc: 'How many distant fish are drawn, and how far away fish move every frame. Fish near you, bites, catches and the fish finder are the same at every level.' },
};

// The final graphics settings: a preset level, with any parts chosen separately.
// g = settings.graphics: { group: 'auto'|'low'|'medium'|'high', shadows: 'auto'|'on'|'off', scale }
export function resolveQuality(level, g = {}) {
  const q = { ...PRESETS[level] };
  for (const [id, grp] of Object.entries(GROUPS)) {
    const pick = g[id];
    if (LEVELS.includes(pick)) for (const k of grp.keys) q[k] = PRESETS[pick][k];
  }
  if (g.shadows === 'on') Object.assign(q, { shadows: true, shadowSize: Math.max(1024, q.shadowSize) });
  if (g.shadows === 'off') q.shadows = false;
  q.scale = typeof g.scale === 'number' ? Math.min(1, Math.max(0.5, g.scale)) : 1;
  return q;
}

const DOWN = { cinematic: 'ultra', ultra: 'high', high: 'medium', medium: 'low' };
export const lowerLevel = (level) => DOWN[level] || null;

// Phones and tablets start one step down; everything else starts at high.
export const startingLevel = (touch) => (touch ? 'medium' : 'high');

export class FrameWatch {
  constructor() {
    this.reset();
  }

  reset(delay = 5) {
    this.wait = delay;
    this.frames = 0;
    this.time = 0;
  }

  // True when the last four seconds averaged under `limit` fps.
  tooSlow(rawDt, limit = 42) {
    if (rawDt > 0.25) return false; // the tab was hidden or the page hitched; not a fair sample
    if (this.wait > 0) {
      this.wait -= rawDt;
      return false;
    }
    this.frames++;
    this.time += rawDt;
    if (this.time < 4) return false;
    const fps = this.frames / this.time;
    this.frames = 0;
    this.time = 0;
    return fps < limit;
  }
}
