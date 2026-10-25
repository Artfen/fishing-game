# Slow Tide

**Play it: <https://fishing-game-weld.vercel.app>**

A small, peaceful fishing adventure that runs in the browser. You start in a little wooden boat on Willow Bay, step ashore at a landing, walk up to your camp, and fish a freshwater lake and a clear trout stream. Beyond the bay lies a whole coast: the Wend estuary with its sandbanks and saltings, Longmere (a big inland lake with a boathouse), Gannet Isle with its lighthouse and kelp reefs, a long offshore shoal, and the deep Blue Water where tuna chase the sprat shoals. Four boats get you about: the rowing boat, a motor skiff, a quiet kayak and a bass boat. On the bay's north shore is **Willowhaven**, a little harbour with a quay, a chandlery and a notice board; round the shore from it lie a rocky headland, a secluded beach and, under a buoy offshore, an old wreck. Up the lane above Shell Strand is **home**: a cottage and a garage with a workbench for planning an outing, your rods and camping gear, and a car on the drive to take you to the coast. You choose your rods and tackle, cook what you catch, pitch your own camp wherever the ground allows, sleep in a tent (or your own bed) until the hour you like, and keep a handwritten journal, a photo album and a map of it all.

The water is a living place: weed beds, rocks, lily pads, drowned trees, reefs, sandy flats, channels, deep water and running pools, home to some two thousand fish, cephalopods and eels of 54 kinds: 44 real species of the Atlantic coast from Royan to Cádiz to catch, nine freshwater fish, and the European eel, protected, to watch. Four days' sail to the south lies **Las Brasas**, a volcanic island in the trade wind with clear blue water and ten kinds of its own. They school, cruise, feed, rest by cover, hunt, hold station in the current and scatter when startled. Fresh water, brackish water and the sea each have their own. Wind, swell and currents shape the water you fish, gently in the bays and more out on the open coast. Rings, flashes, jumps, fizzing bubbles, boiling water and diving seabirds on the surface come from real fish below. You can look underwater, follow your bait or lure, and use a fish finder. The fish that takes your bait is one you could have watched swimming there.

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

Node 22 or newer, nothing to install (on Node 20, leave out the quotes around the pattern). The tests check saves (version upgrades including the move to four boats, the backup and unreadable copies, a newer save never written over, full storage, junk cleaned up, combining two saves, the explored map and catch positions), the fight (careful play lands big carp at every difficulty and with every rod's own stiffness, the creak is a real warning on Standard, winding through surges breaks the line, locked drags, pike teeth, weed), fish behaviour and the line (every fish has its own build, the same every time; each kind answers the current, the weather, the light and a disturbance its own way, and says why it turned away; Relaxed forgives a dragging fly or a thick line that Demanding doesn't; a hooked fish turns, tires and is beaten; side pressure tires it sooner and a soft rod cushions a surge; a leaping fish never throws the hook on Relaxed but can on a slack line on Demanding; a light hold tears free only under a drag set too tight; slack line sags and lies on the water and drifts with the current, tight line runs straight; the rod bends towards the line; the setting and the reel's volume are kept), tackle (every ready-made setup is castable and complete, impossible rigs are refused with a reason, every kind of fish can be caught with some setup), the world (every species lives somewhere, fresh water fish stay in fresh water and sea fish in the sea), the backpack's pictures (every rod, reel, line, rig, leader, bait, lure, fly and jig has its own model, drawn from its data), the map's memory of where you've been, the field guide and species register (every species has a recommended setup the tackle rules accept; all 44 catchable sea species bite on theirs in the headless ecosystem and can be landed with it; the reference models carry the anatomy that tells them apart; every species in the game is accounted for; the protected eel ignores every bait; every register entry is sourced and says what each regional status rests on; and `src/registerData.js` is what the research compiles to), the "why nothing's biting" advice (only reasons the simulation plays by: the wrong bait, water or depth, a lure worked too slowly for a fish that wants it fast), planning a trip (it leads to water that suits the fish, never to a fish, and counts what the trip brought), storms (a gale and big seas that build and die away, peaked seas at the same sea level, the bay a refuge and the shallows calm, boats thrown about but never over, lightning with its thunder later the further off, no flashes with reduced motion, a storm kept in the save), sailing (no drive in irons, luffing and stalling, fastest across the wind and never far past hull speed, pushed to leeward, a boat that heels, tacks with her boom coming across, rows with the sail down, and keeps her sail in the save; wind lines only when there's wind and you want them), wind, waves and currents (sheltered water is calmer, the sea changes smoothly, nothing jumps at an invisible line, currents run where they should and turn with a tide, the water you see is the water boats float on, a drifting boat goes the same way at 15, 30 and 120 frames a second, no wave tips a boat, an anchored boat stays put), the graphics levels (Ultra and Cinematic draw more than High, Auto never picks them, the choice survives a save and reload, the finishing pass bows out where WebGL 2 is missing), the quiet places' own fish (in the water, in homes their own rules allow, taking nobody from anywhere else, caught on the field guide's tackle), diving (how long a breath and a tank last, the turn mark, what may be speared, a shot meeting the first fish on its line and the head versus the tail, a diver who can't leave the water or swim up the beach, fish that bolt from a diver rushing them and gather round one waiting still, the Kittiwake's bell, and a dive's catches and records in the save), the fell and the Coldwater (the path can be walked all the way, never too steep and never wet, and takes a quarter of an hour; it's trodden into the hillside; the places up the river are found in order walking up it; the river keeps to its bed at every height; the tarn and pools stand at their own levels; the tidal stretch is deep enough to paddle up; the land has no walls where one shape meets another and fades out before its edge; the footbridge and the bothy; every fish already in the world is exactly where it was, and the river's own fish live in water that suits them; a map from before the sheet grew keeps everything you'd seen), Las Brasas (a volcanic island far to the south with a peak and a crater, a harbour basin deep enough for any boat and its quay at the waterfront's level, a beach, an islet and a drop-off; its waters all salt, calm in the harbour and the lee and rough to windward, the current south-west and the trade wind from the north-east; its fish on homes of their own, in its waters, none of its own kinds at home and nothing at home moved; a boat lies at its quay and isn't pulled back towards home; a game left there is kept with its own chart; its places are found only there), and that `sw.js` lists every file for offline play. `tests/setup.mjs` loads three.js from `vendor/` so the game's own modules run as they are.

Two tuning tools play the real game code headless: `node --import ./tests/setup.mjs tools/fightsim.mjs` plays thousands of fights per species, rod, difficulty and player style; `node --import ./tests/setup.mjs tools/ecosim.mjs` fishes the living ecosystem with a chosen rig in a chosen spot and reports which species come and how soon they bite (`tools/ecosim.mjs guide:seabass,octopus` fishes species with the field guide's own recommendation).

## Put it online

**Vercel** (what the live game uses): the project is imported from GitHub with the framework preset *Other*. `vercel.json` tells Vercel to run `node tools/build-sw.mjs` on every deploy (it writes the list of game files, and a version made from their contents, into `sw.js` for offline play) and to serve the repository root. Every push to `main` redeploys the site, and every other branch gets its own preview address, so you can try a branch before merging it. No environment variables are needed, unless you want [cloud saves](#cloud-saves-optional). The `api/` folder holds the one optional function for those; Vercel picks it up by itself.

Any other static host works too. Run `node tools/build-sw.mjs` first (so offline play picks up your changes), then upload these files and folders, keeping the layout as it is:

```
index.html  style.css  manifest.webmanifest  sw.js  src/  vendor/  assets/
```

`serve.py`, `README.md`, `tools/`, `research/`, `supabase/` and `.claude/` are for working locally and don't need to go up. `api/` only works on Vercel; elsewhere the game simply stays guest-only. Some other easy hosts:

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
| W A S D or arrows | Row or paddle (W forward, S back, A/D turn), drive a motorboat (W/S move the throttle lever a notch at a time, and it stays where you leave it; A/D steer), or walk on shore (relative to the camera) |
| Shift (hold) | Jog on shore. Trout feel heavy footsteps, so walk near the stream |
| Drag / scroll | Look around / zoom (in every view). The view turns right round you or your boat; drag upwards and it sinks below the waterline to look beneath the surface, down again and it comes back up |
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
| E | Step ashore · get in a boat · step across between boats · open camp or a tackle box · get in the car or open its boot · use the bed, desk, wall or workbench at home · look closer (when a prompt appears) |
| B or I | Backpack: rods, line, rigs, tackle, setups and creel (with a tackle box or a boat locker in reach, the box too) |
| Q | Next bait, lure, fly or jig in your backpack for the rod in hand |
| 1 / 2 | Switch between the two rods you carry |
| G | Throw a pouch of loose bait around a carp rig |
| Z | The mooring prompt (shown above the main one): drop or raise the anchor out on the water, tie up alongside a jetty or quay, cast off, or let go a tow |
| X | Throttle to neutral (stop): the motor idles and the boat coasts on |
| + / − | Throttle up or down a notch (works with a line out too, when W/S work the lure) |
| U | Kayak: lower or raise its electric motor |
| V | First person on or off |
| C | Next view: boat (or on foot) → first person → a fixed underwater view → watching your bait |
| R | Reset the camera: back behind you, first person off |
| F | Fish finder on or off |
| M | Map |
| J or Tab | Journal |
| O | Settings |
| Y | Why aren't they biting? A word from the field guide on what the fish make of your rig (again for the next reason) |
| N | Show or hide the conditions panel: wind, current and sea where you are |
| T (hold) | Let time drift by quickly |
| H | Hide the interface |
| P | Photo mode (take a photograph); on a catch card, a picture of your fish |
| Esc | Reel in the line, leave the underwater view, close a panel |

In the car, the same keys drive: **W**/**S** go and reverse (pushing against the way you're rolling brakes first), **A**/**D** steer, **Space** (held) brakes, **C** changes between the view behind the car and the driver's seat (**V** too), and **R** resets the camera. Stop, then **E** to get out or go somewhere (**Q**: where to?). Opening a menu while you drive puts the brake on, and the movement keys do nothing until it's closed. If the car is ever stuck, **E** puts it back on the lane.

While you're choosing where to pitch a camp, only its own keys work: walk and look to move the outline, **Q**/**E** turn it, the mouse wheel brings it nearer or further, **Space** pitches and **Esc** cancels (nothing casts, steers a boat or opens other panels until you do).

On a phone or tablet the controls appear on screen. Drag on the **left** half to row, paddle, drive or walk (a stick appears under your thumb; in a motorboat, push it up or down and let go to move the throttle a notch, across to steer), drag on the **right** half to look around (drag up to sink the view under the water), and pinch to zoom. At the helm the throttle lever sits above the round button: tap a notch or drag the handle, and **Stop** knocks it into neutral. While a fish is on, stick up/down sets the drag. The round button on the right does all the fishing: hold to aim and let go to cast, tap to strike, hold to reel. Its label tells you what it will do next. Prompts such as *Step ashore* or *Camp* are buttons: tap them. The buttons along the top open the fish finder, backpack, views, journal, map and settings, and the hourglass lets time drift while you hold it.

With a controller (an Xbox controller, or any the browser recognises; plug it in or pair it, then press any button). It never replaces the other controls: whichever you used last is what the hints, prompts and the title screen describe.

| | |
|---|---|
| Left stick | walk, row, paddle, steer (at a motorboat's helm, push it up or down and let go to move the throttle a notch; across steers) · **L3** jogs until you stop |
| Right stick | look around (push up to sink the view under the water) |
| At the helm | **B** stops (throttle to neutral), **L3** lowers or raises the kayak's motor; with a line out the **D-pad ↑/↓** moves the throttle a notch |
| **RT** | hold to aim, let go to cast; strike; hold to reel |
| **A** / **B** | whatever the prompt says / cancel a cast, reel in, back out of a menu |
| **Y** · **View** · **D-pad ↑** · **Menu** | backpack · map · journal · settings |
| **LB** / **RB** | the other rod / the next bait or lure (with a line out: *why aren't they biting?* / loose bait) |
| **X** · **LT** | the mooring prompt (anchor, tie up, cast off, let go a tow) · let time drift (hold) |
| **D-pad ← / → / ↓**, **R3** | next view / photo mode / fish finder, reset the camera |
| A fish on | **RT** reels, **LT** eases the drag, left stick up/down sets it |
| Catch card | **A** let it go, **X** keep it, **Y** photograph it |
| Driving | **RT** go, **LT** brake (hold to reverse), left stick steers, **A** get out, **X** where to? |
| Menus | **D-pad** or left stick moves, **A** chooses, **B** goes back, **LB**/**RB** change tabs, right stick scrolls |

Settings → Controls & comfort lists them all, and turns the controller's vibration on bites and runs on or off. If the browser doesn't recognise a controller's layout, the game says so: its buttons may not match the hints.

Nothing can go wrong. A missed bite just means another will come; a snapped line only loses that fish (and the game tells you why it broke); and you can never starve.

### Your first trip

A new game begins at home, in front of the cottage with the car on the drive, and offers a short guide to a first outing (you can say no, end it whenever you like, and start it again from the journal, under **Memories**). A small card in the corner shows one step at a time, in the words of whatever controls you're using, and a marker points the way:

1. **Plan at the workbench** in the garage: what you're going for, where, and the rod and tackle to pack.
2. **Drive to the water**: get in at the driver's door and follow the lane, or let the drive go by.
3. **Find a spot**: each place has one marked (the end of Willowhaven's quay, the surf at Shell Strand, the ledges at Cove Head…), with a word on where the fish are.
4. **Cast**, 5. **land a fish**, 6. **keep it or let it go** (it's in your journal either way),
7. and **home again**, or pitch a camp.

Each step is done when it actually happens, never on a timer, and doing a later one first is fine: skip the workbench and just drive off, and the guide catches up.

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
- **The Calf**: a small island just off **Heron Point**, about 600 m west of Willowhaven by boat (plan it at the workbench: the car takes you to the harbour, and you have a boat brought round to the quay). Tie up at the stone landing in its lee, climb the steps to a ruined **watch tower** that looks out over the whole coast, and camp on the top if the weather's kind (or sleep aboard the cabin boat in the lee). Grey seals haul out on the skerry. Between the Calf and the Point runs **Calf Sound**, the strongest tide race on the coast: white ridges, a current that carries a drifting boat east, and mackerel, garfish and bluefish hunting sandeels in it. Pollack and wrasse live over the kelp under the cliffs, and bass hunt the white water off **the Nose**, the low rocks at its south-east corner. A metal or a soft sandeel on the coastal rod, cast across the race.
- **Up the Coldwater to Hoarfell**: inland to the north-west the land rises to **Hoarfell**, 570 m, with snow on its top. Its river, the **Coldwater**, starts at **Hoar Tarn**, a cold, deep lake in a crag-backed corrie under the summit, runs down past the bothy and over **Spout Force** (thirty metres into a deep plunge pool), down the long wooded **Coldwater Dale**, over **the Lower Force** into the tide, and out into the bay under a timber footbridge at **Coldwater Foot**, just west of Willowhaven. A fingerpost by the footbridge points up the river: the path follows it all the way to the cairn on the top, 2.8 km on foot (about a quarter of an hour at a walk, and an hour or two of the game's day), round the side of the corrie and up the fell's north flank in long zigzags. **The bothy** above Spout Pool is a stone hut kept open for walkers: cook, sleep (you wake to the sound of the falls) and swap tackle at the door, and once you've walked there you can head straight back to it from the map. At the top, press **E** at the cairn to add a stone and look out over the whole coast; up there the haze lies below you. Trout and grayling live in the river's pools all the way up, small wild trout in the tarn, and sea bass, eels, flounder and mullet come up the tidal stretch as far as the Force Pool (deep enough for the kayak or a boat to follow them under the footbridge). The fell is built in detail only as you come near it, so the bigger land costs little until you're there.
- **Long Shoal**, marked by a yellow buoy, and **Little Skellig**, a rock covered in birds, on the way out to **The Blue Water**: open sea past the shelf, where tuna hunt the sprat shoals.

### Las Brasas: the long passage south

Four days' sail down the Atlantic lies **Las Brasas**, a volcanic island in the trade wind, like the Canaries (an invented island, not a real one). The **sailing boat** makes the passage: out on open water in her (past the bay), or standing beside her at Willowhaven quay, press **E** and choose *the long passage south*. A few lines of her log go by while the days pass (you eat and sleep aboard), and you come in off **Puerto Brasa** with the sail down. Your gear and your creel come with you; the other boats and the car stay at home. Coming back is the same: out of the harbour in her, or beside her, *the passage home*, and you come in alongside Willowhaven quay.

- **Puerto Brasa**: a little harbour behind a breakwater of big pale blocks with a green light flashing on its end, a dark basalt quay to tie up at (**Z** alongside), white flat-roofed houses with coloured doors and shutters climbing the slope behind, a church with a bell gable, palms, little wooden boats pulled up and moored. **Bar El Muelle** on the waterfront has a room upstairs: cook what you've kept (the kitchen does the island's fish its own way), sleep, and swap tackle from the shelf. Once you've found it you can head straight back there from the map.
- **The island**: black lava and red cinder, **Pico Brasa** (330 m, a crater at the top) in the middle and **Montaña Roja**, a younger red cone, to the east; sea cliffs on the windward north coast; grey-green tabaiba scrub, candelabras of cardón, and Canary pines high on the volcano. **Playa Negra**, a beach of black sand, lies east of the harbour; **Punta del Faro**, the long east point, has a lighthouse; **Roque del Arco**, off the south-west, has a sea arch the swell runs through.
- **Under the water**: clear, blue and warm, seeing twice as far as at home. Black lava boulders grazed bare by long-spined urchins, brown weed in the shallows, the seagrass meadow of **El Sebadal** off the south-east, the rough reef of **Las Coladas** (old lava tongues on the north-west), more arches under the water off the Roque, and **El Veril**, the drop-off, where the narrow shelf round the island falls away from twenty-odd metres into the deep blue.
- **The weather**: the trade wind blows from the north-east almost all the time, steady and seldom calm; the swell works on the windward north and west while the lee (the south, where the harbour is) stays calm; the Canary current runs south-west, a little faster off the points. Mostly fine: cloud now and then, a passing shower, very seldom a storm. After dark, shearwaters wail over the cliffs as they come in to their burrows.
- **The fish**: the home coast's fish that live there too (white and two-banded seabream, salema, bogue, red porgy and dentex, striped seabream and palometa off the beach, octopus in the lava, cuttlefish on the seagrass, grey mullet in the harbour, shoals of horse mackerel, sardine and bogue, bluefish, little tunny and bullet tuna off the drop-off; the field guide says where to look for each there), and ten of the island's own: parrotfish, ornate wrasse, triggerfish and morays on the lava reef, dusky groupers (to release), barracuda and amberjack along the drop-off, chub mackerel shoals, and the angelshark and the trumpetfish to watch (see [What's out there](#whats-out-there)).

The island has its own chart: open the map (**M**) there and it shows Las Brasas, filling in as you explore, as the home chart does at home. (Your camps, home, the car and the far camps are four days away: only the passage takes you there.)

### Life on the coast

A path runs from the landing to **Willowhaven** and on round the shore. Each place has its own landmark, sound and fish, and something to find.

- **Willowhaven**: a stone quay with a light at its head, a slipway, cottages, the chandlery and a net store round a cobbled apron. Walk to the head of the quay and press **E** to have one of your boats brought round and made fast alongside (it takes a little while), then step down into it from the quay steps. The **chandlery** door opens the whole tackle store, like a tackle box. The **notice board** reads the water as it is right now: the wind and sea inside and outside the bay, the current in the cove channel, where gulls are diving, which sea fish are busy at this hour round the harbour (from the fish actually living there) with a setup that suits each, and the notices that start adventures. The **bench** by the lamp lets you sit and let the time go by. Rigging clinks against the masts, busier in a breeze.
- **Cove Channel**: the sheltered way into Driftwood Cove, with eelgrass and a heron in the reeds. An old punt lies at the head of the cove.
- **Cove Head**: a rocky headland on the open coast with a white daymark tower. The swell breaks on its ledges, where bass and white bream feed.
- **Shell Strand**: a secluded beach south of the cove with a driftwood shelter and a dry sandy shelf above the waves, the best camping on the coast. Bass come into its surf at dusk; plaice and sole after dark.
- **The Kittiwake**: a wooden steam drifter lying on her side about nine metres down off Shell Strand, under a black-and-red isolated-danger buoy. Conger live in her hull and pollack and wrasse hang over her ribs. From a boat, the underwater view (**C**) lets you see her for yourself. (Her shape is kept so diving could visit her one day; there's no diving yet.)

### Your own camp

Your backpack carries a camping kit: a tent and bedroll, a lantern on a pole, a camp chair, a little stove, a tackle box and a cool box. Open the backpack (**B**), choose **Pitch a camp…**, and an outline of the camp follows the ground in front of you. It turns green on a good spot and red on a bad one, with the reason (in the water or where the waves reach, too steep to sleep on, a tree, rock or building in the way, across a path, in front of a doorway, on a jetty, too close to a camp, beyond the edge of the world), and warns you about low, exposed ground. The whole footprint is checked, not just the middle, and gentle slopes are fine: if the spot is nearly right the camp settles a step away where it fits. Confirm, give it a name (or keep the one offered), and it's pitched. Cancelling leaves the kit as it was.

At your camp, press **E** by the door:

- **Stove & food**: cook a fish from your creel or the cool box (half an hour), eat what's cooked, or have an oatcake.
- **Sleep**: until dawn, morning, midday, afternoon, golden hour or night. You wake at the tent door; your boats stay exactly where you left them and your rigs and catches are untouched. A fish on the line has to be landed or let go first, and a line left out is reeled in before you turn in.
- **Your camp**: rename it, choose the tent colour, set the lantern (after dark, always, or off), put out bunting, a rag rug and wind chimes (and the striped deckchair, once you've earned it), mark it on the map, open the journal or plan a trip from here, **Move this camp…** or **Pack it up…**.
- **Tackle box**: swap rods and tackle, as at any tackle box.

The cool box keeps six fish on ice and the stove holds four cooked ones. Moving a camp keeps its name, contents and history (it takes a little time). Packing up puts the tent back on your pack; if the cool box holds more than your creel can take, you choose which fish come with you and which go back into the water, and nothing goes without you saying so. You have one camping kit, so one camp of your own at a time, alongside the fixed camps. The backpack's **Head back to** list and the map's camp list both take you straight to it, and when you come back it's just as you left it.

Saved camps are checked when you load: if one somehow ends up somewhere it couldn't be pitched (after an update changed the ground, say), it's moved to the nearest good spot and the game tells you where and why.

The camping gear is three pieces, each in one place at a time: the **tent & bedroll** (with the lantern, chair and the camp's bits), the **stove & pans** and the **cool box**. You need the tent to pitch (if it's in the car close by, you fetch it); the stove and cool box come out of your backpack when you pitch, and a camp without them can't cook or keep fish on ice (its sheet says where they are, and sets them up when you bring them). Packing up, everything goes into your backpack.

### Home, the garage and the car

Home is a cottage and its garage on the east arm, up the lane above Shell Strand. Players who were already playing are offered it once (**Go home now** or **Later**) and otherwise carry on wherever they were; new games begin there. The map and the backpack's **Head back to** list take you there whenever you like.

- **The cottage**: your bed (sleep until the hour you choose), the desk with your journal and records, a kitchen (cook a fish from your creel and sit down to it), and a wall for three photographs, a keepsake and the record of a catch. The house fills it from what you've actually done (your latest photographs, your best catch, your newest keepsake), or you choose. Nothing is ever made up: empty frames stay empty.
- **The garage**: the tackle wall (a tackle box for your whole collection), the rod rack and the camping shelf (they show what's really there: a rod you carry or have loaded in the car leaves a gap), boots and bags, and the **workbench**.
- **The car**: a sage-green estate on the drive. Walk up to its door to drive, to its back to open the boot.

While you're indoors the roof lifts away (and the wall between you and the camera), so you can see what you're doing; in first person it stays put.

**The workbench** plans an outing, step by step but in any order: **what for** (fishing, for a fish you've met or a way of fishing; camping overnight; exploring and photographs), **where** (Willowhaven, Shell Strand and Cove Head by the lanes, Wend Quay and the Mere Boathouse by road), **about it** (a map, the ground and the way in, the water and the fish that actually live there and how busy they are at this hour, your boats, the camping, the weather right now, which is never presented as a forecast), **gear** (setups that suit, from the field guide's own recommendations, packed into your backpack or loaded as spare tackle in the car; the camping gear between the garage, the car and your backpack), the **packing list** with a short check, and **off you go**. Places you haven't been yet keep their fish to themselves. Nothing has to be planned: "same again" takes last time's place and packing, loadouts of your own (six) are saved by name, and you can always just get in the car.

**Where things are**: everything you own is yours already (nothing is bought). What you carry is your backpack (two rods and eight baits or lures, as ever). The car's boot holds four more rods and twelve more tackle, and the camping gear. Everything else is on the tackle wall at home, and at the tackle boxes round the coast as before. Moving something never copies it: a rod in the car isn't on the wall, and packing a setup takes its pieces out of the car. At the boot you can swap tackle with your backpack, move the camping gear, and at home unload it all into the garage. Saved loadouts only name things: using one moves what it can and says what it can't (a tent still pitched at a camp, a car that isn't here).

**The check before you leave** looks at the plan and what you're taking: a rod with nothing it can fish, tackle for the wrong water, nothing that suits the fish you're after, the tent still in the garage when you're camping, a tent already pitched where you're going (no need to take it), the stove or cool box left behind. It never stops you going, and **Pack the essentials** fixes what it can from what you own.

**Driving** is real but small: the lanes run from home down to the coast path and along it to Willowhaven, Shell Strand and Cove Head, each ending in a car park with room to turn. The car won't go into the sea, up anything too steep or through trees, rocks and walls (it stops, and you can always back out), and **Back on the lane** rescues it if it's stuck. Driving yourself, the clock runs as it always does. You can also **let the drive go by** from the workbench or the driver's seat: a short fade, the car parked at the car park, you beside it, and the time the drive takes gone by (a few minutes along the lanes, about forty to Wend Quay and the Mere Boathouse, which are only reached that way). Heading home from the map with the car close by takes it home with you; without it, you make your way home and the car waits where it is (the map can take you back to it). Your boats and your camp always stay exactly where they are: a camp left pitched is there, with everything in it, when you come back.

### Adventures

Small stories round the cove, each with a clue, somewhere to go, and a modest reward. Clues come from the Willowhaven notice board, or from a page you find lying about. Nothing is timed and nothing needs doing twice: if you've already done part of one before you find its clue, it's recognised and counted.

- **The Kittiwake**: an old photograph on the board. Find where she lies, and see her under the water.
- **Ada's notebook**: three damp pages from a local angler's notebook, in the punt, at the daymark's foot and in the strand's shelter, in any order. Each one tells you something true about that water.
- **Where the gulls dive**: get close to gulls working the water and catch one of what they're after. Afterwards, the gulls you've seen diving are marked on your map for a while.
- **A gap on the chandlery wall**: photograph a live cuttlefish and pin it up on the board. Your photograph hangs there from then on, and the chandlery gives you the striped deckchair.
- **The watcher on the Calf**: a card in faded ink about Tam Leask, who counted the seals on the Calf's skerry every morning for forty years. Land on the Calf, watch the seals, and find Tam's slate in the watch tower. It goes on the shelf at home.

Rewards are keepsakes (in the journal's Memories pages), map marks and that deckchair: nothing that changes how fish bite.

### Photographs and memories

Press **P** (or **Take a photograph** in the backpack or the album on a phone) for photo mode: the interface steps aside, drag to look and scroll or pinch to zoom, and press again to take the picture. You see it straight away, can give it a title, and keep or discard it. On a catch card, **Photograph** takes a picture of the fish in your hands. The game notes what's in each picture (the fish in view, the places, gulls diving).

The journal's **Memories** pages hold your album (48 photographs; download any one as a JPEG, or the whole album as a single web page), the adventures you've come across and their keepsakes, your map marks, your camp, and the places you've found, each with what you've caught there, your best fish and the tackle that worked. Photographs are stored in your browser's own database, not in the save file, so the save stays small: a downloaded save or a cloud save keeps the list of your photographs but not the pictures, so download the album if you want to keep them elsewhere.

On the map, **Mark a spot** (or **Mark where you are**) adds a mark with a title, a note, and a star for favourites; the Memories pages list what you've caught near each one.

Camps you've found are listed beside the map: **Go there** takes you to any of them in a short fade (a little time passes, more for further camps), and **Go there** by your boat takes you back aboard. Your boats stay where you left them.

### Six ways to fish

The rod decides how you fish; what you tie on decides which fish come. (Strike times below are for Standard difficulty.)

- **Float fishing** (float rod, with a bait). A bait hangs under a float at the depth you choose (W/S). The float dips when a fish nibbles (no sound: just watch it) and goes under when it bites: a soft bell and **Bite — strike!** tell you, and you have about two and a half seconds. The alert means *strike now*, not that the fish is hooked.
- **Lure fishing** (light spinning rod, spinning rod, coastal rod or offshore rod, with a lure). Hold Space to reel at your chosen speed (W/S: slow, steady or fast), tap to twitch, let go to pause. Each lure moves its own way: crankbaits float up when you stop and dive as you reel, spinners flash and sink, a jerkbait hangs still between twitches, a soft shad swims, a weedless creature bait crawls and hops along the bottom, a popper and a stickbait splash and walk across the top, a metal sinks fast and flutters. Predators **follow** a lure, and a twitch or a pause often makes them strike; pike lie still in the weed and **ambush** it. If you're reeling when it hits, it often hooks itself.
- **Carp fishing** (carp rod, with a bait). The rig sinks and sits on the bottom while the rod rests on a bite alarm. A single soft **bleep** means something is moving the line; a run means a carp has picked up the bait, and with the **hair rig** or **method feeder** it hooks itself: a three-note bell and **Fish on!** tell you it's already hooked. Press **G** to throw loose bait around the rig.
- **Sea bottom fishing** (boat & bottom rod, with lugworm, ragworm, crab or mackerel strip). A flapper rig or running ledger on the seabed. Watch the rod tip: little rattles are fish mouthing the bait; when it **pulls round**, strike. Flatfish (flounder in the estuary, plaice on the sand round Gannet Isle), wrasse by the rocks and sea bass take baits on the bottom.
- **Fly fishing** (fly rod, with a fly). Hold Space to false-cast: each stroke shoots more line out; let go on a forward stroke to deliver. A dry fly floats and drifts with the current, a nymph drifts under an indicator, a streamer is stripped back in pulls. Trout won't take a **dragging** fly: cast upstream of them and let it drift down.
- **Squid jigging** (squid rod, with an egi jig: 1.8 sinks slowly for the shallows, 2.5 for most places, 3.0 sinks fast for deep water or current). Let the jig sink to near the bottom, **tap** to dart it up, then **pause**: squid follow a darting jig and grab it as it glides back down. A touch on the line is a squid feeling the jig; let it sink on and strike when it takes. Squid gather where light falls on the water after dark (the lamps at the jetty and at Puffin Cove, or your boat's lantern) and hunt by day too, more warily. A hooked squid jets backwards in pulses and may squirt ink when you land it. In the journal and on the catch card they're measured by mantle length, and listed under *Not fish*.

### Diving: freediving with a speargun, and scuba

Stop over water a couple of metres deep or more (in a boat, or standing on a jetty, the rocks or a steep beach) and **Go diving** comes up on the prompt. Choose:

- **Freediving, with the speargun**: one breath. The gauge shows it running down: about 75 seconds lying still, much less swimming, less again kicking hard. The mark on the gauge is when to turn for the surface from where you are; at the surface you breathe up (about half a minute from empty) before the next dive. Run your breath right out and you black out and come to at the surface, with a word on why freedivers never dive alone.
- **Scuba, with the camera**: a tank of air, filled at the chandlery in Willowhaven. The deeper you go, the faster it goes (head up at 50 bar). The dive computer warns you if you come up too fast, and after a dive below 10 m it asks for a safety stop between 3 and 6 m. Take photographs of the fish (they go in your album, and the field guide marks them as seen). No speargun on scuba: spearfishing with breathing apparatus is banned in France and Spain.

You swim where you look: **W/S** forward and back, **A/D** turn, drag to look all round, **E** up and **Q** down, hold **Shift** to kick hard (faster, but it costs breath and scares fish). **Space** fires the speargun or takes a photograph; **C** switches between the view through your mask and the view just behind you. On a controller: the left stick swims, the right stick looks, **A**/**RB** up, **LB** down, **RT** shoots. On a phone: the stick swims, drag to look, ▲ ▼ up and down, and the round button shoots. At the surface by a boat, a jetty or a beach, the prompt climbs you out.

**Spearfishing.** Fish swim off if you rush at them (a wary kind sooner, and kicking hard sooner still); drift past slowly and they let you close. Settle near the bottom and keep still, and the curious ones (the sea breams, wrasse, bass, pollack) come over and circle you to look: the old way, waiting rather than chasing. The sights show what's in front of you (its name once you've caught or seen one, and roughly how long it is) and turn green when a shot would hit. The shaft is sure at about three metres. Aim just behind the head: a clean shot holds the fish; a tail shot can tear free. The gun won't fire at a fish you shouldn't take: never in fresh water (banned), never a protected fish (the eel), never bluefin tuna, and small fish (the smallest fifth of the sizes each kind grows to here) are let grow. Speared fish go in your creel to cook at camp, and in the journal as *Spearfishing*, so take only what you'll eat.

**The Kittiwake's bell.** A card on the notice board: her bell lies in the sand by her bow, nine metres down. Dive to her (on one breath, or a tank), photograph the bell and leave it where it lies.

### Bite alerts

Alerts are gentle and never repeat: a nibble on a float is silent, a strike-worthy bite rings a soft bell once (**Bite — strike!**), a carp or a lure fish that has hooked itself rings a three-note bell (**Fish on!**). The bite-alert bell has its own volume in Settings, and the master mute silences it like everything else. The camera never jumps on a bite or a hooked fish.

### Reading the fish

Every fish in the water is an individual: its length, and its own build (lean, in good condition, or fat and deep-bodied for its length, so two fish of the same length can weigh quite differently), how much fight it has in it, and whether it's bold or shy. The catch card gives its own weight and condition.

Each kind answers the water in its own way: trout, grayling and sea bass hold in a current that carp, tench and mullet keep out of; bass hunt in the surf when it's rough; most fish go deeper and shyer under a bright midday sun and feed better at dawn, dusk or under cloud; a storm puts most of them down; and splashes, a motor, or casting at the same spot over and over leave the water wary for a minute or two.

You can watch a fish make up its mind: it notices the rig (*Something is curious…*), follows a lure or rises under a fly, looks it over, and then takes it or turns away. When it turns away the game says why, in a way you can do something about: *the lure's too big for this one*, *it saw the line*, *too fast for it: slow the retrieve*, *the bait's too far above it: fish it deeper*, *the fly was dragging*, *this water's been disturbed lately*. The field guide's *Why aren't they biting?* uses the same reasons.

How a fish takes depends on what you offer and how you work it: a float bait goes under, a carp runs with a boilie, a trout sips a dry fly, a predator slams a lure that's moving well; a lure crawled slowly, twitched or paused often gets just a **tap** (a fish nipping at its tail): strike at once, it's gone in a moment.

### Playing a fish

A hooked fish rests and runs in turns. When it rests, hold Space to wind it in. Just before each run it flicks on the surface: **ease off** for the first moment of the run (the *surge*), then hold again to keep the rod up and the pressure on, which tires it. The outer ring by the rod shows how close it is; the inner ring is the line's tension, and the small dot on it is where your reel's **drag** starts to give line.

The flick is hard to miss: a splash and a sound where the fish is, the rod tip nods, the ring pulses amber and reads *flick!* (on a phone the button says *Easy*, and phones that can will buzz). The jolt of a surge builds over its first moment, so letting go as soon as you notice the run is usually still in time; holding on through it is not.

Each kind fights in its own way, and the prompt says what it's doing: carp, tench and wrasse plod off on long, heavy runs; trout, perch, mackerel, mullet and sea bass dart this way and that; pike and largemouth bass shake their heads at the surface; flatfish flatten themselves on the bottom; squid jet backwards in short pulses; tuna sound deep and circle below the boat. Each fish fights as itself, too: a big one in fine condition runs longer and harder than a lean little one. On a run it turns now and then (a swirl where it swings round), and the jumpy kinds (trout, sea bass, garfish, bluefish, mackerel) **leap** clear of the water a moment into a run: keep winding, rod up, so the line stays tight. As it tires its runs get shorter (*tiring*), and at the end it rolls on its side (*beaten*): wind it in gently.

**Side pressure**: while a fish is running, swing the rod low to the side against it (A or D, or the stick across): it turns the fish and tires it sooner. A current running away from you helps a fish that runs with it; one running towards you helps you. A soft rod (the float and fly rods) bends further and cushions a surge, but tires a fish more slowly; a stiff one (the boat and offshore rods) the other way round.

**The line and the reel** show you what's happening. The line runs from the reel up through the rod's rings to the tip and out to the fish: slack, it sags from the tip, lies on the water and drifts with the current (and bellies in the wind); under load it comes tight and straight, down into the water towards the fish. The rod bends towards the fish, deeper the harder it pulls, and springs back as the load comes off. When the fish takes line against the drag the spool turns and the drag clicks, slowly as it leans on it and in a buzzing scream on a long run (brighter and louder with the drag set tighter); the handle turns as you wind. Near the line's breaking strain the line glows orange and thrums, it **sings** (a thin rising whine), the tension ring flashes red and the meter says *ease off!*. Under the meter's word you see what the fish is doing and how much line is out. The reel and line have their own volume in Settings → Sound.

The drag is a clutch: when a fish pulls harder than the drag setting, the reel lets line go instead of the line breaking. W/S (or the stick) tightens or loosens it during a fight. A light drag is safe but slow; a firm drag tires fish faster but leaves less margin. Each rod starts with a sensible setting (light for fine lines), and the game remembers yours.

When a line does break, a note says exactly why:

- **Tension**: you were winding hard just as the fish surged. Watch for the flick and ease off.
- **Drag**: the drag was locked, so it couldn't give line.
- **Snag**: the line was too light to stop the fish reaching weed or roots. Use heavier line for big fish near cover.
- **Teeth**: a pike cut line with no wire trace. The spinning rod has one.

On **Natural** and **Demanding** fish behaviour (below) a fish can also come off with the line whole: it **threw the hook** in a leap while the line hung slack (keep winding when it jumps), or a hook with only a light hold **pulled free** because the drag was set too tight for too long (a sensible drag never does it). On Relaxed, the default, a hooked fish never comes off this way.

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

### Fish behaviour

**Settings** → **Controls & comfort** → **Fish behaviour** decides how fussy the fish are, separately from the difficulty of the fight:

- **Relaxed** (the default): fish come readily and forgive a lot. The wrong depth, a hasty retrieve, a dragging fly or a visible line rarely put them off, the weather and the light matter less, and a hooked fish stays on.
- **Natural**: each kind as fussy as in life. The light, the current, the weather and a careless approach all count, and the fish tell you why they turn away. A jumping fish can throw the hook on a slack line.
- **Demanding**: wary fish. They spook at splashes and boats, see a thick line, and refuse anything not quite right; a hooked fish throws the hook on a slack line more often, and a light hold tears free under a drag set too tight.

Played carefully (easing off at the surge, winding through a leap, a sensible drag), every fish can still be landed at every level.

### Casting

Hold Space to load the rod: the ring on the water and the dotted arc of the cast move out at an even pace, so it's easy to stop where you want. Let go to cast. The rig flies along the arc you saw and lands on the ring: no dice, the same release always lands in the same place. Swing the aim with A/D (or by looking round) independently of where the boat or you face. Esc or right-click puts the cast down.

Two ways to cast (Settings → Controls & comfort → **Casting**):

- **Assisted** (the default): the ring is exactly where it lands, wind included. Hold as long as you like.
- **Manual**: the ring shows where you're aiming; the wind pushes light tackle off it (a fainter ring shows where it will really land, and moves with the gusts as you aim). The wind's speed and direction show while you aim; cast a little into it. When the rod is fully loaded the ring turns green for a moment: let go then for a few extra metres. Hold on past that and the rod overloads: the ring goes amber and the cast collapses short and to the right.

Rods and tackle matter: each rod has a casting weight range (shown in the backpack). Heavy rigs fly far and hardly drift; light lures, floats and flies blow about in the wind, more on a long cast and in a stronger wind (never at random: the same wind and release land the same place); a lure too light for the rod won't load it and falls short; one far too heavy isn't allowed at all (the backpack says why). Banks, high ground and overhanging branches stop a cast where they meet it, and a cast that would land on dry land or in water too shallow to fish drops into the last good water along its way. A note after each cast says how it went: *Right on the mark*, *4 m short: the rod overloaded*, *2 m wide right: the wind carried it*, *a branch caught it*. Bottom rigs and leads sink and settle; floats cock at the depth you set; jigs sink at their own rate. The fly rod has its own rhythm: false casts that shoot out a little more line each stroke, delivered on the forward stroke.

### Views and first person

The camera stays in the view you chose: casting, a bite and a hooked fish never switch it. It turns all the way round you or your boat (front, sides, behind), and tilts from high above right down past the waterline: below the surface the view becomes the underwater view by itself (the colour, the haze, the light coming down, the bubbles), looking up at the hull or your legs, and tilting back up brings it out again. Where the water's too shallow to dip into it skims along just above the ground or the surface instead, and it never passes through a hillside. **V** goes in or out of first person at any time (the rod in your hands, the line running out, the water in front of you; you can walk, row or drive in first person too). **C** steps through the views, including a fixed underwater view beneath the boat and one following your bait. **R** resets the camera behind you. Settings has camera sensitivity, inverted look and a **reduced motion** option that keeps the camera from swaying or turning by itself.

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
| Cabin boat | Alongside Willowhaven quay | Slow and steady, with a little cabin forward you can go into: a bunk and a galley stove. A camp that floats |

Walk up to a boat and press **E** to get in; step across between two boats side by side; step ashore at any bank, pier or jetty. In shallow water an outboard tips up and you can only creep. Fish hear an outboard (not the electric motors), so slow down near them.

**Anchoring, tying up and towing.** A second, smaller prompt above the main one (**Z**, **X** on a controller, or tap it) is always about holding the boat still, and says what it will do where you are:

- *Out on the water*, **Drop the anchor**: the anchor goes over the bow and down to the seabed on its rope, about two and a half times the depth paid out. She drifts back on the wind and tide until the rope comes tight, then lies there head to the anchor, swinging a little and riding the waves; nothing pins her in place. **Raise the anchor** hauls it in: the rope shortens, drawing her up over it, and it comes up to the foredeck (a few seconds; the motor and oars wait until it's up). It needs water at least a little deeper than she draws (or she'd swing onto the bottom) and no deeper than 25 m (the rope is 30 m): where you can't, the prompt says why. Under the water you can see the rope and the anchor lying on the bottom.
- *Beside a jetty or quay* (any of them: the old jetty, the landing, Wend Quay, the boathouse jetty, Puffin Cove, Willowhaven quay, the Calf's landing), slow and within a few metres of it, **Tie up alongside**: she's drawn in to lie along it, a line at the bow and the stern, fenders between, and stays there, the waves still moving her a little. Step ashore and use the quay; she waits. Tied up, the throttle and the oars don't move her; **Cast off** pushes her clear (out from the pier, or along it where it's shallow outside), and only into open water: if another boat is lying right beside her, it says so. Stepping ashore at a jetty makes her fast for you, and boats brought round to Willowhaven quay arrive tied up.
- *Towing*: alongside another boat, the main prompt offers to **step across** or **take her in tow**. A line from your stern to her bow: she follows where you go, swinging round behind you on the turns, and slows you a little. **Let go the tow** (the mooring prompt, or the same choice beside her) leaves her where she is, to anchor, tie up or come back for. A small boat can't tow a much bigger one: the kayak tows nothing, the rowing boat not the cabin boat.

Whether a boat is anchored (and where its anchor lies), tied up (and at which berth) or on a tow is kept with the save, so she's found exactly as you left her.

**The throttle.** The motor skiff, the bass boat and the cabin boat each have a throttle lever with notches: **R** astern, **N** neutral, then **1** dead slow (about 1 m/s, for creeping round piers and moorings), **2** slow ahead (about 2 m/s, trolling speed), **3** half and **F** full ahead (on the bass boat the first two notches, **E1** and **E2**, are its quiet electric motor). The lever is on screen at the bottom right while you're at the helm (above the round button on a touch screen): click or tap a notch, or drag the handle; the fill beside it shows what the motor is actually giving. **W**/**S** (or the left stick pushed and let go, or **+**/**−**) move it a notch at a time, and it stays where you leave it; held down, it steps on, pausing at neutral before going astern. **X**, **B** on a controller or the big **Stop** under the lever knock it into neutral: the motor idles and the boat coasts on, slowing gradually. The motor takes a moment to build up and to ease off (an electric one less), and changing between ahead and astern it goes through neutral and pauses while the gear changes. Steering (A/D, the stick across) is separate and works at any speed, best with a little way on.

**Fishing under way.** You can cast from a moving boat at up to about trolling speed. Going faster, starting a cast eases the throttle back to slow ahead for you (a word says so), and you aim while she slows. The rig leaves the rod with the boat's way on it and lands carried along in the direction you're going (the aiming ring shows it, and the note after the cast says how far). With a line out the motor keeps running: the boat tows your lure behind it on the line that's out (trolling), and it swims as if you were reeling it, so fish chase it. With a line out the throttle goes no higher than slow ahead (+ and −, the D-pad, or the lever change it; W/S are for the lure), and when a fish takes, you knock the motor into neutral: the boat coasts while you play it, and dead slow is the most you can give it until it's landed. Passing back over your line leaves it slack; it comes tight again astern. The rowing boat and the kayak drift on the wind and tide with a line out, and the line tows the rig along the same way.

**The kayak's electric motor.** The kayak carries a little electric motor on its stern. **U** (**L3** on a controller, or **Lower motor** by the lever) lowers it into the water; then the throttle lever drives it (R, N, 1, 2, 3), up to about 1.6 m/s: slower than paddling (about 3.5 m/s), but silent and hands-free, for creeping up on fish or trolling a lure. Raise it again and you paddle. In very shallow water it kicks up out of harm's way. It runs on a battery of its own (shown in the hint), about a quarter of an hour flat out and far longer at dead slow; it charges while the kayak is tied up at a jetty or quay, and overnight. If it runs flat the motor comes up and you paddle on: the kayak is never stuck. Whether the motor is down, and the battery, keep with the save.

**Sailing.** The **sailing boat** is a little sloop with tan sails, tied up on the west side of Willowhaven quay (or have her brought round). Raise the sail with **U** (L3 on a controller, or **Raise sail** on the panel); with it down she rows. Under sail she goes where the wind lets her: **W** hauls the mainsheet in and **S** eases it out (it stays where you leave it), **A**/**D** steer with the tiller, which only bites with way on. The panel at the bottom right shows her from above with the wind as she feels it (bold) and as it truly blows (faint), the no-go zone either side of it, where the boom lies, the sheet with a mark where it would draw best, her speed in knots and what the sail is doing: *luffing* (it flaps: haul in), *stalled* (sheeted too tight for the wind: ease out), *close-hauled*, *reaching*, *running*, or *in irons* (head to wind, nothing drives her: bear away). The sail itself shows it too, bellying out when it draws and flapping when it luffs, with telltales on its luff and a flag at the masthead. She's fastest across the wind (four or five knots in a good breeze, never much past six), slower close-hauled and dead downwind, and makes nothing within about forty degrees of the wind: to go upwind, zigzag, and **tack** through the wind with speed on (the boom swings across). Turning the stern through the wind is a **gybe**: the boom slams over, so haul the sheet in a little first. She heels to leeward and, pressed too hard, slows and turns up into the wind: ease the sheet in the gusts. **Wind lines**, white streaks drifting through the air with the wind (gusts and all), show where it's coming from and how hard while you sail; Settings → Weather & sea shows them always or never instead, and Settings → Controls & comfort has **Sail trim: Helped**, which trims the sheet for you whenever you leave it alone. You can fish under sail: the sheet holds while the line is out, as a throttle does when trolling.

**The cabin.** With the cabin boat still and made fast (anchored, or tied up alongside a quay), **E** at the helm takes you **into the cabin**, and from the quay the prompt offers the helm or straight into the cabin. (Tied up alongside, you make her fast with the anchor as you go in.) Inside, the roof lifts away and the view looks down into the cabin; **V** looks round it through your own eyes, roof on. **W**/**S** (or the stick) walk between the doorway, the galley and the bunk; **E** at the galley cooks and eats, at the bunk sleeps (you wake in the bunk), at the doorway takes you back out on deck; **Esc** (or **B**) goes straight back out. After dark the cabin lamp is lit. You can't go in while she's under way, and a save made inside puts you back at the helm. Every boat stays where you leave it, anchored or not, and boats reloaded from a save are checked: one that wouldn't float where it was goes back to its mooring. There's no damage to worry about, and fuel is light (below).

### Fuel

Only what has an engine needs it: the car, the motor skiff, the bass boat's outboard and the cabin boat run on petrol, and the bass boat's and the kayak's electric motors each on a battery. The rowing boat (and the kayak's paddle) never need anything. The hints show what's in the tank while you drive or motor (*fuel 31 of 45 L*), with a word when it's down to a fifth.

- **Pumps**: one beside the garage at home (the car and the jerry can), and one at the root of Willowhaven quay (the boats alongside, and the car in the harbour car park). Press **E** at a pump; filling up takes a few minutes and costs nothing.
- **The jerry can** (10 L) goes wherever you put it: the garage shelf, the car's boot or your backpack. Fill it at a pump and pour it into the car or a boat from your backpack's *Camping kit* section. Longmere has no pump, so the bass boat's outboard runs on what the can brings.
- **The battery** runs down while the electric motor runs (about ten minutes of it at full), and charges while the bass boat is tied up at a jetty or quay, and overnight whenever you sleep.
- **A full tank of the car** does any trip there and back; the workbench's packing list and the car's *Where to?* say what each drive takes, and warn if the tank won't do.
- **Running dry never strands you.** The car rolls to a stop: pour in the jerry can, or walk to a farm for a can (an hour). A drive you let go by with too little in the tank still happens, an hour later. A boat with a dry tank (or a flat battery) moves slowly under an oar, and from the prompt you can pour in the jerry can or have a tow to Willowhaven quay (or the boathouse, for the bass boat): an hour, and a few litres to go on with.

Boats ride the water you see: they heave, pitch and roll on the swell and chop, gently, and no wave tips one over. A kayak bobs on every wavelet; the long rowing boat and skiff bridge short chop; the broad bass boat sits steadiest. Unanchored, a boat drifts with the current and is blown along by the wind (the high-sided bass boat most, the low kayak least), so on a breezy day in the estuary you'll drift down the channel while you fish. At anchor it lies a few metres down-wind and down-current of the anchor, bow to its rope.

### Backpack, creel and camp

You carry **two rods and eight baits, lures, flies or jigs**, plus a **creel** for up to four fish you keep. Everything else waits in a **tackle box**: at camp, at Wend Quay, at the Mere Boathouse and at Puffin Cove, and in the lockers of the motor skiff and the bass boat. Open the backpack within reach of one to swap. Press **Q** to change tackle anywhere, and **1**/**2** to switch rods.

The top of the backpack has **Head back to: Camp (the tent) · The boat · Another camp (map)**. Use it any time to return to a safe spot beside a tent or to climb back into your boat, keeping everything you carry and have caught. If you ever get stuck on foot, a *Stuck?* prompt appears that opens it for you. (It waits while a fish is on the line.)

At camp you can light the fire, **grill** a fish from your creel (it takes half an hour of game time, and the fire must be lit), **eat** it, or have an oatcake from the tin. Hunger is gentle: you only get a little slower on your feet if you go a whole day without eating, and a cooked fish makes you **well fed**, which steadies your hands in a fight (the line tightens more slowly) for six hours. Sand smelt and anchovies are too small to keep one by one, a conger is far too big to bring aboard, and the protected eel is only ever watched.

### Reading the water

- **Rings** spreading on calm water: a fish rising to feed just below (trout rise to hatching flies on the stream).
- **Nervous water**, many small dimples together: a school of small fish near the surface.
- **A flash**: a fish turning in the light just under the surface.
- **A splash**: something jumped.
- **Fizzing bubbles** on the lake: carp grazing the bottom.
- **The sea boiling white**, out in the deep: tuna driving a sprat shoal to the surface.
- **Seabirds wheeling and diving**: a shoal of mackerel, sprat, sardines or anchovies just below, and often something hunting them (bonito, bluefish, bullet tuna, little tunny). Head for the birds.
- **Ripples and streaks running one way**: a current. The Wend runs out to sea down its estuary, and the tide races off Gannet Isle's points, through the Skerries and over Long Shoal, and fastest of all through Calf Sound, where the water stands up in white ridges; the bays and coves are slack.
- **Whitecaps** in the open: a fresh wind with room to raise a chop. Shelter in the bays and coves.

Each of these comes from a real fish at that spot. Press **C** to look underwater and you'll find it there.

### The fish finder

Press **F** for a small sonar screen. Drag its title bar to put it anywhere (it remembers the spot); double-click the title bar to put it back. The ⤢ button changes its size, and **?** explains the colours. In the boat it reads the water under the hull; on shore it works like a castable sonar, reading the water around your rig once it's in. The right edge, marked *now*, is the latest reading; older readings slide to the left. It shows the real bottom (a thick, bright line is hard rock; a soft one silt or sand), weeds as green strands, your bait or lure as a blue diamond, and fish as echoes: arches whose size and colour hint at how big they are, specks and clouds for small fish, and a little clutter. It never tells you what kind of fish it is.

### What's out there

The sea holds 44 real species of the coast from Royan and the Gironde estuary to Cádiz, each where it really lives (estuary channels and flats, rocks and reefs, sand and mud, shoals and open water), with the habits, baits and fights of its kind. The [field guide](#the-field-guide) has a page for each, with its model, where to find it and how to catch it; here they are in brief.

| Where | Species |
| --- | --- |
| The Wend estuary (brackish) | European seabass, spotted seabass, meagre, thicklip grey mullet, gilthead seabream, European flounder, common sole, Senegalese sole, wedge sole |
| Rocks, reefs and weed | ballan wrasse, black, white, two-banded and redbanded seabream, red porgy, common pandora, common dentex, rubberlip grunt, bastard grunt, pollack, European conger |
| Sand, mud and the seabed | European plaice, sand sole, turbot, tub gurnard, striped seabream |
| Shoals and open water | Atlantic mackerel, Atlantic horse mackerel, European sprat, European sardine, European anchovy, sand smelt, bogue, salema, garfish, bluefish, pompano, Atlantic bonito, little tunny, bullet tuna, Atlantic bluefin tuna |
| Not fish | European squid, common cuttlefish, common octopus |
| To watch, not to catch | European eel (critically endangered: it ignores every bait) |

A few to start with: two-banded seabream round the weed and rocks of Willow Bay by day (a worm under a float); sand smelt schooling over the shallow sand (bread, kept shallow); sea bass in the estuary channel at dawn and dusk (a soft sandeel); sardines and horse mackerel shoaling under a light after dark (sabiki feathers); soles on the flats at night (ragworm on the bottom); an octopus in the rocks at dusk (a crab on the bottom, and a steady lift: it clings).

**Las Brasas**, the volcanic island four days to the south (see [Las Brasas](#las-brasas-the-long-passage-south)), has ten kinds of its own on top of the home coast's that live there too:

| At Las Brasas | Species |
| --- | --- |
| The shallow lava reef | parrotfish (the islands' favourite fish, “vieja”: a peeler crab on the bottom by day), ornate wrasse (bright, bold and a bait thief: let it go), grey triggerfish (a prawn; it picks, so wait for the tip to pull right round), Mediterranean moray (a fish strip on the bottom after dark; fried, a classic island dish) |
| El Veril, the drop-off | dusky grouper (in the caves of the wall and the arches off the Roque: catch and release, every one goes back, and never with the speargun), yellowmouth barracuda (shoals off the points at dawn and dusk: a soft sandeel on a wire trace), greater amberjack (the hardest-pulling fish in the game, on a metal jig with the offshore rod: let it go) |
| Shoals | Atlantic chub mackerel (the islands' mackerel: a small casting metal) |
| To watch, not to catch | angelshark (critically endangered: a flat shark lying buried in the sand of El Sebadal, most about after dark), Atlantic trumpetfish (a long tube of a fish hanging head-down over the reef by day) |

The dusky grouper and the chub mackerel are in the Atlantic register; the other eight are fish of the warm eastern Atlantic islands outside it, listed in the field guide with their scientific names and where they live, like the freshwater fish.

Fresh water (Reedmere, Fernbeck and Longmere) keeps its own fish, outside the Atlantic catalogue: perch, pike, largemouth bass, mirror carp, tench, roach, rudd, brown trout and grayling, fished as before.

The five fish of Slow Tide's first version (glassminnow, sunperch, drizzlefin, duskfin and mossback) were invented. Real species have taken their places in the water (sand smelt, two-banded seabream, pollack, horse mackerel and conger), and the originals are retired: catches of them stay in your journal under their own names, and the field guide keeps their pages if you have them in your records.

Fish keep to their own waters: lake fish never turn up in the sea, nor sea fish in the lakes.

The places you fish from most have fish of their own, of the kinds that really haunt such places: at **Willowhaven**, grey mullet cruising the quay wall, gilthead and a conger in its stones, squid under the lamp after dark and sand smelt in the calm water inside; sand smelt and gilthead off the **lake landing's** pier; mullet and a bass or two at **Wend Quay**; perch, roach and a waiting pike under the **Longmere boathouse**. Every pool in **Fernbeck** holds trout or grayling (often both). None of them were taken from anywhere else: every other fish is where it always was.

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

Your camp, map marks, the list of your photographs, adventures and keepsakes are saved too, and (from save version 6) where each piece of your outing gear is, the car, your plan, loadouts and last trip, and what's on the wall at home. Older saves load as they were: your camping gear stays where it was (at your camp, or rolled up in your backpack), the car waits on the drive at home, and you carry on wherever you were. A drive under way when the game closes finishes when you next load, with you and the car at the car park and nothing packed lost or doubled.

Saves are careful. Each one carries a version number, so a future update can convert old saves instead of breaking them. Every value is checked when loading, so a damaged save can't crash the game. If the save can't be read at all, it is kept aside (never written over) and the game loads the copy from the start of your previous session instead, and says so. A save made by a newer version is never written over. If you open the game in two tabs, the older tab stops saving so the two can't overwrite each other. In a private window, where the browser may refuse to store anything, the game tells you that progress won't be kept.

### The journal and catch log

Press **J**. The **Fish & places** pages hold a sketch and notes for every kind you've met, grouped by water (Willow Bay and the coves, the Wend estuary, the outer coast and open sea, fresh water, and *Not fish* for the squid), the hand-drawn map, the places you've found with what you've caught in each water, keepsakes and your progress. The **Catch log** pages record every catch:

- the kind and its length, and its weight (worked out from the length),
- the day and time, the water (salt, brackish or fresh), the nearest named spot, and the weather,
- how you caught it: the rod, the line, the bait, lure, fly or jig, and whether from a boat or the shore,
- how deep it took and how deep the water was, and whether flies were hatching,
- what happened to it: released, kept, cooked or eaten.

It shows your heaviest catch, totals and personal bests for each kind, and your recent catches with filters for kind, water, method and what happened to them (25 at a time, with *Show more*). The **Memories** pages hold your photographs, adventures and keepsakes, marks, camp and places (see [Photographs and memories](#photographs-and-memories)).

### The field guide

The journal's third tab, **Field guide** (also the **Field guide** button in the backpack's header), has a page for every species in the game: sea and estuary fish, the cephalopods, the freshwater fish (kept apart from the Atlantic catalogue), and the five fictional originals. Search by any name (English, French, Spanish, Portuguese or Latin) or filter to what you have or haven't caught. **Preview planned species** adds the researched species that aren't in the game yet, clearly marked as such.

Each page shows, before you've caught anything:

- **Identification**: its names, the same 3D model it has in the water (drag or use the arrow keys to turn it, scroll or + and − to zoom, ↺ to reset), its size in the game and in reality against a ruler, the features that tell it apart and what it's easily confused with.
- **Where to find it**: the waters, habitats and depths the simulation gives it, when it's most active and whether rain stirs it (read from the simulation's own functions, so the guide can't disagree with the game), a small map with the water that suits it shaded, **Show on the big map**, and a table of where it lives along the real coast from Royan to Cádiz, with how sure that is and what each region's word rests on. The game has no seasons yet, and the page says so rather than inventing any.
- **How to catch it**: the methods that work, the setup the guide recommends (rod, reel, line, rig or leader, bait or lure, each with its picture and every part accepted by the tackle rules, and a mouthful the fish can manage: a small-mouthed white seabream gets a ragworm, not a whole crab), how to present it, other setups that work, and the common mistakes for that species. **Rig it now** sets your rod up if you carry the parts; otherwise it says what's missing and where to get it, and **Open in the backpack** goes to the piece.
- **Your records**: how often you've seen it underwater (a fish in front of you within about nine metres counts), how many you've caught, your best, where, in what weather, and the setups that caught it.
- **Sources**: every page the register entry came from, and what is still uncertain.

In the backpack, each bait, lure, fly and jig lists the species it's **Good for** (✓ for ones you've caught); each opens that species' page. The catch card and the journal's pages show the same model as the guide (a pencil silhouette until you've caught one).

**Plan a fishing trip** (on any catchable species' page) puts it together:

1. **Where to go**: the stretches of water that suit it, nearest first, from the same habitat data the fish live by (waters, habitats, depths): areas of water, never where a fish is. Pick one; the map beside it rings it.
2. **What to take**: the guide's best setup and two alternatives, all accepted by the tackle rules.
3. **What you carry**: each part ticked if it's in your backpack, or *in the tackle box*; the line and rig come with the rod.
4. **Rig up**: *Rig it now* if you carry it; *Pack it and rig it* at a tackle box (camp or a motorboat's locker: if your backpack is full, the rod you aren't holding or tackle none of your rods uses goes back in the box, and you're told what); away from a box, what's missing and where to get it.
5. **Set off**: the water is marked on the map and with an on-screen marker until you get there.
6. **Afterwards**: the trip page shows how it's going (time out, the target caught, everything else), and *End the trip* keeps a record of it on the species' page. Nothing is guaranteed: fish move, feed and rest as they please.

**Why aren't they biting?** If a cast stays quiet for a while, the field guide offers one word on it (Settings → Controls & comfort → **Fishing hints**: gentle, more or off), and **Y** asks any time. The answer comes from the simulation itself, for your trip's fish (or the likeliest fish here): whether it eats what's on the hook and can manage the size, whether this is its kind of water and depth at this hour, whether your lure moves the way it likes, whether it's shy of your line, whether the current has carried your rig off, and how the fish that came to look behaved. It never says where a fish is.

### The map

Press **M** (or the map button). The map is drawn from the real ground and water depths, but only where you've been: land and water fill in around you as you travel (further out on the water than in the woods), and the rest stays blank paper. It marks the places you've found (camps as tents, landings as little piers, landmarks with a cross), where each boat is, where you are, and where your best fish of each kind came from. Drag to move it, scroll or pinch to zoom, ◎ to centre on you. Beside it: your camps (with **Go there**), Willowhaven, your boat, your marks, and every place you've found. Your own camp shows as a tent in its own colour, marks as stars and flags, and (after *Where the gulls dive*) recent gull sightings as little birds. Opened from the field guide, it shades the water that suits a species and frames the nearest of it; this shows where to look, never where a fish is.

### Settings

Press **O** (or the gear button, or *Settings* on the title screen). Everything is kept with your game and changes take effect straight away. Opening a menu never casts, reels or steers.

- **Sound**: master volume and mute, music, surroundings, **wind**, **waves**, rain, effects, the **reel and line** (the drag's clicks, the reel's whirr and the singing line; turn it down for a quieter fight), and the bite-alert bell (with a button to hear it). Mute silences everything, wind and waves included.
- **Graphics**: a preset (**Auto**, **Cinematic**, **Ultra**, **High**, **Medium**, **Low**) and, under it, resolution, shadows, reflections and water detail, plants and particles, underwater effects, how many distant fish are drawn, and a frame-rate cap. Auto starts at High on computers and Medium on phones and tablets, then steps down by itself if the game runs slowly; it never picks Ultra or Cinematic for you. **Restore recommended settings** puts everything back to Auto in one tap. Lower settings draw less but change nothing about the fishing: every fish is still simulated, can still bite and still shows on the fish finder.
  - **Ultra** is the best that still plays smoothly on a computer with a good graphics card: drawn a little sharper than the screen (even an ordinary monitor), finer shadows reaching further round you, a full-resolution mirror on the water and a finer ripple field, about a quarter more grass and underwater weed, clearer air and a longer view, and a light finishing pass: a soft glow round the brightest light (the sun and its glints, lamps, lit windows) and the colours of the hour graded a little.
  - **Cinematic** is the richest look, for powerful computers and photographs: everything Ultra has, sharper again on ordinary screens, half as much grass and weed again as High, the clearest air and the longest view, and a fuller finishing pass: a stronger glow, warm light streaming from a low sun at sunrise and in the golden hour, a touch more colour and a gentle darkening at the corners. It can run at a lower frame rate, especially on laptops and phones, and Settings says so when you pick it.
  - The world is still a stylised, low-poly one at every level: the top levels make it cleaner, deeper and warmer, not photographic. Changing the level never moves the camera, interrupts a fish you're playing or touches your save (beyond remembering the choice). The finishing pass needs WebGL 2; where a browser hasn't got it, Ultra and Cinematic simply go without it.
- **Weather & sea**: Clear, Partly cloudy, Overcast, Light rain, Heavy rain, Storm, or Automatic (it changes by itself through the day). The sky, light, fog, water, rain, sound and the fish all follow it, changing smoothly. Separate sliders for how much rain is drawn and how loud it is. Then the **sea** (with the weather, Calm, Moderate or Lively), the **wind** (automatic, or set it yourself: direction and strength), the **currents** (Natural; Gentle, at half strength; or Still, where your boat and rig stay put and only the fish know the water runs), and whether the conditions panel shows.
- **Controls & comfort**: camera sensitivity, invert look, reduced motion, a **boat camera** that moves with the boat or keeps a steady horizon (no pitch or roll, and the quick bob of the chop smoothed away; you still drift gently up and down with the swell, so the view never looks detached from the water), assisted or manual casting, **fishing hints**, difficulty, **fish behaviour**, and every key, with a button to change each one (press the new key; one already in use swaps over).

Graphics settings never change the simulation: the waves the boats ride, the wind on a cast, the currents and every fish are the same on Low as on Cinematic.

At every level the sky now glows warm round a low sun and turns a cooler dusky blue and rose on the far side, with a proper sunrise and a blue hour after dusk; overcast light is softer and more even; and after dark the windows of the haven and the cabin boat glow with warm lamplight.

A note on what this is: Slow Tide is a stylised, low-poly game drawn with three.js and WebGL in the browser. The water uses real planar reflections, a ripple simulation and procedural detail. The lighting, haze and mist are painted rather than physically simulated, and nothing here is photorealistic. Far-off places are drawn only when you're near them, and fish far from you are simulated more coarsely, but never stop.

### Wind, waves and currents

One shared set of conditions (`src/world/conditions.js`) moves the water you see, the boats on it, your float and rig, the cast, the trees and the sound. It's a light approximation, not a fluid simulation:

- **Wind** has a direction, a sustained strength that changes slowly with the weather (or as you set it), and **gusts**: patches of stronger air drifting downwind, visible as darker ruffles on the water. Land breaks it: bays, coves and the lee of a shore get less. It pushes a cast in flight (light tackle and long casts most), drifts an unanchored boat (the high-sided bass boat most) and a float's tip a little, bends the trees and grass, and you hear it rise in the gusts.
- **Waves** are long **swell** from the open Atlantic (west-south-west), which builds and fades over minutes and hardly reaches into the bays, the coves or the estuary, plus a shorter **chop** raised by the local wind, which builds in under a minute and is smaller where the wind has little room. Changing the wind turns and builds the chop gradually; nothing jumps. Waves die away in the last half metre of depth, so boats sit still on a beach; surf and foam grow on the shore where the swell reaches it, and a fresh wind raises a few whitecaps in the open.
- **Currents**: a gentle drift along the open coast; the Wend running out to sea, fastest in the narrow river, easing over the estuary; and faster water in the channel into Driftwood Cove, round Gannet Isle's points, through the Skerries and over Long Shoal. Sheltered water is slack, and every zone fades smoothly into the next. Water at the seabed runs at about 60% of the surface's. A float goes with the water it sits in; a lure is carried while you work it (its speed through the water is what the fish judge); a jig drifts as it sinks; a bottom rig is carried as it falls, then its lead holds unless the current at the bottom is stronger than its weight can stand (a 5 oz flapper rig holds where a light feeder would roll); fish holding station face into it. The current zones are built for a future tide: today they all run on the ebb.

- **Storms**: now and then heavy rain turns into a storm (or choose **Storm** in Settings → Weather & sea). The wind rises to a gale, with harder gusts and a howl in it; over a minute or two the big seas roll in from the Atlantic, far longer and higher than the everyday swell (four to seven metres crest to trough on the open coast), standing up in steep peaks with long troughs between, their crests breaking white and the foam blown down the wind in streaks; spray flies off the breaking crests and off your bow as she plunges into them. The sky goes low and dark slate, the rain drives slantwise, and lightning strikes out over the sea and the hills (flashing the whole sky, often twice) with the thunder rolling in after it, later the further off it struck (a kilometre in three seconds). Every boat is thrown about far more, but none is ever tipped over. The coast still shelters: the bay, the coves and the estuary stay much calmer, and the big seas have spent themselves before the shallows, so a storm is a time to run for home (the game says so if you're out in the rowing boat, the kayak or under sail). A storm takes longer to die away than to come. With **Reduce motion** on (Controls & comfort), the lightning never flashes the screen; the thunder still rolls.

The **conditions panel** (top left, **N**) shows the wind (speed in km/h, where it blows from, arrows as you see them, *gusting* or *sheltered*), the current at your rig or under you (m/s) and the sea state in words (glassy, rippled, smooth, slight, moderate) with the wave height. Calm conditions are a complete way to play: every fish can be found in calm water.

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

## The Atlantic species register

Slow Tide's sea is meant to grow into the coast from Royan and the Gironde estuary, along the French Bay of Biscay, the Cantabrian coast, Galicia and Portugal, to the Algarve and the Gulf of Cádiz. The register (`src/register.js`, with the researched entries in `src/registerData.js`) is the checklist of fish and cephalopods for it, and the one source of truth for names and real-world facts across the field guide, the journal, the catch card and the water.

It is a researched catalogue, **not a complete inventory** of everything recorded on this coast: 62 species so far (55 fish, 3 cephalopods, 2 sharks and 2 rays), the ones an angler, snorkeller or fish market of this coast would meet, not the deep-water fish or rare visitors. Each entry has:

- a stable id, the scientific name with its author, synonyms and family;
- English, French, Spanish and Portuguese names where a source gives them (the shanny has no Spanish name yet, and none is made up);
- habitat, usual and recorded depths, typical and exceptional size (with the source of each), diet, behaviour and seasonal movements;
- for each of the six regions: resident, seasonal, occasional, absent or unknown, with a confidence (high, medium or low) and what it rests on. A range statement alone ("Morocco to Norway") gives at most medium confidence; a regional checklist, survey or official document is needed for high;
- identification features, look-alikes, angling methods, conservation and regulations;
- its sources (578 links in all), and what is uncertain or conflicting.

The research came from FishBase, SeaLifeBase, DORIS, WoRMS and the Catalog of Fishes, regional checklists and papers (the Portuguese marine checklist, the Galician and Cantabrian lists and IEO guides, the Andalusian catalogue, Ifremer and AZTI surveys, ICES and ICCAT documents) and French, Spanish and Portuguese official rules. It lives in `research/register/*.json`; `node tools/build-register.mjs` compiles it into `src/registerData.js` (a test checks the two match). Stock assessments and landings were used only as evidence of presence, never as counts of species. Of the 372 regional statements, 153 are high confidence, 156 medium and 63 low.

Four things are kept apart: the **research catalogue** (all 62), the **playable roster** (the 44 you can catch), **observation-only wildlife** (in the water to be watched, never caught) and **planned or uncertain records**. Each card and page says which:

- **In the game · catchable now**: 44 species. Every one has an anatomical model, lives in its habitats, has a setup the field guide recommends that the tackle rules accept, is tested biting on it in the headless ecosystem and landed with it (careful play, Standard difficulty), and is logged in the journal.
  - Bass and the estuary: European seabass, spotted seabass, meagre, thicklip grey mullet.
  - Seabreams and grunts: gilthead, black, white, two-banded, striped and redbanded seabream, red porgy, common pandora, common dentex, rubberlip grunt, bastard grunt.
  - Rock and open-water predators: pollack, European conger, bluefish, ballan wrasse.
  - Flatfish and the seabed: common, Senegalese, sand and wedge sole, turbot, European flounder, European plaice, tub gurnard.
  - Shoals: Atlantic mackerel, Atlantic horse mackerel, European sprat, European sardine, European anchovy, sand smelt, bogue, salema, garfish, pompano.
  - Tunas: Atlantic bonito, little tunny, bullet tuna, Atlantic bluefin tuna.
  - Cephalopods: European squid, common cuttlefish, common octopus.
- **In the game · to be seen, not caught**: the European eel (critically endangered, and banned to leisure fishing in the Gironde): it lives in the estuary's reeds and quay and the bay's rocks, comes out after dark, ignores every bait, and goes in your records when you see it underwater.
- **Planned · not in the game yet**: 17 researched species, previewable in the guide (Atlantic chub mackerel, striped red mullet, lesser weever, shanny, thin-lipped and golden grey mullet, small-spotted catshark, thornback ray, European hake, John Dory, common stingray, blue shark, dusky grouper, allis and twaite shad, sea lamprey, European sturgeon). Protected ones are planned **to watch, not to catch** (sturgeon, allis shad, sea lamprey), and vulnerable ones as **catch and release** (dusky grouper, common stingray, blue shark, thornback ray).
- **Uncertain names** are flagged on the page rather than hidden: the white seabream (WoRMS and the Catalog of Fishes give the Atlantic fish as *Diplodus cadenati*; FishBase and most regional sources still call it *D. sargus*), the bullet tuna (*Auxis rochei*; the frigate tuna also turns up in Iberian catches), the squid and the pompano.

The game's world is one stylised stretch of coast inspired by the whole region, not a map of it, so a southern fish (the urta, the baila, the roncador) can share the water with a northern one; the guide's table of real regions says where each really lives, and how sure that is.

**Known gaps.** Many Cantabrian, Galician and Cádiz statuses rest only on range statements. The plaice's and sprat's presence south of the Bay of Biscay is poorly documented (low confidence), and the flounder's southern limit is disputed and retreating north. No rod-and-line method was found for plaice, sprat or octopus. Some regulations (minimum sizes, closures) change often and are recorded with their dates; check them before relying on them. INPN/TAXREF and several French government pages could not be read by the research and are not cited.

**Identity decisions.** The squid of the coves is the European squid, *Loligo vulgaris* (the usual inshore night-jigging squid; the veined squid *L. forbesii* is deeper and more northern). The bullet tuna is *Auxis rochei* (frigate tuna also turns up in Iberian catches). The garfish is *Belone belone*; the pompano is *Trachinotus ovatus* (several other fish share its Spanish names).

**The fictional originals.** Willow Bay's five invented fish have been replaced in the water by real species in the same roles: glassminnow → sand smelt (*Atherina presbyter*), sunperch → two-banded seabream (*Diplodus vulgaris*), drizzlefin → pollack (*Pollachius pollachius*), duskfin → Atlantic horse mackerel (*Trachurus trachurus*, which now gathers under lights after dark), mossback → European conger (*Conger conger*). The originals no longer live anywhere; catches of them keep their names in the journal and catch log, and the guide shows them as retired, with a link to their replacement, only if you have them in your records.

### Models

Every Atlantic species has an anatomical model built by `src/anatomy.js` from a recipe in `src/anatomy.js` (the first six) or `src/anatomyAtlantic.js` (the rest), following the identification features in the register. Six body plans share the machinery where the animals really are alike:

- **fish**: a body lofted from profiles of depth and width along its length, a mouth cleft (with fleshy lips for the grunts, wrasse and mullet), gill cover, scales and eyes, and fins placed, sized and coloured per species: spiny and soft dorsals, anal, pectorals and pelvics, finlets and keels, and tails forked, truncate, rounded or lunate. The bass's two separate dorsals, the pollack's three, the mackerel's and tunas' finlets, the garfish's long beak, the horse mackerel's row of scutes, the gurnard's blue-edged wings and walking rays, the redbanded seabream's threadlike spines, the pompano's black-tipped lobes;
- **flatfish** (soles, plaice, flounder, turbot): both eyes on top (the turbot's on the left), a fringe of fin running round into the tail, and each species' spot on the pectoral fin;
- **eel** (conger, eel): one long body and one continuous fin, starting just behind the head on the conger and far back on the eel;
- **cuttlefish**, **squid** (rhombic fins, eight arms and two clubbed tentacles) and **octopus** (a mantle bag, eyes with a slot pupil, eight arms that spread and curl).

Each body plan swims its own way, in the vertex shader: a wave down the body for most fish (stiff-bodied, all in the tail, for the tunas), a ripple for flatfish, the whole body for eels, the fin frill for cuttlefish, flapping rear fins for squid, rippling arms for the octopus. In the simulation, shoals keep formation without moving as one, attacked bait balls bulge away from the hunter and re-form, hunting packs (bonito, bluefish, bullet tuna, little tunny, bluefin) drive them to the surface, flatfish lie and glide on the seabed, gurnards and the octopus keep close over it, conger, eel and octopus rest in the rocks by day, and fish holding station face into the current.

Skins are painted from each species' markings at load time; fins are translucent with rays; the sides have a soft sheen. The same model is used in the water, in the guide, on the catch card and in the journal. The five retired fictional fish and the freshwater fish keep their earlier models.

**Asset provenance.** Every model, skin and texture is generated by the code in `src/` (`anatomy.js`, `anatomyAtlantic.js`, `fish.js`, `gearArt.js`, `tackleModels.js`); no external models, textures or photographs are used or shipped. Reference descriptions and photographs on DORIS and FishBase were used only as research for shapes, fins and markings.

**Measured cost** (a 2240 × 1260 view on a laptop; render time per frame, GPU-synchronised, with the browser pane in the background, so read them as relative): about 2,160 animals live in the water and their simulation costs about 0.2 ms per 30 Hz step. In Willow Bay on High, 133 fish in view make 124,000 triangles in 14 instanced draws (a detailed model near the camera, about 1,300–3,700 triangles by species, and a 600-triangle one further off, with no draw at all for a species with none in view), which made no measurable difference to a 16.5 ms render; from inside a sardine shoal underwater, 72,000 fish triangles cost under 0.1 ms on High and 0.75 ms of a 3 ms render on Low. Opening and closing the guide repeatedly, turning every reference model, leaves the studio's GPU memory where it was. The register adds about 93 KB (compressed) to the download and takes about 6 ms to load; the shelter map for the waves is baked in about 0.15 s at start.

### Expansion plan

Done: the six reference species (the first milestone), then the playable roster of 44 with the eel to watch (*The Living Atlantic*). What could come next, in order (the batch is on each planned entry):

2. **Common coastal fish still missing, and catch and release on the bottom**: Atlantic chub mackerel, striped red mullet, lesser weever (a venomous sand fish to handle with care), shanny, thin-lipped and golden grey mullet, small-spotted catshark and thornback ray (shark and ray body plans, and releasing).
3. **Deeper water and rarer visitors**: European hake, John Dory, common stingray, blue shark, dusky grouper.
4. **Migratory and protected estuary species, with seasons**: allis and twaite shad, sea lamprey, European sturgeon (to watch).

Alongside: seasons (spawning runs, the tuna's summer in Biscay, the meagre's spring in the Gironde, the pompano's summer in the north), a tide to turn the currents, and anatomical models for the freshwater fish.

## Where things live

| File | What it holds |
| --- | --- |
| `src/main.js` | Game loop, time of day, weather, the boats, stepping ashore and boarding, travel, interactions, sleep, discoveries, surface clues, HUD, glue between systems |
| `src/settings.js` | The settings: what's in them, checking saved ones, and the Settings panel (tabs, sliders, key rebinding) |
| `src/map.js` | The map: which parts of the coast you've explored, and the map sheet with its markers, zoom and camp list |
| `src/world/coldwater.js` | Hoarfell, Hoar Tarn and the Coldwater: the river's course, falls and water levels, the shape of the fell and the dale, the fell path |
| `src/world/riverwater.js` | The Coldwater's own water above the tide: the flowing ribbon, the falls and their mist, the tarn |
| `src/world/fell.js` | Up the Coldwater: the footbridge, the fingerpost, the bothy, boulders and scree, and the cairn on the top |
| `src/input.js` | Every key as a remappable action, keyboard-layout-aware key names, and the mouse and touch input |
| `src/world/terrain.js` | The shape of the world (now with home's level pad, the lanes and the car parks). One height function shapes the bay, island, cove, the west shore (lake, stream, camp), the Wend estuary and its river, Longmere, Gannet Isle and the skerries, the shoal and the deep. Places, zones and their water (fresh, brackish, salt), piers and walkable decks live here |
| `src/world/regions.js` | What's built beyond the bay: Wend Quay, the Mere Boathouse, Puffin Cove, Gannet Light, the drowned oaks, rocks, buoys, reeds and lilies |
| `src/world/shore.js` | Everything built on the west shore: landing pier and signpost, tent, campfire with smoke and light, tackle chest and rod rack, reeds, lily pads, the fallen alder, fishing pegs, stream boulders, footbridge, stepping stones, ferns, grass and hatching flies |
| `src/world/habitat.js` | The underwater map shared by everything below the surface: depth, weed beds, rock piles, kelp and reefs, the stream's current, and the homes fish live around, for the home waters and each region |
| `src/world/ecosystem.js` | Every fish in the world: schooling, cruising, feeding, resting, fleeing, rising and jumping, and how each one judges and takes a rig (nibbling, following, ambushing, rising, grazing, running). Fixed 30 Hz simulation, slower far away |
| `src/world/fishRender.js` | Draws the ecosystem's fish (a near and a far instanced draw per species, skipped when none are in view) with their swimming motion |
| `src/world/underwater.js` | Weed beds, submerged rocks, particles, light shafts, bubbles, and the colour, haze and sound blend as the camera crosses the waterline |
| `src/world/caustics.js` | Dancing light on the seabed and rocks |
| `src/world/world.js` | Terrain mesh (with a finer patch over the west shore), trees, rocks, jetty, cove props, Gull Rock, gulls, fireflies, and the obstacles you bump into on foot |
| `src/world/water.js` | Water shader (swell and chop from the shared conditions, peaked storm seas, depth colour, gusts carried downwind, wavelets, reflections, ripples, sun glints, surf, whitecaps, breaking crests and wind-blown foam, rain rings, lantern glow, fresh-water tint, flowing currents, the view from below) |
| `src/world/storm.js` | A storm's show: lightning bolts and flashes, the thunder after them, spray off the breaking crests and a plunging bow |
| `src/world/waterfx.js` | The mirrored view for reflections, and the ripple field every ripple is drawn into |
| `src/world/mist.js` | Drifting morning and evening mist over the water |
| `src/world/surface.js` | Fine surface detail: grain and the wet band on the shore, sand ripples, wood grain, cork |
| `src/world/sky.js` | Day cycle colours, sun and moon, sky dome, clouds |
| `src/camera.js` | The views (boat, on foot, first person, underwater, bait), their limits and smooth transitions |
| `src/firstperson.js` | First person: where the rod is held in front of your eyes for each moment of fishing, and its springy whip |
| `src/boat.js` | The six boats (rowing boat, motor skiff, kayak, bass boat, cabin boat, sailing boat): hulls, the cabin, the sailing rig and its cloth, the figure aboard, oars, paddle, outboards and trolling motor, rods, lantern and anchor; their physics (drift in wind and current, riding the waves, under sail, an oar when the motor's dead), draft and collisions |
| `src/sailing.js` | The wind on the sail: apparent wind, angle of attack, lift and drag, luffing, stalling and irons, the hull and centreboard, heel |
| `src/sailui.js` | The sailing panel: her from above with the wind and the no-go zone, the sheet, her speed |
| `src/world/windlines.js` | Wind lines: white streaks carried through the air by the wind |
| `src/fuel.js` | Fuel: tanks for the car and the motorboats, the electric motor's battery, the jerry can, the pumps' fills, what a drive takes, and the help you get when you run dry |
| `src/firstTrip.js` | The first-trip guide: its steps, what counts as each one done, where it points, and its words for keyboard, controller and touch |
| `src/gamepad.js` | Game controllers: the Gamepad API, the dead zone, which button presses which action where, and moving round the menus |
| `src/walker.js` | You on foot: the character, walking and jogging, wading, slopes and obstacles |
| `src/tackle.js` | Rods (lines, rigs, casting weight, range), baits, lures, flies and jigs, ready-made setups, and the checks that refuse impossible combinations |
| `src/tackleModels.js` | The little models on the end of the line: float, indicator, lead, baits, lures and flies |
| `src/fishing.js` | Aiming and casting (planning where a cast lands, wind, overloading, obstructions), the ways a rig behaves in the water, bites and bite alerts, hooking, the fight, landing, releasing and keeping |
| `src/fight.js` | The fight as plain numbers: tension against the line's strength, the reel's drag, fish stamina, surges, turns and leaps, tiring, side pressure, the current and the rod's stiffness, why a line breaks or a fish comes off, and the difficulty levels |
| `src/behaviour.js` | Fish as individuals (condition, weight, vigour, temper), what each kind likes (current, rough water, bright light, disturbance, how jumpy it is), its mood in the water it's in, why it turned away, and the Fish behaviour levels |
| `src/world/brasa.js` | Las Brasas, far to the south: the island's shape (heights, the harbour, the beach, the sebadal, the drop-off), its waters, its current, its seabed's weed and rock, and its places |
| `src/world/brasaWorld.js` | What Las Brasas looks like: its ground's colours, and Puerto Brasa (quay, breakwater, village, church, Bar El Muelle), the lighthouse, the sea arch and the arches under the water, palms, scrub and pines, boulders and urchins, the little boats |
| `src/southFish.js` | Las Brasas' fish: which of the home coast's live there too, and the island's own species |
| `src/fishline.js` | The fishing line between the rod tip and the rig or fish: a string of points that hangs, blows in the wind, lies on the water and drifts with the current, and comes straight under load |
| `src/offline.js` | Registers the service worker, reports when the game is ready offline, watches the connection, and applies updates safely |
| `sw.js` | The service worker: stores every game file for offline play, one cache per version |
| `tools/build-sw.mjs` | Writes the file list and version into `sw.js` (`--check` reports if it's out of date) |
| `vercel.json` | Runs `tools/build-sw.mjs` on every Vercel deploy |
| `src/fish.js` | The species list (the first species here, the Atlantic roster appended from `atlantic.js`), weights, models and journal sketches |
| `src/anatomy.js` | Anatomical models of the reference species: body plans for fish, flatfish and cuttlefish, fins, eyes, painted skins, and the swimming motion |
| `src/register.js` | The Atlantic species register: regions, statuses, what the game has done with each species, the expansion batches, the fictional originals and their proposed replacements |
| `src/registerData.js` | The register's researched entries (generated by `tools/build-register.mjs` from `research/register/`) |
| `src/guide.js` | The field guide: the index, the species pages, recommended setups worked out from the tackle rules, habits read from the simulation, and the trip planner |
| `src/trip.js` | Fishing trips: suitable waters for a species (from the map's habitat data), starting, summarising and ending a trip |
| `src/advice.js` | Why nothing is biting: what the simulation makes of the rig in the water, most telling reason first |
| `src/atlantic.js` | The Atlantic roster added in *The Living Atlantic*: where each species lives, how it behaves, what it eats and how it takes it |
| `src/anatomyAtlantic.js` | The anatomical recipes for those species (and the upgraded first ones) |
| `src/habits.js` | The hours fish keep (day, dusk, night), shared by the species definitions |
| `src/world/conditions.js` | Wind (with gusts and shelter), swell and wind chop, currents (with zones ready for a tide), the shelter map, and the words and units for them |
| `research/register/` | The species research, as JSON, with every source |
| `tools/build-register.mjs` | Compiles the research into `src/registerData.js` (`--check` reports if it's out of date) |
| `src/pack.js` | The backpack: the equipment browser, the selected piece with its compatibility checks, and your setup as rigged |
| `src/gearArt.js` | Models of every rod (with its reel), line spool, float, rig, leader, bait, lure, fly and squid jig, built from the tackle data by id |
| `src/gearView.js` | The backpack's studio: one small renderer that makes cached thumbnails and the turnable preview |
| `src/camp.js` | The camp sheet: the fire, grill or stove, food and hunger, sleep, your own camp's controls (name, tent, lantern, decorations, its camping gear, moving and packing up), and home's kitchen and bed |
| `src/outing.js` | Going out, as plain rules: where every piece of outing gear is (backpack, car, garage, camp) and moving it without copies, the boot's room, loadouts, the destinations, suggestions from the field guide, the check before you leave, and what lives where you're going |
| `src/workbench.js` | The workbench's planning sheet, and the smaller sheet for the car's boot, the camping shelf, the wall at home and "where to?" |
| `src/car.js` | The car: its model (boot, cargo, lights, dashboard), driving (throttle, brakes, steering, slopes), what stops it, and putting it back on the lane |
| `src/world/home.js` | The cottage and the garage (walls you walk between, doors that open, the roof that lifts away), the rod rack, camping shelf and wall that show what's really there, the workbench's map, the gravel lanes and car parks |
| `src/campsite.js` | Your own camps as plain rules: the kit, the footprint, where a camp may go (and why not), finding a spot nearby, storage, packing up, moving, cooking, and checking saved camps |
| `src/siteWorld.js` | What those rules ask of the world (ground, water, paths, obstacles, doorways and keep-clear areas), from the terrain and the obstacle grid |
| `src/campView.js` | Your camp in 3D: the tent with its fly sheet moving in the wind, the furniture and decorations, the lantern light, and the placement outline |
| `src/placement.js` | Choosing where to pitch: the outline following the ground, turning and nudging, and the panel |
| `src/world/coast.js` | Willowhaven (quay, slipway, cottages, chandlery, notice board, bench, lamp), the punt and heron, Cove Head and its daymark, Shell Strand's shelter, and the Kittiwake and her buoy |
| `src/harbour.js` | The notice board's contents, read from the conditions, the ecosystem and the gulls |
| `src/adventures.js` | The adventures, Ada's pages and the keepsakes, and how steps are recognised in any order |
| `src/photos.js` | Taking photographs, the album's picture store (IndexedDB), and downloads |
| `src/memories.js` | The journal's Memories pages |
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
| `src/quality.js` | Graphics presets (Low to Cinematic), the individual graphics options, and the frame-rate watcher behind Auto |
| `src/dive.js` | Diving's rules: a held breath and the turn mark, a tank of air and the reserve, safety stops, what may be speared, how a shot meets a fish, how fish take to a diver |
| `src/diver.js` | You in the water: swimming where you look, fins, buoyancy, the current, the diver's figure, the speargun and its shaft on its line |
| `src/post.js` | The finishing pass of Ultra and Cinematic: glow, sun shafts, the hour's colour grade and the vignette |
| `tools/fightsim.mjs`, `tools/ecosim.mjs` | Headless tuning tools for the fight and the ecosystem (see [Tests](#tests)) |
| `vendor/three/` | three.js r160 (MIT licence) |
| `assets/` | Fonts (SIL Open Font License), icons, and the link-preview image |

## Making it your own

- **Add a fish**: research it into `research/register/` and run `node tools/build-register.mjs`, then add an entry to `FISH` in `src/fish.js` with the same id and mark it in `GAME` in `src/register.js`. Its `life` block says where it lives (`homes`, `zones`, `depth`), how it moves, when it is active, how it likes a bait to move, and how cautious it is; `food` says which baits, lures and flies it takes and how keenly; `strike` says how it takes them; `mouth` and `pull` set what size of lure it can manage and how hard it fights. The ecosystem spawns it, and the journal, catch card, 3D model and fish finder pick it up automatically.
- **Add tackle**: add an entry to `TACKLE` in `src/tackle.js` (a bait, lure or fly), give it a model in `src/tackleModels.js`, and add it to the `food` of the fish that should like it. Rods live in `RODS`.
- **More or fewer fish**: `schools`/`members` and `groups`/`group` in each species' `life`, or `fishDensity` in `src/quality.js`.
- **Change the length of a day**: `HOUR_SECONDS` in `src/main.js` (40 real seconds per in-game hour by default).
- **Retune the light**: the `KEYS` table at the top of `src/world/sky.js` sets sky, sun and ambient colours for each part of the day.
- **Reshape the land**: `landSDF` in `src/world/terrain.js`; the lake (`LAKE`), stream (`STREAM`), camp (`CAMP`), path (`PATH`), Longmere (`MERE`), Gannet Isle (`GANNET`) and the rest are constants near the top.
- **Add a boat**: add a hull to `HULLS` in `src/boat.js` (shape, seat, how it moves) and its mooring in `mooring()` in `src/main.js`.
- **Change what's saved**: add the field to `DEFAULT_STATE` and `sanitize` in `src/save.js`. If an old save needs converting, raise `SAVE_VERSION` and add a step to `MIGRATIONS`.
- **Add an adventure**: add an entry to `ADVENTURES` in `src/adventures.js` (a clue, steps with an optional `check` against the game, an ending and a reward). Steps the world settles by itself are checked twice a second; others are recorded where they happen. A notice-board adventure appears on the board by itself.
- **Add a camp decoration**: add it to `DECOR` in `src/campsite.js` and give it a model in `furnitureParts` in `src/campView.js`.
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
slowTide.setGraphics('low')   // auto, cinematic, ultra, high, medium or low
slowTide.diving.start('free') // go diving from here ('free' or 'scuba'), if there's deep water by you
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
- Everything else, including the sound and music and every model and texture, is generated by the code in `src/`. That includes everything added in *Life on the coast* and *Home & the garage* (the cottage, the garage and everything in it, the estate car, the gravel lanes, the door, boot and engine sounds, and the workbench's maps, all made by the code): Willowhaven's buildings, quay and signs, the daymark, the Kittiwake and her buoy, the tent, furniture and decorations, the notice board's paper, and the new sounds (stove, footsteps on sand, stone and wood, the camera shutter, curlews, the swell on the headland). The adventures, Ada's pages and the notices are original writing. No outside assets were used.
- Species facts in the register come from the sources listed in each entry (FishBase, SeaLifeBase, DORIS, WoRMS, regional checklists, papers and official documents); the game quotes facts and names, not their text or images.

## Ideas for next steps

The journal hints at a softer cushion, a potted fern on the bow, and a little cabin by the lake. Other natural next steps: carrying the brass lantern when you walk at night, tides that cover and uncover the estuary flats (and Shell Strand), a second camping kit, diving on the Kittiwake, a boat trailer for the car, a road you can drive to Wend Quay, cooking and resting at the far camps as at home, simple upgrades for the motorboats, and seasons that change which fish are about. For the sea, see the [expansion plan](#expansion-plan).
