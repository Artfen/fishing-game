// Keeping your catch, and Kaigan (src/kaigan.js, src/harbourView.js, src/world/havenHouses.js):
// nearly every fish you can catch can be kept now, to eat or to sell (only the mako and the
// hammerhead go back, as the law has it); and in the old net store on Willowhaven quay, Kaigan,
// a Nikkei kitchen, buys sea fish fit to eat raw, well over the market, a whole bluefin best of
// all. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A very small stand-in for the page: just what the harbour's sheet uses.
class FakeEl {
  constructor(tag) {
    this.tag = tag;
    this.children = [];
    this.className = '';
    this.textContent = '';
    this.hidden = false;
    this.disabled = false;
    this.isConnected = true;
    this.listeners = {};
  }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  click() { for (const f of this.listeners.click || []) f({ stopPropagation() {}, target: this }); }
  getContext() { return ctx2d; }
}
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
const byId = new Map();
globalThis.document = {
  createElement: (tag) => new FakeEl(tag),
  getElementById: (id) => {
    if (!byId.has(id)) byId.set(id, new FakeEl('div'));
    return byId.get(id);
  },
  fonts: null,
};
const all = (e, out = []) => {
  out.push(e);
  for (const c of e.children || []) if (c instanceof FakeEl) all(c, out);
  return out;
};
const buttons = (id) => all(document.getElementById(id)).filter((e) => e.tag === 'button');
const text = (id) => all(document.getElementById(id)).map((e) => e.textContent).join('\n');

const { FISH, fishById, weightOf } = await import('../src/fish.js');
const M = await import('../src/market.js');
const K = await import('../src/kaigan.js');
const { chill } = await import('../src/shop.js');
const { HarbourSheet } = await import('../src/harbourView.js');

const now = 10 * 24 + 14;
const fresh = (id, size, extra = {}) => ({ id, size, logId: `${id}-${size}`, at: now - 2, ...extra });

test('nearly every fish you can catch can be kept now, to eat or to sell; only the mako, the hammerhead and the little fish of the rocks and streams go back', () => {
  // (The small fish for micro-fishing, smallFish.js, are caught to be seen and noted, and released:
  // gobies, blennies, a nest-building wrasse and minnows are nobody's supper.)
  const catchable = FISH.filter((sp) => !sp.retired && !sp.life.observe && !sp.life.micro);
  const kept = catchable.filter((sp) => sp.meal);
  assert.ok(kept.length / catchable.length >= 0.97, `${kept.length} of ${catchable.length}`);
  assert.deepEqual(catchable.filter((sp) => !sp.meal).map((sp) => sp.id).sort(), ['hammerhead', 'mako']);
  for (const sp of FISH.filter((f) => f.life.micro)) assert.ok(!sp.meal && sp.keep.length > 20, `${sp.id}: released, and says why`);
  // Each of them a meal at camp and a price somewhere.
  for (const sp of kept) {
    assert.ok(sp.meal.name.length > 8 && sp.meal.fill > 0, sp.id);
    assert.ok(sp.id in M.PRICES, `${sp.id}: priced`);
  }
  // The ones that used to go back.
  for (const id of ['tuna', 'bluemarlin', 'sailfish', 'blueshark', 'grouper', 'amberjack', 'conger', 'thornback', 'wrasse', 'sprat']) assert.ok(fishById[id].meal, id);
  // And the two that still do say why.
  for (const id of ['mako', 'hammerhead']) assert.match(fishById[id].keep, /every/i);
  // Mags takes a bluefin too, though she can't give what it's worth: the big fish's limit.
  const tuna = M.fishValue(fresh('tuna', 150), { day: 10, now });
  assert.ok(tuna.wanted && tuna.price === M.BIG_MAX_PRICE, `${tuna.price}`);
});

test('Kaigan buys sea fish fit to eat raw, well over the market; never fresh water fish, never the risky ones, nothing cooked', () => {
  for (const id of Object.keys(K.DISHES)) {
    const sp = fishById[id];
    assert.ok(sp && sp.meal && sp.water !== 'fresh', `${id}: a sea fish you can keep`);
  }
  const day = 10;
  for (const [id, size] of [['seabass', 60], ['mackerel', 34], ['turbot', 60], ['squid', 28], ['meagre', 90]]) {
    const k = K.kaiganValue(fresh(id, size), { day, now }), m = M.fishValue(fresh(id, size), { day, now });
    assert.ok(k.wanted && k.grade === 'raw' && k.dish.length > 4, id);
    assert.ok(k.price > m.price * 1.25, `${id}: £${k.price} at Kaigan, £${m.price} at the market`);
  }
  for (const id of ['trout', 'carp', 'blueshark', 'barracuda', 'salema']) assert.equal(K.kaiganValue(fresh(id, 40), { day, now }).wanted, false, id);
  assert.equal(K.kaiganValue(fresh('seabass', 60, { cooked: true }), { day, now }).wanted, false);
});

test('fit to eat raw only fresh: within twelve hours full price, then the hot kitchen at little over half, older not at all; ice stops the clock', () => {
  const day = 10, at = (h) => fresh('seabass', 60, { at: now - h });
  const v0 = K.kaiganValue(at(2), { day, now }), v1 = K.kaiganValue(at(18), { day, now }), v2 = K.kaiganValue(at(30), { day, now });
  assert.equal(v0.grade, 'raw');
  assert.equal(v1.grade, 'kitchen');
  assert.ok(Math.abs(v1.price / v0.price - K.KITCHEN_SHARE) < 0.05, `${v1.price} / ${v0.price}`);
  assert.equal(v2.grade, 'old');
  assert.equal(v2.price, 0);
  // A fish caught last night, a day on ice: still fit for the counter.
  const state = { keep: [fresh('seabass', 60, { at: now - 24 })], shop: { creel: 0, iceUntil: now + 1, baitDay: 0, wear: {} } };
  chill(state, now - 23, now);
  assert.equal(K.gradeOf(state.keep[0], now), 'raw');
});

test('tonight’s specials: two kinds, the same all day, different on other days, half as much again', () => {
  const a = K.specialsFor(10);
  assert.equal(a.length, 2);
  assert.deepEqual(K.specialsFor(10), a);
  assert.ok(!a.includes('tuna'));
  const seen = new Set();
  for (let d = 1; d < 40; d++) for (const id of K.specialsFor(d)) seen.add(id);
  assert.ok(seen.size > 12, `${seen.size} kinds over forty days`);
  // On a day it's a special, the same fish fetches half as much again (as far as its limit allows).
  const id = 'mackerel';
  const on = [...Array(80).keys()].find((d) => K.specialsFor(d).includes(id)), off = [...Array(80).keys()].find((d) => !K.specialsFor(d).includes(id));
  const vOn = K.kaiganValue(fresh(id, 34), { day: on, now }), vOff = K.kaiganValue(fresh(id, 34), { day: off, now });
  assert.ok(Math.abs(vOn.each / vOff.each - K.SPECIAL) < 0.02);
});

test('a whole bluefin: the best price on the coast, more for a bigger fish, never more than £500', () => {
  const day = 10, sp = fishById.tuna;
  let last = 0;
  for (const size of [sp.size[0], 120, 140, 160, sp.size[1]]) {
    const v = K.kaiganValue(fresh('tuna', size), { day, now });
    assert.ok(v.price > last, `${size} cm: £${v.price}`);
    assert.ok(v.price <= 500);
    last = v.price;
  }
  // A big one, 150 cm (some 67 kg): several times what Mags can give, and more than any other fish.
  const big = K.kaiganValue(fresh('tuna', 150), { day, now }).price;
  assert.ok(big > 400 && big > M.BIG_MAX_PRICE * 3, `£${big}`);
  for (const id of Object.keys(K.DISHES).filter((x) => x !== 'tuna')) {
    const s = fishById[id].size[1];
    assert.ok(K.kaiganValue(fresh(id, s), { day, now }).price < big, id);
  }
  // Everything else: within its limit, and softened as it nears it (a bigger fish still fetches more).
  assert.ok(K.soften(1000, 200) < 200 && K.soften(1000, 200) > K.soften(400, 200) && K.soften(50, 200) === 50);
});

test('at the kitchen door: Kenji’s board, the price for each fish, a sale into the purse, the bluefin an occasion; shut out of hours; Mags points you his way', () => {
  const state = { day: 10, hour: 14, money: 20, keep: [], harbour: null, fish: {}, shop: null };
  const log = [];
  const sheet = new HarbourSheet(state, {
    toast: (t) => log.push(t), chime() {}, changed() {}, close: () => sheet.close(),
    now: () => state.day * 24 + state.hour, sold: (id) => log.push(`sold ${id}`),
  });
  state.keep.push(fresh('tuna', 150), fresh('seabass', 60), fresh('trout', 40));
  // At the market first: Mags says Kaigan would give more for the bluefin.
  sheet.open('market');
  assert.match(text('hb-body'), /Kenji at Kaigan.*would give/);
  sheet.close();
  sheet.open('kaigan');
  const body = text('hb-body');
  assert.match(body, /On the board tonight/);
  assert.match(body, /Never a fresh water fish raw/);
  const tunaPrice = K.kaiganValue(state.keep[0], { day: 10, now: 10 * 24 + 14 }).price;
  buttons('hb-body').find((b) => b.textContent === `Sell: ${M.money(tunaPrice)}`).click();
  assert.equal(state.money, Math.round((20 + tunaPrice) * 100) / 100);
  assert.deepEqual(state.keep.map((f) => f.id), ['seabass', 'trout']);
  assert.ok(log.some((t) => /whole kitchen comes out/.test(t)), 'the first bluefin');
  assert.deepEqual({ sold: state.harbour.kaigan.sold, bluefin: state.harbour.kaigan.bluefin }, { sold: 1, bluefin: 1 });
  sheet.close();
  // Out of hours, the door's shut: nothing to sell.
  state.hour = 23;
  sheet.open('kaigan');
  assert.match(text('hb-body'), /kitchen door is shut/);
  assert.ok(buttons('hb-body').filter((b) => b.textContent.startsWith('Sell')).every((b) => b.disabled));
});

test('the old net store is Kaigan now: its sign, its door where Kenji buys, clear of the walls', async () => {
  const THREE = await import('three');
  const { buildCoast } = await import('../src/world/coast.js');
  const { seeded } = await import('../src/util.js');
  const coast = buildCoast(new THREE.Scene(), seeded(20261024));
  const door = coast.spots.find((s) => s.kind === 'kaigan');
  assert.ok(door && door.id === 'store');
  assert.ok(!coast.obstacles.some((o) => o.kind === 'building' && Math.hypot(door.x - o.x, door.z - o.z) < o.r), 'the door clear of the walls');
  assert.ok(coast.houses.signs.kaigan, 'its sign');
  assert.ok(coast.obstacles.some((o) => o.name === 'Kaigan'));
});
