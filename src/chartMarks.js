// What a chart shows a skipper (C of docs/WORLD-DEPTH.md): the buoys that mark the channels and
// the dangers, the harbours, and the anchorages out of the wind. The same marks the world has in
// the water (world/regions.js lays its buoys from here; the dive sites' buoys are their own).
//
// kind: port (a red can, kept to port coming in from the sea), starboard (a green cone), special
// (a yellow mark: a shoal or a dive site), harbour, anchorage.
import { RIVER, SHOAL, PUFFIN_COVE, COVE, HAVEN, QUAY, PLACES } from './world/terrain.js';
import { DIVE_SITES } from './world/divesites.js';

const mouth = RIVER[RIVER.length - 1];

// The buoys to steer by (laid in the water by world/regions.js).
export const BUOYS = [
  { kind: 'port', name: 'Wend Bar, red can', x: mouth[0] - 70, z: mouth[1] - 10 },
  { kind: 'starboard', name: 'Wend Bar, green cone', x: mouth[0] + 60, z: mouth[1] - 30 },
  { kind: 'special', name: 'The Shoal, yellow mark', x: SHOAL.x, z: SHOAL.z - SHOAL.rz - 12 },
  { kind: 'port', name: 'Puffin Cove, red can', x: PUFFIN_COVE.x + 10, z: PUFFIN_COVE.z - 70 },
];

// Everything charted: the buoys, the dive sites' buoys, the harbours and the anchorages.
export const MARKS = [
  ...BUOYS,
  ...DIVE_SITES.filter((s) => s.buoy && !s.south).map((s) => ({ kind: 'special', name: `${PLACES.find((p) => p.id === s.id)?.name || s.id}, dive buoy`, x: s.buoy.x, z: s.buoy.z })),
  { kind: 'harbour', name: 'Willowhaven', x: HAVEN.x, z: HAVEN.z },
  { kind: 'harbour', name: 'Wend Quay', x: (QUAY.x0 + QUAY.x1) / 2, z: (QUAY.z0 + QUAY.z1) / 2 },
  { kind: 'anchorage', name: 'Driftwood Cove', x: COVE.x, z: COVE.z },
  { kind: 'anchorage', name: 'Puffin Cove', x: PUFFIN_COVE.x, z: PUFFIN_COVE.z },
];
