// Each fish's own looks (docs/FISH.md, "Looks"): no two of a kind quite alike, and now and then
// one you'd remember. From who the fish is (its id, and its generation when it's a newcomer: see
// behaviour.js traits), so the same fish looks the same swimming, on the line, in your hands, in a
// photograph, on a friend's screen and on every visit; nothing about it is drawn from the dice.
//
// Four numbers, drawn by the fish's shader (one instanced attribute: no new models, no more draws):
//   shade  −1 … 1   darker or paler than its kind's usual, most on its back (how far: its kind's)
//   seed   0 … 1    where its own spots fall, for a kind that has spots (trout, pike, cod …)
//   morph  0 … 5    none, or a rare colour morph (MORPHS)
//   marks  0 … 1    a scar or two (0: none), more often on a big fish of a kind that gets them
//
// A morph is how it looks and nothing else: no faster, stronger, bigger, nor worth more.

// (A small, steady hash, as behaviour.js's: the same fish, the same numbers. Its own copy, so this
// module stands apart from the fish and their behaviour.)
import { $t } from './i18n.js';
function hashRnd(seed) {
  let s = (seed * 2654435761) >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >>> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// The morphs, by their number in the shader.
export const MORPHS = ['', 'leucistic', 'melanistic', 'xanthic', 'albino', 'piebald'];
// In plain words, for the catch card and the journal.
export const MORPH_WORDS = {
  leucistic: { name: $t('pale (leucistic)'), card: (n) => $t`Washed pale all over, its eyes still dark: a leucistic ${n}. Few anglers ever see one.` },
  melanistic: { name: $t('dark (melanistic)'), card: (n) => $t`Nearly black from nose to tail: a melanistic ${n}. A rare thing.` },
  xanthic: { name: $t('golden (xanthic)'), card: (n) => $t`Golden from nose to tail: a xanthic ${n}. You may never see another.` },
  albino: { name: 'albino', card: (n) => $t`White, with pink eyes: an albino ${n}. One in many thousands.` },
  piebald: { name: 'piebald', card: (n) => $t`Patched with white where its colour never came: a piebald ${n}.` },
};

// How often each morph turns up, a fish in so many (a game's rates, not nature's, which are far
// rarer: rare enough to remember, common enough that a keen angler or diver meets one). Bony fish
// by default; the tunas, billfish and their kin none (their colour is their colour); the sharks
// only the pale one; the cephalopods none (they change colour as they please).
const BONY = { leucistic: 1 / 650, melanistic: 1 / 650, xanthic: 1 / 1000, albino: 1 / 5000 };
const NONE = {};
const KIND_MORPHS = {
  // Documented: golden trout and pike, xanthic carp; ambicoloured and piebald flatfish.
  trout: { ...BONY, xanthic: 1 / 400 },
  pike: { ...BONY, xanthic: 1 / 500 },
  carp: { ...BONY, xanthic: 1 / 400 },
  tench: { ...BONY, xanthic: 1 / 500 },
  plaice: { ...BONY, piebald: 1 / 600 },
  flounder: { ...BONY, piebald: 1 / 600 },
  turbot: { ...BONY, piebald: 1 / 600 },
  dab: { ...BONY, piebald: 1 / 600 },
  sole: { ...BONY, piebald: 1 / 600 },
  blueshark: { leucistic: 1 / 2000 }, mako: { leucistic: 1 / 2000 }, hammerhead: { leucistic: 1 / 2000 },
  catshark: { leucistic: 1 / 1500, albino: 1 / 8000 }, angelshark: { leucistic: 1 / 2000 },
};
const SCOMBRID = ['tuna', 'yellowfin', 'albacore', 'bonito', 'littletunny', 'bullet', 'mackerel', 'chubmackerel', 'wahoo', 'bluemarlin', 'sailfish', 'spearfish', 'dorado'];
for (const id of SCOMBRID) KIND_MORPHS[id] = NONE;
export function morphsFor(sp) {
  if (sp.creature) return NONE;
  return KIND_MORPHS[sp.id] ?? BONY;
}

// Each kind's range of looks: how far its shade goes either way (shade), its spots if it has
// them (spots: { a: their colour, b: a second colour some of them are, its share, density (spots a
// unit of its length), size (of a cell), from: how high on its flank they start (its model's
// units), z: [tail-most, head-most], top: on its upper side (a flatfish) }), and how often a big
// one carries scars (scars).
export const LOOKS = {
  seabass: { shade: 0.3 },
  trout: { shade: 0.35, spots: { a: '#2a1a12', b: '#c8401e', share: 0.5, density: 11, size: 0.38, from: -0.07, z: [-0.48, 0.3] } },
  pike: { shade: 0.24, spots: { a: '#c4bd86', density: 10, size: 0.34, from: -0.08, z: [-0.48, 0.28] } },
  perch: { shade: 0.22 },
  cod: { shade: 0.2, spots: { a: '#5c4a2c', density: 18, size: 0.26, from: -0.06, z: [-0.34, 0.32] } },
  grouper: { shade: 0.2, spots: { a: '#e3dcc4', density: 7, size: 0.42, from: -0.1, z: [-0.32, 0.3] } },
  // (Its skin has its kind's spots painted on: these few more are its own.)
  plaice: { shade: 0.18, spots: { a: '#d5651e', density: 5, size: 0.3, from: -1, z: [-0.36, 0.38], top: true } },
  thornback: { shade: 0.18, spots: { a: '#e9dfc3', density: 12, size: 0.24, from: -1, z: [-0.3, 0.4], top: true } },
  catshark: { shade: 0.16, spots: { a: '#2e2620', density: 24, size: 0.22, from: -0.1, z: [-0.42, 0.36] } },
  wrasse: { shade: 0.4 },
  carp: { shade: 0.26 },
  tuna: { shade: 0.12, scars: 0.35 }, yellowfin: { shade: 0.12, scars: 0.3 }, albacore: { shade: 0.1, scars: 0.2 },
  bluemarlin: { shade: 0.1, scars: 0.4 }, sailfish: { shade: 0.1, scars: 0.3 }, swordfish: { shade: 0.1, scars: 0.4 },
  blueshark: { shade: 0.14, scars: 0.4 }, mako: { shade: 0.12, scars: 0.4 }, hammerhead: { shade: 0.12, scars: 0.35 },
  conger: { shade: 0.22, scars: 0.25 },
};
const DEFAULT_LOOK = { shade: 0.2 };
export const lookRulesFor = (sp) => LOOKS[sp.id] || DEFAULT_LOOK;

// A fish's look. sp, its size (cm: a big one is likelier scarred), key: its id (with its
// generation folded in, as its build is: see traits).
export function lookOf(sp, size, key) {
  const r = hashRnd(key * 53 + 11), R = lookRulesFor(sp);
  // (A sum of two for a hump in the middle: most fish are about their kind's usual shade.)
  const shade = Math.max(-1, Math.min(1, r() + r() - 1)), seed = r();
  let morph = 0;
  const roll = r(), M = morphsFor(sp);
  let acc = 0;
  for (const [name, p] of Object.entries(M)) {
    acc += p;
    if (roll < acc) { morph = MORPHS.indexOf(name); break; }
  }
  // Scars: more likely the bigger it is within its kind.
  const big = Math.max(0, Math.min(1, (size - sp.size[0]) / Math.max(1, sp.size[1] - sp.size[0])));
  const marks = r() < (R.scars ?? 0.04) * (0.3 + 0.9 * big) ? 0.05 + r() * 0.95 : 0;
  return [shade, seed, morph, marks];
}
export const morphOf = (look) => MORPHS[Math.round(look?.[2] || 0)] || '';

/* ---------------- the shader ---------------- */

// Declarations for the vertex shader: the fish's look from its instance (or, for a single fish
// drawn on its own, a uniform), and where on its body a fragment is (its own model's space).
export const lookVertexHead = (instanced) => `${instanced ? 'attribute vec4 aLook;' : 'uniform vec4 uLook;'}
  varying vec4 vLook;
  varying vec3 vObj;`;
export const lookVertexBody = (instanced) => $t`vLook = ${instanced ? 'aLook' : 'uLook'};
  vObj = position;`;
// The fragment shader's declarations: its kind's rules (see LOOKS, setLookRules) and which part of
// it this is (0 its body, 1 its fins, 2 its eyes).
export const lookFragmentHead = `varying vec4 vLook;
  varying vec3 vObj;
  uniform float uLookShade;
  uniform float uLookPart;
  uniform vec4 uSpot;      // density, size, from (flank height), share of the second colour
  uniform vec4 uSpotZ;     // tail-most, head-most, top (1: on its upper side), scars (0 … 1)
  uniform vec3 uSpotA;
  uniform vec3 uSpotB;
  float lHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float lNoise(vec2 p) {
    vec2 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(lHash(i), lHash(i + vec2(1.0, 0.0)), f.x), mix(lHash(i + vec2(0.0, 1.0)), lHash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  // Spots: at most one a cell, where the seed puts them; each of colour a, or b for some of them.
  vec2 lSpots(vec2 p, float seed, float density, float size, float share) {
    vec2 q = p * density + vec2(seed * 31.7, seed * 17.3);
    vec2 i = floor(q), f = fract(q);
    float m = 0.0, b = 0.0;
    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 c = i + vec2(float(x), float(y));
        float h = lHash(c + seed * 13.1);
        if (h > 0.6) continue;
        vec2 o = vec2(lHash(c + 3.7), lHash(c + 9.1)) * 0.8 + 0.1;
        float s = 1.0 - smoothstep(size * 0.55, size, length(vec2(float(x), float(y)) + o - f));
        if (s > m) { m = s; b = step(1.0 - share, lHash(c + 21.3)); }
      }
    }
    return vec2(m, b);
  }`;
// Applied after its colour is read (map and vertex colours): its shade, its spots, its scars, its
// morph. Its eyes take only an albino's pink.
export const lookFragmentBody = `{
    vec3 lc = diffuseColor.rgb;
    float lum = dot(lc, vec3(0.299, 0.587, 0.114));
    float morph = floor(vLook.z + 0.5);
    if (uLookPart > 1.5) {
      if (morph > 3.5 && morph < 4.5) lc = mix(lc, vec3(0.86, 0.22, 0.28) * (0.5 + lum), 0.85);
    } else {
      float back = smoothstep(-0.02, 0.12, vObj.y);
      lc *= 1.0 + vLook.x * uLookShade * (0.55 + 0.45 * back);
      if (uLookPart < 0.5 && uSpot.x > 0.0) {
        vec2 p = uSpotZ.z > 0.5 ? vec2(vObj.z, vObj.x) : vec2(vObj.z, vObj.y);
        float zone = smoothstep(uSpotZ.x, uSpotZ.x + 0.06, vObj.z) * (1.0 - smoothstep(uSpotZ.y - 0.06, uSpotZ.y, vObj.z));
        if (uSpotZ.z < 0.5) zone *= smoothstep(uSpot.z, uSpot.z + 0.04, vObj.y);
        else zone *= step(0.0, vObj.y);
        vec2 s = lSpots(p, vLook.y, uSpot.x, uSpot.y, uSpot.w);
        lc = mix(lc, mix(uSpotA, uSpotB, s.y), s.x * zone * 0.88);
      }
      if (uLookPart < 0.5 && vLook.w > 0.0) {
        // A scar or two: pale, ragged streaks across its flank.
        float a = vLook.w * 6.283;
        vec2 d = vec2(cos(a), sin(a));
        vec2 p = vec2(vObj.z - (vLook.w - 0.5) * 0.4, vObj.y - 0.02);
        float along = dot(p, d), across = dot(p, vec2(-d.y, d.x));
        float rag = lNoise(vec2(along * 40.0, vLook.w * 9.0)) * 0.006;
        float line = (1.0 - smoothstep(0.004 + rag, 0.009 + rag, abs(across))) * (1.0 - smoothstep(0.08, 0.12, abs(along)));
        float line2 = (1.0 - smoothstep(0.003, 0.007, abs(across - 0.03))) * (1.0 - smoothstep(0.05, 0.08, abs(along + 0.02))) * step(0.5, vLook.w);
        lc = mix(lc, vec3(0.74, 0.72, 0.7), max(line, line2) * 0.5);
      }
      if (morph > 0.5) {
        if (morph < 1.5) lc = mix(lc, vec3(0.93, 0.92, 0.88) * (0.72 + 0.3 * lum), 0.8);
        else if (morph < 2.5) lc = mix(lc, lc * 0.22 + vec3(0.025, 0.03, 0.035), 0.88);
        else if (morph < 3.5) lc = mix(lc, vec3(1.0, 0.74, 0.2) * (0.5 + 0.75 * lum), 0.82);
        else if (morph < 4.5) lc = mix(lc, vec3(1.0, 0.9, 0.86) * (0.8 + 0.22 * lum), 0.92);
        else {
          float pat = smoothstep(0.52, 0.6, lNoise(vObj.zx * 7.0 + vObj.zy * 5.0 + vLook.y * 40.0));
          lc = mix(lc, vec3(0.94, 0.92, 0.89), pat * 0.95);
        }
      }
    }
    diffuseColor.rgb = lc;
  }`;

// The three.js uniforms for a material: its kind's rules (lookRuleValues) and, for a single fish
// drawn alone, its own look ({ value: [shade, seed, morph, marks] }, shared by its three parts).
export const lookUniforms = (v, look) => ({
  uLookShade: { value: v.shade }, uLookPart: { value: v.part },
  uSpot: { value: v.spot }, uSpotZ: { value: v.spotZ }, uSpotA: { value: v.a }, uSpotB: { value: v.b },
  uLook: look,
});
const hex = (c) => {
  const n = parseInt(c.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// The uniforms for a kind's looks, for one of its materials (part: 0 body, 1 fins, 2 eyes). Plain
// numbers: the materials turn them into three.js uniforms (see lookUniforms in fish.js).
export function lookRuleValues(sp, part) {
  const R = lookRulesFor(sp), S = R.spots;
  return {
    shade: R.shade ?? 0.2, part,
    spot: S ? [S.density, S.size, S.from, S.b ? S.share ?? 0.5 : 0] : [0, 0, 0, 0],
    spotZ: S ? [S.z[0], S.z[1], S.top ? 1 : 0, R.scars ?? 0] : [0, 0, 0, R.scars ?? 0],
    a: hex(S?.a || '#000000'), b: hex(S?.b || S?.a || '#000000'),
  };
}
