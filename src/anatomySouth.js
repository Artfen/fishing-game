// Anatomical recipes for the fish of Las Brasas (southFish.js), built by anatomy.js with the same
// conventions as anatomyAtlantic.js: nose at +z, back up, about one unit long; t runs along the
// body from the snout (0) to the tail stalk (1); paint draws on a skin laid out snout to tail (u)
// and belly to back (v). Each follows the features that tell the species apart: body depth and
// outline, head and mouth, the number and placement of fins, the tail, and the marks.
//
// The angelshark is a flattened shark built on the fish plan: a wide, low cross-section, its
// broad pectoral and pelvic fins spread out flat like wings (as the gurnard's are), the eyes on
// top, and two small dorsal fins far back on a slender tail.

export const SOUTH_ANATOMY = {
  /* ================= the shallow lava reef ================= */

  // Parrotfish, Sparisoma cretense: oval, with a blunt head; large scales; the teeth fused into a
  // beak; one continuous dorsal fin, the spiny part low and flexible; a truncate tail. Painted as
  // the female, the colourful one: red, with a dark grey patch from the eye back over the
  // shoulder and a yellow patch on the tail stalk.
  parrotfish: {
    plan: 'fish', bodyLen: 0.8, round: 2.2, mode: 0, lod: 0.85,
    top: [[0, -0.004], [0.04, 0.034], [0.1, 0.076], [0.22, 0.116], [0.4, 0.13], [0.6, 0.114], [0.8, 0.068], [1, 0.048]],
    bottom: [[0, -0.02], [0.05, -0.054], [0.14, -0.088], [0.3, -0.108], [0.5, -0.104], [0.7, -0.074], [0.88, -0.048], [1, -0.042]],
    width: [[0, 0.008], [0.08, 0.036], [0.25, 0.05], [0.45, 0.05], [0.7, 0.036], [0.9, 0.02], [1, 0.014]],
    mouth: { len: 0.05, y: -0.012, slope: -0.02, gape: 0.011, lips: 0.3 }, gill: { t: 0.22, curve: 0.035 },
    eye: { t: 0.1, y: 0.03, r: 0.015, iris: '#d8b050' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.28, t1: 0.55, h: 0.045, spines: 9, profile: [[0, 0.7], [0.3, 1], [1, 0.9]], color: '#b84a3c' },
      { kind: 'dorsal', t0: 0.55, t1: 0.82, h: 0.052, profile: [[0, 0.95], [0.4, 1], [1, 0.5]], rays: 10, color: '#b84a3c' },
      { kind: 'anal', t0: 0.62, t1: 0.84, h: 0.048, profile: [[0, 0.8], [0.4, 1], [1, 0.5]], rays: 9, color: '#c8584a' },
      { kind: 'pectoral', t: 0.25, a: 0.17, len: 0.1, splay: 0.5, droop: 0.15, profile: [[0, 0.4], [0.4, 1], [1, 0.5]], color: '#d06a50' },
      { kind: 'pelvic', t: 0.3, a: 0.04, len: 0.055, splay: 0.3, droop: 0.5, color: '#c8584a' },
      { kind: 'caudal', shape: 'truncate', h: 0.1, rays: 13, color: '#b84a3c' },
    ],
    colors: { back: '#7a2e2c', flank: '#c8423a', belly: '#e8866a', fin: '#c05040', split: 0.42 },
    scaleRows: [22, 8], metal: 0.12, sheen: 0.35,
    paint: (P) => {
      // The big scales, each with a darker edge.
      P.noise(141, 90, '#6a2420', 0.25, 0.018, 0.05, 0.3, 0.95);
      // The dark grey patch behind the head, and the yellow patch on the tail stalk.
      P.blob(0.2, 0.72, 0.095, 0.36, '#48464e', 0.8, 0.85);
      P.line([[0.29, 0.98], [0.305, 0.75], [0.28, 0.5]], 3, '#e0b840', 0.35);
      P.blob(0.92, 0.72, 0.06, 0.3, '#e8c43a', 0.85, 0.8);
      // The beak: the fused teeth, pale, at the front of the snout.
      P.band(0.38, 0.6, '#ece2d0', 0.75, 0, 0.03);
    },
  },

  // Ornate wrasse, Thalassoma pavo: a slim wrasse with a small mouth; one long dorsal fin, spiny
  // then soft; the male's tail with long points. Painted as a male: green, with turquoise and
  // orange-red bands over the head and a dark blue band behind the gill cover.
  ornatewrasse: {
    plan: 'fish', bodyLen: 0.82, round: 2.2, mode: 0, lod: 0.7,
    top: [[0, -0.002], [0.04, 0.028], [0.12, 0.062], [0.28, 0.086], [0.5, 0.084], [0.7, 0.062], [0.88, 0.038], [1, 0.032]],
    bottom: [[0, -0.012], [0.05, -0.036], [0.14, -0.06], [0.3, -0.076], [0.5, -0.072], [0.7, -0.05], [0.88, -0.032], [1, -0.028]],
    width: [[0, 0.005], [0.08, 0.026], [0.25, 0.036], [0.45, 0.034], [0.7, 0.025], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.05, y: -0.006, slope: -0.03, gape: 0.007, lips: 0.25 }, gill: { t: 0.23, curve: 0.03 },
    eye: { t: 0.085, y: 0.02, r: 0.013, iris: '#d86040' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.27, t1: 0.52, h: 0.034, spines: 8, profile: [[0, 0.8], [0.3, 1], [1, 0.95]], color: '#3a9a7a', edge: '#d84a4a' },
      { kind: 'dorsal', t0: 0.52, t1: 0.84, h: 0.04, profile: [[0, 0.95], [0.5, 1], [1, 0.6]], rays: 13, color: '#3a9a7a', edge: '#d84a4a' },
      { kind: 'anal', t0: 0.56, t1: 0.84, h: 0.036, profile: [[0, 0.8], [0.4, 1], [1, 0.6]], rays: 11, color: '#3a9a7a', edge: '#3a6ad0' },
      { kind: 'pectoral', t: 0.25, a: 0.16, len: 0.08, splay: 0.5, droop: 0.15, profile: [[0, 0.4], [0.4, 1], [1, 0.4]], color: '#5ab0a0', edge: '#2a4ab0' },
      { kind: 'pelvic', t: 0.3, a: 0.04, len: 0.045, splay: 0.3, droop: 0.5, color: '#6ab090' },
      { kind: 'caudal', shape: 'forked', h: 0.11, fork: 0.22, rays: 13, tips: true, color: '#3a9a7a', edge: '#d84a4a', edgeFrom: 0.6 },
    ],
    colors: { back: '#2a6a4a', flank: '#3e9a68', belly: '#a2d4a4', fin: '#4aa080', split: 0.45 },
    scaleRows: [40, 12], metal: 0.15, sheen: 0.45,
    paint: (P) => {
      // A short reddish bar on each scale row.
      for (let u = 0.3; u < 0.97; u += 0.035) P.line([[u, 0.85], [u + 0.004, 0.25]], 1.5, '#b85060', 0.3);
      // Turquoise and orange-red bands over the head.
      for (let k = 0; k < 5; k++) {
        const u = 0.03 + k * 0.042;
        P.line([[u, 0.98], [u + 0.012, 0.65], [u, 0.3]], 5, k % 2 ? '#e06040' : '#40c0e0', 0.85);
      }
      // The male's dark blue band behind the gill cover.
      P.line([[0.27, 0.95], [0.285, 0.6], [0.27, 0.2]], 12, '#1e48a8', 0.85);
    },
  },

  // Grey triggerfish, Balistes capriscus: deep, compressed and rhomboid; small mouth of strong
  // teeth at the end of a long snout; the eye high and far back; a first dorsal of three spines,
  // the first stout; the second dorsal and anal long, tall at the front; small pectorals; a tail
  // with drawn-out tips; skin of plate-like scales; grey with faint broad bars.
  triggerfish: {
    plan: 'fish', bodyLen: 0.78, round: 2.0, mode: 0,
    top: [[0, 0.004], [0.06, 0.04], [0.16, 0.088], [0.26, 0.126], [0.4, 0.146], [0.55, 0.138], [0.72, 0.1], [0.88, 0.05], [1, 0.035]],
    bottom: [[0, -0.008], [0.06, -0.04], [0.18, -0.088], [0.32, -0.122], [0.48, -0.128], [0.62, -0.11], [0.78, -0.07], [0.9, -0.04], [1, -0.032]],
    width: [[0, 0.006], [0.1, 0.026], [0.3, 0.04], [0.5, 0.04], [0.75, 0.026], [0.9, 0.014], [1, 0.01]],
    mouth: { len: 0.035, y: -0.002, slope: 0, gape: 0.006, lips: 0.3 }, gill: { t: 0.3, curve: 0.012 },
    eye: { t: 0.22, y: 0.064, r: 0.017, iris: '#c8b070' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.4, h: 0.075, spines: 3, profile: [[0, 1], [0.5, 0.55], [1, 0.35]] },
      { kind: 'dorsal', t0: 0.52, t1: 0.84, h: 0.09, profile: [[0, 0.6], [0.12, 1], [0.4, 0.55], [1, 0.3]], rays: 27 },
      { kind: 'anal', t0: 0.55, t1: 0.85, h: 0.085, profile: [[0, 0.6], [0.12, 1], [0.4, 0.55], [1, 0.3]], rays: 24 },
      { kind: 'pectoral', t: 0.31, a: 0.3, len: 0.055, splay: 0.5, droop: 0.1, profile: [[0, 0.5], [0.4, 1], [1, 0.4]] },
      { kind: 'caudal', shape: 'forked', h: 0.13, fork: 0.18, rays: 12, tips: true },
    ],
    colors: { back: '#4e545a', flank: '#8e9294', belly: '#cfcdc4', fin: '#6c7276', split: 0.4 },
    scaleRows: [28, 12], metal: 0.08, sheen: 0.3,
    paint: (P) => {
      // Faint broad bars across the back, and small blue spots on the upper body.
      for (const u of [0.36, 0.53, 0.7]) P.blob(u, 0.78, 0.05, 0.3, '#3a4048', 0.35, 0.6);
      P.noise(151, 70, '#6a9ac8', 0.45, 0.004, 0.012, 0.5, 0.95);
      P.noise(153, 50, '#3e444a', 0.2, 0.02, 0.05, 0.2, 0.9);
    },
  },

  // Mediterranean moray, Muraena helena: a long, compressed, scaleless eel with no pectoral or
  // pelvic fins; the dorsal fin starts just behind the head, and runs into the tail and anal;
  // long jaws, a small round gill opening; dark brown marbled with yellow and cream spots.
  moray: {
    plan: 'fish', bodyLen: 0.97, round: 2.0, mode: 2, long: 1.4,
    top: [[0, 0.002], [0.03, 0.02], [0.08, 0.034], [0.18, 0.042], [0.4, 0.044], [0.65, 0.036], [0.85, 0.02], [1, 0.004]],
    bottom: [[0, -0.01], [0.03, -0.022], [0.08, -0.032], [0.18, -0.04], [0.4, -0.042], [0.65, -0.034], [0.85, -0.018], [1, -0.004]],
    width: [[0, 0.004], [0.06, 0.02], [0.18, 0.026], [0.4, 0.024], [0.65, 0.017], [0.85, 0.009], [1, 0.0015]],
    mouth: { len: 0.07, y: -0.006, slope: -0.04, gape: 0.01 }, gill: null,
    eye: { t: 0.035, y: 0.014, r: 0.007, iris: '#d8c060' },
    fins: [
      { kind: 'dorsal', t0: 0.1, t1: 1, h: 0.02, profile: [[0, 0.4], [0.08, 1], [0.85, 1], [1, 0.6]], rays: 100 },
      { kind: 'anal', t0: 0.48, t1: 1, h: 0.016, profile: [[0, 0.4], [0.1, 1], [0.85, 1], [1, 0.6]], rays: 70 },
      { kind: 'caudal', shape: 'eel', h: 0.016, rays: 12 },
    ],
    colors: { back: '#2e2018', flank: '#4a3626', belly: '#6a5440', fin: '#2e2018', split: 0.5 },
    scaleRows: null, metal: 0.05, sheen: 0.55, finOpacity: 0.97,
    paint: (P) => {
      // Marbled: dark brown, with yellow spots large and small and paler cream ones.
      P.noise(161, 120, '#1a120c', 0.5, 0.02, 0.07, 0, 1);
      P.noise(163, 260, '#e8c860', 0.85, 0.004, 0.018, 0.05, 1);
      P.noise(165, 140, '#f2e8c8', 0.6, 0.003, 0.01, 0.05, 1);
      // The small round gill opening.
      P.blob(0.11, 0.42, 0.004, 0.04, '#0e0a06', 0.9, 0.3);
    },
  },

  /* ================= the drop-off ================= */

  // Dusky grouper, Epinephelus marginatus: massive and oval, the head large; a big mouth, the lower
  // jaw jutting; one dorsal fin, eleven spines then soft rays; rounded pectorals; a rounded tail
  // edged with white; dark brown with irregular pale blotches, pale marks round the eye.
  grouper: {
    plan: 'fish', bodyLen: 0.8, round: 2.25, mode: 0,
    top: [[0, 0.004], [0.04, 0.04], [0.12, 0.084], [0.25, 0.122], [0.42, 0.132], [0.62, 0.116], [0.82, 0.07], [1, 0.052]],
    bottom: [[0, -0.026], [0.04, -0.056], [0.14, -0.094], [0.3, -0.114], [0.5, -0.11], [0.7, -0.08], [0.86, -0.052], [1, -0.045]],
    width: [[0, 0.008], [0.08, 0.044], [0.25, 0.066], [0.45, 0.064], [0.7, 0.044], [0.9, 0.024], [1, 0.018]],
    mouth: { len: 0.14, y: -0.012, slope: -0.08, gape: 0.016, lips: 0.2 }, gill: { t: 0.3, curve: 0.05 },
    eye: { t: 0.1, y: 0.04, r: 0.017, iris: '#c8a060', up: 0.15 },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.6, h: 0.06, spines: 11, profile: [[0, 0.7], [0.25, 1], [1, 0.75]] },
      { kind: 'dorsal', t0: 0.6, t1: 0.84, h: 0.075, profile: [[0, 0.9], [0.4, 1], [1, 0.5]], rays: 16, edge: '#d8d4c4', edgeFrom: 0.8 },
      { kind: 'anal', t0: 0.64, t1: 0.82, h: 0.07, profile: [[0, 0.8], [0.4, 1], [1, 0.5]], rays: 8, edge: '#d8d4c4', edgeFrom: 0.8 },
      { kind: 'pectoral', t: 0.3, a: 0.15, len: 0.12, splay: 0.45, droop: 0.2, profile: [[0, 0.35], [0.3, 0.95], [0.7, 1], [1, 0.6]] },
      { kind: 'pelvic', t: 0.32, a: 0.04, len: 0.08, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'rounded', h: 0.1, rays: 17, edge: '#ece8dc', edgeFrom: 0.82 },
    ],
    colors: { back: '#3e3024', flank: '#5e4834', belly: '#a08a6c', fin: '#3a2e24', split: 0.42 },
    scaleRows: [70, 22], metal: 0.06, sheen: 0.3,
    paint: (P) => {
      // Irregular pale blotches, and dark freckling between them.
      P.noise(171, 46, '#cdb88e', 0.55, 0.02, 0.06, 0.2, 0.95);
      P.noise(173, 80, '#2a2018', 0.3, 0.008, 0.02, 0.2, 0.95);
      // Pale marks radiating back from the eye.
      for (const dv of [-0.08, 0, 0.08]) P.line([[0.115, 0.78 + dv * 0.5], [0.2, 0.78 + dv * 1.6]], 3, '#cdb88e', 0.6);
    },
  },

  // Yellowmouth barracuda, Sphyraena viridensis: long and almost round in section, with a pointed
  // head and a long jaw, the lower jutting; two dorsal fins far apart, the first above the pelvic
  // fins; low pectorals; a forked tail; silver, with dark bars slanting down the upper flanks.
  barracuda: {
    plan: 'fish', bodyLen: 0.88, round: 2.1, mode: 0, long: 1.2,
    top: [[0, 0.0], [0.05, 0.012], [0.12, 0.028], [0.2, 0.04], [0.4, 0.05], [0.6, 0.046], [0.8, 0.032], [0.94, 0.02], [1, 0.018]],
    bottom: [[0, -0.006], [0.05, -0.016], [0.12, -0.03], [0.22, -0.04], [0.4, -0.048], [0.6, -0.044], [0.8, -0.03], [0.94, -0.019], [1, -0.017]],
    width: [[0, 0.003], [0.06, 0.014], [0.18, 0.03], [0.4, 0.036], [0.65, 0.03], [0.85, 0.016], [1, 0.01]],
    mouth: { len: 0.17, y: -0.004, slope: -0.03, gape: 0.01 }, gill: { t: 0.2, curve: 0.025 },
    eye: { t: 0.11, y: 0.016, r: 0.014, iris: '#d8d0a0' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.36, t1: 0.44, h: 0.05, spines: 5, profile: [[0, 1], [0.5, 0.8], [1, 0.4]] },
      { kind: 'dorsal', t0: 0.66, t1: 0.74, h: 0.045, profile: [[0, 0.9], [0.3, 1], [1, 0.4]], rays: 10 },
      { kind: 'anal', t0: 0.68, t1: 0.76, h: 0.04, profile: [[0, 0.9], [0.3, 1], [1, 0.4]], rays: 9 },
      { kind: 'pectoral', t: 0.23, a: 0.12, len: 0.07, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.38, a: 0.03, len: 0.05, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'forked', h: 0.12, fork: 0.45, rays: 17 },
    ],
    colors: { back: '#34444e', flank: '#b8c4ca', belly: '#eef2f2', fin: '#6a7a84', split: 0.5 },
    scaleRows: [90, 18], metal: 0.45, sheen: 0.65,
    paint: (P) => {
      // The dark bars, slanting down and back along the upper flanks, past the lateral line.
      for (let k = 0; k < 19; k++) {
        const u = 0.21 + k * 0.04;
        P.line([[u, 0.98], [u + 0.016, 0.7], [u + 0.004, 0.4]], 5, '#2a343c', 0.5);
      }
      P.line([[0.2, 0.66], [0.6, 0.62], [1, 0.56]], 1.5, '#5a6a74', 0.6);
      P.band(0.3, 0.55, '#d8c88a', 0.35, 0, 0.12); // a yellowish tinge about the jaws
    },
  },

  // Greater amberjack, Seriola dumerili: a big jack, elongate and a little compressed; a small,
  // low first dorsal, a long second dorsal and a shorter anal; a deeply forked tail; olive-brown
  // to blue-grey above, silver below, a faint amber stripe along the flank and a dark band from the
  // snout up through the eye to the first dorsal fin.
  amberjack: {
    plan: 'fish', bodyLen: 0.82, round: 2.2, mode: 0,
    top: [[0, 0.0], [0.05, 0.028], [0.14, 0.06], [0.28, 0.088], [0.45, 0.092], [0.62, 0.078], [0.8, 0.044], [0.94, 0.022], [1, 0.02]],
    bottom: [[0, -0.012], [0.05, -0.032], [0.15, -0.062], [0.3, -0.082], [0.48, -0.082], [0.65, -0.066], [0.82, -0.036], [0.94, -0.02], [1, -0.019]],
    width: [[0, 0.004], [0.08, 0.03], [0.25, 0.046], [0.45, 0.046], [0.7, 0.032], [0.9, 0.016], [1, 0.011]],
    mouth: { len: 0.1, y: -0.006, slope: -0.07, gape: 0.012 }, gill: { t: 0.22, curve: 0.035 },
    eye: { t: 0.09, y: 0.024, r: 0.016, iris: '#c8b888' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.38, h: 0.032, spines: 7, profile: [[0, 0.6], [0.4, 1], [1, 0.5]] },
      { kind: 'dorsal', t0: 0.4, t1: 0.8, h: 0.06, profile: [[0, 0.7], [0.08, 1], [0.35, 0.45], [1, 0.3]], rays: 33 },
      { kind: 'anal', t0: 0.56, t1: 0.8, h: 0.05, profile: [[0, 0.7], [0.08, 1], [0.35, 0.45], [1, 0.3]], rays: 19 },
      { kind: 'pectoral', t: 0.24, a: 0.15, len: 0.08, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.28, a: 0.03, len: 0.07, splay: 0.3, droop: 0.55 },
      { kind: 'keel', t: 0.9, len: 0.08, h: 0.005 },
      { kind: 'caudal', shape: 'forked', h: 0.15, fork: 0.6, rays: 17 },
    ],
    colors: { back: '#4e4a36', flank: '#b4b4a8', belly: '#eeece4', fin: '#6a6650', split: 0.45 },
    scaleRows: [80, 20], metal: 0.4, sheen: 0.6,
    paint: (P) => {
      P.band(0.7, 1, '#5a5636', 0.3); // an olive sheen on the back
      P.line([[0.08, 0.6], [0.4, 0.62], [0.8, 0.56], [1, 0.52]], 7, '#d0a848', 0.45); // the amber stripe
      P.line([[0.0, 0.58], [0.09, 0.76], [0.2, 0.92], [0.29, 1]], 14, '#26261c', 0.75); // the dark band through the eye
    },
  },

  // Atlantic chub mackerel, Scomber colias: the mackerel's build, with a bigger eye, fewer spines
  // in the first dorsal, five finlets above and below, a deeply forked tail; a broken pattern of
  // wavy oblique lines on the back, and dark spots and wavy lines on the lower flanks.
  chubmackerel: {
    plan: 'fish', bodyLen: 0.82, round: 2.05, mode: 0, lod: 0.65,
    top: [[0, 0.002], [0.06, 0.03], [0.2, 0.06], [0.38, 0.068], [0.6, 0.05], [0.8, 0.026], [0.94, 0.016], [1, 0.016]],
    bottom: [[0, -0.004], [0.07, -0.03], [0.22, -0.056], [0.42, -0.062], [0.62, -0.046], [0.8, -0.024], [0.94, -0.015], [1, -0.015]],
    width: [[0, 0.003], [0.08, 0.03], [0.3, 0.054], [0.55, 0.048], [0.8, 0.024], [1, 0.012]],
    mouth: { len: 0.11, y: -0.004, slope: -0.04, gape: 0.008 }, gill: { t: 0.2, curve: 0.03 },
    eye: { t: 0.075, y: 0.016, r: 0.02, iris: '#d7d1c0' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.3, t1: 0.4, h: 0.05, spines: 9, profile: [[0, 0.85], [0.3, 1], [1, 0.25]] },
      { kind: 'dorsal', t0: 0.56, t1: 0.63, h: 0.035, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 11 },
      { kind: 'anal', t0: 0.58, t1: 0.65, h: 0.03, profile: [[0, 0.8], [0.3, 1], [1, 0.4]], rays: 11 },
      { kind: 'finlets', t0: 0.67, step: 0.05, count: 5, h: 0.018 },
      { kind: 'keel', t: 0.93, len: 0.06, h: 0.006 },
      { kind: 'pectoral', t: 0.22, a: 0.2, len: 0.07, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.26, a: 0.05, len: 0.05, splay: 0.3, droop: 0.6 },
      { kind: 'caudal', shape: 'forked', h: 0.12, fork: 0.55, rays: 20 },
    ],
    colors: { back: '#2a5a66', flank: '#c4d0d0', belly: '#f4f6f2', fin: '#6a7a74', split: 0.48 },
    scaleRows: null, metal: 0.38, sheen: 0.7,
    paint: (P) => {
      P.band(0.62, 1, '#2a6070', 0.45);
      // Broken wavy oblique lines on the back, fainter and less regular than the mackerel's.
      const x = P.x;
      x.save();
      x.strokeStyle = '#14262c';
      x.lineWidth = 3;
      x.globalAlpha = 0.7;
      for (let k = 0; k < 34; k++) {
        const u0 = 0.17 + k * 0.025;
        x.beginPath();
        for (let s = 0; s <= 6; s++) {
          const v = 1 - s * 0.055 - (k % 3) * 0.02;
          const u = u0 + Math.sin(s * 1.7 + k * 2.1) * 0.012 + s * 0.008;
          s ? x.lineTo(u * P.W, (1 - v) * P.H) : x.moveTo(u * P.W, (1 - v) * P.H);
        }
        x.stroke();
      }
      x.restore();
      // Dark spots and short wavy marks on the silver lower flanks.
      P.noise(181, 70, '#3a5058', 0.6, 0.005, 0.02, 0.2, 0.45);
      P.line([[0.2, 0.62], [0.6, 0.58], [1, 0.52]], 1.5, '#3a5a58', 0.6);
    },
  },

  /* ================= to watch ================= */

  // Angelshark, Squatina squatina: a shark flattened like a ray; a broad, blunt head with the mouth
  // at the front and the eyes on top; broad pectoral fins spread like wings, and pelvic fins
  // behind them; two small dorsal fins far back on a slender tail; no anal fin; sandy grey-brown,
  // finely spotted pale and dark above, white below.
  angelshark: {
    plan: 'fish', bodyLen: 0.9, round: 2.0, mode: 0, view: { yaw: -Math.PI / 2 + 0.35, pitch: 0.8 },
    top: [[0, 0.004], [0.03, 0.014], [0.1, 0.024], [0.25, 0.03], [0.42, 0.028], [0.55, 0.022], [0.7, 0.016], [0.85, 0.012], [1, 0.008]],
    bottom: [[0, -0.004], [0.03, -0.01], [0.1, -0.014], [0.25, -0.018], [0.42, -0.017], [0.55, -0.014], [0.7, -0.012], [0.85, -0.01], [1, -0.007]],
    width: [[0, 0.012], [0.015, 0.045], [0.04, 0.066], [0.1, 0.082], [0.2, 0.086], [0.35, 0.074], [0.5, 0.05], [0.6, 0.03], [0.7, 0.02], [0.85, 0.014], [1, 0.008]],
    mouth: { len: 0.03, y: -0.002, slope: 0, gape: 0.006 }, gill: null,
    eye: { t: 0.07, y: 0.019, r: 0.008, iris: '#c8c0a0', up: 2.5, fwd: 0.2 },
    fins: [
      { kind: 'pectoral', t: 0.19, a: 0.25, len: 0.15, w: 0.24, splay: 1.45, droop: 0.02, spread: true, rays: 14, profile: [[0, 1], [0.5, 0.75], [0.85, 0.4], [1, 0.12]] },
      { kind: 'pelvic', t: 0.45, a: 0.25, len: 0.085, w: 0.11, splay: 1.3, droop: 0.02, spread: true, rays: 10, profile: [[0, 1], [0.6, 0.6], [1, 0.15]] },
      { kind: 'dorsal', t0: 0.62, t1: 0.69, h: 0.03, profile: [[0, 0.5], [0.4, 1], [1, 0.3]], rays: 8 },
      { kind: 'dorsal', t0: 0.76, t1: 0.82, h: 0.026, profile: [[0, 0.5], [0.4, 1], [1, 0.3]], rays: 8 },
      { kind: 'caudal', shape: 'forked', h: 0.05, fork: 0.15, rays: 14 },
    ],
    colors: { back: '#8a7a62', flank: '#9a8a70', belly: '#ece4d4', fin: '#a8987c', split: 0.5 },
    scaleRows: null, metal: 0.04, sheen: 0.2, finOpacity: 0.97,
    paint: (P) => {
      // Fine pale and dark spots over the back, and the gill slits low on each side.
      P.noise(191, 160, '#e8dcc0', 0.5, 0.004, 0.012, 0.5, 1);
      P.noise(193, 120, '#4a3e30', 0.5, 0.004, 0.01, 0.5, 1);
      for (let k = 0; k < 5; k++) P.line([[0.16 + k * 0.014, 0.56], [0.165 + k * 0.014, 0.42]], 2, '#4a3e30', 0.5);
    },
  },

  // Atlantic trumpetfish, Aulostomus strigosus: long, compressed and stiff; a long tube of a snout
  // with a small mouth at the end; a row of separate small spines along the back; the soft dorsal
  // and anal fins far back, opposite each other; pelvic fins far back; a small rounded tail.
  trumpetfish: {
    plan: 'fish', bodyLen: 0.96, round: 2.1, mode: 0, long: 1.3,
    top: [[0, 0.006], [0.05, 0.008], [0.15, 0.01], [0.22, 0.014], [0.28, 0.022], [0.4, 0.03], [0.6, 0.032], [0.78, 0.026], [0.9, 0.014], [1, 0.008]],
    bottom: [[0, -0.004], [0.05, -0.008], [0.15, -0.01], [0.22, -0.013], [0.28, -0.02], [0.4, -0.028], [0.6, -0.03], [0.78, -0.024], [0.9, -0.012], [1, -0.007]],
    width: [[0, 0.004], [0.05, 0.006], [0.2, 0.008], [0.28, 0.012], [0.45, 0.016], [0.7, 0.014], [0.9, 0.008], [1, 0.005]],
    mouth: { len: 0.015, y: 0.0, slope: -0.1, gape: 0.004 }, gill: { t: 0.3, curve: 0.015 },
    eye: { t: 0.26, y: 0.008, r: 0.008, iris: '#d0b070' },
    fins: [
      { kind: 'dorsal', shape: 'spiny', t0: 0.38, t1: 0.62, h: 0.014, spines: 11, profile: [[0, 1], [1, 0.8]] },
      { kind: 'dorsal', t0: 0.72, t1: 0.84, h: 0.026, profile: [[0, 0.6], [0.3, 1], [1, 0.4]], rays: 25 },
      { kind: 'anal', t0: 0.72, t1: 0.84, h: 0.024, profile: [[0, 0.6], [0.3, 1], [1, 0.4]], rays: 26 },
      { kind: 'pectoral', t: 0.32, a: 0.2, len: 0.028, splay: 0.4, droop: 0.15 },
      { kind: 'pelvic', t: 0.58, a: 0.03, len: 0.025, splay: 0.3, droop: 0.5 },
      { kind: 'caudal', shape: 'rounded', h: 0.03, rays: 13 },
    ],
    colors: { back: '#6a3e2a', flank: '#a0684a', belly: '#d8b090', fin: '#8a5a40', split: 0.5 },
    scaleRows: null, metal: 0.08, sheen: 0.3,
    paint: (P) => {
      // Pale lines along the body, and scattered dark spots.
      for (const v of [0.35, 0.55, 0.75]) P.line([[0.28, v], [0.6, v + 0.02], [1, v - 0.02]], 2, '#e8d0a0', 0.5);
      P.noise(201, 40, '#2a1a12', 0.5, 0.004, 0.02, 0.2, 0.9);
    },
  },
};
