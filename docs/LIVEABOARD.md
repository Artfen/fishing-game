# Slow Tide: the liveaboard and her tender

A boat to live in: walk about her, cook in her galley, sleep in her cabin, steer her from a
pilothouse, and carry a small fast RIB on her stern to take ashore. This is the design, worked out
against the code as it is (November 2026), for review before any of it is built. It's built in
eight steps, L1 to L8 (at the end), each one pull request, tested and played before the next.

Why now: the world is to grow by compressed geography (see `ROADMAP.md`, "A liveaboard, her
tender and two archipelagos"): the Northern Archipelago about 10 km north of Willow Bay, Las
Brasas' archipelago round the island in the south. A game hour passes in 40 real seconds, so forty
minutes north is two and a half days by the game's clock: meals and nights on the way, and a
boat you can live in is what makes the distance worth sailing.

## The day she's for

You come out of the owner's cabin at first light, anchored in a cove off Gannet Isle. Coffee in
the galley; the forecast at the chart table in the pilothouse. On the aft deck you put the fuel
can in the tender and lower the swim platform: she floats off the chocks, held on her painter.
You step down into her, start the outboard and go in to Puffin Cove's landing, up the beach,
round the island. Back out at noon: alongside the platform, haul her on, raise it. Lunch at the
dinette, a line over the stern in the afternoon. Then the anchor up, the autopilot on, and north
for the night, the pilothouse lit red, while you go below to make dinner.

## Choices to confirm

Each has a recommendation; the rest of this page assumes it.

1. **One diesel and a bow thruster**, as most compact trawlers have. The game supports only twin
   inboards today (four places assume two: the rudders in `hydro.js`, `buildInboards`, the thrust
   loop and the twin lever in `boat.js`), so this needs a single-screw case added. It's worth it:
   a single screw walks her stern going astern (B4), and berthing her with the thruster is a
   skill of its own. (Twin screws would be less work and handle more easily.)
2. **A hydraulic swim platform carrying the tender athwartships** (across the stern, her bow to
   starboard), as on many motor yachts of this size. It lowers under the water, the tender floats
   off; you bring her alongside it, haul her on, and it lifts. No swinging crane, no tender high up
   upsetting her stability, and forgiving to line up.
3. **Her berth: the outer side of your own finger** at Willowhaven (16 m: room for her 13.4 m and
   the platform and tender, about 15.1 m). The finger's other side takes one or two small boats.
   (Decided in L2: the visitors' pontoon has no side free for a third boat, since the guests and
   the Halcyon use them all, so the harbour office won't launch one that won't fit. The other
   choice was a mooring buoy in the bay, reached by the tender: real enough, but awkward on the
   first day.)
4. **The tender is a boat in her own right,** sold on her own at the Marine Works as well: a cheap,
   fast little boat for the bay. She's built first (L1), useful before the trawler exists.
5. **A price:** about £9,500 for the trawler with her tender (the yacht is £3,600), hire by the day
   as for any boat, and from the start in Free Roam. The tender alone about £520.
6. **Her name.** The engines are named for seabirds (Petrel, Tern, Fulmar, Skua, Shearwater);
   the trawler wants a model name of her own (a placeholder here: *the trawler*).
7. **Sleeping only at anchor or tied up,** as now. Under way the autopilot steers but keeps no
   watch. Drifting for a night offshore could come later, with the passage speed-up.

## The trawler

A compact, full-displacement expedition trawler in the fleet's style (`docs/BOAT-ART-DIRECTION.md`):
a plumb bow, a raised pilothouse with forward-raked windows, a long saloon house with side decks
round it, the boat deck over the aft deck, a short mast with the radar and lights, the platform
and tender across her stern. Substantial, plain and seaworthy: not a gin palace.

| | |
| --- | --- |
| Length overall | 13.4 m (with the platform, 15.1 m) |
| Beam | 4.4 m |
| Draft | about 1.35 m (a full keel protecting the propeller) |
| Displacement | about 17 t |
| Engine | one diesel of about 150 hp (a new, smaller model in the catalogue: the diesels there are 260 to 440 hp), a single shaft and rudder |
| Bow thruster | on her house battery |
| Speed | about 8 knots cruising at a little over 10 litres an hour; about 9 flat out (her hull speed: she can't be pushed past it) |
| Tanks | about 2,000 litres of diesel, 600 of water |
| Berths | a double forward, two bunks in the guest cabin |
| Crosses the ocean | yes (`passage`), and holds her speed in the open swell (below) |

**Her physics** (`hydro.js`, `boat.js`):

- A displacement hull: no `planing`. Her resistance gets its own `resist` with a hull-speed wall,
  as the sailing boat has (`sailing.js` `hullDrag`). The default curve has none, and would let
  her plane.
- Her centre of gravity set (`cgY`) for a tall house; her keel foil added to `foilsFor` (it
  switches on the hull's name); her wind area large (about 30 m² side on), so she lies to the
  wind on her anchor and the thruster has work to do in a breeze.
- **Her own seakindly speed.** Every motor boat is held to about 2.8 m/s (5.4 knots) on the open
  sea (`crossing.js`, applied in `main.js`), because planing boats pound in the swell. A
  displacement hull doesn't: she should hold about 7 to 8 knots in a moderate swell. That's her
  point, and what makes the 10 km north about forty minutes.
- The single screw: the inboard code generalised from two to one or two (`motor.count`).
- The thruster: a sideways push at her bow, the same physics as the trolling motor's push under
  the bow (`trolling.js`), drawing on her battery.
- The tender, carried, is a load at the platform (below): a few centimetres down by the stern.

**Her helm** is inside, in the pilothouse: the yacht's diesel console (`dashboard.js`, built for
inboards: key, glow plugs, no kill cord) with one key and one lever. Added: the thruster (the
shoulder buttons on a controller, or keys), the autopilot, the platform switch with a PLATFORM
lamp (like the LEG lamp), the chartplotter and the sounder.

**The autopilot** is what lets you leave the wheel. From the helm, it holds her heading at the revs
she's at (the course hold the boats already have, `Boat.holdCourse`, kept on with nobody at the
wheel). It sounds an alarm anywhere aboard, and on the controller, for:

- shallow water on her course (her depth ahead, looked for a couple of minutes out at her speed);
- land on her course;
- another boat closing;
- the anchor dragging, when she's at anchor.

Take the wheel and it's off. It isn't a crew: no sleeping under way.

**Building her costs only when she's needed.** The game builds a `Boat` of every kind when it loads
(`main.js`, `BOATS`). She and her interior are built only when she's owned, hired or in sight, the
way Las Brasas is built on the first visit.

## Her layout

Her own coordinates, the way every hull's are: the bow along +z, the middle at z = 0, heights
above her waterline. Five floors, joined by steps and stairs.

```
          main level                                  lower level (under the pilothouse
                                                       and the foredeck)
              /\    foredeck, windlass  (+1.6)
             /  \                                          /\
            /    \                                        /  \  owner's cabin:
           |      |                                      | ▢▢ |  the double, lockers
      .----+------+----.                                 |    |       (+0.05)
      |   PILOTHOUSE   |  helm (stbd), chart     side   |----|
 door |  ▣         ▤   | door  table (port)      decks  |guest|  bunks (stbd)
      |stairs down     |        (+1.55)          (+0.95 |heads|  heads (port)
      |----- steps ----|                          to    |stair|  stairs up (port)
      |    SALOON      |  dinette (stbd), sofa    +1.5)  '----'
      | galley (port)  |  engine-room hatch
      |--sliding door--|        (+0.95)
      |   AFT DECK     |  platform controls, dive locker,
      |                |  fish box, rod rack     (+0.95)
      '-transom gate---'
   [ PLATFORM, the tender across it ]    (+0.30 up, -0.55 down)
```

| Space | Along her (z, m) | Floor (m) | What you do there |
| --- | --- | --- | --- |
| Platform | -8.4 to -6.7 | +0.30 up, -0.55 down | carry the tender; launch and recover her; swim and dive from it; board from a dinghy or the water |
| Aft deck | -6.7 to -4.3 | +0.95 | fish (the fish box, rod rack, walking with a line as on the deck boats); the dive locker (kit and tanks); the platform's controls; cargo and freight; the transom gate down to the platform |
| Saloon and galley | -4.3 to -0.3 | +0.95 | cook, eat and drink (`openCamp('cook')`, her `GALLEY` stores); the dinette (the journal, her papers and voyages, readable aboard at last: today only at the Marine Works); the engine-room hatch (her hours and the service, `service.js`) |
| Pilothouse | -0.3 to +2.3 | +1.55 | the helm (the dashboard in first person); the chart table (the map, routes, the forecast); doors out to both side decks |
| Side decks | -4.3 to +2.3 | +0.95, rising to +1.5 | round the house to the foredeck, by the rails; lines and fenders |
| Foredeck | +2.3 to +6.7 | +1.6 | the windlass and anchor (the anchor key still works from the helm) |
| Guest cabin and heads | +0.3 to +2.6 (below) | +0.05 | bunks for a friend crewing (they sleep when you do, as now); the heads (just a room) |
| Owner's cabin | +2.6 to +5.6 (below) | +0.05 | sleep (`sleepUntil`, at anchor or tied up); lockers (her stores) |

The boat deck, over the saloon, isn't walked on at first: it carries the mast, the liferaft and the
lights. No flybridge: she stays low and compact.

## Walking aboard

Today a figure aboard moves in one of three ways, each at a fixed height. Deck walking
(`walkDeck`: a half-width along her, one box for a console, round a wheelhouse) is on the yacht,
the centre console and the RIB. The cabin is three stops stepped between. Crew walk a plain
rectangle. None has floors at different heights or stairs.

The game does have walkable rooms: the cottage, the chandlery and The Lobster Pot. Their walls are
rows of small circles with gaps for doors, the furniture is circles, and the things you use are a
point and a radius, turned into a prompt by `interaction()`. Doors swing open as you come near. In
third person the roof and the wall nearest the camera are hidden. All of it is fixed in the world.

The trawler takes that pattern into her own frame, with floors at different heights:

- **`src/deckplan.js`** (new, pure, tested in node), all in her own coordinates:
  - floors (rectangles or convex shapes, each at its height);
  - walls (segments, with gaps for doors);
  - stairs (a ramp from one floor's height to another's);
  - fixed obstacles (circles);
  - spots (a point, a radius and a floor, for each thing you use).

  It gives the floor you're on and its height, a step that slides along walls and changes floors on
  stairs, and the spot you're at. Only the trawler uses it at first; the other boats keep
  `walkDeck`, and could move to it later.
- **One figure aboard**, the on-foot walker, placed through her body each frame, as the cabin
  already places it (`cabinWorld`). It rides her pitch and roll as figures aboard do now, and its
  weight goes on her at its position (`loadForces`). At the helm seat it's the seated figure, as
  now.
- **The camera.** On deck, third person follows you rather than her middle. Inside, first person by
  default. Third person inside uses the houses' cutaway (the roof and the near wall hidden), worked
  in her frame. Inside, the view rolls with her; the existing steady setting damps it for anyone
  who'd rather not.
- **Leaving the wheel** under way needs the autopilot on, or the lever in neutral. The cabin's
  "held still" rule (`canEnterCabin`) doesn't apply to her: you can walk below at eight knots.
- **The controls** are those for walking ashore, on keyboard, controller and touch, with prompts
  from `interaction()` as everywhere.
- **Crew** walk the same plan. Their pose already says which boat and where in her (`cr`, `cx`,
  `cz`, and its ranges already fit 14 m); it gains the floor. The skipper's own place aboard goes
  in her pose too, when they're away from the wheel, so friends see them walking about her.

## The tender

A rigid inflatable of 3.3 m, built as the RIB is but small: an aluminium V hull with grey Hypalon
tubes, a bench seat, a tiller outboard, a bow locker and paddles.

| | |
| --- | --- |
| Length | 3.3 m over her tubes (her hull 2.85 m; with the outboard tilted, about 3.7 m across the platform) |
| Beam | 1.67 m over her tubes, about 0.8 m inside them |
| Weight | about 150 kg ready to go with the Petrel 20 (230 kg as she goes out, you aboard) |
| Engine | a short-shaft tiller outboard: the Petrel 20 as she comes, 22 to 23 knots with one aboard and about 16.6 with two and their gear; the Petrel 15 (about 21) or the Tern 30 (about 26) at the Marine Works |
| Fuel | a 20-litre portable tank: about 10 nautical miles at her 15-knot cruise |
| Takes | you and two (on her tubes), or about 150 kg of gear; divers roll off her tubes |
| When the engine won't go | the paddles (slow, as every motorboat's oar is) |
| Price | £520, hired by the day like any boat, a second allowed; on the car's trailer |

Her hull borrows the RIB's (`tubes`, `vee`, `planing.deadrise`, `carve`) and the skiff's tiller.
She joins the RIB in `TUBED` (`damage.js`: four tube chambers kept with her hull's record), but not
in `SELF_DRAINING`: her sole is low, below the water, so she's bailed like an open boat.

What L1 found, measuring her in the game's own simulation:

- **Her tubes sit in the water aft at rest** (6 cm, dropped a little from the RIB's), which stiffens
  her: someone sat on a tube heels her about 10° (13° with the tubes up where the RIB's are).
- **A following sea throws her about.** Flat out with a fresh breeze astern, a hull this short climbs
  the back of each sea and comes off its crest bow-high: 32° at worst, against the jet ski's 38° and
  the RIB's 12°. Neither more pitch inertia, a deeper V nor smaller tubes changed it; it's how the
  game's short planing hulls meet a steep wind sea. What does help is what a real skipper does: she
  has the jet ski rider's lean fore and aft (`lean`, the same mechanism, `pitchBalance` in
  `hydro.js`), since your weight is a third of all she carries. With it, 23° at worst. In a rough
  sea astern she still rears to about 40°: ease her off.
- **Her outboard is short-shafted** (`motor.shaft`): the drawn leg was a long shaft hanging half a
  metre under her. The physics always took its push 0.28 m under her keel; only the drawing changed.
- **Her tubes are drawn for her length**: the RIB's segment counts, scaled, fewer round. 9,974
  triangles and 28 draw calls (the RIB: 21,538 and 71), within a small boat's budget.
- **Passengers sit on her tubes** (`seatsFor` in `passengers.js`): inside them there's room for one.

## Carrying her

**The platform:**
- 4.0 m across her stern and 1.7 m deep, with two chocks and two straps.
- Up, it sits 0.3 m above the water. Down, it's 0.55 m under: enough for the tender to float off.
- About 15 seconds each way (a real one takes longer).
- It works from three places: the control box at the transom, a switch at the helm, and the
  tender's remote fob (within about 30 m).
- While it's down, her engine can't go into gear (the PLATFORM lamp, and the game says why).
- Down, it's a swimming and diving platform too. Dives can start and end there: a real step
  aboard, where today you're put back aboard at once.

**Where the tender is: one place at a time.** An owned boat is in exactly one place: in the water,
laid up, on the trailer, being shipped, or carried. Today each of those is its own field, checked
one at a time in each place that cares.

- **A new slot, `state.carried`** (tender's id → mother's id). It's not "stowed": that word already
  means laid up or on the trailer.
- **One resolver, `whereIs(id)`,** that every check goes through: laying a boat up, the trailer,
  shipping, restoring a tow, the passage's carry, the fallback for the boat you're in. A tender
  can then never be carried and also laid up, shipped or trailered.
- **Loading a damaged save** settles a conflict the same way every time and says so: a boat is
  never deleted. A carried tender whose mother is missing goes to laid up at Willowhaven.

**Carried, she's cargo with an identity** (the trailer's pattern):

- She's out of the physics: not stepped, no collisions.
- Each frame she's placed on the chocks, as a boat on the trailer is placed behind the car.
- Her weight (hull, engine, fuel and whatever's in her) is a load at the platform, through
  `loadsOf`, as cargo and fittings are.
- She keeps her id, engine, fuel, damage, paint, name and lockers, all saved under her id as now.
- Her saved position is her mother's.
- The cap of three boats afloat (`MAX_AFLOAT`) doesn't count her, carried or launched, while her
  mother's afloat: they're a pair.

**Saving:**
- The platform is saved up or down, never halfway.
- A save while it's lowering is kept as carried with the platform up: next time, it lowers again.
- A save while it's raising, with the tender on the chocks, is kept as carried.

**Passages:**
- The fast passage and the crossing take her along, carried (generalising what the yacht does
  today for the jet ski and windsurf board, which aren't saved and add no weight).
- A tender left in the water stays where she is, after asking first: "Your tender's at Puffin
  Cove. Leave her there?"

## Launching her

1. **Her mother is still enough:** anchored, tied up, or drifting slowly with the lever in neutral.
   There's water enough under the platform, and the sea isn't too big for the tender.
2. **At the platform controls** (on the aft deck), *Launch the tender*.
3. **The straps come off** and the platform goes down.
4. **The tender floats off the chocks.** At that moment she becomes an ordinary boat:
   - put in the water where she lies, moving as her mother is;
   - held by a 3 m painter to her mother's quarter (the towline's own physics, short), so she
     can't drift off while you climb down.
5. **Step down into her** from the platform: a step, not a jump to the helm. Start her outboard.
6. **Put her in gear and the painter's let go.** She's yours to drive.
7. The platform stays down (a swim step) until you raise it from the box, the helm or the remote.

## Recovering her

1. **Lower the platform** from the tender with the remote, as you come in.
2. **Come alongside its aft edge,** parallel to her transom (the tender's bow to starboard), slowly.
   The window is generous: within about 2.5 m, 30° of square, under 1 m/s.
3. ***Haul her on.*** You step onto the platform and she's drawn over the chocks in about three
   seconds, the way a light tender is pulled on by her painter. The game helps with the line-up;
   you don't have to be exact.
4. **She's strapped down, and the platform's raised.** She's carried again.

**If something goes wrong:**
- **Her mother swings about or a wave lifts the tender mid-way:** the haul stops, she floats free
  on her painter, and you try again.
- **Wind keeps her out of the window:** *Haul her on* also works from the platform with her painter
  in your hand (she's pulled in along it).

As long as both boats float, recovery is never impossible.

## When things go wrong

| What happens | What the game does |
| --- | --- |
| Saved while the platform's lowering | Kept as carried, the platform up; launch again |
| Saved while it's raising, tender on the chocks | Kept as carried |
| Saved with the platform down and the tender in the water | The tender saved where she floats, the painter let go; the platform saved down (raise it before going) |
| Her mother moves during a launch or a haul (dragging, swinging, someone at the helm) | Over about 0.6 m/s the platform and the haul stop where they are; they carry on when she's steady. Nothing is lost |
| The lever put in gear with the platform down | Refused, the PLATFORM lamp, the reason given |
| The tender's damaged or swamped | Recovered like any boat that floats (bail her out first if she's full: the weight's real); repaired at the Marine Works |
| The tender's out of fuel | The paddles; or the jerry can from her mother's deck (`cargo.js`) |
| The tender's left ashore, anchored, or tied up somewhere | She stays there, saved like any boat of yours. Her mother can leave, after asking. The harbour office can bring her home for a fee, as it ships boats now (`state.shipping`) |
| Her mother sold | The tender's never sold with her unless you choose: she's laid up at Willowhaven |
| A conflict in a save (carried and laid up, carried and shipped, a missing mother) | Settled the same way every time (carried, then afloat, then laid up), and said; never deleted |
| Playing together: the owner leaves mid-launch, or a friend in the tender drops out | The owner's game keeps her where she is; a friend put back in their own boat, as crewing does now |
| Later, region streaming (step 4 of the roadmap) | A carried tender goes where her mother goes; one left in a region not loaded stays saved where she is (one set of coordinates for the whole world) |

## Playing together

The owner's game decides everything about her, her platform and her tender, as it does for any
boat today.

- **Crew aboard** walk her plan and are drawn on the floor they're on.
- **A crewmate can work the platform:** asked of the owner's game, as the helm is. Every screen
  shows the platform's height and whether the tender's carried, from her pose.
- **A friend at the tender's helm, while the owner stays aboard:** today's helm handover already
  runs the boat in the owner's game from the friend's wheel and lever. Two things to fix:
  - **The owner's game rests a boat** more than 140 m from its camera. A boat with a crewmate at
    her helm must never be rested.
  - **The feel at 25 knots,** with every wheel movement round the network and back, has to be
    measured. If it isn't good enough, the owner's game *lends* her: the friend's game runs her
    while they're at her helm and sends her pose, and hands her back when she's tied up,
    anchored, carried, or the friend leaves. Only one game is ever in charge of a boat.
- **First, a bug found while writing this:** a friend's second boat of a kind isn't sent by its id
  (`sendPose` in `together.js` copies the kind but not the boat id, and while fishing that field is
  used for the tackle). A friend in `rib~2` is drawn as `rib`. It's fixed before L7, with a test
  through the real sending path.
- **An older game drops the whole pose of a boat kind it doesn't know** (`cleanPose`). Playing
  together needs both on the same version: if the session doesn't check, it should, and tell the
  older one to reload.

## What she costs

- **Drawing her:**
  - Outside, within the big boats' budget (about 20,000 triangles and 80 draw calls; the yacht is
    at 83).
  - The interior is its own meshes, drawn only when you or a crewmate are aboard her or within
    about 20 m.
  - From outside the windows are opaque, as the art direction says (the pilothouse's are clear),
    and glow after dark.
  - The tender is a small boat's budget (her tubes with fewer sides than the RIB's).
- **Her physics:** a hull's physics costs the same whatever her length (a fixed grid of panels).
  Carried, the tender costs nothing; launched, she's one more small hull.
- **Measured:**
  - Two new benchmark scenarios in `src/bench.js`: `liveaboard` (in the saloon at dusk, at anchor)
    and `tender` (launched and running to the beach).
  - `tools/perf.mjs` before and after each step, for the CPU time and draw calls.
  - `bench.html` on real machines for frame rates.

## Every list a new kind goes in

The game keeps many per-kind tables, and most fall back quietly when a kind is missing. Two drop
things outright: the save's own list (a boat not in it is scrubbed from saves) and `cleanPose`
(an unknown kind loses the whole pose). Both new kinds go in each of these:

- **The boat:** `HULLS` (`boat.js`), then:
  - `foilsFor` (`hydro.js`);
  - `VESSELS` (`vessels.js`);
  - `HOMES` and `ORDER` (`fleet.js`);
  - `PRICES`, `SECOND` and the fittings' price maps (`shipyard.js`).
- **The engine:** `CATALOGUE` and a new diesel in `MODELS` (`engines.js`), then:
  - `PROFILES` (`engine.js`);
  - the trials (`tools/engine-trials.mjs --calibrate`);
  - `DASHES` (`dashboard.js`);
  - `LEVERS`, `LINE_MAX` and `FIGHT_MAX` (`throttle.js`);
  - `CRUISE` (`offshore.js`).
- **Fuel and damage:**
  - `TANKS`, `PETROL` and `BOAT_PER_S` (`fuel.js`);
  - `SEALED`, `SELF_DRAINING`, `PUMPS` and `layoutOf` (`flooding.js`);
  - `MATERIAL_OF` and `TUBED` (`damage.js`).
- **Her accounts and gear:**
  - `NUMBERS` (`papers.js`);
  - the fish box;
  - `GALLEY` (`stores.js`);
  - `service.js`;
  - `trollmount.js`;
  - `TRAILABLE` (`trailer.js`, the tender only);
  - `BOAT_COLORS` in `journal.js` and `map.js` (the RIB is missing from both too).
- **The save, goals and co-op:**
  - the save's own `VESSELS` (`save.js`);
  - the fleet goal's count of 11 (`goals.js`);
  - the kinds `cleanPose` accepts (from `main.js`).
- **In `main.js` itself:**
  - the engine voice;
  - the first-time tips;
  - the boats carried on the fast passage;
  - the crossing card (it says "the yacht", and checks fuel only for her);
  - the crossing's fuel (`CROSS_FUEL` and the flat `PASSAGE_FUEL` in `fuel.js`, both from the
    yacht);
  - the pumps.
- **Tools:** `tools/boatshots.mjs`, `tools/perf.mjs`, `src/bench.js`.
- **Tests:** about twenty files loop over every kind.
  - The hull checks each new boat must pass: draft at rest between 3 cm and her depth; added mass
    between 0.3 and 2 times her mass; every load within her length.
  - `fleet.test.mjs` expects any three home boats to fit on your finger. The trawler can't share
    it with the yacht and another, so the test changes to the berth rule in choice 3, and says so.

## The order

Each step is a pull request with its tests, checked in the browser, and merged before the next.

**L1: the tender, a boat of her own (done).** Her hull, tubes, tiller and paddles; the Petrel 15, 20
and Tern 30; every list above; sold and hired at the Marine Works; trailerable. Tests:
`tests/tender.test.mjs`; pictures: `docs/fleet/after/tender*.jpg`. In the browser: 22.3 knots flat
out, a line cast from her seat, and saved and loaded again in her.
*Done when:*
- she passes the hull checks;
- her pictures stand beside the RIB's in `docs/fleet/`;
- in the browser she's on the plane at about 22 knots alone (about 27 with the Tern), fished from
  sitting, and kept by the save;
- the whole suite passes.

**L2: the trawler's hull, helm and handling (done).** What was built and measured, in the game's
own simulation and in the browser:

- **Her hull:** 13.4 m by 4.4 m, 17 t, a hull body drawing 0.70 m (1.16 m to the bottom of her
  keel). Her resistance has a hull-speed wall (`trawlerDrag` in `boat.js`): 7.8 knots at the
  cruising notch, 9.1 flat out. On the Marine Works' engines, the Shearwater 120 gives 8.7 knots,
  the 160 (as she comes) 9.1, and the 260 9.9: 60% more power for under a knot.
- **Way on:** 7 knots in 11 s from rest; from a cruise she runs on about 100 m. Hard over at a
  cruise she turns in about one and a half lengths; her roll period is about 3.3 s.
- **The single screw:** the inboard code takes one shaft or two (`motor.prop`, `motor.rudder`,
  `buildSingleScrew`). Her prop walk astern is small but right, held down by her full keel.
- **Her bow thruster:** 1.5 kN; from rest it swings her about 1.4° a second and stops when it
  does; once she's moving it does little.
- **Her autopilot** (`src/autopilot.js`): the boats' own course-hold law, firmer. In a fresh breeze
  on her beam it holds her within about 2°, 3° at worst. Its alarms cover shallows and land along
  her course (a minute and a half of her speed ahead, never less than 80 m) and the boat closing
  on her soonest. The anchor's dragging warning was already there for every boat.
- **Controls:** the trim keys `[` and `]` (LB and RB) work her thruster, since she has no leg to
  trim; `.` (D-pad →) works her autopilot. The hint at her helm shows both. On touch, neither yet.
- **Her berth:** the seaward side of your finger, to herself, with her platform in her length
  (`aft` in `fleet.js` ownBerths). The other side takes what fits. The harbour office won't put a
  boat in the water that won't fit; it says to lay one up first.
- **The crossing:** she's one of the long-range boats. In the ocean's swell she holds most of her
  eight knots (`seakind`, her own figure in `seaKindly`): the planing boats still slow to six. The
  crossing card, its fuel (60 litres to set out, about 35 across) and the fast passage are worked
  out for whichever boat it is, not the yacht alone.
- **A fix for every boat, found on the way:** a hull's panels were all split along the same
  diagonal, so her starboard side wasn't her port side's mirror. The water's pressure left a small
  turn on every hull at rest, and every boat left drifting on a flat calm slowly spun, two to five
  degrees a second. Each quad is now split to mirror the other side (`buildHullModel`): no turn at
  rest, and a boat left alone stays pointing where she was (`tests/hydro.test.mjs`). A turn now
  dies away in about ten seconds.
- **One test changed by it:** the RIB's rough-sea test took a single 25-second stretch of sea.
  Sampled over ten stretches, her airborne time runs 1 to 2.7 s and her worst rear 13 to 37°,
  with the old hull as with the new, so the one stretch passed or failed by chance. It now takes
  five stretches and judges their middle, with a hard cap well short of standing on her tail.
- **Deferred to L4:** building her only when she's needed. Today she costs about 75 ms to build
  and 26,000 vertices, and she isn't drawn while laid up. Her interior is what will make it worth
  doing. (L4: her interior is built when first walked; the rest of her is still built with the
  other boats, as it costs no more than the yacht.)
- **Fishing from her** waited for L3: her aft deck is reached on foot (now done, below).

What was planned for L2:
- the single screw;
- displacement resistance and her own seakindly speed;
- the thruster, the pilothouse helm, the autopilot and its alarms;
- her berth, the windlass, and the crossing (the card and fuel no longer the yacht's alone);
- built only when needed.

*Done when:*
- tests show her at about 8 knots cruising, never over about 9.3, and holding about 7 in the
  crossing's swell;
- in the browser she's berthed on the finger with the thruster, walks her stern astern, holds a
  course on autopilot for five minutes in a beam sea, and the alarms sound before the shallows;
- she draws within budget.

**L3: walking aboard (done).** What was built, and where it differs from the plan above:

- **`src/deckplan.js`**: floors (convex shapes, each at a height, or a height that follows her
  sheer or ramps across a sill), furniture (boxes) and spots. There are no wall segments: a wall
  is simply the edge of a floor with no floor beyond it, and a doorway is a small floor of its own
  bridging the two either side. That keeps every wall closed by construction. A step slides along
  what it meets, is taken in 5 cm pieces so nothing is tunnelled through at a run, and never goes
  up or down more than a step. Her side decks come in pieces short enough to follow her curve.
- **Her plan:** the aft deck (between the side lockers, full width forward of them), the side
  decks either side of the house, the foredeck either side of the trunk and across to the
  windlass, the pilothouse sole (up a step through a door each side; the console, chart table and
  helm chair walked round), and the swim platform, down through the gate in her transom to port.
  The saloon is closed until L4 builds it; its door is a spot already. The model's bench, lockers
  and gate are placed from the same numbers as the plan (`trawlerPlaces`).
- **You aboard:** the deck figure, as on the deck boats, at each floor's height (the pilothouse
  sole, her sheer, the platform). The camera follows you on deck, not her middle; first person
  stands at your eyes. Inside the pilothouse in third person her roof (and the arch on it) lifts
  away; it is a mesh of its own.
- **Leaving the wheel:** at rest as on the other deck boats, or under way with her autopilot on.
  In the browser, at eight knots on autopilot, walking from the wheel out of the door, aft along
  the side deck to the aft deck, she held her course within 2°.
- **Fishing:** only out on deck (the aft deck, the side decks, the foredeck, the platform), never
  from her wheel or indoors; the game says which. Walking with a line out works as on the other
  deck boats.
- **Crew:** a friend aboard walks the same plan; those who see them place them on its floor's
  height, found from where they stand (`cx`, `cz`), so the pose needs nothing new yet. The
  skipper's own place aboard in her pose is left for L7, with the rest of sailing her together.
- **The controls** are the deck boats' walking (keyboard, controller and touch alike, through
  the same input), so nothing new was needed.
- **Tests:** `tests/deckplan.test.mjs`: no walking through the pilothouse's side, the saloon, her
  bulwarks or her furniture however long the step; sliding along walls; every spot reachable from
  her wheel and back; up into the pilothouse and down to the platform with no step over 15 cm;
  fishing refused at the wheel and indoors; the roof; a friend walking the same plan. Her pictures
  in `docs/fleet/after/trawler*.jpg` are updated (66 draw calls, 10,342 triangles).

What was planned for L3:
- `deckplan.js` with tests;
- her plan, with one figure aboard on several floors, the stairs and doors;
- the cameras;
- leaving the wheel on autopilot or in neutral;
- crew on the same plan, and the pose with floors.

*Done when:*
- tests show no walking through walls or tunnelling at a run, every spot reachable from every
  other, and the stairs joined;
- in the browser she's walked end to end on keyboard, controller and touch, at anchor in a swell
  and at eight knots, with no clipping, and the cutaway shows each room.

**L4: living aboard (done).** What was built, and where it differs from the plan above:

- **The interior**, placed from the same numbers as her plan (`trawlerPlaces`): the saloon in
  through the sliding door off the aft deck (the door is an opening now, its door slid aside), with
  the galley to port (stove, sink, lockers), the dinette to starboard, the settee forward of the
  galley and the engine-room hatch in its sole; four steps up from it through a doorway in the
  pilothouse's back; a companionway down from the pilothouse (to port of the steps) to the cabins:
  the lobby at its foot, the guest cabin with its two bunks to starboard, the heads to port, and
  forward the owner's cabin with its lockers and the double berth narrowing into her bow. Bulkheads,
  linings and deckheads close the cabins in; her deck is open over them (the pilothouse sole and
  the trunk, which now starts at the pilothouse's front, cover them).
- **Heights differ from the table:** the cabins' sole is 0.4 m up from her keel, about 0.3 m
  below her waterline rather than just above it, for headroom under the pilothouse sole (the
  water's kept out of her by the hull's lid, as in every boat).
- **Clearance:** where you stand inside keeps 0.2 m from every wall (`CLEAR`), 0.1 m on the
  narrow side decks, so in first person your eyes never come up against one. Floors that lie one
  over another (the cabins under the pilothouse) are told apart by the height you're at.
- **Every spot wired to what the game already does:** the galley cooks and eats from her stores
  (the cabin boat's galley, `openCamp('cook', 'cabin')`); the dinette opens your journal; the
  engine-room hatch looks her over; the chart table gives the forecast (the harbour board's
  outlook) and opens the chart; the bunks and your berth sleep (at anchor or made fast, as the
  cabin boat's bunk); the heads is a wash. Nothing new behind any of them.
- **Lights and the night:** a lamp in the saloon and one below, and a light of her own in the
  room you're in, after dark or while you're inside; her windows glow from outside after dark.
  Inside counts as indoors for how you feel. On her deck at anchor she offers no bivvy: you go
  below.
- **The camera:** in the saloon and the pilothouse, third person lifts the boat deck and the
  pilothouse roof away; below, the view goes to your eyes as you start down the companionway and
  back out as you come up.
- **Built when needed:** her interior (two meshes) is built the first time anyone walks her
  decks; her lamps and her light are there from the start, so the scene's lights never change
  under you. Until then she's 61 draw calls and 10,700 triangles; inside and all, 63 and about
  12,300.
- **In the browser,** at anchor off Gannet Isle: through the door to the galley (cooking), the
  dinette (the journal), the engine-room hatch, up the steps to the chart table (the forecast and
  the chart), down the companionway (first person) to the guest cabin and the owner's berth, slept
  there to dawn and woke in it, and back up (third person again); after dark her windows glow.
- **Tests:** in `tests/deckplan.test.mjs`, the way in through the door, up the steps and down the
  companionway, never more than a short step; floors one over another kept apart; the cabins'
  bulkheads and doors; standing clear of every wall and under the deckhead; below, the lamp and
  the windows; in `tests/trawler.test.mjs`, the interior built only when wanted, and her budget
  with it.

What was planned for L4:
- The interior built: saloon, galley, pilothouse, cabins, heads, the engine-room hatch.
- Every spot wired to what the game already does.
- Lights inside, the night aboard, meals under way.

*Done when:* a whole day is lived aboard in the browser, at anchor off Gannet Isle: woken in the
cabin, breakfast, the forecast, fishing from the aft deck, a dive, dinner, the night. The interior
draws within budget.

**L5: the tender carried (done).** What was built, and where it differs from the plan above:

- **`src/carried.js`**: `state.carried` (tender's id → mother's id), `whereIs(id)` (carried, the
  trailer, the supply ship, laid up, or afloat: in that order), the slot cleaned from a save (a
  tender of yours on a mother of yours, one to a platform), and `settle`, which puts a boat in one
  place the same way every time: carried first (off the trailer, the ship and the laid-up list),
  and a tender whose mother is gone laid up at Willowhaven. Never deleted.
- **On the chocks:** a carried tender is out of the water as a laid-up boat is (out of the
  physics, the collisions and the count of three afloat), and each frame she's placed on two
  chocks across the trawler's swim platform, her bow to starboard, riding every move of her
  mother's, as a boat on the trailer rides behind the car. Nobody's drawn in her. Her saved
  position is her mother's; aboard her in a save, you're aboard her mother.
- **Her weight** (150 kg of hull and outboard, and her fuel) is a load at the platform, through
  `loadsOf`: the trawler sits a little lower by the stern with her.
- **She comes with the trawler:** buying the trawler with no tender of your own gives you hers
  (her papers say so), on the chocks; with one of your own laid up, she goes on the chocks
  instead. The harbour office says where she is.
- **Not done here, and why:** there's no selling of boats in the game, so nothing to do when a
  mother is sold. Passages carry her with no work of their own: she's placed from her mother
  wherever her mother goes. The trailer, laying up, shipping and restoring a tow never see her,
  since she isn't among the boats in the water; `whereIs` is there for L6, when she comes and
  goes. Launching and recovering her is L6.
- **In the browser:** on the chocks at the berth and under way at eight knots, her weight on the
  trawler, and the same after a save and a reload.
- **Tests:** `tests/carried.test.mjs` (where each boat is, the slot cleaned, conflicts settled,
  the save, the trawler coming with her tender, where she rides).

What was planned for L5:
- `state.carried`, and `whereIs` with the checks moved onto it;
- placed on the chocks, her weight at the platform;
- out of the physics, collisions and the cap of three;
- the save and its checks; the passages carrying her; selling; she comes with the trawler.

*Done when:*
- tests cover every conflicting slot, a missing mother, save and load both ways, and a passage
  with her aboard;
- in the browser she sits on the chocks through a rough crossing, her mother a few centimetres down
  by the stern.

**L6: launching and recovering.**
- The platform: its model, movement, the three controls and the interlock.
- The painter, the launch, the recovery window and the haul.
- Every rule in the table above; diving and swimming from the platform.

*Done when:*
- a test covers each rule;
- in the browser the whole sequence is played at anchor off Gannet Isle: launched, to Puffin Cove's
  landing, ashore, back, recovered;
- twenty deliberately sloppy recoveries in a row, none impossible.

**L7: together.**
- The boat-id fix first.
- Crew on the plan; the platform asked of the owner's game.
- A friend at the tender's helm: never rested; its feel measured; lent if it needs to be.
- The version check.

*Done when:* two real browser clients (`tools/local-realtime.mjs`) play it: one aboard getting the
dive kit ready, the other takes the tender ashore and back and it's recovered; a disconnect
mid-launch and mid-haul; nothing doubled on either screen through a reload.

**L8: where she fits.**
- Her price and hire, and Free Roam from the start (once Free Roam exists).
- Her pages at the Marine Works; her papers keeping nights aboard and the tender's trips.
- A first liveaboard voyage suggested: south to Las Brasas, anchored in a cove, the tender ashore.
- The benchmarks, `README.md`, and her row in `docs/FLEET-AUDIT.md`.

*Done when:* the numbers are in `docs/PERFORMANCE.md`, and the voyage is played through from the
Marine Works to the cove and home.
