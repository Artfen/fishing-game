// What a session costs on the wire and on the host, measured: N players (default 8) in one session
// through the stand-in for Supabase Realtime (tests/fakeRealtime.mjs), the host's real sea and fish,
// everyone in a boat moving about, some fishing (floats sitting, lures being worked), one crewing at
// a friend's helm. Reports each kind of message per second (sent, and delivered: Supabase counts
// each message once for every client it reaches), the bytes, the shared sea's snapshot size, and the
// host's simulation time a frame.
//
//   node --import ./tests/setup.mjs tools/netbudget.mjs [players=8] [apart|together] [seconds=60]

import * as THREE from 'three';

const ctx2d = new Proxy({}, { get: (o, k) => (k === 'createRadialGradient' || k === 'createLinearGradient' ? () => ({ addColorStop() {} }) : k === 'measureText' ? () => ({ width: 10 }) : k === 'getImageData' ? () => ({ data: [] }) : k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}), set: () => true });
globalThis.document ??= { createElement: () => ({ width: 0, height: 0, getContext: () => ctx2d }), fonts: null };

const { buildSeaLife } = await import('../src/world/sealife.js');
const { Ecosystem } = await import('../src/world/ecosystem.js');
const { createHabitat } = await import('../src/world/habitat.js');
const { SharedWorld } = await import('../src/sharedworld.js');
const { Together } = await import('../src/together.js');
const { Crew } = await import('../src/crew.js');
const { Hub } = await import('../tests/fakeRealtime.mjs');

const N = Math.max(2, Math.min(8, Number(process.argv[2]) || 8));
const SPREAD = process.argv[3] === 'together' ? 'together' : 'apart';
const SECS = Number(process.argv[4]) || 60;
const CFG = { url: 'https://example.supabase.co', anonKey: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoiYW5vbiJ9.c2ln' };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const habitat = createHabitat();
const env = { hour: 11, daylight: 1, night: 0, abs: 24 * 60, tide: { flow: 0.5 }, rain: 0, cloud: 0.2 };

const hub = new Hub();
const clock = { t: 100 };
const T = Array.from({ length: N }, (_, i) => new Together({ config: () => CFG, name: () => `P${i + 1}`, kinds: ['row', 'skiff', 'console'], WS: hub.WS, online: () => true, listenMs: 25, retryScale: 0.01, now: () => clock.t, ...(i === 0 ? { newCode: () => '4242' } : {}) }));
const eco = T.map(() => {
  const e = new Ecosystem(habitat);
  e.populate();
  return e;
});
const life = T.map(() => buildSeaLife(new THREE.Scene()));
const S = T.map((t, i) => new SharedWorld({ together: t, sealife: life[i], eco: eco[i] }));
const K = T.map((t) => new Crew({ together: t }));
await T[0].host();
for (let i = 1; i < N; i++) await T[i].join('4242');
while (!T.every((t) => t.others.length === N - 1)) await wait(10);

// Where everyone is: spread round the bay, the coast and the crossing, or all in one bay.
const APART = [{ x: 60, z: 400 }, { x: -300, z: 300 }, { x: 300, z: 900 }, { x: -200, z: 150 }, { x: 500, z: 200 }, { x: -500, z: 800 }, { x: 120, z: 1600 }, { x: 0, z: 2600 }];
const at = Array.from({ length: N }, (_, i) => (SPREAD === 'apart' ? { ...APART[i] } : { x: 60 + (i % 4) * 25, z: 400 + Math.floor(i / 4) * 30 }));
const heading = at.map((_, i) => i * 0.8);
// Half the guests fishing: floats sitting still, lures worked; one guest crewing at the host's helm.
const fishing = (i) => i > 0 && i % 2 === 1;
const lure = (i) => i % 4 === 3;
for (let i = 1; i < N; i++) if (fishing(i)) Object.assign(eco[i].bait, { active: true, kind: lure(i) ? 'lure' : 'float', item: lure(i) ? 'spinner' : 'worm', size: 1, thick: 0.3, motion: lure(i) ? 'slow' : 'still', x: at[i].x + 15, y: -0.6, z: at[i].z, vx: 0, vz: 0, anglerX: at[i].x, anglerZ: at[i].z });
const crewing = N > 2 ? 2 : -1;
if (crewing > 0) {
  K[crewing].board(T[0].id, { L: 7.4, B: 1.25, seatZ: -0.62 });
  K[crewing].on.helm = true;
  K[0].given = { id: T[crewing].id, ti: 0, si: 0, at: 0 };
}
const pose = (i, t) => {
  if (i === crewing) return { m: 'foot', x: at[0].x, z: at[0].z, h: heading[0], a: 'stand', cr: T[0].id, cx: K[i].on.x, cz: K[i].on.z };
  return { m: 'boat', k: i === 0 ? 'console' : 'skiff', x: at[i].x, z: at[i].z, h: heading[i], f: fishing(i), ...(fishing(i) ? { r: lure(i) ? 'spin' : 'float', i: lure(i) ? 'spinner' : 'worm', ex: eco[i].bait.x, ez: eco[i].bait.z } : {}) };
};
const viewers = () => T.map((t, i) => ({ id: t.id, from: at[i], boat: null, boatSpeed: 0, region: at[i].z > 3000 ? 'south' : 'home' }));

// Warm up, then measure.
const reset = () => {
  for (const t of T) t.stats = Together.freshStats();
};
let hostMs = 0, frames = 0, snapBytes = [], tt = 0;
const run = async (secs, measure) => {
  for (let f = 0; f < secs * 30; f++) {
    const dt = 1 / 30;
    clock.t += dt;
    tt += dt;
    // Moving about: the boats under way, fishing boats drifting, a lure coming in.
    for (let i = 0; i < N; i++) {
      const v = fishing(i) ? 0.3 : i === 0 ? 4 : 3;
      heading[i] += dt * 0.05;
      at[i].x += Math.sin(heading[i]) * v * dt;
      at[i].z += Math.cos(heading[i]) * v * dt;
      if (fishing(i)) {
        const b = eco[i].bait;
        if (lure(i)) {
          const dx = at[i].x - b.x, dz = at[i].z - b.z, l = Math.hypot(dx, dz) || 1;
          b.vx = (dx / l) * 0.8;
          b.vz = (dz / l) * 0.8;
          b.x += b.vx * dt;
          b.z += b.vz * dt;
          if (l < 3) Object.assign(b, { x: at[i].x + 15, z: at[i].z });
        } else {
          b.x += 0.05 * dt;
        }
      }
    }
    T.forEach((t, i) => t.update(dt, pose(i, tt)));
    const V = viewers();
    const t0 = performance.now();
    S[0].update(dt, V);
    eco[0].update(dt, { env, focus: at[0], foci: at, boat: { x: at[0].x, z: at[0].z, speed: 4 }, walker: null, lantern: null, lights: [] });
    life[0].update(dt, tt, { from: at[0], boat: null, boatSpeed: 0, daylight: 1, hour: 11, region: 'home', eco: eco[0], diving: false, viewers: V });
    if (measure) {
      hostMs += performance.now() - t0;
      frames++;
    }
    for (let i = 1; i < N; i++) S[i].update(dt, V);
    if (crewing > 0) K[crewing].sendWheel(dt, Math.sin(tt * 0.7) > 0 ? 1 : 0, Math.sin(tt * 0.3));
    if (measure && S[0].lastBytes && f % 15 === 0) snapBytes.push(S[0].lastBytes);
    if (f % 3 === 0) await wait(1);
  }
  await wait(50);
};
await run(5, false);
reset();
const t0 = Date.now();
await run(SECS, true);

// What went out and what was delivered, by kind, per second.
const kinds = {};
for (const t of T) {
  for (const [k, v] of Object.entries(t.stats.kinds)) {
    const K2 = (kinds[k] ||= { out: 0, in: 0, bytesOut: 0, bytesIn: 0 });
    K2.out += v.out;
    K2.in += v.in;
    K2.bytesOut += v.bytesOut;
    K2.bytesIn += v.bytesIn;
  }
}
const rows = Object.entries(kinds).sort((a, b) => b[1].in - a[1].in);
const tot = rows.reduce((s, [, v]) => ({ out: s.out + v.out, in: s.in + v.in, bytesIn: s.bytesIn + v.bytesIn }), { out: 0, in: 0, bytesIn: 0 });
const avg = (a) => a.reduce((s, x) => s + x, 0) / Math.max(1, a.length);
console.log(`${N} players, ${SPREAD}, ${SECS} s simulated (${((Date.now() - t0) / 1000).toFixed(0)} s to run); ${Math.ceil((N - 1) / 2)} guests fishing, ${crewing > 0 ? 'one crewing at the host’s helm' : 'nobody crewing'}`);
console.log('kind               sent/s  delivered/s   KB/s delivered');
for (const [k, v] of rows) console.log(`${k.padEnd(18)} ${(v.out / SECS).toFixed(1).padStart(6)} ${(v.in / SECS).toFixed(1).padStart(12)} ${(v.bytesIn / SECS / 1024).toFixed(2).padStart(14)}`);
console.log(`${'all'.padEnd(18)} ${(tot.out / SECS).toFixed(1).padStart(6)} ${(tot.in / SECS).toFixed(1).padStart(12)} ${(tot.bytesIn / SECS / 1024).toFixed(2).padStart(14)}`);
console.log(`per hour: ${((tot.out + tot.in) / SECS * 3600 / 1e6).toFixed(2)} million sent plus delivered (${(tot.in / SECS * 3600 / 1e6).toFixed(2)} million delivered)`);
console.log(`shared-sea snapshot: ${(avg(snapBytes) / 1024).toFixed(1)} KB average, ${(Math.max(...snapBytes) / 1024).toFixed(1)} KB largest; ${S[0].stats.sent} sent`);
console.log(`host simulation (fish, sea life, snapshots): ${(hostMs / frames).toFixed(2)} ms a frame`);
for (const t of T) t.leave();
await wait(100);
process.exit(0);
