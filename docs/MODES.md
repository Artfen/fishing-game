# Slow Tide: Career and Free Roam, and save slots

Step 1 of the roadmap's "A liveaboard, her tender and two archipelagos" (`ROADMAP.md`): "Career and
Free Roam, and save slots (small, and they decide how the liveaboard is earned; Free Roam has her
from the start)."

## What there is now

- **One game, one way to play it.** A new game starts at the camp with the camp's three boats (the
  rowing boat, the skiff, the kayak), £20 and the first-trip guide. Every other boat is bought at
  Willowhaven Marine Works (the trawler, with her tender, is £9,500) or hired by the day; the
  notice board's work opens up as you're trusted with more (Odd-job hand, Boatman, Skipper,
  Master); nothing else is locked (Las Brasas and the north are there for any boat that can make
  the passage, owned or hired). That's a career already, without the name.
- **One save** in the browser's storage (`slow-tide-save`), with a backup from the start of the
  session, an unreadable one kept aside, and the game before the last "New game" kept aside. A
  downloaded copy can be loaded in its place. Cloud saves (optional) keep one game per account and
  merge what two devices did into it. The desktop app mirrors the save to a file.
- **"How do you like to play?"** (`playstyle.js`) already sets the fight, the fish, casting, the
  engine and the economy together. That's how the game *feels*; Career and Free Roam are what you
  *have*.

## The plan

**M1, two ways to play.** Chosen when a game begins:

- **Career** (as now, and every game from before): the camp's three boats and £20; sell what you
  catch, take work from the board and rise through it, buy the fleet or hire it by the day, the
  liveaboard (£9,500) last of all.
- **Free Roam**: the whole coast from the first morning. Every boat in the fleet is yours, the
  trawler with her tender on her platform afloat at your berth in Willowhaven; every kind of work on
  the board is open (as to a Master); £2,000 in your purse for fuel, paint, fittings and ice. Money
  still comes from the market and the work, and still buys what it buys; the story, the
  adventures, the field guide and the journal are all the same.
- Asked once of a new player (after their name, before "How do you like to play?"); a game from
  before is Career, untouched. Starting over from the journal asks which. Which one a game is shows
  in the journal and on the title screen.
- **Achievements** that Free Roam simply hands you (every boat; Skipper; Master) are only earned in
  a Career. Everything you actually do counts in either.

**M2, save slots.** Three games side by side in this browser:

- The title screen says which game you're about to play (*Game 1 · Career · day 12 · 34 fish*) and
  **Your games** lists all three: each one's way of playing, day, fish, places, purse and when it
  was last played. **Play** one, start a **new game** (Career or Free Roam) in an empty slot, or
  **delete** one you're not playing (asked twice, and offered as a download first).
- The game you're playing stays where the one save always was (`slow-tide-save`), with its backup
  and everything else as before; the others are parked beside it (`slow-tide-slot-2`…) and swapped
  in when you choose one. A switch clears the session backup (so a damaged save can never fall back
  to another game) and never drops a game: if storage is too full to park one, nothing changes and
  it says so.
- **Cloud saves keep Game 1**, as they kept the one game before: the other slots are this
  browser's only, and say so (merging two different games would mix them). **The desktop app**
  mirrors each game to its own file in the saves folder (`slow-tide-save.json`,
  `slow-tide-save-2.json`, `slow-tide-save-3.json`).
- Photographs live in the browser's photo store by their own ids, shared by the slots; deleting a
  game deletes its photographs from it.

*M1 done.* `src/playmode.js`: `state.play` is `'career'` or `'free'` (every older save reads as a
Career, and anything odd as one too). Free Roam's start (`giveFree`, and `main.js`
`startFreeRoam`): all thirteen boats owned, the trawler launched at your berth (the kayak laid up
to make room) with her tender carried on her platform, the board's state marked `free` so
`career()` answers Master, the purse filled to £2,000 with a receipt in the ledger; run once,
whether the game was chosen at the first question or started from the title screen or the
journal. A new player is asked "Career or Free Roam?" after their name and before the play style;
**New game…** in the journal offers *Start over: Career* and *Start over: Free Roam*, keeping your
settings and answers. The journal's save line says which the game is. `achievements.js` leaves out
FLEET, SKIPPER and MASTER in Free Roam.

*M2 done.* `src/slots.js`, through `save.js` `slots`: the index (`slow-tide-slots`) with each
game's line, kept up to date by every save; `switchTo` parks the game being played, puts the other
where the save lives (or nothing, for a new game), clears the session backup, all in an order that
can be undone at each step (a quota error at any of them leaves storage exactly as it was, tested
step by step); the page stops saving the moment a switch is made, so its save on leaving can't
land on the next game. The title screen's line (*Game 2 · Career · day 4*) and **Your games**
(`#games`): play, new (either way), delete with a download first; its keys can't start the game
behind it. Cloud: `cloud.elsewhere` when the game isn't Game 1 (no sync at start, no queue, no
flush; the journal says the account keeps Game 1). Desktop: `save:mirror` takes the slot and
writes its own file, ignoring a slot that isn't one; only Game 1 starts a computer from its file.

Played in the browser from an empty one: named, *Free Roam* chosen (thirteen boats, the trawler at
the berth with her tender on her platform, £2,000), the play style, the guide declined; reloaded
(*Game 1 · Free Roam · day 1*); **Your games** → Game 2 → *New: Career* (three boats, £20, no
opening questions but the guide); back to Game 1 (all as it was); Game 2 deleted (only Game 1's
keys left). No errors.

## Done when

- Tests: a new Free Roam game owns every boat, the trawler afloat with her tender carried, the board
  open as to a Master, its purse; a Career game is the game as it was; old saves load as Career;
  the achievements Free Roam hands out aren't earned there. Slots: switching keeps every game whole
  (written, parked, swapped back unchanged), never falls back to another game's backup, refuses
  when storage is full without losing anything, deletes only what isn't being played; the summary
  follows each save.
- In the browser: a new player chooses Free Roam and finds the trawler at the berth; a second game
  started as Career in slot 2 from the title screen; back to the first and on with it; one deleted.
