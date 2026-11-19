# Slow Tide: the world extended

Step 4 of the roadmap's "A liveaboard, her tender and two archipelagos" (`ROADMAP.md`): the world
grown to three seas a long way apart (home, Las Brasas nine kilometres to the south across the
open Atlantic, the Selkie Isles nine up the coast to the north) has to stay light to carry about,
quick to sail across, and right however far out you go; and the game is to be offered as a
download from its own site as well as played in the browser.

The north was built with the parts of this it needed (`docs/NORTH.md`, N1): its terrain in tiles
built as you come near and dropped as you go, its water map and sea baked a slice at a time ahead
of need, its charts, its coordinates kept within range. What's left:

## What there is now

- **Everything you've been to stays built.** Las Brasas' buildings, plants, reef and wreck
  (`brasaWorld.js`), its weed beds, its detailed terrain patches and its water maps are made the
  first time you go and kept for the rest of the session; the north's things, kelp, patches and
  water maps the same. Visit all three seas and the game holds all three: about 30 to 45 MB of heap
  each beyond home's, and their meshes in the scene (hidden by distance, but there).
- **The passage is sailed in real time or skipped.** The fast passage jumps to the far side (the
  hours, the fuel); at the helm it's twenty-five minutes to Las Brasas, forty up the coast. Holding
  T lets the clock drift on, but the boat doesn't go any faster for it.
- **Far coordinates:** the south reaches z 7,400 and the north x -4,700, z -8,000. The shaders'
  noise works on absolute position; below about 12.4 km from the origin it keeps the same precision
  as at home (`docs/NORTH.md`, N1, and the survey behind it). Nothing checks that it stays so.
- **The desktop app** (`desktop/`, stage 8): an Electron window serving the game's own files, the
  save mirrored to a file, achievements ready for Steam. No installers are built, nothing updates
  it, and nothing on the site offers it.

## The plan

**W1, regions dropped as you go (and built again as you come).** When you're far from a sea (more
than four kilometres from its edge), its things are taken out of the scene and freed: Las Brasas'
buildings, plants, reef and wreck, its weed beds, its detailed terrain patches, its water maps and
sea field; the north's things, kelp, patches, water maps and field. Coming back, they're made
again as they were the first time (the same dice: the same plants in the same places), a slice at
a time where they can be. Walkers' obstacles and the coast's fishing spots come and go with them.
Measured: the heap after a lap of all three seas, with and without.

*W1 done.* Four kilometres and more from a sea, its things go: Las Brasas' buildings, plants, reef
and wreck, the north's (`world.js` `dropBrasa`, `dropNorth`), the detail of every patch out there
(home's fell included, when you're away), their weed beds and kelp (`underwater.js` `removeBed`),
their water maps and their sea's fields (`conditions.js` `dropShelter`). Obstacles, fishing spots
and boxes are taken back out with them (`ObstacleGrid.remove`). Coming back, they're made again from
the same seed, the same things in the same places (tested), the patches and the north's things a
slice at a time as before. Measured over a lap (home, Las Brasas, the north, home, Las Brasas,
home), low preset, headless: the heap ended at 332 MB before, holding all three seas; now 260 MB,
the same after the second lap as the first (nothing kept, nothing leaking), and the scene's objects
back to home's count. (The 20 MB over the very first visit home stays put lap to lap: what's
learned and kept along the way, the shaders and the fish's own state among it.)

**W2, the passage speed-up.** At the helm on passage (the crossing to Las Brasas or home, or the
run up the coast or back), under way on the autopilot (or sailing), in open water clear of the
land: a tap of T runs the world four times as fast, the boat with it (four steps of the world each
frame, nothing skipped: the physics, the sea, the wind and what's met along the way all happen),
until a second tap, or until anything wants you: land or the shallows ahead, another boat near,
a fish on, something met along the way, the weather turning, the boat stopping. The HUD says so.
Not while playing together (the time is the host's).

*W2 done.* A tap of T (`main.js` `toggleFast`) when it may (`fastWhy`): in a boat under way, on her
autopilot or under sail, on a long run (the crossing, the coast north or back, or out at a far sea),
with no land within 120 m nor land or shallows within 380 m ahead, no other boat within 150 m, no
line out, no water in her, no gale, not playing together. Then each frame runs four whole steps of
the world (the frame loop keeps the game's time ahead of the wall clock), so the voyage goes four
times as fast and everything on it happens as it would. Checked twice a second: it drops back to
normal time, and says why, for anything on that list, and for anything met along the way on the
crossing; a second tap ends it. The frame-rate watcher leaves those heavier frames alone (four steps
a frame aren't a slow computer). Played in the browser on the crossing in the trawler: four times
the distance and four times the game's hours in the same real seconds; back to normal time when
she stopped; refused off the Ness with the land ahead.

**W3, far coordinates kept in range, and the whole chart.** A test that every sea, its tiles and
its charts lie within the range where the shaders keep home's precision; and a chart of the whole
world (home, the crossing, Las Brasas, the coast north and the isles) to see where everything is,
from the map.

*W3 done.* `tests/worldextended.test.mjs` holds every sea's bounds, the north's tiles and every chart
within 12.4 km of the middle, where the water's finest noise (about 5.3 times the absolute
position, in 32-bit floats) keeps home's precision, and a vertex out there still resolves to a
millimetre; the furthest corner of anything is the whole chart's, at 9.4 km. **The whole chart**
(`map.js` `WORLD_SHEET`): Willow Bay, the crossing and Las Brasas, the coast north and the isles on
one sheet, all charted, drawn from the land itself (30 m a pixel), the crossing and the way up the
coast dashed on it; the ◫ button by the zoom opens it whole, and again goes back to the sheet
you're on.

**W4, the downloadable build.** The desktop app made into something to download from the site:
- **Installers** for Windows (an NSIS installer), macOS (a DMG, Intel and Apple silicon) and Linux
  (an AppImage), made by `electron-builder` from the same game files (`desktop/pack.cjs`).
- **Built by CI** when a version is tagged (`.github/workflows/desktop.yml`), on each platform's
  own runner, the installers attached to a GitHub release. **Code signing and notarisation** come
  from the repository's secrets when they're set (a Windows certificate; an Apple Developer ID and
  notarisation password); without them the installers are built unsigned and say so.
- **Updates:** the app checks the release feed when it starts and offers the new version (not
  while you're playing a crossing: it asks, it doesn't restart on you). Off with a setting.
- **The download page** on the game's site (`download.html`): which installer for which computer,
  what signing means for the first launch, where saves go, and the browser version beside it.
- **Saves as files:** the app already mirrors the save to a file; the page says where, and the
  app's menu opens that folder.
- Verified here as far as a container can: the Linux AppImage built and started headless; the
  others by the CI on their own runners.

*W4 done.* **Installers** (`desktop/package.json`, electron-builder 26.18): an NSIS installer for
Windows (x64, choose where it goes), a DMG for each Mac (Apple silicon and Intel, with the zips a
Mac updates from), an AppImage for Linux, all from the same game files `pack.cjs` copies in, named
as the download page links them. Electron moves from 33 (no longer supported) to 44.10. **CI**
(`.github/workflows/desktop.yml`): on a `v…` tag, each platform on its own runner, the version
taken from the tag, then one release with every installer, blockmap and `latest*.yml`; by hand, the
installers kept as artifacts. Signing and notarisation from the repository's secrets when they're
there; without, unsigned (the Mac app ad hoc, so Apple silicon opens it), and the release notes say
which. **Updates** (`desktop/updates.cjs`): twenty seconds after the installed app starts it reads
the newest release's feed, brings a newer version down and checks it, and says so on the same
Update button as the web version's (`src/offline.js`): "Restart into the new version", never
restarting by itself, installing on quit if not taken. Off with a switch in the journal (and the
Mac menu), kept in `settings.json`. An unsigned Mac copy can't replace itself (macOS checks the new
app's signature against the old), so there it only says a new version is out and Update opens the
download page. **The download page** (`download.html`): the installer for the computer it's opened
on put first (a Mac's chip from what the browser says), all four below, what the first launch
asks of an unsigned copy, where saves go, updates, and the browser version; the game's title
screen links to it (not in the app). **Saves**: the folder is now named for the game ("Slow Tide",
the app's product name; nothing had been installed under the old name), and the journal's *Open the
saves folder* opens it. Two changes from the plan: Windows and Linux get no menu bar at all (Alt
would bring one up mid-game, and Electron's default one reloads the page on Ctrl+R), so the saves
folder and the updates switch are in the journal on every system and in the menu on a Mac; and the
app no longer registers the web version's service worker, there being no offline copy to keep.
Tested (`tests/desktopbuild.test.mjs`): the updater against a stand-in feed (looks only once
started and switched on, downloads and waits, installs only when told, says offline or error as
they are, an unsigned Mac sent to the page, never a feed from elsewhere), the page's side of it, the
saves folder, and the installers' names, the workflow and the download page agreeing. **Built and
run here**: the Linux AppImage (128 MB) started headless under Xvfb, the game came up in it from
its own files, began, and wrote its save file; then, with a 0.1.1 build served as a stand-in feed,
0.1.0 found it, downloaded and checked it, showed "Restart to update" on the title screen, and on
Update replaced its own AppImage with 0.1.1 and started again. (Against the real feed it reached
GitHub but this container's proxy certificate stopped it, as it would any app here.)

## Done when

- A lap of all three seas ends with the heap where a visit to one leaves it, and every sea comes
  back the same when you return (tests: the things rebuilt identical; obstacles and spots not
  doubled).
- On passage, T fast-forwards the voyage four times, stops by itself for anything that matters,
  and the crossing arrives the same as at normal speed (tested headless).
- The far-coordinates test, and the whole chart.
- The desktop installers' configuration, the CI workflow, the updater (tested with a stand-in
  feed), the download page; the Linux build made and started here.
