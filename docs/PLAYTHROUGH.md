# Part J: the two friends' day, played through

Part J of the brief describes the game it wants as one day for two friends:

> They walk down to the harbour … inspect their customized RIB, select a different outboard and
> load it with diving and fishing equipment. The weight of their equipment changes the way the boat
> sits in the water. They plan a route and depart into the Atlantic. The ocean has convincing waves
> and vessel movement. They spot seabirds diving offshore. The birds are responding to real
> baitfish being pursued by predators. One player steers while the other uses the fish finder. They
> locate the fish, cast and hook a powerful predator. … After landing it, they continue toward a
> remote reef. They anchor, dive and explore the underwater wildlife. They remain overnight aboard
> their vessel. The following day, rougher conditions make the return journey more challenging.
> They return to Willowhaven with new discoveries, photographs, a memorable catch and a vessel log
> documenting their adventure. None of this needs to be a single scripted mission. It should
> emerge naturally from interconnected systems.

Parts A to G built the pieces one at a time, each tested on its own. This is the check that they
add up: the whole day, played by two real game clients together, through the game as a player has
it (its sheets, its keys, its prompts), with nothing arranged for it but a save with the boats and
the money in it. Whatever the world throws up on the way (a fouled cooling intake, a feed that
moves on, a gale due) is dealt with as a player would. `tools/playthrough.mjs` plays it, and can be
run again whenever something changes:

```
node tools/local-realtime.mjs 8643 &           # the stand-in for playing together
python3 -m http.server 8676 &                  # the game, served from the repository
PLAYWRIGHT=/path/to/playwright node tools/playthrough.mjs [url] [screenshot dir]
```

It prints PASS or FAIL for each step with what it saw (SKIP for steps that can't happen after a
failed one). It takes about fifteen minutes (two games in software rendering). It isn't part of
the test suite: it needs two browsers and the relay, and the world it plays in is alive, so no two
runs are the same day.

## The day, step by step

Mags hosts, Bert joins. Early summer, a fine morning; Mags has the RIB (laid up), money for an
engine and kit; Bert has his skiff and nothing else.

What a run finds (run 15, the last before this was written up; each line is a step the script
checks, and what it saw):

| | Step | Run 15 |
| --- | --- | --- |
| 1 | Bert joins Mags's game | Each sees the other |
| 1 | The harbour office puts her RIB in the water | Three afloat already: the kayak laid up at the camp in her place; the RIB on her berth on Mags's finger |
| 2 | A different outboard at the Marine Works | The Skua 225 on her transom, £640 |
| 3 | Diving and fishing kit aboard from the chandlery | Two cylinders, a stores crate and a fish box strapped down on her deck |
| 3 | She sits differently | Payload 34 → 99 kg; 20 mm lower; trim 0.3° by the stern |
| 4 | Aboard, a route drawn on the chart, saved and followed | Mags in, Bert stepped aboard as crew; three marks to the Hound |
| 4 | Cast off and out of the marina | Lines in; out along her slot and up the bay without a knock |
| 5 | The ocean moves her | 16 m/s (31 knots): pitching 3°, rolling 7°, heaving 0.29 m; Bert still aboard, 1.8 m from her middle |
| 6 | Birds over a real feed offshore | Sprats balled up by 16 hunting mackerel 190 m off; birds diving on it on both screens; the same feed in Bert's sea |
| 7 | One steers, the other on the fish finder | Mags stopped 24 m short; Bert's finder reads "below you", the bottom at 24 m |
| 8 | Cast, hooked, played and landed | A mackerel on the first cast; played in 6 s; kept (into the creel) |
| 9 | On to the reef and anchored | 14 m of water on the Hound's shelf; holding |
| 10 | Mags dives | Off the helm, over the side on scuba; down to 12 m with ten fish about her; a photograph kept; her safety stop at 4 m; up and aboard ("Scuba dive at the Hound: 5 min in the water, down to 12.3 m"); back at the helm |
| 10 | Bert dives with her | **Fails:** the crew menu has only the helm and "Back to your own boat" |
| 10 | Bert aboard while she's down | **Fails:** "Mags's boat has gone: you're back where you stepped aboard" (the pontoon) |
| 11 | A night aboard | **Fails:** no cabin in an open boat |
| 12 | Home in a stiffer blow | Overcast, 10.8 m/s of wind: heaving 0.98 m and pitching 12.5° at 14.5 m/s, against 0.29 m and 3° going out |
| 13 | Tied up at her berth | Fenders out; "Out to the Hound: 1.1 nm, 1 night out" in Mags's journal and in the RIB's papers; Bert's mackerel in his log, from the RIB |

The clock runs on through it all at the game's pace, so the day ends after dark (and the voyage
counts the night it ran into). No page errors.

**On J2's tree** (its second run), step 10 is the dive two friends in one boat would make:

- Mags goes over the side on scuba. Bert, crewing, stays aboard her while she's down, in her on
  both screens.
- From the crew menu, Bert goes over the side after her, on scuba.
- Mags's photograph is kept, her safety stop done, and she's back aboard and at the helm.
- Bert climbs back aboard Mags's RIB (*Climb aboard Mags's RIB*), her crew again.
- That day the feed moved off before a fish took (re-aimed twice, ten casts), so there was no fish
  and nothing for Bert's log: the world's doing, not the game's.
- No page errors.

**On J3's tree**, the whole day passes, every step, with no page errors:

- Out with a bivvy roll among her kit (106 kg aboard).
- A mackerel to Bert on the first cast into the feed.
- Both dive on the Hound and climb back aboard.
- At 21:38, anchored on the shelf, Mags turns in on her deck. Bert's game shows "Mags turns in. You unroll the other bivvy on her deck and sleep…".
- They wake at 04:19 the next day, still at anchor, each to the other stirring in the other bag.
- Home in the next day's stiffer blow (heaving 1.1 m against 0.16 m going out), and tied up.
- "Out to the Hound: 1.1 nm, 1 night out" goes in her papers, and Bert's mackerel in his log, from the RIB.

**On J4's tree**, Bert's mackerel, landed from her at the feed, is in her voyage as his. Her papers
say "Out to the Hound: 1.1 nm, 1 night out, 1 fish, with Bert.", and the mackerel is the best of the
voyage, his. Every other step passes but one: no fish came within 15 m of Mags on the reef that time
(the world's doing). No page errors.

**On J5's tree**, her voyage keeps the dives and the photograph too. Her papers say "Out to the
Hound: 1.1 nm, 1 night out, 1 fish, 2 dives, with Bert.", and the voyage has Mags's dive at the
Hound, to 12.1 m, Bert's (his) at Gannet Light, to 2.6 m, and her photograph. Another run that day
had the RIB holed on the way out; the deck rightly put *Look her over* first, with water coming
in, so Mags never dived. That run's papers didn't say what she'd hit, so the script now prints all
her papers for the day: each knock writes what she hit.

**On J1c's tree**, the two rowing boats at the start no longer lie one inside the other: each
game slides its own clear of the friend's, and neither is flung off. Every step passes, with no
word of a lost boat. Her papers say "Out to the Hound: 1 nm, 1 night out, 1 fish, 2 dives, with
Bert."; the voyage has Bert's common dentex (0.75 kg, his), Mags's dive at the Hound to 11.1 m and
Bert's at Gannet Light to 3 m, and her photograph. Her knocks all day, now written out with every
boat near her: six coming into the marina at the end of it, against the pier and a townsfolk boat
lying there, one at 4.3 m/s and one at 2.6 into the pier (a scuff in her papers), the rest under
2 m/s. Two
runs before the script went east of the rowing boats, she hit one of them on the way out (see
*Fixed in the check itself*). No page errors.

## What it found

### In the game, to fix

1. **Two friends in one boat can't dive together** (J2: fixed). When the skipper goes over the side, the
   one crewing for them is put back where they first stepped aboard (in the run, the Willowhaven
   pontoon, seven hundred metres away), as if her boat had gone: crewing ended whenever the
   skipper's pose wasn't a boat's (`main.js` `rideCrew`). A crewmate's menu has no way over the side
   of a friend's boat, and from the water there's no climbing back into one.
2. **A scuff hides going diving** (J2: fixed; paint-deep damage now waits, with *Look her over* in
   the sit-back-or-dive menu). On a boat you walk about (the RIB, the console), any damage
   at all, even a scuff off the quay or another boat, makes *Look her over* the deck's prompt until
   the Marine Works mends it, so *Sit back a while, or go diving* never shows. Four of the sixteen
   runs were stopped at the reef by it. In run 16, looked over: "Bow: dented. Starboard side:
   scored. The Marine Works can put it right." (*Leave it*), and the prompt was *Look her over*
   again.
3. **No night aboard an open boat** (J3: fixed). The brief has them stay the night aboard; only the cabin
   boat and the yacht have anywhere to sleep (`hull.cabin`). Anchored in the RIB, there's no way to
   turn in. Now a **bivvy roll** from the chandlery (two sleeping bags in waterproof bags, and two
   mats) goes aboard her as cargo, and at anchor or tied up the deck's menu has *Turn in for the
   night* (`src/nightaboard.js`). The night is the cabin's (a gale is reckoned against where she
   lies). A friend crewing aboard sleeps it through with her: their game shows the night go by,
   and they wake beside her. The playthrough's step 11 now does this.
4. **A friend's second boat of a kind isn't drawn for anyone else** (found reading the code for
   the first; J2: fixed). The word of where your boats lie (`together.js` `sendFleet`) left out a boat's
   own id, which the friend's game reads (`cleanFleet`): two RIBs lying in the water were one.

5. **The crew's catch isn't in her voyage** (J4: fixed). Bert's mackerel, landed from the
   RIB, is in his own log (in the RIB, as it should be), but the voyage written up in Mags's journal
   and her papers says "0 fish". The game means it ("it's their fish": `main.js`, a friend's catch
   only counts for the skipper's fishing charter), but the brief's "a vessel log documenting their
   adventure" wants the fish taken aboard her in her voyage, named as the crew's. Now a friend
   crewing aboard is named in her voyage, and the fish they land from her are in it as theirs
   (`src/voyages.js`). On J4's tree, her papers say "Out to the Hound: 1.1 nm, 1 night out, 1 fish,
   with Bert.", and the voyage has his mackerel as the best of it, his. The fish stay in his own
   log too.

6. **One frame threw, and the game stopped** (J1 and J1b: fixed). Once in sixteen runs, at sea
   with Bert crewing, a value that wasn't a number reached the sound's underwater filter
   (`AudioScape.setUnderwater`), which the browser refuses with an error. The frame loop only asked
   for the next frame after this one had finished, so one bad frame stopped the game dead. J1 asks
   for the next frame first (`src/loop.js`), and hands the underwater filter only numbers.

   The playthrough on J2's tree then met it again, leaving the marina, and wrote out both games'
   state: the RIB's own physics was sound, but her position wasn't. Trapping every write to her
   position found what wrote it: keeping boats apart (`keepBoatsApart`). If any one boat's
   position had gone wrong, every comparison with it failed both tests that let a pair be, so the
   push was "not a number" and every boat it was compared with, anywhere, went the same way in that
   frame: the boat you're in, out at sea, nowhere, and every sound and the camera after it. J1b
   (`src/apart.js`) only pushes a pair whose distance is a real number, and puts any boat left
   nowhere back where she last was, saying so in the console ("Slow Tide: the row had lost her
   position; put back where she last was"). Checked in the game: the rowing boat at the camp knocked
   to nowhere while Mags is out in the RIB; before, the RIB and the camera went with it and the
   game stopped; after, the RIB carries on and the rowing boat is back where she lay. What first
   sends a boat nowhere isn't found yet (an hour of hard running at the beach with every boat
   watched didn't): the playthrough now records the game's word of it as an error, with which boat
   and where, for when it next does.

   It did, on J5's tree: "the row had lost her position", Mags's rowing boat. J1c found why. Her
   physics now note the first stage of a step to bring in a value that isn't a number, and before
   it any kick of more than fifty times her weight (`src/hydro.js` `check`), and the warning
   carries both. The next run named it: the rowing boat's first kick came seven seconds into the
   day, in the contact stage, at the spot she starts from (12, 32), 113 kN on a boat of 232 kg;
   more came, and at last she was flung off at 270 m/s and 260 m up, where her position stopped
   being a number. Bert's game starts him in his rowing boat at that same spot, so on Mags's
   screen his row was drawn where his game said: right on top of hers. The contact pushed each
   point of her hull inside his out from his centreline, and as a point crossed it, back the other
   way, harder each time. Now a point deep inside another hull goes out on the side its own boat's
   middle is on, so all of her goes out the one way and the two part with a push (`src/boat.js`
   `touch`); and yours slides clear of a friend's boat, which only their game moves, without
   touching it as she goes (`src/apart.js` `keepClear`).

### As it should be, and worth knowing

- **The Hound is too deep to anchor on.** Its foot is thirty metres down, and the game anchors in
  twenty-five at most; it says so ("Too deep to anchor here (30 m): the anchor rope is 50 m long.
  Find water under 25 m deep, nearer the shore or over a shoal"). (B6: the rope was 30 m.)
  North of it a shelf runs at fifteen to seventeen metres: anchor there and swim forty metres to the
  reef, as the run does. The other way is Spot-Lock (a GPS trolling motor from the Marine Works),
  as the Sub-Aqua Club's charters do there: its sea fans are protected.
- **Run up on a feed and it's gone** (above). The game's hint says how not to.
- **Weed and rubbish on the intake** come as they should, now and then under way, and the alarm,
  the stop and the clearing all work.

## Fixed in the check itself

These were the script's own mistakes, not the game's: each was something a player does without
thinking that the script had to be taught.

- **Her RIB was laid up.** Three boats afloat is the harbour's limit; the harbour office puts the
  RIB in the water and asks which to lay up in her place (the kayak, at the camp).
- **The Marine Works' fitting sheet opens on whichever boat is chosen:** the script picks *The RIB*
  first.
- **She's tied to her berth:** cast off (**Z**) before the throttle does anything.
- **Climbing aboard is a step, not a teleport** (about a second): the script waits for it.
- **Leaving the marina:** straight out along the slot between the fingers as she lies, then north
  up the open water east of them. (Trying the steering in the slot swung her stern into the
  finger: a scuff in her papers.) Coming in, the same way, slowly, and only then into her berth.
- **Out past the camp, clear of the rowing boats.** Mags's and Bert's rowing boats lie off the camp
  where each started, right across the way from the marina to the first mark. Until J1c the two lay
  one inside the other (Bert's drawn on top of Mags's), one hull's width to miss, and she mostly
  missed it; now each lies clear of the other, and twice in three runs she hit one at speed and
  was holed (the run on J5's tree holed on the way out was very likely this). The script now goes
  north well east of them before turning for the mark, as a skipper keeps clear of boats lying
  off a beach. (Every knock in a run is now written out: what it was against, and every boat
  within fifteen metres, whose, how far and how fast.)
- **The nearest feed was in the harbour mouth** (mackerel on sprats can be): the script looks for
  one offshore, past the first mark, as the brief has it. It looked for five minutes of the game's
  time, and in one run on #187's code no offshore feed came up in that while (in another, it came up
  at the twelfth look); now it waits up to ten, lying stopped once it's been out and about
  the first mark.
- **Running up on a feed.** At speed she coasted into it and the feed broke up (a boat run through
  a feed scatters it, `src/world/feeding.js`), or the fish went quiet; the game's own hint is
  "Motor up gently, stop well short, and cast into it". The script now runs to 80 m short, comes
  off the plane and creeps to 24 m. Re-aimed at the feed as it drifts, and after it again if three
  casts go untouched.
- **Aground on the way to a far feed.** Once in three runs on W3's second part the nearest feed
  was 743 m off. She ended the run down to it aground, in a tenth of a metre of water at (−237,
  509), well west of the straight line to it (which is 16 m deep or more all the way), and the
  anchoring, the dive and the night that follow went with her. The log can't say how she got
  there; and when that feed moved off, the script's next choice (at (−383, 612)) lay across land,
  8.5 m above the water on the straight line at (−287, 564). Now:
  - the script takes only a feed she can reach over open water in a straight line (2 m under her
    at least, every 5 m of the way to where she stops short of it, by the game's own depths), as a
    skipper looks at the chart before running down to birds working;
  - the run down gets time for its distance (a minute, or the distance at eight metres a second);
  - and where she is, and the water under her, is written out at each stage of it (from, 80 m
    short, 24 m short), so a run that goes wrong there says where.
- **The catch card** stays up until the fish is kept (**K**) or let go; while it's up nothing else
  answers.
- **The intake alarm** (weed or a bag over the cooling intake, now and then under way:
  `src/engine.js` `foul`) opens a question; while it's open the keys don't steer. The script
  answers it as a skipper would: *Stop and clear it*, off the helm, a stride along her deck, *Look
  her over*, *Clear the cooling intake*, back to the wheel. It came up in about half the runs, once
  twice in one day. Once, on #188's code, it came up on the way home in the stiffer blow, and the
  script didn't get her skipper back to the helm: it set him down at the wheel once and *Take the
  helm* wasn't offered there (what was, it didn't say), so she couldn't be steered home and the
  last four steps failed. Now it walks back to the wheel up to eight times, closing her look-over if
  it's still open, and writes out what it was offered each time.
- **Her battery terminal shaken loose** (a hard landing off a wave: `src/damage.js` `shake`), so
  she won't start, or the engine cuts out on the next jolt: in one run on #187's code she wouldn't
  start for home ("a click, and nothing. The battery terminal's loose") and never tied up. The
  script now sees to it as it does the intake: stopped, *She won’t start: look her over* at the
  helm, *Do up the battery terminal*, and she starts again. Checked in a run with it forced (the
  terminal loose and the engine cut as she set off home, and weed on the intake with it): done up
  and away, the weed cleared, and a bag over the intake cleared again in the marina's approach, back
  at the helm each time on the first try; all 39 steps passed.
- **Diving from the helm:** *Leave the helm: walk the deck* first, then a stride away from the wheel
  (at it, the prompt is *Take the helm*), then *Sit back a while, or go diving*. Underwater the
  camera is **Space** and the card that follows is kept with **Enter**. After a dive below ten
  metres, a safety stop at five metres (half a minute in the game) before the surface; up too fast
  and the computer warns. Back aboard, aft to the wheel and *Take the helm* before the throttle
  answers again (with her skipper walking the deck the keys walk them, not her: on the old lever she
  motored on and hit the quay at eight knots).
- **Anchoring at the reef:** at a walking pace on to the anchorage (off the plane she carried her
  way fifty metres past it). See below for where.
- **Back to the boat after the dive** (step 10 failed now and then, and once in three runs on
  W7): she was swum back to the boat 0.6 m down and left there. A diver climbs out only at the
  surface (her back 0.28 m under the wave) and within reach of the hull; on scuba she's neutral,
  so at 0.6 m she stayed at 0.6 m, counting as at the surface only while a trough passed over. The
  script now brings her up until the game's own test says she's at the surface, then climbs out,
  and swims back alongside and tries again if not; the depth, whether she's surfaced and how far
  off the hull she is are written out either way.
- **Down past ten metres on the reef.** The swim along the reef can end over a shallower knoll
  (once at 7.9 m), and above ten metres no safety stop is due, so the check that she made one
  failed. The script now takes her down past ten metres there before coming up.
- **Home into the marina in the stiffer blow** (failed about one run in four or five, and in two of
  three on W7: she was found 21 m south of her berth, in the next slot, and the anchor went down).
  At dead slow (a tenth of the lever) she barely moved ahead while the 10.8 m/s breeze set her
  half a metre a second to leeward, and the script steered by her heading. Now it steers by her
  course over the ground once she's moving (from 0.4 m/s), as a helmsman does in a crosswind, with
  a little more way on in the marina (0.25 and 0.18 of the lever, not 0.2 and 0.1). In the run
  that passed she came alongside the far side of her own finger, at the console's berth, about
  8 m from her own: the check asks only that she's tied up.

- **The night aboard when the day runs late.** The check asked that they sleep more than two
  hours, and wake before eight. When they turn in goes with how long the day took, from half past
  nine to past midnight in most runs; in one on #189's script they turned in at 2:58 am, chose the
  dawn at 4:10, slept till it, and the night's two checks failed. They now ask what the step says:
  that Mags slept till the dawn she chose (woken within a quarter of an hour of it, the clock moved
  on by the time from turning in to it, within the same), and that Bert's clock moved on as far as
  hers.

## Harness artefacts (not the game)

- **The friend's clock trails the host's** by some minutes in the check. Both games are stepped by
  hand, far faster than real time, and the friend's clock follows the host's by real seconds
  (`clock.hear`), as it should over a real connection. In play the two agree to a second or two.
- **A friend's figure and boat are placed when they're drawn:** the script runs the games without
  drawing between steps (for speed), so it draws a second of frames before each screenshot, or a
  friend shows where they were last drawn.
- **Frame times mean nothing here** (software rendering). What's checked is what happens, not how
  fast; real-hardware figures are in `docs/PERFORMANCE.md`.

## Screenshots

In `docs/playthrough/` (runs 15 and 16):

- `rib-loaded.jpg`: her kit strapped down on her deck at the pontoon, before the off.
- `finder.jpg`: Bert's screen offshore, the fish finder open under her, Mags at the helm, birds
  overhead.
- `landed.jpg`: the mackerel just landed and kept, from Bert's side of the RIB.
- `dive.jpg`: Mags on the Hound at 12 m; Bert's marker says where the bug had put him.
- `home-rough.jpg`: home after dark in a 37 km/h wind, her wake glowing with plankton.
- `bivvy-aboard.jpg` (J3): the bivvy roll strapped on her deck beside the stores crate, at the pontoon.
- `night-aboard.jpg` (J3): dawn at anchor on the Hound's shelf, both of them aboard after the night.
