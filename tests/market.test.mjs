// The living harbour (market.js, innTalk.js, harbourView.js): the fish market on Willowhaven quay
// buying what you keep (by weight, more for what's wanted today, best while fresh), the kitchens
// at The Lobster Pot and Bar El Muelle asking for particular fish, and the talk at the bar
// (stories, advice and rumours, every word of it true). Run with
// `node --import ./tests/setup.mjs --test tests/`.
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
const I = await import('../src/innTalk.js');
const { HarbourSheet, PINT, PLATE } = await import('../src/harbourView.js');
const { parseSave, SAVE_VERSION } = await import('../src/save.js');
const T = await import('../src/world/terrain.js');

test('every fish you can keep has a price (nothing new slips through unpriced), and the lake’s coarse fish fetch nothing', () => {
  for (const sp of FISH) if (!sp.retired && sp.meal) assert.ok(sp.id in M.PRICES, `${sp.id} has no price`);
  for (const id of Object.keys(M.PRICES)) assert.ok(fishById[id]?.meal, `${id} is priced but can’t be kept`);
  assert.ok(M.PRICES.sole > M.PRICES.mackerel && M.PRICES.turbot > M.PRICES.bogue, 'the dear fish dear, the cheap ones cheap');
  const carp = M.fishValue({ id: 'carp', size: 50 }, { day: 1, now: 30 });
  assert.equal(carp.wanted, false);
  assert.equal(carp.price, 0);
});

test('the day’s demand: the same all day, different from day to day, and only fish the place buys', () => {
  assert.deepEqual(M.demandFor(5), M.demandFor(5));
  const seen = new Set();
  for (let d = 1; d <= 30; d++) {
    for (const place of ['haven', 'muelle']) {
      const D = M.demandFor(d, place);
      assert.equal(D.wanted.length, 2);
      assert.equal(D.plenty.length, 1);
      assert.ok(!D.wanted.includes(D.plenty[0]));
      for (const id of [...D.wanted, ...D.plenty]) assert.ok(M.buyers[place](fishById[id]), `${place} buys ${id}`);
      if (place === 'haven') seen.add(D.wanted.join());
    }
  }
  assert.ok(seen.size > 15, 'it changes');
  // Las Brasas' parrotfish at Paco's, not at Mags's slab; the home coast's sole at Mags's, not Paco's.
  assert.ok(M.buyers.muelle(fishById.parrotfish) && !M.buyers.haven(fishById.parrotfish));
  assert.ok(M.buyers.haven(fishById.sole) && !M.buyers.muelle(fishById.sole));
});

test('a fish fetches its weight in money, half as much again when wanted, less when there’s plenty, and less as it ages', () => {
  // A day the sea bass is wanted, and one it's just bass.
  let wanted = 0, plain = 0;
  for (let d = 1; d < 400 && (!wanted || !plain); d++) {
    const D = M.demandFor(d);
    if (!wanted && D.wanted.includes('seabass')) wanted = d;
    if (!plain && !D.wanted.includes('seabass') && !D.plenty.includes('seabass')) plain = d;
  }
  const bass = { id: 'seabass', size: 45, at: plain * 24 + 6 };
  const v = M.fishValue(bass, { day: plain, now: plain * 24 + 8 });
  assert.ok(Math.abs(v.price - weightOf(fishById.seabass, 45) * M.PRICES.seabass) < 0.06, `${v.price}`);
  assert.equal(v.fresh, 1);
  const w = M.fishValue({ ...bass, at: wanted * 24 + 6 }, { day: wanted, now: wanted * 24 + 8 });
  assert.equal(w.demand, 'wanted');
  assert.ok(Math.abs(w.price / v.price - 1.5) < 0.02);
  // Freshness: a day and a half old fetches less, two days and more just over half.
  assert.equal(M.freshness(0, 12), 1);
  assert.ok(M.freshness(0, 30) < 0.85 && M.freshness(0, 30) > 0.7);
  assert.equal(M.freshness(0, 100), 0.55);
  assert.equal(M.freshness(undefined, 100), 1, 'a fish from an old save, with no time on it, is fresh');
  const old = M.fishValue({ ...bass, at: plain * 24 - 40 }, { day: plain, now: plain * 24 + 8 });
  assert.ok(old.price < v.price * 0.6);
  // A cooked fish isn't for the slab; and no one fish breaks the bank.
  assert.equal(M.fishValue({ ...bass, cooked: true }, { day: plain, now: 0 }).price, 0);
  assert.ok(M.fishValue({ id: 'turbot', size: 80 }, { day: 1, now: 30 }).price <= M.MAX_PRICE);
});

test('the kitchens’ orders: two a day at The Lobster Pot, one at Paco’s, for fish worth cooking, paying better than the market', () => {
  for (let d = 1; d <= 40; d++) {
    const H = M.ordersFor(d), P = M.ordersFor(d, 'muelle');
    assert.equal(H.length, 2);
    assert.equal(P.length, 1);
    assert.notEqual(H[0].id, H[1].id);
    for (const o of [...H, ...P]) {
      const sp = fishById[o.id];
      assert.ok(sp.meal, o.id);
      assert.ok(o.min >= sp.size[0] && o.min < sp.size[1]);
      assert.ok(o.reward >= 6 && o.reward <= M.MAX_REWARD);
      const market = M.fishValue({ id: o.id, size: o.min }, { day: d, now: d * 24 }).price;
      assert.ok(o.reward >= Math.min(M.MAX_REWARD, market), `${o.id}: ${o.reward} vs ${market}`);
    }
    assert.deepEqual(M.ordersFor(d), H, 'the same all day');
  }
  // What fills one: the right fish, big enough, and raw.
  const o = { id: 'sole', min: 30 };
  assert.equal(M.fills([{ id: 'sole', size: 28 }, { id: 'plaice', size: 40 }], o), -1);
  assert.equal(M.fills([{ id: 'sole', size: 34, cooked: true }, { id: 'sole', size: 31 }], o), 1);
  assert.equal(M.money(12), '£12');
  assert.equal(M.money(3.4), '£3.40');
});

test('stories: a new one each time until you’ve heard them all; advice from the water as it is, about the right island', () => {
  const heard = [];
  for (let i = 0; i < I.STORIES.haven.length; i++) {
    const s = I.nextStory('haven', heard);
    assert.ok(!heard.includes(s.id));
    heard.push(s.id);
  }
  const again = I.nextStory('haven', heard);
  assert.ok(I.STORIES.haven.includes(again), 'then any of them again');
  const HOME_WORDS = /Calf|Fernbeck|Shell Strand|Old Jetty|Willow|quay wall/;
  const SOUTH_WORDS = /Faro|Coladas|Playa|Veril|Bajón|Brasa/;
  for (let h = 0; h < 24; h += 1.5) {
    for (const wind of [1, 5, 12]) {
      for (const storm of [0, 0.8]) {
        const home = I.adviceFor({ place: 'haven', hour: h, wind, storm, rain: 0.4, about: [], caught: new Set() });
        const south = I.adviceFor({ place: 'muelle', hour: h, wind, storm, rain: 0.4 });
        assert.ok(home.length > 40 && south.length > 40);
        assert.ok(!SOUTH_WORDS.test(home), home);
        assert.ok(!HOME_WORDS.test(south), south);
      }
    }
  }
  // What's about near the harbour comes up, with a nudge if you've never had one.
  const about = [{ sp: fishById.mackerel, where: 'out past the bay', how: 'a string of feathers on the spinning rod', act: 0.9 }];
  const said = new Set();
  for (let i = 0; i < 60; i++) said.add(I.adviceFor({ place: 'haven', hour: 12, wind: 5, storm: 0, rain: 0, about, caught: new Set() }));
  const mack = I.lower(fishById.mackerel.name);
  assert.equal(mack, 'Atlantic mackerel');
  assert.equal(I.an(I.lower(fishById.flounder.name)), 'a European flounder');
  assert.equal(I.an('octopus'), 'an octopus');
  assert.ok([...said].some((s) => s.includes(`${mack} are on out past the bay`) && s.startsWith(`You’ve not had an ${mack}`)), [...said].join(' | '));
});

test('the rumours are all true: nothing said without something there to say it about', () => {
  assert.deepEqual(I.rumoursNow({ place: 'haven', hour: 12 }), []);
  const nameOf = () => 'near Gull Rock';
  const r = I.rumoursNow({
    place: 'haven', hour: 16, nameOf, storm: 0.7, gannets: { x: 1, z: 2 }, boil: { x: 3, z: 4 },
    pods: [{ kind: 'commondolphin', x: 0, z: 0 }], whales: [{ kind: 'finwhale', x: 0, z: 0, up: true }], glow: 0.9,
    landed: [{ who: 'Dougie', name: 'Turbot', size: 61 }], yours: { name: 'Sea bass', size: 71 }, birds: ['Gulls are diving off Gull Rock.'],
  });
  for (const w of ['race off the Calf', 'gannets are diving near Gull Rock', 'tuna are up', 'common dolphins', 'fin whale', 'burning tonight', 'Dougie brought in a turbot', 'sea bass of yours, 71 cm', 'Mags says gulls are diving']) {
    assert.ok(r.some((l) => l.includes(w)), w);
  }
  const south = I.rumoursNow({ place: 'muelle', hour: 12, storm: 0.7, rain: 0.8 });
  assert.equal(south.length, 1);
  assert.ok(!/Dougie|Calf|Fernbeck/.test(south[0]));
});

test('saves keep your purse, the harbour’s record and when each fish was caught; an old save starts with £20', () => {
  const wrap = (data) => JSON.stringify({ game: 'slow-tide', version: SAVE_VERSION, savedAt: 1, data: { day: 3, ...data } });
  const old = parseSave(wrap({})).state;
  assert.equal(old.money, 20);
  assert.deepEqual(old.harbour, { heard: { haven: [], muelle: [] }, filled: [], earned: 0, sold: 0, served: 0 });
  const s = parseSave(wrap({
    money: 57.456,
    harbour: { heard: { haven: ['kittiwake', 'x y', 7], muelle: ['vieja'] }, filled: ['3-haven-0'], earned: 61, sold: 4, served: 1, junk: 1 },
    keep: [{ id: 'seabass', size: 44, logId: 'c1', at: 70.5 }, { id: 'mackerel', size: 30, logId: 'c2' }],
    log: [{ id: 'c1', sp: 'seabass', size: 44, day: 3, hour: 1, outcome: 'sold' }],
  })).state;
  assert.equal(s.money, 57.46);
  assert.deepEqual(s.harbour.heard, { haven: ['kittiwake'], muelle: ['vieja'] });
  assert.deepEqual(s.harbour.filled, ['3-haven-0']);
  assert.equal(s.harbour.sold, 4);
  assert.equal(s.keep[0].at, 70.5);
  assert.ok(!('at' in s.keep[1]));
  assert.equal(s.log[0].outcome, 'sold');
  assert.equal(parseSave(wrap({ money: -5 })).state.money, 0);
});

test('Willowhaven: The Lobster Pot level with the apron, facing down the quay, and the fish market by the board, each with its way in clear', async () => {
  const THREE = await import('three');
  const { buildCoast } = await import('../src/world/coast.js');
  const { seeded } = await import('../src/util.js');
  const coast = buildCoast(new THREE.Scene(), seeded(20261024));
  const inn = coast.spots.find((s) => s.kind === 'door' && s.id === 'inn');
  const market = coast.spots.find((s) => s.kind === 'market');
  assert.ok(inn && market);
  assert.ok(Math.abs(T.heightAt(inn.x, inn.z) - T.HAVEN_APRON.h) < 0.05, 'you walk in off the setts');
  const I0 = T.HAVEN_HOUSES.find((b) => b.id === 'inn');
  assert.ok(Math.abs(T.heightAt(I0.x, I0.z) - T.HAVEN_APRON.h) < 0.05);
  assert.ok(Math.abs(inn.x - (T.HAVEN_QUAY.x0 + T.HAVEN_QUAY.x1) / 2) < 3, 'straight up from the quay');
  const A = T.HAVEN_APRON;
  assert.ok(market.x > A.x0 && market.x < A.x1 && market.z > A.z0 && market.z < A.z1, 'on the apron');
  // Nothing stands in either doorway (or on the spot where you stand to deal with Mags).
  for (const s of [inn, market]) {
    for (const o of coast.obstacles) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) > o.r + 0.3, `${o.name} in the way of ${s.name}`);
  }
  // The other places to stop on the apron are far enough apart not to be confused.
  const others = coast.spots.filter((s) => s !== inn && s !== market && Math.hypot(s.x - inn.x, s.z - inn.z) < 40);
  for (const o of others) for (const s of [inn, market]) assert.ok(Math.hypot(o.x - s.x, o.z - s.z) > o.r + s.r - 0.5, `${o.name} too near ${s.name}`);
  // Its slate, chalked up by the game.
  assert.equal(typeof coast.paintSlate, 'function');
});

test('the sheet: selling at the market fills your purse; the kitchen pays for its order; a pint buys a story', () => {
  const state = { day: 4, hour: 10, money: 20, keep: [], harbour: null, fish: {} };
  const log = [], eaten = [], dishes = [];
  const sheet = new HarbourSheet(state, {
    toast: (t) => log.push(t), chime() {}, changed() {}, close: () => sheet.close(),
    now: () => state.day * 24 + state.hour, sold: (id) => log.push(`sold ${id}`),
    eatMeal: (m) => eaten.push(m), eatDish: (t) => dishes.push(t), drink() {}, openRoom() {},
    talk: (place) => ({ advice: { place, hour: state.hour, wind: 5, storm: 0, rain: 0, about: [], caught: new Set() }, rumours: { place, hour: state.hour } }),
  });
  // The day's first order at The Lobster Pot, and a fish that fills it.
  const order = M.ordersFor(state.day)[0];
  const sp = fishById[order.id];
  state.keep.push({ id: order.id, size: Math.min(sp.size[1], order.min + 2), logId: 'a', at: 90 });
  state.keep.push({ id: 'mackerel', size: 32, logId: 'b', at: 95 });
  state.keep.push({ id: 'carp', size: 50, logId: 'c', at: 95 });
  // At the market: the mackerel sells, the carp doesn't (no buyer), the order's fish is flagged.
  sheet.open('market');
  assert.ok(text('hb-body').includes('wants this one'));
  // (One Sell button for each fish Mags buys: the order's fish, then the mackerel.)
  const sellMack = buttons('hb-body').filter((b) => b.textContent.startsWith('Sell:'))[1];
  const price = M.fishValue(state.keep[1], { day: state.day, now: state.day * 24 + state.hour }).price;
  sellMack.click();
  assert.equal(state.money, Math.round((20 + price) * 100) / 100);
  assert.deepEqual(state.keep.map((f) => f.id), [order.id, 'carp']);
  assert.ok(log.includes('sold b'));
  assert.equal(state.harbour.sold, 1);
  sheet.close();
  // At the inn's kitchen: the order filled, and paid.
  sheet.open('inn');
  buttons('hb-tabs').find((b) => b.textContent === 'The kitchen').click();
  const before = state.money;
  buttons('hb-body').find((b) => b.textContent.startsWith('Bring your')).click();
  assert.equal(state.money, Math.round((before + order.reward) * 100) / 100);
  assert.deepEqual(state.harbour.filled, [order.key]);
  assert.ok(text('hb-body').includes('Done ✓'));
  // The plate of the day, and a fish of yours cooked for you.
  const m0 = state.money;
  buttons('hb-body').find((b) => b.textContent === 'Order it').click();
  assert.equal(dishes.length, 1);
  assert.equal(state.money, Math.round((m0 - PLATE) * 100) / 100);
  // At the bar: a pint and a story, heard and remembered; and nothing you can't pay for.
  buttons('hb-tabs').find((b) => b.textContent === 'The bar').click();
  const m1 = state.money;
  buttons('hb-body').find((b) => b.textContent === 'Buy one').click();
  assert.equal(state.money, Math.round((m1 - PINT) * 100) / 100);
  assert.deepEqual(state.harbour.heard.haven, [I.STORIES.haven[0].id]);
  assert.ok(text('hb-body').includes(I.STORIES.haven[0].text.slice(0, 30)));
  state.money = 1;
  buttons('hb-body').find((b) => b.textContent === 'Another').click();
  assert.equal(state.money, 1);
  assert.equal(state.harbour.heard.haven.length, 1);
  // After hours the market is shut: nothing sells.
  sheet.close();
  state.hour = 21;
  state.keep.push({ id: 'mackerel', size: 32, logId: 'd', at: 95 });
  sheet.open('market');
  assert.ok(text('hb-body').includes('shut'));
  assert.ok(buttons('hb-body').filter((b) => b.textContent.startsWith('Sell')).every((b) => b.disabled));
});
