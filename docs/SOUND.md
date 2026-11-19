# Slow Tide: recorded sound

Step 7 of the roadmap's agreed plan (`ROADMAP.md`): "Sound (recordings for texture, synthesis for
response, everything stored locally)". The art bible, the story, the shorter text and the cleaner
screen are done; this is the part that was left: "recorded sound (each file's licence checked and
kept)".

## What there is now

Every sound is made as it plays (`src/audio.js`): filtered noise for the water, the surf, the wind
and the rain; small oscillator gestures for the birds; the reel's clicks on the audio thread; the
engines from their revs. That's what makes it *respond*: the surf grows with the swell, the wind
with the gusts, the drag with the fish. What noise can't give is *texture*: the irregular hiss and
drag of a real wave up a beach, rain on leaves, a halyard tapping a mast, a herring gull.

## The rule for recordings

- **Only recordings anyone may use for anything**: public domain or CC0. The repository is public,
  so a file in it is a file given away; nothing whose licence restricts that (no "non-commercial",
  no "share-alike", no "may not be redistributed": that rules out the BBC's, most of xeno-canto's
  and the Sonniss bundles' raw files).
- **Each file's provenance kept beside it**: where it came from, who recorded it, its licence as the
  source states it, and what was done to it (`src/soundFiles.js`, and `assets/sounds/SOURCES.md`).
  A test holds every file in `assets/sounds/` to that: listed, licensed, small.
- **Reproducible**: `tools/sounds.mjs` fetches each source and makes the game's files from it
  (trimmed, mono, levelled, a seamless loop where it loops). Running it again makes the same files.
- **Stored locally**: the files are part of the game (the offline copy and the desktop app carry
  them); nothing is fetched while playing.
- **Synthesis stays**: recordings lie under the made sound, never instead of it. A file that can't
  be loaded (or a computer short of memory) leaves the game sounding as it did.

The sources found (licences read from each source's own record):

| What | Where | Recordist | Licence |
|---|---|---|---|
| Small waves on a sandy beach (Nexø, Denmark) | radio aporee, on archive.org | Benjamin Trimoreau | Public domain, as marked by the recordist (Public Domain Mark 1.0) |
| Strong sea waves on a shingle beach (Brighton) | radio aporee, on archive.org | Rory Smith | the same |
| A marina: ropes striking a mast, gulls (Gdynia) | radio aporee, on archive.org | wpioter | the same |
| Light rain in woods, distant thunder | Freesound, via Wikimedia Commons | kvgarlic | CC0 1.0 |
| A herring gull's flight calls (Normandy) | xeno-canto, via Wikimedia Commons | Sonothèque ADVL | CC0 1.0 |

(Also looked at, and not used: the U.S. National Park Service's sound gallery, public domain, whose
clips are five or six seconds long, too short to loop, and whose western gull is mostly
background; Kenney's and Freesound's sites, which this computer couldn't reach.)

(The Public Domain Mark is meant for works already out of copyright; a recordist marking their own
recording with it means to give it away, which is how radio aporee offers it. CC0 would be the
surer form. Noted here so it can be swapped for a CC0 recording if that's ever wanted.)

## The plan

**S1, the files.** The six sources above made into the game's files by `tools/sounds.mjs`: three
loops of the sea's edge and the harbour (about 30 s each), one of rain, and a handful of single gull
calls; mono, levelled to the same loudness, MP3 at 64 kbps (about 1.5 MB in all). A loop is made
seamless (its end cross-faded into its start) and padded a quarter-second either side with its own
continuation, so it loops without a click whether or not the browser trims the MP3's start.

**S2, under the made sound.** `audio.js` loads them in the background after the sound starts:
- the shore: the small waves when the sea's calm, the strong ones as it rises, by how near the
  water's edge you are (the same "land" the made surf follows), quieter in a cove;
- the harbour: the halyards and gulls of a marina by your own pontoon, Willowhaven's, Puerto
  Brasa's and Halvig's (the same "harbour" the quay's slaps follow);
- the rain, with the made rain, by how hard it's raining (muffled indoors, as the made rain is);
- a gull's call: when the game calls for a gull, a recorded call (its pitch varied a little, placed
  and muffled as the made one is), the made one only if none is loaded.
The volumes in Settings → Sound (waves, rain, surroundings) govern them as they do the rest.

**S3, carried and checked.** Into the offline copy (`tools/build-sw.mjs`) and so the desktop app.
Tests: every file listed and licensed, the loops' padding and lengths as the engine expects, the
whole under its size; `audio.js` picks them up and falls back. In the browser: they load, decode
and play (heard as level on the bus) at the shore, in the harbour and in the rain.

*S1 to S3 done.* **The files** (`tools/sounds.mjs` from `src/soundFiles.js`): four loops, the calm
shore (28 s), the rough shore, the harbour and the rain (30 s each), and four of the herring gull's
calls; each segment chosen as the steadiest stretch of its source (the least change in loudness,
no jump more than 10 dB over the rest), the rain high-passed at 220 Hz to take out its distant
thunder; 976 KB in all, listed with their sources in `assets/sounds/SOURCES.md`. Their seams
checked after encoding: each loop's padding still matches its other end (correlation 0.95 to
0.999). **In the sound** (`audio.js`): loaded in the background once the sound starts, each loop a
bed of its own under the made one (the made surf and rain eased back where a recording carries
them); a gull's call from a recording, a little higher or lower each time. **Halvig** counts as a
harbour now, for its halyards (measured from its pier). **Measured in the browser** (Chromium
decodes all eight; levels in dB on taps): on a calm shore the small waves at -34 beside the sea's
wash at -34; on a rough one the big waves at -30 beside -28; in the harbour the marina at -35; in the
rain the recording at -32 beside the made rain at -33; at sea, none of them. **Walked round the
coast**: on your pontoon at Willowhaven the shore and the harbour (0.20, 0.16), on the camp's
beach the small waves (0.18), out in the bay nothing, on Halvig's pier both (0.21, 0.30). No
errors. **Tests** (`tests/recordings.test.mjs`): every file listed, sourced and public domain or
CC0, the files' format and lengths as listed (read from the MP3s themselves), under 2 MB, in the
offline copy; in the game, each loop where it belongs and silent elsewhere, a recorded gull, and
with no files the made sound as before.

## Done when

- `tests/sound.test.mjs`: every file in `assets/sounds/` listed with its source, recordist and a
  licence of public domain or CC0; the set under 2 MB; the manifest and the files agree.
- In the browser: each loop playing where it should and silent where it shouldn't; a gull call from
  a recording; nothing broken with the files missing.
