import { WRECK, WRECK_BELL, PUNT, DAYMARK, SHELTER, CALF, CALF_SKERRY } from './world/terrain.js';
import { fishById } from './fish.js';

// Small adventures on the cove shore: a clue to start each (a notice at Willowhaven, a page
// found in the grass), something to find or do, and a modest reward (a keepsake, a page in your
// journal, a little knowledge). Nothing is timed, nothing is a quota, and nothing makes you do a
// thing twice: anything you've already found or done counts, even if you did it before you
// came across the clue (the adventure simply recognises it when you do).

export const KEEPSAKES = {
  chart: { name: 'The Kittiwake’s photograph', text: 'A copy of the old photograph from the notice board, her place pencilled on the back: nine metres down, south of Shell Strand, the buoy over her bow.' },
  notebook: { name: 'Ada’s notebook', text: 'Three pages in a blue cloth cover, damp-stained and complete again: the cove channel, Cove Head and Shell Strand, as Ada Marr fished them.' },
  feather: { name: 'A gull’s feather', text: 'Grey and white, picked out of the water where the birds were diving. A reminder to watch the sky.' },
  deckchair: { name: 'A striped deckchair', text: 'From the chandlery, for the photograph on its wall. It folds up small; put it out at your camp.' },
  bell: { name: 'The Kittiwake’s bell, photographed', text: 'Your photograph of her bell where it lies in the sand by her bow, green with age, KITTIWAKE · 1907 still raised round its rim. The chandlery has the print; the bell stays with her.' },
  plug: { name: 'Bert’s pike plug', text: 'A battered striped wooden plug, its paint chewed to the wood: the lure that caught Bert Hale’s 72 cm pike off the Mere Boathouse in 1984. He gave it to you when you beat his record.' },
  sandeel: { name: 'Hettie’s sandeel', text: 'A soft sandeel lure, faded and nicked, that rode on Hettie Moss’s hat for years: “more bass than I’ve had hot dinners”. Hers, until your big bass.' },
  drawing: { name: 'Kit’s drawing', text: 'A crayon drawing by Kit: you, a very small boat, and a very large whale, blowing. “TO MY FREND” across the top.' },
  hook: { name: 'Chano’s hook', text: 'A big old hand-forged hook from Chano’s tin, his father’s, given for luck after you photographed the grouper still living in El Bajón’s cave.' },
  slate: { name: 'Tam’s slate', text: 'A roofing slate from the watch tower on the Calf, scratched with forty years of tally marks: the seals on the skerry, counted every morning. In one corner, “bass off the Nose at the top of the tide; mackerel in the race when the terns are working”.' },
};

// steps: each has an id, what to do, and (for the ones the world settles by itself) a check
// against the game as it is right now: ctx = { onFoot, player, boat, underwater, cam, flocks,
// diving, depth }.
export const ADVENTURES = [
  {
    id: 'kittiwake',
    title: 'The Kittiwake',
    clue: 'An old photograph on the notice board: a wooden steam drifter, the Kittiwake, lost on the reef in a winter gale. Pencilled underneath: “She lies off Shell Strand, under the black and red buoy. Bow to the north-east, nine fathoms of rope to her.”',
    where: 'The notice board at Willowhaven',
    steps: [
      {
        id: 'found', text: 'Find where she lies',
        check: (c) => !c.onFoot && Math.hypot(c.boat.x - WRECK.x, c.boat.z - WRECK.z) < 28,
        done: 'You’re over the Kittiwake: the buoy rocks beside you, and her shadow lies on the sand below.',
      },
      {
        id: 'seen', text: 'See her for yourself, under the water',
        check: (c) => c.underwater && Math.hypot(c.cam.x - WRECK.x, c.cam.z - WRECK.z) < 28,
        done: 'Under the water the Kittiwake lies over on her side: her ribs, her boiler, the stump of her funnel, with fish hanging in the gaps.',
      },
    ],
    end: 'You’ve found the Kittiwake and seen her for yourself. A conger lives in her hull, and pollack and wrasse hang over her ribs: worth a bottom rig with fish strip, or a shad worked slowly over her. Her place is on your map, and the old photograph is yours to keep.',
    reward: { keepsake: 'chart' },
  },
  {
    id: 'notebook',
    title: 'Ada’s notebook',
    clue: 'A page from a notebook, blue ink gone soft with damp, signed “A. Marr”. There may be more of it about.',
    where: 'Anywhere round the cove (the first page you find)',
    steps: [
      { id: 'punt', text: 'The page in the old punt, at the head of Driftwood Cove', page: true },
      { id: 'head', text: 'The page at the foot of the daymark on Cove Head', page: true },
      { id: 'strand', text: 'The page in the driftwood shelter on Shell Strand', page: true },
    ],
    end: 'Ada’s notebook is whole again: the channel, the headland and the strand, how the water changes there with the light and the weather, and what comes to it. Her pages are in your journal now.',
    reward: { keepsake: 'notebook' },
  },
  {
    id: 'gulls',
    title: 'Where the gulls dive',
    clue: 'A notice by the harbour light: “When the gulls are diving, the fish are feeding below. Get there quietly, and see what they’re after.”',
    where: 'The notice board at Willowhaven',
    steps: [
      {
        id: 'near', text: 'Get close to gulls diving over the water',
        check: (c) => c.flocks.some((f) => f.t > 2 && Math.hypot(c.player.x - f.x, c.player.z - f.z) < 45),
        done: 'Gulls wheel and fold and drop into the water all round you. Something is feeding just under the surface.',
      },
      { id: 'catch', text: 'Catch one of what they’re after', done: '' },
    ],
    end: 'Under the birds were bait fish, packed into a ball, with hunters tearing into them from below. From now on the gulls you’ve seen diving are marked on your map for a while: head for them.',
    reward: { keepsake: 'feather', unlock: 'birdMarks' },
  },
  {
    id: 'wall',
    title: 'A gap on the chandlery wall',
    clue: 'On the chandlery’s wall, a pale square where a photograph used to hang, and a card: “Our cuttlefish has faded away. Anyone with a picture of a live one, we’d love to put it up.”',
    where: 'The notice board at Willowhaven',
    steps: [
      { id: 'photo', text: 'Photograph a cuttlefish in the water (from a boat, take the underwater view, then the camera)' },
      { id: 'pinned', text: 'Pin it up at the notice board' },
    ],
    end: 'Your photograph hangs on the chandlery wall, where everyone coming up from the quay can see it. They’ve given you a striped deckchair for your camp.',
    reward: { keepsake: 'deckchair', unlock: 'deckchair' },
  },
  {
    id: 'bell',
    title: 'The Kittiwake’s bell',
    clue: 'A card from the chandlery: “The Kittiwake’s bell is down there still, they say, in the sand by her bow with her name cast round it. Nine metres: one breath for a good freediver, an easy dive on a tank (we fill tanks). A photograph for our wall, please, and leave the bell where she lies: a wreck is no one’s to take from.”',
    where: 'The notice board at Willowhaven',
    steps: [
      {
        id: 'down', text: 'Dive down to the Kittiwake',
        check: (c) => c.diving && c.depth > 4 && Math.hypot(c.player.x - WRECK.x, c.player.z - WRECK.z) < 16,
        done: 'Down among her ribs: the light green and dim, wrasse picking at the timbers, a conger’s head in the dark of the boiler.',
      },
      { id: 'photo', text: 'Photograph her bell, and leave it where it lies' },
    ],
    end: 'There she is in your picture: the bell on its side in the sand, green with age, KITTIWAKE raised round the rim. The chandlery pins it up by the door, and the bell stays where she lost it.',
    reward: { keepsake: 'bell' },
  },
  {
    id: 'watch',
    title: 'The watcher on the Calf',
    clue: 'A card in faded ink, pinned low on the board: “Tam Leask kept the watch on the Calf for forty years, and counted the seals on the skerry every morning. His tallies are on a slate in the tower still, they say. By boat from the quay, west along the coast: the Calf lies just off Heron Point. Mind the race in the Sound.”',
    where: 'The notice board at Willowhaven',
    steps: [
      {
        id: 'landed', text: 'Land on the Calf',
        check: (c) => c.onFoot && Math.hypot((c.player.x - CALF.x) / (CALF.rx + 2), (c.player.z - CALF.z) / (CALF.rz + 2)) < 1,
        done: 'Ashore on the Calf: short turf, sea pinks, and the roar of the race below the cliffs.',
      },
      {
        id: 'seals', text: 'Watch the seals on the skerry',
        check: (c) => Math.hypot(c.player.x - CALF_SKERRY.x, c.player.z - CALF_SKERRY.z) < 36,
        done: 'Grey seals hauled out on the skerry, heads up, watching you back. One slides off into the water without a splash.',
      },
      { id: 'slate', text: 'Find Tam’s slate in the watch tower' },
    ],
    end: 'Tam’s tallies go back further than anyone remembers: the seals on the skerry, morning after morning, in pencil-thin strokes. In one corner, the only words: “bass off the Nose at the top of the tide; mackerel in the race when the terns are working”. Calf Sound is on your map now.',
    reward: { keepsake: 'slate', places: ['sound'] },
  },
];
export const ADVENTURE_BY_ID = Object.fromEntries(ADVENTURES.map((a) => [a.id, a]));

// Ada's pages: where each lies, and what it says (about the real water there, and the fish the
// game puts there).
export const PAGES = {
  punt: {
    at: PUNT, where: 'tucked under the old punt’s seat', title: 'Ada’s notebook: the channel',
    text: 'The channel into Driftwood Cove is never rough: whatever the sea does outside, in here it’s glass. Eelgrass along the edges hides the cuttlefish, and the bream and wrasse work the stones. Come at dusk: the light goes and the bigger fish come in. A float with a prawn, close in. — A. M.',
  },
  head: {
    at: DAYMARK, where: 'folded into a crack at the daymark’s foot', title: 'Ada’s notebook: the headland',
    text: 'Cove Head takes the swell full on. Where it breaks white on the ledges the bass hunt, and the white bream pick crabs off the rocks. A metal or a sandeel cast into the wash, wound back through the foam. Watch the sea: on a big day, stand well back. — A. M.',
  },
  strand: {
    at: SHELTER, where: 'wedged in the driftwood shelter', title: 'Ada’s notebook: the strand',
    text: 'Shell Strand at the turn of the light: bass come right into the surf, a rod’s length out. After dark the flatfish come up the sand: plaice and sole, on a worm laid on the bottom. The shelf above the beach is the driest bed on the coast. — A. M.',
  },
};

const when = (state) => ({ day: state.day, hour: Math.round(state.hour * 100) / 100 });

// Keeps the adventures' state in the save: state.adventures[id] = { clue, steps, done }.
export class Adventures {
  // hooks: { note(title, text) (a card), toast(text), save(), unlock(id), keepsake(id) }
  constructor(state, hooks) {
    this.state = state;
    this.h = hooks;
    state.adventures = state.adventures || {};
    state.keepsakes = state.keepsakes || {};
    state.unlocks = state.unlocks || {};
  }

  rec(id) {
    const a = this.state.adventures;
    if (!a[id]) a[id] = { clue: null, steps: {}, done: null };
    return a[id];
  }

  // 'unknown' (not come across), 'clue' (clue found, nothing done), 'progress', 'done'.
  status(id) {
    const r = this.state.adventures[id];
    if (!r) return 'unknown';
    if (r.done) return 'done';
    if (!r.clue) return Object.keys(r.steps).length ? 'unknown' : 'unknown';
    return Object.keys(r.steps).length ? 'progress' : 'clue';
  }

  // You've found the clue (read the notice, picked up a page).
  clue(id) {
    const A = ADVENTURE_BY_ID[id], r = this.rec(id);
    if (r.clue) return false;
    r.clue = when(this.state);
    const already = A.steps.filter((s) => r.steps[s.id]);
    if (already.length && already.length < A.steps.length) this.h.toast(`${A.title}: you’ve already ${already.map((s) => s.text.charAt(0).toLowerCase() + s.text.slice(1)).join(', and ')}.`, 7);
    this.finish(id, true);
    this.h.save();
    return true;
  }

  // A step done (by you, or by the world's checks). Before the clue, it's quietly remembered.
  step(id, stepId) {
    const A = ADVENTURE_BY_ID[id], r = this.rec(id);
    if (r.steps[stepId] || r.done) return false;
    r.steps[stepId] = when(this.state);
    const S = A.steps.find((s) => s.id === stepId);
    if (r.clue && S?.done) this.h.toast(S.done, 7);
    this.finish(id, false);
    this.h.save();
    return true;
  }

  finish(id, fromClue) {
    const A = ADVENTURE_BY_ID[id], r = this.rec(id);
    if (r.done || !r.clue || !A.steps.every((s) => r.steps[s.id])) return;
    r.done = when(this.state);
    if (A.reward.keepsake) this.state.keepsakes[A.reward.keepsake] = when(this.state);
    if (A.reward.unlock) this.state.unlocks[A.reward.unlock] = true;
    // (Places it shows you: on your map, as if you'd been there.)
    for (const p of A.reward.places || []) if (this.state.places && !this.state.places[p]) this.state.places[p] = when(this.state);
    const kept = A.reward.keepsake ? KEEPSAKES[A.reward.keepsake] : null;
    // ("a gull’s feather", but "Ada’s notebook": only an article goes small mid-sentence.)
    const name = kept && /^(A|An|The) /.test(kept.name) ? kept.name.charAt(0).toLowerCase() + kept.name.slice(1) : kept?.name;
    this.h.note(fromClue ? `${A.title}: already done` : A.title, `${fromClue ? 'You’ve done this already, before you knew to. ' : ''}${A.end}${kept ? ` Kept in your journal: ${name}.` : ''}`, id);
  }

  // The world's own checks, a couple of times a second (cheap: a handful of distances).
  check(ctx) {
    for (const A of ADVENTURES) {
      const r = this.state.adventures[A.id];
      if (r?.done) continue;
      for (const S of A.steps) {
        if (!S.check || r?.steps[S.id]) continue;
        if (S.check(ctx)) this.step(A.id, S.id);
      }
    }
  }

  // Things that happen: a catch near the gulls, a photograph with a cuttlefish in it.
  caught(sp, x, z, flocks) {
    if (flocks.some((f) => Math.hypot(x - f.x, z - f.z) < 70)) {
      const r = this.rec('gulls');
      // (You need to have been near the birds; catching one first then counts both.)
      if (!r.steps.near) this.step('gulls', 'near');
      this.step('gulls', 'catch');
      return fishById[sp]?.name;
    }
    return null;
  }

  photographed(photo) {
    if (photo.subjects.species.includes('cuttlefish')) this.step('wall', 'photo');
    if (photo.subjects.bell) this.step('bell', 'photo');
  }

  // Ada's page at a spot: found, read, kept.
  page(id) {
    const r = this.rec('notebook');
    const first = !r.clue;
    if (first) r.clue = when(this.state);
    this.step('notebook', id);
    return { first, count: Object.keys(r.steps).length, done: !!r.done };
  }

  pagesFound() {
    return Object.keys(this.state.adventures.notebook?.steps || {});
  }

  // The list for the journal: those you've come across (a clue, or a step done).
  list() {
    return ADVENTURES.map((A) => ({ A, r: this.state.adventures[A.id] || null }))
      .filter(({ r }) => r && (r.clue || Object.keys(r.steps).length));
  }
}
