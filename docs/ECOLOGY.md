# The living ocean: what drives the fish

One ecosystem (`src/world/ecosystem.js`) holds every fish in the world: about 4,800 of 91 kinds, in 240 shoals and on their own. The renderer, the fish finder, the surface signs and every bite all read it. This page lists everything in the world that changes where those fish go and how keen they are, what each driver did before the living-ocean stage and what it does now. Each stage (D1 the connections, D2 the baitfish) builds on the same simulation; there is no second one.

`src/world/ecology.js` holds what D1 adds: each cool-water kind's warm limit, the water's warmth at a depth, the small shoaling fish the hunters live on, and which kinds hunt them. `pickPoint` in `ecosystem.js` (where a fish goes next) and `envAt`/`mood` (`behaviour.js`: how keen it is on a bait) read them. D2's baitfish live in `ecosystem.js` (`forageWatch`, `fearOf`, `winterness`, `winterGround`, and the shoals' choices in `pickPoint`).

## The drivers

| Driver | Before the living ocean | Now |
| --- | --- | --- |
| **Fish populations** | Seeded per kind from the habitat's homes, with the same fish on every screen. A fish kept is replaced in four to seven minutes, more slowly where the water's been fished hard (`pressure.js`). | Unchanged. |
| **Baitfish** | 116 shoals of the small shoaling fish (sprat, sardine, anchovy, sand smelt, glass minnows, bogue, horse and chub mackerel, chromis, roach, rudd, minnows). They wander their home water, gather under lights after dark, and are balled up and driven to the top when a shoal of hunters finds them. | They're the food: the fish-eaters gather where they are (D1). And they live their own lives (D2, below): off the other way from the hunters gathering about them, closer together, quicker, deeper and into cover; up into the current to feed; out to deeper water in winter; down and together when a boat roars past. |
| **Predators** | Only the shoaling hunters went after shoals: tuna, bluefish, bonito, little tunny and bullet tuna at home; barracuda and amberjack at Las Brasas. Each searches 380 m for prey and drives a frenzy of 50 to 80 seconds. | Every fish-eater (a hunter, or a kind that takes a fish or something like one well: bass, pollack, pike, perch, mackerel, garfish and more) looks over the water round the nearest shoal of small fish within reach of its home, keeps just under it, and is keener there. A grazer (mullet, carp, bream) never does. Attacks by the lone hunters (bass at the rocks, pike in the weed) are D3. |
| **Seabirds** | Gannets (and Las Brasas' shearwaters) dive on bait shoals within 3.5 m of the top, by day, decided by the host. Gulls gather over shoals feeding at the top, and over a boil. | Unchanged; they join the feeding events in D4. |
| **Dolphins** | Pods roam, ride bow waves and breathe; no link to the fish yet. | Unchanged; D3. |
| **Water temperature** | Shown on the conditions panel, the fish finder and the catch log (`seatemp.js`: the year, the depth under summer's warm layer, the zone, the shallows on a still afternoon). Each kind's year is in `season.js`. | The cool-water kinds (pollack, hake, conger, John Dory, plaice, thornback ray, catshark; the tarn's trout and grayling) keep below the summer's warm top layer when the water's deep enough. Stuck above it (shallow rocks in late summer), they're sluggish, and a fish that turns away says why ("It's sluggish in water this warm…"). In early spring the whole column suits them; in autumn the warm layer's mixed down and they only just feel it. |
| **Depth** | Each kind's depths by the hour, the rain or the night (its `life.depth`); bottom fish on the bottom. | Moved by the water's warmth and the light (above and below). |
| **Currents** | Fish turn to face into the current (`steer`); each kind's liking for running or still water changes its mood. | Unchanged. |
| **Tides** | A running tide livens the sea's fish; slack water quietens them; the flood-tide feeders (bass, mullet, the flatfish, gilthead, meagre, gurnard) feed hardest on the flood (`tide.js`). | The flood-tide feeders push up over the shallows on the flood and drop back to deeper water on the ebb. |
| **Seasons** | How active each kind is through the year (`season.js`); Las Brasas' fish barely notice. | Unchanged; the water's warmth now moves the cool-water kinds within the year as well. |
| **Food availability** | Only the angler's: a rig, and loose feed thrown in for the grazers. | The shoals of small fish (above). |
| **Light** | Each kind's depths by day, twilight and night; a high, bright sun makes the light-shy fish warier (their mood); lights after dark draw squid and duskfin. | In a bright sun (by the sky's daylight and cloud), the light-shy fish keep deeper and tighter to cover; under cloud or at dusk they come up and out. |
| **Habitat** | Homes on the habitat's spots (channels, quays, reefs, weed beds…), each kind's zones and cover (weed, rock, open), the seabed's depth. | Unchanged; every new choice is made on the same habitat grid. |
| **Fishing pressure** | A spot fished hard is remembered (`pressure.js`): its fish are replaced more slowly and are warier. | And what's left keeps tighter to cover. |
| **Vessel disturbance** | A boat going fast startles fish (by its speed and how quiet its hull is); a cast landing, a motor and a splash disturb the water for a minute or two, and fish there are warier. | And fish move away from it: a fish whose home water has been disturbed lately shifts its range away from the noise, by how much its kind minds, for as long as the disturbance lasts. |

## The baitfish (D2)

Each shoal of small fish lives as one: its leader decides, and its members keep their places in it, so there's no fish-by-fish schooling across the sea. Shoals beyond the active radius go on at 5 Hz, and those beyond 240 m wait. Only the host decides them, and the shoal's place, depth and spread go to everyone as before.
- **The hunters about it.** When a fish-eater settles at a shoal (D1), the shoal knows: the more hunters lately, the warier it is, and it remembers which side they came from. The fear fades by half in twenty seconds. Past one hunter's worth it's off at once, choosing water on the far side of its home from them, closer together (its spread down to about half), quicker, a little deeper, and into weed or rock if its kind keeps to cover. (A shoal being driven by a hunting shoal, the tuna and the like, is the hunt's: it doesn't run its own way then.)
- **Feeding.** It works up into the current, where its food (the plankton) comes from: up to six-tenths of its range up-current in a running tide. Each kind's depths by day and night are its own: sardines and anchovies come up at night; sprat stay near the top by day, where the tuna and the gannets find them.
- **The seasons.** In winter (by the water's warmth at the top: fully at 13°C in the sea, at 5°C in fresh water) a shoal goes out from its home towards deeper water, as far as its kind of water goes and up to about a hundred metres; in summer it comes back in. The south's water never gets cold enough.
- **Noise.** A boat going fast (over 3 m/s, allowing for how quiet its hull is) within 45 m sends a shoal down two or three metres and closer together for six seconds; nearer still, it scatters, as before. As with the scattering, only the host's own boat counts.

## The graphics settings never change what bites

The graphics settings' "Visible fish" choice sets how far round you (or round everyone, when hosting) the fish are kept going in full detail: 70 m on the lowest setting, 150 m on the highest. Beyond that they go on at 5 Hz. Before D1, fish beyond it never looked at a bait, so on the lowest setting a blue marlin 100 m from a trolled lure (which raises one from three times its 40 m perception) couldn't come up, and on the highest it could.

Now every fish within 160 m of the focus looks at baits on every setting, and only those (`BAIT_REACH`). A fish already going for a bait is always kept in full detail. The setting changes only how smoothly a distant fish swims, and how far off the surface signs are drawn.

## Playing together

The host decides the shoals, so the forage and the hunters, and sends them to everyone. It also sends the clock, the sky, the wind, the sea and the water's colour every two seconds. Every input D1 reads is therefore the same on every screen. The fish on their own run on each screen from the same seeds; where exactly one goes next is each screen's own choice, as before, but it follows the same water. Which fish takes a guest's bait is the host's word.

## Performance

D2 adds a look at each shoal of small fish's fear and the host's boat each step it's stepped (116 shoals), a current lookup when a feeding shoal chooses where to go, and the water's warmth at the top when any of them does; each shoal's winter ground is worked out once. Its cost is within the noise: 1.39 ms against 1.375 with D1 alone, in the busiest water.

D1 adds a few things:
- A short search of the 116 forage shoals when a fish-eater picks where to go next.
- A look at the disturbance, only when there's some near a fish's home.
- One pressure lookup per choice.
- Each cool-water kind's depth below the warm layer, worked out once per game half hour for each water it lives in.

The bite checks for fish beyond the active radius but within reach are made between their coarser steps, and only those fish are asked their state.

The ecosystem's frame in the busiest water (837 fish within 150 m, a lure in and a motor about) costs 1.53 ms against 1.48 before D1 by default, and 1.34 against 1.32 on the lowest setting. Those are medians of five or six interleaved runs, and both differences are within the noise.
