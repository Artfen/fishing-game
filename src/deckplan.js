// Deck plans (L3 of docs/LIVEABOARD.md): where you can walk aboard a boat with decks and rooms at
// different heights (the trawler's), all in her own frame (x to port, z forward, y up from her
// keel), so you go where she goes, pitching and rolling with her.
//
// A plan is a handful of floors, each a convex shape on the plan (her own x, z) with a height (a
// number, or a function of where you are on it: a deck following her sheer, a doorway's step up);
// furniture to walk round (boxes on the plan, each on one floor: { box, floor }); and spots, the places where something's done (her
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
// id), otherwise the one nearest the height you're at (nearY: where floors lie one over another,
// the cabins under the pilothouse), or the first; null where nothing is (over the side, in a
// wall, in the furniture).
export function floorAt(plan, x, z, prev = null, nearY = null) {
  let f = null;
  // (A floor may come in pieces under one id, a side deck following her curve.)
  if (prev) for (const g of plan.floors) if (g.id === prev && inPoly(g.poly, x, z)) f = g;
  if (!f) {
    let bd = Infinity;
    for (const g of plan.floors) {
      if (!inPoly(g.poly, x, z)) continue;
      const d = nearY == null ? 0 : Math.abs(heightOf(g, x, z) - nearY);
      if (d < bd) {
        bd = d;
        f = g;
      }
      if (nearY == null) break;
    }
  }
  // (The furniture on it: what's on the floor above isn't in the way below.)
  if (f && plan.blocks?.some((b) => b.floor === f.id && inBox(b.box, x, z))) return null;
  return f;
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
    const g = floorAt(plan, nx, nz, fl.id, heightOf(fl, x, z));
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

// The nearest place you can stand to (x, z) (at about height y, if given: below, or above),
// looking outward in rings (someone stepping aboard at a rail, a save from before a wall was
// there): { x, z, floor, y }.
export function nearestOn(plan, x, z, y = null) {
  for (let r = 0; r <= 4; r += 0.1) {
    for (let a = 0; a < Math.PI * 2; a += r ? 0.1 / r : 7) {
      const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r, f = floorAt(plan, px, pz, null, y);
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
  // (And by floor: the cabins below lie under the pilothouse, at the same x and z.)
  const key = (x, z, f) => `${Math.round((x - from.x) / h)},${Math.round((z - from.z) / h)},${f}`;
  const start = floorAt(plan, from.x, from.z, from.floor);
  if (!start) return false;
  const seen = new Set([key(from.x, from.z, start.id)]), queue = [{ x: from.x, z: from.z, floor: start.id }];
  while (queue.length) {
    const p = queue.shift();
    if (Math.hypot(p.x - to.x, p.z - to.z) < h * 1.5 && (!to.floor || p.floor === to.floor)) return true;
    for (const [ux, uz] of [[h, 0], [-h, 0], [0, h], [0, -h]]) {
      const q = step(plan, p, ux, uz);
      const k = key(q.x, q.z, q.floor);
      if (seen.has(k) || Math.hypot(q.x - p.x, q.z - p.z) < h * 0.5) continue;
      seen.add(k);
      queue.push(q);
    }
    if (seen.size > 60000) return false;
  }
  return false;
}

// The trawler's plan (H: her hull, boat.js HULLS.trawler; the places on her that her model and
// her plan share: trawlerPlaces). Her main deck follows her sheer from the aft deck to the bow; her
// pilothouse sole is level, up a step from the side decks through a door each side; her swim
// platform is down from the aft deck through the gate in her transom, to port. Inside (L4): the
// saloon through the sliding door off the aft deck (the galley, the dinette, the settee, the
// engine-room hatch in its sole); steps up from it into the pilothouse; and from the pilothouse a
// companionway down to the cabins under it and the foredeck (the guest cabin and its bunks, the
// heads, and forward the owner's cabin with the double berth). Floors inside are marked inside;
// those below, below too (the camera goes to your eyes down there).
//
// Where you can stand keeps clear of her walls by CLEAR (m) on every side, so that in first person
// your eyes (a hand ahead of you) never come up against one: a doorway's floor is narrower than
// the doorway.
export const CLEAR = 0.2;
export function trawlerPlan(H) {
  const P = trawlerPlaces(H), hw = (t) => H.B * H.hw(Math.min(1, Math.max(0, t)));
  const tOf = (z) => (z + H.L / 2) / H.L;
  const deck = (x, z) => H.D + H.sheer(Math.min(1, Math.max(0, tOf(z)))) - P.deckDrop;
  const inner = (z) => hw(tOf(z)) - 0.14; // (inside her bulwarks)
  const quad = (x0, z0, x1, z1) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
  const C = CLEAR;
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
  // The house: its sides (outside: the side decks are narrow, so half as clear of it as inside),
  // its after end; the pilothouse inside its walls.
  const out = P.house + 0.035 + C * 0.5, aftEnd = P.saloonAft - 0.035 - C, pIn = P.pilotW - 0.035 - C;
  const slope = (y0, y1, z0, z1) => (x, z) => y0(x) + (y1(x) - y0(x)) * Math.min(1, Math.max(0, (z - z0) / (z1 - z0)));
  const floors = [
    // The aft deck: between the side lockers, and full width forward of them, up to the saloon.
    { id: 'aft', poly: quad(-P.lockerIn, P.benchFront, P.lockerIn, aftEnd), y: deck },
    { id: 'aftfwd', poly: [[-inner(P.lockerFwd), P.lockerFwd], [inner(P.lockerFwd), P.lockerFwd], [inner(aftEnd), aftEnd], [-inner(aftEnd), aftEnd]], y: deck },
    // The side decks, beside the house from the aft deck to past the pilothouse's front (and the
    // lean of its windscreen out over them).
    ...side('port', 1, aftEnd - 0.3, P.pilotFront + 0.37, out),
    ...side('stbd', -1, aftEnd - 0.3, P.pilotFront + 0.37, out),
    // The foredeck: either side of the trunk, then across forward of it to the windlass.
    ...side('foreport', 1, P.pilotFront + 0.25, P.trunkFwd + 0.15, P.trunkW + 0.12),
    ...side('forestbd', -1, P.pilotFront + 0.25, P.trunkFwd + 0.15, P.trunkW + 0.12),
    { id: 'bow', poly: [[-inner(P.trunkFwd + 0.12), P.trunkFwd + 0.12], [inner(P.trunkFwd + 0.12), P.trunkFwd + 0.12], [inner(P.bowEnd), P.bowEnd], [-inner(P.bowEnd), P.bowEnd]], y: deck },
    // The pilothouse sole, round the openings in it for the steps up from the saloon and the
    // companionway down (in pieces, one id), and a doorway each side up to it from the side decks.
    ...pilotSole(P, pIn, P.pilotAft + 0.035 + C, P.pilotFront - 0.035 - C).map((poly) => ({ id: 'pilot', poly, y: P.sole, inside: true })),
    ...[1, -1].map((sd) => ({
      id: sd > 0 ? 'doorport' : 'doorstbd',
      poly: quad(sd > 0 ? pIn - 0.05 : -out - 0.05, P.door[0] + C * 0.5, sd > 0 ? out + 0.05 : -pIn + 0.05, P.door[1] - C * 0.5),
      // (Up the step as you come in: a ramp across the doorway's sill, level with the sole where
      // the two overlap, so stepping from one to the other either way is no jump.)
      y: (x, z) => {
        const u = Math.min(1, Math.max(0, (Math.abs(x) - pIn) / (out - pIn)));
        return P.sole + (deck(x, z) - P.sole) * u;
      },
      inside: true,
    })),
    // Down through the gate in her transom (to port) to the swim platform.
    { id: 'gate', poly: quad(P.gate[0] + 0.1, P.platform[1] - 0.2, P.gate[1] - 0.1, P.benchFront + 0.05), y: (x, z) => {
      const u = Math.min(1, Math.max(0, (P.benchFront + 0.05 - z) / (P.benchFront + 0.05 - (P.platform[1] - 0.2))));
      return deck(x, P.benchFront) + (P.platformY - deck(x, P.benchFront)) * u;
    } },
    { id: 'platform', poly: quad(-P.platform[2], P.platform[0], P.platform[2], P.platform[1]), y: P.platformY },
    // Inside (L4). The saloon, in through the sliding door off the aft deck (level with it).
    { id: 'saloon', poly: quad(-(P.house - 0.035 - C), P.saloonAft + 0.035 + C, P.house - 0.035 - C, P.pilotAft - 0.035 - C), y: deck, inside: true },
    { id: 'slide', poly: quad(P.slide[0] + C * 0.6, aftEnd - 0.1, P.slide[1] - C * 0.6, P.saloonAft + 0.035 + C + 0.1), y: deck, inside: true },
    // Up the steps at its forward end, through the doorway in the pilothouse's back, onto its sole.
    { id: 'steps', poly: quad(P.steps[0] + C * 0.6, P.steps[1], P.steps[2] - C * 0.6, P.steps[3] + 0.05), inside: true,
      y: slope((x) => deck(x, P.steps[1]), () => P.sole, P.steps[1], P.steps[3]) },
    // Down the companionway from the pilothouse (to port, descending forward) to the cabins: the
    // foot of it runs on into the lobby.
    { id: 'stair', poly: quad(P.stair[0] + 0.1, P.stair[1] - 0.05, P.stair[2] - 0.1, belowRooms(P).lobby[1] + 0.05), inside: true, below: true,
      y: slope(() => P.sole, () => P.low, P.stair[1], P.stair[3]) },
    // Below: the lobby at the companionway's foot, and a door off it into each cabin and the heads.
    ...Object.entries(belowRooms(P)).map(([id, b]) => ({ id, poly: box(b), y: P.low, inside: true, below: true })),
  ];
  // The furniture: in the pilothouse her console, the chart table, the helm chair; the windlass; in
  // the saloon the galley, the dinette and the settee.
  const blocks = [['pilot', P.console], ['pilot', P.chart], ['pilot', P.chair], ['bow', P.windlass], ['saloon', P.galley], ['saloon', P.dinette], ['saloon', P.sofa]]
    .map(([floor, b]) => ({ floor, box: b }));
  const R = belowRooms(P), mid = (b) => [(b[0] + b[2]) / 2, (b[1] + b[3]) / 2];
  const spots = [
    { id: 'helm', x: P.helm[0], z: P.helm[1], r: 0.5, floor: 'pilot' },
    { id: 'fish', x: 0, z: (P.benchFront + P.saloonAft) / 2, r: 1.2 },
    { id: 'platform', x: 0, z: (P.platform[0] + P.platform[1]) / 2, r: 1.2, floor: 'platform' },
    // (L4: inside.)
    { id: 'galley', x: P.galley[0] - 0.3, z: (P.galley[1] + P.galley[3]) / 2, r: 0.5, floor: 'saloon' },
    { id: 'dinette', x: P.dinette[2] + 0.25, z: (P.dinette[1] + P.dinette[3]) / 2, r: 0.5, floor: 'saloon' },
    { id: 'engine', x: (P.hatch[0] + P.hatch[2]) / 2, z: (P.hatch[1] + P.hatch[3]) / 2, r: 0.4, floor: 'saloon' },
    { id: 'chart', x: (P.chart[0] + P.chart[2]) / 2, z: P.chart[3] + 0.2, r: 0.3, floor: 'pilot' },
    { id: 'bunks', x: mid(R.guest)[0], z: mid(R.guest)[1], r: 0.9, floor: 'guest' },
    { id: 'heads', x: mid(R.heads)[0], z: mid(R.heads)[1], r: 0.45, floor: 'heads' },
    { id: 'berth', x: 0, z: R.owner[3] - 0.3, r: 0.5, floor: 'owner' },
  ];
  // (No floor joins another more than a short step up or down: every change of level is a ramp,
  // a stair or a sill, so a step this high is never needed.)
  return { floors, blocks, spots, step: 0.35, places: P };
}

// A box on the plan [x0, z0, x1, z1] as a shape.
const box = ([x0, z0, x1, z1]) => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];

// The pilothouse sole round its openings (the steps up from the saloon, starboard of the middle;
// the companionway down, to port of them): in convex pieces. x1: its half-width; z0, z1: its ends.
// (Its model, the sole's boards, the same at her walls: boat.js.)
export function pilotSole(P, x1, z0, z1) {
  const x0 = -x1, [sx0, , , sz1] = P.steps, [cx0, cz0, cx1, cz1] = P.stair;
  return [
    box([x0, z0, sx0, z1]),        // to starboard of the steps, the length of it (her wheel)
    box([sx0, sz1, cx0, z1]),      // forward of the steps
    box([cx0, z0, cx1, cz0]),      // aft of the companionway
    box([cx0, cz1, cx1, z1]),      // forward of it (the chart table)
    box([cx1, z0, x1, z1]),        // to port of it, the length of her (the port door)
  ].filter(([[a, b], , [c, d]]) => c > a + 0.01 && d > b + 0.01);
}

// Where you stand below: each cabin's sole inside its bulkheads (P.below, the model's), by CLEAR;
// and each doorway's, narrower than its door, bridging the two either side.
export function belowRooms(P) {
  const W = P.below, C = CLEAR;
  return {
    lobby: [W.guestIn + C, W.headsFront + C, W.port - C, W.ownerAft - C],
    guest: [W.bunksIn, W.aft + C, W.guestIn - C, W.ownerAft - C],
    guestdoor: [W.guestIn - C - 0.05, W.guestDoor[0] + C * 0.6, W.guestIn + C + 0.05, W.guestDoor[1] - C * 0.6],
    heads: [W.headsIn + C * 0.7, W.aft + C, W.port - C * 0.7, W.headsFront - C],
    headsdoor: [W.headsDoor[0] + C * 0.4, W.headsFront - C - 0.05, W.headsDoor[1] - C * 0.4, W.headsFront + C + 0.05],
    owner: [-W.ownerHalf, W.ownerAft + C, W.ownerHalf, W.berthAft],
    ownerdoor: [W.ownerDoor[0] + C * 0.8, W.ownerAft - C - 0.05, W.ownerDoor[1] - C * 0.8, W.ownerAft + C + 0.05],
  };
}

// The places on the trawler her model (boat.js buildTrawler) and her plan both use: the aft deck's
// bench and lockers, the house (its sides, ends and doors), the pilothouse (its sole, doors,
// console, chart table, helm chair, the openings in its sole), the trunk and the windlass, the gate
// in her transom and the swim platform; inside (L4), the saloon's furniture and below, the
// bulkheads of the cabins. These are where her walls and furniture are; where you stand is her
// plan's, kept clear of them.
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
    // The house: the saloon's sides (half-width, the walls' middles) and its after end; the
    // pilothouse from the saloon's forward end to its front, its sides; their walls 0.07 thick.
    house: 1.55, saloonAft: -4.3, pilotAft: -0.3, pilotFront: 2.3, pilotW: 1.5,
    door: [0.62, 1.28],                  // the pilothouse doors, along her
    console: [hx - 0.45, cz - 0.27, hx + 0.45, cz + 0.27],
    chart: [0.35, 1.4, 1.05, 1.8],
    chair: [hx - 0.27, hz - 0.77, hx + 0.27, hz - 0.23],
    trunkW: 1.05, trunkFwd: 4.75,        // the trunk over the cabins: half-width, forward end
    windlass: [-0.25, 5.3, 0.25, 5.8],
    bowEnd: 5.25,
    gate: [0.8, 1.4],                    // the gate in her transom, to port (x)
    platform: [zt - 1.65, zt - 0.05, 1.8], // the swim platform: z from, to; half its width
    platformY: H.draft + 0.32,           // its top, up
    // (L4) Inside. Boxes on the plan are [x0, z0, x1, z1] (x to port).
    slide: [-0.08, 0.78],                // the sliding door's opening (x), in the saloon's after end
    galley: [0.88, -3.95, 1.48, -2.35],  // the galley counter along her port side
    dinette: [-1.48, -2.95, -0.62, -1.45], // the dinette to starboard: its seats and table
    sofa: [0.98, -1.95, 1.48, -0.75],    // the settee to port, forward
    hatch: [-0.35, -1.6, 0.35, -0.9],    // the engine-room hatch in the saloon sole
    steps: [-0.4, -0.6, 0.35, 0.35],     // up from the saloon into the pilothouse (rising forward),
                                         // through its doorway (x0 to x1)
    stair: [0.35, 0.05, 0.95, 1.35],     // the companionway down to the cabins (descending forward)
    low: 0.4,                            // the cabins' sole, up from her keel
    // The cabins' bulkheads and linings: x of the guest cabin's inboard side, her sides' linings,
    // the heads' inboard side; z of the aft bulkhead, the heads' front, the owner's cabin's after
    // bulkhead; the doors in them; the bunks' inboard edge, the owner's sole's half-width and where
    // the berth begins (and ends: berth).
    below: {
      guestIn: -0.25, port: 1.47, stbd: -1.47, headsIn: 0.97, aft: 0.0, headsFront: 1.3, ownerAft: 2.65,
      voidZ: 1.15,                       // the space under the steps, closed off from the lobby
      guestDoor: [1.6, 2.3], headsDoor: [1.05, 1.42], ownerDoor: [-0.35, 0.35],
      bunksIn: -0.88, ownerHalf: 0.55, berthAft: 3.75,
    },
    berth: 5.3,
  };
}
