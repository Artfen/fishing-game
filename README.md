# Slow Tide

**Play it: <https://artfen.github.io/fishing-game/>**

A small, peaceful fishing and wandering game that runs in the browser. You row a little wooden boat around Willow Bay, find a hidden cove, fish as the light changes, and keep a handwritten journal.

The water is a living place: weed beds, rocks, sandy shallows and deep water, home to around 300 fish that school, cruise, feed, rest by cover and scatter when startled. Rings, flashes and jumps on the surface come from real fish below. You can look underwater, follow your bait, and use a small fish finder. The fish that takes your bait is one you could have watched swimming there.

It's a static website: plain JavaScript modules, no build step, and no server code. Everything it needs ships in this folder, including [three.js](https://threejs.org) and the fonts, so it makes no requests to other sites and also works offline.

## Run it

```bash
python3 serve.py
```

Then open <http://localhost:8642>. `serve.py` is a tiny static server with caching turned off, so a browser refresh always picks up your edits. Any static server works too.

## Put it online

Upload these files and folders to any static host, keeping the layout as it is:

```
index.html  style.css  manifest.webmanifest  src/  vendor/  assets/
```

`serve.py`, `README.md` and `.claude/` are for working locally and don't need to go up. Some easy hosts:

- **Netlify Drop** (app.netlify.com/drop) or **Cloudflare Pages**: drag the folder in and you get a web address within a minute. You can add your own domain later.
- **GitHub Pages** (what this repository uses): every push to `main` republishes the site within a minute or two. Pages is set to deploy from the `main` branch, root folder.
- **itch.io**: make a zip, create a project with *Kind of project: HTML*, upload the zip and tick *This file will be played in the browser*. Ticking *Mobile friendly* and adding the fullscreen button both suit this game.

```bash
zip -r slow-tide.zip index.html style.css manifest.webmanifest src vendor assets
```

**Link previews:** the `og:url` and `og:image` lines in `index.html` point at the GitHub Pages address. If you move the game to another site, change them to the new full address; most social sites ignore relative image paths.

**Privacy:** the game loads nothing from other sites, uses no cookies and no analytics. Progress is kept in the player's own browser (local storage) and never leaves their device.

## How to play

With a keyboard and mouse:

| Key | Does |
| --- | --- |
| W A S D or arrows | Row (W forward, S back, A/D turn; turning works on the spot too) |
| Drag / scroll | Look around / zoom (in every view) |
| Space (hold) | Start aiming. A dotted arc and a ring on the water show where the float will land |
| A / D while aiming | Swing the cast left or right, independent of the boat |
| Hold longer | A longer cast (4 to 24 m); the distance shows in the ring by the boat |
| Release Space | Cast |
| Esc or right-click while aiming | Put the cast down without casting |
| W / S with the bait out | Bait shallower / deeper (the bait panel shows bait depth and the bottom) |
| Space (tap) with the bait out | Twitch the bait |
| Space (hold) with the bait out | Reel in: slowly at first, then steadily. Moving bait tempts some fish more than others |
| Space when the float goes under | Set the hook. You have about two and a half seconds |
| Space (hold) while a fish is on | Reel. Let go while it pulls, then hold again |
| C | Next view: boat → underwater → watching your bait |
| R | Back to the boat view |
| F | Fish finder on or off |
| E | Look closer (when a prompt appears) |
| J or Tab | Journal (with settings: graphics and volumes) |
| T (hold) | Let time drift by quickly |
| M / H | Music on or off / hide the interface |
| Esc | Reel in the line, leave the underwater view, close the journal |

On a phone or tablet the controls appear on screen. Drag on the **left** half to row (a stick appears under your thumb), drag on the **right** half to look around, and pinch to zoom. The round button on the right does all the fishing: hold to aim and let go to cast, tap when the float goes under, hold to reel. Its label tells you what it will do next. While aiming, the stick swings the cast and sets bait depth, and a small ✕ cancels. The eye button switches views, the sonar button shows the fish finder, and the hourglass lets time drift while you hold it.

Nothing can go wrong. A missed bite just means another will come, and straining the line only costs a little progress.

### Reading the water

- **Rings** spreading on calm water: a fish rising to feed just below.
- **Nervous water**, many small dimples together: a school of Glassminnows near the surface.
- **A flash**: a fish turning in the light just under the surface.
- **A splash**: something jumped.

Each of these comes from a real fish at that spot. Press **C** to look underwater and you'll find it there. Fish gather around weed beds and rocks, with quieter open sand between.

When your bait is in the water, the bait panel tells you what is happening: *Something is curious…* when a fish comes to look, *Nibbling…* while it tests the bait (the float dips), and *Bite!* when the float goes right under. A boat rowing fast overhead, or a cast landing right on top of fish, sends them off for a moment.

### The fish finder

Press **F** for a small sonar screen. The right edge, marked *now*, is the water straight under the boat; older readings slide to the left. It shows the real bottom (brighter over rock), weed beds in green, fish as amber marks at their actual depth (bigger fish, bigger marks), and your bait as a coral diamond when it's under the boat. It only sees what is inside its cone beneath you.

### What's out there

- **Glassminnow**: schools over shallow sand and weed edges in the bay and cove, by day. A shallow, still bait.
- **Sunperch**: around weed beds and rocks in Willow Bay, by day. The jetty is a good start.
- **Drizzlefin**: open water past the bay mouth. On dry days it cruises deep; in the rain it rises near the surface and feeds. Rain comes and goes on its own every few minutes (hold T to hurry it along). It likes a moving bait.
- **Duskfin**: Driftwood Cove. It rests deep by day and drifts up after sundown, towards warm light.
- **Mossback**: large and slow, by the deepest rocks in the bay and around Gull Rock. It keeps to the bottom and only takes a bait lowered right down near it (use W/S and watch the bait panel).
- **Driftwood Cove** is tucked behind the eastern headland. Row out of the bay mouth, turn east along the coast, and look for a narrow channel heading north. Something glints on the beach.
- **Gull Rock** stands in the open sea south-west of the bay mouth. The **Old Jetty** is on the little island.

Progress (journal, places, keepsakes, time of day, boat position) saves to your browser's local storage.

### Graphics

The journal's **Settings** (and the title screen) has a Graphics button: **Auto**, **High**, **Medium** or **Low**. Auto starts at High on computers and Medium on phones and tablets, then steps down by itself if the game runs below about 42 frames a second. Lower settings render at a lower resolution, use a simpler water surface and fewer raindrops, and also scale the underwater world: High has about 320 fish, 5,200 weed clumps, drifting particles and light shafts; Low keeps about 160 fish and a third of the weeds, with no light shafts, caustics or shadows. Settings also has separate **volume**, **nature & effects** and **music** sliders.

## Where things live

| File | What it holds |
| --- | --- |
| `src/main.js` | Game loop, time of day, weather, discoveries, surface clues, glue between systems |
| `src/world/habitat.js` | The underwater map shared by everything below the surface: depth, weed beds, rock piles, and the homes fish live around |
| `src/world/ecosystem.js` | Every fish in the world: schooling, cruising, feeding, resting, fleeing, rising and jumping, and how each one reacts to your bait. Fixed 30 Hz simulation, slower far away |
| `src/world/fishRender.js` | Draws the ecosystem's fish (one instanced draw per species) with a swimming tail wave |
| `src/world/underwater.js` | Weed beds, submerged rocks, particles, light shafts, bubbles, and the colour, haze and sound blend as the camera crosses the waterline |
| `src/world/caustics.js` | Dancing light on the seabed and rocks |
| `src/camera.js` | The three views (boat, underwater, bait), their limits and smooth transitions |
| `src/sonar.js` | The fish finder, reading the habitat and the ecosystem |
| `src/world/terrain.js` | The map. One height function shapes the bay, island, cove and channel. Places and zones live here |
| `src/world/world.js` | Everything built on the map: terrain mesh, trees, rocks, jetty, cove props, Gull Rock, gulls, fireflies |
| `src/world/water.js` | Water shader (depth colour, foam, rain rings, lantern glow) and the wave function the boat floats on |
| `src/world/sky.js` | Day cycle colours, sun and moon, sky dome, clouds |
| `src/boat.js` | The boat, the rower, oars, rod and lantern; rowing physics and collisions |
| `src/fishing.js` | Aiming and casting, the float and bait in the water, depth and retrieve, hooking, the fight, landing and releasing |
| `src/fish.js` | The five species (where they live, how they behave, what bait they like), 3D models, journal sketches |
| `src/journal.js` | The journal pages and hand-drawn map |
| `src/audio.js` | All sound, synthesised live: water, wind, rain, birds, crickets, and the generative music |
| `src/effects.js` | Ripples, splashes, flashes and the wake |
| `src/touch.js` | On-screen controls for phones and tablets |
| `src/quality.js` | Graphics presets and the frame-rate watcher behind Auto |
| `vendor/three/` | three.js r160 (MIT licence) |
| `assets/` | Fonts (SIL Open Font License), icons, and the link-preview image |

## Making it your own

- **Add a fish**: add an entry to `FISH` in `src/fish.js`. Its `life` block says where it lives (`homes`, `zones`, `depth`), how it moves (`speed`, `turn`, schooling or groups), when it is active, what bait movement it likes, and how cautious it is. The ecosystem spawns it, and the journal, catch card, 3D model and fish finder pick it up automatically.
- **More or fewer fish**: `schools`/`members` and `groups`/`group` in each species' `life`, or `fishDensity` in `src/quality.js`.
- **Change the length of a day**: `HOUR_SECONDS` in `src/main.js` (40 real seconds per in-game hour by default).
- **Retune the light**: the `KEYS` table at the top of `src/world/sky.js` sets sky, sun and ambient colours for each part of the day.
- **Reshape the bay**: `landSDF` in `src/world/terrain.js`. Positions of the island, cove, channel and stacks are constants at the top.
- **Add a discovery**: copy the lantern pattern in `src/main.js` (`lanternReach` and `takeLantern`) and its prop in `buildCove` in `src/world/world.js`.

The browser console has a small helper for tinkering:

```js
slowTide.setHour(19)       // jump to golden hour
slowTide.setRain(1)        // start rain (0 stops it)
slowTide.teleport(140, -16) // skip straight to the cove
slowTide.reset()           // forget all progress and start over
slowTide.advance(10)       // run the game forward 10 seconds (works even in a background tab)
slowTide.eco.agents        // every fish in the world, with its species, size, position and state
```

## Credits

- [three.js](https://threejs.org) r160, MIT licence (`vendor/three/LICENSE`).
- Fonts: Caveat, Kalam and Nunito, SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`).
- Everything else, including the sound and music, is generated by the code in `src/`.

## Ideas for next steps

The journal already hints at these: a softer cushion, a better rod (a longer cast or a calmer reel), a potted fern on the bow, and eventually a little cabin on the island next to the jetty. A gentle way to earn them is through the journal: every new fish or place unlocks the next comfort.
