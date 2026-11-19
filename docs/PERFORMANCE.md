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
| `liveaboard` | In the trawler's saloon at dusk, at anchor off Gannet Isle, her lamps lit, her interior built and her tender on its chocks |
| `tender` | The tender running in to the beach at Gannet Isle, the trawler at anchor behind her |
| `archipelago` | At anchor in Bahía Escondida, in the Las Brasas archipelago, mid-afternoon: Isla Honda and its salt works close by, the other islands in view |
| `north` | The trawler at anchor in Raven Sound off Halvig, up the coast in the Selkie Isles, mid-afternoon: the north's tiles, isles, life and water built round her |
| `dive_north` | Diving the Sula, the trawler wrecked in the kelp off Tern Isle |

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

The liveaboard's scenarios (L8 of `docs/LIVEABOARD.md`), measured the same way, November 2026, on
a quiet machine (the yacht's `voyage` measured alongside them for comparison: 9.5 ms, 156 draw
calls, against the 15.0 above taken under load):

| Scenario | Sim ms (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| liveaboard | 6.1 · 15.9 | 197 | 718,856 | 228 MB |
| tender | 9.7 · 22.9 | 130 | 367,703 | 228 MB |

Living aboard costs little: the trawler's interior is two meshes (built the first time her decks
are walked) and one light in the room you're in; the saloon at anchor is cheaper to simulate than
running at sea. The tender under way costs what a small boat does.

The Las Brasas archipelago (A4 of `docs/ARCHIPELAGO.md`), measured the same way, November 2026,
quiet machine; `dive_brasas` before the archipelago (just after L8) and with it. The draw calls
vary from run to run here by twenty or so (what of the sea's life is in view), so each is the range
over three runs, the rest the middle one:

| Scenario | Sim ms (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| dive_brasas, before | 5.7 · 9.1 | 203–225 | 1,144,809 | 273 MB |
| dive_brasas, with the archipelago | 6.1 · 9.9 | 232–244 | 1,163,726 | 273 MB |
| archipelago | 4.9 · 9.0 | 141–145 | 556,688 | 273 MB |

The first build of the islands drew 1.44 million triangles diving the arches, a quarter more,
and almost none of it the islands themselves: the scrub, the shore's boulders, the reef's rocks
and the urchins were each one mesh over the whole archipelago, so some part of each was always in
view and the whole of it was drawn (the islands' scrub, on land, from under the water). Each is
now one mesh to an island, so an island out of view is left out: diving the arches draws about 2 %
more than before, and at anchor among the islands is half what it was. Diving the arches takes
about twenty more draw calls (a tenth more), not yet traced object by object: Los Roquetes and El
Vapor, with their detailed seabed, are the new things nearest. The heap and the simulation are as
they were: the habitat's homes are built as fast as before (`docs/ARCHIPELAGO.md`, A1).

What stands out already, to be confirmed on real hardware before anything is changed for it:
draw calls are highest looking at many boats or the harbour (`harbour_off` 534 after the fleet's
distance culling took it from 719, `sonar` 363 with the dashboard's controls), triangles highest in
the harbour and at Las Brasas (over a million), and the storm's simulation the dearest.

The north (`docs/NORTH.md`), measured the same way, November 2026, on a quiet machine, with two of
home's scenarios alongside to show home unchanged by it:

| Scenario | Sim ms (mean · worst 1%) | Draw calls | Triangles | Heap |
| --- | --- | --- | --- | --- |
| north | 3.2 · 7.7 | 131 | 509,040 | 290 MB |
| dive_north | 4.6 · 13.9 | 87 | 283,083 | 273 MB |
| harbour (home, unchanged) | 4.6 · 8.9 | 351 | 1,275,233 | 257 MB |
| liveaboard (home, unchanged) | 6.5 · 21.1 | 197 | 721,368 | 242 MB |

The north costs less to draw than Las Brasas: its terrain is tiles of coarse sheet (about forty
built round you at once, each about 2,600 triangles) with the isles in detail only near, and its
things are a few meshes an area. The heap is about 33 MB more once you're there (its water maps,
its tiles, its isles' things and kelp). What it costs to get there is spread out: its water map and
sea field (about 2 s of work), its kelp (0.6 s) and its things (0.3 s) are each made a few
milliseconds a frame as you come up the coast, and its tiles one at a time; only a passage that
lands you there before they're done makes them at once, behind the passage's own screen.

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

## Stutter: shaders built mid-game

A player on an RTX 3070 and a 16-core processor reported large stutters when panning the camera
or moving about, with the CPU and GPU both mostly idle. That's the renderer building shaders in
the middle of play: each new shader program is a freeze while the browser compiles it, and on
Windows each is first translated for DirectX, so every one costs from tens to hundreds of
milliseconds. The CPU looks idle because the freeze is on one core of sixteen.

**Two causes, measured** (`renderer.info.programs` as you go about the game):
- **The light count.** three.js builds each lit material's shader for the number of point lights
  it counts, and counts only the lights in visible parts of the scene. The game had 39 lamps, of
  which 10 or 11 were counted at a time. The moment a lamp's boat, house or cabin was shown or
  hidden, the count changed, and every lit material in view was rebuilt at once. When the cabin
  boat came into play the count went from 10 to 11 and the programs from 94 to 159: **65 shaders
  in one frame**.
- **The first sight of anything.** A material's shader was built the first time its object was
  drawn, so turning the camera or travelling brought new ones every few seconds (163, 179, 182 …).

**What's done.**
- **A fixed set of lights** (`src/lamps.js`). A lamp is a `Lamp`, set just as a light was (colour,
  intensity, distance, decay, where it hangs). The scene has 12 real point lights, lent each frame
  to the lamps that are lit and shown, nearest first. The count never changes, so nothing is
  rebuilt for a lamp. No more than 11 were ever counted before, so it looks as it did.
- **Every shader built while the game loads** (`warmShaders` in `main.js`). The loading screen says
  "Getting the sea ready…" while `renderer.compileAsync` builds the whole scene's shaders, in
  parallel where the browser can (`KHR_parallel_shader_compile`), for 25 seconds at most.
- **What's built later is warmed as it's made:** Las Brasas, the north, the fell's detail
  (`world.onBuilt`), a stray boat. Its shaders are built in the background before it's in sight.
- **A pixel budget** (`budgetRatio` in `src/quality.js`). Ultra and Cinematic draw more pixels than
  the screen has, then smooth them down, but now only up to a 4K screen's worth (8.3 million).
  On a 3440 × 1440 ultrawide, Cinematic drew 11.1 million pixels a frame; it now draws 1.29 a side.
  This is worked out again whenever the window changes size.

**Part two.** The player reported it was 90% better, but still lagged arriving at the harbour and
switching quickly between camera views. Profiled in the browser (CPU profile, and what each frame
sent to the graphics card for the first time), three things were left:
- **The reflection's own shaders.** The water's reflection draws what it shows into a picture of
  its own, and a material drawn into a picture needs a second shader (no tone mapping, another
  colour space). Arriving at the harbour built 9 of them in one frame as the houses and boats came
  into the reflection. They're now built at loading too, for what the reflection's camera shows.
- **First sending.** Arriving sent 36 pictures and 137 models to the graphics card for the first
  time. Now every picture is sent during loading (349 of them, about 20 megapixels), and the whole
  of what's shown is drawn once behind the loading screen, behind the camera as well as in front,
  so its models go too. Hidden things stay hidden, so far scenery isn't loaded.
- **Working out where everything is.** Every frame, three.js recalculated the position of all
  15,747 objects in the scene, twice (once for the reflection), though 87 to 90% of them are hidden
  at any moment: townsfolk out of sight, rooms you're not in, boats laid up. It was the single
  biggest cost in a frame. Now (`src/shown.js`) only what's shown is worked out. Anything hidden is
  marked and worked out the moment it's shown again. Code that asks where something is works it
  out itself.

Measured on the same arrival and view switching, before part two and after:

| | Worst frame | Average frame | Shaders built | Pictures sent | Models sent |
|---|---|---|---|---|---|
| Arriving, before | 455 ms | 70 ms | 15 | 36 | 137 |
| Arriving, after | 113 ms | 47 ms | 4 | 1 | 65 |
| Switching views, before | 111 ms | 57 ms | 0 | 1 | 11 |
| Switching views, after | 81 ms | 41 ms | 0 | 0 | 0 |

The 65 models left on arrival are mostly things shown only right at the quay. Screenshots before and
after match: the harbour, first person in the RIB at its dashboard, the camp at night, the quay at
dusk with its lamps lit.

`tests/stutter.test.mjs` covers it:
- the light count holds whatever is shown or hidden;
- the nearest lit lamps get the lights;
- no point light outside the set;
- the warm-up at load and as things are built, and its reflection shaders, pictures and models;
- the budget;
- positions worked out for what's shown exactly as three.js would, and for a hidden thing the
  moment it's shown.

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
