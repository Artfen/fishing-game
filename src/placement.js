import { findSite } from './campsite.js';
import { clamp, wrapAngle } from './util.js';

const $ = (id) => document.getElementById(id);

// Choosing where to pitch your camp (or where to move it). The preview stands on the ground a
// few metres in front of you and follows as you walk and look about; you turn it, bring it
// nearer or push it further, and pitch it when it fits. If the exact spot doesn't fit but one a
// step away does, it settles there (you never need to be pixel-perfect), and if nothing near
// does, it says why. Cancelling leaves everything as it was: nothing is used up or moved.
export class Placement {
  // hooks: { walker, yaw() (where the camera looks), world (see siteWorld.js), preview, others()
  //          (camps already pitched), keyLabel(action), touch(), confirm(spot), cancel() }
  constructor(hooks) {
    this.h = hooks;
    this.active = null;
    $('pl-ok').addEventListener('click', () => this.confirm());
    $('pl-cancel').addEventListener('click', () => this.cancel());
    $('pl-left').addEventListener('click', () => this.turn(-Math.PI / 12));
    $('pl-right').addEventListener('click', () => this.turn(Math.PI / 12));
    $('pl-near').addEventListener('click', () => this.nudge(-0.8));
    $('pl-far').addEventListener('click', () => this.nudge(0.8));
  }

  get isOn() { return !!this.active; }

  // mode: 'new' (from your backpack) or 'move' (camp: the camp being moved).
  start(mode, camp = null) {
    const w = this.h.walker;
    // The door faces you to begin with.
    this.active = { mode, camp, dist: 4.2, turn: Math.PI, x: w.pos.x, z: w.pos.z, yaw: 0, spot: null, t: 0, key: '', holdT: 0 };
    $('place-panel').hidden = false;
    document.body.classList.add('placing');
    $('pl-title').textContent = mode === 'move' ? `Move ${camp.name}` : 'Pitch your camp';
    this.h.preview.show(true);
    this.refresh(true);
  }

  stop() {
    this.active = null;
    $('place-panel').hidden = true;
    document.body.classList.remove('placing');
    this.h.preview.show(false);
  }

  cancel() {
    if (!this.active) return;
    this.stop();
    this.h.cancel();
  }

  confirm() {
    const a = this.active;
    if (!a?.spot?.check.ok) {
      this.h.nope?.(a?.spot?.check.reason || 'Not here.');
      return;
    }
    const spot = { x: a.spot.x, z: a.spot.z, yaw: a.spot.yaw, check: a.spot.check };
    const mode = a.mode, camp = a.camp;
    this.stop();
    this.h.confirm(spot, mode, camp);
  }

  turn(by) {
    if (!this.active) return;
    this.active.turn = wrapAngle(this.active.turn + by);
    this.refresh(true);
  }

  nudge(by) {
    if (!this.active) return;
    this.active.dist = clamp(this.active.dist + by, 2.8, 9);
    this.refresh(true);
  }

  // Each frame: rotate while Q/E are held, wheel for distance, and follow where you are.
  update(dt, { turning = 0, wheel = 0 } = {}) {
    const a = this.active;
    if (!a) return;
    if (turning) {
      a.holdT += dt;
      if (a.holdT > 0.3) a.turn = wrapAngle(a.turn + turning * 1.6 * dt);
    } else a.holdT = 0;
    if (wheel) a.dist = clamp(a.dist + wheel * 0.004, 2.8, 9);
    a.t -= dt;
    this.refresh(false);
  }

  refresh(now) {
    const a = this.active, w = this.h.walker, yaw = this.h.yaw();
    a.x = w.pos.x + Math.sin(yaw) * a.dist;
    a.z = w.pos.z + Math.cos(yaw) * a.dist;
    a.yaw = wrapAngle(yaw + a.turn);
    // Re-check when the target has moved a little (and at most a few times a second).
    const key = `${Math.round(a.x * 4)},${Math.round(a.z * 4)},${Math.round(a.yaw * 20)}`;
    if (!now && (key === a.key || a.t > 0)) return;
    a.key = key;
    a.t = 0.12;
    const opts = { others: this.h.others(), ignore: a.camp?.id };
    a.spot = findSite(a.x, a.z, a.yaw, this.h.world, opts);
    const c = a.spot.check;
    const state = c.ok ? (c.warn ? 'warn' : 'ok') : 'bad';
    this.h.preview.set(a.spot.x, a.spot.z, a.spot.yaw, state, c.ok ? [] : c.bad);
    this.panel(state, c, a.spot.moved);
  }

  panel(state, c, moved) {
    const s = $('pl-status');
    s.className = `pl-status ${state}`;
    s.textContent = state === 'bad' ? `Can’t pitch here. ${c.reason}` : `${c.warn ? '' : 'A good spot. '}${c.words}${moved ? ' (Settled a step from where you’re pointing, where it fits.)' : ''}`;
    $('pl-warn').textContent = c.ok ? c.warn : '';
    $('pl-ok').disabled = !c.ok;
    const K = this.h.keyLabel;
    $('pl-keys').textContent = this.h.touch()
      ? 'Walk to choose the spot · the buttons turn it and bring it nearer or further'
      : `Walk and look to choose the spot · ${K('tackle')} ${K('interact')} turn it · mouse wheel nearer or further · ${K('cast')} pitch · Esc cancel`;
  }
}
