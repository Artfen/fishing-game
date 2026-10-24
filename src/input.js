// Every key the game listens to is an action bound to physical key positions (e.code), so
// the controls sit in the same place on any keyboard layout (WASD is ZQSD on AZERTY), and
// players can rebind them in Settings. Labels show the letter printed on the player's keyboard.
// A game controller (see gamepad.js) and the touch controls press the same actions; whichever
// you used last is `method` ('keys', 'pad' or 'touch'), and the hints follow it.
const BLOCK = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
const UI_KEYS = new Set(['Space', 'Enter', 'NumpadEnter', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End']);

// The actions, their default keys and how Settings describes them. The first key is the one
// shown in hints and changed by rebinding; any others are extra ways in (the arrow keys).
export const ACTIONS = [
  { id: 'forward', label: 'Row / walk forward · throttle up a notch · bait shallower or reel faster', keys: ['KeyW', 'ArrowUp'], group: 'Moving' },
  { id: 'back', label: 'Row back / walk back · throttle down a notch · bait deeper or reel slower', keys: ['KeyS', 'ArrowDown'], group: 'Moving' },
  { id: 'left', label: 'Turn or step left · aim the cast left', keys: ['KeyA', 'ArrowLeft'], group: 'Moving' },
  { id: 'right', label: 'Turn or step right · aim the cast right', keys: ['KeyD', 'ArrowRight'], group: 'Moving' },
  { id: 'jog', label: 'Jog (hold, on foot)', keys: ['ShiftLeft', 'ShiftRight'], group: 'Moving' },
  { id: 'cast', label: 'Cast (hold to aim, let go to cast) · strike · reel', keys: ['Space'], group: 'Fishing' },
  { id: 'cancel', label: 'Cancel a cast · reel in · back out', keys: ['Escape'], group: 'Fishing', fixed: true },
  { id: 'tackle', label: 'Next bait, lure or fly', keys: ['KeyQ'], group: 'Fishing' },
  { id: 'rod1', label: 'First rod', keys: ['Digit1'], group: 'Fishing' },
  { id: 'rod2', label: 'Second rod', keys: ['Digit2'], group: 'Fishing' },
  { id: 'feed', label: 'Throw loose bait (bottom fishing)', keys: ['KeyG'], group: 'Fishing' },
  { id: 'keep', label: 'Keep a fish (on the catch card)', keys: ['KeyK'], group: 'Fishing' },
  { id: 'advice', label: 'Why aren’t they biting? (what the field guide makes of your rig)', keys: ['KeyY'], group: 'Fishing' },
  { id: 'interact', label: 'Step ashore · board · camp · look closer', keys: ['KeyE'], group: 'Around' },
  { id: 'rest', label: 'Let time drift (hold)', keys: ['KeyT'], group: 'Around' },
  { id: 'anchor', label: 'Drop or raise the anchor', keys: ['KeyZ'], group: 'Boats' },
  { id: 'neutral', label: 'Motor to neutral (stop)', keys: ['KeyX'], group: 'Boats' },
  { id: 'throttleUp', label: 'Throttle up a notch (also with a line out)', keys: ['Equal', 'NumpadAdd'], group: 'Boats' },
  { id: 'throttleDown', label: 'Throttle down a notch (also with a line out)', keys: ['Minus', 'NumpadSubtract'], group: 'Boats' },
  { id: 'motor', label: 'Kayak: lower or raise the electric motor', keys: ['KeyU'], group: 'Boats' },
  { id: 'view', label: 'Next view (first person, underwater, your bait)', keys: ['KeyC'], group: 'Views' },
  { id: 'eye', label: 'First person on or off', keys: ['KeyV'], group: 'Views' },
  { id: 'reset', label: 'Reset the camera', keys: ['KeyR'], group: 'Views' },
  { id: 'photo', label: 'Take a photograph (photo mode; on a catch card, a picture of your fish)', keys: ['KeyP'], group: 'Views' },
  { id: 'pack', label: 'Backpack', keys: ['KeyB', 'KeyI'], group: 'Panels' },
  { id: 'finder', label: 'Fish finder', keys: ['KeyF'], group: 'Panels' },
  { id: 'conditions', label: 'Wind, current and sea panel', keys: ['KeyN'], group: 'Panels' },
  { id: 'map', label: 'Map', keys: ['KeyM'], group: 'Panels' },
  { id: 'journal', label: 'Journal', keys: ['KeyJ', 'Tab'], group: 'Panels' },
  { id: 'settings', label: 'Settings', keys: ['KeyO'], group: 'Panels' },
  { id: 'hide', label: 'Hide the interface', keys: ['KeyH'], group: 'Panels' },
];
export const ACTION_BY_ID = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
export const defaultBindings = () => Object.fromEntries(ACTIONS.map((a) => [a.id, [...a.keys]]));

const NAMES = {
  Space: 'Space', Escape: 'Esc', Tab: 'Tab', Enter: 'Enter', ShiftLeft: 'Shift', ShiftRight: 'Shift',
  ControlLeft: 'Ctrl', ControlRight: 'Ctrl', AltLeft: 'Alt', AltRight: 'Alt', Backspace: '⌫',
  ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Comma: ',', Period: '.', Slash: '/',
  Semicolon: ';', Quote: '\'', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Minus: '−', Equal: '+', Backquote: '`',
  NumpadAdd: 'Num +', NumpadSubtract: 'Num −',
};
// A readable name for a key position, before the keyboard's own layout is known.
export function codeName(code) {
  if (NAMES[code]) return NAMES[code];
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code.startsWith('Numpad')) return `Num ${code.slice(6)}`;
  return code;
}

// Keep a saved set of bindings sensible: known actions, valid key codes, no key on two actions.
export function cleanBindings(raw) {
  const out = defaultBindings();
  if (!raw || typeof raw !== 'object') return out;
  const taken = new Map();
  for (const a of ACTIONS) {
    if (a.fixed) continue;
    const keys = Array.isArray(raw[a.id]) ? raw[a.id].filter((c) => typeof c === 'string' && /^[A-Za-z0-9]{2,20}$/.test(c)).slice(0, 3) : null;
    if (keys && keys.length) out[a.id] = keys;
  }
  for (const a of ACTIONS) {
    out[a.id] = out[a.id].filter((c) => {
      if (taken.has(c)) return false;
      taken.set(c, a.id);
      return true;
    });
    if (!out[a.id].length) out[a.id] = a.keys.filter((c) => !taken.has(c)).slice(0, 1);
    for (const c of out[a.id]) taken.set(c, a.id);
  }
  return out;
}

export class Input {
  constructor(canvas) {
    this.codes = new Set();
    this.handlers = { press: [], release: [], pointer: [], cancel: [] };
    this.drag = { dx: 0, dy: 0 };
    this.wheel = 0;
    this.pointers = new Map();
    this.pinch = 0;
    // The touch controls write here (see touch.js).
    this.virtual = { throttle: 0, steer: 0, rest: false };
    this.layout = null; // the letters printed on this keyboard, once known
    this.setBindings(defaultBindings());
    // Which controls you're using now, and what to call an action's button on a controller
    // (set by gamepad.js).
    this.method = matchMedia('(pointer: coarse)').matches ? 'touch' : 'keys';
    this.methodFns = [];
    this.padLabel = null;
    // While something else wants the keys (rebinding in Settings), the game ignores them.
    this.paused = false;

    // Typing in a text box or choosing from a list isn't steering the boat.
    const typing = (e) => e.target instanceof Element && e.target.closest('input, textarea, select') && e.code !== 'Escape';
    // In an open panel, the keys that move focus and press buttons belong to the panel (so Space
    // presses a button there instead of casting, and Tab and the arrows move between things).
    const inPanel = (e) => UI_KEYS.has(e.code) && ((e.target instanceof Element && e.target.closest('[role="dialog"]'))
      || (e.code === 'Tab' && document.querySelector('[role="dialog"]:not([hidden])')));
    addEventListener('keydown', (e) => {
      // (The arrow keys a controller sends round a menu are for the menu, not the game.)
      if (e.fromPad) return;
      if (e.isTrusted) this.use('keys');
      if (this.paused || typing(e) || inPanel(e)) return;
      if (BLOCK.has(e.code)) e.preventDefault();
      if (e.repeat) return;
      this.codes.add(e.code);
      this.emit('press', e.code, this.actionsOf(e.code));
    });
    addEventListener('keyup', (e) => {
      if (!this.codes.has(e.code)) return;
      this.codes.delete(e.code);
      this.emit('release', e.code, this.actionsOf(e.code));
    });
    addEventListener('blur', () => this.releaseAll());

    // One pointer drags the view; two pointers pinch to zoom. The right mouse button
    // never drags: it cancels (a cast being aimed, or the line in the water).
    // (Any touch anywhere means touch; the mouse, on the scene, means keyboard and mouse.)
    addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') this.use('touch'); }, { capture: true, passive: true });
    canvas.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse') this.use('keys');
      if (e.pointerType === 'mouse' && e.button === 2) {
        this.emit('cancel', '', []);
        return;
      }
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      try { canvas.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.pinch = this.pinchDistance();
      canvas.classList.add('dragging');
      this.emit('pointer', e.pointerType, []);
    });
    canvas.addEventListener('pointermove', (e) => {
      const p = this.pointers.get(e.pointerId);
      if (!p) return;
      const dx = e.clientX - p.x, dy = e.clientY - p.y;
      p.x = e.clientX;
      p.y = e.clientY;
      if (this.pointers.size === 1) {
        this.drag.dx += dx;
        this.drag.dy += dy;
      } else if (this.pointers.size === 2) {
        const d = this.pinchDistance();
        if (this.pinch) this.wheel += (this.pinch - d) * 4;
        this.pinch = d;
      }
    });
    const end = (e) => {
      this.pointers.delete(e.pointerId);
      this.pinch = this.pinchDistance();
      if (!this.pointers.size) canvas.classList.remove('dragging');
    };
    canvas.addEventListener('pointerup', end);
    canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.use('keys');
      this.wheel += e.deltaY;
    }, { passive: false });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    // Show the letters printed on this keyboard (e.g. Z Q S D on AZERTY).
    try {
      navigator.keyboard?.getLayoutMap?.().then((map) => {
        this.layout = map;
        for (const fn of this.methodFns) fn(this.method);
      }).catch(() => {});
    } catch {
      // Not available in some embedded frames; keep the QWERTY names.
    }
  }

  setBindings(b) {
    this.bindings = b;
    this.byCode = new Map();
    for (const [id, codes] of Object.entries(b)) {
      for (const c of codes) {
        if (!this.byCode.has(c)) this.byCode.set(c, []);
        this.byCode.get(c).push(id);
      }
    }
  }

  actionsOf(code) { return this.byCode.get(code) || []; }

  // Is any key for this action held down?
  holding(action) {
    for (const c of this.bindings[action] || []) if (this.codes.has(c)) return true;
    return this.codes.has(`Touch:${action}`) || this.codes.has(`Pad:${action}`);
  }

  releaseAll() {
    for (const c of this.codes) this.emit('release', c, /^(Touch|Pad):/.test(c) ? [c.slice(c.indexOf(':') + 1)] : this.actionsOf(c));
    this.codes.clear();
  }

  on(evt, fn) { this.handlers[evt].push(fn); }
  emit(evt, code, actions) { for (const fn of this.handlers[evt] || []) fn(code, actions); }

  pinchDistance() {
    if (this.pointers.size < 2) return 0;
    const [a, b] = [...this.pointers.values()];
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // On-screen buttons press an action the same way its key does (whatever key it's bound to).
  pressVirtual(action) {
    const code = `Touch:${action}`;
    if (this.codes.has(code)) return;
    this.codes.add(code);
    this.emit('press', code, [action]);
  }

  releaseVirtual(action) {
    const code = `Touch:${action}`;
    if (!this.codes.has(code)) return;
    this.codes.delete(code);
    this.emit('release', code, [action]);
  }

  get throttle() {
    const k = (this.holding('forward') ? 1 : 0) - (this.holding('back') ? 1 : 0);
    return k || this.virtual.throttle;
  }

  get steer() {
    const k = (this.holding('left') ? 1 : 0) - (this.holding('right') ? 1 : 0);
    return k || this.virtual.steer;
  }

  get action() { return this.holding('cast'); }
  get resting() { return this.holding('rest') || this.virtual.rest; }
  get jogging() { return this.holding('jog'); }

  takeDrag() {
    const d = { x: this.drag.dx, y: this.drag.dy };
    this.drag.dx = this.drag.dy = 0;
    return d;
  }

  takeWheel() {
    const w = this.wheel;
    this.wheel = 0;
    return w;
  }

  // The name of a key as printed on this keyboard.
  label(code) {
    const k = this.layout?.get?.(code);
    if (k && k.trim() && !NAMES[code]) return k.toUpperCase();
    return codeName(code);
  }

  // The (first) key for an action, as printed on this keyboard.
  keyName(action) {
    const c = this.bindings[action]?.[0];
    return c ? this.label(c) : '—';
  }

  // The key for an action, for hints: "E", "Space"… (or its controller button, while you're
  // using a controller).
  keyLabel(action) {
    if (this.method === 'pad' && this.padLabel) {
      const b = this.padLabel(action);
      if (b) return b;
    }
    return this.keyName(action);
  }

  // The controls you're using now changed: tell whoever's listening (the hints, the title; they
  // hear too once the keyboard's own letters are known).
  use(method) {
    if (this.method === method) return;
    this.method = method;
    for (const fn of this.methodFns) fn(method);
  }

  onMethod(fn) { this.methodFns.push(fn); }
}
