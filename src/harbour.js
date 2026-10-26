import { RODS, TACKLE } from './tackle.js';
import { tideWords, dayTides } from './world/tide.js';
import { setupsFor } from './guide.js';
import { PLACES, HAVEN } from './world/terrain.js';
import { HOME_WORDS, bearing } from './trip.js';
import { windAt, waveHeightHere, currentAt, compass, windWords, seaWords, conditions } from './world/conditions.js';
import { ADVENTURES } from './adventures.js';

// Willowhaven's notice board. Everything on it comes from the game as it is right now: the wind
// and sea (from the shared conditions), which fish are about at this hour in the waters round the
// harbour (the ecosystem's own fish, where they live and how busy the hour makes them), where
// gulls are diving (the real flocks over real shoals), and the notices that start adventures.
// Nothing here is made up to sound fishy.

// Where a fish's home is, in words a harbour board would use.
const TAG_WORDS = {
  wreck: 'round the Kittiwake', strand: 'in the surf off Shell Strand', head: 'under Cove Head', jetty: 'by the Old Jetty',
  stack: 'round Gull Rock', cove: 'in Driftwood Cove', channel: 'in the cove channel', deep: 'in the deep hole of the bay',
};
const ZONE_WORDS = { bay: 'in Willow Bay', cove: 'in Driftwood Cove', open: 'out past the bay', coast: 'along the cove shore' };
const SEA = Object.keys(ZONE_WORDS); // (a harbour board talks about the sea, not the lakes behind it)

export function whatsAbout(eco, { x = HAVEN.x, z = HAVEN.z, reach = 380, max = 5 } = {}) {
  const by = new Map();
  for (const a of eco.agents) {
    if (!a.active || a.sp.retired || a.L.observe || !SEA.includes(a.home.zone)) continue;
    const d = Math.hypot(a.home.x - x, a.home.z - z);
    if (d > reach) continue;
    let e = by.get(a.sp.id);
    if (!e) by.set(a.sp.id, (e = { sp: a.sp, n: 0, homes: new Map() }));
    e.n++;
    const key = a.home.tag && TAG_WORDS[a.home.tag] ? `t:${a.home.tag}` : `z:${a.home.zone}:${a.home.type}`;
    e.homes.set(key, (e.homes.get(key) || 0) + 1);
  }
  const out = [];
  for (const e of by.values()) {
    const act = eco.activity[e.sp.id] ?? 0;
    if (act < 0.45 || e.n < 2) continue;
    const [key] = [...e.homes.entries()].sort((p, q) => q[1] - p[1])[0];
    let where;
    if (key.startsWith('t:')) where = TAG_WORDS[key.slice(2)];
    else {
      const [, zone, type] = key.split(':');
      where = `${HOME_WORDS[type] ? `over ${HOME_WORDS[type]} ` : ''}${ZONE_WORDS[zone] || ''}`.trim();
    }
    const s = setupsFor(e.sp)[0];
    out.push({
      sp: e.sp, act, n: e.n, where,
      how: s ? `${TACKLE[s.item].on} on the ${RODS[s.rod].short.toLowerCase()}` : '',
      score: act * Math.min(1, e.n / 4),
    });
  }
  return out.sort((p, q) => q.score - p.score).slice(0, max);
}

// Gulls diving right now, and where (by the nearest named place).
export function birdsWorking(flocks, known) {
  const out = [];
  for (const f of flocks) {
    if (f.t < 1) continue;
    let best = null, bd = Infinity;
    for (const p of PLACES) {
      if (p.area || !known[p.id]) continue;
      const d = Math.hypot(p.x - f.x, p.z - f.z);
      if (d < bd) { bd = d; best = p; }
    }
    const fromHaven = Math.round(Math.hypot(f.x - HAVEN.x, f.z - HAVEN.z));
    out.push(best && bd < 220
      ? `Gulls diving ${Math.round(bd / 10) * 10 || 10} m ${bearing(f.x - best.x, f.z - best.z)} of ${best.name}.`
      : `Gulls diving ${fromHaven} m ${bearing(f.x - HAVEN.x, f.z - HAVEN.z)} of the harbour.`);
  }
  return out;
}

export function weatherLines(skyWord, abs = null) {
  const inside = windAt(0, -40), out = windAt(40, 160);
  const kmh = (v) => Math.round(v * 3.6);
  const lines = [];
  const w = conditions.wind;
  lines.push(w.speed < 0.6 ? 'Wind: flat calm.' : `Wind: ${windWords(w.speed).toLowerCase()} from the ${compass(w.from, true)}, ${kmh(out.speed)} km/h outside the bay${inside.speed < out.speed * 0.7 ? `, ${kmh(inside.speed)} km/h in its shelter` : ''}.`);
  const seaIn = waveHeightHere(0, -20), seaOut = waveHeightHere(60, 140);
  lines.push(`Sea: ${seaWords(seaOut).toLowerCase()} outside (about ${seaOut < 0.1 ? 'nothing' : `${seaOut.toFixed(1)} m`}), ${seaWords(seaIn).toLowerCase()} in the bay.`);
  const c = currentAt(146, 30, 0), cs = Math.hypot(c.x, c.z);
  lines.push(cs < 0.05 ? 'The cove channel is slack.' : `The cove channel runs ${cs.toFixed(cs < 0.1 ? 2 : 1)} m/s to the ${compass(Math.atan2(c.x, -c.z), true)}.`);
  if (skyWord) lines.push(`Sky: ${skyWord.toLowerCase()}.`);
  if (abs != null) lines.push(`Tide: ${tideWords(abs)}. ${dayTides(Math.floor(abs / 24))}`);
  return lines;
}

// The notices, from the adventures (the ones that start on the board).
export function notices(adv) {
  return ADVENTURES.filter((A) => A.where.includes('notice board')).map((A) => ({ id: A.id, title: A.title, text: A.clue, status: adv.status(A.id) }));
}

// The board's paper in the world: a header, four pinned notes and (once you've pinned it) your
// photograph. Drawn into the board's canvas (see coast.js).
export function paintBoard(ctx, w, h, { photo = null, seen = {} } = {}) {
  ctx.fillStyle = '#6e5238';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let y = 0; y < h; y += 18) ctx.fillRect(0, y, w, 1);
  ctx.fillStyle = '#efe4c9';
  ctx.font = '700 40px Kalam, Caveat, cursive';
  ctx.textAlign = 'center';
  ctx.fillText('Willowhaven', w / 2, 46);
  const notes = [
    { x: 30, y: 72, r: -0.04, title: 'Wind & sea', c: '#f4ecd6' },
    { x: 182, y: 70, r: 0.03, title: 'What’s about', c: '#fbf5e3' },
    { x: 30, y: 196, r: 0.05, title: seen.kittiwake ? 'The Kittiwake ✓' : 'The Kittiwake', c: '#e9dcc0', photo: 'old' },
    { x: 182, y: 198, r: -0.03, title: 'Gulls diving?', c: '#f4ecd6' },
    // (Tam Leask's card, in faded ink: the watcher on the Calf.)
    { x: 346, y: 76, r: 0.06, title: seen.watch ? 'The Calf ✓' : 'The Calf', c: '#e6dfcb' },
  ];
  for (const n of notes) {
    ctx.save();
    ctx.translate(n.x + 70, n.y + 55);
    ctx.rotate(n.r);
    ctx.fillStyle = n.c;
    ctx.fillRect(-70, -55, 140, 110);
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.arc(0, -48, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1c';
    ctx.font = '700 18px Kalam, Caveat, cursive';
    ctx.fillText(n.title, 0, -24);
    if (n.photo) {
      ctx.fillStyle = '#8a7a5e';
      ctx.fillRect(-48, -14, 96, 58);
      ctx.fillStyle = '#5b4d39';
      ctx.fillRect(-36, 10, 72, 10);
      ctx.fillRect(-6, -8, 4, 20);
    } else {
      ctx.fillStyle = 'rgba(58,42,28,0.55)';
      for (let i = 0; i < 5; i++) ctx.fillRect(-52, -8 + i * 11, 84 + ((i * 37) % 20), 2);
    }
    ctx.restore();
  }
  // Your photograph, pinned in the corner (the wall adventure).
  if (photo) {
    ctx.save();
    ctx.translate(w - 95, h - 92);
    ctx.rotate(0.04);
    ctx.fillStyle = '#fbf8f0';
    ctx.fillRect(-82, -62, 164, 124);
    const iw = 150, ih = Math.min(104, (iw * photo.height) / photo.width);
    ctx.drawImage(photo, -iw / 2, -56, iw, ih);
    ctx.fillStyle = '#c23b2e';
    ctx.beginPath();
    ctx.arc(0, -60, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

