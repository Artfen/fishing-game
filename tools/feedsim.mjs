// Watches the feeds (src/world/feeding.js) in the real ecosystem headless, from one place for a
// stretch of game time: when and why each starts, how it goes and ends, how much of the time a
// feed's showing at the top near you, the longest quiet, and what kept pressed shoals from
// starting one. For tuning the feeds' quiet and how often they come.
//   node --import ./tests/setup.mjs tools/feedsim.mjs [hour] [minutes] [x] [z] [day]
//   e.g. tools/feedsim.mjs 6.5 60          (dawn at Willowhaven, for an hour of game time)
//        tools/feedsim.mjs 12.5 60 -300 600 (midday up the coast)
import { createHabitat } from '../src/world/habitat.js';
import { Ecosystem } from '../src/world/ecosystem.js';
import { FEED, UP } from '../src/world/feeding.js';

const [hour = 6.5, mins = 20, X = 30, Z = 20, day = 10] = process.argv.slice(2).map(Number);
const eco = new Ecosystem(createHabitat());
const light = hour > 6 && hour < 19;
const ctx = { env: { hour, abs: 24 * day + hour, daylight: light ? 0.8 : 0, night: light ? 0 : 1, cloud: 0.2, rain: 0, tide: { flow: -0.4 }, colour: 0 }, focus: { x: X, z: Z }, boat: { x: X, z: Z, speed: 0 } };
const log = [];
eco.feeding.onEvent = (what, e) => {
  if (what === 'start') e.log = { cause: e.cause, shoal: e.s.sp.id, at: Math.round(eco.time), metres: Math.round(Math.hypot(e.s.x - X, e.s.z - Z)), mostHunters: 0, upAfter: null };
  if (!e.log) return;
  if (what === 'up') e.log.upAfter = Math.round(e.t);
  if (what === 'over') {
    Object.assign(e.log, { lasted: Math.round(e.t), ended: e.why });
    log.push(e.log);
  }
};
let samples = 0, up400 = 0, up900 = 0, quiet = 0, longest = 0, pressed = 0, blockedQuiet = 0, blockedApart = 0, blockedMax = 0;
for (let i = 0; i < 30 * 60 * mins; i++) {
  eco.update(1 / 30, ctx);
  for (const e of eco.feeding.events) if (e.log) e.log.mostHunters = Math.max(e.log.mostHunters, e.hunters);
  if (i % 300) continue;
  // Every ten seconds: a feed at the top near? And the shoals pressed hard near, and what's stopping them.
  samples++;
  const d = (e) => Math.hypot(e.s.x - X, e.s.z - Z), ups = eco.feeding.events.filter((e) => e.phase === UP);
  if (ups.some((e) => d(e) < 400)) up400++;
  if (ups.some((e) => d(e) < 900)) {
    up900++;
    quiet = 0;
  } else longest = Math.max(longest, (quiet += 10));
  for (const s of eco.forage) {
    if (s.feed || Math.hypot(s.x - X, s.z - Z) > 240 || eco.fearOf(s) < FEED.press) continue;
    pressed++;
    if (eco.feeding.events.length >= FEED.max) blockedMax++;
    else if (eco.feeding.quiet.some((q) => (q.x - s.x) ** 2 + (q.z - s.z) ** 2 < FEED.quietR ** 2)) blockedQuiet++;
    else if (eco.feeding.events.some((e) => (e.s.x - s.x) ** 2 + (e.s.z - s.z) ** 2 < FEED.apart ** 2)) blockedApart++;
  }
}
for (const e of eco.feeding.events) if (e.log) log.push(Object.assign(e.log, { lasted: Math.round(e.t), ended: 'still going' }));
const pct = (n) => `${Math.round((100 * n) / samples)}%`;
console.log(`${mins} minutes at ${hour}h from (${X}, ${Z}): ${log.length} feeds`);
console.log(`  a feed at the top within 900 m ${pct(up900)} of the time, within 400 m ${pct(up400)}; the longest with none ${Math.round(longest / 60)} min`);
console.log(`  shoals pressed hard near: ${pressed} looks (kept from a feed by a quiet spell ${blockedQuiet}, another feed near ${blockedApart}, three going ${blockedMax})`);
console.log(`  strikes ${eco.strikes || 0}, small fish taken ${eco.taken || 0}`);
for (const l of log.sort((a, b) => a.at - b.at)) console.log('  ' + JSON.stringify(l));
