# Slow Tide: fish as big as they are

The aim (from a request for realistic fish size): **you can spot the big fish in a school, and the
big species look and fight as big as they are.** A 30 cm bass and an 80 cm one, a school tuna and a
giant, should be told apart underwater without a number on the screen.

## What there was

- **Every fish was already an individual.** It had its own length from seeded dice, its weight from a
  per-species length-weight curve times a body condition (0.8 to 1.2, `behaviour.js traits`), its
  own vigour and temper, and it fought as itself. Co-op screens build the same fish from the same
  seeds, and the host settles what happens to them.
- **Each fish was drawn by its length, times an exaggeration (`visual`, 0.8 to 3.6).** That
  enlarged small fish most: sardines ×2.6 (an 18 cm sardine drawn 47 cm long), sprats ×3.2,
  mackerel ×1.6, while big species were near ×1. The art bible says "Keep real sizes"; this didn't.
  The ten older freshwater models were also 1.267 units long, not 1, so pike and trout were drawn
  27% longer again.
- **Schools mixed every size at random.** A tuna school ran from 95 to 175 cm, fish by fish, so no
  fish stood out.
- **Sizes ran `u^1.7` over the range:** the middle fish was 31% of the way up, and one in sixteen was
  in the top tenth (the "fish of a lifetime").
- **Big species stopped short of their real sizes:** bluefin 175 cm (the register's biggest is 458),
  blue marlin 330, cod 100, conger 180.
- **One shape at every size.** Weight was recomputed without condition in the market, journal and
  creel, so a fish could weigh one thing on the card and sell as another. Records kept the longest
  only. The save cut sizes at 300 cm, though marlin reach 330.

## What's done

**F1, sizes and schools.**
- **Each species' sizes** (`fish.js sizeAt`) come from one draw of the dice through a Kumaraswamy
  distribution. The middle fish sits 36% up the range, one in fourteen is in the top quarter, and
  one in a hundred is in the top tenth. In the sea, 1.2% of fish on their own are trophy-sized
  (about 6% before).
- **A school** (`ecosystem.js schoolSizes`) has a size of its own, from who it is (a hash of its id,
  not the dice). Its fish are within a tenth of that size either way, as real schools sort
  themselves by size.
- **One school in three that isn't already of the biggest has a much bigger fish of its kind** with
  it, at least half as long again. It rides at the edge, a little below.
- **Spacing:** fish in a school are spaced by their length (a school of sprats tight, of tunas
  metres apart), and kept apart by half the bigger one's length.
- **No fish moved.** Sizes still come from the same one draw each, so every fish keeps its kind, its
  place, its heading and its rank. The population's fingerprint of kinds and places is the same
  before and after (`tests/mountain.test.mjs`).

**F2, true scale.**
- The exaggeration is gone. Every fish is drawn its true length.
- The older models are scaled by their measured length (`drawnLength`), and a test measures every
  model's geometry, so this can't drift.
- Sonar echoes, surface signs and where the mouth is all follow the true size.

**F3, build.**
- A fish is as deep and thick as its weight (`girthOf`). Its condition is in its girth (by the
  square root, since weight goes as length × girth²). A species that fills out as it grows (a
  length-weight exponent over 3, such as the eel) is deeper when big.
- A test checks that the drawn volume matches the weight for every fish.
- Its tail beats at its size's pace (`tempoOf`): a big tuna sweeps slowly, a sprat flickers.
- The same fish, at the same size and build, swimming, hooked, landed, and on a friend's screen.

**F4, seeing them.**
- **Detail by apparent size** (`fishRender.js`): a fish switches to its detailed model while it looks
  as big as a 45 cm fish within the detail distance, so a 1.5 m tuna keeps its detail to three
  times as far, and a sprat only close by.
- **Big fish always drawn:** a fish of a metre or more is never thinned out by the lower graphics
  settings.
- **Specks skipped:** a fish too small to see at its distance (under about 0.0035 radians, two or
  three pixels) isn't drawn, unless it's busy with you.
- **Bait schools filled out:** small schooling fish are drawn with companions (up to six each, more
  the smaller the fish, fewer on lower settings), none of them simulated. So a bait ball at its
  true size is a dense one, and the simulation doesn't grow.

**F5, giants.**
- In 37 kinds a few fish (2 to 3%, `GIANTS`) grow past the usual range. Most are just past it and
  the biggest are rare, up to about the biggest measured: FishBase maxima rounded down, never past
  the register's own (a test holds them to it).
- Examples: a 300 cm bluefin, a 430 cm blue marlin, a 360 cm blue shark, a 150 cm cod, a 95 cm bass,
  a 130 cm pike.
- A giant school of bluefin happens, as in life.
- The usual range, and every fight, price and test tuned to it, is as it was.

**F6, the fight.**
- Within the usual range a bigger fish already pulled harder (with its place in the range), ran
  faster (with its length) and lasted by its condition. That balance is kept.
- **A giant pulls harder for its bulk** (its length over the usual top, to the power 1.5: a fish's
  pull goes about as its muscle's cross-section) and lasts longer (its strength by its length).
- The fight simulator, careful play on the tackle the guide recommends:

  | Species | Largest usual fish | Middling giant | Biggest giant |
  |---|---|---|---|
  | Bluefin | 175 cm, 71 s | 238 cm, 143 s | 300 cm: 80% landed within 5 minutes, the rest still fighting |
  | Blue marlin | 330 cm, 127 s | 380 cm, 197 s | 430 cm: 55% within 5 minutes |

- A player who reacts a little late lands every giant too (the biggest bluefin in about four minutes).
- Small kinds stay quick: a 95 cm giant bass in 24 s.

**F7, one weight and records.**
- A kept fish carries its own weight (its condition in it) into the creel, the market, the Kaigan
  counter, camp and the save. The journal shows logged weights as they were weighed.
- Each kind's heaviest is kept beside its longest, and shown in the journal. The catch card says
  "your heaviest yet" when a fish is that and not the longest.
- The save keeps sizes to 700 cm.

**Checked.** `tests/fishsize.test.mjs`, eight tests:
- the size distribution, and the giants and their limits;
- every model's measured length;
- girth against weight for every fish;
- schools (sizes, the big one, restocking);
- the renderer drawing true lengths, keeping big fish, skipping specks and filling bait balls;
- the giants' fights;
- one weight through the creel, the market and the save.

`tests/mountain.test.mjs` proves no fish moved. In the browser, pictures underwater beside schools
before and after: the sardines were drawn as big as the diver's body, and now they're a dense ball
of small fish; a 175 cm bluefin rides below and apart from its school of 120 cm fish, visibly
longer and deeper.

## Looks

No two fish of a kind quite alike, and now and then one you'd remember (`src/fishlook.js`).

**What a fish's look is.** Four numbers, from who it is: its id, hashed as its build is, and its
generation for a newcomer. So the same fish looks the same swimming, on the line, landed, in a
photograph, on a friend's screen and on every visit.
- **Its shade:** darker or paler than its kind's usual, most on its back. Each kind has its own
  range: wide for a wrasse or a trout, narrow for a tuna.
- **Where its spots fall:** for a kind with spots, its own pattern. Spotted kinds:
  - brown trout (dark and red spots, a pattern each);
  - pike (pale spots);
  - cod (speckles);
  - dusky grouper (pale blotches);
  - plaice (a few orange spots more than its kind's);
  - thornback (pale spots);
  - small-spotted catshark.
- **Its scars:** pale, ragged streaks. Likelier the bigger it is, and on the kinds that carry them:
  the tunas, billfish and sharks.
- **A rare colour morph,** if it has one:
  - **leucistic:** washed pale, its eyes still dark;
  - **melanistic:** nearly black;
  - **xanthic:** golden;
  - **albino:** white, with pink eyes;
  - **piebald:** patched with white.

**Which kinds have which morphs.** A bony fish can have the first four, about one fish in 200 any
of them and an albino one in 5,000. Those are a game's rates, not nature's: rare enough to
remember, common enough that a keen angler or diver meets one.
- **Likelier where documented:** golden trout, pike, carp and tench; piebald (ambicoloured)
  flatfish.
- **Sharks:** only the pale one.
- **The tunas, billfish, mackerels and dorado:** none (their colour is their colour).
- **Cephalopods:** none (they change colour as they please).

In the sea now, 27 of the 5,403 fish are a morph and 173 carry scars.

**A morph is only a look.** No faster, stronger, bigger or dearer. No label is shown on a fish
you haven't caught.

**How it's drawn.** One instanced attribute a fish, read by each kind's existing shader: its
shade, its spots (a cell pattern on its flanks, or on top for a flatfish), its scars, its morph.
- An albino's eyes go pink.
- No new models, textures or draws.
- A single fish drawn alone (landed, a friend's on the line) takes the same four numbers.
- A school's drawn companions vary in shade and spots, but are never a morph: the rare one is the
  fish that's followed.

**Caught.**
- The card says it in plain words: *"Golden from nose to tail: a xanthic brown trout. You may
  never see another."*
- The catch log keeps the morph, and the journal lists the unusual ones you've had of each kind.

**Checked.** `tests/fishlook.test.mjs`, five tests:
- the same fish, the same look;
- every kind's morph rates, and none for the tunas;
- scars by size and kind;
- every material taking the look, and the renderer passing each fish's own;
- a morph through the log, the record and the save.

`tools/fishstudio.html` lines up a kind: several fish, each its own, then each morph (for example
`?sp=trout&n=4&morphs=1`, or `?sp=tuna&n=4&scars=1`).

## Not done

- **Remembered notable fish** (a big released bass met again): the same fish already lives in the
  same place, with the same looks, every session, so what's missing is only a memory of what
  happened to it. It needs a version stamp on the fish's id, which changes when the population
  does.
- **Fish held up in the hands of townsfolk and friends** are still a stand-in shape sized by weight.
- **A guest's speared fish** in co-op isn't confirmed by the host (found on the way; a fix of its own).
