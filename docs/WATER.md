# The sea, close up: an audit and a plan

What the water and the boats on it do now, looked at closely; what the best real-time oceans and
boat models do that they don't yet; and the order to close the gap in, one pull request at a time.
The research behind it is in `docs/water/research-ocean.md` and `docs/water/research-boats.md`,
kept as written, with every source and every licence checked.

## How it was looked at

- **The code:** the surface shader (`src/world/water.js`), the wind sea (`src/world/ocean.js`,
  `oceangpu.js`), wakes and foam (`wakes.js`, `waterfx.js`, `foamTrails.js`), the sky
  (`sky.js`) and the boats' physics (`src/hydro.js`, `src/boat.js`).
- **The game, in a browser:** the open sea photographed close up (Ultra graphics, Ocean: Full) in
  a calm morning, a moderate breeze at noon, a fresh breeze in the afternoon, at dusk and in a storm,
  looking towards the sun, away from it and down. Software rendering, so these say what it looks
  like, not how fast it runs.
- **What the leaders do:** papers, conference talks and open repositories on real-time oceans
  (Bruneton et al. 2010, Dupuy and Bruneton 2012, Horvath 2015, Atlas, Crest, War Thunder, Sea of
  Thieves, Unreal and Unity's water) and on boats in games and naval architecture (Kerner's model
  for Just Cause 3, the MMG manoeuvring method, Savitsky's planing method, drift and roll
  measurements on small craft).

## What it found

**A bug that hid every whitecap.** Whenever the wind was too light for whitecaps (under about
4.5 m/s, as at most starts), the pinch at which the crests break was left at minus infinity, and
every cell of the foam became "not a number". Nothing ever cleared it, so from the first light air
on, no whitecap was drawn again, in a fresh breeze or a gale. It had been so since the FFT ocean
went in. Fixed in W1, below.

**The rest, against the best real-time oceans:**

- **The sun on the water** is one fixed highlight that widens with distance by a rule of thumb, plus
  random sparkles. A real sun path is as wide as the waves too small to draw make it: narrow in a
  calm, a broad glitter in a breeze (Cox and Munk measured it). Far off, the drawn waves shimmer
  rather than averaging into the right roughness.
- **The sky in the water** is a two-colour gradient. Only the planar reflection, where it's on,
  shows clouds and the shore. At sunset the sea doesn't take the sky's colours.
- **How much the water reflects** is a hand-made curve, capped at about 70% at a glancing angle;
  real water's reflectance is 2% looking straight down and climbs to all of it at the horizon.
- **The water's own colour** is a shallow, middle and deep colour mixed by depth, lit as if it were
  a painted surface, and it's seen into by plain transparency. Real water's colour is light coming
  back up out of it, red absorbed first: turquoise over sand, the seabed reddening and then gone.
- **The horizon:** beyond 444 m the sea's surface is drawn without its waves rising and falling
  (only its shading moves), so in a storm the big seas stop at a straight line. The haze is one colour whichever way you look, never warmer towards the sun.
- **The finest waves:** the short-wave layer stops at about 0.4 m. The centimetre ripples that make
  the glitter are only painted noise.
- **Wakes** are worked out, not simulated: they don't bounce off hulls or each other.

**The boats** are already better than most games' (a real panel hull, measured resistance, foils,
ropes, flooding, damage). The hull panels already feel the water's own motion, the waves' orbital
velocity and the current. What the research says is still missing:

- **Added mass:** the water a hull has to move as it heaves, pitches and rolls. Without it, small
  boats bob faster than real ones: by the research's estimate, about one and a half times.
- **The rudder, keel and propeller don't feel the waves' orbital motion**, only the current. So a
  rudder doesn't lose its grip on a crest in a following sea, and a boat doesn't surf.
- **Calibration against measurements:** roll periods and how they damp, drift in the wind (a 4 m
  skiff drifts at about 2.5% of the wind's speed), and the planing trim (Savitsky).
- **The propeller:** thrust falling off with speed, the wash over the rudder, prop walk astern, and
  ventilation that comes and goes rather than on or off.
- **Shallow water:** a boat near the critical speed for the depth (√(gh)) meets more resistance, and
  her wake widens.
- **Anchors:** the rope's catenary, holding by bottom type, and dragging.

## The plan, by what it's worth for what it costs

Each item is its own pull request, checked in the game before and after, with tests that fail
without it.

### The water

| | What | Why it shows | Cost | Sources |
| --- | --- | --- | --- | --- |
| **W1** | **Whitecaps back** (the bug above), and drawn as foam is: a web of bubbles, dense white just broken, thinning to lace as it ages, a turquoise glow of bubbles under it | Every breeze and every gale | None | Dupuy and Bruneton 2012; Monahan's whitecap cover (already used) |
| **W2** | **The sun and the sky on the water, done physically:** Fresnel from water's own 2%, the glitter's width from the slope of the waves too small to draw (Cox–Munk for the wind), the far sea averaging into the right roughness instead of shimmering, and the real sky (sunset colours, overcast) in the reflection on every setting | Every view, most of all towards the sun and at sunset | Low: a few dozen shader operations | Bruneton, Neyret and Holzschuch 2010 (its shader is BSD-3); Cox and Munk 1954 |
| **W3** | **The horizon:** the big seas carried on to it as roughness, haze warmer towards the sun and thinning with height, the sea meeting the sky without a seam | Storms, sunsets, any view out to sea | Negligible | Bruneton 2010; Quílez, "Fog" |
| **W4** | **The water's colour from light in water:** absorption by colour along the view path through the real depth, light scattered back up, the seabed reddening and fading with depth, and (Ocean: Full) the bottom seen through the moving surface, bent by it | Shallows, Las Brasas, the shore | Low; the refraction is medium on phones, so Full only | Unreal's single-layer water; War Thunder (CGDC 2015) |
| **W5** | **The spectrum refined:** spreading that narrows for the longer waves, shallow-water damping, and a third layer of centimetre waves close by (Full only) | The sea's texture close to the boat | Low on the CPU; the third layer is Full only | Horvath 2015; gasgiant/FFT-Ocean (MIT) |
| **W6** | **Spray and spindrift** blown off breaking crests in a gale | Storms | Low | Atlas (GDC 2019) |
| **W7** | **A simulated ripple layer** round the boat: ripples that reflect off hulls and quays and cross each other | Close by, in harbour | Medium; Full only | Crest (SIGGRAPH 2019, MIT) |

### The boats

| | What | What you'd feel | Cost | Sources |
| --- | --- | --- | --- | --- |
| **B1** | **Added mass** in heave, pitch and roll, in the body's mass (as a force it's unstable) | Boats that bob and roll at their real, slower periods | Negligible | Kerner, Part 2 (it was left out of Just Cause 3) |
| **B2** | **The waves' motion at the rudder, keel and propeller**, and wave pressure fading with depth | Surfing down a following sea; the rudder going light on a crest | Some on the panel loop | Arc Blanc (JCGT 2025) |
| **B3** | **Calibration:** roll decay, drift in the wind with a drift sock, and the planing trim checked against Savitsky, each a test | Each boat as her real one | None | De Luca et al. 2024; Allen et al., met.no report 17/2010; OpenPlaning (MIT) |
| **B4** | **The propeller and rudder:** thrust with speed, wash over the rudder, prop walk astern, ventilation with hysteresis | Docking, going astern, a hard turn at speed | Negligible | MMG standard method (Yasukawa and Yoshimura 2015) |
| **B5** | **Shallow water** by depth Froude number: more resistance near the critical speed, the wake widening | Running fast over a shoal | Negligible | Mauro et al., HSMV 2023 |
| **B6** | **Anchors:** catenary, holding by bottom type, setting and dragging | Anchoring in sand, weed or rock | Negligible | Vryhof anchor manual |

## Licences

Code from MIT, BSD or Apache repositories may be reused with its notice; everything here is being
written from the papers instead, so nothing is copied. The repositories that can't be reused in a
paid game are used as ideas only: Unity's BoatAttack and HDRP water (Unity Companion Licence),
Unreal's water (Unreal EULA), anything GPL or AGPL, and anything with no licence (Shadertoy
included). The full table, with each LICENSE file read, is in the two research notes.

## Done

- **W1:** the whitecaps are back, and drawn as foam. Before and after, an
  11 m/s breeze and a storm, the same views:

  | | Before | After |
  | --- | --- | --- |
  | Fresh breeze, 11 m/s | ![](water/fresh-before.jpg) | ![](water/fresh-after.jpg) |
  | Storm, 20 m/s | ![](water/storm-before.jpg) | ![](water/storm-after.jpg) |

  Close up in the fresh breeze: ![](water/fresh-close-after.jpg)

- **W2:** the sun and the sky in the water, done physically. The water mirrors the sky as the dome
  draws it (its glow round a low sun, dusk on the far side, a storm's dark), on every setting, not
  a two-colour gradient. How much it reflects is water's own Fresnel, 2% looking straight down and
  rising to nearly all of it at a glancing angle, a rough sea never quite a mirror. The sun's
  reflection is spread by the slopes of the waves too small to draw (Cox and Munk's, wider along
  the wind than across it, less what the drawn waves already show, all of it once a pixel covers
  metres of sea), so the glitter is as wide as the wind makes it; close by it breaks into single
  wavelets flashing. The same views, before and after (the pictures before W2 now taken on a spring
  day, so the morning and the sunset are in daylight):

  | | Before | After |
  | --- | --- | --- |
  | Sunset, 11 m/s | ![](water/sunset-before.jpg) | ![](water/sunset-after.jpg) |
  | Calm morning, 1.5 m/s | ![](water/morning-before.jpg) | ![](water/morning-after.jpg) |

- **B0 (found starting B1):** hulls that meet, solved, not sprung. Adding the boats' added mass
  (B1) turned two tests red: a rowing boat lying across another was kicked off, and a skiff tied
  at a pontoon was flung 18 m from her berth. Both were already there on main, and B1 had only
  moved the start onto them. Two hundred and fifty random overlaps of two hulls on main were
  kicked apart at up to 35 m/s in about a third of them (27 of 100 rows on rows, 34 of 50 skiffs
  on cabin boats), and some shook on for good. Each point touching was a stiff spring with a
  damper of its own: a dozen at once were more than one step could carry, and the spring letting
  go above half a metre a second, with points pushed out opposite sides, kept a boat jumping back
  and forth at ±0.9 m/s for as long as it lasted. And a boat met another as she'd meet a quay: a
  RIB ramming a rowing boat at 15 m/s nudged her off at half a metre a second.

  Now they're worked out as game physics engines work them out (sequential impulses: Catto,
  GDC 2005; Box2D, Bullet): every touching point takes just the push that stops it going in, all
  of them together, a hard knock bouncing her off a little (restitution 0.3); a hull found inside
  another is eased out at half a metre a second; the rub along it is as they move against each
  other, up to its friction. All of her goes out of each hull or quay the one way, by where her
  middle is, kept until it's clearly over. And another boat under her own physics takes her equal
  and opposite share. On the same overlaps: none kicked, all parted at 0.51 m/s; the RIB at
  15 m/s shoves the row off at 15.1 m/s, against 15.2 for two masses meeting.

- **W3:** the horizon, where the sea meets the sky. The haze was one colour for the whole view,
  warmed by turning the camera to face a low sun, so turning warmed all of it at once; and the far
  sea started a step darker than the sky just above it, 12 levels of 255 at dawn and 6 in a storm,
  a line drawn along the horizon. Now the haze is the sky's own colour along the horizon, the way
  each pixel looks, worked out as the sky dome works out its horizon: warm towards a low sun and
  bright round it, dusk-blue on the far side, a storm's dark. The far sea and the far shore fade
  into the sky just above them without a seam; under the water, the haze is the water's, as before.
  Before and after, the horizon in the same views:

  | | Before | After |
  | --- | --- | --- |
  | Calm morning, towards the sun | ![](water/haze-morning-before.jpg) | ![](water/haze-morning-after.jpg) |
  | Sunset, 11 m/s | ![](water/haze-sunset-before.jpg) | ![](water/haze-sunset-after.jpg) |
  | Storm, 20 m/s | ![](water/haze-storm-before.jpg) | ![](water/haze-storm-after.jpg) |

  Still to do from W3's line in the plan: the big seas carried out past the fine sheet (444 m) as
  roughness. In a storm the waves still end at a line there, now against a haze the sky's colour.

- **B1:** added mass in heave, pitch and roll. Each hull now carries the water she has to move as
  she bobs and pitches: from her waterline beam and waterplane, about one to two times her own
  mass for the light open boats (the rowing boat 1.5, the skiff 1.4, the bass boat 1.8) and less for
  the heavy ones (the cabin boat 0.9, the yacht 0.66); in pitch, that along her length; in roll, a
  sixth more. It's in her mass, not a force, and only as much as she's in the water: off a crest
  she falls at g. On the plane it fades out (from Froude 0.4 to 1), since there she rides a thin
  sheet of water whose push her hull's pressures already carry; carried at full speed it made her
  ride harsher (the RIB's peak jolt 2.6 g to 4.4 g in a fresh sea), which is how that was found.
  Lifted 10 cm and let go in a calm, her heave period before and after:

  | | Rowing | Skiff | Kayak | Bass | Cabin | Console | RIB | Yacht |
  | --- | --- | --- | --- | --- | --- | --- | --- | --- |
  | Before | 0.57 s | 0.60 | 0.47 | 0.70 | 0.87 | 0.90 | 0.70 | 1.30 |
  | After | 0.87 s | 0.90 | 0.67 | 1.07 | 1.17 | 1.27 | 1.00 | 1.70 |

  Driven across an 11 m/s sea, the ride is as it was (vertical jolts at the helm within about 10%
  at every speed); at rest and at a walking pace she bobs at a boat's pace, settling over about
  three swings, not a toy's two.

- **W4 (first part):** the water's colour from light in water. The sea was a see-through layer
  over the seabed, its opacity rising with depth, every colour dimmed alike: the sand in a metre or
  three of water was a flat painted turquoise under a milky veil, and Las Brasas' clear water,
  thinned to show the reef, was a milky wash over pale sand. Now, seen from above, everything under
  the sea (the seabed and its rocks, the fish, a hull below her waterline, a diver) is seen through
  the water as it really is: each colour taken up along the light's way down from the sky and back
  up to the eye (Snell's law for both), red first, and the water's own glow in its place, the more
  water the more of it. This coast's water is coastal (a summer Secchi depth of about ten metres:
  red gone in a couple of metres, blue sooner than green), Las Brasas' clear and blue (25 m and
  more); silt after a blow and a storm's churn take everything faster. The surface itself is what
  it reflects (the sky, the sun's glitter, the foam) and, through the rest, what's under it; only
  where the bottom's too deep to show does the water's own colour stand in for it, so the open sea
  is as it was. Two things that never showed under the old veil came out with it, and are put right:
  sand under the water is wet sand, darker, and the caustics gather light into their bright lines
  from the dimmer patches between (as much light on average) instead of only adding it. Under the
  water, as before. The same views, before and after:

  | | Before | After |
  | --- | --- | --- |
  | A metre or three over sand, noon | ![](water/shallows-before.jpg) | ![](water/shallows-after.jpg) |
  | In towards the beach, evening | ![](water/shallows-evening-before.jpg) | ![](water/shallows-evening-after.jpg) |
  | The same shallows as clear as Las Brasas' | ![](water/clear-before.jpg) | ![](water/clear-after.jpg) |
  | Diving, three metres down | ![](water/dive-before.jpg) | ![](water/dive-after.jpg) |

  Still to do from W4's line in the plan: the bottom seen through the moving surface, bent by it
  (Ocean: Full).

- **B2:** the waves below the surface. A wave's pressure and its orbital motion fade with depth,
  as exp(−k·depth): a short sea's within a metre or two, a long swell's hardly at all over a
  boat's draft. For the sea where she is, two wavenumbers stand for all its waves: one averaged by
  each wave's share of the height, for the pressure, and one by its share of the water's motion,
  for the flow, which leans to the shorter waves (in a fresh breeze about 17 m and 13 m
  wavelengths). Three things follow:
  - **Her hull's pressure follows Smith's correction.** Under a crest the pressure at her keel is
    less than the surface above would say, under a trough more, and deep down it's the still
    water's. A hull held still in a 6 m sea, its crests 10 cm up, now feels this share of the heave force
    she felt before:

    | Rowing | Skiff | Cabin | RIB | Yacht |
    | --- | --- | --- | --- | --- |
    | 0.91 | 0.90 | 0.82 | 0.85 | 0.62 |

    In a 20 m sea, 0.87 to 0.97. In still water, at any tide, nothing changes.
  - **The water's motion round her hull fades the same way:** what drags at her bottom is the
    water moving at its own depth.
  - **Her keel, rudders, centreboard and outboard's leg feel the waves' motion**, not just the
    current. Before, they felt only her own way through the water. On a following sea's crest the
    water runs on with her, so her rudder grips less; in the trough it bites harder. Going ahead
    at 3 m/s on a sea 20 m long, its crests half a metre up, her rudder's grip on the crest is a third of
    what it is in the trough: ((U − u)/(U + u))², u the wave's motion at the rudder's depth. Before,
    the same either way. Lying across a sea, the water's to-and-fro pushes at her keel.

  Running before an 11 m/s sea with the helm amidships, she now yaws as boats do in a following
  sea (yaw rate RMS, main then B2: the RIB 0.015 to 0.019 rad/s, the skiff 0.003 to 0.007, the
  yacht 0.018 to 0.019, her heading wandering 7° where it wandered 6°). Her roll is a little
  gentler (the yacht 3.1° to 2.3° RMS), and the RIB's worst slam into a head sea 4.4 g to 4.3 g.

  Still to do from B2's line in the plan: the propeller. It already feels the waves' rise and
  fall, racing as it comes out on a crest; its push with the speed of the water into it, the
  waves' motion included, comes with B4 (thrust with speed).
