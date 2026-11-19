// Fish of the home coast that live in the north too (docs/NORTH.md): cold-water fish, in the
// north's waters (north.js NORTH_ZONES: the kelp, Raven Sound, the Churn, Loch Skarn, the Selkie
// Rocks, the open Atlantic outside) and on its homes. (fish.js adds them to each species, as it
// does Las Brasas'.) where: what the journal says of it there.
export const AT_NORTH = {
  pollack: { zones: ['kelp', 'sound', 'race', 'outer', 'skerry'], where: 'Up the coast in the Selkie Isles, over the kelp and in the Churn’s race, big and bronze.' },
  wrasse: { zones: ['kelp', 'skerry'], where: 'In the Selkie Isles’ kelp, round every rock.' },
  conger: { zones: ['kelp', 'loch', 'outer'], where: 'In the Selkie Isles: in wrecks, and in the walls of Loch Skarn.' },
  catshark: { zones: ['kelp', 'sound', 'loch', 'outer'], where: 'On the sand and mud of Raven Sound and Loch Skarn.' },
  mackerel: { zones: ['sound', 'race', 'outer'], where: 'Round the Selkie Isles in summer, in the sound and the race.' },
  horsemackerel: { zones: ['sound', 'outer'], where: 'In shoals round the Selkie Isles.' },
  thornback: { zones: ['sound', 'loch'], where: 'On the sand of Raven Sound and the mud of Loch Skarn.' },
  plaice: { zones: ['sound'], where: 'On the sand of Raven Sound.' },
  turbot: { zones: ['sound'], where: 'On the sand of Raven Sound.' },
  gurnard: { zones: ['sound'], where: 'On the sand of Raven Sound.' },
  sprat: { zones: ['sound', 'loch', 'outer'], where: 'In shoals in the sound and the loch, for everything else to eat.' },
  corkwing: { zones: ['kelp', 'skerry'], where: 'Among the kelp round the Selkie Isles, and off Halvig pier.' },
  rockgoby: { zones: ['kelp', 'skerry'], where: 'In the rocks round the Selkie Isles, and off Halvig pier.' },
  shanny: { zones: ['kelp', 'skerry'], where: 'In the rocks round the Selkie Isles, and off Halvig pier.' },
};
