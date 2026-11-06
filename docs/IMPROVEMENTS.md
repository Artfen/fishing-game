# Slow Tide: quality overhaul, improvement log

What was wrong, what changed, why a player should notice, and the evidence. Kept so that each
round of work builds on the last instead of revisiting finished things without a reason.

## How things are measured

- **Tests**: the full suite (`node --import ./tests/setup.mjs --test --test-concurrency=4 'tests/*.test.mjs'`)
  and a regression test for each fix.
- **In the game**: Playwright scripts that drive the real game in a browser and check what the
  player would see (the hint line, a card, a boat's speed). "Browser-checked" below means that; it
  does not mean a person played it.
- **Performance**: `tools/perf.mjs` runs the same scenarios each time (busy harbour on foot, the RIB
  in rough water, beside a large shoal, near wildlife, the RIB's electronics in first person, a
  scuba dive) and reports the simulation's ms a frame (mean and worst 1%), real frame rate, draw
  calls, triangles and heap. It runs on a server with **software rendering**, so frame rates are a
  fraction of a real computer's and only comparable run to run; the simulation ms is CPU work and
  is the more reliable number. Multiplayer traffic: `tools/netbudget.mjs`.

## Baseline (main at 856a38d, Low preset, 800×450, software rendering)

| Scenario | Sim ms/frame (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| Harbour, on foot | 9.32 · 19.0 | 300 | 1,172,337 | 215 MB |
| RIB, rough sea, flat out | 8.28 · 13.4 | 148 | 205,972 | 202 MB |
| Beside a large shoal (skiff) | 5.43 · 12.7 | 87 | 232,421 | 202 MB |
| Near a dolphin pod (RIB) | 7.83 · 19.6 | 110 | 224,044 | 202 MB |
| RIB electronics, first person | 7.47 · 15.1 | 587 | 969,602 | 202 MB |
| Scuba dive on the Kittiwake | 13.67 · **74.8** | 263 | 832,791 | 202 MB |

Real frame rate under software rendering: 0.3–0.8 fps, not meaningful. Heap growth over a
scenario read 0 MB everywhere (the browser's memory figure is coarse here: not evidence either
way). Two things stand out: the dive's worst frames (75 ms: a visible stutter on any machine), and
first person at the RIB's helm doubling the draw calls (587).

## Audit (November 2026)

Five audits of the actual code: fishing, boats/helm/camera, UX/onboarding/controls,
performance/architecture, and the living world/multiplayer/economy/audio. Each finding was
checked in the code before anything was changed.

## Backlog, ranked

Ranked by player impact, then risk and effort. ✅ done, ⏳ in progress.

| # | Area | Problem | Fix | Risk |
| --- | --- | --- | --- | --- |
| 1 | UX ✅ | A controller-only player is stuck at the name prompt on a new game (focus snaps back to Begin) | Treat an open question as a menu for the controller | Low |
| 2 | Fishing ✅ | At the net the hint says "Hold Space to reel it in", which tears the hook out | Say "let go and tap to net it" first | Very low |
| 3 | UX ✅ | Esc/B on a question runs no button; on the style question the first-trip guide is lost for good | Esc/B picks the question's cancel; the style question still continues | Low–med |
| 4 | Boats | Tying up can put two hulls inside each other; the hull contact then fires them out of the berth (seen: 23 m/s) | Berths check boat length; overlaps ease out instead of firing | Low–med |
| 5 | Fishing ✅ | One press of Esc/B/right-click lets a hooked fish go | A second press within a moment | Low |
| 6 | UX ✅ | The radio's call can open mid-fight or mid-steer, and replace another open question | Gate on fishing, an open question, speed; count the call only when shown | Low |
| 7 | Jobs ✅ | The board ignores boats you've hired; the survey bonus is judged by the wrong boat | Pass the day; record imaging during the survey | Low |
| 8 | Audio ✅ | Being paid for a job is silent (`audio.coins` doesn't exist); so is the camp sizzle | Add the sounds; a test that every optional audio call exists | None |
| 9 | Camera | First person trails the eye at speed (0.2–0.4 m at 18 m/s), worse at higher frame rates, and judders | Lock to the eye once any glide is over | Low |
| 10 | Camera | The steady camera / reduced motion lets the eye sink 0.5 m through the console, then snap | Clamp instead of snapping | Low |
| 11 | Fishing ✅ | On a controller, side pressure on the stick also clicks the drag (to locked: a snapped line) | A firm, mostly vertical push only | Low |
| 12 | Fishing ✅ | Messages cover the live fight hint during surges ("Hold to play it" while it says let go) | The live hint shows over a message at the critical moments | Low |
| 13 | Fishing ✅ | Lost-fish reasons are wrong for a charge or a headshake ("keep the rod up"); the drag reason names a keyboard key on a pad | Record what threw the hook; name the player's own control | Low |
| 14 | Fishing ✅ | Expert technique, keyboard, in a boat: A/D do nothing in a fight (no side pressure) | Pass side pressure in a fight | Low |
| 15 | Fishing ✅ | Holding the button through a bite never strikes | Letting go strikes | Low |
| 16 | Fishing ✅ | A snapped line reels the float or lure home intact | The rig goes with the fish | Low |
| 17 | Fishing ✅ | The weigh-in rumble never plays (the catch card is a modal) | Allow vibration on the catch card | None |
| 18 | Fishing ✅ | ~33 species with flat/cling/roll styles had no moves of their own | Flatfish and octopus pump up off the bottom; dogfish writhe | Low |
| 19 | UX ✅ | One-time tips play behind full-screen menus and still count as seen | Hold tips until the menu closes; mark seen when shown | Low |
| 20 | UX ✅ | A third of toasts can't be read in their time (up to 46 characters a second) | A minimum reading time | Low |
| 21 | UX ✅ | Discovery cards clash with the catch card; queued cards can stay unseen | Set the catch modal first; drain the card queue when free | Low |
| 22 | UX ✅ | Keyboard: Tab never reaches the journal or dashboard; Space doesn't press question buttons | Find the top dialog correctly | Low |
| 23 | Boats | Docking: the tie-up prompt vanishes above 0.9 m/s with no word why, and flickers in a swell; RIB astern is weak | "Slow down to tie up", smoothed speed, firmer astern | Low |
| 24 | Boats | Fast boats have no cruise notch between half and full (RIB 4.3 → 18 m/s) | A cruise notch | Low–med |
| 25 | Boats | The dashboard's throttle lever barely moves until full ahead | Show the lever's travel | Low |
| 26 | Perf | Hull physics allocates thousands of objects a frame; idle moored boats run full physics; foam trails, effects and the HUD do constant work; figures and friends' boats leak | Pools and scratch objects, rest for still moored boats, change-only DOM writes, disposal | Low–med |
| 27 | Co-op | A guest's market and kitchen run on the guest's own clock, not the shared one | Use the world's hour | Low |
| 28 | Co-op | "Friends can help" does nothing: crew can't finish co-op jobs | Count crew photographs and catches for the skipper's jobs | Low |
| 29 | Audio | Friends' boats are silent; crewing a planing RIB is silent; calls make no sound | Friends' engines in the soundscape; a chime | Low |
| 30 | World | Leaving a session restocks fished-out water at once; a second catch message within 4 s is dropped | Stagger the restock; queue the news | Low |
| 31 | Wildlife | Herons pop in and out in view; oystercatchers move as a rigid grid; an otter teleports | Hide only beyond view; vary the flock; a swim back | Low |
| 32 | Economy | Hiring at 20:00 buys three real minutes; big game is capped at the same price as a turbot | Hire for 24 hours; a higher cap for the big ocean fish | Low |
| 33 | Perf | Underwater, the worst 1% of simulation frames take 75 ms (mean 13.7): a stutter while diving | Find the spike (profile) and spread or cache the work | ? |
| 34 | Perf | First person at the RIB's helm: 587 draw calls (the dashboard's many small parts) | Merge static dashboard parts; share materials | Low–med |

## Log

### Fishing that tells the truth (PR A)

| Field | |
| --- | --- |
| System | Fishing: the fight's hints, input and outcomes (`src/fishing.js`, `src/fight.js`, `src/main.js`, `src/ui.js`) |
| Previous issue | Backlog 2, 5, 11–18: the game told the player to do the thing that lost the fish (reel at the net); one reflex press of "back" released a fish; a controller's stick changed the drag while asking for side pressure; messages covered the "let go!" warnings; reasons for a lost fish gave the wrong advice; keyboard experts had no side pressure in a boat; holding through a bite never struck; a parted line reeled home intact; the weigh-in rumble never played; a third of species fought alike |
| Change | Net hint first; a second press within 1.6 s to let a fish go (game-initiated cancels unchanged); drag only for a firm, mostly vertical push; live hint shown over messages during a surge, a charge, a headshake, a leap, high tension or at the net; the fight records what threw the hook and the reason says so, naming the player's own control (LT, the stick, or S); side pressure from A/D in a fight; letting go strikes a bite you held through; the rig goes with a parted line; vibration allowed on the catch card; flatfish and octopus sound (pump them up), dogfish head-shake |
| Player benefit | Fewer fish lost for reasons the player couldn't see; the game's words match what to do |
| Before | At the net the hint read "Hold Space to reel it in" (holding for 2.8 s lost the fish); one Esc released a hooked fish; `dragBy(0.25)` clicked the drag |
| After | Browser-checked: the hint reads "Beaten and alongside: let go of Space, and tap it to net it"; one Esc shows "Press again to let the fish go" and the fish stays on, a second releases it; a snapped line leaves no float, lure or line flying home |
| Validation | `tests/fishfeel.test.mjs` (7 tests); existing fight, angling, haptics and big-game tests pass; a browser run of a real fight in the game |
| Remaining risks | Flatfish/octopus/dogfish fights change slightly in feel (balance); a player used to one-press release now presses twice |

### Messages and menus that don't get in the way (PR B)

| Field | |
| --- | --- |
| System | Questions, messages, cards, controller and keyboard focus, the board and sounds (`src/main.js`, `src/ui.js`, `src/input.js`, `src/settings.js`, `src/audio.js`) |
| Previous issue | Backlog 1, 3, 6–8, 19–22: a controller-only new player was stuck at the name prompt; Esc/B on a question ran nothing, and on "How do you like to play?" lost the first-trip guide for good; the radio's call could open over a fight, while steering, or on top of another question (replacing it); one-time tips played behind full-screen menus; a third of messages couldn't be read in their time; a discovery card could land on the catch card (Space then released the fish under it) and queued cards could stay unseen; Tab and Space didn't reach dialogs; the board ignored hired boats; being paid was silent |
| Change | An open question counts as a menu for the controller, before the game starts too; Esc/B answers a question with its cancel (explicit, or a plainly harmless answer like "Not now": never an action), the name question takes the name in the box and the style question takes Angler; a question asked while another is open waits its turn; radio calls wait for no line out, no question, no placement or dashboard in hand, and under 2.5 m/s, and are counted only when shown; messages wait while a full-screen menu would hide them (not the map); a message stays up at least as long as it takes to read (14 characters a second, up to 20 s); the catch card claims the screen first and waiting cards come when it's free; dialogs are found correctly for Tab and Space; new settings follow the system's reduce-motion; the board passes the day (hired boats count) and is rewritten after a hire; a survey keeps its imaging bonus from the boat that ran it; `coins()` and `sizzleStart()` exist |
| Player benefit | A new player can start with a controller or with Esc alone; nothing important appears where it can't be seen or replaces something being read; being paid sounds like it |
| Before | Pad: focus snapped back to "Begin" behind the name prompt; Esc did nothing before the game began; a call opened mid-fight; 63 of 181 messages ran faster than 15 characters a second; `audio.coins` didn't exist |
| After | Browser-checked: a new game's name and style questions answered with Esc alone, the game starts and the first-trip guide is offered; the controller's context at the name prompt is `menu`; with a fish on no call appears, after the fight it does, and Esc answers it "Not now" (nothing taken, the next one scheduled); Tab opens the journal |
| Validation | `tests/messages.test.mjs` (every optional sound exists, reading time, reduce-motion default, hired boats); browser run of a new game and a returning one |
| Remaining risks | Messages raised inside a menu now appear when it closes rather than (invisibly) behind it; Esc on a question with no clear cancel still just closes it |
