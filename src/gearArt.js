import * as THREE from 'three';
import { RODS, TACKLE, TERMS, LINE_COLORS } from './tackle.js';

// Showcase models of every piece of tackle, for the backpack: rods with their guides, bindings,
// handles and the reel their data names; spools of line; floats, rigs and leaders; baits, lures,
// flies and squid jigs. Everything is built from the game's own tackle data (by id), in metres,
// and drawn by the backpack's little studio (gearView.js). Original procedural models.
//
// A reference to something to draw: { type: 'rod' | 'reel' | 'line' | 'term' | 'item', id, rod }
// (rod: the rod a reel, line or rig belongs to).

/* ---------------- materials: shared for the session, never disposed ---------------- */

const MATS = new Map();
function material(key, make) {
  if (!MATS.has(key)) MATS.set(key, make());
  return MATS.get(key);
}
const std = (color, rough = 0.5, metal = 0, extra = null) =>
  material(`s|${color}|${rough}|${metal}|${extra ? JSON.stringify(extra) : ''}`, () => new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(extra || {}) }));
const varnish = (color) => material(`v|${color}`, () => new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.12 }));
const STEEL = () => std('#c3c9d0', 0.26, 0.92);
const DARK = () => std('#3b3f46', 0.38, 0.75);
const CHROME = () => std('#eef2f6', 0.1, 1);
const GOLD = () => std('#d9b05a', 0.28, 0.9);
const BRASS = () => std('#b98b3f', 0.35, 0.85);
const LEAD = () => std('#6c7077', 0.62, 0.35);
const CERAMIC = () => std('#2a2c30', 0.2, 0.3);
const glossy = (color) => std(color, 0.22, 0.05);
const soft = (color) => std(color, 0.62, 0);
const clearLine = (color, opacity = 0.75) => material(`c|${color}|${opacity}`, () => new THREE.MeshStandardMaterial({ color, roughness: 0.15, metalness: 0, transparent: true, opacity }));

// Cork: speckled, with the rings of the cork discs it's built from.
const TEX = new Map();
function corkTexture(base) {
  const key = `cork|${base}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 128;
  const x = c.getContext('2d');
  x.fillStyle = base;
  x.fillRect(0, 0, 64, 128);
  let s = 7;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 260; i++) {
    x.fillStyle = rnd() < 0.6 ? 'rgba(90,55,25,0.35)' : 'rgba(255,240,210,0.3)';
    x.fillRect(rnd() * 64, rnd() * 128, 1 + rnd() * 2, 1 + rnd() * 2);
  }
  x.fillStyle = 'rgba(80,50,25,0.28)';
  for (let y = 0; y < 128; y += 16) x.fillRect(0, y, 64, 1.4);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  TEX.set(key, t);
  return t;
}
const cork = (base, len) => {
  const tex = corkTexture(base);
  return material(`cork|${base}|${len.toFixed(2)}`, () => {
    const t = tex.clone();
    t.repeat.set(1, Math.max(1, len / 0.09));
    t.needsUpdate = true;
    return new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 });
  });
};

// A woven look for braid on a spool.
function braidTexture(color) {
  const key = `braid|${color}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const x = c.getContext('2d');
  x.fillStyle = color;
  x.fillRect(0, 0, 64, 64);
  x.strokeStyle = 'rgba(0,0,0,0.18)';
  x.lineWidth = 1.5;
  for (let i = -64; i < 128; i += 6) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + 20, 64);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(6, 2);
  TEX.set(key, t);
  return t;
}

// The label on a spool's face: the line's strength from its name, and what kind of line.
function labelTexture(big, small, bg, fg) {
  const key = `label|${big}|${small}|${bg}`;
  if (TEX.has(key)) return TEX.get(key);
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = bg;
  x.beginPath();
  x.arc(128, 128, 128, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = 'rgba(255,255,255,0.35)';
  x.lineWidth = 6;
  x.beginPath();
  x.arc(128, 128, 104, 0, Math.PI * 2);
  x.stroke();
  x.fillStyle = fg;
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.font = `800 ${big.length > 5 ? 54 : 70}px Nunito, ui-rounded, system-ui, sans-serif`;
  x.fillText(big, 128, 116);
  x.font = '800 30px Nunito, ui-rounded, system-ui, sans-serif';
  x.fillText(small.toUpperCase(), 128, 176);
  x.beginPath();
  x.arc(128, 128, 22, 0, Math.PI * 2);
  x.fillStyle = 'rgba(0,0,0,0.35)';
  x.fill();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  // (The cap of a cylinder laid on its side is turned a quarter: turn the label back upright.)
  t.center.set(0.5, 0.5);
  t.rotation = Math.PI / 2;
  TEX.set(key, t);
  return t;
}

/* ---------------- geometry helpers ---------------- */

// Add a child and hand it back (Object3D.add returns the parent).
function put(parent, child) {
  parent.add(child);
  return child;
}

function mesh(geo, mat, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.rotation.set(rx, ry, rz);
  return m;
}

// A round piece lying along +x from x0 to x1, radius r0 at x0 and r1 at x1.
function alongX(r0, r1, x0, x1, mat, y = 0, z = 0, seg = 18) {
  const g = new THREE.CylinderGeometry(r1, r0, Math.max(1e-4, x1 - x0), seg, 1);
  return mesh(g, mat, (x0 + x1) / 2, y, z, 0, 0, -Math.PI / 2);
}

// A tube along a list of [x, y, z] points.
function tube(points, r, mat, seg = 32, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, seg, r, 8, closed), mat);
}

// A shape turned on a lathe around +y: profile [[radius, y], ...].
function lathe(profile, mat, seg = 28) {
  return new THREE.Mesh(new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), seg), mat);
}

// A fish hook hanging from its eye at the origin, point facing +x. s: shank length (m).
function hook(s = 0.02, mat = STEEL()) {
  const g = new THREE.Group();
  const r = s * 0.045;
  const pts = [[0, -s * 0.05, 0], [0, -s * 0.55, 0], [0, -s * 0.85, 0], [s * 0.08, -s, 0], [s * 0.26, -s * 1.03, 0], [s * 0.4, -s * 0.92, 0], [s * 0.44, -s * 0.7, 0], [s * 0.42, -s * 0.5, 0]];
  g.add(tube(pts, r, mat, 40));
  g.add(mesh(new THREE.ConeGeometry(r * 1.6, s * 0.12, 6), mat, s * 0.4, -s * 0.47, 0, 0, 0, 0.35));
  g.add(mesh(new THREE.TorusGeometry(s * 0.07, r * 0.9, 6, 14), mat, 0, s * 0.02, 0, 0, Math.PI / 2, 0));
  return g;
}

// A treble hook: three hooks round one shank.
function treble(s = 0.016, mat = STEEL()) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const h = hook(s, mat);
    h.rotation.y = (i / 3) * Math.PI * 2;
    g.add(h);
  }
  return g;
}

const ring = (r, t, mat) => new THREE.Mesh(new THREE.TorusGeometry(r, t, 8, 20), mat);

// A barrel swivel along y.
function swivel(s = 0.012) {
  const g = new THREE.Group();
  g.add(lathe([[0.0001, -s * 0.5], [s * 0.18, -s * 0.38], [s * 0.22, 0], [s * 0.18, s * 0.38], [0.0001, s * 0.5]], BRASS(), 14));
  for (const y of [-1, 1]) g.add(mesh(new THREE.TorusGeometry(s * 0.2, s * 0.045, 6, 12), BRASS(), 0, y * s * 0.68, 0, 0, Math.PI / 2, 0));
  return g;
}

// A short length of line between two points.
function lineBetween(a, b, color, r = 0.0006, opacity = 0.9) {
  return tube([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], r, clearLine(color, opacity), 8);
}

/* ---------------- rods and reels ---------------- */

// Which reel a rod carries, from its data ("small fixed-spool reel", "fly reel"…), and its size.
export function reelOf(rod) {
  const t = rod.reel || '';
  const type = /multiplier/.test(t) ? 'multiplier' : /fly/.test(t) ? 'fly' : /centrepin/.test(t) ? 'pin' : /big-pit/.test(t) ? 'bigpit' : 'spin';
  const size = /big/.test(t) ? 1.45 : /saltwater/.test(t) ? 1.2 : /medium/.test(t) ? 1.05 : /light|small/.test(t) ? 0.85 : 1;
  return { type, size, name: t };
}

const isLight = (hex) => {
  const c = new THREE.Color(hex);
  return c.r * 0.3 + c.g * 0.59 + c.b * 0.11 > 0.45;
};

// A fixed-spool reel, hanging below the rod (local -y), its spool facing the tip (+x).
function spinReel(s, lineColor, braid, longCast = false) {
  const g = new THREE.Group();
  const body = std('#30343a', 0.4, 0.55), accent = std('#8a939c', 0.3, 0.85);
  const sw = longCast ? 1.7 : 1; // a big-pit's long, shallow spool
  g.add(mesh(new THREE.BoxGeometry(0.07 * s, 0.006 * s, 0.014 * s), accent, 0, -0.004 * s, 0));
  g.add(mesh(new THREE.BoxGeometry(0.012 * s, 0.05 * s, 0.01 * s), body, 0.004 * s, -0.03 * s, 0, 0, 0, 0.12));
  // Gearbox, rotor cup, spool with the line on it, bail arm and the handle.
  put(g, mesh(new THREE.SphereGeometry(0.032 * s, 18, 14), body, -0.005 * s, -0.072 * s, 0)).scale.set(1.2, 1, 0.75);
  const rotor = lathe([[0.012 * s, 0], [0.026 * s, 0.006 * s], [0.028 * s, 0.03 * s], [0.026 * s, 0.034 * s]], body, 24);
  rotor.rotation.z = -Math.PI / 2;
  rotor.position.set(0.02 * s, -0.072 * s, 0);
  g.add(rotor);
  const spoolX = 0.056 * s;
  g.add(alongX(0.024 * s, 0.024 * s, spoolX, spoolX + 0.004 * s, accent, -0.072 * s));
  const lineMat = braid ? material(`braidline|${lineColor}`, () => new THREE.MeshStandardMaterial({ map: braidTexture(lineColor), roughness: 0.9 })) : clearLine(lineColor, 0.92);
  const sx1 = spoolX + 0.026 * s * sw;
  g.add(alongX(0.021 * s, longCast ? 0.024 * s : 0.022 * s, spoolX + 0.004 * s, sx1, lineMat, -0.072 * s));
  g.add(alongX(0.025 * s, longCast ? 0.028 * s : 0.025 * s, sx1, sx1 + 0.004 * s, accent, -0.072 * s));
  g.add(alongX(0.008 * s, 0.006 * s, sx1 + 0.004 * s, sx1 + 0.014 * s, body, -0.072 * s));
  // The bail: a wire arc round the far side of the spool.
  const bail = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    bail.push([0.05 * s, -0.072 * s - Math.sin(a) * 0.03 * s * (longCast ? 1.08 : 1), Math.cos(a) * 0.03 * s * (longCast ? 1.08 : 1)]);
  }
  g.add(tube(bail, 0.0016 * s, STEEL(), 24));
  // The handle: an arm out to the side with a knob.
  g.add(mesh(new THREE.CylinderGeometry(0.0028 * s, 0.0028 * s, 0.05 * s, 8), accent, -0.008 * s, -0.072 * s, 0.045 * s, Math.PI / 2, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(0.0065 * s, 0.0065 * s, 0.022 * s, 12), soft('#1f1f1f'), -0.008 * s, -0.06 * s, 0.07 * s));
  return g;
}

// A fly reel: a wide disc hanging below the butt, its spool full of bright floating line.
function flyReel(s, lineColor) {
  const g = new THREE.Group();
  const frame = std('#3a3530', 0.35, 0.6);
  g.add(mesh(new THREE.BoxGeometry(0.06 * s, 0.006, 0.012), frame, 0, -0.004, 0));
  g.add(mesh(new THREE.BoxGeometry(0.01, 0.018 * s, 0.01), frame, 0, -0.014 * s, 0));
  const y = -0.068 * s, R = 0.046 * s;
  for (const z of [-0.013 * s, 0.013 * s]) g.add(mesh(new THREE.CylinderGeometry(R, R, 0.004 * s, 32), frame, 0, y, z, Math.PI / 2, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(R * 0.86, R * 0.86, 0.022 * s, 32), clearLine(lineColor, 1), 0, y, 0, Math.PI / 2, 0, 0));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    g.add(mesh(new THREE.CylinderGeometry(0.008 * s, 0.008 * s, 0.005 * s, 12), std('#1c1b1a', 0.6), Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, 0.014 * s, Math.PI / 2, 0, 0));
  }
  g.add(mesh(new THREE.CylinderGeometry(0.005 * s, 0.005 * s, 0.022 * s, 10), soft('#2a2420'), R * 0.62, y + R * 0.3, 0.026 * s, Math.PI / 2, 0, 0));
  return g;
}

// A small multiplier reel sitting on top of the rod, its spool across it.
function multiplierReel(s, lineColor) {
  const g = new THREE.Group();
  const side = std('#2d3138', 0.35, 0.7), gold = GOLD();
  g.add(mesh(new THREE.BoxGeometry(0.06 * s, 0.006, 0.014), side, 0, 0.004, 0));
  const y = 0.034 * s, R = 0.03 * s;
  for (const z of [-0.026 * s, 0.026 * s]) g.add(mesh(new THREE.CylinderGeometry(R, R, 0.008 * s, 28), side, 0, y, z, Math.PI / 2, 0, 0));
  g.add(mesh(new THREE.CylinderGeometry(R * 0.82, R * 0.82, 0.044 * s, 28), clearLine(lineColor, 0.95), 0, y, 0, Math.PI / 2, 0, 0));
  for (const x of [-0.022 * s, 0.022 * s]) g.add(mesh(new THREE.CylinderGeometry(0.0025 * s, 0.0025 * s, 0.05 * s, 8), gold, x, y + 0.02 * s, 0, Math.PI / 2, 0, 0));
  // Star drag and handle on the right.
  const star = mesh(new THREE.CylinderGeometry(0.014 * s, 0.014 * s, 0.004 * s, 5), gold, 0, y, 0.034 * s, Math.PI / 2, 0, 0);
  g.add(star);
  g.add(mesh(new THREE.BoxGeometry(0.05 * s, 0.006 * s, 0.004 * s), side, 0.006 * s, y, 0.038 * s));
  g.add(mesh(new THREE.CylinderGeometry(0.006 * s, 0.006 * s, 0.016 * s, 10), soft('#1f1f1f'), 0.03 * s, y, 0.046 * s, Math.PI / 2, 0, 0));
  return g;
}

// The reel a rod carries, for showing on its own.
export function buildReel(rod, lineColor = LINE_COLORS[rod.kind]) {
  const r = reelOf(rod);
  if (r.type === 'fly') return flyReel(1.5, lineColor);
  if (r.type === 'multiplier') return multiplierReel(1.5, lineColor);
  return spinReel(r.size, lineColor, rod.lines[0]?.name.includes('braid'));
}

// A whole rod lying along +x, butt at 0: blank, guides and bindings, handle, reel seat and reel.
// thick: how much fatter than life to draw it (so a 3 m rod still reads at small sizes).
export function buildRod(rod, { line = rod.lines[0], thick = 1 } = {}) {
  const look = rod.look, L = look.len, g = new THREE.Group();
  const reel = reelOf(rod);
  const corkGrip = isLight(look.handle);
  const gripMat = (len) => (corkGrip ? cork(look.handle, len) : soft(look.handle));
  const hf = L >= 3 ? 1.25 : L <= 2 ? 0.85 : 1;
  // thick: drawn fatter than life (so a 3 m rod still reads in a small picture): the blank and
  // handle grow, the guides and reel a little.
  const T = thick, TR = 1 + (thick - 1) * 0.45;
  const r0 = 0.0062 * (reel.type === 'bigpit' ? 1.2 : 1) * (rod.id === 'offshore' ? 1.35 : 1) * T, r1 = 0.0011 * T;
  const R = (x) => r0 + (r1 - r0) * Math.pow(x / L, 0.85);
  const wrapMat = soft(corkGrip ? '#c9a24a' : '#1c1c1c');
  const seat = std('#3a3f46', 0.35, 0.7);
  let reelAt, handleEnd;
  const along = (a, b, x0, x1, m) => alongX(a * T, b * T, x0, x1, m);
  // Handles: full cork for the light rods, split foam for the heavy ones, a fighting butt and
  // full-wells grip with the reel at the very end for the fly rod.
  if (reel.type === 'fly') {
    g.add(along(0.012, 0.012, 0, 0.045, cork(look.handle, 0.045)));
    g.add(along(0.0105, 0.0105, 0.045, 0.15, std('#6a4a2a', 0.4, 0.1)));
    g.add(along(0.0115, 0.0115, 0.045, 0.06, seat));
    g.add(along(0.0115, 0.0115, 0.135, 0.15, seat));
    g.add(lathe([[0.0105, 0], [0.0135, 0.04], [0.0125, 0.14], [0.0145, 0.21], [0.0085, 0.27]].map(([r, y]) => [r * T, y]), cork(look.handle, 0.27)).rotateZ(-Math.PI / 2).translateY(0.15));
    reelAt = 0.095;
    handleEnd = 0.42;
  } else {
    const rear = 0.3 * hf, seatEnd = rear + 0.11, fore = seatEnd + (corkGrip ? 0.13 : 0.09) * hf;
    g.add(lathe([[0.0001, 0], [0.012 * T, 0.002], [0.0128 * T, 0.012]], std('#26282c', 0.5, 0.4)).rotateZ(-Math.PI / 2));
    if (corkGrip) g.add(along(0.0125, 0.0115, 0.012, rear, gripMat(rear)));
    else {
      g.add(along(0.0125, 0.012, 0.012, rear * 0.4, gripMat(rear * 0.4)));
      g.add(alongX(R(rear * 0.4) + 0.001, R(rear * 0.4) + 0.001, rear * 0.4, rear * 0.82, varnish(look.color)));
      g.add(along(0.0118, 0.0112, rear * 0.82, rear, gripMat(rear * 0.18)));
    }
    g.add(along(0.0105, 0.0105, rear, seatEnd, seat));
    g.add(along(0.0118, 0.0118, rear, rear + 0.014, std('#8a939c', 0.3, 0.85)));
    g.add(along(0.0118, 0.0118, seatEnd - 0.014, seatEnd, std('#8a939c', 0.3, 0.85)));
    g.add(along(0.0112, 0.0085, seatEnd, fore, gripMat(fore - seatEnd)));
    reelAt = (rear + seatEnd) / 2;
    handleEnd = fore;
  }
  // The blank, varnished, from inside the handle to the tip.
  const blank = varnish(look.color);
  const n = 24;
  for (let i = 0; i < n; i++) {
    const a = handleEnd - 0.02 + ((L - handleEnd + 0.02) * i) / n, b = handleEnd - 0.02 + ((L - handleEnd + 0.02) * (i + 1)) / n;
    g.add(alongX(R(a), R(b), a, b, blank, 0, 0, 12));
  }
  // Guides: under the rod for a fixed-spool or fly reel, on top for a multiplier; bigger near the
  // reel, smaller and closer together towards the tip.
  const below = reel.type !== 'multiplier' ? -1 : 1;
  const count = Math.round(4 + L * 1.6);
  const first = handleEnd + (reel.type === 'fly' ? 0.25 : 0.32 * hf);
  for (let i = 0; i < count; i++) {
    const t = 1 - Math.pow(1 - i / count, 1.45);
    const x = first + (L - 0.03 - first) * t;
    const k = 1 - i / count;
    const ringR = (reel.type === 'fly' ? 0.004 + 0.006 * Math.pow(k, 3) : 0.0035 + 0.017 * Math.pow(k, 2.4) * reel.size) * TR;
    const h = R(x) + ringR + 0.006 + 0.01 * k;
    const gr = new THREE.Group();
    gr.position.set(x, 0, 0);
    gr.add(mesh(new THREE.TorusGeometry(ringR, Math.max(0.0007, ringR * 0.16), 8, 22), reel.type === 'fly' && i > 1 ? STEEL() : CERAMIC(), 0, below * h, 0, 0, Math.PI / 2, 0));
    gr.add(mesh(new THREE.TorusGeometry(ringR * 1.12, Math.max(0.0005, ringR * 0.06), 6, 22), STEEL(), 0, below * h, 0, 0, Math.PI / 2, 0));
    for (const sx of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.0006 * TR, 0.0008 * TR, h - ringR, 5), STEEL());
      leg.position.set(sx * 0.004, below * (R(x) + (h - ringR - R(x)) / 2), 0);
      leg.rotation.z = sx * below * 0.35;
      gr.add(leg);
    }
    gr.add(alongX(R(x) + 0.0007, R(x) + 0.0007, -0.012, 0.012, wrapMat));
    g.add(gr);
  }
  g.add(mesh(new THREE.TorusGeometry(0.0022 * TR, 0.0005 * TR, 6, 16), STEEL(), L, 0.003 * below * TR, 0, 0, Math.PI / 2, 0));
  g.add(alongX(R(handleEnd) + 0.0012, R(handleEnd) + 0.0008, handleEnd - 0.005, handleEnd + 0.02, wrapMat));
  // The reel the rod carries, with this rod's line on its spool.
  const lc = LINE_COLORS[rod.kind];
  const braid = /braid|PE/.test(line?.name || '');
  const rm = reel.type === 'fly' ? flyReel(TR, lc) : reel.type === 'multiplier' ? multiplierReel(1.15 * TR, lc) : spinReel(reel.size * TR, lc, braid, reel.type === 'bigpit');
  rm.position.set(reelAt, (reel.type === 'multiplier' ? 0.0105 : -0.0105) * T, 0);
  g.add(rm);
  // The close-up frames the reel and the grips either side of it.
  g.userData.handle = { x0: Math.max(0, reelAt - 0.22), x1: reelAt + 0.26, reelAt };
  return g;
}

/* ---------------- line on spools ---------------- */

// A filler spool of the line, labelled with its strength (from its name) and kind.
export function buildSpool(rod, line) {
  const name = line.name;
  const kind = /fluoro/.test(name) && !/braid/.test(name) ? 'fluoro' : /braid|PE/.test(name) ? 'braid' : /floating/.test(name) ? 'fly line' : 'mono';
  const big = (name.match(/PE \d+(\.\d+)?/) || name.match(/\d+ lb/) || [''])[0];
  return labelledSpool({ big: big || kind, small: kind, kind, lineColor: LINE_COLORS[rod.kind], key: `${rod.id}|${line.id}` });
}

function labelledSpool({ big, small, kind, lineColor: lc, key, R = 0.05, W = 0.034 }) {
  const g = new THREE.Group();
  const flange = { mono: '#2f5a3a', fluoro: '#6f757d', braid: '#25282c', 'fly line': '#5a4a2a', leader: '#3a4a5a', tippet: '#5a4a2a', shock: '#2c3e50' }[kind];
  const lineMat = kind === 'braid'
    ? material(`braidline|${lc}`, () => new THREE.MeshStandardMaterial({ map: braidTexture(lc), roughness: 0.9 }))
    : kind === 'fly line' ? std(lc, 0.45) : clearLine(lc, kind === 'fluoro' ? 0.6 : 0.88);
  g.add(mesh(new THREE.CylinderGeometry(R * 0.8, R * 0.8, W, 40), lineMat, 0, 0, 0, Math.PI / 2, 0, 0));
  const face = material(`face|${key}`, () => new THREE.MeshStandardMaterial({ map: labelTexture(big, small, flange, '#f6efe2'), roughness: 0.4 }));
  const rim = std(flange, 0.35, 0.1);
  for (const z of [-1, 1]) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.004, 48), [rim, z > 0 ? face : rim, rim]);
    d.rotation.x = Math.PI / 2;
    d.position.z = z * (W / 2 + 0.002);
    g.add(d);
  }
  // A loose end of line trailing off.
  g.add(tube([[R * 0.78, 0.004, 0.01], [R * 1.05, -0.02, 0.012], [R * 1.2, -0.05, 0.004]], 0.0007, kind === 'braid' || kind === 'fly line' ? std(lc, 0.6) : clearLine(lc, 0.9), 10));
  return g;
}

/* ---------------- floats, rigs and leaders ---------------- */

const FLOAT_TIP = { stick: '#e8402a', waggler: '#ff7a1a', margin: '#f2d21a' };

// A float with its tip colour, the shot pinched on the line below it, and the hook.
function floatRig(id) {
  const g = new THREE.Group();
  const tip = FLOAT_TIP[id], body = soft('#e9e0cc');
  const lc = LINE_COLORS.float;
  if (id === 'stick') {
    g.add(lathe([[0.0004, -0.07], [0.0028, -0.05], [0.0055, -0.01], [0.006, 0.005], [0.0035, 0.03], [0.0022, 0.05]], body));
    g.add(lathe([[0.0022, 0.05], [0.0022, 0.07], [0.0001, 0.072]], glossy(tip)));
    g.add(lathe([[0.0016, -0.1], [0.0016, -0.07]], soft('#c9b183')));
    for (const y of [-0.05, 0.03]) g.add(alongX(0.0032, 0.0032, -0.004, 0.004, std('#2a2a2a', 0.5), y, 0).rotateZ(Math.PI / 2));
  } else if (id === 'waggler') {
    g.add(lathe([[0.0035, -0.11], [0.0045, -0.105], [0.0045, 0.06], [0.0028, 0.07]], body));
    g.add(lathe([[0.0024, 0.07], [0.0024, 0.1], [0.0001, 0.102]], glossy(tip)));
    g.add(lathe([[0.002, -0.125], [0.0042, -0.112], [0.0042, -0.105]], soft('#2a2a2a')));
  } else {
    g.add(lathe([[0.002, -0.035], [0.008, -0.025], [0.0105, 0], [0.008, 0.018], [0.004, 0.025]], body));
    g.add(lathe([[0.004, 0.025], [0.0045, 0.045], [0.0001, 0.047]], glossy(tip)));
    g.add(lathe([[0.0016, -0.05], [0.0016, -0.035]], soft('#c9b183')));
  }
  const base = id === 'waggler' ? -0.125 : id === 'stick' ? -0.1 : -0.05;
  g.add(lineBetween([0, base, 0], [0, base - 0.12, 0], lc));
  const shot = id === 'stick' ? [0.03, 0.06, 0.09, 0.11] : id === 'waggler' ? [0.005, 0.012, 0.1] : [0.09];
  for (const d of shot) g.add(mesh(new THREE.SphereGeometry(id === 'margin' ? 0.0042 : 0.0028, 12, 10), LEAD(), 0, base - d, 0));
  const hs = id === 'stick' ? 0.009 : id === 'waggler' ? 0.013 : 0.019;
  const h = hook(hs);
  h.position.set(0, base - 0.12, 0);
  g.add(h);
  return g;
}

// A pear lead (or inline lead), along y, weight-ish sized.
function leadWeight(oz, inline = false) {
  const s = Math.cbrt(oz) * 0.016;
  const g = lathe([[0.0001, -s * 1.4], [s * 0.5, -s * 1.3], [s * 0.75, -s * 0.6], [s * 0.6, s * 0.4], [s * 0.3, s * 1.1], [0.0001, s * 1.3]], std(inline ? '#4a5a3a' : '#6c7077', 0.75, 0.2));
  return g;
}

function bottomRig(id) {
  const g = new THREE.Group();
  const lc = LINE_COLORS[id === 'hair' || id === 'method' ? 'ledger' : 'bottom'];
  if (id === 'hair') {
    // Inline lead, a braided hooklink and a curved hook with its hair.
    const lead = leadWeight(3, true);
    lead.rotation.z = Math.PI / 2;
    g.add(lead);
    g.add(lineBetween([-0.07, 0, 0], [-0.03, 0, 0], lc, 0.0008));
    g.add(alongX(0.002, 0.003, 0.03, 0.05, soft('#2e3a2a')));
    g.add(tube([[0.05, 0, 0], [0.08, -0.01, 0], [0.11, -0.004, 0], [0.135, -0.012, 0]], 0.0011, soft('#5a5040'), 20));
    const h = hook(0.022);
    h.rotation.z = Math.PI / 2;
    h.position.set(0.135, -0.012, 0);
    g.add(h);
    g.add(tube([[0.155, -0.02, 0], [0.165, -0.032, 0], [0.163, -0.045, 0]], 0.0005, soft('#d8cfb8'), 10));
    g.add(mesh(new THREE.BoxGeometry(0.006, 0.0015, 0.0015), soft('#e8402a'), 0.163, -0.047, 0));
  } else if (id === 'method') {
    // A flat-bottomed frame feeder with ribs, and a short hooklink.
    g.add(mesh(new THREE.BoxGeometry(0.06, 0.006, 0.03), std('#5a6a3a', 0.6, 0.1), 0, -0.012, 0));
    for (let i = 0; i < 4; i++) g.add(mesh(new THREE.BoxGeometry(0.004, 0.022, 0.032), std('#3a3f2a', 0.6), -0.022 + i * 0.015, 0.002, 0));
    g.add(alongX(0.003, 0.003, -0.035, 0.035, std('#2a2a2a', 0.5), 0.004));
    g.add(lineBetween([-0.08, 0.004, 0], [-0.035, 0.004, 0], lc, 0.0008));
    g.add(tube([[0.035, 0.004, 0], [0.05, -0.004, 0], [0.065, 0, 0], [0.075, -0.006, 0]], 0.0008, clearLine(lc), 12));
    const h = hook(0.018);
    h.rotation.z = Math.PI / 2;
    h.position.set(0.075, -0.006, 0);
    g.add(h);
  } else if (id === 'flapper') {
    // Two snoods with beads and hooks above a grip lead.
    g.add(lineBetween([0, 0.12, 0], [0, -0.1, 0], lc, 0.0008));
    put(g, swivel(0.014)).position.set(0, 0.13, 0);
    for (const [y, side] of [[0.06, 1], [-0.02, -1]]) {
      g.add(mesh(new THREE.SphereGeometry(0.003, 10, 8), glossy('#e8402a'), 0, y, 0));
      g.add(tube([[0, y, 0], [side * 0.025, y - 0.01, 0], [side * 0.05, y - 0.03, 0]], 0.0006, clearLine(lc), 10));
      const h = hook(0.014);
      h.position.set(side * 0.05, y - 0.03, 0);
      h.rotation.z = side > 0 ? 0.3 : -0.3;
      g.add(h);
    }
    const lead = lathe([[0.0001, -0.03], [0.016, -0.022], [0.012, 0.012], [0.0001, 0.02]], std('#6c7077', 0.7, 0.2), 4);
    lead.position.y = -0.12;
    g.add(lead);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
      g.add(tube([[Math.cos(a) * 0.012, -0.14, Math.sin(a) * 0.012], [Math.cos(a) * 0.022, -0.152, Math.sin(a) * 0.022], [Math.cos(a) * 0.026, -0.17, Math.sin(a) * 0.026]], 0.0008, STEEL(), 8));
    }
  } else {
    // Running ledger: a lead on a sliding boom, a bead and swivel, and one long trace.
    g.add(lineBetween([-0.1, 0.02, 0], [0.02, 0.02, 0], lc, 0.0008));
    g.add(mesh(new THREE.CylinderGeometry(0.0025, 0.0025, 0.02, 8), soft('#2a2a2a'), -0.05, 0.02, 0, 0, 0, Math.PI / 2));
    g.add(lineBetween([-0.05, 0.02, 0], [-0.05, -0.005, 0], '#2a2a2a', 0.0007));
    const lead = leadWeight(3);
    lead.position.set(-0.05, -0.03, 0);
    g.add(lead);
    g.add(mesh(new THREE.SphereGeometry(0.003, 10, 8), glossy('#f2d21a'), -0.02, 0.02, 0));
    const sw = swivel(0.012);
    sw.rotation.z = Math.PI / 2;
    sw.position.set(0.0, 0.02, 0);
    g.add(sw);
    g.add(tube([[0.008, 0.02, 0], [0.05, 0.012, 0], [0.09, 0.016, 0], [0.13, 0.008, 0]], 0.0006, clearLine(lc), 16));
    const h = hook(0.018);
    h.rotation.z = Math.PI / 2;
    h.position.set(0.13, 0.008, 0);
    g.add(h);
  }
  return g;
}

// A coil of leader line, with the swivel, snap or ring it ends in.
function leader(id) {
  const g = new THREE.Group();
  if (id === 'wire') {
    const wire = std('#9aa3ad', 0.35, 0.85);
    g.add(tube([[-0.07, 0, 0], [-0.02, 0.004, 0], [0.03, -0.004, 0], [0.07, 0, 0]], 0.0008, wire, 24));
    const sw = swivel(0.012);
    sw.rotation.z = Math.PI / 2;
    sw.position.x = -0.078;
    g.add(sw);
    for (const x of [-0.068, 0.068]) g.add(alongX(0.0016, 0.0016, x - 0.003, x + 0.003, std('#c9ced4', 0.3, 0.9)));
    // A snap to clip the lure on.
    g.add(tube([[0.07, 0, 0], [0.085, 0.006, 0], [0.095, 0, 0], [0.085, -0.006, 0], [0.072, -0.002, 0]], 0.0008, STEEL(), 16));
  } else if (id === 'none') {
    // The main line tied straight on with a clinch knot.
    const lc = LINE_COLORS.lure;
    g.add(tube([[-0.08, 0.01, 0], [-0.03, 0, 0], [0.0, 0, 0]], 0.0009, std(lc, 0.6), 12));
    for (let i = 0; i < 5; i++) g.add(mesh(new THREE.TorusGeometry(0.0022, 0.0008, 6, 12), std(lc, 0.6), 0.002 + i * 0.0024, 0, 0, 0, Math.PI / 2, 0.4));
    g.add(mesh(new THREE.TorusGeometry(0.004, 0.0009, 8, 16), STEEL(), 0.018, 0, 0, 0, Math.PI / 2, 0));
  } else {
    // Leader material comes on its own little spool, labelled; its end tied to what it ends in.
    const shock = id === 'shock', tip = id === 'tippet';
    const color = tip ? '#e6e0d0' : '#dfe8ee';
    const spool = labelledSpool({
      big: shock ? '100 lb' : tip ? 'Tippet' : 'Fluoro', small: shock ? 'shock' : tip ? 'tapered' : 'leader',
      kind: shock ? 'shock' : tip ? 'tippet' : 'leader', lineColor: color, key: `leader|${id}`, R: 0.034, W: 0.018,
    });
    g.add(spool);
    const end = [[0.03, -0.012, 0.012], [0.05, -0.03, 0.014], [0.07, -0.032, 0.012]];
    g.add(tube(end, shock ? 0.0016 : 0.0006, clearLine(color, 0.85), 12));
    if (shock) put(g, ring(0.007, 0.0016, STEEL())).position.set(0.078, -0.032, 0.012);
    else if (!tip) {
      const sw = swivel(0.01);
      sw.rotation.z = Math.PI / 2;
      sw.position.set(0.076, -0.032, 0.012);
      g.add(sw);
    }
  }
  return g;
}

export function buildTerm(id) {
  if (FLOAT_TIP[id]) return floatRig(id);
  if (['hair', 'method', 'flapper', 'running'].includes(id)) return bottomRig(id);
  return leader(id);
}

/* ---------------- baits ---------------- */

// A wriggling segmented worm along a curve.
function worm(color, band, len, r, wiggle = 1) {
  const g = new THREE.Group();
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    pts.push([(t - 0.5) * len, Math.sin(t * Math.PI * 1.6 * wiggle) * len * 0.12, Math.cos(t * 3) * len * 0.04]);
  }
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const geo = new THREE.TubeGeometry(curve, 80, r, 10, false);
  // Taper the ends and ring the body with segments.
  const pos = geo.attributes.position, c = new THREE.Vector3(), v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    const seg = Math.floor(i / 11) / 80;
    curve.getPointAt(seg, c);
    v.fromBufferAttribute(pos, i).sub(c);
    const k = Math.min(1, seg * 6, (1 - seg) * 6) * (0.92 + 0.08 * Math.sin(seg * 140));
    v.multiplyScalar(Math.max(0.25, k));
    pos.setXYZ(i, c.x + v.x, c.y + v.y, c.z + v.z);
  }
  geo.computeVertexNormals();
  g.add(new THREE.Mesh(geo, std(color, 0.4, 0, { emissive: '#000000' })));
  if (band) {
    const p = curve.getPointAt(0.32);
    const t = curve.getTangentAt(0.32);
    const b = mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, len * 0.07, 12), std(band, 0.5), p.x, p.y, p.z);
    b.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), t);
    g.add(b);
  }
  g.userData.curve = curve;
  return g;
}

function bait(id) {
  const g = new THREE.Group();
  const H = (s, x, y, rz = 0) => {
    const h = hook(s);
    h.position.set(x, y, 0);
    h.rotation.z = rz;
    g.add(h);
  };
  switch (id) {
    case 'worm': {
      g.add(worm('#c8656a', '#e58a8a', 0.09, 0.0034, 1.2));
      H(0.022, -0.012, 0.022, 0.2);
      break;
    }
    case 'rag': {
      const w = worm('#a8463a', null, 0.1, 0.0032, 1.4);
      g.add(w);
      // Little paddle-like legs along each side.
      for (let i = 1; i < 30; i++) {
        const t = i / 30, p = w.userData.curve.getPointAt(t);
        for (const s of [-1, 1]) g.add(mesh(new THREE.ConeGeometry(0.0009, 0.004, 4), std('#d07a5a', 0.6), p.x, p.y + s * 0.0035, p.z, 0, 0, s > 0 ? 0 : Math.PI));
      }
      H(0.02, -0.02, 0.024, 0.2);
      break;
    }
    case 'lug': {
      const w = worm('#5a3426', '#3a2018', 0.075, 0.0048, 0.7);
      g.add(w);
      put(g, worm('#b0703a', null, 0.03, 0.0022, 0.4)).position.set(0.05, -0.004, 0);
      H(0.022, -0.01, 0.026, 0.2);
      break;
    }
    case 'maggot': {
      for (let i = 0; i < 5; i++) {
        const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.0028, 0.009, 4, 10), std('#f1e6c8', 0.45));
        m.position.set(Math.cos(i * 1.3) * 0.006, -0.012 + Math.sin(i * 2.1) * 0.004, Math.sin(i * 1.3) * 0.006);
        m.rotation.set(i * 0.6, i * 1.1, 0.4 + i * 0.5);
        g.add(m);
        for (let k = 0; k < 3; k++) {
          const band = mesh(new THREE.TorusGeometry(0.0028, 0.0004, 4, 12), std('#e2d3ad', 0.6), 0, -0.004 + k * 0.004, 0, Math.PI / 2, 0, 0);
          m.add(band);
        }
      }
      H(0.012, 0, 0.004);
      break;
    }
    case 'corn': {
      for (let i = 0; i < 3; i++) {
        const k = new THREE.Mesh(new THREE.SphereGeometry(0.005, 14, 10), glossy('#f2c629'));
        k.scale.set(1.1, 0.8, 0.75);
        k.position.set(0.002 * i, -0.012 + i * 0.0085, 0.001 * i);
        k.rotation.z = 0.3 * i;
        g.add(k);
        g.add(mesh(new THREE.SphereGeometry(0.0022, 8, 6), soft('#f8e9a8'), k.position.x - 0.004, k.position.y, k.position.z + 0.002));
      }
      H(0.016, -0.003, 0.012);
      break;
    }
    case 'bread': {
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(0.012, 2), soft('#f4ead2'));
      const p = m.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        const n = 0.8 + 0.25 * Math.sin(v.x * 900) * Math.cos(v.y * 700) + 0.1 * Math.sin(v.z * 1300);
        v.multiplyScalar(n);
        p.setXYZ(i, v.x * 1.3, v.y * 0.8, v.z);
      }
      m.geometry.computeVertexNormals();
      m.position.y = -0.01;
      g.add(m);
      g.add(mesh(new THREE.BoxGeometry(0.01, 0.003, 0.012), soft('#c9925a'), 0.012, -0.005, 0, 0, 0, 0.3));
      H(0.016, 0, 0.006);
      break;
    }
    case 'boilie': {
      for (const [x, y] of [[-0.009, 0], [0.011, -0.004]]) {
        const b = new THREE.Mesh(new THREE.SphereGeometry(0.0095, 24, 18), std('#a8692f', 0.75));
        b.position.set(x, y, 0);
        g.add(b);
        for (let i = 0; i < 18; i++) {
          const a = i * 2.4, e = Math.acos(1 - 2 * ((i + 0.5) / 18));
          g.add(mesh(new THREE.SphereGeometry(0.0009, 5, 4), soft(i % 2 ? '#6a3a1a' : '#e0b06a'), x + Math.sin(e) * Math.cos(a) * 0.0095, y + Math.cos(e) * 0.0095, Math.sin(e) * Math.sin(a) * 0.0095));
        }
      }
      break;
    }
    case 'prawn': {
      // A curled prawn: shell segments, tail fan, legs and long feelers.
      const segs = 7;
      for (let i = 0; i < segs; i++) {
        const t = i / (segs - 1), a = -0.3 + t * 2.2;
        const r = 0.0085 * (1 - t * 0.45);
        const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), glossy(i === 0 ? '#e8907a' : '#f0a690'));
        s.scale.set(1.3, 1, 0.95);
        s.position.set(Math.cos(a) * 0.016, Math.sin(a) * 0.016, 0);
        s.rotation.z = a + Math.PI / 2;
        g.add(s);
      }
      for (const d of [-0.4, 0, 0.4]) g.add(mesh(new THREE.ConeGeometry(0.003, 0.011, 4), glossy('#e8907a'), Math.cos(1.95) * 0.018, Math.sin(1.95) * 0.018 + d * 0.004, d * 0.004, 0, 0, 1.95 + Math.PI));
      for (let i = 0; i < 2; i++) g.add(tube([[0.016, -0.004, 0], [0.04, -0.02 - i * 0.006, 0.006], [0.07, -0.01 - i * 0.012, 0.01]], 0.0004, soft('#d47a64'), 12));
      for (let i = 0; i < 5; i++) g.add(tube([[0.006 - i * 0.004, -0.006 + i * 0.002, 0], [0.002 - i * 0.004, -0.004 + i * 0.003, 0.009]], 0.0005, soft('#e8907a'), 4));
      g.add(mesh(new THREE.SphereGeometry(0.0016, 8, 6), soft('#1a1512'), 0.019, -0.004, 0.005));
      H(0.02, -0.004, 0.022, 0.4);
      break;
    }
    case 'crab': {
      const shell = new THREE.Mesh(new THREE.SphereGeometry(0.016, 24, 14), std('#b86a3a', 0.55));
      shell.scale.set(1.25, 0.45, 1);
      g.add(shell);
      for (const s of [-1, 1]) {
        for (let i = 0; i < 4; i++) {
          const z = (i - 1.5) * 0.007;
          g.add(tube([[s * 0.014, 0, z], [s * 0.024, 0.004, z * 1.3], [s * 0.03, -0.006, z * 1.5]], 0.0012, std('#c9783f', 0.55), 8));
        }
        g.add(tube([[s * 0.01, 0, 0.012], [s * 0.016, 0.004, 0.022], [s * 0.012, 0.002, 0.03]], 0.0022, std('#c9783f', 0.55), 8));
        g.add(mesh(new THREE.SphereGeometry(0.004, 10, 8), std('#a85a2a', 0.5), s * 0.012, 0.002, 0.032));
      }
      g.rotation.x = 0.5;
      break;
    }
    case 'strip': {
      const geo = new THREE.PlaneGeometry(0.07, 0.016, 12, 2);
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) {
        const x = p.getX(i), y = p.getY(i);
        p.setY(i, y * (1 - Math.max(0, x / 0.035) * 0.7));
        p.setZ(i, Math.sin(x * 60) * 0.003);
      }
      geo.computeVertexNormals();
      const tex = (() => {
        const key = 'mackerel';
        if (TEX.has(key)) return TEX.get(key);
        const c = document.createElement('canvas');
        c.width = 128;
        c.height = 32;
        const x = c.getContext('2d');
        const grad = x.createLinearGradient(0, 0, 0, 32);
        grad.addColorStop(0, '#2f6a6a');
        grad.addColorStop(0.5, '#6aa0a8');
        grad.addColorStop(0.55, '#e8eef2');
        grad.addColorStop(1, '#f6f8fa');
        x.fillStyle = grad;
        x.fillRect(0, 0, 128, 32);
        x.strokeStyle = '#163a3a';
        x.lineWidth = 2;
        for (let i = 0; i < 9; i++) {
          x.beginPath();
          x.moveTo(i * 15, 0);
          x.quadraticCurveTo(i * 15 + 8, 8, i * 15 + 2, 15);
          x.stroke();
        }
        const t = new THREE.CanvasTexture(c);
        t.colorSpace = THREE.SRGBColorSpace;
        TEX.set(key, t);
        return t;
      })();
      g.add(new THREE.Mesh(geo, material('strip', () => new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25, metalness: 0.3, side: THREE.DoubleSide }))));
      H(0.022, -0.03, 0.02, 0.4);
      break;
    }
    default:
  }
  return g;
}

/* ---------------- lures ---------------- */

// A plug's body: a lathe along +x (nose at +x), painted dark on the back, its colour on the
// flanks and pale underneath, with eyes.
const _col = new THREE.Color();
function plugBody(len, r, back, side, belly, fat = 1) {
  const g = new THREE.Group();
  const prof = [];
  for (let i = 0; i <= 16; i++) {
    const t = i / 16;
    prof.push(new THREE.Vector2(Math.max(0.0002, r * Math.sin(Math.PI * Math.pow(t, 0.8)) * (t < 0.15 ? 0.6 + t * 2.7 : 1)), (t - 0.5) * len));
  }
  const geo = new THREE.LatheGeometry(prof, 36);
  const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3);
  const cb = new THREE.Color(back), cs = new THREE.Color(side), cl = new THREE.Color(belly);
  for (let i = 0; i < pos.count; i++) {
    // After the body is laid along +x, "up" is -x in the lathe's own space.
    const up = -pos.getX(i) / r;
    if (up > 0.25) _col.copy(cs).lerp(cb, Math.min(1, (up - 0.25) / 0.3));
    else if (up < -0.35) _col.copy(cs).lerp(cl, Math.min(1, (-up - 0.35) / 0.25));
    else _col.copy(cs);
    cols[i * 3] = _col.r;
    cols[i * 3 + 1] = _col.g;
    cols[i * 3 + 2] = _col.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
  const body = new THREE.Mesh(geo, std('#ffffff', 0.2, 0.08, { vertexColors: true }));
  body.rotation.z = -Math.PI / 2;
  body.scale.set(1, 1, fat);
  g.add(body);
  for (const s of [-1, 1]) {
    g.add(mesh(new THREE.SphereGeometry(r * 0.24, 12, 10), glossy('#f2e6a0'), len * 0.33, r * 0.25, s * r * 0.8 * fat));
    g.add(mesh(new THREE.SphereGeometry(r * 0.13, 10, 8), glossy('#141414'), len * 0.345, r * 0.27, s * r * 0.95 * fat));
  }
  return g;
}

// A clear diving lip at the nose: lipLen long, angled down by tilt (radians from horizontal).
function lip(len, width, tilt, x, y) {
  const shape = new THREE.Shape();
  shape.moveTo(0, -width / 2);
  shape.lineTo(len * 0.8, -width * 0.42);
  shape.quadraticCurveTo(len * 1.05, 0, len * 0.8, width * 0.42);
  shape.lineTo(0, width / 2);
  shape.lineTo(0, -width / 2);
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0012, bevelEnabled: false });
  const m = new THREE.Mesh(geo, material('lip', () => new THREE.MeshStandardMaterial({ color: '#b9d2dc', roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.82 })));
  // Lay it flat across the nose (the shape's width across the body), then tip it down.
  m.rotation.order = 'ZXY';
  m.rotation.set(Math.PI / 2, 0, -tilt);
  m.position.set(x, y, 0);
  return m;
}

function eyeAt(g, x, y) {
  const r = mesh(new THREE.TorusGeometry(0.002, 0.0005, 6, 12), STEEL(), x, y, 0, Math.PI / 2, 0, 0);
  g.add(r);
}

function hangTreble(g, x, y, s = 0.012) {
  g.add(mesh(new THREE.TorusGeometry(0.0022, 0.0004, 6, 12), STEEL(), x, y - 0.002, 0, 0, Math.PI / 2, 0));
  const t = treble(s);
  t.position.set(x, y - 0.0045, 0);
  g.add(t);
}

function spinnerLure(gold) {
  const g = new THREE.Group();
  const k = gold ? 0.75 : 1;
  g.add(alongX(0.0005, 0.0005, -0.03 * k, 0.04 * k, STEEL()));
  eyeAt(g, 0.043 * k, 0);
  // Clevis and blade, angled out like it's spinning.
  const shape = new THREE.Shape();
  shape.absellipse(0, 0, 0.007 * k, 0.014 * k, 0, Math.PI * 2);
  const blade = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.0006, bevelEnabled: true, bevelThickness: 0.0004, bevelSize: 0.0004, bevelSegments: 1, curveSegments: 24 }), gold ? GOLD() : CHROME());
  blade.position.set(0.02 * k, 0.006 * k, 0.004);
  blade.rotation.set(0.4, 0.5, Math.PI / 2 - 0.3);
  g.add(blade);
  g.add(mesh(new THREE.TorusGeometry(0.0025 * k, 0.0005, 6, 12), STEEL(), 0.03 * k, 0.001, 0, 0, Math.PI / 2, 0));
  for (let i = 0; i < 3; i++) g.add(mesh(new THREE.SphereGeometry(0.0022 * k, 12, 10), i === 1 ? glossy('#d24a3a') : GOLD(), 0.012 * k - i * 0.0045 * k, 0, 0));
  g.add(alongX(0.004 * k, 0.0025 * k, -0.018 * k, 0.001, gold ? std('#3a3a3a', 0.3, 0.6) : GOLD()));
  hangTreble(g, -0.03 * k, 0, 0.011 * k);
  // A tuft of red wool on the treble.
  for (let i = 0; i < 6; i++) g.add(tube([[-0.03 * k, -0.006 * k, 0], [-0.038 * k, -0.01 * k + i * 0.001, (i - 2.5) * 0.0012], [-0.046 * k, -0.012 * k + i * 0.0015, (i - 2.5) * 0.002]], 0.0005, soft('#c0302a'), 6));
  return g;
}

function lure(id) {
  const g = new THREE.Group();
  switch (id) {
    case 'spinner': return spinnerLure(false);
    case 'tspin': return spinnerLure(true);
    case 'spoon': {
      // A teardrop of curved chrome, its hollow face up, with a red stripe and a treble.
      const shape = new THREE.Shape();
      shape.moveTo(0.032, 0);
      shape.bezierCurveTo(0.03, 0.011, 0.005, 0.016, -0.018, 0.011);
      shape.bezierCurveTo(-0.034, 0.006, -0.034, -0.006, -0.018, -0.011);
      shape.bezierCurveTo(0.005, -0.016, 0.03, -0.011, 0.032, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.0008, bevelEnabled: false, curveSegments: 24 });
      const p = geo.attributes.position;
      for (let i = 0; i < p.count; i++) p.setZ(i, p.getZ(i) - 12 * (p.getY(i) ** 2) - 2 * (p.getX(i) ** 2));
      geo.computeVertexNormals();
      const m = new THREE.Mesh(geo, material('spoon', () => new THREE.MeshStandardMaterial({ color: '#e9eef3', roughness: 0.14, metalness: 1, side: THREE.DoubleSide })));
      m.rotation.x = Math.PI / 2;
      g.add(m);
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.03, 0.005), material('spoonstripe', () => new THREE.MeshStandardMaterial({ color: '#d24a3a', roughness: 0.3, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })));
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set(0.004, 0.0004, 0);
      g.add(stripe);
      g.add(mesh(new THREE.TorusGeometry(0.003, 0.0005, 6, 12), STEEL(), 0.036, 0, 0, Math.PI / 2, 0, 0));
      hangTreble(g, -0.036, 0, 0.011);
      return g;
    }
    case 'minnow': {
      g.add(plugBody(0.055, 0.0065, '#3f6a4a', '#d8dcd0', '#f3efe2'));
      g.add(lip(0.009, 0.008, 0.45, 0.026, -0.002));
      eyeAt(g, 0.034, -0.004);
      hangTreble(g, 0.006, -0.0065, 0.008);
      hangTreble(g, -0.026, -0.002, 0.008);
      return g;
    }
    case 'crankS': case 'crankD': {
      // Same fat body; the shallow one has a short steep lip, the deep one a long flat one.
      const deep = id === 'crankD';
      g.add(plugBody(0.06, 0.0135, deep ? '#4a5a2a' : '#2f7a3a', deep ? '#d8c04a' : '#e6d23a', deep ? '#f3ead0' : '#ff8a3a', 0.85));
      g.add(deep ? lip(0.04, 0.02, 0.32, 0.027, -0.004) : lip(0.013, 0.014, 1.05, 0.028, -0.003));
      eyeAt(g, deep ? 0.058 : 0.036, deep ? -0.012 : -0.013);
      hangTreble(g, 0.008, -0.0135, 0.011);
      hangTreble(g, -0.026, -0.006, 0.011);
      return g;
    }
    case 'jerk': {
      g.add(plugBody(0.11, 0.009, '#2d5a8a', '#cfd8de', '#f1f3f5', 0.8));
      g.add(lip(0.008, 0.009, 0.6, 0.052, -0.003));
      eyeAt(g, 0.058, -0.006);
      for (const x of [0.02, -0.015, -0.05]) hangTreble(g, x, -0.009, 0.01);
      return g;
    }
    case 'shad': case 'sandeel': {
      const eel = id === 'sandeel';
      const len = eel ? 0.11 : 0.08, r = eel ? 0.0055 : 0.0095;
      g.add(plugBody(len, r, eel ? '#3a6a7a' : '#5a7a3a', eel ? '#d8e2e6' : '#e8e4c8', eel ? '#f3f6f8' : '#f6f2e2', 0.75));
      // The paddle tail, and a lead jig head with the hook point coming out of the back.
      // The tail: a thin stem ending in a paddle that faces backwards (the sandeel's is a fork).
      g.add(alongX(r * 0.25, r * 0.3, -len / 2 - 0.008, -len / 2 + 0.004, soft(eel ? '#3a6a7a' : '#5a7a3a')));
      const paddle = new THREE.Mesh(new THREE.CylinderGeometry(eel ? 0.0045 : 0.0078, eel ? 0.0045 : 0.0078, 0.0016, 24), soft(eel ? '#3a6a7a' : '#5a7a3a'));
      paddle.rotation.z = Math.PI / 2;
      paddle.scale.set(1, 1, eel ? 0.5 : 1);
      paddle.position.x = -len / 2 - 0.009;
      g.add(paddle);
      g.add(mesh(new THREE.SphereGeometry(r * 1.1, 18, 14), std('#8a939c', 0.35, 0.7), len / 2 + 0.002, 0, 0));
      eyeAt(g, len / 2 + 0.002, r * 1.15);
      g.add(tube([[0, r * 0.9, 0], [-0.004, r * 1.6, 0], [-0.01, r * 1.4, 0]], 0.0006, STEEL(), 8));
      return g;
    }
    case 'creature': {
      // A soft craw on a weedless hook: body, ribbed tail, two flapping claws and feelers.
      const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.006, 0.03, 6, 14), soft('#4a3a5a'));
      body.rotation.z = Math.PI / 2;
      g.add(body);
      for (let i = 0; i < 6; i++) g.add(mesh(new THREE.TorusGeometry(0.0062, 0.0008, 6, 16), soft('#5a4a6a'), -0.004 + i * 0.004, 0, 0, 0, Math.PI / 2, 0));
      for (const s of [-1, 1]) {
        const claw = new THREE.Mesh(new THREE.SphereGeometry(0.008, 14, 10), soft('#5a4a6a'));
        claw.scale.set(1.8, 0.35, 1);
        claw.position.set(-0.03, 0.002, s * 0.012);
        claw.rotation.y = s * 0.5;
        g.add(claw);
        g.add(tube([[-0.016, 0, s * 0.003], [-0.032, 0, s * 0.006], [-0.05, 0.002, s * 0.012]], 0.0005, soft('#6a5a7a'), 8));
      }
      const h = hook(0.03, DARK());
      h.rotation.z = -Math.PI / 2;
      h.position.set(0.026, 0.004, 0);
      g.add(h);
      return g;
    }
    case 'popper': {
      g.add(plugBody(0.06, 0.011, '#2a3a2a', '#d8d23a', '#f6f0d0', 1));
      // The cupped face that spits water.
      g.add(mesh(new THREE.CylinderGeometry(0.009, 0.0105, 0.004, 24, 1, true), glossy('#c9302a'), 0.031, 0.001, 0, 0, 0, Math.PI / 2));
      g.add(mesh(new THREE.CircleGeometry(0.008, 24), soft('#6a1a1a'), 0.029, 0.001, 0, 0, -Math.PI / 2, 0));
      eyeAt(g, 0.034, -0.004);
      hangTreble(g, 0.004, -0.011, 0.011);
      hangTreble(g, -0.03, -0.004, 0.011);
      return g;
    }
    case 'stickbait': {
      g.add(plugBody(0.19, 0.013, '#2a6a9a', '#eef2f6', '#ffffff', 0.9));
      eyeAt(g, 0.096, 0);
      for (const x of [0.03, -0.06]) hangTreble(g, x, -0.013, 0.02);
      return g;
    }
    case 'sabiki': {
      // A string of six tiny hooks on short droppers, each dressed in a wisp of shiny fish skin
      // and flash, with a small lead at the bottom of the string.
      const len = 0.15, skins = ['#f0a2b6', '#e6f0ee', '#9ed8c2'];
      g.add(lineBetween([len / 2, 0, 0], [-len / 2, 0, 0], '#e8f0f2', 0.0004, 0.7));
      g.add(mesh(new THREE.TorusGeometry(0.0022, 0.0005, 6, 12), STEEL(), len / 2 + 0.002, 0, 0, 0, Math.PI / 2, 0));
      for (let i = 0; i < 6; i++) {
        const x = len / 2 - 0.012 - i * 0.022;
        g.add(lineBetween([x, 0, 0], [x - 0.006, -0.009, 0], '#e8f0f2', 0.0003, 0.7));
        const h = hook(0.007);
        h.position.set(x - 0.006, -0.009, 0);
        h.rotation.z = -0.5;
        g.add(h);
        const skin = new THREE.Mesh(new THREE.ConeGeometry(0.0018, 0.011, 6), glossy(skins[i % 3]));
        skin.position.set(x - 0.0085, -0.0135, 0);
        skin.rotation.z = Math.PI * 0.82;
        g.add(skin);
        g.add(mesh(new THREE.SphereGeometry(0.0011, 8, 6), std('#e8d070', 0.2, 0.6), x - 0.0055, -0.008, 0));
      }
      const lead = leadWeight(0.7);
      lead.rotation.z = Math.PI / 2;
      lead.position.x = -len / 2 - 0.012;
      g.add(lead);
      return g;
    }
    case 'metal': case 'mjig': {
      const big = id === 'mjig';
      const len = big ? 0.12 : 0.065;
      const shape = new THREE.Shape();
      shape.moveTo(-len / 2, 0);
      shape.quadraticCurveTo(0, big ? 0.009 : 0.0105, len / 2, 0);
      shape.quadraticCurveTo(0, big ? -0.009 : -0.0105, -len / 2, 0);
      const geo = new THREE.ExtrudeGeometry(shape, { depth: big ? 0.005 : 0.004, bevelEnabled: true, bevelThickness: 0.0012, bevelSize: 0.0012, bevelSegments: 2, curveSegments: 20 });
      geo.translate(0, 0, -0.0025);
      g.add(new THREE.Mesh(geo, CHROME()));
      // A painted back stripe: pink on the jig, blue on the casting metal.
      const back = new THREE.Mesh(geo.clone(), glossy(big ? '#e05a8a' : '#3a7ab0'));
      back.scale.set(0.96, 0.5, 1.08);
      back.position.y = big ? 0.003 : 0.0036;
      g.add(back);
      eyeAt(g, len / 2 + 0.003, 0);
      if (big) {
        // Assist hooks on short cords at the head.
        for (const s of [-1, 1]) {
          g.add(tube([[len / 2 + 0.003, 0, 0], [len / 2 - 0.004, -0.01, s * 0.006], [len / 2 - 0.012, -0.016, s * 0.006]], 0.0009, soft('#d8cfb8'), 8));
          const h = hook(0.018);
          h.position.set(len / 2 - 0.012, -0.016, s * 0.006);
          g.add(h);
        }
      } else hangTreble(g, -len / 2 - 0.003, 0, 0.012);
      return g;
    }
    default:
      return g;
  }
}

/* ---------------- flies and jigs ---------------- */

function fly(id) {
  const g = new THREE.Group();
  const h = hook(0.016, DARK());
  h.rotation.z = -Math.PI / 2;
  h.position.set(0.008, 0, 0);
  g.add(h);
  if (id === 'dry') {
    // Upright wings, a collar of hackle, a slim body and tails.
    g.add(alongX(0.0018, 0.0012, -0.01, 0.006, soft('#d9c07a')));
    for (let i = 0; i < 18; i++) {
      const a = (i / 18) * Math.PI * 2;
      g.add(tube([[0.004, 0, 0], [0.004, Math.cos(a) * 0.006, Math.sin(a) * 0.006]], 0.0003, soft('#8a6a4a'), 2));
    }
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.CircleGeometry(0.006, 16), material('wing', () => new THREE.MeshStandardMaterial({ color: '#e8e2d2', roughness: 0.7, transparent: true, opacity: 0.85, side: THREE.DoubleSide })));
      w.scale.set(0.55, 1, 1);
      w.position.set(0.003, 0.008, s * 0.0016);
      w.rotation.set(0, 0, s * 0.05);
      g.add(w);
    }
    for (let i = 0; i < 4; i++) g.add(tube([[-0.01, 0, 0], [-0.02, 0.002, (i - 1.5) * 0.0015]], 0.00025, soft('#6a5a40'), 2));
  } else if (id === 'nymph') {
    g.add(mesh(new THREE.SphereGeometry(0.0028, 14, 12), GOLD(), 0.008, 0, 0));
    g.add(alongX(0.0026, 0.0014, -0.008, 0.006, soft('#7a5230')));
    for (let i = 0; i < 6; i++) g.add(mesh(new THREE.TorusGeometry(0.0021 - i * 0.0001, 0.0003, 4, 12), GOLD(), -0.006 + i * 0.002, 0, 0, 0, Math.PI / 2, 0));
    for (let i = 0; i < 3; i++) g.add(tube([[-0.008, 0, 0], [-0.014, -0.0005, (i - 1) * 0.0012]], 0.0003, soft('#6a4a2a'), 2));
  } else {
    // Streamer: bead, chenille body with a palmered hackle, and a long marabou tail.
    g.add(mesh(new THREE.SphereGeometry(0.0032, 14, 12), GOLD(), 0.009, 0, 0));
    g.add(alongX(0.0032, 0.0028, -0.01, 0.006, soft('#1e1e22')));
    for (let i = 0; i < 12; i++) {
      const a = i * 1.9;
      g.add(tube([[-0.008 + i * 0.0012, 0, 0], [-0.01 + i * 0.0012, Math.cos(a) * 0.006, Math.sin(a) * 0.006]], 0.0003, soft('#2a2a30'), 2));
    }
    for (let i = 0; i < 10; i++) g.add(tube([[-0.01, 0, 0], [-0.025, Math.sin(i) * 0.003, (i - 4.5) * 0.0007], [-0.04, Math.sin(i * 1.7) * 0.005, (i - 4.5) * 0.0012]], 0.0005, soft('#18181c'), 8));
  }
  return g;
}

function egi(id) {
  const k = id === 'egi18' ? 0.75 : id === 'egi30' ? 1.2 : 1;
  const [cloth, back] = id === 'egi18' ? ['#f08a3a', '#3a8a5a'] : id === 'egi30' ? ['#e04a8a', '#3a4a9a'] : ['#f2c23a', '#c04a3a'];
  const g = new THREE.Group();
  g.add(plugBody(0.075 * k, 0.0095 * k, back, cloth, cloth, 0.85));
  // The weighted sinker plate under the chin, fins at the sides, and a crown of fine spikes.
  g.add(mesh(new THREE.BoxGeometry(0.016 * k, 0.003 * k, 0.008 * k), LEAD(), 0.028 * k, -0.009 * k, 0, 0, 0, -0.3));
  for (const s of [-1, 1]) g.add(mesh(new THREE.BoxGeometry(0.012 * k, 0.0012 * k, 0.008 * k), soft(cloth), 0.012 * k, 0.002 * k, s * 0.009 * k, 0, s * 0.3, 0));
  for (let row = 0; row < 2; row++) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 + row * 0.3;
      const r = 0.005 * k;
      g.add(tube([[-0.038 * k - row * 0.004 * k, Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6], [-0.044 * k - row * 0.004 * k, Math.cos(a) * r, Math.sin(a) * r], [-0.046 * k - row * 0.004 * k, Math.cos(a) * r * 1.3, Math.sin(a) * r * 1.3]], 0.00035, STEEL(), 4));
    }
  }
  eyeAt(g, 0.04 * k, 0.002);
  return g;
}

export function buildItem(id) {
  const it = TACKLE[id];
  if (!it) return new THREE.Group();
  if (it.type === 'bait') return bait(id);
  if (it.type === 'lure') return lure(id);
  if (it.type === 'fly') return fly(id);
  return egi(id);
}

/* ---------------- everything, by reference ---------------- */

// What to draw for a reference, and how to show it: { object, view: { yaw, pitch, ortho } }.
export function buildGear(ref, { closeUp = false, thick = 1, line } = {}) {
  if (ref.type === 'rod') {
    const rod = RODS[ref.id];
    const object = buildRod(rod, { thick, line });
    if (closeUp) {
      // Just the handle and reel: hide the rest of the blank from the frame.
      return { object, view: { yaw: -0.42, pitch: 0.2, focusX: object.userData.handle } };
    }
    return { object, view: { yaw: 0, pitch: 0.1, ortho: true } };
  }
  if (ref.type === 'reel') return { object: buildReel(RODS[ref.rod]), view: { yaw: -0.6, pitch: 0.25 } };
  if (ref.type === 'line') {
    const rod = RODS[ref.rod];
    return { object: buildSpool(rod, rod.lines.find((l) => l.id === ref.id) || rod.lines[0]), view: { yaw: 0.75, pitch: 0.25 } };
  }
  if (ref.type === 'term') {
    const vertical = FLOAT_TIP[ref.id] || ref.id === 'flapper';
    const spool = ['fluoro', 'tippet', 'shock'].includes(ref.id);
    return { object: buildTerm(ref.id), view: vertical ? { yaw: 0.3, pitch: 0.05, roll: -0.95 } : spool ? { yaw: 0.75, pitch: 0.25 } : { yaw: 0.35, pitch: 0.35 } };
  }
  if (ref.type === 'item') {
    const it = TACKLE[ref.id];
    const view = it?.type === 'bait' ? { yaw: 0.35, pitch: 0.4 } : it?.type === 'fly' ? { yaw: 0.6, pitch: 0.25 } : { yaw: 0.55, pitch: 0.3 };
    return { object: buildItem(ref.id), view };
  }
  return { object: new THREE.Group(), view: { yaw: 0, pitch: 0 } };
}

// Free a model's geometry (materials and textures are shared and kept).
export function disposeGear(object) {
  object.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
}

export { TERMS };
