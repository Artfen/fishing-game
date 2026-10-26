// The talk at the bar: The Lobster Pot at Willowhaven (Ruth behind the bar, and whoever's in), and
// Bar El Muelle at Las Brasas (Paco). Three kinds of it:
//  · stories: the harbour's own, old and new, a different one each time until you've heard them;
//  · advice: worked out from the water as it is (what's about and busy, the hour, the wind and the
//    rain, a storm), the way a local who'd fished it all their life would put it;
//  · rumours: what's being said about the sea today, and every word of it true: gulls or gannets
//    working a shoal, dolphins about, a whale blowing out in the deep, the tuna up, a storm coming,
//    the sea set to glow tonight, a good fish landed. (Nothing is made up to sound fishy.)

export const STORIES = {
  haven: [
    { id: 'kittiwake', text: 'The Kittiwake? A steam drifter out of here, built in 1907, wooden. Lost on the reef off Shell Strand in a winter gale, every man of her crew got ashore. Her bell’s still down there in the sand by her bow, they say. And the conger in her hull are the size of a man’s leg.' },
    { id: 'tam', text: 'Tam Leask kept the watch on the Calf for forty years. Counted the seals every morning on a slate, and never missed a day, not even the day his daughter was married. He reckoned the bass off the Nose came on the third hour of the flood, and he was never wrong.' },
    { id: 'pike', text: 'There’s a pike in Longmere older than me. My father hooked it off the boathouse in ’79 and it towed his boat clean round the Holm before the line went. Folk have seen it since, lying under the lily pads like a log. Nobody’s landed it.' },
    { id: 'tuna', text: 'When I was a girl the tuna came into the Blue Water every September like clockwork, and the whole harbour went out after them. Then they stopped coming, for thirty years. Now they’re back. Watch for the birds piling in, out past the shoal: that’s them, driving the sprats up.' },
    { id: 'mags', text: 'Mags’s mother ran the fish market before her, and her grandmother before that. There’s been a Pennock on that slab since before the quay was built in stone. She can tell you the weight of a bass to the ounce just by looking at it.' },
    { id: 'lantern', text: 'There used to be a lantern hung in Driftwood Cove for the boats coming in after dark, before the light went up on the quay. The cove’s still the calmest water on the coast in a blow. Squid come in there under the lamp on still nights.' },
    { id: 'gannets', text: 'Gannet Isle’s named for the birds, not the other way round. When they’re diving, you’ll know: like snowballs thrown into the sea from on high. Where they’re diving there’s fish under them, every time.' },
    { id: 'brasas', text: 'Dougie’s brother sailed down to Las Brasas one winter in a boat not much bigger than yours, and stayed eleven years. Came back brown as a nut with stories of fish the colour of parrots, and a bar on the quay where they cook them with little wrinkled potatoes.' },
    { id: 'storm', text: 'The bay’s a friend in a storm. Out past the Calf it’s white water and the race standing up like a wall, but in here, under the hill, you can sit in a rowing boat and fish for flounder while the gale goes over.' },
    { id: 'glow', text: 'Some summer nights the whole bay lights up. Row out and every stroke of the oars leaves a puddle of green fire, and the fish going off under the boat are like shooting stars. My grandfather called it “the burning”.' },
    { id: 'fell', text: 'They say the Coldwater runs out of Hoar Tarn up on the fell, and that the trout up there are as dark as peat and wild as hares. It’s a long walk. Take a coat: the weather comes over the top of Hoarfell faster than you can get down.' },
    { id: 'dolphins', text: 'Kit swears a dolphin looked him in the eye from under the bow, last summer, all the way from the Skerries to the quay. Dolphins love a boat going along at a fair lick. Slow down and they’re off, like children when the game stops.' },
  ],
  muelle: [
    { id: 'vieja', text: 'The vieja, the parrotfish, is the queen of fish here. Every grandmother on the island has her way with it: boiled with potatoes and mojo, that’s the only right way, and every other grandmother’s way is wrong.' },
    { id: 'bajon', text: 'El Bajón has fed this village for three hundred years. My grandfather said the old men would row out at dawn, drop a line over the pinnacles, and be home for breakfast with a basket full.' },
    { id: 'marlin', text: 'In the summer the big marlin come past, far out where the water is like ink. The Germans with the big boats come for them. They take a photo and let it go. Very good. A marlin is too beautiful for the plate.' },
    { id: 'volcano', text: 'Pico Brasa has not woken in two hundred years. The black rock you walk on in the village came down from it, red and hot like soup. When it rains on the mountain, the whole island smells of iron.' },
    { id: 'shearwaters', text: 'At night you hear the pardelas, the shearwaters, crying like babies over the cliffs. They come home to their burrows in the dark. The old people said they were the souls of drowned sailors.' },
    { id: 'whales', text: 'The calderones, the pilot whales, live off the south-west all year. A family. You can see the same ones every week, the old male with the bent fin. Go slow near them and they will come and look at you.' },
  ],
};

// A story you haven't heard yet here (or, all heard, any of them again).
export function nextStory(place, heard = []) {
  const all = STORIES[place] || STORIES.haven;
  return all.find((s) => !heard.includes(s.id)) || all[Math.floor(Math.random() * all.length)];
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];
// A fish's name in a sentence: lower case, but for the places in it (Atlantic, European…); and
// with its article (an Atlantic bonito, a European flounder).
const PROPER = /\b(atlantic|european|senegalese|mediterranean)\b/g;
export const lower = (name) => name.toLowerCase().replace(PROPER, (w) => w[0].toUpperCase() + w.slice(1));
export const an = (w) => `${!/^(eu|uni|use)/i.test(w) && /^[aeiou]/i.test(w) ? 'an' : 'a'} ${w}`;

// Advice for the water as it is. ctx: { place ('haven' or 'muelle'), hour, rain, wind (m/s), about
// (whatsAbout's list near Willowhaven: { sp, where, how, act }), storm (0 … 1), caught (Set of
// species ids you've ever caught) }. One line, picked from the few that fit best just now.
export function adviceFor(ctx) {
  const out = [];
  const dawnDusk = (ctx.hour >= 4.5 && ctx.hour < 7.5) || (ctx.hour >= 18.5 && ctx.hour < 21.5);
  const night = ctx.hour >= 22 || ctx.hour < 4.5;
  if (ctx.place === 'muelle') {
    if (ctx.storm > 0.4) out.push('Nobody goes out past the point in this. Fish inside the harbour: the little fish come right in under the boats, and a small bait under a float will keep you busy.');
    if (dawnDusk) out.push('Go to Punta del Faro at first light or at sunset. The current runs past the point a little faster, and the bluefish and the little tunny hunt there.');
    if (night) out.push('At night the squid come to the lights on the quay. And on the reef the morays come out of their holes to hunt.');
    if (ctx.wind > 9) out.push('With the trade wind blowing like this the north side is all white water. Stay in the lee, along the south shore, where the sea is flat.');
    else if (!night) out.push('Las Coladas, the old lava: parrotfish graze the rocks there, the triggerfish cruise over them, and the morays watch from the holes. Fish the edges of the lava.');
    out.push('On the black sand at Playa Negra the surf brings in the white bream and the palometa. Cast just behind the waves.');
    out.push('Out at El Veril the bottom falls away into the deep. Amberjack and barracuda patrol the edge, and the groupers live in the caves in the wall.');
    out.push('The blue water starts not far past the shelf. Trolling out there, a lure skipping in the wake, you can meet a wahoo, a dorado, even a marlin.');
    return pick(out.slice(0, 3));
  }
  if (ctx.storm > 0.4) out.push('Stay in the bay today. Out past the Calf it’s no place for a small boat. The flounder don’t mind a blow: a worm on the bottom in the lee of the quay, and you’ll do fine.');
  for (const a of ctx.about || []) {
    const fresh = ctx.caught && !ctx.caught.has(a.sp.id);
    out.push(`${fresh ? `You’ve not had ${an(lower(a.sp.name))} yet, have you? ` : ''}The ${lower(a.sp.name)} are ${a.act > 0.85 ? 'on' : 'about'} ${a.where} just now.${a.how ? ` ${a.how[0].toUpperCase()}${a.how.slice(1)}, that’s what I’d use.` : ''}`);
  }
  if (dawnDusk) out.push('This is the hour. Dawn and dusk the bass come up into the shallows and the pollack rise off the rocks. Don’t waste it in here.');
  if (night) out.push('After dark, the squid come in under the lamps: the quay’s, and the Old Jetty’s. A little jig, sunk, darted up and let glide down. And the soles come out on the sand.');
  if (ctx.rain > 0.3) out.push('A bit of rain’s no bad thing. Up the Fernbeck the trout come on when the water colours up after rain, and the light’s down so they’re bolder.');
  if (ctx.wind > 9) out.push('With this wind the surf’ll be up on Shell Strand. Bass love a bit of white water: a soft sandeel worked through the surf, or a peeler crab on the bottom.');
  else if (ctx.wind < 3 && !night) out.push('Flat calm. Fish fine and far off: a light line and a long cast. On days like this the mullet cruise the quay wall: bread flake under a little float, and patience.');
  if (!out.length) out.push('Talk to the water, my mother used to say. Watch for birds, for rings and swirls, for the bait jumping. The fish tell you where they are if you look.');
  return pick(out.slice(0, 3));
}

// What's being said about the sea today: a few true things. ctx: { place, hour, nameOf(x, z)
// (a place in words), birds (the board's lines about gulls diving), gannets ({ x, z } or null),
// pods ([{ kind, x, z }]), whales ([{ kind, x, z, up }]), boil ({ x, z } or null), glow (tonight,
// 0 … 1), storm (0 … 1), rain, news ([lines]: the harbour's own people, see townsfolk.js), yours
// ({ name, size } or null) }.
export function rumoursNow(ctx) {
  const out = [];
  const name = (x, z) => ctx.nameOf?.(x, z) || 'out there';
  const home = ctx.place !== 'muelle';
  if (ctx.storm > 0.5) out.push(home ? 'Everyone’s staying in today. Dougie says he’s never seen the race off the Calf so wild, and he’s not taking his boat out till it blows through.' : 'Nobody is going out today. The boats are all tied up two deep in the harbour, and the old men are playing dominoes.');
  if (ctx.gannets) out.push(`The gannets are diving ${name(ctx.gannets.x, ctx.gannets.z)}. There’s a shoal up there, sprats or mackerel, and something chasing them.`);
  for (const l of ctx.birds || []) out.push(`Mags says ${l.charAt(0).toLowerCase()}${l.slice(1)}`);
  if (ctx.boil) out.push(`The tuna are up! Birds going mad and the sea boiling, ${name(ctx.boil.x, ctx.boil.z)}. A big stickbait thrown into the middle of it, if you can get there in time.`);
  for (const p of ctx.pods || []) out.push(`There’s a pod of ${p.kind === 'commondolphin' ? 'common dolphins' : p.kind === 'spotteddolphin' ? 'spotted dolphins' : 'bottlenose dolphins'} ${name(p.x, p.z)}. Give your boat a bit of throttle out there and they’ll come and ride the bow.`);
  for (const w of ctx.whales || []) {
    const what = { finwhale: 'a fin whale', minkewhale: 'a minke whale', spermwhale: 'the sperm whale', pilotwhale: 'the pilot whales' }[w.kind] || 'a whale';
    out.push(`Somebody saw ${what} blowing ${name(w.x, w.z)} ${w.up ? 'not an hour ago' : 'earlier today'}. Watch for the spout: you see it a long way off.`);
  }
  for (const l of ctx.news || []) out.push(l);
  if (ctx.yours) out.push(`They’re talking about that ${lower(ctx.yours.name)} of yours, ${ctx.yours.size} cm. Word gets round.`);
  if (ctx.glow > 0.7 && ctx.hour > 14) out.push('Mark my words, the sea’ll be burning tonight: the water’s full of the stuff. Take the boat out after dark and watch your wake.');
  if (ctx.rain > 0.5 && home) out.push('Rain’s set in for a while. The trout up the Fernbeck will like it, mind.');
  return out;
}
