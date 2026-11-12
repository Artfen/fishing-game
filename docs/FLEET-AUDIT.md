# Slow Tide: the fleet, audited (November 2026, Version 91)

What every boat looks like now, what she costs to draw, everything in the game that depends on
her shape, which outside models were considered and why none was used, and the order the weaker
boats are rebuilt in. The rules the rebuilt boats follow are in `docs/BOAT-ART-DIRECTION.md`.

## How the pictures and figures are made

`node tools/boatshots.mjs` builds each boat with the game's own `Boat` class in
`tools/boatstudio.html`: the same late-morning light (the game's sun and sky strengths, ACES tone
mapping, soft shadows), a still translucent sea at y = 0 with the boat at her own floating draft
(`floatDraft`, from the physics), posed by a few of her own update steps (your arms on the tiller
or the wheel, rods in their holders). Six views each, the same for every boat: three-quarter
front, three-quarter rear, abeam (orthographic, framed to all of her), from above, at the helm
(you hidden, as in first person), and low at the waterline. Then the fleet abeam at one scale.

- `docs/fleet/before/`: the fleet as it was at Version 91 (`<kind>.jpg`, `fleet.jpg`,
  `stats.json`). Each rebuilt boat adds an `after` set beside it.
- `--light evening` / `--light overcast` for other light; `--stats` for the figures alone.
- Gameplay checks (the boat in the real game, under way, at the pontoon, fishing) are browser
  scripts in each boat's pull request.

**What the figures mean.** Software rendering (SwiftShader) in a container: pictures are faithful,
frame rates are not a real machine's. Triangles, meshes, draw calls and materials are exact.

## The fleet now

Each boat including you aboard (the figure is about 20 of her meshes and 1,700 of her triangles).

| Boat | Meshes | Draw calls | Triangles | Vertices | Materials | Build ms |
| --- | --- | --- | --- | --- | --- | --- |
| rowing boat | 24 | 24 | 3,400 | 7,423 | 12 | 45.5 |
| motor skiff | 26 | 26 | 3,444 | 7,519 | 12 | 23.5 |
| kayak | 27 | 27 | 3,550 | 7,849 | 15 | 22.8 |
| bass boat | 26 | 26 | 3,546 | 7,825 | 12 | 22.3 |
| sailing boat | 33 | 32 | 3,835 | 8,578 | 19 | 23.1 |
| cabin boat | 32 | 32 | 4,698 | 10,960 | 18 | 23.4 |
| sport-fishing yacht | 83 | 83 | 8,898 | 20,639 | 59 | 30.1 |
| centre-console boat | 80 | 80 | 7,786 | 16,086 | 45 | 29.1 |
| RIB | 71 | 71 | 21,118 | 56,431 | 43 | 40.6 |
| windsurf board | 24 | 20 | 3,669 | 8,256 | 12 | 26.6 |
| jet ski | 24 | 24 | 3,314 | 7,135 | 12 | 13.4 |

In the game (`tools/perf.mjs`, Low preset, 800×450, software rendering; the simulation's ms is
CPU work and carries over to real machines, frame rates don't):

| Scenario | Sim ms/frame (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| Willowhaven harbour, on foot (13 harbour boats, yours) | 11.8 · 20.5 | 341 | 1,291,039 | 228 MB |
| The RIB flat out in a lively sea | 12.7 · 19.2 | 148 | 205,972 | 228 MB |
| The bass boat flat out in open water | 14.1 · 22.6 | 118 | 485,848 | 215 MB |

The harbour's own boats: three skiffs, two sailing boats, two cabin boats (the *Morning Star* and
the *Bluebell*), two yachts, two centre consoles and two kayaks, all built by the same `Boat`
class as yours. A visiting friend's boat is too (`world/visitors.js`), and the boats in trouble
on assistance jobs. So a richer cabin boat or yacht is drawn two or three times in the harbour;
a richer bass boat only when it's yours (or a friend's).

## Each boat, honestly

Scored against the three references (5: as good as the best of them; 1: placeholder).

| Boat | Silhouette | Proportions | Construction | Materials | Detail | Verdict |
| --- | --- | --- | --- | --- | --- | --- |
| RIB | 5 | 5 | 4 | 4 | 4 | Reference |
| Centre console | 4 | 4 | 4 | 4 | 4 | Reference |
| Sailing boat | 4 | 5 | 4 | 5 | 4 | Reference |
| Bass boat (before A1) | 2 | 3 | 1 | 2 | 1 | Rebuild first |
| Bass boat (after A1) | 4 | 4 | 4 | 4 | 4 | Rebuilt: `docs/fleet/after/bass*.jpg`, in the game `bass-game.jpg` |
| Cabin boat | 2 | 2 | 2 | 3 | 2 | Rebuild |
| Sport-fishing yacht | 3 | 3 | 3 | 3 | 3 | Rebuild the hull and deckhouse, keep her layout |
| Motor skiff | 3 | 3 | 3 | 3 | 2 | Refine |
| Rowing boat | 3 | 4 | 3 | 4 | 3 | Refine |
| Jet ski | 2 | 3 | 2 | 3 | 2 | Rebuild |
| Kayak | 3 | 3 | 2 | 3 | 2 | Refine if justified |
| Windsurf board | 3 | 4 | 3 | 4 | 3 | Leave |

**Bass boat** (`docs/fleet/before/bass.jpg`). The round-bilged dinghy hull every small boat shares
(`hullSurface` with the default section), so from any angle she reads as a rowing boat with a
carpet. No chine, no gunwale cap or rubbing strake, the casting decks plain flat sheets, the seats
white boxes on poles, a locker lid floating on the deck, and you steering by a tiller from a
pedestal at the very stern. Nothing says *bass boat*: no consoles, no windscreen, no flush decks
with hatches, no jack plate, no electronics.

**Cabin boat** (`cabin.jpg`). A white box with square windows set on an open wooden boat, a square
door facing the helm, a flat green roof with a stovepipe. No windscreen, no deck round the cabin,
no rails; the cabin sits on the gunwales rather than growing out of the hull.

**Sport-fishing yacht** (`cruiser.jpg`). Has the right parts (wheelhouse, hardtop, cockpit, chair,
rods, rails) but slab-sided: a plain dark hull with no flare at the bow, a long box of a
deckhouse with small square windows, the hardtop a flat sheet.

**Motor skiff and rowing boat** (`skiff.jpg`, `row.jpg`). Decent small wooden boats: real sheer,
thwarts, oarlocks, wood. Plain at close range: no plank lines, a square transom with nothing on
it, the skiff's outboard clamped straight on.

**Jet ski** (`jetski.jpg`). Reads as a small open boat with a seat in it: the hull is the dinghy
section, the bars a plain bar, no hood, no footwells, no rear platform.

**The references.** The RIB: true tubes with cones, strake, grab lines, console with a screen
rail, jockey seat, roll bar. The console: deep-V hull with a hard chine, T-top, leaning post,
rails, rod holders. The sailing boat: wooden hull with sheer and thwarts, rig and sails. All three
share the construction this page's art direction is drawn from.

## What a boat's shape touches (integration points)

A rebuilt boat changes how she *looks*. Everything below must keep working, and is checked in
each boat's pull request.

**The physics is not the picture.** `hydro.js` `buildHullModel` builds her hull model from
`HULLS[kind]` (`L`, `B`, `D`, `hw`, `sheer`, `keel`, `vee`, `mass`, `draft`): buoyancy, draft,
drag, collisions with piers, boats and the bottom. The engine trials (`engineTrials.js`) and the
Marine Works' figures are measured on that model. **A visual rebuild draws a new hull over the
same envelope** (the same width, sheer and keel line) and leaves `HULLS`'s shape fields alone, so
handling, speeds, draft and contacts don't change. Where a new silhouette needs a different
envelope, that's a physics change, re-calibrated and re-measured in its own right.

What follows the hull's measurements (`hw`, `sheer`, `zAt`), so it sits on any hull drawn on the
same envelope: the Marine Works' fittings (`setFits`: sonar, battery, floodlights, livewell, rod
holders, bimini…), the trolling motor's mount (`trollmount.js`, per boat), her name on the bow
(`setName`), her flag (`setFlag`), the anchor line and mooring gear, rods in holders.

What follows the seat or standing positions (`seatZ`, `seatY`, `floorY`, `standing`): you (the
figure, your legs, your hands on tiller, wheel or oars), the rod you're using and where a cast
leaves from, first person (`eyePoint`), where a fish is held up (`holdPoint`), where crew sit
(`crew.js` `crewSpot`, `main.js` stepping aboard: clear of the skipper), walking the deck
(`deckRoom`, standing boats only).

What reads her colours: the Marine Works' paint, stripe and tube trims and their previews
(`repaint`, `recolor`, `restripe`, `retube`: vertex colours on meshes tagged `userData.hull` /
`tubes`, matched against her `paint`/`stripe` colours), `boatPreview.js`.

Moving parts with their own code: the outboard (`buildMotor`, `outboardGeo`, `setMotor` from the
engine catalogue: size, cowl, blades; trim and tilt; the tiller unless she's steered by a wheel),
the wheel (`buildWheel`: your hands follow it), the yacht's inboards, the sailing boat's rig and
rudder, the jet ski's bars, oars and paddle, the lantern (`H.lantern`), the stowed rod
(`H.stow`), the dashboards (`dashboard.js`, RIB and console), the cabin's door and roof
(`setCabin`), deck and cabin lights.

Also: the water kept out of her (`waterLid`, built from her inner hull), the bottom paint's line
at her floating draft, the spray sheet's edge (`sheetEdge`: her chine if `vee`), foam and wakes
(`wakeOf`: mass, length, fineness), friends seeing her (`visitors.js`: her kind and stripe), the
harbour's boats (`folk.js`: kind and look).

## Outside models considered

| Candidate | Licence | What it is | Decision |
| --- | --- | --- | --- |
| 3dassets.dev "bass boat" (`22256/v1/model.glb`) | CC0 | AI-generated GLB, 6.49 × 2.21 m, 5,856 triangles, 11 meshes, 6 flat materials, no textures, quantized positions; animated steering wheel and outboard tilt | **Not used.** Rendered under the studio's light: a straight-sided, barge-like plan; no hull flare, chine or gunwale; seats and console floating on a flat deck slab; the outboard a plain box. Below the RIB and the console, and 1.4× too long to scale down without wrecking its proportions. Nothing to take from it the game's own layout doesn't already need. |
| 3dassets.dev "small cabin cruiser" (`22257/v1/model.glb`) | CC0 | AI-generated GLB, 8.15 × 2.70 m, 5,612 triangles, 9 meshes | **Not used.** A rounded box for a cabin on a flat-sheered hull, a hardtop floating on posts, a slab transom; visibly generated. Below the fleet's standard. |
| alstrainfinite "Boats PolyPack Starter" (itch.io) | "Free Asset License": commercial use with credit; *reselling or redistribution not allowed* | Stylised small boats | **Not used.** Slow Tide's files are public (this repository) and copied whole to every player's device for offline play; that is redistribution of the model files. Not suitable for this project whatever its look. |
| Kenney "Watercraft Kit" | CC0 | A toy-like, deliberately simple low-poly kit | **Not used for the fleet.** Its style is blockier than the boats it would replace; the game's own procedural boats already serve as distant and background craft. |
| Soncheese "Stylized Watercraft Pack" (Fab, paid) | Proprietary; the listing restricts AI use | A coherent stylised pack | **Not evaluated.** Not purchased, not downloaded, not processed: it would need your purchase and a licence check covering automated work before anything is done with it. |

So every boat is rebuilt **in code, in the game's own style**, as the references were: no third-party
geometry, nothing to package or credit, nothing that can drift from the art direction, and every
part attached to the systems above. The two CC0 models stay in the evaluation notes only (not in
the repository).

## The plan

One boat per pull request, each with its before-and-after sheets, figures and gameplay checks;
nothing replaced until its replacement is plainly better; the old model kept behind a switch until
then.

1. **A0** (this): the audit, the art direction, the studio and the baselines.
2. **A1, the bass boat.** A modern bass boat: a hard-chine planing V over her existing envelope,
   flush casting decks with hatches and a rod locker, a cockpit with a starboard console (wheel,
   graph, windscreen) and a passenger console, bucket seats, pedestal seats fore and aft, a
   jack-plated outboard, the bow trolling motor's plate, lights, cleats, a rubbing strake.
3. **A2, the cabin boat.** A small coastal cabin boat: a cabin that grows out of the hull with a
   raked windscreen and long side windows, side decks and rails, a self-draining cockpit, a helm.
4. **A3, the yacht.** Flare at the bow, a proper sheer and boot-top, a shaped wheelhouse and
   hardtop, her cockpit and fighting chair kept.
5. **A4, the small craft.** Skiff and rowing boat refined (planking, transom, fittings), then the
   jet ski rebuilt, and the kayak if the pictures say so.
6. **A5, the fleet together.** Colours, materials, fittings and the outboard's cowling made
   consistent; a simplified model for boats far off.
