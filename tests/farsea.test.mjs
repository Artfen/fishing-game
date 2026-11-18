// (W3, second part) The big seas carried out past the near sheet (444 m): the far sheet that draws
// their rise and fall on out, meeting the near one without a step; each wave faded as the sheets'
// cells grow too coarse for it; past that, the flat ring, the swell in its shading pixel by pixel
// and, where the pixels are too coarse for it, in its roughness. Run with
// `node --import ./tests/setup.mjs --test tests/`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => new Proxy({}, { get: () => () => ({ addColorStop() {} }) }) }) };
globalThis.innerHeight ??= 800;

const { seaLayout, clipmap } = await import('../src/world/water.js');
const { PRESETS } = await import('../src/quality.js');
const { PATCH } = await import('../src/world/ocean.js');
const { WAVE_PARTS } = await import('../src/world/conditions.js');
const { SWELL } = WAVE_PARTS;
const SRC = readFileSync(new URL('../src/world/water.js', import.meta.url), 'utf8');
const ss = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
const SEGS = [...new Set(Object.values(PRESETS).map((p) => p.waterSegments))];
const LENS = [PATCH.L, ...SWELL.map((w) => (2 * Math.PI) / w.k)];

// The cell of a clipmap of n cells across, finest `cell`, `levels` rings, at a point dx, dz from its
// middle (null outside it, or in its left-out middle).
function cellAt(cell, n, levels, dx, dz, hole = 0) {
  const c = Math.max(Math.abs(dx), Math.abs(dz));
  for (let L = 0; L < levels; L++) {
    const s = cell * 2 ** L;
    if (c < (n * s) / 2) return !L && hole && c < hole * s ? null : s;
  }
  return null;
}
const snapTo = (v, s) => Math.round(v / s) * s;

test('every setting: the near sheet, the far one past it, and the flat ring cover the sea with no gap, wherever the camera is', () => {
  assert.deepEqual(SEGS.sort((a, b) => a - b), [120, 200, 300, 360, 440]);
  for (const seg of SEGS) {
    const L = seaLayout(seg);
    // The near sheet reaches past NEAR_R all round, however it's snapped; and there, at the seam,
    // it's on its coarsest ring.
    assert.ok((L.n * L.snap) / 2 - L.snap / 2 > L.nearR, `${seg}: near sheet`);
    assert.ok((L.n * L.snap) / 4 + L.snap / 2 < L.nearR - 8, `${seg}: the seam on its coarsest ring`);
    // The far sheet's cells start as the near sheet's coarsest, on the same lattice.
    assert.equal(L.nearCell, L.snap);
    assert.ok(Number.isInteger(Math.log2(L.farSnap / L.nearCell)));
    // Its left-out middle lies inside NEAR_R, however it's snapped; it reaches past farR, which is
    // past the near sheet's corners.
    assert.ok(L.hole * L.nearCell + L.farSnap / 2 <= L.nearR - 8, `${seg}: far sheet's middle`);
    assert.ok((L.n * L.farSnap) / 2 - L.farSnap / 2 > L.farR + 2, `${seg}: far sheet's reach`);
    assert.ok(L.farR > L.nearR * Math.SQRT2 + 10, `${seg}: the flat ring past the near sheet's corners`);
    // Sampled: every bit of sea out to farR + 50 m is under the sheet that draws it.
    for (const [cx, cz] of [[0.3, 0.2], [L.snap * 0.49, -L.snap * 0.49], [L.farSnap * 0.49, L.farSnap * 0.49], [-1234.5, 777.7]]) {
      const nx = snapTo(cx, L.snap), nz = snapTo(cz, L.snap), fx = snapTo(cx, L.farSnap), fz = snapTo(cz, L.farSnap);
      for (let a = 0; a < Math.PI * 2; a += 0.05) {
        for (const r of [L.nearR - 1, L.nearR + 1, L.nearR * Math.SQRT2 + 1, (L.nearR + L.farR) / 2, L.farR - 1]) {
          const x = cx + r * Math.cos(a), z = cz + r * Math.sin(a);
          const sq = Math.max(Math.abs(x - cx), Math.abs(z - cz));
          const sheet = sq <= L.nearR ? cellAt(L.cell, L.n, L.levels, x - nx, z - nz) : cellAt(L.nearCell, L.n, L.farLevels, x - fx, z - fz, L.hole);
          assert.ok(sheet, `${seg}: ${r.toFixed(0)} m out, ${a.toFixed(2)}`);
        }
      }
    }
  }
});

test('each wave is drawn while the sheet\'s cells are fine enough for it, and every one has gone by where the flat ring starts', () => {
  for (const seg of SEGS) {
    const L = seaLayout(seg);
    for (const len of LENS) {
      // (As the shader fades it: in full to 0.7 of len × lod, gone by len × lod.)
      const full = 0.7 * len * L.lod, gone = len * L.lod;
      assert.equal(ss(gone, full, L.flatR), 0, `${seg}: ${len.toFixed(0)} m gone at the ring`);
      // Where it's drawn in full, at most a third of its length per cell on either sheet, the camera
      // anywhere in its snap.
      for (const [ox, oz] of [[0, 0], [L.farSnap / 2, L.farSnap / 2]]) {
        for (const a of [0, Math.PI / 4]) {
          const d = Math.min(full, L.farR), x = d * Math.cos(a) + ox, z = d * Math.sin(a) + oz;
          const c = Math.max(Math.abs(x - ox), Math.abs(z - oz)) <= L.nearR ? cellAt(L.cell, L.n, L.levels, x, z) : cellAt(L.nearCell, L.n, L.farLevels, x, z, L.hole);
          assert.ok(c <= len / 3, `${seg}: ${len.toFixed(0)} m at ${d.toFixed(0)} m on ${c} m cells`);
        }
      }
    }
    // The wind sea's patch is drawn in full on all of the near sheet, as before.
    assert.ok(0.7 * PATCH.L * L.lod >= L.nearR, `${seg}: patch`);
    assert.ok(L.farR > L.flatR);
  }
  // (The shader's own fades, with these numbers.)
  assert.match(SRC, /float keep = smoothstep\(uSeaPatch\.x \* uWaveLod\.y, 0\.7 \* uSeaPatch\.x \* uWaveLod\.y, dist\);/);
  assert.match(SRC, /s = uSwellA\[\$\{i\}\] \* ks \* smoothstep\(\$\{f\(TAU \/ w\.k\)\} \* uWaveLod\.y, \$\{f\(0\.7 \* TAU \/ w\.k\)\} \* uWaveLod\.y, dist\);/);
  assert.match(SRC, /uniforms\.uWaveLod\.value\.set\(L\.cell, L\.lod\);\n      uniforms\.uFarR\.value = L\.farR;/);
});

test('where the far sheet lies under the near one\'s coarsest ring it is the same triangles, so the two meet at NEAR_R without a step', () => {
  for (const seg of SEGS) {
    const L = seaLayout(seg);
    const near = clipmap(L.cell, L.n, L.levels), far = clipmap(L.nearCell, L.n, L.farLevels, L.hole);
    for (const [cx, cz] of [[3.3, -7.1], [L.farSnap * 0.45, -L.farSnap * 0.3]]) {
      const tris = (g, ox, oz) => {
        const p = g.attributes.position.array, idx = g.index.array, out = new Set();
        for (let t = 0; t < idx.length; t += 3) {
          const v = [0, 1, 2].map((k) => [p[idx[t + k] * 3] + ox, p[idx[t + k] * 3 + 2] + oz]);
          const r = v.map(([x, z]) => Math.max(Math.abs(x - cx), Math.abs(z - cz)));
          // (Those across the seam, or near enough to it that the wind sea's to-and-fro, a metre or
          // two, could carry them over it.)
          if (Math.min(...r) > L.nearR + 8 || Math.max(...r) < L.nearR - 8) continue;
          const key = (u) => (Math.round(u * 100) / 100 + 0).toFixed(2);
          out.add(v.map(([x, z]) => `${key(x)},${key(z)}`).join(' '));
        }
        return out;
      };
      const a = tris(near, snapTo(cx, L.snap), snapTo(cz, L.snap)), b = tris(far, snapTo(cx, L.farSnap), snapTo(cz, L.farSnap));
      assert.ok(a.size > 100, `${seg}: ${a.size}`);
      for (const t of a) assert.ok(b.has(t), `${seg}: near ${t} not in the far sheet`);
      for (const t of b) assert.ok(a.has(t), `${seg}: far ${t} not in the near sheet`);
    }
  }
  // Each draws its own side of NEAR_R, and the flat ring the rest; the far sheet with the same
  // waves as the near one (not the flat ring's none).
  assert.match(SRC, /float around = length\(off\), square = max\(off\.x, off\.y\);\n  #if defined\(RING\)\n  if \(around < uFarR\) discard;\n  #elif defined\(FAR\)\n  if \(square <= \$\{NEAR_R\.toFixed\(1\)\} \|\| around > uFarR\) discard;\n  #else\n  if \(square > \$\{NEAR_R\.toFixed\(1\)\}\) discard;/);
  assert.match(SRC, /const far = new THREE\.Mesh\(new THREE\.BufferGeometry\(\), farMaterial\(\{ FAR: 1 \}\)\);/);
  assert.match(SRC, /far\.geometry = clipmap\(L\.nearCell, L\.n, L\.farLevels, L\.hole\);/);
  assert.match(SRC, /ring\.geometry = new THREE\.RingGeometry\(L\.farR - 2, 6000, 96, 6\)/);
  assert.match(SRC, /far\.position\.set\(Math\.round\(pos\.x \/ farSnap\) \* farSnap - mesh\.position\.x, 0, Math\.round\(pos\.z \/ farSnap\) \* farSnap - mesh\.position\.z\);/);
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /hideFromReflection\(water\.far\);/);
});

test('past where the sheets can draw it, the swell carries on in the shading pixel by pixel, and as roughness past where the pixels can', () => {
  // The slope of each swell wave, by itself, over the sea: its mean square is half its amplitude
  // times its wavenumber, squared (with its Stokes crest, a few percent more), which is what goes
  // into the roughness when a pixel can't show it.
  for (const [i, peak] of [[0, 1], [3, 3.4]]) {
    const w = SWELL[i], s = 1.4;
    let m = 0, n = 0;
    for (let th = 0; th < Math.PI * 2; th += 0.001) {
      const sl = w.k * (s * Math.cos(th) + w.k * s * s * peak * Math.sin(2 * th));
      m += sl * sl;
      n++;
    }
    const lin = 0.5 * (s * w.k) ** 2;
    assert.ok(m / n >= lin && m / n < lin * 1.15, `${i}: ${m / n} vs ${lin}`);
  }
  // In the shader: shown while the pixel's footprint along it is at most a quarter of its length,
  // gone by half; what it can't show, ½(sk)², up the wind and across it, added to the roughness.
  assert.match(SRC, /keep = smoothstep\(\$\{f\(0\.5 \* TAU \/ w\.k\)\}, \$\{f\(0\.25 \* TAU \/ w\.k\)\}, max\(abs\(dp\.x \* \$\{f\(w\.dx\)\} \+ dp\.y \* \$\{f\(w\.dz\)\}\), abs\(dp\.z \* \$\{f\(w\.dx\)\} \+ dp\.w \* \$\{f\(w\.dz\)\}\)\)\);/);
  assert.match(SRC, /var \+= \(1\.0 - keep\) \* \$\{f\(0\.5 \* w\.k \* w\.k\)\} \* s \* s \* vec2\(cw \* cw, 1\.0 - cw \* cw\);/);
  assert.match(SRC, /vec3 sw = swellPix\(vRest, uTime, ksS, pkS, vec4\(dFdx\(vRest\), dFdy\(vRest\)\), normalize\(uWindV \+ vec2\(1e-6, 0\.0\)\), swVar, swRes\) \* fadeS;\n  vec3 Nw = vec3\(-sw\.y - seaS\.x, 1\.0, -sw\.z - seaS\.y\);/);
  assert.match(SRC, /vec2 msq = max\(uSlopeVar \* unres \* calm \+ uRain \* 0\.01, vec2\(0\.0012\)\) \+ swVar \* fadeS \* fadeS;/);
  // (The same swell as the sheet lifts: grown and steepened in the shallows the same way.)
  assert.match(SRC, /float ks = sh\.r \* \(1\.0 \+ 0\.8 \* smoothstep\(8\.0, 2\.5, depth\) \* smoothstep\(0\.8, 2\.2, depth\)\)/);
  assert.match(SRC, /float ksS = shel\.r \* \(1\.0 \+ 0\.8 \* smoothstep\(8\.0, 2\.5, depth\) \* smoothstep\(0\.8, 2\.2, depth\)\);/);
  assert.match(SRC, /float pk = min\(uPeak \+ 1\.4 \* smoothstep\(5\.0, 1\.5, depth\), 3\.6\);/);
  assert.match(SRC, /float pkS = min\(uPeak \+ 1\.4 \* smoothstep\(5\.0, 1\.5, depth\), 3\.6\);/);
});

test('a storm\'s crests break white out to the horizon, as much of the sea as on average where a pixel is too coarse for them, whatever the tide', () => {
  // The crest test over a big patch of sea, against the shader's average for where the pixels are
  // too coarse: within 0.8% of the sea, from fair weather to a full storm, small swell or big.
  const fit = (storm) => 0.026 + 0.06 * Math.min(1, Math.max(0, (storm - 0.4) / 0.6)) ** 2;
  for (const H of [0.6, 1.8, 3]) {
    for (const [storm, peak] of [[0, 1], [0.37, 1.4], [0.57, 2.19], [0.62, 2.38], [0.86, 3.23], [1, 3.4]]) {
      const amps = SWELL.map((w) => H * (w.share * (1 - 0.5 * storm) + w.storm * storm));
      let sum = 0, n = 0;
      for (let x = 0; x < 2000; x += 3.7) {
        for (let z = 0; z < 2000; z += 3.9) {
          let h = 0;
          SWELL.forEach((w, i) => {
            const a = w.k * (w.dx * x + w.dz * z), s = amps[i];
            h += s * Math.sin(a) - 0.5 * w.k * s * s * peak * Math.cos(2 * a);
          });
          sum += ss(0.62 * H, 1.1 * H, h);
          n++;
        }
      }
      assert.ok(Math.abs(sum / n - fit(storm)) < 0.008, `H ${H}, storm ${storm}: ${(sum / n).toFixed(3)} vs ${fit(storm).toFixed(3)}`);
    }
  }
  assert.match(SRC, /float hCrest = vWave - vSwell \+ sw\.x, stC = clamp\(\(uStorm - 0\.4\) \/ 0\.6, 0\.0, 1\.0\);\n  float crest = mix\(0\.026 \+ 0\.06 \* stC \* stC, smoothstep\(uSwellH \* 0\.62, uSwellH \* 1\.1, hCrest\), swRes\)/);
  // (Not the height with the tide in it.)
  assert.doesNotMatch(SRC, /smoothstep\(uSwellH \* 0\.62, uSwellH \* 1\.1, vWorld\.y\)/);
});
