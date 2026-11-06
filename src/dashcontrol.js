// Working the dashboard (dashboard.js) in first person at the helm.
//
//  · With the mouse: point at a control and it's ringed, with its name and what it's doing; click
//    to work it (the key, the trim rocker and the horn for as long as you hold the button); drag
//    the throttle lever up or down, or scroll over it. Dragging anywhere else still looks round.
//  · On a touch screen: tap a control (hold the key, the rocker or the horn).
//  · With a controller (or the keyboard): the helm key (L3, or U) looks down at the dashboard; the
//    D-pad (or the arrow keys) moves the ring from control to control, A (or Enter) works it,
//    held where holding means something; B (or Esc, or the helm key again) looks up again. The
//    stick still steers and works the throttle the while.
//
// It only says what was worked: hooks.act(control, 'down' | 'up'), hooks.lever(steps). The game
// does it (main.js), through the same engine room as everything else.

import * as THREE from 'three';

const DRAG_STEP = 34;   // px of drag up or down per notch of the throttle
const CLICK_MOVE = 6;   // px a press may move and still be a press, not a look round

export class DashControl {
  // canvas: the game's; camera: the camera; input: the game's input (its drag is held still while
  // a control's held); hooks: { dash() (the dashboard you could work now, or null), act(c, phase),
  // lever(steps), state(c) (a few words on what the control's doing) }.
  constructor({ canvas, camera, input, hooks }) {
    this.canvas = canvas;
    this.camera = camera;
    this.input = input;
    this.h = hooks;
    this.ray = new THREE.Raycaster();
    this.ndc = new THREE.Vector2();
    this.hover = null;   // under the mouse
    this.sel = null;     // ringed for a controller or the keyboard (while focused)
    this.held = null;    // being pressed: { c, by: 'pointer' | 'pad', y, moved }
    this.focused = false;
    this.tip = null;
    if (!canvas?.addEventListener) return;
    canvas.addEventListener('pointermove', (e) => this.move(e));
    canvas.addEventListener('pointerdown', (e) => this.down(e));
    addEventListener('pointerup', (e) => this.up(e));
    addEventListener('pointercancel', (e) => this.up(e));
    canvas.addEventListener('wheel', (e) => {
      if (this.hover?.kind !== 'lever' || !this.h.dash()) return;
      this.h.lever(e.deltaY < 0 ? 1 : -1);
      // (The scroll that worked the lever doesn't zoom as well.)
      this.input.wheel = 0;
    });
    canvas.addEventListener('pointerleave', () => { this.hover = null; });
  }

  // The control under a point on the screen.
  at(x, y) {
    const dash = this.h.dash();
    if (!dash) return null;
    const r = this.canvas.getBoundingClientRect();
    this.ndc.set(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(this.ndc, this.camera);
    return dash.pick(this.ray);
  }

  move(e) {
    if (this.held?.by === 'pointer') {
      const H = this.held;
      const dy = e.clientY - H.y;
      if (Math.abs(dy) > CLICK_MOVE) H.moved = true;
      // Dragging the lever: a notch for every so far up (ahead) or down (astern).
      if (H.c.kind === 'lever' && Math.abs(dy) >= DRAG_STEP) {
        const steps = Math.trunc(dy / DRAG_STEP);
        this.h.lever(-steps);
        H.y += steps * DRAG_STEP;
      }
      return;
    }
    if (e.pointerType === 'mouse' && !e.buttons) this.hover = this.at(e.clientX, e.clientY);
  }

  down(e) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const c = this.at(e.clientX, e.clientY);
    if (!c) return;
    this.held = { c, by: 'pointer', y: e.clientY, moved: false, id: e.pointerId };
    this.hover = c;
    if (c.kind !== 'lever') this.h.act(c, 'down');
  }

  up(e) {
    const H = this.held;
    if (!H || H.by !== 'pointer' || (H.id != null && e.pointerId !== H.id)) return;
    this.held = null;
    if (H.c.kind !== 'lever') this.h.act(H.c, 'up');
    // (A press on the lever without a drag: a notch towards wherever on it you pressed.)
  }

  /* ---------- a controller or the keyboard ---------- */

  focus(on) {
    const dash = this.h.dash();
    this.focused = !!on && !!dash;
    if (!this.focused) {
      if (this.held?.by === 'pad') this.release();
      this.sel = null;
      return false;
    }
    if (!this.sel || !dash.controls.has(this.sel.id)) this.sel = dash.controls.get('key') || dash.controls.get('key0') || [...dash.controls.values()][0];
    return true;
  }

  // Move the ring: 'left', 'right', 'up', 'down' (as you see the dashboard).
  step(dir) {
    const dash = this.h.dash();
    if (!this.focused || !dash) return;
    if (this.sel?.kind === 'lever' && (dir === 'up' || dir === 'down')) {
      this.h.lever(dir === 'up' ? 1 : -1);
      return;
    }
    this.sel = dash.neighbour(this.sel?.id, dir);
  }

  press() {
    if (!this.focused || !this.sel || this.held) return;
    this.held = { c: this.sel, by: 'pad' };
    if (this.sel.kind !== 'lever') this.h.act(this.sel, 'down');
  }

  release() {
    const H = this.held;
    if (!H || H.by !== 'pad') return;
    this.held = null;
    if (H.c.kind !== 'lever') this.h.act(H.c, 'up');
  }

  /* ---------- each frame ---------- */

  // Returns what to show under the crosshair: the ringed control's name and what it's doing.
  update() {
    const dash = this.h.dash();
    if (!dash) {
      if (this.held) this.cancel();
      this.hover = this.sel = null;
      this.focused = false;
      return null;
    }
    // (Holding a control isn't looking round.)
    if (this.held?.by === 'pointer') this.input.drag.dx = this.input.drag.dy = 0;
    const c = this.held?.c || this.hover || (this.focused ? this.sel : null);
    dash.highlight = c?.id || null;
    return c ? { name: c.name, state: this.h.state?.(c) || '' } : null;
  }

  // Let go of whatever's held (the helm left, a menu opened).
  cancel() {
    const H = this.held;
    this.held = null;
    if (H && H.c.kind !== 'lever') this.h.act(H.c, 'up');
  }

  get grabbing() { return this.held?.by === 'pointer'; }
}
