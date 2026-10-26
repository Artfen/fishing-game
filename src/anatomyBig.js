// Anatomical recipes for the big game of the open ocean (bigGame.js), built by anatomy.js with
// the same conventions as the others: nose at +z, back up, about one unit long overall; t runs
// along the body from the tip of the snout (or the bill) at 0 to the tail stalk at 1; paint draws
// on a skin laid out snout to tail (u) and belly to back (v).
//
// The billfish carry their bill in the body's own outline: the profiles run thin and round for
// the first fifth of the length (the upper jaw drawn out into a spear, the lower jaw shorter),
// then swell into the head. The sharks are built on the fish plan with no scales, no gill cover
// (five gill slits painted instead), the mouth underneath, and a shark's tail; the hammerhead's
// head is the body's own cross-section spread out sideways into a flat blade, an eye at each tip.

const bars = (P, u0, u1, n, color, alpha, width, v0 = 0.3, v1 = 0.8) => {
  for (let k = 0; k < n; k++) {
    const u = u0 + (k / Math.max(1, n - 1)) * (u1 - u0);
    P.line([[u, v1], [u + 0.006, (v0 + v1) / 2], [u, v0]], width, color, alpha);
  }
};
// Five gill slits, a little curved, low on the side behind the head.
const gillSlits = (P, u0, u1, color = '#1a1e24') => {
  for (let k = 0; k < 5; k++) {
    const u = u0 + (k / 4) * (u1 - u0);
    P.line([[u, 0.62], [u + 0.004, 0.5], [u, 0.38]], 2, color, 0.45);
  }
};

export const BIG_ANATOMY = {
  /* ================= the billfish ================= */

  // Blue marlin, Makaira nigricans: a long round spear of a bill; the first dorsal fin high and
  // pointed in front, then low, folding into a groove; long, sickle-shaped pectorals that fold
  // flat; a high, stiff crescent tail with two keels each side of the stalk. Cobalt above,
  // silvery below, barred with pale blue.
  bluemarlin: {
    plan: 'fish', bodyLen: 0.85, round: 2.1, mode: 4,
    top: [[0, 0.002], [0.16, 0.005], [0.2, 0.012], [0.24, 0.032], [0.3, 0.06], [0.38, 0.078], [0.48, 0.08], [0.62, 0.066], [0.8, 0.036], [0.93, 0.016], [1, 0.011]],
    bottom: [[0, -0.002], [0.14, -0.004], [0.18, -0.01], [0.23, -0.028], [0.3, -0.054], [0.4, -0.07], [0.52, -0.07], [0.66, -0.054], [0.82, -0.028], [0.93, -0.014], [1, -0.01]],
    width: [[0, 0.002], [0.16, 0.004], [0.21, 0.014], [0.28, 0.034], [0.4, 0.05], [0.55, 0.046], [0.75, 0.028], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.22, y: -0.006, slope: -0.04, gape: 0.006 }, gill: { t: 0.31, curve: 0.04 },
    eye: { t: 0.235, y: 0.008, r: 0.011, iris: '#304a7a' },
    fins: [
      { kind: 'dorsal', t0: 0.3, t1: 0.66, h: 0.1, profile: [[0, 1], [0.08, 0.86], [0.25, 0.32], [0.6, 0.22], [1, 0.12]], rays: 40, color: '#14306e' },
      { kind: 'dorsal', t0: 0.86, t1: 0.9, h: 0.024, profile: [[0, 0.8], [0.4, 1], [1, 0.3]], rays: 6, color: '#14306e' },
      { kind: 'anal', t0: 0.67, t1: 0.77, h: 0.05, profile: [[0, 1], [0.3, 0.6], [1, 0.25]], rays: 12, color: '#3a5a8a' },
      { kind: 'anal', t0: 0.86, t1: 0.89, h: 0.02, profile: [[0, 0.8], [0.4, 1], [1, 0.3]], rays: 6, color: '#3a5a8a' },
      { kind: 'pectoral', t: 0.32, a: 0.17, len: 0.15, w: 0.034, splay: 0.6, droop: 0.4, profile: [[0, 0.9], [0.35, 0.75], [1, 0.05]], color: '#1e3a74' },
      { kind: 'pelvic', t: 0.35, a: 0.02, len: 0.08, w: 0.008, splay: 0.15, droop: 1.0, profile: [[0, 1], [1, 0.4]], color: '#2a4a80' },
      { kind: 'keel', t: 0.9, len: 0.08, h: 0.012 },
      { kind: 'caudal', shape: 'lunate', h: 0.16, rays: 24, color: '#14306e' },
    ],
    colors: { back: '#0c2668', flank: '#4a7cbc', belly: '#eef2f6', fin: '#16306e', split: 0.46 },
    scaleRows: null, metal: 0.45, sheen: 0.7,
    paint: (P) => {
      // The bill darker; the pale blue bars down the flanks.
      P.band(0.25, 1, '#0a1838', 0.55, 0, 0.19);
      bars(P, 0.33, 0.86, 15, '#a8c8f0', 0.6, 4, 0.34, 0.8);
    },
  },

  // Sailfish, Istiophorus platypterus: slimmer, with a thin bill; the first dorsal fin a huge sail,
  // far taller than the body is deep, cobalt with darker spots; very long, thin pelvic fins.
  // Rows of pale bars made of spots down the flanks.
  sailfish: {
    plan: 'fish', bodyLen: 0.86, round: 2.1, mode: 4,
    top: [[0, 0.0015], [0.17, 0.004], [0.21, 0.011], [0.26, 0.028], [0.33, 0.046], [0.45, 0.052], [0.62, 0.044], [0.8, 0.026], [0.93, 0.012], [1, 0.008]],
    bottom: [[0, -0.0015], [0.15, -0.003], [0.19, -0.008], [0.25, -0.024], [0.33, -0.042], [0.47, -0.046], [0.64, -0.036], [0.82, -0.02], [0.93, -0.01], [1, -0.008]],
    width: [[0, 0.0015], [0.17, 0.003], [0.22, 0.011], [0.3, 0.024], [0.45, 0.032], [0.65, 0.026], [0.85, 0.014], [1, 0.008]],
    mouth: { len: 0.24, y: -0.004, slope: -0.03, gape: 0.005 }, gill: { t: 0.31, curve: 0.035 },
    eye: { t: 0.25, y: 0.006, r: 0.01, iris: '#3a5080' },
    fins: [
      { kind: 'dorsal', t0: 0.27, t1: 0.74, h: 0.2, profile: [[0, 0.7], [0.1, 0.95], [0.35, 1], [0.65, 0.85], [0.88, 0.45], [1, 0.08]], rays: 44, color: '#1a3888', edge: '#0e1e4e', edgeFrom: 0.35 },
      { kind: 'dorsal', t0: 0.86, t1: 0.9, h: 0.02, profile: [[0, 0.8], [0.4, 1], [1, 0.3]], rays: 6, color: '#1a3888' },
      { kind: 'anal', t0: 0.66, t1: 0.75, h: 0.035, profile: [[0, 1], [0.3, 0.6], [1, 0.25]], rays: 12, color: '#4a6a9a' },
      { kind: 'pectoral', t: 0.33, a: 0.16, len: 0.09, w: 0.022, splay: 0.6, droop: 0.4, profile: [[0, 0.9], [0.4, 0.7], [1, 0.05]], color: '#2a4a86' },
      { kind: 'pelvic', t: 0.35, a: 0.02, len: 0.17, w: 0.006, splay: 0.12, droop: 1.15, profile: [[0, 1], [0.6, 0.6], [1, 0.4]], color: '#2a4a86' },
      { kind: 'keel', t: 0.9, len: 0.07, h: 0.009 },
      { kind: 'caudal', shape: 'lunate', h: 0.15, rays: 24, color: '#16306e' },
    ],
    colors: { back: '#10306c', flank: '#6a8ec4', belly: '#f0f2f4', fin: '#1a3888', split: 0.5 },
    scaleRows: null, metal: 0.45, sheen: 0.7,
    paint: (P) => {
      P.band(0.25, 1, '#0a1838', 0.5, 0, 0.2);
      // Rows of pale spots, in vertical bars.
      for (let k = 0; k < 16; k++) {
        const u = 0.34 + k * 0.034;
        for (let j = 0; j < 6; j++) P.blob(u, 0.36 + j * 0.075, 0.004, 0.022, '#d0e0f6', 0.7, 0.4);
      }
    },
  },

  // Longbill spearfish, Tetrapturus pfluegeri: very slim and compressed; a bill only a little
  // longer than the lower jaw; a long first dorsal fin, high in front, then running back at an
  // even height almost to the second. Dark blue above, silvery below, without bars.
  spearfish: {
    plan: 'fish', bodyLen: 0.87, round: 2.15, mode: 4,
    top: [[0, 0.0015], [0.1, 0.004], [0.14, 0.012], [0.2, 0.03], [0.3, 0.046], [0.45, 0.05], [0.62, 0.044], [0.8, 0.026], [0.93, 0.012], [1, 0.008]],
    bottom: [[0, -0.0015], [0.09, -0.004], [0.13, -0.01], [0.2, -0.028], [0.3, -0.04], [0.46, -0.044], [0.64, -0.036], [0.82, -0.02], [0.93, -0.01], [1, -0.008]],
    width: [[0, 0.0015], [0.1, 0.004], [0.16, 0.012], [0.26, 0.022], [0.45, 0.026], [0.65, 0.022], [0.85, 0.012], [1, 0.008]],
    mouth: { len: 0.17, y: -0.004, slope: -0.04, gape: 0.005 }, gill: { t: 0.25, curve: 0.035 },
    eye: { t: 0.18, y: 0.008, r: 0.01, iris: '#3a4a70' },
    fins: [
      { kind: 'dorsal', t0: 0.25, t1: 0.82, h: 0.07, profile: [[0, 1], [0.08, 0.8], [0.2, 0.55], [0.85, 0.48], [1, 0.15]], rays: 46, color: '#16285e' },
      { kind: 'dorsal', t0: 0.87, t1: 0.9, h: 0.018, profile: [[0, 0.8], [0.4, 1], [1, 0.3]], rays: 5, color: '#16285e' },
      { kind: 'anal', t0: 0.64, t1: 0.74, h: 0.034, profile: [[0, 1], [0.3, 0.6], [1, 0.25]], rays: 12, color: '#3a4e80' },
      { kind: 'pectoral', t: 0.27, a: 0.16, len: 0.07, w: 0.02, splay: 0.6, droop: 0.4, profile: [[0, 0.9], [0.4, 0.7], [1, 0.05]], color: '#22356e' },
      { kind: 'pelvic', t: 0.29, a: 0.02, len: 0.07, w: 0.006, splay: 0.12, droop: 1.1, profile: [[0, 1], [1, 0.4]], color: '#22356e' },
      { kind: 'keel', t: 0.9, len: 0.07, h: 0.008 },
      { kind: 'caudal', shape: 'lunate', h: 0.14, rays: 22, color: '#16285e' },
    ],
    colors: { back: '#10235a', flank: '#5c76a8', belly: '#eef0f2', fin: '#16285e', split: 0.48 },
    scaleRows: null, metal: 0.45, sheen: 0.7,
    paint: (P) => {
      P.band(0.25, 1, '#0a1634', 0.5, 0, 0.13);
      P.line([[0.2, 0.55], [0.6, 0.52], [1, 0.5]], 2, '#8aa0c8', 0.3);
    },
  },

  /* ================= wahoo, dorado and the tunas ================= */

  // Wahoo, Acanthocybium solandri: long and slender; a pointed, beak-like snout full of teeth; a
  // long, low first dorsal fin of many spines; finlets above and below; a stiff, upright tail.
  // Steel-blue above, silver below, with cobalt bars down the flanks.
  wahoo: {
    plan: 'fish', bodyLen: 0.89, round: 2.05, mode: 4,
    top: [[0, 0.001], [0.04, 0.008], [0.1, 0.022], [0.2, 0.036], [0.4, 0.042], [0.6, 0.04], [0.78, 0.028], [0.92, 0.012], [1, 0.008]],
    bottom: [[0, -0.003], [0.04, -0.01], [0.1, -0.022], [0.2, -0.032], [0.4, -0.038], [0.6, -0.036], [0.78, -0.024], [0.92, -0.01], [1, -0.007]],
    width: [[0, 0.002], [0.05, 0.01], [0.15, 0.024], [0.35, 0.03], [0.6, 0.028], [0.8, 0.018], [1, 0.008]],
    mouth: { len: 0.08, y: -0.004, slope: -0.03, gape: 0.006 }, gill: { t: 0.15, curve: 0.03 },
    eye: { t: 0.08, y: 0.01, r: 0.009, iris: '#b8c0c8' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.2, t1: 0.6, h: 0.022, spines: 24, profile: [[0, 1], [0.1, 0.9], [1, 0.45]], color: '#1e3a6a' },
      { kind: 'dorsal', t0: 0.62, t1: 0.69, h: 0.03, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 10, color: '#1e3a6a' },
      { kind: 'anal', t0: 0.64, t1: 0.71, h: 0.028, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 10, color: '#6a7a8a' },
      { kind: 'finlets', t0: 0.72, step: 0.022, count: 9, h: 0.012, color: '#2a4060' },
      { kind: 'keel', t: 0.9, len: 0.08, h: 0.009 },
      { kind: 'pectoral', t: 0.17, a: 0.2, len: 0.05, splay: 0.4, droop: 0.15, color: '#2a4060' },
      { kind: 'pelvic', t: 0.2, a: 0.04, len: 0.025, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'lunate', h: 0.1, rays: 20, color: '#1e3a6a' },
    ],
    colors: { back: '#18345e', flank: '#8aa4bc', belly: '#eef2f2', fin: '#24406a', split: 0.42 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      // The cobalt bars, wavy, some forked, from the back down past the middle.
      for (let k = 0; k < 26; k++) {
        const u = 0.16 + k * 0.03, w = Math.sin(k * 1.7) * 0.006;
        P.line([[u, 0.92], [u + w, 0.7], [u - w, 0.5], [u, 0.3]], 3.5, '#2448b0', 0.75);
      }
    },
  },

  // Dorado, Coryphaena hippurus: deep-headed and tapering; the bull's square forehead rising
  // straight up from the mouth; one dorsal fin from the forehead all the way to the tail, and a
  // long anal fin; a deeply forked tail. Electric green-blue above, gold and yellow below,
  // flecked with blue.
  dorado: {
    plan: 'fish', bodyLen: 0.82, round: 2.2, mode: 0,
    top: [[0, -0.012], [0.015, 0.03], [0.04, 0.072], [0.1, 0.088], [0.25, 0.084], [0.45, 0.068], [0.68, 0.044], [0.88, 0.022], [1, 0.014]],
    bottom: [[0, -0.022], [0.04, -0.044], [0.12, -0.058], [0.3, -0.06], [0.5, -0.05], [0.72, -0.032], [0.9, -0.018], [1, -0.012]],
    width: [[0, 0.006], [0.05, 0.022], [0.15, 0.032], [0.35, 0.032], [0.6, 0.024], [0.85, 0.014], [1, 0.009]],
    mouth: { len: 0.045, y: -0.018, slope: -0.03, gape: 0.009 }, gill: { t: 0.14, curve: 0.05 },
    eye: { t: 0.07, y: -0.004, r: 0.012, iris: '#c8b850' },
    fins: [
      { kind: 'dorsal', t0: 0.05, t1: 0.9, h: 0.045, profile: [[0, 0.5], [0.08, 1], [0.4, 0.85], [0.8, 0.7], [1, 0.35]], rays: 60, color: '#2a7ab0', edge: '#1a4a8a', edgeFrom: 0.5 },
      { kind: 'anal', t0: 0.48, t1: 0.9, h: 0.035, profile: [[0, 0.7], [0.15, 1], [0.8, 0.6], [1, 0.3]], rays: 28, color: '#d0c050' },
      { kind: 'pectoral', t: 0.17, a: 0.2, len: 0.07, splay: 0.4, droop: 0.2, color: '#c8b858' },
      { kind: 'pelvic', t: 0.18, a: 0.03, len: 0.06, splay: 0.3, droop: 0.6, color: '#d8c860' },
      { kind: 'caudal', shape: 'forked', h: 0.17, fork: 0.62, rays: 20, color: '#d8c040' },
    ],
    colors: { back: '#167a64', flank: '#c4c040', belly: '#f2e88a', fin: '#2a7ab0', split: 0.4 },
    scaleRows: null, metal: 0.4, sheen: 0.85,
    paint: (P) => {
      // Blue on the back running into the green, and the bright blue flecks all over.
      P.band(0.82, 1, '#1a5a9a', 0.55, 0.05, 1);
      P.noise(171, 160, '#2a7ae0', 0.85, 0.004, 0.018, 0.3, 0.95);
      P.noise(173, 60, '#e8f0a0', 0.4, 0.004, 0.015, 0.1, 0.5);
    },
  },

  // Yellowfin tuna, Thunnus albacares: a tuna's torpedo; the second dorsal and the anal fin drawn
  // out into long, curved yellow scythes; long pectorals; bright yellow finlets edged black; a
  // golden stripe along the flank, and pale vertical lines low on the sides.
  yellowfin: {
    plan: 'fish', bodyLen: 0.82, round: 2.0, mode: 4,
    top: [[0, 0.002], [0.05, 0.034], [0.14, 0.07], [0.3, 0.104], [0.45, 0.108], [0.66, 0.076], [0.86, 0.028], [1, 0.014]],
    bottom: [[0, -0.014], [0.05, -0.038], [0.14, -0.07], [0.3, -0.102], [0.48, -0.104], [0.68, -0.07], [0.86, -0.026], [1, -0.013]],
    width: [[0, 0.004], [0.08, 0.04], [0.25, 0.074], [0.45, 0.076], [0.7, 0.046], [0.9, 0.015], [1, 0.012]],
    mouth: { len: 0.1, y: -0.006, slope: -0.05, gape: 0.01 }, gill: { t: 0.23, curve: 0.035 },
    eye: { t: 0.085, y: 0.024, r: 0.015, iris: '#c8c0a0' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.44, h: 0.06, spines: 13, profile: [[0, 1], [0.25, 0.75], [0.7, 0.3], [1, 0.12]], color: '#3a4a3a' },
      { kind: 'dorsal', t0: 0.46, t1: 0.55, h: 0.17, profile: [[0, 0.5], [0.15, 1], [0.35, 0.6], [0.7, 0.2], [1, 0.08]], rays: 12, color: '#e8c838' },
      { kind: 'anal', t0: 0.49, t1: 0.58, h: 0.16, profile: [[0, 0.5], [0.15, 1], [0.35, 0.6], [0.7, 0.2], [1, 0.08]], rays: 12, color: '#e8c838' },
      { kind: 'finlets', t0: 0.6, step: 0.037, count: 9, h: 0.02, color: '#f0d030', edge: '#1a1a1a' },
      { kind: 'keel', t: 0.9, len: 0.09, h: 0.01 },
      { kind: 'pectoral', t: 0.24, a: 0.24, len: 0.16, w: 0.03, splay: 0.35, droop: 0.12, profile: [[0, 0.9], [0.4, 0.7], [1, 0.05]], color: '#2a3a50' },
      { kind: 'pelvic', t: 0.27, a: 0.05, len: 0.045, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'lunate', h: 0.2, rays: 22, color: '#3a4a40' },
    ],
    colors: { back: '#10244a', flank: '#5e7894', belly: '#eef0f0', fin: '#2a3a50', split: 0.44 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      P.line([[0.05, 0.62], [0.35, 0.6], [0.7, 0.57], [1, 0.52]], 7, '#e8c040', 0.7);
      for (let k = 0; k < 16; k++) P.line([[0.3 + k * 0.035, 0.38], [0.3 + k * 0.035, 0.12]], 2, '#d8e0e8', 0.4);
    },
  },

  // Albacore, Thunnus alalunga: a small, plump tuna; the pectoral fins extraordinarily long,
  // reaching back past the second dorsal; dark finlets; a thin white edge to the tail. Dark
  // metallic blue above, silvery-white below.
  albacore: {
    plan: 'fish', bodyLen: 0.81, round: 2.0, mode: 4,
    top: [[0, 0.002], [0.05, 0.036], [0.14, 0.076], [0.3, 0.114], [0.45, 0.118], [0.66, 0.084], [0.86, 0.03], [1, 0.015]],
    bottom: [[0, -0.014], [0.05, -0.04], [0.14, -0.076], [0.3, -0.112], [0.48, -0.114], [0.68, -0.076], [0.86, -0.028], [1, -0.014]],
    width: [[0, 0.004], [0.08, 0.044], [0.25, 0.082], [0.45, 0.084], [0.7, 0.05], [0.9, 0.016], [1, 0.013]],
    mouth: { len: 0.1, y: -0.006, slope: -0.05, gape: 0.01 }, gill: { t: 0.23, curve: 0.035 },
    eye: { t: 0.085, y: 0.026, r: 0.017, iris: '#b8b8a8' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.44, h: 0.06, spines: 13, profile: [[0, 1], [0.25, 0.75], [0.7, 0.3], [1, 0.12]], color: '#2a3450' },
      { kind: 'dorsal', t0: 0.46, t1: 0.54, h: 0.06, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 12, color: '#3a4a60' },
      { kind: 'anal', t0: 0.49, t1: 0.57, h: 0.055, profile: [[0, 0.9], [0.25, 1], [1, 0.25]], rays: 12, color: '#c8ccd0' },
      { kind: 'finlets', t0: 0.6, step: 0.037, count: 8, h: 0.018, color: '#2a3048' },
      { kind: 'keel', t: 0.9, len: 0.09, h: 0.01 },
      { kind: 'pectoral', t: 0.24, a: 0.22, len: 0.3, w: 0.045, splay: 0.38, droop: 0.22, profile: [[0, 0.9], [0.3, 0.75], [1, 0.08]], color: '#22304a' },
      { kind: 'pelvic', t: 0.27, a: 0.05, len: 0.045, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'lunate', h: 0.19, rays: 22, color: '#22304a', edge: '#f4f4f2', edgeFrom: 0.85 },
    ],
    colors: { back: '#16244e', flank: '#6a7e9a', belly: '#eef0f2', fin: '#22304a', split: 0.46 },
    scaleRows: null, metal: 0.55, sheen: 0.8,
    paint: (P) => {
      P.line([[0.2, 0.62], [0.6, 0.6], [1, 0.52]], 3, '#8aa0c0', 0.4);
    },
  },

  /* ================= the sharks ================= */

  // Blue shark, Prionace glauca: long and slender, with a long, narrow, pointed snout and big
  // eyes; very long, narrow, sickle-shaped pectoral fins; a small first dorsal set well back;
  // the long upper lobe of a shark's tail. Indigo above, bright blue on the flanks, white below.
  blueshark: {
    plan: 'fish', bodyLen: 0.74, round: 2.0, mode: 0,
    top: [[0, -0.004], [0.03, 0.008], [0.08, 0.02], [0.2, 0.04], [0.36, 0.05], [0.52, 0.044], [0.7, 0.028], [0.88, 0.016], [1, 0.012]],
    bottom: [[0, -0.008], [0.04, -0.018], [0.1, -0.026], [0.25, -0.04], [0.42, -0.044], [0.58, -0.036], [0.76, -0.02], [1, -0.008]],
    width: [[0, 0.003], [0.05, 0.02], [0.15, 0.034], [0.35, 0.042], [0.55, 0.036], [0.75, 0.02], [1, 0.009]],
    mouth: null, gill: null,
    eye: { t: 0.075, y: 0.006, r: 0.009, iris: '#141820' },
    fins: [
      { kind: 'dorsal', t0: 0.44, t1: 0.54, h: 0.06, profile: [[0, 0.25], [0.35, 1], [0.55, 0.7], [0.8, 0.3], [1, 0.05]], rays: 10, color: '#22449a' },
      { kind: 'dorsal', t0: 0.84, t1: 0.88, h: 0.018, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#22449a' },
      { kind: 'anal', t0: 0.84, t1: 0.88, h: 0.016, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#5a7ab8' },
      { kind: 'pectoral', t: 0.25, a: 0.12, len: 0.22, w: 0.05, splay: 1.0, droop: 0.45, profile: [[0, 1], [0.4, 0.7], [1, 0.05]], rays: 12, color: '#2a4ea0' },
      { kind: 'pelvic', t: 0.62, a: 0.06, len: 0.05, w: 0.025, splay: 0.6, droop: 0.4, color: '#4a6ab0' },
      { kind: 'caudal', shape: 'shark', h: 0.13, rays: 16, color: '#22449a' },
    ],
    colors: { back: '#1a3888', flank: '#3a6cc4', belly: '#f0f2f4', fin: '#24489a', split: 0.5 },
    scaleRows: null, metal: 0.12, sheen: 0.45, finOpacity: 0.97,
    paint: (P) => {
      gillSlits(P, 0.17, 0.22);
      // The mouth, underneath, behind the snout.
      P.line([[0.05, 0.12], [0.08, 0.06], [0.1, 0.12]], 3, '#1a1a1e', 0.6);
    },
  },

  // Shortfin mako, Isurus oxyrinchus: a sleek, heavy torpedo with a sharply pointed conical snout
  // and big black eyes; long, curved teeth that show at the mouth; short pectorals; a large first
  // dorsal; a near-symmetrical crescent tail with a strong keel on the stalk. Metallic indigo
  // above, white below.
  mako: {
    plan: 'fish', bodyLen: 0.78, round: 2.0, mode: 0,
    top: [[0, -0.004], [0.03, 0.01], [0.08, 0.028], [0.2, 0.054], [0.36, 0.066], [0.52, 0.058], [0.7, 0.036], [0.88, 0.018], [1, 0.012]],
    bottom: [[0, -0.008], [0.04, -0.02], [0.1, -0.034], [0.25, -0.054], [0.42, -0.058], [0.58, -0.046], [0.76, -0.024], [1, -0.01]],
    width: [[0, 0.003], [0.05, 0.022], [0.15, 0.042], [0.35, 0.056], [0.55, 0.048], [0.75, 0.026], [0.92, 0.012], [1, 0.011]],
    mouth: null, gill: null,
    eye: { t: 0.07, y: 0.006, r: 0.011, iris: '#0e1014' },
    fins: [
      { kind: 'dorsal', t0: 0.38, t1: 0.48, h: 0.075, profile: [[0, 0.3], [0.4, 1], [0.6, 0.7], [0.85, 0.3], [1, 0.05]], rays: 10, color: '#24366e' },
      { kind: 'dorsal', t0: 0.84, t1: 0.87, h: 0.016, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#24366e' },
      { kind: 'anal', t0: 0.85, t1: 0.88, h: 0.014, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#5a6aa0' },
      { kind: 'pectoral', t: 0.25, a: 0.12, len: 0.11, w: 0.045, splay: 0.9, droop: 0.4, profile: [[0, 1], [0.5, 0.7], [1, 0.1]], rays: 10, color: '#2a3c78' },
      { kind: 'pelvic', t: 0.62, a: 0.06, len: 0.04, w: 0.022, splay: 0.6, droop: 0.4, color: '#4a5a90' },
      { kind: 'keel', t: 0.88, len: 0.1, h: 0.012 },
      { kind: 'caudal', shape: 'lunate', h: 0.15, rays: 18, color: '#24366e' },
    ],
    colors: { back: '#1e2e68', flank: '#4a62a6', belly: '#f2f2f0', fin: '#24366e', split: 0.48 },
    scaleRows: null, metal: 0.18, sheen: 0.55, finOpacity: 0.97,
    paint: (P) => {
      gillSlits(P, 0.16, 0.22);
      // The mouth, its long teeth showing.
      P.line([[0.03, 0.18], [0.07, 0.1], [0.11, 0.16]], 3, '#1a1a1e', 0.65);
      for (let k = 0; k < 6; k++) P.line([[0.045 + k * 0.011, 0.15], [0.048 + k * 0.011, 0.1]], 1.5, '#f6f2e6', 0.8);
    },
  },

  // Smooth hammerhead, Sphyrna zygaena: the head flattened out sideways into a broad, smoothly
  // curved blade, with no notch in the middle of its front edge and an eye at each end; a tall
  // first dorsal fin; a shark's tail. Olive-grey above, white below.
  hammerhead: {
    plan: 'fish', bodyLen: 0.74, round: 2.0, mode: 0, capNose: true, view: { yaw: -Math.PI / 2 + 0.55, pitch: 0.65 },
    top: [[0, 0.004], [0.04, 0.008], [0.08, 0.012], [0.12, 0.024], [0.22, 0.042], [0.36, 0.054], [0.52, 0.048], [0.7, 0.03], [0.88, 0.016], [1, 0.012]],
    bottom: [[0, -0.004], [0.04, -0.008], [0.08, -0.014], [0.14, -0.026], [0.28, -0.042], [0.44, -0.046], [0.6, -0.036], [0.78, -0.02], [1, -0.008]],
    width: [[0, 0.075], [0.012, 0.105], [0.03, 0.115], [0.05, 0.1], [0.07, 0.04], [0.1, 0.03], [0.2, 0.038], [0.36, 0.046], [0.55, 0.04], [0.75, 0.022], [1, 0.009]],
    mouth: null, gill: null,
    eye: { t: 0.03, y: 0.002, r: 0.008, iris: '#c8b878', fwd: 0.4 },
    fins: [
      { kind: 'dorsal', t0: 0.38, t1: 0.48, h: 0.085, profile: [[0, 0.3], [0.35, 1], [0.55, 0.75], [0.85, 0.3], [1, 0.05]], rays: 10, color: '#525c5e' },
      { kind: 'dorsal', t0: 0.8, t1: 0.84, h: 0.02, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#525c5e' },
      { kind: 'anal', t0: 0.79, t1: 0.83, h: 0.02, profile: [[0, 0.4], [0.4, 1], [1, 0.2]], rays: 5, color: '#8a9294' },
      { kind: 'pectoral', t: 0.24, a: 0.12, len: 0.11, w: 0.045, splay: 0.9, droop: 0.4, profile: [[0, 1], [0.5, 0.7], [1, 0.1]], rays: 10, color: '#5a6466' },
      { kind: 'pelvic', t: 0.6, a: 0.06, len: 0.045, w: 0.024, splay: 0.6, droop: 0.4, color: '#7a8486' },
      { kind: 'caudal', shape: 'shark', h: 0.14, rays: 16, color: '#525c5e' },
    ],
    colors: { back: '#4e5856', flank: '#78827e', belly: '#f0f0ec', fin: '#5a6466', split: 0.52 },
    scaleRows: null, metal: 0.1, sheen: 0.4, finOpacity: 0.97,
    paint: (P) => {
      gillSlits(P, 0.17, 0.22);
      P.line([[0.08, 0.14], [0.1, 0.08], [0.12, 0.14]], 3, '#1a1a1e', 0.55);
    },
  },
};
