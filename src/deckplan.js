// Deck plans (L3 of docs/LIVEABOARD.md): where you can walk aboard a boat with decks and rooms at
// different heights (the trawler's), all in her own frame (x to port, z forward, y up from her
// keel), so you go where she goes, pitching and rolling with her.
//
// A plan is a handful of floors, each a convex shape on the plan (her own x, z) with a height (a
// number, or a function of where you are on it: a deck following her sheer, a doorway's step up);
// furniture to walk round (boxes on the plan); and spots, the places where something's done (her
// wheel, the aft deck to fish from), each a point and a radius on a floor. Walls are what lies
// between floors: you can't step anywhere that isn't on one, so a house's sides are its walls and
// a doorway is a floor of its own bridging the two either side of it.
//
// Pure: no three.js. The boat asks where a step takes you (step), what floor you're on and how
// high (floorAt), and which spot you're at (spotAt).

const EPS = 1e-9;

// Is (x, z) inside a convex polygon [[x, z], …] (either winding)?
export function inPoly(poly, x, z) {
  let sign = 0;
  for (let i = 0; i < poly.length; i++) {
    const [ax, az] = poly[i], [bx, bz] = poly[(i + 1) % poly.length];
    const c = (bx - ax) * (z - az) - (bz - az) * (x - ax);
    if (Math.abs(c) < EPS) continue;
    const s = c > 0 ? 1 : -1;
    if (sign && s !== sign) return false;
    sign = s;
  }
  return true;
}
const inBox = (b, x, z) => x > b[0] && x < b[2] && z > b[1] && z < b[3];

// A floor's height at (x, z).
export const heightOf = (floor, x, z) => (typeof floor.y === 'function' ? floor.y(x, z) : floor.y);

// The floor you'd be standing on at (x, z): the one you're on if it's still under you (prev: its
// id), otherwise the first that is; null where nothing is (over the side, in a wall, in the
// furniture).
export function floorAt(plan, x, z, prev = null) {
  if (plan.blocks?.some((b) => inBox(b, x, z))) return null;
  // (A floor may come in pieces under one id, a side deck following her curve.)
  if (prev) for (const g of plan.floors) if (g.id === prev && inPoly(g.poly, x, z)) return g;
  return plan.floors.find((f) => inPoly(f.poly, x, z)) || null;
}

// A step from where you are (at: { x, z, floor }) by (dx, dz): where it takes you, sliding along a
// wall or round the furniture you walk into rather than stopping dead, and never up or down more
// than a step (plan.step, m) between one floor and the next. Long steps are taken in short ones,
// so nothing thin is walked through. Returns { x, z, floor (its id), y (its height there) }.
export function step(plan, at, dx, dz) {
  let x = at.x, z = at.z, fl = floorAt(plan, x, z, at.floor) || plan.floors[0];
  const n = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.05));
  const sx = dx / n, sz = dz / n, most = plan.step ?? 0.65;
  const can = (nx, nz) => {
    const g = floorAt(plan, nx, nz, fl.id);
    return g && Math.abs(heightOf(g, nx, nz) - heightOf(fl, x, z)) <= most ? g : null;
  };
  for (let i = 0; i < n; i++) {
    let g = can(x + sx, z + sz);
    if (g) {
      x += sx;
      z += sz;
    } else if ((g = can(x + sx, z))) x += sx;
    else if ((g = can(x, z + sz))) z += sz;
    else break;
    fl = g;
  }
  return { x, z, floor: fl.id, y: heightOf(fl, x, z) };
}

// The spot you're at, if any: the nearest whose radius you're inside, on your floor.
export function spotAt(plan, x, z, floor) {
  let best = null, bd = Infinity;
  for (const s of plan.spots || []) {
    if (s.floor && s.floor !== floor) continue;
    const d = Math.hypot(x - s.x, z - s.z);
    if (d < s.r && d < bd) {
      best = s;
      bd = d;
    }
  }
  return best;
}

// The nearest place you can stand to (x, z), looking outward in rings (someone stepping aboard at a
// rail, a save from before a wall was there): { x, z, floor, y }.
export function nearestOn(plan, x, z) {
  for (let r = 0; r <= 4; r += 0.1) {
    for (let a = 0; a < Math.PI * 2; a += r ? 0.1 / r : 7) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, f = floorAt(plan, px, pz);
      if (f) return { x: px, z: pz, floor: f.id, y: heightOf(f, px, pz) };
    }
  }
  const f = plan.floors[0], [px, pz] = f.poly[0];
  return { x: px, z: pz, floor: f.id, y: heightOf(f, px, pz) };
}

// Can you get from one place to another on the plan, a step at a time (a flood over a grid of
// spacing h)? For the tests: every spot reachable from her wheel.
export function reachable(plan, from, to, h = 0.1) {
  // (Keyed from where you start, so the grid's points fall on whole numbers, not halfway between.)
  const key = (x, z) => `${Math.round((x - from.x) / h)},${Math.round((z - from.z) / h)}`;
  const start = floorAt(plan, from.x, from.z);
  if (!start) return false;
  const seen = new Set([key(from.x, from.z)]), queue = [{ x: from.x, z: from.z, floor: start.id }];
  while (queue.length) {
    const p = queue.shift();
    if (Math.hypot(p.x - to.x, p.z - to.z) < h * 1.5) return true;
    for (const [ux, uz] of [[h, 0], [-h, 0], [0, h], [0, -h]]) {
      const q = step(plan, p, ux, uz);
      const k = key(q.x, q.z);
      if (seen.has(k) || Math.hypot(q.x - p.x, q.z - p.z) < h * 0.5) continue;
      seen.add(k);
      queue.push(q);
    }
    if (seen.size > 60000) return false;
  }
  return false;
}

// The trawler's plan (H: her hull, boat.js HULLS.trawler; at: the places on her that her model
// and her plan share, see trawlerPlaces). Her main deck follows her sheer from the aft deck to the
// bow; her pilothouse sole is level, up a step from the side decks through a door each side; her
// swim platform is down from the aft deck through the gate in her transom, to port. (The saloon
// and the cabins below are closed until they're built: L4.)
export function trawlerPlan(H) {
  const P = trawlerPlaces(H), hw = (t) => H.B * H.hw(Math.min(1, Math.max(0, t)));
  const tOf = (z) => (z + H.L / 2) / H.L;
  const deck = (x, z) => H.D + H.sheer(Math.min(1, Math.max(0, tOf(z)))) - P.deckDrop;
  const inner = (z) => hw(tOf(z)) - 0.14; // (inside her bulwarks)
  const quad = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  // A side deck or the foredeck, inside her bulwarks between z0 and z1, from x out to them (sd: 1
  // to port, -1 to starboard): in pieces short enough to follow her curve, each convex, one id.
  const side = (id, sd, z0, z1, x) => {
    const n = Math.max(1, Math.ceil((z1 - z0) / 0.6)), out = [];
    for (let i = 0; i < n; i++) {
      const a = z0 + ((z1 - z0) * i) / n, b = z0 + ((z1 - z0) * (i + 1)) / n;
      out.push({ id, poly: [[sd * x, a], [sd * inner(a), a], [sd * inner(b), b], [sd * x, b]], y: deck });
    }
    return out;
  };
  const floors = [
    // The aft deck: between the side lockers, and full width forward of them.
    { id: 'aft', poly: quad(-P.lockerIn, P.benchFront, P.lockerIn, P.saloonAft), y: deck },
    { id: 'aftfwd', poly: [[-inner(P.lockerFwd), P.lockerFwd], [inner(P.lockerFwd), P.lockerFwd], [inner(P.saloonAft), P.saloonAft], [-inner(P.saloonAft), P.saloonAft]], y: deck },
    // The side decks, beside the house from the aft deck to the foredeck (on past the house's front,
    // clear of its windscreen leaning out over them).
    ...side('port', 1, P.saloonAft - 0.3, P.foreAft + 0.15, P.houseOut),
    ...side('stbd', -1, P.saloonAft - 0.3, P.foreAft + 0.15, P.houseOut),
    // The foredeck: either side of the trunk, then across forward of it to the windlass.
    ...side('foreport', 1, P.foreAft, P.trunkFwd + 0.2, P.trunkOut),
    ...side('forestbd', -1, P.foreAft, P.trunkFwd + 0.2, P.trunkOut),
    { id: 'bow', poly: [[-inner(P.trunkFwd + 0.02), P.trunkFwd + 0.02], [inner(P.trunkFwd + 0.02), P.trunkFwd + 0.02], [inner(P.bowEnd), P.bowEnd], [-inner(P.bowEnd), P.bowEnd]], y: deck },
    // The pilothouse sole, and a doorway each side up to it from the side decks.
    { id: 'pilot', poly: quad(-P.pilotIn, P.pilotAft, P.pilotIn, P.pilotFwd - 0.05), y: P.sole, inside: true },
    ...[1, -1].map((sd) => ({
      id: sd > 0 ? 'doorport' : 'doorstbd',
      poly: quad(sd > 0 ? P.pilotIn - 0.1 : -P.houseOut - 0.05, P.door[0], sd > 0 ? P.houseOut + 0.05 : -P.pilotIn + 0.1, P.door[1]),
      // (Up the step as you come in: a ramp across the doorway's sill, level with the sole where
      // the two overlap, so stepping from one to the other either way is no jump.)
      y: (x, z) => {
        const u = Math.min(1, Math.max(0, (Math.abs(x) - P.pilotIn) / (P.houseOut + 0.05 - P.pilotIn)));
        return P.sole + (deck(x, z) - P.sole) * u;
      },
      inside: true,
    })),
    // Down through the gate in her transom (to port) to the swim platform.
    { id: 'gate', poly: quad(P.gate[0], P.platform[1] - 0.2, P.gate[1], P.benchFront + 0.05), y: (x, z) => {
      const u = Math.min(1, Math.max(0, (P.benchFront + 0.05 - z) / (P.benchFront + 0.05 - (P.platform[1] - 0.2))));
      return deck(x, P.benchFront) + (P.platformY - deck(x, P.benchFront)) * u;
    } },
    { id: 'platform', poly: quad(-P.platform[2], P.platform[0], P.platform[2], P.platform[1]), y: P.platformY },
  ];
  // The furniture in the pilothouse: her console, the chart table, the helm chair; the windlass.
  const blocks = [P.console, P.chart, P.chair, P.windlass];
  const spots = [
    { id: 'helm', x: P.helm[0], z: P.helm[1], r: 0.5, floor: 'pilot' },
    { id: 'fish', x: 0, z: (P.benchFront + P.saloonAft) / 2, r: 1.2 },
    { id: 'saloon', x: P.saloonDoor, z: P.saloonAft - 0.35, r: 0.55 },
    { id: 'platform', x: 0, z: (P.platform[0] + P.platform[1]) / 2, r: 1.2, floor: 'platform' },
  ];
  return { floors, blocks, spots, step: 0.75, places: P };
}

// The places on the trawler her model (boat.js buildTrawler) and her plan both use: the aft deck's
// bench and lockers, the house's sides and ends, the pilothouse (its sole, doors, console, chart
// table, helm chair), the trunk and the windlass, the gate in her transom and the swim platform.
export function trawlerPlaces(H) {
  const S = H.standing, [hx, hz] = S.helm, zt = -H.L / 2, cz = hz + 0.72;
  return {
    deckDrop: 0.7,                       // her main deck, below her sheer
    sole: S.floor,                       // the pilothouse sole
    helm: [hx, hz],
    benchFront: zt + 0.62,               // the front of the transom bench
    bench: [-1.6, 0.55],                 // its ends (x), clear of the gate
    lockerIn: 1.2, lockerZ: [zt + 0.85, zt + 1.75], // the side lockers: inside edge, along her
    lockerFwd: zt + 1.75,                // forward of them, the aft deck runs out to her bulwarks
    saloonAft: -4.3, saloonDoor: 0.35,   // the saloon's after end, its door (x)
    houseOut: 1.6,                       // the house's sides (the side decks' inner edge)
    pilotAft: -0.25, pilotFwd: 2.3, pilotIn: 1.43,
    door: [0.62, 1.28],                  // the pilothouse doors, along her
    console: [hx - 0.45, cz - 0.27, hx + 0.45, cz + 0.27],
    chart: [0.28, 1.38, 1.22, 1.82],
    chair: [hx - 0.27, hz - 0.77, hx + 0.27, hz - 0.23],
    foreAft: 2.6,                        // the foredeck, from forward of the windscreen's lean
    trunkFwd: 4.75, trunkOut: 1.1,
    windlass: [-0.25, 5.3, 0.25, 5.8],
    bowEnd: 5.25,
    gate: [0.8, 1.4],                    // the gate in her transom, to port (x)
    platform: [zt - 1.65, zt - 0.05, 1.8], // the swim platform: z from, to; half its width
    platformY: H.draft + 0.32,           // its top, up
  };
}
