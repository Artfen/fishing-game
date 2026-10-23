# Slow Tide

**Play it: <https://fishing-game-weld.vercel.app>**

A small, peaceful fishing adventure that runs in the browser. You row a little wooden boat around Willow Bay, step ashore at a landing, walk up to your camp, and fish a freshwater lake and a clear trout stream. You choose your rods and tackle, cook what you catch over the fire, sleep in the tent until the hour you like, and keep a handwritten journal of it all.

The water is a living place: weed beds, rocks, lily pads, a fallen tree, sandy shallows, deep water and running pools, home to around 370 fish that school, cruise, feed, rest by cover, hunt and scatter when startled. Rings, flashes, jumps and fizzing bubbles on the surface come from real fish below. You can look underwater, follow your bait or lure, and use a fish finder. The fish that takes your bait is one you could have watched swimming there.

It's a static website: plain JavaScript modules and no build step. Everything it needs ships in this folder, including [three.js](https://threejs.org) and the fonts, so it makes no requests to other sites and also works offline. The only server code is one small optional function for cloud saves, which stay switched off until you set them up (see [Cloud saves](#cloud-saves-optional)).

## Run it

```bash
python3 serve.py
```

Then open <http://localhost:8642>. `serve.py` is a tiny static server with caching turned off, so a browser refresh always picks up your edits. It also answers the game's cloud-save question with "not set up", so locally you always play as a guest. Any static server works too.

## Put it online

**Vercel** (what the live game uses): the project is imported from GitHub with the framework preset *Other*, no build command, and the repository root as the output directory. Every push to `main` redeploys the site, and every other branch gets its own preview address, so you can try a branch before merging it. No settings or environment variables are needed, unless you want [cloud saves](#cloud-saves-optional). The `api/` folder holds the one optional function for those; Vercel picks it up by itself.

Any other static host works too. Upload these files and folders, keeping the layout as it is:

```
index.html  style.css  manifest.webmanifest  src/  vendor/  assets/
```

`serve.py`, `README.md`, `supabase/` and `.claude/` are for working locally and don't need to go up. `api/` only works on Vercel; elsewhere the game simply stays guest-only. Some other easy hosts:

- **Netlify Drop** (app.netlify.com/drop) or **Cloudflare Pages**: drag the folder in and you get a web address within a minute.
- **GitHub Pages**: set Pages to deploy from the `main` branch, root folder.
- **itch.io**: make a zip, create a project with *Kind of project: HTML*, upload the zip and tick *This file will be played in the browser*.

```bash
zip -r slow-tide.zip index.html style.css manifest.webmanifest src vendor assets
```

**Link previews:** the `og:url` and `og:image` lines in `index.html` point at the Vercel address. If you move the game to another site, change them to the new full address; most social sites ignore relative image paths.

**Privacy:** the game loads nothing from other sites, uses no cookies and no analytics. Progress is kept in the player's own browser (local storage) and never leaves their device. If you switch on cloud saves and a player chooses to sign in, their save (and email address) is also stored in your own Supabase project, where only they can read it.

## How to play

With a keyboard and mouse:

| Key | Does |
| --- | --- |
| W A S D or arrows | Row the boat (W forward, S back, A/D turn), or walk on shore (relative to the camera) |
| Shift (hold) | Jog on shore. Trout feel heavy footsteps, so walk near the stream |
| Drag / scroll | Look around / zoom (in every view) |
| Space (hold) | Start aiming. A dotted arc and a ring on the water show where your rig will land |
| A / D while aiming | Swing the cast left or right |
| Hold longer | A longer cast. Each rod has its own range; light lures don't cast as far |
| Release Space | Cast |
| Esc or right-click while aiming | Put the cast down without casting |
| W / S with the line out | Float rod: bait shallower / deeper. Spinning rod: reel slower / faster |
| Space (tap) with the line out | Twitch the bait, lure or fly |
| Space (hold) with the line out | Reel in (or wind in the carp rig, or strip in fly line). Let go to pause a lure |
| Space when a fish takes | Set the hook (strike). How long you have depends on how it took: see below |
| Space (hold) while a fish is on | Reel. Let go while it pulls, then hold again |
| K on the catch card | Keep the fish for the pot (it goes in your creel). Space lets it go |
| E | Step ashore · get back in the boat · open camp · look closer (when a prompt appears) |
| B | Backpack: rods, tackle and creel (at camp, the tackle box too) |
| Q | Next bait, lure or fly in your backpack for the rod in hand |
| 1 / 2 | Switch between the two rods you carry |
| G | Throw a pouch of loose bait around a carp rig |
| C | Next view: boat (or on foot) → underwater → watching your bait |
| R | Back to the boat view (or over your shoulder) |
| F | Fish finder on or off |
| J or Tab | Journal (with settings: graphics and volumes) |
| T (hold) | Let time drift by quickly |
| M / H | Music on or off / hide the interface |
| Esc | Reel in the line, leave the underwater view, close a panel |

On a phone or tablet the controls appear on screen. Drag on the **left** half to row or walk (a stick appears under your thumb), drag on the **right** half to look around, and pinch to zoom. The round button on the right does all the fishing: hold to aim and let go to cast, tap to strike, hold to reel. Its label tells you what it will do next. Prompts such as *Step ashore* or *Camp* are buttons: tap them. The pack button opens your backpack, the eye button switches views, the sonar button shows the fish finder, and the hourglass lets time drift while you hold it.

Nothing can go wrong. A missed bite just means another will come; a snapped line only loses that fish; and you can never starve.

### A day in Slow Tide

1. Row across Willow Bay to **The Landing** on the west shore and press **E** to step ashore.
2. Walk up the path to **Camp**. Press **E** there to open it: swap rods and tackle with the tackle box, light the fire, grill and eat what you've kept, and sleep.
3. Walk on to **Reedmere**, the lake behind camp, or follow the path up **Fernbeck**, the stream beyond it.
4. Pick the right rod and tackle for the water (press **B**), fish, and keep a fish or two for supper.
5. Back at camp, grill your catch, eat, and sleep until dawn, morning, midday, afternoon, golden hour or night. While you sleep the light changes, the weather may turn, the fire burns down and the fish move to where the new hour suits them.
6. A marker always shows where your boat is. Walk up to it and press **E** to row home.

### Four ways to fish

The rod decides how you fish; what you tie on decides which fish come.

- **Float fishing** (float rod, with a bait). The original Slow Tide way: a bait hangs under a float at the depth you choose (W/S). The float dips when a fish nibbles and goes under when it bites; you have about two and a half seconds to strike.
- **Lure fishing** (spinning rod, with a lure). Hold Space to reel at your chosen speed (W/S: slow, steady or fast), tap to twitch, let go to pause. Crankbaits float up when you stop and dive as you reel (the shallow one to about a metre, the deep one to about three); the spinner sinks while you wait and flashes as it comes in; the jerkbait hangs still between twitches. Predators **follow** a lure, and a twitch or a pause often makes them strike. Pike lie still in the weed and **ambush** it from nowhere. A strike gives you just over a second; if you're reeling when it hits, it often hooks itself. Drag a lure along a weedy bottom and it fouls with weed.
- **Bottom fishing** (carp rod, with a bait). The rig sinks and sits on the bottom while the rod rests on a bite alarm. A single **bleep** means something is moving the line; a screaming **run** means a carp has picked it up and is off: you have about four seconds. Press **G** to throw loose bait around the rig: carp nearby come and graze, and fizzing bubbles show where they're feeding.
- **Fly fishing** (fly rod, with a fly). A dry fly floats and drifts with the current; a nymph drifts just under the surface below an orange indicator; a streamer is stripped back in pulls (hold Space). When the line runs out of slack, the fly is **dragged** across the current, and trout won't take a dragging fly: cast upstream of them and let it drift down. A trout **rises** to inspect a dry fly and either sips it (strike within a second) or refuses it. Dry flies work best when insects are hatching: mornings and especially evenings.

### Rods and tackle

| Rod | Line | Casts | Good at | Watch out |
| --- | --- | --- | --- | --- |
| Willow float rod | 4 lb mono | 4–24 m | Any bait at any depth; shows every nibble | Big carp or pike can snap light line |
| Spinning rod | 10 lb braid, wire trace | 8–36 m (less with light lures) | Working lures; the wire trace stops pike biting through | Shy trout notice the heavier line |
| Carp rod | 12 lb mono | 10–46 m | Long-range bottom baits on a bite alarm; lands big fish | No good for lures; the lead splashes in |
| Fly rod | Floating line, 3 lb tippet | 5–18 m | A silent, weightless landing for wary trout | Short range; play big fish gently |

Baits: garden worms, bay prawns, sweetcorn, bread flake, boilies. Lures: silver spinner, shallow crankbait, deep crankbait, jerkbait. Flies: dry fly (mayfly), nymph (pheasant tail), streamer (woolly bugger).

Gear matters: a lure too big for a fish's mouth is ignored by small fish (so bigger lures pick out bigger fish); trout shy away from thick line; heavy fish on light line strain it, and if you keep reeling while one pulls, the line can snap; a pike's teeth cut anything but wire.

### Backpack, creel and camp

You carry **two rods and six baits, lures or flies**, plus a **creel** for up to four fish you keep. Everything else waits in the **tackle box at camp**; open camp (or your backpack while at camp) to swap. Press **Q** to change tackle anywhere, and **1**/**2** to switch rods.

The top of the backpack has **Head back to: Camp (the tent) · The boat**. Use it any time to return to a safe spot beside the tent or to climb back into the boat, keeping everything you carry and have caught. If you ever get stuck on foot, a *Stuck?* prompt appears that opens it for you. (It waits while a fish is on the line.)

At camp you can light the fire, **grill** a fish from your creel (it takes half an hour of game time, and the fire must be lit), **eat** it, or have an oatcake from the tin. Hunger is gentle: you only get a little slower on your feet if you go a whole day without eating, and a cooked fish makes you **well fed**, which steadies your hands in a fight (the line tightens more slowly) for six hours. Glassminnows are too small to keep, and the old mossback is far too grand to eat.

### Reading the water

- **Rings** spreading on calm water: a fish rising to feed just below (trout rise to hatching flies on the stream).
- **Nervous water**, many small dimples together: a school of small fish near the surface.
- **A flash**: a fish turning in the light just under the surface.
- **A splash**: something jumped.
- **Fizzing bubbles** on the lake: carp grazing the bottom.

Each of these comes from a real fish at that spot. Press **C** to look underwater and you'll find it there.

### The fish finder

Press **F** for a small sonar screen. Drag its title bar to put it anywhere (it remembers the spot); double-click the title bar to put it back. The ⤢ button changes its size, and **?** explains the colours. In the boat it reads the water under the hull; on shore it works like a castable sonar, reading the water around your rig once it's in. The right edge, marked *now*, is the latest reading; older readings slide to the left. It shows the real bottom (a thick, bright line is hard rock; a soft one silt or sand), weeds as green strands, your bait or lure as a blue diamond, and fish as echoes: arches whose size and colour hint at how big they are, specks and clouds for small fish, and a little clutter. It never tells you what kind of fish it is.

### What's out there

Salt water (Willow Bay and beyond):

- **Glassminnow**: schools over shallow sand and weed edges, by day. A small bait, kept shallow and still.
- **Sunperch**: weed beds and rocks in Willow Bay, by day. Takes a worm or chases a spinner.
- **Drizzlefin**: open water past the bay mouth; deep on dry days, near the surface in the rain. Likes a moving bait or lure (a deep crankbait reaches it on dry days).
- **Duskfin**: Driftwood Cove after sundown, drawn to warm light.
- **Mossback**: large and slow by the deepest rocks; only takes a bait resting on the bottom (a prawn, or a boilie on the carp rod).

Fresh water (Reedmere and Fernbeck):

- **Perch**: packs around the weed and the fallen alder. Chases spinners, crankbaits and streamers; where one follows, the pack comes too.
- **Pike**: lies still in the weed and lily pads; ambushes jerkbaits and crankbaits, best at dawn and dusk or in the rain. Its teeth cut fine line.
- **Mirror Carp**: grazes the shallow south-west shelf and margins; ignores lures entirely. Boilies or sweetcorn on the bottom, loose bait, patience, and evenings.
- **Rudd**: near the surface by the lily pads; bread, sweetcorn, or a dry fly.
- **Brown Trout**: holds in the stream pools facing the current. Shy of heavy line and footsteps; rises to dry flies in a hatch, takes nymphs any time.
- **Grayling**: small groups in the stream pools; loves a drifting nymph.

Places: **The Landing**, **Camp**, **Reedmere** (Lily Peg by camp, the fallen alder on the steep north shore, the Willow Swim on the shallow south-west shelf), **Fernbeck** (Spring Pool, Alder Pool and Tail Pool, a footbridge and stepping stones), **Driftwood Cove** (behind the eastern headland; something glints on the beach), **Gull Rock** and **The Old Jetty**.

### Saving your progress

No account is needed. The game saves by itself in your browser: after every catch, release or kept fish, when you change rods or tackle, cook, eat, sleep, travel back to camp or the boat, every ten seconds while you play, and when you close or hide the page. Refresh or come back next week and you carry on where you were: the time of day, where you and the boat are, your gear, backpack and creel, the camp fire and grill, your journal and catch log, and your settings.

The journal's **Your progress** section shows when the game last saved and has three buttons:

- **Download a copy**: saves your whole game as a small `.json` file.
- **Load a saved copy…**: loads one of those files (it asks first, and keeps your current game as a backup).
- **New game…**: starts over after asking you to confirm, with an offer to download a copy first. Your sound and graphics settings stay. The old save is kept aside in the browser rather than deleted.

Saves are careful. Each one carries a version number, so a future update can convert old saves instead of breaking them. Every value is checked when loading, so a damaged save can't crash the game. If the save can't be read at all, it is kept aside (never written over) and the game loads the copy from the start of your previous session instead, and says so. A save made by a newer version is never written over. If you open the game in two tabs, the older tab stops saving so the two can't overwrite each other. In a private window, where the browser may refuse to store anything, the game tells you that progress won't be kept.

### The journal and catch log

Press **J**. The **Fish & places** pages hold a sketch and notes for every fish you've met, the hand-drawn map, keepsakes, settings and your progress. The **Catch log** pages record every fish you land:

- the fish and its length (the game measures fish; it doesn't weigh them),
- the day and time, the water (salt or fresh) and the nearest named spot (Willow Bay, Alder Pool, the fallen alder and so on),
- how you caught it: the rod, the bait, lure or fly, and whether from the boat or the shore,
- how deep it took and how deep the water was, rain, and whether flies were hatching,
- what happened to it: released, kept, cooked or eaten.

It shows your biggest catch, totals and personal bests for each kind of fish, and your recent catches with filters for fish, water, method and what happened to them (25 at a time, with *Show more*). Catches from before the log existed still count in the totals; the log says they have no details rather than inventing them.

### Graphics

The journal's **Settings** (and the title screen) has a Graphics button: **Auto**, **High**, **Medium** or **Low**. Auto starts at High on computers and Medium on phones and tablets, then steps down by itself if the game runs below about 42 frames a second. Settings also has separate **volume**, **nature & effects** and **music** sliders.

| | High | Medium | Low |
| --- | --- | --- | --- |
| Water reflections of sky, shore, boat and lights | Half resolution, every frame | A third, every other frame | Sky colours only |
| Ripples (casts, float, fish, boat, wading) bend the light | Fine, 96 m around you | Coarser, 72 m | Drawn rings |
| Fine wavelets and sun glints | Both | Glints | None |
| Morning mist layers | 3 | 2 | 1 |
| Grain on sand, wood, cork | On | On | Off |
| Shadows, resolution, fish, weeds, raindrops | Most | Fewer | Fewest, no shadows |

A note on what this is: Slow Tide is a stylised, low-poly game drawn with three.js and WebGL in the browser. The water uses real planar reflections, a ripple simulation and procedural detail. The lighting, haze and mist are painted rather than physically simulated, and nothing here is photorealistic. On a typical computer, High costs roughly a third more per frame than the previous version and Medium about a quarter more (measured in software rendering, so real graphics cards will differ). Auto drops a level if the frame rate suffers.

### Cloud saves (optional)

Cloud saves let a player sign in with their email and carry their game between devices. They are **off** until you connect a backend; until then nothing about accounts appears in the game. They use [Supabase](https://supabase.com) (it has a free tier), talking to it directly from the browser with the public "anon" key. Row level security in the database makes sure each player can only ever read or change their own save.

To switch them on:

1. Create a project at [supabase.com](https://supabase.com) (*New project*; any name, region and database password).
2. In the project, open **SQL Editor → New query**, paste in the contents of [`supabase/schema.sql`](supabase/schema.sql) and press **Run**. This creates the `slow_tide_saves` table and its security rules.
3. Open **Authentication → URL Configuration**. Set **Site URL** to `https://fishing-game-weld.vercel.app`. Under **Redirect URLs** add `https://fishing-game-weld.vercel.app/**` and, for branch previews, `https://fishing-game-*.vercel.app/**`.
4. Email sign-in is on by default (**Authentication → Sign In / Providers → Email**). Supabase's built-in email sender only allows a few emails an hour and is meant for testing. For real players, add your own email provider under **Authentication → Emails → SMTP Settings**.
5. Open **Project Settings → API Keys** (or **Data API**) and copy the **Project URL** and the **anon / publishable** key. Never use the `service_role` / secret key: the game and the config function both refuse one.
6. In **Vercel → your project → Settings → Environment Variables**, add `SUPABASE_URL` (the Project URL) and `SUPABASE_ANON_KEY` (the anon key) for *Production* and *Preview*. Then redeploy (**Deployments → ⋯ → Redeploy**).
7. Open the game, press **J**, and look under **Your progress**: a **Cloud save (optional)** box with *Email me a sign-in link* should appear. If it doesn't, open `/api/cloud-config` on your site: it shows `{"enabled": false}` until both variables are set.

How it behaves:

- **Guests keep playing.** Signing in is never required.
- **Signing in keeps what you've done.** The first time, your progress in that browser is uploaded. On another device it is **combined** with your cloud save rather than replaced: every logged catch is kept (matched by its id), each fish keeps the higher count and the bigger best, and places and keepsakes from both are kept. Where you are, the time of day, your gear, creel and camp come from whichever was saved most recently.
- **Two devices at once** don't overwrite each other: each save carries a revision number, and if another device saved in between, the game takes in its catches and tries again.
- **New game** or **Load a saved copy** while signed in also replaces the cloud save, and the confirmation says so.
- **Signing out** leaves your progress in the browser. Deleting a user in Supabase (**Authentication → Users**) deletes their save too.

Not on Vercel? Put the URL and anon key in `src/cloud-config.js` instead. The anon key is designed to be public; never put any other key there.

## Where things live

| File | What it holds |
| --- | --- |
| `src/main.js` | Game loop, time of day, weather, stepping ashore and boarding, interactions, sleep, discoveries, surface clues, HUD, glue between systems |
| `src/world/terrain.js` | The map. One height function shapes the bay, island, cove, channel, and (on the west shore) the lake, stream valley, camp clearing and path. Places, zones, piers and walkable decks live here |
| `src/world/shore.js` | Everything built on the west shore: landing pier and signpost, tent, campfire with smoke and light, tackle chest and rod rack, reeds, lily pads, the fallen alder, fishing pegs, stream boulders, footbridge, stepping stones, ferns, grass and hatching flies |
| `src/world/habitat.js` | The underwater map shared by everything below the surface: depth, weed beds, rock piles, the stream's current, and the homes fish live around |
| `src/world/ecosystem.js` | Every fish in the world: schooling, cruising, feeding, resting, fleeing, rising and jumping, and how each one judges and takes a rig (nibbling, following, ambushing, rising, grazing, running). Fixed 30 Hz simulation, slower far away |
| `src/world/fishRender.js` | Draws the ecosystem's fish (one instanced draw per species) with a swimming tail wave |
| `src/world/underwater.js` | Weed beds, submerged rocks, particles, light shafts, bubbles, and the colour, haze and sound blend as the camera crosses the waterline |
| `src/world/caustics.js` | Dancing light on the seabed and rocks |
| `src/world/world.js` | Terrain mesh (with a finer patch over the west shore), trees, rocks, jetty, cove props, Gull Rock, gulls, fireflies, and the obstacles you bump into on foot |
| `src/world/water.js` | Water shader (depth colour, gusts and calm lanes, wavelets, reflections, ripples, sun glints, foam, rain rings, lantern glow, fresh-water tint, flowing current, the view from below) and the wave function everything floats on |
| `src/world/waterfx.js` | The mirrored view for reflections, and the ripple field every ripple is drawn into |
| `src/world/mist.js` | Drifting morning and evening mist over the water |
| `src/world/surface.js` | Fine surface detail: grain and the wet band on the shore, sand ripples, wood grain, cork |
| `src/world/sky.js` | Day cycle colours, sun and moon, sky dome, clouds |
| `src/camera.js` | The views (boat, on foot, underwater, bait), their limits and smooth transitions |
| `src/boat.js` | The boat, the rower, oars, rods and lantern; rowing physics and collisions |
| `src/walker.js` | You on foot: the character, walking and jogging, wading, slopes and obstacles |
| `src/tackle.js` | Rods (line, range, kind of fishing), baits, lures and flies, and the backpack loadout |
| `src/tackleModels.js` | The little models on the end of the line: float, indicator, lead, baits, lures and flies |
| `src/fishing.js` | Aiming and casting, the four ways a rig behaves in the water, bites, hooking, the fight (with line strength), landing, releasing and keeping |
| `src/fish.js` | The eleven species (where they live, how they behave, what they eat and how they take it), 3D models, journal sketches |
| `src/pack.js` | The backpack and tackle box panel |
| `src/camp.js` | The fire, grill, food and hunger, and the sleep panel |
| `src/sonar.js` | The fish finder (boat and castable), its echoes, and dragging and sizing the panel |
| `src/journal.js` | The journal pages, catch log (totals, bests, filters) and hand-drawn map |
| `src/save.js` | Saving and loading in the browser: the versioned save format, checks, migrations, backups, and combining two saves |
| `src/cloud.js` | Optional cloud saves: email sign-in and syncing with Supabase |
| `src/cloud-config.js` | Where to put the Supabase address and anon key if you don't host on Vercel |
| `api/cloud-config.js` | Vercel function that hands the game `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the public key only) |
| `supabase/schema.sql` | The cloud save table and its row level security rules |
| `src/audio.js` | All sound, synthesised live: water, wind, rain, the stream, the campfire, birds, frogs, crickets, footsteps, the bite alarm, and the generative music |
| `src/effects.js` | Ripples, splashes, flashes, the wake and water lapping on the hull |
| `src/touch.js` | On-screen controls for phones and tablets |
| `src/quality.js` | Graphics presets and the frame-rate watcher behind Auto |
| `vendor/three/` | three.js r160 (MIT licence) |
| `assets/` | Fonts (SIL Open Font License), icons, and the link-preview image |

## Making it your own

- **Add a fish**: add an entry to `FISH` in `src/fish.js`. Its `life` block says where it lives (`homes`, `zones`, `depth`), how it moves, when it is active, how it likes a bait to move, and how cautious it is; `food` says which baits, lures and flies it takes and how keenly; `strike` says how it takes them; `mouth` and `pull` set what size of lure it can manage and how hard it fights. The ecosystem spawns it, and the journal, catch card, 3D model and fish finder pick it up automatically.
- **Add tackle**: add an entry to `TACKLE` in `src/tackle.js` (a bait, lure or fly), give it a model in `src/tackleModels.js`, and add it to the `food` of the fish that should like it. Rods live in `RODS`.
- **More or fewer fish**: `schools`/`members` and `groups`/`group` in each species' `life`, or `fishDensity` in `src/quality.js`.
- **Change the length of a day**: `HOUR_SECONDS` in `src/main.js` (40 real seconds per in-game hour by default).
- **Retune the light**: the `KEYS` table at the top of `src/world/sky.js` sets sky, sun and ambient colours for each part of the day.
- **Reshape the land**: `landSDF` in `src/world/terrain.js`; the lake (`LAKE`), stream (`STREAM`), camp (`CAMP`) and path (`PATH`) are constants near the top.
- **Change what's saved**: add the field to `DEFAULT_STATE` and `sanitize` in `src/save.js`. If an old save needs converting, raise `SAVE_VERSION` and add a step to `MIGRATIONS`.
- **Add a discovery**: copy the lantern pattern in `src/main.js` (`lanternReach` and `takeLantern`) and its prop in `buildCove` in `src/world/world.js`.

The browser console has a small helper for tinkering:

```js
slowTide.setHour(19)          // jump to golden hour
slowTide.setRain(1)           // start rain (0 stops it)
slowTide.teleport(140, -16)   // move the boat straight to the cove
slowTide.walkTo(-99, -2)      // stand at camp (on foot)
slowTide.board()              // back into the boat
slowTide.gear('fly', 'nymph') // hand yourself a rod and tackle
slowTide.reset()              // start a new game (the old save is kept aside)
slowTide.saveInfo()           // how loading went and when the game last saved
slowTide.advance(10)          // run the game forward 10 seconds (works even in a background tab)
slowTide.eco.agents           // every fish in the world, with its species, size, position and state
```

## Credits

- [three.js](https://threejs.org) r160, MIT licence (`vendor/three/LICENSE`).
- Fonts: Caveat, Kalam and Nunito, SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`).
- Everything else, including the sound and music, is generated by the code in `src/`.

## Ideas for next steps

The journal hints at a softer cushion, a potted fern on the bow, and a little cabin by the lake. Other natural next steps: carrying the brass lantern when you walk at night, a second spool for the spinning rod (light line for perch, wire for pike), a canoe for the lake, and seasons that change which fish are about.
