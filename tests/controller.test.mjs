// Controller-first (docs/HUMAN-TOUCH.md, H2): the on-screen keyboard (typing a name, a session
// code, a mark's title with a controller alone) and the chart's right stick, triggers and X.
// Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// A small stand-in for the page: elements with children, buttons to focus and click.
class El {
  constructor(doc, tag) {
    this.doc = doc;
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.on = {};
    this.hidden = false;
    this.className = '';
    this.textContent = '';
    const cls = new Set();
    this.classList = { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) };
  }
  append(...k) { this.children.push(...k); }
  replaceChildren(...k) { this.children = k; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k] ?? null; }
  addEventListener(t, f) { (this.on[t] ||= []).push(f); }
  dispatchEvent(e) { for (const f of this.on[e.type] || []) f(e); return true; }
  focus() { this.doc.activeElement = this; }
  click() { this.dispatchEvent({ type: 'click' }); }
  all() { return this.children.flatMap((c) => [c, ...c.all()]); }
  querySelectorAll(sel) { return this.all().filter((c) => c.tagName === sel.toUpperCase()); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}
function page() {
  const doc = { activeElement: null };
  doc.createElement = (t) => new El(doc, t);
  doc.body = new El(doc, 'body');
  return doc;
}
// A text box (its events kept, so a test can see what it was told), in a form with a button.
function box(doc, props = {}) {
  const I = Object.assign(new El(doc, 'input'), { type: 'text', value: '', maxLength: -1, placeholder: '', inputMode: '', dataset: {} }, props);
  const told = [];
  const was = I.dispatchEvent.bind(I);
  I.dispatchEvent = (e) => { told.push(e.type); return was(e); };
  const go = new El(doc, 'button');
  go.textContent = 'Join';
  I.form = { querySelector: () => go };
  return { I, told, go };
}
const keyText = (osk) => osk.keys.querySelectorAll('button').map((b) => b.textContent);
const press = (osk, ch) => osk.keys.querySelectorAll('button').find((b) => b.textContent === ch).click();

const { OnScreenKeyboard, isTextBox } = await import('../src/osk.js');

test('the keyboard types into the box as you go, each key telling it (its input event), and keeps its limit', () => {
  const doc = page(), osk = new OnScreenKeyboard(doc), { I, told } = box(doc, { maxLength: 4, placeholder: 'Your name' });
  osk.open(I, 'hint');
  assert.ok(osk.isOpen);
  assert.equal(osk.shown.textContent, 'Your name', 'the box empty: its placeholder shown');
  assert.equal(doc.activeElement?.tagName, 'BUTTON', 'a key focused, for the D-pad to move from');
  for (const ch of 'skate') press(osk, ch);
  assert.equal(I.value, 'skat', 'four letters: the box\'s own limit');
  assert.equal(osk.shown.textContent, 'skat');
  assert.ok(told.filter((t) => t === 'input').length >= 4);
  osk.back();
  assert.equal(I.value, 'ska');
});

test('a capital, then small letters again; on round to the accents Spanish and French need', () => {
  const doc = page(), osk = new OnScreenKeyboard(doc), { I } = box(doc);
  osk.open(I);
  assert.ok(keyText(osk).includes('q'));
  osk.button('Y');
  assert.ok(keyText(osk).includes('Q'), 'Y: capitals');
  press(osk, 'M');
  assert.ok(keyText(osk).includes('q'), 'one capital, then back to small letters, as a phone does');
  osk.button('Y');
  osk.button('Y');
  for (const ch of ['ñ', 'é', 'ç', '¿']) assert.ok(keyText(osk).includes(ch), `the accents: ${ch}`);
  press(osk, 'ñ');
  osk.button('X');
  assert.equal(I.value, 'Mñ ', 'X a space');
  osk.button('Y');
  assert.ok(keyText(osk).includes('q'), 'and round to small letters');
});

test('a session code: a digit pad, and only digits', () => {
  const doc = page(), osk = new OnScreenKeyboard(doc), { I } = box(doc, { inputMode: 'numeric' });
  osk.open(I);
  const keys = keyText(osk);
  assert.ok(keys.includes('7') && keys.includes('0'));
  assert.ok(!keys.includes('q'), 'no letters on a digit pad');
  for (const ch of '1234') press(osk, ch);
  osk.type('x');
  osk.button('Y');
  assert.equal(I.value, '1234', 'a letter or a shift does nothing to a code');
  assert.ok(keyText(osk).includes('7'), 'still the digit pad');
});

test('done: the box told it changed, the keyboard gone, the focus on its form\'s button (Join, Save) ready to press', () => {
  const doc = page(), osk = new OnScreenKeyboard(doc), { I, told, go } = box(doc);
  osk.open(I);
  press(osk, 'a');
  assert.equal(osk.button('MENU'), true);
  assert.ok(!osk.isOpen);
  assert.ok(told.includes('change'));
  assert.equal(doc.activeElement, go);
  // (A box without a form: the focus back on the box.)
  const lone = box(doc).I;
  lone.form = null;
  osk.open(lone);
  osk.done();
  assert.equal(doc.activeElement, lone);
  // Closed, it takes no buttons (the menu's B is the menu's again).
  assert.equal(osk.button('B'), false);
});

test('the keyboard is for text boxes, not checkboxes or sliders', () => {
  assert.ok(isTextBox({ tagName: 'INPUT', type: 'text' }));
  assert.ok(isTextBox({ tagName: 'INPUT', type: '' }));
  assert.ok(isTextBox({ tagName: 'TEXTAREA' }));
  assert.ok(!isTextBox({ tagName: 'INPUT', type: 'checkbox' }));
  assert.ok(!isTextBox({ tagName: 'INPUT', type: 'range' }));
  assert.ok(!isTextBox({ tagName: 'BUTTON' }));
  assert.ok(!isTextBox(null));
});

// The chart's methods, on a stand-in for the chart (its view, its marks, its route being planned).
const { MapSheet } = await import('../src/map.js');
function chart(extra = {}) {
  const m = Object.create(MapSheet.prototype);
  Object.assign(m, {
    el: { hidden: false }, dpr: 1, fitZoom: 0.5, canvas: { width: 800, height: 600 }, view: { x: 100, z: 200, zoom: 1 },
    state: { pins: [] }, plan: [], planning: false, marking: false, drawn: 0, added: [], edited: null,
    S: { x: -5000, z: -5000, w: 10000, h: 10000 },
    draw() { this.drawn++; }, renderPlan() {}, addPin(x, z) { this.added.push([x, z]); }, editPin(p) { this.edited = p; },
  }, extra);
  return m;
}

test('the chart with a controller: the right stick moves it (further when zoomed out), the triggers zoom it', () => {
  const m = chart();
  m.stick(1, 0, 0, 0.5);
  assert.ok(m.view.x > 100 + 100 && m.view.z === 200, `east: ${m.view.x}`);
  assert.ok(m.padAim, 'the crosshair shown');
  const near = chart({ view: { x: 100, z: 200, zoom: 4 } });
  near.stick(0, 1, 0, 0.5);
  assert.ok(near.view.z - 200 < (m.view.x - 100) / 2, 'zoomed in, the same push moves it less of the world');
  const z = chart();
  z.stick(0, 0, 1, 0.5);
  assert.ok(z.view.zoom > 1.5, `RT: in (${z.view.zoom})`);
  z.stick(0, 0, -1, 0.5);
  assert.ok(Math.abs(z.view.zoom - 1) < 1e-9, 'LT: out again, as far');
  const still = chart();
  still.stick(0, 0, 0, 0.5);
  assert.equal(still.drawn, 0, 'nothing pushed: nothing redrawn');
  assert.ok(!still.padAim);
});

test('X on the chart: a mark under the crosshair, a mark there edited, or the route\'s next point', () => {
  const m = chart();
  assert.equal(m.tapCentre(), true);
  assert.deepEqual(m.added, [[100, 200]], 'a new mark, at the middle of the chart');
  const pin = { x: 102, z: 201 };
  const on = chart({ state: { pins: [pin] } });
  on.tapCentre();
  assert.equal(on.edited, pin, 'on a mark: edit it');
  assert.equal(on.added.length, 0);
  const plan = chart({ planning: true, state: { pins: [pin] } });
  plan.tapCentre();
  assert.deepEqual(plan.plan, [[100, 200]], 'planning: the route\'s next point');
  assert.equal(plan.edited, null);
  assert.equal(chart({ el: { hidden: true } }).tapCentre(), false, 'shut: nothing');
});

// The controller guide: each button it names does what it says while you play, named as printed.
const { GUIDE, guideRows, printed } = await import('../src/padguide.js');
const { MAPS } = await import('../src/gamepad.js');

test('the controller guide says what each button really does as you play', () => {
  const seen = new Set();
  for (const [b, side, action, words] of GUIDE()) {
    assert.ok(side === 'l' || side === 'r');
    assert.ok(words && words.length < 70, `${b}: a few words, not a paragraph`);
    assert.ok(!seen.has(b), `${b} once`);
    seen.add(b);
    if (action) assert.equal(MAPS.play[b], action, `${b} does ${action} while you play`);
  }
  // Every button that does something as you play is in it (the sticks' presses with the sticks,
  // the D-pad's four in one line).
  for (const [b, action] of Object.entries(MAPS.play)) {
    if (!action || ['L3', 'R3', 'UP', 'DOWN', 'LEFT', 'RIGHT'].includes(b)) continue;
    assert.ok(seen.has(b), `${b} (${action}) is in the guide`);
  }
});

test('the guide names the buttons as printed on the controller in hand', () => {
  assert.equal(printed('A', 'playstation'), '✕');
  assert.equal(printed('RT', 'playstation'), 'R2');
  assert.equal(printed('MENU', 'playstation'), 'Options');
  assert.equal(printed('A', 'nintendo'), 'B', 'a Nintendo controller\'s bottom button is its B');
  assert.equal(printed('RT', 'xbox'), 'RT');
  assert.equal(printed('L-stick', 'playstation'), 'L-stick');
  const [left, right] = guideRows('playstation');
  assert.ok(left.some((r) => r.key === 'L2') && right.some((r) => r.key === '✕'));
  assert.equal(left.length + right.length, GUIDE().length);
});

// Settings at a glance: a row's line split after its first sentence, the rest shown on the row
// you're on (style.css .st-more).
const { splitLead } = await import('../src/settings.js');

test('a setting\'s line: its first sentence, then the rest, in any of the languages', () => {
  assert.deepEqual(splitLead('Hold to reel at your chosen speed, tap to twitch. The rod looks after itself.'), ['Hold to reel at your chosen speed, tap to twitch.', 'The rod looks after itself.']);
  assert.deepEqual(splitLead('One sentence only.'), ['One sentence only.', '']);
  assert.deepEqual(splitLead('A 9.9 hp outboard, 0.21 litres. Fitted while you wait.')[1], 'Fitted while you wait.', 'a decimal point isn\'t a full stop');
  assert.deepEqual(splitLead('¿Te gusta? Cámbialo cuando quieras.'), ['¿Te gusta?', 'Cámbialo cuando quieras.']);
  assert.deepEqual(splitLead('Il dit « Prêt ? » Oui, prêt.'), ['Il dit « Prêt ? »', 'Oui, prêt.'], 'French: the space before ? and inside « »');
  assert.deepEqual(splitLead('She said “go.” Then went.'), ['She said “go.”', 'Then went.']);
  assert.deepEqual(splitLead(''), ['', '']);
});
