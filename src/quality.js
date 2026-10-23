// Graphics presets. "auto" starts from a sensible guess for the device and
// steps down a level if the frame rate keeps struggling.
// The underwater world scales too: how many fish swim (fishDensity), how dense the weed
// beds are (plants), drifting particles, light shafts, caustics and the active fish radius.
export const PRESETS = {
  high: {
    label: 'High', pixelRatio: 1.75, shadows: true, shadowSize: 2048, waterSegments: 300, rain: 1400,
    fishDensity: 1, plants: 1, particles: 700, rays: 6, caustics: 1.35, simRadius: 110,
    reflection: 0.5, reflectEvery: 1, ripples: 1024, rippleSpan: 96, waterDetail: 2, mist: 3, surfaceDetail: 1,
  },
  medium: {
    label: 'Medium', pixelRatio: 1.25, shadows: true, shadowSize: 1024, waterSegments: 200, rain: 900,
    fishDensity: 0.75, plants: 0.65, particles: 400, rays: 3, caustics: 1, simRadius: 90,
    reflection: 0.33, reflectEvery: 2, ripples: 512, rippleSpan: 72, waterDetail: 1, mist: 2, surfaceDetail: 1,
  },
  low: {
    label: 'Low', pixelRatio: 1, shadows: false, shadowSize: 1024, waterSegments: 120, rain: 500,
    fishDensity: 0.5, plants: 0.35, particles: 150, rays: 0, caustics: 0, simRadius: 70,
    reflection: 0, reflectEvery: 1, ripples: 0, rippleSpan: 72, waterDetail: 0, mist: 1, surfaceDetail: 0,
  },
};
// reflection: resolution of the mirrored view (fraction of the screen; 0 = sky colours only),
// reflectEvery: refresh it every n frames, ripples: ripple field texture size (0 = drawn rings),
// waterDetail: extra wave layers and sun glints, mist: layers of morning mist,
// surfaceDetail: grain on sand, wood and rods.

export const CHOICES = ['auto', 'high', 'medium', 'low'];
export const LEVELS = ['low', 'medium', 'high'];

// The parts of a preset that Settings lets you choose on their own. Each one can follow the
// preset ('auto') or be set to low, medium or high; shadows are simply on or off.
export const GROUPS = {
  water: { label: 'Water and reflections', keys: ['waterSegments', 'reflection', 'reflectEvery', 'ripples', 'rippleSpan', 'waterDetail'],
    desc: 'How finely the water moves, and how clearly it mirrors the sky and shore. The biggest cost on most devices.' },
  plants: { label: 'Vegetation', keys: ['plants'],
    desc: 'How dense the grass, reeds and underwater weed beds are drawn. Fish still find the same weed beds.' },
  particles: { label: 'Particles and rain drops', keys: ['rain', 'particles', 'mist'],
    desc: 'Raindrops, drifting specks underwater and layers of morning mist.' },
  underwater: { label: 'Underwater effects', keys: ['rays', 'caustics'],
    desc: 'Light shafts and dancing light on the seabed.' },
  life: { label: 'Visible fish', keys: ['fishDensity', 'simRadius'],
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

const DOWN = { high: 'medium', medium: 'low' };
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
