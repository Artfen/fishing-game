# Slow Tide: the Northern Archipelago

The Selkie Isles: a cold-water archipelago up the coast from Willow Bay, about nine kilometres by
sea. You reach it by sailing out of the bay to the west, past Heron Point and the Calf, round the
Ness, and north along the mainland's west coast under the fells. There is kelp and cold clear
water, a sea loch running deep into the hills, cliffs and a stack white with seabirds, seals on
the skerries, and a hamlet with a stone pier. It's the last of the roadmap's "A liveaboard, her
tender and two archipelagos" (`ROADMAP.md`, step 5); the parts of step 4 ("the world extended")
it needs are built here as part of it.

The brief: **cold water, kelp, fjords, cliffs, seabird colonies**, and the distance worth
sailing: about forty minutes at the trawler's eight knots, two and a half days by the game's
clock, with a fast passage for those who'd rather not.

## Why it's more than the south was

Las Brasas works because of one switch, `z > SOUTH_Z`, set in the open ocean: every edge of
home's textures and fields that clamps there clamps to deep water, so the gap never shows. The
north is different:

- **The coast is continuous.** Willow Bay's land runs north (Hoarfell, the Coldwater) and west
  without end today (`terrain.js` `coastZ`): there is no west coast, no corner to round, and the
  sea along the south coast stops at x = -900 (`SEA`). The boats are pushed back east of -820
  (`boat.js` `edgePush`), and the far land to the west is drawn as hills over what will be sea
  (`world.js` `OUTER`).
- **Home's fish are a Biscay and Iberian set** (`atlantic.js`: "Royan to Cádiz"). Pollack,
  Ballan wrasse, conger, mackerel, the thornback and a few more belong in cold water too; cod,
  saithe, ling and the big skate, the fish such a place is known for, don't exist yet.
- **"Home" often means "near Willowhaven".** Rescues, tows, the fuel pump's words, the offshore
  warnings and fast travel all assume you're within reach of Willowhaven. Eight kilometres up
  the coast, that's wrong.

So the north is a **third region** in its own right: `regionAt(x, z)` gives 'home', 'north' or
'south', and each two-way switch that's about geography (textures, fields, the chart, the edge,
saves) learns the third. Where "home" means the home *market*, the *journal's* waters or the
*season*, the north counts as home.

## The way north

| Leg | Where (x, z) | Distance | What you see |
| --- | --- | --- | --- |
| Out of Willow Bay | (0, 300) to the Calf (-480, 170) | 0.5 km | Heron Point, Calf Sound |
| The south coast west | the Calf to the Ness (-2050, 380) | 1.6 km | Low cliffs, coves, Hoarfell above |
| Round the Ness | | | A high headland, the swell, the coast turning north |
| The west coast | the Ness to the isles (-2450, -4700) | 5.1 km | Cliffs under the fells, waterfalls, a long empty shore |
| Into the isles | to Halvig (-2930, -6180) | 1.6 km | The skerries, the seals, Tern Isle's white sand |

About **8.8 km** from Willowhaven's pontoon to Halvig's pier. North is -z; the mainland's west
coast runs about x = -2200 with headlands and coves.

## The Selkie Isles

| Place | Where (x, z) | What it is | For |
| --- | --- | --- | --- |
| **Raven Isle** | (-3250, -6350), 1.4 by 0.9 km | The big island: high (to 190 m), grey cliffs on its Atlantic west, slopes of grass and heather to the east | The colony, the light, the hamlet |
| **Halvig** | Raven Isle's east shore, facing the sound | A hamlet: a stone pier, a fuel pump, a shop for stores and ice, four crofts, a red phone box | Fuel, stores, a berth: the north's harbour |
| **Raven Sound** | Between Raven Isle and the mainland, about 600 m wide | Sheltered water, 15 to 30 m, sand and kelp | The way in; anchoring |
| **The Churn** | The sound's narrow north end | A tide race over a rock sill: standing waves on the ebb | Pollack, saithe and mackerel; birds working |
| **Raven Head** | Raven Isle's north point | A lighthouse, white, on the cliff top | A landmark; its light at night |
| **The Seal Cave** | Raven Isle's west cliffs | A sea cave you can take a tender into on a calm day | Seals, a find |
| **Skarv Stack** | Off Raven Isle's north-west, (-3950, -7050) | A 60 m stack, white with gannets on top, guillemots and kittiwakes on its ledges | The seabird colony; a dive at its foot |
| **Tern Isle** | (-3750, -5250), 0.8 by 0.5 km | Low, sandy: machair, white shell sand on its east, terns nesting | A beach to land on; the broch; the standing stones |
| **The Broch** | Tern Isle's high ground | The ruin of an iron-age stone tower | A find ashore |
| **The Sula** | Off Tern Isle's south-east, 10 to 18 m | A steel trawler wrecked in the kelp | A wreck dive, with a buoy |
| **The Selkie Rocks** | (-3050, -4900) | Low skerries in the approach, seals hauled out | Seals; the archipelago's name |
| **Loch Skarn** | Into the mainland from (-2250, -5550) to (-700, -5850) | A sea loch, 1.6 km long and 250 m wide: steep sides, a sill at its mouth, 90 m deep inside | Deep-water fish: skate, ling, conger, cod; still water |
| **Bothy Bay** | Loch Skarn's north shore | A sheltered bay, mud and sand at 6 to 10 m, a bothy ashore | The best anchorage; a night ashore |
| **The Herring Station** | Loch Skarn's south shore | The ruins of a curing station and its old timber pier | A find ashore |

## The sea there

- **Colder:** the water about 8 to 13 °C through the year (home's is 12 to 21); the air cool.
- **The wind from the west and south-west** off the Atlantic; the swell from the west. So the
  islands' **west sides are the weather side** (cliffs, broken water) and their **east sides the
  lee** (Halvig, the beaches, the anchorages). Loch Skarn is still water whatever the weather.
- **Kelp** on all the rock from 2 to 15 m; **sand** in the sound and off Tern Isle; **mud** in the
  loch's deep basin; **rock walls** in the loch and round the stack.
- **The tide** runs through Raven Sound and boils over the sill at the Churn.

## Life

Through the habitats, as in the south: the fish homes come from the ground (kelp, rock, sand,
mud, the race), each species where it belongs.

- **New cold-water fish:** **cod** (the kelp edges and the deep), **saithe** (coley: in schools
  in the race and along the cliffs), **ling** (the loch's deep rock and wrecks), the **common
  skate** (the flapper skate: huge, on the loch's mud, catch and release), and **haddock** (sand
  and mud). Each with its look, its fight, its place in the market, the journal and the register.
- **Home's cold-water fish there too:** pollack over the kelp, Ballan wrasse in it, conger in the
  wreck and the loch's walls, mackerel in summer, the thornback on the sand, the catshark,
  plaice, gurnard, sprat as bait.
- **Seals** hauled out on the Selkie Rocks and in the Seal Cave; **otters** in Loch Skarn; a
  **minke whale** in the sound in summer.
- **The seabird colony** on Skarv Stack and Raven Isle's cliffs: gannets, guillemots, razorbills,
  puffins, kittiwakes, fulmars, shags; **terns** on Tern Isle; a **white-tailed eagle** over the
  loch.

The north's fish homes are flagged and placed in their own pass, with their own dice, so
**nothing at home moves** (as the south's are: `habitat.js` `southSpots`, `ecosystem.js`).

## How it's built

**N1, the way north (the world, empty).** Everything that makes the north a place you can sail
to, see and save in, before anything lives there:

- `src/world/north.js`: the north's constants, `regionAt(x, z)`, and the land: the Ness, the
  west coast (cliffs, coves, the fells behind, Hoarfell inland), Loch Skarn, and the islands'
  outlines; its depth, zones (`kelp`, `sound`, `race`, `loch`, `skerries`, `atlantic`), current
  and habitat. Blended into home's land where they meet, outside the land home already draws,
  so **nothing at home changes**.
- **Drawing:** the north's terrain in tiles of coarse sheet, **built as you come and dropped as
  you go** (step 4's idea, first used here), replacing the hills drawn over the west; the far
  mountains moved off the sea.
- **Water:** the north's own height texture (coarse over the whole north, finer over the isles)
  baked a slice at a time as you approach; its own swell, wind and current field; its colours
  (colder, greener); `setRegion('north')`.
- **The edges and saves:** the boats' edge, `inWorld`, `inSeas`, the save's position bounds and
  zones learn the north.
- **The chart:** a sheet for the coast north (drawn from the start, as a printed chart would be)
  and one for the isles, explored as you go.
- Tests: the region, the coast continuous at the seams (heights and coast within a few metres of
  home's), nothing at home moved, the route's water deep enough, the edges, saves.

*N1 done.* What was built, and where it differs:

- **`src/world/north.js`:** `regionOf(x, z)` (home, north or south), the north's shapes (the Ness,
  the west coast `westX`, the Churn's point, Loch Skarn and Bothy Bay, Raven Isle, Tern Isle,
  the Selkie Rocks, Skarv Stack), its heights, zones, current and habitat, and its places. Home's
  land is cut, not replaced: `terrain.js` keeps home's own coast (`homeSDF`) and, beyond what home
  draws (west of x -1800, north of z -2200), the north gives it a west coast, a loch and the isles,
  and puts the far hills on it (the same hills the horizon was always drawn with). The ground is
  continuous across both edges (within 0.12 m) and **nothing at home moved**: a fingerprint of
  home's heights, coast and zones is the same as before.
- **The way:** 9.4 km from the bay's mouth to the sound off Halvig, over 12 m deep all the way past
  the Calf. The coast is low at first, then rises into the fells (cliffs to 90 m); its line wanders
  in headlands and bays half a kilometre across, steadier along the isles.
- **Drawn in tiles:** 80 tiles of coarse sheet (720 m, on the same 20 m grid), the nearest missing
  one built a slice at a time (4 ms a frame), dropped beyond 2.7 km. The hills drawn over the west
  are gone; the far mountains fade out as you go west past the Calf.
- **Water:** the north's height map (10 m over the whole north, 5 m over the isles) and its sea's
  field (swell, wind, current: 20 m cells) are baked a slice at a time once you head west past
  x -300, about 2 s of work spread over the frames; the region changes at x -850, where both
  water maps reach, so it never waits. The north's sea is colder and greener. Its zones: the open
  Atlantic outside (full swell), kelp under the shores, Raven Sound (sheltered), the Churn (the
  tide hard over its sill), the Selkie Rocks, Loch Skarn (still).
- **The edges:** a boat goes on west past the Calf (home's sea and the north's join there), and is
  turned back only at the north's own edge; saves keep a boat, a walker, marks and catches there.
  (On the way: a catch made at Las Brasas was saved as caught in Willow Bay, since the save only
  knew home's waters; it now knows all three seas'.)
- **The charts:** a printed chart of the coast north (all of it there, worked out from the land
  itself) and the Selkie Isles' chart, explored as you go.
- Tests: `tests/north.test.mjs`.

**N2, the isles.** Raven Isle, Tern Isle, the Selkie Rocks, Skarv Stack, Raven Sound and the
Churn, Loch Skarn and Bothy Bay in detail: detailed terrain patches, their colours, the scatter
(grass and heather, boulders, the kelp beds under the water), the places in the journal.

*N2 done.* What was built:

- **In detail:** terrain patches over the Ness, Raven Isle (in two, the north half taking in the
  Churn), Tern Isle, the Selkie Rocks, Skarv Stack (finer, being sheer) and Bothy Bay, built as
  you come near like the fell's, on the north's tiles (which leave holes for them).
- **Its colours** (`northWorld.js` `northColor`): grass, heather and bracken on the fells, scree
  high up, grey crags and cliffs; machair and white shell sand on Tern Isle, shingle on the other
  shores; under the water, dark kelp on the rock in the shallows, grey-green sand, mud in the
  loch's basin, the deep dark.
- **Under the water** (`habitat.js`, `north.js` `northHabitat`): kelp on the rock from a metre or
  two down to fifteen, sand in the sound and off Tern Isle, mud in the loch's deep, rock walls in
  the loch and round the stack, rock over the Churn. Kelp forests round each island and along the
  shores near them (`NORTH_BEDS`), laid a slice at a time once you're up the coast.
- **On the land** (`buildNorth`): boulders along the shores and on the scree, heather on the
  slopes, rowans in Loch Skarn's sheltered glens, marram on Tern Isle's dunes; each area its own
  meshes, built a slice at a time as you come up the coast.
- Tests: in `tests/north.test.mjs`.

**N3, things to find and a harbour.** Halvig (the pier, the fuel pump, the shop, the crofts,
a berth), the light on Raven Head, the broch, the bothy, the herring station, the Seal Cave, the
Sula (a dive site with its buoy) and the stack's foot (a dive); a challenge on the board.

*N3 done.* What was built:

- **Halvig:** on a shelf of level ground cut above its bay, the shop (Halvig Stores), three crofts
  (white harled walls, slate roofs, a chimney at each gable, their windows lit after dark) and a
  red phone box; a stone pier forty metres out into the bay, seven to ten metres alongside its
  head, walkable and solid to the boats (the last of `PIERS`, so the others keep their places);
  the fuel pump at its root (`FUEL_PUMPS.halvig`: diesel and petrol at the island price, brought
  out on the boat from the mainland).
- **Raven Head:** a white lighthouse and its store on the high ground at Raven Isle's north end,
  three flashes every fifteen seconds after dark.
- **Tern Isle:** the broch (a ring of dry stone, broken off at different heights, its doorway to
  the sea) on its high ground, and a ring of seven standing stones at its west end.
- **Loch Skarn:** the bothy on a level cut above Bothy Bay's beach; the herring station's roofless
  walls on the south shore, and its pier's stumps running out into the loch.
- **The Seal Cave:** a dark mouth at the foot of Raven Isle's west cliffs.
- **The Sula:** a steel trawler on the bottom off Tern Isle, listing, her wheelhouse and gantry
  still on her, thirteen metres down under a yellow buoy. **Skarv Stack's foot:** its sea now
  falls away to thirty-odd metres all round it (it stood in eight).
- **The dives:** the Sula (10–18 m) and the stack's foot (8–34 m) in the dive log, with fish of
  their own: a conger, pollack and wrasse in and over the Sula, catsharks on the sand beside her;
  wrasse and pollack on the stack's walls, a conger and catsharks at its foot, mackerel round it.
  For them, the home coast's cold-water fish now know the north's waters (`northFish.js`
  `AT_NORTH`, as Las Brasas' `AT_BRASAS`), and the north's homes come after everything else, their
  fish made last of all, each with a seed of its own: **every other fish is where it was** (a
  fingerprint of all 5,031 is unchanged). *Under the Selkie Isles* on the board for the two.
- **Places:** Halvig, Raven Head, the broch, the standing stones, the Loch Bothy, the herring
  station, the Seal Cave and the Sula, each found there.
- Tests: in `tests/north.test.mjs`. Two older tests changed for the new sites, as for the
  archipelago's: `tests/divesites.test.mjs` counts ten yellow buoys (the Sula's added), and its
  check that each kind of home comes after the last now wants the north's after everything, with
  Gannet Deep's head still last of home's.

**N4, life.** The new fish; home's cold-water fish in the north; the north's fish homes; the
colder water; seals, otters, the minke; the seabird colonies and the eagle.

**N5, the voyage.** The fast passage north and home (the passage machinery learns a third end);
"near Willowhaven" made "near the nearest harbour" (offshore warnings, tows, rescues only at
home, fuel words, fast travel, boats brought round); the north's weather (westerlies, low cloud,
cooler); played through in the browser in the trawler, measured (`docs/PERFORMANCE.md`).

## Done when

- Tests show the coast continuous where north meets home, nothing at home moved, the route deep
  enough all the way, every island and the loch where they should be, the region and edges right,
  saves keeping a boat in the north, the north's fish only in the north and home's where they
  were, and every new place found only there.
- In the browser: the trawler sailed from Willowhaven round the Ness and up the coast to Halvig,
  anchored in Bothy Bay, the tender ashore; a dive on the Sula; the fast passage home; no errors,
  and the numbers measured.
