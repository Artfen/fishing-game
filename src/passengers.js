// The people a charter takes out (see contracts.js), sitting in your boat: on the thwarts of the
// rowing boat, the RIB's tubes, the yacht's cockpit. Each one is a figure like the harbour's people
// (folk.js), carried in her hull so they rise and roll with her, sat where there's room for them:
// not on top of you at the helm or the oars, not inside a cabin. Divers sit in their black suits.
//
// Only to look at: what they weigh is in her payload (main.js), how they find the sea is in
// contracts.js (misery, a rough trip).

import { Figure } from './world/folk.js';
import { lookFor } from './world/visitors.js';

const DIVER = { coat: '#1b1f24', legs: '#1b1f24', boots: '#111316', hat: 'hair' };
// (The hull's half-width at t along her, 0 at the transom to 1 at the stem, as boat.js draws her.)
const widthAt = (hull, t) => hull.B * (hull.hw ? hull.hw(t) : Math.pow(Math.sin(Math.PI * (0.15 + 0.85 * t)), 0.5));

// Where n people sit in hull `hull` (boat.js's numbers): up to n spots { x, z } in her own frame
// (x to port, z forward from her middle), the ones nearest the cockpit aft first.
export function seatsFor(hull, n) {
  if (n <= 0) return [];
  const L = hull.L, out = [];
  const helmX = hull.standing?.helm?.[0] ?? 0, helmZ = hull.standing?.helm?.[1] ?? hull.seatZ ?? 0;
  const inCabin = (z) => hull.cabin && z > (hull.cabin[0] - 0.5) * L - 0.3 && z < (hull.cabin[1] - 0.5) * L + 0.3;
  for (let z = -L / 2 + 0.75; z <= L / 2 - 0.8; z += 0.8) {
    const t = z / L + 0.5, w = widthAt(hull, t);
    if (w < 0.32 || inCabin(z)) continue;
    // Two abreast where she's wide enough (along each side, clear of a console in the middle),
    // three in a big cockpit, otherwise one on the centreline.
    const xs = w >= 1.2 ? [w - 0.33, 0, -(w - 0.33)] : w >= 0.75 ? [w - 0.33, -(w - 0.33)] : [0];
    for (const x of xs) {
      // (Not at the helm or the oars, nor at the console ahead of it, nor in the fighting chair.)
      if (Math.hypot(x - helmX, z - helmZ) < 0.75) continue;
      const chair = hull.standing?.chair;
      if (chair && Math.hypot(x - chair[0], z - chair[1]) < 0.7) continue;
      if (hull.console && Math.abs(x) < 0.5 && Math.abs(z - helmZ - 0.6) < 0.7) continue;
      out.push({ x, z });
    }
  }
  // (A jet ski's one passenger sits astride behind you.)
  if (!out.length && L < 3.5) out.push({ x: 0, z: helmZ - 0.55 });
  const aft = helmZ - 1;
  out.sort((a, b) => Math.abs(a.z - aft) - Math.abs(b.z - aft) || b.x - a.x);
  return out.slice(0, n);
}

export class Passengers {
  constructor() {
    this.boat = null;
    this.key = '';
    this.figs = [];   // { figure, x, z }
  }

  // Who's aboard which boat now: boat (a Boat, or null), groups: [{ id, n, divers }] (one per job).
  set(boat, groups = []) {
    const key = boat ? `${boat.kind}|${groups.map((g) => `${g.id}:${g.n}:${g.divers ? 1 : 0}:${g.folk || ''}`).join(',')}` : '';
    if (key === this.key) return;
    this.clear();
    this.key = key;
    if (!boat || !groups.length) return;
    this.boat = boat;
    const total = groups.reduce((s, g) => s + g.n, 0), spots = seatsFor(boat.hull, total);
    let i = 0;
    for (const g of groups) {
      for (let k = 0; k < g.n && i < spots.length; k++, i++) {
        // (One of the harbour's own people, in their own look; or someone from away.)
        const figure = g.folk ? new Figure(g.folk) : new Figure(`passenger:${g.id}:${k}`, { ...lookFor(`${g.id}#${k}`), ...(g.divers ? DIVER : {}) });
        boat.body.add(figure.group);
        this.figs.push({ figure, ...spots[i] });
      }
    }
  }

  clear() {
    for (const f of this.figs) f.figure.dispose();
    this.figs = [];
    this.boat = null;
    this.key = '';
  }

  get count() { return this.figs.length; }

  // Each frame: sat facing forward, looking about now and then.
  update(dt, t) {
    if (!this.boat) return;
    const y = this.boat.hull.floorY ?? 0.1;
    for (const f of this.figs) f.figure.update(dt, t, { act: 'sit', pos: { x: f.x, z: f.z }, yaw: 0 }, y);
  }
}
