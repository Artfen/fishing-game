# Slow Tide: the road to 1.0

Where the game stands as a product, what it still needs to be a game people pay €9.99 for and
recommend to their friends, and open-source projects that could help. Written November 2026 as
an honest assessment; keep it current as things are done.

## Where it stands

As technology and simulation it's an 8–9/10: a real FFT ocean and rigid-body boats, a world that
actually runs (fish living in real habitats, rumours in the bar that are true, townsfolk with
their own days), 86 species, 10 rods and 33 baits and lures, 11 boats, two regions, co-op for up
to eight, offline play, and well over 400 automated tests.

As a product someone pays €9.99 for it's about a 5–6/10 today. What holds it back is not missing
features but missing direction, progression, feel and product polish. The README alone runs to
over a thousand lines: the game is very wide, and the next months should go on depth, feel and
polish rather than new places or boats.

**Worth keeping front and centre** (already 10/10 material):

- The sea and the boats: physically real waves and handling, rare in the genre, and they make
  great clips.
- The honest, living world.
- Co-op: fishing with friends sells (see Webfishing).
- Robustness: offline play, migrated saves, a big test suite.

## What's missing, most important first

1. **A reason to keep playing (progression).** Tackle is free, all eleven boats are available
   from the start, and money is "never a grind: nothing in the game needs it". That's kind, but
   it leaves nothing to want. The loop every loved fishing game has is catch → earn → unlock →
   new water → harder fish (Dredge: upgrades and a mystery; Stardew and Animal Crossing:
   collections and money; Webfishing: cosmetics and friends). Stay cosy without grind: boats,
   rods and regions earned through harbour reputation and money; clear collection goals (all 86
   species, size records, a legendary fish for each area); a small daily reason to come back
   (orders, a fish of the day).
2. **The feel of catching a fish.** The heart of the game, and not yet polished: the
   first-person line was visibly broken until November 2026 and nobody had noticed. A 10/10
   bite → hook → fight → land needs a readable bite, a hook-set that feels physical, the fish
   visibly fighting (thrashing at the surface, jumping, runs you can see), rod bend, controller
   rumble, good sound, and a proper payoff when it's landed (a big reveal, the weight, a photo
   moment).
3. **Sound.** Everything is synthesised in code. For a calm game sound is half the experience:
   recorded waves, gulls, rigging, a proper reel click and splash, and a memorable soundtrack.
   The cheapest big jump in perceived quality.
4. **A consistent look.** The water is now nearly photoreal, the people are built from simple
   blocks and the fish are generated in code: they pull in different directions. A game sells on
   its screenshots and trailer, so choose one style and make everything match (probably an
   artist for the characters, fish and key art).
5. **The first fifteen minutes.** A new player meets six ways to fish, fuel, hunger, warmth,
   tides, the harbour office and more. The opening should put a fish on the line within two
   minutes and reveal the systems one by one as they're earned: hide most of the depth at first
   and let it be discovered.
6. **Too much text.** Messages and dialogs are long, lovely sentences, and several overlap on
   screen. Short prompts, icons and a cleaner HUD; less text also makes translation affordable,
   and fishing games sell well in Germany, France and Japan.
7. **A story with an ending.** Six adventures and the favours are a thin spine. Two or three
   hours of light story would give a direction and a sense of finishing something (the Kittiwake,
   the lighthouse and Las Brasas are ready-made hooks).
8. **How it's sold.** A website anyone can open can't easily be sold for €9.99. Realistically: a
   desktop build for Steam (a packaged app) with achievements, Steam cloud saves and Steam Deck
   support, and a free browser demo to bring people in. Co-op and cloud saves run on Supabase's
   free tier, which won't survive real popularity; and the online features need a privacy policy
   (GDPR).
9. **Real machines and real players.** Confirm 60 fps on a MacBook Air and a cheap Windows laptop
   (so far it's only been tested in software rendering on a slow server), and watch 10–20 people
   play it to see where they get confused or stop.
10. **Marketing.** Steam games mostly sell through wishlists built over months: a store page early,
    a trailer (the sea and the boats are ideal clip material), short videos, a demo in a Steam
    Next Fest, a Discord.

## The agreed plan (November 2026)

Merged from this assessment and the "Make every trip worth taking" roadmap (edition 2, with its
26-page audit). Its rules stand: relaxed stays easy to play; existing saves keep their boats,
money and gear; the ocean physics, the look and offline play stay; no softlocks; every change
comes with tests.

**Decisions**

- **Played on a controller.** We encourage players to use one, and feel the game through its
  vibration: the engine's beat through the hull, the starter, a wave slamming under the bow, a
  knock against a pier, the bite, the hook going in, the fish running and the drag slipping.
  Keyboard, mouse and touch keep working as ever.
- **Engines that start like engines,** with a setting for how much of it you do: the full
  procedure (battery switch, kill cord, neutral, key, idle, trim), a one-button start that runs
  the same steps for you, or get in and go. Trim and tilt are real in the physics; the gauges show
  what the simulation is doing.
- **Two throttle styles:** clear notches (dead slow, slow, trolling, half, full), or a real lever
  pushed forward and back for revs that stays where you leave it, through neutral to go astern.
- **Money that buys something:** a ledger with receipts (never negative, nothing paid twice);
  fuel that costs a little (cheap, and free to start with on the gentle setting); Willowhaven
  Marine Works for boats, paint, a sign-written name and upgrades that buy capability (range,
  electronics, comfort, looks), **never a better bite rate**. A new game starts with the camp's
  three boats and can hire the rest; an existing game owns everything it has.
- **Goals beyond money:** every species, size records, a legendary fish for each area, Las Brasas
  as something you earn.
- **One question at the start** (how do you like to play?) that sets the many difficulty
  settings together, with the details under Advanced.

**Order**

1. CI and a baseline (the test suite on every pull request).
2. Controller vibration everywhere it helps.
3. The two throttle styles.
4. Engine systems and the three start-up settings.
5. The money ledger, paid fuel, Willowhaven Marine Works and goals.
6. The catch moment for everyone, then an optional expert technique layer over the same fish.
7. Sound (recordings for texture, synthesis for response, everything stored locally), an art
   bible, the first fifteen minutes, shorter text and a cleaner screen, a story spine.
8. A desktop build for Steam and a demo; the store page goes up early.

**Needs people, not just code:** an artist for characters, fish and key art; recorded sound
(each file's licence checked and kept); a Steam account and store page; playtests with real
players on real machines; a privacy policy for co-op and cloud saves.

## Shared world, helm, spot-lock and careers (brief, November 2026)

The next brief, worked through in order, each step merged to main once it's tested:

1. **Stabilisation.** All tests green. The dolphin bow-riding test was failing when boats gained
   momentum (a boat now coasts on after the throttle is cut); it now waits until the boat has
   really stopped before checking the pod leaves, with its expectations unchanged. Baselines
   (node, one core): the fish 1.9 ms a frame for one player, 5.5 ms with eight far apart; sea life
   about 1 ms; a shared-sea snapshot 0.2-0.5 ms to make.
2. **Shared wildlife and bait balls: done** (`src/sharedworld.js`). One sea for everyone in a
   session: whales, dolphins, seals, turtles, gannets and shearwaters, shoals, bait balls and the
   hunters on them. Architecture:
   - *Same identity everywhere*: sea life is built from one seed and the fish from their seeds, so
     every screen has the same animals and shoals under the same ids.
   - *Host-authoritative*: the session host's game decides, keeping the sea going round every
     player (a friend in another bay or at Las Brasas has their water alive) and answering to all
     of them (a pod rides whichever boat drew it; birds come down on a shoal near anyone).
   - *Snapshots, not every fish*: twice a second, every pod (with each animal's breath), whale,
     seal in the water, turtle and the birds' feeding, plus the shoals within 260 m of someone
     (those beyond 130 m, and still ones, every fourth snapshot). Followers ease each animal and
     shoal onto the host's position, extrapolated for the delay; a pod on a bow or a seal following
     a boat is placed from that boat on each screen.
   - *Recovery*: an epoch per hosted session and a sequence number per snapshot drop old or
     repeated ones; a snapshot is the whole account of what it covers, so a late join, a reconnect
     or a host reload never doubles anything.
   - *Validation*: shape, every number, every count against the local sea, and size (60 KB).
     Guests can only *ask* the host for things (a crossing's encounter), which it checks.
   - *Budget, measured*: 1-5 KB per snapshot with friends close together, about 9 KB with eight
     far apart (then once a second instead of twice). Messages: about 4 a second per moving player
     for positions plus 2 a second from the host for the sea; Supabase counts each one delivered,
     so an eight-player session runs to roughly 240 messages a second (about 0.9 million an hour):
     fine on the Pro plan's allowance, not on the free one for long sessions.
   - *Verified*: unit tests over a stand-in for Realtime, and two real browser clients through
     `tools/local-realtime.mjs`: whales within 0.2 m and in the same breathing states, the same
     breaths at the same places and moments, every nearby shoal within about 1.5 m, a late joiner
     and a reconnect in step at once with nothing doubled.
   - *If it outgrows the host*: the snapshot format doesn't depend on who makes it, so a small
     simulation server (the same modules under Node, one per session) could take the host's place
     without changing the followers. Worth it only if host frame time or upload becomes the limit
     (eight players spread far apart is the worst case measured, and it's within budget).
3. **Shared catchable fish: done** (`src/sharedworld.js`, `src/world/ecosystem.js`).
   - *Every rig in the host's water*: a guest sends their rig (where it is, what's on it, how it's
     worked) whenever it's changed, at most four times a second (the host carries it on at its
     speed in between), and once a second anyway while it's in the water; the host's ecosystem holds everyone's,
     and a fish free to notice one goes for the nearest. One fish to a rig, one rig to a fish.
   - *The host's word, the guest's screen*: what the host's fish do about a guest's rig (noticed
     it, took it, gave up) goes to that guest alone, and their own water shows that fish coming
     and taking, smoothly, without waiting on every flick of its tail.
   - *Ownership*: a strike is a claim; the host grants it only if that fish was taking that guest's
     rig at that moment (else "it let go"). Hooked, it's that player's: no other rig can have it,
     and only they can say it was caught, kept, released or lost. A guest whose rig stops arriving
     (gone, or reeled in without a word) loses the fish.
   - *Everyone agrees*: snapshots carry the fish going for a rig or hooked near anyone, every fish
     out of the water, and each newcomer's size and build; a friend's pose names the fish on their
     line, and every screen places that very fish at the end of it.
   - *Validation*: rigs checked (kinds, tackle the game has, numbers, near the guest, no rig more
     tempting than the host's own could be), fish words and snapshot rows checked, guests' asks
     capped at twelve a second, and a sender's id can't be overwritten by what they send.
   - *Budget*: a float sitting still costs one small message a second, a lure being worked up to
     four (each counted once per player in the session); fish words are a few per bite; snapshots
     grow by a row per fish going for a rig.
   - *Verified*: unit tests over the Realtime stand-in (two rigs at one shoal, a third player
     watching a guest's fight, a forged strike, two strikes at once, a guest leaving mid-fight), and
     two real browser clients: see the pull request for the run.
4. **Multiplayer help** (`src/teamwork.js`), the real fight first:
   - *Netting a friend's fish: done.* Their pose says when it's beaten alongside; a friend within
     reach (a boat's half-length more, afloat) gets the prompt; the word goes to the angler alone,
     whose game checks it's that fish, still waiting for the net, and the helper really by it, then
     nets it. The catch stays the angler's; thanks (with what it was) go back.
   - *Marking a feeding shoal: done.* From the quick calls; shoals are the host's and the same on
     every screen, so the mark follows that very shoal, for ten minutes or until it's fished out.
     At most one every four seconds each.
   - *Crewing: done* (`src/crew.js`). Step aboard a friend's stopped boat from the shore or from
     your own alongside. In your game you're on foot, carried at a spot in their boat as it's drawn
     here (walk about her, fish, watch the sonar, net their fish); your pose names the boat and
     your spot in her, so every screen draws you in that boat rather than a moment behind it.
     *The helm*: asked of the skipper; their game hands it over (not under sail, not from the
     cabin), then takes your wheel and lever a few times a second and steers their boat with them,
     physics and all in their game. A touch at their controls takes it back; your word stopping
     leaves the wheel slack. Answers are never rate-limited away (a real bug the tests found: a
     re-grant straight after a take-back went missing). A save while crewing puts you back where
     you stepped aboard from; losing the boat or the session puts you back in your own boat.
     *Verified* with two real browser clients: stepping across, seen standing in her on both
     screens, the save, the helm handed over and her boat rowed 26 m from the crew's keys in the
     skipper's game, taken back at a touch, and back into his own boat.
   - *Cooperative contracts* come with the contracts themselves (step 8).
5. **Budget, diagnostics and the acceptance tests: done.**
   - *Measured* with `tools/netbudget.mjs`: a whole session through the Realtime stand-in, the
     host's real sea and fish, everyone under way, half the guests fishing (floats and worked
     lures), one crewing at the host's helm. Supabase counts each message sent and each delivered.

     | players | sent/s | delivered/s | together | snapshot avg / max | host sim (node, 1 core) |
     |---|---|---|---|---|---|
     | 2 | 8 | 8 | 16 | 2.0 / 3.8 KB | 2.2 ms a frame |
     | 3 | 16 | 31 | 47 | 3.1 / 5.9 KB | 2.9 ms |
     | 4 | 19 | 56 | 75 | 4.6 / 7.6 KB | 3.6 ms |
     | 5 | 23 | 90 | 113 | 5.1 / 8.6 KB | 3.6 ms |
     | 8, far apart | 32 | 224 | 256 | 5.6 / 9.8 KB | 4.0 ms |
     | 8, one bay | 32 | 226 | 258 | 3.3 / 6.0 KB | 3.0 ms |

     Of eight players' 224 deliveries a second, positions are 157, the crew's wheel 29, rigs 28 and
     the shared sea 11 (but the sea is 52 of the 122 KB/s delivered; about 15 KB/s each player
     downloads, and the host uploads about 8 KB/s of sea). Supabase's per-second limits are 100 on
     the Free plan and 500 on Pro: four players fit the Free plan with room, eight need Pro (or a
     plan with more). No amount of trimming gets eight under 100 a second with broadcast fan-out:
     every player's movement counts once for each of the others. Network details in the game shows
     each kind's rate, the bytes, the sea's delay and what it covers, and the whole session's rate
     against both limits.
   - *Acceptance tests* (brief 1.7), each with where it's shown:
     1. Same whale surfacing, blowing and diving: `tests/sharedworld.test.mjs`; two browsers (the
        same blows at the same places and moments).
     2. Same bait ball and predators: `tests/sharedworld.test.mjs`.
     3. A catch gone for everyone: `tests/sharedfish.test.mjs`; two browsers.
     4. Two casts at one shoal, no double ownership or broken fights: `tests/sharedfish.test.mjs`
        (two rigs at one shoal; two strikes at once).
     5. A late joiner sees the whale or shoal where it is: `tests/sharedworld.test.mjs`; two browsers.
     6. A reconnect duplicates nothing: `tests/sharedworld.test.mjs`; two browsers.
     7. Players in different regions each have their wildlife: `tests/sharedworld.test.mjs` (a friend
        at Las Brasas).
     8. Watching a friend fight and land a fish: `tests/sharedfish.test.mjs` (a third player); two
        browsers (the very fish at the end of the friend's line).
     9. Single player unchanged: with no session the shared world is off and every rig is your own
        (the ecosystem's single-rig path is the same code as before); the whole suite runs that way.
     10. Eight players within a measured budget: the table above.
6. **First-person dashboard: the RIB, the centre console and the yacht done** (`src/dashboard.js`,
   `src/dashcontrol.js`). The console is the helm panel in first person: battery rotary, key (one
   per engine), kill cord and lanyard, navigation lights (real sidelights and stern light, drawing
   on the battery), horn, the chartplotter and gauge screens, and the throttle with its trim
   rocker, each moving as it's worked; the screens drawn from `engine.js`, the only engine.
   Mouse (hover, click, hold, drag, scroll), touch (tap, hold), controller and keyboard (lean in,
   move a ring round it, press). The start-up settings still apply (on the one-button start a ring
   follows each step as it's done for you); the helm panel stays, in third person or by choice.
   *Trim and tilt*: the leg on the model follows the engine room's angle, now also with the tank
   dry; the rocker trims under way and tilts right up at rest; in gear with the leg up the game
   says so and the LEG lamp lights. Verified in a browser with real mouse clicks: the full
   procedure from cold (battery, cord, key on with the lamp test, key to start), the throttle
   dragged ahead, the rocker held to tilt the leg to 34° and the outboard on the model at the
   same 34°. The yacht's console carries the same architecture to inboard diesels: two keys, the
   glow-plug button and lamp, no kill cord and no leg, the levers to port. *Left on the panel*:
   the bass boat and the cabin boat (steered from a seat or the cabin's aft wall, with no console
   in their models) and the tiller boats; a console for them is model work first.
7. **Electric trolling motors and GPS Spot-Lock: done** (`src/trolling.js`).
   - *Hardware*: three bow motors at the Marine Works (basic; GPS with Spot-Lock and heading hold;
     high-thrust GPS), one at a time, and a lithium bank doubling the battery. They suit the
     skiff, the bass boat, the cabin boat and the centre console; not the RIB (her tubes meet in
     the nose), nor the yacht (too big for a bow motor: dynamic positioning on her own engines
     would be a different kind of thing, not built yet).
   - *Physics*: the motor is a thruster under the bow (the hull's own physics does the rest).
     Spot-Lock is a controller: an acceleration of her mass from how far she's drifted and how
     fast (with a soft zone of under a metre so it holds rather than hunts), capped at what the
     motor can give on its battery in the sea that's running, the head turning to push along it.
     No frozen coordinates, no invisible rope, no free electricity.
   - *Measured* (node, the real hulls): the centre console in a 7 m/s breeze drifts 31 m in a
     minute free, and Spot-Lock (high-thrust) holds her within 1.1 m; in the game, with the tide
     running as well, within about 2 m at 660 of its 700 N. The bass boat in a 19 m/s gale drags
     72 m in 45 s, the motor 97% short. Full push ahead: 1.3 m/s (2.5 kn), quiet. Heading hold
     settles within 0.01 rad. A battery lasts close to three hours flat out.
   - *Integration*: its own battery per boat (charged at a jetty and overnight, in the save); it
     stops when the main engine goes into gear, when it's stowed, the anchor's dropped or she's
     tied up, and says why; the hint and the gauges show Spot-Lock's distance off and the battery;
     on the centre console's dashboard, its switch, Spot-Lock button and a LOCK lamp.
8. **Contracts and careers** (`src/contracts.js`, `src/contractboard.js`), first part done:
   - *The board*: Work on Willowhaven's notice board, beside the favours, adventures and badges
     (not instead of them). Sixteen kinds of job across five categories: fishing (a species at a
     size for the specials board, a mixed bag on one trip, a trout on the fly, a trophy
     photographed and released), wildlife (dolphins photographed on your bow, a whale found as it
     surfaces, a feeding frenzy watched, a turtle at Las Brasas), survey (a sonar transect,
     temperatures at marks, some by night, with a bonus for imaging sonar), deliveries (ice to
     Wend Quay, tarpaulins there before a gale, spares across the ocean in fair weather) and boat
     handling (berthing without a bump, a timed course, the same under sail).
   - *A living board*: chosen each day from the world as it is: the fish that are busy, dolphins
     and whales about, birds working, the forecast (a gale clears off the deliveries and the
     racing, but brings the one job that has to beat it), what boats you have, whether you've
     been to the island. The same board all day, a new one tomorrow.
   - *Done for real*: each job finished by the game's own systems (the catch and how, the
     catch card's photograph and the release, the photograph's sea life and a pod on your own bow,
     the fish finder on, the sail up and the engine off, a whale at the surface, birds working, a
     place reached, a berth made fast without a bump); photographs now see dolphins, whales,
     seals and turtles.
   - *Safe*: three at a time; paid once (a finished job's id is spent); given up with nothing lost
     but the job; a course failed or a bump starts again; a deadline passed lapses harmlessly; the
     record cleaned on load. Tracked with one marker and on the map, and in the journal.
   - *Verified*: `tests/contracts.test.mjs`, and in a browser: the board's work read and taken
     by clicking, no fourth, the delivery paid on arrival, the course rounded and collected at
     the board, never paid twice, a job given up with nothing paid.
   - *Then*: diving work, a drifting buoy, a handcrafted multi-stage expedition, the bigger
     boats' purpose (9) and the first session for people who don't fish (10).
9. **Bigger boats' purpose and a career (phase 5): done** (`src/vessels.js`, `src/passengers.js`,
   charters and freight in `src/contracts.js`):
   - *What each boat is for*: seats, cargo, shelter, comfort in a sea, room for divers, for all
     eleven. A load she can't take is refused with the reason (eight won't go in the RIB, divers
     not in the cabin boat, a tonne only in the yacht; nine passengers in nothing).
   - *Work that wants the bigger boats*: whale watching (up to eight), dolphins on the bow, divers
     to the dive sites (no anchoring on the protected reef, wreck and sea fans: Spot-Lock earns its
     keep), a fishing charter, freight for Puffin Cove (up to 1.2 t). Offers name a boat of yours
     that will do, or the smallest one to hire.
   - *Real weight*: passengers (80 kg each) and freight go into her payload while aboard, so she
     sits lower and is slower (measured in the game: the RIB 18.0 → 15.8 m/s flat out with four
     divers); seated figures show them. A rough trip in an open boat (the sea over her comfort)
     costs the tip; a sheltered one doesn't.
   - *A career*: Odd-job hand, Boatman (3 jobs: a passenger ticket, up to three aboard), Skipper
     (8: up to six, heavier freight), Master (15: everything); the board offers only what you're
     trusted with, and says where you stand.
   - *Safe*: boarding only at Willowhaven in a boat with room (they move over to another before
     the trip); progress only in the boat they're in; paid once; given up mid-trip with nothing
     left aboard; kept in the save. A bug found on the way: contracts weren't kept in the save at
     all (save.js keeps a list of what it saves); they are now, with a test.
   - *Verified*: `tests/charters.test.mjs`, and in a browser: two charters taken by clicking,
     eight refused by the RIB, four divers aboard her (+320 kg, four figures seated, slower flat
     out), anchored on the reef not counting (and said), held there for the dive (150 s then, 90 s
     now), home, paid £115 once,
     eight aboard the yacht, given up with the yacht empty again. (On a gale day the sea built
     past the RIB's comfort and the tip went, as it should: the board offers no charters then.)
10. **Calls, dive surveys, an expedition; fun for people who don't fish (phases 4b and 6): done**:
   - *Assistance over the radio*: the harbour office calls now and then (by day, afloat, fair
     weather, a few hours in and every five to ten game hours after, never during the first-trip
     guide, one at a time, never on the board): someone carried out on a paddleboard, or a buoy
     adrift, or a skiff with a dead engine to tow in. Said yes to, it's marked and drawn on the
     water (`src/world/pickups.js`; the skiff is a real hull); alongside slowly in a boat with
     room, they're aboard (sat in her, weighing in her), or she's taken in tow on the game's own
     towline (towStep pulls her like any boat; never saved as one of yours, never stepped into,
     left where you let her go, and found there after a reload); home, paid there. Said no to,
     nothing's lost.
   - *Dive surveys* for the Marine Trust: log a few things at a site you haven't found before; the
     game's own dive finds (dive.js logFind) finish it.
   - *The Gannet Isle season*, a Skipper's expedition in five stages (load 300 kg, land it at
     Puffin Cove, round Gannet Light, sound the Hound with the finder on, home), each stage done
     the way its own kind of job is; saved part way.
   - *A first session without fishing*: an easy non-fishing first job tops the board until you've
     done one (a parcel to The Landing); the first-trip offer has a *Not fishing: boats and work*
     answer; Willowhaven's first tip and the board's say there's work that isn't fishing.
   - *Safe*: a pickup only in a boat with room, slowly; paid once; given up with nothing left
     aboard and the radio carrying on; an expedition's kit only in a boat that takes it, landed
     only from that boat.
   - *Verified*: `tests/assistance.test.mjs`, and in a browser: a new player's board with the
     first job on top, rowed to The Landing and paid; the radio's call, said yes to, seen on the
     water (a paddleboarder by her pot buoy; a channel marker adrift), picked up alongside (80 kg
     and a figure in the boat; or 40 kg of buoy), home and paid; a dive survey of the Kittiwake
     finished by finds logged on a scuba dive; the skiff with the dead engine taken in tow from
     alongside (the prompt), following 176 m on the line behind the RIB at 9 m/s, into the
     harbour, paid £25 and gone.

## Stage 7 of the agreed plan, continued (November 2026)

1. **A story with an ending: done** (`src/story.js`, *The Fifth Name*). Seven chapters threaded
   through what the game already has (the Kittiwake, her bell, Tam's slate on the Calf, Gannet
   Light, Chano at Puerto Brasa across the ocean, Wenna at the harbour office) and an ending: Wenna
   taken out to the wreck's buoy at dusk in your boat (seated, weighing in her), flowers on the
   water, and the fifth name cut on the stone. Told in order; what you'd already done counts in
   its turn, a card at a time; the marker and map show the next place where the adventures don't;
   the journal tells it; two keepsakes; kept in the save. Verified by `tests/story.test.mjs` and a
   browser run of the whole story (from a save with three adventures done, through the keeper's
   log, Puerto Brasa, the letter home, Wenna aboard at dusk, the flowers, the end, the journal,
   and a reload). The radio's calls now hold off while she's aboard.
2. *Still to do from stage 7*: an art bible (one look for everything), a cleaner screen, and
   recorded sound (each file's licence checked and kept: needs people, not just code).

## Open-source projects that could help

Checked for licence and fit, November 2026. A public repository isn't permission to use its
assets: read each LICENSE before using anything, and nothing paid or any outside service goes in
without a decision to.

**Selling on Steam**
- [ceifa/steamworks.js](https://github.com/ceifa/steamworks.js) (MIT): Steamworks for Electron and
  NW.js: achievements, cloud saves, the overlay. The usual choice; there are reports of thin docs
  and overlay issues, so check its state first.
  [steamworks-ffi-node](https://dev.to/arty_prof/steamworks-ffi-node-a-steamworks-sdk-library-for-javascript-game-frameworks-15h1)
  is an alternative.
- Electron (or NW.js, as CrossCode shipped on): bundles its own Chromium, so WebGL behaves the
  same for every player. Tauri is far smaller but uses each system's own webview, riskier for a
  WebGL game. (Turn off Electron's background throttling, and load only packaged local files.)

**Sound**
- [goldfire/howler.js](https://github.com/goldfire/howler.js) (MIT): sound sprites, fades and 3D
  positional audio over Web Audio, if the hand-written audio engine becomes a burden.
- Recorded sounds: [Kenney](https://kenney.nl/assets/ui-audio) packs (CC0: UI clicks and more; the
  all-in-one bundle is paid); [Sonniss GameAudioGDC bundles](https://gamefromscratch.com/sonniss-27-5gb-sound-effect-giveaway-at-gdc-2024/)
  (free, royalty-free, no credit needed, not to be used for AI training: check the file lists for
  sea, gulls and rigging, and read the current licence).

**Art**
- [Quaternius](https://quaternius.itch.io/lowpoly-animated-fish) (CC0): low-poly fish with swim,
  attack and out-of-water animations, rigged for Blender. Useful as reference or a base, though
  the game's fish are drawn from their real anatomy (the species register), so these would need
  work to match.
- [Kenney](https://kenney.itch.io/kenney-game-assets) 3D packs (CC0) for props and UI.

**Look and performance**
- [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) (check the LICENSE): a faster,
  better-managed effects pipeline than three.js's own (bloom, tone mapping, depth of field for the
  photo moment).
- [gkjohnson/three-mesh-bvh](https://github.com/gkjohnson/three-mesh-bvh) (MIT): fast raycasts and
  spatial queries on three.js meshes (picking, the walker on piers and terrain, line-of-sight).
- [cocopon/tweakpane](https://github.com/cocopon/tweakpane) or
  [georgealways/lil-gui](https://github.com/georgealways/lil-gui): a debug panel behind `?debug`
  for tuning the fight, the bite and the boats live.

**Online, analytics and translation**
- [colyseus/colyseus](https://github.com/colyseus/colyseus) (MIT, self-hosted Node server): if
  co-op outgrows Supabase Realtime's free tier (it needs a server to run).
  [alexbarker234/boat-and-bobber](https://awesome.ecosyste.ms/projects/github.com%2Falexbarker234%2Fboat-and-bobber),
  a three.js multiplayer fishing game, uses it: worth reading for both (licence unchecked).
- [PostHog/posthog](https://github.com/posthog/posthog) (MIT core; the `ee` folder is under its own
  licence): playtest telemetry, where players stop or get stuck. Self-hosting suits about 100k
  events a month; past that it's their cloud.
- [i18next](https://www.i18next.com) (MIT): translations with proper plural rules, once the text is
  cut down.

**Fishing games to learn from** (read the code; check licences before borrowing anything)
- [Boat & Bobber](https://awesome.ecosyste.ms/projects/github.com%2Falexbarker234%2Fboat-and-bobber)
  (three.js, Rapier, Colyseus).
- [Mouse Boat](https://cowthing.itch.io/mouse-boat) (Godot): a small, tight cast-hook-reel loop with
  rarity tiers.
