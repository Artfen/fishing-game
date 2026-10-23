import { CLOUD_CONFIG } from './cloud-config.js';
import { SAVE_VERSION, envelope, parseSave, mergeStates, adoptJournal, hasProgress } from './save.js';

// Optional cloud saves through Supabase, talking to its REST API directly (no SDK).
//
// Nothing here runs, and nothing about accounts is shown, unless a backend is configured
// (src/cloud-config.js, or SUPABASE_URL / SUPABASE_ANON_KEY on Vercel via api/cloud-config.js).
// Sign-in is by email link: no passwords. Guest play always works, signed in or not.
//
// Saves live in the slow_tide_saves table (supabase/schema.sql), one row per player,
// protected by row level security. Each row carries a revision number: a write only
// lands if nobody else wrote since we last looked, otherwise we fetch the newer save,
// combine the two (nothing caught or found is ever dropped) and try again.

const SESSION = 'slow-tide-cloud';
const TABLE = 'slow_tide_saves';
const PUSH_DELAY = 15000; // seconds of quiet after a save before it goes to the cloud

function privileged(key) {
  if (key.startsWith('sb_secret_')) return true;
  const parts = key.split('.');
  if (parts.length !== 3) return false;
  try {
    return JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'))).role === 'service_role';
  } catch {
    return false;
  }
}

function validConfig(c) {
  if (!c || typeof c.url !== 'string' || typeof c.anonKey !== 'string' || !c.url || !c.anonKey) return null;
  const url = c.url.trim().replace(/\/+$/, '');
  if (!/^https:\/\//.test(url) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(url)) return null;
  if (privileged(c.anonKey)) {
    console.error('Slow Tide: the cloud save key is a privileged (service_role / secret) key. It must never be used in a browser; cloud saves are off. Use the anon / publishable key.');
    return null;
  }
  return { url, anonKey: c.anonKey.trim() };
}

class CloudError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.status = status;
  }
}

export class Cloud {
  constructor() {
    this.cfg = null;
    this.session = null;   // { access_token, refresh_token, expires_at, user: { id, email }, rev }
    this.state = 'off';    // off | signedOut | sending | sent | signedIn
    this.message = '';     // a line for the journal: what just happened, or what went wrong
    this.lastSync = 0;
    this.syncing = false;
    this.paused = false;   // the cloud save is from a newer game version: leave it alone
    this.timer = null;
    this.waiting = false;  // changes made while offline (or while the cloud couldn't be reached)
    this.onChange = () => {};
  }

  get enabled() { return !!this.cfg; }
  get signedIn() { return this.state === 'signedIn'; }
  get email() { return this.session?.user?.email || ''; }

  changed(message) {
    if (message != null) this.message = message;
    this.onChange();
  }

  /* ---------------- setup ---------------- */

  async loadConfig() {
    let cfg = validConfig(CLOUD_CONFIG);
    if (!cfg) {
      try {
        const r = await fetch('api/cloud-config', { cache: 'no-store' });
        if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
          const j = await r.json();
          if (j.error) console.warn(`Slow Tide cloud saves: ${j.error}`);
          if (j.enabled) cfg = validConfig(j);
        }
      } catch { /* no config endpoint (a plain static host): guest only */ }
    }
    return cfg;
  }

  readSession() {
    try {
      const s = JSON.parse(localStorage.getItem(SESSION) || 'null');
      return s && s.access_token && s.refresh_token && s.user?.id ? s : null;
    } catch {
      return null;
    }
  }

  writeSession() {
    try {
      if (this.session) localStorage.setItem(SESSION, JSON.stringify(this.session));
      else localStorage.removeItem(SESSION);
    } catch { /* storage blocked: the session lasts until the tab closes */ }
  }

  // Whether startup should wait for the cloud (a sign-in link just opened, or already signed in).
  static fromLink() {
    return /access_token=|error_description=/.test(location.hash);
  }

  static expected() {
    return Cloud.fromLink() || (() => {
      try { return !!localStorage.getItem(SESSION); } catch { return false; }
    })();
  }

  // Find the backend, finish a sign-in from an email link, restore a session.
  async init() {
    this.cfg = await this.loadConfig();
    const hash = new URLSearchParams(location.hash.slice(1));
    const fromLink = hash.has('access_token') || hash.has('error_description');
    if (fromLink) history.replaceState(null, '', location.pathname + location.search);
    if (!this.cfg) {
      this.state = 'off';
      return;
    }
    this.state = 'signedOut';
    if (hash.has('error_description')) {
      this.message = `That sign-in link didn’t work (${hash.get('error_description')}). Links expire after a while and work once: ask for a new one.`;
    }
    if (hash.has('access_token')) {
      this.session = {
        access_token: hash.get('access_token'),
        refresh_token: hash.get('refresh_token') || '',
        expires_at: Number(hash.get('expires_at')) || Math.floor(Date.now() / 1000) + Number(hash.get('expires_in') || 3600),
        user: null,
        rev: 0,
      };
      try {
        const u = await this.api('GET', '/auth/v1/user');
        this.session.user = { id: u.id, email: u.email || '' };
        this.writeSession();
        this.state = 'signedIn';
        this.message = '';
      } catch (err) {
        this.session = null;
        this.message = `Signing in didn’t finish: ${err.message}`;
      }
      return;
    }
    this.session = this.readSession();
    if (this.session) {
      try {
        await this.freshToken();
        this.state = 'signedIn';
      } catch (err) {
        if (err.status === 400 || err.status === 401 || err.status === 403) {
          this.session = null;
          this.writeSession();
          this.message = 'You’ve been signed out. Your progress in this browser is safe: sign in again to sync it.';
        } else {
          // Offline, probably: stay signed in and try again later.
          this.state = 'signedIn';
          this.message = 'Couldn’t reach the cloud just now. Your progress is saved in this browser and will sync later.';
        }
      }
    }
  }

  /* ---------------- talking to Supabase ---------------- */

  async api(method, path, { body, auth = true, prefer, keepalive = false } = {}) {
    const headers = { apikey: this.cfg.anonKey, Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (prefer) headers.Prefer = prefer;
    if (auth && this.session) headers.Authorization = `Bearer ${this.session.access_token}`;
    let r;
    try {
      r = await fetch(this.cfg.url + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), keepalive });
    } catch {
      throw new CloudError('no connection', 0);
    }
    const text = await r.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    if (!r.ok) {
      const why = json?.msg || json?.message || json?.error_description || json?.error || `error ${r.status}`;
      throw new CloudError(why, r.status);
    }
    return json;
  }

  async freshToken() {
    const s = this.session;
    if (!s) throw new CloudError('not signed in', 401);
    if (s.expires_at - 60 > Date.now() / 1000) return;
    const t = await this.api('POST', '/auth/v1/token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token }, auth: false });
    s.access_token = t.access_token;
    s.refresh_token = t.refresh_token || s.refresh_token;
    s.expires_at = t.expires_at || Math.floor(Date.now() / 1000) + (t.expires_in || 3600);
    if (t.user) s.user = { id: t.user.id, email: t.user.email || s.user.email };
    this.writeSession();
  }

  /* ---------------- signing in and out ---------------- */

  async sendLink(email) {
    email = String(email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.changed('That doesn’t look like an email address.');
      return false;
    }
    this.state = 'sending';
    this.changed('Sending…');
    const back = location.origin + location.pathname;
    try {
      await this.api('POST', `/auth/v1/otp?redirect_to=${encodeURIComponent(back)}`, { body: { email, create_user: true }, auth: false });
      this.state = 'sent';
      this.changed(`A sign-in link is on its way to ${email}. Open it on this device; your progress here will come with you.`);
      return true;
    } catch (err) {
      this.state = 'signedOut';
      this.changed(err.status === 429 ? 'Too many sign-in emails just now. Please wait a minute and try again.' : `Couldn’t send the email: ${err.message}.`);
      return false;
    }
  }

  async signOut() {
    clearTimeout(this.timer);
    try { await this.api('POST', '/auth/v1/logout'); } catch { /* signed out locally either way */ }
    this.session = null;
    this.writeSession();
    this.state = 'signedOut';
    this.changed('Signed out. You’re playing as a guest; your progress stays in this browser.');
  }

  /* ---------------- syncing ---------------- */

  async pull() {
    await this.freshToken();
    const rows = await this.api('GET', `/rest/v1/${TABLE}?select=version,rev,saved_at,data&user_id=eq.${this.session.user.id}`);
    const row = Array.isArray(rows) ? rows[0] : null;
    if (!row) return null;
    const savedAt = Date.parse(row.saved_at) || 0;
    const parsed = parseSave(JSON.stringify({ game: 'slow-tide', version: row.version, savedAt, data: row.data }));
    return { ...parsed, rev: row.rev, savedAt };
  }

  // Write `state` to the cloud, guarded by the revision we last saw.
  async write(state, savedAt, keepalive = false) {
    await this.freshToken();
    const env = envelope(state);
    const body = { version: SAVE_VERSION, saved_at: new Date(savedAt || env.savedAt).toISOString(), data: env.data };
    // Browsers only let small requests outlive the page; a big save goes as a normal request.
    keepalive = keepalive && JSON.stringify(body).length < 60000;
    const s = this.session;
    if (!s.rev) {
      try {
        const rows = await this.api('POST', `/rest/v1/${TABLE}`, { body: { ...body, user_id: s.user.id, rev: 1 }, prefer: 'return=representation', keepalive });
        s.rev = rows?.[0]?.rev || 1;
        this.writeSession();
        return true;
      } catch (err) {
        if (err.status === 409) return false; // someone already made the row: fetch and combine
        throw err;
      }
    }
    const rows = await this.api('PATCH', `/rest/v1/${TABLE}?user_id=eq.${s.user.id}&rev=eq.${s.rev}`, { body: { ...body, rev: s.rev + 1 }, prefer: 'return=representation', keepalive });
    if (!Array.isArray(rows) || !rows.length) return false;
    s.rev = rows[0].rev;
    this.writeSession();
    return true;
  }

  // On sign-in or at startup: combine the cloud save with this browser's. Returns
  // { state, note } with the state to play, or null to keep the local one untouched.
  async syncAtStart(local, localSavedAt) {
    if (!this.signedIn) return null;
    this.syncing = true;
    try {
      const remote = await this.pull();
      if (this.session.replace) {
        // A new game (or a loaded copy) on this device replaces the cloud save.
        this.session.rev = remote && !remote.newer ? remote.rev : 0;
        this.paused = false;
        delete this.session.replace;
        await this.pushNow(local, Date.now());
        this.message = 'Your account now holds this game.';
        return { state: local, note: '' };
      }
      if (remote?.newer) {
        this.paused = true;
        this.changed('Your cloud save is from a newer version of Slow Tide. Reload the page to update; until then it won’t be touched.');
        return null;
      }
      let state = local, note = '';
      if (!remote) {
        this.session.rev = 0;
        note = hasProgress(local) ? 'Signed in. Your progress from this browser is now saved to your account.' : 'Signed in. Your progress will be saved to your account.';
      } else {
        this.session.rev = remote.rev;
        if (!hasProgress(local)) {
          state = mergeStates(local, remote.state, 'b');
          note = 'Signed in. Your cloud save is loaded.';
        } else {
          state = mergeStates(local, remote.state, remote.savedAt > localSavedAt ? 'b' : 'a');
          note = hasProgress(remote.state)
            ? 'Signed in. Your progress in this browser and your cloud save have been combined: every catch and place from both is kept.'
            : 'Signed in. Your progress from this browser is now saved to your account.';
        }
      }
      if (await this.pushNow(state, Date.now())) this.waiting = false;
      this.message = note;
      return { state, note };
    } catch (err) {
      this.waiting = true;
      this.changed(navigator.onLine === false ? '' : `Couldn’t sync just now (${err.message}). Your progress is saved in this browser and will sync later.`);
      return null;
    } finally {
      this.syncing = false;
    }
  }

  // Push, and if another device saved in between, take in its catches and try again.
  async pushNow(state, savedAt, keepalive = false) {
    if (!this.signedIn || this.paused) return false;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (await this.write(state, savedAt, keepalive)) {
        this.lastSync = Date.now();
        this.changed('');
        return true;
      }
      if (keepalive) return false; // leaving the page: no time to combine; the next visit will
      const remote = await this.pull();
      if (!remote) {
        this.session.rev = 0;
        continue;
      }
      if (remote.newer) {
        this.paused = true;
        this.changed('Your cloud save is from a newer version of Slow Tide. Reload to update.');
        return false;
      }
      this.session.rev = remote.rev;
      adoptJournal(state, mergeStates(state, remote.state, 'a'));
    }
    return false;
  }

  // After each local save: send it to the cloud once things are quiet for a moment.
  queue(state, savedAt) {
    if (!this.signedIn || this.paused) return;
    clearTimeout(this.timer);
    this.timer = null;
    // Offline: the save in this browser is the queue; it goes up when the connection is back.
    if (navigator.onLine === false) {
      this.waiting = true;
      return;
    }
    this.timer = setTimeout(() => this.flush(state, savedAt), PUSH_DELAY);
  }

  // The connection is back: send whatever was saved meanwhile (combining with anything newer).
  reconnected(state, savedAt) {
    if (this.signedIn && !this.paused && this.waiting) this.flush(state, savedAt);
  }

  async flush(state, savedAt, keepalive = false) {
    clearTimeout(this.timer);
    this.timer = null;
    if (!this.signedIn || this.paused || (this.syncing && !keepalive)) return;
    if (navigator.onLine === false) {
      this.waiting = true;
      return;
    }
    this.syncing = true;
    try {
      if (await this.pushNow(state, savedAt, keepalive)) this.waiting = false;
    } catch (err) {
      if (err.status === 0) this.waiting = true;
      if (err.status === 401 || err.status === 403) {
        this.session = null;
        this.writeSession();
        this.state = 'signedOut';
        this.changed('You’ve been signed out. Your progress in this browser is safe: sign in again to sync it.');
      } else this.changed(`Not synced yet (${err.message}). Your progress is saved in this browser; it will try again.`);
    } finally {
      this.syncing = false;
    }
  }

  get pending() { return !!this.timer || this.waiting; }

  // Starting a new game or loading a copy: the next sync replaces the cloud save with it.
  replaceNextSync() {
    if (!this.session) return;
    this.session.replace = true;
    this.writeSession();
  }
}
