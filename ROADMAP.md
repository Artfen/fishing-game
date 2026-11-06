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
3. **Shared catchable fish** (next): the fish that take lures decided by the host, several
   players' rigs at once, a hooked fish owned by one player and gone for the others, friends
   watching the real fight.
4. **Multiplayer help**: crewing, netting a friend's fish, marks on a shoal, cooperative contracts.
5. **First-person dashboard** (RIB first), with visible trim and tilt.
6. **Electric trolling motors and GPS spot-lock.**
7. **Contracts and careers; a purpose for bigger boats; fun for people who don't fish.**

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
