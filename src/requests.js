import { fishById } from './fish.js';
import { lower, an } from './innTalk.js';

// Small favours the harbour's people ask of you, one at a time each, when you stop for a word: a
// fish they need, something to carry across the harbour, a catch they bet you can't make, a whale
// a boy longs to hear about, a pot buoy gone adrift. Grounded in the fishing and the places. Each
// is asked once (and asked again another day if you say not now); nothing is timed, nothing is
// lost by leaving it. What they give back: a little money, a keepsake for the shelf at home, a
// mark on your map that only a local would know, or supper.
//
// kind:
//  · bring   a fish (or `count` of them) of a species, at least `min` cm, raw, to them;
//  · catch   catch one (at least `min` cm; at night, `night`; from the shore, `shore`; from a boat,
//            `boat`), then go and tell them;
//  · see     see one of these sea creatures (kinds from world/sealife.js), then tell them;
//  · photo   photograph a species (it's in the picture's subjects), then tell them;
//  · deliver carry `item` to `to`;
//  · find    find Dougie's pot buoy, adrift at sea, and bring it back.
// reward: { money, keepsake, pin: { x, z, title, note }, dish: { text, fill } } (from whoever you
// finish it with). (The marks: the ledges off Cove Head, the Kittiwake's buoy, the end of the Old
// Jetty; see world/terrain.js's DAYMARK, WRECK_BUOY and JETTY.)

export const REQUESTS = [
  // Mags Pennock, the fishmonger.
  {
    id: 'sole', who: 'mags', kind: 'bring', species: 'sole', min: 30,
    ask: '“It’s my mother’s eightieth on Sunday, and all she wants for her tea is a sole. A proper one, mind: thirty centimetres or better. I’ve had nothing that size on the slab all week. Could you?”',
    short: 'A sole of 30 cm or more, for Mags’s mother’s eightieth',
    thanks: '“Oh, look at that. She’ll cry, she will. Here, and don’t you argue.”',
    reward: { money: 25 },
  },
  {
    id: 'dolphins', who: 'mags', kind: 'see', what: ['bottlenose', 'commondolphin', 'spotteddolphin'],
    ask: '“Forty years on this quay and I’ve never once seen the dolphins close. Dougie sees them all the time, the devil. If you do, come and tell me all about it?”',
    short: 'See dolphins, and tell Mags all about it',
    thanks: '“Riding the bow, were they? Right under you? Oh, I’d have loved that.” She presses something into your hand. “For your trouble. And next time, take me.”',
    reward: { money: 6 },
  },
  // Old Bert Hale, the chandler.
  {
    id: 'hooks', who: 'bert', kind: 'deliver', item: 'a box of hooks', to: 'hettie',
    ask: '“Hettie Moss ordered these hooks a fortnight since and never came for them. You’ll see her before I do, out on the rocks somewhere. Would you take them?”',
    short: 'Take Bert’s box of hooks to Hettie',
    thanks: '“My hooks! I’d forgotten all about them.” Hettie looks you up and down. “Go on then. I’ll tell you one I don’t tell everyone.” She marks your map: the ledges off Cove Head.',
    reward: { money: 3, pin: { x: 184, z: 10, title: 'Hettie’s ledges', note: 'Off Cove Head, where the swell breaks on the ledges: the big bass come in at dusk, after the white water. A soft sandeel through the wash.' } },
  },
  {
    id: 'pike', who: 'bert', kind: 'catch', species: 'pike', min: 72,
    ask: '“Seventy-two centimetres. Longmere, 1984, off the boathouse. Nobody’s beaten it since. You’ve the look of someone who might. Go on: beat it, and come and tell me.”',
    short: 'Beat Bert’s record: a pike of 72 cm or more',
    thanks: '“Well I never.” He sits down heavily. “Forty years.” From under the counter he brings out a battered, striped wooden plug. “This caught mine. It’s yours now.”',
    reward: { money: 10, keepsake: 'plug' },
  },
  // Ruth Alder, The Lobster Pot.
  {
    id: 'weddingbass', who: 'ruth', kind: 'bring', species: 'seabass', min: 45,
    ask: '“I’ve a wedding party on Saturday and the bride wants a whole sea bass on the top table. A big one: forty-five centimetres or more. Bring me one and I’ll pay you properly.”',
    short: 'A sea bass of 45 cm or more, for the wedding party at the inn',
    thanks: '“That’s the one. That’s the top table sorted.” She counts out the money onto the bar.',
    reward: { money: 30 },
  },
  {
    id: 'pie', who: 'ruth', kind: 'deliver', item: 'a pie wrapped in a cloth', to: 'dougie',
    ask: '“Dougie Ferris never eats a proper meal. Take him this pie, would you, when you see him on the quay? Tell him it’s from me, and that he’s to eat it hot.”',
    short: 'Take Ruth’s pie to Dougie',
    thanks: '“From Ruth?” Dougie goes a little pink. “Well. Tell her thank you.” He lowers his voice. “Here’s one for you: the pollack hang over the Kittiwake at dusk, thick as you like. I’ll mark it.”',
    reward: { pin: { x: 99, z: 68, title: 'Dougie’s pollack', note: 'Over the Kittiwake, at dusk: the pollack come up off her ribs. A shad or a jig worked over the wreck, not too deep.' } },
  },
  {
    id: 'otter', who: 'ruth', kind: 'see', what: ['otter'],
    ask: '“My dad used to say there were otters on the Coldwater, before the war. Gone for fifty years. Old Tam swore he saw one in the Saltings last winter, and nobody believed him. If you ever see one, come and tell me. Dawn or dusk, he said, and quiet.”',
    short: 'See an otter, and tell Ruth',
    thanks: '“An otter. On our river.” Ruth puts down the glass she’s drying. “Then Tam was right, God rest him.” She won’t take your money for supper tonight.',
    reward: { money: 5, dish: { text: 'Supper on Ruth at The Lobster Pot: a bowl of fish stew and crusty bread, for the otter.', fill: 40 } },
  },
  // Dougie Ferris, the lobsterman.
  {
    id: 'buoy', who: 'dougie', kind: 'find',
    ask: '“One of my pot buoys broke away in the night, the rope chafed through. It’ll be drifting out there somewhere, an orange float with a flag. If you come across it, would you bring it in?”',
    short: 'Find Dougie’s pot buoy, adrift at sea, and bring it in',
    thanks: '“That’s her! Where was she, out past the bay?” He takes it and grins. “You’ll stop for a bite. Ruth’s doing dressed crab, and I caught the crab.”',
    reward: { money: 10, dish: { text: 'Dressed crab at The Lobster Pot, on Dougie: brown meat and white, with brown bread and butter.', fill: 45 } },
  },
  {
    id: 'bait', who: 'dougie', kind: 'bring', species: 'mackerel', count: 2,
    ask: '“I’m short of bait for the pots. A couple of mackerel would see me right. Any size: it’s the crabs that eat them, not me.”',
    short: 'Two mackerel for Dougie’s pots',
    thanks: '“Lovely. The crabs’ll thank you too.”',
    reward: { money: 6 },
  },
  // Hettie Moss, the angler.
  {
    id: 'squid', who: 'hettie', kind: 'catch', species: 'squid', night: true, shore: true,
    ask: '“I bet you a fiver you can’t get a squid off the quay tonight, after dark. A little jig, and let it sink. Go on.”',
    short: 'Hettie’s bet: a squid from the shore, after dark',
    thanks: '“Ha! Fair’s fair.” She hands over the fiver. “Now here’s where I go when the quay’s busy.” She marks the Old Jetty on your map.',
    reward: { money: 5, pin: { x: 6, z: 12, title: 'Hettie’s squid', note: 'The Old Jetty, under its lamp, on a still night: squid come to the light. Let the jig sink, dart it up, let it glide down.' } },
  },
  {
    id: 'bigbass', who: 'hettie', kind: 'catch', species: 'seabass', min: 60,
    ask: '“Sixty centimetres. That’s a real bass, a big old female. I’ve had three in my life. Catch one, anywhere you like, and come and tell me how.”',
    short: 'A sea bass of 60 cm or more, for Hettie',
    thanks: '“Sixty! Where?” She listens to every word. Then she unpins an old sandeel lure from her hat. “It’s had more bass than I’ve had hot dinners. Yours.”',
    reward: { money: 10, keepsake: 'sandeel' },
  },
  // Kit.
  {
    id: 'whale', who: 'kit', kind: 'see', what: ['finwhale', 'minkewhale', 'spermwhale', 'pilotwhale'],
    ask: '“Have you ever seen a whale? A real one? I want to see one SO much. If you see one, will you tell me what it was like? Everything?”',
    short: 'See a whale, and tell Kit everything',
    thanks: '“It BLEW? How high?” Kit listens with his mouth open. The next day he gives you a drawing: you, a boat, and an enormous whale.',
    reward: { keepsake: 'drawing' },
  },
  {
    id: 'showfish', who: 'kit', kind: 'bring', species: 'mackerel',
    ask: '“Gran doesn’t believe I’ve ever seen a mackerel up close. Could you bring one? Just to show her? Then she can cook it.”',
    short: 'A mackerel for Kit to show his gran',
    thanks: '“GRAN! Look!” Kit’s gran comes to the door, wipes her hands, and sends you off with a warm scone and jam.',
    reward: { money: 2, dish: { text: 'A warm scone with Kit’s gran’s strawberry jam.', fill: 18 } },
  },
  // Ian Rennie, the retired schoolmaster.
  {
    id: 'finwhale', who: 'ian', kind: 'see', what: ['finwhale'],
    ask: '“Balaenoptera physalus. The second biggest animal that ever lived, and one feeds out in the Blue Water. I’ve looked for forty years. If you ever see her blow, come and tell me?”',
    short: 'See the fin whale in the Blue Water, and tell Ian',
    thanks: '“You saw her.” He’s quiet a moment. “Thank you. Here: put this towards your diesel. I insist.”',
    reward: { money: 10 },
  },
  {
    id: 'pollack', who: 'ian', kind: 'catch', species: 'pollack', min: 50, boat: true,
    ask: '“My pupils used to ask me what the biggest fish I ever caught was. A pollack of fifty centimetres, from a boat, off the Calf, in 1991. Match it, and I’ll stand you the price of a good lure.”',
    short: 'A pollack of 50 cm or more, from a boat, for Ian',
    thanks: '“Fifty! From a boat!” He shakes your hand. “Then we’re equal, you and I.”',
    reward: { money: 12 },
  },
  // At Las Brasas.
  {
    id: 'vieja', who: 'paco', kind: 'bring', species: 'parrotfish', min: 35,
    ask: '“I have a special customer tonight, an old man from the village who has eaten here sixty years. He wants a big vieja, thirty-five centimetres at least. Chano has only small ones today. Can you?”',
    short: 'A parrotfish (vieja) of 35 cm or more, for Paco',
    thanks: '“¡Qué belleza!” Paco holds it up for the whole bar to see. “Tonight he eats like a king.”',
    reward: { money: 20 },
  },
  {
    id: 'grouper', who: 'chano', kind: 'photo', species: 'grouper',
    ask: '“In the cave at the foot of El Bajón lives a mero, a grouper, older than me. My father knew him. Nobody takes him. If you dive, take his photograph for me? I want to see he is still there.”',
    short: 'Photograph the old grouper in El Bajón’s cave, for Chano',
    thanks: '“¡Es él! Still there.” Chano is quiet a moment. Then he gives you a big old hand-forged hook from his tin. “For luck. My father’s.”',
    reward: { money: 10, keepsake: 'hook' },
  },
];
export const REQUEST_IDS = REQUESTS.map((r) => r.id);
export const requestById = Object.fromEntries(REQUESTS.map((r) => [r.id, r]));
export const ACTIVE_MAX = 3;

// Where Dougie's buoy might have drifted to (one of these, by the day you're asked).
export const BUOY_DRIFT = [{ x: 60, z: 140 }, { x: -20, z: 230 }, { x: 150, z: 200 }, { x: -60, z: 180 }];

// state.favours: { active: [{ id, day, ready, pos? (the buoy) }], done: { id: day }, last: { who: day
// a favour was finished }, declined: { id: day } }.
export const newFavours = () => ({ active: [], done: {}, last: {}, declined: {} });
export function cleanFavours(raw) {
  const F = newFavours();
  if (!raw || typeof raw !== 'object') return F;
  const day = (v) => (Number.isFinite(v) ? Math.max(0, Math.round(v)) : null);
  for (const a of Array.isArray(raw.active) ? raw.active : []) {
    if (!a || !requestById[a.id] || F.active.some((b) => b.id === a.id) || F.active.length >= ACTIVE_MAX) continue;
    const e = { id: a.id, day: day(a.day) ?? 1, ready: !!a.ready };
    if (a.pos && Number.isFinite(a.pos.x) && Number.isFinite(a.pos.z)) e.pos = { x: a.pos.x, z: a.pos.z };
    F.active.push(e);
  }
  for (const k of ['done', 'declined']) if (raw[k] && typeof raw[k] === 'object') for (const [id, d] of Object.entries(raw[k])) if (requestById[id] && day(d) != null) F[k][id] = day(d);
  if (raw.last && typeof raw.last === 'object') for (const [who, d] of Object.entries(raw.last)) if (/^[a-z]{2,12}$/.test(who) && day(d) != null) F.last[who] = day(d);
  return F;
}

const isActive = (F, id) => F.active.some((a) => a.id === id);
// The favour someone would ask of you now, if any: their next one not yet done, unless they've one
// running already, you've finished one for them today, you said not now today, or you've already
// three on the go.
export function offerFor(who, F, day) {
  if (F.active.length >= ACTIVE_MAX || F.last[who] === day) return null;
  if (F.active.some((a) => requestById[a.id].who === who)) return null;
  const next = REQUESTS.find((r) => r.who === who && !(r.id in F.done) && !isActive(F, r.id));
  if (!next || F.declined[next.id] === day) return null;
  return next;
}
export function accept(F, id, day) {
  if (isActive(F, id) || id in F.done || F.active.length >= ACTIVE_MAX) return null;
  const e = { id, day, ready: false };
  if (requestById[id].kind === 'find') e.pos = { ...BUOY_DRIFT[day % BUOY_DRIFT.length] };
  if (requestById[id].kind === 'deliver') e.ready = true; // (carried from the start)
  F.active.push(e);
  return e;
}
export const decline = (F, id, day) => { F.declined[id] = day; };

// The things that make a favour ready to tell them about. Each returns the favours just made ready.
// catch: { species id, size, night, shore }.
export function caught(F, c) {
  const out = [];
  for (const a of F.active) {
    const R = requestById[a.id];
    if (a.ready || R.kind !== 'catch' || R.species !== c.id) continue;
    if ((R.min && c.size < R.min) || (R.night && !c.night) || (R.shore && !c.shore) || (R.boat && c.shore)) continue;
    a.ready = true;
    out.push(R);
  }
  return out;
}
export function saw(F, kind) {
  const out = [];
  for (const a of F.active) {
    const R = requestById[a.id];
    if (!a.ready && R.kind === 'see' && R.what.includes(kind)) {
      a.ready = true;
      out.push(R);
    }
  }
  return out;
}
export function photographed(F, subjects) {
  const out = [];
  for (const a of F.active) {
    const R = requestById[a.id];
    if (!a.ready && R.kind === 'photo' && (subjects?.species || []).includes(R.species)) {
      a.ready = true;
      out.push(R);
    }
  }
  return out;
}
// The buoy, adrift (where it is now: drifting slowly round where it was lost), if you're looking.
export function buoyAt(F, t = 0) {
  const a = F.active.find((x) => requestById[x.id].kind === 'find' && !x.ready);
  return a ? { x: a.pos.x + Math.sin(t * 0.02) * 6, z: a.pos.z + Math.cos(t * 0.017) * 6, entry: a } : null;
}
export function pickUpBuoy(F) {
  const a = F.active.find((x) => requestById[x.id].kind === 'find' && !x.ready);
  if (!a) return null;
  a.ready = true;
  return requestById[a.id];
}

// The fish in your creel that would do for a 'bring' favour: their indices (or null if not enough).
export function fishFor(keep, R) {
  const n = R.count || 1, idx = [];
  keep.forEach((f, i) => {
    if (idx.length < n && f.id === R.species && !f.cooked && f.size >= (R.min || 0)) idx.push(i);
  });
  return idx.length >= n ? idx : null;
}

// What someone has for you when you stop by: a favour to hand over or tell them about, something
// you're carrying for them, or a new one to ask. { R, a, act: 'give' | 'tell' | 'deliver' | 'ask' }.
export function businessWith(who, F, keep, day) {
  for (const a of F.active) {
    const R = requestById[a.id];
    if (R.kind === 'deliver' && R.to === who) return { R, a, act: 'deliver' };
    if (R.who !== who) continue;
    if (R.kind === 'bring' && fishFor(keep, R)) return { R, a, act: 'give' };
    if (R.kind !== 'bring' && R.kind !== 'deliver' && a.ready) return { R, a, act: 'tell' };
  }
  const R = offerFor(who, F, day);
  return R ? { R, a: null, act: 'ask' } : null;
}
// Done: off the list, into the record. Returns the reward.
export function complete(F, id, day) {
  const i = F.active.findIndex((a) => a.id === id);
  if (i < 0) return null;
  F.active.splice(i, 1);
  F.done[id] = day;
  const R = requestById[id];
  F.last[R.who] = day;
  if (R.to) F.last[R.to] = day;
  return R.reward;
}
// A line for the journal: what it is, and where it stands.
export function standing(a, names) {
  const R = requestById[a.id];
  if (R.kind === 'deliver') return `Carrying ${R.item}: find ${names[R.to]}.`;
  if (R.kind === 'bring') return `Bring ${R.count > 1 ? `${R.count} ` : ''}${R.count > 1 ? lower(fishById[R.species].name) : an(lower(fishById[R.species].name))}${R.min ? ` (${R.min} cm or more)` : ''} to ${names[R.who]}.`;
  if (a.ready) return R.kind === 'find' ? `You have the buoy: take it to ${names[R.who]}.` : `Done: go and tell ${names[R.who]}.`;
  if (R.kind === 'find') return 'Look for an orange float with a flag, adrift at sea (your map has a mark near where).';
  if (R.kind === 'catch') return `Catch it, then go and tell ${names[R.who]}.`;
  if (R.kind === 'see') return `Keep a look out at sea, then go and tell ${names[R.who]}.`;
  return `Take your camera down (diving), then go and tell ${names[R.who]}.`;
}

// A word showing they remember you: your catch, a place you've found, the trip you've just had.
// mem: { notable: { name, size, day }, place: { name, day }, trip: { name, total, best, day }, day }.
export function remember(who, mem) {
  const lines = [];
  if (mem.badge && mem.day - mem.badge.day <= 1) {
    const b = mem.badge.name;
    lines.push({ ruth: `I’ve ticked you off on the board: ${b}. Well done, you.`, mags: `Ruth says you’ve a badge for “${b}” now. About time.`, dougie: `${b}, eh? Ruth’s board’s getting full of you.`, ian: `Congratulations on “${b}”. I never managed that one.`, kit: `You got a badge! Can I see it?` }[who]);
  }
  if (mem.dive && mem.day - mem.dive.day <= 1) {
    const at = mem.dive.site;
    lines.push({ bert: `Down at ${at}, I hear. Bring the tank in when it wants filling.`, hettie: `You dived ${at}? What did you see down there?`, ian: `${at[0].toUpperCase()}${at.slice(1)}! I dived it once, when I had the knees for it.`, dougie: `Down at ${at}, they say. Rather you than me.`, kit: `Did you see a lobster at ${at}? Did you?`, chano: `You dive, eh? Come and dive El Bajón some time.` }[who]);
  }
  if (mem.notable && mem.day - mem.notable.day <= 1) {
    const f = `${mem.notable.size} cm ${lower(mem.notable.name)}`;
    lines.push({ mags: `I heard about that ${f} of yours. Bring the next one to me!`, bert: `They tell me you had a ${f}. What was it on?`, ruth: `The whole bar was talking about your ${f}.`, dougie: `That ${f}! Not bad at all.`, hettie: `A ${f}, they say. Where?`, kit: `Is it true you caught a ${f}? Was it THIS big?`, ian: `A ${f}, I hear. Splendid.`, paco: `¡Ese ${f}! Everybody talks.`, chano: `Paco says you had a ${f}. ¡Bien!` }[who]);
  }
  if (mem.trip && mem.day - mem.trip.day <= 1) {
    const how = mem.trip.total ? `${mem.trip.total} fish, they say` : 'nothing doing, they say';
    lines.push({ ruth: `Back from your trip, then? ${mem.trip.total ? 'Good haul?' : 'Never mind: it’s the going that counts.'}`, dougie: `How was the trip? ${how}.`, ian: 'Good trip? Tell me about it some time.', bert: `Back again! ${mem.trip.total ? 'And not empty-handed, I hear.' : 'The fish win some days.'}` }[who]);
  }
  if (mem.place && mem.day - mem.place.day <= 1) {
    lines.push({ hettie: `You found ${mem.place.name}? Not many bother going.`, ian: `${mem.place.name}! I haven’t been out there in years.`, kit: `Gran says you went all the way to ${mem.place.name}!`, chano: `You know ${mem.place.name} now, eh?` }[who]);
  }
  return lines.filter(Boolean)[0] || '';
}
