// Makes the game's recorded sounds (assets/sounds/) from their sources (src/soundFiles.js:
// docs/SOUND.md), and writes assets/sounds/SOURCES.md with each one's provenance and licence.
//
//   node tools/sounds.mjs            fetch each source (kept in a cache outside the repository),
//                                    cut, level and encode; write SOURCES.md
//   node tools/sounds.mjs --sources  only write SOURCES.md
//
// Needs ffmpeg (with libmp3lame) on the path. The game itself needs nothing: the files are kept in
// the repository, and this is how they were made (and how to make them again, or others).
//
// A loop: the source from `from` for loop + LOOP_FADE seconds, its last LOOP_FADE cross-faded
// (equal power) into its first, so it repeats without a seam; then LOOP_PAD of its own end before
// and of its start after (audio.js loops between them: whether or not a browser trims the MP3
// encoder's few milliseconds at the start, the loop is the same). Levelled to the same loudness.
// A call: from `from` to `to`, a short fade in and out, levelled to its peak.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { SOUNDS, SOUND_DIR, LOOP_PAD, LOOP_FADE, LICENCES } from '../src/soundFiles.js';

const root = join(fileURLToPath(import.meta.url), '..', '..');
const out = join(root, SOUND_DIR);
const cache = join(tmpdir(), 'slow-tide-sound-sources');
const SR = 44100;
const UA = 'SlowTide/0.1 (game sound sourcing)';

function sourcesMd() {
  const rows = Object.entries(SOUNDS).map(([id, s]) => `| \`${s.file}\` | ${s.what} | [${s.source.title}](${s.source.page}) | ${s.source.by} | ${LICENCES[s.source.licence]} | ${s.loop ? `${s.loop} s loop from ${s.from} s` : `${s.from}–${s.to} s`}${s.highpass ? `, high-pass ${s.highpass} Hz` : ''} |`);
  return `# The recorded sounds: where each came from\n\nEvery file here is public domain or CC0: anyone may use it for anything. Made from its source by\n\`tools/sounds.mjs\` (see \`src/soundFiles.js\` and \`docs/SOUND.md\`): cut, made mono, levelled, encoded\nas MP3; a loop's end cross-faded into its start.\n\n| File | What | Source | Recordist | Licence | Cut |\n|---|---|---|---|---|---|\n${rows.join('\n')}\n`;
}

async function fetchSource(url) {
  mkdirSync(cache, { recursive: true });
  const f = join(cache, encodeURIComponent(url).slice(-120));
  if (existsSync(f)) return f;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  writeFileSync(f, Buffer.from(await res.arrayBuffer()));
  return f;
}
const decode = (f, from, secs, hp) => {
  const af = ['aresample=44100', ...(hp ? [`highpass=f=${hp}`] : ['highpass=f=35'])].join(',');
  const b = execFileSync('ffmpeg', ['-v', 'error', '-ss', String(from), '-t', String(secs), '-i', f, '-ac', '1', '-af', af, '-ar', String(SR), '-f', 'f32le', '-'], { maxBuffer: 1 << 30 });
  return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength));
};
const encode = (pcm, file) => execFileSync('ffmpeg', ['-v', 'error', '-y', '-f', 'f32le', '-ar', String(SR), '-ac', '1', '-i', '-', '-c:a', 'libmp3lame', '-b:a', '64k', file], { input: Buffer.from(pcm.buffer) });
const rms = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0) / a.length);
const peak = (a) => a.reduce((m, x) => Math.max(m, Math.abs(x)), 0);

function loopOf(a, L, F) {
  // a: L + F samples. The loop: a[0 … L), its first F faded in under the tail a[L … L + F) fading out.
  const P = new Float32Array(L);
  for (let i = 0; i < L; i++) P[i] = a[i];
  for (let i = 0; i < F; i++) {
    const k = i / F;
    P[i] = a[i] * Math.sin(k * Math.PI / 2) + a[L + i] * Math.cos(k * Math.PI / 2);
  }
  return P;
}
function padded(P, pad) {
  const L = P.length, out = new Float32Array(L + 2 * pad);
  for (let i = 0; i < pad; i++) out[i] = P[L - pad + i];
  out.set(P, pad);
  for (let i = 0; i < pad; i++) out[pad + L + i] = P[i];
  return out;
}
function level(a, target, ceiling = 0.89) {
  let g = target / Math.max(1e-6, rms(a));
  g = Math.min(g, ceiling / Math.max(1e-6, peak(a)));
  for (let i = 0; i < a.length; i++) a[i] *= g;
  return a;
}

const only = process.argv.includes('--sources');
mkdirSync(out, { recursive: true });
if (!only) {
  for (const [id, s] of Object.entries(SOUNDS)) {
    const src = await fetchSource(s.source.file);
    let pcm;
    if (s.loop) {
      const L = Math.round(s.loop * SR), F = Math.round(LOOP_FADE * SR);
      const a = decode(src, s.from, s.loop + LOOP_FADE + 0.05, s.highpass);
      if (a.length < L + F) throw new Error(`${id}: the source is too short there`);
      pcm = padded(level(loopOf(a, L, F), 0.1), Math.round(LOOP_PAD * SR));
    } else {
      const a = decode(src, s.from - 0.03, s.to - s.from + 0.15, s.highpass);
      const fi = Math.round(0.01 * SR), fo = Math.round(0.08 * SR);
      for (let i = 0; i < fi; i++) a[i] *= i / fi;
      for (let i = 0; i < fo; i++) a[a.length - 1 - i] *= i / fo;
      const g = 0.7 / Math.max(1e-6, peak(a));
      for (let i = 0; i < a.length; i++) a[i] *= g;
      pcm = a;
    }
    encode(pcm, join(out, s.file));
    console.log(`${s.file}: ${(pcm.length / SR).toFixed(2)} s`);
  }
}
writeFileSync(join(out, 'SOURCES.md'), sourcesMd());
console.log(`${SOUND_DIR}SOURCES.md`);
