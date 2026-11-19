# Slow Tide: privacy, and the online services

Step 8 of the roadmap ("How it's sold": `ROADMAP.md`) chose, for now, the part that doesn't wait on
accounts or a price: "Co-op and cloud saves run on Supabase's free tier, which won't survive real
popularity; and the online features need a privacy policy (GDPR)." (A demo, selling the download
and Steam wait for decisions: see the end.)

## What there was

- Cloud saves (`src/cloud.js`, `supabase/schema.sql`) and playing together (`src/together.js`) on
  one Supabase project, both optional; the README's "Privacy" paragraph saying what they keep.
- No privacy page; no way for a player to have their cloud data or to delete it (only the operator
  could, from Supabase's dashboard). A player's right to both is the GDPR's (articles 15, 17, 20).
- When the project was paused (Supabase pauses a free project after a week without use) or over its
  limits, the cloud said so as a raw status ("Couldn't sync just now (error 503)"); playing together
  already explained it.

## What's done

**O1, the privacy page** (`privacy.html`, linked from the title screen, the journal's cloud box and
the download page). Written from the code, not from memory: what stays on your device (every key
the game stores, by name; the photographs; the offline copy; the desktop app's files), cloud saves
(what, where, who can see it, how long, why), playing together (what's sent to whom, nothing kept),
the site and downloads (the host's logs, GitHub for the installers and the update check), and your
rights, with what you can do yourself in the game. No cookies, analytics or ads, because there are
none. **Four blanks for whoever runs the game**, highlighted on the page and listed in a comment at
its top: who runs it, a contact address, the Supabase project's region, how long the host keeps its
logs. (It isn't legal advice: read it against your own setup before it goes live.)
`tests/privacy.test.mjs` reads every `slow-tide-…` name in the code and fails if the page doesn't
mention it, so a new kind of stored data can't go unmentioned (it found two on the way: the offline
copy's runtime cache, now listed, and a gift code's fingerprint text, which isn't stored).

**O2, your cloud data, yourself.** In the journal's cloud box, signed in:
- **Download my cloud save**: the save as it is in the cloud, as a file "Load a saved copy" takes.
- **Delete my cloud data…**: asked once; deletes the save and the account (the sign-in record with
  the email address) through `delete_my_account()`, a database function (`supabase/schema.sql`)
  that only ever deletes the caller's own, refuses when signed out, and runs with no search path to
  hijack. On a backend set up before it existed, the save alone, and the game says the email
  address is still held and who to ask. The game in the browser is untouched either way.
- Operators: run `supabase/schema.sql` again (it's safe to re-run) to add the function.

**O3, a paused or full service in plain words.** The cloud now says "the cloud service isn't
answering: it may be paused, and whoever runs this copy of the game can restore it" (a 540, 503 or
52x), "has reached its plan's limits for now" (402, or a quota message), "too many requests just
now" (429), instead of a status number; your progress is safe in the browser and syncs when it's
back. Playing together already said as much.

## The free tier, worked out

Supabase's free plan (its pricing page, November 2026): 500 MB of database, 50,000 monthly active
users, 5 GB egress, Realtime 200 concurrent connections and **2 million messages a month**, and **a
project paused after a week of inactivity** (restored from the dashboard; the game keeps working
offline meanwhile). Pro is $25 a month: 500 connections, 5 million messages, then $2.50 a million.

- **Cloud saves** are small: a save is tens to a few hundred kilobytes (the database refuses over
  2 MB), pushed fifteen seconds after a change and pulled at start. 500 MB holds thousands of
  players; egress of 5 GB is tens of thousands of syncs. Not the limit.
- **Playing together** is. From `together.js`: while you move, your position goes four times a
  second (every three seconds while you keep still), your boats every five, and the host's world
  every two. If Supabase counts a message once sent and once for each player it reaches:

  | Session, everyone moving | Messages a second | Hours a month on 2 million |
  |---|---|---|
  | Two players | about 18 | about 30 |
  | Four players | about 70 | about 8 |
  | Eight players | about 270 | about 2 |

  (Sitting still fishing, a tenth of that.) So the free tier carries friends trying it out, not a
  public launch with co-op; on Pro, the same four players for about 20 hours a month before it
  costs more. If that matters, the cheapest lever is the position rate (four a second; the others
  smooth it out between messages, so two might do), measured in play first.
- **Sign-in emails**: Supabase's own sender allows only a few an hour; real players need the
  operator's own SMTP (the README says how).
- **The pause**: a free project unused for a week stops answering. The cloud and playing together
  say so in plain words, and nothing is lost; whoever runs the game restores it from the dashboard.
  (Pinging it to keep it awake is possible, but a game with players keeps itself awake.)

## Not done, waiting on decisions

- **A free demo** of the download, **selling the download** (itch.io, or a merchant of record such as
  Paddle or Lemon Squeezy: VAT is the hard part), and **Steam** (a Steamworks account and an app
  id): each is a choice about money and accounts.
- The privacy page's blanks, and whether the host's logs need more said for your host.
