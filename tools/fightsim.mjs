// Plays the fight (src/fight.js) thousands of times for different players and gear, and prints
// how often each lands the fish, why lines break, and how long fights last. For tuning:
//   node --import ./tests/setup.mjs tools/fightsim.mjs
import { newFight, stepFight, DIFFICULTY } from '../src/fight.js';
import { RODS, TERMS } from '../src/tackle.js';
import { fishById } from '../src/fish.js';

function dice(seed) {
  let s = seed;
  return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}
// A rod with its first (default) line, and its default leader (the spinning rod's wire trace).
const rodOf = (id, drag, line = 0) => ({ line: { ...RODS[id].lines[line], trace: !!TERMS[RODS[id].terms[0]].trace }, power: RODS[id].power, drag: drag ?? RODS[id].drag });
const sizeAt = (sp, k) => sp.size[0] + (sp.size[1] - sp.size[0]) * k;

export function play(sp, rod, diffId, style, { k = 0.9, cover = false, n = 300, seed = 7 } = {}) {
  const rnd = dice(seed);
  const diff = DIFFICULTY[diffId];
  const out = { landed: 0, n, time: 0 };
  for (let i = 0; i < n; i++) {
    const F = newFight(sp, sizeAt(sp, k), rod, diff, cover, rnd);
    const react = 0.2 + rnd() * 0.25;
    let held = true, cue = 99, calm = 99, was = false, result = null, creakT = 99;
    for (let step = 0; step < 9000 && !result; step++) {
      const dt = 1 / 30;
      if (style === 'careful') held = !(F.surgeT > 0 || (F.warned && !F.pulling));
      else if (style === 'human') {
        if (cue > react && cue < 50) held = false;
        if (!held && calm > react && calm < 50) { held = true; cue = 99; calm = 99; }
      } else if (style === 'creak') {
        // Holds on regardless, but a reaction time after the line creaks, eases off until the
        // run is over (or for a second), then holds again.
        if (F.tension > 0.9 && creakT > react + 1.6) creakT = 0;
        else creakT += dt;
        if (creakT > react && creakT < react + 1 + (F.pulling ? 0.5 : 0)) held = false;
        else held = true;
      } else held = true;
      const ev = stepFight(F, held, dt, diff, rnd);
      if ((ev === 'warn' || ev === 'run') && cue > 50) cue = 0; else cue += dt;
      const surging = F.surgeT > 0;
      if (was && !surging) calm = 0; else calm += dt;
      was = surging;
      if (ev && ev.startsWith('snap:')) result = ev.slice(5);
      else if (F.progress >= 1) { result = 'landed'; out.time += F.time; }
    }
    out[result || 'timeout'] = (out[result || 'timeout'] || 0) + 1;
  }
  out.rate = out.landed / n;
  out.time = out.landed ? +(out.time / out.landed).toFixed(1) : 0;
  return out;
}

const MAIN = !import.meta.url.includes("nomain");
const fmt = (r) => `${(r.rate * 100).toFixed(0).padStart(3)}%  ${String(r.time).padStart(5)}s  ${Object.entries(r).filter(([k]) => !['n', 'rate', 'time', 'landed'].includes(k)).map(([k, v]) => `${k}:${v}`).join(' ')}`;
const cases = MAIN && process.argv[2] ? JSON.parse(process.argv[2]) : [
  ['carp', 'carp'], ['carp', 'float'], ['pike', 'spin'], ['trout', 'trout'], ['trout', 'fly'], ['perch', 'trout'],
];
for (const [sp, rod, k = 0.9, cover = false] of MAIN ? cases : []) {
  for (const d of ['relaxed', 'standard', 'realistic']) {
    const line = ['careful', 'human', 'creak', 'holder'].map((s) => `${s.padEnd(7)} ${fmt(play(fishById[sp], rodOf(rod), d, s, { k, cover }))}`);
    console.log(`${sp} on ${rod} (k ${k}${cover ? ', cover' : ''}) ${d}:\n  ${line.join('\n  ')}`);
  }
}
