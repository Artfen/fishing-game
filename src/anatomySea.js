// Anatomical recipes for the sea's whales and dolphins (see world/sealife.js): only to be watched,
// never caught. Built by anatomy.js on the fish plan, with the same conventions (nose at +z, back
// up, about one unit long; t from the snout at 0 to the tail stock at 1; paint on a skin laid out
// snout to tail, u, and belly to back, v), but with smooth skin (no scales, no gill cover), the
// flukes lying flat across the tail, and the swim an up-and-down beat of the tail stock (mode 7).

const spots = (P, seed, n, color, alpha, v0, v1, u0 = 0.12, u1 = 0.95) => {
  let s = seed;
  const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < n; i++) P.blob(u0 + r() * (u1 - u0), v0 + r() * (v1 - v0), 0.004 + r() * 0.004, 0.012 + r() * 0.012, color, alpha, 0.4);
};

export const SEA_ANATOMY = {
  // Bottlenose dolphin, Tursiops truncatus: robust, with a short, stubby beak set off from the
  // rounded melon by a crease; a tall, curved (falcate) dorsal fin in the middle of the back.
  // Dark grey above, shading to light grey on the flanks and pale beneath, with a faint darker
  // cape.
  bottlenose: {
    plan: 'fish', bodyLen: 0.87, round: 2.15, mode: 7,
    top: [[0, 0.003], [0.035, 0.009], [0.06, 0.013], [0.085, 0.03], [0.14, 0.052], [0.26, 0.068], [0.42, 0.07], [0.6, 0.056], [0.8, 0.032], [0.94, 0.015], [1, 0.011]],
    bottom: [[0, -0.004], [0.04, -0.011], [0.08, -0.02], [0.15, -0.044], [0.3, -0.064], [0.46, -0.064], [0.62, -0.048], [0.8, -0.025], [0.94, -0.012], [1, -0.009]],
    width: [[0, 0.004], [0.06, 0.013], [0.12, 0.038], [0.28, 0.062], [0.45, 0.062], [0.65, 0.044], [0.85, 0.018], [1, 0.008]],
    mouth: { len: 0.07, y: -0.005, slope: -0.02, gape: 0.004 }, gill: null,
    eye: { t: 0.11, y: -0.003, r: 0.007, iris: '#2a2622' },
    fins: [
      { kind: 'dorsal', t0: 0.42, t1: 0.57, h: 0.075, profile: [[0, 0.25], [0.45, 0.75], [0.78, 1], [0.92, 0.6], [1, 0.08]], rays: 4, color: '#3e4852' },
      { kind: 'pectoral', t: 0.2, a: 0.1, len: 0.1, w: 0.035, splay: 0.9, droop: 0.65, profile: [[0, 1], [0.6, 0.6], [1, 0.1]], rays: 4, color: '#4a545e' },
      { kind: 'caudal', shape: 'flukes', h: 0.11, rays: 4, color: '#3e4852' },
    ],
    colors: { back: '#3e4852', flank: '#7b8690', belly: '#e2e5e8', fin: '#4a545e', split: 0.46 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      // The cape, darker along the back from the melon to behind the fin.
      P.line([[0.1, 0.92], [0.35, 0.86], [0.6, 0.88], [0.8, 0.95]], 22, '#323c46', 0.45);
    },
  },

  // Common dolphin, Delphinus delphis: slender, with a long, slim beak; a dark cape dipping to a V
  // under the dorsal fin, and an hourglass on the flank: tan to yellow in front, grey behind; a
  // white belly and a dark stripe from the beak to the flipper.
  commondolphin: {
    plan: 'fish', bodyLen: 0.87, round: 2.15, mode: 7,
    top: [[0, 0.002], [0.06, 0.007], [0.09, 0.012], [0.12, 0.03], [0.18, 0.05], [0.3, 0.062], [0.45, 0.062], [0.62, 0.05], [0.8, 0.028], [0.94, 0.013], [1, 0.01]],
    bottom: [[0, -0.003], [0.06, -0.009], [0.1, -0.016], [0.18, -0.04], [0.32, -0.056], [0.48, -0.056], [0.64, -0.042], [0.8, -0.022], [0.94, -0.011], [1, -0.008]],
    width: [[0, 0.003], [0.08, 0.01], [0.15, 0.034], [0.3, 0.054], [0.46, 0.054], [0.66, 0.038], [0.86, 0.016], [1, 0.007]],
    mouth: { len: 0.1, y: -0.004, slope: -0.015, gape: 0.003 }, gill: null,
    eye: { t: 0.14, y: -0.002, r: 0.006, iris: '#1e1a18' },
    fins: [
      { kind: 'dorsal', t0: 0.43, t1: 0.56, h: 0.07, profile: [[0, 0.25], [0.45, 0.75], [0.78, 1], [0.92, 0.6], [1, 0.08]], rays: 4, color: '#22262c' },
      { kind: 'pectoral', t: 0.22, a: 0.1, len: 0.09, w: 0.03, splay: 0.9, droop: 0.65, profile: [[0, 1], [0.6, 0.6], [1, 0.1]], rays: 4, color: '#2a2e34' },
      { kind: 'caudal', shape: 'flukes', h: 0.1, rays: 4, color: '#22262c' },
    ],
    colors: { back: '#24282e', flank: '#a8acb0', belly: '#f2f2f0', fin: '#2a2e34', split: 0.5 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      // The hourglass: a tan-yellow patch in front, a grey one behind, meeting under the fin.
      P.blob(0.32, 0.58, 0.13, 0.13, '#d8c27e', 0.85, 0.45);
      P.blob(0.68, 0.56, 0.15, 0.12, '#9aa0a8', 0.85, 0.45);
      // The cape dipping down to a V under the fin.
      P.line([[0.12, 0.8], [0.3, 0.76], [0.5, 0.62], [0.62, 0.76], [0.85, 0.82]], 6, '#24282e', 0.85);
      // The stripe from the beak to the flipper.
      P.line([[0.1, 0.45], [0.16, 0.4], [0.22, 0.36]], 2.5, '#24282e', 0.75);
    },
  },

  // Atlantic spotted dolphin, Stenella frontalis: like a bottlenose but slimmer, with a longer
  // beak tipped white; a dark grey cape; the adults covered all over in spots, pale on the dark back
  // and dark on the pale belly, more the older they are.
  spotteddolphin: {
    plan: 'fish', bodyLen: 0.87, round: 2.15, mode: 7,
    top: [[0, 0.002], [0.05, 0.008], [0.08, 0.012], [0.11, 0.03], [0.17, 0.052], [0.3, 0.064], [0.45, 0.064], [0.62, 0.052], [0.8, 0.029], [0.94, 0.014], [1, 0.01]],
    bottom: [[0, -0.003], [0.05, -0.01], [0.09, -0.017], [0.17, -0.042], [0.32, -0.058], [0.48, -0.058], [0.64, -0.044], [0.8, -0.023], [0.94, -0.011], [1, -0.008]],
    width: [[0, 0.003], [0.07, 0.011], [0.14, 0.036], [0.3, 0.056], [0.46, 0.056], [0.66, 0.04], [0.86, 0.017], [1, 0.007]],
    mouth: { len: 0.09, y: -0.004, slope: -0.015, gape: 0.003 }, gill: null,
    eye: { t: 0.13, y: -0.002, r: 0.006, iris: '#1e1a18' },
    fins: [
      { kind: 'dorsal', t0: 0.43, t1: 0.56, h: 0.07, profile: [[0, 0.25], [0.45, 0.75], [0.78, 1], [0.92, 0.6], [1, 0.08]], rays: 4, color: '#3a424c' },
      { kind: 'pectoral', t: 0.21, a: 0.1, len: 0.09, w: 0.032, splay: 0.9, droop: 0.65, profile: [[0, 1], [0.6, 0.6], [1, 0.1]], rays: 4, color: '#3a424c' },
      { kind: 'caudal', shape: 'flukes', h: 0.1, rays: 4, color: '#3a424c' },
    ],
    colors: { back: '#38404a', flank: '#7c8792', belly: '#e8eaec', fin: '#3a424c', split: 0.48 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      P.band(0, 1, '#f2f2f0', 0.7, 0, 0.025); // the white tip of the beak
      spots(P, 7, 140, '#e8ecef', 0.55, 0.55, 0.98);
      spots(P, 11, 120, '#3a424c', 0.5, 0.05, 0.5);
    },
  },

  // Short-finned pilot whale, Globicephala macrorhynchus: a long, stocky black body with a bulbous
  // round melon and no beak to speak of; a low, broad-based, backswept dorsal fin set well forward;
  // long, slender, sickle-shaped flippers. Black or dark grey all over, a paler saddle behind the
  // fin and a grey anchor-shaped patch on the chest.
  pilotwhale: {
    plan: 'fish', bodyLen: 0.88, round: 2.2, mode: 7,
    top: [[0, -0.01], [0.015, 0.026], [0.05, 0.05], [0.12, 0.066], [0.28, 0.074], [0.45, 0.07], [0.62, 0.054], [0.8, 0.032], [0.94, 0.017], [1, 0.012]],
    bottom: [[0, -0.024], [0.04, -0.045], [0.12, -0.062], [0.3, -0.07], [0.48, -0.066], [0.64, -0.05], [0.8, -0.028], [0.94, -0.014], [1, -0.01]],
    width: [[0, 0.012], [0.04, 0.04], [0.12, 0.058], [0.3, 0.068], [0.48, 0.064], [0.66, 0.046], [0.86, 0.02], [1, 0.009]],
    mouth: { len: 0.05, y: -0.024, slope: -0.02, gape: 0.004 }, gill: null,
    eye: { t: 0.07, y: -0.012, r: 0.006, iris: '#141414' },
    fins: [
      { kind: 'dorsal', t0: 0.3, t1: 0.46, h: 0.05, profile: [[0, 0.3], [0.35, 0.85], [0.7, 1], [0.9, 0.7], [1, 0.08]], rays: 4, color: '#1a1c1e' },
      { kind: 'pectoral', t: 0.18, a: 0.1, len: 0.15, w: 0.03, splay: 0.8, droop: 0.6, profile: [[0, 1], [0.5, 0.65], [1, 0.05]], rays: 4, color: '#1a1c1e' },
      { kind: 'caudal', shape: 'flukes', h: 0.1, rays: 4, color: '#1a1c1e' },
    ],
    colors: { back: '#16181a', flank: '#22252a', belly: '#33373c', fin: '#1a1c1e', split: 0.45 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      P.blob(0.52, 0.86, 0.07, 0.08, '#3a3e44', 0.6, 0.6); // the pale saddle behind the fin
      P.blob(0.16, 0.08, 0.05, 0.06, '#565a60', 0.6, 0.5); // the anchor patch on the chest
    },
  },

  // Fin whale, Balaenoptera physalus: very long and slender, with a flat, V-shaped head; a small,
  // backswept dorsal fin far back; grey above and white below, the right lower jaw white and the
  // left dark; the throat pleated. The second-largest animal on Earth.
  finwhale: {
    plan: 'fish', bodyLen: 0.9, round: 2.15, mode: 7,
    top: [[0, -0.004], [0.04, 0.008], [0.12, 0.024], [0.22, 0.036], [0.4, 0.042], [0.6, 0.038], [0.76, 0.026], [0.9, 0.012], [1, 0.008]],
    bottom: [[0, -0.008], [0.06, -0.022], [0.16, -0.04], [0.3, -0.046], [0.48, -0.04], [0.66, -0.03], [0.82, -0.018], [0.94, -0.009], [1, -0.007]],
    width: [[0, 0.01], [0.05, 0.026], [0.14, 0.04], [0.3, 0.046], [0.5, 0.042], [0.7, 0.03], [0.88, 0.012], [1, 0.006]],
    mouth: { len: 0.2, y: -0.004, slope: -0.02, gape: 0.004 }, gill: null,
    eye: { t: 0.19, y: -0.008, r: 0.004, iris: '#141414' },
    fins: [
      { kind: 'dorsal', t0: 0.7, t1: 0.77, h: 0.022, profile: [[0, 0.3], [0.5, 0.9], [0.8, 1], [1, 0.1]], rays: 4, color: '#4a5258' },
      { kind: 'pectoral', t: 0.26, a: 0.1, len: 0.08, w: 0.018, splay: 0.8, droop: 0.6, profile: [[0, 1], [0.5, 0.6], [1, 0.1]], rays: 4, color: '#4a5258' },
      { kind: 'caudal', shape: 'flukes', h: 0.09, rays: 4, color: '#4a5258' },
    ],
    colors: { back: '#4a5258', flank: '#6e777e', belly: '#e6e8ea', fin: '#4a5258', split: 0.52 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      // The throat pleats, and the white of the lower jaw.
      for (let k = 0; k < 9; k++) P.line([[0.08, 0.04 + k * 0.035], [0.3, 0.06 + k * 0.03], [0.48, 0.08 + k * 0.02]], 1.2, '#b8bcc0', 0.6);
      P.blob(0.12, 0.3, 0.1, 0.06, '#d8dbde', 0.6, 0.5);
      // A pale chevron behind the head.
      P.line([[0.24, 0.95], [0.3, 0.8], [0.36, 0.95]], 6, '#7a8288', 0.5);
    },
  },

  // Minke whale, Balaenoptera acutorostrata: small for a rorqual, with a sharply pointed head; a
  // tall, curved dorsal fin two thirds of the way back; dark grey above, white below, and a white
  // band across each flipper.
  minkewhale: {
    plan: 'fish', bodyLen: 0.89, round: 2.15, mode: 7,
    top: [[0, -0.004], [0.04, 0.01], [0.12, 0.03], [0.24, 0.046], [0.4, 0.052], [0.58, 0.046], [0.76, 0.03], [0.9, 0.014], [1, 0.009]],
    bottom: [[0, -0.008], [0.06, -0.026], [0.16, -0.046], [0.32, -0.054], [0.5, -0.048], [0.68, -0.034], [0.84, -0.018], [1, -0.008]],
    width: [[0, 0.008], [0.05, 0.026], [0.14, 0.044], [0.3, 0.054], [0.5, 0.05], [0.7, 0.034], [0.88, 0.014], [1, 0.007]],
    mouth: { len: 0.17, y: -0.004, slope: -0.02, gape: 0.004 }, gill: null,
    eye: { t: 0.16, y: -0.008, r: 0.005, iris: '#141414' },
    fins: [
      { kind: 'dorsal', t0: 0.62, t1: 0.7, h: 0.035, profile: [[0, 0.25], [0.5, 0.85], [0.8, 1], [1, 0.1]], rays: 4, color: '#2e3438' },
      { kind: 'pectoral', t: 0.25, a: 0.1, len: 0.09, w: 0.02, splay: 0.8, droop: 0.6, profile: [[0, 1], [0.5, 0.6], [1, 0.1]], rays: 4, color: '#2e3438', edge: '#f0f0ee', edgeFrom: 0.35 },
      { kind: 'caudal', shape: 'flukes', h: 0.09, rays: 4, color: '#2e3438' },
    ],
    colors: { back: '#2e3438', flank: '#596168', belly: '#eceeee', fin: '#2e3438', split: 0.5 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      for (let k = 0; k < 8; k++) P.line([[0.08, 0.04 + k * 0.035], [0.28, 0.06 + k * 0.03], [0.44, 0.08 + k * 0.02]], 1.2, '#b8bcc0', 0.55);
      P.line([[0.3, 0.6], [0.4, 0.66], [0.5, 0.62]], 8, '#9aa2a8', 0.4);
    },
  },

  // Sperm whale, Physeter macrocephalus: a huge, square, block of a head, a third of the whole
  // length, with a narrow lower jaw slung underneath; wrinkled, dark brownish-grey skin; a low
  // hump for a dorsal fin two thirds of the way back, then a row of knuckles down the tail stock;
  // small paddle flippers and broad triangular flukes it lifts high as it dives.
  spermwhale: {
    plan: 'fish', bodyLen: 0.87, round: 2.6, mode: 7,
    top: [[0, 0.05], [0.02, 0.064], [0.12, 0.068], [0.28, 0.062], [0.4, 0.054], [0.58, 0.05], [0.66, 0.056], [0.7, 0.046], [0.82, 0.03], [0.94, 0.016], [1, 0.011]],
    bottom: [[0, -0.02], [0.02, -0.05], [0.12, -0.064], [0.3, -0.066], [0.46, -0.06], [0.62, -0.046], [0.8, -0.026], [0.94, -0.012], [1, -0.009]],
    width: [[0, 0.03], [0.02, 0.05], [0.12, 0.058], [0.3, 0.062], [0.48, 0.058], [0.66, 0.044], [0.86, 0.018], [1, 0.008]],
    mouth: { len: 0.24, y: -0.05, slope: 0, gape: 0.004 }, gill: null, capNose: true,
    eye: { t: 0.3, y: -0.03, r: 0.005, iris: '#141414' },
    fins: [
      { kind: 'dorsal', t0: 0.63, t1: 0.7, h: 0.012, profile: [[0, 0.4], [0.5, 1], [1, 0.2]], rays: 3, color: '#3e3a36' },
      { kind: 'pectoral', t: 0.34, a: 0.1, len: 0.045, w: 0.025, splay: 0.8, droop: 0.6, profile: [[0, 1], [0.5, 0.9], [1, 0.4]], rays: 3, color: '#3e3a36' },
      { kind: 'caudal', shape: 'flukes', h: 0.11, rays: 4, color: '#3a3632' },
    ],
    colors: { back: '#3a3632', flank: '#4c4742', belly: '#5c5650', fin: '#3e3a36', split: 0.5 },
    scaleRows: null, metal: 0.04, sheen: 0.15, finOpacity: 1, smoothFins: true,
    paint: (P) => {
      // Wrinkled skin behind the head, and the pale lips of the narrow lower jaw.
      for (let k = 0; k < 40; k++) {
        const u = 0.34 + (k % 20) * 0.03, v = k < 20 ? 0.62 : 0.4;
        P.line([[u, v], [u + 0.01, v + 0.12]], 1.4, '#2a2622', 0.35);
      }
      P.line([[0.02, 0.06], [0.2, 0.05]], 4, '#d8d0c4', 0.6);
      // The knuckles along the tail stock.
      for (let k = 0; k < 5; k++) P.blob(0.72 + k * 0.045, 0.97, 0.01, 0.03, '#2a2622', 0.6, 0.4);
    },
  },
};
