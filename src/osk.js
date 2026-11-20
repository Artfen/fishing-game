// An on-screen keyboard (docs/HUMAN-TOUCH.md, H2): typing with a controller alone. Your name, a
// session code to join a friend (a digit pad), a gift code, a photograph's or a mark's title.
// Opened with the confirm button on a text box (gamepad.js menu); the D-pad or the stick moves
// round its keys, the confirm button types one, the back button deletes, the top button changes
// case (and on to the accented letters Spanish and French need), the left button types a space,
// Options (Menu) is done. With a mouse or a finger it works as it looks.
//
// What it types goes into the text box as you go (its input event each time), so a box that
// keeps a draft or checks itself as you type does so; done puts the focus back on it, or on its
// form's button (Join, Save) when it has one, ready to press.
import { $t } from './i18n.js';

const ROWS = {
  lower: ['1234567890', 'qwertyuiop', 'asdfghjkl\'', 'zxcvbnm,.-'],
  upper: ['1234567890', 'QWERTYUIOP', 'ASDFGHJKL\'', 'ZXCVBNM,.-'],
  accents: ['áéíóúñüç¿¡', 'àèìòùâêîôû', 'ÁÉÍÓÚÑÜÇ«»', 'ÀÈÌÒÙëïœ’&'],
  digits: ['123', '456', '789'],
};
const NEXT = { lower: 'upper', upper: 'accents', accents: 'lower' };

export class OnScreenKeyboard {
  constructor(doc = globalThis.document) {
    this.doc = doc;
    this.target = null;
    this.layer = 'lower';
    const el = (tag, cls, text) => {
      const e = doc.createElement(tag);
      if (cls) e.className = cls;
      if (text != null) e.textContent = text;
      return e;
    };
    this.el = el;
    this.root = el('div', 'osk');
    this.root.id = 'osk';
    this.root.setAttribute('role', 'dialog');
    this.root.setAttribute('aria-modal', 'true');
    this.root.setAttribute('aria-label', $t('Keyboard'));
    this.root.hidden = true;
    this.shown = el('div', 'osk-shown');
    this.shown.setAttribute('aria-live', 'polite');
    this.keys = el('div', 'osk-keys');
    this.hint = el('p', 'osk-hint');
    this.root.append(this.shown, this.keys, this.hint);
    doc.body.append(this.root);
  }

  get isOpen() { return !this.root.hidden; }

  // Type into a text box (an input or a textarea). hint: how its buttons work, for the line under.
  open(input, hint = '') {
    this.target = input;
    this.digits = input.inputMode === 'numeric' || input.dataset?.osk === 'digits';
    this.layer = this.digits ? 'digits' : 'lower';
    this.hint.textContent = hint;
    this.root.hidden = false;
    this.draw();
    this.show();
    this.keys.querySelector('button')?.focus();
  }

  draw() {
    const el = this.el, B = (text, run, cls = '', label = null) => {
      const b = el('button', `osk-key ${cls}`.trim(), text);
      b.type = 'button';
      if (label) b.setAttribute('aria-label', label);
      b.addEventListener('click', run);
      return b;
    };
    this.keys.replaceChildren();
    this.keys.classList.toggle('osk-pad', this.digits);
    for (const row of ROWS[this.layer]) {
      const r = el('div', 'osk-row');
      for (const ch of row) r.append(B(ch, () => this.type(ch)));
      this.keys.append(r);
    }
    const r = el('div', 'osk-row osk-acts');
    if (this.digits) r.append(B('⌫', () => this.back(), 'osk-wide', $t('Delete')), B('0', () => this.type('0')), B($t('Done'), () => this.done(), 'osk-wide osk-done'));
    else {
      r.append(
        B(this.layer === 'lower' ? '⇧' : this.layer === 'upper' ? 'àé' : 'abc', () => this.shift(), 'osk-wide', $t('Shift')),
        B($t('Space'), () => this.type(' '), 'osk-space'),
        B('⌫', () => this.back(), 'osk-wide', $t('Delete')),
        B($t('Done'), () => this.done(), 'osk-wide osk-done'),
      );
    }
    this.keys.append(r);
  }

  show() {
    const v = this.target?.value ?? '';
    this.shown.textContent = v || this.target?.placeholder || '';
    this.shown.classList.toggle('osk-empty', !v);
  }

  // (As if typed: the box's own limit kept, its input event told.)
  set(v) {
    const I = this.target;
    if (!I) return;
    const max = I.maxLength > 0 ? I.maxLength : 200;
    I.value = v.slice(0, max);
    I.dispatchEvent(new Event('input', { bubbles: true }));
    this.show();
  }

  type(ch) {
    if (this.digits && !/\d/.test(ch)) return;
    this.set((this.target?.value ?? '') + ch);
    // (A capital, then back to small letters, as a phone does.)
    if (this.layer === 'upper') {
      this.layer = 'lower';
      this.redraw();
    }
  }

  back() {
    this.set((this.target?.value ?? '').slice(0, -1));
  }

  shift() {
    if (this.digits) return;
    this.layer = NEXT[this.layer];
    this.redraw();
  }

  // (Drawn again with the same key focused, where it was.)
  redraw() {
    const all = [...this.keys.querySelectorAll('button')], at = Math.max(0, all.indexOf(this.doc.activeElement));
    this.draw();
    const now = [...this.keys.querySelectorAll('button')];
    now[Math.min(at, now.length - 1)]?.focus();
  }

  // Finished: the box told (its change event), and the focus on what you'd press next: its form's
  // button, or the first button after it in its panel ("That's me", "Keep it", "Sign-write it"),
  // or back on the box. (Never the box when there's a button: A on it would only open the
  // keyboard again.)
  done() {
    const I = this.target;
    this.close();
    if (!I) return;
    I.dispatchEvent(new Event('change', { bubbles: true }));
    const go = I.form?.querySelector('button[type="submit"], button:not([type])') || nextButton(I);
    (go || I).focus();
  }

  close() {
    this.root.hidden = true;
    this.target = null;
  }

  // The controller's own buttons on it (gamepad.js): B deletes, Y shifts, X a space, Menu is done.
  // True if it took the button.
  button(name) {
    if (!this.isOpen) return false;
    if (name === 'B') this.back();
    else if (name === 'Y') this.shift();
    else if (name === 'X') this.type(' ');
    else if (name === 'MENU' || name === 'VIEW') this.done();
    else return false;
    return true;
  }
}

// The first button after a box in its panel (a dialog, or the page), that can be pressed.
function nextButton(I) {
  if (typeof I.compareDocumentPosition !== 'function') return null;
  const panel = I.closest?.('[role="dialog"], [role="alertdialog"]') || I.ownerDocument?.body;
  const FOLLOWING = 4;
  return [...(panel?.querySelectorAll('button') || [])].find((b) => (I.compareDocumentPosition(b) & FOLLOWING) && !b.disabled && !b.closest('[hidden]') && b.getClientRects().length > 0) || null;
}

// A text box the keyboard is for (not a checkbox, a range, a file).
export const isTextBox = (el) => !!el && (el.tagName === 'TEXTAREA' || (el.tagName === 'INPUT' && /^(text|search|email|url|tel|number|password|)$/.test(el.type || '')));
