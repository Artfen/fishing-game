// Keys after a panel closes (found playing the brief's Part J day through, tools/playthrough.mjs):
// a question answered with the mouse (or by a script clicking its button) closed with the keys'
// focus still on its button. The browser keeps it there, hidden; the next Space went to that
// button, was taken for the closed panel's, and lost: under water, the photograph not taken. Now a
// key counts as a panel's only while the panel's showing, and a panel that closes takes the focus
// with it (src/input.js). Run with `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';

// Just enough of a page: elements in a tree, a dialog with a button in it, the focus, and the
// watcher a panel's closing is seen by.
class El {
  constructor({ tag = 'DIV', role = null, parent = null } = {}) {
    this.tagName = tag;
    this.role = role;
    this.parent = parent;
    this.hidden = false;
  }
  closest(sel) {
    for (let e = this; e; e = e.parent) {
      if (sel.includes('role=') && (e.role === 'dialog' || e.role === 'alertdialog')) return e;
      if (sel === '[hidden]' && e.hidden) return e;
      if (sel.startsWith('input') && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.tagName)) return e;
    }
    return null;
  }
  contains(a) {
    for (let e = a; e; e = e.parent) if (e === this) return true;
    return false;
  }
  blur() { if (globalThis.document.activeElement === this) globalThis.document.activeElement = globalThis.document.body; }
}
const keydown = [], keyup = [];
let watcher = null;
globalThis.Element = El;
globalThis.matchMedia = () => ({ matches: false });
globalThis.navigator ??= {};
globalThis.addEventListener = (k, f) => { if (k === 'keydown') keydown.push(f); if (k === 'keyup') keyup.push(f); };
globalThis.MutationObserver = class { constructor(cb) { watcher = cb; } observe() {} };
const body = new El({ tag: 'BODY' });
const dialog = new El({ role: 'alertdialog', parent: body });
const button = new El({ tag: 'BUTTON', parent: dialog });
globalThis.document = { body, activeElement: button, querySelectorAll: () => [dialog] };

const { Input } = await import('../src/input.js');
const canvas = { addEventListener() {}, setPointerCapture() {}, classList: { add() {}, remove() {} } };
const I = new Input(canvas);
const pressed = [];
I.on('press', (code) => pressed.push(code));
const key = (code, target) => {
  const e = { code, target, isTrusted: false, repeat: false, preventDefault() {} };
  for (const f of keydown) f(e);
  for (const f of keyup) f(e);
};

test('a key on a panel’s button is the panel’s while it shows; once it’s closed, the game’s', () => {
  dialog.hidden = false;
  key('Space', button);
  assert.deepEqual(pressed, [], 'Space presses the button of a question that’s up');
  // (Answered with the mouse: closed, the focus still on its button.)
  dialog.hidden = true;
  key('Space', button);
  assert.deepEqual(pressed, ['Space'], 'and casts, or takes the photograph, once it’s gone');
  // (Inside a hidden parent, as the journal's book is, it doesn't count either.)
  pressed.length = 0;
  dialog.hidden = false;
  body.hidden = true;
  key('Enter', button);
  assert.deepEqual(pressed, ['Enter']);
  body.hidden = false;
});

test('a panel that closes with the focus in it takes the focus with it', () => {
  assert.ok(watcher, 'panels’ closing is watched');
  globalThis.document.activeElement = button;
  dialog.hidden = true;
  watcher([{ target: dialog }]);
  assert.equal(globalThis.document.activeElement, body, 'the focus left the closed panel');
  // (Something else closing leaves the focus where it is.)
  const other = new El({ parent: body }), box = new El({ tag: 'INPUT', parent: body });
  globalThis.document.activeElement = box;
  other.hidden = true;
  watcher([{ target: other }]);
  assert.equal(globalThis.document.activeElement, box);
});
