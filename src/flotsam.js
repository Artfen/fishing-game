// After the gale (F3a). A gale that blows through at home leaves something on the tide line of one
// of the beaches the morning after: a glass fishing float, a length of ship's timber, a coil of good
// rope, or a bottle with a note in it. You're told once, when it's blown itself out, that the
// strands are worth a walk. Walk to it and pick it up: the chandlery buys the float, the timber and
// the rope; the bottle's note goes on your chart as a mark. What isn't picked up the next tides take
// back, LIES_DAYS after the gale. One find a gale, at one beach; nothing timed, nothing missed for
// good (there's another gale).
//
// state.flotsam: { seen (the day of the last gale that threw something up), lying: [{ gale, beach,
// kind, note, x, z, at (game hour it came ashore) }], held: [{ kind, day }] }.

import { seeded } from './util.js';

export const BEACHES = [
  { id: 'strand', name: 'Shell Strand', x: 101, z: 21 },
  { id: 'cove', name: 'Driftwood Cove', x: 140, z: -16 },
  { id: 'puffin', name: 'Puffin Cove', x: -252, z: 486 },
];

export const FINDS = {
  float: { name: 'a glass fishing float', short: 'glass float', price: 8, w: 3, text: 'Green glass the size of a grapefruit, in a net of old tarred twine: off a fishing boat out west, years ago, and adrift ever since.' },
  timber: { name: 'a length of ship’s timber', short: 'ship’s timber', price: 5, w: 3, text: 'Oak, black with the sea, the holes of its trenails still in it: part of a boat, once.' },
  rope: { name: 'a coil of good rope', short: 'coil of rope', price: 4, w: 3, text: 'Thirty metres of three-strand, hardly worn, washed off somebody’s deck in the blow.' },
  bottle: { name: 'a bottle with a note in it', short: 'bottle', price: 0, w: 2, note: true, text: 'Green glass, corked and waxed, with a rolled note inside.' },
};

// The notes in the bottles: words, and where they put a mark on your chart (or none).
export const NOTES = [
  { title: 'From a bottle: the Nose', note: '“Bass off the Nose at the top of the tide, on a sandeel through the white water. T.”', x: -466, z: 182 },
  { title: 'From a bottle: the Kittiwake', note: '“The big pollack hang off the north side of the old drifter, up in the water at dusk. Ask Bert.”', x: 92, z: 64 },
  { title: null, note: '“Whoever finds this: I threw it off the Las Brasas boat in the spring. Write to me at Bar El Muelle, Puerto Brasa. Fair winds. E.”', x: null, z: null },
];

export const LIES_DAYS = 3;
export const HELD_MAX = 6;

// What a gale threw up, and where: the same for the same gale (by its day), whoever plays it.
export function thrownUp(galeDay) {
  const r = seeded(galeDay * 977 + 13);
  const beach = BEACHES[Math.floor(r() * BEACHES.length) % BEACHES.length].id;
  const kinds = Object.keys(FINDS), total = kinds.reduce((s, k) => s + FINDS[k].w, 0);
  let roll = r() * total, kind = kinds[0];
  for (const k of kinds) {
    if ((roll -= FINDS[k].w) <= 0) { kind = k; break; }
  }
  const note = kind === 'bottle' ? Math.floor(r() * NOTES.length) % NOTES.length : null;
  return { gale: galeDay, beach, kind, note, seed: r() };
}

// A spot on the tide line of a beach (dry, just above the water, with the water close by), from the
// land's height (heightAt: terrain.js), searching out from the beach's middle; or null.
export function tideSpot(beachId, heightAt, seed = 0.5) {
  const B = BEACHES.find((b) => b.id === beachId);
  if (!B) return null;
  for (let ring = 2; ring <= 40; ring += 2) {
    for (let i = 0; i < 24; i++) {
      const a = (i / 24 + seed) * Math.PI * 2, x = B.x + Math.sin(a) * ring, z = B.z + Math.cos(a) * ring;
      const h = heightAt(x, z);
      if (h < 0.15 || h > 0.9) continue;
      // (The water within a few steps: it's the tide line, not the back of the beach.)
      let wet = false;
      for (let j = 0; j < 8 && !wet; j++) {
        const b = (j / 8) * Math.PI * 2;
        if (heightAt(x + Math.sin(b) * 4, z + Math.cos(b) * 4) < -0.05) wet = true;
      }
      if (wet) return { x: Math.round(x * 10) / 10, z: Math.round(z * 10) / 10 };
    }
  }
  return null;
}

export const stillLying = (f, abs) => abs < f.at + LIES_DAYS * 24;
export const beachName = (id) => BEACHES.find((b) => b.id === id)?.name || 'the shore';

// What the chandlery gives for what you're holding: { n, price, words }.
export function saleOf(held) {
  const sell = held.filter((h) => FINDS[h.kind]?.price > 0);
  const counts = {};
  for (const h of sell) counts[h.kind] = (counts[h.kind] || 0) + 1;
  const words = Object.entries(counts).map(([k, n]) => (n > 1 ? `${n} × ${FINDS[k].short}` : FINDS[k].short)).join(', ');
  return { n: sell.length, price: sell.reduce((s, h) => s + FINDS[h.kind].price, 0), words };
}

export const newFlotsam = () => ({ seen: 0, lying: [], held: [] });

// From a save: known finds and beaches, finite numbers.
export function cleanFlotsam(raw) {
  const out = newFlotsam();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const num = (v) => typeof v === 'number' && Number.isFinite(v);
  if (num(raw.seen) && raw.seen > 0) out.seen = Math.min(1e6, Math.floor(raw.seen));
  for (const f of Array.isArray(raw.lying) ? raw.lying.slice(0, BEACHES.length) : []) {
    if (!f || !FINDS[f.kind] || !BEACHES.some((b) => b.id === f.beach) || !num(f.x) || !num(f.z) || !num(f.at) || !num(f.gale)) continue;
    out.lying.push({ gale: Math.floor(f.gale), beach: f.beach, kind: f.kind, note: Number.isInteger(f.note) && NOTES[f.note] ? f.note : null, x: f.x, z: f.z, at: f.at });
  }
  for (const h of Array.isArray(raw.held) ? raw.held.slice(0, HELD_MAX) : []) {
    if (h && FINDS[h.kind] && FINDS[h.kind].price > 0) out.held.push({ kind: h.kind, day: num(h.day) ? Math.floor(h.day) : 0 });
  }
  return out;
}
