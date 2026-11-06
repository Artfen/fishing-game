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
| 4 | Boats ✅ | Tying up can put two hulls inside each other; the hull contact then fires them out of the berth (seen: 23 m/s) | Berths check boat length; overlaps ease out instead of firing | Low–med |
| 5 | Fishing ✅ | One press of Esc/B/right-click lets a hooked fish go | A second press within a moment | Low |
| 6 | UX ✅ | The radio's call can open mid-fight or mid-steer, and replace another open question | Gate on fishing, an open question, speed; count the call only when shown | Low |
| 7 | Jobs ✅ | The board ignores boats you've hired; the survey bonus is judged by the wrong boat | Pass the day; record imaging during the survey | Low |
| 8 | Audio ✅ | Being paid for a job is silent (`audio.coins` doesn't exist); so is the camp sizzle | Add the sounds; a test that every optional audio call exists | None |
| 9 | Camera ✅ | First person trails the eye at speed (0.2–0.4 m at 18 m/s), worse at higher frame rates, and judders | Lock to the eye once any glide is over | Low |
| 10 | Camera ✅ | The steady camera / reduced motion lets the eye sink 0.5 m through the console, then snap | Clamp instead of snapping | Low |
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
| 23 | Boats ✅ | Docking: the tie-up prompt vanishes above 0.9 m/s with no word why, and flickers in a swell; RIB astern is weak | "Slow down to tie up", smoothed speed, firmer astern | Low |
| 24 | Boats ✅ | Fast boats have no cruise notch between half and full (RIB 4.3 → 18 m/s) | A cruise notch | Low–med |
| 25 | Boats ✅ | The dashboard's throttle lever barely moves until full ahead | Show the lever's travel | Low |
| 26 | Perf | Hull physics allocates thousands of objects a frame; idle moored boats run full physics; foam trails, effects and the HUD do constant work; figures and friends' boats leak | Pools and scratch objects, rest for still moored boats, change-only DOM writes, disposal | Low–med |
| 27 | Co-op ✅ | A guest's market and kitchen run on the guest's own clock, not the shared one | Use the world's hour | Low |
| 28 | Co-op ✅ | "Friends can help" does nothing: crew can't finish co-op jobs | Count crew photographs and catches for the skipper's jobs | Low |
| 29 | Audio ✅ | Friends' boats are silent; crewing a planing RIB is silent; calls make no sound | Friends' engines in the soundscape; a chime | Low |
| 30 | World ✅ | Leaving a session restocks fished-out water at once; a second catch message within 4 s is dropped | Stagger the restock; queue the news | Low |
| 31 | Wildlife ✅ | Herons pop in and out in view; oystercatchers move as a rigid grid; an otter teleports | Hide only beyond view; vary the flock; a swim back | Low |
| 32 | Economy ✅ | Hiring at 20:00 buys three real minutes; big game is capped at the same price as a turbot | Hire for 24 hours; a higher cap for the big ocean fish | Low |
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

### Boats that come alongside, and a camera that keeps up (PR D)

| Field | |
| --- | --- |
| System | Mooring, hull contact, the helm and the camera (`src/mooring.js`, `src/hydro.js`, `src/camera.js`, `src/throttle.js`, `src/main.js`) |
| Previous issue | Backlog 4, 9, 10, 23–25: a berth could be offered with the boat's bow or stern inside a moored neighbour (only the beams were compared), and the hull contact then fired her out of it; first person trailed the eye at speed, more at a higher frame rate; the steady camera let the eye sink through the console and snap back; near a berth the tie-up prompt simply vanished above 0.9 m/s and flickered in a swell; the RIB and the jet ski barely went astern; fast boats jumped from half (still off the plane) to flat out; the dashboard's throttle lever hardly moved until full; with the trolling motor down the hint still named the engine's keys; underwater the camera could flick above and below the surface at the water line |
| Change | A berth must clear every moored boat's whole hull, bow to stern (a box test turned to each boat's heading), not only her beam; a contact (hull, pier or seabed) that is already parting faster than half a metre a second stops pushing, so hulls found inside each other ease apart instead of firing off; first person locks to the eye once any glide (boarding, a change of view) is over; the steady camera eases the eye but keeps it within 15 cm of where it is aboard; near a berth and moving, the prompt reads "Slow down to tie up (1.4 m/s)"; the tie-up and anchor prompts judge her speed averaged over a second or so; astern on the RIB and the jet ski doubled (−0.15 → −0.3, as the skiff); a cruising notch C on the RIB (0.45, about 11 m/s, 22 knots) and the centre console (0.6, about 10 m/s, 19 knots); the dashboard lever shows its real travel (the same as the smooth lever's); the hint names the trolling motor's keys when it's down; a small band at the water line so the camera doesn't flick across it |
| Player benefit | Coming alongside is calm and predictable: no berth inside another boat, no boat thrown out of one, and the game says why it won't tie up yet; first person feels attached to the boat; a comfortable cruising speed on the planing boats |
| Before | A bass boat beside the moored console was offered a berth at x = 20.3, inside the console's quarter; tied there she was thrown 6 m (peak 2.9 m/s). First person 0.215 m behind the eye at 30 fps and 18 m/s (more at 144 fps). RIB: half 4.5 m/s, then full 18.1 m/s, nothing between |
| After | The berth is offered at x = 23.3, clear of her; tied there neither boat moves faster than 1 m/s. First person within 1 cm of the eye at 30, 60 and 144 fps. Browser-checked: the RIB's lever shows F C 3 T 2 1 N R, W steps through each, C reads "Cruising 5100 rpm" and holds 10.8–11.1 m/s; coming alongside the console's berth at slow ahead the prompt reads "Slow down to tie up (1.4 m/s)", then "Tie up alongside" once she's slowed; no page errors |
| Validation | `tests/mooring.test.mjs` (a berth clears a moored boat's whole hull; tied there nobody is thrown out), `tests/camera.test.mjs` (first person keeps up at 30/60/144 fps; it fails on the old code with 0.215 m), `tests/sportboats.test.mjs` (the cruising notch is on the plane between half and full); boats, dashboard, throttle, engine, watersports, big-game, harbour and trolling tests pass |
| Remaining risks | Contacts bounce less: a boat that hits a pier or another boat hard parts at up to about half a metre a second rather than springing off (the existing collision, pier and beaching tests pass); one more notch to step through on the RIB and console between half and full; the RIB's and jet ski's astern is stronger, so backing off a berth is quicker |

### A living world, together (PR E)

| Field | |
| --- | --- |
| System | Co-op, the harbour's trade, sound and the animals (`src/harbourView.js`, `src/contracts.js`, `src/world/sealife.js`, `src/sharedworld.js`, `src/together.js`, `src/shipyard.js`, `src/market.js`, `src/world/wildlife.js`, `src/main.js`) |
| Previous issue | Backlog 27–32: a guest's market and kitchen opened by the guest's own clock while the scene showed the host's (Mags at her slab in daylight: "The market's shut"), and "before the gale" jobs mixed the two clocks; "friends can help" did nothing (a crew's photo of dolphins on the skipper's bow didn't count, nor a crew's fish for the skipper's charter); friends' boats were silent, so was riding in one, and a friend's call or fish-on made no sound; leaving a session refilled every fished-out spot at once, and a friend's second catch within 4 s was dropped; a hire taken at 20:00 lasted until midnight (about three real minutes); a 27 kg yellowfin fetched the same £40 as a turbot; a heron gone "over the hill" vanished in plain view 140 m off and reappeared at its shallows while you watched, a heron turned 86° in a frame, oystercatchers kept one rigid pattern for ever, and an otter jumped from the bank into the water |
| Change | The market's and kitchen's hours, and the sheet's clock, use the world's hour (the host's together, your own alone); the board's gale checks take the day and the time from the same clock. A crew's photograph counts a pod on the skipper's bow; a fish landed by a friend crewing your boat, close aboard, counts for your fishing charter (and nothing else of yours). Friends' boats under power are in the soundscape (the one you're riding in among them); a soft chime for a friend's call and fish-on. Fish taken while following come back over 4–7 minutes after you leave; a friend's catches are news up to three in 20 s (a flood is still cut short). A hire runs 24 hours from when you took her (an older save's hire still ends with its day; the yard says until when). The big ocean fish (tuna, wahoo, dorado, albacore) can fetch up to £120. A heron flying off over the hill goes 520 m, out of sight, before it's gone, and flies back in to its shallows; it turns gradually; oystercatchers wander while they feed, land in a new scatter, and fly loosely; an otter walks back down the bank into the water |
| Player benefit | Playing together, the shared world agrees with itself and helping a friend counts; the harbour's trade and the hire are fair; the animals behave like animals when you're watching them |
| Before | Host 12:00, guest's own clock 21:00: the guest's market shut. A crew's bow photo: not counted. A hire at 20:00: gone at 0:00. Yellowfin at the top of its size: £40. An otter's last step from the bank: several metres in one frame |
| After | The same guest's market is open (tested); the crew's photo counts the skipper's bow and the crew's fish the skipper's charter (tested); a hire at day 6 20:00 is still yours at day 7 19:30 and back at the yard at 20:30 (tested; an old save's hire ends with its day); the yellowfin fetches over £40 and at most £120 (tested); the otter never moves more than 0.2 m in a tenth of a second and the heron starts home from 520 m out (tested); after leaving a session no fish is restocked at once and each comes back in 240–420 s (tested) |
| Validation | `tests/livingworld.test.mjs` (7 tests); `tests/together.test.mjs` (a flood of five catches: three shown), `tests/wildlife.test.mjs` (a heron gone over the hill is gone only beyond 500 m), `tests/messages.test.mjs` (the board passes the day and the time); shared world, shared fish, sea life, crew, market, economy, shipyard, contracts, charters and harbour tests pass |
| Remaining risks | Not played with two real people over a real connection (the co-op parts are tested through the stand-in for Supabase Realtime and by hand-built states); the sounds were not listened to (no audio on the test server); a heron flushed with nowhere far to go is out of sight for longer; terns still fly perfect circles; mooring fees and fuel balance on Gentle (from the audit) are left for a balance pass |

