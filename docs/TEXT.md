# Slow Tide: less text on the screen

Item 6 of the roadmap's "What's missing" (`ROADMAP.md`): "Too much text. Messages and dialogs are
long, lovely sentences, and several overlap on screen. Short prompts, icons and a cleaner HUD;
less text also makes translation affordable." The art bible (`docs/ART.md`) already set the rule:
"Prompts are one line… A toast is two lines at most; a card four sentences at most. If it needs
more, it belongs in the journal."

## What there is now

Counted from the source (every literal message passed to a toast, a hint, a tip, a question or a
note; each `${…}` counted as eight characters):

| | How many | Median length | Longest | Over the rule |
|---|---|---|---|---|
| Toasts (top right, 340 px: two lines is about 80 characters) | 234 | 77 | 481 (13 lines) | 104 |
| Tips (`teach`, shown once as a toast) | 88 | 137 | 279 | 81 |
| Hints (`flash`, the line at the bottom) | 226 | 61 | 227 | about 60 |
| Questions (`ask`) | 52 | 85 | 412 | a few |

Toasts already wait their turn (one at a time, the same words never twice, held back while a
question is up), so the trouble isn't so much toasts on top of each other as each one being a
paragraph, read while sailing, and gone. The words are good: the voice is the game's. They don't
belong on top of the sea.

## The plan

**T1, short on the screen, whole in the journal.** Every message gets a line for the screen and
keeps its whole words:

- On the screen, a toast or a tip shows its first sentence (or a short line written for it), and
  a small book mark when there's more. A hint (the bottom line) the same, one line.
- The whole words go into the journal: **Your days → What you were told**, the last forty, newest
  first, with the time; kept in the save. Tips always go there, so a tip missed in a busy moment
  is never lost.
- Dynamic messages (built from the world as it is) are split the same way, at the first sentence.

**T2, every message within the rule.** A test reads every message in the source and holds what
reaches the screen to the art bible: two lines for a toast or a tip (about 80 characters), one
line for a hint (90), questions and cards within four or five sentences. The ~130 whose first
sentence is still too long, or whose first sentence isn't the point (an instruction behind a
pleasantry), get a short line written for them, the rest kept for the journal. The first fifteen
minutes first: the guide, the boats' tips, the camp, fuel, the harbour.

**T3, a cleaner HUD.** The *Clean* screen (icons and keys along the top, the weather panel only
while fishing or sailing; `docs/ART.md`) becomes the default for new players; existing players keep
what they chose. Checked at a laptop's size and a phone's that the toast, the hint, the prompts,
the guide card and the place name never sit on top of each other, with all of them up at once.

**T4, icons where they read better.** A tip has a small lamp, a message with more in the journal a
small book; nothing else changes shape. (A catalogue for translation is left for when there's a
language and a translator to do it: what T1 and T2 do, short screen lines separate from the
journal's words, is most of the work it would need.)

## Done when

- The test passes: no message in the source puts more than the rule on the screen, with a short,
  explained list of exceptions (the bothy book and other pages you read, which are cards).
- In the browser: the first fifteen minutes played as a new player, every toast two lines or
  fewer, every tip in the journal in full; a laptop and a phone with everything up at once and
  nothing overlapping.
