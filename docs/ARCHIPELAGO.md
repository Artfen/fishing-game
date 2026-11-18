# Slow Tide: the Las Brasas archipelago

Las Brasas grows from one island into an archipelago: three more islands, a seamount, a channel
the current runs through, and coves to anchor the liveaboard in and take the tender ashore from.
It's built in today's world (`ROADMAP.md`, "A liveaboard, her tender and two archipelagos", step
3): the southern sea already reaches 2.8 km by 2.8 km (`SOUTH_RECT`), and everything here is
inside it. No new world architecture.

The brief: **full of fish and things to find, through its habitats rather than more fish
spawned.** The island's fish are shared over more water (the same budget: `tests/brasas.test.mjs`
keeps 1,200 to 2,400 round the islands), bait gathers on the up-current side where the current
meets the land, and there are places to find: a wreck, a seamount, an old salt works, a gull
colony, a hidden bay.

## The sea it's in

The trade wind blows from the north-east almost always; the Atlantic swell comes from the
north-west; the Canary current runs south-west (`brasa.js`). So:

- **the up-current side is the north-east:** water pushed against an island or over a bank
  wells up there, bringing bait, and the birds and hunters with it;
- **the lee is the south and west** of each island: calm coves, sand, a place to anchor;
- **the windward north and west** of each island take the swell: cliffs and broken reef.

## What's added

| Place | Where (x, z) | What it is | For |
| --- | --- | --- | --- |
| **Isla Gaviota** | (1000, 5180), about 480 by 300 m | A low island north-east of Brasa, up-current: grey cliffs on its weather side, a gull colony, scrub | Birds; bait on its north-east side |
| **Caleta Blanca** | Gaviota's south-west, facing Brasa | A cove of white shell sand, 5 to 8 m, a beach | Anchoring; the tender ashore |
| **El Estrecho** | Between Brasa's north-east and Gaviota | A channel over a sill about 30 m deep, the current squeezing through it | Bait balls, birds working, little tunny and bonito |
| **El Banco** | (-820, 5150), out in the north-west | A seamount rising from 200 m to about 24 m, up in the swell | A deep dive; amberjack, barracuda, groupers; bait on its up-current face |
| **Los Roquetes** | A chain of stacks west of the Roque, (-760, 6380) to (-1020, 6520) | Four black stacks, 12 to 30 m high, with channels between | Reef fish, a landmark |
| **El Vapor** | On the south side of Los Roquetes, about 16 m down | An old coasting steamer, wrecked on the stacks | A wreck dive, with a buoy |
| **Isla Honda** | (980, 6780), about 420 by 340 m | The outer island to the south-east, low and sandy, beyond the sebadal | Its bay |
| **Bahía Escondida** | Honda's south-west | A horseshoe bay, sand at 4 to 8 m, sheltered from all but the south | The best anchorage in the islands |
| **Las Salinas** | Behind Bahía Escondida | An old salt works: the pans' low walls and a ruined hut | Ashore, from the tender |

The crossing still arrives off Brasa's north-east corner (`crossing.js` `ENDS.south`); every new
island lies well off its line, so the open water it crosses stays deep (`tests/crossing.test.mjs`).

## How it's built

**A1, the geography (`brasa.js`):**

- The islands as more pieces of the coast's signed distance (`brasaSDF`), so heights, depth,
  walking, the shore's foam, the chart and "arrived" all follow. Each island has a centre, a
  size, a height, and a cove cut into its lee.
- **One island's ideas, made the archipelago's:** `windward()` from the nearest island's own
  centre, not Brasa's; cliffs on each island's weather side (not by an absolute z); the shelf
  wider where an island's bay or the sebadal runs out; the channel's sill.
- **El Banco** as a seabed feature (as El Bajón is), not land: it zones as the drop-off (`veril`),
  so the drop-off's fish live on it without a new zone.
- **The current** squeezes faster through El Estrecho and over El Banco, slack in the bays.
- **The chart and the world's detail:** `SOUTH_MAP` grows to cover the archipelago; detailed
  terrain patches over each new island (4 m, as Brasa's); the scatter (scrub, boulders, coral)
  over the new land and reef as over Brasa's.
- **Places** in the journal and on the chart, found as you go.

*A1 done.* What was built, and where it differs:

- Isla Gaviota and Isla Honda as ellipses in the coast's distance field with a cove carved into
  each lee; Los Roquetes as four stacks; El Banco and El Estrecho's sill in the seabed. Brasa's
  own coast is its own function (`brasaIsleSDF`), which the crossing measures to, so the islands
  don't end it early or shrink its open water.
- `windward()`, the cliffs and the shelf go by the nearest island (`islandOf`); Brasa keeps its
  north-coast cliffs. El Banco zones as the drop-off; the coves are sand with a little seagrass,
  slack and sheltered; the channel's current about half again as fast as the open sea's.
- The chart of the south (`SOUTH_MAP`) grows to 2.6 by 2.3 km. A chart explored before is laid
  out on the new one where it was (`map.js` `Explored`, as home's was when it grew), and the
  save's limit on its length rises to fit.
- Detailed terrain over each island, the stacks and the bank; scrub, boulders, urchins and weed
  beds over them; the coves' sand and the salt pans' crust in their own colours.
- The island's fish now live round the new islands too (about fifty to a hundred round each)
  with the total unchanged (1,819). Building the habitat's homes is no slower than before (a
  spatial grid for their spacing, and the coast's distance kept for the point just asked).
- Tests: `tests/archipelago.test.mjs`.

**A2, life through habitats:**

- Fish homes over the bigger chart from the same rules (`habitat.js` `southSpots`), the budget
  shared, not grown.
- **Up-current:** homes on the up-current side of each island and the bank are tagged, and the
  bait fish favour them, so the feeds (which start where hunters meet bait) happen there.
- A gull colony on Gaviota; dolphins over El Banco.

**A3, things to find:** El Vapor (the wreck, a dive site with its buoy), El Banco (a deep dive),
the ruins of Las Salinas, a beacon on Gaviota; the coves' sand for the anchor.

**A4, played through:** the trawler across to the islands, anchored in Bahía Escondida, the
tender ashore to Las Salinas, a dive on El Vapor; the numbers in `docs/PERFORMANCE.md`.

## Done when

- Tests show each island where it should be (land, its cove's sand and depth, its cliffs to
  weather), the channel's sill, the bank's top, the crossing's line still deep, the zones and
  shelter right on each island's weather and lee sides, the fish budget kept, bait favouring the
  up-current side, and every new place found only there.
- In the browser, the liveaboard's voyage to the islands is played through, and the islands look
  right from the sea and from ashore.
