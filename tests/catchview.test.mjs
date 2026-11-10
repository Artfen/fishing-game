// A closer look at the catch, and fish that swim like fish (src/inspect.js, src/world/fishRender.js,
// the swim in src/anatomy.js and src/fish.js): the catch card's Look closer, the species' model to
// turn over, the fish against its kind and your best, how to tell it and what it's taken for; and
// in the water, bodies that curve into a turn, burst and glide, flinch away in a C when startled,
// and thrash on the line. Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class FakeEl {
  constructor(tag) { Object.assign(this, { tag, children: [], className: '', textContent: '', hidden: true, style: {}, listeners: {} }); }
  addEventListener(k, f) { (this.listeners[k] ??= []).push(f); }
  append(...c) { this.children.push(...c); }
  replaceChildren(...c) { this.children = c; }
  setAttribute() {}
  click() { for (const f of this.listeners.click || []) f({}); }
  getContext() { return ctx2d; }
}
const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
const byId = new Map();
globalThis.document = { createElement: (t) => new FakeEl(t), getElementById: (id) => (byId.has(id) ? byId.get(id) : byId.set(id, new FakeEl('div')).get(id)), fonts: null };
const text = (e) => [e.textContent, ...(e.children || []).map((c) => (c instanceof FakeEl ? text(c) : ''))].join('\n');

const { fishById, buildFishMesh } = await import('../src/fish.js');
const { swimStyle, swimStep } = await import('../src/world/fishRender.js');
const { inspectFacts, CatchInspector } = await import('../src/inspect.js');

test('each kind swims its own way: the tunas and mackerels steadily, bass and bream in bursts, flatfish and octopus with no bend', () => {
  for (const id of ['tuna', 'mackerel', 'bonito', 'eel', 'blueshark', 'sprat']) assert.equal(swimStyle(fishById[id]), 'steady', id);
  for (const id of ['seabass', 'gilthead', 'wrasse', 'pollack']) assert.equal(swimStyle(fishById[id]), 'burst', id);
  for (const id of ['plaice', 'turbot', 'octopus', 'squid', 'thornback']) assert.equal(swimStyle(fishById[id]), 'ripple', id);
});

test('turning curves the whole body into the turn; a fright throws a sharp C-bend away; hooked, it thrashes', () => {
  const run = (f, style, secs, dt = 1 / 60) => {
    let out;
    for (let i = 0; i < secs / dt; i++) out = swimStep(f, style, dt, () => 0.5);
    return out;
  };
  // Turning one way, then the other: the bend follows, the right way round (toward the inside).
  const f = { state: 'cruise', beat: 0.5, turnRate: 2, phase: 0 };
  assert.ok(run(f, 'steady', 0.5).bend > 0.2);
  f.turnRate = -2;
  assert.ok(run(f, 'steady', 0.5).bend < -0.2);
  f.turnRate = 0;
  assert.ok(Math.abs(run(f, 'steady', 1).bend) < 0.02, 'straight again');
  // A flatfish doesn't bend.
  assert.equal(run({ state: 'cruise', beat: 0.5, turnRate: 3, phase: 0 }, 'ripple', 0.5).bend, 0);
  // Startled: a sharp bend at once, beating flat out, then straightening as it bolts.
  const g = { state: 'cruise', beat: 0.4, turnRate: 0.5, phase: 0 };
  run(g, 'burst', 0.2);
  g.state = 'flee';
  const c = run(g, 'burst', 0.15);
  assert.ok(Math.abs(c.bend) > 0.5 && c.beat === 1, `C-bend ${c.bend.toFixed(2)}`);
  assert.ok(Math.abs(run(g, 'burst', 1).bend) < 0.2, 'and away');
  // Hooked: the bend swings from side to side.
  const h = { state: 'hooked', beat: 1, turnRate: 0, phase: 0 };
  let lo = 0, hi = 0;
  for (let i = 0; i < 240; i++) {
    const s = swimStep(h, 'steady', 1 / 60);
    lo = Math.min(lo, s.bend);
    hi = Math.max(hi, s.bend);
  }
  assert.ok(lo < -0.15 && hi > 0.15, `${lo.toFixed(2)} … ${hi.toFixed(2)}`);
});

test('cruising bass burst and glide, the tail still between; a tuna never stops beating', () => {
  const look = (style) => {
    const f = { state: 'cruise', beat: 0.4, turnRate: 0, phase: 0 };
    const beats = [];
    let rnd = 0;
    for (let i = 0; i < 600; i++) beats.push(swimStep(f, style, 1 / 60, () => (rnd = (rnd + 0.37) % 1)).beat);
    return { lo: Math.min(...beats), hi: Math.max(...beats) };
  };
  const bass = look('burst'), tuna = look('steady');
  assert.ok(bass.lo < 0.15 && bass.hi > 0.6, `bass ${bass.lo.toFixed(2)} … ${bass.hi.toFixed(2)}`);
  assert.equal(tuna.lo, tuna.hi, 'steady');
  // (Chasing, or with a fish on, nobody glides.)
  const chase = { state: 'lunge', beat: 0.4, turnRate: 0, phase: 0 };
  for (let i = 0; i < 300; i++) assert.equal(swimStep(chase, 'burst', 1 / 60).beat, 0.4);
  // A single fish (hooked, landed, held up) can bend too.
  const m = buildFishMesh(fishById.seabass);
  assert.ok(m.userData.bend && 'value' in m.userData.bend);
});

test('a closer look: the fish against its kind and your best, how to tell it, what it’s taken for', () => {
  const sp = fishById.seabass;
  const F = inspectFacts(sp, 62, { best: 55, condition: 'fat and deep-bodied' });
  assert.equal(F.sci, 'Dicentrarchus labrax');
  assert.equal(F.family, 'Moronidae');
  assert.ok(F.orderOpen, 'the perch-like branch, its orders open');
  assert.equal(F.iucn, 'NT');
  assert.ok(F.marks.length >= 3 && F.similar.length >= 1, 'from the register');
  assert.ok(F.pos > 0.6 && F.pos < 0.8);
  assert.match(F.bestWords, /biggest yet/);
  assert.match(inspectFacts(sp, 40, { best: 55 }).bestWords, /Your best: 55 cm/);
  assert.match(inspectFacts(sp, 40).bestWords, /first/i);
  assert.match(inspectFacts(sp, sp.size[1]).sizeWords, /big as they come/);
  assert.equal(inspectFacts(fishById.squid, 30).unit, 'cm mantle');
  // A fish with no register entry: still a name and a size, its note for how to tell it.
  const P = inspectFacts(fishById.parrotfish, 35);
  assert.equal(P.sci, 'Sparisoma cretense');
  assert.equal(P.marks.length, 0);
});

test('the Look closer panel: opened with the fish’s words, the sizes, the marks; closed again', () => {
  let closed = 0;
  const I = new CatchInspector({ onClose: () => closed++ });
  I.open(fishById.seabass, 62, { best: 55, condition: 'fat and deep-bodied' });
  assert.equal(I.isOpen, true);
  assert.equal(byId.get('in-name').textContent, 'European Seabass');
  assert.match(byId.get('in-tax').textContent, /Moronidae/);
  assert.match(byId.get('in-tax').textContent, /perch-like/);
  assert.match(text(byId.get('in-size')), /62 cm/);
  assert.match(text(byId.get('in-size')), /Your biggest yet/);
  assert.ok(byId.get('in-marks').children.length >= 3);
  assert.equal(byId.get('in-similar-h').hidden, false);
  // Turned and zoomed: the view moves, and stops turning by itself.
  const y0 = I.view.yaw;
  I.turn(50, 0);
  assert.ok(I.view.yaw > y0 && !I.spin);
  I.zoomBy(10);
  assert.ok(I.view.zoom <= 3.2);
  byId.get('in-back').click();
  assert.equal(closed, 1);
  I.close();
  assert.equal(I.isOpen, false);
  // A fish with nothing in the register to compare it with: its note, and no look-alikes heading.
  I.open(fishById.parrotfish, 35);
  assert.equal(byId.get('in-marks').children.length, 1);
  assert.equal(byId.get('in-similar-h').hidden, true);
});
