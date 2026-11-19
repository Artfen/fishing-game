import { REGISTER_DATA } from './registerData.js';
import { $t } from './i18n.js';

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
  { id: 'gironde', name: $t('Royan and the Gironde estuary') },
  { id: 'biscay', name: $t('French Bay of Biscay coast') },
  { id: 'cantabria', name: $t('Cantabrian coast') },
  { id: 'galicia', name: $t('Galicia and its rías') },
  { id: 'portugal', name: $t('Portuguese Atlantic coast') },
  { id: 'cadiz', name: $t('Algarve and the Gulf of Cádiz') },
];

export const STATUS_WORDS = {
  catchable: $t('In the game · catchable now'),
  observation: $t('In the game · to be seen, not caught'),
  planned: $t('Planned · not in the game yet'),
  verify: $t('Needs verification · not in the game'),
  retired: $t('Retired · fictional, no longer in the water'),
};

// Game species → register entries. Most share an id; the squid of the coves is the European
// squid, Loligo vulgaris.
const GAME_TO_REGISTER = { squid: 'squid' };

// The playable roster: what the game has done with each register entry. Every species here
// lives in its habitats, has an anatomical model, takes the setup the field guide recommends
// in the headless ecosystem (tests/guide.test.mjs), can be landed with it (tests/fight.test.mjs)
// and is logged in the journal. The European eel is in the water to be seen only: it is
// critically endangered and protected. The dusky grouper lives only round Las Brasas, far to
// the south (kept on a line, never speared: see dive.js).
const CATCHABLE = [
  // the first species and the reference models
  'seabass', 'meagre', 'gilthead', 'sole', 'mackerel', 'cuttlefish', 'mullet', 'wrasse', 'flounder', 'plaice', 'sprat', 'tuna', 'squid',
  // The Living Atlantic
  'baila', 'blackbream', 'whitebream', 'twobanded', 'striped', 'urta', 'redporgy', 'pandora', 'dentex', 'borriquete', 'roncador',
  'pollack', 'conger', 'bluefish', 'senegalsole', 'sandsole', 'acedia', 'turbot', 'gurnard', 'sardine', 'anchovy', 'horsemackerel',
  'sandsmelt', 'bogue', 'salema', 'garfish', 'bonito', 'littletunny', 'bullet', 'pompano', 'octopus',
  // Las Brasas, far to the south (the grouper to be released)
  'grouper', 'chubmackerel',
  // The big game of the open ocean (see bigGame.js), every shark released
  'blueshark', 'mako', 'albacore',
  // The angling depth release: the thornback (released), the catshark, the weever (released), hake and the John Dory
  'thornback', 'catshark', 'weever', 'hake', 'johndory',
  // The small fish of the rocks and the estuary, for micro-fishing (smallFish.js), every one released
  'rockgoby', 'shanny', 'corkwing', 'blackgoby',
  // The north, up the coast (northFish.js): the cod, saithe, ling and haddock, and the flapper
  // skate, critically endangered, to be released
  'cod', 'saithe', 'ling', 'haddock', 'skate',
];
const GAME = {
  ...Object.fromEntries(CATCHABLE.map((id) => [id, { status: 'catchable', model: 'anatomical' }])),
  eel: { status: 'observation', model: 'anatomical' },
};

// The research catalogue beyond the roster, in the order it could come into the game (see the
// expansion plan in the README). Deep-water fish and occasional visitors may stay here.
const BATCH = {
  // next: common coastal fish still missing, and catch-and-release on the bottom.
  redmullet: 2, thinlip: 2, goldengrey: 2,
  // deeper water and rarer visitors.
  stingray: 3,
  // migratory and protected estuary species, with seasons (observation-only where protected).
  allisshad: 4, twaiteshad: 4, lamprey: 4, sturgeon: 4,
};

// How a planned species should come into the game where catching it isn't the whole story:
// protected species only to be seen, vulnerable ones to be released (see each entry's
// conservation notes and sources). (The dusky grouper came in this way, as catch-and-release:
// vulnerable, slow-growing and protected in parts of its range; it may be kept on a line now,
// and is still never speared.)
export const PLAN_AS = {
  sturgeon: { as: 'observation', why: $t('Fully protected (fishing banned in France since 1982; critically endangered).') },
  allisshad: { as: 'observation', why: $t('All fishing for it in the Gironde basin has been under a moratorium since 2008.') },
  lamprey: { as: 'observation', why: $t('All fishing for it in the Gironde estuary has been banned since 2023.') },
  stingray: { as: 'release', why: $t('Vulnerable, and its tail spine is venomous.') },
  thornback: { as: 'release', why: $t('Near threatened.') },
  skate: { as: 'release', why: $t('Critically endangered, and protected: never landed.') },
};

// Records to settle before the species can be planned in detail (none open at the moment).
export const VERIFY = {};

// Species whose scientific name is unsettled, though the fish itself is not in doubt.
export const NAME_NOTES = {
  whitebream: $t('Its scientific name on this coast is unsettled. WoRMS and the Catalog of Fishes give the Atlantic fish as Diplodus cadenati (D. sargus being Mediterranean); FishBase, the French checklist and most regional surveys and rules still call it D. sargus.'),
  bullet: $t('Identified as Auxis rochei, the commoner of the two bullet tunas here; the very similar frigate tuna (A. thazard) also turns up in Iberian catches, and the Spanish “melva” and Portuguese “judeu” cover both.'),
  squid: $t('The usual inshore night-jigging squid of this coast is Loligo vulgaris; the veined squid (L. forbesii) lives deeper and further north and may also be caught in Galicia.'),
  pompano: $t('Several other fish share its Spanish names (palometa, pámpano): the leerfish, the blue butterfish and Ray’s bream.'),
};

// Common names for display, where the register's English name is one few anglers would know.
const DISPLAY_EN = {
  whitebream: $t('white seabream'), // FishBase: "Moroccan white seabream" for D. cadenati
  sardine: $t('European sardine'), // FishBase: "European pilchard"
};

export const REGISTER = REGISTER_DATA.map((r) => {
  const g = GAME[r.id];
  return {
    ...r,
    names: DISPLAY_EN[r.id] ? { ...r.names, en: DISPLAY_EN[r.id] } : r.names,
    game: g ? r.id : null,
    status: g?.status || (VERIFY[r.id] ? $t('verify') : $t('planned')),
    verify: VERIFY[r.id] || null,
    nameNote: NAME_NOTES[r.id] || null,
    model: g?.model || 'none',
    batch: g ? 1 : BATCH[r.id] || null,
    planAs: g ? null : PLAN_AS[r.id] || null,
  };
});
export const registerById = Object.fromEntries(REGISTER.map((r) => [r.id, r]));
// A common name as a title: "common two-banded seabream" → "Common Two-Banded Seabream".
export const titleName = (s) => s.replace(/(^|[\s-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
export const registerFor = (gameId) => registerById[GAME_TO_REGISTER[gameId] || gameId] || null;

// The five fish of Slow Tide's first version were invented. Each was replaced by a real species
// of this coast in the same role, and no longer lives in the water. Catches of them stay in the
// journal under their own names: they are never renamed into a different species.
export const LEGACY = {
  glassminnow: { replacement: 'sandsmelt', replacementName: $t('sand smelt, Atherina presbyter'), why: $t('Small, translucent, with a silver stripe, schooling over shallow sand and weed: the same role.') },
  sunperch: { replacement: 'twobanded', replacementName: $t('two-banded seabream, Diplodus vulgaris'), why: $t('A small, bold, day-active fish of weed and rocks in sheltered bays that takes worms, prawns and little lures.') },
  drizzlefin: { replacement: 'pollack', replacementName: $t('pollack, Pollachius pollachius'), why: $t('A lure-hitting predator of open water off rocks, deeper by day and higher in dull weather.') },
  duskfin: { replacement: 'horsemackerel', replacementName: $t('Atlantic horse mackerel, Trachurus trachurus'), why: $t('Comes up at night and gathers under lights in coves and harbours.') },
  mossback: { replacement: 'conger', replacementName: $t('European conger, Conger conger'), why: $t('A large, slow fish of the deepest rocks that takes a bait lying on the bottom.') },
};

// Freshwater species stay outside the Atlantic catalogue. (Their names are standard; their
// ranges and status in Iberia are noted, not researched in depth yet.)
export const FRESHWATER = {
  perch: { scientific: 'Perca fluviatilis', note: $t('Native to France; introduced in Iberia.') },
  pike: { scientific: 'Esox lucius', note: $t('Native to France; introduced in Iberia.') },
  carp: { scientific: 'Cyprinus carpio (mirror form)', note: $t('An introduced, domesticated form of the common carp.') },
  rudd: { scientific: 'Scardinius erythrophthalmus', note: $t('Native to France; introduced in parts of Iberia.') },
  trout: { scientific: 'Salmo trutta', note: $t('Native along the whole coast’s rivers.') },
  grayling: { scientific: 'Thymallus thymallus', note: $t('Native in parts of France; not native to Iberia.') },
  tench: { scientific: 'Tinca tinca', note: $t('Native to France and Iberia.') },
  roach: { scientific: 'Rutilus rutilus', note: $t('Native to France; introduced in Iberia.') },
  lmbass: { scientific: 'Micropterus salmoides', note: $t('A North American fish, introduced and invasive in France and Iberia.') },
  minnow: { scientific: 'Phoxinus phoxinus', note: $t('Native to France from the Garonne north and east; the minnows of Iberia are other, closely related species.') },
};

// Fish of Las Brasas, the invented island far to the south, that live outside the Atlantic
// register (which covers Royan to Cádiz): warm-water fish of the eastern Atlantic islands
// (Macaronesia: the Azores, Madeira, the Canaries, Cape Verde) and the coasts near them. Like the
// freshwater species, their names are standard and their ranges and status are noted here, not
// researched in depth. (The dusky grouper and the chub mackerel are in the register.)
// The north's own fish (northFish.js): cold-water fish of the north-east Atlantic, outside the
// register's Biscay-to-Cádiz range, with their names and ranges here (as Las Brasas' have theirs).
export const NORTHERN = {
  cod: { scientific: 'Gadus morhua', note: $t('The North Atlantic, in the east from the Bay of Biscay to the Barents Sea; common round Scotland and Norway, in the sea lochs in winter. IUCN global: Vulnerable (VU), assessed 1996.') },
  saithe: { scientific: 'Pollachius virens', note: $t('The North Atlantic, in the east from the Bay of Biscay to Svalbard and the Barents Sea; abundant round the Scottish isles and Norway, young fish inshore in shoals.') },
  ling: { scientific: 'Molva molva', note: $t('The north-east Atlantic from the Bay of Biscay to Iceland and northern Norway, on rocky ground and wrecks from about 100 to 400 m, shallower in the sea lochs.') },
  haddock: { scientific: 'Melanogrammus aeglefinus', note: $t('Both sides of the North Atlantic, in the east from the Bay of Biscay to Spitsbergen, on sand and mud. IUCN global: Vulnerable (VU), assessed 1996.') },
  skate: { scientific: 'Dipturus intermedius', note: $t('The north-east Atlantic, now mostly off western Scotland, round Orkney and in the deep sea lochs; once widespread. IUCN: Critically Endangered (CR), as part of the common skate complex; protected in the UK and the EU, never to be landed.') },
};

export const MACARONESIA = {
  parrotfish: { scientific: 'Sparisoma cretense', note: $t('Eastern Atlantic islands and the warm coasts from Portugal to Senegal, and the Mediterranean; very common on Canary reefs, where it is the prized “vieja”.') },
  ornatewrasse: { scientific: 'Thalassoma pavo', note: $t('Shallow rocky reefs of the Mediterranean and the eastern Atlantic, from Portugal south to the Gulf of Guinea, the Atlantic islands included; abundant in the Canaries.') },
  triggerfish: { scientific: 'Balistes capriscus', note: $t('Both sides of the Atlantic, in the east from the Mediterranean to Angola, the Canaries included.') },
  moray: { scientific: 'Muraena helena', note: $t('Rocky coasts of the Mediterranean and the eastern Atlantic, the Atlantic islands included; common in the Canaries.') },
  barracuda: { scientific: 'Sphyraena viridensis', note: $t('The Mediterranean and the eastern Atlantic islands (the Azores, Madeira, the Canaries, Cape Verde).') },
  amberjack: { scientific: 'Seriola dumerili', note: $t('Warm seas worldwide, the Canaries included. Large amberjack from warm waters have been linked to ciguatera there.') },
  angelshark: { scientific: 'Squatina squatina', note: $t('Once from Scandinavia to north-west Africa and the Mediterranean; critically endangered (IUCN), protected in Spain, and the Canaries are one of its last strongholds. Observation only.') },
  trumpetfish: { scientific: 'Aulostomus strigosus', note: $t('Reefs of the eastern Atlantic islands (Madeira, the Canaries, Cape Verde) and the tropical coast of West Africa. Not fished: observation only.') },
  chromis: { scientific: 'Chromis limbata', note: $t('The Atlantic islands (the Azores, Madeira, the Canaries, Cape Verde) and the West African coast; one of the most abundant fish over Canary reefs, in loose aggregations from a few metres down to about 50 m. Too small to be fished: observation only.') },
  comber: { scientific: 'Serranus atricauda', note: $t('The eastern Atlantic from the Bay of Biscay to Morocco and the Atlantic islands, rare in the Mediterranean; very common on Canary rocky bottoms (the “cabrilla negra”), from the shallows to over 100 m. Territorial; a hermaphrodite with both sexes at once.') },
  // The big game of the blue water (bigGame.js): the billfish and the hammerhead are released.
  bluemarlin: { scientific: 'Makaira nigricans', note: $t('Tropical and warm-temperate Atlantic; off the Canaries and Madeira mostly in summer, when the islands are a noted big-game ground. Released by anglers; the Atlantic stock is managed by ICCAT.') },
  sailfish: { scientific: 'Istiophorus platypterus', note: $t('Warm seas worldwide (the Atlantic fish was once named Istiophorus albicans). Commonest off West Africa (Senegal, Cape Verde); a summer visitor round the Canaries. Released by anglers.') },
  spearfish: { scientific: 'Tetrapturus pfluegeri', note: $t('Open ocean of the tropical and warm Atlantic; rarely caught anywhere, though the Canaries and Madeira are among the places it turns up most. Released by anglers.') },
  wahoo: { scientific: 'Acanthocybium solandri', note: $t('Tropical and subtropical oceans worldwide, the Canaries included (the “peto”), mostly in the warmer months. A prized food fish.') },
  dorado: { scientific: 'Coryphaena hippurus', note: $t('Warm oceans worldwide; common round the Canaries in summer and autumn, often under floating weed and debris. Fast-growing and short-lived; a prized food fish (mahi-mahi).') },
  yellowfin: { scientific: 'Thunnus albacares', note: $t('Tropical and subtropical oceans worldwide; the Canaries’ “rabil”, fished in the warmer months. Managed by ICCAT.') },
  hammerhead: { scientific: 'Sphyrna zygaena', note: $t('Warm-temperate seas worldwide, the Canaries included, often near the surface; listed as Vulnerable (IUCN) and on CITES Appendix II. Released by anglers.') },
};
