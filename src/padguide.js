// The controller guide (docs/HUMAN-TOUCH.md, H2): a drawing of the controller in your hands, its
// buttons named as they're printed on yours (✕ and L2 on a PlayStation one), and beside it what
// each does as you walk, row and fish. Shown the first time you play with a controller, and from
// Settings → Controls. The words are the page's own (they wrap, in any language); the drawing has
// only the buttons' names on it.
import { $t } from './i18n.js';
import { MAPS, PAD_NAMES, padStyle } from './gamepad.js';

// Button by button: the game's name for it (an Xbox controller's), the hand it's under, what it
// does while you play (MAPS.play's action, checked by the tests; the sticks have none) and the words.
export const GUIDE = () => [
  ['LT', 'l', 'rest', $t('hold: let time drift')],
  ['LB', 'l', 'rodswap', $t('the other rod')],
  ['VIEW', 'l', 'map', $t('map')],
  ['L-stick', 'l', null, $t('walk, row and steer · press it to jog')],
  ['D-pad', 'l', null, $t('↑ journal · ↓ fish finder · ← next view · → photo mode')],
  ['RT', 'r', 'cast', $t('hold to aim, let go to cast · hold to reel')],
  ['RB', 'r', 'tackle', $t('next bait or lure')],
  ['MENU', 'r', 'settings', $t('settings: every button, for everything you do')],
  ['Y', 'r', 'pack', $t('backpack')],
  ['X', 'r', 'anchor', $t('anchor, tie up, cast off')],
  ['B', 'r', 'cancel', $t('back · cancel')],
  ['A', 'r', 'interact', $t('whatever the prompt says: board, talk, open')],
  ['R-stick', 'r', null, $t('look around · press it to reset the view')],
];

// A button's name as printed on the controller in use (the sticks and the D-pad as they are).
export function printed(b, style = padStyle()) {
  if (b === 'D-pad') return $t('D-pad');
  if (b === 'L-stick' || b === 'R-stick') return b;
  return PAD_NAMES[style]?.[b] ?? b;
}

// Where things are on the drawing (a 440 × 300 canvas): a PlayStation controller has its D-pad
// up on the left and both sticks low; the others their left stick up and the D-pad low.
function layout(style) {
  const cx = 220, cy = 160, ps = style === 'playstation' || style === 'ps4';
  return {
    cx, cy,
    'L-stick': ps ? [cx - 52, cy + 40] : [cx - 100, cy - 14],
    'D-pad': ps ? [cx - 100, cy - 14] : [cx - 52, cy + 40],
    'R-stick': [cx + 52, cy + 40],
    face: [cx + 100, cy - 14],
    VIEW: [cx - 36, cy - 44], MENU: [cx + 36, cy - 44],
    LB: [cx - 104, cy - 84], RB: [cx + 104, cy - 84],
    LT: [cx - 104, cy - 116], RT: [cx + 104, cy - 116],
  };
}

const INK = '#3a2e26', PAPER = '#f3e8cf', SHADE = '#e4d3ae';

// Draw it, its buttons named for `style` (as gamepad.js names them: 'xbox', 'playstation'…).
export function drawPad(ctx, style = padStyle()) {
  const L = layout(style), { cx, cy } = L, name = (b) => printed(b, style);
  ctx.save();
  ctx.clearRect(0, 0, 440, 300);
  ctx.lineWidth = 2.5;
  ctx.lineJoin = ctx.lineCap = 'round';
  ctx.strokeStyle = INK;
  const label = (text, x, y, size = 13, color = INK) => {
    ctx.fillStyle = color;
    ctx.font = `700 ${size}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // (A long name, Options or Create, kept inside its button.)
    const w = ctx.measureText(text).width, max = size * 3.2;
    if (w > max) ctx.font = `700 ${Math.max(8, Math.floor((size * max) / w))}px system-ui, sans-serif`;
    ctx.fillText(text, x, y);
  };
  // The triggers and bumpers, behind the body.
  for (const [b, [x, y], w, h] of [['LT', L.LT, 54, 30], ['RT', L.RT, 54, 30], ['LB', L.LB, 66, 22], ['RB', L.RB, 66, 22]]) {
    ctx.fillStyle = b[1] === 'T' ? SHADE : PAPER;
    ctx.beginPath();
    ctx.roundRect(x - w / 2, y - h / 2, w, h, b[1] === 'T' ? [12, 12, 4, 4] : 8);
    ctx.fill();
    ctx.stroke();
    label(name(b), x, y, 12);
  }
  // The body: wide across the top, two grips down to the hands.
  ctx.fillStyle = PAPER;
  ctx.beginPath();
  ctx.moveTo(cx - 120, cy - 74);
  ctx.quadraticCurveTo(cx, cy - 92, cx + 120, cy - 74);
  ctx.bezierCurveTo(cx + 168, cy - 64, cx + 186, cy + 40, cx + 176, cy + 98);
  ctx.bezierCurveTo(cx + 168, cy + 132, cx + 120, cy + 134, cx + 106, cy + 100);
  ctx.bezierCurveTo(cx + 92, cy + 70, cx + 60, cy + 70, cx, cy + 70);
  ctx.bezierCurveTo(cx - 60, cy + 70, cx - 92, cy + 70, cx - 106, cy + 100);
  ctx.bezierCurveTo(cx - 120, cy + 134, cx - 168, cy + 132, cx - 176, cy + 98);
  ctx.bezierCurveTo(cx - 186, cy + 40, cx - 168, cy - 64, cx - 120, cy - 74);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // The sticks: a well and a cap.
  for (const b of ['L-stick', 'R-stick']) {
    const [x, y] = L[b];
    ctx.fillStyle = SHADE;
    ctx.beginPath();
    ctx.arc(x, y, 25, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = PAPER;
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    label(b[0], x, y, 13);
  }
  // The D-pad: a cross.
  {
    const [x, y] = L['D-pad'], a = 9, r = 24;
    ctx.fillStyle = SHADE;
    ctx.beginPath();
    ctx.moveTo(x - a, y - r); ctx.lineTo(x + a, y - r); ctx.lineTo(x + a, y - a); ctx.lineTo(x + r, y - a); ctx.lineTo(x + r, y + a);
    ctx.lineTo(x + a, y + a); ctx.lineTo(x + a, y + r); ctx.lineTo(x - a, y + r); ctx.lineTo(x - a, y + a); ctx.lineTo(x - r, y + a);
    ctx.lineTo(x - r, y - a); ctx.lineTo(x - a, y - a); ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  // The face buttons, a diamond: A at the bottom (as the game calls them), named as printed.
  {
    const [x, y] = L.face, d = 23;
    for (const [b, dx, dy] of [['A', 0, d], ['B', d, 0], ['X', -d, 0], ['Y', 0, -d]]) {
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.arc(x + dx, y + dy, 13, 0, Math.PI * 2);
      ctx.fill();
      label(name(b), x + dx, y + dy + 0.5, 14, PAPER);
    }
  }
  // The two small buttons in the middle.
  for (const b of ['VIEW', 'MENU']) {
    const [x, y] = L[b];
    ctx.fillStyle = SHADE;
    ctx.beginPath();
    ctx.roundRect(x - 20, y - 9, 40, 18, 9);
    ctx.fill();
    ctx.stroke();
    label(name(b), x, y, 10);
  }
  ctx.restore();
}

// The two lists beside the drawing: [left hand's, right hand's], each [{ key, words }].
export function guideRows(style = padStyle()) {
  const out = { l: [], r: [] };
  for (const [b, side, , words] of GUIDE()) out[side].push({ key: printed(b, style), words });
  return [out.l, out.r];
}
