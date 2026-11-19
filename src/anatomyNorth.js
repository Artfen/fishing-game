// Anatomical recipes for the north's own fish (northFish.js), built by anatomy.js, in the same
// conventions as the Atlantic's (anatomyAtlantic.js): nose at +z, back up, about one unit long;
// t along the body from the snout (0) to the tail stalk (1); paint on a skin laid out snout to tail
// (u) and belly to back (v). The cod family's fins (three dorsals, two anals) written once.

const gadoidFins = ({ d = [[0.27, 0.4, 0.075], [0.45, 0.63, 0.055], [0.68, 0.85, 0.05]], a = [[0.42, 0.62, 0.05], [0.67, 0.84, 0.045]], tail = 'truncate', th = 0.09 } = {}) => [
  ...d.map(([t0, t1, h], i) => ({ kind: 'dorsal', t0, t1, h, profile: [[0, 0.6], [0.25, 1], [1, 0.25 + i * 0.05]], rays: 13 + i * 4 })),
  ...a.map(([t0, t1, h]) => ({ kind: 'anal', t0, t1, h, profile: [[0, 0.55], [0.25, 1], [1, 0.3]], rays: 20 })),
  { kind: 'pectoral', t: 0.24, a: 0.15, len: 0.1, splay: 0.45, droop: 0.2 },
  { kind: 'pelvic', t: 0.2, a: 0.03, len: 0.06, splay: 0.3, droop: 0.55 },
  { kind: 'caudal', shape: tail, h: th, fork: tail === 'forked' ? 0.12 : 0, rays: 20 },
];

export const NORTH_ANATOMY = {
  // Atlantic cod, Gadus morhua: heavy and pot-bellied, a big head with the upper jaw overhanging,
  // three dorsal and two anal fins, a square tail; mottled greenish-brown, a pale curved lateral line.
  cod: {
    plan: 'fish', bodyLen: 0.84, round: 2.2, mode: 0,
    top: [[0, 0.006], [0.05, 0.032], [0.12, 0.06], [0.25, 0.09], [0.42, 0.095], [0.62, 0.074], [0.82, 0.04], [1, 0.026]],
    bottom: [[0, -0.02], [0.05, -0.04], [0.12, -0.064], [0.28, -0.094], [0.45, -0.095], [0.65, -0.066], [0.84, -0.036], [1, -0.024]],
    width: [[0, 0.006], [0.08, 0.036], [0.25, 0.058], [0.45, 0.056], [0.7, 0.034], [0.9, 0.015], [1, 0.01]],
    mouth: { len: 0.1, y: -0.012, slope: -0.02, gape: 0.014 }, gill: { t: 0.23, curve: 0.03 },
    eye: { t: 0.09, y: 0.026, r: 0.019, iris: '#c0b070' },
    fins: gadoidFins({ d: [[0.27, 0.42, 0.08], [0.46, 0.64, 0.06], [0.68, 0.85, 0.055]] }),
    colors: { back: '#5e5a34', flank: '#a8a072', belly: '#ece8d6', fin: '#7a7450', split: 0.44 },
    scaleRows: [70, 18], metal: 0.1, sheen: 0.3,
    paint: (P) => {
      P.noise(301, 120, '#4a4628', 0.5, 0.008, 0.024, 0.45, 1); // the mottling over back and flanks
      P.line([[0.22, 0.7], [0.32, 0.76], [0.45, 0.68], [0.6, 0.58], [0.8, 0.54], [1, 0.5]], 3, '#e8e4cc', 0.75); // pale lateral line
    },
  },

  // Saithe (coley), Pollachius virens: slimmer, the lower jaw a little longer, a slightly forked tail;
  // dark green-black back, silver-grey flanks, the lateral line straight and pale.
  saithe: {
    plan: 'fish', bodyLen: 0.85, round: 2.3, mode: 0,
    top: [[0, 0.004], [0.05, 0.026], [0.12, 0.05], [0.25, 0.078], [0.42, 0.084], [0.62, 0.068], [0.82, 0.038], [1, 0.022]],
    bottom: [[0, -0.014], [0.05, -0.032], [0.12, -0.052], [0.28, -0.074], [0.45, -0.076], [0.65, -0.06], [0.84, -0.034], [1, -0.02]],
    width: [[0, 0.004], [0.08, 0.03], [0.25, 0.048], [0.45, 0.047], [0.7, 0.03], [0.9, 0.013], [1, 0.008]],
    mouth: { len: 0.1, y: -0.006, slope: -0.06, gape: 0.011 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.085, y: 0.024, r: 0.019, iris: '#b8b8a8' },
    fins: gadoidFins({ tail: 'forked', th: 0.1 }),
    colors: { back: '#24302f', flank: '#76827e', belly: '#dedfda', fin: '#34403e', split: 0.5 },
    scaleRows: [80, 20], metal: 0.35, sheen: 0.45,
    paint: (P) => {
      P.line([[0.2, 0.62], [0.4, 0.6], [0.7, 0.56], [1, 0.52]], 3, '#d8dcd6', 0.85); // straight pale lateral line
    },
  },

  // Ling, Molva molva: long and round like an eel, a long second dorsal and anal fin, a rounded tail;
  // mottled bronze and olive, a dark spot at the back of each dorsal fin.
  ling: {
    plan: 'fish', bodyLen: 0.95, round: 2.0, mode: 2, long: 1.25,
    top: [[0, 0.004], [0.04, 0.022], [0.1, 0.036], [0.22, 0.044], [0.45, 0.042], [0.7, 0.032], [0.88, 0.018], [1, 0.006]],
    bottom: [[0, -0.01], [0.04, -0.024], [0.1, -0.036], [0.22, -0.044], [0.45, -0.042], [0.7, -0.03], [0.88, -0.016], [1, -0.005]],
    width: [[0, 0.005], [0.06, 0.026], [0.2, 0.04], [0.45, 0.036], [0.7, 0.024], [0.88, 0.011], [1, 0.003]],
    mouth: { len: 0.07, y: -0.006, slope: -0.04, gape: 0.012 }, gill: { t: 0.16, curve: 0.02 },
    eye: { t: 0.05, y: 0.02, r: 0.012, iris: '#a89870' },
    fins: [
      { kind: 'dorsal', t0: 0.2, t1: 0.3, h: 0.03, profile: [[0, 0.6], [0.3, 1], [1, 0.4]], rays: 14, edge: '#20201a' },
      { kind: 'dorsal', t0: 0.33, t1: 0.95, h: 0.026, profile: [[0, 0.5], [0.1, 1], [0.9, 1], [1, 0.5]], rays: 60, edge: '#20201a' },
      { kind: 'anal', t0: 0.4, t1: 0.93, h: 0.022, profile: [[0, 0.5], [0.1, 1], [0.9, 1], [1, 0.5]], rays: 56 },
      { kind: 'pectoral', t: 0.17, a: 0.2, len: 0.05, splay: 0.5, droop: 0.15 },
      { kind: 'pelvic', t: 0.12, a: 0.03, len: 0.04, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'rounded', h: 0.03, rays: 14 },
    ],
    colors: { back: '#4c4630', flank: '#86805c', belly: '#ddd8c6', fin: '#544e38', split: 0.48 },
    scaleRows: null, metal: 0.05, sheen: 0.3,
    paint: (P) => {
      P.noise(311, 110, '#3a3622', 0.55, 0.01, 0.03, 0.4, 1); // the marbling
      P.blob(0.3, 0.98, 0.012, 0.03, '#141410', 0.9, 0.5); // dark spot at the first dorsal's end
      P.blob(0.94, 0.98, 0.012, 0.03, '#141410', 0.9, 0.5); // and the second's
    },
  },

  // Flapper skate, Dipturus intermedius: a huge diamond disc with a long pointed snout, a slender
  // tail with two small dorsal fins near its tip; grey-brown back with pale spots, grey belly.
  skate: {
    plan: 'fish', bodyLen: 0.97, round: 2.2, mode: 1, view: { yaw: -Math.PI / 2 + 0.35, pitch: 0.95 },
    top: [[0, 0.001], [0.06, 0.008], [0.16, 0.02], [0.3, 0.024], [0.42, 0.018], [0.52, 0.01], [0.68, 0.007], [0.88, 0.005], [1, 0.002]],
    bottom: [[0, -0.001], [0.06, -0.006], [0.16, -0.011], [0.3, -0.013], [0.42, -0.011], [0.52, -0.007], [0.68, -0.005], [0.88, -0.004], [1, -0.002]],
    // (A longer snout and a broader disc than the thornback's.)
    width: [[0, 0.006], [0.08, 0.06], [0.16, 0.15], [0.26, 0.22], [0.34, 0.2], [0.42, 0.13], [0.48, 0.05], [0.53, 0.015], [0.62, 0.01], [0.8, 0.007], [1, 0.003]],
    mouth: null, gill: null,
    eye: { t: 0.14, y: 0.018, r: 0.008, iris: '#a8a090', up: 2.6, fwd: 0.15 },
    fins: [
      { kind: 'pectoral', t: 0.26, a: 0.2, len: 0.11, w: 0.22, splay: 1.57, droop: 0, spread: true, rays: 0, profile: [[0, 1], [0.5, 0.75], [1, 0.2]] },
      { kind: 'pelvic', t: 0.49, a: 0.2, len: 0.05, w: 0.06, splay: 1.4, droop: 0, spread: true, rays: 0, profile: [[0, 1], [0.6, 0.6], [1, 0.15]] },
      { kind: 'dorsal', t0: 0.86, t1: 0.89, h: 0.014, profile: [[0, 0.5], [0.4, 1], [1, 0.3]], rays: 5 },
      { kind: 'dorsal', t0: 0.91, t1: 0.94, h: 0.013, profile: [[0, 0.5], [0.4, 1], [1, 0.3]], rays: 5 },
      { kind: 'caudal', shape: 'rounded', h: 0.014, rays: 6 },
    ],
    colors: { back: '#56524a', flank: '#68645a', belly: '#c4c8cc', fin: '#56524a', split: 0.52 },
    scaleRows: null, metal: 0.03, sheen: 0.2, finOpacity: 0.98,
    paint: (P) => {
      P.noise(321, 120, '#e0dccc', 0.45, 0.006, 0.016, 0.55, 1); // the pale spots
      P.noise(323, 90, '#3a3832', 0.4, 0.006, 0.02, 0.5, 1); // and darker marbling
    },
  },

  // Haddock, Melanogrammus aeglefinus: a cod with a small mouth under a pointed snout, a tall first
  // dorsal, a forked tail; purplish-grey back, silver-white below, a black lateral line and the dark
  // thumbprint above the pectoral fin.
  haddock: {
    plan: 'fish', bodyLen: 0.84, round: 2.2, mode: 0,
    top: [[0, 0.006], [0.05, 0.03], [0.12, 0.056], [0.25, 0.084], [0.42, 0.088], [0.62, 0.07], [0.82, 0.038], [1, 0.024]],
    bottom: [[0, -0.016], [0.05, -0.034], [0.12, -0.056], [0.28, -0.08], [0.45, -0.08], [0.65, -0.06], [0.84, -0.034], [1, -0.022]],
    width: [[0, 0.005], [0.08, 0.032], [0.25, 0.05], [0.45, 0.05], [0.7, 0.031], [0.9, 0.013], [1, 0.009]],
    mouth: { len: 0.07, y: -0.016, slope: 0.02, gape: 0.008 }, gill: { t: 0.22, curve: 0.03 },
    eye: { t: 0.09, y: 0.026, r: 0.021, iris: '#b8b0a8' },
    fins: gadoidFins({ d: [[0.26, 0.38, 0.1], [0.43, 0.62, 0.055], [0.67, 0.84, 0.05]], tail: 'forked', th: 0.1 }),
    colors: { back: '#3e3c40', flank: '#a6a6a4', belly: '#ececea', fin: '#4c4a4e', split: 0.5 },
    scaleRows: [80, 20], metal: 0.3, sheen: 0.4,
    paint: (P) => {
      P.line([[0.2, 0.68], [0.32, 0.72], [0.45, 0.66], [0.6, 0.58], [0.8, 0.54], [1, 0.5]], 3.5, '#121214', 0.9); // the black lateral line
      P.blob(0.27, 0.66, 0.025, 0.05, '#18181a', 0.9, 0.5); // the devil's thumbprint
    },
  },
};
