# Part G: long-term play — what's there, and the order of work

Part G of the brief asks for depth that keeps players coming back: boats with histories,
careers, research, rescue work, upgrades that matter, wildlife watched over seasons, regional
economies, expedition journals, collections, deep water, and harbours with people in them. It
says to build on boating, fishing, discovery and adventure, not to add unrelated minigames.

This is the audit of what the game already has for each item (from the code, November 2026), and
the order the work goes in. Each step is one pull request, small enough to review and play-test.

## What's there, and the gap

| Item | What exists | The gap |
| --- | --- | --- |
| 1. Identifiable boats, several of a type | Each kind has her own looks (`yard.looks`), papers with a registration (`papers.js`, `regOf`), and a log. | One boat of each kind, everywhere: `BOATS[kind]`, engines, damage, fuel, stores, the fish box, the save and play-together poses are all keyed by kind (about 80 `BOATS[` and 200 `[kind]` lines). `buyBoat` refuses a second. A staged refactor, not a quick change. |
| 2. Vessel histories | Her papers: since when, engine hours, sea miles, fuel, fish, best fish, and a log of 40 lines (25 kinds of event). Seen at the Marine Works. | No voyage, charter or rescue was ever logged; the papers can be read only at the Works. |
| 3. Charter careers | Ranks (hand, boatman, skipper, master) by jobs done; four charters with passengers aboard and tips. | The career is one counter; standing with each job-giver is added up but never read; no regular clients. |
| 4. Marine research | The Trust's jobs: surveys, transects, counts, photographs, the Gannet Isle expedition. | Every job is one-off: nothing adds up into a Trust record. |
| 5. Assistance and recovery | Radio calls (castaway, breakdown, drifting buoy); your own rescue (tow home, help by phone, VHF or flare). | Three call types, home only, fixed pay. |
| 6. Boat upgrades | Fourteen fittings and the engine catalogue. Upgrades buy capability, never a better bite. | Seats, cargo, shelter and diver room are fixed per kind; engine hours have no wear. |
| 7. Wildlife over time | `state.seaLife`: first sighting and a count per kind; binoculars name what they see. | No seasons, places or individuals over time. |
| 8. Regional economies | One price table; who buys differs, and the job board is home-only. | Las Brasas trades like Willowhaven, and has no board. |
| 9. Expedition journals | Day pages (the last 60), the last 20 trips, crossing records. | No voyage survived as itself: a crossing's or an offshore trip's story was spread over day pages that drop off. |
| 10. Collections | The album (48 photos), the wall at home, keepsakes, badges, goals. | Photos count towards no collection. |
| 11. Deep water | The Blue Water past 860 m out, big game, the crossing, El Veril. | Nothing to find below about 40 m. |
| 12. Harbours and people | Ten townsfolk with routines, eighteen favours, Bar El Muelle's stories. | Favours run out; Las Brasas has two people; the small harbours have none. |

## The order

1. **G1 — Voyages.** Each real passage written up for good (the journal's Voyages), and in her
   papers: items 2 and 9. Built on the day book and the papers.
2. **G2 — Regional trade.** Las Brasas prices and fuel of its own, and a board at Bar El Muelle
   with southern work: item 8. (The board, as Paco's slate: G2b. Passengers and freight from
   Puerto Brasa, G2c (done): the island's charters, a buoy brought in and salt fish carried home,
   aboard at Puerto Brasa and back to it, for a boat of yours at the island.)
3. **G3 — Wildlife over the seasons.** Months and places per kind, and a photographed collection
   on the species pages: items 7 and 10.
4. **G4 — Standing.** Standing with each job-giver, read at last: better charters and regular
   clients; one relationship per townsperson: items 3 and 12.
5. **G5 — Fit-outs that change the work.** Fittings that change seats, shelter and diver room; an
   engine service interval: item 6.
6. **G6 — Harder calls.** A boat aground on a falling tide, one taking water; Blue Water calls
   that want a VHF: item 5. (Taking water and the Blue Water calls first. G6b (done): a cabin
   boat aground on the Wend's sand as the tide falls, pulled off by a real towline before it leaves
   her.)
7. **G7 — Deep water.** One deep feature off the shelf, and a sonar that reaches it: item 11. (Gannet Deep, a canyon; the deep sounder. G7b: a sperm whale hunting it.)
8. **G8 — Boats of her own.** The staged refactor from kind to boat: each boat an id of her own
   (the same as her kind at first, so nothing changes), then a saved registration with a serial,
   then a second boat of a kind: item 1.
   - **G8a (done):** each boat an id of her own, the same as her kind: the boats built and found by
     id; where each lies, the one you're in, the ones laid up, on the trailer, shipped and towed,
     kept by id. Nothing a player sees changes.
   - **G8b1 (done):** her engine room, her damage and her trolling motor her own, kept by id and
     found through the boat herself; bailing, pumping and leaving the helm remember the boat.
   - **G8b2 (done):** her accounts by id: her fuel and batteries, her lockers, her fish box, her
     deck, her papers and registration, her paint, name, fittings and engine at the Marine Works, and
     the boat a job or the story has her as. An id says her kind (`src/boatid.js`: the first of a
     kind her kind, 'rib'; a second 'rib~2'), so each module finds what she is from it, and every
     save from before keeps its ids: no new save version needed.
   - **G8c1 (done):** a second boat of a kind in a save (one of the boats that live at Willowhaven)
     is built, moored at a berth of her own on your finger, fitted out (her tank, burn, engine and
     its revs under her id), driven and saved like any other, and kept everywhere a boat is kept.
   - **G8c2 (done):** buying her at the Marine Works (*Buy another*, at her price, two to a kind),
     built at once and laid up for the harbour office to launch; each of your boats on its own line
     on the yard's sheets and in the harbour office, a second named apart from the first (her name,
     or "second RIB"); everything every boat is given at the start given to a boat launched or
     bought later too (`eachBoat`).
   - **G8c3 (done):** friends see a second boat of a kind by her id (her pose, her towing the other,
     your moored boats), the crossing and the fast passage made in her by id, and the voyage journal
     naming her "the second RIB". G8, boats of her own, is done.

9. **G9 — Harbours and people.** More people where there are few, each with a day, words and a
   favour: item 12.
   - **G9a (done):** Puerto Brasa's: Nayra Cabrera, who runs the dive school (her boat up with a
     cracked keel, her tanks on the quay, her table at the bar), and Agustín, the oldest of the
     cofradía's fishermen (his nets on the quay, the dique at sunset, the evening with Chano).
     Their words know what you've done for the dive school and the cofradía.
   - **G9b (done):** the small harbours: Bryn Tregear, who keeps Wend Quay (the quay swept, the
     mullet off its end, the camp's bench, a hut of his own above it), and Fen Hollis, the Marine
     Trust's seabird warden on Gannet Isle for the season (the colony counted from the clifftop over
     Puffin Cove, the landing stage, the bivouac and the driftwood log; gone in autumn and winter).
     Their words know your work for the harbour office and the Trust.
   - **G9c (done):** favours that don't run out. Once someone's first favours are done, one of
     theirs comes round again every few days (a bream for Mags's customer, Ruth's pie, Dougie's
     buoys, Bryn's samphire down to Ruth, Fen's counts to Wenna, and the rest), for money or a
     meal; the journal counts the times. Item 12 has no gap left.

Item 4 (research) grows through G3 and G6 rather than on its own.

## After Part G: the brief's Part J day, played through

With Part G done, the whole of the brief's Part J day (two friends from Willowhaven to a reef and
home) is played by two game clients together, step by step, as a player would
(`tools/playthrough.mjs`). What it found, and the order of the fixes, is in `docs/PLAYTHROUGH.md`:

1. **J1 (done):** the playthrough itself, and its findings written up.
   - **J1b (done):** one boat whose position goes wrong no longer takes every boat with it (and
     the game with them); she's put back where she last was.
   - **J1c (done):** what sent a boat's position wrong: a friend's boat drawn right on top of
     yours (two friends starting in their rowing boats at the same spot), the contact pushing her
     back and forth until she was flung off. Now two hulls inside each other part the one way, and
     yours slides clear of a friend's.
2. **J2 (done):** diving together from one boat (the crewmate stays aboard while the skipper dives, and
   can go over the side and climb back aboard too); a scuff no longer hiding the dive; a friend's
   second boat of a kind drawn for everyone.
3. **J3 (done):** a night aboard an open boat (the RIB, the console), at anchor or tied up, in a bivvy
   roll from the chandlery; a friend crewing aboard sleeps it through too.
4. **J4 (done):** the crew's catch in her voyage: fish landed aboard her by a friend crewing, named as
   theirs, in the skipper's voyage and her papers.
5. **J5 (done):** the rest of what they come home with in her voyage: the dives made from her
   (the skipper's, and a crewmate's) and the photographs taken on the way (theirs too), with what's
   in them. A dive makes a voyage of a short trip.

## After Part J: the sea, close up

The water and the boats on it inspected closely against the best real-time oceans and boat
models; the findings and the plan, W1–W7 for the water and B1–B6 for the boats, are in
`docs/WATER.md`.

1. **W1 (done):** the whitecaps back (they never showed once the wind had been light), drawn as
   foam: dense white just broken, thinning to lace, a glow of bubbles under it.
2. **W2 (done):** the sun and the sky in the water, done physically: the sky's own colours mirrored
   on every setting, water's Fresnel, and the sun's glitter as wide as the wind makes it.
3. **B0 (done, found starting B1):** hulls that meet, solved as a physics engine solves them, not
   sprung: two hulls found overlapped are eased apart, never kicked off at many metres a second;
   a RIB that rams a rowing boat shoves her off as two masses meeting do.
4. **W3 (done, the haze):** the horizon without a seam: the haze the sky's own colour along the
   horizon, the way you look, warm towards a low sun and bright round it.
5. **B1 (done):** added mass in heave, pitch and roll: the boats bob at their real pace.
6. **W4 (first part, done):** the water's colour from light in water: the seabed and all under the
   sea seen through it as it is, red taken first, turquoise over sand, Las Brasas clear and blue.
7. **B2 (done):** the waves below the surface: their pressure and their motion fade with depth;
   her keel, rudders and outboard's leg feel the waves' to-and-fro, so a following sea's crest
   takes the grip off her rudder.
8. **W4 (second part, done):** with Ocean: Full, the bottom seen through the moving surface: the
   sand, the rocks, a wreck and the fish below bent the way each bit of the surface bends the
   light, and shimmering under the wavelets too small to draw.
9. **B3 (first part, done):** the boats checked against measurements: the wind on a boat as
   wind-tunnel tests give it, so a boat left to drift goes off at the few per cent of the wind
   field trials find (not 4 to 14%), lying to it as her shape has her; at anchor she swings on her
   rope as boats do, and it's a storm's seas, not the wind alone, that drag an anchor; Spot-Lock
   wanders with its GPS fix; each hull's roll decay checked. (Still to do: the planing trim
   against Savitsky.)
10. **B4 (done):** the propeller: it walks her stern to port going astern (a single outboard;
   twins cancel it), draws air down when driven hard as it breaks the surface and keeps it until
   it's well under again, and feels the waves' own motion in the water into it.
11. **B5 (done):** shallow water: more resistance as a boat nears the speed the bottom lets her
   waves go, held back about it on a moderate throttle and labouring through it pushed hard; her
   wake's wedge opening out over the shallows and, past that speed, closing to her Mach angle.
12. **B6 (done):** anchors: the rode hangs as a real one does, lying along the bottom and lifting as
   it takes her weight; what the anchor holds goes by the bottom (sand best, weed and rock worst),
   the scope (a short rope in deep water pulls it up) and how well it's dug in; it drags in a blow
   and digs in again, and the night at anchor is reckoned the same way.
13. **W5 (done):** the wind sea spreads round the wind as measured seas do, its long waves
   long-crested about the wind and the short ones fanning out; shallow water holds less of it, the
   boats and the drawn water feeling the same; and close by (Ocean: Full) the ripples a breeze
   raises, none in light air, with the sun's glitter spread by what they leave out.
14. **W6 (first part, done, found starting its spray):** the wind sea the right way up: its water
   carried in towards each crest, so the crests are sharp, the whitecaps break on their tops (they
   broke in the troughs) and the water runs forward under them (it ran backwards); a drifting
   boat's drift fitted again to the field trials with the water right; an anchor that's dug in
   enough to hold her says so.
15. **W6 (done):** and in a strong wind, spindrift torn off the crests where they're breaking, from
   7 m/s up and more the harder it blows, streaming down the wind and carried up by its eddies;
   foam blown in streaks on the water by the Beaufort scale.
16. **W7 (done):** the rings round you (a cast, the bobber, a fish rising, a wading foot, the water
   lapping at your hull) run as the water runs them (Ocean: Full): spreading at a real ripple's
   pace, crossing one another, coming back off hulls, quays and the shore, and passing under the
   timber piers between their posts.
