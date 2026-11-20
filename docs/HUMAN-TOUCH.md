# The Human Touch: audit and plan

Six things from a three-hour, two-player playtest (no bugs seen; PS4 controller and Spanish and
French new that day): menus with too much text; characters below the world's quality; friends'
characters and boats not looking as they made them; the jet ski's engine wearing on you, and
anchoring like a big boat; controller-only play not intuitive enough; friends' anchor lines not
shown. No new systems and no bigger world: make what's there finished and coherent.

## 0. The audit: what there is, and why each thing happens

### Friends' characters (issue 3)

- **The look**: 11 fields in `src/looks.js` (skin, coat, jumper, shirt, legs, boots, hat,
  hatColor, hair, beard, glasses), cleaned by `cleanLook`. Kept in `state.look`.
- **Sent**: in the presence meta and the `hello` broadcast (`src/together.js`), re-tracked when
  it changes (`renamed()`). Not in `pose`. Received in `named()` (`p.look = cleanLook(look)`).
- **Drawn** (`src/world/visitors.js`): on foot a townsfolk `Figure` (`src/world/folk.js`) from
  `figureLook`; at the helm, the boat's own figure, five colours set by hand.
- **Why friends saw the wrong look**:
  1. A new game's `state.look` is `null` until Settings → You is opened, so **nothing is sent**:
     friends see a look made up from your name (`lookFor`), you see the yellow coat.
  2. `figureLook` **drops jumper, shirt, beard and glasses** and draws the sun hat as a bucket
     hat; the folk `Figure` has no beard or glasses.
  3. At the helm, the friend's figure **keeps the boat's sun hat** whatever their hat, no beard,
     no glasses, always the coat colour (`dressFigure` is never called for it).
  4. When a look changes or arrives late (a `pose` can come first), the figure on foot is rebuilt
     but **their boats come back from the kept cache with the old colours** (`keptBoat` before
     colouring), for the rest of the session.
  5. The map's dot for a friend is their name's colour, not their coat.

### Friends' boats (issue 3)

- **The boat's looks**: `state.yard.looks[id]` = `{ paint, stripe, tubes, flag, name }` by
  boat **id** (`'rib'`, `'rib~2'`), and visible fittings `state.yard.fits[id]`; applied to your
  own boats by `applyYard()` (`src/main.js`) through `Boat.repaint/restripe/retube/setFlag/
  setName/setFits` (`src/boat.js`).
- **Sent**: nothing. `pose` and `fleet` carry each boat's kind and id and where she is.
- **Drawn**: a friend's boat is the kind's stock paint with **their coat colour as its stripe**
  (on the RIB and tender, where stripe and paint are one, the coat colour lands on the hull too).

### Friends' anchor lines (issue 6)

- Your anchor (`src/boat.js`): `anchored`, `anchor = { x, z, floor, depth, out, phase, … }`,
  the catenary in `src/anchoring.js`, drawn as a `Rope` (`src/rope.js`) from the fairlead in
  `updateGear()`.
- **Sent**: one flag, `n: anchored || tied up`, for the anchor light. No anchor point, no rode,
  no phase; nothing for boats left lying (`fleet`). A friend's boat is a full `Boat` with its own
  rode, never given an anchor, and `drawBoat` never calls `updateGear()`.

### The jet ski (issue 4)

- **Sound** (`src/audio.js`, the engine voice): a sawtooth and a square through a resonant
  low-pass whose cutoff reaches **about 2.9 kHz** at full throttle (an outboard's stops near
  1.2 kHz), amplitude-modulated at **50–100 Hz** at speed (the "rough", rasping range), pitch tied
  straight to the throttle with no variation, no water roar or intake hiss, and the loudest of all
  the engine voices. No volume slider of its own: it's under "Fishing and boat sounds". A friend's
  jet ski is voiced as an outboard.
- **Anchoring**: `anchorCheck` only refuses the windsurf board, so the jet ski has the **full
  anchor and 50 m of rode**. No beaching state; tying up works.

### Controller-only play (issue 5)

- Works: every button press is an action (`src/gamepad.js`), menus move by D-pad/stick, A, B,
  bumpers for tabs, right stick scrolls; names as printed on the controller; any layout set up.
- **Not possible with a controller**: typing (your name, a session code to join, a gift code,
  titles for photographs and map marks); the map's canvas (placing a mark); dragging the boat
  preview round. Remapping buttons isn't offered.

### Menus (issue 1) and characters (issue 2)

- Menus: the backpack already shows rendered equipment (`gearView.js`), the shipyard a 3D boat
  (`boatPreview.js`); Settings and several panels are long paragraphs of explanation.
- Characters: three figures built in code from capsules and cylinders: you on foot
  (`walker.js`), you in a boat (`boat.js`), townsfolk and friends (`world/folk.js`); simple
  limbs, no hands or faces to speak of.

## The plan

Each phase is its own set of commits and pull request, tested before the next.

### H1: multiplayer, everyone as they are (issues 3 and 6)

| Step | What | Depends on | Test |
| --- | --- | --- | --- |
| H1a | Always send your look (the default when unset); friends drawn with every field: the real sun hat, beard, glasses, the top you're wearing (coat, jumper or shirt) | – | Unit: look sent from a new game; figure has beard/glasses; two browsers: A sees B's exact look |
| H1b | The helm figure dressed by `dressFigure` with the friend's look | H1a | Two browsers: B at the helm, A sees B's hat, beard, glasses |
| H1c | Boats: each boat's looks (paint, stripe, tubes, flag, name, visible fittings) sent in the presence meta by boat id, cleaned on arrival, applied to their boats (riding, lying, towed, carried) and re-applied when they change; no more coat-as-stripe | – | Unit: clean/validate; two RIBs painted differently stay apart; live repaint seen without rejoining |
| H1d | Kept boats re-dressed (no stale colours); the map dot in their coat colour | H1a, H1c | Change look mid-session: boat and figure follow |
| H1e | Anchor: the pose and fleet say anchored (with the anchor's point and the rode out, and dropping or hauling) apart from tied up; a friend's boat draws its rode from its fairlead to that point, sagging, shortening as it's hauled; none for a boat tied up; only near enough to see | – | Unit: clean/validate; two browsers: drop, swing, haul, join after anchoring, boat left at anchor |

Risks: presence meta size (kept small: ids, short values, a few boats); old versions (fields are
optional: an older friend still sees the old look); performance (re-dress only on change, rode only
near).

### H2: controller first, and menus with less to read (issues 5 and 1)

1. An on-screen keyboard for every text box (a digit pad for session codes), opened with the
   confirm button; the map's marks placed with the stick; the boat preview turned with the stick.
2. A controller-only run from the title to saving, with each snag written down and fixed.
3. A control guide the first time a controller is used; contextual hints kept.
4. The most text-heavy panels made visual: Settings (icons, one-line descriptions, the rest
   behind "more"), the backpack (grid of pictures, details on selection), the shipyard (the boat
   first, figures as bars), tackle (suitability as icons). Translated; nothing clipped in Spanish or
   French.

Simpler first: a radial menu only if the run shows the shortcuts aren't enough; remapping beyond
the existing layout set-up only if asked for.

#### H2 as built

- **Typing** (`src/osk.js`): A on any text box opens an on-screen keyboard over everything. The
  D-pad moves round it, A types, B deletes, Y gives capitals and then the accents Spanish and
  French need, X a space, Options is done. A session code (`inputmode="numeric"`) gets a digit
  pad. Done gives the box its change event and focuses what you'd press next: its form's button,
  or the first button after it in its panel.
- **The chart** (`src/map.js` `stick`, `tapCentre`, `tapAt`): the right stick moves it, the
  triggers zoom, X marks the spot under a crosshair (or adds the route's next point, or opens the
  mark there). The mouse's click and X share `tapAt`. A hint on the chart, only with a controller.
- **The Marine Works' boat** turns with the right stick, as a drag turns her.
- **The controller guide** (`src/padguide.js`): a drawing of the controller, named as printed on
  yours, each hand's buttons beside it with what they do as you play (checked against the button
  map by `tests/controller.test.mjs`). Once, the first time you play with a controller, after a new
  player's questions and a few calm seconds; Settings → Controls shows it again.
- **The controller-only run** (a simulated DualSense, nothing else, every one of the brief's
  sixteen steps) and what it found, each fixed:
  - the name prompt's keyboard handed the focus back to the box, so A only reopened it;
  - a question focused its last button ("Old salt") rather than the recommended one (Angler);
  - the harbour sheets' tabs weren't tabs to the bumpers (now `role="tab"`);
  - a pane drawn again after a choice lost the focus, or put it on the wrong ‹ › arrow (now found
    again by id, by words and label, by words without their numbers, or by place: `gamepad.js`);
  - at a motorboat's helm the bumpers trim, so there was no way to change rod or bait: at anchor or
    tied up they're the rods' again;
  - there was no way to leave without closing the tab: the journal's "Save and go to the title
    screen".
  The radial menu wasn't needed: every step had a direct button.
- **Less to read**: a Settings row shows the first sentence of its line; the rest comes up on the
  row you're on (focused, or under the mouse), so nothing is lost and nothing needs an extra
  button press. Controls folds its long explanations, its list of keys and its list of buttons
  (the one for what you're using open). The Marine Works' fittings show their paragraph on the
  focused row, and each engine its top speed, range and weight as bars beside the figures (from
  the same trials the words use, nothing invented). Controls went from 11,100 characters on show to
  4,700, the Fit-out from 6,500 to 3,150. The backpack and tackle were already pictures, checks
  (✓ ! ✕) and "Good for" chips from Step 6; a few words there and in the Marine Works that were
  still English in Spanish and French are translated now.

### H3: the jet ski (issue 4)

1. Its own engine voice: lower cutoff and no resonance peak, the "putter" modulation gone at
   speed, a little pitch drift with the waves, a filtered noise layer for the water and the
   intake, softer at full throttle; a friend's jet ski with the same voice; an Engines volume
   slider.
2. No full anchor: beach her (run her onto sand or shingle and she stays), tie her up, or a small
   grapnel (a fitting) that holds only in shallow water (to 5 m, 10 m of line), said plainly
   when it won't.

#### H3 as built

- **Her voice** (`src/enginevoice.js`, used by `src/audio.js` for your engine and for one heard
  across the water): the jet ski keeps her character (a higher drone than an outboard) but loses
  the rasp. The filter peaks at 1.3 kHz rather than 2.9 kHz and without a resonant peak; the second
  oscillator is a triangle, not a square; the putter (the amplitude flutter at the firing rate)
  is there at idle and gone by half throttle; the pitch wanders a few cents, slowly; a band of
  noise under it, rising with speed, is the water and the intake. Measured in the browser at full
  throttle against main: spectral centroid 503 → 396 Hz, energy above 2 kHz 4.2% → 1.3%, loudness
  halved (RMS 0.036 → 0.018, half the skiff's), envelope flutter 0.63 → 0.25. The outboards and
  diesels are unchanged, number for number (`tests/jetski.test.mjs`).
- **A friend's jet ski** sounds like one (it was voiced as an outboard).
- **Engines** have a volume of their own (Settings → Sound): yours, its starter, and other boats'.
  A game from before starts it where its "Fishing and boat sounds" was, so nothing gets louder.
- **No full anchor.** On a jet ski the anchor button:
  - in the shallows (her bow in less than her draft and 0.6 m), at low speed, **beaches her**: she
    lies where she is, the waves lifting her, until the button again or the throttle pushes her
    off. Not on rock ("you'd hole her"). Kept in the save; friends see her held, with no rope.
  - with a **folding grapnel** fitted (the Marine Works, £25, the jet ski's alone), throws it over
    in water to 5 m on 10 m of line; it holds half as hard as an anchor, and says so when it
    drags. Deeper: "Too deep for her grapnel (7.5 m): its line is 10 m…".
  - otherwise says plainly that she carries no anchor, and what to do instead.
  Her first-time tip, the helm's hint line and the diving prompt say the same.

### Between H3 and H4: two stutters from a playtest

Opening a menu stuttered, and a caught fish froze the game for about a second before its card
came up. Profiled in the browser (the game stepped frame by frame, the CPU sampled):

- **The cause, both times: the studio** (`src/gearView.js`), the small separate renderer the
  backpack, field guide, journal and catch card photograph tackle and fish in. Each picture was
  rendered and turned into a PNG with `toDataURL` at once: a synchronous read back from the
  graphics card (which waits for everything drawn so far, a first use's shader compiling with it)
  and a PNG encoded on the main thread. The catch card waited for its fish's picture; a panel
  filling with pictures made one after another, frame after frame.
- **Shader programs: one per species.** The fish bodies' program key carried the species' id
  (`anatomy.js`), though nothing in the shader differs between species of a kind (their skins and
  sheen are textures and uniforms): every species seen for the first time compiled a program, in
  the game and in the studio.

Fixed:
- The studio warms in the background a few seconds into the game: its renderer, its light, and
  the programs for one fish of every kind of shader (`fishVariants`) and the tackle's, compiled
  with `compileAsync` (the browser's own thread where it has one). Afterwards no panel compiled a
  program in the studio (before: 34 new opening the journal, 35 the backpack).
- Pictures for panels (`thumbAsync`) are snapshotted and encoded off the main thread (`toBlob`);
  the catch card's fish is drawn straight into the card a frame after it's up (`drawInto`, through
  `createImageBitmap`), with no PNG at all.
- The fish bodies share one program per kind: the game's own programs in the harbour went from 480
  to 252 (fewer to build at the start and as new fish come into view). The field guide's pictures
  are identical to before, pixel for pixel.
- The map's chart and the journal's little map are read a few rows a frame in the background
  (`bakeSome`, `buildMapBase(budget)`), finished at once only if opened first; both identical to
  before.

Measured (software graphics here, so the times are this machine's, not a player's; the shape is
what counts): the frame the fish comes aboard went from 1,720 ms to 24 ms (a normal frame here is
15–25 ms); the key opening the backpack from 80 ms to 17–24 ms, the map 337 ms to 18–23 ms,
the journal 112 ms to 20 ms.

### H4: characters (issue 2)

One figure for you on foot, you in a boat and your friends (the townsfolk after), with better
proportions, hands, feet, a face, hair; outfits by activity (a selected few done well first:
foul-weather gear, a fishing vest, a wetsuit, a hoodie, waders, a life jacket); a turning
preview in Settings → You; the most visible animation fixes (hands on the wheel and bars, sitting,
casting, boarding). Older saves' looks carried over. Draw calls and frame time measured before
and after.

#### H4 as built

The simpler version, as proposed: not one new rig for everyone (walking, rowing, the helm, the
townsfolk's work each animate their figure in their own way, and rewriting all of that would have
risked every one of them), but **one set of body parts** (`src/body.js`) that all of them wear, so
you on foot, you in a boat, your friends and the townsfolk are the same kind of person.

- **The body**: a head with a jaw and chin, ears, a nose, eyes, brows and a mouth; hair round the
  back and sides (it shows under a hat) in your hair's colour; a neck; a torso broad at the
  shoulders, in at the waist and out at the hips (where an egg was); tapering limbs, rounded at the
  joints; hands with a thumb; boots with a toe and a heel; a beard that follows the jaw (the old
  one, a sphere inside the head, poked out as two wedges). The face's parts are joined per colour:
  three pieces to draw where there were four.
- **Elbows in the boat**: your arms there were one straight tube from shoulder to hand. They bend
  now (an upper arm and a forearm, `elbowFor`), on the oars, the tiller, the wheel, the jet ski's
  bars and the rod.
- **The rod in your hands**: it no longer hangs in the air as you stop aiming, on foot or afloat;
  drawn only while your hands are on it.
- **Outfits** (Settings → You, sent to friends with your look): as the weather has it, oilskins, a
  fishing vest, a life jacket, a hoodie, waders, a wetsuit. Just for looks.
- **You, turning**, at the top of Settings → You: the figure your friends see, in your look and
  outfit; a drag or the right stick turns it.
- **Old saves**: a look from before wears "as the weather has it", as it did.
- **Cost**: a figure is about 1,800 triangles, as before (the boats' drawing budgets, which count
  you aboard, hold); the harbour benchmark against main, the same draw calls and the simulation's
  time within the noise. The shapes are made once and shared by every figure, and never given
  back to the graphics card with one (`isSharedShape`).

Not done, and why: the diver keeps its own figure (`diver.js`: a suit, a mask, fins, which it
already wears); sitting and boarding were left as they are, nothing in them looked wrong at the
new proportions; the townsfolk keep their own clothes (they don't take an outfit).

### H5: checking it all

The full suite; a controller-only run; a two-player run on the local relay; `tools/perf.mjs`
before and after each phase; saves from before loaded; Spanish and French screens checked.

#### H5 as checked

- **Controller only** (a simulated DualSense, no mouse or keys, the real game in Chromium), two
  runs, every check passed. The first (19 checks): a new game from the title, the name typed on
  the on-screen keyboard, Career or Free Roam and how you like to play (the recommended choice
  focused each time), the controller guide coming up once by itself, the bumpers round every
  Settings tab, and a friend joined with the code typed on the pad. The second (29): walking and
  jogging, aboard the rowing boat and rowing, the skiff's helm, the fish finder, the chart, the
  anchor down, a cast, a fish fought and landed and kept, the other rod and the next bait, a dive
  from the anchored boat and back aboard, the backpack, a colour changed in Settings → You (the
  focus staying on it), a boat painted at the Marine Works, and the journal's "Save and go to the
  title screen", the game saved. A third, short one (6 checks): Settings → You reached with the
  bumpers, and the right stick turning the figure all the way round (its face comes and goes:
  30–63% of the head's box face-coloured over the turn, 43–45% over as many frames without the
  stick), the focus staying where it was. (The jet ski's beach and grapnel were checked with the
  pad in H3.)
- **Two players** on the local relay (`tools/local-realtime.mjs`): H1's twelve checks (each sees
  the other as they made themselves, in their boats, with their anchor lines), and H4's: a
  friend who puts a life jacket on is seen wearing it at the jet ski's bars.
- **Old saves**: a game saved by the version from before the Human Touch (main at `2cda5ac`)
  loads: its look as it was, an outfit "as the weather has it", the Engines volume where its boat
  sounds were, and a jet ski anchored the old way still at anchor.
- **Spanish and French**: the screens this phase changed or added, in both (Settings → Audio with
  the Engines volume, Settings → You with the turning figure and the outfits, the jet ski's
  anchor with the grapnel; the controller guide was checked in H2); nothing overflowing after
  one fix: the outfits' row in French, squeezed a word a line beside its seven choices, has its
  words above them now.
- **A friend's figure, given back**: `tests/together.test.mjs` counted the body's shared shapes
  as a friend's own; it leaves them out now, as the charters test does (they aren't theirs to
  give back: every other figure still wears them).

**Performance** (`tools/perf.mjs`, high quality, against main from before the Human Touch,
`2cda5ac`; swiftshader on four cores, so the simulation's time swings by a millisecond or two
between runs of the same build):

| scene | draw calls before → now | shader programs | simulation, ms a step, before → now |
|---|---|---|---|
| harbour | 333 → 329–332 | 480 → 252 | 6.30, 7.48 → 5.89, 5.75 |
| dive_reef | 231–236 → 229–240 | 481 → 253 | 7.43, 7.25 → 5.80, 7.19 |
| liveaboard | 198 → 201–206 | 480 → 252 | 5.29, 5.25 → 6.51, 6.32 |

The liveaboard's two runs looked a millisecond slower, so it was measured again, the old build,
this one, and this one without the background preparation (the shaders and the chart readied a
few seconds in, see "Between H3 and H4") taking turns, four rounds each: old 7.08–7.41 (mean 7.23),
now 6.52–7.28 (mean 6.80), without the preparation 6.83–8.46. Not slower: the first pair fell
on a busy moment for the machine. A profile of the 240 steps showed the same work in both, the
townsfolk's boats (`folk.js drawBoat`) the largest share of three.js's, as before. The liveaboard
draws three to eight more things (your figure aboard has a neck, hair and forearms of its own
now); the harbour, with the face joined into fewer pieces, draws no more.
