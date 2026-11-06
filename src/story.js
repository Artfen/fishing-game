// The Fifth Name: a story with an ending, threaded through the places and adventures the game
// already has (the Kittiwake and her bell, Tam Leask's slate on the Calf, Gannet Light, Puerto
// Brasa across the ocean) and finished with a trip out to the wreck at dusk with Wenna aboard.
//
// The Kittiwake (WH 27) went down on the reef in the February gale of 1931 with five aboard. The
// sea gave back four; the fifth, the cook's boy Joe Penhallow, fourteen, was never found. He was
// taken off the rocks of Gannet Isle by a Spanish trawler, the Virgen del Carmen, and lived out his
// life in Puerto Brasa as José: Chano's grandfather. He never went home.
//
// One chapter at a time, in order, each finished by something the game already knows (an adventure
// done, a place reached); anything done before its chapter counts when its turn comes (one card at
// a time, a few seconds apart, never a flood). Nothing is timed but the last scene, which wants the
// evening light. The record lives in the save: state.story = { ch, at: { id: { day, hour } },
// wenna (the boat she's aboard, or null), laid, last }.

export const STORY_TITLE = 'The Fifth Name';
const GAP = 12; // s between one chapter's card and the next, when several are already done

// x (the world as the story reads it): { adv (state.adventures), near: { light, puerto, office,
// buoy } (metres), home (afloat and stopped in Willowhaven's harbour), boat (the kind you're in
// afloat, or null), seats (passengers she takes), slow, dusk (the evening light), when }.
export const CHAPTERS = [
  {
    id: 'wreck', title: 'The Kittiwake',
    todo: 'Find the Kittiwake: her old photograph is on the notice board at Willowhaven.',
    done: (x) => !!x.adv?.kittiwake?.done,
    card: { title: STORY_TITLE, kind: 'kittiwake', text: 'Old Bert, when you show him the photograph: “WH 27. My grandad helped build her. She went down on the reef in the February gale of 1931, five aboard, and the sea gave back four. Their names are on the stone by the harbour office. The fifth was a boy, and he’s never been found.” The chandlery’s card about her bell is on the board.' },
  },
  {
    id: 'bell', title: 'Her bell',
    todo: 'Dive to the Kittiwake’s bell and photograph it (the chandlery’s card on the board).',
    done: (x) => !!x.adv?.bell?.done,
    card: { title: 'The fifth name', kind: 'bell', text: 'Wenna, at the harbour office, looks at your photograph a long time. “The boy was Joe Penhallow, the cook’s boy, fourteen: my grandmother’s little brother. She kept a light in the window for him till she died. Tam Leask on the Calf always said he saw lights going south that night. Nobody listened. His slate’s out there in the watch tower still.”' },
  },
  {
    id: 'slate', title: 'Tam’s slate',
    todo: 'Find Tam Leask’s slate in the watch tower on the Calf (the faded card on the board).',
    done: (x) => !!x.adv?.watch?.done,
    card: { title: 'On the back of the slate', kind: 'watch', text: 'Scratched deep into the back of Tam’s slate, older than the tallies: “9 Feb 31. 4 in the morning. Lights south of Gannet Light. A trawler, Spanish rig, not ours. Ask the keeper.” The keeper’s long gone, but they say the light still keeps his log.' },
  },
  {
    id: 'light', title: 'The keeper’s log',
    todo: 'Read the old keeper’s log at Gannet Light, out past the Skerries.',
    done: (x) => (x.near?.light ?? Infinity) < 120,
    card: { title: 'The keeper’s log', kind: '', text: 'In a tin box in the lamp room, the ink gone brown: “9 February 1931. SW gale moderating. Spanish trawler VIRGEN DEL CARMEN sheltered in Puffin Cove overnight. At first light her master took a boy off the rocks at the cove mouth, half drowned, and would not wait for the weather. Sailed south.” South, across the ocean, is Puerto Brasa.' },
  },
  {
    id: 'south', title: 'The Virgen del Carmen',
    todo: 'Find out where the Virgen del Carmen went: across the ocean, at Puerto Brasa.',
    done: (x) => (x.near?.puerto ?? Infinity) < 80,
    keepsake: 'letter',
    card: { title: 'Virgen del Carmen', kind: '', text: 'Chano, on the harbour steps, goes very still at the name. “My boat is named for her. She was my great-grandfather’s trawler, and the boy they took off the rocks was my grandfather. José, they called him. He never spoke of the north: he thought they’d blame him for living when the others didn’t.” He brings you an envelope, old and never posted, to a Miss Penhallow, Willowhaven. “Take him home.”' },
  },
  {
    id: 'home', title: 'Home',
    todo: 'Take José’s letter home to Wenna at Willowhaven’s harbour office.',
    done: (x) => (x.near?.office ?? Infinity) < 25 || !!x.home,
    card: { title: 'The letter', kind: '', text: 'Wenna reads it twice on the harbour office step, then folds it small. “Nearly sixty years he was alive, over there, and Grandma never knew.” She looks out at the bay. “Would you take me out to her at dusk? To the Kittiwake. I’d like to tell her.”' },
  },
  {
    id: 'dusk', title: 'At dusk',
    // (Its own steps: Wenna aboard at Willowhaven, out to the buoy in the evening light, home.)
    todo: null,
    done: (x, S) => S.laid && !!x.home && x.boat === S.wenna,
    card: { title: STORY_TITLE, kind: 'kittiwake', text: 'In the morning there’s a new line cut into the stone by the harbour office, under the other four: JOSEPH PENHALLOW · 1917–1989 · CAME HOME. Wenna has pinned José’s letter beside it, and a photograph of Chano’s boat. That’s the Kittiwake’s story told. The sea goes on, and all of it is still out there: the fish, the work, your friends, the weather.' },
    keepsake: 'stone',
  },
];
export const CHAPTER_IDS = CHAPTERS.map((c) => c.id);

export const newStory = () => ({ ch: 0, at: {}, wenna: null, laid: false, last: -Infinity });
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const whenOk = (w) => isObj(w) && Number.isFinite(w.day) && Number.isFinite(w.hour);
export function cleanStory(raw, kinds = null) {
  const S = newStory();
  if (!isObj(raw)) return S;
  S.ch = Number.isInteger(raw.ch) ? Math.max(0, Math.min(CHAPTERS.length, raw.ch)) : 0;
  if (isObj(raw.at)) for (const [k, v] of Object.entries(raw.at)) if (CHAPTER_IDS.includes(k) && whenOk(v)) S.at[k] = { day: v.day, hour: v.hour };
  // (Wenna aboard only while the last scene is on, and only in a boat there is.)
  if (CHAPTERS[S.ch]?.id === 'dusk' && typeof raw.wenna === 'string' && (!kinds || kinds.includes(raw.wenna))) S.wenna = raw.wenna;
  S.laid = !!(S.wenna && raw.laid);
  return S;
}

export const finished = (S) => S.ch >= CHAPTERS.length;
export const begun = (S) => S.ch > 0;
export const current = (S) => CHAPTERS[S.ch] || null;

// What to do now, in a line (for the journal and the map), or null when it's all told.
export function todo(S) {
  const C = current(S);
  if (!C) return null;
  if (C.id !== 'dusk') return C.todo;
  if (!S.wenna) return 'Take Wenna out to the Kittiwake’s buoy at dusk: she’s waiting at Willowhaven (any boat with a seat).';
  if (!S.laid) return 'Out to the Kittiwake’s buoy, south of Shell Strand, in the evening light.';
  return 'Bring Wenna home to Willowhaven.';
}

// Where it wants you next (for the map and the marker): 'light', 'puerto', 'office', 'haven',
// 'buoy', or null (the chapters the adventures mark themselves, or none).
export function aim(S) {
  const C = current(S);
  if (!C) return null;
  if (C.id === 'light') return 'light';
  if (C.id === 'south') return 'puerto';
  if (C.id === 'home') return 'office';
  if (C.id === 'dusk') return S.wenna && !S.laid ? 'buoy' : 'haven';
  return null;
}

// What Wenna weighs in a boat of kind `kind` (kg): she's aboard for the last scene.
export const storyKg = (S, kind) => (S.wenna && S.wenna === kind && !finished(S) ? 80 : 0);

// A couple of times a second. now: seconds (for the pacing); x: as above. Returns what happened:
// { card, keepsake, toast } or null.
export function tick(S, x, now) {
  const C = current(S);
  if (!C) return null;
  if (C.id === 'dusk') {
    // Aboard at Willowhaven, in a boat with a seat; out to the buoy in the evening light, slowly;
    // home. (Into another boat at Willowhaven before you've gone: she comes too.)
    if (x.home && x.boat && x.seats >= 1 && !S.laid && S.wenna !== x.boat) {
      const first = !S.wenna;
      S.wenna = x.boat;
      return { toast: first ? 'Wenna steps aboard with an armful of sea pinks from her garden. Out to the Kittiwake’s buoy as the sun goes down.' : 'Wenna moves across with her flowers.', aboard: true };
    }
    if (S.wenna && !S.laid && x.boat === S.wenna && (x.near?.buoy ?? Infinity) < 30 && x.slow) {
      if (!x.dusk) return S._told ? null : ((S._told = true), { toast: 'Wenna looks at the sky. “Not yet. When the sun’s going down.”' });
      S.laid = true;
      return { toast: 'Wenna lays the sea pinks on the water by the buoy and says the five names, the fifth one last. They drift off over the wreck. “Home now.”', laid: true };
    }
  }
  if (now - S.last < GAP) return null;
  if (!C.done(x, S)) return null;
  S.at[C.id] = x.when;
  S.ch++;
  S.last = now;
  if (C.id === 'dusk') S.wenna = null;
  return { card: C.card, keepsake: C.keepsake || null, chapter: C.id, end: finished(S) };
}

// For the journal: the chapters told so far (and the one you're on).
export function chapters(S) {
  return CHAPTERS.slice(0, Math.min(CHAPTERS.length, S.ch + 1)).map((C, i) => ({ C, done: i < S.ch, at: S.at[C.id] || null }));
}
