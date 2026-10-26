import { fishById } from './fish.js';
import { formatClock } from './world/sky.js';
import { MARKET_HOURS, ORDERS_BY, demandFor, fishValue, ordersFor, fills, money } from './market.js';
import { nextStory, adviceFor, rumoursNow, lower, an } from './innTalk.js';
import { CHALLENGES } from './daybook.js';
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
    $('hb-close').addEventListener('click', () => hooks.close());
    this.el.addEventListener('click', (e) => { if (e.target === this.el) hooks.close(); });
  }

  get isOpen() { return !this.el.hidden; }
  get place() { return this.where === 'muelle' ? 'muelle' : 'haven'; }
  get harbour() {
    this.state.harbour ??= { heard: { haven: [], muelle: [] }, filled: [], earned: 0, sold: 0, served: 0 };
    return this.state.harbour;
  }
  get marketOpen() {
    if (this.where === 'muelle') return true;
    return this.state.hour >= MARKET_HOURS[0] && this.state.hour < MARKET_HOURS[1];
  }

  open(where) {
    this.where = where;
    this.said = { advice: null, story: null };
    this.tab = where === 'market' ? 'sell' : where === 'chandlery' ? 'counter' : 'bar';
    this.el.hidden = false;
    this.render();
  }

  close() {
    this.el.hidden = true;
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

  pay(v) {
    if (this.state.money < v - 1e-6) {
      this.hooks.toast(`That’s ${money(v)}, and you’ve only ${money(this.state.money)} in your purse. Sell a fish or two at the market first.`, 5);
      return false;
    }
    this.state.money = Math.round((this.state.money - v) * 100) / 100;
    return true;
  }
  earn(v) {
    this.state.money = Math.round((this.state.money + v) * 100) / 100;
    this.harbour.earned = Math.round((this.harbour.earned + v) * 100) / 100;
  }

  render() {
    if (!this.isOpen) return;
    const W = this.where;
    $('hb-title').textContent = W === 'market' ? 'The fish market' : W === 'inn' ? 'The Lobster Pot' : W === 'chandlery' ? 'The chandlery' : 'Bar El Muelle';
    $('hb-sub').textContent = `${formatClock(this.state.hour)} · day ${this.state.day} · ${W === 'muelle' ? 'Puerto Brasa' : 'Willowhaven'}`;
    $('hb-purse').textContent = `In your purse: ${money(this.state.money)}`;
    const tabs = W === 'market' ? [] : W === 'inn' ? [['bar', 'The bar'], ['kitchen', 'The kitchen']] : W === 'chandlery' ? [['counter', 'The counter'], ['mend', 'Mending'], ['ready', 'Ready for a trip']] : [['bar', 'The bar'], ['kitchen', 'The kitchen'], ['sell', 'Sell to Paco']];
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
    const body = this.tab === 'sell' ? this.renderSell() : this.tab === 'kitchen' ? this.renderKitchen() : this.tab === 'counter' ? this.renderCounter() : this.tab === 'mend' ? this.renderMend() : this.tab === 'ready' ? this.renderReady() : this.renderBar();
    $('hb-body').replaceChildren(...body);
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
        const tags = [kgWords(g.kg), OLD(fresh), v.demand === 'wanted' ? 'wanted today' : v.demand === 'plenty' ? 'plenty about' : ''].filter(Boolean).join(' · ');
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
    out.push(el('p', 'cp-soft', 'Fish fetch their best fresh: within half a day of the catch. After that the price slips, a little more each day. A camp’s cool box keeps them on ice.'));
    return out;
  }

  sell(i, quiet = false) {
    const f = this.state.keep[i];
    if (!f || f.cooked || !this.marketOpen) return 0;
    const v = fishValue(f, { day: this.state.day, now: this.hooks.now(), place: this.place });
    if (!v.wanted) return 0;
    this.state.keep.splice(i, 1);
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
    const early = this.state.hour < 6, late = this.state.hour >= ORDERS_BY;
    out.push(el('p', 'hb-say', place === 'haven'
      ? 'Ruth Alder runs the kitchen as well as the bar. She buys her fish from whoever brings in the best of it, and she pays well for what she’s after.'
      : 'Paco’s mother cooks, in a kitchen the size of a cupboard. What goes on the menu depends on what the boats bring in.'));
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
        if (i >= 0) row.append(this.button(`Bring your ${this.state.keep[i].size} cm one`, () => this.fill(o)));
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
    const f = this.state.keep.splice(i, 1)[0];
    this.harbour.filled.push(o.key);
    if (this.harbour.filled.length > 24) this.harbour.filled.splice(0, this.harbour.filled.length - 24);
    this.harbour.served++;
    this.earn(o.reward);
    this.hooks.sold(f.logId);
    this.hooks.chime();
    const sp = fishById[f.id];
    this.hooks.toast(this.place === 'haven'
      ? `Ruth holds up the ${lower(sp.name)} to the light. “Now that’s a fish.” ${money(o.reward)} into your purse, and it’s on the board tonight.`
      : `Paco shouts into the kitchen, and his mother comes out to see the ${lower(sp.name)}. ${money(o.reward)} into your purse.`, 6);
    this.hooks.changed();
    this.render();
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
