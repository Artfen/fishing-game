// Graphics presets. "auto" starts from a sensible guess for the device and
// steps down a level if the frame rate keeps struggling.
export const PRESETS = {
  high: { label: 'High', pixelRatio: 1.75, shadows: true, shadowSize: 2048, waterSegments: 300, rain: 1400 },
  medium: { label: 'Medium', pixelRatio: 1.25, shadows: true, shadowSize: 1024, waterSegments: 200, rain: 900 },
  low: { label: 'Low', pixelRatio: 1, shadows: false, shadowSize: 1024, waterSegments: 120, rain: 500 },
};

export const CHOICES = ['auto', 'high', 'medium', 'low'];

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

  // True when the last four seconds averaged under 42 fps.
  tooSlow(rawDt) {
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
    return fps < 42;
  }
}
