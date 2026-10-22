const $ = (id) => document.getElementById(id);
const STICK_RADIUS = 56;

// Capturing keeps a held control working when the finger slides off it; never let it break the control.
const capture = (el, id) => { try { el.setPointerCapture(id); } catch { /* pointer already gone */ } };

// Soften the centre of the stick so small wobbles don't row the boat.
const shape = (v, dead) => (Math.abs(v) < dead ? 0 : (Math.sign(v) * (Math.abs(v) - dead)) / (1 - dead));

// On-screen controls for phones and tablets: a floating stick on the left to row,
// a big action button on the right for fishing, and a hold button to let time drift.
// They write into input.virtual and press a virtual Space, so the game logic is shared with the keyboard.
export function setupTouch(input) {
  const body = document.body;
  const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
  const act = $('act-btn'), rest = $('rest-btn');
  let active = false;
  let onChange = null;

  const enable = () => {
    if (active) return;
    active = true;
    body.classList.add('touch');
    if (onChange) onChange();
  };
  if (matchMedia('(pointer: coarse)').matches) enable();
  addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch') enable(); }, { capture: true, passive: true });

  let stickId = null, cx = 0, cy = 0;
  const move = (e) => {
    if (e.pointerId !== stickId) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const len = Math.hypot(dx, dy);
    if (len > STICK_RADIUS) {
      dx *= STICK_RADIUS / len;
      dy *= STICK_RADIUS / len;
    }
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
    input.virtual.throttle = shape(-dy / STICK_RADIUS, 0.25);
    input.virtual.steer = shape(-dx / STICK_RADIUS, 0.22);
  };
  const end = (e) => {
    if (e.pointerId !== stickId) return;
    stickId = null;
    input.virtual.throttle = 0;
    input.virtual.steer = 0;
    knob.style.transform = '';
    base.style.left = '';
    base.style.top = '';
    zone.classList.remove('active');
  };
  zone.addEventListener('pointerdown', (e) => {
    if (stickId !== null) return;
    stickId = e.pointerId;
    capture(zone, e.pointerId);
    const r = zone.getBoundingClientRect();
    cx = e.clientX;
    cy = e.clientY;
    base.style.left = `${cx - r.left}px`;
    base.style.top = `${cy - r.top}px`;
    zone.classList.add('active');
    move(e);
  });
  zone.addEventListener('pointermove', move);
  zone.addEventListener('pointerup', end);
  zone.addEventListener('pointercancel', end);

  act.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    capture(act, e.pointerId);
    act.classList.add('down');
    input.pressVirtual('Space');
  });
  const actUp = () => {
    act.classList.remove('down');
    input.releaseVirtual('Space');
  };
  act.addEventListener('pointerup', actUp);
  act.addEventListener('pointercancel', actUp);

  rest.addEventListener('pointerdown', (e) => {
    capture(rest, e.pointerId);
    input.virtual.rest = true;
    rest.classList.add('down');
  });
  const restUp = () => {
    input.virtual.rest = false;
    rest.classList.remove('down');
  };
  rest.addEventListener('pointerup', restUp);
  rest.addEventListener('pointercancel', restUp);

  for (const el of [zone, act, rest]) el.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    get active() { return active; },
    onChange(fn) { onChange = fn; },
  };
}
