import { FISH, fishById } from './fish.js';
import { setupsFor, habitsOf } from './guide.js';
import { TACKLE, RODS } from './tackle.js';
import { HOME_WORDS, bearing } from './trip.js';
import { zoneAt, ZONE_NAMES } from './world/terrain.js';

// Why nothing is biting: what the simulation itself makes of the rig in the water, for the fish
// you're after (a trip's target, or the likeliest fish here), most telling reason first. Every
// reason is one the game really plays by (what a species eats and how big a mouthful it manages,
// where and how deep it lives at this hour, how it likes a lure to move, how shy it is of line,
// how the fish that came to look behaved, how far the rig has drifted); none says where a fish is.

const near = (a, b, tol) => a >= b[0] - tol && a <= b[1] + tol;
const mDepth = (v) => `${v < 1 ? v.toFixed(1) : Math.round(v)} m`;

// The species this rig is most likely fishing for, here and now.
export function likeliest(eco, map, x, z, item) {
  const zone = zoneAt(x, z);
  let best = null, score = 0;
  for (const sp of FISH) {
    if (sp.retired || sp.life.observe || !sp.life.zones.includes(zone)) continue;
    const s = (sp.food?.[item.id] ?? 0) * (eco.activity[sp.id] ?? 0.5) * (map.suitableAt(sp.id, x, z) ? 1 : 0.3);
    if (s > score) { score = s; best = sp; }
  }
  return best;
}

// fishing: the Fishing system (rig in the water); eco: the ecosystem; map: the MapSheet;
// target: a species (or null to guess). Returns { sp, reasons: [{ key, text }] }.
export function diagnose(fishing, eco, map, target = null) {
  const hook = fishing.hook, item = fishing.item, rod = fishing.rod, b = eco.bait;
  const sp = target || likeliest(eco, map, hook.x, hook.z, item);
  const reasons = [];
  if (!sp) {
    reasons.push({ key: 'nothing', text: `Little here takes ${item.on}. The field guide (Good for, in the backpack) says which fish do.` });
    return { sp: null, reasons };
  }
  const L = sp.life, name = sp.name.toLowerCase(), H = habitsOf(sp), ctx = eco.ctx;
  const zone = zoneAt(hook.x, hook.z);
  const like = sp.food?.[item.id] ?? 0;
  const best = setupsFor(sp)[0];
  const bestText = best ? `${TACKLE[best.item].on} on the ${RODS[best.rod].short.toLowerCase()}` : '';
  // What it eats.
  if (like < 0.4) reasons.push({ key: 'food', text: `The ${name} hardly ever takes ${item.on}. The field guide suggests ${bestText}.` });
  // How big a mouthful.
  else if (item.size > (sp.mouth ?? 2) * (item.type === 'bait' ? 1.45 : 1.2)) reasons.push({ key: 'size', text: `${item.name} is too big a mouthful for most ${name}: something smaller.` });
  // Where it lives.
  if (!L.zones.includes(zone)) {
    reasons.push({ key: 'water', text: `The ${name} doesn’t live in ${ZONE_NAMES[zone] || 'this water'}: it’s found in ${[...new Set(L.zones.map((z) => ZONE_NAMES[z] || z))].join(', ')}.` });
  } else if (!map.suitableAt(sp.id, hook.x, hook.z)) {
    reasons.push({ key: 'habitat', text: `This isn’t the kind of water the ${name} keeps to: it lives around ${[...new Set(L.homes.map((h) => HOME_WORDS[h] || h))].join(', ')}, ${H.depth[0]}–${Math.round(H.depth[1])} m down. The field guide’s map shades it.` });
  }
  // How deep, at this hour.
  const band = L.depth(ctx), depth = fishing.baitDepth ?? 0, bottom = fishing.bottom ?? 1;
  if ((L.bottom || L.flat) && !b.nearBottom) reasons.push({ key: 'depth', text: `The ${name} feeds on the bottom: your ${item.type === 'bait' ? 'bait' : 'lure'} is ${mDepth(bottom - depth)} above it.` });
  else if (!L.bottom && !L.flat && !near(depth, band, L.depthTol * 0.8)) {
    reasons.push({ key: 'depth', text: `Your ${item.type === 'bait' ? 'bait' : 'lure'} is ${mDepth(depth)} down; at this hour the ${name} swims ${band[0]}–${Math.round(Math.min(band[1], bottom))} m down. ${rod.kind === 'float' ? `Set the float ${depth < band[0] ? 'deeper' : 'shallower'} (W/S).` : depth < band[0] ? 'Let it sink longer before you wind.' : 'Wind sooner, or faster, to keep it higher.'}` });
  }
  // How it moves.
  // (Judged against how it likes a lure best: a fish that wants a fast lure follows a slow one
  // and turns away.)
  const motion = b.motion, likes = L.likes || {};
  const top = Object.entries(likes).sort((x, y) => y[1] - x[1])[0] || ['slow', 1];
  if ((rod.kind === 'lure' || rod.kind === 'jig') && (likes[motion] ?? 0.5) < Math.max(0.35, top[1] * 0.55)) {
    const how = { still: 'left still or paused', slow: 'wound slowly, with pauses', fast: 'wound fast (W to wind quicker)', twitch: 'twitched (tap)' }[top[0]] || top[0];
    reasons.push({ key: 'motion', text: `The ${name} doesn’t go for a lure ${({ still: 'left still', slow: 'wound slowly', fast: 'wound fast', twitch: 'twitched' })[motion] || motion}: it likes one ${how}.` });
  }
  // How shy it is of line.
  if (L.lineShy && b.thick > L.lineShy) reasons.push({ key: 'line', text: `The ${name} is wary of thick line, and yours shows: a fluorocarbon leader or a finer line hides it.` });
  // The hour.
  if ((eco.activity[sp.id] ?? 1) < 0.3) reasons.push({ key: 'hour', text: `A quiet hour for the ${name}: it’s most active ${H.allDay ? 'all day' : `at ${H.active}`}.` });
  // Drift: carried away from where it landed.
  const I = fishing.interest;
  if (I) {
    const dx = hook.x - I.at.x, dz = hook.z - I.at.z, d = Math.hypot(dx, dz);
    const moved = rod.kind === 'lure' || rod.kind === 'jig' || rod.kind === 'fly' ? 0 : d;
    if (moved > 8) reasons.push({ key: 'drift', text: `The ${rod.kind === 'float' ? 'float' : 'rig'} has drifted ${Math.round(moved)} m ${bearing(dx, dz)} from where it landed${map.suitableAt(sp.id, hook.x, hook.z) ? '' : ', out of the water that suits it'}. Recast up-current of the spot.` });
    // Fish came to look and left without taking.
    const came = I.looks + I.follows;
    if ((came >= 2 && I.left >= 2) || (I.follows >= 1 && fishing.status === 'follow' && reasons.some((r) => r.key === 'motion'))) {
      const why = reasons.find((r) => r.key === 'motion' || r.key === 'line' || r.key === 'size');
      reasons.push({ key: 'interest', text: `${came} fish came to look and turned away. ${why ? why.text : I.why ? I.why : (L.caution ?? 1) >= 1.2 ? `The ${name} is wary: give it longer, and keep still.` : 'A twitch or a pause often turns a follower into a take.'}` });
    }
  }
  if (!reasons.length) reasons.push({ key: 'fine', text: `Everything suits the ${name} here: the water, the depth, the ${item.type} and the hour. It just hasn’t found yours yet. Give it time, or try a little further along the same kind of water.` });
  return { sp, reasons };
}
