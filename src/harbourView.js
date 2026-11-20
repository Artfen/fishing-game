import { fishById } from './fish.js';
import { formatClock } from './world/sky.js';
import { MARKET_HOURS, ORDERS_BY, demandFor, fishValue, ordersFor, fills, money, receiptLine, seasonWord, standingOf, orderPay, worthGoingAfter, STANDING, IMPORTS, IMPORT_K } from './market.js';
import { setupsFor } from './guide.js';
import { RODS, TACKLE } from './tackle.js';
import { nextStory, adviceFor, rumoursNow, lower, an } from './innTalk.js';
import { CHALLENGES } from './daybook.js';
import { pay as payOut, earn as earnIn } from './economy.js';
import { PRICES, hirePrice, PAINTS, PAINT_PRICE, NAME_PRICE, NAME_MAX, FITS, FIT_CATS, fitsFor, fitEffect, owns, hiredToday, SECOND, MOST_OF_A_KIND, ofKind, COMES_WITH } from './shipyard.js';
import { FLAGS, flagById, STRIPE_PRICE, TUBES_PRICE } from './papers.js';
import { MODELS as ENGINE_MODELS } from './engines.js';
import { CATALOGUE, MODELS, PROPS, hasCatalogue, KN, rangeAt, propName, fittedName, propsFor } from './engines.js';
import { TRIALS } from './engineTrials.js';
import { kindOf } from './boatid.js';
import { CARGO, SOLD as CARGO_SOLD, owned as cargoOwned } from './cargo.js';
import { CREELS, ICE, BAIT, creelOf, newShop, onIce, freshBaitToday, wearOf, wearWords, respoolPrice, creelGroups, groupWords, creelWords, kgWords } from './shop.js';
import { KAIGAN_HOURS, RAW_HOURS, kaiganValue, kaiganLine, specialsFor, gradeWords, DISHES } from './kaigan.js';
import { $t } from './i18n.js';

// The harbour's sheet: the fish market on Willowhaven quay (Mags Pennock at her slab), The Lobster
// Pot (Ruth Alder behind the bar, and her kitchen), Bar El Muelle at Puerto Brasa (Paco: his bar,
// his kitchen, the fish he buys from the boats, and your room upstairs), and the chandlery's
// counter (Old Bert Hale: creels, ice, fresh bait, fresh line, and getting ready for a trip), and
// Kaigan's kitchen door (Kenji Higa, buying fish fit for sushi, sashimi and ceviche: kaigan.js).
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
  haven: { name: $t('fish pie'), text: $t('Ruth’s fish pie: smoked haddock and prawns under a crust of mash, browned on top. You eat every crumb.'), fill: 55 },
  muelle: { name: 'sancocho', text: $t('Paco’s sancocho: salted fish and sweet potato, with papas arrugadas and green mojo. Just right.'), fill: 55 },
};
const HOST = { haven: $t('Ruth'), muelle: $t('Paco') };
const OLD = (fresh) => (fresh >= 0.99 ? 'fresh' : fresh > 0.8 ? $t('a day old') : $t('getting on'));

export class HarbourSheet {
  constructor(state, hooks) {
    this.state = state;
    this.hooks = hooks;
    this.el = $('harbour');
    this.where = null;  // 'market' | 'inn' | 'muelle' | 'chandlery' | 'works' | 'kaigan'
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
    if (this.where === 'kaigan') return this.hour >= KAIGAN_HOURS[0] && this.hour < KAIGAN_HOURS[1];
    return this.hour >= MARKET_HOURS[0] && this.hour < MARKET_HOURS[1];
  }

  // (tab: which to open at, if not the first: 'kitchen' from the pass, 'ready' and so on.)
  open(where, tab = null) {
    this.where = where;
    this.said = { advice: null, story: null };
    this.receipt = null;
    this.tab = tab || (where === 'market' ? 'sell' : where === 'kaigan' ? 'kaigan' : where === 'chandlery' ? 'counter' : where === 'works' ? 'boats' : 'bar');
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
    c.setAttribute('aria-label', $t`The ${this.hooks.boatName(kind)}, turning slowly: drag to turn her`);
    let x = null;
    c.addEventListener('pointerdown', (e) => { x = e.clientX; c.setPointerCapture?.(e.pointerId); });
    c.addEventListener('pointermove', (e) => { if (x != null) { this.hooks.previewTurn?.(e.clientX - x); x = e.clientX; } });
    c.addEventListener('pointerup', () => { x = null; });
    this.showPreview(kind, tryPaint);
    return c;
  }

  showPreview(kind, tryPaint = null, tryTrim = {}) {
    const Y = this.state.yard, L = Y.looks[kind] || {};
    const hex = (id) => (id ? PAINTS.find((p) => p.id === id)?.hex : null);
    const paint = tryPaint || hex(L.paint);
    this.hooks.preview?.({
      kind, paint, name: L.name || '', fits: Y.fits[kind] || [],
      stripe: tryTrim.stripe || hex(L.stripe), tubes: tryTrim.tubes || hex(L.tubes), flag: tryTrim.flag || flagById[L.flag] || null,
    });
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
  pay(v, what = $t('At the harbour')) {
    if (!payOut(this.state, v, what).ok) {
      this.hooks.toast($t`That’s ${money(v)}, and you’ve only ${money(this.state.money)} in your purse. Sell a fish or two at the market first.`, 5);
      return false;
    }
    return true;
  }
  // (kind: 'market' | 'kaigan' | 'kitchen', for friends paid the same playing together: see main.js.)
  earn(v, what = $t('At the harbour'), kind = 'market') {
    earnIn(this.state, v, what);
    this.hooks.shared?.(v, kind);
    this.harbour.earned = Math.round((this.harbour.earned + v) * 100) / 100;
  }

  render() {
    if (!this.isOpen) return;
    const W = this.where;
    $('hb-title').textContent = W === 'market' ? $t('The fish market') : W === 'kaigan' ? $t('Kaigan') : W === 'inn' ? $t('The Lobster Pot') : W === 'chandlery' ? $t('The chandlery') : W === 'works' ? $t('Willowhaven Marine Works') : $t('Bar El Muelle');
    $('hb-sub').textContent = $t`${formatClock(this.hour)} · day ${this.state.day} · ${W === 'muelle' ? $t('Puerto Brasa') : $t('Willowhaven')}`;
    $('hb-purse').textContent = $t`In your purse: ${money(this.state.money)}`;
    const tabs = W === 'market' || W === 'kaigan' ? [] : W === 'inn' ? [['bar', $t('The bar')], ['kitchen', $t('The kitchen')]] : W === 'chandlery' ? [['counter', $t('The counter')], ['boat', $t('For the boat')], ['mend', $t('Mending')], ['ready', $t('Ready for a trip')]] : W === 'works' ? [['boats', $t('Boats')], ['looks', $t('Paint & name')], ['fit', $t('Fit-out')], ['repair', $t('Repairs')]] : [['bar', $t('The bar')], ['kitchen', $t('The kitchen')], ['sell', $t('Sell to Paco')], ['slate', $t('Paco’s slate')]];
    $('hb-tabs').replaceChildren(...tabs.map(([id, text]) => {
      const b = el('button', id === this.tab ? 'on' : '', text);
      b.type = 'button';
      // (Tabs, for a screen reader and a controller's bumpers: gamepad.js tabs.)
      b.setAttribute('role', 'tab');
      b.setAttribute('aria-selected', id === this.tab ? 'true' : 'false');
      b.addEventListener('click', () => {
        this.tab = id;
        this.render();
      });
      return b;
    }), ...(W === 'muelle' ? [this.button($t('Your room upstairs'), () => this.hooks.openRoom(), $t('quiet hb-room'))] : W === 'chandlery' ? [this.button($t('The tackle store (free)'), () => this.hooks.openStore(), $t('quiet hb-room'))] : []));
    $('hb-tabs').hidden = !tabs.length;
    const body = this.tab === 'kaigan' ? this.renderKaigan() : this.tab === 'boats' ? this.renderBoats() : this.tab === 'looks' ? this.renderLooks() : this.tab === 'fit' ? this.renderFit() : this.tab === 'repair' ? this.renderRepairs() : this.tab === 'sell' ? this.renderSell() : this.tab === 'slate' ? this.renderSlate() : this.tab === 'kitchen' ? this.renderKitchen() : this.tab === 'counter' ? this.renderCounter() : this.tab === 'mend' ? this.renderMend() : this.tab === 'ready' ? this.renderReady() : this.tab === 'boat' ? this.renderBoatStores() : this.renderBar();
    $('hb-body').replaceChildren(...body);
  }

  /* ---- Willowhaven Marine Works (see shipyard.js) ---- */

  // Every boat: yours, on hire today, or for sale (and for hire by the day).
  renderBoats() {
    const out = [], Y = this.state.yard, day = this.state.day, H = this.hooks;
    out.push(el('p', 'hb-say', $t('Jory Tregear wipes his hands on a rag among the cradles and the smell of resin. “Buying, hiring, or come to look? A day’s hire is a fair way to find out if she suits you.”')));
    const kinds = H.yardKinds();
    this.viewKind = kinds.includes(this.viewKind) ? this.viewKind : kinds.find((k) => !owns(Y, k)) || kinds[0];
    out.push(this.previewBlock(this.viewKind));
    for (const kind of kinds) {
      const row = el('div', `cp-row${kind === this.viewKind ? ' hb-viewing' : ''}`);
      const name = H.boatName(kind);
      row.append(this.button($t('Look'), () => { this.viewKind = kind; this.render(); }, kind === this.viewKind ? '' : 'quiet'));
      if (owns(Y, kind)) {
        row.append(el('p', '', $t`The ${name}`), el('span', 'cp-soft', 'yours'));
        // (G8c) Another of her, for a boat that lives at Willowhaven: two to a kind.
        const have = ofKind(Y, kind);
        if (SECOND.includes(kind) && have.length < MOST_OF_A_KIND) row.append(this.button($t`Buy another: ${money(PRICES[kind])}`, () => H.yardBuyAnother(kind), 'quiet'));
        out.push(row);
        for (const id of have.filter((x) => x !== kind)) {
          const r2 = el('div', 'cp-row');
          r2.append(el('p', '', $t`The ${H.boatName(id)}`), el('span', 'cp-soft', $t('yours: your second')));
          out.push(r2);
        }
        continue;
      } else if (hiredToday(Y, kind, day, this.state.day * 24 + this.state.hour)) {
        const until = Y.hired.until;
        row.append(el('p', '', $t`The ${name}`), el('span', 'cp-soft', Number.isFinite(until) ? $t`on hire to you until ${formatClock(until % 24)} ${Math.floor(until / 24) > day ? $t('tomorrow') : $t('today')}` : $t('on hire to you today (back at the yard tomorrow)')));
        row.append(this.button($t`Buy her: ${money(PRICES[kind])}`, () => H.yardBuy(kind)));
      } else {
        row.append(el('p', '', $t`The ${name}`), el('span', 'cp-soft', $t`${money(PRICES[kind])} · or ${money(hirePrice(kind))} for a day${COMES_WITH[kind] && !owns(Y, COMES_WITH[kind]) ? $t` · her ${COMES_WITH[kind]} comes with her, bought` : ''}`));
        row.append(this.button(`Hire: ${money(hirePrice(kind))}`, () => H.yardHire(kind), 'quiet'), this.button(`Buy: ${money(PRICES[kind])}`, () => H.yardBuy(kind)));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t('A boat you buy is yours for good; one you hire is put in the water for you and goes back to the yard a day (24 hours) later. Money buys range, speed and good looks here: never a better bite.')));
    return out;
  }

  // Paint and a name, on your own boats.
  renderLooks() {
    const out = [], Y = this.state.yard, H = this.hooks;
    const mine = H.yardBoats();
    this.lookKind = mine.includes(this.lookKind) ? this.lookKind : mine[0];
    const k = this.lookKind;
    out.push(el('p', 'hb-say', $t`Morwenna in the paint shed, a brush behind her ear: “Your colours, and her name on the bow in proper sign-writer’s letters. ${money(PAINT_PRICE)} a coat, ${money(NAME_PRICE)} for the name.”`));
    const pick = el('div', 'hb-picks');
    for (const kind of mine) pick.append(this.button(`The ${H.boatName(kind)}`, () => { this.lookKind = kind; this.render(); }, kind === k ? '' : 'quiet'));
    out.push(pick);
    if (!k) return out;
    const L = Y.looks[k] || {};
    out.push(this.previewBlock(k));
    out.push(el('h3', '', $t`The ${H.boatName(k)}: ${L.paint ? PAINTS.find((p) => p.id === L.paint).name.toLowerCase() : $t('as she came')}${L.name ? `, “${L.name}”` : ''}`));
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
    input.placeholder = $t('Her name');
    input.value = L.name || '';
    input.addEventListener('keydown', (e) => e.stopPropagation());
    row.append(input, this.button($t`Sign-write it: ${money(NAME_PRICE)}`, () => H.yardName(k, input.value)));
    out.push(row);
    // Her second colour (a stripe, or on a RIB her tubes) and a flag at her stern (see papers.js).
    const trim = H.trimOf(k);
    if (trim.stripes || trim.tubes) {
      const what = trim.tubes ? 'tubes' : 'stripe';
      out.push(el('h4', 'hb-fit-cat', trim.tubes ? $t`Her tubes: ${money(TUBES_PRICE)} for new covers` : $t`Her stripe: ${money(STRIPE_PRICE)}`));
      const chart2 = el('div', 'hb-paints');
      for (const p of PAINTS) {
        const b = this.button(p.name, () => H.yardTrim(k, what, p.id), L[what] === p.id ? '' : 'quiet');
        b.classList.add('hb-swatch');
        b.style.setProperty('--sw', p.hex);
        b.addEventListener('pointerenter', () => this.showPreview(k, null, { [what]: p.hex }));
        b.addEventListener('focus', () => this.showPreview(k, null, { [what]: p.hex }));
        b.addEventListener('pointerleave', () => this.showPreview(k));
        b.addEventListener('blur', () => this.showPreview(k));
        chart2.append(b);
      }
      out.push(chart2);
    }
    out.push(el('h4', 'hb-fit-cat', $t('A flag at her stern')));
    const flags = el('div', 'hb-picks');
    for (const F of FLAGS) {
      const b = this.button(`${F.name}${L.flag === F.id ? '' : `: ${money(F.price)}`}`, () => H.yardTrim(k, 'flag', F.id), L.flag === F.id ? '' : 'quiet');
      b.addEventListener('pointerenter', () => this.showPreview(k, null, { flag: F }));
      b.addEventListener('pointerleave', () => this.showPreview(k));
      flags.append(b);
    }
    if (L.flag) flags.append(this.button($t('Take it down'), () => H.yardTrim(k, 'flag', null), 'quiet'));
    out.push(flags);
    out.push(...this.papersBlock(k));
    return out;
  }

  // (G2b) The slate behind Paco's bar: the island's work, his and the fishermen's (see
  // contracts.js, the south's templates), taken, given up and paid for here as on the board at home.
  renderSlate() {
    const out = [el('p', 'hb-say', $t('Paco wipes the slate behind the bar with his sleeve and chalks up the day’s work. “For a boat, if you want it. The fishermen leave word here too.”'))];
    const box = el('div', 'hb-slate board-work');
    box.id = 'hb-slate';
    this.hooks.slate?.(box, () => this.render());
    out.push(box);
    return out;
  }

  // Her papers (see papers.js): her registration, since when she's been yours, what she's done
  // and her log, newest first.
  papersBlock(k) {
    const V = this.state.yard.vessels?.[k], H = this.hooks;
    if (!V) return [];
    const out = [el('h4', 'hb-fit-cat', $t`Her papers: ${V.reg}`)];
    const best = V.best ? $t`; the best fish aboard a ${V.best.size} cm ${H.fishName(V.best.id)} (${V.best.kg < 1 ? `${Math.round(V.best.kg * 1000)} g` : $t`${V.best.kg.toFixed(1)} kg`}, day ${V.best.day})` : '';
    const engine = H.yardEngine(k);
    const run = [V.hours >= 0.05 ? $t`${V.hours.toFixed(1)} engine hours` : null, $t`${V.nm.toFixed(1)} sea miles`, V.litres >= 0.05 ? $t`${V.litres.toFixed(0)} litres burned` : null, $t`${V.fish} fish aboard`,
      V.nights ? `${V.nights} ${V.nights === 1 ? 'night' : 'nights'} aboard` : null, V.trips ? $t`${V.trips} ${V.trips === 1 ? $t('trip') : $t('trips')} off her mother’s platform` : null].filter(Boolean).join(' · ');
    out.push(el('p', 'hb-fit-sum', $t`Registered at Willowhaven, ${V.reg}. Yours since day ${V.since}${engine ? $t`, her engine the ${ENGINE_MODELS[engine.model]?.name}` : ''}. ${run}${best}.`));
    // (G5) Her engine's service: when it's next due, or how overdue (the Repairs tab does it).
    const svc = H.serviceOf?.(k);
    if (svc) out.push(el('p', 'cp-soft', svc));
    const log = el('ul', 'hb-log');
    for (const e of V.log.slice(-8).reverse()) log.append(el('li', 'cp-soft', $t`Day ${e.day}: ${e.text}`));
    out.push(log);
    return out;
  }

  // Fitting her out (see shipyard.js): one boat at a time, her fittings by kind, each with what it
  // weighs and draws, and a look at her with them on.
  renderFit() {
    const out = [], Y = this.state.yard, H = this.hooks;
    out.push(el('p', 'hb-say', $t('In the workshop, an outboard hangs on a stand with its cowling off. “What’ll it be: range, speed, electronics, something for the deck? Fitted while you wait.”')));
    const mine = H.yardBoats().filter((k) => fitsFor(k, Y.fits[k] || []).length);
    if (!mine.length) {
      out.push(el('p', 'cp-soft', $t('None of your boats takes a fitting from the workshop: the motorboats do (the skiff, the tender, the bass boat, the cabin boat, the centre console, the RIB, the yacht, the trawler, the jet ski), and the sailing boat a few.')));
      return out;
    }
    this.fitKind = mine.includes(this.fitKind) ? this.fitKind : mine[0];
    const k = this.fitKind;
    const pick = el('div', 'hb-picks');
    for (const kind of mine) pick.append(this.button(`The ${H.boatName(kind)}`, () => { this.fitKind = kind; this.render(); }, kind === k ? '' : 'quiet'));
    out.push(pick, this.previewBlock(k));
    const e = fitEffect(Y, k), have = Y.fits[k] || [];
    out.push(el('p', 'hb-fit-sum', have.length
      ? $t`Fitted: ${have.length} · carrying ${e.kg} kg more · drawing up to ${e.amps.toFixed(1)} A${e.house ? $t(' (on her house battery)') : ''}`
      : $t('As she came from the builder: nothing fitted yet.')));
    if (hasCatalogue(kindOf(k))) out.push(...this.engineBlock(k));
    for (const [cat, catName] of Object.entries(FIT_CATS)) {
      const ids = fitsFor(k, Y.fits[k] || []).filter((id) => FITS[id].cat === cat);
      if (!ids.length) continue;
      out.push(el('h4', 'hb-fit-cat', catName));
      for (const id of ids) {
        const F = FITS[id], fitted = have.includes(id);
        const slotted = !fitted && F.slot ? have.find((x) => FITS[x].slot === F.slot) : null;
        const row = el('div', `cp-row hb-fit${fitted ? ' on' : ''}`);
        const text = el('div', 'hb-fit-text');
        // (G5: what it does to the work she can take.)
        const W = F.work, more = W?.seats?.[k] || 0;
        const work = [more ? (more > 1 ? $t`${more} more seats` : $t`${more} more seat`) : null, W?.divers ? $t('takes dive work') : null, W?.comfort ? $t`her people happy in ${Math.round(W.comfort * 100)} cm more sea` : null];
        text.append(el('p', '', F.name), el('span', 'cp-soft', F.desc), el('span', 'hb-fit-meta', [F.kg ? `${F.kg} kg` : $t('no weight to speak of'), F.amps ? $t`draws ${F.amps} A` : null, ...work].filter(Boolean).join(' · ')));
        row.append(text);
        if (fitted) row.append(el('span', 'cp-soft', 'fitted'), this.button($t('Take it off'), () => H.yardUnfit(k, id), 'quiet'));
        else row.append(this.button(`${slotted ? $t`Swap for this` : $t('Fit it')}: ${money(F.price[k])}`, () => H.yardFit(k, id)));
        out.push(row);
      }
    }
    out.push(el('p', 'cp-soft', $t('Everything here weighs something (she sits a touch lower and goes a touch slower for it) and the electronics and lights draw on her battery while the engine’s off. Nothing here does a thing for the fish’s appetite.')));
    return out;
  }

  // Her knocks (see damage.js): what the yard finds on each of your boats and what it costs to put
  // right, a job at a time or all of it.
  renderRepairs() {
    const out = [], Y = this.state.yard, H = this.hooks;
    out.push(el('p', 'hb-say', $t('Out in the yard a boat stands on blocks, a lamp under her bottom. “Brought her in knocked about? Let’s have a look.”')));
    let any = false;
    for (const k of H.yardBoats()) {
      const rows = H.repairsFor?.(k) || [];
      if (!rows.length) continue;
      any = true;
      out.push(el('h4', 'hb-fit-cat', $t`The ${H.boatName(k)}`));
      for (const r of rows) {
        const row = el('div', 'cp-row hb-fit');
        const text = el('div', 'hb-fit-text');
        text.append(el('p', '', r.what));
        row.append(text, this.button(r.price ? $t`Do it: ${money(r.price)}` : $t('Do it'), () => {
          if (r.price && !this.pay(r.price, $t('Willowhaven Marine Works'))) return;
          H.yardRepair(k, r.id);
          this.render();
        }));
        out.push(row);
      }
      if (rows.length > 1) {
        const all = rows.reduce((n, r) => n + r.price, 0);
        out.push(this.button($t`All of it: ${money(all)}`, () => {
          if (all && !this.pay(all, $t('Willowhaven Marine Works'))) return;
          H.yardRepair(k, 'all');
          this.render();
        }, 'quiet'));
      }
    }
    if (!any) out.push(el('p', 'cp-soft', $t('Your boats are sound: not a mark on them the yard would charge for, and no engine due its service.')));
    out.push(el('p', 'cp-soft', $t('Her engine wants a service every hundred hours it runs (her papers count them): run on past that and she slowly loses a little power and burns more, until it’s done. Nothing else breaks on its own: a knock is what she hit and how hard. A quay met gently, or sand, does no harm; rock, or a quay met at speed, does. A gouged or cracked bottom slows her. A punctured tube goes soft, and she sits lower on that side. A bent propeller is on the Fit-out tab.')));
    return out;
  }

  // Her engine and propeller (see engines.js): what's on her now, then every engine she takes and
  // every propeller for the one she has, each with what she did when the yard ran her with it
  // (engineTrials.js: measured on the boat herself, in open water on a calm day), and how it
  // compares with what she has now.
  engineBlock(k) {
    // (k: her id, as the sheet has her; kk: her kind, for the catalogue of a boat like her.)
    const kk = kindOf(k), H = this.hooks, C = CATALOGUE[kk], now = H.yardEngine(k), T = TRIALS[kk] || {}, tank = H.tankOf(k);
    const cur = T[`${now.model}/${now.prop}`], spec = H.engineSpecFor(k, now), O = MODELS[now.model], n = C.count || 1;
    const inboard = !!O.inboard, where = inboard ? $t('In her engine room') : $t('On her transom');
    const kn = (v) => `${(v * KN).toFixed(1)} kn`;
    // (How one compares with what she has now: + or −, or nothing if it's the same.)
    const diff = (a, b, unit, d = 1) => {
      const x = Math.round((a - b) * 10 ** d) / 10 ** d;
      return x ? ` (${x > 0 ? '+' : '−'}${Math.abs(x).toFixed(d)}${unit})` : '';
    };
    const figures = (t, extra = () => []) => {
      if (!t || !cur) return '';
      const top = $t`${kn(t.top)} flat out${diff(t.top * KN, cur.top * KN, ' kn')}`;
      const go = t.t20 != null ? $t`0–${C.go} kn in ${t.t20.toFixed(1)} s${cur.t20 != null ? diff(t.t20, cur.t20, ' s') : ''}` : $t`never quite ${C.go} kn`;
      return [top, go, ...extra(t)].filter(Boolean).join(' · ');
    };
    const out = [el('h4', 'hb-fit-cat', inboard ? $t('Engines and propellers') : n > 1 ? $t('Engines and propellers') : $t('Engine and propeller'))];
    const blades = spec.blades === 4 ? (spec.steel ? 'four-bladed stainless' : 'four-bladed') : 'three-bladed';
    // (An electric outboard: its power in kilowatts, its range on its own battery at its own easy
    // pace, not on her tank at her cruise.)
    const power = (E) => (E.electric ? `${E.kw} kW` : n > 1 ? `2 × ${E.hp} hp` : `${E.hp} hp`);
    const far = (x) => (x?.bph ? $t`${Math.round(rangeAt(x, tank, kk))} nautical miles on a full battery at ${x.kn} knots` : $t`${Math.round(rangeAt(x, tank, kk))} nautical miles on a full tank at ${C.cruise} knots`);
    out.push(el('p', 'hb-fit-sum', (n > 1 ? $t`${where}: ${n > 1 ? $t('a pair of ') : $t('the ')}${O.name}s (${power(O)} ${O.layout}, ${O.kg * n} kg), on ${n > 1 ? $t`${blades} ${spec.pitch}-inch propellers` : $t`a ${blades} ${spec.pitch}-inch propeller`}.${cur ? $t` She does ${kn(cur.top)} flat out, and ${far(cur)}.` : ''}` : $t`${where}: ${n > 1 ? $t('a pair of ') : $t('the ')}${O.name} (${power(O)} ${O.layout}, ${O.kg * n} kg), on ${n > 1 ? $t`${blades} ${spec.pitch}-inch propellers` : $t`a ${blades} ${spec.pitch}-inch propeller`}.${cur ? $t` She does ${kn(cur.top)} flat out, and ${far(cur)}.` : ''}`)));
    for (const model of C.models) {
      const E = MODELS[model], on = model === now.model, t = T[`${model}/${propsFor(kk, model).includes(now.prop) ? now.prop : 'matched'}`];
      const row = el('div', `cp-row hb-fit${on ? ' on' : ''}`);
      const text = el('div', 'hb-fit-text');
      const range = (x) => {
        const nm = Math.round(rangeAt(x, tank, kk));
        if (x.bph) return [$t`${nm} nm on its battery at ${x.kn} kn`];
        const was = cur && !cur.bph ? Math.round(rangeAt(cur, tank, kk)) : null;
        return [$t`${nm} nm at ${C.cruise} kn${was != null && nm !== was ? ` (${nm > was ? '+' : '−'}${Math.abs(nm - was)})` : ''}`];
      };
      text.append(el('p', '', `${n > 1 ? 'Twin ' : ''}${E.name}${n > 1 ? 's' : ''}: ${power(E)}${model === C.stock ? $t(' (as she came)') : ''}`), el('span', 'cp-soft', E.desc),
        el('span', 'hb-fit-meta', $t`${E.layout} · ${E.kg * n} kg${diff(E.kg * n, O.kg * n, ' kg', 0)}`), el('span', 'hb-fit-meta', figures(t, range)));
      row.append(text);
      if (on) row.append(el('span', 'cp-soft', $t('on her now')));
      else row.append(this.button(`Fit ${n > 1 ? 'them' : 'it'}: ${money(E.price * n)}`, () => H.yardRepower(k, model)));
      out.push(row);
    }
    if (O.electric) out.push(el('p', 'cp-soft', $t`The ${O.name} turns its own propeller, matched to it. It charges free wherever she ties up at a jetty or a quay, and overnight; flat, the oars bring her in.`));
    else out.push(el('p', 'cp-soft', $t`Propellers for the ${fittedName(kk, now.model)}:`));
    for (const prop of O.electric ? [] : propsFor(kk, now.model)) {
      const P = PROPS[prop], on = prop === now.prop, t = T[`${now.model}/${prop}`], pitch = H.engineSpecFor(k, { model: now.model, prop }).pitch;
      const row = el('div', `cp-row hb-fit${on ? ' on' : ''}`);
      const text = el('div', 'hb-fit-text');
      const laden = (x) => [`${kn(x.laden)} with ${C.crew}${diff(x.laden * KN, cur.laden * KN, ' kn')}`];
      text.append(el('p', '', $t`${propName(kk, prop)}: ${pitch}-inch`), el('span', 'cp-soft', P.desc), el('span', 'hb-fit-meta', figures(t, laden)));
      row.append(text);
      // (Hers, bent on the bottom: a new one of the same, or another fitted, puts it right.)
      const dmg = on ? H.propDamage?.(k) || 0 : 0;
      if (on && dmg >= 0.05) row.append(el('span', 'hb-warn', $t`damaged: ${Math.round(dmg * 100)}% down`), this.button($t`A new one: ${money(P.price * n)}`, () => {
        if (!this.pay(P.price * n, $t('Willowhaven Marine Works'))) return;
        H.yardMendProp(k);
        this.render();
      }));
      else if (on) row.append(el('span', 'cp-soft', $t('on her now')));
      else row.append(this.button(`Fit ${n > 1 ? 'them' : 'it'}: ${money(P.price * n)}`, () => H.yardReprop(k, prop)));
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t`The yard ran her with each, out past the bay on a calm day: what she did then is what you’ll get.${C.plate ? $t` Her plate allows ${n > 1 ? $t`${C.plate} hp each` : $t`${C.plate} hp`}.` : ''} The old is taken in part exchange; new engines come with your kind of propeller, pitched for them. More weight aboard, a sea or a foul bottom all cost speed, whatever’s fitted.`));
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
        ? $t('Mags Pennock, behind her slab in a blue apron, sleeves rolled: “What have you brought me, then?”')
        : $t`The market’s shut: the slab scrubbed, the boxes stacked. Mags opens at ${formatClock(MARKET_HOURS[0])} and packs up at ${formatClock(MARKET_HOURS[1])}.`));
    } else {
      out.push(el('p', 'hb-say', $t('Paco buys fish for his kitchen from the boats, and sells what he can’t cook on to the restaurants up the hill. “¡A ver! Let me see.”')));
    }
    if (place === 'haven' && this.marketOpen) out.push(...this.favourBlock('mags'));
    if (this.receipt) out.push(this.renderReceipt());
    const slate = el('div', 'hb-slate');
    slate.append(el('h3', '', place === 'haven' ? $t('On the slate today') : $t('Paco wants today')));
    slate.append(el('p', '', $t`Wanted: ${names(D.wanted)} (half as much again)`));
    slate.append(el('p', '', $t`Plenty of: ${names(D.plenty)} (a bit less)`));
    // (G2) What this quay can't get for itself, and always pays well for.
    slate.append(el('p', '', $t`Always dear here, brought over the sea from ${place === 'haven' ? $t('Las Brasas') : $t('the north')}: ${names(IMPORTS[place])} (${Math.round((IMPORT_K - 1) * 100)}% over, fresh or iced)`));
    out.push(slate);
    out.push(el('h3', '', $t`Your creel (${this.state.keep.length} fish, ${creelWords(this.state)})`));
    const orders = ordersFor(day, place).filter((o) => !this.harbour.filled.includes(o.key));
    let any = 0, total = 0;
    // (Kind by kind: thirty mackerel are one line, sold together.)
    for (const g of creelGroups(this.state.keep)) {
      const sp = fishById[g.id];
      const row = el('div', 'cp-row');
      const vs = g.idx.map((i) => fishValue(this.state.keep[i], { day, now, place }));
      const v = vs[0];
      if (g.cooked) {
        row.append(el('p', '', groupWords(sp.meal.name, g)), el('span', 'cp-soft', $t('cooked: for eating, not for the slab')));
      } else if (!v.wanted) {
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', place === 'haven' ? $t('nobody here buys it') : $t('Paco doesn’t take it')));
      } else {
        const sum = vs.reduce((s, x) => s + x.price, 0), fresh = Math.min(...vs.map((x) => x.fresh));
        const prime = vs.some((x) => x.prime);
        const tags = [kgWords(g.kg), OLD(fresh), v.imported ? $t('brought over the sea: dear here') : '', v.demand === 'wanted' ? $t('wanted today') : v.demand === 'plenty' ? $t('plenty about') : '', seasonWord(v.season), prime ? (g.n > 1 ? $t('prime ones among them') : $t('a prime fish')) : ''].filter(Boolean).join(' · ');
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', tags));
        const order = orders.find((o) => o.id === g.id && g.max >= o.min);
        if (order) row.append(el('span', 'cp-soft hb-hint', $t`${place === 'haven' ? $t('Ruth at The Lobster Pot') : $t('Paco’s kitchen')} wants ${g.n > 1 ? $t('one of these') : $t('this one')}: ${money(order.reward)}`));
        // (Mags is straight with you: Kenji pays more for a fish fit to eat raw.)
        if (place === 'haven') {
          const kv = g.idx.reduce((t, i) => t + kaiganValue(this.state.keep[i], { day, now }).price, 0);
          if (kv > sum * 1.15 + 1) row.append(el('span', 'cp-soft hb-hint', $t`Kenji at Kaigan, across the apron, would give ${money(kv)} for ${g.n > 1 ? $t('these') : 'it'}${g.id === 'tuna' ? $t(': “Take it to him, love. I can’t do a bluefin justice.”') : ''}`));
        }
        const b = this.button(g.n > 1 ? $t`Sell all ${g.n}: ${money(sum)}` : `Sell: ${money(sum)}`, () => (g.n > 1 ? this.sellKind(g.id) : this.sell(g.first)));
        b.disabled = !this.marketOpen;
        row.append(b);
        any += g.n;
        total += sum;
      }
      out.push(row);
    }
    if (!this.state.keep.length) out.push(el('p', 'cp-soft', $t('Nothing in your creel. Fish you keep (K, or Keep on the catch card) can be sold here, cooked at camp, or taken to the inn’s kitchen.')));
    if (any > 1 && this.marketOpen) {
      const row = el('div', 'cp-row cp-acts');
      row.append(this.button($t`Sell all ${any}: ${money(total)}`, () => this.sellAll()));
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t('Fish fetch their best fresh: within half a day of the catch. After that the price slips, a little more each day. A camp’s cool box keeps them on ice. The seasons move prices too: plenty in season fetches a little less, a scarce fish out of season a little more, and a prime fish of its kind more by the kilo.')));
    return out;
  }

  // The last sale, line by line: what, how heavy, the price by the kilo and why, and the total.
  renderReceipt() {
    const R = this.receipt, box = el('div', 'hb-receipt');
    box.append(el('h3', '', $t`${this.where === 'kaigan' ? $t('Kenji’s') : this.place === 'haven' ? $t('Mags’s') : $t('Paco’s')} receipt`));
    for (const L of R.lines) {
      const row = el('div', 'hb-rline');
      row.append(el('span', '', $t`${L.name}, ${L.size} cm · ${kgWords(L.kg)} at ${money(L.each)}/kg${L.why.length ? ` (${L.why.join(', ')})` : ''}`), el('strong', '', money(L.price)));
      box.append(row);
    }
    const tot = el('div', 'hb-rline hb-rtotal');
    tot.append(el('span', '', $t`${R.lines.length} fish`), el('strong', '', money(R.total)));
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
      this.hooks.toast($t`${this.place === 'haven' ? $t('Mags') : $t('Paco')} weighs the ${lower(sp.name)}: ${v.kg.toFixed(v.kg < 1 ? 2 : 1)} kg. ${money(v.price)} into your purse.`, 4);
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
    this.hooks.toast($t`${this.place === 'haven' ? $t('Mags') : $t('Paco')} weighs them up: ${n} ${lower(fishById[id].name)}, ${money(sum)} into your purse.`, 4);
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
    this.hooks.toast($t`${n} fish weighed and paid for: ${money(sum)} into your purse.`, 4);
    this.hooks.changed();
    this.render();
  }

  /* ---- Kaigan: Kenji Higa at the kitchen door, buying for the counter (see kaigan.js) ---- */
  get kaigan() {
    this.harbour.kaigan ??= { sold: 0, bluefin: 0, earned: 0 };
    return this.harbour.kaigan;
  }

  renderKaigan() {
    const out = [], day = this.state.day, now = this.hooks.now(), open = this.marketOpen;
    out.push(el('p', 'hb-say', open
      ? $t('Kenji Higa comes to the kitchen door in his whites, a cloth knotted round his head, wiping his hands. Lima taught him ceviche; his Okinawan grandmother taught him the knife. “Fresh? Show me the eyes.”')
      : $t`The kitchen door is shut, the noren taken in. Kenji buys from the boats from ${formatClock(KAIGAN_HOURS[0])} till ${formatClock(KAIGAN_HOURS[1])}, before service ends.`));
    if (this.receipt) out.push(this.renderReceipt());
    const board = el('div', 'hb-slate');
    board.append(el('h3', '', $t('On the board tonight')));
    board.append(el('p', '', $t`Specials: ${specialsFor(day).map((id) => `${fishById[id].name} (${DISHES[id].dish})`).join('; ')}: half as much again`));
    board.append(el('p', '', $t('A whole bluefin, whenever one comes in: he breaks it down at the counter himself.')));
    out.push(board);
    out.push(el('h3', '', $t`Your creel (${this.state.keep.length} fish, ${creelWords(this.state)})`));
    let any = 0, total = 0;
    for (const g of creelGroups(this.state.keep)) {
      const sp = fishById[g.id];
      const row = el('div', 'cp-row');
      const vs = g.idx.map((i) => kaiganValue(this.state.keep[i], { day, now }));
      const v = vs[0];
      if (g.cooked) {
        row.append(el('p', '', groupWords(sp.meal.name, g)), el('span', 'cp-soft', $t('cooked: for eating, not for his counter')));
      } else if (!v.wanted) {
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', sp.water === 'fresh' ? $t('“Never a fresh water fish raw.” Mags takes it.') : $t('not one for his counter: Mags takes most fish')));
      } else {
        const sum = vs.reduce((s, x) => s + x.price, 0);
        const worst = vs.some((x) => x.grade === 'old') ? 'old' : vs.some((x) => x.grade === 'kitchen') ? 'kitchen' : 'raw';
        const tags = [kgWords(g.kg), v.dish, gradeWords(worst), v.special && g.id !== 'tuna' ? $t('tonight’s special') : '', vs.some((x) => x.prime) ? (g.n > 1 ? $t('prime ones among them') : $t('a prime fish')) : ''].filter(Boolean).join(' · ');
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', tags));
        if (sum > 0) {
          const b = this.button(g.n > 1 ? $t`Sell all ${g.n}: ${money(sum)}` : `Sell: ${money(sum)}`, () => (g.n > 1 ? this.sellKaiganKind(g.id) : this.sellKaigan(g.first)));
          b.disabled = !open;
          row.append(b);
          any += vs.filter((x) => x.price > 0).length;
          total += sum;
        }
      }
      out.push(row);
    }
    if (!this.state.keep.length) out.push(el('p', 'cp-soft', $t('Nothing in your creel. Kenji wants sea fish caught today: tuna and amberjack, bass and bream, sole and turbot, mackerel, squid and octopus.')));
    if (any > 1 && open) {
      const row = el('div', 'cp-row cp-acts');
      row.append(this.button($t`Sell him all ${any}: ${money(total)}`, () => this.sellKaiganAll()));
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t`He pays well over the market for fish fit to eat raw: caught within ${RAW_HOURS} hours (time on ice doesn’t count, so a bag of ice from Bert keeps the clock stopped). A day-old fish he takes for the hot kitchen at little over half the price; older, not at all. A prime fish of its kind fetches more by the kilo.`));
    return out;
  }

  sellKaigan(i, quiet = false) {
    const f = this.state.keep[i];
    if (!f || f.cooked || !this.marketOpen) return 0;
    const v = kaiganValue(f, { day: this.state.day, now: this.hooks.now() });
    if (!v.wanted || v.price <= 0) return 0;
    this.state.keep.splice(i, 1);
    if (!quiet || !this.receipt?.open) this.receipt = { lines: [], total: 0, open: quiet };
    this.receipt.lines.push(kaiganLine(f, v));
    this.receipt.total = Math.round((this.receipt.total + v.price) * 100) / 100;
    this.earn(v.price, $t('Kaigan'), 'kaigan');
    this.harbour.sold++;
    this.kaigan.sold++;
    this.kaigan.earned = Math.round((this.kaigan.earned + v.price) * 100) / 100;
    const first = f.id === 'tuna' && !this.kaigan.bluefin++;
    this.hooks.sold(f.logId);
    // (A bluefin is an occasion, even among several: the words are kept for the toast after.)
    const sp = fishById[f.id];
    const say = f.id === 'tuna'
      ? $t`${first ? $t('The whole kitchen comes out to see it. ') : ''}Kenji runs a hand down the bluefin, ${v.kg.toFixed(0)} kg of it, and smiles for the first time today. “Ōtoro tonight.” ${money(v.price)} into your purse.`
      : $t`Kenji lifts the ${lower(sp.name)}, looks it in the eye, presses its flank: ${v.grade === 'raw' ? $t`“Good. ${v.dish[0].toUpperCase()}${v.dish.slice(1)}.”` : $t('“For the grill, then.”')} ${money(v.price)} into your purse.`;
    if (quiet) {
      if (f.id === 'tuna') this.bigSay = say;
    } else {
      this.hooks.chime();
      this.hooks.toast(say, f.id === 'tuna' ? 8 : 5);
      this.hooks.changed();
      this.render();
    }
    return v.price;
  }

  sellKaiganKind(id) {
    let n = 0, sum = 0;
    for (let i = this.state.keep.length - 1; i >= 0; i--) {
      if (this.state.keep[i].id !== id || this.state.keep[i].cooked) continue;
      const p = this.sellKaigan(i, true);
      if (p > 0) { n++; sum += p; }
    }
    this.afterKaigan(n, sum, `${n} ${lower(fishById[id].name)}`);
  }

  sellKaiganAll() {
    let n = 0, sum = 0;
    for (let i = this.state.keep.length - 1; i >= 0; i--) {
      const p = this.sellKaigan(i, true);
      if (p > 0) { n++; sum += p; }
    }
    this.afterKaigan(n, sum, `${n} fish`);
  }

  afterKaigan(n, sum, what) {
    if (this.receipt) this.receipt.open = false;
    const big = this.bigSay;
    this.bigSay = null;
    if (!n) return;
    this.hooks.chime();
    this.hooks.toast($t`${big ? `${big} ` : ''}Kenji weighs ${big ? $t('the rest') : $t('them')} on the kitchen scales: ${what}, ${money(sum)} in all.`, big ? 9 : 4);
    this.hooks.changed();
    this.render();
  }

  /* ---- the kitchen: the day's orders, a fish of yours cooked, the plate of the day ---- */

  renderKitchen() {
    const out = [];
    const place = this.place, host = HOST[place];
    const early = this.hour < 6, late = this.hour >= ORDERS_BY;
    out.push(el('p', 'hb-say', place === 'haven'
      ? $t('Ruth Alder runs the kitchen as well as the bar. She buys her fish from whoever brings in the best of it, and she pays well for what she’s after.')
      : $t('Paco’s mother cooks, in a kitchen the size of a cupboard. What goes on the menu depends on what the boats bring in.')));
    // How well the kitchen knows you (orders filled), and what that's worth.
    const st = standingOf(this.harbour.served);
    out.push(el('p', 'cp-soft hb-standing', st.tier
      ? $t`${host} counts you ${st.name}: ${Math.round(st.bonus * 100)}% over the order’s price${st.next != null ? $t` (${st.next - this.harbour.served} more ${st.next - this.harbour.served === 1 ? $t('order') : $t('orders')} and you’re ${STANDING[st.tier + 1].name})` : $t(', and your name goes on the board with the dish')}.`
      : $t`${host} doesn’t know you yet. Bring good fish for her orders and she will (${st.next - this.harbour.served} more and you’re a regular supplier). A fine fish, well over the size asked, earns a quarter more.`));
    out.push(el('h3', '', $t`${host}’s orders for tonight`));
    for (const o of ordersFor(this.state.day, place)) {
      const sp = fishById[o.id];
      const row = el('div', 'cp-row');
      const a = an(lower(sp.name));
      const want = `${a[0].toUpperCase()}${a.slice(1)}${o.min > sp.size[0] ? $t`, ${o.min} cm or more` : ''}`;
      row.append(el('p', '', want), el('span', 'cp-soft', $t`${money(o.reward)} · by ${formatClock(o.by)}`));
      if (this.harbour.filled.includes(o.key)) row.append(el('span', 'hb-done', $t('Done ✓')));
      else if (late || early) row.append(el('span', 'cp-soft', early ? $t('the kitchen opens at six') : $t('too late tonight')));
      else {
        const i = fills(this.state.keep, o);
        if (i >= 0) {
          const P = orderPay(o, this.state.keep[i], this.harbour.served);
          row.append(this.button($t`Bring your ${this.state.keep[i].size} cm one: ${money(P.pay)}${P.fine ? $t(' (a fine one)') : ''}`, () => this.fill(o)));
        }
        else row.append(el('span', 'cp-soft', $t('none in your creel')));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t`New orders every morning. ${place === 'haven' ? $t('The board on the quay says what’s about, and where.') : $t('Ask Paco at the bar where they’re biting.')}`));
    out.push(el('h3', '', $t('Something to eat')));
    const P = PLATES[place];
    const plate = el('div', 'cp-row');
    plate.append(el('p', '', $t`The plate of the day: ${P.name}`), el('span', 'cp-soft', money(PLATE)), this.button($t('Order it'), () => {
      if (!this.pay(PLATE)) return;
      this.hooks.eatDish(P.text, P.fill);
      this.hooks.changed();
      this.render();
    }));
    out.push(plate);
    const raw = creelGroups(this.state.keep).filter((g) => !g.cooked);
    if (raw.length) {
      out.push(el('p', 'cp-soft', $t`Or ${host} will cook one of yours for ${money(COOK_YOURS)}:`));
      for (const g of raw) {
        const sp = fishById[g.id], i = g.first, f = this.state.keep[i];
        const row = el('div', 'cp-row');
        row.append(el('p', '', groupWords(sp.name, g)), el('span', 'cp-soft', sp.meal.name), this.button(g.n > 1 ? $t('Cook one for me') : $t('Cook it for me'), () => {
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
    this.earn(P.pay, $t('At the harbour'), 'kitchen');
    this.hooks.sold(f.logId);
    this.hooks.chime();
    const sp = fishById[f.id], name = this.hooks.playerName?.() || '';
    // (The kitchen's own supplier gets their name on the board with the dish.)
    const board = now.tier >= 2 && name ? $t` On the board tonight: “${name}’s ${lower(sp.meal?.name || sp.name)}”.` : $t(' It’s on the board tonight.');
    const fine = P.fine ? $t(' A fine one, and paid for it.') : '';
    const up = now.tier > was.tier ? $t` ${this.place === 'haven' ? $t('Ruth') : $t('Paco')} counts you ${now.name} now.` : '';
    this.hooks.toast(this.place === 'haven'
      ? $t`Ruth holds up the ${lower(sp.name)} to the light. “Now that’s a fish.” ${money(P.pay)} into your purse.${fine}${board}${up}`
      : $t`Paco shouts into the kitchen, and his mother comes out to see the ${lower(sp.name)}. ${money(P.pay)} into your purse.${fine}${up}`, 7);
    this.hooks.changed();
    this.render();
  }

  // Bert's word on the fish worth going after today: one the market wants or the kitchen has
  // ordered, in its season now, where it lives, and how he'd rig for it (the field guide's way).
  worthTip() {
    const W = worthGoingAfter(this.state.day, this.hooks.now(), 'haven');
    if (!W) return null;
    const sp = fishById[W.id], s = setupsFor(sp)[0];
    const who = W.why === 'order' ? $t('Ruth’s after one for her kitchen tonight') : $t('Mags wants them on the slab today');
    const season = W.boost >= 1.1 ? $t('and they’re well in just now') : W.boost >= 0.9 ? $t('and they’re about') : $t('though they’re thin on the ground this time of year');
    const rig = s ? $t` I’d put ${an(lower(TACKLE[s.item].name))} on the ${lower(RODS[s.rod].name)}.` : '';
    return `${an(lower(sp.name)).replace(/^./, (c) => c.toUpperCase())}: ${who}, ${season}. ${sp.where}.${rig}`;
  }

  /* ---- the bar: a pint and a story, advice, and what's being said ---- */

  renderBar() {
    const out = [];
    const place = this.place, host = HOST[place];
    const talk = this.hooks.talk(place);
    out.push(el('p', 'hb-say', place === 'haven'
      ? $t('Low beams, a coal fire, a stuffed bass in a glass case over the bar. Ruth Alder is drying glasses. A couple of the old boys are in their corner by the window, watching the quay.')
      : $t('Plastic chairs out on the quay, a television with the football on, a fan turning slowly. Paco leans on the bar, a cloth over his shoulder.')));
    out.push(...this.favourBlock(place === 'haven' ? 'ruth' : 'paco'));
    // A pint, and a story with it.
    const pint = el('div', 'cp-row');
    pint.append(el('p', '', place === 'haven' ? $t('A pint of Ruth’s best bitter, and a story with it') : $t('A caña, a little cold beer, and a story with it')), el('span', 'cp-soft', money(PINT)), this.button(this.said.story ? $t('Another') : $t('Buy one'), () => {
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
    adv.append(el('p', '', $t`Ask ${host} what’s biting`), this.button(this.said.advice ? $t('Ask again') : $t('Ask'), () => {
      this.said.advice = adviceFor(talk.advice);
      this.render();
    }, 'quiet'));
    out.push(adv);
    if (this.said.advice) out.push(el('blockquote', 'hb-story', `“${this.said.advice}”`));
    // What's being said today.
    const lines = rumoursNow(talk.rumours).slice(0, 4);
    out.push(el('h3', '', $t('What they’re saying')));
    if (lines.length) for (const l of lines) out.push(el('p', 'hb-rumour', l));
    else out.push(el('p', 'cp-soft', place === 'haven' ? $t('A quiet day: the talk is of the weather, the price of diesel, and whose turn it is to buy.') : $t('Nothing much: the football, the heat, a cousin’s wedding.')));
    const heard = this.harbour.heard[place].length;
    out.push(el('p', 'cp-soft', $t`Stories heard here: ${heard}.`));
    // The board by the door: the harbour's challenges (see daybook.js), and who's done what.
    if (place === 'haven') {
      out.push(el('h3', '', $t('The board by the door')));
      out.push(el('p', 'cp-soft', $t('Pinned up in Ruth’s hand: “Not a competition. Just something to go for.” A cloth badge for each, for your wall at home.')));
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
    out.push(el('p', 'hb-say', $t('Old Bert Hale, behind a counter worn smooth by sixty years of elbows, a pencil behind his ear: “Now then. The tackle’s through there, help yourself, same as always. Anything else?”')));
    out.push(...this.favourBlock('bert'));
    // Advice over the counter: Bert's read of the water today (the same as the bar's, from the
    // world as it is).
    const adv = el('div', 'cp-row');
    adv.append(el('p', '', $t('Ask Bert what’s biting, and where')), this.button(this.said.advice ? $t('Ask again') : $t('Ask'), () => {
      this.said.advice = adviceFor(this.hooks.talk('haven').advice);
      this.render();
    }, 'quiet'));
    out.push(adv);
    if (this.said.advice) out.push(el('blockquote', 'hb-story', `“${this.said.advice}”`));
    const tip = this.worthTip();
    if (tip) {
      out.push(el('h3', '', $t('Worth going after today')));
      out.push(el('blockquote', 'hb-story', `“${tip}”`));
    }
    out.push(el('h3', '', $t('Creels')));
    const mine = creelOf(this.state);
    const row0 = el('div', 'cp-row');
    row0.append(el('p', '', $t`${mine.name === CREELS[0].name ? $t('Your creel') : mine.name}: holds ${mine.kg} kg of fish`), el('span', 'hb-done', 'yours'));
    out.push(row0);
    CREELS.forEach((c, i) => {
      if (i <= S.creel) return;
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${c.name}. ${c.note}`), el('span', 'cp-soft', money(c.price)), this.button($t('Buy it'), () => {
        if (this.shop.creel >= i || !this.pay(c.price)) return;
        this.shop.creel = i;
        this.hooks.chime();
        this.hooks.toast($t`${c.name} over your shoulder: room for ${c.kg} kg now. ${c.cool ? $t('Your catch keeps cool in it. ') : ''}Your old creel goes on the hook behind the door.`, 6);
        this.hooks.changed();
        this.render();
      }));
      out.push(row);
    });
    out.push(el('h3', '', $t('For the day')));
    const ice = el('div', 'cp-row');
    const iced = onIce(this.state, now), lots = S.iceUntil > now + 12;
    ice.append(el('p', '', $t('A bag of ice for your creel: whatever you catch keeps fresh for the next day')), el('span', 'cp-soft', iced ? $t`on ice till ${formatClock(S.iceUntil % 24)}${S.iceUntil >= (this.state.day + 1) * 24 ? $t(' tomorrow') : ''}` : money(ICE.price)));
    const ib = this.button($t('Buy a bag'), () => {
      if (this.shop.iceUntil > this.hooks.now() + 12 || !this.pay(ICE.price)) return;
      this.shop.iceUntil = this.hooks.now() + ICE.hours;
      this.hooks.toast($t('Bert shovels crushed ice into a bag and packs it into your creel. Your fish keep fresh for a day.'), 5);
      this.hooks.changed();
      this.render();
    });
    ib.disabled = lots;
    if (lots) ib.title = $t('Plenty of ice in your creel still');
    ice.append(ib);
    out.push(ice);
    const bait = el('div', 'cp-row');
    const today = freshBaitToday(this.state);
    bait.append(el('p', '', $t('Fresh bait, dug and gathered this morning: ragworm, peeler crab and sandeel, lively and smelling of the sea. Fish find your natural baits from further off, all day.')), el('span', 'cp-soft', today ? $t('you’ve some today') : money(BAIT.price)));
    const bb = this.button($t('Buy a tub'), () => {
      if (freshBaitToday(this.state) || !this.pay(BAIT.price)) return;
      this.shop.baitDay = this.state.day;
      this.hooks.toast($t('A tub of fresh bait, wrapped in wet newspaper, goes in your bag. For the rest of today, your worms, crab, prawn and the like fish better.'), 6);
      this.hooks.changed();
      this.render();
    });
    bb.disabled = today;
    bait.append(bb);
    out.push(bait);
    // (F1b) For when it goes wrong at sea: the repair kit's spares, and flares (see safety.js).
    const safe = this.hooks.safety?.() || [];
    if (safe.length) {
      out.push(el('h3', '', $t('For when it goes wrong')));
      for (const r of safe) {
        const row = el('div', 'cp-row');
        row.append(el('p', '', r.text), el('span', 'cp-soft', r.state));
        if (r.label) {
          const b = this.button(r.label, () => {
            r.run();
            this.render();
          });
          b.disabled = !!r.done;
          row.append(b);
        }
        out.push(row);
      }
    }
    // (F3a) What you've picked up on the beaches after a gale.
    const finds = this.hooks.finds?.() || [];
    if (finds.length) {
      out.push(el('h3', '', $t('From the shore')));
      for (const r of finds) {
        const row = el('div', 'cp-row');
        row.append(el('p', '', r.text), el('span', 'cp-soft', r.state));
        row.append(this.button(r.label, () => {
          r.run();
          this.render();
        }));
        out.push(row);
      }
    }
    out.push(el('p', 'cp-soft', $t('Everything here is a help, never a need: the tackle store is free, and a fish caught on the plainest worm counts the same.')));
    return out;
  }

  // Things for the boat (cargo.js): yours, where each is, put aboard a boat lying here or brought
  // ashore, a cylinder refilled or a battery charged; and the shelves.
  renderBoatStores() {
    const out = [], C = this.hooks.cargo, here = C.boatsHere();
    out.push(el('p', 'hb-say', $t('“Going further out? You’ll want a few things aboard.” Bert nods at the shelves by the door: cylinders, boxes, a crate of stores. “Strap them down, mind. Anything loose ends up in the scuppers the first time she heels.”')));
    const mine = C.items();
    if (mine.length) {
      out.push(el('h3', '', $t('Your things')));
      for (const it of mine) {
        const D = CARGO[it.id], kind = it.at.startsWith('boat:') ? it.at.slice(5) : null, lying = kind && here.some((h) => h.kind === kind);
        const used = !it.full && (it.id === 'cylinder' || it.id === 'battery');
        const row = el('div', 'cp-row');
        // (F1a: a stores crate says what's left in it; it's stocked with her lockers, Ready for a trip.)
        const left = it.id === 'stores' ? ` (${(it.days ?? 3) <= 0.01 ? 'empty' : $t`${Math.round((it.days ?? 3) * 2) / 2} of 3 days left`})` : '';
        row.append(el('p', '', `${D.name}${used ? (it.id === 'cylinder' ? ', breathed' : ', flat') : ''}${left}: ${kind ? $t`aboard the ${C.nameOf(kind)}${it.secured ? '' : $t(', loose')}` : $t('here, in Bert’s store room')}`));
        if (used && (!kind || lying)) row.append(this.button(it.id === 'cylinder' ? $t('Fill it (free)') : $t('Charge it (free)'), () => {
          C.renew(it.uid);
          this.hooks.toast(it.id === 'cylinder' ? $t('Bert fills the cylinder from the compressor: full again.') : $t('Bert swaps it for one off the charger: charged.'), 3);
          this.hooks.changed();
          this.render();
        }, 'quiet'));
        if (!kind) for (const h of here) row.append(this.button($t`Aboard the ${h.name}`, () => {
          const r = C.aboard(it.uid, h.kind);
          this.hooks.toast(r.ok ? $t`The ${D.short} goes aboard the ${h.name}, strapped down on her deck.` : r.why, 4);
          if (r.ok) this.hooks.changed();
          this.render();
        }, 'quiet'));
        if (kind && lying) row.append(this.button($t('Bring it ashore'), () => {
          const r = C.ashore(it.uid);
          if (r.ok) this.hooks.changed();
          this.render();
        }, 'quiet'));
        out.push(row);
      }
      if (!here.length) out.push(el('p', 'cp-soft', $t('To load or unload, bring a boat you can walk about (the RIB, the centre console or the yacht) into Willowhaven and stop.')));
    }
    out.push(el('h3', '', $t('On the shelves')));
    for (const id of CARGO_SOLD) {
      const D = CARGO[id], n = cargoOwned({ items: mine }, id), most = D.most || 1;
      const row = el('div', 'cp-row');
      row.append(el('p', '', $t`${D.name}, ${D.kg} kg. ${D.note}`), el('span', 'cp-soft', n >= most ? (most > 1 ? `you’ve ${n}` : 'yours') : money(D.price)));
      const b = this.button($t('Buy it'), () => {
        if (cargoOwned({ items: C.items() }, id) >= most || !this.pay(D.price)) return;
        const r = C.buy(id);
        this.hooks.toast(r.ok ? $t`The ${D.short} is yours: Bert keeps it here till you put it aboard.` : r.why, 4);
        this.hooks.changed();
        this.render();
      });
      b.disabled = n >= most;
      row.append(b);
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t('On her deck, walk to a thing (off the helm) to pick it up, move it, strap it down or let it go. Strapped, it stays put; loose, it slides when she heels, lurches or turns hard, and its weight goes with it. The jerry can goes aboard from your backpack.')));
    return out;
  }

  renderMend() {
    const out = [];
    out.push(el('p', 'hb-say', $t('“Let’s have a look at your lines, then.” Bert runs each one through his fingers, feeling for the rough bits.')));
    for (const r of this.hooks.rods()) {
      const w = wearOf(this.state, r.id);
      const row = el('div', 'cp-row');
      row.append(el('p', '', `${r.name}: ${r.line.name}`), el('span', 'cp-soft', `${wearWords(w)}${w >= 0.25 ? ` (${Math.round(w * 20)}% weaker)` : ''}`));
      if (w > 0.05) {
        const price = respoolPrice(r.line);
        row.append(this.button($t`Fresh line: ${money(price)}`, () => {
          if (!this.pay(price)) return;
          delete this.shop.wear[r.id];
          this.hooks.toast($t`Bert strips off the old line and winds on new ${r.line.name}, humming. Good as new.`, 5);
          this.hooks.changed();
          this.render();
        }));
      }
      out.push(row);
    }
    out.push(el('p', 'cp-soft', $t('Line wears in long, hard fights: a frayed line is a little weaker (never by more than a fifth). Fresh line puts it right.')));
    return out;
  }

  renderReady() {
    const out = [];
    out.push(el('p', 'hb-say', $t('“Going out, are you? Let’s see you’ve got what you need.”')));
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
  ctx.fillText($t('Today'), w / 2, 46);
  ctx.font = '600 22px Kalam, Caveat, cursive';
  ctx.fillText(`day ${day}`, w / 2, 72);
  ctx.textAlign = 'left';
  ctx.font = '700 24px Kalam, Caveat, cursive';
  ctx.fillText($t('Wanted:'), 22, 112);
  ctx.font = '600 24px Kalam, Caveat, cursive';
  wanted.forEach((n, i) => ctx.fillText(`· ${n}`, 30, 142 + i * 30));
  ctx.font = '700 24px Kalam, Caveat, cursive';
  ctx.fillText($t('Plenty of:'), 22, 222);
  ctx.font = '600 24px Kalam, Caveat, cursive';
  plenty.forEach((n, i) => ctx.fillText(`· ${n}`, 30, 252 + i * 30));
  ctx.font = '600 18px Kalam, Caveat, cursive';
  ctx.textAlign = 'center';
  ctx.fillText($t`open ${MARKET_HOURS[0]} am till ${MARKET_HOURS[1] - 12} pm`, w / 2, h - 18);
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
  ctx.fillText($t('Kitchen wants'), w / 2, 36);
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
  ctx.fillText(closed ? $t('kitchen closed') : $t`by ${ORDERS_BY - 12} pm · paid well`, w / 2, h - 16);
}
