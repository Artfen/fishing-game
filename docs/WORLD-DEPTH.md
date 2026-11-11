# World depth, customization and the marine engine overhaul: audit and plan

The brief: richer biomes, small fish you can catch, boats you own one by one, real engine
choices, a character of your own, a proper nautical chart, rockpools and marine research. All
built on the game as it is, in focused, tested pull requests. This page records what the code
already does (audited at main d7708bf, Version 80), what each change adds, and the order of work.
It is updated as each part ships.

## Implementation matrix

Complexity: S (a day), M (a few days), L (a week or more). Risk is mostly frame time and
save compatibility.

| Area | What exists | Current limitation | Proposed improvement | Main files | Depends on | Size | Player benefit | Performance / risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **Small fish** | 4,600 fish in one shared simulation (`world/ecosystem.js`), each a real animal that notices a bait, takes it and fights; host-authoritative in multiplayer (one fish, one rig: `world/sharedworld.js`). A mouth-size gate on baits. The reef's small fish (`world/drifters.js`) are scenery only | No gobies, blennies, minnows or small wrasse; no tackle for them (smallest hook a size 16, no pole); a tiny bait is the same to a 60 cm bass as to a 10 cm goby | Real small species added to the same simulation, living where they really do (harbour walls, rocky ledges, eelgrass, clear streams); a whip pole, a micro float on a size 18 hook, worm pieces and a 1 g micro jig on the light rod; big fish less keen on a tiny scrap, and one that does take it snaps the fine line | `smallFish.js` (new), `fish.js`, `tackle.js`, `gearArt.js`, `world/ecosystem.js`, `world/habitat.js`, `taxonomy.js`, register | none | M | A new way to fish anywhere, from the first minute; every harbour wall worth a look | +~150 agents, sim cost tiny (they're near shore); no new draw calls (same instanced fish renderer) |
| **Decorative → catchable** | Drifters laid out per client from a seed | Promoting a drifter to a hookable fish would need it in the shared simulation, or two players could catch "the same" fish | Not converted: the catchable small fish are simulation agents (shared, one owner), the drifters stay scenery. Where a species is in both, the catchable ones are where you'd fish | — | — | — | Multiplayer stays consistent | none |
| **Bait and live bait** | Baits are an unlimited list; fresh bait from the counter; a livewell fitting that only keeps kept fish fresh | No stock, no live bait, no nets or traps | Small fish kept alive in a bait bucket or the livewell (capacity, water, aeration, survival), fished as live bait for bass, pollack and pike; a hand net and a drop net for prawns and shore crabs | `tackle.js`, `fishing.js`, `shop.js`, save | small fish | M | Small fish feed the big-fish game | save field added (migration) |
| **Rockpools** | Tide model (`world/tide.js`) moves the water; you can walk to 0.6 m below sea level | The walkable shore doesn't move with the tide; nothing to find on the shore | Pools on the rocky shores that open at low tide and refill on the flood, with gobies, shannies, prawns, shore crabs, anemones, limpets and sea stars to find, watch, photograph, net (within rules) or fish | `world/rockpools.js` (new), `walker.js`, `main.js`, `taxonomy.js` | small fish, tide | M | A reason to walk the shore at low water | small instanced meshes, only near you |
| **Biomes** | One habitat grid (rock, weed, depth); dive-site geometry; seabed creatures by habitat; two underwater looks (home and Las Brasas) | Reef fish drift through boulders; one underwater look and sound for every habitat at home; few crevices, ledges, encrusting life | A showcase reef (Skerries) and kelp forest first: ledges, overhangs, crevices with crabs and lobsters, barnacles, mussels and anemones on the rock; fish steering round rock; kelp in layers with juveniles among the stems, darker under the canopy; per-habitat visibility and sound. Then estuary, Las Brasas, deep and fresh water | `world/divesiteWorld.js`, `world/seabed.js`, `world/underwater.js`, `world/drifters.js`, `world/ecosystem.js`, `world/habitat.js` | none | L | Diving somewhere different feels different | draw calls and triangles: profiled before and after (`tools/perf.mjs` scuba dive) |
| **Engines** | Engine runtime (`engine.js`: start-up, batteries, cord, rpm, temp, trim, twins); hulls with a fixed thrust per kg; two shipyard fittings ("Bigger outboard", "Economy tune") as multipliers | No engine models: no horsepower, weight, fuel per kW, propellers; burn and thrust are per boat type | A data-driven engine catalogue (portable and mid-range outboards, high-performance, twins, diesels, electric) with power, mass, rpm, fuel and propellers; thrust from power and speed through the propeller, calibrated so each boat's current engine keeps its current speeds; fuel from power used; the right outboard drawn and heard; estimates in the shipyard run on the real hull; RIB first | `engines.js` (new), `boat.js`, `hydro.js`, `engine.js`, `fuel.js`, `shipyard.js`, `boatPreview.js`, `audio.js`, `dashboard.js` | none | L | Real choices: economy, range, speed, weight | thrust is per frame per boat (cheap); save migration of the two old fittings |
| **Vessels** | Every record (position, paint, name, fittings, engine, fuel, storage) keyed by boat type | One boat of each type; no registration, history or hours | Each boat its own record with an id, name, registration, engine, looks, fittings, hours, distance, fuel used, catches aboard and a log; migration turns each owned type into one vessel | `save.js`, `fleet.js`, `shipyard.js`, `main.js`, `together.js` | engines | L | Boats you get attached to | the biggest save change: migrated and tested both ways |
| **Exterior and fittings** | 10 paints and a name; fittings drawn (rod holders, plotter, VHF, bimini, trolling motor) | One colour; no stripes, tubes, upholstery, flags | Secondary colour, stripe, RIB tubes, console, upholstery, bimini, flag; realistic per hull; configurations (fishing, diving, exploring) | `shipyard.js`, `boat.js`, `boatPreview.js` | vessels | M | Your boat, recognisably | materials only |
| **Character** | A walker with a backpack and hat; three clothes that change warmth and wetness (`comfort.js`); friends' look is a hash of their name | No creator; friends look alike | A creator (build, skin tone, hair, beard, hat, jacket, trousers, boots, glasses) and a wardrobe at home; clothes with real warmth and waterproofing; the look sent to friends | `walker.js`, `dress.js`, `comfort.js`, `world/folk.js`, `together.js`, `world/home.js` | none | M | Friends tell each other apart | pose message gets a short look code |
| **Chart and routes** | A canvas chart with three sheets, depth shading, fog of the unexplored, pins, tracks, a habitat overlay, boats, friends; a plotter fitting that records the track and gives bearing to the nearest pin | No layers to choose; buoys in the world but not on the chart; no routes; the dash plotter doesn't show marks | Layers (nautical, habitat, fishing and wildlife records, exploration); buoys, harbours and anchorages charted; multi-waypoint routes with distance, time and fuel from the boat's real speed and burn; the plotter following the route (bearing, distance, next mark); stick pan and zoom | `map.js`, `dashboard.js`, `main.js`, `save.js` | engines (for fuel range) | M | Plan a trip, then follow it | canvas only |
| **Research** | Photos with subjects; species records; binocular sightings; survey jobs from the Marine Trust (transects, temperatures, dive surveys) | Photo jobs only see dolphins and whales; nothing for reef, rockpool or bird surveys | Assignments from the Marine Trust: rockpool and reef species counts, photographs of named species, seabird colony counts, seasonal sightings; paid by what you record | `contracts.js`, `main.js`, `photos.js` | rockpools, small fish | M | A career for naturalists | none |

## Order of work

Each step is one pull request, tested in the browser and with the full suite, merged when CI is
green.

**Phase A: ecology and small fish**
1. Micro-fishing: small species, the whip pole, micro floats, worm pieces and the micro jig; tiny
   bites and fights; the journal, close look and register.
2. Rockpools at low tide; the hand net; live bait in a bucket or the livewell.
3. Skerries Reef and the Kelp Forest as showcase habitats; fish that steer round rock.

**Phase B: engines and vessels**
1. The engine catalogue and power-based thrust, the RIB first: outboards from 115 to 225 hp (her
   capacity plate's limit), propellers, models, sound and the shipyard comparison.
2. The other boats' engines (portable and electric for the skiff, diesels for the yacht, twins
   for the console).
3. Individual vessels and the save migration; exterior customization and configurations.

**Phase C: the chart**: layers, routes, the plotter following them.

**Phase D: identity and research**: the character creator and wardrobe, friends' looks, Marine
Trust assignments.

**Phase E**: carry what works to the other biomes, boats and assignments.

## Progress

(Each shipped step is described in docs/IMPROVEMENTS.md.)

- [x] A1 micro-fishing (Version 81): rock goby, shanny, corkwing wrasse, black goby, minnow; the micro float rod, micro float, worm pieces, micro jig
- [x] A2a rockpools (Version 83): 18 pools on three shores, with the tide; anemones, limpets, periwinkles, prawns, shore crabs, cushion stars, gobies and shannies; turn a stone, the net, photographs, notes
- [x] A3 showcase reef and kelp (Version 84): fish round the rock of the dive sites; Skerries Reef's crabs, lobsters, barnacles and mussels; the light under the kelp
- [x] A2b live bait (Version 86): small fish and netted prawns into a bait bucket (six) or a livewell (twelve); water that goes stale and is changed; the least hardy die first; a live fish or prawn the hunters' first choice; used up when taken
- [x] B1 engine catalogue, the RIB (Version 85): the Fulmar 115 and 150, the Skua 200 and 225; three propellers; push from power and pitch, calibrated on her own engine; weight, fuel, sound, revs and the outboard drawn; the Marine Works' comparison measured on the boat; old saves' engine fittings carried over
- [x] B2 engines for the other boats (Version 87): Petrel portables for the skiff, Tern threes for the bass and cabin boats, twin outboards for the console, twin Shearwater diesels for the yacht; the old engine fittings retired and carried over. (Still to come: the jet ski's)
- [x] B2b the skiff's electric outboard (Version 91): the Eider 3, 3 kW, on its own battery; woken at a button, silent at rest, minutes flat out and far longer at an easy pace, charged free at a jetty and overnight; flat, the oars or a tow; its figures measured on the boat
- [x] B3 vessels and customization (Version 88): each boat's papers (registration, since when, engine hours, sea miles, fuel, fish aboard and her best, her log); a stripe or a RIB's tubes in your colours, and a flag at her stern; old games get papers for every boat. (One of each kind, as ever: two boats of a kind would need the harbour to hold them)
- [x] C chart layers and routes (Version 89): buoys, dive buoys, harbours and anchorages charted; your catches as a layer; routes planned mark by mark with each leg's course and distance and the passage's time and fuel for your boat; saved, followed, the plotter moving on as each mark is rounded
- [x] D character and research (Version 90): Settings → You (skin, raincoat, jumper, shirt, trousers, boots, hat and its colour, hair, beard, glasses), worn on foot and at the helm and sent to friends with your name; the Marine Trust's rockpool counts, seabird counts and photographs for its field guide on the notice board
