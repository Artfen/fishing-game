# Slow Tide

**Play it: <https://artfen.github.io/fishing-game/>**

A small, peaceful fishing and wandering game that runs in the browser. You row a little wooden boat around Willow Bay, find a hidden cove, fish as the light changes, and keep a handwritten journal.

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

On a phone or tablet the controls appear on screen: drag on the **left** half to row (the stick appears under your thumb), drag on the **right** half to look around and pinch to zoom. The round button on the right does everything fishing: hold and let go to cast, tap when the bobber dips, hold to reel. Its label tells you what it will do next. The hourglass at the top lets time drift while you hold it, and the journal button opens the journal.

With a keyboard:

| Key | Does |
| --- | --- |
| W A S D or arrows | Row (W forward, S back, A/D turn; turning works on the spot too) |
| Drag / scroll | Look around / zoom |
| Space (hold, release) | Cast. Hold longer to cast further; drag while holding to aim |
| Space when the bobber dips | Set the hook |
| Space (hold) | Reel in. Let go while the fish pulls, then hold again |
| Space (tap while waiting) | Twitch the line, which tempts a fish a little sooner |
| Space (hold while waiting) | Reel the line back in |
| E | Look closer (when a prompt appears) |
| J or Tab | Journal |
| T (hold) | Let time drift by quickly |
| M / H | Music on or off / hide the interface |
| Esc | Reel in the line, close the journal |

Nothing can go wrong. A missed bite just means another will come, and straining the line only costs a little progress.

### What's out there

- **Sunperch**: the sunny shallows of Willow Bay, by day.
- **Drizzlefin**: open water past the bay mouth, mostly when it rains. Rain comes and goes on its own every few minutes (hold T to hurry it along).
- **Duskfin**: Driftwood Cove after sundown. It likes warm light.
- **Driftwood Cove** is tucked behind the eastern headland. Row out of the bay mouth, turn east along the coast, and look for a narrow channel heading north. Something glints on the beach.
- **Gull Rock** stands in the open sea south-west of the bay mouth. The **Old Jetty** is on the little island.

Progress (journal, places, keepsakes, time of day, boat position) saves to your browser's local storage.

### Graphics

The journal's **Settings** (and the title screen) has a Graphics button: **Auto**, **High**, **Medium** or **Low**. Auto starts at High on computers and Medium on phones and tablets, then steps down by itself if the game runs below about 42 frames a second. Lower settings render at a lower resolution, use a simpler water surface and fewer raindrops, and Low turns off shadows.

## Where things live

| File | What it holds |
| --- | --- |
| `src/main.js` | Game loop, camera, time of day, weather, discoveries, glue between systems |
| `src/world/terrain.js` | The map. One height function shapes the bay, island, cove and channel. Places and zones live here |
| `src/world/world.js` | Everything built on the map: terrain mesh, trees, rocks, jetty, cove props, Gull Rock, gulls, fireflies |
| `src/world/water.js` | Water shader (depth colour, foam, rain rings, lantern glow) and the wave function the boat floats on |
| `src/world/sky.js` | Day cycle colours, sun and moon, sky dome, clouds |
| `src/boat.js` | The boat, the rower, oars, rod and lantern; rowing physics and collisions |
| `src/fishing.js` | The fishing loop: cast, nibble, bite, reel, land, release |
| `src/fish.js` | Fish data (where and when they bite), 3D models, journal sketches |
| `src/journal.js` | The journal pages and hand-drawn map |
| `src/audio.js` | All sound, synthesised live: water, wind, rain, birds, crickets, and the generative music |
| `src/effects.js` | Ripples, splashes, the wake, leaping fish |
| `src/touch.js` | On-screen controls for phones and tablets |
| `src/quality.js` | Graphics presets and the frame-rate watcher behind Auto |
| `vendor/three/` | three.js r160 (MIT licence) |
| `assets/` | Fonts (SIL Open Font License), icons, and the link-preview image |

## Making it your own

- **Add a fish**: add an entry to `FISH` in `src/fish.js`. Its `weight(ctx)` function decides where and when it bites (`ctx` has `zone`, `hour`, `rain`, `lantern`, `depth`). The journal, catch card and 3D model pick it up automatically.
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
```

## Credits

- [three.js](https://threejs.org) r160, MIT licence (`vendor/three/LICENSE`).
- Fonts: Caveat, Kalam and Nunito, SIL Open Font License 1.1 (`assets/fonts/OFL-*.txt`).
- Everything else, including the sound and music, is generated by the code in `src/`.

## Ideas for next steps

The journal already hints at these: a softer cushion, a better rod (a longer cast or a calmer reel), a potted fern on the bow, and eventually a little cabin on the island next to the jetty. A gentle way to earn them is through the journal: every new fish or place unlocks the next comfort.
