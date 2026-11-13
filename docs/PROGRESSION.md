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
   with southern work: item 8.
3. **G3 — Wildlife over the seasons.** Months and places per kind, and a photographed collection
   on the species pages: items 7 and 10.
4. **G4 — Standing.** Standing with each job-giver, read at last: better charters and regular
   clients; one relationship per townsperson: items 3 and 12.
5. **G5 — Fit-outs that change the work.** Fittings that change seats, shelter and diver room; an
   engine service interval: item 6.
6. **G6 — Harder calls.** A boat aground on a falling tide, one taking water; Blue Water calls
   that want a VHF: item 5. (Taking water and the Blue Water calls first; aground to follow.)
7. **G7 — Deep water.** One deep feature off the shelf, and a sonar that reaches it: item 11.
8. **G8 — Boats of her own.** The staged refactor from kind to boat: each boat an id of her own
   (the same as her kind at first, so nothing changes), then a saved registration with a serial,
   then a second boat of a kind: item 1.

Item 4 (research) grows through G3 and G6 rather than on its own.
