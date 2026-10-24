# Slow Tide

**Play it: <https://fishing-game-weld.vercel.app>**

A small, peaceful fishing adventure that runs in the browser. You start in a little wooden boat on Willow Bay, step ashore at a landing, walk up to your camp, and fish a freshwater lake and a clear trout stream. Beyond the bay lies a whole coast: the Wend estuary with its sandbanks and saltings, Longmere (a big inland lake with a boathouse), Gannet Isle with its lighthouse and kelp reefs, a long offshore shoal, and the deep Blue Water where tuna chase the sprat shoals. Four boats get you about: the rowing boat, a motor skiff, a quiet kayak and a bass boat. You choose your rods and tackle, cook what you catch over the fire, sleep in the tent until the hour you like, and keep a handwritten journal and a map of it all.

The water is a living place: weed beds, rocks, lily pads, drowned trees, reefs, sandy flats, channels, deep water and running pools, home to over a thousand fish and squid of 23 kinds that school, cruise, feed, rest by cover, hunt and scatter when startled. Fresh water, brackish water and the sea each have their own. Rings, flashes, jumps, fizzing bubbles, boiling water and diving seabirds on the surface come from real fish below. You can look underwater, follow your bait or lure, and use a fish finder. The fish that takes your bait is one you could have watched swimming there.

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

Node 22 or newer, nothing to install (on Node 20, leave out the quotes around the pattern). The tests check saves (version upgrades including the move to four boats, the backup and unreadable copies, a newer save never written over, full storage, junk cleaned up, combining two saves, the explored map and catch positions), the fight (careful play lands big carp at every difficulty, the creak is a real warning on Standard, winding through surges breaks the line, locked drags, pike teeth, weed), tackle (every ready-made setup is castable and complete, impossible rigs are refused with a reason, every kind of fish can be caught with some setup), the world (every species lives somewhere, fresh water fish stay in fresh water and sea fish in the sea), the backpack's pictures (every rod, reel, line, rig, leader, bait, lure, fly and jig has its own model, drawn from its data), the map's memory of where you've been, and that `sw.js` lists every file for offline play. `tests/setup.mjs` loads three.js from `vendor/` so the game's own modules run as they are.

Two tuning tools play the real game code headless: `node --import ./tests/setup.mjs tools/fightsim.mjs` plays thousands of fights per species, rod, difficulty and player style; `node --import ./tests/setup.mjs tools/ecosim.mjs` fishes the living ecosystem with a chosen rig in a chosen spot and reports which species come and how soon they bite.

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

With a keyboard and mouse (every key below can be changed in **Settings → Controls & comfort**; keys are shown as printed on your keyboard, so W A S D is Z Q S D on AZERTY):

| Key | Does |
| --- | --- |
| W A S D or arrows | Row or paddle (W forward, S back, A/D turn), drive a motorboat (W/S move the throttle lever, which stays where you leave it; A/D steer), or walk on shore (relative to the camera) |
| Shift (hold) | Jog on shore. Trout feel heavy footsteps, so walk near the stream |
| Drag / scroll | Look around / zoom (in every view) |
| Space (hold) | Aim and load the cast: the landing ring and the arc of the cast move out the longer you hold |
| A / D while aiming | Swing the cast left or right (in first person, turn your head and the cast with it) |
| Release Space | Cast to the ring |
| Esc or right-click while aiming | Put the cast down without casting |
| W / S with the line out | Float rod: bait shallower / deeper. Lures: reel slower / faster |
| Space (tap) with the line out | Twitch the bait or lure, or dart a squid jig up |
| Space (hold) with the line out | Reel in (or wind in a bottom rig, or strip in fly line). Let go to pause a lure |
| Space when a fish takes | Set the hook (strike). A carp running with a hair rig, or a fish grabbing a lure as you reel, hooks itself |
| Space (hold) while a fish is on | Reel. Ease off for the surge at the start of each run (a flick on the surface warns you; a creak means the line is at its limit), then hold again |
| W / S while a fish is on | Tighten / loosen the reel's drag |
| K on the catch card | Keep the fish for the pot (it goes in your creel). Space lets it go |
| E | Step ashore · get in a boat · step across between boats · open camp or a tackle box · look closer (when a prompt appears) |
| B or I | Backpack: rods, line, rigs, tackle, setups and creel (with a tackle box or a boat locker in reach, the box too) |
| Q | Next bait, lure, fly or jig in your backpack for the rod in hand |
| 1 / 2 | Switch between the two rods you carry |
| G | Throw a pouch of loose bait around a carp rig |
| Z | Drop or raise the anchor (when slow) |
| X | Motorboats: throttle to neutral |
| V | First person on or off |
| C | Next view: boat (or on foot) → first person → underwater → watching your bait |
| R | Reset the camera: back behind you, first person off |
| F | Fish finder on or off |
| M | Map |
| J or Tab | Journal |
| O | Settings |
| T (hold) | Let time drift by quickly |
| H | Hide the interface |
| Esc | Reel in the line, leave the underwater view, close a panel |

On a phone or tablet the controls appear on screen. Drag on the **left** half to row, paddle, drive or walk (a stick appears under your thumb; in a motorboat, push it forward for throttle), drag on the **right** half to look around, and pinch to zoom. While a fish is on, stick up/down sets the drag. The round button on the right does all the fishing: hold to aim and let go to cast, tap to strike, hold to reel. Its label tells you what it will do next. Prompts such as *Step ashore* or *Camp* are buttons: tap them. The buttons along the top open the fish finder, backpack, views, journal, map and settings, and the hourglass lets time drift while you hold it.

Nothing can go wrong. A missed bite just means another will come; a snapped line only loses that fish (and the game tells you why it broke); and you can never starve.

### A day in Slow Tide

1. Row across Willow Bay to **The Landing** on the west shore and press **E** to step ashore.
2. Walk up the path to **Camp**. Press **E** there to open it: swap rods and tackle with the tackle box, light the fire, grill and eat what you've kept, and sleep.
3. Walk on to **Reedmere**, the lake behind camp, or follow the path up **Fernbeck**, the stream beyond it.
4. Pick the right rod and tackle for the water (press **B**), fish, and keep a fish or two for supper.
5. Back at camp, grill your catch, eat, and sleep until dawn, morning, midday, afternoon, golden hour or night. While you sleep the light changes, the weather may turn, the fire burns down and the fish move to where the new hour suits them.
6. A marker always shows where your boat is. Walk up to it and press **E** to row home.

### Further afield

The coast is big: the far places are one to three minutes away by motor skiff, and you find them by going there. The **map** (**M**) fills in as you explore and marks every place you've found.

- **The Wend**: an estuary east of the bay, past the cove. Sandbanks and mudflats, reeds, a deep channel and the quiet channels of **The Saltings**. **Wend Quay** has a camp with a tackle box. The water is brackish: sea fish that like it (mullet, flounder, sea bass) and none of the lake fish.
- **Longmere**: a big lake inland, reached by the trail from Wend Quay. Weedy bays, a steep north shore where oaks have toppled into the water, an alder island (**Heron Holm**), and the **Mere Boathouse** with its jetty, the bass boat and a tackle box. Pike, perch, roach, and largemouth bass.
- **Gannet Isle**: a green island far out to the south-west, with the **Gannet Light** turning all night, kelp and reef all round it, and **Puffin Cove**, a sheltered landing with a camp and a tackle box. **The Skerries** lie halfway out. Wrasse, plaice, mackerel and, after dark, squid.
- **Long Shoal**, marked by a yellow buoy, and **Little Skellig**, a rock covered in birds, on the way out to **The Blue Water**: open sea past the shelf, where tuna hunt the sprat shoals.

Camps you've found are listed beside the map: **Go there** takes you to any of them in a short fade (a little time passes, more for further camps), and **Go there** by your boat takes you back aboard. Your boats stay where you left them.

### Six ways to fish

The rod decides how you fish; what you tie on decides which fish come. (Strike times below are for Standard difficulty.)

- **Float fishing** (float rod, with a bait). A bait hangs under a float at the depth you choose (W/S). The float dips when a fish nibbles (no sound: just watch it) and goes under when it bites: a soft bell and **Bite — strike!** tell you, and you have about two and a half seconds. The alert means *strike now*, not that the fish is hooked.
- **Lure fishing** (light spinning rod, spinning rod, coastal rod or offshore rod, with a lure). Hold Space to reel at your chosen speed (W/S: slow, steady or fast), tap to twitch, let go to pause. Each lure moves its own way: crankbaits float up when you stop and dive as you reel, spinners flash and sink, a jerkbait hangs still between twitches, a soft shad swims, a weedless creature bait crawls and hops along the bottom, a popper and a stickbait splash and walk across the top, a metal sinks fast and flutters. Predators **follow** a lure, and a twitch or a pause often makes them strike; pike lie still in the weed and **ambush** it. If you're reeling when it hits, it often hooks itself.
- **Carp fishing** (carp rod, with a bait). The rig sinks and sits on the bottom while the rod rests on a bite alarm. A single soft **bleep** means something is moving the line; a run means a carp has picked up the bait, and with the **hair rig** or **method feeder** it hooks itself: a three-note bell and **Fish on!** tell you it's already hooked. Press **G** to throw loose bait around the rig.
- **Sea bottom fishing** (boat & bottom rod, with lugworm, ragworm, crab or mackerel strip). A flapper rig or running ledger on the seabed. Watch the rod tip: little rattles are fish mouthing the bait; when it **pulls round**, strike. Flatfish (flounder in the estuary, plaice on the sand round Gannet Isle), wrasse by the rocks and sea bass take baits on the bottom.
- **Fly fishing** (fly rod, with a fly). Hold Space to false-cast: each stroke shoots more line out; let go on a forward stroke to deliver. A dry fly floats and drifts with the current, a nymph drifts under an indicator, a streamer is stripped back in pulls. Trout won't take a **dragging** fly: cast upstream of them and let it drift down.
- **Squid jigging** (squid rod, with an egi jig: 1.8 sinks slowly for the shallows, 2.5 for most places, 3.0 sinks fast for deep water or current). Let the jig sink to near the bottom, **tap** to dart it up, then **pause**: squid follow a darting jig and grab it as it glides back down. A touch on the line is a squid feeling the jig; let it sink on and strike when it takes. Squid gather where light falls on the water after dark (the lamps at the jetty and at Puffin Cove, or your boat's lantern) and hunt by day too, more warily. A hooked squid jets backwards in pulses and may squirt ink when you land it. In the journal and on the catch card they're measured by mantle length, and listed under *Not fish*.

### Bite alerts

Alerts are gentle and never repeat: a nibble on a float is silent, a strike-worthy bite rings a soft bell once (**Bite — strike!**), a carp or a lure fish that has hooked itself rings a three-note bell (**Fish on!**). The bite-alert bell has its own volume in Settings, and the master mute silences it like everything else. The camera never jumps on a bite or a hooked fish.

### Playing a fish

A hooked fish rests and runs in turns. When it rests, hold Space to wind it in. Just before each run it flicks on the surface: **ease off** for the first moment of the run (the *surge*), then hold again to keep the rod up and the pressure on, which tires it. The outer ring by the rod shows how close it is; the inner ring is the line's tension, and the small dot on it is where your reel's **drag** starts to give line.

The flick is hard to miss: a splash and a sound where the fish is, the rod tip nods, the ring pulses amber and reads *flick!* (on a phone the button says *Easy*, and phones that can will buzz). The jolt of a surge builds over its first moment, so letting go as soon as you notice the run is usually still in time; holding on through it is not.

Each kind fights in its own way, and the prompt says what it's doing: carp, tench and wrasse plod off on long, heavy runs; trout, perch, mackerel, mullet and sea bass dart this way and that; pike and largemouth bass shake their heads at the surface; flatfish flatten themselves on the bottom; squid jet backwards in short pulses; tuna sound deep and circle below the boat.

The drag is a clutch: when a fish pulls harder than the drag setting, the reel lets line go instead of the line breaking. W/S (or the stick) tightens or loosens it during a fight. A light drag is safe but slow; a firm drag tires fish faster but leaves less margin. Each rod starts with a sensible setting (light for fine lines), and the game remembers yours.

When a line does break, a note says exactly why:

- **Tension**: you were winding hard just as the fish surged. Watch for the flick and ease off.
- **Drag**: the drag was locked, so it couldn't give line.
- **Snag**: the line was too light to stop the fish reaching weed or roots. Use heavier line for big fish near cover.
- **Teeth**: a pike cut line with no wire trace. The spinning rod has one.

Line strain builds up rather than snapping at once: when the line **creaks**, it's at its limit, and easing off right then saves it on Standard. A carp on the carp rod, played this way, is landed every time (about half a minute for a big one); a bluefin tuna on the offshore rod takes about forty seconds, a squid ten. The light float rod can land a carp too, with a light drag and patience, but a big one may reach the weed.

### Difficulty

**Settings** (O, or the title screen) → **Controls & comfort** → **Difficulty**: Relaxed, Standard or Realistic. Change it whenever you like; nothing is lost.

| | Relaxed | Standard | Realistic |
| --- | --- | --- | --- |
| Time to strike after a bite | Longer (×1.6) | Normal | Shorter (×0.75) |
| How hard fish pull | Softer | Normal | Harder |
| Surges and line tension | Forgiving | Normal: the jolt builds over about a third of a second | Unforgiving: it builds fast |
| Warning flick before a run | Early | Normal | Late |
| Fish reaching weed on light line | Rarely | Sometimes | Often |
| Line strain before it breaks | Lots | A moment to react to the creak | Little |
| Wind and overloading on manual casts | Less | Normal | More |

The right rod, a sensible drag and easing off at the surge land fish at every level.

### Casting

Hold Space to load the rod: the ring on the water and the dotted arc of the cast move out at an even pace, so it's easy to stop where you want. Let go to cast. The rig flies along the arc you saw and lands on the ring: no dice, the same release always lands in the same place. Swing the aim with A/D (or by looking round) independently of where the boat or you face. Esc or right-click puts the cast down.

Two ways to cast (Settings → Controls & comfort → **Casting**):

- **Assisted** (the default): the ring is exactly where it lands, wind included. Hold as long as you like.
- **Manual**: the ring shows where you're aiming; the wind pushes light tackle off it (a fainter ring shows where it will really land). When the rod is fully loaded the ring turns green for a moment: let go then for a few extra metres. Hold on past that and the rod overloads: the ring goes amber and the cast collapses short and to the right.

Rods and tackle matter: each rod has a casting weight range (shown in the backpack). Heavy rigs fly far and hardly drift; light lures and flies blow about in the wind; a lure too light for the rod won't load it and falls short; one far too heavy isn't allowed at all (the backpack says why). Banks, high ground and overhanging branches stop a cast where they meet it, and a cast that would land on dry land or in water too shallow to fish drops into the last good water along its way. A note after each cast says how it went: *Right on the mark*, *4 m short: the rod overloaded*, *2 m wide right: the wind carried it*, *a branch caught it*. Bottom rigs and leads sink and settle; floats cock at the depth you set; jigs sink at their own rate. The fly rod has its own rhythm: false casts that shoot out a little more line each stroke, delivered on the forward stroke.

### Views and first person

The camera stays in the view you chose: casting, a bite and a hooked fish never switch it. **V** goes in or out of first person at any time (the rod in your hands, the line running out, the water in front of you; you can walk, row or drive in first person too). **C** steps through the views, including underwater and following your bait. **R** resets the camera behind you. Settings has camera sensitivity, inverted look and a **reduced motion** option that keeps the camera from swaying or turning by itself.

### Rods and tackle

| Rod | Kind | Casts | Casting weight | Lines | Rigs and leaders |
| --- | --- | --- | --- | --- | --- |
| Willow float rod | Float, baits | 3–26 m | 2–12 g | 4, 6 or 8 lb mono | Stick float, waggler, margin float |
| Light spinning rod | Lures | 5–28 m | 2–8 g | 4 lb fluorocarbon, 6 lb mono | Straight through |
| Spinning rod | Lures | 8–40 m | 7–30 g | 10 or 20 lb braid | Wire trace (for pike), fluorocarbon leader, straight through |
| Carp rod | Bottom baits on an alarm | 10–50 m | 40–120 g | 12 or 15 lb mono | Hair rig with a 3 oz lead, method feeder (both self-hooking) |
| Fly rod | Flies | 5–20 m | — | Floating line, 3 or 5 lb tippet | Tapered leader |
| Coastal spinning rod | Sea lures | 12–60 m | 12–50 g | 20 or 30 lb braid | Fluorocarbon leader, straight through |
| Boat & bottom rod | Sea baits on the bottom | 4–34 m | 50–200 g | 20 lb mono | Flapper rig (5 oz), running ledger (3 oz) |
| Squid rod (egi) | Squid jigs | 8–42 m | 5–22 g | PE 0.8 braid, 10 lb leader | Fluorocarbon leader |
| Offshore rod | Big lures for tuna | 15–70 m | 40–160 g | 80 lb braid | 100 lb shock leader |

Baits: garden worms, maggots, sweetcorn, bread flake, boilies, prawns, ragworm, lugworm, peeler crab, mackerel strip. Lures: trout spinner, silver spinner, trout spoon, mini minnow, shallow and deep crankbaits, jerkbait, paddle-tail shad, weedless creature bait, surface popper, soft sandeel, 25 g casting metal, 60 g offshore stickbait, 80 g metal jig. Flies: dry fly, nymph, streamer. Squid jigs: 1.8, 2.5 and 3.0.

### The backpack

Press **B** (or the pack button). The backpack opens like your tackle, in three parts:

- **Equipment** (left): tabs for *Rods & reels*, *Lines & leaders*, *Floats & rigs*, *Lures*, *Baits*, *Flies & jigs* and *Setups*, each a tray of pictures. What you carry comes first; what's left in the tackle box is below it, marked *In the tackle box*. Filter by *Fits the rod in hand*, fresh or salt water, and carried or boxed, or search. Each tile says where the piece is: ✋ in hand, ● on your line, ◐ on your other rod, ✓ carried, ▣ in the box, ✕ no rod for it.
- **Selected** (middle): the piece large and well lit. Drag it (or focus it and use the arrow keys) to turn it; rods show the whole rod or a close-up of the handle and reel. Below: what it's for, its real numbers, whether it suits your rod (✓ fine, ! a caution, ✕ won't work, each with the reason: *"This 16 g lure fits your rod's 7–30 g casting range"*), the fish that take it (only the ones you've met are named), a comparison with what you have on now, and the action: **Tie on**, **Spool it on**, **Rig it**, **Take in hand**, **Pack it** or **Leave in the tackle box**. When an action can't happen here, it says why.
- **Your setup** (right): the rod in hand as it's rigged, rod → reel → line → leader or rig → bait or lure, with the other rod below. Click a part to change it. While you look at a replacement, the part it would change is outlined and the setup shows what the change does (weight, casting distance, line strength) before you commit. The creel and *Head back* are tucked underneath.

Line, rig and what's tied on can be changed anywhere; rods and tackle are swapped (and whole setups packed or saved) only within reach of a tackle box: at a camp, or a motorboat's locker. **Q** and **1**/**2** still work with the backpack open, **Esc** closes it, and Tab, the arrow keys, Enter and Space move around and press things without casting or moving you. On a narrow screen the three parts become tabs. Impossible combinations aren't allowed and the panel says why (a fly on a spinning rod, a 60 g stickbait on the light rod); combinations that work but badly get a gentle warning.

All the pictures are drawn by the game itself from the tackle data (`src/gearArt.js`), photographed once by a small studio renderer (`src/gearView.js`) and kept for the session.

**Ready-made setups** pack everything in one go wherever there's a tackle box or a boat locker: *Starter Carp*, *Float Fishing*, *Light Trout*, *Fly Fishing*, *Lake Predator*, *Coastal Spinning*, *Flatfish*, *Squid*, *Offshore* and *The Bay*. Each one lands the fish it's named for. You can also **save your own setups** (up to six) and switch back to them later.

Gear matters: a lure too big for a fish's mouth is ignored by small fish (so bigger lures pick out bigger fish); trout and mullet shy away from thick line; a big fish on light line runs further and can reach the weed; a pike's teeth cut anything but wire; flatfish only find a bait lying on the bottom.

### Boats

| Boat | Where it starts | Good for |
| --- | --- | --- |
| Rowing boat | Willow Bay | Steady and roomy, quick enough under oars |
| Motor skiff | End of The Landing | The open coast and the far islands: about twice as fast as rowing |
| Kayak | Beside The Landing | Silent and floats in a hand's depth of water: creep into the shallows, the saltings and the reeds without spooking fish. Slower than the rowing boat |
| Bass boat | Longmere, at the boathouse jetty | A broad, steady casting platform with a locker for your tackle box. The first notches of throttle run a near-silent electric motor at the bow for creeping along weed beds and reeds; push on for the big outboard to cross the lake fast |

Walk up to a boat and press **E** to get in; step across between two boats side by side; step ashore at any bank, pier or jetty. In a motorboat W and S move the throttle lever, which stays where you leave it (on a touch screen the stick drives it directly); A/D steer, X goes to neutral, Z (or the prompt, when you're stopped) drops or raises the anchor. Fish hear an outboard, so throttle back (or anchor) before you fish; casting puts it in neutral by itself. In shallow water an outboard tips up and you can only creep. Every boat stays where you leave it, anchored or not, and boats reloaded from a save are checked: one that wouldn't float where it was goes back to its mooring. There's no fuel or damage to worry about.

### Backpack, creel and camp

You carry **two rods and eight baits, lures, flies or jigs**, plus a **creel** for up to four fish you keep. Everything else waits in a **tackle box**: at camp, at Wend Quay, at the Mere Boathouse and at Puffin Cove, and in the lockers of the motor skiff and the bass boat. Open the backpack within reach of one to swap. Press **Q** to change tackle anywhere, and **1**/**2** to switch rods.

The top of the backpack has **Head back to: Camp (the tent) · The boat · Another camp (map)**. Use it any time to return to a safe spot beside a tent or to climb back into your boat, keeping everything you carry and have caught. If you ever get stuck on foot, a *Stuck?* prompt appears that opens it for you. (It waits while a fish is on the line.)

At camp you can light the fire, **grill** a fish from your creel (it takes half an hour of game time, and the fire must be lit), **eat** it, or have an oatcake from the tin. Hunger is gentle: you only get a little slower on your feet if you go a whole day without eating, and a cooked fish makes you **well fed**, which steadies your hands in a fight (the line tightens more slowly) for six hours. Glassminnows are too small to keep, and the old mossback is far too grand to eat.

### Reading the water

- **Rings** spreading on calm water: a fish rising to feed just below (trout rise to hatching flies on the stream).
- **Nervous water**, many small dimples together: a school of small fish near the surface.
- **A flash**: a fish turning in the light just under the surface.
- **A splash**: something jumped.
- **Fizzing bubbles** on the lake: carp grazing the bottom.
- **The sea boiling white**, out in the deep: tuna driving a sprat shoal to the surface.
- **Seabirds wheeling and diving**: a shoal of mackerel or sprat just below, and often something hunting them. Head for the birds.

Each of these comes from a real fish at that spot. Press **C** to look underwater and you'll find it there.

### The fish finder

Press **F** for a small sonar screen. Drag its title bar to put it anywhere (it remembers the spot); double-click the title bar to put it back. The ⤢ button changes its size, and **?** explains the colours. In the boat it reads the water under the hull; on shore it works like a castable sonar, reading the water around your rig once it's in. The right edge, marked *now*, is the latest reading; older readings slide to the left. It shows the real bottom (a thick, bright line is hard rock; a soft one silt or sand), weeds as green strands, your bait or lure as a blue diamond, and fish as echoes: arches whose size and colour hint at how big they are, specks and clouds for small fish, and a little clutter. It never tells you what kind of fish it is.

### What's out there

Willow Bay and the coves (salt water):

- **Glassminnow**: schools over shallow sand and weed edges, by day. A small bait, kept shallow and still.
- **Sunperch**: weed beds and rocks in Willow Bay, by day. Takes a worm or chases a spinner.
- **Drizzlefin**: open water past the bay mouth; deep on dry days, near the surface in the rain.
- **Duskfin**: Driftwood Cove after sundown, drawn to warm light.
- **Mossback**: large and slow by the deepest rocks; only takes a bait resting on the bottom.

The Wend estuary (brackish water):

- **Sea Bass**: hunts the channel and the estuary mouth, best at dawn and dusk; soft sandeels, shads and metals, or a crab on the bottom. Not the same fish as the largemouth bass in Longmere.
- **Thick-lipped Mullet**: shoals cruising the shallows, very shy of line and noise. Bread flake under a float on fine line, and patience.
- **Flounder**: lies on the sand and mud of the flats and channels. Lugworm or ragworm on a bottom rig.

The outer coast and the open sea:

- **Ballan Wrasse**: in the kelp by the reefs of Gannet Isle and the Skerries. Crab or ragworm by the rocks.
- **Mackerel**: fast shoals in the tide, often under diving birds. A metal reeled fast, or a mackerel strip.
- **Plaice**: on the sand round Gannet Isle and Long Shoal. Lugworm or ragworm on the bottom.
- **Sprat**: the small silver shoals everything else hunts. Tiny baits.
- **Bluefin Tuna**: roams the Blue Water after the sprat shoals; look for the boil and the birds and cast a stickbait into it on the offshore rod.
- **Squid** (not a fish): around lights after dark, in the coves and by the reefs along the coast; jigs on the squid rod.

Fresh water (Reedmere, Fernbeck and Longmere):

- **Perch**: packs around weed, drop-offs and the drowned oaks. Chases spinners, crankbaits and streamers.
- **Pike**: lies still in the weed and lily pads; ambushes jerkbaits, shads and crankbaits, best at dawn and dusk or in the rain. Its teeth cut fine line.
- **Largemouth Bass**: Longmere's lily pads, reeds and drowned oaks. A weedless creature bait crawled slowly, a popper at dawn.
- **Mirror Carp**: grazes Reedmere's shallow shelf and margins. Boilies or sweetcorn on the bottom, loose bait, patience, and evenings.
- **Tench**: Reedmere's margins, weed and pads, at dawn. Worm, maggots or sweetcorn under a float.
- **Roach**: shoals in both lakes. Maggots or bread under a float.
- **Rudd**: near the surface by the lily pads; bread, sweetcorn, or a dry fly.
- **Brown Trout**: holds in the stream pools facing the current. Shy of heavy line and footsteps.
- **Grayling**: small groups in the stream pools; loves a drifting nymph.

Fish keep to their own waters: lake fish never turn up in the sea, nor sea fish in the lakes.

### Offline play

Slow Tide is a Progressive Web App. The first time you open it online, it quietly stores the whole game on your device (scripts, styles, fonts, icons; the sounds and shaders are made by the code) and the title screen says **Ready to play offline**. After that it starts and plays with no connection at all: fishing, the journal and catch log, saving, and every place you've found. To add it to your home screen: on iPhone or iPad, Share → *Add to Home Screen*; on Android Chrome, ⋮ → *Install app*; on a computer, the install icon in the address bar.

While you're offline, *Offline* appears next to the clock, and the journal explains that everything keeps working and saving on this device. If you've switched on cloud saves and signed in, syncing pauses; your progress waits in the browser and goes up when the connection is back, combined with anything newer from your other devices (catches are matched by id, so nothing is counted twice).

New versions arrive safely. When a new version is deployed, the game downloads it in the background and keeps running the old one. On the title screen it switches straight away; during play it offers *Update to the new version* in the journal, and keeps your progress either way. Saves live in the browser's local storage, which updates never touch.

### Saving your progress

No account is needed. The game saves by itself in your browser: after every catch, release or kept fish, when you change rods or tackle, cook, eat, sleep, travel back to camp or the boat, every ten seconds while you play, and when you close or hide the page. Refresh or come back next week and you carry on where you were: the time of day and the weather, where you and each boat are, your gear, backpack, saved setups and creel, the camp fire and grill, your journal, catch log, the places you've found and the parts of the map you've explored, and your settings.

The journal's **Your progress** section shows when the game last saved and has three buttons:

- **Download a copy**: saves your whole game as a small `.json` file.
- **Load a saved copy…**: loads one of those files (it asks first, and keeps your current game as a backup).
- **New game…**: starts over after asking you to confirm, with an offer to download a copy first. Your sound and graphics settings stay. The old save is kept aside in the browser rather than deleted.

Saves are careful. Each one carries a version number, so a future update can convert old saves instead of breaking them. Every value is checked when loading, so a damaged save can't crash the game. If the save can't be read at all, it is kept aside (never written over) and the game loads the copy from the start of your previous session instead, and says so. A save made by a newer version is never written over. If you open the game in two tabs, the older tab stops saving so the two can't overwrite each other. In a private window, where the browser may refuse to store anything, the game tells you that progress won't be kept.

### The journal and catch log

Press **J**. The **Fish & places** pages hold a sketch and notes for every kind you've met, grouped by water (Willow Bay and the coves, the Wend estuary, the outer coast and open sea, fresh water, and *Not fish* for the squid), the hand-drawn map, the places you've found with what you've caught in each water, keepsakes and your progress. The **Catch log** pages record every catch:

- the kind and its length, and its weight (worked out from the length),
- the day and time, the water (salt, brackish or fresh), the nearest named spot, and the weather,
- how you caught it: the rod, the line, the bait, lure, fly or jig, and whether from a boat or the shore,
- how deep it took and how deep the water was, and whether flies were hatching,
- what happened to it: released, kept, cooked or eaten.

It shows your heaviest catch, totals and personal bests for each kind, and your recent catches with filters for kind, water, method and what happened to them (25 at a time, with *Show more*).

### The map

Press **M** (or the map button). The map is drawn from the real ground and water depths, but only where you've been: land and water fill in around you as you travel (further out on the water than in the woods), and the rest stays blank paper. It marks the places you've found (camps as tents, landings as little piers, landmarks with a cross), where each boat is, where you are, and where your best fish of each kind came from. Drag to move it, scroll or pinch to zoom, ◎ to centre on you. Beside it: your camps (with **Go there**), your boat, and every place you've found.

### Settings

Press **O** (or the gear button, or *Settings* on the title screen). Everything is kept with your game and changes take effect straight away. Opening a menu never casts, reels or steers.

- **Sound**: master volume and mute, music, nature and ambience, rain, effects, and the bite-alert bell (with a button to hear it).
- **Graphics**: a preset (**Auto**, **High**, **Medium**, **Low**) and, under it, resolution, shadows, reflections and water detail, plants and particles, underwater effects, how many distant fish are drawn, and a frame-rate cap. Auto starts at High on computers and Medium on phones and tablets, then steps down by itself if the game runs slowly. Lower settings draw less but change nothing about the fishing: every fish is still simulated, can still bite and still shows on the fish finder.
- **Weather**: Clear, Partly cloudy, Overcast, Light rain, Heavy rain, or Automatic (it changes by itself through the day). The sky, light, fog, water, rain, sound and the fish all follow it, changing smoothly. Separate sliders for how much rain is drawn and how loud it is.
- **Controls & comfort**: camera sensitivity, invert look, reduced motion, assisted or manual casting, difficulty, and every key, with a button to change each one (press the new key; one already in use swaps over).

A note on what this is: Slow Tide is a stylised, low-poly game drawn with three.js and WebGL in the browser. The water uses real planar reflections, a ripple simulation and procedural detail. The lighting, haze and mist are painted rather than physically simulated, and nothing here is photorealistic. Far-off places are drawn only when you're near them, and fish far from you are simulated more coarsely, but never stop.

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
| `src/main.js` | Game loop, time of day, weather, the four boats, stepping ashore and boarding, travel, interactions, sleep, discoveries, surface clues, HUD, glue between systems |
| `src/settings.js` | The settings: what's in them, checking saved ones, and the Settings panel (tabs, sliders, key rebinding) |
| `src/map.js` | The map: which parts of the coast you've explored, and the map sheet with its markers, zoom and camp list |
| `src/input.js` | Every key as a remappable action, keyboard-layout-aware key names, and the mouse and touch input |
| `src/world/terrain.js` | The shape of the world. One height function shapes the bay, island, cove, the west shore (lake, stream, camp), the Wend estuary and its river, Longmere, Gannet Isle and the skerries, the shoal and the deep. Places, zones and their water (fresh, brackish, salt), piers and walkable decks live here |
| `src/world/regions.js` | What's built beyond the bay: Wend Quay, the Mere Boathouse, Puffin Cove, Gannet Light, the drowned oaks, rocks, buoys, reeds and lilies |
| `src/world/shore.js` | Everything built on the west shore: landing pier and signpost, tent, campfire with smoke and light, tackle chest and rod rack, reeds, lily pads, the fallen alder, fishing pegs, stream boulders, footbridge, stepping stones, ferns, grass and hatching flies |
| `src/world/habitat.js` | The underwater map shared by everything below the surface: depth, weed beds, rock piles, kelp and reefs, the stream's current, and the homes fish live around, for the home waters and each region |
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
| `src/boat.js` | The four boats (rowing boat, motor skiff, kayak, bass boat): hulls, the figure aboard, oars, paddle, outboards and trolling motor, rods, lantern and anchor; their physics, draft and collisions |
| `src/walker.js` | You on foot: the character, walking and jogging, wading, slopes and obstacles |
| `src/tackle.js` | Rods (lines, rigs, casting weight, range), baits, lures, flies and jigs, ready-made setups, and the checks that refuse impossible combinations |
| `src/tackleModels.js` | The little models on the end of the line: float, indicator, lead, baits, lures and flies |
| `src/fishing.js` | Aiming and casting (planning where a cast lands, wind, overloading, obstructions), the ways a rig behaves in the water, bites and bite alerts, hooking, the fight, landing, releasing and keeping |
| `src/fight.js` | The fight as plain numbers: tension against the line's strength, the reel's drag, fish stamina, surges, why a line breaks, and the difficulty levels |
| `src/offline.js` | Registers the service worker, reports when the game is ready offline, watches the connection, and applies updates safely |
| `sw.js` | The service worker: stores every game file for offline play, one cache per version |
| `tools/build-sw.mjs` | Writes the file list and version into `sw.js` (`--check` reports if it's out of date) |
| `vercel.json` | Runs `tools/build-sw.mjs` on every Vercel deploy |
| `src/fish.js` | The 23 species, squid included (where they live, how they behave, what they eat and how they take it, weight), 3D models, journal sketches |
| `src/pack.js` | The backpack: the equipment browser, the selected piece with its compatibility checks, and your setup as rigged |
| `src/gearArt.js` | Models of every rod (with its reel), line spool, float, rig, leader, bait, lure, fly and squid jig, built from the tackle data by id |
| `src/gearView.js` | The backpack's studio: one small renderer that makes cached thumbnails and the turnable preview |
| `src/camp.js` | The fire, grill, food and hunger, and the sleep panel |
| `src/sonar.js` | The fish finder (boat and castable), its echoes, and dragging and sizing the panel |
| `src/journal.js` | The journal pages, catch log (totals, bests, weights, filters) and hand-drawn map |
| `src/save.js` | Saving and loading in the browser: the versioned save format, checks, migrations, backups, and combining two saves |
| `src/cloud.js` | Optional cloud saves: email sign-in and syncing with Supabase |
| `src/cloud-config.js` | Where to put the Supabase address and anon key if you don't host on Vercel |
| `api/cloud-config.js` | Vercel function that hands the game `SUPABASE_URL` and `SUPABASE_ANON_KEY` (the public key only) |
| `supabase/schema.sql` | The cloud save table and its row level security rules |
| `src/audio.js` | All sound, synthesised live: water, wind, rain, the stream, the campfire, birds, frogs, crickets, footsteps, the bite alarm, and the generative music |
| `src/effects.js` | Ripples, splashes, flashes, the wake and water lapping on the hull |
| `src/touch.js` | On-screen controls for phones and tablets |
| `src/quality.js` | Graphics presets, the individual graphics options, and the frame-rate watcher behind Auto |
| `tools/fightsim.mjs`, `tools/ecosim.mjs` | Headless tuning tools for the fight and the ecosystem (see [Tests](#tests)) |
| `vendor/three/` | three.js r160 (MIT licence) |
| `assets/` | Fonts (SIL Open Font License), icons, and the link-preview image |

## Making it your own

- **Add a fish**: add an entry to `FISH` in `src/fish.js`. Its `life` block says where it lives (`homes`, `zones`, `depth`), how it moves, when it is active, how it likes a bait to move, and how cautious it is; `food` says which baits, lures and flies it takes and how keenly; `strike` says how it takes them; `mouth` and `pull` set what size of lure it can manage and how hard it fights. The ecosystem spawns it, and the journal, catch card, 3D model and fish finder pick it up automatically.
- **Add tackle**: add an entry to `TACKLE` in `src/tackle.js` (a bait, lure or fly), give it a model in `src/tackleModels.js`, and add it to the `food` of the fish that should like it. Rods live in `RODS`.
- **More or fewer fish**: `schools`/`members` and `groups`/`group` in each species' `life`, or `fishDensity` in `src/quality.js`.
- **Change the length of a day**: `HOUR_SECONDS` in `src/main.js` (40 real seconds per in-game hour by default).
- **Retune the light**: the `KEYS` table at the top of `src/world/sky.js` sets sky, sun and ambient colours for each part of the day.
- **Reshape the land**: `landSDF` in `src/world/terrain.js`; the lake (`LAKE`), stream (`STREAM`), camp (`CAMP`), path (`PATH`), Longmere (`MERE`), Gannet Isle (`GANNET`) and the rest are constants near the top.
- **Add a boat**: add a hull to `HULLS` in `src/boat.js` (shape, seat, how it moves) and its mooring in `mooring()` in `src/main.js`.
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
slowTide.useSkiffAt(330, -470, 0, 'bass') // …or another boat: 'row', 'kayak', 'bass'
slowTide.setWeather('heavy')  // clear, partly, overcast, light, heavy or auto
slowTide.setGraphics('low')   // auto, high, medium or low
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

The journal hints at a softer cushion, a potted fern on the bow, and a little cabin by the lake. Other natural next steps: carrying the brass lantern when you walk at night, tides that cover and uncover the estuary flats, cooking and resting at the far camps as at home, fuel and simple upgrades for the motorboats, and seasons that change which fish are about.
