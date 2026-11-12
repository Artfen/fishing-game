# Slow Tide: the fleet's art direction

One art team's boats. Every vessel in Slow Tide is built in code (`src/boat.js`), from the same
few pieces, coloured the same way, lit the same way. This page is the rulebook for making a boat
look as good as the best of them, and for keeping the fleet looking like one family. It comes
from the three boats that already set the standard (the **RIB**, the **centre console** and the
**sailing boat**) and from what the weaker ones get wrong (see `docs/FLEET-AUDIT.md`).

Pictures of every boat from the same six views, under the same light, are made by
`node tools/boatshots.mjs` (`tools/boatstudio.html`); `docs/fleet/` keeps the before-and-after sets.

## The look in one paragraph

Clean, stylised, low-poly boats with **real marine construction and true proportions**: a hull
you'd recognise from its silhouette alone, built the way such a boat is built (her chines, her
sheer, her transom, her deck joined to her hull with a cap and a rubbing strake), fitted out with
the things a real one has (cleats, rails, hatches, seats, consoles, lights) at their real sizes,
in a small palette of honest materials. Not photoreal; not a toy. Faceted rather than smooth;
flat colour with a little life in it rather than textures.

## Geometry

- **Built in code, merged.** A boat is a handful of meshes: her hull, her deck and fit-out (one
  merged mesh per material: `mergeParts` in `src/util.js`), her moving parts (outboard, wheel,
  rudder, sails, oars, figure) on their own, and nothing else. Static detail never gets its own
  mesh.
- **Faceted shading.** Merged geometry is non-indexed, so every face is flat-shaded. Keep it that
  way: it reads as deliberate and stylised. Smooth shading only for what is genuinely round and
  soft (the RIB's tubes, the figure, cushions where they read better soft).
- **Silhouette first.** A boat must be recognisable in profile and from above at a hundred
  metres. That means each type has its own sheer line, bow and stem rake, transom and freeboard,
  and gets them right before any detail goes on. A well-shaped hull with few triangles beats a
  badly shaped one with many.
- **Hull resolution.** About 18 to 30 stations along her and 10 to 14 points round each section,
  more where she curves fast (the bow), fewer where she doesn't. Planing hulls get a hard chine
  (two points meeting) rather than a round bilge.
- **Segments.** Rails and tubes 5 or 6 sided; wheels and rings 16 to 20 round, 6 across;
  cylinders for posts and pedestals 7 or 8; nothing finer unless it's large and close to the
  camera.

## Edges

There are no bevel modifiers here: an edge is *made* with a part.

- Every joint a real boat has a fitting at gets one: a **gunwale cap** where hull meets deck (a
  flat strip a few centimetres wide, lighter than the hull), a **rubbing strake** just under it
  (dark, proud of the side), a **toe rail** or **trim** where a cabin meets a deck.
- Big boxes (consoles, cabins, seat bases, lockers over about half a metre) get their corners
  **chamfered** or a **trim band** round the top, so they don't read as raw cubes.
- Small parts stay simple boxes and cylinders: at their size the eye reads them as solid.

## Surfaces and colour

- **Vertex colour, one standard material.** Colour comes from the vertices, set per part
  (`mergeParts` `color`), with a small random variation per face (`jitter`, 0.02 to 0.06) that
  stops a flat panel looking dead. Most fit-out shares one `MeshStandardMaterial`
  (`vertexColors: true, roughness: 0.45, metalness: 0.12`).
- **Hull paint** has the per-face alternation the hull builders give it (±2.5 %), her **stripe**
  and **bottom paint** in their own colours, the boot-top cut straight at her floating draft.
  Her paint, stripe and (on a RIB) tubes must stay recolourable by the Marine Works: build the hull
  mesh with `userData.hull` and keep painted vertices exactly her `paint`/`stripe` colours
  (scaled), as `repaint`/`recolor` expect.
- **No bitmap textures on boats.** The only canvases are her name, the dashboards and the flags.
  Wood gets the shared procedural grain (`withSurface(…, 'wood')` in `src/world/surface.js`).
- **The palette** (use these before inventing new ones):

  | Material | Colour(s) | Notes |
  | --- | --- | --- |
  | White gelcoat, decks | `#f2f0ea`, `#eef0ee`, `#e6e2d8` | warm whites, never pure white |
  | Non-skid, moulded sole | `#dcd8cc`, `#c9c5ba` | a shade darker than the gelcoat |
  | Bass-boat carpet | `#4a4f57`, `#5d6066` | charcoal; slightly blue |
  | Stainless, aluminium | `#c9cdd0` | rails, posts, cleats, hinges |
  | Black hardware | `#1d2125`, `#2b2e33` | strakes, wheels, screens' surrounds, rubber |
  | Upholstery | `#1f3b56` navy, `#e7e1d4` off-white, `#2d3a40` charcoal | piping in the hull's stripe colour |
  | Teak and varnish | `#a8784a` sole, `#7b5434` trim, `#c99a63` planking | wood boats and yacht soles |
  | Hypalon (RIB tubes) | `#5f656b`, strake `#1d2023` | |
  | Glass | `#1f2c36` to `#3a4c58`, frames `#c9cdd0` or black | opaque, dark; see windows |
  | Reels, brass | `#c9a34a` | |
  | Navigation lights | red `#c0392b`, green `#2e8b57`, white `#f1efe8` | lenses; they glow only at night |

- **Accent colour.** A boat's stripe colour is her accent: piping on cushions, the band round a
  console, a hull graphic. Use it sparingly; the rest of the fit-out stays in neutral palette
  colours so any paint the player chooses still looks right.

## Materials

| Kind | Material | roughness | metalness |
| --- | --- | --- | --- |
| Gelcoat, paint, moulded plastic | Standard, vertex colour | 0.4–0.55 | 0 |
| Fit-out (merged consoles, seats, hatches) | Standard, vertex colour | 0.45 | 0.12 |
| Stainless and chrome | in the fit-out mesh, light grey | (0.45) | (0.12) |
| Propellers | Standard | 0.18–0.35 | 0.6–0.9 |
| Carpet | Standard, vertex colour | 0.85–0.95 | 0 |
| Wood | Lambert + `withSurface('wood')` | | |
| Hypalon | Standard | 0.6 | 0 |
| Glass | Standard, dark | 0.15–0.25 | 0.2 | 

A new material only when its roughness or metalness differs enough to see; otherwise colour it
inside an existing merged mesh.

## Windows and windscreens

Opaque, dark, faintly blue panes (`#1f2c36` to `#3a4c58`), set a centimetre or two into a lighter
frame (gelcoat or stainless), never transparent unless the inside must be seen from where the
camera usually is (a windscreen you look through from the helm is low and stays out of the
first-person view). Windscreens rake back 25 to 40°; cabin side windows are long, low and rounded
off at the ends with a short frame segment rather than drawn square.

Two boats have clear glass, because their helm is behind a wheelhouse you must see ahead through:
the cabin boat (steered by the tiller aft of it, looking through its back windows, the door's window
and the windscreen; faintly tinted, the lamp's warmth glowing in it after dark) and the yacht (from
her helm under the hardtop, through the house's back window and windscreen; smoked, in black
frames). Both are built by `buildWheelhouse`; the glass sits in openings cut in the wall, behind a
frame that covers the opening's square corners.

## Metalwork

Rails 18 to 22 mm (`r` 0.018–0.022), stanchions every 0.6 to 0.9 m, the ends bent down into the
deck rather than stopping in air. Cleats are a short bar on two posts, 15 to 25 cm long; pop-up
cleats on a bass boat sit flush, only their bar showing. Everything metal is the one stainless
grey. Nothing floats: every fitting stands on a base plate or into the surface it's fixed to.

## Upholstery

Seats are a base, a cushion and a back: the cushion a slightly rounded or chamfered box with a
**piping band** round its edge in the accent colour or a darker shade. Bucket seats get a wrapped
back (three panels). Pedestal seats stand on a stainless post with a base plate in the deck.

## Wood

Planked hulls: plank colour alternation along the hull (two or three warm browns), a darker
varnished gunwale and transom cap, thwarts and knees in a mid brown. Grain from the shared wood
surface. Teak soles: narrow planks with dark seams (the sole colour with darker every third
strip).

## Plastic and fibreglass

Moulded shapes are smoother and rounder than built ones: chamfer them generously. Non-skid areas
are a shade darker than the gloss around them, with a smooth gloss margin a few centimetres wide
at their edge.

## RIBs

Tubes smooth-shaded, round in section, tapering cones aft, Hypalon grey with a black rubbing
strake and a grab line on D-rings; the rigid hull powder-coated light grey, faceted.

## Level of detail

- **Hero boats** (yours, near the camera): up to about 12,000 triangles and 40 draw calls for a
  small boat, 20,000 and 80 for the big ones (the RIB is the outlier at 21,000: her tubes).
  Measured with `node tools/boatshots.mjs --stats`.
- Details under about 3 cm don't get geometry unless they're on something you hold or look at
  from the helm.
- **Distant boats** (the harbour's, friends' far off) should not need the hero's detail: a later
  step adds a simplified model past some tens of metres (see the fleet plan, A5 and B4). Until
  then, keep the merged detail cheap: few draw calls matter more than triangles.

## Engines

The outboard is drawn from the engine catalogue (`src/engines.js` looks: cowl and band colours,
a V6's taller cowling, its size by its weight) by `outboardGeo`. It mounts on a **visible bracket
or jack plate** on the transom, its leg down through a notch or over the splash well; on a boat
steered by a wheel it has no tiller. Inboards show only their exhausts, shafts, struts, propellers
and rudders.

## Equipment and attachment

- Functional parts (trolling motors, outboards, wheels, rods, flags, the name, fittings bought at
  the Marine Works) stay separate objects attached to their systems; their positions come from
  the hull's own measurements (`hw`, `sheer`, `zAt`) so they sit on whatever hull is drawn.
- Decorative parts are merged static geometry.
- Composition matters more than count: a few right things in the right places (a cleat at each
  quarter and at the bow, lights at the bow and stern, a hatch where a locker would be) beat
  clutter.

## Lighting and shadows

Every boat mesh casts and receives shadows. Nothing glows by day; navigation lights and the
lantern glow at night. Dark colours are never pure black (the darkest is `#1d2125`), so shading
still reads in shadow.

## Checking a boat

A boat is ready when, against the RIB, the console and the sailing boat in `docs/fleet/`:

1. her silhouette reads as her type from the side and from above;
2. her proportions are a real boat's (freeboard, beam, deck heights, seat heights, the figure's
   size against her);
3. her construction is believable (where hull meets deck, how things are fixed);
4. her materials and colours sit in this palette and this page's materials;
5. nothing floats, sinks, intersects or hangs in air, at rest or under way;
6. everything you do with her still works (see `docs/FLEET-AUDIT.md`, integration points);
7. she costs no more to draw than her detail justifies.
