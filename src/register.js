import { REGISTER_DATA } from './registerData.js';

// The Atlantic species register: a sourced checklist of fish and cephalopods of the European
// Atlantic coast from Royan and the Gironde estuary to Cádiz, the long-term goal of Slow
// Tide's sea. It is an initial checklist, NOT a complete inventory: it lists the species
// researched so far, each with its sources, names, habitat, size, regional occurrence with a
// confidence level, and what's uncertain. registerData.js holds the researched entries (from
// FishBase, SeaLifeBase, DORIS, WoRMS, regional checklists and papers, and official documents;
// see each entry's sources); this file says how the game uses them.
//
// Status, for the game:
//  · catchable   – in the game, spawning in its habitats, and tested biting (headless) on the
//                  setup the field guide recommends, which the tackle rules accept;
//  · observation – in the game to be seen (underwater, on the fish finder) but not caught;
//  · planned     – researched, not in the game yet;
//  · verify      – a record that needs checking before it can be planned.

export const REGIONS = [
  { id: 'gironde', name: 'Royan and the Gironde estuary' },
  { id: 'biscay', name: 'French Bay of Biscay coast' },
  { id: 'cantabria', name: 'Cantabrian coast' },
  { id: 'galicia', name: 'Galicia and its rías' },
  { id: 'portugal', name: 'Portuguese Atlantic coast' },
  { id: 'cadiz', name: 'Algarve and the Gulf of Cádiz' },
];

export const STATUS_WORDS = {
  catchable: 'In the game · catchable now',
  observation: 'In the game · to be seen, not caught',
  planned: 'Planned · not in the game yet',
  verify: 'Needs verification · not in the game',
};

// Game species → register entries. Most share an id; the squid of the coves is the European
// squid, Loligo vulgaris.
const GAME_TO_REGISTER = { squid: 'squid' };

// What the game has done with each register entry, and how far its model has come.
const GAME = {
  seabass: { status: 'catchable', model: 'anatomical' },
  meagre: { status: 'catchable', model: 'anatomical' },
  gilthead: { status: 'catchable', model: 'anatomical' },
  sole: { status: 'catchable', model: 'anatomical' },
  mackerel: { status: 'catchable', model: 'anatomical' },
  cuttlefish: { status: 'catchable', model: 'anatomical' },
  mullet: { status: 'catchable', model: 'basic' },
  wrasse: { status: 'catchable', model: 'basic' },
  flounder: { status: 'catchable', model: 'basic' },
  plaice: { status: 'catchable', model: 'basic' },
  sprat: { status: 'catchable', model: 'basic' },
  tuna: { status: 'catchable', model: 'basic' },
  squid: { status: 'catchable', model: 'basic' },
};

// The order further species should come in (see the expansion plan in the README).
const BATCH = {
  // 2: the Willow Bay replacements and the commonest coastal species.
  sandsmelt: 2, twobanded: 2, pollack: 2, horsemackerel: 2, conger: 2, whitebream: 2, blackbream: 2, octopus: 2,
  // 3: flatfish and the Gulf of Cádiz.
  senegalsole: 3, sandsole: 3, acedia: 3, turbot: 3, gurnard: 3, urta: 3, baila: 3, roncador: 3, borriquete: 3,
  // 4: schooling and offshore fish.
  sardine: 4, anchovy: 4, chubmackerel: 4, bonito: 4, littletunny: 4, bullet: 4, garfish: 4, bluefish: 4, pompano: 4, salema: 4, bogue: 4,
  // 5: reef, deeper water, sharks and rays (several observation-only).
  striped: 5, redporgy: 5, pandora: 5, dentex: 5, hake: 5, johndory: 5, redmullet: 5, thornback: 5, stingray: 5, catshark: 5, blueshark: 5, weever: 5, shanny: 5, grouper: 5,
  // 6: migratory and protected estuary species (observation-only where protected).
  allisshad: 6, twaiteshad: 6, eel: 6, lamprey: 6, sturgeon: 6, thinlip: 6, goldengrey: 6,
};

// How a planned species should come into the game where catching it isn't the whole story:
// protected species only to be seen, vulnerable ones to be released (see each entry's
// conservation notes and sources).
export const PLAN_AS = {
  sturgeon: { as: 'observation', why: 'Fully protected (fishing banned in France since 1982; critically endangered).' },
  allisshad: { as: 'observation', why: 'All fishing for it in the Gironde basin has been under a moratorium since 2008.' },
  eel: { as: 'observation', why: 'Critically endangered; banned to leisure fishing in the Gironde estuary.' },
  lamprey: { as: 'observation', why: 'All fishing for it in the Gironde estuary has been banned since 2023.' },
  grouper: { as: 'release', why: 'Vulnerable, slow-growing and protected in parts of its range.' },
  stingray: { as: 'release', why: 'Vulnerable, and its tail spine is venomous.' },
  blueshark: { as: 'release', why: 'Near threatened.' },
  thornback: { as: 'release', why: 'Near threatened.' },
};

// Records to settle before the species can be planned in detail.
export const VERIFY = {
  whitebream: 'Which name applies on this coast is unsettled. WoRMS and the Catalog of Fishes give the Atlantic fish as Diplodus cadenati (D. sargus being Mediterranean), while FishBase, the French checklist and most regional surveys and rules still call it D. sargus.',
};

// Common names for display, where the register's English name is one few anglers would know.
const DISPLAY_EN = {
  whitebream: 'white seabream', // FishBase: "Moroccan white seabream" for D. cadenati
  sardine: 'European sardine', // FishBase: "European pilchard"
};

export const REGISTER = REGISTER_DATA.map((r) => {
  const g = GAME[r.id];
  return {
    ...r,
    names: DISPLAY_EN[r.id] ? { ...r.names, en: DISPLAY_EN[r.id] } : r.names,
    game: g ? r.id : null,
    status: g?.status || (VERIFY[r.id] ? 'verify' : 'planned'),
    verify: VERIFY[r.id] || null,
    model: g?.model || 'none',
    batch: g ? 1 : BATCH[r.id] || null,
    planAs: g ? null : PLAN_AS[r.id] || null,
  };
});
export const registerById = Object.fromEntries(REGISTER.map((r) => [r.id, r]));
// A common name as a title: "common two-banded seabream" → "Common Two-Banded Seabream".
export const titleName = (s) => s.replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
export const registerFor = (gameId) => registerById[GAME_TO_REGISTER[gameId] || gameId] || null;

// The five fish of Slow Tide's first version were invented. Each has a real species of this
// coast proposed to take its place, chosen for the same role in the game. Catches of them stay
// in the journal under their own names: they are never renamed into a different species.
export const LEGACY = {
  glassminnow: { replacement: 'sandsmelt', replacementName: 'sand smelt, Atherina presbyter', why: 'Small, translucent, with a silver stripe, schooling over shallow sand and weed: the same role.' },
  sunperch: { replacement: 'twobanded', replacementName: 'two-banded seabream, Diplodus vulgaris', why: 'A small, bold, day-active fish of weed and rocks in sheltered bays that takes worms, prawns and little lures.' },
  drizzlefin: { replacement: 'pollack', replacementName: 'pollack, Pollachius pollachius', why: 'A lure-hitting predator of open water off rocks, deeper by day and higher in dull weather.' },
  duskfin: { replacement: 'horsemackerel', replacementName: 'Atlantic horse mackerel, Trachurus trachurus', why: 'Comes up at night and gathers under lights in coves and harbours.' },
  mossback: { replacement: 'conger', replacementName: 'European conger, Conger conger', why: 'A large, slow fish of the deepest rocks that takes a bait lying on the bottom (needs an eel body plan).' },
};

// Freshwater species stay outside the Atlantic catalogue. (Their names are standard; their
// ranges and status in Iberia are noted, not researched in depth yet.)
export const FRESHWATER = {
  perch: { scientific: 'Perca fluviatilis', note: 'Native to France; introduced in Iberia.' },
  pike: { scientific: 'Esox lucius', note: 'Native to France; introduced in Iberia.' },
  carp: { scientific: 'Cyprinus carpio (mirror form)', note: 'An introduced, domesticated form of the common carp.' },
  rudd: { scientific: 'Scardinius erythrophthalmus', note: 'Native to France; introduced in parts of Iberia.' },
  trout: { scientific: 'Salmo trutta', note: 'Native along the whole coast’s rivers.' },
  grayling: { scientific: 'Thymallus thymallus', note: 'Native in parts of France; not native to Iberia.' },
  tench: { scientific: 'Tinca tinca', note: 'Native to France and Iberia.' },
  roach: { scientific: 'Rutilus rutilus', note: 'Native to France; introduced in Iberia.' },
  lmbass: { scientific: 'Micropterus salmoides', note: 'A North American fish, introduced and invasive in France and Iberia.' },
};
