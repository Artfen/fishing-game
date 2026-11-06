# Slow Tide: the look (art bible)

One page to keep everything looking like the same game: for whoever draws, models, writes or codes
the next thing. When something new doesn't fit, change it to fit, or change this page on purpose.

## In one line

**A real sea in a hand-made world.** The water moves and catches the light the way the real thing
does; everything else (land, houses, people, boats' fittings, the paper you read) is simple,
warm and made by hand.

## Why this, and not one style everywhere

The ROADMAP's honest assessment: the near-photoreal water, the block-built people and the
code-drawn fish pull in different directions. The answer isn't to make the sea simpler (it's the
best thing in the game, and the clips sell it) or to make the people realistic (out of reach, and
cold). It's to give each layer a job and one rule, so they sit together:

| Layer | Rule | Why |
| --- | --- | --- |
| The sea and sky | Real in **motion and light**; simplified in **colour** | The physics and the FFT ocean are the game; a softened palette lets them sit beside the land |
| Land, buildings, props | **Low-poly, flat-shaded faces**, no photographic textures | Reads at a distance, cheap, warm; the light does the work |
| Boats | **Real shapes and proportions**, simple materials | They have to handle and look right; they're the bridge between sea and land |
| People | **Figures, not portraits**: capsule bodies, dot eyes, a hat | Friendly, readable at 30 m, consistent with the land; animation carries the character |
| Fish and sea life | **True silhouettes and markings**, flat colour fields, one highlight | Anglers know their fish: the shape and pattern must be right, the rendering needn't be |
| Everything you read | **Paper and ink** (notes, journal, board); a dark glass veil for live HUD | Things in the world are hand-written; live readings are clear and quiet |

## Palette

The sea and land carry the scene; accents are small and few.

- **Sea**: shallows `#5fb6c0`, deep `#1b4f78`, sea glass `#93dccd`, night sea `#0f1b2b`; sand `#a88a5c`.
- **Paper and ink**: paper `#f3e8cf`, paper shade `#e6d4ae`, ink `#35291f`, soft ink `#6e5c49`,
  the stamp (records, the catch reveal) `#b5532f`.
- **Accents**: lantern `#ffc977` (night, a fish on the finder), coral `#ff9a82` (bait, warnings
  that aren't alarms), weed `#7fc28a`.
- **Cottages**: chalk and cream walls (`#e9dcc4`, `#dfe6e4`, `#efe4cf`, `#ece3d0`), one strong door
  colour each (teal, brick, navy, oxblood).
- **Boat paints** (the Marine Works' chart): gelcoat white, navy, pillar-box red, racing green, sky
  blue, teal, cream, sunflower, black, slate grey. Hulls take these; nothing on a boat is neon.
- **Never**: pure black or pure white surfaces, saturated purple or pink outside flowers and sunsets,
  glow effects that aren't light sources.

The values live in `style.css` (`:root`) and in the code that builds each thing; keep them in sync
with this list.

## Light

The time of day is the main colour grade. Morning is clear and cool; midday flat and bright;
**the golden hour is the signature** (long shadows, warm faces, a path of light on the water: the
key art and the trailer live here); dusk goes rose and violet with lit windows; night is blue-black
with the lantern, lit windows, the lighthouse and the sea's own glow. Weather desaturates: rain
greys everything, a storm flattens the light and whitens the sea.

## Shapes and scale

- A person is 1.8 m; doors 2 m; a rod 2–3 m; the rowing boat 3.8 m. Keep real sizes: the physics
  depends on them, and wrong sizes read as toys.
- Silhouettes first: anything you'll see from a boat (a house, a buoy, a headland, a moored boat)
  must be recognisable as a shape at 30 m with no detail.
- Low-poly means few faces and visible facets, not crude: bevel what a hand would round (a hull's
  sheer, a cottage roof's ridge), leave the rest flat.
- No text in textures except names that are part of the world (a boat's name on her bow, a sign, a
  stone's inscription), drawn into canvases so they can change.

## People

Capsule body and limbs, a sphere head, dot eyes and a nose, one hat or hairstyle, a coat colour that
says who they are (every townsperson has their own; visitors get one from their name). Character is
in what they do: Bert stoops, Kit sits on the quay edge with his legs over, Mags works with her
sleeves rolled. No mouths, no faces with expressions, no realistic hands. Passengers and divers use
the same figure (divers in black).

## Fish and sea life

Every species keeps its real outline, fin positions, proportions and pattern (bars, spots, lateral
line); colour in a few flat fields with one soft highlight along the back. Size is real (a 20 cm
mackerel next to a 2 m tope). Whales and dolphins: the same rule, with breath and spray as the drama.

## The screen

- **Live readings** (the throttle, the weather, the finder) sit on a dark glass veil
  (`rgba(22,30,42,0.34)`), in the rounded UI face (Nunito), small and quiet, at the edges.
- **Things you read** (notes, the journal, the board, the catch card) are paper, in the hand faces:
  Caveat for titles, Kalam for text.
- **Prompts** are one line: a key chip and a verb ("Take the Kestrel in tow"). A toast is two lines
  at most; a card four sentences at most. If it needs more, it belongs in the journal.
- Nothing covers the middle of the screen while you're steering, casting or fighting a fish.
- Icons, when they come, are single-weight line drawings in ink, not glossy badges.

## For an artist (what's most wanted)

In order: **the people** (a proper set of figures in this style, with walk, sit, work and fish
animations), **the fish** (the 86 species as simple models or painted textures following the fish
rule), **key art** (golden hour, a small boat, a fish on, the harbour behind), **icons** for the
HUD and journal. Models as glTF, few faces, flat-shaded; textures only where a pattern needs them.

## Licences

Nothing goes in without a licence that allows it, written down: every file's source and licence in
a credits list next to it. A public repository or a free download page is not permission. No paid
assets or outside services without a decision to.
