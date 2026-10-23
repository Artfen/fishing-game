# Slow Tide

**Play it: <https://fishing-game-weld.vercel.app>**

A small, peaceful fishing adventure that runs in the browser. You row a little wooden boat around Willow Bay, step ashore at a landing, walk up to your camp, and fish a freshwater lake and a clear trout stream. You choose your rods and tackle, cook what you catch over the fire, sleep in the tent until the hour you like, and keep a handwritten journal of it all.

The water is a living place: weed beds, rocks, lily pads, a fallen tree, sandy shallows, deep water and running pools, home to around 370 fish that school, cruise, feed, rest by cover, hunt and scatter when startled. Rings, flashes, jumps and fizzing bubbles on the surface come from real fish below. You can look underwater, follow your bait or lure, and use a fish finder. The fish that takes your bait is one you could have watched swimming there.

It's a static website: plain JavaScript modules, with no framework or bundler. Everything it needs ships in this folder, including [three.js](https://threejs.org) and the fonts, so it makes no requests to other sites. It installs as an app and plays offline (see [Offline play](#offline-play)). The only server code is one small optional function for cloud saves, which stay switched off until you set them up (see [Cloud saves](#cloud-saves-optional)).

## Run it

```bash
python3 serve.py
```

Then open <http://localhost:8642>. `serve.py` is a tiny static server with caching turned off, so a browser refresh always picks up your edits. It also answers the game's cloud-save question with "not set up", so locally you always play as a guest. On `localhost` the game skips its offline cache so your edits always show; add `?sw` to the address (<http://localhost:8642/?sw>) to try offline play locally. Any static server works too.

### Tests

```bash
node --import ./tests/setup.mjs --test 'tests/*.test.mjs'
```

Node 22 or newer, nothing to install. The tests check saves (version upgrades, the backup and unreadable copies, a newer save never written over, full storage, junk cleaned up, combining two saves), the fight (careful play lands big carp at every difficulty, a player watching for the flick lands nearly all of them on Standard, winding through surges breaks the line, locked drags, pike teeth, weed), and that `sw.js` lists every file for offline play. `tests/setup.mjs` loads three.js from `vendor/` so the game's own modules run as they are.

## Put it online

**Vercel** (what the live game uses): the project is imported from GitHub with the framework preset *Other*. `vercel.json` tells Vercel to run `node tools/build-sw.mjs` on every deploy (it writes the list of game files, and a version made from their contents, into `sw.js` for offline play) and to serve the repository root. Every push to `main` redeploys the site, and every other branch gets its own preview address, so you can try a branch before merging it. No environment variables are needed, unless you want [cloud saves](#cloud-saves-optional). The `api/` folder holds the one optional function for those; Vercel picks it up by itself.

Any other static host works too. Run `node tools/build-sw.mjs` first (so offline play picks up your changes), then upload these files and folders, keeping the layout as it is:

```
index.html  style.css  manifest.webmanifest  sw.js  src/  vendor/  assets/
```

`serve.py`, `README.md`, `tools/`, `supabase/` and `.claude/` are for working locally and don't need to go up. `api/` only works on Vercel; elsewhere the game simply stays guest-only. Some other easy hosts:

- **Netlify Drop** (app.netlify.com/drop) or **Cloudflare Pages**: drag the folder in and you get a web address within a minute.
- **GitHub Pages**: set Pages to deploy from the `main` branch, root folder.
- **itch.io**: make a zip, create a project with *Kind of project: HTML*, upload the zip and tick *This file will be played in the browser*.

```bash
node tools/build-sw.mjs && zip -r slow-tide.zip index.html style.css manifest.webmanifest sw.js src vendor assets
```

**Link previews:** the `og:url` and `og:image` lines in `index.html` point at the Vercel address. If you move the game to another site, change them to the new full address; most social sites ignore relative image paths.

**Privacy:** the game loads nothing from other sites, uses no cookies and no analytics. Progress is kept in the player's own browser (local storage) and never leaves their device. If you switch on cloud saves and a player chooses to sign in, their save (and email address) is also stored in your own Supabase project, where only they can read it.

## How to play

With a keyboard and mouse:

| Key | Does |
| --- | --- |
| W A S D or arrows | Row the boat (W forward, S back, A/D turn), drive the motor skiff (W/S move the throttle lever, which stays where you leave it; A/D steer), or walk on shore (relative to the camera) |
| Shift (hold) | Jog on shore. Trout feel heavy footsteps, so walk near the stream |
| Drag / scroll | Look around / zoom (in every view) |
| Space (hold) | Start aiming. The power meter swings out and back; the ring on the water shows where a clean release would land |
| A / D while aiming | Swing the cast left or right (in first person, turn your head and the cast with it) |
| Release Space | Cast. Let go when the ring is where you want it. Releasing as the meter slows at the top or bottom of its swing is the most accurate |
| Esc or right-click while aiming | Put the cast down without casting |
| W / S with the line out | Float rod: bait shallower / deeper. Spinning rod: reel slower / faster |
| Space (tap) with the line out | Twitch the bait, lure or fly |
| Space (hold) with the line out | Reel in (or wind in the carp rig, or strip in fly line). Let go to pause a lure |
| Space when a fish takes | Set the hook (strike). How long you have depends on how it took: see below |
| Space (hold) while a fish is on | Reel. Ease off for the surge at the start of each run (a flick on the surface warns you), then hold again |
| W / S while a fish is on | Tighten / loosen the reel's drag |
| K on the catch card | Keep the fish for the pot (it goes in your creel). Space lets it go |
| E | Step ashore · get back in the boat · open camp · look closer (when a prompt appears) |
| B | Backpack: rods, tackle and creel (at camp, the tackle box too) |
| Q | Next bait, lure or fly in your backpack for the rod in hand |
| 1 / 2 | Switch between the two rods you carry |
| G | Throw a pouch of loose bait around a carp rig |
| Z | Drop or raise the anchor (in either boat, when slow) |
| X | Motor skiff: throttle to neutral |
| V | First person on or off: through your own eyes, the rod in your hands |
| C | Next view: boat (or on foot) → first person → underwater → watching your bait |
| R | Back to the boat view (or over your shoulder), first person off |
| F | Fish finder on or off |
| J or Tab | Journal (with settings: graphics, difficulty, fishing view and volumes) |
| T (hold) | Let time drift by quickly |
| M / H | Music on or off / hide the interface |
| Esc | Reel in the line, leave the underwater view, close a panel |

On a phone or tablet the controls appear on screen. Drag on the **left** half to row, drive or walk (a stick appears under your thumb; in the motor skiff, push it forward for throttle), drag on the **right** half to look around, and pinch to zoom. While a fish is on, stick up/down sets the drag. The round button on the right does all the fishing: hold to aim and let go to cast, tap to strike, hold to reel. Its label tells you what it will do next. Prompts such as *Step ashore* or *Camp* are buttons: tap them. The pack button opens your backpack, the eye button switches views (first person among them), the sonar button shows the fish finder, and the hourglass lets time drift while you hold it.

Nothing can go wrong. A missed bite just means another will come; a snapped line only loses that fish (and the game tells you why it broke); and you can never starve.

### A day in Slow Tide

1. Row across Willow Bay to **The Landing** on the west shore and press **E** to step ashore.
2. Walk up the path to **Camp**. Press **E** there to open it: swap rods and tackle with the tackle box, light the fire, grill and eat what you've kept, and sleep.
3. Walk on to **Reedmere**, the lake behind camp, or follow the path up **Fernbeck**, the stream beyond it.
4. Pick the right rod and tackle for the water (press **B**), fish, and keep a fish or two for supper.
5. Back at camp, grill your catch, eat, and sleep until dawn, morning, midday, afternoon, golden hour or night. While you sleep the light changes, the weather may turn, the fire burns down and the fish move to where the new hour suits them.
6. A marker always shows where your boat is. Walk up to it and press **E** to row home.

### Four ways to fish

The rod decides how you fish; what you tie on decides which fish come. (Strike times below are for Standard difficulty.)

- **Float fishing** (float rod, with a bait). The original Slow Tide way: a bait hangs under a float at the depth you choose (W/S). The float dips when a fish nibbles and goes under when it bites; you have about two and a half seconds to strike.
- **Lure fishing** (spinning rod, with a lure). Hold Space to reel at your chosen speed (W/S: slow, steady or fast), tap to twitch, let go to pause. Crankbaits float up when you stop and dive as you reel (the shallow one to about a metre, the deep one to about three); the spinner sinks while you wait and flashes as it comes in; the jerkbait hangs still between twitches. Predators **follow** a lure, and a twitch or a pause often makes them strike. Pike lie still in the weed and **ambush** it from nowhere. A strike gives you just over a second; if you're reeling when it hits, it often hooks itself. Drag a lure along a weedy bottom and it fouls with weed.
- **Bottom fishing** (carp rod, with a bait). The rig sinks and sits on the bottom while the rod rests on a bite alarm. A single **bleep** means something is moving the line; a screaming **run** means a carp has picked it up and is off: you have about four seconds. Press **G** to throw loose bait around the rig: carp nearby come and graze, and fizzing bubbles show where they're feeding.
- **Fly fishing** (fly rod, with a fly). A dry fly floats and drifts with the current; a nymph drifts just under the surface below an orange indicator; a streamer is stripped back in pulls (hold Space). When the line runs out of slack, the fly is **dragged** across the current, and trout won't take a dragging fly: cast upstream of them and let it drift down. A trout **rises** to inspect a dry fly and either sips it (strike within a second) or refuses it. Dry flies work best when insects are hatching: mornings and especially evenings.

### Playing a fish

A hooked fish rests and runs in turns. When it rests, hold Space to wind it in. Just before each run it flicks on the surface: **ease off** for the first moment of the run (the *surge*), then hold again to keep the rod up and the pressure on, which tires it. The outer ring by the rod shows how close it is; the inner ring is the line's tension, and the small dot on it is where your reel's **drag** starts to give line.

The flick is hard to miss: a splash and a sound where the fish is, the rod tip nods, the ring pulses amber and reads *flick!* (on a phone the button says *Easy*, and phones that can will buzz). The jolt of a surge builds over its first moment, so letting go as soon as you notice the run is usually still in time; holding on through it is not.

The drag is a clutch: when a fish pulls harder than the drag setting, the reel lets line go instead of the line breaking. W/S (or the stick) tightens or loosens it during a fight. A light drag is safe but slow; a firm drag tires fish faster but leaves less margin. Each rod starts with a sensible setting (light for fine lines), and the game remembers yours.

When a line does break, a note says exactly why:

- **Tension**: you were winding hard just as the fish surged. Watch for the flick and ease off.
- **Drag**: the drag was locked, so it couldn't give line.
- **Snag**: the line was too light to stop the fish reaching weed or roots. Use heavier line for big fish near cover.
- **Teeth**: a pike cut line with no wire trace. The spinning rod has one.

A carp on the carp rod, played this way, is landed every time (about half a minute for a big one). The light float rod can land a carp too, with a light drag and patience, but a big one may reach the weed.

### Difficulty

Journal → Settings (or the title screen) → **Difficulty**. Change it whenever you like; nothing is lost.

| | Relaxed | Standard | Realistic |
| --- | --- | --- | --- |
| Time to strike after a bite | Longer (×1.6) | Normal | Shorter (×0.75) |
| How hard fish pull | Softer | Normal | Harder |
| Surges and line tension | Forgiving | Normal: the jolt builds over about a third of a second | Unforgiving: it builds fast |
| Warning flick before a run | Early | Normal | Late |
| Fish reaching weed on light line | Rarely | Sometimes | Often |
| Cast scatter | Less | Normal | More |

The right rod, a sensible drag and easing off at the surge land fish at every level.

### Casting

Hold Space and watch the meter swing out and back. The ring on the water moves with it; let go when it's where you want your rig. Let go as the meter slows at the top (a long cast) or the bottom (a short one) and the cast flies true. Let go in a hurry mid-swing and it strays. Rods differ: the fly rod and trout rod are precise; the carp rod casts furthest but less precisely. **Wind** pushes light tackle (flies, small lures) downwind, so aim a little into it: the arrow next to the distance shows which way it blows. A heavy carp lead hardly drifts. After each cast a note says how it went: *Right on the mark!*, *2 m short*, *1 m wide right: the wind carried it*.

### First person

Raise the rod to cast and the view glides into your own eyes: the rod in your hands, the line running out to the float, the water in front of you. Look around by dragging; while you aim, A and D turn your head and the cast with it. The rod moves with what you're doing: back over your shoulder as the meter swings up, a flick and a whip of the tip as the cast goes out, low for a lure, high and bending against a running fish, which your head follows if it runs off to the side. Land a fish and you hold it up in front of you for a good look before the card. Walk or row off and the view returns over your shoulder. **V** switches in or out at any time (you can walk, row or drive the skiff in first person too); in a boat the view turns with the boat and rolls a little with it. If you'd rather always see yourself, set **Fishing view: Over the shoulder** in the journal's settings.

### Rods and tackle

| Rod | Line | Casts | Good at | Watch out |
| --- | --- | --- | --- | --- |
| Willow float rod | 4 lb mono | 4–24 m | Any bait at any depth; shows every nibble | Big carp or pike can snap light line |
| Spinning rod | 10 lb braid, wire trace | 8–36 m (less with light lures) | Working lures; the wire trace stops pike biting through | Shy trout notice the heavier line |
| Carp rod | 12 lb mono | 10–46 m | Long-range bottom baits on a bite alarm; lands big fish | No good for lures; the lead splashes in |
| Fly rod | Floating line, 3 lb tippet | 5–18 m | A silent, weightless landing for wary trout | Short range; play big fish gently |
| Light trout spinning rod | 4 lb fluorocarbon | 5–28 m | Flicks tiny spinners, spoons and plugs on fine line trout don't notice | No wire trace (pike bite through); heavy lures overload it |

Baits: garden worms, bay prawns, sweetcorn, bread flake, boilies. Lures: silver spinner, shallow crankbait, deep crankbait, jerkbait, and for the trout rod a little trout spinner, a trout spoon and a mini minnow plug. Flies: dry fly (mayfly), nymph (pheasant tail), streamer (woolly bugger).

At camp the backpack offers **ready-made setups** you can pack in one go: *The bay*, *Carp*, *Pike & perch*, *Trout spinning* (trout rod and trout lures) and *Fly fishing* (fly rod and flies, with the trout rod as a spare).

Gear matters: a lure too big for a fish's mouth is ignored by small fish (so bigger lures pick out bigger fish); trout shy away from thick line (they rate a trout spinner on the trout rod about seven times higher than the big spinner on the spinning rod); a big fish on light line runs further and can reach the weed; a pike's teeth cut anything but wire.

### The motor skiff

An old motor skiff is tied up at the end of **The Landing**. Walk up to it and press E to get in. W and S move the throttle lever, which stays where you leave it (on a touch screen the stick drives it directly). A/D steer with the tiller, X puts the motor in neutral, and Z (or the prompt, when you're stopped) drops or raises the anchor. It's about twice as fast as rowing, and at anchor it holds its spot while you fish.

Fish hear the motor, so throttle back (or anchor) before you fish; casting puts it in neutral by itself. In shallow water the motor tips up and you can only creep, so you can't run aground at speed: steer or reverse back to deeper water. Step off at a shore or pier as from the rowing boat, and step across between the two boats when they're side by side. Both boats stay where you leave them, anchored or not, and the backpack's *Head back to: The boat* returns you to whichever you used last. There's no fuel or damage to worry about.

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

### Offline play

Slow Tide is a Progressive Web App. The first time you open it online, it quietly stores the whole game on your device (scripts, styles, fonts, icons; the sounds and shaders are made by the code) and the title screen says **Ready to play offline**. After that it starts and plays with no connection at all: fishing, the journal and catch log, saving, and every place you've found. To add it to your home screen: on iPhone or iPad, Share → *Add to Home Screen*; on Android Chrome, ⋮ → *Install app*; on a computer, the install icon in the address bar.

While you're offline, *Offline* appears next to the clock, and the journal explains that everything keeps working and saving on this device. If you've switched on cloud saves and signed in, syncing pauses; your progress waits in the browser and goes up when the connection is back, combined with anything newer from your other devices (catches are matched by id, so nothing is counted twice).

New versions arrive safely. When a new version is deployed, the game downloads it in the background and keeps running the old one. On the title screen it switches straight away; during play it offers *Update to the new version* in the journal, and keeps your progress either way. Saves live in the browser's local storage, which updates never touch.

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
| `src/camera.js` | The views (boat, on foot, first person, underwater, bait), their limits and smooth transitions |
| `src/firstperson.js` | First person: where the rod is held in front of your eyes for each moment of fishing, and its springy whip |
| `src/boat.js` | The rowing boat and the motor skiff: hull, rower or helmsman, oars or outboard, rods, lantern and anchor; rowing and motor physics and collisions |
| `src/walker.js` | You on foot: the character, walking and jogging, wading, slopes and obstacles |
| `src/tackle.js` | Rods (line, range, kind of fishing), baits, lures and flies, and the backpack loadout |
| `src/tackleModels.js` | The little models on the end of the line: float, indicator, lead, baits, lures and flies |
| `src/fishing.js` | Aiming and casting (the swinging meter, accuracy and wind), the four ways a rig behaves in the water, bites, hooking, the fight, landing, releasing and keeping |
| `src/fight.js` | The fight as plain numbers: tension against the line's strength, the reel's drag, fish stamina, surges, why a line breaks, and the difficulty levels |
| `src/offline.js` | Registers the service worker, reports when the game is ready offline, watches the connection, and applies updates safely |
| `sw.js` | The service worker: stores every game file for offline play, one cache per version |
| `tools/build-sw.mjs` | Writes the file list and version into `sw.js` (`--check` reports if it's out of date) |
| `vercel.json` | Runs `tools/build-sw.mjs` on every Vercel deploy |
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
slowTide.useSkiffAt(20, 30)   // climb into the motor skiff out in the bay
slowTide.firstPerson()        // into first person (firstPerson(false) to come back out)
slowTide.setWind(0.6)         // a fresh breeze (0 to 1)
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

The journal hints at a softer cushion, a potted fern on the bow, and a little cabin by the lake. Other natural next steps: carrying the brass lantern when you walk at night, a second spool for the spinning rod (light line for perch, wire for pike), a canoe for the lake, fuel and simple upgrades for the skiff once its handling has settled, and seasons that change which fish are about.
