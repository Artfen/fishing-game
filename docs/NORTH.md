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

*N4 done.* What was built:

- **Five new fish** (`northFish.js` `NORTH`, after every other fish so none of them moves): the
  **Atlantic cod** (the kelp edges, the deep rock outside and the loch), **saithe** (shoals in the
  Churn and along the cliffs, hard and fast), **ling** (deep rock and wrecks: the loch's walls, the
  stack's foot), **haddock** (the sound's sand and the loch's mud) and the **flapper skate** (on the
  mud of Loch Skarn's basin, sixty to ninety metres down: critically endangered, to be released, and
  nobody buys one). Each with its look in the water (`anatomyNorth.js`: the cod family's three
  dorsals and two anals, the haddock's thumbprint, the ling's long fins, the skate's great disc), its
  fight, its baits and its moods, its season (cod and ling best in the cold months), its price at
  Willowhaven's market (brought home iced), and its name, family and status in the journal's tree
  (from `register.js` `NORTHERN`: cod and haddock Vulnerable, the skate Critically Endangered; a new
  family, the lings).
- **The home coast's cold-water fish there too** (`AT_NORTH`, with how many groups each): pollack,
  Ballan wrasse, conger, catshark, mackerel, horse mackerel, thornback, plaice, turbot, gurnard and
  sprat.
- **The north's fish homes** (`habitat.js` `northSpots`: reef and rock under the shores, sand in the
  sound, the deep in the loch and outside, the tide in the Churn), built cheaply at the start, after
  every other home; each species' groups there placed in a pass of its own after every other fish,
  with its own seed (`ecosystem.js`). About 210 fish in the north, and **every other fish where it
  was** (the fingerprint of all 5,031 unchanged).
- **The colder sea:** about 8°C at the end of winter to 13°C at the end of summer (`seatemp.js`),
  so the cold-water fish keep shallower there than they would at home in summer.
- **Its life:** grey seals hauled out on the Selkie Rocks and two in the water off them; a minke
  whale feeding round the isles and a pod of common dolphins along the west coast (each its own
  dice, so nothing else moves); otters on Loch Skarn's north shore; a seabird colony on Skarv Stack
  (guillemots and kittiwakes on its ledges, fulmars round it, shags at its foot), puffins and
  razorbills on Raven Isle's north-west side, a peregrine and ravens over its cliffs, eiders in the
  sound and in Bothy Bay. (Not done: the white-tailed eagle, which needs a new bird made; the
  terns on Tern Isle.)
- **Words:** the journal's catches "in Raven Sound", "in the Churn", "in Loch Skarn"; a page of the
  north's fish; the field guide's "Up the coast" for each fish that lives there; a north-only fish
  shown on the isles' chart.
- Every new fish bites on the field guide's first choice in the headless sea (`tests/guide.test.mjs`
  tries every catchable kind), and is accounted for there as Las Brasas' own are.
- Tests: in `tests/north.test.mjs`. Four older tests changed, each for the north's life: the birds
  test now allows (and wants) guillemots on Skarv Stack and puffins on Raven Isle as well as Gannet
  Isle's and Puffin Cove's; the wildlife test lists Loch Skarn's otters with the other three beats;
  the guide test accounts for the north's fish (outside the register, as Las Brasas' are) with
  their scientific names, as it does Las Brasas'; the depth release's test, which held that only
  the small fish came after its five, now allows the north's five after those (last of all, for the
  same reason: so no fish moves).
  (The sea life's fingerprint needed no change: the north's seals, dolphins and minke roll dice of
  their own, as the canyon's whale does, and it stays last.)

**N5, the voyage.** The fast passage north and home (the passage machinery learns a third end);
"near Willowhaven" made "near the nearest harbour" (offshore warnings, tows, rescues only at
home, fuel words, fast travel, boats brought round); the north's weather (westerlies, low cloud,
cooler); played through in the browser in the trawler, measured (`docs/PERFORMANCE.md`).

*N5 done.* What was built, and played through:

- **The passage** north and home (`main.js`): the passage machinery's third end. Offered at the
  helm (under way, in a boat fit for it: the trawler, the yacht, the sailing boat) out of the bay
  west of the Calf or anywhere up the coast, and at the trawler's chart table. The card gives the
  way, the time at the helm (about forty minutes in the trawler) and the fast passage (the hours,
  about two and a half days, and the fuel it would take, then in off Halvig's pier), with a log of
  its own each way. It's not counted as a crossing of the open sea.
- **"Near Willowhaven" made the nearest harbour:** the offshore warnings count the way back to the
  nearest harbour, Willowhaven, Halvig or Puerto Brasa (they had counted Willowhaven at Las
  Brasas too); no rescue calls come in the north; a tow takes you into Halvig pier there; the fuel
  words name Halvig's pump; you can't fast-travel home from up the coast (only the passage takes
  you); a boat left up the coast isn't brought round or shipped (it's sailed home). (On the way: a
  tow at home put a boat at a mooring for no boat, `mooring(boat.iind)`; it now finds her own.)
- **The north's weather:** the westerlies off the Atlantic, west-south-west and a little fresher
  than home's, its sea breeze from the west; an overcast sky when the passage brings you in.
- **Bothy Bay's bottom** reads sand by the beach and mud further out to the anchor, good holding,
  and the loch's deep is mud (`sonarRead.js` `sediment`).
- **Played through in the browser** in the trawler: west of the Calf, the passage north offered
  and taken; in off Halvig at night, its windows lit, the water 12°C, the wind south-westerly; at
  anchor in Bothy Bay on mud; ashore to the Loch Bothy; on Halvig pier at the pump ("The fuel pump:
  fill up"); a dive on the Sula (found, her hull in the green water); back aboard in the sound, the
  passage home offered and taken, and in at her berth at Willowhaven. No errors.
- **Measured** (`docs/PERFORMANCE.md`): at anchor off Halvig, 131 draw calls and 509,000 triangles,
  3.2 ms of simulation; diving the Sula, 87 and 283,000; home's harbour and the liveaboard
  unchanged. About 33 MB more heap once you're up there.
- **Halvig's pier, a berth all along it:** the full suite found the cabin boat couldn't lie at its
  root (the pier's first metres ran over the shelf, so a long boat's stern lay against it). Halvig's
  bay is cut a few metres wider, the shelf's edge, the pump and the phone box moved back with it,
  and the water alongside the pier dredged to three and a half metres at its root.
- Tests: in `tests/north.test.mjs`. Older tests changed, each for the north's fish, which have
  homes of their own after everyone else's (checked in `tests/north.test.mjs`): the mountain and
  paradise tests' fingerprint and count of home's fish leave the north's out, as they do Las
  Brasas', the crossing's and the small fish's; the micro-fishing test's "the small fish last of
  all" allows the north's after them. And the guide test's squid-at-night and tuna-boil scenarios
  get dice of their own, as each kind in the loop before them has: they'd been fished with
  whatever dice that loop left, so adding five kinds to it changed their outcome (the tuna boil
  hooked an albacore instead).

**Not done (then):** the white-tailed eagle and the terns on Tern Isle (a new bird each); Halvig's
shop selling stores and a bed in the bothy (the stores and the nights work as they do anywhere
else: aboard); the clock's speed-up at the helm on passage (step 4).

*All four done since.* The speed-up is step 4's W2 (`docs/WORLD.md`). The rest, step 5's last:

- **The white-tailed eagle** (`birds.js` `wteagle`, `birdData.js`): a new bird, Britain's biggest
  bird of prey, its broad square wings two and a third metres across, a pale head, a yellow bill and
  a white wedge of a tail. One soars over Loch Skarn by Bothy Bay and another high over Raven Isle,
  seen from well over a kilometre off. Every few minutes one leaves its circle in a long, straight,
  shallow glide down to deep water, swings its feet forward at the last, takes a fish off the
  surface with a splash and labours back up with it in its feet. All year, by day.
- **Arctic terns on Tern Isle** (`arctictern`): a new bird (home's terns are common terns), in
  spring and summer. Twenty-six nest on the machair, on the dry turf between the beach and the
  island's top, sitting tight until you walk among the nests: then the colony is up and round you,
  screaming, at head height and a little over, one and another swooping at your head, until you're
  well away (the game says so, once). Six more fish round its shores, hovering with wings a blur and
  plunging straight in. Their calls are the terns'.
- **Halvig Stores** (the door at the top of the pier, `north.js` `NORTH_DOORS`): stores for her
  lockers and three days of ice for her fish box, for whichever of your boats came up the coast, at
  the same prices as anywhere; open all hours (Morag behind the counter by day, an honesty box after
  closing). You can fill your bottle and make rolls there, as at a kitchen.
- **The Loch Bothy** (its door facing the bay): in to its stove (cook what's in your creel, an
  oatcake from the tin) and its sleeping platform (sleep until dawn, or any of the usual hours; you
  wake at its door, to the loch); and the book on the sill, where earlier visitors wrote of the
  eagle, the terns and a flapper skate off the point, and where you add a line of your own (kept in
  the save).
- First visits to Halvig and the bothy say what's there. The two new birds are in the journal's
  tree with the rest (Accipitridae joins the families), noted when seen up close.
- **Nothing else moved:** the new birds come last, with dice of their own; the 311 birds before
  them keep their places and their dice (`tests/northlast.test.mjs` holds their fingerprint).
- Tests: `tests/northlast.test.mjs` (the eagle's catch from deep water and back up, the colony up
  round you and settled again, the terns' dives into water, both doors in front of their buildings
  and found among the north's things, the book kept in the save). Played in the browser: the
  trawler alongside Halvig pier, ice bought at the shop, the bothy book read, a night on the
  platform (woke at dawn at the door), the eagle over the loch, and the terns up round you on Tern
  Isle (noted in the journal as you're mobbed). No errors.

## Done when

- Tests show the coast continuous where north meets home, nothing at home moved, the route deep
  enough all the way, every island and the loch where they should be, the region and edges right,
  saves keeping a boat in the north, the north's fish only in the north and home's where they
  were, and every new place found only there.
- In the browser: the trawler sailed from Willowhaven round the Ness and up the coast to Halvig,
  anchored in Bothy Bay, the tender ashore; a dive on the Sula; the fast passage home; no errors,
  and the numbers measured.
