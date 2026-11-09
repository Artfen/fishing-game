// Playing together: a few friends in the same waters, each in their own game.
//
// One player starts a session and gets a four-digit code; a friend types the code in Settings →
// Play together and joins. From then on each of you sees the other (on foot, or in whichever boat
// they're in, with their name over them) and hears about their catches. Everything else stays
// your own: the time of day, the weather, the fish, your gear and your save. Nothing about a
// session is saved; it lasts until you leave it or close the game.
//
// It needs no server of its own. The messages go through Supabase Realtime, the same backend as
// the optional cloud saves (src/cloud.js): a public "broadcast" channel named after the code, and
// Realtime's presence to know who is in it. Only the public anon key is used and no sign-in is
// needed. Nothing is written to the database. With no backend configured the game says that
// playing together isn't set up, and nothing else changes.
//
// The Realtime connection is a plain WebSocket speaking the Phoenix channel protocol (JSON, vsn
// 1.0.0), so no SDK is needed: see Realtime below.

export const NAME_MAX = 16;
export const MAX_PLAYERS = 8;
const SEND_EVERY = 0.25;    // seconds between position messages while you move
const FLEET_EVERY = 5;      // seconds between word of where your boats in the water are lying
const FLEET_MAX = 4;
const IDLE_EVERY = 3;       // ... and while you keep still
const HEARTBEAT = 25000;    // ms: Realtime drops a connection that stays quiet for a minute
const LISTEN_MS = 1800;     // how long to listen for anyone already in a room before deciding
const PEER_TIMEOUT = 45;    // seconds without a word before someone is taken to have gone
const RECONNECT = [1, 2, 4, 8, 15, 15, 15]; // seconds between tries after the connection drops
// The world the host shares (see shareWorld): its version (a newer game's is left alone, with a
// word to reload), how often it's sent, and how long a word from the host stays good.
export const WORLD_V = 1;
const WORLD_EVERY = 2;
const WORLD_STALE = 20;
const HOST_GRACE = 60;      // seconds the others wait for a host who's gone (a reload, a blip)
const RESUME_FOR = 10 * 60; // seconds a session can be picked up again after a reload
const SESSION_KEY = 'slow-tide-session';
// Quick calls: a few words to the others, one at a time (no typing, nothing to moderate).
export const CALLS = ['Over here!', 'Fish on!', 'Come and look at this', 'Good spot here', 'Wait for me', 'Heading in'];
const CALL_GAP = 1.5;       // seconds between calls, each way
// Discoveries shared with friends, if you choose to share them (Settings → Play together): a place
// or dive site found, something found on a wreck, a first fish with how it was caught, or a mark
// from your map. Each arrives as a mark on their map, with your name on it.
export const FIND_KINDS = ['place', 'site', 'detail', 'fish', 'mark'];
const FIND_BURST = 6, FIND_WINDOW = 30; // at most six in any half-minute, each way
// Helping each other (see teamwork.js): a friend's fish netted for them, and their thanks; a shoal
// marked for everyone, at most every few seconds each.
export const HELPS = ['net', 'thanks'];
const HELP_GAP = 0.5, SHOAL_GAP = 4;
// Crewing (see crew.js): asking for the helm and its answers, and the wheel from the one at it.
// (Asking is limited; answers always go, a flood of them aside.)
const CREW_WORDS = ['helm', 'yes', 'no', 'back', 'wheel'];
const CREW_GAP = 0.3, WHEEL_GAP = 0.1, ANSWER_GAP = 0.05;
const crewGap = (e) => (e === 'helm' ? CREW_GAP : e === 'wheel' ? WHEEL_GAP : ANSWER_GAP);
const crewKey = (e) => `crew_${e}_T`;
const ASK_BURST = 12;     // asks a guest may make of the host in any second (rigs come up to four a second)
// Plain words only (nothing that could be read as markup), trimmed to fit.
const plain = (v, max) => (typeof v === 'string' ? v.replace(/[<>\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '');
export function cleanFind(f) {
  if (!f || typeof f !== 'object' || !FIND_KINDS.includes(f.k)) return null;
  const x = finite(f.x, -3000, 3000), z = finite(f.z, -3000, 8000);
  const t = plain(f.t, 40);
  if (x == null || z == null || !t) return null;
  const out = { k: f.k, x: Math.round(x), z: Math.round(z), t, n: plain(f.n, 240) };
  if (typeof f.id === 'string' && /^[a-z0-9-]{1,24}$/.test(f.id)) out.id = f.id;
  return out;
}
const MODES = ['foot', 'boat', 'dive', 'car'];
// The fastest anyone really goes, m/s, on foot, afloat, swimming and driving: anything quicker is
// a step ashore, a drive skipped or a passage made, and they're simply somewhere new.
const TOP_SPEED = { foot: 8, boat: 30, dive: 4, car: 40 };
// Friends are shown a moment in the past, gliding between positions they've already sent (timed
// by their own clock), so a message arriving a little early or late never shows as a jerk. The
// delay covers the gap between messages and the wobble in delivery; past their last word they're
// carried on at their speed for a moment, then wait.
const DELAY = 0.45;         // seconds behind (a message every 0.25 s, and up to 0.2 s of wobble)
const CARRY = 0.3;          // seconds carried on past the last message, at most
const KEEP = 32;            // positions kept per friend
const LAGS = 40;            // messages (about ten seconds' worth) to judge the quickest delivery by
const CATCH_UP = 0.05;      // how much faster or slower than real time a friend's replay may run
const ACTS = ['walk', 'stand', 'fish', 'sit'];
const LINE_REACH = 700;     // m: the furthest a line's end may be from whoever's fishing it (a marlin's run)
// With a fish on, what it's doing just now (see fight.js), so friends can see it at the end of
// the line: running, leaping, shaking its head, charging, diving, on a long run, sounding, circling,
// and coming out of the water as it's landed.
export const FISH_MOVES = ['run', 'jump', 'shake', 'charge', 'dive', 'longrun', 'sound', 'circle', 'land'];

/* ---------------- names and codes ---------------- */

// A name as it can be shown: printable, one line, trimmed, at most NAME_MAX characters.
export function cleanName(raw) {
  if (typeof raw !== 'string') return '';
  const s = raw.normalize('NFC').replace(/\s+/g, ' ').replace(/[\p{C}\p{Zl}\p{Zp}]/gu, '').trim();
  return [...s].slice(0, NAME_MAX).join('').trim();
}

const NAME_WORDS = ['Angler', 'Skipper', 'Boatman', 'Wader', 'Drifter', 'Rambler', 'Caster', 'Deckhand'];
export function suggestName(rand = Math.random) {
  return `${NAME_WORDS[Math.floor(rand() * NAME_WORDS.length)]} ${10 + Math.floor(rand() * 90)}`;
}

export const validCode = (s) => typeof s === 'string' && /^\d{4}$/.test(s);
export const cleanCode = (s) => String(s ?? '').replace(/\D/g, '').slice(0, 4);
export const makeCode = (rand = Math.random) => String(Math.floor(rand() * 10000)).padStart(4, '0');
export const topicFor = (code) => `slow-tide-${code}`;

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return Array.from({ length: 4 }, () => Math.random().toString(16).slice(2, 10)).join('-');
}

const finite = (v, lo, hi) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : null);
const r2 = (v) => Math.round(v * 100) / 100;

// Where someone is and what they're doing, as it comes over the wire: anything that isn't a
// sensible number, mode or boat is dropped (whoever sent it, it's only ever drawn and shown).
// gear: { rods, items }, the rods and tackle a pose may name.
export function cleanPose(p, kinds = null, gear = null) {
  if (!p || typeof p !== 'object') return null;
  const x = finite(p.x, -1e5, 1e5), z = finite(p.z, -1e5, 1e5), h = finite(p.h, -100, 100);
  if (x == null || z == null || h == null) return null;
  const m = MODES.includes(p.m) ? p.m : 'foot';
  const out = { m, x, z, h, vx: finite(p.vx, -60, 60) ?? 0, vz: finite(p.vz, -60, 60) ?? 0 };
  if (m === 'boat') {
    if (typeof p.k !== 'string' || (kinds && !kinds.includes(p.k))) return null;
    out.k = p.k;
    out.f = !!p.f;   // a line out
    out.s = !!p.s;   // under sail
    out.n = !!p.n;   // at anchor or tied up
    // Their bow trolling motor's state (see trollmount.js: ten small numbers), if they have one.
    if (Array.isArray(p.tr) && p.tr.length === 10 && p.tr.every((v) => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) < 20)) out.tr = p.tr.map(r2);
  }
  if (m === 'foot') out.a = ACTS.includes(p.a) ? p.a : 'stand';
  // Crewing in a friend's boat (see crew.js): whose, and where in her.
  if (m === 'foot' && typeof p.cr === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(p.cr)) {
    const cx = finite(p.cx, -3, 3), cz = finite(p.cz, -8, 8);
    if (cx != null && cz != null) Object.assign(out, { cr: p.cr, cx, cz });
  }
  if (m === 'foot' || m === 'boat') out.o = !!p.o; // (a fish on: their rod bent, and a word)
  // Fishing: the rod and what's on it, where their line meets the water (or the fish on it), and
  // with a fish on, the load on the line.
  if ((m === 'foot' || m === 'boat') && (out.f || out.a === 'fish' || out.o)) {
    if (typeof p.r === 'string' && /^[a-z0-9]{1,16}$/.test(p.r) && (!gear?.rods || gear.rods.includes(p.r))) out.r = p.r;
    if (typeof p.i === 'string' && /^[A-Za-z0-9]{1,24}$/.test(p.i) && (!gear?.items || gear.items.includes(p.i))) out.i = p.i;
    const ex = finite(p.ex, -1e5, 1e5), ez = finite(p.ez, -1e5, 1e5);
    if (ex != null && ez != null && Math.hypot(ex - x, ez - z) <= LINE_REACH) {
      out.ex = ex;
      out.ez = ez;
    }
    const tn = out.o ? finite(p.tn, 0, 1.3) : null;
    if (tn != null) out.tn = tn;
    if (out.o && FISH_MOVES.includes(p.mv)) out.mv = p.mv;
    // (What it is and how big, so friends see it leap and crash back in as the fish it is: see
    // fightshow.js.)
    if (out.o && typeof p.sp === 'string' && /^[a-z0-9]{1,24}$/.test(p.sp)) out.sp = p.sp;
    // (A size no fish is is thrown out, not taken for the biggest there could be.)
    if (out.o && Number.isFinite(p.sz) && p.sz >= 3 && p.sz <= 700) out.sz = Math.round(p.sz);
    // (Which of the shared sea's fish it is: see sharedworld.js.)
    if (out.o && Number.isInteger(p.hk) && p.hk >= 0 && p.hk < 1e5) out.hk = p.hk;
    // (Beaten and alongside, waiting for the net: a friend by it can net it for them.)
    if (out.o && p.nt) out.nt = true;
  }
  return out;
}

// Where someone's boats in the water are lying (all but the one they're in): [{ k, x, z, h }],
// checked like a pose; at most FLEET_MAX.
export function cleanFleet(list, kinds = null) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const b of list.slice(0, FLEET_MAX)) {
    if (!b || typeof b !== 'object' || typeof b.k !== 'string' || (kinds && !kinds.includes(b.k))) continue;
    const x = finite(b.x, -1e5, 1e5), z = finite(b.z, -1e5, 1e5), h = finite(b.h, -100, 100);
    if (x == null || z == null || h == null || out.some((o) => o.k === b.k)) continue;
    out.push({ k: b.k, x, z, h });
  }
  return out;
}

// The world as the host shares it: their time (game hours since day 0) and how fast it runs, the
// sky, the wind, the sea as chosen in Settings, and the water's colour. Checked like everything
// else that comes in; null if it isn't one (or is a newer game's).
export function cleanWorld(w, skies = null) {
  if (!w || typeof w !== 'object' || w.v !== WORLD_V) return null;
  const abs = finite(w.abs, 0, 1e7), rate = finite(w.rate, 0, 5);
  const S = w.sky, Wd = w.wind;
  if (abs == null || rate == null || !S || typeof S !== 'object' || !Wd || typeof Wd !== 'object') return null;
  const state = typeof S.state === 'string' && (!skies || skies.includes(S.state)) ? S.state : null;
  const from = finite(Wd.from, -100, 100), speed = finite(Wd.speed, 0, 40);
  if (!state || from == null || speed == null) return null;
  const unit = (v) => finite(v, 0, 1) ?? 0;
  return {
    v: WORLD_V, abs, rate,
    sky: { state, cloud: unit(S.cloud), rain: unit(S.rain), storm: unit(S.storm) },
    wind: { from, speed },
    sea: typeof w.sea === 'string' && /^[a-z]{1,16}$/.test(w.sea) ? w.sea : 'auto',
    colour: unit(w.colour),
  };
}

// What to tell the player when the online service can't be reached or says no.
export function explain(err) {
  const why = String(err?.message || err || '');
  if (/couldn’t connect|timed out|no answer|closed/.test(why)) {
    return 'Couldn’t reach the game’s online service. If nobody has played together for a while, the Supabase project may be paused: whoever runs this copy of the game can restore it from the Supabase dashboard. Then try again.';
  }
  const quota = /limit|quota|exceed|too many/i.test(why) ? ' The Supabase plan’s Realtime allowance may be used up (see Usage in the Supabase dashboard).' : '';
  return `The online service said no (${why || 'no reason given'}).${quota}`;
}

// The one-line description of where someone is, for the list in Settings.
// gearName(pose): what they're fishing with, in a few words, or ''.
export function poseWords(pose, boatName = (k) => k, gearName = () => '') {
  if (!pose) return 'on their way';
  const gear = gearName(pose), w = gear ? ` (${gear})` : '';
  if (pose.m === 'boat') return `in the ${boatName(pose.k)}${pose.o ? ', playing a fish' : pose.f ? ', fishing' : ''}${pose.f || pose.o ? w : ''}`;
  if (pose.m === 'dive') return 'diving';
  if (pose.m === 'car') return 'driving';
  return pose.o ? `playing a fish from the shore${w}` : pose.a === 'fish' ? `fishing from the shore${w}` : pose.a === 'sit' ? 'sitting a while' : 'on foot';
}

/* ---------------- a small Supabase Realtime client ---------------- */

// Just enough of Supabase Realtime for one channel: join, presence (track), broadcast, leave, and
// the heartbeat that keeps the connection open. `WS` is the WebSocket class (swappable in tests).
export class Realtime {
  constructor({ url, key, WS = globalThis.WebSocket }) {
    const base = url.replace(/^http/, 'ws').replace(/\/+$/, '');
    this.endpoint = `${base}/realtime/v1/websocket?apikey=${encodeURIComponent(key)}&vsn=1.0.0`;
    this.key = key;
    this.WS = WS;
    this.ws = null;
    this.ref = 0;
    this.topic = null;
    this.joinRef = null;
    this.waiting = new Map(); // ref -> { resolve, reject, timer }
    this.heartbeat = null;
    this.beatRef = null;
    this.cancel = null;
    this.onMessage = () => {};
    this.onClose = () => {};
    this.onTraffic = () => {}; // ('in' | 'out', bytes): the messages Supabase counts
  }

  get open() { return !!this.ws && this.ws.readyState === 1; }

  connect(timeout = 8000) {
    if (!this.WS) return Promise.reject(new Error('this browser can’t open a live connection'));
    return new Promise((resolve, reject) => {
      let ws;
      try {
        ws = new this.WS(this.endpoint);
      } catch (err) {
        reject(err);
        return;
      }
      this.ws = ws;
      const timer = setTimeout(() => {
        reject(new Error('the connection timed out'));
        try { ws.close(); } catch { /* already closed */ }
      }, timeout);
      // (Closed by us before it opened: give up straight away.)
      this.cancel = (why) => {
        clearTimeout(timer);
        reject(new Error(why));
      };
      ws.onopen = () => {
        clearTimeout(timer);
        this.cancel = null;
        this.heartbeat = setInterval(() => this.beat(), HEARTBEAT);
        resolve();
      };
      ws.onerror = () => { /* followed by onclose */ };
      ws.onclose = () => {
        clearTimeout(timer);
        this.cancel = null;
        const mine = this.ws === ws;
        if (mine) this.stop();
        reject(new Error('couldn’t connect'));
        if (mine) this.onClose();
      };
      ws.onmessage = (e) => this.receive(e.data);
    });
  }

  // A heartbeat that was never answered means the connection is dead: close it (and reconnect).
  beat() {
    if (!this.open) return;
    if (this.beatRef) {
      try { this.ws.close(); } catch { /* gone */ }
      return;
    }
    this.beatRef = this.push('phoenix', 'heartbeat', {});
  }

  push(topic, event, payload) {
    const ref = String(++this.ref);
    const msg = { topic, event, payload, ref };
    if (topic !== 'phoenix' && this.joinRef) msg.join_ref = this.joinRef;
    if (this.open) {
      const text = JSON.stringify(msg);
      this.ws.send(text);
      if (event === 'broadcast' || event === 'presence') this.onTraffic('out', text.length, payload?.event || event);
    }
    return ref;
  }

  // Push and wait for the server's reply.
  request(topic, event, payload, timeout = 8000) {
    return new Promise((resolve, reject) => {
      const ref = this.push(topic, event, payload);
      const timer = setTimeout(() => {
        this.waiting.delete(ref);
        reject(new Error('no answer from the server'));
      }, timeout);
      this.waiting.set(ref, { resolve, reject, timer });
    });
  }

  receive(data) {
    let msg;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.event === 'phx_reply') {
      if (msg.ref && msg.ref === this.beatRef) this.beatRef = null;
      const w = this.waiting.get(msg.ref);
      if (w) {
        this.waiting.delete(msg.ref);
        clearTimeout(w.timer);
        const status = msg.payload?.status;
        if (status === 'ok') w.resolve(msg.payload?.response);
        else w.reject(new Error(msg.payload?.response?.reason || status || 'refused'));
      }
      return;
    }
    if (msg.topic !== this.topic) return;
    if (msg.event === 'phx_error' || msg.event === 'phx_close') {
      // The channel failed on the server: treat it like a dropped connection.
      try { this.ws.close(); } catch { /* gone */ }
      return;
    }
    if (msg.event === 'broadcast' || msg.event === 'presence_diff' || msg.event === 'presence_state') this.onTraffic('in', String(data).length, msg.payload?.event || msg.event);
    this.onMessage(msg.event, msg.payload);
  }

  // Join one channel: public, with presence keyed by `key`, our own broadcasts not echoed back.
  async join(name, key) {
    this.topic = `realtime:${name}`;
    this.joinRef = String(this.ref + 1);
    const payload = {
      config: { broadcast: { ack: false, self: false }, presence: { key, enabled: true }, postgres_changes: [], private: false },
    };
    // (Signed out, the key itself goes as the access token, legacy anon JWT or publishable key
    // alike: just as Supabase's own client does.)
    if (this.key) payload.access_token = this.key;
    await this.request(this.topic, 'phx_join', payload);
  }

  track(meta) {
    if (this.topic) this.push(this.topic, 'presence', { type: 'presence', event: 'track', payload: meta });
  }

  send(event, payload) {
    if (this.topic) this.push(this.topic, 'broadcast', { type: 'broadcast', event, payload });
  }

  stop() {
    clearInterval(this.heartbeat);
    this.heartbeat = null;
    this.beatRef = null;
    for (const w of this.waiting.values()) {
      clearTimeout(w.timer);
      w.reject(new Error('the connection closed'));
    }
    this.waiting.clear();
  }

  close() {
    const ws = this.ws;
    this.ws = null;
    this.cancel?.('cancelled');
    this.cancel = null;
    if (ws && ws.readyState === 1 && this.topic) {
      try { ws.send(JSON.stringify({ topic: this.topic, event: 'phx_leave', payload: {}, ref: String(++this.ref), join_ref: this.joinRef })); } catch { /* gone */ }
    }
    this.stop();
    this.topic = null;
    if (ws) {
      ws.onclose = null;
      ws.onmessage = null;
      try { ws.close(); } catch { /* gone */ }
    }
  }
}

/* ---------------- drawing a friend smoothly ---------------- */

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// Where friend p was at time `at` (by their clock), from the positions they've sent: a smooth
// curve through them (Catmull-Rom, so it runs through each one and turns without corners), or,
// past the last, carried on a little at their speed. Sets p.at (x, z, h, v) and p.view.
export function glide(p, at, dt) {
  const S = p.snaps;
  // (The positions before the one just behind `at` are done with, but for one to shape the curve.)
  while (S.length > 2 && S[2].t <= at) S.shift();
  let i = S.length > 1 && S[1].t <= at ? 1 : 0;
  const a = S[i], b = S[i + 1];
  let x, z, h, vx, vz;
  if (at <= a.t) {
    ({ x, z, h } = a);
    vx = vz = 0;
  } else if (b) {
    const T = b.t - a.t, u = Math.min(1, (at - a.t) / T);
    // Tangents from the neighbours (or the segment itself at either end), per segment, kept from
    // carrying the curve past either end (so a stop is a stop, not an overshoot and back).
    const A = S[i - 1], B = S[i + 2];
    const dx = b.x - a.x, dz = b.z - a.z;
    const tame = (m, d) => (d === 0 || Math.sign(m) !== Math.sign(d) ? 0 : Math.sign(d) * Math.min(Math.abs(m), 3 * Math.abs(d)));
    // (Without a neighbour yet, the way they said they were going stands in for it.)
    const ma = A ? [tame((b.x - A.x) / (b.t - A.t) * T, dx), tame((b.z - A.z) / (b.t - A.t) * T, dz)] : [tame(a.vx * T, dx), tame(a.vz * T, dz)];
    const mb = B ? [tame((B.x - a.x) / (B.t - a.t) * T, dx), tame((B.z - a.z) / (B.t - a.t) * T, dz)] : [tame(b.vx * T, dx), tame(b.vz * T, dz)];
    const u2 = u * u, u3 = u2 * u;
    const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
    x = h00 * a.x + h10 * ma[0] + h01 * b.x + h11 * mb[0];
    z = h00 * a.z + h10 * ma[1] + h01 * b.z + h11 * mb[1];
    const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
    vx = (d00 * a.x + d10 * ma[0] + d01 * b.x + d11 * mb[0]) / T;
    vz = (d00 * a.z + d10 * ma[1] + d01 * b.z + d11 * mb[1]) / T;
    h = a.h + wrap(b.h - a.h) * u;
  } else {
    const e = Math.min(at - a.t, CARRY);
    x = a.x + a.vx * e;
    z = a.z + a.vz * e;
    h = a.h;
    vx = e < CARRY ? a.vx : 0;
    vz = e < CARRY ? a.vz : 0;
  }
  p.view = a.pose;
  // (A light hand on top, so that coming back from carrying on, or a late message, never snaps.)
  const A = p.at, k = 1 - Math.exp(-20 * dt);
  A.x += (x - A.x) * k;
  A.z += (z - A.z) * k;
  A.h += wrap(h - A.h) * k;
  A.v = Math.hypot(vx, vz);
}

/* ---------------- the session ---------------- */

// hooks: config() → { url, anonKey } or null (no backend); name() → your name; kinds: the boat
// kinds a pose may name; WS: the WebSocket class; online() → whether the browser is online.
// (listenMs, retryScale, newCode and now are there for the tests.)
export class Together {
  constructor({ config, name, kinds = null, skies = null, rods = null, items = null, WS = globalThis.WebSocket, online = () => globalThis.navigator?.onLine !== false, listenMs = LISTEN_MS, retryScale = 1, newCode = makeCode, now = () => globalThis.performance.now() / 1000, store = undefined }) {
    this.config = config;
    this.name = name;
    this.kinds = kinds;
    this.gear = rods || items ? { rods, items } : null; // (the rods and tackle a pose may name)
    this.WS = WS;
    this.online = online;
    this.listenMs = listenMs;
    this.retryScale = retryScale;
    this.newCode = newCode;
    this.now = now;           // real time in seconds: positions are stamped with it
    this.skies = skies;       // the skies a shared world may name
    // (sessionStorage, where a session waits through a reload; null where there's none.)
    this.store = store !== undefined ? store : (() => { try { return globalThis.sessionStorage ?? null; } catch { return null; } })();
    this.worldSource = null;  // host: () => the world to share (see shareWorld)
    this.fleetSource = null;  // () => your boats in the water, but the one you're in: [{ k, x, z, h }]
    this.fleetT = 0;
    this.fleetSent = null;
    this.world = null;        // joiner: the host's world as last heard ({ ...cleanWorld, heard })
    this.worldT = 0;
    this.worldSent = null;
    this.hostName = '';
    this.hostGoneAt = null;
    this.newer = false;       // someone's on a newer version of the game
    this.calledT = -99;
    this.shared = [];
    this.stats = Together.freshStats();
    this.id = newId();
    this.status = 'off';  // off | connecting | hosting | joined
    this.code = '';
    this.hostId = '';
    this.message = '';    // a line for Settings: what just happened, or what went wrong
    this.peers = new Map(); // id -> { id, name, host, present, pose, at, got, seen }
    this.rt = null;
    this.clock = 0;
    this.sendT = 0;
    this.sent = null;
    this.me = null;
    this.retry = 0;
    this.retryTimer = null;
    this.reconnecting = false;
    this.attempt = 0;     // bumped by each start or leave, so a stale attempt stops itself
    this.onChange = () => {};
    this.onEvent = () => {}; // (kind: 'joined' | 'join' | 'leave' | 'catch' | 'call' | 'fishOn' | 'find' | 'ended' | 'lost' | 'back', peer, data)
  }

  // What a session has sent and received (the messages Supabase counts against its allowance), and
  // how often the connection had to be got back: shown in Settings, nothing sent anywhere.
  static freshStats() { return { out: 0, in: 0, bytesOut: 0, bytesIn: 0, reconnects: 0, since: Date.now(), kinds: {} }; }
  // (Counted by kind too, for the diagnostics: where position, the shared sea and the rest go.)
  traffic(dir, bytes, kind = 'other') {
    const K = (this.stats.kinds[kind] ||= { in: 0, out: 0, bytesIn: 0, bytesOut: 0 });
    if (dir === 'out') {
      this.stats.out++;
      this.stats.bytesOut += bytes;
      K.out++;
      K.bytesOut += bytes;
    } else {
      this.stats.in++;
      this.stats.bytesIn += bytes;
      K.in++;
      K.bytesIn += bytes;
    }
  }

  get available() { return !!this.config() && !!this.WS; }
  get active() { return this.status === 'hosting' || this.status === 'joined'; }
  get hosting() { return this.status === 'hosting'; }
  get others() { return [...this.peers.values()].filter((p) => p.name); }

  changed(message) {
    if (message != null) this.message = message;
    this.onChange();
  }

  why() {
    if (!this.config()) return 'Playing together needs the game’s online service, and it isn’t set up on this copy of Slow Tide.';
    if (!this.WS) return 'This browser can’t open the live connection playing together needs.';
    if (!this.online()) return 'You’re offline. Playing together needs a connection.';
    return '';
  }

  meta() {
    return { id: this.id, name: this.name() || 'Someone', host: this.hosting };
  }

  // Start a session of your own: a fresh code nobody else is using (or, given one, take back your
  // own session after a reload: the others are waiting in it).
  async host(resume = null) {
    if (this.active || this.status === 'connecting') return false;
    const why = this.why();
    if (why) {
      this.changed(why);
      return false;
    }
    const attempt = ++this.attempt;
    this.status = 'connecting';
    this.stats = Together.freshStats();
    this.changed('Starting a session…');
    try {
      for (let i = 0; i < 6; i++) {
        const code = resume && validCode(resume) ? resume : this.newCode();
        const alone = await this.open(code, attempt);
        if (attempt !== this.attempt) return false;
        if (alone || resume) {
          this.status = 'hosting';
          this.hostId = this.id;
          // (A new epoch for the shared sea each time the host's game starts one: what it sends
          // from now on is a fresh account of it; see sharedworld.js.)
          this.epoch = newId().replace(/-/g, '').slice(0, 12);
          this.rt.track(this.meta());
          this.changed(resume ? `Back in your session, ${code}.` : `Your session is open. Give your friend the code ${code}.`);
          this.sendWorld();
          return true;
        }
        this.drop(); // someone else's session already has that code: try another
      }
      throw new Error('every code tried was in use');
    } catch (err) {
      if (attempt !== this.attempt) return false;
      this.drop();
      this.status = 'off';
      this.changed(`Couldn’t start a session. ${explain(err)}`);
      return false;
    }
  }

  // Join a friend's session by its code.
  async join(raw) {
    if (this.active || this.status === 'connecting') return false;
    const code = cleanCode(raw);
    if (!validCode(code)) {
      this.changed('A session code is four digits, like 4821.');
      return false;
    }
    const why = this.why();
    if (why) {
      this.changed(why);
      return false;
    }
    const attempt = ++this.attempt;
    this.status = 'connecting';
    this.stats = Together.freshStats();
    this.changed(`Looking for session ${code}…`);
    try {
      const alone = await this.open(code, attempt, true);
      if (attempt !== this.attempt) return false;
      if (alone) {
        this.drop();
        this.status = 'off';
        this.changed(`No one is in a session with the code ${code}. Check the code with whoever started it (it lasts while they’re in the game).`);
        return false;
      }
      if (this.peers.size >= MAX_PLAYERS) {
        this.drop();
        this.status = 'off';
        this.changed(`That session is full: up to ${MAX_PLAYERS} can play together.`);
        return false;
      }
      this.status = 'joined';
      this.rt.track(this.meta());
      const host = this.peers.get(this.hostId);
      this.changed(`You’ve joined ${host?.name ? `${host.name}’s` : 'the'} session.`);
      this.onEvent('joined', host || null);
      return true;
    } catch (err) {
      if (attempt !== this.attempt) return false;
      this.drop();
      this.status = 'off';
      this.changed(`Couldn’t join. ${explain(err)}`);
      return false;
    }
  }

  // Connect, join the code's channel and listen a moment: true if nobody else is there.
  async open(code, attempt, ask = false) {
    this.drop();
    const cfg = this.config();
    const rt = (this.rt = new Realtime({ url: cfg.url, key: cfg.anonKey, WS: this.WS }));
    rt.onMessage = (event, payload) => this.receive(event, payload);
    rt.onTraffic = (dir, bytes, kind) => this.traffic(dir, bytes, kind);
    rt.onClose = () => this.lost();
    this.code = code;
    await rt.connect();
    if (attempt !== this.attempt) return false;
    await rt.join(topicFor(code), this.id);
    if (attempt !== this.attempt) return false;
    // (Whoever's there answers a hello with where they are, presence or not.)
    if (ask) rt.send('hello', { id: this.id, name: this.name() });
    else rt.send('hello', { id: this.id, probe: true });
    await new Promise((r) => setTimeout(r, this.listenMs));
    if (!rt.open) throw new Error('the connection closed');
    return this.peers.size === 0;
  }

  // Leave the session (the host's leaving ends it for everyone).
  leave(quiet = false) {
    this.forget();
    if (this.status === 'off') return;
    this.attempt++;
    if (this.hosting && this.rt?.open) this.rt.send('end', { id: this.id });
    this.drop();
    this.status = 'off';
    if (!quiet) this.changed('You’ve left the session.');
  }

  // The page is going (a reload, the Update button, the tab closing): leave quietly, and keep the
  // session where a reload of this tab can pick it up (resume). The others wait a minute for a host.
  suspend() {
    if (!this.active) return;
    try { this.store?.setItem(SESSION_KEY, JSON.stringify({ code: this.code, host: this.hosting, at: Date.now() })); } catch { /* storage blocked */ }
    this.attempt++;
    this.drop();
    this.status = 'off';
  }

  // After a reload: back into the session this tab was in, if it was a few minutes ago.
  async resume() {
    let S = null;
    try { S = JSON.parse(this.store?.getItem(SESSION_KEY) || 'null'); } catch { /* unreadable */ }
    this.forget();
    if (!S || !validCode(S.code) || !(Date.now() - S.at < RESUME_FOR * 1000) || this.status !== 'off') return false;
    return S.host ? this.host(S.code) : this.join(S.code);
  }

  forget() {
    try { this.store?.removeItem(SESSION_KEY); } catch { /* storage blocked */ }
  }

  drop() {
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.reconnecting = false;
    this.retry = 0;
    if (this.rt) {
      if (this.rt.open) this.rt.send('bye', { id: this.id });
      this.rt.onClose = () => {};
      this.rt.close();
    }
    this.rt = null;
    this.peers.clear();
    this.hostId = '';
    this.sent = null;
    this.world = null;
    this.worldSent = null;
    this.hostGoneAt = null;
  }

  // The connection dropped mid-session: keep trying for a while, then give up.
  lost() {
    if (!this.active) return;
    if (!this.reconnecting) this.onEvent('lost', null);
    this.reconnecting = true;
    this.changed('Lost the connection. Trying again…');
    const wait = RECONNECT[this.retry++];
    if (wait == null) {
      const code = this.code;
      this.forget();
      this.drop();
      this.status = 'off';
      this.changed(`The connection was lost and couldn’t be got back, so you’ve left session ${code}.`);
      this.onEvent('ended', null, { lost: true });
      return;
    }
    const attempt = this.attempt;
    this.retryTimer = setTimeout(async () => {
      if (attempt !== this.attempt || !this.active) return;
      const cfg = this.config();
      if (!cfg || !this.online()) {
        this.lost();
        return;
      }
      // (Anyone who left while we were away went unannounced: whoever presence doesn't count as
      // here again, and who says nothing, is let go after a while.)
      for (const p of this.peers.values()) {
        p.present = false;
        p.seen = this.clock;
      }
      // (Until it's back, a failure here is this attempt's to handle, not onClose's.)
      const rt = (this.rt = new Realtime({ url: cfg.url, key: cfg.anonKey, WS: this.WS }));
      rt.onMessage = (event, payload) => this.receive(event, payload);
    rt.onTraffic = (dir, bytes, kind) => this.traffic(dir, bytes, kind);
      try {
        await rt.connect();
        await rt.join(topicFor(this.code), this.id);
        if (attempt !== this.attempt) return;
        rt.onClose = () => this.lost();
        rt.track(this.meta());
        rt.send('hello', { id: this.id, name: this.name() });
        this.sent = null;
        this.reconnecting = false;
        this.retry = 0;
        this.stats.reconnects++;
        this.changed('Connected again.');
        this.onEvent('back', null);
      } catch {
        if (attempt !== this.attempt) return;
        rt.close();
        this.lost();
      }
    }, wait * 1000 * this.retryScale);
  }

  // The browser's back online: don't wait out the back-off.
  nudge() {
    if (!this.reconnecting || !this.retryTimer) return;
    clearTimeout(this.retryTimer);
    this.retryTimer = null;
    this.retry = 0;
    this.lost();
  }

  // Your name changed: tell the others.
  renamed() {
    if (this.active && this.rt?.open) {
      this.rt.track(this.meta());
      this.sent = null;
    }
  }

  /* ---------- what comes in ---------- */

  peer(id, create = true) {
    if (typeof id !== 'string' || !id || id.length > 64 || id === this.id) return null;
    let p = this.peers.get(id);
    if (!p && create) {
      if (this.peers.size >= MAX_PLAYERS * 2) return null;
      // pose: the latest word from them; snaps: their recent positions, by their clock (t), for
      // drawing them; view: the pose they're drawn in; at: where they're drawn.
      p = { id, name: '', host: false, present: false, pose: null, snaps: [], lags: [], offset: 0, ofs: null, ofsT: 0, view: null, at: null, seen: this.clock };
      this.peers.set(id, p);
    }
    return p;
  }

  named(p, raw, host) {
    const fresh = !p.name;
    const n = cleanName(raw);
    if (n) p.name = n;
    if (host) {
      // (A new host, or the host back after a reload: what the last one said no longer holds.)
      if (p.id !== this.hostId) this.world = null;
      p.host = true;
      this.hostId = p.id;
      this.hostGoneAt = null;
    }
    if (p.id === this.hostId && p.name) this.hostName = p.name;
    // (Once a session is under way, a newcomer is news.)
    if (fresh && p.name && this.active) this.onEvent('join', p);
    if (fresh && p.name) this.onChange();
  }

  gone(id) {
    const p = this.peers.get(id);
    if (!p) return;
    this.peers.delete(id);
    if (id === this.hostId) this.world = null;
    if (p.name && this.active) this.onEvent('leave', p, { host: id === this.hostId });
    this.onChange();
  }

  presenceList(map, fn) {
    if (!map || typeof map !== 'object') return;
    for (const [key, v] of Object.entries(map)) {
      const meta = Array.isArray(v?.metas) ? v.metas[v.metas.length - 1] : null;
      fn(key, meta || {});
    }
  }

  receive(event, payload) {
    if (event === 'presence_state') {
      this.presenceList(payload, (key, meta) => {
        const p = this.peer(key);
        if (p) {
          p.present = true;
          this.named(p, meta.name, !!meta.host);
        }
      });
      return;
    }
    if (event === 'presence_diff') {
      this.presenceList(payload?.joins, (key, meta) => {
        const p = this.peer(key);
        if (p) {
          p.present = true;
          this.named(p, meta.name, !!meta.host);
        }
      });
      this.presenceList(payload?.leaves, (key) => {
        // (A rename re-tracks: the leave and the join come together, so only a leave alone counts.)
        if (payload?.joins && Object.hasOwn(payload.joins, key)) return;
        this.gone(key);
      });
      return;
    }
    if (event === 'system' && payload?.status === 'error') {
      this.changed(`The online service reported a problem: ${String(payload.message || 'unknown').slice(0, 120)}.`);
      return;
    }
    if (event !== 'broadcast' || !payload) return;
    const kind = payload.event, data = payload.payload;
    if (!data || typeof data !== 'object') return;
    if (kind === 'hello') {
      // Someone arriving (or checking a code is free): answer with who and where we are.
      const p = data.probe ? null : this.peer(data.id);
      if (p) {
        p.seen = this.clock;
        this.named(p, data.name, false);
      }
      if (this.active || this.status === 'connecting') {
        this.sent = null;
        this.sendPose(true);
        if (this.hosting) this.sendWorld();
        this.fleetSent = null;
        this.fleetT = 0;
      }
      return;
    }
    if (kind === 'bye') {
      if (typeof data.id === 'string') this.gone(data.id);
      return;
    }
    const p = this.peer(data.id);
    if (!p) return;
    p.seen = this.clock;
    if (kind === 'pose') {
      const pose = cleanPose(data.p, this.kinds, this.gear);
      if (data.n) this.named(p, data.n, !!data.host);
      if (!pose) return;
      // When they sent it, by their clock; and how far their clock is behind ours, plus the
      // quickest delivery lately (each message's lag beyond that is the wobble the delay hides).
      const here = this.now(), t = finite(data.t, -1e12, 1e12) ?? here;
      p.lags.push(here - t);
      if (p.lags.length > LAGS) p.lags.shift();
      p.offset = Math.min(...p.lags);
      const S = p.snaps, last = S[S.length - 1];
      const jump = !p.pose || !last || pose.m !== p.pose.m || pose.k !== p.pose.k || Math.hypot(pose.x - last.x, pose.z - last.z) > 60;
      if (!jump && t <= last.t) return; // (a late one, overtaken)
      if (pose.o && !p.pose?.o && p.name) this.onEvent('fishOn', p);
      p.pose = pose;
      const snap = { t, x: pose.x, z: pose.z, h: pose.h, vx: pose.vx, vz: pose.vz, pose };
      if (jump) {
        // Somewhere new (a passage, a boat to step into): there at once, not slid across the map.
        S.length = 0;
        p.at = { x: pose.x, z: pose.z, h: pose.h, v: 0 };
        p.view = pose;
      }
      S.push(snap);
      if (S.length > KEEP) S.shift();
    } else if (kind === 'fleet') {
      p.fleet = cleanFleet(data.fl, this.kinds);
    } else if (kind === 'catch') {
      const kg = finite(data.kg, 0, 2000);
      if (typeof data.sp !== 'string' || data.sp.length > 40 || kg == null) return;
      // (A few at a time: two fish landed close together are both news, a flood of them isn't.)
      p.caughts = (p.caughts || []).filter((at) => this.clock - at < 20);
      if (p.caughts.length >= 3) return;
      p.caughts.push(this.clock);
      this.onEvent('catch', p, { sp: data.sp, kg, best: !!data.best, first: !!data.first });
    } else if (kind === 'find') {
      const F = cleanFind(data.f);
      if (!F || !p.name) return;
      p.finds = (p.finds || []).filter((at) => this.clock - at < FIND_WINDOW);
      if (p.finds.length >= FIND_BURST) return;
      p.finds.push(this.clock);
      this.onEvent('find', p, F);
    } else if (kind === 'call') {
      const c = data.c;
      if (!Number.isInteger(c) || c < 0 || c >= CALLS.length || !p.name) return;
      if (this.clock - (p.callT ?? -99) < CALL_GAP) return;
      p.callT = this.clock;
      p.call = { text: CALLS[c], at: this.clock };
      this.onEvent('call', p, { text: CALLS[c] });
    } else if (kind === 'help') {
      // A friend helping with your fish (or thanking you for it): only words meant for you.
      if (!p.name || data.to !== this.id || !HELPS.includes(data.e) || !Number.isInteger(data.f) || data.f < 0 || data.f >= 1e5) return;
      if (this.clock - (p.helpT ?? -99) < HELP_GAP) return;
      p.helpT = this.clock;
      this.onEvent('help', p, { e: data.e, f: data.f, sp: plain(data.sp, 40), kg: finite(data.kg, 0, 2000) });
    } else if (kind === 'crew') {
      // Crewing: words between a boat's skipper and their crew (crew.js checks who's aboard).
      if (!p.name || data.to !== this.id || !CREW_WORDS.includes(data.e)) return;
      const wheel = data.e === 'wheel', key = crewKey(data.e);
      if (this.clock - (p[key] ?? -99) < crewGap(data.e) * 0.7) return;
      p[key] = this.clock;
      const d = { e: data.e, w: plain(data.w, 160) };
      if (wheel) {
        const ti = finite(data.ti, -1, 1), si = finite(data.si, -1, 1);
        if (ti == null || si == null) return;
        Object.assign(d, { ti, si });
      }
      this.onEvent('crew', p, d);
    } else if (kind === 'shoal') {
      // A shoal marked by a friend (teamwork.js checks it's one there is).
      const x = finite(data.x, -3000, 3000), z = finite(data.z, -3000, 8000);
      if (!p.name || !Number.isInteger(data.s) || data.s < 0 || data.s >= 1e5 || x == null || z == null) return;
      if (this.clock - (p.shoalT ?? -99) < SHOAL_GAP) return;
      p.shoalT = this.clock;
      this.onEvent('shoal', p, { s: data.s, x, z });
    } else if (kind === 'eco') {
      // The shared sea: only the host's counts.
      if (this.hosting || p.id !== this.hostId) return;
      this.onShared?.(data, p);
    } else if (kind === 'fish') {
      // A word about a fish and a guest's rig: only the host's counts (sharedworld.js checks whose).
      if (this.hosting || p.id !== this.hostId) return;
      this.onFish?.(data, p);
    } else if (kind === 'ask') {
      if (!this.hosting || typeof data.a !== 'string') return;
      // (However a guest's game behaves, a few asks a second is all it gets.)
      if (this.clock - (p.askT ?? -99) >= 1) {
        p.askT = this.clock;
        p.askN = 0;
      }
      if (++p.askN > ASK_BURST) {
        this.traffic('drop', 0, 'ask');
        return;
      }
      this.onAsk?.(data, p);
    } else if (kind === 'world') {
      // Only the host's world counts (whoever else might send one).
      if (this.hosting || (p.id !== this.hostId && !p.host)) return;
      const w = cleanWorld(data.w, this.skies);
      if (!w) {
        if (typeof data.w?.v === 'number' && data.w.v > WORLD_V && !this.newer) {
          this.newer = true;
          this.changed(`${p.name || 'The host'} is playing a newer version of Slow Tide. Reload the page to update, so you share the same sky.`);
        }
        return;
      }
      if (p.id !== this.hostId) {
        p.host = true;
        this.hostId = p.id;
        this.hostGoneAt = null;
      }
      this.world = { ...w, heard: this.now() };
    } else if (kind === 'end') {
      if (!this.active || (this.hostId && p.id !== this.hostId)) return;
      this.forget();
      const name = p.name || 'The host';
      this.attempt++;
      this.drop();
      this.status = 'off';
      this.changed(`${name} ended the session.`);
      this.onEvent('ended', p);
    }
  }

  /* ---------- what goes out ---------- */

  // Host: something for everyone in the session (the shared sea: see sharedworld.js).
  broadcast(kind, payload) {
    if (!this.hosting || !this.rt?.open || this.reconnecting) return false;
    this.rt.send(kind, { ...payload, id: this.id }); // (whoever it's from is always who sent it)
    return true;
  }

  // A guest: something asked of the host (a crossing's sea life to bring up, a fish to take the
  // lure: see sharedworld.js), each kind at most every `gap` seconds.
  ask(kind, payload, gap = 1) {
    if (this.status !== 'joined' || !this.rt?.open || this.reconnecting) return false;
    this.askedT ||= {};
    if (this.clock - (this.askedT[kind] ?? -99) < gap) return false;
    this.askedT[kind] = this.clock;
    this.rt.send('ask', { ...payload, id: this.id, a: kind });
    return true;
  }

  sendPose(now = false) {
    if (!this.me || !this.rt?.open || this.reconnecting) return;
    const P = this.me;
    const slow = Math.hypot(P.vx || 0, P.vz || 0) < 0.15; // (keeping still is keeping still)
    const msg = { m: P.m, x: r2(P.x), z: r2(P.z), h: r2(P.h), vx: slow ? 0 : r2(P.vx), vz: slow ? 0 : r2(P.vz) };
    if (P.m === 'boat') Object.assign(msg, { k: P.k, f: P.f ? 1 : 0, s: P.s ? 1 : 0, n: P.n ? 1 : 0 });
    if (P.m === 'boat' && Array.isArray(P.tr)) msg.tr = P.tr;
    if (P.m === 'foot') msg.a = P.a;
    if (P.m === 'foot' && P.cr) Object.assign(msg, { cr: P.cr, cx: r2(P.cx), cz: r2(P.cz) });
    if ((P.m === 'foot' || P.m === 'boat') && P.o) msg.o = 1;
    // (Fishing: the rod, what's on it, where the line meets the water, the load with a fish on.)
    if ((P.m === 'foot' || P.m === 'boat') && (P.f || P.a === 'fish' || P.o)) {
      if (P.r) msg.r = P.r;
      if (P.i) msg.i = P.i;
      if (P.ex != null && P.ez != null) Object.assign(msg, { ex: r2(P.ex), ez: r2(P.ez) });
      if (P.o && P.tn != null) msg.tn = r2(P.tn);
      if (P.o && P.mv) msg.mv = P.mv;
      if (P.o && P.hk != null) msg.hk = P.hk;
      if (P.o && P.nt) msg.nt = 1;
      // (What the fish is, and how big: friends see it leap as itself. See fightshow.js.)
      if (P.o && P.sp) msg.sp = P.sp;
      if (P.o && P.sz) msg.sz = Math.round(P.sz);
    }
    const S = this.sent;
    // (Slowing down or stopping counts too, so nobody's carried on past where you stopped; so does
    // a lure coming in, or a fish on the line running.)
    const moved = !S || S.m !== msg.m || S.k !== msg.k || S.a !== msg.a || S.f !== msg.f || S.s !== msg.s || S.n !== msg.n || S.o !== msg.o
      || Math.hypot(S.x - msg.x, S.z - msg.z) > 0.25 || Math.abs(S.h - msg.h) > 0.05 || Math.hypot(S.vx - msg.vx, S.vz - msg.vz) > 0.3
      || S.r !== msg.r || S.i !== msg.i || (S.ex == null) !== (msg.ex == null) || (msg.ex != null && Math.hypot(S.ex - msg.ex, S.ez - msg.ez) > 0.3)
      || Math.abs((S.tn ?? 0) - (msg.tn ?? 0)) > 0.12 || S.mv !== msg.mv || S.hk !== msg.hk || S.nt !== msg.nt || S.sp !== msg.sp
      || S.cr !== msg.cr || (msg.cr && Math.hypot(S.cx - msg.cx, S.cz - msg.cz) > 0.15)
      || String(S.tr) !== String(msg.tr);
    if (!now && (this.sendT > 0 || (!moved && this.clock - (S?.at ?? -99) < IDLE_EVERY))) return;
    this.rt.send('pose', { id: this.id, n: this.name(), host: this.hosting, t: Math.round(this.now() * 1000) / 1000, p: msg });
    this.sent = { ...msg, at: this.clock };
    this.sendT = SEND_EVERY;
  }

  // Where your boats in the water are lying (every FLEET_EVERY seconds, or sooner when one moves).
  sendFleet() {
    if (!this.fleetSource || !this.rt?.open || this.reconnecting) return;
    const fl = this.fleetSource().slice(0, FLEET_MAX).map((b) => ({ k: b.k, x: r2(b.x), z: r2(b.z), h: r2(b.h) }));
    const S = this.fleetSent;
    const moved = !S || S.length !== fl.length || fl.some((b, i) => b.k !== S[i].k || Math.hypot(b.x - S[i].x, b.z - S[i].z) > 1 || Math.abs(b.h - S[i].h) > 0.1);
    if (!moved && this.fleetT > -FLEET_EVERY * 2) return;
    this.rt.send('fleet', { id: this.id, fl });
    this.fleetSent = fl;
    this.fleetT = FLEET_EVERY;
  }

  // Which of the visitors' berths are yours, playing in someone else's session: your place among
  // the guests (by id, the same on every screen), or -1 (on your own, or hosting).
  get guestSlot() {
    if (this.status !== 'joined') return -1;
    const ids = [this.id, ...[...this.peers.values()].filter((p) => !p.host && p.id !== this.hostId).map((p) => p.id)].sort();
    return ids.indexOf(this.id);
  }

  // Host: share the world now (and every WORLD_EVERY seconds, or sooner when it changes).
  sendWorld() {
    if (!this.hosting || !this.worldSource || !this.rt?.open || this.reconnecting) return;
    const w = this.worldSource();
    if (!w) return;
    const r3 = (v) => Math.round(v * 1000) / 1000;
    const msg = {
      v: WORLD_V, abs: Math.round(w.abs * 10000) / 10000, rate: Math.round(w.rate * 1e6) / 1e6,
      sky: { state: w.sky.state, cloud: r3(w.sky.cloud), rain: r3(w.sky.rain), storm: r3(w.sky.storm) },
      wind: { from: r3(w.wind.from), speed: r3(w.wind.speed) }, sea: w.sea || 'auto', colour: r3(w.colour || 0),
    };
    this.rt.send('world', { id: this.id, w: msg });
    this.worldSent = { ...msg, at: this.now() };
    this.worldT = WORLD_EVERY;
  }

  // Whether the world has moved on from what was last shared more than the others would guess
  // (a sleep, a change of sky or of pace).
  worldChanged() {
    const S = this.worldSent, w = this.worldSource?.();
    if (!S || !w) return !!w;
    const guess = S.abs + S.rate * (this.now() - S.at);
    const moved = (a, b) => Math.abs(a - b) > 0.05;
    return S.sky.state !== w.sky.state || moved(S.sky.rain, w.sky.rain) || moved(S.sky.cloud, w.sky.cloud) || moved(S.sky.storm, w.sky.storm)
      || Math.abs(w.abs - guess) > 0.05 || Math.abs(w.rate - S.rate) > S.rate * 0.05 + 1e-6 || S.sea !== (w.sea || 'auto');
  }

  // Joiner: the host's world to follow, while there's a host and a recent word from them.
  hostWorld() {
    const W = this.world;
    if (!this.active || this.hosting || !W || !this.peers.has(this.hostId)) return null;
    return this.now() - W.heard < WORLD_STALE ? W : null;
  }

  get hostLabel() { return this.hostName || 'the host'; }

  // A quick call to the others (index into CALLS). Returns whether it went.
  call(i) {
    if (!this.active || !this.rt?.open || this.reconnecting || !Number.isInteger(i) || i < 0 || i >= CALLS.length) return false;
    if (this.clock - this.calledT < CALL_GAP) return false;
    this.calledT = this.clock;
    this.rt.send('call', { id: this.id, c: i });
    return true;
  }

  // Helping a friend with their fish (see teamwork.js): to: their id; e: one of HELPS; f: the fish.
  help(to, e, f, extra = {}) {
    if (!this.active || !this.rt?.open || this.reconnecting || !HELPS.includes(e) || !this.peers.has(to)) return false;
    if (this.clock - (this.helpedT ?? -99) < HELP_GAP) return false;
    this.helpedT = this.clock;
    const kg = finite(extra.kg, 0, 2000);
    this.rt.send('help', { id: this.id, to, e, f, ...(extra.sp ? { sp: plain(extra.sp, 40) } : {}), ...(kg != null ? { kg: Math.round(kg * 100) / 100 } : {}) });
    return true;
  }

  // Crewing (see crew.js): a word to the skipper or their crew (to: their id; e: one of CREW_WORDS;
  // the wheel's ti and si, or w: why not).
  crewWord(to, e, extra = {}) {
    if (!this.active || !this.rt?.open || this.reconnecting || !CREW_WORDS.includes(e) || !this.peers.has(to)) return false;
    const wheel = e === 'wheel', key = `${crewKey(e)}Sent`;
    if (this.clock - (this[key] ?? -99) < crewGap(e)) return false;
    this[key] = this.clock;
    const msg = { id: this.id, to, e };
    if (wheel) Object.assign(msg, { ti: finite(extra.ti, -1, 1) ?? 0, si: finite(extra.si, -1, 1) ?? 0 });
    if (extra.w) msg.w = plain(extra.w, 160);
    this.rt.send('crew', msg);
    return true;
  }

  // A shoal marked for everyone (s: its id in the shared sea; x, z: where it is now).
  markShoal(s, x, z) {
    if (!this.active || !this.rt?.open || this.reconnecting || !Number.isInteger(s)) return false;
    if (this.clock - (this.markedT ?? -99) < SHOAL_GAP) return false;
    this.markedT = this.clock;
    this.rt.send('shoal', { id: this.id, s, x: Math.round(x), z: Math.round(z) });
    return true;
  }

  // You caught something: tell the others (sp: species id, kg).
  caught(sp, kg, { best = false, first = false } = {}) {
    if (this.active && this.rt?.open && !this.reconnecting) this.rt.send('catch', { id: this.id, sp, kg: Math.round(kg * 100) / 100, best, first });
  }

  // Something you found, shared with the others (see FIND_KINDS). Returns whether it went.
  share(find) {
    const F = cleanFind(find);
    if (!F || !this.active || !this.rt?.open || this.reconnecting) return false;
    this.shared = this.shared.filter((at) => this.clock - at < FIND_WINDOW);
    if (this.shared.length >= FIND_BURST) return false;
    this.shared.push(this.clock);
    this.rt.send('find', { id: this.id, f: F });
    return true;
  }

  /* ---------- every frame ---------- */

  // me: where you are now ({ m, x, z, h, k?, f?, s?, n?, a?, o?, and fishing r?, i?, ex?, ez?,
  // tn?, mv? }), or null to send nothing.
  update(dt, me) {
    this.clock += dt;
    this.sendT -= dt;
    if (me && this.active) {
      me = { ...me };
      // (How fast you're going, from where you were: the others carry you on between messages.)
      const was = this.me;
      me.vx = me.vz = 0;
      if (was && dt > 0 && was.m === me.m) {
        const vx = (me.x - was.x) / dt, vz = (me.z - was.z) / dt;
        if (Math.hypot(vx, vz) <= TOP_SPEED[me.cr ? 'boat' : me.m]) {
          const k = 1 - Math.exp(-6 * dt);
          me.vx = (was.vx || 0) + (vx - (was.vx || 0)) * k;
          me.vz = (was.vz || 0) + (vz - (was.vz || 0)) * k;
        }
      }
      this.me = me;
      this.sendPose();
      this.fleetT -= dt;
      if (this.fleetT <= 0) this.sendFleet();
    }
    if (this.hosting) {
      this.worldT -= dt;
      if (this.worldT <= 0 || this.worldChanged()) this.sendWorld();
    } else if (this.active && !this.reconnecting) {
      // The host gone (a reload, a dropped connection): wait a while for them, then call it a day.
      if (this.hostId && this.peers.has(this.hostId)) this.hostGoneAt = null;
      else if (this.hostGoneAt == null) this.hostGoneAt = this.clock;
      else if (this.clock - this.hostGoneAt > HOST_GRACE) {
        const name = this.hostLabel;
        this.forget();
        this.attempt++;
        this.drop();
        this.status = 'off';
        this.changed(`${name[0].toUpperCase()}${name.slice(1)} has gone, so the session has ended.`);
        this.onEvent('ended', null, { hostGone: true, name });
      }
    }
    // Everyone else, drawn where they were a moment ago (see DELAY).
    const now = this.now();
    for (const p of this.peers.values()) {
      // (Anyone Realtime's presence still counts as here stays, however quiet: a phone in a
      // pocket, a tab in the background. Presence says when they go.)
      if (!p.present && this.clock - p.seen > PEER_TIMEOUT) {
        this.gone(p.id);
        continue;
      }
      if (!p.at || !p.snaps.length) continue;
      // (The replay eases onto a new reckoning of the delivery time, never jumping to it: twice
      // smoothed, so its speed changes gently too, and never more than CATCH_UP off real time.)
      if (p.ofs == null || Math.abs(p.offset - p.ofs) > 1) p.ofs = p.ofsT = p.offset;
      else {
        p.ofsT += Math.max(-CATCH_UP * dt, Math.min(CATCH_UP * dt, (p.offset - p.ofsT) * dt));
        p.ofs += (p.ofsT - p.ofs) * (1 - Math.exp(-dt));
      }
      glide(p, now - p.ofs - DELAY, dt);
    }
  }
}
