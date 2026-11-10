// The birds of the coast (besides the gulls, gannets, shearwaters, herons, cormorants, terns and
// oystercatchers the game already had): what each is, for the journal and the notes. Their
// bodies, flight and haunts are in world/birds.js; this file has no graphics, so the save and the
// journal can read it too.
//
// name: as the notes and Memories list them; one: as a species list has it; note: a line on it;
// sci, family, iucn (the IUCN Red List, worldwide): see taxonomy.js; look: where to find it;
// region: 'home', 'south' (Las Brasas) or 'both'.

export const BIRDS = {
  // The sea cliffs and the stacks
  fulmar: {
    name: 'Northern fulmars', one: 'Northern fulmar', sci: 'Fulmarus glacialis', family: 'Procellariidae', iucn: 'LC', region: 'home',
    note: 'Fulmars: gull-like, but no gull. A tubenose, cousin of the albatrosses, gliding along the cliff face on stiff, straight wings and riding the updraught with hardly a flap. A pair lays one egg on a bare ledge, and lives for forty years and more; bother one at the nest and it spits a jet of foul-smelling oil.',
    look: 'Gliding along the cliffs of Gannet Isle and round the stacks of Gull Rock.',
  },
  kittiwake: {
    name: 'Black-legged kittiwakes', one: 'Black-legged kittiwake', sci: 'Rissa tridactyla', family: 'Laridae', iucn: 'VU', region: 'home', when: ['spring', 'summer'],
    note: 'Kittiwakes: small, gentle-faced gulls with black legs and wingtips that look dipped in ink, named for their wailing “kitti-waaake” off the cliffs. True seabirds: outside the summer they live far out on the open Atlantic.',
    look: 'Round the stacks of Gull Rock and the cliffs of Gannet Isle, in spring and summer.',
  },
  shag: {
    name: 'European shags', one: 'European shag', sci: 'Gulosus aristotelis', family: 'Phalacrocoracidae', iucn: 'LC', region: 'home',
    note: 'Shags: smaller and sleeker than the cormorant, glossy bottle-green in the right light, with a jaunty crest in spring and a yellow gape. They dive deep off rocky shores for sandeels, and leave the open sand to the cormorants.',
    look: 'On the Skerries, the Calf’s skerry and the foot of Gull Rock.',
  },
  puffin: {
    name: 'Atlantic puffins', one: 'Atlantic puffin', sci: 'Fratercula arctica', family: 'Alcidae', iucn: 'VU', region: 'home', when: ['spring', 'summer'],
    note: 'Puffins: black and white, orange feet and a bright striped bill, whirring low over the sea on fast little wings. They nest in burrows in the cliff-top turf and fly in with a row of sandeels crossways in the bill. After the summer the bright plates of the bill are shed, and they go out to sea for the winter.',
    look: 'Puffin Cove on Gannet Isle, in spring and summer: on the turf above, and rafted on the water below.',
  },
  razorbill: {
    name: 'Razorbills', one: 'Razorbill', sci: 'Alca torda', family: 'Alcidae', iucn: 'LC', region: 'home', when: ['spring', 'summer'],
    note: 'Razorbills: black and white auks with a deep, blunt bill crossed by a white line, standing upright on the ledges like little penguins. They fly underwater with their wings. The chick jumps from the ledge before it can fly, and swims out to sea with its father.',
    look: 'On the cliff ledges of Gannet Isle in spring and summer, and on the sea below.',
  },
  guillemot: {
    name: 'Common guillemots', one: 'Common guillemot', sci: 'Uria aalge', family: 'Alcidae', iucn: 'LC', region: 'home', when: ['spring', 'summer'],
    note: 'Guillemots: chocolate-brown and white auks with a thin pointed bill, packed shoulder to shoulder on bare ledges. Each pair lays one egg on the rock, and every egg is marked differently, so the parents know their own.',
    look: 'Packed on the ledges of Gannet Isle in spring and summer, and rafted on the sea below.',
  },
  gbbgull: {
    name: 'Great black-backed gulls', one: 'Great black-backed gull', sci: 'Larus marinus', family: 'Laridae', iucn: 'LC', region: 'home',
    note: 'The great black-backed gull: the biggest gull in the world, black-backed and heavy-billed. A pirate and a hunter, it takes rabbits, other seabirds, and anything a fisherman throws back.',
    look: 'Standing guard on the Skerries and the Calf’s skerry.',
  },
  peregrine: {
    name: 'Peregrine falcons', one: 'Peregrine falcon', sci: 'Falco peregrinus', family: 'Falconidae', iucn: 'LC', region: 'home',
    note: 'Peregrines: slate-blue falcons with a black moustache, the fastest animals on Earth, stooping on a pigeon or a wader at well over 300 km an hour.',
    look: 'High over the cliffs of Gannet Isle.',
  },
  chough: {
    name: 'Red-billed choughs', one: 'Red-billed chough', sci: 'Pyrrhocorax pyrrhocorax', family: 'Corvidae', iucn: 'LC', region: 'home',
    note: 'Choughs: glossy black crows with a curved red bill and red legs, tumbling and calling “chee-ow” round the sea cliffs, and digging in the short turf for ants and beetles.',
    look: 'Tumbling round the cliff tops of the Calf.',
  },
  raven: {
    name: 'Common ravens', one: 'Common raven', sci: 'Corvus corax', family: 'Corvidae', iucn: 'LC', region: 'home',
    note: 'Ravens: the biggest of the crows, all black with a wedge-shaped tail and a deep “kronk”, rolling over in flight for the fun of it. A pair stays together for life.',
    look: 'In pairs over the Calf and the hills behind Heron Point.',
  },
  kestrel: {
    name: 'Common kestrels', one: 'Common kestrel', sci: 'Falco tinnunculus', family: 'Falconidae', iucn: 'LC', region: 'both',
    note: 'Kestrels: small chestnut falcons hovering over rough grass, the head held dead still in the wind while the wings and tail work, watching for a vole or a lizard to drop on.',
    look: 'Hovering over the grass of Cove Head; at Las Brasas, over the slopes of the Roja.',
  },
  // The sea
  manx: {
    name: 'Manx shearwaters', one: 'Manx shearwater', sci: 'Puffinus puffinus', family: 'Procellariidae', iucn: 'LC', region: 'home', when: ['spring', 'summer'],
    note: 'Manx shearwaters: black above and white below, tilting from side to side low over the waves so they flash black, then white. They can live for fifty years and winter off South America; they come ashore to their burrows only at night, wailing in the dark.',
    look: 'Out at sea past the bay mouth in spring and summer, low over the waves.',
  },
  eider: {
    name: 'Common eiders', one: 'Common eider', sci: 'Somateria mollissima', family: 'Anatidae', iucn: 'NT', region: 'home',
    note: 'Eiders: heavy sea ducks. The drake is white above and black below with a green nape, the duck barred brown; the drakes croon a soft “ah-hooo” like gossip. The famous down that lines their nests is the duck’s own.',
    look: 'Rafted on the water by the Skerries.',
  },
  // The shore and the marsh
  redshank: {
    name: 'Common redshanks', one: 'Common redshank', sci: 'Tringa totanus', family: 'Scolopacidae', iucn: 'LC', region: 'home',
    note: 'Redshanks: brown waders with bright orange-red legs, the “warden of the marshes”: the first to see you coming, and off yelping, white wing-bars flashing.',
    look: 'On the mud of the Saltings and the Wend’s sandbanks.',
  },
  turnstone: {
    name: 'Ruddy turnstones', one: 'Ruddy turnstone', sci: 'Arenaria interpres', family: 'Scolopacidae', iucn: 'LC', region: 'both',
    note: 'Turnstones: stocky little waders in tortoiseshell, flipping over stones and weed along the tideline with their short bills for the sandhoppers underneath. The ones on these shores breed as far north as Greenland and arctic Canada.',
    look: 'Along the tideline of Shell Strand; at Las Brasas, on the rocks of the Faro point.',
  },
  egret: {
    name: 'Little egrets', one: 'Little egret', sci: 'Egretta garzetta', family: 'Ardeidae', iucn: 'LC', region: 'both',
    note: 'Little egrets: small, snow-white herons with a black bill, black legs and bright yellow feet, which they shuffle in the shallows to stir up shrimps. Shot near to nothing for their plumes a century ago, and back on every estuary now.',
    look: 'In the creeks of the Saltings; at Las Brasas, on the rocks by the harbour.',
  },
  rockpipit: {
    name: 'Rock pipits', one: 'Rock pipit', sci: 'Anthus petrosus', family: 'Motacillidae', iucn: 'LC', region: 'home',
    note: 'Rock pipits: small, dusky olive-grey birds with dark legs, flitting among the rocks and weed of the shore for sandhoppers and flies, and rising in a song flight in spring.',
    look: 'Among the rocks at the cove end of Shell Strand.',
  },
  // Rivers and lakes
  kingfisher: {
    name: 'Common kingfishers', one: 'Common kingfisher', sci: 'Alcedo atthis', family: 'Alcedinidae', iucn: 'LC', region: 'home',
    note: 'Kingfishers: a flash of electric blue low over the water and a shrill whistle, then gone. Close to, an orange breast and a dagger of a bill. It dives from a branch for minnows, and beats each one on the perch before swallowing it head first.',
    look: 'Along the Fernbeck by the camp, and the upper Wend: watch the banks for a blue streak.',
  },
  dipper: {
    name: 'White-throated dippers', one: 'White-throated dipper', sci: 'Cinclus cinclus', family: 'Cinclidae', iucn: 'LC', region: 'home',
    note: 'Dippers: plump and dark brown with a gleaming white bib, bobbing on the stones of fast streams, then walking underwater against the current to turn over stones for insect larvae.',
    look: 'On the stones of the Fernbeck and the Coldwater, where the water runs fast.',
  },
  muteswan: {
    name: 'Mute swans', one: 'Mute swan', sci: 'Cygnus olor', family: 'Anatidae', iucn: 'LC', region: 'home',
    note: 'Mute swans: huge and white, with an orange bill and a black knob on it, the neck held in an S. Not mute at all: they hiss and snort, and their wings throb loudly in flight.',
    look: 'On Reedmere and Longmere.',
  },
  mallard: {
    name: 'Mallards', one: 'Mallard', sci: 'Anas platyrhynchos', family: 'Anatidae', iucn: 'LC', region: 'home',
    note: 'Mallards: the drake with a glossy green head and a white collar, the duck mottled brown with a blue patch on the wing. It’s the duck who does the loud quacking.',
    look: 'On Reedmere, Longmere and the slow water of the rivers.',
  },
  // Las Brasas
  ylgull: {
    name: 'Yellow-legged gulls', one: 'Yellow-legged gull', sci: 'Larus michahellis', family: 'Laridae', iucn: 'LC', region: 'south',
    note: 'Yellow-legged gulls: the big gulls of Las Brasas, like a herring gull with a darker grey back and yellow legs. They nest on the cliffs and patrol the harbour for what the boats leave.',
    look: 'Round Puerto Brasa and along its mole.',
  },
  osprey: {
    name: 'Ospreys', one: 'Osprey', sci: 'Pandion haliaetus', family: 'Pandionidae', iucn: 'LC', region: 'south',
    note: 'Ospreys: big brown-and-white fish hawks with a dark band through the eye. They circle over the sea, then plunge feet first and come up with a fish held head-forward in both feet. Only a few pairs nest on the islands’ cliffs now.',
    look: 'Circling over the sea off the Arco and the island’s west cliffs.',
  },
  bulwer: {
    name: 'Bulwer’s petrels', one: 'Bulwer’s petrel', sci: 'Bulweria bulwerii', family: 'Procellariidae', iucn: 'LC', region: 'south', night: true,
    note: 'Bulwer’s petrels: small, all-dark petrels with long tails, zigzagging low over the sea at night. They nest in crevices in the island’s cliffs and call to each other in the dark with a low, dog-like bark.',
    look: 'At night, low over the sea round Las Brasas.',
  },
  whimbrel: {
    name: 'Eurasian whimbrels', one: 'Eurasian whimbrel', sci: 'Numenius phaeopus', family: 'Scolopacidae', iucn: 'LC', region: 'south',
    note: 'Whimbrels: smaller cousins of the curlew, with a shorter bent bill and a striped crown, picking crabs off the island’s black rocks. The call is a rippling whistle of seven notes.',
    look: 'On the black rocks of the Faro point.',
  },
  bpipit: {
    name: 'Berthelot’s pipits', one: 'Berthelot’s pipit', sci: 'Anthus berthelotii', family: 'Motacillidae', iucn: 'LC', region: 'south',
    note: 'Berthelot’s pipits: small, streaky grey pipits found only on the Canaries, Madeira and the Selvagens, running over the dry ground and stony slopes after insects.',
    look: 'Running over the dry ground round the village.',
  },
  canary: {
    name: 'Atlantic canaries', one: 'Atlantic canary', sci: 'Serinus canaria', family: 'Fringillidae', iucn: 'LC', region: 'south',
    note: 'Atlantic canaries: the wild bird every cage canary comes from, streaky green and yellow rather than bright yellow, singing their rolling song from the village gardens. Found only on the Canaries, Madeira and the Azores.',
    look: 'In the gardens and trees of the village.',
  },
  plainswift: {
    name: 'Plain swifts', one: 'Plain swift', sci: 'Apus unicolor', family: 'Apodidae', iucn: 'LC', region: 'south',
    note: 'Plain swifts: dark, sickle-winged swifts that breed only on the Canaries and Madeira, screaming in fast parties round the cliffs and over the village. They feed and drink on the wing, and spend almost all their lives in the air.',
    look: 'Screaming over the village and round the slopes of the Pico.',
  },
};
export const BIRD_KINDS = Object.keys(BIRDS);
