// Fishing pressure: the fish you keep from a place, remembered for a while.
//
// Every fish kept (rod or speargun) adds to the pressure on the stretch of water it came from, a
// cell about fifty metres across (half as much to the cells round it). Pressure fades as the hours
// go by, by the world's clock, so a night's sleep or a day elsewhere lets a place recover. While
// it's up, the fish that would replace the ones taken are slower to turn up (see ecosystem.js:
// keep), and the fish still there are warier: a spot fished hard fishes slower, and an angler who
// notices moves on, and comes back later to find it full again. Nothing here is saved: the sea
// starts each visit rested.

export const CELL = 50;     // metres across a cell
const FADE = 14;            // game hours for pressure to fall to about a third
export const HEAVY = 3.5;   // the pressure at which a spot counts as fished hard

const keyOf = (i, j) => `${i},${j}`;

export class Pressure {
  constructor() {
    this.cells = new Map(); // key -> { v, at } (v as it was at `at`, game hours)
  }

  cellLevel(i, j, abs) {
    const c = this.cells.get(keyOf(i, j));
    return c ? c.v * Math.exp(-Math.max(0, abs - c.at) / FADE) : 0;
  }

  // How hard the water at (x, z) has been fished lately (0: rested; a fish or two: 1-2; HEAVY+).
  level(x, z, abs) {
    if (!this.cells.size) return 0;
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    let v = this.cellLevel(i, j, abs);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) if (di || dj) v += 0.25 * this.cellLevel(i + di, j + dj, abs);
    }
    return v;
  }

  // A fish kept from (x, z) at abs (game hours). Returns the pressure there now.
  add(x, z, abs, amount = 1) {
    const i = Math.floor(x / CELL), j = Math.floor(z / CELL);
    for (let di = -1; di <= 1; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const k = keyOf(i + di, j + dj), w = di || dj ? amount * 0.5 : amount;
        const now = this.cellLevel(i + di, j + dj, abs);
        this.cells.set(k, { v: now + w, at: abs });
      }
    }
    // (Long-rested cells are forgotten.)
    if (this.cells.size > 400) for (const [k, c] of this.cells) if (c.v * Math.exp(-(abs - c.at) / FADE) < 0.05) this.cells.delete(k);
    return this.level(x, z, abs);
  }
}

// How much longer a kept fish's replacement takes where the pressure is `level` (×1 rested, up to
// ×6 on a spot fished very hard).
export const restockFactor = (level) => Math.min(6, 1 + 0.6 * level);

// How much warier the fish are there (added to the disturbance they feel: 0 … 0.45).
export const pressureWariness = (level) => Math.min(0.45, Math.max(0, level - 1) * 0.08);
