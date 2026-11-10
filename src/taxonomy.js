import { FISH, fishById } from './fish.js';
import { registerFor, MACARONESIA, FRESHWATER, LEGACY } from './register.js';
import { NATURE } from './grounds.js';
import { SEA_LIFE } from './world/sealife.js';

// The tree of life on this coast: every living thing in the game (the fish you catch and see, the
// whales, dolphins, seals and otters, the seabirds and the birds you hear, the turtle, and the
// small life of the seabed and the open water), each where a zoologist would put it: kingdom,
// phylum, class, order, family. Names and ranks follow WoRMS (the World Register of Marine
// Species); the orders of fishes follow Eschmeyer's Catalog of Fishes, which keeps the big
// perch-like branch's orders open while they're redrawn from DNA, as here; statuses are the IUCN
// Red List's, worldwide (for the fish, from the sourced register in register.js).
//
// One source for each thing: fish names and notes come from fish.js, their scientific names and
// statuses from register.js; the seabed's life from grounds.js; the sea life from sealife.js.
// This file adds only where each sits in the tree, and where to look for it.

export const KINGDOMS = {
  animalia: { name: 'Animals', sci: 'Animalia' },
  chromista: { name: 'Chromists', sci: 'Chromista', note: 'Not animals, and not plants either: the brown kelps and the glowing plankton belong to another great branch of complex life.' },
  plantae: { name: 'Plants and red algae', sci: 'Plantae' },
};

export const PHYLA = {
  chordata: { kingdom: 'animalia', name: 'Chordates', sci: 'Chordata', note: 'Animals with a backbone (and their kin): a stiff rod down the back at some time in their lives.' },
  mollusca: { kingdom: 'animalia', name: 'Molluscs', sci: 'Mollusca', note: 'Soft bodies, most with a shell: the clams and snails, and the clever, shell-less octopus and squid.' },
  arthropoda: { kingdom: 'animalia', name: 'Arthropods', sci: 'Arthropoda', note: 'A jointed shell outside, jointed legs: crabs, lobsters, shrimps and the insects.' },
  annelida: { kingdom: 'animalia', name: 'Segmented worms', sci: 'Annelida' },
  echinodermata: { kingdom: 'animalia', name: 'Echinoderms', sci: 'Echinodermata', note: 'Spiny skins, five-part bodies and hundreds of water-filled tube feet: the starfish, urchins, brittlestars and sea cucumbers. Closer kin to us than to the crabs or the octopus.' },
  cnidaria: { kingdom: 'animalia', name: 'Cnidarians', sci: 'Cnidaria', note: 'Stinging cells on every tentacle: the anemones, corals, sea pens and jellyfish.' },
  porifera: { kingdom: 'animalia', name: 'Sponges', sci: 'Porifera', note: 'The simplest animals: no organs, no nerves, a body of pores that pumps the sea through itself.' },
  ochrophyta: { kingdom: 'chromista', name: 'Brown algae and kin', sci: 'Ochrophyta' },
  myzozoa: { kingdom: 'chromista', name: 'Dinoflagellates and kin', sci: 'Myzozoa' },
  rhodophyta: { kingdom: 'plantae', name: 'Red algae', sci: 'Rhodophyta' },
};

export const CLASSES = {
  mammalia: { phylum: 'chordata', name: 'Mammals', sci: 'Mammalia', note: 'Warm-blooded, hair at some stage, milk for their young. In the sea they breathe air like us: every blow is a breath.' },
  aves: { phylum: 'chordata', name: 'Birds', sci: 'Aves', note: 'Feathers, beaks and eggs: the living dinosaurs.' },
  reptilia: { phylum: 'chordata', name: 'Reptiles', sci: 'Reptilia' },
  amphibia: { phylum: 'chordata', name: 'Amphibians', sci: 'Amphibia', note: 'A life in two worlds: tadpoles in water, adults that breathe air and through their skin.' },
  actinopterygii: { phylum: 'chordata', name: 'Ray-finned fishes', sci: 'Actinopterygii', note: 'Fins held up by fine bony rays: half of all the backboned animals there are.' },
  chondrichthyes: { phylum: 'chordata', name: 'Sharks, skates and rays', sci: 'Chondrichthyes', note: 'Skeletons of cartilage, not bone; skin like sandpaper, rough with tiny teeth.' },
  cephalopoda: { phylum: 'mollusca', name: 'Cephalopods', sci: 'Cephalopoda', note: 'Molluscs whose foot became arms round the head: three hearts, blue blood, skin that changes colour in a blink.' },
  bivalvia: { phylum: 'mollusca', name: 'Bivalves', sci: 'Bivalvia', note: 'Two shells hinged together, and a life spent filtering the water.' },
  malacostraca: { phylum: 'arthropoda', name: 'Crabs, lobsters and shrimps', sci: 'Malacostraca' },
  polychaeta: { phylum: 'annelida', name: 'Bristle worms', sci: 'Polychaeta' },
  asteroidea: { phylum: 'echinodermata', name: 'Starfish', sci: 'Asteroidea' },
  ophiuroidea: { phylum: 'echinodermata', name: 'Brittlestars', sci: 'Ophiuroidea' },
  echinoidea: { phylum: 'echinodermata', name: 'Sea urchins', sci: 'Echinoidea' },
  holothuroidea: { phylum: 'echinodermata', name: 'Sea cucumbers', sci: 'Holothuroidea' },
  anthozoa: { phylum: 'cnidaria', name: 'Anemones, corals and sea pens', sci: 'Anthozoa', note: 'Cnidarians that stay put, mouth up, all their lives.' },
  scyphozoa: { phylum: 'cnidaria', name: 'True jellyfish', sci: 'Scyphozoa' },
  phaeophyceae: { phylum: 'ochrophyta', name: 'Brown seaweeds', sci: 'Phaeophyceae' },
  dinophyceae: { phylum: 'myzozoa', name: 'Dinoflagellates', sci: 'Dinophyceae', note: 'Single cells with two whip-like tails. Some feed, some photosynthesise, some light up.' },
};

// Orders, with what they are in a few words. ('percomorpha' is not an order: it holds the
// perch-like families whose orders are still being redrawn.)
export const ORDERS = {
  // Mammals
  artiodactyla: { sci: 'Artiodactyla', name: 'Even-toed hoofed mammals: here the whales and dolphins (Cetacea), cousins of the hippos' },
  carnivora: { sci: 'Carnivora', name: 'Carnivores' },
  // Birds
  suliformes: { sci: 'Suliformes', name: 'Gannets and cormorants' },
  pelecaniformes: { sci: 'Pelecaniformes', name: 'Herons, egrets, ibises and pelicans' },
  charadriiformes: { sci: 'Charadriiformes', name: 'Waders, gulls, terns and auks' },
  procellariiformes: { sci: 'Procellariiformes', name: 'Tubenoses: shearwaters, petrels and albatrosses' },
  strigiformes: { sci: 'Strigiformes', name: 'Owls' },
  // Reptiles and amphibians
  testudines: { sci: 'Testudines', name: 'Turtles and tortoises' },
  anura: { sci: 'Anura', name: 'Frogs and toads' },
  // Fishes
  percomorpha: { sci: 'Percomorpha', name: 'Perch-like fishes: the biggest branch of the fish tree, its orders still being redrawn from DNA', open: true },
  perciformes: { sci: 'Perciformes', name: 'Perches and their kin' },
  scombriformes: { sci: 'Scombriformes', name: 'Mackerels, tunas and their kin' },
  istiophoriformes: { sci: 'Istiophoriformes', name: 'Billfishes' },
  mugiliformes: { sci: 'Mugiliformes', name: 'Grey mullets' },
  atheriniformes: { sci: 'Atheriniformes', name: 'Silversides' },
  beloniformes: { sci: 'Beloniformes', name: 'Needlefishes and flying fishes' },
  syngnathiformes: { sci: 'Syngnathiformes', name: 'Pipefishes, seahorses and trumpetfishes' },
  tetraodontiformes: { sci: 'Tetraodontiformes', name: 'Triggerfishes and pufferfishes' },
  zeiformes: { sci: 'Zeiformes', name: 'Dories' },
  gadiformes: { sci: 'Gadiformes', name: 'Cods and hakes' },
  pleuronectiformes: { sci: 'Pleuronectiformes', name: 'Flatfishes: both eyes on one side' },
  clupeiformes: { sci: 'Clupeiformes', name: 'Herrings, sardines and anchovies' },
  anguilliformes: { sci: 'Anguilliformes', name: 'Eels' },
  esociformes: { sci: 'Esociformes', name: 'Pikes' },
  salmoniformes: { sci: 'Salmoniformes', name: 'Salmon, trout and grayling' },
  cypriniformes: { sci: 'Cypriniformes', name: 'Carps and minnows' },
  carcharhiniformes: { sci: 'Carcharhiniformes', name: 'Ground sharks' },
  lamniformes: { sci: 'Lamniformes', name: 'Mackerel sharks' },
  squatiniformes: { sci: 'Squatiniformes', name: 'Angel sharks' },
  rajiformes: { sci: 'Rajiformes', name: 'Skates' },
  // Cephalopods and bivalves
  octopoda: { sci: 'Octopoda', name: 'Octopuses' },
  sepiida: { sci: 'Sepiida', name: 'Cuttlefishes' },
  myopsida: { sci: 'Myopsida', name: 'Inshore squids' },
  pectinida: { sci: 'Pectinida', name: 'Scallops' },
  unionida: { sci: 'Unionida', name: 'Freshwater mussels' },
  // Arthropods
  decapoda: { sci: 'Decapoda', name: 'Ten-legged crustaceans: crabs, lobsters, shrimps' },
  // Echinoderms
  forcipulatida: { sci: 'Forcipulatida', name: 'Sea stars with tiny pincers on their skin' },
  spinulosida: { sci: 'Spinulosida', name: 'Spiny sea stars' },
  ophiurida: { sci: 'Ophiurida', name: 'Brittlestars' },
  camarodonta: { sci: 'Camarodonta', name: 'Sea urchins' },
  diadematoida: { sci: 'Diadematoida', name: 'Long-spined urchins' },
  holothuriida: { sci: 'Holothuriida', name: 'Sea cucumbers' },
  // Cnidarians
  actiniaria: { sci: 'Actiniaria', name: 'Sea anemones' },
  corallimorpharia: { sci: 'Corallimorpharia', name: 'Corallimorphs: anemone-like, but nearer the stony corals' },
  spirularia: { sci: 'Spirularia', name: 'Tube anemones' },
  malacalcyonacea: { sci: 'Malacalcyonacea', name: 'Soft corals and sea fans' },
  scleralcyonacea: { sci: 'Scleralcyonacea', name: 'Sea pens and their kin' },
  semaeostomeae: { sci: 'Semaeostomeae', name: 'Jellyfish with long, frilled mouth arms' },
  // Not animals
  laminariales: { sci: 'Laminariales', name: 'Kelps' },
  noctilucales: { sci: 'Noctilucales', name: 'Sea sparkle' },
};

// Families: their order, and what they are in a few words.
export const FAMILIES = {
  // Mammals
  Delphinidae: ['artiodactyla', 'Oceanic dolphins'], Balaenopteridae: ['artiodactyla', 'Rorquals'], Physeteridae: ['artiodactyla', 'Sperm whales'],
  Phocidae: ['carnivora', 'True seals'], Mustelidae: ['carnivora', 'Weasels, badgers and otters'],
  // Birds
  Sulidae: ['suliformes', 'Gannets and boobies'], Phalacrocoracidae: ['suliformes', 'Cormorants and shags'], Ardeidae: ['pelecaniformes', 'Herons, egrets and bitterns'],
  Laridae: ['charadriiformes', 'Gulls, terns and skimmers'], Haematopodidae: ['charadriiformes', 'Oystercatchers'], Scolopacidae: ['charadriiformes', 'Sandpipers, curlews and snipes'],
  Procellariidae: ['procellariiformes', 'Shearwaters and petrels'], Strigidae: ['strigiformes', 'Typical owls'],
  // Reptiles and amphibians
  Cheloniidae: ['testudines', 'Sea turtles'], Ranidae: ['anura', 'True frogs'],
  // Ray-finned fishes
  Moronidae: ['percomorpha', 'Temperate basses'], Sparidae: ['percomorpha', 'Sea breams'], Labridae: ['percomorpha', 'Wrasses'], Scaridae: ['percomorpha', 'Parrotfishes'],
  Sciaenidae: ['percomorpha', 'Drums and croakers'], Haemulidae: ['percomorpha', 'Grunts'], Serranidae: ['percomorpha', 'Sea basses and combers'], Epinephelidae: ['percomorpha', 'Groupers'],
  Pomacentridae: ['percomorpha', 'Damselfishes'], Carangidae: ['percomorpha', 'Jacks and pompanos'], Pomatomidae: ['percomorpha', 'Bluefish'], Trachinidae: ['percomorpha', 'Weevers'],
  Triglidae: ['percomorpha', 'Gurnards'], Centrarchidae: ['percomorpha', 'Sunfishes and black basses'], Sphyraenidae: ['percomorpha', 'Barracudas'], Coryphaenidae: ['percomorpha', 'Dolphinfishes'],
  Percidae: ['perciformes', 'Perches'], Scombridae: ['scombriformes', 'Mackerels and tunas'], Istiophoridae: ['istiophoriformes', 'Marlins and sailfishes'],
  Mugilidae: ['mugiliformes', 'Grey mullets'], Atherinidae: ['atheriniformes', 'Silversides'], Belonidae: ['beloniformes', 'Needlefishes'], Exocoetidae: ['beloniformes', 'Flying fishes'],
  Aulostomidae: ['syngnathiformes', 'Trumpetfishes'], Balistidae: ['tetraodontiformes', 'Triggerfishes'], Zeidae: ['zeiformes', 'Dories'],
  Gadidae: ['gadiformes', 'Cods'], Merlucciidae: ['gadiformes', 'Hakes'],
  Pleuronectidae: ['pleuronectiformes', 'Righteye flounders'], Soleidae: ['pleuronectiformes', 'True soles'], Scophthalmidae: ['pleuronectiformes', 'Turbots'],
  Clupeidae: ['clupeiformes', 'Herrings and sprats'], Alosidae: ['clupeiformes', 'Shads and sardines'], Engraulidae: ['clupeiformes', 'Anchovies'],
  Anguillidae: ['anguilliformes', 'Freshwater eels'], Congridae: ['anguilliformes', 'Conger and garden eels'], Muraenidae: ['anguilliformes', 'Morays'],
  Esocidae: ['esociformes', 'Pikes'], Salmonidae: ['salmoniformes', 'Salmon, trout and grayling'],
  Cyprinidae: ['cypriniformes', 'Carps'], Leuciscidae: ['cypriniformes', 'Minnows, roach and rudd'], Tincidae: ['cypriniformes', 'Tench'],
  // Sharks and rays
  Carcharhinidae: ['carcharhiniformes', 'Requiem sharks'], Sphyrnidae: ['carcharhiniformes', 'Hammerheads'], Scyliorhinidae: ['carcharhiniformes', 'Catsharks'],
  Lamnidae: ['lamniformes', 'Mackerel sharks'], Squatinidae: ['squatiniformes', 'Angel sharks'], Rajidae: ['rajiformes', 'Skates'],
  // Molluscs
  Octopodidae: ['octopoda', 'Octopuses'], Sepiidae: ['sepiida', 'Cuttlefishes'], Loliginidae: ['myopsida', 'Inshore squids'],
  Pectinidae: ['pectinida', 'Scallops'], Unionidae: ['unionida', 'River mussels'],
  // Arthropods
  Paguridae: ['decapoda', 'Hermit crabs'], Nephropidae: ['decapoda', 'Clawed lobsters'],
  // Annelids (no order: the bristle worms' orders are unsettled)
  Arenicolidae: [null, 'Lugworms'],
  // Echinoderms
  Asteriidae: ['forcipulatida', 'Sea stars'], Echinasteridae: ['spinulosida', 'Spiny sea stars'], Ophiuridae: ['ophiurida', 'Brittlestars'],
  Echinidae: ['camarodonta', 'Sea urchins'], Diadematidae: ['diadematoida', 'Long-spined urchins'], Holothuriidae: ['holothuriida', 'Sea cucumbers'],
  // Cnidarians
  Actiniidae: ['actiniaria', 'Beadlet and dahlia anemones'], Metridiidae: ['actiniaria', 'Plumose anemones'], Corallimorphidae: ['corallimorpharia', 'Jewel anemones'],
  Cerianthidae: ['spirularia', 'Tube anemones'], Alcyoniidae: ['malacalcyonacea', 'Leathery soft corals'], Gorgoniidae: ['malacalcyonacea', 'Sea fans'],
  Pennatulidae: ['scleralcyonacea', 'Sea pens'], Ulmaridae: ['semaeostomeae', 'Moon jellies'], Pelagiidae: ['semaeostomeae', 'Sea nettles and stingers'],
  // Not animals
  Laminariaceae: ['laminariales', 'Kelps'], Noctilucaceae: ['noctilucales', 'Sea sparkle'],
};
const FISH_ORDERS = new Set(['percomorpha', 'perciformes', 'scombriformes', 'istiophoriformes', 'mugiliformes', 'atheriniformes', 'beloniformes', 'syngnathiformes', 'tetraodontiformes', 'zeiformes', 'gadiformes', 'pleuronectiformes', 'clupeiformes', 'anguilliformes', 'esociformes', 'salmoniformes', 'cypriniformes']);
const SHARK_ORDERS = new Set(['carcharhiniformes', 'lamniformes', 'squatiniformes', 'rajiformes']);

// The fish families the register doesn't give (the fresh water fish, Las Brasas' own, and a few).
const FISH_FAMILY = {
  perch: 'Percidae', pike: 'Esocidae', carp: 'Cyprinidae', rudd: 'Leuciscidae', trout: 'Salmonidae', grayling: 'Salmonidae', tench: 'Tincidae', roach: 'Leuciscidae', lmbass: 'Centrarchidae',
  parrotfish: 'Scaridae', ornatewrasse: 'Labridae', triggerfish: 'Balistidae', moray: 'Muraenidae', barracuda: 'Sphyraenidae', amberjack: 'Carangidae',
  angelshark: 'Squatinidae', trumpetfish: 'Aulostomidae', bluemarlin: 'Istiophoridae', sailfish: 'Istiophoridae', spearfish: 'Istiophoridae', wahoo: 'Scombridae',
  dorado: 'Coryphaenidae', yellowfin: 'Scombridae', hammerhead: 'Sphyrnidae', chromis: 'Pomacentridae', comber: 'Serranidae',
};
// Their statuses (IUCN, worldwide), where the register doesn't give one and the listing is clear.
const FISH_IUCN = {
  perch: 'LC', pike: 'LC', carp: 'VU', rudd: 'LC', trout: 'LC', grayling: 'LC', tench: 'LC', roach: 'LC', lmbass: 'LC',
  angelshark: 'CR', bluemarlin: 'VU', hammerhead: 'VU', yellowfin: 'LC', dorado: 'LC', wahoo: 'LC', amberjack: 'LC', moray: 'LC', ornatewrasse: 'LC',
};

export const IUCN = {
  LC: 'Least Concern', NT: 'Near Threatened', VU: 'Vulnerable', EN: 'Endangered', CR: 'Critically Endangered', DD: 'Data Deficient', NE: 'Not Evaluated',
};
const IUCN_WORDS = { 'Least Concern': 'LC', 'Near Threatened': 'NT', Vulnerable: 'VU', 'Critically Endangered': 'CR', Endangered: 'EN', 'Data Deficient': 'DD', 'Not Evaluated': 'NE', 'Not Assessed': 'NE' };
// The status in a register entry's conservation notes ("IUCN global: Near Threatened (NT), …",
// "IUCN Least Concern (assessed 2013 …)", "IUCN global: CR (A2bd …)"): the first one after "IUCN".
export function iucnOf(text) {
  const i = typeof text === 'string' ? text.search(/IUCN/) : -1;
  if (i < 0) return null;
  // ("Not Assessed by IUCN …; DORIS cites LC": not assessed, whatever older lists say.)
  if (/Not (Assessed|Evaluated) by (the )?IUCN/i.test(text)) return 'NE';
  const m = text.slice(i, i + 160).match(/\b(Least Concern|Near Threatened|Vulnerable|Critically Endangered|Endangered|Data Deficient|Not Evaluated|Not Assessed)\b|\b(LC|NT|VU|EN|CR|DD|NE)\b/);
  return m ? m[2] || IUCN_WORDS[m[1]] : null;
}

// Everything that isn't a fish from fish.js: where it sits, its scientific name and status, and
// where to look for it (name: as a species list has it, if not as the notes do). src: 'sea' (sealife.js, seen from above the water or heard) or 'nature'
// (grounds.js, met on a dive). rank: the level the entry is at, if not a species.
export const LIFE = {
  // Whales, dolphins and the rest (sealife.js)
  bottlenose: { src: 'sea', name: 'Bottlenose dolphin', cls: 'mammalia', family: 'Delphinidae', sci: 'Tursiops truncatus', iucn: 'LC', look: 'In the bay and the deep water past it, and off Las Brasas: they come to ride a moving boat’s bow wave.' },
  commondolphin: { src: 'sea', name: 'Common dolphin', cls: 'mammalia', family: 'Delphinidae', sci: 'Delphinus delphis', iucn: 'LC', look: 'Big pods over the deep water well out past the bay mouth, and racing to a bow on the crossing.' },
  spotteddolphin: { src: 'sea', name: 'Atlantic spotted dolphin', cls: 'mammalia', family: 'Delphinidae', sci: 'Stenella frontalis', iucn: 'LC', look: 'Off Las Brasas, in the lee and the harbour approaches.' },
  pilotwhale: { src: 'sea', name: 'Short-finned pilot whale', cls: 'mammalia', family: 'Delphinidae', sci: 'Globicephala macrorhynchus', iucn: 'LC', look: 'A family group in the deep water south-west of Las Brasas, often resting at the surface.' },
  finwhale: { src: 'sea', name: 'Fin whale', cls: 'mammalia', family: 'Balaenopteridae', sci: 'Balaenoptera physalus', iucn: 'VU', look: 'Far offshore past the bay, and in the cooler half of the crossing: watch for a tall, narrow blow.' },
  minkewhale: { src: 'sea', name: 'Common minke whale', cls: 'mammalia', family: 'Balaenopteridae', sci: 'Balaenoptera acutorostrata', iucn: 'LC', look: 'Offshore past the bay mouth: a dark back and a curved fin, rolling through and gone.' },
  spermwhale: { src: 'sea', name: 'Sperm whale', cls: 'mammalia', family: 'Physeteridae', sci: 'Physeter macrocephalus', iucn: 'VU', look: 'The deep water south of Las Brasas, and the warm half of the crossing: a bushy blow slanting forward.' },
  seal: { src: 'sea', name: 'Grey seal', cls: 'mammalia', family: 'Phocidae', sci: 'Halichoerus grypus', iucn: 'LC', look: 'Hauled out on Gannet Isle and the Skerries, or bobbing nearby. Go quietly and one may follow you.' },
  otter: { src: 'sea', name: 'Eurasian otter', cls: 'mammalia', family: 'Mustelidae', sci: 'Lutra lutra', iucn: 'NT', look: 'Along the quiet rivers and the salt channels at dawn and dusk. Approach softly.' },
  // Birds
  gannet: { src: 'sea', name: 'Northern gannet', cls: 'aves', family: 'Sulidae', sci: 'Morus bassanus', iucn: 'LC', look: 'Over a shoal driven to the surface: watch for white birds plunging.' },
  shearwater: { src: 'sea', name: 'Cory’s shearwater', cls: 'aves', family: 'Procellariidae', sci: 'Calonectris borealis', iucn: 'LC', look: 'Round Las Brasas and on the crossing: low over the waves, and down on a bait shoal with the tuna.' },
  cormorant: { src: 'sea', name: 'Great cormorant', cls: 'aves', family: 'Phalacrocoracidae', sci: 'Phalacrocorax carbo', iucn: 'LC', look: 'On the rocks with its wings spread to dry, or swimming low and diving.' },
  heron: { src: 'sea', name: 'Grey heron', cls: 'aves', family: 'Ardeidae', sci: 'Ardea cinerea', iucn: 'LC', look: 'Standing still in the shallows of the rivers and the saltings.' },
  tern: { src: 'sea', name: 'Common tern', cls: 'aves', family: 'Laridae', sci: 'Sterna hirundo', iucn: 'LC', look: 'In summer, hovering over the shallows and plunging after sand smelt.' },
  herringgull: { src: 'sea', name: 'European herring gull', cls: 'aves', family: 'Laridae', sci: 'Larus argentatus', iucn: 'LC', look: 'Round Gull Rock past the bay mouth, and over the bay by day; over any shoal the fish drive up.' },
  oystercatcher: { src: 'sea', name: 'Eurasian oystercatcher', cls: 'aves', family: 'Haematopodidae', sci: 'Haematopus ostralegus', iucn: 'NT', look: 'On the sand and mud at low water. They go off piping if you come too close.' },
  curlew: { src: 'sea', name: 'Eurasian curlew', cls: 'aves', family: 'Scolopacidae', sci: 'Numenius arquata', iucn: 'NT', look: 'Listen in the cove’s channel and the salt inlets, best at dawn and dusk.' },
  tawnyowl: { src: 'sea', name: 'Tawny owl', cls: 'aves', family: 'Strigidae', sci: 'Strix aluco', iucn: 'LC', look: 'Listen ashore at night, away from the sea’s noise.' },
  // A reptile and an amphibian
  turtle: { src: 'sea', name: 'Loggerhead turtle', cls: 'reptilia', family: 'Cheloniidae', sci: 'Caretta caretta', iucn: 'VU', look: 'In the warm blue water round Las Brasas and on the crossing, drifting near the surface. Keep your boat slow near it.' },
  commonfrog: { src: 'sea', name: 'Common frog', cls: 'amphibia', family: 'Ranidae', sci: 'Rana temporaria', iucn: 'LC', look: 'Listen by the lakes on a warm night, or in the rain.' },
  // Fish seen rather than caught
  flyingfish: { src: 'sea', name: 'Flying fishes', cls: 'actinopterygii', family: 'Exocoetidae', sci: 'Exocoetidae', rank: 'family', look: 'Ahead of a moving boat in the warm blue water off Las Brasas and on the crossing.' },
  gardeneel: { src: 'nature', name: 'Brown garden eel', cls: 'actinopterygii', family: 'Congridae', sci: 'Heteroconger longissimus', look: 'Dive over the sand at Las Brasas, deeper than about five metres. They sink back if you rush.' },
  // The small life of the seabed and the open water (grounds.js)
  lobster: { src: 'nature', cls: 'malacostraca', family: 'Nephropidae', sci: 'Homarus gammarus', iucn: 'LC', look: 'Dive the Kittiwake: there’s one in the mouth of her boiler.' },
  hermit: { src: 'nature', cls: 'malacostraca', family: 'Paguridae', sci: 'Pagurus bernhardus', look: 'Dive over sand and look closely.' },
  scallop: { src: 'nature', cls: 'bivalvia', family: 'Pectinidae', sci: 'Pecten maximus', look: 'Dive over sand deeper than about four metres.' },
  mussel: { src: 'nature', cls: 'bivalvia', family: 'Unionidae', sci: 'Anodonta cygnea', look: 'In the mud of a lake: dive in fresh water.' },
  cast: { src: 'nature', name: 'Lugworm', cls: 'polychaeta', family: 'Arenicolidae', sci: 'Arenicola marina', look: 'Shallow sand: the coiled casts of their burrows.' },
  star: { src: 'nature', cls: 'asteroidea', family: 'Asteriidae', sci: 'Asterias rubens', look: 'Almost anywhere on a home dive: rock, weed and sand.' },
  redstar: { src: 'nature', cls: 'asteroidea', family: 'Echinasteridae', sci: 'Echinaster sepositus', look: 'On the rock and in the weed at Las Brasas.' },
  brittle: { src: 'nature', name: 'Brittlestars', cls: 'ophiuroidea', family: 'Ophiuridae', sci: 'Ophiura', rank: 'genus', look: 'Soft sand deeper than about seven metres.' },
  urchin: { src: 'nature', cls: 'echinoidea', family: 'Echinidae', sci: 'Echinus esculentus', look: 'On rock and in the weed on a home dive.' },
  diadema: { src: 'nature', cls: 'echinoidea', family: 'Diadematidae', sci: 'Diadema africanum', look: 'In herds on the black rock at Las Brasas.' },
  cucumber: { src: 'nature', cls: 'holothuroidea', family: 'Holothuriidae', sci: 'Holothuria sanctori', look: 'On the sand and in the weed at Las Brasas.' },
  dahlia: { src: 'nature', cls: 'anthozoa', family: 'Actiniidae', sci: 'Urticina felina', look: 'On rock: Skerries Reef.' },
  plumose: { src: 'nature', cls: 'anthozoa', family: 'Metridiidae', sci: 'Metridium dianthus', look: 'On the Kittiwake and the Hound, where the tide runs hard.' },
  jewel: { src: 'nature', cls: 'anthozoa', family: 'Corallimorphidae', sci: 'Corynactis viridis', look: 'On rock deeper than about five metres: sheets of them on the Hound’s walls.' },
  ceri: { src: 'nature', cls: 'anthozoa', family: 'Cerianthidae', sci: 'Cerianthus lloydii', look: 'Sand deeper than about eight metres: Anchor Sands.' },
  fingers: { src: 'nature', cls: 'anthozoa', family: 'Alcyoniidae', sci: 'Alcyonium digitatum', look: 'On the Kittiwake and the Hound’s ledges.' },
  fan: { src: 'nature', cls: 'anthozoa', family: 'Gorgoniidae', sci: 'Eunicella verrucosa', look: 'Standing off the walls of the Hound and its Pup.' },
  pen: { src: 'nature', cls: 'anthozoa', family: 'Pennatulidae', sci: 'Pennatula phosphorea', look: 'Soft sand deeper than about thirteen metres: Anchor Sands.' },
  moonjelly: { src: 'nature', cls: 'scyphozoa', family: 'Ulmaridae', sci: 'Aurelia aurita', look: 'In the open water at home, summer into autumn.' },
  compass: { src: 'nature', cls: 'scyphozoa', family: 'Pelagiidae', sci: 'Chrysaora hysoscella', look: 'In the open water at home at the end of the summer.' },
  stinger: { src: 'nature', cls: 'scyphozoa', family: 'Pelagiidae', sci: 'Pelagia noctiluca', look: 'In the open water at Las Brasas, any time of year.' },
  sponge: { src: 'nature', name: 'Sponges', phylum: 'porifera', sci: 'Porifera', rank: 'phylum', look: 'Yellow cushions on the rock on any dive.' },
  // Not animals
  kelp: { src: 'nature', name: 'Cuvie (forest kelp)', cls: 'phaeophyceae', family: 'Laminariaceae', sci: 'Laminaria hyperborea', look: 'On the reef tops: Skerries Reef, the Hound.' },
  red: { src: 'nature', name: 'Red seaweeds', phylum: 'rhodophyta', sci: 'Rhodophyta', rank: 'phylum', look: 'Under the kelp at Skerries Reef.' },
  glow: { src: 'sea', name: 'Sea sparkle', cls: 'dinophyceae', family: 'Noctilucaceae', sci: 'Noctiluca scintillans', look: 'At night, in a boat’s wake or under the oars: brighter some nights than others.' },
};
// (The sand smelt the divers meet in shoals is the sand smelt you catch: one species, one entry.)
const SAME = { fry: 'sandsmelt' };

const familyOf = (sp) => registerFor(sp.id)?.family || FISH_FAMILY[sp.id] || null;
const sciOf = (sp) => registerFor(sp.id)?.scientific || MACARONESIA[sp.id]?.scientific || FRESHWATER[sp.id]?.scientific || null;

// Every entry in the tree, in one list: { key, kind ('fish' | 'sea' | 'nature'), id, name, sci,
// rank, kingdom, phylum, cls, order, family, iucn, note, look }.
let ALL = null;
export function species() {
  if (ALL) return ALL;
  const out = [];
  for (const sp of FISH) {
    if (LEGACY[sp.id] || sp.retired) continue; // (the fictional fish of the first versions)
    const family = familyOf(sp), F = FAMILIES[family];
    const order = F?.[0] ?? null;
    const cls = sp.creature ? 'cephalopoda' : SHARK_ORDERS.has(order) ? 'chondrichthyes' : 'actinopterygii';
    const reg = registerFor(sp.id);
    out.push({ key: `fish:${sp.id}`, kind: 'fish', id: sp.id, name: sp.name, sci: sciOf(sp), rank: 'species', cls, family, order, iucn: iucnOf(reg?.conservation) || FISH_IUCN[sp.id] || null, note: sp.note, look: sp.hint });
  }
  for (const [id, L] of Object.entries(LIFE)) {
    const src = L.src === 'sea' ? SEA_LIFE[id] : NATURE[id];
    if (!src) continue;
    const F = FAMILIES[L.family];
    out.push({ key: `${L.src}:${id}`, kind: L.src, id, name: L.name || src.name, sci: L.sci, rank: L.rank || 'species', cls: L.cls || null, phylum: L.phylum || null, family: L.family || null, order: F?.[0] ?? null, iucn: L.iucn || null, note: src.note, look: L.look });
  }
  for (const e of out) {
    e.phylum ||= CLASSES[e.cls]?.phylum || null;
    e.kingdom = PHYLA[e.phylum]?.kingdom || 'animalia';
  }
  return (ALL = out);
}

// What you've recorded of an entry: { how ('caught' | 'seen' | 'met' | 'heard'), n, day, where,
// best (cm, a fish caught) } or null.
export function recordOf(state, e) {
  if (e.kind === 'fish') {
    const R = state.fish?.[e.id];
    if (R?.count) return { how: 'caught', n: R.count, best: R.best, day: null, where: '' };
    const O = state.observed?.[e.id];
    if (O?.count) return { how: 'seen', n: O.count, day: null, where: '' };
    // (Met in a shoal on a dive, as the field notes have it.)
    for (const [k, id] of Object.entries(SAME)) {
      const N = id === e.id && state.grounds?.notes?.[k];
      if (N) return { how: 'met', n: N.n, day: N.day, where: N.where };
    }
    return null;
  }
  if (e.kind === 'nature') {
    const N = state.grounds?.notes?.[e.id];
    return N ? { how: 'met', n: N.n, day: N.day, where: N.where } : null;
  }
  const S = state.seaLife?.[e.id];
  return S ? { how: S.heard ? 'heard' : 'seen', n: S.n, day: S.day, where: S.where } : null;
}

// The tree with what you've recorded in it: [{ id, ...KINGDOMS[id], n, of, phyla: [{ id, ...,
// n, of, classes: [{ id, ..., n, of, entries }], loose: [entries at phylum rank] }] }], each
// level in a steady order (the backboned animals first, then the rest as a zoologist lists them).
export function treeOf(state, list = species()) {
  const out = [];
  for (const [kid, K] of Object.entries(KINGDOMS)) {
    const phyla = [];
    for (const [pid, P] of Object.entries(PHYLA)) {
      if (P.kingdom !== kid) continue;
      const classes = [];
      for (const [cid, C] of Object.entries(CLASSES)) {
        if (C.phylum !== pid) continue;
        const entries = list.filter((e) => e.cls === cid);
        if (entries.length) classes.push({ id: cid, ...C, entries, of: entries.length, n: entries.filter((e) => recordOf(state, e)).length });
      }
      const loose = list.filter((e) => e.phylum === pid && !e.cls);
      const all = [...classes.flatMap((c) => c.entries), ...loose];
      if (all.length) phyla.push({ id: pid, ...P, classes, loose, of: all.length, n: all.filter((e) => recordOf(state, e)).length });
    }
    if (phyla.length) out.push({ id: kid, ...K, phyla, of: phyla.reduce((s, p) => s + p.of, 0), n: phyla.reduce((s, p) => s + p.n, 0) });
  }
  return out;
}

// A class's entries by order and family: [{ order, info, families: [{ family, name, entries }] }],
// orders in the order they're listed above, families alphabetically, species by name.
export function byOrder(entries) {
  const keys = Object.keys(ORDERS);
  const orders = new Map();
  for (const e of entries) {
    const o = e.order ?? '';
    if (!orders.has(o)) orders.set(o, new Map());
    const fams = orders.get(o);
    if (!fams.has(e.family)) fams.set(e.family, []);
    fams.get(e.family).push(e);
  }
  return [...orders.entries()].sort((a, b) => (keys.indexOf(a[0]) + 1 || 999) - (keys.indexOf(b[0]) + 1 || 999)).map(([order, fams]) => ({
    order: order || null,
    info: ORDERS[order] || null,
    families: [...fams.entries()].sort((a, b) => String(a[0]).localeCompare(String(b[0]))).map(([family, list]) => ({
      family, name: FAMILIES[family]?.[1] || '', entries: list.sort((a, b) => a.name.localeCompare(b.name)),
    })),
  }));
}

export const fishOrders = FISH_ORDERS;
export { fishById };
