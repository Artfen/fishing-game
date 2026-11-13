// Voyages (G1 of docs/PROGRESSION.md): the log of each real passage you make, kept for good. A
// voyage begins when you take your boat away from a berth and ends when she's tied up at one again
// (or put away). Along the way the game notes where you went and how far, the furthest you got,
// the boats, the places, the fish and the best of them, the sea life, the gales you weathered, the
// crossings, the jobs done, and every line written in her papers meanwhile. A trip round the bay
// isn't a voyage: one that went offshore, spent a night out, crossed to Las Brasas, did a job, or
// kept away from a berth for half a day is, and goes into the journal's Voyages (the last
// VOYAGES_KEPT), with a line in her papers.

export const VOYAGES_KEPT = 40;
export const LONG_HOURS = 12;   // game hours away from a berth that make a voyage of it
const LOG_KEPT = 16, PLACES_KEPT = 12, LIFE_KEPT = 16, BOATS_KEPT = 4, JOBS_KEPT = 8, CROSS_KEPT = 6;
const STAGES = ['out', 'in', 'back'];

const plain = (v, max) => (typeof v === 'string' ? v.replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
const num = (v, lo = 0, hi = 1e9) => (Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : lo);
const isObj = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const addOnce = (list, v, max) => {
  if (v != null && v !== '' && !list.includes(v) && list.length < max) list.push(v);
};

// A voyage begun: when (the day and hour, and the game's clock in hours, abs), in which boat, from
// where (a place's name), and the harbour how far out she gets is measured from (x, z).
export function newVoyage({ day, hour, abs, kind, from, x, z }) {
  return {
    day, hour: Math.round(hour * 100) / 100, abs, from: plain(from, 40) || 'the water', x: Math.round(x), z: Math.round(z),
    boats: [kind], m: 0, far: 0, farAt: '', places: [], fish: 0, kept: 0, best: null, life: [], gales: 0, cross: [], jobs: [], log: [],
  };
}

// Something on the voyage (ev.k): 'move' (m metres more, now at x, z, called `where`), 'boat',
// 'place', 'fish' ({ sp, name, kg, kept }), 'life', 'gale', 'cross' ({ to, stage }), 'job' (its
// title) or 'log' ({ day, text }: a line in her papers).
export function onVoyage(V, ev) {
  if (!V || !ev) return V;
  switch (ev.k) {
    case 'move': {
      V.m += num(ev.m, 0, 1e5);
      const d = Math.hypot(ev.x - V.x, ev.z - V.z);
      if (d > V.far) {
        V.far = Math.round(d);
        if (ev.where) V.farAt = plain(ev.where, 40);
      }
      break;
    }
    case 'boat': addOnce(V.boats, ev.kind, BOATS_KEPT); break;
    case 'place': addOnce(V.places, plain(ev.name, 40), PLACES_KEPT); break;
    case 'life': addOnce(V.life, ev.kind, LIFE_KEPT); break;
    case 'gale': V.gales++; break;
    case 'fish': {
      V.fish++;
      if (ev.kept) V.kept++;
      if (!V.best || num(ev.kg) > V.best.kg) V.best = { sp: ev.sp, name: plain(ev.name, 40), kg: Math.round(num(ev.kg) * 100) / 100 };
      break;
    }
    case 'cross':
      if (STAGES.includes(ev.stage) && (ev.to === 'south' || ev.to === 'home') && V.cross.length < CROSS_KEPT) V.cross.push({ to: ev.to, stage: ev.stage });
      break;
    case 'job': addOnce(V.jobs, plain(ev.title, 60), JOBS_KEPT); break;
    case 'log': {
      const e = { day: Math.floor(num(ev.day)), text: plain(ev.text, 160) }, last = V.log[V.log.length - 1];
      // (The same line again the same day: once.)
      if (last && last.day === e.day && last.text === e.text) break;
      V.log.push(e);
      if (V.log.length > LOG_KEPT) V.log.splice(0, V.log.length - LOG_KEPT);
      break;
    }
  }
  return V;
}

// Whether it was a voyage, now it's over: out past offshoreAt (m from the harbour), a night
// out, a crossing, a job done, or half a day away from a berth.
export function worthKeeping(V, { day, abs, offshoreAt }) {
  return V.far > offshoreAt || day > V.day || V.cross.length > 0 || V.jobs.length > 0 || abs - V.abs >= LONG_HOURS;
}

// Its name: the crossing, if it made one; otherwise where it reached.
export function voyageTitle(V) {
  const made = (to) => V.cross.some((c) => c.to === to && c.stage === 'in');
  if (made('south') && made('home')) return 'To Las Brasas and back';
  if (made('south')) return 'Across to Las Brasas';
  if (made('home')) return 'Home from Las Brasas';
  if (V.cross.some((c) => c.stage === 'back')) return 'Out towards Las Brasas, and back';
  return V.farAt ? `Out to ${V.farAt}` : 'Along the coast';
}

// Finished: the record kept (when it ended, where, the nights out, the hours, the sea miles).
export function finishVoyage(V, { day, hour, abs, to }) {
  const R = {
    day: V.day, hour: V.hour, end: { day, hour: Math.round(hour * 100) / 100, to: plain(to, 40) || 'a berth' }, from: V.from,
    nights: Math.max(0, day - V.day), hours: Math.round(Math.max(0, abs - V.abs) * 10) / 10, nm: Math.round((V.m / 1852) * 10) / 10,
    far: V.far, farAt: V.farAt, boats: V.boats.slice(), places: V.places.slice(), fish: V.fish, kept: V.kept, best: V.best,
    life: V.life.slice(), gales: V.gales, cross: V.cross.slice(), jobs: V.jobs.slice(), log: V.log.slice(),
  };
  R.title = voyageTitle(V);
  return R;
}

// Kept: the newest last, the last VOYAGES_KEPT.
export function keepVoyage(list, R) {
  list.push(R);
  if (list.length > VOYAGES_KEPT) list.splice(0, list.length - VOYAGES_KEPT);
  return list;
}

// Her papers' line for it.
export function papersLine(R) {
  return `${R.title}: ${R.nm} nm${R.nights ? `, ${R.nights} night${R.nights > 1 ? 's' : ''} out` : ''}${R.fish ? `, ${R.fish} fish` : ''}.`;
}

// For the journal, in words: { title, when, lines } (names: kinds -> names, boats and sea life).
const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const count = (n, one, many = `${one}s`) => `${n <= 10 ? NUMBER_WORDS[n] : n} ${n === 1 ? one : many}`;
const clock = (h) => {
  const H = Math.floor(h) % 24, M = Math.floor((h % 1) * 60);
  return `${H % 12 || 12}${M ? `:${String(M).padStart(2, '0')}` : ''}${H < 12 ? 'am' : 'pm'}`;
};
const list = (xs) => (xs.length < 2 ? xs.join('') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`);
export function voyageWords(R, { boat = (k) => k, life = (k) => k } = {}) {
  const when = R.end.day === R.day ? `Day ${R.day}, ${clock(R.hour)} to ${clock(R.end.hour)}` : `Day ${R.day}, ${clock(R.hour)} to day ${R.end.day}, ${clock(R.end.hour)}`;
  const lines = [];
  lines.push(`From ${R.from} to ${R.end.to}, in ${list(R.boats.map((k) => `the ${boat(k)}`))}: ${R.nm} nm${R.far > 400 ? `, ${(R.far / 1000).toFixed(1)} km out at the furthest${R.farAt ? ` (${R.farAt})` : ''}` : ''}.`);
  if (R.nights) lines.push(`${count(R.nights, 'night').replace(/^./, (c) => c.toUpperCase())} out.`);
  if (R.fish) lines.push(`${count(R.fish, 'fish', 'fish').replace(/^./, (c) => c.toUpperCase())}${R.kept && R.kept < R.fish ? ` (${R.kept} kept)` : ''}${R.best ? `, the best ${/^[aeiou]/i.test(R.best.name) ? 'an' : 'a'} ${R.best.name} of ${R.best.kg < 1 ? `${Math.round(R.best.kg * 1000)} g` : `${R.best.kg.toFixed(1)} kg`}` : ''}.`);
  if (R.life.length) lines.push(`Saw ${list(R.life.slice(0, 6).map(life))}.`);
  if (R.gales) lines.push(R.gales === 1 ? 'Weathered a gale.' : `Weathered ${count(R.gales, 'gale')}.`);
  if (R.places.length) lines.push(`By ${list(R.places.slice(0, 6))}.`);
  for (const j of R.jobs) lines.push(`Job done: ${j}.`);
  return { title: R.title, when, lines, log: R.log.map((e) => `Day ${e.day}: ${e.text}`) };
}

// What a save holds of them: the voyage under way (or null), and those kept.
export function cleanVoyage(v) {
  if (!isObj(v) || !Number.isFinite(v.day) || !Number.isFinite(v.abs) || !Array.isArray(v.boats)) return null;
  const strs = (a, max, n) => (Array.isArray(a) ? a.filter((s) => typeof s === 'string').map((s) => plain(s, n)).filter(Boolean).slice(0, max) : []);
  return {
    day: Math.floor(num(v.day)), hour: num(v.hour, 0, 24), abs: num(v.abs), from: plain(v.from, 40) || 'the water', x: Math.round(num(v.x, -1e5, 1e5)), z: Math.round(num(v.z, -1e5, 1e5)),
    boats: strs(v.boats, BOATS_KEPT, 16), m: num(v.m), far: Math.round(num(v.far)), farAt: plain(v.farAt, 40), places: strs(v.places, PLACES_KEPT, 40),
    fish: Math.floor(num(v.fish)), kept: Math.floor(num(v.kept)), best: isObj(v.best) && typeof v.best.sp === 'string' ? { sp: plain(v.best.sp, 24), name: plain(v.best.name, 40), kg: num(v.best.kg) } : null,
    life: strs(v.life, LIFE_KEPT, 24), gales: Math.floor(num(v.gales, 0, 99)),
    cross: (Array.isArray(v.cross) ? v.cross : []).filter((c) => isObj(c) && STAGES.includes(c.stage) && (c.to === 'south' || c.to === 'home')).slice(0, CROSS_KEPT).map((c) => ({ to: c.to, stage: c.stage })),
    jobs: strs(v.jobs, JOBS_KEPT, 60), log: (Array.isArray(v.log) ? v.log : []).filter((e) => isObj(e) && typeof e.text === 'string').slice(-LOG_KEPT).map((e) => ({ day: Math.floor(num(e.day)), text: plain(e.text, 160) })),
  };
}
export function cleanVoyages(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const r of list.slice(-VOYAGES_KEPT)) {
    if (!isObj(r) || !isObj(r.end)) continue;
    const V = cleanVoyage({ ...r, abs: 0 });
    if (!V) continue;
    const { abs, x, z, m, ...rest } = V;
    out.push({
      ...rest, title: plain(r.title, 60) || voyageTitle(V), end: { day: Math.floor(num(r.end.day)), hour: num(r.end.hour, 0, 24), to: plain(r.end.to, 40) || 'a berth' },
      nights: Math.floor(num(r.nights, 0, 999)), hours: num(r.hours, 0, 1e5), nm: num(r.nm, 0, 1e5),
    });
  }
  return out;
}
