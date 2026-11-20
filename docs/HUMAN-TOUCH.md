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

### H4: characters (issue 2)

One figure for you on foot, you in a boat and your friends (the townsfolk after), with better
proportions, hands, feet, a face, hair; outfits by activity (a selected few done well first:
foul-weather gear, a fishing vest, a wetsuit, a hoodie, waders, a life jacket); a turning
preview in Settings → You; the most visible animation fixes (hands on the wheel and bars, sitting,
casting, boarding). Older saves' looks carried over. Draw calls and frame time measured before
and after.

### H5: checking it all

The full suite; a controller-only run; a two-player run on the local relay; `tools/perf.mjs`
before and after each phase; saves from before loaded; Spanish and French screens checked.
