import { DESTS } from './outing.js';
import { CAR_PARKS, QUAY, BOATHOUSE_PIER, HOME } from './world/terrain.js';
import { HOME_SPOTS } from './world/home.js';

// The first outing, a step at a time: an optional guide for a new player (and for anyone who
// asks for it again from the journal). Home, the workbench, the car, the water, a cast, a fish,
// the journal, and home again or a camp. Each step is done when the game says so (you got to the
// car park, the bait is in the water, a fish is on the catch card), never by a timer, and doing
// a later step first counts the ones before it as done: nothing here is a gate. The words always
// describe the controls you're using and the gear actually on your line.
//
// state.guide: { on, done: { step: true }, dest, offered, finished, min (folded away), since (when
// it began: the catches since then are this trip's) }

export const STEPS = [
  { id: 'plan', title: 'Plan at the workbench' },
  { id: 'drive', title: 'Drive to the water' },
  { id: 'spot', title: 'Find a spot' },
  { id: 'cast', title: 'Cast' },
  { id: 'land', title: 'Land a fish' },
  { id: 'record', title: 'Keep it or let it go' },
  { id: 'back', title: 'Home again, or a camp' },
];
export const STEP_IDS = STEPS.map((s) => s.id);

// Where to fish at each place you can drive to: standing on the shore (or the quay) with deep
// enough water within a cast (see tests/firstTrip.test.mjs), and where the fish there tend to be.
// (The tips come from trying it: at the quay's end the fish keep to the wall, so a long cast
// out into the harbour finds nothing.)
export const FISH_SPOTS = {
  haven: { x: 10, z: -84, name: 'the end of the quay', tip: 'Fish keep close to the quay wall: let go early, for a short cast beside it.' },
  strand: { x: 102.5, z: 28.5, name: 'the surf at the bottom of the beach', tip: 'Fish come in close to the beach: a short cast, just past the breaking waves, is plenty.' },
  head: { x: 180, z: -0.5, name: 'the ledges below the daymark', tip: 'Cast into the wash below the ledges: short or middling.' },
  quay: { x: QUAY.end.x - 1.5, z: QUAY.end.z, name: 'the end of the quay', tip: 'Fish move along the channel: a middling cast out from the end of the quay.' },
  boathouse: { x: BOATHOUSE_PIER.end.x + 1.5, z: BOATHOUSE_PIER.end.z, name: 'the end of the jetty', tip: 'Fish hang about the jetty: a short cast is plenty.' },
};
// Which way the lane goes from home (the workbench says the same).
const LANE_WORDS = {
  haven: 'down the drive and west along the coast lane',
  strand: 'down the drive and south, down to the beach',
  head: 'down the drive and east along the lane to the headland',
};
const BENCH = HOME_SPOTS.find((s) => s.id === 'bench');

const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);

export function cleanGuide(raw) {
  const g = isObj(raw) ? raw : {};
  const done = {};
  if (isObj(g.done)) for (const id of STEP_IDS) if (g.done[id]) done[id] = true;
  return {
    on: !!g.on,
    done,
    dest: DESTS[g.dest] ? g.dest : null,
    offered: !!g.offered,
    finished: !!g.finished,
    min: !!g.min,
    since: typeof g.since === 'number' && Number.isFinite(g.since) ? g.since : 0,
  };
}

// The step you're on (null once they're all done).
export const stepOf = (g) => STEP_IDS.find((id) => !g.done[id]) || null;
export const stepNumber = (g) => { const s = stepOf(g); return s ? STEP_IDS.indexOf(s) + 1 : STEPS.length; };

// A step done: it and everything before it. Returns true if that moved the guide on.
export function complete(g, id) {
  const i = STEP_IDS.indexOf(id);
  if (i < 0 || g.done[id]) return false;
  for (let k = 0; k <= i; k++) g.done[STEP_IDS[k]] = true;
  if (!stepOf(g)) {
    g.finished = true;
    g.on = false;
  }
  return true;
}

export function start(g, now = Date.now()) {
  g.on = true;
  g.done = {};
  g.dest = null;
  g.offered = true;
  g.min = false;
  g.since = now;
}

// Which of the places the car goes you're at, if any (by car or any other way): close to its car
// park or to where you'd fish. Never at home, though Cove Head's car park is only a field away.
export function placeAt(x, z) {
  if (Math.hypot(x - HOME.x, z - HOME.z) < 40) return null;
  return Object.keys(FISH_SPOTS).find((id) => Math.hypot(x - CAR_PARKS[id].x, z - CAR_PARKS[id].z) < 15
    || Math.hypot(x - FISH_SPOTS[id].x, z - FISH_SPOTS[id].z) < 25) || null;
}

// A brand-new game: nothing found, nothing caught (a game that's been played is never "new").
export const isNewGame = (s) => !Object.keys(s.places || {}).length && !(s.log || []).length && !(s.camps || []).length;

// What the guide says now, and where it points. ctx (from the game):
//   key(action) → the key or button, ready to show; touch: on a touch screen; pad: a controller
//   at, carAt: where you and the car are ('home', a destination id or null); driving; nearCar;
//   plan: the workbench's plan; rig: 'a worm on the float rod'; kind: the rig's kind
//   caught: fish in the journal since the guide began; car: { x, z }; tent: where the tent is;
//   here: the place you're at (placeAt), if any
export function words(g, ctx) {
  const id = stepOf(g);
  if (!id) return null;
  const n = STEP_IDS.indexOf(id) + 1;
  const { key, touch } = ctx;
  const use = (what) => (touch ? `tap the prompt (${what})` : `press ${key('interact')} (${what})`);
  const dest = DESTS[g.dest] || DESTS[ctx.plan?.dest] || null;
  const out = { id, n, of: STEPS.length, title: STEPS[n - 1].title, text: '', target: null };
  switch (id) {
    case 'plan':
      out.text = ctx.at === 'home'
        ? `An outing starts at the workbench in the garage: choose what you’re going for and where, then pack the rod and tackle for it. Walk up to it and ${use('“The workbench”')}. Or skip it: just get in the car and go.`
        : 'An outing starts at the workbench in your garage at home (follow the marker, or use the map’s “Home”). Or skip it: go anywhere by car and the guide carries on from there.';
      out.target = { x: BENCH.x, z: BENCH.z, label: 'Workbench' };
      break;
    case 'drive': {
      const to = dest ? dest.name : 'the coast';
      if (ctx.driving) {
        out.text = dest && LANE_WORDS[dest.id]
          ? `Drive ${LANE_WORDS[dest.id]} to ${to}. Park in the car park at the end, stop, then ${use('“Get out, or go somewhere”')}.`
          : `Drive down to the coast lane: west for Willowhaven, south for Shell Strand, east for Cove Head. Stop in a car park, then ${use('“Get out, or go somewhere”')}.`;
        out.title = `Drive to ${to}`;
        if (dest?.drive) out.target = { x: CAR_PARKS[dest.id].x, z: CAR_PARKS[dest.id].z, label: `${dest.name} car park` };
      } else {
        out.text = `${ctx.nearCar ? 'The car is right here' : 'Walk to the car'}: ${use('“Get in and drive”')} at the driver’s door, then drive to ${to}${dest && !dest.drive ? ' (it’s a long way round by road: in the car, choose “Where to?” and let the drive go by)' : ''}. The boot at the back shows what you’ve packed.`;
        out.title = `Drive to ${to}`;
        if (ctx.car) out.target = { x: ctx.car.x, z: ctx.car.z, label: 'Car' };
      }
      break;
    }
    case 'spot': {
      const D = dest || DESTS[ctx.carAt];
      const spot = D && FISH_SPOTS[D.id];
      out.text = `${spot ? `Walk down to ${spot.name}, and look out over the water. ` : 'Walk down to the water’s edge, and look out over the water. '}On your line: ${ctx.rig || 'nothing yet (open the backpack to tie something on)'}. ${key('tackle')} changes the bait or lure, ${key('pack')} opens the backpack.`;
      if (touch) out.text = out.text.replace(`${key('tackle')} changes the bait or lure, ${key('pack')} opens the backpack.`, 'The pack button changes it.');
      if (spot) out.target = { x: spot.x, z: spot.z, label: 'Fish here' };
      break;
    }
    case 'cast': {
      // (The tip for where you are, if that's one of the places: else where you meant to go.)
      const tip = FISH_SPOTS[ctx.here || g.dest]?.tip;
      out.text = touch
        ? `Face the water (drag on the right to look). Hold the round button: the ring shows where it will land, further the longer you hold. Let go to cast.${tip ? ` ${tip}` : ''}`
        : `Face the water (${ctx.pad ? key('look') : 'drag the mouse'} to look). Hold ${key('cast')}: the ring shows where it will land, further the longer you hold. Let go to cast.${tip ? ` ${tip}` : ''} ${key('cancel')} puts it down again.`;
      break;
    }
    case 'land': {
      const bite = { float: 'the float bobs, then goes under', lure: 'hold to reel the lure back, and a fish may hit it', ledger: 'the bite alarm sounds', bottom: 'the rod tip pulls round', jig: 'the jig stops sinking', fly: 'the fly is taken' }[ctx.kind] || 'a bite';
      out.text = touch
        ? `Wait for the bite: ${bite}. Tap the button to strike, then hold it to reel. Let go when the fish surges, or the line can break.`
        : `Wait for the bite: ${bite}. Then ${key('cast')} strikes; hold it to reel, and let go when the fish surges, or the line can break. Nothing biting for a while? ${key('advice')} asks the field guide why.`;
      break;
    }
    case 'record':
      out.text = touch
        ? 'On the catch card: Let it go, or Keep it for the pot. Either way it’s in your journal now.'
        : `On the catch card: ${key('cast')} lets it go, ${key('keep')} keeps it for the pot. Either way it’s in your journal now (${key('journal')}).`;
      break;
    case 'back': {
      // (Camping needs the tent with you: in your backpack, or in the boot of a car close by.)
      const camp = ctx.tent === 'pack' ? `or pitch a camp and stay the night (the tent is in your backpack${touch ? '' : `, ${key('pack')}`})`
        : ctx.tent === 'car' ? 'or pitch a camp and stay the night (the tent is in the boot)'
          : 'or, another time, pack the tent at the workbench and camp out';
      out.text = `${ctx.caught ? `${ctx.caught === 1 ? 'One fish' : `${ctx.caught} fish`} in your journal from this trip. ` : ''}Fish on as long as you like. When you’re done, drive home (in the car, “Where to?”; or your backpack’s “Head back”), ${camp}.`;
      if (ctx.car && ctx.carAt !== 'home') out.target = { x: ctx.car.x, z: ctx.car.z, label: 'Car' };
      break;
    }
    default:
  }
  return out;
}
