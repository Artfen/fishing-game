import { fishById, weightOf } from './fish.js';
import { sizePrice } from './market.js';
import { $t } from './i18n.js';

// Kaigan ("the shore"): a Nikkei kitchen, Japanese and Peruvian (sushi, sashimi, ceviche and
// tiradito), in the old net store on Willowhaven quay. Kenji Higa, its chef (a Lima kitchen, an
// Okinawan grandmother), buys at the kitchen door from the boats:
//
//  · Only sea fish, and only the kinds his counter serves: never a fresh water fish raw, never
//    the oily, the bony or the risky (no blue shark, no barracuda, no salema).
//  · Fit to eat raw: caught within the last twelve hours (time on ice doesn't count: ice stops
//    the clock, see shop.js chill). Older than that, up to a day, he takes it for the hot kitchen
//    at a little over half the price; older again, not at all.
//  · By the kilo, well over the market for the fish he wants; tonight's two specials half as much
//    again; a prime fish of its kind more by the kilo.
//  · A fish's price softens as it nears the most he'll give for one (£90 for most, £160 to £200
//    for the big ocean fish, £500 for a whole bluefin, which he breaks down himself into ōtoro,
//    chūtoro and akami), so a bigger fish always fetches more, but no one fish makes the purse
//    meaningless.

export const KAIGAN_HOURS = [10, 21];   // the kitchen door: prep in the morning, buying till service
export const RAW_HOURS = 12;            // fit for the counter
export const KITCHEN_HOURS = 24;        // for the hot kitchen (tempura, the grill, the pot)
export const KITCHEN_SHARE = 0.55;
export const SPECIAL = 1.5;
export const CAP = 90;

// What each kind becomes, and what he pays (£ a kilo, as fresh as it comes); cap: the most he'll
// give for one, if not CAP.
export const DISHES = {
  tuna: { dish: $t('the whole fish broken down at the counter: ōtoro, chūtoro and akami'), k: 12, cap: 500 },
  yellowfin: { dish: $t('kihada sashimi'), k: 9, cap: 200 },
  albacore: { dish: $t('bincho tataki, seared and sliced'), k: 8, cap: 160 },
  bonito: { dish: $t('katsuo tataki, seared over a straw fire'), k: 9 },
  littletunny: { dish: $t('little tunny tataki'), k: 7 },
  bullet: { dish: $t('bullet tuna tataki'), k: 6 },
  bluemarlin: { dish: $t('kajiki sashimi'), k: 5, cap: 200 },
  sailfish: { dish: $t('sailfish sashimi'), k: 5, cap: 160 },
  spearfish: { dish: $t('spearfish sashimi'), k: 5, cap: 160 },
  amberjack: { dish: $t('kanpachi sashimi'), k: 12, cap: 200 },
  wahoo: { dish: $t('ono sashimi with ponzu'), k: 14, cap: 200 },
  dorado: { dish: $t('ceviche of dorado in leche de tigre'), k: 13, cap: 180 },
  grouper: { dish: $t('tiradito de mero with ají amarillo'), k: 20, cap: 200 },
  meagre: { dish: $t('ceviche de corvina, the classic of Lima'), k: 18 },
  seabass: { dish: $t('suzuki usuzukuri, sliced paper-thin'), k: 24 },
  baila: { dish: $t('usuzukuri of spotted bass'), k: 16 },
  gilthead: { dish: $t('tai nigiri'), k: 20 },
  redporgy: { dish: $t('madai sashimi'), k: 18 },
  dentex: { dish: $t('dentex sashimi'), k: 18 },
  urta: { dish: $t('tiradito of red-banded bream'), k: 16 },
  pandora: { dish: $t('pandora nigiri'), k: 12 },
  blackbream: { dish: $t('black bream nigiri'), k: 12 },
  whitebream: { dish: $t('white bream nigiri'), k: 12 },
  turbot: { dish: $t('hirame nigiri, and the engawa seared'), k: 28 },
  sole: { dish: $t('tiradito de lenguado'), k: 24 },
  senegalsole: { dish: $t('tiradito de lenguado'), k: 22 },
  sandsole: { dish: $t('tiradito de lenguado'), k: 20 },
  flounder: { dish: $t('ceviche of flounder'), k: 10 },
  plaice: { dish: $t('plaice usuzukuri'), k: 12 },
  johndory: { dish: $t('matōdai usuzukuri'), k: 28 },
  mackerel: { dish: $t('shime saba, cured in salt and rice vinegar'), k: 9 },
  chubmackerel: { dish: $t('saba nigiri'), k: 6 },
  horsemackerel: { dish: $t('aji tataki with ginger and spring onion'), k: 8 },
  sardine: { dish: $t('iwashi nigiri'), k: 8 },
  garfish: { dish: $t('sayori nigiri'), k: 7 },
  mullet: { dish: $t('bora tiradito'), k: 6 },
  squid: { dish: $t('ika sōmen, cut as fine as noodles'), k: 15 },
  cuttlefish: { dish: $t('kōika nigiri'), k: 12 },
  octopus: { dish: $t('tako, and pulpo al olivo'), k: 16 },
  conger: { dish: $t('anago, simmered and brushed with sweet sauce'), k: 9 },
};
export const takes = (sp) => !!sp && !!DISHES[sp.id] && !!sp.meal && sp.water !== 'fresh';

// A small, steady hash for the day's dice.
function dice(seed) {
  let s = (Math.imul(seed | 0, 2654435761) ^ 0x27d4eb2f) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Tonight's specials: two kinds, the same all day, whoever asks (never the bluefin: a whole one
// is the house's special whenever it comes in).
export function specialsFor(day) {
  const r = dice(day * 41 + 13);
  const pool = Object.keys(DISHES).filter((id) => id !== 'tuna' && fishById[id]?.meal).sort();
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 2);
}

// How fit a fish is, by the hours since it was caught (on ice not counted): 'raw' | 'kitchen' |
// 'old'. (A fish from an old save, with no time on it, counts as fresh.)
export function gradeOf(f, now) {
  if (!Number.isFinite(f.at) || !Number.isFinite(now)) return 'raw';
  const age = Math.max(0, now - f.at);
  return age <= RAW_HOURS ? 'raw' : age <= KITCHEN_HOURS ? 'kitchen' : 'old';
}

// The most he'll give, approached softly: in full up to half of it, then easing towards it.
export function soften(raw, cap) {
  const h = cap / 2;
  return raw <= h ? raw : h + h * (1 - Math.exp(-(raw - h) / h));
}

// What a fish from your creel fetches at Kaigan today: { price, kg, each (£/kg), grade, special,
// prime, dish, wanted (false if he doesn't take the kind), cap }.
export function kaiganValue(f, { day, now } = {}) {
  const sp = fishById[f?.id];
  const D = sp && DISHES[sp.id];
  const none = { price: 0, kg: 0, each: 0, grade: 'raw', special: false, prime: false, dish: '', wanted: false, cap: 0 };
  if (!D || f.cooked || !takes(sp)) return none;
  const kg = f.kg ?? weightOf(sp, f.size), grade = gradeOf(f, now), cap = D.cap ?? CAP;
  const special = sp.id === 'tuna' || specialsFor(day).includes(sp.id);
  const size = sizePrice(sp, f.size);
  const each = Math.round(D.k * (special && sp.id !== 'tuna' ? SPECIAL : 1) * size * (grade === 'kitchen' ? KITCHEN_SHARE : 1) * 100) / 100;
  const price = grade === 'old' ? 0 : Math.max(0.5, Math.round(soften(kg * each, cap * (grade === 'kitchen' ? KITCHEN_SHARE : 1)) * 20) / 20);
  return { price, kg, each, grade, special, prime: size > 1, dish: D.dish, wanted: true, cap };
}

// A line of the receipt: what it was, what it'll be, its weight and price.
export function kaiganLine(f, v) {
  const sp = fishById[f.id];
  const why = [v.grade === 'kitchen' ? $t('for the hot kitchen') : v.dish, v.special && sp.id !== 'tuna' ? $t('tonight’s special') : '', v.prime ? $t('a prime fish') : ''].filter(Boolean);
  return { id: f.id, name: sp.name, size: f.size, kg: Math.round(v.kg * 100) / 100, each: v.each, why, price: v.price };
}

// The words for a fish's grade, at the kitchen door.
export const gradeWords = (g) => (g === 'raw' ? $t('fit to eat raw') : g === 'kitchen' ? $t('caught over twelve hours ago: for the hot kitchen') : $t('too old for his kitchen'));
