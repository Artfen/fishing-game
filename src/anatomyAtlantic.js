// Anatomical recipes for the Atlantic roster ("The Living Atlantic"), built by anatomy.js. Each
// follows the identification features in the species register (FishBase, DORIS and regional
// guides; see register.js): body depth and outline, head and mouth, the number and placement of
// fins, the tail's shape, and the marks that tell a species from its look-alikes. Same
// conventions as the recipes in anatomy.js: nose at +z, back up, about one unit long; t runs
// along the body from the snout (0) to the tail stalk (1); paint draws on a skin laid out snout
// to tail (u) and belly to back (v).
//
// Shared shapes: a family's body is written once and varied, so a bream looks like a bream, but
// each species keeps its own proportions, fins and marks.

const sparidFins = ({ spines = 11, d0 = 0.27, d1 = 0.58, d2 = 0.8, dh = 0.08, sh = 0.06, a0 = 0.6, a1 = 0.8, ah = 0.055, pect = 0.15, fork = 0.32, tail = 0.13, colors = {} } = {}) => [
  { kind: 'dorsal', shape: 'spiny', t0: d0, t1: d1, h: dh, spines, profile: [[0, 0.6], [0.2, 1], [1, 0.75]], color: colors.dorsal, edge: colors.dorsalEdge },
  { kind: 'dorsal', t0: d1, t1: d2, h: sh, profile: [[0, 0.95], [0.3, 1], [1, 0.4]], rays: 13, color: colors.dorsal, edge: colors.dorsalEdge },
  { kind: 'anal', t0: a0, t1: a1, h: ah, profile: [[0, 0.9], [0.3, 1], [1, 0.4]], rays: 11, color: colors.anal },
  { kind: 'pectoral', t: d0 + 0.01, a: 0.14, len: pect, splay: 0.35, droop: 0.15, profile: [[0, 0.3], [0.25, 0.9], [0.7, 0.55], [1, 0.02]], color: colors.pectoral },
  { kind: 'pelvic', t: d0 + 0.06, a: 0.04, len: 0.065, splay: 0.3, droop: 0.5, color: colors.pelvic },
  { kind: 'caudal', shape: 'forked', h: tail, fork, rays: 17, color: colors.caudal, edge: colors.caudalEdge, edgeFrom: 0.6 },
];

// A tuna's fins: first dorsal, second dorsal and anal, finlets, keels and a crescent tail.
const tunaFins = ({ d0 = 0.28, d1 = 0.46, dh = 0.07, gap = 0.02, s0, s1, sh = 0.06, finlets = 8, fl = 0.018, pect = 0.11, tail = 0.17, colors = {}, dProfile } = {}) => [
  { kind: 'dorsal', shape: 'spiny', t0: d0, t1: d1, h: dh, spines: 13, profile: dProfile || [[0, 1], [0.25, 0.75], [0.7, 0.3], [1, 0.12]], color: colors.dorsal },
  { kind: 'dorsal', t0: s0 ?? d1 + gap, t1: s1 ?? d1 + gap + 0.08, h: sh, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 12, color: colors.second },
  { kind: 'anal', t0: (s0 ?? d1 + gap) + 0.02, t1: (s1 ?? d1 + gap + 0.08) + 0.02, h: sh * 0.9, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 12, color: colors.second },
  { kind: 'finlets', t0: (s1 ?? d1 + gap + 0.08) + 0.03, step: (0.94 - ((s1 ?? d1 + gap + 0.08) + 0.03)) / finlets, count: finlets, h: fl },
  { kind: 'keel', t: 0.9, len: 0.09, h: 0.01 },
  { kind: 'pectoral', t: 0.24, a: 0.24, len: pect, splay: 0.35, droop: 0.12, color: colors.pectoral },
  { kind: 'pelvic', t: 0.27, a: 0.05, len: 0.045, splay: 0.3, droop: 0.6 },
  { kind: 'caudal', shape: 'lunate', h: tail, rays: 22, color: colors.caudal },
];

// Bars across the body, as on many breams (u0…u1, from the back down to about vEnd).
function bars(P, u0, u1, n, color, alpha, width, vEnd = 0.3, alternate = 0) {
  for (let k = 0; k < n; k++) {
    const u = u0 + (k / Math.max(1, n - 1)) * (u1 - u0);
    P.line([[u, 0.98], [u + 0.01, 0.65], [u, vEnd]], width * (alternate && k % 2 ? alternate : 1), color, alpha * (alternate && k % 2 ? 0.55 : 1));
  }
}
// Lengthwise lines, as on salema, bogue or two-banded bream.
function stripes(P, n, v0, v1, color, alpha, width, u0 = 0.18, u1 = 1) {
  for (let k = 0; k < n; k++) {
    const v = v0 + (k / Math.max(1, n - 1)) * (v1 - v0);
    P.line([[u0, v], [0.45, v + 0.02], [0.75, v - 0.02], [u1, v - 0.05]], width, color, alpha);
  }
}

export const ATLANTIC_ANATOMY = {
  /* ================= bass ================= */

  // Spotted seabass, Dicentrarchus punctatus: a sea bass, a little chubbier, with a larger eye and
  // black spots over the back running down onto the flanks.
  baila: {
    plan: 'fish', bodyLen: 0.8, round: 2.3, mode: 0,
    top: [[0, 0.006], [0.04, 0.03], [0.1, 0.054], [0.2, 0.09], [0.35, 0.118], [0.55, 0.106], [0.75, 0.064], [0.9, 0.038], [1, 0.034]],
    bottom: [[0, -0.01], [0.04, -0.028], [0.1, -0.054], [0.2, -0.084], [0.4, -0.098], [0.6, -0.084], [0.78, -0.05], [0.92, -0.034], [1, -0.03]],
    width: [[0, 0.004], [0.08, 0.036], [0.25, 0.062], [0.45, 0.064], [0.7, 0.042], [0.9, 0.019], [1, 0.013]],
    mouth: { len: 0.12, y: -0.004, slope: -0.09, gape: 0.012 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.085, y: 0.027, r: 0.022, iris: '#cdbf90' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.47, h: 0.095, spines: 9, profile: [[0, 0.75], [0.25, 1], [1, 0.45]] },
      { kind: 'dorsal', t0: 0.52, t1: 0.72, h: 0.075, profile: [[0, 0.85], [0.2, 1], [0.8, 0.55], [1, 0.3]], rays: 13 },
      { kind: 'anal', t0: 0.6, t1: 0.75, h: 0.06, profile: [[0, 0.8], [0.3, 1], [1, 0.35]], rays: 12 },
      { kind: 'pectoral', t: 0.25, a: 0.16, len: 0.1, splay: 0.45, droop: 0.2 },
      { kind: 'pelvic', t: 0.3, a: 0.04, len: 0.065, splay: 0.3, droop: 0.45 },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.2, rays: 17 },
    ],
    colors: { back: '#4a5866', flank: '#bec7cd', belly: '#f1f3f1', fin: '#8d979f', split: 0.42 },
    scaleRows: [62, 16], metal: 0.28, sheen: 0.45,
    paint: (P) => {
      P.line([[0.22, 0.7], [0.35, 0.74], [0.6, 0.72], [0.85, 0.6], [1, 0.55]], 2, '#4d5a64', 0.6);
      P.blob(0.205, 0.72, 0.014, 0.07, '#2c3238', 0.85, 0.4);
      // The black spots: thick over the back, thinning out down the flanks.
      P.noise(41, 120, '#15191c', 0.85, 0.006, 0.016, 0.62, 0.98);
      P.noise(43, 50, '#15191c', 0.7, 0.005, 0.013, 0.45, 0.65);
    },
  },

  /* ================= seabreams ================= */

  // Black seabream, Spondyliosoma cantharus: oval, the back as rounded as the belly; silvery
  // grey with broken lengthwise lines; dark fins, the tail with a black rear edge; small mouth.
  blackbream: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0, lod: 0.8,
    top: [[0, 0], [0.04, 0.03], [0.12, 0.085], [0.28, 0.135], [0.45, 0.14], [0.65, 0.11], [0.84, 0.055], [1, 0.033]],
    bottom: [[0, -0.012], [0.06, -0.05], [0.2, -0.1], [0.38, -0.125], [0.56, -0.112], [0.76, -0.066], [0.9, -0.037], [1, -0.03]],
    width: [[0, 0.004], [0.08, 0.026], [0.25, 0.04], [0.45, 0.04], [0.7, 0.027], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.06, y: -0.006, slope: -0.04, gape: 0.008 }, gill: { t: 0.24, curve: 0.04 },
    eye: { t: 0.1, y: 0.03, r: 0.018, iris: '#b8b8a8' },
    fins: sparidFins({ spines: 11, colors: { dorsal: '#3c4248', anal: '#3c4248', pelvic: '#2c3036', caudal: '#4a5056', caudalEdge: '#141618' } }),
    colors: { back: '#3e454e', flank: '#9aa2a8', belly: '#dfe2e2', fin: '#4c535a', split: 0.42 },
    scaleRows: [44, 15], metal: 0.25, sheen: 0.4,
    paint: (P) => {
      // Broken lengthwise lines along the flanks, and the dark lateral line.
      for (let k = 0; k < 8; k++) {
        const v = 0.3 + k * 0.08;
        for (let u = 0.24; u < 0.95; u += 0.12) P.line([[u, v], [u + 0.08, v - 0.012]], 1.6, '#4a5258', 0.35);
      }
      P.line([[0.24, 0.8], [0.45, 0.83], [0.7, 0.74], [1, 0.6]], 2, '#262b30', 0.6);
      P.band(0.82, 1, '#2e343a', 0.35);
    },
  },

  // White seabream, Diplodus sargus/cadenati: deep oval, silver with thin dark bars, a black
  // saddle on the tail stalk, the gill cover edged black, pelvic fins with a white leading edge.
  whitebream: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0, lod: 0.8,
    top: [[0, -0.002], [0.04, 0.032], [0.12, 0.095], [0.26, 0.15], [0.42, 0.16], [0.62, 0.122], [0.82, 0.058], [1, 0.034]],
    bottom: [[0, -0.014], [0.06, -0.055], [0.18, -0.1], [0.35, -0.118], [0.55, -0.104], [0.75, -0.064], [0.9, -0.036], [1, -0.029]],
    width: [[0, 0.004], [0.08, 0.028], [0.25, 0.042], [0.45, 0.041], [0.7, 0.028], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.065, y: -0.01, slope: -0.04, gape: 0.008 }, gill: { t: 0.24, curve: 0.04 },
    eye: { t: 0.11, y: 0.036, r: 0.018, iris: '#d0c8a8' },
    fins: sparidFins({ spines: 11, colors: { pelvic: '#30343a', caudal: '#9aa0a6', caudalEdge: '#25292d' } }),
    colors: { back: '#59616a', flank: '#c9ced0', belly: '#f3f3f0', fin: '#8a9096', split: 0.4 },
    scaleRows: [46, 16], metal: 0.32, sheen: 0.5,
    paint: (P) => {
      bars(P, 0.3, 0.86, 9, '#30363c', 0.42, 6, 0.3, 0.6);
      // The black saddle on the tail stalk.
      P.blob(0.93, 0.62, 0.035, 0.32, '#111315', 0.95, 0.35);
      // The black edge of the gill cover.
      P.line([[0.25, 0.82], [0.268, 0.6], [0.262, 0.38], [0.245, 0.22]], 4, '#15181b', 0.75);
    },
  },

  // Two-banded seabream, Diplodus vulgaris: pointed head and small mouth; a black band across the
  // nape and another round the tail stalk; fine yellow lines along a silver body; black pelvics.
  twobanded: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0, lod: 0.75,
    top: [[0, 0], [0.04, 0.035], [0.12, 0.1], [0.26, 0.155], [0.42, 0.162], [0.62, 0.124], [0.82, 0.058], [1, 0.033]],
    bottom: [[0, -0.012], [0.06, -0.05], [0.18, -0.096], [0.35, -0.116], [0.55, -0.104], [0.75, -0.064], [0.9, -0.036], [1, -0.029]],
    width: [[0, 0.004], [0.08, 0.027], [0.25, 0.041], [0.45, 0.04], [0.7, 0.027], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.06, y: -0.008, slope: -0.04, gape: 0.007 }, gill: { t: 0.24, curve: 0.04 },
    eye: { t: 0.11, y: 0.036, r: 0.02, iris: '#d8c890' },
    fins: sparidFins({ spines: 11, colors: { pelvic: '#141414', anal: '#6a6a60', caudal: '#9a968a', caudalEdge: '#3a3830' } }),
    colors: { back: '#6a6656', flank: '#cac7ba', belly: '#f2f0e8', fin: '#8f8a76', split: 0.42 },
    scaleRows: [44, 16], metal: 0.3, sheen: 0.45,
    paint: (P) => {
      stripes(P, 12, 0.22, 0.86, '#c8a848', 0.4, 1.4, 0.25, 0.9);
      // The black band across the nape, from the dorsal origin down behind the gill cover.
      P.line([[0.31, 1], [0.3, 0.85], [0.285, 0.62], [0.275, 0.42]], 34, '#111111', 0.92);
      // And the band round the tail stalk.
      P.line([[0.9, 1], [0.905, 0.5], [0.9, 0]], 26, '#111111', 0.92);
    },
  },

  // Striped seabream, Lithognathus mormyrus: elongate for a bream, with a long pointed snout
  // (darker on top); about fourteen thin dark bars, alternately strong and faint; forked tail.
  striped: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0, lod: 0.8,
    top: [[0, -0.004], [0.06, 0.022], [0.14, 0.06], [0.28, 0.1], [0.45, 0.108], [0.65, 0.085], [0.84, 0.045], [1, 0.03]],
    bottom: [[0, -0.016], [0.08, -0.04], [0.2, -0.074], [0.38, -0.088], [0.56, -0.08], [0.76, -0.05], [0.9, -0.032], [1, -0.027]],
    width: [[0, 0.003], [0.1, 0.024], [0.28, 0.036], [0.45, 0.036], [0.7, 0.025], [0.9, 0.012], [1, 0.009]],
    mouth: { len: 0.07, y: -0.014, slope: -0.03, gape: 0.008 }, gill: { t: 0.25, curve: 0.035 },
    eye: { t: 0.13, y: 0.024, r: 0.017, iris: '#c8c4b0' },
    fins: sparidFins({ spines: 11, d0: 0.3, d1: 0.58, d2: 0.8, dh: 0.065, sh: 0.05, tail: 0.11, fork: 0.35 }),
    colors: { back: '#7c7c74', flank: '#d0d1ca', belly: '#f2f2ec', fin: '#9a9a90', split: 0.42 },
    scaleRows: [56, 15], metal: 0.32, sheen: 0.5,
    paint: (P) => {
      bars(P, 0.26, 0.94, 14, '#3e3e38', 0.5, 4, 0.22, 0.45);
      P.band(0.8, 1, '#5a5a52', 0.5, 0, 0.16); // the darker top of the snout
    },
  },

  // Redbanded seabream (urta), Pagrus auriga: deep, steep-headed; pinkish-red with four or five
  // dark red bands, alternately wide and narrow; long threadlike third and fourth dorsal spines;
  // a dark face; caudal grey-pink with black edges.
  urta: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0,
    top: [[0, -0.004], [0.04, 0.04], [0.12, 0.11], [0.26, 0.16], [0.42, 0.168], [0.62, 0.13], [0.82, 0.06], [1, 0.035]],
    bottom: [[0, -0.016], [0.06, -0.058], [0.18, -0.106], [0.35, -0.126], [0.55, -0.112], [0.75, -0.068], [0.9, -0.038], [1, -0.03]],
    width: [[0, 0.005], [0.08, 0.03], [0.25, 0.046], [0.45, 0.045], [0.7, 0.03], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.075, y: -0.012, slope: -0.05, gape: 0.01 }, gill: { t: 0.25, curve: 0.04 },
    eye: { t: 0.11, y: 0.04, r: 0.018, iris: '#c8a070' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.27, t1: 0.58, h: 0.085, spines: 12, profile: [[0, 0.7], [0.1, 1.9], [0.2, 1.7], [0.35, 1], [1, 0.75]] },
      { kind: 'dorsal', t0: 0.58, t1: 0.8, h: 0.06, profile: [[0, 0.95], [0.3, 1], [1, 0.4]], rays: 10 },
      { kind: 'anal', t0: 0.6, t1: 0.8, h: 0.055, profile: [[0, 0.9], [0.3, 1], [1, 0.4]], rays: 8 },
      { kind: 'pectoral', t: 0.28, a: 0.14, len: 0.16, splay: 0.35, droop: 0.15, profile: [[0, 0.3], [0.25, 0.9], [0.7, 0.55], [1, 0.02]] },
      { kind: 'pelvic', t: 0.33, a: 0.04, len: 0.065, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'forked', h: 0.13, fork: 0.28, rays: 17, color: '#c49a94', edge: '#2a1e1e', edgeFrom: 0.75 },
    ],
    colors: { back: '#a85c56', flank: '#dca89a', belly: '#f4e6de', fin: '#c47c70', split: 0.42 },
    scaleRows: [44, 16], metal: 0.22, sheen: 0.4,
    paint: (P) => {
      // Four or five dark red bands, alternately wide and narrow.
      [[0.3, 16], [0.42, 8], [0.54, 16], [0.67, 8], [0.8, 14]].forEach(([u, w]) => P.line([[u, 0.98], [u + 0.012, 0.6], [u, 0.2]], w, '#7a2a26', 0.5));
      P.band(0.4, 1, '#5a2a26', 0.35, 0, 0.12); // the dark face
      P.line([[0.255, 0.85], [0.27, 0.55], [0.255, 0.25]], 4, '#3a1e1c', 0.5);
    },
  },

  // Red porgy, Pagrus pagrus: deep, compressed, silvery-pink; a sloping, convex head; a dark spot
  // at the pectoral axil; a forked pink tail with white tips to the lobes.
  redporgy: {
    plan: 'fish', bodyLen: 0.78, round: 2.1, mode: 0,
    top: [[0, -0.004], [0.04, 0.036], [0.12, 0.1], [0.26, 0.152], [0.42, 0.16], [0.62, 0.124], [0.82, 0.058], [1, 0.034]],
    bottom: [[0, -0.016], [0.06, -0.056], [0.18, -0.1], [0.35, -0.12], [0.55, -0.108], [0.75, -0.066], [0.9, -0.037], [1, -0.03]],
    width: [[0, 0.005], [0.08, 0.03], [0.25, 0.045], [0.45, 0.044], [0.7, 0.029], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.075, y: -0.012, slope: -0.05, gape: 0.01 }, gill: { t: 0.25, curve: 0.04 },
    eye: { t: 0.11, y: 0.04, r: 0.018, iris: '#d0b090' },
    fins: sparidFins({ spines: 12, colors: { dorsal: '#d49088', caudal: '#e09c94', caudalEdge: '#f6f0ee' } }),
    colors: { back: '#b86e66', flank: '#e4b2a6', belly: '#f6eae4', fin: '#d4928a', split: 0.4 },
    scaleRows: [46, 16], metal: 0.25, sheen: 0.45,
    paint: (P) => {
      P.blob(0.31, 0.44, 0.012, 0.05, '#4a2a2a', 0.8, 0.4); // the dark pectoral axil
      P.line([[0.24, 0.78], [0.45, 0.82], [0.7, 0.72], [1, 0.58]], 1.5, '#9a5a54', 0.4);
      P.noise(51, 40, '#f6e2dc', 0.2, 0.012, 0.03, 0.3, 0.9);
    },
  },

  // Common pandora, Pagellus erythrinus: elongate oval, straight head profile with a pointed
  // snout; silvery pink with a bluish sheen and small blue spots above; the upper edge of the gill
  // cover carmine; a red spot at the pectoral base; the tail without white tips.
  pandora: {
    plan: 'fish', bodyLen: 0.79, round: 2.15, mode: 0, lod: 0.8,
    top: [[0, -0.004], [0.06, 0.03], [0.14, 0.074], [0.28, 0.118], [0.45, 0.126], [0.65, 0.098], [0.84, 0.05], [1, 0.031]],
    bottom: [[0, -0.014], [0.07, -0.046], [0.2, -0.084], [0.38, -0.1], [0.56, -0.09], [0.76, -0.056], [0.9, -0.034], [1, -0.028]],
    width: [[0, 0.004], [0.09, 0.026], [0.27, 0.039], [0.45, 0.039], [0.7, 0.026], [0.9, 0.012], [1, 0.009]],
    mouth: { len: 0.07, y: -0.012, slope: -0.04, gape: 0.008 }, gill: { t: 0.25, curve: 0.035 },
    eye: { t: 0.115, y: 0.03, r: 0.017, iris: '#d4b8a0' },
    fins: sparidFins({ spines: 12, d0: 0.28, dh: 0.07, sh: 0.055, tail: 0.12, colors: { dorsal: '#e0a8a0', caudal: '#dca098' } }),
    colors: { back: '#c47e7a', flank: '#e8c0b8', belly: '#f6eeea', fin: '#d8a29a', split: 0.42 },
    scaleRows: [52, 16], metal: 0.3, sheen: 0.5,
    paint: (P) => {
      P.noise(61, 70, '#4a8ad0', 0.7, 0.004, 0.012, 0.62, 0.95); // small blue spots above
      P.line([[0.235, 0.86], [0.255, 0.78], [0.262, 0.7]], 5, '#b8203a', 0.85); // carmine edge of the gill cover
      P.blob(0.295, 0.46, 0.01, 0.04, '#c03030', 0.8, 0.5); // red spot at the pectoral base
    },
  },

  // Common dentex, Dentex dentex: a big bream with a massive head, thick lips and strong canines;
  // silvery with blue and pink reflections, young darker-spotted.
  dentex: {
    plan: 'fish', bodyLen: 0.79, round: 2.15, mode: 0,
    top: [[0, -0.002], [0.04, 0.04], [0.12, 0.1], [0.25, 0.14], [0.42, 0.148], [0.62, 0.115], [0.82, 0.056], [1, 0.034]],
    bottom: [[0, -0.02], [0.06, -0.058], [0.18, -0.098], [0.35, -0.112], [0.55, -0.1], [0.75, -0.062], [0.9, -0.036], [1, -0.029]],
    width: [[0, 0.006], [0.08, 0.034], [0.25, 0.05], [0.45, 0.048], [0.7, 0.031], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.09, y: -0.016, slope: -0.05, gape: 0.012, lips: 0.12 }, gill: { t: 0.26, curve: 0.045 },
    eye: { t: 0.11, y: 0.042, r: 0.017, iris: '#c8b080' },
    fins: sparidFins({ spines: 11, d0: 0.28, colors: { dorsal: '#b49aa8', caudal: '#b8a0ac' } }),
    colors: { back: '#7a7884', flank: '#cac0c6', belly: '#f0ecea', fin: '#a88e98', split: 0.42 },
    scaleRows: [50, 16], metal: 0.32, sheen: 0.55,
    paint: (P) => {
      P.noise(71, 45, '#2e4a8a', 0.55, 0.005, 0.014, 0.55, 0.95); // dark blue spots
      P.noise(73, 30, '#e0b0c0', 0.2, 0.02, 0.06, 0.3, 0.8); // pink reflections
      P.blob(0.78, 0.82, 0.02, 0.06, '#7a2a3a', 0.6, 0.5); // wine-red spot under the last dorsal rays
    },
  },

  /* ================= grunts ================= */

  // Rubberlip grunt, Plectorhinchus mediterraneus: deep and elongate with a small head and long
  // snout; thick fleshy lips; one continuous dorsal fin; greyish-violet back, silvery belly.
  borriquete: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0,
    top: [[0, -0.004], [0.06, 0.03], [0.14, 0.072], [0.28, 0.122], [0.45, 0.13], [0.65, 0.1], [0.84, 0.05], [1, 0.034]],
    bottom: [[0, -0.02], [0.07, -0.05], [0.2, -0.092], [0.38, -0.11], [0.56, -0.1], [0.76, -0.062], [0.9, -0.037], [1, -0.03]],
    width: [[0, 0.006], [0.09, 0.03], [0.27, 0.046], [0.45, 0.046], [0.7, 0.03], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.08, y: -0.018, slope: -0.03, gape: 0.012, lips: 0.85 }, gill: { t: 0.25, curve: 0.04 },
    eye: { t: 0.11, y: 0.028, r: 0.016, iris: '#b8b0a0' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.28, t1: 0.56, h: 0.075, spines: 12, profile: [[0, 0.7], [0.25, 1], [1, 0.6]] },
      { kind: 'dorsal', t0: 0.56, t1: 0.8, h: 0.06, profile: [[0, 0.8], [0.3, 1], [1, 0.45]], rays: 18 },
      { kind: 'anal', t0: 0.64, t1: 0.79, h: 0.055, profile: [[0, 0.9], [0.4, 1], [1, 0.4]], rays: 8 },
      { kind: 'pectoral', t: 0.27, a: 0.15, len: 0.12, splay: 0.4, droop: 0.2 },
      { kind: 'pelvic', t: 0.31, a: 0.04, len: 0.07, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'forked', h: 0.12, fork: 0.15, rays: 17 },
    ],
    colors: { back: '#5c5a68', flank: '#aaaeb4', belly: '#e8eae8', fin: '#6e6c78', split: 0.44 },
    scaleRows: [60, 16], metal: 0.22, sheen: 0.4,
    paint: (P) => {
      P.line([[0.0, 0.4], [0.08, 0.38]], 9, '#c4907a', 0.7); // the fleshy lips
      P.line([[0.0, 0.5], [0.08, 0.5]], 9, '#c4907a', 0.6);
      P.line([[0.24, 0.82], [0.26, 0.55], [0.245, 0.28]], 2, '#4a4850', 0.4); // serrated cheek edge
    },
  },

  // Bastard grunt, Pomadasys incisus: oval; brownish back and silvery belly; a dark blotch at the
  // upper corner of the gill cover; bright yellow pelvic and anal fins.
  roncador: {
    plan: 'fish', bodyLen: 0.79, round: 2.2, mode: 0, lod: 0.8,
    top: [[0, -0.002], [0.05, 0.03], [0.13, 0.074], [0.28, 0.112], [0.45, 0.118], [0.65, 0.092], [0.84, 0.048], [1, 0.032]],
    bottom: [[0, -0.016], [0.07, -0.048], [0.2, -0.086], [0.38, -0.1], [0.56, -0.09], [0.76, -0.056], [0.9, -0.034], [1, -0.028]],
    width: [[0, 0.005], [0.09, 0.028], [0.27, 0.042], [0.45, 0.042], [0.7, 0.028], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.08, y: -0.012, slope: -0.05, gape: 0.01 }, gill: { t: 0.25, curve: 0.04 },
    eye: { t: 0.105, y: 0.03, r: 0.019, iris: '#c8b890' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.28, t1: 0.56, h: 0.08, spines: 12, profile: [[0, 0.7], [0.2, 1], [1, 0.55]] },
      { kind: 'dorsal', t0: 0.56, t1: 0.8, h: 0.055, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 15 },
      { kind: 'anal', t0: 0.64, t1: 0.79, h: 0.055, profile: [[0, 0.9], [0.4, 1], [1, 0.4]], rays: 9, color: '#e0c03a' },
      { kind: 'pectoral', t: 0.27, a: 0.15, len: 0.12, splay: 0.4, droop: 0.2 },
      { kind: 'pelvic', t: 0.31, a: 0.04, len: 0.07, splay: 0.3, droop: 0.5, color: '#e8c838' },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.18, rays: 17 },
    ],
    colors: { back: '#6c665a', flank: '#bcbab2', belly: '#ecece6', fin: '#86867e', split: 0.42 },
    scaleRows: [52, 15], metal: 0.25, sheen: 0.4,
    paint: (P) => {
      P.blob(0.235, 0.8, 0.015, 0.07, '#141416', 0.9, 0.35); // dark blotch at the top of the gill cover
      bars(P, 0.32, 0.86, 6, '#55524a', 0.18, 8, 0.4);
    },
  },

  /* ================= predators of rock and open water ================= */

  // Pollack, Pollachius pollachius: elongate gadid with a jutting lower jaw and a large eye; three
  // dorsal and two anal fins; no chin barbel; the lateral line dark and curved over the pectoral.
  pollack: {
    plan: 'fish', bodyLen: 0.84, round: 2.3, mode: 0,
    top: [[0, 0.004], [0.05, 0.028], [0.12, 0.054], [0.25, 0.084], [0.42, 0.09], [0.62, 0.072], [0.82, 0.04], [1, 0.024]],
    bottom: [[0, -0.016], [0.05, -0.034], [0.12, -0.056], [0.28, -0.08], [0.45, -0.082], [0.65, -0.064], [0.84, -0.036], [1, -0.022]],
    width: [[0, 0.004], [0.08, 0.032], [0.25, 0.05], [0.45, 0.05], [0.7, 0.032], [0.9, 0.014], [1, 0.009]],
    mouth: { len: 0.11, y: -0.006, slope: -0.07, gape: 0.012 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.085, y: 0.024, r: 0.02, iris: '#c8b070' },
    fins: [
      { kind: 'dorsal', t0: 0.28, t1: 0.42, h: 0.07, profile: [[0, 0.6], [0.25, 1], [1, 0.25]], rays: 12 },
      { kind: 'dorsal', t0: 0.46, t1: 0.66, h: 0.05, profile: [[0, 0.7], [0.25, 1], [1, 0.3]], rays: 18 },
      { kind: 'dorsal', t0: 0.7, t1: 0.86, h: 0.045, profile: [[0, 0.7], [0.3, 1], [1, 0.3]], rays: 16 },
      { kind: 'anal', t0: 0.42, t1: 0.64, h: 0.045, profile: [[0, 0.5], [0.25, 1], [1, 0.3]], rays: 26 },
      { kind: 'anal', t0: 0.69, t1: 0.85, h: 0.04, profile: [[0, 0.7], [0.3, 1], [1, 0.3]], rays: 17 },
      { kind: 'pectoral', t: 0.24, a: 0.17, len: 0.1, splay: 0.45, droop: 0.2 },
      { kind: 'pelvic', t: 0.22, a: 0.03, len: 0.06, splay: 0.3, droop: 0.55 },
      { kind: 'caudal', shape: 'truncate', h: 0.09, rays: 20 },
    ],
    colors: { back: '#55522e', flank: '#aaa47a', belly: '#ece8d6', fin: '#76704a', split: 0.46 },
    scaleRows: [80, 20], metal: 0.15, sheen: 0.35,
    paint: (P) => {
      // The dark lateral line, arching high over the pectoral fin, then straight to the tail.
      P.line([[0.2, 0.74], [0.3, 0.84], [0.42, 0.8], [0.55, 0.62], [0.75, 0.55], [1, 0.5]], 3.5, '#2a2816', 0.8);
      P.noise(81, 50, '#c8b46a', 0.15, 0.02, 0.05, 0.3, 0.75); // a yellowish sheen
    },
  },

  // European conger, Conger conger: a huge scaleless eel; the dorsal, tail and anal fins one
  // continuous fin edged black, the dorsal starting close behind the pectorals; no pelvic fins;
  // the upper jaw a little longer; thick lips and large eyes.
  conger: {
    plan: 'fish', bodyLen: 0.97, round: 2.0, mode: 2, long: 1.4,
    top: [[0, 0.002], [0.03, 0.018], [0.08, 0.03], [0.18, 0.038], [0.4, 0.038], [0.65, 0.03], [0.85, 0.016], [1, 0.004]],
    bottom: [[0, -0.008], [0.03, -0.02], [0.08, -0.03], [0.18, -0.038], [0.4, -0.038], [0.65, -0.03], [0.85, -0.016], [1, -0.004]],
    width: [[0, 0.004], [0.06, 0.024], [0.18, 0.036], [0.4, 0.034], [0.65, 0.022], [0.85, 0.01], [1, 0.002]],
    mouth: { len: 0.06, y: -0.004, slope: -0.06, gape: 0.008, lips: 0.2 }, gill: null,
    eye: { t: 0.04, y: 0.014, r: 0.011, iris: '#a8a8a0' },
    fins: [
      { kind: 'dorsal', t0: 0.17, t1: 1, h: 0.022, profile: [[0, 0.5], [0.1, 1], [0.85, 1], [1, 0.6]], rays: 90, edge: '#0e0e10' },
      { kind: 'anal', t0: 0.4, t1: 1, h: 0.02, profile: [[0, 0.5], [0.1, 1], [0.85, 1], [1, 0.6]], rays: 70, edge: '#0e0e10' },
      { kind: 'pectoral', t: 0.13, a: 0.27, len: 0.035, splay: 0.6, droop: 0.05, profile: [[0, 0.5], [0.4, 1], [1, 0.4]] },
      { kind: 'caudal', shape: 'eel', h: 0.018, rays: 12, edge: '#0e0e10' },
    ],
    colors: { back: '#3a3e42', flank: '#6c7074', belly: '#cbcac2', fin: '#3a3e42', split: 0.5 },
    scaleRows: null, metal: 0.05, sheen: 0.6,
    paint: (P) => {
      P.line([[0.13, 0.55], [0.4, 0.53], [0.7, 0.52], [1, 0.5]], 2, '#e0e0d8', 0.45); // the pale lateral line pores
      P.noise(91, 60, '#2a2e30', 0.25, 0.03, 0.08, 0.5, 0.95);
    },
  },

  // European eel, Anguilla anguilla (yellow-eel stage): snake-like; the fin starts far back along
  // the body; the lower jaw longer than the upper; no pelvic fins; brown-green above, yellowish below.
  eel: {
    plan: 'fish', bodyLen: 0.97, round: 2.0, mode: 2, long: 1.4,
    top: [[0, 0.002], [0.03, 0.014], [0.08, 0.022], [0.2, 0.027], [0.45, 0.028], [0.7, 0.022], [0.88, 0.012], [1, 0.003]],
    bottom: [[0, -0.01], [0.03, -0.016], [0.08, -0.022], [0.2, -0.027], [0.45, -0.028], [0.7, -0.022], [0.88, -0.012], [1, -0.003]],
    width: [[0, 0.003], [0.06, 0.017], [0.2, 0.026], [0.45, 0.025], [0.7, 0.017], [0.88, 0.008], [1, 0.0015]],
    mouth: { len: 0.045, y: -0.005, slope: -0.04, gape: 0.006 }, gill: null,
    eye: { t: 0.035, y: 0.01, r: 0.006, iris: '#c8b070' },
    fins: [
      { kind: 'dorsal', t0: 0.36, t1: 1, h: 0.018, profile: [[0, 0.4], [0.1, 1], [0.85, 1], [1, 0.6]], rays: 80 },
      { kind: 'anal', t0: 0.46, t1: 1, h: 0.016, profile: [[0, 0.4], [0.1, 1], [0.85, 1], [1, 0.6]], rays: 70 },
      { kind: 'pectoral', t: 0.12, a: 0.27, len: 0.025, splay: 0.6, droop: 0.05, profile: [[0, 0.5], [0.4, 1], [1, 0.4]] },
      { kind: 'caudal', shape: 'eel', h: 0.014, rays: 10 },
    ],
    colors: { back: '#4a4a26', flank: '#8c8650', belly: '#dcd29a', fin: '#5a5a30', split: 0.5 },
    scaleRows: null, metal: 0.05, sheen: 0.6,
    paint: (P) => {
      P.noise(97, 60, '#36361c', 0.25, 0.03, 0.08, 0.55, 0.95);
    },
  },

  // Bluefish, Pomatomus saltatrix: fusiform and compressed; a large oblique mouth with cutting
  // teeth and a projecting lower jaw; first dorsal short and low, second dorsal and anal long and
  // alike; forked tail; grey-green back; a black blotch at the base of the pectoral fin.
  bluefish: {
    plan: 'fish', bodyLen: 0.8, round: 2.25, mode: 0,
    top: [[0, 0.004], [0.04, 0.03], [0.1, 0.056], [0.22, 0.086], [0.4, 0.096], [0.6, 0.08], [0.8, 0.044], [1, 0.026]],
    bottom: [[0, -0.016], [0.04, -0.036], [0.1, -0.058], [0.24, -0.084], [0.42, -0.09], [0.62, -0.074], [0.82, -0.04], [1, -0.024]],
    width: [[0, 0.004], [0.08, 0.03], [0.25, 0.046], [0.45, 0.046], [0.7, 0.03], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.13, y: -0.008, slope: -0.1, gape: 0.014 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.08, y: 0.026, r: 0.017, iris: '#d8c890' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.4, h: 0.04, spines: 8, profile: [[0, 0.7], [0.3, 1], [1, 0.4]] },
      { kind: 'dorsal', t0: 0.43, t1: 0.75, h: 0.055, profile: [[0, 0.7], [0.15, 1], [0.7, 0.6], [1, 0.3]], rays: 25 },
      { kind: 'anal', t0: 0.48, t1: 0.75, h: 0.05, profile: [[0, 0.7], [0.15, 1], [0.7, 0.6], [1, 0.3]], rays: 25 },
      { kind: 'pectoral', t: 0.24, a: 0.18, len: 0.09, splay: 0.45, droop: 0.2 },
      { kind: 'pelvic', t: 0.29, a: 0.04, len: 0.06, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'forked', h: 0.13, fork: 0.42, rays: 17 },
    ],
    colors: { back: '#3a5a5c', flank: '#a6bcc0', belly: '#eef2f0', fin: '#5a7a7c', split: 0.44 },
    scaleRows: [70, 18], metal: 0.4, sheen: 0.6,
    paint: (P) => {
      P.blob(0.245, 0.56, 0.014, 0.08, '#101618', 0.95, 0.35); // black blotch at the pectoral base
    },
  },

  /* ================= flatfish ================= */

  // Senegalese sole, Solea senegalensis: the common sole's shape; many white spots, largest along
  // the lateral line and the fin bases; the eyed-side pectoral with almost black membranes.
  senegalsole: {
    plan: 'flat', bodyLen: 0.89, mode: 1, belly: 0.4,
    width: [[0, 0.02], [0.06, 0.09], [0.2, 0.15], [0.45, 0.165], [0.7, 0.135], [0.9, 0.075], [1, 0.04]],
    thick: [[0, 0.01], [0.1, 0.026], [0.35, 0.034], [0.7, 0.026], [0.92, 0.01], [1, 0.002]],
    fringe: { t0: 0.02, w: 0.035 },
    pectoral: { t: 0.2, x: 0.07, len: 0.065 },
    eyes: [{ t: 0.07, x: 0.018, r: 0.011 }, { t: 0.105, x: 0.035, r: 0.011 }],
    eye: { iris: '#c9b07a' },
    colors: { back: '#6c5a46', flank: '#7c6852', belly: '#efe9dc', fin: '#5e4c3a' },
    metal: 0.04, sheen: 0.18, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#78644e', 1);
      P.noise(5, 110, '#4e3d2c', 0.35, 0.025, 0.04, 0.52, 0.98);
      // Many white spots, the biggest along the lateral line and near the fin bases.
      P.noise(7, 110, '#f4efe4', 0.75, 0.006, 0.012, 0.55, 0.98);
      P.noise(9, 30, '#f4efe4', 0.85, 0.01, 0.02, 0.72, 0.78);
      P.band(0, 0.5, '#efe9dc', 1);
      P.line([[0.0, 0.62], [0.05, 0.58]], 3, '#3a2e22', 0.6);
    },
    pectoralSpot: '#121010', pectoralSpotSize: 1.5,
  },

  // Sand sole, Pegusa lascaris: yellowish-brown with small brown spots; a black spot in the middle
  // of the eyed-side pectoral fin, ringed yellow and white.
  sandsole: {
    plan: 'flat', bodyLen: 0.89, mode: 1, belly: 0.4,
    width: [[0, 0.02], [0.06, 0.088], [0.2, 0.145], [0.45, 0.158], [0.7, 0.13], [0.9, 0.072], [1, 0.04]],
    thick: [[0, 0.01], [0.1, 0.024], [0.35, 0.032], [0.7, 0.024], [0.92, 0.01], [1, 0.002]],
    fringe: { t0: 0.02, w: 0.033 },
    pectoral: { t: 0.2, x: 0.07, len: 0.06 },
    eyes: [{ t: 0.07, x: 0.018, r: 0.01 }, { t: 0.1, x: 0.033, r: 0.01 }],
    eye: { iris: '#d0b880' },
    colors: { back: '#9c8258', flank: '#aa8e64', belly: '#f2ecdf', fin: '#8c7250' },
    metal: 0.04, sheen: 0.18, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#a48a60', 1);
      P.noise(13, 160, '#5a4430', 0.55, 0.005, 0.01, 0.52, 0.98);
      P.noise(15, 40, '#c8b080', 0.3, 0.02, 0.04, 0.52, 0.98);
      P.band(0, 0.5, '#f2ecdf', 1);
      P.line([[0.0, 0.62], [0.05, 0.58]], 3, '#3a2e22', 0.6);
    },
    pectoralSpot: '#121010', pectoralRing: '#f0e070',
  },

  // Wedge sole, Dicologlossa cuneata: slender, tapering backwards like a wedge; grey-brown to
  // chocolate; an oblong black blotch in the middle of the eyed-side pectoral fin.
  acedia: {
    plan: 'flat', bodyLen: 0.9, mode: 1, belly: 0.4,
    width: [[0, 0.02], [0.06, 0.08], [0.18, 0.13], [0.35, 0.14], [0.6, 0.11], [0.85, 0.06], [1, 0.032]],
    thick: [[0, 0.009], [0.1, 0.022], [0.35, 0.028], [0.7, 0.02], [0.92, 0.008], [1, 0.002]],
    fringe: { t0: 0.02, w: 0.03 },
    pectoral: { t: 0.19, x: 0.065, len: 0.055 },
    eyes: [{ t: 0.065, x: 0.016, r: 0.01 }, { t: 0.095, x: 0.031, r: 0.01 }],
    eye: { iris: '#c0a878' },
    colors: { back: '#6e5644', flank: '#7a6250', belly: '#f2ece0', fin: '#5e4a3a' },
    metal: 0.04, sheen: 0.18, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#6c5442', 1);
      P.noise(17, 80, '#3a2c20', 0.4, 0.01, 0.02, 0.52, 0.98);
      P.noise(19, 60, '#a08870', 0.35, 0.008, 0.016, 0.52, 0.98);
      P.band(0, 0.5, '#f2ece0', 1);
      P.line([[0.0, 0.62], [0.05, 0.58]], 3, '#2a2018', 0.6);
    },
    pectoralSpot: '#121010', pectoralSpotSize: 1.25,
  },

  // Turbot, Scophthalmus maximus: almost round and left-eyed; no scales but bony tubercles on the
  // eyed side; the lateral line strongly curved over the pectoral; mottled to match the bottom.
  turbot: {
    plan: 'flat', bodyLen: 0.86, mode: 1, belly: 0.45,
    width: [[0, 0.04], [0.06, 0.16], [0.18, 0.27], [0.4, 0.31], [0.65, 0.26], [0.85, 0.14], [1, 0.05]],
    thick: [[0, 0.012], [0.1, 0.03], [0.35, 0.045], [0.7, 0.035], [0.92, 0.012], [1, 0.002]],
    fringe: { t0: 0.0, w: 0.045 },
    pectoral: { t: 0.24, x: -0.1, len: 0.07 },
    eyes: [{ t: 0.08, x: -0.02, r: 0.014 }, { t: 0.12, x: -0.045, r: 0.014 }],
    eye: { iris: '#b8a070' },
    colors: { back: '#6a5e4a', flank: '#7a6c56', belly: '#f0ebe0', fin: '#5e5240' },
    metal: 0.04, sheen: 0.15, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#6e624c', 1);
      P.noise(21, 90, '#3e3628', 0.45, 0.03, 0.05, 0.52, 0.98);
      P.noise(23, 70, '#c8bca0', 0.4, 0.012, 0.02, 0.52, 0.98);
      // The bony tubercles: little hard knobs scattered over the eyed side.
      P.noise(25, 220, '#2e281e', 0.6, 0.0035, 0.007, 0.52, 0.98);
      P.noise(27, 160, '#e8dcc0', 0.45, 0.0025, 0.005, 0.52, 0.98);
      P.band(0, 0.5, '#f0ebe0', 1);
      P.line([[0.0, 0.38], [0.06, 0.42]], 4, '#2a2018', 0.6);
    },
  },

  // European flounder, Platichthys flesus: right-eyed (usually), rough with small bony tubercles
  // along the bases of the dorsal and anal fins and along the lateral line; olive-brown, sometimes
  // with faint orange spots; a nearly straight lateral line.
  flounder: {
    plan: 'flat', bodyLen: 0.84, mode: 1, belly: 0.42,
    width: [[0, 0.03], [0.06, 0.11], [0.2, 0.2], [0.42, 0.22], [0.65, 0.18], [0.85, 0.09], [1, 0.035]],
    thick: [[0, 0.01], [0.1, 0.028], [0.35, 0.038], [0.7, 0.028], [0.92, 0.01], [1, 0.002]],
    fringe: { t0: 0.04, w: 0.04 },
    pectoral: { t: 0.24, x: 0.08, len: 0.06 },
    eyes: [{ t: 0.07, x: 0.022, r: 0.013 }, { t: 0.11, x: 0.044, r: 0.013 }],
    eye: { iris: '#c0a070' },
    colors: { back: '#5c5a40', flank: '#6a6648', belly: '#efebdd', fin: '#56523a' },
    metal: 0.04, sheen: 0.15, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#625e42', 1);
      P.noise(31, 70, '#3c3a28', 0.4, 0.025, 0.045, 0.52, 0.98);
      P.noise(33, 18, '#c88a4a', 0.35, 0.01, 0.02, 0.6, 0.95); // faint orange spots
      // Rough tubercles along the fin bases and the lateral line.
      for (const v of [0.53, 0.75, 0.97]) for (let u = 0.12; u < 0.95; u += 0.022) P.blob(u, v, 0.004, 0.012, '#d8d0b0', 0.55, 0.3);
      P.band(0, 0.5, '#efebdd', 1);
      P.line([[0.0, 0.62], [0.06, 0.58]], 3, '#2a2418', 0.6);
    },
  },

  // European plaice, Pleuronectes platessa: right-eyed, smooth-skinned; brown with bright orange
  // spots; a row of four to seven bony knobs on the head behind the eyes.
  plaice: {
    plan: 'flat', bodyLen: 0.84, mode: 1, belly: 0.42,
    width: [[0, 0.03], [0.06, 0.12], [0.2, 0.21], [0.42, 0.23], [0.65, 0.19], [0.85, 0.095], [1, 0.035]],
    thick: [[0, 0.01], [0.1, 0.028], [0.35, 0.036], [0.7, 0.026], [0.92, 0.01], [1, 0.002]],
    fringe: { t0: 0.04, w: 0.04 },
    pectoral: { t: 0.24, x: 0.08, len: 0.06 },
    eyes: [{ t: 0.07, x: 0.022, r: 0.013 }, { t: 0.11, x: 0.044, r: 0.013 }],
    eye: { iris: '#c0a070' },
    colors: { back: '#6a5638', flank: '#76603e', belly: '#f2eee2', fin: '#64503a' },
    metal: 0.04, sheen: 0.2, finOpacity: 0.97,
    paint: (P) => {
      P.band(0.5, 1, '#6e5a3c', 1);
      P.noise(35, 50, '#4a3a26', 0.3, 0.03, 0.05, 0.52, 0.98);
      // Bright orange spots, each with a faint pale rim.
      P.noise(37, 34, '#f4e8c8', 0.5, 0.014, 0.034, 0.56, 0.96);
      P.noise(37, 34, '#e8762a', 0.95, 0.011, 0.028, 0.56, 0.96);
      // The bony knobs behind the eyes.
      for (let k = 0; k < 5; k++) P.blob(0.13 + k * 0.012, 0.7, 0.005, 0.02, '#d8c8a0', 0.8, 0.3);
      P.band(0, 0.5, '#f2eee2', 1);
      P.line([[0.0, 0.62], [0.06, 0.58]], 3, '#2a2418', 0.6);
    },
  },

  /* ================= gurnard ================= */

  // Tub gurnard, Chelidonichthys lucerna: a big bony triangular head; very long pectoral fins
  // reaching the anal fin, blue-black inside with spots and a bright blue edge; three free lower
  // pectoral rays like legs; two dorsal fins; reddish, smooth-skinned body.
  gurnard: {
    plan: 'fish', bodyLen: 0.82, round: 2.4, mode: 0, view: { yaw: -Math.PI / 2 + 0.3, pitch: 0.45 },
    top: [[0, -0.01], [0.04, 0.02], [0.1, 0.05], [0.2, 0.075], [0.32, 0.078], [0.5, 0.064], [0.72, 0.04], [0.9, 0.024], [1, 0.02]],
    bottom: [[0, -0.024], [0.04, -0.044], [0.1, -0.058], [0.22, -0.064], [0.4, -0.058], [0.6, -0.044], [0.8, -0.028], [1, -0.018]],
    width: [[0, 0.012], [0.06, 0.044], [0.16, 0.06], [0.3, 0.052], [0.5, 0.04], [0.75, 0.024], [1, 0.01]],
    mouth: { len: 0.07, y: -0.026, slope: -0.02, gape: 0.01 }, gill: { t: 0.22, curve: 0.02 },
    eye: { t: 0.1, y: 0.04, r: 0.017, iris: '#d8a050', up: 0.4 },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.24, t1: 0.42, h: 0.06, spines: 10, profile: [[0, 0.7], [0.2, 1], [1, 0.4]] },
      { kind: 'dorsal', t0: 0.44, t1: 0.82, h: 0.04, profile: [[0, 0.8], [0.2, 1], [1, 0.5]], rays: 16 },
      { kind: 'anal', t0: 0.45, t1: 0.82, h: 0.035, profile: [[0, 0.8], [0.2, 1], [1, 0.5]], rays: 15 },
      { kind: 'pectoral', t: 0.22, a: 0.12, len: 0.3, w: 0.15, splay: 1.0, droop: 0.05, spread: true, rays: 11, profile: [[0, 0.35], [0.3, 0.95], [0.75, 1], [1, 0.35]], color: '#283a5c', edge: '#3aa0e0', edgeFrom: 0.62 },
      { kind: 'rays', t: 0.21, a: 0.06, len: 0.07, count: 3, color: '#d89a80' },
      { kind: 'pelvic', t: 0.25, a: 0.03, len: 0.08, splay: 0.35, droop: 0.6 },
      { kind: 'caudal', shape: 'truncate', h: 0.07, rays: 15 },
    ],
    colors: { back: '#b05848', flank: '#d88e78', belly: '#f2e6dc', fin: '#c46a56', split: 0.45 },
    scaleRows: [90, 20], metal: 0.12, sheen: 0.35,
    paint: (P) => {
      P.band(0.75, 1, '#7a3a30', 0.35, 0, 0.22); // the bony head plates, a little darker
      P.line([[0.22, 0.62], [0.5, 0.6], [1, 0.52]], 1.5, '#8a4a3c', 0.5);
      P.noise(101, 40, '#e8b8a0', 0.2, 0.02, 0.05, 0.3, 0.8);
    },
  },

  /* ================= small schooling fish ================= */

  // European sardine, Sardina pilchardus: round-bellied little herring; green-blue back, silver
  // sides with a row of dark spots along the upper flank; radiating ridges on the gill cover.
  sardine: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0, lod: 0.55,
    top: [[0, 0.002], [0.05, 0.022], [0.14, 0.046], [0.3, 0.068], [0.5, 0.066], [0.7, 0.046], [0.88, 0.024], [1, 0.018]],
    bottom: [[0, -0.008], [0.05, -0.026], [0.14, -0.05], [0.3, -0.07], [0.5, -0.068], [0.7, -0.046], [0.88, -0.024], [1, -0.018]],
    width: [[0, 0.004], [0.08, 0.024], [0.25, 0.036], [0.45, 0.035], [0.7, 0.022], [0.9, 0.01], [1, 0.007]],
    mouth: { len: 0.06, y: -0.002, slope: -0.04, gape: 0.006 }, gill: { t: 0.2, curve: 0.03 },
    eye: { t: 0.075, y: 0.012, r: 0.016, iris: '#d8d4c4' },
    fins: [
      { kind: 'dorsal', t0: 0.38, t1: 0.5, h: 0.05, profile: [[0, 0.7], [0.2, 1], [1, 0.3]], rays: 15 },
      { kind: 'anal', t0: 0.72, t1: 0.84, h: 0.022, profile: [[0, 0.7], [0.3, 1], [1, 0.4]], rays: 16 },
      { kind: 'pectoral', t: 0.21, a: 0.08, len: 0.06, splay: 0.4, droop: 0.3 },
      { kind: 'pelvic', t: 0.47, a: 0.02, len: 0.04, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.1, fork: 0.48, rays: 18 },
    ],
    colors: { back: '#2a5e70', flank: '#c8d6da', belly: '#f6faf8', fin: '#9ab4ba', split: 0.5 },
    scaleRows: [40, 12], metal: 0.55, sheen: 0.75,
    paint: (P) => {
      for (let k = 0; k < 6; k++) P.blob(0.24 + k * 0.07, 0.68, 0.009, 0.035, '#14303a', 0.8, 0.35);
      for (let k = 0; k < 4; k++) P.line([[0.16, 0.62 - k * 0.07], [0.2, 0.55 - k * 0.09]], 1.4, '#7a9aa4', 0.6); // gill-cover ridges
    },
  },

  // European anchovy, Engraulis encrasicolus: slender; a pointed snout overhanging an enormous
  // mouth reaching back past the eye; one short dorsal fin; a bright silver band along the flank.
  anchovy: {
    plan: 'fish', bodyLen: 0.81, round: 2.15, mode: 0, lod: 0.5,
    top: [[0, 0.004], [0.05, 0.02], [0.14, 0.036], [0.3, 0.048], [0.5, 0.048], [0.7, 0.036], [0.88, 0.02], [1, 0.015]],
    bottom: [[0, -0.002], [0.05, -0.016], [0.14, -0.034], [0.3, -0.048], [0.5, -0.048], [0.7, -0.036], [0.88, -0.02], [1, -0.015]],
    width: [[0, 0.003], [0.08, 0.018], [0.25, 0.026], [0.45, 0.026], [0.7, 0.017], [0.9, 0.008], [1, 0.006]],
    mouth: { len: 0.15, y: -0.008, slope: -0.03, gape: 0.008 }, gill: { t: 0.18, curve: 0.02 },
    eye: { t: 0.06, y: 0.008, r: 0.016, iris: '#e0dcd0' },
    fins: [
      { kind: 'dorsal', t0: 0.42, t1: 0.52, h: 0.04, profile: [[0, 0.7], [0.2, 1], [1, 0.3]], rays: 14 },
      { kind: 'anal', t0: 0.6, t1: 0.72, h: 0.018, profile: [[0, 0.7], [0.3, 1], [1, 0.4]], rays: 18 },
      { kind: 'pectoral', t: 0.19, a: 0.06, len: 0.05, splay: 0.4, droop: 0.3 },
      { kind: 'pelvic', t: 0.4, a: 0.02, len: 0.035, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.09, fork: 0.5, rays: 18 },
    ],
    colors: { back: '#2a5a66', flank: '#c8d8da', belly: '#f4f8f6', fin: '#a2bcc0', split: 0.48 },
    scaleRows: null, metal: 0.55, sheen: 0.75,
    paint: (P) => {
      P.line([[0.2, 0.56], [0.5, 0.56], [0.8, 0.54], [1, 0.52]], 9, '#eef6f8', 0.85); // the silver band
      P.line([[0.2, 0.62], [0.5, 0.62], [0.8, 0.59], [1, 0.56]], 2, '#2a4a56', 0.6); // dark line above it
    },
  },

  // Atlantic horse mackerel, Trachurus trachurus: big-eyed and fusiform; large bony scutes along
  // the whole lateral line, dipping down mid-body; two dorsal fins; a small black spot on the edge
  // of the gill cover; forked tail.
  horsemackerel: {
    plan: 'fish', bodyLen: 0.81, round: 2.2, mode: 0, lod: 0.65,
    top: [[0, 0.002], [0.05, 0.026], [0.14, 0.052], [0.3, 0.076], [0.48, 0.074], [0.7, 0.05], [0.88, 0.022], [1, 0.016]],
    bottom: [[0, -0.008], [0.05, -0.028], [0.14, -0.052], [0.3, -0.072], [0.5, -0.068], [0.7, -0.046], [0.88, -0.02], [1, -0.015]],
    width: [[0, 0.004], [0.08, 0.026], [0.25, 0.036], [0.45, 0.035], [0.7, 0.022], [0.9, 0.01], [1, 0.007]],
    mouth: { len: 0.08, y: -0.002, slope: -0.08, gape: 0.008 }, gill: { t: 0.21, curve: 0.03 },
    eye: { t: 0.08, y: 0.018, r: 0.024, iris: '#d8d0b8' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.42, h: 0.06, spines: 8, profile: [[0, 0.8], [0.3, 1], [1, 0.3]] },
      { kind: 'dorsal', t0: 0.44, t1: 0.86, h: 0.032, profile: [[0, 0.9], [0.1, 1], [1, 0.5]], rays: 30 },
      { kind: 'anal', t0: 0.52, t1: 0.86, h: 0.028, profile: [[0, 0.9], [0.1, 1], [1, 0.5]], rays: 26 },
      { kind: 'pectoral', t: 0.22, a: 0.14, len: 0.1, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.26, a: 0.03, len: 0.045, splay: 0.3, droop: 0.6 },
      { kind: 'keel', t: 0.86, len: 0.1, h: 0.006 },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.52, rays: 18 },
    ],
    colors: { back: '#3e5a66', flank: '#c4ccd0', belly: '#f2f4f2', fin: '#8a9ca4', split: 0.46 },
    scaleRows: [48, 14], metal: 0.5, sheen: 0.7,
    paint: (P) => {
      // The scutes: a row of big bony plates along the lateral line, bending down mid-body.
      const path = [[0.21, 0.66], [0.35, 0.66], [0.48, 0.6], [0.55, 0.52], [0.7, 0.5], [1, 0.5]];
      P.line(path, 7, '#9aa8ae', 0.75);
      for (let u = 0.22; u < 1; u += 0.018) {
        const v = u < 0.45 ? 0.66 : u < 0.56 ? 0.66 - (u - 0.45) * 1.3 : 0.51;
        P.line([[u, v + 0.035], [u + 0.006, v - 0.035]], 1.2, '#4a5a62', 0.6);
      }
      P.blob(0.205, 0.72, 0.008, 0.04, '#0e1416', 0.95, 0.3); // the black spot on the gill cover
    },
  },

  // Sand smelt, Atherina presbyter: slender and translucent with a bright silver stripe along each
  // side; a large eye; two well-separated dorsal fins.
  sandsmelt: {
    plan: 'fish', bodyLen: 0.82, round: 2.15, mode: 0, lod: 0.5,
    top: [[0, 0.004], [0.05, 0.02], [0.14, 0.036], [0.3, 0.048], [0.5, 0.046], [0.7, 0.034], [0.88, 0.02], [1, 0.016]],
    bottom: [[0, -0.006], [0.05, -0.02], [0.14, -0.036], [0.3, -0.046], [0.5, -0.044], [0.7, -0.032], [0.88, -0.018], [1, -0.015]],
    width: [[0, 0.003], [0.08, 0.018], [0.25, 0.025], [0.45, 0.024], [0.7, 0.017], [0.9, 0.008], [1, 0.006]],
    mouth: { len: 0.06, y: 0.0, slope: -0.08, gape: 0.006 }, gill: { t: 0.18, curve: 0.02 },
    eye: { t: 0.07, y: 0.01, r: 0.02, iris: '#d8e0dc' },
    fins: [
      { kind: 'dorsal', t0: 0.36, t1: 0.44, h: 0.035, profile: [[0, 0.8], [0.3, 1], [1, 0.3]], rays: 8 },
      { kind: 'dorsal', t0: 0.56, t1: 0.68, h: 0.03, profile: [[0, 0.8], [0.3, 1], [1, 0.3]], rays: 12 },
      { kind: 'anal', t0: 0.54, t1: 0.68, h: 0.025, profile: [[0, 0.8], [0.3, 1], [1, 0.3]], rays: 13 },
      { kind: 'pectoral', t: 0.19, a: 0.3, len: 0.06, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.36, a: 0.02, len: 0.035, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.09, fork: 0.45, rays: 17 },
    ],
    colors: { back: '#9ab8ac', flank: '#d8e8e2', belly: '#f2f8f5', fin: '#d0e2da', split: 0.5 },
    scaleRows: [44, 10], metal: 0.4, sheen: 0.7, finOpacity: 0.6,
    paint: (P) => {
      P.line([[0.18, 0.55], [0.5, 0.56], [0.8, 0.54], [1, 0.52]], 8, '#f6fbff', 0.95); // the silver stripe
      P.line([[0.18, 0.6], [0.5, 0.61], [0.8, 0.58], [1, 0.55]], 1.5, '#5a7a70', 0.5);
      P.noise(111, 60, '#5a7a70', 0.35, 0.003, 0.008, 0.62, 0.98); // fine dark specks on the back
    },
  },

  // Bogue, Boops boops: slim and round in section; big eyes and a small mouth; a long dorsal fin;
  // a dark lateral line; a black spot at the pectoral base; olive-yellow above.
  bogue: {
    plan: 'fish', bodyLen: 0.8, round: 2.1, mode: 0, lod: 0.6,
    top: [[0, 0.002], [0.05, 0.024], [0.14, 0.046], [0.3, 0.064], [0.5, 0.062], [0.7, 0.046], [0.88, 0.024], [1, 0.018]],
    bottom: [[0, -0.008], [0.05, -0.024], [0.14, -0.046], [0.3, -0.062], [0.5, -0.06], [0.7, -0.044], [0.88, -0.022], [1, -0.017]],
    width: [[0, 0.004], [0.08, 0.026], [0.25, 0.036], [0.45, 0.035], [0.7, 0.024], [0.9, 0.011], [1, 0.008]],
    mouth: { len: 0.045, y: -0.004, slope: -0.04, gape: 0.006 }, gill: { t: 0.2, curve: 0.03 },
    eye: { t: 0.075, y: 0.016, r: 0.023, iris: '#d8c880' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.28, t1: 0.55, h: 0.05, spines: 13, profile: [[0, 0.7], [0.2, 1], [1, 0.6]] },
      { kind: 'dorsal', t0: 0.55, t1: 0.82, h: 0.035, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 15 },
      { kind: 'anal', t0: 0.6, t1: 0.82, h: 0.032, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 15 },
      { kind: 'pectoral', t: 0.22, a: 0.15, len: 0.09, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.27, a: 0.03, len: 0.045, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.1, fork: 0.42, rays: 17 },
    ],
    colors: { back: '#78844e', flank: '#cfd2b6', belly: '#f2f2e6', fin: '#a2a688', split: 0.46 },
    scaleRows: [56, 14], metal: 0.42, sheen: 0.6,
    paint: (P) => {
      P.line([[0.22, 0.72], [0.5, 0.73], [0.8, 0.68], [1, 0.62]], 2.5, '#3a3c26', 0.65); // the dark lateral line
      stripes(P, 4, 0.36, 0.62, '#d8b44a', 0.4, 1.6);
      P.blob(0.225, 0.52, 0.007, 0.03, '#141410', 0.9, 0.3); // black spot at the pectoral base
    },
  },

  // Salema, Sarpa salpa: oval and grey-blue with ten to twelve bright golden stripes; a golden eye;
  // a small black spot at the pectoral base; a small mouth; forked tail.
  salema: {
    plan: 'fish', bodyLen: 0.79, round: 2.1, mode: 0, lod: 0.7,
    top: [[0, 0], [0.05, 0.03], [0.14, 0.072], [0.3, 0.11], [0.48, 0.114], [0.68, 0.088], [0.86, 0.044], [1, 0.029]],
    bottom: [[0, -0.012], [0.06, -0.044], [0.18, -0.082], [0.36, -0.096], [0.56, -0.088], [0.76, -0.054], [0.9, -0.032], [1, -0.027]],
    width: [[0, 0.004], [0.08, 0.026], [0.25, 0.038], [0.45, 0.038], [0.7, 0.026], [0.9, 0.012], [1, 0.009]],
    mouth: { len: 0.05, y: -0.008, slope: -0.04, gape: 0.006 }, gill: { t: 0.23, curve: 0.035 },
    eye: { t: 0.1, y: 0.026, r: 0.019, iris: '#e8c040' },
    fins: sparidFins({ spines: 11, d0: 0.28, dh: 0.065, sh: 0.05, tail: 0.12, fork: 0.38 }),
    colors: { back: '#5e6670', flank: '#b8bec4', belly: '#eef0ee', fin: '#8e949a', split: 0.42 },
    scaleRows: [52, 16], metal: 0.3, sheen: 0.45,
    paint: (P) => {
      stripes(P, 11, 0.2, 0.9, '#f0c030', 0.85, 2.6, 0.2, 1);
      P.blob(0.285, 0.48, 0.008, 0.03, '#141414', 0.9, 0.3);
    },
  },

  // Garfish, Belone belone: pencil-thin; both jaws drawn out into a long toothed beak (the lower a
  // little longer); dorsal and anal fins set far back, opposite each other; forked tail; dark
  // blue-green back, silver flanks, white belly.
  garfish: {
    plan: 'fish', bodyLen: 0.88, round: 2.0, mode: 0, long: 1.3, lod: 0.8,
    top: [[0, 0.0], [0.08, 0.004], [0.2, 0.01], [0.24, 0.02], [0.32, 0.026], [0.6, 0.026], [0.8, 0.02], [0.92, 0.012], [1, 0.01]],
    bottom: [[0, -0.003], [0.08, -0.006], [0.2, -0.01], [0.24, -0.018], [0.32, -0.026], [0.6, -0.026], [0.8, -0.02], [0.92, -0.012], [1, -0.01]],
    width: [[0, 0.002], [0.08, 0.004], [0.2, 0.008], [0.25, 0.016], [0.35, 0.02], [0.6, 0.02], [0.8, 0.015], [1, 0.007]],
    mouth: { len: 0.22, y: -0.002, slope: 0.0, gape: 0.004 }, gill: { t: 0.29, curve: 0.012 },
    eye: { t: 0.255, y: 0.009, r: 0.011, iris: '#d0d8d0' },
    fins: [
      { kind: 'dorsal', t0: 0.76, t1: 0.88, h: 0.022, profile: [[0, 0.7], [0.2, 1], [1, 0.6]], rays: 16 },
      { kind: 'anal', t0: 0.74, t1: 0.88, h: 0.02, profile: [[0, 0.7], [0.2, 1], [1, 0.6]], rays: 19 },
      { kind: 'pectoral', t: 0.31, a: 0.25, len: 0.04, splay: 0.4, droop: 0.1 },
      { kind: 'pelvic', t: 0.6, a: 0.02, len: 0.03, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.06, fork: 0.4, rays: 15 },
    ],
    colors: { back: '#24585a', flank: '#b8d0cc', belly: '#f4f8f4', fin: '#4e7a72', split: 0.5 },
    scaleRows: null, metal: 0.5, sheen: 0.75,
    paint: (P) => {
      P.band(0.62, 1, '#1e4e52', 0.6);
      P.line([[0.3, 0.6], [0.6, 0.6], [1, 0.58]], 3, '#e8f4f2', 0.6);
      P.band(0.4, 0.6, '#2a4a46', 0.5, 0, 0.22); // the dark beak
    },
  },

  /* ================= fast fish of the open sea ================= */

  // Atlantic bonito, Sarda sarda: a small tuna; steel-blue back with five to eleven dark stripes
  // slanting forward and down; a long, straight-edged first dorsal; finlets; a large mouth.
  bonito: {
    plan: 'fish', bodyLen: 0.82, round: 2.0, mode: 4,
    top: [[0, 0.002], [0.05, 0.028], [0.14, 0.056], [0.3, 0.084], [0.48, 0.086], [0.68, 0.06], [0.86, 0.026], [1, 0.014]],
    bottom: [[0, -0.01], [0.05, -0.03], [0.14, -0.054], [0.3, -0.08], [0.5, -0.08], [0.7, -0.054], [0.86, -0.024], [1, -0.013]],
    width: [[0, 0.004], [0.08, 0.034], [0.25, 0.058], [0.45, 0.06], [0.7, 0.038], [0.9, 0.014], [1, 0.012]],
    mouth: { len: 0.12, y: -0.004, slope: -0.05, gape: 0.01 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.08, y: 0.02, r: 0.016, iris: '#c8c8b8' },
    fins: tunaFins({ d0: 0.28, d1: 0.56, dh: 0.05, gap: 0.01, sh: 0.04, finlets: 7, pect: 0.08, tail: 0.15, dProfile: [[0, 1], [0.15, 0.9], [0.9, 0.55], [1, 0.25]] }),
    colors: { back: '#203c5a', flank: '#a2b4c2', belly: '#eef2f2', fin: '#3e5a74', split: 0.5 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      // The dark stripes slanting forward and down across the back.
      for (let k = 0; k < 8; k++) {
        const u = 0.22 + k * 0.09;
        P.line([[u + 0.06, 0.99], [u + 0.02, 0.8], [u - 0.03, 0.62]], 4, '#101e30', 0.75);
      }
    },
  },

  // Little tunny, Euthynnus alletteratus: compact; wavy, broken dark stripes on the back behind
  // the middle of the first dorsal; a few dark spots between the pectoral and pelvic fins; tall
  // front spines on the first dorsal; the two dorsals close together.
  littletunny: {
    plan: 'fish', bodyLen: 0.82, round: 2.0, mode: 4,
    top: [[0, 0.002], [0.05, 0.03], [0.14, 0.064], [0.3, 0.096], [0.46, 0.098], [0.66, 0.068], [0.86, 0.026], [1, 0.014]],
    bottom: [[0, -0.012], [0.05, -0.034], [0.14, -0.062], [0.3, -0.092], [0.5, -0.09], [0.7, -0.058], [0.86, -0.024], [1, -0.013]],
    width: [[0, 0.004], [0.08, 0.036], [0.25, 0.064], [0.45, 0.066], [0.7, 0.04], [0.9, 0.014], [1, 0.012]],
    mouth: { len: 0.1, y: -0.004, slope: -0.05, gape: 0.009 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.08, y: 0.022, r: 0.015, iris: '#c8c8b8' },
    fins: tunaFins({ d0: 0.28, d1: 0.46, dh: 0.08, gap: 0.02, sh: 0.05, finlets: 8, pect: 0.1, tail: 0.17 }),
    colors: { back: '#1c3a58', flank: '#a6b6c4', belly: '#eef0f2', fin: '#2e4a66', split: 0.48 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      // Wavy, worm-like dark lines on the back from the middle of the first dorsal backwards.
      for (let k = 0; k < 9; k++) {
        const u = 0.36 + k * 0.065, pts = [];
        for (let j = 0; j <= 6; j++) pts.push([u + Math.sin(j * 1.7 + k) * 0.012, 0.98 - j * 0.05]);
        P.line(pts, 3, '#0c1828', 0.75);
      }
      for (let k = 0; k < 4; k++) P.blob(0.26 + k * 0.03, 0.26 + (k % 2) * 0.04, 0.008, 0.035, '#1a2430', 0.8, 0.3); // the belly spots
    },
  },

  // Bullet tuna, Auxis rochei: small and round; the two dorsal fins widely separated; fifteen or
  // more nearly vertical dark bars on the bare back behind a broad corselet of scales.
  bullet: {
    plan: 'fish', bodyLen: 0.82, round: 2.0, mode: 4, lod: 0.75,
    top: [[0, 0.002], [0.05, 0.03], [0.14, 0.06], [0.3, 0.088], [0.48, 0.088], [0.68, 0.06], [0.86, 0.024], [1, 0.013]],
    bottom: [[0, -0.012], [0.05, -0.032], [0.14, -0.06], [0.3, -0.086], [0.5, -0.084], [0.7, -0.056], [0.86, -0.022], [1, -0.012]],
    width: [[0, 0.004], [0.08, 0.036], [0.25, 0.064], [0.45, 0.066], [0.7, 0.04], [0.9, 0.014], [1, 0.011]],
    mouth: { len: 0.09, y: -0.004, slope: -0.05, gape: 0.008 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.08, y: 0.022, r: 0.016, iris: '#c8c8b8' },
    fins: tunaFins({ d0: 0.28, d1: 0.38, dh: 0.06, s0: 0.58, s1: 0.65, sh: 0.04, finlets: 8, pect: 0.07, tail: 0.15 }),
    colors: { back: '#22405e', flank: '#aab8c4', belly: '#eef2f2', fin: '#3a5672', split: 0.5 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      // The corselet: a paler band of scales behind the head; bars on the bare back behind it.
      P.band(0.55, 0.9, '#3a5a78', 0.35, 0.2, 0.42);
      for (let k = 0; k < 16; k++) P.line([[0.44 + k * 0.032, 0.99], [0.45 + k * 0.032, 0.72]], 2.6, '#0c1a2a', 0.75);
    },
  },

  // Atlantic bluefin tuna, Thunnus thynnus: deep, torpedo-shaped; short pectorals; a dark blue
  // back; yellow finlets edged dark; the second dorsal and anal fins tall and curved.
  tuna: {
    plan: 'fish', bodyLen: 0.82, round: 2.0, mode: 4,
    top: [[0, 0.002], [0.05, 0.036], [0.14, 0.074], [0.3, 0.11], [0.45, 0.114], [0.66, 0.08], [0.86, 0.03], [1, 0.015]],
    bottom: [[0, -0.014], [0.05, -0.04], [0.14, -0.074], [0.3, -0.108], [0.48, -0.11], [0.68, -0.074], [0.86, -0.028], [1, -0.014]],
    width: [[0, 0.004], [0.08, 0.042], [0.25, 0.078], [0.45, 0.08], [0.7, 0.048], [0.9, 0.016], [1, 0.013]],
    mouth: { len: 0.1, y: -0.006, slope: -0.05, gape: 0.01 }, gill: { t: 0.23, curve: 0.035 },
    eye: { t: 0.085, y: 0.026, r: 0.016, iris: '#b8b8a8' },
    fins: tunaFins({ d0: 0.3, d1: 0.44, dh: 0.065, gap: 0.03, sh: 0.075, finlets: 9, fl: 0.02, pect: 0.1, tail: 0.2, colors: { second: '#9a8a4a', caudal: '#2a3a50' } }).map((f) => (f.kind === 'finlets' ? { ...f, color: '#e0c040' } : f)),
    colors: { back: '#14284a', flank: '#5c7a96', belly: '#e8ecee', fin: '#2a3a50', split: 0.46 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      P.noise(121, 40, '#c8d4dc', 0.3, 0.006, 0.05, 0.1, 0.4); // pale spots and streaks on the lower flank
      P.line([[0.2, 0.62], [0.6, 0.6], [1, 0.52]], 3, '#8aa0b4', 0.4);
    },
  },

  // Pompano, Trachinotus ovatus: oval and strongly compressed, pointed at both ends; three to five
  // dark, vertically elongate spots along the front of the lateral line; dorsal and anal lobes
  // and the tips of the deeply forked tail black.
  pompano: {
    plan: 'fish', bodyLen: 0.78, round: 2.0, mode: 0,
    top: [[0, -0.004], [0.06, 0.036], [0.16, 0.088], [0.3, 0.13], [0.45, 0.138], [0.62, 0.1], [0.82, 0.04], [1, 0.018]],
    bottom: [[0, -0.016], [0.06, -0.05], [0.18, -0.096], [0.36, -0.124], [0.52, -0.116], [0.7, -0.07], [0.86, -0.028], [1, -0.016]],
    width: [[0, 0.004], [0.08, 0.024], [0.25, 0.036], [0.45, 0.036], [0.7, 0.022], [0.9, 0.01], [1, 0.008]],
    mouth: { len: 0.06, y: -0.012, slope: -0.04, gape: 0.008 }, gill: { t: 0.22, curve: 0.04 },
    eye: { t: 0.1, y: 0.026, r: 0.017, iris: '#c8c0a8' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.38, h: 0.025, spines: 6, profile: [[0, 0.8], [0.5, 1], [1, 0.6]] },
      { kind: 'dorsal', t0: 0.4, t1: 0.78, h: 0.11, profile: [[0, 0.7], [0.1, 1], [0.4, 0.35], [1, 0.25]], rays: 24, edge: '#1a1e22', edgeFrom: 0.45 },
      { kind: 'anal', t0: 0.46, t1: 0.78, h: 0.1, profile: [[0, 0.7], [0.1, 1], [0.4, 0.35], [1, 0.25]], rays: 22, edge: '#1a1e22', edgeFrom: 0.45 },
      { kind: 'pectoral', t: 0.24, a: 0.16, len: 0.1, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.28, a: 0.03, len: 0.04, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.16, fork: 0.6, rays: 17, tips: true, edge: '#1a1e22', edgeFrom: 0.5 },
    ],
    colors: { back: '#5a6a74', flank: '#cad2d6', belly: '#f2f4f4', fin: '#6a747c', split: 0.42 },
    scaleRows: null, metal: 0.5, sheen: 0.7,
    paint: (P) => {
      for (let k = 0; k < 4; k++) P.blob(0.3 + k * 0.08, 0.66, 0.014, 0.08, '#1e2428', 0.55, 0.4);
    },
  },

  /* ================= upgrades of the first species ================= */

  // Thicklip grey mullet, Chelon labrosus: fusiform with a broad, flat-topped head; a thick upper
  // lip; two widely separated dorsal fins (the first of four spines); grey-blue back with dark
  // lengthwise stripes.
  mullet: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0,
    top: [[0, -0.002], [0.04, 0.022], [0.1, 0.042], [0.22, 0.07], [0.4, 0.084], [0.6, 0.074], [0.8, 0.044], [1, 0.03]],
    bottom: [[0, -0.016], [0.04, -0.032], [0.1, -0.05], [0.24, -0.074], [0.42, -0.084], [0.62, -0.072], [0.82, -0.042], [1, -0.028]],
    width: [[0, 0.008], [0.08, 0.04], [0.25, 0.058], [0.45, 0.056], [0.7, 0.036], [0.9, 0.016], [1, 0.012]],
    mouth: { len: 0.05, y: -0.01, slope: -0.02, gape: 0.008, lips: 0.45 }, gill: { t: 0.2, curve: 0.025 },
    eye: { t: 0.08, y: 0.02, r: 0.015, iris: '#c8b888' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.42, t1: 0.5, h: 0.055, spines: 4, profile: [[0, 1], [1, 0.6]] },
      { kind: 'dorsal', t0: 0.64, t1: 0.74, h: 0.05, profile: [[0, 0.8], [0.2, 1], [1, 0.35]], rays: 9 },
      { kind: 'anal', t0: 0.62, t1: 0.74, h: 0.045, profile: [[0, 0.8], [0.2, 1], [1, 0.35]], rays: 10 },
      { kind: 'pectoral', t: 0.22, a: 0.32, len: 0.09, splay: 0.4, droop: 0.1 },
      { kind: 'pelvic', t: 0.36, a: 0.03, len: 0.06, splay: 0.3, droop: 0.55 },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.24, rays: 14 },
    ],
    colors: { back: '#4a5662', flank: '#b8c2c8', belly: '#f0f2f0', fin: '#7c8890', split: 0.46 },
    scaleRows: [42, 13], metal: 0.32, sheen: 0.5,
    paint: (P) => {
      stripes(P, 6, 0.42, 0.88, '#4a5662', 0.45, 3, 0.2, 1); // dark lengthwise stripes
      P.line([[0.0, 0.48], [0.05, 0.47]], 5, '#d8d0c0', 0.5); // the thick pale upper lip
    },
  },

  // Ballan wrasse, Labrus bergylta: robust and elongate, thick lips; one long dorsal fin, spiny
  // in front; a rounded tail; mottled green-brown with pale spots, often reddish.
  wrasse: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0,
    top: [[0, -0.002], [0.04, 0.03], [0.12, 0.072], [0.26, 0.1], [0.45, 0.104], [0.65, 0.086], [0.85, 0.05], [1, 0.042]],
    bottom: [[0, -0.016], [0.05, -0.04], [0.14, -0.066], [0.3, -0.084], [0.5, -0.084], [0.7, -0.066], [0.86, -0.046], [1, -0.04]],
    width: [[0, 0.006], [0.08, 0.034], [0.25, 0.05], [0.45, 0.05], [0.7, 0.036], [0.9, 0.02], [1, 0.014]],
    mouth: { len: 0.07, y: -0.012, slope: -0.03, gape: 0.01, lips: 0.4 }, gill: { t: 0.24, curve: 0.035 },
    eye: { t: 0.09, y: 0.03, r: 0.015, iris: '#d8a050' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.26, t1: 0.66, h: 0.05, spines: 19, profile: [[0, 0.8], [0.2, 1], [1, 0.9]] },
      { kind: 'dorsal', t0: 0.66, t1: 0.88, h: 0.06, profile: [[0, 0.9], [0.4, 1], [1, 0.5]], rays: 11 },
      { kind: 'anal', t0: 0.66, t1: 0.88, h: 0.055, profile: [[0, 0.9], [0.4, 1], [1, 0.5]], rays: 10 },
      { kind: 'pectoral', t: 0.27, a: 0.16, len: 0.1, splay: 0.5, droop: 0.15, profile: [[0, 0.4], [0.4, 1], [1, 0.5]] },
      { kind: 'pelvic', t: 0.31, a: 0.04, len: 0.06, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'rounded', h: 0.09, rays: 14 },
    ],
    colors: { back: '#3f5a3a', flank: '#7a8a5a', belly: '#d8c8a0', fin: '#5a6a40', split: 0.42 },
    scaleRows: [40, 14], metal: 0.12, sheen: 0.3,
    paint: (P) => {
      P.noise(131, 90, '#a8502e', 0.35, 0.02, 0.05, 0.2, 0.9); // reddish mottling
      P.noise(133, 180, '#f2e6c0', 0.6, 0.004, 0.012, 0.2, 0.9); // pale spots, one per scale
      P.noise(135, 40, '#2a3a26', 0.3, 0.03, 0.07, 0.5, 1);
    },
  },

  // European sprat, Sprattus sprattus: a small herring with a sharply keeled belly; the dorsal fin
  // set a little behind the pelvic fins' origin; silver with a blue-green back, no spots.
  sprat: {
    plan: 'fish', bodyLen: 0.8, round: 2.1, mode: 0, lod: 0.5,
    top: [[0, 0.002], [0.05, 0.02], [0.14, 0.04], [0.3, 0.058], [0.5, 0.058], [0.7, 0.042], [0.88, 0.022], [1, 0.016]],
    bottom: [[0, -0.008], [0.05, -0.026], [0.14, -0.054], [0.3, -0.074], [0.5, -0.07], [0.7, -0.046], [0.88, -0.022], [1, -0.016]],
    width: [[0, 0.003], [0.08, 0.02], [0.25, 0.028], [0.45, 0.027], [0.7, 0.018], [0.9, 0.008], [1, 0.006]],
    mouth: { len: 0.05, y: 0.002, slope: -0.08, gape: 0.006 }, gill: { t: 0.2, curve: 0.025 },
    eye: { t: 0.075, y: 0.012, r: 0.016, iris: '#dcdcd0' },
    fins: [
      { kind: 'dorsal', t0: 0.4, t1: 0.52, h: 0.045, profile: [[0, 0.7], [0.2, 1], [1, 0.3]], rays: 16 },
      { kind: 'anal', t0: 0.7, t1: 0.84, h: 0.02, profile: [[0, 0.7], [0.3, 1], [1, 0.4]], rays: 18 },
      { kind: 'pectoral', t: 0.21, a: 0.08, len: 0.055, splay: 0.4, droop: 0.3 },
      { kind: 'pelvic', t: 0.38, a: 0.02, len: 0.035, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.1, fork: 0.5, rays: 18 },
    ],
    colors: { back: '#2e6474', flank: '#ccdade', belly: '#f6faf8', fin: '#9ab4ba', split: 0.5 },
    scaleRows: null, metal: 0.55, sheen: 0.75,
    paint: (P) => {
      P.line([[0.2, 0.62], [0.6, 0.62], [1, 0.58]], 2, '#a8c0c8', 0.6);
    },
  },

  // European squid, Loligo vulgaris: a long, slender mantle tapering to a point; rhombic fins over
  // the rear two-thirds, meeting at the tip; big eyes; eight short arms and two long tentacles
  // with clubs; pinkish, peppered with red-brown chromatophores.
  squid: {
    plan: 'squid', mode: 5, bodyLen: 0.66, armLen: 0.3, tentacle: 1.45,
    width: [[0, 0.03], [0.05, 0.038], [0.12, 0.034], [0.2, 0.046], [0.4, 0.05], [0.65, 0.04], [0.85, 0.022], [1, 0.002]],
    height: [[0, 0.028], [0.05, 0.036], [0.12, 0.032], [0.2, 0.044], [0.4, 0.048], [0.65, 0.038], [0.85, 0.02], [1, 0.002]],
    fin: { t0: 0.38, w: 0.06, profile: [[0, 0.05], [0.45, 0.85], [0.7, 1], [0.92, 0.5], [1, 0.0]] },
    eye: { t: 0.05, y: 0.012, r: 0.022, iris: '#c8a868' },
    colors: { back: '#b85a6a', flank: '#e6c2c2', belly: '#f6eeee', fin: '#e0b0b4', split: 0.45 },
    metal: 0.05, sheen: 0.5, finOpacity: 0.8,
    paint: (P) => {
      P.noise(141, 420, '#8a2a3a', 0.6, 0.003, 0.008, 0.35, 1); // the chromatophores
      P.noise(143, 160, '#c84a5a', 0.4, 0.006, 0.014, 0.2, 0.9);
    },
  },

  // Common octopus, Octopus vulgaris: a muscular bag of a mantle; eyes on raised turrets with a
  // horizontal pupil; eight arms with two rows of suckers, the side arms longest; warty, mottled
  // skin that changes colour.
  octopus: {
    plan: 'octopus', mode: 6, view: { yaw: -Math.PI / 2 + 0.4, pitch: 0.7 }, arm: 0.36, armR: 0.032, head: 0.07, base: -0.02, headZ: 0.0,
    mantle: { w: 0.085, h: 0.075, l: 0.1, y: 0.075, z: -0.085, lean: 0.25 },
    eye: { x: 0.05, y: 0.05, z: 0.02, r: 0.017, iris: '#d8c070', pupil: 'bar' },
    colors: { back: '#6a3e2e', flank: '#94624a', belly: '#e8d2c0', fin: '#b4886c', split: 0.5 },
    metal: 0.02, sheen: 0.3,
    paint: (P) => {
      P.noise(151, 220, '#4a2a1e', 0.55, 0.012, 0.035, 0.3, 1);
      P.noise(153, 260, '#e8c8b0', 0.5, 0.003, 0.008, 0.3, 1); // the warts
      // The arms' pale undersides with their rows of suckers.
      P.band(0, 0.2, '#f0e0d4', 1, 0.6, 1);
      for (let u = 0.62; u < 1; u += 0.01) P.blob(u, 0.08, 0.003, 0.03, '#d8b8a8', 0.8, 0.3);
    },
  },
};
