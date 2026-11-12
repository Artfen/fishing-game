# Slow Tide: performance

How the game's performance is measured, what it's aiming for, and the numbers so far. Kept so
that every optimisation is judged by measurement, not by how advanced it sounds.

## Two harnesses, one set of scenarios

The scenarios live in `src/bench.js`, each set up the same way every time: where you are, in
what boat, at what hour, in what weather.

| Scenario | What it loads |
| --- | --- |
| `harbour` | Willowhaven on foot: the marina, its boats and townsfolk, the quay |
| `harbour_off` | A hundred metres off Willowhaven in the skiff, looking in: many vessels at a distance |
| `rib_rough` | The RIB flat out in a lively sea: the ocean, spray, wakes, the hull in waves |
| `storm` | The RIB in a gale off the Calf: storm sky, rain, a rough sea |
| `shoal` | Beside the biggest school of fish: the fish simulation and its drawing |
| `wildlife` | Near a dolphin pod in the RIB |
| `sonar` | Fishing with the electronics: the RIB's dashboard and fish finder in first person |
| `underwater` | Diving the wreck |
| `dive_reef` | Diving Skerries Reef |
| `dive_brasas` | Diving the arches at Las Brasas (the southern region loaded) |
| `voyage` | The crossing south, under way at the yacht's helm |

Each is measured the same way: the **simulation alone** (240 steps at 30 Hz, nothing drawn: mean
and worst 1%), a frame's **draw calls and triangles**, **real frames** running free for at least
six seconds (mean FPS and the 1% low, from the 99th-percentile frame time), the **graphics card's
time** per frame where the browser allows it, and the **heap**.

1. **`tools/perf.mjs`**: a headless browser on a development machine, for before-and-after on every
   change (`PLAYWRIGHT=… node tools/perf.mjs http://127.0.0.1:8642/ [scenario…]`). In the cloud
   development environment that machine has no graphics card (software rendering): **its frame
   rates are not a real computer's and must never be quoted as one**. The simulation's milliseconds
   (CPU work), draw calls and triangles carry over; compare its runs with each other only.
2. **`bench.html`**: the same scenarios in **your own browser, on your own computer and graphics
   card**: the numbers that matter. Open `bench.html` from the game's site (or from a local copy:
   `python3 serve.py`, then `http://localhost:8642/bench.html`), choose a graphics preset and the
   scenarios, and run. Each scenario reloads the game with `?bench=<scenario>`, which plays in a
   save of its own (`slow-tide-bench`: see `src/save.js`) and never signs in, so **your game and
   your save are never read or written**. The results stay in that browser until you copy them
   (the "Copy the results" button gives JSON, with the graphics card's name, window size and pixel
   ratio, for a report). About half a minute a scenario.

For comparable numbers on real hardware: a maximised window on a 1920×1080 screen (or note the
size), a laptop on mains power, other tabs closed, the window in front for the whole run. GPU time
needs WebGL 2's `EXT_disjoint_timer_query_webgl2` (Chrome and Edge on most desktops; not Safari or
Firefox by default): where it's missing the column reads "–". The heap needs Chrome's
`performance.memory`.

## Targets (provisional)

Targets, not measurements or guarantees. They are what the work in this stage is judged against,
once real hardware has been measured with `bench.html`:

| Machine | Settings | Target | Healthy 1% low | Headroom |
| --- | --- | --- | --- | --- |
| **Mid-range gaming**: a desktop or gaming laptop with a GeForce GTX 1660 Super / RTX 3050 or Radeon RX 6600 class graphics card, a 6-core CPU of 2019 or later, 16 GB | 1080p, Medium or High | 60 FPS | about 45 FPS | about 20 % of the frame time spare in ordinary play (13.3 of 16.7 ms) |
| **Lower-end supported laptop**: integrated graphics of the Intel Iris Xe or AMD Radeon 680M class, a 4-core CPU, 8 GB | 1080p or the laptop's screen, Low | 30 FPS | about 24 FPS | about 20 % spare (26.7 of 33.3 ms) |

Ultra and Cinematic stay optional and expensive, but may not do needless work. Per-system budgets
(simulation, ocean, shadows, reflection…) are set once real-hardware profiles say where the time
goes, not before.

## Baseline: the development machine (software rendering)

Low preset, 800×450, in the cloud development container, November 2026, after the fleet rebuild
(A1–A5). **Software rendering: frame rates omitted as meaningless.** Some of these runs shared the
machine with the test suite, so the simulation's milliseconds are high and noisy (± 2–3 ms run to
run); they're for comparison with later runs here, not a statement about any real computer.

| Scenario | Sim ms (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| harbour | 14.7 · 22.7 | 350 | 1,281,615 | 228 MB |
| harbour_off | 14.3 · 24.0 | 534 | 1,332,946 | 228 MB |
| rib_rough | 14.0 · 31.5 | 148 | 206,392 | 228 MB |
| storm | 18.2 · 34.1 | 137 | 708,611 | 228 MB |
| shoal | 14.9 · 36.7 | 85 | 241,958 | 228 MB |
| wildlife | 13.2 · 28.1 | 109 | 224,384 | 228 MB |
| sonar | 15.3 · 32.4 | 363 | 962,957 | 228 MB |
| underwater | 10.4 · 20.4 | 292 | 906,267 | 228 MB |
| dive_reef | 14.3 · 23.7 | 263 | 689,561 | 228 MB |
| dive_brasas | 9.8 · 16.6 | 167 | 1,141,802 | 257 MB |
| voyage | 15.0 · 20.9 | 156 | 424,826 | 228 MB |

What stands out already, to be confirmed on real hardware before anything is changed for it:
draw calls are highest looking at many boats or the harbour (`harbour_off` 534 after the fleet's
distance culling took it from 719, `sonar` 363 with the dashboard's controls), triangles highest in
the harbour and at Las Brasas (over a million), and the storm's simulation the dearest.

## A long session: the soak (`tools/soak.mjs`)

An hour of varied play run through the game's own clock in a headless browser, sampled after
every lap (a garbage collection first): the JS heap; the geometries, textures and shader programs
the renderer holds; the distinct geometries the scene itself has; its objects; the page's
elements. A lap is about six minutes of the game's time: ashore in Willowhaven, the RIB flat out
round the bay, a dive on the wreck, south to Las Brasas and a dive on its arches, home under way;
the hours moving on four at a time (day and night), a storm every third lap.
`PLAYWRIGHT=… node tools/soak.mjs http://127.0.0.1:8642/ [laps=10]`; about three minutes a lap here.

What counts as a leak: the heap, the scene's objects or the scene's own geometries rising every
lap, or the renderer holding more geometries than the scene has. The renderer uploads a geometry
the first time it draws it, so its count climbs for a while as play reaches more of the world
(other hours and weather, folk walking into view, other dive sites); that's bounded by what the
scene has and isn't a leak.

**November 2026, eight laps (about fifty minutes of the game's time), Low preset:**

| | Lap 2 | Lap 8 | Per lap |
| --- | --- | --- | --- |
| Heap | 271.8 MB | 276.1 MB | +0.7 MB (most of it the two storm laps; flat otherwise) |
| Geometries the renderer holds | 1,131 | 1,284 | +25, slowing (+93 in the first storm, then +6 to +20) |
| Textures | 160 | 167 | +1 |
| Shader programs | 188 | 203 | +2.5 (the second storm's, then flat) |
| Objects in the scene | 13,630 | 13,648 | +3 |
| Page elements | 819 | 819 | 0 |
| Page errors | 0 | 0 | |

The renderer's geometries were followed up leg by leg (each leg of play repeated three times, every
geometry made tagged with where it was made, freed or not, and checked against the scene): the
scene had 7,245 distinct geometries throughout and the renderer had uploaded 589 to 715 of them;
nothing was made and left behind (none outside the scene and not freed), and almost nothing was
made at all during play (four or five). The climb is the world being drawn for the first time,
bounded by what it has: **no leak found**. The heap is steady too.

## Not yet covered

- **Two players**: the render and simulation cost of a friend's boat and figure is in every
  scenario with townsfolk boats; the network traffic of a shared session is measured by
  `tools/netbudget.mjs`. A two-client benchmark needs a second browser joined to the same session:
  a later step.
- **Long sessions on real hardware**: the soak measures what the game holds on to, which doesn't
  depend on the graphics card; frame time over an hour and garbage-collection pauses need a real
  machine (a long `bench.html` run is the next step).
- **Real-hardware results**: to be added here from `bench.html` runs on the two reference machines
  above.
