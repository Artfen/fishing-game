# Languages

Slow Tide plays in **English, Spanish or French**: every word it puts on the screen, from the title
screen and Settings to the hints, the tips, the journal, the field guide, the people you meet, the
jobs and the boat yard.

## Choosing one

- **The title screen** has a Language list under the version line; **Settings → You → Language**
  has the same three. Changing it saves the game and starts it again in the new language (a page
  reload: the words are chosen before anything else loads).
- **A new player** (nothing saved in this browser yet) starts in the browser's own language if
  it's Spanish or French, otherwise English. Anyone already playing stays in English until they
  choose otherwise. The choice is kept in `localStorage` under `slow-tide-lang`.

## How it works

- **`src/i18n.js`**: `$t`. Every word the game shows is written in English in the source and
  passed through it: `$t('Pack')`, or as a tag, `` $t`Drop the anchor first (${key}).` ``. A tag's
  key is its English with each part numbered: `Drop the anchor first ({0}).`. With Spanish or
  French chosen, `$t` looks the key up in that language's book and fills the parts in where the
  translation puts them (`{1} peces frente a {0}`); a key not in the book shows in English.
  `translatePage` puts the page's own words (index.html: headings, buttons, labels a screen reader
  reads) into the language as the game starts. `pickLang` and `keepLang`: the choice.
- **`src/boot.js`**: the page's script. It picks the language, loads that book
  (`src/i18n/es.js` or `fr.js`, about 1 MB each, only the one in use), puts the page's words into
  it, then loads the game (`src/main.js`). So everything set up as the game starts (the fish, the
  places, the boats, Settings) comes in the language too.
- **`src/i18n/es.js`, `src/i18n/fr.js`**: the books, `{ "<English key>": "<translation>" }`.
- **`tools/i18n-keys.mjs`**: every key the game has (each `$t` in src, and the page's words), read
  straight from the source. `node tools/i18n-keys.mjs` counts what each book has and lists what's
  missing; `--missing` prints the missing keys as JSON, ready to translate.

## Adding words to the game

Write the English in `$t` as usual (`$t('…')`, or `` $t`… ${part} …` ``), then add the key to both
books with its Spanish and French: the key exactly as `tools/i18n-keys.mjs --missing` prints it.
`tests/i18n.test.mjs` fails until every key is in both books, and checks each translation keeps
its parts (`{0}`…), its HTML tags and the spaces at its ends.

What doesn't go through `$t`: names the code goes by (ids, kinds, CSS classes, keys, events), even
when they look like words. A word that's also a name (a hull's name, a tackle box's) is kept apart
from its name: the hull's physics go by her kind (`H.kindId`), the boxes by their own names, which
are never shown.

## The translations

Done in one pass for this release (about 84,000 words of English, each into both languages),
following a shared guide: the game's own voice (plain, warm, quiet; *tú* and *tu* to the player),
one glossary of fishing and boating terms (the throttle's *muesca* and *cran*, *curricán* and
*traîne*, *freno* and *frein* for the drag), each species by its standard common name in Spanish
and French (from the species register, `src/registerData.js`), and names of people and places
left as they are. They've been checked by machine (every key present, parts and tags kept), not
yet read through by a native speaker; corrections are welcome as edits to the books.

## What isn't translated yet

- **The species register's research notes** (`src/registerData.js`, generated from
  `research/register/`): its sources and statuses, read in the field guide's register pages.
- **Numbers** keep a decimal point (7.2 kn), not the comma Spanish and French use.
- **What a friend sends you** when playing together comes in their language (their finds, their
  calls).
- **Words saved before** the language changed (the journal's earlier pages, a catch's note) stay in
  the language they were written in.
