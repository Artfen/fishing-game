import { fishById } from './fish.js';
import { formatClock } from './world/sky.js';
import { MARKET_HOURS, ORDERS_BY, demandFor, fishValue, ordersFor, fills, money, receiptLine, seasonWord, standingOf, orderPay, worthGoingAfter, STANDING } from './market.js';
import { setupsFor } from './guide.js';
import { RODS, TACKLE } from './tackle.js';
import { nextStory, adviceFor, rumoursNow, lower, an } from './innTalk.js';
import { CHALLENGES } from './daybook.js';
import { pay as payOut, earn as earnIn } from './economy.js';
import { PRICES, hirePrice, PAINTS, PAINT_PRICE, NAME_PRICE, NAME_MAX, FITS, FIT_CATS, fitsFor, fitEffect, owns, hiredToday } from './shipyard.js';
import { CREELS, ICE, BAIT, creelOf, newShop, onIce, freshBaitToday, wearOf, wearWords, respoolPrice, creelGroups, groupWords, creelWords, kgWords } from './shop.js';

// The harbour's sheet: the fish market on Willowhaven quay (Mags Pennock at her slab), The Lobster
// Pot (Ruth Alder behind the bar, and her kitchen), Bar El Muelle at Puerto Brasa (Paco: his bar,
// his kitchen, the fish he buys from the boats, and your room upstairs), and the chandlery's
// counter (Old Bert Hale: creels, ice, fresh bait, fresh line, and getting ready for a trip).
//
// hooks: { toast(text, secs), chime(), changed(), close(), now() (game hours), sold(logId),
// eatMeal({ id, size, logId }), eatDish(text, fill), drink(), openRoom(), talk(place) → { advice,
// rumours } (the contexts innTalk.js wants), openStore() (the free tackle store), rods() → [{ id,
// name, line }] (the rods to look over), trip() → [{ ok, text, act?: { label, run } }] (the
// checklist for a trip) }.

const $ = (id) => document.getElementById(id);
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

export const PINT = 4;       // a pint at the bar (a caña at Paco's), and a story with it
export const PLATE = 9;      // the plate of the day
export const COOK_YOURS = 3; // the kitchen cooking a fish of yours for you
const PLATES = {
  haven: { name: 'fish pie', text: 'Ruth’s fish pie: smoked haddock and prawns under a crust of mash, browned on top. You eat every crumb.', fill: 55 },
  muelle: { name: 'sancocho', text: 'Paco’s sancocho: salted fish and sweet potato, with papas arrugadas and green mojo. Just right.', fill: 55 },
};
const HOST = { haven: 'Ruth', muelle: 'Paco' };
const OLD = (fresh) => (fresh >= 0.99 ? 'fresh' : fresh > 0.8 ? 'a day old' : 'getting on');

export class HarbourSheet {
  constructor(state, hooks) {
    this.state = state;
    this.hooks = hooks;
    this.el = $('harbour');
    this.where = null;  // 'market' | 'inn' | 'muelle'
    this.tab = 'sell';
    this.said = { advice: null, story: null };
    this.receipt = null; // the last sale's receipt: { lines, total }, shown until you leave
    $('hb-close').addEventListener('click', () => hooks.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) hooks.close(); });
  }

  get isOpen() { return !this.el.hidden; }
  get place() { return this.where === 'muelle' ? 'muelle' : 'haven'; }
  get harbour() {
    this.state.harbour ??= { heard: { haven: [], muelle: [] }, filled: [], earned: 0, sold: 0, served: 0 };
    return this.state.harbour;
  }
  // The hour everyone sees (the host's, playing together; your own otherwise): the market, the
  // kitchen and the townsfolk keep it, so Mags at her slab in daylight is open for you too.
  get hour() { return this.hooks.worldHour?.() ?? this.state.hour; }
  get marketOpen() {
    if (this.where === 'muelle') return true;
    return this.hour >= MARKET_HOURS[0] && this.hour < MARKET_HOURS[1];
  }

  // (tab: which to open at, if not the first: 'kitchen' from the pass, 'ready' and so on.)
  open(where, tab = null) {
    this.where = where;
    this.said = { advice: null, story: null };
    this.receipt = null;
    this.tab = tab || (where === 'market' ? 'sell' : where === 'chandlery' ? 'counter' : where === 'works' ? 'boats' : 'bar');
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.el.hidden = true;
    this.hooks.previewStop?.();
  }

  // The look at a boat (see boatPreview.js): a canvas the preview draws on, drag to turn her.
  // try: a paint to try on her (hex), without buying it.
  previewBlock(kind, tryPaint = null) {
    const Y = this.state.yard, L = Y.looks[kind] || {};
    const c = el('canvas', 'hb-preview');
    c.id = 'hb-preview';
    c.width = 1040;
    c.height = 400;
    c.setAttribute('aria-label', `The ${this.hooks.boatName(kind)}, turning slowly: drag to turn her`);
    let x = null;
    c.addEventListener('pointerdown', (e) => { x = e.clientX; c.setPointerCapture?.(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (x != null) { this.hooks.previewTurn?.(e.clientX - x); x = e.clientX; } });
    c.addEventListener('pointerup', () => { x = null; });
    this.showPreview(kind, tryPaint);
    return c;
  }

  showPreview(kind, tryPaint = null) {
    const Y = this.state.yard, L = Y.looks[kind] || {};
    const paint = tryPaint || (L.paint ? PAINTS.find((p) => p.id === L.paint)?.hex : null);
    this.hooks.preview?.({ kind, paint, name: L.name || '', fits: Y.fits[kind] || [] });
  }

  button(text, run, cls = '') {
    const b = el('button', `pk-btn ${cls}`.trim(), text);
    b.type = 'button';
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      if (b.isConnected && this.isOpen) run();
    });
    return b;
  }

  // A favour (see requests.js) the person here has for you: to ask, to hand over, to hear about.
  favourBlock(who) {
    const f = this.hooks.favour?.(who);
    if (!f) return [];
    const box = el('div', 'hb-favour');
    box.append(el('p', 'hb-story', f.text));
    const row = el('div', 'cp-row cp-acts');
    for (const a of f.acts) {
      row.append(this.button(a.text, () => {
        a.run();
        this.render();
      }, a.cls || ''));
    }
    box.append(row);
    return [box];
  }

  // (Through the one purse: see economy.js.)
  pay(v, what = 'At the harbour') {
    if (!payOut(this.state, v, what).ok) {
      this.hooks.toast(`That’s ${money(v)}, and you’ve only ${money(this.state.money)} in your purse. Sell a fish or two at the market first.`, 5);
      return false;
    }
    return true;
  }
  earn(v, what = 'At the harbour') {
    earnIn(this.state, v, what);
    this.harbour.earned = Math.round((this.harbour.earned + v) * 100) / 100;
  }

  render() {
    if (!this.isOpen) return;
    const W = this.where;
    $('hb-title').textContent = W === 'market' ? 'The fish market' : W === 'inn' ? 'The Lobster Pot' : W === 'chandlery' ? 'The chandlery' : W === 'works' ? 'Willowhaven Marine Works' : 'Bar El Muelle';
    $('hb-sub').textContent = `${formatClock(this.hour)} · day ${this.state.day} · ${W === 'muelle' ? 'Puerto Brasa' : 'Willowhaven'}`;
    $('hb-purse').textContent = `In your purse: ${money(this.state.money)}`;
    const tabs = W === 'market' ? [] : W === 'inn' ? [['bar', 'The bar'], ['kitchen', 'The kitchen']] : W === 'chandlery' ? [['counter', 'The counter'], ['mend', 'Mending'], ['ready', 'Ready for a trip']] : W === 'works' ? [['boats', 'Boats'], ['looks', 'Paint & name'], ['fit', 'Fit-out']] : [['bar', 'The bar'], ['kitchen', 'The kitchen'], ['sell', 'Sell to Paco']];
    $('hb-tabs').replaceChildren(...tabs.map(([id, text]) => {
      const b = el('button', id === this.tab ? 'on' : '', text);
      b.type = 'button';
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      return b;
    }), ...(W === 'muelle' ? [this.button('Your room upstairs', () => this.hooks.openRoom(), 'quiet hb-room')] : W === 'chandlery' ? [this.button('The tackle store (free)', () => this.hooks.openStore(), 'quiet hb-room')] : []));
    $('hb-tabs').hidden = !tabs.length;
    const body = this.tab === 'boats' ? this.renderBoats() : this.tab === 'looks' ? this.renderLooks() : this.tab === 'fit' ? this.renderFit() : this.tab === 'sell' ? this.renderSell() : this.tab === 'kitchen' ? this.renderKitchen() : this.tab === 'counter' ? this.renderCounter() : this.tab === 'mend' ? this.renderMend() : this.tab === 'ready' ? this.renderReady() : this.renderBar();
    $('hb-body').replaceChildren(...body);
  }

  /* ---- Willowhaven Marine Works (see shipyard.js) ---- */

  // Every boat: yours, on hire today, or for sale (and for hire by the day).
  renderBoats() {
    const out = [], Y = this.state.yard, day = this.state.day, H = this.hooks;
    out.push(el('p', 'hb-say', 'Jory Tregear wipes his hands on a rag among the cradles and the smell of resin. “Buying, hiring, or come to look? A day’s hire is a fair way to find out if she suits you.”'));
    const kinds = H.yardKinds();
    this.viewKind = kinds.includes(this.viewKind) ? this.viewKind : kinds.find((k) => !owns(Y, k)) || kinds[0];
    out.push(this.previewBlock(this.viewKind));
    for (const kind of kinds) {
      const row = el('div', `cp-row${kind === this.viewKind ? ' hb-viewing' : ''}`);
      const name = H.boatName(kind);
      row.append(this.button('Look', () => { this.viewKind = kind; this.render(); }, kind === this.viewKind ? '' : 'quiet'));
      if (owns(Y, kind)) {
        row.append(el('p', '', `The ${name}`), el('span', 'cp-soft', 'yours'));
      } else if (hiredToday(Y, kind, day, this.state.day * 24 + this.state.hour)) {
        const until = Y.hired.until;
        row.append(el('p', '', `The ${name}`), el('span', 'cp-soft', Number.isFinite(until) ? `on hire to you until ${formatClock(until % 24)} ${Math.floor(until / 24) > day ? 'tomorrow' : 'today'}` : 'on hire to you today (back at the yard tomorrow)'));
        row.append(this.button(`Buy her: ${money(PRICES[kind])}`, () => H.yardBuy(kind)));
      } else {
        row.append(el('p', '', `The ${name}`), el('span', 'cp-soft', `${money(PRICES[kind])} · or ${money(hirePrice(kind))} for a day`));
        row.append(this.button(`Hire: ${money(hirePrice(kind))}`, () => H.yardHire(kind), 'quiet'), this.button(`Buy: ${money(PRICES[kind])}`, () => H.yardBuy(kind)));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', 'A boat you buy is yours for good; one you hire is put in the water for you and goes back to the yard a day (24 hours) later. Money buys range, speed and good looks here: never a better bite.'));
    return out;
  }

  // Paint and a name, on your own boats.
  renderLooks() {
    const out = [], Y = this.state.yard, H = this.hooks;
    const mine = H.yardKinds().filter((k) => owns(Y, k));
    this.lookKind = mine.includes(this.lookKind) ? this.lookKind : mine[0];
    const k = this.lookKind;
    out.push(el('p', 'hb-say', `Morwenna in the paint shed, a brush behind her ear: “Your colours, and her name on the bow in proper sign-writer’s letters. ${money(PAINT_PRICE)} a coat, ${money(NAME_PRICE)} for the name.”`));
    const pick = el('div', 'hb-picks');
    for (const kind of mine) pick.append(this.button(`The ${H.boatName(kind)}`, () => { this.lookKind = kind; this.render(); }, kind === k ? '' : 'quiet'));
    out.push(pick);
    if (!k) return out;
    const L = Y.looks[k] || {};
    out.push(this.previewBlock(k));
    out.push(el('h3', '', `The ${H.boatName(k)}: ${L.paint ? PAINTS.find((p) => p.id === L.paint).name.toLowerCase() : 'as she came'}${L.name ? `, “${L.name}”` : ''}`));
    const chart = el('div', 'hb-paints');
    for (const p of PAINTS) {
      const b = this.button(p.name, () => H.yardPaint(k, p.id), L.paint === p.id ? '' : 'quiet');
      b.classList.add('hb-swatch');
      b.style.setProperty('--sw', p.hex);
      // (Point at a colour to see it on her first.)
      b.addEventListener('pointerenter', () => this.showPreview(k, p.hex));
      b.addEventListener('focus', () => this.showPreview(k, p.hex));
      b.addEventListener('pointerleave', () => this.showPreview(k));
      b.addEventListener('blur', () => this.showPreview(k));
      chart.append(b);
    }
    out.push(chart);
    const row = el('div', 'cp-row');
    const input = el('input', 'hb-name');
    input.type = 'text';
    input.maxLength = NAME_MAX;
    input.placeholder = 'Her name';
    input.value = L.name || '';
    input.addEventListener('keydown', (e) => e.stopPropagation());
    row.append(input, this.button(`Sign-write it: ${money(NAME_PRICE)}`, () => H.yardName(k, input.value)));
    out.push(row);
    return out;
  }

  // Fitting her out (see shipyard.js): one boat at a time, her fittings by kind, each with what it
  // weighs and draws, and a look at her with them on.
  renderFit() {
    const out = [], Y = this.state.yard, H = this.hooks;
    out.push(el('p', 'hb-say', 'In the workshop, an outboard hangs on a stand with its cowling off. “What’ll it be: range, speed, electronics, something for the deck? Fitted while you wait.”'));
    const mine = H.yardKinds().filter((k) => owns(Y, k) && fitsFor(k, Y.fits[k] || []).length);
    if (!mine.length) {
      out.push(el('p', 'cp-soft', 'None of your boats takes a fitting from the workshop: the motorboats do (the skiff, the bass boat, the cabin boat, the centre console, the RIB, the yacht, the jet ski), and the sailing boat a few.'));
      return out;
    }
    this.fitKind = mine.includes(this.fitKind) ? this.fitKind : mine[0];
    const k = this.fitKind;
    const pick = el('div', 'hb-picks');
    for (const kind of mine) pick.append(this.button(`The ${H.boatName(kind)}`, () => { this.fitKind = kind; this.render(); }, kind === k ? '' : 'quiet'));
    out.push(pick, this.previewBlock(k));
    const e = fitEffect(Y, k), have = Y.fits[k] || [];
    out.push(el('p', 'hb-fit-sum', have.length
      ? `Fitted: ${have.length} · carrying ${e.kg} kg more · drawing up to ${e.amps.toFixed(1)} A${e.house ? ' (on her house battery)' : ''}`
      : 'As she came from the builder: nothing fitted yet.'));
    for (const [cat, catName] of Object.entries(FIT_CATS)) {
      const ids = fitsFor(k, Y.fits[k] || []).filter((id) => FITS[id].cat === cat);
      if (!ids.length) continue;
      out.push(el('h4', 'hb-fit-cat', catName));
      for (const id of ids) {
        const F = FITS[id], fitted = have.includes(id);
        const slotted = !fitted && F.slot ? have.find((x) => FITS[x].slot === F.slot) : null;
        const row = el('div', `cp-row hb-fit${fitted ? ' on' : ''}`);
        const text = el('div', 'hb-fit-text');
        text.append(el('p', '', F.name), el('span', 'cp-soft', F.desc), el('span', 'hb-fit-meta', [F.kg ? `${F.kg} kg` : 'no weight to speak of', F.amps ? `draws ${F.amps} A` : null].filter(Boolean).join(' · ')));
        row.append(text);
        if (fitted) row.append(el('span', 'cp-soft', 'fitted'), this.button('Take it off', () => H.yardUnfit(k, id), 'quiet'));
        else row.append(this.button(`${slotted ? `Swap for this` : 'Fit it'}: ${money(F.price[k])}`, () => H.yardFit(k, id)));
        out.push(row);
      }
    }
    out.push(el('p', 'cp-soft', 'Everything here weighs something (she sits a touch lower and goes a touch slower for it) and the electronics and lights draw on her battery while the engine’s off. Nothing here does a thing for the fish’s appetite.'));
    return out;
  }


  /* ---- the market (and Paco buying from the boats) ---- */

  renderSell() {
    const out = [];
    const place = this.place, day = this.state.day, now = this.hooks.now();
    const D = demandFor(day, place);
    const names = (ids) => ids.map((id) => fishById[id].name).join(', ');
    if (place === 'haven') {
      out.push(el('p', 'hb-say', this.marketOpen
        ? 'Mags Pennock, behind her slab in a blue apron, sleeves rolled: “What have you brought me, then?”'
        : `The market’s shut: the slab scrubbed, the boxes stacked. Mags opens at ${formatClock(MARKET_HOURS[0])} and packs up at ${formatClock(MARKET_HOURS[1])}.`));
    } else {
      out.push(el('p', 'hb-say', 'Paco buys fish for his kitchen from the boats, and sells what he can’t cook on to the restaurants up the hill. “¡A ver! Let me see.”'));
    }
    if (place === 'haven' && this.marketOpen) out.push(...this.favourBlock('mags'));
    if (this.receipt) out.push(this.renderReceipt());
    const slate = el('div', 'hb-slate');
    slate.append(el('h3', '', place === 'haven' ? 'On the slate today' : 'Paco wants today'));
    slate.append(el('p', '', `Wanted: ${names(D.wanted)} (half as much again)`));
    slate.append(el('p', '', `Plenty of: ${names(D.plenty)} (a bit less)`));
    out.push(slate);
    out.push(el('h3', '', `Your creel (${this.state.keep.length} fish, ${creelWords(this.state)})`));
    const orders = ordersFor(day, place).filter((o) => !this.harbour.filled.includes(o.key));
    let any = 0, total = 0;
    // (Kind by kind: thirty mackerel are one line, sold together.)
    for (const g of creelGroups(this.state.keep)) {
      const sp = fishById[g.id];
      const row = el('div', 'cp-row');
      const vs = g.idx.map((i) => fishValue(this.state.keep[i], { day, now, place }));
      const v = vs[0];
      if (g.cooked) {
        row.append(el('p', '', groupWords(sp.meal.name, g)), el('span', 'cp-soft', 'cooked: for eating, not for the slab'));
      } else if (!v.wanted) {
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', place === 'haven' ? 'nobody here buys it' : 'Paco doesn’t take it'));
      } else {
        const sum = vs.reduce((s, x) => s + x.price, 0), fresh = Math.min(...vs.map((x) => x.fresh));
        const prime = vs.some((x) => x.prime);
        const tags = [kgWords(g.kg), OLD(fresh), v.demand === 'wanted' ? 'wanted today' : v.demand === 'plenty' ? 'plenty about' : '', seasonWord(v.season), prime ? (g.n > 1 ? 'prime ones among them' : 'a prime fish') : ''].filter(Boolean).join(' · ');
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', tags));
        const order = orders.find((o) => o.id === g.id && g.max >= o.min);
        if (order) row.append(el('span', 'cp-soft hb-hint', `${place === 'haven' ? 'Ruth at The Lobster Pot' : 'Paco’s kitchen'} wants ${g.n > 1 ? 'one of these' : 'this one'}: ${money(order.reward)}`));
        const b = this.button(g.n > 1 ? `Sell all ${g.n}: ${money(sum)}` : `Sell: ${money(sum)}`, () => (g.n > 1 ? this.sellKind(g.id) : this.sell(g.first)));
        b.disabled = !this.marketOpen;
        row.append(b);
        any += g.n;
        total += sum;
      }
      out.push(row);
    }
    if (!this.state.keep.length) out.push(el('p', 'cp-soft', 'Nothing in your creel. Fish you keep (K, or Keep on the catch card) can be sold here, cooked at camp, or taken to the inn’s kitchen.'));
    if (any > 1 && this.marketOpen) {
      const row = el('div', 'cp-row cp-acts');
      row.append(this.button(`Sell all ${any}: ${money(total)}`, () => this.sellAll()));
      out.push(row);
    }
    out.push(el('p', 'cp-soft', 'Fish fetch their best fresh: within half a day of the catch. After that the price slips, a little more each day. A camp’s cool box keeps them on ice. The seasons move prices too: plenty in season fetches a little less, a scarce fish out of season a little more, and a prime fish of its kind more by the kilo.'));
    return out;
  }

  // The last sale, line by line: what, how heavy, the price by the kilo and why, and the total.
  renderReceipt() {
    const R = this.receipt, box = el('div', 'hb-receipt');
    box.append(el('h3', '', `${this.place === 'haven' ? 'Mags’s' : 'Paco’s'} receipt`));
    for (const L of R.lines) {
      const row = el('div', 'hb-rline');
      row.append(el('span', '', `${L.name}, ${L.size} cm · ${kgWords(L.kg)} at ${money(L.each)}/kg${L.why.length ? ` (${L.why.join(', ')})` : ''}`), el('strong', '', money(L.price)));
      box.append(row);
    }
    const tot = el('div', 'hb-rline hb-rtotal');
    tot.append(el('span', '', `${R.lines.length} fish`), el('strong', '', money(R.total)));
    box.append(tot);
    return box;
  }

  sell(i, quiet = false) {
    const f = this.state.keep[i];
    if (!f || f.cooked || !this.marketOpen) return 0;
    const v = fishValue(f, { day: this.state.day, now: this.hooks.now(), place: this.place });
    if (!v.wanted) return 0;
    this.state.keep.splice(i, 1);
    // (Onto the receipt: a fresh one for each sale, unless it's one of several in one go.)
    if (!quiet || !this.receipt?.open) this.receipt = { lines: [], total: 0, open: quiet };
    this.receipt.lines.push(receiptLine(f, v));
    this.receipt.total = Math.round((this.receipt.total + v.price) * 100) / 100;
    this.earn(v.price);
    this.harbour.sold++;
    this.hooks.sold(f.logId);
    if (!quiet) {
      const sp = fishById[f.id];
      this.hooks.chime();
      this.hooks.toast(`${this.place === 'haven' ? 'Mags' : 'Paco'} weighs the ${lower(sp.name)}: ${v.kg.toFixed(v.kg < 1 ? 2 : 1)} kg. ${money(v.price)} into your purse.`, 4);
      this.hooks.changed();
      this.render();
    }
    return v.price;
  }

  // Every one of a kind (raw), in one go.
  sellKind(id) {
    let n = 0, sum = 0;
    for (let i = this.state.keep.length - 1; i >= 0; i--) {
      if (this.state.keep[i].id !== id || this.state.keep[i].cooked) continue;
      const p = this.sell(i, true);
      if (p > 0) {
        n++;
        sum += p;
      }
    }
    if (this.receipt) this.receipt.open = false;
    if (!n) return;
    this.hooks.chime();
    this.hooks.toast(`${this.place === 'haven' ? 'Mags' : 'Paco'} weighs them up: ${n} ${lower(fishById[id].name)}, ${money(sum)} into your purse.`, 4);
    this.hooks.changed();
    this.render();
  }

  sellAll() {
    let n = 0, sum = 0;
    for (let i = this.state.keep.length - 1; i >= 0; i--) {
      const p = this.sell(i, true);
      if (p > 0) {
        n++;
        sum += p;
      }
    }
    if (this.receipt) this.receipt.open = false;
    if (!n) return;
    this.hooks.chime();
    this.hooks.toast(`${n} fish weighed and paid for: ${money(sum)} into your purse.`, 4);
    this.hooks.changed();
    this.render();
  }

  /* ---- the kitchen: the day's orders, a fish of yours cooked, the plate of the day ---- */

  renderKitchen() {
    const out = [];
    const place = this.place, host = HOST[place];
    const early = this.hour < 6, late = this.hour >= ORDERS_BY;
    out.push(el('p', 'hb-say', place === 'haven'
      ? 'Ruth Alder runs the kitchen as well as the bar. She buys her fish from whoever brings in the best of it, and she pays well for what she’s after.'
      : 'Paco’s mother cooks, in a kitchen the size of a cupboard. What goes on the menu depends on what the boats bring in.'));
    // How well the kitchen knows you (orders filled), and what that's worth.
    const st = standingOf(this.harbour.served);
    out.push(el('p', 'cp-soft hb-standing', st.tier
      ? `${host} counts you ${st.name}: ${Math.round(st.bonus * 100)}% over the order’s price${st.next != null ? ` (${st.next - this.harbour.served} more ${st.next - this.harbour.served === 1 ? 'order' : 'orders'} and you’re ${STANDING[st.tier + 1].name})` : ', and your name goes on the board with the dish'}.`
      : `${host} doesn’t know you yet. Bring good fish for her orders and she will (${st.next - this.harbour.served} more and you’re a regular supplier). A fine fish, well over the size asked, earns a quarter more.`));
    out.push(el('h3', '', `${host}’s orders for tonight`));
    for (const o of ordersFor(this.state.day, place)) {
      const sp = fishById[o.id];
      const row = el('div', 'cp-row');
      const a = an(lower(sp.name));
      const want = `${a[0].toUpperCase()}${a.slice(1)}${o.min > sp.size[0] ? `, ${o.min} cm or more` : ''}`;
      row.append(el('p', '', want), el('span', 'cp-soft', `${money(o.reward)} · by ${formatClock(o.by)}`));
      if (this.harbour.filled.includes(o.key)) row.append(el('span', 'hb-done', 'Done ✓'));
      else if (late || early) row.append(el('span', 'cp-soft', early ? 'the kitchen opens at six' : 'too late tonight'));
      else {
        const i = fills(this.state.keep, o);
        if (i >= 0) {
          const P = orderPay(o, this.state.keep[i], this.harbour.served);
          row.append(this.button(`Bring your ${this.state.keep[i].size} cm one: ${money(P.pay)}${P.fine ? ' (a fine one)' : ''}`, () => this.fill(o)));
        }
        else row.append(el('span', 'cp-soft', 'none in your creel'));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', `New orders every morning. ${place === 'haven' ? 'The board on the quay says what’s about, and where.' : 'Ask Paco at the bar where they’re biting.'}`));
    out.push(el('h3', '', 'Something to eat'));
    const P = PLATES[place];
    const plate = el('div', 'cp-row');
    plate.append(el('p', '', `The plate of the day: ${P.name}`), el('span', 'cp-soft', money(PLATE)), this.button('Order it', () => {
      if (!this.pay(PLATE)) return;
      this.hooks.eatDish(P.text, P.fill);
      this.hooks.changed();
      this.render();
    }));
    out.push(plate);
    const raw = creelGroups(this.state.keep).filter((g) => !g.cooked);
    if (raw.length) {
      out.push(el('p', 'cp-soft', `Or ${host} will cook one of yours for ${money(COOK_YOURS)}:`));
      for (const g of raw) {
        const sp = fishById[g.id], i = g.first, f = this.state.keep[i];
        const row = el('div', 'cp-row');
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', sp.meal.name), this.button(g.n > 1 ? 'Cook one for me' : 'Cook it for me', () => {
          if (this.state.keep[i] !== f || !this.pay(COOK_YOURS)) return;
          this.state.keep.splice(i, 1);
          this.hooks.eatMeal({ id: f.id, size: f.size, logId: f.logId || null });
          this.hooks.changed();
          this.render();
        }, 'quiet'));
        out.push(row);
      }
    }
    return out;
  }

  fill(o) {
    const i = fills(this.state.keep, o);
    if (i < 0 || this.harbour.filled.includes(o.key)) return;
    const f = this.state.keep[i];
    const P = orderPay(o, f, this.harbour.served);
    this.state.keep.splice(i, 1);
    this.harbour.filled.push(o.key);
    if (this.harbour.filled.length > 24) this.harbour.filled.splice(0, this.harbour.filled.length - 24);
    const was = standingOf(this.harbour.served);
    this.harbour.served++;
    const now = standingOf(this.harbour.served);
    this.earn(P.pay);
    this.hooks.sold(f.logId);
    this.hooks.chime();
    const sp = fishById[f.id], name = this.hooks.playerName?.() || '';
    // (The kitchen's own supplier gets their name on the board with the dish.)
    const board = now.tier >= 2 && name ? ` On the board tonight: “${name}’s ${lower(sp.meal?.name || sp.name)}”.` : ' It’s on the board tonight.';
    const fine = P.fine ? ' A fine one, and paid for it.' : '';
    const up = now.tier > was.tier ? ` ${this.place === 'haven' ? 'Ruth' : 'Paco'} counts you ${now.name} now.` : '';
    this.hooks.toast(this.place === 'haven'
      ? `Ruth holds up the ${lower(sp.name)} to the light. “Now that’s a fish.” ${money(P.pay)} into your purse.${fine}${board}${up}`
      : `Paco shouts into the kitchen, and his mother comes out to see the ${lower(sp.name)}. ${money(P.pay)} into your purse.${fine}${up}`, 7);
    this.hooks.changed();
    this.render();
  }

  // Bert's word on the fish worth going after today: one the market wants or the kitchen has
  // ordered, in its season now, where it lives, and how he'd rig for it (the field guide's way).
  worthTip() {
    const W = worthGoingAfter(this.state.day, this.hooks.now(), 'haven');
    if (!W) return null;
    const sp = fishById[W.id], s = setupsFor(sp)[0];
    const who = W.why === 'order' ? 'Ruth’s after one for her kitchen tonight' : 'Mags wants them on the slab today';
    const season = W.boost >= 1.1 ? 'and they’re well in just now' : W.boost >= 0.9 ? 'and they’re about' : 'though they’re thin on the ground this time of year';
    const rig = s ? ` I’d put ${an(lower(TACKLE[s.item].name))} on the ${lower(RODS[s.rod].name)}.` : '';
    return `${an(lower(sp.name)).replace(/^./, (c) => c.toUpperCase())}: ${who}, ${season}. ${sp.where}.${rig}`;
  }

  /* ---- the bar: a pint and a story, advice, and what's being said ---- */

  renderBar() {
    const out = [];
    const place = this.place, host = HOST[place];
    const talk = this.hooks.talk(place);
    out.push(el('p', 'hb-say', place === 'haven'
      ? 'Low beams, a coal fire, a stuffed bass in a glass case over the bar. Ruth Alder is drying glasses. A couple of the old boys are in their corner by the window, watching the quay.'
      : 'Plastic chairs out on the quay, a television with the football on, a fan turning slowly. Paco leans on the bar, a cloth over his shoulder.'));
    out.push(...this.favourBlock(place === 'haven' ? 'ruth' : 'paco'));
    // A pint, and a story with it.
    const pint = el('div', 'cp-row');
    pint.append(el('p', '', place === 'haven' ? 'A pint of Ruth’s best bitter, and a story with it' : 'A caña, a little cold beer, and a story with it'), el('span', 'cp-soft', money(PINT)), this.button(this.said.story ? 'Another' : 'Buy one', () => {
      if (!this.pay(PINT)) return;
      const heard = this.harbour.heard[place];
      const s = nextStory(place, heard);
      if (!heard.includes(s.id)) heard.push(s.id);
      this.said.story = s;
      this.hooks.drink();
      this.hooks.changed();
      this.render();
    }));
    out.push(pint);
    if (this.said.story) out.push(el('blockquote', 'hb-story', `“${this.said.story.text}”`));
    // Advice (free: everyone has some).
    const adv = el('div', 'cp-row');
    adv.append(el('p', '', `Ask ${host} what’s biting`), this.button(this.said.advice ? 'Ask again' : 'Ask', () => {
      this.said.advice = adviceFor(talk.advice);
      this.render();
    }, 'quiet'));
    out.push(adv);
    if (this.said.advice) out.push(el('blockquote', 'hb-story', `“${this.said.advice}”`));
    // What's being said today.
    const lines = rumoursNow(talk.rumours).slice(0, 4);
    out.push(el('h3', '', 'What they’re saying'));
    if (lines.length) for (const l of lines) out.push(el('p', 'hb-rumour', l));
    else out.push(el('p', 'cp-soft', place === 'haven' ? 'A quiet day: the talk is of the weather, the price of diesel, and whose turn it is to buy.' : 'Nothing much: the football, the heat, a cousin’s wedding.'));
    const heard = this.harbour.heard[place].length;
    out.push(el('p', 'cp-soft', `Stories heard here: ${heard}.`));
    // The board by the door: the harbour's challenges (see daybook.js), and who's done what.
    if (place === 'haven') {
      out.push(el('h3', '', 'The board by the door'));
      out.push(el('p', 'cp-soft', 'Pinned up in Ruth’s hand: “Not a competition. Just something to go for.” A cloth badge for each, for your wall at home.'));
      for (const c of CHALLENGES) {
        const done = this.state.badges?.[c.id], p = c.check(this.state);
        const row = el('div', 'cp-row');
        row.append(el('p', '', c.name), el('span', 'cp-soft', `${c.text}${!done && p.of > 1 ? ` (${Math.min(p.n, p.of)} of ${p.of})` : ''}`));
        if (done) row.append(el('span', 'hb-done', 'done'));
        out.push(row);
      }
    }
    return out;
  }

  /* ---- the chandlery's counter: creels, ice, fresh bait; mending; ready for a trip ---- */

  get shop() {
    this.state.shop ??= newShop();
    return this.state.shop;
  }

  renderCounter() {
    const out = [];
    const S = this.shop, now = this.hooks.now();
    out.push(el('p', 'hb-say', 'Old Bert Hale, behind a counter worn smooth by sixty years of elbows, a pencil behind his ear: “Now then. The tackle’s through there, help yourself, same as always. Anything else?”'));
    out.push(...this.favourBlock('bert'));
    // Advice over the counter: Bert's read of the water today (the same as the bar's, from the
    // world as it is).
    const adv = el('div', 'cp-row');
    adv.append(el('p', '', 'Ask Bert what’s biting, and where'), this.button(this.said.advice ? 'Ask again' : 'Ask', () => {
      this.said.advice = adviceFor(this.hooks.talk('haven').advice);
      this.render();
    }, 'quiet'));
    out.push(adv);
    if (this.said.advice) out.push(el('blockquote', 'hb-story', `“${this.said.advice}”`));
    const tip = this.worthTip();
    if (tip) {
      out.push(el('h3', '', 'Worth going after today'));
      out.push(el('blockquote', 'hb-story', `“${tip}”`));
    }
    out.push(el('h3', '', 'Creels'));
    const mine = creelOf(this.state);
    const row0 = el('div', 'cp-row');
    row0.append(el('p', '', `${mine.name === CREELS[0].name ? 'Your creel' : mine.name}: holds ${mine.kg} kg of fish`), el('span', 'hb-done', 'yours'));
    out.push(row0);
    CREELS.forEach((c, i) => {
      if (i <= S.creel) return;
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${c.name}. ${c.note}`), el('span', 'cp-soft', money(c.price)), this.button('Buy it', () => {
        if (this.shop.creel >= i || !this.pay(c.price)) return;
        this.shop.creel = i;
        this.hooks.chime();
        this.hooks.toast(`${c.name}, over your shoulder: room for ${c.kg} kg of fish now${c.cool ? ', and they keep cool in it' : ''}. Your old creel goes on the hook behind the door.`, 6);
        this.hooks.changed();
        this.render();
      }));
      out.push(row);
    });
    out.push(el('h3', '', 'For the day'));
    const ice = el('div', 'cp-row');
    const iced = onIce(this.state, now), lots = S.iceUntil > now + 12;
    ice.append(el('p', '', 'A bag of ice for your creel: whatever you catch keeps fresh for the next day'), el('span', 'cp-soft', iced ? `on ice till ${formatClock(S.iceUntil % 24)}${S.iceUntil >= (this.state.day + 1) * 24 ? ' tomorrow' : ''}` : money(ICE.price)));
    const ib = this.button('Buy a bag', () => {
      if (this.shop.iceUntil > this.hooks.now() + 12 || !this.pay(ICE.price)) return;
      this.shop.iceUntil = this.hooks.now() + ICE.hours;
      this.hooks.toast('Bert shovels crushed ice into a bag and packs it into your creel. Your fish keep fresh for a day.', 5);
      this.hooks.changed();
      this.render();
    });
    ib.disabled = lots;
    if (lots) ib.title = 'Plenty of ice in your creel still';
    ice.append(ib);
    out.push(ice);
    const bait = el('div', 'cp-row');
    const today = freshBaitToday(this.state);
    bait.append(el('p', '', 'Fresh bait, dug and gathered this morning: ragworm, peeler crab and sandeel, lively and smelling of the sea. Fish find your natural baits from further off, all day.'), el('span', 'cp-soft', today ? 'you’ve some today' : money(BAIT.price)));
    const bb = this.button('Buy a tub', () => {
      if (freshBaitToday(this.state) || !this.pay(BAIT.price)) return;
      this.shop.baitDay = this.state.day;
      this.hooks.toast('A tub of fresh bait, wrapped in wet newspaper, goes in your bag. For the rest of today, your worms, crab, prawn and the like fish better.', 6);
      this.hooks.changed();
      this.render();
    });
    bb.disabled = today;
    bait.append(bb);
    out.push(bait);
    out.push(el('p', 'cp-soft', 'Everything here is a help, never a need: the tackle store is free, and a fish caught on the plainest worm counts the same.'));
    return out;
  }

  renderMend() {
    const out = [];
    out.push(el('p', 'hb-say', '“Let’s have a look at your lines, then.” Bert runs each one through his fingers, feeling for the rough bits.'));
    for (const r of this.hooks.rods()) {
      const w = wearOf(this.state, r.id);
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${r.name}: ${r.line.name}`), el('span', 'cp-soft', `${wearWords(w)}${w >= 0.25 ? ` (${Math.round(w * 20)}% weaker)` : ''}`));
      if (w > 0.05) {
        const price = respoolPrice(r.line);
        row.append(this.button(`Fresh line: ${money(price)}`, () => {
          if (!this.pay(price)) return;
          delete this.shop.wear[r.id];
          this.hooks.toast(`Bert strips off the old line and winds on new ${r.line.name}, humming. Good as new.`, 5);
          this.hooks.changed();
          this.render();
        }));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', 'Line wears in long, hard fights: a frayed line is a little weaker (never by more than a fifth). Fresh line puts it right.'));
    return out;
  }

  renderReady() {
    const out = [];
    out.push(el('p', 'hb-say', '“Going out, are you? Let’s see you’ve got what you need.”'));
    for (const c of this.hooks.trip()) {
      const row = el('div', 'cp-row');
      row.append(el('span', c.ok ? 'hb-done' : 'hb-warn', c.ok ? '✓' : '!'), el('p', '', c.text));
      if (c.act) row.append(this.button(c.act.label, () => {
        c.act.run();
        this.render();
      }, 'quiet'));
      out.push(row);
    }
    return out;
  }
}

// The market's slate in the world, chalked up each morning with what's wanted.
export function paintSlate(ctx, w, h, { day, wanted = [], plenty = [] } = {}) {
  ctx.fillStyle = '#2b2f2e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#6a503b';
  ctx.lineWidth = 14;
  ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(240,240,232,0.92)';
  ctx.textAlign = 'center';
  ctx.font = '700 34px Kalam, Caveat, cursive';
  ctx.fillText('Today', w / 2, 46);
  ctx.font = '600 22px Kalam, Caveat, cursive';
  ctx.fillText(`day ${day}`, w / 2, 72);
  ctx.textAlign = 'left';
  ctx.font = '700 24px Kalam, Caveat, cursive';
  ctx.fillText('Wanted:', 22, 112);
  ctx.font = '600 24px Kalam, Caveat, cursive';
  wanted.forEach((n, i) => ctx.fillText(`· ${n}`, 30, 142 + i * 30));
  ctx.font = '700 24px Kalam, Caveat, cursive';
  ctx.fillText('Plenty of:', 22, 222);
  ctx.font = '600 24px Kalam, Caveat, cursive';
  plenty.forEach((n, i) => ctx.fillText(`· ${n}`, 30, 252 + i * 30));
  ctx.font = '600 18px Kalam, Caveat, cursive';
  ctx.textAlign = 'center';
  ctx.fillText(`open ${MARKET_HOURS[0]} am till ${MARKET_HOURS[1] - 12} pm`, w / 2, h - 18);
}

// The kitchen's board inside The Lobster Pot, by the pass: what Ruth is after tonight, chalked up
// afresh each day, crossed off as it comes in.
export function paintKitchenBoard(ctx, w, h, { orders = [], closed = false } = {}) {
  ctx.fillStyle = '#2b2f2e';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = '#6a503b';
  ctx.lineWidth = 10;
  ctx.strokeRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(240,240,232,0.92)';
  ctx.textAlign = 'center';
  ctx.font = '700 26px Kalam, Caveat, cursive';
  ctx.fillText('Kitchen wants', w / 2, 36);
  ctx.textAlign = 'left';
  ctx.font = '600 20px Kalam, Caveat, cursive';
  orders.forEach((o, i) => {
    const y = 76 + i * 34, text = `· ${o.name}${o.min ? ` ${o.min}cm+` : ''}`;
    ctx.fillText(text, 16, y);
    if (o.done) {
      const tw = ctx.measureText(text).width;
      ctx.fillRect(14, y - 7, tw + 4, 2.5);
    }
  });
  ctx.textAlign = 'center';
  ctx.font = '600 16px Kalam, Caveat, cursive';
  ctx.fillText(closed ? 'kitchen closed' : `by ${ORDERS_BY - 12} pm · paid well`, w / 2, h - 16);
}
